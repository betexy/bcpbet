(() => {
    'use strict';

    const isMain = window.self === window.top;

    let limited = false;
    let authClicked = 0;
    let authClickedTime = 0;
    let wasAuthCheck = false;
    let lastAuthCheck = 0;
    let busy = false;
    let waitSource = false;
    let increaseDelay = false;
    let enterError = false;
    let lang = '';
    let sourceExpress = false;
    let loaded = Date.now();

    const port = isMain ? chrome.runtime.connect({name: 'port_bcgame'})
        : {postMessage: (...args) => console.log(args)};
    const settings = {
        restartEvery: 1800000,
        authCheckInterval: 2000,
        url: 'https://bc.game/sports',
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
        eventTimeLimit: 2400000,
        eventMaxBets: 3,
        betweenBets: 25000,
        hostname: document.location.hostname,
        newExpresses: false,
        source: {
            X: 380,
            Y: 337,
            Z: 369,
        },
        sourceRandom: 0,
        sourceDate: 0,
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
        btSel = '#betby > div',
        usdtLink = 'img[src="/coin/USDT.black.png"]',
        shadowRoot = () => $(btSel) && $(btSel).length > 0
            ? $(btSel)[0].shadowRoot
            : null,
        loginLink = 'button:textEquals("Sign In"):visible';

    function getBalance(returnNull) {
        const $b = $(usdtLink).next();
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.trt().replace(',', '.').replace(/[^\d.]/g, ''));
    };

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

    const selectCurrency = async () => {
        if ($(usdtLink).length === 0) {
            await mouseChain({target: $('div.header div.cursor-pointer')[0], events: fullClick, error: '$coin'});
            await waitForElement('div.currency-select', 333, 3555);
            await mouseChain({target: $(`div.currency-select ${usdtLink}`)[0], events: fullClick, error: '$coin select'});
            await delayPromise(888);
        }
    };

    const authCheck = () => {
        lastAuthCheck = Date.now();

        if (!busy && Date.now() - loaded > settings.restartEvery) {
            dLog('bigred', 'vave', 'RELOAD 1');
            window.location.reload();
        }
        (async () => {
            if (enterError === true) {
                return;
            }

            await closeAllWeNeed({
                'button[aria-label="close"]': 'button[aria-label="close"]',
                'button[type="button"]:textEquals("Accept")': 'button[type="button"]:textEquals("Accept")',
            });

            $(shadowRoot()).find('div[data-editor-id="matchTrackerTabs"]')
                .parent().remove();

            const errorNotifications = [
                "The sportsbook will come back in a few minutes",
                "Your session has expired",
                "Ваша сессия истекла",
                "Спортсбук вернётся через несколько минут",
            ];
            const errorNotificationsState = errorNotifications.find(
                note => $(shadowRoot()).find(`div:textEquals("${note}")`).length > 0
            )

            if (errorNotificationsState) {
                window.location.reload();
            }

            const $reload = $(shadowRoot())
                .find('h1:textEquals("Спортсбук вернётся через несколько минут")');
            if ($reload.length > 0) {
                window.location.reload();
            }

            if ($('pre').length > 0) {
                window.location.href = 'https://bc.game/sports';
            }

            const depositVision = await waitForCondition(() => !!["Депозит","Deposit"]
                .find(title => $(`button:textEquals(${title})`).length) ,333, 7777)
                .catch(() => $([]));
            if (!limited && depositVision.length === 0) {
                wasAuthCheck = false;
                port.postMessage({m: "tech works! 2"});
                await tryToLogin();
            } else {
                await selectCurrency();

                if (settings.lastScoreBasketball === '999') {
                    if (Date.now() - settings.sourceDate >= 300000) {
                        settings.sourceDate = Date.now();
                        settings.sourceRandom = getSourceRandom();
                        // if (settings.sourceRandom >= 17 && settings.sourceRandom <= 17) {
                        //     settings.newExpresses = true;
                        //     if (settings.sourceRandom >= 18 && settings.sourceRandom <= 18) {
                        //         settings.newExpressBetsAmount = 1;
                        //     }
                        // } else {
                        //     waitSource = false;
                        //     settings.newExpresses = false;
                        // }

                        dLog('blue', 'BCGAME', `Source current random value - ${settings.sourceRandom}`);
                    }
                }

                if (settings.newExpresses && !busy) {
                    //dLog('green', 'BCGAME', 'START ProccedExpressNew!');
                    busy = true;
                    const WasSuccessExpressNew = await bMess('WasSuccessExpressNew').infinite().catch(() => 0);
                    const $coupons = () => $(shadowRoot()).find('div[data-editor-id="betslipSelection"]');
                    const couponsExist = await waitForCondition(() => $coupons().length > 0,
                        222, 1777).catch(() => $([]));

                    if (WasSuccessExpressNew && couponsExist.length === 0) {
                        await bMess('WasSuccessExpressNew').remove();
                    }

                    if (!WasSuccessExpressNew) {
                        dLog('green', 'BCGAME', 'START find NewExpress event!');
                        // clear coupons
                        if ($coupons().length > 0) {
                            await closePreviousCoupons(false);
                        }

                        waitSource = false;
                        await ProccedExpressNew().catch((e) => {
                            dLog('red', 'BCGAME', 'ProccedExpressNew Error - ' + e);
                            bMess('WasSuccessExpressNew').set(false);
                        });                        
                    }
                    busy = false;
                }

                await waitForCondition(() => getBalance(true) !== null, 222, 5555).catch(() => $([]));
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                    limited: limited
                });
            }
        })()
            .catch(e => dLog('red', 'BCGAME', `authCheck: ${e}`))
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
        lang = document.location.href.indexOf('bc.game/ru') > -1 ? 'ru' : 'eng';
        if (Date.now() - authClickedTime < 60000) {
            throw 'too soon!';
        }
        const deposit = lang === 'ru' ? "Депозит" : "Deposit";
        const profile = `button:textEquals(${deposit})`;
        const loginForm = 'div.account-dialog:visible';

        if ($(loginForm).length === 0) {
            await mouseChain({target: $(loginLink)[0], events: fullClick, error: 'Sign in'});
            await delayPromise(333);
        }

        await waitForCondition(() => $(loginForm).length > 0,
            333, 10000, 'No login form');
        await clearAndSimulate($(loginForm).find('input[placeholder="Email / Phone Number"]')[0],
            settings.login);
        await delayPromise(777);
        await clearAndSimulate($(loginForm).find('input[type="password"]')[0],
            settings.password);
        await delayPromise(777);
        await mouseChain({
            target: $(loginForm).find('button[type="submit"]')[0],
            events: fullClick,
            error: 'submit form'
        });
        dLog('green', 'BCGAME', `Auth clicked ${authClicked}!`);
        await delayPromise(333);
        authClicked++;
        authClickedTime = Date.now();
        const $profile = await waitForElement(profile,
            333, 37000).catch(() => $([]));
        await delayPromise(333);
        
        if ($profile.length === 0) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            enterError = true;
            limited = true;
            throw 'AUTH ERROR!';
        }
    };

    const closeSourceExpressCoupon = async () => {
        dLog('green', 'BCGAME', 'closeSourceExpressCoupon started!');
        const $closeCoupon = () => $(shadowRoot()).find('svg[data-cy="ic-delete"]').parent();
        if ($closeCoupon().length > 1) {
            await mouseChain({target: $closeCoupon()[0], events: fullClick, error: 'closeSourceExpressCoupon'});
            await delayPromise(1999);
            if ($closeCoupon().length > 0) {
                await mouseChain({target: $closeCoupon()[0], events: fullClick, error: 'closeSourceExpressCoupon'});
                await delayPromise(1111);
            }
        }
    };

    const closePreviousCoupons = async (state) => {
        const $closeCoupon = () => $(shadowRoot()).find('svg[data-cy="ic-delete"]').parent();
        const $closeBtns = () => $(shadowRoot()).find('div[data-editor-id="betslipSelectionRemoveButton"]');
        if ($closeCoupon().length > 0) {
            if (state) {
                for (let i=0; i<$closeBtns().length; i++) {
                    if ($closeBtns().length > settings.newExpressBetsAmount) {
                        await mouseChain({target: $closeBtns().last()[0], events: fullClick, error: 'closeCoupon'});
                        await delayPromise(555);
                    }
                }
            } else {
                await mouseChain({target: $closeCoupon()[0], events: fullClick, error: 'closePreviousCoupons'});
                await delayPromise(1999);
                if ($closeCoupon().length > 0) {
                    await mouseChain({target: $closeCoupon()[0], events: fullClick, error: 'closePreviousCoupons2'});
                    await delayPromise(1111);
                }
            }
        }
    };

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 75;
        dLog('green', 'BCGAME', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const openEvent = async data => {
        dLog('red', 'BCGAME', ['openEvent', data]);
        const timeCnd = data.type === 'LIVE' 
                ? ':has(svg[data-cy="ic-live-simple"])' 
                : ':not(:has(svg[data-cy="ic-live-simple"]))';
        const 
            eventName =
                `${data.team1.replaceAll(/\(.*\)/g, '').trim()} - ${data.team2.replaceAll(/\(.*\)/g, '').trim()}`
                .toLowerCase(),
            secondTeam = data.team2.replaceAll(/\(.*\)/g, '').trim().toLowerCase(),
            $events = (timeCnd) => $(shadowRoot())
                .find(`div[data-editor-id="eventCard"]${timeCnd}`);
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
                $teams = ['Теннис', 'Баскетбол', 'Хоккей', 'Counter-Strike', 'Дота 2'].indexOf(sport) > -1
                    ? $(shadowRoot()).find(sel1).next()
                    : $(shadowRoot()).find(sel2).parent().next(),
                team1 = $teams.eq(0).trt(),
                team2 = $teams.eq(1).trt(),
                checkEvent = `${team1} - ${team2}`;
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };
        
        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }

        const findEvent = async () => {
            let idx = 0;

            if ($(shadowRoot()).find('input[type="search"]').length === 0) {
                await mouseChain({target: $(shadowRoot()).find('svg[data-cy="ic-search"]')[0], events: fullClick, error: '$searchButton', scroll: true,});
                await waitForCondition(() => $(shadowRoot()).find('input[type="search"]').length > 0,
                    333, 5555, 'Search input is not available!');
            }

            await clearAndSimulate($(shadowRoot()).find('input[type="search"]')[0], secondTeam, false, false, true);
            await waitForCondition(() => $(shadowRoot()).find(`div[data-editor-id="eventCard"]`).length > 0,
                333, 5555, 'Events list is not available!');
            await delayPromise(555);
            $events(timeCnd).each(function () {
                const $this = $(this);
                const team1 = $this.find('div[style="height: 24px; line-height: 24px;"]').eq(0).trt();
                const team2 = $this.find('div[style="height: 24px; line-height: 24px;"]').eq(1).trt();
                const checkEvent = `${team1} - ${team2}`.toLowerCase();
                dLog('blue', 'BCGAME', `Check: '${checkEvent}' === '${eventName}'`);
                if (checkEventName(checkEvent, eventName)) {
                    eventIndex = idx;
                    return false;
                }
                idx++;
            });

            return eventIndex > -1;
        };

        if (await findEvent() === false) {
            throw 'Event not found!';
        }
        // go to event page
        const $el = $events(timeCnd).eq(eventIndex).find('a');
        await mouseChain({target: $el[0], events: fullClick, error: 'EVENT', scroll: true,});
        await waitForCondition(checkWeAreThere,
            500, 15000, 'We are not on event!');
        await delayPromise(222);

        return 'Switched to event!';
    };

    const openCoupon = async paramData => {
        dLog('green', 'BCGAME', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'BCGAME', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'BCGAME', 'Event must be opened!');
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
            $teams = ['HOCKEY', 'TENNIS', 'CYBERSPORT', 'BASKETBALL'].indexOf(bet.sport) > -1
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
                    tabs: ['Main', 'Основные'],
                    roots: ['1x2'],
                    pivotKeys: ['#TEAM1#'],
                },
                'TWO': {
                    tabs: ['Main', 'Основные'],
                    roots: ['1x2'],
                    pivotKeys: ['#TEAM2#'],
                },
                'DRAW': {
                    tabs: ['Main', 'Основные'],
                    roots: ['1x2'],
                    pivotKeys: ['draw', 'ничья'],
                },
                'ONE_DRAW': {
                    tabs: ['Main', 'Основные'],
                    roots: ['Double chance', 'Двойный шанс'],
                    pivotKeys: ['#TEAM1# or draw', '#TEAM1# или ничья'],
                },
                'TWO_DRAW': {
                    tabs: ['Main', 'Основные'],
                    roots: ['Double chance', 'Двойный шанс'],
                    pivotKeys: ['draw or #TEAM2#', 'ничья или #TEAM2#'],
                },
                'ONE_TWO': {
                    tabs: ['Main', 'Основные'],
                    roots: ['Double chance', 'Двойный шанс'],
                    pivotKeys: ['#TEAM1# or #TEAM2#', '#TEAM1# или #TEAM2#'],
                }
            },
            'TOTAL': {
                'OVER': {
                    tabs: ['Main', 'Основные'],
                    roots: ['Total', 'Total (Asian)', 'Тотал', 'Тотал (Азиатский)'],
                    pivotKeys: ['over #PIVOT#', 'больше #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Main', 'Основные'],
                    roots: ['Total', 'Total (Asian)', 'Тотал', 'Тотал (Азиатский)'],
                    pivotKeys: ['under #PIVOT#', 'меньше #PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tabs: ['Main', 'Основные'],
                    roots: ['#TEAM1# total', '#TEAM1# total (Asian)', '#TEAM1# тотал', '#TEAM1# тотал (Азиатский)' ],
                    pivotKeys: ['over #PIVOT#', 'больше #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Main', 'Основные'],
                    roots: ['#TEAM1# total', '#TEAM1# total (Asian)', '#TEAM1# тотал', '#TEAM1# тотал (Азиатский)' ],
                    pivotKeys: ['under #PIVOT#', 'меньше #PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tabs: ['Main', 'Основные'],
                    roots: ['#TEAM2# total', '#TEAM2# total (Asian)', '#TEAM2# тотал', '#TEAM2# тотал (Азиатский)', ],
                    pivotKeys: ['over #PIVOT#', 'больше #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Main', 'Основные'],
                    roots: ['#TEAM2# total', '#TEAM2# total (Asian)', '#TEAM2# тотал', '#TEAM2# тотал (Азиатский)'],
                    pivotKeys: ['under #PIVOT#', 'меньше #PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    tabs: ['Main', 'Основные'],
                    roots: ['Total corners', 'Тотал угловых'],
                    pivotKeys: ['over #PIVOT#', 'больше #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Main', 'Основные'],
                    roots: ['Total corners',],
                    pivotKeys: ['under #PIVOT#', 'меньше #PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    tabs: ['Main', 'Основные'],
                    roots: ['Handicap', 'Handicap (Asian)', 'Фора', 'Фора (Азиатская)'],
                    pivotKeys: ['(#HPIVOT#)#TEAM1#'],
                },
                'AWAY': {
                    tabs: ['Main', 'Основные'],
                    roots: ['Handicap', 'Handicap (Asian)', 'Фора', 'Фора (Азиатская)'],
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
            if (bet.market === 'HDP' && parseFloat(bet.pivot) === 0) {
                const ruVersion = lang === 'ru' ? 'Ничья ставки нет' : 'Draw no bet';
                const ruVersionHalf = lang === 'ru' ? '1-й тайм - ничья ставки нет' : '1st half - draw no bet';
                this.addTo('roots', this.full ? ruVersion : ruVersionHalf);
                this.addTo('pivotKeys', bet.target === 'HOME' ? '#TEAM1#' : '#TEAM2#');
            }
            if (this.full) {
                return;
            }
            this.addTo('tabs', 'Halves', '1-й Тайм');
            switch (bet.market) {
                case 'ONE_TWO':
                    const winner = lang === 'ru' ? '1-й тайм - 1x2' : '1st half - 1x2';
                    this.addReplIn('roots', '1x2', winner);
                    break;
                case 'HDP':
                    const headHdp = lang === 'ru' ? 'Фора' : 'Handicap';
                    const hdp = lang === 'ru' ? '1-й тайм - Фора' : '1st half - handicap';
                    const headHdpAsian = lang === 'ru' ? 'Фора (Азиатская)' : 'Handicap (Asian)';
                    const hdpAsian = lang === 'ru' ? '1-й тайм - фора (Азиатская)' : '1st half - handicap (Asian)';
                    this.addReplIn('roots', headHdp, hdp);
                    this.addReplIn('roots', headHdpAsian, hdpAsian);
                    break;
                case 'TOTAL':
                    const headTotal = lang === 'ru' ? 'Тотал' : 'Total';
                    const total = lang === 'ru' ? '1-й тайм - тотал' : '1st half - total';
                    const headTotalAsian = lang === 'ru' ? 'Тотал (Азиатский)' : 'Total (Asian)';
                    const totalAsian = lang === 'ru' ? '1-й тайм - тотал (Азиатский)' : '1st half - total (Asian)';
                    this.addReplIn('roots', headTotal, total);
                    this.addReplIn('roots', headTotalAsian, totalAsian);
                    break;
                case 'T1_TOTAL':
                    const t1Head = lang === 'ru' ? '#TEAM1# тотал' : '#TEAM1# total';
                    const t1 = lang === 'ru' ? '1-й тайм - #TEAM1# тотал' : '1st half - #TEAM1# total';
                    this.addReplIn('roots', t1Head, t1);
                    break;
                case 'T2_TOTAL':
                    const t2Head = lang === 'ru' ? '#TEAM2# тотал' : '#TEAM2# total';
                    const t2 = lang === 'ru' ? '1-й тайм - #TEAM2# тотал' : '1st half - #TEAM2# total';
                    this.addReplIn('roots', t2Head, t2);
                    break;
            }
        };
        params.proceed_tennis = function (bet) {
            const 
                winner = lang === 'ru' ? 'Победитель' : 'Winner',
                handicap = lang === 'ru' ? 'Фора по геймам' : 'Game handicap',
                total = lang === 'ru' ? 'Тотал геймов' : 'Total games',
                repls = {
                    'ONE_TWO': winner,
                    'HDP': handicap,
                    'TOTAL': total,
                };
            this.addTotal('tabs', ['ALL', 'Все']);
            if (!this.full) {
                const
                    set1 = lang === 'ru' ? 'Первый сет' : 'First set',
                    set2 = lang === 'ru' ? 'Второй сет' : 'Second set',
                    set3 = lang === 'ru' ? 'Третий сет' : 'Third set',
                    set4 = lang === 'ru' ? 'Четвертый сет' : 'Fourth set',
                    sets = [set1, set2, set3, set4];
                const game = lang === 'ru' ? 'гейм' : 'game';
                const s = sets[this.tDigit - 1];
                console.log('%c' + `${this.tDigit}`,
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                //Game handicap
                if (bet.time_value.indexOf('SET') > -1 && bet.time_value.indexOf('GAME') > -1) {
                    const parts = bet.time_value.split('_GAME_');
                    if (Object.keys(repls).indexOf(bet.market) > -1) {
                        this.addTotal('roots', [`${s} ${game} ${parts[1]} - ${repls[bet.market].toLowerCase()}`]);
                    }
                } else {
                    if (Object.keys(repls).indexOf(bet.market) > -1) {
                        this.addTotal('roots', [`${s} - ${repls[bet.market].toLowerCase()}`]);
                    }
                }
            } else {
                const 
                    t1 = lang === 'ru' ? '#TEAM1# тотал' : '#TEAM1# total',
                    g1 = lang === 'ru' ? '#TEAM1# тотал геймов' : '#TEAM1# total games',
                    t2 = lang === 'ru' ? '#TEAM2# тотал' : '#TEAM2# total',
                    g2 = lang === 'ru' ? '#TEAM2# тотал геймов' : '#TEAM2# total games';
                if (Object.keys(repls).indexOf(bet.market) > -1) {
                    this.addTo('roots', repls[bet.market].toLowerCase());
                }
                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', t1, g1);
                } else if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', t2, g2);
                }
            }
        };
        params.proceed_basketball = function (bet) {
            this.addTotal('tabs', ['ALL', 'Все']);
            if (!this.full && ['HALF_1', 'TIME_1', 'HALF_TIME'].indexOf(bet.time_value) > -1) {
                const digit = this.tDigit || '1'
                this.addToEl('roots', `${digit}${this.calcTh(digit)} half - `, true);
            } else if (!this.full) {
                const
                    q1 = lang === 'ru' ? 'Первая четверть - ' : 'First quarter - ',
                    q2 = lang === 'ru' ? 'Вторая четверть - ' : 'Second quarter - ',
                    q3 = lang === 'ru' ? 'Третья четверть - ' : 'Third quarter - ',
                    q4 = lang === 'ru' ? 'Четвертая четверть - ' : 'Fourth quarter - ',
                    quarters = [q1, q2, q3, q4],
                    quarter = quarters[this.tDigit - 1];
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', '1x2', quarter + '1x2');
                } else if (bet.market === 'HDP') {
                    const hdp = lang === 'ru' ? 'Фора' : 'Handicap';
                    this.addReplIn('roots', hdp, quarter + hdp.toLowerCase());
                } else if (bet.market === 'TOTAL') {
                    const total = lang === 'ru' ? 'Тотал' : 'Total';
                    this.addReplIn('roots', total, quarter + total.toLowerCase());
                } else if (bet.market === 'T1_TOTAL') {
                    const total = lang === 'ru' ? '#TEAM1# тотал' : '#TEAM1# total';
                    this.addReplIn('roots', total, quarter + total);
                } else if (bet.market === 'T2_TOTAL') {
                    const total = lang === 'ru' ? '#TEAM2# тотал' : '#TEAM2# total';
                    this.addReplIn('roots', total, quarter + total);
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    const oHdp = lang === 'ru' ? 'Победитель (вкл. овертайм)' : 'Winner (incl. overtime)';
                    this.addReplIn('roots', '1x2', oHdp);
                } else if (bet.market === 'HDP') {
                    const mHdp = lang === 'ru' ? 'Фора' : 'Handicap';
                    const oHdp = lang === 'ru' ? 'Фора (вкл. овертайм)' : 'Handicap (incl. overtime)';
                    this.addReplIn('roots', mHdp, oHdp);
                } else if (bet.market === 'TOTAL') {
                    const mTotal = lang === 'ru' ? 'Тотал' : 'Total';
                    const oTotal = lang === 'ru' ? 'Тотал (вкл. овертайм)' : 'Total (incl. overtime)';
                    this.addReplIn('roots', mTotal, oTotal);
                } else if (bet.market === 'T1_TOTAL') {
                    const mTotal1 = lang === 'ru' ? '#TEAM1# тотал' : '#TEAM1# total';
                    const oTotal1 = lang === 'ru' ? '#TEAM1# тотал (вкл. овертайм)' : '#TEAM1# total (incl. overtime)';
                    this.addReplIn('roots', mTotal1, oTotal1);
                } else if (bet.market === 'T2_TOTAL') {
                    const mTotal2 = lang === 'ru' ? '#TEAM2# тотал' : '#TEAM2# total';
                    const oTotal2 = lang === 'ru' ? '#TEAM2# тотал (вкл. овертайм)' : '#TEAM2# total (incl. overtime)';
                    this.addReplIn('roots', mTotal2, oTotal2);
                }
            }
        };
        params.proceed_handball = function (bet) {
            if (this.full) {
                return;
            }
            switch (bet.market) {
                case 'ONE_TWO':
                    this.addReplIn('roots', '1x2', '1st half - 1х2');
                    break;
                case 'HDP':
                    this.addReplIn('roots', 'Handicap', '1st half - handicap');
                    this.addReplIn('roots', 'Handicap (Asian)', '1st half - handicap (Asian)');
                    break;
                case 'TOTAL':
                    this.addReplIn('roots', 'Total', '1st half - total');
                    this.addReplIn('roots', 'Total (Asian)', '1st half - total (Asian)');
                    break;
                case 'T1_TOTAL':
                    this.addReplIn('roots', '#TEAM1# total', '1st half - total #TEAM1#');
                    break;
                case 'T2_TOTAL':
                    this.addReplIn('roots', '#TEAM2# total', '1st half - total #TEAM2#');
                    break;
            }
        };
        params.proceed_hockey = function (bet) {
            const
                p1 = lang === 'ru' ? 'Первый период - ' : 'First period - ',
                p2 = lang === 'ru' ? 'Второй период - ' : 'Second period - ',
                p3 = lang === 'ru' ? 'Третий период - ' : 'Third period - ',
                draw = lang === 'ru' ? 'Ничья ставки нет' : 'Draw no bet',
                periods = [p1, p2, p3],
                period = periods[this.tDigit - 1];
            console.log(this.tDigit);
            if (bet.market === 'HDP' && parseFloat(bet.pivot) === 0) {
                this.addTo('roots', draw);
                this.addTo('pivotKeys', bet.target === 'HOME' ? '#TEAM1#' : '#TEAM2#');
            }
            this.addTotal('tabs', ['ALL', 'Все']);
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    const dc = lang === 'ru' ? 'Двойный шанс' : 'Double chance';
                    this.addReplIn('roots', '1x2', period + '1x2');
                    this.addReplIn('roots', dc, period + dc.toLowerCase());
                } else if (bet.market === 'HDP'&& parseFloat(bet.pivot) === 0) {
                    const hdp0 = lang === 'ru' ? 'ничья ставки нет' : 'draw no bet';
                    this.addTotal('roots', [period + hdp0]);
                    this.addTotal('pivotKeys', [bet.target === 'HOME' ? '#TEAM1#' : '#TEAM2#']);
                } else if (bet.market === 'HDP') {
                    const hdp = lang === 'ru' ? 'Фора' : 'Handicap';
                    this.addReplIn('roots', hdp, period + hdp.toLowerCase());
                } else if (bet.market === 'TOTAL') {
                    const total = lang === 'ru' ? 'Тотал' : 'Total';
                    this.addReplIn('roots', total, period + total);
                }  else if (bet.market === 'T1_TOTAL') {
                    const total = lang === 'ru' ? '#TEAM1# тотал' : '#TEAM1# total';
                    this.addReplIn('roots', total, period + total);
                } else if (bet.market === 'T2_TOTAL') {
                    const total = lang === 'ru' ? '#TEAM2# тотал' : '#TEAM2# total';
                    this.addReplIn('roots', total, period + total);
                }
            }
        };
        params.proceed_cybersport = function (bet) {
            const 
                m1 = lang === 'ru' ? 'Первая карта - ' : 'First map - ',
                m2 = lang === 'ru' ? 'Вторая карта - ' : 'Second map - ',
                m3 = lang === 'ru' ? 'Третья карта - ' : 'Third map - ';
            const maps = [m1, m2, m3];
            const map = maps[this.tDigit - 1];
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    const winner = lang === 'ru' ? 'победитель' : 'winner';
                    this.addReplIn('roots', '1x2', map + winner);
                } else if (bet.market === 'HDP') {
                    const hdp = lang === 'ru' ? 'фора раунда' : 'round handicap';
                    this.addTotal('roots', [map + hdp]);
                } else if (bet.market === 'TOTAL') {
                    const totalC = lang === 'ru' ? 'тотал раунда' : 'total rounds';
                    const totalD = lang === 'ru' ? 'тотал убийств' : 'total kills';
                    this.addTotal('roots', [map + totalD]);
                    this.addTotal('roots', [map + totalC]);
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    const winner = lang === 'ru' ? 'Победитель' : 'Winner';
                    this.addReplIn('roots', '1x2', winner);
                } else if (bet.market === 'HDP') {
                    const hdpM = lang === 'ru' ? 'Фора' : 'Handicap';
                    const hdpO = lang === 'ru' ? 'Фора на карту' : 'Map handicap';
                    this.addReplIn('roots', hdpM, hdpO);
                } else if (bet.market === 'TOTAL') {
                    const totalM = lang === 'ru' ? 'Тотал' : 'Total';
                    const totalO = lang === 'ru' ? 'Тотал карт' : 'Total maps';
                    this.addReplIn('roots', totalM, totalO);
                }
            }
        };
        const final = applyAllMarkets(bet, ['roots', 'pivotKeys', 'tabs'], params, markets, true);
        const m = final[bet.market][bet.target];
        const hPivot = pvt => {
            return parseFloat(pvt) === 0 ? '0' : pvt;
        };

        if (bet.market.indexOf('TOTAL') > -1
            && parseInt(bet.pivot.toString()) === parseFloat(bet.pivot.toString())) {
            m.pivotKeys.push(m.pivotKeys[0] + '.0');
        }

        const $findPivot = $root => {
            let $res = $([]);
            for (const pvt of m.pivotKeys) {
                console.log(`Checking pivot: '${pvt}'`);
                let $pivot = $([]);
                $pivot = $root.parent()
                    .find(`div[data-editor-id="tableOutcomePlateName"]:textEqualsI("${pvt}")`);
                if ($pivot.length === 1) {
                    $res = $pivot;
                    break;
                } else {
                    console.log(`Not found! (pivot length ${$pivot.length} for ${$root.trt()}/${pvt})`);
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

        dLog('green', 'BCGAME', ['Final market is:', m]);

        for (const tab of m.tabs) {
            await waitForCondition(() => $(shadowRoot())
                    .find('div[data-editor-id="tableMarketWrapper"]').length > 0,
                333, 12000, 'No markets!');
            await delayPromise(1333);

            //select tab
            if ($(shadowRoot()).find(`div[data-editor-id="eventMarketTab"] span:textEquals("${tab}")`).length > 0) {
                await mouseChain({
                    target: $(shadowRoot()).find(`div[data-editor-id="eventMarketTab"] span:textEquals("${tab}")`)[0],
                    events: fullClick,
                    error: `click tab ${tab}`
                });
                await delayPromise(2333);
            }

            for (const root of m.roots) {
                console.log(`Checking root: ${root}`);
                const $root = () => $(shadowRoot())
                    .find(`div[data-editor-id="tableMarketWrapper"] > div:first-child:textEqualsI("${root}")`);
                if ($root().length === 0) {
                    console.log(`No root ${root}`);
                    continue;
                }
                $found = $findPivot($root());
                if ($found.length > 0) {
                    break;
                }
            }

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
        const findInData = match => data.find(v => checkEventName(v.team1.toLowerCase()
            + ' vs ' + v.team2.toLowerCase(), match));
        await waitForCondition(() => $(shadowRoot()).find('div[data-editor-id="betslipSelection"]').length > 0,
            333, 10000, 'No coupons!');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        const $coupons = (data.length === 1 && settings.newExpresses === true)
            ? $(shadowRoot()).find('div[data-editor-id="betslipSelection"]').last()
            : $(shadowRoot()).find('div[data-editor-id="betslipSelection"]')
        $coupons.each(function () {
            const $this = $(this);
            const match = $this.find('a > div:first-child > div > div:eq(1) > div:first-child').trt();
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

    const ProccedExpressNew = async () => {
        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));
        const $coefs = () => $(shadowRoot()).find('div[data-editor-id="outcomePlateName"] + div');
        const $events = () => $(shadowRoot()).find('div[data-editor-id="eventCard"]');
        const $coupons = () => $(shadowRoot()).find('div[data-editor-id="betslipSelection"]');
        const currentBets = [];

        // go to builder tab
        if (document.location.href.indexOf('event-builder') === -1) {
            const $builderBtn = () => $(shadowRoot()).find('div[data-editor-id="headerNavigationButton"]:textEquals("Event Builder")');
            const builderBtnExist = await waitForCondition(() => $builderBtn().length > 0, 333, 15000).catch(() => $([]));

            // go to sport page
            if (builderBtnExist.length === 0) {
                window.location.href = 'https://bc.game/sports';
                await waitForCondition(() => $builderBtn().length > 0,
                    333, 22222, 'No $builderBtn!');
            }

            await mouseChain({target: $builderBtn()[0], events: fullClick, error: '$builderBtn'});
            await waitForCondition(() => $events().length > 0,
                333, 22222, 'No builder events!');
        }
        
        if ($(shadowRoot()).find('div[data-editor-id="pillButton"]:eq(1) > div:textEquals("24h")').length === 0) {
            await mouseChain({target: $(shadowRoot()).find('div[data-editor-id="pillButton"]:eq(1)')[0], events: fullClick, error: 'timer select'});
            await delayPromise(2222);
            await mouseChain({target: $(shadowRoot()).find('div.simplebar-content > div > div:eq(1)')[0], events: fullClick, error: 'select 24'});
            await delayPromise(1111);
            await mouseChain({target: $(shadowRoot()).find('div[data-editor-id="pillButton"]:eq(1)')[0], events: fullClick, error: 'timer select close'});
            await waitForCondition(() => $events().length > 0,
                333, 7777, 'No builder events24!');
        }

        const findOption = coef => {
            return isNaN(coef) ? false : coef >= 1.01 && coef <= 1.17;
        };

        const getUniqueRandomNumber = (length) => {
            return Math.floor(Math.random() * length);
        }

        do {
            const randomCoef = getUniqueRandomNumber($coefs().length);
            const eventName = $coefs().eq(randomCoef)
                .closest('div[data-editor-id="eventCard"]')
                .find('div[style="height: 24px; line-height: 24px;"]').toArray()
                .map(el => $(el).trt()).join(' - ');

            if (currentBets.indexOf(eventName) > -1) {
                continue;
            }

            if (eventName.length < 5) {
                dLog('red', 'BCGAME', `'${eventName}' is too short - ${eventName.length}`);
                continue;
            }

            if (used[eventName] >= 1) {
                dLog('big-yellow', 'BCGAME', `${eventName} used ${used[eventName]} times!`);
                continue;
            }

            if (
                $coefs().eq(randomCoef)
                .closest('div[data-editor-id="outcomePlate"] > div')
                .hasClass('null')
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
            dLog('green', 'BCGAME', [`We get selected bets: '${currentBets}', now used:`, used]);
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

    const proceedBet = async (data, command) => {
        lang = document.location.href.indexOf('bc.game/ru') > -1 ? 'ru' : 'eng';
        const $coupons = () => $(shadowRoot()).find('div[data-editor-id="betslipSelection"]');
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
            if (!await eventsWork('bcgame', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'BCGAME',
                    `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                    + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
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

        let willPlace = parseFloat(data[0].stake);
        const acceptChange = () => $(shadowRoot())
            .find('div[data-editor-id="betslipSelectionAcceptButton"]');

        const checkSuccess = async () => {
            const successText = lang === 'ru' 
                ? "Ваша ставка успешно поставлена!"
                : "Your bets have been successfully placed!";
            // Please wait while your bet is placed
            await waitForCondition(() => $(shadowRoot())
                        .find(`div:textEquals(${successText})`).length > 0
                    || acceptChange().length > 0,
                333, 45000, 'No success!');
            return acceptChange().length === 0;
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
        await closePreviousCoupons(settings.newExpresses ? true : false);
        
        await delayPromise(555);
        await openCoupon(data);

        //if sourceExpress check coupon for events
        if (sourceExpress && settings.lastScoreBasketball === '999') {
            const $coupons = $(shadowRoot()).find('div[data-editor-id="betslipSelection"]');

            if ($coupons.length !== 1) {
                await goDirection(1);
                throw 'Error Express source BET, No 1 event in coupon!';
            }
        }

        if (settings.newExpresses && $(shadowRoot()).find('div[data-editor-id="betslipSelection"]').length < settings.newExpressBetsAmount + 1) {
            throw `less than ${settings.newExpressBetsAmount + 1} events in the newExpresses`;
        }

        do {
            await checkCoefs(data);
            const place = willPlace.toString().replace('.00', '').trim();
            const $input = () => $coupons().length > 1 ? $(shadowRoot()).find('label[data-editor-id="betslipStakeInput"] input:last')
                : $(shadowRoot()).find('label[data-editor-id="betslipStakeInput"] input:first');
            dLog('green', 'BCGAME', `Will place (performBet): ${place}`);
            if (acceptChange().length > 0) {
                await dClick(acceptChange()[0], false, 'acceptChange bet');
                await delayPromise(1111);
                await closePreviousCoupons(settings.newExpresses ? true : false);
            }

            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }

            if (parseFloat($input().val()) !== parseFloat(place)) {
                await clearAndSimulate($input()[0], place);
                await delayPromise(555);
                dLog('green', 'BCGAME', `STAKE entered ${willPlace}`);
            }

            const entered = parseFloat($input().val());
            dLog('green', 'BCGAME', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);

            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'BCGAME', 'Entered !== willPlace - try to reenter!');
                continue;
            }

            const $placeBtn = $(shadowRoot()).find('button[data-editor-id="betslipPlaceBetButton"]');

            if ($placeBtn.length === 0) {
                throw 'No place button or button disabled!';
            }

            await delayPromise(555);
            await mouseChain({target: $placeBtn[0], events: fullClick, error: '$placeBtn'});
        } while (!await checkSuccess());

        await delayPromise(555);
        await goDirection(3);
        await delayPromise(777);
        await waitForCondition(() => $(shadowRoot()).find('div[data-editor-id="pillButton"]:eq(1)').length > 0, 333, 10000, 'no open bets button');
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
                coef: $firstBet().find('div[data-editor-id="betTotal"]:eq(2) > div:eq(1)').trt(),
                stake: $firstBet().find('div[data-editor-id="betTotal"]:eq(3) > div:eq(1)').trt().replace(/[^\d.]/g, ''),
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
        dLog('green', 'BCGAME', [`collectBetResults, limit: ${limit}, data:`, data]);
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
        dLog('', 'BCGAME', [`checked: ${checked}, collected:`, collected]);

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
            dLog(res.success ? 'green' : 'red', 'BCGAME',
                `${command} result: ${res.message}`);
            await port.postMessage(await this.prepareResult(command, res));
            if (!res?.success) {
                throw res?.message || 'Unknown error';
            }
            return res;
        }

        async prepareResult(command, res) {
            dLog('', 'BCGAME', [`prepareResult '${command}':`, res, currentBetData,]);
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('bcgame', settings,
                        `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`,
                        true, false);
                    await bMess('WasSuccessStake').set(Date.now());
                    await storeBet(res.message.stake, true);
                    await bMess('Stake Maximums').set(0);

                    if (settings.newExpresses) {
                        // Hint: currentFirstBet MUST exists, otherwise some shit happened!
                        await bMess('WasSuccessExpressNew').set(false);
                        const currentFirstBet = await bMess('currentFirstBet').check(1080000, true);
                        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));

                        if (!used[currentFirstBet]) {
                            used[currentFirstBet] = 1;
                        }

                        dLog('BCGAME', 'blue-big',
                            [`We set bet with first: '${currentFirstBet}', now used:`, used]);

                        if (settings.newExpressBetsAmount > 1) {
                            const currentSecondBet = await bMess('currentSecondBet').check(1080000, true);
                            if (!used[currentSecondBet]) {
                                used[currentSecondBet] = 1;
                            }

                            dLog('BCGAME', 'blue-big',
                            [`We set bet with second: '${currentSecondBet}', now used:`, used]);
                        }

                        await bMess('usedEvents').set(used);
                    }
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
                    resultData.bookmaker = 'BCGAME';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = '380' || 'oddscp';
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
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        }
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
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 2400000;
            settings.betweenBets = message.betweenBets || 40000;
            settings.lastScoreBasketball = message?.stake_fork?.lastScoreBasketball || '';
            settings.newExpresses = !!(settings?.stake_fork && settings.stake_fork?.newExpresses);
            settings.newExpressBetsAmount = Number(message?.stake_fork?.newExpressBetsAmount) || 2;
            ['login', 'password', 'phone', 'email', 'uid',].forEach(k => settings[k] = message[k]);
            if (message.start_url) {
                settings.url = message.start_url;
            }
            if (settings.lastScoreBasketball === '999') {
                settings.sourceDate = Date.now();
                settings.sourceRandom = getSourceRandom();

                // if (settings.sourceRandom >= 15 && settings.sourceRandom <= 19) {
                //     settings.newExpresses = true;
                //     waitSource = true;
                //     if (settings.sourceRandom >= 15 && settings.sourceRandom <= 17) {
                //         settings.newExpressBetsAmount = 1;
                //     }
                // } else {
                //     waitSource = false;
                // }
                dLog('blue', 'BCGAME', `Source current random value - ${settings.sourceRandom}`);
            }
            dLog(`yellow`, 'BCGAME', [`messageProcessor auth settings:`, settings,]);
            authCheck();
            wasAuthCheck = true;
        } else if (commands.exists(message.action)) {
            // Hint: execute command
            if (waitSource) {
                port.postMessage({
                    answered: message.action,
                    status: "error",
                    answer: "BUSY"
                });
            } else {
                busy = true;
                ourCommand.set(message);
                commands.execute(message.action, message.data)
                    .finally(() => {
                        busy = false;
                        ourCommand.clear();
                    });
            }
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
            const command = await bMess('BCGAME').check(40000);
            await waitForCondition(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck), 333, 60000, 'No auth check!');
            bsLogger('green', 'BCGAME', [`Restoring with (${isMain}): `, command]);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));
        port.postMessage({m: "PAGE LOADED!"});
        console.log('%c' + `BCGAME loaded and message sent! (${isMain}) ${document.location.href}`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", async () => {
        await ourCommand.save('BCGAME', increaseDelay ? 150000 : 0);
        bsLogger('green', 'BCGAME', [`Command was set till unload (${isMain}):`, ourCommand.get()]);
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

})();
