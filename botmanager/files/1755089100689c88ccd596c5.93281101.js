(function () {

    "use strict";

    if (window.self !== window.top) {
        return;
    }

    const bkName = document.location.href.indexOf('leon.ru/') > -1 ? 'leoncupis' : 'leon';
    const offshoreTag = bkName === 'leon' ? '/ru' : '';

    let newAPI = false;
    let enterError = false;

    const isCupis = (bkName === 'leoncupis' || bkName === 'leon');
    if (isCupis && window.self !== window.top) {
        return;
    }
    let wasAuthCheck = false;
    let authClicked = 0;
    let busy = false;
    let port = chrome.runtime.connect({name: `port_${bkName}`});
    let settings = {
        authCheckInterval: 2000,
        url: 'https://ru.leonbets.net/bet-on-live-matches',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        uid: '',
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 3,
        betweenBets: 25000,
    };

    let currentBetData = false;
    let inputEmail = false;
    let phoneNumber = false;

    const logSels = [`a[href="${offshoreTag}/login"]`];
    const loginSels = ['input[name="login"]'];

    const ourCommand = new ourCommandProto();
    const smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);

    const sportAccordance = {
        'FOOTBALL': 'soccer',
        'TENNIS': 'tennis',
        'HOCKEY': 'hockey',
        'VOLLEYBALL': 'volleyball',
        'BASKETBALL': 'basketball',
        'HANDBALL': 'handball',
        'BASEBALL': 'baseball',
        'TABLETENNIS': 'tabletennis',
        'CYBERSPORT': 'esport',
    };

    let messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        } else if (message.action === 'SMS_API' && message.data) {
            smsApiMessage.setMessage(message.data.status, message.data.message);
            return;
        }
        let $logLink = $('#enter');
        if (message.action !== 'auth' && busy) {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY"
            });
        } else if (message.action === "auth") {
            if (message.login === 'reger') {
                bsDebug(port, 'Awaiting for registration command!');
                wasAuthCheck = true;
                return;
            }
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.uid = message.uid;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            dLog('green', 'Leon', `UID was set ${settings.uid}/${message.uid}`);
            authCheck(settings);
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
        } else if ($logLink.length > 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (message.action === 'MAXIMUM') {
            busy = true;
            ourCommand.set(message);
            bsDebug(port, 'MAXIMUM for: ' + message.data[0].market + '/' + message.data[0].target + '/' + message.data[0].pivot);
            closePreviousCoupons(typeof message.express !== 'undefined')
                .then(() => openCoupon(message.data))
                .then((max) =>
                    checkCoefs(message.data)
                        .then(() => {
                            busy = false;
                            port.postMessage({
                                answered: "MAXIMUM",
                                status: 'success',
                                answer: max
                            });
                            ourCommand.clear();
                        }).catch((e) => {
                        throw new Error(e);
                    })
                )
                .catch((e) => {
                    bsError(port, 'Error: ' + e);
                    busy = false;
                    port.postMessage({
                        answered: "MAXIMUM",
                        status: "error",
                        answer: "Error: " + e
                    });
                    ourCommand.clear();
                });
        } else if (message.action === 'BET') {
            busy = true;
            ourCommand.set(message);
            proceedBet(message.data)
                .then(() => bsDebug(port, "It's looks like BET done!"))
                .catch((e) => bsError(port, 'Error till BET: ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                });
        } else if (message.action === 'EXPRESS_BET') {
            busy = true;
            ourCommand.set(message);
            proceedBet(message.data)
                .then(() => bsDebug(port, "It's looks like EXPRESS_BET done!"))
                .catch((e) => bsError(port, 'Error till EXPRESS_BET: ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                });
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
                    await bMess('LEON_COMMAND').remove();
                    busy = false;
                    ourCommand.clear();
                    //await mouseChain({target: $('#betsMenu li.live-bets a')[0], events: ['click'], scroll: true});
                });
        } else if (['DEPOSIT', 'WITHDRAW', 'CHECK_PAYMENTS'].indexOf(message.action) > -1) {
            busy = true;
            if (message.action === 'WITHDRAW') {
                settings.phone = message.data.phone;
                dLog('green', 'Leon', `We set phone ${settings.phone}/${message.data.phone}`);
            }
            ourCommand.set(message);
            (function (d) {
                return message.action === 'DEPOSIT'
                    ? deposit(d) : message.action === 'WITHDRAW' ? withdraw(d) : checkPayments(d);
            })(message.data)
                .then(() => bsDebug(port, `It's looks like ${message.action} done!`))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(async () => {
                    busy = false;
                    ourCommand.clear();
                    await bMess('LEON_COMMAND').remove();
                    dLog('blue', 'Leon', 'ourCommand and LEON_COMMAND were cleared!');
                    await delayPromise(8000);
                    await mouseChain({target: $('li.live-bets a')[0], events: ['click'], scroll: true});
                });
        }
    };

    let register = function (data) {
        bsDebug(port, 'register!');
        return new Promise(function (onSuccess, onReject) {
            let report = function (success, message) {
                port.postMessage({
                    answered: "REGISTER",
                    data: {
                        success: success,
                        queue_id: ourCommand.get().queue_id
                    },
                    answer: message
                });
                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                }
            };
            //report(false, 'Leon registration not working well, sorry :(');
            //return;
            let stepTwo = function () {
                return waitForElement('span:contains("Через e-mail")', 333, 15000)
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => mouseChain({target: $el.parent()[0], events: ['click']}))
                    .then(waitForElementF('#email-leonbets', 333, 10000, true))
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                    .then(() => clickSelectAllDeleteEnter($('#email-leonbets')[0], data['email'], true))
                    .then(delayFunction(3333))
                    .then(() => clickSelectAllDeleteEnter($('#registration_code')[0], data['password'], true))
                    .then(waitForElementF('div[ng-switch-when="CURRENCY_SELECT"] select', 333, 10000, true))
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => {
                        if ($el.val() !== 'RUB') {
                            return selectLikePuppeteer($el.get(0), ['RUB'])
                                .then(() => {
                                    $el.get(0).blur();
                                })
                                .then(delayFunction(3333));
                        }
                    })
                    .then(() => console.log('Done!'))
                    .then(waitForCondition(() => {
                        let aStatus = $('div.antigate_solver a.status').last().trt();
                        if (aStatus === 'Solved') {
                            return true;
                        } else if (aStatus.indexOf('Outdated') > -1) {
                            mouseChain({target: $('a.control.reload')[0], events: ['click']})
                                .then().catch();
                            return false;
                        } else {
                            return false;
                        }
                    }, 333, 200000, 'reCaptcha not solved for 200s', true))
                    .then(() => ourCommand.add('FinalStep', true))
                    .then(() => bsDebug(port, 'It\'s looks like captcha solved!'))
                    .then(() => console.log('%c' + 'It\'s looks like captcha solved!',
                        'background: yellow; color: red; font-size: 18px; font-weight: bold'))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({
                        target: $('input[value="Зарегистрироваться"]')[0],
                        events: ['click']
                    }));
            };
            let regoroll = function () {
                if (ourCommand.getAdded('FinalStep')) {
                    bsDebug(port, 'regoroll - FinalStep');
                    waitForElement('div.single-field.country select', 333, 15000)
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => {
                            $el.find('option[value="string:RU"]').prop('selected', true);
                            fireChangeEvent($el[0]);
                        })
                        .then(delayFunction(3333))
                        .then(() => mouseChain({
                            target: $('div[ng-bind-template="Подтвердить"]')[0],
                            events: ['click']
                        }))
                        .then(delayFunction(3333))
                        .then(() => {
                            if (!ourCommand.getAdded('successWasShown')) {
                                return waitForElement('h1:contains("Успешная регистрация")', 333, 10000);
                            }
                        })
                        //.then(waitForElementF('h1:contains("Успешная регистрация")', 333, 10000))
                        .then(() => console.log('%c' + 'SUCCESS!!!',
                            'background: yellow; color: red; font-size: 18px; font-weight: bold; padding: 25px;'))
                        .then(() => report(true, {login: data['nickname'], password: data['password']}))
                        .catch((e) => report(false, 'Error till select country: ' + e));
                } else if (document.location.href.indexOf('/registration') > -1 && ourCommand.getAdded('RegistrationClicked')) {
                    bsDebug(port, 'regoroll - RegistrationClicked');
                    waitForElement('span:contains("Через e-mail")', 333, 15000)
                        .then(stepTwo)
                        // Here we go to next page
                        .then(delayFunction(3333))
                        .catch((e) => report(false, 'Error till first form: ' + e));
                } else if (!ourCommand.getAdded('RegistrationClicked')) {
                    bsDebug(port, 'regoroll - FIRST');
                    waitForElement('#btnReg', 333, 15000)
                        .then(() => delayPromise(3333))
                        .then(() => ourCommand.add('RegistrationClicked', true))
                        .then(() => mouseChain({target: $('#btnReg')[0], events: ['click']}))
                        .then(delayFunction(3333))
                        // Hint: we could go to other page or not here
                        .then(waitForElementF('span:contains("Через e-mail")', 333, 15000, true))
                        .then(stepTwo)
                        .catch(e => console.log('This message should not be shown :) ' + e))
                        .then(waitForElementF('span:contains("Успешная регистрация")', 333, 20000, true))
                        .then(($el) => delayPromise(3333, $el))
                        .then($el => {
                            ourCommand.add('successWasShown', true);
                            return $el;
                        })
                        .then(($el) => mouseChain({
                            target: $el.parent().find('a.modal-close')[0],
                            events: ['click']
                        }))
                        // Hint: here we really go to next page
                        .catch((e) => report(false, 'Error till goToReg: ' + e));
                }
            };
            delayPromise(1111).then(regoroll);
        });
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
                if (ourCommand.getAdded('filterClicked') || document.location.href.indexOf('/my-account') > -1 || document.location.href.indexOf('/account') > -1) {
                    waitForCondition(() => {
                        return $('select.tr-transactions').length > 0 && $('select.tr-days').length > 0;
                    }, 333, 15000, 'No selectors!', false)
                        .then(() => {
                            if ($('select.tr-transactions').val() !== '3' || $('select.tr-days').val() !== '30') {
                                return delayPromise(111)
                                    .then(() => {
                                        $('select.tr-transactions option[value="3"]').prop('selected', true);
                                        $('select.tr-days option[value="30"]').prop('selected', true);
                                    })
                                    .then(() => ourCommand.add('filterClicked', true))
                                    .then(delayFunction(3333))
                                    .then(() => mouseChain({
                                        target: $('input[type="button"][value="Показать"]')[0],
                                        events: ['click'],
                                        scroll: true
                                    }))
                                    .then(delayFunction(30000));
                                // Here we must go to next page
                            }
                        })
                        .then(delayFunction(3333))
                        .then(() => {
                            collected = [];
                            $('table.tbl-transactions tr.accHistTr').each(function () {
                                let $tds = $(this).find('td');
                                let amountIn = $tds.eq(4).trt();
                                let amountOut = $tds.eq(3).trt();
                                collected.push({
                                    date: $tds.eq(0).text().replace($tds.eq(0).find('script').text(), '').trim(),
                                    description: $tds.eq(1).text().replace(/(?:\r\n|\r|\n)/g, ' ')
                                        .replace(/\s\s+/g, ' ').trim(),
                                    success: $tds.eq(2).text().indexOf('Обработан') > -1,
                                    paysystem: 'QIWI',
                                    type: parseFloat(amountIn) > 0 ? 'IN' : 'OUT',
                                    amount: parseFloat(amountIn) > 0 ? amountIn : amountOut,
                                });
                            });
                            console.log(collected);
                            report(true, 'Collected')
                        })
                        .catch((e) => report(false, 'Catch: ' + e));
                } else {
                    waitForElement('a[href="/my-account"]', 333, 10000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                        // Hint: here the page will reload
                        .then(delayFunction(3333))
                        .catch((e) => report(false, 'Go to checkpayment: ' + e));
                }
            };
            delayPromise(3333)
                .then(letsRockNRoll);
        });
    };

    const withdrawDo = async data => {
        if (isCupis && !ourCommand.getAdded('sms_api_request_id')) {
            if (!settings.phone || !settings.uid) {
                throw `There is no phone or websocket_uid (${settings.phone}/${settings.uid})!`;
            }
            await bsBindNumber(port, settings, smsApiMessage, ourCommand);
        }
        if (ourCommand.getAdded('withdrawWasPressed') !== false
            && (!isCupis || (isCupis && !ourCommand.getAdded('needSmsCode')))) {
            await waitForElement('h1:contains("Запрос на выплату принят"):visible', 333, 33333);
            return 'It looks like withdrawal done!';
        } else if (document.location.href.indexOf('srvpayment?do=') > -1) {
            if ($('div.row.error:contains("60 минут")').length > 0) {
                throw $('div.row.error').trt();
            } else if (ourCommand.getAdded('needSmsCode')) {
                dLog('green', 'Leon', 'We started wait for sms!');
                const code = await smsApiMessage.waitForSMSCode(['CUPIS'],
                    (m) => {
                        dLog('orange', 'LeonCupis', `sms: '${m}'`);
                        return m.indexOf('Kod:') > -1;
                    },
                    (m) => {
                        let r = m.match(/(\d+)/g);
                        return r && r[0] ? r[0] : '';
                    }, 300000);
                await clearAndSimulate($('input[name="smscode"]')[0], code);
                ourCommand.add('needSmsCode', false);
                await mouseChain({target: $('input.sms-button')[0], events: fullClick, error: 'smsButt'});
                await delayPromise(3000);
            } else {
                const $cb = await waitForElement('div.form-input.confirm-button:visible', 333,
                    5000)
                    .catch(() => $([]));
                if ($cb.length > 0) {
                    await mouseChain({target: $cb[0], events: fullClick, error: '$cb'});
                    await delayPromise(3000);
                }
                const sels = ['input[name="fullname"]', 'input[name="amount"]', 'input[name="fullnamehidden"]'];
                await waitForCondition(() => sels.some(s => $(s).length > 0), 333, 15000,
                    'No name nor amount!');
                await delayPromise(3000);
                const $el = $(sels[isCupis ? 2 : 0]);
                if ($el.length > 0) {
                    await delayPromise(3000);
                    await clearAndSimulate($el[0], data.first_name + ' ' + data.second_name);
                    await delayPromise(3000);
                }
                const $el2 = await waitForElement(sels[1], 333, 15000);
                await delayPromise(3000);
                await clearAndSimulate($el2[0], data.amount);
                ourCommand.add('withdrawWasPressed', true);
                if (isCupis) {
                    ourCommand.add('needSmsCode', true);
                }
                await mouseChain({target: $('#subbutton')[0], events: ['click'], scroll: true, error: 'sbb'});
                await delayPromise(3000);
            }
        } else if (document.location.href.indexOf(isCupis ? 'kak-vyvesti-dengi-so-scheta' : 'how-to-withdraw') > -1) {
            const $el = await waitForElement(`img[alt="${data.paysystem === 'QIWI'
                ? 'QIWI Кошелек' : 'Skrill'}"]`, 333, 15000);
            await mouseChain({target: $el[0], events: ['click'], scroll: true});
            // Hint: here the page will reload again
            await delayPromise(3000);
        } else {
            if (isCupis) {
                await mouseChain({target: $('button.avatar')[0], events: fullClick, error: 'ava'});
                const $v = await waitForElement('li:textEquals("Выплаты")', 333, 5000);
                await delayPromise(1000);
                await mouseChain({target: $v[0], events: fullClick, error: '$v'});
                const $li = await waitForElement('li.payments-list-item:contains("QIWI")',
                    333, 10000);
                await delayPromise(1000);
                await mouseChain({target: $li[0], events: fullClick, error: '$li'});
                const $input = await waitForElement('input.payments-input__input',
                    333, 15000, true);
                await delayPromise(1000);
                await clearAndSimulate($input[0], data.amount);
                await delayPromise(1000);
                await mouseChain({
                    target: $('button:contains("Выплатить")')[0], events: fullClick,
                    error: 'Выплатить'
                });
                dLog('green', 'Leon', 'We started wait for sms!');
                const code = await smsApiMessage.waitForSMSCode(['CUPIS'],
                    (m) => {
                        dLog('orange', 'LeonCupis', `sms: '${m}'`);
                        return m.indexOf('Kod:') > -1;
                    },
                    (m) => {
                        let r = m.match(/(\d+)/g);
                        return r && r[0] ? r[0] : '';
                    }, 300000);
                for (let i = 0; i < 6; i++) {
                    await clearAndSimulate($(`input[data-index="${(i + 1)}"]`)[0], code[i]);
                    await delayPromise(500);
                }
                await mouseChain({
                    target: $('button:textEquals("Продолжить")')[0],
                    events: fullClick, error: 'Продолжить'
                });
                await waitForElement('div.heading:textEquals("Запрос на выплату принят")',
                    333, 15000);
                await delayPromise(3000);
                await mouseChain({
                    target: $('button:textEquals("Закрыть")')[0], events: fullClick,
                    error: 'Закрыть'
                });
                return 'It looks like withdrawal done!';
            } else {
                const $el = await waitForElement('a[href$="/how-to-withdraw"]', 333, 10000);
                await mouseChain({target: $el[0], events: ['click'], scroll: true});
                await delayPromise(3000);
            }
        }
        await delayPromise(100000);
        throw `No withdraw result`;
    };

    const withdraw = async data => {
        let error = '';
        const message = await withdrawDo(data).catch(e => error = `Withdraw: ${e}, ${formatStack(e.stack)}`);
        port.postMessage({
            answered: "WITHDRAW",
            status: error.length === 0 ? "SUCCESS" : "FAILED",
            answer: error.length === 0 ? message : error,
        });
        if (ourCommand.getAdded('sms_api_request_id')) {
            bsSendSmsApi(port, 'BIND_RELEASE', {
                "websocket_uid": settings.uid,
                "request_id": ourCommand.getAdded('sms_api_request_id')
            });
        }
        ourCommand.clear();
        busy = false;
        if (error.length > 0) {
            throw error;
        }
        return message;
    };

    const deposit = async data => {
        bsDebug(port, 'Deposit!', data);
        const [success, message, wallet_balance] = await depositGo(data)
            .catch(e => [false, `Error till deposit: ${e}`]);
        ourCommand.add('increaseDelay', false);
        ourCommand.add('qiwiEntered', false);
        bsDebug(port, 'Report! ' + success + ' / ' + message);
        port.postMessage({
            answered: "DEPOSIT",
            status: success ? 'SUCCESS' : ['NO_FUNDS', 'RESTRICTED'].find(t => message.indexOf(t) > -1) || 'FAILED',
            answer: message,
            balance: getBalance(),
            wallet_balance: wallet_balance || '',
        });
        if (isCupis) {
            ourCommand.clear();
            busy = false;
            delayPromise(1000)
                .then(() => window.location.reload());
        }
        if (!success) {
            throw message;
        }
        return message;
    };

    const depositGo = async data => {
        if (document.location.href.indexOf('.cps-it.ru') > -1) {
            dLog('orange', 'Leon-Cupis', `We are on CUPIS!!!`);
            await delayPromise(45000);
            ourCommand.clear();
            chrome.runtime.sendMessage({closeTabByPartOfUrl: window.location.href}, (r) => {
                console.log('%cClose result:', 'color: blue; font-size: 22px;', r)
            });
            await delayPromise(100000);
            throw `Cupis not closed!`;
        }
        const ps = {
            'QIWI': {
                'select': 'img[alt="QIWI Кошелек"]',
                'check': 'srvpayment?do=' + (bkName === 'leoncupis' ? 'deptsupisqiwi' : 'depqiwi')
            },
            'SKRILL': {
                'select': 'img[alt="Skrill"]',
                'check': 'srvpayment?do=depmoneybookers'
            }
        };
        if (typeof ps[data.paysystem] === 'undefined') {
            throw data.paysystem + ' not supported!';
        }
        const p = ps[data.paysystem];
        if (document.location.href.indexOf('/depositok?payment_id=') > -1) {
            const $close = await waitForElement('input[type="button"][value="Закрыть окно"]', 300, 15000);
            const balance = await bMess('QIWI_WB').check(30000).catch(() => '');
            await bMess('DEPOSIT_RESULT', true).set({
                success: true,
                message: 'It should be ok',
                balance,
            });
            ourCommand.clear();
            await bMess('LEON_COMMAND').remove();
            dLog('green', 'Leon', 'Deposit Result was set!');
            await delayPromise(3000);
            await mouseChain({target: $close[0], events: fullClick, error: '$close'});
            await delayPromise(100000);
            return [true, 'It should be ok', balance];
        } else if (ourCommand.getAdded('qiwiEntered') !== false) {
            dLog('green', 'Leon', 'Started wait for deposit result...');
            const depositResult = await bMess('DEPOSIT_RESULT', true)
                .get(150000, 70000, 1000)
                .catch(e => ({success: false, message: 'no deposit result (or it is outdated) for 150s!'}));
            dLog('green', 'Leon', ['DEPOSIT_RESULT received:', depositResult]);
            return [depositResult.success, depositResult.message, depositResult.balance];
        } else if (document.location.href.indexOf(p.check) > -1) {
            dLog('green', 'Leon', 'letsRockNRoll -= 1 =-');
            // $('input[name="amount"]') #qiwi-phone #subbutton
            const $el = await waitForElement('input[name="amount"]', 333, 15000);
            await delayPromise(3000);
            await clearAndInputNumber($el[0], data.amount);
            await delayPromise(3000);
            if (data.paysystem === 'QIWI' && bkName !== 'leoncupis') {
                await clearAndSimulate($('#qiwi-phone')[0], data.login.replace('+', '').replace(/^7/, ''));
                await delayPromise(3000);
            }
            ourCommand.add('increaseDelay', true);
            ourCommand.add('close', true);
            ourCommand.add('qiwiEntered', true);
            await bMess('LEON_COMMAND').set(ourCommand.get());
            dLog('green', 'Leon', 'LEON_COMMAND was set!');
            await bMess('DEPOSIT_RESULT', true).remove();
            await bMess(data.paysystem + '_COMMAND', true).set(ourCommand.get());
            await delayPromise(3000);
            await mouseChain({target: $('#subbutton')[0], events: ['click'], scroll: true, error: 'E_ONE'});
            await delayPromise(3000);
            return depositGo(data);
        } else if (['how-to-make-deposit', 'kak-popolnit-schet-bukmekerskoj-kontory']
            .some(s => document.location.href.indexOf(s) > -1)) {
            const $el = await waitForElement(p.select, 333, 15000);
            await mouseChain({target: $el[0], events: ['click'], scroll: true, error: 'E_TWO'});
            // Hint: here the page will reload again
            await delayPromise(3000);
            return depositGo(data);
        } else if ($('h1:textEquals("Пополнение счета")').length > 0) {
            const $li = await waitForElement('li.payments-list-item:contains("QIWI")',
                333, 10000);
            await delayPromise(1000);
            await mouseChain({target: $li[0], events: fullClick, error: '$li'});
            await delayPromise(4000);
            const $input = await waitForElement('input.payments-input__input',
                333, 15000, true);
            await delayPromise(1000);
            await clearAndSimulate($input[0], data.amount);
            await delayPromise(1000);
            ourCommand.add('increaseDelay', true);
            ourCommand.add('close', true);
            ourCommand.add('qiwiEntered', true);
            await bMess('LEON_COMMAND').set(ourCommand.get());
            await bMess('DEPOSIT_RESULT', true).remove();
            await bMess(data.paysystem + '_COMMAND', true).set(ourCommand.get());
            await mouseChain({
                target: $('button:contains("Пополнить")')[0], events: fullClick,
                error: 'Пополнить'
            });
            await delayPromise(4000);
            return depositGo(data);
        } else if (!ourCommand.getAdded('qiwiEntered')) {
            const $el = await waitForElement(() => $(findSel(['#depButton', 'div.balance__info'])),
                333, 10000);
            await mouseChain({target: $el[0], events: fullClick, scroll: true, error: 'E_THREE'});
            // Hint: here the page will reload
            await delayPromise(4000);
            return depositGo(data);
        }
    };

    const collectBetResultsCupis = async (data, limit) => {
        const collected = [];
        if (document.location.href.indexOf('/customer/history') === -1) {
            const $ob = await waitForElement('button.bet-slip-tabs__button:contains("Мои ставки")',
                333, 10000);
            await delayPromise(1000);
            await dClick($ob[0]);
            await delayPromise(1000);
            const $ch = await waitForElement('a[href="' + offshoreTag + '/customer/history"]', 333, 5000);
            await dClick($ch[0]);
            await delayPromise(3000);
        }
        const $hf = await waitForElement('div.history-list-route-component__filter-select', 333, 10000);
        if ($hf.find('select option:selected').trt() !== 'За последние 30 дней') {
            await selectLikePuppeteer($('select[name="dateSelect"]')[0], ['1']);
            await delayPromise(3000);
        }
        const $bets = await waitForElement('button:textEquals("Ставки")', 333, 15000);
        await delayPromise(1000);
        if (!$bets.hasClass('tabs-button--active')) {
            await mouseChain({target: $bets[0], events: fullClick, error: '$bets'});
            await delayPromise(3000);
        }
        const $rows = () => $('ul.history-list li');
        await waitForCondition(() => $rows().length > 0,
            333, 15000, 'No bets!');
        for (let i = 0; i < limit; i++) {
            if ($rows().eq(i).length === 0) {
                dLog('red', bkName, `Rows eq ${i} length is 0!`);
                break;
            }
            $rows().eq(i).get(0).scrollIntoView();
            await delayPromise(777);
            const statusResult = $rows().eq(i).find('span.bet-list-item__credit').trt().charAt(0);
            await delayPromise(333);
            await mouseChain({
                target: $rows().eq(i).find('div.history-list-item__container')[0], events: fullClick, error: 'openRow'
            });
            await delayPromise(555);
            const $back = await waitForElement('button[data-test-el="modal-prefix-button"]:visible',
                333, 10000);
            await delayPromise(1000);
            const pattern = (text, number) => number
                ? pattern(text).replace(/[^\d.]/g, '').trim()
                : $(`li[class*="__list-item"]:has(span:textEquals("${text}")):first span:last`).trt();
            const external_id = pattern('Номер ставки:') === ''
                ? $('div.transaction__header span:last').trt() : pattern('Номер ставки:');
            //dLog('blue', 'Leon', `${external_id} = ${result}`);
            await waitForCondition(() => !isNaN(parseFloat(pattern('Сумма ставки:', true))),
                333, 5000, 'Freeze');
            await delayPromise(1000);
            if (data.length === 0 || data.indexOf(external_id) > -1) {
                const result = parseFloat(pattern('Выигрыш:').replace(/[^\d.]/g, ''));
                const stake = parseFloat(pattern('Сумма ставки:', true).replace(/[^\d.]/g, ''));
                const coef = parseFloat(pattern('Коэффициент:', true));
                const match = $('span.event-details__competitors').trt();
                const bkPivot = `${pattern('Тип ставки:')} ${pattern('Выбор:')}`;
                const status = pattern('Статус:') !== 'Разыгран' ? 'ACCEPTED'
                    : (statusResult === '-') ? 'LOSE' : (statusResult === '+') ? 'WON'
                        : 'REFUNDED';
                collected.push({
                    external_id, status, match, bkPivot, coef, stake,
                    result: isNaN(result) ? '' : result
                });
            }
            if (data.length !== 0 && data.length === collected.length) {
                break;
            }
            await dClick($back[0]);
            await delayPromise(1222);
        }
        await delayPromise(555);
        await dClick($('button[data-test-el="modal-suffix-button"]:visible')[0]);
        return collected;
    };

    const collectBetResults = async inD => {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        dLog('green', 'Leon', [`collectBetResults, limit: ${limit}, cupis? ${isCupis}, data:`, data]);
        if (isCupis) {
            return await collectBetResultsCupis(data, limit);
        }
        if (window.location.href.indexOf('/my-account') === -1 && window.location.href.indexOf('/account') === -1) {
            const $account = await waitForElement('#user-icon-li a', 333, 10000);
            await mouseChain({target: $account[0], events: fullClick, scroll: true, error: '$account'});
            await delayPromise(3000);
        }
        const sel = 'select.selecttext.tr-days';
        if ($(sel).val() !== '3') {
            $(sel).val('3');
            await delayPromise(1000);
            await mouseChain({target: $('input.formbutton.account')[0], events: ['click']});
            await delayPromise(2000);
        }
        const betsSel = 'table.tbl-transactions a.more-bet-info';
        await waitForElement(betsSel, 500, 20000);
        let cBet = 0;
        while (cBet < $(betsSel).length && cBet < limit) {
            dLog('blue', 'Leon', `${cBet} < ${$(betsSel).length} && < ${limit}`);
            await mouseChain({target: $(betsSel).eq(cBet)[0], events: fullClick, scroll: true, error: 'bc'});
            await waitForCondition(() => $('div.stn-bet-detail-title span').trt().length > 0,
                333, 17000, 'external_id');
            let $this = $('#betDetModal');
            let external_id = $this.find('div.stn-bet-detail-title span').trt();
            if (data.length === 0 || data.indexOf(external_id) > -1) {
                let stake = parseFloat($this.find('div.stn-bet-detail-wrap:contains("Сумма ставки:")')
                    .find('div.stn-bet-detail-val').text().replace(/[^\d.]/g, '').trim());
                let resultDraft = $this.find('div.stn-bet-detail-wrap:contains("Выигрыш:")')
                    .find('div.stn-bet-detail-val span:visible').trt();
                let result = parseFloat(resultDraft.replace(/[^\d.]/g, '').trim());
                let match = $this.find('div.evt-name').first().trt();
                let coef = parseFloat($this.find('div.stn-bet-detail-wrap:contains("Коэффициент:")')
                    .find('div.stn-bet-detail-val').text().replace(/[^\d.]/g, '').trim());
                const $details = $this.find('div.stn-bet-detail-tbl-row').first();
                let bkPivot = $details.find('div.stn-bet-detail-tbl-event-type').trt()
                    + ' ' + $details.find('div.stn-bet-detail-tbl-event-market').trt();
                let status = 'ACCEPTED';
                if ((!isNaN(result) && result > stake) || $this.find('div.stn-bet-detail-tbl-event-outcome:contains("Выигр")').length > 0) {
                    status = 'WON';
                } else if (resultDraft === 'Проигран' || (!isNaN(result) && result > 0 && result < stake)) {
                    status = 'LOSE';
                } else if (resultDraft === 'Возврат') {
                    status = 'REFUNDED';
                }
                collected.push({
                    external_id: external_id,
                    status: status,
                    match: match,
                    bkPivot: bkPivot,
                    coef: coef,
                    stake: stake,
                    result: isNaN(result) ? '' : result
                });
            }
            cBet++;
            await mouseChain({target: $('button.ngdialog-close')[0], events: fullClick, error: 'bnc'});
            await delayPromise(800);
        }
        dLog('green', 'Leon', ['We collected:', collected]);
        return collected;
    };

    const proceedBet = data => new Promise(function (onSuccess, onReject) {
        currentBetData = {
            data: data,
            max: 0,
            external_id: '',
            willPlace: 0
        };
        const betFinished = async function (success, message) {
            let status = 'ACCEPTED';
            if (!success) {
                status = ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED'].find(c => typeof message === 'string' && message.indexOf(c) > -1) || 'FAILED';
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
            if (success) {
                await eventsWorkAll('leon',
                    settings.eventMaxBets, settings.eventTimeLimit,
                    currentBetData.data, true, true);
                await bMess('WasSuccessStake').set(Date.now());
                await bMess('Stake Maximums').set(0);
            }
            const doNotSend = !!currentBetData.data[0].betFromParser && !success
                && resultData.status !== 'LIMITED';
            if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                resultData.type = 'VALUE';
                resultData.mode = currentBetData.data[0].type;
                resultData.bookmaker = 'LEON.CUPIS';
                resultData.placedCoef = resultData.coef;
                resultData.coef = currentBetData.data[0].coef;
                resultData.source = '462' || 'oddscp';
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
            port.postMessage({
                answered: !!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED'
                    ? "F_BET" : "BET",
                data: resultData,
                answer: success ? 'Everything is Okay!' : message,
                doNotSend,
            });
            busy = false;
            ourCommand.clear();
            success ? onSuccess() : onReject(message);
        };
        proceedBetDo(data)
            .then(m => betFinished(true, m))
            .catch(e => betFinished(false, `proceedBet: ${e}, ${formatStack(e.stack)}`));
    });

    const proceedBetDo = async data => {
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
            const checkRes = await eventsWorkAll('leon',
                settings.eventMaxBets, settings.eventTimeLimit,
                currentBetData.data, false, true);
            if (checkRes !== 'OK') {
                dLog('red', 'LEON', `We got errors: ${checkRes}`);
                throw checkRes;
            } else {
                dLog('big-blue', 'LEON',
                    `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                for (const d of currentBetData.data) {
                    const eventName = `${d.team1} - ${d.team2}`;
                    dLog('blue', 'LEON', `${settings.eventMaxBets} for ${eventName} not reached`);
                }
            }
        }

        const collectCupis = async () => {
            const $ob = await waitForElement('button[data-test-id="tab-my-bets"]',
                333, 10000);
            await delayPromise(555);
            await mouseChain({target: $ob[0], events: fullClick, error: '$ob'});
            await delayPromise(555);
            const $bet = await waitForElement('li[class*="bet-slip-my-bets__row"]:first', 333, 5000);

            return {
                external_id: $bet.find('a').attr('href')
                    .split('/').slice(-1)[0],
                coef: $bet.find('p[class*="slip-list-item__odd_"]').trt(),
                stake: $bet.find('p[class*="slip-list-item__bet-value_"]').text()
                    .replace(',', '.').replace(/[^\d.]/g, '').trim(),
            };
        };
        const checkBalance = willPlace => {
            const balance = getBalance();
            if (isNaN(balance)) {
                throw 'Get balance error';
            } else if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };
        const checkSuccess = async () => {
            const
                bsS = 'div[class*="bet-slip-result__buttons_"] button:textEquals("Готово")',
                betSubmitSel = 'p[class*="bet-slip-result__heading_"]:textEquals("Пари принято"):visible';
            await waitForCondition(() => $(betSubmitSel).length > 0,
                333, 30000, 'No success!');
            await delayPromise(555);
            await mouseChain({
                target: $(bsS)[0],
                events: fullClick,
                error: 'bsS'
            });
            await delayPromise(333);

            return true;
        };

        await closePreviousCoupons(false);
        currentBetData.max = await openCoupon(data);
        console.log('after openCoupon');
        do {
            await checkCoefs(data);
            let willPlace = parseFloat(data[0].stake);
            if (currentBetData.max !== -1 && willPlace > currentBetData.max) {
                willPlace = currentBetData.max;
            }
            checkBalance(willPlace);
            const input = findSel(['input[class*="stake-input__value"]']);
            if ($(input).length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$(input).length}`;
            }

            await clearAndSimulate($(input)[0], willPlace.toString().replace('.00', '').trim());
            await delayPromise(1000);
            let entered = parseFloat($(input).val().toString());
            if (isNaN(entered) || willPlace !== entered) {
                bsError(port, `${entered} !== ${willPlace} - try to reenter!`);
                continue;
            }
            let $placeBtn = $(findSel(['button:textEquals("Заключить пари")']));
            if ($placeBtn.length === 0) {
                throw 'No place button or button disabled!';
            } else {
                await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: 'pb'});
            }
        } while (!await checkSuccess());
        await delayPromise(1000);
        return await collectCupis();
    };

    /**
     * Checks coefs into the coupon
     * @param data
     * @returns {Promise<string,string>}
     */
    const checkCoefs = async data => {
        const findInData = match => data.find(v => {
            const localMatch = `${v.team1} — ${v.team2}`.toLowerCase();
            return localMatch === match || locutus_similar_text(localMatch, match, true) > 60;
        });
        let $coupons = $(findSel(['li[class*="bet-slip-main__row"]']));
        let errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            let $this = $(this);
            const $teams = $this.find('li[class*="slip-list-item__competitors-member_"]');
            const match = `${$teams.eq(0).trt()} — ${$teams.eq(1).trt()}`
            if ($this.hasClass('market-unavailable')) {
                errors.push(match + ' LOW_COEF, market unavailable!');
                checked++;
                return true;
            }
            let localCoef = parseFloat($this.find('span[class*="slip-list-item__current-odd"]').trt());
            let localData = findInData(match.toLowerCase());
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if (!localData || isNaN(localCoef)) {
                errors.push(match + ' LOW_COEF - wrong match of localCoef!');
            }
            checked++;
        });
        if (errors.length === 0 && checked === data.length) {
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
            if (totalCoef >= nCheck * 1.2) {
                throw 'Coef TOO BIG: ' + totalCoef + ' instead of ' + data[0].coef;
            } else if (totalCoef < nCheck) {
                throw 'LOW_COEF ' + data[0].coef + ' > ' + totalCoef;
            } else {
                return 'Coefs fine!';
            }
        } else {
            throw errors.join('; ') + (checked !== data.length ? ' some stakes not checked ('
                + checked + '/' + data.length + ')!' : '');
        }
    };

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<jQuery,string>} jQuery element for bet
     */
    const getBetElement = async data => {
        //#-#-START
        let markets = {
            'ONE_TWO': {
                'ONE': {
                    root: ['main'], subroots: [], pivotKeys: ['market1x2.runnerHome', '1']
                }, // span data-ng-click contains
                'TWO': {root: ['main'], subroots: [], pivotKeys: ['market1x2.runnerAway', '2']},
                'DRAW': {root: ['main'], subroots: [], pivotKeys: ['market1x2.runnerDraw', 'X']},
                'ONE_DRAW': {root: ['Двойной исход'], subroots: [], pivotKeys: ['1Х', '1X']},
                'TWO_DRAW': {root: ['Двойной исход'], subroots: [], pivotKeys: ['Х2', 'Х2']},
                'ONE_TWO': {root: ['Двойной исход'], subroots: [], pivotKeys: ['12']},
            },
            'TOTAL': {
                'OVER': {
                    root: ['Тотал', 'Азиатский тотал'],
                    subroots: [],
                    pivotKeys: ['Больше (#PIVOT#)', 'Больше (#PIVOTR#)']
                },
                'UNDER': {
                    root: ['Тотал', 'Азиатский тотал'],
                    subroots: [],
                    pivotKeys: ['Меньше (#PIVOT#)', 'Меньше (#PIVOTR#)']
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    root: ['Тотал хозяев'],
                    subroots: [],
                    pivotKeys: ['Больше (#PIVOT#)', 'Больше (#PIVOTR#)']
                },
                'UNDER': {
                    root: ['Тотал хозяев'],
                    subroots: [],
                    pivotKeys: ['Меньше (#PIVOT#)', 'Меньше (#PIVOTR#)']
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    root: ['Тотал гостей'],
                    subroots: [],
                    pivotKeys: ['Больше (#PIVOT#)', 'Больше (#PIVOTR#)']
                },
                'UNDER': {
                    root: ['Тотал гостей'],
                    subroots: [],
                    pivotKeys: ['Меньше (#PIVOT#)', 'Меньше (#PIVOTR#)']
                },
            },
            'HDP': {
                'HOME': {
                    root: ['Азиатский гандикап', 'Азиатская фора', 'Фора'],
                    subroots: [],
                    pivotKeys: ['1 (#PIVOTR#)', '1 (#PIVOTZ#)', '1 (#PIVOT#)', '1 (#PIVOH#)']
                },
                'AWAY': {
                    root: ['Азиатский гандикап', 'Азиатская фора', 'Фора'],
                    subroots: [],
                    pivotKeys: ['2 (#PIVOTR#)', '2 (#PIVOTZ#)', '2 (#PIVOT#)', '2 (#PIVOH#)']
                }
            },
            'EURO_HDP': {
                'H1': {
                    root: ['Гандикап (3 исхода)', 'Гандикап'],
                    subroots: [],
                    pivotKeys: ['1 (#PIVOTR#)', '1 (#PIVOTZ#)', '1 (#PIVOT#)', '1 (#PIVOH#)']
                },
                'H2': {
                    root: ['Гандикап (3 исхода)', 'Гандикап'],
                    subroots: [],
                    pivotKeys: ['2 (#PIVOTR#)', '2 (#PIVOTZ#)', '2 (#PIVOT#)', '2 (#PIVOH#)']
                },
                'HX': {
                    root: ['Гандикап (3 исхода)', 'Гандикап'],
                    subroots: [],
                    pivotKeys: ['X (#PIVOTR#)', 'X (#PIVOTZ#)', 'X (#PIVOT#)', 'X (#PIVOH#)']
                }
            },
            'CORNER_HDP': {
                'HOME': {
                    root: ['Фора по угловым'],
                    subroots: [],
                    pivotKeys: ['1 (#PIVOTR#)', '1 (#PIVOTZ#)', '1 (#PIVOT#)', '1 (#PIVOH#)']
                },
                'AWAY': {
                    root: ['Фора по угловым'],
                    subroots: [],
                    pivotKeys: ['2 (#PIVOTR#)', '2 (#PIVOTZ#)', '2 (#PIVOT#)', '2 (#PIVOH#)']
                }
            },
            'CORNER_TOTAL': {
                'OVER': {
                    root: ['Тотал угловых'],
                    subroots: [],
                    pivotKeys: ['Больше (#PIVOT#)', 'Больше (#PIVOTR#)']
                },
                'UNDER': {
                    root: ['Тотал угловых'],
                    subroots: [],
                    pivotKeys: ['Меньше (#PIVOT#)', 'Меньше (#PIVOTR#)']
                },
            },
            half: {
                'ONE_TWO': {
                    'ONE': {
                        root: ['1-й тайм: Победитель',],
                        subroots: [],
                        pivotKeys: ['1'],
                    },
                    'TWO': {
                        root: ['1-й тайм: Победитель',],
                        subroots: [],
                        pivotKey: ['2'],
                    },
                    'DRAW': {
                        root: ['1-й тайм: Победитель',],
                        subroots: [],
                        pivotKeys: ['Х', 'X'],
                    },
                    'ONE_DRAW': {root: ['1-й тайм: Двойной исход'], subroots: [], pivotKeys: ['1Х', '1X']},
                    'TWO_DRAW': {root: ['1-й тайм: Двойной исход'], subroots: [], pivotKeys: ['Х2', 'X2']},
                    'ONE_TWO': {root: ['1-й тайм: Двойной исход'], subroots: [], pivotKey: '12'}
                },
                'TOTAL': {
                    'OVER': {
                        root: ['1-я половина: Тотал', '1-й тайм: Азиатский тотал', '1-й тайм: Тотал'],
                        subroots: [],
                        pivotKeys: ['Больше (#PIVOT#)', 'Больше (#PIVOTR#)']
                    },
                    'UNDER': {
                        root: ['1-я половина: Тотал', '1-й тайм: Азиатский тотал', '1-й тайм: Тотал'],
                        subroots: [],
                        pivotKeys: ['Меньше (#PIVOT#)', 'Меньше (#PIVOTR#)']
                    },
                },
                'HDP': {
                    'HOME': {
                        root: ['1-я половина: Азиатский гандикап', '1-й тайм: Фора'],
                        subroots: [],
                        pivotKeys: ['1 (#PIVOTR#)', '1 (#PIVOTZ#)', '1 (#PIVOT#)', '1 (#PIVOH#)']
                    },
                    'AWAY': {
                        root: ['1-я половина: Азиатский гандикап', '1-й тайм: Фора'],
                        subroots: [],
                        pivotKeys: ['2 (#PIVOTR#)', '2 (#PIVOTZ#)', '2 (#PIVOT#)', '2 (#PIVOH#)']
                    }
                },
            }
        };

        if (data.sport === 'FOOTBALL' && data.time_value === 'HALF_TIME') {
            markets = markets.half;
        } else {
            delete markets.half;
        }

        const $teams = $('div[class*="headline-team-name_"]');
        if ($teams.length !== 2) {
            throw 'No teams!';
        }
        data.team1 = $teams.eq(0).trt().toLowerCase();
        data.team2 = $teams.eq(1).trt().toLowerCase();
        data.team1b = $teams.eq(0).trt();
        data.team2b = $teams.eq(1).trt();

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw 'Unsupported ' + data.time_value + '/' + data.market + '/' + data.target;
        }

        let isInteger = function (v) {
            let real = parseFloat(v);
            if (isNaN(real)) {
                throw v + ' is not a number!';
            }
            return (real ^ 0) === real;
        };

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
                        res = (data.pivot.toString().indexOf('-') > -1 ? '-' : '+') + round(fp, 2)
                            .toFixed(2).toString();
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
                    res = '-' + round(fp, 2).toFixed(2).toString();
                } else {
                    res = (fp > 0 ? '+' : '') + round(fp, 1).toFixed(1).toString();
                }
            }
            return res;
        };

        const specialPivotHFormatter = () => {
            let fp = parseFloat(typeof data.pivot !== 'undefined' ? data.pivot.toString() : '');
            return fp === 0 ? '+0' : fp > 0 ? '+' + fp.toString() : fp.toString();
        };

        let rootModifier = function (input) {
            let output = input;
            let additions = {};
            let specialAdditions = {
                condition: [],
                func: () => {
                }
            };

            let needChange = [];
            let needRemove = [];
            let replacements = [];
            if (data.sport === 'HOCKEY' && data.time_value !== 'FULL_TIME') {
                needChange = ['main', 'Двойной исход', 'Тотал', 'Азиатский тотал', 'Тотал хозяев', 'Тотал гостей', 'Азиатский гандикап', 'Фора'];
                //needRemove = ['main'];
                additions = {
                    'PERIOD_1': '1-й период:',
                    'PERIOD_2': '2-й период:',
                    'PERIOD_3': '3-й период:',
                };
                replacements.push({from: 'main', to: '1X2'});
                specialAdditions.condition = ['Азиатский тотал', 'Тотал хозяев', 'Тотал гостей'];
                specialAdditions.func = () => {
                    return specialPivotFormatter('TOTAL', data.pivot);
                };
            } else if (data.sport === 'BASKETBALL' && data.time_value !== 'FULL_TIME') {
                needChange = ['main', 'Двойной исход', 'Тотал', 'Азиатский тотал', 'Тотал хозяев', 'Тотал гостей', 'Азиатский гандикап', 'Фора'];
                additions = {
                    'TIME_1': '1-я половина:',
                    'HALF_TIME': '2-я половина:',
                    'Q_1': '1-я четверть:',
                    'Q_2': '2-я четверть:',
                    'Q_3': '3-я четверть:',
                    'Q_4': '4-я четверть:',
                };
                replacements.push({from: 'main', to: '1X2'});
            } else if (data.sport === 'TENNIS') {
                if (data.market === 'TOTAL') {
                    replacements.push({from: 'Тотал', to: 'Тотал геймов'});
                } else if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                    replacements.push({from: 'Тотал хозяев', to: 'Тотал геймов первого игрока'});
                    replacements.push({from: 'Тотал гостей', to: 'Тотал геймов второго игрока'});
                } else if (data.market === 'HDP') {
                    replacements.push({from: 'Фора', to: 'Гандикап геймов'});
                    replacements.push({from: 'Фора', to: 'Гандикап сетов'});
                } else if (data.market === 'ONE_TWO') {
                    replacements.push({from: 'main', to: '1X2'});
                }

                if (data.time_value !== 'FULL_MATCH') {
                    if (data.time_value.indexOf('GAME') > -1) {
                        let parts = data.time_value.split('_GAME_');
                        let set = parts[0].replace(/[^\d]/g, '');
                        let game = parts[1];
                        needChange = ['main', 'Двойной исход'];
                        additions[data.time_value] = set + '-й сет ' + game + '-й гейм:';
                    } else {
                        needChange = ['Тотал', 'Фора'];
                        for (let i = 1; i <= 5; i++) {
                            additions[i + '_SET'] = i + '-й сет:';
                        }
                    }
                }
            } else if (data.sport === 'VOLLEYBALL') {
                if (data.market === 'HDP') {
                    replacements.push({from: 'Фора', to: 'Фора по очкам'});
                } else if (data.market === 'TOTAL') {
                    replacements.push({from: 'Тотал', to: 'Тотал очков'});
                }

                if (data.time_value !== 'FULL_MATCH') {
                    needChange = ['main', 'Фора', 'Тотал', 'Азиатский тотал', 'Тотал хозяев', 'Тотал гостей', 'Азиатский гандикап'];
                    for (let i = 1; i <= 5; i++) {
                        additions['SET_' + i] = i + '-й сет:';
                    }
                    replacements.push({from: 'main', to: '1X2'});
                }
            } else if (data.sport === 'TABLETENNIS') {
                if (data.market === 'TOTAL') {
                    replacements.push({from: 'Тотал', to: 'Тотал очков'});
                } else if (data.market === 'HDP') {
                    if (data.time_value === 'FULL_MATCH') {
                        replacements.push({from: 'Фора', to: 'Фора по очкам'});
                    }
                } else if (data.market === 'ONE_TWO') {
                    if (data.time_value !== 'FULL_MATCH') {
                        switch (data.target) {
                            case 'ONE':
                                replacements.push({from: 'main', to: 'Победитель'});
                                break;
                            case 'TWO':
                                replacements.push({from: 'main', to: 'Победитель'});
                                break;
                        }
                    }
                }

                if (data.time_value !== 'FULL_MATCH') {
                    needChange = ['Тотал', 'Фора', 'main'];
                    for (let i = 1; i <= 5; i++) {
                        additions['SET_' + i] = i + '-й сет:';
                    }
                }
            } else if (data.sport === 'CYBERSPORT' && data.time_value !== 'FULL_MATCH') {
                needChange = ['Фора', 'main', 'Тотал'];
                replacements.push({from: 'Фора', to: 'Гандикап раундов'});
                replacements.push({from: 'main', to: 'Победитель'});
                replacements.push({from: 'Тотал', to: 'Тотал раундов'});
                for (let i = 1; i <= 4; i++) {
                    additions['MAP_' + i] = i + '-я карта:';
                }
            } else if (data.sport === 'BASEBALL') {
                if (data.time_value !== 'FULL_MATCH') {
                    needChange = ['Тотал', 'Фора', 'Тотал хозяев', 'Тотал гостей', 'Двойной исход'];
                    if (data.market === 'ONE_TWO') {
                        replacements.push({from: 'Двойной исход', to: '1X2'});
                    }
                    for (let i = 1; i <= 8; i++) {
                        additions['INNING_' + i] = i + '-й иннинг:';
                    }
                } else {
                    if (data.market === 'HDP') {
                        replacements.push({from: 'Фора', to: 'Фора (включая OT)'});
                    } else if (data.market === 'TOTAL') {
                        replacements.push({from: 'Тотал', to: 'Тотал (включая OT)'});
                    } else if (data.market === 'ONE_TWO') {
                        replacements.push({from: 'Двойной исход', to: '1X2 (основное время)'});
                    }
                }
            }

            if (needChange.indexOf(input) > -1) {
                output = typeof additions[data.time_value] === 'string' ? (additions[data.time_value] + ' ' + output) : output;
                if (specialAdditions.condition.indexOf(input) > -1) {
                    console.log('Added for ' + input);
                    output += ' ' + specialAdditions.func();
                }
            } else if (needRemove.indexOf(input) > -1) {
                output = 'It must to be removed!';
            }

            replacements.forEach((item) => {
                output = output.replace(item.from, item.to);
            });

            return output;
        };

        let rootModifierWrapper = function (markets) {
            for (const mmm of Object.keys(markets)) {
                for (const ttt of Object.keys(markets[mmm])) {
                    markets[mmm][ttt]['root'].forEach((root, idx) => {
                        if (data.market === 'TOTAL' && root === 'Тотал' && isInteger(data.pivot)) {
                            console.log('%cdeleted - ' + data.pivot + ' = ' + isInteger(data.pivot),
                                'background: blue; color: white; font-weight: bold;');
                            delete markets[mmm][ttt]['root'][idx];
                        } else {
                            markets[mmm][ttt]['root'][idx] = rootModifier(root);
                        }
                    });
                }
            }
        };

        let replaceInner = function (element, parent, index) {
            if (typeof element === 'string') {
                parent[index] = element.replace('#TEAM1#', data.team1).replace('#TEAM2#', data.team2)
                    .replace('#TEAM1B#', data.team1b).replace('#TEAM2B#', data.team2b)
                    .replace('#PIVOT#', data.pivot).replace('#PIVOTR#', specialPivotFormatter(data.market, data.pivot))
                    .replace('#PIVOTZ#', specialPivotZFormatter())
                    .replace('#PIVOH#', specialPivotHFormatter());
            } else if (typeof element === 'object') {
                for (let i in element) {
                    replaceInner(element[i], element, i);
                }
            } else {
                // console.log(typeof element + ' not supported! (' + element + ')');
            }
        };

        replaceInner(markets, null, null);
        //rootModifierWrapper(markets);

        let finalPrepareForMarket = function (market) {
            if (data.sport === 'HOCKEY' && data.time_value !== 'FULL_MATCH' && data.market.indexOf('TOTAL') > -1
                && !(data.market === 'TOTAL' && !isInteger(data.pivot))) {
                market.pivotKeys = data.target === 'OVER' ? ['Больше'] : ['Меньше'];
            }
            return market;
        };

        let market = finalPrepareForMarket(markets[data.market][data.target]);

        dLog('green', 'Leon', ['Work with market:', market]);

        const performGet = async () => {
            let $el = $([]);
            let $rootCandidates = $([]);
            const $allMarkets = await waitForElement(() => $(findSel([
                'button[class*="tabs-button_"]:textEquals("Все"):visible'
            ])), 333, 5555);
            if (!$allMarkets.is('[class*="tabs-button--active_"]')) {
                await mouseChain({
                    target: $allMarkets[0],
                    events: fullClick, error: '$allMarkets!',
                });
                await delayPromise(1500);
            }
            const
                $all = $('section[class*="sport-event-details-market-group_"]'),
                $main = $('button[class*="sportline-primary-market-runner_"]');

            for (const cdRoot of market.root) {
                if (cdRoot === 'main') {
                    $rootCandidates = $main;
                } else {
                    $rootCandidates = $all.find(`span[class*="market-group-title__label_"]:textEquals("${cdRoot}")`);
                    if ($rootCandidates.length === 0) {
                        continue;
                    }
                }

                if ($rootCandidates.length === 0) {
                    throw `No root candidates! for (${market.root})`;
                }

                if (market.root[0] === 'main') {
                    for (const pk of market.pivotKeys) {
                        $el = $rootCandidates
                            .find(`span:first-child:textEquals("${pk}")`);
                    }
                } else {
                    console.log('$rootCandidates ', $rootCandidates)
                    for (const pk of market.pivotKeys) {
                        $el = $rootCandidates
                            .closest('article')
                            .find(`span[class*="sportline-group-market-runner__coefficient_"]:textEquals("${pk}")`);
                        if ($el.length > 0) {
                            break;
                        }
                    }
                }

                if ($el.length > 0) {
                    return $el;
                }
            }

            return $el;
        };
        const started = Date.now();
        while (Date.now() - started < 15000) {
            const $res = await performGet();
            if ($res.length > 0) {
                return $res;
            }
            await delayPromise(500);
        }
        throw `${data.sport}/${data.time_value}/${data.market}/${data.target}/${data.pivot} not found!`;
        //#-#-FINISH
    };

    /**
     * Close early opened coupons
     * @param skipParam [{boolean}] default FALSE - whether we need to skip closing
     * @returns {Promise<string,string>}
     */
    const closePreviousCoupons = async skipParam => {
        if (skipParam) {
            return 'skipped!';
        }
        let closeOne = async () => {
            let $closes = $(findSel(['button[data-test-id="remove-button"]']));
            if ($closes.length > 0) {
                await mouseChain({target: $closes[0], events: ['click'], scroll: true});
                await delayPromise(777);
                await closeOne();
            } else {
                return 'All were closed!';
            }
        };
        // Hint: Click 'Remove all' once or each 'Close'
        let $clearBtn = $(findSel(['button:textEquals("Удалить всё")']));
        if ($clearBtn.length === 1) {
            await mouseChain({target: $clearBtn[0], events: ['click'], scroll: true, scrollTop: true});
            await delayPromise(888);
            const $accept = $('button[class*="bet-slip-clear-overlay__button"]:textEquals("Удалить")');
            if ($accept.length > 0) {
                await mouseChain({target: $accept[0], events: fullClick, error: '$accept'});
                await delayPromise(500);
            }
            return 'ClearBtn clicked!';
        } else {
            await closeOne();
        }
    };

    const openEvent = async data => {
        const eventName = `${data.team1} - ${data.team2}`.toLowerCase();
        const checkWeAreThere = async () => {
            if (data.bk_event_native_id) {
                return document.location.href.indexOf(`/${data.bk_event_native_id}-`) > -1
            } else {
                const $teams = await waitForElement('div[class*="headline-team-name_"]', 333, 3333)
                    .catch(() => $([]));
                const checkEvent = `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}`.toLowerCase();
                dLog('', 'Leon', `checkWeAreThere: ${checkEvent}/${eventName} `
                    + `at ${document.location.href}`);
                return checkEvent === eventName
                    || locutus_similar_text(checkEvent, eventName, true) > 75;
            }
            
        };
        const switchToSport = async () => {
            let sport = sportAccordance[data.sport];
            if (!sport) {
                throw `Accordance for ${sport} not found!`;
            }
            const osSel = `a[href="/live/${sport}"]`;
            if (!$(osSel).is('[class*="sportline-filter__item--active_"]')) {
                await mouseChain({
                    target: $(osSel)[0],
                    events: fullClick,
                    error: 'sps: ' + osSel,
                });
                await delayPromise(1222);
            }
        };
        if (await checkWeAreThere()) {
            dLog('green', 'Leon', `We're on the event!`);
            return;
        }
        if (document.location.href.indexOf('/live') === -1) {
            dLog('blue', 'Leon', `Not on live (${document.location.href})`);
            const $liveLink = $(findSel(['a[href="' + offshoreTag + '/live"]']));
            if ($liveLink.length > 0) {
                await mouseChain({target: $liveLink[0], events: ['click'], scroll: true, error: 'll'});
                await delayPromise(500);
            }
        }
        await switchToSport();
        await waitForCondition(() => $(findSel(['div[class*="sportline-event-block_"]:visible'])).length > 0, 333, 15000, 'No events rows!');
        const $r = $(findSel(['div[class*="sportline-event-block_"]:visible']))
            .filter(function () {
                if (data.bk_event_native_id) {
                    const href = $(this).find('a').attr('href');
                    return href && href.indexOf(`/${data.bk_event_native_id}-`) > -1;
                } else {
                    const $cup = $(this).find('span[class*="sportline-event-competitor__name_"]');
                    let checkEvent = `${$cup.eq(0).trt()} - ${$cup.eq(1).trt()}`.toLowerCase();
                    return checkEvent === eventName
                        || locutus_similar_text(checkEvent, eventName, true) > 90;
                }
            });
        $r[0].scrollIntoView();

        if ($r.length === 0) {
            throw 'Event not found';
        } else {
            await mouseChain({target: 
                $r.find('a[class*="sportline-event-info_"]')[0],
                events: fullClick,
                error: '$r'
            });
        }
        await waitForCondition(() => checkWeAreThere(), 333, 15000,
            'Still not at event!');
    };

    /**
     * Opens coupon with stake (stakes)
     * @param {object[]} paramData - array of bets to open
     * @returns {Promise<float, string>}
     */
    const openCoupon = paramData => new Promise(function (onSuccess, onReject) {
        bsDebug(port, 'openCoupon, paramData:', paramData);
        let result = function (success, message) {
            if (!success) {
                onReject(message);
                return;
            }
            const getMaxHere = function () {
                if (data && data.doNotOpen) {
                    onSuccess(1000050000);
                    return;
                }


                const $max = $('button[class*="fast-money-choice__button"]:textEquals("MAX")');
                if ($max.length > 0) {
                    mouseChain({target: $max[0], events: fullClick, error: '$max'})
                        .then(delayFunction(1000))
                        .then(() => {
                            const max = parseFloat($('input[class*="stake-input__value_"]').val());
                            if (!isNaN(max) && max > 0) {
                                onSuccess(Math.round(max * 1000) / 1000);
                            } else {
                                onReject('Max is NaN or 0!');
                            }
                        })
                        .catch(e => onReject(e));
                } else {
                    onReject('No MAX button!');
                }
            };
            if (lData.length > 0) {
                ourCommand.add('express', ourCommand.getAdded('express') + 1);
                data = paramData[ourCommand.getAdded('express')];
                bsDebug(port, 'openCoupon - We got data: ' + (typeof data), data);
                if (typeof data !== 'undefined') {
                    openElement()
                        .catch(e => result(false, 'Error till open event: ' + e));
                } else {
                    getMaxHere(true);
                }
            } else {
                getMaxHere(false);
            }
        };
        let lData = paramData.slice();
        let data = {};
        const openElement = async () => {
            await openEvent(data);
            dLog('green', 'Leon', 'Event must be opened!');
            const $element = await getBetElement(data);
            $element[0].scrollIntoView();
            await delayPromise(777);
            await mouseChain({
                target: ($element)[0],
                events: fullClick, error: 'elClick',
            });
            const $limit = await waitForElement('div.modal-window__wrapper div:textEquals("Достигнут лимит по экспрессу")', 333, 2888).catch(() => $([]));

            if ($limit.length > 0) {
                await mouseChain({
                    target: $('div.modal-header__suffix button:visible')[0],
                    events: fullClick,
                    error: '$limit',
                });
                throw 'Достигнут лимит по экспрессу';
            }
            
            result(true, '');
        };
        if (ourCommand.getAdded('express') !== false) {
            data = paramData[ourCommand.getAdded('express')];
        } else {
            data = lData.shift();
        }
        if (typeof data !== 'undefined') {
            bsDebug(port, 'openCoupon - basic - We got data: ' + (typeof data), data);
            openElement()
                .catch(e => result(false, 'Error till open event: ' + e));
        } else {
            onReject('There is no input data!');
        }
    });

    const getBalance = returnNull => {
        const $b = $(findSel(['div[class^="balance__text_"]']));
        if ($b.length > 0) {
            return parseFloat($b.trt().replace(',', '.')
                .replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    };

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
                'span.push-notifications__postpone': 'span.push-notifications__postpone',
                'div.push-notifications__postpone': 'div.push-notifications__postpone',
                'button.push-modal__button.dismiss': 'button.push-modal__button.dismiss',
                'p:textStarts("Время Вашей сессии истекло")': 'button:textEquals("Закрыть")',
                'div.heading:contains("добавить больше событий в")': 'button:textEquals("Закрыть")',
                'button:textEquals("Повторить")': 'button:textEquals("Повторить")',
                'div.hint-block__wrapper:contains("Идентификация завершена")': 'button:textEquals("Скрыть")',
                'span.button__inner:textEquals("Отмена"):visible': 'span.button__inner:textEquals("Отмена"):visible',
                'div.push-notifications button.button--icon-only': 'div.push-notifications button.button--icon-only',
                'button.snack-bar__close-button': 'button.snack-bar__close-button'
            }).catch(e => console.log(`Close: ${e}`));

        if ($(findSel(logSels)).length > 0) {
            // Hint: Log In
            port.postMessage({m: "tech works! 2"});
            delayPromise(1000)
                .then(tryToLogIn)
                .catch(e => {
                    bsError(port, 'Error till logging in: ' + e);
                    port.postMessage({m: "ERROR AUTH! " + e});
                })
                .finally(() => {
                    delayPromise(settings.authCheckInterval).then(authCheck);
                });
        } else {
            port.postMessage({
                m: "authorized!",
                balance: getBalance(true),
            });
            setTimeout(function () {
                authCheck(settings);
            }, settings.authCheckInterval);
        }
    };

    const selectLoginTab = async () => {
        const loginArr = settings.login.split('');
        const regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
        if (isCupis
            && loginArr.length > 2
            && loginArr[0] === '+'
            && loginArr[1] === '7'
        ) {
            phoneNumber = true;
            await mouseChain({
                target: $('button:textEquals("Телефон")')[0],
                events: fullClick,
                error: 'No phone tab!'
            });
        } else if (regex.test(settings.login)) {
            inputEmail = true;
            await mouseChain({
                target: $('button:textEquals("E-mail")')[0],
                events: fullClick,
                error: 'No E-mail tab!'
            });
        } else {
            await mouseChain({
                target: $('button:textEquals("Номер счета")')[0],
                events: fullClick,
                error: 'No E-mail tab!'
            });
        }
    };

    const tryToLogIn = async () => {
        const logFormTitle = 'h1[class*="modal-header__title"]:textEquals("Вход")';
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }

        if ($(logFormTitle).length === 0) {
            await mouseChain({target: $(findSel(logSels))[0], events: fullClick, error: 'logSels'});
            await delayPromise(555);
            await waitForElement('h1[class*="modal-header__title"]:textEquals("Вход")', 333, 10000);
        }

        dLog('green', 'Leon', `Let's login!`);

        //select tab
        await selectLoginTab();
        await delayPromise(1500);

        const $username = $(findSel(loginSels)), password = 'input[name="password"]',
            remember = 'label:has(span:textEquals("Сохранить пароль")) input';

        if ($username.length === 0) {
            throw 'No login selector exist!';
        }
        if ($username.val() !== settings.login) {
            if (inputEmail) {
                await clearAndInputEmail($username[0], settings.login);
            } else if (phoneNumber) {
                await clearAndSimulate($username[0], settings.login.replace('+7', ''));
            } else {
                await clearAndSimulate($username[0], settings.login);
            }
        }
        await delayPromise(2000);
        await clearAndSimulate($(password)[0], settings.password);
        await delayPromise(1500);
        if ($(remember).length > 0 && !$(remember).is(':checked')) {
            await mouseChain({target: $(remember)[0], events: ['click']});
            await delayPromise(1000);
        }
        await mouseChain({
            target: $('button:textEquals("войти")')[0],
            events: fullClick, error: 'LoginButton'
        });
        await delayPromise(555);
        const $profile = await waitForElement('a[href="/profile"]:visible', 333, 12222).catch(() => $([]));
        if ($profile.length === 0) {
            enterError = true;
        }
        
        authClicked = Date.now();
        return 'Must be logged in!';
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('red', 'Leon', `We'll store command!`);
            bMess('LEON_COMMAND').set(ourCommand.get())
                .then(() => dLog('green', 'Leon', ['Command was set till unload:', ourCommand.get()]))
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        //if (window.self === window.top) {
        let currentCommand;
        bMess('LEON_COMMAND').check(40000)
            .then(aCommand => currentCommand = aCommand)
            .then(waitForConditionF(() => typeof wasAuthCheck === 'boolean' && wasAuthCheck, 333, 20000, 'No auth check!'))
            .then(() => dLog('green', 'Leon', ['Restoring with: ', currentCommand]))
            .then(() => messageProcessor(currentCommand))
            .catch(async e => {
                console.log(`afterDOMLoaded ONE: ${e}`);
                if (document.location.href.indexOf('/depositok?payment_id=') > -1) {
                    const $close = await waitForElement('input[type="button"][value="Закрыть окно"]', 300, 15000);
                    if ($close.length > 0) {
                        await mouseChain({target: $close[0], events: fullClick, error: '$close'});
                    }
                }
            });
        //}
        port.postMessage({m: "PAGE LOADED!"});
    }

    console.log('%c - - - - - - - - - - ', 'background: orange; color: white; font-weight: bold;');
    console.log(`%c - leon.js (${bkName}/${isCupis}) LOADED - ;)`, 'background: orange; color: white; font-weight: bold;');
    console.log('%c - - - - - - - - - - ', 'background: orange; color: white; font-weight: bold;');

})();
