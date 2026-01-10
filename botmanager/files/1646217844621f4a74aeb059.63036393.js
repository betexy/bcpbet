(function () {

    "use strict";

    let authClicked = 0;
    let wasAuthCheck = false;
    let busy = false;
    let increaseDelay = false;
    let port = chrome.runtime.connect({name: "port_betcity"});
    let settings = {
        authCheckInterval: 2000,
        url: 'https://betcityru.com/en/live',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: ''
    };

    let currentBetData = false;
    let currentCommand = '';

    let ourCommand = new ourCommandProto();
    let enterError = false;

    let sportAccordance = {
        'FOOTBALL': 'Soccer',
        'TENNIS': '',
        'HOCKEY': 'Ice Hockey',
        'VOLLEYBALL': '',
        'BASEBALL': '',
        'BASKETBALL': '',
        'HANDBALL': ''
    };

    let messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        currentCommand = message.action;
        let $logLink = $('a.btn.btn_signin:visible');
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
        } else if ($logLink.length !== 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (message.action === 'MAXIMUM') {
            busy = true;
            ourCommand.set(message);
            bsDebug(port, 'MAXIMUM for: ' + message.data[0].market + '/' + message.data[0].target + '/' + message.data[0].pivot);
            let max;
            closePreviousCoupons(false)
                .then(() => openCoupon(message.data))
                .then((m) => max = m)
                .then(() => checkCoefs(message.data))
                .then(() => {
                    busy = false;
                    port.postMessage({
                        answered: "MAXIMUM",
                        status: 'success',
                        answer: max
                    });
                    ourCommand.clear();
                })
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
                    return mouseChain({target: $('a.menu__item[href="/en/live"]').first()[0], events: ['click']});
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
                    return mouseChain({target: $('a.menu__item[href="/en/live"]').first()[0], events: ['click']});
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
                    return mouseChain({target: $('a.menu__item[href="/en/live"]').first()[0], events: ['click']});
                });
        } else if (message.action === 'DEPOSIT') {
            busy = true;
            ourCommand.set(message);
            deposit(message.data)
                .then(() => bsDebug(port, "It's looks like DEPOSIT done!"))
                .catch((e) => bsError(port, 'Error till DEPOSIT: ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                    return mouseChain({target: $('a.menu__item[href="/en/live"]').first()[0], events: ['click']});
                });
        } else if (message.action === 'WITHDRAW') {
            busy = true;
            ourCommand.set(message);
            withdraw(message.data)
                .then(() => bsDebug(port, "It's looks like WITHDRAW done!"))
                .catch((e) => bsError(port, 'Error till WITHDRAW: ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                    return mouseChain({target: $('a.menu__item[href="/en/live"]').first()[0], events: ['click']});
                });
        } else if (message.action === 'CHECK_PAYMENTS') {
            busy = true;
            ourCommand.set(message);
            collectBetResults(message.data)
                .then(() => bsDebug(port, "It's looks like CHECK_PAYMENTS done!"))
                .catch((e) => bsError(port, 'Error till CHECK_PAYMENTS: ' + e))
                .then(delayFunction(3333))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                    return mouseChain({target: $('a.menu__item[href="/en/live"]').first()[0], events: ['click']});
                });
        }
    };

    let register = function (data) {
        bsDebug(port, 'register!');
        return new Promise(function (onSuccess, onReject) {
            let betcityAccordance = {
                'москва': 'Москва',
                'московская область': 'Московская область',
                'ярославская область': 'Ярославская область',
                'ивановская область': 'Ивановская область',
                'костромская область': 'Костромская область',
                'вологодская область': 'Вологодская область',
                'архангельская область': 'Архангельская область',
                'ненецкий автономный округ': 'Ненецкий автономный округ',
                'коми республика': 'Республика Коми',
                'тверская область': 'Тверская область',
                'новгородская область': 'Новгородская область',
                'псковская область': 'Псковская область',
                'мурманская область': 'Мурманская область',
                'карелия республика': 'Республика Карелия',
                'ленинградская область': 'Ленинградская область',
                'санкт-петербург': 'Санкт-Петербург',
                'смоленская область': 'Смоленская область',
                'калининградская область': 'Калининградская область',
                'брянская область': 'Брянская область',
                'калужская область': 'Калужская область',
                'крым республика': 'Республика Крым',
                'севастополь': 'Севастополь',
                'тульская область': 'Тульская область',
                'орловская область': 'Орловская область',
                'курская область': 'Курская область',
                'белгородская область': 'Белгородская область',
                'ростовская область': 'Ростовская область',
                'краснодарский край': 'Краснодарский край',
                'ставропольский край': 'Ставропольский край',
                'калмыкия республика': 'Республика Калмыкия',
                'кабардино-балкарская республика': 'Кабардино-Балкарская республика',
                'северная осетия - алания республика': '',
                'чеченская республика': 'Республика Северная Осетия— Алания',
                'дагестан республика': 'Республика Дагестан',
                'карачаево-черкесская республика': 'Карачаево-Черкесская Республика',
                'адыгея республика': 'Республика Адыгея',
                'ингушетия республика': 'Республика Ингушетия',
                'рязанская область': 'Рязанская область',
                'тамбовская область': 'Тамбовская область',
                'воронежская область': 'Воронежская область',
                'липецкая область': 'Липецкая область',
                'волгоградская область': 'Волгоградская область',
                'саратовская область': 'Саратовская область',
                'астраханская область': 'Астраханская область',
                'татарстан республика': 'Республика Татарстан',
                'марий эл республика': 'Республика Марий Эл',
                'удмуртская республика': 'Удмуртская Республика',
                'чувашия республика': 'Чувашская Республика',
                'мордовия республика': 'Республика Мордовия',
                'ульяновская область': 'Ульяновская область',
                'пензенская область': 'Пензенская область',
                'самарская область': 'Самарская область',
                'башкортостан республика': 'Республика Башкортостан',
                'челябинская область': 'Челябинская область',
                'оренбургская область': 'Оренбургская область',
                'владимирская область': 'Владимирская область',
                'нижегородская область': 'Нижегородская область',
                'кировская область': 'Кировская область',
                'пермский край': 'Пермский край',
                'свердловская область': 'Свердловская область',
                'тюменская область': 'Тюменская область',
                'ханты-мансийский-югра автономный округ': 'Ханты-Мансийский автономный округ',
                'ямало-ненецкий автономный округ': 'Ямало-Ненецкий автономный округ',
                'новосибирская область': 'Новосибирская область',
                'томская область': 'Томская область',
                'курганская область': 'Курганская область',
                'омская область': 'Омская область',
                'красноярский край': 'Красноярский край',
                'алтай республика': 'Республика Алтай',
                'кемеровская область': 'Кемеровская область',
                'хакасия республика': 'Республика Хакасия',
                'алтайский край': 'Алтайский край',
                'иркутская область': 'Иркутская область',
                'тыва республика': 'Республика Тыва',
                'бурятия республика': 'Республика Бурятия',
                'забайкальский край': 'Забайкальский край',
                'амурская область': 'Амурская область',
                'саха (якутия) республика': 'Республика Саха (Якутия)',
                'еврейская автономная область': 'Еврейская автономная область',
                'хабаровский край': 'Хабаровский край',
                'камчатский край': 'Камчатский край',
                'магаданская область': 'Магаданская область',
                'чукотский автономный округ': 'Чукотский автономный округ',
                'приморский край': 'Приморский край',
                'сахалинская область': 'Сахалинская область'
            };
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
            let waitForConfirmUrl = function (timeout, maxWait) {
                let max = typeof maxWait === 'number' ? maxWait : 180000;
                return new Promise(function (onSuccess, onReject) {
                    let waitStarted = Date.now();
                    let performCheck = function () {
                        bsEmailCheck(data.email, 'BETCITY_CONFIRM_CODE', timeout)
                            .then((m) => {
                                bsDebug(port, 'Email answer:', m);
                                if (m.status === 'success' && typeof m.message === 'object' && m.message.length > 0
                                    && typeof m.message[0].data === 'string') {
                                    onSuccess(m.message[0].data);
                                } else if (Date.now() - waitStarted < max) {
                                    delayPromise(5555).then(performCheck);
                                } else {
                                    throw 'We had waited for email with confirm url for ' + (Date.now() - waitStarted) + 'ms and nothing :(';
                                }
                            })
                            .catch((e) => onReject(e));
                    };
                    performCheck();
                });
            };
            let paypass;
            let regoroll = function () {
                waitForElement('a[href="/en/reg"]', 333, 30000)
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('#login', 333, 20000, true))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#login')[0], data['nickname']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#password')[0], data['password']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#password_repeat')[0], data['password']))
                    .then(delayFunction(3333))
                    // Hint: I specially leave it here
                    .then(() => {
                        let $currency = $('select#currency');
                        $currency[0].focus();
                        $currency.find('option[value="1"]').prop('selected', true);
                        fireInputEvent($currency[0]);
                        fireChangeEvent($currency[0]);
                        $currency[0].blur();
                    })
                    .then(delayFunction(3333))
                    // Hint: To remember the way to do it differently
                    .then(() => {
                        let $country = $('select#country');
                        return selectLikePuppeteer($country[0], ['1']);
                    })
                    .then(delayFunction(3333))
                    .then(() => {
                        let $email = $('input#email');
                        $email.val(data['email']);
                        fireInputEvent($email[0]);
                        fireChangeEvent($email[0]);
                    })
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#phone')[0], data['phone']))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({
                        target: $('span:textEquals("Subscribe to news")').parent().find('input[type="checkbox"]')[0],
                        events: ['click']
                    }))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({
                        target: $('span:contains("I confirm that I am 18 years old")').parent().find('input[type="checkbox"]')[0],
                        events: ['click']
                    }))
                    .then(delayFunction(3333))
                    .then(waitForCondition(() => {
                        let aStatus = $('div.antigate_solver a.status').last().text().trim();
                        if (aStatus === 'Solved') {
                            return true;
                        } else if (aStatus.indexOf('Outdated') > -1) {
                            mouseChain({target: $('a.control.reload')[0], events: ['click']})
                                .then().catch();
                            return false;
                        } else {
                            return false;
                        }
                    }, 555, 120000, 'reCaptcha not solved for 120s', true))
                    .then(() => ourCommand.add('waitForEmail', Math.ceil(Date.now() / 1000) - 60))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({target: $('#submit_button')[0], events: ['click'], scroll: true}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('input#verify', 333, 15000, true))
                    // Hint: Wait for email...
                    .then(() => waitForConfirmUrl(ourCommand.getAdded('waitForEmail')))
                    .then((code) => clearAndSimulate($('input#verify')[0], code))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({target: $('#submit_button')[0], events: ['click'], scroll: true}))
                    .then(waitForElementF('div.reg-success', 333, 20000, true))
                    .then(delayFunction(5555))
                    // Hint: Fill in user data form
                    .then(waitForElementF('a.header-menu__item[href="/en/account/pslist/in"]', 333, 15000, true))
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('input#second_name', 333, 15000, true))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#first_name')[0], data['first_name']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#last_name')[0], data['second_name']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#second_name')[0], data['third_name']))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({target: $('input[type="radio"][name="sex"]')[0], events: ['click']}))
                    .then(delayFunction(3333))
                    .then(() => {
                        let region = typeof betcityAccordance[data['region']] === 'string' ? betcityAccordance[data['region']] : '';
                        if (region === '') {
                            throw data['region'] + ' has no accordance in BetCity :(';
                        }
                        let $r = $('app-select[formcontrolname="region"] select');
                        if ($r.val() !== region) {
                            return selectLikePuppeteer($r.get(0), [region])
                        }
                    })
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#city')[0], data['city']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('textarea#address')[0], data['address']))
                    .then(delayFunction(3333))
                    .then(() => {
                        let bdp = data['birth_date'].split('-');
                        if (bdp.length !== 3 || isNaN(parseInt(bdp[0])) || isNaN(parseInt(bdp[1])) || isNaN(parseInt(bdp[2]))) {
                            throw 'Incorrect data format: ' + data['birth_date'];
                        }
                        return selectLikePuppeteer($('select#birth_day').get(0), [bdp[2]])
                            .then(delayFunction(3333))
                            .then(() => selectLikePuppeteer($('select#birth_month').get(0), [parseInt(bdp[1]).toString()]))
                            .then(delayFunction(3333))
                            .then(() => selectLikePuppeteer($('select#birth_year').get(0), [bdp[0]]))
                            .then(delayFunction(3333))
                            .then(() => selectLikePuppeteer($('select#agree_data').get(0), ['1']));
                    })
                    .then(delayFunction(3333))
                    .then(() => mouseChain({target: $('button[type="submit"]:textEquals("Save")')[0], events: ['click']}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('div.pays-list', 333, 20000, true))
                    .then(delayFunction(3333))
                    // Hint: setup payment password
                    .then(waitDelayClickF('a.menu__item[href="/en/account/current"]'))
                    .then(waitDelayClickF('div.sub-menu a:textEquals("Account details")'))
                    .then(waitDelayClickF('button:textEquals("To create payment password")'))
                    .then(waitForElementF('span:contains("Your new payment password")'))
                    .then(($el) => paypass = $el.text().replace(/[^\d]/g, '').trim())
                    .then(() => console.log(paypass))
                    .then(delayFunction(3333))
                    // Hint: Success!
                    .then(() => report(true, {
                        login: data['email'], password: data['password'],
                        comment: 'Paypass: ' + paypass + ', all text: "' + $('span:contains("Your new payment password")').text().trim() + '"'
                    }))
                    .catch((e) => report(false, 'Register 1: ' + e));
            };
            //delayPromise(7777).then(() => report(true, {login: data['nickname'], password: data['password']}))
            delayPromise(1111).then(regoroll);
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

            let selector = 'div.sub-menu a:textEquals("Withdraw")';
            delayPromise(111)
                .then(() => {
                    if (window.location.href.indexOf('/en/account/') === -1) {
                        return waitForElement('a.menu__item[href="/en/account/current"]', 333, 10000)
                            .then(($el) => delayPromise(3333, $el))
                            .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                            .then(delayFunction(3333));
                    }
                })
                .then(waitForElementF(selector, 333, 15000, true))
                .then(($el) => delayPromise(3333, $el))
                .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                .then(delayFunction(2000))
                .then(waitForCondition(() => {
                    return $(selector).hasClass('sub-menu__item_active');
                }, 333, 10000, 'Withdraw not selected', true))
                .then(delayFunction(2000))
                // Hint: Click Qiwi
                .then(waitForElementF('div.pays-header:has(span.pays-header-name:contains("Visa QIWI Wallet"))', 333, 20000, true))
                .then(($el) => delayPromise(3333, $el))
                .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                .then(delayFunction(3333))
                .then(waitForElementF('div.pays-form__title:contains("QIWI")', 333, 20000, true))
                .then(($el) => delayPromise(3333, $el))
                .then(($el) => {
                    let $form = $el.parent();
                    if ($form.find('select').val() !== '+7') {
                        return selectLikePuppeteer($form.find('select').get(0), ['+7'])
                            .then(delayFunction(3333));
                    }
                })
                .then(() => clearAndSimulate(
                    $('input[type="PHONE"][name="number"]')[0],
                    data.login.replace('+', '').replace(/^7/, ''))
                )
                .then(delayFunction(3333))
                .then(() => clearAndInputNumber($('input[type="NUMBER"][name="amount"]')[0], data.amount))
                .then(delayFunction(3333))
                .then(() => clearAndSimulate($('input[type="TEXT"][name="paypass"]')[0], data.pin))
                .then(delayFunction(3333))
                .then(() => mouseChain({target: $('button:contains("Make a request")')[0], events: ['click']}))
                .then(delayFunction(3333))
                .then(() => {
                    const err = $('div.pays-for222m__title_error').text().trim();
                    if (err !== '') {
                        throw err;
                    }
                })
                .then(() => report(true, 'It may be good...'))
                .catch((e) => report(false, 'When go: ' + e));
        });
    };

    let deposit = function (data) {
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
                waitForElement('a.header-menu__item[href="/en/account/pslist/in"]', 333, 15000, true)
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('div.pays-header:has(span.pays-header-name:contains("Visa QIWI Wallet"))', 333, 20000, true))
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('div.pays-form__title:contains("QIWI")', 333, 20000, true))
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => {
                        let $form = $el.parent();
                        if ($form.find('select').val() !== '+7') {
                            return selectLikePuppeteer($form.find('select').get(0), ['+7'])
                                .then(delayFunction(3333));
                        }
                    })
                    .then(() => clearAndSimulate(
                        $('input[type="PHONE"][name="phone"]')[0],
                        data.login.replace('+', '').replace(/^7/, ''))
                    )
                    .then(delayFunction(3333))
                    .then(() => clearAndInputNumber($('input[type="NUMBER"][name="amount"]')[0], data.amount))
                    .then(delayFunction(3333))
                    .then(() => {
                        ourCommand.add('increaseDelay', true);
                        ourCommand.add('close', true);
                        ourCommand.add('qiwiPayCheckNew', true);
                        chrome.storage.local.remove(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET'], function () {
                            chrome.storage.local.set({
                                'QIWI_COMMAND': ourCommand.get(),
                                'QIWI_COMMAND_WAS_SET': Date.now()
                            });
                        });
                    })
                    .then(() => mouseChain({target: $('button:contains("To be filled in")')[0], events: ['click']}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('div.pays-form__title:contains("The procedure of funds") a:contains("Visa QIWI Wallet")',
                        333, 15000, true))
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                    // Hint: Go to QIWI
                    .then(waitForCondition(() => {
                        getDepositResult();
                        return typeof depositResult.success === 'boolean';
                    }, 1000, 400000, 'no deposit result (or it is outdated) for 400s!', true))
                    // Hint: Success!
                    //.then(() => console.log(depositResult))
                    .then(() => report(depositResult.success, typeof depositResult.message === 'string' ? depositResult.message : 'No message :('))
                    .catch((e) => report(false, 'Deposit 1: ' + e));

            };
            letsRockNRoll();
        });
    };

    /**
     * Collecting bet results
     * @param {array} inD
     * @returns {Promise<any>}
     */
    const collectBetResults = inD => new Promise(function (onSuccess, onReject) {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        bsDebug(port, 'collectBetResults, limit: ' + limit + ', data:', data);
        let report = function (success, message) {
            bsDebug(port, 'Collect data: success = ' + success + ', message = ' + message + ', data:', data);
            if (ourCommand.get().action === 'CHECK_PAYMENTS') {
                port.postMessage({
                    answered: "CHECK_PAYMENTS",
                    data: success ? collected : [],
                    answer: success ? 'Here may be anything!!!' : message
                });
            } else {
                port.postMessage({
                    answered: ourCommand.get().action,
                    status: success ? "success" : "error",
                    answer: success ? collected : message
                });
            }
            if (success) {
                onSuccess(collected);
            } else {
                onReject(message);
            }
        };

        let doHistory = function () {
            return waitForElement('div.account-history__item', 333, 10000)
                .then(($items) => {
                    collected = [];
                    $items.each(function () {
                        let $subs = $(this).find('div.account-history__item-sub');
                        collected.push({
                            date: $subs.eq(0).text().trim(),
                            description: $subs.eq(2).text().trim(),
                            type: $subs.eq(1).text().indexOf(' Deposit ') > -1 ? 'IN' : 'OUT',
                            paysystem: $subs.eq(2).text().toLowerCase().indexOf('qiwi ') > -1 ? 'QIWI' : 'SKRILL',
                            amount: $subs.eq(3).text().replace(/[^\d.]/g, '').trim(),
                            success: true
                        });
                    });
                    console.log(collected);
                });
        };

        let doCollect = function () {
            return waitForElement('div.account-base-item', 333, 10000)
                .catch(() => console.log('No bets on tab :('))
                .then(() => {
                    $('div.account-base-item:visible').each(function () {
                        let $this = $(this);
                        let external_id = (() => {
                            let rer = /Betting № (\d+),/.exec($this.find('span:contains("Betting №")').text());
                            return rer === null || typeof rer[1] === 'undefined'
                                ? $this.find('span:contains("Betting №")').text().trim()
                                : rer[1].trim();
                        })();
                        let status = 'ACCEPTED';
                        let stake = parseFloat($this.find('div.account-base-item__sub_right').first().text().replace(/[^\d.]/g, '').trim());
                        let result = parseFloat($this.find('div.account-base-item__sub_right').eq(1).text().replace(/[^\d.]/g, '').trim());
                        if ($this.hasClass('account-base-item_win')) {
                            status = 'WON';
                        } else if ($this.hasClass('account-base-item_cancel')) {
                            status = 'REFUNDED';
                        } else if ($this.hasClass('account-base-item_defeat')) {
                            status = 'LOSE';
                        }
                        if (data.length === 0 && collected.length < limit || data.indexOf(external_id) > -1) {
                            collected.push({
                                external_id: external_id,
                                status: status,
                                match: $this.next().find('span.account-base-item__sub_double > span').first().text().trim(),
                                bkPivot: $this.next().find('span.account-base-item__sub').eq(2).text().trim(),
                                coef: $this.find('div.account-base-item__sub_right').first().next().text().trim(),
                                stake: stake.toString(),
                                result: result.toString()
                            });
                        }
                    });
                    console.log(collected);
                });
        };

        let needCollect = [
            'div.sub-menu a:textEquals("Unsettled bets")',
            'div.sub-menu a:textEquals("Settled bets")'
        ];
        let performCollect = function () {
            return new Promise((onSuccess, onReject) => {
                let datesAdded = false;
                let openAndCollect = function (selector) {
                    if (typeof selector === 'undefined'
                        || collected.length >= limit
                        || (data.length !== 0 && collected.length === data.length)) {
                        onSuccess(collected);
                    } else {
                        waitForElement(selector, 333, 10000, true)
                            .then($sel => {
                                if (!$sel.hasClass('sub-menu__item_active')) {
                                    return mouseChain({target: $sel[0], events: ['click']})
                                        .then(delayFunction(2000))
                                        .then(waitForCondition(() => {
                                            return $(selector).hasClass('sub-menu__item_active') || $(selector).is(':disabled');
                                        }, 333, 10000, 'Not selected', true))
                                        .then(delayFunction(2000));
                                }
                            })
                            .then(() => {
                                let date = $('span.datepicker__date-chain button:enabled:visible').last();
                                if (!datesAdded && date.length > 0) {
                                    datesAdded = true;
                                    needCollect.push('span.datepicker__date-chain button:contains("' + date.text().trim() + '")');
                                }
                            })
                            .then(() => {
                                return ourCommand.get().action === 'CHECK_PAYMENTS' ? doHistory() : doCollect();
                            })
                            .then(() => openAndCollect(needCollect.shift()))
                            .catch(e => onReject('performCollect: ' + e));
                    }
                };
                openAndCollect(needCollect.shift())
            });
        };
        delayPromise(111)
            .then(() => {
                if (window.location.href.indexOf('/en/account/') === -1) {
                    return waitForElement('a.menu__item[href="/en/account/current"]', 333, 10000)
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(3333));
                }
            })
            .then(() => {
                if (ourCommand.get().action === 'CHECK_PAYMENTS') {
                    needCollect = ['div.sub-menu a:textEquals("History")'];
                }
            })
            .then(performCollect)
            .then(collected => report(true, collected))
            .catch(e => report(false, 'Can\'t collect 1: ' + e));
    });

    /**
     * Proceeds bets and expresses
     * @param data {array}
     * @returns {Promise<any>}
     */
    const proceedBet = function (data) {
        return new Promise(function (onSuccess, onReject) {
            currentBetData = {
                data: data,
                max: 0,
                external_id: '',
                willPlace: 0
            };

            let betFinished = function (success, message) {
                //bsDebug(port, 'Bet finished ' + success, message);
                if (success) {
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
                    if (typeof currentBetData.data[0].collectAfterAll !== 'undefined' && currentBetData.data[0].collectAfterAll) {
                        resultData['bkPivot'] = message.bkPivot;
                    }
                    bsDebug(port, 'Result data: ', resultData);
                    port.postMessage({
                        answered: "BET",
                        data: resultData,
                        answer: 'Everything is Okay!'
                    });
                    onSuccess();
                } else {
                    let status = 'FAILED';
                    if (typeof message === 'string' && message.indexOf('LOW_COEF') > -1) {
                        status = 'LOW_COEF';
                    } else if (typeof message === 'string' && message.indexOf('NO_FUNDS') > -1) {
                        status = 'NO_FUNDS';
                    } else if (typeof message === 'string' && message.indexOf('SCORE_CHANGED') > -1) {
                        status = 'SCORE_CHANGED';
                    } else if (typeof message === 'string' && message.indexOf('LIMITED') > -1) {
                        status = 'LIMITED';
                        message = 'Tried to bet 0';
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
                        answer: message
                    });
                    onReject(message);
                }
                busy = false;
                ourCommand.clear();
                //bsError(port, 'Just check we successfully empty command!');
                //checkWeAreInInplay(typeof currentBetData.data[0].doNotGoHome !== 'undefined' && currentBetData.data[0].doNotGoHome);
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
                waitForElement('h2:contains("The betting process has been completed")', 333, 30000, true)
                    .then(delayFunction(777))
                    .then(() => {
                        if ($('div.cart-top__right').is(':visible')) {
                            return delayPromise(111)
                                .then(() => mouseChain({target: $('div.cart-top__left')[0], events: ['click']}))
                                .then(delayFunction(333));
                        }
                    })
                    .then(() => mouseChain({
                        target: $('a.user-info__item-step[href="/en/account/current"]')[0],
                        events: ['click']
                    }))
                    .then(delayFunction(3333))
                    .then(waitForElementF('div.account-base-item:first', 333, 15000, true))
                    .then(($el) => delayPromise(500, $el))
                    .then(($el) => report(true, {
                        external_id: (() => {
                            let rer = /Betting № (\d+),/.exec($el.find('span:contains("Betting №")').text());
                            return rer === null || typeof rer[1] === 'undefined'
                                ? $el.find('span:contains("Betting №")').text().trim()
                                : rer[1].trim();
                        })(),
                        coef: $el.find('div.account-base-item__sub_right').first().next().text().trim(),
                        stake: $el.find('div.account-base-item__sub_right').first().text().replace(/[^\d.]/g, '').trim()
                    }, willPlace))
                    .catch(e => report(false, 'Wait status: ' + e));
            };

            let placeClicked = false;
            let loops = 0;
            let reChecks = 0;
            let afterEnterStakeStarted = 0;
            let afterEnterStake = function (willPlace) {
                // Hint: CHECK entered!
                let entered = parseFloat($('app-input-dropdown input').val());
                bsDebug(port, 'After enter stake check: willPlace = ' + parseFloat(willPlace) + ', entered: ' + entered);
                if (isNaN(entered) || parseFloat(willPlace) !== entered) {
                    reChecks++;
                    if (reChecks <= 3) {
                        delayPromise(3333)
                            .then(() => performExactBet(willPlace));
                        bsError(port, 'Entered !== willPlace - try to reenter!');
                    } else {
                        report(false, 'Maybe we try to bet too few :(');
                    }
                    return;
                }
                let $acceptBtn = $('button.button_submit:contains("I agree to odds change")');
                let $placeBtn = $('button.button_submit:contains("Bet")');
                let clickAndCheck = function (selector) {
                    return new Promise((onSuccess, onReject) => {
                        let clicks = 0;
                        let lets = function () {
                            clicks++;
                            console.log('%c' + 'clickAndCheck: ' + clicks + ' for "' + selector + '"',
                                'background: orange; color: blue; font-size: 14px; font-weight: normal');
                            let target = $(selector).get(0);
                            let rect = target.getBoundingClientRect();
                            mouseChain({target: target, events: ['click']})
                                .then(waitForCondition(() => {
                                    return document.elementFromPoint(rect.left, rect.top).nodeName === 'DIV';
                                }, 333, 3333, 'Not DIV!', true))
                                .then(onSuccess)
                                .catch(e => {
                                    if (e === 'Not DIV!' && clicks < 4) {
                                        lets();
                                    } else {
                                        onReject('We cant click bet! ' + e);
                                    }
                                });
                        };
                        lets();
                    });
                };
                let $errors = [];
                // Hint: CHECK errors
                if ($acceptBtn.length === 1 && elementIsVisible($acceptBtn[0])) {
                    bsDebug(port, 'ReCheck coefs!');
                    checkCoefs(data)
                        .then(delayFunction(1000))
                        // Hint: Accept Btn here places bet!
                        .then(() => clickAndCheck('button.button_submit:contains("I agree to odds change")'))
                        .then(delayFunction(777))
                        .then(() => checkSuccess(willPlace))
                        .catch((e) => report(false, 'Coefs changed: ' + e));
                } else if ($errors.length > 0) {
                    report(false, 'We got errors: ' + $errors.text().trim());
                } else if ($placeBtn.length === 0 || $placeBtn.hasClass('disabled')) {
                    if (loops <= 3) {
                        loops++;
                        delayPromise(1111).then(() => afterEnterStake(willPlace));
                    } else {
                        report(false, 'No place button or button disabled (' + loops + ')!');
                    }
                } else {
                    delayPromise(1000)
                        .then(() => clickAndCheck('button.button_submit:contains("Bet")'))
                        .then(delayFunction(777))
                        .then(() => checkSuccess(willPlace))
                        .catch((e) => report(false, 'Error during place bet ' + e));
                }
            };

            let performExactBet = function (willPlaceInput) {
                let willPlace = typeof willPlaceInput !== 'undefined' ? parseFloat(willPlaceInput) : parseFloat(data[0].stake);
                // Hint: Let's enter stake
                delayPromise(333)
                    .then(() => clearAndSimulate($('app-input-dropdown input')[0], willPlace.toString().replace('.00', '')))
                    .then(delayFunction(333))
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
                            if (data.length > 1 && !$('span.cart-header__item:contains("combo")').hasClass('cart-header__item_active')) {
                                return mouseChain({target: $('span.cart-header__item:contains("combo")')[0], events: ['click']})
                                    .then(delayFunction(1000))
                                    .then(() => performExactBet(willPlace));
                            } else if (data.length === 1 && !$('span.cart-header__item:contains("single")').hasClass('cart-header__item_active')) {
                                return mouseChain({target: $('span.cart-header__item:contains("single")')[0], events: ['click']})
                                    .then(delayFunction(1000))
                                    .then(() => performExactBet(willPlace));
                            } else {
                                performExactBet(willPlace);
                            }
                        }
                    })
                    .catch((e) => report(false, 'Error till checkCoefs (' + 0 + '): ' + e));
            };

            let performBet = function () {
                openCoupon(data)
                    .then(performCheckAndBet)
                    .catch((e) => report(false, "Error during openCoupon! " + e));
            };

            closePreviousCoupons(false)
                .then((p) => {
                    bsDebug(port, p);
                    performBet();
                })
                .catch((e) => report(false, 'Error till close coupons: ' + e));

        });
    };

    /**
     * Checks coefs into the coupon
     * @param data
     * @returns {Promise<string,string>}
     */
    const checkCoefs = function (data) {
        return new Promise(function (onSuccess, onReject) {
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
            let checkCoupon = function () {
                return new Promise(function (onSuccess, onReject) {
                    let findInData = function (match) {
                        let result = false;
                        $.each(data, function () {
                            let localMatch = this.team1.toLowerCase() + ' - ' + this.team2.toLowerCase();
                            if (localMatch === match || locutus_similar_text(localMatch, match, true) > 60) {
                                result = this;
                                return false;
                            }
                        });
                        return result;
                    };
                    let $coupons = $('div.cart-items-container div.cart-item');// $('div.coupon div.o-bet-box-list__item div[class="c-bet-box__teams"]')
                    let errors = [];
                    let checked = 0;
                    $coupons.each(function () {
                        let $this = $(this);
                        let match = $this.find('span.cart-item__event').text().trim().toLowerCase();
                        if ($this.hasClass('market-unavailable')) {
                            errors.push(match + ' LOW_COEF, market unavailable!');
                            checked++;
                            return true;
                        }
                        let localCoef = parseFloat($this.find('span.cart-item__dop-kf').text().trim());
                        let localData = findInData(match);
                        if (localData !== false && localData.coef !== '' && !isNaN(localCoef)) {
                            let checkCoef = parseFloat(localData.coef);
                            if (isNaN(checkCoef)) {
                                errors.push(match + ' wrong coef: ' + localData.coef);
                            } else if (checkCoef > localCoef) {
                                errors.push(match + ' LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef);
                            } else if (localCoef >= checkCoef * 1.2) {
                                errors.push(match + ' TOO BIG coef, have: ' + localCoef + ', need: ' + checkCoef);
                            }
                            checked++;
                        } else if (localData === false || isNaN(localCoef)) {
                            errors.push(match + ' LOW_COEF - wrong match or localCoef!');
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
            {team1: 'Manchester Utd', team2: 'PSG', coef: '1.84'},
            {team1: 'Doncaster R', team2: 'Southend Utd', coef: '1.27'}
        ]);
            //TEST BOTTOM FINISH */
        });
    };

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<object,string>} jQuery element for bet
     */
    const getBetElement = function (data) {
        return new Promise(function (reportSuccess, reportReject) {
            //#-#-START
            let onSuccess = function ($d) {
                if (typeof $d[0] === 'undefined') {
                    onReject('Bet inactive!');
                } else {
                    console.log('%cSuccess: ' + $d.text().trim(), 'background: green;');
                    $d[0].scrollIntoView(true);
                    $d.closest('div.line-event__container-dops').get(0).scrollTop -= 25;
                    reportSuccess($d);
                }
            };

            let onReject = function (d) {
                console.log('%cReject', 'background: red;');
                console.log(d);
                reportReject(d);
            };

            let eventName = typeof eventNameIn === 'undefined' || eventNameIn === ''
                ? (() => {
                    const $ts = $('span.scoreboard-content__team-name');
                    return $ts.eq(0).text().trim() + ' v ' + $ts.eq(1).text().trim()
                })()
                : eventNameIn;

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
                    'ONE': {roots: ['Full time result'], pivotKeys: ['1']},
                    'TWO': {roots: ['Full time result'], pivotKeys: ['2']},
                    'DRAW': {roots: ['Full time result'], pivotKeys: ['X']},
                    'ONE_DRAW': {roots: ['Double chance'], pivotKeys: ['1X']},
                    'TWO_DRAW': {roots: ['Double chance'], pivotKeys: ['X2']},
                    'ONE_TWO': {roots: ['Double chance'], pivotKeys: ['12']}
                },
                'TOTAL': {
                    'OVER': {
                        roots: ['Total', 'Asian total'],
                        subroots: ['#PIVOT#', '#PIVOTR#', '#PIVOTR2#'],
                        pivotKeys: ['Over', 'Over (#PIVOT#)', 'Over (#PIVOTR#)', 'Over (#PIVOTR2#)']
                    },
                    'UNDER': {
                        roots: ['Total', 'Asian total'],
                        subroots: ['#PIVOT#', '#PIVOTR#', '#PIVOTR2#'],
                        pivotKeys: ['Under', 'Under (#PIVOT#)', 'Under (#PIVOTR#)', 'Under (#PIVOTR2#)']
                    },
                },
                'T1_TOTAL': {
                    'OVER': {
                        roots: ['Ind. Total'],
                        subroots: ['IT1 (#PIVOT#)', 'IT1 (#PIVOTR#)', 'IT1 (#PIVOTR2#)'],
                        pivotKeys: ['Over']
                    },
                    'UNDER': {
                        roots: ['Ind. Total'],
                        subroots: ['IT1 (#PIVOT#)', 'IT1 (#PIVOTR#)', 'IT1 (#PIVOTR2#)'],
                        pivotKeys: ['Under']
                    }
                },
                'T2_TOTAL': {
                    'OVER': {
                        roots: ['Ind. Total'],
                        subroots: ['IT2 (#PIVOT#)', 'IT2 (#PIVOTR#)', 'IT2 (#PIVOTR2#)'],
                        pivotKeys: ['Over']
                    },
                    'UNDER': {
                        roots: ['Ind. Total'],
                        subroots: ['IT2 (#PIVOT#)', 'IT2 (#PIVOTR#)', 'IT2 (#PIVOTR2#)'],
                        pivotKeys: ['Under']
                    }
                },
                'HDP': {
                    'HOME': {
                        roots: ['Handicap', 'Asian handicap'],
                        pivotKeys: ['Han1 (#PIVOT#)', 'Han1 (#PIVOTR#)', 'Han1 (#PIVOTR2#)', 'Han1 (#PIVOTZ#)']
                    },
                    'AWAY': {
                        roots: ['Handicap', 'Asian handicap'],
                        pivotKeys: ['Han2 (#PIVOT#)', 'Han2 (#PIVOTR#)', 'Han2 (#PIVOTR2#)', 'Han2 (#PIVOTZ#)']
                    }
                },
                'CORNER_HDP': {
                    'HOME': {
                        roots: ['Handicap', 'Asian handicap'],
                        pivotKeys: ['Han1 (#PIVOT#)', 'Han1 (#PIVOTR#)', 'Han1 (#PIVOTR2#)', 'Han1 (#PIVOTZ#)']
                    },
                    'AWAY': {
                        roots: ['Handicap', 'Asian handicap'],
                        pivotKeys: ['Han2 (#PIVOT#)', 'Han2 (#PIVOTR#)', 'Han2 (#PIVOTR2#)', 'Han2 (#PIVOTZ#)']
                    }
                },
                'CORNER_TOTAL': {
                    'OVER': {
                        roots: ['Total', 'Asian total'],
                        subroots: ['#PIVOT#', '#PIVOTR#', '#PIVOTR2#'],
                        pivotKeys: ['Over']
                    },
                    'UNDER': {
                        roots: ['Total', 'Asian total'],
                        subroots: ['#PIVOT#', '#PIVOTR#', '#PIVOTR2#'],
                        pivotKeys: ['Under']
                    },
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

            let replaceInner = function (element, parent, index) {
                if (typeof element === 'string') {
                    parent[index] = element.replace('#TEAM1#', data.team1).replace('#TEAM2#', data.team2)
                        .replace('#TEAM1B#', data.team1b).replace('#TEAM2B#', data.team2b)
                        .replace('#PIVOT#', data.pivot).replace('#PIVOTR#', specialPivotFormatter(data.market, data.pivot))
                        .replace('#PIVOTR2#', specialPivotFormatter(data.market, data.pivot, true))
                        .replace('#PIVOTZ#', specialPivotZFormatter());
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
                    if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) === -1) {
                        needAddTo.push('Halves result');
                        if (typeof markets[data.market]['subroots'] === 'undefined') {
                            markets[data.market][data.target]['subroots'] = ['1st half'];
                        } else {
                            markets[data.market][data.target]['subroots'].unshift('1st half');
                        }
                    } else {
                        needAddTo.push('Ind. Total 1st half');
                    }
                    needRemove.push('Fulltime result');
                    needRemove.push('Double chance');
                    needRemove.push('Total');
                    needRemove.push('Asian total');
                    needRemove.push('Ind. Total');
                    needRemove.push('Handicap');
                    needRemove.push('Asian handicap');
                } else if (data.sport === 'BASKETBALL') {

                } else if (data.sport === 'TENNIS') {

                } else if (data.sport === 'HOCKEY' && data.time_value !== 'FULL_MATCH') {
                    let period = ['1st', '2nd', '3rd'][parseInt(data.time_value.replace(/[^\d.]/g, '').trim()) - 1];
                    //let suffix = parseInt(period) % 2 === 0 ? 'nd' : 'rd';
                    if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) === -1) {
                        needAddTo.push('Periods result');
                    } else {
                        markets[data.market][data.target]['special'] = markets[data.market][data.target]['subroots'];
                        needAddTo.push('Periods Ind. Total');
                    }
                    if (typeof markets[data.market]['subroots'] === 'undefined') {
                        markets[data.market][data.target]['subroots'] = [period + ' period'];
                    } else {
                        markets[data.market][data.target]['subroots'].unshift(period + ' period');
                        markets[data.market][data.target]['subroots'] = [period + ' period'];
                    }
                    needRemove.push('Fulltime result');
                    needRemove.push('Double chance');
                    needRemove.push('Total');
                    needRemove.push('Asian total');
                    needRemove.push('Ind. Total');
                    needRemove.push('Handicap');
                    needRemove.push('Asian handicap');
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
                return market;
            };

            let market = finalPrepareForMarket(markets[data.market][data.target]);

            console.log('%cFinal market is:', 'background: green; color: white; font-weight: bold;');
            console.log(market);

            let performGet = function () {
                let currentRoot = -1;
                let lookForPivot = function ($candidate) {
                    console.log('%clookForPivot in:', 'background: green; color: white; font-weight: bold;');
                    console.log($candidate);
                    let found = false;
                    for (let i in market.pivotKeys) {
                        let p = market.pivotKeys[i];
                        $candidate.find('div.dops-item-row__block-content').each(function () {
                            let $check = $(this);
                            console.log('"' + $check.find('>span').text().trim() + '" === "' + p + '"');
                            if ($check.find('>span').text().replace(/\s+/g, ' ').trim() === p) {
                                found = true;
                                onSuccess($check.find('button'));
                                return false;
                            }
                        });
                        if (found) {
                            break;
                        }
                    }
                    return found;
                };
                let checkSubroots = function ($candidate, subrootsIn) {
                    console.log('%c' + 'Subroot in:', 'background: red; color: white; font-size: 16px; font-weight: bold');
                    console.log($candidate);
                    let subroots = typeof subrootsIn === 'undefined' ? market.subroots : subrootsIn;
                    let found = false;
                    for (let i in subroots) {
                        let subroot = subroots[i];
                        console.log('%cChecking subroot: "' + subroot + '"', 'color: green; font-size: 18px; font-weight: bold;');
                        let finders = [{
                            eFind: 'div.dops-item-row__section div.dops-item-row__block-content:first-child',
                            ePivots: 'div.dops-item-row__section'
                        }];
                        if ($candidate.find('div.dops-item-row__title').length > 0 && typeof subrootsIn === 'undefined') {
                            finders = [{
                                eFind: 'div.dops-item-row__title',
                                ePivots: 'div.dops-item-row.dops-item-row_horizontal'
                            }];
                        }
                        for (let fIdx in finders) {
                            let find = finders[fIdx];
                            $candidate.find(find.eFind).each(function () {
                                let $this = $(this);
                                console.log('"' + $this.text().replace(/\s+/g, ' ').trim() + '" === "' + subroot + '"');
                                if ($this.text().replace(/\s+/g, ' ').trim() === subroot
                                    && (typeof market.special === 'undefined' || typeof subrootsIn !== 'undefined'
                                        ? lookForPivot($this.closest(find.ePivots))
                                        : checkSubroots($this.closest(find.ePivots), market.special))) {
                                    found = true;
                                    return false;
                                }
                            });
                            if (found) {
                                break;
                            }
                        }
                        if (found) {
                            break;
                        }
                    }
                    return found;
                };
                let checkRoot = function ($candidate) {
                    $candidate[0].scrollIntoView();
                    $candidate.closest('div.line-event__container-dops').get(0).scrollTop -= 25;
                    let found = false;
                    if (typeof market.subroots !== 'undefined') {
                        found = checkSubroots($candidate);
                    } else {
                        console.log($candidate);
                        if (lookForPivot($candidate)) {
                            found = true;
                        }
                    }
                    return found;
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
                        onReject('Root not found :(');
                    } else {
                        //console.log('Checking: ' + market.roots[currentRoot], 'div.dops div.dops-item:has(span:textEquals("' + market.roots[currentRoot] + '"))');
                        let $candidate = $('div.dops div.dops-item:has(span:textEquals("' + market.roots[currentRoot] + '"))');
                        if ($candidate.length === 1) {
                            checkOne($candidate, nextRoot);
                        } else if ($candidate.length > 1) {
                            let currentCandidate = -1;
                            let checkCandidate = function () {
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
                nextRoot();
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
    const closePreviousCoupons = function (skipParam) {
        let skip = typeof skipParam === 'undefined' ? false : skipParam;
        //let goToInplay = typeof goToInplayParam === 'undefined' ? true : goToInplayParam;
        //bsDebug(port, 'closePreviousCoupons - skip? ' + skip + ', goHome? ' + goToInplay);
        return new Promise(function (onSuccessOut, onReject) {
            if (skip) {
                //bsDebug(port, 'closePreviousCoupons - SKIP');
                onSuccessOut('skipped!');
                return;
            } else {
                //bsDebug(port, 'closePreviousCoupons - WORK');
            }
            let onSuccess = function (message) {
                if ($('div.cart-top__right').is(':visible')) {
                    delayPromise(111)
                        .then(() => mouseChain({target: $('div.cart-top__left')[0], events: ['click']}))
                        .then(delayFunction(333))
                        .then(() => onSuccessOut(message))
                        .catch(e => onReject('closePreviousCoupons: ' + e));
                } else {
                    onSuccessOut(message);
                }
            };
            let removeStakes = function () {
                let closeOne = function () {
                    let $closes = $('span.cart-item__remove');
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
                let $clearBtn = $('div.cart-top__left span.icon_close');
                if ($clearBtn.length === 1) {
                    mouseChain({target: $clearBtn[0], events: ['click'], scroll: true, scrollTop: true})
                        .then(delayFunction(1000))
                        .then(() => onSuccess('Must be cleaned!'))
                        .catch((e) => onReject('Error till ClearBtn click: ' + e));
                } else {
                    closeOne();
                }
            };
            removeStakes();
        });
    };

    /**
     * Open event table, if we're on it already -  onSuccess
     * @param {object} data
     * @returns {Promise<any>}
     */
    const openEvent = function (data) {
        return new Promise(function (onSuccess, onReject) {
            //bsDebug(port, 'openEvent', data);
            let team1 = data.team1.toLowerCase();
            let team2 = data.team2.toLowerCase();
            let eventName = team1 + ' — ' + team2;
            let sport = typeof sportAccordance[data.sport] === 'undefined' ? '' : sportAccordance[data.sport];
            if (sport === '') {
                onReject('Sport ' + data.sport + ' not supported or presented :(');
            }
            let checkScore = function () {
                return new Promise(function (onSuccess, onReject) {
                    if (data.score !== '' && ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) === -1) {
                        let score = $('div.scoreboard-content__main-score').text().trim();
                        if (score === data.score.replace(/[^0-9:]/g, '').trim()) {
                            onSuccess(score);
                        } else {
                            onReject(score);
                        }
                    } else {
                        onSuccess('');
                    }
                });
            };
            let result = function (status, message) {
                if (status) {
                    waitForCondition(() => {
                        return checkWeAreThere();
                    }, 777, 30000, 'It looks like we are not there!')
                        .then(checkScore)
                        .then(() => onSuccess())
                        .catch((e) => onReject('SCORE_CHANGED we need: "' + data.score + '", we have: "' + e + '"'));
                } else {
                    onReject(message);
                }
            };
            let checkWeAreThere = function () {
                //bsDebug(port, 'checkWeAreThere');
                let sportHere = $('a.scoreboard-header__champ-name:first span').text().trim();
                let $teams = $('div.scoreboard-content__row_teams span.scoreboard-content__team-name');
                if ($teams.length === 2 && sportHere === sport) {
                    let checkEvent = ($teams.eq(0).text().trim() + ' — ' + $teams.eq(1).text().trim()).toLowerCase();
                    //console.log(checkEvent + ' --- ' + eventName, locutus_similar_text(checkEvent, eventName, true));
                    return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 60;
                } else {
                    return false;
                }
            };
            let switchToSport = function () {
                return new Promise(function (onSuccess, onReject) {
                    waitForElement('div.sports-filter', 333, 7777)
                        .then(($el) => {
                            let $labels = $el.find('label.sports-filter__item');
                            let counter = 0;
                            let next = function () {
                                if (counter < $labels.length - 1) {
                                    counter++;
                                    checkUncheckOne();
                                } else if ($('label.sports-filter__item:has(span.sports-filter__item-text:textEquals("' + sport + '"))')
                                    .hasClass('sports-filter__item_active')) {
                                    onSuccess('It should be opened!');
                                } else {
                                    onReject(sport + ' not presented at moment!');
                                }
                            };
                            let checkUncheckOne = function () {
                                let sportHere = $labels.eq(counter).find('span.sports-filter__item-text').text().trim();
                                //console.log('SportHere = "' + sportHere + '"');
                                if (sportHere !== 'All' && sportHere !== '' &&
                                    ((sportHere === sport && !$labels.eq(counter).hasClass('sports-filter__item_active'))
                                        || (sportHere !== sport && $labels.eq(counter).hasClass('sports-filter__item_active')))) {
                                    mouseChain({target: $labels.eq(counter).find('input[type="checkbox"]')[0], events: ['click']})
                                        .then(delayFunction(2222))
                                        .then(next)
                                        .catch((e) => onReject('Error while sport click: ' + e));
                                } else {
                                    next();
                                }
                            };
                            checkUncheckOne();
                        })
                        .catch((e) => onReject('topSports: ' + e));
                });
            };
            const findEvent = async () => {
                const e = await switchToSport();
                bsDebug(port, 'switchToSport: ' + e);
                await delayFunction(777)();
                let $el = [];
                $('span.line-event__name-teams:visible').each(function () {
                    let $teams = $(this).find('span.font-bold');
                    if ($teams.length === 2) {
                        let checkEvent = ($teams.eq(0).text().trim() + ' — ' + $teams.eq(1).text().trim()).toLowerCase();
                        //console.log(checkEvent + ' === ' + eventName);
                        if (checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70) {
                            $el = $(this);
                            return false;
                        }
                    }
                });
                if ($el.length === 1) {
                    await mouseChain({target: $el[0], events: fullClick, scroll: true});
                } else {
                    throw 'Wrong length of Event: ' + $el.length;
                }
            };
            let goRightPage = function () {
                delayPromise(111)
                    .then(() => {
                        if ($('div.line__controls:visible').length === 0) {
                            return mouseChain({
                                target: $('a.menu__item[href="/en/live"]').first()[0],
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
    const openCoupon = function (paramData) {
        bsDebug(port, 'openCoupon, paramData:', paramData);
        return new Promise(function (onSuccess, onReject) {
            let result = function (success, message) {
                if (success) {
                    if (lData.length > 0) {
                        ourCommand.add('express', ourCommand.getAdded('express') + 1);
                        data = paramData[ourCommand.getAdded('express')];
                        if (typeof data !== 'undefined') {
                            bsDebug(port, 'openCoupon - We got data: ' + (typeof data), data);
                            openElement();
                        } else {
                            if ($('span.cart-header__item_active').text().trim() === 'combo') {
                                onSuccess(parseFloat(message));
                            } else {
                                mouseChain({target: $('span.cart-header__item:contains("combo")')[0], events: ['click']})
                                    .then(delayFunction(1000))
                                    .then(() => $('app-input-dropdown input').attr('placeholder').replace(/[^\d.]/g, '').trim())
                                    .then((max) => onSuccess(parseFloat(max.toString())))
                                    .catch(e => onReject('Express MAX error: ' + e));
                            }
                        }
                    } else {
                        onSuccess(parseFloat(message));
                    }
                } else {
                    bsError(port, message);
                    onReject(message);
                }
            };
            let checkCoupon = function () {
                return new Promise((onSuccess, onReject) => {
                    let event = (data.team1 + ' - ' + data.team2).toLowerCase();
                    let result = false;
                    let matches = [];
                    $('div.cart-items-container span.cart-item__event').each(function () {
                        let teams = $(this).text().trim().toLowerCase();
                        matches.push(teams);
                        if (event === teams || locutus_similar_text(event, teams, true) > 60) {
                            onSuccess($(this).parent());
                            result = true;
                            return false;
                        }
                    });
                    if (!result) {
                        onReject('Wrong match opened: ' + matches.join(', '));
                    }
                });
            };
            let lData = paramData.slice();
            let data = {};
            let $betElement;
            let openElement = function () {
                openEvent(data)
                    .then(() => bsDebug(port, 'Event must be opened!'))
                    .then(() => getBetElement(data))
                    .then($el => $betElement = $el)
                    .then(() => bsDebug(port, 'We got element! Coef: ' + $betElement.text().trim()))
                    .then(() => mouseChain({target: $betElement[0], events: ['click']}))
                    .then(waitForElementF('div.cart-items-container', 333, 20000, true))
                    .then(checkCoupon)
                    .then(() => $('app-input-dropdown input').attr('placeholder').replace(/[^\d.]/g, '').trim())
                    .then((max) => result(true, max))
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
    };

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
        let $logLink = $('a.user-auth-block__button:contains("Sign In")');
        if ($logLink.length > 0) {
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
                balance: getBalance()
            });
            delayPromise(settings.authCheckInterval).then(authCheck);
        }
    };

    const tryToLogIn = () => new Promise(function (resolve, reject) {
        console.log('%c' + 'tryToLogIn', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        let $logLink = $('a.user-auth-block__button:contains("Sign In")');
        if ($logLink.length !== 1) {
            reject('No $logLink!');
            return;
        }
        let performLogin = function () {
            delayPromise(3333)
                .then(() => clearAndSimulate($('input[name="login"]')[0], settings.login))
                .then(delayFunction(3333))
                .then(() => clearAndSimulate($('input[name="pass"]')[0], settings.password))
                .then(delayFunction(3333))
                .then(() => mouseChain({target: $('label.login-save input[type="checkbox"]')[0], events: ['click']}))
                .then(delayFunction(3333))
                .then(() => mouseChain({target: $('button.login__submit')[0], events: ['click']}))
                .then(delayFunction(3333))
                .then(() => {
                    const err = $('span.login-row__error:visible').text().trim();
                    if (err.length > 0) {
                        enterError = true;
                        authClicked = Date.now() + 24 * 3600 * 1000;
                        throw err;
                    }
                })
                .then(() => resolve())
                .catch((e) => reject(e));
        };
        if (Date.now() - authClicked > 60000) {
            authClicked = Date.now();
            mouseChain({target: $logLink[0], events: ['click'], scroll: true})
                .then(() => waitForElement('input[name="login"]', 333, 10000, true))
                .then(performLogin)
                .catch((e) => reject('logLink click: ' + e));
        } else {
            reject('Too soon!');
        }
    });

    function getBalance(returnNull) {
        const $b = $('span.user-info__item-step-head:textEquals("Balance")').next();
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.text().replace(/[^\d.]/g, '').trim());
    }

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            chrome.storage.local.set({
                'BETCITY_COMMAND': ourCommand.get(),
                'BETCITY_COMMAND_WAS_SET':
                    increaseDelay ? Date.now() + 120000 : Date.now()
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
        console.log('loaded and message sent!');
        chrome.storage.local.get(['BETCITY_COMMAND', 'BETCITY_COMMAND_WAS_SET'], function (result) {
            bsDebug(port, 'Saved command:', result);
            if (typeof result.BETCITY_COMMAND !== 'undefined' && typeof result.BETCITY_COMMAND_WAS_SET !== 'undefined'
                && Date.now() - result.BETCITY_COMMAND_WAS_SET < 40000) {
                let currentCommand = result.BETCITY_COMMAND;
                chrome.storage.local.remove(['BETCITY_COMMAND', 'BETCITY_COMMAND_WAS_SET'], function () {
                    waitForCondition(() => {
                        return wasAuthCheck !== false;
                    }, 222, 10000, 'AuthCheck was not', false)
                        .then(() => messageProcessor(currentCommand))
                        .catch((e) => bsError(port, 'Something wrong with auth check! ' + e));
                });
            } else {
                chrome.storage.local.remove(['BETCITY_COMMAND', 'BETCITY_COMMAND_WAS_SET']);
            }
        });
    }

})();