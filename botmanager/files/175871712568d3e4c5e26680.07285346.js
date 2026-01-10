"use strict";

(function () {

    let authClicked = 0;
    let increaseDelay = false;
    let busy = false;
    let port = chrome.runtime.connect({name: "port_olimpcupis"});
    let sourceExpress = false;
    let waitSource = false;
    let settings = {
        authCheckInterval: 2000,
        url: 'https://www.olimp.bet/live',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 3,
        betweenBets: 25000,
        newExpresses: false,
        source: {
            X: 477,
            Y: 478,
            Z: 479,
        },
        sourceRandom: 0,
        sourceDate: 0,
    };

    let newAPI = false;
    let ourCommand = new ourCommandProto();
    let enterError = false;
    let lastMax = -1;
    let smsApiMessage;
    let lastSMS = '';
    let wasAuthCheck = false;
    let tryLogin = 0;

    let messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        }
        if (message.action === 'CHECK_LIMITED') {
            waitForCondition(() => !busy, 333, 600000, 'still busy')
                .then(async () => {
                    busy = true;
                    ourCommand.set(message);
                    await checkLimited().catch(e => dLog('red', 'Olimp',
                        `Error till checkLimited ${e}, ${formatStack(e.stack)}`));
                    busy = false;
                    ourCommand.clear();
                })
                .catch(e => dLog('red', 'Olimp', `Error till CHECK_LIMITED ${e}, ${formatStack(e.stack)}`));
            return;
        }

        if (message.action === 'SMS') {
            lastSMS = message.data;
        } else if (message.action === 'SMS_API' && typeof message.data !== 'undefined') {
            smsApiMessage.setMessage(message.data.status, message.data.message);
        } else if (message.action !== 'auth' && busy) {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY"
            });
        } else if (message.action === "auth") {
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.phone = message.phone;
            settings.uid = message.uid;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            settings.lastScoreBasketball = message?.stake_fork?.lastScoreBasketball || '';
            settings.newExpresses = !!(settings?.stake_fork && settings.stake_fork?.newExpresses);
            settings.newExpressBetsAmount = Number(message?.stake_fork?.newExpressBetsAmount) || 2;

            if (settings.lastScoreBasketball === '999') {
                settings.sourceDate = Date.now();
                settings.sourceRandom = getSourceRandom();

                if (settings.sourceRandom >= 17 && settings.sourceRandom <= 18) {
                    settings.newExpresses = true;
                    waitSource = true;
                    if (settings.sourceRandom >= 18 && settings.sourceRandom <= 18) {
                        settings.newExpressBetsAmount = 1;
                    }
                } else {
                    waitSource = false;
                }
                dLog('blue', 'Olimp', `Source current random value - ${settings.sourceRandom}`);
            }

            wasAuthCheck = true;
            smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);
            authCheck();
        } else if (['EXPRESS_BET', 'BET'].indexOf(message.action) > -1) {
            if (waitSource) {
                port.postMessage({
                    answered: message.action,
                    status: "error",
                    answer: "BUSY"
                });
            } else {
                // Hint: execute command
                busy = true;
                ourCommand.set(message);
                proceedBet(message.data)
                    .then(() => bsDebug(port, "It's looks like BET(EXPRESS) done!"))
                    .catch((e) => bsError(port, 'Error till BET(EXPRESS): ' + e))
                    .finally(() => {
                        busy = false;
                        ourCommand.clear();
                    });
            }
        } else if (message.action === 'DEPOSIT') {
            busy = true;
            ourCommand.set(message);
            processDeposit(message.data)
                .then(() => bsDebug(port, "It's looks like deposit done!"))
                .catch((e) => bsError(port, 'Error till deposit: ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                });
        } else if (message.action === 'WITHDRAW') {
            busy = true;
            ourCommand.set(message);
            processWithdraw(message.data)
                .then(() => bsDebug(port, "It's looks like withdraw done!"))
                .catch((e) => bsError(port, 'Error till withdraw: ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                });
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
                        target: $('a[href="/live"]')[0],
                        events: ['click'],
                        error: 'Go to live!',
                    }).catch(e => console.log('%c' + e, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'));
                });
        }
    };

    const getSourceRandom = () => {
        return Math.floor(Math.random() * 30) + 1;
    };

    const getCurrentSource = src => {
        sourceExpress = false;

        if (src >= 1 && src <= 10) {
            return 'X';
        }
        if (src >= 11 && src <= 14) {
            return 'Y';
        }
        if (src >= 17 && src <= 17) {
            sourceExpress = true;
            return 'XY';
        }
        if (src >= 18 && src <= 18) {
            return 'XY';
        }
        if (src >= 19 && src <= 20) {
            return 'Z';
        }

        return 'skip';
    };

    const $coupons = () => $('div[class^="card-"]');

    const checkLimited = async () => {
        const coefSel = 'span[class^="styled__Koef"]';
        const $to = () => $('span.container:textStartsI("Тотал ("):contains("бол")');
        const $tm = () => $('span.container:textStartsI("Тотал ("):contains("мен")');
        const next = async () => {
            ourCommand.add('checking', checking + 1);
            await selectLive();
            await delayPromise(3000);
            return await checkLimited();
        };
        const checking = ourCommand.getAdded('checking', 0);
        dLog('', 'OC', `checking: '${checking}'`);
        const $teams = $('div.name');
        let eventHere = '';
        if ($teams.length !== 2) {
            eventHere = $('span.info__text').trt();
        } else {
            eventHere = `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}`.toLowerCase();
        }
        if (eventHere !== '') {
            // Hint: we're on event, could check
            if ($to().length === 0 || $tm().length === 0) {
                return await next();
            }
            const m = 1 / parseFloat($to().find(coefSel).trt()) + 1 / parseFloat($tm().find(coefSel).trt());
            dLog('', 'OC',
                `over: '${$to().find(coefSel).trt()}', under: '${$tm().find(coefSel).trt()}', m: '${m}'`);
            if (isNaN(m) || m === 0) {
                return await next();
            }
            port.postMessage({
                answered: 'CHECK_LIMITED',
                limited: m > 1.1,
                answer: m > 1.1 ? `Margin is ${m} > 1.1` : 'FREE',
            });
            return m > 1.1;
        } else {
            // Hint: we're on live, need event
            if ($('div[class^="sport-select__CurrentRow-"] span:first-child').text().trim()
                !== 'Все виды спорта') {
                await mouseChain({
                    target: $('div[class^="sport-select__"]').parent().parent()
                        .find('span[role="button"]')[0],
                    events: fullClick,
                    error: 'sportSel'
                });
                await delayPromise(200);
                const $el = await waitForElement('a:has(span:textEquals("Все виды спорта"))',
                    333, 5000, true);
                await delayPromise(200);
                await mouseChain({target: $el[0], events: fullClick, error: 'asts'});
                await delayPromise(2000);
            }
            await mouseChain({
                target: $('div[class^="styled__Matches"] a[class^="default__Link"]:visible').eq(checking)[0],
                events: fullClick, error: 'event',
            });
            await delayPromise(3000);
            return await checkLimited();
        }
    };

    const processDepositCupis = async (data) => {
        const sendReport = (success, message, balance) => {
            bsDebug(port, 'Report! ' + success + ' / ' + message);
            increaseDelay = false;
            ourCommand.add('qiwiEntered', false);
            port.postMessage({
                answered: "DEPOSIT",
                status: success ? 'SUCCESS' : ['NO_FUNDS'].find(t => message.indexOf(t) > -1) || 'FAILED',
                answer: message,
                balance: getBalance(true),
                wallet_balance: parseFloat(balance),
            });

            if (!success) {
                if (typeof balance === 'undefined') {
                    throw message;
                } else {
                    throw [message];
                }
            }
        };
        const getDepositResult = async () => {
            const depositResult = await bMess('DEPOSIT_RESULT', true).get(120000, 60000);
            if (typeof depositResult.success === 'boolean') {
                const message = typeof depositResult.message === 'string' ? depositResult.message : 'No message :(';
                let wallet_balance = depositResult.balance ? parseFloat(depositResult.balance) : 0;
                if (wallet_balance > 0) {
                    const calculate_balance = wallet_balance - parseFloat(data.amount);
                    wallet_balance = calculate_balance < 0 ? wallet_balance : calculate_balance;
                }
                sendReport(depositResult.success, message, wallet_balance);
                return message;
            } else {
                throw `Wrong answer: ${JSON.stringify(depositResult)}`;
            }
        };
        return await (async () => {
            const $userBar = $('div[class^="user-bars__WrapUser-sc-"] a');
            if (ourCommand.getAdded('qiwiEntered') === true) {
                return await getDepositResult();
            } else if ($userBar.length > 0) {
                const leftUserMenu = 'div.user div[class^="styled__MenuAccount-sc-"]'
                await mouseChain({target: $userBar[0], events: fullClick, error: 'user bar is not exist!'});
                await delayPromise(2222);
                await waitForElement(leftUserMenu, 333, 7777);
                await delayPromise(555);
                const $replenishBalance = $(leftUserMenu).find('a[class^="styled__MenuItemLink-sc-"][href="/user/replenishment"]');
                // select replenishBalance if it's not active
                if (!$replenishBalance.hasClass('active')) {
                    await mouseChain({
                        target: $replenishBalance[0],
                        events: fullClick,
                        error: 'can\'t click replenish balance link!'
                    });
                    await delayPromise(2222);
                }
                const $qiwiButton = $('button[data-pay-type="qiwi"]');
                // select qiwi tab if it's not active
                if (!$qiwiButton.hasClass('active')) {
                    await mouseChain({
                        target: $qiwiButton[0],
                        events: fullClick,
                        error: 'can\'t select qiwi tab!'
                    });
                    await delayPromise(2222);
                }
                const $am = await waitForElement('input[name="sum"]', 300, 5000, false, 1, 'Amount el is not available!');
                await clearAndSimulate($am[0], data.amount);
                await delayPromise(1000);
                // check amount
                if (parseInt($am.val()) < 100) throw 'the amount is less than 100!';
                increaseDelay = true;
                ourCommand.add('qiwiEntered', true);
                await bMess('QIWI_COMMAND', true).set(ourCommand.get());
                await mouseChain({
                    target: $('button:contains("Подтвердить")')[0],
                    events: fullClick,
                    error: 'can\'t click apply sum button!'
                });
                await delayPromise(2222);
                return await getDepositResult();
            } else {

                throw 'user bar is not available!';
            }
        })().catch(e => {
            if (typeof e === 'string') {
                sendReport(false, 'Deposit: ' + e)
            } else {
                throw 'Deposit: ' + e[0];
            }
        });
    };

    const processWithdrawCupis = async (data) => {

        bsDebug(port, 'settings! -  ', settings);

        if (typeof settings.phone !== 'string' || settings.phone === ''
            || typeof settings.uid !== 'string' || settings.uid === '') {
            throw 'There is no phone or websocket_uid!';
        } else if (!ourCommand.getAdded('sms_api_request_id')) {
            await bsBindNumber(port, settings, smsApiMessage, ourCommand);
        }

        const $userBar = $('div[class^="user-bars__WrapUser-sc-"] a');
        if ($userBar.length > 0) {
            const leftUserMenu = 'div.user div[class^="styled__MenuAccount-sc-"]'
            await mouseChain({target: $userBar[0], events: fullClick, error: 'user bar is not exist!'});
            await delayPromise(2222);
            await waitForElement(leftUserMenu, 333, 7777);
            await delayPromise(555);
            const $getWithdraw = $(leftUserMenu).find('a[class^="styled__MenuItemLink-sc-"][href="/user/withdraw"]');
            if (!$getWithdraw.hasClass('active')) {
                await mouseChain({
                    target: $getWithdraw[0],
                    events: fullClick,
                    error: 'can\'t click withdraw link!'
                });
                await delayPromise(2222);
            }
            const $qiwiButton = $('button[data-pay-type="qiwi"]');
            // select qiwi tab if it's not active
            if (!$qiwiButton.hasClass('active')) {
                await mouseChain({target: $qiwiButton[0], events: fullClick, error: 'can\'t select qiwi tab!'});
                await delayPromise(2222);
            }
            const $am = await waitForElement('input[name="sum"]', 300, 5000, false, 1, 'Amount el is not available!');
            await clearAndSimulate($am[0], data.amount);
            await delayPromise(1000);
            // check amount
            if (parseInt($am.val()) < 100) throw 'the amount is less than 100!';
            await mouseChain({
                target: $('button:contains("Подтвердить")')[0],
                events: fullClick,
                error: 'can\'t click apply sum button!'
            });
            await delayPromise(3333);
            let code = '', error = false;
            code = await smsApiMessage.waitForSMSCode(['OLIMP', 'CUPIS'], 'Kod: ',
                m => m.replace(/[^\d]/g, '').trim(), 120000).catch((e) => error = e);
            if (error) throw 'Get sms code failed - ' + error;
            // enter code
            const $formSms = $('div#modal-root').find('form:contains("Для завершения платежной операции введите код из смс")');
            if ($formSms.length === 0) throw 'sms code form is not available!';
            await clearAndSimulate($('div#modal-root').find('input[class^="common-input__CommonInput-sc-"]')[0], code);
            await delayPromise(555);
            await mouseChain({
                target: $('div#modal-root').find('button[class^="common-button__CommonButton-"]:contains("Подтвердить")')[0],
                events: ['click'],
                error: 'send_code'
            });
            await delayPromise(2222);
            const $toHistoryWindow = $('div#modal-root').find('span:contains("Ваш запрос на вывод передан в обработку")');
            if ($toHistoryWindow.length === 0) throw 'to history success form is not available!';
            await mouseChain({
                target: $('div#modal-root').find('button[class^="common-button__CommonButton-"]:contains("Перейти к истории операций")')[0],
                events: ['click'],
                error: 'to_history'
            });
            await delayPromise(5555);
            return 'All seems to be Okay :) Balance is - ' + getBalance(true);
        } else {
            throw 'user bar is not available! ';
        }
    };

    const processDeposit = async (data) => {
        bsDebug(port, `processDeposit`, data);
        let success = true;
        const result = await processDepositCupis(data)
            .catch(e => (console.log('%c' + `processDeposit: ${e}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'),
                success = false, e));
        if (!success) {
            throw result;
        }
        return result;
    };

    const processWithdraw = async (data) => {
        bsDebug(port, `processWithdraw`, data);
        let error = false;
        const res = await processWithdrawCupis(data).catch(e => (error = true, `Withdraw: ${e}, ${formatStack(e.stack)}`));
        port.postMessage({
            answered: "WITHDRAW",
            status: !error ? "SUCCESS" : "FAILED",
            answer: res
        });
        bsSendSmsApi(port, 'BIND_RELEASE', {
            "websocket_uid": settings.uid,
            "request_id": ourCommand.getAdded('sms_api_request_id')
        });
        if (error) {
            throw error;
        }
    };

    const goToHistory = async () => {
        if (window.location.href.indexOf('user/history') > -1) {
            return 'We already here!';
        } else {
            const $historyBtn = $('button span:textEquals("История")');
            if ($historyBtn.length > 0) {
                if (!$historyBtn.closest('button').hasClass('active')) {
                    await mouseChain({
                        target: $historyBtn[0],
                        events: fullClick,
                        error: 'historyBtn'
                    });
                    await delayPromise(555);
                }
                const $calculatedBtn = await waitForElement('button:textEquals("Рассчитанные")', 333, 5555);
                if ($calculatedBtn.length > 0) {
                    await mouseChain({
                        target: $calculatedBtn[0],
                        events: fullClick,
                        error: 'historyBtn'
                    });
                    await delayPromise(555);
                }
                const $fullHistoryBtn = await waitForElement('button:textEquals("Полная история ставок")', 333, 5555);
                if ($fullHistoryBtn.length > 0) {
                    await mouseChain({
                        target: $fullHistoryBtn[0],
                        events: fullClick,
                        error: 'fullHistoryBtn'
                    });
                    await delayPromise(555);
                } else {
                    throw 'fullHistoryBtn is not available!';
                }
            } else {
                throw 'historyBtn is not exist!';
            }
        }
    };

	const collectBet = async bet => {
        await delayPromise(999);
        let external_id = '';
        let coef = '';
        let stake = '';
        let result = '';
        let status = 'ACCEPTED';
        let stateValues = {
            'Выигрыш с частичным возвратом': 'WON',
            'Выиграл': 'WON',
            'Проигрыш с частичным возвратом': 'LOSE',
            'Проиграл': 'LOSE',
            'Возврат': 'REFUNDED',
            'Отменена': 'CANCELLED'
        };

        let state = stateValues[bet.children().eq(5).children().first().trt().replace(/[^а-яёА-ЯЁ ]/g,"").trim()];
        if (state) {
            status = state;
        }
        external_id = bet.children().eq(1).html().split('<br>')[0].replace(/[^\d]/g, '').trim();
        coef = bet.children().eq(3).trt();
        stake = bet.children().eq(4).trt().replace(/[^\d.]/g, '').trim();

        if (status !== 'ACCEPTED') {
            if (status === 'WON') {
                result = Math.round(parseFloat(coef) * parseFloat(stake)).toString();
            }
            if (status === 'REFUNDED') {
                result = stake;
            }
        }

        return {external_id, status, coef, stake, result};
    };

    const collectBetResultsCupis = async data => {
        let limit = 20;
        if (data.length === 2 && data[0] === 'limit') {
            limit = parseInt(data[1]);
            data = [];
        }
        const collected = [];
        //go to history page
        await goToHistory();
        const $historyHeadPage = await waitForElement('h3:textEquals("История ставок"):visible', 333, 5555);
        if ($historyHeadPage.length > 0) {
            await delayPromise(2222);
            let i = 0;
            await $('div[class*="item-"]').eachAsync(async function () {
                if (data.length > 0) {
                    // get id
                    const localId = $(this).children().eq(1).html().split('<br>')[0].replace(/[^\d]/g, '').trim();
                    if (data.indexOf(localId) > -1) {
                        collected.push(await collectBet($(this)));
                    }
                } else {
                    collected.push(await collectBet($(this)));
                }
                i++;
                if (i >= limit) {
                    return false;
                }
            });
        }
        return collected;
    };

    const collectBetResults = async data => {
        let error = '';
        const res = await collectBetResultsCupis(data)
            .catch(e => (error = e, []));
        bsDebug(port, `collectBetResults (${error}): `, res, data);
        port.postMessage({
            answered: "BET_RESULT",
            status: error.length === 0 ? "success" : "error",
            answer: error.length === 0 ? res : error,
        });
        if (error) throw error;
        return res;
    };

    const authCheck = () => {
        if (enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            bsError(port, "ERROR AUTH!");
            return;
        }
        (async () => {
            await closeAllWeNeed({
                'div[class^="styled__OuterWrap-sc-"] div.close': 'div[class^="styled__OuterWrap-sc-"] div.close',
                'button[class*="cookiesAction-"]': 'button[class*="cookiesAction-"]',
            });

            const authBtn = 'button[data-qa="authorizedButton"]:textEquals("Вход")';
            const loginFrm = 'div#modal-root div:textEquals("Войти в аккаунт")';
            await waitForElement('span[title="Пополнить баланс"]', 333, 5222).catch(() => $([]));

            if ($(loginFrm).length > 0) {
                await delayPromise(555);
                await tryToLogIn();
            } else if ($(authBtn).length > 0) {
                await delayPromise(555);
                await mouseChain({
                    target: $(authBtn)[0],
                    events: fullClick,
                    error: "can't click login button",
                });
                await waitForElement(loginFrm, 333, 7555);
                await tryToLogIn();
            } else {
                if (settings.lastScoreBasketball === '999') {
                    if (Date.now() - settings.sourceDate >= 300000) {
                        settings.sourceDate = Date.now();
                        settings.sourceRandom = getSourceRandom();
                        if (settings.sourceRandom >= 15 && settings.sourceRandom <= 18) {
                            settings.newExpresses = true;
                            if (settings.sourceRandom >= 15 && settings.sourceRandom <= 16) {
                                settings.newExpressBetsAmount = 1;
                            }
                        } else {
                            waitSource = false;
                            settings.newExpresses = false;
                        }

                        dLog('blue', 'Olimp', `Source current random value - ${settings.sourceRandom}`);
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
                        dLog('green', 'Olimp', 'START find NewExpress event!');
                        // clear coupons
                        if ($coupons().length > 0) {
                            await closePreviousCoupons(false);
                        }

                        waitSource = false;
                        await ProccedExpressNew().catch((e) => {
                            dLog('red', 'Olimp', 'ProccedExpressNew Error - ' + e);
                            bMess('WasSuccessExpressNew').set(false);
                        });
                    }
                    busy = false;
                }

                const $balanceSel = $('span[title="Пополнить баланс"]');
                if ($balanceSel.length > 0) authClicked = 0;
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch((e) =>
                console.log(
                    "%c" + `authCheck: ${e}`,
                    "background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;"
                )
            )
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const switchPrematchLive = async data => {
        const typeLine = data.type === 'LIVE' ? 'a[href="/live"]:textEquals("Лайв")' : 'a[href="/line"]:textEquals("Линия")';
        
        await mouseChain({
            target: $(typeLine)[0],
            events: fullClick,
            error: 'can\'t click type'
        });
        await waitForElement('div.globalCompetitionSticky', 222, 18888, true);
        await delayPromise(777);
    };

    const switchCouponsBox = async () => {
        if ($('button span:textEquals("История")').closest('button').hasClass('active')) {
            await mouseChain({
                target: $('button span:textEquals("Корзина")')[0],
                events: fullClick,
                error: 'click box'
            });
            await delayPromise(555);
        }
        return 'switched box';
    };

    const ProccedExpressNew = async () => {
        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));
        const currentBets = [];
        const $coefs = () => $('button[class*="outcome-"]:visible').not('[class*="disabled-"]');

        // select line - 6h
        await mouseChain({target: $('div[class*="navigation-"] a[href="/line"]')[0], events: fullClick, error: 'LINE'});
        await delayPromise(777);
        await waitForElement('button[class*="tab-"]:textEquals("6ч")', 222, 8888, true);
        await delayPromise(777);
        await mouseChain({target: $('button[class*="tab-"]:textEquals("6ч")')[0], events: fullClick, error: '6h'});
        await waitForElement('div.globalEventSticky', 222, 8888, true);
        await delayPromise(777);

        // expand not stickyEvents
        const $notStickyEventsNow = $('div[data-testid="sportHead-Футбол"]').parent().find('div.globalCompetitionSticky').not('[class*="sticky-"]');
        for (let index = 0; index < $notStickyEventsNow.length; index++) {
            await mouseChain({target: $notStickyEventsNow.eq(index).find('svg[class*="arrowIcon-"]')[0], events: fullClick, error: 'EXPAND'});
            await delayPromise(1111);
        }

        const findOption = coef => {
            return isNaN(coef) ? false : coef >= 1.02 && coef <= 1.4;
        };

        const getUniqueRandomNumber = (length) => {
            return Math.floor(Math.random() * length);
        }

        do {
            const randomCoef = getUniqueRandomNumber($coefs().length);
            const eventName = $coefs().eq(randomCoef)
                .closest('div[data-testid*="lineEvent-"]')
                .find('span[class*="name-"]').toArray()
                .map(el => $(el).trt()).join(' - ');

            if (currentBets.indexOf(eventName) > -1) {
                continue;
            }

            if (eventName.length < 5) {
                dLog('red', 'Olimp', `'${eventName}' is too short - ${eventName.length}`);
                continue;
            }

            if (used[eventName] >= 1) {
                dLog('big-yellow', 'Olimp', `${eventName} used ${used[eventName]} times!`);
                continue;
            }

            if (
                $coefs().eq(randomCoef)
                .is('[class*="active-"]')
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
            dLog('green', 'Olimp', [`We get selected bets: '${currentBets}', now used:`, used]);
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

    const proceedBetCupis = async data => {
        bsDebug(port, `proceedBetCupis`, data);
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
            const checkRes = await eventsWorkAll('olimp',
                settings.eventMaxBets, settings.eventTimeLimit,
                data, false, true);
            if (checkRes !== 'OK') {
                dLog('red', 'Olimp', `We got errors: ${checkRes}`);
                throw checkRes;
            } else {
                dLog('big-blue', 'Olimp',
                    `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                for (const d of data) {
                    const eventName = `${d.team1} - ${d.team2}`;
                    dLog('blue', 'Olimp', `${settings.eventMaxBets} for ${eventName} not reached`);
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

        await switchCouponsBox();
        await closePreviousCoupons(settings.newExpresses ? true : false);

        //check if left menu expanded
        if ($('button[data-qa="sportEventsExpandButton"] svg[class*="expand-"]').length > 0) {
            await mouseChain({
                target: $('button[data-qa="sportEventsExpandButton"] svg[class*="expand-"]')[0],
                events: fullClick,
                error: 'left menu expand'
            });
            await delayPromise(1777);
        }

        //if sourceExpress check coupon for events
        if (sourceExpress && settings.lastScoreBasketball === '999') {
            if ($coupons().length !== 1) {
                throw 'Error Express source BET, No 1 event in coupon!';
            }
        }

        await openCoupon(data);

        if (settings.newExpresses && $coupons().length < settings.newExpressBetsAmount + 1) {
            throw `less than ${settings.newExpressBetsAmount + 1} events in the newExpresses`;
        }

        lastMax = await getMax(data);
        let willPlace = parseFloat(data[0].stake);
        if (willPlace > lastMax) {
            willPlace = lastMax;
        }
        const $balance = $('span[title="Пополнить баланс"]');
        if ($balance.length > 0) {
            const balance = parseFloat($balance.trt().replace(/[^\d]/g, ''));
            if (isNaN(balance)) {
                throw 'Get balance error';
            } else if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        } else {
            throw 'Balance selector is not exist!';
        }
        await checkCoefs(data);
        await delayPromise(555);
        const $inputStake = $('input[type="tel"]');
        if ($inputStake.length > 0) {
            await clearAndSimulate($inputStake[0], willPlace);
            await delayPromise(400);
        } else {
            throw 'Input stake element is not exist!';
        }
        const $buttonSbmt = $('button:textEquals("Сделать ставку")');
        if ($('div[class^="error-"]').length > 0) {
            throw `${$('div[class^="error-"]').trt()}`;
        }
        if ($('div[class^="singleErrorMessage-"]').length > 0) {
            throw `${$('div[class^="singleErrorMessage-"]').trt()}`;
        }
        if ($buttonSbmt.length > 0) {
            await mouseChain({target: $buttonSbmt[0], events: fullClick, error: 'buttonSbmt'});
        } else {
            throw 'Submit button is not exist!';
        }
        // wait for accepting coupons
        await waitForCondition(() => {
            if ($('span:textEquals("Ваша ставка успешно принята!")').length > 0) {
                console.log('success!');
                return true;
            } else {
                return false;
            }
        }, 200, 30000, 'coupons not accepted for 30s');
        await delayPromise(888);
        return goBetsStats(data);
    };

    const proceedBet = async data => {
        let success = true;

        const result = await proceedBetCupis(data)
            .catch(e => (console.log('%c' + `proceedBet: ${e}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'),
                success = false, e));
        const resultData = {
            "external_id": success ? result.externalId : '',
            "status": success
                ? 'ACCEPTED'
                : ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED'].find(c => typeof result === 'string' && result.indexOf(c) > -1) || 'FAILED',
            "market": data[0].market === 'DRAW_NO_BET' ? 'HDP' : data[0].market,
            "target": data[0].target,
            "pivot": data[0].pivot,
            "coef": success ? String(result.odd) : data[0].coef,
            "stake": success ? String(result.stake).replace(/[^\d]/g, '') : data[0].stake,
            "maximum": '88888'
        };

        if (success) {
            await eventsWorkAll('olimp',
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

                dLog('Olimp', 'blue-big',
                    [`We set bet with first: '${currentFirstBet}', now used:`, used]);

                if (settings.newExpressBetsAmount > 1) {
                    const currentSecondBet = await bMess('currentSecondBet').check(1080000, true);
                    if (!used[currentSecondBet]) {
                        used[currentSecondBet] = 1;
                    }

                    dLog('Olimp', 'blue-big',
                    [`We set bet with second: '${currentSecondBet}', now used:`, used]);
                }

                await bMess('usedEvents').set(used);
            }
        }
        const doNotSend = !!data[0].betFromParser && !success && resultData.status !== 'LIMITED';
        if (!!data[0].betFromParser && resultData.status !== 'LIMITED') {
            resultData.type = 'VALUE';
            resultData.mode = data[0].type;
            resultData.bookmaker = 'OLIMP.CUPIS';
            resultData.placedCoef = resultData.coef;
            resultData.coef = data[0].coef;
            resultData.source = '477' || 'oddscp';
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
            answer: success ? 'Everything is Okay!' : result,
            doNotSend,
        });

        bsDebug(port, `Result data (${success}): `, resultData);

        if (!success) {
            throw result;
        }
        return result;
    };

    const goBetsStats = async (data) => {
        const $historySdbr = $('button span:textEquals("История")');
        if ($historySdbr.length > 0) {
            await mouseChain({
                target: $historySdbr[0],
                events: fullClick,
                error: 'couponSbtnHis'
            });
            await delayPromise(555);
            await waitForElement('div[class^="mobileCard-"]',333, 7555);
            const lastBet = 'div[class^="mobileCard-"]:eq(0)';

            // if ($(lastBet).find('div[class*="active-"]').length === 0) {
            //     await mouseChain({
            //         target: $(lastBet).find('div.accordionHead')[0],
            //         events: fullClick,
            //         error: 'accordionHead'
            //     });
            //     await delayPromise(999);
            // }

            let externalId = $(lastBet).find('span[class^="number-"]').trt().replace(/[^\d]/g, '');
            let odd = $(lastBet).find('span[class^="typeLine-"] span').trt();
            let stake = $(lastBet).find('span[class*="sumText-"]').trt();
            return {externalId, odd, stake};
        } else {
            throw 'history sidebar is not exist!';
        }
    };

    const checkCoefs = async (data) => {
        let findInData = function (match) {
            let result = false;
            $.each(data, function () {
                let localMatch = this.team1.toLowerCase() + ' - ' + this.team2.toLowerCase();
                if (localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 90) {
                    result = this;
                    return false;
                }
            });
            return result;
        };

        let errors = [];
        let checked = 0;
        let totalCoef = 1;
        const $couponsCoefs = (data.length === 1 && settings.newExpresses === true)
            ? $coupons().last()
            : $coupons();

        $couponsCoefs.eachAsync(async function () {
            let $this = $(this);
            let match = $this.find('div[class^="name-"]:eq(0)').trt() + ' - ' + $this.find('div[class^="name-"]:eq(1)').trt();
            if ($this.find('div:textEquals("Прием ставок временно приостановлен")').length > 0) {
                errors.push(match + ' LOW_COEF, match is locked!');
                checked++;
                return false;
            }
            if ($this.find('div:textEquals("Зависимое событие")').length > 0) {
                errors.push(match + ' LOW_COEF, match is locked!');
                checked++;
                return false;
            }
            let localCoef = parseFloat($(this).find('span[data-testid*="betCardCoeff-"]').trt());
            let localData = findInData(match);
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if (!newAPI && localData !== false && localData.coef !== '' && !isNaN(localCoef)) {
                let checkCoef = parseFloat(localData.coef);
                if (!isNaN(checkCoef) && (checkCoef - localCoef) > 0.22) {
                    errors.push(' LOW_COEF: Tried to bet 0');
                } else if (isNaN(checkCoef) || checkCoef > localCoef) {
                    errors.push(match + ' LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef);
                }
                checked++;
            } else if (localData === false || isNaN(localCoef)) {
                errors.push(match + ' LOW_COEF - wrong match or localCoef!');
                checked++;
            } else if (localData.coef === '' || newAPI) {
                checked++;
            }
        });
        if (data.length > 1) totalCoef = $('div[class^="totalValue-"]').trt();
        if (!newAPI && errors.length === 0 && checked === data.length) {
            return 'Coefs fine!';
        } else if (newAPI && errors.length === 0 && checked === data.length) {
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
            if (totalCoef >= nCheck * 1.2) {
                throw 'Coef TOO BIG: ' + totalCoef + ' instead of ' + data[0].coef;
            } else if (totalCoef < nCheck) {
                throw 'LOW_COEF ' + data[0].coef + ' > ' + totalCoef;
            } else {
                bsDebug(port, 'Coefs fine!');
                return 'Coefs fine!';
            }
        } else {
            throw (errors.join('; ') + (checked !== data.length ? ' some stakes not checked ('
                + checked + '/' + data.length + ')!' : ''));
        }
    };

    const getMax = async (data) => {
        const $maxEl = await waitForElement('div[class^="singleMaxSum-"] div',333,3555).catch(() => $([]));
        let max = 0;
        if ($maxEl.length > 0) {
            max = $maxEl.trt().replace(/[^\d]/g, '');
            if (!isNaN(max) && max > 0) {
                return Math.round(max * 1000) / 1000;
            } else {
                throw 'Max is NaN or 0!';
            }
        } else {
            return 7777777;
        }
    };

    const closePreviousCoupons = async (state) => {
        const $couponsSel = $('button:textEquals("Система")').next();

        if (state) {
            for (let i=0; i<$coupons().length; i++) {
                if ($coupons().length > settings.newExpressBetsAmount) {
                    await mouseChain({
                        target: $coupons().last().find('button[class*="closeBet-"]')[0], 
                        events: fullClick, 
                        error: 'closeCoupon'
                    });
                    await delayPromise(888);
                }
            }
        } else {
            if ($couponsSel.length > 0) {
                await mouseChain({
                    target: $couponsSel[0],
                    events: fullClick,
                    error: 'Clear coupons'
                });
                await delayPromise(333);
            }
        }

        return 'Closed!';
    };

    const openCoupon = async data => {
        bsDebug(port, 'openCoupon:', data);
        for (const bet of data) {
            await openEvent(bet);
            dLog('green', 'OC', 'Event must be opened!');
            await delayPromise(555);
            const $el = await getBetElementCupis(bet);
            await mouseChain({target: $el[0], events: fullClick, error: 'Error click bet element'});
            await waitForElement('div[class^="bets--"]', 333, 4444);
            await delayPromise(555);
        }
    };

    const getBetElementCupis = async data => {
        let markets = {
            'ONE_TWO': {
                'ONE': {root: ['Основные'], subroots: [], pivotKey: 'П1'},
                'DRAW': {root: ['Основные'], subroots: [], pivotKey: 'Х'},
                'TWO': {root: ['Основные'], subroots: [], pivotKey: 'П2'},
                'ONE_DRAW': {root: ['Основные'], subroots: [], pivotKey: '1Х'},
                'TWO_DRAW': {root: ['Основные'], subroots: [], pivotKey: 'Х2'},
                'ONE_TWO': {root: ['Основные'], subroots: [], pivotKey: '12'}
            },
            'TOTAL': {
                'OVER': {
                    root: ['Тотал', 'Азиатские тоталы'], subroots: [],
                    pivotKeys: ['Больше (#PIVOT#)', 'Больше (#PIVOTR#)', 'Больше (#PIVOTR2#)']
                },
                'UNDER': {
                    root: ['Тотал', 'Азиатские тоталы'], subroots: [],
                    pivotKeys: ['Меньше (#PIVOT#)', 'Меньше (#PIVOTR#)', 'Меньше (#PIVOTR2#)']
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    root: ['Индивидуальный тотал'], subroots: [],
                    pivotKeys: ['Больше (#PIVOT#)', 'Больше (#PIVOTR#)', 'Больше (#PIVOTR2#)']
                },
                'UNDER': {
                    root: ['Индивидуальный тотал'], subroots: [],
                    pivotKeys: ['Меньше (#PIVOT#)', 'Меньше (#PIVOTR#)', 'Меньше (#PIVOTR2#)']
                }
            },
            'T2_TOTAL': {
                'OVER': {
                    root: ['Индивидуальный тотал'], subroots: [],
                    pivotKeys: ['Больше (#PIVOT#)', 'Больше (#PIVOTR#)', 'Больше (#PIVOTR2#)']
                },
                'UNDER': {
                    root: ['Индивидуальный тотал'], subroots: [],
                    pivotKeys: ['Меньше (#PIVOT#)', 'Меньше (#PIVOTR#)', 'Меньше (#PIVOTR2#)']
                }
            },
            'HDP': {
                'HOME': {
                    root: ['Победа с учетом форы', 'Азиатские форы'],
                    subroots: [],
                    pivotKeys: ['Фора (#PIVOT#)', 'Фора (#PIVOTR#)', 'Фора (#PIVOTR2#)']
                },
                'AWAY': {
                    root: ['Победа с учетом форы', 'Азиатские форы'],
                    subroots: [],
                    pivotKeys: ['Фора (#PIVOT#)', 'Фора (#PIVOTR#)', 'Фора (#PIVOTR2#)']
                }
            },
            half: {
                'ONE_TWO': {
                    'ONE': {root: ['Исходы по таймам'], subroots: [], pivotKey: 'П1 в 1-м тайме'},
                    'TWO': {root: ['Исходы по таймам'], subroots: [], pivotKey: 'П2 в 1-м тайме'},
                    'DRAW': {root: ['Исходы по таймам'], subroots: [], pivotKey: 'Х в 1-м тайме'},
                    'ONE_DRAW': {root: ['Исходы по таймам'], subroots: [], pivotKey: '1Х в 1-м тайме'},
                    'TWO_DRAW': {root: ['Исходы по таймам'], subroots: [], pivotKey: 'Х2 в 1-м тайме'},
                    'ONE_TWO': {root: ['Исходы по таймам'], subroots: [], pivotKey: '12 в 1-м тайме'}
                },
                'TOTAL': {
                    'OVER': {
                        root: ['Исходы по таймам'],
                        subroots: [],
                        pivotKeys: ['Тотал 1-го тайма (#PIVOT#) бол', 'Тотал 1-го тайма (#PIVOTR#) бол', 'Тотал 1-го тайма (#PIVOTR2#) бол']
                    },
                    'UNDER': {
                        root: ['Исходы по таймам'],
                        subroots: [],
                        pivotKeys: ['Тотал 1-го тайма (#PIVOT#) мен', 'Тотал 1-го тайма (#PIVOTR#) мен', 'Тотал 1-го тайма (#PIVOTR2#) мен']
                    },
                },
                'T1_TOTAL': {
                    'OVER': {
                        root: ['Инд.тотал 1-го тайма'],
                        subroots: [],
                        pivotKeys: ['#TEAM1# (#PIVOT#) бол', '#TEAM1# (#PIVOTR#) бол', '#TEAM1# (#PIVOTR2#) бол']
                    },
                    'UNDER': {
                        root: ['Инд.тотал 1-го тайма'],
                        subroots: [],
                        pivotKeys: ['#TEAM1# (#PIVOT#) мен', '#TEAM1# (#PIVOTR#) мен', '#TEAM1# (#PIVOTR2#) мен']
                    }
                },
                'T2_TOTAL': {
                    'OVER': {
                        root: ['Инд.тотал 1-го тайма'],
                        subroots: [],
                        pivotKeys: ['#TEAM2# (#PIVOT#) бол', '#TEAM2# (#PIVOTR#) бол', '#TEAM2# (#PIVOTR2#) бол']
                    },
                    'UNDER': {
                        root: ['Инд.тотал 1-го тайма'],
                        subroots: [],
                        pivotKeys: ['#TEAM2# (#PIVOT#) мен', '#TEAM2# (#PIVOTR#) мен', '#TEAM2# (#PIVOTR2#) мен']
                    }
                },
                'HDP': {
                    'HOME': {
                        root: ['Исходы по таймам', 'Азиатские форы на 1-й тайм'],
                        subroots: [],
                        pivotKeys: ['П1 в 1-м т. с форой (#PIVOT#)', 'П1 в 1-м т. с форой (#PIVOTR#)', 'П1 в 1-м т. с форой (#PIVOTR2#)']
                    },
                    'AWAY': {
                        root: ['Исходы по таймам', 'Азиатские форы на 1-й тайм'],
                        subroots: [],
                        pivotKeys: ['П2 в 1-м т. с форой (#PIVOT#)', 'П2 в 1-м т. с форой (#PIVOTR#)', 'П2 в 1-м т. с форой (#PIVOTR2#)']
                    }
                },
            }
        };

        if (data.time_value === 'FULL_MATCH' || data.time_value === 'FULL_TIME') {
            delete markets.half;
        } else {
            markets = markets.half;
        }

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw 'Unsupported ' + data.time_value + '/' + data.market + '/' + data.target;
        }
        const $marketsBlock = $('span:textEquals("Прием ставок временно приостановлен")');
        if ($marketsBlock.length > 0) throw 'event blocked or something else';
        const modifyRoots = function () {
            if (data.sport === 'TENNIS') {
                if (data.time_value === 'FULL_MATCH') {
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Основные');
                        markets['ONE_TWO']['TWO']['root'].push('Основные');
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['root'].push('Победа с учетом форы');
                        markets['HDP']['AWAY']['root'].push('Победа с учетом форы');
                    }
                    if (data.market === 'T1_TOTAL') {
                        markets['T1_TOTAL']['OVER']['root'].push('Индивидуальное количество выигранных геймов');
                        markets['T1_TOTAL']['UNDER']['root'].push('Индивидуальное количество выигранных геймов');
                    }
                    if (data.market === 'T2_TOTAL') {
                        markets['T2_TOTAL']['OVER']['root'].push('Индивидуальное количество выигранных геймов');
                        markets['T2_TOTAL']['UNDER']['root'].push('Индивидуальное количество выигранных геймов');
                    }
                } else {
                    if (data.market === 'ONE_TWO') {
                        if (data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') > -1) {
                            let parts = data.time_value.split('_GAME_');
                            let set = parts[0].replace(/[^\d]/g, '');
                            let game = parts[1];
                            markets['ONE_TWO']['ONE']['root'].push(set + 'й сет ' + game + 'й гейм');
                            markets['ONE_TWO']['TWO']['root'].push(set + 'й сет ' + game + 'й гейм');
                            markets['ONE_TWO']['ONE']['pivotKey'] = '#TEAM1#';
                            markets['ONE_TWO']['TWO']['pivotKey'] = '#TEAM2#';
                        } else {
                            let set = data.time_value.replace(/[^\d]/g, '');
                            markets['ONE_TWO']['ONE']['root'].push('Ставки по сетам');
                            markets['ONE_TWO']['TWO']['root'].push('Ставки по сетам');
                            markets['ONE_TWO']['ONE']['pivotKey'] = 'П1 в ' + set + '-м сете';
                            markets['ONE_TWO']['TWO']['pivotKey'] = 'П2 в ' + set + '-м сете';
                        }
                    }
                    if (data.market === 'HDP') {
                        if (data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') > -1) {
                            //for game
                        } else {
                            let set = data.time_value.replace(/[^\d]/g, '');
                            markets['HDP']['HOME']['root'].push('Ставки по сетам');
                            markets['HDP']['AWAY']['root'].push('Ставки по сетам');

                            markets['HDP']['HOME']['pivotKeys'].push('П1 в ' + set + '-м с. с форой (#PIVOT#)');
                            markets['HDP']['HOME']['pivotKeys'].push('П1 в ' + set + '-м с. с форой (#PIVOTR#)');
                            markets['HDP']['HOME']['pivotKeys'].push('П1 в ' + set + '-м с. с форой (#PIVOTR2#)');
                            markets['HDP']['AWAY']['pivotKeys'].push('П2 в ' + set + '-м с. с форой (#PIVOT#)');
                            markets['HDP']['AWAY']['pivotKeys'].push('П2 в ' + set + '-м с. с форой (#PIVOTR#)');
                            markets['HDP']['AWAY']['pivotKeys'].push('П2 в ' + set + '-м с. с форой (#PIVOTR2#)');

                            markets['HDP']['HOME']['pivotKeys'].push('П1 во ' + set + '-м с. с форой (#PIVOT#)');
                            markets['HDP']['HOME']['pivotKeys'].push('П1 во ' + set + '-м с. с форой (#PIVOTR#)');
                            markets['HDP']['HOME']['pivotKeys'].push('П1 во ' + set + '-м с. с форой (#PIVOTR2#)');
                            markets['HDP']['AWAY']['pivotKeys'].push('П2 во ' + set + '-м с. с форой (#PIVOT#)');
                            markets['HDP']['AWAY']['pivotKeys'].push('П2 во ' + set + '-м с. с форой (#PIVOTR#)');
                            markets['HDP']['AWAY']['pivotKeys'].push('П2 во ' + set + '-м с. с форой (#PIVOTR2#)');
                        }
                    }
                    if (data.market === 'TOTAL') {
                        if (data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') > -1) {
                            //for game
                        } else {
                            let set = data.time_value.replace(/[^\d]/g, '');
                            markets['TOTAL']['OVER']['root'].push('Ставки по сетам');
                            markets['TOTAL']['UNDER']['root'].push('Ставки по сетам');
                            markets['TOTAL']['OVER']['pivotKeys'].push('Тотал во ' + set + '-м сете (#PIVOT#) бол');
                            markets['TOTAL']['OVER']['pivotKeys'].push('Тотал во ' + set + '-м сете (#PIVOTR#) бол');
                            markets['TOTAL']['OVER']['pivotKeys'].push('Тотал во ' + set + '-м сете (#PIVOTR2#) бол');
                            markets['TOTAL']['UNDER']['pivotKeys'].push('Тотал во ' + set + '-м сете (#PIVOT#) мен');
                            markets['TOTAL']['UNDER']['pivotKeys'].push('Тотал во ' + set + '-м сете (#PIVOTR#) мен');
                            markets['TOTAL']['UNDER']['pivotKeys'].push('Тотал во ' + set + '-м сете (#PIVOTR2#) мен');

                            markets['TOTAL']['OVER']['pivotKeys'].push('Тотал в ' + set + '-м сете (#PIVOT#) бол');
                            markets['TOTAL']['OVER']['pivotKeys'].push('Тотал в ' + set + '-м сете (#PIVOTR#) бол');
                            markets['TOTAL']['OVER']['pivotKeys'].push('Тотал в ' + set + '-м сете (#PIVOTR2#) бол');
                            markets['TOTAL']['UNDER']['pivotKeys'].push('Тотал в ' + set + '-м сете (#PIVOT#) мен');
                            markets['TOTAL']['UNDER']['pivotKeys'].push('Тотал в ' + set + '-м сете (#PIVOTR#) мен');
                            markets['TOTAL']['UNDER']['pivotKeys'].push('Тотал в ' + set + '-м сете (#PIVOTR2#) мен');
                        }
                    }
                }
            }
            if (data.sport === 'HOCKEY') {
                if (data.time_value === 'FULL_MATCH') {
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Основные');
                        markets['ONE_TWO']['TWO']['root'].push('Основные');
                        markets['ONE_TWO']['DRAW']['root'].push('Основные');
                        markets['ONE_TWO']['ONE_DRAW']['root'].push('Основные');
                        markets['ONE_TWO']['TWO_DRAW']['root'].push('Основные');
                        markets['ONE_TWO']['ONE_TWO']['root'].push('Основные');
                    }
                } else {
                    let period = data.time_value.replace(/[^\d]/g, '');
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push(period + ' период: Исходы по периодам');
                        markets['ONE_TWO']['TWO']['root'].push(period + ' период: Исходы по периодам');
                        markets['ONE_TWO']['DRAW']['root'].push(period + ' период: Исходы по периодам');
                        
                        markets['ONE_TWO']['ONE']['pivotKey'] = 'П1';
                        markets['ONE_TWO']['TWO']['pivotKey'] = 'П2';
                        markets['ONE_TWO']['DRAW']['pivotKey'] = 'Х';
                        
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['root'].push(period + ' период: Исходы по периодам');
                        markets['HDP']['AWAY']['root'].push(period + ' период: Исходы по периодам');
                        markets['HDP']['HOME']['pivotKeys'].push('П1 с форой (#PIVOT#)');
                        markets['HDP']['HOME']['pivotKeys'].push('П1  с форой (#PIVOTR#)');
                        markets['HDP']['HOME']['pivotKeys'].push('П1 с форой (#PIVOTR2#)');
                        markets['HDP']['AWAY']['pivotKeys'].push('П2 с форой (#PIVOT#)');
                        markets['HDP']['AWAY']['pivotKeys'].push('П2 с форой (#PIVOTR#)');
                        markets['HDP']['AWAY']['pivotKeys'].push('П2 с форой (#PIVOTR2#)');
                    }
                    if (data.market === 'TOTAL') {
                        markets['TOTAL']['OVER']['root'].push(period + ' период: Исходы по периодам');
                        markets['TOTAL']['UNDER']['root'].push(period + ' период: Исходы по периодам');
                        markets['TOTAL']['OVER']['pivotKeys'].push('Тотал (#PIVOT#) бол');
                        markets['TOTAL']['OVER']['pivotKeys'].push('Тотал (#PIVOTR#) бол');
                        markets['TOTAL']['OVER']['pivotKeys'].push('Тотал (#PIVOTR2#) бол');
                        markets['TOTAL']['UNDER']['pivotKeys'].push('Тотал (#PIVOT#) мен');
                        markets['TOTAL']['UNDER']['pivotKeys'].push('Тотал (#PIVOTR#) мен');
                        markets['TOTAL']['UNDER']['pivotKeys'].push('Тотал (#PIVOTR2#) мен');
                    }
                }
            }
            if (data.sport === 'CYBERSPORT') {
                if (data.time_value === 'FULL_MATCH') {
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Основные');
                        markets['ONE_TWO']['TWO']['root'].push('Основные');
                        markets['ONE_TWO']['DRAW']['root'].push('Основные');
                    }
                } else {
                    let card = data.time_value.replace(/[^\d]/g, '');
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['root'].push('Карта ' + card);
                        markets['ONE_TWO']['TWO']['root'].push('Карта ' + card);
                        markets['ONE_TWO']['ONE']['pivotKey'] = 'Победа #TEAM1#';
                        markets['ONE_TWO']['TWO']['pivotKey'] = 'Победа #TEAM2#';
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['root'].push('Карта ' + card);
                        markets['HDP']['AWAY']['root'].push('Карта ' + card);
                        markets['HDP']['HOME']['pivotKeys'].push('П1 с форой (#PIVOT#)');
                        markets['HDP']['HOME']['pivotKeys'].push('П1  с форой (#PIVOTR#)');
                        markets['HDP']['HOME']['pivotKeys'].push('П1 с форой (#PIVOTR2#)');
                        markets['HDP']['AWAY']['pivotKeys'].push('П2 с форой (#PIVOT#)');
                        markets['HDP']['AWAY']['pivotKeys'].push('П2 с форой (#PIVOTR#)');
                        markets['HDP']['AWAY']['pivotKeys'].push('П2 с форой (#PIVOTR2#)');
                    }
                    if (data.market === 'TOTAL') {
                        markets['TOTAL']['OVER']['root'].push('Карта ' + card);
                        markets['TOTAL']['UNDER']['root'].push('Карта ' + card);
                        markets['TOTAL']['OVER']['pivotKeys'].push('Тотал Карты ' + card + ' (#PIVOT#) бол');
                        markets['TOTAL']['OVER']['pivotKeys'].push('Тотал Карты ' + card + ' (#PIVOTR#) бол');
                        markets['TOTAL']['OVER']['pivotKeys'].push('Тотал Карты ' + card + ' (#PIVOTR2#) бол');
                        markets['TOTAL']['UNDER']['pivotKeys'].push('Тотал Карты ' + card + ' (#PIVOT#) мен');
                        markets['TOTAL']['UNDER']['pivotKeys'].push('Тотал Карты ' + card + ' (#PIVOTR#) мен');
                        markets['TOTAL']['UNDER']['pivotKeys'].push('Тотал Карты ' + card + ' (#PIVOTR2#) мен');
                    }
                }
            }
        }

        if (data.sport !== 'FOOTBALL') modifyRoots();

        const specialPivotFormatter = function (market, pivot, twoParam) {
            let two = typeof twoParam === 'undefined' ? false : twoParam;

            function round(value, precision) {
                let multiplier = Math.pow(10, precision || 0);
                return Math.round(value * multiplier) / multiplier;
            }

            let fp = parseFloat(pivot);
            let res = '';
            if (!isNaN(fp)) {
                if (market.indexOf('TOTAL') > -1) {
                    // dot zero adding
                    res = two ? round(fp, 2).toString() : round(fp, 1).toFixed(1).toString();
                } else if (market.indexOf('HDP') > -1) {
                    res = (fp > 0 ? '+' : '') + (two ? round(fp, 2).toString() : round(fp, 1).toFixed(1).toString());
                }
            }
            return res;
        };
        const replaceInner = function (element, parent, index) {
            if (typeof element === 'string') {
                parent[index] = element.replace('#TEAM1#', data.team1).replace('#TEAM2#', data.team2)
                    .replace('#PIVOT#', data.pivot).replace('#PIVOTR#', specialPivotFormatter(data.market, data.pivot))
                    .replace('#PIVOTR2#', specialPivotFormatter(data.market, data.pivot, true));
            } else if (typeof element === 'object') {
                for (let i in element) {
                    replaceInner(element[i], element, i);
                }
            } else {
                // console.log(typeof element + ' not supported! (' + element + ')');
            }
        };
        replaceInner(markets, null, null);
        bsDebug(port, 'markets: ', markets)

        const performGet = async () => {
            const market = markets[data.market][data.target];
            let $element = [];
            console.log('market: ', market);
            for (let root of market.root) {
                const $headerRoot = $(`div[class^="title-"]:textEquals("${root}")`);
                if ($headerRoot.length > 0) {
                    //expand if needed
                    if ($headerRoot.closest('div[class*="root-"]').find('div[class*="content-"]').length === 0) {
                        await mouseChain({
                            target: $headerRoot[0],
                            events: fullClick,
                            error: 'can\'t expand bet head',
                            scroll: true
                        });
                        await delayPromise(1222);
                    }

                    if (data.market === 'ONE_TWO') {
                        $element = $headerRoot.closest('div[class*="root-"]').find(`span[class^="name-"]:textEquals("${market.pivotKey}")`).parent();
                    } else {
                        for (let pivotKey of market.pivotKeys) {
                            $element = $headerRoot.closest('div[class*="root-"]').find(`span[class^="name-"]:textEquals("${pivotKey}")`).parent();
                            if ($element.length > 0) break;
                        }
                    }
                }
                if ($element.length > 0) break;
            }
            if ($element.length === 1) {
                return $element;
            } else if ($element.length > 1) {
                throw 'Very strange length of $element: ' + $element.length;
            } else {
                throw 'Root candidates not found!';
            }
        };

        return await performGet();

    };

    const selectLive = async () => {
        await mouseChain({
            target: $('a[class^="header__HeaderLink-sc-"][href$="/live"]')[0],
            events: fullClick,
            error: 'can\'t select live'
        });
        await delayPromise(2000);
    };

    const checkWeAreHere = (bet) => {
        let eventHere;
        let eventData = bet.team1 + ' - ' + bet.team2;
        eventHere = $('div[class*="team-"]:eq(0)').trt() + ' - ' + $('div[class*="team-"]:eq(1)').trt();
        if (!similarCompare(eventHere.toLocaleLowerCase(), eventData.toLocaleLowerCase())) {
            dLog('red', 'OC', `'${eventHere}' !== '${eventData}'`);
            return false;
        } else {
            return true;
        }
    };

    const openEvent = async bet => {
        if (checkWeAreHere(bet)) {
            return 'Event must be opened!';
        } else {
            await switchPrematchLive(bet);
            await findEvent(bet);
        }
    };

    const findEvent = async (bet) => {
        //select sport in left menu
        let $event = $([]);
        const match = bet.team1 + ' - ' + bet.team2;
        const searchInpt = 'input[inputmode="search"]';
        const events = 'div.globalEventSticky';
        await waitForElement(searchInpt, 222, 4444, true);
        await clearAndSimulate($(searchInpt)[0], match, false, false, true, false);
        await delayPromise(1222);
        await waitForElement(events, 333, 9999, true);
        await delayPromise(333);

        //find search event in list
        await $(events).find('a').eachAsync(async function () {
            const $this = $(this);
            if ($this.find('span[class^="name-"]').length === 2) {
                const eventHere = ($this.find('span[class^="name-"]:eq(0)').trt() + ' - ' + $this.find('span[class^="name-"]:eq(1)').trt()).toLowerCase();
                if (similarCompare(eventHere, match.toLowerCase())) {
                    $event = $this;
                    return false;
                }
            }
        });

        if ($event.length > 0) {
            await mouseChain({target: $event[0], events: fullClick, error: 'evt', scroll: true});
            await delayPromise(555);
            await waitForCondition(() => checkWeAreHere(bet), 300, 8000, 'Event not opened!');
            return 'Event opened!';
        } else {
            throw 'Event not found!';
        }
    };

    const tryToLogIn = async () => {
        if (tryLogin > 3) {
            enterError = true;
            return true;
        }
        const selectors = {};
        if (Date.now() - authClicked < 10000) {
            throw "Too soon!";
        }
        settings.login = settings.login.replace("+7", "");
        await delayPromise(1000);

        selectors.username = '#modal-root form input[name="phone"]';
        selectors.password = '#modal-root form input[name="password"]';
        selectors.submit = '#modal-root form button.submit:textEquals("Войти")';

        if (!Object.values(selectors).every((s) => $(s).length > 0)) {
            Object.values(selectors).forEach((s) => {
                console.log("checking " + s);
                console.log($(s).length);
            });
            throw "No inputs for login!";
        }
        await clearAndSimulate($(selectors.username)[0], settings.login);
        await delayPromise(1500);
        await clearAndSimulate($(selectors.password)[0], settings.password);
        authClicked = Date.now();
        await delayPromise(1500);
        await mouseChain({
            target: $(selectors.submit)[0],
            events: fullClick,
            error: "can't submit form",
        });
        let $errorMessage = await waitForElement('#modal-root form div:textEquals("Вы ввели неверный логин и/или пароль!"):visible',333,3555).catch(() => $([]));
        if ($errorMessage.length > 0) {
            enterError = true;
        }
        tryLogin++;
    };

    const similarCompare = (one, two) => one === two || locutus_similar_text(one, two, true) > 85;

    function getBalance(returnNull) {
        const $balanceSel = $('span[title="Пополнить баланс"]');
        if ($balanceSel.length > 0) {
            return parseFloat($balanceSel.trt().replace(/[^\d]/g, ''));
        } else {
            return returnNull ? 'null' : 0;
        }
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            chrome.storage.local.set({
                'OLIMPCUPIS_COMMAND': ourCommand.get(),
                'OLIMPCUPIS_COMMAND_WAS_SET': increaseDelay ? Date.now() + 150000 : Date.now()
            });
        }
    }, true);

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});
        chrome.storage.local.get(['OLIMPCUPIS_COMMAND', 'OLIMPCUPIS_COMMAND_WAS_SET'], function (result) {
            if (typeof result.OLIMPCUPIS_COMMAND !== 'undefined' && typeof result.OLIMPCUPIS_COMMAND_WAS_SET !== 'undefined'
                && Date.now() - result.OLIMPCUPIS_COMMAND_WAS_SET < 40000) {
                let currentCommand = result.OLIMPCUPIS_COMMAND;
                chrome.storage.local.remove(['OLIMPCUPIS_COMMAND', 'OLIMPCUPIS_COMMAND_WAS_SET'], function () {
                    waitForCondition(() => {
                        return wasAuthCheck !== false;
                    }, 222, 10000, 'AuthCheck was not', false)
                        .then(() => messageProcessor(currentCommand))
                        .catch((e) => bsError(port, 'Something wrong with auth check! ' + e));
                });
            } else {
                chrome.storage.local.remove(['OLIMPCUPIS_COMMAND', 'OLIMPCUPIS_COMMAND_WAS_SET']);
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }
})
();
