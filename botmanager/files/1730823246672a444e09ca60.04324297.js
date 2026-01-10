(function () {

    "use strict";

    /**
     * @import libs/jquery-3.3.1.min.js
     */

    let authClicked = 0;
    let limited = false;
    let authClickedTime = 0;
    let busy = false;
    let increaseDelay = false;
    let enterError = false;
    let stopSports = false;
    const loginSelector = 'a.ease-in-out:textEquals("Login")';

    const port = window.self === window.top
        ? chrome.runtime.connect({name: 'port_olybet'})
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
        const $b = $('span:textEquals("Deposit")').next();
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.text().replace(/[^\d.]/g, '').trim());
    };

    const changeLang = async () => {
        const enLink = 'img[src="/img/flags/en.svg"]:visible';
        const $engLng = await waitForElement(enLink, 333, 4444).catch(() => $([]));
        if ($engLng.length === 0) {
            await mouseChain({target: $('img[src^="/img/flags/"]:visible')[0], events: fullClick, error: 'mainL'});
            await delayPromise(2222);
            await mouseChain({target: $(enLink)[0], events: fullClick, error: '$en'});
            await delayPromise(7777);
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
            await changeLang();
            const profile = await waitForElement('span:textEquals("Deposit")', 333, 3333).catch(() => $([]));
            await closeAllWeNeed({
                '#onesignal-slidedown-cancel-button': '#onesignal-slidedown-cancel-button',
                '#CybotCookiebotDialogBodyButtonAccept:visible': '#CybotCookiebotDialogBodyButtonAccept:visible',
                '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll': '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
            });

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
            .catch(e => dLog('red', 'OLYBET', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    const tryToLogin = async () => {
        if (Date.now() - authClickedTime < 60000) {
            throw 'too soon!';
        }

        const $loginFormHeder = () => $('h5:textEquals("Welcome back to OlyBet!"):visible');

        if ($loginFormHeder().length === 0) {
            await mouseChain({target: $(loginSelector)[0], events: fullClick, error: 'loginSelector'});
            await delayPromise(333);
        }

        await waitForCondition(() => $loginFormHeder().length > 0,
            333, 5555, 'No login form!');
        await delayPromise(333);
        await clearAndInputEmail($('input#user_name:visible')[0], settings.login);
        await delayPromise(1000);
        await clearAndSimulate($('input#password:visible')[0], settings.password);
        await delayPromise(1000);
        await mouseChain({target: $('button#login-button:visible')[0], events: fullClick, error: 'submit login'});
        authClicked++;
        authClickedTime = Date.now();
        dLog('', 'OLYBET', `Auth clicked ${authClicked}!`);
        await delayPromise(555);
        const profile = await waitForElement('span:textEquals("Deposit")', 333, 22222).catch(() => $([]));

        if (profile.length === 0) {
            enterError = true;
            limited = true;
            throw 'AUTH ERROR!';
        }
    };

    const closePreviousCoupons = async () => {
        const $closeCoupon = $('span.betslip-remove-all');
        if ($closeCoupon.length > 0) {
            await mouseChain({target: $closeCoupon[0], events: fullClick, error: '$closeCoupon'});
            await delayPromise(777);
        }
    };

    const getBetElement = async betIn => {
        const
            bet = JSON.parse(JSON.stringify(betIn)),
            $teams = $('p.game-d-c-b-r-c-team-name');
            bet.team1 = $teams.eq(0).trt();
            bet.team2 = $teams.eq(1).trt();
        const $roots = () => $('div.sgm-market-g-head-bc');

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
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    tabs: ['All'],
                    roots: ['Total Goals', 'Total Goals Asian'],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tabs: ['All'],
                    roots: ['#TEAM1# Total Goals', '#TEAM1# Total Goals Asian'],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    tabs: ['All'],
                    roots: ['#TEAM1# Total Goals', '#TEAM1# Total Goals Asian'],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tabs: ['All'],
                    roots: ['#TEAM2# Total Goals', '#TEAM2# Total Goals Asian'],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    tabs: ['All'],
                    roots: ['#TEAM2# Total Goals', '#TEAM2# Total Goals Asian'],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    tabs: ['All'],
                    roots: ['Corners: Total',],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    tabs: ['All'],
                    roots: ['Corners: Total',],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    tabs: ['All'],
                    roots: ['Goals Handicap', 'Goals Asian Handicap'],
                    pivotKeys: ['#HPIVOT#'],
                },
                'AWAY': {
                    tabs: ['All'],
                    roots: ['Goals Handicap', 'Goals Asian Handicap'],
                    pivotKeys: ['#HPIVOT#'],
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
                    this.addReplIn('roots', '#TEAM1# Total Goals', '1st Half #TEAM1# Total Goals');
                }

                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# Total Goals', '1st Half #TEAM2# Total Goals');
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
                        this.addReplIn('roots', '#TEAM1# Total Goals', `${s} Set #TEAM1# Total Games`);
                    }
                    if (bet.market === 'T2_TOTAL') {
                        this.addReplIn('roots', '#TEAM2# Total Goals', `${s} Set #TEAM2# Total Games`);
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
                    this.addReplIn('roots', '#TEAM1# Total Goals', '#TEAM1# Total Games');
                }
                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# Total Goals', '#TEAM2# Total Games');
                }
            }
        };

        params.proceed_cybersport = function (bet) {
            const map = this.tDigit;

            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Result', `Game ${map} Winner`);
                }
                if (bet.market === 'HDP') {
                    this.addTotal('roots', 'Goals Handicap', `Game ${map} Kills Handicap`);
                }
                if (bet.market === 'TOTAL') {
                    this.addTotal('roots', 'Total Goals', `Game ${map} Total Kills`);
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
                    this.addReplIn('roots', '#TEAM1# Total Goals', `${quater} Quarter #TEAM1# Total Points`);
                }
                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# Total Goals', `${quater} Quarter #TEAM2# Total Points`);
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
                    this.addReplIn('roots', '#TEAM1# Total Goals', '#TEAM1# Total Points');
                }
                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# Total Goals', '#TEAM2# Total Points');
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
                if (bet.market === 'ONE_TWO') {
                    $pivot = $root.closest('div.sgm-market-g').find(`span.market-name-bc:textEquals("${pvt}")`);
                    if ($pivot.length === 1) {
                        $res = $pivot;
                        break;
                    }
                } else {
                    const $pivotBlock = $root.closest('div.sgm-market-g');
                    if (['OVER', 'HOME'].indexOf(bet.target) > -1) {
                        $pivot = $pivotBlock.find(`div.sgm-market-g-i-cell-bc:not(.m-g-header):nth-child(odd) span.market-name-bc:textEquals("${pvt}")`);
                    } else {
                        $pivot = $pivotBlock.find(`div.sgm-market-g-i-cell-bc:not(.m-g-header):nth-child(even) span.market-name-bc:textEquals("${pvt}")`);
                    }
                    if ($pivot.length === 1) {
                        $res = $pivot;
                        break;
                    }
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

        dLog('green', 'OLYBET', ['Final market is:', m]);
        await waitForCondition(() => $roots().length > 0,
            333, 7777, 'No markets!');

        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () => $roots().find(`p:textEquals("${root}")`);
            console.log('$root ', $root());
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

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 75;
        dLog('', 'OLYBET', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const openEvent = async data => {
        dLog('red', 'OLYBET', ['openEvent', data]);
        let $el = $([]);
        const eventName = `${data.team1} - ${data.team2}`;
        const eventNameFirst = `${data.team1}`.toLowerCase();
        const checkWeAreThere = function () {
            const $teams = $('p.game-d-c-b-r-c-team-name');
            if ($teams.length !== 2) {
                return false;
            }
            const
                team1 = $teams.eq(0).trt(),
                team2 = $teams.eq(1).trt(),
                checkEvent = `${team1} - ${team2}`;
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };
        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }

        const findEvent = async () => {
            const $searchEl = () => $('div.left-menu-search input.ss-input-bc');
            const events = 'li.sport-search-result-item-bc';

            if ($searchEl().length === 0) {
                throw '$searchEl is not exist!';
            }

            // fill event
            await clearAndSimulate($('div.left-menu-search input.ss-input-bc')[0], eventNameFirst, false, false, true, false);
            await waitForElement(events, 333, 10000);

            await $(events).eachAsync(async function () {
                const $this = $(this);
                const checkEvent = $this.find('p.s-g-competition-n-bc').next().trt();
                dLog('blue', 'OLYBET', `Check: '${checkEvent}' === '${eventName}'`);
                if (checkEventName(checkEvent, eventName)) {
                    $el = $(this);
                    return false;
                }
            });
            await delayPromise(333);

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
            + ' - ' + v.team2.toLowerCase(), match));
        await waitForCondition(() => $('div.bs-bet-item-bg-c-bc').length > 0,
            333, 10000, 'No coupons!');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        const $coupons = $('div.bs-bet-item-bg-c-bc');
        $coupons.each(function () {
            const $this = $(this);
            const match = $this.find('span.bs-bet-i-h-title-bc-text').trt();
            let localCoef = $this.find('span.bs-bet-i-b-coefficient-bc').trt();
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
                const littleDif = nCheck - totalCoef;
                if (littleDif <= 0.05) {
                    return `Coefs fine! here: ${totalCoef}, need: ${nCheck}/${data[0].coef}, dif:${littleDif}`;
                } else {
                    throw `LOW_COEF ${nCheck}, ${data[0].coef} > ${totalCoef}`;
                }
            } else {
                return `Coefs fine! here: ${totalCoef}, need: ${nCheck}/${data[0].coef}`;
            }
        } else {
            throw errors.join('; ') + (checked !== data.length ? ` some stakes not checked (${checked}/${data.length})!` : '');
        }
    };

    const openCoupon = async paramData => {
        dLog('green', 'OLYBET', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'OLYBET', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'OLYBET', 'Event must be opened!');
            const $element = await getBetElement(data);
            await delayPromise(333);
            console.log('$element ', $element);
            await mouseChain({target: $element[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(333);
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
            if (!await eventsWork('OLYBET', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'OLYBET',
                    `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                    + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
            }
        }

        let willPlace = parseFloat(data[0].stake);
        const checkSuccess = async () => {
            // Please wait while your bet is placed
            await waitForCondition(() => $('span:textEquals("Bet success")').length > 0,
                300, 33000, 'No success!');
            return true;
        };
        const checkBalance = async willPlace => {
            if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };
        const $firstBet = () => $('div.bet-history-t-holder-hk-bc:first');

        if (!willPlace) {
            throw`Bad will place: ${willPlace}, ${data[0].stake}`;
        }

        await closePreviousCoupons();
        await checkBalance(willPlace);
        await openCoupon(data);
        do {
            await checkCoefs(data);
            const place = willPlace.toString().replace('.00', '').trim();
            console.log('place ', place);
            const $input = () => $('input.bs-bet-i-b-s-i-bc');
            dLog('green', 'OLYBET', `Will place (performBet): ${place}`);

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
                await delayPromise(777);
                dLog('green', 'OLYBET', `STAKE entered ${willPlace}`);
            }

            const entered = parseFloat($input().val());
            dLog('green', 'OLYBET', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);

            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'OLYBET', 'Entered !== willPlace - try to reenter!');
                continue;
            }

            await delayPromise(888);
            const $placeBtn = $('button[title="Bet Now"]');

            if ($placeBtn.length === 0 || $('button[title="Bet Now"]').attr('disabled')) {
                throw 'No place button or button disabled!';
            }

            await mouseChain({target: $placeBtn[0], events: fullClick, error: '$placeBtn'});
        } while (!await checkSuccess());
        
        await delayPromise(777);
        await mouseChain({target: $('div[title="Open Bets"]')[0], events: fullClick, error: 'my bets'});
        await delayPromise(333);
        await waitForCondition(() => $('div.bet-history-t-holder-hk-bc:first').length > 0, 333, 10000, 'no display open bets');

        const response = {
            success: true,
            message: {
                external_id: $firstBet().find('p.bet-history-id').trt().replace(/[^\d.]/g, ''),
                coef: $firstBet().find('b.bet-history-odds-coeff').trt(),
                stake: $firstBet().find('b.bet-history-stake-money').trt().replace(/[^\d.]/g, ''),
                max: '7777777',
            },
        };

        await mouseChain({target: $('div[title="BetSlip"]')[0], events: fullClick, error: 'bet slip'});

        return response;
    };

    const collectBetResultsSports = async (data, balance) => {
        let collected = [];
        let stopSearch = false;
        
        if (data.length === 0) {
            return {success: true, message: collected};
        }

        const betContent = 'div.betHistoryList-tbody';
        const $openBets = () => $('div[title="Open Bets"]');
        const $period = () => $('div.u-i-p-control-item-holder-bc:eq(3)');

        if ($openBets().hasClass('active') === false) {
            await mouseChain({target: $openBets()[0], events: fullClick, error: '$openBets'});
            await delayPromise(1777);
        }

        // go to history
        const $goToHistory = await waitForElement('div.open-bets-bet-history-btn span',
            333, 7777);
        await mouseChain({target: $goToHistory[0], events: fullClick, error: '$goToHistory'});
        await delayPromise(333);
        await waitForElement('div.u-i-p-c-body-bc',
            333, 8888);
        await delayPromise(1111);

        // switch period
        await mouseChain({target: $period().find('i.form-control-icon-bc')[0], events: fullClick, error: 'open period'});
        await delayPromise(1555);
        await mouseChain({target: $period().find('label[data-option-value="720"]')[0], events: fullClick, error: '30 days'});
        await delayPromise(1555);
        await mouseChain({target: $('button[title="Show"]')[0], events: fullClick, error: 'Show'});
        await waitForElement(betContent,
            333, 12222);
        await delayPromise(555);

        for (let i=0; i<5; i++) {
            await $(betContent).eachAsync(async function (idx) {
                if (collected.length === data.length) {
                    stopSearch = true;
                    return false;
                }
                const
                    $this = $(this),
                    betId = $this.find('p.betHistory-Id').trt().replace(/[^\d.]/g, '');

                    if (data.indexOf(betId) > -1) {
                        const betStatus = $this.find('p.bethistoryListEl-item-status').trt();
                        const stake = $this.find('b.bet-history-stake-money').trt().replace(/[^\d.]/g, '');
                        let status = 'REFUNDED';
                        // expand bet
                        await mouseChain({target: $this.find('i.bc-i-small-arrow-down')[0], events: fullClick, error: 'Expand bet'});
                        await delayPromise(555);
                        await waitForCondition(() => $(betContent).eq(idx).next().find('span.bet-history-match-info-score:eq(1)').length > 0, 300, 7777, 'no display open bet')
                            .catch(() => $([]));
                        const result = $this.next().find('span.bet-history-match-info-score:eq(1)').trt();
                        // close bet
                        await mouseChain({target: $this.find('i.bc-i-small-arrow-up')[0], events: fullClick, error: 'Close bet'});
                        await delayPromise(777);

                        if (betStatus === 'Won') {
                            status = 'WON';
                        } else if (betStatus === 'Lost') {
                            status = 'LOSE';
                        } else if (betStatus === 'Unsettled') {
                            status = 'ACCEPTED'
                        }

                        collected.push({
                            external_id: betId,
                            status,
                            stake: stake,
                            result: status === 'ACCEPTED' ? '' : result,
                        });
                    }
            });
            
            if (stopSearch) {
                break;
            } else {
                $(betContent).eq($(betContent).length - 1)[0].scrollIntoView();
                await delayPromise(1555);
            }
        }
        await mouseChain({target: $('div.popup-inner-bc i.bc-i-close-remove:visible')[0], events: fullClick, error: 'Close popup history'});

        return {success: true, message: collected};
    };

    const sportProcessor = command => {
        dLog('green', 'OLYBET', `SportProcessor: ${command.action}`);
        if (sportCommands.exists(command.action)) {
            // Hint: execute command
            ourCommand.set(command);
            sportCommands.execute(command.action, command.data, command.balance)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'OLYBET', ['Unknown Sport command:', command]);
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
            dLog('green', 'OLYBET', [command, data]);
            const res = await this.cLinks[command](data, balance)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'OLYBET', [`${command} sports result was set:`, res]);
            await bMess('OlybetSportResult').set(res);
            return res;
        }
    };

    const executeSportCommand = async (data, command, balance) => {
        dLog('green', 'OLYBET', `executeSportCommand: ${command}, ${balance}`);
        await bMess('OlybetSportCommand').set({action: command, data, balance});
        dLog('yellow', 'OLYBET', `Start waiting for command: ${command}`);

        return await bMess('OlybetSportResult', false)
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
                dLog('orange', 'OLYBET', [`execute, settings:`, settings]);
                currentBetData.data[0].betFromParser = true;
            }
            const res = await this.cLinks[command](data, command, getBalance()).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'OLYBET', [`${command} result:`, res]);
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
                    await eventsWork('OLYBET', settings,
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
                    resultData.bookmaker = 'OLYBET';
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
        dLog('green', 'OLYBET', [`messageProcessor (${busy})`, message]);
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
            dLog('green', 'OLYBET', ['Command was set till unload:', ourCommand.get()]);
            bMess('OLYBET_COMMAND', true).set(ourCommand.get(), increaseDelay ? 130000 : 0);
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
            bMess('OLYBET_COMMAND', true).check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'OLYBET', [
                        `Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand
                    ]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'OLYBET', 'No command!'));
        } else if (document.location.href.indexOf('nw.olybet.lt/en/sports') > -1) {
            (async () => {
                while (!stopSports) {
                    const csc = await bMess('OlybetSportCommand').check(10000, true)
                        .catch(() => null);
                    if (csc !== null) {
                        sportProcessor(csc);
                    }
                    await delayPromise(500);
                }
            })();
            dLog('green', 'OLYBET', 'Sport processor initialized!');
        }
    }
})();
