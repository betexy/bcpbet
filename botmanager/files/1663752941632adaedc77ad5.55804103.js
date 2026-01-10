(function () {

    "use strict";

    /**
     * @import libs/jquery-3.3.1.min.js
     */

    let newAPI = false;
    let authClicked = 0;
    let busy = false;
    let increaseDelay = false;
    let decSelected = false;

    const port = chrome.runtime.connect({name: 'port_betwinner'});
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
        bMess('betwinner_busy').set(busy).finally();
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
        const $b = $('span.account-select-toggle__value');
        if ($b.length > 0) {
            return parseFloat($b.text().replace(',', '')
                .replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    }

    const authCheck = function () {
        (async () => {
            const $logLink = $('button span.caption__label:textEquals("Вход")');
            const needClose = ['div.pf-subs-btn a[href="#deny"]:visible'];
            await changeLang('ru');
            if (checkSE(needClose)) {
                await mouseChain({target: $(findSel(needClose))[0], events: fullClick, error: '$deny or $ok'});
            }
            if ($logLink.length > 0) {
                // Hint: Log In
                port.postMessage({m: "tech works! 2"});
                await delayPromise(1000);
                await tryToLogIn($logLink).catch(e => bsError(port, 'Error login: ' + e));
            } else {
                setBusy(busy);
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch(e => dLog('red', 'Betwinner', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const tryToLogIn = async ($logLink) => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        if ($logLink.length !== 1) {
            throw 'No $logLink!';
        }
        const lSels = ['input[placeholder="Ваш E-mail или ID"]:visible'];
        const pSels = ['input[placeholder="Пароль"]:visible'];
        const eSels = 'button.auth-form-fields__submit';
        authClicked = Date.now();
        await mouseChain({target: $logLink[0], events: fullClick, scroll: true});
        await waitForCondition(() => lSels.some(s => $(s).length > 0), 333, 10000, 'No inputs!');
        const sType = lSels.findIndex(s => $(s).length > 0);
        dLog('green', 'Betwinner', `tryToLogIn: use sType ${sType}`);
        await mouseChain({target: $(pSels[sType])[0], events: fullClick});
        await delayPromise(100);
        await clearAndSimulate($(pSels[sType])[0], settings.password, true, true, true);
        await delayPromise(500);
        await mouseChain({target: $(lSels[sType])[0], events: fullClick});
        await delayPromise(100);
        await clearAndSimulate($(lSels[sType])[0], settings.login, true, true, true);
        await delayPromise(500);
        if ($('span.selection-ico-checkbox--checked').length === 0) {
            await mouseChain({target: $('span.selection-ico-checkbox')[0], events: fullClick});
            await delayPromise(500);
        }
        await mouseChain({target: $(eSels)[0], events: fullClick});
        authClicked = Date.now();
        dLog('green', 'Betwinner', 'Auth clicked!');
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
        dLog('red', 'Betwinner', ['openEvent', data]);
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
            dLog('red', 'Betwinner', `switchToLeague: ${leagueIn}/${leagues}`);
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
            dLog('red', 'Betwinner', `switchToSport: ${sport}`);
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
            dLog('green', 'Betwinner', `switchToS: '${$(msSel).trt()}' === '${s}'`);
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
            dLog('green', 'Betwinner', 'performGet: ' + (Date.now() - performGetStarted));

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
        dLog('green', 'Betwinner', ['openCoupon, paramData:', paramData]);
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
            dLog('green', 'Betwinner', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'Betwinner', 'Event must be opened!');
            const $element = await getBetElement(data);
            console.log($element);
            let coefWeWaitFor = $element.trt();
            dLog('green', 'Betwinner', 'We got element! Coef: ' + coefWeWaitFor);
            $element[0].scrollIntoView();
            if (!elementIsVisible($element[0])) {
                window.scrollBy(0, -110);
            }
            const waitForCouponVisibleStarted = Date.now();
            let elementWasClicked = 0;
            let performElementClick = async function () {
                dLog('green', 'Betwinner', 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                    + ') /' + (Date.now() - elementWasClicked));
                await mouseChain({target: $element.parent()[0], events: ['click'], error: 'performElementClick'})
                elementWasClicked = Date.now();
            };
            const checkCoupon = () => {
                let event = (data.team1 + ' - ' + data.team2).toLowerCase();
                let result = false;
                $('div.coupon div.o-bet-box-list__item').each(function () {
                    let $teams = $(this).find('div.c-bet-box__row > div.c-bet-box__img-con:has(img.c-bet-box__img)');
                    if ($teams.length === 0) {
                        $teams = $(this).find('div.c-bet-box__row > div.c-bet-box__row');
                    }
                    if ($teams.length === 2) {
                        let ev;
                        if (data.sport.indexOf('TENNIS') > -1) {
                            ev = $teams.eq(0).text().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
                        } else {
                            ev = $teams.eq(0).parent().trt() + ' - ' + $teams.eq(1).parent().trt();
                        }
                        ev = ev.toLowerCase();
                        if (event === ev || locutus_similar_text(event, ev, true) > 60) {
                            result = true;
                            return false;
                        } else {
                            dLog('red', 'Betwinner', `'${ev}' !== '${event}'`);
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
                let max = parseFloat(
                    $('div.coupon-grid__row:has(span.coupon__text:contains("Максимальная ставка")) button')
                        .text().replace(/\s/g, '').trim());
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
                dLog('red', 'Betwinner', `Express here! ${i}/${(paramData.length - 1)}`);
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
        const $coupons = $('div.coupon').find('div.o-bet-box-list__item');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const test = $(this).find('div.c-bet-box__row div.c-bet-box__row_full').trt();
            const $teams = $(this).find('div.c-bet-box__row > div.c-bet-box__img-con:has(img.c-bet-box__img)');
            const match = $teams.length === 2 ? `${$teams.eq(0).parent().trt()} - ${$teams.eq(1).parent().trt()}` : test;
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
            dLog('green', 'Betwinner', `Will place (performBet): ${willPlace}, balance: ${getBalance()}`);
            const $input = $('div.coupon__bet-settings input.c-spinner__input');
            if ($input.length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            await clearAndSimulate($input[0], willPlace.toString().replace('.00', '').trim());
            await delayPromise(800);
            dLog('green', 'Betwinner', `STAKE entered ${willPlace}`);
            const $el = await waitForElement('div.coupon__bet-settings input.c-spinner__input',
                333, 3333);
            let entered = parseFloat($el.val());
            dLog('green', 'Betwinner', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'Betwinner', 'Entered !== willPlace - try to reenter!');
                continue;
            }
            const $placeBtn = $('div.coupon-btn-group__item button:contains("сделать ставку")');
            if ($placeBtn.length === 0) {
                throw 'No place button or button disabled!';
            }
            await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
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
    
    const changeLang = async lang => {
        const $langSel = $('span.application-settings-panel').children().eq(2).find('button');
        if ($langSel.attr('aria-label') !== 'Язык') {
            await mouseChain({target: $langSel[0], events: fullClick});
            const $langCode = await waitForElement(`span.language-settings-dropdown-link__country-code:textEquals("${lang}")`, 333, 10000);
            await mouseChain({target: $langCode[0], events: fullClick});
            await delayPromise(88000);
        }
    };

    const checkLimited = async internal => {
        if (window.location.href.indexOf('/live/') === -1 || window.location.href.split('/').length >= 7) {
            const $lh = await waitForElement('#live_href', 333, 10000);
            await mouseChain({target: $lh[0], events: ['click'], scroll: true, error: 'LIVE_HREF'});
            await delayPromise(3000);
        }
        await mouseChain({
            target: $(`a.b-filters__sport:has(div.b-filters__sport-name:textEquals("Все"))`)[0],
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
            dLog('green', 'Betwinner',
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
        dLog('green', 'Betwinner', [`collectBetResults, limit: ${limit}, data:`, data]);
        await delayPromise(3000);
        const clickBets = async () => {
            const $bets = await waitForElement([
                'a.ap-left-nav__item_history',
                'div.ap-left-nav__item_history',
            ], 333, 10000);
            await mouseChain({target: $bets[0], events: fullClick, scroll: true, error: 'St1Bets'});
            await delayPromise(3000);
        };
        if (window.location.href.indexOf('/office/history/') > -1) {
            const d = new Date();
            d.setDate(d.getDate() - 2);
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
                dLog('green', 'Betwinner', "Show has been clicked");
                await delayPromise(3000);
            }
        } else if (window.location.href.indexOf('/office/account/') > -1) {
            await clickBets();
            return await collectBetResults(inD);
        } else {
            if (document.location.href.indexOf('linebet.com') > -1) {
                const $tad = await waitForElement('div.top-acc__dropdown > div', 333, 10000);
                if ($tad.attr('style') === 'display: none;') {
                    $tad.attr('style', 'display: block;');
                    await delayPromise(1000);
                }
                const $hst = await waitForElement('div.top-acc__dropdown a[href="office/history/"]',
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
            .catch(() => dLog('red', 'Betwinner', 'no bets!'));
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
                        'div.app-coupon-details:has(p:contains("Событие")) p.app-coupon-details__value:first',
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
        return {success: true, message: collected};
    };

    const commands = new class commands {
        constructor() {
            this.cLinks = {
                'BET': proceedBet,
                'EXPRESS_BET': proceedBet,
                'BET_RESULT': collectBetResults,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data) {
            currentBetData.init(data);
            dLog('green', 'Betwinner', [command, data]);
            const res = await this.cLinks[command](data).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'Betwinner', `${command} result: ${res.message}`);
            port.postMessage(this.prepareResult(command, res));
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
            } else {
                return {};
            }
        }
    }

    const messageProcessor = message => {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;

        if (message.action === 'CHECK_LIMITED') {
            waitForCondition(() => !busy, 100, 1800000, 'still busy')
                .then(async () => {
                    setBusy(true);
                    ourCommand.set(message);
                    await checkLimited().catch(e => dLog('red', 'Betwinner',
                        `Error till checkLimited ${e}, ${formatStack(e.stack)}`));
                    dLog('blue', 'Betwinner', `CHECK_LIMITED done`);
                    setBusy(false);
                    ourCommand.clear();
                })
                .catch(e => dLog('red', 'Betwinner', `Error till CHECK_LIMITED ${e}, ${formatStack(e.stack)}`));
        } else if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
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
            dLog('green', 'Betwinner', ['Command was set till unload:', ourCommand.get()]);
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
                dLog('orange', 'Betwinner', [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`, currentCommand]);
                messageProcessor(currentCommand);
            })
            .catch(() => dLog('color: darkgray;', 'Betwinner', 'No command!'));
    }

})();
