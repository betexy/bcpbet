(function () {

    "use strict";

    /**
     * @import libs/jquery-3.3.1.min.js
     */

    let newAPI = false;
    let authClicked = 0;
    let busy = false;
    let increaseDelay = false;
    let stakeExceedSubmit = false;
    let authLimited = false;
    let period = 7200000;
    let betweenBets = 40000;

    const port = window.self === window.top
        ? chrome.runtime.connect({name: `port_betway`})
        : {postMessage: () => console.log(arguments)};

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
        'FOOTBALL': ['Football', 'Fútbol'],
        'HOCKEY': ['Hockey', 'Hockey sobre Hielo'],
        'VOLLEYBALL': ['Volleyball', 'Volleyball'],
        'TENNIS': ['Tennis', 'Tenis'],
        'TABLETENNIS': ['Table Tennis', 'Tenis de mesa'],
        'BASEBALL': ['Baseball', 'Béisbol'],
        'BASKETBALL': ['Basketball', 'Baloncesto'],
        'CYBERSPORT': ['Esports',],
    };

    const ourCommand = new ourCommandProto();
    const smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);

    const getBalance = returnNull => {
        const $b = $('div.accountBalance');
        if ($b.length > 0) {
            return parseFloat($b.text().replace(',', '')
                .replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    }

    const authCheck = function () {
        //dLog('', 'Betway', 'Auth check');
        if (authLimited) {
            return;
        }

        (async () => {

            if ($('div.title:textEquals("Account Locked")').length > 0) {
                authLimited = true;
                port.postMessage({
                    answered: "WITHDRAW_LIMITED",
                    status: "ERROR",
                });
                throw 'Auth is limited!';
            }

            await closeAllWeNeed({
                'div.cookiePolicyAcceptButton': 'div.cookiePolicyAcceptButton',
                'div.messagePrompt:contains("different location")': 'div.messagePromptButton.action',
                'div.acceptDeclineCheckboxContainer': 'div.acceptDeclineCheckboxContainer',
                'div.acceptNewTermsAndConditionsWidget': 'div.okButton',
                //'div.dismissalButton.icon-cross': 'div.dismissalButton.icon-cross',
                'div.messagePromptButton.action': 'div.messagePromptButton.action',
            });
            await delayPromise(5555);
            if ($('input[placeholder="Username"]').length > 0) {
                // Hint: Log In
                port.postMessage({m: "tech works! 2"});
                await delayPromise(333);
                await tryToLogIn().catch(e => bsError(port, 'Error login: ' + e));
            } else {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch(e => dLog('red', 'Betway', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const tryToLogIn = async () => {
        const checkAuth = async (sels) => {
            if ($('input[placeholder="Username"]').val() === '') {
                await clearAndSimulate($(sels[0])[0], settings.login);
                await delayPromise(1222);
            }
            if ($('input[placeholder="Password"]').val() === '') {
                await clearAndSimulate($(sels[1])[0], settings.password);
                await delayPromise(1222);
            }
        }
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        const sels = [
            findSel(['input[placeholder="Username"]']),
            findSel(['input[placeholder="Password"]']),
            !findSel(['input.loginSubmit']) ? findSel(['button.loginSpinner']) : findSel(['input.loginSubmit']),
        ];
        await waitForCondition(() => checkSE(sels), 333, 10000, 'No inputs!');
        await delayPromise(500);
        await clearAndSimulate($(sels[0])[0], settings.login);
        await delayPromise(1222);
        await clearAndSimulate($(sels[1])[0], settings.password);
        await delayPromise(1222);
        await checkAuth(sels);
        authClicked = Date.now();
        await mouseChain({target: $(sels[2])[0], events: fullClick, error: 'Enter'});
        dLog('green', 'Betway', 'Auth clicked!');
        return "auth_clicked";
    };

    const closePreviousCoupons = async skip => {
        if (skip) {
            return 'skipped!';
        }
        // Hint: Click 'Remove all' once or every 'Close'
        let $clearBtn = $('div.betSlipClearButton');
        if ($clearBtn.length === 1) {
            await mouseChain({
                target: $clearBtn[0],
                events: fullClick,
                scroll: true,
                error: 'c0'
            });
            await delayPromise(555);
            return 'ClearBtn clicked!';
        }
        const closes = 'div.removeBetItem';
        while ($(closes).length > 0) {
            await mouseChain({
                target: $(closes).eq(0)[0], events: fullClick, scroll: true, error: 'c1'
            });
            await delayPromise(555);
        }
        return 'All were closed!';
    };

    const checkInplay = async () => {
        if (document.location.href.indexOf('/sports/in-play') === -1) {
            await mouseChain({
                target: $('a.menuItem:textEquals("In-Play")')[0],
                events: fullClick,
                scroll: true,
                error: 'LIVE_HREF'
            });
            await delayPromise(1111);
        }
    };

    const openEvent = async bet => {
        dLog('red', 'Betway', ['openEvent', bet]);
        if (!!bet.direct_link && document.location.href !== bet.direct_link) {
            document.location.href = bet.direct_link;
            await waitForCondition(() => document.location.href === bet.direct_link,
                250, 10000);
            await delayPromise(500);
            const eventHere = $('div.titleWidgetLayout h1').trt().split(' - ');
            bet.team1 = bet.team1 || eventHere[0];
            bet.team2 = bet.team2 || eventHere[1];
        }
        const eventName = `${bet.team1} - ${bet.team2}`.toLowerCase();
        const checkWeAreThere = function () {
            if (!!bet.direct_link && document.location.href === bet.direct_link) {
                return true;
            }
            const checkEvent = $('div.titleWidgetLayout h1').text().trim().toLowerCase();
            //dLog('red', 'Betway', `checkWeAreThere: '${checkEvent}' === '${eventName}'`);
            return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70;
        };
        const switchToSport = async (sport, prematch) => {
            dLog('red', 'Betway', `switchToSport: ${sport} (${prematch})`);
            const accordances = accordance[sport];
            const sportSels = [];
            for (const s of accordances) {
                sportSels.push(prematch
                    ? `a.categoryListItem:has(span.button_text:textEquals("${s}"))`
                    : `a.contentSelectorItem:textStarts("${s}")`)
            }
            const $sport = await waitForElement(sportSels, 333, 15000);
            if ((!prematch && $sport.get(0).getAttribute('selected') !== 'true')
                || (prematch && $sport.attr('class').indexOf('selected') === -1)) {
                await mouseChain({
                    target: $sport.find('div')[0],
                    events: fullClick,
                    error: `switchToSport`,
                    scroll: true
                });
                await delayPromise(1555);
                if (prematch) {
                    const $all = await waitForElement('div.contentSelectorItem[collectionitem="All"]',
                        333, 10000);
                    await mouseChain({
                        target: $all.find('a')[0],
                        events: fullClick, error: '$all'
                    });
                    await delayPromise(3000);
                }
            }
        };
        const checkScore = async () => {
            return true;
        };
        if (checkWeAreThere() && await checkScore()) {
            return 'We probably on event page!'
        }
        await checkInplay();
        await switchToSport(bet.sport, bet.type !== 'LIVE');
        await delayPromise(555);
        let $el = $([]);
        let $eleague = $([]);
        const findLeague = async () => {
            const league = bet.league.split('.');
            const $leagues = await waitForElement('div.eventTableItemCollection > div', 333, 10000);
            await $leagues.eachAsync(async function () {
                const localLeague = ($(this).find('div.titleTextWrapper div.subTitle').trt() + '.' + $(this).find('div.titleTextWrapper div.titleText').trt()).toLowerCase();
                const eventLeague = bet.league.toLowerCase();
                const compare = localLeague === eventLeague
                    || locutus_similar_text(localLeague, eventLeague, true) > 95;
                if (compare) {
                    $eleague = $(this);
                    return false;
                }
            });
        };
        const tryToFindEvent = async ($leagues) => {
            await $leagues.find('a.scoreboardInfoNames').eachAsync(async function () {
                let checkEvent = ($(this).find('div.teamNameHome span.teamNameHomeTextFirstPart').trt() + ' - ' + $(this).find('div.teamNameAway span.teamNameAwayTextFirstPart').trt()).toLowerCase();
                const res = checkEvent === eventName
                    || locutus_similar_text(checkEvent, eventName, true) > 70;
                dLog('color: darkgray;', 'BetwayLive',
                    `"${checkEvent}" ${(res ? '==' : '!=')} "${eventName}"`);
                if (res) {
                    $el = $(this);
                    return false;
                }
            });
        }
        const tryToFind = async (leagues, state) => {
            if (state) {
                if (leagues.find('div.collapsableHeader').attr('collapsed') === 'true') {
                    await mouseChain({target: leagues.find('div.arrow')[0], events: fullClick, error: 'expand', scroll: true});
                    await delayPromise(1555);
                }
                await tryToFindEvent(leagues);
            } else {
                const $leagues = await waitForElement(leagues, 333, 10000);
                await $leagues.eachAsync(async function () {
                    if ($(this).find('div.collapsableHeader').attr('collapsed') === 'true') {
                        await mouseChain({target: $(this).find('div.arrow')[0], events: fullClick, error: 'expand', scroll: true});
                        await delayPromise(1000);
                    } else {
                        this.scrollIntoView();
                    }
                    await tryToFindEvent($(this));

                    if ($el.length > 0) {
                        return false;
                    }
                });
            }
        };
        const tryToFindPrematch = async () => {
            let idx = 0, $league = $([]);
            const curs = 'div.subcategoryList div.collapsableHeader';
            for (let cur of $(curs)) {
                const $cur = () => $(curs).eq(idx);
                const curName = $cur().find('div.titleText').trt();
                // expand country
                if ($cur().attr('collapsed') && $cur().attr('collapsed') === 'true') {
                    await mouseChain({target: $cur()[0], events: fullClick, error: '$cur', scroll: true});
                    await waitForCondition(
                        () => $cur().parent().find('div.listItemContent').length > 0,
                        333, 3000, `Expand ${curName}`);
                    await delayPromise(100);
                }
                // find our league
                for (let l of $cur().parent().find('div.listItemContent')) {
                    if ($(l).trt().indexOf(bet.league) > -1
                        || (curName + '. ' + ($(l).trt())).indexOf(bet.league) > -1) {
                        $league = $(l);
                        break;
                    } else {
                        console.log(`${curName} '${$(l).trt()}' !== '${bet.league}'`);
                    }
                }
                if ($league.lenght > 0) {
                    break;
                }
                idx++;
            }
            if ($league.length === 0) {
                throw `${bet.league} not found!`;
            }
            await mouseChain({target: $league[0], events: fullClick, error: '$league'});
            await delayPromise(3000);
            $('a.scoreboardInfoNames').each(function () {
                let checkEvent = $(this).text().trim().toLowerCase();
                const res = checkEvent === eventName
                    || locutus_similar_text(checkEvent, eventName, true) > 70;
                dLog('color: darkgray;', 'BetwayPrem',
                    `"${checkEvent}" ${(res ? '==' : '!=')} "${eventName}"`);
                if (res) {
                    $el = $(this);
                    return false;
                }
            });
        };
        if (bet.type === 'LIVE') {
            if (bet.league && bet.league.length > 3) {
                await findLeague();
                if ($eleague.length > 0) {
                    await tryToFind($eleague, true);
                }
            }
            if ($el.length === 0) {
                await tryToFind('div.collapsablePanel', false);
            }
        } else {
            await tryToFindPrematch();
        }
        if ($el.length === 1) {
            await mouseChain({
                target: $el[0], events: fullClick, scroll: true, error: 'EVENT'
            });
        } else {
            throw 'Wrong length of Event: ' + $el.length;
        }
        await waitForCondition(() => checkWeAreThere(),
            555, 30000, 'We are not on event!');
        await checkScore();
        return 'Switched to event!';
    };

    const getBetElement = async data => {
        //#-#-START
        const teamsText = $('div.titleWidgetLayout h1').trt();
        const teams = teamsText.split(teamsText.indexOf(' @ ') > -1 ? ' @ ' : ' - ');
        if (teams.length === 2) {
            data.team1 = teams[0];
            data.team2 = teams[1];
        } else {
            throw 'No teams!';
        }

        const markets = {
            'ONE_TWO': {
                'ONE': {
                    tab: 'main-markets',
                    roots: ['Win/Draw/Win'],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    tab: 'main-markets',
                    roots: ['Win/Draw/Win'],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    tab: 'main-markets',
                    roots: ['Win/Draw/Win'],
                    pivotKeys: ['Draw',],
                },
                'ONE_DRAW': {
                    tab: 'main-markets',
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or Draw',],
                },
                'TWO_DRAW': {
                    tab: 'main-markets',
                    roots: ['Double Chance'],
                    pivotKeys: ['Draw or #TEAM2#',],
                },
                'ONE_TWO': {
                    tab: 'main-markets',
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or #TEAM2#',],
                }
            },
            'TOTAL': {
                'OVER': {
                    tab: 'goals',
                    roots: ['Total Goals #PIVOT#', 'Total Goals( #PIVOT# )',],
                    pivotKeys: ['Over'],
                },
                'UNDER': {
                    tab: 'goals',
                    roots: ['Total Goals #PIVOT#', 'Total Goals( #PIVOT# )',],
                    pivotKeys: ['Under'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tab: 'goals',
                    roots: ['Team A Total Goals #PIVOT#',],
                    pivotKeys: ['Over'],
                },
                'UNDER': {
                    tab: 'goals',
                    roots: ['Team A Total Goals #PIVOT#',],
                    pivotKeys: ['Under'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tab: 'goals',
                    roots: ['Team B Total Goals #PIVOT#',],
                    pivotKeys: ['Over'],
                },
                'UNDER': {
                    tab: 'goals',
                    roots: ['Team B Total Goals #PIVOT#',],
                    pivotKeys: ['Under'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    tab: 'corners',
                    roots: ['Full Time Total Corners',],
                    pivotKeys: ['#PIVOT#',],
                    specials: ['Over'],
                },
                'UNDER': {
                    tab: 'corners',
                    roots: ['Full Time Total Corners',],
                    pivotKeys: ['#PIVOT#',],
                    specials: ['Under'],
                },
            },
            'HDP': {
                'HOME': {
                    tab: 'main-markets',
                    roots: ['Goals Handicap', 'Goals Asian Handicap',],
                    pivotKeys: ['(#PIVOTH#)'],
                },
                'AWAY': {
                    tab: 'main-markets',
                    roots: ['Goals Handicap', 'Goals Asian Handicap'],
                    pivotKeys: ['(#PIVOTH#)'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    tab: 'main-markets',
                    roots: ['Handicap 3-Way'],
                    pivotKeys: ['#PIVOTH#',],
                    specials: ['#TEAM1#'],
                },
                'H2': {
                    tab: 'main-markets',
                    roots: ['Handicap 3-Way'],
                    pivotKeys: ['#PIVOTH#',],
                    specials: ['#TEAM2#'],
                },
                'HX': {
                    tab: 'main-markets',
                    roots: ['Handicap 3-Way'],
                    pivotKeys: ['#PIVOTH#',],
                    specials: ['Draw'],
                }
            },
        };

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw `Unsupported ${data.time_value} / ${data.market} / ${data.target}`;
        }

        const params = new AllMarkets(data);

        params.proceed_football = function (bet) {
            if (bet.market.indexOf('T1') === 0 || bet.market.indexOf('T2') === 0) {
                this.addTotal('tab', ['Goals']);
                this.addTo('roots', `#TEAM${bet.market.indexOf('T1') === 0 ? '1' : '2'}# Total`);
            } else if (bet.market === 'HDP' && parseFloat(bet.pivot) === 0) {
                this.addTotal('roots', ['Draw No Bet']);
                this.addTotal('pivotKeys', [`#TEAM${bet.target.indexOf('HOME') > -1 ? '1' : '2'}#`]);
            }
            if (!this.full) {
                this.addTotal('tab', ['half']);
                if (bet.market.indexOf('CORNER') > -1) {
                    this.addTotal('roots', ['1st Half']);
                } else if (['T1_TOTAL', 'T2_TOTAL'].indexOf(bet.market) > -1) {
                    const letter = bet.market.indexOf('T1') > -1 ? 'A' : 'B';
                    this.addTotal('roots', [
                        `1st Half - Team ${letter} - Total Goals #PIVOT#`
                    ]);
                } else {
                    this.addToEl('roots', '1st Half -', true);
                }
            }
        };

        params.proceed_tennis = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addTotal('roots', ['Match Winner']);
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total Games( #PIVOT# )']);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Game Handicap( #BPIVOT# )']);
                this.addTotal('pivotKeys', [`#TEAM${(bet.target === 'HOME' ? '1' : '2')}#`]);
            } else if (bet.market === 'T1_TOTAL') {
                this.addTotal('roots', [
                    '#TEAM1# Total Games ( #PIVOT# )',
                    `#TEAM1# Total Games( #PIVOT# )`
                ]);
            } else if (bet.market === 'T2_TOTAL') {
                this.addTotal('roots', [
                    '#TEAM2# Total Games ( #PIVOT# )',
                    `#TEAM2# Total Games( #PIVOT# )`
                ]);
            }
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    if (bet.time_value.indexOf('SET') > -1 && bet.time_value.indexOf('GAME') > -1) {
                        const parts = bet.time_value.split('_GAME_');
                        this.addTotal('roots', [
                            `Set ${this.tDigit} - Game ${parseInt(parts[1].trim())} Winner`,
                            `Set ${this.tDigit} - Game ${parseInt(parts[1].trim())} Game Winner`,
                        ]);
                    } else {
                        this.addTotal('roots', [
                            `${this.tDigit}${this.th} Set - Winner`,
                            `${this.tDigit}${this.th} Set Winner`,
                        ]);
                    }
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', [`Set ${this.tDigit} - Set Total Games( #PIVOT# )`,]);
                }
            }
        };

        params.proceed_basketball = function (bet) {
            this.addTotal('roots', ['main-markets']);
            if (bet.market === 'HDP') {
                this.addTotal('roots', ['Handicap( #APIVOT# )']);
                this.addTotal('specials', [`#TEAM${(bet.target === 'HOME' ? '1' : '2')}#`]);
                this.addTotal('pivotKeys', ['#PIVOTH#']);
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total Points( #APIVOT# )']);
            } else if (bet.market === 'ONE_TWO') {
                this.addTotal('roots', ['Match Winner']);
            }
            if (!this.full) {
                this.addTotal('tab', [`${this.tDigit}${this.th}-quarter`]);
                this.addToEl('roots', `${this.tDigit}${this.th} Quarter - `, true);
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('roots', ['Win/Draw/Win']);
                }
            }
        };

        params.proceed_hockey = function (bet) {
            if (bet.market === 'HDP' && parseFloat(bet.pivot) === 0) {
                this.addTotal('roots', ['Draw No Bet']);
                this.addTotal('pivotKeys', [`#TEAM${bet.target === 'HOME' ? '1' : '2'}#`]);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Handicap ( #PIVOT# )', 'Puck Line( #PIVOT# )']);
                this.addTotal('pivotKeys', [`#TEAM${(bet.target === 'HOME' ? '1' : '2')}#`]);
            } else if (bet.market === 'EURO_HDP') {
                this.addTotal('roots', ['Puck Line 3 Way( #PIVOT# )',]);
                this.addTotal('pivotKeys', ['#PIVOTH#',]);
            } else if (bet.market === 'T1_TOTAL') {
                this.addTotal('roots', [
                    '#TEAM1# Total Games ( #PIVOT# )',
                    `#TEAM1# Total Games( #PIVOT# )`
                ]);
            } else if (bet.market === 'T2_TOTAL') {
                this.addTotal('roots', [
                    '#TEAM2# Total Games ( #PIVOT# )',
                    `#TEAM2# Total Games( #PIVOT# )`
                ]);
            }
            if (!this.full) {
                this.addTotal('tab', [`${this.tDigit}${this.th}-period`]);
                this.addToEl('roots', `${this.tDigit}${this.th} Period - `, true);
            }
        }

        params.proceed_cybersport = function (bet) {
            if (data.market === 'ONE_TWO' && !this.tDigit) {
                this.addTotal('roots', ['Match Winner']);
            } else if (data.market === 'ONE_TWO' && this.tDigit) {
                this.addTotal('roots', [`Map ${this.tDigit} Winner`]);
            } else if (data.market === 'HDP') {
                this.addTotal('roots', [`Maps Handicap ( #APIVOT# )`]);
            } else if (data.market === 'TOTAL') {
                this.addTotal('roots', [`Maps Total ( #APIVOT# )`]);
            }
            if (this.tDigit) {
                this.addTotal('tab', [`map-${this.tDigit}`]);
            }
        };

        const final = applyAllMarkets(data, ['tab', 'roots', 'pivotKeys', 'specials',],
            params, markets);

        const m = final[data.market][data.target];

        const ePivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };
        const bPivot = pvt => {
            if (parseFloat(pvt) === 0) {
                return pvt;
            }
            if (data.market === 'HOME') {
                return pvt = pvt > 0 ? pvt : `-${pvt}`;
            } else {
                return pvt = pvt > 0 ? `-${pvt}` : Math.abs(parseFloat(pvt));
            }
        };
        const hPivot = pvt => parseFloat(pvt) > 0 ? `+${pvt}` : pvt;
        const aPivot = pvt => Math.abs(parseFloat(pvt));

        replaceInner(m, {
            '#TEAM1#': data.team1,
            '#TEAM2#': data.team2,
            '#PIVOT#': data.pivot,
            '#EPIVOT#': ePivot(data.pivot),
            '#PIVOTH#': hPivot(data.pivot),
            '#APIVOT#': aPivot(data.pivot),
            '#BPIVOT#': bPivot(data.pivot),
        });

        dLog('green', 'Vbet', ['Final market is:', m]);

        const selsTabs = [
            `div[collectionitem="${m.tab}"]`,
        ];

        if (checkSE(selsTabs)) {
            if (($(selsTabs[0]).find('div.contentSelectorItem').length > 0
                    && $(selsTabs[0]).find('div.contentSelectorItem')
                        .get(0).getAttribute('selected') !== 'true')
                || ($(selsTabs[0])[0].hasAttribute('selected')
                    && $(selsTabs[0]).attr('selected') !== 'true'
                )) {
                await mouseChain({
                    target: $(selsTabs[0]).find('div.contentSelectorItemLabel')[0],
                    events: fullClick, error: '$tab'
                });
                await delayPromise(555);
            }
        }

        await waitForElement('div.collapsableHeader', 333, 10000);
        await delayPromise(500);

        /**
         *
         * @param $root
         * @param specialColumn
         * @returns {jQuery<HTMLElement>}
         */
        const $findPivot = ($root, specialColumn) => {
            for (const pvt of m.pivotKeys) {
                if (typeof specialColumn === 'undefined') {
                    let idx = -1;
                    $root.find(`div.outcomeHeader`).each((i, v) => {
                        if ($(v).text().trim() === pvt) {
                            idx = i;
                            return false;
                        }
                    });
                    if (idx > -1) {
                        return $root.find('div.outcomeButton').eq(idx);
                    }
                } else {
                    let idx = -1;
                    $root.find('div.outcomeHeadersCollection div.outcomeHeader')
                        .each((i, v) => {
                            if ($(v).text().trim().toLowerCase() === specialColumn.toLowerCase()) {
                                idx = i;
                                return false;
                            }
                        });
                    if (idx > -1 && $root.find('div.outcomeButton span.handicap').eq(idx)
                        .text().trim().toLowerCase() === pvt.toLowerCase()) {
                        return $root.find('div.outcomeButton').eq(idx);
                    }
                }
            }
            return $([]);
        };

        // $('div[collectionitem="275339759"] div.titleText').trt();

        let $found = $([]);
        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $roots = () =>
                $(findSel([
                    `div.collapsablePanel div.titleText:textEqualsIS("${root}")`,
                    `div.collapsablePanel div.titleText:textStartsI("${root}")`
                ]));
            if ($roots().length === 0) {
                continue;
            }
            await $roots().eachAsync(async function () {
                const $root = $(this);
                if ($root.closest('div.collapsableHeader').length === 0) {
                    return false;
                }
                if ($root.closest('div.collapsableHeader')
                    .get(0).getAttribute('collapsed') === 'true') {
                    await mouseChain({
                        target: $root.closest('div.collapsableHeader').find('div.marketTitleWrapper')[0],
                        events: fullClick, error: 'marketTitleWrapper', scroll: true
                    });
                    await delayPromise(1000);
                }
                if (m.specials) {
                    // Hint: handicaps and corners
                    for (const spec of m.specials) {
                        $found = $findPivot($root.closest('div.collapsableHeader').next(), spec);
                        if ($found.length > 0) {
                            break;
                        }
                    }
                } else {
                    $found = $findPivot($root.closest('div.collapsableHeader').next());
                }
                return $found.length === 0;
            });
            if ($found.length > 0) {
                break;
            }
        }
        if ($found.length === 0) {
            throw `${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot}`
            + ' not found :(';
        } else {
            $found.closest('div.collapsablePanel')[0].scrollIntoView();
            window.scrollBy(0, -200);
        }
        return $found;
        //#-#-FINISH
    };

    const openCoupon = async paramData => {
        dLog('green', 'Betway', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'Betway', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'Betway', 'Event must be opened!');
            let tries = 0, $element = $([]), error = '';
            do {
                $element = await getBetElement(data).catch(e => (error = e, $([])));
                if ($element.length === 0) {
                    tries++;
                    await delayPromise(777);
                }
            } while ($element.length === 0 && tries < 25);
            if ($element.length === 0) {
                throw error;
            }
            console.log($element);
            let coefWeWaitFor = $element.find('div.odds').text().trim();
            dLog('green', 'Betway', 'We got element! Coef: ' + coefWeWaitFor);
            const waitForCouponVisibleStarted = Date.now();
            let elementWasClicked = 0;
            let performElementClick = async function () {
                dLog('green', 'Betway', 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                    + ') /' + (Date.now() - elementWasClicked));
                await mouseChain({target: $element[0], events: fullClick, error: 'performElementClick'})
                elementWasClicked = Date.now();
            };
            const checkCoupon = () => {
                let event = `${data.team1} - ${data.team2}`.toLowerCase();
                let result = false;
                $('div[class="betSlipSelection"]').each(function () {
                    let evDraft = $(this).find('label.collapsibleSubTitle').text().trim();
                    let ev = evDraft.substr(0, evDraft.indexOf(',')).trim().toLowerCase();
                    if (event === ev || locutus_similar_text(event, ev, true) > 70) {
                        result = true;
                        return false;
                    } else {
                        dLog('red', 'Betway', `'${ev}' !== '${event}'`);
                    }
                });
                return result;
            };
            while (!checkCoupon() && Date.now() - waitForCouponVisibleStarted < 15000) {
                await performElementClick();
                await delayPromise(777);
            }
            if (!checkCoupon()) {
                throw `Coupon not opened!`;
            }
            const getMaxHere = async () => {
                return 100500100;
            };
            if (paramData.length > 1) {
                dLog('red', 'Betway', `Express here! ${i}/${(paramData.length - 1)}`);
                if (i === paramData.length - 1) {
                    return await getMaxHere(true);
                }
            } else {
                return await getMaxHere(false);
            }
        }
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => {
            const localMatch = `${v.team1} - ${v.team2}`.toLowerCase();
            return localMatch === match || locutus_similar_text(localMatch, match, true) > 70;
        });
        const $coupons = $('div[class="betSlipSelection"]');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            let evDraft = $this.find('label.collapsibleSubTitle').text().trim();
            const match = evDraft.substr(0, evDraft.indexOf(',')).trim().toLowerCase();
            console.log(match);
            if ($this.hasClass('market-unavailable')) {
                errors.push(match + ' LOW_COEF, market unavailable!');
                checked++;
                return true;
            }
            let localCoef = parseFloat($this.find('span.odds').text().trim());
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

    /*
    // Test:
    await checkCoefs([
        {team1: 'Серро Портеньо', team2: 'Олимпия А', coef: '2.1'},
        {team1: 'Оклахома Энерджи', team2: 'Остин Болд', coef: '2.1'},
    ]);
     */

    const depositCashier = async data => {
        const renewCommand = async inc => await bMess('BETWAY_CASHIER_COMMAND', true)
            .set(ourCommand.get(), inc ? 120000 : 0);
        dLog('orange', 'DC', ['depositCashier:', data]);
        if (ourCommand.getAdded('PsOpened')) {
            dLog('orange', 'DC', `Wait for deposit result`);
            return await bMess('DEPOSIT_RESULT', true).get(200000, 60000)
                .catch(() => ({success: false, message: 'No result for 200s :('}));
        } else {
            const $db = await waitForElement('a:textEquals("Deposit")', 333, 15000);
            if (!$db.hasClass('selected')) {
                await mouseChain({target: $db[0], events: fullClick, error: '$db'});
                await delayPromise(3000);
            }
            const $ps = await waitForElement(`a.method-selector-display:textEqualsIS("${data.paysystem}")`,
                333, 15000);
            await delayPromise(1000);
            await mouseChain({target: $ps[0], events: fullClick, error: '$ps'});
            await delayPromise(5000);
            const $a = await waitForElement('a.method-selector-display:first', 333, 15000);
            await mouseChain({target: $a[0], events: fullClick, error: '$a'});
            await delayPromise(5000);
            const $oa = await waitForElement('input.own-amount', 333, 15000);
            await delayPromise(1000);
            await mouseChain({target: $oa[0], events: fullClick, error: '$oa'});
            await clearAndInputNumber($oa[0], data.amount);
            await delayPromise(3000);
            ourCommand.add('PsOpened', true);
            await bMess(`${data.paysystem}_COMMAND`, true).set(ourCommand.get());
            await mouseChain({target: $('a:textEquals("Deposit")')[0], events: fullClick, error: 'd'});
        }
    };

    const deposit = async data => {
        if (ourCommand.getAdded('BankOpened')) {
            dLog('orange', 'Betway', `Wait for deposit result`);
            return await bMess('DEPOSIT_RESULT', true).get(200000, 60000)
                .catch(() => ({success: false, message: 'No result for 200s :('}));
        } else if (!ourCommand.getAdded('BankOpened')) {
            increaseDelay = true;
            const $bank = await waitForElement('div.bankingButton', 333, 15000);
            await bMess('BETWAY_CASHIER_COMMAND', true).set(ourCommand.get());
            await delayPromise(2000);
            await mouseChain({target: $bank[0], events: fullClick, error: '$bank'});
            ourCommand.add('BankOpened', true);
            await delayPromise(5000);
        } else {
            throw `Bad situation till DEPOSIT: ${ourCommand.getAdded('PsOpened')}/`
            + `${ourCommand.getAdded('BankOpened')} at ${document.location.href}`;
        }
        return await deposit(data);
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
            const code = await smsApiMessage.waitForSMSCode(["CUPIS"],
                (m) => {
                    dLog('orange', 'Betway', `sms: '${m}'`);
                    return m.indexOf('Kod:') > -1;
                },
                m => m.replace(/[^\d]/g, ''), 150000);
            await clearAndInputNumber($code[0], parseInt(code));
            await delayPromise(500);
            await mouseChain({target: $out()[0], events: fullClick, error: 'submit'});
            delayPromise(2000)
                .then(() => mouseChain({
                    target: $('li.menu__item a[href="/sport"]')[0],
                    events: fullClick,
                    error: ''
                }));
            return {
                success: res.success,
                message: res.message || 'No message :(',
                wallet_balance: res.balance || ''
            };
        } else {
            await bsBindNumber(port, settings, smsApiMessage, ourCommand);
            await goToLobby();
            await delayPromise(1000000);
        }
    };

    const proceedBet = async (data, command, balance, testing) => {
        const wasSuccessBetway = await bMess('WasSuccessBetway').check(betweenBets, true)
            .catch(() => 0);
        if (Date.now() - wasSuccessBetway < betweenBets) {
            throw `To early after previous success bet ${Date.now() - wasSuccessBetway}!`
        }
        if (command === 'BET' && !!currentBetData.data[0].betFromParser) {
            const eventName = `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`;
            if (!await eventsWork('betway', settings, eventName, false, false)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            }
        }
        if (!!testing) {
            dLog('blue', 'Betway', `We'll sleep 10s because of testing!`);
            await delayPromise(10000);
            return {
                success: true,
                message: `It was test!`,
            }
        }
        const checkSuccess = async () => {
            const started = Date.now();
            while (Date.now() - started < 30000) {
                const alertText = $('div.notificationMessage').text().trim();
                const acceptedText = $('div.betsSuccessItemText').text().trim();
                if (alertText.indexOf('Accept all odds and line changes') > -1) {
                    return false;
                } else if (alertText.indexOf('Your stake exceeds the maximum bet amount allowed. Please see the populated stake box for the amount you are able to place.') > -1) {
                    stakeExceedSubmit = true;
                    return false;
                } else if (alertText !== '') {
                    throw `Error: ${alertText}`;
                } else if (acceptedText.indexOf('Placed Successfully') > -1) {
                    return true;
                }
                await delayPromise(400);
            }
            throw `No bet result in ${(Date.now() - started)}`;
        };
        const checkBalance = willPlace => {
            if (getBalance() < willPlace) {
                throw `NO_FUNDS - now: ${getBalance()}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };
        await closePreviousCoupons(false);
        currentBetData.max = await openCoupon(data);
        do {
            // Hint: Try to perform bet
            await checkCoefs(data);
            const $placeBtn = $('button.totalStakeButton');
            if ($placeBtn.hasClass('acceptChanges')) {
                await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: 'accept'});
                await delayPromise(500);
            }
            if (!stakeExceedSubmit) {
                let willPlace = parseFloat(data[0].stake);
                if (currentBetData.max !== -1 && willPlace > currentBetData.max) {
                    willPlace = currentBetData.max;
                }
                checkBalance(willPlace);
                const place = willPlace.toString().replace('.00', '').trim();
                dLog('green', 'Betway', `Will place (performBet): ${place}, balance: ${getBalance()}`);
                const $input = () => $('input.stakeInput:last');
                if ($input().length !== 1) {
                    throw `2 Wrong number of bet's inputs: ${$input.length}`;
                }
                if ($input().val() !== place) {
                    $input()[0].focus();
                    $input().val(place);
                    fireInputEvent($input()[0]);
                    fireChangeEvent($input()[0]);
                    $input()[0].blur();
                    await delayPromise(800);
                    dLog('green', 'Betway', `STAKE entered ${place}`);
                    let entered = parseFloat($input().val());
                    dLog('green', 'Betway',
                        `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
                    if (isNaN(entered) || willPlace !== entered) {
                        dLog('red', 'Betway', 'Entered !== willPlace - try to reenter!');
                        continue;
                    }
                    await delayPromise(300);
                }
            } else {
                stakeExceedSubmit = false;
            }
            if ($placeBtn.length === 0 || $placeBtn.attr('disabled')) {
                throw 'No place button or button disabled!';
            }
            await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
        } while (!await checkSuccess());
        // Hint: collect result
        const coefDraft = $('span.titleTextInfo').text();
        const res = {
            external_id: $('div.betReceiptId').text().trim(),
            coef: coefDraft.substr(coefDraft.indexOf('@') + 1).trim(),
            stake: $('div.stake').text().replace(/[^\d.]/g, '').trim(),
            max: currentBetData.max,
        };
        await mouseChain({
            target: $('div.clearReceiptButtonContainer')[0],
            events: fullClick, error: 'clear'
        });
        return {success: true, message: res,};
    };

    const collectBetResults = async (inD, command, balance, inplay) => {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inplay ? 1 : inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        dLog('green', 'Betway',
            [`collectBetResults, limit: ${limit}, inplay: ${inplay}, data: `, data]);
        await checkInplay();
        const $myBets = () => $('div[collectionitem="BetHistory"]');
        await waitForCondition(() => $myBets().length > 0,
            333, 15000, 'No MyBets!');
        if ($myBets().get(0).getAttribute('selected') !== 'true') {
            await mouseChain({
                target: $myBets().find('div')[0],
                events: fullClick, error: '$myBets()'
            });
            await delayPromise(3000);
        }
        let checked = 0;
        for (const c of ["1", "3"]) {
            const $c = () => $(`div[collectionitem="sidebarContent"] div[collectionitem="${c}"]`);
            if ($c().get(0).getAttribute('selected') !== 'true') {
                await mouseChain({target: $c().find('div')[0], events: fullClick, error: '$c()'});
                await delayPromise(3000);
            }
            const $bets = await waitForElement('div.betHistoryItem', 333, 10000)
                .catch(() => $([]));
            $bets.each(function () {
                checked++;
                if (checked > limit) {
                    return false;
                }
                const $this = $(this);
                const external_id = $this.find('div.betReceiptId').text().trim();
                if (data.length === 0 || data.indexOf(external_id) > -1) {
                    const $status = $this.find('div.winStatus');
                    const market = $this.find('span.titleTextInfo').text().trim();
                    collected.push({
                        external_id,
                        status: c === '1' ? 'ACCEPTED' : $status.hasClass('lost') ? 'LOSE' :
                            $status.hasClass('won') ? 'WON' : 'REFUNDED',
                        match: $this.find('div.eventName').text().trim(),
                        bkPivot: $this.find('div.marketInfo').text().trim() + ' '
                            + market.substr(0, market.indexOf('@') - 1).trim(),
                        coef: market.substr(market.indexOf('@') + 1).trim(),
                        stake: $this.find('div.stake').text().replace(/[^\d.]/g, '').trim(),
                        result: c === '1' ? ''
                            : $this.find('span.possibleReturnAmount').text()
                                .replace(/[^\d.]/g, '').trim(),
                    });
                }
            });
        }
        dLog('green', 'Betway', ['Collected', collected]);
        await mouseChain({target: $myBets().find('div')[0], events: fullClick, error: '$myBets(2)'});
        return {success: true, message: collected};
    };

    const cashierCommands = new class CashierCommands {
        constructor() {
            this.cLinks = {
                'DEPOSIT': depositCashier,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data, balance) {
            currentBetData.init(data);
            dLog('green', 'Betway', [command, data]);
            const res = await this.cLinks[command](data, balance)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'Betway', `${command} sports result: ${res.message}`);
            await bMess('DafabetCashierResult').set(res);
            return res;
        }
    };

    const cashierProcessor = command => {
        dLog('green', 'Betway', `CashierProcessor: ${command.action}`);
        if (cashierCommands.exists(command.action)) {
            // Hint: execute command
            ourCommand.set(command);
            cashierCommands.execute(command.action, command.data, command.balance)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'Betway', ['Unknown Cashier command:', command]);
        }
    };

    const executeCashierCommand = async (data, command, balance) => {
        dLog('green', 'Betway', `executeCashierCommand: ${command}, ${balance}`);
        await bMess('DafabetCashierCommand').set({action: command, data, balance});
        await mouseChain({target: $('li.cashier-tooltip a:visible')[0], events: fullClick, error: 'co'});
        if (command === 'DEPOSIT') {
            dLog('orange', 'DC', `Wait for deposit result 2-way`);
            let resType = '';
            await waitForCondition(async () => {
                const dr = await bMess('DEPOSIT_RESULT', true).check(30000)
                    .catch(() => false);
                if (dr !== false) {
                    resType = 'dr';
                    return true;
                }
                const dcr = await bMess('DafabetCashierResult').check(30000)
                    .catch(() => false);
                if (dcr !== false) {
                    resType = 'dcr';
                    return true;
                }
            }, 333, 200000, 'No dc nor dcr results :(');
            if (resType === 'dcr') {
                return await bMess('DafabetCashierResult').check(30000, true);
            } else {
                return await bMess('DEPOSIT_RESULT', true).check(30000, true);
            }
        } else {
            return await bMess('DafabetCashierResult').get(120000, 10000, 300, true);
        }
    };

    const commands = new class commands {
        constructor() {
            this.testing = false;
            this.cLinks = {
                'BET': proceedBet,
                'EXPRESS_BET': proceedBet,
                'BET_RESULT': collectBetResults,
                'DEPOSIT': deposit,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data) {
            currentBetData.init(data);
            if (this.testing) {
                dLog('orange', 'Betway', [`execute, settings:`, settings]);
                currentBetData.data[0].betFromParser = true;
            }
            const res = await this.cLinks[command](data, command, getBalance(), this.testing).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'Betway', `${command} result: ${res.message}`);
            this.prepareResult(command, res)
                .then(r => port.postMessage(r));
            if (command === 'WITHDRAW' && parseInt(data.pin) !== 1) {
                bsSendSmsApi(port, 'BIND_RELEASE', {
                    "websocket_uid": settings.uid,
                    "request_id": ourCommand.getAdded('sms_api_request_id')
                });
            }
            if (!res) {
                throw error;
            }
            return res;
        }

        async getEvents() {
            const events = await bMess('betwayEvents').check(period)
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
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('betway', settings,
                        `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`,
                        true, false);
                    await bMess('WasSuccessBetway').set(Date.now());
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
                if (!!currentBetData.data[0].betFromParser) {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'BETWAY';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = 'VTS';
                    resultData.externalId = resultData.external_id;
                    resultData.currency = 'USD';
                    resultData.sport = currentBetData.data[0].sport;
                    resultData.timeValue = currentBetData.data[0].time_value;
                    resultData.league = currentBetData.data[0].league;
                    resultData.homeTeam = currentBetData.data[0].team1;
                    resultData.awayTeam = currentBetData.data[0].team2;
                    resultData.score = currentBetData.data[0].score;
                    resultData.pivot = resultData.pivot || null;
                }
                return {
                    answered: !!currentBetData.data[0].betFromParser ? "F_BET" : "BET",
                    data: resultData,
                    answer: res.success ? 'Everything is Okay!' : (resultData.status === 'LIMITED' ? 'Tried to bet 0' : res.message),
                    doNotSend: !!currentBetData.data[0].betFromParser && !res.success,
                };
            } else if (command === 'BET_RESULT') {
                return {
                    answered: "BET_RESULT",
                    status: res.success ? "success" : "error",
                    answer: res.message
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
    }

    const messageProcessor = message => {
        dLog('green', 'Betway', [`messageProcessor (${busy})`, message]);
        newAPI = !!message.newAPI;
        if (message.action === 'CHECK_BUSY') {
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
            settings.stake_fork = message.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
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

    if (window.self === window.top && document.location.href.indexOf('cashier') === -1) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message);
        });
    }

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('green', 'Betway', ['Command was set till unload:', ourCommand.get()]);
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess(document.location.href.indexOf('valueactive.eu') > -1
                ? 'BETWAY_CASHIER_COMMAND' : 'BETWAY_COMMAND', true)
                .set(ourCommand.get(), increaseDelay ? 150000 : 0);
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});
        if (window.self === window.top) {
            // Hint: main window (outer with auth, menu, balance, etc.)
            bMess('BETWAY_COMMAND', true).check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'Betway',
                        [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                            currentCommand]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'Betway', 'No command!'));
        } else if (document.location.href.indexOf('valueactive.eu') > -1) {
            bMess('BETWAY_CASHIER_COMMAND', true).check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'CASHIER',
                        [`CASHIER at ${(window.self === window.top)}/${document.location.href} with:`,
                            currentCommand]);
                    cashierProcessor(currentCommand);
                })
                .catch(() => dLog('red', 'CASHIER', 'No command!'));
        }
    }

})();
