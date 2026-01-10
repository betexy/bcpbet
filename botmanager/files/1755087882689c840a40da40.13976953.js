(function () {

    "use strict";

    /**
     * @import libs/jquery-3.3.1.min.js
     */

    let authClickedTime = 0;
    let authClicked = 0;
    let busy = false;
    let increaseDelay = false;
    let stopSports = false;
    let enterError = false;
    let pageLoadedAt = 0;
    let loaded = Date.now();
    const loginSelector = 'span:textEquals("Login")';
    const profile = 'div.input-deposit';
    const port = window.self === window.top
        ? chrome.runtime.connect({name: `port_tether`})
        : {postMessage: () => console.log(arguments)};

    const settings = {
        authCheckInterval: 1555,
        restartEvery: 1800000,
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        url: '',
        login: '',
        password: '',
        stake_fork: {},
        eventTimeLimit: 2400000,
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
        'FOOTBALL': 'football',
        'TENNIS': 'tennis',
        'BASKETBALL': 'basketball',
        'VOLLEYBALL': 'volleyball',
        'HANDBALL': 'handball',
        'BASEBALL': 'Baseball',
        'CYBERSPORT': 'cybersport',
    };

    const accordanceCyber = {
        'CS': 'csgo',
        'LoL': 'lol',
        'Dota2': 'dota2',
    };

    const ourCommand = new ourCommandProto();

    function getBalance(returnNull) {
        const $b = $('.input-deposit div.amount');
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.trt().replace(/[^\d.]/g, ''));
    }

    const authCheck = function () {
        if (!busy && Date.now() - loaded > settings.restartEvery) {
            dLog('bigred', 'tether', 'RELOAD');
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
            await closeAllWeNeed({
                'button.base-modal__close': 'button.base-modal__close',
            });
            const couponBalanceState = await bMess('couponBalanceState')
                .check(1222, true)
                .catch(() => null);
            if (couponBalanceState !== null) {
                document.location.reload();
            }
            const $profile = await waitForElement(profile, 333, 3333).catch(() => $([]));
            if ($(loginSelector).length > 0 && Date.now() - pageLoadedAt < 10000) {
                console.log(`It could be still loading: ${Date.now() - pageLoadedAt}`);
            } else if ($profile.length === 0 && $(loginSelector).length > 0) {
                port.postMessage({m: "tech works! 2"});
                await tryToLogin();
                await delayPromise(555);
            } else {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true)
                });
            }
        })()
            .catch(e => dLog('red', 'tether', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());

        return;
    };

    const tryToLogin = async () => {
        if (Date.now() - authClickedTime < 60000) {
            throw 'too soon!';
        }
        const controls = {
            login: 'input[name="login"]',
            password: 'input[name="password"]',
            submit: 'div.btn-primary:textEquals("Sign in")',
        };
        if (!checkSE(Object.values(controls), true)) {
            await mouseChain({target: $(loginSelector)[0], events: fullClick, error: 'loginSelector'});
            await delayPromise(1555);
        }

        await waitForCondition(() => Object.keys(controls).every(k => $(controls[k]).length > 0),
            333, 10000, 'No controls!');
        await clearAndInputEmail($(controls.login)[0], settings.login);
        await delayPromise(1000);
        await clearAndSimulate($(controls.password)[0], settings.password);
        await delayPromise(1000);
        await mouseChain({target: $(controls.submit)[0], events: fullClick, error: 'l3'});
        authClicked++;
        authClickedTime = Date.now();
        dLog('', 'tether', `Auth clicked ${authClicked}!`);
        await delayPromise(1000);
        const $profile = await waitForElement(profile, 333, 15000).catch(() => $([]));

        if ($profile.length === 0) {
            enterError = true;
            throw 'Auth error!';
        }
    };

    const closePreviousCoupons = async () => {
        const $closeCoupon = $(findSel(['i.iconFont-trash-pro', 'i.iconFont-trash']));
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
                || locutus_similar_text(eventName, controlName, true) > 75;
        dLog('green', 'tether', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const openEvent = async data => {
        dLog('red', 'tether', ['openEvent', data]);
        let $el = $([]);
        let parseLink;
        if (!!data.direct_link) {
            parseLink = data.direct_link.replace('lootbet-vmk3dz1p', 'hub88b-ytuoyswg');
        }
        const eventName = `${data.team1} - ${data.team2}`;
        let sport = accordance[data.sport];
        if (sport === 'cybersport') {
            sport = accordanceCyber[data.league];
        }
        const checkWeAreThere = function () {
            if (!!data.direct_link) {
                return document.location.href === parseLink;
            }
            const
                team1 = $(findSel(['div.sb-pro__name:eq(0)', 'div.slider-event-pro__team-name:eq(0)'])).trt(),
                team2 = $(findSel(['div.sb-pro__name:eq(1)', 'div.slider-event-pro__team-name:eq(1)'])).trt(),
                checkEvent = `${team1} - ${team2}`;
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };
        const gotoLiveSport = async (sport) => {
            // expand -See All-
            const $seeAll = await waitForElement('div._more:eq(0)',
                333, 2222).catch(() => $([]));

            if ($seeAll.length > 0) {
                await mouseChain({target: $seeAll[0], events: fullClick, error: '$seeAll'});
            }

            const $sportLink = await waitForElement(`a.games-nav__item._${sport}`,
                333, 7777);
            if ($sportLink.hasClass('_active') === false) {
                await mouseChain({target: $sportLink[0], events: fullClick, error: '$sportLink'});
            }

            await delayPromise(333);
            const $liveLink = await waitForElement('div.lobby-filters a._live', 333, 5555);
            await delayPromise(333);
            await waitForCondition(() => $liveLink.hasClass('disabled') !== true,
                333, 20000, 'No events in live');
            // click live
            await mouseChain({target: $liveLink[0], events: fullClick, error: '$liveLink'});
            await delayPromise(3333);
        };

        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }

        const findEventClassic = async sport => {
            await gotoLiveSport(sport);
            $('div.grid-line__content div.grid-event').each(function () {
                const $this = $(this);
                const team1 = $this.find('div.grid-event__competitor-name:eq(0)').trt();
                const team2 = $this.find('div.grid-event__competitor-name:eq(1)').trt();
                const checkEvent = `${team1} - ${team2}`.toLowerCase();
                dLog('blue', 'tether', `Check: '${checkEvent}' === '${eventName}'`);

                if (checkEventName(checkEvent, eventName)) {
                    $el = $(this).find('a.grid-event__competitors');
                    return false;
                }
            });

            return $el.length > 0;
        };

        const findEvent = async sport => {
            const searchStr = 'div._search-btn';
            const $search = await waitForElement(searchStr,
                333, 5000)
                .catch(() => $([]));
            if ($search.length === 0) {
                await gotoLiveSport(sport);
                await delayPromise(10000);
                return await findEventClassic(sport);
            }
            await delayPromise(333);

            if ($('#search-input').length === 0) {
                await mouseChain({target: $search[0], events: fullClick, error: '$search'});
            }

            const $si = await waitForElement('#search-input',
                333, 7777, true);
            await delayPromise(333);
            await clearAndSimulate($si[0], data.team1);
            const type = data.type === 'LIVE' ? ':has("._live")' : ':not("._live")';
            const $sle = await waitForElement(`div.search-events div.grid-event${type}`,
                333, 15000, true);
            $sle.each(function () {
                const
                    $t = $(this),
                    team1 = $t.find('div.grid-event__competitor-name').eq(0).trt(),
                    team2 = $t.find('div.grid-event__competitor-name').eq(1).trt(),
                    checkEvent = `${team1} - ${team2}`;
                if (checkEventName(checkEvent, eventName)) {
                    $el = $t.find('a.grid-event__competitors');
                    return false;
                }
            });
            return $el.length > 0;
        };

        if (!!data.direct_link && document.location.href !== parseLink) {
            dLog('yellow', 'tether', `We got direct link: ${parseLink}`);
            document.location.href = parseLink;
            await waitForCondition(() => document.location.href === parseLink,
                250, 10000);
            await delayPromise(500);
        } else {
            if (await findEvent(sport) === false) {
                throw 'Event not found!';
            }
            // go to event page
            await mouseChain({target: $el[0], events: fullClick, error: 'EVENT'});
            await waitForCondition(checkWeAreThere,
                500, 10000, 'We are not on event!');
            await delayPromise(222);
        }

        return 'Switched to event!';
    };

    const getBetElement = async bet => {
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    tabs: ['All markets'],
                    roots: ['Match Winner'],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    tabs: ['All markets'],
                    roots: ['Match Winner'],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    tabs: ['All markets'],
                    roots: ['Match Winner'],
                    pivotKeys: ['Draw',],
                },
                'ONE_DRAW': {
                    tabs: ['All markets'],
                    roots: ['Double chance'],
                    pivotKeys: ['1X',],
                },
                'TWO_DRAW': {
                    tabs: ['All markets'],
                    roots: ['Double chance'],
                    pivotKeys: ['X2',],
                },
                'ONE_TWO': {
                    tabs: ['All markets'],
                    roots: ['Double chance'],
                    pivotKeys: ['12',],
                }
            },
            'TOTAL': {
                'OVER': {
                    tabs: ['All markets'],
                    roots: ['Total', 'Asian total'],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['All markets'],
                    roots: ['Total', 'Asian total'],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tabs: ['All markets'],
                    roots: ['#TEAM1# total',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['All markets'],
                    roots: ['#TEAM1# total',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tabs: ['All markets'],
                    roots: ['#TEAM2# total',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['All markets'],
                    roots: ['#TEAM2# total',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    tabs: ['All markets'],
                    roots: ['Corners. Total',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['All markets'],
                    roots: ['Corners. Total',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    tabs: ['All markets'],
                    roots: ['Handicap', 'Asian handicap'],
                    pivotKeys: ['#TEAM1# #HPIVOT#'],
                },
                'AWAY': {
                    tabs: ['All markets'],
                    roots: ['Handicap', 'Asian handicap'],
                    pivotKeys: ['#TEAM2# #HPIVOT#'],
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
                    this.addReplIn('roots', 'Match Winner', 'Winner');
                }
                this.addToEl('roots', '. 1-st half', false);
            }
        };
        params.proceed_baseball = function (bet) {
            if (!this.full) {
                this.addToEl('roots', `. Inning ${this.tDigit}`, false);
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Winner', 'Winner');
                }
            }
        };
        params.proceed_basketball = function (bet) {
            if (!this.full) {
                if (bet.time_value === 'TIME_1') {
                    if (bet.market === 'ONE_TWO') {
                        this.addReplIn('roots', 'Match Winner', 'Winner. Half 1');
                    }
                    this.addToEl('roots', '. Half 1', false);
                } else {
                    if (bet.market === 'ONE_TWO') {
                        this.addReplIn('roots', 'Match Winner', `Winner. Quarter ${this.tDigit}`);
                    }
                    this.addToEl('roots', `. Quarter ${this.tDigit}`, false);
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Winner', 'Winner. With overtime');
                }
                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total', 'Total. With overtime');
                }
                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Handicap', 'Handicap. With overtime');
                }
            }
        };
        params.proceed_tennis = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Winner', 'Winner. With overtime');
                }
                if (bet.time_value.indexOf('SET') > -1 && bet.time_value.indexOf('GAME') > -1) {
                    const parts = bet.time_value.split('_GAME_');
                    this.addToEl('roots', [
                        `. Set ${this.tDigit}. Game ${parts[1].trim()}${this.calcTh(parseInt(parts[1].trim()))}`,
                        false
                    ]);
                } else {
                    this.addToEl('roots', `. Set ${this.tDigit}`, false);
                }
            }
        };
        params.proceed_volleyball = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Winner', 'Winner');
                }
                this.addToEl('roots', `. Set ${this.tDigit}`, false);
            }
        };
        params.proceed_handball = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Winner', 'Winner');
                }
                this.addToEl('roots', '. Half 1', false);
            }
        };
        params.proceed_cybersport = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Winner', 'Winner');
                }
                this.addToEl('roots', `. Map ${this.tDigit}`, false);

            } else {
                if (bet.market === 'HDP') {
                    this.addTotal('roots', ['Maps Handicap']);
                }
                if (bet.market === 'TOTAL') {
                    this.addTotal('roots', ['Total maps']);
                }
            }
        };
        const final = applyAllMarkets(bet, ['roots', 'pivotKeys', 'tabs'], params, markets, true);
        const m = final[bet.market][bet.target];
        const hPivot = pvt => {
            return parseFloat(pvt) === 0 ? '0' : parseFloat(pvt) > 0 ? `+${pvt}` : pvt;
        };
        const $findPivot = $root => {
            let $res = $([]);
            for (const pvt of m.pivotKeys) {
                console.log(`Checking pivot: '${pvt}'`);
                let $pivot = $([]);
                $pivot = $root.closest('div.game-event__market-wrapper').find(`span.outcome__status:textEquals("${pvt}")`);
                if ($pivot.length === 1) {
                    $res = $pivot;
                    break;
                } else if ($pivot.length > 1) {
                    throw `Strange pivot length ${$pivot.length} for ${$root}/${pvt}`;
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

        dLog('green', 'tether', ['Final market is:', m]);
        await waitForElement('div.game-event__markets', 333, 10000);
        console.log('%c' + 'Markets should be here!',
            'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        await delayPromise(1333);

        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () => $(`div.game-event-market__title span:textEqualsI("${root}")`);
            // Open if necessary
            if ($root().closest('div.game-event__market-wrapper').hasClass('_closed') === true) {
                await mouseChain({
                    target: $root()[0],
                    events: fullClick, error: 'expand', scroll: true
                });
                await delayPromise(1222);
            }
            $found = $findPivot($root());
            if ($found.length > 0) {
                break;
            }
        }

        if ($found.length === 0) {
            throw `${bet.sport}/${bet.type}/${bet.time_value}/${bet.market}/${bet.target}/${bet.pivot} not found :(`;
        }

        return $found.closest('button');
    };

    const openCoupon = async paramData => {
        dLog('green', 'tether', ['openCoupon, paramData:', paramData]);
        const saveIdx = await bMess('couponIndex')
            .check(1888, true)
            .catch(() => 0);
        dLog('blue', 'tether', ['saveIdx:', saveIdx]);
        for (let i = saveIdx; i < paramData.length; i++) {
            await bMess('couponIndex').set(i);
            const data = paramData[i];
            dLog('green', 'tether', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'tether', 'Event must be opened!');
            const $element = await getBetElement(data);
            await mouseChain({target: $element[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(500);
        }
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => checkEventName(v.team1.toLowerCase()
            + ' vs ' + v.team2.toLowerCase(), match));
        const $coupons = await waitForElement('div.bets-item__pro',
            333, 9999, true);
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $this.find('a').trt();
            let localCoef = $this.find('span.outcome__number-pro').trt();
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

    const proceedBetSport = async (data, balance) => {
        let willPlace = parseFloat(data[0].stake);
        const checkSuccess = async () => {
            // Please wait while your bet is placed
            const $el = await waitForElement([
                'div.coupon-container__empty-text strong:textEquals("Just Bet It")',
                'div.bets__item-error:visible',
                ], 333, 20000,true, 1, 'No success!');
            if ($el.hasClass('bets__item-error')) {
                throw $el.trt();
            }
            return true;
        };
        const checkCouponBalance = async () => {
            const couponBalance = parseFloat($('div.balance-amount')
                .trt().replace(/[^\d.]/g, ''));
            if (couponBalance === 0) {
                await bMess('couponBalanceState').set(true);
                throw 'Coupon balance is 0 try again';
            }
        };
        const checkBalance = willPlace => {
            if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };

        await closePreviousCoupons();

        if (!willPlace) {
            throw`Bad will place: ${willPlace}, ${data[0].stake}`;
        }

        checkBalance(willPlace);
        await delayPromise(555);
        await checkCouponBalance();
        await openCoupon(data);

        do {
            await checkCoefs(data);
            // disselect -accept all odds-
            if ($('div.switcher-button__inner-wrapper').hasClass('_active') === true) {
                await mouseChain({
                    target: $('div.switcher-button__inner-wrapper')[0],
                    events: fullClick,
                    error: 'switcher-button'
                });
                await delayPromise(555);
            }
            const place = willPlace.toString().replace('.00', '').trim();
            dLog('green', 'tether', `Will place (performBet): ${place}, balance: ${balance}`);
            const $input = () => $('input[name="stake"]');
            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            if (parseFloat($input().val()) !== parseFloat(place)) {
                await clearAndInputNumber($input()[0], place);
                await delayPromise(555);
                dLog('green', 'tether', `STAKE entered ${willPlace}`);
            }
            let entered = parseFloat($input().val());
            dLog('green', 'tether', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'tether', 'Entered !== willPlace - try to reenter!');
                continue;
            }
            await delayPromise(555);
            const $placeBtn = $(findSel(['button.coupon__placebet-btn']));
            if ($placeBtn.length === 0) {
                throw 'No place button or button disabled!';
            }
            await delayPromise(333);
            await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
        } while (!await checkSuccess());

        await delayPromise(555);
        await mouseChain({
            target: $('div.games-menu__item-title:textEquals("My bets")')[0], events: fullClick,
            error: 'My bets'
        });
        await delayPromise(555);
        if ($('div.games-tab:textEquals("Unsettled")').hasClass('_active') === false) {
            await mouseChain({
                target: $('div.games-tab:textEquals("Unsettled")')[0], events: fullClick,
                error: 'Unsettled'
            });
        }
        await delayPromise(333);
        const $firstBetRes = await waitForElement('div.mybets-list__item:first',
            333, 9999, true);
        await delayPromise(777);
        const extID = $firstBetRes.find('div.mybets-list__item-number').trt().replace(/[^\d.]/g, '');
        const coef = $firstBetRes.find('div.mybets-list__item-odd span:eq(1)').trt();
        const stake = $firstBetRes.find('div.mybets-list__item-bet-amount').trt().replace(/[^\d.]/g, '');
        await delayPromise(333);
        // close my bets
        await mouseChain({target: $('div.modal__box-search-close')[0], events: fullClick, error: 'my bets'});
        await delayPromise(999);
        // go to live
        await mouseChain({target: $('a._live')[0], events: fullClick, error: '_live'});
        return {
            success: true,
            message: {
                external_id: extID,
                coef,
                stake,
                max: '7777777',
            },
        };
    };

    const collectBetResultsSports = async (inD) => {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30)
            : 30;
        dLog('', 'tether', [
            `collectBetResults, on: '${document.location.href}', limit: ${limit}, data:`,
            data]);
        if ($('div.modal div.modal__box-mybets').length === 0) {
            const $myBets = await waitForElement('div.games-menu__item-title:textEquals("My bets")',
                333, 9999);
            await mouseChain({target: $myBets[0], events: fullClick, error: '$myBets'});
            dLog('green', 'tether', 'My bets clicked!');
        } else {
            dLog('green', 'tether', 'Already on my bets page!');
        }
        await delayPromise(555);
        let checked = 0;

        for (const tab of ['Unsettled', 'Settled']) {
            const $tab = await waitForElement(`div.games-tab:textEquals("${tab}")`, 333, 9999);
            if ($tab.attr('class').indexOf('_active') === -1) {
                await mouseChain({target: $tab[0], events: fullClick, error: '$tab'});
                dLog('green', 'tether', `Tab ${tab} clicked!`);
                await delayPromise(777);
            } else {
                dLog('green', 'tether', `Tab ${tab} already selected!`);
                await delayPromise(777);
            }
            const
                resSel = 'div.mybets-list__item',
                noResSel = 'div:textEquals("There will be information about open bets")';
            await waitForElement([resSel, noResSel], 333, 9999);
            if ($(noResSel).length > 0) {
                dLog('red', 'tether', `No results in the tab ${tab}!`);
                continue;
            }
            await $(resSel).eachAsync(async function () {
                if (checked > limit) {
                    return false;
                }
                checked++;
                const $this = $(this);
                const betId = $this.find('div.mybets-list__item-number').trt().replace(/[^\d.]/g, '');
                if (data.length === 0 || data.indexOf(betId) > -1) {
                    const
                        sts = $this.find('div.bet-status').trt(),
                        status = tab === 'Unsettled'
                            ? 'ACCEPTED'
                            : sts === 'Win' ? 'WON' : sts === 'Lost' ? 'LOSE' : 'REFUNDED';
                    collected.push({
                        external_id: betId,
                        status,
                        stake: $this.find('div.mybets-list__item-bet-amount').trt().replace(/[^\d.]/g, ''),
                        result: status === 'ACCEPTED' ? ''
                            : parseFloat($this.find('div.mybets-list__item-possible-win-amount').trt().replace(/[^\d.]/g, '')),
                    });
                }
            });
            dLog('', 'tether', [`${tab}, checked: ${checked}, collected:`, collected]);
        }

        await delayPromise(888);
        // close my bets
        await mouseChain({target: $('div.modal__box-search-close')[0], events: fullClick, error: 'my bets'});
        return {success: true, message: collected};
    };

    const proceedForkBet = async (dataIn, balance, testing) => {
        // Hint: here we need open coupon or do bet (depending of shoulder number)
        if (testing) {
            dLog('green', 'tether',
                [`proceedForkBet (shoulder: ${settings.fork.shoulder}):`, dataIn]);
            await delayPromise(30000);
            throw `Testing proceedForkBet!`;
        }
    };

    const proceedForkBetConfirm = async (data, balance, testing) => {
        // Hint: confirmation for bet if shoulder number is 2
        if (testing) {
            dLog('green', 'tether',
                [`proceedForkBetConfirm:`, data]);
            await delayPromise(10000);
            throw `Testing proceedForkBetConfirm!`;
        }
    };

    const getRegistered = async (data, command, balance, testing) => {
        dLog('green', 'tether',
            [`getRegistered (${balance}), testing: ${testing}:`, data]);
        if (testing) {
            dLog('green', 'tether', `getRegistered testing!`);
            await delayPromise(10000000);
            throw `Testing getRegistered!`;
        }
        const
            $register = await waitForElement('img[alt="register"]',
                250, 20000),
            els = {
                'login': 'input[name="username"]',
                'password': 'input[name="password"]',
                'email': 'input[name="email"]',
            };
        await delayPromise(3000);
        await closeExcesses();
        await mouseChain({target: $register[0], events: fullClick, error: '$register'});
        await waitForElement(Object.values(els), 250, 20000);
        await delayPromise(3000);
        for (const idx of Object.keys(els)) {
            await clearAndSimulate($(els[idx])[0], data[idx]);
            await delayPromise(3000);
        }
        await mouseChain({
            target: $('h6:contains("18 years")').parent().parent()[0],
            events: fullClick, error: '18 years'
        });
        await delayPromise(3000);
        const $b = $('button:textEquals("Start Playing")');
        if ($b.is(':disabled')) {
            throw `Register - «Start Playing» is disabled!`;
        }
        if (!testing) {
            await mouseChain({target: $b[0], events: fullClick, error: '$b'});
            await delayPromise(3000);
        } else {
            await mouseChain({
                target: $('i.icon-remove').parent().parent()[0],
                events: fullClick, error: ''
            })
        }
        return {
            success: true,
            message: 'Account ' + (testing ? 'TEST ' : '') + 'should be created!',
        }
    };

    const sportCommands = new class SportCommands {
        constructor() {
            this.testing = false;
            this.cLinks = {
                'BET': proceedBetSport,
                'EXPRESS_BET': proceedBetSport,
                'FORK_BET': proceedForkBet,
                'FORK_BET_CONFIRM': proceedForkBetConfirm,
                'BET_RESULT': collectBetResultsSports,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data, balance) {
            dLog('green', 'tether', [`SportProcessor execute: ${command}`, data]);
            currentBetData.init(data);
            const res = await this.cLinks[command](data, balance, this.testing)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'tether', [`${command} sports result was set:`, res]);
            await bMess('TetherResult').set(res);
            return res;
        }
    };

    const sportProcessor = command => {
        dLog('green', 'tether', `SportProcessor: ${command.action}`);
        if (sportCommands.exists(command.action)) {
            // Hint: execute command
            ourCommand.set(command);
            sportCommands.execute(command.action, command.data, command.balance)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'tether', ['Unknown Sport command:', command]);
        }
    };

    const executeSportCommand = async (data, command, balance, testing) => {
        dLog('green', 'tether', `executeSportCommand: ${command}, ${balance}`);
        let successDiff, realSuccessInterval;
        if (command === 'BET') {
            realSuccessInterval = data[0].successBetInterval || settings.betweenBets;
            const wasSuccessStake = await bMess('WasSuccessStake')
                .check(realSuccessInterval)
                .catch(() => 0);
            successDiff = Date.now() - wasSuccessStake;
            if (successDiff < realSuccessInterval) {
                throw `To early after previous success bet ${successDiff} instead of ${realSuccessInterval}!`
            }
        }
        if (command === 'BET' && !!currentBetData.data[0].betFromParser) {
            const eventName = `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`;
            if (!await eventsWork('tether', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'GemDom',
                    `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                    + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
            }
        }
        if (!!testing) {
            dLog('orange', 'tether', [`execute command:`, command, `settings:`, settings]);
            currentBetData.data[0].betFromParser = true;
            dLog('orange', 'tether', 'TESTING - simple wait 10 secs');
            await delayPromise(10000);
            return {
                success: true,
                message: {
                    coef: 1.5,
                    stake: 1,
                    max: 777,
                },
            };
        }
        await bMess('TetherSport').set({action: command, data, balance});
        dLog('yellow', 'tether', [`Start waiting for command: ${command}`, data, balance]);
        return await bMess('TetherResult')
            .get(300000, 10000, 300, true);
    };

    const commands = new class commands {
        constructor() {
            this.testing = false;
            this.wasRegister = false;
            this.registration = false;
            this.register = {
                bk: '',
                email: '',
                login: '',
                password: '',
                birthdate: '',
                name: '',
                last_name: '',
                country: '',
                address: '',
                city: '',
                zip: '',
                job: '',
                amount: '',
                binance_api: '',
            };
            if (this.testing) {
                dLog('bigger-red', 'tether', [`TESTING MODE ${window.self === window.top} at:`,
                    document.location.href]);
            }
            this.cLinks = {
                'BET': executeSportCommand,
                'EXPRESS_BET': executeSportCommand,
                'FORK_BET': executeSportCommand,
                'FORK_BET_CONFIRM': executeSportCommand,
                'BET_RESULT': executeSportCommand,
                'REGISTER_NEW': getRegistered,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data) {
            const self = this;
            currentBetData.init(data);
            if (command === 'REGISTER_NEW') {
                this.wasRegister = true;
                this.register = data;
                this.registration = true;
                this.testing = data.login === "*** TEST ***";
                dLog('', 'tether', [`execute REGISTER_NEW, ${this.wasRegister}:`,
                    this.register]);
            }
            const res = await this.cLinks[command](data, command, getBalance(), this.testing)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'tether', [`${command} result:`, res]);
            this.prepareResult(command, res)
                .then(m => {
                    dLog('orange', 'tether', ['Prepared result: ', m]);
                    port.postMessage(m);
                })
            if (!res.success) {
                throw res.message;
            }
            return res;
        }

        async prepareResult(command, res) {
            dLog('orange', 'tether', [`prepareResult for ${command}`, res]);
            if (['BET', 'EXPRESS_BET', 'FORK_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('tether', settings,
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
                if (!!currentBetData.data[0].betFromParser) {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'TETHER';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = '437';
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
            } else if (command === 'REGISTER_NEW') {
                return {
                    answered: "REGISTER_NEW",
                    status: res.success ? "success" : "error",
                    answer: res.message
                };
            } else {
                return {};
            }
        }
    };

    const messageProcessor = message => {
        dLog('green', 'tether', [`messageProcessor (${busy})`, message]);
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
        } else if (message.action === "auth") {
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 2400000;
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
            let idx = document.location.href.indexOf('ta-tp-tetherbet-ed23ft6.turbostars.gg/?') > -1
                ? 'TetherSport' : 'TetherCommand';
            bMess(idx)
                .set(ourCommand.get(), increaseDelay ? 150000 : 0)
                .then(() => {
                    dLog('green', 'tether', [`Command (${idx}) was set till unload:`,
                        ourCommand.get()]);
                });
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});
        const sportPage = 'ta-tp-tetherbet-ed23ft6.turbostars.gg/?';

        if (window.self === window.top) {
            // Hint: main window (outer with auth, menu, balance, etc.)
            pageLoadedAt = Date.now();
            bMess('TetherCommand').check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'tether', [
                        `Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand
                    ]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'tether', 'No command!'));
        } else if (document.location.href.indexOf(sportPage) > -1) {
            // Hint: sports frame (here the most of work)
            (async () => {
                while (!stopSports) {
                    const csc = await bMess('TetherSport')
                        .check(60000, true)
                        .catch(() => null);
                    if (csc !== null) {
                        sportProcessor(csc);
                    }
                    await delayPromise(444);
                }
            })();
            dLog('green', 'tether', 'Sport processor initialized!');
        } else {
            dLog('', 'tether', `afterDOMLoaded ${document.location.href}`);
        }
    }
})();
