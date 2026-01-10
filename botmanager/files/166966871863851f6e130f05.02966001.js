(function () {

    "use strict";

    if (window.location.href.indexOf('pay.1cupis.ru') > -1) {
        return;
    } else if (window.top !== window.self) {
        return;
    }

    const isCupis = document.location.href.indexOf('parimatch.ru/') > -1 ? true
        : document.location.href.indexOf('air-ru.e') > -1 ? true
            : document.location.href.indexOf('en.e') > -1 ? true
                : document.location.href.indexOf('pm.by/') > -1 ? true
                    : document.location.href.indexOf('parimatch.com/') > -1 ? true : false;
    const isCoupon = document.location.href.indexOf('stake.html?') > -1;
    const isAir = false; //document.location.href.indexOf('air-ru.e') > -1;
    let newAPI = false;
    let authClicked = 0;
    let dateNow = Date.now();
    let busy = false;
    let enterError = false;
    let port = {postMessage: () => console.log(arguments)};
    const bkHere = isCupis ? window.location.href.indexOf('pm.by') > -1 ? "port_pariby" : window.location.href.indexOf('parimatch.com/') > -1 ? "port_pariold" : "port_paricupis" : "port_pariold";
    if (!isCoupon) {
        port = chrome.runtime.connect({name: bkHere});
        dLog('red', 'Pari', `We'd opened port: ${(bkHere)}`);
    }
    let settings = {
        authCheckInterval: 2000,
        url: 'https://www.parimatch.com/live.html',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        uid: '123',
    };
    const max = 100500100;

    let currentBetData = false;
    let currentCommand = '';

    let reordered = [];

    const sportAccordance = {
        'FOOTBALL': 'Футбол',
        'TENNIS': 'Теннис',
        'TABLETENNIS': 'Настольный теннис',
        'BASEBALL': 'Бейсбол',
        'HOCKEY': 'Хоккей',
        'BASKETBALL': 'Баскетбол',
        'VOLLEYBALL': 'Волейбол',
        'HANDBALL': 'Handball',
        'CYBERSPORT': 'Киберспорт',
    };

    const sportNav = {
        'FOOTBALL': 'soccer',
        'TENNIS': 'tennis',
        'TABLETENNIS': 'tableTennis',
        'BASEBALL': '',
        'HOCKEY': 'iceHockey',
        'BASKETBALL': 'basketball',
        'VOLLEYBALL': '',
        'HANDBALL': '',
        'CYBERSPORT': 'eSport',
    };

    const sportsMain = {
        'FOOTBALL': 'football',
        'CYBERSPORT': "esports",
        'BASKETBALL': "basketball",
        'BASEBALL': "baseball",
        'VOLLEYBALL': "volleyball",
        'TENNIS': "tennis",
        'HOCKEY': "hockey",
        'TABLETENNIS': "tabletennis",
        'HANDBALL': "waterpolo",
    };

    const $getIFrame = selector => $(selector).length > 0 ? $($(selector)[0].contentDocument) : $([]);

    let ourCommand = new ourCommandProto();

    let smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);

    const messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;
        currentCommand = message.action;
        let $logLink = $('button[ga-event="login-top-button-tap"]');
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        }
        if (message.action === 'SMS_API' && message.data) {
            smsApiMessage.setMessage(message.data.status, message.data.message);
        } else if (message.action === "auth") {
            dLog('orange', 'Pari', `AUTH ${message.login} / ${message.password}`);
            settings.login = message.login;
            settings.password = message.password;
            authCheck();
        } else if ($logLink.length !== 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (['BET', 'EXPRESS_BET'].indexOf(message.action) > -1) {
            busy = true;
            ourCommand.set(message);
            proceedBet(message.data, false)
                .then(() => bsDebug(port, "It's looks like BET done!"))
                .catch(e => {
                    dLog('red', 'Pari', `Error till ${message.action}: e, ${formatStack(e.stack)}`)
                    if (e.includes('$gtl')) {
                        busy = false;
                        ourCommand.clear();
                        document.location.reload();
                    }
                })
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
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                    mouseChain({
                        target: $('a[data-id="tab-sport_menu_live"]')[0],
                        events: fullClick,
                        scroll: true,
                        error: 'LiveGi'
                    }).then().catch();
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
                    delayPromise(15000)
                        .then(() => mouseChain({
                            target: $(['#tbLive a', 'a[href="/live"]'].find(s => $(s).length > 0))[0],
                            events: ['click']
                        }))
                        .then().catch();
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
                    answer: success ? 'Collected!' : message
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
            let letsRockNRoll = function () {
                bsDebug(port, 'letsRockNRoll');
                if (document.location.href.indexOf('/payments.html') > -1) {
                    waitForElement('li.history', 333, 10000)
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(waitForElementF('div.AllHistory', 333, 10000, true))
                        .then(($el) => delayPromise(5555, $el))
                        .then(($el) => {
                            collected = [];
                            $('div.AllHistory').find('div.row-info').each(function () {
                                let $this = $(this);
                                collected.push({
                                    date: $this.find('div.col-1').text().trim(),
                                    description: $this.find('div.col-4').text().replace(/(?:\r\n|\r|\n)/g, ' ')
                                        .replace(/\s\s+/g, ' ').trim(),
                                    type: $this.find('div.col-2').text().indexOf('Взнос ') > -1 ? 'IN' : 'OUT',
                                    paysystem: $this.find('div.col-2').text().indexOf('QIWI') > -1 ? 'QIWI' : '',
                                    amount: $this.find('div.col-3').text().replace(/[^0-9\.]/g, '').trim(),
                                    success: $this.find('div.col-4').text().indexOf('Выполнение ожидается') === -1
                                });
                            });
                            console.log(collected);
                            report(true, collected);
                        })
                        .catch((e) => report(false, 'Go to withdrawal: ' + e))
                } else {
                    waitForElement('a[href="./payments.html "]', 333, 10000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(7777))
                        .catch((e) => report(false, 'Go to payments: ' + e))
                }
            };
            letsRockNRoll();
        });
    };

    const withdrawCupis = async data => {
        if (!ourCommand.getAdded('sms_api_request_id')) {
            settings.phone = data.login;
            await bsBindNumber(port, settings, smsApiMessage, ourCommand);
        } else {
            await delayPromise(5000);
        }
        if (ourCommand.getAdded('formFilled')) {
            const res = await bMess('DEPOSIT_RESULT', true).get(240000);
            return {finished: true, success: res.success, message: res.message || 'No message!'};
        } else if (document.location.href.indexOf('ru/withdraw') > -1) {
            const $ifr = () => $getIFrame('iframe[title="common-dictionary:Withdraw"]');
            const $panel = () => $ifr().find('li[class^="PaymentMethodItem"]:has(img[src$="qiwi.svg"])');
            const $input = () => $ifr().find('input[class^="MoneyInput_amount"]');
            await waitForCondition(() => $panel().length > 0, 333, 30000);
            await delayPromise(500);
            await mouseChain({target: $panel().find('button')[0], events: fullClick, error: 'PB'});
            await delayPromise(500);
            await waitForCondition(() => $input().length > 0, 333, 30000);
            await clearAndSimulate($input()[0], data.amount);
            await delayPromise(500);
            await mouseChain({
                target: $ifr().find('button:contains("Продолжить")')[0],
                events: fullClick, error: 'dfdee'
            });
            ourCommand.add('formFilled', true);
            ourCommand.add('increaseDelay', true);
            await bMess('QIWI_COMMAND', true).set(ourCommand.get());
            await delayPromise(1000);
            await mouseChain({target: $('button[type="submit"]')[0], events: fullClick, error: 'submit'});
            await delayPromise(1000);
            const error = $('span.form__error, div.payments-error__message').text().trim();
            if (error !== '') {
                throw error;
            }
        } else {
            const $ma = await waitForElement('div[data-id="user-box-pic"]', 333, 30000);
            await delayPromise(500);
            await mouseChain({target: $ma[0], events: fullClick, error: '$ma'});
            const $mb = await waitForElement('div[data-id="my-account-menu-item-payment-operations"]', 333, 30000);
            await delayPromise(500);
            await mouseChain({target: $mb[0], events: fullClick, error: '$mb'});
            const $ob = await waitForElement('div[data-id="my-account-menu-item-withdraw"]', 333, 30000);
            await delayPromise(500);
            await mouseChain({target: $ob[0], events: fullClick, error: '$ob'});
        }
        await delayPromise(2000);
        return await withdrawCupis(data);
    };

    const withdrawOffshore = async data => {
        if (document.location.href.indexOf('/withdrawal.html?method=12') > -1 && ourCommand.getAdded('orderConfirmed') === true) {
            await waitForElement('strong:contains("Ваш заказ принят.")', 333, 15000);
            return {finished: true, success: true, message: 'Withdrawal may be succeed!'};
        } else if (document.location.href.indexOf('/withdrawal.html?method=12') > -1 && ourCommand.getAdded('formFilledOut') === true) {
            const $el = await waitForElement('input[value="Подтвердить оформление заказа"]', 333, 10000);
            await delayPromise(3000);
            ourCommand.add('orderConfirmed', true);
            await mouseChain({target: $el[0], events: ['click'], error: 'el B2'});
            await delayPromise(3000);
        } else if (document.location.href.indexOf('/withdrawal.html?method=12') > -1) {
            const $el = await waitForElement('input[name="amount"]', 333, 10000);
            await clearAndSimulate($el[0], data.amount);
            await delayPromise(3000);
            let $opt = $('select[name="qwwallet"] option[value="' + data.login.replace('+', '') + '"]');
            if ($opt.length === 0) {
                let qiwies = [];
                $('select[name="qwwallet"] option').get().forEach(function (item) {
                    qiwies.push(item.innerText);
                });
                throw 'Withdrawal to ' + data.login + ' is impossible! Only: ' + qiwies.join(', ');
            } else {
                $opt.prop('selected', true);
            }
            await delayPromise(3000);
            ourCommand.add('formFilledOut', true);
            await mouseChain({
                target: $('input[value="Оформить заказ"]')[0],
                events: ['click'],
                scroll: true, error: 'OfZ'
            });
            await delayPromise(3000);
        } else if (document.location.href.indexOf('/payments.html') > -1) {
            const $el = await waitForElement('li.tabsOut', 333, 10000);
            await delayPromise(3000);
            await mouseChain({target: $el[0], events: ['click'], error: 'ps2'});
            const $el2 = await waitForElement('div.payPanel:has(a[href="./withdrawal.html?method=12"])', 333, 3333, true);
            await delayPromise(3000);
            $el2[0].scrollIntoView();
            await delayPromise(3000);
            await mouseChain({target: $el2[0], events: ['mouseover', 'mousemove', 'click'], error: '$el2'});
            await ourCommand.saveCommandForFurtherUse('PARIALL');
            await delayPromise(1000);
            port.postMessage({
                m: "CLOSE_ME", condition: '*://*.parimatch.com/*', wait: 10000,
            });
        } else {
            const $el = await waitForElement('a[href="./payments.html "]', 333, 10000);
            await mouseChain({target: $el[0], events: ['click'], error: 'wtN'});
            await delayPromise(7777);
        }
        return {finished: false};
    };

    const withdraw = data => new Promise((onSuccess, onReject) => {
        const report = function (success, message) {
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
        (isCupis ? withdrawCupis : withdrawOffshore)(data)
            .then(res => res.finished ? report(res.success, res.message) : null)
            .catch((e) => report(false, 'withdraw: ' + e));
    });

    const deposit = async data => {
        bsDebug(port, 'deposit!', data);
        const report = function (success, message) {
            ourCommand.add('increaseDelay', false);
            ourCommand.add('qiwiEntered', false);
            bsDebug(port, 'Report! ' + success + ' / ' + message);
            port.postMessage({
                answered: "DEPOSIT",
                status: success ? 'SUCCESS' : ['NO_FUNDS', 'RESTRICTED'].find(t => message.indexOf(t) > -1) || 'FAILED',
                answer: message
            });
            const $cb = $('div[class^="Status_bottom-button-wrapper"] button:contains("Продолжить")');
            if ($cb.length > 0) {
                mouseChain({target: $cb[0], events: fullClick, error: '$cb'})
                    .finally(() => dLog('green', 'Pari', 'Continue clicked!'));
            }
            if (!success) {
                throw message;
            }
        };
        const actions = async () => {
            if (ourCommand.getAdded('qiwiEntered') === false
                && ['/qiwi.html', '/bank/deposit/QIWI'].some(t => document.location.href.indexOf(t) > -1)) {
                const sels = ourCommand.getAdded('cupisHere') ? ['#amount'] : ['#amount', '#phone'];
                await waitForCondition(() => sels.every(s => $(s).length > 0), 333, 10000, 'No form!');
                await delayPromise(7000);
                if (sels.length === 2) {
                    await clearAndSimulate($(sels[1])[0], data.login.replace('+', ''));
                    await delayPromise(3000);
                }
                await clearAndSimulate($(sels[0])[0], data.amount);
                await delayPromise(3000);
                ourCommand.add('qiwiEntered', true);
                ourCommand.add('iFrame', !isCupis);
                ourCommand.add('close', false);
                ourCommand.add('increaseDelay', true);
                await bMess('DEPOSIT_RESULT', true).remove();
                await bMess('QIWI_COMMAND', true).set(ourCommand.get());
                await mouseChain({
                    target: $(['#btn_pay', 'button.btn-orange:contains("ПРОДОЛЖИТЬ")'].find(s => $(s).length > 0))[0],
                    events: fullClick,
                    error: 'PayBtn'
                });
            } else if (['/payments.html', '/bank/deposit', '/ru/deposit'].some(t => document.location.href.indexOf(t) > -1)) {
                if (isCupis) {
                    const $ifr = () => $getIFrame('iframe[title="common-dictionary:Deposit"]');
                    const $panel = () => $ifr().find('li[class^="PaymentMethodItem"]:has(img[src$="qiwi.svg"])');
                    const $input = () => $ifr().find('input[class^="MoneyInput_amount"]');
                    await waitForCondition(() => $panel().length > 0, 333, 30000);
                    await delayPromise(500);
                    await mouseChain({target: $panel().find('button')[0], events: fullClick, error: 'PB'});
                    await delayPromise(500);
                    await waitForCondition(() => $input().length > 0, 333, 30000);
                    await clearAndSimulate($input()[0], data.amount);
                    await delayPromise(500);
                    await mouseChain({
                        target: $ifr().find('button:contains("Продолжить")')[0],
                        events: fullClick, error: 'dfdee'
                    });
                    ourCommand.add('cupisHere', true);
                    ourCommand.add('qiwiEntered', true);
                    ourCommand.add('close', false);
                    ourCommand.add('increaseDelay', true);
                    await bMess('DEPOSIT_RESULT', true).remove();
                    await bMess('QIWI_COMMAND', true).set(ourCommand.get());
                    await ourCommand.saveCommandForFurtherUse('PARIALL');
                    await delayPromise(5000);
                    port.postMessage({
                        m: "CLOSE_ME", condition: '*://*.parimatch.ru/*', wait: 5000,
                    });
                } else {
                    const $panel = await waitForElement(() => $(['div.payPanel:has(a[href="./qiwi.html"])',
                            'div.withdrawal-channel:has(img[alt="QIWI"])'].find(s => $(s).length > 0)),
                        333, 10000, false, 1, 'We1');
                    await delayPromise(3000);
                    $panel[0].scrollIntoView();
                    const aSel = ['a[href="./qiwi.html"]', 'a[href="/my-account/bank/deposit/QIWI"]'].find(s => $panel.find(s).length > 0);
                    if (!aSel) {
                        throw 'No aSel!';
                    }
                    ourCommand.add('cupisHere', aSel !== 'a[href="./qiwi.html"]');
                    await delayPromise(2000);
                    await ourCommand.saveCommandForFurtherUse('PARIALL');
                    await delayPromise(2000);
                    await mouseChain({target: $panel.find(aSel)[0], events: fullClick, error: 'aSel'});
                    if (aSel === 'a[href="./qiwi.html"]') {
                        port.postMessage({
                            m: "CLOSE_ME", condition: '*://*.parimatch.com/*', wait: 10000,
                        });
                    }
                }
            } else if (ourCommand.getAdded('qiwiEntered') === true) {
                const depositResult = await bMess('DEPOSIT_RESULT', true).get(120000);
                chrome.storage.local.remove(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET', 'SKRILL_COMMAND', 'SKRILL_COMMAND_WAS_SET']);
                if (!depositResult.success) {
                    throw depositResult.message || 'No message :(';
                }
                return depositResult.message || 'No message :(';
            } else {
                const $db = await waitForElement(() => $(['div.payPanel:has(a[href="./qiwi.html"])',
                    'a.btn-deposit:contains("Пополнить")', 'button[data-id="header-deposit"]']
                    .find(s => $(s).length > 0)), 333, 10000, false, 1, 'We2');
                await mouseChain({target: $db[0], events: fullClick, error: 'Deposit Btn'});
            }
            await delayPromise(3000);
            return true;
        };
        await (async () => {
            let res;
            do {
                res = await actions();
            } while (typeof res === 'boolean');
            return res;
        })()
            .then(async m => report(true, m))
            .catch(e => report(false, e));
    };

    const collectBetResults = async data => {
        let error = '';
        const res = await (isCupis ? collectBetResultsCupis : isAir ? collectBetResultsAir : collectBetResultsOffshore)(data)
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
        if (isCupis) {
            await goLive();
        }
        return res;
    };

    /**
     * Collecting bet results
     * @param {array} inputData
     * @returns {Promise<any>}
     */
    const collectBetResultsOffshore = function (inputData) {
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
                    let $header = $current.find('div.lrHeader');
                    let external_id = $header.find('span.nk').text().replace(/[^0-9\.]/g, '').trim();
                    let expressCoef = $header.find('span.lrBold').first().text().trim();
                    let coef = expressCoef !== ''
                        ? expressCoef.replace('Экспресс (кф.', '').replace(/[^0-9\.]/g, '').trim()
                        : $current.find('div.row-info div.col-3').first().text().trim();
                    let result = parseFloat($header.find('span.ss').text().replace(/[^0-9\.]/g, '').trim());
                    let stake = parseFloat($header.find('span.lrBold').last().text().trim());
                    let matchAll = $current.find('div.row-info div.col-2').first().text().trim();
                    let matchParsed = matchAll.split(':');
                    let status = 'LOSE';
                    if (isNaN(result)) {
                        status = 'ACCEPTED';
                    } else if (!isNaN(result) && result > stake) {
                        status = 'WON';
                    } else if (!isNaN(result) && result === stake) {
                        status = 'REFUNDED';
                    }
                    if (data.length === 0 || data.indexOf(external_id) > -1) {
                        collected.push({
                            external_id: external_id,
                            status: status,
                            match: typeof matchParsed[0] !== 'undefined' ? matchParsed[0].trim() : '',
                            bkPivot: typeof matchParsed[1] !== 'undefined' ? matchParsed[1].trim() : '',
                            coef: coef,
                            stake: stake,
                            result: result
                        });
                    }
                    onSuccess();
                });
            };

            let currentBet = 0;
            let performCollectBet = function () {
                let $allBets = $('div.AllHistory div.lr');
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


            if (window.location.href.indexOf('/history.html') > -1) {
                performCollectBet();
            } else {
                mouseChain({target: $('a[href="/history.html"]')[0], events: ['click'], scroll: true})
                    .then(waitForCondition(() => {
                        return window.location.href.indexOf('/history.html') > -1
                            && $('div.AllHistory').length > 0;
                    }, 333, 40000, 'Wait for...', true))
                    .then(delayFunction(1000))
                    .then(performCollectBet)
                    .catch((e) => onReject('before performCollectBet: ' + e));
            }
        });
    };

    const proceedBet = async data => {
        dLog('orange', 'PARI', ['proceedBet', data]);
        const res = await (isCupis ? proceedBetCupis : isAir ? proceedBetAir : proceedBetCupis)(data)
            .catch(e => ({success: false, message: `proceedBet: ${e}, ${formatStack(e.stack)}`}));
        dLog('green', 'PARI', ['proceedBet res: ', res]);
        const resultData = {
            "external_id": res.success ? res.message.external_id : '',
            "status": res.success
                ? 'ACCEPTED'
                : ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED'].find(c =>
                typeof res.message === 'string'
                && res.message.indexOf(c) > -1) || 'FAILED',
            "market": data[0].market,
            "target": data[0].target,
            "pivot": data[0].pivot,
            "coef": res.success ? res.message.odd.toString() : data[0].coef,
            "stake": res.success ? res.message.stake.toString() : data[0].stake,
            "maximum": 100500100
        };
        //dLog('green', 'PARI', ['proceedBet resultData: ', resultData]);
        port.postMessage({
            answered: "BET",
            data: resultData,
            answer: res.success ? `Everything is Okay!` : res.message,
        });
        busy = false;
        ourCommand.clear();
        if (!res.success) {
            throw res.message;
        }
        return res.message;
    };

    const checkLimited = async text => {
        const limiteds = await bMess('PARI_LIMITEDS').check(864e6).catch(() => []);
        limiteds.push(`${nowFormatted()}: ${text}`);
        if (limiteds.length >= 3) {
            throw `LIMITED ${limiteds.join('; ')}`
        }
        await bMess('PARI_LIMITEDS').set(limiteds);
        throw `Max is 0!`;
    };

    const proceedBetAir = async data => {
        dLog('green', 'PARI', [`proceedBetAir`, data]);
        let stake = parseFloat(data[0].stake);
        if (isNaN(stake) || stake <= 0) {
            throw `Wrong stake: ${data[0].stake}`;
        }
        await closePreviousCoupons(false);
        await openCouponAir(data);
        await checkCoefsAir(data);
        const inputSel = 'input[name="stake"]';
        await clearAndSimulate($(inputSel)[0], '0');
        await delayPromise(500);
        await clearAndSimulate($(inputSel)[0], '0');
        await delayPromise(150);
        await clearInputElement({element: $(inputSel)[0]});
        await delayPromise(150);
        for (const st of stake.toString()) {
            await emulateKeyboardLikeHuman({element: $(inputSel)[0], string: st});
            await delayPromise(50);
        }
        fireInputEvent($(inputSel)[0]);
        fireChangeEvent($(inputSel)[0]);
        const bsSel = 'button.betslip-footer-place-btn';
        if ($(bsSel).length === 0) {
            throw 'No bet button!';
        }
        await mouseChain({target: $(bsSel)[0], events: fullClick, error: 'bsSel', scroll: true});
        const errorSel = 'notification[context="betslip"] div.betslip_error:visible';
        const successSel = 'div.betslip-empty__text';
        for (let i = 1; i >= 0; i--) {
            await waitForCondition(() => [successSel, errorSel].some(s => $(s).length > 0
                    && $(s).text().trim() !== "Восстановление связи"),
                200, 3000 + 27000 * i, 'No bet result!');
        }
        if ($(errorSel).length > 0) {
            throw `Error till bet X: ${$(errorSel).text().trim()}`;
        }
        await delayPromise(3000);
        const res = await collectBetResultsAir([], true);
        dLog('green', 'PARI', `Collected ${res.external_id}/${res.stake}/${res.coef}`);
        const result = {
            external_id: res.external_id,
            odd: res.coef,
            stake: res.stake,
            max
        };
        delayPromise(1000).then(() => goLive());
        dLog('green', 'PARI', ['We return this: ', result]);
        return {success: true, message: result};
    }

    const proceedBetCupis = async data => {
        dLog('green', 'PARI', [`proceedBetCupis`, data]);
        const balance = await getBalance();
        let stake = parseFloat(data[0].stake);
        if (isNaN(stake) || stake <= 0) {
            throw `Wrong stake: ${data[0].stake}`;
        }
        if (balance < stake) {
            throw `NO_FUNDS - now: ${balance}, we need: ${stake}`;
        }
        await closePreviousCoupons(false);
        await openCouponCupis(data);
        let odd = await checkCoefsCupis(data);
        const inputSel = 'input[data-id="betslip-stake-input"]';
        await clearAndSimulate($(inputSel)[0], stake);
        await delayPromise(888);
        await clearAndSimulate($(inputSel)[0], '0');
        await delayPromise(150);
        await clearInputElement({element: $(inputSel)[0]});
        await delayPromise(150);
        for (const st of stake.toString()) {
            await emulateKeyboardLikeHuman({element: $(inputSel)[0], string: st});
            await delayPromise(50);
        }
        fireInputEvent($(inputSel)[0]);
        fireChangeEvent($(inputSel)[0]);
        const bsSel = 'button[data-id="betslip-place-bet-button"]';
        if ($(bsSel).length === 0) {
            throw 'No bet button!';
        }
        await mouseChain({target: $(bsSel)[0], events: fullClick, error: 'bsSel', scroll: true});
        const $maxBet = await waitForElement('div:textEquals("Place a MAX bet")', 300, 2555).catch(() => $([]));
        const $maxBetRu = await waitForElement('div:textEquals("Сделать МАХ ставку")', 300, 2555).catch(() => $([]));
        if ($maxBet.length > 0) {
            throw 'Place a MAX bet LIMITED';
        }
        if ($maxBetRu.length > 0) {
            if ($('div[class^="Dialog__message--"]').text().indexOf('0') > -1) {
                throw 'Place a MAX bet LIMITED';
            }
        }
        const freeBet = 'span:textEquals("Тебе доступен FreeBet")';
        const successSel = 'span:textEquals("Твой купон пустой"):visible';
        const errorSel = '#notification-text:visible';
        const limitedSel = 'div:contains("0 RUB - лимит по этому пари. Заключаем?"):last:visible';
        for (let i = 1; i >= 0; i--) {
            await waitForCondition(() => [successSel, errorSel, limitedSel, freeBet].some(s => $(s).length > 0
                    && $(s).text().trim() !== "Восстановление связи"),
                400, 3000 + 27000 * i, 'No bet result!');
        }
        if ($(limitedSel).length > 0) {
            await mouseChain({
                target: $('button:textEquals("Назад")')[0],
                events: fullClick, error: 'Назад'
            });
            dLog('red', 'Pari', `LIMITED ${$(limitedSel).text().trim()}`);
            throw `LIMITED ${$(limitedSel).text().trim()}`;
        }
        if ($(errorSel).length > 0) {
            throw `Error till bet X: ${$(errorSel).text().trim()}`;
        }
        // Hint: delay before collecting bet result
        await delayPromise(3000);
        const res = await collectBetResultsCupis([], true);
        dLog('green', 'PARI', `Collected ${res.external_id}/${res.stake}/${res.coef}`);
        const result = {
            external_id: res.external_id,
            odd: res.coef,
            stake: res.stake,
            max
        };
        delayPromise(1000).then(() => goLive());
        dLog('green', 'PARI', ['We return this: ', result]);
        return {success: true, message: result};
    };

    const collectBetResultsAir = async (data, inTime) => {
        let limit = inTime ? 1 : 30;
        if (!inTime && data.length === 2 && data[0] === 'limit') {
            limit = parseInt(data[1]);
            data = [];
        }
        const collected = [];
        let $historyRows = $([]);
        if (document.location.href.indexOf('/history/all') === -1) {
            const $historyLink = await waitForElement('a.head-section__link[href$="/my-account/history/all"]', 333, 20000);
            await delayPromise(500);
            await mouseChain({target: $historyLink[0], events: fullClick, error: '$historyLink'});
            $historyRows = await waitForElement('div.gaming-history__row', 333, 20000);
        }
        let count = 0;
        await $historyRows.eachAsync(async function () {
            count++;
            const $this = $(this);
            $this[0].scrollIntoView();
            const external_id = $this.find('div.gaming-history__payment-id b').text().replace(/[^\d.]/g, '').trim();
            const stake = parseFloat($this.find('span.gaming-history__bet').text().replace(/[^\d.]/g, '').trim());
            const result = parseFloat($this.find('div.stake-info').text().replace(/[^\d.]/g, '').trim());
            const status = $this.find('div.gaming-history__stake.value').hasClass('gaming-history__stake_win') === true ? 'WON'
                : $this.find('div.gaming-history__stake.value').hasClass('gaming-history__stake_uncalculated') === true ? 'ACCEPTED'
                    : result < stake ? 'LOSE' : 'REFUNDED';
            const coef = $this.find('div.gaming-history__coef').text().trim();
            if (data.length === 0 || data.indexOf(external_id) > -1) {
                collected.push({
                    external_id,
                    status,
                    match: $this.find('div.gaming-history__row-head div.gaming-history__event b').text().trim(),
                    coef,
                    stake: stake.toString(),
                    result: status === 'ACCEPTED' ? '' : result.toString(),
                });
            }
            if (inTime && collected.length > 0) {
                return false;
            }
            if (count >= limit || (data.length !== 0 && collected.length === data.length)) {
                return false;
            }
            await delayPromise(500);
        });
        dLog('green', 'Pari', ["We collected:", collected]);
        return inTime ? collected[0] : collected;
    };

    const collectBetResultsCupis = async (data, inTime) => {
        let limit = inTime ? 1 : 30;
        if (!inTime && data.length === 2 && data[0] === 'limit') {
            limit = parseInt(data[1]);
            data = [];
        }
        const collected = [];
        if (document.location.href.indexOf('/my-bets/open') === -1) {
            const $ma = await waitForElement('div[data-id="user-box-pic"]', 333, 30000);
            await delayPromise(500);
            await mouseChain({target: $ma[0], events: fullClick, error: '$ma'});
            const $mb = await waitForElement('md-list-cell[data-testid="my-account-item-bets"]', 333, 30000);
            await delayPromise(500);
            await mouseChain({target: $mb[0], events: fullClick, error: '$mb'});
        }
        let count = 0;
        for (const tab of ['noncalculated', 'calculated']) {
            const $ct = await waitForElement(`div[data-id="bets-history-tab-${tab}"]`, 333, 10000);
            await mouseChain({
                target: $ct[0], events: fullClick, error: `tab ${tab}`
            });
            const moreSel = 'button[data-id="bets-history-list-load-more"]';
            const more = async () => {
                if ($(moreSel).length > 0) {
                    await mouseChain({
                        target: $(moreSel)[0], events: fullClick, error: 'moreSel',
                        scroll: true
                    });
                    await delayPromise(3000);
                    return true;
                } else {
                    return false;
                }
            }
            let $lis = $([]);
            do {
                $lis = await waitForElement('li[data-id^="bets-history-single-bet-"], li[data-id^="bets-history-parlay-bet-"], li[class^="Bet__wrapper-"]',
                    333, 5000).catch(e => $([]));
            } while ($lis.length < limit && await more());
            await $lis.eachAsync(async function () {
                count++;
                const $this = $(this);
                $this[0].scrollIntoView();
                const external_id = $this.find('div[data-id="bets-history-bet-title"]').trt().split('/')[0].replace(/[^\d.]/g, '').trim();
                const stake = parseFloat($this.find('div[class^="Footer__row-"] strong').eq(0).text().replace(/[^\d.]/g, '').trim());
                const result = parseFloat($this.find('div[class^="Footer__row-"] strong').eq(1).text().replace(/[^\d.]/g, '').trim());
                const status = tab === 'noncalculated' ? 'ACCEPTED'
                    : result > stake ? 'WON' : result < stake ? 'LOSE' : 'REFUNDED';
                const coef = $this.find('div[class^="InfoSingle__body-"] span').eq(1).trt();
                if (data.length === 0 || data.indexOf(external_id) > -1) {
                    collected.push({
                        external_id,
                        status,
                        match: $this.find('span[class^="Competitor__name-"]').eq(0).trt() + ' - ' + $this.find('span[class^="Competitor__name-"]').eq(1).trt(),
                        bkPivot: $this.find('div[class^="InfoSingle__title-"]').trt(),
                        coef,
                        stake: stake.toString(),
                        result: status === 'ACCEPTED' ? '' : result.toString(),
                    });
                }
                if (inTime && collected.length > 0) {
                    return false;
                }
                if (count >= limit || (data.length !== 0 && collected.length === data.length)) {
                    return false;
                }
                await delayPromise(500);
            });
            if (count >= limit || (inTime && collected.length > 0)) {
                break;
            }
        }
        dLog('green', 'Pari', ["We collected:", collected]);
        return inTime ? collected[0] : collected;
    };

    /**
     * Proceeds bets and expresses
     * @param data {array}
     * @returns {Promise<any>}
     */
    const proceedBetOffshore = async data => {
        dLog('green', 'Pari', `proceedBetOffshore ${(isCoupon ? 'COUPON' : 'MAIN')}`);
        currentBetData = {
            data: data,
            max: 0
        };
        if (isCoupon) {
            const r = await proceedBetCoupon(data)
                .catch(e => ({success: false, message: e}));
            dLog('blue', 'Pari', ['Coupon result is:', r]);
            await bMess('PARIALL_PROXY_RESULT', true).set(r);
            delayPromise(2000)
                .then(() => mouseChain({
                    target: $('#btns_holder a')[0],
                    events: fullClick,
                    error: 'Close window'
                }));
            await delayPromise(1000000);
        } else {
            await closePreviousCoupons(false);
            await openCouponOffshore(data);
            dLog('green', 'Pari', 'We are waiting for bet result!');
            const res = await bMess('PARIALL_PROXY_RESULT', true).get(60000, 10000);
            dLog('red', 'Pari', ['Bet result is:', res]);
            return res;
        }
    };

    const proceedBetCoupon = async data => {
        dLog('green', 'Pari', `proceedBetCoupon`);
        const $tds = () => $('tbody.forScroll td');
        const max = parseFloat($tds().last().text().trim());
        if (!max) {
            throw 'There is no max!';
        }
        const betCoef = parseFloat(data[0].coef);
        let coef = parseFloat($tds().eq(6).text().trim());
        const getWillPlace = () => {
            let willPlace = parseFloat(data[0].stake);
            if (willPlace > max) {
                willPlace = max;
            }
            let $balance = $('#ownerInfo tr:first td:last b');
            let balance = parseFloat($balance.text().replace('руб.', '').replace(/[^\d.]/g, '').trim());
            if (isNaN(balance)) {
                throw 'Get balance error';
            } else if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            } else {
                return willPlace;
            }
        };
        const checkCoef = (betCoef, coef) => {
            if (!coef || !betCoef) {
                throw 'LOW_COEF - no coef or betCoef!';
            } else if (betCoef > coef) {
                throw `LOW_COEF - ${betCoef} > ${coef}`;
            } else if (coef > (betCoef * 1.2)) {
                throw `LOW_COEF - coef TOO BIG! ${coef} vs ${(betCoef * 1.2)}`;
            } else {
                return true;
            }
        };
        const checkSuccess = async () => {
            const getErrors = () => $('#stakeHolder ol li').text().trim();
            const getSuccess = () => $('p:contains("Ваша ставка принята.")').length > 0;
            await waitForCondition(() => getErrors().length > 0 || getSuccess(), 300, 60000, 'No bet result!');
            dLog('orange', 'Pari', `checkSuccess errors: '${getErrors()}', success: ${getSuccess()}!`);
            if (getSuccess()) {
                return true;
            } else if (getErrors().length > 0 && getErrors().indexOf('прием ставок прекращен') > -1) {
                throw `Were errors 1: '${getErrors()}'`;
            } else if (getErrors().length > 0 && getErrors().indexOf('коэффициент изменен на') > -1) {
                const check = /коэффициент изменен на "(\d.+)"/.exec(getErrors());
                if (check && check[1]) {
                    coef = parseFloat(check[1]);
                    return false;
                } else {
                    throw `Were errors 2: '${getErrors()}'`;
                }
            } else {
                return false;
            }
        };
        do {
            if (checkCoef(betCoef, coef)) {
                await clearAndSimulate($tds().eq(7).find('input')[0], getWillPlace());
                await mouseChain({target: $('#do_stake')[0], events: fullClick, error: 'do_stake'});
                await delayPromise(500);
            }
        } while (!await checkSuccess());
        dLog('green', 'Pari', `Bet should be placed, let's collect!`);
        await delayPromise(500);
        const res = {
            external_id: $('#stakeNo').text().trim().replace(/[^\d]/g, ''),
            odd: $tds().eq(5).text().trim(),
            stake: $tds().last().text().trim(),
            max
        };
        dLog('green', 'Pari', ['Bet result collected:', res]);
        return {success: true, message: res};
    };

    /**
     * Open event table, if we're on it already -  onSuccess
     * @param {object} data
     * @returns {Promise<string>}
     */
    const openEventOffshore = async data => {
        bsDebug(port, 'openEvent', data);
        const findEvent = async () => {
            let scoreErrors = [];
            let currentEvent = 0;
            while (currentEvent < data.length) {
                const eventName = `${data[currentEvent].team1} - ${data[currentEvent].team2}`.toLowerCase();
                let $found = null;
                let scoreText = '';
                $(isCupis ? '' : `div.sport.${sportsMain[data[currentEvent].sport]} td.td_n a`).each(function () {
                    scoreText = $(this).find('span').text();
                    let current = $(this).text().replace(scoreText, '').toLowerCase();
                    if (current === eventName || locutus_similar_text(current, eventName, true) > 80) {
                        $found = $(this);
                        return false;
                    }
                });
                if ($found === null) {
                    throw `${eventName} not found!`;
                }
                // Check score
                if (data[currentEvent].score !== '' && ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data[currentEvent].market) === -1
                    && data[currentEvent].sport === 'FOOTBALL'
                    && !checkScoreByText(scoreText.trim(), data[currentEvent].score)) {
                    scoreErrors.push('we need: ' + data[currentEvent].score + ' for ' + eventName + ', we have: ' + scoreText.trim());
                } else {
                    // Select element if it is necessary
                    let $checkbox = $found.parent().parent().find('td:first input[type="checkbox"]:visible');
                    if (!$checkbox.prop('checked')) {
                        await mouseChain({target: $checkbox[0], events: ['click'], scroll: true, error: 'ECH'});
                        await delayPromise(2000);
                    }
                }
                currentEvent++;
            }
            if (scoreErrors.length !== 0) {
                throw 'SCORE_CHANGED: ' + scoreErrors.join(', ');
            }
        };
        // Check we're on event page already
        if (['/bet.html?', '/event/'].some(t => window.location.href.indexOf(t) > -1)) {
            await waitForCondition(() => $('tbody.row1').length > 0, 500, 25000, 'Still can not check!');
            if (checkWeAreThereAndScore(data) === true) {
                return 'we are on event already!';
            } else {
                await mouseChain({target: $('#tbLive a')[0], events: fullClick, scroll: true, error: 'GTL 3'});
            }
        }
        await waitForCondition(() => ['/live.html', '/live'].some(t => window.location.href.indexOf(t) > -1)
                && ((!isCupis && $('div.sport.football').length > 1) || isCupis), 777, 10000,
            'We are not in Live nor footballs presented :(');
        await findEvent();
        await mouseChain({
            target: $('#liveSheduleButtonsTop button.btn_live:visible')[0],
            events: fullClick,
            scroll: true,
            error: 'Final1',
        });
        return 'We must be on event!';
    };

    const checkScoreByText = function (scoreText, score) {
        //bsDebug(port, 'checkScoreByText: "' + scoreText + '" === "' + score + '"');
        const res = /(^\d+-\d+)/.exec(scoreText);
        return res !== null && typeof res[1] === 'string' && res[1].replace('-', ':') === score;
    };

    const checkWeAreThereAndScore = data => {
        // Hint: Let's get open events first and then check it
        let opened = [];
        let errors = [];
        $('span.nol').parent().parent().each(function () {
            let $element = $(this).find('td').eq(1);
            let league = $(this).closest('div.container').find('h3:first').text().trim();
            if (typeof $element === 'undefined' || $element.length === 0) {
                errors.push('$element = ' + (typeof $element) + ' / ' + $element.length);
                return false;
            }
            let teams = $element.html().replace($element.find('span').html(), '').split('<br>');
            console.log('%c' + `Teams: %O`, 'background: yellow; color: black; font-size: 12px; font-weight: bold; padding: 3px;', teams);
            if (teams.length > 2) {
                opened.push({
                    team1: teams[0].toLowerCase(),
                    team2: teams[1].toLowerCase(),
                    scoreText: $element.find('span').text().trim(),
                    league: league
                });
            }
        });
        if (errors.length > 0) {
            throw  'checkWeAreThereAndScore: ' + errors.push('; ');
        }
        let checked = [];
        data.forEach((d, dIdx) => {
            const team1 = d.team1.toLowerCase(), team2 = d.team2.toLowerCase();
            console.log('%c' + `${team1}/${team2}`, 'background: yellow; color: black; font-size: 12px; font-weight: bold; padding: 3px;');
            opened.forEach((o, oIdx) => {
                if ((o.team1 === team1 && o.team2 === team2)
                    || (locutus_similar_text(o.team1 + ' - ' + o.team2, team1 + ' - ' + team2, true) > 80)) {
                    if (d.score !== '' && ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(d.market) === -1 && !checkScoreByText(o.scoreText, d.score)) {
                        errors.push('we need: ' + d.score + ' for ' + team1 + ' - ' + team2 + ', we have: ' + o.scoreText);
                    } else {
                        checked.push({current: dIdx, opened: oIdx, league: o.league});
                    }
                }
            });
        });
        console.log('%c' + `Checked: %O`, 'background: yellow; color: black; font-size: 12px; font-weight: bold; padding: 3px;', checked);
        if (errors.length === 0 && checked.length === opened.length && data.length === opened.length) {
            checked.sort((a, b) => (a.opened > b.opened) ? 1 : ((b.opened > a.opened) ? -1 : 0));
            reordered = [];
            checked.forEach(c => (console.log(c), data[c.current].ourLeague = c.league, reordered.push(data[c.current])));
            data = reordered;
            return true;
        } else if (checked.length !== opened.length || data.length !== opened.length) {
            return false;
        } else {
            throw 'SCORE_CHANGED ' + errors.join('; ') + checked.length + '/' + opened.length + '/' + data.length;
        }
    };

    const checkCoefsAir = async data => {
        let findInData = function (match) {
            let result = false;
            $.each(data, function () {
                let localMatch = this.team1.toLowerCase() + ' - ' + this.team2.toLowerCase();
                if (localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 60) {
                    result = this;
                    return false;
                }
            });
            return result;
        };

        for (let i = 0; i < data.length; i++) {
            let errors = [];
            let checked = 0;
            let totalCoef = 1;
            //find data
            await $('betslip-bet.betslip-bet').eachAsync(async function () {
                const match = $(this).find('a.bet__heading').text().trim();
                if ($(this).hasClass('removed')) {
                    errors.push(match + ' LOW_COEF, market unavailable!');
                    checked++;
                    return true;
                }
                let localCoef = parseFloat($(this).find('span.bet__coefficient ').text().trim());
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
            if (!newAPI && errors.length === 0 && checked === data.length) {
                dLog('green', 'Pari', 'Coefs fine!');
            } else if (newAPI && errors.length === 0 && checked === data.length) {
                const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
                if (totalCoef >= nCheck * 1.2) {
                    throw 'Coef TOO BIG: ' + totalCoef + ' instead of ' + data[0].coef;
                } else if (totalCoef < nCheck) {
                    throw 'LOW_COEF ' + data[0].coef + ' > ' + totalCoef;
                } else {
                    dLog('green', 'Pari', 'Coefs fine!');
                }
            } else {
                throw errors.join('; ') + (checked !== data.length ? ' some stakes not checked ('
                    + checked + '/' + data.length + ')!' : '');
            }
        }
    }

    const checkCoefsCupis = async data => {
        const findInData = evt => data.find(bet => [1, 2]
            .every(i => bet[`team${i}`].length > 0 && evt.indexOf(bet[`team${i}`].toLowerCase()) > -1));
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $('div[data-id="betslip-outcome-block"]').each(function () {
            const $row = $(this);
            const match = $row.find('span[data-id="betslip-outcome-event-name"]').trt();
            const coef = parseFloat($row.find('div[data-id="animated-odds-value"]').trt());
            const d = findInData(match.toLowerCase());
            console.log(`${match}, ${coef}`, d);
            totalCoef = totalCoef * coef;
            if ($row.next().text().trim().indexOf('удалён или остановлен') > -1) {
                errors.push(`${match} - BET SUSPENDED!`);
            } else if (isNaN(coef)) {
                errors.push(match - ' wrong coef!');
            } else if (!d || (d.coef !== '' && isNaN(parseFloat(d.coef)))) {
                errors.push(match + ' - wrong data coef!');
            } else if (!newAPI && d.coef !== '') {
                const dCoef = parseFloat(d.coef);
                if (coef < dCoef) {
                    errors.push(`${match} - we need ${dCoef}, we have ${coef}!`);
                } else if (coef > dCoef * 1.2) {
                    errors.push(`${match} - coef TOO BIG, we need ${dCoef}, we have ${coef}!`)
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
        if (newAPI) {
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
            if (totalCoef >= nCheck * 1.2) {
                throw `Coef TOO BIG: ${totalCoef} instead of ${data[0].coef}`;
            } else if (totalCoef < nCheck) {
                throw `LOW_COEF: ${data[0].coef} > ${totalCoef}`;
            }
        }
        return totalCoef;
    };
    // await checkCoefsCupis([{team1: '', team2: '', coef: ''}, {team1: '', team2: '', coef: ''}]);

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
            //s      TEST TOP FINISH */
            let checkType = function () {
                return new Promise(function (onSuccess, onReject) {
                    let $rt1 = $('#r1');
                    if (data.length > 1 && !$rt1.prop('checked')) {
                        mouseChain({target: $rt1[0], events: ['click']})
                            .then(onSuccess)
                            .catch((e) => onReject('checkType: ' + e));
                    } else {
                        onSuccess();
                    }
                });
            };
            let checkCoupon = function () {
                return new Promise(function (onSuccess, onReject) {
                    let findInData = function (match) {
                        let result = false;
                        $.each(data, function () {
                            if (match.indexOf(this.team1.toLowerCase()) > -1 && match.indexOf(this.team2.toLowerCase()) > -1) {
                                result = this;
                                return false;
                            }
                        });
                        return result;
                    };
                    let $coupons = $('#wb tr:has("td.td_cf")');
                    let errors = [];
                    let checked = 0;
                    $coupons.each(function () {
                        let $this = $(this);
                        let matchDraft = $this.find('td:not([class]):not([align])').eq(0).text().replace('. 1-й тайм', '').trim();
                        let match = matchDraft;
                        for (let cData in data) {
                            match = match.replace(data[cData].ourLeague + '.', '');
                        }
                        match = match.trim();
                        let localCoef = parseFloat($this.find('td.td_cf').text().trim());
                        let localData = findInData(match.toLowerCase());
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
            checkType()
                .then(checkCoupon)
                .then((m) => onSuccess(m))
                .catch((e) => onReject(e));
            /* TEST BOTTOM START
        })([
            {team1: 'Терсана', team2: 'Домиат', coef: '1.25'},
            {team1: 'АФАД Джекану', team2: 'Бассам', coef: '1.23'}
        ]);
        //TEST BOTTOM FINISH */
        });
    };

    const getBetElementOffshore = data => new Promise(function (onSuccess, onReject) {
        //dLog('red', 'Pari', ['getBetElementOffshore data: ', data]);
        let currentEvent = 0;
        let allMarkets = {
            'ONE_TWO': {
                'ONE': {root: ['main'], subroots: ['П1'], pivotKey: 0},
                'TWO': {root: ['main'], subroots: ['П2'], pivotKey: 0},
                'DRAW': {root: ['main'], subroots: ['X'], pivotKey: 0},
                'ONE_DRAW': {root: ['main'], subroots: ['1X'], pivotKey: 0},
                'TWO_DRAW': {root: ['main'], subroots: ['X2'], pivotKey: 0},
                'ONE_TWO': {root: ['main'], subroots: ['12'], pivotKey: 0}
            },
            'TOTAL': {
                'OVER': {
                    root: ['main', 'tbody:contains("Дополнительные тоталы:"):last table.ps tr:eq(1)'],
                    subroots: ['Т', '(#PIVOTR#)'], pivotKeys: ['Б', 'больше']
                },
                'UNDER': {
                    root: ['main', 'tbody:contains("Дополнительные тоталы:"):last table.ps tr:eq(1)'],
                    subroots: ['Т', '(#PIVOTR#)'], pivotKeys: ['М', 'меньше']
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    root: ['main', 'tbody:contains("Дополнительные тоталы:"):last tr:contains("#TEAM1B#"):last'],
                    subroots: ['iТ', '(#PIVOTR#)'], pivotKeys: ['Б', 'больше'], row: 0
                },
                'UNDER': {
                    root: ['main', 'tbody:contains("Дополнительные тоталы:"):last tr:contains("#TEAM1B#"):last'],
                    subroots: ['iТ', '(#PIVOTR#)'], pivotKeys: ['М', 'меньше'], row: 0
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    root: ['main', 'tbody:contains("Дополнительные тоталы:"):last tr:contains("#TEAM2B#"):last'],
                    subroots: ['iТ', '(#PIVOTR#)'], pivotKeys: ['Б', 'больше'], row: 1
                },
                'UNDER': {
                    root: ['main', 'tbody:contains("Дополнительные тоталы:"):last tr:contains("#TEAM2B#"):last'],
                    subroots: ['iТ', '(#PIVOTR#)'], pivotKeys: ['М', 'меньше'], row: 1
                },
            },
            'HDP': {
                'HOME': {
                    root: [
                        'main',
                        'tbody:contains("Дополнительные форы:"):last tr:contains("#TEAM1B#:"):last',
                        'tbody:contains("Дополнительные форы:"):last tr:contains("#TEAM1B#:"):last'
                    ],
                    subroots: ['Фора', '(#PIVOTR#)', '(#PIVOT#)'], pivotKey: 'КФ', row: 0
                },
                'AWAY': {
                    root: [
                        'main',
                        'tbody:contains("Дополнительные форы:"):last tr:contains("#TEAM2B#:"):last',
                        'tbody:contains("Дополнительные форы:"):last tr:contains("#TEAM2B#:"):last'
                    ],
                    subroots: ['Фора', '(#PIVOTR#)', '(#PIVOT#)'], pivotKey: 'КФ', row: 1
                }
            },

            'CORNER_TOTAL': {
                'OVER': {
                    root: ['main', 'tbody:contains("Дополнительные тоталы:"):last table.ps tr:eq(1)'],
                    subroots: ['Т', '(#PIVOTR#)'], pivotKeys: ['Б', 'больше']
                },
                'UNDER': {
                    root: ['main', 'tbody:contains("Дополнительные тоталы:"):last table.ps tr:eq(1)'],
                    subroots: ['Т', '(#PIVOTR#)'], pivotKeys: ['М', 'меньше']
                },
            },
            'CORNER_HDP': {
                'HOME': {
                    root: [
                        'main',
                        'tbody:contains("Дополнительные форы:"):last tr:contains("#TEAM1B#:"):last',
                        'tbody:contains("Дополнительные форы:"):last tr:contains("#TEAM1B#:"):last'
                    ],
                    subroots: ['Фора', '(#PIVOTR#)', '(#PIVOT#)'], pivotKey: 'КФ', row: 0
                },
                'AWAY': {
                    root: [
                        'main',
                        'tbody:contains("Дополнительные форы:"):last tr:contains("#TEAM2B#:"):last',
                        'tbody:contains("Дополнительные форы:"):last tr:contains("#TEAM2B#:"):last'
                    ],
                    subroots: ['Фора', '(#PIVOTR#)', '(#PIVOT#)'], pivotKey: 'КФ', row: 1
                }
            },

            half: {
                'ONE_TWO': {
                    'ONE': {root: ['h1_main'], subroots: ['П1'], pivotKey: 0},
                    'TWO': {root: ['h1_main'], subroots: ['П2'], pivotKey: 0},
                    'DRAW': {root: ['h1_main'], subroots: ['X'], pivotKey: 0},
                    'ONE_DRAW': {root: ['h1_main'], subroots: ['1X'], pivotKey: 0},
                    'TWO_DRAW': {root: ['h1_main'], subroots: ['X2'], pivotKey: 0},
                    'ONE_TWO': {root: ['h1_main'], subroots: ['12'], pivotKey: 0}
                },
                'TOTAL': {
                    'OVER': {root: ['h1_main', 'h1_main_2', 'h1_main_3'], subroots: ['Т'], pivotKey: 'Б'},
                    'UNDER': {root: ['h1_main', 'h1_main_2', 'h1_main_3'], subroots: ['Т'], pivotKey: 'М'},
                },
                'T1_TOTAL': {
                    'OVER': {root: ['h1_main'], subroots: ['iТ'], pivotKey: 'Б', row: 0},
                    'UNDER': {root: ['h1_main'], subroots: ['iТ'], pivotKey: 'М', row: 0},
                },
                'T2_TOTAL': {
                    'OVER': {root: ['h1_main'], subroots: ['iТ'], pivotKey: 'Б', row: 1},
                    'UNDER': {root: ['h1_main'], subroots: ['iТ'], pivotKey: 'М', row: 1},
                },
                'HDP': {
                    'HOME': {
                        root: ['h1_main', 'h1_main_2', 'h1_main_3'],
                        subroots: ['Фора'],
                        pivotKey: 'КФ',
                        row: 0
                    },
                    'AWAY': {
                        root: ['h1_main', 'h1_main_2', 'h1_main_3'],
                        subroots: ['Фора'],
                        pivotKey: 'КФ',
                        row: 1
                    }
                },
                'CORNER_TOTAL': {
                    'OVER': {root: ['h1_main', 'h1_main_2', 'h1_main_3'], subroots: ['Т'], pivotKey: 'Б'},
                    'UNDER': {root: ['h1_main', 'h1_main_2', 'h1_main_3'], subroots: ['Т'], pivotKey: 'М'},
                },
                'CORNER_HDP': {
                    'HOME': {
                        root: ['h1_main', 'h1_main_2', 'h1_main_3'],
                        subroots: ['Фора'],
                        pivotKey: 'КФ',
                        row: 0
                    },
                    'AWAY': {
                        root: ['h1_main', 'h1_main_2', 'h1_main_3'],
                        subroots: ['Фора'],
                        pivotKey: 'КФ',
                        row: 1
                    }
                },
            }
        };
        let markets = {};
        let performGetStarted = Date.now();
        let totalReport = [];

        let checkElements = function () {
            let allGood = true;
            $.each(totalReport, function () {
                if ($(this).length !== 1) {
                    allGood = false;
                    return false;
                }
            });
            return allGood;
        };

        let report = function (success, message) {
            if (success && message.length === 1 && checkElements()) {
                totalReport.push(message.is('td') ? message.find('u') : message);
                if (currentEvent + 1 < data.length) {
                    currentEvent++;
                    setTimeout(performGet, 1000);
                } else {
                    onSuccess(totalReport);
                }
            } else if (Date.now() - performGetStarted < 20000) {
                setTimeout(performGet, 1000);
            } else {
                onReject(message);
            }
        };

        //bsDebug(port, 'Markets is:', markets);

        let cMarket;

        let prepareMarkets = function () {
            markets = {};
            if (data[currentEvent].time_value === 'HALF_TIME') {
                markets = JSON.parse(JSON.stringify(allMarkets.half));//Object.assign({}, allMarkets.half);
            } else {
                markets = JSON.parse(JSON.stringify(allMarkets));//Object.assign({}, allMarkets);
            }
            //bsDebug(port, 'allMarkets: ', allMarkets);
            //bsDebug(port, 'Markets for: ' + currentEvent, markets);
            if (typeof markets[data[currentEvent].market] === 'undefined'
                || typeof markets[data[currentEvent].market][data[currentEvent].target] === 'undefined') {
                onReject('Unsupported ' + data[currentEvent].time_value + '/' + data[currentEvent].market
                    + '/' + data[currentEvent].target);
                return;
            }
            let $teamsEl = $('span.nol').parent().parent().eq(currentEvent).find('td').eq(1);
            let teamsDraft = $teamsEl.html(); // $('tbody.row' + (currentEvent + 1) + ' tr.bk td').eq(1).html();
            if (typeof teamsDraft === 'undefined' && Date.now() - performGetStarted < 10000) {
                delayPromise(1000).then(prepareMarkets);
                return;
            }
            let teams = teamsDraft.replace($teamsEl.find('span').html(), '').split('<br>');
            if (teams.length > 2) {
                data[currentEvent].team1b = teams[0];
                data[currentEvent].team2b = teams[1];
            } else if (Date.now() - performGetStarted < 10000) {
                delayPromise(1000).then(prepareMarkets);
                return;
            } else {
                onReject('No teams! ' + currentEvent + ': ' + teams);
                return;
            }
            //bsDebug(port, 'Data for: ' + currentEvent, data[currentEvent]);
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
                        res = res.replace('-', '–');
                    }
                }
                return res;
            };
            let replaceInner = function (element, parent, index) {
                if (typeof element === 'string') {
                    parent[index] = element.replace('#TEAM1#', data[currentEvent].team1.toLowerCase()).replace('#TEAM2#', data[currentEvent].team2.toLowerCase())
                        .replace('#TEAM1B#', data[currentEvent].team1b).replace('#TEAM2B#', data[currentEvent].team2b)
                        .replace('#PIVOT#', data[currentEvent].pivot).replace('#PIVOTR#',
                            specialPivotFormatter(data[currentEvent].market, data[currentEvent].pivot))
                        .replace('#CURRENTROW#', (currentEvent + 1).toString());
                } else if (typeof element === 'object') {
                    for (let i in element) {
                        replaceInner(element[i], element, i);
                    }
                } else {
                    // console.log(typeof element + ' not supported! (' + element + ')');
                }
            };
            replaceInner(markets, null, null);
            //console.log(markets);
            //bsDebug(port, 'Markets:', markets[data.market][data.target]);
        };

        let findInElement = function ($element, text, afterVal) {
            let after = afterVal || false;
            let index = -1;
            $element.each(function (idx, val) {
                if ($(val).text().trim() === (after === false ? text : after)) {
                    if (after === false) {
                        index = idx;
                        return false;
                    } else {
                        after = false;
                        return true;
                    }
                }
            });
            return index;
        };

        let checkMain = function (checking) {
            let $allThs = $('th:contains("Событие")');
            let $ths = [];
            if ($allThs.length === 1 && data.length > 1) {
                $ths = $allThs.eq(0).parent().find('th');
            } else if ($allThs.length === 1 && data.length === 1) {
                $ths = $('div.wrapper tbody:not([class])').eq(0).find('tr th');
            } else if ($allThs.length === data.length) {
                $ths = $allThs.eq(currentEvent).parent().find('th');
            } else {
                bsError(port, 'checkMain unexpected situation: $allThs - ' + $allThs.length + ', data - ' + data.length);
                return false;
            }
            let index = findInElement($ths, checking.subroot);
            let $baseForCandidates = $('span.nol').parent().parent();
            let $candidates = checking.root === 'main'
                ? $baseForCandidates.eq(currentEvent).find('td') // $('tbody.row' + rowIdx + ' tr.bk:first td')
                : (checking.root === 'h1_main'
                    ? $baseForCandidates.parent().eq(currentEvent).next().find('tr.bk').eq(0).find('td')
                    : $baseForCandidates.parent().eq(currentEvent).next().find('tr.bk').eq(parseInt(checking.root.replace('h1_main_', '')) - 1).find('td'));
            let csOffset = 0;
            if (checking.root.indexOf('h1_main_') > -1 && index > -1) {
                // calculate colspans before index!
                for (let checkCS = 0; checkCS < index; checkCS++) {
                    if ($candidates.eq(checkCS).prop('colspan') > 1) {
                        csOffset = csOffset + (parseInt($candidates.eq(checkCS).prop('colspan')) - 1);
                    }
                }
                index = index - csOffset;
            }
            if (index > -1 && $candidates.length >= index - 1) {
                if (checking.pivot === 0) {
                    report(true, $candidates.eq(index));
                    return true;
                } else {
                    let needPivot = parseFloat(data[currentEvent].pivot);
                    let havePivot;
                    if (checking.row !== false) {
                        havePivot = parseFloat($candidates.eq(index).find('b').eq(checking.row).text().trim().replace('–', '-'));
                    } else {
                        havePivot = parseFloat($candidates.eq(index).text().trim().replace('–', '-'));
                    }
                    console.log('We have: "' + havePivot + '", we need: "' + needPivot + '", ' + (havePivot === needPivot));
                    if (!isNaN(havePivot) && havePivot === needPivot) {
                        let needIndex = findInElement($ths, checking.pivot, checking.row === false ? false : checking.subroot);
                        if (checking.root.indexOf('h1_main_') > -1) {
                            needIndex = needIndex - csOffset;
                        }
                        console.log(needIndex + ' = ' + checking.row + ', row? ' + (checking.row !== false));
                        if (needIndex > -1 && $candidates.length >= needIndex - 1) {
                            if (checking.row !== false) {
                                report(true, $candidates.eq(needIndex).find('u').eq(checking.row));
                            } else {
                                report(true, $candidates.eq(needIndex));
                            }
                            return true;
                        } else {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
            } else {
                return false;
            }
        };

        let performGet = function () {
            prepareMarkets();
            let performCheck = function (checking) {
                if (['main', 'h1_main', 'h1_main_2'].indexOf(checking.root) > -1 && typeof checking.subroot === 'string') {
                    return checkMain(checking);
                } else {
                    //let $cRoot = $('span.nol').parent().parent().parent().parent().eq(currentEvent).find(checking.root);
                    let $cRoot = $('span.nol').parent().parent().parent().eq(currentEvent).next().find(checking.root);
                    console.log($cRoot);
                    let $td = $cRoot.find('td:contains("' + checking.subroot + '")');
                    console.log($td);
                    if ($td.length === 1) {
                        let parts = $td.text().trim().split(';');
                        for (let cPart in parts) {
                            if (parts.hasOwnProperty(cPart) && parts[cPart].indexOf(checking.subroot) > -1) {
                                if (checking.pivot === 'меньше') {
                                    report(true, $td.find('u').eq(parseInt(cPart) + 1));
                                } else {
                                    report(true, $td.find('u').eq(cPart));
                                }
                                return true;
                            }
                        }
                    } else {
                        return false;
                    }
                }
            };
            let weAreHappy = false;
            cMarket = markets[data[currentEvent].market][data[currentEvent].target];
            bsDebug(port, 'getBetElement', cMarket);
            //console.log(cMarket);
            for (let i in cMarket.root) {
                if (cMarket.root.hasOwnProperty(i)) {
                    let checking = {
                        root: cMarket.root[i],
                        subroot: typeof cMarket.subroots[i] !== 'undefined'
                            ? cMarket.subroots[i]
                            : (typeof cMarket.subroots[0] !== 'undefined' ? cMarket.subroots[0] : false),
                        pivot: typeof cMarket.pivotKeys !== 'undefined'
                            ? (typeof cMarket.pivotKeys[i] !== 'undefined'
                                ? cMarket.pivotKeys[i]
                                : (typeof cMarket.pivotKeys[0] !== 'undefined' ? cMarket.pivotKeys[0] : false))
                            : cMarket.pivotKey,
                        row: typeof cMarket.row !== 'undefined' ? cMarket.row : false
                    };
                    console.log(checking);
                    if (performCheck(checking)) {
                        weAreHappy = true;
                        break;
                    }
                }
            }
            if (!weAreHappy) {
                report(false, data[currentEvent].time_value + '/' + data[currentEvent].market
                    + '/' + data[currentEvent].target + ' for ' + data[currentEvent].team1 + ' - ' + data[currentEvent].team2
                    + ' (' + data[currentEvent].pivot + ') not found :(');
            }
        };

        performGet();
    });

    const getBetElementCupis = async data => {
        //#-#-START
        const $teams = await waitForElement('span[data-id="competitor-home"], span[data-id="competitor-away"]',
            300, 10000, false, 2, 'No teams!');
        await delayPromise(500);
        [0, 1].forEach(i => data[`team${(i + 1)}`] = $teams.eq(i).text().trim());
        console.log(data);

        const markets = {
            'CORNER_TOTAL': {
                'OVER': {r: ['Угловые. Тотал'], s: ['#PIVOT#'], p: ['0']},
                'UNDER': {r: ['Угловые. Тотал'], s: ['#PIVOT#'], p: ['1']},
            },
            'TOTAL': {
                'OVER': {r: ['Тотал'], s: ['#PIVOT#'], p: ['0']},
                'UNDER': {r: ['Тотал'], s: ['#PIVOT#'], p: ['1']},
            },
            'T1_TOTAL': {
                'OVER': {r: ['Индивидуальный тотал #TEAM1#'], s: ['#PIVOT#'], p: ['0']},
                'UNDER': {r: ['Индивидуальный тотал #TEAM1#'], s: ['#PIVOT#'], p: ['1']},
            },
            'T2_TOTAL': {
                'OVER': {r: ['Индивидуальный тотал #TEAM2#'], s: ['#PIVOT#'], p: ['0']},
                'UNDER': {r: ['Индивидуальный тотал #TEAM2#'], s: ['#PIVOT#'], p: ['1']},
            },
            'HDP': {
                // 0, -1, +1.5, -1.5
                'HOME': {r: ['Фора'], p: ['Ф1(#PIVOTH#)', '#TEAM1#(#PIVOTH#)',]},
                'AWAY': {r: ['Фора'], p: ['Ф2(#PIVOTH#)', '#TEAM2#(#PIVOTH#)',]},
            },
            'ONE_TWO': {
                'ONE': {r: ['Победитель матча', 'Победитель матча (основное время)', 'Результат матча (основное время)'], p: ['П1', '#TEAM1#',]},
                'TWO': {r: ['Победитель матча', 'Победитель матча (основное время)', 'Результат матча (основное время)'], p: ['П2', '#TEAM2#',]},
                'DRAW': {r: ['Победитель матча', 'Победитель матча (основное время)', 'Результат матча (основное время)'], p: ['Х', 'Ничья',]},
                'ONE_DRAW': {r: ['Двойной исход'], p: ['1X', 'X1', '#TEAM1# не проиграет',]},
                'TWO_DRAW': {r: ['Двойной исход'], p: ['2X', 'X2', '#TEAM2# не проиграет',]},
                'ONE_TWO': {r: ['Двойной исход'], p: ['1 или 2', '1 или 2', 'Не будет ничьей',]},
            },
        };

        if (!markets[data.market] || !markets[data.market][data.target]) {
            throw `Unsupported ${data.sport}/${data.time_value}/${data.market}/${data.target}!`;
        }

        const m = markets[data.market][data.target];
        const makePivot = (pivot, plus) => {
            const pvt = typeof pivot !== 'number' ? parseFloat(pivot) : pivot;
            return (pivot > 0 && plus ? '+' : '') + pvt.toString();
        };

        const replace = (market, target) => {
            const td = data.time_value.replace(/[^\d]/g, '').trim();
            if (data.time_value !== 'FULL_TIME' && data.sport === 'FOOTBALL') {
                return market === 'ONE_TWO'
                    ? (['ONE_DRAW', 'TWO_DRAW', 'ONE_TWO'].indexOf(target) > -1 ? 'Двойной исход. 1-й тайм' : 'Результат. 1-й тайм')
                    : ({
                        'HDP': 'Фора. 1-й тайм',
                        'TOTAL': 'Тотал. 1-й тайм',
                        'T1_TOTAL': 'Индивидуальный тотал #TEAM1#. 1-й тайм',
                        'T2_TOTAL': 'Индивидуальный тотал #TEAM2#. 1-й тайм',
                        'CORNER_TOTAL': 'Угловые. Тотал. 1-й тайм',
                    })[market];
            } else if (data.time_value !== 'FULL_MATCH' && data.sport === 'HOCKEY') {
                return market === 'ONE_TWO'
                    ? (['ONE_DRAW', 'TWO_DRAW', 'ONE_TWO'].indexOf(target) > -1 ? `Двойной исход. ${td}-й период` : `Результат. ${td}-й период`)
                    : ({
                        'HDP': `Фора. ${td}-й период`,
                        'TOTAL': `Тотал. ${td}-й период`,
                        'T1_TOTAL': `Индивидуальный тотал #TEAM1#. ${td}-й период`,
                        'T2_TOTAL': `Индивидуальный тотал #TEAM2#. ${td}-й период`,
                    })[market];
            } else if (data.time_value.indexOf('FULL') > -1 && data.sport === 'HOCKEY' && data.market === 'ONE_TWO') {
                return ['ONE', 'TWO', 'DRAW'].indexOf(target) > -1 ? 'Победитель матча' : 'Двойной исход';
            } else if (data.sport === 'TENNIS') {
                if (data.time_value !== 'FULL_MATCH' && data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') === -1) {
                    return market === 'ONE_TWO'
                        ? `Победа. ${td}-й сет`
                        : ({
                            'HDP': `Фора. ${td}-й сет`,
                            'TOTAL': `Тотал. ${td}-й сет`,
                        })[market];
                } else if (data.time_value !== 'FULL_MATCH' && data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') > -1) {
                    const parts = data.time_value.split('_GAME_');
                    return market === 'ONE_TWO' ? `Победитель. Сет ${parts[0].replace(/[^\d]/g, '').trim()} Гейм ${parts[1].trim()}` : m.r;
                } else {
                    return market === 'ONE_TWO' ? `Победа` : m.r;
                }
            } else if (data.time_value !== 'FULL_MATCH' && data.sport === 'CYBERSPORT') {
                return market === 'ONE_TWO'
                    ? `Победа. Карта ${td}`
                    : ({
                        'HDP': `Фора. Карта ${td}`,
                        'TOTAL': `Тотал. Карта ${td}`,
                    })[market];
            } else if (data.time_value.indexOf('FULL') > -1 && data.sport === 'CYBERSPORT') {
                return market === 'ONE_TWO'
                    ? `Победа`
                    : ({
                        'HDP': `Фора`,
                        'TOTAL': `Тотал`,
                    })[market];
            } else if (data.sport === 'TABLETENNIS') {
                if (data.time_value !== 'FULL_MATCH') {
                    return market === 'ONE_TWO'
                        ? `Победа. ${td}-й сет`
                        : ({
                            'HDP': `Фора. ${td}-й сет`,
                            'TOTAL': `Тотал. ${td}-й сет`,
                        })[market];
                } else {
                    return market === 'ONE_TWO' ? `Победа` : m.r;
                }
            } else if (data.time_value !== 'FULL_MATCH' && data.sport === 'BASEBALL') {
                return market === 'ONE_TWO'
                    ? (['ONE_DRAW', 'TWO_DRAW', 'ONE_TWO'].indexOf(target) > -1 ? `Двойной исход. ${td}-й иннинг` : `Результат. ${td}-й иннинг`)
                    : ({
                        'HDP': `Фора. ${td}-й иннинг`,
                        'TOTAL': `Тотал. ${td}-й иннинг`,
                        'T1_TOTAL': `Индивидуальный тотал #TEAM1#. ${td}-й иннинг`,
                        'T2_TOTAL': `Индивидуальный тотал #TEAM2#. ${td}-й иннинг`,
                    })[market];
            } else if (data.sport === 'BASKETBALL') {
                if (data.time_value.indexOf('FULL') > -1) {
                    return data.market === 'ONE_TWO' ? 'Результат' : m.r;
                } else {
                    return m.r;
                }
            } else if (data.sport === 'VOLLEYBALL') {
                if (data.time_value.indexOf('FULL') > -1) {
                    return data.market === 'ONE_TWO' ? 'Победа' : m.r;
                } else {
                    return data.market === 'ONE_TWO' ? `Победа. ${td}-й сет` : ({
                        'HDP': `Фора. ${td}-й сет`,
                        'TOTAL': `Тотал. ${td}-й сет`,
                    })[data.market];
                }
            } else {
                return m.r;
            }
        };
        m.r = replace(data.market, data.target);
        if (!m.r) {
            throw `There is no ${data.market}/${data.target} for ${data.time_value}`
        }

        replaceInner(m, {
            '#TEAM1#': data.team1,
            '#TEAM2#': data.team2,
            '#PIVOT#': makePivot(data.pivot),
            '#PIVOTH#': makePivot(data.pivot, true),
        });

        bsDebugDouble(port, 'Market is:', m);

        const allSel = 'div[data-id^="event-markets-tab"]:textEquals("Все")';
        await waitForElement(allSel, 300, 30000, false, 1, 'No allSel');
        await delayPromise(250);

        if ($(allSel).attr('class').split(' ').length !== 4) {
            await mouseChain({target: $(allSel)[0], events: fullClick, error: 'allSel', scroll: true});
            await delayPromise(3000);
        }

        await waitForElement('div[data-id^="market-expansion-panel-header-"]',
            300, 30000, false, 1, 'No markets!');
        await delayPromise(250);

        let $found = $([]);

        for (const r of m.r) {
            const rootSel = `div[data-id^="market-expansion-panel-header-"] span:textEquals("${r}")`;
            if ($(rootSel).length === 0) {
                console.log('%c' + `No root: '${rootSel}'`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                continue;
            }
            console.log(`Root sel is: ${rootSel}`);
            if ($(rootSel).parent().find('div[role="button"] use').attr('xlink:href') === '#UII_ExpandMore') {
                await mouseChain({
                    target: $(rootSel).parent().find('div[role="button"]')[0],
                    events: fullClick,
                    error: 'svg',
                    scroll: true
                });
                await delayPromise(2000);
            }
            $(rootSel)[0].scrollIntoView();
            for (const item of m[data.market.indexOf('TOTAL') > -1 ? 's' : 'p']) {
                if (data.market.indexOf('TOTAL') > -1) {
                    $(rootSel).parent().parent().parent().find('div[data-id="outcome"]').parent().each(function () {
                        const $pvt = $(this).find(`div:first:textEquals("${item}")`);
                        if ($pvt.length === 1) {
                            $found = $pvt.parent().find('div[data-id="outcome"]').eq(m.p);
                        }
                    })
                } else {
                    $(rootSel).parent().parent().parent().find('div[data-id="outcome"]').each(function () {
                        const test = $(this).find('div').first().text().trim();
                        if (test === item) {
                            $found = $(this);
                            return false;
                        } else {
                            console.log(`'${test}' !== '${item}'`);
                        }
                    });
                }
                if ($found.length > 0) {
                    break;
                }
            }
            if ($found.length > 0) {
                break;
            }
        }

        if ($found.length === 0) {
            throw `${data.sport}/${data.time_value}/${data.market}/${data.target} not found :(`;
        }

        return $found;
        //#-#-FINISH
    };

    const getBetElementAir = async data => {
        const $teams = $('div.event-view-info__prematch-item-name');
        if ($teams.length === 2) {
            data.team1b = $teams.eq(0).text().trim();
            data.team2b = $teams.eq(1).text().trim();
        } else {
            throw 'No teams!';
        }
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Результат матча'],
                    pivotKeys: ['#TEAM1B#'],
                },
                'TWO': {
                    roots: ['Результат матча'],
                    pivotKeys: ['#TEAM2B#'],
                },
                'DRAW': {
                    roots: ['Результат матча'],
                    pivotKeys: ['Ничья'],
                },
                'ONE_DRAW': {
                    roots: ['Двойной исход'],
                    pivotKeys: ['#TEAM1B# не проиграет'],
                },
                'TWO_DRAW': {
                    roots: ['Двойной исход'],
                    pivotKeys: ['#TEAM2B# не проиграет'],
                },
                'ONE_TWO': {
                    roots: ['Двойной исход'],
                    pivotKeys: ['Не будет ничьей'],
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['Тотал'],
                    pivotKeys: ['Больше #PIVOT#'],
                },
                'UNDER': {
                    roots: ['Тотал'],
                    pivotKeys: ['Меньше #PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['Индивидуальный тотал #TEAM1B#'],
                    pivotKeys: ['Больше #PIVOT#'],
                },
                'UNDER': {
                    roots: ['Индивидуальный тотал #TEAM1B#'],
                    pivotKeys: ['Меньше #PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['Индивидуальный тотал #TEAM2B#'],
                    pivotKeys: ['Больше #PIVOT#'],
                },
                'UNDER': {
                    roots: ['Индивидуальный тотал #TEAM2B#'],
                    pivotKeys: ['Меньше #PIVOT#'],
                },
            },
        }

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw `Unsupported ${data.time_value} / ${data.market} / ${data.target}`;
        }
        const params = new AllMarkets(data);
        params.proceed_football = function () {
            if (!this.full) {
                markets['ONE_TWO']['ONE']['roots'] = ['Результат'];
                markets['ONE_TWO']['TWO']['roots'] = ['Результат'];
                markets['ONE_TWO']['DRAW']['roots'] = ['Результат'];
                this.addToEl('roots', '. 1-й тайм', false);
            }
        };
        const final = applyAllMarkets(data, ['roots', 'pivotKeys',], params, markets);
        console.log('final ', final);
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

        let labelTab = '';
        switch (data.market) {
            case 'ONE_TWO':
                labelTab = 'Главные';
                break;
            case 'TOTAL':
                labelTab = 'Тотал';
                break;
            case 'T1_TOTAL':
                labelTab = 'Тотал';
                break;
            case 'T2_TOTAL':
                labelTab = 'Тотал';
                break;
        }

        if (labelTab !== '') {
            const $marketsTab = await waitForElement('div.filter-markets-list', 222, 10000, true);
            if ($marketsTab.find(`div.filter-markets-list__item:textEquals(${labelTab})`).length > 0) {
                await mouseChain({
                    target: $marketsTab.find(`div.filter-markets-list__item:textEquals(${labelTab})`)[0],
                    events: fullClick,
                    error: '$marketsTab'
                });
                await delayPromise(3000);
            } else {
                throw 'market tab is not exist';
            }
        }

        await waitForElement('div.event-wrap', 222, 10000);
        const $findPivot = $root => {
            for (const pvt of m.pivotKeys) {
                const $eventContent = $root.parent().find('div.event-market__content-wrapper');
                if (['TOTAL', 'T2_TOTAL', 'T1_TOTAL'].indexOf(data.market) > -1) {
                    const pivot = pvt.split(' ');
                    const pivotVal = Math.round((pivot[1]) * 100) / 100;
                    if ($eventContent.find(`event-outcome-group-head:textEquals(${pivotVal})`).length === 0) throw 'pivot is not found';
                    switch (pivot[0]) {
                        case 'Больше':
                            return $eventContent.find(`event-outcome-group-head:textEquals(${pivotVal})`).next();
                            break;
                        case 'Меньше':
                            return $eventContent.find(`event-outcome-group-head:textEquals(${pivotVal})`).next().next();
                            break;
                        default:
                            throw 'Strange pivot is value';
                    }
                } else {
                    if ($eventContent.find(`span.event-outcome__name:textEquals(${pvt})`).length === 0) throw 'pivot is not found1';
                    return $eventContent.find(`span.event-outcome__name:textEquals(${pvt})`).parent();
                }
            }
            return $([]);
        };

        let $found = $([]);
        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () =>
                $(`div.event-market__header:textEqualsIS("${root}")`)
            if ($root().length === 0) {
                continue;
            }
            if (!$root().hasClass('event-market__header--expanded')) {
                await mouseChain({
                    target: $root()[0],
                    events: fullClick,
                    error: 'expand tab $root'
                });
                await delayPromise(1000);
            }
            $found = $findPivot($root());
            if ($found.length > 0) {
                break;
            }
        }
        if ($found.length === 0) {
            throw `${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot}`
            + ' not found :(';
        }
        return $found;
    };

    const closePreviousCoupons = async skip => {
        dLog('orange', 'Pari', `closePreviousCoupons: ${skip}`);
        const checkYes = async () => {
            const $clr = await waitForElement('div[role="button"] div:textEquals("Очистить купон?")',
                100, 3000).catch(() => $([]));
            await delayPromise(50);
            if ($clr.length > 0) {
                await mouseChain({
                    target: $('button[type="button"] span:textEquals("Да")')[0],
                    events: fullClick, error: 'checkYes',
                });
            }
        };
        if (skip) {
            return 'skipped!';
        }
        const $clearBtn = $(findSel([
            'a[onclick="CC();"]:contains("Очистить")', 'button[data-id="betslip-header-delete-button"]', 'button.betslip-footer-close-btn'
        ]));
        if ($clearBtn.length === 0) {
            return 'Everything was clear!';
        }
        await mouseChain({target: $clearBtn[0], events: fullClick, error: 'Clear All', scroll: true});
        await delayPromise(2222);
        await checkYes();
        return 'Closed!';
    };

    const openEventCupis = async bet => {
        dLog('green', 'Pari', ['openEventCupis', bet]);
        const event = [1, 2].map(idx => bet[`team${idx}`].toLowerCase()).join(' - ');
        const sport = sportAccordance[bet.sport];
        if (!sport) {
            throw `Sport ${bet.sport} not supported :(`
        }
        const areWeThereWithScore = async (event, bet) => {
            const checkScore = () => {
                if (bet.type !== 'LIVE') {
                    return true;
                }
                const scoreSel = $('div[data-id="event-view-header-soccer"] > div:last-child > div > div:last-child > div > div:last-child div').length > 0 
                    ? 'div[data-id="event-view-header-soccer"] > div:last-child > div > div:last-child > div > div:last-child div'
                        : 'div[class^="LiveInfoboardShared-styles__item-column"]:last div[class^="LiveInfoboardShared-styles__item--"]';
                if (bet.score !== '' && ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(bet.market) === -1 && bet.sport === 'FOOTBALL') {
                    let score = '';
                    if (bkHere === 'port_pariby' || bkHere === 'port_pariold') {
                        score = $('div[data-id="event-view-header-soccer"]').next().find('div:first > div:last-child > div > div:last-child > div').eq(1).children().eq(1).trt()
                            + ':' + $('div[data-id="event-view-header-soccer"]').next().find('div:first > div:last-child > div > div:last-child > div').eq(1).children().eq(2).trt();
                    } else {
                        score = [1, 2].map(idx => $(scoreSel).eq(idx).text().trim()).join(':');
                    }
                    if (score !== bet.score) {
                        throw `SCORE_CHANGED: we need '${bet.score}', we have '${score}'`;
                    }
                }
                return true;
            };
            const $teams = await waitForElement('span[data-id="competitor-home"], span[data-id="competitor-away"]',
                300, 10000, false, 2, '')
                .catch(() => $([]));
            const local = [0, 1].map(idx => $teams.eq(idx).text().trim().toLowerCase()).join(' - ');
            if (bet.bk_event_native_id && document.location.href.indexOf(`-${bet.bk_event_native_id}`) > -1 && checkScore()) {
                bet.team1 = $teams.eq(0).text().trim();
                bet.team2 = $teams.eq(1).text().trim();
                return true;
            } else {
                return (event === local || locutus_similar_text(event, local, true) > 80) && checkScore();
            }
        };
        const findEvent = async () => {
            const sport = sportNav[bet.sport];
            const leagueArr = bet.league.split('.');
            const leagueCountry = leagueArr[0].trim();
            let league = '';

            if (leagueArr.length > 2) {
                leagueArr.shift();
                league = leagueArr.join('.');
            } else {
                league = leagueArr[1];
            }

            if (!leagueCountry) {
                throw 'League country not found';
            }
            if (!league) {
                throw 'League not found';
            } else {
                league = league.trim();
            }
            if (!sport) {
                throw `There is no accordance for ${bet.sport}`;
            }

            const sportSel = `div[data-id="sport-navigation-item-${sport}"] a`;
            await waitForElement(sportSel, 300, 20000, false, 1, `No ${sport} at ${document.location.href}!`);
            await mouseChain({target: $(sportSel)[0], events: fullClick, error: ''});
            await delayPromise(1500);
            const $leagueLink = $(`div[data-id*="country-id-"] span[data-id="country-title"]:textEquals("${leagueCountry}")`);
            if ($leagueLink.length > 0) {
                if ($leagueLink.closest('div[data-id*="country-id-"]').find('a').length === 0) {
                    await mouseChain({target: $($leagueLink)[0], events: fullClick, error: '$leagueLink country'});
                    await delayPromise(1500);
                    await mouseChain({
                        target: $leagueLink.closest('div[data-id*="country-id-"]').nextUntil(`div[data-id*="country-id-"]`).find(`a[data-id="championship-title"]:textEquals("${league}")`)[0],
                        events: fullClick,
                        error: '$leagueLink'
                    });
                    await delayPromise(1000);
                    await waitForElement('div[data-id="event-card-container-event"]', 300, 10000);
                }
            } else {
                throw 'League link not found';
            }

            let $found = $([]);
            const scanRows = async () => {
                await $('div[data-id="event-card-container-event"] a').eachAsync(async function () {
                    const $this = $(this);
                    if (bet.bk_event_native_id) {
                        if ($(this).attr('href').indexOf(`-${bet.bk_event_native_id}/`) > -1) {
                            $found = $this;
                            return false;
                        } else {
                            console.log(`${$(this).attr('href')} not contains ${bet.bk_event_native_id}`);
                        }
                    } else {
                        const $teams = $this.find('div[data-id="event-card-competitor-names"] span');
                        const current = [0, 1].map(idx => $teams.eq(idx).trt().toLowerCase()).join(' - ');
                        if (current === event || locutus_similar_text(current, event, true) > 80) {
                            $found = $this;
                            return false;
                        } else {
                            console.log(`${current} !== ${event}`);
                        }
                    }
                });
            }

            for (let i = 0; i < 30; i++) {
                await scanRows();
                if ($('div[data-id="footer-wrapper"]').length > 0
                    || $found.length > 0
                ) {
                    break;
                }
                $('div[data-id="event-card-container-event"]')[$('div[data-id="event-card-container-event"]').length - 1].scrollIntoView();
                await delayPromise(2555);
            }

            if ($found.length !== 1) {
                throw `${event} not found (${$found.length})!`;
            }

            return $found;
        };
        // Check we're on event page already
        if (['/event/'].some(t => window.location.href.indexOf(t) > -1) && await areWeThereWithScore(event, bet)) {
            return 'we are on event already!';
        } else {
            await goLive();
        }
        await waitForCondition(() => ['live'].some(t => window.location.href.indexOf(t) > -1), 777, 10000,
            'We are not in Live :(');
        const $event = await findEvent();
        await mouseChain({target: $event[0], events: fullClick, error: 'Evt'});
        await waitForCondition(async () => await areWeThereWithScore(event, bet), 1000, 30000, 'We are not on event!');
        return 'We must be on event!';
    };

    const openEventAir = async bet => {
        dLog('green', 'Pari', ['openEventAir', bet]);
        const event = [1, 2].map(idx => bet[`team${idx}`].toLowerCase()).join(' - ');
        const sport = sportAccordance[bet.sport];
        if (!sport) {
            throw `Sport ${bet.sport} not supported :(`
        }
        const areWeThereWithScore = async (event, bet) => {
            const checkScore = () => {
                const score = $('div.event-view-info__prematch-score-number').text().trim();
                if (bet.score !== '' && ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(bet.market) === -1 && bet.sport === 'FOOTBALL') {
                    if (score !== bet.score) {
                        throw `SCORE_CHANGED: we need '${bet.score}', we have '${score}'`;
                    }
                }
                return true;
            };
            const $teams = await waitForElement('div.event-view-info__prematch-item-name', 300, 10000);
            const local = [0, 1].map(idx => $teams.eq(idx).text().trim().toLowerCase()).join(' - ');
            if (bet.bk_event_native_id && document.location.href.indexOf(`-${bet.bk_event_native_id}`) > -1 && checkScore()) {
                bet.team1 = $teams.eq(0).text().trim();
                bet.team2 = $teams.eq(1).text().trim();
                return true;
            } else {
                return (event === local || locutus_similar_text(event, local, true) > 80) && checkScore();
            }
        };

        const findEvent = async () => {
            const sport = sportAccordance[bet.sport];
            if (!sport) {
                throw `There is no accordance for ${bet.sport}`;
            }
            const sportSel = `span.live-navigation-sport__name:textEquals("${sport}")`;
            const $sportTab = await waitForElement(sportSel, 300, 20000, false, 1, `No ${sport} at ${document.location.href}!`);
            if (!$sportTab.closest('tab').hasClass('active')) {
                await mouseChain({target: $(sportSel)[0], events: fullClick, error: '$sportTab'});
                await delayPromise(1500);
            }
            let $found = $([]);
            const $eventRows = await waitForElement('div.live-block-column-data-wrapper', 333, 20000);
            await $eventRows.eachAsync(async function () {
                $(this)[0].scrollIntoView();
                await delayPromise(1000);
                const checkEvent = $(this).find('div.live-block-competitors__item-name').eq(0).text().trim() + ' - ' + $(this).find('div.live-block-competitors__item-name').eq(1).text().trim();
                const res = checkEvent.toLowerCase() === event || locutus_similar_text(checkEvent, event, true) > 70;
                dLog('color: darkgray;', 'Pari', `"${checkEvent}" ${(res ? '==' : '!=')} "${event}"`);
                if (res) {
                    $found = $(this);
                    return false;
                }
            });
            if ($found.length !== 1) {
                throw `${event} not found (${$found.length})!`;
            }
            return $found.find('div.live-block-competitors');
        };

        if (['/event/'].some(t => window.location.href.indexOf(t) > -1) && await areWeThereWithScore(event, bet)) {
            return 'we are on event already!';
        } else {
            await goLive();
        }
        await waitForCondition(() => ['/live'].some(t => window.location.href.indexOf(t) > -1), 777, 10000,
            'We are not in Live :(');
        const $event = await findEvent();
        await mouseChain({target: $event[0], events: fullClick, error: 'Evt'});
        await delayPromise(1000);
        await waitForCondition(async () => await areWeThereWithScore(event, bet), 1000, 30000, 'We are not on event!');
        return 'We must be on event!';
    };

    const goLive = async () => {
        const $gtl = await waitForElement('a[data-id="tab-sport_menu_live"], a.navigation__item[href$="/live"]',
            200, 10000, false, 1, `$gtl: ${(window.top === window.self)} ${window.location.href}`);
        await mouseChain({
            target: $gtl[0],
            events: fullClick,
            scroll: true,
            error: 'GTL 4'
        });
    };

    const openCouponAir = async data => {
        for (const bet of data) {
            await openEventAir(bet);
            const $el = await getBetElementAir(bet);
            await mouseChain({target: $el[0], events: fullClick, error: '$el', scroll: true});
            await delayPromise(1000);
        }
    };

    const openCouponCupis = async data => {
        for (const bet of data) {
            await openEventCupis(bet);
            const $el = await getBetElementCupis(bet);
            await mouseChain({target: $el[0], events: fullClick, error: '$el', scroll: true});
            await delayPromise(1000);
        }
    };

    const openCouponOffshore = async paramData => {
        bsDebug(port, 'openCouponOffshore, paramData:', paramData);
        let result = function (success, message) {
            if (success) {
                //onSuccess('I hope the coupon was opened!');
                chrome.storage.local.set({
                    'PARIALL_PROXY_COMMAND': ourCommand.get(),
                    'PARIALL_PROXY_COMMAND_WAS_SET': Date.now()
                }, function () {
                    dLog('green', 'Pari', 'Opening the window...');
                    mouseChain({
                        target: $('#betSlip button.btn_orange:visible')[0],
                        events: ['click'],
                        scroll: true,
                        error: 'Opening the window!',
                    })
                        .then(() => dLog('green', 'Pari', `Bet clicked...`))
                        .catch(e => dLog('red', 'Pari', `Error till clicking bet: ${e}, ${formatStack(e.stack)}`));
                });
            } else {
                bsError(port, message);
                onReject(message);
            }
        };
        let lData = paramData.slice();
        let data = {};
        let openElement = async () => {
            const resOE = await openEventOffshore(paramData);
            dLog('yellow', 'Pari', [`After Open Event: ${resOE}`, reordered]);
            await waitForCondition(() => $('tbody.row1').length > 0, 500, 20000, 'still not in event', true);
            dLog('green', 'Pari', 'Event and "all markets" must be opened!');
            const elements = await getBetElementOffshore(paramData);
            dLog('green', 'Pari', ['Elements is', elements]);
            let res = [];
            elements.forEach(el => res.push(`${$(el)[0].tagName} = ${$(el).text().trim()}`));
            bsDebug(port, 'We got elements: ' + res.join('; '));
            //window.scrollBy(0, -110);
            let finishOperatingElement = function (success, message) {
                if (success && currentElement === elements.length - 1) {
                    result(true, '');
                } else if (success && currentElement < elements.length - 1) {
                    currentElement++;
                    operateElement();
                } else {
                    result(false, message);
                }
            };
            let currentElement = 0;
            let $element = elements[currentElement];
            $element[0].scrollIntoView();
            if ($element.hasClass('active')) {
                finishOperatingElement(true, '');
                return;
            }
            let coefWeWaitFor = $element.text().trim();
            let elementWasClicked = 0;
            let elementClickedTimes = 0;
            let performElementClick = function () {
                dLog('green', 'Pari', 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                    + ') /' + (Date.now() - elementWasClicked));
                mouseChain({target: $element.find('a')[0], events: ['click']})
                    .then(() => {
                        elementWasClicked = Date.now();
                        setTimeout(waitForCouponVisible, 1000);
                    })
                    .catch((e) => result(false, 'Error click bet element: ' + e));
            };
            let waitForCouponVisible = function () {
                if (elementWasClicked === 0) {
                    setTimeout(performElementClick, 1000);
                } else if ($element.hasClass('active')) {
                    finishOperatingElement(true, '');
                } else if (Date.now() - elementWasClicked > 5000 && elementClickedTimes < 2) {
                    elementClickedTimes++;
                    setTimeout(performElementClick, 777);
                } else if (Date.now() - waitForCouponVisibleStarted < 20000) {
                    setTimeout(waitForCouponVisible, 500);
                } else {
                    finishOperatingElement(false, 'Coupon not visible for '
                        + (Date.now() - waitForCouponVisibleStarted) + 'ms: ' + $element.html())
                }
            };
            let waitForCouponVisibleStarted = Date.now();
            waitForCouponVisible();
        };
        if (ourCommand.getAdded('express') !== false) {
            data = paramData[ourCommand.getAdded('express')];
        } else {
            data = lData.shift();
        }
        if (typeof data !== 'undefined') {
            bsDebug(port, 'openCoupon - basic - We got data: ' + (typeof data), data);
            await openElement();
        }
    };

    const getBalanceOld = async () => {
        const $bb = $(['#balance-button', 'i[data-toggler="balance"]'].find(s => $(s).length > 0));
        if ($bb.length === 0) {
            throw `No balance button!`;
        }
        await mouseChain({target: $bb[0], events: fullClick, error: ''});
        const $el = await waitForElement(() => $(['#ros', 'div.account-info-item__col-left:contains("Баланс на счету:") div.account-info-item__value']
            .find(s => $(s).length > 0)), 333, 5000, true);
        const balance = parseFloat($el.text().replace(/[^0-9.]/g, '').trim());
        await bMess('PARIALL_BALANCE', true).set({balance: balance, updated: Date.now()});
        await mouseChain({target: $bb[0], events: fullClick, error: ''});
        return balance;
    };

    const switchLang = async () => {
        if (document.location.href.indexOf('/ru/') === -1) {
            window.location.replace(window.location.origin + '/ru/');
        }
    }

    let balanceChecked = 0;
    let lastBalance = 0;
    const getBalance = async returnNull => {
        let $balance;
        $balance = await waitForElement('div[data-id="user-box-balance"]', 100, 3333, true).catch(() => $([]));
        lastBalance = !$balance || $balance.length === 0
            ? (returnNull ? 'null' : 0)
            : parseFloat($balance.text().replace(/[^\d.]/g, '').trim());

        return lastBalance;
    };

    const authCheck = function () {
        if ((Date.now() - dateNow >= 1200000) && busy === false) {
            window.location.reload();
        }
        if (isCoupon) {
            return;
        }
        if (enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            bsError(port, 'ERROR AUTH!');
            return;
        }

        (async () => {
            const $logLink = $(findSel(['button[data-id="header-login"]', 'a.login', 'button.btn-login', 'a[href="?login=1"]']));
            const $shadowEl = $("div.grv-dialog-host");

            await closeAllWeNeed({
                'a.ui-dialog-titlebar-close.ui-corner-all': 'a.ui-dialog-titlebar-close.ui-corner-all',
                'button span:textEquals("Нет, спасибо")': 'button span:textEquals("Нет, спасибо")',
                'span:textEquals("Понятно")': 'span:textEquals("Понятно")',
            });

            if (['#login', '#password', 'button.btn-login:contains("ВОЙТИ")']
                    .every(s => $(s).length > 0 && elementIsVisible($(s)[0])) || $('a.login').length > 0
                || window.location.href.indexOf('?login=1') > -1 || window.location.href.indexOf('/login') > -1) {
                if (!isCupis && $logLink.length > 0) {
                    await mouseChain({target: $logLink[0], events: ['click'], errors: 'Login'});
                }
                await tryToLogIn();
            } else if ($logLink.length > 0) {
                await mouseChain({target: $logLink[0], events: ['click'], errors: 'Login'});
            } else if ($shadowEl.length > 0) {
                const $shadowSelector = $($shadowEl)[0].shadowRoot;
                const $shadowButton = $($shadowSelector).find('button:textEquals("Нет, спасибо")');
                await mouseChain({target: $shadowButton[0], events: ['click'], error: '$shadowButton'});
            } else {
                const mc = 'media-container';
                if ($(mc).length > 0) {
                    $(mc).remove();
                }
                if ($('div[data-id="user-box-balance"]').length > 0) {
                    const balance = await getBalance(true);
                    port.postMessage({
                        m: "authorized!",
                        balance: balance,
                    });
                }
            }
        })()
            .catch((e) => bsError(port, 'Error till logging in: ' + e))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const tryToLogIn = async () => {
        if (Date.now() - authClicked <= 60000) {
            throw 'Too soon!';
        } else {
            dLog('orange', 'pm', 'Performing login!');
        }
        const ltSel = 'div[role="button"][data-id="list"]';
        let login = settings.login;
        const logType = (settings.login.indexOf('+7') === 0) ? 'phone'
            : settings.login.indexOf('@') > -1 ? 'email' : 'id';
        if ($(ltSel).length > 0) {
            const logTypeAttr = {
                'id': '#UII_UserID',
                'phone': '#UII_iPhone',
                'email': '#UII_EmailOutline',
            };
            if ($(`${ltSel} use:first-child`).attr('xlink:href') !== logTypeAttr[logType]) {
                await mouseChain({target: $(ltSel)[0], events: fullClick, error: 'ltSel'});
                await delayPromise(500);
                const $but = await waitForElement(`button[data-id="dropdown-item"][value="${logType}"]`, 200, 1000);
                await mouseChain({target: $but[0], events: fullClick, error: '$but'});
                await delayPromise(1888);
            }
            if (logType === 'phone') {
                login = login.replace('+', '').replace(/^7/, '');
            }
        }
        const $username = $(findSel(['input[name="phone"]', 'input[name="id"]', 'input[name="email"]', 'input[name="username"]', '#login']));
        const $password = $(findSel(['input[name="passwd"]', '#password']));
        const $submit = $(findSel(['button[data-id="login-button"]', 'button.btn_orange.ok', 'button.btn-login:contains("ВОЙТИ")']));
        const $checkedAuth = $(findSel(['input[data-id="by-player-agree-label-agreement"]']));
        if ($username.length > 0 && $password.length > 0 && $submit.length > 0) {
            if ($checkedAuth.length > 0) {
                if ($checkedAuth.is(':checked') === false) {
                    await mouseChain({target: $checkedAuth[0], events: fullClick, error: 'checkedAuth'});
                    await delayPromise(888);
                }
            }
            if (logType === 'id') {
                await clearAndInputNumber($username[0], login);
            } else {
                await clearAndSimulate($username[0], login, true, true, true, true);
            }
            await delayPromise(1500);
            await clearAndSimulate($password[0], settings.password, true, true, true, true);
            await delayPromise(1500);
            await mouseChain({target: $submit[0], events: ['click'], error: 'LG2'});
            await delayPromise(555);
            const $errorMessage = await waitForElement('div[data-id="notification"]', 333, 5555).catch(() => $([]));
            if ($errorMessage.length > 0) {
                enterError = true;
            }
            authClicked = Date.now();
            return `It looks like we're logged in! ${authClicked}`;
        } else {
            throw 'No inputs for login!';
        }
    };

    if (!isCoupon) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message);
        });
    }

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            chrome.storage.local.set({
                'PARIALL_COMMAND': ourCommand.get(),
                'PARIALL_COMMAND_WAS_SET': ourCommand.getAdded('increaseDelay') ? Date.now() + 150000 : Date.now()
            });
        }
    }, true);

    const afterDOMLoaded = async () => {
        // hint: MAIN WINDOW
        port.postMessage({m: "PAGE LOADED!"});
        dLog('orange', 'Pari', `We'd sent PAGE LOADED ${isCupis}/${isCoupon}!`);
        await switchLang();
        if (!isCoupon) {
            chrome.storage.local.get(['PARIALL_COMMAND', 'PARIALL_COMMAND_WAS_SET'], function (result) {
                bsDebug(port, 'Saved command:', result);
                //console.log('%cSaved command:', 'background: gray; color: yellow; font-weight: bold;');
                //console.log(result);
                if (typeof result.PARIALL_COMMAND !== 'undefined' && typeof result.PARIALL_COMMAND_WAS_SET !== 'undefined'
                    && Date.now() - result.PARIALL_COMMAND_WAS_SET < 40000) {
                    let currentCommand = result.PARIALL_COMMAND;
                    //console.log(currentCommand);
                    chrome.storage.local.remove(['PARIALL_COMMAND', 'PARIALL_COMMAND_WAS_SET'], function () {
                        //bsDebug(port, 'Restoring with: ', currentCommand);
                        messageProcessor(currentCommand);
                    });
                } else {
                    chrome.storage.local.remove(['PARIALL_COMMAND', 'PARIALL_COMMAND_WAS_SET']);
                }
            });
        } else {
            bMess('PARIALL_PROXY_COMMAND', true).check(40000, true)
                .then(aCommand => messageProcessor(aCommand))
                .catch(e => console.log(`Alternate: ${e}`));
        }
        console.log('%c' + `PARIMATCH! Cupis: ${isCupis}/${isCoupon}`,
            'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded()
            .catch(e => dLog('red', 'Pari', `readyState afterDOMLoaded error: ${e}, ${formatStack(e.stack)}`));
    }

    if (window.self === window.top) {
        let s = document.createElement('script');
        s.src = chrome.extension.getURL('libs/pari_push_remover.js');
        (document.head || document.documentElement).appendChild(s);
        dLog('background: green; color: blue; padding 100px;', 'Pari', 'push checker activated!');
    }

    dLog('green', 'PaRi', `We are loaded (${(window.self === window.top ? 'MAIN' : 'FRAME')} `
        + `) at ${document.location.href}`);

})();
