(function () {

    "use strict";

    const currency = 'EUR';
    let newAPI = false;
    let authClicked = 0;
    let wasAuthCheck = false;
    let busy = false;
    let increaseDelay = false;
    let port = window.self === window.top ? chrome.runtime.connect({name: "port_william"}) : false;
    let settings = {
        authCheckInterval: 3333,
        url: 'http://sports.williamhill.com/bet/en-gb/betlive/all',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        maxWaitForScore: 60000
    };
    let checkScoreToDo = false;
    let enterError = false;

    const currentBetData = new class CurrentBetData {
        constructor() {
            this.init([]);
        }

        init(data) {
            this.data = data;
            this.max = 0;
            this.external_id = '';
            this.willPlace = 0;
        }
    };

    let currentCommand = '';

    let ourCommand = new ourCommandProto();

    let sportAccordance = {
        'FOOTBALL': 'Football',
        'TENNIS': 'Tennis',
        'HOCKEY': 'Ice Hockey',
        'VOLLEYBALL': '',
        'BASEBALL': '',
        'BASKETBALL': '',
        'HANDBALL': ''
    };
    let stakeLimited = '';

    const messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;
        currentCommand = message.action;
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
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
        } else {
            waitForCondition(() => $('div.cp-ma-myaccount-dropdown').length > 0, 333, 5000, 'Not logged in!')
                .then(() => {
                    if (message.action === 'UPDATE_BALANCE') {
                        mouseChain({
                            target: $('#account_balance_refresh')[0],
                            events: ['mouseover', 'mousedown', 'click', 'mouseup']
                        })
                            .then(() => console.log('Balance clicked!'))
                            .catch(e => console.log('Balance not clicked :( ' + e));
                    } else if (message.action === 'MAXIMUM') {
                        busy = true;
                        ourCommand.set(message);
                        bsDebug(port, 'MAXIMUM for: ' + message.data[0].market + '/' + message.data[0].target + '/' + message.data[0].pivot);
                        let max;
                        const reportMax = (success, m) => {
                            busy = false;
                            port.postMessage({
                                answered: "MAXIMUM",
                                status: success ? 'success' : "error",
                                answer: m
                            });
                            ourCommand.clear();
                        };
                        closePreviousCoupons(ourCommand.getAdded('express') !== false)
                            .then(() => openCoupon(message.data))
                            .then(m => max = m)
                            .then(() => checkCoefs(message.data))
                            .then(() => reportMax(true, max))
                            .catch(e => reportMax(false, "Error: " + e));
                    } else if (['BET', 'EXPRESS_BET', 'BET_RESULT', 'CHECK_PAYMENTS', 'DEPOSIT', 'WITHDRAW'].indexOf(message.action) > -1) {
                        busy = true;
                        ourCommand.set(message);
                        ({
                            'BET': proceedBet, 'EXPRESS_BET': proceedBet,
                            'BET_RESULT': collectBetResults, 'CHECK_PAYMENTS': collectBetResults,
                            'DEPOSIT': deposit, 'WITHDRAW': withdraw
                        }[message.action])(message.data)
                            .then(() => bsDebug(port, "It's looks like BET done!"))
                            .catch(e => bsError(port, `Error till BET: ${e}`))
                            .then(() => {
                                busy = false;
                                ourCommand.clear();
                                bsDebug(port, 'COMMAND RELEASED!');
                                //return mouseChain({target: $('#nav-in-play a:visible')[0], events: ['click']});
                            });
                    } else {
                        port.postMessage({
                            answered: message.action,
                            status: "error",
                            answer: "Unsupported command!"
                        });
                    }
                })
                .catch(e => port.postMessage({answered: message.action, status: "error", answer: "BC: " + e}))
        }
    };

    const register = function (data) {
        bsDebug(port, 'register!');
        return new Promise(function (onSuccess, onReject) {
            onReject('REGISTER for william not supported!');
        });
    };

    const withdraw = function (data) {
        bsDebug(port, 'Withdraw!', data);
        return new Promise(function (onSuccess, onReject) {
            let report = function (success, message) {
                bsDebug(port, 'Report! ' + success + ' / ' + message);
                port.postMessage({
                    answered: "WITHDRAW",
                    status: success ? "SUCCESS" : "FAILED",
                    answer: message
                });
                if (parseInt(data.pin) !== 1) {
                    bsSendSmsApi(port, 'BIND_RELEASE', {
                        "websocket_uid": settings.uid,
                        "request_id": ourCommand.getAdded('sms_api_request_id')
                    });
                }
                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                }
            };

            let depositResult = {};
            let getDepositResult = function () {
                chrome.storage.local.get(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET'], function (result) {
                    //bsDebug(port, 'Deposit result:', result, 'COLOR:yellow,red');
                    if (typeof result.DEPOSIT_RESULT !== 'undefined' && typeof result.DEPOSIT_RESULT_WAS_SET !== 'undefined'
                        && Date.now() - result.DEPOSIT_RESULT_WAS_SET < 70000) {
                        depositResult = result.DEPOSIT_RESULT;
                    } else {
                        depositResult = {};
                    }
                });
            };

            delayPromise(111)
                .then(closeAccountPanel)
                .then(waitDelayClickF('button.cp-ma-myaccount-dropdown-button'))
                .then(() => chrome.storage.local.set({
                    'WILLIAM_ALTERNATE_COMMAND': ourCommand.get(),
                    'WILLIAM_ALTERNATE_COMMAND_WAS_SET': Date.now()
                }))
                .then(waitDelayClickF('div.cp-ma-navigation__title:contains("Withdraw")'))
                .then(waitForConditionF(() => {
                    getDepositResult();
                    return typeof depositResult.success === 'boolean';
                }, 333, 100000, 'no result :('))
                .then(() => bsDebug(port, 'We got result:', depositResult))
                .then(() => report(depositResult.success, depositResult.message))
                .catch(e => report(false, 'Collect: ' + e));
        });
    };

    const deposit = function (data) {
        bsDebug(port, 'Deposit!', data);
        return new Promise(function (onSuccess, onReject) {
            const report = function (success, message) {
                ourCommand.add('increaseDelay', false);
                ourCommand.add('qiwiEntered', false);
                bsDebug(port, 'Report! ' + success + ' / ' + message);
                const postMessageData = {
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
                    answer: message,
                    wallet_balance: 0
                };
                if (postMessageData.status === 'SUCCESS' && typeof message !== 'string') {
                    const calculate_balance = message.wallet_balance - parseFloat(data.amount);
                    postMessageData.wallet_balance = calculate_balance < 0 ? message.wallet_balance : calculate_balance;
                }
                port.postMessage(postMessageData);

                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                }
            };
            let depositResult = {};
            const getDepositResult = function () {
                chrome.storage.local.get(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET'], function (result) {
                    //bsDebug(port, 'Deposit result:', result, 'COLOR:yellow,red');
                    if (typeof result.DEPOSIT_RESULT !== 'undefined' && typeof result.DEPOSIT_RESULT_WAS_SET !== 'undefined'
                        && Date.now() - result.DEPOSIT_RESULT_WAS_SET < 70000) {
                        depositResult = result.DEPOSIT_RESULT;
                    } else {
                        depositResult = {};
                    }
                });
            };
            const letsRockNRoll = function () {
                waitForElement('button[data-test-id="@sitebase/deposit-button_pi-header__deposit-button"]', 333, 5000)
                    .then(($el) => {
                        chrome.storage.local.set({
                            'WILLIAM_ALTERNATE_COMMAND': ourCommand.get(),
                            'WILLIAM_ALTERNATE_COMMAND_WAS_SET': Date.now()
                        });
                        return $el;
                    })
                    .then(($el) => delayPromise(2222, $el))
                    // Hint: we storing alternate command to execute in cross-origin iframe...
                    .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                    .then(waitForConditionF(() => (getDepositResult(), typeof depositResult.success === 'boolean'),
                        333, 200000, 'No deposit result in'))
                    .then(() => report(depositResult.success, typeof depositResult.message === 'string' ? depositResult.message : 'No message :('))
                    .catch(e => report(false, 'Fill form: ' + e))
                    .then(() => chrome.storage.local.remove(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET', 'SKRILL_COMMAND', 'SKRILL_COMMAND_WAS_SET']))
                    .then(delayFunction(3333))
                    .then(() => window.location.reload(true));
            };
            letsRockNRoll();
        });
    };

    /**
     * Close modal window of account panel
     * @returns {Promise<void>}
     */
    const closeAccountPanel = async () => {
        if ($('div.cp-ma-container-container').length > 0) {
            await mouseChain({target: $('div.cp-ma-header-header__close-button')[0], events: ['click']})
            await delayPromise(1000);
        }
    };

    /**
     * Collecting bet results
     * @param {array} inputData
     * @returns {Promise<any>}
     */
    const collectBetResults = function (inputData) {
        return new Promise(function (onSuccess, onReject) {
            let collected = [];
            let limit = 30;
            let data = inputData;
            if (data.length === 2 && data[0] === 'limit') {
                limit = parseInt(data[1]);
                data = [];
            }
            if (limit > 30) {
                limit = 30;
            }
            bsDebug(port, 'collectBetResults, limit: ' + limit + ', data:', data);
            let report = function (success, message) {
                bsDebug(port, `Collect data: ${success} / ${JSON.stringify(message)}, data:`, data);
                port.postMessage({
                    answered: ourCommand.get().action,
                    status: success ? "success" : "error",
                    answer: message
                });
                const $close = $('div.cp-ma-header-header__close-button');
                if ($close.length > 0) {
                    delayPromise(1000)
                        .then(() => mouseChain({target: $close[0], events: fullClick, error: '$close'}));
                }
                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                }
            };

            const doCollect = async function () {
                collected = [];
                const collect = async ($this) => {
                    const badgeText = $this.find('div.cp-ma-transactions-header__title').text().trim();
                    const match = $this.find('div.cp-ma-transactions-leg-part__event').text().trim();
                    let stake = parseFloat($this.find('span.cp-ma-transactions-footer__additional-info').text().replace(/[^\d.]/g, '').trim());
                    let result = parseFloat($this.find('div.cp-ma-transactions-header__amount').text().replace(/[^\d.]/g, '').trim());
                    let status = 'ACCEPTED';
                    if (badgeText === 'Win') {
                        status = 'WON';
                    } else if (badgeText === 'Loss') {
                        status = 'LOSE';
                    } else if (!isNaN(result) && result === stake) {
                        status = 'REFUNDED';
                    } else {
                        result = '';
                    }
                    if (status == 'ACCEPTED') stake = '';
                    const external_id = $this.find('span.cp-ma-transactions-footer__reference-number').text().replace('Ref No.', '').trim();
                    if (data.length === 0 || data.indexOf(external_id) > -1) {
                        collected.push({
                            external_id: external_id,
                            status: status,
                            match: match,
                            stake: stake.toString(),
                            result: isNaN(result) ? '0' : result.toString()
                        });
                    } else {
                        console.log('%c' + `${external_id} not in '${data.join("', '")}'`,
                            'background: lightyellow; color: black; font-size: 12px; font-weight: normal; padding: 1px;');
                    }
                };
                await $('div.cp-ma-transactions-transaction').eachAsync(async function (key) {
                    if (++key > limit) return false;
                    if ($(this).find('div.cp-ma-transactions-footer:visible').length === 0) {
                        await mouseChain({
                            target: $(this).find('div.cp-ma-transactions-description__arrow')[0],
                            events: ['click']
                        })
                        await delayPromise(1000);
                    }
                    await collect($(this))
                    await delayPromise(555);
                })
                return collected;
            };

            const expandList = async () => {
                let expandState = true;
                const $loadButton = $('div.cp-ma-transactions-button-load-more button:contains("Load more"):visible');
                while (expandState) {
                    if ($loadButton.length > 0) {
                        if (limit > $('div.cp-ma-transactions-transaction').length) {
                            await mouseChain({
                                target: $loadButton[0],
                                events: fullClick,
                            });
                            await delayPromise(1500);
                        } else {
                            expandState = false;
                        }
                    } else {
                        expandState = false;
                    }
                }
            };
            const performCollect = function () {
                return waitForCondition(() => {
                    return $('div.cp-ma-transactions-transaction').length > 0;
                }, 333, 5000, 'No history')
                    .then(expandList)
                    .then(doCollect)
                    .catch(e => e);
            };
            const mf = () => {
                delayPromise(111)
                    .then(closeAccountPanel)
                    .then(waitDelayClickF('button.cp-ma-myaccount-dropdown-button'))
                    .then(() => chrome.storage.local.set({
                        'WILLIAM_ALTERNATE_COMMAND': ourCommand.get(),
                        'WILLIAM_ALTERNATE_COMMAND_WAS_SET': Date.now()
                    }))
                    .then(waitDelayClickF('div.cp-ma-navigation-menu-tile:contains("My Transactions")'))
                    .then(waitDelayClickF('div.cp-ma-cc-dropdown__button-content:first'))
                    .then(waitDelayClickF('button[data-test-handler="last7"]'))
                    .then(waitDelayClickF('button:contains("Apply")'))
                    .then(performCollect)
                    .then(c => report(true, c))
                    .catch(e => report(false, 'Collect: ' + e));
            };
            mf();
        });
    };

    const proceedBetDo = async data => {
        const checkBalance = () => {
            const balance = getBalance();
            if (isNaN(balance)) {
                throw 'Get balance error';
            } else if (balance < currentBetData.willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${currentBetData.willPlace}`;
            } else if (typeof currentBetData.willPlace === 'undefined' || isNaN(currentBetData.willPlace)) {
                throw 'Undefined or NaN will place';
            }
            dLog('green', 'William',
                `Will place (performBet): ${currentBetData.willPlace}, balance: ${balance}`);
        };
        const letsInput = async amount => {
            const elem = $('span.bs-bet-stake__value').get(0);
            const elemCenter = {
                x: elem.getBoundingClientRect().left + elem.offsetWidth / 2,
                y: elem.getBoundingClientRect().top + elem.offsetHeight / 2
            };
            await mouseChain({
                target: $(document.elementFromPoint(elemCenter.x, elemCenter.y))[0],
                events: fullClick,
                error: 't1t'
            });
            await delayPromise(555);
            const $input = $('input.bs-bet-stake__input');
            $input.get(0).focus();
            console.log(await bsType('william', amount.toString(), 100));
            console.log($input.val());
        };
        const entered = () => parseFloat($('input.bs-bet-stake__input').val().replace(/[^\d.]/g, '').trim());
        const getErrors = () => {
            const r = [];
            ['h1.bs-bet-processing__footer:contains("Sorry, your bet has not been placed as your stake is too high")',
                'header.betslip-notification-header--error:visible', '#error-box-footer:visible',
                '#error-box-header:visible', 'span.bs-bet-message__text',]
                .forEach(selector => {
                    const e = $(selector).text().trim();
                    if (e !== '') {
                        r.push(e);
                    }
                });
            return r;
        };
        const checkSuccess = async () => {
            const placed = await waitForCondition(() => {
                const $s = $('p.bs-receipt-header__title:contains("Bet Placed"):visible');
                return $s.length > 0 || getErrors().length > 0;
            }, 333, 22000).catch(() => $([]));
            const e = getErrors();
            const checkText = 'Sorry, your bet has not been placed as your stake is too high';
            if (e.length > 0) {
                if (e.find(el => el === 'Stake too high')) {
                    // Hint: maximum reached!
                    currentBetData.max = $('span.bs-bet-stake__value').text().replace(/[^\d]/g, '');
                    throw 'MAXIMUM_REACHED';
                } else if (e.find(el => el.indexOf(checkText) > -1) !== undefined) {
                    const stakeValue = e.find(el => el.indexOf(checkText) > -1);
                    if (stakeValue.indexOf('maximum stake is') > -1) {
                        const arrStr = stakeValue.split(' ');
                        stakeLimited = arrStr[arrStr.length - 1].replace(/[^\d]/, '');
                    } else {
                        throw 'LIMITED';
                    }
                } else {
                    throw e.join('; ');
                }
            } else if (placed === false) {
                throw 'Bet is not placed';
            }
            return true;
        };
        currentBetData.init(data);
        await closePreviousCoupons(ourCommand.getAdded('express') !== false);
        currentBetData.max = await openCoupon(data);
        currentBetData.willPlace = parseFloat(data[0].stake);
        if (currentBetData.max !== -1 && currentBetData.willPlace > currentBetData.max) {
            currentBetData.willPlace = currentBetData.max;
        }
        checkBalance();
        let totalCoef;
        do {
            totalCoef = await checkCoefs(data);
            let cycles = 0;
            while (currentBetData.willPlace !== entered() && cycles <= 3) {
                // Hint: Let's enter stake
                await delayPromise(333);
                await letsInput(currentBetData.willPlace.toString().replace('.00', ''));
                await delayPromise(333);
                dLog('green', 'William',
                    `After enter stake check: willPlace = ${currentBetData.willPlace}, entered: ${entered()}`);
                cycles++;
            }
            if (currentBetData.willPlace !== entered()) {
                throw `We tried enter bet ${cycles} times!`;
            }
            const errors = getErrors();
            if (errors.length > 0 && (errors.some(e => e.indexOf('bet has changed') > -1)
                || errors.some(e => e.indexOf('selection has changed') > -1))) {
                dLog('red', 'William', 'ReCheck coefs!');
                continue;
            } else if (errors.length > 0) {
                throw `Before bet error: ${errors.join('; ')}!`;
            }
            const placeBtnSelector = 'button.bs-bet-place:visible:not(:disabled)';
            const $pbtn = await waitForElement(placeBtnSelector, 333, 5000);
            await mouseChain({target: $pbtn[0], events: fullClick, error: 'placeBtn'});
        } while (!await checkSuccess());
        await delayPromise(3888);
        const res = {
            external_id: $('p.bs-receipt-slip__bet-reference').trt()
                .replace('Bet Reference', '').trim(),
            coef: totalCoef,
            stake: currentBetData.willPlace
        };
        await mouseChain({
            target: $('button.bs-bet-close')[0],
            events: fullClick, error: 'bs-bet-close'
        });
        return res;
        /*
        const res = await collectBetResults(['limit', '1']);
        if (!res || !res[0] || !res[0].external_id) {
            throw 'Error till collecting bet result!';
        }
        return {
            external_id: res[0].external_id,
            coef: totalCoef,
            stake: currentBetData.willPlace
        }
         */

    };

    const proceedBet = data => new Promise((onSuccess, onReject) => {
        proceedBetDo(data)
            .then(message => {
                let resultData = {
                    "external_id": message.external_id,
                    "status": 'ACCEPTED',
                    "market": currentBetData.data[0].market,
                    "target": currentBetData.data[0].target,
                    "pivot": currentBetData.data[0].pivot,
                    "coef": message.coef,
                    "stake": message.stake,
                    "maximum": currentBetData.max
                };
                if (typeof currentBetData.data[0].collectAfterAll !== 'undefined'
                    && currentBetData.data[0].collectAfterAll) {
                    resultData['bkPivot'] = message.bkPivot;
                }
                dLog('greeen', 'William', ['Result data: ', resultData]);
                port.postMessage({
                    answered: "BET",
                    data: resultData,
                    answer: 'Everything is Okay!'
                });
                onSuccess();
            })
            .catch(error => {
                let status = ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED']
                    .find(t => error.indexOf(t) > -1) || 'FAILED';
                if (status === 'LIMITED') {
                    error = 'Tried to bet 0';
                }
                port.postMessage({
                    answered: "BET",
                    data: {
                        "external_id": '',
                        "status": status,
                        "market": currentBetData.data[0].market,
                        "target": currentBetData.data[0].target,
                        "pivot": currentBetData.data[0].pivot,
                        "coef": currentBetData.data[0].coef,
                        "stake": currentBetData.data[0].stake,
                        "maximum": currentBetData.max
                    },
                    answer: error
                });
                onReject(error);
            })
            .finally(() => {
                busy = false;
                ourCommand.clear();
            });
    });

    const checkCoefs = async data => {
        const findInData = match => data.find(v => {
            const localMatch = v.team1.toLowerCase() + ' - ' + v.team2.toLowerCase();
            return localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 60;
        });
        const $coupons = $('div.bs-selection:visible');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $this.find('span[data-test-id="event-name"]').text()
                .replace(/\s+/g, ' ').trim()
                .replace(/-/, '').trim().toLowerCase();
            const lcDraft = $this.find('span.bs-bet-price--selected').text().trim();
            const localCoef = decOdds(lcDraft);
            let localData = findInData(match);
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if (localData === false || isNaN(localCoef)) {
                errors.push(match + ' LOW_COEF - wrong match or localCoef!');
            }
            checked++;
        });
        if (errors.length === 0 && checked === data.length) {
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef))
                ? parseFloat(data[0].coef) : totalCoef / 1.21;
            if (totalCoef >= nCheck * 1.2) {
                throw 'Coef TOO BIG: ' + totalCoef + ' instead of ' + data[0].coef;
            } else if (totalCoef < nCheck) {
                throw 'LOW_COEF ' + data[0].coef + ' > ' + totalCoef;
            } else {
                return totalCoef;
            }
        } else {
            throw errors.join('; ') + (checked !== data.length ? ' some stakes not checked ('
                + checked + '/' + data.length + ')!' : '');
        }
    };

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<object,string>} jQuery element for bet
     */
    let getBetElement = function (data) {
        return new Promise(function (reportSuccess, reportReject) {
            //#-#-START
            const onSuccess = function ($d) {
                if (typeof $d[0] === 'undefined') {
                    onReject('Bet inactive!');
                } else {
                    console.log('%cSuccess: ' + $d.text().trim(), 'background: green;');
                    $d[0].scrollIntoView(false);
                    reportSuccess($d);
                }
            };

            const onReject = function (d) {
                console.log('%cReject', 'background: red;');
                console.log(d);
                reportReject(d);
            };

            const title = $('span[class^="pageTitle__page-title"] h2').text().trim();
            const teams = title.split(' v ');
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
                    'ONE': {superRoots: ['Popular'], roots: ['Match Betting Live'], pivotKeys: ['#TEAM1B#']},
                    'TWO': {superRoots: ['Popular'], roots: ['Match Betting Live'], pivotKeys: ['#TEAM2B#']},
                    'DRAW': {superRoots: ['Popular'], roots: ['Match Betting Live'], pivotKeys: ['Draw']},
                    'ONE_DRAW': {superRoots: ['Popular'], roots: ['Double Chance Live'], pivotKeys: ['Home/Draw']},
                    'TWO_DRAW': {superRoots: ['Popular'], roots: ['Double Chance Live'], pivotKeys: ['Draw/Away']},
                    'ONE_TWO': {superRoots: ['Popular'], roots: ['Double Chance Live'], pivotKeys: ['Home/Away']}
                },
                'TOTAL': {
                    'OVER': {
                        superRoots: ['Handicaps/Total Goals'],
                        roots: ['Match Over/Under #PIVOT# Goals Live', 'Match Over/Under #PIVOTR# Goals Live', 'Match Over/Under #PIVOTR2# Goals Live'],
                        pivotKeys: ['Over #PIVOT#', 'Over #PIVOTR#', 'Over #PIVOTR2#', 'Over (#PIVOT#)', 'Over (#PIVOTR#)', 'Over (#PIVOTR2#)']
                    },
                    'UNDER': {
                        superRoots: ['Handicaps/Total Goals'],
                        roots: ['Match Over/Under #PIVOT# Goals Live', 'Match Over/Under #PIVOTR# Goals Live', 'Match Over/Under #PIVOTR2# Goals Live'],
                        pivotKeys: ['Under #PIVOT#', 'Under #PIVOTR#', 'Under #PIVOTR2#', 'Under (#PIVOT#)', 'Under (#PIVOTR#)', 'Under (#PIVOTR2#)']
                    },
                },
                'CORNER_TOTAL': {
                    'OVER': {
                        superRoots: ['Corners'],
                        roots: ['Total Corners Live'],
                        pivotKeys: ['Over #PIVOT#', 'Over #PIVOTR#', 'Over #PIVOTR2#', 'Over (#PIVOT#)', 'Over (#PIVOTR#)', 'Over (#PIVOTR2#)']
                    },
                    'UNDER': {
                        superRoots: ['Corners'],
                        roots: ['Total Corners Live'],
                        pivotKeys: ['Under #PIVOT#', 'Under #PIVOTR#', 'Under #PIVOTR2#', 'Under (#PIVOT#)', 'Under (#PIVOTR#)', 'Under (#PIVOTR2#)']
                    },
                },
                'T1_TOTAL': {
                    'OVER': {
                        superRoots: ['Team Goals'],
                        roots: ['#TEAM1B# Over/Under #PIVOT# Goals Live', '#TEAM1B# Over/Under #PIVOTR# Goals Live', '#TEAM1B# Over/Under #PIVOTR2# Goals Live'],
                        pivotKeys: ['Over (#PIVOT#)', 'Over (#PIVOTR#)', 'Over (#PIVOTR2#)']
                    },
                    'UNDER': {
                        superRoots: ['Team Goals'],
                        roots: ['#TEAM1B# Over/Under #PIVOT# Goals Live', '#TEAM1B# Over/Under #PIVOTR# Goals Live', '#TEAM1B# Over/Under #PIVOTR2# Goals Live'],
                        pivotKeys: ['Under (#PIVOT#)', 'Under (#PIVOTR#)', 'Under (#PIVOTR2#)']
                    }
                },
                'T2_TOTAL': {
                    'OVER': {
                        superRoots: ['Team Goals'],
                        roots: ['#TEAM2B# Over/Under #PIVOT# Goals Live', '#TEAM2B# Over/Under #PIVOTR# Goals Live', '#TEAM2B# Over/Under #PIVOTR2# Goals Live'],
                        pivotKeys: ['Over (#PIVOT#)', 'Over (#PIVOTR#)', 'Over (#PIVOTR2#)']
                    },
                    'UNDER': {
                        superRoots: ['Team Goals'],
                        roots: ['#TEAM2B# Over/Under #PIVOT# Goals Live', '#TEAM2B# Over/Under #PIVOTR# Goals Live', '#TEAM2B# Over/Under #PIVOTR2# Goals Live'],
                        pivotKeys: ['Under (#PIVOT#)', 'Under (#PIVOTR#)', 'Under (#PIVOTR2#)']
                    }
                },
                'HDP': {
                    'HOME': {
                        superRoots: ['Handicaps/Total Goals'],
                        roots: ['Handicap Betting Live'],
                        pivotKeys: ['#TEAM1B# (#PIVOT#)', '#TEAM1B# (#PIVOTR#)', '#TEAM1B# (#PIVOTR2#)', '#TEAM1B# (#PIVOTZ#)']
                    },
                    'AWAY': {
                        superRoots: ['Handicaps/Total Goals'],
                        roots: ['Handicap Betting Live'],
                        pivotKeys: ['#TEAM2B# (#PIVOT#)', '#TEAM2B# (#PIVOTR#)', '#TEAM2B# (#PIVOTR2#)', '#TEAM2B# (#PIVOTZ#)']
                    }
                },
                'EURO_HDP': {
                    'H1': {
                        superRoots: ['Handicaps/Total Goals'],
                        roots: ['Match Handicap #PIVOTH# Live', 'Match Handicap #PIVOTH1# Live'],
                        pivotKeys: ['#TEAM1B# #PIVOT# Goal', '#TEAM1B# #PIVOTR# Goal', '#TEAM1B# #PIVOTR2# Goal', '#TEAM1B# #PIVOTZ# Goal',
                            '#TEAM1B# #PIVOT# Goals', '#TEAM1B# #PIVOTR# Goals', '#TEAM1B# #PIVOTR2# Goals', '#TEAM1B# #PIVOTZ# Goals']
                    },
                    'H2': {
                        superRoots: ['Handicaps/Total Goals'],
                        roots: ['Match Handicap #PIVOTH# Live', 'Match Handicap #PIVOTH1# Live'],
                        pivotKeys: ['#TEAM2B# #PIVOT# Goal', '#TEAM2B# #PIVOTR# Goal', '#TEAM2B# #PIVOTR2# Goal', '#TEAM2B# #PIVOTZ# Goal',
                            '#TEAM2B# #PIVOT# Goals', '#TEAM2B# #PIVOTR# Goals', '#TEAM2B# #PIVOTR2# Goals', '#TEAM2B# #PIVOTZ# Goals']
                    },
                    'HX': {
                        superRoots: ['Handicaps/Total Goals'],
                        roots: ['Match Handicap #PIVOTH# Live', 'Match Handicap #PIVOTH1# Live'],
                        pivotKeys: ['Tie (#TEAM1B# #PIVOT# Goal)', 'Tie (#TEAM1B# #PIVOTR# Goal)', 'Tie (#TEAM1B# #PIVOTR2# Goal)', 'Tie (#TEAM1B# #PIVOTZ# Goal)',
                            'Tie (#TEAM1B# #PIVOT# Goals)', 'Tie (#TEAM1B# #PIVOTR# Goals)', 'Tie (#TEAM1B# #PIVOTR2# Goals)', 'Tie (#TEAM1B# #PIVOTZ# Goals)']
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
                return res;
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
                return res;
            };

            const specialEuroHDPFormatter = (plus) => (plus ? '+' : '-') +
                Math.abs(parseInt((typeof data.pivot === 'undefined' ? 0 : data.pivot).toString())).toString();

            let replaceInner = function (element, parent, index) {
                if (typeof element === 'string') {
                    parent[index] = element.replace('#TEAM1#', data.team1).replace('#TEAM2#', data.team2)
                        .replace('#TEAM1B#', data.team1b).replace('#TEAM2B#', data.team2b)
                        .replace('#PIVOT#', data.pivot).replace('#PIVOTR#', specialPivotFormatter(data.market, data.pivot))
                        .replace('#PIVOTR2#', specialPivotFormatter(data.market, data.pivot, true))
                        .replace('#PIVOTZ#', specialPivotZFormatter())
                        .replace('#PIVOTH#', specialEuroHDPFormatter(true)).replace('#PIVOTH1#', specialEuroHDPFormatter(false));
                } else if (typeof element === 'object') {
                    for (let i in element) {
                        replaceInner(element[i], element, i);
                    }
                } else {
                    // console.log(typeof element + ' not supported! (' + element + ')');
                }
            };
            replaceInner(markets, null, null);

            const getParamsRoot = new marketsParamsProto(data);
            const getParamsSuperRoot = new marketsParamsProto(data);
            const getParamsPivots = new marketsParamsProto(data);
            getParamsRoot.proceed_football = function (data) {
                if (data.market === 'CORNER_TOTAL') {
                    for (let i = 1; i < 11; i++) {
                        this.needAddTo.push('Alternative Total Corners ' + i + ' Live');
                    }
                }
                if (data.time_value === 'HALF_TIME') {
                    this.replacements.push({from: 'Match', to: '1st Half'});
                    this.replacements.push({from: 'Handicap Betting Live', to: '1st Half Handicap Betting Live'});
                    this.needRemove.push('Double Chance Live');
                }
            };
            getParamsSuperRoot.proceed_football = function (data) {
                if (data.time_value === 'HALF_TIME') {
                    this.needAddTo.push('Half and Period');
                    this.needAddToBeginning = true;
                }
            };
            getParamsRoot.proceed_tennis = function (data) {
                if (data.time_value !== 'FULL_MATCH') {
                    let parts = data.time_value.split(';');
                    if (parts.length === 1 && data.time_value.indexOf('SET') > -1) {
                        let set = parts[0].replace(/[^\d]/g, '');
                        set = ['1st', '2nd', '3rd', '4th', '5th'][parseInt(set) - 1];
                        if (data.market === 'TOTAL') {
                            this.replacements.push({from: 'Match', to: set + ' Set -'});
                        } else {
                            this.replacements.push({from: 'Match', to: set + ' Set'});
                        }
                        this.replacements.push({from: 'Goals Live', to: 'Games'});
                    } else if (parts.length === 2 && parts[0].indexOf('SET') > -1 && parts[1].indexOf('GAME') > -1) {
                        let set = parts[0].replace(/[^\d]/g, '');
                        const game = parts[1].replace(/[^\d]/g, '');
                        set = ['1st', '2nd', '3rd', '4th', '5th'][parseInt(set) - 1];
                        this.replacements.push({from: 'Match Betting Live', to: set + ' Set - Game ' + game});
                    }
                }
            };
            getParamsSuperRoot.proceed_tennis = function (data) {
                if (data.time_value !== 'FULL_MATCH' && data.market === 'TOTAL') {
                    this.needAddTo.push('Set Betting');
                    this.needAddToBeginning = true;
                }
            };
            getParamsRoot.proceed_hockey = function (data) {
                if (data.time_value === 'FULL_MATCH') {
                    this.replacements.push({from: 'Match Betting Live', to: 'Money Line Live'});
                    if (data.market === 'TOTAL') {
                        this.needAddTo.push('Total Match Goals Live');
                        this.needAddToBeginning = true;
                        this.replacements.push({from: 'Match', to: '60 Minutes'});
                        for (let i = 1; i < 11; i++) {
                            this.needAddTo.push('Alternative Total Goals ' + i + ' Live');
                        }
                    } else if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                        let team = parseInt(data.market.replace(/[^\d]/g, '').trim());
                        this.needAddTo.push((team === 1 ? data.team1b : data.team2b) + ' Total Goals Live');
                        this.needAddToBeginning = true;
                        for (let i = 1; i < 11; i++) {
                            this.needAddTo.push((team === 1 ? data.team1b : data.team2b) + ' Alternative Total Goals ' + i + ' Live');
                        }
                    } else if (data.market === 'HDP') {
                        this.needAddTo.push('Puck Line Handicap Live');
                        this.needAddToBeginning = true;
                        for (let i = 1; i < 11; i++) {
                            this.needAddTo.push('Alternative Puck Line Handicap ' + i + ' Live');
                        }
                    }
                } else {
                    let period = data.time_value.replace(/[^\d]/g, '');
                    period = ['1st', '2nd', '3rd', '4th', '5th'][parseInt(period) - 1];
                    this.replacements.push({from: 'Match Betting Live', to: period + ' Period Betting Live'});
                    this.replacements.push({
                        from: 'Double Chance Live',
                        to: period + ' Period Double Chance Live'
                    });
                    if (data.market === 'TOTAL') {
                        this.replacements.push({from: 'Match Under/Over', to: 'xm'});
                        this.needAddTo.push(period + ' Period Goals Live');
                        this.needAddToBeginning = true;
                    }
                }
            };
            getParamsSuperRoot.proceed_hockey = function (data) {
                this.needAddToBeginning = true;
                if (data.time_value === 'FULL_MATCH') {
                    if (['TOTAL', 'T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                        this.needAddTo.push('Totals');
                    } else {
                        this.needAddTo.push('Popular Markets');
                    }
                } else {
                    this.needAddTo.push('Period Betting');
                }
            };
            getParamsPivots.proceed_hockey = function (data) {
                if (data.market === 'ONE_TWO') {
                    this.needAddToBeginning = true;
                    const specials = {
                        'PERIODS': {
                            'ONE': '1',
                            'TWO': '2',
                            'DRAW': 'X'
                        },
                        'ALL': {
                            'ONE_DRAW': `${data.team1b} Or Draw`,
                            'TWO_DRAW': `${data.team2b} Or Draw`,
                            'ONE_TWO': `${data.team1b} Or ${data.team2b}`
                        }
                    };
                    if (data.time_value !== 'FULL_MATCH' && Object.keys(specials['PERIODS']).indexOf(data.target) > -1) {
                        this.needAddTo.push(specials['PERIODS'][data.target]);
                    } else if (Object.keys(specials['ALL']).indexOf(data.target) > -1) {
                        this.needAddTo.push(specials['ALL'][data.target]);
                    }
                }
            };

            marketsModifierWrapper(data, 'roots', getParamsRoot.get(), markets);
            marketsModifierWrapper(data, 'superRoots', getParamsSuperRoot.get(), markets);
            marketsModifierWrapper(data, 'pivotKeys', getParamsPivots.get(), markets);

            let finalPrepareForMarket = function (market) {
                market.rootsLC = market.roots.map(v => v.toLowerCase());
                if (data.sport === 'FOOTBALL' && data.time_value === 'HALF_TIME' && ['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                    market.roots = market.roots.map(v => '1st Half ' + v);
                }
                return market;
            };

            let market = finalPrepareForMarket(markets[data.market][data.target]);

            console.log('%cFinal market is:', 'background: green; color: white; font-weight: bold;');
            console.log(market);

            let checkedSuperRoot = 0;

            const expandSuperRoots = function () {
                return new Promise((onSuccess, onReject) => {
                    const expandOne = function (current) {
                        const $superRoot = $(`a.filter-list__link[data-marketcollectionname="${market.superRoots[current]}"]:visible`);
                        if ($superRoot.length > 0 && !$superRoot.hasClass('-active')) {
                            mouseChain({
                                target: $superRoot[0],
                                events: ['mouseover', 'mousedown', 'click', 'mouseup'],
                                scroll: true
                            })
                                .then(delayFunction(1000))
                                .then(() => onSuccess(`${market.superRoots[current]} must be expanded!`))
                                .catch(e => onReject(`Can't expand superRoot (${market.superRoots[current]}): ${e}`));
                        } else {
                            onSuccess(`${market.superRoots[current]} already expanded!`)
                        }
                    };
                    expandOne(checkedSuperRoot);
                });
            };

            const needFineInSecond = () => ['HDP', 'T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1
                || (data.sport === 'HOCKEY' && ['TOTAL'].indexOf(data.market) > -1);

            let performGet = function () {
                let currentRoot = -1;
                let lookForPivot = function ($candidate) {
                    console.log('%c' + 'lookForPivot in:', 'background: green; color: white; font-weight: bold;');
                    console.log($candidate);
                    let found = false;
                    for (const i in market.pivotKeys) {
                        if (!market.pivotKeys.hasOwnProperty(i)) {
                            continue;
                        }
                        const p = market.pivotKeys[i];
                        $candidate.find('div.btmarket__selection').each(function () {
                            const sec = $(this).find('span.selectionhandicap').text().trim();
                            const check = $(this).find('p.btmarket__name').text().replace(/\s+/g, ' ').trim()
                                + (needFineInSecond && sec !== '' ? ` (${sec})` : '');
                            console.log('"' + check + '" === "' + p + '"');
                            if (check === p) {
                                found = true;
                                onSuccess($(this).find('button.oddsbutton'));
                                return false;
                            }
                        });
                        if (found) {
                            break;
                        }
                    }
                    return found;
                };
                let checkRoot = function ($candidate) {
                    $candidate[0].scrollIntoView(false);
                    return lookForPivot($candidate.closest('section'));
                };
                let nextRoot = function () {
                    let checkOne = function ($candidate, callback) {
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
                    if (currentRoot >= market.roots.length) {
                        onReject(`Root ${currentRoot} not found :(`);
                    } else {
                        console.log('Checking: ' + market.roots[currentRoot],
                            'h2.fl:textEquals("' + market.roots[currentRoot] + '")');
                        let $candidate = $('h2.fl:textEquals("' + market.roots[currentRoot] + '")');
                        if ($candidate.length === 1) {
                            if (!$candidate.parent().hasClass('-expanded')) {
                                mouseChain({target: $candidate.parent()[0], events: ['click']})
                                    .then(delayFunction(400))
                                    .then(() => checkOne($candidate, nextRoot))
                                    .catch(e => onReject('Error expanding: ' + e))
                            } else {
                                checkOne($candidate, nextRoot);
                            }
                        } else if ($candidate.length > 1) {
                            console.log('%c' + 'Look at length: ' + $candidate.length,
                                'background: red; color: yellow; font-size: 15px; font-weight: bold; padding: 5px; border: 5px solid yellow;');
                        } else if ($candidate.length === 0) {
                            nextRoot();
                        }
                    }
                };
                if (market.superRoots && market.superRoots.length > 0) {
                    expandSuperRoots()
                        .then(c => console.log('%c' + c, 'background: lightyellow;'))
                        .then(nextRoot)
                        .catch(e => onReject('expandSuperRoots: ' + e));
                } else {
                    nextRoot();
                }
            };
            performGet();
            //#-#-FINISH
        });
    };

    /**
     * Close early opened coupons
     * @param skipParam [{boolean}] default FALSE - whether we need to skip closing
     * @returns {Promise<string,string>}
     */
    let closePreviousCoupons = async skipParam => {
        let skip = typeof skipParam === 'undefined' ? false : skipParam;
        if (skip) {
            return 'skipped!';
        }
        const $clearBtn = $('button.bs-bet-clear-betslip__button:visible');
        if ($clearBtn.length === 1) {
            await mouseChain({target: $clearBtn[0], events: ['click'], scroll: true, error: 'ClearBtn'});
            await delayPromise(555);
        }
        const removeSel = 'button.bs-selection-remove';
        while ($(removeSel).length > 0) {
            await mouseChain({target: $(removeSel)[0], events: fullClick, error: 'removeSel'});
            await delayPromise(555);
        }
        return 'All should be closed!';
    };

    /**
     * Open event table, if we're on it already -  onSuccess
     * @param {object} data
     * @returns {Promise<any>}
     */
    let openEvent = function (data) {
        return new Promise(function (onSuccess, onReject) {
            bsDebug(port, 'openEvent', data);
            const team1 = data.team1.toLowerCase();
            const team2 = data.team2.toLowerCase();
            const eventName = team1 + ' v ' + team2;
            const sportLink = sportAccordance[data.sport] ? sportAccordance[data.sport].toLowerCase().replace(' ', '-') : '';
            const sport = sportAccordance[data.sport] ? sportAccordance[data.sport] : '';
            if (sport === '') {
                onReject('Sport ' + data.sport + ' not supported or presented :(');
            }
            const checkScoreRow = async ($row) => {
                checkScoreToDo = false;
                if (data.score.search(/\d+:\d+/) === -1 || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1
                    || data.sport !== 'FOOTBALL') {
                    await delayPromise(1000);
                    return;
                }

                const $content = $row.closest('div.btmarket__content');
                if ($content.length > 0) {
                    if ($content.find('span.team-a').trt() === '' && $content.find('span.team-b').trt() === '') {
                        checkScoreToDo = true;
                        return;
                    }
                    const localScore = $content.find('span.team-a').trt() + ':' + $content.find('span.team-b').trt();
                    if (localScore !== data.score.replace(/[^0-9:]/g, '').trim()) {
                        throw `SCORE_CHANGED! We have: ${localScore}, we need: ${data.score}`;
                    }
                } else {
                    throw 'no content in row!';
                }
            }
            const checkOddsFormatAndMarkets = async () => {
                await delayPromise(111);
                if ($('span.betbutton__odds').text().indexOf('.') === -1) {
                    await mouseChain({
                        target: $('span:contains("Odds Format")')[0],
                        events: fullClick, scroll: true, error: 'DC1',
                    });
                    const $el = await waitForElement('nav[data-test-id="@sportsbook/odds.dropdown_odds-selector"]:visible span.sb-header-drawer-item__name:contains("Decimal")',
                        333, 5000, true);
                    await delayPromise(1000);
                    await mouseChain({
                        target: $el[0],
                        events: fullClick, error: 'DC2'
                    })
                    await delayPromise(3333);
                }
            };
            const result = function (status, message) {
                if (status) {
                    waitForCondition(() => {
                        return checkWeAreThere();
                    }, 777, 30000, 'It looks like we are not there!')
                        .then(checkOddsFormatAndMarkets)
                        .then(() => onSuccess())
                        .catch((e) => onReject(e));
                } else {
                    onReject(message);
                }
            };
            const checkWeAreThere = function () {
                //bsDebug(port, 'checkWeAreThere');
                if ($('#wh-global-overlay:visible').length > 0 &&
                    $('p.wh-preloader-container__text:visible').text().indexOf('please check your connection') > -1) {
                    window.location.reload(true);
                }
                const sportHere = $('#sidebar-left-context li').first().text().trim();
                const teams = $('span[class^="pageTitle__page-title"] h2').text().trim().split(' v ');
                if (sportHere === sport && teams.length === 2) {
                    const checkEvent = (teams[0] + ' v ' + teams[1]).toLowerCase();
                    return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 80;
                } else {
                    return false;
                }
            };
            const switchToSport = function () {
                return new Promise(function (onSuccess, onReject) {
                    waitForElement('#contextual-navigation', 333, 7777)
                        .then(delayFunction(1000))
                        .then(() => bsDebug(port, 'We\'re about switch to sport!'))
                        .then(() => mouseChain({
                            target: $('a[data-sport-slug="' + sportLink + '"]')[0],
                            events: ['click']
                        }))
                        .then(delayFunction(3333))
                        .then(() => onSuccess('switched to ' + sport))
                        .catch((e) => onReject('topSports: ' + e));
                });
            };
            const findEvent = function () {
                return new Promise(function (onSuccess, onReject) {
                    switchToSport()
                        .then((e) => bsDebug(port, 'switchToSport: ' + e))
                        .then(delayFunction(777))
                        .then(() => {
                            let $el = [];
                            $('ul.btmarket__content-margins a.btmarket__name').each((idx, val) => {
                                const checkEvent = $(val).attr('title').trim().toLowerCase();
                                console.log('"' + checkEvent + ' === ' + '"' + eventName + '"');
                                if (checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 65) {
                                    $el = $(val);
                                    return false;
                                }
                            });
                            return $el;
                        })
                        .then(($r) => {
                            console.log('$r ', $r);
                            if ($r.length === 1) {
                                return checkScoreRow($r)
                                    .then(delayFunction(1111))
                                    .then(() => mouseChain({
                                        target: $r[0],
                                        events: ['click'], scroll: true
                                    }))
                            } else {
                                throw 'Wrong length of Event: ' + $r.length;
                            }
                        })
                        .then(delayFunction(2222))
                        .then(() => onSuccess('We are on event!'))
                        .catch((e) => onReject('SST: ' + e));
                });
            };
            const goRightPage = function () {
                delayPromise(111)
                    .then(() => {
                        const $asip = $('h1.header-panel__title:contains("All Sports In-Play"):visible');
                        const $activeTab = $('ul#contextual-navigation-menu li.contextual-nav__item--active');
                        if ($asip.length !== 1) {
                            return mouseChain({
                                target: $('#nav-in-play a:visible')[0],
                                events: ['click'],
                                scroll: true
                            })
                                .then(delayFunction(3333));
                        } else if ($activeTab.length === 0) {
                            return mouseChain({
                                target: $('#nav-in-play a:visible')[0],
                                events: ['click'],
                                scroll: true
                            })
                                .then(delayFunction(3333));
                        }
                    })
                    .then(findEvent)
                    .then(() => result(true, ''))
                    .catch((e) => result(false, 'findEvent 1:' + e));
            };
            if (!checkWeAreThere()) {
                goRightPage();
            } else {
                result(true, 'We probably on event page!');
            }
        });
    };

    /**
     * Opens coupon with stake (stakes)
     * @param {object[]} paramData - array of bets to open
     * @returns {Promise<float, string>}
     */
    const openCoupon = paramData => new Promise((onSuccess, onReject) => {
        const checkScore = async () => {
            if (data.score.search(/\d+:\d+/) === -1 || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1
                || data.sport !== 'FOOTBALL') {
                await delayPromise(1000);
                return;
            }
            let r;
            const check = () => new Promise(onSuccess => {
                chrome.storage.local.get(['WILLIAMHILL_MSCORE'],
                    rw => {
                        r = typeof rw.WILLIAMHILL_MSCORE === 'undefined' ? {} : rw.WILLIAMHILL_MSCORE;
                        const ok = typeof r.match !== 'undefined' && typeof r.score !== 'undefined'
                            && typeof r.set !== 'undefined' && r.match !== '' && r.score !== '';
                        onSuccess(ok && Date.now() - r.set < 333);
                    });
            });
            await waitForCondition(check, 300, settings.maxWaitForScore, 'No SCORE!');
            if (r.score !== data.score.replace(/[^0-9:]/g, '').trim()) {
                throw `SCORE_CHANGED! We have: ${r.score}, we need: ${data.score}`;
            }
        };
        let result = function (success, message) {
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
                    onSuccess(777777777);
                }
            } else {
                bsError(port, message);
                onReject(message);
            }
        };
        const checkCoupon = async () => {
            const event = (data.team1 + ' v ' + data.team2).toLowerCase();
            let result = false;
            // Hint: errors!
            // invalid-bet // price-up
            // $('#error-box-footer:visible').text().trim().indexOf('bet has changed') > -1
            const teamsSelector = 'div.bs-selection:last';

            await waitForElement(teamsSelector, 333, 10000);
            const teams = $(teamsSelector).find('span[data-test-id="event-name"]').text().trim()
                .replace(/\s+/g, ' ').trim().replace(/-/, '').trim().toLowerCase();
            if (event === teams || locutus_similar_text(event, teams, true) > 80) result = true;
            if (!result) throw 'Wrong match opened: ' + teams
        };
        let lData = paramData.slice();
        let data = {};
        let betElementSelector;
        //let stakesLength = 0;
        const clickStake = async betElementSelector => {
            const checkClicked = () => $(betElementSelector).hasClass('active')
            let tries = 0;
            while (tries < 3 && !checkClicked()) {
                await mouseChain({
                    target: $(betElementSelector)[0],
                    events: ['mouseover', 'mousedown', 'click', 'mouseup', 'mouseout'],
                    scroll: true,
                    scrollTop: true
                });
                tries++;
                await delayPromise(1500);
            }
            if (!checkClicked()) {
                throw `We tried ${tries} and element still not clicked :(`;
            }
        };
        let openElement = function () {
            openEvent(data)
                .then(async () => {
                    bsDebug(port, 'Event must be opened!');
                    if (checkScoreToDo === true) {
                        await checkScore();
                    }
                    const $el = await getBetElement(data);
                    betElementSelector = '#' + $el.attr('id');
                    bsDebug(port, `We got element! ${betElementSelector} - Coef: `
                        + $(betElementSelector).text().trim());
                    await clickStake(betElementSelector);
                    //$('input[value="Place Bet"]:visible')[0].scrollIntoView(false);
                    //++stakesLength;
                    await delayPromise(1555);
                    await checkCoupon();
                    result(true, 'Max collects later...');
                })
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
     * Check authorization
     */
    const authCheck = function () {
        if (enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            bsError(port, 'ERROR AUTH!');
            return;
        }
        (async () => {
            const loginBtn = $('button[data-test-id="@sitebase/login-button_loginButtonId"]');
            const $cookie = $('button.cookie-disclaimer__button');
            const $accept = $('main:contains("General Terms & Conditions") button[name="flag-submit-button"]');
            if ($('span.bs-bet-place__stake-info:contains("Log in")').length > 0) {
                window.location.reload(true);
                return true;
            }
            if ($accept.length > 0) {
                await mouseChain({target: $accept[0], events: fullClick, error: '$accept'});
                await delayPromise(1000);
            } else if ($cookie.length > 0) {
                await mouseChain({target: $cookie[0], events: fullClick, error: '$cookie'});
                await delayPromise(1000);
            } else if (loginBtn.length > 0) {
                port.postMessage({m: "tech works! 2"});
                await mouseChain({target: loginBtn[0], events: fullClick, error: 'login button click'});
                await delayPromise(3333);
                await tryToLogIn();
            } else if ($('form.c-login-form').length > 0 && Date.now() - authClicked > 60000) {
                port.postMessage({m: "tech works! 2"});
                await delayPromise(1000);
                await tryToLogIn();
            } else {
                const balanceSel = $('span.cp-ma-myaccount-dropdown-button__balance:visible').length > 0;
                // When we're logged in and balance successfully checked set limited to false, auth check and auth clicks to zero
                if (balanceSel) {
                    authClicked = 0;
                    port.postMessage({
                        m: "authorized!",
                        balance: getBalance(true)
                    });
                }
            }
        })()
            .catch(e => console.log('%c' + `authCheck: ${e}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    /**
     * Try to login
     * @returns {Promise<void>}
     */
    const tryToLogIn = async () => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        authClicked = Date.now();
        await clearAndSimulate($('input[name="username"]')[0], settings.login);
        await delayPromise(1500);
        await clearAndSimulate($('input[name="password"]')[0], settings.password);
        await delayPromise(1500);
        if (!$('input#rememberUsername').is(':checked')) {
            await mouseChain({
                target: $('label[for="rememberUsername"]')[0],
                events: fullClick,
                error: 'rememberUsername',
            });
            await delayPromise(1500);
        }
        const submitSel = 'button[name="login-submit-button"]';
        await mouseChain({
            target: $(submitSel)[0],
            events: fullClick,
            error: `can't click login`,
        });
        authClicked = Date.now();
        await delayPromise(2222);
        if ($(submitSel).is(':disabled')) {
            throw 'login is failed';
        }
        const error = $('div.c-login-form__login-error-title').text().trim();
        if (error.length > 0) {
            throw error;
        }
        const $errorMessage = await waitForElement('div[data-test-id="error-box-message"]:visible', 300, 4444).catch(() => $([]));
        if ($errorMessage.length > 0) {
            enterError = true;
            throw $errorMessage.trt();
        }
        await waitForElement('div.cp-ma-myaccount-dropdown', 333, 7777);
    };

    /**
     * Get balance
     * @param returnNull
     * @returns {number}
     */
    function getBalance(returnNull) {
        const $b = $('span.cp-ma-myaccount-dropdown-button__balance:visible');
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.text().replace(/[^\d.]/g, '').trim());
    };

    function alternateCommandProcessor(command) {
        const renewAlternate = () => new Promise(onSuccess => {
            chrome.storage.local.set({
                'WILLIAM_ALTERNATE_COMMAND': command,
                'WILLIAM_ALTERNATE_COMMAND_WAS_SET': Date.now()
            }, onSuccess);
        });
        console.log('%c' + 'alternateCommandProcessor', 'background: green; color: white; font-size: 14px; font-weight: bold; padding: 10px;', command);
        if (command.action === 'WITHDRAW') {
            const step = command.step || 'first';
            console.log('%c' + `STEP -= ${step.toUpperCase()} =- START!`,
                'background: yellow; color: red; font-size: 17px; font-weight: bold; padding: 7px;');
            const steps = {
                first: () => {
                    return waitForElement('input[name="txnAmount"]:visible', 333, 30000, true)
                        .then($el => delayPromise(3333, $el))
                        .then($el => clearAndSimulate($el[0], command.data.amount))
                        .then(waitDelayClickF('#submitButton', 10000, ['mouseover', 'mousedown', 'click', 'mouseup']))
                        .then(() => command.step = 'third')
                        .then(() => renewAlternate());
                },
                second: () => {
                    command.step = 'third';
                    return renewAlternate()
                        .then(waitDelayClickF('#submitButton', 60000, ['mouseover', 'mousedown', 'click', 'mouseup']));
                },
                third: () => {
                    command.step = 'fourth';
                    return renewAlternate()
                        .then(waitDelayClickF('#wtdSubmit', 60000, ['mouseover', 'mousedown', 'click', 'mouseup']));
                },
                fourth: () => new Promise((onSuccess, onReject) => {
                    waitForElement('#s_success:visible', 333, 60000)
                        .then(() =>
                            chrome.storage.local.set({
                                'DEPOSIT_RESULT': {success: true, message: 'It might be good :)'},
                                'DEPOSIT_RESULT_WAS_SET': Date.now()
                            }))
                        .then(() => onSuccess('Alles este is in ordnung!'))
                        .then(waitDelayClickF('#backToSiteBtn', 10000, ['mouseover', 'mousedown', 'click', 'mouseup']))
                        .catch(e => onReject('Fourth step: ' + e));
                })
            };
            steps[step]()
                .then(() => console.log('%c' + `STEP -= ${step.toUpperCase()} =- DONE!`,
                    'background: green; color: white; font-size: 17px; font-weight: bold; padding: 7px;'))
                .catch(e => {
                    chrome.storage.local.set({
                        'DEPOSIT_RESULT': {success: false, message: 'Error till withdrawal: ' + e},
                        'DEPOSIT_RESULT_WAS_SET': Date.now()
                    });
                    waitDelayClickF('#close', 10000, ['mouseover', 'mousedown', 'click', 'mouseup'])();
                });
        } else if (command.action === 'DEPOSIT') {
            waitForElement('#paymentSINGLE_MB_MB', 333, 30000, true)
                .then(delayFunction(111))
                .then(() => console.log('Let\'s click!'))
                .then(() => mouseChain({
                    target: $('#paymentSINGLE_MB_MB')[0],
                    events: ['mouseover', 'mousedown', 'click', 'mouseup']
                }))
                .then(waitForElementF('input[name="txnAmount"]:visible', 333, 3000, true))
                .then(($el) => delayPromise(3333, $el))
                .then(($el) => clearAndSimulate($el[0], command.data.amount))
                .then(delayFunction(3333))
                .then(() => chrome.storage.local.set({
                    'SKRILL_COMMAND': command,
                    'SKRILL_COMMAND_WAS_SET': Date.now()
                }))
                .then(() => mouseChain({
                    target: $('input.submitGreen[value="Deposit"]:visible')[0],
                    events: ['click']
                }))
                .then(delayFunction(3333))
                .then(() => {
                    const $err = $('div.tooltipGroup.error:visible');
                    if ($err.length > 0) {
                        throw $err.text().trim();
                    }
                })
                .catch(e => chrome.storage.local.set({
                    'DEPOSIT_RESULT': {success: false, message: 'Error before skrill: ' + e},
                    'DEPOSIT_RESULT_WAS_SET': Date.now()
                }));
        } else if (command.action === 'BET_RESULT') {
            collectBetResults(command.data)
                .then(m => console.log(m));
        }
    };

    if (port) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message);
        });
    }

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            chrome.storage.local.set({
                'WILLIAM_COMMAND': ourCommand.get(),
                'WILLIAM_COMMAND_WAS_SET':
                    increaseDelay ? Date.now() + 120000 : Date.now()
            });
        }
    }, true);

    const loadAndProceedCommand = (waitForAuth) => {
        chrome.storage.local.get(['WILLIAM_COMMAND', 'WILLIAM_COMMAND_WAS_SET'], function (result) {
            bsDebug(port, 'Saved command:', result);
            if (typeof result.WILLIAM_COMMAND !== 'undefined' && typeof result.WILLIAM_COMMAND_WAS_SET !== 'undefined'
                && Date.now() - result.WILLIAM_COMMAND_WAS_SET < 40000) {
                let currentCommand = result.WILLIAM_COMMAND;
                chrome.storage.local.remove(['WILLIAM_COMMAND', 'WILLIAM_COMMAND_WAS_SET'], function () {
                    if (waitForAuth) {
                        waitForCondition(() => {
                            return wasAuthCheck !== false;
                        }, 222, 10000, 'AuthCheck was not', false)
                            .then(() => messageProcessor(currentCommand))
                            .catch((e) => bsError(port, 'Something wrong with auth check! ' + e));
                    } else {
                        messageProcessor(currentCommand);
                    }
                });
            } else {
                chrome.storage.local.remove(['WILLIAM_COMMAND', 'WILLIAM_COMMAND_WAS_SET']);
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        if (document.location.protocol === 'https:'
            && (document.location.href.indexOf('deposit/deposit.html') > -1
                || document.location.href.indexOf('withdraw/withdraw') > -1
                || window.location.href.indexOf('https://myaccount.williamhill.com/statements') > -1)) {
            console.log('%c' + 'Alternate: ' + document.location.href,
                'background: transparent; color: green; font-size: 15px; font-weight: normal; padding: 15px;');
            chrome.storage.local.get(['WILLIAM_ALTERNATE_COMMAND', 'WILLIAM_ALTERNATE_COMMAND_WAS_SET'], function (result) {
                if (typeof result.WILLIAM_ALTERNATE_COMMAND !== 'undefined' && typeof result.WILLIAM_ALTERNATE_COMMAND_WAS_SET !== 'undefined'
                    && Date.now() - result.WILLIAM_ALTERNATE_COMMAND_WAS_SET < 40000) {
                    const aCommand = result.WILLIAM_ALTERNATE_COMMAND;
                    chrome.storage.local.remove(['WILLIAM_ALTERNATE_COMMAND', 'WILLIAM_ALTERNATE_COMMAND_WAS_SET'], function () {
                        alternateCommandProcessor(aCommand);
                    });
                } else {
                    chrome.storage.local.remove(['WILLIAM_ALTERNATE_COMMAND', 'WILLIAM_ALTERNATE_COMMAND_WAS_SET']);
                }
            });
        } else if (window.self === window.top) {
            port.postMessage({m: "PAGE LOADED!"});
            console.log('loaded and message sent!');
            loadAndProceedCommand(true);
        }
    }
})();
