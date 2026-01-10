(function () {

    "use strict";

    if (window.location.href.indexOf('pay.1cupis.ru') > -1) {
        return;
    }

    let cupisMode;
    let authorized = false;
    let currency = '';
    let lastMax = {};
    let limited = false;
    let authClicked = 0;
    let authClickedTimes = 0;
    let lastAuthCheck = 0;
    let busy = false;
    let sourceExpress = false;
    let waitSource = false;
    let port = chrome.runtime.connect({name: "port_ligastavok"});
    let loaded = Date.now();
    let settings = {
        restartEvery: 1800000,
        authCheckInterval: 2000,
        url: 'http://ligastavok.ru/Live/',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 1,
        betweenBets: 25000,
        newExpresses: false,
        source: {
            X: 399,
            Y: 401,
            Z: 400,
        },
        sourceRandom: 0,
        sourceDate: 0,
    };

    let currentBetData = {data: [], max: -1};
    let authError = false;
    const loginStr = 'div[class*="sign-"] a[href="/Login"]';

    let ourCommand = new ourCommandProto();

    let messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        let $logLink = $('#btnLogin');
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
            settings.lastScoreBasketball = message?.stake_fork?.lastScoreBasketball || '';
            settings.newExpresses = !!(settings?.stake_fork && settings.stake_fork?.newExpresses);
            settings.newExpressBetsAmount = Number(message?.stake_fork?.newExpressBetsAmount) || 2;
            if (settings.lastScoreBasketball === '999') {
                settings.sourceDate = Date.now();
                settings.sourceRandom = getSourceRandom();

                 if (settings.sourceRandom >= 33 && settings.sourceRandom <= 33) {
                     settings.newExpresses = true;
                     waitSource = true;
                     if (settings.sourceRandom >= 33 && settings.sourceRandom <= 33) {
                         settings.newExpressBetsAmount = 1;
                     }
                 } else {
                     waitSource = false;
                 }
                dLog('blue', 'LS', `Source current random value - ${settings.sourceRandom}`);
            }
            chrome.storage.local.get(['LIGASTAVOK_SPECIALS', 'LIGASTAVOK_SPECIALS_WAS_SET'], r => {
                console.log('%c' + 'Specials: ' + r.LIGASTAVOK_SPECIALS_WAS_SET,
                    'background: red; color: yellow; font-size: 13px; font-weight: normal; padding: 5px 10px;');
                console.log(r.LIGASTAVOK_SPECIALS);
                if (typeof r.LIGASTAVOK_SPECIALS_WAS_SET === 'number' && Date.now() - r.LIGASTAVOK_SPECIALS_WAS_SET < 86400000
                    && typeof r.LIGASTAVOK_SPECIALS !== 'undefined') {
                    limited = r.LIGASTAVOK_SPECIALS.limited;
                    authClicked = r.LIGASTAVOK_SPECIALS.authClicked;
                    authClickedTimes = r.LIGASTAVOK_SPECIALS.authClickedTimes;
                }
                authCheck();
            });
        } else if (message.action === "takeScreenshot") {
            screenshotHelper(port, 'ligastavok', ['#listline:visible', '#event_details:visible'], message.data);
        } else if ($logLink.length !== 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (message.action === 'MAXIMUM') {
            lastMax = {};
            busy = true;
            ourCommand.set(message);
            let max;
            const rep = (success, message) => {
                busy = false;
                port.postMessage({
                    answered: "MAXIMUM",
                    status: success ? 'success' : "error",
                    answer: message
                });
                ourCommand.clear();
            };
            bsDebug(port, 'MAXIMUM for: ' + message.data[0].market + '/' + message.data[0].target + '/' + message.data[0].pivot);
            closePreviousCoupons(typeof message.express !== 'undefined')
                .then(() => openCoupon(message.data))
                .then(m => max = m)
                .then(() => {
                    if (message.data[0].fork) {
                        rep(true, lastMax);
                    } else {
                        return checkCoefs(message.data)
                            .then(() => rep(true, max));
                    }
                })
                .catch(e => rep(false, "Error: " + e));
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
                proceedBet(message.data)
                    .finally(() => {
                        busy = false;
                        ourCommand.clear();
                    });
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
                proceedBet(message.data)
                    .finally(() => {
                        busy = false;
                        ourCommand.clear();
                    });
            }
        } else if (message.action === 'BET_RESULT') {
            busy = true;
            ourCommand.set(message);
            collectBetResults(message.data)
                .then(() => bsDebug(port, "It's looks like BET_RESULT done!"))
                .catch((e) => bsError(port, 'Error till BET_RESULT: ' + e))
                .then(async () => {
                    busy = false;
                    ourCommand.clear();
                    await mouseChain({
                        target: $(['#LogoHyperLink', 'a[href="/bets/live"]'].find(s => $(s).length > 0))[0],
                        events: ['click'],
                        scroll: true,
                        error: 'Go to live!',
                    }).catch(e => console.log('%c' + e, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'));
                });
        } else if (['DEPOSIT', 'WITHDRAW', 'CHECK_PAYMENTS'].indexOf(message.action) > -1) {
            busy = true;
            ourCommand.set(message);
            (function (d) {
                return message.action === 'DEPOSIT' ? deposit(d) : message.action === 'WITHDRAW' ? withdraw(d) : checkPayments(d);
            })(message.data)
                .then(() => bsDebug(port, 'It\'s looks like ' + message.action + ' done!'))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(delayFunction(7777))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                    const sel = ['div.logo a', 'a[href="/bets/live"]'].find(s => $(s).length > 0);
                    if (sel) {
                        return mouseChain({target: $(sel)[0], events: ['click'], scroll: true, error: 'DWCF'});
                    }
                });
        }
    };

    let checkPayments = function () {
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
            };
            let letsRockNRoll = function () {
                bsDebug(port, 'letsRockNRoll');
                if (document.location.href.indexOf('PersonalFolder/ManagementCenter/AccountsManagement/Statement.aspx') > -1) {
                    delayPromise(3333)
                        .then(() => {
                            if ($('div.filterContainer select').val() !== '1') {
                                return delayPromise(3333)
                                    .then(() => $('div.filterContainer select option[value="1"]').prop('selected', true))
                                    .then(delayFunction(3333))
                                    .then(() => mouseChain({
                                        target: $('input[type="image"][alt="Посмотреть"]')[0],
                                        events: ['click']
                                    }))
                                    .then(delayFunction(15000));
                            }
                        })
                        .then(() => {
                            collected = [];
                            $('div.columnSpacer table:visible tbody:visible tr:visible').each(function () {
                                let $tds = $(this).find('td');
                                let amountIn = $tds.eq(1).text().replace(',', '.')
                                    .replace(/[^0-9.]/g, '').replace(/.$/, '').trim();
                                let amountOut = $tds.eq(2).text().replace(',', '.')
                                    .replace(/[^0-9.]/g, '').replace(/.$/, '').trim();
                                collected.push({
                                    date: $tds.eq(5).text().trim(),
                                    description: '#' + $tds.eq(0).text().trim() + ', ' + $tds.eq(7).text().trim(),
                                    type: parseFloat(amountIn) > 0 ? 'IN' : 'OUT',
                                    paysystem: $tds.eq(4).text().trim() === 'QIWI' ? 'QIWI' : 'SKRILL',
                                    amount: parseFloat(amountIn) > 0 ? amountIn : amountOut,
                                    success: $tds.eq(6).text().trim().indexOf('Отклонена') === -1
                                });
                            });
                            console.log(collected);
                            report(true, 'Collected')
                        })
                        .catch((e) => report(false, 'Catch: ' + e));
                } else if (document.location.href.indexOf('PersonalFolder/ManagementCenter/AccountsManagement/') > -1) {
                    waitForElement('img[alt="Посмотреть выписку со счета"]', 333, 15000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                        // Hint: here the page will reload again
                        .then(delayFunction(3333)) // This is just for patience :)
                        .catch((e) => report(false, 'Go to Checkpayment: ' + e));
                } else {
                    waitForElement('a[href="/PersonalFolder/ManagementCenter/AccountsManagement/"]:contains("Получить деньги")', 333, 10000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                        // Hint: here the page will reload
                        .then(delayFunction(3333))
                        .catch((e) => report(false, 'Go to history: ' + e));
                }
            };
            letsRockNRoll();
            //bsDebug(port, 'for test purposes we will do nothing :)')
        });
    };

    let withdraw = function (data) {
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
            };

            let letsRockNRoll = function () {
                bsDebug(port, 'letsRockNRoll');
                if (document.location.href.indexOf('PersonalFolder/ManagementCenter/AccountsManagement/WithdrawalRequest.aspx') > -1) {
                    delayPromise(5555)
                        .then(() => {
                            let $label = $('label:contains("Какую сумму Вы хотите вывести?")');
                            if ($label.length > 0) {
                                return delayPromise(111)
                                    .then(() => clearAndSimulate($('#' + $label.attr('for'))[0], data.amount))
                                    .then(delayFunction(3333))
                                    .then(() => mouseChain({target: $('input[alt="QIWI"]')[0], events: ['click']}))
                                    .then(delayFunction(3333))
                                    .catch((e) => {
                                        throw 'Amount specifying: ' + e;
                                    });
                            }
                        })
                        .then(waitForElementF('input[type="radio"][value="' + data.login.replace('+', '') + '"]', 333, 10000))
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                        .then(waitForElementF('label:contains("Даю распоряжение на перечисление денежных средств")', 333, 10000))
                        .then(($el) => {
                            let $checkbox = $('#' + $el.attr('for'));
                            if (!$checkbox.is(':checked')) {
                                return delayPromise(3333)
                                    .then(() => mouseChain({target: $checkbox[0], events: ['click'], scroll: true}))
                                    .then(delayFunction(3333));
                            }
                        })
                        .then(waitForElementF('input[value="Заказать вывод средств в систему QIWI Кошелек"]', 333, 10000))
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                        .then(waitForCondition(() => {
                            return $('div.successfulActionMessage:visible').text().trim().indexOf('принята к рассмотрению') > -1;
                        }, 555, 10000, 'Not confirmed!', true))
                        .then(() => report(true, 'Everything is OKay!'))
                        .catch((e) => report(false, 'Filling: ' + e));
                } else if (document.location.href.indexOf('PersonalFolder/ManagementCenter/AccountsManagement/') > -1) {
                    waitForElement('img[alt="Запрос вывода средств"]', 333, 15000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                        // Hint: here the page will reload again
                        .then(delayFunction(3333)) // This is just for patience :)
                        .catch((e) => report(false, 'Go to QIWI: ' + e));
                } else {
                    waitForElement('a[title="Получить деньги"]', 333, 10000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                        // Hint: here the page will reload
                        .then(delayFunction(3333))
                        .catch((e) => report(false, 'Go to withdraw: ' + e));
                }

            };
            letsRockNRoll();
        });
    };

    const depositCupis = async data => {
        const sendReport = (success, message) => {
            bsDebug(port, 'Report! ' + success + ' / ' + message);
            ourCommand.add('increaseDelay', false);
            ourCommand.add('qiwiEntered', false);
            port.postMessage({
                answered: "DEPOSIT",
                status: success ? 'SUCCESS' : ['NO_FUNDS', 'RESTRICTED'].find(t => message.indexOf(t) > -1) || 'FAILED',
                answer: message
            });
            if (!success) {
                throw message;
            }
        };
        const getDepositResult = async () => {
            const depositResult = await bMess('DEPOSIT_RESULT', true).get(120000, 60000);
            if (typeof depositResult.success === 'boolean') {
                const message = typeof depositResult.message === 'string' ? depositResult.message : 'No message :(';
                sendReport(depositResult.success, message);
                return message;
            } else {
                throw `Wrong answer: ${JSON.stringify(depositResult)}`;
            }
        };
        return await (async () => {
            if (ourCommand.getAdded('qiwiEntered') === true) {
                return await getDepositResult();
            } else if (document.location.href.indexOf('/PersonalFolder/Accounts/Deposit') === -1) {
                const personalSel = 'span[class*="auth-panel__personal-area-name"]';
                await waitForElement(personalSel, 300, 15000, false, 1, 'No personal sel!');
                await delayPromise(1000);
                await mouseChain({target: $(personalSel)[0], events: fullClick, error: 'ONR'});
                const $el = await waitForElement('a[href="/PersonalFolder/Accounts/Deposit"]', 300, 10000, true);
                await delayPromise(1000);
                await mouseChain({target: $el[0], events: fullClick, error: 'PSCH'});
                await delayPromise(3000);
                return depositCupis(data);
            } else if (document.location.href.indexOf('/PersonalFolder/Accounts/Deposit') > -1) {
                const qs = 'div[class^="payment-system__img"]:has(img[alt*="QIWI"])';
                await waitForElement(qs, 300, 15000, false, 1, 'No qs!');
                await delayPromise(1000);
                if ($(qs).parent().attr('class').indexOf('payment-system_checked') === -1) {
                    await mouseChain({target: $(qs)[0], events: fullClick, error: 'Qiwi'});
                    await delayPromise(1000);
                }
                await clearAndSimulate($('input[class^="payment-controller__input"]')[0], data.amount);
                ourCommand.add('qiwiEntered', true);
                ourCommand.add('increaseDelay', true);
                await bMess('QIWI_COMMAND', true).set(ourCommand.get());
                await delayPromise(3000);
                await mouseChain({
                    target: $('button[class*="payment-controller__submit"]')[0],
                    events: fullClick,
                    error: 'PMT'
                });
                return await getDepositResult();
            } else {
                throw 'Unexpected behaviour!';
            }
        })()
            .catch(e => sendReport(false, 'Deposit: ' + e));
    };

    let deposit = function (data) {
        if (document.location.href.indexOf('ligastavok.ru/') > -1) {
            bsDebug(port, 'Deposit CUPIS!', data);
            return depositCupis(data);
        }
        bsDebug(port, 'Deposit!', data);
        return new Promise(function (onSuccess, onReject) {
            let report = function (success, message) {
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
            let letsRockNRoll = function () {
                bsDebug(port, 'letsRockNRoll');
                if (ourCommand.getAdded('qiwiEntered') !== false) {
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
                                report(depositResult.success, typeof depositResult.message === 'string' ? depositResult.message : 'No message :(');
                            }
                        })
                        .catch((e) => report(false, 'preFinal: ' + e));
                } else if (document.location.href.indexOf('PersonalFolder/ManagementCenter/AccountsManagement/Deposit.aspx') > -1) {
                    waitForElement('input[src$="QIWI_logo.gif"]', 333, 10000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                        // Hint: here the page will reload
                        .then(delayFunction(3333))
                        .then(waitForElementF('input[id$="_QIWIDepositAmountTextBox"]', 333, 1000))
                        .then(($el) => {
                            $el.val(data.amount);
                        })
                        .then(delayFunction(3333))
                        .then(() => clearInputElement({
                            string: data.login.replace(/^7/, ''),
                            element: $('input[id$="_txtMobilePhoneNumber"]')[0],
                            long: true,
                            fireChange: true,
                            fireInput: true
                        }))
                        .then(emulateKeyboardLikeHuman)
                        .then(() => {
                            ourCommand.add('increaseDelay', true);
                            ourCommand.add('close', true);
                            ourCommand.add('qiwiEntered', true);
                            chrome.storage.local.remove(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET'], function () {
                                chrome.storage.local.set({
                                    'QIWI_COMMAND': ourCommand.get(),
                                    'QIWI_COMMAND_WAS_SET': Date.now()
                                });
                            });
                        })
                        .then(delayFunction(3333))
                        .then(() => mouseChain({
                            target: $('input[id$="_QIWIDepositButton"]')[0],
                            events: ['click'],
                            scroll: true
                        }))
                        .then(delayFunction(3333))
                        .then(letsRockNRoll)
                        .catch((e) => report(false, 'Entering data for QIWI: ' + e));
                } else if (document.location.href.indexOf('PersonalFolder/ManagementCenter/AccountsManagement/') > -1) {
                    waitForElement('img[alt="Пополнить счет"]', 333, 15000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                        // Hint: here the page will reload again
                        .then(delayFunction(3333)) // This is just for patience :)
                        .catch((e) => report(false, 'Go to QIWI: ' + e));
                } else {
                    waitForElement('a:contains("Пополнение счета"):visible', 333, 10000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                        // Hint: here the page will reload
                        .then(delayFunction(3333))
                        .catch((e) => report(false, 'Go to deposit: ' + e));
                }
            };
            letsRockNRoll();
        });
    };

    const $coupons = () => $('[data-t-id="betslip-bet-team-names"]').closest('div[class^="bet__container-"]');

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

    const collectBetResultsCupis = async data => {
        let limit = 30;
        if (data.length === 2 && data[0] === 'limit') {
            limit = parseInt(data[1]);
            data = [];
        }
        const collected = [];
        if (document.location.href.indexOf('PersonalFolder/MyOrders') === -1) {
            const panSel = 'span[class*="uth-panel__personal-area-name"]';
            await mouseChain({target: $(panSel)[0], events: fullClick, error: 'pan', scroll: true});
            const $hst = await waitForElement('a[href="/PersonalFolder/MyOrders"]',
                333, 30000, true, 1, 'No history button!');
            await delayPromise(1000);
            await mouseChain({target: $hst[0], events: fullClick, error: '$hst'});
            await delayPromise(3000);
        }
        await waitForElement('div[class^="my-bets__content-wrapper"]', 333, 30000, false, 1,
            `History div, main = ${(window.self === window.top)}, ${document.location.href}`);
        let i = 0;
        await $('div[class^="stake-"]').eachAsync(async function () {
            const $this = $(this);
            $this[0].scrollIntoView();
            const aSel = 'svg[class^="arr-down-"]';
            if ($this.find(aSel).length > 0) {
                await mouseChain({target: $this.find(aSel)[0], events: fullClick, error: 'aSel', scroll: true});
                await delayPromise(1000);
            }
            const external_id = $this.find('span[class^="stake__barcode-"]').text().replace(/[^\d.]/g, '').trim();
            let status = 'ACCEPTED';
            const result = $this.find('div[class*="stake__grid_5-"]').find('div[class*="stake__result-"]').length === 0 ? $this.find('div[class*="stake__grid_5-"]').find('span').attr('title') : $this.find('div[class*="stake__grid_5-"]').find('div[class*="stake__result-"]').text().replace(',', '.').replace(/[^\d.]/g, '').slice(0, -1).trim();
            const resultBlock = $this.find('div[class*="stake__grid_5-"]').find('div[class*="stake__result-"]');

            if (resultBlock.length > 0) {
                if (resultBlock.is('[class*="stake__result_canceled"]')) status = 'REFUNDED';
                if (resultBlock.is('[class*="stake__result_win"]')) status = 'WON';
                if (resultBlock.is('[class*="stake__result_lose"]')) status = 'LOSE';
            }

            if (data.length === 0 || data.indexOf(external_id) > -1) {
                collected.push({
                    external_id,
                    status,
                    match: $this.find('div[class*="stake__event-info_dark-"]').first().text().trim(),
                    bkPivot: '',
                    coef: $this.find('div[class*="stake__grid_4-"]').text().trim().replace(',', '.'),
                    stake: $this.find('div[class*="stake__grid_3-"]').text().trim().replace(',', '.'),
                    result: result
                });
            }
            i++;
            if (i >= limit) {
                return false;
            }
        });
        return collected;
    };

    const collectBetResults = async data => {
        let error = '';
        const res = await (cupisMode ? collectBetResultsCupis : collectBetResultsOffshore)(data)
            .catch(e => (error = e, []));
        bsDebug(port, `collectBetResults (${error}): `, res, data);
        port.postMessage({
            answered: "BET_RESULT",
            status: error.length === 0 ? "success" : "error",
            answer: error.length === 0 ? res : error,
        });
        if (error.length !== 0) {
            throw error;
        }
        return res;
    };

    /**
     * Collecting bet results
     * @param {array} inputData
     * @returns {Promise<any>}
     */
    let collectBetResultsOffshore = function (inputData) {
        return new Promise(function (onSuccess, onReject) {
            let collected = [];
            let limit = 0;
            let data = inputData;
            if (data.length === 2 && data[0] === 'limit') {
                limit = parseInt(data[1]);
                data = [];
            }
            bsDebug(port, 'collectBetResults, limit: ' + limit + ', data:', data);
            let collectOne = function ($current) {
                return new Promise(function (onSuccess, onReject) {
                    $current[0].scrollIntoView();
                    let status = 'ACCEPTED';
                    let $test = $current.find('div.gaming-history__stake.value');
                    if ($test.hasClass('gaming-history__stake_win')) {
                        status = 'WON';
                    } else if ($test.hasClass('gaming-history__stake_lose')) {
                        status = 'LOSE';
                    }
                    let $eventInfo = $current.find('div.gaming-history__row-head div.gaming-history__event').first();
                    let match = $eventInfo.find('b').text().trim();
                    let temp = $eventInfo.html().split('<br>');
                    let bkPivot = '';
                    if (temp.length === 2) {
                        bkPivot = temp[1].replace('<b>', '').replace('</b>', '').replace(match, '')
                            .replace(match.replace(/^\./, '').replace(/\.$/, ''), '').trim();
                    }
                    let $betInfo = $current.find('div.gaming-history__event span.gaming-history__bet');
                    let coef = '';
                    if ($betInfo.length === 2) {
                        coef = $($betInfo[1]).text().replace(/[^0-9\.]/g, '').trim();
                    }
                    if (coef === '') {
                        coef = $current.find('div.gaming-history__coef span.value').text().replace(/[^0-9\.]/g, '').trim();
                    }
                    let external_id = $current.find('div.gaming-history__payment-id b').text().replace(/[^0-9\.]/g, '').trim();
                    let result = $current.find('div.bet-info-payout__value').text().replace(/[^0-9\.]/g, '').trim();
                    if (data.length === 0 || data.indexOf(external_id) > -1) {
                        collected.push({
                            external_id: external_id,
                            status: status,
                            match: match.replace(/^\./, '').replace(/\.$/, ''),
                            bkPivot: bkPivot,
                            coef: coef.replace(/^\./, '').replace(/\.$/, ''),
                            stake: $($betInfo[0]).text().replace(/[^0-9\.]/g, '').trim(),
                            result: result !== '' ? result : $current.find('div.stake-info').text().replace(/[^0-9\.]/g, '').trim()
                        });
                    }
                    onSuccess();
                });
            };

            let currentBet = 0;
            let performCollectBet = function () {
                waitForElement('td.centerAlignment', 777, 20000)
                    .then(($bets) => {
                        $bets.each(function () {
                            if ((limit === 0 && data.length === 0)
                                || (limit > 0 && collected.length < limit)
                                || (data.length > 0 && collected.length < data.length)) {
                                let $this = $(this);
                                let external_id = $this.find('a').text().trim();
                                let status = 'ACCEPTED';
                                let stake = parseFloat($this.parent().find('td[class="rightAlignment"]').text().trim());
                                let $test = $this.parent().find('td.rightAlignment.boldText');
                                let result = parseFloat($test.text().replace(',', '.').replace(/[^0-9\.]/, '').trim().toString());
                                if (!isNaN(result) && !isNaN(stake) && result > stake) {
                                    status = 'WON';
                                } else if (!isNaN(result) && !isNaN(stake) && result < stake) {
                                    status = 'LOSE';
                                } else if (!isNaN(result) && !isNaN(stake) && result === stake) {
                                    status = 'REFUNDED';
                                }
                                if (data.length === 0 || (data.length > 0 && data.indexOf(external_id) > -1)) {
                                    collected.push({
                                        external_id: external_id,
                                        stake: stake,
                                        result: isNaN(result) ? 0 : result,
                                        status: status
                                    });
                                }
                            } else {
                                return false
                            }
                        });
                        onSuccess(collected);
                    })
                    .catch((e) => onReject('waitForBets: ' + e));

                let $allBets = $('div.my-account.gaming-history__row');
                if (currentBet < $allBets.length
                    && (
                        (limit === 0 && data.length === 0)
                        || (limit > 0 && currentBet < limit)
                        || (data.length > 0 && collected.length < data.length))
                ) {
                    collectOne($($allBets[currentBet]))
                        .then(() => {
                            currentBet++;
                            delayPromise(333).then(performCollectBet);
                        })
                        .catch((e) => onReject('Error then collectig: ' + e));
                } else {
                    onSuccess(collected);
                }
            };

            if (window.location.href.indexOf('PersonalFolder/ManagementCenter/AccountsManagement/Default.aspx') > -1) {
                mouseChain({
                    target: $('a[href="/PersonalFolder/MyOrders/"]')[0],
                    events: ['click'],
                    scroll: true
                })
                    .then(() => bsDebug(port, 'We are going to bets 2!'))
                    .catch((e) => onReject('Error going to bets 2: ' + e));
            } else if (window.location.href.indexOf('/PersonalFolder/MyOrders/') > -1) {
                performCollectBet();
            } else {
                let $myBets = $('a[href="/PersonalFolder/ManagementCenter/AccountsManagement/Default.aspx"]');
                if ($myBets.length > 0) {
                    mouseChain({
                        target: $myBets[0],
                        events: ['click'],
                        scroll: true
                    })
                        .then(() => bsDebug(port, 'We are going to bets 1!'))
                        .catch((e) => onReject('Error going to bets 1: ' + e));
                } else {
                    onReject('Something very strange! ' + window.location.href);
                }
            }
        });
    };

    const ProccedExpressNew = async () => {
        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));
        const $coefs = () => $('li[class^="events-list_"] div[class^="event-time__value_"]:contains("Сегодня")')
            .closest('li')
            .find('div[class*="event-card_bet-buttons-group_"] button[class^="bet-button_"]:nth-child(-n+6):not([disabled])');
        const $events = () => $('li[class^="events-list_"] div[class^="event-time__value_"]:contains("Сегодня")');
        const today = 'div[class*="desktop-filters-switcher-time-filter-tabs-"] a:first';
        const football = 'a[data-tab-name="Футбол"]';
        const currentBets = [];

        // go to Sport page
        if ($(today).length === 0) {
            await mouseChain({target: $('a[data-l-id="nav-menu-home"]')[0], events: fullClick, error: 'Sport tab'});
            await delayPromise(555);
        }

        // select Today link
        await waitForElement(today, 222, 7777);
        if ($(today).is('[class*="desktop-filters-switcher-time-filter-tabs__item_on"]') === false) {
            await mouseChain({target: $(today)[0], events: fullClick, error: '$today'});
            await waitForCondition(() => $events().length > 0,
                333, 22222, 'No today events!');
        }

        // select Football
        if ($(football).length === 0) {
            throw 'Football is not available';
        }

        if ($(football).is('[class*="primary_active_"]') === false) {
            await mouseChain({target: $(football)[0], events: fullClick, error: '$football'});
            await waitForCondition(() => $events().length > 0,
                333, 22222, 'No football today events!');
        }

        const findOption = coef => {
            return isNaN(coef) ? false : coef >= 1.01 && coef <= 1.15;
        };

        const getUniqueRandomNumber = (length) => {
            return Math.floor(Math.random() * length);
        }

        do {
            const randomCoef = getUniqueRandomNumber($coefs().length);
            const eventName = $coefs().eq(randomCoef)
                .closest('footer')
                .find('div[class*="team-name_"]')
                .toArray().map(el => $(el).trt()).join(' - ');

            if (currentBets.indexOf(eventName) > -1) {
                continue;
            }

            if (eventName.length < 5) {
                dLog('red', 'LS', `'${eventName}' is too short - ${eventName.length}`);
                continue;
            }

            if (used[eventName] >= 1) {
                dLog('big-yellow', 'LS', `${eventName} used ${used[eventName]} times!`);
                continue;
            }

            if (
                $coefs().eq(randomCoef)
                .is('[class*="event-card__bet-button_active_"]')
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
            dLog('green', 'LS', [`We get selected bets: '${currentBets}', now used:`, used]);
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

    const proceedBet = async data => {
        const betFinished = async (success, message) => {
            const resultData = {
                "external_id": success ? message.external_id : '',
                "status": success
                    ? 'ACCEPTED'
                    : ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED'].find(c => typeof message === 'string' && message.indexOf(c) > -1) || 'FAILED',
                "market": data[0].market === 'DRAW_NO_BET' ? 'HDP' : data[0].market,
                "target": data[0].target,
                "pivot": data[0].pivot,
                "coef": success ? String(message.odd) : data[0].coef,
                "stake": success ? String(message.stake) : data[0].stake,
                "maximum": currentBetData.max
            };
            if (success) {
                await eventsWorkAll('ligastavok',
                    settings.eventMaxBets, settings.eventTimeLimit,
                    data, true, true);
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

                    dLog('LS', 'blue-big',
                        [`We set bet with first: '${currentFirstBet}', now used:`, used]);

                    if (settings.newExpressBetsAmount > 1) {
                        const currentSecondBet = await bMess('currentSecondBet').check(1080000, true);
                        if (!used[currentSecondBet]) {
                            used[currentSecondBet] = 1;
                        }

                        dLog('LS', 'blue-big',
                        [`We set bet with second: '${currentSecondBet}', now used:`, used]);
                    }

                    await bMess('usedEvents').set(used);
                }
            }
            const doNotSend = !!data[0].betFromParser && !success && resultData.status !== 'LIMITED';
            if (!!data[0].betFromParser && resultData.status !== 'LIMITED') {
                resultData.type = 'VALUE';
                resultData.mode = data[0].type;
                resultData.bookmaker = 'LIGASTAVOK';
                resultData.placedCoef = resultData.coef;
                resultData.coef = data[0].coef;
                resultData.source = '401' || 'oddscp';
                resultData.currency = data[0]?.currency || 'USD';
                resultData.externalId = resultData.external_id;
                resultData.sport = data[0].sport;
                resultData.timeValue = data[0].time_value;
                resultData.league = data[0].league;
                resultData.homeTeam = data[0].team1;
                resultData.awayTeam = data[0].team2;
                resultData.score = data[0].score;
                resultData.pivot = resultData.pivot || null;
            }
            port.postMessage({
                answered: !!data[0].betFromParser && resultData.status !== 'LIMITED'
                    ? "F_BET" : "BET",
                data: resultData,
                answer: success ? 'Everything is Okay!' : message,
                doNotSend,
            });

            bsDebug(port, `Result data (${success}): `, resultData);
        };

        try {
            const
                realSuccessInterval = data[0].successBetInterval || settings.betweenBets,
                wasSuccessStake = await bMess('WasSuccessStake')
                    .check(realSuccessInterval)
                    .catch(() => 0),
                successDiff = Date.now() - wasSuccessStake;
            if (successDiff < realSuccessInterval) {
                throw `To early after previous success bet ${successDiff} instead of ${realSuccessInterval}!`
            }
            if (!!data[0].betFromParser) {
                const checkRes = await eventsWorkAll('ligastavok',
                    settings.eventMaxBets, settings.eventTimeLimit,
                    data, false, true);
                if (checkRes !== 'OK') {
                    dLog('red', 'LS', `We got errors: ${checkRes}`);
                    throw checkRes;
                } else {
                    dLog('big-blue', 'LS',
                        `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                    for (const d of data) {
                        const eventName = `${d.team1} - ${d.team2}`;
                        dLog('blue', 'LS', `${settings.eventMaxBets} for ${eventName} not reached`);
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

            const res = await proceedBetCupis(data);
            await betFinished(true, res);
        } catch (e) {
            await betFinished(false, e);
        }
    };

    const proceedBetCupis = async data => {
        bsDebug(port, `proceedBetCupis`, data);
        let stake = parseFloat(data[0].stake);
        const balance = parseFloat(getBalance());
        const stakeInput = 'input#betslip__betsize-input';
        const wrongSize = 'div[class*="betslip__wrong-size-"]';

        if (!balance) {
            throw 'NO_FUNDS';
        }
        if (isNaN(stake) || stake <= 0) {
            throw `Wrong stake: ${data[0].stake}`;
        }
        if (stake > balance) {
            stake = balance;
        }

        await closePreviousCoupons(settings.newExpresses ? true : false);
        await openCouponCupis(data);

        //if sourceExpress check coupon for events
        if (sourceExpress && settings.lastScoreBasketball === '999') {
            if ($coupons().length !== 1) {
                throw 'Error Express source BET, No 1 event in coupon!';
            }
        }

        if (settings.newExpresses && $coupons().length < settings.newExpressBetsAmount + 1) {
            throw `less than ${settings.newExpressBetsAmount + 1} events in the newExpresses`;
        }

        checkCoefsCupis(data);
        await clearAndSimulate($(stakeInput)[0], stake.toString());
        await delayPromise(1222);
        // get max
        if ($(wrongSize).find('span:textEquals("Максимальная сумма пари:")').length > 0) {
            const max = parseFloat($(wrongSize).find('b').trt().replace(/[^0-9]/g, '').trim());
            if (!max) {
                throw 'wrong MAX!';
            }

            if (parseFloat(stake) > max) {
                await clearAndSimulate($(stakeInput)[0], max.toString());
                await delayPromise(1555);
            }
        }

        const bsSel = 'button#betslip__bar_submit-btn';
        if ($(bsSel).length > 0) {
            await mouseChain({target: $(bsSel)[0], events: fullClick, error: 'bsSel', scroll: true});
            await waitForElement(() => $(findSel([
                  'div[class*="stake-result-badge__title-wrapper-"] p:textEquals("Пари: одинар заключен")',
                   // новый вариант (экспресс)
                  'div[class*="stake-result-badge__title-wrapper-"] p:textEquals("Пари: экспресс заключен")',
                  // оставим старые на всякий случай
                  'div[class*="notification__title-wrapper-"] p:textEquals("Пари: одинар заключен")',
                  'div[class*="notification__title-wrapper-"] p:textEquals("Пари: 1 одинар заключен")',
                  'div[class*="notification__title-wrapper-"] p:textEquals("Пари: экспресс заключен")',
            ])), 111, 38888);
            await delayPromise(777);
            await mouseChain({target: $('a[href="/PersonalFolder/MyOrders"]')[0], events: fullClick, error: 'historyBtn', scroll: true});
            const $first = await waitForElement('div[class^="stake__content-"]:first', 111, 7777);
            const external_id = $first.attr('id').replace(/[^0-9]/g, '').trim();
            const odd   = $first.find('[data-t-id="stake-card-bet-factor"]').trt();
            const stake = $first.find('[data-t-id="stake-card-bet-amount"]').trt().replace(/[^0-9]/g, '').trim();
            
            return {external_id, odd, stake};
        } else {
            throw 'No bet button!';
        }
    };

    /**
     * Open event table, if we're on it already -  onSuccess
     * @param {object} data
     * @returns {Promise<any>}
     */
    const openEvent = data => new Promise(function (onSuccess, onReject) {
        //bsDebug(port, 'openEvent', data);
        let team1 = data.team1.toLowerCase();
        let team2 = data.team2.toLowerCase();
        let eventName = team1 + ' - ' + team2;
        let sport = data.sport;
        let checkScore = function () {
            return new Promise(function (onSuccess, onReject) {
                let waitForScoreStarted = Date.now();
                let waitForScore = function () {
                    if (data.score !== '' && ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) === -1) {
                        let score1 = $('div.score1').text().trim();
                        let score2 = $('div.score2').text().trim();
                        if ((window.location.href.indexOf('#game/') === -1 || score1 === '' && score2 === '')
                            && Date.now() - waitForScoreStarted < 15000) {
                            setTimeout(waitForScore, 777);
                        } else {
                            let score = score1 + ':' + score2;
                            if (score === data.score) {
                                onSuccess(score);
                            } else {
                                onReject(score);
                            }
                        }
                    } else {
                        onSuccess('We wont check score here!');
                    }
                };
                waitForScore();
            });
        };
        let result = function (status, message) {
            if (status) {
                checkScore()
                    .then(() => onSuccess(message))
                    .catch((e) => onReject('SCORE_CHANGED we need: "' + data.score + '", we have: "' + e + '"'));
            } else {
                onReject(message);
            }
        };
        let checkWeAreThere = function () {
            //bsDebug(port, 'checkWeAreThere');
            const cTeam1 = $('div.team1').text().trim().toLowerCase(),
                cTeam2 = $('div.team2').text().trim().toLowerCase();
            const eventHere = cTeam1 + ' - ' + cTeam2;
            //bsDebug(port, 'checkWeAreThere: ' + cTeam1 + ' = ' + team1 + ' && ' + cTeam2 + ' = ' + team2);
            return eventHere === eventName || locutus_similar_text(eventHere, eventName, true) > 80;
        };
        let findEvent = function () {
            return new Promise(function (onSuccess, onReject) {
                let sportWeNeed = sport === 'FOOTBALL' ? 'SOCCER' : 'UNKNOWN';
                waitForCondition(function () {
                    //bsDebug(port, 'waitForCondition ' + (window.location.href.indexOf('/Live/LiveV2.aspx') > -1)
                    //    + ' && ' + ($('div[sptype="' + sportWeNeed + '"] span.ename').length));
                    return window.location.href.indexOf('/Live/LiveV2.aspx') > -1
                        && $('div[sptype="' + sportWeNeed + '"] span.ename').length > 0;
                }, 777, 15000, ' wait for sport ')
                    .then(delayFunction(777))
                    .then(() => waitForCondition(() => {
                        let $span = $('div[sptype="' + sportWeNeed + '"] span.ename').filter(function () {
                            //console.log($(this).text().trim().toLowerCase() + ' === ' + eventName);
                            const eventHere = $(this).text().trim().toLowerCase();
                            return eventHere === eventName || locutus_similar_text(eventHere, eventName, true) > 80;
                        });
                        return $span.length === 1;
                    }, 2000, 15000, 'find event'))
                    .then(() => {
                        let $span = $('div[sptype="' + sportWeNeed + '"] span.ename').filter(function () {
                            //console.log($(this).text().trim().toLowerCase() + ' === ' + eventName);
                            const eventHere = $(this).text().trim().toLowerCase();
                            return eventHere === eventName || locutus_similar_text(eventHere, eventName, true) > 80;
                        });
                        if ($span.length === 1) {
                            onSuccess($span);
                        } else {
                            onReject('Event not found! (M)');
                        }
                    })
                    .catch((e) => onReject(e));
            });
        };
        let performOpenEvent = function ($link) {
            mouseChain({target: $link[0], events: ['click'], scroll: true})
                .then(() => waitForCondition(() => {
                    if (window.location.href.indexOf('#game/') > -1) {
                        let $ed = $('#event_details');
                        let $eh = $('div.event_header');
                        if ($ed.length > 0 && $eh.length > 0) {
                            setTimeout(function () {
                                $eh[0].scrollIntoView();
                            }, 200);
                            return true;
                        }
                    }
                    return false;
                }, 333, 10000, ' wait event loaded '))
                .then(delayFunction(777))
                .then(() => result(true, 'We found it and probably on it!'))
                .catch((e) => result(false, 'In performOpenEvent: ' + e));
        };
        // Check we're on event page already
        //bsDebug(port, 'OpenEvent: ' + (window.location.href.indexOf('#game/') > -1)
        //    + ' / ' + (window.location.href.indexOf('Live/LiveV2.aspx') === -1));
        let tryToFindEventInLeftSide = function () {
            return new Promise(function (onSuccess, onReject) {
                let $sport = $('#Div1 div.cnt_normal').filter(function () {
                    // TODO: SPORT HERE MUST BE CHANGED TOO!!!
                    return $(this).find('div.sport_type').text().indexOf("Футбол") > -1;
                });
                if ($sport.length === 1) {
                    let $a = $sport.find('a').filter(function () {
                        return $(this).text().trim().toLowerCase() === eventName;
                    });
                    if ($a.length === 1) {
                        $('#Div1 div.mCSB_container').attr('style', 'position: relative; top: -' + $a.parent().parent()[0].offsetTop + 'px;');
                        setTimeout(function () {
                            mouseChain({target: $a[0], events: ['click']})
                                .then(() => onSuccess('Must be clicked!'))
                                .catch((e) => onReject('$a click: ' + e));
                        }, 777);
                    } else {
                        onReject('Event not found in left side!');
                    }
                } else {
                    onReject('Sport not found!');
                }
            });
        };
        let goRightPage = function () {
            if (window.location.href.indexOf('#game/') > -1) {
                if (checkWeAreThere()) {
                    result(true, 'we are on event already!');
                } else {
                    tryToFindEventInLeftSide()
                        .then(delayFunction(1500))
                        .then(goRightPage)
                        .catch((e) => {
                            bsDebug(port, 'tryToFindEventInLeftSide: ' + e);
                            mouseChain({
                                target: $('div.nav_menu a.browse.item')[0],
                                events: ['click'],
                                scroll: true
                            }).then(findEvent)
                                .then(performOpenEvent)
                                .catch((e) => result(false, 'findEvent 3:' + e));
                        });
                }
            } else if (window.location.href.indexOf('Live/LiveV2.aspx') === -1) {
                let $newVersionLink = $('a[href="/Live/LiveV2.aspx"]');
                if ($newVersionLink.length > 0) {
                    mouseChain({target: $newVersionLink[0], events: ['click'], scroll: true})
                        .then(findEvent)
                        .then(performOpenEvent)
                        .catch((e) => result(false, 'findEvent 2-1:' + e));
                } else {
                    // Go to main page first
                    mouseChain({target: $('#LogoHyperLink')[0], events: ['click']})
                        .then(delayFunction(5000))
                        .then(goRightPage)
                        .catch((e) => result(false, 'findEvent 2-2:' + e));
                }
            } else {
                findEvent()
                    .then(performOpenEvent)
                    .catch((e) => result(false, 'findEvent 1:' + e));
            }
        };
        goRightPage();
    });

 const checkCoefsCupis = data => {
    const findInData = evt => data.find(bet => [1, 2].every(i => bet[`team${i}`].length > 0 && evt.indexOf(bet[`team${i}`].toLowerCase()) > -1));
    const errors = [];
    let checked = 0;
    let odd = 1;

    // Было: $coupons() / .first()
    // Стало: ищем строки купона по стабильным data-t-id → поднимаемся к контейнеру
    const $couponsCoefs = (data.length === 1 && settings.newExpresses === true)
        ? $('[data-t-id="betslip-bet-team-names"]').closest('[data-l-id="betslip-bet"]').first()
        : $('[data-t-id="betslip-bet-team-names"]').closest('[data-l-id="betslip-bet"]');

    $couponsCoefs.each(function () {
        const $row = $(this);

        const err = $row.find('div[class^="bet__msg-container-"]').text().trim();

        // Было: 'span[class*="bet__teams_text-"]'
        // Стало: стабильный атрибут
        const match = $row.find('[data-t-id="betslip-bet-team-names"]').trt();

        // Было: 'div[class*="bet__coeff-"] span:first'
        // Стало: стабильный атрибут
        const coef = parseFloat($row.find('[data-t-id="betslip-bet-coeff-initial"]').trt());

        const d = findInData(match.toLowerCase());

        if (isNaN(coef)) {
            errors.push(match - ' wrong coef!'); // оставил как в вашей версии (только селекторы меняем)
        } else if (!d || (d.coef !== '' && isNaN(parseFloat(d.coef)))) {
            errors.push(match + ' - wrong data coef!');
        } else if (err.length > 0 && err.indexOf('Заключение пари приостановлено') > -1) {
            errors.push(`${match} - ${err} - BET SUSPENDED!`);
        } else if (d.coef !== '') {
            const dCoef = parseFloat(d.coef);
            if (coef < dCoef) {
                errors.push(`${match} - we need ${dCoef}, we have ${coef}!`);
            } else if (coef > dCoef * 1.2) {
                errors.push(`${match} - coef TOO BIG, we need ${dCoef}, we have ${coef}!`)
            } else {
                odd = odd * coef;
            }
        }
        checked++;
    });

    if (checked !== data.length) {
        errors.push(`Wrong amount of rows: ${checked} instead of ${data.length}`);
    }
    if (errors.length > 0) {
        throw 'LOW_COEF: ' + errors.join('; ');
    }

    return odd;
};

    /**
     * Checks coefs into the coupon
     * @param data
     * @returns {Promise<string,string>}
     */
    let checkCoefs = function (data) {
        return new Promise(function (onSuccess, onReject) {
            /* TEST TOP START
            (function (data) {
                console.log(data);
                let onSuccess = function (m) {
                    console.log('Success: ' + m);
                };
                let onReject = function (m) {
                    console.log('Reject: ' + m);
                };
                 TEST TOP FINISH */
            let checkCoupon = function () {
                return new Promise(function (onSuccess, onReject) {
                    let findInData = function (match) {
                        let result = false;
                        $.each(data, function () {
                            let localMatch = this.team1.toLowerCase() + ' — ' + this.team2.toLowerCase();
                            if (localMatch === match.toLowerCase()) {
                                result = this;
                                return false;
                            }
                        });
                        return result;
                    };
                    let $coupon = $('#koBetsCart');
                    let $coupons = $coupon.find('div.cardItem' + (data.length > 1 ? '.isSelected' : '') + ':visible');
                    let errors = [];
                    let checked = 0;
                    $coupons.each(function () {
                        let $this = $(this);
                        let match = $this.find('div.title').attr('title');
                        let localCoef = parseFloat($this.find('div.qaf').text().trim().replace(',', '.'));
                        let localData = findInData(match);
                        if (localData !== false && localData.coef !== '' && !isNaN(localCoef)) {
                            let checkCoef = parseFloat(localData.coef);
                            if (isNaN(checkCoef) || checkCoef > localCoef) {
                                errors.push(match + ' LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef);
                            }
                            checked++;
                        } else if (localData === false || isNaN(localCoef)) {
                            errors.push(match + ' LOW_COEF - wrong match of localCoef!');
                            checked++;
                        } else if (localData.coef === '') {
                            checked++;
                        }
                    });
                    if (errors.length === 0 && checked === data.length) {
                        onSuccess('Coefs fine!');
                    } else {
                        onReject(errors.join('; ') + (checked !== data.length ? ' some stakes not checked ('
                            + checked + '/' + data.length + ')!' : ''));
                    }
                });
            };
            checkCoupon()
                .then((m) => onSuccess(m))
                .catch((e) => onReject(e));
            /* TEST BOTTOM START
        })([
            {team1: 'Азербайджан (мол)', team2: 'Израиль (мол)', coef: '7.1'},
            {team1: 'Польша (до 20)', team2: 'Италия (до 20)', coef: '1.4'}
        ]);
            TEST BOTTOM FINISH */
        });
    };

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<jQuery,string>} jQuery element for bet
     */
    let getBetElement = function (data) {
        return new Promise(function (onSuccess, onReject) {
            let markets = {
                'ONE_TWO': {
                    'ONE': {root: ['FULLTIME_WIN'], subroots: [], pivotKey: '1'},
                    'TWO': {root: ['FULLTIME_WIN'], subroots: [], pivotKey: '2'},
                    'DRAW': {root: ['FULLTIME_WIN'], subroots: [], pivotKey: 'x'},
                    'ONE_DRAW': {root: ['FULLTIME_DBL'], subroots: [], pivotKey: '1X'},
                    'TWO_DRAW': {root: ['FULLTIME_DBL'], subroots: [], pivotKey: 'X2'},
                    'ONE_TWO': {root: ['FULLTIME_DBL'], subroots: [], pivotKey: '12'}
                },
                'TOTAL': {
                    'OVER': {root: ['FULLTIME_TTL'], subroots: ['Тотал'], pivotKey: 'бол'},
                    'UNDER': {root: ['FULLTIME_TTL'], subroots: ['Тотал'], pivotKey: 'мен'},
                },
                'T1_TOTAL': {
                    'OVER': {
                        root: ['FULLTIME_ERR'],
                        subroots: ['Инд. Тотал КОМ 1 (#PIVOT#)', 'Инд. Тотал КОМ1 #PIVOT#'],
                        pivotKey: 'бол'
                    },
                    'UNDER': {
                        root: ['FULLTIME_ERR'],
                        subroots: ['Инд. Тотал КОМ 1 (#PIVOT#)', 'Инд. Тотал КОМ1 #PIVOT#'],
                        pivotKey: 'мен'
                    },
                },
                'T2_TOTAL': {
                    'OVER': {
                        root: ['FULLTIME_ERR'],
                        subroots: ['Инд. Тотал КОМ 2 (#PIVOT#)', 'Инд. Тотал КОМ2 #PIVOT#'],
                        pivotKey: 'бол'
                    },
                    'UNDER': {
                        root: ['FULLTIME_ERR'],
                        subroots: ['Инд. Тотал КОМ 2 (#PIVOT#)', 'Инд. Тотал КОМ2 #PIVOT#'],
                        pivotKey: 'мен'
                    },
                },
                'HDP': {
                    'HOME': {root: ['FULLTIME_HAN',], subroots: ['Ф1'], pivotKey: 'К1'},
                    'AWAY': {root: ['FULLTIME_HAN',], subroots: ['Ф2'], pivotKey: 'К2'}
                },
                'CORNER_TOTAL': {
                    'OVER': {root: ['FULLTIME_TTL'], subroots: ['Тот'], pivotKey: 'Бол'},
                    'UNDER': {root: ['FULLTIME_TTL'], subroots: ['Тот'], pivotKey: 'Мен'},
                },
                /*
                'CORNER_HDP': {
                    'HOME': {root: ['FULLTIME_HAN',], subroots: ['Ф1'], pivotKey: 'К1'},
                    'AWAY': {root: ['FULLTIME_HAN',], subroots: ['Ф2'], pivotKey: 'К2'}
                },
                */
                half: {
                    'ONE_TWO': {
                        'ONE': {root: ['HALFTIME_1_WIN'], subroots: [], pivotKey: '1'},
                        'TWO': {root: ['HALFTIME_1_WIN'], subroots: [], pivotKey: '2'},
                        'DRAW': {root: ['HALFTIME_1_WIN'], subroots: [], pivotKey: 'x'},
                        'ONE_DRAW': {root: ['HALFTIME_1_DBL'], subroots: [], pivotKey: '1X'},
                        'TWO_DRAW': {root: ['HALFTIME_1_DBL'], subroots: [], pivotKey: 'X2'},
                        'ONE_TWO': {root: ['HALFTIME_1_DBL'], subroots: [], pivotKey: '12'}
                    },
                    'TOTAL': {
                        'OVER': {root: ['HALFTIME_1_TTL'], subroots: ['Тотал'], pivotKey: 'бол'},
                        'UNDER': {root: ['HALFTIME_1_TTL'], subroots: ['Тотал'], pivotKey: 'мен'},
                    },
                    /*
                    'T1_TOTAL': {
                        'OVER': {root: ['HALFTIME_1_ITL1'], subroots: ['Инд. Тотал КОМ 1'], pivotKey: 'бол'},
                        'UNDER': {root: ['HALFTIME_1_ITL1'], subroots: ['Инд. Тотал КОМ 1'], pivotKey: 'мен'},
                    },
                    'T2_TOTAL': {
                        'OVER': {root: ['HALFTIME_1_ITL2'], subroots: ['Инд. Тотал КОМ 2'], pivotKey: 'бол'},
                        'UNDER': {root: ['HALFTIME_1_ITL2'], subroots: ['Инд. Тотал КОМ 2'], pivotKey: 'мен'},
                    },
                    'HDP': {
                        'HOME': {root: ['HALFTIME_1_HAN',], subroots: ['Ф1'], pivotKey: 'К1'},
                        'AWAY': {root: ['HALFTIME_1_HAN',], subroots: ['Ф2'], pivotKey: 'К2'}
                    },
                    'CORNER_TOTAL': {
                        'OVER': {root: [''], subroots: [''], pivotKey: 0},
                        'UNDER': {root: [''], subroots: [''], pivotKey: 1},
                    },
                    'CORNER_HDP': {
                        'HOME': {root: [''], subroots: [''], pivotKey: 0},
                        'AWAY': {root: [''], subroots: [''], pivotKey: 1}
                    },
                    */
                }
            };

            let performGetStarted = Date.now();

            let report = function (success, message) {
                if (success) {
                    //console.log(message);
                    onSuccess(message);
                } else if (Date.now() - performGetStarted < 10000) {
                    setTimeout(performGet, 1000);
                } else {
                    onReject(message);
                }
            };

            if (data.time_value === 'HALF_TIME') {
                markets = markets.half;
            }

            if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
                onReject('Unsupported ' + data.time_value + '/' + data.market + '/' + data.target);
                return;
            }

            let prepareMarkets = function () {
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
            };

            prepareMarkets();

            const market = markets[data.market][data.target];
            if (data.sport === 'FOOTBALL' && data.time_value === 'FULL_TIME' && parseInt(data.pivot) === 0
                && data.market === 'HDP') {
                market.root = ['FULLTIME_WNB'];
                market.subroots = [];
                market.pivotKey = data.target === 'HOME' ? '1' : '2'
            }

            bsDebug(port, 'Market:', market);

            let performGet = function () {
                let rootProcess = function () {
                    let findPivotInRoot = function (rootIdx) {
                        let $cRoot = $(rootCandidates[rootIdx]);
                        let found = false;
                        $cRoot.find('div.outcomevalue').each(function () {
                            //console.log(`${$(this).find('small').text().trim()} === ${market.pivotKey}`);
                            if ($(this).find('small').text().trim() === market.pivotKey) {
                                report(true, $(this));
                                found = true;
                                return false;
                            }
                        });
                        if (!found) {
                            report(false, 'Not found! (2)')
                        }
                    };
                    let checkSubroots = function () {
                        let currentRoot = 0;
                        let checkOneRoot = function () {
                            let $cRoot = $(rootCandidates[currentRoot]);
                            let weFoundRoot = false;
                            for (let i in market.subroots) {
                                //console.log(market.subroots[i]);
                                if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                                    $cRoot.find('div.grouptitle').each(function () {
                                        //console.log(`${$(this).text().trim().toLowerCase()} === ${market.subroots[i].toLowerCase()}`);
                                        if ($(this).text().trim().toLowerCase() === market.subroots[i].toLowerCase()) {
                                            weFoundRoot = true;
                                            return false;
                                        }
                                    });
                                } else {
                                    $cRoot.find('div.outcomevalue').each(function () {
                                        if ($(this).find('small').text().trim() === market.subroots[i]) {
                                            let weNeedPivot = parseFloat(data.pivot);
                                            let weHavePivot = parseFloat($(this).find('b').text().trim().replace(',', '.').toString());
                                            if (!isNaN(weNeedPivot) && !isNaN(weHavePivot) && weHavePivot === weNeedPivot) {
                                                weFoundRoot = true;
                                                return false;
                                            }
                                        }
                                    });
                                }
                                if (weFoundRoot) {
                                    break;
                                }
                            }
                            if (weFoundRoot) {
                                findPivotInRoot(currentRoot);
                            } else if (currentRoot < rootCandidates.length - 1) {
                                currentRoot++;
                                checkOneRoot();
                            } else {
                                report(false, 'Not found! (1)');
                            }
                        };
                        if (market.subroots.length > 0) {
                            checkOneRoot();
                        } else if (rootCandidates.length === 1) {
                            findPivotInRoot(currentRoot);
                        }
                    };
                    checkSubroots();
                };
                let rootCandidates = [];
                for (let i in market.root) {
                    //console.log(market.root[i]);
                    let rc = $('span.groupblockplain').filter(function () {
                        return $(this).find('span.star').attr('vid') === market.root[i];
                    });
                    $.merge(rootCandidates, rc);
                }
                //console.log('roots', rootCandidates);
                if (rootCandidates.length > 0) {
                    rootProcess();
                } else {
                    report(false, 'Root candidates not found!');
                }
            };

            performGetStarted = Date.now();
            performGet();
        });
    };

    const getBetElementCupis = async data => {
        //#-#-START-CUPIS
        let $found = $([]);
        const $teams = $('div[class^="team__name-"]');
        [0, 1].forEach(i => data[`team${(i + 1)}`] = $teams.eq(i).trt());
        console.log('DATA ', data);

        const markets = {
            'TOTAL': {
                'OVER': {r: ['Основное время'], s: ['Тотал'], p: ['#PIVOT#']},
                'UNDER': {r: ['Основное время'], s: ['Тотал'], p: ['#PIVOT#']},
            },
            'T1_TOTAL': {
                'OVER': {
                    r: ['Основное время'],
                    s: ['Инд. тотал #TEAM1#'],
                    p: ['#PIVOT#']
                },
                'UNDER': {
                    r: ['Основное время'],
                    s: ['Инд. тотал #TEAM1#'],
                    p: ['#PIVOT#']
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    r: ['Основное время'],
                    s: ['Инд. тотал #TEAM2#'],
                    p: ['#PIVOT#']
                },
                'UNDER': {
                    r: ['Основное время'],
                    s: ['Инд. тотал #TEAM2#'],
                    p: ['#PIVOT#']
                },
            },
            'HDP': {
                HOME: {r: ['Основное время'], s: ['Фора'], p: ['#PIVOTH#']},
                AWAY: {r: ['Основное время'], s: ['Фора'], p: ['#PIVOTH#']},
            },
            'ONE_TWO': {
                'ONE': {r: ['Основное время'], s: ['Победитель'], p: ['1']},
                'TWO': {r: ['Основное время'], s: ['Победитель'], p: ['2']},
                'DRAW': {r: ['Основное время'], s: ['Победитель'], p: ['X']},
                'ONE_DRAW': {r: ['Основное время'], s: ['Двойной шанс'], p: ['1X']},
                'TWO_DRAW': {r: ['Основное время'], s: ['Двойной шанс'], p: ['X2']},
                'ONE_TWO': {r: ['Основное время'], s: ['Двойной шанс'], p: ['12']},
            },
        };

        if (!markets[data.market] || !markets[data.market][data.target]) {
            throw `Unsupported ${data.sport}/${data.time_value}/${data.market}/${data.target}!`;
        }

        const m = markets[data.market][data.target];
        const makePivotH = pivot => {
            const pvt = typeof pivot !== 'number' ? parseFloat(pivot) : pivot;
            const responsePvt = pvt === 0 ? pvt : Number.isInteger(pvt) ? pvt.toString() : pvt.toFixed(1);
            return responsePvt > 0 ? '+' + responsePvt.trim() : responsePvt;
        };
        const makePivot = pivot => {
            return typeof pivot !== 'number' ? parseFloat(pivot).toFixed(2) : pivot.toFixed(2);
        }
        replaceInner(m, {
            '#TEAM1#': data.team1,
            '#TEAM2#': data.team2,
            '#PIVOT#': makePivot(data.pivot),
            '#PIVOTH#': makePivotH(data.pivot),
        });

        if (data.sport === 'FOOTBALL') {
            if (data.time_value !== 'FULL_TIME') {
                m.r = ["1-й тайм"];
            }
        }

        if (data.sport === 'TENNIS') {
            if (data.market === 'T1_TOTAL') {
                    m.s = ['Инд. тотал #TEAM1# по геймам', 'Инд. тотал #TEAM1#'];
            }
            if (data.market === 'T2_TOTAL') {
                    m.s = ['Инд. тотал #TEAM1# по геймам', 'Инд. тотал #TEAM1#'];
            }
            if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) === -1) {
                const additions = {
                    'SET_1': '1-й сет',
                    'SET_2': '2-й сет',
                    'SET_3': '3-й сет',
                    'SET_4': '4-й сет',
                    'SET_5': '5-й сет',
                };
                m.r = [additions[data.time_value]];
            } else {
                m.r = ['Весь матч'];
            }
        }

        if (data.sport === 'BASKETBALL') {
            if (data.market === 'ONE_TWO') {
                    m.s = ['Победитель матча', 'Победитель'];
            }
            if (data.market === 'HDP') {
                m.s = ['Фора по очкам', 'Фора'];
            }
            if (data.market === 'TOTAL') {
                m.s = ['Тотал по очкам', 'Тотал'];
            }
            if (data.time_value !== 'FULL_MATCH') {
                const additions = {
                    'Q_1': '1-я четверть',
                    'Q_2': '2-я четверть',
                    'Q_3': '3-я четверть',
                    'Q_4': '4-я четверть',
                };
                m.r = [additions[data.time_value]];
            } else {
                m.r = ['Весь матч'];
            }
        }

        if (data.sport === 'HOCKEY') {
            if (data.time_value !== 'FULL_TIME') {
                const additions = {
                    'PERIOD_1': '1-й период',
                    'PERIOD_2': '2-й период',
                    'PERIOD_3': '3-й период',
                };

                m.r = [additions[data.time_value]];
            }
        }

        if (data.sport === 'CYBERSPORT') {
            if (data.time_value !== 'FULL_MATCH') {
                const additions = {
                    'MAP_1': '1-я карта',
                    'MAP_2': '2-я карта',
                    'MAP_3': '3-я карта',
                    'MAP_4': '4-я карта',
                };
                m.r = [additions[data.time_value]];

                if (data.market === 'ONE_TWO') {
                    m.s = ['Победитель (вкл. ОТ)', 'Победитель', 'Победитель (при ничьей - возврат)'];
                }
                if (data.market === 'HDP') {
                    m.s = ['Фора по раундам (вкл. ОТ)', 'Фора по киллам'];
                }
                if (data.market === 'TOTAL') {
                    m.s = ['Тотал раундов (вкл. ОТ)', 'Тотал по киллам'];
                }
            } else {
                m.r = ['Весь матч'];
                if (data.market === 'ONE_TWO') {
                    m.s = ['Победитель матча', 'Победитель (при ничьей - возврат)'];
                }
                if (data.market === 'HDP') {
                    m.s = ['Фора по картам'];
                }
                if (data.market === 'TOTAL') {
                    m.s = ['Тотал карт'];
                }
            }
        }

        bsDebugDouble(port, 'Market is:', m);

        for (const s of m.s) {
            const pivot = m.p[0];
            const root = m.r[0];
            const rootSel = `div[class*="header__title_"]:textEquals("${s}") + div:textEquals("${root}")`;

            if ($(rootSel).length === 0) {
                continue;
            }

            if (['ONE_TWO'].indexOf(data.market) > -1) {
                $found = $(rootSel).closest(`div[data-t-market="${s}"]`).find(`span[class*="bet-button__text_"]:textEquals("${pivot}")`);
            } else if (['TOTAL', 'T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                const $pivotEl = $(rootSel).closest(`div[data-t-market="${s}"]`).find(`div[class*="with-base__advalue_"]:textEquals("${pivot}")`);
                $found = data.target === 'OVER' ? $pivotEl.next() : $pivotEl.prev();
            } else if (['HDP'].indexOf(data.market) > -1) {
                const $pivotEl = $(rootSel).closest(`div[data-t-market="${s}"]`).find('div[class*="card__group_"]');
                $found = data.target === 'HOME' 
                    ? $pivotEl.eq(0).find(`span[class*="bet-button__text_"]:textEquals("${pivot}")`)
                    : $pivotEl.eq(1).find(`span[class*="bet-button__text_"]:textEquals("${pivot}")`)
            }

            if ($found.length > 0) {
                break;
            }
        }

        if ($found.length === 0) {
            throw `${data.sport}/${data.time_value}/${data.market}/${data.target} not found :(`;
        }

        return $found;
        //#-#-FINISH-CUPIS
    };

const closePreviousCoupons = async (state) => {
    // было: $('p[class*="header__delete-button-"]:textEquals("Очистить")')
    const $closeCoupon = $('[data-t-id="betslip-header-clear-button"]:contains("Очистить")');

    // было: () => $('button[class*="bet__remove-"]')
    const $closeBtns = () => $('button[data-t-id="betslip-bet-delete-btn"]');

    if (state) {
        for (let i=0; i<$closeBtns().length; i++) {
            if ($closeBtns().length > settings.newExpressBetsAmount) {
                await mouseChain({target: $closeBtns().last()[0], events: fullClick, error: 'closeCoupon'});
                await delayPromise(555);
            }
        }
    } else {
        await mouseChain({target: $closeCoupon[0], events: fullClick, error: 'closePreviousCoupons'});
        await delayPromise(999);
    }

    return 'Closed!';
};

    const similarCompare = (one, two) => one === two || locutus_similar_text(one, two, true) > 80;

    const openEventCupis = async bet => {
        let $event = $([]);
        const typeLink = bet.type === 'LIVE' ? 'live' : 'prematch';
        const searchBtn = 'button[class*="search-"]';
        const inputWrap = 'div[class*="search-input-"]';
        const eventsList = `section[class*="layout__search-events-"] article[data-t-event-ns="${typeLink}"]`;
        const event = [1, 2].map(i => bet[`team${i}`].trim().toLowerCase()).join(' - ');
        const checkWeAreHere = () => {
            const $teams = $('div[class^="team__name-"]');
            const eventHere = [0, 1].map(i => $teams.eq(i).text().trim().toLowerCase()).join(' - ');
            return similarCompare(eventHere, event);
        };

        const findEvent = async () => {
            if ($(inputWrap).length === 0) {
                await mouseChain({
                    target: $(searchBtn)[0],
                    events: fullClick,
                    error: 'searchBtn'
                });
                await waitForElement(inputWrap, 300, 5555);
            }

            await clearAndSimulate($(inputWrap).find('input')[0], event, false, true, false, false);
            const $eventsList = await waitForElement(eventsList, 300, 10000).catch(() => $([]));

            if ($eventsList.length === 0) {
                throw 'No events!';
            }
            
            $(eventsList).find('a[class*="event-card__link_"]').each(function () {
                const $this = $(this);
                const $teams = $this.find('div[class*="team-name_"]');
                const eventHere = [0, 1].map(i => $teams.eq(i).text().trim().toLowerCase()).join(' - ');
                if (similarCompare(eventHere, event)) {
                    $event = $this;
                    return false;
                }
            });
        };

        if (checkWeAreHere()) {
            if ($(inputWrap).length > 0) {
                await mouseChain({
                    target: $(searchBtn)[0],
                    events: fullClick,
                    error: 'searchBtn'
                });
            }

            return `We're on event!`;
        }

        await findEvent();

        if ($event.length > 0) {
            await mouseChain({target: $event[0], events: fullClick, error: '$event', scroll: true});
            await waitForCondition(() => checkWeAreHere(), 300, 20000, 'Event not opened!');
            await delayPromise(1111);
            return 'Event opened!';
        } else {
            throw 'Event not found!';
        }
    };

    const openCouponCupis = async data => {
        bsDebug(port, 'openCouponCupis:', data);
        for (const bet of data) {
            await openEventCupis(bet);
            const $el = await getBetElementCupis(bet);
            if ($el && $el.length > 0) {
                bsDebugDouble(port, 'Bet: ' + $el.text().replace($el.find('span').text(), '').trim());
                $el[0].scrollIntoView();
                await delayPromise(777);
                if (!elementIsVisible($el[0])) {
                    window.scrollBy(0, -90);
                }
                await mouseChain({target: $el[0], events: fullClick, error: '$el'});
                await delayPromise(777);
            } else {
                throw `Bet not found: ${bet.team1}/${bet.team2}`;
            }
            await delayPromise(888);
        }
    };

    /**
     * Opens coupon with stake (stakes)
     * @param {object[]} paramData - array of bets to open
     * @returns {Promise<float, string>}
     */
    const openCoupon = paramData => new Promise(function (onSuccess, onReject) {
        bsDebug(port, 'openCoupon, paramData:', paramData);
        let coefWeWaitFor = '';
        let result = function (success, message) {
            if (success) {
                let getMaxHere = function (isExpress) {
                    //bsDebug(port, 'getMaxHere: ' + isExpress);
                    if (typeof data !== 'undefined' && typeof data.doNotOpen !== 'undefined' && data.doNotOpen === true) {
                        onSuccess(1000050000);
                        return;
                    }
                    if (!isExpress) {
                        let getMaxStarted = Date.now();
                        let performGetMax = function () {
                            let max = -1;
                            let maxDraft = $('div.max').attr('title').replace(/(\r\n\t|\n|\r\t)/gm, ' ').trim().toString();
                            //bsDebug(port, 'maxDraft: ' + maxDraft + ' / ' + $('div.max').attr('title'));
                            if (maxDraft !== '') {
                                let re = /– (\d+)RUR/;
                                let res = re.exec(maxDraft);
                                //console.log(res);
                                //bsDebug(port, 'res: ' + (typeof res[1]), res);
                                if (res !== null && typeof res !== 'undefined' && typeof res[1] === 'string') {
                                    max = parseFloat(res[1]);
                                } else {
                                    bsError(port, 'getMaxHere: "' + maxDraft + '" / res:', res);
                                }
                            }
                            //bsDebug(port, 'Max is ' + max);
                            if (!isNaN(max) && max > 0) {
                                max = Math.round(max * 1000) / 1000;
                                lastMax = {
                                    max: max,
                                    coef: parseFloat(coefWeWaitFor),
                                    balance: getBalance(),
                                    currency: currency
                                };
                                onSuccess(max);
                            } else if (Date.now() - getMaxStarted > 7777) {
                                onReject('Max is NaN or 0!');
                            } else {
                                delayPromise(777).then(performGetMax);
                            }
                        };
                        performGetMax();
                    } else {
                        onSuccess(-1);
                    }
                };
                if (lData.length > 0) {
                    ourCommand.add('express', ourCommand.getAdded('express') + 1);
                    data = paramData[ourCommand.getAdded('express')];
                    bsDebug(port, 'openCoupon - We got data: ' + (typeof data), data);
                    if (typeof data !== 'undefined') {
                        openElement();
                    } else {
                        getMaxHere(true);
                    }
                } else {
                    getMaxHere(false);
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
                .then(() => {
                    bsDebug(port, 'Event and "all markets" must be opened!');
                    getBetElement(data)
                        .then(($element) => {
                            coefWeWaitFor = $element.find('b').text().replace(',', '.').trim();
                            bsDebug(port, 'We got element! Coef: ' + coefWeWaitFor);
                            $element[0].scrollIntoView();
                            //window.scrollBy(0, -110);
                            let elementWasClicked = 0;
                            let performElementClick = function () {
                                bsDebug(port, 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                                    + ') /' + (Date.now() - elementWasClicked));
                                const $tc = $element.hasClass('outcomevalue') ? $element : $element.closest('div.outcomevalue');
                                //console.log($tc);
                                mouseChain({
                                    target: $element.parent()[0],
                                    events: ['mouseover', 'mouseover', 'mousedown', 'click', 'mouseup']
                                })
                                    .then(() => {
                                        elementWasClicked = Date.now();
                                        setTimeout(waitForCouponVisible, 1000);
                                    })
                                    .catch((e) => result(false, 'Error click bet element: ' + e));
                            };
                            let checkCoupon = function () {
                                let event = (data.team1 + ' - ' + data.team2).toLowerCase();
                                let result = false;
                                let $coupon = $('#koBetsCart')
                                $coupon.find('div.cardItem' + (data.length > 1 ? '.isSelected' : '') + ':visible').each(function () {
                                    let teams = $(this).find('div.title').attr('title');
                                    if (event === teams || locutus_similar_text(event, teams, true) > 60) {
                                        result = true;
                                        bsDebug(port, 'In basket checked by coupon!');
                                        return false;
                                    }
                                });
                                return result;
                            };
                            let waitForCouponVisible = function () {
                                if (elementWasClicked === 0) {
                                    setTimeout(performElementClick, 1000);
                                } else if ($element.parent().hasClass('inbasket') || checkCoupon()) {
                                    result(true, '');
                                } else if (Date.now() - waitForCouponVisibleStarted < 15000) {
                                    setTimeout(waitForCouponVisible, 500);
                                } else {
                                    result(false, 'Element not "inbasket" or not in coupon for ' + (Date.now() - waitForCouponVisibleStarted) + 'ms')
                                }
                            };
                            let waitForCouponVisibleStarted = Date.now();
                            waitForCouponVisible();
                        })
                        .catch((e) => result(false, 'Error in getBetElement: ' + e));
                })
                .catch((e) => result(false, 'Error till open event: ' + e));
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

    const authCheck = () => {
        lastAuthCheck = Date.now();

        if (!busy && Date.now() - loaded > settings.restartEvery) {
            dLog('bigred', 'vave', 'RELOAD 1');
            window.location.reload();
        }

        if (authError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            bsError(port, 'ERROR AUTH!');
            return;
        }

        (async () => {
            let $enter = $([]);
            await closeAllWeNeed({
                'button[class*="application__cookies-warning-button-"]': 'button[class*="application__cookies-warning-button-"]',
                'button[class*="backdrop__close-button-"]:textEquals("Понятно")': 'button[class*="backdrop__close-button-"]:textEquals("Понятно")'
            });

            if (!authorized) {
                $enter = await waitForElement(loginStr, 300, 12000).catch(() => $([]));
            }

            if ($enter.length) {
                port.postMessage({m: "tech works! 2"});
                await delayPromise(333);
                await mouseChain({
                    target: $enter[0],
                    events: fullClick,
                    error: '$enter0'
                });
                await delayPromise(333);
                await tryToLogIn();
            } else {

                if (settings.lastScoreBasketball === '999') {
                    if (Date.now() - settings.sourceDate >= 300000) {
                        settings.sourceDate = Date.now();
                        settings.sourceRandom = getSourceRandom();
                         if (settings.sourceRandom >= 33 && settings.sourceRandom <= 33) {
                             settings.newExpresses = true;
                             if (settings.sourceRandom >= 33 && settings.sourceRandom <= 33) {
                                 settings.newExpressBetsAmount = 1;
                             }
                         } else {
                             waitSource = false;
                             settings.newExpresses = false;
                         }

                        dLog('blue', 'LS', `Source current random value - ${settings.sourceRandom}`);
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
                        dLog('green', 'LS', 'START find NewExpress event!');
                        // clear coupons
                        if ($coupons().length > 0) {
                            await closePreviousCoupons(false);
                        }

                        waitSource = false;
                        await ProccedExpressNew().catch((e) => {
                            dLog('red', 'LS', 'ProccedExpressNew Error - ' + e);
                            bMess('WasSuccessExpressNew').set(false);
                        });
                    }
                    busy = false;
                }

                authorized = true;
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true)
                });
            }
        })()
            .catch(e => console.log('%c' + `authCheck: ${e}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const selectLoginType = async (type) => {
        await mouseChain({
            target: $(`button[class*="menu__tab-"]:textEquals("${type}")`)[0],
            events: fullClick,
            error: 'checkTypeLogin'
        });
        await delayPromise(2222);
    };

    const tryToLogIn = async () => {
        const selectors = {};
        const checkTypeLogin = settings.login.includes("@") ? 'Email' : 'Телефон';

        if (document.location.href.indexOf('/Login') === -1) {
            await mouseChain({
                target: $(loginStr)[0],
                events: fullClick,
                error: '$enter1'
            });
        }

        await waitForElement('div[class*="sign-in-"]', 300, 12000, true);
        await selectLoginType(checkTypeLogin);

        selectors.username = checkTypeLogin === 'Email' ? 'input[name="email"]' : 'input[name="mobilePhone"]';
        selectors.password = 'input[name="password"]';
        selectors.submit = 'button:contains("Войти")';

        if (Date.now() - authClicked < 30000) {
            throw 'Too soon!';
        }
        if (!Object.values(selectors).every(s => $(s).length > 0)) {
            Object.values(selectors).forEach(s => {
                console.log('checking ' + s);
                console.log($(s).length);
            });
            throw 'No inputs for login!';
        }

        await ($(selectors.username).attr('name') === 'email'
            ? clearAndInputEmail($(selectors.username)[0], settings.login)
            : clearAndSimulate($(selectors.username)[0], settings.login.replace('+7', '')));
        await delayPromise(1222);
        await clearAndSimulate($(selectors.password)[0], settings.password);
        authClicked = Date.now();
        authClickedTimes++;
        bsDebugDouble(port, 'Auth clicked! ' + authClicked + ' / ' + authClickedTimes);
        await delayPromise(1222);
        await mouseChain({target: $(selectors.submit)[0], events: fullClick, error: 'LSub'});
        await delayPromise(555);
        $profile = await waitForElement('div[class*="profile-"]', 300, 22222).catch(() => $([]));

        if ($profile.length === 0) {
            authError = true;
        }

        return 'Must be logged in!';
    };

    function getBalance(returnNull) {
        const $balanceSel = $('a[class*="balance-"]');
        if ($balanceSel.length > 0) {
            const bText = $balanceSel.trt();
            return parseFloat(
                bText.replace(/[^\d.]/g, '').trim()
            );
        } else {
            return returnNull ? 'null' : 0;
        }
    }

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    const unloadListener = () => {
        if (ourCommand.isSet()) {
            bMess('LIGASTAVOK_COMMAND', true)
                .set(ourCommand.get(), ourCommand.getAdded('increaseDelay') ? 120000 : 0)
                .then(() => bsDebug(port, `Command was set till unload, increase: ${ourCommand.getAdded('increaseDelay')}`, ourCommand.get()));
        }
        chrome.storage.local.set({
            'LIGASTAVOK_SPECIALS': {
                limited: limited,
                authClicked: authClicked,
                authClickedTimes: authClickedTimes
            },
            'LIGASTAVOK_SPECIALS_WAS_SET': Date.now()
        });
    };

    addEventListener("unload", unloadListener);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});
        bMess('LIGASTAVOK_COMMAND', true).check(30000, true)
            .then(currentCommand => {
                bsDebug(port, 'Restoring with: ', currentCommand);
                messageProcessor(currentCommand);
            })
            .catch(e => console.log(e));
        cupisMode = document.location.href.indexOf('ligastavok.ru/') > -1;
        console.log('%c' + `LIGA loaded ${cupisMode}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    }

})();
