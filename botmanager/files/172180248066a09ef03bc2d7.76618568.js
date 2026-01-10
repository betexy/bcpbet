(function () {

    "use strict";

    /**
     * @import libs/jquery-3.3.1.min.js
     */

    let newAPI = false;
    let authClicked = 0;
    let busy = false;
    let increaseDelay = false;
    let stopSports = false;
    let enterError = false;
    const $couponFrame = () => $('div#betslip-root-inner iframe').contents();
    const port = window.self === window.top
        ? chrome.runtime.connect({name: `port_pinup`})
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
        'TABLETENNIS': 'Table Tennis',
        'BASEBALL': 'Baseball',
        'BASKETBALL': 'Basketball',
        'CYBERSPORT': 'Esports',
    };

    const ourCommand = new ourCommandProto();
    const getBalance = returnNull => {
        const $b = $('span[data-testid="balanceAmount"]:visible');
        if ($b.length > 0) {
            return parseFloat($b.text().replace(',', '')
                .replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
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
            await closeAllWeNeed({
                'button.pu-welcome-banner__close': 'button.pu-welcome-banner__close',
                'button[data-testid="MtPopupdialogCloseBtn"]': 'button[data-testid="MtPopupdialogCloseBtn"]',
                'button[data-testid="firstBetDialogdialogCloseBtn"]': 'button[data-testid="firstBetDialogdialogCloseBtn"]',
            });
            const $logLink = $('button[data-testid="loginBtn"]');
            const liveLink = 'a[data-testid="liveSportLink"]';
            if ($logLink.length > 0) {
                // Hint: Log In
                port.postMessage({m: "tech works! 2"});
                await delayPromise(555);
                await tryToLogIn().catch(e => bsError(port, 'Error login: ' + e));
            } else if ($('span[data-testid="balanceAmount"]:visible').length > 0) {
                //go to live if needed
                if (!$(liveLink).hasClass('ui-menu-list-item_active')) {
                    await delayPromise(3333);
                    await mouseChain({target: $(liveLink)[0], events: fullClick, error: 'LIVE'});
                    await delayPromise(1555);
                }
                if ($('button[data-testid="langSwitcherBtn"] img[alt="en"]').length === 0) {
                    await mouseChain({target: $('button[data-testid="langSwitcherBtn"]')[0], events: fullClick, error: 'lang'});
                    await delayPromise(1222);
                    await mouseChain({target: $('ui-language-list-item[data-testid="enSelectLangBtn"]')[0], events: fullClick, error: 'lang eng'});
                    await delayPromise(555);
                }
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch(e => dLog('red', 'pinup', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const submitLoginForm = async () => {
        await clearAndSimulate($('input#login')[0], settings.login);
        await delayPromise(1555);
        await clearAndSimulate($('input#password')[0], settings.password);
        await delayPromise(1555);
        await mouseChain({target: $('button[data-testid="loginBtn"]')[0], events: fullClick, error: 'form submit'});
        await delayPromise(555);
        authClicked = Date.now();
        const $checkBalance = await waitForElement('span[data-testid="balanceAmount"]:visible', 333, 11111).catch(() => $([]));

        if ($checkBalance.length === 0) {
            enterError = true;
        }
    };

    const tryToLogIn = async () => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        const $buttonLogin = $('button[data-testid="loginBtn"]');
        const formLogin = 'pu-login.pu-header__login-dropdown';
        if ($(formLogin).length > 0) {
            await submitLoginForm();
        } else if ($buttonLogin.length > 0) {
            await mouseChain({target: $buttonLogin[0], events: fullClick, error: '$buttonLogin'});
            await delayPromise(555);
            await waitForElement(formLogin, 333, 4444);
            await delayPromise(555);
            
            await submitLoginForm();
        }
        dLog('', 'pinup', 'Auth clicked!');
        return "auth_clicked";
    };

    const closePreviousCoupons = async skip => {
        if (skip) {
            return 'skipped!';
        }
        //expand coupon if needed
        if ($couponFrame().find('#dg_betslip_wrapper > div').hasClass('close')) {
            await mouseChain({target: $couponFrame().find('#dg_betslip_wrapper > div')[0], events: fullClick, error: 'expand coupon'});
            await delayPromise(555);
        }
        // Hint: Click 'Remove all' once or every 'Close'
        const $clearBtn = $couponFrame().find("button.dg_betslip_remove_all");
        if ($clearBtn.length === 1) {
            await mouseChain({
                target: $clearBtn[0],
                events: fullClick,
                scroll: true,
                error: 'c0'
            });
            await delayPromise(1555);
            const $apprBtn = $couponFrame().find('div.dg-bet-slip__modal-btn-col button:textEquals("Yes")');
            await mouseChain({
                target: $apprBtn[0],
                events: fullClick,
                scroll: true,
                error: 'c1'
            });
            await delayPromise(500);
            return 'ClearBtn clicked!';
        }
        while ($couponFrame().find("button.dg_betslip_ico-remove").length > 0) {
            await mouseChain({
                target: $couponFrame().find("button.dg_betslip_ico-remove").eq(0)[0],
                events: fullClick,
                scroll: true,
                error: 'c1'
            });
            await delayPromise(555);
        }
        return 'All were closed!';
    };

    const openEvent = async data => {
        dLog('red', 'pinup', ['openEvent', data]);
        let $el = $([]);
        const eventName = `${data.team1} — ${data.team2}`.toLowerCase();
        const sport = accordance[data.sport];
        const $sportHead = () => $(`span.sr-header-title-txt:textEquals("${sport}")`).closest('div');
        const checkWeAreThere = function () {
            const team1 = $('#home_tm_name:visible').trt();
            const team2 = $('#away_tm_name:visible').trt();
            const checkEvent = `${team1} — ${team2}`.toLowerCase();
            return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70;
        };
        if (checkWeAreThere()) {
            dLog('green', 'pinup', 'We probably on event page!');
            return 'We probably on event page!'
        }
        //wait for searchEl
        await waitForElement('input#srch_text', 333, 5555);
        await clearAndSimulate($('input#srch_text')[0], data.team1);
        await delayPromise(888);
        //click for search
        await mouseChain({target: $('a#srch_submit')[0], events: fullClick, error: 'click search'});
        await waitForElement('div.sr-match-item', 333, 12000);
        if ($sportHead().length > 0) {
            $sportHead().parent().find('div.sr-row-live').each(function () {
                const $teams = $(this).find('span.sr-team-name')
                if ($teams.length === 2) {
                    let checkEvent = `${$teams.eq(0).trt()} — ${$teams.eq(1).trt()}`.toLowerCase();
                    const res = checkEvent === eventName
                        || locutus_similar_text(checkEvent.replace(/(\()(.*?)(\))/g,''), eventName, true) > 80;
                    dLog('color: darkgray;', 'pinup',
                        `"${checkEvent}" ${(res ? '==' : '!=')} "${eventName}"`);
                    if (res) {
                        $el = $(this);
                        return false;
                    }
                }
            });
        }

        if ($el.length === 1) {
            await mouseChain({
                target: $el.find('div.sr-row-left')[0],
                events: fullClick,
                scroll: true,
                error: 'EVENT'
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
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Result',],
                    pivotKeys: ['Win1',],
                },
                'TWO': {
                    roots: ['Result',],
                    pivotKeys: ['Win2',],
                },
                'DRAW': {
                    roots: ['Result',],
                    pivotKeys: ['X', 'X',],
                },
                'ONE_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['1X',],
                },
                'TWO_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['X2',],
                },
                'ONE_TWO': {
                    roots: ['Double Chance'],
                    pivotKeys: ['12',],
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['Total', 'Asian Total',],
                    pivotKeys: ['Over (#PIVOT#)'],
                },
                'UNDER': {
                    roots: ['Total', 'Asian Total',],
                    pivotKeys: ['Under (#PIVOT#)'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['Total Team 1',],
                    pivotKeys: ['Over (#PIVOT#)'],
                },
                'UNDER': {
                    roots: ['Total Team 1',],
                    pivotKeys: ['Under (#PIVOT#)'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['Total Team 2',],
                    pivotKeys: ['Over (#PIVOT#)'],
                },
                'UNDER': {
                    roots: ['Total Team 2',],
                    pivotKeys: ['Under (#PIVOT#)'],
                },
            },
            'HDP': {
                'HOME': {
                    roots: ['Handicap', 'Asian Handicap'],
                    pivotKeys: ['Handicap 1 (#HPIVOT#)'],
                },
                'AWAY': {
                    roots: ['Handicap', 'Asian Handicap'],
                    pivotKeys: ['Handicap 2 (#HPIVOT#)'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    roots: ['European Handicap (#EPIVOT#)'],
                    pivotKeys: ['Win1']
                },
                'H2': {
                    roots: ['European Handicap (#EPIVOT#)'],
                    pivotKeys: ['Win2']
                },
                'HX': {
                    roots: ['European Handicap (#EPIVOT#)'],
                    pivotKeys: ['X']
                }
            },
        };

        /*
        const params = new AllMarkets(data);
        params.proceed_basketball = function (data) {
            if (!this.full) {
                this.addTo('roots', `${this.tDigit}-я четверть: `);
            }
        };
        marketsModifierAll(data, ['roots',], params, markets);
         */

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw `Unsupported ${data.time_value} / ${data.market} / ${data.target}`;
        }

        const m = markets[data.market][data.target];

        const ePivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };

        const hPivot = pvt => {
            const prfx = pvt > 0 ? '+' : pvt < 0 ? '-' : '';
            pvt = prfx + Math.abs(pvt);
            return pvt;
        };

        replaceInner(m, {
            '#TEAM1#': data.team1,
            '#TEAM2#': data.team2,
            '#PIVOT#': data.pivot,
            '#HPIVOT#': hPivot(data.pivot),
            '#EPIVOT#': ePivot(data.pivot),
        });

        let $ts = $([]);
        if (data.sport === 'FOOTBALL' && data.time_value.indexOf('FULL') === -1) {
            for (const i in m.roots) {
                m.roots[i] = `1st half: ${m.roots[i]}`;
            }
            $ts = $('div.tab_selector span[title="1st half"]');
        } else {
            $ts = $('div.tab_selector span[title="Main"]');
        }
        if ($ts.length === 0) {
            throw `No TabSelector`;
        }
        if (!$ts.hasClass('tab_selector_active')) {
            await mouseChain({target: $ts[0], events: fullClick, error: '$ts'});
            await delayPromise(1000);
        }

        const q = data.time_value.replace(/[^\d]/g, '').trim();
        const idxArr = ['st', 'nd', 'rd', 'th'];
        const idx = idxArr[q - 1];

        if (data.sport === 'BASKETBALL' && data.time_value.indexOf('FULL') === -1) {
            for (const i in m.roots) {
                m.roots[i] = `${q+idx} Quarter: ${m.roots[i]}`;
            }
        } else if (data.sport === 'HOCKEY' && data.time_value.indexOf('FULL') === -1) {
            for (const i in m.roots) {
                m.roots[i] = `${q+idx} Period: ${m.roots[i]}`;
            }
        } else if (data.sport === 'VOLLEYBALL' && data.time_value.indexOf('FULL') === -1) {
            for (const i in m.roots) {
                m.roots[i] = `${q+idx} Set: ${m.roots[i]}`;
            }
        } else if (data.sport === 'TABLETENNIS' && data.time_value.indexOf('FULL') === -1) {
            for (const i in m.roots) {
                m.roots[i] = `${q+idx} Set: ${m.roots[i]}`;
            }
        } else if (data.sport === 'CYBERSPORT') {
            if (data.market === 'HDP') {
                m.roots.push('Maps Handicap');
            }
            if (data.market === 'TOTAL') {
                m.roots.push('Total Maps');
            }
            if (data.time_value.indexOf('FULL') === -1) {
                for (const i in m.roots) {
                    m.roots[i] = `${q+idx} Map: ${m.roots[i]}`;
                }
            }
        } else if (data.sport === 'TENNIS') {
            if (data.market === 'HDP') {
                m.roots.push('Games Handicap');
            }
            if (data.market === 'TOTAL') {
                m.roots.push('Over/Under');
            }
            if (data.market === 'T1_TOTAL') {
                m.roots.push('Total Player 1');
            }
            if (data.market === 'T1_TOTAL') {
                m.roots.push('Total Player 2');
            }
            if (data.time_value.indexOf('FULL') === -1) {
                for (const i in m.roots) {
                    m.roots[i] = `${q}-й сет: ${m.roots[i]}`;
                }
            }
        }

        console.log('MARKET ', m);

        let $found = $([]);
        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = $(`div.tg__match_item div.tg__match_header span.tg__teams:textEqualsI("${root}"):visible`);
            if ($root.length === 0) {
                continue;
            }
            for (const pvt of m.pivotKeys) {
                const $pivot = $root.find(`span.tg__match_item_odd_name:textEqualsI("${pvt}"):visible`);

                if ($pivot.length === 0) {
                    $(`div.tg__match_item div.tg__match_header span.tg__teams:textEqualsI("${root}"):visible`).closest('div.tg__match_item')
                        .find(`span.tg__match_item_odd_name`).each(function () {
                        if ($(this).text().replace(/\u200e/g, '').trim() === pvt) {
                            $found = $(this);
                        }
                    });
                }

                if ($pivot.length === 1) {
                    $found = $pivot.parent();
                    break;
                } else if ($pivot.length > 1) {
                    throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                }
            }
        }
        if ($found.length === 0) {
            throw `${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot} not found :(`;
        } else {
            $found.closest('div.tg__match_item')[0].scrollIntoView();
        }
        return $found;
        //#-#-FINISH
    };

    const openCoupon = async paramData => {
        dLog('green', 'pinup', ['openCoupon, paramData:', paramData]);
        const EVENT_FINISHED = "This event is finished. Please, select another event";
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'pinup', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'pinup', 'Event must be opened!');
            //check event exist
            if ($(`div:textEquals(${EVENT_FINISHED})`).length > 0) {
                throw EVENT_FINISHED;
            }
            const $element = await getBetElement(data);
            console.log($element);
            let coefWeWaitFor = $element.find('div.coef').trt();
            dLog('green', 'pinup', 'We got element! Coef: ' + coefWeWaitFor);
            const waitForCouponVisibleStarted = Date.now();
            let elementWasClicked = 0;
            let performElementClick = async function () {
                dLog('green', 'pinup', 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                    + ') /' + (Date.now() - elementWasClicked));
                await mouseChain({target: $element[0], events: ['click'], error: 'performElementClick'})
                elementWasClicked = Date.now();
            };
            const checkCoupon = () => {
                const event = (data.team1 + ' - ' + data.team2).toLowerCase();
                let result = false;
                $couponFrame().find('div.dg_betslip_stake').each(function () {
                    const $teams = $(this).find('header.dg_betslip_stake_header span');
                    let ev = `${$teams.eq(0).trt()} - ${$teams.eq(2).trt()}`.toLowerCase();
                    if (event === ev || locutus_similar_text(event, ev, true) > 70) {
                        result = true;
                        return false;
                    } else {
                        dLog('red', 'pinup', `'${ev}' !== '${event}'`);
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
            const $skipBetSettings = await waitForCondition(() => $couponFrame().find('button.dg-bet-slip__intro-button--skip').length > 0,
            333, 2222, 'skip bet button').catch(() => $([]));
            if ($skipBetSettings.length > 0) {
                await mouseChain({target: $couponFrame().find('button.dg-bet-slip__intro-button--skip')[0], events: ['click'], error: '$skipBetSettings'});
            }
            const getMaxHere = async () => {
                return '7777777';
            };
            if (paramData.length > 1) {
                dLog('red', 'pinup', `Express here! ${i}/${(paramData.length - 1)}`);
                if (i === paramData.length - 1) {
                    return await getMaxHere();
                }
            } else {
                return await getMaxHere();
            }
        }
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => {
            const localMatch = v.team1.toLowerCase() + ' - ' + v.team2.toLowerCase();
            return localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 70;
        });
        const $coupons = $couponFrame().find('div.dg_betslip_stake');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const $teams = $this.find('header.dg_betslip_stake_header span');
            const match = `${$teams.eq(0).trt()} - ${$teams.eq(2).trt()}`;
            console.log(match);
            let localCoef = parseFloat($this.find('div[type="default"]').trt());
            let localData = findInData(match);
            let $checkErrors = $this.find('div.dg_betslip_stake_message');
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if ($checkErrors.length > 0) {
                errors.push($checkErrors.trt());
            }
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
            const checkRes = await eventsWorkAll('pinup',
                settings.eventMaxBets, settings.eventTimeLimit,
                currentBetData.data, false, true);
            if (checkRes !== 'OK') {
                dLog('red', 'pinup', `We got errors: ${checkRes}`);
                throw checkRes;
            } else {
                dLog('big-blue', 'pinup',
                    `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                for (const d of currentBetData.data) {
                    const eventName = `${d.team1} - ${d.team2}`;
                    dLog('blue', 'pinup', `${settings.eventMaxBets} for ${eventName} not reached`);
                }
            }
        }
        const checkSuccess = async () => {
            const started = Date.now();
            while (Date.now() - started < 30000) {
                const $alertText = $couponFrame().find('div.dg-bet-slip__notifications:visible');
                const acceptedText = $couponFrame().find('div#tstSlnBetSlipHeaderClosed');
                if ($alertText.length > 0) {
                    throw `Error: ${$alertText.trt()}`;
                } else if (acceptedText.length > 0) {
                    return true;
                }
                await delayPromise(333);
            }
            throw `No bet result in ${(Date.now() - started)}`;
        };
        const checkBalance = willPlace => {
            let localBalance = balance;
            if (localBalance < willPlace) {
                throw `NO_FUNDS - now: ${localBalance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };
        await closePreviousCoupons(false);
        currentBetData.max = await openCoupon(data);
        do {
            // Hint: Try to perform bet
            await checkCoefs(data);
            let willPlace = parseFloat(data[0].stake);
            if (currentBetData.max !== -1 && willPlace > currentBetData.max) {
                willPlace = currentBetData.max;
            }
            checkBalance(willPlace);
            dLog('green', 'pinup', `Will place (performBet): ${willPlace}, balance: ${balance}`);
            const $input = $couponFrame().find('div.dg_betslip_stake_input input');
            if ($input.length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            await clearAndInputNumber($input[0], willPlace.toString().replace('.00', '').trim());
            await delayPromise(800);
            dLog('green', 'pinup', `STAKE entered ${willPlace}`);
            let entered = parseFloat($input.val().replaceAll(' ', ''));
            dLog('green', 'pinup', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'pinup', 'Entered !== willPlace - try to reenter!');
                continue;
            }
            await delayPromise(1200);
            const $placeBtn = $couponFrame().find('button.dg_betslip_bet_btn');
            if ($placeBtn.length === 0 || $placeBtn.attr('disabled')) {
                throw 'No place button or button disabled!';
            }
            await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
        } while (!await checkSuccess());
        // Hint: collect result
        const res = await collectBetResult();
        if (!res || !res.success || !res.message) {
            throw 'Error collecting bet result!';
        }

        await mouseChain({target: $('span.dg_back_button')[0], events: fullClick, error: 'back history'});
        await delayPromise(555);

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

    const collectBetResult = async () => {
        let collected = [];
        const $expandCoupon = $couponFrame().find('div#tstSlnBetSlipHeaderClosed');
        await mouseChain({target: $expandCoupon[0], events: fullClick, scroll: true, error: 'expand row'});
        await delayPromise(333);
        await waitForCondition(() => $couponFrame().find('button.dg_bet_slip_empty_button:textEquals("Bet History")').length > 0,
            333, 5555, 'history button');
        await mouseChain({
            target: $couponFrame().find('button.dg_bet_slip_empty_button:textEquals("Bet History")')[0],
            events: fullClick,
            scroll: true,
            error: 'history click'
        });

        const $historyBox = await waitForElement('div.bh_aside_content', 333, 15000);
        
        if ($historyBox.length > 0) {
            const state = $historyBox.find('span.bh_card_header_info_status').trt();
            collected.push({
                external_id: $historyBox.find('span.bh_card_header_info_id').trt().replace(/[^\d.]/g, '').trim(),
                status: state === 'Win' ? 'WON' : state === 'Lost' ? 'LOSE' : 'ACCEPTED',
                match: $historyBox.find('span.bh_details_item_header_team').trt(),
                bkPivot: $historyBox.find('span.bh_details_item_market_actual').trt(),
                coef: $historyBox.find('span.bh_details_item_num').trt(),
                stake: $historyBox.find('span.bh_card_footer_sum_amount span.bh_details_amount').trt(),
                result: '',
            });
        }

        return {success: true, message: collected};
    };

    const collectBetResultsSports = async (inD, command, balance, inplay) => {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 35 ? parseInt(inD[1]) : 35) : 30;
        dLog('green', 'pinup', [`collectBetResults, limit: ${limit}, inplay: ${inplay}, data: `, data]);
        const $expandCoupon = () => $couponFrame().find('div#tstSlnBetSlipHeaderClosed');
        if ($expandCoupon().length > 0) {
            await mouseChain({target: $expandCoupon()[0], events: fullClick, scroll: true, error: 'expand row'});
            await delayPromise(333);
        }
        await waitForCondition(() => $couponFrame().find('button.dg_bet_slip_empty_button:textEquals("История Ставок")').length > 0,
            333, 3333, 'history button').catch(() => $([]));
        if ($couponFrame().find('button.dg_bet_slip_empty_button:textEquals("История Ставок")').length === 0) {
            await closePreviousCoupons(false);
            await delayPromise(333);
            if ($expandCoupon().length > 0) {
                await mouseChain({target: $expandCoupon()[0], events: fullClick, scroll: true, error: 'expand row'});
                await delayPromise(333);
            }
        }
        await delayPromise(333);
        await mouseChain({
            target: $couponFrame().find('button.dg_bet_slip_empty_button:textEquals("История Ставок")')[0],
            events: fullClick,
            scroll: true,
            error: 'history click'
        });
        const rowSel = 'div.tg__bet_history_row';
        const $rows = await waitForElement(rowSel, 333, 15000);
        for (let i = 0; i < $rows.length; i++) {
            if (i >= limit) {
                break;
            }
            const $this = $(rowSel).eq(i);
            const $cols = $this.find('div.tg_bet_history_col');
            const external_id = $cols.eq(1).trt();
            if (data.length === 0 || data.indexOf(external_id) > -1) {
                let opened = false;
                let tries = 0;
                while (!opened && tries < 5) {
                    await mouseChain({
                        target: $cols.eq(0)[0], events: fullClick,
                        error: 'ro', scroll: true
                    });
                    await delayPromise(500);
                    await waitForCondition(() => $(rowSel).eq(i).next().attr('class') === '',
                        333, 10000, 'Bad next!')
                        .catch(() => (opened = false, tries++, dLog('red', 'pinup', `NOT OPENED! ${tries}`)));
                    await delayPromise(1000);
                    opened = true;
                }
                const stake = $cols.eq(3).trt().replace(/\s/g, '');
                const result = $this.find('div.tg_table_lg').trt();
                const state = $cols.eq(7).trt() === '' ? $cols.eq(6).trt() : $cols.eq(7).trt();
                const $next = $(rowSel).eq(i).next();
                const $coef = () => $next.find('div.tg_bet_history_col').eq(4).text()
                    .replace('Коэфф.:', '')
                    .replace(/[^\d.]/g, '').trim();
                await waitForCondition(() => $coef() !== '', 333, 10000);
                collected.push({
                    external_id,
                    status: state === 'Выигрыш' ? 'WON' : state === 'Проигрыш' ? 'LOSE' : 'ACCEPTED',
                    match: $next.find('div.tg_bet_history_col').eq(1)
                        .find('div.tg--align-center').trt(),
                    bkPivot: $next.find('div.tg_bet_history_col').eq(3)
                        .find('div:not([class])').text().replace(/\s+/g, ' ').trim(),
                    coef: $coef(),
                    stake: stake,
                    result,
                });
                await mouseChain({target: $cols.eq(0)[0], events: fullClick, error: 'ro2', scroll: true});
                await delayPromise(500);
            }
        }
        dLog('green', 'pinup', ['Collected', collected]);
        await mouseChain({target: $('#maPageCloseButton')[0], events: fullClick, error: ''})
            .catch(() => dLog('red', 'pinup', 'No close btn'));
        return {success: true, message: collected};
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
            dLog('green', 'pinup', [command, data]);
            const res = await this.cLinks[command](data, balance)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'pinup', [`${command} sports result was set:`, res]);
            await bMess('PinSportResult').set(res);
            return res;
        }
    };

    const sportProcessor = command => {
        dLog('green', 'pinup', `SportProcessor: ${command.action}`);
        if (sportCommands.exists(command.action)) {
            // Hint: execute command
            ourCommand.set(command);
            sportCommands.execute(command.action, command.data, command.balance)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'pinup', ['Unknown Sport command:', command]);
        }
    };

    const executeSportCommand = async (data, command, balance) => {
        dLog('green', 'pinup', `executeSportCommand: ${command}, ${balance}`);
        await bMess('PinSportCommand').set({action: command, data, balance});
        const res = await bMess('PinSportResult')
            .get(50000, 10000, 300, true);
        return res;
    };

    const commands = new class commands {
        constructor() {
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
            //dLog('green', 'pinup', [`commands execute ${command}`, data, formatStack((new Error()).stack)]);
            const res = await this.cLinks[command](data, command, getBalance()).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'pinup', [`${command} result:`, res]);
            port.postMessage(await this.prepareResult(command, res));
            if (!res.success) {
                throw res.message;
            }
            return res;
        }

        async prepareResult(command, res) {
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
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
                if (res.success) {
                    await eventsWorkAll('pinup',
                        settings.eventMaxBets, settings.eventTimeLimit,
                        currentBetData.data, true, true);
                    await bMess('WasSuccessStake').set(Date.now());
                    await bMess('Stake Maximums').set(0);
                }
                const doNotSend = !!currentBetData.data[0].betFromParser && !res.success
                    && resultData.status !== 'LIMITED';
                if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'PINUP';
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
                    doNotSend,
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
        dLog('green', 'pinup', [`messageProcessor (${busy})`, message]);
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
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 1;
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
            dLog('green', 'pinup', ['Command was set till unload:', ourCommand.get()]);
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess('PINUP_COMMAND', true).set(ourCommand.get(), increaseDelay ? 130000 : 0);
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
            bMess('PINUP_COMMAND', true).check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'pinup', [
                        `Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand
                    ]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'pinup', 'No command!'));
        } else if (document.location.href.indexOf('sport.pin-up340.com/SportsBook/Overview') > -1) {
            // Hint: sports frame (here the most of work)
            (async () => {
                while (!stopSports) {
                    const csc = await bMess('PinSportCommand').check(10000, true)
                        .catch(() => null);
                    if (csc !== null) {
                        sportProcessor(csc);
                    }
                    const $li = $('div.tab_selector:contains("Live Info")');
                    if ($li.length > 0 && !$li.hasClass("tab_selector_active")) {
                        await mouseChain({target: $li[0], events: fullClick, error: '$li'});
                    }
                    await delayPromise(333);
                }
            })();
            dLog('green', 'pinup', 'Sport processor initialized!');
        }
    }

})();
