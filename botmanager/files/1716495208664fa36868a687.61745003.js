(function () {

    "use strict";

    /**
     * @import libs/jquery-3.3.1.min.js
     */

    let newAPI = false;
    let authClicked = 0;
    let limited = false;
    let authClickedTime = 0;
    let busy = false;
    let increaseDelay = false;
    let enterError = false;
    let stopSports = false;
    let stopBets = false;
    const loginSelector = 'button:textEquals("Login"):visible';

    const port = window.self === window.top
        ? chrome.runtime.connect({name: 'port_coinsgame'})
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
        eventMaxBets: 1,
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
        'FOOTBALL': 'Football',
        'HOCKEY': 'Ice Hockey',
        'VOLLEYBALL': 'Volleyball',
        'TENNIS': 'Tennis',
        'BASKETBALL': 'Basketball',
        'CYBERSPORT': '',
    };

    const ourCommand = new ourCommandProto();

    const getBalance = returnNull => {
        const $b = $('span.user-money05:visible');
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.text().replace(/[^\d.]/g, '').trim());
    };

    const switchLang = async () => {
        if ($('div.lng_no_reg img[alt="en"]').length === 0) {
            await mouseChain({target: $('div.lng_no_reg')[0], events: fullClick, error: '$enLink'});
            await delayPromise(2222);
            await mouseChain({target: $('div.lng_choose_en:visible')[0], events: fullClick, error: '$lng_choose_en'});
            await delayPromise(1222);
        }
    };

    const authCheck = function () {
        if (enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            bsError(port, 'ERROR AUTH!');
            return;
        }
        (async () => {
            const profile = await waitForElement('div.profile:visible', 333, 8888).catch(() => $([]));

            if (profile.length === 0) {
                await switchLang();
            }

            if (!limited && $(loginSelector).length > 0 && profile.length === 0) {
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
            .catch(e => dLog('red', 'COINSGAME', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    const tryToLogin = async () => {
        if (Date.now() - authClickedTime < 60000) {
            throw 'too soon!';
        }

        const $loginForm = () => $('#module-login3:visible');

        if ($loginForm().length === 0) {
            await mouseChain({target: $(loginSelector)[0], events: fullClick, error: 'loginSelector'});
            await delayPromise(555);
        }

        await waitForCondition(() => $loginForm().length > 0,
            333, 10000, 'No login form!');
        await delayPromise(555);
        await clearAndInputEmail($loginForm().find('input[name="email"]')[0], settings.login);
        await delayPromise(1000);
        await clearAndSimulate($loginForm().find('input[name="password"]')[0], settings.password);
        await delayPromise(1000);
        await mouseChain({target: $loginForm().find('button[type="submit"]')[0], events: fullClick, error: 'submit login'});
        authClicked++;
        authClickedTime = Date.now();
        dLog('', 'COINSGAME', `Auth clicked ${authClicked}!`);
        await delayPromise(555);
        const profile = await waitForElement('div.profile:visible', 333, 22222).catch(() => $([]));
        if (profile.length === 0) {
            enterError = true;
            limited = true;
            throw 'AUTH ERROR!';
        }
    };

    const closePreviousCoupons = async () => {
        const $closeCoupon = $('button[title="Clear"]');
        if ($closeCoupon.length > 0) {
            await mouseChain({target: $closeCoupon[0], events: fullClick, error: '$closeCoupon'});
            await delayPromise(777);
        }
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
                $pivot = $root.closest('div.sb-MarketTable').find(`span.sb-Outcome-label:textEquals("${pvt}")`);
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

        dLog('green', 'coinsgame', ['Final market is:', m]);
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

    const expandCoupon = async () => {
        if ($('div.sb-TicketDrawer-content').hasClass('entered') === false) {
            await mouseChain({target: $('button.sb-DesktopTicketTabs-toggle')[0], events: fullClick, error: 'expand coupon'});
            await delayPromise(1777);
        }
    }

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 75;
        dLog('', 'coinsgame', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const openEvent = async data => {
        dLog('red', 'coinsgame', ['openEvent', data]);
        let $el = $([]);
        const eventName = `${data.team1} - ${data.team2}`.toLowerCase();
        const sport = accordance[data.sport];
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
        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }

        //go to live if needed
        if ($('div.sb-LivePage-sportsLive').length === 0) {
            if ($('a.isLive').length > 0) {
                await mouseChain({target: $('a.isLive')[0], events: fullClick, error: 'LIVE'});
                await delayPromise(2222);
            }
        }

        const findEvent = async () => {
            const events = 'a.sb-BettingTable-link';
            const sportTab = `div.sb-LivePage-sportsLive button[title="${sport}"]`;
            await waitForElement(sportTab, 333, 10000);
            await delayPromise(222);
            //switch sport
            if ($(sportTab).length > 0) {
                await mouseChain({
                    target: $(sportTab)[0],
                    events: fullClick,
                    error: '$(sportTab)'
                });
                await delayPromise(1111);
            } else {
                throw 'No sport tab :(';
            }
            await waitForElement(events, 333, 10000);

            for (let i = 0; i < 5; i++) {
                await $(events).eachAsync(async function () {
                    const $this = $(this);
                    const team1 = $this.find('span.sb-TeamColumn-name:eq(0)').trt();
                    const team2 = $this.find('span.sb-TeamColumn-name:eq(1)').trt();
                    const checkEvent = `${team1} - ${team2}`.toLowerCase();
                    dLog('blue', 'coinsgame', `Check: '${checkEvent}' === '${eventName}'`);
                    if (checkEventName(checkEvent, eventName)) {
                        $el = $(this);
                        return false;
                    }
                });

                if ($el.length > 0) {
                    break;
                }

                const lastLength = $(events).length - 1;
                $(events).eq(lastLength)[0].scrollIntoView();
                await delayPromise(333);
            }

            return $el.length > 0;
        };
        if (await findEvent() === false) {
            throw 'Event not found!';
        }
        // go to event page
        await mouseChain({
            target: $el[0],
            events: fullClick,
            error: 'EVENT'
        });
        await waitForCondition(checkWeAreThere,
            500, 20000, 'We are not on event!');
        await delayPromise(100);

        return 'Switched to event!';
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

    const openCoupon = async paramData => {
        dLog('green', 'coinsgame', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'coinsgame', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'coinsgame', 'Event must be opened!');
            const $element = await getBetElement(data);
            await delayPromise(500);
            await expandCoupon();
            await mouseChain({target: $element[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(500);
        }
    };

    const proceedBetSport = async (data, balance) => {
        const
            realSuccessInterval = data[0].successBetInterval || settings.betweenBets,
            wasSuccessStake = await bMess('WasSuccessStake')
                .check(realSuccessInterval)
                .catch(() => 0),
            successDiff = Date.now() - wasSuccessStake;
        if (successDiff < realSuccessInterval) {
            throw `To early after previous success bet ${successDiff} instead of ${realSuccessInterval}!`
        }
        if (!!currentBetData.data[0].betFromParser) {
            const eventName = `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`;
            if (!await eventsWork('COINSGAME', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'coinsgame',
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

        await expandCoupon();
        await closePreviousCoupons();
        await checkBalance(willPlace);
        await openCoupon(data);

        do {
            await checkCoefs(data);
            const place = willPlace.toString().replace('.00', '').trim();
            const $input = () => $('input.sb-StakeInput-input');
            dLog('green', 'coinsgame', `Will place (performBet): ${place}`);

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
                dLog('green', 'coinsgame', `STAKE entered ${willPlace}`);
            }

            const entered = parseFloat($input().val());
            dLog('green', 'coinsgame', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);

            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'coinsgame', 'Entered !== willPlace - try to reenter!');
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
        await mouseChain({target: $('a.isLive')[0], events: fullClick, error: 'LIVE'});

        return response;
    };

    const collectBetResultsSports = async (inD, balance) => {
        let collected = [];
        let checked = 0;
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30)
            : 30;
        const $betContent = () => $('div.sb-TicketDrawer-content');
        const myBets = 'button.sb-DesktopMyBetsButton';


        if ($betContent().hasClass('entered') === false) {
            await mouseChain({target: $('button.sb-DesktopTicketTabs-toggle')[0], events: fullClick, error: 'open bets'});
            await delayPromise(1777);
        }

        await expandCoupon();

        const $myBets = await waitForElement('div.sb-BetHistoryItem',
            333, 9999);

        await $myBets.eachAsync(async function () {
            if (checked > limit) {
                return false;
            }
            checked++;
            const
                $this = $(this),
                betId = $this.find('a.sb-BetTitleLink').attr('href').split('/').pop().split('-').pop();
            if (data.length === 0 || data.indexOf(betId) > -1) {
                const $statVal = $this.next().find('span.sb-MyBetStakeAndProfitRow-value:eq(1)');
                const stake = $this.next().find('span.sb-MyBetStakeAndProfitRow-value:eq(0)').trt().replace(/[^\d.]/g, '');
                const result = $this.find('span.sb-BetHistoryItem-outcomeName').trt();

                let status = 'REFUNDED';

                if ($statVal.hasClass('win')) {
                    status = 'WON';
                } else if ($statVal.hasClass('lose')) {
                    status = 'LOSE';
                } else if ($statVal.hasClass('no_results')) {
                    status = 'ACCEPTED'
                }

                collected.push({
                    external_id: betId,
                    status,
                    stake: stake,
                    result: result,
                });
            }
        });

        return {success: true, message: collected};
    };

    const sportProcessor = command => {
        dLog('green', 'coinsgame', `SportProcessor: ${command.action}`);
        if (sportCommands.exists(command.action)) {
            // Hint: execute command
            ourCommand.set(command);
            sportCommands.execute(command.action, command.data, command.balance)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'coinsgame', ['Unknown Sport command:', command]);
        }
    };

    const sportCommands = new class SportCommands {
        constructor() {
            this.cLinks = {
                'BET': proceedBetSport,
                'EXPRESS_BET': proceedBetSport,
                'BET_RESULT': collectBetResultsSports,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data, balance) {
            currentBetData.init(data);
            dLog('green', 'coinsgame', [command, data]);
            const res = await this.cLinks[command](data, balance)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'coinsgame', [`${command} sports result was set:`, res]);
            //go to live if needed
            if ($('div.sb-LivePage-sportsLive').length === 0) {
                if ($('a.isLive').length === 0) {
                    document.location.href = 'https://coins.game/sportss/?live';
                }
            }
            await bMess('CoinsSportResult').set(res);
            return res;
        }
    };

    const executeSportCommand = async (data, command, balance) => {
        dLog('green', 'coinsgame', `executeSportCommand: ${command}, ${balance}`);
        await bMess('CoinsSportCommand').set({action: command, data, balance});
        dLog('yellow', 'coinsgame', `Start waiting for command: ${command}`);

        return await bMess('CoinsSportResult', false)
            .get(120000, 10000, 300, true);
    };

    const commands = new class commands {
        constructor() {
            this.testing = false;
            this.cLinks = {
                'BET': executeSportCommand,
                'EXPRESS_BET': executeSportCommand,
                'BET_RESULT': executeSportCommand,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data) {
            currentBetData.init(data);
            if (this.testing) {
                dLog('orange', 'coinsgame', [`execute, settings:`, settings]);
                currentBetData.data[0].betFromParser = true;
            }
            const res = await this.cLinks[command](data, command, getBalance()).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'coinsgame', [`${command} result:`, res]);
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
                    await eventsWork('COINSGAME', settings,
                        `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`,
                        true, false);
                    await bMess('WasSuccessStake').set(Date.now());
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
                if (res.message && typeof res.message === 'string'
                    && res.message.indexOf('Войдите в систему') > -1) {
                    delayPromise(1000)
                        .then(() => window.location.reload());
                }
                if (!!currentBetData.data[0].betFromParser) {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'COINSGAME';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = currentBetData.data[0].source;
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
            } else {
                return {};
            }
        }
    };

    const messageProcessor = message => {
        dLog('green', 'coinsgame', [`messageProcessor (${busy})`, message]);
        newAPI = !!message.newAPI;
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
            settings.eventMaxBets = 1;
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

    if (window.self === window.top) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message);
        });
    }

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('green', 'coinsgame', ['Command was set till unload:', ourCommand.get()]);
            bMess('COINSGAME_COMMAND', true).set(ourCommand.get(), increaseDelay ? 130000 : 0);
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
            bMess('COINSGAME_COMMAND', true).check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'coinsgame', [
                        `Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand
                    ]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'coinsgame', 'No command!'));
        } else if (document.location.href.indexOf('sport4.coins.game') > -1) {
            (async () => {
                while (!stopSports) {
                    const csc = await bMess('CoinsSportCommand').check(10000, true)
                        .catch(() => null);
                    if (csc !== null) {
                        sportProcessor(csc);
                    }
                    await delayPromise(500);
                }
            })();
            dLog('green', 'coinsgame', 'Sport processor initialized!');
        }
    }
})();
