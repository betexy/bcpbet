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
    const port = isMain ? chrome.runtime.connect({name: "port_stoiximan"})
        : {postMessage: (...args) => console.log(args)};
    let settings = {
        authCheckInterval: 2000,
        url: 'https://en.stoiximan.gr/live/',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        maxWaitForScore: 60000
    };

    const loginSelector = 'a.GTM-login:textEquals("LOGIN")';
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
        'FOOTBALL': 'SOCCER',
        'HOCKEY': 'ICE HOCKEY',
        'VOLLEYBALL': 'VOLLEYBALL',
        'TENNIS': 'TENNIS',
        'TABLETENNIS': 'TABLE TENNIS',
        'BASEBALL': 'BASEBALL',
        'BASKETBALL': 'BASKETBALL',
        'CYBERSPORT': 'ESPORTS',
    };

    /**
     * Get balance
     * @param returnNull - if true - return null when balance does not exists
     * @return {number}
     */
    function getBalance(returnNull) {
        const $b = $('div.user-main-info__balance__amount');
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.text().replace(/\,.*/, '').replace(/[^\d.]/g, '').trim());
    };

    const authCheck = () => {
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
                'button.sticky-notification__cta:textEquals("OK")': 'button.sticky-notification__cta:textEquals("OK")',
            });
            if ($($getIFrame('iframe[src="/myaccount/login"]').find('div#js-close-icon')).length > 0) {
                await mouseChain({target: $($getIFrame('iframe[src="/myaccount/login"]').find('div#js-close-icon'))[0], events: fullClick, error: 'submit login'});
            }
            if ($('div.mission-card-main__right svg').length > 0) {
                await mouseChain({target: $('div.mission-card-main__right svg')[0], events: fullClick, error: 'mission card'});
            }
            
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
            .catch(e => dLog('red', 'STOIXIMAN', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    const tryToLogin = async () => {

        if (Date.now() - authClickedTime < 60000) {
            throw 'too soon!';
        }
        const controls = {
            login: 'input[name="Username"]',
            password: 'input[name="Password"]',
            submit: 'button:textEquals("LOGIN")',
        };
        const $accIFrame = selector => $($(selector)[0].contentDocument);
        const frameLink = 'iframe[src="/myaccount/login"]';
        if ($getIFrame(frameLink).length === 0) {
            await mouseChain({target: $(loginSelector)[0], events: fullClick, error: 'loginSelector'});
        }
        await waitForCondition(() => Object.keys(controls).every(k => $accIFrame(frameLink).find(controls[k]).length > 0),
            333, 10000, 'No controls!');
        await delayPromise(1000);
        await clearAndSimulate($accIFrame(frameLink).find(controls.login)[0], settings.login);
        await delayPromise(1000);
        await clearAndSimulate($accIFrame(frameLink).find(controls.password)[0], settings.password);
        await delayPromise(1000);
        await mouseChain({target: $accIFrame(frameLink).find(controls.submit)[0], events: fullClick, error: 'submit login'});
        authClicked++;
        authClickedTime = Date.now();
        dLog('', 'STOIXIMAN', `Auth clicked ${authClicked}!`);
        await delayPromise(1000);
        const errors = await waitForCondition(() => $accIFrame(frameLink).find('small.validation-error').length > 0,
            333, 3333).catch(() => $([]));
        if (errors.length > 0) {
            enterError = true;
            limited = true;
            throw 'AUTH ERROR!';
        }
    };

    const closePreviousCoupons = async () => {
        if ($('div.bet-activity-card').length > 0) {
            await mouseChain({target: $('button.bet-slip__header__clear:textEquals("CLEAR")')[0], events: fullClick, error: 'CPC'});
            await delayPromise(555);
        }
        return 'All were closed!';
    };

    const switchType = async type => {
        const $menuList = $('ul.sb-header__header__navigation__menu-container__main-menu');
        const typeStr = type === 'LIVE' ? 'LIVE BETTING' : 'SPORTS';

        await mouseChain({target: $menuList.find(`a:textEquals(${typeStr})`)[0], events: fullClick, error: '$menuList'});
        await delayPromise(555);
    };

    const getBetElement = async data => {
        let score = '';
        if (data.sport === 'FOOTBALL' 
            && data.market === 'HDP'
        ) {
            score = $('span.score-home').trt() + ' - ' + $('span.score-away').trt();
        }
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Match Result',],
                    pivotKeys: ['1',],
                },
                'TWO': {
                    roots: ['Match Result',],
                    pivotKeys: ['2',],
                },
                'DRAW': {
                    roots: ['Match Result',],
                    pivotKeys: ['X',],
                },
                'ONE_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['1X',],
                },
                'TWO_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['2X',],
                },
                'ONE_TWO': {
                    roots: ['Double Chance'],
                    pivotKeys: ['12',],
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['Over/Under Total Goals', 'Over/Under Total Goals (extra)', 'Asian (Over/Under) Total Goals', 'Asian (Over/Under) Total Goals (extra)',],
                    pivotKeys: ['Over#PIVOT#'],
                },
                'UNDER': {
                    roots: ['Over/Under Total Goals', 'Over/Under Total Goals (extra)', 'Asian (Over/Under) Total Goals', 'Asian (Over/Under) Total Goals (extra)',],
                    pivotKeys: ['Under#PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['#TEAM1# Over/Under Total Goals',],
                    pivotKeys: ['Over#PIVOT#'],
                },
                'UNDER': {
                    roots: ['#TEAM1# Over/Under Total Goals',],
                    pivotKeys: ['Under#PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['#TEAM2# Over/Under Total Goals',],
                    pivotKeys: ['Over#PIVOT#'],
                },
                'UNDER': {
                    roots: ['#TEAM2# Over/Under Total Goals',],
                    pivotKeys: ['Under#PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    roots: ['Over/Under Corners', 'Over/Under Corners (extra)',],
                    pivotKeys: ['Over#PIVOT#'],
                },
                'UNDER': {
                    roots: ['Over/Under Corners', 'Over/Under Corners (extra)',],
                    pivotKeys: ['Under#PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    roots: [`Asian Handicap (Current Score ${score})`],
                    pivotKeys: ['#TEAM1##HPIVOT#'],
                },
                'AWAY': {
                    roots: [`Asian Handicap (Current Score ${score})`],
                    pivotKeys: ['#TEAM2##HPIVOT#'],
                }
            },
            'CORNER_HDP': {
                'HOME': {
                    roots: ['Corners Handicap 2-Way'],
                    pivotKeys: ['#TEAM1##HPIVOT#'],
                },
                'AWAY': {
                    roots: ['Corners Handicap 2-Way'],
                    pivotKeys: ['#TEAM2##HPIVOT#'],
                }
            },
        };
        const m = markets[data.market][data.target];
        let htValue = '';

        if (data.time_value.indexOf('FULL') === -1) {
            const timing = data.time_value.replace(/[^\d]/g, '').trim();
            if (data.sport === 'FOOTBALL') {
                if (data.market === 'ONE_TWO') {
                    markets['ONE_TWO']['ONE']['roots'].push('First-Half Result');
                    markets['ONE_TWO']['TWO']['roots'].push('First-Half Result');
                    markets['ONE_TWO']['DRAW']['roots'].push('First-Half Result');
                    markets['ONE_TWO']['ONE_DRAW']['roots'].push('Half-Time Double Chance');
                    markets['ONE_TWO']['TWO_DRAW']['roots'].push('Half-Time Double Chance');
                    markets['ONE_TWO']['ONE_TWO']['roots'].push('Half-Time Double Chance');
                }
                if (data.market === 'T1_TOTAL') {
                    markets['T1_TOTAL']['OVER']['roots'].push('Over/Under First Half Goals #TEAM1#');
                    markets['T1_TOTAL']['UNDER']['roots'].push('Over/Under First Half Goals #TEAM1#');
                }
                if (data.market === 'T2_TOTAL') {
                    markets['T2_TOTAL']['OVER']['roots'].push('Over/Under First Half Goals #TEAM2#');
                    markets['T2_TOTAL']['UNDER']['roots'].push('Over/Under First Half Goals #TEAM2#');
                }
                if (data.market === 'TOTAL') {
                    markets['TOTAL']['OVER']['roots'].push('Over/Under First Half Goals', 'Asian (Over/Under) - First Half Total Goals', 'Asian (Over/Under) - First Half Total Goals (extra)');
                    markets['TOTAL']['UNDER']['roots'].push('Over/Under First Half Goals', 'Asian (Over/Under) - First Half Total Goals', 'Asian (Over/Under) - First Half Total Goals (extra)');
                }
                if (data.market === 'CORNER_TOTAL') {
                    markets['CORNER_TOTAL']['OVER']['roots'].push('Over/Under 1st Half Corners = Over/Under Corners', 'Over/Under 1st Half Corners (extra) = Over/Under Corners (extra)');
                    markets['CORNER_TOTAL']['UNDER']['roots'].push('Over/Under 1st Half Corners = Over/Under Corners', 'Over/Under 1st Half Corners (extra) = Over/Under Corners (extra)');
                }
                if (data.market === 'HDP') {
                    markets['HDP']['HOME']['roots'].push(`Asian Handicap - First Half  (Current Score ${score})`);
                    markets['HDP']['AWAY']['roots'].push(`Asian Handicap - First Half  (Current Score ${score})`);
                }
            }
            if (data.sport === 'BASKETBALL') {
                if (data.time_value === 'HALF_TIME') {
                    if (data.market === 'ONE_TWO') {
                        markets['ONE_TWO']['ONE']['roots'].push('First-Half Result');
                        markets['ONE_TWO']['TWO']['roots'].push('First-Half Result');
                        markets['ONE_TWO']['DRAW']['roots'].push('First-Half Result');
                    }
                    if (data.market === 'HDP') {
                        markets['HDP']['HOME']['roots'].push('1st Half - Handicap');
                        markets['HDP']['AWAY']['roots'].push('1st Half - Handicap');
                    }
                    if (data.market === 'TOTAL') {
                        markets['TOTAL']['OVER']['roots'].push('1st Half - Total Points');
                        markets['TOTAL']['UNDER']['roots'].push('1st Half - Total Points');
                    }
                    if (data.market === 'T1_TOTAL') {
                        markets['T1_TOTAL']['OVER']['roots'].push('1st Half - Total Points #TEAM1#');
                        markets['T1_TOTAL']['UNDER']['roots'].push('1st Half - Total Points #TEAM1#');
                    }
                    if (data.market === 'T2_TOTAL') {
                        markets['T2_TOTAL']['OVER']['roots'].push('1st Half - Total Points #TEAM2#');
                        markets['T2_TOTAL']['UNDER']['roots'].push('1st Half - Total Points #TEAM2#');
                    }
                } else {
                    
                }
            }
            if (data.sport === 'ICE HOCKEY') {
                if (data.market === 'ONE_TWO') {
                    markets['ONE_TWO']['ONE']['roots'].push(`Period ${timing} - 1X2`);
                    markets['ONE_TWO']['ONE']['pivotKeys'].push(`#TEAM1#`);
                    markets['ONE_TWO']['TWO']['roots'].push(`Period ${timing} - 1X2`);
                    markets['ONE_TWO']['TWO']['pivotKeys'].push(`#TEAM2#`);
                    markets['ONE_TWO']['DRAW']['roots'].push(`Period ${timing} - 1X2`);
                    markets['ONE_TWO']['DRAW']['pivotKeys'].push(`Draw`);
                }
                if (data.market === 'HDP') {
                    markets['HDP']['HOME']['roots'].push(`Period ${timing} - Handicap Result`);
                    markets['HDP']['AWAY']['roots'].push(`Period ${timing} - Handicap Result`);
                }
                if (data.market === 'TOTAL') {
                    markets['TOTAL']['OVER']['roots'].push(`Period ${timing} - Total Goals Over/Under`);
                    markets['TOTAL']['UNDER']['roots'].push(`Period ${timing} - Total Goals Over/Under`);
                }
            }
            if (data.sport === 'VOLLEYBALL') {
                
            }
            if (data.sport === 'TENNIS') {
                
            }
            if (data.sport === 'TABLE TENNIS') {
                
            }
            if (data.sport === 'BASEBALL') {
                
            }
            if (data.sport === 'ESPORTS') {
                
            }
        } else {
            if (data.sport === 'BASKETBALL') {
                if (data.market === 'ONE_TWO') {
                    markets['ONE_TWO']['ONE']['roots'].push('Winner');
                    markets['ONE_TWO']['ONE']['pivotKeys'].push('#TEAM1#');
                    markets['ONE_TWO']['TWO']['roots'].push('Winner');
                    markets['ONE_TWO']['TWO']['pivotKeys'].push('#TEAM2#');
                }
                if (data.market === 'HDP') {
                    markets['HDP']['HOME']['roots'].push('Handicap', 'Handicap (extra)');
                    markets['HDP']['AWAY']['roots'].push('Handicap', 'Handicap (extra)');
                }
                if (data.market === 'TOTAL') {
                    markets['TOTAL']['OVER']['roots'].push('Total Points', 'Total Points (extra)');
                    markets['TOTAL']['UNDER']['roots'].push('Total Points', 'Total Points (extra)');
                }
                if (data.market === 'T1_TOTAL') {
                    markets['T1_TOTAL']['OVER']['roots'].push('Total Points #TEAM1#');
                    markets['T1_TOTAL']['UNDER']['roots'].push('Total Points #TEAM1#');
                }
                if (data.market === 'T2_TOTAL') {
                    markets['T2_TOTAL']['OVER']['roots'].push('Total Points #TEAM2#');
                    markets['T2_TOTAL']['UNDER']['roots'].push('Total Points #TEAM2#');
                }
            }
            if (data.sport === 'ICE HOCKEY') {
                if (data.market === 'TOTAL') {
                    markets['TOTAL']['OVER']['roots'].push('Total Goals Over/Under', 'Total Goals Over/Under (extra)');
                    markets['TOTAL']['UNDER']['roots'].push('Total Goals Over/Under', 'Total Goals Over/Under (extra)');
                }
                if (data.market === 'HDP') {
                    markets['HDP']['HOME']['roots'].push('Asian Handicap Goals', 'Asian Handicap Goals (extra)');
                    markets['HDP']['AWAY']['roots'].push('Asian Handicap Goals', 'Asian Handicap Goals (extra)');
                }
            }
            
        }

        const ePivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };

        const hPivot = pvt => parseFloat(pvt) > 0 ? `+${pvt}` : parseFloat(pvt) === 0 ? ' 0.0' : pvt;

        replaceInner(m, {
            '#TEAM1#': data.home,
            '#TEAM2#': data.away,
            '#PIVOT#': data.pivot,
            '#EPIVOT#': ePivot(data.pivot),
            '#HPIVOT#': hPivot(data.pivot),
            '#SCORE#': data.score.replace(/[^\d:]/g, '').trim(),
            '#HT#': htValue,
        });        
        dLog('green', 'STOIXIMAN', ['Final market is:', m]);

        const $marketsList = await waitForElement('div.markets', 333, 15000);
        await delayPromise(777);
        let $found = $([]);
        const $findPivot = ($root) => {
            for (const pvt of m.pivotKeys) { 
                const $pivot = $root.closest('div.markets__market').find(`span.selections__selection__title:textEquals("${pvt}")`);
                if ($pivot.length === 1) {
                    return $pivot.closest('button');
                } else if ($pivot.length > 1) {
                    throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                }
            }
            return $([]);
        };

        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () => $marketsList.find(`div.markets__market__header__title:textEqualsIS("${root}")`);
            if ($root().length === 0) {
                continue;
            }
            if (!$root().next().find('svg.sb-arrow').hasClass('sb-arrow--collapsed')) {
                await mouseChain({
                    target: $root().next().find('svg.sb-arrow')[0],
                    events: fullClick,
                    error: 'svg',
                    scroll: true
                });
                await delayPromise(1222);
            }
            $found = $findPivot($root());
            if ($found.length > 0) {
                break;
            }
        }
        if ($found.length === 0) {
            throw `${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot}`
            + ' not found :(';
        }
        return $found;
    };

    const openEvent = async data => {
        dLog('green', 'STOIXIMAN', ['openEvent', data]);
        const eventName = `${data.home} - ${data.away}`.toLowerCase();
        const checkWeAreThere = function () {
            const team1 = $('span.team-info__container').eq(0).find('span:last').trt();
            const team2 = $('span.team-info__container').eq(1).find('span:last').trt();
            const checkEvent = `${team1} - ${team2}`.toLowerCase();
            return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 95;
        };
        const checkScore = function () {
            const score1 = $('span.score-container span.score-home').trt();
            const score2 = $('span.score-container span.score-away').trt();
        const limiter = data.score.includes('-') === true ? '-' : ':';
            const localScore = score1 + limiter + score2;
            if (localScore !== data.score.replace(/[^\d:]/g, '').trim()) {
                throw `SCORE_CHANGED => we need ${data.score}, we have ${localScore}`;
            }
            return true;
        };
        const switchToSport = async sport => {
            dLog('yellow', 'STOIXIMAN', `switchToSport: ${sport}`);
            const s = accordance[sport];
            const $sport = await waitForElement(`div[aria-label="Select category ${s}"]`, 333, 15000);
            if (!$sport.hasClass('events-tabs-container__tab__item__button--active')) {
                await mouseChain({
                    target: $sport[0],
                    events: fullClick,
                    error: `switchToSport`,
                    scroll: true
                });
                await delayPromise(2777);
            }
        };
        if (checkWeAreThere()) {
            if (data.sport === 'FOOTBALL' && ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) === -1) {
                checkScore();
            }
            return 'We probably on event page!';
        }
	await switchType(data.type);
        await switchToSport(data.sport);
        await delayPromise(777);
        let $el = $([]);
        $('a.live-events-event__link').each(function () {
            const $teams = $(this).find('div.live-event__participants__participant');
            const checkEvent = `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}`.toLowerCase();
            if (checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 80) {
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
        return 'Switched to event!';
    };

    const getMaxHere = async (express) => {
        const $buttonMax = express === true ? $('div.bet-multiples__stake button.max-button') : $('button.max-button');
        if ($buttonMax.length > 0) {
            await mouseChain({target: $buttonMax[0], events: fullClick, error: 'close coupon'});
            await delayPromise(1222);
            return express === true ? parseFloat($('div.bet-multiples__stake input.stake-input').val()) : parseFloat($('input.stake-input').val());
        } else {
            throw 'Max button is not visible!';
        }
    };

    const openCoupon = async paramData => {
        dLog('green', 'STOIXIMAN', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'STOIXIMAN', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'STOIXIMAN', 'Event must be opened!');
            const $controlBarButtons = $('div.control-bar__button-group button');
            switch ($controlBarButtons.length) {
                case 3:
                    if ($controlBarButtons.eq(1).hasClass('control-button--active')) {
                        await mouseChain({target: $controlBarButtons.eq(2)[0], events: fullClick, scroll: true, error: 'controlBar'});
                        await delayPromise(1888);
                    }
                break;
                default:
                    if ($controlBarButtons.eq(0).hasClass('control-button--active')) {
                        await mouseChain({target: $controlBarButtons.eq(1)[0], events: fullClick, scroll: true, error: 'controlBar'});
                        await delayPromise(1888);
                    }
            }
            const $element = await getBetElement(data);
            console.log('$element ', $element);
            const coefWeWaitFor = $element.find('span.selections__selection__odd').trt();            
            dLog('green', 'STOIXIMAN', 'We got element! Coef: ' + coefWeWaitFor);
            const waitForCouponVisibleStarted = Date.now();
            let elementWasClicked = 0;
            const performElementClick = async function () {
                dLog('green', 'STOIXIMAN', 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                    + ') /' + (Date.now() - elementWasClicked));
                await mouseChain({target: $element[0], events: fullClick, scroll: true, error: 'performElementClick'})
                elementWasClicked = Date.now();
            };
            const checkCoupon = () => {
                const event = (data.home + ' v ' + data.away).toLowerCase();
                let result = false;
                $('div.bet-activity-card').each(function () {
                    const ev = ($(this).find('div.participants div.participant-name').eq(0).trt() + ' v ' + $(this).find('div.participants div.participant-name').eq(1).trt()).toLowerCase();
                    if (event === ev || locutus_similar_text(event, ev, true) > 80) {
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
                await delayPromise(1777);
            }
            if (!checkCoupon()) {
                throw `Coupon not opened!`;
            }
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
            const dataMatch = v.home.toLowerCase() + ' v ' + v.away.toLowerCase();
            return dataMatch === match.toLowerCase()
                || locutus_similar_text(dataMatch, match.toLowerCase(), true) > 80;
        });
        const $coupons = $('div.bet-activity-card');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = ($(this).find('div.participants div.participant-name').eq(0).trt() + ' v ' + $(this).find('div.participants div.participant-name').eq(1).trt()).toLowerCase();
            if ($this.hasClass('bet-activity-card--disabled')) {
                errors.push(match + ' LOW_COEF, market unavailable!');
                checked++;
                return true;
            }
            const localCoef = parseFloat($this.find('div.bet-odds__value').trt());
            const localData = findInData(match);
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
        let collectResult = {};
        if (ourCommand.getAdded('collectBetResult') === true) {
            collectResult = await collectBetResult();
            return {
                success: true,
                message: {
                    external_id: collectResult.external_id,
                    coef: collectResult.coef,
                    stake: collectResult.stake,
                    max: currentBetData.max,
                },
            };
        } else {
            const checkSuccess = async () => {
                const started = Date.now();
                while (Date.now() - started < 30000) {
                    const $acceptedEl = $('div.receipt-header__text:textEquals("Your bet has been placed successfully")');
                    if ($acceptedEl.length > 0) {
                        await mouseChain({target: $('button:textEquals("CLOSE")')[0], events: fullClick, error: 'close coupon'});
                        await delayPromise(777);
                        return true;
                    }
                    await delayPromise(333);
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
            await closePreviousCoupons();
            currentBetData.max = await openCoupon(data);
            do {
                await checkCoefs(data);
                let willPlace = parseFloat(data[0].stake);
                if (currentBetData.max !== -1 && willPlace > currentBetData.max) {
                    willPlace = currentBetData.max;
                }
                dLog('green', 'STOIXIMAN', `Will place (performBet): ${willPlace}`);
                checkBalance(willPlace);
                const $input = () => data.length > 1 ? $('input.stake-input--is-multiple') : $('input.stake-input');
                if ($input().length !== 1) {
                    throw `2 Wrong number of bet's inputs: ${$input().length}`;
                }
                await mouseChain({target: $input()[0], events: fullClick, error: 'stake input'});
                await clearAndSimulateD($input()[0], willPlace.toString().replace('.00', '').trim());
                await delayPromise(1222);
                dLog('green', 'STOIXIMAN', `STAKE entered ${willPlace}`);
                let entered = parseFloat($input().val());
                dLog('green', 'STOIXIMAN',
                    `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
                if (isNaN(entered) || willPlace !== entered) {
                    dLog('red', 'STOIXIMAN', 'Entered !== willPlace - try to reenter!');
                    continue;
                }
                await delayPromise(300);
                const $placeBtn = $('button span:textEquals("BET NOW")');
                if ($placeBtn.length === 0 || $placeBtn.closest('button').attr('disabled')) {
                    throw 'No place button or button disabled!';
                } else if ($placeBtn.text().indexOf('Accept') > -1) {
                    await checkCoefs(data);
                }
                await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
            } while (!await checkSuccess());
            await delayPromise(555);
            await collectBetResult();
        }
    };

    const collectBetResult = async () => {
        const collected = {};
        const userBox = 'div.user-info';
        if (document.location.href.indexOf('/myaccount/') > -1) {
            const $historyTable = await waitForElement('div.bet-history-desktop', 333, 7777);
            collected.external_id = $historyTable.find('tbody tr:first td.cell-id').trt();
            collected.coef = $historyTable.find('tbody tr:first td.cell-amount').eq(1).trt().split(' ')[0].replace(',', '.').trim();
            collected.stake = $historyTable.find('tbody tr:first td.cell-amount').eq(0).trt().split(' ')[0].replace(',', '.').trim();
            window.close();
        } else {
            if($(userBox).length === 0) {
                await mouseChain({target: $('div.user-main-info__balance')[0], events: fullClick, error: 'balanceBtn'});
                await delayPromise(555);
                await waitForElement(userBox, 333, 5555);
            }
            ourCommand.add('collectBetResult', true);
            await bMess('STOIXIMAN').set(ourCommand.get());
            await delayPromise(1000);
            await dClick($(userBox).find('span:textEquals("ACCOUNT")')[0]);
            bsLogger('green', 'STOIXIMAN', 'It looks like new window opened...');
            return {message: 'wait'};
        }
        return collected;
    };

    const collectBetResults = async (inD) => {
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        dLog('', 'STOIXIMAN', [`collectBetResults, limit: ${limit}, data:`, data]);
        const collected = [];
        const userBox = 'div.user-info';

        if (document.location.href.indexOf('/myaccount/') > -1) {
            const $historyTable = await waitForElement('div.bet-history-desktop', 333, 7777);
            let idx = 0;
            if (!$historyTable.find('a[data-betstatus="All"]').hasClass('active')) {
                await mouseChain({target: $historyTable.find('a[data-betstatus="All"]')[0], events: fullClick, error: '$historyTable'});
                await delayPromise(5555);
            }
            await $('div.bet-history-desktop').find('tr.js-bet-summary').eachAsync(async function () {
                idx++;
                let status = 'ACCEPTED';
                switch ($(this).find('td.cell-returns').css('color')) {
                    case 'rgb(43, 186, 135)':
                        status = 'WON';
                        break;
                    case 'rgb(255, 0, 66)':
                        status = 'LOSE';
                        break;
                    case 'rgb(129, 129, 129)':
                        status = 'REFUNDED';
                }
                const bet = {
                    external_id: $(this).find('td.cell-id').trt(),
                    status: status,
                    coef: $(this).find('span.odds').trt().replace(/[^\d.]/g, '').trim(),
                    stake: $(this).find('td.cell-amount').eq(0).trt().split(' ')[0].replace(',', '.').trim(),
                    result: status !== 'ACCEPTED' ? $(this).find('td.cell-returns').trt().split(' ')[0].replace(',', '.').trim() : '',
                };
                if (data.length === 0 || data.indexOf(bet.external_id) > -1) {
                    collected.push(bet);
                }
                if (idx >= limit) {
                    return false;
                }
            });
            window.close();
        } else {
            if($(userBox).length === 0) {
                await mouseChain({target: $('div.user-main-info__balance')[0], events: fullClick, error: 'balanceBtn'});
                await delayPromise(555);
                await waitForElement(userBox, 333, 5555);
            }
            await bMess('STOIXIMAN').set(ourCommand.get());
            await delayPromise(1000);
            await dClick($(userBox).find('span:textEquals("ACCOUNT")')[0]);
            bsLogger('green', 'STOIXIMAN', 'It looks like new window opened...');
            return {message: 'wait'};
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
            const res = await this.cLinks[command](data, command).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            if (res.message === 'wait') {
                return;
            }
            dLog(res.success ? 'green' : 'red', 'STOIXIMAN', `${command} result: ${res.message}`);
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
            } else {
                return {};
            }
        }
    };

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
        } else if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
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
                .catch(e => dLog('red', 'STOIXIMAN', `Error till execute: ${e}`))
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
            const command = await bMess('STOIXIMAN').check(40000);
            await waitForCondition(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck), 333, 60000, 'No auth check!');
            bsLogger('green', 'STOIXIMAN', [`Restoring with (${isMain}): `, command]);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));
        port.postMessage({m: "PAGE LOADED!"});
        console.log('%c' + `stoiximan loaded and message sent! (${isMain}) ${document.location.href}`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", async () => {
        await ourCommand.save('STOIXIMAN', increaseDelay ? 150000 : 0);
        bsLogger('green', 'STOIXIMAN', [`Command was set till unload (${isMain}):`, ourCommand.get()]);
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

})();
