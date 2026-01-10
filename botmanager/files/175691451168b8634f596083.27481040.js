(() => {

    'use strict';

    const isMain = window.self === window.top;

    let loaded = Date.now();
    let limited = false;
    let authClicked = 0;
    let authClickedTime = 0;
    let wasAuthCheck = false;
    let busy = false;
    let increaseDelay = false;
    let enterError = false;
    const port = isMain ? chrome.runtime.connect({name: "port_wild"})
        : {postMessage: (...args) => console.log(args)};
    let settings = {
        restartEvery: 1800000,
        authCheckInterval: 2000,
        url: 'https://wild.io/sports',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
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
        login: '',
        password: '',
        maxWaitForScore: 60000
    };

    const loginSelector = 'button.sb-SignInButton';
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
        'FOOTBALL': 'Football',
        'HOCKEY': 'Hockey',
        'TENNIS': 'Tennis',
        'BASKETBALL': 'Basketball',
        'CYBERSPORT': 'cybersport',
    };

    /**
     * Balance
     * @param returnNull - if true - return null when balance does not exists
     * @return {number}
     */
    function getBalance(returnNull) {
        const $b = $('span.sb-ProfileDropdown-balance:eq(1)');
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.text().replace(/[^\d.]/g, '').trim());
    };

    const authCheck = () => {
        if (!busy && Date.now() - loaded > settings.restartEvery) {
            dLog('bigred', 'wild', 'RELOAD 1');
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
        (async () => {
            //$('span.intercom-anchor')
            if (!limited && $(loginSelector).length > 0) {
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
            .catch(e => dLog('red', 'WILD', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    const tryToLogin = async () => {
        if (Date.now() - authClickedTime < 60000) {
            throw 'too soon!';
        }
        const controls = {
            login: '#email',
            password: '#password',
            submit: 'button:textEquals("Log In")',
        };
        const frameLink = 'iframe[title="sign_in"]';
        const $accIFrame = selector => $($(selector)[0].contentDocument);

        if ($getIFrame(frameLink).length === 0) {
            await mouseChain({target: $(loginSelector)[0], events: fullClick, error: 'loginSelector'});
            await delayPromise(1222);
        }

        await waitForCondition(() => Object.keys(controls).every(k => $accIFrame(frameLink).find(controls[k]).length > 0),
            333, 10000, 'No controls!');
        await delayPromise(1000);
        await clearAndInputEmail($accIFrame(frameLink).find(controls.login)[0], settings.login);
        await delayPromise(1000);
        await clearAndSimulate($accIFrame(frameLink).find(controls.password)[0], settings.password);
        await delayPromise(1000);
        await mouseChain({target: $accIFrame(frameLink).find(controls.submit)[0], events: fullClick, error: 'submit login'});
        authClicked++;
        authClickedTime = Date.now();
        dLog('', 'WILD', `Auth clicked ${authClicked}!`);
        await delayPromise(555);
        const errors = await waitForCondition(() => $('span.sb-ProfileDropdown-balance:eq(1)').length > 0,
            333, 35555).catch(() => $([]));
        if (errors.length === 0) {
            enterError = true;
            limited = true;
            throw 'AUTH ERROR!';
        }
    };

    const closePreviousCoupons = async () => {
        const $closeCoupon = $('button[title="Clear"]');
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
                || locutus_similar_text(eventName, controlName, true) > 85;
        dLog('green', 'wild', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const openEvent = async data => {
        dLog('red', 'wild', ['openEvent', data]);
        const used = await bMess('usedEvents').check(1080000).catch(() => []);
        const eventFirst = `${data.team1.replaceAll(/\(.*\)/g, '').trim()}`.toLowerCase();
        const eventName = `${data.team1.trim()} - ${data.team2.trim()}`;
        const sport = accordance[data.sport];
        let $event = $([]);
        const checkWeAreThere = function () {
            const $teams = $('div.sb-Competitor-name');

            if ($teams.length !== 2) {
                return false;
            }

            const
                team1 = $teams.eq(0).trt(),
                team2 = $teams.eq(1).trt(),
                checkEvent = `${team1} - ${team2}`.toLowerCase();
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };
        const findEvent = async () => {
            const $searchBtn = $('button.sb-SearchButton');
            const resultItem = 'a.sb-SearchResultItem';
            const $events = () => data.type === 'LIVE'
                ? $(`${resultItem}:has(.isLive)`)
                : $(`${resultItem}:not(:has(.isLive))`);
            const $searchInpt = () => $('input.sb-SearchBar-input');

            if ($searchBtn.length === 0) {
                throw '$searchBtn is not found!';
            }

            if ($searchInpt().length === 0) {
                await mouseChain({target: $searchBtn[0], events: fullClick, error: '$searchBtn'});
                await delayPromise(500);
                await waitForElement('input.sb-SearchBar-input', 333, 4444);
            }

            await clearAndSimulate($searchInpt()[0], eventFirst, false, true, false);
            await waitForCondition(() => $events().length > 0, 333, 5555, 'Event list is not available!');

            $events().closest(resultItem).each(function () {
                const $this = $(this);
                const team1 = $this.find('span.sb-SearchResultItem-teamName:eq(0)').trt()
                const team2 = $this.find('span.sb-SearchResultItem-teamName:eq(1)').trt()
                const checkEvent = `${team1} - ${team2}`;

                dLog('blue', 'wild', `Check: '${checkEvent}' === '${eventName}'`);
                if (checkEventName(checkEvent, eventName)) {
                    $event = $this;
                    return false;
                }
            });
        };

        if (!sport) {
            throw 'No sport found!';
        }

        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }

        if (used.indexOf(eventName) === -1) {
            await findEvent();
        }

        if ($event.length === 0) {
            if (used.indexOf(eventName) === -1) {
                used.push(eventName);
                await bMess('usedEvents').set(used);
            }
            
            throw 'Event not found!';
        }

        // go to event page
        await mouseChain({target: $event[0], events: fullClick, error: 'EVENT'});
        await waitForCondition(checkWeAreThere,
            500, 15000, 'We are not on event!');
        await delayPromise(222);

        return 'Switched to event!';
    };

    const getBetElement = async betIn => {
        const
            bet = JSON.parse(JSON.stringify(betIn)),
            $teams = $('div.sb-Competitor-name');
            bet.team1 = $teams.eq(0).trt();
            bet.team2 = $teams.eq(1).trt();
        const $roots = () => $('div.sb-MarketTable');
        const $all = () => $('span[title="All"]').closest('button');

        const markets = {
            'ONE_TWO': {
                'ONE': {
                    tabs: ['All'],
                    roots: ['Match Result'],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    tabs: ['All'],
                    roots: ['Match Result'],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    tabs: ['All'],
                    roots: ['Match Result'],
                    pivotKeys: ['Draw',],
                },
                'ONE_DRAW': {
                    tabs: ['All'],
                    roots: ['Double Chance'],
                    pivotKeys: ['1X',],
                },
                'TWO_DRAW': {
                    tabs: ['All'],
                    roots: ['Double Chance'],
                    pivotKeys: ['X2',],
                },
                'ONE_TWO': {
                    tabs: ['All'],
                    roots: ['Double Chance'],
                    pivotKeys: ['12',],
                }
            },
            'TOTAL': {
                'OVER': {
                    tabs: ['All'],
                    roots: ['Total Goals', 'Total Goals Asian'],
                    pivotKeys: ['Over (#PIVOT#)'],
                },
                'UNDER': {
                    tabs: ['All'],
                    roots: ['Total Goals', 'Total Goals Asian'],
                    pivotKeys: ['Under (#PIVOT#)'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tabs: ['All'],
                    roots: ['Team 1 Total Goals',],
                    pivotKeys: ['Over (#PIVOT#)'],
                },
                'UNDER': {
                    tabs: ['All'],
                    roots: ['Team 1 Total Goals',],
                    pivotKeys: ['Under (#PIVOT#)'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tabs: ['All'],
                    roots: ['Team 2 Total Goals',],
                    pivotKeys: ['Over (#PIVOT#)'],
                },
                'UNDER': {
                    tabs: ['All'],
                    roots: ['Team 2 Total Goals',],
                    pivotKeys: ['Under (#PIVOT#)'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    tabs: ['All'],
                    roots: ['Corners: Total',],
                    pivotKeys: ['over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['All'],
                    roots: ['Corners: Total',],
                    pivotKeys: ['under #PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    tabs: ['All'],
                    roots: ['Goals Handicap', 'Goals Asian Handicap'],
                    pivotKeys: ['#TEAM1# (#HPIVOT#)'],
                },
                'AWAY': {
                    tabs: ['All'],
                    roots: ['Goals Handicap', 'Goals Asian Handicap'],
                    pivotKeys: ['#TEAM2# (#HPIVOT#)'],
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
                    this.addReplIn('roots', 'Match Result', '1st Half Result');
                    this.addReplIn('roots', 'Double Chance', '1st Half Double Chance');
                }

                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Goals Handicap', '1st Half Goals Handicap');
                }

                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total Goals', '1st Half Total Goals');
                }

                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', 'Team 1 Total Goals', '1st Half Team 1 Total Goals');
                }

                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', 'Team 2 Total Goals', '1st Half Team 2 Total Goals');
                }
            }
        };

        params.proceed_hockey = function (bet) {
            if (!this.full) {
                const period = this.tDigit;
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Result', `${period} Period Result`);
                    this.addReplIn('roots', 'Double Chance', `${period} Period Double Chance`);
                }

                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Goals Handicap', `${period} Period Goals Handicap`);
                }

                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total Goals', `${period} Period Total Goals`);
                }

                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', 'Team 1 Total Goals', `${period} Period Team 1 Total Goals`);
                }

                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', 'Team 2 Total Goals', `${period} Period Team 2 Total Goals`);
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Result', 'Match Result (Regular Time)');
                    this.addReplIn('roots', 'Double Chance', 'Double Chance (Regular Time)');
                }

                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Goals Handicap', 'Goals Handicap (Regular Time)');
                }

                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total Goals', 'Total Goals (Regular Time)');
                }

                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', 'Team 1 Total Goals', 'Team 1 Total Goals (Regular Time)');
                }

                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', 'Team 2 Total Goals', 'Team 2 Total Goals (Regular Time)');
                }
            }
        };

        params.proceed_tennis = function (bet) {
            if (!this.full) {
                const s = this.tDigit;
                //Game handicap
                if (bet.time_value.indexOf('SET') > -1 && bet.time_value.indexOf('GAME') > -1) {
                    const parts = bet.time_value.split('_GAME_');
                    if (bet.market === 'ONE_TWO') {
                        this.addTotal('roots', [s + ' Set ' + parts[1] + ' Game Winner']);
                    }
                    if (bet.market === 'HDP') {
                        this.addTotal('roots', [s + ' Set ' + parts[1] + ' Game Points Handicap']);
                    }
                    if (bet.market === 'TOTAL') {
                        this.addTotal('roots', [s + ' Set ' + parts[1] + ' Game Total Points']);
                    }
                } else {
                    if (bet.market === 'ONE_TWO') {
                        this.addReplIn('roots', 'Match Result', `${s} Set Winner`);
                    }
                    if (bet.market === 'HDP') {
                        this.addReplIn('roots', 'Goals Handicap', `${s} Set Games Handicap`);
                    }
                    if (bet.market === 'TOTAL') {
                        this.addReplIn('roots', 'Total Goals', `${s} Set Total Games`);
                    }
                    if (bet.market === 'T1_TOTAL') {
                        this.addReplIn('roots', 'Team 1 Total Goals', `${s} Set Player 1 Total Games`);
                    }
                    if (bet.market === 'T2_TOTAL') {
                        this.addReplIn('roots', 'Team 2 Total Goals', `${s} Set Player 2 Total Games`);
                    }
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Result', 'Match Winner');
                }
                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Goals Handicap', 'Games Handicap');
                }
                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total Goals', 'Total Games');
                }
                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', 'Team 1 Total Goals', 'Player 1 Total Games');
                }
                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', 'Team 2 Total Goals', 'Player 2 Total Games');
                }
            }
        };

        params.proceed_cybersport = function (bet) {
            const map = this.tDigit;

            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Result', `Map ${map} Winner`);
                }
                if (bet.market === 'HDP') {
                    this.addTotal('roots', 'Goals Handicap', `Map ${map} Rounds Handicap`);
                }
                if (bet.market === 'TOTAL') {
                    this.addTotal('roots', 'Total Goals', `Map ${map} Total Rounds`);
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Result', 'Match Winner');
                }
                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Goals Handicap', 'Maps Handicap');
                }
                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total Goals', 'Maps Total');
                }
            }
        };
        params.proceed_basketball = function (bet) {
            if (!this.full) {
                const quater = this.tDigit;
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Result', `${quater} Quarter Winner (2-Way)`);
                }
                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Goals Handicap', `${quater} Quarter Points Handicap`);
                }
                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total Goals', `${quater} Quarter Total Points`);
                }
                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', 'Team 1 Total Goals', `${quater} Quarter Team 1 Total Points`);
                }
                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', 'Team 2 Total Goals', `${quater} Quarter Team 2 Total Points`);
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Result', 'Match Result (Regular Time)');
                }
                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Goals Handicap', 'Points Handicap');
                }
                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total Goals', 'Total Points');
                }
                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', 'Team 1 Total Goals', 'Team 1 Total Points');
                }
                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', 'Team 2 Total Goals', 'Team 2 Total Points');
                }
            }
        };
        const final = applyAllMarkets(bet, ['roots', 'pivotKeys', 'tabs'], params, markets, true);
        const m = final[bet.market][bet.target];
        const hPivot = pvt => {
            if (bet.target === 'HOME') {
                if (pvt > 0) {
                    pvt = '+' + pvt;
                }
            }

            if (parseFloat(pvt) === 0) {
                pvt = '0';
            }

            return pvt;
        };
        const $findPivot = $root => {
            let $res = $([]);
            for (const pvt of m.pivotKeys) {
                console.log(`Checking pivot: '${pvt}'`);
                let $pivot = $([]);
                $pivot = $root.closest('div.sb-MarketTable').find(`span.sb-Odd-label:textEquals("${pvt}")`);
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

        dLog('green', 'wild', ['Final market is:', m]);
        await waitForCondition(() => $roots().length > 0,
            333, 7777, 'No markets!');

        // select tab
        if ($all().attr('aria-selected') !== 'true') {
            await mouseChain({target: $all()[0], events: fullClick, error: '$all'});
            await delayPromise(777);
        }

        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () => $roots().find(`span:textEquals("${root}")`);
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
    };

    const openCoupon = async paramData => {
        dLog('green', 'wild', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'wild', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'wild', 'Event must be opened!');
            const $element = await getBetElement(data);
            await mouseChain({target: $element[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(500);
        }
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => checkEventName(v.team1.toLowerCase()
            + ' — ' + v.team2.toLowerCase(), match));
        await waitForCondition(() => $('div.sb-BetSelectionInfo').length > 0,
            333, 10000, 'No coupons!');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        const $coupons = $('div.sb-BetSelectionInfo');
        $coupons.each(function () {
            const $this = $(this);
            const match = $this.find('div.sb-BetSelectionInfo-competitors').trt();
            let localCoef = $this.find('span.sb-BetOdds').trt();
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
            if (!await eventsWork('wild', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'wild',
                    `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                    + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
            }
        }

        let willPlace = parseFloat(data[0].stake);
        const checkSuccess = async () => {
            // Please wait while your bet is placed
            await waitForCondition(() => $('span[title="Successfully placed!"]').length > 0,
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
        const $firstBet = () => $('div.sb-MyBetsSingle:first');

        if (!willPlace) {
            throw`Bad will place: ${willPlace}, ${data[0].stake}`;
        }

        await checkBalance(willPlace);
        await closePreviousCoupons();
        await openCoupon(data);

        do {
            await checkCoefs(data);
            const place = willPlace.toString().replace('.00', '').trim();
            const $input = () => $('input.sb-StakeInput-input');
            dLog('green', 'wild', `Will place (performBet): ${place}`);

            if ($('button[title="Accept changes"]').length > 0) {
                await mouseChain({target: $('button[title="Accept changes"]')[0], events: fullClick, error: 'acceptChange'});
                await delayPromise(1111);
                continue;
            }

            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }

            if (parseFloat($input().val()) !== parseFloat(place)) {
                await clearAndInputNumber($input()[0], place);
                await delayPromise(555);
                dLog('green', 'wild', `STAKE entered ${willPlace}`);
            }

            const entered = parseFloat($input().val());
            dLog('green', 'wild', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);

            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'wild', 'Entered !== willPlace - try to reenter!');
                continue;
            }

            await delayPromise(555);
            const $placeBtn = $('button[type="submit"]:textEquals("Place Bet")');

            if ($placeBtn.length === 0) {
                throw 'No place button or button disabled!';
            }

            await mouseChain({target: $placeBtn[0], events: fullClick, error: '$placeBtn'});
        } while (!await checkSuccess());

        await delayPromise(777);
        await mouseChain({target: $('button.sb-DesktopMyBetsButton')[0], events: fullClick, error: 'my bets'});
        await delayPromise(777);
        await waitForCondition(() => $('button.sb-ToggleGroup-item:textEquals("Open")').length > 0, 333, 10000, 'no open my bets');
        await delayPromise(333);
        await mouseChain({
            target: $('button.sb-ToggleGroup-item:textEquals("Open")')[0],
            events: fullClick,
            error: 'open bets'
        });
        await delayPromise(333);
        await waitForCondition(() => $('div.sb-MyBetsSingle:first').length > 0, 333, 10000, 'no display open bets');

        const response = {
            success: true,
            message: {
                external_id: $firstBet().find('a.sb-BetTitleLink').attr('href').split('-').slice(-1)[0],
                coef: $firstBet().find('span.sb-BetHistoryItem-odds').trt(),
                stake: $firstBet().find('span[title="Total stake"]').next().trt().replace(/[^\d.]/g, ''),
                max: '7777777',
            },
        };

        await mouseChain({target: $('button:textEquals("Bet Slip")')[0], events: fullClick, error: 'bet slip'});
        await delayPromise(888);
        await mouseChain({target: $('a[href="/sports/live"]')[0], events: fullClick, error: 'LIVE'});

        
        return response;
    };

    const commands = new class commands {
        constructor() {
            this.cLinks = {
                'BET': proceedBet,
                'EXPRESS_BET': proceedBet,
                //'BET_RESULT': collectBetResults,
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
            dLog(res.success ? 'green' : 'red', 'WILD', `${command} result: ${res.message}`);
            port.postMessage(await this.prepareResult(command, res));
            if (!res) {
                throw error;
            }
            return res;
        }

        async prepareResult(command, res) {
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('wild', settings,
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
                    resultData.bookmaker = 'WILD';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = '486' || 'oddscp';
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
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            ['login', 'password', 'phone', 'uid'].forEach(k => settings[k] = message[k]);

            if (message.start_url) {
                settings.url = message.start_url;
            }

            settings.fork = message.fork;
            settings.forkOnly = typeof message.fork === 'object' && Object.keys(message.fork).length > 0;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 2400000;
            settings.betweenBets = message.betweenBets || 40000;
            authCheck();
            wasAuthCheck = true;
        } else if ($(loginSelector).length > 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (commands.exists(message.action)) {
            // Hint: execute command
            busy = true;
            ourCommand.set(message);
            commands.execute(message.action, message.data)
                .catch(e => dLog('red', 'WILD', `Error till execute: ${e}`))
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
            const command = await bMess('WILD').check(40000);
            await waitForCondition(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck), 333, 60000, 'No auth check!');
            bsLogger('green', 'WILD', [`Restoring with (${isMain}): `, command]);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));
        port.postMessage({m: "PAGE LOADED!"});
        console.log('%c' + `wild loaded and message sent! (${isMain}) ${document.location.href}`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", async () => {
        await ourCommand.save('WILD', increaseDelay ? 150000 : 0);
        bsLogger('green', 'WILD', [`Command was set till unload (${isMain}):`, ourCommand.get()]);
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

})();
