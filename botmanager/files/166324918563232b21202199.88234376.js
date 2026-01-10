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
    const port = isMain ? chrome.runtime.connect({name: "port_grosvenor"})
        : {postMessage: (...args) => console.log(args)};
    const settings = {
        authCheckInterval: 2000,
        url: 'https://www.grosvenorcasinos.com/sport/',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        maxWaitForScore: 60000
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
        'FOOTBALL': 'Football',
        'HOCKEY': 'Ice Hockey',
        'VOLLEYBALL': 'Volleyball',
        'TENNIS': 'Tennis',
        'TABLETENNIS': 'Table Tennis',
        'BASEBALL': 'Baseball',
        'BASKETBALL': 'Basketball',
        'CYBERSPORT': 'Esports',
    };

    function getBalance(returnNull) {
        const $b = $('span#component_balance:visible');
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.text().replace(/[^\d.]/g, '').trim());
    };

    const goLive = async () => {
        const $live = await waitForElement('div.sport-sub-nav-item-title:textEquals("Live Betting")', 333, 10000);
        await mouseChain({target: $live[0], events: fullClick, error: 'goLive'});
    };

    const authCheck = () => {
        (async () => {
            if (enterError === true) {
                port.postMessage({
                    answered: "auth_error",
                    status: "ERROR",
                });
                bsError(port, 'ERROR AUTH!');
                return;
            }
            await closeAllWeNeed({
                'button.js-cookie-got-it-btn:textEquals("Continue")': 'button.js-cookie-got-it-btn:textEquals("Continue")',
            });
            if (!limited && $('button.open-login:textEquals("Login"):visible').length > 0) {
                wasAuthCheck = false;
                port.postMessage({m: "tech works! 2"});
                await tryToLogin();
            } else {
                await waitForCondition(() => isNaN(parseFloat($('span#component_balance:visible').text().replace(/[^\d.]/g, '').trim())) === false, 333, 7777, 'no balance');
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                    limited: limited
                });
            }
        })()
            .catch(e => dLog('red', 'GROSVENOR', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    const tryToLogin = async () => {
        if (Date.now() - authClickedTime < 60000) {
            throw 'too soon!';
        }
        const controls = {
            login: 'input#input-username',
            password: 'input#input-password',
            submit: 'button.loginBtn:textEquals("Login")',
        };
        if ($('div#login_content').length === 0) {
            await mouseChain({target: $('button.open-login:textEquals("Login")')[0], events: fullClick, error: 'Login'});
        }
        await waitForCondition(() => Object.keys(controls).every(k => $(controls[k]).length > 0),
            333, 10000, 'No controls!');
        await clearAndSimulate($(controls.login)[0], settings.login);
        await delayPromise(1000);
        await clearAndSimulate($(controls.password)[0], settings.password);
        await delayPromise(1000);
        if ($(controls.login).val() !== settings.login) {
            await clearAndSimulate($(controls.login)[0], settings.login);
            await delayPromise(1000);
        }
        if ($(controls.submit).hasClass('button-disabled')) {
            enterError = true;
            limited = true;
            throw 'AUTH ERROR!';
        }
        await mouseChain({target: $(controls.submit)[0], events: fullClick, error: 'submit login'});
        await delayPromise(555);
        authClicked++;
        authClickedTime = Date.now();
        dLog('green', 'GROSVENOR', `Auth clicked ${authClicked}!`);
        await delayPromise(1000);
        const errors = await waitForCondition(() => $('form div.error-msg').length > 0,
            333, 3333).catch(() => $([]));
        if (errors.length > 0) {
            enterError = true;
            limited = true;
            throw 'AUTH ERROR!';
        }
    };

    const closePreviousCoupons = async skip => {
        if (skip) {
            return 'skipped!';
        }
        const $closeButton = $('button.mod-KambiBC-betslip__clear-btn:textEquals("Clear betslip")');
        if ($closeButton.length > 0) {
            await mouseChain({
                target: $closeButton[0], events: fullClick, error: 'closeCoupon'
            });
            await delayPromise(777);
        }
        const closes = 'button.mod-KambiBC-betslip-outcome__close-btn';
        while ($(closes).length > 0) {
            await mouseChain({
                target: $(closes).eq(0)[0], events: fullClick, scroll: true, error: 'c1'
            });
            await delayPromise(777);
        }
        return 'All were closed!';
    };

    const openEvent = async data => {
        dLog('red', 'GROSVENOR', ['openEvent', data]);
        const eventName = `${data.team1} - ${data.team2}`.toLowerCase();
        const checkWeAreThere = function () {
            const team1 = $('span[class$="KambiBC-scoreboard-container__participant-name"]').eq(0).trt();
            const team2 = $('span[class$="KambiBC-scoreboard-container__participant-name"]').eq(1).trt();
            const checkEvent = `${team1} - ${team2}`.toLowerCase();
            return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70;
        };
        const switchToSport = async sport => {
            dLog('red', 'GROSVENOR', `switchToSport: ${sport}`);
            const s = accordance[sport];
            const sportSel = `ul.KambiBC-filter-menu div.KambiBC-filter-menu__option:textEquals("${s}")`;
            const $sport = await waitForElement(sportSel, 333, 5555);
            if ($sport.hasClass('KambiBC-filter-menu__option--selected') !== true) {
                await mouseChain({
                    target: $sport[0],
                    events: fullClick,
                    error: 'switchToSport',
                    scroll: true
                });
                await delayPromise(888);
                await waitForElement(`div.KambiBC-js-component-view section a[href="#sports-hub/${s.toLowerCase()}"]`, 333, 5555);
            }
            await delayPromise(555);
        };
        const checkScore = async () => {
            if (data.score === '' || data.sport !== 'FOOTBALL'
                || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                return true;
            }
            const getScore = () => {
                const score1 = $('div.KambiBC-scoreboard-container__scorecard-score span').eq(0).trt();
                const score2 = $('div.KambiBC-scoreboard-container__scorecard-score span').eq(1).trt();
                return score1 + ':' + score2;
            };
            await waitForCondition(() => getScore() !== '',
                700, 10000, 'No score');
            dLog('orange', 'GROSVENOR', `Check score: ${getScore()}`);
            if (getScore() !== data.score.replace(/[^\d:]/g, '').trim()) {
                throw `SCORE_CHANGED => we need ${data.score}, we have ${getScore()}`;
            }
        };
        let $el = $([]);
        if (checkWeAreThere() && await checkScore()) {
            return 'We probably on event page!'
        }
        if (document.location.href.indexOf('/sport#in-play') === -1) {
            await goLive();
            await delayPromise(888);
            await waitForElement('div#KambiBC-contentWrapper div.KambiBC-breadcrumb-title:textEquals("Live Right Now")', 333, 30000);
        }
        await switchToSport(data.sport);
        $('a.KambiBC-sandwich-filter__event-list-info').each(function () {
            const $teams = $(this).find('div.KambiBC-event-participants__name');
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
        let markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Full Time',],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    roots: ['Full Time',],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    roots: ['Full Time',],
                    pivotKeys: ['Draw',],
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
                    roots: ['Total Goals',],
                    pivotKeys: ['Over#PIVOT#'],
                },
                'UNDER': {
                    roots: ['Total Goals',],
                    pivotKeys: ['Under#PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['Total Goals by #TEAM1#',],
                    pivotKeys: ['Over#PIVOT#'],
                },
                'UNDER': {
                    roots: ['Total Goals by #TEAM1#',],
                    pivotKeys: ['Under#PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['Total Goals by #TEAM2#',],
                    pivotKeys: ['Over#PIVOT#'],
                },
                'UNDER': {
                    roots: ['Total Goals by #TEAM2#',],
                    pivotKeys: ['Under#PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    roots: ['Handicap'],
                    pivotKeys: ['#TEAM1##HPIVOT#'],
                },
                'AWAY': {
                    roots: ['Handicap'],
                    pivotKeys: ['#TEAM2##HPIVOT#'],
                }
            },
            'CORNER_TOTAL': {
                'OVER': {
                    roots: ['Total Corners',],
                    pivotKeys: ['Over#PIVOT#'],
                },
                'UNDER': {
                    roots: ['Total Corners',],
                    pivotKeys: ['Under#PIVOT#'],
                },
            },
            half: {
                'ONE_TWO': {
                    'ONE': {
                        roots: ['Half Time',],
                        pivotKeys: ['#TEAM1#',],
                    },
                    'TWO': {
                        roots: ['Half Time',],
                        pivotKeys: ['#TEAM2#',],
                    },
                    'DRAW': {
                        roots: ['Half Time',],
                        pivotKeys: ['Draw',],
                    },
                    'ONE_DRAW': {
                        roots: ['Double Chance - 1st Half'],
                        pivotKeys: ['1X',],
                    },
                    'TWO_DRAW': {
                        roots: ['Double Chance - 1st Half'],
                        pivotKeys: ['X2',],
                    },
                    'ONE_TWO': {
                        roots: ['Double Chance - 1st Half'],
                        pivotKeys: ['12',],
                    }
                },
                'TOTAL': {
                    'OVER': {
                        roots: ['Total Goals - 1st Half',],
                        pivotKeys: ['Over#PIVOT#'],
                    },
                    'UNDER': {
                        roots: ['Total Goals - 1st Half',],
                        pivotKeys: ['Under#PIVOT#'],
                    },
                },
                'T1_TOTAL': {
                    'OVER': {
                        roots: ['Total Goals by #TEAM1# - 1st Half',],
                        pivotKeys: ['Over#PIVOT#'],
                    },
                    'UNDER': {
                        roots: ['Total Goals by #TEAM1# - 1st Half',],
                        pivotKeys: ['Under#PIVOT#'],
                    },
                },
                'T2_TOTAL': {
                    'OVER': {
                        roots: ['Total Goals by #TEAM2# - 1st Half',],
                        pivotKeys: ['Over#PIVOT#'],
                    },
                    'UNDER': {
                        roots: ['Total Goals by #TEAM2# - 1st Half',],
                        pivotKeys: ['Under#PIVOT#'],
                    },
                },
                'HDP': {
                    'HOME': {
                        roots: ['Handicap - 1st Half'],
                        pivotKeys: ['#TEAM1##HPIVOT#'],
                    },
                    'AWAY': {
                        roots: ['Handicap - 1st Half'],
                        pivotKeys: ['#TEAM2##HPIVOT#'],
                    }
                },
            }
        }

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw `Unsupported ${data.time_value} / ${data.market} / ${data.target}`;
        }

        if (['FULL_TIME', 'FULL_MATCH'].indexOf(data.time_value) === -1 && data.sport === 'FOOTBALL') {
            markets = markets.half;
        }

        const m = markets[data.market][data.target];
        let htValue = '';
        let fullTime = 'Full Time';
        let halfTime = 'Half Time';

        if (data.time_value.indexOf('FULL') === -1) {
            if (data.sport === 'HOCKEY') {
                //TODO: hockey
            }
            if (data.sport === 'TENNIS') {
                if (data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') > -1)  {
                    halfTime = 'Game';
                    const parts = data.time_value.split('_GAME_');
                    const set = parts[0].replace(/[^\d]/g, '');
                    const game = parts[1];
                    if (data.market === 'ONE_TWO') {
                        m.roots[0] = `Set ${set} - Game ${game}`;
                    }
                    if (data.market === 'TOTAL') {
                        m.roots[0] = `Total Points - Set ${set}, Game ${game}`;
                    }
                } else {
                    halfTime = 'Set';
                    const set = data.time_value.replace(/[^\d]/g, '');
                    if (data.market === 'ONE_TWO') {
                        m.roots[0] = `Set ${set}`;
                    }
                    if (data.market === 'TOTAL') {
                        m.roots[0] = `Total Games - Set ${set}`;
                    }
                }
            }
        } else {
            if (data.sport === 'TENNIS') {
                fullTime = 'Match'
                if (data.market === 'ONE_TWO') {
                    m.roots[0] = 'Most Games';
                }
                if (data.market === 'TOTAL') {
                    m.roots[0] = 'Total Games';
                }
                if (data.market === 'HDP') {
                    m.roots[0] = 'Game Handicap';
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
        // select tab
        const $tabMenu = await waitForElement('ul.KambiBC-betoffer-categories-filter', 333, 10000);
        const tabType = data.market === 'CORNER_TOTAL' ? 'Corners' : 'All';
        const $selectTab = $tabMenu.find(`li:textEquals("${tabType}")`);
        if ($selectTab.hasClass('KambiBC-betoffer-categories-filter--selected') === false) {
            await mouseChain({target: $selectTab[0], events: fullClick, error: 'All tab'});
            await delayPromise(2222);
        }
        // expand full or half lists if nedeed
        const $marketList = await waitForElement('ul.KambiBC-list-view__column', 333, 10000);
        const listType = ['FULL_TIME', 'FULL_MATCH'].indexOf(data.time_value) === -1 ? halfTime : fullTime;
        const $eventsList = $marketList.find(`div[class^="CollapsibleContainer__Title-"]:textEquals("${listType}")`).closest('li');
        if ($eventsList.hasClass('KambiBC-expanded') === false) {
            await mouseChain({target: $marketList.find(`div[class^="CollapsibleContainer__Title-"]:textEquals("${listType}")`)[0], events: fullClick, error: 'expand list'});
            await delayPromise(1222);
            await waitForCondition(() => $eventsList.find('ul.KambiBC-bet-offer-category__subcategories').length > 0,
                333, 10000, 'no expand or events no exist!');
        }
        const $findPivot = ($root) => {
            for (const pvt of m.pivotKeys) {
                const $pivot = $root.closest('div.KambiBC-bet-offer-subcategory__header').next().find(`div[class^="OutcomeButton__LabelAndExtras-sc"]:textEquals("${pvt}")`);
                if ($pivot.length === 1) {
                    return $pivot.closest('button');
                } else if ($pivot.length > 1) {
                    throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                }
            }
            return $([]);
        }
        let $found = $([]);
        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () => $eventsList.find(`li.KambiBC-bet-offer-subcategory h3.KambiBC-bet-offer-subcategory__label:textEqualsIS("${root}")`);
            if ($root().length === 0) {
                continue;
            }
            if ($root().parent().next().find('button:textEquals("Show list")').length > 0) {
                await mouseChain({target: $root().parent().next().find('button:textEquals("Show list")')[0], events: fullClick, error: 'show list'});
                await delayPromise(2222);
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

    const openCoupon = async paramData => {
        dLog('green', 'GROSVENOR', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'GROSVENOR', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'GROSVENOR', 'Event must be opened!');
            const $element = await getBetElement(data);
            const waitForCouponVisibleStarted = Date.now();
            let performElementClick = async function () {
                await mouseChain({target: $element[0], events: fullClick, error: 'performElementClick'});
            };
            const checkCoupon = () => {
                let event = (data.team1 + ' - ' + data.team2).toLowerCase();
                let result = false;
                $('ul.mod-KambiBC-betslip__outcome-list li').each(function () {
                    let ev = $(this).find('a.mod-KambiBC-betslip-outcome__event-link').text().replace(/\*/g, '').trim().toLowerCase();
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
            const localMatch = v.team1.toLowerCase() + ' - ' + v.team2.toLowerCase();
            return localMatch === match.toLowerCase()
                || locutus_similar_text(localMatch, match.toLowerCase(), true) > 70;
        });
        const $coupons = $('ul.mod-KambiBC-betslip__outcome-list li');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $(this).find('a.mod-KambiBC-betslip-outcome__event-link').text()
                .replace(/\*/g, '').trim().toLowerCase();
            if ($this.find('span.mod-KambiBC-betslip-outcome__odds:textEquals("Suspended")').length > 0) {
                errors.push(match + ' LOW_COEF, market unavailable!');
                checked++;
                return true;
            }
            const localCoef = decOdds($this.find('span.mod-KambiBC-betslip-outcome__odds').trt());
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
        const checkSuccess = async () => {
            const started = Date.now();
            while (Date.now() - started < 30000) {
                if ($('div.mod-KambiBC-betslip__overlay--error').length > 0) {
                    throw `Error: ${$('div.mod-KambiBC-betslip__overlay--error').find('h1.mod-KambiBC-betslip-feedback__title').trt()}`;
                } else if ($('h2.mod-KambiBC-betslip-receipt-header__title:textEquals("Your bet has been placed!")').length > 0) {
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
            dLog('green', 'GROSVENOR', `Will place (performBet): ${willPlace}`);
            const $input = $('input.mod-KambiBC-stake-input');
            if ($input.length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            await mouseChain({target: $input[0], events: fullClick, error: 'l1'});
            await clearAndSimulateD($input[0], willPlace.toString().replace('.00', '').trim());
            await delayPromise(1222);
            dLog('green', 'GROSVENOR', `STAKE entered ${willPlace}`);
            let entered = parseFloat($input.val());
            dLog('green', 'GROSVENOR',
                `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'GROSVENOR', 'Entered !== willPlace - try to reenter!');
                continue;
            }
            const $placeBtn = $('button.mod-KambiBC-betslip__place-bet-btn');
            if ($placeBtn.length === 0 || $placeBtn.attr('disabled')) {
                throw 'No place button or button disabled!';
            } else if ($placeBtn.text().indexOf('Approve odds change') > -1) {
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
        await delayPromise(888);
        collected.external_id = $('div.mod-KambiBC-betslip__receipt p.mod-KambiBC-betslip-receipt-header__receipt-id').trt().replace(/[^\d.]/g, '').trim();
        collected.coef = decOdds($('dl.mod-KambiBC-betslip-receipt__wrapper').children().eq(2).find('dd.mod-KambiBC-betslip-receipt__value').trt());
        collected.stake = $('dl.mod-KambiBC-betslip-receipt__wrapper').children().eq(1).find('dd.mod-KambiBC-betslip-receipt__value').trt().replace(/[^\d.]/g, '').trim();
        await mouseChain({target: $('button.mod-KambiBC-betslip-receipt__close-button')[0], events: fullClick, error: 'close modal'});
        await delayPromise(777);

        return collected;
    };

    const collectBetResults = async (inD) => {
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        dLog('green', 'GROSVENOR', [`collectBetResults, limit: ${limit}, data:`, data]);
        const collected = [];
        if (document.location.href.indexOf('/sport#bethistory/') === -1) {
            const $myBets = await waitForElement('span.KambiBC-navigation-menu__label--title:textEquals("My Bets")', 333, 10000);
            await mouseChain({target: $myBets[0], events: fullClick, error: 'goLive'});
            await delayPromise(1000);
        }
        const $myBets = await waitForElement('div.KambiBC-my-bets-summary__coupons-list', 333, 10000);
        await delayPromise(555);
        let idx = 0;
        $myBets.children().each(function () {
            idx++;
            const $this = $(this);
            const status = $this.find('span.KambiBC-my-bets-summary__coupon-status').trt() === 'Open' ? 'ACCEPTED'
                : $this.find('span.KambiBC-my-bets-summary__coupon-status').trt() === 'Won' ? 'WON'
                    : 'LOSE';
            const bet = {
                external_id: $this.find('div.KambiBC-my-bets-summary__coupon-ref span.KambiBC-my-bets-summary__value').trt(),
                status: status,
                coef: decOdds($this.find('div.KambiBC-my-bets-summary__coupon-top-left span.KambiBC-my-bets-summary__value').eq(1).trt()),
                stake: $this.find('span.KambiBC-my-bets-summary__stake-value').trt().replace(/[^\d.]/g, '').trim(),
                result: status !== 'ACCEPTED' ? $this.find('span.KambiBC-my-bets-summary__stake-value').trt().replace(/[^\d.]/g, '').trim() : '',
            };
            if (data.length === 0 || data.indexOf(bet.external_id) > -1) {
                collected.push(bet);
            }
            if (idx >= limit) {
                return false;
            }
        });
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
            dLog(res.success ? 'green' : 'red', 'GROSVENOR', `${command} result: ${res.message}`);
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
        } else if (commands.exists(message.action)) {
            // Hint: execute command
            busy = true;
            ourCommand.set(message);
            commands.execute(message.action, message.data)
                .catch(e => dLog('red', 'GROSVENOR', `Error till execute: ${e}`))
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
            const command = await bMess('GROSVENOR').check(40000);
            await waitForCondition(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck), 333, 60000, 'No auth check!');
            bsLogger('green', 'GROSVENOR', [`Restoring with (${isMain}): `, command]);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));
        port.postMessage({m: "PAGE LOADED!"});
        console.log('%c' + `GROSVENOR loaded and message sent! (${isMain}) ${document.location.href}`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", async () => {
        await ourCommand.save('GROSVENOR', increaseDelay ? 150000 : 0);
        bsLogger('green', 'GROSVENOR', [`Command was set till unload (${isMain}):`, ourCommand.get()]);
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

})();
