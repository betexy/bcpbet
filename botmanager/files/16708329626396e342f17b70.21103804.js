(function () {

    "use strict";

    /**
     * @import libs/jquery-3.3.1.min.js
     */

    let
        newAPI = false,
        authClicked = 0,
        busy = false,
        increaseDelay = false,
        loginMutex = false;

    const port = window.self === window.top && document.location.href.indexOf('cashier') === -1
        ? chrome.runtime.connect({name: `port_dafabet`})
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
        'TABLETENNIS': 'Table Tennis',
        'BASEBALL': 'Baseball',
        'BASKETBALL': 'Basketball',
        'CYBERSPORT': 'ESPORTS',
    };

    const ourCommand = new ourCommandProto();
    const smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);

    const getBalance = returnNull => {
        const $b = $(findSel(['#player-balance', '#product-balance',
            'span.header-authentication__details__balance--title']));
        if ($b.length > 0) {
            return parseFloat($b.text().replace(',', '')
                .replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    }

    const authCheck = function () {
        //dLog('', 'Dafabet', 'Auth check');
        (async () => {
            const $pc = $('div[class^="popupContent"] circle');
            if ($pc.length > 0) {
                await mouseChain({target: $pc[0], events: fullClick, error: '$pc'});
            }
            const $cn = $(findSel(['span.cookie-notif-close:visible',
                '#frosmo-cookie-alert a', '#deposit-notification-no', 'div#push-notification a:textEquals("OK")', 'div#modal-confirmation-timeout a.modal-close-button:visible']));
            if ($cn.length > 0) {
                await mouseChain({target: $cn[0], events: fullClick, error: '$cn'});
            }
            if ($('div.live-stream-video-player a.tracker:visible').length > 0) {
                const $cl = $('div.live-stream-video-player a:has(svg.expander)');
                if ($cl.length > 0) {
                    await mouseChain({target: $cl[0], events: fullClick, error: '$cl'});
                }
            }
            const $logLink = $(findSel(['#LoginForm_submit', '#loginBtnForm']));
            if ($logLink.length > 0) {
                // Hint: Log In
                port.postMessage({m: "tech works! 2"});
                await delayPromise(1000);
                if (!loginMutex) {
                    loginMutex = true;
                    await tryToLogIn()
                        .catch(e => bsError(port, 'Error login: ' + e));
                    loginMutex = false;
                }
            } else {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch(e => dLog('red', 'Dafabet', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const tryToLogIn = async () => {
        //throw 'Testing!';
        dLog('red', 'DB', `tryToLogin at ${document.location.href}`);
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        const sels = [
            findSel(['#LoginForm_submit', '#loginBtnForm']),
            findSel(['#LoginForm_username', '#userName']),
            findSel(['#LoginForm_password', '#password']),
        ];
        await waitForCondition(() => sels.every(s => $(s).length > 0 && elementIsVisible($(s)[0])),
            333, 10000, 'No inputs!');
        await delayPromise(500);
        await clearAndSimulate($(sels[1])[0], settings.login);
        await delayPromise(2000);
        await clearAndSimulate($(sels[2])[0], settings.password);
        await delayPromise(3000);
        authClicked = Date.now();
        await mouseChain({target: $(sels[0])[0], events: fullClick, error: 'Enter'});
        dLog('', 'DF', 'Auth clicked!');
        return "auth_clicked";
    };

    const closePreviousCoupons = async skip => {
        if (skip) {
            return 'skipped!';
        }
        // Hint: Click 'Remove all' once or every 'Close'
        let $clearBtn = $(findSel(['a.clear_betslip', '#js-betslip-clear']));
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
    };

    const openEvent = async data => {
        dLog('red', 'Dafabet', ['openEvent', data, document.location.href]);
        const eventName = `${data.team1} — ${data.team2}`.toLowerCase();
        const checkWeAreThere = function () {
            const teams = $(findSel(['span.live-event', ''])).trt().split(' vs ');
            if (teams.length === 2) {
                const checkEvent = `${teams[0].trim()} — ${teams[1].trim()}`
                    .toLowerCase();
                return checkEvent === eventName
                    || locutus_similar_text(checkEvent, eventName, true) > 70;
            } else {
                return false;
            }
        };
        const switchToSport = async sport => {
            dLog('red', 'Dafabet', `switchToSport: ${sport}`);
            const s = accordance[sport];
            const sportSel = `li.live-sport-selector:has(div.coupon_name:textEquals("${s}"))`;
            const $sport = await waitForElement(sportSel, 333, 15000);
            if (!$sport.hasClass('active')) {
                await mouseChain({
                    target: $sport[0],
                    events: fullClick,
                    error: `switchToSport`,
                    scroll: true
                });
                await delayPromise(888);
            }
        };
        if (checkWeAreThere()) {
            return 'We probably on event page!'
        }
        const $overview = $('li:has(a[title="Overview"])');
        if (!$overview.hasClass('selected')) {
            await mouseChain({
                target: $overview.find('a')[0],
                events: fullClick,
                scroll: true,
                error: '$overview'
            });
            await delayPromise(888);
        }
        await switchToSport(data.sport);
        await delayPromise(555);
        let $el = $([]);
        const $eventsList = await waitForElement('div.event-description', 333, 15000);
        $eventsList.each(function () {
            const
                $teams = $(this).find('a.opponent-name'),
                evHere = `${$teams.eq(0).trt()} — ${$teams.eq(1).trt()}`.toLowerCase();
            if (evHere === eventName
                || locutus_similar_text(evHere, eventName, true) > 70) {
                $el = $(this);
                return false;
            } else {
                console.log(`${evHere} !== ${eventName}`);
            }
        });
        if ($el.length === 1) {
            await mouseChain({
                target: $el.find('a')[0], events: fullClick, scroll: true, error: 'EVENT'
            });
        } else {
            throw 'Wrong length of Event: ' + $el.length;
        }
        await waitForCondition(() => checkWeAreThere(),
            777, 30000, 'We are not on event!');
        return 'Switched to event!';
    };

    const getBetElement = async data => {
        //#-#-START
        const teams = $('span.live-event').trt().split(' vs ');
        if (teams.length !== 2) {
            throw 'No teams!';
        }
        data.team1 = teams[0].trim();
        data.team2 = teams[1].trim();
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Match Result', 'Win/Draw/Win',],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    roots: ['Match Result', 'Win/Draw/Win',],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    roots: ['Match Result', 'Win/Draw/Win',],
                    pivotKeys: ['Draw',],
                },
                'ONE_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# / Draw',],
                },
                'TWO_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM2# / Draw',],
                },
                'ONE_TWO': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# / #TEAM2#',],
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['Over / Under',],
                    pivotKeys: ['Over #SHPIVOT#'],
                },
                'UNDER': {
                    roots: ['Over / Under',],
                    pivotKeys: ['Under #SHPIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['Over / Under - #TEAM1#',],
                    pivotKeys: ['Over #SHPIVOT#'],
                },
                'UNDER': {
                    roots: ['Over / Under - #TEAM1#',],
                    pivotKeys: ['Under #SHPIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['Over / Under - #TEAM2#',],
                    pivotKeys: ['Over #SHPIVOT#'],
                },
                'UNDER': {
                    roots: ['Over / Under - #TEAM2#',],
                    pivotKeys: ['Under #SHPIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    roots: ['Corners Over / Under',],
                    pivotKeys: ['Over #SHPIVOT#'],
                },
                'UNDER': {
                    roots: ['Corners Over / Under',],
                    pivotKeys: ['Under #SHPIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    roots: ['Asian Handicap'],
                    pivotKeys: ['#TEAM1# #SHDP#'],
                },
                'AWAY': {
                    roots: ['Asian Handicap'],
                    pivotKeys: ['#TEAM2# #SHDP#'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    roots: ['European Handicap', '3-Way Fixed Handicap'],
                    pivotKeys: ['#TEAM1# #HPIVOT#'],
                },
                'H2': {
                    roots: ['European Handicap', '3-Way Fixed Handicap'],
                    pivotKeys: ['#TEAM2# #HPIVOT#'],
                },
                'HX': {
                    roots: ['European Handicap', '3-Way Fixed Handicap'],
                    pivotKeys: ['Draw / #TEAM2# #HPIVOT#'],
                }
            },
        };

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw `Unsupported ${data.time_value} / ${data.market} / ${data.target}`;
        }

        const m = markets[data.market][data.target];
        m.roots.forEach((v, i) => m.roots[i] = `${v} - `
            + (data.time_value.indexOf('FULL') === -1
                ? 'First Half' : 'Regular Time'));

        if (data.time_value.indexOf('FULL') === -1) {
            const timing = data.time_value.replace(/[^\d]/g, '').trim();
            const prefix = ['st', 'nd', 'rd', 'th'];
            const findPrefix = prefix[timing - 1];
            if (data.sport === 'VOLLEYBALL') {
                if (data.market === 'ONE_TWO') {
                    m.roots.push(`Head To Head - ${timing}${findPrefix} Set`);
                }
                if (data.market === 'HDP') {
                    m.roots.push(`Asian Handicap Points - ${timing}${findPrefix} Set`);
                }
                if (data.market === 'TOTAL') {
                    m.roots.push(`Over/Under (Points) - ${timing}${findPrefix} Set`);
                }
            }
            if (data.sport === 'HOCKEY') {
                if (data.market === 'ONE_TWO') {
                    m.roots.push(`Win/Draw/Win - ${timing}${findPrefix} Period `);
                }
                if (data.market === 'HDP') {
                    m.roots.push(`Asian Handicap - ${timing}${findPrefix} Period`);
                }
                if (data.market === 'TOTAL') {
                    m.roots.push(`Total Goals Over/ Under - ${timing}${findPrefix} Period`);
                }
                if (data.market === 'T1_TOTAL') {
                    m.roots.push(`Total Goals Over/ Under - #TEAM1# - ${timing}${findPrefix} Period`);
                }
                if (data.market === 'T2_TOTAL') {
                    m.roots.push(`Total Goals Over/ Under - #TEAM2# - ${timing}${findPrefix} Period`);
                }
            }
            if (data.sport === 'TENNIS') {
                if (data.market === 'ONE_TWO') {
                    m.roots.push(`Head To Head - ${timing}${findPrefix} Set`);
                }
                if (data.market === 'TOTAL') {
                    m.roots.push(`Over/Under Games - ${timing}${findPrefix} Set`);
                }
                if (data.market === 'HDP') {
                    m.roots.push(`Asian Handicap - Games - ${timing}${findPrefix} Set`);
                }
            }
        } else {
            if (data.sport === 'TENNIS') {
                if (data.market === 'ONE_TWO') {
                    m.roots.push('Head To Head - Match');
                }
                if (data.market === 'TOTAL') {
                    m.roots.push('Over/Under Games - Match');
                }
                if (data.market === 'HDP') {
                    m.roots.push('Asian Handicap - Games - Match');
                }
            }
            if (data.sport === 'HOCKEY') {
                if (data.market === 'TOTAL') {
                    m.roots.push('Total Goals Over/ Under - Match');
                }
                if (data.market === 'T1_TOTAL') {
                    m.roots.push('Total Goals Over/ Under - #TEAM1# - Regular Time');
                }
                if (data.market === 'T2_TOTAL') {
                    m.roots.push('Total Goals Over/ Under - #TEAM2# - Regular Time');
                }
            }
            if (data.sport === 'VOLLEYBALL') {
                if (data.market === 'ONE_TWO') {
                    m.roots.push('Head To Head - Match');
                }
                if (data.market === 'HDP') {
                    m.roots.push('Asian Handicap Points - Match');
                }
                if (data.market === 'TOTAL') {
                    m.roots.push('Over/Under (Points) - Match');
                }
            }
        }

        dLog('green', 'Dafabet', ['Final market is:', m]);

        const
            ePivot = pvt => {
                const p = parseInt(pvt);
                return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
            },
            hPivot = pvt => parseFloat(pvt) > 0 ? `+${pvt}` : `${pvt}`,
            specialHdp = p => {
                // Zero returns zero
                // Straights and halves returns as is
                // if pivots has quarters - it rounds to closest half, it's adds to pivot
                // i.r. 1.75 = 1.5,2 or 1.25 = 1,1.5
                const
                    pvt = parseFloat(p),
                    factor = pvt < 0 ? -1 : 1,
                    f = pvt => {
                        const withFactor = pvt * factor;
                        return withFactor > 0 ? `+${withFactor}` : withFactor
                    };
                if (pvt === 0) {
                    return '0';
                } else if ((pvt / 0.25) % 2 === 0) {
                    return hPivot(pvt);
                } else {
                    const integerPart = Math.abs(Math.trunc(pvt));
                    if (Math.abs(pvt) - integerPart < 0.5) {
                        return f(integerPart) + ',' + f(integerPart + 0.5);
                    } else {
                        return f(integerPart + 0.5) + ',' + f(integerPart + 1);
                    }
                }
            },
            specialTotal = p => specialHdp(p)
                .replace(/\+/g, '').replace(/-/g, ''),
            checkHdpFCoef = (x, min, max) => {
                return x >= min && x <= max;
            };

        replaceInner(m, {
            '#TEAM1#': data.team1,
            '#TEAM2#': data.team2,
            '#PIVOT#': data.pivot,
            '#EPIVOT#': ePivot(data.pivot),
            '#HPIVOT#': hPivot(data.pivot),
            '#SHDP#': specialHdp(data.pivot),
            '#SHPIVOT#': specialTotal(data.pivot),
        });

        const $all = await waitForElement('button:textEquals("All Markets")', 333, 15000);
        if (!$all.hasClass('active')) {
            await mouseChain({target: $all[0], events: fullClick, error: '$all'});
            await delayPromise(1000);
        }
        await waitForCondition(() => $('div.market-container:visible').length > 0, 333, 10000, 'markets is not exist!');
        let $found = $([]);
        for (const root of m.roots) {
            const $root = () =>
                $(`div.market-container:visible:has(h2.event_path-title:textStartsIS("${root}"))`);
            console.log(`Checking root ${root}: ${$root().length}`);
            if ($root().length === 0) {
                continue;
            }
            if ($root().find('div.rollup:visible').length === 0) {
                await mouseChain({
                    target: $root().find('div.collapse-button')[0],
                    events: fullClick, error: 'collapse', scroll: true
                });
                await delayPromise(1000);
            }
            if (data.sport === 'FOOTBALL' && data.market === 'HDP') {
                const coef = parseFloat(data.coef);
                const evens = data.target === 'HOME' ? 'even' : 'odd';
                for (const element of $root().find('table td:' + evens).find('span.price')) {
                    const localCoef = parseFloat($(element).trt());
                    if (checkHdpFCoef(localCoef, coef, coef + 0.13)) {
                        $found = $(element);
                        break;
                    }
                }
            } else {
                for (const pvt of m.pivotKeys) {
                    let $pvt;
                    $pvt = () => $root()
                        .find(`span.price[data-description="${pvt}"]`);
                    console.log(`Checking pivot ${pvt}: ${$pvt().length}`);
                    if ($pvt().length > 0) {
                        $found = $pvt();
                    }
                }
            }
            if ($found.length > 0) {
                break;
            }
        }
        if ($found.length === 0) {
            throw `${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot}`
            + ' not found :(';
        } else {
            $found.closest('div.market-container')[0].scrollIntoView();
            window.scrollBy(0, -200);
        }
        return $found;
        //#-#-FINISH
    };

    const openCoupon = async paramData => {
        dLog('green', 'Dafabet', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'Dafabet', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'Dafabet', 'Event must be opened!');
            const $element = await getBetElement(data);
            console.log($element);
            let coefWeWaitFor = $element.trt();
            dLog('green', 'Dafabet', 'We got element! Coef: ' + coefWeWaitFor);
            const waitForCouponVisibleStarted = Date.now();
            let elementWasClicked = 0;
            let performElementClick = async function () {
                dLog('green', 'Dafabet', 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                    + ') /' + (Date.now() - elementWasClicked));
                await mouseChain({target: $element[0], events: ['click'], error: 'performElementClick'})
                elementWasClicked = Date.now();
                const $qb = await waitForElement('div.quick-bet-component',
                    333, 1500).catch(e => $([]));
                if ($qb.length > 0) {
                    await mouseChain({
                        target: $qb.find('span.quick-bet-toggle')[0],
                        events: fullClick, error: '$coupClose'
                    });
                    await performElementClick();
                }
            };
            const checkCoupon = () => {
                let event = (data.team1 + ' vs ' + data.team2).toLowerCase();
                let result = false;
                $('li.bet-input-container').each(function () {
                    let ev = $(this)
                        .find('a.selection-event-description-link').trt().toLowerCase();
                    if (event === ev || locutus_similar_text(event, ev, true) > 60) {
                        result = true;
                        return false;
                    } else {
                        dLog('red', 'Dafabet', `'${ev}' !== '${event}'`);
                    }
                });
                return result;
            };
            while (!checkCoupon() && Date.now() - waitForCouponVisibleStarted < 15000) {
                await performElementClick();
                await delayPromise(1000);
            }
            if (!checkCoupon()) {
                throw `Coupon not opened!`;
            }
            const getMaxHere = async () => {
                return 7777777;
            };
            if (paramData.length > 1) {
                dLog('red', 'Dafabet', `Express here! ${i}/${(paramData.length - 1)}`);
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
            const localMatch = v.team1.toLowerCase() + ' - ' + v.team2.toLowerCase();
            return localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 70;
        });
        const $coupons = $('li.bet-input-container');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $this
                .find('a.selection-event-description-link').trt().toLowerCase();
            console.log(match);
            let localCoef = parseFloat($this.closest('h3.row')
                .find('span.formatted_price').trt());
            let localData = findInData(match);
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if (!localData || isNaN(localCoef)) {
                errors.push(match + ' LOW_COEF - wrong match or localCoef!');
                checked++;
            } else {
                checked++;
            }
        });
        checkNewCoefs(data, checked, totalCoef, errors);
    };

    /*
    // Test:
    await checkCoefs([
        {team1: 'Серро Портеньо', team2: 'Олимпия А', coef: '2.1'},
        {team1: 'Оклахома Энерджи', team2: 'Остин Болд', coef: '2.1'},
    ]);
     */

    const depositCashier = async data => {
        const renewCommand = async inc => await bMess('DafabetCashierCommand').set(ourCommand.get(),
            inc ? 120000 : 0);
        if (data.paysystem !== 'NETELLER') {
            throw `Deposit possible only from NETELLER!`;
        }
        dLog('orange', 'DC', ['depositCashier:', data]);
        if (ourCommand.getAdded('NetellerOpened')) {
            dLog('orange', 'DC', `Wait for deposit result`);
            return await bMess('DEPOSIT_RESULT', true).get(200000, 60000)
                .catch(() => ({success: false, message: 'No result for 200s :('}));
        } else if (document.location.href.indexOf('payment-options?transaction=deposit') > -1) {
            dLog('orange', 'DC', `Select paysystem`);
            const $db2 = await waitForElement('li#deposit', 333, 15000);
            if (!$db2.hasClass('active')) {
                await mouseChain({target: $db2[0], events: fullClick, error: '$db2'});
                await delayPromise(3000);
            }
            const $nb = await waitForElement('a#NET001', 333, 15000);
            await renewCommand();
            await mouseChain({target: $nb[0], events: fullClick, error: '$nb'});
            await delayPromise(5000);
        } else if (document.location.href.indexOf('payment-options/deposit/2') > -1) {
            dLog('orange', 'DC', `Filling form`);
            const $st = await waitForElement('div.form-item-product div.selectedTxt', 333, 15000);
            if ($st.text().indexOf('Common Wallet') === -1) {
                await selectLikePuppeteer($('#edit-product')[0], ['90']);
                await delayPromise(10000);
            }
            const $amount = await waitForElement('#edit-amount', 333, 15000);
            await clearAndSimulate($amount[0], data.amount);
            ourCommand.add('NetellerOpened', true);
            ourCommand.add('close', true);
            await bMess('NETELLER_COMMAND', true).set(ourCommand.get());
            await delayPromise(2000);
            await mouseChain({target: $('#edit-submit')[0], events: fullClick, error: 'eds'});
            await renewCommand(true);
            await delayPromise(5000);
        } else if (document.location.href.indexOf('payment-options?transaction=deposit') === -1) {
            dLog('orange', 'DC', `Go to deposit`);
            const $db = await waitForElement('a[href="/en-eur/payment-options/deposit"]', 333, 15000);
            await renewCommand();
            await mouseChain({target: $db[0], events: fullClick, error: '$db'});
            await delayPromise(5000);
        } else {
            throw `Unsupported situation at: ${document.location.href}`;
        }
    };

    const deposit = async data => {
        if (ourCommand.getAdded('PsOpened')) {
            dLog('orange', 'Dafabet', `Wait for deposit result`);
            return await bMess('DEPOSIT_RESULT', true).get(200000, 60000)
                .catch(() => ({success: false, message: 'No result for 200s :('}));
        } else if (document.location.href.indexOf('/deposit-cash/') > -1) {
            const $ps = await waitForElement(`div[data-provider="${data.paysystem.toLowerCase()}"]`,
                333, 15000);
            if ($ps.attr('class').indexOf('active') === -1) {
                await delayPromise(2000);
                await mouseChain({target: $ps [0], events: fullClick, error: '$ps', scroll: true});
            }
            const $akd = await waitForElement('input.acknowledge-deposit', 333, 2000)
                .catch(() => $([]));
            if ($akd.length > 0 && !$akd.prop('checked')) {
                await delayPromise(2000);
                await mouseChain({target: $akd [0], events: fullClick, error: '$akd'});
            }
            await delayPromise(2000);
            await clearAndInputNumber($('#amount')[0], data.amount);
            if (data.paysystem === 'NETELLER') {
                await delayPromise(2000);
                await clearAndSimulate($('#verificationCode')[0], data.pin);
            }
            ourCommand.add('PsOpened', true);
            await bMess(`${data.paysystem}_COMMAND`, true).set(ourCommand.get());
            await delayPromise(1000);
            await mouseChain({
                target: $('span.form__row__info:contains("Required fields")')[0],
                events: fullClick,
                error: 'Required',
                scroll: true,
            });
            await delayPromise(2000);
            await mouseChain({
                target: $('#makePaymentBtn')[0], events: fullClick, error: 'makePaymentBtn'
            });
        } else {
            const $dep = await waitForElement('button:textEquals("Deposit")', 333, 15000);
            await delayPromise(2000);
            await mouseChain({target: $dep[0], events: fullClick, error: '$dep'});
        }
        await delayPromise(100000);
        throw `Very strange situation!`;
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
                    dLog('orange', 'Dafabet', `sms: '${m}'`);
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
            await delayPromise(1000000);
        }
    };

    const proceedBet = async (data) => {
        const
            $live = $(findSel(['ul.buttons li:has(a.menu:textEquals("Live"))',
                'nav.navigation__main a[href="/sportsbook/all-in-play/"]'])),
            $overview = $(findSel(['li:has(a[title="Overview"])',
                'ul.column-list a[href="/sportsbook/all-in-play/"]']));
        if ($overview.length === 0) {
            await mouseChain({target: $live.find('a')[0], events: fullClick, error: '$live'});
            await delayPromise(1222);
        }
        const checkSuccess = async () => {
            const started = Date.now();
            while (Date.now() - started < 30000) {
                const alertText = $('div.betslip-singles-messages div.error:visible').trt();
                const acceptedText = $('h4.betslip-confirmed-title').trt();
                if (alertText.indexOf('Error in the params.') > -1 || alertText.indexOf('changed') > -1) {
                    return false;
                } else if (alertText !== '') {
                    throw `Error: $
                    {alertText}`;
                } else if (acceptedText.indexOf('confirmed') > -1) {
                    return true;
                }
                await delayPromise(400);
            }
            throw `No bet result in ${(Date.now() - started)}`;
        };
        const checkBalance = willPlace => {
            const balance = getBalance();
            if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };
        await closePreviousCoupons(false);
        currentBetData.max = await openCoupon(data);
        //coupon must be opened!
        do {
            // Hint: Try to perform bet
            await checkCoefs(data);
            let willPlace = parseFloat(data[0].stake);
            if (currentBetData.max !== -1 && willPlace > currentBetData.max) {
                willPlace = currentBetData.max;
            }
            checkBalance(willPlace);
            dLog('green', 'Dafabet', `Will place (performBet): ${willPlace}`);
            const $input = $('div.stake-input-wrapper:last input:visible');
            if ($input.length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            await clearInputElement({element: $input[0]});
            await dClick($input[0]);
            $input[0].focus();
            await delayPromise(888);
            console.log(await bsType('sender', willPlace.toString()
                .replace('.00', '').trim(), true, 300));
            await delayPromise(1333);
            if (parseFloat($input.val()) !== willPlace) {
                throw 'wrong value to input!';
            }
            dLog('green', 'Dafabet', `STAKE entered ${willPlace}`);
            if ($('ul.selection-errors li').length > 0) {
                throw $('ul.selection-errors li').trt();
            }
            const $placeBtn = await waitForElement('button.place_bet_button', 222, 10000).catch(e => $([]));
            if ($placeBtn.length > 0) {
                await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
            }
        } while (!await checkSuccess());
        // Hint: collect result
        const res = await collectBetResults(['limit', '1'], {}, 0, true);
        if (!res || !res.success || !res.message[0]) {
            throw 'Error collecting bet result!';
        }
        await mouseChain({
            target: $('#balance-control span.refresh-balance')[0], events: fullClick,
            error: 'updateBalance'
        });
        await delayPromise(1500);
        await waitForCondition(() => getBalance() > 0, 500, 15000,
            'Balance refresh error').catch(e => dLog('red', 'DF', `Error: ${e}`));
        await delayPromise(300);
        return {
            success: true,
            message: {
                external_id: res.message[0].external_id,
                coef: res.message[0].coef,
                stake: res.message[0].stake,
                max: currentBetData.max,
            },
        };
    };

    const collectBetResults = async (inD, command, balance, inplay) => {
        let collected = [], checked = 0;
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inplay ? 1 : inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        dLog('green', 'Dafabet',
            [`collectBetResults, limit: ${limit}, inplay: ${inplay}, data: `, data]);
        const $open = await waitForElement('a.bet-history', 333, 3000);
        await mouseChain({target: $open[0], events: fullClick, error: 'history'});
        await delayPromise(1000);
        const rowSel = 'tr.transactions-activity';
        for (const cur of ['pending', 'settled']) {
            const $cur = await waitForElement(`a[data-type="${cur}"]`, 333, 5000);
            if (!$cur.closest('div').hasClass('active')) {
                await mouseChain({target: $cur[0], events: fullClick, error: '$cur'});
                await delayPromise(1000);
            }
            const $p = await waitForElement('#last_week', 333, 10000);
            if (!$p.is(':checked')) {
                await mouseChain({target: $p[0], events: fullClick, error: '$p1'});
                await delayPromise(1000);
            }
            const $rows = await waitForElement(rowSel, 333, 5000)
                .catch(e => $([]));
            for (let i = 0; i < $rows.length; i++) {
                checked++;
                if (checked > limit) {
                    break;
                }
                const $this = $(rowSel).eq(i);
                const external_id = $this.find('td.id').trt();
                if (data.length === 0 || data.indexOf(external_id) > -1) {
                    const
                        stake = parseFloat($this.find('td.unit_stake').trt().replace(/[^\d.]/g, '')),
                        result = parseFloat($this.find('td.credit').trt().replace(/[^\d.]/g, '')),
                        coefRes = /@\s+([\d.]+)\s+\[/.exec($this.find('td.description').trt()),
                        status = cur === 'pending' ? 'ACCEPTED'
                            : (stake > result ? 'LOSE' : stake === result ? 'REFUNDED' : 'WON');
                    collected.push({
                        external_id,
                        status,
                        coef: coefRes && coefRes[1] ? coefRes[1] : '',
                        stake,
                        result,
                    });
                    await delayPromise(100);
                }
                if (inplay && collected.length > 0) {
                    break;
                }
            }
            if (inplay && collected.length > 0) {
                break;
            }
        }
        dLog('green', 'Dafabet', ['Collected', collected]);
        await mouseChain({target: $('#close_modal')[0], events: fullClick, error: 'close_modal'})
            .catch(() => dLog('red', 'Dafabet', 'No close btn'));
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
            dLog('green', 'Dafabet', [command, data]);
            const res = await this.cLinks[command](data, balance)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'Dafabet', `${command} sports result: ${res.message}`);
            await bMess('DafabetCashierResult').set(res);
            return res;
        }
    };

    const cashierProcessor = command => {
        dLog('green', 'Dafabet', `SportProcessor: ${command.action}`);
        if (cashierCommands.exists(command.action)) {
            // Hint: execute command
            ourCommand.set(command);
            cashierCommands.execute(command.action, command.data, command.balance)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'Dafabet', ['Unknown Sport command:', command]);
        }
    };

    const executeCashierCommand = async (data, command, balance) => {
        dLog('green', 'Dafabet', `executeCashierCommand: ${command}, ${balance}`);
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
            this.cLinks = {
                'BET': proceedBet,
                'EXPRESS_BET': proceedBet,
                'BET_RESULT': collectBetResults,
                'DEPOSIT': deposit,
                'WITHDRAW': executeCashierCommand,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data) {
            currentBetData.init(data);
            //dLog('green', 'Dafabet', [`commands execute ${command}`, data, formatStack((new Error()).stack)]);
            const res = await this.cLinks[command](data, command, getBalance()).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'Dafabet', `${command} result: ${res.message}`);
            port.postMessage(this.prepareResult(command, res));
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

        prepareResult(command, res) {
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                const resultData = {
                    "external_id": res.success ? res.message.external_id : '',
                    "status": res.success ? 'ACCEPTED' : ['LOW_COEF', 'NO_FUNDS', 'LIMITED']
                        .find(t => res.message.indexOf(t) > -1) || 'FAILED',
                    "market": currentBetData.data[0].market,
                    "target": currentBetData.data[0].target,
                    "pivot": currentBetData.data[0].pivot,
                    "coef": res.success ? res.message.coef : currentBetData.data[0].coef,
                    "stake": res.success ? res.message.stake : currentBetData.data[0].stake,
                    "maximum": res.success && res.message.max ? res.message.max : 0,
                };
                return {
                    answered: "BET",
                    data: resultData,
                    answer: res.success ? 'Everything is Okay!' : (resultData.status === 'LIMITED' ? 'Tried to bet 0' : res.message)
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
        dLog('green', 'Dafabet', [`messageProcessor (${busy})`, message]);
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
            dLog('green', 'Dafabet', ['Command was set till unload:', ourCommand.get()]);
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess('DAFABET_COMMAND', true).set(ourCommand.get(), increaseDelay ? 130000 : 0);
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});
        if (window.self === window.top && document.location.href.indexOf('cashier') > -1) {
            dLog('red', 'Dafabet', 'Attempt to start the old way!');
            /*
            bMess('DafabetCashierCommand').check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'Dafabet', [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`, currentCommand]);
                    cashierProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'Dafabet', 'No command!'));
            */
        } else if (window.self === window.top) {
            // Hint: main window (outer with auth, menu, balance, etc.)
            bMess('DAFABET_COMMAND', true).check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'Dafabet',
                        [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`, currentCommand]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'Dafabet', 'No command!'));
        }
    }

})();
