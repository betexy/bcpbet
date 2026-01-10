(function () {

    "use strict";

    /**
     * @import libs/jquery-3.3.1.min.js
     */

        // 1xbet version 2 - new, 1 - old
    let version;

    let newAPI = false;
    let lastSMS = '';
    let authClicked = 0;
    let busy = false;
    let increaseDelay = false;
    let port = chrome.runtime.connect({name: "port_onexstavka"});
    let settings = {
        authCheckInterval: 2000,
        url: 'https://1xbet.com/ru/live/',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        buyer: {
            uid: '',
            secret: '',
            amount: 0,
            coefDecrease: 0,
            waitBetmax: false,
            sendToAll: false,
        },
    };
    let zeroMaxes = 0;

    let codeTry = 0;
    let phoneTry = 0;
    let hasSMS = false;
    let confirmSent = false;
    let smsDelay = 0;
    let authorizationAttempt = 0;

    const setBusy = b => {
        busy = b;
        bMess(`onexstavka_busy`).set(busy).finally();
    };

    const countries = ["Австралия", "Австрия", "Азербайджан", "Албания", "Алжир", "Ангола", "Андорра",
        "Антигуа и Барбуда", "Аргентина", "Армения", "Афганистан", "Багамы", "Бангладеш", "Барбадос",
        "Бахрейн", "Белоруссия", "Беларусь", "Белиз", "Бельгия", "Бенин", "Болгария", "Боливия", "Босния и Герцеговина",
        "Ботсвана", "Бразилия", "Бруней", "Буркина-Фасо", "Бурунди", "Бутан", "Вануату", "Великобритания",
        "Венгрия", "Венесуэла", "Восточный Тимор", "Вьетнам", "Габон", "Гаити", "Гайана", "Гамбия", "Гана",
        "Гватемала", "Гвинея", "Гвинея-Бисау", "Германия", "Гондурас", "Гренада", "Греция", "Грузия", "Дания",
        "Джибути", "Доминика", "Доминикана", "Египет", "Замбия", "Зимбабве", "Израиль", "Индия", "Индонезия",
        "Иордания", "Ирак", "Иран", "Ирландия", "Исландия", "Испания", "Италия", "Йемен", "Кабо-Верде",
        "Казахстан", "Камбоджа", "Камерун", "Канада", "Катар", "Кения", "Кипр", "Киргизия", "Кирибати",
        "Китай", "Колумбия", "Коморы", "Конго", "ДР Конго", "КНДР", "Корея", "Коста-Рика", "Кот-д'Ивуар",
        "Куба", "Кувейт", "Лаос", "Латвия", "Лесото", "Либерия", "Ливан", "Ливия", "Литва", "Лихтенштейн",
        "Люксембург", "Маврикий", "Мавритания", "Мадагаскар", "Малави", "Малайзия", "Мали", "Мальдивы", "Мальта",
        "Марокко", "Маршалловы Острова", "Мексика", "Мозамбик", "Молдавия", "Монако", "Монголия", "Мьянма",
        "Намибия", "Науру", "Непал", "Нигер", "Нигерия", "Нидерланды", "Никарагуа", "Новая Зеландия", "Норвегия",
        "ОАЭ", "Оман", "Пакистан", "Палау", "Панама", "Папуа — Новая Гвинея", "Парагвай", "Перу", "Польша",
        "Португалия", "Россия", "Руанда", "Румыния", "Сальвадор", "Самоа", "Сан-Марино", "Сан-Томе и Принсипи",
        "Саудовская Аравия", "Северная Македония", "Сейшелы", "Сенегал", "Сент-Винсент и Гренадины",
        "Сент-Китс и Невис", "Сент-Люсия", "Сербия", "Сингапур", "Сирия", "Словакия", "Словения", "США",
        "Соломоновы Острова", "Сомали", "Судан", "Суринам", "Сьерра-Леоне", "Таджикистан", "Таиланд", "Танзания",
        "Того", "Тонга", "Тринидад и Тобаго", "Тувалу", "Тунис", "Туркмения", "Туркменистан", "Турция", "Уганда",
        "Узбекистан", "Украина", "Уругвай", "Микронезия", "Фиджи", "Филиппины", "Финляндия", "Франция",
        "Хорватия", "ЦАР", "Чад", "Черногория", "Чехия", "Чили", "Швейцария", "Швеция", "Шри-Ланка", "Эквадор",
        "Экваториальная Гвинея", "Эритрея", "Эсватини", "Эстония", "Эфиопия", "ЮАР", "Южный Судан", "Ямайка", "Япония"];

    const accordance = {
        'FOOTBALL': 'Футбол',
        'HOCKEY': 'Хоккей',
        'VOLLEYBALL': 'Волейбол',
        'TENNIS': 'Теннис',
        'TABLETENNIS': 'Настольный теннис',
        'BASEBALL': 'Бейсбол',
        'BASKETBALL': 'Баскетбол',
        'HANDBALL': 'Гандбол',
        'CYBERSPORT': 'КиберСпорт',
    };

    let currentBetData = false;
    let currentCommand = '';

    let ourCommand = new ourCommandProto();
    let smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);

    const messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        currentCommand = message.action;
        newAPI = !!message.newAPI;
        let $logLink = $('#enter');
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        }
        if (message.action === 'CHECK_LIMITED') {
            waitForCondition(() => !busy, 100, 1800000, 'still busy')
                .then(async () => {
                    if (!!settings.buyer?.secret) {
                        port.postMessage({
                            answered: 'CHECK_LIMITED',
                            limited: false,
                            answer: 'FREE - BUYER here!',
                        });
                    } else {
                        setBusy(true);
                        ourCommand.set(message);
                        await checkLimited().catch(e => dLog('red', 'Olimp',
                            `Error till checkLimited ${e}, ${formatStack(e.stack)}`));
                        dLog('blue', '1X', `CHECK_LIMITED done`);
                        setBusy(false);
                        ourCommand.clear();
                    }
                })
                .catch(e => dLog('red', '1X', `Error till CHECK_LIMITED ${e}, ${formatStack(e.stack)}`));
        }

        if (message.action === 'CONFIRMATION' && busy) {
            hasSMS = true;
            (async () => {
                if (message.data !== null) {
                    const getObj = JSON.parse(message.data);
                    if (getObj.code) {
                        const $code = $('#input_otp');
                        await clearAndSimulate($code[0], getObj.code);
                        await delayPromise(1500);
                        await mouseChain({
                            target: $('button.block-window__btn')[0],
                            events: fullClick,
                            error: 'code button'
                        });
                        await delayPromise(1500);
                    } else {
                        throw 'sms code is NULL!';
                    }
                } else {
                    throw 'sms code is NULL!';
                }
                setBusy(false);
            })().catch(e => console.log(`confirmation error: ${e}`))
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
            if (message.login === 'reger') {
                /*
                window.postMessage(
                    {
                        receiver: 'antiCaptchaPlugin',
                        type: 'setOptions',
                        options: {
                            enable: false
                        }
                    },
                    window.location.href
                );
                */
                //bsDebug(port, 'Anticaptcha plugin disabled, awaiting for registration command!');
                port.postMessage({
                    m: "CLOSE_ME", condition: false, wait: 0
                });
                return;
            } else if (message.login === 'reger_work') {
                bsDebug(port, 'Here we\'ll register it ;)');
                return;
            }
            /*
            window.postMessage(
                {
                    receiver: 'antiCaptchaPlugin',
                    type: 'setOptions',
                    options: {
                        enable: false
                    }
                },
                window.location.href
            );
             */
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.phone = message.phone;
            settings.uid = message.uid;
            settings.buyer = message.buyer;
            dLog('', '1X', [`we got settings:`, message]);
            authCheck();
        } else if (message.action === 'REGISTER') {
            setBusy(true);
            ourCommand.set(message);
            /*
            window.postMessage(
                {
                    receiver: 'antiCaptchaPlugin',
                    type: 'setOptions',
                    options: {
                        enable: false
                    }
                },
                window.location.href
            );
             */
            register(message.data)
                .then(() => bsDebug(port, 'It\'s looks like ' + message.action + ' done!'))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(() => {
                    window.postMessage(
                        {
                            receiver: 'antiCaptchaPlugin',
                            type: 'setOptions',
                            options: {
                                enable: true
                            }
                        },
                        window.location.href
                    );
                    setBusy(false);
                    ourCommand.clear();
                });
        } else if ($logLink.length !== 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (message.action === 'BET') {
            setBusy(true);
            ourCommand.set(message);
            proceedBet(message.data)
                .then(() => bsDebug(port, "It's looks like BET done!"))
                .catch((e) => bsError(port, 'Error till BET: ' + e))
                .then(() => {
                    setBusy(false);
                    ourCommand.clear();
                });
        } else if (message.action === 'EXPRESS_BET') {
            setBusy(true);
            ourCommand.set(message);
            proceedBet(message.data)
                .then(() => bsDebug(port, "It's looks like EXPRESS_BET done!"))
                .catch((e) => bsError(port, 'Error till EXPRESS_BET: ' + e))
                .then(() => {
                    setBusy(false);
                    ourCommand.clear();
                });
        } else if (message.action === 'BET_RESULT') {
            if (!!settings.buyer?.secret) {
                port.postMessage({
                    answered: "BET_RESULT",
                    status: "error",
                    answer: "BUYER here!",
                });
            } else {
                setBusy(true);
                ourCommand.set(message);
                collectBetResults(message.data)
                    .then(() => bsDebug(port, "It's looks like BET_RESULT done!"))
                    .catch((e) => bsError(port, 'Error till BET_RESULT: ' + e))
                    .then(() => {
                        setBusy(false);
                        ourCommand.clear();
                        return mouseChain({target: $('#live_href')[0], events: ['click'], scroll: true});
                    });
            }
        } else if (message.action === 'DEPOSIT') {
            setBusy(true);
            ourCommand.set(message);
            deposit(message.data)
                .then(() => bsDebug(port, "It's looks like DEPOSIT done!"))
                .catch((e) => bsError(port, 'Error till DEPOSIT: ' + e))
                .then(() => {
                    setBusy(false);
                    ourCommand.clear();
                    //return mouseChain({target: $('#live_href')[0], events: ['click'], scroll: true});
                });
        } else if (message.action === 'WITHDRAW') {
            setBusy(true);
            ourCommand.set(message);
            withdraw(message.data)
                .then(() => bsDebug(port, "It's looks like WITHDRAW done!"))
                .catch((e) => bsError(port, 'Error till WITHDRAW: ' + e))
                .then(() => {
                    setBusy(false);
                    ourCommand.clear();
                    //return mouseChain({target: $('#live_href')[0], events: ['click'], scroll: true});
                });
        } else if (message.action === 'CHECK_PAYMENTS') {
            setBusy(true);
            ourCommand.set(message);
            checkPayments()
                .then(() => bsDebug(port, "It's looks like CHECK_PAYMENTS done!"))
                .catch((e) => bsError(port, 'Error till CHECK_PAYMENTS: ' + e))
                .then(delayFunction(3333))
                .then(() => {
                    setBusy(false);
                    ourCommand.clear();
                    return mouseChain({target: $('#live_href')[0], events: ['click'], scroll: true});
                });
        }
    };

    const checkLimited = async internal => {
        if (window.location.href.indexOf('/live/') === -1 || window.location.href.split('/').length >= 7) {
            const $lh = await waitForElement('#live_href', 333, 10000);
            await mouseChain({target: $lh[0], events: ['click'], scroll: true, error: 'LIVE_HREF'});
            await delayPromise(3000);
        }
        await mouseChain({
            target: $(`div.b-filters__item.active:not(div.b-filters__sport-name:textEquals("")) a`)[0],
            events: fullClick, error: 'All sports'
        });
        await delayPromise(3000);
        $('a.c-events__name').each(function () {
            const $row = $(this).closest('div.c-events__item');
            const $titles = $row.closest('div[data-name="dashboard-champ-content"]')
                .find('div.c-bets div');
            let tbIdx = 0, tmIdx = 0, m = 0;
            $titles.each((idx, val) => {
                const text = $(val).attr('title');
                if (text === 'Тотал больше') {
                    tbIdx = idx;
                } else if (text === 'Тотал меньше') {
                    tmIdx = idx;
                }
            });
            if (tbIdx === 0 || tmIdx === 0) {
                return true;
            }
            const $coefs = $row.find('div.c-bets span.c-bets__bet');
            dLog('green', '1X',
                `TO: ${$coefs.eq(tbIdx).trt()}, TU: ${$coefs.eq(tmIdx).trt()}`);
            m = 1 / parseFloat($coefs.eq(tbIdx).trt()) + 1 / parseFloat($coefs.eq(tmIdx).trt());
            if (isNaN(m) || m === 0) {
                return true;
            }
            if (!internal) {
                port.postMessage({
                    answered: 'CHECK_LIMITED',
                    limited: m > 1.125,
                    answer: m > 1.125 ? `Margin is ${m} > 1.125` : 'FREE',
                });
            }
            ourCommand.add('is_limited', m > 1.125);
            return false;
        });
        ourCommand.add('limited_checked', true);
    };

    /**
     * Registration on the service
     * @param data
     * @returns {Promise<any>}
     */
    const register = function (data) {
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
                window.postMessage(
                    {
                        receiver: 'antiCaptchaPlugin',
                        type: 'setOptions',
                        options: {
                            enable: true
                        }
                    },
                    window.location.href
                );
                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                    /*
                    delayPromise(5555)
                        .then(() => port.postMessage({
                            m: "CLOSE_ME", condition: false, wait: 0
                        }));
                        */
                }
            };
            let waitForConfirmUrl = function (timeout, maxWait) {
                let max = typeof maxWait === 'number' ? maxWait : 180000;
                return new Promise(function (onSuccess, onReject) {
                    let waitStarted = Date.now();
                    let performCheck = function () {
                        bsEmailCheck(data.email, 'ONEXBET_CONFIRM_LINK', timeout)
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
            let regionsAccordance = {
                'москва': 'Москва и Московская обл.',
                'московская область': 'Москва и Московская обл.',
                'ярославская область': 'Ярославская обл.',
                'ивановская область': 'Ивановская обл.',
                'костромская область': 'Костромская обл.',
                'вологодская область': 'Вологодская обл.',
                'архангельская область': 'Архангельская обл.',
                'ненецкий автономный округ': 'Архангельская обл.',
                'коми республика': 'Коми',
                'тверская область': 'Тверская обл.',
                'новгородская область': 'Новгородская обл.',
                'псковская область': 'Псковская обл.',
                'мурманская область': 'Мурманская обл.',
                'карелия республика': 'Карелия',
                'ленинградская область': 'Ленинградская область',
                'санкт-петербург': 'Санкт-Петербург и область',
                'смоленская область': 'Смоленская обл.',
                'калининградская область': 'Калининградская обл.',
                'брянская область': 'Брянская обл.',
                'калужская область': 'Калужская обл.',
                'крым республика': 'Республика Крым',
                'севастополь': 'Севастополь',
                'тульская область': 'Тульская обл.',
                'орловская область': 'Орловская обл.',
                'курская область': 'Курская обл.',
                'белгородская область': 'Белгородская обл.',
                'ростовская область': 'Ростовская обл.',
                'краснодарский край': 'Краснодарский край',
                'ставропольский край': 'Ставропольский край',
                'калмыкия республика': 'Калмыкия',
                'кабардино-балкарская республика': 'Кабардино-Балкария',
                'северная осетия - алания республика': 'Северная Осетия',
                'чеченская республика': 'Чечено-Ингушетия',
                'дагестан республика': 'Дагестан',
                'карачаево-черкесская республика': 'Карачаево-Черкесская Республика',
                'адыгея республика': 'Адыгея',
                'ингушетия республика': 'Чечено-Ингушетия',
                'рязанская область': 'Рязанская обл.',
                'тамбовская область': 'Тамбовская обл.',
                'воронежская область': 'Воронежская обл.',
                'липецкая область': 'Липецкая обл.',
                'волгоградская область': 'Волгоградская обл.',
                'саратовская область': 'Саратовская обл.',
                'астраханская область': 'Астраханская обл.',
                'татарстан республика': 'Татарстан',
                'марий эл республика': 'Марий Эл',
                'удмуртская республика': 'Удмуртия',
                'чувашия республика': 'Чувашия',
                'мордовия республика': 'Мордовия',
                'ульяновская область': 'Ульяновская обл.',
                'пензенская область': 'Пензенская обл.',
                'самарская область': 'Самарская обл.',
                'башкортостан республика': 'Башкортостан(Башкирия)',
                'челябинская область': 'Челябинская обл.',
                'оренбургская область': 'Оренбургская обл.',
                'владимирская область': 'Владимирская обл.',
                'нижегородская область': 'Нижегородская область',
                'кировская область': 'Кировская обл.',
                'пермский край': 'Пермский край',
                'свердловская область': 'Свердловская обл.',
                'тюменская область': 'Тюменская обл. и Ханты-Мансийский АО',
                'ханты-мансийский-югра автономный округ': 'Тюменская обл. и Ханты-Мансийский АО',
                'ямало-ненецкий автономный округ': 'Ямало-Ненецкий АО',
                'новосибирская область': 'Новосибирская обл.',
                'томская область': 'Томская обл.',
                'курганская область': 'Курганская обл.',
                'омская область': 'Омская обл.',
                'красноярский край': 'Красноярский край',
                'алтай республика': 'Алтайский край',
                'кемеровская область': 'Кемеровская обл.',
                'хакасия республика': 'Хакасия',
                'алтайский край': 'Алтайский край',
                'иркутская область': 'Иркутская обл.',
                'тыва республика': 'Тува (Тувинская Респ.)',
                'бурятия республика': 'Бурятия',
                'забайкальский край': 'Читинская обл.',
                'амурская область': 'Амурская обл.',
                'саха (якутия) республика': 'Саха (Якутия)',
                'еврейская автономная область': 'Еврейская обл.',
                'хабаровский край': 'Хабаровский край',
                'камчатский край': 'Камчатская обл.',
                'магаданская область': 'Магаданская обл.',
                'чукотский автономный округ': 'Чукотский АО',
                'приморский край': 'Приморский край',
                'сахалинская область': 'Сахалин'
            };
            let regorollAuto = function () {
                let enterEmailAndCollectData = function () {
                    let $userData = $('#UserData:visible');
                    return delayPromise(1111)
                        .then(() => {
                            let login = $userData.find('#account-info-id').trt();
                            let password = $userData.find('#account-info-password').trt();
                            if (login === '' || password === '') {
                                throw 'Bad login / password collected!';
                            }
                            ourCommand.add('newLogin', login);
                            ourCommand.add('newPassword', password);
                        })
                        .then(() => {
                            let $email = $('#form_mail_after_input');
                            $email.val(data['email']);
                            fireInputEvent($email[0]);
                            fireChangeEvent($email[0]);
                        })
                        .then(delayFunction(3333))
                        .then(delayFunction(3333))
                        .then(() => mouseChain({target: $('#form_mail_after_submit')[0], events: ['click']}))
                        .then(waitForElementF('p.registration_info__email-msg.success:visible', 333, 10000))
                        .then(() => mouseChain({target: $('#hidden-close')[0], events: ['click']}))
                        .then(delayFunction(7777))
                        .then(() => {
                            ourCommand.add('NeedConfirmEmail', true);
                        })
                        // Here we go to LK
                        .then(() => mouseChain({
                            target: $('a.submenu_link[href="office/account/"]')[0],
                            events: ['click']
                        }))
                        .catch((e) => console.error(e));
                };
                if (ourCommand.getAdded('goToLink') !== false) {
                    // Here we must be on the good page :)
                    waitForElement('p:contains("Аккаунт активирован!")', 333, 30000)
                        .then(() => report(true, {
                            login: ourCommand.getAdded('newLogin'),
                            password: ourCommand.getAdded('newPassword')
                        }))
                        .then(delayFunction(3333))
                        .then(() => mouseChain({target: $('a:contains("здесь")')[0], events: ['click']}))
                        .catch((e) => report(false, 'Strange page after confirmation! ' + e));
                } else if (ourCommand.getAdded('NeedConfirmEmail') !== false) {
                    // In LK
                    waitForElement('input.lep-form__input', 333, 1000)
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => clearAndSimulate($el[0], data['email']))
                        .then(() => bsDebug(port, 'Start wait for recaptcha solving...'))
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
                        }, 555, 200000, 'reCaptcha not solved for 200s', true))
                        .then(() => {
                            ourCommand.add('waitForEmail', Math.ceil(Date.now() / 1000));
                        })
                        .then(delayFunction(5555))
                        .then(() => mouseChain({target: $('#btn_activate_email')[0], events: ['click']}))
                        // Here we need to wait for email...
                        .then(waitForElementF('p.lep-form__message:contains("отправлено")', 333, 10000))
                        .then(() => bsDebug(port, 'It\'s looks like Email was sent!' + $('p.lep-form__message:contains("отправлено"):visible').length))
                        .then(() => waitForConfirmUrl(ourCommand.getAdded('waitForEmail')))
                        .then((link) => {
                            bsDebug(port, 'We go to confirm link: ' + link);
                            ourCommand.add('goToLink', link);
                        })
                        .then(delayFunction(3333))
                        .then(() => {
                            document.location.href = ourCommand.getAdded('goToLink');
                        })
                        // Here page will change!
                        .catch((e) => report(false, 'Not confirmed! ' + e));
                } else {
                    // For first we need wait Data about register
                    waitForCondition(() => {
                        return $('#UserData:visible').length > 0 || $('div.box-modal_close.arcticmodal-close').length > 0;
                    }, 777, 120000)
                        .then(() => {
                            if ($('#UserData:visible').length > 0) {
                                return enterEmailAndCollectData();
                            } else {
                                return mouseChain({
                                    target: $('div.box-modal_close.arcticmodal-close')[0],
                                    events: ['click']
                                })
                                    .then(waitForElementF('#UserData:visible', 333, 120000))
                                    .then(() => enterEmailAndCollectData());
                            }
                        })
                        .catch((e) => report(false, 'Not registered! ' + e));
                }
            };
            /**
             *
             * @returns {Promise<string>}
             */
            let recogniseReCaptcha = function () {
                return new Promise((onSuccess, onReject) => {
                    let requestId = 0;
                    let waitStarted = 0;
                    let waitForResponse = function () {
                        return new Promise(function (onSuccess, onReject) {
                            let errors = 0;
                            let performWait = function () {
                                sentToReRucaptcha(false, requestId)
                                    .then((res) => {
                                        console.log(res);
                                        if (res.request === 'CAPCHA_NOT_READY') {
                                            delayPromise(5000).then(performWait);
                                        } else if (parseInt(res.status) === 1) {
                                            onSuccess(res.request);
                                        } else if (Date.now() - waitStarted < 60000) {
                                            delayPromise(5000).then(performWait);
                                        } else {
                                            errors++;
                                            if (errors < 5) {
                                                console.log('%c' + 'Bad status from rucaptcha: ' + JSON.stringify(res),
                                                    'background: red; color: yellow; font-size: 13px; font-weight: bold; padding: 3px;');
                                                delayPromise(5000).then(performWait);
                                            } else {
                                                throw 'Bad status from rucaptcha: ' + JSON.stringify(res);
                                            }
                                        }
                                    })
                                    .catch((e) => {
                                        errors++;
                                        if (errors < 5) {
                                            console.log('%c' + 'Bad status from rucaptcha: ' + JSON.stringify(res),
                                                'background: red; color: yellow; font-size: 13px; font-weight: bold; padding: 3px;');
                                            delayPromise(5000).then(performWait);
                                        } else {
                                            onReject('Errors (' + errors + '): ' + e);
                                        }
                                    });
                            };
                            delayPromise(5000).then(performWait);
                        });
                    };
                    sentToReRucaptcha(true, 0,
                        $('#games_content [name="g-recaptcha-response"]').closest('div[data-sitekey]').attr('data-sitekey'), document.location.href, true)
                        .then((res) => {
                            console.log(res);
                            if (parseInt(res.status) === 1) {
                                requestId = res.request;
                                waitStarted = Date.now();
                            } else {
                                throw 'Bad status from rucaptcha: ' + JSON.stringify(res);
                            }
                        })
                        .then(delayFunction(20000))
                        .then(waitForResponse)
                        .then((r) => onSuccess(r))
                        .catch((e) => onReject(e));
                });
            };
            let regoroll = function () {
                if (ourCommand.getAdded('goToLink') !== false) {
                    bsDebug(port, 'regoroll FINAL!');
                    // Here we must be on the good page :)
                    waitForElement('p:contains("Аккаунт активирован!")', 333, 30000)
                        .then(() => report(true, {
                            login: ourCommand.getAdded('newLogin'),
                            password: ourCommand.getAdded('newPassword')
                        }))
                        .then(delayFunction(3333))
                        .then(() => mouseChain({target: $('a:contains("здесь")')[0], events: ['click']}))
                        .catch((e) => report(false, 'Strange page after confirmation! ' + e));
                } else {
                    let captcha = '';
                    bsDebug(port, 'regoroll INITIAL');
                    waitForElement('#registation_button', 333, 30000, true)
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(waitDelayClickF('div.c-registration__tab.c-registration__tab--full_reg', 20000))
                        .then(waitForElementF('div.c-registration__fields input[type="password"][placeholder="Пароль"]', 333, 10000, true))
                        .then(() => {
                            /*
                            recogniseReCaptcha()
                                .then((c) => {
                                    captcha = c;
                                    console.log('%c' + 'ReCaptcha is: ' + c,
                                        'background: transparent; color: orange; font-size: 14px; font-weight: normal');
                                })
                                .catch((e) => {
                                    console.log('%c' + 'Captcha recognise error! ' + e,
                                        'background: red; color: yellow; font-size: 14px; font-weight: bold; padding: 5px;');
                                    bsError(port, 'Captcha recognise error! ' + e);
                                });
                            bsDebug(port, 'RuCaptcha request sent!');
                            */
                        })
                        .then(waitDelayClickF('#games_content div.c-registration__field_country div.multiselect__select',
                            10000, ['mousedown', 'click']))
                        .then(waitDelayClickF('span.multiselect__option:textEquals("Россия"):last', 10000, ['mousedown', 'click']))
                        .then(waitForElementF('#games_content div.c-registration__field_region div.multiselect__select', 333, 10000, true))
                        .then(($el) => {
                            if (!$('#games_content div.c-registration__field_region div.multiselect__content-wrapper').is(':visible')) {
                                return mouseChain({target: $el[0], events: ['mousedown', 'click']});
                            }
                        })
                        .then(delayFunction(3333))
                        .then(() => {
                            let region1x = typeof regionsAccordance[data.region] === 'string' ? regionsAccordance[data.region] : ''; // 'Санкт-Петербург и область'; //
                            let $our = [];
                            $('ul.multiselect__content:visible span.multiselect__option').each(function () {
                                let region = $(this).trt();
                                console.log(region + ' === ' + region1x + ', % = ' + locutus_similar_text(region, region1x, true));
                                if (region === region1x) { // || locutus_similar_text(region, region1x, true) > 85) {
                                    $our = $(this);
                                    return false;
                                }
                            });
                            if ($our.length !== 1) {
                                throw 'Region ' + region1x + ' not found!';
                            } else {
                                return $our;
                            }
                        })
                        .then(($el) => mouseChain({target: $el[0], events: ['mousedown', 'click'], scroll: true}))
                        .then(delayFunction(3333))
                        .then(waitForElementF('#games_content div.c-registration__field_city div.multiselect__select', 333, 1000000, true))
                        .then(($el) => {
                            if (!$('#games_content div.c-registration__field_city div.multiselect__content-wrapper').is(':visible')) {
                                return mouseChain({target: $el[0], events: ['mousedown', 'click']});
                            }
                        })
                        .then(($el) => delayPromise(3333, $el))
                        .then(() => {
                            let $our = [];
                            $('ul.multiselect__content:visible span.multiselect__option').each(function () {
                                let city = $(this).trt();
                                //console.log(city + ' === ' + data.city + ', % = ' + locutus_similar_text(city, data.city, true));
                                if (city === data.city || locutus_similar_text(city, data.city, true) > 70) {
                                    $our = $(this);
                                    return false;
                                }
                            });
                            if ($our.length !== 1) {
                                throw 'City ' + data.city + ' not found!';
                            } else {
                                return $our;
                            }
                        })
                        .then(($el) => mouseChain({target: $el[0], events: ['mousedown', 'click'], scroll: true}))
                        .then(delayFunction(3333))
                        .then(waitDelayClickF('#games_content div.c-registration__field_currency div.multiselect__select',
                            10000, ['mousedown', 'click']))
                        .then(waitDelayClickF('ul.multiselect__content:visible span.multiselect__option:contains("RUB (Российский рубль)")',
                            10000, ['mousedown', 'click']))
                        .then(delayFunction(3333))
                        .then(() => clearAndSimulate($('#games_content input[type="password"][placeholder="Пароль"]')[0], data.password))
                        .then(delayFunction(3333))
                        .then(() => clearAndSimulate($('#games_content input[type="password"][placeholder="Повторите пароль"]')[0], data.password))
                        .then(delayFunction(3333))
                        .then(() => clearAndSimulate($('#games_content input[type="text"][placeholder="Ваше имя"]')[0], data.first_name))
                        .then(delayFunction(3333))
                        .then(() => clearAndSimulate($('#games_content input[type="text"][placeholder="Ваша фамилия"]')[0], data.second_name))
                        .then(delayFunction(3333))
                        .then(() => clearAndSimulate($('#games_content input[type="text"][placeholder="E-mail"]')[0], data.email))
                        .then(delayFunction(3333))
                        /*
                        .then(() => bsDebug(port, 'We started waiting for recaptcha...'))
                        .then(waitForCondition(() => {
                            return captcha !== '';
                        }, 555, 250000, 'reCaptcha not solved for 250s', true))
                        .then(() => bsDebug(port, 'Recaptcha solved!'))
                        .then(() => {
                            $('#games_content [name="g-recaptcha-response"]').html(captcha);
                        })
                        .then(delayFunction(3333))
                        */
                        .then(waitForElementF('#popup_reg_container div.c-registration__button.button.button_light.submit_registration:visible', 333, 10000))
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(() => bsDebug(port, 'Registration clicked!'))
                        .then(delayFunction(5555))
                        .then(() => {
                            if (elementIsVisible($('iframe[title="проверка recaptcha"]').last().get(0))) {
                                console.log('%c' + 'ReCaptcha again :(', 'background: red; color: cyan; font-size: 18px; font-weight: bold; padding: 4px;');
                            }
                        })
                        .then(waitForElementF('#userLoginFast', 333, 400000, true))
                        .then(($el) => {
                            ourCommand.add('waitForEmail', Math.ceil(Date.now() / 1000));
                            ourCommand.add('newLogin', $el.val());
                            ourCommand.add('newPassword', data.password);
                        })
                        .then(() => bsDebug(port, 'It\'s looks like Email was sent!' + $('p.lep-form__message:contains("отправлено"):visible').length))
                        .then(() => waitForConfirmUrl(ourCommand.getAdded('waitForEmail')))
                        .then((link) => {
                            bsDebug(port, 'We go to confirm link: ' + link);
                            ourCommand.add('goToLink', link);
                        })
                        .then(delayFunction(3333))
                        .then(() => {
                            document.location.href = ourCommand.getAdded('goToLink');
                        })
                        //.then(() => mouseChain({target: $('#button_registration')[0], events: ['click'], scroll: true}))
                        //.then(() => report(true, 'Maybe, everything is Okay...'))
                        .catch((e) => report(false, 'Not registered! ' + e));
                }
            };
            //delayPromise(7777).then(() => report(true, {login: data['nickname'], password: data['password']}))
            waitForElement('div.p-reghelp-header__title:contains("Трудности")', 333, 200000, true)
                .then(($el) => mouseChain({
                    target: $el.parent().parent().parent().find('div.box-modal_close.arcticmodal-close')[0],
                    events: ['click']
                }))
                .catch((e) => console.log(e));
            delayPromise(1111).then(regoroll);
        });
    };

    const sentToReRucaptcha = function (first, requestId, googlekey, pageurl, invisible) {
        return new Promise(function (onSuccess, onReject) {
            let messageToSend = {
                backgroundSpecialAction: 'ajaxUrl',
                url: first ? 'rucaptchaSend' : 'rucaptchaRes',
                noBaseAuth: true,
                data: {
                    key: '027c6f1330bbc6acba3867081de6df69',
                    json: 1
                }
            };
            if (first) {
                messageToSend.data['method'] = 'userrecaptcha';
                messageToSend.data['googlekey'] = googlekey;
                messageToSend.data['invisible'] = typeof invisible === "boolean" && invisible ? 1 : 0;
                messageToSend.data['pageurl'] = pageurl;
                messageToSend.data['language'] = 2;
            } else {
                messageToSend.data['action'] = 'get';
                messageToSend.data['id'] = requestId;
                messageToSend['useGET'] = true;
            }
            try {
                chrome.runtime.sendMessage(
                    messageToSend,
                    (response) => {
                        console.log('%c responseCallback: ' + response.success, 'background: green; color: white; font-weight: bold;');
                        console.log(response);
                        if (response.success) {
                            onSuccess(response.message);
                        } else {
                            onReject('Bad message: ' + response.message);
                        }
                    });
            } catch (e) {
                onReject('Error till send message: ' + e);
            }
        });
    };
    /**
     * Check payments
     * @returns {Promise<any>}
     */
    const checkPayments = () => new Promise(function (onSuccess, onReject) {
        bsDebug(port, 'checkPayments!');
        let collected = [];
        let report = function (success, message) {
            bsDebug(port, `Report! ${success} / ${message}`);
            port.postMessage({
                answered: "CHECK_PAYMENTS",
                data: success ? collected : [],
                answer: message
            });
            success ? onSuccess(message) : onReject(message);
        };
        const letsRockNRoll = async () => {
            bsDebug(port, 'letsRockNRoll');
            if (document.location.href.indexOf('/office/historypay') > -1) {
                await delayPromise(7777);
                collected = [];
                $('div.apm-flow__field').each(function () {
                    let $this = $(this);
                    let type = $this.find('div.apm-flow__ico_out').length > 0 ? 'IN' : 'OUT';
                    let desc = $this.find('div.apm-flow__desc').trt();
                    let re = /\s(\d+.\d+)\s/g;
                    let amountRes = re.exec(desc);
                    //console.log($this.find('div.apm-flow__ico_in'), desc);
                    collected.push({
                        date: $this.find('div.apm-flow__date').trt(),
                        description: desc,
                        type: type,
                        paysystem: desc.indexOf('Skrill') > 0 ? 'SKRILL' :
                            (desc.indexOf('Qiwi') > 0 || type === 'OUT' && (desc.indexOf('на №7') > -1 || desc.indexOf('на №38') > -1) ? 'QIWI' : ''),
                        amount: typeof amountRes[1] !== 'undefined' ? amountRes[1] : '',
                        success: type === 'IN' && $this.find('div.apm-flow__ico_out').hasClass('ok')
                            || type === 'OUT' && desc.indexOf('завершен') > 0
                    });
                });
                console.log(collected);
                report(true, 'Collected');
            } else if (document.location.href.indexOf('/office/account') === -1) {
                await waitDelayClickF('a.submenu_link[href="office/account/"]', 40000)();
                return letsRockNRoll();
            } else {
                if ($('div.apm-form__head:contains("Загрузка документа"):visible').length > 0) {
                    report(false, 'Account is LIMITED');
                } else {
                    await waitDelayClickF('a.ap-left-nav__item_transactions')();
                    return letsRockNRoll();
                }
            }
        };
        letsRockNRoll()
            .catch(e => report(false, `Lets R'n'R: ${e}`));
    });
    /**
     * Define withdraw
     * @param data
     * @returns {Promise<any>}
     */
    const withdraw = data => new Promise((onSuccess, onReject) => {
        const report = (success, message) => {
            dLog('green', '1xStavka', `Report! ${success} / ${message}`);
            port.postMessage({
                answered: "WITHDRAW",
                status: success ? "SUCCESS" : message.indexOf('LIMITED') > -1 ? "LIMITED" : "FAILED",
                answer: message
            });
            if (parseInt(data.pin) !== 1) {
                bsSendSmsApi(port, 'BIND_RELEASE', {
                    "websocket_uid": settings.uid,
                    "request_id": ourCommand.getAdded('sms_api_request_id')
                });
            }
            success ? onSuccess(message) : onReject(message);
        };
        withdrawDo(data)
            .then(m => report(true, m))
            .catch(e => report(false, `withdraw: ${e}, ${formatStack(e.stack)}`));
    });
    /**
     * Do withdraw
     * @param data
     * @returns {Promise<*|string|*>}
     */
    const withdrawDo = async data => {
        const $gpf = () => $getIFrame('#payments_frame');
        const checkNotFinished = async () => {
            if ($gpf().find('div.requests_output i.fa-angle-double-down:visible').length > 0) {
                await mouseChain({target: $gpf().find('div.requests_output')[0], events: fullClick, error: 'ro'});
                await delayPromise(1000);
            }
            if ($gpf().find('div.requests_output_block a.getLinkById').length > 0) {
                ourCommand.add('confirmation', true);
                await bMess('QIWI_COMMAND', true).set(ourCommand.get());
                await mouseChain({
                    target: $gpf().find('div.requests_output_block a.getLinkById').first()[0],
                    events: fullClick,
                    error: 'glbi',
                });
                return true;
            }
            return false;
        };
        if (parseInt(data.pin) !== 1 && !ourCommand.getAdded('sms_api_request_id')) {
            if (!settings.phone || !settings.uid) {
                throw `There is no phone or websocket_uid (${settings.phone}/${settings.uid})!`;
            }
            await bsBindNumber(port, settings, smsApiMessage, ourCommand);
        }
        if (ourCommand.getAdded('confirmation')) {
            const dr = await bMess('DEPOSIT_RESULT', true).get(120000);
            if (dr.success) {
                return dr.message || 'No message!';
            } else {
                throw dr.message || 'No message!';
            }
        } else if (document.location.href.indexOf('/office/deduce') > -1) {
            const psSel = `div.payment_item.qiwi`;
            await waitForCondition(() => $gpf().find(psSel).first().length > 0, 333, 15000, 'No PS!');
            await delayPromise(1000);
            await mouseChain({
                target: $gpf().find(psSel).first()[0],
                events: fullClick, scroll: true, error: 'PS click',
            });
            await waitForCondition(() => ['#payment_modal_container', '#amount']
                    .every(s => $gpf().find(s).length > 0),
                333, 15000, 'Pay form not visible for 15s');
            await delayPromise(3500);
            await clearAndSimulate($gpf().find('#amount')[0], parseInt(data.amount) === -1 ? getBalance() : data.amount);
            increaseDelay = true;
            await delayPromise(3500);
            await mouseChain({
                target: $gpf().find('#withdraw_button')[0],
                events: fullClick, error: 'withdraw_button',
            });
            await delayPromise(3500);
            const $code = $gpf().find('input[name="confirm_code"]:visible');
            if ($code.length > 0) {
                dLog('blue', '1xBet', 'We awaiting for sms...');
                const code = await smsApiMessage.waitForSMSCode(["1xstavka"],
                    (m) => {
                        dLog('orange', '1xstavka', `sms: '${m}'`);
                        return m.indexOf('Никому не сообщайте ваш код для вывода средств') > -1;
                    },
                    m => m.replace(/[^\d]/g, ''), 150000);
                await clearAndSimulate($code[0], code);
                await delayPromise(3500);
                await mouseChain({
                    target: $gpf().find('#withdraw_button')[0],
                    events: fullClick, error: 'withdraw_button',
                });
            }
            await delayPromise(5500);
            const clickOk = () => mouseChain({
                target: $gpf().find('button.alerts-ok')[0],
                events: fullClick, error: 'alerts-ok',
            });
            await waitForCondition(() => $gpf().find('button.alerts-ok').length > 0, 333, 100000, 'No OK!');
            if ($gpf().find('div.alerts-title').text().indexOf('ошибка') > -1) {
                const error = $gpf().find('div.alerts-text').trt();
                await clickOk();
                throw `LIMITED: ${error}`;
            }
            await clickOk();
            // Final output...
            await waitForCondition(() => checkNotFinished(), 10000, 700000, 'No confirmation!');
            await delayPromise(600000);
        } else if (document.location.href.indexOf('/office/manager/') > -1) {
            await mouseChain({target: $('a[href="office/deduce/"]')[0], events: fullClick, error: 'deduce'});
        } else if (document.location.href.indexOf('/office/account') === -1) {
            await mouseChain({
                target: $('a.submenu_link[href="office/account/"]')[0],
                events: fullClick,
                error: 'account'
            });
        } else {
            if ($('div.apm-form__head:contains("Загрузка документа"):visible').length > 0) {
                throw 'Account is LIMITED';
            } else {
                await mouseChain({
                    target: $('a.ap-left-nav__item_paycheck')[0],
                    events: fullClick,
                    error: 'paycheck'
                });
            }
        }
        await delayPromise(3500);
        return await withdrawDo(data);
    };
    /**
     * Do deposit
     * @param data
     * @returns {Promise<any>}
     */
    const deposit = data => new Promise(function (onSuccess, onReject) {
        bsDebug(port, 'Deposit!', data);
        const report = (success, message, wallet_balance) => {
            bsDebug(port, 'Report! ' + success + ' / ' + message + ' / ' + wallet_balance);
            port.postMessage({
                answered: "DEPOSIT",
                status: message.indexOf('NO_FUNDS') > -1 ? 'NO_FUNDS' : (success ? "SUCCESS" : "FAILED"),
                answer: message,
                balance: data.amount,
                wallet_balance: wallet_balance || '',
            });
            if (success) {
                onSuccess(message);
            } else {
                onReject(message);
            }
        };
        const letsRockNRoll = async () => {
            bsDebug(port, 'letsRockNRoll');
            const modalClose = 'div.box-modal_close:visible';
            if (ourCommand.getAdded('waitForDepositResult')) {
                dLog('green', '1xSt', 'Waiting for DEPOSIT_RESULT');
                const res = await bMess('DEPOSIT_RESULT', true).get(200000, 60000);
                report(res.success, res.message || 'No message :(', res.balance || '');
            } else if ($(modalClose).length > 0) {
                dLog('', '1XBET', 'Point TWO');
                await waitDelayClickF(modalClose)();
                return letsRockNRoll();
            } else {
                dLog('', '1XBET', 'Point ONE');
                const $dep = () => $(['a.ap-left-nav__item_recharge',
                    'span.ap-banners__btn a[href="office/recharge/"]', '#fast-deposit-popup__btn']
                    .find(s => $(s).length > 0));
                await waitForCondition(() => $dep().length > 0, 333, 15000,
                    'No deposit button :(');
                await delayPromise(1000);
                await mouseChain({target: $dep()[0], events: fullClick, error: '$dep'});
                const $pf = () => $getIFrame('#payments_frame_popup');
                const $qiwi = () => $pf().find('div[data-icon="qiwi"]');
                const $amount = () => $pf().find('#amount');
                const $pay = () => $pf().find('#deposit_button');
                await waitForCondition(() => $qiwi().length > 0, 333, 30000, 'No Qiwi');
                await delayPromise(1000);
                await mouseChain({target: $qiwi()[0], events: fullClick, error: '$qiwi'});
                await delayPromise(1000);
                await waitForCondition(() => $amount().length > 0, 333, 30000, 'No $amount');
                await delayPromise(1000);
                await clearAndSimulate($amount()[0], data.amount);
                if ($pf().find('input[id^="phone_num"]').length > 0) {
                    await delayPromise(3333);
                    await clearAndSimulate($pf().find('input[id^="phone_num"]')[0], data.login);
                    await delayPromise(1000);
                }
                ourCommand.add('waitForDepositResult', true);
                await bMess('QIWI_COMMAND', true).set(ourCommand.get());
                increaseDelay = true;
                await delayPromise(1500);
                await mouseChain({target: $pay()[0], events: fullClick, error: '$pay'});
                return letsRockNRoll();
            }
        };
        letsRockNRoll()
            .catch(e => report(false, `LetsRockNRoll: ${e}`));
    });

    /**
     * Selects date in the date picker element
     * @param {string} date
     * @param {string|JQuery} element
     * @param {string} lang
     * @returns {Promise<void>}
     */
    const selectDatePicker = async (date, element, lang) => {
        let $row = typeof element === 'string'
            ? $(`div.apm-form__caption:textEquals("${element}")`)
                .closest('div.apm-form__field')
            : element.closest('span.apm-filters__date');
        console.log($row);
        if ($row.find('input').val() === date) {
            return;
        }
        const monthsRu = {
            '01': {full: 'Январь', short: 'Янв'},
            '02': {full: 'Февраль', short: 'Февр'},
            '03': {full: 'Март', short: 'Март'},
            '04': {full: 'Апрель', short: 'Апр'},
            '05': {full: 'Май', short: 'Май'},
            '06': {full: 'Июнь', short: 'Июнь'},
            '07': {full: 'Июль', short: 'Июль'},
            '08': {full: 'Август', short: 'Авг'},
            '09': {full: 'Сентябрь', short: 'Сенть'},
            '10': {full: 'Октябрь', short: 'Окт'},
            '11': {full: 'Ноябрь', short: 'Нояб'},
            '12': {full: 'Декабрь', short: 'Дек'},
        };
        const months = lang && lang === 'ru' ? monthsRu : {
            '01': {full: 'January', short: 'Jan'},
            '02': {full: 'February', short: 'Feb'},
            '03': {full: 'March', short: 'Mar'},
            '04': {full: 'April', short: 'Apr'},
            '05': {full: 'May', short: 'May'},
            '06': {full: 'June', short: 'Jun'},
            '07': {full: 'July', short: 'Jul'},
            '08': {full: 'August', short: 'Aug'},
            '09': {full: 'September', short: 'Sep'},
            '10': {full: 'October', short: 'Oct'},
            '11': {full: 'November', short: 'Nov'},
            '12': {full: 'December', short: 'Dec'},
        };
        const ds = date.split('-');
        await mouseChain({
                target: $row.find('input')[0], events: fullClick, error: 'dp1'
            }
        );
        await delayPromise(1000);
        const $activeCalendar = () => $row
            .find('div.vdp-datepicker__calendar[style!="display: none;"]');
        const selYearPage = async year => {
            if (parseInt(year) < parseInt($activeCalendar().find('span.cell.year:first').trt())) {
                await mouseChain({
                    target: $activeCalendar().find('span.prev')[0],
                    events: fullClick,
                    error: 'prev'
                });
                await delayPromise(1000);
                return false;
            } else if (parseInt(year) > parseInt($activeCalendar().find('span.cell.year:last').trt())) {
                await mouseChain({
                    target: $activeCalendar().find('span.next')[0],
                    events: fullClick,
                    error: 'next'
                });
                await delayPromise(1000);
                return false;
            }
            return true;
        };
        await waitForCondition(() => $activeCalendar().length > 0,
            333, 10000, 'No date picker!');
        const $dmb = () => $activeCalendar().find('span.day__month_btn');
        if ($dmb().text().replace(/[^\d]/g, '').trim() !== ds[2]) {
            await mouseChain({target: $dmb()[0], events: fullClick, error: '$dmb()'});
            await delayPromise(1000);
            const $myb = $activeCalendar().find('span.month__year_btn');
            if ($myb.trt() !== ds[2]) {
                await mouseChain({target: $myb[0], events: fullClick, error: '$myb'});
                await delayPromise(1000);
                await waitForCondition(async () => await selYearPage(ds[2]),
                    1000, 60000, `There is no year ${ds[2]}`);
                await delayPromise(1000);
                await mouseChain({
                    target: $activeCalendar().find(`span.cell.year:textEquals("${ds[2]}")`)[0],
                    events: fullClick,
                    error: 'Year'
                });
                await delayPromise(1000);
                await mouseChain({
                    target: $activeCalendar().find(`span.cell.month:textEquals("${months[ds[1]].full}")`)[0],
                    events: fullClick,
                    error: 'Month'
                });
                await delayPromise(1000);
            }
        }
        if ($dmb().text().replace(/[^\w]/g, '').trim() !== months[ds[1]].short) {
            await mouseChain({target: $dmb()[0], events: fullClick, error: '$dmb()'});
            await delayPromise(1000);
            await mouseChain({
                target: $activeCalendar().find(`span.cell.month:textEquals("${months[ds[1]].full}")`)[0],
                events: fullClick,
                error: 'Month'
            });
            await delayPromise(1000);
        }
        if ($activeCalendar().find('span.cell.day.selected').trt() !== ds[0]) {
            await delayPromise(4000);
            await mouseChain({
                target: $activeCalendar()
                    .find(`span.cell.day:textEquals("${ds[0].replace('0', '')}")`)[0],
                events: fullClick,
                error: 'Day'
            });
            await delayPromise(4000);
        }
    };

    /**
     * Collecting bet results
     * @param {array} inD
     * @returns {Promise<any>}
     */
    const collectBetResults = inD => new Promise(function (onSuccess, onReject) {
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 44 ? parseInt(inD[1]) : 44) : 44;
        bsDebug(port, 'collectBetResults, limit: ' + limit + ', data:', data);
        let report = function (success, message) {
            bsDebug(port, 'Collect data: success = ' + success + ', message = ' + message + ', data:', data);
            port.postMessage({
                answered: "BET_RESULT",
                status: success ? "success" : "error",
                answer: message
            });
            if (success) {
                onSuccess(message);
            } else {
                onReject(message);
            }
        };
        collectBetResultsDo(data, limit)
            .then(collected => {
                dLog('red', '1XStavka', ['Collecting done!', collected]);
                report(true, collected);
            })
            .catch(e => report(false, `Performing: ${e}, ${formatStack(e.stack)}`));
    });

    const collectBetResultsDo = async (data, limit) => {
        const oneBet = async () => {
            const collected = [];
            await $('section.apm-panel').eachAsync(async function (idx) {
                if (idx >= limit) {
                    return false;
                }
                const $this = $(this);
                await mouseChain({
                    target: $this.find('button.apm-panel-head__expand')[0],
                    events: fullClick,
                    scroll: true,
                    error: 'click1',
                });
                await waitForCondition(() => $this.find('div.apm-panel__body')
                        .attr('style').trim() === 'display: block;',
                    333, 17000, 'panel__body');
                let external_id = $this.find('p.apm-panel-head__text b:textStarts("№")')
                    .text().replace(/[^\d]/g, '').trim();
                if (data.length === 0 || data.indexOf(external_id) > -1) {
                    let stake = parseFloat($this.find('p.apm-panel-head__subtext:contains("Ставка")')
                        .next()
                        .text().replace(',', '.')
                        .replace(/[^\d.]/g, '').trim());
                    const coef = parseFloat($this.find('div.apm-panel-head__coef').text()
                        .replace(',', '.').replace(/[^\d.]/g, '')
                        .trim());
                    let match = $this.find('div.apm-panel-head__block_name p.apm-panel-head__text')
                        .trt();
                    let bkPivot = $this.find('div.app-coupon-details p:contains("Пари") + p.app-coupon-details__value:first').trt();
                    const result = parseFloat($this.find('p.apm-panel-head__subtext:contains("Выигрыш")')
                        .next().text()
                        .replace(',', '.').replace(/[^\d.]/g, '').trim());
                    let status = 'ACCEPTED';
                    if ($this.find('div.apm-panel-head__coef').hasClass('win')) {
                        status = 'WON';
                    } else if ($this.find('div.apm-panel-head__coef').hasClass('lose')) {
                        status = 'LOSE';
                    }
                    collected.push({
                        external_id: external_id,
                        status: status,
                        match: match,
                        bkPivot: bkPivot,
                        coef: isNaN(coef) || coef === -1 ? '' : coef.toString(),
                        stake: stake,
                        result: isNaN(result) || result === -1 ? '' : result
                    });
                    console.log(collected);
                } else {
                    dLog('yellow', 'Stavka', `'${external_id}' not in data!`);
                }
                await mouseChain({
                    target: $this.find('button.apm-panel-head__expand')[0],
                    events: fullClick, scroll: true, error: 'click2'
                });
                await delayPromise(777);
            });
            return collected;
        };
        const collected = [];
        await delayPromise(3000);
        const urls = {account: '/office/account', history: '/office/history'};
        const clickBets = async () => {
            const $bets = await waitForElement([
                'a.ap-left-nav__item_history',
                'div.ap-left-nav__item_history',
            ], 333, 10000);
            await mouseChain({target: $bets[0], events: fullClick, scroll: true, error: 'St1Bets'});
            await delayPromise(3000);
        };
        if (window.location.href.indexOf(urls.history) > -1) {
            dLog('red', 'Stavka', 'Step 1');
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const delta = d.toISOString().substring(0, 10).split('-');
            const dfSel = findSel(['#datefrom', 'div.vdp-datepicker input:first']);
            let dateStringParsed = $(dfSel).val().split('-');
            if (/* year */ dateStringParsed[2] !== delta[0] || /* month */ dateStringParsed[1] !== delta[1] || /* day */ dateStringParsed[0] !== delta[2]) {
                dateStringParsed[2] = delta[0];
                dateStringParsed[1] = delta[1];
                dateStringParsed[0] = delta[2];
                await selectDatePicker(dateStringParsed.join('-'), $(dfSel), 'ru');
                await delayPromise(3000);
                await mouseChain({
                    target: $('button.apm-filters__btn_alt.show_history')[0],
                    events: fullClick
                });
                await dLog('green', 'Stavka', "Show has been clicked");
                await delayFunction(3333)();
            }
            return await oneBet();
        } else if (window.location.href.indexOf(urls.account) > -1) {
            dLog('red', 'Stavka', 'Step 2');
            await clickBets();
            return await collectBetResultsDo(data, limit);
        } else if (Object.values(urls).every(u => document.location.href.indexOf(u) === -1)) {
            dLog('red', 'Stavka', 'Step 3');
            const $account = await waitForElement('a.submenu_link:visible', 333, 10000);
            await mouseChain({target: $account[0], events: fullClick, scroll: true, error: 'accountSt3'});
            await delayFunction(3333)();
            await clickBets();
            return await collectBetResultsDo(data, limit);
        } else {
            dLog('red', 'Stavka', 'ABNORMAL SITUATION!');
            await delayPromise(300000);
        }
        return collected;
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
        bsLogger('red', '1X', ['proceedBet', data]);
        const betFinished = function (success, message) {
            const resultData = {
                "external_id": success ? message.external_id : '',
                "status": success ? 'ACCEPTED'
                    : ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED', 'MAXIMUM_0']
                    .find(t => message.indexOf(t) > -1) || 'FAILED',
                "market": currentBetData.data[0].market,
                "target": currentBetData.data[0].target,
                "pivot": currentBetData.data[0].pivot,
                "coef": success ? message.coef : currentBetData.data[0].coef,
                "stake": success ? message.stake : currentBetData.data[0].stake,
                "maximum": currentBetData.max
            };
            port.postMessage({
                answered: "BET",
                data: resultData,
                answer: resultData.status === 'MAXIMUM_0' ? 'Tried to bet 0' : success ? 'Everything is Okay!' : message
            });
            setBusy(false);
            ourCommand.clear();
            success ? onSuccess(message) : onReject(message);
        };

        const report = function (success, message, willPlace) {
            bsDebug(port, "Report (proceedBet) was fired with success: " + success + ', message: '
                + message + ', willPlace: ' + willPlace,
                (new Error().stack), message);
            if (success) {
                betFinished(true, message);
            } else {
                betFinished(false, message);
            }
        };

        const checkSuccess = function (willPlace) {
            let waitStatus = function () {
                let alertText = $('#swal2-content:visible').trt();
                let acceptedText = $('div.c-coupon-modal__title').first().trt();
                if (alertText !== '' && alertText.indexOf('временно заблокирована для ставок') > -1) {
                    mouseChain({
                        target: $('a.ui-dialog-titlebar-close.ui-corner-all:visible')[0],
                        events: ['click']
                    })
                        .then(m => m)
                        .catch(e => e)
                        .then(delayFunction(3333))
                        .then(() => report(false, 'bet is temporary blocked!'))
                        .then(delayFunction(3333))
                        .then(() => {
                            window.location.href = settings.url;
                        });
                } else if (alertText !== '' && alertText.indexOf('Изменился коэффициент') > -1) {
                    mouseChain({target: $('button.swal2-confirm:visible')[0], events: ['click']})
                        .then(delayFunction(400))
                        .then(() => performCheckAndBet(currentBetData.max));
                } else if (alertText !== '' && alertText.indexOf('Возможно ваша ставка прошла') > -1) {
                    mouseChain({
                        target: $('a.ui-dialog-titlebar-close.ui-corner-all:visible')[0],
                        events: ['click']
                    })
                        .then()
                        .catch()
                        .then(delayFunction(3333))
                        .then(() => report(false, 'Stake was accepted probably, but we don\'t know it clear :)'))
                        .then(delayFunction(3333))
                        .then(() => {
                            window.location.href = settings.url;
                        });
                } else if (acceptedText.indexOf('Ваша ставка принята') > -1) {
                    let $entire = $('div.c-coupon-modal:visible');
                    let external_id = $('div.c-coupon-modal__title:visible').last().text().replace(/[^0-9]/g, '').trim();
                    let sCoef = $entire.find('span.coupon__text:contains("оэффициент"):visible').next().trt();
                    let sStake = $entire.find('span.coupon__text:contains("Сумма ставки"):visible').next().text().replace(/[^\d.]/g, '').trim();
                    let $button = $('button:contains("Ok")');
                    mouseChain({target: $button[0], events: ['click'], scroll: true})
                        .then(() => report(true, {
                            external_id: external_id,
                            coef: sCoef,
                            stake: sStake
                        }, willPlace))
                        .catch((e) => report(false, 'Error in get summary: ' + e));
                } else if (Date.now() - waitStarted > 30000) {
                    report(false, 'Error we waited for ' + (Date.now() - waitStarted) + 'ms', willPlace);
                } else {
                    setTimeout(waitStatus, 200);
                }
            };
            let waitStarted = Date.now();
            waitStatus();
        };

        let placeClicked = false;
        let afterEnterStakeStarted = 0;
        const afterEnterStake = function (willPlace) {
            // Hint: CHECK entered!
            waitForElement('div.coupon__bet-settings input.c-spinner__input', 333, 3333)
                .then(($el) => {
                    let entered = parseFloat($el.val());
                    bsDebug(port, 'After enter stake check: willPlace = ' + parseFloat(willPlace) + ', entered: ' + entered);
                    if (isNaN(entered) || parseFloat(willPlace) !== entered) {
                        performExactBet(willPlace);
                        bsError(port, 'Entered !== willPlace - try to reenter!');
                        return;
                    }
                    let $acceptBtn = [];
                    const placeBtn = 'button.cpn-btn span:textEquals("Сделать ставку")';
                    let $errors = [];
                    // Hint: CHECK errors
                    //let $errors = $('ul.bbet_nfb li').filter(function () {
                    //    return $(this).trt().indexOf('Недостаточно средств для ставки') === -1;
                    //});
                    if ($acceptBtn.length === 1 && elementIsVisible($acceptBtn[0])) {
                        checkCoefs(data)
                            .then(() => {
                                bsDebug(port, 'We plans to click Accept!');
                                mouseChain({target: $acceptBtn[0], events: ['click']})
                                    .then(delayFunction(777))
                                    .then(() => afterEnterStake(willPlace))
                                    .catch((e) => report(false, 'Error on click $acceeptBtn: ' + e));
                            })
                            .catch((e) => report(false, 'Coefs changed: ' + e));
                    } else if ($errors.length > 0) {
                        report(false, 'We got errors: ' + $errors.trt());
                    } else if ($(placeBtn).length === 0) {
                        report(false, 'No place button or button disabled!');
                    } else {
                        mouseChain({target: $(placeBtn)[0], events: ['click'], scroll: true})
                            .then(() => {
                                placeClicked = true;
                            })
                            .then(delayFunction(777))
                            .then(() => checkSuccess(willPlace))
                            .catch((e) => report(false, 'Error during place bet ' + e));
                    }
                })
                .catch((e) => report(false, 'Input element not found! ' + e));
        };

        const performExactBet = function (willPlaceInput) {
            let willPlace = typeof willPlaceInput !== 'undefined' ? parseFloat(willPlaceInput) : parseFloat(data[0].stake);
            // Hint: Think about necessity of this check here
            let $balance = $('p.top-b-acc__amount').first();
            let balance = parseFloat($balance.trt().replace(/[^0-9\.]/g, '').trim());
            if (isNaN(willPlace) || isNaN(balance) || willPlace > balance) {
                report(false, 'NO_FUNDS we need ' + willPlace + ', we have ' + balance);
            } else {
                // Hint: Let's enter stake
                if (data.length > 0) {
                    let $input = $('div.coupon__bet-settings input.c-spinner__input');
                    willPlace = willPlace.toString().replace('.00', '').trim();
                    if ($input.length === 1) {
                        clearInputElement({
                            element: $input[0],
                            string: willPlace,
                            long: true,
                            fireInput: true,
                            fireChange: true
                        })
                            .then(emulateKeyboardLikeHuman)
                            .then(delayFunction(777))
                            .then(() => {
                                console.log('%cSTAKE entered ' + willPlace, 'background: yellow; font-weight: bold;');
                                afterEnterStakeStarted = Date.now();
                                afterEnterStake(willPlace);
                            })
                            .catch((e) => report(false, 'Error during place bet ' + e));
                    } else {
                        console.log($input);
                        report(false, '2 Wrong number of bet\'s inputs: ' + $input.length);
                    }
                } else {
                    report(false, 'Empty data!');
                }
            }
            //report(true, 'We can bet: ' + $element.trt());
        };

        let performsCount = 0;
        const performCheckAndBet = function (max) {
            performsCount++;
            let $cancelBtn = $('a.ui-dialog-titlebar-close.ui-corner-all:visible');
            if ($cancelBtn.length > 0) {
                mouseChain({target: $cancelBtn[0], events: ['click']})
                    .then(delayFunction(777))
                    .then(() => performCheckAndBet(max))
                    .catch((e) => report(false, '$cancelBtn click: ' + e));
            } else {
                checkCoefs(data)
                    .then(() => {
                        currentBetData.max = max;
                        let willPlace = parseFloat(data[0].stake);
                        if (max <= 0.01) {
                            throw 'LIMITED';
                        }
                        if (max !== -1 && willPlace > max) {
                            willPlace = max;
                        }
                        let $balance = $('p.top-b-acc__amount').first();
                        let balance = parseFloat($balance.trt().replace(',', '').replace(/[^0-9\.]/g, '').trim());
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
                    .catch(e => report(false, 'Error till checkCoefs (' + performsCount + '): ' + e));
            }
        };

        const performBet = function () {
            openCoupon(data)
                .then(max => {
                    dLog('orange', '1X', ['Coupon was opened!', max]);
                    if (max === 'BUYER') {
                        dLog('red', '1X', `BUYER HERE!`);
                        BetBuyer.getAllAsync(settings.waitBetmax)
                            .then(r => {
                                const activeSel = 'span.c-bets__bet_coef_active';
                                let href = '';
                                if ($(activeSel).length > 0) {
                                    href = $(activeSel).closest('div.c-events__item_game')
                                        .find('a.c-events__name').attr('href');
                                } else {
                                    href = document.location.href;
                                }
                                BetBuyer.sendAll(r,
                                    {
                                        bet: {
                                            market: data[0].market,
                                            target: data[0].target,
                                            pivot: data[0].pivot,
                                        },
                                        coef: $('div.c-bet-box').find('div.c-bet-box__bet').trt(),
                                        stake: settings.buyer.amount,
                                        homeTeam: data[0].team1,
                                        awayTeam: data[0].team2,
                                        league: data[0].league,
                                        mode: data[0].type,
                                        period: data[0].time_value,
                                        score: data[0].score,
                                        sport: data[0].sport,
                                        direct_link: href.indexOf('https://') === -1 ? 'https://1xstavka.ru/'
                                            + href : href,
                                    },
                                    settings.buyer,
                                    '1XSTAVKA');
                                report(false, `Buyer was sent!`);
                            });
                    } else {
                        if (!max.success) {
                            throw max.max;
                        }
                        performCheckAndBet(max.max);
                    }
                })
                .catch((e) => report(false, `Error during openCoupon: ${e}, ${formatStack(e.stack)}`));
        };

        closePreviousCoupons(false)
            .then((p) => {
                bsDebug(port, p);
                performBet();
            })
            .catch((e) => report(false, 'Error till close coupons: ' + e));

    });

    /**
     * Checks coefs into the coupon
     * @param data
     * @returns {Promise<string,string>}
     */
    const checkCoefs = data => new Promise(function (onSuccess, onReject) {
        /* TEST TOP START
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
                        if (localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 60) {
                            result = this;
                            return false;
                        }
                    });
                    return result;
                };
                let $coupon = $('div.coupon');// $('div.coupon div.o-bet-box-list__item div[class="c-bet-box__teams"]')
                let $coupons = $coupon.find('div.o-bet-box-list__item');
                let errors = [];
                let checked = 0;
                let totalCoef = 1;
                $coupons.each(function () {
                    let $this = $(this);
                    let first = true;
                    let $teams = $(this).find('span.c-bet-box__label');

                    let match = $teams.length === 2 ?
                        $teams.eq(0).trt() + ' - ' + $teams.eq(1).trt()
                        : $teams.trt();
                    //console.log(match);
                    if ($this.hasClass('market-unavailable')) {
                        errors.push(match + ' LOW_COEF, market unavailable!');
                        checked++;
                        return true;
                    }
                    let localCoef = parseFloat($this.find('div.c-bet-box__bet').trt());
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
                    onSuccess('Coefs fine!');
                } else if (newAPI && errors.length === 0 && checked === data.length) {
                    const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
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
        };
        checkCoupon()
            .then(() => {
                let $ok = $('div.ui-dialog-buttonset button:contains("ОК")');
                if ($ok.length > 0) {
                    return mouseChain({target: $ok[0], events: ['click']})
                        .then(delayFunction(777));
                }
            })
            .then((m) => onSuccess(m))
            .catch((e) => onReject(e));
        /* TEST BOTTOM START
    })([
        //{team1: 'Авангард ', team2: 'Салават Юлаев', coef: '1.84'},
        {team1: 'Динамо Рига', team2: 'Автомобилист', coef: '1.27'}
    ]);
        //TEST BOTTOM FINISH */
    });

    const getTeams = data => {
        let $teams = [];
        if (data.type === 'LIVE') {
            $teams = data.sport === 'TABLETENNIS' ? $('span.db-sport__team-name')
                : data.sport === 'CYBERSPORT' ? $(['div.c-team__name', 'div[class$="_tablo-team"] div.name'].find(s => $(s).length === 2))
                    : data.sport === 'BASEBALL' ? $('div.scoreboard__team-name')
                        : $('div.c-tablo__team');
        } else {
            $teams = data.sport === 'FOOTBALL' ? $('div.c-scoreboard-team__name') : $('div.scoreboard-line__name');
        }
        return $teams;
    };

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<jQuery,string>} jQuery element for bet
     */
    const getBetElement = data => new Promise((reportSuccess, reportReject) => {
        let performGetStarted = 0;
        let report = function (success, message) {
            if (success) {
                reportSuccess(message);
            } else if (Date.now() - performGetStarted < 15000) {
                delayPromise(3000).then(performGet);
            } else {
                reportReject(message);
            }
        };

        let $teams = getTeams(data);
        if ($teams.length === 2 && data.sport !== 'TABLETENNIS') {
            if (!!data.direct_link) {
                data.team1 = $teams.eq(0).trt();
                data.team2 = $teams.eq(1).trt();
            }
            data.team1s = $teams.eq(0).trt().toLowerCase();
            data.team2s = $teams.eq(1).trt().toLowerCase();
            data.team1b = $teams.eq(0).trt();
            data.team2b = $teams.eq(1).trt();
        } else if ($teams.length === 2 && data.sport === 'TABLETENNIS') {
            if (!!data.direct_link) {
                data.team1 = $teams.eq(0).trt();
                data.team2 = $teams.eq(1).trt();
            }
            data.team1s = $teams.eq(0).text().replace(/\(.*?\)/, '').trim().toLowerCase();
            data.team2s = $teams.eq(1).text().replace(/\(.*?\)/, '').trim().toLowerCase();
            data.team1t = $teams.eq(0).trt().toLowerCase();
            data.team2t = $teams.eq(1).trt().toLowerCase();
            data.team1b = $teams.eq(0).text().replace(/\(.*?\)/, '').trim();
            data.team2b = $teams.eq(1).text().replace(/\(.*?\)/, '').trim();
        } else {
            reportReject('No teams!');
            return;
        }
        //#-#-START
        let markets = {
            'ONE_TWO': {
                'ONE': {
                    root: ['1x2', 'Победа в матче. с ОТ'],
                    pivotKeys: ['#TEAM1B#', 'П1', '#TEAM1T#', 'Победа в матче - #TEAM1B#'],
                    s: 'Основная игра'
                }, // span data-ng-click contains
                'TWO': {
                    root: ['1x2', 'Победа в матче. с ОТ'],
                    pivotKeys: ['#TEAM2B#', 'П2', '#TEAM2T#', 'Победа в матче - #TEAM2B#'],
                    s: 'Основная игра'
                },
                'DRAW': {root: ['1x2',], pivotKey: 'Ничья', s: 'Основная игра'},
                'ONE_DRAW': {root: ['Двойной шанс'], pivotKeys: ['#TEAM1B# или Ничья', '1х'], s: 'Основная игра'},
                'TWO_DRAW': {root: ['Двойной шанс'], pivotKeys: ['#TEAM2B# или Ничья', '2х'], s: 'Основная игра'},
                'ONE_TWO': {root: ['Двойной шанс'], pivotKeys: ['#TEAM1B# или #TEAM2B#', '12'], s: 'Основная игра'}
            },
            'TOTAL': {
                'OVER': {
                    root: ['Тотал', 'Азиатский тотал', 'Тотал. с ОТ'],
                    pivotKeys: ['Тотал #PIVOT# Б', 'Тотал #PIVOTR# Б', '#PIVOTR# Б', '#PIVOT2# Б'],
                    s: 'Основная игра'
                },
                'UNDER': {
                    root: ['Тотал', 'Азиатский тотал', 'Тотал. с ОТ'],
                    pivotKeys: ['Тотал #PIVOT# М', 'Тотал #PIVOTR# М', '#PIVOTR# М', '#PIVOT2# М'],
                    s: 'Основная игра'
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    root: ['Индивидуальный тотал 1-го', 'Азиатский индивидуальный тотал 1-го', 'Индивидуальный тотал 1-го. с ОТ'],
                    pivotKeys: [
                        '#TEAM1B# тотал #PIVOT# Б',
                        '#TEAM1B# тотал #PIVOTR# Б',
                        'Индивидуальный тотал 1-го #PIVOT# Б',
                        'Индивидуальный тотал 1-го #PIVOTR# Б',
                        '#PIVOTR# Б', '#PIVOT2# Б',
                        'индивидуальный тотал 1 больше #PIVOT#',
                        'индивидуальный тотал 1 больше #PIVOTR#',
                    ], s: 'Основная игра'
                },
                'UNDER': {
                    root: ['Индивидуальный тотал 1-го', 'Азиатский индивидуальный тотал 1-го', 'Индивидуальный тотал 1-го. с ОТ'],
                    pivotKeys: [
                        '#TEAM1B# тотал #PIVOT# М',
                        '#TEAM1B# тотал #PIVOTR# М',
                        'Индивидуальный тотал 1-го #PIVOT# М',
                        'Индивидуальный тотал 1-го #PIVOTR# М',
                        '#PIVOTR# М', '#PIVOT2# М',
                        'индивидуальный тотал 1 меньше #PIVOT#',
                        'индивидуальный тотал 1 меньше #PIVOTR#',
                    ], s: 'Основная игра'
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    root: ['Индивидуальный тотал 2-го', 'Азиатский индивидуальный тотал 2-го', 'Индивидуальный тотал 2-го. с ОТ'],
                    pivotKeys: [
                        '#TEAM2B# тотал #PIVOT# Б',
                        '#TEAM2B# тотал #PIVOTR# Б',
                        'Индивидуальный тотал 2-го #PIVOT# Б',
                        'Индивидуальный тотал 2-го #PIVOTR# Б',
                        '#PIVOTR# Б', '#PIVOT2# Б',
                        'индивидуальный тотал 2 больше #PIVOT#',
                        'индивидуальный тотал 2 больше #PIVOTR#',
                    ], s: 'Основная игра'
                },
                'UNDER': {
                    root: ['Индивидуальный тотал 2-го', 'Азиатский индивидуальный тотал 2-го'],
                    pivotKeys: [
                        '#TEAM2B# тотал #PIVOT# М',
                        '#TEAM2B# тотал #PIVOTR# М',
                        'Индивидуальный тотал 2-го #PIVOT# М',
                        'Индивидуальный тотал 2-го #PIVOTR# М',
                        '#PIVOTR# М', '#PIVOT2# М',
                        'индивидуальный тотал 2 меньше #PIVOT#',
                        'индивидуальный тотал 2 меньше #PIVOTR#',
                    ], s: 'Основная игра'
                },
            },
            'HDP': {
                'HOME': {
                    root: ['Фора', 'Азиатская фора'],
                    pivotKeys: ['#TEAM1B# фора (#PIVOT#)', '#TEAM1B# фора (#PIVOTR#)', '1 #PIVOT2#'],
                    s: 'Основная игра'
                },
                'AWAY': {
                    root: ['Фора', 'Азиатская фора'],
                    pivotKeys: ['#TEAM2B# фора (#PIVOT#)', '#TEAM2B# фора (#PIVOTR#)', '2 #PIVOT2#'],
                    s: 'Основная игра'
                }
            },
            'CORNER_TOTAL': {
                'OVER': {
                    root: ['Тотал. Угловые', 'Азиатский тотал. Угловые'],
                    pivotKeys: ['Тотал #PIVOT# Б', 'Тотал #PIVOTR# Б', '#PIVOTR# Б', '#PIVOT2# Б'], s: 'Угловые'
                },
                'UNDER': {
                    root: ['Тотал. Угловые', 'Азиатский тотал. Угловые'],
                    pivotKeys: ['Тотал #PIVOT# М', 'Тотал #PIVOTR# М', '#PIVOTR# М', '#PIVOT2# М'], s: 'Угловые'
                },
            },
            'CORNER_HDP': {
                'HOME': {
                    root: ['Фора. Угловые'],
                    pivotKeys: ['#TEAM1B# фора (#PIVOT#)', '#TEAM1B# фора (#PIVOTR#)', '1 #PIVOT2#'],
                    s: 'Угловые'
                },
                'AWAY': {
                    root: ['Фора. Угловые'],
                    pivotKeys: ['#TEAM2B# фора (#PIVOT#)', '#TEAM2B# фора (#PIVOTR#)', '2 #PIVOT2#'],
                    s: 'Угловые'
                }
            },
            half: {
                'ONE_TWO': {
                    'ONE': {
                        root: ['1x2. #SET#', 'Победа в #GAME2#. #SET#'],
                        pivotKeys: ['#TEAM1B#', 'П1', 'Гейм #GAME# П1'],
                        s: '#SET#'
                    },
                    'TWO': {
                        root: ['1x2. #SET#', 'Победа в #GAME2#. #SET#'],
                        pivotKeys: ['#TEAM2B#', 'П2', 'Гейм #GAME# П2'],
                        s: '#SET#'
                    },
                    'DRAW': {root: ['1x2. #SET#'], pivotKey: 'Ничья', s: '#SET#'},
                    'ONE_DRAW': {
                        root: ['Двойной шанс. #SET#'],
                        pivotKeys: ['#TEAM1B# или Ничья', '1х'],
                        s: '#SET#'
                    },
                    'TWO_DRAW': {
                        root: ['Двойной шанс. #SET#'],
                        pivotKeys: ['#TEAM2B# или Ничья', '2х'],
                        s: '#SET#'
                    },
                    'ONE_TWO': {
                        root: ['Двойной шанс. #SET#'],
                        pivotKeys: ['#TEAM1B# или #TEAM2B#', '12'],
                        s: '#SET#'
                    }
                },
                'TOTAL': {
                    'OVER': {
                        root: ['Тотал. #SET#', 'Азиатский тотал. #SET#', 'Фраги, тотал. #SET#'],
                        pivotKeys: ['Тотал #PIVOT# Б', 'Тотал #PIVOTR# Б', '#PIVOTR# Б', '#PIVOT2# Б'],
                        s: '#SET#'
                    },
                    'UNDER': {
                        root: ['Тотал. #SET#', 'Азиатский тотал. #SET#', 'Фраги, тотал. #SET#'],
                        pivotKeys: ['Тотал #PIVOT# М', 'Тотал #PIVOTR# М', '#PIVOTR# М', '#PIVOT2# М'],
                        s: '#SET#'
                    },
                },
                'T1_TOTAL': {
                    'OVER': {
                        root: ['Индивидуальный тотал 1-го. #SET#', 'Азиатский индивидуальный тотал 1-го. #SET#'],
                        pivotKeys: [
                            '#TEAM1B# тотал #PIVOT# Б',
                            '#TEAM1B# тотал #PIVOTR# Б',
                            'Индивидуальный тотал 1-го #PIVOT# Б',
                            'Индивидуальный тотал 1-го #PIVOTR# Б',
                            '#PIVOTR# Б', '#PIVOT2# Б',
                            'индивидуальный тотал 1 больше #PIVOT#',
                            'индивидуальный тотал 1 больше #PIVOTR#',
                        ], s: '#SET#'
                    },
                    'UNDER': {
                        root: ['Индивидуальный тотал 1-го. #SET#', 'Азиатский индивидуальный тотал 1-го. #SET#'],
                        pivotKeys: [
                            '#TEAM1B# тотал #PIVOT# М',
                            '#TEAM1B# тотал #PIVOTR# М',
                            'Индивидуальный тотал 1-го #PIVOT# М',
                            'Индивидуальный тотал 1-го #PIVOTR# М',
                            '#PIVOTR# М', '#PIVOT2# М',
                            'индивидуальный тотал 1 меньше #PIVOT#',
                            'индивидуальный тотал 1 меньше #PIVOTR#',
                        ], s: '#SET#'
                    },
                },
                'T2_TOTAL': {
                    'OVER': {
                        root: ['Индивидуальный тотал 2-го. #SET#', 'Азиатский индивидуальный тотал 2-го. #SET#'],
                        pivotKeys: [
                            '#TEAM2B# тотал #PIVOT# Б',
                            '#TEAM2B# тотал #PIVOTR# Б',
                            'Индивидуальный тотал 2-го #PIVOT# Б',
                            'Индивидуальный тотал 2-го #PIVOTR# Б',
                            '#PIVOTR# Б', '#PIVOT2# Б',
                            'индивидуальный тотал 2 больше #PIVOT#',
                            'индивидуальный тотал 2 больше #PIVOTR#',
                        ], s: '#SET#'
                    },
                    'UNDER': {
                        root: ['Индивидуальный тотал 2-го. #SET#', 'Азиатский индивидуальный тотал 2-го. #SET#'],
                        pivotKeys: [
                            '#TEAM2B# тотал #PIVOT# М',
                            '#TEAM2B# тотал #PIVOTR# М',
                            'Индивидуальный тотал 2-го #PIVOT# М',
                            'Индивидуальный тотал 2-го #PIVOTR# М',
                            '#PIVOTR# М', '#PIVOT2# М',
                            'индивидуальный тотал 2 меньше #PIVOT#',
                            'индивидуальный тотал 2 меньше #PIVOTR#',
                        ], s: '#SET#'
                    },
                },
                'HDP': {
                    'HOME': {
                        root: ['Фора. #SET#', 'Азиатская фора. #SET#', 'Фраги, фора. #SET#'],
                        pivotKeys: ['#TEAM1B# фора (#PIVOT#)', '#TEAM1B# фора (#PIVOTR#)', '1 #PIVOT2#'],
                        s: '#SET#'
                    },
                    'AWAY': {
                        root: ['Фора. #SET#', 'Азиатская фора. #SET#', 'Фраги, фора. #SET#'],
                        pivotKeys: ['#TEAM2B# фора (#PIVOT#)', '#TEAM2B# фора (#PIVOTR#)', '2 #PIVOT2#'],
                        s: '#SET#'
                    }
                },
                'CORNER_TOTAL': {
                    'OVER': {
                        root: ['Тотал. #SET# Угловые', 'Азиатский тотал. #SET# Угловые'],
                        pivotKeys: ['Тотал #PIVOT# Б', 'Тотал #PIVOTR# Б', '#PIVOTR# Б', '#PIVOT2# Б'],
                        s: '#SET# Угловые'
                    },
                    'UNDER': {
                        root: ['Тотал. #SET# Угловые', 'Азиатский тотал. #SET# Угловые'],
                        pivotKeys: ['Тотал #PIVOT# М', 'Тотал #PIVOTR# М', '#PIVOTR# М', '#PIVOT2# М'],
                        s: '#SET# Угловые'
                    },
                },
                'CORNER_HDP': {
                    'HOME': {
                        root: ['Фора. #SET# Угловые'],
                        pivotKeys: ['#TEAM1B# фора (#PIVOT#)', '#TEAM1B# фора (#PIVOTR#)', '1 #PIVOT2#'],
                        s: 'Угловые'
                    },
                    'AWAY': {
                        root: ['Фора. #SET# Угловые'],
                        pivotKeys: ['#TEAM2B# фора (#PIVOT#)', '#TEAM2B# фора (#PIVOTR#)', '2 #PIVOT2#'],
                        s: 'Угловые'
                    }
                },
            }
        };

        if (data.time_value.indexOf('FULL') === -1) {
            markets = markets.half;
        }

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            reportReject('Unsupported ' + data.time_value + '/' + data.market + '/' + data.target);
            return;
        }

        let specialPivotFormatter = function (market, pivot, fc) {
            function round(value, precision) {
                let multiplier = Math.pow(10, precision || 0);
                return Math.round(value * multiplier) / multiplier;
            }

            const fix = fc || 1;
            let fp = parseFloat(pivot);
            let res = '';
            if (!isNaN(fp)) {
                if (market.indexOf('TOTAL') > -1) {
                    // dot zero adding
                    res = round(fp, fix).toFixed(fix).toString();
                } else if (market.indexOf('HDP') > -1) {
                    res = (fp > 0 ? '+' : '') + round(fp, 2).toFixed(2).toString();

                }
            }
            return res;
        };

        let subSpecialPivotFormatter = function (noPlus) {
            let fp = parseFloat(data.pivot);
            if (!isNaN(fp) && data.market.indexOf('HDP') > -1 && fp !== 0) {
                return (fp > 0 && !noPlus ? '+' : '') + data.pivot;
            }
            return data.pivot;
        };

        const getSetInfo = (dt, sport) => {
            const td = dt.replace(/[^\d]/g, '').trim();
            let res = '';
            if (['FOOTBALL', 'HANDBALL'].indexOf(sport) > -1) {
                res = `1-й  Тайм`;
            } else if (sport === 'TENNIS') {
                res = dt.indexOf('_GAME_') > -1
                    ? `${dt.split('_GAME_')[0].replace(/[^\d]/g, '').trim()}-й Сет`
                    : `${td}-й Сет`;
            } else if (sport === 'BASKETBALL' && dt.indexOf('HALF') > -1) {
                res = `${td}-я половина`;
            } else if (sport === 'BASKETBALL' && dt.indexOf('Q_' + td) > -1) {
                res = `${td}-я Четверть`;
            } else if (sport === 'HOCKEY') {
                res = `${td}-й Период`;
            } else if (sport === 'VOLLEYBALL') {
                res = `${td}-й Сет`;
            } else if (sport === 'TABLETENNIS') {
                res = `${td}-я Партия`;
            } else if (sport === 'CYBERSPORT') {
                res = `${td}-я карта`;
            } else if (sport === 'BASEBALL') {
                res = `${td}-й Иннинг`;
            }
            console.log('%c' + `getSetInfo: '${dt}' / '${sport}' = ${res}`,
                'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            return res;
        };

        const getGameInfo = (dt, sport) => {
            if (sport !== 'TENNIS' || dt.indexOf('_GAME_') === -1) {
                return '';
            } else {
                return dt.split('_GAME_')[1].replace(/[^\d]/g, '').trim();
            }
        }

        const getGame2Info = (dt, sport) => sport === 'TENNIS' && dt.indexOf('_GAME_') > -1 ? 'гейме' : '';

        let replaceInner = function (element, parent, index) {
            if (typeof element === 'string') {
                parent[index] = element
                    .replace('#TEAM1#', data.team1s)
                    .replace('#TEAM2#', data.team2s)
                    .replace('#TEAM1B#', data.team1b)
                    .replace('#TEAM2B#', data.team2b)
                    .replace('#TEAM1T#', data.team1t)
                    .replace('#TEAM2T#', data.team2t)
                    .replace('#PIVOT#', subSpecialPivotFormatter())
                    .replace('#PIVOT2#', subSpecialPivotFormatter(true))
                    .replace('#PIVOTR#', specialPivotFormatter(data.market, data.pivot))
                    .replace('#PIVOTR2#', specialPivotFormatter(data.market, data.pivot, 2))
                    .replace('#SET#', getSetInfo(data.time_value, data.sport))
                    .replace('#GAME#', getGameInfo(data.time_value, data.sport))
                    .replace('#GAME2#', getGame2Info(data.time_value, data.sport));
            } else if (typeof element === 'object') {
                for (let i in element) {
                    replaceInner(element[i], element, i);
                }
            } else {
                // console.log(typeof element + ' not supported! (' + element + ')');
            }
        };
        replaceInner(markets, null, null);

        console.log(markets);
        bsDebug(port, 'market:', markets[data.market][data.target]);

        let market = markets[data.market][data.target];

        if (data.sport === 'TENNIS' && data.time_value.indexOf('_GAME_') > -1) {
            market.pivotKeys = [market.pivotKeys[2]];
        }

        market.root.forEach((i, k) => market.root[k] = i.toLowerCase());
        if (market.pivotKeys) {
            market.pivotKeys.forEach((i, k) => market.pivotKeys[k] = i.toLowerCase());
        }
        //switchToS: 'Основная игра' === '1-й  Тайм'
        const switchToS = async s => {
            const msSel = 'div.scoreboard-nav__select span.multiselect__single';
            dLog('green', '1x', `switchToS: '${$(msSel).trt()}' === '${s}'`);
            if ($(msSel).trt() === s) {
                return;
            }
            console.log('%c' + `'${$(msSel).trt()}' !== '${s}'`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            await mouseChain({target: $(msSel)[0], events: ['mousedown', 'click']});
            const $el = await waitForElement(
                `div.scoreboard-nav__select span.multiselect__option:textEqualsIS("${s}")`,
                333, 10000, true);
            await delayPromise(250);
            await mouseChain({
                target: $el[0],
                events: ['mouseover', 'mousedown', 'click', 'mouseup', 'mouseleave']
            });
            await delayPromise(1000);
        };

        const checkRoots = async $roots => {
            console.log('Roots:', $roots);
            let $el;
            await $roots.eachAsync(async function () {
                const $cRoot = $(this);
                console.log($cRoot);
                if ($cRoot.find('div.bet-title_justify').hasClass('min')) {
                    await mouseChain({
                        target: $cRoot.find('div.bet-title_justify')[0],
                        events: ['click'],
                        error: 'ExPaNd!'
                    });
                    await delayPromise(750);
                }
                $cRoot.find('span.bet_type').each(function () {
                    const pvt = $(this).text().replace($(this).find('span.bet_type__label').text(), '').trim().toLowerCase();
                    if (typeof market.pivotKeys === 'undefined') {
                        if (pvt === market.pivotKey.toLowerCase()) {
                            $el = $(this);
                            return false;
                        } else {
                            console.log(`'${pvt}' !== '${market.pivotKey.toLowerCase()}'`);
                        }
                    } else {
                        if (market.pivotKeys.indexOf(pvt) > -1) {
                            $el = $(this);
                            return false;
                        } else {
                            console.log(`'${pvt}' not in '${market.pivotKeys.join("', '")}'`);
                        }
                    }
                });
                if ($el && $el.length === 1) {
                    let $ourEl = $el.parent().find('span.koeff');
                    if ($ourEl.length === 1) {
                        report(true, $ourEl);
                        return false;
                    }
                }
            });
            if (!$el || $el.length === 0) {
                throw 'Not found in root(s)';
            }
        };

        const performGet = function () {
            dLog('green', '1x', 'performGet: ' + (Date.now() - performGetStarted));

            let $roots = $('div.bet_group').filter(function () {
                const s = $(this).find('div.bet-title').text().replace(/\s+/g, ' ').trim().toLowerCase();
                return market.root.some(i => i.replace(/\s+/g, ' ') === s);
            });

            if ($roots.length > 0) {
                checkRoots($roots)
                    .catch((e) => report(false, 'checkRoots: ' + e));
            } else if (Date.now() - performGetStarted < 5000) {
                delayPromise(2000)
                    .then(performGet)
                    .catch((e) => report(false, 'switchToS: ' + e));
            } else {
                report(false, 'Bet not found! (no $roots)');
            }
        };

        let $order = $('div.ABC_order');
        let $columns = $('div.two-column');
        if ($order.length === 1 && $order.attr('title').trim() === 'Перейти к полной росписи') {
            mouseChain({target: $order[0], events: ['click']})
                .then(delayFunction(3333))
                .then(() => bsDebug(port, 'Here must be switching to correct order!'))
                .catch((e) => report(false, 'Order switch: ' + e));
        } else if ($columns.length === 1 && !$columns.hasClass('active')) {
            mouseChain({target: $columns[0], events: ['click']})
                .then(delayFunction(7777))
                .then(() => switchToS(market.s))
                .then(() => {
                    performGetStarted = Date.now();
                    performGet();
                })
                .catch((e) => report(false, 'Columns switch: ' + e));
        } else {
            switchToS(market.s)
                .then(() => {
                    performGetStarted = Date.now();
                    performGet();
                })
                .catch((e) => report(false, 'Third branch: ' + e));
        }
        //#-#-FINISH
    });

    /**
     * Close early opened coupons
     * @param skipParam [{boolean}] default FALSE - whether we need to skip closing
     * @returns {Promise<string,string>}
     */
    const closePreviousCoupons = function (skipParam) {
        let skip = typeof skipParam === 'undefined' ? false : skipParam;
        //let goToInplay = typeof goToInplayParam === 'undefined' ? true : goToInplayParam;
        //bsDebug(port, 'closePreviousCoupons - skip? ' + skip + ', goHome? ' + goToInplay);
        return new Promise(function (onSuccess, onReject) {
            if (skip) {
                bsDebug(port, 'closePreviousCoupons - SKIP');
                onSuccess('skipped!');
                return;
            } else {
                bsDebug(port, 'closePreviousCoupons - WORK');
            }
            let removeStakes = function () {
                let closeOne = function () {
                    let $closes = $('div.coupon button.c-bet-box__del');
                    if ($closes.length > 0) {
                        mouseChain({target: $closes[0], events: ['click'], scroll: true})
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
                let $clearBtn = $('#clearAllBetsBlock');
                if ($clearBtn.length === 1) {
                    mouseChain({target: $clearBtn[0], events: ['click'], scroll: true, scrollTop: true})
                        .then(delayFunction(1000))
                        .then(() => {
                            bsDebug(port, 'ClearBtn clicked!');
                            onSuccess('ClearBtn clicked!');
                        })
                        .catch((e) => onReject('Error till ClearBtn click: ' + e));
                } else {
                    closeOne();
                }
            };
            removeStakes();
        });
    };
    /**
     * Open event
     * @param data
     * @returns {Promise<string>}
     */
    const openEvent = async data => {
        dLog('red', '1X', ['openEvent', data]);
        const eventName = `${data.team1} — ${data.team2}`.toLowerCase();
        const sport = accordance[data.sport];
        const checkWeAreThere = function () {
            //bsDebug(port, 'checkWeAreThere');

            if (!!data.direct_link) {
                return document.location.href.indexOf(data.direct_link) > -1;
            }

            let $teams = [];

            if (data.type === 'LIVE') {
                $teams = data.sport === 'TABLETENNIS' ? $('span.db-sport__team-name')
                    : data.sport === 'CYBERSPORT' ? $(['div.c-team__name', 'div[class$="_tablo-team"] div.name'].find(s => $(s).length === 2))
                        : data.sport === 'BASEBALL' ? $('div.scoreboard__team-name')
                            : $('div.c-tablo__team');
            } else {
                $teams = data.sport === 'FOOTBALL' ? $('div.c-scoreboard-team__name') : $('div.scoreboard-line__name');
            }

            if ($teams.length === 2) {
                let checkEvent;
                if (data.sport !== 'TABLETENNIS') {
                    checkEvent = $teams.eq(0).trt() + ' — ' + $teams.eq(1).trt();
                } else {
                    checkEvent = $teams.eq(0).text().replace(/\(.*?\)/, '').trim()
                        + ' — ' + $teams.eq(1).text().replace(/\(.*?\)/, '').trim();
                }
                //console.log(`${checkEvent} & ${eventName} = ${locutus_similar_text(checkEvent, eventName, true)}%`);
                return checkEvent.toLowerCase() === eventName || locutus_similar_text(checkEvent, eventName, true) > 60;
            } else {
                return false;
            }
        };
        const findSubLeague = async leagueIn => {
            const mainLeague = leagueIn.split('.')[0].trim();
            const $leagues = () => $('ul.subcategory-menu li a');
            await waitForCondition(() => $leagues().length > 0, 333, 30000, 'Leagues');
            await delayPromise(1000);
            let $mainEl = $([]);
            let $subEl = $([]);
            $leagues().each(function () {
                let $this = $(this);
                let current = $this.find('span.link-title__label').trt();
                console.log(`'${mainLeague}' === '${current}'`);
                if (locutus_similar_text(mainLeague, current, true) > 95) {
                    $mainEl = $this;
                    return false;
                }
            });
            if ($mainEl.length === 1) {
                // expand main league
                await mouseChain({target: $mainEl[0], events: fullClick, scroll: true, error: 'MAIN LEAGUE'});
                await delayPromise(2222);
                $mainEl.closest('li').find('ul.liga_menu li a').each(function () {
                    let $this = $(this);
                    let current = $this.find('span.link-title__label').trt();
                    console.log(`'${leagueIn}' === '${current}'`);
                    if (locutus_similar_text(leagueIn, current, true) > 95) {
                        $subEl = $this;
                        return false;
                    }
                });
                if ($subEl.length === 1) {
                    await mouseChain({target: $subEl[0], events: fullClick, scroll: true, error: 'SUB LEAGUE'});
                    return 'We have to be switched!';
                } else {
                    throw 'Subleague not found!';
                }
            } else {
                throw 'Main league not found!';
            }
        }
        const switchToLeague = async leagueIn => {
            const $leagues = () => $('ul.liga_menu li a');
            await waitForCondition(() => $leagues().length > 0, 333, 30000,
                'Leagues');
            await $('ul.subcategory-menu>li[class=""]').eachAsync(async function () {
                await mouseChain({
                    target: $(this)
                        .find('span.link__arrow.link-arrow')[0], events: fullClick, scroll: true,
                    error: 'Cant expand league'
                });
                await delayPromise(25);
            });
            let leagues = [leagueIn];
            for (const c of countries) {
                if (leagueIn.indexOf(c + '.') === 0) {
                    leagues.push(leagueIn.replace(c + '.', '').trim());
                    bsDebug(port, `'${leagueIn}' changed to '${leagues}'`);
                    break;
                }
            }
            dLog('red', '1X', `switchToLeague: ${leagueIn}/${leagues}`);
            await delayPromise(100);
            let $el = $([]);
            $leagues().each(function () {
                let $this = $(this);
                let current = $this.find('span.link-title__label').trt();
                console.log(`'${leagues.join("', '")}' === '${current}'`);
                if (leagues.indexOf(current) > -1) {
                    $el = $this;
                    return false;
                }
            });
            if ($el.length === 1) {
                await mouseChain({target: $el[0], events: ['click'], scroll: true, error: `LEAGUE ${version}`});
                return 'We have to be switched!';
            } else {
                await findSubLeague(data.league);
            }
        };
        const switchToSport = async () => {
            dLog('red', '1X', `switchToSport: ${sport}`);
            const $getSport = () => {
                const $football2 = $(`ul.sport_menu li a span:textEquals("${sport}")`);
                const $football1 = $('#betsResizeFils1live');
                version = $football2.length > 0 ? 2 : 1;
                return version === 2 ? $football2.first() : $football1;
            };
            await waitForElement('div.owl-stage-outer:visible:first', 333, 7777);
            await waitForCondition(() => $getSport().length > 0, 333, 20000, `No ${data.sport} :(`);
            const $sport = $getSport();
            const active = version === 2
                ? $sport.closest('a').hasClass('sportMenuActive')
                : $sport.is(':checked');
            if (!active) {
                const $target = () => version === 2 ? $sport.closest('a') : $sport.next();
                await waitForCondition(() => $target().length > 0, 333, 10000, 'No football label!');
                await mouseChain({
                    target: $target()[0],
                    events: fullClick,
                    error: `switchToSport ${version}`,
                    scroll: true
                });
                await delayPromise(1000);
            }
        };
        const checkScore = async () => {
            if (data.score === '' || data.sport !== 'FOOTBALL' || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                return '';
            }
            const getScore = () => {
                const $scores = $('div.c-tablo__main-count div.c-tablo-count__num');
                return $scores.eq(0).trt() + ':' + $scores.eq(1).trt();
            };
            await waitForCondition(() => getScore() !== '', 700, 10000, 'No score');
            if (getScore() !== data.score.replace(/[^\d:]/g, '').trim()) {
                throw getScore();
            }
            return '';
        };
        if (checkWeAreThere()) {
            if (!!data.direct_link) {
                // hint: we need wait for teams
                await waitForCondition(() => getTeams(data).length === 2, 50,
                    10000, 'NO TEAMS DIRECT LINK');
            }
            return 'We probably on event page!'
        }
        if (!!data.direct_link) {
            let goTo = '';
            if (data.direct_link.indexOf('https://') === -1) {
                goTo = document.location.origin
                    + (data.direct_link.substring(0, 1) === '/' ? '' : '/') + data.direct_link;
            } else {
                goTo = data.direct_link;
            }
            document.location.href = goTo;
            await delayPromise(20000);
            return "We used direct_link!";
        }
        await switchToSport();
        await delayPromise(1700);
        await switchToLeague(data.league);
        await delayPromise(3000);
        let $el = $([]);
        $('a.c-events__name').each(function () {
            let checkEvent = $(this).find('span.c-events__teams')
                .attr('title').trim().toLowerCase();
            const res = checkEvent === eventName
                || locutus_similar_text(checkEvent, eventName, true) > 70;
            dLog('color: darkgray;', '1xS', `"${checkEvent}" ${(res ? '==' : '!=')} "${eventName}"`);
            if (res) {
                $el = $(this);
                return false;
            }
        });
        if ($el.length === 1) {
            await mouseChain({target: $el[0], events: fullClick, scroll: true, error: 'EVENT'});
        } else {
            throw 'Wrong length of Event: ' + $el.length;
        }
        await waitForCondition(() => checkWeAreThere(), 777, 30000, 'We are not on event!');
        const score = await checkScore().catch(e => `SCORE_CHANGED => we need ${data.score}, we have ${e}`);
        if (score.indexOf('SCORE_CHANGED') > -1) {
            throw score;
        }
        return 'Switched to event!';
    };

    /**
     * Opens coupon with stake (stakes)
     * @param {object[]} paramData - array of bets to open
     * @returns {Promise<Object>}
     */
    const openCoupon = async paramData => {
        dLog('green', '1x', ['openCoupon, paramData:', paramData]);
        const pathArray = document.location.pathname.split('/');
        if (!paramData[0].direct_link) {
            if (paramData[0].type === 'PREMATCH' && document.location.href.indexOf('/line/') === -1) {
                await mouseChain({target: $('#line_href')[0], events: fullClick, error: 'GoToBets'});
                await delayPromise(getRandomRounded(1000, 2000));
            } else if (paramData[0].type === 'LIVE' && document.location.href.indexOf('/live/') === -1) {
                await mouseChain({target: $('#live_href')[0], events: fullClick, error: 'GoToLive'});
                await delayPromise(getRandomRounded(1000, 2000));
            } else if (pathArray.length > 4) {
                if (paramData[0].type === 'PREMATCH') {
                    await mouseChain({target: $('#line_href')[0], events: fullClick, error: 'GoToBets'});
                    await delayPromise(getRandomRounded(1000, 2000));
                } else {
                    await mouseChain({target: $('#live_href')[0], events: fullClick, error: 'GoToLive'});
                    await delayPromise(getRandomRounded(1000, 2000));
                }
            }
        }
        const start = ourCommand.getAdded('express') !== false ? parseInt(ourCommand.getAdded('express')) : 0;
        for (let i = start; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', '1x', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', '1x', 'Event must be opened!');
            const $element = await getBetElement(data);
            let coefWeWaitFor = $element.trt();
            dLog('green', '1x', 'We got element! Coef: ' + coefWeWaitFor);
            $element[0].scrollIntoView();
            if (!elementIsVisible($element[0])) {
                window.scrollBy(0, -110);
            }
            const waitForCouponVisibleStarted = Date.now();
            let elementWasClicked = 0;
            let performElementClick = async function () {
                dLog('green', '1x', 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                    + ') /' + (Date.now() - elementWasClicked));
                await mouseChain({target: $element.parent()[0], events: ['click'], error: 'performElementClick'})
                elementWasClicked = Date.now();
            };
            let checkCoupon = function () {
                let event = (data.team1 + ' - ' + data.team2).toLowerCase();
                let result = false;
                $('div.coupon div.o-bet-box-list__item').each(function () {
                    let $teams = $(this).find('span.c-bet-box__label');
                    if ($teams.length > 0) {
                        let ev;
                        if (data.sport.indexOf('TENNIS') > -1) {
                            ev = $teams.trt();
                        } else {
                            ev = $teams.eq(0).trt() + ' - ' + $teams.eq(1).trt();
                        }
                        ev = ev.toLowerCase();
                        if (event === ev || locutus_similar_text(event, ev, true) > 60) {
                            result = true;
                            return false;
                        } else {
                            dLog('red', '1X', `'${ev}' !== '${event}'`);
                        }
                    }
                });
                return result;
            };
            while (!checkCoupon() && Date.now() - waitForCouponVisibleStarted < 15000) {
                await performElementClick();
                await delayPromise(1000);
            }
            if (!checkCoupon()) {
                throw `Coupon not opened!`;
            }
            let getMaxHere = function () {
                if (!!settings.buyer?.secret) {
                    return 'BUYER';
                }
                //bsDebug(port, 'getMaxHere: ' + isExpress);
                if (data && data.doNotOpen) {
                    return {success: true, max: 1000050000};
                }
                let max = parseFloat($('div.coupon-grid__row span.coupon__text:textEquals("Максимальная ставка")').next().trt().replace(/\s/g, '').trim()
                    .replace(/[^\d.]/g, '').trim());
                if (!isNaN(max) && max > 0) {
                    return {success: true, max: Math.round(max * 1000) / 1000};
                } else {
                    return {
                        success: false,
                        max: `${(zeroMaxes >= 5 ? 'MAXIMUM_0 ' : 'LIMITED ')}Max is NaN or 0!`
                    };
                }
            };
            if (paramData.length > 1) {
                dLog('red', '1X', `Express here! ${i}/${(paramData.length - 1)}`);
                ourCommand.add('express', ourCommand.getAdded('express') + 1);
                if (i === paramData.length - 1) {
                    return getMaxHere(true);
                }
            } else {
                return getMaxHere(false);
            }
        }
    };

    /**
     * Get balance of account
     * @param returnNull
     * @returns {number|*}
     */
    function getBalance(returnNull) {
        const $b = $('p.top-b-acc__amount').first();
        if ($b.length > 0) {
            const bText = $b.trt();
            return parseFloat(bText.replace(',', '').replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    }

    /**
     * Do authorization
     */
    const authCheck = function () {
        //console.log('%c authCheck', 'background: red; color: white;');
        (async () => {
            const
                $logLink = $('div.curloginDropTop'),
                $video = $('div.drag.other_s_zone'),
                $popup = $('div.lucky-popup__close'),
                $phone = $('#phone_middle'),
                $code = $('#input_otp'),
                $lang = $('div.langDropTop_con span.name:visible'),
                $accActivation = $('a.account-activation__but:visible'),
                $letterSent = $('div.swal2-actions button:contains("ОК")');

            // Hint: let's check language!
            if ($lang.length > 0) {
                if ($lang.trt() !== 'ru') {
                    await mouseChain({target: $('div.langDropTop_con span.name')[0], events: fullClick});
                    await waitDelayClickF('a[data-flaglng="ru"]')();
                    await delayPromise(2555);
                }
            }
            if (!!settings.buyer?.secret) {
                setBusy(busy);
                port.postMessage({
                    m: "authorized!",
                    balance: 100,
                });
            } else {
                if ($logLink.length > 0) {
                    // Hint: Log In
                    port.postMessage({m: "tech works! 2"});
                    await delayPromise(1000);
                    if (authorizationAttempt < 3) {
                        await tryToLogIn().catch(e => bsError(port, 'Error login: ' + e));
                    }
                } else if ($accActivation.length > 0) {
                    await mouseChain({target: $accActivation[0], events: fullClick, error: '$accActivation'});
                } else if ($letterSent.length > 0) {
                    await mouseChain({target: $letterSent[0], events: fullClick, error: '$letterSent'});
                } else if ($video.length > 0) {
                    $video.remove();
                } else if ($popup.length > 0) {
                    await mouseChain({target: $popup[0], events: ['click'], error: 'ppp'});
                } else if ($phone.length > 0 && phoneTry < 1) {
                    phoneTry++;
                    const existEnd = $phone.parent().parent().find('span.block-window__code_end').trt();
                    const ph = settings.login.replace('+', '').replace(/^7/, '');
                    await clearAndSimulate($phone[0], ph.substr(0, ph.length - existEnd.length), true, true, true, true);
                    await delayPromise(1500);
                    await mouseChain({target: $('button.block-window__btn')[0], events: fullClick, error: 'sb'});
                    await delayPromise(1000);
                } else if ($code.length > 0 && codeTry < 1) {
                    codeTry++;
                    setBusy(true);
                    port.postMessage({
                        answered: "CONFIRMATION",
                        status: "SUCCESS",
                        data: settings.login,
                    });
                    smsDelay = Date.now();
                    confirmSent = true;
                } else if (confirmSent && !hasSMS) {
                    if (Date.now() - smsDelay > 600000) {
                        confirmSent = false;
                        port.postMessage({
                            answered: "CONFIRMATION",
                            status: "FAILED",
                            data: ''
                        });
                        setBusy(false);
                        throw 'SMS timeout expired!';
                    }
                } else {
                    setBusy(busy);
                    port.postMessage({
                        m: "authorized!",
                        balance: getBalance(true),
                    });
                }
            }
        })()
            .catch(e => console.log(`authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const tryToLogIn = async () => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        const $logLink = $('div.curloginDropTop');
        if ($logLink.length !== 1) {
            throw 'No $logLink!';
        }
        if ($('form.auth__form:visible').length === 0) {
            await mouseChain({target: $logLink[0], events: fullClick, scroll: true});
            await delayPromise(2222);
            await waitForElement('form.auth__form:visible', 333, 15000);
        }

        const loginArr = settings.login.split('');

        if (loginArr.length > 2 && loginArr[0] === '+' && loginArr[1] === '7') {
            settings.login = settings.login.replace('+7', '');
            if ($('input[id^="auth_phone_number"]').length === 0) {
                await mouseChain({target: $('button.custom-functional-button')[0], events: fullClick});
                await delayPromise(1222);
            }
        } else {
            if ($('#auth_id_email:visible').length === 0) {
                await mouseChain({target: $('button.custom-functional-button')[0], events: fullClick});
                await delayPromise(1222);
            }
        }

        let lSels = ['#userLogin', 'input[placeholder="Ваш E-mail или ID"]:visible', '#auth_id_email:visible', 'input[id^="auth_phone_number"]'];
        const pSels = ['#userPassword', 'input[placeholder="Пароль"]:visible', '#auth-form-password:visible', '#auth-form-password:visible'];
        const eSels = ['#userConButton', 'a.enter_button_main:visible', 'button.auth-button:visible', 'button.auth-button:visible'];
        authClicked = Date.now();

        await waitForCondition(() => lSels.some(s => $(s).length > 0), 333, 10000, 'No inputs!');
        let sType = lSels.findIndex(s => $(s).length > 0);
        bsDebug(port, `tryToLogIn: use sType ${sType}`);

        await clearAndSimulate($(lSels[sType])[0], settings.login, true, true, true, true);
        await delayPromise(3000);
        await mouseChain({target: $(pSels[sType])[0], events: fullClick});
        await delayPromise(200);
        await clearAndSimulate($(pSels[sType])[0], settings.password);
        await delayPromise(3000);
        const $remember = sType === 0 ? $('label[for="chSaveMe"]') : $('label[for="remember_user"]');
        if ($remember.length > 0 && !$remember.prop('checked')) {
            await mouseChain({target: $remember[0], events: fullClick});
            await delayPromise(3000);
        }
        await mouseChain({target: $(eSels[sType])[0], events: fullClick});
        await delayPromise(1500);
        authorizationAttempt++;

        let $wrongLoginButton = $([]);
        const delayTime = 10;

        for (let step = 0; step < delayTime; step++) {
            if ($('div#swal2-content:textEquals("Неверный логин или пароль!")').length > 0) {
                $wrongLoginButton = $('button.swal2-cancel:contains("Закрыть")');
                break;
            }
            await delayPromise(888);
        }

        if ($wrongLoginButton.length > 0) {
            await mouseChain({target: $wrongLoginButton[0], events: fullClick});
            await delayPromise(1222);
        }

        if (authorizationAttempt > 2) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            throw 'Wrong login or password!';
        }

        const $errorMessage = await waitForElement('div#swal2-content:contains("Неверный логин или пароль!")',
            333, 4888).catch(() => $([]));
        const $ac = () => $('div.antigate_solver a.status').last().trt();
        if ($ac.length > 0) {
            dLog('bigred', '1X', `Wait for anticaptcha!`);
            await waitForCondition(() => {
                let aStatus = $ac();
                if (aStatus === 'Solved') {
                    return true;
                } else if (aStatus.indexOf('Outdated') > -1) {
                    mouseChain({target: $('a.control.reload')[0], events: ['click']})
                        .then().catch();
                    return false;
                } else {
                    return false;
                }
            }, 333, 100000, 'Anticaptcha not solved!');
        }

        authClicked = Date.now();
        bsDebug(port, 'Auth clicked!');
        return "auth_clicked";
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess('ONEXBET_COMMAND', true).set(ourCommand.get(),
                increaseDelay || window.location.href.indexOf('pay.1cupis.ru') > -1 ? 130000 : 0);
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});
        bMess('ONEXBET_COMMAND', true).check(40000, true)
            .then(currentCommand => {
                dLog('orange', '1X', [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`, currentCommand]);
                messageProcessor(currentCommand);
            })
            .catch(() => dLog('color: darkgray;', '1X', 'No command!'));
        if (document.location.href.indexOf('/account/') > -1) {
            waitForElement('#office_account_save_profile div.grecaptcha-badge', 333, 10000)
                .then($el => {
                    const langSel = findSel(['div.langDropTop_con span.name:visible',
                        'div[data-modal="langsModal"] span.top-b__lang']);
                    if ($(langSel).trt() !== 'en') {
                        $el.remove();
                        dLog('red', '1XS', 'RC 1 removed');
                    }
                })
                .catch(() => {
                });
            waitForElement('iframe[title="проверка recaptcha"]', 333, 10000)
                .then($el => {
                    const langSel = findSel(['div.langDropTop_con span.name:visible',
                        'div[data-modal="langsModal"] span.top-b__lang']);
                    if ($(langSel).trt() !== 'en') {
                        $el.eq(0).remove();
                        dLog('red', '1XS', 'RC 2 removed');
                    }
                })
                .catch(() => {
                });
        }
    }

})();
