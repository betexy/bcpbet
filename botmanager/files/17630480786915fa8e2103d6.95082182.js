(function () {

    "use strict";

    /**
     * @import libs/jquery-3.3.1.min.js
     */
    let authClicked = 0;
    let busy = false;
    let increaseDelay = false;
    let stopSports = false;
    let enterError = false;

    let codeTry = 0;
    let confirmSent = false;
    let smsDelay = 0;
    let hasSMS = false;
    let sourceExpress = false;
    let waitSource = false;

    const bkHere = window.location.href.indexOf('pin-up.kz') > -1
        ? 'pinupcupis' : window.location.href.indexOf('pinup') > -1
            ? 'pinup' : window.location.href.indexOf('betboom.com') > -1
                ? 'betboomcom' : window.location.href.indexOf('ubet.kz') > -1
                    ? 'ubet' : 'betboom';
    const port = window.self === window.top ? chrome.runtime.connect({name: `port_${bkHere}`}) : {postMessage: () => console.log(arguments)};

    const settings = {
        authCheckInterval: 2000,
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        url: '',
        login: '',
        password: '',
        phone: '',
        email: '',
        uid: '',
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 3,
        betweenBets: 25000,
        newExpresses: true,
        source: {
            X: 398,
            Y: 396,
            Z: 397,
        },
        sourceRandom: 0,
        sourceDate: 0,
    };

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

    const accordance = {
        'FOOTBALL': 'Футбол',
        'HOCKEY': 'Хоккей',
        'VOLLEYBALL': 'Волейбол',
        'TENNIS': 'Теннис',
        'TABLETENNIS': 'Настольный теннис',
        'BASEBALL': 'Бейсбол',
        'BASKETBALL': 'Баскетбол',
        'CYBERSPORT': 'Киберспорт',
    };

    const logLinkSels = ['a[href="/#login"]', '#auth_registration', '#login', 'a[data-at="header-auth-btn"]', 'button.login', 'button[class*="Header__EnterButton-sc-"]:textEquals("Вход")', 'button#auth',];

    const ourCommand = new ourCommandProto();
    const smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);
    const $coupons = () => $('div[data-card="true"]');

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

    const getBalance = returnNull => {
        const $b = $(findSel(['span.amount', 'div.player_balance:visible', 'span[class^="Amount_amount_"]', 'span.money-value', 'p[class*="DesktopBalance__BalanceAmount-sc-"]', 'span[class*="balance_value_"]']));
        if ($b.length > 0) {
            return parseFloat($b.text().replace(',', '')
                .replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    };

    const closeBonusBanner = async () => {
        if ($('div.control-checkbox label:textEquals("Больше не показывать"):visible').length > 0) {
            if ($('div.control-checkbox input#notShowHintSportFreebet:checked').length === 0) {
                await mouseChain({
                    target: $('div.control-checkbox input#notShowHintSportFreebet')[0],
                    events: fullClick,
                    error: 'notShowHintSportFreebet clicked'
                });
                await delayPromise(1222);
                await mouseChain({
                    target: $('a.pop-up__close:visible')[0], events: fullClick, error: 'notShowHintSportFreebet clicked'
                });
                await delayPromise(888);
            }
        }
    };

    const switchLanguageRU = async () => {
        if (bkHere === 'betboomcom') {
            if ($('div[class^="HeaderRight_localeDropdown"] div[data-at="locale-select"] span[class^="Dropdown_value"]:textEquals("RU")').length === 0) {
                await mouseChain({
                    target: $('div[class^="HeaderRight_localeDropdown"] div[data-at="locale-select"] span[class^="Dropdown_value"]')[0],
                    events: fullClick
                });
                await delayPromise(2222);
                await mouseChain({
                    target: $('div[class^="HeaderRight_localeDropdown"] div[class*="Dropdown_list_"] span[class^="Dropdown_listTitle_"]:textEquals("RU")')[0],
                    events: fullClick,
                    error: 'rulang'
                });
                await delayPromise(333);
            }
        } else if (bkHere === 'pinup') {
            if ($('div.header__bottom div.language-select-current[data-language="ru"]').length === 0) {
                await mouseChain({target: $('div.header__bottom div.language-select-current')[0], events: fullClick});
                await delayPromise(2222);
                await mouseChain({
                    target: $('div.header__bottom div.language-select-list_item[data-language="ru"]:visible')[0],
                    events: fullClick,
                    error: 'rulang'
                });
            }
        }
        await delayPromise(111);
    };

    const authCheck = function () {
        if (enterError === true) {
            port.postMessage({
                answered: "auth_error", status: "ERROR",
            });
            bsError(port, 'ERROR AUTH!');
            return;
        }

        (async () => {
            await closeAllWeNeed({
                'div.splash__fullscreen a': 'div.splash__fullscreen a',
                'div.js-rbk-popup a.pop-up__close': 'div.js-rbk-popup a.pop-up__close',
                'div#popupPlace span.popUp_bonusV1-close': 'div#popupPlace span.popUp_bonusV1-close',
                'a:textEquals("Перейти к идентификации")': 'a:textEquals("Перейти к идентификации")',
                'a:textEquals("Перейти к ставкам")': 'a:textEquals("Перейти к ставкам")',
                'button[form="authRegForm"]': 'button[form="authRegForm"]',
                'button[class*="Sidebar_topButtonClose_"]': 'button[class*="Sidebar_topButtonClose_"]',
                'div[class^="UserFormNotification_wrapper_"] button[class^="CloseButton_closeButton_"]': 'div[class^="UserFormNotification_wrapper_"] button[class^="CloseButton_closeButton_"]',
                'button[class^="CookiePoliticMsg_cookieBtn_"]': 'button[class^="CookiePoliticMsg_cookieBtn_"]',
                'span.popup__header-close': 'span.popup__header-close',
                'div[class^="CookieConsentPopup__PopupCookie"] button': 'div[class^="CookieConsentPopup__PopupCookie"] button',
            });
            await closeBonusBanner();
            //close upload page popup if exist
            if ($('button.tg__modal_confirm:textEquals("OK")').length > 0) {
                await mouseChain({target: $('button.tg__modal_confirm:textEquals("OK")')[0], events: fullClick});
                await delayPromise(1000);
                window.location.reload();
            }
            await switchLanguageRU();
            const $logLink = $(findSel(logLinkSels));
            const $code = await waitForElement('form.popup-form--reg p:textEquals("Введите код из SMS")', 333, 5555).catch(() => $([]));

            if ($code.length > 0 && codeTry < 1) {
                codeTry++;
                busy = true;
                port.postMessage({
                    answered: "CONFIRMATION", status: "SUCCESS", data: settings.login,
                });
                smsDelay = Date.now();
                confirmSent = true;
            } else if (confirmSent && !hasSMS) {
                if (Date.now() - smsDelay > 600000) {
                    confirmSent = false;
                    port.postMessage({
                        answered: "CONFIRMATION", status: "FAILED", data: ''
                    });
                    busy = false;
                    throw 'SMS timeout expired!';
                }
            } else if ($logLink.length > 0 && $code.length === 0) {
                busy = true;
                // Hint: Log In
                port.postMessage({m: "tech works! 2"});
                await delayPromise(1000);
                await tryToLogIn()
                    .then(() => busy = false)
                    .catch(e => bsError(port, 'Error login: ' + e));
            } else {
                port.postMessage({
                    m: "authorized!", balance: getBalance(true),
                });

                if (settings.lastScoreBasketball === '999') {
                    if (Date.now() - settings.sourceDate >= 300000) {
                        settings.sourceDate = Date.now();
                        settings.sourceRandom = getSourceRandom();
                        // if (settings.sourceRandom >= 18 && settings.sourceRandom <= 19) {
                        //     settings.newExpresses = true;
                        //     if (settings.sourceRandom >= 18 && settings.sourceRandom <= 19) {
                        //         settings.newExpressBetsAmount = 1;
                        //     }
                        // } else {
                        //     waitSource = false;
                        //     settings.newExpresses = false;
                        // }

                        dLog('blue', 'BB', `Source current random value - ${settings.sourceRandom}`);
                    }
                }

                if (settings.newExpresses && !busy) {
                    busy = true;
                    const WasSuccessExpressNew = await bMess('WasSuccessExpressNew').infinite().catch(() => 0);
                    if (WasSuccessExpressNew && $coupons().length === 0) {
                        await bMess('WasSuccessExpressNew').remove();
                    }
                    if (!WasSuccessExpressNew && $coupons().length === 0) {
                        dLog('yellow', 'BB',
                            `Before start findExpressNew: ${WasSuccessExpressNew}/${$coupons().length}/${busy}`);
                        await findExpressNew().catch(() => bMess('WasSuccessExpressNew').set(false).finally());
                        dLog('yellow', 'BB', `We returned from findExpressNew`)
                    }
                    busy = false;
                }
            }
        })()
            .catch(e => dLog('red', 'BB', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const tryToLogIn = async () => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        const validateEmail = (email) => {
            return email.match(/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
        };
        const $buttonLogin = $('button[class*="Header__EnterButton-sc-"]:textEquals("Вход")');
        const $offLogin = $('#login');
        if ($offLogin.length > 0) {
            await delayPromise(1000);
            await clearAndSimulate($('#header_auth_login')[0], settings.login.replace('+', '')
                .replace(/^7/, ''));
            await delayPromise(3000);
            await clearAndSimulate($('#header_auth_password')[0], settings.password);
            await delayPromise(3000);
            authClicked = Date.now();
            await mouseChain({target: $offLogin[0], events: fullClick, error: '$offLogin'});
        } else if ($buttonLogin.length > 0) {
            const loginSel = 'div[type="auth"] button:textEquals("Вход")', phoneSel = 'input[name="phone"]:visible',
                passSel = 'input[name="password"]:visible', enterSel = 'div[type="auth"] button:textEquals("Войти")';
            if ($(loginSel).length === 0) {
                await mouseChain({target: $buttonLogin[0], events: fullClick, error: '$buttonLogin'});
                await delayPromise(555);
                await waitForElement(loginSel, 333, 4444);
            }
            await delayPromise(555);
            if (settings.login.replace(/\D/g, '') !== $(phoneSel).val().replace(/\D/g, '')) {
                await clearAndSimulate($(phoneSel)[0], settings.login.replace('+', '')
                    .replace(/^7/, ''));
                await delayPromise(1555);
            }
            if ($(passSel).val() !== settings.password) {
                await dType($(passSel)[0], '', false, 50);
                await delayPromise(1111);
                await clearAndSimulateD($(passSel)[0], settings.password);
                await delayPromise(1555);
            }
            if ($(enterSel).prop('disabled') === true) {
                enterError = true;
            }
            authClicked = Date.now();
            await dClick($(enterSel)[0]);
            await delayPromise(5555);
            const $balance = await waitForElement('p[class*="DesktopBalance__BalanceAmount"]', 333, 15000)
                .catch(() => $([]));
            if ($balance.length === 0) {
                enterError = true;
            }
        } else if ($(findSel(['a[href="/#login"]', '#auth_registration', 'button#auth'])).length > 0) {
            const $logLink = $(findSel(['a[href="/#login"]', '#auth_registration', 'button#auth']));
            if ($logLink.length !== 1) {
                throw 'No $logLink!';
            }
            const sels = bkHere === 'pinupcupis' ? ['#input-auth__phone-email', '#input-auth__password', 'button#auth_enter'] : ['#login_input', '#log_pass_input', 'button[type="submit"]:contains("Войти")'];
            await mouseChain({target: $logLink[0], events: fullClick, scroll: true});
            if (bkHere.indexOf('pinup') > -1 && bkHere !== 'pinupcupis') {
                return await tryToLogInPin();
            }
            await waitForCondition(() => sels.every(s => $(s).length > 0 && elementIsVisible($(s)[0])), 333, 10000, 'No inputs!');
            await delayPromise(5000);
            await clearAndSimulate($(sels[0])[0], settings.login.replace('+', '')
                .replace(/^7/, ''));
            await delayPromise(2000);
            await clearAndSimulate($(sels[1])[0], settings.password);
            await delayPromise(3000);
            authClicked = Date.now();
            await mouseChain({target: $(sels[2])[0], events: fullClick, error: 'Enter'});
            await delayPromise(555);
            const $errorMessage = bkHere === 'pinupcupis' ? await waitForCondition(() => $('div.notice--alert').hasClass('notice--hidden'), 333, 4444, 'submit error').catch(() => $([])) : await waitForElement('form[action="/auth/login"] span.control__error:visible', 333, 4444).catch(() => $([]));
            if ($errorMessage.length > 0) {
                enterError = true;
            }
        } else {
            const $logLink = $('a[data-at="header-auth-btn"]');
            if ($logLink.length !== 1) {
                throw 'No auth link!';
            }
            await mouseChain({target: $logLink[0], events: fullClick});
            await delayPromise(555);
            const headerText = bkHere === 'betboom' ? 'div[class^="_auth-reg_headerTitle_"]:textEquals("Авторизация")' : 'div[class^="form_headerTitle_"]:textEquals("Авторизация")';
            await waitForElement(headerText, 333, 8888);
            let authType = 'phone';
            if (validateEmail(settings.login) !== null) {
                authType = 'email';
                await mouseChain({target: $('div[data-at="tab-auth-email"]')[0], events: fullClick});
            } else {
                await mouseChain({target: $('div[data-at="tab-auth-phone"]')[0], events: fullClick});
            }

            await delayPromise(2222);
            await clearAndSimulate($('input[name="password"]')[0], settings.password);
            await delayPromise(1555);

            if (authType === 'phone') {
                await clearAndSimulate($('input[name="phone"]')[0], settings.login.replace('+', ''));
            } else {
                await clearAndInputEmail($('input[name="email"]')[0], settings.login);
            }
            await delayPromise(1555);
            const submitButton = bkHere === 'betboom' ? 'button[class^="_auth-reg_sumbitButton_"]' : 'button[class^="form_submitButton_"]';
            await mouseChain({target: $(submitButton)[0], events: fullClick});
            await delayPromise(555);
            authClicked = Date.now();
            const $errorMessage = await waitForElement('div[class^="FormError_error_"]', 333, 3555).catch(() => $([]));
            if ($errorMessage.length > 0) {
                enterError = true;
            }
        }
        dLog('', 'BB', 'Auth clicked!');
        return "auth_clicked";
    };

    const tryToLogInPin = async () => {
        const $phone = await waitForElement('#popup_reg_auth_inputPhone', 333, 15000);
        await clearAndSimulate($phone[0], settings.login.replace('+', '').replace(/^7/, ''));
        await delayPromise(1555);
    };

    const closePreviousCoupons = async (clear) => {
        const $delBtns = () => $('div[data-card="true"] button[data-delete-btn="true"]');
        const clearAll = async () => {
            const $closeAll = () => $('button:has(span:textEquals("Удалить все..."))');
            if ($closeAll().length > 0) {
                await mouseChain({
                    target: $closeAll()[0], events: fullClick, scroll: true, error: 'c1'
                });
                await delayPromise(777);
                const $confirm = await waitForElement('button:has(span:textEquals("Удалить"))',
                    333, 10000).catch(() => $([]));
                if ($confirm.length > 0) {
                    await mouseChain({
                        target: $confirm[0], events: fullClick, scroll: true, error: 'cfr'
                    });
                    await delayPromise(777);
                }
            } else {
                const $delBtn = $delBtns().eq(0);
                if ($delBtn.length > 0) {
                    await mouseChain({
                        target: $delBtn[0], events: fullClick, scroll: true, error: 'delBtn'
                    });
                    await delayPromise(777);
                }
            }
        }

        if (settings.newExpresses) {
            if (clear) {
                await clearAll();
            } else {
                for (let i = 0; i < $delBtns().length; i++) {
                    if ($delBtns().length > settings.newExpressBetsAmount) {
                        await mouseChain({
                            target: $delBtns().eq(i)[0], events: fullClick, error: 'closeCoupon'
                        });
                        await delayPromise(999);
                    }
                }
            }
        } else {
            await clearAll();
        }

        return 'All were closed!';
    };

    const getTeams = (prematch) => {
        const findFirstText = ($root) => {
            let i = 0;
            do {
                $root = $root.find('> div');
                const skipFirst = prematch && i === 0;
                console.log($root, skipFirst);
                if (!skipFirst && $root.first().find('img').length > 0) {
                    $root = $root.first().next();
                } else {
                    $root = $root.first();
                }
                console.log($root, $root.find('div').length);
                i++;
            } while ($root.length > 0 && $root.find('div').length > 0);
            return $root.trt();
        };
        let teams = [];
        const $main = $('main:last');
        if ($main.length === 0 || $main.attr('class').indexOf('BaseLayout') > -1) {
            console.log('Not at the event page!');
            return [];
        }
        const $scoreboard = $main.find('section:first > div > div').eq(1);
        if ($scoreboard.length === 0 || $scoreboard.text().indexOf('ЛайвВсе') > -1) {
            return [];
        }
        if (prematch) {
            const $teamsDraft = $scoreboard.find('> div > div');
            if ($teamsDraft.length < 3) {
                console.log(`Wrong length of teamsDraft - '${$teamsDraft.length}'!`);
                return [];
            }
            teams.push(findFirstText($teamsDraft.eq(0)));
            teams.push(findFirstText($teamsDraft.eq(2)));
        } else {
            const $teams = $scoreboard.find('div > div').eq(2).find(' > div');
            if ($teams.length !== 2) {
                console.log(`Wrong length of teams - '${$teams.length}'!`);
                return [];
            }
            teams.push(findFirstText($teams.eq(0)));
            teams.push(findFirstText($teams.eq(1)));
        }
        return teams;
    };

    const expandLeftMenu = async () => {
        const inputSearch = 'input[type="search"]';
        if ($(`${inputSearch}:visible`).length === 0) {
            await mouseChain({target: $(inputSearch)
                .parents()
                .eq(1)
                .children()
                .eq(1)
                .find('button')[0], events: ['click'], scroll: true, error: 'expandLeftMenu'});
            await waitForElement(`${inputSearch}:visible`, 222, 3333);
        }
    };

    const searchEvent = async (team1, team2, sport, eventName) => {
        let $el = [];
        const inputSearch = 'input[type="search"]:visible';
        const events = 'div[data-at-id="success-result-page"] a[role="link"]:empty';
        await waitForElement(inputSearch, 222, 3333);
        await clearAndSimulate($(inputSearch)[0], eventName);
        const $events = await waitForElement(events, 222, 5555).catch(() => $([]));

        if ($events.length === 0) {
            throw 'No events';
        }

        $(events).each(function (idx, el) {
            const evtHere = $(el).parent().find(`span:textEqualsI("${team1}")`).trt().toLowerCase()
                + ' - ' + $(el).parent().find(`span:textEqualsI("${team2}")`).trt().toLowerCase();
            if (
                (evtHere === eventName || locutus_similar_text(evtHere, eventName, true) > 85)
                && ($(el).next().find('span[data-at-el="tournament-title"]').trt().includes(sport))
            ) {
                $el = $(el);
                dLog('green', 'BB', ['We found it:', $el]);
                return false;
            }
        });

        return $el;
    };

    const openEvent = async data => {
        dLog('yellow', 'BB', ['openEvent', data]);
        let $el = [];
        const sport = accordance[data.sport];
        const eventName = `${data.team1} - ${data.team2}`.toLowerCase();
        const checkWeAreThere = function () {
            const teams = getTeams(data.type !== 'LIVE'),
                checkEvent = teams.length === 2 ? `${teams[0].trim()} — ${teams[1].trim()}`.toLowerCase() : '';
            return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70;
        };

        if (checkWeAreThere()) {
            return 'We probably on event page!'
        }
        dLog('green', 'BB', 'We are not on event - let\'s open it!');
        await expandLeftMenu();
        $el = await searchEvent(data.team1, data.team2, sport, eventName);

        if ($el.length === 1) {
            await mouseChain({
                target: $el[0], events: fullClick, scroll: true, error: 'EVENT'
            });
        } else {
            throw 'Wrong length of Event: ' + $el.length;
        }
        await waitForCondition(() => checkWeAreThere(), 777, 30000, 'We are not on event!');
        return 'Switched to event!';
    };

    const switchToSport = async (prematch, sport, hrs12) => {
        dLog('red', 'BB', `switchToSport: ${sport}, prematch: ${prematch}, hrs12: ${hrs12}`);
        const aSel = `a[data-at-title="${sport}"]`, $root = () => $(`div.swiper-wrapper:has(${aSel})`);
        await waitForCondition(() => $root().length > 0, 300, 5000, `There is no sport ${sport}!`);
        if ($root().find(aSel).attr('data-status') !== 'active') {
            await mouseChain({
                target: $root().find(aSel)[0], events: fullClick, error: 'Exp 1', scroll: true,
            });
            await delayPromise(1000);
        }
        const $switcher = await waitForElement(prematch && hrs12
            ? 'section div.swiper a:textEquals("12ч")'
            : `a[data-at-el="${prematch ? 'prematch' : 'live'}-filter-btn"]`, 300, 5000
        );
        if ($switcher.length === 1) {
            await mouseChain({
                target: $switcher[0], events: fullClick, error: '$switcher', scroll: true,
            });
            await delayPromise(1000);
        } else {
            throw `${sport} not found!`;
        }
    };

    const getBetElement = async data => {
        //#-#-START
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Исход',], pivotKeys: ['П1', 'П1',],
                }, 'TWO': {
                    roots: ['Исход',], pivotKeys: ['П2', 'П2', ],
                }, 'DRAW': {
                    roots: ['Исход',], pivotKeys: ['X', 'Х',],
                }, 'ONE_DRAW': {
                    roots: ['Двойной шанс'], pivotKeys: ['1X', '1Х',],
                }, 'TWO_DRAW': {
                    roots: ['Двойной шанс'], pivotKeys: ['X2', 'Х2',],
                }, 'ONE_TWO': {
                    roots: ['Двойной шанс'], pivotKeys: ['12',],
                }
            }, 'TOTAL': {
                'OVER': {
                    roots: ['Тотал', 'Азиатский Тотал',], pivotKeys: ['Больше', 'Больше (#PIVOT#)'],
                }, 'UNDER': {
                    roots: ['Тотал', 'Азиатский Тотал',], pivotKeys: ['Меньше', 'Меньше (#PIVOT#)'],
                },
            }, 'T1_TOTAL': {
                'OVER': {
                    roots: ['Тотал #TEAM1#', 'Тотал Ком.1'], pivotKeys: ['Больше', 'Больше (#PIVOT#)'],
                }, 'UNDER': {
                    roots: ['Тотал #TEAM1#', 'Тотал Ком.1'], pivotKeys: ['Меньше', 'Меньше (#PIVOT#)'],
                },
            }, 'T2_TOTAL': {
                'OVER': {
                    roots: ['Тотал #TEAM2#', 'Тотал Ком.2'], pivotKeys: ['Больше', 'Больше (#PIVOT#)'],
                }, 'UNDER': {
                    roots: ['Тотал #TEAM2#', 'Тотал Ком.2'], pivotKeys: ['Меньше', 'Меньше (#PIVOT#)'],
                },
            }, 'HDP': {
                'HOME': {
                    roots: ['Фора', 'Азиатская Фора'], pivotKeys: ['#HPIVOT#'],
                }, 'AWAY': {
                    roots: ['Фора', 'Азиатская Фора'], pivotKeys: ['#HPIVOT#'],
                }
            },
        };

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw `Unsupported ${data.time_value} / ${data.market} / ${data.target}`;
        }

        const m = markets[data.market][data.target];

        const ePivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };

        const hPivot = pvt => {
            const prfx = pvt > 0 ? '+' : pvt < 0 ? '-' : '';
            pvt = prfx + Math.abs(pvt);
            return pvt;
        };

        replaceInner(m, {
            '#TEAM1#': data.team1, '#TEAM2#': data.team2, '#PIVOT#': data.pivot, '#HPIVOT#': hPivot(data.pivot),
            '#EPIVOT#': ePivot(data.pivot),
        });

        let $ts = $('div.swiper-wrapper button:textEquals("Все")');
        if ($ts.length === 0) {
            throw `No TabSelector`;
        }

        const activeTabState = $ts.attr('aria-checked') === 'true';

        if (!activeTabState) {
            await mouseChain({target: $ts[0], events: fullClick, error: '$ts'});
            await delayPromise(1000);
        }

        let q = data.time_value.replace(/\D/g, '').trim(), ht = data.time_value.indexOf('FULL') === -1;
        if (data.sport === 'FOOTBALL' && ht) {
            if (data.type === 'LIVE') {
                if (ht) {
                    m.subroot = `${q}-й тайм`;
                } else {
                    m.subroot = `Основное время`;
                }
            } else {
                for (const i in m.roots) {
                    m.roots[i] = `${q}-й тайм: ${m.roots[i]}`;
                }
            }
        } else if (data.sport === 'BASKETBALL' && !ht) {
            for (const i in m.roots) {
                if (m.roots[i] === 'Исход') {
                    m.roots[i] = `${m.roots[i]} (включая ОТ)`;
                }
            }
        } else if (data.sport === 'BASKETBALL' && ht) {
            if (data.type === 'LIVE') {
                m.subroot = `${q}-я четверть`;
            } else {
                for (const i in m.roots) {
                    m.roots[i] = `${q}-я четверть: ${m.roots[i]}`;
                }
            }
        } else if (data.sport === 'HOCKEY' && ht) {
            if (data.type === 'LIVE') {
                m.subroot = `${q}-й период`;
            } else {
                for (const i in m.roots) {
                    m.roots[i] = `${q}-й период: ${m.roots[i]}`;
                }
            }
        } else if (data.sport === 'VOLLEYBALL' && ht) {
            if (data.type === 'LIVE') {
                m.subroot = `${q}-й сет`;
            } else {
                for (const i in m.roots) {
                    m.roots[i] = `${q}-й сет: ${m.roots[i]}`;
                }
            }
        } else if (data.sport === 'TABLETENNIS' && ht) {
            if (data.type === 'LIVE') {
                m.subroot = `${q}-й сет`;
            } else {
                for (const i in m.roots) {
                    m.roots[i] = `${q}-й сет: ${m.roots[i]}`;
                }
            }
        } else if (data.sport === 'CYBERSPORT') {
            if (data.market === 'HDP') {
                m.roots.push('Фора по картам');
            }
            if (data.market === 'TOTAL') {
                m.roots.push('Тотал раундов');
            }
            if (ht) {
                for (const i in m.roots) {
                    m.subroot = `${q}-я карта`;
                }
            }
        } else if (data.sport === 'TENNIS') {
            if (data.market === 'HDP') {
                m.roots.push('Фора по геймам');
            }
            if (data.market === 'T1_TOTAL') {
                m.roots.push('Тотал ' + data.team1);
            }
            if (data.market === 'T2_TOTAL') {
                m.roots.push('Тотал ' + data.team2);
            }
            if (ht) {
                let prefix = '';
                if (data.time_value.indexOf('_GAME_') > -1) {
                    const parts = data.time_value.split('_GAME_');
                    q = parseInt(parts[0].replace(/\D/g, ''));
                    const gm = parseInt(parts[1].replace(/\D/g, ''));
                    prefix = `${q}-й сет ${gm}-й гейм`;
                } else {
                    prefix = `${q}-й сет`;
                    q = parseInt(data.time_value.replace(/\D/g, ''));
                }
                for (const i in m.roots) {
                    m.roots[i] = `${prefix}: ${m.roots[i]}`;
                }
            }
        }

        console.log('MARKET ', m);

        let $found = $([]);
        for (const root of m.roots) {
            console.log('%c' + `Checking root: ${root}`, 'background: blue; color: white;');
            let $root = $([]);
            $('#sportApp main section > div[role="button"][data-id="trigger"] button').next().each(function () {
                const first = $(this).find('div').first().trt(), second = $(this).find('div').eq(1).trt();
                console.log(`${first} '${m.subroot || ''}' ${second}`);
                if (first === root && (!m.subroot || second === m.subroot)) {
                    $root = $(this);
                    return false;
                } else {
                    // console.log(`'${first}' === '${root}' && (!'${m.subroot}' || '${second}' === '${m.subroot}')`);
                }
            });
            if ($root.length === 0) {
                console.log('%c' + `Root not found: ${root}`, 'background: red; color: white;');
                continue;
            }
            const $betsArea = () => $root.closest('section').find('> div').eq(1);
            if ($betsArea().length === 0) {
                // it probably closed, let's try to open it
                await mouseChain({
                    target: $root.parent()[0], events: fullClick, error: '$root open', scroll: true
                });
                await delayPromise(1000);
            }
            if ($betsArea().length === 0) {
                continue;
            }
            for (const pvt of m.pivotKeys) {
                console.log(`Checking pivot: ${pvt}`);
                let $pivot = $([]);
                if (data.market.indexOf('TOTAL') !== -1) {
                    $betsArea().find(`button`).parent().each(function (idx) {
                        const $row = $(this).find(`> div:textEquals("${data.pivot}")`).parent();
                        if ($row.length !== 1) {
                            console.log(`${data.pivot} => ${$row.length}`);
                            return true;
                        }
                        $pivot = $row.find(`button div:textEquals("${pvt}")`);
                        console.log(idx, pvt, $row, $pivot);
                    });
                } else if (data.market.indexOf('HDP') !== -1) {
                    let homeIdx = -1, awayIdx = -1;
                    $betsArea().find('> div > div > div > div > div').first().find('div')
                        .each(function (idx) {
                            if ($(this).text().trim() === data.team1) {
                                homeIdx = idx;
                            } else if ($(this).text().trim() === data.team2) {
                                awayIdx = idx;
                            }
                        });
                    if (homeIdx === -1 || awayIdx === -1) {
                        throw `Could not find columns for teams: ${data.team1}:${homeIdx}, ${data.team2}:${awayIdx}`;
                    }
                    const ourIdx = (data.target === 'HOME') ? homeIdx : awayIdx;
                    $betsArea().find('> div > div > div > div > div').eq(1).find('button').parent()
                        .each(function () {
                            const $firstDiv = $(this).find('button').eq(ourIdx).find('> div').first();
                            if ($firstDiv.trt() === pvt) {
                                $pivot = $firstDiv;
                                return false;
                            }
                        });
                } else {
                    $pivot = $betsArea().find(`button div:textEquals("${pvt}")`);
                }
                if ($pivot.length === 0) {
                    continue;
                }
                if ($pivot.length === 1) {
                    $found = $pivot.parent();
                    break;
                } else if ($pivot.length > 1) {
                    throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                }
            }
            if ($found.length === 1) {
                break;
            }
        }
        if ($found.length === 0) {
            throw `${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot} not found :(`;
        } else {
            $found.closest('section')[0].scrollIntoView();
        }
        return $found;
        //#-#-FINISH
    };

    const openCoupon = async paramData => {
        dLog('green', 'BB', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'BB', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            let openEventResult = await openEvent(data);
            dLog('green', 'BB', openEventResult);
            const $element = await getBetElement(data);
            console.log('$element ', $element);
            let coefWeWaitFor = $element.find('div').eq(1).trt();
            dLog('green', 'BB', 'We got element! Coef: ' + coefWeWaitFor);
            const waitForCouponVisibleStarted = Date.now();
            let elementWasClicked = 0;
            let performElementClick = async function () {
                dLog('green', 'BB', 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor + ') /' + (Date.now() - elementWasClicked));
                await mouseChain({target: $element[0], events: ['click'], error: 'performElementClick'})
                elementWasClicked = Date.now();
            };
            const checkCoupon = () => {
                let event = (data.team1 + ' - ' + data.team2).toLowerCase();
                let result = false;
                $coupons().each(function () {
                    let teams = $(this).find('button[data-delete-btn="true"]').prev().find('div').first().trt().split(' — ');
                    if (teams.length === 2) {
                        let ev = `${teams[0].trim()} - ${teams[1].trim()}`.toLowerCase();
                        if (event === ev || locutus_similar_text(event, ev, true) > 60) {
                            result = true;
                            return false;
                        } else {
                            dLog('red', 'BB', `'${ev}' !== '${event}'`);
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
        }

        return 777777;
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => {
            const localMatch = `${v.team1.toLowerCase()} - ${v.team1.toLowerCase()}`;
            return localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 70;
        });
        let checked = 0, totalCoef = 1;
        dLog('', 'BB', `checkCoefs, data.length: ${data.length}, new expresses: ${settings.newExpresses}`);
        const $couponsCoefs = (data.length === 1 && settings.newExpresses === true)
            ? $coupons().last()
            : $coupons();
        const errors = [];
        $couponsCoefs.each(function () {
            const
                $this = $(this),
                teams = $this.find('button[data-delete-btn="true"]').prev()
                .find('div').first().trt().split(' — ');
            if (teams.length !== 2) {
                throw `Wrong length of teams: ${teams}`;
            }
            const match = `${teams[0].trim()} - ${teams[1].trim()}`;
            const localCoefVal = $this.find('>div>div').first().find('div').last().trt();
            let localCoef = parseFloat(localCoefVal);
            let localData = findInData(match);
            dLog('', 'BB', ['Check: localData, match, localCoef', localData, match, localCoef]);
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if (!localData || isNaN(localCoef)) {
                errors.push(`${localData} - ${match} - wrong match or localCoef ${localCoef}! LOW_COEF`);
                checked++;
            }
            checked++;
        });
        if (errors.length === 0 && checked === data.length) {
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
            if (totalCoef >= nCheck * 1.2) {
                throw `Coef TOO BIG: ${totalCoef} instead of ${data[0].coef}`;
            } else if (totalCoef < nCheck) {
                throw `LOW_COEF ${data[0].coef} > ${totalCoef}`;
            } else {
                return `Coefs fine! here: ${totalCoef}, need: ${nCheck}/${data[0].coef}`;
            }
        } else {
            throw errors.join('; ') + (checked !== data.length ? ` some stakes not checked (${checked}/${data.length})!` : '');
        }
    };

    const goToLobby = async () => {
        const $bt = await waitForElement('div.js-balance-popover-trigger', 333, 10000);
        await mouseChain({target: $bt[0], events: fullClick, error: '$bt'});
        const $db = await waitForElement('div.popover__body a[href="/lobby/payinpayout"]:visible', 333, 3000);
        await delayPromise(1000);
        await mouseChain({target: $db[0], events: fullClick, error: '$db'});
    };

    const deposit = async data => {
        if (data.paysystem !== 'QIWI') {
            throw `Deposit possible only from QIWI!`;
        }
        if (bkHere === 'pinupcupis') {
            return await depositPinupCupis(data);
        }
        if (document.location.href.indexOf('lobby/payinpayout') > -1) {
            const $dep = await waitForElement('a.tabs__control-link:textEquals("Пополнение")', 333, 10000);
            if (!$dep.parent().hasClass('active')) {
                await mouseChain({target: $dep[0], events: fullClick, error: '$dep'});
                await delayPromise(1000);
            }
            const $qiwi = $('li[data-tab="qiwi"]:visible');
            if (!$qiwi.hasClass('active')) {
                await mouseChain({target: $qiwi[0], events: fullClick, error: '$qiwi'});
                await delayPromise(1000);
            }
            const $input = $('form:has(p:contains("QIWI")) input[name="amount"]:visible');
            await clearAndInputNumber($input[0], data.amount);
            await delayPromise(3000);
            ourCommand.add('iFrame', true);
            await bMess('QIWI_COMMAND', true).set(ourCommand.get());
            await mouseChain({
                target: $('form:has(p:contains("QIWI")) button[type="submit"]:contains("Пополнить")')[0],
                events: fullClick,
                error: 'submit'
            });
            const res = await bMess('DEPOSIT_RESULT', true).get(200000, 60000)
                .catch(() => ({success: false, message: 'No result for 200s :('}));
            delayPromise(2000)
                .then(() => mouseChain({
                    target: $('li.menu__item a[href="/sport"]')[0], events: fullClick, error: ''
                }));
            return {
                success: res.success, message: res.message || 'No message :(', wallet_balance: res.balance || ''
            };
        } else {
            await goToLobby();
            await delayPromise(1000000);
        }
    };

    const depositPinupCupis = async data => {
        if (ourCommand.getAdded('depositClicked')) {
            const res = await bMess('DEPOSIT_RESULT', true).get(200000, 60000)
                .catch(() => ({success: false, message: 'No result for 200s :('}));
            delayPromise(2000)
                .then(async () => {
                    const $cc = $('div.cashbox__close');
                    if ($cc.length > 0) {
                        await mouseChain({target: $cc[0], events: fullClick, error: '$cc'});
                    }
                });
            return {
                success: res.success, message: res.message || 'No message :(', wallet_balance: res.balance || ''
            };
        }
        if ($('#popup_cashbox:visible').length === 0) {
            await mouseChain({
                target: $('#open_cashbox')[0], events: fullClick, error: 'open_cashbox'
            });
            await delayPromise(5000);
        }
        const $dep = await waitForElement('#popup_cashbox_deposit', 333, 10000);
        if (!$dep.hasClass('cashbox__nav-button--active')) {
            await mouseChain({
                target: $dep[0], events: fullClick, error: '$dep'
            });
            await delayPromise(5000);
        }
        const $qiwi = await waitForElement('li[data-name="Цупис_Qiwi"]', 333, 10000);
        if (!$qiwi.hasClass('cashbox__item--active')) {
            await mouseChain({
                target: $qiwi[0], events: fullClick, error: '$qiwi'
            });
            await delayPromise(5000);
        }
        const $amount = await waitForElement('#popup_cashbox_deposit_sum', 333, 10000);
        await clearAndSimulate($amount[0], data.amount);
        await delayPromise(3000);
        ourCommand.add('depositClicked', true);
        await bMess('QIWI_COMMAND', true).set(ourCommand.get());
        increaseDelay = true;
        await mouseChain({
            target: $('#popup_cashbox_makepayment')[0], events: fullClick, error: '#popup_cashbox_makepayment'
        });
        await delayPromise(100000);
        return await depositPinupCupis(data);
    };

    const withdraw = async data => {
        settings.phone = data.login;
        if (document.location.href.indexOf('lobby/payinpayout') > -1) {
            const $out = () => $('form:has(p:contains("QIWI")) button[type="submit"]:contains("Вывести")');
            const $dep = await waitForElement('a.tabs__control-link:textEquals("Выплата")', 333, 10000);
            if (!$dep.parent().hasClass('active')) {
                await mouseChain({target: $dep[0], events: fullClick, error: '$dep'});
                await delayPromise(1000);
            }
            if (data.paysystem !== 'QIWI') {
                throw `Deposit possible only from QIWI!`;
            }
            const $qiwi = $('li[data-tab="qiwi"]:visible');
            if (!$qiwi.hasClass('active')) {
                await mouseChain({target: $qiwi[0], events: fullClick, error: '$qiwi'});
                await delayPromise(1000);
            }
            const $input = $('form:has(p:contains("QIWI")) input[name="amount"]:visible');
            await clearAndInputNumber($input[0], data.amount);
            await delayPromise(3000);
            await mouseChain({target: $out()[0], events: fullClick, error: 'submit'});
            const $code = await waitForElement('form:has(p:contains("QIWI")) input[name="sms_code"]', 333, 10000);
            const code = await smsApiMessage.waitForSMSCode(["CUPIS"], (m) => {
                dLog('orange', 'BB', `sms: '${m}'`);
                return m.indexOf('Kod:') > -1;
            }, m => m.replace(/[^\d]/g, ''), 150000);
            await clearAndInputNumber($code[0], parseInt(code));
            await delayPromise(500);
            await mouseChain({target: $out()[0], events: fullClick, error: 'submit'});
            delayPromise(2000)
                .then(() => mouseChain({
                    target: $('li.menu__item a[href="/sport"]')[0], events: fullClick, error: ''
                }));
            return {
                success: res.success, message: res.message || 'No message :(', wallet_balance: res.balance || ''
            };
        } else {
            await bsBindNumber(port, settings, smsApiMessage, ourCommand);
            await goToLobby();
            await delayPromise(1000000);
        }
    };

    const proceedBetSport = async (data, command) => {
        const checkSuccess = async () => {
            const started = Date.now();
            while (Date.now() - started < 30000) {
                const $success = () => $('div:has(span:textEquals("Пари заключено"))');
                if ($success().length > 0) {
                    await waitForCondition(() => $success().length === 0, 100, 150000);
                    return true;
                }
                const $changed = $('button:textEquals("Принять изменения")');
                if ($changed.length > 0) {
                    const newCoef = $coupons().find('>div>div').first().find(' > div')
                        .last().find('div').first().find('span').last().trt();
                    if (parseFloat(newCoef) >= parseFloat(data[0].coef)) {
                        await mouseChain({target: $changed[0], events: fullClick, error: '$changed'});
                    } else {
                        throw `Coef changed, we need ${data[0].coef}, but current is ${newCoef} :(`;
                    }
                }
                await delayPromise(400);
            }
            throw `No bet result in ${(Date.now() - started)}`;
        };
        const checkBalance = willPlace => {
            let localBalance = getBalance(true);
            if (localBalance < willPlace) {
                throw `NO_FUNDS - now: ${localBalance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };

        const
            realSuccessInterval = data[0].successBetInterval || settings.betweenBets,
            wasSuccessStake = await bMess('WasSuccessStake')
                .check(realSuccessInterval)
                .catch(() => 0),
            successDiff = Date.now() - wasSuccessStake;
        if (successDiff < realSuccessInterval) {
            throw `To early after previous success bet ${successDiff} instead of ${realSuccessInterval}!`
        }
        if (command === 'BET' && !!currentBetData.data[0].betFromParser) {
            const eventName = `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`;
            if (!await eventsWork('BetBoom', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'BB',
                    `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                    + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
            }
        }

        if (settings.newExpresses) {
            const wasSuccessExpressNew = await bMess('WasSuccessExpressNew').infinite().catch(() => 0);
            if (!wasSuccessExpressNew) {
                throw 'NE is not set!';
            }

            const used = await bMess('usedEvents').check(1080000).catch(() => ({}));
            const dataTeams = (data[0].team1 + ' - ' + data[0].team2).toLocaleLowerCase();
            if (used[dataTeams] >= 1) {
                throw `This event - ${dataTeams} has already been used!`;
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

        await closePreviousCoupons(false);
        currentBetData.max = await openCoupon(data);
        await delayPromise(1555);

        //if sourceExpress check coupon for events
        if (sourceExpress && settings.lastScoreBasketball === '999') {
            if ($coupons().length !== 1) {
                throw 'Error Express source BET, No 1 event in coupon!';
            }
        }

        if (settings.newExpresses && $coupons().length < settings.newExpressBetsAmount + 1) {
            throw `less than ${settings.newExpressBetsAmount + 1} events in the newExpresses`;
        }

        do {
            // Hint: Try to perform bet
            await checkCoefs(data);
            let willPlace = parseFloat(data[0].stake);
            if (currentBetData.max !== -1 && willPlace > currentBetData.max) {
                willPlace = currentBetData.max;
            }
            checkBalance(willPlace);
            dLog('green', 'BB', `Will place (performBet): ${willPlace}, balance: ${getBalance()}`);
            const $input = $('input[inputmode="numeric"]');
            if ($input.length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            await clearAndInputNumber($input[0], willPlace.toString().replace('.00', '').trim());
            await delayPromise(800);
            dLog('green', 'BB', `STAKE entered ${willPlace}`);
            let entered = parseFloat($input.val());
            dLog('green', 'BB', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'BB', 'Entered !== willPlace - try to reenter!');
                continue;
            }
            await delayPromise(1200);
            const $placeBtn = $('button:textEquals("Заключить")');
            if ($placeBtn.length === 0 || $placeBtn.attr('disabled')) {
                throw 'No place button or button disabled!';
            }
            await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
        } while (!await checkSuccess());
        dLog('blue', 'BB', 'Bet should be placed')
        // Hint: collect result
        const placedBet = await instantCollectBet();
        return {
            success: true,
            message: {
                external_id: placedBet.external_id,
                coef: placedBet.coef,
                stake: placedBet.stake,
                max: currentBetData.max,
            },
        };
    };

    const instantCollectBet = async () => {
        // TODO: Remove this function and replace its usages with collectBetResult
        const
            $history = $('button:textEquals("История")'),
            $unCount = () => $('button[data-toggle-label="Нерассчитанные"]'),
            $useRepeat = () => $('div[data-coupon="true"] use').filter(function () {
                return this.getAttribute('xlink:href') === '#repeat-outline';
            });
        if ($history.length === 0) {
            throw 'No history!';
        }
        if ($unCount().length === 0) {
            await mouseChain({target: $history[0], events: fullClick, error: '$history'});
            await waitForElement(() => $unCount(), 100, 5000);
            await delayPromise(100);
        }
        if ($unCount().attr('aria-checked') !== 'true') {
            await mouseChain({target: $unCount()[0], events: fullClick, error: '$unCount'});
            await waitForElement(() => $unCount(), 100, 5000);
            await delayPromise(100);
        }
        const $uses = await waitForElement(() => $useRepeat(), 100, 10000);
        let $bet = $uses.first().closest('button').parent().parent().parent().next();
        if ($bet.trt().indexOf("Смотреть") === 0) {
            // Express here!
            await mouseChain({target: $bet.find('div[data-id="trigger"]')[0], events: fullClick, error: '$bet'});
            await delayPromise(1000);
            $bet = $bet.find('section>div').last();
        }
        await mouseChain({target: $bet.find('span').first()[0], events: fullClick, error: '$unCount'});
        await delayPromise(1000);
        const
            bet = getAloneBetData(),
            $close = $('div[role="dialog"] use').filter(function () {
                return this.getAttribute('xlink:href') === '#cancel-outline';
            }).closest('button');
        await mouseChain({target: $close[0], events: fullClick, error: '$close'});
        await delayPromise(1000);
        return bet;
    };

    const collectBetResultsSports = async (inD, command, balance, inplay) => {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inplay ? 1 : inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 35 ? parseInt(inD[1]) : 35) : 30;
        dLog('green', 'BB', [`collectBetResults, limit: ${limit}, inplay: ${inplay}, data: `, data]);
        const
            $history = $('button:textEquals("История")'),
            $useShare = () => $('div[data-coupon="true"] use').filter(function () {
                return this.getAttribute('xlink:href') === '#share-outline';
            });
        if ($history.length === 0) {
            throw 'No history!';
        }
        for (const current of ['Нерассчитанные', 'Рассчитанные',]) {
            const $current = () => $(`button[data-toggle-label="${current}"]`);
            if ($current().length === 0) {
                await mouseChain({target: $history[0], events: fullClick, error: `$current ${current}`});
                await waitForElement(() => $current(), 100, 5000);
                await delayPromise(100);
            }
            if ($current().attr('aria-checked') !== 'true') {
                await mouseChain({target: $current()[0], events: fullClick, error: '$current click'});
                await waitForElement(() => $current(), 100, 5000);
                await delayPromise(100);
            }
            const $uses = await waitForElement(() => $useShare(), 100, 10000)
                .catch(() => $([]));
            let counter = 0;
            await $uses.eachAsync(async function () {
                counter++;
                const
                    $this = $(this);
                let $bet = $this.closest('button').parent().parent().parent().next();
                if ($bet.trt().indexOf("Смотреть") === 0) {
                    // Express here!
                    await mouseChain({
                        target: $bet.find('div[data-id="trigger"]')[0], events: fullClick, error: '$bet'
                    });
                    await delayPromise(1000);
                    $bet = $bet.find('section>div').last();
                }
                await mouseChain({
                    target: $bet.find('span').first()[0], events: fullClick, scroll: true, error: '$bet'
                });
                await delayPromise(1000);
                const
                    bet = getAloneBetData(current === 'Нерассчитанные'),
                    $close = $('div[role="dialog"] use').filter(function () {
                        return this.getAttribute('xlink:href') === '#cancel-outline';
                    }).closest('button');
                await mouseChain({target: $close[0], events: fullClick, error: '$close'});
                await delayPromise(1000);
                if (data.length === 0 || data.indexOf(external_id) > -1) {
                    collected.push(bet);
                }
                if (counter >= limit) {
                    return false;
                }
            });
        }
        dLog('green', 'BB', ['Collected', collected]);
        return {success: true, message: collected};
    };

    const getAloneBetData = (unCounted) => {
        const
            $bet = $('span:textEquals("ID билета")').parent().parent().parent().parent().parent(),
            statusText = unCounted ? '' : $bet.find('>div>div>div').first().find('span').first().trt(),
            statuses = {'Выигрыш': 'WON', 'Возврат': 'REFUNDED', 'Проигрыш': 'LOSE'},
            status = statuses[statusText] || 'ACCEPTED',
            $stakeResultBase = $bet.find('span:textEquals("Ставка")').next().find('span'),
            res = {
                external_id: $('span:textEquals("ID билета")').parent().find('button').trt(),
                status: status,
                match: $bet.find('a > div > div > div').first().find('span').last().trt().replace('\n', '-'),
                bkPivot: $bet.find('a > div > div > div').last().find('> div span').first().trt(),
                coef: $bet.find('span:textEquals("Ставка")').parent().next().trt(),
                stake: $stakeResultBase.first().trt().replace(/[^0-9.]/g, ''),
                result: unCounted ? '' : status === 'LOSE' ? '0' : $stakeResultBase.last().trt().replace(/[^0-9.]/g, ''),
            };
        return res;
    };

    const findExpressNew = async () => {
        const
            used = await bMess('usedEvents').check(1080000).catch(() => ({})),
            rButtonSel = 'div[role="button"]',
            tourSel = 'section[data-at-el="feed-tournament-header"]',
            $leagues = () => $(tourSel),
            currentBets = [],
            $backDraft = () => $('use').filter(function () {
                return this.getAttribute('xlink:href') === '#arrow-right-square-outline';
            });
        // Working in prematch football
        await switchToSport(true, 'Футбол', true);
        dLog('green', 'BB', `Start find New Express! Busy: '${busy}', leagues: ${$leagues().length}`);
        // Checking random league, and ONE_TWO market in leagues' list
        let success = false, i = -1, checked = [];
        while (!success && i < $leagues().length) {
            const
                $league = $leagues().eq(getRandomRounded(0, $leagues().length - 1, 1)),
                lHere = $league.find('h3').text().trim().toLowerCase();
            dLog('', 'BB', `lHere: ${lHere}`);
            if (checked.indexOf(lHere) !== -1) {
                continue;
            }
            checked.push(lHere);
            i++;
            $league[0].scrollIntoView();
            if ($league.find(rButtonSel).next().text().length === 0) {
                await mouseChain({
                    target: $league.find(rButtonSel)[0], events: fullClick, error: 'rButtonSel', scroll: true
                });
            }
            await delayPromise(1000);
            dLog('', 'BB',
                `League opened! Events: ${$league.find(rButtonSel).next().find('a[role="link"]').length}`);
            let $el = $([]);
            $league.find(rButtonSel).next().find('a[role="link"]').each(function () {
                const $this = $(this).next();
                if ($this.length === 0) {
                    return true;
                } $this[0].scrollIntoView();
                dLog('', 'BB', `Event row, this: ${$this.trt()}, buttons: ${$this.find('button').length}`);
                $this.find('button').each(function () {
                    const
                        $button = $(this),
                        $spans = $button.find('span');
                    if ($spans.length === 0) {
                        return true;
                    }
                    const coef = parseFloat($spans.eq(1).trt());
                    dLog('', 'BB', `Checking target: ${$spans.eq(0).trt()}, coef: ${$spans.eq(1).trt()}`);
                    if (!isNaN(coef) && coef >= 1.1 && coef <= 1.7) {
                        $el = $button;
                        return false;
                    }
                });
                if ($el.length === 1) {
                    const $spans = $this.find('div').eq(2).find('span'), teams = [];
                    $spans.each(function () {
                        if ($(this).find('img').length === 0) {
                            teams.push($(this).text());
                        }
                    });
                    console.log(teams);
                    const evtHere = `${teams[0].trim()} - ${teams[1].trim()}`.toLowerCase();
                    if (used[evtHere] >= 1) {
                        $el = $([]);
                        return true;
                    } else {
                        currentBets.push(evtHere);
                        return false;
                    }
                }
            });
            if ($el.length === 1) {
                await mouseChain({
                    target: $el[0], events: fullClick, error: '$el', scroll: true
                });
            }

            if ($coupons().length === settings.newExpressBetsAmount) {
                break;
            }
        }
        dLog('pink', 'BB', `Returned from the loop!`);
        if ($coupons().length === settings.newExpressBetsAmount 
            && currentBets.length === settings.newExpressBetsAmount
        ) {
            await bMess('currentFirstBet').set(currentBets[0]);
            await bMess('WasSuccessExpressNew').set(true);
            dLog('green', 'BB', `We get first bet: '${currentBets[0]}!'`);

            if (settings.newExpressBetsAmount > 1) {
                await bMess('currentSecondBet').set(currentBets[1]);
                dLog('green', 'BB', `We get second bet: '${currentBets[1]}!'`);
            }
        } else {
            dLog('red', 'BB', 'New express event not found!');
        }
    };

    const sportCommands = new class SportCommands {
        constructor() {
            this.cLinks = {
                'BET': proceedBetSport, 'EXPRESS_BET': proceedBetSport, 'BET_RESULT': collectBetResultsSports,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data, balance) {
            currentBetData.init(data);
            dLog('green', 'BB', [command, data]);
            const res = await this.cLinks[command](data, balance)
                .catch(e => ({
                    success: false, message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'BB', [`${command} sports result was set:`, res]);
            await bMess('BBSportResult').set(res);
            if (settings.newExpresses) {
                if (res.success) {
                    // Hint: currentFirstBet MUST exists, otherwise some shit happened!
                    await bMess('WasSuccessExpressNew').set(false);
                    const currentFirstBet = await bMess('currentFirstBet').check(1080000, true),
                        used = await bMess('usedEvents').check(1080000).catch(() => ({}));

                    if (!used[currentFirstBet]) {
                        used[currentFirstBet] = 1;
                    }

                    dLog('BB', 'blue-big', [`We set bet with first: '${currentFirstBet}', now used:`, used]);

                    if (settings.newExpressBetsAmount > 1) {
                        const currentSecondBet = await bMess('currentSecondBet').check(1080000, true);
                        if (!used[currentSecondBet]) {
                            used[currentSecondBet] = 1;
                        }

                        dLog('BB', 'blue-big',
                        [`We set bet with second: '${currentSecondBet}', now used:`, used]);
                    }

                    await bMess('usedEvents').set(used);
                } else {
                    const $coupons = () => $('div.stake_item_panel');
                    let checkCoef = false;
                    dLog('red', 'BB', 'Had error in bet newExpress');

                    if ($coupons().length > 0) {
                        const isHDP = $coupons().last().find('div.betslip_game_name').trt().includes('Фора');
                        const couponCoef = parseFloat($coupons().last().find('div.tg__coupon_factor').trt());
                        const isNotActive = $coupons().last().find('div:textEquals("ставка не активна")').length;

                        if (isNotActive) {
                            dLog('red', 'BB', 'Had error in bet newExpress, is not active');
                            await closePreviousCoupons(true);
                            await delayPromise(777);
                            await bMess('WasSuccessExpressNew').set(false);
                        } else {
                            if (isHDP) {
                                // check second option
                                checkCoef = isNaN(couponCoef) ? false : couponCoef >= 1.1 && couponCoef <= 1.6;

                                if (!checkCoef) {
                                    // check first option
                                    checkCoef = isNaN(couponCoef) ? false : couponCoef >= 1.01 && couponCoef <= 1.05;
                                }
                            } else {
                                // check first option
                                checkCoef = isNaN(couponCoef) ? false : couponCoef >= 1.01 && couponCoef <= 1.05;
                            }

                            if (!checkCoef) {
                                dLog('red', 'BB', 'Had error in bet newExpress, checkCoef - false');
                                await bMess('WasSuccessExpressNew').set(false);
                                await closePreviousCoupons(true);
                            } else {
                                dLog('red', 'BB', 'Had error in bet newExpress, checkCoef - true');
                                await closePreviousCoupons(false);
                            }
                        }
                    } else {
                        dLog('red', 'BB', 'Had error in bet newExpress, no coupons');
                        await bMess('WasSuccessExpressNew').set(false);
                    }
                }
            }
            return res;
        }
    };

    const sportProcessor = command => {
        dLog('green', 'BB', `SportProcessor: ${command.action}`);
        if (sportCommands.exists(command.action)) {
            // Hint: execute command
            ourCommand.set(command);
            sportCommands.execute(command.action, command.data, command.balance)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'BB', ['Unknown Sport command:', command]);
        }
    };

    const commands = new class commands {
        constructor() {
            this.cLinks = {
                'BET': proceedBetSport,
                'EXPRESS_BET': proceedBetSport,
                'BET_RESULT': collectBetResultsSports,
                'DEPOSIT': deposit,
                'WITHDRAW': withdraw,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data) {
            currentBetData.init(data);
            //dLog('green', 'BB', [`commands execute ${command}`, data, formatStack((new Error()).stack)]);
            const res = await this.cLinks[command](data, command, getBalance()).catch(e => ({
                success: false, message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'BB', [`${command} result:`, res]);
            port.postMessage(await this.prepareResult(command, res));
            if (command === 'WITHDRAW' && parseInt(data.pin) !== 1) {
                bsSendSmsApi(port, 'BIND_RELEASE', {
                    "websocket_uid": settings.uid, "request_id": ourCommand.getAdded('sms_api_request_id')
                });
            }
            if (!res) {
                throw res.message;
            }
            return res;
        }

        async prepareResult(command, res) {
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                const resultData = {
                    "external_id": res.success ? res.message.external_id : '',
                    "status": res.success ? 'ACCEPTED' : ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED']
                        .find(t => res.message.indexOf(t) > -1) || 'FAILED',
                    "market": currentBetData.data[0].market,
                    "target": currentBetData.data[0].target,
                    "pivot": currentBetData.data[0].pivot,
                    "coef": res.success ? res.message.coef : currentBetData.data[0].coef,
                    "stake": res.success ? res.message.stake : currentBetData.data[0].stake,
                    "maximum": res.success && res.message.max ? res.message.max : 0,
                };
                if (res.message && typeof res.message === 'string' && res.message.indexOf('Войдите в систему') > -1) {
                    delayPromise(1000)
                        .then(() => window.location.reload());
                }
                if (res.success) {
                    await eventsWorkAll('BetBoom', settings.eventMaxBets, settings.eventTimeLimit, currentBetData.data, true, true);
                    await bMess('WasSuccessStake').set(Date.now());
                    await bMess('Stake Maximums').set(0);
                }
                const doNotSend = !!currentBetData.data[0].betFromParser && !res.success && resultData.status !== 'LIMITED';
                if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'BETBOOM';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = '398' || 'oddscp';
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
                return {
                    answered: !!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED'
                        ? "F_BET" : "BET",
                    data: resultData,
                    answer: res.success ? 'Everything is Okay!' : (resultData.status === 'LIMITED' ? 'Tried to bet 0' : res.message),
                    doNotSend,
                };
            } else if (command === 'BET_RESULT') {
                return {
                    answered: "BET_RESULT", status: res.success ? "success" : "error", answer: res.message
                };
            } else if (command === 'DEPOSIT') {
                return {
                    answered: "DEPOSIT",
                    status: res.success ? 'SUCCESS' : (res.message.indexOf('NO_FUNDS') > -1 ? 'NO_FUNDS' : "FAILED"),
                    answer: res.message,
                    balance: getBalance(),
                    wallet_balance: res.wallet_balance || '',
                };
            } else if (command === 'WITHDRAW') {
                return {
                    answered: "WITHDRAW",
                    status: res.success ? "SUCCESS" : res.message.indexOf('LIMITED') > -1 ? "LIMITED" : "FAILED",
                    answer: res.message
                };
            } else {
                return {};
            }
        }
    };

    const messageProcessor = message => {
        dLog('green', 'BB', [`messageProcessor (${busy})`, message]);

        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action, answer: busy ? 'BUSY' : 'FREE'
            });
        } else if (message.action === 'CONFIRMATION' && busy) {
            console.log('CONFIRMATION data! ', message.data);
            hasSMS = true;
            (async () => {
                if (message.data !== null) {
                    const getObj = JSON.parse(message.data);
                    if (getObj.code) {
                        let codeArr = getObj.code.split('');
                        await clearAndSimulate($('input#sms-code-1')[0], codeArr[0]);
                        await delayPromise(888);
                        await clearAndSimulate($('input#sms-code-2')[0], codeArr[1]);
                        await delayPromise(888);
                        await clearAndSimulate($('input#sms-code-3')[0], codeArr[2]);
                        await delayPromise(888);
                        await clearAndSimulate($('input#sms-code-4')[0], codeArr[3]);
                        await delayPromise(1222);
                        await mouseChain({
                            target: $('button#popup_login_step_3:textEquals("Подтвердить")')[0],
                            events: fullClick,
                            error: 'code button'
                        });
                        await delayPromise(1500);
                    } else {
                        throw 'sms code is NULL!';
                    }
                } else {
                    throw 'sms message code is NULL!';
                }
                busy = false;
            })().catch(e => console.log(`confirmation error: ${e}`))
        } else if (message.action === 'SMS_API' && typeof message.data !== 'undefined') {
            smsApiMessage.setMessage(message.data.status, message.data.message);
        } else if (message.action === "auth") {
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.phone = message.phone;
            settings.email = message.email;
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

                // if (settings.sourceRandom >= 18 && settings.sourceRandom <= 19) {
                //     settings.newExpresses = true;
                //     waitSource = true;
                //     if (settings.sourceRandom >= 18 && settings.sourceRandom <= 19) {
                //         settings.newExpressBetsAmount = 1;
                //     }
                // } else {
                //     waitSource = false;
                // }
                dLog('blue', 'BB', `Source current random value - ${settings.sourceRandom}`);
            }
            bMess('setAuth').remove();
            bMess('WasSuccessExpressNew').remove();
            authCheck();
        } else if (busy) {
            port.postMessage({
                answered: message.action, status: "error", answer: "BUSY"
            });
        } else if ($(findSel(logLinkSels)).length !== 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (commands.exists(message.action)) {
            if (waitSource) {
                port.postMessage({
                    answered: message.action,
                    status: "error",
                    answer: "BUSY"
                });
            } else {
                // Hint: execute command
                busy = true;
                bMess('commandBusy').set(true);
                ourCommand.set(message);
                commands.execute(message.action, message.data)
                    .finally(() => {
                        busy = false;
                        bMess('commandBusy').set(false);
                        ourCommand.clear();
                    });
            }
        } else {
            port.postMessage({
                answered: message.action, status: "error", answer: `${message.action} not supported!`
            });
        }
    };

    if (window.self === window.top) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message);
        });
    }

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('green', 'BB', ['Command was set till unload:', ourCommand.get()]);
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess('BETBOOM_COMMAND', true).set(ourCommand.get(), increaseDelay ? 130000 : 0);
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});

        const locationLinkArray = ['SportsBook/Home', 'SportsBook/Overview'];

        if (window.self === window.top) {
            // Hint: main window (outer with auth, menu, balance, etc.)
            bMess('BETBOOM_COMMAND', true).check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'BB', [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`, currentCommand]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'BB', 'No command!'));
            if (bkHere.indexOf('pinup') > -1 && bkHere.indexOf('cupis') === -1) {
                setInterval(async () => {
                    await closeAllWeNeed({
                        'div.popup span.popup__header-close': 'div.popup span.popup__header-close',
                    });
                }, 2000);
            }
        } else if (locationLinkArray.some(e => document.location.href.indexOf(e) > -1)) {
            // Hint: sports frame (here the most of work)
            (async () => {
                while (!stopSports) {
                    const pageReloadRequestSel = 'div.tg__modal_heading:contains("Необходимо обновить страницу.")';
                    if ($(pageReloadRequestSel).length > 0) {
                        await mouseChain({
                            target: $(pageReloadRequestSel).next()[0], events: fullClick, error: 'page reload'
                        });
                        document.location.reload();
                    }

                    // const newExpresses = await bMess('newExpresses').infinite().catch(() => 0);
                    // if (newExpresses) {
                    //     const setAuth = await bMess('setAuth').infinite().catch(() => 0);
                    //     const commandBusy = await bMess('commandBusy').infinite().catch(() => 0);
                    //     const $coupons = $('div.stake_item_panel');
                    //     if (setAuth && $coupons.length === 0 && !commandBusy) {
                    //         await proceedExpressNew();
                    //     }
                    // }

                    const csc = await bMess('BBSportCommand').check(10000, true)
                        .catch(() => null);

                    if (csc !== null) {
                        sportProcessor(csc);
                    }

                    const $li = $('div.tab_selector:contains("Live Info")');
                    if ($li.length > 0 && !$li.hasClass("tab_selector_active")) {
                        await mouseChain({target: $li[0], events: fullClick, error: '$li'});
                    }
                    await delayPromise(555);
                }
            })();
            dLog('green', 'BB', 'Sport processor initialized!');
        }
    }

})();
