(function () {

    "use strict";

    let newAPI = false;
    let limited = false;
    let authClicked = 0;
    let authClickedCount = 0;
    let wasAuthCheck = false;
    let busy = false;
    let increaseDelay = false;
    let enterError = false;
    const bkHere = document.location.href.indexOf('.gamebookers') > -1
        ? "gamebookers" : document.location.href.indexOf('.sportingbet.') > -1 ? 'sportingbet' : "partypoker";
    const port = window.self === window.top
        ? chrome.runtime.connect({name: `port_${bkHere}`})
        : {postMessage: () => console.log(arguments)};
    const settings = {
        authCheckInterval: 2000,
        url: 'https://sports.gamebookers.com/en/sports/live/betting',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        maxWaitForScore: 60000,
        // Hint: Set to true to remove translation
        removeMedia: false
    };

    let currentBetData = false;
    let currentCommand = '';

    const ourCommand = new ourCommandProto();

    const sportAccordance = {
        'FOOTBALL': 'Football',
        'HOCKEY': 'Ice Hockey',
        'VOLLEYBALL': 'Volleyball',
        'TENNIS': 'Tennis',
        'TABLETENNIS': 'Table Tennis',
        'BASEBALL': 'Baseball',
        'BASKETBALL': 'Basketball',
        'CYBERSPORT': 'E-Sports',
    };

    const messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        }
        currentCommand = message.action;
        if (limited) {
            port.postMessage({
                answered: message.action,
                status: "LIMITED",
                answer: "LIMITED"
            });
        } else if (message.action !== 'auth' && busy) {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY"
            });
        } else if (message.action === "auth") {
            if (message.login === 'reger') {
                bsDebug(port, 'Awaiting for registration command!');
                return;
            }
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.phone = message.phone;
            settings.uid = message.uid;
            if (message.start_url) {
                settings.url = message.start_url;
            }
            authCheck();
            wasAuthCheck = true;
        } else if (message.action === 'REGISTER') {
            busy = true;
            ourCommand.set(message);
            register(message.data)
                .then(() => bsDebug(port, 'It\'s looks like ' + message.action + ' done!'))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                });
        } else if ($('input[name="username"]:visible').length > 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (typeof methods[message.action] === "function") {
            busy = true;
            ourCommand.set(message);
            methods[message.action](message.data)
                .then(() => bsDebug(port, "It's looks like " + message.action + " done!"))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                })
                .then(() => delayPromise(3000))
                .then(() => ['BET', 'EXPRESS_BET'].indexOf(message.action) > -1 ? null : goLive());
        }
    };

    const maximum = function (data) {
        return new Promise((onSuccess, onReject) => {
            bsDebug(port, 'MAXIMUM for: ' + data[0].market + '/' + data[0].target + '/' + data[0].pivot);
            let max;
            const report = function (succeeded, e) {
                port.postMessage({
                    answered: "MAXIMUM",
                    status: succeeded ? 'success' : 'error',
                    answer: succeeded ? max : "Error: " + e
                });
                succeeded ? onSuccess() : onReject(e);
            };
            closePreviousCoupons(ourCommand.getAdded('express') !== false)
                .then(() => openCoupon(data))
                .then((m) => max = m)
                .then(() => checkCoefs(data))
                .then(() => report(true))
                .catch((e) => report(false, e));
        });
    };

    const register = function (data) {
        bsDebug(port, 'register!');
        return new Promise(function (onSuccess, onReject) {
            onReject('Not supported!');
        });
    };

    const withdraw = async data => {
        bsDebug(port, 'Withdraw!', data);
        let report = function (success, message) {
            bsDebug(port, 'Report! ' + success + ' / ' + message);
            port.postMessage({
                answered: "WITHDRAW",
                status: success ? "SUCCESS" : "FAILED",
                answer: message
            });
            delayPromise(990)
                .then(() => delayPromise(990))
                .then(() => delayPromise(990))
                .then(() => window.location.reload);
            if (!success) {
                throw message;
            }
        };
        await (async () => {
            if (ourCommand.getAdded('cashierOpened') === false) {
                await delayPromise(111);
                await mouseChain({target: $('div.h-avatar')[0], events: fullClick, error: 'Avatar'});
                await delayPromise(990);
                const $cashier = await waitForElement('a.menu-item-link.list-nav-link:textEquals("Cashier")', 300, 5000);
                await mouseChain({target: $cashier[0], events: fullClick, error: '$cashier'});
                await delayPromise(990);
                const $withdraw = await waitForElement('a.menu-item-link.list-nav-link:textEquals("Withdraw")', 300, 5000);
                ourCommand.add('cashierOpened', true);
                await bMess('GAMEPARTY_ALTERNATE_COMMAND', true).set(ourCommand.get());
                await mouseChain({target: $withdraw[0], events: fullClick, error: '$cashier'});
            }
            bsDebug(port, 'We started wait for withdrawal right way! ' + window.location.href);
            const depositResult = await bMess('DEPOSIT_RESULT', true).get(120000);
            await bMess('DEPOSIT_RESULT', true).remove();
            if (!depositResult.success) {
                throw depositResult.message || 'No message :(';
            }
            report(true, depositResult.message || 'No message :(');
        })()
            .catch(e => report(false, `Withdrawal error: ${e}`));
    };

    const deposit = async data => {
        bsDebug(port, 'Deposit!', data);
        const report = function (success, message) {
            ourCommand.add('increaseDelay', false);
            ourCommand.add('qiwiEntered', false);
            bsDebug(port, 'Report! ' + success + ' / ' + message);
            port.postMessage({
                answered: "DEPOSIT",
                status: success ? 'SUCCESS' : ['NO_FUNDS', 'RESTRICTED'].find(t => message.indexOf(t) > -1) || 'FAILED',
                answer: message
            });
            delayPromise(3000)
                .then(() => window.location.reload);
            if (!success) {
                throw message;
            }
        };
        await (async () => {
            if (ourCommand.getAdded('cashierOpened') === false) {
                await delayPromise(150);
                const sels = ['a[title="Make a deposit"]', 'a.menu-item-link:has(span.menu-item-txt:contains("Deposit"))'];
                const $el = await waitForElement(() => $(sels.find(s => $(s).length > 0)), 333, 20000);
                ourCommand.add('cashierOpened', true);
                await bMess('GAMEPARTY_ALTERNATE_COMMAND', true).set(ourCommand.get());
                await mouseChain({target: $el[0], events: fullClick, scroll: true, error: 'Deposit'});
            }
            bsDebug(port, 'We started wait for deposit right way! ' + window.location.href);
            const depositResult = await bMess('DEPOSIT_RESULT', true).get(120000);
            if (!depositResult.success) {
                throw depositResult.message || 'No message :(';
            }
            report(true, depositResult.message || 'No message :(');
            await bMess('DEPOSIT_RESULT', true).remove();
            await bMess('SKRILL_COMMAND', true).remove();
        })()
            .catch(e => report(false, e));
    };

    /**
     * Collecting bet results
     * @param {array} inputData
     * @returns {Promise<string>}
     */
    const collectBetResults = async inD => {
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        bsDebug(port, 'collectBetResults, limit: ' + limit + ', data:', data);
        let error = '';
        const res = await collectBetResultsDo(limit, data)
            .catch(e => (error = e, []));
        port.postMessage({
            answered: ourCommand.get().action,
            status: error === '' ? "success" : "error",
            answer: error === '' ? res : error,
        });
        if (error === '') {
            return 'Data should be collected!';
        } else {
            throw error;
        }
    };

    const collectBetResultsDo = async (limit, data, inplay) => {
        if (document.location.href.indexOf('/sports/my-bets/') === -1) {
            const $myBets = await waitForElement('a.menu-item-link:textEquals("My Bets")', 300, 10000);
            await mouseChain({target: $myBets[0], events: fullClick, error: 'my bets click'});
            await delayPromise(2000);
        }
        const collected = new Set();
        let checked = 0;
        await (inplay ? ['Live'] : ['Live', 'Open', 'Settled']).forEachAsyncBreakable(async current => {
            const sel = `ms-tab-bar.sub-navigation li a:has(span:textEquals("${current}"))`;
            await waitForElement(sel, 300, 20000);
            if ($('ms-tab-bar.sub-navigation li.active a span').trt() !== sel) {
                await mouseChain({target: $(sel)[0], events: fullClick, error: ''});
                if (current === 'Settled') {
                    const $f = await waitForElement('div.my-bets-toolbar_button.filter-button',
                        300, 10000).catch(e => $([]));
                    if ($f.length > 0) {
                        await mouseChain({target: $f[0], events: fullClick, error: '$f'});
                        await delayPromise(500);
                    }
                    const $allSel = await waitForElement('button.ms-modal-toggle-button:textEquals("All")', 300, 10000);
                    if (!$allSel.hasClass('selected')) {
                        await mouseChain({target: $allSel[0], events: fullClick, error: '$allSel'});
                        await delayPromise(500);
                    }
                    const d = new Date();
                    d.setDate(d.getDate() - 89);
                    const delta = d.toISOString().substring(0, 10).split('-');
                    const inputSel = 'div.my-bets-settled-filter-modal_dates input';
                    $(inputSel).eq(0).val(delta.join('-'));
                    fireInputEvent($(inputSel).eq(0)[0]);
                    await delayPromise(500);
                    await mouseChain({
                        target: $('button.btn-primary:textEquals("Show results")')[0],
                        events: fullClick,
                        error: 'Show results'
                    });
                    await delayPromise(1500);
                }
                let needContinue = true;
                while (needContinue) {
                    const $coupons = await waitForElement('div.my-bets-list-betslip-container ms-my-bets-betslip', 300, 10000)
                        .catch(e => (console.log('%c' + `No coupons in ${current}`,
                            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;'),
                            $([])));
                    $coupons.each(function () {
                        checked++;
                        const res = collectCouponData($(this));
                        if (data.length === 0 || data.indexOf(res.external_id) > -1) {
                            collected.add(JSON.stringify(res));
                        }
                        if (checked >= limit) {
                            return false;
                        }
                    });
                    const $show = $('div.show-more-btn');
                    if ($show.length > 0 && checked < limit) {
                        await mouseChain({target: $show[0], events: fullClick, error: '$show', scroll: true});
                        await delayPromise(3000);
                    } else {
                        needContinue = false;
                    }
                }
            }
            if (checked >= limit) {
                return false;
            }
        });
        let res = [];
        for (let c of collected) {
            res.push(JSON.parse(c))
        }
        return res;
    };

    const collectCheckPayments = (data) => {
        return new Promise((onSuccess, onReject) => {
            let collected = [];
            let depositResult = {};
            const report = function (success, message) {
                bsDebug(port, 'collectCheckPayments: success = ' + success + ', message = ' + message + ', data:', data);
                port.postMessage({
                    answered: ourCommand.get().action,
                    status: success ? "success" : "error",
                    answer: success ? collected : message
                });
                if (success) {
                    onSuccess(collected);
                } else {
                    onReject(message);
                }
            };
            const getDepositResult = function () {
                chrome.storage.local.get(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET'], function (result) {
                    //bsDebug(port, 'Deposit result:', result, 'COLOR:yellow,red');
                    if (typeof result.DEPOSIT_RESULT !== 'undefined' && typeof result.DEPOSIT_RESULT_WAS_SET !== 'undefined'
                        && Date.now() - result.DEPOSIT_RESULT_WAS_SET < 20000) {
                        depositResult = result.DEPOSIT_RESULT;
                    } else {
                        depositResult = {};
                    }
                });
            };
            let waitForDepositResult = function () {
                bsDebug(port, 'We started wait for check payments! ' + window.location.href);
                waitForCondition(() => {
                    getDepositResult();
                    return typeof depositResult.success === 'boolean';
                }, 333, 200000, 'No deposit result in')
                    .then(() => {
                        report(depositResult.success, typeof depositResult.message === 'string' ? depositResult.message : 'No message :(');
                    })
                    .catch((e) => report(false, 'No deposit: ' + e))
                    .then(() => {
                        chrome.storage.local.remove(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET', 'SKRILL_COMMAND', 'SKRILL_COMMAND_WAS_SET']);
                    })
                    .then(() => delayPromise(990))
                    .then(() => delayPromise(990))
                    .then(() => delayPromise(990))
                    .then(() => window.location.reload(true));
            };
            if (!ourCommand.getAdded('cashierOpened') && window.location.href.indexOf('/en/sports/bets') === -1) {
                delayPromise(990)
                    .then(() => mouseChain({
                        target: $('a[title="My Bets"]')[0],
                        events: ['mouseover', 'mousedown', 'click', 'mouseup']
                    }));
            } else if (!ourCommand.getAdded('cashierOpened') && window.location.href.indexOf('/en/sports/bets') > -1) {
                delayPromise(990)
                    .then(() => {
                        chrome.storage.local.set({
                            'GAMEPARTY_ALTERNATE_COMMAND': ourCommand.get(),
                            'GAMEPARTY_ALTERNATE_COMMAND_WAS_SET': Date.now()
                        });
                        ourCommand.add('cashierOpened', true);
                    })
                    .then(() => mouseChain({
                        target: $('#LHNMenuPaymentHistory')[0],
                        events: ['mouseover', 'mousedown', 'click', 'mouseup']
                    }))
                    .then(waitForDepositResult)
                    .catch((e) => report(false, 'Go to deposit: ' + e))
            } else if (ourCommand.getAdded('cashierOpened')) {
                waitForDepositResult();
            } else {
                report(false, 'Something very strange!');
            }
        });
    };

    const collectCouponData = $coupon => {
        const $badge = $coupon.find('div.my-bets-outcome-badge');
        let result = $coupon.find('div.label:textEquals("Net winnings")').next().text().replace(/[^\d.]/g, '').trim();
        if (result === '') {
            result = $coupon.find('div.label:textEquals("Winnings")').next().text().replace(/[^\d.]/g, '').trim();
        }
        const sOdds = $coupon.find('div.mybets-betslip-summary_totalodds span').trt();
        return {
            external_id: $coupon.find('div.bet-info span.theme-copy-clipboard').text()
                .replace('Betslip ID: ', '').trim(),
            stake: $coupon.find('div.mybets-betslip-summary_stake-value').text().replace(/[^\d.]/g, '').trim(),
            coef: sOdds === '' ? $coupon.find('div.label:textEquals("Total odds")').next().trt() : sOdds,
            result: result,
            status: $badge.hasClass('badge-won') ? 'WON' : $badge.hasClass('badge-lost') ? 'LOSE' : 'ACCEPTED',
            match: $coupon.find('div[class*="info_event-name"]').trt(),
            bkPivot: $coupon.find('div.mybets-betslip-info_pick-name').trt() + ' ' +
                $coupon.find('div.mybets-betslip-info_market-name').trt(),
        }
    };

    /**
     * Proceeds bets and expresses
     * @param data {array}
     * @returns {Promise<any>}
     */
    const proceedBet = data => new Promise(function (onSuccess, onReject) {
        currentBetData = {
            data: data,
            max: 0,
            external_id: '',
            willPlace: 0
        };

        let betFinished = function (success, message) {
            dLog('green', 'GameParty', [`Bet finished ${success}:`, message]);
            let status = 'ACCEPTED';
            if (!success) {
                status = ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED']
                    .find(c => typeof message === 'string' && message.indexOf(c) > -1) || 'FAILED';
            }
            const resultData = {
                "external_id": success ? message.external_id : '',
                "status": status,
                "market": currentBetData.data[0].market,
                "target": currentBetData.data[0].target,
                "pivot": currentBetData.data[0].pivot,
                "coef": success ? message.coef : currentBetData.data[0].coef,
                "stake": success ? message.stake : currentBetData.data[0].stake,
                "maximum": currentBetData.max
            };
            if (success && typeof currentBetData.data[0].collectAfterAll !== 'undefined' && currentBetData.data[0].collectAfterAll) {
                resultData['bkPivot'] = message.bkPivot;
            }
            port.postMessage({
                answered: "BET",
                data: resultData,
                answer: success ? 'Everything is Okay!' : status === 'LIMITED' ? 'Tried to bet 0' : message,
            });
            success ? onSuccess() : onReject(message);
        };

        let report = function (success, message, willPlace) {
            bsDebug(port, "Report (proceedBet) was fired with success: " + success + ', message: '
                + message + ', willPlace: ' + willPlace,
                (new Error().stack), message);
            if (success) {
                betFinished(true, message);
            } else {
                betFinished(false, message);
            }
        };

        let checkSuccess = function (willPlace) {
            (async () => {
                let $accept = $([]), $bss = $([]), $s = $([]),
                    $e = $([]);
                await waitForCondition(() => {
                    $accept = $('button.betslip-place-button:textEquals("Accept & place bet")');
                    $bss = $('div.succeeded:visible');
                    $s = $('div.my-bets-link a:contains("Open detailed view"):visible');
                    $e = $('div.note:has(i.warning-color):contains("stake limit")');
                    return $accept.length > 0 || $bss.length > 0 || $e.length > 0
                        || ($s.length > 0 && elementIsVisible($s[0]));
                }, 333, 45000, 'Unknown status');
                if ($e.length > 0 && $e.trt().indexOf('0.00') > -1) {
                    throw 'Bot LIMITED!';
                }
                if ($accept.length > 0) {
                    await checkCoefs(data);
                    await delayPromise(990);
                    await mouseChain({target: $accept[0], events: fullClick, error: 'accept'});
                    await delayPromise(3000);
                    await checkSuccess(willPlace);
                } else if ($bss.length > 0) {
                    await mouseChain({target: $bss[0], events: fullClick, scroll: true, error: 'scs'});
                    await delayPromise(3000);
                }
                await delayPromise(500);
                const closeHelpers = async () => {
                    const closeHelp = 'div.helpboxheader div.helpboxheader-close-button';
                    await waitForElement(closeHelp, 250, 1000);
                    while ($(closeHelp).length > 0) {
                        await mouseChain({
                            target: $(closeHelp).eq(0)[0],
                            events: fullClick,
                            error: 'closeHelp'
                        });
                        await delayPromise(500);
                    }
                };
                const $myBets = await waitForElement('li.myBetsTab a', 300, 10000);
                if (!$myBets.closest('li').hasClass('active')) {
                    await mouseChain({target: $myBets[0], events: fullClick, error: 'myBets'});
                    await delayPromise(990);
                }
                await delayPromise(3000);
                const $slider = await waitForElement('div.sliding-menu:visible', 300, 10000);
                // Go to Open bets
                await $slider.find('a.menu-item-anchor').eachAsync(async function () {
                    const $this = $(this);
                    const text = $this.text().replace($this.find('sup.mybets-nav-counter').text(), '').trim();
                    if (text === (data[0].type !== 'LIVE' ? "Open" : "Live") && !$this.hasClass("selected")) {
                        await mouseChain({target: $this[0], events: fullClick, error: 'Slider', scroll: true});
                        await delayPromise(getRandomRounded(500, 4000));
                        await closeHelpers();
                        return false;
                    } else if (text === "Open") {
                        return false;
                    }
                });
                // Taking bet details
                const cRes = await collectBetResultsDo(1, [], true);
                dLog('green', 'GP', ['cRes is:', cRes]);
                //const $coupon = await waitForElement('div.my-bets-list-betslip-container ms-my-bets-betslip:first', 300, 10000);
                //const details = collectCouponData($coupon);
                if (!cRes || !cRes[0]) {
                    report(false, 'Something went wrong till collecting details!');
                } else {
                    // TODO: Add check for matches after expresses
                    report(true, cRes[0]);
                    delayPromise(500)
                        .then(() => goLive())
                        .catch(e => dLog('red', 'GP', `After bet: ${e}, ${e.stack}`));
                }
            })()
                .catch(e => report(false, 'Wait status: ' + e));
        };

        const clickAndCheck = function (selector) {
            return new Promise((onSuccess, onReject) => {
                let clicks = 0;
                const lets = function () {
                    clicks++;
                    console.log('%c' + 'clickAndCheck: ' + clicks + ' for "' + selector + '"',
                        'background: orange; color: blue; font-size: 14px; font-weight: normal');
                    let target = $(selector).get(0);
                    mouseChain({
                        target: target,
                        events: ['mouseover', 'mousedown', 'click', 'mouseup'],
                        scroll: true,
                        scrollTop: true
                    })
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(waitForNotConditionF(() => {
                            return $(selector).length > 0 && elementIsVisible($(selector)[0]);
                        }, 333, 3333, 'Not placed!'))
                        .then(onSuccess)
                        .catch(e => {
                            const $e = $('div.note:has(i.warning-color):contains("stake limit")');
                            if ($e.length > 0 && $e.trt().indexOf('0.00') > -1) {
                                onReject('Bot LIMITED!');
                            }
                            if (clicks <= 2) {
                                delayPromise(590)
                                    .then(() => delayPromise(990))
                                    .then(() => delayPromise(990))
                                    .then(lets);
                            } else {
                                onReject('Error click bet (' + clicks + '): ' + e);
                            }
                        });
                };
                lets();
            });
        };

        let loops = 0;
        let reChecks = 0;
        let afterEnterStakeStarted = 0;
        let afterEnterStake = function (willPlace) {
            // Hint: CHECK entered!
            let entered = parseFloat($('input.stake-input-value:visible').val());
            bsDebug(port, 'After enter stake check: willPlace = ' + parseFloat(willPlace) + ', entered: ' + entered);
            if (isNaN(entered) || parseFloat(willPlace) !== entered) {
                reChecks++;
                if (reChecks <= 3) {
                    delayPromise(990)
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => performExactBet(willPlace));
                    bsError(port, 'Entered !== willPlace - try to reenter!');
                } else {
                    report(false, 'Maybe we try to bet too few :(');
                }
                return;
            }
            const error = $('ms-numpad-error div.numpad-error:visible:first').trt();
            // Hint: CHECK errors
            const acceptSel = 'button.betslip-place-button:textEquals("Accept & place bet")';
            if ($(acceptSel).length > 0) {
                bsDebug(port, 'ReCheck coefs!');
                checkCoefs(data)
                    .then(delayFunction(990))
                    .then(() => mouseChain({
                        target: $(acceptSel)[0],
                        events: fullClick,
                    }))
                    .then(() => delayPromise(990))
                    .then(() => delayPromise(990))
                    .then(() => delayPromise(990))
                    .then(() => clickAndCheck('button.btn-success.betslip-place-button:visible'))
                    .then(delayFunction(777))
                    .then(() => checkSuccess(willPlace))
                    .catch((e) => report(false, 'Coefs changed: ' + e));
            } else if (error.indexOf('suspended') > -1) {
                report(false, 'We got errors: ' + error);
            } else if (error.indexOf('bet is too high') > -1) {
                const mArr = /below ([\d.]+),00 €/g.exec(error);
                if (mArr && typeof mArr[1] !== 'undefined') {
                    const max = mArr[1].replace('.', '').trim();
                    currentBetData.max = max;
                    mouseChain({target: $('button[name="close_error"]:visible')[0], events: ['click']})
                        .then(delayFunction(333))
                        .then(() => performExactBet(max))
                        .catch((e) => report(false, 'Max: ' + e));
                } else {
                    report(false, 'We got errors: ' + error);
                }
            } else if (error.length > 0) {
                report(false, 'We got errors: ' + error);
            } else if ($('button.btn-success.betslip-place-button:visible').length === 0) {
                if (loops <= 3) {
                    loops++;
                    delayPromise(990)
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => afterEnterStake(willPlace));
                } else {
                    report(false, 'No place button or button disabled (' + loops + ')!');
                }
            } else {
                delayPromise(990)
                    .then(() => clickAndCheck('button.btn-success.betslip-place-button'))
                    .then(delayFunction(777))
                    .then(() => checkSuccess(willPlace))
                    .catch((e) => report(false, 'Error during place bet ' + e));
            }
        };

        let performExactBet = function (willPlaceInput) {
            let willPlace = typeof willPlaceInput !== 'undefined' ? parseFloat(willPlaceInput) : parseFloat(data[0].stake);
            // Hint: Let's enter stake
            delayPromise(333)
                .then(() => clearAndSimulate($('input.stake-input-value:visible')[0], willPlace.toString().replace('.00', '')))
                .then(delayFunction(500))
                .then(() => {
                    console.log('%cSTAKE entered ' + willPlace, 'background: yellow; font-weight: bold;');
                    afterEnterStakeStarted = Date.now();
                    afterEnterStake(willPlace);
                })
                .catch((e) => report(false, 'Error during place bet ' + e));
        };

        let performCheckAndBet = function (max) {
            checkCoefs(data)
                .then(() => {
                    currentBetData.max = max;
                    let willPlace = parseFloat(data[0].stake);
                    if (max !== -1 && willPlace > max) {
                        willPlace = max;
                    }
                    let balance = getBalance();
                    if (isNaN(balance)) {
                        report(false, 'Get balance error');
                    } else if (balance < willPlace) {
                        report(false, 'NO_FUNDS - now: ' + balance + ', we need: ' + willPlace);
                    } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                        report(false, 'Undefined or NaN will place');
                    } else {
                        bsDebug(port, 'Will place (performBet): ' + willPlace + ', balance: ' + balance);
                        performExactBet(willPlace);
                    }
                })
                .catch((e) => report(false, 'Error till checkCoefs (' + 0 + '): ' + e));
        };

        let performBet = function () {
            openCoupon(data)
                .then(performCheckAndBet)
                .catch((e) => report(false, "Error during openCoupon! " + e));
        };

        closePreviousCoupons(ourCommand.getAdded('express') !== false)
            .then((p) => {
                bsDebug(port, p);
                performBet();
            })
            .catch((e) => report(false, 'Error till close coupons: ' + e));
    });


    const methods = {
        'BET': proceedBet,
        'EXPRESS_BET': proceedBet,
        'BET_RESULT': collectBetResults,
        'DEPOSIT': deposit,
        'WITHDRAW': withdraw,
        'CHECK_PAYMENTS': collectCheckPayments,
        'MAXIMUM': maximum
    };

    const collectResults = (data) => {
        console.log('%c' + 'collectResults',
            'background: orange; color: blue; font-size: 18px; font-weight: bold; padding: 10px; 20px;');
        console.log(data);
        let limit = data.limit || 1;
        let collected = data.collected || [];
        let processed = data.processed || [];
        let ids = !data.ids ? [] : data.ids;
        const renewCommand = () => {
            return new Promise((onSuccess) => {
                console.log('%c' + 'renewCommand',
                    'background: transparent; color: blue; font-size: 14px; font-weight: bold; padding: 1px;');
                chrome.storage.local.set({
                    'GAMEPARTY_WAIT_RESULT': Date.now(),
                    'GAMEPARTY_RESULT_DATA': {
                        limit: limit,
                        collected: collected,
                        processed: processed
                    }
                }, onSuccess);
            });
        };
        const report = (success, message) => {
            console.log('%c' + 'report: ' + success,
                'background: transparent; color: orange; font-size: 18px; font-weight: bold; padding: 10px 20px;');
            console.log(message);
            chrome.storage.local.set({
                'GAMEPARTY_BET_RESULT_WAS_SET': Date.now(),
                'GAMEPARTY_BET_RESULT': {
                    success: success,
                    message: message
                }
            });
            delayPromise(990)
                .then(() => delayPromise(990))
                .then(() => {
                    if (window.opener) {
                        window.close();
                    }
                });
        };
        const parseOne = ($one) => {
            const fullLink = $one.find('a[href^="/en/sports/bets/details/"]').attr('href')
                .replace('/en/sports/bets/details/', '');
            const $tds = $one.find('td');
            const stake = parseFloat($tds.eq(4).text().replace(/[^\d.]/g, '').trim());
            const result = parseFloat($tds.eq(6).text().replace(/[^\d.]/g, '').trim());
            let status = 'ACCEPTED';
            if ($tds.eq(6).find('span').hasClass('Won')) {
                status = 'WON';
            } else if (!isNaN(result) && result === stake) {
                status = 'REFUNDED';
            } else if ($tds.eq(6).find('span').trt() === '-') {
                status = 'LOSE';
            }
            return {
                external_id: fullLink.substr(0, fullLink.indexOf('?')),
                status: status,
                match: $tds.eq(3).find('div.mybets-bet-status__cell--market').first().trt(),
                bkPivot: $tds.eq(3).find('div.mybets-bet-status__cell--pick').first().trt(),
                coef: $tds.eq(5).trt(),
                stake: stake.toString(),
                result: isNaN(result) ? '0' : result.toString()
            };
        };
        const collectOne = () => {
            console.log('%c' + 'collectOne', 'background: purple; color: white; font-size: 15px; font-weight: bold; padding: 10px;');
            waitForElement('h5.mybets__details-title', 333, 40000, true)
                .then(() => {
                    const $getByName = (name) => $('div.mybets__details-row:has(div.mybets__details-cell--title:contains("'
                        + name + '")) div.mybets__details-cell--value');
                    const external_id = $getByName('Bet slip ID').trt();
                    const stake = parseFloat($getByName('Total stake').text().replace(/[^\d.]/g, '').trim());
                    const result = parseFloat($getByName('Net winnings').text().replace(/[^\d.]/g, '').trim());
                    let status = 'ACCEPTED';
                    const $we = $getByName('Net winnings');
                    if ($we.find('span').hasClass('Won')) {
                        status = 'WON';
                    } else if (!isNaN(result) && result === stake) {
                        status = 'REFUNDED';
                    } else if ($we.trt() === '-') {
                        status = 'LOSE';
                    }
                    const $bdt = $('#mybets-details-table tbody tr:first td');
                    if ((ids.length === 0 && collected.length < limit) || ids.indexOf(external_id) > -1) {
                        collected.push({
                            external_id: external_id,
                            status: status,
                            match: $bdt.eq(2).trt(),
                            bkPivot: $bdt.eq(3).trt() + ' ' + $bdt.eq(4).trt(),
                            coef: $bdt.eq(6).trt(),
                            stake: stake.toString(),
                            result: isNaN(result) ? '0' : result.toString()
                        });
                    }
                    if (processed.length >= limit) {
                        report(true, collected);
                    } else {
                        return renewCommand()
                            .then(() => mouseChain({
                                target: $('div.mybets__details-back-link:visible a')[0],
                                events: ['mouseover', 'mousedown', 'click', 'mouseup']
                            }))
                            // Hint: here we'll go to the bet's page
                            .then(() => delayPromise(990))
                            .then(() => delayPromise(990))
                            .then(() => delayPromise(990))
                            .then(() => delayPromise(990))
                            .then(() => delayPromise(990));
                    }
                })
                .catch(e => report(false, 'Collect one: ' + e));
        };
        let $el = [];
        waitForCondition(() => {
            const $one = $('div.sub-navigation li a.activeItem');
            const $two = $('div.menu li a.activeItem');
            $el = $one.length > 0 ? $one
                : $two.length > 0 ? $two : [];
            return $el.length > 0;
        }, 333, 30000, 'Where are we?')
            .then(() => {
                if ($el.trt() !== 'My Bets') {
                    return delayPromise(990)
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => mouseChain({
                            target: $el.closest('ul').find('a:contains("My Bets")')[0],
                            events: ['mouseover', 'mousedown', 'click', 'mouseup']
                        }))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990));
                }
            })
            .then(waitForCondition(() => {
                return $('div.mybets__details-back-link:visible').length > 0 || $('#my-bets-overview-table:visible').length > 0;
            }, 333, 30000, 'Strange place!', true))
            .then(delayFunction(990))
            .then(() => {
                console.log('%c' + '-= Collecting... =-', 'background: lightblue; color: green; font-size: 12px; font-weight: bold; padding: 4px 10px;');
                if ($('div.mybets__details-back-link:visible').length === 0) {
                    return waitForElement('#my-bets-overview-table', 333, 30000)
                        .then($el => {
                            let finishedByLimit = false;
                            $el.find('tbody tr').each(function () {
                                processed++;
                                const parsed = parseOne($(this));
                                if ((ids.length === 0 && collected.length < limit) || ids.indexOf(parsed.external_id) > -1) {
                                    collected.push(parsed);
                                } else if (ids.length === 0 && collected.length >= limit) {
                                    finishedByLimit = true;
                                    return false;
                                }
                            });
                            const $next = $('div.pagination:visible:first li.page-link a:last');
                            console.log('%c' + Math.ceil(processed / 10) + ' = '
                                + ($next.length > 0 && $next.attr('href') && $next.attr('href').indexOf('pageIndex=' + Math.ceil(processed / 10)) > -1),
                                'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                            if (finishedByLimit || (ids.length === 0 && collected.length >= limit)
                                || (ids.length > 0 && collected.length >= ids.length) || processed >= 30
                                || !($next.length > 0 && $next.attr('href') && $next.attr('href').indexOf('pageIndex=' + Math.ceil(processed / 10)) > -1)) {
                                report(true, collected);
                            } else {
                                // Hint: go next page
                                renewCommand()
                                    .then(() => mouseChain({target: $next[0], events: ['click']}));
                            }
                        });
                }
            })
            .catch(e => report(false, e));
    };

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<object,string>} jQuery element for bet
     */
    const getBetElement = data => new Promise(function (reportSuccess, reportReject) {

        //#-#-START
        let onSuccess = function ($d) {
            if (typeof $d[0] === 'undefined') {
                onReject('Bet inactive!');
            } else {
                console.log('%cSuccess: ' + $d.find('div.value').trt(), 'background: green;');
                $d[0].scrollIntoView(true);
                reportSuccess($d);
            }
        };

        let onReject = function (d) {
            console.log('%cReject', 'background: red;');
            console.log(d);
            reportReject(d);
        };

        let eventName = (() => {
            const $name = $('div.participant-name-value');
            return $name.eq(0).text().replace($name.eq(0).find('span.participant-country').text(), '').replace('FC', '').trim() + ' v '
                + $name.eq(1).text().replace($name.eq(1).find('span.participant-country').text(), '').replace('FC', '').trim();
        })();

        let teams = eventName.split(' v ');
        if (teams.length === 2) {
            data.team1 = teams[0].toLowerCase();
            data.team2 = teams[1].toLowerCase();
            data.team1b = teams[0];
            data.team2b = teams[1];
        } else {
            onReject('No teams!');
            return;
        }

        let markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Match Result'],
                    pivotKeys: ['#TEAM1B#', '#TEAM1B# FC', 'FC #TEAM1B#', '#SHORT_NAME_1#', '#LAST_NAME_1#', '#TEAM1B# (e-volleyball)']
                },
                'TWO': {
                    roots: ['Match Result'],
                    pivotKeys: ['#TEAM2B#', '#TEAM2B# FC', 'FC #TEAM2B#', '#SHORT_NAME_2#', '#LAST_NAME_2#', '#TEAM2B# (e-volleyball)']
                },
                'DRAW': {
                    roots: ['Match Result'],
                    pivotKeys: ['X']
                },
                'ONE_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1B# or X', '#TEAM1B# FC or X', 'FC #TEAM1B# or X']
                },
                'TWO_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['X or #TEAM2B#', 'X or #TEAM2B# FC', 'X or FC #TEAM2B#']
                },
                'ONE_TWO': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1B# or #TEAM2B#', '#TEAM1B# FC or #TEAM2B# FC', 'FC #TEAM1B# or FC #TEAM2B#']
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['Over/Under Total Goals', 'Total Goals - Over/Under'],
                    pivotKeys: ['Over #PIVOT#', 'Over #PIVOTR#', 'Over #PIVOTR2#']
                },
                'UNDER': {
                    roots: ['Over/Under Total Goals', 'Total Goals - Over/Under'],
                    pivotKeys: ['Under #PIVOT#', 'Under #PIVOTR#', 'Under #PIVOTR2#']
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['Total Goals O/U - Team 1'],
                    pivotKeys: ['Over #PIVOT#', 'Over #PIVOTR#', 'Over #PIVOTR2#']
                },
                'UNDER': {
                    roots: ['Total Goals O/U - Team 1'],
                    pivotKeys: ['Under #PIVOT#', 'Under #PIVOTR#', 'Under #PIVOTR2#']
                }
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['Total Goals O/U - Team 2'],
                    pivotKeys: ['Over #PIVOT#', 'Over #PIVOTR#', 'Over #PIVOTR2#']
                },
                'UNDER': {
                    roots: ['Total Goals O/U - Team 2'],
                    pivotKeys: ['Under #PIVOT#', 'Under #PIVOTR#', 'Under #PIVOTR2#']
                }
            },
            'CORNER_TOTAL': {
                'OVER': {
                    superRoots: ['Number of corners'],
                    roots: ['Over/Under Total Corners'],
                    pivotKeys: ['Over #PIVOT#', 'Over #PIVOTR#', 'Over #PIVOTR2#']
                },
                'UNDER': {
                    superRoots: ['Number of corners'],
                    roots: ['Over/Under Total Corners'],
                    pivotKeys: ['Under #PIVOT#', 'Under #PIVOTR#', 'Under #PIVOTR2#']
                },
            },
            'HDP': {
                'HOME': {
                    roots: ['Handicap (regular time)'],
                    pivotKeys: ['#TEAM1B# #PIVOTR2#', '#TEAM1B# #PIVOTR#', '#TEAM1B# #PIVOTH#', '#TEAM1B# #PIVOTZ#', '#TEAM1B# #PIVOT#'],
                },
                'AWAY': {
                    roots: ['Handicap (regular time)'],
                    pivotKeys: ['#TEAM2B# #PIVOTR2#', '#TEAM2B# #PIVOTR#', '#TEAM2B# #PIVOTH#', '#TEAM2B# #PIVOTZ#', '#TEAM2B# #PIVOT#'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    roots: ['Handicap #PIVOTH#'],
                    pivotKeys: ['#TEAM1B#', 'FC #TEAM1B#', '#TEAM1B# FC']
                },
                'H2': {
                    roots: ['Handicap #PIVOTH#'],
                    pivotKeys: ['#TEAM2B#', 'FC #TEAM2B#', '#TEAM2B# FC']
                },
                'HX': {
                    roots: ['Handicap #PIVOTH#'],
                    pivotKeys: ['X']
                }
            },
        };

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            onReject('Unsupported ' + data.time_value + '/' + data.market + '/' + data.target);
            return;
        }

        let specialPivotFormatter = function (market, pivot) {
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
                    if (parseFloat(data.pivot) === 0) {
                        res = (data.pivot.toString().indexOf('-') > -1 ? '-' : '+') + round(fp, 2).toFixed(2).toString();
                    } else {
                        res = (fp > 0 ? '+' : '') + round(fp, 2).toFixed(2).toString();
                    }
                }
            }
            return res.replace('.', ',');
        };

        let specialPivotZFormatter = function () {
            function round(value, precision) {
                let multiplier = Math.pow(10, precision || 0);
                return Math.round(value * multiplier) / multiplier;
            }

            let fp = parseFloat(typeof data.pivot !== 'undefined' ? data.pivot.toString() : '');
            let res = 'XXCCVVZ';
            if (!isNaN(fp)) {
                if (fp === 0) {
                    res = '' + round(fp, 1).toFixed(1).toString().replace('.0', '');
                } else {
                    res = (fp > 0 ? '+' : '') + round(fp, 1).toFixed(1).toString().replace('.0', '');
                }
            }
            //bsDebug(port, 'specialPivotZFormatter: ' + data.pivot + ' / ' + fp + ' / ' + res);
            return res.replace('.', ',');
        };

        const specialEuroHDPFormatter = () => {
            const over = parseFloat(data.pivot) > 0;
            const p = Math.abs(parseFloat(data.pivot)).toFixed(0).toString();
            if (over) {
                return data.target === 'H2' ? p + ':0' : '0:' + p;
            } else {
                return data.target === 'H2' ? '0:' + p : p + ':0';
            }
        };

        const lastname = name => {
            const parts = name.split(' ');
            if (parts.length !== 2) {
                return name;
            } else {
                parts[0] = parts[0].substr(0, 1) + '.';
                return parts[1];
            }
        };

        const shortname = name => {
            const parts = name.split(' ');
            if (parts.length === 0) {
                return name;
            } else {
                parts[0] = parts[0].substr(0, 1) + '.';
                return parts.join(' ');
            }
        };

        let replaceInner = function (element, parent, index) {
            if (typeof element === 'string') {
                parent[index] = element.replace('#TEAM1#', data.team1).replace('#TEAM2#', data.team2)
                    .replace('#TEAM1B#', data.team1b)
                    .replace('#TEAM2B#', data.team2b)
                    .replace('#PIVOT#', data.pivot)
                    .replace('#PIVOTR#', specialPivotFormatter(data.market, data.pivot))
                    .replace('#PIVOTR2#', specialPivotFormatter(data.market, data.pivot, true))
                    .replace('#PIVOTZ#', specialPivotZFormatter())
                    .replace('#PIVOTH#', specialEuroHDPFormatter())
                    .replace('#SHORT_NAME_1#', shortname(data.team1b))
                    .replace('#SHORT_NAME_2#', shortname(data.team2b))
                    .replace('#LAST_NAME_1#', lastname(data.team1b))
                    .replace('#LAST_NAME_2#', lastname(data.team2b));
            } else if (typeof element === 'object') {
                for (let i in element) {
                    replaceInner(element[i], element, i);
                }
            } else {
                // console.log(typeof element + ' not supported! (' + element + ')');
            }
        };
        replaceInner(markets, null, null);

        let getRootParams = function () {
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
            if (data.sport === 'FOOTBALL' && data.time_value === 'HALF_TIME') {
                // Time
                replacements.push({from: 'Double Chance', to: 'Half Time Double Chance'});
                // Total
                replacements.push({from: 'Total Goals - Over/Under', to: 'Total Goals O/U - 1st Half'});
                replacements.push({
                    from: 'Total Goals O/U - Team 1',
                    to: 'Team 1 1st Half Total Goals ' + data.pivot.replace('.', ',')
                });
                replacements.push({
                    from: 'Total Goals O/U - Team 2',
                    to: 'Team 2 1st Half Total Goals ' + data.pivot.replace('.', ',')
                });
                // HDP
                needRemove.push('Handicap ' + specialEuroHDPFormatter());
            } else if (data.sport === 'BASKETBALL') {
                replacements.push({from: 'Match Result', to: 'Money Line (US)'});
            } else if (data.sport === 'TENNIS') {
                if (data.time_value === 'FULL_MATCH') {
                    replacements.push({from: 'Match Result', to: 'Match Winner'});
                } else if (data.time_value.indexOf('_GAME_') > -1) {
                    const parts = data.time_value.split('_GAME_');
                    if (parts.length !== 2) {
                        throw  `Wrong time_value! ${data.time_value}`;
                    }
                    const set = parts[0].replace(/[^\d]/g, '');
                    replacements.push({from: 'Match Result', to: `Game ${parts[1]} Winner, Set ${set}`});
                } else {
                    replacements.push({
                        from: 'Match Result',
                        to: 'Set ' + data.time_value.replace(/[^\d]/g, '') + ' Winner'
                    });
                }
            } else if (data.sport === 'TABLETENNIS') {
                replacements.push({from: 'Match Result', to: '2Way - Who will win?'});
            } else if (data.sport === 'HOCKEY') {
                replacements.push({from: 'Match Result', to: '2Way - result incl. O/T'});
                replacements.push({from: 'Over/Under Total Goals', to: 'Totals (incl. O/T)'});
                replacements.push({from: 'Over/Under Total Goals', to: 'Handicap (regular time)'});
                if (data.market === 'TOTAL') {
                    needAddTo.push('Totals (regular time)');
                }
            } else if (data.sport === 'VOLLEYBALL') {
                const set = data.time_value.replace(/[^\d]/g, '');
                if (data.time_value === 'FULL_MATCH') {
                    replacements.push({from: 'Match Result', to: '2Way - Who will win?'});
                    replacements.push({
                        from: 'Over/Under Total Goals',
                        to: 'How many points will be scored in total?'
                    });
                    replacements.push({
                        from: 'Total Goals O/U - Team 1',
                        to: 'How many points will Team 1 score?'
                    });
                    replacements.push({
                        from: 'Total Goals O/U - Team 2',
                        to: 'How many points will Team 2 score?'
                    });
                } else {
                    replacements.push({
                        from: 'Match Result',
                        to: 'Which team will win the ' + set + 'rd set?'
                    });
                    replacements.push({
                        from: 'Over/Under Total Goals',
                        to: 'How many points will be scored in the ' + set + 'rd set?'
                    });
                    replacements.push({
                        from: 'Total Goals O/U - Team 1',
                        to: 'How many points will team 1 score in the ' + set + 'rd set?'
                    });
                    replacements.push({
                        from: 'Total Goals O/U - Team 2',
                        to: 'How many points will team 2 score in the ' + set + 'rd set?'
                    });
                }
                replacements.push({from: 'Handicap (regular time)', to: 'Total Points Handicap'});
            } else if (data.sport === 'BASEBALL') {

            } else if (data.sport === 'CYBERSPORT') {

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

        marketsModifierWrapper(data, 'roots', getRootParams(), markets);

        let finalPrepareForMarket = function (market) {
            market.rootsLC = market.roots.map(v => v.toLowerCase());
            market.subroots = data.time_value === "FULL_TIME" ? ['Regular Time'] : ['1st Half'];
            return market;
        };

        let market = finalPrepareForMarket(markets[data.market][data.target]);

        console.log('%cFinal market is:', 'background: green; color: white; font-weight: bold;');
        console.log(market);

        const expandRoots = () => new Promise((onSuccess, onReject) => {
            const expandOne = function (current) {
                const selectSubroot = async $root => {
                    const mainSel = 'ms-scroll-adapter.scroll-adapter';
                    const subSel = 'ul.tab-bar-container';
                    if ($root.find(mainSel).length > 0 && market.subroots &&
                        $root.find(`${mainSel} ${subSel} li.active`)
                            .trt() !== market.subroots[0]) {
                        await mouseChain({
                            target: $root.find(`${mainSel} ${subSel} li:textEquals(${market.subroots[0]}) a`)[0],
                            events: fullClick,
                            error: 'SubRoot open'
                        });
                    }
                };
                if (typeof market.roots[current] !== 'string') {
                    onSuccess('All must be expanded!')
                } else {
                    const $root = $(`ms-option-panel:has(div:textEquals("${market.roots[current]}"))`);
                    console.log('%c' + 'Root selector is: ' + `ms-option-panel:has(div:textEquals("${market.roots[current]}"))`,
                        'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    console.log($root);
                    if ($root.length > 0 && $root.find("span.theme-down").length > 0) {
                        mouseChain({
                            target: $root.find("span.theme-down")[0],
                            events: fullClick,
                            error: 'Open Root'
                        })
                            .then(delayFunction(1000))
                            .then(() => selectSubroot($root))
                            .then(() => expandOne(++current))
                            .catch(e => onReject(`Can't expand roots: ${e}`));
                    } else {
                        selectSubroot($root)
                            .then(() => expandOne(++current));
                    }
                }
            };
            expandOne(0);
        });

        const performGet = () => {
            let currentRoot = -1;
            const lookForPivot = $candidate => {
                console.log('%c' + 'lookForPivot in:', 'background: green; color: white; font-weight: bold;');
                console.log($candidate);
                let found = false;
                for (let p of market.pivotKeys) {
                    $candidate.find('ms-event-pick.option-pick').each(function () {
                        const $this = $(this);
                        let hcap = $this.find('div.name').trt();
                        console.log('"' + hcap + '" === "' + p + '"');
                        if (hcap === p) {
                            found = true;
                            onSuccess($this);
                            return false;
                        }
                    });
                    if (found) {
                        break;
                    }
                }
                return found;
            };
            const checkRoot = $candidate => {
                $candidate[0].scrollIntoView();
                return lookForPivot($candidate);
            };
            const nextRoot = () => {
                const checkOne = ($candidate, callback) => {
                    delayPromise(777)
                        .then(() => checkRoot($candidate))
                        .then((found) => {
                            if (!found) {
                                callback();
                            }
                        })
                        .catch((e) => onReject('Checking root: ' + e));
                };
                currentRoot++;
                console.log('%c' + 'WHAT!!!', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                console.log(market);
                if (currentRoot >= market.roots.length) {
                    onReject('Root not found 1-1 :(');
                } else {
                    console.log('Checking: ' + market.roots[currentRoot],
                        `ms-option-panel:has(div:textEquals("${market.roots[currentRoot]}"))`);
                    let $candidate = $(`ms-option-panel:has(div:textEquals("${market.roots[currentRoot]}"))`);
                    if ($candidate.length === 1) {
                        checkOne($candidate, nextRoot);
                    } else if ($candidate.length > 1) {
                        let currentCandidate = -1;
                        const checkCandidate = () => {
                            currentCandidate++;
                            if ($candidate.length > currentCandidate) {
                                checkOne($candidate.eq(currentCandidate), checkCandidate);
                            } else {
                                nextRoot();
                            }
                        };
                        checkCandidate();
                    } else if ($candidate.length === 0) {
                        nextRoot();
                    }
                }
            };
            const goSuperRoot = async () => {
                if (market.superRoots) {
                    const $one = $(`ms-dropdown-tab-bar a:has(span.title:textEquals("${market.superRoots[0]}"))`);
                    if ($one.length > 0) {
                        await mouseChain({target: $one[0], events: fullClick, error: '$all 123'});
                        await delayPromise(1000);
                    } else {
                        const $sel = $(`ms-dropdown-tab-bar select:has(option:textEquals("${market.superRoots[0]}"))`);
                        if ($sel.length === 0) {
                            throw `No super root: ${market.superRoots[0]}!`;
                        }
                        await selectLikePuppeteer($sel[0], [$sel.find(`option:textEquals("${market.superRoots[0]}")`).val()]);
                        await delayPromise(1000);
                    }
                } else {
                    const $all = $('ms-dropdown-tab-bar a:has(span.title:textEquals("All"))');
                    if ($all.length > 0 && !$all.parent().hasClass('active')) {
                        await mouseChain({target: $all[0], events: fullClick, error: '$all 123'});
                        await delayPromise(1000);
                    }
                }
            };
            if (market.roots && market.roots.length > 0) {
                goSuperRoot()
                    .then(() => expandRoots())
                    .then(nextRoot)
                    .catch(e => onReject('expandRoots: ' + e));
            } else {
                nextRoot();
            }
        };
        waitForElement('ms-option-panel', 250, 5000)
            .then(() => performGet());
        //#-#-FINISH
    });

    /**
     * Close early opened coupons
     * @param skipParam [{boolean}] default FALSE - whether we need to skip closing
     * @returns {Promise<string,string>}
     */
    const closePreviousCoupons = skipParam => new Promise(function (onSuccessOut, onReject) {
        const skip = typeof skipParam === 'undefined' ? false : skipParam;
        if (skip) {
            //bsDebug(port, 'closePreviousCoupons - SKIP');
            onSuccessOut('skipped!');
            return;
        } else {
            //bsDebug(port, 'closePreviousCoupons - WORK');
        }
        const onSuccess = function (message) {
            onSuccessOut(message);
        };
        const removeStakes = function () {
            const closeOne = function () {
                let $closes = $('div.remove-button:visible');
                if ($closes.length > 0) {
                    mouseChain({target: $closes[0], events: ['click'], scroll: true})
                        .then(delayFunction(500))
                        .then(closeOne)
                        .catch((e) => onReject('Error till close: ' + e));
                } else {
                    onSuccess('All were closed!');
                }
            };
            closeOne();
        };
        removeStakes();
    });

    const goLive = async doNotCheck => {
        if (bkHere === 'partypoker') {
            if (doNotCheck || document.location.href.indexOf('/en/sports/live/betting') === -1) {
                await clickSequence([
                    new QueueObject('a[href$="/en/sports"]'),
                    new QueueObject('a[href$="/en/sports/live/betting"]'),
                    new QueueObject('div.grid-footer a.ms-active-highlight', null, null, false, 0, true),
                ]);
            }
        } else {
            await waitForElement('div.navbar-nav', 333, 30000);
            const pnAi = $('div.navbar-nav vn-menu-item.active').trt();
            if (document.location.href.indexOf('.ru/') > -1 && (pnAi !== 'Live' || doNotCheck)) {
                await mouseChain({
                    target: $('a.navi-promo-link')[0],
                    events: fullClick,
                    error: 'Live RU',
                    scroll: true
                });
                await delayFunction(990)();
            } else if ((document.location.href.indexOf('.ru/') === -1
                && (pnAi !== 'Live' && pnAi !== 'Live Betting') || doNotCheck) ||
                document.location.href.indexOf('/sports/my-bets/') > -1) {
                await mouseChain({
                    target: $(findSel(['nav#sports-nav a:contains("Live")',
                        'div.navbar-nav a:contains("Live Betting")']))[0],
                    events: fullClick,
                    error: 'Live',
                    scroll: true
                });
                await delayFunction(990)();
            }
        }
        dLog('green', 'GP', `We should be on live!`);
    };

    /**
     * Open event table, if we're on it already -  onSuccess
     * @param {object} data
     * @returns {Promise<any>}
     */
    const openEvent = data => new Promise(function (onSuccess, onReject) {
        //bsDebug(port, 'openEvent', data);
        const team1 = data.team1.toLowerCase();
        const team2 = data.team2.toLowerCase();
        const eventName = team1 + ' v ' + team2;
        const sport = typeof sportAccordance[data.sport] === 'undefined' ? '' : sportAccordance[data.sport];
        if (sport === '') {
            onReject('Sport ' + data.sport + ' not supported or presented :(');
        }
        const checkScore = () => new Promise(function (onSuccess, onReject) {
            if (data.score === '' || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1
                || ['TENNIS', 'TABLETENNIS', 'HOCKEY', 'VOLLEYBALL', 'CYBERSPORT'].indexOf(data.sport) > -1) {
                delayPromise(990)
                    .then(() => delayPromise(990))
                    .then(() => onSuccess(''));
            } else {
                const sels = ['div.total-points', 'div.event-score span.score-counter div:first-child'];
                waitForElement(() => {
                    const res = sels.find(sel => $(sel).length > 0);
                    return res ? $(res) : $([]);
                }, 333, 30000, true)
                    .then(($tvt) => {
                        const score = $tvt.eq(0).trt() + ':' + $tvt.eq(1).trt();
                        //console.log(score);
                        if (score === data.score.replace(/[^\d:]/g, '').trim()) {
                            onSuccess('');
                        } else {
                            onReject('SCORE_CHANGED! We have: ' + score + ', we need: ' + data.score);
                        }
                    })
                    .catch(e => onReject('Check score: ' + e));
            }
        });
        let result = function (status, message) {
            if (status) {
                waitForCondition(() => checkWeAreThere(), 777, 30000,
                    'It looks like we are not there!')
                    .then(checkScore)
                    .then(async () => {
                        // We should not open all markets all the time, maybe?
                        const allSel = 'ms-dropdown-tab-bar ul.tab-bar-container li:textEquals("All") a';
                        if ($('ms-dropdown-tab-bar ul.tab-bar-container li.active').trt() !== 'All'
                            && $(allSel).length > 0) {
                            await mouseChain({
                                target: $(allSel)[0],
                                events: fullClick,
                                error: 'All markets'
                            });
                            await delayPromise(990);
                        }
                    })
                    .then(() => onSuccess())
                    .catch((e) => onReject(e));
            } else {
                onReject(message);
            }
        };
        const checkWeAreThere = function () {
            //bsDebug(port, 'checkWeAreThere');
            const $name = $('div.participant-name-value');
            const icon = ($name.eq(0).text().replace($name.eq(0)
                    .find('span.participant-country').text(), '').replace('FC', '').trim()
                + ' v '
                + $name.eq(1).text().replace($name.eq(1)
                    .find('span.participant-country').text(), '').replace('FC', '').trim()).toLowerCase();
            if (data.bk_event_native_id) {
                if (document.location.href.indexOf(`-${data.bk_event_native_id}`) > -1) {
                    const teams = icon.split(' v ');
                    data.team1 = teams[0].trim();
                    data.team2 = teams[1].trim();
                    return true;
                }
            } else {
                return ($name.length === 2
                    && (icon === eventName || locutus_similar_text(icon, eventName, true) > 70));
            }
        };
        const findEvent = async () => {
            console.clear();
            console.log('%c' + 'Find event: ' + (data.bk_event_native_id ? data.bk_event_native_id : eventName), 'background: pink; padding: 20px;');
            await waitForElementF('ms-event-name', 333, 15000)();
            await delayFunction(990)();
            await delayFunction(500)();
            const $more = $('a.load-more-button:visible');
            if ($more.length > 0) {
                await mouseChain({target: $more[0], events: fullClick, scroll: true});
                console.log('Clicked load more!');
                await delayFunction(990)();
                await delayFunction(990)();
                await delayFunction(990)();
            }
            let $el = [];
            $('ms-event-name').each(function () {
                if (data.bk_event_native_id) {
                    if ($(this).closest('a').attr('href').indexOf(`-${data.bk_event_native_id}`) > -1) {
                        $el = $(this);
                        return false;
                    }
                } else {
                    const $selns = $(this).find('div.participant-container');
                    const checkEvent = ($selns.eq(0).text().replace($selns.eq(0).find('span.participant-country')
                        .trt(), '').trim() + ' v ' + $selns.eq(1).text().replace($selns.eq(1).find('span.participant-country')
                        .trt(), '').trim()).toLowerCase();
                    console.log('%c' + '"' + checkEvent + ' === ' + '"' + eventName + '"',
                        'background: transparent; color: blue; font-size: 13px; font-weight: bold; padding: 3px;');
                    if (checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70) {
                        $el = $(this);
                        return false;
                    }
                }
            });
            if ($el.length === 1) {
                await mouseChain({target: $el[0], events: ['click'], scroll: true});
            } else {
                throw 'Wrong length of Event: ' + $el.length;
            }
            return 'We should be in event';
        };
        const goRightPage = async () => {
            await goLive();
            // Hint: Choose way to go
            const allSel = 'ms-tab-bar.region-navigation li:has(span.title:textEquals("ALL")) a';
            const sequence = [
                new QueueObject('div.scroll-adapter__content ul.tab-bar-container:first',
                    $el => $el.find('li.active').trt() !== 'Overview',
                    $el => $el.find('li a:contains("Overview")'),
                    false, bkHere === 'partypoker' ? 3000 : 30000, true, true),
                new QueueObject('ms-tab-bar.sport-navigation',
                    $el => $el.find('li.active').trt() !== sport,
                    $el => $('ms-tab-bar.sport-navigation li:has(span.title:textEquals("' + sport + '")) a'),
                    false, 30000, true, true),
                new QueueObject('ms-tab-bar.region-navigation li.active',
                    $el => $el.trt() !== 'ALL' && $(allSel).length > 0,
                    $el => $(allSel),
                    false, 1500, true, true),
                new QueueObject('div.sort-toggle div.active',
                    $el => $el.trt() !== 'Time',
                    $el => $('div.sort-toggle div:textEquals("Time")'),
                    false, 1500, true, true)
            ];
            await clickSequence(sequence, 1000);
        };
        if (!checkWeAreThere()) {
            bsDebug(port, `We're not on event - let's go there!`);
            goRightPage()
                .then(() => findEvent())
                .then(m => result(true, m))
                .catch(e => result(false, 'findEvent 1:' + e));
        } else {
            result(true, 'We probably on event page!');
        }
    });

    /**
     * Checks coefs into the coupon
     * @param data
     * @returns {Promise<string,string>}
     */
    const checkCoefs = data => new Promise(function (onSuccess, onReject) {
        /*EST TOP START
        (function (data) {
            console.log(data);
            let onSuccess = function (m) {
                console.log('Success: ' + m);
            };
            let onReject = function (m) {
                console.log('Reject: ' + m);
            };
            //TEST TOP FINISH */
        let checkCoupon = () => new Promise(function (onSuccess, onReject) {
            let findInData = function (match) {
                let result = false;
                $.each(data, function () {
                    const localMatch = this.team1.toLowerCase() + ' - ' + this.team2.toLowerCase();
                    if (localMatch === match || locutus_similar_text(localMatch, match, true) > 60) {
                        result = this;
                        return false;
                    }
                });
                return result;
            };
            let $coupons = $('#betslip div[class="pick-content"]:visible');
            let errors = [];
            let checked = 0;
            let totalCoef = 1;
            $coupons.each(function () {
                const $this = $(this);
                const match = $this.find('span.event-name').trt().toLowerCase();
                if ($this.hasClass('slipError') || $this.text().indexOf('Bet Suspended') > -1) {
                    errors.push(match + ' LOW_COEF, market unavailable!');
                    checked++;
                    return true;
                }
                const localCoef = decOdds($this.find('div.odds-wrapper').trt());
                let localData = findInData(match);
                totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
                if (!newAPI && localData && localData.coef !== '' && !isNaN(localCoef)) {
                    console.log('%c' + `${localCoef}/${totalCoef}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    let checkCoef = parseFloat(localData.coef);
                    if (isNaN(checkCoef)) {
                        errors.push(match + ' wrong coef: ' + localData.coef);
                    } else if (checkCoef > localCoef) {
                        errors.push(match + ' LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef);
                    } else if (localCoef >= checkCoef * 1.2) {
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
                onSuccess('Coefs fine!');
            } else if (newAPI && errors.length === 0 && checked === data.length) {
                const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
                console.log('%c' + `CHECK NEW API: we have: ${totalCoef}, we need: ${nCheck}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                if (totalCoef >= nCheck * 1.2) {
                    onReject('Coef TOO BIG: ' + totalCoef + ' instead of ' + data[0].coef);
                } else if (totalCoef < nCheck) {
                    onReject('LOW_COEF ' + data[0].coef + ' > ' + totalCoef);
                } else {
                    onSuccess('Coefs fine!');
                }
            } else {
                onReject(errors.join('; ') + (checked !== data.length ? ' some stakes not checked ('
                    + checked + '/' + data.length + ')!' : ''));
            }
        });
        checkCoupon()
            .then((m) => onSuccess(m))
            .catch((e) => onReject(e));
        /* TEST BOTTOM START
    })([
        {team1: 'Deportivo Santani', team2: 'Club Guarani', coef: '1.54'},
        {team1: 'Rionegro Aguilas SA', team2: 'Independiente Medellin', coef: '1.7'}
    ]);
    //TEST BOTTOM FINISH */
    });

    /**
     * Opens coupon with stake (stakes)
     * @param {object[]} paramData - array of bets to open
     * @returns {Promise<float, string>}
     */
    const openCoupon = paramData => new Promise(function (onSuccess, onReject) {
        bsDebug(port, 'openCoupon, paramData:', paramData);
        const result = function (success, message) {
            if (success) {
                if (lData.length > 0) {
                    ourCommand.add('express', ourCommand.getAdded('express') + 1);
                    data = paramData[ourCommand.getAdded('express')];
                    if (typeof data !== 'undefined') {
                        bsDebug(port, 'openCoupon - We got data: ' + (typeof data), data);
                        openElement();
                    } else {
                        // Hint: For doubles we haven't max :(
                        onSuccess(777777777);
                    }
                } else {
                    // Hint: maybe I'll find maxes later...
                    onSuccess(777777777);
                }
            } else {
                bsError(port, message);
                onReject(message);
            }
        };
        const checkCoupon = () => new Promise((onSuccess, onReject) => {
            let event = (data.team1 + ' - ' + data.team2).toLowerCase();
            let result = false;
            let matches = [];
            waitForElement('#betslip div[class="pick-content"]', 333, 15000)
                .then(waitForCondition(() => {
                    return $('#betslip div[class="pick-content"]:visible').length >=
                        (ourCommand.getAdded('express') === false ? 1 : 2);
                }, 400, 15000, 'Wrong length of events in coupon!', true))
                .then(delayFunction(400))
                .then(() => {
                    const $evts = $('#betslip div[class="pick-content"]:visible');
                    $evts.each(function () {
                        const $this = $(this);
                        const teams = $this.find('span.event-name').trt().toLowerCase();
                        matches.push(teams);
                        const check = event === teams || locutus_similar_text(event, teams, true) > 60;
                        console.log('%c' + $evts.length + ' ' + event + ' === ' + teams + ' ? ' + check,
                            'background: transparent; color: green; font-size: 13px; font-weight: bold; padding: 5px;');
                        if (check) {
                            onSuccess($(this).closest('td.single-items'));
                            result = true;
                            return false;
                        }
                    });
                    if (!result) {
                        throw 'Wrong match opened: ' + matches.join(', ');
                    }
                })
                .catch(e => onReject('checkCoupon ' + e));
        });

        let lData = paramData.slice();
        let data = {};
        let openElement = async () => {
            await openEvent(data);
            dLog('green', 'GB', 'Event must be opened!');
            const $betElement = await getBetElement(data);
            dLog('red', 'GB', `We got ${$betElement.find('div.value').trt()}`);
            await mouseChain({
                target: $betElement.find('div:first')[0],
                events: fullClick,
                error: "BetC"
            });
            const $el = await waitForElement('#betslip', 333, 20000);
            $el[0].scrollIntoView();
            await checkCoupon();
        };
        if (ourCommand.getAdded('express') !== false) {
            data = paramData[ourCommand.getAdded('express')];
        } else {
            data = lData.shift();
        }
        if (typeof data !== 'undefined') {
            bsDebug(port, 'openCoupon - basic - We got data: ' + (typeof data), data);
            openElement()
                .then(() => result(true, 'Max collect later...'))
                .catch((e) => result(false, 'Error till: ' + e));
        } else {
            onReject('There is no input data!');
        }
    });

    const switchToDecimals = async () => {
        await mouseChain({target: $('div.avatar-icon')[0], events: fullClick, error: 'DAI'});
        for (const ct of ['My Account', 'Settings', 'Betting Settings', 'Odds display']) {
            await delayPromise(500);
            const $ma = await waitForElement(`a.menu-item-link:textEquals("${ct}"):visible`,
                333, 3000);
            await mouseChain({target: $ma[0], events: fullClick, error: `Click ${ct}`});
        }
        await delayPromise(500);
        const $leu = await waitForElement('label[for="EU"]', 333, 10000);
        await delayPromise(500);
        await mouseChain({target: $leu[0], events: fullClick, error: '$leu'});
        await delayPromise(2500);
        await mouseChain({
            target: $('button:textEquals("Save")')[0],
            events: fullClick, error: 'Save'
        });
        await delayPromise(2500);
        await goLive(true);
    };

    const authCheck = function () {
        //dLog('', 'GB', `Auth check!`);
        if (enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            bsError(port, 'ERROR AUTH!');
            return;
        }
        (async () => {
            const $cOk = $('div.cookie-consent-message a.btn');
            if ($cOk.length > 0) {
                await mouseChain({target: $cOk[0], events: fullClick, error: '$cOk'});
            }
            if ($('div.error-header:contains("Service Connection Lost")').length > 0) {
                chrome.runtime.sendMessage({closeTabByPartOfUrl: document.location.href}, r => {
                    const error = chrome.runtime.lastError;
                });
            }
            if (settings.removeMedia) {
                const $media = $('#media-container');
                if ($media.length > 0) {
                    $media.remove();
                }
            }
            for (const sel of [
                'span.info-message-close:visible',
                '#post-login-reminder:visible a',
                'div.fullscreen-promo-banner span.ui-icon:visible',
                'button:textEquals("Accept All Cookies")']) {
                if ($(sel).length > 0) {
                    await mouseChain({target: $(sel)[0], events: fullClick})
                        .catch(e => console.log('%c' + `${sel} click error ${e}!`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'));
                }
            }
            const langSel = 'div.dropdown-toggle-group span.lang-label';
            if ($(langSel).length > 0 && $(langSel).trt() !== 'English') {
                await mouseChain({
                    target: $('div.dropdown-toggle-group')[0],
                    events: fullClick,
                    error: 'Lang 1'
                });
                await delayPromise(990);
                const $el = await waitForElement('a.language-switcher-item:has(span.lang-label:contains("English"))', 333, 10000);
                await mouseChain({target: $el[0], events: fullClick, error: 'Lang 2'});
                await delayPromise(990);
            }
            const logSels = ['a.menu-item-link:textEquals("Log in"):visible'];
            if (!limited && logSels.some(s => $(s).length > 0)) {
                port.postMessage({m: "tech works! 2"});
                await mouseChain({target: $(logSels.find(s => $(s).length > 0))[0], events: fullClick});
                await delayPromise(990);
                await tryToLogIn();
            } else {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch(e => console.log('%c' + `authCheck: ${e}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const tryToLogIn = async () => {
        authClickedCount++;

        if (authClickedCount > 3) {
            limited = true;
            return true;
        } else {
            const sels = ['#username:visible', '#password:visible'];
            if (sels.some(s => $(s).length !== 1)) {
                throw 'No inputs!';
            }
            if (Date.now() - authClicked < 60000) {
                throw 'Too soon!';
            }
            for (const sel of sels) {
                await delayPromise(990);
                await delayPromise(990);
                await delayPromise(990);
                const $el = $(sel).is('input') ? $(sel) : $(sel + ' input');
                const val = settings[sels.indexOf(sel) === 0 ? 'login' : 'password'];
                bsDebug(port, `tryToLogIn: ${sel}/${$el.val()}/${val}`);
                if ($el.val() !== val) {
                    await clearAndSimulate($el[0], val);
                }
            }
            await delayPromise(990);
            await delayPromise(990);
            await delayPromise(990);

            authClicked = Date.now();
            await mouseChain({
                target: $(['#submit', 'button:contains("Log in")'].find(s => $(s).length > 0))[0],
                events: fullClick,
                error: 'Submit'
            });
            await delayPromise(990);
            await delayPromise(990);
            await delayPromise(990);

            const $errorMessage = await waitForElement('div.theme-error-i div.cms-container', 333, 4444).catch(() => $([]));
            if ($errorMessage.length > 0) {
                enterError = true;
            }

            return 'Login clicked!';
        }
    };

    const getBalance = (returnNull) => {
        const $b = $('div.user-balance');
        return $b.length === 0 || $('#critical-error').length !== 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.text()
                .replace(',', $b.text().indexOf('.') === -1 ? '.' : '')
                .replace(/[^\d.]/g, '').trim()
            );
    };

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message);
        });
    }

    const alternateDoDeposit = async command => {
        command.close = true;
        const $go = await waitForElement('#redirectButton', 300, 5000, true)
            .catch(e => $([]));
        if ($go.length > 0) {
            bsLogger('yellow', 'GP', `We'll click go button!`);
            await bMess('GAMEPARTY_ALTERNATE_COMMAND', true).remove();
            await bMess('SKRILL_COMMAND', true).set(command);
            bsLogger('yellow', 'GP', [`We'd set SKRILL_COMMAND - place 2`, command]);
            await delayPromise(4000);
            await mouseChain({target: $go[0], events: fullClick, error: 'go'});
            bsLogger('orange', 'GP', `CLICKED!`);
            return;
        } else {
            bsLogger('blue', 'GP', 'Go button not presented!');
        }
        const sels = ['a[href="/deposit/moneyBookersInput.action"]:visible',
            'form[action="moneyBookersSubmit.action"] div.card-details-submit button#submitButton:visible'];
        const gotoSkrill = async () => {
            await delayPromise(4000);
            await mouseChain({target: $(sels[0])[0], events: fullClick, error: 'gotoSkrill'});
        };
        const fillForm = async () => {
            await delayPromise(4000);
            await clearAndInputNumber($('#userInputAmount:visible')[0], command.data.amount);
            const $email = $('#emailId');
            if ($email.val() !== command.data.login) {
                await delayPromise(getRandomRounded(1000, 2000));
                await clearAndSimulate($email[0], command.data.login);
            }
            await bMess('SKRILL_COMMAND', true).set(command);
            bsLogger('yellow', 'GP', [`We'd set SKRILL_COMMAND - place 1`, command]);
            await delayFunction(4000)();
            await mouseChain({target: $('#submitButton')[0], events: fullClick, error: 'submitButton'});
            const errorSel = '#userInputAmount-error:visible';
            await waitForNotCondition(() => $(errorSel).length > 0, 300, 5000)
                .catch(async e => {
                    await mouseChain({target: $('a.close-button')[0], events: fullClick, error: 'PayClose'});
                    bsLogger('red', 'GAMEPARTY', 'We caught error: ' + $(errorSel).trt());
                    throw $(errorSel).trt();
                });
        };
        command.close = false;
        await waitForCondition(() => sels.some(s => $(s).length > 0), 300, 10000)
            .catch(e => dLog('red', 'GAMEPARTY', `WFC: ${e}`));
        if ($(sels[0]).length > 0) {
            await gotoSkrill();
        } else {
            await fillForm();
        }
    };

    const alternateDoWithdrawal = async command => {
        console.log('%c' + 'alternateDoWithdrawal', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        let $skrill = $([]), $amount = $([]);
        const amountSel = '#userInputAmount';
        await waitForCondition(() => {
            $skrill = $('a[href="/cashout/moneyBookersInput.action"]');
            $amount = $(amountSel);
            console.log(`${$skrill.length}/${$amount.length}`);
            return $skrill.length > 0 || $amount.length > 0;
        }, 500, 20000, 'zyt not found!');
        await delayPromise(990);
        await delayPromise(990);
        await delayPromise(990);
        if ($skrill.length > 0) {
            await bMess('GAMEPARTY_ALTERNATE_COMMAND', true).set(command);
            await mouseChain({target: $skrill[0], events: fullClick, error: '$skrill'});
        } else if ($amount.length > 0) {
            await bMess('GAMEPARTY_ALTERNATE_COMMAND', true).set(command);
            await delayPromise(990);
            await delayPromise(990);
            await delayPromise(990);
            const $wallet = $('#ewalletCashoutForm_account');
            if ($wallet.val() !== command.data.login) {
                console.log('%c' + `Wrong wallet: ${$wallet.val()} instead of ${command.data.login}`,
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                throw `Wrong wallet: ${$wallet.val()} instead of ${command.data.login}`;
            }
            console.log('%c' + `We'll enter ${command.data.amount}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            await clearAndInputNumber($(amountSel)[0], command.data.amount);
            await delayPromise(990);
            await delayPromise(990);
            await delayPromise(990);
            await mouseChain({target: $('#submitButton')[0], events: fullClick, error: 'submitButton'});
            const $err = waitForElement('#userInputAmount-error', 200, 1500).catch(e => $([]));
            if ($err.length > 0) {
                throw `Withdrawal error: ${$err.trt()}`;
            }
        } else {
            bMess('DEPOSIT_RESULT', true).set({success: true, message: 'It should be good!'});
        }
    };

    const alternateCommandProcessor = command => {
        console.log('%c' + `alternateCommandProcessor`, 'background: green; color: white; font-size: 14px; font-weight: bold; padding: 10px;', command);
        if (command.action === 'DEPOSIT') {
            const report = function (success, message) {
                ourCommand.add('increaseDelay', false);
                ourCommand.add('qiwiEntered', false);
                bsDebug(port, 'Report! ' + success + ' / ' + message);
                port.postMessage({
                    answered: "DEPOSIT",
                    status: success ? 'SUCCESS' : ['NO_FUNDS', 'RESTRICTED'].find(t => message.indexOf(t) > -1) || 'FAILED',
                    answer: message
                });
                delayPromise(3000)
                    .then(() => window.location.reload);
                if (!success) {
                    throw message;
                }
            };
            bMess('GAMEPARTY_ALTERNATE_COMMAND', true).set(command)
                .then(() => alternateDoDeposit(command))
                .catch(e => dLog('red', 'SKRILL', 'gotoSkrill: ' + e));
            (async () => {
                bsDebug(port, 'We started wait for deposit SECOND way! ' + window.location.href);
                const depositResult = await bMess('DEPOSIT_RESULT', true).get(120000)
                    .catch(e => ({success: false, message: `Error: ${e}`}));
                report(depositResult.success, depositResult.message || 'No message :(');
            })().catch(e => dLog('red', 'SKRILL', 'gotoSkrill: ' + e));
        } else if (command.action === "WITHDRAW") {
            bMess('GAMEPARTY_ALTERNATE_COMMAND', true).set(command)
                .then(() => alternateDoWithdrawal(command))
                .catch(e => bMess('DEPOSIT_RESULT', true).set({success: false, message: 'withdrawal: ' + e}));
        } else if (command.action === 'CHECK_PAYMENTS') {
            if (command.goClicked) {
                waitForElement('h1:contains("Payment History")', 333, 40000, true)
                    .then(() => {
                        let collected = [];
                        $('ul.collapsible li').each((idx, i) => {
                            const $this = $(i);
                            console.log($this);
                            collected.push({
                                date: $this.find('div.collapsible-body span:contains("Date created:")').text().replace('Date created:', '').trim(),
                                description: $this.find('div.collapsible-header div.payment-type span').trt()
                                    + ' ' + $this.find('div.collapsible-body span:contains("Instrument:")').text().replace(/(\r\n|\n|\r)/gm, ' ').trim(),
                                type: $this.find('div.collapsible-header div.payment-type strong').text().indexOf('Deposit') > -1 ? 'IN' : 'OUT',
                                paysystem: 'SKRILL',
                                amount: $this.find('div.collapsible-header span.amount').text().replace(/[^\d.]/g, '').trim(),
                                success: $this.find('div.collapsible-header').hasClass('theme-success-i')
                            });
                        });
                        console.log(collected);
                        chrome.storage.local.set({
                            'DEPOSIT_RESULT': {success: true, message: collected},
                            'DEPOSIT_RESULT_WAS_SET': Date.now()
                        });
                    })
                    .then(() => mouseChain({
                        target: $('span.close-button')[0],
                        events: ['mouseover', 'mousedown', 'click', 'mouseup']
                    }))
                    .then(() => {
                        if (window.opener) {
                            window.close();
                        }
                    })
                    .catch(e => chrome.storage.local.set({
                        'DEPOSIT_RESULT': {success: false, message: 'Error collecting: ' + e},
                        'DEPOSIT_RESULT_WAS_SET': Date.now()
                    }));
            } else {
                waitForElement('#transaction-type-options', 333, 40000, true)
                    .then($el => delayPromise(990, $el))
                    .then($el => delayPromise(990, $el))
                    .then($el => delayPromise(990, $el))
                    .then($el => {
                        if ($el.find('li.tab-active').trt() !== 'All') {
                            return mouseChain({
                                target: $el.find('li:contains("All")')[0],
                                events: ['mouseover', 'mousedown', 'click', 'mouseup']
                            })
                                .then(() => delayPromise(990))
                                .then(() => delayPromise(990))
                                .then(() => delayPromise(990))
                        }
                    })
                    .then(() => {
                        const $po = $('#paymentOption');
                        if ($po.val() !== 'Moneybookers') {
                            return selectLikePuppeteer($po[0], ['Moneybookers'])
                                .then(() => delayPromise(990))
                                .then(() => delayPromise(990))
                                .then(() => delayPromise(990));
                        }
                    })
                    .then(() => command.goClicked = true)
                    .then(() => chrome.storage.local.set({
                        'GAMEPARTY_ALTERNATE_COMMAND': command,
                        'GAMEPARTY_ALTERNATE_COMMAND_WAS_SET': Date.now()
                    }))
                    .then(() => mouseChain({
                        target: $('button[type="submit"]')[0],
                        events: ['mouseover', 'mousedown', 'click', 'mouseup']
                    }))
                    .catch(e => chrome.storage.local.set({
                        'DEPOSIT_RESULT': {success: false, message: 'Error before check: ' + e},
                        'DEPOSIT_RESULT_WAS_SET': Date.now()
                    }));
            }
        }
    };

    const waitForAlerts = () => {
        const $alert = $('#minimizeLayer:visible');
        if ($alert.length > 0) {
            mouseChain({target: $alert.find('a')[0], events: ['click']})
                .then(m => m)
                .catch(e => e)
                .then(delayFunction(settings.authCheckInterval))
                .then(waitForAlerts);
        } else {
            delayPromise(settings.authCheckInterval).then(waitForAlerts);
        }
    };

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload: ' + window.location.href, ourCommand.get());
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess('GAMEPARTY_COMMAND', true)
                .set(ourCommand.get(), increaseDelay ? 120000 : 0)
                .finally(() => console.log('Command saved!'));
        }
    }, true);

    const afterDOMLoaded = () => {
        if (['cashier.gamebookers.com', 'cashier.partypoker.com',].some(t => document.location.href.indexOf(t) > -1)
            && document.location.href.indexOf('lpsnmedia.net') === -1) {
            console.log('%c' + 'Alternate: ' + document.location.href,
                'background: transparent; color: green; font-size: 15px; font-weight: normal; padding: 15px;');
            bMess('GAMEPARTY_ALTERNATE_COMMAND', true).check(40000, true)
                .then(aCommand => alternateCommandProcessor(aCommand))
                .catch(e => console.log(`Alternate: ${e}`));
        } else if (window.self === window.top) {
            port.postMessage({m: "PAGE LOADED!"});
            console.log('%c' + 'loaded and message sent!', 'background: lightgreen; color: red; font-size: 13px; font-weight: normal; padding: 4px 10px;');
            chrome.storage.local.get(['GAMEPARTY_COMMAND', 'GAMEPARTY_COMMAND_WAS_SET'], function (result) {
                bsDebug(port, 'Saved command:', result);
                if (typeof result.GAMEPARTY_COMMAND !== 'undefined' && typeof result.GAMEPARTY_COMMAND_WAS_SET !== 'undefined'
                    && Date.now() - result.GAMEPARTY_COMMAND_WAS_SET < 40000) {
                    let currentCommand = result.GAMEPARTY_COMMAND;
                    chrome.storage.local.remove(['GAMEPARTY_COMMAND', 'GAMEPARTY_COMMAND_WAS_SET'], function () {
                        waitForCondition(() => {
                            return wasAuthCheck !== false;
                        }, 222, 10000, 'AuthCheck was not', false)
                            .then(() => messageProcessor(currentCommand))
                            .catch((e) => bsError(port, 'Something wrong with auth check! ' + e));
                    });
                } else {
                    chrome.storage.local.remove(['GAMEPARTY_COMMAND', 'GAMEPARTY_COMMAND_WAS_SET']);
                }
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

})();
