(function () {

    "use strict";

    let authClicked = 0;
    let wasAuthCheck = false;
    let busy = false;
    let increaseDelay = false;
    const bkHere = document.location.href.indexOf('.32red.') > -1 ?
        "red32" : document.location.href.indexOf('.unibet.') > -1 ? 'unibet' : "unibet";
    const port = window.self === window.top ? chrome.runtime.connect({name: `port_${bkHere}`}) : {postMessage: () => console.log(arguments)};
    const urlSettings = document.location.href.indexOf('.32red.') > -1 ?
        "https://www.32red.com/sport" : document.location.href.indexOf('.unibet.') > -1 ? 'https://www.unibet.com/betting' : "https://www.unibet.com/betting";
    let settings = {
        authCheckInterval: 2000,
        url: urlSettings,
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
        'FOOTBALL': 'football',
        'TENNIS': '',
        'TABLETENNIS': 'table_tennis',
        'HOCKEY': '',
        'VOLLEYBALL': '',
        'BASEBALL': '',
        'BASKETBALL': 'basketball',
        'HANDBALL': '',
        'CYBERSPORT': 'esports',
    };

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
        if (message.action !== 'auth' && busy) {
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
        } else if ((typeof methods[message.action] === "function" && message.action !== 'REGISTER' && getBalance() !== -1) ||
            (message.action === 'REGISTER' && typeof methods[message.action] === "function")) {
            busy = true;
            ourCommand.set(message);
            methods[message.action](message.data)
                .then(() => bsDebug(port, "It's looks like " + message.action + " done!"))
                .catch(e => dLog('red', 'Uni',
                    `Error till ${message.action}: ${e}, ${formatStack(e.stack)}`))
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

    /**
     * Deposit method
     * @param data
     * @returns {Promise<any>}
     */
    const deposit = data => new Promise((onSuccess, onReject) => {
        bsDebug(port, 'Deposit!', data);
        const report = (s, m) => {
            bsDebug(port, `Report! ${s} / ${m}`);
            port.postMessage({
                answered: "DEPOSIT",
                status: s ? 'SUCCESS' : ['NO_FUNDS', 'RESTRICTED'].find(c => typeof m === 'string' && m.indexOf(c) > -1) || 'FAILED',
                answer: m
            });
            s ? onSuccess(m) : onReject(m);
            waitDelayClickF('a[title="Deposit"]')()
                .catch(() => window.location.reload());
            // mouseChain({target: $('a:textEquals("In-Play")')[0], events: ['click']}).then(m => m).catch(e => e);
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
                const depositButton = bkHere === 'unibet' ? 'a[title="Deposit"]' : 'a.deposit:contains("Deposit")';
                const depositLink = bkHere === 'unibet' ? 'payment.unibet.com' : '32red.com/swift';
                const bkLabel = bkHere === 'unibet' ? 'UNIBET_ALTER' : '32RED';
                delayPromise(111)
                    .then(waitForElementF(depositButton, 333, 20000))
                    .then($e => $el = $e)
                    .then(() => ourCommand.add('cashierOpened', true))
                    .then(() => bMess(bkLabel).set(ourCommand.get(), 0, [depositLink]))
                    .then(() => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                    .then(delayFunction(1111))
                    .then(() => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                    .then(() => {
                        const $thisLink = $('div.popover-content a[href="https://www.32red.com/swift"]');
                        if ($thisLink.length > 0) mouseChain({target: $thisLink[0], events: ['click']})
                    })
                    .then(delayFunction(1111))
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
                const localMatch = v.team1.toLowerCase() + ' - ' + v.team2.toLowerCase();
                return localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 60;
            });
            let $coupons = $('div[class$="betslip__content"]:visible div[class$="outcome__content"]:visible');
            let errors = [];
            let checked = 0;
            $coupons.each(function () {
                const $this = $(this);
                const match = $this.find('a[class$="event-link"]').text().trim().toLowerCase();
                const lc = $this.find('span.mod-KambiBC-betslip-outcome__odds').text().trim();
                if (['Closed', 'Suspended'].indexOf(lc) > -1) {
                    errors.push(`${match} LOW_COEF, market unavailable (${lc})!`);
                    checked++;
                    return true;
                }
                const localCoef = decOdds(lc);
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
                const error = errors.join('; ') + (checked !== data.length ? ' some stakes not checked (' +
                    checked + '/' + data.length + ')!' : '');
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
            if (success) onSuccess();
            else onReject(message);
        };
        const report = (success, message, willPlace) => {
            bsDebug(port, "Report (proceedBet) was fired with success: " + success + ', message: ' +
                message + ', willPlace: ' + willPlace,
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

        const waitForBetResult = async stake => {
            const ss = [
                'h2:contains("Your bet has been placed!")',
                'div.mod-KambiBC-betslip-feedback',
                'button[class*="approve-odds-btn"]:visible',
            ];
            await waitForCondition(() => ss.some(sel => $(sel).length > 0 && elementIsVisible($(sel)[0])),
                333, 30000, 'No result!');
            if ($(ss[0]).length > 0 && elementIsVisible($(ss[0])[0])) {
                await delayPromise(1000);
                const $bs = $('div.mod-KambiBC-betslip__receipt');
                const res = {
                    external_id: $bs.find('p[class$="receipt-id"]').text().replace(/[^\d]/g, '').trim(),
                    stake: $bs.find('span[class$="receipt__stake"]').text().replace(/[^\d.]/g, '').trim(),
                    coef: decOdds($bs.find('div[class$="receipt__row"]:contains("Total odds") dd[class$="receipt__value"]').text()).toString()
                };
                await mouseChain({
                    target: $('button[class$="receipt__close-button"]')[0],
                    events: fullClick,
                    error: 'waitForBetResult 1'
                });
                return res;
            } else if ($(ss[1]).length > 0 && elementIsVisible($(ss[1])[0])) {
                const max = $(ss[1]).text().trim().indexOf('the maximum allowed stake') > -1 ?
                    $('div.mod-KambiBC-betslip-feedback')
                        .find('span[class$="currency"]').text()
                        .replace(/[^\d.]/g, '').trim() : false;
                const $sb = $('button.mod-KambiBC-betslip-button:visible');
                if ($sb.length > 0) {
                    await mouseChain({target: $sb[0], events: fullClick, error: 'waitForBetResult 2'});
                    await delayPromise(500);
                }
                if (max !== false && max > 0) {
                    currentBetData.max = max;
                    return checkAndPlaceBet(max, true);
                } else if (parseFloat(max) === 0) {
                    throw 'LIMITED: ' + $(ss[1]).trt();
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

        let inputs = 0;
        const checkAndPlaceBet = async (stake, couponOpened) => {
            if (!couponOpened) {
                await openCoupon(data);
            }
            await checkCoefs(data);
            if (!await checkErrors()) {
                return checkAndPlaceBet(stake, true);
            }
            const $input = await waitForElement('div.mod-KambiBC-betslip__content input[class$="stake-input"]:visible', 333, 2000, true);
            await clearAndSimulate($input[0], stake);
            await delayPromise(500);
            if (parseFloat($input.val()) !== parseFloat(stake)) {
                inputs++;
                const mess = `Bad input: ${$input.val()} instead of ${stake} (${inputs})`;
                if (inputs <= 3) {
                    console.log('%c' + mess + ' - reenter!', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    return checkAndPlaceBet(stake, true);
                } else {
                    throw mess;
                }
            }
            if (!await checkErrors()) {
                return checkAndPlaceBet(stake, true);
            }
            await mouseChain({
                target: $('button.mod-KambiBC-betslip__place-bet-btn:visible')[0],
                events: fullClick
            });
            return waitForBetResult(stake);
        };

        checkAndPlaceBet(data[0].stake, false)
            .then(m => report(true, m))
            .catch(e => report(false, `Error during performBet: ${e}, ${formatStack(e.stack)}`));
    });

    /**
     * Collect data from history bets
     * @param inD
     * @returns {Promise<any>}
     */
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

        (async () => {
            let myBetsSelect = 'a:textEquals("My Bets")';
            if (bkHere === 'red32') {
                myBetsSelect = 'a:textEquals("My-Bets")';
                await switchOdds();
                await delayPromise(555);
            }
            await clickSequence([
                new QueueObject(myBetsSelect, $el => $el.css("background-color") !== 'rgb(14, 95, 49)'),
                new QueueObject('li.KambiBC-tabs__tab:contains("All")', $el => $el.attr("aria-selected") !== 'true'),
            ]);
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
                const $mb = await waitForElement(myBetsSelect, 333, 3000, true);
                await mouseChain({target: $mb[0], events: fullClick, error: 'my bets'});
                await waitForElement('div.KambiBC-my-bets-summary__coupon', 333, 30000);
                await delayPromise(getRandomRounded(1000, 2000));
                return !(reviewed >= limit || (data.length > 0 && collected.length >= data.length));
            });
        })()
            .then(() => report(true, `Everything collected! (${reviewed})`))
            .catch(e => report(false, `Error collecting: ${e}`));
    });

    /**
     * Check payments
     * @returns {Promise<any>}
     */
    const checkPayments = () => new Promise(function (onSuccess, onReject) {
        bsDebug(port, 'checkPayments!');
        let collected = [];
        const report = function (success, message) {
            bsDebug(port, 'Report! ' + success + ' / ' + message);
            port.postMessage({
                answered: "CHECK_PAYMENTS",
                data: success ? collected : [],
                answer: message
            });
            success ? onSuccess(message) : onReject(message);
            //delayPromise(5000).then(() => window.location.reload());
        };

        const collect = async type => {
            let $rows;
            $rows = await waitForElement('tbody.standard-transactions tr:visible', 333, 20000)
                .catch(e => (bsDebug(port, `Looks like there is no ${type} (${e})`), $([])));
            await delayPromise(3000);
            $rows.each(function () {
                const $c = $(this);
                const desc = $c.find('td:not([class])').text().trim();
                collected.push({
                    date: $c.find('td.column-date p:first').text().trim(),
                    description: desc,
                    type: type,
                    paysystem: desc.indexOf('Neteller') > -1 ? 'NETELLER' : 'SKRILL',
                    amount: $c.find('td.column-money').text().replace(/[^\d.]/g, '').trim(),
                    success: true
                });
            });
        };

        const letsRockNRoll = async () => {
            if (document.location.href.indexOf('/myaccount/mygamingactivity/accounthistory') > -1) {
                const $deposits = await waitForElement('a.link-item:contains("Deposits")', 333, 30000);
                if ($deposits.css("background-color") !== 'rgb(14, 95, 49)') {
                    await mouseChain({target: $deposits[0], events: fullClick, error: 'Deposits'});
                    await collect('IN');
                }
                const $withdrawals = await waitForElement('a.link-item:contains("Withdrawals")', 333, 30000);
                if ($withdrawals.css("background-color") !== 'rgb(14, 95, 49)') {
                    await mouseChain({target: $withdrawals[0], events: fullClick, error: 'Withdrawals'});
                    await collect('OUT');
                }
                report(true, 'Must be collected!');
            } else {
                bsDebug(port, `Let's go to payments history!`);
                await clickSequence([{s: 'a.account-box-button'}, {s: 'a.has-icon-prefix[href="/myaccount/mygamingactivity/accounthistory"]'}]);
            }
        };
        letsRockNRoll()
            .catch(e => report(false, `CheckPayments LRNR: ${e}`));
    });

    const notSupported = data => new Promise(function (onSuccess, onReject) {
        bsDebug(port, 'notSupported!');
        //delayPromise(7777).then(() => report(true, {login: data['nickname'], password: data['password']}))
        onReject('Not supported!');
    });

    const methods = {
        'MAXIMUM': notSupported,
        'DEPOSIT': deposit,
        'WITHDRAW': notSupported,
        'CHECK_PAYMENTS': checkPayments,
        'BET_RESULT': collectBetResults,
        'BET': proceedBet,
        'EXPRESS_BET': proceedBet,
        'MONITOR': notSupported,
        'REGISTER': notSupported
    };

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
        const checkCoupon = async () => {
            const event = (data.team1 + ' - ' + data.team2).toLowerCase(),
                matches = [];
            let $result = $([]);
            const sel = 'div[class$="betslip__content"]:visible div[class$="outcome__content"]:visible';
            await waitForElement(sel, 333, 15000);
            await waitForCondition(() => $(sel).length >= (ourCommand.getAdded('express') === false ? 1 : 2),
                400, 15000, 'Wrong length of events in coupon!');
            await delayPromise(400);
            const $events = $(sel);
            $events.each(function () {
                const $this = $(this);
                const teams = $this.find('a[class$="event-link"]').text().trim().toLowerCase();
                matches.push(teams);
                const equals = event === teams || locutus_similar_text(event, teams, true) > 70;
                console.log('%c' + `${$events.length} ${event} === ${teams} ? ${equals}`, 'background: transparent; color: green; font-size: 13px; font-weight: bold; padding: 5px;');
                if (equals) {
                    $result = $this;
                    return false;
                }
            });
            if ($result.length === 0) {
                throw 'Wrong match opened: ' + matches.join(', ');
            }
            return $result;
        };
        let lData = paramData.slice();
        let data = {};
        let $betElement;
        const openElement = function () {
            const betOdds = bkHere === 'unibet' ? 'span.KambiBC-mod-outcome__odds' : 'div[class^="OutcomeButton__Odds-sc"]';
            closePreviousCoupons(ourCommand.getAdded('express'))
                .then(() => openEvent(data))
                .then(() => getBetElement(data))
                .then($el => $betElement = $el)
                .then(() => bsDebug(port, 'We got element! Coef: ' + $betElement.find(betOdds).text().trim()))
                .then(() => mouseChain({target: $betElement[0], events: fullClick}))
                .then(waitForElementF('div[class$="betslip__content"]:visible', 333, 20000))
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
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<object,string>} jQuery element for bet
     */
    const getBetElement = data => new Promise(function (reportSuccess, reportReject) {
        //#-#-START
        let found = false;

        let onSuccess = function ($d) {
            if (typeof $d[0] === 'undefined') {
                onReject('Bet inactive!');
            } else {
                found = true;
                const odd = $d.find('div>div').last().text().trim();
                console.log('%cSuccess: %c' + odd,
                    'background: green; color: white;',
                    'background: green; color: white; font-weight: bold;');
                $d.closest('li.KambiBC-bet-offer-subcategory')[0].scrollIntoView();
                window.scrollBy(0, -50);
                reportSuccess($d);
            }
        };

        let onReject = function (d) {
            console.log('%cReject', 'background: red;');
            console.log(d);
            reportReject(d);
        };

        const scores = ['span[class$="participant-score"]', 'div[class$="scorecard-score"] span'];
        const $scores = $(scores[0]).length > 0 ? $(scores[0]) : $(scores[1]);
        const scoreH = `${$scores.eq(0).trt()} - ${$scores.eq(1).trt()}`;

        let eventName = (() => {
            const $name = $('span[class$="participant-name"]');
            if ($name.length === 2) {
                return $name.eq(0).trt() + ' v ' + $name.eq(1).trt();
            } else if ($name.length === 1) {
                return $name.trt().replace(' - ', ' v ');
            } else {
                throw 'No teams!';
            }
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

        console.log('%c' + `${data.team1} / ${data.team2} = ${data.team1b} / ${data.team2b}`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');

        // Hint: we must search 'Selected Markets' superRoot always
        let markets = {
            'ONE_TWO': {
                'ONE': {
                    superRoots: ['Full Time'],
                    roots: ['Full Time'],
                    pivotKeys: ['#TEAM1B#']
                },
                'TWO': {
                    superRoots: ['Full Time'],
                    roots: ['Full Time'],
                    pivotKeys: ['#TEAM2B#']
                },
                'DRAW': {
                    superRoots: ['Full Time'],
                    roots: ['Full Time'],
                    pivotKeys: ['Draw']
                },
                'ONE_DRAW': {
                    superRoots: ['Full Time'],
                    roots: ['Double Chance'],
                    pivotKeys: ['1X']
                },
                'TWO_DRAW': {
                    superRoots: ['Full Time'],
                    roots: ['Double Chance'],
                    pivotKeys: ['X2']
                },
                'ONE_TWO': {
                    superRoots: ['Full Time'],
                    roots: ['Double Chance'],
                    pivotKeys: ['12']
                }
            },
            'TOTAL': {
                'OVER': {
                    superRoots: ['Full Time', 'Asian Lines'],
                    roots: ['Total Goals', 'Asian Total'],
                    pivotKeys: ['Over',]
                },
                'UNDER': {
                    superRoots: ['Full Time', 'Asian Lines'],
                    roots: ['Total Goals', 'Asian Total'],
                    pivotKeys: ['Under',]
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    superRoots: ['Full Time', 'Asian Lines'],
                    roots: ['Total Goals by #TEAM1B#'],
                    pivotKeys: ['Over',]
                },
                'UNDER': {
                    superRoots: ['Full Time', 'Asian Lines'],
                    roots: ['Total Goals by #TEAM1B#'],
                    pivotKeys: ['Under',]
                }
            },
            'T2_TOTAL': {
                'OVER': {
                    superRoots: ['Full Time', 'Asian Lines'],
                    roots: ['Total Goals by #TEAM2B#'],
                    pivotKeys: ['Over',]
                },
                'UNDER': {
                    superRoots: ['Full Time', 'Asian Lines'],
                    roots: ['Total Goals by #TEAM2B#'],
                    pivotKeys: ['Under',]
                }
            },
            'CORNER_TOTAL': {
                'OVER': {
                    superRoots: ['Corners'],
                    roots: ['Total Corners'],
                    pivotKeys: ['Over',]
                },
                'UNDER': {
                    superRoots: ['Corners'],
                    roots: ['Total Corners'],
                    pivotKeys: ['Under',]
                },
            },
            'HDP': {
                'HOME': {
                    superRoots: ['Full Time', 'Asian Lines'],
                    roots: ['Draw No Bet', 'Handicap', 'Asian Handicap (#SCORE#)'],
                    pivotKeys: ['#TEAM1B#']
                },
                'AWAY': {
                    superRoots: ['Full Time', 'Asian Lines'],
                    roots: ['Draw No Bet', 'Handicap', 'Asian Handicap (#SCORE#)'],
                    pivotKeys: ['#TEAM2B#']
                }
            },
            'EURO_HDP': {
                'H1': {
                    superRoots: ['Full Time',],
                    roots: ['3-Way Handicap'],
                    pivotKeys: ['#TEAM1B#']
                },
                'H2': {
                    superRoots: ['Full Time',],
                    roots: ['3-Way Handicap'],
                    pivotKeys: ['#TEAM2B#']
                },
                'HX': {
                    superRoots: ['Full Time',],
                    roots: ['3-Way Handicap'],
                    pivotKeys: ['Draw']
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

        const params = new AllMarkets(data);
        params.proceed_football = function (data) {
            if (data.time_value.indexOf('FULL') === -1) {
                this.addReplacement('superRoots', 'Full Time', 'Half Time');
                // Time
                this.addReplacement('roots', 'Full Time', 'Half Time');
                this.addReplacement('roots', 'Double Chance', 'Double Chance - 1st Half');
                // Total
                if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) === -1) {
                    this.addReplacement('roots', 'Total Goals', 'Total Goals - 1st Half');
                }
                this.addReplacement('roots',
                    'Total Goals by #TEAM1B#', 'Total Goals by #TEAM1B# - 1st Half');
                this.addReplacement('roots',
                    'Total Goals by #TEAM2B#', 'Total Goals by #TEAM2B# - 1st Half'
                );
                this.addReplacement('roots', 'Total Corners', 'Total Corners - 1st Half');
                // HDP
                this.addReplacement('roots', 'Draw No Bet', 'Draw No Bet - 1st Half');
                if (data.market !== 'EURO_HDP') {
                    this.addReplacement('roots', 'Handicap', 'Handicap - 1st Half');
                }
                this.addReplacement('roots', '3-Way Handicap', '3-Way Handicap - 1st Half');
            }
        };
        params.proceed_tennis = function (data) {
            const gs = data.time_value.indexOf('_GAME_') > -1;
            const parts = data.time_value.split('_GAME_');
            this.addReplacement('superRoots', 'Full Time',
                this.full ? 'Match' : gs ? 'Game' : `Set`);
            if (data.market === 'ONE_TWO') {
                this.addReplacement('roots', 'Full Time',
                    this.full ? 'Match Odds' :
                        gs ?
                            `Set ${parts[0].replace(/[^\d]/g, '')} - Game ${parts[1]}` :
                            `Set ${this.tDigit}`
                );
            } else if (data.market === 'TOTAL') {
                this.addTotal('roots', [
                    this.full ? 'Total Games' : `Total Games - Set ${this.tDigit}`
                ]);
            } else if (data.market === 'HDP') {
                this.addTotal('roots', [
                    'Game Handicap'
                ]);
            }
        };
        params.proceed_hockey = function (data) {
            this.addReplacement('superRoots', 'Full Time',
                this.full ? 'Match - Regular Time' : `Period ${this.tDigit}`
            );
            if (data.market === 'ONE_TWO' && ['ONE', 'TWO', 'DRAW'].indexOf(data.target) > -1) {
                this.addTotal('roots', [
                    this.full ? 'Match Odds - Regular Time' : `Period ${this.tDigit}`,
                ]);
            } else if (data.market === 'ONE_TWO') {
                this.addTotal('roots', [
                    'Double Chance - ' + (this.full ? `Regular Time` : `Period ${this.tDigit}`)
                ]);
            } else if (data.market === 'TOTAL') {
                this.addTotal('roots', [
                    'Total Goals - ' + (this.full ? `Regular Time` : `Period ${this.tDigit}`)
                ]);
            } else if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                this.addTotal('roots', [
                    `Total Goals by #TEAM${data.market.replace(/[^\d]/g, '')}# - ` +
                    (this.full ? `Regular Time` : `Period ${this.tDigit}`)
                ]);
            } else if (data.market === 'HDP') {
                this.addTotal('roots', [
                    'Handicap - ' + (this.full ? `Regular Time` : `Period ${this.tDigit}`)
                ]);
            } else if (data.market === 'EURO_HDP') {
                this.addTotal('roots', [
                    '3-Way Handicap - ' + (this.full ? `Regular Time` : `Period ${this.tDigit}`)
                ]);
            }
            if (data.market === 'HDP' && parseInt(data.pivot) === 0) {
                this.addTotal('roots', [
                    'Draw No Bet - ' + (this.full ? `Regular Time` : `Period ${this.tDigit}`)
                ]);
            }
        };
        params.proceed_basketball = function (data) {
            this.addReplacement('superRoots', 'Full Time',
                this.full ? 'Match' : `Quarter ${this.tDigit}`);
            if (data.market === 'ONE_TWO') {
                this.addTotal('roots', [
                    this.full ? 'Including Overtime' : `Quarter ${this.tDigit}`
                ]);
            } else if (data.market === 'TOTAL') {
                this.addTotal('roots', [
                    this.full ? 'Total Points - Including Overtime' : `Total Points - Quarter ${this.tDigit}`
                ]);
            } else if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                this.addTotal('roots', [`Total Points by #TEAM${data.market.replace(/[^\d]/g, '')}# - Including Overtime`]);
            } else if (data.market === 'HDP') {
                this.addTotal('roots', [
                    this.full ? 'Handicap - Including Overtime' : `Handicap - Quarter ${this.tDigit}`
                ]);
            }
            if (data.market === 'HDP' && parseInt(data.pivot) === 0) {
                this.addTotal('roots', [
                    this.full ? 'Draw No Bet' : `Draw No Bet - Quarter ${this.tDigit}`
                ]);
            }
        };
        params.proceed_cybersport = function (data) {
            this.addReplacement('superRoots', 'Full Time',
                this.full ? 'Match' : `Map Betting`);
            if (data.market === 'ONE_TWO') {
                this.addTotal('roots', [
                    this.full ? 'Match Odds' : `Map ${this.tDigit}`
                ]);
            } else if (data.market === 'HDP') {
                this.addTotal('roots', [
                    this.full ? 'Map Handicap' : `Map Handicap - Map ${this.tDigit}`
                ]);
            }
        };

        const final = applyAllMarkets(data, ['superRoots', 'roots'], params, markets);

        let replaceInner = function (element, parent, index) {
            if (typeof element === 'string') {
                parent[index] = element.replace('#TEAM1#', data.team1).replace('#TEAM2#', data.team2)
                    .replace('#TEAM1B#', data.team1b).replace('#TEAM2B#', data.team2b)
                    .replace('#PIVOT#', data.pivot).replace('#PIVOTR#', specialPivotFormatter(data.market, data.pivot))
                    .replace('#PIVOTR2#', specialPivotFormatter(data.market, data.pivot, true))
                    .replace('#PIVOTZ#', specialPivotZFormatter())
                    .replace('#PIVOTH#', specialEuroHDPFormatter())
                    .replace('#SCORE#', scoreH);
            } else if (typeof element === 'object') {
                for (let i in element) {
                    replaceInner(element[i], element, i);
                }
            } else {
                // console.log(typeof element + ' not supported! (' + element + ')');
            }
        };
        replaceInner(final, null, null);

        let finalPrepareForMarket = function (market) {
            market.rootsLC = market.roots.map(v => v.toLowerCase());
            return market;
        };

        let market = finalPrepareForMarket(final[data.market][data.target]);

        console.log('%cFinal market is:', 'background: green; color: white; font-weight: bold;');
        console.log(market);

        const eHDPp = pvt => {
            const parts = pvt.replace(/[()]/g, '').split('-');
            return parseInt(parts[0]) - parseInt(parts[1]);
        };

        const letsFind = () => {
            $('li.KambiBC-bet-offer-category').eachAsync(async (idx, val) => {
                const $this = $(val),
                    currentSuperRoot = $this.find('div[class^="CollapsibleContainer__Title-"]').trt();
                if (currentSuperRoot !== 'Selected Markets' && currentSuperRoot !== 'Most Popular'
                    && market.superRoots.indexOf(currentSuperRoot) === -1) {
                    console.log(`'${currentSuperRoot}' - exiting!`);
                    return true;
                } else {
                    console.log(`Checking '${currentSuperRoot}'!`);
                }
                if (!$this.hasClass('KambiBC-expanded')) {
                    $this.parent()[0].scrollIntoView();
                    await delayPromise(777);
                    await mouseChain({target: $this.find('div[class^="CollapsibleContainer__Title-sc-"]')[0], events: fullClick});
                    await delayPromise(1888);
                }
                for (let cRoot of market.roots) {
                    const $rootSel = () => $this.find(`div[class$="KambiBC-bet-offer-subcategory__container"]`)
                        .find(`h3:textEqualsIS("${cRoot}")`);
                    const $root = $rootSel().closest('div.KambiBC-bet-offer-subcategory__container');
                    if ($root.length === 1 && !found) {
                        console.log(`Checking root '${cRoot}'`);
                        // Show list if needed
                        if($rootSel().find('button:textEquals("Show list")').length > 0) {
                            await delayPromise(555);
                            await mouseChain({target: $rootSel().find('button:textEquals("Show list")')[0], events: fullClick});
                            await delayPromise(1222);
                        }
                        market.pivotKeys.some(pk => {
                            const $pivot = $root.find(`div[class^="OutcomeButton__Label-sc-"]:textEquals("${pk}")`)
                                .filter((idx, val) => {
                                    if (data.market === 'ONE_TWO' || (data.market === 'HDP' && parseFloat(data.pivot) === 0)) {
                                        return true;
                                    } else {
                                        const pvt = $(val).parent().find('div').last().text().trim();
                                        console.log(`${pk} : ${pvt} / ${parseFloat(data.pivot)} === ${eHDPp(pvt)}`);
                                        return data.market === 'EURO_HDP' ? parseFloat(data.pivot) === eHDPp(pvt) : parseFloat(data.pivot) === parseFloat(pvt);
                                    }
                                });
                            if ($pivot.length > 0) {
                                onSuccess($pivot.closest('button'));
                            }
                        });
                    } else if (!found) {
                        console.log(`Root '${cRoot}' not found :(`, $this);
                    }
                    if (found) {
                        return false;
                    }
                }
            }).then(e => found ? console.log('We found it!') : onReject(`Bet not found :(`))
                .catch(e => onReject(`Bet not found (${e}, ${formatStack(e.stack)})`));
        };

        $(window).scrollTop(0);
        waitForElement('div.KambiBC-betoffer-categories-view', 333, 10000)
            .then(delayFunction(777))
            .then(letsFind)
            .catch(e => onReject(`Markets not found (${e})`));
        //#-#-FINISH
    });

    /**
     * Open event
     * @param {object} data
     * @returns {Promise<string>}
     */
    const openEvent = async data => {
        bsDebug(port, 'openEvent', data);
        const team1 = data.team1.toLowerCase();
        const team2 = data.team2.toLowerCase();
        const eventName = team1 + ' v ' + team2;
        let sport = typeof sportAccordance[data.sport] === 'undefined' ? '' : sportAccordance[data.sport];
        if (sport === '') {
            throw 'Sport ' + data.sport + ' not supported or presented :(';
        }
        const checkScore = async () => {
            if (data.score === '' || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                await delayPromise(500);
            } else {
                const scores = ['span[class$="participant-score"]', 'div[class$="scorecard-score"] span'];
                await waitForCondition(() => scores.some(s => $(s).length > 0), 333, 30000, 'SCORE_CHANGED! No score 1 :(');
                const $scores = $(scores[0]).length > 0 ? $(scores[0]) : $(scores[1]);
                if ($scores.length !== 2) {
                    throw 'SCORE_CHANGED! No score 2 :('
                } else if (`${$scores.eq(0).text().trim()}:${$scores.eq(1).text().trim()}` !== data.score.replace(/[^\d:]/g, '').trim()) {
                    throw `SCORE_CHANGED openEvent/checkScore! We have: ${$scores.eq(0).text().trim()}:${$scores.eq(1).text().trim()}, we need: ${data.score}`;
                }
            }
        };
        const expandAllCounries = async () => {
            $('div.KambiBC-mod-event-group-container:not(.KambiBC-expanded)')
                .eachAsync(async (idx, val) => {
                    await mouseChain({target: $(val).find('header')[0], events: ['click']});
                    await delayPromise(444);
                });
        }
        const expandLeague = async (league) => {
            const $league = $(`div.KambiBC-mod-event-group-container div:textEquals("${league}")`);
            if ($league.length === 0) {
                throw `${league} not found!`;
            }
            $league[0].scrollIntoView();
            if ($league.closest('div.KambiBC-expanded').length === 0) {
                await mouseChain({
                    target: $league[0],
                    events: fullClick,
                    error: `error expand league '${league}'`,
                    scroll: true,
                });
            }
            await delayPromise(555);
        }
        const checkWeAreThere = function () {
            const $teams = $('span[class$="__participant-name"]');
            if ($teams.length === 2 || $teams.length === 1) {
                const name = $teams.length === 2
                    ? ($teams.eq(0).text().trim() + ' v ' + $teams.eq(1).text().trim()).toLowerCase()
                    : $teams.trt().replace(' - ', ' v ').toLowerCase();
                return (name === eventName || locutus_similar_text(name, eventName, true) > 70);
            } else {
                return false;
            }
        };
        const findEvent = async () => {
            const getScore = function ($evt) {
                const scoreWraper = bkHere === 'unibet' ? 'div.KambiBC-event-item__event-wrapper' : 'li.KambiBC-event-result__match';
                const $scores = $evt.find(scoreWraper)
                    .find('span.KambiBC-event-result__points');
                return $scores.length === 2 ? `${$scores.eq(0).text().trim()}:${$scores.eq(1).text().trim()}` : `Wrong scores: ${$scores.length}`;
            };
            const tryToFindEvent = $leagueWrapper => {
                let $el = null;
                dLog('green', 'Uni', `We'll try to find event!`);
                const $ts = $leagueWrapper.find('div.KambiBC-event-participants__name');
                const eventHere = $ts.length === 2 ? ($ts.eq(0).text().trim() + ' v ' + $ts.eq(1).text().trim()).toLowerCase() : '';
                //dLog('green', 'Uni', `'${eventHere}' === '${eventName}'`);
                if (eventHere === eventName || locutus_similar_text(eventHere, eventName, true) > 80) {
                    $el = $leagueWrapper;
                }

                return $el;
            };

            let $ourEvent = null;
            let league = data.league.split('.');
            league = league.length > 1 ? league[1].trim() : league[0].trim();

            if (bkHere === 'unibet') {
                await expandAllCounries();
                await delayPromise(2555);
                await expandLeague(league);
            }
            const bkEvents = bkHere === 'unibet' ? 'li.KambiBC-event-item' : 'li.KambiBC-sandwich-filter__event-list-item';
            await $(bkEvents).eachAsync(async (idx, val) => {
                league = $(val).parent().prev().text().trim();
                //dLog('green', 'Uni', `Checking league ${league}`);
                $ourEvent = tryToFindEvent($(val));
                if ($ourEvent) {
                    return false;
                }
            });

            if (!$ourEvent) {
                throw `Event ${eventName} not found :(`;
            } else if (bkHere === 'unibet' && data.league.indexOf(league) === -1) {
                throw `League ${eventName} not found :(`;
            } else if (data.score === '' || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1 ||
                getScore($ourEvent) === data.score.replace(/[^\d:]/g, '').trim()) {
                await mouseChain({target: $ourEvent.find('a')[0], events: ['click']});
                await delayPromise(1500);
            } else {
                throw `SCORE_CHANGED: we need: ${data.score}, we have: ${getScore($ourEvent)}`;
            }
        };
        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }
        let clickSequenceParams = [];
        if (bkHere === 'unibet') {
            const selection = data.type === 'LIVE'
                ? ['a:contains("In-Play")', 'a:textEquals("Live")']
                : 'a:contains("Upcoming")';
            clickSequenceParams = [
                new QueueObject(
                    selection,
                    $el => $el.css("background-color") !== 'rgb(14, 95, 49)',
                    null,
                    false,
                    0,
                    true, true),
                new QueueObject(
                    () => $(`li`)
                        .find(`span[class$="KambiBC-navicon__sport-icon--${sport}"]`),
                    $el => $el.find('div.active').length === 0,
                    null,
                    false,
                    5555)
            ];
        } else {
            sport = sport.charAt(0).toUpperCase() + sport.slice(1);
            clickSequenceParams = [
                new QueueObject(
                    'a:contains("In-play")',
                    $el => $el.css("background-color") !== 'rgb(14, 95, 49)',
                    null,
                    false,
                    0,
                    true),
                new QueueObject(
                    `li div.KambiBC-filter-menu__option:textEquals("${sport}")`,
                    $el => $el.hasClass('KambiBC-filter-menu__option--selected') !== true)
            ];
        }
        await clickSequence(clickSequenceParams);
        await findEvent();
        await waitForCondition(() => checkWeAreThere(),
            777, 45000, 'It looks like we are not there!');
        await checkScore();
        return 'Event opened!';
    };

    /**
     * Switch format odds
     * @returns {Promise<void>}
     */
    const switchOdds = async () => {
        await delayPromise(555);
        const $kambiBC = $('#KambiBC-odds-format-select');
        if ($kambiBC.length) {
            if ($kambiBC.val() === 'decimal') return;
        }

        const $sb = await waitForElement('a[data-group-id="#settings"]', 333, 10000);
        await mouseChain({target: $sb[0], events: fullClick, error: 'error clicking settings!'});
        await delayPromise(555);
        const $gc = await waitForElement('div.KambiBC-settings-group__container', 333, 10000);

        if ($gc.find('span.KambiBC-react-collapsable-container__header__extra:contains("Decimal")').length === 0) {
            await mouseChain({
                target: $gc.find('span.KambiBC-react-collapsable-container__header__title:contains("Odds format")').next()[0],
                events: fullClick,
                error: 'error clicking odds format!'
            });
            await delayPromise(1555);
            await mouseChain({
                target: $gc.find('span.KambiBC-react-collapsable-container__header__title:contains("Odds format")').parent().next().find('label[for="decimal"]')[0],
                events: fullClick,
                error: 'error clicking odds format!'
            });
        }
    }

    /**
     * Check authorization
     */
    let backButtonOccurs = 0;
    const authCheck = function () {
        if (enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            bsError(port, 'ERROR AUTH!');
            return;
        }
        let $emailInput = [];
        //console.log('%c authCheck', 'background: red; color: white;');
        closeAllWeNeed({
            '#CybotCookiebotDialogBodyButtonAccept': '#CybotCookiebotDialogBodyButtonAccept',
            'a.notification-close-button.close-button': 'a.notification-close-button.close-button',
            'a.close-notifications.icon': 'a.close-notifications.icon',
            '#closeCookie': '#closeCookie',
            'section[class^="RealityCheckstyle__Section"] button:contains("Continue")': 'section[class^="RealityCheckstyle__Section"] button:contains("Continue")',
            'a.btn.session-expired': 'a.btn.session-expired',
            'button#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll': 'button#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
            'button[data-test-name="accept-button"]:textEquals("Accept")': 'button[data-test-name="accept-button"]:textEquals("Accept")'
        }).then(m => m).catch(e => e);
        const $bb = $('button.mod-KambiBC-betslip-button:contains("Back")');
        if ($bb.length > 0 && backButtonOccurs < 3) {
            backButtonOccurs++;
        } else if ($bb.length > 0) {
            mouseChain({target: $bb[0], events: fullClick, error: '$bb'})
                .then(() => backButtonOccurs = 0)
                .catch(() => backButtonOccurs = 0);
        } else {
            if (window.location.href.indexOf('unibet.eu') > -1) {
                waitForCondition(() => $('button[data-test-name="header-login-button"]').length > 0 || $('span.total-amount').length > 0, 333, 15000, 'no login status')
                    .catch((e) => bsError(port, 'Error within login: ' + e));
                if ($('button[data-test-name="header-login-button"]').length > 0) {
                    mouseChain({
                        target: $('button[data-test-name="header-login-button"]')[0],
                        events: ['click'],
                        error: 'login'
                    })
                        .then(delayFunction(2222))
                        .catch((e) => bsError(port, 'Error within login: ' + e))
                }
            } else if (bkHere === 'red32') {
                waitForCondition(() => $('input[name="username"]').length > 0 || $('span.total-amount').length > 0, 333, 15000, 'no login status')
                    .catch((e) => bsError(port, 'Error within login: ' + e));
            } else {
                waitForCondition(() => $('button[data-test-name="header-login-button"]').length > 0 || $(findSel(['span.total-amount', 'span.cash-amount'])).length > 0, 333, 15000, 'no login status')
                    .catch((e) => bsError(port, 'Error within login: ' + e));
                if ($('button[data-test-name="header-login-button"]').length > 0) {
                    mouseChain({
                        target: $('button[data-test-name="header-login-button"]')[0],
                        events: ['click'],
                        error: 'login'
                    })
                        .then(delayFunction(2222))
                        .catch((e) => bsError(port, 'Error within login: ' + e))
                }
            }
        }

        if (window.location.href.indexOf('unibet.eu') > -1) {
            $emailInput = $('input[data-test-name="kaf-username-email-field"]:visible');
        } else if (bkHere === 'red32') {
            $emailInput = $('input[name="username"]:visible');
        } else {
            $emailInput = $('input[data-test-name="kaf-username-email-field"]:visible');
        }

        if ($emailInput.length > 0) {
            port.postMessage({m: "tech works! 2"});
            delayPromise(1000)
                .then(tryToLogIn)
                .then(() => bsDebug(port, "Credentials entered..."))
                .catch((e) => bsError(port, 'Error within login: ' + e))
                .then(delayFunction(settings.authCheckInterval))
                .then(authCheck);
        } else if (getBalance(true) === null) {
            port.postMessage({m: "tech works! 2"});
            delayPromise(settings.authCheckInterval).then(authCheck);
        } else {
            port.postMessage({
                m: "authorized!",
                balance: getBalance(true)
            });
            delayPromise(settings.authCheckInterval).then(authCheck);
        }
    };

    /**
     * Try to login to account
     * @returns {Promise<any>}
     */
    const tryToLogIn = () => new Promise(function (resolve, reject) {
        let $emailInput = [];
        let $passwordInput = [];

        if (window.location.href.indexOf('unibet.eu') > -1) {
            $emailInput = $('input[data-test-name="kaf-username-email-field"]:visible');
            $passwordInput = $('input[data-test-name="kaf-password-field"]:visible');
        } else if (bkHere === 'red32') {
            $emailInput = $('input[name="username"]:visible');
            $passwordInput = $('input[name="password"]:visible');
        } else {
            $emailInput = $('input[data-test-name="kaf-username-email-field"]:visible');
            $passwordInput = $('input[data-test-name="kaf-password-field"]:visible');
        }

        if ($emailInput.length !== 1) {
            reject('No $logLink!');
            return;
        }

        const performLogin = function () {
            delayPromise(3333)
                .then(() => bkHere === 'unibet' ? clearAndInputEmail($emailInput[0], settings.login) : clearAndSimulate($emailInput[0], settings.login))
                .then(delayFunction(3333))
                .then(() => clearAndSimulate($passwordInput[0], settings.password))
                .then(delayFunction(3333))
                .then(() => authClicked = Date.now())
                .then(() => bkHere === 'unibet' ? mouseChain({
                    target: window.location.href.indexOf('unibet.eu') > -1 ? $('button[data-test-name="kaf-submit-credentials-button"]:visible')[0] : $('button[data-test-name="kaf-submit-credentials-button"]:visible')[0],
                    events: ['click'],
                }) : mouseChain({target: $('button[type="submit"]:contains("Log In")')[0], events: ['click']}))
                .then(delayFunction(3333))
                .then(() => {
                    if($('div[data-dn="ErrorMessage"]').length > 0) {
                        enterError = true;
                        throw 'Auth error';
                    } else {
                        resolve();
                    }
                })
                .catch(e => reject(e));
        };

        if (Date.now() - authClicked > 180000) {
            performLogin();
        } else {
            reject('Too soon!');
        }
    });

    /**
     * Check we're authorized (returns -1 if not) and returns balance
     * @param returnNull - if true - return null when balance does not exists
     * @return {number|null}
     */
    function getBalance(returnNull) {
        if ($(findSel(['input[name="username"]:visible'])).length > 0) {
            return -1;
        }
        const $b = $(findSel(['span[class="text total-amount"]',
            'span[class="text cash-amount"]', 'div.balance-widget b:first'
        ]));
        return $b.length === 0 ?
            (typeof returnNull === 'boolean' && returnNull ? null : 0) :
            parseFloat($b.text().replace(',', '.')
                .replace(/[^\d.]/g, '').trim());
    }

    /**
     * Close early opened coupons
     * @param skip [{boolean}] default FALSE - whether we need to skip closing
     * @returns {Promise<string,string>}
     */
    const closePreviousCoupons = async skip => {
        if (skip) {
            return 'skipped!';
        }
        const $bs = $('header.mod-KambiBC-betslip__header:visible');
        if ($bs.length > 0) {
            const mSel = 'button[title="Maximize"]:visible';
            //expand coupon
            if ($bs.find(mSel).length > 0) {
                await mouseChain({target: $bs.find(mSel)[0], events: ['click'], error: 'Expanding bs'});
                await delayFunction(1000)();
            }
            const closesSel = 'div[class$="betslip__content"]:visible button[class$="__close-btn"]';
            while ($(closesSel).length > 0) {
                await mouseChain({
                    target: $(closesSel)[0],
                    events: ['click'],
                    scroll: true,
                    error: 'Closing one!'
                });
                await delayFunction(500)();
            }
            return 'All were closed!';
        } else {
            return 'No betslip!';
        }
    };

    const alternateDeposit = message => {
        if (message.data.paysystem !== 'NETELLER') {
            bMess('UNIBET_ALTER').remove();
        }
        bsBLogger('background: yellow; color: red; font-size: 14px; font-weight: bold; padding: 3px;', 'UNIBET', [`Alternate deposit (${document.location.href})`, message]);
        console.log('%c' + `alternateDeposit (${document.location.href}) %O`,
            'background: yellow; color: red; font-size: 14px; font-weight: bold; padding: 3px;', message);

        const dRep = (success, message) => bMess('DEPOSIT_RESULT', true).set({success: success, message: message});

        const psIName = message.data.paysystem === 'SKRILL' ? 'skrill' : 'neteller-deposit';
        const pinSel = 'input[data-test-name="InputTextInput_test"][maxlength="6"]';
        const selectors = [`div[data-test-method-key="${psIName}"]`, 'input[type="email"][data-test-name="InputTextInput_test"]', pinSel];

        const stepOne = () => waitForElement(`div[data-test-method-key="${psIName}"]`, 300, 30000)
            .then(() => message.paysystemSelected = true)
            .then(() => bMess('UNIBET_ALTER').set(message, 0, [message.data.paysystem === 'SKRILL' ? 'payment.unibet.com' : 'payment.unibet.com/bootstrap/neteller-deposit/']))
            .then(waitDelayClickF(`div[data-test-method-key="${psIName}"]`, 30000, null, null, false))
            .catch(e => dRep(false, `alternativeProcessor DEPOSIT ONE: ${e}`));

        const stepTwoSkrill = () => waitForElement('input[type="email"][data-test-name="InputTextInput_test"]', 300, 30000)
            .then($el => delayPromise(3333, $el))
            .then($el => clearAndInputEmail($el[0], message.data.login))
            .then(waitDelayClickF('div[data-test-name="AmountInput_test InputText_test"]', null, null, null, false))
            .then(waitForElementF('input[type="text"][data-test-name="InputTextInput_test"]', 300, 30000))
            .then($el => clearAndSimulate($el[0], message.data.amount))
            .then(() => message.close = true)
            .then(() => bMess('SKRILL_COMMAND', true).set(message))
            .then(waitDelayClickF('button.submitFormButton', null, null, null, false))
            .catch(e => dRep(false, `alternativeProcessor DEPOSIT TWO SKRILL: ${e}`));

        const accountSel = 'input[type="text"][data-test-name="InputTextInput_test"]:first';
        const amountSel = 'input[type="text"][data-test-name="InputTextInput_test"]:last';

        const netellerWaitStatus = () => {
            bsBLogger('blue', 'UNIBET', `Neteller, waiting for result...`);
            const good = 'div:contains("Deposit Successful!"):visible',
                noFunds = 'div:contains("Insufficient balance"):visible';
            return waitForCondition(() => $(good).length > 0 || $(noFunds).length > 0, 333, 70000, 'Uncertain status')
                .then(() => dRep($(good).length > 0, $(good).length > 0 ? 'It looks good!' : 'NO_FUNDS'))
                //.catch(e => bsBLogger('red', 'UNIBET', `Something went wrong neteller: ${e}`));
                .catch(e => dRep(false, `Something went wrong neteller: ${e}`));
        };

        const stepTwoNeteller = () => waitForElement(accountSel, 300, 30000)
            .then($el => delayPromise(3333, $el))
            .then($el => clearAndSimulate($el[0], message.data.login))
            .then(waitDelayClickF(accountSel))
            .then(delayFunction(3333))
            .then(() => clearAndSimulate($(pinSel)[0], message.data.pin))
            .then(waitDelayClickF(pinSel))
            .then(delayFunction(3333))
            .then(waitForElementF(amountSel, 300, 30000))
            .then($el => clearAndSimulate($el[0], message.data.amount))
            .then(delayFunction(3333))
            .then(() => selectLikePuppeteer($('#currencyDropdown')[0], ['USD']))
            .then(() => (message.close = false, message.netellerWait = true))
            .then(() => bsBLogger('blue', 'UNIBET', `Neteller DEPOSIT clicked!`))
            .then(() => bMess('UNIBET_ALTER', true).set(message, 0, ['payment.unibet.com/bootstrap/neteller-deposit/']))
            .then(waitDelayClickF('button.submitFormButton', null, null, null, false))
            .then(() => netellerWaitStatus())
            .catch(e => dRep(false, `alternativeProcessor DEPOSIT TWO NETELLER: ${e}`));

        if (message.netellerWait) {
            netellerWaitStatus()
                .finally(() => bsBLogger('blue', 'UNIBET', `netellerWaitStatus finished!`));
        } else if (!message.paysystemSelected) {
            if (message.data.paysystem === 'NETELLER' && window.location.href.indexOf('payment.unibet.com/bootstrap/neteller-deposit/') === -1) {
                bsBLogger('blue', 'UNIBET', `Inputs for Neteller could not be here...`);
                return;
            }
            bsBLogger('blue', 'UNIBET', `Waiting for inputs...`);
            waitForCondition(() => selectors.some(sel => $(sel).length > 0), 333, 30000, 'No inputs :(')
                .then(() => {
                    if ($(selectors[0]).length > 0) {
                        stepOne();
                    } else {
                        message.data.paysystem === 'SKRILL' ? stepTwoSkrill() : stepTwoNeteller();
                    }
                })
                .catch(e => dRep(false, `alternativeProcessor DEPOSIT: ${e}`));
        } else {
            bsBLogger('blue', 'UNIBET', `Step TWO`);
            message.data.paysystem === 'SKRILL' ? stepTwoSkrill() : stepTwoNeteller();
        }
    };

    const alternateRedDeposit = async message => {
        //TODO: create deposit logic
        //const $favouriteMethod = await waitForElement('mgs-favourite-deposit-method-selector', 333, 10000, true);
        //console.log('message  ', message)
    }

    const alternativeProcessor = message => {
        if (message.action === 'DEPOSIT') {
            alternateDeposit(message);
        }
    };

    const alternativeRedProcessor = async message => {
        if (message.action === 'DEPOSIT') {
            await alternateRedDeposit(message);
        }
    };

    function afterDOMLoaded() {
        const isMain = window.self === window.top;
        let currentCommand;

        if (bkHere === 'unibet') {
            bMess(isMain ? 'UNIBET' : 'UNIBET_ALTER').check(40000)
                .then(aCommand => currentCommand = aCommand)
                .then(waitForConditionF(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck),
                    333, 60000, 'No auth check!'))
                .then(() => bsDebug(port, 'Restoring with: ', currentCommand))
                .then(() => isMain ? messageProcessor(currentCommand, false) : alternativeProcessor(currentCommand))
                .catch(e => console.log(`afterDOMLoaded ONE (${isMain}): ${e}`));
        } else {
            bMess('32RED').check(40000)
                .then(aCommand => currentCommand = aCommand)
                .then(() => bsDebug(port, 'Restoring with: ', currentCommand))
                .then(() => alternativeRedProcessor(currentCommand))
                .catch(e => console.log(`afterDOMLoaded ONE (${isMain}): ${e}`));
        }

        isMain ? (port.postMessage({m: "PAGE LOADED!"}), console.log('loaded and message sent!')) :
            console.log(`Alternate loaded at: ${window.location.href}`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", () => {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            bMess('UNIBET').set(ourCommand.get(), increaseDelay ? 150000 : 0);
        }
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

})();
