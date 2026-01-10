(() => {
    'use strict';

    const isMain = window.self === window.top;

    let limited = false;
    let wasAuthCheck = false;
    let busy = false;
    let increaseDelay = false;
    let ExtID = 0;

    const port = isMain ? chrome.runtime.connect({name: 'port_betsafe'})
        : {postMessage: (...args) => console.log(args)};
    const settings = {
        authCheckInterval: 2000,
        url: 'https://betsafe.lt',
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
        'FOOTBALL': 'football',
        'TENNIS': 'tennis',
        'HOCKEY': 'ice-hockey',
        'BASKETBALL': 'basketball',
    };

    const accordanceCyber = {
        'CS': 'Counter-Strike',
        'Dota 2': 'Дота 2',
    };

    function getBalance(returnNull) {
        const $b = $('span.user-balance__numbers');
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.trt().replace(/[^\d.]/g, ''));
    };

    const authCheck = () => {
        (async () => {
            await closeAllWeNeed({
                'button#gdpr-snackbar-accept': 'button#gdpr-snackbar-accept',
            });

            port.postMessage({
                m: "authorized!",
                balance: getBalance(true),
                limited: limited
            });
        })()
            .catch(e => dLog('red', 'BETSAFE', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    const closePreviousCoupons = async () => {
        const $closeCoupon = $('div.wbs-removeAll__text');
        if ($closeCoupon.length > 0) {
            await mouseChain({
                target: $('div.wbs-removeAll__text')[0], events: fullClick, error: 'close coupon'
            });
            await delayPromise(555);
        }
    };

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 85;
        dLog('green', 'BETSAFE', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const checkTeams = (selector, eventName) => {
        const
            $teams = $(selector).find('a'),
            team1 = $teams.eq(0).trt(),
            team2 = $teams.eq(1).trt(),
            checkEvent = `${team1} - ${team2}`;
        return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
    }

    const openEvent = async data => {
        dLog('red', 'BETSAFE', ['openEvent', data]);
        let $el = $([]);
        const 
            eventName = `${data.team1.trim()} - ${data.team2.trim()}`,
            sport = accordance[data.sport],
            events = '.wel-tournament div.wel-teams';
        const switchType = async () => {
            await mouseChain({target: $('.nav-header a[href="/en/live-betting"]:visible')[0], events: fullClick, error: 'TYPE'});
            await delayPromise(999);
        };
        const switchToSport = async sport => {
            const $sportTab = await waitForElement(`a[href="/en/live-betting/${sport}"]`, 333, 5555);
            await dClick($sportTab[0], false, 'SPORT TAB');
            await delayPromise(999);
        };
        const checkWeAreThere = function () {
            return checkTeams('div.wlet-team__text', eventName);
        };
        const findInRow = (event) => {
            return checkTeams(event, eventName);
        };
        const findEvent = async () => {
            await switchType(data.type);
            await switchToSport(sport);

            for (let i = 0; i < 5; i++) {
                const check = $(events).toArray().find(findInRow);
                if (check) {
                    $el = $(check);
                    break;
                }
                $(events).last()[0].scrollIntoView();
                await delayPromise(1777);
            }
        };

        if (!sport) {
            throw 'No sport found!';
        }

        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }

        await findEvent();

        if ($el.length === 0) {
            throw 'Event not found!';
        }

        // go to event page
        await dClick($el[0], false, 'EVENT CLICK');
        await delayPromise(222);

        return 'Switched to event!';
    };

    const openCoupon = async paramData => {
        dLog('green', 'BETSAFE', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'BETSAFE', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'BETSAFE', 'Event must be opened!');
            const $element = await getBetElement(data);
            await mouseChain({target: $element[0], events: fullClick, scroll: true, error: '$element'});
            await delayPromise(500);
        }
    };

    const getBetElement = async betIn => {
        const bet = JSON.parse(JSON.stringify(betIn));
        const marketsEls = 'div.wol-market';
        //#-#-START
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    tabs: ['Main'],
                    roots: ['2-3 Way'],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    tabs: ['Main'],
                    roots: ['2-3 Way'],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    tabs: ['Main'],
                    roots: ['2-3 Way'],
                    pivotKeys: ['X',],
                },
                'ONE_DRAW': {
                    tabs: ['Main'],
                    roots: ['Double chance'],
                    pivotKeys: ['1X',],
                },
                'TWO_DRAW': {
                    tabs: ['Main'],
                    roots: ['Double chance'],
                    pivotKeys: ['X2',],
                },
                'ONE_TWO': {
                    tabs: ['Main'],
                    roots: ['Double chance'],
                    pivotKeys: ['12',],
                }
            },
            'TOTAL': {
                'OVER': {
                    tabs: ['Totals'],
                    roots: ['Totals', 'Asian Totals'],
                    pivotKeys: ['OVER  #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Totals'],
                    roots: ['Totals', 'Asian Totals'],
                    pivotKeys: ['UNDER  #PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tabs: ['Totals'],
                    roots: ['Home Totals', ],
                    pivotKeys: ['#TEAM1# OVER  #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Totals'],
                    roots: ['Home Totals',],
                    pivotKeys: ['#TEAM1# UNDER  #PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tabs: ['Totals'],
                    roots: ['Away Totals', ],
                    pivotKeys: ['#TEAM2# OVER  #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Totals'],
                    roots: ['Away Totals', ],
                    pivotKeys: ['#TEAM2# OVER  #PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    tabs: ['Totals'],
                    roots: ['Corners Total',],
                    pivotKeys: ['Corners total OVER  #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Totals'],
                    roots: ['Corners Total',],
                    pivotKeys: ['Corners total UNDER  #PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    tabs: ['Handicaps'],
                    roots: ['Handicaps', 'Asian Spreads', ],
                    pivotKeys: ['#TEAM1#  (#HPIVOT#)'],
                },
                'AWAY': {
                    tabs: ['Handicaps'],
                    roots: ['Handicaps', 'Asian Spreads', ],
                    pivotKeys: ['#TEAM2#  (#HPIVOT#)'],
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
            this.addTo('tabs', '1st Half');
            switch (bet.market) {
                case 'ONE_TWO':
                    this.addReplIn('roots', '2-3 Way', '1st Halftime Results');
                    break;
                case 'HDP':
                    this.addReplIn('roots', 'Handicaps', '1st Halftime Handicap');
                    this.addReplIn('roots', 'Asian Spreads', '1st Halftime Asian Spread');
                    break;
                case 'TOTAL':
                    this.addReplIn('roots', 'Totals', '1st Halftime Total');
                    this.addReplIn('roots', 'Asian Totals', '1st Halftime Asian Totals');
                    break;
                case 'T1_TOTAL':
                    this.addReplIn('roots', 'Home Totals', '1st Halftime Home Totals');
                    break;
                case 'T2_TOTAL':
                    this.addReplIn('roots', 'Away Totals', '1st Halftime Away Totals');
                    break;
            }
        };
        params.proceed_tennis = function (bet) {
            const
                sets = ['First set', 'Second set', 'Third set', 'Fourth set'],
                repls = {
                    'ONE_TWO': 'Winner',
                    'HDP': 'Game handicap',
                    'TOTAL': 'Total games',
                };
            this.addTotal('tabs', ['ALL']);
            if (!this.full) {
                const s = sets[this.tDigit - 1];
                console.log('%c' + `${this.tDigit}`,
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                //Game handicap
                if (bet.time_value.indexOf('SET') > -1 && bet.time_value.indexOf('GAME') > -1) {
                    const parts = bet.time_value.split('_GAME_');
                    if (Object.keys(repls).indexOf(bet.market) > -1) {
                        this.addTotal('roots', [`${s} game ${parts[1]} - ${repls[bet.market].toLowerCase()}`]);
                    }
                } else {
                    if (Object.keys(repls).indexOf(bet.market) > -1) {
                        this.addTotal('roots', [`${s} - ${repls[bet.market].toLowerCase()}`]);
                    }
                }
            } else {
                if (Object.keys(repls).indexOf(bet.market) > -1) {
                    this.addTotal('roots', [repls[bet.market].toLowerCase()]);
                }
                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', '#TEAM1# total', '#TEAM1# total games');
                } else if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# total', '#TEAM2# total games');
                }
            }
        };
        params.proceed_basketball = function (bet) {
            const
                quarters = ['First quarter - ', 'Second quarter - ', 'Third quarter - ', 'Fourth quarter - '],
                quarter = quarters[this.tDigit - 1];
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', '1x2', quarter + '1x2');
                } else if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Handicap', quarter + 'handicap');
                } else if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total', quarter + 'total');
                }
            } else {
                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Handicap', 'Handicap (incl. overtime)');
                } else if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total', 'Total (incl. overtime)');
                } else if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', '#TEAM1# total', '#TEAM1# total (incl. overtime)');
                } else if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# total', '#TEAM2# total (incl. overtime)');
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
            const maps = ['First map - ', 'Second map - ', 'Third map - ']
            const map = maps[this.tDigit - 1];
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', '1x2', map + 'winner (incl. overtime)');
                } else if (bet.market === 'HDP') {
                    this.addTotal('roots', [map + ' round handicap (incl. overtime)']);
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', [map + 'total kills']);
                    this.addTotal('roots', [map + 'round total (incl. overtime)']);
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', '1x2', 'Winner');
                } else if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Handicap', 'Map handicap');
                } else if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total', 'Total maps');
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
                $pivot = $root.find(`span.wol-odd__info:textEquals("${pvt}")`);
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

        dLog('green', 'BETSAFE', ['Final market is:', m]);

        //select tab
        const tabs = `a.wmf-navbar__item__link:textEquals("${m.tabs[0]}")`;
        await waitForElement(tabs, 333, 5555);
        if (!$(tabs).hasClass('active')) {
            await dClick($(tabs)[0], false, 'BET TABS');
            await delayPromise(1555);
        }
        
        await waitForElement(marketsEls, 333, 5555);

        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () => $(`div.wol-market__header__title:textEquals("${root}")`).closest('div.wol-market');
            if ($root().length === 0) {
                console.log(`No root ${root}`);
                continue;
            }
            // expand if needed
            if ($root().find('div.sb-icon-arrow-up').hasClass('collapsed')) {
                await mouseChain({target: $(tabs)[0], events: fullClick, scroll: true, error: 'EXPAND'});
                await delayPromise(1555);
            }
            $found = $findPivot($root());
            if ($found.length > 0) {
                break;
            }
        }

        if ($found.length === 0) {
            throw `${bet.sport}/${bet.type}/${bet.time_value}/${bet.market}/${bet.target}/${bet.pivot} not found :(`;
        }
        $found.get(0).scrollIntoView(false);
        window.scrollBy(0, -50);
        return $found;
        //#-#-FINISH
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => checkEventName(v.team1.toLowerCase()
            + ' - ' + v.team2.toLowerCase(), match));
        const coupons = 'div.wbs-swipe-container';
        await waitForCondition(() =>  $(coupons).length > 0,
            333, 10000, 'No coupons!');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $(coupons).each(function () {
            const $this = $(this);
            const match = $this.find('div.wbs-stake__event').trt();
            let localCoef = $this.find('div.wbs-stake__odd').trt();
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

    const getFirstBet = async () => {
        const firstRow = 'tr.wbh-table__tbody__tr:first';
        const response = {};
        await dClick($('a[href="/en/bets"]')[0], false, 'HISTORY BET');
        await delayPromise(555);
        await waitForElement(firstRow, 333, 25555);
        await dClick($(firstRow).find('button[data-symbol-name="show_bet"]:visible')[0], false, 'SHOW BET');
        await delayPromise(555);
        await waitForElement('div.wbab-info:visible', 333, 15555);

        response.success = true;
        response.message = {
            external_id: $('div[data-symbol-name="coupon_id"] > span').trt(),
            coef: $('div[data-symbol-name="total_odds"] > span').trt(),
            stake: $('div[data-symbol-name="total_stake"] > span').trt(),
            max: '7777777',
        };
        await dClick($('a[href="/en/bets"]')[0], false, 'CLOSE HISTORY BET');
        await delayPromise(555);

        return response;
    }

    const proceedBet = async (data, command) => {
        let willPlace = parseFloat(data[0].stake);
        const firstBet = 'div.wbsh-item-body:first';
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
            if (!await eventsWork('betsafe', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'STAKE',
                    `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                    + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
            }
        }

        const checkSuccess = async () => {
            // Please wait while your bet is placed
            await waitForCondition(() => $('div.wbsh-item-body__item').length > 0,
                333, 45000, 'No success!');
            return $('div.wbsh-item-body__item').length > 0;
        };
        const checkBalance = async willPlace => {
            const balance = getBalance();
            if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };

        if (!willPlace) {
            throw`Bad will place: ${willPlace}, ${data[0].stake}`;
        }

        await checkBalance(willPlace);
        await closePreviousCoupons();
        await delayPromise(333);
        await openCoupon(data);

        do {
            await checkCoefs(data);
            const place = willPlace.toString().replace('.00', '').trim();
            const $input = () => $('input.wbs-stake__input');
            dLog('green', 'BETSAFE', `Will place (performBet): ${place}`);

            if (parseFloat($input().val()) !== parseFloat(place)) {
                await clearAndSimulateD($input()[0], place);
                await delayPromise(555);
                dLog('green', 'BETSAFE', `STAKE entered ${willPlace}`);
            }

            const entered = parseFloat($input().val());
            dLog('green', 'BETSAFE', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);

            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'BETSAFE', 'Entered !== willPlace - try to reenter!');
                continue;
            }

            const $placeBtn = () => $('button#footerSubmitButton[data-symbol-name="confirm"]');

            if ($placeBtn().length === 0) {
                throw 'No place button or button disabled!';
            }

            $placeBtn()[0].scrollIntoView();
            await delayPromise(777);
            await mouseChain({target: $placeBtn()[0], events: fullClick, scroll: true, error: 'Submit bet'});
        } while (!await checkSuccess());

        await waitForElement(firstBet, 333, 5555);
        const response = {
            success: true,
            message: {
                external_id: ExtID += 1,
                coef: $(firstBet).find('div.wbsh-item-body__item__stake__odd').trt(),
                stake: $(firstBet).find('div.wbsh-item-body__item__stake__amount').trt().replace(/[^\d.]/g, ''),
                max: '7777777',
            }
        };
        await delayPromise(555);

        return response;
    };

    const collectBetResults = async (inD) => {
        return {success: true, message: {}};
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
            dLog(res.success ? 'green' : 'red', 'BETSAFE',
                `${command} result: ${res.message}`);
            await port.postMessage(await this.prepareResult(command, res));
            if (!res?.success) {
                throw res?.message || 'Unknown error';
            }
            return res;
        }

        async prepareResult(command, res) {
            dLog('', 'BETSAFE', [`prepareResult '${command}':`, res, currentBetData,]);
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('betsafe', settings,
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
                    resultData.bookmaker = 'BETSAFE';
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
            ['login', 'password', 'phone', 'email', 'uid',].forEach(k => settings[k] = message[k]);
            if (message.start_url) {
                settings.url = message.start_url;
            }
            dLog(`yellow`, 'BETSAFE', [`messageProcessor auth settings:`, settings,]);
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
            const command = await bMess('BETSAFE').check(40000);
            await waitForCondition(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck), 333, 60000, 'No auth check!');
            bsLogger('green', 'BETSAFE', [`Restoring with (${isMain}): `, command]);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));
        port.postMessage({m: "PAGE LOADED!"});
        console.log('%c' + `BETSAFE loaded and message sent! (${isMain}) ${document.location.href}`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", async () => {
        await ourCommand.save('BETSAFE', increaseDelay ? 150000 : 0);
        bsLogger('green', 'BETSAFE', [`Command was set till unload (${isMain}):`, ourCommand.get()]);
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

})();
