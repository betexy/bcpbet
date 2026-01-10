(() => {

    'use strict';

    const isMain = window.self === window.top;

    let limited = false;
    let authClicked = 0;
    let authClickedTime = 0;
    let wasAuthCheck = false;
    let busy = false;
    let increaseDelay = false;
    let enterError = false;
    const port = isMain ? chrome.runtime.connect({name: "port_rollbit"})
        : {postMessage: (...args) => console.log(args)};
    const settings = {
        authCheckInterval: 2000,
        url: '',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        maxWaitForScore: 60000,
        phone: '',
        email: '',
        uid: '',
        fork: {
            shoulder: 0,
            maxWait: 0,
            maxLosePercent: 0,
            minWinPercent: 0,
        },
        forkOnly: false,
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 3,
        betweenBets: 25000,
        hostname: document.location.hostname,
    };
    const ourCommand = new ourCommandProto();
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
        'TENNIS': 'Теннис',
        'HOCKEY': 'Хоккей',
        'BASKETBALL': 'Баскетбол',
        'HANDBALL': 'Гандбол',
        'CYBERSPORT': 'cybersport',
    };

    const accordanceCyber = {
        'CS': 'Counter-Strike',
        'Dota 2': 'Дота 2',
    };

    // Define shadow root element
    const
        btSel = '#bt-inner-page',
        shadowRoot = () => $(btSel) && $(btSel).length > 0
            ? $(btSel)[0].shadowRoot
            : null,
        loginForm = () => $('form'),
        loginLink = 'div:textEquals("Login")';

    function getBalance(returnNull) {
        const $b = $('button:textEquals("Cashier")').prev();
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.trt().replace(/[^0-9.]/g, ''));
    };

    const authCheck = () => {
        const closeFrame = () => $getIFrame('iframe[name="intercom-tour-frame"]').find('span[aria-label="Close"]');
        (async () => {
            const $t = $(shadowRoot())
                .find('h1:contains("Спортсбук вернётся через несколько минут")');
            if ($t.length > 0) {
                window.location.reload();
            }
            if (enterError === true) {
                port.postMessage({
                    answered: "auth_error",
                    status: "ERROR",
                });
                bsError(port, 'ERROR AUTH!');
                return;
            }
            await closeAllWeNeed({
                'button.close-icon': 'button.close-icon',
                'div.close-icon': 'div.close-icon',
                'button:textEquals("Принять")': 'button:textEquals("Принять")',
                'button.kumulos-action-button-cancel': 'button.kumulos-action-button-cancel',
                '#cross': '#cross',
            });
            if (closeFrame().length > 0) {
                await mouseChain({
                    target: closeFrame()[0],
                    events: fullClick,
                    error: 'closeFrame'
                });
            }
            $(shadowRoot()).find('div[data-editor-id="matchTrackerTabs"]')
                .parent().remove();
            const $reload = $(shadowRoot())
                .find('h1:textEquals("The sportsbook will come back in a few minutes")');
            if ($reload.length > 0) {
                window.location.reload();
            }
            const $session = $(shadowRoot())
                .find('div:textEquals("Your session has expired")');
            if ($session.length > 0) {
                window.location.reload();
            }
            if (!limited && $(loginLink).length > 0) {
                wasAuthCheck = false;
                port.postMessage({m: "tech works! 2"});
                await tryToLogin();
            } else {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                    limited: limited
                });
            }
        })()
            .catch(e => dLog('red', 'rollbit', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    const goDirection = async (idx) => {
        await waitForCondition(() => $(shadowRoot()).find('div[data-editor-id="navbarIcon"]').length > 0,
            333, 5000, `No direction ${idx} link`);
        await mouseChain({
            target: $(shadowRoot()).find(`div[data-editor-id="navbarIcon"]:eq(${idx})`)[0],
            events: fullClick,
            error: `direction ${idx} click`
        });
    };

    const tryToLogin = async () => {
        if (Date.now() - authClickedTime < 60000) {
            throw 'too soon!';
        }

        const formLabel = 'label';
        const login = 'input[type="email"]';
        const password = 'input[type="password"]';
        const submit = 'button[type="submit"]';
        const account = 'div:textEquals("Account")';

        if (loginForm().find(formLabel).length === 0) {
            await mouseChain({target: $(loginLink)[0], events: fullClick, error: 'Sign in'});
            await delayPromise(333);
        }
        await waitForCondition(() => loginForm().find(formLabel).length > 0,
            333, 10000, 'No login form');
        await clearAndInputEmail(loginForm().find(login)[0], settings.login);
        await delayPromise(1000);
        await clearAndSimulate(loginForm().find(password)[0], settings.password);
        await delayPromise(1000);
        await mouseChain({
            target: loginForm().find(submit)[0],
            events: fullClick,
            error: 'submit form'
        });
        await delayPromise(555);
        const $profile = await waitForElement(account, 333, 17000).catch(() => $([]));
        await delayPromise(333);
        authClicked++;
        authClickedTime = Date.now();
        dLog('green', 'rollbit', `Auth clicked ${authClicked}!`);

        if ($profile.length === 0) {
            enterError = true;
            limited = true;
            throw 'AUTH ERROR!';
        }
    };

    const closePreviousCoupons = async () => {
        const $closeCoupon = $(shadowRoot()).find('svg[data-cy="ic-delete"]');
        if ($closeCoupon.length > 0) {
            await mouseChain({target: $closeCoupon[0], events: fullClick, error: '$closeCoupon'});
            await delayPromise(555);
        }
    };

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 65;
        dLog('green', 'rollbbit', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const openEvent = async data => {
        dLog('red', 'rollbit', ['openEvent', data]);
        const 
            eventName =
                `${data.team1.replaceAll(/\(.*\)/g, '').trim()} - ${data.team2.replaceAll(/\(.*\)/g, '').trim()}`
                .toLowerCase(),
            $events = () => $(shadowRoot())
                    .find('div[data-editor-id="eventCard"] svg[data-cy="ic-live-simple"]')
                    .closest('div[data-editor-id="eventCard"]');
        let 
            sport = accordance[data.sport],
            eventIndex = -1;

        if (sport === 'cybersport') {
            for (let i = 0; Object.keys(accordanceCyber).length > i; i++) {
                if (data.league.includes(Object.keys(accordanceCyber)[i])) {
                    sport = accordanceCyber[Object.keys(accordanceCyber)[i]];
                    break;
                }
            }
        }

        if (!sport) {
            throw 'No sport found!';
        }

        const checkWeAreThere = function () {
            const
                sel1 = 'div[data-editor-id="scoreBoardContent"] div[style="width: 30px; height: 30px;"]',
                sel2 = 'div[data-editor-id="scoreBoardContent"] div[style="width: 40px; height: 40px;"]',
                $teams = ['Теннис', 'Хоккей', 'Counter-Strike', 'Дота 2'].indexOf(sport) > -1
                    ? $(shadowRoot()).find(sel1).next()
                    : $(shadowRoot()).find(sel2).parent().next(),
                team1 = $teams.eq(0).trt(),
                team2 = $teams.eq(1).trt(),
                checkEvent = `${team1} - ${team2}`;
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };
        const checkScore = function () {
            if (!data.score || data.sport !== 'FOOTBALL'
                || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                return true;
            }
            const
                score = $(shadowRoot()).find('div[data-editor-id="scoreBoardScore"]:eq(0)').trt()
                    + ':' + $(shadowRoot()).find('div[data-editor-id="scoreBoardScore"]:eq(1)').trt(),
                scoreNeed = data.score.replace(/[^\d:]/g, '').trim();
            if (score !== scoreNeed) {
                throw `SCORE_CHANGED ${score} !== ${scoreNeed}}`;
            }
            return true;
        };

        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }

        const switchToSport = async force => {
            await waitForCondition(() => $(shadowRoot()).find('div[data-editor-id="pillTabs"]').length > 0,
                333, 5000, 'No sport tabs');
            const
                accs = {
                    'Футбол': 'Soccer',
                    'Хоккей': 'Ice Hockey',
                    'Теннис': 'Tennis',
                    'Баскетбол': 'Basketball',
                    'Гандбол': 'Handball',
                    'Counter-Strike': 'Counter-Strike',
                    'Дота 2': 'Dota 2',
                },
                $sportEl = () => $(shadowRoot())
                    .find(`div[data-editor-id="pillTabs"] div:textEquals("${accs[sport]}")`);
            if ($sportEl().length === 0) {
                throw `No sport element!`;
            }

            if (force || $sportEl().closest('div[data-editor-id="pillTabs"]').css('color') !== 'rgb(23, 25, 36)') {
                await mouseChain({
                    target: $sportEl()[0],
                    events: fullClick, error: '$sportEl', scroll: true,
                });
                await delayPromise(500);
            }
        };

        const checkLast = () => {
            const paginatorText = $(shadowRoot()).find('div[data-editor-id="eventCardPaginator"]').trt();
            if (paginatorText === '') {
                return true;
            }
            const matches = /(\d{2}) of (\d{2})/g.exec(paginatorText);
            return matches && matches[1] && matches[2] && matches[1] === matches[2];
        };

        const findEventClassic = async () => {
            const $paginator = () => $(shadowRoot()).find('div[data-editor-id="eventCardPaginatorArrow"]');
            await goDirection(1);
            await switchToSport(true);
            let 
                idx = 0,
                currentPage = 1;
            while (eventIndex === -1 && currentPage <= 5) {
                await waitForCondition(() => $events().length > 0,
                    333, 18000, 'No events');
                $events().each(function () {
                    const $this = $(this);
                    const team1 = $this.find('div[style="height: 24px; line-height: 24px;"]').eq(0).trt();
                    const team2 = $this.find('div[style="height: 24px; line-height: 24px;"]').eq(1).trt();
                    const checkEvent = `${team1} - ${team2}`.toLowerCase();
                    dLog('blue', 'rollbit', `Check: '${checkEvent}' === '${eventName}'`);
                    if (checkEventName(checkEvent, eventName)) {
                        eventIndex = idx;
                        return false;
                    }
                    idx++;
                });
                if (eventIndex === -1 && $paginator().length === 2 && !checkLast()) {
                    await mouseChain({
                        target: $paginator().eq(1)[0],
                        events: fullClick, error: '$paginator', scroll: true,
                    });
                    currentPage++;
                } else {
                    break;
                }
            }

            return eventIndex > -1;
        };

        const findEvent = async () => {
            if ($(shadowRoot()).find('input[type="search"]').length === 0) {
                await mouseChain({target: $(shadowRoot()).find('svg[data-cy="ic-search"]')[0], events: fullClick, error: '$searchButton', scroll: true,});
                await waitForCondition(() => $(shadowRoot()).find('input[type="search"]').length > 0,
                    333, 5555, 'Search input is not available!');
                await clearAndSimulate($(shadowRoot()).find('input[type="search"]')[0], eventName, false, true, false);
                await waitForCondition(() => $events().length > 0,
                    333, 5555, 'Event list is not available!');
                let idx = 0;
                $events().each(function () {
                    const $this = $(this);
                    const team1 = $this.find('div[style="height: 24px; line-height: 24px;"]').eq(0).trt();
                    const team2 = $this.find('div[style="height: 24px; line-height: 24px;"]').eq(1).trt();
                    const checkEvent = `${team1} - ${team2}`.toLowerCase();
                    dLog('blue', 'rollbit', `Check: '${checkEvent}' === '${eventName}'`);
                    if (checkEventName(checkEvent, eventName)) {
                        eventIndex = idx;
                        return false;
                    }
                    idx++;
                });
            }

            return eventIndex > -1;
        };

        if (await findEvent() === false) {
            throw 'Event not found!';
        }

        // go to event page
        const $el = $events().eq(eventIndex).find('a');
        await mouseChain({target: $el[0], events: fullClick, error: 'EVENT', scroll: true,});
        await waitForCondition(checkWeAreThere,
            500, 15000, 'We are not on event!');
        await delayPromise(222);
        checkScore();

        return 'Switched to event!';
    };

    const removeTeamPrefix = function (data) {
        const templateArray = ['U19', 'U20', '(wom)'];
        const findIndex1 = templateArray.findIndex(el => data.team1.indexOf(el) > -1);
        const findIndex2 = templateArray.findIndex(el => data.team2.indexOf(el) > -1);
        data.team1 = findIndex1 > -1 ? data.team1.replace(templateArray[findIndex1], '').trim() : data.team1;
        data.team2 = findIndex1 > -1 ? data.team2.replace(templateArray[findIndex2], '').trim() : data.team2;
        return data;
    };

    const openCoupon = async paramData => {
        dLog('green', 'rollbit', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            let data = paramData[i];
            data = removeTeamPrefix(data);
            dLog('green', 'rollbit', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'rollbit', 'Event must be opened!');
            const $element = await getBetElement(data);
            await mouseChain({target: $element[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(500);
        }
    };

    const getBetElement = async betIn => {
        const
            bet = JSON.parse(JSON.stringify(betIn)),
            sel1 = 'div[data-editor-id="scoreBoardContent"] div[style="width: 30px; height: 30px;"]',
            sel2 = 'div[data-editor-id="scoreBoardContent"] div[style="width: 40px; height: 40px;"]',
            $teams = ['HOCKEY', 'TENNIS'].indexOf(bet.sport) > -1
                ? $(shadowRoot()).find(sel1).next()
                : $(shadowRoot()).find(sel2).parent().next(),
            team1 = $teams.eq(0).trt(),
            team2 = $teams.eq(1).trt();

        bet.team1 = team1;
        bet.team2 = team2;
        //#-#-START
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    tabs: ['Main'],
                    roots: ['1x2'],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    tabs: ['Main'],
                    roots: ['1x2'],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    tabs: ['Main'],
                    roots: ['1x2'],
                    pivotKeys: ['draw',],
                },
                'ONE_DRAW': {
                    tabs: ['Main'],
                    roots: ['Double chance'],
                    pivotKeys: ['#TEAM1# or draw',],
                },
                'TWO_DRAW': {
                    tabs: ['Main'],
                    roots: ['Double chance'],
                    pivotKeys: ['draw or #TEAM2#',],
                },
                'ONE_TWO': {
                    tabs: ['Main'],
                    roots: ['Double chance'],
                    pivotKeys: ['#TEAM1# or #TEAM2#',],
                }
            },
            'TOTAL': {
                'OVER': {
                    tabs: ['Main'],
                    roots: ['Total', 'Total (Asian)'],
                    pivotKeys: ['over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Main'],
                    roots: ['Total', 'Total (Asian)'],
                    pivotKeys: ['under #PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tabs: ['Main'],
                    roots: ['#TEAM1# total',],
                    pivotKeys: ['over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Main'],
                    roots: ['#TEAM1# total',],
                    pivotKeys: ['under #PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tabs: ['Main'],
                    roots: ['#TEAM2# total',],
                    pivotKeys: ['over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Main'],
                    roots: ['#TEAM2# total',],
                    pivotKeys: ['under #PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    tabs: ['Main'],
                    roots: ['Total corners',],
                    pivotKeys: ['over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Main'],
                    roots: ['Total corners',],
                    pivotKeys: ['under #PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    tabs: ['Main'],
                    roots: ['Handicap', 'Handicap (Asian)'],
                    pivotKeys: ['(#HPIVOT#)#TEAM1#'],
                },
                'AWAY': {
                    tabs: ['Main'],
                    roots: ['Handicap', 'Handicap (Asian)'],
                    pivotKeys: ['(#HPIVOT#)#TEAM2#'],
                }
            },
        };
        if (typeof markets[bet.market] === 'undefined' || typeof markets[bet.market][bet.target] === 'undefined') {
            throw `Unsupported ${bet.time_value} / ${bet.market} / ${bet.target}`;
        }

        let $found = $([]);
        const params = new AllMarkets(bet);
        params.proceed_football = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', '1x2', '1st half - 1х2');
                }

                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Handicap', '1st half - handicap');
                    this.addReplIn('roots', 'Handicap (Asian)', '1st half - handicap (Asian)');
                }

                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total', '1st half - total');
                    this.addReplIn('roots', 'Total (Asian)', '1st half - total (Asian)');
                }

                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', '#TEAM1# total', '1st half - total #TEAM1#');
                }

                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# total', '1st half - total #TEAM2#');
                }
            }
        };
        params.proceed_tennis = function (bet) {
            if (!this.full) {
                const sets = ['Первый сет', 'Второй сет', 'Третий сет', 'Четвертый сет'];
                const s = sets[this.tDigit - 1];
                console.log('%c' + `${this.tDigit}`,
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                //Game handicap
                if (bet.time_value.indexOf('SET') > -1 && bet.time_value.indexOf('GAME') > -1) {
                    const parts = bet.time_value.split('_GAME_');
                    if (bet.market === 'ONE_TWO') {
                        this.addTotal('roots', [s + ' ' + parts[1] + ' гейм - победитель']);
                    }
                    if (bet.market === 'HDP') {
                        this.addTotal('roots', [s + ' ' + parts[1] + ' гейм - фора на гейм']);
                    }
                    if (bet.market === 'TOTAL') {
                        this.addTotal('roots', [s + ' ' + parts[1] + ' гейм - тотал геймов']);
                    }
                } else {
                    if (bet.market === 'ONE_TWO') {
                        this.addTotal('roots', [s + ' - победитель']);
                    }
                    if (bet.market === 'HDP') {
                        this.addTotal('roots', [s + ' - фора на гейм']);
                    }
                    if (bet.market === 'TOTAL') {
                        this.addTotal('roots', [s + ' - тотал геймов']);
                    }
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', '1x2', 'Победитель');
                }
                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Фора', 'Фора на гейм');
                }
                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Тотал', 'Тотал геймов');
                }
                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', '#TEAM1# тотал', '#TEAM1# всего геймов');
                }
                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# тотал', '#TEAM2# всего геймов');
                }
            }
        };
        params.proceed_basketball = function (bet) {
            if (!this.full) {
                const quaters = ['Первая четверть - ', 'Вторая четверть - ', 'Третья четверть - ', 'Четвертая четверть - ']
                const quater = sets[this.tDigit - 0];
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', '1x2', quater + '1x2');
                }

                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Фора', quater + 'фора');
                }

                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Тотал', quater + 'тотал');
                }
            } else {
                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Фора', 'Фора (включая овертайм)');
                }

                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Тотал', 'Тотал (включая овертайм)');
                }

                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', '#TEAM1# тотал', '#TEAM1# тотал (включая овертайм)');
                }

                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# тотал', '#TEAM2# тотал (включая овертайм)');
                }
            }
        };
        params.proceed_handball = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', '1x2', '1-й тайм - 1х2');
                }

                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Фора', '1-й тайм - фора');
                    this.addReplIn('roots', 'Фора (Азиатская)', '1-й тайм - фора (Азиатский)');
                }

                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Тотал', '1-й тайм - тотал');
                    this.addReplIn('roots', 'Тотал (Азиатский)', '1-й тайм - тотал (Азиатский)');
                }

                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', '#TEAM1# тотал', '1-й тайм - тотал #TEAM1#');
                }

                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# тотал', '1-й тайм - тотал #TEAM2#');
                }
            }
        };
        params.proceed_hockey = function (bet) {
            const
                periods = ['First period - ', 'Second period - ', 'Third period - ',],
                period = periods[this.tDigit - 1];
            console.log(this.tDigit);
            if (bet.market === 'HDP' && parseFloat(bet.pivot) === 0) {
                this.addTo('roots', 'Draw no bet');
                this.addTo('pivotKeys', bet.target === 'HOME' ? '#TEAM1#' : '#TEAM2#');
            }
            this.addTotal('tabs', ['ALL']);
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', '1x2', period + '1x2');
                    this.addReplIn('roots', 'Double chance', period + 'double chance');
                } else if (bet.market === 'HDP'&& parseFloat(bet.pivot) === 0) {
                    this.addTotal('roots', [period + 'draw no bet']);
                    this.addTotal('pivotKeys', [bet.target === 'HOME' ? '#TEAM1#' : '#TEAM2#']);
                } else if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Handicap', period + 'handicap');
                } else if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Handicap', period + 'handicap');
                } else if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total', period + 'total');
                }
            }
        };
        params.proceed_cybersport = function (bet) {
            const maps = ['Первая карта - ', 'Вторая карта - ', 'Третья карта - ']
            const map = maps[this.tDigit - 0];
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', '1x2', map + 'победитель (включая овертайм)');
                }
                if (bet.market === 'HDP') {
                    this.addTotal('roots', [map + ' фора раунда (включая овертайм)']);
                }
                if (bet.market === 'TOTAL') {
                    this.addTotal('roots', [map + 'total kills']);
                    this.addTotal('roots', [map + 'тотал раунда (включая овертайм)']);
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', '1x2', 'Победитель');
                }
                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Фора', 'Фора на карту');
                }
                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Тотал', 'Тотал карт');
                }
            }
        };
        const final = applyAllMarkets(bet, ['roots', 'pivotKeys', 'tabs'], params, markets, true);
        const m = final[bet.market][bet.target];
        const hPivot = pvt => {
            return parseFloat(pvt) === 0 ? '0' : pvt;
        };

        const $findPivot = $root => {
            let $res = $([]);
            for (const pvt of m.pivotKeys) {
                console.log(`Checking pivot: '${pvt}'`);
                let $pivot = $([]);
                $pivot = $root.parent().parent()
                    .find(`div[data-editor-id="tableOutcomePlateName"]:textEqualsI("${pvt}")`);
                if ($pivot.length === 1) {
                    $res = $pivot;
                    break;
                }
            }

            return $res;
        };

        replaceInner(m, {
            '#TEAM1#': bet.team1,
            '#TEAM2#': bet.team2,
            '#PIVOT#': bet.pivot,
            '#HPIVOT#': hPivot(bet.pivot),
        });

        dLog('green', 'rollbit', ['Final market is:', m]);
        await waitForCondition(() => $(shadowRoot())
                .find('div[data-editor-id="marketTitle"]').length > 0,
            333, 10000, 'No markets!');
        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () => $(shadowRoot())
                .find(`div[data-editor-id="marketTitle"]:textEqualsI("${root}")`);
            await waitForCondition(() => $root().length > 0,
                333, 10000, 'No roots!');
            $found = $findPivot($root());
            if ($found.length > 0) {
                break;
            }
        }

        if ($found.length === 0) {
            throw `${bet.sport}/${bet.type}/${bet.time_value}/${bet.market}/${bet.target}/${bet.pivot} not found :(`;
        }
        $found.get(0).scrollIntoView();
        window.scrollBy(0, -100);
        return $found;
        //#-#-FINISH
    };

    const checkCoefs = async data => {
        data[0] = removeTeamPrefix(data[0]);
        const findInData = match => data.find(v => checkEventName(v.team1.toLowerCase()
            + ' vs ' + v.team2.toLowerCase(), match));
        await waitForCondition(() => $(shadowRoot()).find('div[data-editor-id="betslipSelection"]').length > 0,
            333, 10000, 'No coupons!');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        const $coupons = $(shadowRoot()).find('div[data-editor-id="betslipSelection"]');
        $coupons.each(function () {
            const $this = $(this);
            const match = $this.find('a > div:first-child > div:eq(1) > div:first-child').trt();
            let localCoef = $this.find('div[data-editor-id="betslipSelectionOdd"]').trt();
            let localData = findInData(match);
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if (!localData || isNaN(localCoef)) {
                errors.push(match + ' LOW_COEF - wrong match or localCoef!');
                checked++;
            } else {
                checked++;
            }
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

    const proceedBet = async (data, command) => {
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
            if (!await eventsWork('fortune', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'rollbit',
                    `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                    + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
            }
        }

        let willPlace = parseFloat(data[0].stake);
        const acceptChange = () => $(shadowRoot())
            .find('div[data-editor-id="switcher"]');

        const checkSuccess = async () => {
            // Please wait while your bet is placed
            await waitForCondition(() => $(shadowRoot())
                        .find('div:textEquals("Your bets have been successfully placed!")').length > 0,
                333, 45000, 'No success!');
            return true;
        };
        const checkBalance = async willPlace => {
            const balance = getBalance();
            if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };
        const $firstBet = () => $(shadowRoot()).find('div[data-editor-id="bet"]:first');

        if (!willPlace) {
            throw`Bad will place: ${willPlace}, ${data[0].stake}`;
        }

        await checkBalance(willPlace);
        await closePreviousCoupons();
        await delayPromise(555);
        await openCoupon(data);

        do {
            await checkCoefs(data);
            const place = willPlace.toString().replace('.00', '').trim();
            const $input = () => data.length > 1 ? $(shadowRoot()).find('label[data-editor-id="betslipStakeInput"] input:last')
                : $(shadowRoot()).find('label[data-editor-id="betslipStakeInput"] input:first');
            dLog('green', 'rollbit', `Will place (performBet): ${place}`);
            if (acceptChange().length > 0) {
                await mouseChain({target: acceptChange()[0], events: fullClick, error: 'acceptChange'});
                await delayPromise(1111);
                await closePreviousCoupons();
            }

            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }

            if (parseFloat($input().val()) !== parseFloat(place)) {
                await clearAndInputNumber($input()[0], place);
                await delayPromise(555);
                dLog('green', 'rollbit', `STAKE entered ${willPlace}`);
            }

            const entered = parseFloat($input().val());
            dLog('green', 'rollbit', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'rollbit', 'Entered !== willPlace - try to reenter!');
                continue;
            }

            await delayPromise(1555);
            const $placeBtn = $(shadowRoot()).find('button[data-editor-id="betslipPlaceBetButton"]');

            if ($placeBtn.length === 0) {
                throw 'No place button or button disabled!';
            }

            await delayPromise(333);
            await mouseChain({target: $placeBtn[0], events: fullClick, error: '$placeBtn'});
        } while (!await checkSuccess());

        await delayPromise(777);
        if ($(shadowRoot()).find('div[data-editor-id="betslipNotification"] svg').length > 0) {
            await mouseChain({target: $(shadowRoot()).find('div[data-editor-id="betslipNotification"] svg')[0], events: fullClick, error: 'close notification'});
        }
        await goDirection(3);
        await delayPromise(777);
        await waitForCondition(() => $(shadowRoot()).find('div[data-editor-id="pillButton"]:eq(1)').length > 0, 333, 10000, 'no open bets bets');
        await delayPromise(333);
        await mouseChain({
            target: $(shadowRoot()).find('div[data-editor-id="pillButton"]:eq(1)')[0],
            events: fullClick,
            error: 'open bets'
        });
        await delayPromise(333);
        await waitForCondition(() => $(shadowRoot()).find('div[data-editor-id="bet"]:first').length > 0, 333, 10000, 'no open bets');

        const response = {
            success: true,
            message: {
                external_id: $firstBet().find('div[data-editor-id="betEventId"]').trt().replace(/[^\d.]/g, ''),
                coef: $firstBet().find('div[data-editor-id="betTotal"]:eq(1) > div:eq(1)').trt(),
                stake: $firstBet().find('div[data-editor-id="betTotal"]:eq(2) > div:eq(1)').trt().replace(/[^\d.]/g, ''),
                max: '7777777',
            },
        };

        await goDirection(1);

        return response;
    };

    const collectBetResults = async (inD) => {
        const
            data = inD.length === 2 && inD[0] === 'limit' ? [] : inD,
            limit = inD.length === 2 && inD[0] === 'limit'
                ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30,
            $bets = () => $(shadowRoot()).find('div[data-editor-id="bet"]'),
            $more = () => $(shadowRoot())
                .find('div[data-editor-id="subHeaderPillButtons"]'),
            statuses = ['betsOpenStatus', 'betsLostStatus', 'betsWonStatus'],
            collected = [];
        let
            checked = 0,
            status = '',
            moreTimes = 0,
            checkedIds = [];
        dLog('green', 'rollbit', [`collectBetResults, limit: ${limit}, data:`, data]);
        await goDirection(3);
        await waitForCondition(() => $bets().length > 0,
            333, 10000, 'no bets');
        do {
            if (moreTimes > 0) {
                await mouseChain({target: $more()[0], events: fullClick, scroll: true, error: '$more'});
                await delayPromise(5000);
            }
            await $bets().eachAsync(async function () {
                if (checked > limit) {
                    return false;
                }
                const $this = $(this);
                const betId = $this.find('div[data-editor-id="betEventId"]').trt().replace(/[^\d.]/g, '');
                if (checkedIds.indexOf(betId) === -1) {
                    checkedIds.push(betId);
                    checked++;
                } else {
                    return true;
                }
                if (data.length === 0 || data.indexOf(betId) > -1) {
                    const statusAttribute = statuses.find((status) => $this.find(`span[data-editor-id="${status}"]`).length > 0);
                    if (!statusAttribute) {
                        status = 'REFUNDED'
                    } else {
                        status = statusAttribute === 'betsWonStatus'
                            ? 'WON'
                            : statusAttribute === 'betsLostStatus' ? 'LOSE' : 'ACCEPTED';
                    }
                    collected.push({
                        external_id: betId,
                        status,
                        stake: $this.find('div[data-editor-id="betTotal"]:eq(2) > div:eq(1)').trt().replace(/[^\d.]/g, ''),
                        result: status === 'ACCEPTED' ? ''
                            : status === 'LOSE' ? 0
                                : parseFloat($this.find('div[data-editor-id="betTotal"]:last + div div:last').trt().replace(/[^\d.]/g, '')),
                    });
                }
            });
            moreTimes++;
        } while (checked < limit && $more().length > 0 && moreTimes < 4);
        dLog('', 'rollbit', [`checked: ${checked}, collected:`, collected]);

        await delayPromise(888);
        await goDirection(1);
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
            const res = await this.cLinks[command](data, command).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'rollbit',
                `${command} result: ${res.message}`);
            await port.postMessage(await this.prepareResult(command, res));
            if (!res?.success) {
                throw res?.message || 'Unknown error';
            }
            return res;
        }

        async prepareResult(command, res) {
            dLog('', 'rollbit', [`prepareResult '${command}':`, res, currentBetData,]);
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('fortune', settings,
                        `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`,
                        true, false);
                    await bMess('WasSuccessStake').set(Date.now());
                    await storeBet(res.message.stake, true);
                    await bMess('Stake Maximums').set(0);
                }
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
                if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'ROLLBIT';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = currentBetData.data[0]?.source || 'oddscp';
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
                    answer: res.success ? 'Everything is Okay!' : res.message,
                    doNotSend: !!currentBetData.data[0].betFromParser && !res.success,
                };
            } else if (command === 'BET_RESULT') {
                return {
                    answered: "BET_RESULT",
                    status: res.success ? "success" : "error",
                    answer: res.message
                };
            } else {
                return {};
            }
        }
    };

    const messageProcessor = (message, direct) => {
        console.log('%c' + `${(direct ? 'Direct' : 'Saved')} : messageProcessor (${busy}) %O`,
            `background: ${(direct ? 'green' : 'yellow')}; color: ${(direct ? 'white' : 'black')}; font-size: 12px; font-weight: bold; padding: 3px;`,
            message);
        if (limited) {
            port.postMessage({
                answered: message.action,
                status: "LIMITED",
                answer: "LIMITED"
            });
        } else if (message.action !== 'auth' && busy) {
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
            settings.fork = message.fork;
            settings.forkOnly = typeof message.fork === 'object' && Object.keys(message.fork).length > 0;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            ['login', 'password', 'phone', 'email', 'uid',].forEach(k => settings[k] = message[k]);
            if (message.start_url) {
                settings.url = message.start_url;
            }
            dLog(`yellow`, 'rollbit', [`messageProcessor auth settings:`, settings,]);
            authCheck();
            wasAuthCheck = true;
        } else if (commands.exists(message.action)) {
            // Hint: execute command
            busy = true;
            ourCommand.set(message);
            commands.execute(message.action, message.data)
                .finally(() => {
                    busy = false;
                    ourCommand.clear();
                });
        } else {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: `Unsupported action: ${message.action}!`
            });
        }
    };

    function afterDOMLoaded() {
        (async () => {
            const command = await bMess('ROLLBIT').check(40000);
            await waitForCondition(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck), 333, 60000, 'No auth check!');
            bsLogger('green', 'rollbit', [`Restoring with (${isMain}): `, command]);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));
        port.postMessage({m: "PAGE LOADED!"});
        console.log('%c' + `ROLLBIT loaded and message sent! (${isMain}) ${document.location.href}`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", async () => {
        await ourCommand.save('ROLLBIT', increaseDelay ? 150000 : 0);
        bsLogger('green', 'ROLLBIT', [`Command was set till unload (${isMain}):`, ourCommand.get()]);
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

})();
