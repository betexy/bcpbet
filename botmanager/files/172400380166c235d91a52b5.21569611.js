(function () {

    "use strict";

    let authClicked = 0;
    let busy = false;
    const bkHere = window.location.href.indexOf('old') > -1 ? "favbetold" : "favbet";
    let port = chrome.runtime.connect({name: `port_${bkHere}`});
    let settings = {
        authCheckInterval: 2000,
        url: 'https://www.old.favbet.com/en/live/',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 1,
        betweenBets: 25000,
    };

    const fullClick = ['mouseover', 'mousedown', 'click', 'mouseup'];

    let enterError = false;
    let currentBetData = {};
    let currentCommand = '';
    let newAPI = false;
    let ourCommand = {
        _message: {},
        isSet: function () {
            return !(Object.keys(this._message).length === 0 && this._message.constructor === Object);
        },
        set: function (message) {
            //bsDebug(port, 'SET SET SET', message);
            this._message = message;
        },
        add: function (name, value) {
            this._message[name] = value;
        },
        getAdded: function (name) {
            return typeof this._message[name] === 'undefined' ? false : this._message[name];
        },
        get: function () {
            return this._message;
        },
        clear: function () {
            this._message = {};
        }
    };

    function getBalance(returnNull) {
        const $b = $('span[data-role="user-balance-header"]:visible');
        return $b.length === 0
            ? (!!returnNull ? null : 0)
            : parseFloat($b.trt().replace(',', '.')
                .replace(/[^\d.]/g, '').trim());
    };

    const messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;
        currentCommand = message.action;
        let $logLink = $('div.not_login button.loginpagecl');
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
            settings.eventMaxBets = 1;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            if (bkHere === 'favbetold') {
                authCheck(settings);
            } else {
                authCheckNew();
            }
        } else if ($logLink.length !== 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (message.action === 'MAXIMUM') {
            busy = true;
            ourCommand.set(message);
            bsDebug(port, 'MAXIMUM for: ' + message.data[0].market + '/' + message.data[0].target + '/' + message.data[0].pivot);
            let maximum = 0;
            closePreviousCoupons(typeof message.express !== 'undefined')
                .then(() => openCoupon(message.data))
                .then((max) => {
                    maximum = max;
                    return checkCoefs(message.data);
                })
                .then(() => {
                    busy = false;
                    port.postMessage({
                        answered: "MAXIMUM",
                        status: 'success',
                        answer: maximum
                    });
                    ourCommand.clear();
                })
                .catch((e) => {
                    busy = false;
                    port.postMessage({
                        answered: "MAXIMUM",
                        status: "error",
                        answer: "Error: " + e
                    });
                    ourCommand.clear();
                });
        } else if (['BET', 'EXPRESS_BET', 'BET_RESULT'].indexOf(message.action) > -1) {
            busy = true;
            ourCommand.set(message);
            (message.action === 'BET_RESULT' ? bkHere === 'favbetold' ? collectBetResults : collectBetResultsNew : proceedBet)(message.data)
                .then(() => bsDebug(port, "It's looks like BET done!"))
                .catch(e => bsError(port, `Error till ${message.action}: ` + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                    if (message.action === 'BET_RESULT') {
                        return goToHome();
                    }
                });
        } else if (['DEPOSIT', 'WITHDRAW', 'CHECK_PAYMENTS'].indexOf(message.action) > -1) {
            busy = true;
            ourCommand.set(message);
            (function (d) {
                return message.action === 'DEPOSIT' ? deposit(d) : message.action === 'WITHDRAW' ? withdraw(d) : checkPayments(d);
            })(message.data)
                .then(() => bsDebug(port, 'It\'s looks like ' + message.action + ' done!'))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                    return goToHome();
                });
        }
    };

    const checkPayments = function () {
        bsDebug(port, 'checkPayments!');
        return new Promise(function (onSuccess, onReject) {
            let collected = [];
            let report = function (success, message) {
                bsDebug(port, 'Report! ' + success + ' / ' + message);
                port.postMessage({
                    answered: "CHECK_PAYMENTS",
                    data: success ? collected : [],
                    answer: message
                });
                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                }
                delayPromise(3333).then(() => {
                    if ($('div.personal-office-title').length > 0) {
                        mouseChain({target: $('span.iconbl.icon_close:visible').first()[0], events: ['click']})
                            .then().catch();
                    }
                });
            };
            let justCollect = function ($el, type) {
                $el.find('tbody>tr:visible').each(function () {
                    let $tds = $(this).find('td');
                    collected.push({
                        date: $tds.eq(4).trt(),
                        description: $tds.eq(0).trt() + ' ' + $tds.eq(1).trt(),
                        type: type,
                        paysystem: $tds.eq(1).trt().indexOf('QIWI') > -1 ? 'QIWI'
                            : ($tds.eq(1).trt().indexOf('SKRILL') > -1 ? 'SKRILL' : ''),
                        amount: $tds.eq(2).text().replace(/[^0-9\.]/g, '').trim(),
                        success: $tds.eq(3).hasClass('completed')
                    });
                });
            };
            let letsRockNRoll = function () {
                bsDebug(port, 'letsRockNRoll');
                waitForElement('div.message--icon', 333, 10000)
                    .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                    .then(waitForElementF('div.title_text:textEquals("Личный кабинет"):visible', 333, 10000))
                    .then(waitDelayClickF('ul.nav li:textEquals("Баланс")', 10000))
                    .then(waitDelayClickF('button:textEquals("История депозитов")', 10000))
                    .then(delayFunction(3333))
                    .then(waitForElementF('#dateFilter_bns_history', 333, 10000, true))
                    .then($el => {
                        if ($el.val() !== '4') {
                            return selectLikePuppeteer($el[0], ['4'])
                                .then(delayFunction(4000));
                        }
                    })
                    .then(waitForElementF('table.header_dep_his', 333, 10000))
                    .then(($el) => justCollect($el, 'IN'))
                    .then(delayFunction(3333))
                    .then(waitDelayClickF('button:textEquals("История выводов")', 10000))
                    .then(delayFunction(3333))
                    .then(waitForElementF('#dateFilter_bns_history', 333, 10000, true))
                    .then($el => {
                        if ($el.val() !== '4') {
                            return selectLikePuppeteer($el[0], ['4'])
                                .then(delayFunction(4000));
                        }
                    })
                    .then(waitForElementF('table.header_dep_his', 333, 10000))
                    .then(($el) => justCollect($el, 'OUT'))
                    .then(delayFunction(3333))
                    .then(() => report(true, 'Collected!'))
                    .catch((e) => report(false, 'checkPayments: ' + e));
            };
            letsRockNRoll();
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
                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                }
                delayPromise(3333).then(() => {
                    if ($('div.payment_operation_result:visible').length > 0 || $('div.three_level_popup:visible').length > 0) {
                        mouseChain({target: $('span.iconbl.icon_close:visible').first()[0], events: ['click']})
                            .then().catch();
                    }
                });
            };
            let letsRockNRoll = function () {
                bsDebug(port, 'letsRockNRoll');
                waitForElement('div.message--icon', 333, 10000)
                    .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                    .then(waitForElementF('div.title_text:textEquals("Личный кабинет"):visible', 333, 10000))
                    .then(waitForElementF('ul.nav li:textEquals("Баланс")', 333, 10000))
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                    .then(waitForElementF('table.wallets tr', 333, 10000))
                    .then(() => {
                        let active = false, found = false;
                        let $el = [], balance = 0;
                        $('table.wallets tr').each(function () {
                            let $this = $(this);
                            balance = parseFloat($this.find('div.current_cash').text().replace(/[^0-9\.]/g, '').trim());
                            if ($this.find('div.num_wallet').trt() === data.login && $this.hasClass('active_wallet')) {
                                active = true;
                                return false;
                            } else if ($this.find('div.num_wallet').trt() === data.login) {
                                $el = $this;
                                found = true;
                                return false;
                            }
                            //console.log($this.hasClass('active_wallet'));
                            //console.log($this.find('div.current_cash').text().replace(/[^0-9\.]/g, '').trim());
                            //console.log($this.find('div.num_wallet').text().trim());
                        });
                        if ((active || found) && balance < parseFloat(data.amount)) {
                            throw 'NO_FUNDS! ' + balance + ' < ' + data.amount;
                        } else if (!active && found && $el.length > 0) {
                            return mouseChain({target: $el[0], events: ['click']});
                        } else if ((!active && !found) || (found && $el.length === 0)) {
                            throw 'Wrong login!';
                        }
                    })
                    .then(delayFunction(5555))
                    .then(() => clearInputElement({
                        string: data.amount,
                        element: $('input.amount_dep')[0],
                        long: true,
                        fireChange: false,
                        fireInput: true,
                        emulateTab: true
                    }))
                    .then(emulateKeyboardLikeHuman)
                    .then(delayFunction(3333))
                    .then(() => mouseChain({target: $('button.withdraw_btn')[0], events: ['click']}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('input.withdrawal_pass', 333, 10000))
                    .then(($el) => clearInputElement({
                        string: data.bkPassword,
                        element: $el[0],
                        long: true,
                        fireChange: false,
                        fireInput: true,
                        emulateTab: true
                    }))
                    .then(emulateKeyboardLikeHuman)
                    .then(delayFunction(3333))
                    .then(() => mouseChain({target: $('button.submit_withdrawal')[0], events: ['click']}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('div.request_text', 333, 10000))
                    .then(($el) => {
                        if ($el.trt().indexOf('ЗАПРОС ПОЛУЧЕН') > -1) {
                            report(true, 'Everything is Okay!');
                        } else {
                            report(false, 'Strange: ' + $el.text().trim())
                        }
                    })
                    .catch((e) => report(false, 'Entering withdraw: ' + e));
            };
            letsRockNRoll();
        });
    };

    const deposit = function (data) {
        bsDebug(port, 'Deposit!', data);
        return new Promise(function (onSuccess, onReject) {
            let report = function (success, result) {
                const message = typeof result === 'string' ? result : result.message;
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
                }
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
            let pD = {
                'QIWI': {
                    entered: 'qiwiEntered',
                    go: 'li.payment.QIWI:first div.payment_deposit_action_block',
                    activeWallet: 'div.selectwallet_wrap',
                    setF: function () {
                        chrome.storage.local.set({
                            'QIWI_COMMAND': ourCommand.get(),
                            'QIWI_COMMAND_WAS_SET': Date.now()
                        });
                    }
                },
                'SKRILL': {
                    entered: 'skrillEntered',
                    go: 'li.payment.Skrill:first div.payment_deposit_action_block',
                    paymentName: 'div.payment_name:textEquals("Skrill"):visible',
                    activeWallet: 'div.selectwallet_wrap',
                    setF: function () {
                        chrome.storage.local.set({
                            'SKRILL_COMMAND': ourCommand.get(),
                            'SKRILL_COMMAND_WAS_SET': Date.now()
                        });
                    }
                }
            };
            let p = pD[data.paysystem];
            let letsRockNRoll = function () {
                bsDebug(port, 'letsRockNRoll');
                if (ourCommand.getAdded(p.entered) !== false) {
                    //bsDebug(port, 'Started wait for deposit result...', [], 'COLOR:yellow,red');
                    waitForCondition(() => {
                        getDepositResult();
                        return typeof depositResult.success === 'boolean';
                    }, 1000, 150000, 'no deposit result (or it is outdated) for 150s!')
                        .then(() => {
                            //bsDebug(port, 'getDepositResult', depositResult, 'COLOR:yellow,red');
                            if (typeof depositResult.success === 'boolean') {
                                if (data.paysystem === 'SKRILL') {
                                    chrome.storage.local.remove(['SKRILL_COMMAND', 'SKRILL_COMMAND_WAS_SET']);
                                }
                                report(depositResult.success, typeof depositResult.message === 'string' ? depositResult : 'No message :(');
                            }
                        })
                        .catch((e) => report(false, 'preFinal: ' + e))
                        .then(() => {
                            if ($('div.payment_operation_result:visible').length > 0 || $('div.three_level_popup:visible').length > 0) {
                                mouseChain({
                                    target: $('span.iconbl.icon_close:visible').first()[0],
                                    events: ['click']
                                })
                                    .then().catch();
                            }
                        })
                        .catch((e) => bsError(port, 'Something wrong till close...' + e));
                } else {
                    waitForElement('div.message--icon', 333, 10000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                        .then(waitForElementF('div.title_text:textEquals("Личный кабинет"):visible', 333, 10000))
                        .then(waitForElementF('ul.nav li:textEquals("Баланс")', 333, 10000))
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        // Hint: let's make deposit
                        .then(waitDelayClickF('button.create_dep_btn'))
                        .then(() => {
                            if (p.paymentName) {
                                return waitDelayClickF(p.paymentName)();
                            }
                        })
                        .then(waitForElementF(p.activeWallet, 333, 10000))
                        .then(($el) => {
                            if ($el.text().indexOf(data.login.replace(/\+/, '')) === -1) {
                                throw 'This is not our wallet: ' + $el.trt();
                            }
                        })
                        .then(delayFunction(3333))
                        .then(() => {
                            let $wallet = $('input.wallet_id');
                            if ($wallet.length > 0 && $wallet.val() !== data.login) {
                                return clearInputElement({
                                    string: data.login,
                                    element: $wallet[0],
                                    long: true,
                                    fireChange: true,
                                    fireInput: true
                                })
                                    .then(emulateKeyboardLikeHuman)
                                    .then(delayFunction(3333));
                            }
                        })
                        .then(() => clearInputElement({
                            string: data.amount,
                            element: $('#currencyInput')[0],
                            long: true,
                            fireChange: false,
                            fireInput: true,
                            emulateTab: true
                        }))
                        .then(emulateKeyboardLikeHuman)
                        .then(() => {
                            ourCommand.add('increaseDelay', true);
                            ourCommand.add(p.entered, true);
                            chrome.storage.local.remove(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET'], function () {
                                p.setF();
                            });
                        })
                        .then(delayFunction(3333))
                        .then(() => mouseChain({
                            target: $('button.submit_data_wallet_btn:visible')[0],
                            events: ['click']
                        }))
                        .then(waitForNotConditionF(() => {
                            return $('div.message_bl div.error_context:visible').length > 0;
                        }, 333, 3333, 'Something wrong!'))
                        .then(delayFunction(3333))
                        .then(letsRockNRoll)
                        .catch((e) => report(false, 'Entering: ' + e));
                }
            };
            letsRockNRoll();
        });
    };

    const collectBetResultsNew = async inD => {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        let limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 40 ? parseInt(inD[1]) : 40) : 40;
        let pushCount = 0;
        let checkLimit = 0;
        let dataLength = data.length === 0 ? limit : data.length;

        const report = async (success, message) => {
            bsDebug(port, 'Collect data: success = ' + success + ', message = ' + message + ', data:', data);
            port.postMessage({
                answered: "BET_RESULT",
                status: success ? "success" : "error",
                answer: success ? collected : message
            });
            if (success) {
                return collected;
            } else {
                throw message;
            }
        };

        const expandHistory = async (n) => {
            for (let i = 0; i < n; i++) {
                const $showMore = await waitForElement('button span[class*="Button_content_"]:textEquals("Показать еще")', 300, 10000).catch(() => $([]));
                if ($showMore.length > 0) {
                    await mouseChain({target: $showMore[0], events: fullClick, scroll: true, error: 'Next'});
                    await delayPromise(777);
                } else {
                    break;
                }
            }
        }

        const collectOne = async () => {
            const $allEvents = await waitForElement('div[class^="Bet_container_"]',
                333, 20000);
            // let's collect data
            let status = 'ACCEPTED';
            const sText = $allEvents.eq(checkLimit).find('span[data-role="bet-info-general"]').trt();
            if (sText.indexOf('Выигрыш') > -1) {
                status = 'WON';
            } else if (sText.indexOf('Проигрыш') > -1) {
                status = 'LOSE';
            } else if (sText.indexOf('Возврат') > -1) {
                status = 'REFUNDED';
            }
            const coef = $allEvents.eq(checkLimit).find('span[class^="BetItem_outcomeCoef_"]').trt();
            const id = $allEvents.eq(checkLimit).find('span[data-role="bets-history-text-copy-id-text"]').trt().replace(/[^\d.]/g, '').trim();
            if (data.length === 0 || data.indexOf(id) > -1) {
                collected.push({
                    external_id: id,
                    status: status,
                    match: $allEvents.eq(checkLimit).find('span[data-role="outcome-participants"]').trt(),
                    bkPivot: $allEvents.eq(checkLimit).find('div[data-role="outcome-market-name"] span').trt(),
                    bkTeam: $allEvents.eq(checkLimit).find('span[data-role="outcome-name"]').trt(),
                    coef: coef,
                    stake: $allEvents.eq(checkLimit).find('span[data-role="bet-amount"]').trt().replace(/[^\d.]/g, '').trim(),
                    result: $allEvents.eq(checkLimit).find('span[data-role="bet-payout"]').trt().replace(/[^\d.]/g, '').trim()
                });
                pushCount++;
            }
            await delayPromise(1222);
            checkLimit++;
            if (checkLimit < limit && pushCount < dataLength && checkLimit < $allEvents.length) {
                await collectOne();
            } else {
                return;
            }
        }

        if (window.location.href.indexOf('personal-office/bets/sport/') > -1) {
            await delayPromise(888);
            await expandHistory(3);
            await collectOne()
                .then(() => report(true, ''))
                .catch(e => report(false, e));
        } else {
            const $betsTab = $('div[class*="BetSlipTab_menuTab_"]:textEquals("Мои ставки")');

            if ($betsTab.is('[class*="BetSlipTab_active"]') === false) {
                await mouseChain({target: $betsTab[0], events: fullClick});
                await delayPromise(888);
                const $allBets = await waitForElement('span:textEquals("Просмотреть все ставки")', 333, 30000)
                    .catch(e => report(false, e));
                await delayPromise(888);
                await mouseChain({target: $allBets[0], events: fullClick});
                await delayPromise(888);
                const $waitStatus = await waitForElement('div[class*="Box_box_"] span:textEquals("Статус")', 333, 30000)
                    .catch(e => report(false, e));
                await mouseChain({
                    target: $waitStatus.parent().find('div[class*="Popover_container_"] span')[0],
                    events: ['click']
                });
                await delayPromise(1888);
                await mouseChain({
                    target: $('div[class^="SelectContent_title_"]:textEquals("Статус не определен")')[0],
                    events: ['click']
                });
                await delayPromise(1888);
                await mouseChain({
                    target: $('button span[class*="Button_content_"]:textEquals("Применить")')[0],
                    events: ['click']
                });
                await delayPromise(555);
                await waitForElement('div[class^="Box_box_"]', 333, 10000)
                    .catch(e => report(false, e));
                await mouseChain({
                    target: $('div[class*="Box_box_"] span:textEquals("Статус")').parent().find('div[class*="Popover_container_"] span')[0],
                    events: ['click']
                });
                await delayPromise(1888);
                await mouseChain({
                    target: $('div[class^="SelectContent_title_"]:textEquals("Все ставки")')[0],
                    events: ['click']
                });
                await delayPromise(1888);
                await mouseChain({
                    target: $('button span[class*="Button_content_"]:textEquals("Применить")')[0],
                    events: ['click']
                });
                await delayPromise(1888);
                await expandHistory(3);
                await collectOne()
                    .then(() => report(true, ''))
                    .catch(e => report(false, e));
            } else {
                const $allBets = await waitForElement('span:textEquals("Просмотреть все ставки")', 333, 30000)
                    .catch(e => report(false, e));
                await delayPromise(888);
                await mouseChain({target: $allBets[0], events: fullClick});
                await delayPromise(888);
                await expandHistory(3);
                await collectOne()
                    .then(() => report(true, ''))
                    .catch(e => report(false, e));
            }
        }
    };

    /**
     * Collecting bet results
     * @param {array} inD
     * @returns {Promise<any>}
     */
    const collectBetResults = inD => new Promise(function (onSuccess, onReject) {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 20 ? parseInt(inD[1]) : 20) : 20;
        let ourPage = 1;
        bsDebug(port, 'collectBetResults, limit: ' + limit + ', data:', data);
        let report = function (success, message) {
            bsDebug(port, 'Collect data: success = ' + success + ', message = ' + message + ', data:', data);
            port.postMessage({
                answered: "BET_RESULT",
                status: success ? "success" : "error",
                answer: success ? collected : message
            });
            if (success) {
                onSuccess(collected);
            } else {
                onReject(message);
            }
            mouseChain({target: $('span.iconbl.icon_close:visible')[0], events: fullClick, error: 'Close'})
                .finally(() => console.log('done...'));
        };

        const collectKosherWay = async () => {
            const needNext = () => (data.length === 0 && collected.length < limit || (data.length > 0 && collected.length < data.length));
            const rowSel = 'div.rt-tr-group:visible';
            bsDebug(port, `collectKosherWay: ${$(rowSel).length}`);
            let nextPage = false;
            await waitForElement(rowSel, 333, 30000);
            await $(rowSel).eachAsync(async (idx, val) => {
                await mouseChain({
                    target: $(val).find('div.rt-tr')[0],
                    events: fullClick,
                    scroll: true,
                    error: 'Row'
                });
                const $wrapper = await waitForElement('div.cardshistory_wrapper', 333, 30000, true);
                collectOne($wrapper);
                await mouseChain({
                    target: $('span.close_two_level_popup span')[0],
                    events: fullClick,
                    error: 'Close row'
                });
                if (!needNext()) {
                    return false;
                }
                if ($(rowSel).length - 1 === idx) {
                    const $next = $('div[class="-next"] button');
                    if ($next.length > 0 && !$next.is(':disabled')) {
                        await mouseChain({target: $next[0], events: fullClick, scroll: true, error: 'Next'});
                        await delayPromise(5000);
                        nextPage = true;
                        return false;
                    }
                }
                await delayPromise(getRandomRounded(700, 1500));
            });
            if (nextPage) {
                return collectKosherWay();
            }
        };

        let collectOne = function ($wrapper) {
            let status = 'ACCEPTED';
            let sText = $wrapper.find('div.usck_crd_crdtxt').first().text();
            if (sText === 'Выигрыш') {
                status = 'WON';
            } else if (sText === 'Проигрыш') {
                status = 'LOSE';
            } else if (sText === 'Возврат') {
                status = 'REFUNDED';
            }
            let coef = $wrapper.find('div.usck_expcf').first().trt();
            if (coef === '') {
                coef = $wrapper.find('div.usck_cf').trt();
            }
            let id = $wrapper.find('div.usck_crdnom p:first').text().replace(/[^\d]/g, '').trim();
            if (data.length === 0 || data.indexOf(id) > -1) {
                collected.push({
                    external_id: id,
                    status: status,
                    match: $wrapper.find('span.usck_enm').first().trt(),
                    bkPivot: $wrapper.find('div.usck_onm').first().trt(),
                    bkTeam: $wrapper.find('div.usck_rslttp').first().trt(),
                    coef: coef,
                    stake: $wrapper.find('div.usck_valstk').first().trt().replace(/[^\d.]/g, '').trim(),
                    result: $wrapper.find('div.usck_crd_crdmon').first().trt().replace(/[^\d.]/g, '').trim()
                });
            }
        };

        $(window).scrollTop(0);
        (async () => {
            await waitDelayClickF('div.message--icon')();
            await waitDelayClickF('li:has(div:textEquals("Ставки"))')();
            await delayPromise(5000);
            await waitForElement('div.menu button:contains("Спорт")', 333, 12000, true)
                .catch(e => console.log(`Спорт does not exists :( ${e}`));
            await collectKosherWay();
        })()
            .then(() => report(true, ''))
            .catch((e) => report(false, 'Error collecting: ' + e));
    });

    const removeTeamPrefix = function (data) {
        const templateArray = ['До 19 (U19)', '(ж)'];
        const findIndex1 = templateArray.findIndex(el => data.team1.indexOf(el) > -1);
        const findIndex2 = templateArray.findIndex(el => data.team2.indexOf(el) > -1);
        data.team1 = findIndex1 > -1 ? data.team1.replace(templateArray[findIndex1], '').trim() : data.team1;
        data.team2 = findIndex1 > -1 ? data.team2.replace(templateArray[findIndex2], '').trim() : data.team2;
        return data;
    };

    /**
     * Proceeds bets and expresses
     * @param data {array}
     * @returns {Promise<any>}
     */
    const proceedBet = (data) => new Promise(function (onSuccess, onReject) {
        currentBetData = {
            data: data,
            max: 0,
            maxClickedTimes: 0,
            stakeReenteredTimes: 0
        };
        const betFinished = function (success, message) {
            //bsDebug(port, 'Bet finished ' + success, message);
            let status = 'ACCEPTED';
            if (!success) {
                status = 'FAILED';
                if (typeof message === 'string' && message.indexOf('LOW_COEF') > -1) {
                    status = 'LOW_COEF';
                } else if (typeof message === 'string' && message.indexOf('NO_FUNDS') > -1) {
                    status = 'NO_FUNDS';
                } else if (typeof message === 'string' && message.indexOf('SCORE_CHANGED') > -1) {
                    status = 'SCORE_CHANGED';
                }
            }
            const resultData = {
                "external_id": success ? message.external_id : '',
                "status": status,
                "market": currentBetData.data[0].market,
                "target": currentBetData.data[0].target,
                "pivot": currentBetData.data[0].pivot,
                "coef": success ? message.odd : currentBetData.data[0].coef,
                "stake": success ? String(message.stake) : currentBetData.data[0].stake,
                "maximum": currentBetData.max
            };
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
                fBetResult.bookmaker = 'FAVBET';
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
            if (success && currentBetData.data[0].collectAfterAll) {
                resultData['bkPivot'] = message.bkPivot;
            }
            port.postMessage({
                answered: !!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED'
                        ? "F_BET" : "BET",
                data: !!currentBetData.data[0].betFromParser ? fBetResult : resultData,
                answer: success ? `Everything is Okay! Max clicked: ${currentBetData.maxClickedTimes}` : message,
                doNotSend,
            });
            if (success) {
                bsDebug(port, `Result data (${success}): `, resultData);
                (async () => {
                    await eventsWorkAll('FavBet',
                        settings.eventMaxBets, settings.eventTimeLimit,
                        currentBetData.data, true, true);
                    await bMess('WasSuccessStake').set(Date.now());
                    await bMess('Stake Maximums').set(0);
                })()
                    .then(() => onSuccess());
            } else {
                onReject(message);
            }
        };

        const report = function (success, message, willPlace) {
            bsDebug(port, "Report (proceedBet) was fired with success: " + success + ', message: ' + message + ', willPlace: ' + willPlace,
                (new Error().stack), message);
            betFinished(success, message);
        };

        const performCollectNew = () => new Promise((onSuccess, onReject) => {
            mouseChain({
                target: $('div[class*="BetSlipTab_menuTab-"]:textEquals("My bets")')[0],
                events: ['click'],
                scroll: false
            })
                .then(waitForElementF('span:textEquals("View all bets")', 333, 5000, true))
                .then($el => mouseChain({target: $el[0], events: ['click']}))
                .then(waitForElementF('div[class^="BetsHistory_filterContainer-"]', 333, 10000, true))
                .then($el => mouseChain({
                    target: $el.find('div[class*="DataFilter_filterGroupInline-"]').eq(1).find('div[class*="SelectTrigger_root-"]')[0],
                    events: ['click']
                }))
                .then(delayFunction(1888))
                .then(() => mouseChain({
                    target: $('span[class^="SelectContent_title-"]:textEquals("Undefined")')[0],
                    events: ['click']
                }))
                .then(delayFunction(1888))
                .then(() => mouseChain({
                    target: $('button span[class*="Button_content-"]:textEquals("Apply")')[0],
                    events: ['click']
                }))
                .then(waitForElementF('div[class^="Bet_container-"]:first', 333, 25000, true))
                .then($el => {
                    const dataMatch = data[0].team1.toLowerCase() + ' - ' + data[0].team2.toLowerCase();
                    const localMatch = ($el.find('span[data-role="outcome-participants"]').trt()).toLowerCase();
                    const matchCompare = localMatch === dataMatch || locutus_similar_text(localMatch, dataMatch, true) > 90;
                    if (!matchCompare) {
                        throw 'match is not compared';
                    } else {
                        let result = {
                            stake: $el.find('span[data-role="bet-amount"]').trt().replace(/[^\d.]/g, '').trim(),
                            odd: $el.find('span[class^="BetItem_outcomeCoef-"]').trt(),
                            external_id: $el.find('span[data-role="bets-history-text-copy-id-text"]').trt().replace(/[^\d.]/g, '').trim(),
                        };
                        if (currentBetData.data[0].collectAfterAll) {
                            result.bkPivot = $el.find('div[data-role="outcome-market-name"]').trt();
                        }
                        onSuccess(result);
                    }
                })
                .then(delayFunction(2555))
                .then(() => data[0].type === 'LIVE' ? $('a[href="/en/live/all/"]') : $('a[href="/en/sports/sport/"]'))
                .then($el => mouseChain({target: $el[0], events: ['click']}))
                .then(delayFunction(getRandomRounded(1555, 2222)))
                .then(waitForElementF('button[data-role="betslip-button-done"]', 333, 15000, true))
                .then($el => mouseChain({target: $el[0], events: ['click']}))
                .catch(e => onReject('Bet placed, but collect error: ' + e));
        });

        const performCollect = willPlace => new Promise((onSuccess, onReject) => {
            const $coupon = $('div.bbet_okr.bb_cont');
            let $odds = $coupon.find('div.bbet_coef');
            let odd = '';
            if ($odds.length === 1) {
                odd = $odds.trt();
            } else {
                let temp = 1;
                $odds.each(function () {
                    let cur = parseFloat($(this).text().trim());
                    if (!isNaN(cur) && cur > 0) {
                        temp = temp * parseFloat($(this).text().trim());
                    } else {
                        bsError(port, 'We have strange odd! "' + $(this).trt() + '"');
                    }
                });
                odd = (Math.round(temp * 1000) / 1000).toString();
            }
            let result = {
                stake: willPlace,
                match: $coupon.find('span.event--name').trt(),
                market: $coupon.find('div.b_ev_nmtp span.b_ev_name').trt(),
                timePart: $coupon.find('div.b_ev_nmtp span.b_ev_type').trt(),
                target: $coupon.find('div.b_ev_nmtp span.outcmn').trt(),
                odd: odd,
                possibleEarnings: $coupon.find('span.bbet_inp_maxp').trt()
            };
            if (!currentBetData.data[0].collectAfterAll) {
                /* port = true;
                result = {};
                onSuccess = m => console.log('Success', m);
                onReject = e => console.log('Reject: ' + e);
                bsDebug = (port, m) => console.log(m);
                bsError = (port, m) => console.log(m); */
                mouseChain({target: $('div.message--icon')[0], events: ['click'], scroll: true})
                    .then(waitForElementF('li:has(div:textEquals("Ставки"))', 333, 5000, true))
                    .then($el => mouseChain({target: $el[0], events: ['click']}))
                    .then(waitForElementF('div.rt-tr-group:visible', 333, 30000, true))
                    .then($el => mouseChain({target: $el.find('div.rt-tr')[0], events: ['click']}))
                    .then(waitForElementF('div.cardshistory_wrapper', 333, 30000, true))
                    .then($el => onSuccess({
                        external_id: $el.find('div.usck_crdnom p:first').text().replace(/[^\d]/g, '').trim(),
                        odd: result.odd,
                        stake: result.stake
                    }))
                    .then(delayFunction(getRandomRounded(1000, 2000)))
                    .then(() => mouseChain({target: $('span.close_two_level_popup span')[0], events: ['click']}))
                    .then(delayFunction(getRandomRounded(1000, 2000)))
                    .then(() => mouseChain({target: $('span.icon_close_dial_PO span')[0], events: ['click']}))
                    .then(delayFunction(getRandomRounded(500, 1000)))
                    .then(() => mouseChain({target: $('button:contains("Продолжить")')[0], events: ['click']}))
                    .then(() => bsDebug(port, 'Everything must be ok! Continue clicked!'))
                    .catch(e => onReject('Bet placed, but collect error: ' + e));
            } else {
                mouseChain({target: $('button:contains("Продолжить")')[0], events: ['click']})
                    .then(() => bsDebug(port, 'Everything must be ok! Continue clicked!'))
                    .catch((e) => bsError(port, 'Error on $continue click: ' + e));
                report(true, {
                    external_id: 'MULTI',
                    odd: result.odd,
                    stake: result.stake,
                    bkPivot: result.target
                });
            }
        });

        const collectCouponDetails = async function (willPlace) {
            const $bets = bkHere === 'favbetold'
                ? $('div.bbet_okr.bb_cont')
                : $('div[class*="BetsList_wrapper"]');
            if ($bets.length > 0) {
                await delayPromise(777);
                const c = await (bkHere === 'favbetold' ? performCollect(willPlace) : performCollectNew())
                    .catch(e => report(false, 'Bet placed but there is no coupon ' + e));
                report(true, c, willPlace);

            } else {
                report(false, 'Bet placed but there is no coupon!');
            }
        };

        const checkSuccessNew = async willPlace => {
            await waitForElement('span[class*="Status_infoTitle-"] span:textEquals("has been accepted")',
                333, 40000, true, 1, 'wait success status');
            dLog('green', 'Favbet', 'BET DONE! Let\'s collect!');
            await delayPromise(777);
            await collectCouponDetails(willPlace);
        };

        const checkSuccess = willPlace => {
            const waitStatus = function () {
                if (acceptVisible(willPlace) || !checkErrors(willPlace)) {
                    return;
                }
                const $refresh = $('div.bbet_dwn span.refreshb:visible');
                if ($refresh.length === 1 && elementIsVisible($refresh[0]) && Date.now() - waitStarted > 7000
                    && (refreshClicked === 0 || Date.now() - refreshClicked > 5000)) {
                    mouseChain({target: $refresh[0], events: ['click'], error: '$refresh'})
                        .then(delayFunction(333))
                        .then(() => {
                            refreshClicked = Date.now();
                            bsDebug(port, 'Refresh clicked, continue waitStatus');
                            waitStatus();
                        })
                        .catch(e => {
                            bsError(port, 'Error on click $refresh: ' + e);
                            setTimeout(waitStatus, 333);
                        });
                } else if ($('div.msg-div').trt() === 'Ставка сделана') {
                    bsDebug(port, 'BET DONE! Let\'s collect!');
                    delayPromise(777)
                        .then(() => collectCouponDetails(willPlace));
                } else if ($('#inputC').length > 0 && elementIsVisible($('#inputC')[0]) && $('#inputC').val() === '') {
                    currentBetData.stakeReenteredTimes++;
                    if (currentBetData.stakeReenteredTimes >= 5) {
                        report(false, `We tried to bet ${currentBetData.stakeReenteredTimes} times with no success :( That's enough, I think...`);
                    } else {
                        bsDebug(port, `I think, we need to AfterEnterStake again (${currentBetData.stakeReenteredTimes})`);
                        delayPromise(6000)
                            .then(() => afterEnterStake(willPlace));
                    }
                } else if (Date.now() - waitStarted > 60000) {
                    report(false, 'Error we waited for ' + (Date.now() - waitStarted) + 'ms');
                } else {
                    setTimeout(waitStatus, 200);
                }
            };
            let refreshClicked = 0;
            const waitStarted = Date.now();
            waitStatus();
        };

        const checkErrorsNew = () => {
            const errors = [];
            const $coupons = $('li[class^="BetsList_item"]');
            const $errorMessage = $('div[class*="Status_betStatus-"]');
            const coefChanges = 'button span:textEquals("Accept changes in the odds"):visible';
            $coupons.each(function () {
                const $this = $(this);
                if ($this.find('div[class*="Message_error"]').length > 0) {
                    errors.push($this.find('div[class*="Message_error"]').find('span').text().trim());
                }

            });
            $errorMessage.each(function () {
                const $this = $(this);
                if ($this.find('span[class^="Status_infoTitle_"]').length) {
                    errors.push($this.find('span[class^="Status_infoTitle-"]').text().trim());
                }

            });
            if ($(coefChanges).length > 0) {
                errors.push($(coefChanges).trt());
            }
            return errors;
        };

        const checkErrors = (willPlace) => {
            const errors = [];
            $('ul.bbet_nfb li:visible').each((idx, val) => {
                const text = $(val).trt();
                if (text.indexOf('Недостаточно средств для ставки') === -1) {
                    errors.push(text);
                }
            });
            if (errors.length === 1 && errors[0].indexOf("Превышена максимальная ставка") > -1) {
                getMaxNewWay()
                    .then(max => willPlace = max)
                    .then(delayFunction(777))
                    .then(() => mouseChain({
                        target: $('button[name="bbet_pl"]')[0],
                        events: ['click'],
                        scroll: true
                    }))
                    .then(() => checkSuccess(willPlace))
                    .catch((e) => report(false, 'Error during place MAX bet ' + e));
            } else if (errors.length > 0) {
                report(false, 'We got errors 1: ' + errors.join(', '));
            }
            return errors.length === 0;
        };

        const acceptVisible = (willPlace) => {
            const $acceptBtn = bkHere === 'favbetold' ? $('button.bbet_acpt') : $('button:textEquals("Сделать ставку")');
            if ($acceptBtn.length === 1 && elementIsVisible($acceptBtn[0])) {
                checkCoefs(data)
                    .then(() => {
                        bsDebug(port, 'We plans to click Accept!');
                        mouseChain({target: $acceptBtn[0], events: ['click']})
                            .then(delayFunction(777))
                            .then(() => afterEnterStake(willPlace))
                            .catch((e) => report(false, 'Error on click $acceptBtn: ' + e));
                    })
                    .catch((e) => report(false, 'Coefs changed: ' + e));
                return true;
            } else {
                return false;
            }
        };

        let afterEnterStakeStarted = 0;
        const afterEnterStake = (willPlace) => new Promise((onSuccess, onReject) => {
            // Hint: CHECK entered!
            let entered = bkHere === 'favbetold' ? parseFloat($('#inputC').val()) : $('input[class*="BetSumInput_input-"]').val();
            bsDebug(port, 'After enter stake check: willPlace = ' + parseFloat(willPlace) + ', entered: ' + entered);

            entered = parseFloat(entered);
            if (isNaN(entered) || parseFloat(willPlace) !== entered || entered > parseFloat(data[0].stake)) {
                delayPromise(1111)
                    .then(() => performExactBet(entered > parseFloat(data[0].stake) ? data[0].stake : willPlace))
                    .then(() => bsError(port, 'Entered (' + entered + ') !== willPlace (' + willPlace + ') - try to reenter!'))
                    .then(() => onSuccess())
                    .catch(e => onReject(`afterEnterStakeStarted 1: ${e}`))
            } else {
                const placeBtn = bkHere === 'favbetold' ? 'button[name="bbet_pl"]' : 'button span:textEquals("Place bet")';

                if (bkHere === 'favbetold') {
                    //console.log(errors, errors.indexOf("Превышена максимальная ставка") > -1);
                    const av = acceptVisible(willPlace), ce = checkErrors(willPlace);
                    bsDebug(port, `AES: ${av} / ${ce}`);
                    if (av || !ce) {
                        onSuccess();
                    } else if ($(placeBtn).length === 0 || $(placeBtn).hasClass('but_dsbl')) {
                        onReject('No place button or button disabled!');
                    } else {
                        bsDebug(port, 'Place bet in afterEnterStake');
                        mouseChain({
                            target: $(placeBtn)[0], events: fullClick,
                            scroll: true, 'error': 'placeBtn123'
                        })
                            .then(() => checkSuccess(willPlace))
                            .then(() => onSuccess())
                            .catch(e => onReject(`afterEnterStakeStarted 2-1: ${e}`));
                    }
                } else {
                    const ce = checkErrorsNew(willPlace);
                    if (ce.length > 0) {
                        if (ce.indexOf('Превышена максимальная ставка') > -1) {
                            mouseChain({
                                target: $('button[data-role="betslip-max-bet-button"]:textEquals("Max")')[0],
                                events: fullClick, error: 'Max',
                            })
                                .then(delayFunction(1222))
                                .then(() => mouseChain({
                                    target: $(placeBtn)[0], events: fullClick,
                                    scroll: true, error: 'placeBtn999'
                                }))
                                .then(() => checkSuccessNew(willPlace))
                                .then(() => onSuccess())
                                .catch(e => onReject(`afterEnterStakeStarted 2-2: ${e}`));
                        } else if (ce.indexOf('Accept changes in the odds') > -1) {
                            const changeCoef = parseFloat($('span[data-role="betslip-outcome-coef"]').trt());
                            const dataCoef = parseFloat(data[0].coef);
                            if (changeCoef >= dataCoef) {
                                mouseChain({
                                    target: $('button span:textEquals("Accept changes in the odds"):visible')[0],
                                    events: fullClick
                                })
                                    .then(delayFunction(1222))
                                    .then(() => mouseChain({
                                        target: $(placeBtn)[0],
                                        events: fullClick,
                                        scroll: true
                                    }))
                                    .then(() => checkSuccessNew(willPlace))
                                    .then(() => onSuccess())
                                    .catch(e => onReject(`afterEnterStakeStarted 3: ${e}`));
                            } else {
                                onReject('we got errors: coef changes after submit');
                            }
                        } else {
                            onReject(`we got errors: ${ce.join(', ')}`)
                        }
                    } else if ($(placeBtn).is('[class*="button_disabled_"]')) {
                        onReject('No place button or button disabled!');
                    } else {
                        bsDebug(port, 'Place bet in afterEnterStake');
                        mouseChain({
                                target: $(placeBtn)[0],
                                events: fullClick, scroll: true,
                                'error': 'placeBtn 777'
                            }
                        )
                            .then(() => checkSuccessNew(willPlace))
                            .then(() => onSuccess())
                            .catch(e => onReject(`afterEnterStakeStarted 2-3: ${e}`));
                    }
                }
            }
        });

        const performExactBet = willPlaceInput => {
            let willPlace = willPlaceInput ? parseFloat(willPlaceInput) : parseFloat(data[0].stake);
            // Hint: Let's enter stake
            let $input = bkHere === 'favbetold' ? $('#inputC') : $('input[class*="BetSumInput_input-"]');
            if ($input.length !== 1) {
                console.log('$input ', $input);
                report(false, '2 Wrong number of bet\'s inputs: ' + $input.length);
                return;
            }
            willPlace = parseFloat(willPlace.toString().replace('.00', '').trim());
            if (willPlace > parseFloat(data[0].stake)) {
                willPlace = parseFloat(data[0].stake);
            }
            console.log('%cONE ' + willPlace + ' on place: ' + $input.val(), 'background: yellow; font-weight: bold;');
            clickSelectAllDeleteEnter($input[0], willPlace, true, false)
                .then(() => console.log('%cTWO ' + willPlace + ' on place: "' + $input.val() + '"',
                    'background: yellow; font-weight: bold;'))
                .then(() => {
                    if ($input.val() === '') {
                        return clickSelectAllDeleteEnter($input[0], willPlace.toString(), true, false);
                    }
                })
                .then(delayFunction(555))
                .then(waitForConditionF(() => {
                    let virtually = parseFloat($input.val());
                    console.log('%cSTAKE entered ' + willPlace + ' on place: ' + virtually
                        , 'background: yellow; font-weight: bold;');
                    return !isNaN(virtually) && willPlace === virtually && virtually <= parseFloat(data[0].stake);
                }, 333, 5000, 'Wrong amount!'))
                .then(() => bkHere === 'favbetold' ? $('button[name="bbet_pl"]').emulateTab() : $('button:textEquals("Place bet")').emulateTab())
                .then(delayFunction(555))
                .then(() => afterEnterStakeStarted = Date.now())
                .then(() => afterEnterStake(willPlace))
                .catch((e) => report(false, 'Error during place bet GF ' + e));
        };

        const performBet = function () {
            let lData = data.slice();
            openCoupon(data)
                .catch((e) => report(false, "Error during openCoupon! " + e))
                .then(max => currentBetData.max = max)
                .then(() => checkCoefs(data))
                .then(() => {
                    let willPlace = parseFloat(data[0].stake);
                    if (willPlace > currentBetData.max) {
                        willPlace = currentBetData.max;
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
                        return delayPromise(2222)
                            .then(() => performExactBet(willPlace));
                    }
                })
                .catch((e) => report(false, "Error during openCoupon! " + e));
        };

        if (data.length === 0) {
            report(false, 'Empty data!');
        } else {
            (async () => {
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
                    const checkRes = await eventsWorkAll('FavBet',
                            settings.eventMaxBets, settings.eventTimeLimit,
                            currentBetData.data, false, true);
                    if (checkRes !== 'OK') {
                            dLog('red', 'FavBet', `We got errors: ${checkRes}`);
                            throw checkRes;
                    } else {
                        dLog('big-blue', 'FavBet',
                            `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                        for (const d of currentBetData.data) {
                            const eventName = `${d.team1} - ${d.team2}`;
                            dLog('blue', 'FavBet', `${settings.eventMaxBets} for ${eventName} not reached`);
                        }
                    }
                }
            })()
                .then(() => closePreviousCoupons(false, typeof data[0].doNotGoHome === 'undefined' || data[0].doNotGoHome === false))
                .then(p => bsDebug(port, p))
                .then(performBet)
                .catch((e) => report(false, 'Error till close coupons: ' + e));
        }
    });

    /**
     * Checks coefs into the coupon
     * @param data
     * @returns {Promise<string,string>}
     */
    const checkCoefs = function (data) {
        return new Promise(function (onSuccess, onReject) {
            /* TEST TOP START
            (function (data) {
                let onSuccess = function (m) {
                    console.log('Success: ' + m);
                };
                let onReject = function (m) {
                    console.log('Reject: ' + m);
                };
                TEST TOP FINISH */
            let $coupon = $('div.bbet_okr.bb_cont');
            data[0] = removeTeamPrefix(data[0]);
            let $coupons = bkHere === 'favbetold' ? $coupon.find('li.bbet_name') : $('li[class^="BetsList_item"]');
            const findInData = (match) => data.find(v => {
                const localMatch = v.team1.toLowerCase() + ' - ' + v.team2.toLowerCase();
                return localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 60;
            });
            let errors = [];
            let checked = 0;
            $coupons.each(function () {
                let $this = $(this);
                let match = bkHere === 'favbetold' ? $this.find('span.event--name').trt() : $this.find('span[class^="BetEventName_name-"]').trt();
                let $nfb = bkHere === 'favbetold' ? $this.find('ul.bbet_nfb') : $this.find('div[class*="Message_error"]');
                const suspendedMessage = bkHere === 'favbetold' ? $nfb.trt().indexOf('Event is suspended')
                    : $nfb.find('span').trt().indexOf('Betting on this outcome was suspended');
                if ($nfb.length > 0 && suspendedMessage > -1) {
                    errors.push(match + ' LOW_COEF - stake is blocked!');
                    return false;
                }
                let localCoef = bkHere === 'favbetold' ? parseFloat($this.find('div.bbet_coef').text().trim()) : parseFloat($this.find('span[class*="SingleBet_outcomeCoef"]').text().trim());
                let localData = findInData(match);

                if (!newAPI && localData && localData.coef !== '' && !isNaN(localCoef)) {
                    let checkCoef = parseFloat(localData.coef);
                    bsDebug(port, `-= checkCoefs =- ${match} = ${localCoef} / ${checkCoef}`);
                    console.log(`${match} = ${localCoef} / ${checkCoef}`);
                    if (!isNaN(checkCoef) && localCoef > checkCoef * 1.2) {
                        errors.push(match + ' coef TOO BIG ' + localCoef + ', need: ' + checkCoef);
                    } else if (isNaN(checkCoef) || checkCoef > localCoef) {
                        errors.push(match + ' LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef);
                    }
                    checked++;
                } else if (!localData || isNaN(localCoef)) {
                    errors.push(match + ' LOW_COEF - wrong match of localCoef!');
                    checked++;
                } else if (localData.coef === '' || newAPI) {
                    checked++;
                }
            });
            if (!newAPI && errors.length === 0 && checked === data.length) {
                onSuccess('Coefs fine!');
            } else if (newAPI && errors.length === 0 && checked === data.length) {
                const $couponType = bkHere === 'favbetold' ? $('ul.bet_block_menu li.active').trt() : $('div[class^="SystemTypes_changeTypeContainer"] span').eq(1).trt();

                let totalCoef = '';
                if (bkHere === 'favbetold') {
                    totalCoef = $couponType === "Single" ? $('div.bbet_coef').trt() : $('div#_selectorBTypec').trt();
                } else {
                    totalCoef = $couponType === "Single" ? $('span[class*="SingleBet_outcomeCoef"]').trt() : $('span[class*="TotalOdds_value-"]').trt();
                }

                const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
                if (totalCoef >= nCheck * 1.2) {
                    onReject('Coef TOO BIG: ' + totalCoef + ' instead of ' + data[0].coef);
                } else if (totalCoef < nCheck) {
                    onReject('LOW_COEF ' + data[0].coef + ' > ' + totalCoef);
                } else {
                    onSuccess('Coefs fine!');
                }
            } else {
                onReject(errors.join('; ') + (checked !== data.length ? ' some stakes not checked (' + checked + '/' + data.length + ')!' : ''));
            }
            /* TEST BOTTOM START
        })([
            {team1: 'Шан Юнайтед', team2: 'Бинь Дуонг', coef: '1.1'},
            {team1: 'Маршиангди', team2: 'Абахани Лимитед', coef: '1.2'}
        ]);
        //TEST BOTTOM FINISH */
        });
    };

    /**
     * Open event table, if we're on it already -  onSuccess
     * @param {object} data
     * @returns {Promise<any>}
     */
    const openEvent = function (data) {
        return new Promise(function (onSuccess, onReject) {
            let sportAccordance = {
                'FOOTBALL': 'Футбол',
                'TENNIS': 'Теннис',
                'HOCKEY': 'Хоккей',
                'VOLLEYBALL': 'Волейбол',
                'BASEBALL': 'Бейсбол',
                'BASKETBALL': 'Баскетбол',
                'HANDBALL': 'Гандбол',
                'TABLETENNIS': 'Настольный теннис',
                'CYBERSPORT': 'Киберспорт',
            };
            let team1 = data.team1.toLowerCase();
            let team2 = data.team2.toLowerCase();
            let sport = typeof sportAccordance[data.sport] !== 'string' ? '' : sportAccordance[data.sport];

            if (team1.indexOf('(угловые)') > -1 && team2.indexOf('(угловые)') > -1) {
                sport = 'Футбол. Статистика';
            }
            if (sport === '') {
                onReject(data.sport + ' not supported!');
            }
            bsDebug(port, 'openEvent for "' + sport + '"', data);
            const checkScore = function () {
                return new Promise(function (onSuccess, onReject) {
                    if (data.type === 'PREMATCH' || data.sport !== 'FOOTBALL') onSuccess('We wont check score here!');
                    let waitForScoreStarted = Date.now();
                    let waitForScore = function () {
                        if (data.score !== '' && ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) === -1) {
                            let $score = $(`div[class*="ScoreTable_scoreTable"] span[class*="Column_scoreCell-"]:visible`);
                            let score = $score.length > 0 ? $score.eq(0).trt() + ':' + $score.eq(1).trt() : 'WRONG SCORE';

                            if (score === data.score) {
                                onSuccess(score);
                            } else {
                                onReject(score + ' ' + (Date.now() - waitForScoreStarted));
                            }
                        } else {
                            onSuccess('We wont check score here!');
                        }
                    };
                    waitForScore();
                });
            };
            const result = function (status, message) {
                if (status) {
                    waitForCondition(() => {
                        return data.type === 'PREMATCH' ? true : checkWeAreThere();
                    }, 333, 30000, 'We are not in event for 30s!')
                        .then(() => onSuccess(message))
                        .catch((e) => onReject(e))
                } else {
                    onReject(message);
                }
            };
            const checkWeAreThere = function () {
                if (data.type === 'PREMATCH') {
                    return false;
                }
                let teams = bkHere === 'favbetold'
                    ? $('div.sticky-inner-wrapper div.event--name.two--name span')
                    : (data.sport === 'CYBERSPORT')
                        ? $('div[class*="PreMatch_participantContainer_"] span[class*="PreMatch_pName_"]')
                        : $('div[class*="EventParticipants_container-"] span[class*="EventParticipants_participantName-"]');
                let cTeam1 = '', cTeam2 = '';
                if (teams.length === 2) {
                    cTeam1 = teams.eq(0).trt().toLowerCase();
                    cTeam2 = teams.eq(1).trt().toLowerCase();
                }
                return cTeam1 === team1 && cTeam2 === team2 || locutus_similar_text(cTeam1 + ' - ' + cTeam2, team1 + ' - ' + team2, true) > 70;
            };
            const getSportElement = function () {
                let $sEl = $('div.sport--head:has(span:contains("' + sport + '"))')
                    .filter(function () {
                        let $this = $(this).find('span');
                        return $this.text().replace($this.find('u').text(), '').trim() === sport;
                    });
                return $sEl.length === 1 ? $sEl.parent() : $([]);
            };
            const getSportElementPrematch = function () {
                return $('div.event--name.long--name');
            };
            let previousCount = 0;
            const findEvent = function () {
                return new Promise((onSuccess, onReject) => {
                    let findEventStarted = Date.now();

                    const performFind = function () {
                        let waitMoreTime = function () {
                            if (Date.now() - findEventStarted < 20000) {
                                delayPromise(333).then(performFind);
                            } else {
                                onReject('We waited for event ' + (Date.now() - findEventStarted) + 'ms, and nothing was found...');
                            }
                        };
                        let $allEvents = data.type === 'LIVE' ? getSportElement().find('div.event--name.two--name') : getSportElementPrematch();
                        if ($allEvents.length > 0) {
                            const $liveEvent = $allEvents.filter(function () {
                                let $cTeams = $(this).find('span');
                                return ($cTeams.length === 2 &&
                                    (($cTeams.eq(0).trt().toLowerCase() === team1 && $cTeams.eq(1).trt().toLowerCase() === team2)
                                        ||
                                        (locutus_similar_text($cTeams.eq(0).trt().toLowerCase() + ' - ' + $cTeams.eq(1).trt().toLowerCase(),
                                            team1 + ' - ' + team2, true) > 60))
                                );
                            });
                            const $prematchEvent = $allEvents.filter(function () {
                                let $cTeams = $(this).find('span');
                                return (locutus_similar_text($cTeams.eq(0).trt().toLowerCase(), team1 + ' - ' + team2, true) > 80)
                            });
                            const $ourEvent = data.type === 'LIVE' ? $liveEvent : $prematchEvent;
                            if ($ourEvent.length === 1) {
                                mouseChain({
                                    target: $ourEvent[0],
                                    events: ['click'],
                                    scroll: true,
                                    scrollTop: true
                                })
                                    .then(() => bsDebug(port, 'Clicked on event!'))
                                    .then(delayFunction(1000))
                                    .then(onSuccess)
                                    .catch((e) => onReject('Error till click event $link: ' + e));
                            } else if (previousCount !== 1 && $allEvents.length !== 1) {
                                $allEvents.last()[0].scrollIntoView(true);
                                previousCount = $allEvents.length;
                                waitMoreTime();
                            } else {
                                onReject('Event not found from ' + $allEvents.length + ' events (' + $ourEvent.length + ')');
                            }
                        } else {
                            waitMoreTime();
                        }
                    };
                    const performFindNew = function () {
                        const listEvents = data.sport === 'CYBERSPORT' ? 'div[class*="CyberSportLiveCategoryEvents_wrapper"]'
                            : 'div[class^="LiveEvents_lineWrapper"]';
                        waitForElement(listEvents, 333, 10000)
                            .then(($list) => {
                                if (data.sport === 'CYBERSPORT') {
                                    $list = $list.parent();
                                }
                                return $list.find('div[class*="EventParticipants_event"]').filter(function () {
                                    let $cTeams = $(this).find('span[class*="Participant_participantName-"]');
                                    return ($cTeams.length === 2 &&
                                        (($cTeams.eq(0).trt().toLowerCase() === team1 && $cTeams.eq(1).trt().toLowerCase() === team2)
                                            ||
                                            (locutus_similar_text($cTeams.eq(0).trt().toLowerCase() + ' - ' + $cTeams.eq(1).trt().toLowerCase(),
                                                team1 + ' - ' + team2, true) > 80))
                                    );
                                });
                            })
                            .then($event => {
                                if ($event.length > 0) {
                                    mouseChain({target: $event[0], events: ['click'], scroll: true})
                                        .then(delayFunction(1777))
                                        .then(onSuccess)
                                        .catch((e) => onReject(e));
                                } else {
                                    throw 'event is not found'
                                }
                            })
                            .catch((e) => onReject(e));
                    }
                    const performFindNewPrematch = function () {
                        waitForElement('div[class*="BasePreMatchEvents_filterDropdownWrapper"]', 333, 10000)
                            .then(($el) => {
                                //const $elGlobal = $el;
                                if (!$el.find('span[class*="Date_tabItem"]:textEquals("Все")').is('[class*="Filters_active"]')) {
                                    mouseChain({
                                        target: $el.find('span[class*="Date_tabItem"]:textEquals("Все")')[0],
                                        events: ['click'],
                                        scroll: false
                                    })
                                        .then(delayFunction(3333))
                                        .then(waitForElementF('div[class*="EventsContainer_eventsContainer"]:last', 333, 10000))
                                        .then(($list) => {
                                            return $list.find('div[class*="EventParticipants_event"]').filter(function () {
                                                let $cTeams = $(this).find('span');
                                                return ($cTeams.length === 2 &&
                                                    (($cTeams.eq(0).trt().toLowerCase() === team1 && $cTeams.eq(1).trt().toLowerCase() === team2)
                                                        ||
                                                        (locutus_similar_text($cTeams.eq(0).trt().toLowerCase() + ' - ' + $cTeams.eq(1).trt().toLowerCase(),
                                                            team1 + ' - ' + team2, true) > 80))
                                                );
                                            });
                                        })
                                        .then($event => {
                                            if ($event.length === 1) {
                                                mouseChain({target: $event[0], events: ['click'], scroll: true})
                                                    .then(delayFunction(1777))
                                                    .then(onSuccess)
                                                    .catch((e) => onReject(e));
                                            } else {
                                                if ($('span:textEquals("Показать еще")').length > 0) {
                                                    mouseChain({
                                                        target: $('span:textEquals("Показать еще")')[0],
                                                        events: ['click'],
                                                        scroll: true
                                                    })
                                                        .then(delayFunction(1777))
                                                        .then(performFindNewPrematch)
                                                        .catch((e) => onReject(e));
                                                } else {
                                                    throw 'event is not found!';
                                                }
                                            }
                                        })
                                        .catch((e) => onReject(e));
                                } else {
                                    delayPromise(5555)
                                        .then(waitForElementF('div[class*="EventsContainer_eventsContainer"]:last', 333, 10000))
                                        .then(($list) => {
                                            return $list.find('div[class*="EventParticipants_event"]').filter(function () {
                                                let $cTeams = $(this).find('span');
                                                return ($cTeams.length === 2 &&
                                                    (($cTeams.eq(0).trt().toLowerCase() === team1 && $cTeams.eq(1).trt().toLowerCase() === team2)
                                                        ||
                                                        (locutus_similar_text($cTeams.eq(0).trt().toLowerCase() + ' - ' + $cTeams.eq(1).trt().toLowerCase(),
                                                            team1 + ' - ' + team2, true) > 80))
                                                );
                                            });
                                        })
                                        .then($event => {
                                            if ($event.length === 1) {
                                                mouseChain({target: $event[0], events: ['click'], scroll: true})
                                                    .then(delayFunction(1777))
                                                    .then(onSuccess)
                                                    .catch((e) => onReject(e));
                                            } else {
                                                if ($('span:textEquals("Показать еще")').length > 0) {
                                                    mouseChain({
                                                        target: $('span:textEquals("Показать еще")')[0],
                                                        events: ['click'],
                                                        scroll: true
                                                    })
                                                        .then(delayFunction(1777))
                                                        .then(performFindNewPrematch)
                                                        .catch((e) => onReject(e));
                                                } else {
                                                    throw 'event is not found!';
                                                }
                                            }
                                        })
                                        .catch((e) => onReject(e));
                                }
                            })
                            .catch((e) => onReject(e))
                    }
                    if (bkHere === 'favbetold') {
                        performFind();
                    } else {
                        if (data.type === 'LIVE') {
                            performFindNew();
                        } else {
                            performFindNewPrematch();
                        }

                    }
                });
            };
            const switchToSport = function () {
                return new Promise((onSuccess, onReject) => {
                    //bsDebug(port, 'switchToSport');
                    let switchToSportStarted = Date.now();
                    let switchProcess = function () {
                        let $sportHead = getSportElement();
                        console.log($sportHead);
                        let goToFindEvent = function () {
                            $sportHead.find('div.sport--head').get(0).scrollIntoView();
                            bsDebug(port, 'Switched to sport!');
                            delayPromise(500).then(onSuccess);
                        };
                        if ($sportHead.length === 1) {
                            if ($sportHead.find('div.sport--head').hasClass('folding--open')) {
                                delayPromise(1000).then(goToFindEvent);
                            } else {
                                mouseChain({target: $sportHead.find('div.sport--head').get(0), events: ['click']})
                                    .then(delayFunction(1000))
                                    .then(goToFindEvent)
                                    .catch((e) => onReject('Error till sportHead click: ' + e));
                            }
                        } else if ($sportHead.length === 0 && Date.now() - switchToSportStarted < 10000) {
                            delayPromise(777).then(switchProcess);
                        } else {
                            onReject('Sport tab (' + sport + ') not found for ' + (Date.now() - switchToSportStarted) + 'ms')
                        }
                    };
                    switchProcess();
                });
            };
            const switchToPrematchSport = function () {
                return new Promise((onSuccess, onReject) => {
                    const leagueArr = data.league.split('.');
                    if (leagueArr.length < 2) onReject('League name format is not correct!')
                    const league = leagueArr[0].trim();
                    const leagueName = leagueArr[1].trim();
                    const $sportTab = $('div.menu_sport ul.sportslist li span.ttt').filter(function () {
                        if ($(this).trt() === sport) return $(this);
                    });
                    const findLeague = (list) => {
                        const $leagueEl = list.find('li.cntr span.ttt').filter(function () {
                            if ($(this).trt() === league) return $(this);
                        });
                        const findLeagueName = (list) => {
                            const $leagueNameEl = list.find('li.trnm span.ttt').filter(function () {
                                if ($(this).trt() === leagueName) return $(this);
                            });
                            if ($leagueNameEl.length > 0) {
                                const $selectLeague = $leagueNameEl.parent().find('span.fav-icon');
                                mouseChain({target: $selectLeague[0], events: ['click']})
                                    .then(delayFunction(1555))
                                    .catch((e) => onReject('Error till $selectLeague click: ' + e));
                            } else {
                                onReject('Not found leagueName tab: ' + leagueName);
                            }
                        }
                        if ($leagueEl.length > 0) {
                            let checkExpand = $leagueEl.parent().next();
                            if (checkExpand.length === 0) {
                                mouseChain({target: $leagueEl[0], events: ['click'], scroll: true})
                                    .then(delayFunction(1555))
                                    .then(() => findLeagueName($leagueEl.parent().next()))
                                    .catch((e) => onReject('Error till $leagueEl click: ' + e));
                            } else {
                                delayPromise(333)
                                    .then(() => findLeague(checkExpand))
                                    .catch((e) => onReject('Error till leagueTab click: ' + e));
                            }
                        } else {
                            onReject('Not found league tab: ' + league);
                        }
                    }
                    if ($sportTab.length > 0) {
                        const checkExpand = $sportTab.parent().next();
                        if (checkExpand.length === 0) {
                            mouseChain({target: $sportTab[0], events: ['click'], scroll: true})
                                .then(delayFunction(1555))
                                .then(() => findLeague($sportTab.parent().next()))
                                .then(onSuccess)
                                .catch((e) => onReject('Error till sportTab click: ' + e));
                        } else {
                            delayPromise(333)
                                .then(() => findLeague($sportTab.parent().next()))
                                .then(onSuccess)
                                .catch((e) => onReject('Error till sportTab click: ' + e));
                        }
                    } else {
                        onReject('Not found sport tab: ' + sport);
                    }
                });
            };
            const selectSport = function () {
                const sportAccordanceLinks = {
                    'FOOTBALL': 'soccer',
                    'TENNIS': 'tennis',
                    'HOCKEY': 'ice-hockey2',
                    'VOLLEYBALL': 'volleyball',
                    'BASEBALL': 'baseball',
                    'BASKETBALL': 'basketball',
                    'HANDBALL': 'handball',
                    'TABLETENNIS': 'table-tennis',
                };
                const sport = typeof sportAccordanceLinks[data.sport] !== 'string' ? '' : sportAccordanceLinks[data.sport];
                return new Promise((onSuccess, onReject) => {
                    let $sportLink = data.type === 'LIVE' ? `a[href="/en/live/${sport}/"]` : `a[href="/en/sports/sport/${sport}/"]`;
                    if (data.sport === 'CYBERSPORT') {
                        $sportLink = 'a[href="/en/e-sports/all/"]';
                    }
                    waitForElement($sportLink, 333, 10000)
                        .then($el => {
                            if (!$el.is('[class*="SportItem_active"]')) {
                                delayPromise(333)
                                    .then(() => mouseChain({target: $el[0], events: ['click']}))
                                    .then(delayFunction(1222))
                                    .then(() => onSuccess('sport link clicked'))
                                    .catch((e) => onReject('select sport ' + e));
                            } else {
                                onSuccess('');
                            }
                        })
                        .catch((e) => onReject(e));
                });
            };
            const switchType = function () {
                return new Promise((onSuccess, onReject) => {
                    if (data.type === 'LIVE') {
                        const $liveLink = bkHere === 'favbetold' ? $('a[href="/ru/live/"].service_id_1').hasClass('active')
                            : $('a[href="/en/live/all/"]').is('[class*="Item_active"]');
                        if (!$liveLink) {
                            delayPromise(333)
                                .then(goToHome)
                                .then(delayFunction(1555))
                                .then(() => bkHere === 'favbetold' ? switchToSport() : selectSport())
                                .then(onSuccess)
                                .catch((e) => onReject(e));
                        } else {
                            delayPromise(333)
                                .then(() => bkHere === 'favbetold' ? switchToSport() : selectSport())
                                .then(onSuccess)
                                .catch((e) => onReject(e));
                        }
                    } else {
                        const $prematchLink = bkHere === 'favbetold' ? $('a[href="/ru/bets/"].service_id_1').hasClass('active')
                            : $('a[href="/ru/sports/sport/"]').is('[class*="Item_active"]');
                        if (!$prematchLink) {
                            delayPromise(333)
                                .then(goToPrematch)
                                .then(waitForElementF(bkHere === 'favbetold' ? 'div.menu_sport' : 'div[class*="List_preMatchList"]', 333, 10000))
                                .then(delayFunction(1555))
                                .then(() => bkHere === 'favbetold' ? switchToPrematchSport() : selectSport())
                                .then(onSuccess)
                                .catch((e) => onReject(e));
                        } else {
                            delayPromise(333)
                                .then(() => bkHere === 'favbetold' ? switchToPrematchSport() : selectSport())
                                .then(onSuccess)
                                .catch((e) => onReject(e));
                        }
                    }
                });
            };

            // Check we're on event page already
            // Warning: Here could be digged dog!
            const eventURL = bkHere === 'favbetold' ? 'event=' : 'event/';
            if (window.location.href.indexOf(eventURL) > -1) {
                if (checkWeAreThere()) {
                    result(true, 'we are on event already!');
                } else {
                    const $closeEvent = bkHere === 'favbetold' ? $('div.sticky-inner-wrapper div.close--button') : $('div[class*="BackHeader_back_"]');
                    if ($closeEvent.length === 1) {
                        mouseChain({target: $closeEvent[0], events: ['click'], scroll: true})
                            .catch((e) => onReject('Error till click close event: ' + e))
                            .then(delayFunction(3333))
                            .then(switchType)
                            .then(delayFunction(555))
                            .then(findEvent)
                            .then(() => result(true, 'we must be in event!'))
                            .catch((e) => result(false, 'Event not found: ' + e));
                    } else {
                        goToHome()
                            .catch((e) => result(false, e));
                    }
                }
            } else {
                delayPromise(333)
                    .then(switchType)
                    .then(delayFunction(1555))
                    .then(findEvent)
                    .then(() => result(true, 'we must be in event!'))
                    .catch((e) => result(false, 'Open event RT: ' + e));
            }
        });
    };

    /**
     * Click live link
     * @returns {Promise<any>}
     */
    const goToHome = function () {
        return new Promise(function (onSuccess, onReject) {
            const $liveLink = bkHere === 'favbetold' ? $('a.service_id_1[href="/ru/live/"]') : $('a[href="/en/live/all/"]');
            mouseChain({target: $('span.icon_close_dial_PO:visible span')[0], events: ['click']})
                .then(m => m, e => e)
                .then(delayFunction(777))
                .then(() => mouseChain({
                    target: $liveLink[0],
                    events: ['click'],
                    scroll: true
                }))
                .then(() => onSuccess('$live clicked!'))
                .catch((e) => onReject('Error till click $live: ' + e));
        });
    };

    /**
     * Click sports link
     * @returns {Promise<any>}
     */
    const goToPrematch = function () {
        return new Promise(function (onSuccess, onReject) {
            const $prematchLink = bkHere === 'favbetold' ? $('a.service_id_1[href="/ru/bets/"]') : $('a[class^="Item_link_"][href="/ru/sports/sport/"]');
            mouseChain({target: $prematchLink[0], events: ['click']})
                .then(delayFunction(3333))
                .then(() => onSuccess('$prematch clicked!'))
                .catch((e) => onReject('Error till click prematch: ' + e));
        });
    };

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<jQuery,string>} jQuery element for bet
     */
    const getBetElement = data => new Promise(function (onSuccess, onReject) {
        let markets = {
            'ONE_TWO': {
                'ONE': {root: ['1 X 2'], subroots: ['Full Time'], pivotKey: '#TEAM1#'},
                'TWO': {root: ['1 X 2'], subroots: ['Full Time'], pivotKey: '#TEAM2#'},
                'DRAW': {root: ['1 X 2'], subroots: ['Full Time'], pivotKey: 'Draw'},
                'ONE_DRAW': {root: ['Double chance'], subroots: ['Full Time'], pivotKey: '1x'},
                'TWO_DRAW': {root: ['Double chance'], subroots: ['Full Time'], pivotKey: 'x2'},
                'ONE_TWO': {root: ['Double chance'], subroots: ['Full Time'], pivotKey: '12'}
            },
            'TOTAL': {
                'OVER': {root: ['Over/Under'], subroots: ['Full Time'], pivotKey: 'Over (#PIVOTR#)'},
                'UNDER': {root: ['Over/Under'], subroots: ['Full Time'], pivotKey: 'Under (#PIVOTR#)'},
            },
            'T1_TOTAL': {
                'OVER': {
                    root: ['Team total #TEAM1#'],
                    subroots: ['Full Time'],
                    pivotKey: 'Over (#PIVOTR#)'
                },
                'UNDER': {
                    root: ['Team total #TEAM1#'],
                    subroots: ['Full Time'],
                    pivotKey: 'Under (#PIVOTR#)'
                }
            },
            'T2_TOTAL': {
                'OVER': {
                    root: ['Team total #TEAM2#'],
                    subroots: ['Full Time'],
                    pivotKey: 'Over (#PIVOTR#)'
                },
                'UNDER': {
                    root: ['Team total #TEAM2#'],
                    subroots: ['Full Time'],
                    pivotKey: 'Under (#PIVOTR#)'
                }
            },
            'HDP': {
                'HOME': {root: ['Handicap', 'Asian Handicap'], subroots: ['Full Time'], pivotKey: '#TEAM1# (#PIVOTR#)'},
                'AWAY': {root: ['Handicap', 'Asian Handicap'], subroots: ['Full Time'], pivotKey: '#TEAM2# (#PIVOTR#)'}
            },

            'CORNER_TOTAL': {
                'OVER': {
                    root: ['тотал угловых'], subroots: ['Full Time'], pivotKey: 'больше (#PIVOTR#)'
                },
                'UNDER': {
                    root: ['тотал угловых'], subroots: ['Full Time'], pivotKey: 'меньше (#PIVOTR#)'
                }
            },
            'CORNER_HDP': {
                'HOME': {root: ['фора по угловым'], subroots: ['Full Time'], pivotKey: '#TEAM1# (#PIVOTR#)'},
                'AWAY': {root: ['фора по угловым'], subroots: ['Full Time'], pivotKey: '#TEAM2# (#PIVOTR#)'}
            },

            half: {
                'ONE_TWO': {
                    'ONE': {root: ['1 X 2'], subroots: ['1st Half'], pivotKey: '#TEAM1#'},
                    'TWO': {root: ['1 X 2'], subroots: ['1st Half'], pivotKey: '#TEAM2#'},
                    'DRAW': {root: ['1 X 2'], subroots: ['1st Half'], pivotKey: 'Draw'},
                    'ONE_DRAW': {root: ['Double chance'], subroots: ['1st Half'], pivotKey: '1x'},
                    'TWO_DRAW': {root: ['Double chance'], subroots: ['1st Half'], pivotKey: 'x2'},
                    'ONE_TWO': {root: ['Double chance'], subroots: ['1st Half'], pivotKey: '12'}
                },
                'TOTAL': {
                    'OVER': {root: ['Over/Under'], subroots: ['1st Half'], pivotKey: 'Over (#PIVOTR#)'},
                    'UNDER': {root: ['Over/Under'], subroots: ['1st Half'], pivotKey: 'Under (#PIVOTR#)'},
                },
                'T1_TOTAL': {
                    'OVER': {
                        root: ['Team total #TEAM1#'],
                        subroots: ['1st Half'],
                        pivotKey: 'Over (#PIVOTR#)'
                    },
                    'UNDER': {
                        root: ['Team total #TEAM1#'],
                        subroots: ['1st Half'],
                        pivotKey: 'Under (#PIVOTR#)'
                    }
                },
                'T2_TOTAL': {
                    'OVER': {
                        root: ['Team total #TEAM2#'],
                        subroots: ['1st Half'],
                        pivotKey: 'Over (#PIVOTR#)'
                    },
                    'UNDER': {
                        root: ['Team total #TEAM2#'],
                        subroots: ['1st Half'],
                        pivotKey: 'Under (#PIVOTR#)'
                    }
                },
                'HDP': {
                    'HOME': {root: ['Handicap', 'Asian Handicap'], subroots: ['1st Half'], pivotKey: '#TEAM1# (#PIVOTR#)'},
                    'AWAY': {root: ['Handicap', 'Asian Handicap'], subroots: ['1st Half'], pivotKey: '#TEAM2# (#PIVOTR#)'}
                },
                'CORNER_TOTAL': {
                    'OVER': {
                        root: ['тотал'], subroots: ['1st Half'], pivotKey: 'больше (#PIVOTR#)'
                    },
                    'UNDER': {
                        root: ['тотал'], subroots: ['1st Half'], pivotKey: 'меньше (#PIVOTR#)'
                    }
                },
                'CORNER_HDP': {
                    'HOME': {root: ['фора'], subroots: ['1st Half'], pivotKey: '#TEAM1# (#PIVOTR#)'},
                    'AWAY': {root: ['фора'], subroots: ['1st Half'], pivotKey: '#TEAM2# (#PIVOTR#)'}
                },
            }
        };

        if (data.time_value === 'FULL_MATCH' || data.time_value === 'FULL_TIME') {
            delete markets.half;
        } else {
            markets = markets.half;
        }

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            onReject('Unsupported ' + data.time_value + '/' + data.market + '/' + data.target);
            return;
        }

        let modifyRoots = function () {
            if (data.sport === 'TABLETENNIS') {
                if (data.time_value === 'FULL_MATCH' || data.time_value === 'FULL_TIME') {
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Match winner');
                        markets['ONE_TWO']['TWO']['root'].push('Match winner');
                    }
                } else {
                    const set = data.time_value.replace(/[^\d]/g, '');
                    const idxes = ['st', 'nd', 'rd', 'th'];
                    const idx = idxes[set - 1];

                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Set Winner');
                        markets['ONE_TWO']['ONE']['subroots'].push(set + idx + ' Set');
                        markets['ONE_TWO']['TWO']['root'].push('Set Winner');
                        markets['ONE_TWO']['TWO']['subroots'].push(set + idx + ' Set');
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['root'].push('Handicap');
                        markets['HDP']['AWAY']['root'].push('Handicap');
                        markets['HDP']['HOME']['subroots'].push(set + idx + ' Set');
                        markets['HDP']['AWAY']['subroots'].push(set + idx + ' Set');
                    }
                    if (data.market === 'TOTAL') {
                        markets['HDP']['OVER']['root'].push('Over/Under');
                        markets['HDP']['UNDER']['root'].push('Over/Under');
                        markets['TOTAL']['OVER']['subroots'].push(set + idx + ' Set');
                        markets['TOTAL']['UNDER']['subroots'].push(set + idx + ' Set');
                    }

                }
            }
            if (data.sport === 'CYBERSPORT') {
                if (data.time_value === 'FULL_MATCH' || data.time_value === 'FULL_TIME') {
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Match winner');
                        markets['ONE_TWO']['TWO']['root'].push('Match winner');
                    }
                    if (data.market === 'TOTAL') {
                        markets['TOTAL']['OVER']['root'].push('Over/Under Maps');
                        markets['TOTAL']['UNDER']['root'].push('Over/Under Maps');
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['root'].push('Map Handicap');
                        markets['HDP']['AWAY']['root'].push('Map Handicap');
                    }
                } else {
                    const map = data.time_value.replace(/[^\d]/g, '');
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Winner');
                        markets['ONE_TWO']['TWO']['root'].push('Winner');
                        markets['ONE_TWO']['ONE']['subroots'].push('Map ' + map);
                        markets['ONE_TWO']['TWO']['subroots'].push('Map ' + map);
                    }
                    if (data.market === 'TOTAL') {
                        markets['TOTAL']['OVER']['root'].push('Total frags');
                        markets['TOTAL']['UNDER']['root'].push('Total frags');
                        markets['TOTAL']['OVER']['subroots'].push('Map ' + map);
                        markets['TOTAL']['UNDER']['subroots'].push('Map ' + map);
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['root'].push('Handicap frags');
                        markets['HDP']['AWAY']['root'].push('Handicap frags');
                        markets['HDP']['HOME']['subroots'].push('Map ' + map);
                        markets['HDP']['AWAY']['subroots'].push('Map ' + map);
                    }
                }
            }
            if (data.sport === 'TENNIS') {
                if (data.time_value === 'FULL_MATCH' || data.time_value === 'FULL_TIME') {
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Match winner');
                        markets['ONE_TWO']['TWO']['root'].push('Match winner');
                    }
                    if (data.market === 'TOTAL') {
                        markets['TOTAL']['OVER']['root'].push('Total Games');
                        markets['TOTAL']['UNDER']['root'].push('Total Games');
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['root'].push('Games Handicap');
                        markets['HDP']['AWAY']['root'].push('Games Handicap');
                    }
                    if (data.market === 'T1_TOTAL') {
                        markets['T1_TOTAL']['OVER']['root'].push('Player total games #TEAM1#');
                        markets['T1_TOTAL']['UNDER']['root'].push('Player total games #TEAM1#');
                    }
                    if (data.market === 'T2_TOTAL') {
                        markets['T2_TOTAL']['OVER']['root'].push('Player total games #TEAM2#');
                        markets['T2_TOTAL']['UNDER']['root'].push('Player total games #TEAM2#');
                    }
                } else {
                    if (data.market === 'ONE_TWO') {
                        if (data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') > -1) {
                            let parts = data.time_value.split('_GAME_');
                            let set = parts[0].replace(/[^\d]/g, '');
                            let game = parts[1];
                            const idxes = ['st', 'nd', 'rd', 'th'];
                            const idx = idxes[game - 1];
                            markets['ONE_TWO']['ONE']['root'].push('Who will win ' + game + idx + ' game?');
                            markets['ONE_TWO']['ONE']['subroots'].push(set + ' Set');
                            markets['ONE_TWO']['TWO']['root'].push('Who will win ' + game + idx + ' game?');
                            markets['ONE_TWO']['TWO']['subroots'].push(set + ' Set');
                        } else {
                            let set = data.time_value.replace(/[^\d]/g, '');
                            markets['ONE_TWO']['ONE']['root'].push('Set Winner');
                            markets['ONE_TWO']['ONE']['subroots'].push(set + ' Set');
                            markets['ONE_TWO']['TWO']['root'].push('Set Winner');
                            markets['ONE_TWO']['TWO']['subroots'].push(set + ' Set');
                        }
                    }
                    let set = data.time_value.replace(/[^\d]/g, '');
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['root'].push('Games Handicap');
                        markets['HDP']['HOME']['subroots'].push(set + ' Set');
                        markets['HDP']['AWAY']['root'].push('Games Handicap');
                        markets['HDP']['AWAY']['subroots'].push(set + ' Set');
                    }
                    if (data.market === 'TOTAL') {
                        markets['TOTAL']['OVER']['root'].push('Total Games');
                        markets['TOTAL']['OVER']['subroots'].push(set + ' Set');
                        markets['TOTAL']['UNDER']['root'].push('Total Games');
                        markets['TOTAL']['UNDER']['subroots'].push(set + ' Set');
                    }
                    if (data.market === 'T1_TOTAL') {
                        markets['T1_TOTAL']['OVER']['root'].push('Player total games #TEAM1#');
                        markets['T1_TOTAL']['UNDER']['root'].push('Player total games #TEAM1#');
                        markets['T1_TOTAL']['OVER']['subroots'].push(set + ' Set');
                        markets['T1_TOTAL']['UNDER']['subroots'].push(set + ' Set');
                    }
                    if (data.market === 'T2_TOTAL') {
                        markets['T2_TOTAL']['OVER']['root'].push('Player total games #TEAM2#');
                        markets['T2_TOTAL']['UNDER']['root'].push('Player total games #TEAM2#');
                        markets['T2_TOTAL']['OVER']['subroots'].push(set + ' Set');
                        markets['T2_TOTAL']['UNDER']['subroots'].push(set + ' Set');
                    }
                }
            }
            if (data.sport === 'BASKETBALL') {
                if (['FULL_TIME', 'FULL_MATCH'].indexOf(data.time_value) === -1) {
                    let quater = data.time_value.replace(/[^\d]/g, '');
                    const idxes = ['st', 'nd', 'rd', 'th'];
                    const idx = idxes[quater - 1];
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Match winner');
                        markets['ONE_TWO']['TWO']['root'].push('Match winner');
                        markets['ONE_TWO']['ONE']['subroots'].push(quater + idx + ' Quarter');
                        markets['ONE_TWO']['TWO']['subroots'].push(quater + idx + ' Quarter');
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['subroots'].push(quater + idx + ' Quarter');
                        markets['HDP']['AWAY']['subroots'].push(quater + idx + ' Quarter');
                    }
                    if (data.market === 'TOTAL') {
                        markets['TOTAL']['OVER']['subroots'].push(quater + idx + ' Quarter');
                        markets['TOTAL']['UNDER']['subroots'].push(quater + idx + ' Quarter');
                    }
                    if (data.market === 'T1_TOTAL') {
                        markets['T1_TOTAL']['OVER']['subroots'].push(quater + idx + ' Quarter');
                        markets['T1_TOTAL']['UNDER']['subroots'].push(quater + idx + ' Quarter');
                    }
                    if (data.market === 'T2_TOTAL') {
                        markets['T2_TOTAL']['OVER']['subroots'].push(quater + idx + ' Quarter');
                        markets['T2_TOTAL']['UNDER']['subroots'].push(quater + idx + ' Quarter');
                    }
                } else {
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Match winner');
                        markets['ONE_TWO']['TWO']['root'].push('Match winner');
                        markets['ONE_TWO']['ONE']['subroots'].push('Match (With ET)');
                        markets['ONE_TWO']['TWO']['subroots'].push('Match (With ET)');
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['subroots'].push('Match (With ET)');
                        markets['HDP']['AWAY']['subroots'].push('Match (With ET)');
                    }
                    if (data.market === 'TOTAL') {
                        markets['TOTAL']['OVER']['subroots'].push('Match (With ET)');
                        markets['TOTAL']['UNDER']['subroots'].push('Match (With ET)');
                    }
                    if (data.market === 'T1_TOTAL') {
                        markets['T1_TOTAL']['OVER']['subroots'].push('Match (With ET)');
                        markets['T1_TOTAL']['UNDER']['subroots'].push('Match (With ET)');
                    }
                    if (data.market === 'T2_TOTAL') {
                        markets['T2_TOTAL']['OVER']['subroots'].push('Match (With ET)');
                        markets['T2_TOTAL']['UNDER']['subroots'].push('Match (With ET)');
                    }
                }
            }
            if (data.sport === 'HOCKEY') {
                if (['FULL_TIME', 'FULL_MATCH'].indexOf(data.time_value) === -1) {
                    const period = data.time_value.replace(/[^\d]/g, '');
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['subroots'].push('Period ' + period);
                        markets['ONE_TWO']['TWO']['subroots'].push('Period ' + period);
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['subroots'].push('Period ' + period);
                        markets['HDP']['AWAY']['subroots'].push('Period ' + period);
                    }
                    if (data.market === 'TOTAL') {
                        markets['TOTAL']['OVER']['subroots'].push('Period ' + period);
                        markets['TOTAL']['UNDER']['subroots'].push('Period ' + period);
                    }
                    if (data.market === 'T1_TOTAL') {
                        markets['T1_TOTAL']['OVER']['subroots'].push('Period ' + period);
                        markets['T1_TOTAL']['UNDER']['subroots'].push('Period ' + period);
                    }
                    if (data.market === 'T2_TOTAL') {
                        markets['T2_TOTAL']['OVER']['subroots'].push('Period ' + period);
                        markets['T2_TOTAL']['UNDER']['subroots'].push('Period ' + period);
                    }
                }
            }
            if (data.sport === 'VOLLEYBALL') {
                if (data.time_value === 'FULL_MATCH' || data.time_value === 'FULL_TIME') {
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Match winner');
                        markets['ONE_TWO']['TWO']['root'].push('Match winner');
                    }
                } else {
                    const set = data.time_value.replace(/[^\d]/g, '');
                    const idxes = ['st', 'nd', 'rd', 'th'];
                    const idx = idxes[set - 1];
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Set Winner');
                        markets['ONE_TWO']['ONE']['subroots'].push(set + idx + ' Set');
                        markets['ONE_TWO']['TWO']['root'].push('Set Winner');
                        markets['ONE_TWO']['TWO']['subroots'].push(set + idx + ' Set');
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['subroots'].push(set + idx + ' Set');
                        markets['HDP']['AWAY']['subroots'].push(set + idx + ' Set');
                    }
                    if (data.market === 'TOTAL') {
                        markets['TOTAL']['OVER']['subroots'].push(set + idx + ' Set');
                        markets['TOTAL']['UNDER']['subroots'].push(set + idx + ' Set');
                    }
                }
            }
            if (data.sport === 'BASEBALL') {
                if (['FULL_TIME', 'FULL_MATCH'].indexOf(data.time_value) > -1) {
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Match winner');
                        markets['ONE_TWO']['TWO']['root'].push('Match winner');
                        markets['ONE_TWO']['ONE']['subroots'].push('Match (With ET)');
                        markets['ONE_TWO']['TWO']['subroots'].push('Match (With ET)');
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['subroots'].push('Match (With ET)');
                        markets['HDP']['AWAY']['subroots'].push('Match (With ET)');
                    }
                    if (data.market === 'TOTAL') {
                        markets['TOTAL']['OVER']['subroots'].push('Match (With ET)');
                        markets['TOTAL']['UNDER']['subroots'].push('Match (With ET)');
                    }
                    if (data.market === 'T1_TOTAL') {
                        markets['T1_TOTAL']['OVER']['subroots'].push('Match (With ET)');
                        markets['T1_TOTAL']['UNDER']['subroots'].push('Match (With ET)');
                    }
                    if (data.market === 'T2_TOTAL') {
                        markets['T2_TOTAL']['OVER']['subroots'].push('Match (With ET)');
                        markets['T2_TOTAL']['UNDER']['subroots'].push('Match (With ET)');
                    }
                } else {
                    const inning = data.time_value.replace(/[^\d]/g, '');
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['subroots'].push('Inning ' + inning);
                        markets['ONE_TWO']['TWO']['subroots'].push('Inning ' + inning);
                        markets['ONE_DRAW']['ONE']['subroots'].push('Inning ' + inning);
                        markets['TWO_DRAW']['TWO']['subroots'].push('Inning ' + inning);
                        markets['ONE_TWO']['ONE']['subroots'].push('Inning ' + inning);
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['subroots'].push('Inning ' + inning);
                        markets['HDP']['AWAY']['subroots'].push('Inning ' + inning);
                    }
                    if (data.market === 'TOTAL') {
                        markets['TOTAL']['OVER']['subroots'].push('Inning ' + inning);
                        markets['TOTAL']['UNDER']['subroots'].push('Inning ' + inning);
                    }
                    if (data.market === 'T1_TOTAL') {
                        markets['T1_TOTAL']['OVER']['subroots'].push('Inning ' + inning);
                        markets['T1_TOTAL']['UNDER']['subroots'].push('Inning ' + inning);
                    }
                    if (data.market === 'T2_TOTAL') {
                        markets['T2_TOTAL']['OVER']['subroots'].push('Inning ' + inning);
                        markets['T2_TOTAL']['UNDER']['subroots'].push('Inning ' + inning);
                    }
                }
            }
        }

        if (data.sport !== 'FOOTBALL') modifyRoots();

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
                    res = (fp > 0 ? '+' : '') + round(fp, 1).toFixed(1).toString();
                }
            }
            return res;
        };
        let replaceInner = function (element, parent, index) {
            if (typeof element === 'string') {
                parent[index] = element.replace('#TEAM1#', data.team1.toLowerCase()).replace('#TEAM2#', data.team2.toLowerCase())
                    .replace('#PIVOT#', data.pivot).replace('#PIVOTR#', specialPivotFormatter(data.market, data.pivot));
            } else if (typeof element === 'object') {
                for (let i in element) {
                    replaceInner(element[i], element, i);
                }
            } else {
                // console.log(typeof element + ' not supported! (' + element + ')');
            }
        };
        replaceInner(markets, null, null);

        const market = markets[data.market][data.target];
        market.subrootsLC = [];
        market.subroots.forEach(subroot => market.subrootsLC.push(subroot.toLowerCase()));
        market.rootLC = [];
        market.root.forEach(root => market.rootLC.push(root.toLowerCase()));
        bsDebug(port, 'Market: ', market);

        const performGet = () => {
            let $el = $([]);
            const $marketBlocks = bkHere === 'favbetold' ? $('li.markets--block') : $('div[class*="MarketsGroup_accordionContainer"]');
            $marketBlocks.eachAsync(async (idx, val) => {
                const $root = $(val);
                const $title = bkHere === 'favbetold' ? $root.find('div.markets--head') : $root.find('div[class*="Accordion_header-"]');
                if (market.rootLC.indexOf($title.trt().toLowerCase()) === -1) {
                    return true;
                }
                console.log('%c' + `Checking ${$title.trt().toLowerCase()}`,
                    'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                $title[0].scrollIntoView(true);

                if (bkHere === 'favbetold') {
                    if ($title.hasClass('folding--close')) {
                        await mouseChain({
                            target: $title[0],
                            events: fullClick,
                            error: `Expanding: ${$title.trt()}`
                        });
                        await delayPromise(1000);
                    }
                    $root.find('div.result--type--head').each(function () {
                        if (market.subrootsLC.indexOf($(this).find('span').trt().toLowerCase()) === -1) {
                            return true;
                        }
                        console.log('%c' + ` --- >>> checking ${$(this).find('span').trt().toLowerCase()}`,
                            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                        $(this).parent().find('li.outcome').each(function () {
                            if (market.pivotKey === $(this).find('span').trt().toLowerCase()) {
                                $el = $(this);
                            }
                            console.log('%c' + ` --- >>> --- >>> checking ${$(this).find('span').trt().toLowerCase()}`
                                + '%c' + `  ${market.pivotKey} ${($el.length === 0 ? '!==' : '===')} ${$(this).find('span').trt().toLowerCase()}`,
                                'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;',
                                $el.length === 0 ? 'font-style: italic;' : 'font-weight: bold;');
                            if ($el.length > 0) {
                                console.log($el);
                                return false;
                            }
                        });
                        if ($el.length > 0) {
                            return false;
                        }
                    });
                } else {
                    const $subHead = $root.find('div[class*="MarketsGroup_container"]').children()
                        .filter(function () {
                            if (market.subrootsLC.indexOf($(this).find('span:first')
                                .trt().toLowerCase()) > -1) {
                                return $(this);
                            }
                        });
                    if ($subHead.length > 0) {
                        $el = $subHead.children().find('span[class^="OutcomeButton_outcomeName-"]').filter(function () {
                            if (market.pivotKey.toLowerCase() === $(this).trt().toLowerCase()) {
                                return $(this);
                            }
                        });
                    }
                }

                if ($el.length > 0) {
                    return false;
                }
            })
                .then(() => {
                    if ($el.length > 0) {
                        onSuccess($el);
                    } else {
                        onReject(`Bet ${data.market}/${data.target}/${data.pivot} not found :(`);
                    }
                })
                .catch(e => onReject(`getPerform: ${e}`));
        };

        performGet();
    });

    const getMaxNewWay = () => new Promise(function (onSuccess, onReject) {
        console.log('%cGET MAX HERE!!!', 'background: red; color: white;');
        if (typeof data !== 'undefined' && typeof data.doNotOpen !== 'undefined' && data.doNotOpen === true) {
            onSuccess(100500);
            return;
        }
        delayPromise(1000)
            .then(waitForElementF('div.bbet_okr.bb_cont div.bbet_dwn span.mx-bet-ico', 333, 10000))
            .then($el => delayPromise(300, $el))
            .then($el => mouseChain({target: $el[0], events: ['click']}))
            .then(() => console.log('%c!!!MAX CLICKED!!!', 'background: purple; color: yellow;'))
            //.then(() => currentBetData.maxClickedTimes++)
            .then(delayFunction(333))
            .then(waitForConditionF(() => {
                const max = parseFloat($('#inputC').val());
                return !isNaN(max) && max > 0;
            }, 333, 10000, 'Max is NaN or 0'))
            .then(() => onSuccess(parseFloat($('#inputC').val())))
            .catch(e => onReject(`Can't get max: ${e}`));
    });

    /**
     * Opens coupon with stake (stakes)
     * @param {object[]} paramData - array of bets to open
     * @returns {Promise<float, string>}
     */
    const openCoupon = function (paramData) {
        bsDebug(port, 'openCoupon, paramData:', paramData);
        return new Promise(function (onSuccess, onReject) {
            let result = function (success, message) {
                if (success) {
                    if (lData.length > 0) {
                        ourCommand.add('express', ourCommand.getAdded('express') + 1);
                        bsDebug(port, 'EXPRESS must be added!');
                        data = paramData[ourCommand.getAdded('express')];
                        bsDebug(port, 'openCoupon - We got data: ' + (typeof data), data);
                        if (typeof data !== 'undefined') {
                            openElement();
                        } else {
                            onSuccess(111555777);
                        }
                    } else {
                        onSuccess(111555777);
                    }
                } else {
                    bsError(port, message);
                    onReject(message);
                }
            };
            let lData = paramData.slice();
            let data = {};
            let openElement = function () {
                openEvent(data)
                    .then(async () => {
                        await delayPromise(2000);
                        const $element = await getBetElement(data);
                        dLog('', 'fb', ['Found element: ', $element]);
                        let elCoef = bkHere === 'favbetold' ? $element.find('button').trt()
                            : $element.parent().parent().find('span[class^="OutcomeButton_coef"]').trt();
                        dLog('green', 'fb', 'We got element! Coef: ' + elCoef);
                        $element[0].scrollIntoView();
                        window.scrollBy(0, -110);
                        let elementWasClicked = 0;
                        const clickedBet = bkHere => bkHere === 'favbetold'
                            ? $element.find('label').hasClass('outcome--in--basket')
                            : $element.parent().parent().attr('class').indexOf('OutcomeButton_active-') > -1;
                        do {
                            await delayPromise(1000);
                            const $target = bkHere === 'favbetold' ? $element.find('label') : $element;
                            if ((elementWasClicked === 0 || Date.now() - elementWasClicked > 3000)
                                && !clickedBet(bkHere) && $target.length === 1) {
                                await mouseChain({target: $target[0], events: fullClick, error: 'tec'});
                                if (elementWasClicked === 0) {
                                    elementWasClicked = Date.now();
                                }
                            }
                        } while ((elementWasClicked === 0 || Date.now() - elementWasClicked < 15000)
                        && !clickedBet(bkHere))
                        if (clickedBet(bkHere)) {
                            result(true, '');
                        } else {
                            result(false, `We'd not opened coupon!`);
                        }
                    })
                    .catch((e) => result(false, 'Error till open event: ' + e));
            };
            if (ourCommand.getAdded('express') !== false) {
                data = paramData[ourCommand.getAdded('express')];
                data = removeTeamPrefix(data);
            } else {
                data = lData.shift();
                data = removeTeamPrefix(data);
            }
            if (typeof data !== 'undefined') {
                bsDebug(port, 'openCoupon - basic - We got data: ' + (typeof data), data);
                openElement();
            } else {
                onReject('There is no input data!');
            }
        });
    };

    /**
     * Close early opened coupons
     * @param skipParam [{boolean}] default FALSE - whether we need to skip closing
     * @param goToInplayParam [{boolean}] default TRUE - whether we need to go Inplay first
     * @returns {Promise<string,string>}
     */
    const closePreviousCoupons = function (skipParam, goToInplayParam) {
        let skip = typeof skipParam === 'undefined' ? false : skipParam;
        let goToInplay = typeof goToInplayParam === 'undefined' ? true : goToInplayParam;
        bsDebug(port, 'closePreviousCoupons - skip? ' + skip + ', goHome? ' + goToInplay);
        return new Promise(function (onRSuccess, onReject) {
            let onSuccess = function (m) {
                const $input = bkHere === 'favbetold' ? $('#inputC') : $('input[class*="BetSumInput_input_"]');
                if ($input.length) {
                    clickSelectAllDeleteEnter($input[0], '', true, false)
                        .then(() => onRSuccess(m))
                        .catch((e) => {
                            bsError(port, 'Error till clearing stake: ' + e);
                            onRSuccess(m);
                        });
                } else {
                    onRSuccess(m);
                }
            };
            if (skip) {
                bsDebug(port, 'closePreviousCoupons - SKIP');
                onSuccess('skipped!');
                return;
            } else {
                bsDebug(port, 'closePreviousCoupons - WORK');
            }
            let removeStakes = function () {
                let closeOne = function () {
                    let $closes = bkHere === 'favbetold' ? $('div.bb_del_m') : $('div[class*="SingleBet_closeIconWrapper"] svg');
                    if ($closes.length > 0) {
                        mouseChain({
                            target: $closes[0],
                            events: ['click'],
                            rejectOnPreventDefault: false,
                            scroll: true
                        })
                            .then(() => {
                                bsDebug(port, 'closeOne clicked!');
                                setTimeout(closeOne, 500);
                            })
                            .catch((e) => onReject('Error till close: ' + e));
                    } else {
                        onSuccess('All were closed!');
                    }
                };
                // Hint: Click 'Remove all' once or every 'Close'
                let $clearBtn = bkHere === 'favbetold' ? $('div.bbet_d_all') : $('span:textEquals("Delete all")');
                if ($clearBtn.length === 1) {
                    $clearBtn[0].scrollIntoView(true);
                    mouseChain({target: $clearBtn[0], events: ['click'], rejectOnPreventDefault: false})
                        .then(() => setTimeout(function () {
                            bsDebug(port, 'ClearBtn clicked!');
                            onSuccess('ClearBtn clicked!')
                        }, 1000))
                        .catch((e) => onReject('Error till ClearBtn click: ' + e));
                } else {
                    closeOne();
                }
            };
            removeStakes();
        });
    };

    let wasRead = false;

    const checkLanguage = async function () {
        const $flagIconEl = await waitForElement('div.selectedLanguageFlagIcon', 333, 15000);
        if ($flagIconEl.next().trt() !== 'RU') {
            await mouseChain({
                target: $('svg.languageDropdownArrowIcon')[0],
                events: fullClick, error: 'lang1', scroll: true,
            });
            const $ru = await waitForElement(
                'div.languageDropdownOption:has(div.languageDropdownOptionText:textEquals("RU"))',
                333, 10000);
            await mouseChain({target: $ru[0], events: fullClick, error: '$ru'});
            await delayPromise(3000);
        }
    };

    const authCheckNew = function () {
        (async () => {
            await closeAllWeNeed({
                'button[class*="CookieNotification_allowAllButton-"]': 'button[class*="CookieNotification_allowAllButton-"]',
                'button:textEquals("Reload")': 'button:textEquals("Reload")',
            });
            const $logLink = $('a[class*="LoginButton_login"]');
            const $logForm = $('form[class^="GuestContent_form"]');
            const errors = findSel(['span[class*="PasswordField_inputHintError"]', 'span[class*="Control_inputHintError"]']);

            if (errors !== undefined) {
                throw 'Login failed!';
            } else if ($logForm.length > 0) {
                await tryToLogInNew();
            } else if ($logLink.length > 0) {
                await mouseChain({target: $logLink[0], events: fullClick, error: '$logLink click'});
                await delayPromise(3333);
                await tryToLogInNew();
            } else {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true)
                });
                //await checkLanguage();
            }
        })()
            .catch(e => dLog('red', 'favbet', `authCheckNew error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheckNew);
    };

    const tryToLogInNew = async () => {
        if (Date.now() - authClicked <= 10000) {
            throw 'Too soon!';
        }

        const $email = $('input[name="email"]');
        const $password = $('input[name="password"]');
        const $submit = $('button[data-role="login-page-submit-btn"]');

        if ($email.length > 0 && $password.length > 0 && $submit.length > 0) {
            await clearAndInputEmail($email[0], settings.login, false);
            await delayPromise(888);
            await clearAndSimulate($password[0], settings.password, true, true, true);
            await delayPromise(888);
            await mouseChain({target: $submit[0], events: fullClick});
        } else {
            throw 'No inputs for login!';
        }

        authClicked = Date.now();
        return "auth_clicked";
    };

    const authCheck = function (settings) {
        //console.log('%c authCheck', 'background: red; color: white;');
        let $logLink = $('div.not_login button.loginpagecl');
        let $closeBtn = $('span.ui-button-text:contains("Закрыть")');
        let $readBtn = $('span.ui-button-text:contains("Прочитать")');
        let $cmsgbx = $('div.cmsgbx:visible');
        const $errorEl = $('div.error_block:visible');
        // Hint: Check we're in English
        if ($('label.dropdown-toggle span.lang-title').trt() !== 'ru') {
            // Hint: Switch to english
            port.postMessage({m: "tech works! 1"});
            bsDebug(port, 'we need flag RU');
            let $cur = $('label.dropdown-toggle div.cur');
            if ($cur.length === 1) {
                mouseChain({
                    target: $cur[0],
                    events: ['click'],
                    scroll: true,
                    rejectOnPreventDefault: false,
                    scrollTop: true
                })
                    .then(() => setTimeout(function () {
                        let $enA = $('i.lang--flag.lang_ru').parent();
                        if ($enA.length === 1 && elementIsVisible($enA[0])) {
                            mouseChain({
                                target: $enA[0],
                                events: ['click'],
                                scroll: true,
                                scrollTop: true,
                                rejectOnPreventDefault: false
                            })
                                .then(() => {
                                    bsDebug(port, 'Switched to russian!');
                                    setTimeout(function () {
                                        authCheck(settings);
                                    }, settings.authCheckInterval);
                                })
                                .catch((e) => {
                                    bsError(port, 'Error till $enA click: ' + e);
                                    setTimeout(function () {
                                        authCheck(settings);
                                    }, settings.authCheckInterval);
                                });
                        }
                    }, 500))
                    .catch((e) => {
                        bsError(port, 'Error till $cur click: ' + e);
                        setTimeout(function () {
                            authCheck(settings);
                        }, settings.authCheckInterval);
                    });
            } else {
                setTimeout(function () {
                    authCheck(settings);
                }, settings.authCheckInterval);
            }
        } else if ($errorEl.length > 0 && !enterError) {
            port.postMessage({m: "ERROR AUTH!"});
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            bsError(port, 'ERROR AUTH!');
            enterError++;
        } else if ($logLink.length > 0) {
            // Hint: Log In
            port.postMessage({m: "tech works! 2"});
            setTimeout(function () {
                tryToLogIn(settings, $logLink)
                    .then(() => setTimeout(function () {
                        authCheck(settings);
                    }, settings.authCheckInterval))
                    .catch((e) => {
                        bsError(port, 'Error till logging in: ' + e);
                        port.postMessage({m: "ERROR AUTH! " + e});
                        setTimeout(function () {
                            authCheck(settings);
                        }, settings.authCheckInterval)
                    });
            }, 1000);
        } else if ($cmsgbx.length === 1) {
            mouseChain({target: $cmsgbx.find('button:textEquals("Напомнить позже")')[0], events: ['click']})
                .then(() => setTimeout(function () {
                    authCheck(settings);
                }, settings.authCheckInterval))
                .catch((e) => {
                    bsError(port, 'Error till $cmsgbx: ' + e);
                    setTimeout(function () {
                        authCheck(settings);
                    }, settings.authCheckInterval)
                });
        } else if ($readBtn.length === 1) {
            let $btn = $readBtn.parent();
            mouseChain({target: $btn[0], events: ['click']})
                .then(() => setTimeout(function () {
                    wasRead = true;
                    authCheck(settings);
                }, settings.authCheckInterval))
                .catch((e) => {
                    bsError(port, 'Error till $btn $readBtn: ' + e);
                    setTimeout(function () {
                        authCheck(settings);
                    }, settings.authCheckInterval)
                });
        } else if (wasRead && $closeBtn.length === 1) {
            let $btn = $closeBtn.parent();
            mouseChain({
                target: $btn[0],
                events: ['click'],
                rejectOnPreventDefault: false,
                scroll: true,
                scrollTop: true
            })
                .then(() => setTimeout(function () {
                    wasRead = false;
                    authCheck(settings);
                }, settings.authCheckInterval))
                .catch((e) => {
                    bsError(port, 'Error till $btn $closeBtn: ' + e);
                    setTimeout(function () {
                        authCheck(settings);
                    }, settings.authCheckInterval)
                });
        } else {
            port.postMessage({
                m: "authorized!",
                balance: getBalance(true)
            });
            setTimeout(function () {
                authCheck(settings);
            }, settings.authCheckInterval);
        }
    };

    const tryToLogIn = function (settings, $logLink) {
        console.log($logLink);
        return new Promise(function (resolve, reject) {
            if ($logLink.length !== 1) {
                reject('No loglink!');
                return;
            }
            if (Date.now() - authClicked > 30000) {
                mouseChain({target: $logLink[0], events: ['click'], rejectOnPreventDefault: false})
                    .then(() => {
                        bsDebug(port, 'We clicked loglink! ' + $logLink.text().trim());
                        authClicked = Date.now();
                        waitForElement('#username', 333, 5000, true)
                            .then(performInput)
                            .catch((e) => reject('Error till click loglink: ' + e));
                    })
                    .catch((e) => reject('There is no ogin--input: ' + e));
            } else {
                reject('Too soon!');
            }
            let performInput = function ($username) {
                let clickLogin = function () {
                    let $butt = $('button[type="submit"]:textEquals("Вход")');
                    if ($butt.length === 1) {
                        setTimeout(function () {
                            mouseChain({target: $butt[0], events: ['click'], rejectOnPreventDefault: false})
                                .then(() => {
                                    authClicked = Date.now();
                                    resolve("auth_clicked");
                                })
                                .catch((e) => reject('Error till click login: ' + e));
                        }, 300);
                    } else {
                        reject("There is no active button!");
                    }
                };
                let enterPassword = function () {
                    port.postMessage({m: 'Account value is: ' + $username.val()});
                    let $password = $('#password');
                    if ($password.length !== 1) {
                        reject('No password input!');
                    } else {
                        clearInputElement({
                            element: $password[0],
                            string: settings.password,
                            long: true,
                            fireInput: true
                        })
                            .then(emulateKeyboardLikeHuman).then(clickLogin)
                            .catch((e) => {
                                reject('Error till enter password: ' + e);
                            });
                    }
                };
                clearInputElement({element: $username[0], string: settings.login, long: true, fireInput: true})
                    .then(emulateKeyboardLikeHuman).then(enterPassword).catch(function (e) {
                    reject(e);
                });
            };
        });
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            chrome.storage.local.set({
                'FAVBET_COMMAND': ourCommand.get(),
                'FAVBET_COMMAND_WAS_SET': ourCommand.getAdded('increaseDelay') !== false ? Date.now() + 150000 : Date.now()
            });
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});
        chrome.storage.local.get(['FAVBET_COMMAND', 'FAVBET_COMMAND_WAS_SET'], function (result) {
            //console.log(result);
            if (typeof result.FAVBET_COMMAND !== 'undefined' && typeof result.FAVBET_COMMAND_WAS_SET !== 'undefined'
                && Date.now() - result.FAVBET_COMMAND_WAS_SET < 40000) {
                let currentCommand = result.FAVBET_COMMAND;
                //console.log(currentCommand);
                chrome.storage.local.remove(['FAVBET_COMMAND', 'FAVBET_COMMAND_WAS_SET'], function () {
                    bsDebug(port, 'Restoring with: ', currentCommand);
                    messageProcessor(currentCommand);
                });
            } else {
                chrome.storage.local.remove(['FAVBET_COMMAND', 'FAVBET_COMMAND_WAS_SET']);
            }
        });
    }

})();
