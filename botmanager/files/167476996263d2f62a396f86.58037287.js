(() => {

    'use strict';

    const isMain = window.self === window.top;

    let limited = false;
    let authClicked = 0;
    let authClickedTime = 0;
    let wasAuthCheck = false;
    let busy = false;
    let increaseDelay = false;
    let enterError = false;
    const port = isMain ? chrome.runtime.connect({name: "port_betvictor"})
        : {postMessage: (...args) => console.log(args)};
    let settings = {
        authCheckInterval: 2000,
        url: 'https://sports.betvictor.com/in-play/football',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        maxWaitForScore: 60000
    };

    const loginSelector = 'a.buttons__login_bar--login';

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
        'HOCKEY': 'Ice Hockey',
        'VOLLEYBALL': 'Volleyball',
        'TENNIS': 'Tennis',
        'TABLETENNIS': 'Table Tennis',
        'BASEBALL': 'Baseball',
        'BASKETBALL': 'Basketball',
        'CYBERSPORT': 'Esports',
    };

    /**
     * Balance
     * @param returnNull - if true - return null when balance does not exists
     * @return {number}
     */
    function getBalance(returnNull) {
        const $b = $('div.site-header-balance__main-balance ');
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.text().replace(/[^\d.]/g, '').trim());
    }

    const goLive = async () => {
        const $live = await waitForElement('a[href="/en-gb/live/overview"]', 333, 10000);
        await mouseChain({target: $live[0], events: fullClick, error: 'goLive'});
    };

    const authCheck = () => {
        //dLog('', 'BV', 'authCheck!');
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
                'button.close.cookies-policy__btn': 'button.close.cookies-policy__btn',
                'h3.bvs-msg-box__title:contains("Your Balance Is Running Low")': 'button.bvs-close-button',
                'button#onetrust-accept-btn-handler': 'button#onetrust-accept-btn-handler',
            });
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
            .catch(e => dLog('red', 'BV', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    const tryToLogin = async () => {
        if (Date.now() - authClickedTime < 60000) {
            throw 'too soon!';
        }
        const controls = {
            login: 'input[name="username"]',
            password: 'input[name="password"]',
            submit: 'button:textEquals("Log In")',
        };
        if (!checkSE(Object.values(controls), true)) {
            await mouseChain({target: $(loginSelector)[0], events: fullClick, error: 'loginSelector'});
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
        await mouseChain({target: $(controls.submit)[0], events: fullClick, error: 'l4'});
        authClicked++;
        authClickedTime = Date.now();
        dLog('', 'BV', `Auth clicked ${authClicked}!`);
        await delayPromise(1000);
        const $errorMessage = await waitForElement('div.bvs-msg-box.bvs-modal.is-danger', 333, 4444).catch(() => $([]));
        if ($errorMessage.length > 0) {
            enterError = true;
            limited = true;
            throw $('div.bvs-msg-box.bvs-modal.is-danger p').trt();
        }
    };

    const closePreviousCoupons = async skip => {
        if (skip) {
            return 'skipped!';
        }
        const closes = 'button.betslip-single__close-button';
        while ($(closes).length > 0) {
            await mouseChain({
                target: $(closes).eq(0)[0], events: fullClick, scroll: true, error: 'c1'
            });
            await delayPromise(777);
        }
        return 'All were closed!';
    };

    const openEvent = async data => {
        dLog('red', 'BV', ['openEvent', data]);
        const eventName = `${data.team1} - ${data.team2}`.toLowerCase();
        const word = data.league.substr(0,
            data.league.indexOf('.') === -1 ? data.league.indexOf(' ') : data.league.indexOf('.')).trim();
        const checkWeAreThere = function () {
            const team1 = $('span[class$="home-team"]').trt();
            const team2 = $('span[class$="away-team"]').trt();
            const checkEvent = `${team1} - ${team2}`.toLowerCase();
            return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70;
        };
        const switchToSport = async sport => {
            dLog('red', 'BV', `switchToSport: ${sport}`);
            const s = accordance[sport];
            const sportSel = `a[type="inplay-slider-button"]:textEquals("${s}")`;
            const $sport = await waitForElement(sportSel, 333, 30000);
            if (!$sport.find('bvs-icon').hasClass('is-main')) {
                await mouseChain({
                    target: $sport[0],
                    events: fullClick,
                    error: `switchToSport`,
                    scroll: true
                });
                await delayPromise(3000);
            }
        };
        let checkScore = async () => {
            if (data.score === '' || data.sport !== 'FOOTBALL'
                || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                return true;
            }
            const getScore = () => {
                const score1 = $('span[class$="home-score"]:visible').trt();
                const score2 = $('span[class$="away-score"]:visible').trt();
                return score1 + ':' + score2;
            };
            await waitForCondition(() => getScore() !== '',
                700, 10000, 'No score');
            dLog('orange', 'BV', `Check score: ${getScore()}`);
            if (getScore() !== data.score.replace(/[^\d:]/g, '').trim()) {
                throw `SCORE_CHANGED => we need ${data.score}, we have ${getScore()}`;
            }
        };
        if (checkWeAreThere() && await checkScore()) {
            return 'We probably on event page!'
        }
        if (document.location.href.indexOf('/live/') === -1) {
            await goLive();
            await delayPromise(3000);
        }
        await switchToSport(data.sport);
        await delayPromise(1000);
        let $el = $([]);
        $('a.inply-coupon-competition-column').each(function () {
            const $teams = $(this).find('span.inply-coupon-team-name');
            const checkEvent = `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}`.toLowerCase();
            if (checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70) {
                $el = $(this);
                return false;
            }
        });
        if ($el.length === 1) {
            await mouseChain({
                target: $el[0], events: fullClick, scroll: true, error: 'EVENT'
            });
        } else {
            throw 'Wrong length of Event: ' + $el.length;
        }
        await waitForCondition(() => checkWeAreThere(),
            777, 30000, 'We are not on event!');
        await checkScore();
        return 'Switched to event!';
    };

    const getBetElement = async data => {
        //#-#-START    
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Match Betting - 90 Mins',],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    roots: ['Match Betting - 90 Mins',],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    roots: ['Match Betting - 90 Mins',],
                    pivotKeys: ['Draw',],
                },
                'ONE_DRAW': {
                    roots: ['Double Chance - 90 Mins'],
                    pivotKeys: ['#TEAM1# / Draw',],
                },
                'TWO_DRAW': {
                    roots: ['Double Chance - 90 Mins'],
                    pivotKeys: ['Draw / #TEAM2#',],
                },
                'ONE_TWO': {
                    roots: ['Double Chance - 90 Mins'],
                    pivotKeys: ['#TEAM1# / #TEAM2#',],
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['Total Goals - Over/Under #PIVOT# - 90 Mins',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    roots: ['Total Goals - Over/Under #PIVOT# - 90 Mins',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['#TEAM1# - Total Goals (O/U #PIVOT#) - 90 Mins',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    roots: ['#TEAM1# - Total Goals (O/U #PIVOT#) - 90 Mins',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['#TEAM2# - Total Goals (O/U #PIVOT#) - 90 Mins',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    roots: ['#TEAM2# - Total Goals (O/U #PIVOT#) - 90 Mins',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    roots: ['Total Corners 2-Way (O/U #PIVOT#) - 90 Mins',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    roots: ['Total Corners 2-Way (O/U #PIVOT#) - 90 Mins',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    roots: ['Asian Handicap (Current Score: #SCORE#) - 90 Mins'],
                    pivotKeys: ['#TEAM1# (#HPIVOT#)'],
                },
                'AWAY': {
                    roots: ['Asian Handicap (Current Score: #SCORE#) - 90 Mins'],
                    pivotKeys: ['#TEAM2# (#HPIVOT#)'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    roots: ['3 Way Handicap (#PIVOT#) - 90 Mins'],
                    pivotKeys: ['#TEAM1# (#HPIVOT#)'],
                },
                'H2': {
                    roots: ['3 Way Handicap (#PIVOT#) - 90 Mins'],
                    pivotKeys: ['#TEAM2# (#HPIVOT#)'],
                },
                'HX': {
                    roots: ['3 Way Handicap (#PIVOT#) - 90 Mins'],
                    pivotKeys: ['Handicap Tie - #TEAM1# #HPIVOT#'],
                }
            },
        };

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw `Unsupported ${data.time_value} / ${data.market} / ${data.target}`;
        }

        const m = markets[data.market][data.target];
        let htValue = '';
        if (data.time_value.indexOf('FULL') === -1) {
            const timing = data.time_value.replace(/[^\d]/g, '').trim();
            const prefix = ['st', 'nd', 'rd', 'th'];
            const findPrefix = prefix[timing - 1];
            if (data.sport === 'FOOTBALL') {
                m.roots[0] = m.roots[0].replace('90 Mins', 'First Half');
                if (data.market === 'HDP') {
                    htValue = 'HT ';
                }
            }
            if (data.sport === 'TENNIS' && data.market === 'ONE_TWO') {                                
                m.roots[0] = `Set Winner - ${timing}${findPrefix} Set`;
            }
            if (data.sport === 'TABLETENNIS') {
                if (data.market === 'ONE_TWO') {
                    m.roots[0] = `To Win - ${timing}${findPrefix} Set`;
                }
                if (data.market === 'TOTAL') {
                    m.roots[0] = `Total Points U/O (#PIVOT#) - ${timing}${findPrefix} Set`;
                }
                if (data.market === 'HDP') {
                    m.roots[0] = `2-Way Point Handicap (#PIVOT#) - ${timing}${findPrefix} Set`;
                    m.pivotKeys[0] = data.target === 'HOME' ? '#TEAM1# #HPIVOT#' : '#TEAM2# #HPIVOT#';
                }
            }
            if (data.sport === 'BASKETBALL') {
                if (data.market === 'ONE_TWO') {
                    m.roots[0] = `Money Line - ${timing}${findPrefix} Quarter`;
                }
                if (data.market === 'TOTAL') {
                    m.roots[0] = `Total points (#PIVOT#) - ${timing}${findPrefix} Quarter`;
                }
                if (data.market === 'T1_TOTAL') {
                    m.roots[0] = `#TEAM1# Total points (#PIVOT#) - ${timing}${findPrefix} Quarter`;
                }
                if (data.market === 'T2_TOTAL') {
                    m.roots[0] = `#TEAM2# Total points (#PIVOT#) - ${timing}${findPrefix} Quarter`;
                }
                if (data.market === 'HDP') {
                    m.roots[0] = `Point spread (#PIVOT#) - ${timing}${findPrefix} Quarter`;
                    m.pivotKeys[0] = data.target === 'HOME' ? '#TEAM1# #HPIVOT#' : '#TEAM2# #HPIVOT#';
                }
            }
            if (data.sport === 'HOCKEY') {
                if (data.market === 'ONE_TWO') {
                    m.roots[0] = `Win/Draw/Win - ${timing}${findPrefix} Period`;
                    if (['ONE_DRAW', 'TWO_DRAW', 'ONE_TWO'].indexOf(data.target) > -1) {
                        m.roots[0] = `Double Chance - ${timing}${findPrefix} Period`;
                        m.pivotKeys[0] = m.pivotKeys[0].replace('/', 'or')
                    }
                }
                if (data.market === 'HDP') {
                    m.roots[0] = `Puck Line (#PIVOT#) - ${timing}${findPrefix} Period`;
                    m.pivotKeys[0] = data.target === 'HOME' ? '#TEAM1# #HPIVOT#' : '#TEAM2# #HPIVOT#';
                }
                if (data.market === 'TOTAL') {
                    m.roots[0] = `Total Goals (#PIVOT#) - ${timing}${findPrefix} Period`;
                }
            }
            if (data.sport === 'VOLLEYBALL') {
                if (data.market === 'ONE_TWO') {
                    m.roots[0] = `Set Winner - ${timing}${findPrefix} Set`;
                }
                if (data.market === 'TOTAL') {
                    m.roots[0] = `Total O/U (#PIVOT#) - ${timing}${findPrefix} Set`;
                }
                if (data.market === 'HDP') {
                    m.roots[0] = `Point spread (#PIVOT#) - ${timing}${findPrefix} Set`;
                    m.pivotKeys[0] = data.target === 'HOME' ? '#TEAM1# #HPIVOT#' : '#TEAM2# #HPIVOT#';
                }
            }
        } else {
            if (data.sport === 'TENNIS' && data.market === 'ONE_TWO') {
                m.roots[0] = m.roots[0].replace('90 Mins', 'Match');
            }
            if (data.sport === 'TABLETENNIS') {
                if (data.market === 'ONE_TWO') {
                    m.roots[0] = 'To Win - Match';
                }
                if (data.market === 'TOTAL') {
                    m.roots[0] = `Total Points U/O (#PIVOT#) - Match`;
                }
                if (data.market === 'HDP') {
                    m.roots[0] = `2-Way Point Handicap (#PIVOT#) - Match`;
                    m.pivotKeys[0] = data.target === 'HOME' ? '#TEAM1# #HPIVOT#' : '#TEAM2# #HPIVOT#';
                }
            }
            if (data.sport === 'BASKETBALL') {
                if (data.market === 'ONE_TWO') {
                    m.roots[0] = 'Money Line - Match';
                }
                if (data.market === 'TOTAL') {
                    m.roots[0] = `Total points (#PIVOT#) - Match`;
                }
                if (data.market === 'T1_TOTAL') {
                    m.roots[0] = `#TEAM1# Total points (#PIVOT#) - Match`;
                }
                if (data.market === 'T2_TOTAL') {
                    m.roots[0] = `#TEAM2# Total points (#PIVOT#) - Match`;
                }
                if (data.market === 'HDP') {
                    m.roots[0] = `Point spread (#PIVOT#) - Match`;
                    m.pivotKeys[0] = data.target === 'HOME' ? '#TEAM1# #HPIVOT#' : '#TEAM2# #HPIVOT#';
                }
            }
            if (data.sport === 'HOCKEY') {
                if (data.market === 'ONE_TWO') {
                    m.roots[0] = 'Win/Draw/Win - Regulation Time';
                    if (['ONE_DRAW', 'TWO_DRAW', 'ONE_TWO'].indexOf(data.target) > -1) {
                        m.roots[0] = 'Double Chance - Regulation Time';
                        m.pivotKeys[0] = m.pivotKeys[0].replace('/', 'or')
                    }
                }
                if (data.market === 'HDP') {
                    m.roots[0] = `Puck Line (#PIVOT#) - Regulation Time`;
                    m.pivotKeys[0] = data.target === 'HOME' ? '#TEAM1# #HPIVOT#' : '#TEAM2# #HPIVOT#';
                }
                if (data.market === 'TOTAL') {
                    m.roots[0] = `Total Goals (#PIVOT#) - Match`;
                }
            }
            if (data.sport === 'VOLLEYBALL') {
                if (data.market === 'ONE_TWO') {
                    m.roots[0] = 'Match Result - Match';
                }
                if (data.market === 'TOTAL') {
                    m.roots[0] = `Game Total (#PIVOT#) - Match`;
                }
                if (data.market === 'HDP') {
                    m.roots[0] = `Point spread (#PIVOT#) - Match`;
                    m.pivotKeys[0] = data.target === 'HOME' ? '#TEAM1# #HPIVOT#' : '#TEAM2# #HPIVOT#';
                }
            }
        }     

        const ePivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };

        const hPivot = pvt => parseInt(pvt) > 0 ? `+${pvt}` : pvt;
        const coef = parseFloat(data.coef);

        replaceInner(m, {
            '#TEAM1#': data.team1,
            '#TEAM2#': data.team2,
            '#PIVOT#': data.pivot,
            '#EPIVOT#': ePivot(data.pivot),
            '#HPIVOT#': hPivot(data.pivot),
            '#SCORE#': data.score.replace(/[^\d:]/g, '').trim().replace(':', '-'),
            '#HT#': htValue,
        });        
        dLog('green', 'BV', ['Final market is:', m]);
        const tabSelector = data.market === 'HDP' ? 'div.bvs-carousel__slider button:textEquals("Handicaps")' : 'div.bvs-carousel__slider button:textEquals("All Markets")';
        const $all = await waitForElement(tabSelector, 333, 15000);

        if (!$all.hasClass('active')) {
            await mouseChain({target: $all[0], events: fullClick, error: '$all'});
            await delayPromise(1333);
        }

        /**
         *
         * @param $root
         * @param type
         * @returns {jQuery<HTMLElement>}
         */
        const $findPivot = ($root) => {
            for (const pvt of m.pivotKeys) {
                const $pivot = $root.closest('div.market-view-default').find(`span.outcome-n-description:textEquals("${pvt}")`);
                if ($pivot.length === 1) {
                    return $pivot.closest('button');
                } else if ($pivot.length > 1) {
                    throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                }
            }
            return $([]);
        };

        const checkHdpFCoef = (x, min, max) => {
            return x >= min && x <= max;
        }

        const $findHDPCoef = ($root) => {
            let $el = $([]);
            if ($root.closest('div.expandable').find('span.outcome-n-price').length > 0) {
                $root.closest('div.expandable').find('span.outcome-n-price').each(function () {
                    if (checkHdpFCoef(parseFloat($(this).trt()), coef, coef + 0.13)) {
                        $el = $(this).closest('button');
                        return false;
                    }
                });
            }
            return $el;
        }
        
        let $found = $([]);
        if (data.market === 'HDP') {
            const $marketsList = await waitForElement('div.market-list-wrapper > div', 333, 20000);
            await delayPromise(1111);
            const $root = () => $marketsList.find(`h2.market-view__header-title:textEqualsIS("${m.roots[0]}")`);
            $found = $findHDPCoef($root());
        } else {
            const $marketsList = await waitForElement('div.market-list-wrapper div.market-view-default', 333, 20000);
            await delayPromise(555);
            for (const root of m.roots) {
                console.log(`Checking root: ${root}`);
                const $root = () => $marketsList.find(`h2.market-view__header-title:textEqualsIS("${root}")`);
                if ($root().length === 0) {
                    continue;
                }
                if (!$root().closest('div.market-view-default').hasClass('open')) {
                    await mouseChain({
                        target: $root().closest('div.market-view-default').find('span.is-arrow-circle-up')[0], events: fullClick, error: 'h3', scroll: true
                    });
                    await delayPromise(1555);
                }
                $found = $findPivot($root());
                if ($found.length > 0) {
                    break;
                }
            }
        }
        if ($found.length === 0) {
            throw `${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot}`
            + ' not found :(';
        }
        return $found;
        //#-#-FINISH
    };

    const openCoupon = async paramData => {
        dLog('green', 'BV', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'BV', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'BV', 'Event must be opened!');
            const $element = await getBetElement(data);
            console.log($element);            
            let coefWeWaitFor = $element.find('span.outcome-n-price').trt();            
            dLog('green', 'BV', 'We got element! Coef: ' + coefWeWaitFor);
            const waitForCouponVisibleStarted = Date.now();
            let elementWasClicked = 0;
            let performElementClick = async function () {
                dLog('green', 'BV', 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                    + ') /' + (Date.now() - elementWasClicked));
                await mouseChain({target: $element[0], events: fullClick, error: 'performElementClick'})
                elementWasClicked = Date.now();
            };
            const checkCoupon = () => {
                let event = (data.team1 + ' v ' + data.team2).toLowerCase();
                let result = false;
                $('div.betslip__bet-list > div.betslip-single').each(function () {
                    let ev = $(this).find('div.betslip-single__event').text().replace(/\*/g, '').trim().toLowerCase();
                    if (event === ev || locutus_similar_text(event, ev, true) > 60) {
                        result = true;
                        return false;
                    } else {
                        dLog('red', 'BV', `'${ev}' !== '${event}'`);
                    }

                });
                return result;
            };
            while (!checkCoupon() && Date.now() - waitForCouponVisibleStarted < 15000) {
                await performElementClick();
                await delayPromise(3000);
            }
            if (!checkCoupon()) {
                throw `Coupon not opened!`;
            }
            const getMaxHere = async () => 100500;
            if (paramData.length > 1) {
                dLog('red', 'BV', `Express here! ${i}/${(paramData.length - 1)}`);
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
            const localMatch = v.team1.toLowerCase() + ' v ' + v.team2.toLowerCase();
            return localMatch === match.toLowerCase()
                || locutus_similar_text(localMatch, match.toLowerCase(), true) > 70;
        });
        const $coupons = $('div.betslip__bet-list > div.betslip-single');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $(this).find('div.betslip-single__event').text()
                .replace(/\*/g, '').trim().toLowerCase();
            console.log(match);
            if ($this.hasClass('bet--suspended')) {
                errors.push(match + ' LOW_COEF, market unavailable!');
                checked++;
                return true;
            }
            let localCoef = decOdds($this.find('span.odds-price').trt());
            let localData = findInData(match);
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if (!localData || isNaN(localCoef)) {
                errors.push(`${match} LOW_COEF - wrong match or localCoef ${localCoef}!`);
                checked++;
            } else {
                checked++;
            }
        });
        if (errors.length === 0 && checked === data.length) {
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef))
                ? parseFloat(data[0].coef) : totalCoef / 1.21;
            if (totalCoef >= nCheck * 1.2) {
                throw `Coef TOO BIG: ${totalCoef} instead of ${data[0].coef}`;
            } else if (totalCoef < nCheck) {
                throw `LOW_COEF ${data[0].coef} > ${totalCoef}`;
            } else {
                return `Coefs fine! here: ${totalCoef}, need: ${nCheck}/${data[0].coef}`;
            }
        } else {
            throw errors.join('; ')
            + (checked !== data.length ? ` some stakes not checked (${checked}/${data.length})!` : '');
        }
    };

    const proceedBet = async data => {
        const checkSuccess = async () => {
            const started = Date.now();
            while (Date.now() - started < 30000) {
                const alertText = $('div.betslip__general-error span').trt();
                const acceptedText = $('h4.bvs-h4').trt();
                if (alertText !== '') {
                    if (alertText.indexOf('Restrictions have been applied to your account') > -1) {
                        throw 'LIMITED';
                    }
                    throw `Error: ${alertText}`;
                } else if (acceptedText.indexOf('Successfully') > -1) {
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
        do {
            // Hint: Try to perform bet
            await checkCoefs(data);
            let willPlace = parseFloat(data[0].stake);
            if (currentBetData.max !== -1 && willPlace > currentBetData.max) {
                willPlace = currentBetData.max;
            }
            checkBalance(willPlace);
            dLog('green', 'BV', `Will place (performBet): ${willPlace}`);
            /**
             * @returns {JQuery<HTMLElement>}
             */
            const $input = () => data.length > 1 ? $('div.betslip__multiples input[data-cy="stake-input"]') : $('input[data-cy="stake-input"]');
            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input().length}`;
            }
            await mouseChain({target: $input()[0], events: fullClick, error: 'l1'});
            await clearAndSimulateD($input()[0], willPlace.toString().replace('.00', '').trim());
            await delayPromise(1222);
            dLog('green', 'BV', `STAKE entered ${willPlace}`);
            let entered = parseFloat($input().val());
            dLog('green', 'BV',
                `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'BV', 'Entered !== willPlace - try to reenter!');
                continue;
            }
            await delayPromise(300);
            const $placeBtn = $('button span.betslip-submit__button:contains("Place Bet")');
            if ($placeBtn.length === 0 || $placeBtn.attr('disabled')) {
                throw 'No place button or button disabled!';
            } else if ($placeBtn.text().indexOf('Accept') > -1) {
                await checkCoefs(data);
            }
            await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
        } while (!await checkSuccess());
        await delayPromise(888);

        const collectResult = await collectBetResult();

        // Hint: collect result
        return {
            success: true,
            message: {
                external_id: collectResult.external_id,
                coef: collectResult.coef,
                stake: collectResult.stake,
                max: currentBetData.max,
            },
        };
    };

    const collectBetResult = async () => {
        const collected = {};
        if ($('a.site-header__my-account').length > 0) {
            await mouseChain({target: $('a.site-header__my-account')[0], events: fullClick, error: 'open history'});
            await delayPromise(888);
        } else {
            throw 'my account label is not exist';
        }
        const $betHistory = await waitForElement('span.acc-overview__link-text:textEquals("Bet History")', 333, 10000);
        await delayPromise(555);
        await mouseChain({target: $betHistory[0], events: fullClick, error: 'bet history'});
        await delayPromise(555);
        const $lastBet = await waitForElement('ul.bvs-cards-group li:last', 333, 18000);
        if ($lastBet.find('span').hasClass('is-arrow-solid-circle-down')) {
            await mouseChain({target: $lastBet.find('span.is-arrow-solid-circle-down')[0], events: fullClick, error: 'Click arrow-solid-circle-down'});
            await delayPromise(555);
            await waitForCondition(() => $lastBet.find('div.account-history__card-wrapper').length > 0, 333, 10000, 'container is not expand!');
        }
        await delayPromise(888);
        collected.external_id = $lastBet.find('div.account-history__bvs-card--created-date div').eq(1).trt().replace(/[^\d.]/g, '').trim();
        collected.coef = $lastBet.find('td.account-history__table--odds div').trt().replace(/[^\d.]/g, '').trim();
        collected.stake = $lastBet.find('td:textEquals("Stake")').parent().next().children(":first").trt().replace(/[^\d.]/g, '').trim();
        await mouseChain({target: $('div.modal_wrapper span.is-close')[0], events: fullClick, error: 'close modal'});
        await delayPromise(777);

        return collected;
    };

    const collectBetResults = async (inD, command) => {
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        dLog('', 'LAD', [`collectBetResults, limit: ${limit}, data:`, data]);
        const collected = [];
        if ($('a.site-header__my-account').length > 0) {
            await mouseChain({target: $('a.site-header__my-account')[0], events: fullClick, error: 'open history'});
            await delayPromise(888);
        } else {
            throw 'my account label is not exist';
        }
        const $betHistory = await waitForElement('span.acc-overview__link-text:textEquals("Bet History")', 333, 10000);
        await delayPromise(888);
        await mouseChain({target: $betHistory[0], events: fullClick, error: 'bet history'});
        await delayPromise(888);
        await waitForElement('div.account-history__container', 333, 18000);
        for (const text of ['Open', 'Settled']) {
            const $current = await waitForElement(`div.modal_wrapper button:textEquals(${text})`, 333, 10000);
            await delayPromise(500);
            if (!$current.hasClass('active')) {
                await mouseChain({target: $current[0], events: fullClick, error: `Click ${text}`});
                await delayPromise(1000);
                await waitForElement('div.account-history__container', 333, 18000);
            }
            const betsSel = 'li.account-history__bvs-card';
            await $(betsSel).eachAsync(async function (idx, val) {
                idx++;
                const $this = $(this);
                if ($this.find('span').hasClass('is-arrow-solid-circle-down')) {
                    await mouseChain({target: $this.find('span.is-arrow-solid-circle-down')[0], events: fullClick, error: 'Click arrow-solid-circle-down'});
                    await delayPromise(777);
                    await waitForCondition(() => $this.find('div.account-history__card-wrapper').length > 0, 333, 10000, 'container is not expand!');
                }
                const status = text === 'Open' ? 'ACCEPTED'
                    : $this.find('div.result-card__ribbon--won').length > 0 ? 'WON'
                        : 'LOSE';
                const bet = {
                    external_id: $this.find('div.account-history__bvs-card--created-date div').eq(1).trt().replace(/[^\d.]/g, '').trim(),
                    status: status,
                    coef: $this.find('td.account-history__table--odds div').trt().replace(/[^\d.]/g, '').trim(),
                    stake: $this.find('td:textEquals("Stake")').parent().next().children(":first").trt().replace(/[^\d.]/g, '').trim(),
                    result: status !== 'ACCEPTED' ? $this.find('td:textEquals("Stake")').parent().next().children().eq(1).trt().replace(/[^\d.]/g, '').trim() : '',
                };
                if (data.length === 0 || data.indexOf(bet.external_id) > -1) {
                    collected.push(bet);
                }
                if (idx >= limit) {
                    return false;
                }
            });
            await delayPromise(1000);
        }
        return {success: true, message: collected};
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
            //dLog('green', 'BV', [`commands execute ${command}`, data, formatStack((new Error()).stack)]);
            const res = await this.cLinks[command](data, command).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'BV', `${command} result: ${res.message}`);
            port.postMessage(this.prepareResult(command, res));
            if (!res) {
                throw error;
            }
            return res;
        }

        prepareResult(command, res) {
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
            if (message.login === 'reger') {
                bsDebug(port, 'Awaiting for registration command!');
                return;
            }
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            ['login', 'password', 'phone', 'uid'].forEach(k => settings[k] = message[k]);
            if (message.start_url) {
                settings.url = message.start_url;
            }
            authCheck();
            wasAuthCheck = true;
        } else if ($(loginSelector).length > 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (commands.exists(message.action)) {
            // Hint: execute command
            busy = true;
            ourCommand.set(message);
            commands.execute(message.action, message.data)
                .catch(e => dLog('red', 'BV', `Error till execute: ${e}`))
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
            const command = await bMess('BETVICTOR').check(40000);
            await waitForCondition(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck), 333, 60000, 'No auth check!');
            bsLogger('green', 'BV', [`Restoring with (${isMain}): `, command]);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));
        port.postMessage({m: "PAGE LOADED!"});
        console.log('%c' + `betvictor loaded and message sent! (${isMain}) ${document.location.href}`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", async () => {
        await ourCommand.save('BETVICTOR', increaseDelay ? 150000 : 0);
        bsLogger('green', 'BV', [`Command was set till unload (${isMain}):`, ourCommand.get()]);
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

})();
