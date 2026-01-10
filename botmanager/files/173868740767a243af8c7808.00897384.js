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
    let currencyChecked = false;
    const loginSelector = 'button:textEquals("Sign in")';

    const port = window.self === window.top
        ? chrome.runtime.connect({name: 'port_gamdom'})
        : {postMessage: () => console.log(arguments)};

    const settings = {
        authCheckInterval: 1555,
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
        const $b = $('a[href="/wallet"]').prev();
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.text().replace(/[^\d.]/g, '').trim());
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
        if (enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            bsError(port, 'ERROR AUTH!');
            return;
        }
        (async () => {
            await closeExcesses();
            const couponBalanceState = await bMess('couponBalanceState')
                .check(1222, true)
                .catch(() => null);
            if (couponBalanceState !== null) {
                document.location.reload();
            }
            const $bonus = await waitForElement('a[href="/profile"]', 333, 4444).catch(() => $([]));
            if ($(loginSelector).length > 0 && Date.now() - pageLoadedAt < 60000) {
                console.log(`It could be still loading: ${Date.now() - pageLoadedAt}`);
            } else if ($bonus.length === 0 && $(loginSelector).length > 0) {
                port.postMessage({m: "tech works! 2"});
                await tryToLogin();
                await delayPromise(555);
            } else {
                await delayPromise(777);
                await goToSport();
                if (getBalance() === 0 && !currencyChecked) {
                    await switchCurrency();
                }
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true)
                });
            }
        })()
            .catch(e => dLog('red', 'gamdom', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
        return;
    };

    const switchCurrency = async () => {
        if (getBalance() > 0) {
            // Our currency probably is already set
            currencyChecked = true;
            return;
        }
        const $cur = $('a[href="/wallet"]').prev();
        if ($cur.length === 0) {
            return;
        }
        await mouseChain({target: $cur[0], events: fullClick, error: '$cur 1'});
        await delayPromise(500);
        const $curImages =
            $('span:textEquals("Bet Currency")').parent().find('img[src^="data:image/svg+xml;base64"]');
        let max = -1;
        for (let i = 0; i < $curImages.length; i++) {
            const
                c = $curImages.eq(i).next().trt(),
                t = $curImages.eq(i).parent().parent().find('div:last').trt(),
                h = parseFloat(t.replace(/[^\d.]/g, '').trim());
            console.log(`value of ${i}, ${c} = ${t} (${h})`);
            if (h > 0 && h > max) {
                max = i;
            }
        }
        if (max > -1) {
            await mouseChain({target: $curImages.eq(max)[0], events: fullClick, error: '$cur 2'});
            await delayPromise(1000);
        }
        await mouseChain({target: $cur[0], events: fullClick, error: '$cur 1-2'});
        currencyChecked = true;
        dLog('big-red', 'gamdom', 'Currency checked!');
    };

    const goToSport = async () => { 
        // select sport if needed
        if (document.location.href.indexOf('/sports') === -1) {
            const $sb = $('button:textEquals("Sports Betting")');
            if ($sb.length === 1) {
                await mouseChain({
                    target: $sb[0],
                    events: fullClick,
                    error: 'sb'
                });
                await delayPromise(555);
            } else {
                const $sportsLink = $('a[href="/esports"]');
                if ($sportsLink.length > 0) {
                    await mouseChain({
                        target: $sportsLink[0],
                        events: fullClick,
                        error: 'sport-link'
                    });
                    await delayPromise(555);
                }
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
        dLog('', 'gamdom', `Auth clicked ${authClicked}!`);
        await delayPromise(1000);
        const $errorMessage = await waitForElement('i.icon-remove21', 333, 3555).catch(() => $([]));
        if ($errorMessage.length > 0) {
            enterError = true;
            throw 'Auth error!';
        }
    };

    const closePreviousCoupons = async () => {
        const $closeCoupon = $('button svg[data-icon="trash-xmark"]');
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
        dLog('green', 'gamdom', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const openEvent = async data => {
        dLog('red', 'gamdom', ['openEvent', data]);
        let $el = $([]);
        let parseLink;
        if (!!data.direct_link) {
            parseLink = data.direct_link.replace('lootbet-vmk3dz1p', 'hub88b-ytuoyswg');
        }
        const eventName = `${data.team1} vs. ${data.team2}`.toLowerCase();
        let sport = accordance[data.sport];
        if (sport === 'cybersport') {
            sport = accordanceCyber[data.league];
        }
        const checkWeAreThere = function () {
            if (!!data.direct_link) {
                return document.location.href === parseLink;
            }
            const
                team1 = $('div.fondo-tabla span.text-truncate:eq(0)').trt(),
                team2 = $('div.fondo-tabla span.text-truncate:eq(1)').trt(),
                checkEvent = `${team1} vs. ${team2}`;
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };

        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }

        const findEvent = async () => {
            const searchSelector = 'input[type="search"]';
            const $searchSelector = await waitForElement(searchSelector, 222, 5555, true).catch(() => $([]));

            if ($searchSelector.length === 0) {
                await mouseChain({target: $('button:textEquals("Live")')[0], events: fullClick, error: 'LIVE'});
                await waitForElement(searchSelector, 222, 5555, true);
            }

            await mouseChain({target: $(searchSelector)[0], events: fullClick, error: '$search'});
            await delayPromise(555);
            await clearAndSimulate($(searchSelector)[0], data.team1);
            const $sle = await waitForElement('div.ancho-100.pa-4',
                333, 33000, true);
            $sle.each(function () {
                const
                    $t = $(this),
                    checkEvent = $(this).find(`div:textEqualsI(${eventName})`).trt().toLowerCase();
                if (checkEventName(checkEvent, eventName)) {
                    $el = $(this).find(`div:textEqualsI(${eventName})`);
                    return false;
                }
            });
            return $el.length > 0;
        };

        if (!!data.direct_link && document.location.href !== parseLink) {
            dLog('yellow', 'gamdom', `We got direct link: ${parseLink}`);
            document.location.href = parseLink;
            await waitForCondition(() => document.location.href === parseLink,
                250, 10000);
            await delayPromise(500);
        } else {
            if (await findEvent() === false) {
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
        const marketPanels = '#scroll-wrapper div.v-expansion-panel-content div.v-item-group > div';
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    tabs: ['main'],
                    roots: ['1x2'],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    tabs: ['main'],
                    roots: ['1x2'],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    tabs: ['main'],
                    roots: ['1x2'],
                    pivotKeys: ['Draw',],
                },
                'ONE_DRAW': {
                    tabs: ['main'],
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or Draw',],
                },
                'TWO_DRAW': {
                    tabs: ['main'],
                    roots: ['Double Chance'],
                    pivotKeys: ['Draw or #TEAM2#',],
                },
                'ONE_TWO': {
                    tabs: ['main'],
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or #TEAM2#',],
                }
            },
            'TOTAL': {
                'OVER': {
                    tabs: ['main'],
                    roots: ['Total',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['main'],
                    roots: ['Total',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tabs: ['main'],
                    roots: ['#TEAM1# Total',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['main'],
                    roots: ['#TEAM1# Total',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tabs: ['main'],
                    roots: ['#TEAM2# Total',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['main'],
                    roots: ['#TEAM2# Total',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    tabs: ['main'],
                    roots: ['Total Corners',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    tabs: ['main'],
                    roots: ['Total Corners',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    tabs: ['main'],
                    roots: ['Handicap', 'Asian Handicap'],
                    pivotKeys: ['#TEAM1# (#HPIVOT#)'],
                },
                'AWAY': {
                    tabs: ['main'],
                    roots: ['Handicap', 'Asian Handicap'],
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
                this.addToEl('roots', '1st Half - ', true);
            }
        };
        params.proceed_baseball = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addReplIn('roots', '1x2', 'Winner (Incl. Extra Innings)');
            }
            if (bet.market === 'TOTAL') {
                this.addReplIn('roots', 'Total', 'Total (Incl. Extra Innings)');
            }
            if (bet.market === 'HDP') {
                this.addReplIn('roots', 'Handicap', 'Handicap (Incl. Extra Innings)');
            }
        };
        params.proceed_basketball = function (bet) {
            if (!this.full) {
                this.addToEl('roots', `${this.tDigit}${this.th} Quarter - `, true);
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', '1x2', 'Winner (Incl. Overtime)');
                }
                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total', 'Total (Incl. Overtime)');
                }
                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', '#TEAM1# Total', '#TEAM1# Total (Incl. Overtime)');
                }
                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# Total', '#TEAM2# Total (Incl. Overtime)');
                }
                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Handicap', 'Handicap (Incl. Overtime)');
                }
            }
        };
        params.proceed_tennis = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addReplIn('roots', '1x2', 'Winner');
            }
            if (bet.market === 'TOTAL') {
                this.addReplIn('roots', 'Total', 'Total Games');
            }
            if (bet.market === 'HDP') {
                this.addReplIn('roots', 'Handicap', 'Game Handicap');
            }
            if (!this.full) {
                if (bet.time_value.indexOf('SET') > -1 && bet.time_value.indexOf('GAME') > -1) {
                    const parts = bet.time_value.split('_GAME_');
                    this.addToEl('roots', [
                        `${this.tDigit}${this.th} Set Game ${parts[1].trim()} - `,
                        true
                    ]);
                } else {
                    this.addToEl('roots', `${this.tDigit}${this.th} Set - `, true);
                }
            }
        };
        params.proceed_volleyball = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addReplIn('roots', '1x2', 'Winner');
            }
            if (bet.market === 'TOTAL') {
                this.addReplIn('roots', 'Total', 'Total Points');
            }
            if (bet.market === 'HDP') {
                this.addReplIn('roots', 'Handicap', 'Point Handicap');
            }
            if (!this.full) {
                this.addToEl('roots', `${this.tDigit}${this.th} Set - `, true);
            }
        };
        params.proceed_cybersport = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addReplIn('roots', '1x2', 'Winner');
            }
            if (bet.market === 'TOTAL') {
                this.addReplIn('roots', 'Total', 'Total Kills');
            }
            if (bet.market === 'HDP') {
                this.addReplIn('roots', 'Handicap', 'Kill Handicap');
            }
            if (!this.full) {
                this.addToEl('roots', `${this.tDigit}${this.th} Map - `, true);
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
                $pivot = $root.find(`div.align-content-center:textEquals("${pvt}")`);

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

        dLog('green', 'gamdom', ['Final market is:', m]);
        await waitForElement(marketPanels, 333, 10000);
        console.log('%c' + 'Markets should be here!',
            'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        await delayPromise(1111);

        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () => $(marketPanels).find(`span.text-truncate:textEquals(${root})`).closest("div.v-expansion-panel");
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
        dLog('green', 'gamdom', ['openCoupon, paramData:', paramData]);
        const saveIdx = await bMess('couponIndex')
            .check(1888, true)
            .catch(() => 0);
        dLog('blue', 'gamdom', ['saveIdx:', saveIdx]);
        for (let i = saveIdx; i < paramData.length; i++) {
            await bMess('couponIndex').set(i);
            const data = paramData[i];
            dLog('green', 'gamdom', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'gamdom', 'Event must be opened!');
            const $element = await getBetElement(data);
            await mouseChain({target: $element[0], events: fullClick, error: '$el openCoupon', scroll: true});
            await delayPromise(888);
            if ($('svg[data-icon="caret-up"]').length > 0) {
                await mouseChain({target: $('svg[data-icon="caret-up"]')[0], events: fullClick, error: '$el openCoupon'});
            }
        }
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => checkEventName(v.team1.toLowerCase()
            + ' vs. ' + v.team2.toLowerCase(), match));
        const $coupons = await waitForElement('div.lineaTicket',
            333, 9999, true);
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $this.find('div.text-truncate').trt().toLowerCase();
            let localCoef = $this.find('div.primary--text').trt();
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
            await waitForElement('div:textEquals("Bets placed successfully!")', 333, 22000,true, 1, 'No success!');
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
            const place = willPlace.toString().replace('.00', '').trim();
            dLog('green', 'gamdom', `Will place (performBet): ${place}, balance: ${balance}`);
            const $input = () => $('div.amount-buttons input[type="text"]');
            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            if (parseFloat($input().val()) !== parseFloat(place)) {
                await clearAndInputNumber($input()[0], place);
                await delayPromise(555);
                dLog('green', 'gamdom', `STAKE entered ${willPlace}`);
            }
            let entered = parseFloat($input().val());
            dLog('green', 'gamdom', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'gamdom', 'Entered !== willPlace - try to reenter!');
                continue;
            }
            await delayPromise(555);
            const $placeBtn = $('div.ticket-content button.primario');
            if ($placeBtn.length === 0) {
                throw 'No place button or button disabled!';
            }
            await delayPromise(333);
            await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
        } while (!await checkSuccess());

        await delayPromise(777);
        await mouseChain({
            target: $('div.ticket-content button:textEquals("My Bets")')[0], 
            events: fullClick,
            error: 'My bets'
        });
        await delayPromise(333);
        const $firstBetRes = await waitForElement('div.bet-card:first', 333, 9999);
        await delayPromise(333);
        return {
            success: true,
            message: {
                external_id: $firstBetRes.find('div:last').trt().replace('ID: ', ''),
                coef: $firstBetRes.find('div.text-end > div:last').trt(),
                stake: $firstBetRes.find('div.amounts > div:first').clone().children().remove().end().trt().replace(/[^\d.]/g, ''),
                max: '7777777',
            },
        };
    };

    const collectBetResultsSports = async (inD) => {
        let collected = [];
        let checked = 0;
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30)
            : 30;
        dLog('', 'gamdom', [
            `collectBetResults, on: '${document.location.href}', limit: ${limit}, data:`,
            data]);

        await mouseChain({target: $('button:textEquals("My Bets")')[0], events: fullClick, error: '$myBets'});
        await delayPromise(333);
        const $betsHistory = await waitForElement('div[role="tab"]:textEquals("bets history")', 222, 5555, true);
        await delayPromise(333);
        await mouseChain({target: $betsHistory[0], events: fullClick, error: '$myBets'});
        const $betCards = await waitForElement('div.bet-card', 222, 7777, true).catch(() => $([]));

        if ($betCards.length === 0) {
            throw 'No history exist!';
        }

        await $betCards.eachAsync(async function () {
            if (checked > limit) {
                return false;
            }
            checked++;
            const $this = $(this);
            const betId = $this.find('div:last').trt().replace('ID: ', '');
            if (data.length === 0 || data.indexOf(betId) > -1) {
                const
                    sts = $this.find('div:textEquals("Result")').next().clone().children().remove().end().trt(),
                    status = sts === 'Win' ? 'WON' : sts === 'Lost' ? 'LOSE' : 'REFUNDED';
                collected.push({
                    external_id: betId,
                    status,
                    stake: $this.find('div.amounts > div:first').clone().children().remove().end().trt().replace(/[^\d.]/g, ''),
                    result: status === 'LOSE' ? ''
                        : parseFloat($this.find('div:textEquals("Total win")').next().trt().replace(/[^\d.]/g, '')),
                });
            }
        });

        dLog('', 'gamdom', [`checked: ${checked}, collected:`, collected]);
        await delayPromise(333);
        return {success: true, message: collected};
    };

    const proceedForkBet = async (dataIn, balance, testing) => {
        // Hint: here we need open coupon or do bet (depending of shoulder number)
        if (testing) {
            dLog('green', 'gamdom',
                [`proceedForkBet (shoulder: ${settings.fork.shoulder}):`, dataIn]);
            await delayPromise(30000);
            throw `Testing proceedForkBet!`;
        }
    };

    const proceedForkBetConfirm = async (data, balance, testing) => {
        // Hint: confirmation for bet if shoulder number is 2
        if (testing) {
            dLog('green', 'gamdom',
                [`proceedForkBetConfirm:`, data]);
            await delayPromise(10000);
            throw `Testing proceedForkBetConfirm!`;
        }
    };

    const getRegistered = async (data, command, balance, testing) => {
        dLog('green', 'gamdom',
            [`getRegistered (${balance}), testing: ${testing}:`, data]);
        if (testing) {
            dLog('green', 'gamdom', `getRegistered testing!`);
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
            dLog('green', 'gamdom', [`SportProcessor execute: ${command}`, data]);
            currentBetData.init(data);
            const res = await this.cLinks[command](data, balance, this.testing)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'gamdom', [`${command} sports result was set:`, res]);
            await bMess('GamdomResult').set(res);
            return res;
        }
    };

    const sportProcessor = command => {
        dLog('green', 'gamdom', `SportProcessor: ${command.action}`);
        if (sportCommands.exists(command.action)) {
            // Hint: execute command
            ourCommand.set(command);
            sportCommands.execute(command.action, command.data, command.balance)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'gamdom', ['Unknown Sport command:', command]);
        }
    };

    const executeSportCommand = async (data, command, balance, testing) => {
        dLog('green', 'gamdom', `executeSportCommand: ${command}, ${balance}`);
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
            if (!await eventsWork('gamdom', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'GemDom',
                    `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                    + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
            }
        }
        if (!!testing) {
            dLog('orange', 'gamdom', [`execute command:`, command, `settings:`, settings]);
            currentBetData.data[0].betFromParser = true;
            dLog('orange', 'gamdom', 'TESTING - simple wait 10 secs');
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
        await bMess('GamdomSport').set({action: command, data, balance});
        dLog('yellow', 'gamdom', [`Start waiting for command: ${command}`, data, balance]);
        return await bMess('GamdomResult')
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
                dLog('bigger-red', 'gamdom', [`TESTING MODE ${window.self === window.top} at:`,
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
                dLog('', 'gamdom', [`execute REGISTER_NEW, ${this.wasRegister}:`,
                    this.register]);
            }
            const res = await this.cLinks[command](data, command, getBalance(), this.testing)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'gamdom', [`${command} result:`, res]);
            this.prepareResult(command, res)
                .then(m => {
                    dLog('orange', 'gamdom', ['Prepared result: ', m]);
                    port.postMessage(m);
                })
            if (!res.success) {
                throw res.message;
            }
            return res;
        }

        async prepareResult(command, res) {
            dLog('orange', 'gamdom', [`prepareResult for ${command}`, res]);
            if (['BET', 'EXPRESS_BET', 'FORK_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('gamdom', settings,
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
                    resultData.bookmaker = 'GAMDOM';
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
        dLog('green', 'gamdom', [`messageProcessor (${busy})`, message]);
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
            let idx = document.location.href.indexOf('hub88b-ytuoyswg.betsy.gg') > -1
                ? 'GamdomSport' : 'GamdomCommand';
            bMess(idx)
                .set(ourCommand.get(), increaseDelay ? 150000 : 0)
                .then(() => {
                    dLog('green', 'gamdom', [`Command (${idx}) was set till unload:`,
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
            pageLoadedAt = Date.now();
            bMess('GamdomCommand').check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'gamdom', [
                        `Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand
                    ]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'gamdom', 'No command!'));
        } else if (document.location.href.indexOf('sb.gamdom.onebittech.com') > -1) {
            // Hint: sports frame (here the most of work)
            (async () => {
                while (!stopSports) {
                    const csc = await bMess('GamdomSport')
                        .check(60000, true)
                        .catch(() => null);
                    if (csc !== null) {
                        sportProcessor(csc);
                    }
                    await delayPromise(500);
                }
            })();
            dLog('green', 'gamdom', 'Sport processor initialized!');
        } else {
            dLog('red', 'gamdom', `afterDOMLoaded ${document.location.href}`);
        }
        //window.postMessage({"wait": true,}, window.location.href);
        //dLog('blue', 'gamdom', nowFormatted() + `: [RCPT] Wait sent to/from ${document.location.href}`);
    }

})();
