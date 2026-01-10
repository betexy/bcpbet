(() => {

    'use strict';

    let limited = false;
    let authClicked = 0;
    let wasAuthCheck = false;
    let busy = false;
    let increaseDelay = false;
    let urlSiteVersion = 'new';
    const roVer = document.location.href.indexOf('888sport.ro') > -1;
    const port = window.self === window.top ? chrome.runtime.connect({name: "port_sport888"}) : {postMessage: () => console.log(arguments)};
    let settings = {
        authCheckInterval: 2000,
        url: 'https://www.888sport.com/live-betting/',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        maxWaitForScore: 60000
    };

    let currentBetData = false;
    let currentCommand = '';
    let enterError = false;

    const ourCommand = new ourCommandProto();

    const sportAccordance = {
        'FOOTBALL': 'Football',
        'TENNIS': 'Tennis',
        'HOCKEY': '',
        'VOLLEYBALL': '',
        'BASEBALL': '',
        'BASKETBALL': '',
        'HANDBALL': ''
    };

    const sportAccordanceRo = {
        'FOOTBALL': 'Fotbal',
        'TENNIS': 'Tenis',
    };

    /**
     * --- METHODS ---
     */

    const messageProcessor = (message, direct) => {
        console.log('%c' + `${(direct ? 'Direct' : 'Saved')} : messageProcessor (${busy}) %O`,
            `background: ${(direct ? 'green' : 'yellow')}; color: ${(direct ? 'white' : 'black')}; font-size: 12px; font-weight: bold; padding: 3px;`,
            message);
        currentCommand = message.action;
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        }
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
            ['login', 'password', 'phone', 'uid'].forEach(k => settings[k] = message[k]);
            if (message.start_url) {
                settings.url = message.start_url;
            }
            authCheck();
            wasAuthCheck = true;
        } else if ((typeof methods[message.action] === "function" && message.action !== 'REGISTER' && getBalance() !== -1)
            || (message.action === 'REGISTER' && typeof methods[message.action] === "function")) {
            busy = true;
            ourCommand.set(message);
            methods[message.action](message.data)
                .then(() => bsDebug(port, "It's looks like " + message.action + " done!"))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                })
                .then(delayFunction(3333));
        } else if (getBalance() === -1) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: `Unsupported action: ${message.action}!`
            });
        }
    };

    const deposit = data => new Promise((onSuccess, onReject) => {
        bsDebug(port, 'Deposit!', data);
        const report = (success, message) => {
            ourCommand.add('increaseDelay', false);
            ourCommand.add('qiwiEntered', false);
            bsDebug(port, 'Report! ' + success + ' / ' + message);
            port.postMessage({
                answered: "DEPOSIT",
                status: ((s, m) => {
                    if (s) {
                        return 'SUCCESS';
                    } else if (m.indexOf('NO_FUNDS') > -1) {
                        return 'NO_FUNDS';
                    } else if (m.indexOf('RESTRICTED') > -1) {
                        return 'RESTRICTED';
                    } else {
                        return 'FAILED';
                    }
                })(success, message),
                answer: message
            });
            success ? onSuccess(message) : onReject(message);
            // mouseChain({target: $('#closeButtonWrapDiv')[0], events: fullClick}).then(m => m, e => e);
            delayPromise(5000).then(() => window.location.reload());
        };
        const waitForDeposit = function () {
            bsDebug(port, 'We started wait for deposit! ' + window.location.href);
            bMess('DEPOSIT_RESULT', true).get(200000)
                .then(r => report(r.success, typeof r.message === 'string' ? r.message : 'No message :('))
                .catch((e) => report(false, 'No deposit result: ' + e));
        };
        const letsRockNRoll = function () {
            if (ourCommand.getAdded('cashierOpened') === false) {
                let $el;
                delayPromise(111)
                    .then(waitForElementF('#topMenuaCcashierButton', 333, 20000))
                    .then($e => $el = $e)
                    .then(() => ourCommand.add('cashierOpened', true))
                    .then(() => bMess('SPORT888_ALTER').set(ourCommand.get(), 30000, ['www.safe-cashier.com/#/Deposit']))
                    .then(() => mouseChain({target: $el[0], events: fullClick, scroll: true}))
                    .then(waitForDeposit)
                    .catch((e) => report(false, 'Deposit MP: ' + e))
            } else if (ourCommand.getAdded('cashierOpened')) {
                // Hint: wait for deposit result
                waitForDeposit();
            } else {
                report(false, 'Strange situation - we are somewhere else...');
            }
        };
        letsRockNRoll();
    });

    const withdrawal = data => new Promise((onSuccess, onReject) => {
        bsDebug(port, 'Deposit!', data);
        const report = (success, message) => {
            ourCommand.add('increaseDelay', false);
            ourCommand.add('qiwiEntered', false);
            bsDebug(port, 'Report! ' + success + ' / ' + message);
            port.postMessage({
                answered: "DEPOSIT",
                status: ((s, m) => {
                    if (s) {
                        return 'SUCCESS';
                    } else if (m.indexOf('NO_FUNDS') > -1) {
                        return 'NO_FUNDS';
                    } else if (m.indexOf('RESTRICTED') > -1) {
                        return 'RESTRICTED';
                    } else {
                        return 'FAILED';
                    }
                })(success, message),
                answer: message
            });
            success ? onSuccess(message) : onReject(message);
            // mouseChain({target: $('#closeButtonWrapDiv')[0], events: fullClick}).then(m => m, e => e);
            delayPromise(5000).then(() => window.location.reload());
        };
        const waitForDeposit = function () {
            bsDebug(port, 'We started wait for withdrawal! ' + window.location.href);
            bMess('DEPOSIT_RESULT', true).get(200000)
                .then(r => report(r.success, typeof r.message === 'string' ? r.message : 'No message :('))
                .catch((e) => report(false, 'No deposit result: ' + e));
        };
        const letsRockNRoll = function () {
            if (ourCommand.getAdded('cashierOpened') === false) {
                let $el;
                delayPromise(111)
                    .then(waitForElementF('#topMenuaCcashierButton', 333, 20000))
                    .then($e => $el = $e)
                    .then(() => ourCommand.add('cashierOpened', true))
                    .then(() => bMess('SPORT888_ALTER').set(ourCommand.get(), 30000, ['www.safe-cashier.com/#/Deposit']))
                    .then(() => mouseChain({target: $el[0], events: fullClick, scroll: true}))
                    .then(waitForDeposit)
                    .catch((e) => report(false, 'Withdrawal MP: ' + e))
            } else if (ourCommand.getAdded('cashierOpened')) {
                // Hint: wait for deposit result
                waitForDeposit();
            } else {
                report(false, 'Strange situation - we are somewhere else...');
            }
        };
        letsRockNRoll();
    });

    const checkPayments = () => new Promise(function (onSuccess, onReject) {
        bsDebug(port, 'checkPayments!');
        let collected;
        const report = function (success, message) {
            bsDebug(port, 'Report! ' + success + ' / ' + message);
            port.postMessage({
                answered: "CHECK_PAYMENTS",
                data: success ? collected : [],
                answer: message
            });
            success ? onSuccess(message) : onReject(message);
            delayPromise(5000).then(() => window.location.reload());
        };

        const letsRockNRoll = function () {
            if (ourCommand.getAdded('cashierOpened') === false) {
                let $el;
                delayPromise(111)
                    .then(() => {
                        if ($('div.lBcashier:visible a').length === 0) {
                            return waitDelayClickF('p.lBopen', 30000, fullClick)().then(delayFunction(3333));
                        }
                    })
                    .then(waitForElementF('div.lBcashier:visible a', 333, 20000, true))
                    .then($e => $el = $e)
                    .then(() => ourCommand.add('cashierOpened', true))
                    .then(() => bMess('SPORT888_ALTER').set(ourCommand.get(), 30000, ['www.safe-cashier.com/#/']))
                    .then(() => mouseChain({target: $el[0], events: fullClick, scroll: true, error: 'lBopen'}))
                    .then(() => bMess('SPORT888_ALTER_RESULT').get(200000))
                    .then(r => {
                        if (r.success) {
                            collected = r.collected;
                        }
                        report(r.success, typeof r.message === 'string' ? r.message : 'No message :(');
                    })
                    .catch((e) => report(false, 'checkPayments ' + e))
            } else {
                report(false, 'Strange situation - we are somewhere else...');
            }
        };
        letsRockNRoll();
    });

    /**
     * Proceeds bets and expresses
     * @param data {array}
     * @returns {Promise<any>}
     */
    const proceedBet = data => new Promise(function (onSuccess, onReject) {
        currentBetData = {data: data, max: 0, external_id: '', willPlace: 0};
        const betFinished = (success, message) => {
            let status = 'ACCEPTED';
            if (!success) {
                const bad = ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED'].find(c => typeof message === 'string' && message.indexOf(c) > -1);
                status = bad || 'FAILED';
            }
            const resultData = {
                "external_id": success ? message.external_id : '',
                "status": status,
                "market": currentBetData.data[0].market,
                "target": currentBetData.data[0].target,
                "pivot": currentBetData.data[0].pivot,
                "coef": success ? message.coef : currentBetData.data[0].coef,
                "stake": success ? message.stake : currentBetData.data[0].stake,
                "maximum": 7777777
            };
            port.postMessage({
                answered: "BET",
                data: resultData,
                answer: success ? `Everything is Okay!` : message
            });
            bsDebug(port, `Result data (${success}): `, resultData);
            if (success) onSuccess(); else onReject(message);
        };
        const report = (success, message, willPlace) => {
            bsDebug(port, "Report (proceedBet) was fired with success: " + success + ', message: '
                + message + ', willPlace: ' + willPlace,
                (new Error().stack), message);
            if (success) {
                betFinished(true, message);
            } else {
                betFinished(false, message);
            }
        };

        const checkErrors = async () => {
            const $btn = $('button.mod-KambiBC-betslip__place-bet-btn:visible');
            if ($btn.length === 0) {
                throw 'No place btn!';
            } else if ($btn.attr('class').indexOf('approve-odds-btn') > -1) {
                await mouseChain({target: $btn[0], events: fullClick});
                await delayPromise(1000);
                return false;
            }
            return true;
        };

        const waitForBetResultNew = async () => {
            const $afterSubmit = await waitForElement('div.fullslip__placed-message:visible', 333, 25000, true).catch(() => $([]));
            if ($afterSubmit.length > 0) {
                const betPlaced = roVer === true ? 'PARIUL TĂU ESTE PLASAT! MULT NOROC' : 'YOUR BET IS PLACED! GOOD LUCK';
                if ($afterSubmit.find(`span:textEquals("${betPlaced}")`).length > 0) {
                    await delayPromise(1000);
                    await mouseChain({
                        target: $('span.fullslip__receipt-dropdown')[0],
                        events: fullClick
                    });
                    await delayPromise(1222);
                    const res = {
                        external_id: $('div.fullslip__receipt-bet-id').text().replace(/[^\d]/g, '').trim(),
                        stake: $('span.fullslip__receipt-stake-value').text().replace(/[^0-9.,]/g, '').trim().replace(/,/g, '.').trim(),
                        coef: $('span.fullslip__receipt-return-value').text().replace(/[^0-9.,]/g, '').trim().replace(/,/g, '.').trim()
                    };
                    await mouseChain({
                        target: $('div.fullslip__continue-button')[0],
                        events: fullClick
                    });
                    await delayPromise(1000);
                    return res;
                } else {
                    throw $afterSubmit.trt();
                }
            } else {
                if ($('div.bsmodal__warning-message').length > 0) {
                    throw $afterSubmit.find('div.bsmodal__warning-message').trt();
                } else {
                    throw 'Unknown behavior!';
                }
            }
        };

        const waitForBetResult = async stake => {
            const ss = ['h2:contains("Your bet has been placed!")', 'div.mod-KambiBC-betslip-feedback', 'button[class*="approve-odds-btn"]:visible'];
            await waitForCondition(() => ss.some(sel => $(sel).length > 0 && elementIsVisible($(sel)[0])),
                333, 30000, 'No result!');
            if ($(ss[0]).length > 0 && elementIsVisible($(ss[0])[0])) {
                await delayPromise(1000);
                const $bs = $('div.mod-KambiBC-betslip__receipt');
                const res = {
                    external_id: $bs.find('p[class$="receipt-id"]').text().replace(/[^\d]/g, '').trim(),
                    stake: $bs.find('span[class$="receipt__stake"]').text().replace(/[^\d.]/g, '').trim(),
                    coef: $bs.find('div[class$="receipt__row"]:contains("Total odds") dd[class$="receipt__value"]').text().replace(/[^\d.]/g, '').trim()
                };
                await mouseChain({target: $('button[class$="receipt__close-button"]')[0], events: fullClick});
                return res;
            } else if ($(ss[1]).length > 0 && elementIsVisible($(ss[1])[0])) {
                const max = $(ss[1]).text().trim().indexOf('the maximum allowed stake') > -1
                    ? $('div.mod-KambiBC-betslip-feedback').find('span[class$="currency"]').text().replace(/[^\d.]/g, '').trim() : '';
                const $sb = $('button.mod-KambiBC-betslip-button:visible');
                if ($sb.length > 0) {
                    await mouseChain({target: $sb[0], events: fullClick});
                    await delayPromise(500);
                }
                if (max !== '' && parseFloat(max) > 0) {
                    currentBetData.max = max;
                    return checkAndPlaceBet(max, true);
                } else if (parseFloat(max) === 0) {
                    throw 'Account is LIMITED';
                } else {
                    throw $(ss[0]).text().trim();
                }
            } else if ($(ss[2]).length > 0 && elementIsVisible($(ss[2])[0])) {
                if (!await checkErrors()) {
                    return checkAndPlaceBet(stake, true);
                } else {
                    throw 'Accept is visible, but very strange!';
                }
            } else {
                throw 'Unknown behavior!';
            }
        };

        const inputNewStake = async stakeInput => {
            await mouseChain({target: stakeInput[0], events: fullClick, error: 'ins1'});
            await delayPromise(1888);
            const $betKeyboard = $('div.fullslip__keyboard');
            for (let chr of data[0].stake.toString()) {
                if (chr === '.') {
                    await mouseChain({
                        target: $betKeyboard
                            .find('button.fullslip__keyboard-button:textEquals(".")')[0],
                        events: fullClick, error: 'ins2',
                    });
                    await delayPromise(555);
                } else {
                    await mouseChain({
                        target: $betKeyboard
                            .find(`button.fullslip__keyboard-button:textEquals("${chr}")`)[0],
                        events: fullClick, error: 'ins3',
                    });
                    await delayPromise(555);
                }
            }
            await delayPromise(555);
            await mouseChain({
                target: $betKeyboard
                    .find('button[data-test-id="betslip-keyboard;button-done"]')[0],
                events: fullClick, error: 'ins4',
            });
        };

        const selectOddsType = async () => {
            const decimal = roVer === true ? 'Zecimal' : 'Decimal';
            if ($('div.odds-content li.active-odds span').trt() !== decimal) {
                await mouseChain({target: $('a[data-label="odds-pc"]')[0], events: fullClick});
                await delayPromise(999);
                await mouseChain({target: $('a[data-label="DECIMAL"]')[0], events: fullClick});
                await delayPromise(3333);
            }
            await delayPromise(222);
        };

        let inputs = 0;
        const checkAndPlaceBet = async (stake, couponOpened) => {
            dLog('', '888', 'checkAndPlaceBet');
            await selectOddsType();
            if (!couponOpened) {
                await openCoupon(data);
            }
            await checkCoefs(data);

            let stakeInput;
            const stakeSel = 'input.fullslip__stake-value';
            await inputNewStake($(stakeSel));
            await delayPromise(1555);
            stakeInput = $(stakeSel).val().trim();

            if (parseFloat(stakeInput) !== parseFloat(stake)) {
                inputs++;
                const mess = `Bad input: ${stakeInput} instead of ${stake} (${inputs})`;
                if (inputs <= 3) {
                    console.log('%c' + mess + ' - reenter!',
                        'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    return checkAndPlaceBet(stake, true);
                } else {
                    throw mess;
                }
            }
            const $submitStake = $('div.fullslip__cta--place-bet');
            if ($submitStake.hasClass('fullslip__cta--disabled')) {
                throw $('p.fullslip__notification').trt();
            }

            await mouseChain({
                target: $submitStake[0],
                events: fullClick
            });
            return waitForBetResultNew();
        };

        checkAndPlaceBet(data[0].stake, false)
            .then(m => report(true, m))
            .catch(e => report(false, "Error during performBet: " + e));
    });

    const collectBetResultsNew = inD => new Promise((onSuccess, onReject) => {
        bsDebug(port, 'collectBetResultsNew');
        const collected = [];
        const report = (success, message) => {
            bsDebug(port, 'Collect data: success = ' + success + ', message = ' + message + ', data:', data);
            port.postMessage({
                answered: "BET_RESULT",
                status: success ? "success" : "error",
                answer: success ? collected : message
            });
            success ? onSuccess(collected) : onReject(message);
        };
        let reviewed = 0;
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        let completed = false;

        (async () => {
            const getMyBets = async () => {
                const $historyContainer = await waitForElement('div#bet-history', 333, 15000);
                const $betHistorySingleContainer = $historyContainer.find('div.bet-history__bet-single-container:visible');
                if ($betHistorySingleContainer.length > 0) {
                    await $betHistorySingleContainer.eachAsync(async (idx, val) => {
                        reviewed++;
                        const external_id = $(val).find('span.bet-history__open-bet-id').clone().children().remove().end().text().replace(/[^\d.]/g, '').trim();
                        if (data.length === 0 || data.indexOf(external_id) > -1) {
                            const status = 'ACCEPTED';
                            const coef = $(val).find('div.bet-history--odds').text().trim();
                            const stake = $(val).find('span.bet-history__stake--text data').text().replace(/[^\d.]/g, '').trim();
                            const match = $(val).find('div.bet-history__selection-markets-odds--selection-name').text().trim();
                            collected.push({
                                external_id,
                                status,
                                coef,
                                stake,
                                result: 0,
                                match
                            });
                        }
                        await delayPromise(getRandomRounded(1000, 2000));
                        if (reviewed >= limit || (data.length > 0 && collected.length >= data.length)) {
                            completed = true;
                            return false;
                        }
                    });
                    if (!$('ul.pagination li.next').hasClass('disabled') && !completed) {
                        await mouseChain({
                            target: $('ul.pagination li.next')[0],
                            events: fullClick,
                            error: 'next page'
                        });
                        await delayPromise(500);
                        await getMyBets();
                    }
                }
            }
            const getOlderBets = async () => {
                const $historyContainer = await waitForElement('div#bet-history', 333, 15000);
                const $betHistorySingleContainer = $historyContainer.find('div.bet-history__bet-single-container:visible');
                if ($betHistorySingleContainer.length > 0) {
                    await $betHistorySingleContainer.eachAsync(async (idx, val) => {
                        reviewed++;
                        const external_id = $(val).find('span.bet-history__place-outcome--bet-details-label').text().replace(/[^\d.]/g, '').trim();
                        if (data.length === 0 || data.indexOf(external_id) > -1) {
                            const won = roVer === true ? 'Câştigat' : 'Won';
                            const lost = roVer === true ? 'Pierdut' : 'Lost';
                            const status = $(val).find('span.bet-history__returns--outcome').trt() === lost
                                ? 'LOSE' : $(val).find('span.bet-history__returns--outcome').trt() === won
                                ? 'WON' : 'REFUNDED';
                            const coef = $(val).find('span.bet-history__selection-markets-odds--bet-type-odds').trt();
                            const stake = $(val).find('div.bet-history__stake--text data').trt().replace('RON', '').replace(',', '.').trim();
                            const match = $(val).find('div.bet-history__selection-markets-odds--selection-name').text().trim();
                            collected.push({
                                external_id,
                                status,
                                coef,
                                stake,
                                result: status === 'WON' ? $(val).find('span.bet-history__returns--amount data').text().replace('RON', '').replace(',', '.').trim() : 0,
                                match
                            });
                        }
                        await delayPromise(getRandomRounded(1000, 2000));
                        if (reviewed >= limit || (data.length > 0 && collected.length >= data.length)) {
                            completed = true;
                            return false;
                        }
                    });
                    if (!$('ul.pagination li.next').hasClass('disabled') && !completed) {
                        await mouseChain({
                            target: $('ul.pagination li.next')[0],
                            events: fullClick,
                            error: 'next page'
                        });
                        await delayPromise(500);
                        await getOlderBets();
                    }
                }
            }
            const goToHistory = async () => {
                const $profileBox = await waitForElement('div.aCprofileBox a[data-category="User Area"]', 333, 10000, true);
                await delayPromise(500);
                await mouseChain({target: $profileBox[0], events: fullClick, error: 'error click $profileBox'});
                await delayPromise(500);
                const bettingHistoryLink = roVer === true ? 'pariuri' : 'bets';
                const $bettingHistory = await waitForElement(`div.aCuserMenuShow a[href="/${bettingHistoryLink}/b/"]`, 333, 10000);
                await delayPromise(500);
                await mouseChain({target: $bettingHistory[0], events: fullClick, error: 'error click $bettingHistory'});
                await delayPromise(500);
            }

            const openBetsLink = roVer === true ? 'pariuri/pariuri-deschise' : 'bets/openBets';
            const settledBets = roVer === true ? 'pariuri/pariuriStabilite' : 'bets/settledBets';
            const olderBets = roVer === true ? 'pariuri/pariuriStabilite' : 'bets/olderBets';
            const settledLink = roVer === true ? 'https://www.888sport.ro/pariuri/pariuriStabilite/bs/'
                : 'https://www.888sport.com/bets/settledBets/bs/';
            if (document.location.href.indexOf(settledLink) > -1) {
                if ($(`a[href="/${openBetsLink}/bo"]`).find('div.TabsCarousel__tab--active').length === 0) {
                    await mouseChain({
                        target: $(`a[href="/${openBetsLink}/bo"]`)[0],
                        events: fullClick,
                        error: 'my bets tab1'
                    });
                    await delayPromise(1000);
                }
                await getMyBets();
                if (!completed) {
                    await mouseChain({
                        target: $(`a[href="/${olderBets}/boh"]`)[0],
                        events: fullClick,
                        error: 'older bets tab'
                    });
                    await delayPromise(1000);
                    await getOlderBets();
                }
            } else {
                await goToHistory();
                await waitForElement('div.bet-history', 333, 15000);
                if ($(`a[href="/${openBetsLink}/bo/"]`).find('div.TabsCarousel__tab--active').length === 0) {
                    await mouseChain({
                        target: $(`a[href="/${openBetsLink}/bo/"]`)[0],
                        events: fullClick,
                        error: 'my bets tab2'
                    });
                    await delayPromise(1000);
                }
                await getMyBets();
                if (!completed) {
                    await mouseChain({
                        target: $(`a[href="/${settledBets}/bs/"]`)[0],
                        events: fullClick,
                        error: 'settled bets tab'
                    });
                    await delayPromise(1000);
                    await getOlderBets();
                }
            }
        })()
            .then(() => report(true, `Everything collected! (${reviewed})`))
            .catch(e => report(false, `Error collecting: ${e}`));
    });

    const collectBetResults = inD => new Promise((onSuccess, onReject) => {
        const collected = [];
        const report = (success, message) => {
            bsDebug(port, 'Collect data: success = ' + success + ', message = ' + message + ', data:', data);
            port.postMessage({
                answered: "BET_RESULT",
                status: success ? "success" : "error",
                answer: success ? collected : message
            });
            success ? onSuccess(collected) : onReject(message);
        };
        let reviewed = 0;
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        const mbSel = 'div.KambiBC-breadcrumb-title:contains("My Bets")';
        const allSel = 'li.KambiBC-tabs__tab:contains("All")';
        (async () => {
            if ($(mbSel).length === 0) {
                await mouseChain({
                    target: $('a[data-category="User Area"]').first()[0],
                    events: fullClick,
                    error: 'UA'
                });
                const $bh = await waitForElement('a[href="/bets/b/"]', 333, 10000, true);
                await delayPromise(500);
                await mouseChain({target: $bh[0], events: fullClick, error: '$bh'});
                await delayPromise(500);
                await waitForElement(mbSel, 333, 30000, true);
            }
            if ($(allSel).attr('aria-selected') !== 'true') {
                await mouseChain({target: $(allSel)[0], events: fullClick, error: 'allSel'});
                await waitForCondition(() => $(allSel).attr('aria-selected') === 'true', 333, 30000, 'Not all bets :(');
            }
            const $cps = await waitForElement('div.KambiBC-my-bets-summary__coupon', 333, 30000);
            await $cps.toArray().forEachAsyncBreakable(async (val, idx) => {
                reviewed++;
                await mouseChain({
                    target: $('div.KambiBC-my-bets-summary__coupon').eq(idx)[0],
                    events: fullClick,
                    error: `details ${idx}`
                });
                const $coup = await waitForElement('div.KambiBC-bethistory-coupon--detailed', 333, 10000, true);
                const exId = $coup.find('dt.KambiBC-bethistory-coupon__label:contains("Coupon ID")').next().text().trim();
                if (data.length === 0 || data.indexOf(exId) > -1) {
                    const stake = parseFloat($coup.find('dt.KambiBC-bethistory-coupon__label:contains("Stake")').next().text()
                        .replace(/[^\d.]/g, '').trim());
                    let res = '';
                    ['dd[class$="coupon__payout_value"]', 'dl[class$="column--two"] dd[class$="bethistory-coupon__value"]'].forEach(s => {
                        if (res === '') {
                            res = $coup.find(s).text().replace(/[^\d.]/, '').trim();
                        }
                    });
                    const result = res === '' ? 0 : parseFloat(res);
                    const cClass = $coup.attr('class');
                    const sts = {'ACCEPTED': 'status-pending', 'WON': 'status-won', 'LOSE': 'status-lost'};
                    const status = Object.keys(sts).find(k => cClass.indexOf(sts[k]) > -1);
                    bsDebug(port, `${status} (${stake} / ${result})`);
                    collected.push({
                        external_id: exId,
                        status: status ? status : (result === stake ? 'REFUNDED' : result > stake ? 'WON' : 'LOSE'),
                        coef: $coup.find('dt.KambiBC-bethistory-coupon__label:contains("Odds")').next().text().trim(),
                        stake: stake.toString(),
                        result: isNaN(result) ? 0 : result.toString(),
                        match: $coup.next().find('header:first').text()
                            .replace($coup.next().find('header:first sup').text(), '').trim(),
                        bkPivot: $coup.next().find('div[class*="outcome-label"]:first').text().trim()
                    });
                }
                await mouseChain({
                    target: $('div.KambiBC-breadcrumb-title')[0],
                    events: fullClick,
                    error: 'go back'
                });
                const $mb = await waitForElement('a.KambiBC-breadcrumb__link:contains("My Bets")', 333, 3000, true);
                await mouseChain({target: $mb[0], events: fullClick, error: 'my bets'});
                await waitForElement('div.KambiBC-my-bets-summary__coupon', 333, 30000);
                await delayPromise(getRandomRounded(1000, 2000));
                return !(reviewed >= limit || (data.length > 0 && collected.length >= data.length));
            });
        })()
            .then(() => report(true, `Everything collected! (${reviewed})`))
            .catch(e => report(false, `Error collecting: ${e}`));
    });

    const notSupported = data => {
        bsDebug(port, 'notSupported!', data);
        return new Promise(function (onSuccess, onReject) {
            //delayPromise(7777).then(() => report(true, {login: data['nickname'], password: data['password']}))
            onReject('Not supported!');
        });
    };

    const methods = {
        'MAXIMUM': notSupported,
        'DEPOSIT': deposit,
        'WITHDRAW': withdrawal,
        'CHECK_PAYMENTS': checkPayments,
        'BET_RESULT': urlSiteVersion === 'new' ? collectBetResultsNew : collectBetResults,
        'BET': proceedBet,
        'EXPRESS_BET': proceedBet,
        'MONITOR': notSupported,
        'REGISTER': notSupported
    };

    /**
     * --- FUNCTIONS ---
     */

    /**
     * Checks coefs into the coupon
     * @param data
     * @returns {Promise<string,string>}
     */
    const checkCoefs = data => new Promise((onSuccess, onReject) => {
        /*TEST TOP START
        (function (data) {
            console.log(data);
            let onSuccess = function (m) {
                console.log('Success: ' + m);
            };
            let onReject = function (m) {
                console.log('Reject: ' + m);
            };
            //TEST TOP FINISH */
        const checkCoupon = async () => {
            const findInData = match => data.find(v => {
                const delimiter = urlSiteVersion === 'new' ? ' v ' : ' - ';
                const localMatch = v.team1.toLowerCase() + delimiter + v.team2.toLowerCase();
                return localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 60;
            });
            let $coupons = urlSiteVersion === 'new' ? $('div.fullslip__selection-details') : $('div[class$="betslip__content"]:visible div[class$="outcome__content"]:visible');
            let errors = [];
            let checked = 0;
            $coupons.each(function () {
                const $this = $(this);
                const match = urlSiteVersion === 'new' ? $this.find('div.fullslip__event-name').trt().toLowerCase() : $this.find('a[class$="event-link"]').text().trim().toLowerCase();
                const lc = urlSiteVersion === 'new' ? $this.find('div.fullslip__selection-price').trt() : $this.find('span.mod-KambiBC-betslip-outcome__odds').text().trim();

                if (urlSiteVersion === 'new') {
                    if ($this.hasClass('betslip-selections--selection-suspended')) {
                        errors.push(`${match} LOW_COEF, market unavailable (${lc})!`);
                        checked++;
                        return true;
                    }
                } else {
                    //fullslip__suspended
                    if ($this.find('div.fullslip__suspended').trt() === 'suspended') {
                        errors.push(`${match} LOW_COEF, market unavailable!`);
                        checked++;
                        return true;
                    }
                }

                const localCoef = parseFloat(lc);
                const localData = findInData(match);

                if (localData && localData.coef !== '' && !isNaN(localCoef)) {
                    let checkCoef = parseFloat(localData.coef);
                    console.log(`${match} / ${localCoef} vs ${checkCoef}`);
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
                } else if (localData && localData.coef === '') {
                    checked++;
                }
            });
            if (errors.length === 0 && checked === data.length) {
                console.log('%c' + 'checkCoupon => Coefs fine!', 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                return 'Coefs fine!';
            } else {
                const error = errors.join('; ') + (checked !== data.length ? ' some stakes not checked ('
                    + checked + '/' + data.length + ')!' : '');
                console.log('%c' + `checkCoupon => ${error}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                throw error;
            }
        };
        checkCoupon()
            .then(m => onSuccess(m))
            .catch(e => onReject(e));
        /* TEST BOTTOM START
    })([
        {team1: 'Newcastle Jets FC U21', team2: 'Lambton Jaffas FC', coef: '1.54'},
        {team1: 'Taringa Rovers Reserves', team2: 'Centenary Stormers Reserves', coef: '1.7'}
    ]);
    //TEST BOTTOM FINISH */
    });

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<object,string>} jQuery element for bet
     */
    const getBetElement = data => new Promise(function (reportSuccess, reportReject) {
        //#-#-START
        let $found = $([]);
        const eventName = (() => {
            const $name = $('div.scoreboard div.competitor');
            return $name.eq(0).text().trim() + ' v ' + $name.eq(1).text().trim();
        })();

        const teams = eventName.split(' v ');
        if (teams.length === 2 || teams[0].length === 0 || teams[1].length === 0) {
            data.team1 = teams[0].toLowerCase();
            data.team2 = teams[1].toLowerCase();
            data.team1b = teams[0];
            data.team2b = teams[1];
        } else {
            reportReject('No teams!');
            return;
        }

        // Hint: we must search 'Selected Markets' superRoot always
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Full Time Result'],
                    pivotKeys: ['#TEAM1B#'],
                },
                'TWO': {
                    roots: ['Full Time Result'],
                    pivotKeys: ['#TEAM2B#'],
                },
                'DRAW': {
                    roots: ['Full Time Result'],
                    pivotKeys: ['Draw'],
                },
                'ONE_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1B# or Draw'],
                },
                'TWO_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['Draw or #TEAM2B#'],
                },
                'ONE_TWO': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1B# or #TEAM2B#'],
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['Total Goals Over/Under'],
                    pivotKeys: ['Over (#PIVOT#)'],
                },
                'UNDER': {
                    roots: ['Total Goals Over/Under'],
                    pivotKeys: ['Under (#PIVOT#)'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['#TEAM1B# Total Goals Over/Under'],
                    pivotKeys: ['Over (#PIVOT#)'],
                },
                'UNDER': {
                    roots: ['#TEAM1B# Total Goals Over/Under'],
                    pivotKeys: ['Under (#PIVOT#)'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['#TEAM2B# Total Goals Over/Under',],
                    pivotKeys: ['Over (#PIVOT#)'],
                },
                'UNDER': {
                    roots: ['#TEAM2B# Total Goals Over/Under',],
                    pivotKeys: ['Under (#PIVOT#)'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    roots: ['Total Corners Over/Under'],
                    pivotKeys: ['Over (#PIVOT#)'],
                },
                'UNDER': {
                    roots: ['Total Corners Over/Under'],
                    pivotKeys: ['Under (#PIVOT#)'],
                },
            },
            'HDP': {
                'HOME': {
                    roots: ['Handicap', 'Asian Handicap'],
                    pivotKeys: ['#TEAM1B# (#PIVOTH#)'],
                },
                'AWAY': {
                    roots: ['Handicap', 'Asian Handicap'],
                    pivotKeys: ['#TEAM2B# (#PIVOTH#)'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    roots: ['Handicap'],
                    pivotKeys: ['#TEAM1B# (#EPIVOT#)'],
                },
                'H2': {
                    roots: ['Handicap'],
                    pivotKeys: ['#TEAM2B# (#EPIVOT#)'],
                },
                'HX': {
                    roots: ['Handicap'],
                    pivotKeys: ['Draw (#EPIVOT#)'],
                }
            },
        };

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            reportReject(`Unsupported ${data.time_value} / ${data.market} / ${data.target}`);
        }

        const params = new AllMarkets(data);
        params.proceed_football = function (data) {
            if (!this.full) {
                this.addToEl('roots', 'Half-time ', true);
            }
        };

        const final = applyAllMarkets(data, ['roots', 'pivotKeys',], params, markets);
        const m = final[data.market][data.target];
        const ePivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };
        const hPivot = pvt => parseFloat(pvt) > 0 ? `+${pvt}` : pvt;

        replaceInner(m, {
            '#TEAM1B#': data.team1b,
            '#TEAM2B#': data.team2b,
            '#PIVOT#': data.pivot,
            '#EPIVOT#': ePivot(data.pivot),
            '#PIVOTH#': hPivot(data.pivot),
        });
        dLog('green', 'Vbet', ['Final market is:', m]);

        const $findPivot = $root => {
            for (const pvt of m.pivotKeys) {
                const $pivot = $root
                    .find(`div.media-cells div.cell-body:textEqualsIS("${pvt}")`)
                if ($pivot.length === 1) {
                    return $pivot;
                } else if ($pivot.length > 1) {
                    reportReject(`Strange pivot length ${$pivot.length} for ${pvt}`);
                }
            }
            return $([]);
        };

        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () =>
                $(`div.market_inplay:has(span.cashout-available-icon:textEqualsIS("${root}"))`);
            if ($root().length === 0) {
                continue;
            }
            if ($root().find('h4.expanded').length === 0) {
                mouseChain({
                    target: $root().find('span.cashout-available-icon')[0],
                    events: ['click'],
                    scroll: true
                })
                    .then(delayFunction(1500))
                    .catch((e) => reportReject('Error expand root panel: ' + e));
            }
            $found = $findPivot($root());
            if ($found.length > 0) {
                break;
            }
        }

        if ($found.length === 0) {
            reportReject(`${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot}` + ' not found :(');
        } else {
            $found.next()[0].scrollIntoView();
        }
        reportSuccess($found.next());
        //#-#-FINISH
    });

    /**
     *  Get bet element and scroll into market and element if new version
     * @param {object} data - one of data's rows
     * @returns {Promise<object,string>} jQuery element for bet
     */
    const getBetElementNew = data => new Promise(function (reportSuccess, reportReject) {
        //#-#-START
        (async () => {
            let $found = $([]);
            const $marketsGroups = $('div.markets-groups-wrapper');
            if ($marketsGroups.length === 0) {
                throw 'market groups not found!';
            }
            const euroHdpWay = roVer === true ? 'handicap' : '--way-handicap';
            const marketsLink = data.market === 'EURO_HDP'
                ? `li[data-hash="${euroHdpWay}"]`
                : 'li[data-hash="all-markets"]';

            if (!$marketsGroups.find(marketsLink).hasClass('active')) {
                await mouseChain({
                    target: $marketsGroups.find(marketsLink)[0], events: ['click'],
                    scroll: true, error: 'Error expand root panel'
                });
                await delayPromise(2500);
            }

            const eventName = (() => {
                const $name = $(findSel([
                    'div.cell-competitors div.competitor', 'span.event-description__competitor-text'
                ]));
                return $name.eq(0).text().trim() + ' v ' + $name.eq(1).text().trim();
            })();

            const teams = eventName.split(' v ');
            if (teams.length === 2 || teams[0].length === 0 || teams[1].length === 0) {
                data.team1 = teams[0].toLowerCase();
                data.team2 = teams[1].toLowerCase();
                data.team1b = teams[0];
                data.team2b = teams[1];
            } else {
                throw'No teams!';
            }

            const markets = {
                'ONE_TWO': {
                    'ONE': {
                        roots: ['Full Time Result', 'Rezultat Final'],
                        pivotKeys: ['#TEAM1B#'],
                    },
                    'TWO': {
                        roots: ['Full Time Result', 'Rezultat Final'],
                        pivotKeys: ['#TEAM2B#'],
                    },
                    'DRAW': {
                        roots: ['Full Time Result', 'Rezultat Final'],
                        pivotKeys: ['Draw', 'Egalitate'],
                    },
                    'ONE_DRAW': {
                        roots: ['Double Chance', 'Şansă dublă'],
                        pivotKeys: ['#TEAM1B# or Draw', '#TEAM1B# sau egal'],
                    },
                    'TWO_DRAW': {
                        roots: ['Double Chance', 'Şansă dublă'],
                        pivotKeys: ['Draw or #TEAM2B#', 'Egal sau #TEAM2B#'],
                    },
                    'ONE_TWO': {
                        roots: ['Double Chance', 'Şansă dublă'],
                        pivotKeys: ['#TEAM1B# or #TEAM2B#', '#TEAM1B# sau #TEAM2B#'],
                    }
                },
                'TOTAL': {
                    'OVER': {
                        roots: ['Total Goals Over/Under', 'Total goluri peste/sub'],
                        pivotKeys: ['#PIVOT#', 'Over (#PIVOT#)', 'Peste (#PIVOT#)'],
                        buttons: ['0'],
                    },
                    'UNDER': {
                        roots: ['Total Goals Over/Under', 'Total goluri peste/sub'],
                        pivotKeys: ['#PIVOT#', 'Under (#PIVOT#)', 'Sub (#PIVOT#)'],
                        buttons: ['1'],
                    },
                },
                'T1_TOTAL': {
                    'OVER': {
                        roots: ['#TEAM1B# Total Goals Over/Under', 'Total goluri #TEAM1B# peste/sub'],
                        pivotKeys: ['#PIVOT#', 'Over (#PIVOT#)', 'Peste (#PIVOT#)'],
                        buttons: ['0'],
                    },
                    'UNDER': {
                        roots: ['#TEAM1B# Total Goals Over/Under', 'Total goluri #TEAM1B# peste/sub'],
                        pivotKeys: ['#PIVOT#', 'Under (#PIVOT#)', 'Sub (#PIVOT#)'],
                        buttons: ['1'],
                    },
                },
                'T2_TOTAL': {
                    'OVER': {
                        roots: ['#TEAM2B# Total Goals Over/Under', 'Total goluri #TEAM2B# peste/sub'],
                        pivotKeys: ['#PIVOT#', 'Over (#PIVOT#)', 'Peste (#PIVOT#)'],
                        buttons: ['0'],
                    },
                    'UNDER': {
                        roots: ['#TEAM2B# Total Goals Over/Under', 'Total goluri #TEAM2B# peste/sub'],
                        pivotKeys: ['#PIVOT#', 'Under (#PIVOT#)', 'Sub (#PIVOT#)'],
                        buttons: ['1'],
                    },
                },
                'CORNER_TOTAL': {
                    'OVER': {
                        roots: ['Total Corners Over/Under', 'Total cornere peste/sub'],
                        pivotKeys: ['Over (#PIVOT#)', 'Peste (#PIVOT#)'],
                    },
                    'UNDER': {
                        roots: ['Total Corners Over/Under', 'Total cornere peste/sub'],
                        pivotKeys: ['Under (#PIVOT#)', 'Sub (#PIVOT#)'],
                    },
                },
                'HDP': {
                    'HOME': {
                        roots: ['Handicap', 'Asian Handicap', 'Handicap asiatic'],
                        pivotKeys: ['#TEAM1B# (#PIVOTH#)'],
                    },
                    'AWAY': {
                        roots: ['Handicap', 'Asian Handicap', 'Handicap asiatic'],
                        pivotKeys: ['#TEAM2B# (#PIVOTH#)'],
                    }
                },
                'EURO_HDP': {
                    'H1': {
                        roots: ['Handicap'],
                        pivotKeys: ['#TEAM1B# (#PIVOT#)'],
                    },
                    'H2': {
                        roots: ['Handicap'],
                        pivotKeys: ['#TEAM2B# (#PIVOT#)'],
                    },
                    'HX': {
                        roots: ['Handicap'],
                        pivotKeys: ['Draw (#PIVOT#)'],
                    }
                },
            };

            if (data.market === 'HDP' && parseFloat(data.pivot) === 0) {
                markets.HDP[data.target].roots = ['Draw No Bet'];
                markets.HDP[data.target].pivotKeys = ['#TEAM' + (data.target === 'HOME' ? '1' : '2') + 'B#'];
            }

            if (typeof markets[data.market] === 'undefined'
                || typeof markets[data.market][data.target] === 'undefined') {
                throw `Unsupported ${data.time_value} / ${data.market} / ${data.target}`;
            }

            const params = new AllMarkets(data);
            params.proceed_football = function (data) {
                if (roVer && !this.full) {
                    if (data.market === 'ONE_TWO') {
                        if (['ONE', 'TWO', 'DRAW'].indexOf(data.target) > -1) {
                            this.addTotal('roots', ['Rezultat 1-a repriză']);
                        } else {
                            this.addTotal('roots', ['1-a repriză - şansă dublă']);
                        }
                    } else if (data.market === 'TOTAL') {
                        this.addTotal('roots', ['Total goluri pauză peste/sub']);
                    } else if (data.market === 'HDP') {
                        this.addTotal('roots', ['1-a repriză - handicap']);
                    } else if (data.market === 'CORNER_TOTAL') {
                        this.addTotal('roots', ['1-a Repriză - Total Cornere']);
                    }
                } else {
                    if (!this.full) {
                        this.addToEl('roots', 'Half-time ', true);
                    }
                }
            };
            params.proceed_tennis = function (data) {
                if (roVer) {
                    if (!this.full) {
                        if (data.market === 'ONE_TWO') {
                            this.addTotal('roots', [`Câștigător set (set ${this.tht})`]);
                        } else if (data.market === 'TOTAL') {
                            this.addTotal('roots', [`Total game-uri set peste/sub (set ${this.tht})`]);
                        } else if (data.market === 'HDP') {
                            this.addTotal('roots', ['Handicap set']);
                        }
                    } else {
                        if (data.market === 'ONE_TWO') {
                            this.addTotal('roots', ['Rezultat meci']);
                        } else if (data.market === 'TOTAL') {
                            this.addTotal('roots', ['Total game-uri peste/sub']);
                        } else if (data.market === 'HDP') {
                            this.addTotal('roots', ['Handicap set']);
                        }
                    }
                } else {
                    if (data.market === 'ONE_TWO' && ['ONE', 'TWO', 'DRAW'].indexOf(data.target) > -1) {
                        this.addTotal('roots', ['To Win Match']);
                    } else if (data.market === 'TOTAL') {
                        this.addTotal('roots', ['Total Games Over/Under']);
                    } else if (data.market === 'HDP') {
                        this.addTotal('roots', ['Set Handicap']);
                    }
                    if (!this.full) {
                        this.addToEl('roots', `${this.tht} set -`, true);
                    }
                }
            };

            const final = applyAllMarkets(data, ['roots', 'pivotKeys',], params, markets);
            const m = final[data.market][data.target];
            const ePivot = pvt => {
                const p = parseInt(pvt);
                return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
            };
            const hPivot = pvt => parseFloat(pvt) > 0 ? `${pvt}` : pvt;

            replaceInner(m, {
                '#TEAM1B#': data.team1b,
                '#TEAM2B#': data.team2b,
                '#PIVOT#': data.pivot,
                '#EPIVOT#': ePivot(data.pivot),
                '#PIVOTH#': hPivot(data.pivot),
            });
            dLog('green', '888', ['Final market is:', m]);

            const $findPivot = $root => {
                for (const pvt of m.pivotKeys) {
                    const $pivot = $root
                        .find(`div.media-cells div.cell-body:textEqualsIS("${pvt}")`);
                    if ($pivot.length === 1) {
                        if (typeof m.buttons !== 'undefined' && $pivot.next().find('div').length > 1) {
                            return $pivot.next().find('div').eq(m.buttons[0]);
                        } else {
                            return $pivot.next();
                        }
                    } else if ($pivot.length > 1) {
                        reportReject(`Strange pivot length ${$pivot.length} for ${pvt}`);
                    }
                }
                return $([]);
            };

            for (const root of m.roots) {
                console.log(`Checking root: ${root}`);
                const $root = () =>
                    $(`div.market_inplay:has(h4.inplayMarketHeading:textEqualsIS("${root}"))`);
                if ($root().length === 0) {
                    continue;
                }
                if ($root().find('h4.expanded').length === 0) {
                    await mouseChain({
                        target: $root().find('h4')[0], events: ['click'],
                        scroll: true, error: 'expand market'
                    });
                    await delayPromise(1500);
                }
                if ($root()
                    .find('span.grouping-selections__collapse:textEquals("See more")').length > 0) {
                    await mouseChain({
                        target: $root()
                            .find('span.grouping-selections__collapse:textEquals("See more")')[0],
                        events: ['click'],
                        scroll: true, error: 'See more'
                    });
                    await delayPromise(1500);
                }
                $found = $findPivot($root());
                if ($found.length > 0) {
                    break;
                }
            }

            if ($found.length === 0) {
                throw`${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot}`
                + ' not found :(';
            } else {
                $found.closest('div.market_inplay')[0].scrollIntoView();
            }
            return $found;
        })()
            .then($el => reportSuccess($el))
            .catch(e => reportReject(e));
        //#-#-FINISH
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
            const delimiter = urlSiteVersion === 'new' ? ' v ' : ' - ';
            let event = (data.team1 + delimiter + data.team2).toLowerCase();
            let result = false;
            let matches = [];
            const sel = urlSiteVersion === 'new' ? 'div.fullslip__selection-details' : 'div[class$="betslip__content"]:visible div[class$="outcome__content"]:visible';
            waitForElement(sel, 333, 15000)
                .then(waitForConditionF(() => {
                    return $(sel).length >=
                        (ourCommand.getAdded('express') === false ? 1 : 2);
                }, 400, 15000, 'Wrong length of events in coupon!'))
                .then(delayFunction(400))
                .then(() => {
                    const $events = $(sel);
                    $events.each(function () {
                        const $this = $(this);
                        const eventLink = urlSiteVersion === 'new' ? 'div.fullslip__event-name' : 'a[class$="event-link"]';
                        const teams = $this.find(eventLink).trt().toLowerCase();
                        matches.push(teams);
                        dLog('blue', '888', $events.length + ' ' + event + ' === ' + teams + ' ? '
                            + (event === teams || locutus_similar_text(event, teams, true) > 70));
                        if (event === teams || locutus_similar_text(event, teams, true) > 70) {
                            onSuccess($this);
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
        let $betElement;
        const openElement = function () {
            closePreviousCoupons(ourCommand.getAdded('express'))
                .then(() => openEvent(data))
                .then(() => getBetElementNew(data))
                .then($el => $betElement = $el)
                .then(() => bsDebug(port, 'We got element! Coef: '
                    + $betElement.find('span.bb-sport-event__selection').text().trim()))
                .then(() => {
                    if ($betElement.find('span.bb-sport-event__selection')
                        .hasClass('bb-sport-event__selection--inactive')) {
                        throw 'Bet inactive!';
                    }
                    return $betElement.find('span.bb-sport-event__selection');
                })
                .then($clk => mouseChain({target: $clk[0], events: fullClick}))
                .then(waitForElementF('div.fullslip__selection-details', 333, 20000))
                .then(checkCoupon)
                .then(() => result(true, 'Max collect later...'))
                .catch((e) => result(false, 'Error till: ' + e));
        };
        if (ourCommand.getAdded('express') !== false) {
            data = paramData[ourCommand.getAdded('express')];
        } else {
            data = lData.shift();
        }
        if (typeof data !== 'undefined') {
            bsDebug(port, 'openCoupon - basic - We got data: ' + (typeof data), data);
            openElement();
        } else {
            onReject('There is no input data!');
        }
    });

    /**
     * Open event table, if we're on it already -  onSuccess
     * @param {object} data
     * @returns {Promise<any>}
     */
    const openEvent = data => new Promise(function (onSuccess, onReject) {
        bsDebug(port, 'openEvent', data);
        const team1 = data.team1.toLowerCase();
        const team2 = data.team2.toLowerCase();
        const eventName = team1 + ' v ' + team2;

        const sport = sportAccordance[data.sport];
        const sportRo = sportAccordanceRo[data.sport];

        if (sport === 'undefined' || sport === '') {
            onReject('Sport ' + data.sport + ' not supported or presented :(');
        }
        const sportLink = roVer === true ? `/live/${sportRo.toLowerCase()}/` : `/inplay/${sport.toLowerCase()}`;
        const checkScore = async () => {
            if (data.score === '' || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                await delayPromise(500);
            } else if (sport.toLowerCase() !== 'tennis') {
                const $scores = await waitForElement('span.bb-score-board__score-field--last-score', 333, 30000);
                if ($scores.length !== 2) {
                    throw 'SCORE_CHANGED! No score :(';
                } else {
                    const sc1 = $scores.eq(0).trt();
                    const sc2 = $scores.eq(1).trt();
                    if (`${sc1}:${sc2}` !== data.score.replace(/[^\d:]/g, '').trim()) {
                        throw `SCORE_CHANGED! We have: ${sc1}:${sc2}, we need: ${data.score}`;
                    }
                }
            }
        };
        let result = function (status, message) {
            if (status) {
                waitForCondition(() => {
                    return checkWeAreThere();
                }, 777, 30000, 'It looks like we are not there!')
                    .then(checkScore)
                    .then(() => onSuccess())
                    .catch((e) => onReject(e));
            } else {
                onReject(message);
            }
        };
        const checkWeAreThere = function () {
            const $teams = $(findSel([
                'div.cell-competitors div.competitor', 'span.event-description__competitor-text'
            ]));
            if ($teams.length === 2) {
                const name = ($teams.eq(0).trt() + ' v '
                    + $teams.eq(1).trt()).toLowerCase();
                return (name === eventName || locutus_similar_text(name, eventName, true) > 75);
            } else {
                dLog('', '888', `checkWeAreThere (${$teams}) - no teams (${$teams.length})`);
                return false;
            }
        };
        const findEvent = async () => {
            const getScore = function ($evt) {
                if (sport.toLowerCase() === 'tennis') {
                    return data.score.replace(/[^\d:]/g, '').trim();
                }
                const $scores = $evt.find('span.bb-score-board__score-field');
                return $scores.length === 2
                    ? `${$scores.eq(0).text().trim()}:${$scores.eq(1).text().trim()}`
                    : `Wrong scores: ${$scores.length}`;
            };
            let $ourEvent = $([]);
            const expand = async () => {
                //expand collapsed tabs
                await $('section.bb-inplay-tournament.bb-content-section--collapsed')
                    .eachAsync(async (idx, val) => {
                        await mouseChain({
                            target: $(val).find('div.bb-icon')[0],
                            events: ['click']
                        });
                        await delayPromise(1555);
                    });
            };
            const tryToFindEvent = async () => {
                await waitForCondition(() => $(`section[data-ga_component="inplay_${sport.toLowerCase()}"]`).length > 0, 333, 30000, 'No sport section!');
                const $eventsEl = await waitForElement('div.bb-sport-event:visible',
                    333, 15000);
                const textEvent = roVer === true ? 'span.event-description__competitor-text' : 'span.featured-matches-widget__event-text';
                await $eventsEl.eachAsync(async (idx, val) => {
                    const $ts = $(val).find(textEvent);
                    const eventHere = $ts.length === 2 ? ($ts.eq(0).trt() + ' v '
                        + $ts.eq(1).trt()).toLowerCase() : '';
                    if (eventHere === eventName
                        || locutus_similar_text(eventHere, eventName, true) > 70) {
                        $ourEvent = $(val);
                        return false;
                    }
                });
            };
            await expand();
            await tryToFindEvent();
            if ($ourEvent.length === 0) {
                throw `Event ${eventName} not found :(`;
            } else if (data.score === '' || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1
                || getScore($ourEvent) === data.score.replace(/[^\d:]/g, '').trim()) {
                await mouseChain({
                    target: urlSiteVersion === 'new' ? $ourEvent.find('a.bet-card__body')[0] : $ourEvent.closest('a')[0],
                    events: ['click']
                });
                await delayPromise(1000);
            } else {
                throw `SCORE_CHANGED: we need: ${data.score}, we have: ${getScore($ourEvent)}`;
            }
        };
        const $sportHeader = () => $(`div.carousel__scroller a[href^="${sportLink}"]`);
        const goRightPageInclSport = async () => {
            const onPage = $sportHeader().length > 0
                && $sportHeader().parent().attr('class').indexOf('selected') > -1;
            if (onPage) {
                return;
            }
            await waitForCondition(() => $sportHeader().length > 0,
                333, 30000, 'No sport!');
            $sportHeader()[0].scrollIntoView();
            await mouseChain({target: $sportHeader()[0], events: fullClick, error: '$sportHeader'});
            await delayPromise(888);
        };
        if (!checkWeAreThere()) {
            (async () => {
                //if new version click live
                if (roVer) {
                    const $home = $('li[data-testid="uc-home"]');
                    if ($home.hasClass('item_active') === false) {
                        await mouseChain({
                            target: $home.find('a')[0],
                            events: fullClick
                        });
                        await delayPromise(333);
                    }
                    const $iconsCarousel = await waitForElement('ul.iconsCarousel__wrapper',
                        333, 10000, true);
                    await delayPromise(333);
                    await mouseChain({
                        target: $iconsCarousel.find('a[href="/pariuri-live/"]')[0],
                        events: fullClick
                    });
                } else {
                    const $homeSection = await waitForElement('nav.tab-bar',
                        333, 10000, true);
                    if ($homeSection.find('a[href="/live-betting/"]').hasClass('tab-bar__tab--selected') === false) {
                        await mouseChain({
                            target: $homeSection.find('a[href="/live-betting/"]')[0],
                            events: fullClick
                        });
                        await delayPromise(3000);
                    }
                }
            })()
                .then(() => goRightPageInclSport())
                .then(findEvent)
                .then(() => result(true, 'We must be on event page!'))
                .catch((e) => result(false, 'findEvent 1:' + e));
        } else {
            result(true, 'We probably on event page!');
        }
    });

    /**
     * Close early opened coupons
     * @param skipParam [{boolean}] default FALSE - whether we need to skip closing
     * @returns {Promise<string,string>}
     */
    const closePreviousCoupons = skipParam => new Promise(function (onSuccessOut, onReject) {
        const skip = typeof skipParam === 'undefined' ? false : skipParam;
        if (skip) {
            onSuccessOut('skipped!');
            return;
        }
        const onSuccess = function (message) {
            onSuccessOut(message);
        };
        const removeStakes = function () {
            const closeOne = function () {
                let $closes = $('div.fullslip__selection-remove:visible');
                if ($closes.length > 0) {
                    mouseChain({target: $closes[0], events: ['click'], scroll: true})
                        .then(delayFunction(500))
                        .then(closeOne)
                        .catch((e) => onReject('Error till close: ' + e));
                } else {
                    onSuccess('All were closed!');
                }
            };
            // Hint: Click 'Remove all' once or every 'Close'
            closeOne();
        };
        const $bs = $('div.fullslip__cta--clear:visible');
        if ($bs.length > 0) {
            mouseChain({
                target: $bs[0],
                events: ['click'], error: 'Close all'
            })
                .then(delayFunction(1000))
                .then(removeStakes)
                .catch(e => onReject(`Expanding bs: ${e}`));
        } else {
            removeStakes();
        }
    });

    const authCheck = () => {
        if (enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            bsError(port, 'ERROR AUTH!');
            return;
        }
        closeAllWeNeed({
            '#CookieMessageDiv img.close': '#CookieMessageDiv img.close',
            'div.sportErrorButton:visible': 'div.sportErrorButton:visible input[type="submit"]',
            'button[automation-id="popup-timeout-and-kick-ok"]:textEquals("OK"):visible': 'button[automation-id="popup-timeout-and-kick-ok"]:textEquals("OK"):visible'
        }).then(m => m).catch(e => e);
        if ($('div.popup-body:contains("disconnected")').length > 0) {
            mouseChain({target: $('div.popup-actions button')[0], events: fullClick, error: ''})
                .finally(e => document.location.reload());
        }
        if (getBalance() === -1) {
            port.postMessage({m: "tech works! 2"});
            delayPromise(1000)
                .then(tryToLogIn)
                .then(() => bsDebug(port, "Credentials entered..."))
                .catch((e) => bsError(port, 'Error within login: ' + e))
                .then(delayFunction(settings.authCheckInterval))
                .then(authCheck);
        } else {
            port.postMessage({
                m: "authorized!",
                balance: getBalance(true),
                limited: false
            });
            delayPromise(settings.authCheckInterval).then(authCheck);
        }
    };

    const tryToLogIn = () => new Promise((resolve, reject) => {
        dLog('green', '888', 'tryToLogIn');
        const $logLink = $('a[data-label="Login"]').first(), errSel = '#rlLoginFormErrorMessage:visible';
        if ($logLink.length !== 1) {
            reject('No $logLink!');
            return;
        }
        let $l1, $l2;
        const performLogin = async () => {
            await delayPromise(5000);
            await mouseChain({target: $logLink[0], events: fullClick});
            await waitForConditionF(() => ($l1 = $('#rlLoginUsername:visible'), $l2 = $('input.lBuserName:visible'), $l1.length > 0 || $l2.length > 0),
                333, 30000, 'No inputs')();
            await delayFunction(1000)();
            await clearAndSimulate(($l1.length > 0 ? $l1 : $l2)[0], settings.login);
            await delayFunction(3333)();
            await clearAndSimulate(($l1.length > 0 ? $('#rlLoginPassword') : $('input[ng-model="user.password"]:visible'))[0], settings.password);
            await delayFunction(3333)();
            authClicked = Date.now();
            await mouseChain({
                target: ($l1.length > 0 ? $('#rlLoginSubmit') : $('input.LoginButtonInput'))[0],
                events: fullClick
            });
            await waitForNotConditionF(() => $(errSel).length > 0, 333, 5000, 'Error occurs!')()
                .catch(e => {
                    enterError = true;
                    throw `${e} ${$(errSel).trt()}`;
                });
        };
        if (Date.now() - authClicked > 60000) {
            performLogin().then(resolve, e => reject(e));
        } else {
            reject('Too soon!');
        }
    });

    /**
     * Check we're authorized (returns -1 if not) and returns balance
     * @param returnNull - if true - return null when balance does not exists
     * @return {number}
     */
    function getBalance(returnNull) {
        if ($('a[data-label="Login"]').length > 0) {
            return -1;
        }
        const $b = $('a[data-label="UserBalance"]');
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.text().replace('.', '').replace(',', '.').replace(/[^\d.]/g, '').trim());
    }

    const alternativeProcessor = message => {
        bMess('SPORT888_ALTER').remove();
        console.log('%c' + `alternateDeposit (${document.location.href}) %O`,
            'background: yellow; color: red; font-size: 14px; font-weight: bold; padding: 3px;', message);
        if (message.action === 'DEPOSIT') {
            const dRep = (success, message) => bMess('DEPOSIT_RESULT', true).set({
                success: success,
                message: message
            });
            const ppp = {
                'SKRILL': {
                    pText: 'Skrill',
                    sum: async () => {
                        const $el = await waitForElementF('input[name="c2Amount"]', 333, 30000)();
                        await delayPromise(3000);
                        await clearAndSimulate($el[0], message.data.amount);
                        await bMess('SKRILL_COMMAND', true).set(message);
                    }
                },
                'QIWI': {
                    pText: 'Qiwi Wallet',
                    sum: async () => {
                        const am = [20, 30, 50, 100, 200, 200].find((val, idx, arr) => {
                            const min = idx === 0 ? 0 : idx === arr.length - 1 ? val : arr[idx - 1],
                                max = idx === arr.length - 1 ? 1000000 : val,
                                a = parseFloat(message.data.amount);
                            console.log(`${min} => ${a} <= ${max}`);
                            return a >= min && a <= max;
                        });
                        await mouseChain({target: $(`li:contains("$${am}")`)[0], events: fullClick});
                        await delayPromise(3000);
                        await clearAndSimulate($('input[name="qiwiMobilePhone"]')[0], message.data.login.replace(/^\+/, ''));
                        await bMess('QIWI_COMMAND', true).set(message);
                    }
                },
                'NETELLER': {
                    pText: 'NETELLER',
                    sum: async () => {
                        const $el = await waitForElementF('input[name="c2Amount"]', 333, 30000)();
                        await delayPromise(3000);
                        await clearAndSimulate($el[0], message.data.amount);
                        await delayPromise(3000);
                        const $email = await waitForElement('input[name="netellerInputsEmail"]', 333, 10000)
                            .catch(() => $([]));
                        if ($email.length > 0) {
                            await clearAndSimulate($email[0], message.data.login);
                            await delayPromise(3000);
                        }
                        message.close = true;
                        await bMess('NETELLER_COMMAND', true).set(message);
                    }
                },
            };
            const p = ppp[message.data.paysystem];
            waitDelayClickF(`span[title="${p.pText}"]`, 30000, fullClick)()
                .then(delayFunction(3333))
                .then(() => p.sum())
                .then(delayFunction(3333))
                .then(() => mouseChain({target: $('#depositBtn:visible')[0], events: fullClick, scroll: true}))
                .then(async () => {
                    const $continue = await waitForElement('button[ng-click="securedPageVm.continueToMft()"]', 333, 10000)
                        .catch(() => $([]));
                    if ($continue.length > 0) {
                        await mouseChain({target: $continue[0], events: fullClick, error: '$continue'});
                    }
                })
                .catch(e => dRep(false, `alternativeProcessor DEPOSIT ONE: ${e}`));
        } else if (message.action === 'WITHDRAW') {
            const dRep = (success, message) => bMess('DEPOSIT_RESULT', true).set({
                success: success,
                message: message
            });
            waitForElement('span[title="WITHDRAWAL"]', 333, 30000)
                .then($el => delayPromise(3333, $el))
                .then($el => mouseChain({target: $el[0], events: fullClick}))
                .then(delayFunction(3333))
                .then(waitForElementF('input[name="c2Amount"]:visible', 333, 30000))
                .then($el => delayPromise(3333, $el))
                .then($el => clearAndSimulate($el[0], message.data.amount))
                .then(delayFunction(3333))
                .then(() => {
                    const email = $('span[ng-bind="dd.selectedItem.text"]:not([class])').attr('title');
                    if (email.indexOf(message.data.login) === -1) {
                        throw `Wrong email: '${email}'`;
                    }
                })
                .then(delayFunction(3333))
                .then(() => mouseChain({target: $('#automationWithdraw')[0], events: fullClick}))
                .then(waitForElementF('span.withdrawal-approved-title-text-approved:visible', 333, 30000))
                .then(() => dRep(true, 'Everything is Okay :)'))
                .catch(e => dRep(false, `alternativeProcessor WITHDRAW ONE: ${e}`));
        } else if (message.action === 'CHECK_PAYMENTS') {
            const dRep = (success, message, collected) => bMess('SPORT888_ALTER_RESULT')
                .set({success: success, message: message, collected: collected});
            const collected = [];
            const performCollect = ($el, isWithdrawal) => {
                $el.each(function () {
                    const $c = $(this);
                    collected.push({
                        date: (isWithdrawal ? $c.find('li.withdrawalDate') : $c.find('li.depositDate')).trt(),
                        description: '',
                        type: isWithdrawal ? 'OUT' : 'IN',
                        paysystem: isWithdrawal ? 'SKRILL' : $c.find('li.depositMethod span.mft-73').length > 0 ? 'QIWI' : 'SKRILL',
                        amount: (isWithdrawal ? $c.find('li.withdrawalAmount') : $c.find('li.depositAmount')).text().replace(/[^\d.]/g, '').trim(),
                        success: $c.find('li.' + (isWithdrawal ? 'withdrawalStatus' : 'depositStatus') + ' span.status-icon').attr('title') === 'Approved'
                    });
                });
                return collected;
            };
            waitForElement('span.icon-wrapper[data-ng-show="vm.popupLayout.header.showClose"]', 333, 15000)
                .then($el => delayPromise(3333, $el))
                .then($el => mouseChain({target: $el[0], events: fullClick}))
                .catch(e => console.log(e))
                .then(waitDelayClickF('li.menu-item:contains("HISTORY") span', 30000, fullClick))
                .then(waitForElementF('span[ng-if="dd.selectedItem.text"]', 333, 30000, true))
                .then($el => {
                    if ($el.attr('title') !== 'Last 3 months') {
                        return mouseChain({target: $el[0], events: fullClick})
                            .then(delayFunction(500))
                            .then(() => mouseChain({
                                target: $('li[ng-repeat="item in dd.uiItems"]:has(span:contains("Last 3 months"))')[0],
                                events: fullClick
                            }))
                            .then(delayFunction(3000));
                    }
                })
                .then(waitForElementF('div.content-item', 333, 30000))
                .then($el => performCollect($el, false))
                .then(() => {
                    const wSel = 'li.col-3:has(span:textEquals("Withdrawal")):visible';
                    if ($(wSel).length > 0) {
                        return waitDelayClickF(wSel, 1000, fullClick)()
                            .then(delayFunction(3333))
                            .then(waitForElementF('div.content-item', 333, 30000))
                            .then($el => performCollect($el, true));
                    }
                })
                .then(() => dRep(true, 'Must be collected!', collected))
                .catch(e => dRep(false, `alternativeProcessor DEPOSIT ONE: ${e}`, []));
        }
    };

    /**
     * --- NECESSARY PART ---
     */

    function afterDOMLoaded() {
        const isMain = window.self === window.top;
        bMess(isMain ? 'SPORT888' : 'SPORT888_ALTER').check(40000)
            .then(aCommand => currentCommand = aCommand)
            .then(waitForConditionF(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck),
                333, 60000, 'No auth check!'))
            .then(() => bsDebug(port, 'Restoring with: ', currentCommand))
            .then(() => isMain ? messageProcessor(currentCommand, false) : alternativeProcessor(currentCommand))
            .catch(e => console.log(`afterDOMLoaded ONE (${isMain}): ${e}`));
        isMain ? (port.postMessage({m: "PAGE LOADED!"}), console.log('loaded and message sent!'))
            : console.log(`Alternate loaded at: ${window.location.href}`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", () => {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            bMess('SPORT888').set(ourCommand.get(), increaseDelay ? 150000 : 0);
        }
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

})();
