(function () {

    "use strict";

    if (window.self !== window.top) {
        return;
    }

    let busy = false;
    let increaseDelay = false;
    let authClicked = 0;
    let enterError = false;
    let period = 7200000;
    let rebootEvery = 1200000;
    let authorized = false;

    const port = chrome.runtime.connect({name: 'port_pinnacle'});

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

    const checkLanguage = async () => {
        const $lang = $('span[class*=style_flag_]');
        let clicked = false;
        if ($lang.length === 0) {
            const $lang = $('div[class^=style_rightSideContainer] div[class^=style_optionGroup]').eq(1);
            if ($lang.length > 0 && $lang.trt() !== 'EN') {
                await mouseChain({
                    target: $lang.find('div[class^=style_dropdown]')[0], events: fullClick, error: '$lang'
                });
                clicked = true;
            }
        } else if ($lang.attr('class').indexOf('en-GB') === -1) {
            await mouseChain({
                target: $lang[0], events: fullClick, error: '$lang', scroll: true
            });
            clicked = true;
        }
        if (clicked) {
            await delayPromise(250);
            const $e = await waitForElement('a[class^="style_langBtn"]:contains("English")',
                200, 4000, true);
            await delayPromise(100);
            await mouseChain({target: $e[0], events: fullClick, error: '$e', scroll: true});
        }
    };

    let started = Date.now();

    let pingForkInterval = null;
    const pingFork = () => {
        if (!settings.forkOnly) {
            return;
        }
        pingForkInterval = setInterval(() => {
            port.postMessage({
                m: "authorized!",
                balance: getBalance(true),
                forkFree: !busy && authorized,
            });
        }, 500)
    };

    const authCheck = () => {
        if (!busy && Date.now() - started > rebootEvery) {
            window.location.reload();
        }

        if (enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            dLog('red', 'pinnacle', 'ERROR AUTH!');
            return;
        }
        (async () => {
            await checkLanguage();
            const $accept = $('button[data-test-id="Button"]:textEquals("Accept")');
            if ($accept.length > 0) {
                await mouseChain({target: $accept[0], events: fullClick, error: '$accept'});
                await delayPromise(100);
            }
            if (checkSE(['button:textEquals("Log in")',
                'input[placeholder="Email or ClientID"]'])) {
                authorized = false;
                // Hint: Log In
                port.postMessage({m: "tech works! 2"});
                await delayPromise(1000);
                await tryToLogIn().catch(e => bsError(port, 'Error login: ' + e));
            } else {
                authorized = true;
                // In case then pingForkInterval is not null, we send message from there
                if (settings.forkOnly && !pingForkInterval) {
                    pingFork();
                } else if (!settings.forkOnly) {
                    port.postMessage({
                        m: "authorized!",
                        balance: getBalance(true),
                    });
                }
            }
        })()
            .catch(e => dLog('red', 'pinnacle', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };


    const tryToLogIn = async () => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        const els = {
            user: findSel(['input[placeholder="Email or ClientID"]', 'input#username']),
            password: findSel(['input[placeholder="Password"]', 'input#password']),
            login: findSel(['div[data-test-id="Loginform-SubmitButton"] button', 'button:textEquals("Log in")']),
        };
        await waitForCondition(() => checkSE(Object.values(els), true),
            333, 10000);
        await delayPromise(3000);
        if ($(els.user).val() !== settings.login) {
            await clearAndSimulate($(els.user)[0], settings.login);
            await delayPromise(3000);
        }
        if ($(els.password).val() !== settings.password) {
            await clearAndSimulate($(els.password)[0], settings.password);
            await delayPromise(3000);
        }
        await mouseChain({target: $(els.login)[0], events: fullClick, error: 'login'});
        await delayPromise(333);

        authClicked = Date.now();
        dLog('', 'pinnacle', 'Auth clicked!');
        return "auth_clicked";
    };

    const getBalance = returnNull => {
        const $b = $('span[data-test-id="QuickCashier-BankRoll"]');
        if ($b.length > 0) {
            return parseFloat($b.trt().replace(/[^\d.]/g, ''));
        } else {
            return returnNull ? 'null' : 0;
        }
    }

    const checkBalance = willPlace => {
        return true;
        const balance = getBalance();
        if (balance < willPlace) {
            throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
        } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
            throw 'Undefined or NaN will place';
        }
    };

    const
        switchToSport = async (bet, event, force) => {
            const
                sport = bet.sport,
                prematch = bet.type === 'PREMATCH',
                accordance = {
                    'FOOTBALL': 'Soccer',
                    'TENNIS': 'Tennis',
                    'TABLETENNIS': 'Table Tennis',
                    'BASKETBALL': 'Basketball',
                    'BASEBALL': 'Football',
                    'HOCKEY': 'Hockey',
                    'VOLLEYBALL': 'Volleyball',
                    'CYBERSPORT': 'Esports',
                },
                ourSport = accordance[sport],
                goSportBreadcrumb = async () => {
                    dLog('', 'PN88', 'goSportBreadcrumb');
                    await mouseChain({
                        target: $('li[data-test-id="Breadcrumb-Item-Sport"] a')[0],
                        events: fullClick,
                        error: 'back to sport',
                    });
                    await delayPromise(250);
                };
            dLog('', 'PN88', `switchToSport (${sport}/${ourSport}, ${prematch}, ${force})`)
            if (!ourSport) {
                throw `${sport} not supported!`;
            }
            let
                $found = $([]),
                $sp = (c) =>
                    $(`h3:textEquals("${c}")`).parent().find('li').find(`label:textEquals(${ourSport})`);
            await waitForCondition(() => ["Top Sports", "A-Z Sports"].some(c => $sp(c).length > 0),
                100, 80000, 'switchToSport - no sports!');
            for (const c of ["Top Sports", "A-Z Sports"]) {
                if ($sp(c).length > 0) {
                    $found = $sp(c);
                    break;
                }
            }
            if ($found.length === 0) {
                throw `${sport}/${ourSport} not found!`;
            }
            if ($found.closest('a').attr('class')
                .indexOf('style_desktop_active_') === -1 || force) {
                await mouseChain({target: $found[0], events: fullClick, error: '$found'});
                await delayPromise(250);
                console.log(`Clicked to sport ${sport}/${ourSport}`);
            } else {
                console.log(`Sport ${sport}/${ourSport} already selected`);
                const leagueHere = $('li[data-test-id="Breadcrumb-Item-League"]').trt().toLowerCase();
                if (leagueHere && !checkEventOrLeague(bet.league, leagueHere, 90)) {
                    dLog('', 'PN88', `We're in the wrong league!`);
                    await goSportBreadcrumb();
                }
            }
            let eventFound = false, round = 1, noTabs = 0;
            do {
                const texts = !prematch
                    ? ['Live']
                    : round === 1
                        ? ['Matchups', 'Regulation Time', 'Highlights', 'Leagues', 'All']
                        : ['Leagues', 'All'];
                const $tab = () => {
                    const
                        tabsGroup = 'div[data-testid="Tabs"]',
                        browseHeader = 'div[data-test-id="Browse-Header"]';
                    if ($(tabsGroup).length > 0) {
                        return $(tabsGroup).find(
                            findSelIn(texts.map(c => `a:textEquals("${c}")`),
                                $(tabsGroup)));
                    } else {
                        return $(browseHeader).find(
                            findSelIn(texts.map(c => `button:textEquals("${c}")`),
                                $(browseHeader)));
                    }
                };
                const tRes = await waitForCondition(() => $tab().length > 0, 250, 15000,
                    `$tab: ${texts.join(', ')}`).catch(() => 'NO_TAB');
                if (tRes === 'NO_TAB') {
                    dLog('red', 'PN88', `No tab!`);
                    noTabs++;
                    if (noTabs > 3) {
                        break;
                    }
                    if ($('li[data-test-id="Breadcrumb-Item-League"]').length > 0) {
                        await goSportBreadcrumb();
                        continue;
                    } else {
                        throw `NO_TAB and we're not in the sport`;
                    }
                }
                console.log('Tabs here!');
                if ($tab().attr("class").indexOf("style_activeTab") === -1
                    && $tab().attr("class").indexOf("style_selected") === -1) {
                    await mouseChain({target: $tab()[0], events: fullClick, error: '$tab'});
                    await delayPromise(250);
                }
                await waitForElement([`div[class^=style_matchupMetadata]`,
                        'div[data-test-id^="Leagues-Container"] li[class^="style_listItem_"]'],
                    250, 80000, true, 1, 'No events!');
                eventFound = await findEvent(bet, event, round > 1);
                if (!eventFound) {
                    round++;
                }
            } while (!eventFound && round < (prematch ? 3 : 2));
            if (!eventFound) {
                throw `Event not found!`;
            }
            return true;
        },
        goToLiveAndSportAndEvent = async (bet, event) => {
            const
                sport = bet.sport,
                prematch = bet.type === 'PREMATCH';
            console.log(`goToLiveAndSport (${sport}, ${prematch})`);
            const link = 'a[data-gtm-id="top_nav_SportsBetting"]';
            const $sl = () => $(link);
            if ($sl().length > 0 && $sl().attr('class').indexOf('style_selected_') === -1) {
                // we are not in the match and not in the sports betting
                console.log('SB not selected!');
                await mouseChain({target: $sl()[0], events: fullClick, error: '$sl'});
                await delayPromise(250);
            } else if ($('label[class^=style_participantName]').length > 0) {
                // we are in the match
                return await switchToSport(bet, event, true);
            }
            return await switchToSport(bet, event);
        };

    const checkScore = (bet, score) => {
        if (bet.score === '' || bet.sport !== 'FOOTBALL'
            || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(bet.market) > -1) {
            return '';
        }
        if (score !== bet.score) {
            throw `SCORE_CHANGED we need: ${bet.score}, we have: ${score}`;
        }
    };

    const checkEventOrLeague = (event, eventHere, percent) => {
        const res = eventHere === event ||
            locutus_similar_text(eventHere, event, true) > (percent || 75);
        console.log(`'${event}' ${res ? '===' : '!=='} '${eventHere}'`);
        return res;
    }

    const findEvent = async (bet, event, withLeague) => {
        let $evt = $([]);
        if (withLeague) {
            const leagueHere = $('div[data-test-id="Browse-Header"] h1').trt()
                .replace(' Odds', '')
                .toLowerCase();
            if (leagueHere.length === 0 || !checkEventOrLeague(bet.league.toLowerCase(), leagueHere)) {
                const
                    $leagues = await waitForElement(
                        'div[data-test-id^="Leagues-Container"] li[class^="style_listItem_"]',
                        100, 80000, true, 1, 'No leagues!');
                let $league = $([]);
                $leagues.each((i, el) => {
                    if (checkEventOrLeague(
                        bet.league.toLowerCase(),
                        $(el).find('label').trt().toLowerCase(),
                        90
                    )) {
                        $league = $(el);
                        return false;
                    }
                });
                if ($league.length === 0) {
                    throw `League ${bet.league} not found!`;
                }
                await mouseChain({
                    target: $league.find('a')[0],
                    events: fullClick, error: '$league'
                });
                await delayPromise(250);
            }
        }
        const $events = await waitForElement(`div[class^=style_matchupMetadata]`,
            250, 5000, true);
        $events.each(function () {
            const
                $this = $(this),
                teams = [],
                $teams = $this.find('span.event-row-participant')
                    .each((i, el) => teams.push($(el).trt().toLowerCase()
                        .replace(' (match)', '')
                        .replace(' (w)', ''))),
                eventHere = `${teams[0]} - ${teams[1]}`;
            if (checkEventOrLeague(event, eventHere)) {
                $evt = $this;
                return false;
            }
        });
        if ($evt.length === 0) {
            return false;
        } else {
            await mouseChain({
                target: $evt.closest('a')[0],
                events: fullClick, error: 'findEvent'
            });
        }
        return true;
    };

    const openEvent = async bet => {
        if (!!bet.direct_link && document.location.href !== bet.direct_link) {
            document.location.href = bet.direct_link;
            await waitForCondition(() => document.location.href === bet.direct_link,
                250, 10000);
            await delayPromise(500);
        }
        const event = `${bet.team1} - ${bet.team2}`.toLowerCase();
        const checkWeAreHere = () => {
            const teams = [];
            $('label[class^=style_participantName]')
                .each((i, el) => teams.push($(el).trt()));
            if (!!bet.direct_link && document.location.href === bet.direct_link) {
                bet.team1 = bet.team1 || teams[0];
                bet.team2 = bet.team2 || teams[1];
                return true;
            }
            const eventHere = teams.join(' - ').toLowerCase();
            return checkEventOrLeague(event, eventHere);
        };
        if (checkWeAreHere()) {
            return;
        }
        await goToLiveAndSportAndEvent(bet, event);
        await waitForCondition(checkWeAreHere, 250, 10000);
        const $multics = $('div[class^=style_matchupContainer]');
        if ($multics.length > 1) {
            for (let i = 1; i < $multics.length; i++) {
                await mouseChain({
                    target: $multics.find('a[class^=style_removeIcon]')[0],
                    events: fullClick, error: ''
                })
            }
        }
    };

    const openCoupon = async data => {
        for (const bet of data) {
            if (!!bet.direct_link) {
                bet.direct_link = bet.direct_link.replace('/ru/', '/en/');
            }
            await openEvent(bet);
            const $el = await getBetElement(bet);
            dLog('green', 'pinnacle',
                `We got bet: ${$el.find('span[class^=style_price]').trt()}`);
            await mouseChain({target: $el[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(500);
        }
    };

    const getBetElement = async bet => {
        if (bet.time_value.indexOf('_GAME_') > -1) {
            const
                source = bet.time_value,
                digits = /(\d+)\D+(\d+)/.exec(source);
            if (digits && digits[1] && digits[2]) {
                bet.time_value = `SET_${digits[2]}_GAME_${digits[1]}`;
                dLog('orange', 'pinnacle', `${source} => ${bet.time_value}`);
            }
        }
        let tries = 1;
        //#-#-START
        const teams = [];
        $('label[class^=style_participantName]')
            .each((i, el) => teams.push($(el).trt()));
        bet.team1 = bet.team1 || teams[0];
        bet.team2 = bet.team2 || teams[1];

        const markets = {
            'ONE_TWO': {
                'ONE': {
                    tab: ['All'],
                    roots: ['Money Line – Match',],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    tab: ['All'],
                    roots: ['Money Line – Match',],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    tab: ['All'],
                    roots: ['Money Line – Match',],
                    pivotKeys: ['Draw',],
                },
                'ONE_DRAW': {
                    tab: ['All'],
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# Or Draw',],
                },
                'TWO_DRAW': {
                    tab: ['All'],
                    roots: ['Double Chance'],
                    pivotKeys: ['Draw Or #TEAM2#',],
                },
                'ONE_TWO': {
                    tab: ['All'],
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# Or #TEAM2#',],
                }
            },
            'TOTAL': {
                'OVER': {
                    tab: ['All'],
                    roots: ['Total – Match',],
                    pivotKeys: ['Over #PIVOT#', 'Over (#PIVOT#)',],
                },
                'UNDER': {
                    tab: ['All'],
                    roots: ['Total – Match',],
                    pivotKeys: ['Under #PIVOT#', 'Under (#PIVOT#)',],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tab: ['All'],
                    roots: ['Team Total – Match',],
                    pivotRoots: ['#TEAM1#'],
                    pivotKeys: ['Over #PIVOT#', 'Over (#PIVOT#)',],
                },
                'UNDER': {
                    tab: ['All'],
                    roots: ['Team Total – Match',],
                    pivotRoots: ['#TEAM1#'],
                    pivotKeys: ['Under #PIVOT#', 'Under (#PIVOT#)',],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tab: ['All'],
                    roots: ['Team Total – Match',],
                    pivotRoots: ['#TEAM2#'],
                    pivotKeys: ['Over #PIVOT#', 'Over (#PIVOT#)',],
                },
                'UNDER': {
                    tab: ['All'],
                    roots: ['Team Total – Match',],
                    pivotRoots: ['#TEAM2#'],
                    pivotKeys: ['Under #PIVOT#', 'Under (#PIVOT#)',],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    tab: ['Corners'],
                    roots: ['Total (Corners) – Match',],
                    pivotKeys: ['Over #PIVOT# Corners', 'Over (#PIVOT#) Corners',],
                },
                'UNDER': {
                    tab: ['Corners'],
                    roots: ['Total (Corners) – Match',],
                    pivotKeys: ['Under #PIVOT# Corners', 'Under (#PIVOT#) Corners',],
                },
            },
            'CORNER_HDP': {
                'HOME': {
                    tab: ['Corners'],
                    roots: ['Handicap (Corners) – Match',],
                    pivotRoots: ['#TEAM1# (Corners)'],
                    pivotKeys: ['#PIVOT#',],
                },
                'AWAY': {
                    tab: ['Corners'],
                    roots: ['Handicap (Corners) – Match',],
                    pivotRoots: ['#TEAM2# (Corners)'],
                    pivotKeys: ['#PIVOT#',],
                },
            },
            'HDP': {
                'HOME': {
                    tab: ['All'],
                    roots: ['Handicap – Match'],
                    pivotRoots: ['#TEAM1#'],
                    pivotKeys: ['#PIVOT#'],
                },
                'AWAY': {
                    tab: ['All'],
                    roots: ['Handicap – Match'],
                    pivotRoots: ['#TEAM2#'],
                    pivotKeys: ['#PIVOT#'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    tab: ['All'],
                    roots: ['3-Way Handicap #TEAM1# #PIVOT#'],
                    pivotKeys: ['#TEAM1# (#HPIVOT#)'],
                },
                'H2': {
                    tab: ['All'],
                    roots: ['3-Way Handicap #TEAM1# #PIVOT#'],
                    pivotKeys: ['#TEAM2# (#IPIVOT#)'],
                },
                'HX': {
                    tab: ['All'],
                    roots: ['3-Way Handicap England #PIVOT#'],
                    pivotKeys: ['Draw - (#TEAM1# #HPIVOT#)'],
                }
            },
        };

        if (typeof markets[bet.market] === 'undefined' || typeof markets[bet.market][bet.target] === 'undefined') {
            throw `Unsupported ${bet.time_value} / ${bet.market} / ${bet.target}`;
        }

        const params = new AllMarkets(bet);

        params.proceed_football = function (bet) {
            if (bet.market === 'HDP' && parseFloat(bet.pivot) === 0) {
                this.addTo('roots', !this.full ? 'Draw No Bet 1st Half' : 'Draw No Bet');
                this.addTo('pivotKeys', `#TEAM${this.hDigit}#`);
                //this.addRemove('pivotRoots', `#TEAM${this.hDigit}#`);
                if (!this.full) {
                    this.addTo('roots', ['Draw No Bet 1st Half']);
                }
                return;
            }
            if (!this.full) {
                this.addTotal('tab', ['1st Half']);
                this.addReplIn('roots', `Match`, `1st Half`);
                if (bet.market === 'ONE_TWO' && ['ONE_TWO', 'ONE_DRAW', 'TWO_DRAW'].indexOf(bet.target) > -1) {
                    this.addTotal('tab', ['All']);
                    this.addTotal('roots', ['Double Chance 1st Half']);
                } else if (bet.market.indexOf('CORNER') > -1) {
                    this.addTotal('tab', ['Corners']);
                } else if (bet.market !== 'EURO_HDP') {
                    this.addTo('tab', 'All');
                }
            }
        };

        params.proceed_tennis = function (bet) {
            if (bet.market === 'ONE_TWO') {
                if (bet.time_value.indexOf('SET') > -1 && bet.time_value.indexOf('GAME') > -1) {
                    const parts = bet.time_value.split('_GAME_');
                    this.addTotal('tab', ['Games']);
                    this.addTotal('roots',
                        [`${this.tDigit}${this.th} Set Game ${parseInt(parts[1].trim())} - Winner`]);
                } else {
                    this.addTotal('roots', ['Money Line (Sets) – Match']);
                }
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total (Games) – Match']);
                this.addTotal('pivotKeys',
                    [bet.target === 'OVER' ? 'Over #PIVOT# Games' : 'Under #PIVOT# Games']);
            } else if (bet.market.indexOf('T1_') > -1 || bet.market.indexOf('T2_') > -1) {
                this.addTotal('roots', [`Team Total (Games) – Match`]);
                this.addTotal('pivotRoots', [`#TEAM${this.mDigit}# (Games)`]);
                this.addTotal('pivotKeys',
                    [bet.target === 'OVER' ? 'Over #PIVOT# Games' : 'Under #PIVOT# Games']);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Handicap (Games) – Match']);
                this.addTotal('pivotRoots', [`#TEAM${this.hDigit}# (Games)`]);
            }
            if (!this.full && bet.time_value.indexOf('GAME') === -1) {
                this.addReplIn('roots', `Match`, `${this.tDigit}${this.th} Set`);
            }
        };

        params.proceed_hockey = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addTotal('roots', ['Money Line – Regulation Time']);
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total – Regulation Time']);
            } else if (bet.market.indexOf('T1_') > -1 || bet.market.indexOf('T2_') > -1) {
                this.addTotal('pivotRoots', [`#TEAM${this.mDigit}#`]);
                this.addTotal('roots', [`Team Total – Regulation Time`]);
            } else if (bet.market === 'HDP') {
                this.addTotal('pivotRoots', [`#TEAM${this.hDigit}#`]);
                this.addTotal('roots', ['Handicap – Regulation Time']);
            }
            if (!this.full) {
                this.addReplIn('roots', 'Regulation Time', `${this.tDigit}${this.th} Period`);
            }
        }

        params.proceed_volleyball = function (bet) {
            if (!this.full) {
                this.addTotal('tab', [`${this.tDigit}${this.th} Set`]);
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('roots', [`Money Line (Points) – ${this.tDigit}${this.th} Set`]);
                    this.addToEl('pivotKeys', `(Points)`);
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', [`Total (Points) – ${this.tDigit}${this.th} Set`]);
                    this.addToEl('pivotKeys', `Points`);
                } else if (bet.market.indexOf('T1_') > -1 || bet.market.indexOf('T2_') > -1) {
                    this.addTotal('pivotRoots', [`#TEAM${this.mDigit}# (Points)`]);
                    this.addTotal('roots', [`Team Total (Points) – ${this.tDigit}${this.th} Set`]);
                    this.addToEl('pivotKeys', `Points`);
                } else if (bet.market === 'HDP') {
                    this.addToEl('pivotRoots', `(Points)`);
                    this.addTotal('roots', [`Handicap (Points) – ${this.tDigit}${this.th} Set`]);
                }
            }
        }

        params.proceed_cybersport = function (bet) {
            if (bet.market === 'ONE_TWO') {
                //this.addTotal('roots', ['Winner', 'Winner (Incl. Overtime)']);
            } else if (bet.market === 'TOTAL') {
                //this.addTotal('roots', ['Total Rounds (Incl. Overtime)', 'Total Maps']);
            } else if (bet.market === 'HDP') {
                //this.addTotal('roots', ['Round Handicap (Incl. Overtime)']);
            }
            if (!this.full) {
                this.addTotal('tab', [`Map ${this.tDigit}`]);
                this.addReplIn('roots', 'Match', `Map ${this.tDigit}`);
            }
        }

        params.proceed_basketball = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addTotal('roots', ['Money Line – Game']);
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total – Game']);
            } else if (bet.market.indexOf('T1_') > -1 || bet.market.indexOf('T2_') > -1) {
                this.addTotal('roots', [`Team Total – Game`]);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Handicap – Game']);
            }
            if (!this.full && ['HALF_1', 'TIME_1'].indexOf(bet.time_value) > -1) {
                this.addTotal('tab', ['1st Half']);
                this.addReplIn('roots', `Game`, `1st Half`);
            } else if (!this.full) {
                this.addTotal('tab', [`${this.tDigit}${this.th} Quarter`]);
                this.addReplIn('roots', `Game`, `${this.tDigit}${this.th} Quarter`);
            }
        }

        const final = applyAllMarkets(bet, ['tab', 'roots', 'pivotKeys', 'pivotRoots'],
            params, markets);

        const m = final[bet.market][bet.target];

        const ePivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };

        const hPivot = pvt => parseInt(pvt) > 0 ? `+${pvt}` : pvt

        replaceInner(m, {
            '#TEAM1#': bet.team1,
            '#TEAM2#': bet.team2,
            '#PIVOT#': bet.pivot,
            '#EPIVOT#': ePivot(bet.pivot),
            '#HPIVOT#': hPivot(bet.pivot),
            '#IPIVOT#': hPivot(bet.pivot * -1),
        });

        dLog('green', 'BW', ['Final market is:', m]);

        const $findPivot = $root => {
            let $res = $([]);
            if ($root.find('ul[class^="style_subHeading"]').length > 0 && m.pivotRoots
                && m.pivotRoots.length > 0) {
                for (const pRoot of m.pivotRoots) {
                    let ourIdx = -1;
                    $root.find('ul[class^="style_subHeading"] li').each((idx, val) => {
                        if ($(val).trt() === pRoot) {
                            ourIdx = idx;
                            return false;
                        } else {
                            console.log(`${$(val).trt()} !== ${pRoot}`);
                        }
                    });
                    if (ourIdx === -1) {
                        continue;
                    }
                    for (const pvtD of m.pivotKeys) {
                        const pvt = parseFloat(pvtD);
                        $root.find('div[class^=style_buttonRow_]').each(function (idx) {
                            const tt = $(this).parent().attr('class').indexOf('style_team_total') > -1;
                            if (tt && idx !== ourIdx) {
                                return true;
                            }
                            const $button = tt
                                ? $(this).find('button')
                                : $(this).find('button').eq(ourIdx);
                            if (tt) {
                                $button.each(function () {
                                    if ($(this).attr('title') === pvtD) {
                                        $res = $(this);
                                        return false;
                                    } else {
                                        console.log(`${$(this).attr('title')} !== '${pvtD}'`);
                                    }
                                });
                            } else {
                                if ($button.length > 0 && !isNaN(pvt)
                                    && parseFloat($button.attr('title')) === pvt) {
                                    $res = $button;
                                    return false;
                                } else {
                                    console.log(`${ourIdx} => '${$button.attr('title')}' !== ${pvt}/'${pvtD}'`);
                                }
                            }
                        });
                        if ($res.length > 0) {
                            break;
                        }
                    }
                    if ($res.length > 0) {
                        break;
                    }
                }
            } else {
                for (const pvt of m.pivotKeys) {
                    let test = `Checking pivot: '${pvt}' - `;
                    let $pivot = $root.find(`button[title="${pvt}"]`);
                    console.log(`${test}result: ${$pivot.length}`);
                    if ($pivot.length === 1) {
                        return $pivot;
                    } else if ($pivot.length > 1) {
                        throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                    }
                }
            }
            return $res;
        };

        let $found = $([]);
        do {
            console.log(`OUTER ${tries}!`);
            for (const tab of m.tab) {
                const $tabs = await waitForElement('div[class^=style_filterBarContent] button',
                    50, 500)
                    .catch(() => $([]));
                if ($tabs.length > 1) {
                    const $tab = await waitForElement(
                        () => $('div[class^=style_filterBarContent]')
                            .find(`button:textEquals("${tab}")`),
                        250, 3000)
                        .catch(() => $([]));
                    if ($tab.length > 0 && $tab.attr('class').indexOf('style_selected_') === -1) {
                        await mouseChain({target: $tab[0], events: fullClick, error: '$tab'});
                        await delayPromise(1500);
                    }
                }
                for (const root of m.roots) {
                    console.log(`Checking root: ${root}`);
                    const $root = () => $('div.matchup-market-groups div[data-test-id="Collapse"]')
                        .filter(function (idx) {
                            return $(this).find(`span:textEquals("${root}")`).length > 0;
                        });
                    if ($root().length === 0) {
                        continue;
                    }
                    $root()[0].scrollIntoView();
                    window.scrollBy(0, -200);
                    // Open if necessary
                    if ($root().attr('data-collapsed') === 'true') {
                        await mouseChain({
                            target: $root().find('span.collapse-icon')[0],
                            events: fullClick, error: 'collapse', scroll: true
                        });
                        await delayPromise(1000);
                    }
                    // Switch to All if it exists and not active
                    const $all = $root().find('button[class^=style_toggleMarkets]:textEquals("See more")');
                    if ($all.length > 0) {
                        await mouseChain({
                            target: $all[0],
                            events: fullClick, error: 'Switch to all',
                        });
                        await delayPromise(1000);
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
            if ($found.length === 0 && tries >= 3) {
                throw `${bet.sport}/${bet.type}/${bet.time_value}/${bet.market}/${bet.target}/${bet.pivot}`
                + ' not found :(';
            } else if ($found.length === 0) {
                tries++;
                await delayPromise(2500);
            } else {
                $found.closest('div[data-test-id="Collapse"]')[0].scrollIntoView();
                window.scrollBy(0, -200);
                break;
            }
        } while (tries <= 3);
        return $found;
        //#-#-FINISH
    };

    const closePrevious = async () => {
        const $rb = () => $('div[data-test-id="Betslip-RemoveAllButton"]');
        const $confirm = () => $('button[data-test-id="Betslip-RemoveAllModal-ConfirmButton"]');
        if ($rb().length > 0) {
            await mouseChain({target: $rb()[0], events: fullClick, error: '$rb'});
            await waitForCondition(() => $confirm().length > 0, 50, 500)
                .catch(() => console.log('No confirm!'));
        }
        if ($confirm().length > 0) {
            await mouseChain({target: $confirm()[0], events: fullClick, error: '$confirm'});
        }
        await $('button.betslip-close-button').eachAsync(async function () {
            await mouseChain({
                target: $(this)[0], events: fullClick,
                error: 'betslip-close-button'
            });
            await delayPromise(250);
        });
    };

    const placeBetSels = [
        'button[data-test-id="Betslip-ConfirmBetButton"]:visible',
    ];

    const viewMyBetsSel = 'button.variant-action:contains("View My Bets")';

    const checkSuccess = async () => {
        //const $vb = await waitForElement(viewMyBetsSel, 250, 40000,)
        // rejected
        const
            statuses = [
                'div[data-test-id="Betslip-CardMessage"]:contains("Below Minimum Stake")',
                'div[data-test-id="Betslip-CardMessage"]:contains("Bet Accepted")',
            ],
            $vb = await waitForElement(statuses, 250, 40000,)
                .catch(e => $([])),
            st = ['Below Minimum Stake', 'Bet Accepted'].find(c => $vb.trt().indexOf(c) > -1);
        if (st === 'Below Minimum Stake') {
            throw $vb.trt();
        }
        return st && st.indexOf('Accepted') > -1;
    };

    const proceedBet = async (data, command) => {
        const wasSuccessPinnacle = await bMess('WasSuccessPinnacle').check(20500, true)
            .catch(() => 0);
        if (Date.now() - wasSuccessPinnacle < 20100) {
            throw `To early after previous success bet ${Date.now() - wasSuccessPinnacle}!`
        }
        await closePrevious();
        let willPlace = parseFloat(data[0].stake);
        if (!willPlace) {
            throw`Bad will place: ${willPlace}, ${data[0].stake}`;
        }
        await waitForCondition(() => !!getBalance(true), 50, 1000)
            .catch(() => `Balance still zero :(`);
        checkBalance(willPlace);
        await openCoupon(data);
        do {
            await checkCoefs(data);
            checkBalance(willPlace);
            const place = willPlace.toString().replace('.00', '').trim();
            dLog('green', 'pinnacle', `Will place (performBet): ${place}, balance: ${getBalance()}`);
            const $input = () => $('input[placeholder="Stake"]').last();
            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            if (parseFloat($input().val()) !== parseFloat(place)) {
                $input().val(place);
                fireInputEvent($input()[0]);
                fireChangeEvent($input()[0]);
                await delayPromise(300);
            }
            const $pb = $(findSel(placeBetSels));
            if ($pb.length !== 1) {
                throw 'No place button or its not active!';
            } else {
                await mouseChain({target: $pb[0], events: fullClick, error: '$pb'});
                dLog('green', 'pinnacle', `Place bet ${findSel(placeBetSels)} clicked!`);
            }
        } while (!await checkSuccess());
        await delayPromise(1000);
        const
            $card = $('div[data-test-id="Betslip-Card"]'),
            external_id = $card.find('span[class^=style_id_]:contains("#")')
                .trt().replace(/\D/g, ''),
            stake = $card.find('span[class^=style_label_]:contains("Stake")')
                .parent().find('span[class^=style_subLabel_]').trt()
                .replace(/[^\d.]/g, ''),
            payout = $card.find('span[class^=style_label_]:contains("Win")')
                .parent().find('span[class^=style_subLabel_]').trt()
                .replace(/[^\d.]/g, ''),
            coef = $card.find('div[data-test-id="SelectionDetails-Odds"]').trt();
        if (!external_id) {
            throw `It looks like bet placed, but not connected!`;
        }
        dLog('green', 'pinnacle', [`Bet placed!`]);
        return {
            success: true,
            message: {
                external_id,
                coef: parseFloat(coef),
                stake: parseFloat(stake),
                payout: parseFloat(payout),
                max: '7777777',
                status: 'ACCEPTED',
            },
        };
    };

    const checkCoefs = async data => {
        $('div[class^=style_multiplesContainer] div[data-test-id="Betslip-Card"]')
        const findInData = match => data.find(v =>
            locutus_similar_text(`${v.team1} - ${v.team2}`.toLowerCase(), match.toLowerCase(), true) > 70);
        const $coupons = data.length > 1
            ? $('#betslip-options div[data-test-id="Betslip-Card"]')
            : $('div[class^=style_singlesMultiples] div[data-test-id="Betslip-Card"]');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $(this).find('div.selectionDetailsMatchupName').trt();
            let localCoef = parseFloat($this
                .find('div[data-test-id="SelectionDetails-Odds"]').trt());
            console.log(`${match} - ${localCoef}`);
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
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef))
                ? parseFloat(data[0].coef) : totalCoef / 1.21;
            if (totalCoef >= nCheck * 1.2) {
                throw `Coef TOO BIG: ${totalCoef} instead of ${data[0].coef}`;
            } else if (totalCoef < nCheck) {
                throw `LOW_COEF ${data[0].coef} > ${totalCoef}`;
            } else {
                return `Coefs fine! here: ${totalCoef}, need: ${nCheck}/${data[0].coef}`;
            }
        } else {
            throw errors.join('; ') + (checked !== data.length
                ? ` some stakes not checked (${checked}/${data.length})!` : '');
        }
    };

    // Test:
    /*
    await checkCoefs([
        //{team1: 'James Madison', team2: 'North Carolina', coef: '3.8'},
        {team1: 'New York Knicks', team2: 'Phoenix Suns', coef: '2.1'},
    ]);
     */

    const collectBetResults = async (inD, command) => {
        const collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        await mouseChain({
            target: $('div[data-gtm-id="super_nav_account"]')[0],
            events: fullClick, error: 'collectBetResults 1'
        });
        const $ma = await waitForElement('li[class^=style_menuItem]:textEquals("My Account") a',
            250, 10000);
        await delayPromise(500);
        await mouseChain({target: $ma[0], events: fullClick, error: '$ma'});
        const $bh = await waitForElement('label:textEquals("Betting history")',
            250, 10000);
        await delayPromise(500);
        await mouseChain({target: $bh[0], events: fullClick, error: '$bh'});
        let gone = 0, loadMore = false;
        const done = [];
        do {
            const $betCards = await waitForElement('div[data-test-id="betCard"]', 100, 100000);
            $betCards.each(function () {
                const
                    $this = $(this),
                    html = $this.html();
                if (done.indexOf(html) > -1) {
                    return true;
                } else {
                    done.push(html);
                }
                gone++;
                const
                    external_id = $this.find('div[class^=style_container]:contains("#")').trt()
                        .replace(/\D/g, ''),
                    statusDraft = $this.find('div[class^=style_betStatus]').trt(),
                    status = statusDraft === 'Pending'
                        ? 'ACCEPTED'
                        : statusDraft.indexOf('Loss') > -1
                            ? 'LOSE'
                            : statusDraft === 'Refunded'
                                ? 'REFUNDED'
                                : 'WON',
                    stake = $this.find('div[class^=style_label_]:textEquals("Stake:")')
                        .parent().find('div[class^=style_value_]').trt(),
                    payout = $this.find('div[class^=style_label_]:textEquals("Win:")')
                        .parent().find('div[class^=style_value_]').trt();
                if (!!external_id && (data.length === 0 || data.indexOf(external_id) > -1)) {
                    collected.push({
                        external_id,
                        coef: $this.find('div[class^=style_container]:contains("@")').trt()
                            .replace(/[^\d.]/g, ''),
                        stake: parseFloat(stake.replace(/[^\d.]/g, '')),
                        status,
                        result: status === 'ACCEPTED' ? '0' : parseFloat(payout) + parseFloat(stake),
                    });
                }
                if (gone > limit) {
                    return false;
                }
            });
            const $loadMore = $('button[data-test-id="loadMore-button"]');
            if ($loadMore.length > 0) {
                loadMore = true;
                await mouseChain({
                    target: $loadMore[0], events: fullClick,
                    error: '$loadMore', scroll: true,
                })
                await delayPromise(3000);
            } else {
                loadMore = false;
            }
        } while (loadMore);
        dLog('green', 'pinnacle', ['Collected', collected]);
        return {success: true, message: collected};
    };

    const proceedForkBet = async (dataIn, command, testing) => {
        // Hint: here we need open coupon or do bet (depending of shoulder number)
        if (testing) {
            dLog('green', 'PINNACLE',
                [`proceedForkBet (shoulder: ${settings.fork.shoulder}):`, dataIn]);
            await delayPromise(30000);
            throw `Testing proceedForkBet!`;
        }
    };

    const proceedForkBetConfirm = async (data, command, testing) => {
        // Hint: confirmation for bet if shoulder number is 2
        if (testing) {
            dLog('green', 'PINNACLE',
                [`proceedForkBetConfirm:`, data]);
            await delayPromise(10000);
            throw `Testing proceedForkBetConfirm!`;
        }
    };

    const commands = new class commands {
        constructor() {
            this.testing = true;
            this.cLinks = {
                'BET': proceedBet,
                'EXPRESS_BET': proceedBet,
                'FORK_BET': proceedForkBet,
                'FORK_BET_CONFIRM': proceedForkBetConfirm,
                'BET_RESULT': collectBetResults,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data) {
            currentBetData.init(data);
            let res;
            if (!this.testing && settings.forkOnly && ['BET', 'EXPRESS_BET'].indexOf(command) !== -1) {
                res = {success: false, message: 'Fork only mode'};
            } else {
                res = await this.cLinks[command](data, command, this.testing).catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            }
            dLog(res.success ? 'green' : 'red', 'pinnacle', `${command} result: ${res.message}`);
            this.prepareResult(command, res)
                .then(m => port.postMessage(m))
            if (!res?.success) {
                throw res?.message || 'Unknown error';
            }
            return res;
        }

        async getEvents() {
            const events = await bMess('stakeEvents').check(period)
                .then(r => typeof r !== 'object' ? ({}) : r)
                .catch(() => ({}));
            for (const evt of Object.keys(events)) {
                if (evt && events[evt] && (events[evt].timestamp && Date.now() - events[evt].timestamp) > period) {
                    delete events[evt];
                }
            }
            return events;
        }

        async prepareResult(command, res) {
            if (['BET', 'EXPRESS_BET', 'FORK_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('pinnacle', settings,
                        `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`,
                        true, false);
                    await bMess('WasSuccessPinnacle').set(Date.now());
                }
                let balance = 0;
                await waitForCondition(() => (balance = getBalance(), balance > 0), 250, 5000)
                    .catch(() => dLog('red', 'pinnacle',
                        `It seems like it is really zero on the balance :(`));
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
                    balance,
                };
                if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'STAKE';
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
    }

    const messageProcessor = message => {
        dLog('green', 'pinnacle', [`messageProcessor (${busy})`, message]);
        if (message.action === 'CHECK_BUSY') {
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
            settings.fork = message.fork;
            settings.forkOnly = typeof message.fork === 'object' && Object.keys(message.fork).length > 0;
            settings.stake_fork = message.stake_fork;
            period = settings.stake_fork?.eventTimeLimit
                && parseInt(settings.stake_fork.eventTimeLimit) * 1000 || 7200000;
            authCheck();
        } else if (busy) {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY"
            });
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
                answer: `${message.action} not supported!`
            });
        }
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('green', 'pinnacle', ['Command was set till unload:', ourCommand.get()]);
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess('pinnacle')
                .set(ourCommand.get(), increaseDelay ? 150000 : 0);
        }
    }, true);

    const afterDOMLoaded = () => {
        bMess('pinnacle',).check(40000, true)
            .then(currentCommand => {
                dLog('orange', 'pinnacle',
                    [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand]);
                messageProcessor(currentCommand);
            })
            .catch(() => dLog('color: darkgray;', 'pinnacle', 'No command!'));
        port.postMessage({m: "PAGE LOADED!"});
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

})();
