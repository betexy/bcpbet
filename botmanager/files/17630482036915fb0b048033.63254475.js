(function () {
    "use strict";

    let authClicked = 0;
    let authClickedCount = 0;
    let busy = false;
    const bkHere = "mostbet";
    let port = chrome.runtime.connect({name: `port_${bkHere}`});
    let waitSource = false;
    let sourceExpress = false;
    let settings = {
        authCheckInterval: 2000,
        url: 'https://mostbet.com/live',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        stake_fork: {},
        eventTimeLimit: 2400000,
        eventMaxBets: 3,
        betweenBets: 25000,
        newExpresses: false,
        source: {
            X: 509,
            Y: 510,
            Z: 511,
        },
        sourceRandom: 0,
        sourceDate: 0,
    };

    let currentBetData = false;
    let newAPI = false;
    let enterError = false;

    let ourCommand = new ourCommandProto();
    const fullClick = ['mouseover', 'mousedown', 'click', 'mouseup'];
    const $coupons = () => $('div[class*="Bet_root_"]');
    const getSourceRandom = () => {
        return Math.floor(Math.random() * 30) + 1;
    };
    const getCurrentSource = src => {
        sourceExpress = false;

        if (src >= 1 && src <= 13) {
            return 'X';
        }
        if (src >= 14 && src <= 19) {
            return 'Y';
        }
        if (src >= 20 && src <= 21) {
            return 'Z';
        }

        return 'skip';
    }

    const messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;
        let $logLink = $('button.auto_login:textEquals("Log in")');
        if (message.action !== 'auth' && busy) {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY"
            });
        } else if (message.action === "auth") {
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 2400000;
            settings.betweenBets = message.betweenBets || 40000;
            settings.lastScoreBasketball = message?.stake_fork?.lastScoreBasketball || '';
            settings.newExpresses = !!(settings?.stake_fork && settings.stake_fork?.newExpresses);
            settings.newExpressBetsAmount = Number(message?.stake_fork?.newExpressBetsAmount) || 2
            if (settings.lastScoreBasketball === '999') {
                settings.sourceDate = Date.now();
                settings.sourceRandom = getSourceRandom();

                // if (settings.sourceRandom >= 17 && settings.sourceRandom <= 18) {
                //     settings.newExpresses = true;
                //     waitSource = true;
                //     if (settings.sourceRandom >= 17 && settings.sourceRandom <= 18) {
                //         settings.newExpressBetsAmount = 1;
                //     }
                // } else {
                //     waitSource = false;
                // }

                dLog('blue', 'MOSTBET', `Source current random value - ${settings.sourceRandom}`);
            }
            authCheck();
        } else if ($logLink.length !== 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (message.action === 'BET') {
            if (waitSource) {
                port.postMessage({
                    answered: message.action,
                    status: "error",
                    answer: "BUSY"
                });
            } else {
                busy = true;
                ourCommand.set(message);
                bsDebug(port, 'BET for: ' + message.data[0].market + '/' + message.data[0].target + '/' + message.data[0].pivot
                    + ', stake: ' + message.data[0].stake + ' on ' + message.data[0].coef + ', with ' + message.data[0].score);
                proceedBet(message.data);
            }
        } else if (message.action === 'EXPRESS_BET') {
            if (waitSource) {
                port.postMessage({
                    answered: message.action,
                    status: "error",
                    answer: "BUSY"
                });
            } else {
                busy = true;
                ourCommand.set(message);
                proceedBet(message.data);
                bsDebug(port, 'EXPRESS_BET', message);
            }
        } else if (message.action === 'BET_RESULT') {
            busy = true;
            ourCommand.set(message);
            let success = false;
            let error = '';
            let collected = [];
            collectBetResults(message.data)
                .then(c => (success = true, collected = c))
                .catch(e => error = e)
                .then(async () => {
                    port.postMessage({
                        answered: "BET_RESULT",
                        status: success ? "success" : "error",
                        answer: success ? collected : error
                    });
                    busy = false;
                    ourCommand.clear();
                    await mouseChain({target: $('a.auto_live')[0], events: ['click']});
                });
        }
    };

    /**
     * Go to history page
     * @returns {Promise<string>}
     */
    const goToHistory = async () => {
        const historyLabel = bkHere === 'mostbet' ? 'Betting history' : 'История ставок';
        const $menuButton = await waitForElement('button[class^=MenuTopBar_switchButton]', 333, 10000);
        await delayPromise(555);
        await mouseChain({target: $menuButton[0], events: fullClick, error: '$menuButton'});
        await delayPromise(555);
        const $betsHistory = await waitForElement(`div[class^="MenuLink_linkText"]:textEquals(${historyLabel})`, 333, 10000);
        await delayPromise(555);

        if (elementIsVisible($betsHistory[0])) {
            await mouseChain({target: $betsHistory[0], events: fullClick, error: '$betsHistory'});
            await delayPromise(555);
        } else {
            throw 'Bets history is not visible';
        }

        return 'Must be there!';
    };

    /**
     * Collecting bet results
     * @param inD
     * @returns {Promise<Array>}
     */
    const collectBetResults = async (inD) => {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 40 ? parseInt(inD[1]) : 40) : 40;
        const collectDetails = async ($rows) => {
            await $rows.eachAsync(async function (key) {
                if (++key > limit) return false;
                const external_id = $(this).find('p.auto_coupon_number').text().trim();
                let status = 'ACCEPTED';
                if (data.length === 0 || data.indexOf(external_id) > -1) {
                    if ($(this).find('button[class*="CouponTableRow_active_"]').length === 0) {
                        await mouseChain({
                            target: $(this).find('button.auto_coupon_expand')[0],
                            events: fullClick,
                            error: 'auto_coupon_expand'
                        });
                        await delayPromise(2000);
                    }
                    const statusVal = $(this).find('p.auto_coupon_status').text().trim();
                    if (bkHere === 'mostbet') {
                        if (statusVal === 'Win') {
                            status = 'WON';
                        } else if (statusVal === 'Loss') {
                            status = 'LOSE';
                        } else if (statusVal === 'Return') {
                            status = 'REFUNDED';
                        }
                    } else {
                        if (statusVal === 'Победа') {
                            status = 'WON';
                        } else if (statusVal === 'Проигрыш') {
                            status = 'LOSE';
                        }
                    }

                    const match = $(this).next().find('p.auto_bet_gamers_names').text().trim();
                    const bkPivot = $(this).next().find('td.auto_bet_market_bet').text().trim();
                    const coef = parseFloat($(this).find('p.auto_coupon_coefficient').text().trim().replace(',', '.').replace(/[^\d.]/g, ''));
                    const stake = parseFloat($(this).find('span.auto_coupon_summ').text().trim().replace(',', '.').replace(' ', ''));
                    const result = parseFloat($(this).find('span.auto_coupon_win_summ').text().trim().replace(',', '.').replace(' ', ''));

                    collected.push({
                        external_id: external_id,
                        status: status,
                        match: match,
                        bkPivot: bkPivot,
                        coef: isNaN(coef) || coef === -1 ? '' : coef.toString(),
                        stake: stake,
                        result: isNaN(result) || result === -1 ? '' : result
                    });
                }
            });
        };

        if (window.location.href.indexOf('/profile/history') === -1) {
            await goToHistory();
        }

        let $historyItems = await waitForElement('tr.auto_coupon_history_item', 333, 10000).catch(() => $([]));
        if ($historyItems.length === 0) {
            return collected;
        }

        for (let i = 0; i < 5; i++) {
            $historyItems = $('tr.auto_coupon_history_item');
            if ($historyItems.length < 39) {
                $historyItems[$historyItems.length - 1].scrollIntoView(true);
                await delayPromise(3888);
            } else {
                break;
            }
        }

        await collectDetails($historyItems);

        return collected;
    };

    /**
     * Perform Express new
     */
    const ProccedExpressNew = async () => {
        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));
        const footballLink = 'button[class*="FilterSrpots_item_"][title="Football"]';
        const $coefs = () => $('button.auto_center_line_coefficient:not([class*="OutcomeItem_disabled_"])');
        const currentBets = [];

        // go to football prematch
        await mouseChain({target: $('nav[class*="Navigation_nav_"] a[href="/pregame"]')[0], events: fullClick, error: 'sportBook'});
        await waitForElement(footballLink, 222, 9999, true);
        await mouseChain({target: $(footballLink)[0], events: fullClick, error: 'footballLink'});
        await waitForCondition(() => $coefs().length > 0,
            333, 15555, 'No coefs!');

        const findOption = coef => {
            return isNaN(coef) ? false : coef >= 1.01 && coef <= 1.21;
        };

        const getUniqueRandomNumber = (length) => {
            return Math.floor(Math.random() * length);
        }

        do {
            const randomCoef = getUniqueRandomNumber($coefs().length);
            const eventName = $coefs().eq(randomCoef)
                .closest('tr').find('div.auto_center_line_team > div')
                .toArray().map(el => $(el).trt()).join(' - ');

            if (currentBets.indexOf(eventName) > -1) {
                continue;
            }

            if (eventName.length < 5) {
                dLog('red', 'MOSTBET', `'${eventName}' is too short - ${eventName.length}`);
                continue;
            }

            if (used[eventName] >= 1) {
                dLog('big-yellow', 'MOSTBET', `${eventName} used ${used[eventName]} times!`);
                continue;
            }

            if (
                $coefs().eq(randomCoef)
                .is('[class*="OutcomeItem_selected_"]')
            ) {
                continue;
            }

            if (!findOption(parseFloat($coefs().eq(randomCoef).trt()))) {
                continue;
            }

            currentBets.push(eventName);
            await mouseChain({target: $coefs().eq(randomCoef)[0], events: ['click'], error: 'EVENT'});
            await delayPromise(2555);
        } while ($coupons().length < settings.newExpressBetsAmount);

        // check 2 events
        if ($coupons().length === settings.newExpressBetsAmount 
            && currentBets.length === settings.newExpressBetsAmount
        ) {
            dLog('green', 'MOSTBET', [`We get selected bets: '${currentBets}', now used:`, used]);
            bMess('WasSuccessExpressNew').set(true);
            await bMess('currentFirstBet').set(currentBets[0]);
            await delayPromise(333);

            if (settings.newExpressBetsAmount > 1) {
                await bMess('currentSecondBet').set(currentBets[1]);
                await delayPromise(333);
            }
        }

        if ($coupons().length !== settings.newExpressBetsAmount) {
            throw 'New express events not found or wrong quantity selected!';
        }

        await delayPromise(333);
    };

    /**
     * Perform bet
     * @param data
     */
    const proceedBet = function (data) {
        currentBetData = {
            data: data,
            max: 0
        };
        const betFinished = async function (success, message) {
            bsDebug(port, 'Bet finished ' + success, message);
            let status = 'ACCEPTED';
            if (!success) {
                const bad = ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED'].find(c => typeof message === 'string' && message.indexOf(c) > -1);
                status = bad || 'FAILED';
            }
            const resultData = {
                "external_id": success ? message.external_id : '',
                "status": status,
                "pivot": currentBetData.data[0].pivot,
                "coef": success ? message.coef : currentBetData.data[0].coef,
                "stake": success ? message.stake : currentBetData.data[0].stake,
                "maximum": currentBetData.max,
                "market": currentBetData.data[0].market,
                "target": currentBetData.data[0].target
            };

            if (success) {
                await eventsWorkAll('mostbet',
                    settings.eventMaxBets, settings.eventTimeLimit,
                    currentBetData.data, true, true);
                await bMess('WasSuccessStake').set(Date.now());
                await bMess('Stake Maximums').set(0);

                if (settings.newExpresses) {
                    // Hint: currentFirstBet MUST exists, otherwise some shit happened!
                    await bMess('WasSuccessExpressNew').set(false);
                    const currentFirstBet = await bMess('currentFirstBet').check(1080000, true);
                    const used = await bMess('usedEvents').check(1080000).catch(() => ({}));

                    if (!used[currentFirstBet]) {
                        used[currentFirstBet] = 1;
                    }

                    dLog('MOSTBET', 'blue-big',
                        [`We set bet with first: '${currentFirstBet}', now used:`, used]);

                    if (settings.newExpressBetsAmount > 1) {
                        const currentSecondBet = await bMess('currentSecondBet').check(1080000, true);
                        if (!used[currentSecondBet]) {
                            used[currentSecondBet] = 1;
                        }

                        dLog('MOSTBET', 'blue-big',
                        [`We set bet with second: '${currentSecondBet}', now used:`, used]);
                    }

                    await bMess('usedEvents').set(used);
                }
            }
            
            const doNotSend = !!currentBetData.data[0].betFromParser && !success
                    && resultData.status !== 'LIMITED';
            if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                resultData.type = 'VALUE';
                resultData.mode = currentBetData.data[0].type;
                resultData.bookmaker = 'MOSTBET';
                resultData.placedCoef = resultData.coef;
                resultData.coef = currentBetData.data[0].coef;
                resultData.source = '509' || 'oddscp';
                resultData.currency = currentBetData.data[0]?.currency || 'USD';
                resultData.externalId = resultData.external_id;
                resultData.sport = currentBetData.data[0].sport;
                resultData.timeValue = currentBetData.data[0].time_value;
                resultData.league = currentBetData.data[0].league;
                resultData.homeTeam = currentBetData.data[0].team1;
                resultData.awayTeam = currentBetData.data[0].team2;
                resultData.score = currentBetData.data[0].score;
                resultData.pivot = resultData.pivot || null;
            }

            const m = {
                    answered: !!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED'
                        ? "F_BET" : "BET",
                    data: resultData,
                    answer: success ? 'Everything is Okay!' : message,
                    doNotSend,
            };

            port.postMessage(m);
            bsDebug(port, `Result data (${success}): `, resultData);
            busy = false;
            ourCommand.clear();
        };
        let result = false;
        const report = function (success, message) {
            if (success) {
                betFinished(true, message);
            } else {
                betFinished(false, message);
            }
        };
        (async () => {
            const collectDetais = async () => {
                const $resultCoupon = await waitForElement('div[class*="CouponCreateModal_couponInfoWrp"]', 300, 20000, true, 1, 'No result coupon visible!');
                result = {
                    stake: $resultCoupon.find('p[class*="SuccessCouponInfoSummary_couponInfoSummaryItem_"]').eq(2).find('strong').trt(),
                    coef: $resultCoupon.find('p[class*="SuccessCouponInfoSummary_couponInfoSummaryItem_"]').eq(0).find('strong').trt(),
                    external_id: $resultCoupon.find('div[class*="SuccessCouponNumber_root_"]').trt().replace(/[^0-9]/g, '').trim(),
                };
                await delayPromise(888);
                await mouseChain({target: $resultCoupon.next()[0], events: fullClick, error: "continue coupon"});
            }
            const performExactBet = async willPlaceInput => {
                // Hint: Let's enter stake
                const $input = bkHere === 'mostbet' ? $('input.auto_amount') : $('input.auto_bet_summ_input');
                if ($input.length !== 1) {
                    throw '2 Wrong number of bet\'s inputs: ' + $input.length;
                }
                willPlaceInput = parseFloat(willPlaceInput.toString().replace('.00', '').trim());
                if (willPlaceInput > parseFloat(data[0].stake)) {
                    willPlaceInput = parseFloat(data[0].stake);
                }
                console.log('%cONE ' + willPlaceInput + ' on place: ' + $input.val(), 'background: yellow; font-weight: bold;');
                await clearAndSimulate($input[0], willPlaceInput.toString());
                await delayPromise(888);
                //check after enter stake
                if ($('p[class*="ExtendedCoupon_error_"]').length > 0) {
                    throw $('p[class*="ExtendedCoupon_error_"]').text().trim().replace('\n', '');
                }
                const $acceptBtn = $('button.auto_accept_bet');
                if ($acceptBtn.length > 0) {
                    if ($acceptBtn.is(':disabled')) {
                        throw 'Accept button is disabled!';
                    }
                } else {
                    throw 'Accept button is not exist!';
                }
                await mouseChain({target: $acceptBtn[0], events: fullClick, error: "$acceptBtn"});
                await delayPromise(888);
                await collectDetais();
            }
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
                const checkRes = await eventsWorkAll('mostbet',
                    settings.eventMaxBets, settings.eventTimeLimit,
                    currentBetData.data, false, true);
                if (checkRes !== 'OK') {
                    dLog('red', 'MOSTBET', `We got errors: ${checkRes}`);
                    throw checkRes;
                } else {
                    dLog('big-blue', 'MOSTBET',
                        `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                    for (const d of currentBetData.data) {
                        const eventName = `${d.team1} - ${d.team2}`;
                        dLog('blue', 'MOSTBET', `${settings.eventMaxBets} for ${eventName} not reached`);
                    }
                }
            }

            if (settings.lastScoreBasketball === '999') {
                const currentSource = getCurrentSource(settings.sourceRandom);
                data[0].source = Number(data[0].source);

                if (currentSource === 'X') {
                    if (settings.source['X'] !== data[0].source) {
                        throw `Source X ${settings.source['X']} is NOT equal ${data[0].source}!`;
                    }
                } else if (currentSource === 'Y') {
                    if (settings.source['Y'] !== data[0].source) {
                        throw `Source Y ${settings.source['Y']} is NOT equal ${data[0].source}!`;
                    }
                } else if (currentSource === 'XY') {
                    if (settings.source['X'] !== data[0].source 
                        && settings.source['Y'] !== data[0].source 
                    ) {
                        throw `Source XY is NOT equal ${data[0].source}!`;
                    }
                } else if (currentSource === 'Z') {
                    if (settings.source['Z'] !== data[0].source) {
                        throw `Source Z ${settings.source['Z']} is NOT equal ${data[0].source}!`;
                    }
                } else {
                    throw 'Source is out of range';
                }
            }

            await closePreviousCoupons(settings.newExpresses ? true : false);

            //if sourceExpress check coupon for events
            if (sourceExpress && settings.lastScoreBasketball === '999') {
                if ($coupons().length !== 1) {
                    throw 'Error Express source BET, No 1 event in coupon!';
                }
            }

            currentBetData.max = await openCoupon(data);
            if (settings.newExpresses && $coupons().length < settings.newExpressBetsAmount + 1) {
                throw `less than ${settings.newExpressBetsAmount + 1} events in the newExpresses`;
            }
            await checkCoefs(data);
            let willPlace = parseFloat(data[0].stake);
            if (willPlace > currentBetData.max) {
                willPlace = currentBetData.max;
            }
            const balanceEl = bkHere === 'mostbet' ? $('span.auto_user_balance:first') : $('div.auto_user_balance span:first');
            if (balanceEl.length === 0) {
                throw 'balance element is not found!';
            }
            const balance = parseFloat(balanceEl.text().trim().replace(',', '.').replace(/[^0-9\.]/g, '').trim());
            if (isNaN(balance)) {
                throw 'Get balance error';
            } else if (balance < willPlace) {
                throw'NO_FUNDS - now: ' + balance + ', we need: ' + willPlace;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                report(false, 'Undefined or NaN will place');
            } else {
                bsDebug(port, 'Will place (performBet): ' + willPlace + ', balance: ' + balance);
                await delayPromise(888);
                await performExactBet(willPlace);
                if (result) {
                    report(true, result);
                } else {
                    report(false, 'Bet placed, but collect error!');
                }
            }
        })()
            .catch(e => report(false, `proceedBet: ${e}`))
    };

    /**
     * Checks coefs into the coupon
     * @param data
     * @returns {Promise<string,string>}
     */
    const checkCoefs = async (data) => {
        await waitForCondition(() => $coupons().length > 0,
            333, 11111, 'No coupons!');
        const findInData = match => data.find(v => {
            const localMatch = v.team1.toLowerCase() + ' - ' + v.team2.toLowerCase();
            return localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 65;
        });

        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        const $couponsCoefs = (data.length === 1 && settings.newExpresses === true)
            ? $coupons().first()
            : $coupons();

        $couponsCoefs.each(function () {
            const $this = $(this);
            let match = $this.find('div[class*="Bet_matchTeam_"]');
            if (match.length !== 2) {
                errors.push(match + ' wrong coupon length!');
                return false;
            }
            match = match.eq(0).trt() + ' - ' + match.eq(1).trt();
            if ($this.find('div[class*="Bet_blockedBlock_"]').css("visibility") === 'visible') {
                errors.push(match + ' LOW_COEF - stake is blocked!');
                return false;
            }

            const localCoef = parseFloat($this.find('div.auto_coupon_coefficient').trt());
            const localData = findInData(match);

            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            console.log(`Coef here: '${localCoef}', we need: '${localData.coef}'`);
            if (!newAPI && localData && localData.coef !== '' && !isNaN(localCoef)) {
                let checkCoef = parseFloat(localData.coef);
                console.log(`${match} / ${localCoef} vs ${checkCoef}`);
                if (isNaN(checkCoef)) {
                    errors.push(match + ' wrong coef: ' + localData.coef);
                } else if (checkCoef > localCoef) {
                    errors.push(match + ' LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef);
                } else if (localCoef >= checkCoef * 1.5) {
                    errors.push(match + ' TOO BIG coef, have: ' + localCoef + ', need: ' + checkCoef);
                }
                checked++;
            } else if (!localData || isNaN(localCoef)) {
                errors.push(match + ' LOW_COEF - wrong match or localCoef!');
                checked++;
            } else if (localData.coef === '' || newAPI) {
                checked++;
            }
        });
        if (!newAPI && errors.length === 0 && checked === data.length) {
            console.log('%c' + 'checkCoupon => Coefs fine!', 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            return 'Coefs fine!';
        } else if (newAPI && errors.length === 0 && checked === data.length) {
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
            console.log('%c' + `CHECK NEW API: we have: ${totalCoef}, we need: ${nCheck}`,
                'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            if (totalCoef >= nCheck * 1.5) {
                throw 'Coef TOO BIG: ' + totalCoef + ' instead of ' + data[0].coef;
            } else if (totalCoef < nCheck) {
                throw 'LOW_COEF ' + data[0].coef + ' > ' + totalCoef;
            } else {
                return 'Coefs fine!';
            }
        } else {
            const error = errors.join('; ') + (checked !== data.length ? ' some stakes not checked ('
                + checked + '/' + data.length + ')!' : '');
            console.log('%c' + `checkCoupon => ${error}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            throw error;
        }
    };

    /**
     * Open event table, if we're on it already -  onSuccess
     * @param {object} data
     * @returns {Promise<any>}
     */
    const openEvent = async (data) => {
        bsDebug(port, 'openEvent', data);
        const team1 = data.team1.toLowerCase();
        const team2 = data.team2.toLowerCase();
        const lEvent = `${team1} - ${team2}`;
        const sportAccordance = {
            'FOOTBALL': ['Football', 'Футбол'],
            'TENNIS': ['Tennis', 'Теннис'],
            'TABLETENNIS': ['Table tennis', 'Настольный теннис'],
            'HOCKEY': ['Ice hockey', 'Хоккей'],
            'VOLLEYBALL': ['Volleyball', 'Волейбол'],
            'BASEBALL': ['Baseball', 'Бейсбол'],
            'BASKETBALL': ['Basketball', 'Баскетбол'],
            'HANDBALL': ['Handball', 'Гандбол']
        };

        const checkWeAreThere = async () => {
            const $teams = await waitForElement('div[class*="TeamInfo_root_"] h3', 300, 2222).catch(() => $([]));
            let cTeam1 = '', cTeam2 = '';
            if ($teams.length === 2) {
                cTeam1 = $teams.eq(0).text().trim().toLowerCase();
                cTeam2 = $teams.eq(1).text().trim().toLowerCase();
                console.log(cTeam1 + ' - ' + cTeam2);
                const rst = (cTeam1 === team1 && cTeam2 === team2) ||
                    (locutus_similar_text(cTeam1 + ' - ' + cTeam2, team1 + ' - ' + team2, true) > 70);
                return rst;
            } else {
                return false;
            }
        };
        const searchEvent = async (sport) => {
            dLog('green', `${bkHere}`, 'search event');
            let eventFind = $([]);
            const rowsStr = data.type === 'LIVE' ? 'td[class*="DefaultLine_liveLabel"]' : 'tr.auto_center_line_body';
            const searchInput = 'input[name="search"]';
            const $rows = () => $(rowsStr);
            
            if ($(searchInput).length === 0) {
                await mouseChain({target: $('a[href="/pregame"]')[0], events: fullClick});
            }

            await waitForElement(searchInput, 300, 5555);
            await clearAndSimulate($(searchInput)[0], lEvent, false, true, false);
            await delayPromise(2222);
            await waitForElement(rowsStr, 300, 8888, false, 1, 'No event rows!');
            
            await $rows().eachAsync(async function () {
                // check sport
                if ($(this)
                    .closest('tbody')
                    .children()
                    .first()
                    .find(`span[class*="LinesGroup_catButtonTitle_"]:textEquals("${sport}")`).length === 0
                ) {
                    return;
                }

                const $teams = $(this).find('div.auto_center_line_team div');

                if ($teams.length === 2) {
                    const hEvent = $teams.eq(0).trt().toLowerCase() + ' - '
                        + $teams.eq(1).trt().toLowerCase();
                    if ((hEvent === lEvent || locutus_similar_text(hEvent, lEvent, true) > 80)) {
                        eventFind = $(this);
                        return false;
                    } else {
                        console.log(`'${hEvent}' !== '${lEvent}'`);
                    }
                }
            });

            if (eventFind.length === 0) {
                throw 'Event not found!';
            }
            await delayPromise(1000);
            await mouseChain({target: eventFind.find('a.auto_center_line_team')[0], events: fullClick});
        };
        const switchType = async () => {
            if (data.type === 'LIVE') {
                await mouseChain({
                    target: $('a.auto_live:textEquals("Live")')[0],
                    events: fullClick,
                    error: 'Error redirect live'
                });
                await delayPromise(888);
            } else {
                await mouseChain({
                    target: $('a[href="/pregame"]')[0],
                    events: fullClick,
                    error: 'Error redirect Line'
                });
                await delayPromise(888);
            }
        };
        const switchSport = async () => {
            const $sportMenu = await waitForElement('nav.auto_leftMenu_allsports_list', 333, 7777);
            if (data.sport === 'CYBERSPORT') {
                const cyberLeague = data.league.split('.')[0].trim();
                if ($(`button[data-sport-title="${cyberLeague}"]`).is('[class*="SportItem_active_"]') === false) {
                    await mouseChain({
                        target: $sportMenu.find(`button[data-sport-title="${cyberLeague}"]`)[0],
                        events: fullClick,
                        error: '$cyberSportMenu'
                    });
                }
            } else {
                const $sportLineEl = $sportMenu.find(`button span:textEquals(${sport})`);
                if ($sportLineEl.length === 0) {
                    throw data.sport + ' is not active or is not exist';
                }
                if ($sportLineEl.closest('button[class*="SportItem_active_"]').length === 0) {
                    await mouseChain({
                        target: $sportLineEl[0],
                        events: fullClick,
                        error: '$sportMenu'
                    });
                    await delayPromise(2222);
                    if (data.league !== '') {
                        const leagueCountry = data.league.split('.');
                        const league = leagueCountry[0].trim();
                        if ($sportLineEl.closest(`button`).next().length > 0) {
                            if ($sportLineEl.closest(`button`).next().find(`span:textEquals(${league})`).length > 0) {
                                await mouseChain({
                                    target: $sportLineEl.closest(`button`).next().find(`span:textEquals("${league}")`)[0],
                                    events: fullClick,
                                    error: '$sportMenu league'
                                });
                            }
                        }
                    }
                }
            }
        };
        const findEvent = async () => {
            dLog('green', `${bkHere}`, 'find event');
            const rows = 'tr.auto_center_line_body';
            const $rows = () => $(rows);
            await waitForElement(rows, 300, 25000);
            let eventFind = $([]);
            for (let i = 0; i < 15; i++) {
                const fEvent = $rows().filter(function () {
                    const $teams = $(this).find('div.auto_center_line_team div');
                    if ($teams.length === 2) {
                        const hEvent = $teams.eq(0).trt().toLowerCase() + ' - '
                            + $teams.eq(1).trt().toLowerCase();
                        if ((hEvent === lEvent || locutus_similar_text(hEvent, lEvent, true) > 80)) {
                            return $(this);
                        } else {
                            console.log(`'${hEvent}' !== '${lEvent}'`);
                        }
                    }
                });
                if (fEvent.length === 0) {
                    $('tr.auto_center_line_body')[$('tr.auto_center_line_body').length - 1].scrollIntoView(true);
                    await delayPromise(3333);
                } else {
                    eventFind = fEvent;
                }
            }
            if (eventFind.length === 0) {
                throw 'Event not found!';
            }
            await delayPromise(1000);
            await mouseChain({target: eventFind.find('a.auto_center_line_team')[0], events: fullClick});
        };
        const sportIndx = bkHere === 'mostbet' ? 0 : 1;
        const sport = typeof sportAccordance[data.sport][sportIndx] !== 'string' ? '' : sportAccordance[data.sport][sportIndx];
        if (sport === '' && data.sport !== 'CYBERSPORT') {
            throw data.sport + ' not supported!';
        }
        if (await checkWeAreThere()) {
            dLog('green', `${bkHere}`, `We're on the event!`);
            await delayPromise(555);
        } else {
            if (data.type === 'LIVE') {
                await switchType();
                await switchSport();
                await findEvent();
            } else {
                await searchEvent(sport);
            }

            if (!await checkWeAreThere()) {
                throw 'we not on the event!';
            }
            await delayPromise(555);
        }
    };

    /**
     * Opens coupon with stake (stakes)
     * @param {object[]} paramData - array of bets to open
     * @returns {Promise<string, string>}
     */
    const openCoupon = async (paramData) => {
        let lData = paramData.slice();
        let data = {};
        let max = 111555777;
        const result = async (success, message) => {
            if (success) {
                if (lData.length > 0) {
                    ourCommand.add('express', ourCommand.getAdded('express') + 1);
                    bsDebug(port, 'EXPRESS must be added!');
                    data = paramData[ourCommand.getAdded('express')];
                    bsDebug(port, 'openCoupon - We got data: ' + (typeof data), data);
                    if (typeof data !== 'undefined') {
                        await openElement();
                    } else {
                        await delayPromise(777);
                        return max;
                    }
                } else {
                    await delayPromise(777);
                    return max;
                }
            } else {
                bsError(port, message);
                throw message;
            }
        };
        const openElement = async (data) => {
            await openEvent(data).catch((e) => result(false, 'Error till open event: ' + e));
            const $el = await getBetElement(data).catch((e) => result(false, 'Error in getBetElement: ' + e));
            if ($el.length === 0) {
                await result(false, 'Element not found!');
            }
            await delayPromise(777);
            await mouseChain({target: $el[0], events: fullClick, error: '$el'});
            await delayPromise(777);
            return await result(true, 'Coupon opened!');
        }

        if (ourCommand.getAdded('express') !== false) {
            data = paramData[ourCommand.getAdded('express')];
        } else {
            data = lData.shift();
        }

        if (typeof data !== 'undefined') {
            bsDebug(port, 'openCoupon - basic - We got data: ' + (typeof data), data);
            return await openElement(data);
        } else {
            await result(false, 'There is no input data!');
        }
    };

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<any>} jQuery element for bet
     */
    const getBetElement = async (data) => {
        //#-#-START
        let $betEl = $([]);
        let markets = {
            'ONE_TWO': {
                'ONE': {root: ['1x2'], pivotKey: ['W1', 'П1']},
                'TWO': {root: ['1x2'], pivotKey: ['W2', 'П2']},
                'DRAW': {root: ['1x2'], pivotKey: ['X', 'Х']},
                'ONE_DRAW': {root: ['Double Chance', 'Двойной шанс'], pivotKey: ['1X']},
                'TWO_DRAW': {root: ['Double Chance', 'Двойной шанс'], pivotKey: ['2X']},
                'ONE_TWO': {root: ['Double Chance', 'Двойной шанс'], pivotKey: ['12']}
            },
            'TOTAL': {
                'OVER': {
                    root: ['Total'],
                    pivotKey: ['Total Over (#PIVOTR#)']
                },
                'UNDER': {
                    root: ['Total'],
                    pivotKey: ['Total Under (#PIVOTR#)']
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    root: ['Home Team Total', 'Индивидуальный тотал хозяева'],
                    pivotKey: ['Total Over (#PIVOTR#)', 'Тотал (#PIVOTR#) Больше']
                },
                'UNDER': {
                    root: ['Home Team Total', 'Индивидуальный тотал хозяева'],
                    pivotKey: ['Total Under (#PIVOTR#)', 'Тотал (#PIVOTR#) Меньше']
                }
            },
            'T2_TOTAL': {
                'OVER': {
                    root: ['Away Team Total', 'Индивидуальный тотал гости'],
                    pivotKey: ['Total Over (#PIVOTR#)', 'Тотал (#PIVOTR#) Больше']
                },
                'UNDER': {
                    root: ['Away Team Total', 'Индивидуальный тотал гости'],
                    pivotKey: ['Total Under (#PIVOTR#)', 'Тотал (#PIVOTR#) Меньше']
                }
            },
            'CORNER_TOTAL': {
                'OVER': {
                    root: ['Corners - Total'],
                    pivotKey: ['Total Over (#PIVOTR#)']
                },
                'UNDER': {
                    root: ['Corners - Total'],
                    pivotKey: ['Total Under (#PIVOTR#)']
                }
            },
            'HDP': {
                'HOME': {
                    root: ['Handicap', 'Фора'],
                    pivotKey: ['Handicap 1 (#PIVOTR#)', 'Фора 1 (#PIVOTR#)']
                },
                'AWAY': {
                    root: ['Handicap', 'Фора'],
                    pivotKey: ['Handicap 2 (#PIVOTR#)', 'Фора 2 (#PIVOTR#)']
                }
            },
            'CORNER_HDP': {
                'HOME': {
                    root: ['Corners - Handicap'],
                    pivotKey: ['Handiсap 1 (#PIVOTR#)', 'Фора 1 (#PIVOTR#)']
                },
                'AWAY': {
                    root: ['Corners - Handicap'],
                    pivotKey: ['Handiсap 2 (#PIVOTR#)', 'Фора 2 (#PIVOTR#)']
                }
            },
            'OUT_TOTAL': {
                'OVER': {
                    root: ['Throw-ins - Total'],
                    pivotKey: ['Total (#PIVOTR#) Over', 'Тотал (#PIVOTR#) Больше']
                },
                'UNDER': {
                    root: ['Throw-ins - Total'],
                    pivotKey: ['Total (#PIVOTR#) Under', 'Тотал (#PIVOTR#) Меньше']
                }
            },
            'T1_OUT_TOTAL': {
                'OVER': {
                    root: ['Throw-ins - Total Home Team'],
                    pivotKey: ['Total (#PIVOTR#) Over']
                },
                'UNDER': {
                    root: ['Throw-ins - Total Home Team'],
                    pivotKey: ['Total (#PIVOTR#) Under']
                },
            },
            'T2_OUT_TOTAL': {
                'OVER': {
                    root: ['Throw-ins - Total Away Team'],
                    pivotKey: ['Total (#PIVOTR#) Over']
                },
                'UNDER': {
                    root: ['Throw-ins - Total Away Team'],
                    pivotKey: ['Total (#PIVOTR#) Under']
                },
            },
            'T1_CORNER_TOTAL': {
                'OVER': {
                    root: ['Corners - Home Team Total', 'Corners -  home team total'],
                    pivotKey: ['Total Over (#PIVOTR#)']
                },
                'UNDER': {
                    root: ['Corners - Home Team Total', 'Corners -  home team total'],
                    pivotKey: ['Total Under (#PIVOTR#)']
                },
            },
            'T2_CORNER_TOTAL': {
                'OVER': {
                    root: ['Corners - Away Team Total', 'Corners - away team total'],
                    pivotKey: ['Total Over (#PIVOTR#)']
                },
                'UNDER': {
                    root: ['Corners - Away Team Total', 'Corners - away team total'],
                    pivotKey: ['Total Under (#PIVOTR#)']
                },
            },
            'YC_TOTAL': {
                'OVER': {
                    root: ['Yellow Cards - Total'],
                    pivotKey: ['Total Over (#PIVOTR#)']
                },
                'UNDER': {
                    root: ['Yellow Cards - Total'],
                    pivotKey: ['Total Under (#PIVOTR#)']
                }
            },
            'FOUL_TOTAL': {
                'OVER': {
                    root: ['Fouls - Total'],
                    pivotKey: ['Total (#PIVOTR#) Over']
                },
                'UNDER': {
                    root: ['Fouls - Total'],
                    pivotKey: ['Total (#PIVOTR#) Under']
                }
            },
            half: {
                'ONE_TWO': {
                    'ONE': {root: ['1st half - 1x2', '1-й тайм - 1х2'], pivotKey: ['W1', 'П1']},
                    'TWO': {root: ['1st half - 1x2', '1-й тайм - 1х2'], pivotKey: ['W2', 'П2']},
                    'DRAW': {root: ['1st half - 1x2', '1-й тайм - 1х2'], pivotKey: ['X', 'X']},
                    'ONE_DRAW': {root: ['1st half - double chance', '1-й тайм - двойной шанс'], pivotKey: ['1X']},
                    'TWO_DRAW': {root: ['1st half - double chance', '1-й тайм - двойной шанс'], pivotKey: ['X2']},
                    'ONE_TWO': {root: ['1st half - double chance', '1-й тайм - двойной шанс'], pivotKey: ['12']}
                },
                'TOTAL': {
                    'OVER': {
                        root: ['1st half - total', '1-й тайм - тотал'],
                        pivotKey: ['Total (#PIVOTR#) Over', 'Тотал (#PIVOTR#) Больше']
                    },
                    'UNDER': {
                        root: ['1st half - total', '1-й тайм - тотал'],
                        pivotKey: ['Total (#PIVOTR#) Under', 'Тотал (#PIVOTR#) Меньше']
                    },
                },
                'HDP': {
                    'HOME': {
                        root: ['1st half - handicap', '1-й тайм - фора'],
                        pivotKey: ['Handicap 1 (#PIVOTR#)', 'Фора 1 (#PIVOTR#)']
                    },
                    'AWAY': {
                        root: ['1st half - handicap', '1-й тайм - фора'],
                        pivotKey: ['Handicap 2 (#PIVOTR#)', 'Фора 2 (#PIVOTR#)']
                    }
                },
                'CORNER_TOTAL': {
                    'OVER': {
                        root: ['1st Half - Total Corners'],
                        pivotKey: ['Total Over (#PIVOTR#)']
                    },
                    'UNDER': {
                        root: ['1st Half - Total Corners'],
                        pivotKey: ['Total Under (#PIVOTR#)']
                    }
                },
                'CORNER_HDP': {
                    'HOME': {
                        root: ['1st Half - Corners Handicap'],
                        pivotKey: ['Handiсap 1 (#PIVOTR#)', 'Фора 1 (#PIVOTR#)']
                    },
                    'AWAY': {
                        root: ['1st Half - Corners Handicap'],
                        pivotKey: ['Handiсap 2 (#PIVOTR#)', 'Фора 2 (#PIVOTR#)']
                    }
                },
                'OUT_TOTAL': {
                    'OVER': {
                        root: ['1st  half - Throw-ins - Total'],
                        pivotKey: ['Total (#PIVOTR#) Over', 'Тотал (#PIVOTR#) Больше']
                    },
                    'UNDER': {
                        root: ['1st  half - Throw-ins - Total'],
                        pivotKey: ['Total (#PIVOTR#) Under', 'Тотал (#PIVOTR#) Меньше']
                    }
                },
                'T1_OUT_TOTAL': {
                    'OVER': {
                        root: ['1st  half - Throw-ins - Total Home Team'],
                        pivotKey: ['Total (#PIVOTR#) Over']
                    },
                    'UNDER': {
                        root: ['1st  half - Throw-ins - Total Home Team'],
                        pivotKey: ['Total (#PIVOTR#) Under']
                    },
                },
                'T2_OUT_TOTAL': {
                    'OVER': {
                        root: ['1st  half - Throw-ins - Total Away Team'],
                        pivotKey: ['Total (#PIVOTR#) Over']
                    },
                    'UNDER': {
                        root: ['1st  half - Throw-ins - Total Away Team'],
                        pivotKey: ['Total (#PIVOTR#) Under']
                    },
                },
                'T1_CORNER_TOTAL': {
                    'OVER': {
                        root: ['Corners - 1st half - Home Team Total'],
                        pivotKey: ['Total Over (#PIVOTR#)']
                    },
                    'UNDER': {
                        root: ['Corners - 1st half - Home Team Total'],
                        pivotKey: ['Total Under (#PIVOTR#)']
                    },
                },
                'T2_CORNER_TOTAL': {
                    'OVER': {
                        root: ['Corners - 1st Half - Away Team Total'],
                        pivotKey: ['Total Over (#PIVOTR#)']
                    },
                    'UNDER': {
                        root: ['Corners - 1st Half - Away Team Total'],
                        pivotKey: ['Total Under (#PIVOTR#)']
                    },
                },
                'YC_TOTAL': {
                    'OVER': {
                        root: ['1st Half - Yellow Cards - Total'],
                        pivotKey: ['Total (#PIVOTR#) Over', 'Тотал (#PIVOTR#) Больше']
                    },
                    'UNDER': {
                        root: ['1st Half - Yellow Cards - Total'],
                        pivotKey: ['Total (#PIVOTR#) Under', 'Тотал (#PIVOTR#) Меньше']
                    }
                },
                'FOUL_TOTAL': {
                    'OVER': {
                        root: ['1st  half - fouls total'],
                        pivotKey: ['Total (#PIVOTR#) Over', 'Тотал (#PIVOTR#) Больше']
                    },
                    'UNDER': {
                        root: ['1st  half - fouls total'],
                        pivotKey: ['Total (#PIVOTR#) Under', 'Тотал (#PIVOTR#) Меньше']
                    }
                },
            }
        };

        if (data.time_value === 'HALF_TIME' && (data.sport === 'FOOTBALL' || data.sport === 'HANDBALL')) {
            markets = markets.half;
        } else {
            delete markets.half;
        }

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw 'Unsupported ' + data.time_value + '/' + data.market + '/' + data.target;
        }

        const specialPivotFormatter = function (market, pivot) {
            function round(value, precision) {
                let multiplier = Math.pow(10, precision || 0);
                return Math.round(value * multiplier) / multiplier;
            }

            let fp = parseFloat(pivot);
            let res = '';
            if (!isNaN(fp)) {
                if (market.indexOf('TOTAL') > -1) {
                    // dot zero adding
                    res = round(fp, 1).toFixed(1).toString();
                } else if (market.indexOf('HDP') > -1) {
                    res = (fp > 0 ? '+' : '') + round(fp, 1).toFixed(1).toString();
                }
            }
            return res;
        };
        const replaceInner = function (element, parent, index) {
            if (typeof element === 'string') {
                parent[index] = element.replace('#TEAM1#', data.team1).replace('#TEAM2#', data.team2)
                    .replace('#PIVOT#', data.pivot).replace('#PIVOTR#', specialPivotFormatter(data.market, data.pivot));
            } else if (typeof element === 'object') {
                // it's not use now
                for (let i in element) {
                    replaceInner(element[i], element, i);
                }
            } else {
                //console.log(typeof element + ' not supported! (' + element + ')');
            }
        };

        replaceInner(markets, null, null);

        const getRootParams = function () {
            let additions = {};
            let specialAdditions = {
                condition: [],
                func: () => {
                }
            };
            let needChange = [];
            let needRemove = [];
            let replacements = [];
            let needAddTo = [];
            let needAddToBeginning = false;
            if (data.sport === 'BASKETBALL') {
                if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) > -1) {
                    replacements.push({from: '1x2', to: 'Winner (Incl. OT)'});
                    replacements.push({from: 'Handicap', to: 'Handicap (Incl. OT)'});
                    replacements.push({from: 'Home Team Total', to: 'Home Team Total (Incl. OT)'});
                    replacements.push({from: 'Away Team Total', to: 'Away Team Total (Incl. OT)'});

                    if (data.market === 'TOTAL') {
                        replacements.push({from: 'Total', to: 'Total (Incl. OT)'});
                    }
                } else {
                    const q = data.time_value.replace(/[^\d]/g, '');
                    replacements.push({from: '1x2', to: q + ' quarter - 1x2'});
                    replacements.push({from: 'Total', to: q + ' quarter - total'});
                    replacements.push({from: 'Handicap', to: q + ' quarter - handicap'});
                    replacements.push({from: 'Total Home Team', to: q + ' quarter - home team total'});
                    replacements.push({from: 'Total Away Team', to: q + ' quarter - away team total'});
                }
            } else if (data.sport === 'BASEBALL') {
                if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) > -1) {
                    replacements.push({from: '1x2', to: 'Winner'});
                    replacements.push({from: 'Handicap', to: 'Handicap (incl. extra innings)'});
                    replacements.push({from: 'Total Home Team', to: 'Home team total (incl. extra innings)'});
                    replacements.push({from: 'Total Away Team', to: 'Away team total (incl. extra innings)'});

                    if (data.market === 'TOTAL') {
                        replacements.push({from: 'Total', to: 'Total (incl. extra innings)'});
                    }

                    markets['T1_TOTAL']['OVER'].pivotKey[0] = markets['T1_TOTAL']['OVER'].pivotKey[0].replace('Total Home Team', 'Total');
                    markets['T1_TOTAL']['UNDER'].pivotKey[0] = markets['T1_TOTAL']['UNDER'].pivotKey[0].replace('Total Home Team', 'Total');
                    markets['T2_TOTAL']['OVER'].pivotKey[0] = markets['T2_TOTAL']['OVER'].pivotKey[0].replace('Total Away Team', 'Total');
                    markets['T2_TOTAL']['UNDER'].pivotKey[0] = markets['T2_TOTAL']['UNDER'].pivotKey[0].replace('Total Away Team', 'Total');
                } else {
                    const innings = data.time_value.replace(/[^\d]/g, '');
                    replacements.push({from: '1x2', to: innings + ' inning - 1x2'});
                    replacements.push({from: 'Total', to: innings + ' inning - total'});
                    replacements.push({from: 'Handicap', to: innings + ' inning - handicap'});

                    markets['ONE_TWO']['ONE'].pivotKey[0] = markets['ONE_TWO']['ONE'].pivotKey[0].replace('W1', 'Home team');
                    markets['ONE_TWO']['TWO'].pivotKey[0] = markets['ONE_TWO']['TWO'].pivotKey[0].replace('W2', 'Away team');
                    markets['ONE_TWO']['DRAW'].pivotKey[0] = markets['ONE_TWO']['DRAW'].pivotKey[0].replace('X', 'Draw');
                }
            } else if (data.sport === 'TENNIS') {
                if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) > -1) {
                    replacements.push({from: 'Total Home Team', to: 'Player 1 - total games'});
                    replacements.push({from: 'Total Away Team', to: 'Player 2 - total games'});

                    markets['T1_TOTAL']['OVER'].pivotKey[0] = markets['T1_TOTAL']['OVER'].pivotKey[0].replace('Total Home Team', 'Total');
                    markets['T1_TOTAL']['UNDER'].pivotKey[0] = markets['T1_TOTAL']['UNDER'].pivotKey[0].replace('Total Home Team', 'Total');
                    markets['T2_TOTAL']['OVER'].pivotKey[0] = markets['T2_TOTAL']['OVER'].pivotKey[0].replace('Total Away Team', 'Total');
                    markets['T2_TOTAL']['UNDER'].pivotKey[0] = markets['T2_TOTAL']['UNDER'].pivotKey[0].replace('Total Away Team', 'Total');
                } else {
                    if (data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') === -1) {
                        const set = data.time_value.replace(/[^\d]/g, '');
                        replacements.push({from: '1x2', to: set + ' set - 1x2'});
                        replacements.push({from: 'Total', to: set + ' set - total'});
                        replacements.push({from: 'Handicap', to: set + ' set - handicap'});
                    }
                }
            } else if (data.sport === 'TABLETENNIS') {
                if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) > -1) {
                    replacements.push({from: 'Total Home Team', to: 'Home team total'});
                    replacements.push({from: 'Total Away Team', to: 'Away team total'});

                    markets['T1_TOTAL']['OVER'].pivotKey[0] = markets['T1_TOTAL']['OVER'].pivotKey[0].replace('Total Home Team', 'Total');
                    markets['T1_TOTAL']['UNDER'].pivotKey[0] = markets['T1_TOTAL']['UNDER'].pivotKey[0].replace('Total Home Team', 'Total');
                    markets['T2_TOTAL']['OVER'].pivotKey[0] = markets['T2_TOTAL']['OVER'].pivotKey[0].replace('Total Away Team', 'Total');
                    markets['T2_TOTAL']['UNDER'].pivotKey[0] = markets['T2_TOTAL']['UNDER'].pivotKey[0].replace('Total Away Team', 'Total');
                } else {
                    if (data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') === -1) {
                        const set = data.time_value.replace(/[^\d]/g, '');
                        replacements.push({from: '1x2', to: set + ' set - 1x2'});
                        replacements.push({from: 'Total', to: set + ' set - total'});
                        replacements.push({from: 'Handicap', to: set + ' set - handicap'});
                    }
                }
            } else if (data.sport === 'HOCKEY') {
                if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) === -1) {
                    const period = data.time_value.replace(/[^\d]/g, '').trim();
                    replacements.push({from: '1x2', to: `Period ${period} - 1x2`});
                    replacements.push({from: 'Double Chance', to: `Period ${period} - double chance`});
                    replacements.push({from: 'Total', to: `Period ${period} - total`});
                    replacements.push({from: 'Handicap', to: `Period ${period} - handicap`});
                    replacements.push({from: 'Total Home Team', to: `Period ${period} - home team total`});
                    replacements.push({from: 'Total Away Team', to: `Period ${period} - away team total`});
                }
            } else if (data.sport === 'VOLLEYBALL') {
                if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) > -1) {
                    replacements.push({from: 'Total Home Team', to: 'Home team total'});
                    replacements.push({from: 'Total Away Team', to: 'Away team total'});

                    markets['T1_TOTAL']['OVER'].pivotKey[0] = markets['T1_TOTAL']['OVER'].pivotKey[0].replace('Total Home Team', 'Total');
                    markets['T1_TOTAL']['UNDER'].pivotKey[0] = markets['T1_TOTAL']['UNDER'].pivotKey[0].replace('Total Home Team', 'Total');
                    markets['T2_TOTAL']['OVER'].pivotKey[0] = markets['T2_TOTAL']['OVER'].pivotKey[0].replace('Total Away Team', 'Total');
                    markets['T2_TOTAL']['UNDER'].pivotKey[0] = markets['T2_TOTAL']['UNDER'].pivotKey[0].replace('Total Away Team', 'Total');
                } else {
                    const set = data.time_value.replace(/[^\d]/g, '');
                    replacements.push({from: '1x2', to: set + ' set - 1x2'});
                    replacements.push({from: 'Total', to: set + ' set - total'});
                    replacements.push({from: 'Handicap', to: set + ' set - handicap'});
                }
            } else if (data.sport === 'HANDBALL') {
                if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) > -1) {
                    markets['T1_TOTAL']['OVER'].pivotKey[0] = markets['T1_TOTAL']['OVER'].pivotKey[0].replace('Total Home Team', 'Total');
                    markets['T1_TOTAL']['UNDER'].pivotKey[0] = markets['T1_TOTAL']['UNDER'].pivotKey[0].replace('Total Home Team', 'Total');
                    markets['T2_TOTAL']['OVER'].pivotKey[0] = markets['T2_TOTAL']['OVER'].pivotKey[0].replace('Total Away Team', 'Total');
                    markets['T2_TOTAL']['UNDER'].pivotKey[0] = markets['T2_TOTAL']['UNDER'].pivotKey[0].replace('Total Away Team', 'Total');
                }
            } else if (data.sport === 'CYBERSPORT') {
                if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) > -1) {
                    if (data.league.indexOf('Dota 2') === -1) {
                        replacements.push({from: '1x2', to: 'Winner'});
                    }

                    replacements.push({from: 'Total', to: 'Total maps'});
                    replacements.push({from: 'Handicap', to: 'Map Handicap'});
                    replacements.push({from: 'Double Chance', to: 'Double chance'});
                    markets['ONE_TWO']['DRAW'].pivotKey[0] = markets['ONE_TWO']['DRAW'].pivotKey[0].replace('X', 'draw');
                } else {
                    const map = data.time_value.replace(/[^\d]/g, '').trim();
                    replacements.push({from: '1x2', to: map + ' map  - Winner'});
                    replacements.push({from: 'Total', to: map + ' map  - total kills'});
                    replacements.push({from: 'Handicap', to: map + ' map  - Kills handicap'});
                }
            }
            return {
                additions: additions,
                specialAdditions: specialAdditions,
                needChange: needChange,
                needRemove: needRemove,
                replacements: replacements,
                needAddTo: needAddTo,
                needAddToBeginning: needAddToBeginning
            };
        };

        marketsModifierWrapper(data, 'root', getRootParams(), markets);
        //marketsModifierWrapper(data, 'pivotKeys', getRootParams(true), markets);

        const finalPrepareForMarket = function (market) {
            market.rootLC = market.root.map(v => v.toLowerCase());
            return market;
        };
        const market = finalPrepareForMarket(markets[data.market][data.target]);

        bsDebug(port, 'Get bet element', market);
        const performGet = function () {
            const rootProcess = function () {
                let currentRoot = 0;
                const getElement = function () {
                    //console.log('checkRoot', rootCandidates[currentRoot]);
                    let $root = $(rootCandidates[currentRoot]);
                    let $stakes = $root.find('div[class^="Group_body_"]');
                    if ($stakes.length === 0) {
                        throw 'stake body not found!';
                    } else {
                        //console.log($stakes);
                        const $el = $stakes.find('button').filter(function () {
                            if (typeof markets[data.market][data.target].pivotKey === 'undefined') {
                                throw 'Pivot is not exist!';
                            } else {
                                //console.log($(this).text().trim() + ' vs ' + markets[data.market][data.target].pivotKey);
                                return markets[data.market][data.target].pivotKey.indexOf($(this).find('h3[class^="Outcome_title_"]').text().trim()) > -1;
                            }
                        });
                        //console.log($pivots);
                        if ($el.length === 0) {
                            throw 'Element not found!';
                        } else {
                            return $el;
                        }
                    }
                };
                const rootOuterFunction = function () {
                    if (currentRoot >= rootCandidates.length) {
                        throw 'No roots / pivots were found!';
                    }
                    //rootCandidates[currentRoot].scrollIntoView(true);
                    let $cRoot = $(rootCandidates[currentRoot]);
                    let $title = $cRoot.find('div[class^="Group_header_"] span');
                    if ($title.length === 0) {
                        throw '$title for root not found!';
                    } else {
                        $title[0].scrollIntoView(true);
                        $betEl = getElement();
                    }
                };
                rootOuterFunction();
            };
            const rootCandidates = $('div[class^="Group_group_"]').filter(function () {
                return market.root.indexOf($(this).find('div[class^="Group_header_"] > span').clone().children().remove().end().text().trim()) > -1;
            });
            if (rootCandidates.length > 0) {
                rootProcess();
            } else {
                throw 'Root candidates not found!';
            }
        };
        await waitForElement('div[class^="Group_group_"]', 333, 10000);
        performGet();
        return $betEl;
        //#-#-FINISH
    };

    /**
     * Close previous coupons
     * @param skipParam
     * @returns {Promise<string>}
     */
    const closePreviousCoupons = async state => {
        const $closeBtns = () => $('button[class^="Bet_deleteButton"]');
        if ($coupons().length > 0) {
            if (state) {
                for (let i=0; i<$closeBtns().length; i++) {
                    if ($closeBtns().length > settings.newExpressBetsAmount) {
                        await mouseChain({target: $closeBtns().first()[0], events: fullClick, error: 'closeCoupon'});
                        await delayPromise(555);
                    }
                }
            } else {
                const closeOne = async () => {
                    let $closes = $('button[class^="Bet_deleteButton"]');
                    if ($closes.length > 0) {
                        await mouseChain({target: $closes[0], events: fullClick, error: 'Error till close coupon'});
                        await delayPromise(888);
                        await closeOne();
                    } else {
                        return 'All were closed!';
                    }
                };
                await closeOne();
            }
        }
    };

    /**
     * select language ENG
     */
    const switchLang = async () => {
        const $lang = await waitForElement('p[class*="CurrentLocale_current"]', 333, 20000);
        if ($lang.text().trim() !== 'EN') {
            await mouseChain({target: $lang[0], events: ['click'], error: 'lang'});
            await delayPromise(2222);
            await mouseChain({
                target: $('span[class*="LocalesList_buttonText"]:textEquals("EN")')[0],
                events: ['click'],
                error: 'lang en'
            });
        }
    };

    /**
     * Check and do authorization
     * @param settings
     */
    const authCheck = function () {
        //console.log('%c authCheck', 'background: red; color: white;');
        if (enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            bsError(port, 'ERROR AUTH!');
            return;
        }

        if (authClickedCount > 3) {
            bsError(port, 'ERROR AUTH! Not loggen in for ' + authClickedCount + ' times');
            port.postMessage({m: "ERROR AUTH! Not loggen in for " + authClickedCount + ' times'});
            return;
        }

        (async () => {
            const $logLink = bkHere === 'mostbet' ? $('button.auto_login:textEquals("Log in")') : $('button.auto_login:textEquals("Вход")');

            //close all gift popups
            await closeAllWeNeed({
                'button[class*="GiftPopup_closeBtn"]': 'button[class*="GiftPopup_closeBtn"]',
                'button:textEquals("return to the website")': 'button:textEquals("return to the website")'
            });

            // Hint: Check we're in English
            if (bkHere === 'mostbet') {
                await switchLang();
            }

            if ($logLink.length > 0) {
                // Hint: Log In
                port.postMessage({m: "tech works! 2"});
                await delayPromise(1000);
                await tryToLogIn($logLink).catch(e => bsError(port, 'Error login: ' + e));
            } else {
                if (settings.lastScoreBasketball === '999') {
                    if (Date.now() - settings.sourceDate >= 300000) {
                        settings.sourceDate = Date.now();
                        settings.sourceRandom = getSourceRandom();
                        // if (settings.sourceRandom >= 17 && settings.sourceRandom <= 18) {
                        //     settings.newExpresses = true;
                        //     if (settings.sourceRandom >= 17 && settings.sourceRandom <= 18) {
                        //         settings.newExpressBetsAmount = 1;
                        //     }
                        // } else {
                        //     waitSource = false;
                        //     settings.newExpresses = false;
                        // }

                        dLog('blue', 'MOSTBET', `Source current random value - ${settings.sourceRandom}`);
                    }
                }

                if (settings.newExpresses && !busy) {
                    busy = true;
                    const WasSuccessExpressNew = await bMess('WasSuccessExpressNew').infinite().catch(() => 0);
                    const couponsExist = await waitForCondition(() => $coupons().length > 0,
                        222, 1777).catch(() => $([]));

                    if (WasSuccessExpressNew && couponsExist.length === 0) {
                        await bMess('WasSuccessExpressNew').remove();
                    }

                    if (!WasSuccessExpressNew) {
                        dLog('green', 'MOSTBET', 'START find NewExpress event!');
                        // clear coupons
                        if ($coupons().length > 0) {
                            await closePreviousCoupons(false);
                        }

                        waitSource = false;
                        await ProccedExpressNew().catch((e) => {
                            dLog('red', 'MOSTBET', 'ProccedExpressNew Error - ' + e);
                            bMess('WasSuccessExpressNew').set(false);
                        });
                    }
                    busy = false;
                }

                const $balance = bkHere === 'mostbet' ? $('span.auto_user_balance:first') : $('div.auto_user_balance:first');
                port.postMessage({
                    m: "authorized!",
                    balance: ($balance.length === 1)
                        ? parseFloat($balance.text().trim().replace(',', '.').replace(/[^0-9\.]/g, '').trim())
                        : 'null'
                });
            }
        })()
            .catch(e => dLog('red', `${bkHere}`, `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    /**
     * Try login to account
     * @returns {Promise<string>}
     */
    const tryToLogIn = async ($logLink) => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }

        if ($logLink.length !== 1) {
            throw 'No $logLink!';
        }

        await mouseChain({target: $logLink[0], events: fullClick});
        await waitForElement('form[class*="LoginForm_container"]', 300, 8888);
        await delayPromise(222);
        await clearAndSimulate($('input#uReal')[0], settings.login, true, true, true);
        await delayPromise(222);
        await clearAndSimulate($('input#pReal')[0], settings.password, true, true, true);
        await delayPromise(222);

        if (!$('input#remember_me').is(":checked")) {
            await mouseChain({target: $('input#remember_me')[0], events: fullClick});
            await delayPromise(222);
        }
        const $submitButton = bkHere === 'mostbet' ? $('button[class*="LoginForm_submitButton"]:textEquals("Log in")') : $('button[class*="LoginForm_submitButton"]:textEquals("Войти")');
        await mouseChain({
            target: $submitButton[0],
            events: fullClick
        });
        const $errorMessage = await waitForElement('span[class*="LoginForm_error_"]', 333, 2888).catch(() => $([]));
        if ($errorMessage.length > 0) {
            enterError = true;
        }
        await delayPromise(777);
        authClickedCount++;
        authClicked = Date.now();
        dLog('', `${bkHere}`, 'Auth clicked!');
        return "auth_clicked";
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            chrome.storage.local.set({'MOSTBET_COMMAND': ourCommand.get(), 'MOSTBET_COMMAND_WAS_SET': Date.now()});
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});
        chrome.storage.local.get(['MOSTBET_COMMAND', 'MOSTBET_COMMAND_WAS_SET'], function (result) {
            bsDebug(port, 'Saved command:', result);
            if (typeof result.MOSTBET_COMMAND !== 'undefined' && typeof result.MOSTBET_COMMAND_WAS_SET !== 'undefined'
                && Date.now() - result.MOSTBET_COMMAND_WAS_SET < 40000) {
                let currentCommand = result.MOSTBET_COMMAND;
                chrome.storage.local.remove(['MOSTBET_COMMAND', 'MOSTBET_COMMAND_WAS_SET'], function () {
                    //bsDebug(port, 'Restoring with: ', currentCommand);
                    messageProcessor(currentCommand);
                });
            } else {
                chrome.storage.local.remove(['MOSTBET_COMMAND', 'MOSTBET_COMMAND_WAS_SET']);
            }
        });
    }

})();
