(function () {

    "use strict";

    if (window.top !== window.self) {
        return;
    }

    let busy = false;
    let increaseDelay = false;
    let authClicked = 0;
    let enterError = false;
    let eventsPeriod = 7200000;
    let ourCurrency = 'USDT';
    const port = chrome.runtime.connect({name: 'port_trustdice'});

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
        const $lt = await waitForElement('#mainFooter div.MuiSelect-select[role="button"]',
            222, 7777).catch(() => $([]));
        if ($lt.trt() !== 'English') {
            await mouseChain({target: $lt[0], events: fullClick,
                error: `$lt ${document.location.href}`, scroll: true});
            await delayPromise(222);
            const $e = await waitForElement('#menu- li[data-value="en"]',
                222, 3333, true);
            await delayPromise(100);
            await mouseChain({target: $e[0], events: fullClick, error: '$e', scroll: true});
        }
    };

    const authCheck = () => {
        if (enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            dLog('red', 'trustdice', 'ERROR AUTH!');
            return;
        }
        (async () => {
            await checkLanguage();
            const $chatRoomSvgs = $(findSel(['h6:contains("Chatroom")', 'h6:has(g)']))
                .parent().find('svg');
            if ($chatRoomSvgs.length === 2) {
                await mouseChain({
                    target: $chatRoomSvgs.last().closest('button')[0], events: fullClick,
                    error: '$chatRoomSvgs[]', scroll: true
                });
            }
            const $loginEl = await waitForElement('button:textEquals("Login")', 250, 4444)
                .catch(() => $([]));
            if ($loginEl.length > 0) {
                // Hint: Log In
                port.postMessage({m: "tech works! 2"});
                await delayPromise(1000);
                await tryToLogIn().catch(e => bsError(port, 'Error login: ' + e));
            } else {
                if (!await checkCurrency()) {
                    await switchCurrency();
                }
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch(e => dLog('red', 'trustdice', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const checkCurrency = async () => {
        return await waitForCondition(() => $('header input[type="hidden"]').val() === 'USDT',
            333, 3333).catch(() => false);
    };

    const switchCurrency = async () => {
        const $currencyBtn = await waitForElement('header input[type="hidden"]', 250, 10000);
        await mouseChain({
            target: $currencyBtn[0], events:
            fullClick, error: '$currencyBtn'
        });
        await delayPromise(300);
        const $ourCurrency = await waitForElement(`li[data-value="${ourCurrency}"]`, 250, 10000);
        await mouseChain({
            target: $ourCurrency[0], events:
            fullClick, error: '$ourCurrency'
        });
        await delayPromise(300);
    };

    const tryToLogIn = async () => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        const els = {
            user: 'input[name="username"]',
            password: 'input[name="password"]',
            login: 'button[type="submit"]:textEquals("Login")',
        };
        if ($('form p:textEquals("Login")').length === 0) {
            await mouseChain({
                target: $('button:textEquals("Login")')[0], events: fullClick,
                error: 'tli1'
            });
        }
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

        const errorMessage = await waitForCondition(() => $('form p.MuiFormHelperText-root').trt() === '', 333, 10000).catch(() => error = 'log failed');
        if (errorMessage === 'log failed') {
            let errors = [];
            $('form p.MuiFormHelperText-root').each((idx, el) => errors.push($(el).trt()));
            dLog('red', 'trustdice', `Login error(s): ${errors.join(',')}`);
            enterError = true;
        }

        authClicked = Date.now();
        dLog('', 'trustdice', 'Auth clicked!');
        return "auth_clicked";
    };

    const getBalance = returnNull => {
        const $b = $('header input[type="hidden"]').prev().find('span');
        if ($b.length > 0) {
            return parseFloat($b.trt());
        } else {
            return returnNull ? 'null' : 0;
        }
    };

    const checkBalance = willPlace => {
        const balance = getBalance();
        if (balance < willPlace) {
            throw `NO_FUNDS CB - now: ${balance}, we need: ${willPlace} at ${document.location.href}`;
        } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
            throw 'Undefined or NaN will place';
        }
    };

    const goToLive = async soon => {
        const links = {};
        if (soon) {
            links.one = 'a[href="/sports/upcoming"]';
            links.two = 'sports/upcoming';
            // it is not mistake!
            links.three = 'sports/upcoming';
        } else {
            links.one = 'a[href="/sports/live"]';
            links.two = 'sports/home/live';
            links.three = 'sports/live';
        }
        const $sl = () => $(links.one);
        if (document.location.href.indexOf(links.two) === -1
            && document.location.href.indexOf(links.three) === -1) {
            if ($sl().length > 0) {
                await mouseChain({target: $sl()[0], events: fullClick, error: '$sl'});
            } else {
                await mouseChain({
                    target: $('a[data-test="header-sports-link"]')[0], events:
                    fullClick, error: 'header-sports-link'
                });
                const $s = await waitForCondition(() => $sl().length > 0, 250, 5000,
                    'no $sl!');
                await delayPromise(250);
                await mouseChain({target: $sl()[0], events: fullClick, error: '$sl'});
            }
            await waitForElement(`div[data-test="sport-menu-list"] a`, 250, 10000, true);
        }
    };

    const checkEvent = (event, eventHere, from) => {
        const res = eventHere === event ||
            locutus_similar_text(eventHere, event, true) > 75;
        console.log(`check !${from}! '${event}' ${res ? '===' : '!=='} '${eventHere}'`);
        return res;
    };

    const findEvent = async (bet, event) => {
        dLog('', 'TRUSTDICE', `findEvent: ${bet.league} => ${event}`);
        let $evt = $([]);
        const
            leagueTransformed = bet.league.split('.').map(el => el.trim()).join(' / '),
            $leagues = () => $('#mainBG div.MuiBox-root div.MuiExpansionPanel-root');
        await waitForCondition(() => $leagues().length > 0,
            250, 5000, 'no leagues');
        await delayPromise(150);
        await waitForCondition(() => $leagues().trt().length >= $leagues().length * 15,
            222, 15000, 'no leagues texts!');
        await $leagues().eachAsync(async function () {
            const league = $(this).find('div.MuiExpansionPanelSummary-content div').trt();
            if (checkEvent(leagueTransformed, league, 'eachAsync => LEAGUE')) {
                const $leagueLink = $(this).find('div.MuiExpansionPanelSummary-content');
                if (!$leagueLink.hasClass('Mui-expanded')) {
                    await mouseChain({target: $leagueLink[0], events: fullClick, error: '$leagueLink'});
                    await delayPromise(1888);
                }
                const $events = () => $(this).find('div.MuiExpansionPanelDetails-root > div');
                await waitForCondition(() => $events().trt().length >= $events().length * 15,
                    222, 15000, 'no events!');
                $events().each(function () {
                    const eventHere = $(this).find('a').eq(0).trt() + ' - ' + $(this).find('a').eq(1).trt();
                    if (checkEvent(event, eventHere, 'eachAsync => EVENT')) {
                        $evt = $(this).find('a').eq(0);
                        return false;
                    }
                });
            }
            if ($evt.length > 0) {
                return false;
            }
        });
        if ($evt.length === 0) {
            return false;
        } else {
            await mouseChain({target: $evt[0], events: fullClick, error: 'findEvent'});
        }
        return true;
    };

    const switchToSport = async (sportBet) => {
        if (sportBet === 'CYBERSPORT') {
            dLog('', 'TRUSTDICE', `switchToCyberSport: ${sportBet}`);
            const $eSportButton = await waitForElement(() =>
                    $('span.MuiTab-wrapper:textEquals("Esports")').parent(),
                100, 5000, false, 1, 'no $eSportButton');
            if ($eSportButton.hasClass('Mui-selected') === false) {
                await mouseChain({target: $eSportButton[0], events: fullClick, error: 'switchToCyberSport'});
            }
            return;
        }
        const accordance = {
            'FOOTBALL': 'soccer',
            'TENNIS': 'tennis',
            'BASKETBALL': 'basketball',
            'BASEBALL': 'baseball',
            'HOCKEY': 'ice-hockey',
            'HANDBALL': 'handball',
        };
        const sport = accordance[sportBet];
        dLog('', 'TRUSTDICE', `switchToSport: ${sportBet}/${sport}`);
        if (!sport) {
            throw `Unknown sport ${sportBet}!`;
        }
        const $sportButton = await waitForElement(() =>
                $('span.MuiTab-wrapper:textEquals("Sports")').parent(),
            100, 5000, false, 1, 'no $sportButton');
        if ($sportButton.hasClass('Mui-selected') === false) {
            await mouseChain({target: $sportButton[0], events: fullClick, error: 'switchToSport'});
        }
        const $sportLink = await waitForElement(`a.MuiListItem-button[href="/sports/${sport}/live"]`,
            250, 5000);
        if (!$sportLink.hasClass('Mui-selected')) {
            await mouseChain({target: $sportLink[0], events: fullClick, error: 'switchSport'});
            await delayPromise(1222);
            dLog(``, 'trustdice', `Switched to '${sport}'`);
        } else if ($('nav li').length > 3) {
            dLog(``, 'trustdice', `Going main'`);
            await mouseChain({
                target: $('header button:textEquals("Sports")')[0],
                events: fullClick, error: 'header Sports',
            });
            await delayPromise(100);
            return await switchToSport(sportBet);
        }
    };

    const openEvent = async bet => {
        dLog('', 'trustdice', [`openEvent:`, bet,]);
        const event = `${bet.team1} - ${bet.team2}`.toLowerCase();
        const checkWeAreHere = () => {
            const $teams = $('#mainBG div.MuiPaper-rounded:first > div').children();
            const eventHere = `${$teams.eq(0).trt()} - ${$teams.eq(2).trt()}`.toLowerCase();
            return checkEvent(event, eventHere, 'checkWeAreHere');
        };
        if (checkWeAreHere()) {
            return;
        }
        await switchToSport(bet.sport);
        if (!(await findEvent(bet, event))) {
            throw `Event not found!`;
        }
        await waitForCondition(checkWeAreHere, 250, 10000);
    };

    const openCoupon = async data => {
        for (const bet of data) {
            await openEvent(bet);
            const $el = await getBetElement(bet);
            dLog('green', 'trustdice',
                `We got bet: ${$el.next().trt()}`);
            await mouseChain({target: $el[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(500);
        }
        // select accept any odds
        /*
        const rightMenu = 'div.MuiDrawer-paperAnchorRight div.MuiTabs-root:eq(1)';
        if ($(rightMenu).next().find('div.MuiSelect-selectMenu:textEquals("Accept Any Odds")').length === 0) {
            await mouseChain({
                target: $(rightMenu).next().find('div.MuiSelect-selectMenu')[0],
                events: fullClick,
                error: 'odds select'
            });
            await delayPromise(1222);
            await mouseChain({
                target: $('ul.MuiMenu-list li[data-value="2"]')[0],
                events: fullClick,
                error: 'select any odds'
            });
            await delayPromise(777);
        }
         */
        const
            $single = $('button.MuiTab-root:textEquals("Single")'),
            $multi = $('button.MuiTab-root:textEquals("Multi")');
        if (data.length === 1 && !$single.hasClass('Mui-selected')) {
            await mouseChain({target: $single[0], events: fullClick, error: '$single'});
            await delayPromise(500);
        } else if (data.length > 1 && !$multi.hasClass('Mui-selected')) {
            await mouseChain({target: $multi[0], events: fullClick, error: '$multi'});
            await delayPromise(500);
        }
    };

    const getBetElement = async bet => {
        let tries = 1;
        //#-#-START
        if (bet.sport !== 'CYBERSPORT') {
            const $teams = $('#mainBG div.MuiPaper-rounded:first > div').children();
            bet.team1 = $teams.eq(0).trt();
            bet.team2 = $teams.eq(2).trt();
        } else {
            if (bet.time_value.indexOf('FULL') === -1) {
                const map = bet.time_value.replace(/[^\d]/g, '').trim();
                await mouseChain({
                    target: $(`span.MuiTab-wrapper:textEquals("Map${map}")`).parent()[0],
                    events: fullClick,
                    error: 'map'
                });
                await delayPromise(1222);
            }
        }

        const markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Winner', '1x2',],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    roots: ['Winner', '1x2',],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    roots: ['Winner', '1x2',],
                    pivotKeys: ['draw',],
                },
                'ONE_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or Draw',],
                },
                'TWO_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['Draw or #TEAM2#',],
                },
                'ONE_TWO': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or #TEAM2#',],
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['Total',],
                    pivotKeys: ['over #PIVOT#'],
                },
                'UNDER': {
                    roots: ['Total',],
                    pivotKeys: ['under #PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['#TEAM1# total',],
                    pivotKeys: ['over #PIVOT#'],
                },
                'UNDER': {
                    roots: ['#TEAM1# total',],
                    pivotKeys: ['under #PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['#TEAM2# total',],
                    pivotKeys: ['over #PIVOT#'],
                },
                'UNDER': {
                    roots: ['#TEAM2# total',],
                    pivotKeys: ['under #PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    roots: ['Handicap'],
                    pivotKeys: ['#TEAM1# (#PIVOT#)', '#TEAM1# (#HPIVOT#)',],
                },
                'AWAY': {
                    roots: ['Handicap'],
                    pivotKeys: ['#TEAM2# (#PIVOT#)', '#TEAM2# (#HPIVOT#)',],
                }
            },
        };

        if (typeof markets[bet.market] === 'undefined' || typeof markets[bet.market][bet.target] === 'undefined') {
            throw `Unsupported ${bet.time_value} / ${bet.market} / ${bet.target}`;
        }

        const params = new AllMarkets(bet);

        params.proceed_football = function (bet) {
            if (bet.market === 'HDP' && parseFloat(bet.pivot) === 0) {
                this.addTotal('roots', ['Draw no bet']);
                this.addTotal('pivotKeys', [bet.target === 'HOME' ? '#TEAM1#' : '#TEAM2#']);
            } else if (bet.market.indexOf('T1') === 0 || bet.market.indexOf('T2') === 0) {
                this.addTotal('tab', ['Goals']);
                this.addTotal('roots',
                    [`#TEAM${bet.market.indexOf('T1') === 0 ? '1' : '2'}# Total`]);
            }
            if (!this.full) {
                this.addToEl('roots', '1st Half -', true);
            }
        };

        params.proceed_hockey = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('roots', [`${this.tDigit}${this.th} period - 1x2`]);
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', [`${this.tDigit}${this.th} period - total`]);
                } else if (bet.market === 'T1_TOTAL') {
                    this.addTotal('roots', [`${this.tDigit}${this.th} period - #TEAM1# total`]);
                } else if (bet.market === 'T2_TOTAL') {
                    this.addTotal('roots', [`${this.tDigit}${this.th} period - #TEAM1# total`]);
                } else if (bet.market === 'HDP') {
                    this.addTotal('roots', [`${this.tDigit}${this.th} period - handicap`]);
                }
            }
        };

        params.proceed_tennis = function (bet) {
            if (bet.market === 'ONE_TWO') {
                if (bet.time_value.indexOf('SET') > -1 && bet.time_value.indexOf('GAME') > -1) {
                    const parts = bet.time_value.split('_GAME_');
                    this.addTotal('roots',
                        [`${this.tDigit}${this.th} set game ${parseInt(parts[1].trim())} - winner`]);
                }
            } else if (bet.market.indexOf('TOTAL') > -1) {
                this.addToEl('roots', `Games`);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Game Handicap']);
            }
            if (!this.full && bet.time_value.indexOf('GAME') === -1) {
                this.addTotal('tab', ['Sets']);
                this.addToEl('roots', `${this.tDigit}${this.th} Set -`, true);
            }
        };

        params.proceed_basketball = function (bet) {
            if (this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('roots', ['Winner (incl. overtime)']);
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', ['Total (incl. overtime)']);
                } else if (bet.market.indexOf('T1_') > -1 || bet.market.indexOf('2') > -1) {
                    const d = bet.market.replace(/\D/g, '');
                    this.addTotal('roots', [`#TEAM${d}# total (Incl. Overtime)`]);
                } else if (bet.market === 'HDP' && parseFloat(bet.pivot) === 0) {
                    this.addTotal('roots', ['Draw no bet']);
                    this.addTotal('pivotKeys', [bet.target === 'HOME' ? '#TEAM1#' : '#TEAM2#']);
                } else if (bet.market === 'HDP') {
                    this.addTotal('roots', ['Handicap (incl. overtime)']);
                }
            } else if (!this.full && ['HALF', 'TIME'].some(c => bet.time_value.indexOf(c) > -1)) {
                this.addToEl('roots', `${this.tDigit}${this.th} half -`, true);
            } else {
                this.addToEl('roots', `${this.tDigit}${this.th} quarter -`, true);
            }
        };

        params.proceed_handball = function (bet) {
            if (!this.full && ['HALF', 'TIME'].some(c => bet.time_value.indexOf(c) > -1)) {
                this.addToEl('roots', '1st half - ', true);
            }
        };

        params.proceed_cybersport = function (bet) {
            if (this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('roots', ['Match winner - twoway']);
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', ['Number of maps #PIVOT#']);
                } else if (bet.market === 'HDP') {
                    this.addTotal('roots', ['Match handicap #HPIVOT#']);
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('roots', [`Map ${this.tDigit} winner - twoway`]);
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', [`Number of rounds #PIVOT# - map ${this.tDigit}`]);
                } else if (bet.market === 'HDP') {
                    this.addTotal('roots', [`Round handicap #HPIVOT# - map ${this.tDigit}`]);
                }
            }
        };

        const final = applyAllMarkets(bet, ['roots', 'pivotKeys',], params, markets);
        const m = final[bet.market][bet.target];
        const hPivot = pvt => parseInt(pvt) > 0 ? `+${pvt}` : pvt

        replaceInner(m, {
            '#TEAM1#': bet.team1,
            '#TEAM2#': bet.team2,
            '#PIVOT#': bet.pivot,
            '#HPIVOT#': hPivot(bet.pivot),
        });

        dLog('green', 'trustdice', ['Final market is:', m]);
        const $findPivot = $root => {
            let idx = -1;
            if ($root.find('thead th').length === 2) {
                $root.find('thead th').each((i, v) => {
                    const $v = $(v);
                    if ($v.trt().toLowerCase() === bet.target.toLowerCase()) {
                        idx = i
                        return false;
                    }
                });
            }
            let $res = $([]);
            for (const pvt of m.pivotKeys) {
                let test = `Checking pivot: '${pvt}' - `;
                let $pivot = $([]);
                if (idx > -1) {
                    const clearPvt = pvt.replace(/[^\d.]/gi, '');
                    $root.find('table tbody tr').each((i, v) => {
                        const $pivotHere = $(v).find('td')
                            .eq(idx).find('p');
                        if (parseFloat($pivotHere.trt()) === parseFloat(clearPvt)) {
                            $pivot = $pivotHere;
                            return false;
                        } else {
                            console.log(`Pivot '${$pivotHere.trt()}' !== '${clearPvt}'`);
                        }
                    });
                } else {
                    $pivot = $root.find(`p:textEqualsI("${pvt}")`);
                }
                console.log(`${test}result: ${$pivot.length}`);
                if ($pivot.length === 1) {
                    return $pivot;
                } else if ($pivot.length > 1 && bet.sport !== 'TENNIS') {
                    throw `Strange pivot length ${$pivot.length} for ${$root}/${pvt}`;
                }
            }

            return $res;
        };

        let $found = $([]);
        do {
            console.log(`OUTER ${tries}!`);
            for (const root of m.roots) {
                console.log(`Checking root: ${root}`);
                const $root = () => $(`#mainBG span:textEqualsI("${root}")`).parent().next();
                if ($root().length === 0) {
                    continue;
                }
                // Open if necessary
                if (!$root().hasClass('MuiCollapse-entered')) {
                    await mouseChain({
                        target: $(`#mainBG span:textEquals("${root}")`)[0],
                        events: fullClick, error: 'expand', scroll: true
                    });
                    await delayPromise(1000);
                }
                // Switch to All if it exists and not active
                $found = $findPivot($root());
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
                $found.closest('div.MuiCollapse-container')[0].scrollIntoView();
                $('#mainBG').get(0).scrollTop -= 90;
                break;
            }
        } while (tries <= 3);
        return $found;
        //#-#-FINISH
    };

    const closePrevious = async () => {
        const $rb = $('button:textEquals("Clear All")');
        if ($rb.length > 0) {
            await mouseChain({target: $rb[0], events: fullClick, error: '$rb'});
            await delayPromise(333);
        }
    };

    let fails = 0;
    const checkSuccess = async () => {
        // Markets information changed
        const $vb = await waitForElement(['button:textEquals("Done")', '#client-snackbar'],
            250, 30000,)
            .catch(e => $([]));
        if ($vb.length === 0) {
            throw 'No bet result!';
        }
        if ($vb.trt().indexOf('Done') === -1) {
            await delayPromise(3000);
            fails++;
            if (fails > 7) {
                throw `Too many fails ${fails}! LIMITED`;
            }
        }
        return $vb.trt().indexOf('Done') > -1;
    };

    const proceedBet = async (data, command, testing) => {
        const wasSuccessStake = await bMess('WasSuccessStake')
            .check(settings.betweenBets, true)
            .catch(() => 0);
        if (Date.now() - wasSuccessStake < settings.betweenBets) {
            throw `To early after previous success bet ${Date.now() - wasSuccessStake}!`
        }
        if (command === 'BET' && !!currentBetData.data[0].betFromParser) {
            //const eventName = `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`;
            const eventName = document.location.href;
            if (!await eventsWork('trustdice', settings, eventName, false, false)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            }
        }
        if (!!testing) {
            dLog('blue', 'trustdice', `We'll sleep 10s because of testing!`);
            await delayPromise(10000);
            return {
                success: true,
                message: `It was test!`,
            }
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
            const $ab = $('button:textEquals("Accept New Odds")');
            if ($ab.length === 1) {
                await mouseChain({target: $ab[0], events: fullClick, error: '$ab'});
                await delayPromise(300);
            }
            const place = willPlace.toString().replace('.00', '').trim();
            dLog('green', 'trustdice', `Will place (performBet): ${place}, balance: ${getBalance()}`);
            const $input = () => $('div.MuiDrawer-paperAnchorRight div.MuiTabs-root:eq(1)').next()
                .find('input.MuiInputBase-input');
            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            if (parseFloat($input().val()) !== parseFloat(place)) {
                await clearAndSimulate($input()[0], place);
                await delayPromise(222);
                await checkCoefs(data);
            }
            const $pb = $('button:textEquals("Place bet")');
            if ($pb.length !== 1 && !!$('button:textEquals("Place bet")').hasClass('Mui-disabled')) {
                throw 'No place button or its not active!';
            } else {
                await mouseChain({target: $pb[0], events: fullClick, error: '$pb'});
                dLog('green', 'trustdice', `Place bet clicked!`);
            }
        } while (!await checkSuccess());
        await delayPromise(777);
        await mouseChain({target: $('button:textEquals("Done")')[0], events: fullClick, error: 'Done'});
        await delayPromise(888);
        //'button:textEquals("Done")'
        let res = {};
        res = await collectBetResult();
        dLog('green', 'trustdice', [`Bet placed:`, res]);
        return {
            success: true,
            message: res,
        }
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v =>
            locutus_similar_text(`${v.team1} - ${v.team2}`.toLowerCase(), match.toLowerCase(), true) > 75);
        const $coupons = $('div.MuiDrawer-paperAnchorRight div.MuiTabs-root:eq(1)').next().find('a');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $this.clone().children().remove().end().trt();
            if ($this.parent().next().find('p.MuiTypography-colorError:textEquals("Suspended")').length > 0) {
                errors.push(match + ' Suspended coupon!');
            }
            let localCoef = parseFloat($this.parent().next().find('p.MuiTypography-body1:eq(1)').trt());
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

    // Test:
    /*
    await checkCoefs([
        {team1: 'FC Pacos Ferreira', team2: 'CS Maritimo Madeira', coef: '2.1'},
        {team1: 'SL Benfica', team2: 'GD Chaves', coef: '2.1'},
    ]);
     */

    const collectBetResult = async () => {
        const
            $miniTabs = () => $('div.MuiDrawer-paperAnchorRight div.MuiTabs-root'),
            $myBets = () => $miniTabs().eq(0).find('button:textEquals("My Bets")'),
            //$betSlip = () => $miniTabs().eq(0).find('button:textEquals("Bet Slip")'),
            $firstBet = () => $miniTabs().eq(1).parent().next().find('a:first');
        if ($myBets().length === 0) {
            throw '$myBets is not exist!';
        }
        await mouseChain({
            target: $myBets()[0],
            events: fullClick, error: '$myBets'
        });
        await delayPromise(333);
        await waitForCondition(() => $firstBet().length > 0, 333, 5555);
        //await delayPromise(333);
        //await mouseChain({
        //    target: $betSlip()[0],
        //    events: fullClick, error: '$betSlip'
        //});
        await delayPromise(333);
        return {
            external_id: $firstBet().attr('href').split('/').pop(),
            coef: parseFloat($firstBet().parent().next().find('p:eq(1)').trt()),
            stake: parseFloat($firstBet().parent().next().next().find('p:eq(1)').trt()),
            max: '7777777',
        };
    };

    const collectBetResults = async (inD, command) => {
        const collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;

        const
            $avatar = () => $('div.MuiAvatar-root'),
            $type = () => $('label.MuiFormLabel-root:textEquals("Type")').next().find('div'),
            $transaction = () => $('ul[role="menu"] p:textEquals("TRANSACTIONS")'),
            $filterButton = () => $('button:textEquals("Filter")'),
            $betInfo = () => $('h3:textEquals("Bet Info")').closest('div[role="dialog"]'),
            $betInfoClose = () => $('h3:textEquals("Bet Info")').closest('div[role="dialog"]').find('button[type="button"]'),
            $rowsTable = () => $('div.MuiTableContainer-root table');

        await mouseChain({
            target: $avatar()[0],
            events: fullClick, error: 'MuiAvatar-root'
        });
        await delayPromise(1555);
        await mouseChain({
            target: $transaction()[0],
            events: fullClick, error: 'TRANSACTIONS'
        });
        await waitForCondition(() => $rowsTable().length > 0, 255, 7777);
        //select type
        if ($type().find('input[type="hidden"]').val() !== '41') {
            await mouseChain({
                target: $type()[0],
                events: fullClick, error: '$type'
            });
            await delayPromise(1777);
            await mouseChain({
                target: $('ul.MuiMenu-list li[data-value="41"]')[0],
                events: fullClick, error: '41'
            });
            await delayPromise(555);
        }
        await mouseChain({
            target: $filterButton()[0],
            events: fullClick, error: '$filterButton'
        });
        await delayPromise(555);
        await waitForCondition(() => $rowsTable().length > 0, 255, 7777);
        await delayPromise(555);
        await $rowsTable().find('tbody tr').eachAsync(async function (idx, val) {
            await mouseChain({
                target: $(val).find('td:last p')[0],
                events: fullClick, error: 'last:td'
            });
            await delayPromise(1777);
            idx++;
            const status = $betInfo().find('div.MuiPaper-root:eq(0) span').trt() === 'WON'
                ? 'WON' : $betInfo().find('div.MuiPaper-root:eq(0) span').trt() === 'LOST'
                    ? 'LOSE' : 'ACCEPTED';
            const bet = {
                external_id: $betInfo().find('h6').trt().replace(/[^\d.]/g, '').trim(),
                status: status,
                coef: parseFloat($betInfo().find('p:textEquals("Total Odds")').next().trt()),
                stake: parseFloat($betInfo().find('p:textEquals("Total Stake")').next().trt().replace(/[^\d.]/g, '').trim()),
                result: status !== 'ACCEPTED' ? parseFloat($betInfo().find('p:textEquals("Payout")').next().trt().replace(/[^\d.]/g, '').trim()) : '',
            };
            await delayPromise(777);
            await mouseChain({
                target: $betInfoClose()[0],
                events: fullClick, error: '$betInfoClose'
            });
            await delayPromise(1111);
            if (data.length === 0 || data.indexOf(bet.external_id) > -1) {
                collected.push(bet);
            }
            if (idx >= limit) {
                return false;
            }
        });
        await mouseChain({
            target: $('header button[role="tab"]:textEquals("Sports")')[0],
            events: fullClick, error: '$betInfoClose'
        });
        dLog('green', 'trustdice', ['Collected', collected]);
        return {success: true, message: collected};
    };

    const commands = new class commands {
        constructor() {
            this.testing = false;
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
            if (this.testing) {
                dLog('orange', 'trustdice', [`execute, settings:`, settings]);
                currentBetData.data[0].betFromParser = true;
            }
            const res = await this.cLinks[command](data, command, this.testing).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'trustdice', `${command} result: ${res.message}`);
            this.prepareResult(command, res)
                .then(m => port.postMessage(m))
            if (!res.success) {
                throw res.message;
            }
            return res;
        }

        async prepareResult(command, res) {
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('trustdice', settings,
                        document.location.href,
                        true, false);
                    await bMess('WasSuccessStake').set(Date.now());
                }
                let balance = 0;
                await waitForCondition(() => (balance = getBalance(), balance > 0), 250, 5000)
                    .catch(() => dLog('red', 'trustdice',
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
                /*
                const t = {
                    "type": "VALUE",
                    "mode": "LIVE\/PREMATCH",
                    "bookmaker": "STAKE",
                    "coef": 2.3,
                    "placedCoef": 2.2,
                    "source": "VTS",
                    "externalId": "mixed bk bet id",
                    "currency": "ISO4217 string USD",
                    "stake": 345.45,
                    "sport": "FOOTBALL\/HOCKEY\/TENNIS\/BASKETBALL\/VOLLEYBALL\/HANDBALL\/BASEBALL\/TABLETENNIS\/CYBERSPORT",
                    "market": "ONE_TWO\/TOTAL\/T1_TOTAL\/T2_TOTAL\/CORNER_TOTAL\/YC_TOTAL\/HDP\/CORNER_HDP\/YC_HDP\/EURO_HDP",
                    "target": "ONE\/TWO\/DRAW\/OVER\/UNDER\/HOME\/AWAY\/ONE_TWO\/ONE_DRAW\/TWO_DRAW\/H1\/H2\/HX",
                    "pivot": 2.5,
                    "timeValue": "FULL_TIME\/1_SET\/2_GAME\/3_QUARTER\/1_PERIOD\/2_INNING\/2_TIME\/1_HALF\/3_MAP\/3_SET_2_GAME",
                    "league": "string",
                    "homeTeam": "string",
                    "awayTeam": "string",
                    "score": "1-0"
                };
                 */
                if (!!currentBetData.data[0].betFromParser) {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'TRUSTDICE';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = currentBetData.data[0]?.source ||  'VTS';
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

    const messageProcessor = message => {
        dLog('green', 'trustdice', [`messageProcessor (${busy})`, message]);
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
            dLog('green', 'trustdice', ['Command was set till unload:', ourCommand.get()]);
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess('trustdice')
                .set(ourCommand.get(), increaseDelay ? 150000 : 0);
        }
    }, true);

    const afterDOMLoaded = () => {
        bMess('trustdice',).check(40000, true)
            .then(currentCommand => {
                dLog('orange', 'trustdice',
                    [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand]);
                messageProcessor(currentCommand);
            })
            .catch(() => dLog('color: darkgray;', 'trustdice', 'No command!'));
        port.postMessage({m: "PAGE LOADED!"});
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

})();
