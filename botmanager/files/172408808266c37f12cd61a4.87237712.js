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
    const loginSelector = 'button:textEquals("Sign in")';

    const port = window.self === window.top
        ? chrome.runtime.connect({name: 'port_whale'})
        : {postMessage: () => console.log(arguments)};

    const settings = {
        authCheckInterval: 2000,
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

    const getBalance = async () => {
        await waitForElement('button:textEquals("Deposit")', 333, 18888, 'balance is not appeared!');
        const $b = $('button:textEquals("Deposit")').prev().find('span.font-medium');

        if ($b.length === 0) {
            return 0;
        } else {
            await bMess('authBalance').set(parseFloat($b.trt()));
            return parseFloat($b.trt());
        }
    }

    const closeExcesses = async () => {
        const $chat = $('div[class^="Chatstyled__ChatContainer"] button[class*="Chatstyled__StyledCloseButton-lcnFVW"]');
        if ($chat.length > 0
            && $chat.attr('style').indexOf('visibility: hidden') === -1) {
            await mouseChain({
                target: $('button.MuiButtonBase-root:has(i.icon-Chat)')[0],
                events: fullClick, error: 'chat'
            });
        }
        const $no = $('#onesignal-slidedown-cancel-button');
        if ($no.length > 0) {
            await mouseChain({target: $no[0], events: fullClick, error: 'no!',})
        }
    };

    const authCheck = function () {
        (async () => {
            const couponBalanceState = await bMess('couponBalanceState')
                .check(1222, true)
                .catch(() => null);
            if (couponBalanceState !== null) {
                document.location.reload();
            }

            if (document.location.href.indexOf('/sportsbook') === -1) {
                await switchCurrency();
                await goToSport();
            } else {
                const authBal = await bMess('authBalance')
                    .check(2222, false, true)
                    .catch(() => null);

                port.postMessage({
                    m: "authorized!",
                    balance: authBal
                });
            }
        })()
            .catch(e => dLog('red', 'whale', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
        return;
    };

    const switchCurrency = async () => {
        const $regWindow = await waitForElement('button[aria-label="Close Modal"]', 333, 15000).catch(() => $([]));
        if ($regWindow.length > 0) {
            await mouseChain({target: $regWindow[0], events: fullClick, error: '$regWindow'});
        }
        if (await getBalance() > 0) {
            // Our currency probably is already set
            return;
        }
        const $cur = $('button.px-1');
        if ($cur.length === 0) {
            return;
        }
        await mouseChain({target: $cur[0], events: fullClick, error: '$cur 1'});
        await delayPromise(1777);
        const $curImages = $('menu.w-auto button > span');
        let max = 0;
        let maxIdx = -1;
        for (let i = 0; i < $curImages.length; i++) {
            const h = parseFloat($curImages.eq(i).trt());
            console.log(`value of ${i}, ${h}`);
            if (h > max) {
                maxIdx = i;
                max = h;
            }
        }
        if (max > -1) {
            await mouseChain({target: $curImages.eq(maxIdx)[0], events: fullClick, error: '$cur 2'});
            await delayPromise(1000);
        }
        await mouseChain({target: $cur[0], events: fullClick, error: '$cur 1-2'});
        dLog('big-red', 'whale', 'Currency checked!');
    };

    const goToSport = async () => {
        // go to sport
        const $sb = $('a[href="/sportsbook"]:eq(1)');
        if ($sb.length === 1) {
            await mouseChain({
                target: $sb[0],
                events: fullClick,
                error: 'sb'
            });
            await delayPromise(555);
        } else {
            const $sportsLink = $('a[href="/sportsbook"]:eq(0)');
            if ($sportsLink.length > 0) {
                await mouseChain({
                    target: $sportsLink[0],
                    events: fullClick,
                    error: 'sport-link'
                });
                await delayPromise(555);
            }
        }
    };

    const tryToLogin = async () => {
        if (Date.now() - authClickedTime < 60000) {
            throw 'too soon!';
        }
        const controls = {
            login: 'input[name="username"]',
            password: 'input[type="password"]',
            submit: 'button:textEquals("Start Playing")',
        };
        if (!checkSE(Object.values(controls), true)) {
            await mouseChain({target: $(loginSelector)[0], events: fullClick, error: 'loginSelector'});
            await delayPromise(1555);
        }
        if ($('input[type="checkbox"]').length > 0) {
            await mouseChain({target: $('input[type="checkbox"]')[0], events: fullClick, error: 'checkbox'});
            await delayPromise(1000);
        }
        await waitForCondition(() => Object.keys(controls).every(k => $(controls[k]).length > 0),
            333, 10000, 'No controls!');
        await mouseChain({target: $(controls.login)[0], events: fullClick, error: 'l1'});
        await delayPromise(1000);
        await clearAndSimulate($(controls.login)[0], settings.login);
        await delayPromise(1000);
        await mouseChain({target: $(controls.password)[0], events: fullClick, error: 'l2'});
        await delayPromise(1000);
        await clearAndSimulate($(controls.password)[0], settings.password);
        await delayPromise(1000);
        await mouseChain({target: $(controls.submit)[0], events: fullClick, error: 'l3'});
        authClicked++;
        authClickedTime = Date.now();
        dLog('', 'whale', `Auth clicked ${authClicked}!`);
    };

    const closePreviousCoupons = async () => {
        const $closeCoupon = $('i.iconFont-trash-pro');
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
        dLog('green', 'whale', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const openEvent = async data => {
        dLog('red', 'whale', ['openEvent', data]);
        let $el = $([]);
        let parseLink;
        if (!!data.direct_link) {
            parseLink = data.direct_link.replace('lootbet-vmk3dz1p', 'hub88b-ytuoyswg');
        }
        const eventName = `${data.team1} - ${data.team2}`.toLowerCase();
        let sport = accordance[data.sport];
        if (sport === 'cybersport') {
            sport = accordanceCyber[data.league];
        }
        const checkWeAreThere = function () {
            if (!!data.direct_link) {
                return document.location.href === parseLink;
            }
            const
                team1 = $('div._team-name:eq(0)').trt(),
                team2 = $('div._team-name:eq(1)').trt(),
                checkEvent = `${team1} — ${team2}`;
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };
        const checkScore = function () {
            if (!data.score || data.sport !== 'FOOTBALL'
                || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                return true;
            }
            const
                score = $('div.stub__info-score-col:eq(0)').trt()
                    + ':' + $('div.stub__info-score-col:eq(2)').trt(),
                scoreNeed = data.score.replace(/[^\d:]/g, '').trim();
            if (score !== scoreNeed) {
                return false;
            }
            return true;
        };
        const gotoLiveSport = async (sport) => {
            // expand -See All-
            const $seeAll = await waitForElement('div._more:eq(0)',
                333, 2222).catch(() => $([]));

            if ($seeAll.length > 0) {
                await mouseChain({target: $seeAll[0], events: fullClick, error: '$seeAll'});
            }

            const $sportLink = await waitForElement(`a.games-nav__item-pro[href="/${sport}"]`,
                333, 7777);
            if ($sportLink.hasClass('_active') === false) {
                await mouseChain({target: $sportLink[0], events: fullClick, error: '$sportLink'});
            }

            await delayPromise(333);
            const $liveLink = await waitForElement('div.lobby-filters__inner-pro a._live', 333, 5555);
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

        const findEventClassic = async (sport) => {
            await gotoLiveSport(sport);
            $('div.grid-line__content div.grid-event').each(function () {
                const $this = $(this);
                const team1 = $this.find('div.grid-event__competitor-name:eq(0)').trt();
                const team2 = $this.find('div.grid-event__competitor-name:eq(1)').trt();
                const checkEvent = `${team1} - ${team2}`.toLowerCase();
                dLog('blue', 'whale', `Check: '${checkEvent}' === '${eventName}'`);

                if (checkEventName(checkEvent, eventName)) {
                    $el = $(this).find('a.grid-event__competitors');
                    return false;
                }
            });

            return $el.length > 0;
        };

        const findEvent = async sport => {
            if ($('#search-input').length === 0) {
                const $search = await waitForElement('i.iconFont-search-pro', 333, 60000)
                    .catch(e => $([]));
                if ($search.length === 0) {
                    await gotoLiveSport(sport);
                    await delayPromise(10000);
                    return await findEvent(sport);
                }
                await delayPromise(555);
                await mouseChain({target: $search[0], events: fullClick, error: '$search'});
            }
            
            const $si = await waitForElement('#search-input',
                333, 10000, true);
            await delayPromise(1000);
            await clearAndSimulate($si[0], data.team1);
            const $sle = await waitForElement('div.search-list div.grid-event',
                333, 60000, true);
            $sle.each(function () {
                const
                    $t = $(this),
                    team1 = $t.find('div.grid-event__competitor-name').eq(0).trt(),
                    team2 = $t.find('div.grid-event__competitor-name').eq(1).trt(),
                    checkEvent = `${team1} - ${team2}`.toLowerCase();
                if (checkEventName(checkEvent, eventName)) {
                    $el = $t.find('a.grid-event__competitors');
                    return false;
                }
            });
            return $el.length > 0;
        };

        if (!!data.direct_link && document.location.href !== parseLink) {
            dLog('yellow', 'whale', `We got direct link: ${parseLink}`);
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
                    roots: ['Total',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['All markets'],
                    roots: ['Total',],
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
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Winner', `Winner. Quarter ${this.tDigit}`);
                }
                this.addToEl('roots', `. Quarter ${this.tDigit}`, false);
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

        dLog('green', 'whale', ['Final market is:', m]);
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
        dLog('green', 'whale', ['openCoupon, paramData:', paramData]);
        const saveIdx = await bMess('couponIndex')
            .check(1888, true)
            .catch(() => 0);
        dLog('blue', 'whale', ['saveIdx:', saveIdx]);
        for (let i = saveIdx; i < paramData.length; i++) {
            await bMess('couponIndex').set(i);
            const data = paramData[i];
            dLog('green', 'whale', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'whale', 'Event must be opened!');
            const $element = await getBetElement(data);
            await mouseChain({target: $element[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(500);
        }
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => checkEventName(v.team1.toLowerCase()
            + ' vs ' + v.team2.toLowerCase(), match));
        const $coupons = await waitForElement('div.bets__item',
            333, 9999, true);
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $this.find('a').trt();
            let localCoef = $this.find('div.bets__item-odd').trt();
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
        //for (const d in data) {
        //    data[d].direct_link = null;
        //}
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
            dLog('green', 'whale', `Will place (performBet): ${place}, balance: ${balance}`);
            const $input = () => $('input[name="stake"]');
            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            if (parseFloat($input().val()) !== parseFloat(place)) {
                await clearAndInputNumber($input()[0], place);
                await delayPromise(555);
                dLog('green', 'whale', `STAKE entered ${willPlace}`);
            }
            let entered = parseFloat($input().val());
            dLog('green', 'whale', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'whale', 'Entered !== willPlace - try to reenter!');
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
        await delayPromise(2555);
        if ($('div.games-tab:textEquals("Unsettled")').hasClass('_active') === false) {
            await mouseChain({
                target: $('div.games-tab:textEquals("Unsettled")')[0], events: fullClick,
                error: 'Unsettled'
            });
        }
        await delayPromise(333);
        const $firstBetRes = await waitForElement('div.mybets-list__item:first',
            333, 9999, true);
        const extID = $firstBetRes.find('div.mybets-list__item-number').trt().replace(/[^\d.]/g, '');
        await delayPromise(777);
        // close my bets
        await mouseChain({target: $('div.modal__box-search-close')[0], events: fullClick, error: 'my bets'});
        await delayPromise(999);
        // go to live
        await mouseChain({target: $('a._live')[0], events: fullClick, error: '_live'});
        return {
            success: true,
            message: {
                external_id: extID,
                coef: $firstBetRes.find('div.mybets-list__item-odd span:eq(1)').trt(),
                stake: $firstBetRes.find('div.mybets-list__item-bet-amount').trt().replace(/[^\d.]/g, ''),
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
        dLog('', 'whale', [
            `collectBetResults, on: '${document.location.href}', limit: ${limit}, data:`,
            data]);
        if ($('div.modal div.modal__box-mybets').length === 0) {
            const $myBets = await waitForElement('div.games-menu__item-title:textEquals("My bets")',
                333, 9999);
            await mouseChain({target: $myBets[0], events: fullClick, error: '$myBets'});
            dLog('green', 'whale', 'My bets clicked!');
        } else {
            dLog('green', 'whale', 'Already on my bets page!');
        }
        await delayPromise(555);
        let checked = 0;

        for (const tab of ['Unsettled', 'Settled']) {
            const $tab = await waitForElement(`div.games-tab:textEquals("${tab}")`, 333, 9999);
            if ($tab.attr('class').indexOf('_active') === -1) {
                await mouseChain({target: $tab[0], events: fullClick, error: '$tab'});
                dLog('green', 'whale', `Tab ${tab} clicked!`);
                await delayPromise(777);
            } else {
                dLog('green', 'whale', `Tab ${tab} already selected!`);
                await delayPromise(777);
            }
            const
                resSel = 'div.mybets-list__item',
                noResSel = 'div:textStarts("There will be information about")';
            await waitForElement([resSel, noResSel], 333, 9999);
            if ($(noResSel).length > 0) {
                dLog('red', 'whale', `No results in the tab ${tab}!`);
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
            dLog('', 'whale', [`${tab}, checked: ${checked}, collected:`, collected]);
        }

        await delayPromise(888);
        // close my bets
        await mouseChain({target: $('div.modal__box-search-close')[0], events: fullClick, error: 'my bets'});
        return {success: true, message: collected};
    };

    const proceedForkBet = async (dataIn, balance, testing) => {
        // Hint: here we need open coupon or do bet (depending of shoulder number)
        if (testing) {
            dLog('green', 'whale',
                [`proceedForkBet (shoulder: ${settings.fork.shoulder}):`, dataIn]);
            await delayPromise(30000);
            throw `Testing proceedForkBet!`;
        }
    };

    const proceedForkBetConfirm = async (data, balance, testing) => {
        // Hint: confirmation for bet if shoulder number is 2
        if (testing) {
            dLog('green', 'whale',
                [`proceedForkBetConfirm:`, data]);
            await delayPromise(10000);
            throw `Testing proceedForkBetConfirm!`;
        }
    };

    const getRegistered = async (data, command, balance, testing) => {
        dLog('green', 'whale',
            [`getRegistered (${balance}), testing: ${testing}:`, data]);
        if (testing) {
            dLog('green', 'whale', `getRegistered testing!`);
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
            dLog('green', 'whale', [`SportProcessor execute: ${command}`, data]);
            currentBetData.init(data);
            const res = await this.cLinks[command](data, balance, this.testing)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'whale', [`${command} sports result was set:`, res]);
            await bMess('WhaleResult').set(res);
            return res;
        }
    };

    const sportProcessor = command => {
        dLog('green', 'whale', `SportProcessor: ${command.action}`);
        if (sportCommands.exists(command.action)) {
            // Hint: execute command
            ourCommand.set(command);
            sportCommands.execute(command.action, command.data, command.balance)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'whale', ['Unknown Sport command:', command]);
        }
    };

    const executeSportCommand = async (data, command, balance, testing) => {
        dLog('green', 'whale', `executeSportCommand: ${command}, ${balance}`);
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
            if (!await eventsWork('whale', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'whale',
                    `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                    + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
            }
        }
        if (!!testing) {
            dLog('orange', 'whale', [`execute command:`, command, `settings:`, settings]);
            currentBetData.data[0].betFromParser = true;
            dLog('orange', 'whale', 'TESTING - simple wait 10 secs');
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
        await bMess('WhaleSport').set({action: command, data, balance});
        dLog('yellow', 'whale', [`Start waiting for command: ${command}`, data, balance]);
        return await bMess('WhaleResult')
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
                dLog('bigger-red', 'whale', [`TESTING MODE ${window.self === window.top} at:`,
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
                dLog('', 'whale', [`execute REGISTER_NEW, ${this.wasRegister}:`,
                    this.register]);
            }
            const res = await this.cLinks[command](data, command, getBalance(), this.testing)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'whale', [`${command} result:`, res]);
            this.prepareResult(command, res)
                .then(m => {
                    dLog('orange', 'whale', ['Prepared result: ', m]);
                    port.postMessage(m);
                })
            if (!res.success) {
                throw res.message;
            }
            return res;
        }

        async prepareResult(command, res) {
            dLog('orange', 'whale', [`prepareResult for ${command}`, res]);
            if (['BET', 'EXPRESS_BET', 'FORK_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('whale', settings,
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
                    resultData.bookmaker = 'WHALE';
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
        dLog('green', 'whale', [`messageProcessor (${busy})`, message]);
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
            let idx = document.location.href.indexOf('telegramcasino-ni2mduvr4.betsy.gg') > -1
                ? 'WhaleSport' : 'WhaleCommand';
            bMess(idx)
                .set(ourCommand.get(), increaseDelay ? 150000 : 0)
                .then(() => {
                    dLog('green', 'whale', [`Command (${idx}) was set till unload:`,
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
        if (window.self === window.top) {
            // Hint: main window (outer with auth, menu, balance, etc.)
            bMess('WhaleCommand').check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'whale', [
                        `Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand
                    ]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'whale', 'No command!'));
        } else if (document.location.href.indexOf('telegramcasino-ni2mduvr4.betsy.gg') > -1) {
            //Hint: sports frame (here the most of work)
            (async () => {
                while (!stopSports) {
                    const csc = await bMess('WhaleSport')
                        .check(60000, true)
                        .catch(() => null);
                    if (csc !== null) {
                        sportProcessor(csc);
                    }
                    await delayPromise(500);
                }
            })();
            dLog('green', 'whale', 'Sport processor initialized!');
        } else {
            dLog('red', 'whale', `afterDOMLoaded ${document.location.href}`);
        }
        //window.postMessage({"wait": true,}, window.location.href);
        //dLog('blue', 'whale', nowFormatted() + `: [RCPT] Wait sent to/from ${document.location.href}`);
    }
})();
