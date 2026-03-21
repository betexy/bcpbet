(() => {
    'use strict';

    const isMain = window.self === window.top;

    let limited = false;
    let wasAuthCheck = false;
    let busy = false;
    let waitSource = false;
    let increaseDelay = false;
    let enterError = false;
    let lang = '';
    let sourceExpress = false;

    const port = isMain ? chrome.runtime.connect({name: 'port_bookmaker'})
        : {postMessage: (...args) => console.log(args)};
    const settings = {
        restartEvery: 1800000,
        authCheckInterval: 2000,
        url: 'https://bookmaker.xyz/polygon/sports',
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
        newExpresses: false,
        source: {
            X: 525,
            Y: 526,
            Z: 527,
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
        'CYBERSPORT': 'cybersport',
    };

    const $coupons = () => $('div[class*="_card"]');

    function getBalance(returnNull) {
        const $b = $('button[aria-label="Menu"].w-full');
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.trt().replace(/\s+/g, ''));
    };

    const getSourceRandom = () => {
        return Math.floor(Math.random() * 30) + 1;
    };

    const getCurrentSource = src => {
        sourceExpress = false;

        if (src >= 1 && src <= 10) {
            return 'X';
        }
        if (src >= 11 && src <= 16) {
            return 'Y';
        }
        if (src === 17) {
            sourceExpress = true;
            return 'XY';
        }
        if (src === 18) {
            return 'XY';
        }
        if (src >= 19 && src <= 20) {
            return 'Z';
        }

        return 'skip';
    };

    const authCheck = () => {
        (async () => {
            if (enterError === true) {
                return;
            }

            await closeAllWeNeed({
                '#modals button[class*="_closeButton"]': '#modals button[class*="_closeButton"]',
            });
            
            const $deposit = await waitForElement('span:textEquals("Deposit")', 222, 17777, true).catch(() => $([]));
            if ($deposit.length === 0) {
                wasAuthCheck = false;
                    port.postMessage({
                    answered: "auth_error",
                    status: "ERROR",
                });
                enterError = true;
                throw 'AUTH ERROR!';
            } else {
                if (settings.lastScoreBasketball === '999') {
                    if (Date.now() - settings.sourceDate >= 300000) {
                        settings.sourceDate = Date.now();
                        settings.sourceRandom = getSourceRandom();
                        if (settings.sourceRandom >= 17 && settings.sourceRandom <= 18) {
                            settings.newExpresses = true;
                            if (settings.sourceRandom >= 17 && settings.sourceRandom <= 18) {
                                settings.newExpressBetsAmount = 1;
                            }
                        } else {
                            waitSource = false;
                            settings.newExpresses = false;
                        }

                        dLog('blue', 'BOOKMAKER', `Source current random value - ${settings.sourceRandom}`);
                    }
                }

                if (settings.newExpresses && !busy) {
                    busy = true;
                    const WasSuccessExpressNew = await bMess('WasSuccessExpressNew').infinite().catch(() => 0);
                    const couponsExist = await waitForCondition(() => $coupons().length > 0,
                        222, 1777).catch(() => $([]));

                    if (WasSuccessExpressNew && couponsExist.length === 0) {
                        await bMess('WasSuccessExpressNew').remove();
                    }

                    if (!WasSuccessExpressNew) {
                        dLog('green', 'BOOKMAKER', 'START find NewExpress event!');
                        // clear coupons
                        if ($coupons().length > 0) {
                            await closePreviousCoupons(false);
                        }

                        waitSource = false;
                        await ProccedExpressNew().catch((e) => {
                            dLog('red', 'BOOKMAKER', 'ProccedExpressNew Error - ' + e);
                            bMess('WasSuccessExpressNew').set(false);
                        });                        
                    }
                    busy = false;
                }

                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                    limited: limited
                });
            }
        })()
            .catch(e => dLog('red', 'BOOKMAKER', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    const closePreviousCoupons = async (state) => {
        const $closeCoupon = $('use[href="#interface/delete"]');
        const $closeBtns = () => $('use[href="#interface/close"]');
        if ($closeCoupon.length > 0) {
            if (state) {
                for (let i=0; i<$closeBtns().length; i++) {
                    if ($closeBtns().length > settings.newExpressBetsAmount) {
                        await mouseChain({target: $closeBtns().last()[0], events: fullClick, error: 'closeCoupon'});
                        await delayPromise(555);
                    }
                }
            } else {
                await mouseChain({target: $closeCoupon[0], events: fullClick, error: '$closeCoupon'});
                await delayPromise(555);
            }
        }
    };

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 65;
        dLog('green', 'BOOKMAKER', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const checkFirstEvent = (firstBet, dataEvent) => {
        const curEvent = $(firstBet).find('div[data-testid="participants-title"]').trt();

        return checkEventName(curEvent, dataEvent);
    };

    const openEvent = async data => {
        dLog('red', 'BOOKMAKER', ['openEvent', data]);
        const timeCnd = data.type === 'LIVE' 
                ? ':has(span:textEquals("Live"))' 
                : ':not(:has(span:textEquals("Live")))';
        const
            eventName =
                `${data.team1.replaceAll(/\(.*\)/g, '').trim()} – ${data.team2.replaceAll(/\(.*\)/g, '').trim()}`
                .toLowerCase(),
            searchWord = [data.team1, data.team2]
                .flatMap(t => t.replaceAll(/\(.*\)/g, '').trim().split(/\s+/))
                .find(w => w.length >= 4) || data.team1.replaceAll(/\(.*\)/g, '').trim().split(/\s+/)[0],
            searchInput = 'input[inputmode="search"]',
            $events = (timeCnd) => $(`#modals a.block${timeCnd}`);
        let 
            sport = accordance[data.sport],
            eventIndex = -1;

        if (!sport) {
            throw 'No sport found!';
        }

        const checkWeAreThere = function () {
            const checkEvent = $('div[class*="_box"] > div:eq(1) > div:last()').trt().toLowerCase();
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };
        
        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }

        const findEvent = async () => {
            let idx = 0;

            if ($(searchInput).length === 0) {
                await mouseChain({
                    target: $('div:textEquals("Search sport, league, event or team")').closest('button')[0], 
                    events: fullClick, error: '$searchButton', 
                    scroll: true,
                });
                await waitForElement(searchInput, 300, 5555, true);
            }

            await clearAndSimulate($(searchInput)[0], searchWord, false, false, true);
            await waitForElement('#modals a.block', 300, 7777);
            await delayPromise(333);

            $events(timeCnd).each(function () {
                const checkEvent = $(this).find('div[data-testid="participants-title"]').trt().toLowerCase();
                dLog('blue', 'BOOKMAKER', `Check: '${checkEvent}' === '${eventName}'`);
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
        const $el = $events(timeCnd).eq(eventIndex);
        await mouseChain({target: $el[0], events: fullClick, error: 'EVENT', scroll: true,});
        await waitForCondition(checkWeAreThere,
            500, 15000, 'We are not on event!');
        await delayPromise(222);

        return 'Switched to event!';
    };

    const openCoupon = async paramData => {
        dLog('green', 'BOOKMAKER', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'BOOKMAKER', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'BOOKMAKER', 'Event must be opened!');
            const $element = await getBetElement(data);
            await delayPromise(555);
            console.log('$element: ', $element);
            await mouseChain({target: $element[0], events: fullClick, error: '$el openCoupon', scroll: true});
            await delayPromise(333);
        }
    };

    const getBetElement = async betIn => {
        const bet = JSON.parse(JSON.stringify(betIn));
        //#-#-START
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Full Time Result'],
                    pivotKeys: ['1'],
                },
                'TWO': {
                    roots: ['Full Time Result'],
                    pivotKeys: ['2'],
                },
                'DRAW': {
                    roots: ['Full Time Result'],
                    pivotKeys: ['X'],
                },
                'ONE_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['1X'],
                },
                'TWO_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['2X'],
                },
                'ONE_TWO': {
                    roots: ['Double Chance'],
                    pivotKeys: ['12'],
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['Total Goals'],
                    pivotKeys: ['Over (#PIVOT#)'],
                },
                'UNDER': {
                    roots: ['Total Goals'],
                    pivotKeys: ['Under (#PIVOT#)'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['Team 1 - Total Goals'],
                    pivotKeys: ['Over (#PIVOT#)'],
                },
                'UNDER': {
                    roots: ['Team 1 - Total Goals'],
                    pivotKeys: ['Under (#PIVOT#)'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['Team 2 - Total Goals'],
                    pivotKeys: ['Over (#PIVOT#)'],
                },
                'UNDER': {
                    roots: ['Team 2 - Total Goals'],
                    pivotKeys: ['Under (#PIVOT#)'],
                },
            },
            'HDP': {
                'HOME': {
                    roots: ['Handicap'],
                    pivotKeys: ['Team 1 (#HPIVOT#)'],
                },
                'AWAY': {
                    roots: ['Handicap'],
                    pivotKeys: ['Team 2 (#HPIVOT#)'],
                }
            },
        };
        if (typeof markets[bet.market] === 'undefined' || typeof markets[bet.market][bet.target] === 'undefined') {
            throw `Unsupported ${bet.time_value} / ${bet.market} / ${bet.target}`;
        }

        let $found = $([]);
        const params = new AllMarkets(bet);
        params.proceed_football = function (bet) {
            if (this.full) {
                return;
            }
            switch (bet.market) {
                case 'ONE_TWO':
                    const head = ['ONE', 'TWO', 'DRAW'].indexOf(bet.target) > -1
                        ? '1st Half - Winner' : '1st Half - Double Chance';
                    this.addReplIn('roots', 'Full Time Result', head);
                    break;
                case 'TOTAL':
                    this.addReplIn('roots', 'Total Goals', '1st Half - Total Goal');
                    break;
            }
        };
        params.proceed_tennis = function (bet) {
            if (this.full) {
                switch (bet.market) {
                    case 'ONE_TWO':
                        this.addReplIn('roots', 'Full Time Result', 'Match Winner');
                        break;
                    case 'TOTAL':
                        this.addReplIn('roots', 'Total Goals', 'Total Games');
                        break;
                    case 'T1_TOTAL':
                        this.addReplIn('roots', '#TEAM1# total', 'Player 1 - Total Games');
                        break;
                    case 'T2_TOTAL':
                        this.addReplIn('roots', '#TEAM2# total', 'Player 2 - Total Games');
                        break;
                    case 'HDP':
                        this.addReplIn('roots', 'Handicap', 'Handicap Games');
                        break;
                }
            } else {
                const sets = ['1st set', '2nd set', '3rd set', '4th set'];
                const s = sets[this.tDigit - 1];
                console.log('%c' + `${this.tDigit}`,
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                switch (bet.market) {
                    case 'ONE_TWO':
                        this.addReplIn('roots', 'Full Time Result', `${s} Set: Winner`);
                        break;
                    case 'TOTAL':
                        this.addReplIn('roots', 'Total Goals', `${s} Set: Total Games`);
                        break;
                    case 'HDP':
                        this.addReplIn('roots', 'Handicap', `${s} Set: Handicap Games`);
                        break;
                }
            }
        };
        params.proceed_basketball = function (bet) {
            if (this.full) {
                switch (bet.market) {
                    case 'ONE_TWO':
                        this.addReplIn('roots', 'Full Time Result', 'Match Winner');
                        break;
                    case 'TOTAL':
                        this.addReplIn('roots', 'Total Goals', 'Total Points incl. OT');
                        break;
                    case 'T1_TOTAL':
                        this.addReplIn('roots', '#TEAM1# total', 'Team 1 - Total Games');
                        break;
                    case 'T2_TOTAL':
                        this.addReplIn('roots', '#TEAM2# total', 'Team 2 - Total Games');
                        break;
                    case 'HDP':
                        this.addReplIn('roots', 'Handicap', 'Handicap incl. OT');
                        break;
                }
            } else {
                const sets = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];
                const s = sets[this.tDigit - 1];
                console.log('%c' + `${this.tDigit}`,
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                switch (bet.market) {
                    case 'ONE_TWO':
                        this.addReplIn('roots', 'Full Time Result', `${s}: Winner`);
                        break;
                    case 'TOTAL':
                        this.addReplIn('roots', 'Total Goals', `${s}: Total`);
                        break;
                    case 'HDP':
                        this.addReplIn('roots', 'Handicap', `${s}: Handicap`);
                        break;
                }
            }
        };
        params.proceed_hockey = function (bet) {
            if (!this.full) {
                const sets = ['1st Period:', '2nd Period:', '3rd Period:', '4th Period:'];
                const s = sets[this.tDigit - 1];
                console.log('%c' + `${this.tDigit}`,
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                switch (bet.market) {
                    case 'ONE_TWO':
                        this.addReplIn('roots', 'Full Time Result', `${s} Full Time Result`);
                        break;
                    case 'TOTAL':
                        this.addReplIn('roots', 'Total Goals', `${s} Total Goals`);
                        break;
                    case 'HDP':
                        this.addReplIn('roots', 'Handicap', `${s} Handicap`);
                        break;
                }
            }
        };
        params.proceed_cybersport = function (bet) {
            if (!this.full) {
                const sets = ['Map 1 - ', 'Map 2 - ', 'Map 3 - ', 'Map 4 - '];
                const s = sets[this.tDigit - 1];
                console.log('%c' + `${this.tDigit}`,
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                switch (bet.market) {
                    case 'ONE_TWO':
                        this.addReplIn('roots', 'Full Time Result', `${s}Winner`);
                        break;
                    case 'TOTAL':
                        this.addReplIn('roots', 'Total Goals', `${s}Total Kills`);
                        break;
                    case 'HDP':
                        this.addReplIn('roots', 'Handicap', `${s}Kill Handicap`);
                        break;
                }
            } else {
                switch (bet.market) {
                    case 'ONE_TWO':
                        this.addReplIn('roots', 'Full Time Result', 'Match Winner');
                        break;
                    case 'TOTAL':
                        this.addReplIn('roots', 'Total Goals', 'Total Maps');
                        break;
                    case 'HDP':
                        this.addReplIn('roots', 'Handicap', 'Maps Handicap');
                        break;
                }
            }
        };
        const final = applyAllMarkets(bet, ['roots', 'pivotKeys'], params, markets, true);
        const m = final[bet.market][bet.target];
        const hPivot = pvt => {
            return parseFloat(pvt) === 0 ? '0' : pvt;
        };
        const $findPivot = $root => {
            let $res = $([]);
            for (const pvt of m.pivotKeys) {
                console.log(`Checking pivot: '${pvt}'`);
                let $pivot = $([]);
                $pivot = $root.find(`div[data-testid="bet-button-outcome"]:textEquals("${pvt}")`);
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

        dLog('green', 'BOOKMAKER', ['Final market is:', m]);

        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () => $(`h2:textEquals("${root}")`);
            const $rootExist = await waitForCondition(() => $root().length > 0, 222, 5555).catch(() => $([]));

            if ($rootExist.length === 0) {
                console.log(`No root ${root}`);
                continue;
            }

            // expand market block
            if ($root().closest('div.xblock').find('div[role="button"]').next().length === 0) {
                await mouseChain({
                    target: $root().closest('div.xblock').find('div[role="button"]')[0], 
                    events: fullClick, 
                    error: 'Double Chance', 
                    scroll: true,
                });
                await delayPromise(2222);
            }

            $found = $findPivot($root().closest('div.xblock').find('div[role="button"]').next());
            if ($found.length > 0) {
                break;
            }
        }

        if ($found.length === 0) {
            throw `${bet.sport}/${bet.type}/${bet.time_value}/${bet.market}/${bet.target}/${bet.pivot} not found :(`;
        }

        return $found;
        //#-#-FINISH
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => checkEventName(v.team1.toLowerCase()
            + ' - ' + v.team2.toLowerCase(), match));
        await waitForCondition(() => $coupons().length > 0,
            333, 10000, 'No coupons!');
        await delayPromise(333);
        await waitForCondition(() => $coupons().eq(0).find('div[class*="_container"]').length > 0,
            333, 5555, 'No coef!');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        const $couponsCoefs = (data.length === 1 && settings.newExpresses === true)
            ? $coupons().last()
            : $coupons();
        $couponsCoefs.each(function () {
            const $this = $(this);
            const match = $this.find('span.text-label').trt();
            let localCoef = decOdds($this.find('div[class*="_container"]').trt());
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
        const $coefs = () => $('div[data-testid="game-row"] button[data-testid="bet-button"]');
        const currentBets = [];

        // go to football tab
        await mouseChain({target: $('div.navSidebar a[href="/polygon/sports"]')[0], events: fullClick, error: 'Sports'});
        await delayPromise(999);
        await mouseChain({target: $('div.no-scrollbar a[href="/polygon/sports/football"]')[0], events: fullClick, error: 'Sports football'});
        await delayPromise(333);
        const $sixHours = await waitForElement('main button:textEquals("6h")', 300, 12222, true);
        await mouseChain({target: $sixHours[0], events: fullClick, error: '6h'});
        await delayPromise(999);
        $('h2:textEquals("All Football events")').get(0).scrollIntoView();

        await waitForCondition(() => $coefs().length > 0,
            333, 7777, 'No builder events24!');
        await delayPromise(1999);

        const findOption = coef => {
            return isNaN(coef) ? false : coef >= 1.01 && coef <= 1.15;
        };

        const getUniqueRandomNumber = (length) => {
            return Math.floor(Math.random() * length);
        }

        do {
            const randomCoef = getUniqueRandomNumber($coefs().length);
            const eventName = $coefs().eq(randomCoef)
                .closest('[data-testid="game-row"]')
                .find('div[data-testid="participants-title"]').trt();

            if (currentBets.indexOf(eventName) > -1) {
                continue;
            }

            if (eventName.length < 5) {
                dLog('red', 'BOOKMAKER', `'${eventName}' is too short - ${eventName.length}`);
                continue;
            }

            if (used[eventName] >= 1) {
                dLog('big-yellow', 'BOOKMAKER', `${eventName} used ${used[eventName]} times!`);
                continue;
            }

            if (!$coefs().eq(randomCoef).hasClass('null')) {
                continue;
            }

            if (!findOption(decOdds($coefs().eq(randomCoef).find('div[class*="_container"]').trt()))) {
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
            dLog('green', 'BOOKMAKER', [`We get selected bets: '${currentBets}', now used:`, used]);
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
        const currentEvent = data[0].team1 + ' – ' + data[0].team2;
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
            if (!await eventsWork('BOOKMAKER', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'BOOKMAKER',
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
        const $cutDialog = () => $('div[role="dialog"]:has(div:textEquals("Oops! Something went wrong"))');
        const checkSuccess = async () => {
            // Wait for coupons to disappear OR cut dialog to appear
            await waitForCondition(() => $coupons().length === 0 || $cutDialog().length > 0,
                333, 45000, 'No success!'
            );
            // Check if cut dialog appeared (account restricted)
            if ($cutDialog().length > 0) {
                const $dialog = $cutDialog();
                const errorText = $dialog.find('pre').text().trim();
                dLog('red', 'BOOKMAKER', `[CUT] Account cut detected: ${errorText}`);
                port.postMessage({
                    m: 'FARM_CUT_DETECTED',
                    cutInfo: {
                        reason: 'bet_rejected',
                        error_text: errorText.substring(0, 200),
                        bk: 'BOOKMAKER',
                        timestamp: Date.now()
                    }
                });
                // Close the dialog by clicking "Ok"
                const $okBtn = $dialog.find('button:has(span:textEquals("Ok"))');
                if ($okBtn.length > 0) {
                    await mouseChain({target: $okBtn[0], events: fullClick, error: 'Close cut dialog'});
                    await delayPromise(500);
                }
                throw 'ACCOUNT_CUT - Bet rejected: ' + errorText;
            }
            return $coupons().length === 0;
        };
        const checkBalance = async willPlace => {
            const balance = getBalance();
            if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };
        const firstBet = 'div[data-bet-id]:first';

        if (!willPlace) {
            throw`Bad will place: ${willPlace}, ${data[0].stake}`;
        }

        await checkBalance(willPlace);
        await closePreviousCoupons(settings.newExpresses ? true : false);
        await delayPromise(333);

        //if sourceExpress check coupon for events
        if (sourceExpress && settings.lastScoreBasketball === '999') {
            if ($coupons().length !== 1) {
                throw 'Error Express source BET, No 1 event in coupon!';
            }
        }

        await openCoupon(data);

        if (settings.newExpresses && $coupons().length < settings.newExpressBetsAmount + 1) {
            throw `less than ${settings.newExpressBetsAmount + 1} events in the newExpresses`;
        }

        do {
            await checkCoefs(data);
            const place = willPlace.toString().replace('.00', '').trim();
            const $input = () => $('input[data-testid="betslip-input"]');
            dLog('green', 'BOOKMAKER', `Will place (performBet): ${place}`);

            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }

            if (parseFloat($input().val()) !== parseFloat(place)) {
                await clearAndInputNumber($input()[0], place);
                await delayPromise(333);
                dLog('green', 'BOOKMAKER', `STAKE entered ${willPlace}`);
            }

            const entered = parseFloat($input().val());
            dLog('green', 'BOOKMAKER', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'BOOKMAKER', 'Entered !== willPlace - try to reenter!');
                continue;
            }

            const $placeBtn = $('button[data-testid="place-bet-button"]');

            if ($placeBtn.length === 0) {
                throw 'No place button or button disabled!';
            }

            await delayPromise(333);
            await mouseChain({target: $placeBtn[0], events: fullClick, error: '$placeBtn'});
        } while (!await checkSuccess());

        await delayPromise(333);
        await mouseChain({
            target: $('div[data-testid="cart-mybets-tab"]')[0],
            events: fullClick,
            error: 'Active bets'
        });
        await delayPromise(333);
        await waitForElement('a:textEquals("All bets")', 333, 33333, true);
        await delayPromise(333);
        await mouseChain({
            target: $('a:textEquals("All bets")')[0],
            events: fullClick,
            error: 'All bets'
        });
        await delayPromise(333);
        await waitForElement(firstBet, 333, 7555, true);
        await waitForCondition(() => checkFirstEvent(firstBet, currentEvent),
            333, 8888, 'No first event!');

        const oddsLabel = $(firstBet).find('div[data-testid="participants-title"]').length > 1
            ? 'Total odds' : 'Odds';

        const response = {
            success: true,
            message: {
                external_id: $(firstBet)[0].dataset.betId,
                coef: decOdds($(firstBet).find(`div:textEquals("${oddsLabel}")`).next().trt()),
                stake: $(firstBet).find('div:textEquals("Bet amount")').next().trt().replace(/[^\d.]/g, ''),
                max: '7777777',
            },
        };

        // go to betting page
        await mouseChain({
            target: $('a[href="/polygon/sports"]')[0],
            events: fullClick,
            error: 'All bets'
        });

        return response;
    };

    const commands = new class commands {
        constructor() {
            this.cLinks = {
                'BET': proceedBet,
                'EXPRESS_BET': proceedBet,
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
            dLog(res.success ? 'green' : 'red', 'BOOKMAKER',
                `${command} result: ${res.message}`);
            await port.postMessage(await this.prepareResult(command, res));
            if (!res?.success) {
                throw res?.message || 'Unknown error';
            }
            return res;
        }

        async prepareResult(command, res) {
            dLog('', 'BOOKMAKER', [`prepareResult '${command}':`, res, currentBetData,]);
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('BOOKMAKER', settings,
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

                        dLog('BOOKMAKER', 'blue-big',
                            [`We set bet with first: '${currentFirstBet}', now used:`, used]);

                        if (settings.newExpressBetsAmount > 1) {
                            const currentSecondBet = await bMess('currentSecondBet').check(1080000, true);
                            if (!used[currentSecondBet]) {
                                used[currentSecondBet] = 1;
                            }

                            dLog('BOOKMAKER', 'blue-big',
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
                    resultData.bookmaker = 'BOOKMAKERXYZ';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = '525' || 'oddscp';
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
        if (message.action === 'FARM_CHECK_BETS') {
            console.log('[PENDING] Received FARM_CHECK_BETS command, starting checkPendingBets...');
            checkPendingBets()
                .then(count => {
                    console.log(`[PENDING] checkPendingBets returned: ${count}`);
                    port.postMessage({m: 'FARM_PENDING_BETS', count});
                })
                .catch(e => console.log('[PENDING] checkPendingBets error:', e));
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
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
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

                if (settings.sourceRandom >= 15 && settings.sourceRandom <= 19) {
                    settings.newExpresses = true;
                    waitSource = true;
                    if (settings.sourceRandom >= 15 && settings.sourceRandom <= 17) {
                        settings.newExpressBetsAmount = 1;
                    }
                } else {
                    waitSource = false;
                }
                dLog('blue', 'BOOKMAKER', `Source current random value - ${settings.sourceRandom}`);
            }
            dLog(`yellow`, 'BOOKMAKER', [`messageProcessor auth settings:`, settings,]);
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
            const command = await bMess('BOOKMAKER').check(40000);
            await waitForCondition(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck), 333, 60000, 'No auth check!');
            bsLogger('green', 'BOOKMAKER', [`Restoring with (${isMain}): `, command]);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));
        port.postMessage({m: "PAGE LOADED!"});
        console.log('%c' + `BOOKMAKER loaded and message sent! (${isMain}) ${document.location.href}`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", async () => {
        await ourCommand.save('BOOKMAKER', increaseDelay ? 150000 : 0);
        bsLogger('green', 'BOOKMAKER', [`Command was set till unload (${isMain}):`, ourCommand.get()]);
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

    async function checkPendingBets() {
        console.log('[PENDING] checkPendingBets() called');
        try {
            // 1. Open "My Bets" tab in the cart sidebar
            const $myBetsTab = $('div[data-testid="cart-mybets-tab"]');
            console.log(`[PENDING] My Bets tab: ${$myBetsTab.length} elements`);
            let usedDirectUrl = false;
            if ($myBetsTab.length === 0) {
                console.log('[PENDING] My Bets tab not found, navigating to my-bets page directly');
                window.location.href = 'https://bookmaker.xyz/polygon/profile/my-bets';
                usedDirectUrl = true;
                // Wait for bet cards or "no bets" to appear on the profile page
                for (let i = 0; i < 40; i++) {
                    if ($('div[data-bet-id]').length > 0) break;
                    const bodyText = document.body.textContent || '';
                    if (bodyText.includes("don't have bets yet")) break;
                    await delayPromise(500);
                    if (i % 5 === 4) console.log(`[PENDING] Waiting for my-bets page... (${(i + 1) * 500}ms)`);
                }
                await delayPromise(1000);
            } else {
                await mouseChain({target: $myBetsTab[0], events: fullClick, error: 'My Bets tab'});
                await delayPromise(333);

                // 2. Click "All bets" link
                await waitForElement('a:textEquals("All bets")', 333, 15000, true);
                await delayPromise(333);
                await mouseChain({
                    target: $('a:textEquals("All bets")')[0],
                    events: fullClick,
                    error: 'All bets'
                });
                await delayPromise(333);

                // 3. Wait for bet cards to load
                for (let i = 0; i < 30; i++) {
                    if ($('div[data-bet-id]').length > 0) break;
                    const bodyText = document.body.textContent || '';
                    if (bodyText.includes("don't have bets yet")) break;
                    await delayPromise(500);
                    if (i % 5 === 4) console.log(`[PENDING] Waiting for bets... (${(i + 1) * 500}ms)`);
                }
                await delayPromise(1000);
            }

            // 4. Count accepted bets
            let count = 0;
            $('div[data-bet-id]').each(function () {
                const hasAccepted = $(this).find('div.text-inherit').filter(function () {
                    return $(this).text().trim() === 'Accepted';
                }).length > 0;
                if (hasAccepted) count++;
            });
            console.log(`[PENDING] Found ${count} accepted bets`);

            // 5. Click "Redeem all" if button is active (has bg-gradient-primary class)
            const $redeemBtn = $('button:has(span:textEquals("Redeem all"))').filter(function () {
                return $(this).hasClass('bg-gradient-primary');
            });
            if ($redeemBtn.length > 0) {
                console.log('[PENDING] Clicking Redeem all button...');
                await mouseChain({target: $redeemBtn[0], events: fullClick, error: 'Redeem all'});
                console.log('[PENDING] Waiting 15 seconds after Redeem all...');
                await delayPromise(15000);
            } else {
                console.log('[PENDING] No active Redeem all button found');
            }

            // 6. Navigate back to sports page
            console.log('[PENDING] Navigating back to sports...');
            if (usedDirectUrl || $('a[href="/polygon/sports"]').length === 0) {
                window.location.href = 'https://bookmaker.xyz/polygon/sports';
            } else {
                await mouseChain({
                    target: $('a[href="/polygon/sports"]')[0],
                    events: fullClick,
                    error: 'Back to sports'
                });
            }
            await delayPromise(2000);

            return count;
        } catch (e) {
            console.log(`[PENDING] ERROR: ${e}`);
            try {
                if ($('a[href="/polygon/sports"]').length > 0) {
                    await mouseChain({
                        target: $('a[href="/polygon/sports"]')[0],
                        events: fullClick,
                        error: 'Back to sports'
                    });
                } else {
                    window.location.href = 'https://bookmaker.xyz/polygon/sports';
                }
            } catch (e2) {}
            return null;
        }
    }

})();
