(function () {

    if (window.self !== window.top) {
        return;
    }

    "use strict";

    let dateNow = Date.now();
    let newAPI = false;
    let wasAuthCheck = false;
    let authClicked = 0;
    let busy = false;
    const bkHere = window.location.href.indexOf('betfair.es') > -1 ? "betfaires" : "betfair";
    let port = chrome.runtime.connect({name: `port_${bkHere}`});
    const portPostMessage = message => {
        try {
            port.postMessage(message);
        } catch (e) {
            window.location.reload();
        }
    };
    let settings = {
        authCheckInterval: 2000,
        url: bkHere === 'betfair' ? 'https://www.betfair.com/sport/inplay' : 'https://www.betfair.es/sport/inplay',
        check: '/sport/inplay',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 3,
        betweenBets: 25000,
        newExpresses: false,
    };

    let ourCommand = new ourCommandProto();

    let currentBetData = false;
    let currentCommand = '';

    const sportAccordance = {
        'FOOTBALL': 'Football',
        'TENNIS': 'Tennis',
        'TABLETENNIS': 'Table Tennis',
        'BASEBALL': 'Baseball',
        'HOCKEY': 'Ice Hockey',
        'BASKETBALL': 'Basketball',
        'VOLLEYBALL': 'Volleyball',
        'HANDBALL': 'Handball',
        'CYBERSPORT': 'E-Sports',
    };

    const messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;
        if (message.action === 'CHECK_BUSY') {
            portPostMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        }
        let $username = $('input.login__input[autocomplete="username"]');
        currentCommand = message.action;
        if (message.action !== 'auth' && busy) {
            portPostMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY"
            });
        } else if (message.action === "auth") {
            portPostMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            settings.newExpresses = !!(settings?.stake_fork && settings.stake_fork?.newExpresses);
            authCheck(settings);
            wasAuthCheck = true;
        } else if ($username.length !== 0) {
            portPostMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (message.action === 'MAXIMUM') {
            busy = true;
            dLog('green', 'BF', 'MAXIMUM for: ' + message.data[0].market + '/' + message.data[0].target + '/' + message.data[0].pivot);
            closePreviousCoupons()
                .then(() => openCoupon(message.data).then((max) => checkCoefs(message.data)
                    .then(() => {
                        busy = false;
                        portPostMessage({
                            answered: "MAXIMUM",
                            status: 'success',
                            answer: max
                        });
                    })))
                .catch((e) => {
                    busy = false;
                    portPostMessage({
                        answered: "MAXIMUM",
                        status: "error",
                        answer: "Error: " + e
                    });
                });
        } else if (['BET', 'EXPRESS_BET'].indexOf(message.action) > -1) {
            busy = true;
            ourCommand.set(message);
            proceedBet(message.data)
                .finally(() => {
                    busy = false;
                    ourCommand.clear();
                });
        } else if (message.action === 'BET_RESULT') {
            busy = true;
            ourCommand.set(message);
            collectData(message.data)
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                }).catch(() => {
                busy = false;
                ourCommand.clear();
            });
        } else if (['DEPOSIT', 'WITHDRAW', 'CHECK_PAYMENTS'].indexOf(message.action) > -1) {
            busy = true;
            ourCommand.set(message);
            (d => message.action === 'DEPOSIT' ? deposit(d) : message.action === 'WITHDRAW' ? withdraw(d) : checkPayments(d))(message.data)
                .then(() => dLog('green', 'BF', `It's looks like ${message.action} done!`))
                .catch((e) => dLog('red', 'BF', `Error till ${message.action}: ${e}`))
                .then(delayFunction(7777))
                .then(async () => {
                    busy = false;
                    ourCommand.clear();
                    await mouseChain({target: $('#SPORTSBOOK')[0], events: ['click'], scroll: true});
                });
        }
    };

    const withdraw = async data => new Promise((onSuccess, onReject) => {
        const report = function (success, message) {
            dLog('green', 'BF', 'Report! ' + success + ' / ' + message);
            portPostMessage({
                answered: "WITHDRAW",
                status: success ? "SUCCESS" : "FAILED",
                answer: message
            });
            if (success) {
                onSuccess(message);
            } else {
                onReject(message);
            }
        };
        const $getIFrame = selector => $($(selector)[0].contentDocument);
        (async () => {
            if (document.location.href.indexOf('/payments/withdraw') > -1) {
                await waitForCondition(() => $getIFrame('#iframePage').find('a.selector').length > 0,
                    333, 30000, 'No buttons!');
                await delayPromise(3000);
                if ($getIFrame('#iframePage').find('a.selector.selected span.long').trt() !== 'Alternative Methods') {
                    await mouseChain({
                        target: $getIFrame('#iframePage').find('a.apm-tab.selector')[0],
                        events: ['click']
                    });
                    await delayPromise(3000);
                }
                await bMess('SCH_COMMAND', true).set(ourCommand.get());
                const depositResult = await bMess('DEPOSIT_RESULT', true).get(180000, 30000);
                report(depositResult.success, 'WP1: ' + (depositResult.message || 'No message :('));
                await bMess('SCH_COMMAND', true).remove();
                await bMess('DEPOSIT_RESULT', true).remove();
            } else if (document.location.href.indexOf('/summary/accountsummary') > -1) {
                const $el = await waitForElement('li.has-sub-menu:has(a:contains("Payments"))', 333, 20000, true);
                await delayPromise(1500);
                $el.addClass('open');
                const $el2 = await waitForElement('ul.dropdown-menu a:contains("Withdraw")', 333, 3333, true);
                await delayPromise(1000);
                await mouseChain({target: $el2[0], events: ['click'], error: 'Withdraw btn'});
            } else {
                const $el = await waitForElement('a.ssc-unc:contains("My Account")', 333, 20000, true);
                await delayPromise(3000);
                await mouseChain({target: $el[0], events: ['click'], error: 'My Account'});
                await delayPromise(3000);
                const $el2 = await waitForElement('a.ssc-myBetfairAccount', 333, 5555, true);
                await delayPromise(1000);
                await mouseChain({target: $el2[0], events: ['click'], error: 'Account 2'});
            }
        })()
            .catch(e => report(false, `Error till withdraw: ${e}`));
    });

    const depositDo = async data => {
        const $getIFrame = selector => $($(selector)[0].contentDocument);
        if (document.location.href.indexOf('/payments/deposit?') > -1) {
            await waitForCondition(() => $getIFrame('#iframePage').find('a.selector').length > 0,
                333, 30000, 'No buttons!');
            await delayPromise(3000);
            if ($getIFrame('#iframePage').find('a.selector.selected span.long').trt() !== 'Alternative Methods') {
                await mouseChain({
                    target: $getIFrame('#iframePage').find('a.apm-tab.selector')[0],
                    events: ['click'], error: 'asssl',
                });
                await delayPromise(3000);
            }
            await bMess('SCH_COMMAND', true).set(ourCommand.get());
            return await bMess('DEPOSIT_RESULT', true).get(180000);
        } else {
            const $el = await waitForElement('a[data-gtml="Deposit"]', 333, 20000, true);
            await delayPromise(3000);
            await mouseChain({target: $el[0], events: ['click'], error: '$dep'});
        }
        await delayPromise(100000);
    };

    const deposit = data => new Promise(function (onSuccess, onReject) {
        dLog('green', 'BF', ['Deposit!', data]);
        const report = (success, message, wallet_balance) => {
            dLog('green', 'BF', `Report! ${success} / ${message} / ${wallet_balance}`);
            portPostMessage({
                answered: "DEPOSIT",
                status: message.indexOf('NO_FUNDS') > -1 ? 'NO_FUNDS' : (success ? "SUCCESS" : "FAILED"),
                answer: message,
                balance: getBalance(),
                wallet_balance: wallet_balance || '',
            });
            success ? onSuccess(message) : onReject(message);
        };
        depositDo(data)
            .then(depRes => report(depRes.success, depRes.message || 'No message!', depRes.balance))
            .catch(e => report(false, `Error till deposit: ${e}, ${formatStack(e.stack)}`));
    });

    const checkPayments = function () {
        dLog('green', 'BF', 'checkPayments!');
        return new Promise(function (onSuccess, onReject) {
            let collected = [];
            let report = function (success, message) {
                dLog('green', 'BF', 'Report! ' + success + ' / ' + message);
                portPostMessage({
                    answered: "CHECK_PAYMENTS",
                    data: success ? collected : [],
                    answer: message
                });
                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                }
            };
            let $getIFrame = function (selector) {
                return $($(selector)[0].contentDocument);
            };
            let letsRockNRoll = function () {
                dLog('green', 'BF', 'letsRockNRoll');
                if (document.location.href.indexOf('/summary/accountstatement') > -1) {
                    waitForCondition(() => {
                        return $getIFrame('#iframePage').find('select[name="accountStatementSelector"]').length > 0;
                    }, 333, 20000, 'No filter!')
                        .then(delayFunction(3333))
                        .then(() => {
                            let $select = $getIFrame('#iframePage').find('select[name="accountStatementSelector"]');
                            if ($select.val() !== 'dpw') {
                                $select.find('option[value="dpw"]').prop('selected', true);
                                fireChangeEvent($select[0]);
                                fireInputEvent($select[0]);
                                return delayPromise(7777);
                            }
                        })
                        .then(waitForCondition(() => {
                            return $getIFrame('#iframePage').find('#AccountWrapper').length > 0;
                        }, 333, 20000, 'No data!', true))
                        .then(delayFunction(3333))
                        .then(() => {
                            collected = [];
                            $getIFrame('#iframePage').find('#AccountWrapper tr:has(td.GlobalTableCell)').each(function () {
                                let $tds = $(this).find('>td');
                                let desc = $tds.eq(4).trt() + ' ' + $tds.eq(2).trt();
                                let type = desc.indexOf('deposit') > -1 ? 'IN' : 'OUT';
                                collected.push({
                                    date: $tds.eq(1).trt(),
                                    description: desc,
                                    type: type,
                                    paysystem: 'SKRILL',
                                    amount: $tds.eq(type === 'IN' ? 10 : 9).text().replace(/[^\d.]/g, '').trim(),
                                    success: true
                                });
                            });
                            report(true, 'It have to be good :)');
                            console.log(collected);
                        })
                        .catch((e) => report(false, 'Collecting: ' + e));
                } else if (document.location.href.indexOf('/summary/accountsummary') > -1) {
                    waitForElement('li.link-group:has(span:contains("Betting Activity"))', 333, 20000, true)
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => {
                            $el.find('a').css('color', '#31953e').css('opacity', 100);
                            $el.find('span+.dropdown').css('transform', 'scaleY(1)').css('height', 'auto').css('overflow', 'visible');
                        })
                        .then(waitForElementF('a[data-page-tag="Account Statement"]', 333, 3333, true))
                        .then(($el) => delayPromise(1111, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .catch((e) => report(false, 'Go to Transactions history: ' + e));
                } else {
                    waitForElement('a.ssc-unc:contains("My Account")', 333, 20000, true)
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(3333))
                        .then(waitForElementF('a[data-gtml="my account - myBetfairAccount"]', 333, 5555, true))
                        .then(($el) => delayPromise(1111, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .catch((e) => report(false, 'Go to: ' + e));
                }
            };
            letsRockNRoll();
        });
    };

    const checkLimited = async text => {
        const limiteds = await bMess('BETFAIR_LIMITEDS').check(864e6).catch(() => []);
        limiteds.push(`${nowFormatted()}: ${text}`);
        if (limiteds.length >= 3) {
            throw `LIMITED ${limiteds.join('; ')}`
        }
        await bMess('BETFAIR_LIMITEDS').set(limiteds);
    };

    const proceedBet = async data => {
        const sourceData = JSON.parse(JSON.stringify(data));
        let currentBetDataMax = 0;
        const betFinished = async (success, message) => {
            dLog('BF', 'green', [`Bet finished ${success}:`, message]);
            let status = 'ACCEPTED';
            if (!success) {
                const bad = ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED']
                    .find(c => typeof message === 'string' && message.indexOf(c) > -1);
                status = bad || 'FAILED';
            }
            const resultData = {
                "external_id": success ? message.id : '',
                "status": status,
                "market": sourceData[0].market,
                "target": sourceData[0].target,
                "pivot": sourceData[0].pivot,
                "coef": success ? message.coef : sourceData[0].coef,
                "stake": success ? message.stake : sourceData[0].stake,
                "maximum": currentBetDataMax,
                "bkPivot": success ? message.bkPivot : null,
                "bkTeam": success ? message.bkTeam : null,
            };

            if (success) {
                await eventsWorkAll('BF',
                    settings.eventMaxBets, settings.eventTimeLimit,
                    currentBetData.data, true, true);
                await bMess('WasSuccessStake').set(Date.now());
                await bMess('Stake Maximums').set(0);
                if (settings.newExpresses) {
                    // Hint: currentFirstBet MUST exists, otherwise some shit happened!
                    const
                        currentFirstBet = await bMess('currentFirstBet').check(1080000, true),
                        used = await bMess('usedEvents').check(1080000).catch(() => ({}));
                    if (!used[currentFirstBet]) {
                        used[currentFirstBet] = 1;
                    } else {
                        used[currentFirstBet]++;
                    }
                    await bMess('usedEvents').set(used);
                    dLog('BF', 'blue-big', [`We set bet with first: '${currentFirstBet}', now used:`, used]);
                }
            }
            const
                doNotSend = !!currentBetData.data[0].betFromParser && !success
                    && resultData.status !== 'LIMITED',
                fBetResult = {};
            if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                for (const g of ['external_id', 'status', 'market', 'target', 'pivot', 'coef',
                    'stake', 'maximum',]) {
                    fBetResult[g] = resultData[g];
                }
                fBetResult.type = 'VALUE';
                fBetResult.mode = currentBetData.data[0].type;
                fBetResult.bookmaker = 'PADDY';
                fBetResult.placedCoef = resultData.coef;
                fBetResult.coef = currentBetData.data[0].coef;
                fBetResult.source = currentBetData.data[0]?.source || 'oddscp';
                fBetResult.currency = currentBetData.data[0]?.currency || 'USD';
                fBetResult.externalId = resultData.external_id;
                fBetResult.sport = currentBetData.data[0].sport;
                fBetResult.timeValue = currentBetData.data[0].time_value;
                fBetResult.league = currentBetData.data[0].league;
                fBetResult.homeTeam = currentBetData.data[0].team1;
                fBetResult.awayTeam = currentBetData.data[0].team2;
                fBetResult.score = currentBetData.data[0].score;
                fBetResult.pivot = resultData.pivot || null;
            }

            port.postMessage({
                answered: !!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED'
                    ? "F_BET" : "BET",
                data: !!currentBetData.data[0].betFromParser ? fBetResult : resultData,
                answer: success ? 'Everything is Okay!' : message,
                doNotSend,
            });

            dLog('BF', 'green', [`Result data (${success}): `, resultData]);
        };
        const
                realSuccessInterval = data[0].successBetInterval || settings.betweenBets,
                wasSuccessStake = await bMess('WasSuccessStake')
                    .check(realSuccessInterval)
                    .catch(() => 0),
                successDiff = Date.now() - wasSuccessStake;
            if (successDiff < realSuccessInterval) {
                throw `To early after previous success bet ${successDiff} instead of ${realSuccessInterval}!`
            }
            if (!!currentBetData.data[0].betFromParser) {
                const checkRes = await eventsWorkAll('BF',
                    settings.eventMaxBets, settings.eventTimeLimit,
                    currentBetData.data, false, true);
                if (checkRes !== 'OK') {
                    dLog('red', 'BF', `We got errors: ${checkRes}`);
                    throw checkRes;
                } else {
                    dLog('big-blue', 'BF',
                        `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                    for (const d of currentBetData.data) {
                        const eventName = `${d.team1} - ${d.team2}`;
                        dLog('blue', 'BF', `${settings.eventMaxBets} for ${eventName} not reached`);
                    }
                }
            }

        try {
            const res = await proceedBetDo(data);
            currentBetDataMax = res.max;
            await betFinished(true, res.result);
        } catch (e) {
            await betFinished(false, e);
        }
    };

    const proceedBetDo = async data => {
        let currentBetDataMax = 0;
        const checkBalanceAndWillPlace = willPlace => {
            if (isNaN(willPlace) || !willPlace || willPlace <= 0) {
                throw `Bad willPlace ${willPlace}`;
            }
            let balance = parseFloat($('table.ssc-wldw td.ssc-wla').first().trt().replace(/[^\d.]/g, '').trim());
            if (isNaN(balance)) {
                throw 'Get balance error';
            } else if (balance < willPlace) {
                throw 'NO_FUNDS - now: ' + balance + ', we need: ' + willPlace;
            }
            dLog('BF', 'green',
                `Will place (performBet): ${willPlace}, max: ${currentBetDataMax} balance: ${balance}`);
        };
        const enterStake = async willPlace => {
            const willPlaceString = willPlace.toString().replace('.00', '').trim();
            let $inputs = $('div.betslip-container-real div.bet-stakes input.stake');
            if ($inputs.length < 1) {
                throw 'There is no input for stake!';
            }
            const $input = $inputs.last();
            $input[0].focus();
            await delayPromise(111);
            await mouseChain({target: $input[0], events: fullClick, error: '>INPUT<'});
            await clearAndSimulate($input[0], willPlaceString);
            await delayPromise(222);
            await bsDebuggerEventsChain(bkHere, [
                {type: 'selector', body: 'div.betslip-container-real div.bet-stakes input.stake:last'},
                {type: 'keyCode', body: '9'}
            ], 200);
            $input[0].blur();
            await delayPromise(200);
        };
        const clickPlaceBtn = async () => {
            const $placeBtn = $('div.betslip-container-real button.place-bets-button');
            if ($placeBtn.length !== 1 || $placeBtn.hasClass('ui-disabled')) {
                throw 'No placeBtn ot it is disabled ' + $placeBtn.length;
            }
            await mouseChain({target: $placeBtn[0], events: fullClick, error: 'placeBtn'});
        };
        const clickConfirmBtn = async () => {
            const $confirmBtn = await waitForElement('div.place-confirm-bets button.confirm-bets-button', 333, 7777).catch(() => $([]));
            if ($confirmBtn.length > 0) {
                await mouseChain({target: $confirmBtn[0], events: fullClick, error: '$confirmBtn'});
            }
            await delayPromise(555);

        };
        const waitForResult = async () => {
            let result = 'Bet failed!';
            const started = Date.now();
            while (Date.now() - started < 30000) {
                await delayPromise(300);
                const error = $('p.error:visible').trt();
                const $cancelNoticesBtn = $('button.webpush-swal2-cancel');
                if ($cancelNoticesBtn.length === 1) {
                    await mouseChain({target: $cancelNoticesBtn[0], events: fullClick, error: 'CNB'});
                } else if (error.length > 0 && error.indexOf('Odds have changed') > -1) {
                    result = 're-bet';
                    break;
                } else if ($('div.message-bets-placed').trt().indexOf('Bet Placed') > -1
                    && $('button:contains("Show Full Receipt")').length === 1) {
                    result = 'success';
                    break;
                }
            }
            return result;
        };
        const collectBetData = async () => {
            const $bet = () => data.length === 1
                ? $('div.betslip-body div.bets-container:visible div.bets div.singles-section')
                : $('div.betslip-body div.bets-container:visible div.bets div.multiples');
            const started = Date.now();
            while ($bet().length === 0 && Date.now() - started < 10000) {
                await delayPromise(300);
            }
            if ($bet().length > 1) {
                throw 'Wrong amount of $bet ' + $bet.length;
            } else if ($bet().length === 0) {
                throw 'We had wait for $bet for ' + (Date.now() - started) + 'ms, and... we tired!';
            }
            const $betInfo = $bet();
            let results = {};
            if (data.length === 1) {
                dLog('orange', 'BF', 'collectBetData - 1');
                results = {
                    id: $betInfo.find('span.receipt-bet-ref').trt(),
                    status: 'ACCEPTED',
                    match: $betInfo.find('span.home-team-name').trt() + ' - ' + $betInfo.find('span.away-team-name').trt(),
                    bkPivot: $betInfo.find('div.market-name div.market').trt(),
                    bkTeam: $betInfo.find('div.selection-name').trt(),
                    coef: decOdds($betInfo.find(findSelIn(['span.odds.ui-display-decimal-price',
                        'span.ui-display-fraction-price'], $betInfo)).trt()).toString(),
                    stake: $betInfo.find('div.bet-stakes input.stake').val().trim(),
                    result: $betInfo.find('div.bet-information-inner-bottom span.potential').trt().replace(/[^\d.]/g, '').trim()
                };
            } else {
                dLog('orange', 'BF', 'collectBetData - 2');
                results = {
                    id: $betInfo.find('span.m-bet-ref').trt(),
                    status: 'ACCEPTED',
                    match: $betInfo.find('span.home-team-name').first().trt() + ' - ' + $betInfo.find('span.away-team-name').first().trt(),
                    bkPivot: $betInfo.find('div.m-market-name div.market').first().trt(),
                    bkTeam: $betInfo.find('div.m-selection-name').first().trt(),
                    coef: $betInfo.find('div.m-receipt-details-odds').text().replace(/[^\d.]/g, ''),
                    stake: $betInfo.find('div.m-receipt-details-container input.m-total-value').val().trim(),
                    result: $betInfo.find('div.m-receipt-details-container div.m-potential').trt().replace(/[^\d.]/g, '').trim()
                };
            }
            let $close = $('button.close-betslip');
            if ($close.length === 1) {
                await mouseChain({target: $close[0], events: ['click'], error: 'close'});
            }
            return results;
        };
        await closePreviousCoupons();
        currentBetDataMax = parseFloat(await openCoupon(data));
        if (currentBetDataMax === 0) {
            await checkLimited(`Maximum is ${currentBetDataMax}`);
        }
        const willPlace = currentBetDataMax < parseFloat(data[0].stake)
            ? currentBetDataMax : parseFloat(data[0].stake);
        checkBalanceAndWillPlace(willPlace);
        await checkCoefs(data);
        await enterStake(willPlace);
        dLog('BF', 'green', `It looks like we successfully entered stake: ${willPlace}`);
        await clickPlaceBtn();
        await clickConfirmBtn();
        let res = await waitForResult();
        while (res === 're-bet') {
            await checkCoefs(data);
            await clickPlaceBtn();
            res = await waitForResult();
        }
        if (res === 'success') {
            await mouseChain({
                target: $('button:contains("Show Full Receipt")')[0],
                events: fullClick,
                error: 'fullReceipt'
            });
            return {result: await collectBetData(), max: currentBetDataMax};
        } else {
            throw res;
        }
    };

    const closePreviousCoupons = function () {
        return new Promise(function (onSuccess, onReject) {
            dLog('green', 'BF', 'closePreviousCoupons');
            let clickRemoveAllStarted = 0;
            let $button = $('div.betslip-launcher button');
            if ($button.length === 1 && $button.hasClass('has-bets')) {
                const $editBets = $('div.edit-bets a:textEquals("Edit Bets")');
                if (elementIsVisible($editBets[0])) {
                    mouseChain({target: $editBets[0], events: ['click'], rejectOnPreventDefault: false})
                        .then(() => setTimeout(onSuccess('Edit bets was clicked!'), 2000))
                        .catch((e) => onReject('Error till click $editBets: ' + e));
                }
                let $removeAll = $('div.betslip-container-real a.remove-all-bets');
                let clickRemoveAll = function () {
                    if (elementIsVisible($removeAll[0])) {
                        mouseChain({target: $removeAll[0], events: ['click'], rejectOnPreventDefault: false})
                            .then(() => setTimeout(onSuccess('RemoveAll was clicked!'), 1000))
                            .catch((e) => onReject('Error till click RemoveAll: ' + e));
                    } else if (Date.now() - clickRemoveAllStarted < 8000) {
                        setTimeout(clickRemoveAll, 333);
                    } else {
                        onReject('RemoveAll not clicked for ' + (Date.now() - clickRemoveAllStarted) + 'ms');
                    }
                };
                if (elementIsVisible($removeAll[0])) {
                    clickRemoveAllStarted = Date.now();
                    clickRemoveAll();
                } else {
                    mouseChain({target: $button[0], events: ['click'], rejectOnPreventDefault: false})
                        .then(() => setTimeout(function () {
                            clickRemoveAllStarted = Date.now();
                            clickRemoveAll();
                        }, 1000))
                        .catch((e) => onReject('Error till open hidden coupon: ' + e));
                }
            } else {
                onSuccess('There is no open bets!');
            }
        });
    };

    const checkCoefs = async data => {
        const oddsSel = 'div.betslip-container-real div.odds-status span.odds';
        await waitForCondition(() => data.length === $(oddsSel).length, 300, 5000, 'Bad coupon');
        const $odds = $(oddsSel);
        dLog('green', 'BF', ['checkCoefs', {data: data, odds: $odds}]);
        console.log(data, $odds);
        const errors = [];
        let totalCoef = 1;
        let checked = 0;
        for (let i = 0; i < data.length; i++) {
            const localCoef = decOdds($(oddsSel).eq(i).trt());
            const checkCoef = parseFloat(data[i].coef);
            totalCoef = totalCoef * localCoef;
            if (!newAPI && data[i].coef !== '' && !isNaN(localCoef)) {
                console.log('%c' + `${localCoef}/${totalCoef}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                if (isNaN(checkCoef)) {
                    errors.push(match + ' wrong coef: ' + data[i].coef);
                } else if (checkCoef > localCoef) {
                    errors.push(match + ' LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef);
                } else if (localCoef >= checkCoef * 1.2) {
                    errors.push(match + ' TOO BIG coef, have: ' + localCoef + ', need: ' + checkCoef);
                }
                checked++;
            } else if (isNaN(localCoef)) {
                errors.push(match + ' LOW_COEF - wrong match or localCoef!');
                checked++;
            } else if (data[i].coef === '' || newAPI) {
                checked++;
            }
        }
        if (!newAPI && (errors.length > 0 || checked !== data.length)) {
            throw errors.join('; ') + (checked !== data.length ? ' some stakes not checked ('
                + checked + '/' + data.length + ')!' : '');
        } else if (newAPI && errors.length === 0 && checked === data.length) {
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
            console.log('%c' + `CHECK NEW API: we have: ${nCheck}, we need: ${totalCoef}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            if (totalCoef >= nCheck * 1.2) {
                throw'LOW_COEF - Coef TOO BIG: ' + totalCoef + ' instead of ' + data[0].coef;
            } else if (totalCoef < nCheck) {
                throw 'LOW_COEF ' + data[0].coef + ' > ' + totalCoef;
            }
        }
    };

    const collectData = inputData => new Promise(function (onSuccess, onReject) {
        dLog('green', 'BF', ['collectData', inputData]);
        let limit = 0;
        let data = inputData;
        if (data.length === 2 && data[0] === 'limit') {
            limit = parseInt(data[1]);
            data = [];
        }
        const report = function (success, message) {
            dLog('red', 'BF1', [`report ${success}`, message]);
            portPostMessage({
                answered: "BET_RESULT",
                status: success ? "success" : "error",
                answer: success ? Array.from(new Set(message)) : message
            });
            if (success) {
                onSuccess(Array.from(new Set(message)));
            } else {
                onReject(message);
            }
            bMess('BETFAIR_COMMAND', true)
                .remove()
                .then(() => {
                    let $link = $('#backButton');
                    if ($link.length === 1) {
                        mouseChain({target: $link[0], events: ['click']})
                            .then(() => dLog('green', 'BF', 'We must go to now page'))
                            .catch((e) => dLog('red', 'BF', 'Error till click Live link in BET_RESULT: ' + e));
                    }
                });
        };
        collectBetResultDo(limit, data)
            .then(collected => report(true, collected))
            .catch(error => report(false, error));
    });

    const collectDetails = betPanel => {
        let $panel = $(betPanel);
        let $status = $panel.find('div.media-icon div.bet__status');
        let status = 'ACCEPTED';
        if ($status.length === 1 && $status.hasClass('bet_lost')) {
            status = 'LOSE';
        } else if ($status.length === 1 && $status.hasClass('bet_won')) {
            status = 'WON';
        } else if ($status.length === 1 && $status.hasClass('bet_void')) {
            status = 'REFUNDED';
        } else if ($status.length > 0) {
            let tStatuses = {
                ACCEPTED: 0,
                LOSE: 0,
                WON: 0,
                REFUNDED: 0
            };
            $status.each(function () {
                let status = 'ACCEPTED';
                let $this = $(this);
                if ($this.hasClass('bet_lost')) {
                    status = 'LOSE';
                } else if ($this.hasClass('bet_won')) {
                    status = 'WON';
                } else if ($this.hasClass('bet_void')) {
                    status = 'REFUNDED';
                }
                tStatuses[status]++;
            });
            status = 'ACCEPTED';
            if ((tStatuses.ACCEPTED === 0 && tStatuses.LOSE > 0) || (tStatuses.REFUNDED > 0 && tStatuses.LOSE > 0)) {
                status = 'LOSE';
            } else if ((tStatuses.WON === $status.length) || (tStatuses.REFUNDED > 0 && tStatuses.WON > 0)) {
                status = 'WON';
            } else if (tStatuses.REFUNDED > 1) {
                status = 'REFUNDED';
            }
        }
        let res = {
            type: $panel.find('div.panel-title').first().trt().replace(/\s\s+/g, ' '),
            match: $panel.find('div.event__description:first-child').first().trt().replace(/\s\s+/g, ' '),
            //market: $panel.find('div.event__description span.market__name').trt().replace(/\s\s+/g, ' '),
            target: $panel.find('span.bet__title').first().trt().replace(/\s\s+/g, ' '),
            odd: $panel.find('span.bet__amount span').first().trt(),
            stake: $panel.find('span.stake--value').first().trt()
                .replace(',', document.location.href.indexOf('.es/') > -1 ? '.' : ',')
                .replace(/[^\d.]/g, ''),
            id: $panel.find('p.bet__id strong').first().trt(),
            status: status,
            returns: $panel.find('span.return--value').first().trt()
                .replace(',', document.location.href.indexOf('.es/') > -1 ? '.' : ',')
                .replace(/[^\d.]/g, ''),
        };
        if (res.status === 'WON' && parseFloat(res.returns) <= parseFloat(res.stake)) {
            res.status = parseFloat(res.returns) === parseFloat(res.stake) ? 'REFUNDED' : 'LOSE';
        }
        if ($panel.find('span.bet__amount span').length > 1) {
            let exOdd = 1;
            $panel.find('span.bet__amount span').each(function () {
                exOdd = exOdd * parseFloat($(this).trt());
            });
            exOdd = Math.round(exOdd * 100) / 100;
            res.odd = exOdd.toString();
        }
        return res;
    };

    const collectBetResultDo = async (limit, data) => {
        let collected = [];
        const every = ['myactivity.', '/sportsbook'];
        const some = ['.com', '.es', '.nl'];
        const checkHere = l => some.some(d => l.indexOf(d) > -1) && every.every(d => l.indexOf(d) > -1);
        if (!checkHere(document.location.href)) {
            let $myBets = $('a[title="My Bets"]');
            if ($myBets.length !== 1) {
                throw 'My Bets link not found! ' + $myBets.length;
            } else {
                await bMess('BETFAIR_COMMAND', true).set(ourCommand.get());
                await mouseChain({target: $myBets[0], events: ['click'], error: 'myBets'});
                dLog('green', 'BF', 'My Bets clicked - we must wait for new tab and close this!');
                await delayPromise(1000);
            }
        }
        let counter = 0, panelsCount = 0;
        const collectCurrent = async (openOrSettled, $buttonsDiv) => {
            dLog('green', 'BF', ['collectCurrent: ' + openOrSettled, $buttonsDiv]);
            const betPanelS = 'div.bet--panel';
            await waitForElement([betPanelS, 'span:contains("You currently have no")'],
                500, 10000);
            if ($('span:contains("You currently have no")').length > 0) {
                return true;
            }
            $(betPanelS).each(function () {
                const current = collectDetails(this);
                if (limit !== 0 && counter >= limit) {
                    return false;
                }
                if (data.length < 1 || data.indexOf(current.id) > -1) {
                    collected.push({
                        external_id: current.id,
                        status: current.status,
                        bkPivot: current.target,
                        coef: current.odd,
                        stake: current.stake,
                        result: current.returns,
                        match: current.match,
                    });
                    counter++;
                }
            });
            // We need check - maybe some stakes available in the bottom of page
            if ((data.length > 0 && data.length >= collected.length) || (limit !== 0 && counter >= limit)) {
                return true;
            }
            panelsCount = $(betPanelS).length;
            if (panelsCount > 100) {
                return true;
            } else {
                $(betPanelS).last()[0].scrollIntoView(true);
                await delayPromise(5000);
                if ($(betPanelS).length > panelsCount) {
                    await collectCurrent(openOrSettled, $buttonsDiv);
                } else {
                    return true;
                }
            }
        };
        const $buttonsDiv = await waitForElement('div.left--side__cell', 333, 10000);
        await delayPromise(1000);
        if ($buttonsDiv.length !== 1) {
            throw 'Wrong $buttonsDiv ' + $buttonsDiv.length;
        }
        const $btns = {
            'open': () => $buttonsDiv.find('button:contains("Open")'),
            'settled': () => $buttonsDiv.find('button:contains("Settled")'),
        }
        for (const i of ['open', 'settled']) {
            await waitForCondition(() => $btns[i]().length > 0,
                333, 20000, `No ${i} button!`);
            if (!$btns[i]().hasClass('btn-active')) {
                await mouseChain({target: $btns[i]()[0], events: ['click'], error: `${i} - 1`});
                await delayPromise(1000);
            }
            await collectCurrent(i, $buttonsDiv);
        }
        return collected;
    };

    /**
     * Opens coupon with stake (stakes)
     * @param {object[]} paramData - array of bets to open
     * @returns {Promise<string>}
     */
    const openCoupon = async paramData => {
        let lData = paramData.slice();
        for (let i = 0; i < lData.length; i++) {
            const data = lData[i];
            await openEvent(data);
            dLog('green', 'BF', 'Event and "all markets" must be opened!');
            const $element = await getBetElement(data);
            dLog('green', 'BF', ['We got element!', $element]);
            await mouseChain({target: $element[0], events: fullClick, error: 'OE El'});
            await delayPromise(2000);
            if (i === lData.length - 1) {
                const $stakes = () => $('div.betslip-container-real div.bet-stakes input.stake');
                await waitForCondition(() => (paramData.length === 1 && $stakes().length > 0)
                        || (paramData.length > 1 && $stakes().length > paramData.length),
                    300, 5000, 'GM stakes not found :('
                );
                return $stakes().last().parent().parent().find('input.max-stake[type="hidden"]').val();
            }
        }
    };

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<any>} jQuery element for bet
     */
    const getBetElement = data => new Promise(function (onSuccess, onReject) {
        //#-#-START
        const hSel = 'td.home-runner', aSel = 'td.away-runner';
        data.team1 = $(hSel).trt();
        data.team2 = $(aSel).trt();
        if (['1', '2'].some(n => data[`team${n}`].indexOf(' v ') > -1)) {
            const all = ($(hSel).trt() + ' ' + $(aSel).trt()).split(' v ');
            data.team1 = all[0].trim();
            data.team2 = all[1].trim();
        }

        let markets = {
            'ONE_TWO': {
                'ONE': {
                    root: ['Match Odds', 'Match Odds Unmanaged', 'Match Results Markets'],
                    subroots: [],
                    pivotKeys: [0, 1]
                },
                'TWO': {
                    root: ['Match Odds', 'Match Odds Unmanaged', 'Match Results Markets'],
                    subroots: [],
                    pivotKeys: [2, 3]
                },
                'DRAW': {
                    root: ['Match Odds', 'Match Odds Unmanaged', 'Match Results Markets'],
                    subroots: [],
                    pivotKeys: [1, 2]
                },
                'ONE_DRAW': {
                    root: ['Double Chance', 'Double Chance Markets'],
                    subroots: ['#TEAM1# And Draw', '90 Minute Double Chance'],
                    pivotKeys: [0, 1]
                },
                'TWO_DRAW': {
                    root: ['Double Chance', 'Double Chance Markets'],
                    subroots: ['#TEAM2# And Draw', '90 Minute Double Chance'],
                    pivotKeys: [1, 2]
                },
                'ONE_TWO': {
                    root: ['Double Chance', 'Double Chance Markets'],
                    subroots: ['#TEAM1# And #TEAM2#', '90 Minute Double Chance'],
                    pivotKeys: [2, 3]
                }
            },
            'TOTAL': {
                'OVER': {
                    root: ['Over/Under', 'Over/Under #PIVOT# Goals'],
                    subroots: ['Over'],
                    pivotKey: ['runner-index-0']
                },
                'UNDER': {
                    root: ['Over/Under', 'Over/Under #PIVOT# Goals'],
                    subroots: ['Under'],
                    pivotKey: ['runner-index-1']
                },
            },
            'T1_TOTAL': {
                'OVER': {root: ['Home Team Over/Under'], subroots: ['Over'], pivotKey: ['runner-index-0']},
                'UNDER': {root: ['Home Team Over/Under'], subroots: ['Under'], pivotKey: ['runner-index-1']}
            },
            'T2_TOTAL': {
                'OVER': {root: ['Away Team Over/Under'], subroots: ['Over'], pivotKey: ['runner-index-0']},
                'UNDER': {root: ['Away Team Over/Under'], subroots: ['Under'], pivotKey: ['runner-index-1']}
            },
            'HDP': {
                'HOME': {root: ['Draw no Bet'], subroots: ['#TEAM1#'], pivotKey: ['runner-index-0']},
                'AWAY': {root: ['Draw no Bet'], subroots: ['#TEAM2#'], pivotKey: ['runner-index-1']}
            },
            'EURO_HDP': {
                'H1': {root: ['Handicap Match Result'], subroots: [''], pivotKey: [0]},
                'H2': {root: ['Handicap Match Result'], subroots: [''], pivotKey: [2]},
                'HX': {root: ['Handicap Match Result'], subroots: [''], pivotKey: [1]}
            },
            'CORNER_TOTAL': {
                'OVER': {
                    root: ['Total Corners #PIVOT#', 'Corners Over/Under #PIVOT#'],
                    subroots: ['Over'],
                    pivotKey: ['runner-index-0']
                },
                'UNDER': {
                    root: ['Total Corners #PIVOT#', 'Corners Over/Under #PIVOT#'],
                    subroots: ['Under'],
                    pivotKey: ['runner-index-1']
                }
            },
            half: {
                'ONE_TWO': {
                    'ONE': {root: ['Half Result Markets'], subroots: ['#TEAM1#'], pivotKeys: [0, 1]},
                    'TWO': {root: ['Half Result Markets'], subroots: ['#TEAM2#'], pivotKeys: [2, 1]},
                    'DRAW': {root: ['Half Result Markets'], subroots: ['Draw'], pivotKeys: [1, 1]},
                    'ONE_DRAW': {
                        root: ['Double Chance Markets'],
                        subroots: ['First Half Double Chance'],
                        pivotKeys: [1, 1]
                    },
                    'TWO_DRAW': {
                        root: ['Double Chance Markets'],
                        subroots: ['First Half Double Chance'],
                        pivotKeys: [2, 2]
                    },
                    'ONE_TWO': {
                        root: ['Double Chance Markets'],
                        subroots: ['First Half Double Chance'],
                        pivotKeys: [3, 3]
                    }
                },
                'TOTAL': {
                    'OVER': {
                        root: ['Over/Under First Half', 'Over/Under First Half #PIVOT#'],
                        subroots: ['Over'],
                        pivotKey: ['runner-index-0']
                    },
                    'UNDER': {
                        root: ['Over/Under First Half', 'Over/Under First Half #PIVOT#'],
                        subroots: ['Under'],
                        pivotKey: ['runner-index-1']
                    },
                },
                'T1_TOTAL': {
                    'OVER': {
                        root: ['Home Team Over/Under First Half'],
                        subroots: ['Over'],
                        pivotKey: ['runner-index-0']
                    },
                    'UNDER': {
                        root: ['Home Team Over/Under First Half'],
                        subroots: ['Under'],
                        pivotKey: ['runner-index-1']
                    }
                },
                'T2_TOTAL': {
                    'OVER': {
                        root: ['Away Team Over/Under First Half'],
                        subroots: ['Over'],
                        pivotKey: ['runner-index-0']
                    },
                    'UNDER': {
                        root: ['Away Team Over/Under First Half'],
                        subroots: ['Under'],
                        pivotKey: ['runner-index-1']
                    }
                },
                'EURO_HDP': {
                    'H1': {root: ['Handicap First Half'], subroots: [''], pivotKey: [0]},
                    'H2': {root: ['Handicap First Half'], subroots: [''], pivotKey: [2]},
                    'HX': {root: ['Handicap First Half'], subroots: [''], pivotKey: [1]}
                }
            }
        };

        if (data.time_value === 'HALF_TIME') {
            markets = markets.half;
        }

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            onReject('Unsupported ' + data.time_value + '/' + data.market + '/' + data.target);
            return;
        }

        if (data.sport === 'FOOTBALL' && data.market === 'HDP' && parseFloat(data.pivot) !== 0) {
            onReject('Betfair supports only HDP 0!');
            return;
        }

        let replaceInner = function (element, parent, index) {
            if (typeof element === 'string') {
                parent[index] = element
                    .replace('#TEAM1#', data.team1)
                    .replace('#TEAM2#', data.team2)
                    .replace('#PIVOT#', data.pivot)
                    .replace('#PIVOT2#', '-' + data.pivot);
            } else if (typeof element === 'object') {
                for (let i in element) {
                    replaceInner(element[i], element, i);
                }
            } else {
                // console.log(typeof element + ' not supported! (' + element + ')');
            }
        };

        const params = new AllMarkets(data);
        params.proceed_tennis = function (data) {
            if (data.market === 'ONE_TWO') {
                if (data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') > -1) {
                    const parts = data.time_value.split('_GAME_');
                    this.addRepl('root', 'Match Odds',
                        `Set ${parts[0].replace(/[^\d]/g, '').trim()} Game ${parts[1].trim()} Winner`);
                } else if (data.time_value.indexOf('SET') > -1) {
                    this.addRepl('root', 'Match Odds', `Set ${this.tDigit} Winner`);
                }
                this.addTotal('pivotKeys', data.target === 'ONE' ? [0] : data.target === 'TWO' ? [1] : []);
            } else if (data.market === 'TOTAL' && data.time_value.indexOf('SET') > -1) {
                this.addRepl('root', 'Over/Under', `Set ${this.tDigit} Total Games Over/Under #PIVOT#`);
            } else if (data.market === 'T1_TOTAL') {
                this.addRepl('root', 'Home Team Over/Under', `Player A Total Games #PIVOT#`);
            } else if (data.market === 'T2_TOTAL') {
                this.addRepl('root', 'Away Team Over/Under', `Player B Total Games #PIVOT#`);
            } else if (data.market === 'HDP') {
                if (data.time_value.indexOf('SET') > -1) {
                    this.addTotal('root', [`Set ${this.tDigit} Game Handicap #PIVOT#`, `Set ${this.tDigit} Game Handicap #PIVOT2#`]);
                } else {
                    this.addTotal('root', [`Game Handicap #PIVOT#`, `Game Handicap #PIVOT2#`]);
                }
                this.addTotal('pivotKey', data.target === 'HOME' ? [0] : [1]);
            }
        };
        params.proceed_tabletennis = function (data) {
            const numerals = ['st', 'nd', 'rd', 'th'];
            if (data.market === 'ONE_TWO') {
                this.addTotal('pivotKeys', data.target === 'ONE' ? [0] : data.target === 'TWO' ? [1] : []);
            } else if (data.market === 'HDP') {
                if (data.time_value.indexOf('SET') > -1) {
                    const r = [];
                    for (const n of numerals) {
                        r.push(`${this.tDigit}${n} Game Point Handicap`);
                    }
                    this.addTotal('root', r);
                } else {
                    this.addTotal('root', [`Point Handicap`,]);
                }
                this.addTotal('pivotKey', data.target === 'HOME' ? [0] : [1]);
            } else if (data.market === 'TOTAL') {
                if (data.time_value.indexOf('SET') > -1) {
                    const r = [];
                    for (const n of numerals) {
                        r.push(`${this.tDigit}${n} Game Total Points`);
                    }
                    this.addTotal('root', r);
                } else {
                    this.addTotal('root', [`Total points`,]);
                }
            }
        };
        params.proceed_hockey = function (data) {
            if (data.market === 'ONE_TWO') {
                if (['ONE', 'TWO'].indexOf(data.target) > -1) {
                    this.addTo('root', 'Moneyline');
                    this.addTotal('pivotKeys', data.target === 'ONE' ? [0] : data.target === 'TWO' ? [1] : []);
                } else {
                    this.addTo('root', 'Double Chance');
                }
            }
            if (data.market === 'HDP') {
                this.addTo('root', 'Handicap');
                this.addTotal('pivotKey', data.target === 'HOME' ? [0] : [1]);
            } else if (data.market === 'TOTAL') {
                if (data.time_value.indexOf('PERIOD') > -1) {

                } else {
                    this.addTo('root', 'Regular Time Goals');
                }
            }
        };
        params.proceed_cybersport = function (data) {
            if (data.market === 'ONE_TWO') {
                if (data.time_value.indexOf('MAP') > -1) {
                    this.addTo('root', `Map ${this.tDigit} Winner`);
                }
                this.addTotal('pivotKeys', data.target === 'ONE' ? [0] : data.target === 'TWO' ? [1] : []);
            } else if (data.market === 'HDP') {
                this.addTo('root', 'Map Handicap');
                this.addTotal('pivotKey', data.target === 'HOME' ? [0] : [1]);
            } else if (data.market === 'TOTAL') {
                this.addTo('root', 'Total Maps');
            }
        };

        marketsModifierAll(data, ['root', 'subroots', 'pivotKeys', 'pivotKey'], params, markets);

        replaceInner(markets, null, null);

        const market = markets[data.market][data.target];

        console.log('%c' + 'Final market is:', 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        console.log(market);

        let forOneTwo = function ($stakes) {
            let way = 0;
            let $subroots = {};
            if ($stakes.find('div.markets-header').length === 1) {
                way = 1;
                $subroots = $stakes.find('li.yesnomarkets-market').filter(function () {
                    console.log($(this).find('span.market-name').trt());
                    return market.subroots.indexOf($(this).find('span.market-name').trt()) > -1;
                });
                if ($subroots.length < 1 && ['ONE', 'TWO', 'DRAW'].indexOf(data.target) > -1) {
                    $subroots = $stakes.find('li[title="Match Odds"]');
                }
            } else {
                way = 0;
                $subroots = $stakes.find('li.runner-item').filter(function () {
                    console.log($(this).find('span.runner-name').trt());
                    return market.subroots.indexOf($(this).find('span.runner-name').trt()) > -1;
                });
                if ($subroots.length < 1 && data.time_value === 'HALF_TIME') {
                    $subroots = $stakes.find('ul.runner-list').first();
                }
            }
            console.log('%cWAY WE GOT: ' + way, 'color: green; font-weight: bold;');
            console.log($subroots);
            if (way === 0) {
                if (market.pivotKeys[way] === '' && $subroots.length === 1) {
                    let $element = $($subroots[0]).find('a');
                    if ($element.length === 1) {
                        onSuccess($element);
                    } else {
                        console.log($element);
                        onReject('Wrong length of element 1 (way ' + way + '): ' + $element.length);
                    }
                } else if (typeof market.pivotKeys[way] === 'number') {
                    let $element = {};
                    if ($subroots.length === 0) {
                        $subroots = $stakes.find('li.runner-item');
                        console.log($subroots);
                        $element = typeof $subroots[market.pivotKeys[way]] !== 'undefined'
                            ? $($subroots[market.pivotKeys[way]]).find('a') : {};
                    } else {
                        $element = $($subroots[0]).find('li.runner-index-' + market.pivotKeys[way] + ' a');
                        if ($element.length === 0) {
                            $element = $($subroots[0]).find('a');
                        }
                    }
                    if ($element.length === 1) {
                        onSuccess($element);
                    } else {
                        console.log($element);
                        onReject('Wrong length of element 3 (way ' + way + '): ' + $element.length);
                    }
                } else {
                    onReject('Wrong number of subroots (' + $subroots.length + ') for pivot "' + market.pivotKeys[way] + '"!');
                }
            } else if (way === 1) {
                if (typeof market.pivotKeys[way] === 'number' && $subroots.length === 1) {
                    let $element = $($($subroots[0])).find('li.runner.runner-index-' + market.pivotKeys[way] + ' a');
                    if ($element.length === 1) {
                        onSuccess($element);
                    } else {
                        console.log($element);
                        onReject('Wrong length of element 4 (way ' + way + '): ' + $element.length);
                    }
                } else {
                    onReject('Wrong subroots defs (' + $subroots.length + ') for pivot "' + market.pivotKeys[way] + '"!');
                }
            }
        };

        let forTotals = function ($stakes) {
            let pivot = parseFloat(data.pivot);
            if (isNaN(pivot)) {
                onReject('"' + data.pivot + '" = ' + pivot);
                return;
            }
            // Zero way
            let $tLink = $([]);
            ['', ' Goals'].some(g => {
                $tLink = $stakes.find(`li.runner-item span.runner-name:contains("${market.subroots[0]} ${data.pivot}${g}")`);
                return $tLink.length > 0;
            });
            if ($tLink.length === 0) {
                $tLink = $stakes.find(`li.runner-item span.runner-name:contains("${market.subroots[0]} (${data.pivot})")`);
            }
            if ($tLink.length === 0) {
                $tLink = $stakes.find(`li.runner-item`)
                    .find(`span.runner-name:contains("${market.subroots[0]}")`);
                let found = false;
                if ($tLink.length > 0) {
                    $tLink.each(function () {
                        const $this = $(this);
                        if ($this.find('span.ui-runner-handicap').length > 0
                            && pivot === parseFloat($this.find('span.ui-runner-handicap').trt())) {
                            $tLink = $this.find('span.runner-name');
                            found = true;
                            return false;
                        } else {
                            console.log('%c' + $this.find('span.ui-runner-handicap').trt(), 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                        }
                    });
                }
                if (!found) {
                    $tLink = $([]);
                }
            }
            if ($tLink.length === 1) {
                let $link = $tLink.parent().find('a');
                if ($link.length === 1) {
                    onSuccess($link);
                } else {
                    onReject('Error till find a in Zero way: ' + $link.length);
                }
            } else {
                let pivotsCol = -1;
                let $colHeads = $stakes.find('div.market-list-header span.market-name');
                console.log($colHeads);
                $colHeads.each(function (idx, val) {
                    let check = parseFloat($(val).trt().replace(/[^\d.\-+]/g, '').trim());
                    console.log('"' + check + '" === "' + pivot + '"');
                    if (check === pivot) {
                        pivotsCol = idx;
                        return false;
                    }
                });
                if (pivotsCol === -1) {
                    onReject('Pivot ' + pivot + ' not found :(');
                    return;
                }
                let $containers = $stakes.find('div.market-list-container div.market-container');
                if (typeof $containers[pivotsCol] !== 'undefined') {
                    let $element = $($containers[pivotsCol]).find('li.' + market.pivotKey[0] + ' a');
                    if ($element.length === 1 && $element.trt().length !== 0) {
                        onSuccess($element);
                    } else {
                        onReject('No element on final point! ' + $element.length);
                    }
                } else {
                    onReject('pivotsCol exists, but no betElement!');
                }
            }
        };

        let forHandicaps = function ($stakes) {
            let pivot = parseFloat(data.pivot);
            if (isNaN(pivot)) {
                onReject('"' + data.pivot + '" = ' + pivot);
                return;
            }
            let $carousel = $stakes.find('div.com-carousel.handicap-carousel');
            if ($carousel.length === 1) {
                let pivotsCol = -1;
                let $colHeads = $carousel.find('div.carousel-header-label span');
                console.log($colHeads);
                $.each($colHeads, function (idx, val) {
                    let check = parseFloat($(val).trt().replace(/[^\d.\-+]/g, '').trim());
                    console.log('"' + check + '" === "' + pivot + '"');
                    if (check === pivot) {
                        pivotsCol = idx;
                        return false;
                    }
                });
                if (pivotsCol === -1) {
                    onReject('Pivot ' + pivot + ' not found :(');
                    return;
                }
                mouseChain({target: $colHeads[pivotsCol], events: ['click'], rejectOnPreventDefault: false})
                    .then(() => {
                        waitForCondition(() => {
                            return $($colHeads[pivotsCol]).parent().parent().hasClass('selected');
                        }, 333, 5000)
                            .then(() => {
                                let $rows = $($colHeads[pivotsCol]).parent().parent().find('span.runner');
                                console.log($rows);
                                if (typeof $rows[market.pivotKey[0]] !== 'undefined') {
                                    onSuccess($($rows[market.pivotKey[0]]).find('a'));
                                } else {
                                    onReject('Wrong HDP element in column!');
                                }
                            });
                    })
                    .catch((e) => onReject('Error till click HDP col: ' + e));
            } else {
                let $ri = $stakes.find('li.runner-item');
                if ($ri.length === (data.market === 'HDP' ? 2 : 3)) {
                    if (typeof $ri[market.pivotKey[0]] !== 'undefined') {
                        let $hdpLi = $($ri[market.pivotKey[0]]);
                        let cPivot;
                        if ($hdpLi.find('span.ui-runner-handicap').length > -1
                            && $hdpLi.find('span.ui-runner-handicap').trt() !== '') {
                            console.log('%c' + `LOOK 1: '${$hdpLi.find('span.ui-runner-handicap').trt()}'`,
                                'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                            cPivot = parseFloat($hdpLi.find('span.ui-runner-handicap').trt().replace(/[^\d.\-+]/g, '').trim());
                        } else {
                            console.log('%c' + `LOOK 2: '${$hdpLi.trt()}'`,
                                'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                            const r = /\((.*?)\)/.exec($hdpLi.trt());
                            if (r && r[1]) {
                                cPivot = parseFloat(r[1].trim());
                            }
                        }
                        if (!isNaN(cPivot) && cPivot === pivot) {
                            onSuccess($hdpLi.find('a'));
                        } else {
                            onReject('Pivot not match! We have ' + cPivot + ', we need ' + pivot);
                        }
                    } else {
                        onReject('Wrong HDP ri element!');
                    }
                } else {
                    onReject('Wrong ri length: ' + $ri.length);
                }
            }
        };

        let forCornerTotals = function ($stakes) {
            let $li = $stakes.find('li.runner-item').filter(function () {
                if (data.target === 'OVER') {
                    return $(this).find('span.runner-name[title="Over ' + data.pivot + ' Corners"]').length === 1;
                } else {
                    return $(this).find('span.runner-name[title="Under ' + data.pivot + ' Corners"]').length === 1;
                }
            });
            if ($li.length === 1) {
                let $element = $li.find('a');
                if ($element.length === 1 && $element.trt().length > 0) {
                    onSuccess($element);
                } else {
                    onReject('Wrong amount of CORNERS elements: ' + $element.length);
                }
            } else {
                onReject('Bad amount of lis 1: ' + $li.length);
            }
        };

        let forDrawNoBet = function ($stakes) {
            let $li = $stakes.find('li.runner-item').filter(function () {
                let text = $(this).find('span.runner-name').trt().toLowerCase();
                //console.log(text, market.subroots[0].toLowerCase());
                return text === market.subroots[0].toLowerCase() ||
                    locutus_similar_text(text, market.subroots[0].toLowerCase(), true) > 80;
            });
            if ($li.length === 1) {
                let $element = $li.find('a');
                if ($element.length === 1) {
                    onSuccess($element);
                } else {
                    onReject('Wrong amount of HDP elements: ' + $element.length);
                }
            } else {
                onReject('Bad amount of lis 2: ' + $li.length);
            }
        };

        let performGet = function () {
            let rootProcess = function () {
                let currentRoot = 0;
                let checkRoot = function () {
                    console.log('checkRoot', rootCandidates[currentRoot]);
                    let $root = $(rootCandidates[currentRoot]);
                    let $stakes = $root.parent().next();
                    if ($stakes.length !== 1) {
                        $stakes = $root.next();
                    }
                    if ($stakes.length !== 1) {
                        currentRoot++;
                        rootOuterFunction();
                    } else {
                        console.log($stakes);
                        if (data.market === 'ONE_TWO') {
                            forOneTwo($stakes);
                        } else if (data.market === 'CORNER_TOTAL') {
                            forCornerTotals($stakes);
                        } else if (data.market.indexOf('TOTAL') > -1) {
                            forTotals($stakes);
                        } else if (data.market === 'EURO_HDP' || (data.market === 'HDP' && data.sport !== 'FOOTBALL')) {
                            forHandicaps($stakes);
                        } else if (data.market === 'HDP') {
                            forDrawNoBet($stakes);
                        }
                    }
                };
                let rootOuterFunction = function () {
                    if (currentRoot >= rootCandidates.length) {
                        onReject('No roots / subroots were found!');
                        return;
                    }
                    rootCandidates[currentRoot].scrollIntoView(true);
                    let $cRoot = $(rootCandidates[currentRoot]);
                    if ($cRoot.find('div.ui-expandable.com-expandable-header-anchor').hasClass('ui-expandable-selected')) {
                        checkRoot();
                    } else {
                        let $arrow = $cRoot.find('span.arrow');
                        if ($arrow.length === 1) {
                            mouseChain({target: $arrow[0], events: ['click'], rejectOnPreventDefault: false})
                                .then(() => setTimeout(checkRoot, 1000))
                                .catch((e) => {
                                    dLog('red', 'BF', ['Arrow for root click error: ' + e, $cRoot.html()]);
                                    currentRoot++;
                                    rootOuterFunction();
                                });
                        } else {
                            dLog('red', 'BF', ['Arrow for root not found!', $cRoot.html()]);
                            currentRoot++;
                            rootOuterFunction();
                        }
                    }
                };
                rootOuterFunction();
            };
            let check = {};
            let rootCandidates = $('div.com-expandable-header').filter(function () {
                let $stakes = $(this).parent().next();
                if ($stakes.length !== 1) {
                    $stakes = $(this).next();
                }
                check[$(this).find('span.title').trt()] = {
                    element: $stakes,
                    class: $stakes.attr('class')
                };
                return market.root.some(r => r.toLowerCase() === $(this).find('span.title').trt().toLowerCase());
            });
            console.log('candidates:');
            console.log(rootCandidates);
            console.log(check);
            if (rootCandidates.length > 0) {
                rootProcess();
            } else {
                onReject('Root candidates not found!');
            }
        };

        (async () => {
            const
                sel = data.market === 'CORNER_TOTAL'
                    ? ['a:textEquals("Corners & Cards")', 'a:textEquals("Cards & Corners")']
                    : ['a:textEquals("All Markets")', 'a:textEquals("All")'],
                $all = await waitForElement(sel, 333, 3000);
            if ($all.hasClass('ui-selected') === false) {
                await mouseChain({target: $all[0], events: fullClick, error: '$all'});
                await delayPromise(777);
            }
            await delayPromise(555);
        })()
            .then(() => performGet());
        //#-#-FINISH
    });

    const openEvent = async data => {
        const team1 = data.team1;
        const team2 = data.team2;
        const sport = sportAccordance[data.sport];
        if (!sport) {
            throw `'${data.sport}' not supported`;
        }
        const checkWeAreThere = () => {
            let firstTeam = $('td.home-runner').trt();
            let secondTeam = $('td.away-runner').trt();
            return firstTeam === team1 && secondTeam === team2
                || locutus_similar_text(firstTeam + ' - ' + secondTeam, team1 + ' - ' + team2, true) > 60;
        };
        if (!checkWeAreThere()) {
            const $ip = await waitForElement('a.ui-top[href="/sport/inplay"]:contains("In-Play"):visible',
                333, 10000, false, 1, `Inplay (${(window.self === window.top)})`);
            await mouseChain({
                target: $ip[0],
                events: fullClick,
                error: `Go to inplay (${(window.self === window.top)})`
            });
            await delayPromise(1000);
        }
        if (!checkWeAreThere()) {
            const $sportSel = await waitForElement(
                () => $(`button.ip-button`)
                    .find(`span.ip-sport-name:textEquals("${sport}")`),
                333, 5555, true);

            if ($sportSel.length === 0 || $sportSel.hasClass('disabled')) {
                throw `There is no ${sport} or it's disabled!`;
            } else if (!$sportSel.hasClass('active')) {
                await mouseChain({
                    target: $($sportSel)[0], events: fullClick,
                    error: 'sportSel'
                });
                await delayPromise(1000);
            }
            const $link = () => $('a.event-team-container').filter(function () {
                let dEvent = $(this).attr('data-event').trim();
                return dEvent === team1 + ' v ' + team2 || locutus_similar_text(dEvent, team1 + ' v ' + team2, true) > 60;
            });
            await waitForCondition(() => window.location.href.indexOf(settings.check) > -1 && $link().length > 0, 300, 15000,
                `Can't go to event :(`);
            await mouseChain({target: $link()[0], events: fullClick, error: 'Link click'});
            await delayPromise(1000);
        }
        const amSel = 'a[title="All Markets"]';
        const $allMarkets = () => $(amSel).length === 0 ? $('a[title="All"][data-gacategory="Interface"]') : $(amSel);
        await waitForCondition(() => checkWeAreThere(), 300, 30000,
            'We are not on event or no all markets');
        await delayPromise(1000);
        if ($allMarkets().length > 0 && !$allMarkets().hasClass('ui-selected')) {
            await mouseChain({target: $allMarkets()[0], events: fullClick, error: 'All markets'});
            await waitForCondition(() => $allMarkets().hasClass('ui-selected'), 300, 15000, 'All markets not clicked!');
        }
        return 'Event have to be opened!';
    };

    const getBalance = returnNull => {
        const $b = $('table.ssc-wldw td.ssc-wla').first();
        if ($b.length > 0) {
            return parseFloat($b.text().replace(',',
                document.location.href.indexOf('.es/') > -1 ? '.' : ''
            ).replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    };

    const authCheck = function () {
        let repeat = true;
        let limitedSent = false;
        let isDenied = async () => {
            let $denied = await waitForElement('p:contains("account is denied - this account has been closed")', 130, 3000)
                .catch(e => $([]));
            if ($denied.length > 0) {
                portPostMessage({
                    m: "authorized!",
                    balance: 'null',
                    limited: true
                });
                limitedSent = true
                dLog('orange', 'betfair', 'BK is LIMITED sent!');
                repeat = false;
            }
            return $denied.length > 0;
        }

        // if suspended - send LIMITED
        let isLimited = async () => {
            let $denied = await waitForElement('p:contains("Your account has been suspended.")', 130, 3000)
                .catch(e => $([]));
            if ($denied.length > 0) {
                if ($('button:textEquals("Continue")').length > 0) {
                    await mouseChain({
                        target: $('button:textEquals("Continue")')[0],
                        events: fullClick,
                        error: "click continue"
                    });
                    await delayPromise(1000);
                }
                limitedSent = true;
                dLog('orange', 'betfair', 'BK is LIMITED sent!');
                repeat = false;
            }
            return $denied.length > 0;
        }

        (async () => {
            if (!busy && bkHere === 'betfaires') {
                const wasReloaded = await bMess('BETFAIR_ES_RELOADED').check().catch(() => false);
                if (!wasReloaded) {
                    await bMess('BETFAIR_ES_RELOADED').set(Date.now());
                } else if (Date.now() - wasReloaded >= 2400000) {
                    await bMess('BETFAIR_ES_RELOADED').set(Date.now());
                    window.location.reload();
                }
            }
            await closeAllWeNeed({
                '#onetrust-accept-btn-handler': '#onetrust-accept-btn-handler',
            });
            if ($('li.error-message:contains("There was a technical error!")').length > 0) {
                //await mouseChain({
                //    target: $('a[data-gtml="betfair logo"]')[0], events: ['click'], error: "click logo"
                //});
                //await delayPromise(1555);
                //reload page instead
                location.reload();
            }
            let $username = $(findSel(['#ssc-liu:visible', '#username']));
            // Hint: Check we're in English
            let $exchange = $('#EXCHANGE');
            if (!limitedSent && !(await isDenied()) && !(await isLimited()) && $exchange.length > 0
                && $($exchange[0]).trt() !== "Exchange") {
                // Hint: Switch to english
                portPostMessage({m: "tech works! 1"});
                dLog('green', 'BF', 'We are in "' + $($exchange[0]).trt() + '", we need English UK');
                let $selector = $('span.ssc-aru').last();
                if ($selector.length === 1) {
                    await mouseChain({target: $selector[0], events: ['click'], error: "selector_0_"})
                    await delayPromise(1000);
                    let $lis = $selector.parent().next().find('ul li a');
                    if ($lis.length > 1) {
                        console.log($lis[0]);
                        await mouseChain({target: $lis[0], events: ['click'], error: 'lis_0_'});
                    } else {
                        dLog('red', 'BetFair', 'Lis length <= 1');
                    }
                }
            } else if (!limitedSent && !await isDenied() && !await isLimited() && $username.length > 0) {
                // Hint: Log In
                portPostMessage({m: "tech works! 2"});
                await tryToLogIn(settings, $username);
            } else if (!limitedSent && !await isDenied() && !await isLimited()) {
                let $mc = $('span.ssc-modal-close:visible');
                let $ac = $('a.ssc-privacyPolicyBannerButton:visible');
                let $nc = [];
                if ($mc.length > 0) {
                    $nc = $mc;
                } else if ($ac.length > 0) {
                    $nc = $ac;
                }
                if ($nc.length > 0) {
                    await mouseChain({target: $nc[0], events: ['click'], error: 'nc_0_'})
                        .catch(e => dLog('red', 'BetFair', `Click error: ${e}`));
                }
                portPostMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            } else {
                portPostMessage({m: "tech works!"});
            }
        })()
            .finally(() => {
                if (repeat) {
                    delayPromise(settings.authCheckInterval)
                        .then(() => authCheck());
                } else {
                    dLog('red', 'betfair', 'Auth repeat stopped!');
                }
            });
    };

    const tryToLogIn = async settings => {
        if (Date.now() - authClicked < 30000) {
            throw "Tried to login too soon: " + (Date.now() - authClicked);
        }
        const $els = {
            'login': $(findSel(['#ssc-liu:visible', '#username'])),
            'password': $(findSel(['#ssc-lipw:visible', '#password'])),
            'remember': $('#ssc-rmb:visible'),
            'submit': $(findSel(['#ssc-lis:visible', '#login'])),
        }
        if (!['login', 'password', 'submit'].every(ch => $els[ch].length > 0)) {
            throw `Some inputs doesn't exists!`;
        }
        authClicked = Date.now();
        for (const t of Object.keys($els)) {
            if ($els[t].length === 0 || (t === 'remember' && $els[t].is(':checked'))) {
                continue;
            }
            await mouseChain({target: $els[t][0], events: fullClick, error: `Click TL: ${t}`})
            await delayPromise(1000);
            if (['login', 'password'].indexOf(t) > -1 && $els[t].val() !== settings[t]) {
                await ($els[t].get(0).type === 'email' ? clearAndInputEmail : clearAndSimulate)
                ($els[t][0], settings[t], true);
            }
        }
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('green', 'BF', ['Command was set till unload:', ourCommand.get()]);
            bMess('BETFAIR_COMMAND', true).set(ourCommand.get());
        }
    }, true);

    function afterDOMLoaded() {
        portPostMessage({m: "PAGE LOADED!"});
        chrome.storage.local.get(['BETFAIR_COMMAND', 'BETFAIR_COMMAND_WAS_SET'], function (result) {
            dLog('green', 'BF', ['Saved command:', result]);
            if (typeof result.BETFAIR_COMMAND !== 'undefined' && typeof result.BETFAIR_COMMAND_WAS_SET !== 'undefined'
                && Date.now() - result.BETFAIR_COMMAND_WAS_SET < 40000) {
                let currentCommand = result.BETFAIR_COMMAND;
                console.log(currentCommand);
                chrome.storage.local.remove(['BETFAIR_COMMAND', 'BETFAIR_COMMAND_WAS_SET'], function () {
                    waitForCondition(() => {
                        return wasAuthCheck !== false;
                    }, 222, 10000, 'AuthCheck was not', false)
                        .then(() => dLog('green', 'BF', ['Restoring with: ', currentCommand]))
                        .then(() => messageProcessor(currentCommand))
                        .catch((e) => dLog('green', 'BF', 'Something wrong with auth check! ' + e));
                });
            } else {
                chrome.storage.local.remove(['BETFAIR_COMMAND', 'BETFAIR_COMMAND_WAS_SET']);
            }
        });
    }

})();
