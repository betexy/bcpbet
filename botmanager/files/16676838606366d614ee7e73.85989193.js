(function () {

    "use strict";

    /**
     * @import libs/jquery-3.3.1.min.js
     */

        // Hint: Supports
        //  ASTEKBET
        //  BETANDYOU
        //  FANSPORT
        //  LINEBET
        //  DBBET

    let newAPI = false;
    let authClicked = 0;
    let busy = false;
    let increaseDelay = false;
    let decSelected = false;

    let codeTry = 0;
    let phoneTry = 0;
    let hasSMS = false;
    let confirmSent = false;
    let smsDelay = 0;

    const bkHere = (() => ['fansport', 'linebet', 'astekbet', 'betandyou', 'dbbet']
        [['fan-sport', 'linebet', 'astekbet', 'betandyou', 'db-bet']
        .findIndex(p => document.location.href.indexOf(p) > -1)])();
    const psAllowed = ps => ['astekbet', 'betandyou', 'dbbet'].indexOf(bkHere) === -1 || ['PM', 'PAYEER'].indexOf(ps) > -1;
    const port = chrome.runtime.connect({name: `port_${bkHere}`});
    const settings = {
        authCheckInterval: 2000,
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        url: '',
        login: '',
        password: '',
        phone: '',
        uid: '',
        email: '',
        second_name: '',
    };
    let zeroMaxes = 0;

    const setBusy = b => {
        busy = b;
        bMess(`${bkHere}_busy`).set(busy).finally();
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
        'CYBERSPORT': 'КиберСпорт',
        'HANDBALL': 'Гандбол',
    };

    const ourCommand = new ourCommandProto();
    const smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);

    const getBalance = returnNull => {
        const $b = $('p.top-b-acc__amount').first();
        if ($b.length > 0) {
            return parseFloat($b.text().replace(',', '')
                .replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    }

    const authCheck = function () {
        (async () => {
            const $logLink = $(findSel(['div.curloginDropTop', 'button span.caption__label:textEquals("Вход")']));
            const $video = $('div.drag.other_s_zone');
            const $popup = $(findSel(['div.lucky-popup__close', 'button.welcome-popup__btn[title="Закрыть"]']));
            const $phone = $(findSel(['#phone_middle', 'input[name="phone"]']));
            const $code = $('#input_otp');
            const $email = $('#input_email');
            const needClose = ['div.pf-subs-btn a[href="#deny"]:visible', 'button.header-switcher-dropdown__close'];
            const $sn = $('#input_surname');
            //swtich language to russian
            await changeLang('ru');
            if (checkSE(needClose)) {
                await mouseChain({target: $(findSel(needClose))[0], events: fullClick, error: '$deny or $ok'});
            }

            //close popups
            if ($popup.length > 0) {
                await mouseChain({target: $popup[0], events: ['click'], error: 'ppp'});
            }

            if ($logLink.length > 0) {
                // Hint: Log In
                port.postMessage({m: "tech works! 2"});
                await delayPromise(1000);
                await tryToLogIn($logLink).catch(e => bsError(port, 'Error login: ' + e));
            } else if ($video.length > 0) {
                $video.remove();
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
            } else if ($email.length > 0) {
                // Hint: we're asked about email
                dLog('green', '1xO', `We'd been asked about email address`);
                if (!settings.email) {
                    throw `There is no email in the settings!`;
                }
                await clearAndInputEmail($email[0], settings.email);
                await delayPromise(1000);
                await bMess('WAS_EMAIL_AUTH').set(true);
                await mouseChain({target: $('button.block-window__btn')[0], events: fullClick, error: 'sb e'});
            } else if ($sn.length > 0) {
                dLog('green', '1xO', `We'd been asked about surname`);
                if (!settings.second_name) {
                    throw `There is no second_name in the settings!`;
                }
                await clearAndSimulate($sn[0], settings.second_name);
                await delayPromise(1000);
                await mouseChain({target: $('button.block-window__btn')[0], events: fullClick, error: 'sb sn'});
            } else {
                if (!decSelected) {
                    await selectDec();
                }
                setBusy(busy);
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch(e => dLog('red', '1xO', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const selectDec = async () => {
        decSelected = true;
        const $s = await waitForElement('div[title="Настройки"]', 333, 3000)
            .catch(() => $([]));
        if ($s.length === 0) {
            return;
        }
        await delayPromise(500);
        await mouseChain({target: $s[0], events: fullClick, error: '$s'});
        const $d = await waitForElement('li.setting-site span:textEquals("Десятичный")',
            333, 3000).catch(() => $([]));
        if ($d.length > 0 && !$d.hasClass('check')) {
            await delayPromise(500);
            await mouseChain({target: $d[0], events: fullClick, error: '$d'});
            await delayPromise(3000);
        }
        await mouseChain({target: $s[0], events: fullClick, error: '$s2'});
    };

    const tryToLogIn = async ($logLink) => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        if ($logLink.length !== 1) {
            throw 'No $logLink!';
        }
        const submitBtn = 'a.enter_button_main:visible';
        const lSels = ['#userLogin', 'input[placeholder="Ваш E-mail или ID"]:visible', '#auth_id_email:visible'];
        const pSels = ['#userPassword', 'input[placeholder="Пароль"]:visible', '#auth-form-password:visible'];
        const eSels = ['#userConButton', submitBtn, 'button.auth-button:visible'];
        authClicked = Date.now();
        await mouseChain({target: $logLink[0], events: fullClick, scroll: true});
        await waitForCondition(() => lSels.some(s => $(s).length > 0), 333, 10000, 'No inputs!');
        const sType = lSels.findIndex(s => $(s).length > 0);
        dLog('', '1xO', `tryToLogIn: use sType ${sType}`);
        await mouseChain({target: $(pSels[sType])[0], events: fullClick});
        await delayPromise(100);
        await clearAndSimulate($(pSels[sType])[0], settings.password, true, true, true);
        await delayPromise(500);
        await mouseChain({target: $(lSels[sType])[0], events: fullClick});
        await delayPromise(100);
        await clearAndSimulate($(lSels[sType])[0], settings.login, true, true, true);
        await delayPromise(500);
        const rmbSel = findSel(['label[for="chSaveMe"]', 'label[for="remember_user"]']);
        const reRes = /for="(.*?)"/.exec(rmbSel);
        if ($(rmbSel).length > 0 && reRes && reRes[1] && !$(`#${reRes[1]}`).prop('checked')) {
            await mouseChain({target: $(rmbSel)[0], events: fullClick});
            await delayPromise(500);
        }
        await delayPromise(500);
        await mouseChain({target: $(eSels[sType])[0], events: fullClick});
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
        dLog('', '1xO', 'Auth clicked!');
        return "auth_clicked";
    };

    const closePreviousCoupons = async skip => {
        if (skip) {
            return 'skipped!';
        }
        // Hint: Click 'Remove all' once or every 'Close'
        let $clearBtn = $('#clearAllBetsBlock');
        if ($clearBtn.length === 1) {
            await mouseChain({
                target: $clearBtn[0],
                events: ['click'],
                scroll: true,
                scrollTop: true,
                error: 'c0'
            });
            await delayPromise(1000);
            return 'ClearBtn clicked!';
        }
        const closes = 'div.coupon button.c-bet-box__del';
        while ($(closes).length > 0) {
            await mouseChain({target: $(closes).eq(0)[0], events: ['click'], scroll: true, error: 'c1'});
            await delayPromise(500);
        }
        return 'All were closed!';
    };

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
        };
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
                if (leagues.indexOf(current) > -1 || leagues.some(l => locutus_similar_text(l, current, true) > 90)) {
                    $el = $this;
                    return false;
                }
            });
            if ($el.length === 1) {
                await mouseChain({target: $el[0], events: ['click'], scroll: true, error: `LEAGUE`});
                return 'We have to be switched!';
            } else {
                await findSubLeague(data.league);
            }
        };
        const switchToSport = async () => {
            dLog('red', '1X', `switchToSport: ${sport}`);
            const $getSport = () => $(`ul.sport_menu li a span:textEquals("${sport}")`).first();
            await waitForCondition(() => $getSport().length > 0,
                333, 20000, `No ${data.sport} :(`);
            const $sport = $getSport();
            const active = $sport.closest('a').hasClass('sportMenuActive');
            if (!active) {
                const $target = () => $sport.closest('a');
                await waitForCondition(() => $target().length > 0,
                    333, 10000, 'No football label!');
                await mouseChain({
                    target: $target()[0],
                    events: fullClick,
                    error: `switchToSport`,
                    scroll: true
                });
                await delayPromise(1000);
            }
        };
        let checkScore = async () => {
            if (data.score === '' || data.sport !== 'FOOTBALL'
                || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                return '';
            }
            const getScore = () => {
                const $scores = $('div.c-tablo__main-count div.c-tablo-count__num');
                return $scores.eq(0).trt() + ':' + $scores.eq(1).trt();
            };
            await waitForCondition(() => getScore() !== '',
                700, 10000, 'No score');
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
        if (window.location.href.indexOf('/live/') === -1 || window.location.href.split('/').length >= 7) {
            const $lh = await waitForElement('#live_href', 333, 10000);
            await mouseChain({target: $lh[0], events: ['click'], scroll: true, error: 'LIVE_HREF'});
            await delayPromise(1000);
        }
        await switchToSport();
        await delayPromise(700);
        await switchToLeague(data.league);
        await delayPromise(3000);
        let $el = $([]);
        $('a.c-events__name').each(function () {
            let checkEvent = $(this).find('span.c-events__teams')
                .attr('title').trim().toLowerCase();
            const res = checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 60;
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
        await waitForCondition(() => checkWeAreThere(),
            777, 30000, 'We are not on event!');
        const score = await checkScore().catch(e => `SCORE_CHANGED => we need ${data.score}, we have ${e}`);
        if (score.indexOf('SCORE_CHANGED') > -1) {
            throw score;
        }
        return 'Switched to event!';
    };

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

        //#-#-START
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

    const openCoupon = async paramData => {
        dLog('green', '1x', ['openCoupon, paramData:', paramData]);
        if (!!paramData[0].direct_link) {
            const pathArray = document.location.pathname.split('/');
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
            dLog('green', '1X', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', '1X', 'Event must be opened!');
            const $element = await getBetElement(data);
            console.log($element);
            let coefWeWaitFor = $element.trt();
            dLog('green', '1X', 'We got element! Coef: ' + coefWeWaitFor);
            $element[0].scrollIntoView();
            if (!elementIsVisible($element[0])) {
                window.scrollBy(0, -110);
            }
            const waitForCouponVisibleStarted = Date.now();
            let elementWasClicked = 0;
            let performElementClick = async function () {
                dLog('green', '1X', 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                    + ') /' + (Date.now() - elementWasClicked));
                await mouseChain({target: $element.parent()[0], events: ['click'], error: 'performElementClick'})
                elementWasClicked = Date.now();
            };
            const checkCoupon = () => {
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
            const getMaxHere = () => {
                //bsDebug(port, 'getMaxHere: ' + isExpress);
                if (data && data.doNotOpen) {
                    return 1000050000;
                }
                let max = parseFloat($('div.coupon-grid__row span.coupon__text:textEquals("Максимальная ставка")').next().trt().replace(/\s/g, '').trim()
                    .replace(/[^\d.]/g, '').trim());
                if (max === 0.01) {
                    throw 'LIMITED';
                } else if (!isNaN(max) && max > 0) {
                    return Math.round(max * 1000) / 1000;
                } else {
                    zeroMaxes++;
                    throw `${(zeroMaxes >= 3 ? 'MAXIMUM_0 ' : '')}Max is NaN or 0!`;
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

    const checkCoefs = async data => {
        const findInData = match => data.find(v => {
            const localMatch = v.team1.toLowerCase() + ' - ' + v.team2.toLowerCase();
            return localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 60;
        });
        const $coupons = $('div.coupon div.o-bet-box-list__item');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const test = $(this).find('div.c-bet-box__row div.c-bet-box__row_full').trt();
            const $teams = $(this).find('span.c-bet-box__label');
            const match = $teams.length === 2 ? `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}` : test;
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
            } else if (!localData || isNaN(localCoef)) {
                errors.push(match + ' LOW_COEF - wrong match or localCoef!');
                checked++;
            } else if (localData.coef === '' || newAPI) {
                checked++;
            }
        });
        const $ok = $('div.ui-dialog-buttonset button:contains("ОК")');
        if ($ok.length > 0) {
            mouseChain({target: $ok[0], events: ['click']})
                .finally(() => console.log(`OK clicked!`));
        }
        if (!newAPI && errors.length === 0 && checked === data.length) {
            return 'Coefs fine!';
        } else if (newAPI && errors.length === 0 && checked === data.length) {
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
            if (totalCoef >= nCheck * 1.2) {
                throw `Coef TOO BIG: ${totalCoef} instead of ${data[0].coef}`;
            } else if (totalCoef < nCheck) {
                throw `LOW_COEF ${data[0].coef} > ${totalCoef}`;
            } else {
                return 'Coefs fine!';
            }
        } else {
            throw errors.join('; ') + (checked !== data.length ? ` some stakes not checked (${checked}/${data.length})!` : '');
        }
    };

    const proceedBet = async data => {
        if ($('#enter').length !== 0) {
            throw "Not logged in!";
        }
        const checkSuccess = async () => {
            const clickOk = async () => await mouseChain({
                target: $(findSel(['a.ui-dialog-titlebar-close.ui-corner-all:visible',
                    'button.swal2-confirm']))[0],
                events: ['click'],
                error: 'pbcs-3',
            });
            const started = Date.now();
            while (Date.now() - started < 30000) {
                const alertText = $('#swal2-content:visible').trt();
                const acceptedText = $('div.c-coupon-modal__title').first().trt();
                if (alertText !== '' && alertText.indexOf('временно заблокирована') > -1) {
                    await mouseChain({
                        target: $(findSel(['a.ui-dialog-titlebar-close.ui-corner-all:visible',
                            'button[type="button"]:textEquals("ОК")']))[0],
                        events: ['click'],
                        error: 'pbcs-1',
                    });
                    await delayPromise(3000);
                    throw 'bet is temporary blocked!';
                } else if (alertText !== '' && alertText.indexOf('Изменился коэффициент') > -1) {
                    await mouseChain({
                        target: $('button.swal2-confirm:visible')[0],
                        events: ['click'],
                        error: 'pbcs-2',
                    });
                    await delayPromise(400);
                    return false;
                } else if (alertText !== '' && alertText.indexOf('Возможно ваша ставка прошла') > -1) {
                    await clickOk();
                    throw `Stake was accepted probably, but we don't know it clear :)`;
                } else if (alertText !== '' && alertText.indexOf('Максимальная сумма ставки составляет 0') > -1) {
                    zeroMaxes++;
                    await clickOk();
                    throw `${(zeroMaxes >= 3 ? 'MAXIMUM_0 ' : '')}Max is NaN or 0!`;
                } else if (acceptedText.indexOf('Ваша ставка принята') > -1) {
                    return true;
                }
                await delayPromise(400);
            }
            throw `No bet result in ${(Date.now() - started)}`;
        };
        const checkBalance = willPlace => {
            const balance = getBalance();
            if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };
        await closePreviousCoupons(false);
        currentBetData.max = await openCoupon(data);
        do {
            // Hint: Try to perform bet
            let $cancelBtn = $('a.ui-dialog-titlebar-close.ui-corner-all:visible');
            if ($cancelBtn.length > 0) {
                await mouseChain({target: $cancelBtn[0], events: ['click'], error: '$cancelBtn'});
                await delayPromise(800);
                continue;
            }
            await checkCoefs(data);
            let willPlace = parseFloat(data[0].stake);
            if (currentBetData.max !== -1 && willPlace > currentBetData.max) {
                willPlace = currentBetData.max;
            }
            checkBalance(willPlace);
            dLog('green', '1X', `Will place (performBet): ${willPlace}, balance: ${getBalance()}`);
            const $input = $('div.coupon__bet-settings input.c-spinner__input');
            if ($input.length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            await clearAndSimulate($input[0], willPlace.toString().replace('.00', '').trim());
            await delayPromise(800);
            dLog('green', '1X', `STAKE entered ${willPlace}`);
            const $el = await waitForElement('div.coupon__bet-settings input.c-spinner__input',
                333, 3333);
            let entered = parseFloat($el.val());
            dLog('green', '1X', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', '1X', 'Entered !== willPlace - try to reenter!');
                continue;
            }
            const placeBtn = 'button.cpn-btn span:textEquals("Сделать ставку")';
            if ($(placeBtn).length === 0) {
                throw 'No place button or button disabled!';
            }
            await mouseChain({target: $(placeBtn)[0], events: fullClick, scroll: true, error: '$placeBtn'});
        } while (!await checkSuccess());
        // Hint: collect result
        let $entire = $('div.c-coupon-modal:visible');
        let external_id = $('div.c-coupon-modal__title:visible').last().text()
            .replace(/[^\d]/g, '').trim();
        if (external_id.length === 0) {
            throw 'No external id till collecting!';
        }
        let sCoef = $entire.find('span.coupon__text:contains("оэффициент"):visible').next().trt();
        if (sCoef.indexOf('(') > -1 && sCoef.indexOf(')') > -1) {
            const r = /\((.*?)\)/.exec(sCoef);
            sCoef = r && r[1] ? r[1] : sCoef;
        }
        let sStake = $entire.find('span.coupon__text:contains("Сумма ставки"):visible').next().text()
            .replace(/[^\d.]/g, '').trim();
        await mouseChain({
            target: $('button:contains("Ok")')[0],
            events: ['click'],
            scroll: true,
            error: 'pb-fin'
        });
        return {
            success: true,
            message: {
                external_id: external_id,
                coef: sCoef,
                stake: sStake
            },
        };
    };

    const depositQiwi = async data => {
        await delayPromise(5000);
        const $qiwiEl = () => $getIFrame('#payments_frame').find('div.payment_item.qiwi').first();
        await waitForCondition(() => $qiwiEl().length > 0, 333, 15000, 'No QIWI!');
        await delayPromise(1000);
        await mouseChain({target: $qiwiEl()[0], events: fullClick, error: 'QIWI 1', scroll: true});
        await waitForCondition(() => ($getIFrame('#payments_frame').find('#payment_modal_container').length > 0)
                && ($getIFrame('#payments_frame').find('#amount').length > 0)
            /*&& ($getIFrame('#payments_frame').find('input[id^="phone_num"]').length > 0*/,
            333, 15000, 'Payform not visible for 15s');
        await delayPromise(3000);
        await clearAndSimulate($getIFrame('#payments_frame').find('#amount')[0], data.amount);
        if ($getIFrame('#payments_frame').find('input[id^="phone_num"]').length > 0) {
            await delayPromise(3333);
            await clearAndSimulate($getIFrame('#payments_frame').find('input[id^="phone_num"]')[0], data.login);
        }
        ourCommand.add('waitForDepositResult', true);
        await bMess('QIWI_COMMAND', true).set(ourCommand.get());
        increaseDelay = true;
        await delayPromise(1500);
        await mouseChain({
            target: $getIFrame('#payments_frame_popup').find('#deposit_button').length > 0
                ? $getIFrame('#payments_frame_popup').find('#deposit_button')[0]
                : $getIFrame('#payments_frame').find('#deposit_button')[0],
            //target: $getIFrame('#payments_frame').find('span.close:visible')[0],
            events: fullClick, error: 'QIWI 2'
        });
    };

    const depositSkrill = async data => {
        const $skrillEl = () => $getIFrame('#payments_frame').find('div.payment_item.skrill').first();
        await waitForCondition(() => $skrillEl().length > 0, 333, 15000, 'No SKRILL!');
        await delayPromise(1000);
        await mouseChain({target: $skrillEl()[0], events: fullClick, error: 'SKRILL 1', scroll: true});
        await waitForCondition(() => $getIFrame('#payments_frame').find('#payment_modal_container').length > 0,
            333, 15000, 'Payform not visible for 15s');
        await delayPromise(1000);
        await clearAndSimulate($getIFrame('#payments_frame').find('#amount')[0], data.amount);
        await delayPromise(3000);
        await mouseChain({
            target: $getIFrame('#payments_frame').find('span.select2-selection.select2-selection--single')[0],
            events: ['mousedown'], error: 'SKRILL 2'
        });
        await delayPromise(1000);
        await mouseChain({
            target: $getIFrame('#payments_frame').find('li.select2-results__option:contains("Skrill Wallet")')[0],
            events: fullClick, error: 'SKRILL 3'
        });
        ourCommand.add('waitForDepositResult', true);
        await bMess('SKRILL_COMMAND', true).set(ourCommand.get());
        increaseDelay = true;
        await delayPromise(1500);
        await mouseChain({
            target: $getIFrame('#payments_frame').find('#deposit_button')[0],
            //target: $getIFrame('#payments_frame').find('span.close:visible')[0],
            events: fullClick, error: 'SKRILL 4'
        });
    };

    const depositPM = async data => {
        await delayPromise(5000);
        const $pmEl = () => $getIFrame('#payments_frame')
            .find('div.payment_item[data-method="perfectmoney"]');
        await waitForCondition(() => $pmEl().length > 0, 333, 15000, 'No PM!');
        await delayPromise(1000);
        await mouseChain({target: $pmEl()[0], events: fullClick, error: 'PM 1', scroll: true});
        await waitForCondition(() => ($getIFrame('#payments_frame')
                    .find('#payment_modal_container').length > 0)
                && ($getIFrame('#payments_frame').find('#amount').length > 0)
            /*&& ($getIFrame('#payments_frame').find('input[id^="phone_num"]').length > 0*/,
            333, 15000, 'Payment form not visible for 15s');
        await delayPromise(3000);
        await clearAndSimulate($getIFrame('#payments_frame').find('#amount')[0], data.amount);
        ourCommand.add('waitForDepositResult', true);
        await bMess('PERFECT_COMMAND', true).set(ourCommand.get());
        increaseDelay = true;
        await delayPromise(1500);
        await mouseChain({
            target: $getIFrame('#payments_frame').find('#deposit_button')[0],
            //target: $getIFrame('#payments_frame').find('span.close:visible')[0],
            events: fullClick, error: 'PM 2'
        });
    };

    const depositPayeer = async data => {
        await delayPromise(5000);
        const $pmEl = () => $getIFrame('#payments_frame')
            .find('div.payment_item[data-method="payeer"]');
        await waitForCondition(() => $pmEl().length > 0,
            333, 15000, 'No Payeer!');
        await delayPromise(1000);
        await mouseChain({target: $pmEl()[0], events: fullClick, error: 'Payeer 1', scroll: true});
        await waitForCondition(() => ($getIFrame('#payments_frame')
                    .find('#payment_modal_container').length > 0)
                && ($getIFrame('#payments_frame').find('#amount').length > 0),
            333, 15000, 'Payment form not visible for 15s');
        await delayPromise(3000);
        await clearAndSimulate($getIFrame('#payments_frame').find('#amount')[0], data.amount);
        ourCommand.add('waitForDepositResult', true);
        await bMess('PAYEER_COMMAND', true).set(ourCommand.get());
        increaseDelay = true;
        await delayPromise(1500);
        await mouseChain({
            target: $getIFrame('#payments_frame').find('#deposit_button')[0],
            //target: $getIFrame('#payments_frame').find('span.close:visible')[0],
            events: fullClick, error: 'Payeer 2'
        });
    };

    const depositNeteller = async data => {
        await delayPromise(5000);
        const $pmEl = () => $getIFrame('#payments_frame')
            .find('div.payment_item[data-method^="neteller"]');
        const $email = () => $getIFrame('#payments_frame').find('#email');
        await waitForCondition(() => $pmEl().length > 0, 333, 15000, 'No Neteller!');
        await delayPromise(1000);
        await mouseChain({target: $pmEl()[0], events: fullClick, error: 'NTT 1', scroll: true});
        await waitForCondition(() => ($getIFrame('#payments_frame')
                    .find('#payment_modal_container').length > 0)
                && ($getIFrame('#payments_frame').find('#amount').length > 0)
            /*&& ($getIFrame('#payments_frame').find('input[id^="phone_num"]').length > 0*/,
            333, 15000, 'Payment form not visible for 15s');
        await delayPromise(3000);
        await clearAndSimulate($getIFrame('#payments_frame').find('#amount')[0], data.amount);
        if ($email().length > 0 && $email().val() !== data.login) {
            await delayPromise(3000);
            await clearAndSimulate($email()[0], data.login);
        }
        ourCommand.add('waitForDepositResult', true);
        await bMess('NETELLER_COMMAND', true).set(ourCommand.get());
        increaseDelay = true;
        await delayPromise(1500);
        await mouseChain({
            target: $getIFrame('#payments_frame').find('#deposit_button')[0],
            //target: $getIFrame('#payments_frame').find('span.close:visible')[0],
            events: fullClick, error: 'NTT 2'
        });
    };

    const depositYouMoney = async data => {
        await delayPromise(5000);
        const blocked = await blockedCodes(data.login);
        const codes = parseDCodes(data.pin).filter(c => blocked.indexOf(c) === -1);
        dLog('', '1X', ['Available codes:', codes]);
        if (codes.length < 2) {
            throw `We exhausted codes`;
        }
        ourCommand.add('codes', codes);
        const $pmEl = () => $getIFrame('#payments_frame')
            .find('div.payment_item[data-method="yandexkassa"]').eq(0);
        await waitForCondition(() => $pmEl().length > 0,
            333, 15000, 'No UMoney!');
        await delayPromise(1000);
        await mouseChain({target: $pmEl()[0], events: fullClick, error: 'UMoney 1', scroll: true});
        await waitForCondition(() => ($getIFrame('#payments_frame')
                    .find('#payment_modal_container').length > 0)
                && ($getIFrame('#payments_frame').find('#amount').length > 0),
            333, 15000, 'Payment form not visible for 15s');
        await delayPromise(3000);
        await clearAndSimulate($getIFrame('#payments_frame').find('#amount')[0], data.amount);
        ourCommand.add('waitForDepositResult', true);
        await bMess('YOU_MONEY_COMMAND').set(ourCommand.get());
        increaseDelay = true;
        await delayPromise(1500);
        await mouseChain({
            target: $getIFrame('#payments_frame').find('#deposit_button')[0],
            //target: $getIFrame('#payments_frame').find('span.close:visible')[0],
            events: fullClick, error: 'UMoney 2'
        });
    };

    const deposit = async data => {
        if (!psAllowed(data.paysystem)) {
            throw `For ${bkHere} allowed only PM!`
        }
        const modalClose = 'div.box-modal_close:visible';
        if (ourCommand.getAdded('waitForDepositResult')) {
            dLog('green', '1xSt', 'Waiting for DEPOSIT_RESULT');
            const res = await bMess('DEPOSIT_RESULT', true).get(200000, 60000);
            return {
                success: res.success,
                message: res.message || 'No message :(',
                balance: data.amount,
                wallet_balance: res.balance || ''
            };
        } else if (document.location.href.indexOf('/office/recharge') > -1) {
            dLog('', '1X', 'Point FOUR');
            waitForElement('button.popup_button_call_action:contains("Привязать"):visible',
                333, 15000)
                .then(() => mouseChain({target: $('#hidden-close')[0], events: ['click']}))
                .catch(e => e);
            if (data.paysystem === 'QIWI') {
                dLog('', '1X', 'Point FORTY ONE');
                await depositQiwi(data);
            } else if (data.paysystem === 'SKRILL') {
                dLog('', '1X', 'Point FORTY TWO');
                await depositSkrill(data);
            } else if (data.paysystem === 'PAYEER') {
                dLog('', '1X', 'Point FORTY FIVE');
                await depositPayeer(data);
            } else if (data.paysystem === 'PM') {
                dLog('', '1X', 'Point FORTY THREE');
                await depositPM(data);
            } else if (data.paysystem === 'NETELLER') {
                dLog('', '1X', 'Point FORTY FOUR');
                await depositNeteller(data);
            } else if (data.paysystem === 'YOU_MONEY') {
                dLog('', '1X', 'Point FORTY SIX');
                await depositYouMoney(data);
            } else {
                throw `Unsupported PS: ${data.paysystem}`;
            }
        } else if (document.location.href.indexOf('/office/account') === -1) {
            dLog('', '1X', 'Point THREE');
            if (document.location.href.indexOf('linebet') > -1) {
                await waitDelayClickF('div.top-acc__btn_office', 40000)();
                const $acc = await waitForElement('a[href="office/account/"]', 333, 15000);
                await delayPromise(1000);
                await mouseChain({target: $acc[0], events: fullClick, error: '$acc'});
            } else {
                await waitDelayClickF('a.submenu_link[href="office/account/', 40000)();
            }
        } else if ($(modalClose).length > 0) {
            dLog('', '1X', 'Point TWO');
            await waitDelayClickF(modalClose)();
        } else {
            dLog('', '1X', 'Point ONE');
            const rs = ['a.ap-left-nav__item_recharge', 'span.ap-banners__btn a[href="office/recharge/"]'];
            await waitForCondition(() => !!findSel(rs), 333, 15000,
                'No deposit button :(');
            await waitDelayClickF(findSel(rs))();
        }
        return await deposit(data);
    };

    const $gpf = () => $getIFrame('#payments_frame');

    const needBind = data => ['PM', 'NETELLER', 'PAYEER']
        .indexOf(data.paysystem) === -1 && parseInt(data.pin) !== 1;

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
            await delayPromise(1000);
            await mouseChain({
                target: $activeCalendar()
                    .find(`span.cell.day:textEquals("${ds[0].replace('0', '')}")`)[0],
                events: fullClick,
                error: 'Day'
            });
            await delayPromise(1000);
        }
    };

    const selectMulti = async (value, fieldName) => {
        const $row = $(`div.apm-form__caption:textEquals("${fieldName}")`)
            .closest('div.apm-form__field');
        await mouseChain({
            target: $row.find('div.multiselect__select')[0],
            events: fullClick,
            error: 'multiselect__select'
        });
        await delayPromise(500);
        if ($row.find('input.multiselect__input').length > 0) {
            await clearAndSimulate($row.find('input.multiselect__input')[0],
                value.substr(0, 3));
        }
        const $el = await waitForElement(`li.multiselect__element:textEquals("${value}") span`,
            333, 25000, true);
        await mouseChain({target: $el[0], events: fullClick, error: 'c$el'});
    };

    /*
    data = {
        second_name: 'Tuliev',
        first_name: 'Amman',
        date: '12-10-1981',
        passport: 'IRT1 123456',
        date_passport: '08-07-2006',
        issued_by: '123 department',
        adress: 'Kazakhstan; Nur-Sultan; Nazarbaev st. 18 - 56',
    };
     */

    const changeLang = async lang => {
        const langSel = findSel(['div.langDropTop_con span.name:visible',
            'div[data-modal="langsModal"] span.top-b__lang', 'button[aria-label="Language"]']);
        if ($(langSel).length > 0
            && $(langSel).trt() !== lang) {
            await mouseChain({target: $(langSel)[0], events: fullClick});
            await waitDelayClickF(findSel(`a[data-flaglng="${lang}"]`))();
            await delayPromise(100000);
        }
    };

    const fillRegData = async data => {
        await anticaptchaOnOff(false);
        if (document.location.href.indexOf('/office/account/') === -1) {
            await goAccount();
            await delayPromise(100000);
        }
        if ($(`div.apm-form__caption:textEquals("Страна")`)
            .closest('div.apm-form__field')
            .find('span.apm-form-value__text').trt() === 'Россия') {
            throw 'Filling form for Russia is not supported yet!';
        }
        await changeLang('en');
        const $afsw = await waitForElement('div.apm-form__switch', 333, 15000);
        if (!$afsw.hasClass('active')) {
            await delayPromise(3000);
            await mouseChain({target: $afsw[0], events: fullClick, error: '$afsw'});
            await delayPromise(3000);
        }
        const {fields, regData} = getFieldsAndRegData(data);
        for (const field of Object.keys(fields)) {
            const $row = $(`div.apm-form__caption:textEquals("${fields[field]}")`)
                .closest('div.apm-form__field');
            if ($row.find('div.multiselect__select').length > 0) {
                await selectMulti(regData[field], fields[field]);
                await delayPromise(getRandomRounded(2500, 4500));
            } else if ($row.find('div.vdp-datepicker').length > 0) {
                await selectDatePicker(regData[field], fields[field]);
                await delayPromise(getRandomRounded(2500, 4500));
            } else if ($row.find('input').length > 0) {
                await clearAndSimulate($row.find('input')[0], regData[field]);
                await delayPromise(getRandomRounded(2500, 4500));
            }
        }
        ourCommand.add('fillingForm', false);
        await mouseChain({target: $afsw[0], events: fullClick, error: '$afsw2'});
        await delayPromise(3000);
        await checkAnticaptcha();
        await mouseChain({
            target: $('button.apm-form__btn_save')[0], events: fullClick, error: 'afbs', scroll: true
        });
        await delayPromise(5000);
        await changeLang('ru');
    };

    const getFieldsAndRegData = data => {
        const regData = {
            'second_name': data.second_name,
            'first_name': data.first_name,
            'date': data.date,
            'passport': data.passport,
            'date_passport': data.date_passport,
            'city': data.adress.split(';')[1].trim(),
            'address': data.adress.split(';')[2].trim(),
        };
        const fields = {
            'second_name': 'Surname',
            'first_name': 'First name',
            'date': 'Date of birth',
            'address': 'Permanent residence address',
        };
        if (!Object.keys(fields).every(s => $(`div.apm-form__caption:textEquals("${fields[s]}")`).length > 0)) {
            throw `Some fields does not exists on the reg. form!`
        }
        const cityPresent = $(`div.apm-form__caption:textEquals("City")`).length > 0;
        if (!cityPresent) {
            regData.address = `${data.adress.split(';')[1].trim()}, ${data.adress.split(';')[2].trim()}`;
        }
        const country = $(`div.apm-form__caption:textEquals("Country")`).parent()
            .find('span.apm-form-value__text').trt();
        const isForeign = !data.issued_by || data.issued_by.length === 0;
        if (['Kazakhstan', 'Armenia', 'Ukraine', 'Azerbaijan', 'Azerbaijan'].indexOf(country) > -1) {
            fields['document_type'] = 'Type of document';
            regData['document_type'] = isForeign ? 'Foreign passport' : 'Passport (ID document)';
            fields.passport = isForeign ? 'Travel passport number' : 'Document number';
            fields.date_passport = isForeign ? 'Passport Issue Date' : 'Document issue date';
            regData['passport'] = isForeign ? data.passport : data.passport.split(' ')[1];
            if (!isForeign) {
                fields['passport_series'] = 'Document series';
                regData['passport_series'] = data.passport.split(' ')[0];
                fields['issued_by'] = 'Issued by';
                regData['issued_by'] = data.issued_by;
            }
            if (country === 'Kazakhstan') {
                fields['region'] = 'Region';
                regData['region'] = ({
                    'Almaty Region': 'Almaty',
                    'Kokshetau': 'Kokshetau',
                    'Nur-Sultan': 'Nur-Sultan',
                    'Pavlodar Region': 'Pavlodar',
                    'Turkistan Region': 'Shymkent',
                })[regData.city];
                fields['city'] = 'City';
                if (regData.city === 'Nur-Sultan') {
                    regData.city = 'Nursultan';
                }
            } else if (country === 'Ukraine') {
                const combo = [
                    {region: 'Cherkasskaya obl.', city: 'Cherkassy'},
                    {region: 'Dnepropetrovskaya obl.', city: 'Dnipro'},
                    {region: 'Harkovskaya obl.', city: 'Kharkiv'},
                    {region: 'Ivano-Frankovskaya obl.', city: 'Ivano-Frankovsk'},
                    {region: 'Kievskaya obl.', city: 'Kiev'},
                    {region: 'Lvovskaya obl.', city: 'Lvov'},
                    {region: 'Odesskaya obl.', city: 'Odessa'},
                ][getRandomRounded(0, 6)];
                fields['region'] = 'Region';
                regData['region'] = combo.region;
                fields['city'] = 'City';
                regData['city'] = combo.city;
            } else if (cityPresent) {
                fields['city'] = 'City';
            }
        } else {
            fields.passport = 'Document number';
            fields.date_passport = 'Document issue date';
            if (cityPresent) {
                fields['city'] = 'City';
            }
        }
        return {fields, regData};
    };

    const anticaptchaOnOff = async enable => {
        window.postMessage({
                receiver: 'antiCaptchaPlugin',
                type: 'setOptions',
                options: {
                    enable: !!enable,
                },
            }, window.location.href
        );
        await delayPromise(1000);
        dLog('red', '1X', `AntiCaptcha plugin enabled? ${enable}`);
    };

    const checkAnticaptcha = async () => {
        await anticaptchaOnOff(true);
        if ($('div.g-recaptcha').length > 0) {
            window.postMessage({
                    receiver: 'antiCaptchaPlugin',
                    type: 'solveRecaptcha',
                    containerSelector: '.g-recaptcha',
                }, window.location.href
            );
            dLog('red', '1X', `Need Solve sent!`);
            await delayPromise(10000);
        }
        const $antic = () => $('div.antigate_solver a.status');
        if ($antic().length > 0 && $antic().trt().indexOf('Outdated') > -1) {
            dLog('orange', '1X', 'RECAPTCHA - refresh!');
            await mouseChain({
                target: $('div.antigate_solver a.control.reload')[0],
                events: fullClick, error: 'reRecap'
            });
            await delayPromise(5000);
        }
        if ($antic().length > 0 && $antic().trt() !== 'Solved') {
            dLog('orange', '1X', 'Waiting for RECAPTCHA!');
            await waitForCondition(() => $antic().trt() === 'Solved',
                333, 200000, 'Recaptcha not solved!');
            dLog('orange', '1X', 'Recaptcha SOLVED!');
        }
    };

    /**
     * Return time diff between dates in minutes
     * @param {string} startStr - 18.09.2020 17:32
     * @param {string} finishStr - 19:22
     * @returns {number}
     */
    const timesDiff = (startStr, finishStr) => {
        try {
            const start = new Date();
            const finish = new Date();
            const dParts = startStr.split(' ')[0].split('.');
            const tParts = startStr.split(' ')[1].split(':');
            //start.setFullYear(parseInt(dParts[2]), parseInt(dParts[1]) - 1, parseInt(dParts[0]));
            start.setHours(parseInt(tParts[0]), parseInt(tParts[1]));
            finish.setHours(parseInt(finishStr.split(':')[0]),
                parseInt(finishStr.split(':')[1]));
            return Math.abs(finish - start) / 60000;
        } catch (e) {
            throw `timesDiff error: ${e}`
        }
    };

    const checkWithdrawalFinished = async data => {
        dLog('orange', '1X', `checkWithdrawalFinished`);
        await changeLang('ru');
        const $gpf = () => $getIFrame('#payments_frame');
        const checkStatus = async () => {
            // Open if closed
            if ($gpf().find('div.requests_output').length > 0
                && !$gpf().find('div.requests_output').hasClass('open_list')) {
                await mouseChain({
                    target: $gpf().find('div.requests_output')
                        .find('i.fa-angle-double-down:visible')[0],
                    events: fullClick,
                    error: 'ro'
                });
                await delayPromise(1000);
            }
            await mouseChain({
                target: $gpf().find('div.update_status')[0], events: fullClick, error: 'UpdateSt'
            });
            await delayPromise(1000);
            const $row = $gpf().find('div[class="requests_output_row"]').first();
            if ($row.length > 0) {
                const diff = timesDiff(
                    $row.find('div.requests_data').first().text()
                        .replace('(', '').replace(')', '').trim(),
                    ourCommand.getAdded('withdrawalClicked'));
                const $state = $row.find('span[onclick^="alerts"]');
                const reasonDraft = $state.attr('onclick');
                const reason = !!reasonDraft === false ? '' : reasonDraft
                    .replace('alerts(', '').replace(')', '')
                    .replace(/[',"]/g, '').trim();
                dLog('', '1X', `Step 1 - ${diff}/${reason}/${$state.trt()}`);
                if (diff < 15 && reason !== '') {
                    throw `LIMITED: ${reason}`;
                } else if (diff < 15 && $state.trt() === 'Одобрено') {
                    return {res: true, success: false};
                } else if (diff < 15) {
                    return {res: true, success: false};
                }
            }
            return {res: false, success: false};
        };
        if (!ourCommand.getAdded('statusChecked')) {
            // Hint: Step 1 - wait for reject status
            dLog('', '1X', 'Step 1');
            const started = Date.now();
            let res = {res: false, success: false};
            do {
                await delayPromise(1000);
                res = await checkStatus();
                if (res.success) {
                    return {success: true, message: 'Request confirmed (Step 1)!'};
                }
            } while (!res.res && Date.now() - started < 65000);
            ourCommand.add('statusChecked', true);
            return await checkWithdrawalFinished(data);
        } else if (!ourCommand.getAdded('historyChecked')) {
            // Hint: Step 2 - go to withdrawal history and check there
            dLog('', '1X', `Step 2 started ${document.location.href} => `
                + `${ourCommand.getAdded('historyCheckedStarted')}`);
            if (document.location.href.indexOf('/office/historypay/') > -1) {
                if (!ourCommand.getAdded('historyCheckedStarted')) {
                    ourCommand.add('historyCheckedStarted', Date.now());
                }
                if (Date.now() - ourCommand.getAdded('historyCheckedStarted') < 1900000) {
                    const $row = await waitForElement('div.apm-flow__field:first', 333, 15000)
                        .catch(() => $([]));
                    if ($row.length > 0) {
                        await delayPromise(1000);
                        const diff = timesDiff($row.find('div.apm-flow__date').first().trt(),
                            ourCommand.getAdded('withdrawalClicked'));
                        const test = $row.find('div.apm-flow__desc').first().trt();
                        dLog('green', '1X',
                            `Step 2 - History check! `
                            + `${(Date.now() - ourCommand.getAdded('historyCheckedStarted'))}, `
                            + `${diff} - ${test}`);
                        // Hint: here we probably have to add the deposit check
                        dLog('green', '1X', `Step 2 - ${diff}/${test}`);
                        if (diff < 20) {
                            if (test.indexOf('Подтвержден оператором') > -1) {
                                return {success: true, message: 'Request confirmed by operator (Step 2)!'};
                            } else if (test.indexOf('заполнить все поля') > -1) {
                                ourCommand.add('fillingForm', true);
                                await fillRegData(data);
                                await delayPromise(100000);
                            } else if (test.indexOf('Отказ') > -1) {
                                throw `LIMITED: ${test}`;
                            }
                        }
                    }
                    const sleep = getRandomRounded(45000, 70000);
                    dLog('', '1X', `We'll wait ${sleep} and when reload page!`);
                    await delayPromise(sleep);
                    increaseDelay = true;
                    document.location.reload();
                    await delayPromise(3000);
                    return await checkWithdrawalFinished(data);
                } else {
                    throw `No result on step 2 for ${(Date.now() - ourCommand.getAdded('historyCheckedStarted'))}!`;
                }
            } else if (document.location.href.indexOf('/office/account/') === -1) {
                await goAccount();
                await delayPromise(3000);
                return await checkWithdrawalFinished(data);
            } else if (document.location.href.indexOf('/office/account/') > -1) {
                const $hist = await waitForElement('a[href$="/office/historypay/"]',
                    333, 15000);
                await delayPromise(1000);
                await mouseChain({
                    target: $hist[0],
                    events: fullClick,
                    error: 'account'
                });
                await delayPromise(3000);
                return await checkWithdrawalFinished(data);
            } else {
                throw `We are somewhere not there ${document.location.href}`;
            }
        } else {
            throw `Unexpected situation ${ourCommand.getAdded('statusChecked')}/`
            + `${ourCommand.getAdded('historyChecked')}/${ourCommand.getAdded('historyCheckedStarted')}: `
            + `${document.location.href}`;
        }
    };

    const withdraw = async data => {
        if (!psAllowed(data.paysystem)) {
            throw `For ${bkHere} allowed only PM!`
        }
        dLog('blue', '1X', `Withdraw: ff: ${ourCommand.getAdded('fillingForm')}, `
            + `cwf: ${ourCommand.getAdded('checkWithdrawalFinished')}`);
        if (ourCommand.getAdded('fillingForm')) {
            return await fillRegData(data);
        } else if (ourCommand.getAdded('checkWithdrawalFinished')) {
            return await checkWithdrawalFinished(data);
        }
        await changeLang('ru');
        if (needBind(data) && !ourCommand.getAdded('sms_api_request_id')) {
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
            //if (data.email !== '') {
            //    await withdrawEmail(data);
            //} else {
            const pName = ({
                'QIWI': 'qiwi',
                'PM': 'perfectmoney',
                'SKRILL': 'skrill',
                'NETELLER': 'neteller',
                'PAYEER': 'payeer',
            })[data.paysystem];
            const psSel = `div.payment_item.${pName}`;
            await waitForCondition(() => $gpf().find(psSel).first().length > 0,
                333, 15000, 'No PS!');
            await delayPromise(1000);
            await mouseChain({
                target: $gpf().find(psSel).first()[0],
                events: fullClick, scroll: true, error: 'PS click',
            });
            await waitForCondition(() => ['#payment_modal_container', '#amount']
                    .every(s => $gpf().find(s).length > 0),
                333, 15000, 'Pay form not visible for 15s');
            await delayPromise(3500);
            await clearAndSimulate($gpf().find('#amount')[0],
                parseInt(data.amount) === -1 ? getBalance() : data.amount);
            if ($gpf().find('#email').length > 0
                && $gpf().find('#email').val() !== data.login) {
                await delayPromise(2000);
                await clearAndSimulate($gpf().find('#email')[0], data.login);
            }
            if ($gpf().find('#account').length > 0
                && $gpf().find('#account').val()
                !== (data.paysystem === 'PM' ? data.pin : data.login)) {
                await delayPromise(2000);
                await clearAndSimulate($gpf().find('#account')[0],
                    data.paysystem === 'QIWI' ? data.phone : data.paysystem === 'PM' ? data.pin : data.login);
            }
            increaseDelay = true;
            await delayPromise(3500);
            ourCommand.add('withdrawalClicked',
                $(findSel(['span.timeButTop', 'span.top-b__time'])).trt());
            await mouseChain({
                target: $gpf().find('#withdraw_button')[0],
                events: fullClick, error: 'withdraw_button',
            });
            await delayPromise(3500);
            const $code = $gpf().find('input[name="confirm_code"]:visible');
            if ($code.length > 0) {
                dLog('blue', '1X', 'We awaiting for sms...');
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
            await waitForCondition(() => $gpf().find('button.alerts-ok').length > 0,
                333, 100000, 'No OK!');
            const error = $gpf().find('div.alerts-text').trt().toLowerCase();
            if (error.length > 0) {
                await clickOk();
                if (error.indexOf('документов') > -1) {
                    throw `LIMITED: ${error}`;
                } else if (error.indexOf('заполнить все поля') > -1) {
                    ourCommand.add('fillingForm', true);
                    await clickOk();
                    await fillRegData(data);
                    await delayPromise(100000);
                }
            } else {
                await clickOk();
            }
            ourCommand.add('checkWithdrawalFinished', true);
            return await checkWithdrawalFinished(data);
            //}
        } else if (document.location.href.indexOf('/office/manager/') > -1) {
            await mouseChain({target: $('a[href="office/deduce/"]')[0], events: fullClick, error: 'deduce'});
        } else if (document.location.href.indexOf('/office/account') === -1) {
            await goAccount();
        } else {
            if ($('div.apm-form__head:contains("Загрузка документа"):visible').length > 0) {
                throw 'Account is LIMITED';
            } else {
                const $deduce = await waitForElement('a.ap-left-nav__item_deduce', 333, 15000);
                await delayPromise(1500);
                await mouseChain({target: $deduce[0], events: fullClick, error: 'deduce'});
            }
        }
        await delayPromise(3500);
        return await withdraw(data);
    };

    const goAccount = async () => {
        if (document.location.href.indexOf('linebet') > -1) {
            await waitDelayClickF('div.top-acc__btn_office', 40000)();
            const $acc = await waitForElement('a[href="office/account/"]', 333, 15000);
            await delayPromise(3000);
            await mouseChain({target: $acc[0], events: fullClick, error: '$acc'});
        } else {
            await waitDelayClickF('a.submenu_link[href="office/account/', 40000)();
        }
    };

    const checkLimited = async internal => {
        if (window.location.href.indexOf('/live/') === -1 || window.location.href.split('/').length >= 7) {
            const $lh = await waitForElement('#live_href', 333, 10000);
            await mouseChain({target: $lh[0], events: ['click'], scroll: true, error: 'LIVE_HREF'});
            await delayPromise(3000);
        }
        await mouseChain({
            target: $(`a.b-filters__sport div.b-filters__sport-name:textEquals("Все")`)[0],
            events: fullClick, error: 'All sports'
        });
        await delayPromise(3000);
        ourCommand.add('is_limited', false);
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
            const $coefs = $row.find('div.c-bets .c-bets__bet');
            m = 1 / parseFloat($coefs.eq(tbIdx).trt()) + 1 / parseFloat($coefs.eq(tmIdx).trt());
            dLog('green', '1X',
                `TO: ${$coefs.eq(tbIdx).trt()}, TU: ${$coefs.eq(tmIdx).trt()}, m: ${m}`);
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

    const collectBetResults = async inD => {
        if (ourCommand.get().check_limited && !ourCommand.getAdded('limited_checked')) {
            await checkLimited(true);
        }
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        dLog('green', '1X', [`collectBetResults, limit: ${limit}, data:`, data]);
        await delayPromise(3000);
        const clickBets = async () => {
            const $bets = await waitForElement([
                'a.ap-left-nav__item_history',
                'div.ap-left-nav__item_history',
            ], 333, 10000);
            await mouseChain({target: $bets[0], events: fullClick, scroll: true, error: 'St1Bets'});
            await delayPromise(3000);
        };
        if (window.location.href.indexOf('/office/history') > -1) {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const delta = d.toISOString().substring(0, 10).split('-');
            const dfSel = findSel(['#datefrom', 'div.vdp-datepicker:first input']);
            let dateStringParsed = $(dfSel).val().split('-');
            if (/* year */ dateStringParsed[2] !== delta[0]
                || /* month */ dateStringParsed[1] !== delta[1]
                || /* day */ dateStringParsed[0] !== delta[2]) {
                dateStringParsed[2] = delta[0];
                dateStringParsed[1] = delta[1];
                dateStringParsed[0] = delta[2];
                //$(dfSel).val(dateStringParsed.join('-'));
                await selectDatePicker(dateStringParsed.join('-'), $(dfSel), 'ru')
                await delayPromise(3000);
                await mouseChain({
                    target: $('button.apm-filters__btn_alt.show_history')[0],
                    events: fullClick,
                    error: 'afb'
                });
                dLog('green', '1X', "Show has been clicked");
                await delayPromise(3000);
            }
        } else if (window.location.href.indexOf('/office/account') > -1) {
            await clickBets();
            return await collectBetResults(inD);
        } else {
            if (document.location.href.indexOf('linebet.com') > -1) {
                const $tad = await waitForElement('div.top-acc__dropdown > div', 333, 10000);
                if ($tad.attr('style') === 'display: none;') {
                    $tad.attr('style', 'display: block;');
                    await delayPromise(1000);
                }
                const $hst = await waitForElement('div.top-acc__dropdown a[href="office/history"]',
                    333, 1000);
                await mouseChain({target: $hst[0], events: fullClick, scroll: true, error: '$hst'});
                await delayPromise(3000);
            } else {
                const $account = await waitForElement('a.submenu_link:visible', 333, 10000);
                await mouseChain({target: $account[0], events: ['click'], scroll: true, error: '$account'});
                await delayPromise(3000);
                await clickBets();
            }
        }
        await waitForElement('div.apm-panel-head__info', 777, 20000)
            .catch(() => dLog('red', '1x', 'no bets!'));
        // Hint: start collecting
        await $('section.apm-panel').eachAsync(async function (idx) {
            if (idx >= limit) {
                return false;
            }
            const $this = $(this);
            await mouseChain({
                target: $this.find(
                    findSelIn(['div.apm-panel-head__expand', 'button.apm-panel-head__expand'], $this)
                )[0],
                events: ['click'],
                scroll: true,
                error: 'daphe',
            });
            await waitForCondition(() => $this.find('div.apm-panel__body')
                    .attr('style').trim() === 'display: block;',
                333, 17000, 'panel__body');
            const external_id = $this.find(
                findSelIn(['p.apm-panel-head__text[title^="Купон №"]', 'p.apm-panel-head__text b'], $this)
            ).text().replace(/[^\d]/g, '').trim();
            if (data.length === 0 || data.indexOf(external_id) > -1) {
                let stake = parseFloat($this.find('p.apm-panel-head__subtext:contains("Ставка")')
                    .next().text().replace(',', '.')
                    .replace(/[^\d.]/g, '').trim());
                const coef = parseFloat($this.find('div.apm-panel-head__coef').text()
                    .replace(',', '.').replace(/[^\d.]/g, '').trim());
                let match = $this.find('div.apm-panel-head__block_name p.apm-panel-head__text')
                    .trt();
                let bkPivot = $this.find(
                    findSelIn([
                        'div.app-coupon-details p:contains("Событие") + p.app-coupon-details__value:first',
                        '',
                    ], $this)
                ).trt();
                const result = parseFloat($this.find(
                    findSelIn(['p.apm-panel-head__subtext[title^="Выигрыш"]',
                        'p.apm-panel-head__subtext:textEquals("Выигрыш")'], $this)
                ).next().text().replace(',', '.')
                    .replace(/[^\d.]/g, '').trim());
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
            }
            await mouseChain({
                target: $this.find(
                    findSelIn(['div.apm-panel-head__expand', 'button.apm-panel-head__expand'], $this)
                )[0],
                events: ['click'],
                scroll: true,
                error: 'daphe2',
            });
            await delayPromise(777);
        });
        await delayPromise(1000);
        // redirect live
        await mouseChain({target: $('#live_href')[0], events: fullClick, scroll: true, error: '$live'});
        return {success: true, message: collected};
    };

    const commands = new class commands {
        constructor() {
            this.cLinks = {
                'BET': proceedBet,
                'EXPRESS_BET': proceedBet,
                'BET_RESULT': collectBetResults,
                'DEPOSIT': deposit,
                'WITHDRAW': withdraw,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data) {
            currentBetData.init(data);
            dLog('green', '1X', [command, data]);
            const res = await this.cLinks[command](data).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', '1X', `${command} result: ${res.message}`);
            port.postMessage(this.prepareResult(command, res));
            if (command === 'WITHDRAW' && needBind(data)) {
                bsSendSmsApi(port, 'BIND_RELEASE', {
                    "websocket_uid": settings.uid,
                    "request_id": ourCommand.getAdded('sms_api_request_id')
                });
            } else if (command === 'WITHDRAW') {
                await anticaptchaOnOff(true);
            }
            if (!res) {
                throw error;
            }
            return res;
        }

        prepareResult(command, res) {
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                const resultData = {
                    "external_id": res.success ? res.message.external_id : '',
                    "status": res.success ? 'ACCEPTED'
                        : ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED', 'MAXIMUM_0']
                        .find(t => res.message.indexOf(t) > -1) || 'FAILED',
                    "market": currentBetData.data[0].market,
                    "target": currentBetData.data[0].target,
                    "pivot": currentBetData.data[0].pivot,
                    "coef": res.success ? res.message.coef : currentBetData.data[0].coef,
                    "stake": res.success ? res.message.stake : currentBetData.data[0].stake,
                    "maximum": currentBetData.max,
                };
                return {
                    answered: "BET",
                    data: resultData,
                    answer: res.success ? 'Everything is Okay!'
                        : (resultData.status === 'MAXIMUM_0' ? 'Tried to bet 0' : res.message)
                };
            } else if (command === 'BET_RESULT') {
                return {
                    answered: "BET_RESULT",
                    status: res.success ? "success" : "error",
                    answer: res.message,
                    limited: ourCommand.get().check_limited && ourCommand.getAdded('is_limited'),
                };
            } else if (command === 'DEPOSIT') {
                return {
                    answered: "DEPOSIT",
                    status: res.success ? 'SUCCESS' : (res.message.indexOf('NO_FUNDS') > -1 ? 'NO_FUNDS' : "FAILED"),
                    answer: res.message,
                    balance: res.balance,
                    wallet_balance: res.wallet_balance || '',
                };
            } else if (command === 'WITHDRAW') {
                if (!res.success && res.message.indexOf('LIMITED') > -1
                    && res.message.indexOf('не соответствуют суммам ставок') > -1) {
                    res.message = res.message.replace('LIMITED', '');
                }
                return {
                    answered: "WITHDRAW",
                    status: res.success ? "SUCCESS" : res.message.indexOf('LIMITED') > -1 ? "LIMITED" : "FAILED",
                    answer: res.message
                };
            } else {
                return {};
            }
        }
    }

    const messageProcessor = message => {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;

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

        if (message.action === 'CHECK_LIMITED') {
            waitForCondition(() => !busy, 100, 1800000, 'still busy')
                .then(async () => {
                    setBusy(true);
                    ourCommand.set(message);
                    await checkLimited().catch(e => dLog('red', 'Olimp',
                        `Error till checkLimited ${e}, ${formatStack(e.stack)}`));
                    dLog('blue', '1X', `CHECK_LIMITED done`);
                    setBusy(false);
                    ourCommand.clear();
                })
                .catch(e => dLog('red', '1X', `Error till CHECK_LIMITED ${e}, ${formatStack(e.stack)}`));
        } else if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
        } else if (message.action === 'SMS_API' && typeof message.data !== 'undefined') {
            smsApiMessage.setMessage(message.data.status, message.data.message);
        } else if (message.action === "auth") {
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.phone = message.phone;
            settings.email = message.email;
            settings.uid = message.uid;
            settings.second_name = message.second_name || '';
            authCheck();
        } else if (busy) {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY"
            });
        } else if ($('#enter').length !== 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (commands.exists(message.action)) {
            // Hint: execute command
            setBusy(true);
            ourCommand.set(message);
            commands.execute(message.action, message.data)
                .finally(() => {
                    setBusy(false);
                    ourCommand.clear();
                });
        } else {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: `${message.action} not supported!`
            });
        }
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('green', '1xO', ['Command was set till unload:', ourCommand.get()]);
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess('ONEX_COMMAND', true).set(ourCommand.get(), increaseDelay ? 180000 : 0);
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});
        bMess('ONEX_COMMAND', true).check(40000, true)
            .then(currentCommand => {
                dLog('orange', '1X', [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`, currentCommand]);
                messageProcessor(currentCommand);
            })
            .catch(() => dLog('color: darkgray;', '1X', 'No command!'));
        // Removing recaptcha
        //$('form.auth__form div.grecaptcha-badge').remove();
        if (document.location.href.indexOf('/account/') === -1) {
            waitForElement('div.c-registration__fields div.grecaptcha-badge', 333, 10000)
                .then($el => $el.remove())
                .catch(() => {
                });
            waitForElement('iframe[title="проверка recaptcha"]', 333, 10000)
                .then($el => $el.eq(1).remove())
                .catch(() => {
                });
        } else {
            // Note - here account page!
            waitForElement('#office_account_save_profile div.grecaptcha-badge', 333, 10000)
                .then($el => {
                    const langSel = findSel(['div.langDropTop_con span.name:visible',
                        'div[data-modal="langsModal"] span.top-b__lang']);
                    if ($(langSel).trt() !== 'en') {
                        $el.remove();
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
                    }
                })
                .catch(() => {
                });
        }
    }

})();
