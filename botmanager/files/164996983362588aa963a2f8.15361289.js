(function () {

    "use strict";

    /**
     * @import libs/jquery-3.3.1.min.js
     */

    let stopSports = false;
    let newAPI = false;
    let authClicked = 0;
    let busy = false;
    let increaseDelay = false;
    const bkHere = document.location.href.indexOf('nordicbet') > -1 ? 'nordicbet'
        : (document.location.href.indexOf('casinowinner') > -1 || document.location.href.indexOf('bpsgameserver') > -1)
            ? 'casinowinner' : 'betsson';

    const port = window.self === window.top
        ? chrome.runtime.connect({name: `port_${bkHere}`})
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
        'HOCKEY': 'Hockey',
        'VOLLEYBALL': 'Volleyball',
        'TENNIS': 'Tennis',
        'TABLETENNIS': 'Table Tennis',
        'BASEBALL': 'Baseball',
        'BASKETBALL': 'Basketball',
        'CYBERSPORT': 'Esports',
    };

    const ourCommand = new ourCommandProto();
    const smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);

    const getBalance = returnNull => {
        const $b = $(findSel(['span.obg-m-user-summary-balance',
            'div[data-testid="accountAreaBalance"]']));
        if ($b.length > 0) {
            return parseFloat($b.text().replace(',', bkHere === 'casinowinner' ? '.' : '')
                .replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    }

    const authCheck = function () {
        //dLog('', 'Betsson', 'Auth check');
        (async () => {
            if ($('h1.ng-star-inserted:textEquals("Logged Out")').length > 0) {
                document.location.reload();
                return;
            }
            const $agree = () => $getIFrame('#BCore-ModalDialog-Content-iframe-UpdatedTermsAndConditions')
                .find('a.btn:contains("Agree")');
            if ($agree().length > 0) {
                await mouseChain({target: $agree()[0], events: fullClick, error: '$agree()'});
            }
            const $dialog = () => $('div[data-testid="ModalDialogCloseButton"]');
            if ($dialog().length > 0) {
                await mouseChain({target: $dialog()[0], events: fullClick, error: '$dialog()'});
            }
            if (checkSE(['a[test-id="header-login-button"]', 'button[test-id="alert-button-Login"]',
                'a[data-testid="accountAreaToggleLogin"]'])) {
                // Hint: Log In
                port.postMessage({m: "tech works! 2"});
                await delayPromise(1000);
                await tryToLogIn().catch(e => bsError(port, 'Error login: ' + e));
            } else {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch(e => dLog('red', 'Betsson', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const tryToLogIn = async () => {
        //throw 'Testing!';
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        await mouseChain({
            target: $(findSel(['a[test-id="header-login-button"]',
                'button[test-id="alert-button-Login"]', 'a[data-testid="accountAreaToggleLogin"]']))[0],
            events: fullClick, error: 'logLink'
        });
        await delayPromise(1000);
        if (bkHere === 'casinowinner') {
            const $login = () => $getIFrame('#login-iframe').find('#tbUsername');
            const $password = () => $getIFrame('#login-iframe').find('#tbPassword');
            const $submit = () => $getIFrame('#login-iframe').find('button.loginbtn');
            await waitForCondition(() => $login().length > 0 && $password().length > 0 && $submit().length > 0,
                333, 10000, 'No inputs!');
            await delayPromise(500);
            if ($login().val() !== settings.login) {
                await clearAndInputEmail($login()[0], settings.login);
                await delayPromise(2000);
            }
            await clearAndSimulate($password()[0], settings.password);
            await delayPromise(3000);
            authClicked = Date.now();
            await mouseChain({target: $submit()[0], events: fullClick, error: 'Enter'});
        } else {
            const sels = [
                findSel(['input[test-id="login-username"]']),
                findSel(['input[test-id="login-password"]']),
                findSel(['button[test-id="login-submit"]']),
                findSel(['mat-slide-toggle[test-id="login-should-remember-user"]']),
            ];
            await waitForCondition(() => checkSE(sels, false), 333,
                10000, 'No inputs!');
            await delayPromise(500);
            if ($(sels[0]).val() !== settings.login) {
                await clearAndInputEmail($(sels[0])[0], settings.login);
                await delayPromise(2000);
            }
            await clearAndSimulate($(sels[1])[0], settings.password);
            if ($(sels[3]).length > 0 && !$(sels[3]).hasClass('mat-checked')) {
                await delayPromise(2000);
                await mouseChain({
                    target: $(sels[3]).find('label')[0], events: fullClick,
                    error: 'sels3'
                });
            }
            await delayPromise(3000);
            authClicked = Date.now();
            await mouseChain({target: $(sels[2])[0], events: fullClick, error: 'Enter'});
        }
        dLog('', 'DF', 'Auth clicked!');
        return "auth_clicked";
    };

    const closePreviousCoupons = async skip => {
        if (skip) {
            return 'skipped!';
        }
        // Hint: Click 'Remove all' once or every 'Close'
        let $clearBtn = $('button.obg-m-betslip-selection-remove-all-button');
        if ($clearBtn.length === 1) {
            await mouseChain({
                target: $clearBtn[0],
                events: fullClick,
                scroll: true,
                error: 'c0'
            });
            await delayPromise(1000);
            return 'ClearBtn clicked!';
        }
        const closes = findSel(['div.obg-m-betslip-selection-remove',
            'a.betslip_btnremove:visible']);
        while ($(closes).length > 0) {
            await mouseChain({
                target: $(closes).eq(0)[0], events: fullClick, scroll: true, error: 'c1'
            });
            await delayPromise(500);
        }
        return 'All were closed!';
    };

    const checkInplay = async () => {
        if (bkHere === 'casinowinner' && window.self !== window.top) {
            return true;
        }
        if ((bkHere !== 'casinowinner' && document.location.href.indexOf('/sportsbook/live/') === -1)
            || document.location.href.indexOf('?eventId=') > -1
            || (bkHere === 'casinowinner' && document.location.href.indexOf('live-betting') === -1)) {
            await mouseChain({
                target: $(findSel(['a[test-id="menu.product.livebet"]', 'a[title="Live Betting"]']))[0],
                events: fullClick,
                scroll: true,
                error: 'LIVE_HREF'
            });
            await delayPromise(2000);
        }
    };

    const openEventWinner = async data => {
        dLog('red', 'CasinoWinner', ['openEvent', data]);
        const eventName = `${data.team1} - ${data.team2}`.toLowerCase();
        const checkWeAreThere = function () {
            const $teams = $('tr.homeScore th:first, tr.awayScore th:first');
            if ($teams.length !== 2) {
                return false;
            }
            const checkEvent = `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}`.toLowerCase();
            //dLog('red', 'Betsson', `checkWeAreThere: '${checkEvent}' === '${eventName}'`);
            return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70;
        };
        let checkScore = async () => {
            if (data.score === '' || data.sport !== 'FOOTBALL'
                || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                return true;
            }
            const getScore = () => {
                const $scores = $(findSel(['tr.homeScore td.currentScore, tr.awayScore td.currentScore']));
                return `${$scores.eq(0).trt()}:${$scores.eq(1).trt()}`;
            };
            await waitForCondition(() => getScore() !== ':' && getScore() !== '',
                700, 10000, 'No score 1');
            dLog('orange', 'CasinoWinner', `Check score: ${getScore()}`);
            if (getScore() !== data.score.replace(/[^\d:]/g, '').trim()) {
                throw `SCORE_CHANGED => we need ${data.score}, we have ${getScore()}`;
            }
            return true;
        };
        if (checkWeAreThere() && await checkScore()) {
            return 'We probably on event page!'
        }
        let $el = $([]);
        const evSel = 'li.liveMenuToggle:has(#menuSelectorLiveOnGoing) a[href^="#/event/"]';
        await waitForElement(evSel, 333, 30000);
        $('li.liveMenuToggle:has(#menuSelectorLiveOnGoing) a[href^="#/event/"]').each(function () {
            const eventHere = $(this).find('span.name').trt().toLowerCase();
            if (eventHere === eventName || locutus_similar_text(eventHere, eventName, true) > 80) {
                $el = $(this);
                return false;
            } else {
                console.log(`'${eventHere}' !== '${eventName}'`);
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

    const openEvent = async data => {
        if (bkHere === 'casinowinner') {
            return await openEventWinner(data);
        }
        dLog('red', 'Betsson', ['openEvent', data]);
        const eventName = `${data.team1} - ${data.team2}`.toLowerCase();
        const checkWeAreThere = function () {
            const $teams = $('div.obg-m-event-header-participant span.obg-m-event-header-participant-label');
            if ($teams.length !== 2) {
                return false;
            }
            const checkEvent = `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}`.toLowerCase();
            //dLog('red', 'Betsson', `checkWeAreThere: '${checkEvent}' === '${eventName}'`);
            return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70;
        };
        const switchToSport = async sport => {
            dLog('', 'Betsson', `switchToSport: ${sport}`);
            const s = accordance[sport];
            const sportSel = `obg-tab-label span.ng-star-inserted:textEquals("${s}")`;
            const $sport = await waitForElement(sportSel, 333, 15000);
            if (!$sport.hasClass('active')) {
                await mouseChain({
                    target: $sport.prev()[0],
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
                if ($('div.sr-lmt-plus-scb__result').length > 0) {
                    return $('div.sr-lmt-plus-scb__result').trt();
                } else {
                    return `${$('span.current-score').eq(0).trt()}:${$('span.current-score').eq(1).trt()}`;
                }
            };
            await waitForCondition(() => getScore() !== ':' && getScore() !== '',
                700, 10000, 'No score 2');
            dLog('orange', 'Betsson', `Check score: ${getScore()}`);
            if (getScore() !== data.score.replace(/[^\d:]/g, '').trim()) {
                throw `SCORE_CHANGED => we need ${data.score}, we have ${getScore()}`;
            }
            return true;
        };
        if (checkWeAreThere() && await checkScore()) {
            return 'We probably on event page!'
        }
        dLog('blue', 'Betsson', 'Need to open!');
        await checkInplay();
        await switchToSport(data.sport);
        await delayPromise(1000);
        let $el = $([]);
        await $('div.obg-m-events-master-detail-header').eachAsync(async function () {
            if (!$(this).hasClass('expanded')) {
                await mouseChain({target: $(this)[0], events: fullClick, error: 'expand', scroll: true});
                await delayPromise(1000);
            } else {
                this.scrollIntoView();
            }
            $(this).next().find('div.obg-event-info-participant-score').each(function () {
                const $teams = $(this).find('div.obg-event-info-participant-label');
                let checkEvent = `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}`.toLowerCase();
                const res = checkEvent === eventName
                    || locutus_similar_text(checkEvent, eventName, true) > 70;
                dLog('color: darkgray;', 'Betsson',
                    `"${checkEvent}" ${(res ? '==' : '!=')} "${eventName}"`);
                if (res) {
                    $el = $(this);
                    return false;
                }
            });
            if ($el.length > 0) {
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
        const $teams = $(findSel(['div.obg-m-event-header-participant span.obg-m-event-header-participant-label',
            'tr.homeScore th:first, tr.awayScore th:first']));
        if ($teams.length === 2) {
            data.team1 = $teams.eq(0).trt();
            data.team2 = $teams.eq(1).trt();
        } else {
            throw 'No teams!';
        }

        const markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Match Result', 'Match Winner'],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    roots: ['Match Result', 'Match Winner'],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    roots: ['Match Result', 'Match Winner'],
                    pivotKeys: ['Draw', 'X'],
                },
                'ONE_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or Draw', '1X'],
                },
                'TWO_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['Draw or #TEAM2#', 'X2'],
                },
                'ONE_TWO': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or #TEAM2#', '12'],
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['Total Goals', 'Number of goals'],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    roots: ['Total Goals', 'Number of goals'],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['Total Goals - Home Team',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    roots: ['Total Goals - Home Team',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['Total Goals - Away Team',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    roots: ['Total Goals - Away Team',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    roots: ['Total Corners',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    roots: ['Total Corners',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    roots: [bkHere !== 'casinowinner' ? 'Asian Handicap' : 'Asian Handicap (0 - #PIVOT#)',],
                    pivotKeys: ['1 (#PIVOTH#)', '#TEAM1#'],
                },
                'AWAY': {
                    roots: [bkHere !== 'casinowinner' ? 'Asian Handicap' : 'Asian Handicap (0 - #PIVOT#)',],
                    pivotKeys: ['2 (#PIVOTH#)', '#TEAM2#'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    roots: ['3-way Handicap', '3-way Handicap (#ECPIVOT#)'],
                    pivotKeys: ['1 (#PIVOTH#)', '#TEAM1#'],
                },
                'H2': {
                    roots: ['3-way Handicap', '3-way Handicap (#ECPIVOT#)'],
                    pivotKeys: ['2 (#PIVOTH#)', '#TEAM2#'],
                },
                'HX': {
                    roots: ['3-way Handicap', '3-way Handicap (#ECPIVOT#)'],
                    pivotKeys: ['X (#PIVOTH#)', 'X'],
                }
            },
        };

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw `Unsupported ${data.time_value} / ${data.market} / ${data.target}`;
        }

        const m = markets[data.market][data.target];

        if (data.market === 'HDP' && parseFloat(data.pivot) === 0) {
            m.roots = ['Draw No Bet'];
            m.pivotKeys = [`#TEAM${(data.target === 'HOME' ? '1' : '2')}#`];
        }

        if (data.time_value.indexOf('FULL') === -1) {
            if (data.market === 'ONE_TWO' && data.target.indexOf('_') === -1) {
                m.roots = ['Half Time'];
            } else {
                for (let i in m.roots) {
                    if (m.roots.hasOwnProperty(i)) {
                        if (['EURO_HDP', 'HDP',].indexOf(data.market) > -1
                            && !(data.market === 'HDP' && parseFloat(data.pivot) === 0)) {
                            if (data.market === 'EURO_HDP') {
                                m.roots[i] = `1st Half ${m.roots[i]}`.replace('-', ' ');
                            } else {
                                m.roots[i] = `1st Half ${m.roots[i]}`;
                            }
                        } else {
                            m.roots[i] = `${m.roots[i]} - 1st Half`;
                        }
                    }
                }
            }
        }

        const ePivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };

        const ecPivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p} - 0` : p < 0 ? `0 - ${Math.abs(p)}` : '0';
        };

        const hPivot = pvt => parseFloat(pvt) > 0 ? `+${pvt}` : pvt;

        replaceInner(m, {
            '#TEAM1#': data.team1,
            '#TEAM2#': data.team2,
            '#PIVOT#': data.pivot,
            '#EPIVOT#': ePivot(data.pivot),
            '#ECPIVOT#': ecPivot(data.pivot),
            '#PIVOTH#': hPivot(data.pivot),
        });

        dLog('green', 'Betsson', ['Final market is:', m]);

        if (bkHere !== 'casinowinner') {
            const $tab = await waitForElement(`obg-tab-label:textEquals("All")`, 333, 15000);
            if (!$tab.hasClass('active')) {
                await mouseChain({
                    target: $tab[0],
                    events: fullClick, error: '$tab'
                });
                await delayPromise(1000);
            }
        }

        /**
         *
         * @param $root
         * @returns {jQuery<HTMLElement>}
         */
        const $findPivot = $root => {
            console.log($root);
            for (const pvt of m.pivotKeys) {
                const $p = bkHere === 'casinowinner'
                    ? $root.find(findSelIn([`a.AddSelection:textEqualsIS("${pvt}")`,
                        `td.selection:has(span.name:textEquals("${pvt}"))`], $root))
                    : $root.find(`span.obg-selection-content-label:textEqualsIS("${pvt}")`);
                if ($p.length > 0) {
                    return $p.parent();
                }
            }
            return $([]);
        };

        let $found = $([]);
        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () => bkHere === 'casinowinner'
                ? $(findSel([`li.marketgroup:has(h3#caption:textEquals("${root}"))`,
                    `tr.market:has(th:textEquals("${root}"))`]))
                : $(`div.obg-m-event-market-group-header`
                    + `:has(span.obg-m-event-market-group-header-name:textEqualsIS("${root}"))`);
            if ($root().length === 0) {
                continue;
            }
            if (bkHere !== 'casinowinner' && !$root().hasClass('expanded')) {
                await mouseChain({target: $root()[0], events: fullClick, error: 'expand'});
                await delayPromise(1500);
            } else {
                $root().get(0).scrollIntoView();
            }
            $found = $findPivot(bkHere === 'casinowinner' ? $root() : $root().parent());
            if ($found.length > 0) {
                break;
            }
        }
        if ($found.length === 0) {
            throw `${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot}`
            + ' not found :(';
        }
        if (bkHere !== 'casinowinner' && $found.get(0).getAttribute('disabled') === 'true') {
            throw `Market not available!`;
        }
        return $found;
        //#-#-FINISH
    };

    const openCoupon = async paramData => {
        dLog('green', 'Betsson', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'Betsson', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'Betsson', 'Event must be opened!');
            const $element = await getBetElement(data);
            console.log($element);
            let coefWeWaitFor = bkHere === 'casinowinner'
                ? $element.parent().find('span.odds').trt()
                : $element.find('obg-numeric-change span').trt();
            dLog('green', bkHere, `We got element! Coef: ${coefWeWaitFor}`);
            const waitForCouponVisibleStarted = Date.now();
            let elementWasClicked = 0;
            let performElementClick = async function () {
                dLog('green', bkHere, 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                    + ') /' + (Date.now() - elementWasClicked));
                await mouseChain({target: $element[0], events: fullClick, error: 'performElementClick'})
                elementWasClicked = Date.now();
            };
            const checkCoupon = () => {
                let event = `${data.team1} - ${data.team2}`.toLowerCase();
                let result = false;
                $(findSel(['obg-m-betslip-selection', '#betslip_bets th.eventNameCombined',
                    '#betslip_bets th.eventName']))
                    .each(function () {
                        const $teams = $(this).find('div.obg-event-info-participant-label');
                        let ev = bkHere === 'casinowinner'
                            ? $(this).trt().replace($(this).find('p').trt(), '')
                                .replace(/\s+/g, ' ')
                                .trim().toLowerCase()
                            : `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}`.toLowerCase();
                        if (event === ev || locutus_similar_text(event, ev, true) > 70) {
                            result = true;
                            return false;
                        } else {
                            dLog('red', bkHere, `'${ev}' !== '${event}'`);
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
                return 100500100;
            };
            if (paramData.length > 1) {
                dLog('red', 'Betsson', `Express here! ${i}/${(paramData.length - 1)}`);
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
            const localMatch = `${v.team1} - ${v.team2}`.toLowerCase();
            return localMatch === match || locutus_similar_text(localMatch, match, true) > 70;
        });
        const $coupons = $(findSel(['obg-m-betslip-selection', '#betslip_bets th.eventNameCombined',
            '#betslip_bets th.eventName']));
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            let match = '';
            if (bkHere === 'casinowinner') {
                match = $this.trt().replace($this.find('p').trt(), '')
                    .replace(/\s+/g, ' ')
                    .trim().toLowerCase();
            } else {
                const $teams = $this.find('div.obg-event-info-participant-label');
                if ($teams.length !== 2) {
                    throw `No teams CheckCoefs!`;
                }
                match = `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}`.toLowerCase();
            }
            console.log(match);
            if ($this.hasClass('market-unavailable')) {
                errors.push(match + ' LOW_COEF, market unavailable!');
                checked++;
                return true;
            }
            let localCoef = bkHere === 'casinowinner'
                ? ($this.parent().next().find('span.odds').trt() === ''
                    ? parseFloat($this.parent().parent().find('span.odds').trt())
                    : parseFloat($this.parent().next().find('span.odds').trt()))
                : parseFloat($this.find('span.obg-m-betslip-selection-value').trt());
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

    /*
    // Test:
    await checkCoefs([
        {team1: 'guarani', team2: 'américa mg', coef: '2.1'},
        {team1: 'philadelphia 76ers', team2: 'charlotte hornets', coef: '2.1'},
    ]);
     */

    const depositCashier = async data => {
        dLog('orange', 'Cashier', ['depositCashier:', data]);
        const $skrill = await waitForElement('li[data-name="moneybookers"]', 333, 15000);
        if (!$skrill.hasClass('is-active')) {
            await delayPromise(1000);
            await mouseChain({
                target: $skrill.find('a')[0], events: fullClick,
                error: '$skrill'
            });
            await delayPromise(3000);
        }
        const $amount = await waitForElement('input.amount-field--input', 333, 15000);
        await delayPromise(1000);
        await clearAndInputNumber($amount[0], data.amount);
        await delayPromise(3000);
        await bMess(`${data.paysystem}_COMMAND`, true).set(ourCommand.get());
        await mouseChain({
            target: $('button:textEquals("Deposit")')[0], events: fullClick,
            error: 'Deposit'
        });
        dLog('green', 'CASHIER', `Should process ${data.paysystem}!`);
        ourCommand.clear();
        const $close = await waitForElement('button:textEquals("Close")', 500, 200000)
            .catch(() => $([]));
        if ($close.length === 0) {
            document.location.reload();
        } else {
            await mouseChain({target: $close[0], events: fullClick, error: '$close'});
        }
    };

    const deposit = async data => {
        if (ourCommand.getAdded('BankOpened')) {
            dLog('orange', 'Betsson', `Wait for deposit result`);
            return await bMess('DEPOSIT_RESULT', true).get(200000, 60000)
                .catch(() => ({success: false, message: 'No result for 200s :('}));
        } else if (!ourCommand.getAdded('BankOpened')) {
            increaseDelay = true;
            const $bank = await waitForElement(bkHere === 'casinowinner'
                ? 'a[data-testid="accountAreaDepositButton"]' : 'a[test-id="header-deposit-button"]',
                333, 15000);
            await bMess('BetssonCashier').set(ourCommand.get());
            await delayPromise(2000);
            await mouseChain({target: $bank[0], events: fullClick, error: '$bank'});
            ourCommand.add('BankOpened', true);
            const $dwb = await waitForElement('button[test-id="deposit-bonus-deposit-without-bonus-button"]',
                333, 10000)
                .catch(() => $([]));
            if ($dwb.length > 0) {
                await bMess('BetssonCashier').set(ourCommand.get());
                await mouseChain({target: $dwb[0], events: fullClick, error: '$dwb'});
            }
            await delayPromise(5000);
        } else {
            throw `Bad situation till DEPOSIT: ${ourCommand.getAdded('PsOpened')}/`
            + `${ourCommand.getAdded('BankOpened')} at ${document.location.href}`;
        }
        return await deposit(data);
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
                    dLog('orange', 'Betsson', `sms: '${m}'`);
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
            await goToLobby();
            await delayPromise(1000000);
        }
    };

    const proceedBet = async (data, command, balance) => {
        dLog('red', bkHere, [
            `proceedBet ${window.self === window.top} at ${document.location.href} (${balance})`, data]);
        if (window.self === window.top && bkHere === 'casinowinner') {
            await waitForCondition(() => $(findSel(['span.obg-m-user-summary-balance',
                'div[data-testid="accountAreaBalance"]'])).length > 0, 333, 15000);
            const balance = getBalance();
            dLog('green', 'CW', `CW: ${command}, ${balance}`);
            await checkInplay();
            await bMess('CWSportCommand').set({action: 'BET', data, balance});
            dLog('red', 'CW', `Awaiting for result`);
            return await bMess('CWSportResult')
                .get(110000, 10000, 300, true);
        }
        const checkSuccess = async () => {
            const started = Date.now();
            while (Date.now() - started < 30000) {
                const alertText = $('div.notificationMessage').trt();
                const acceptedText = $(findSel(['obg-message.obg-m-betslip-receipt-success-message',
                    '#betslip_confirmBox:visible'])).trt();
                if (alertText.indexOf('Изменения в параметрах ставок.') > -1) {
                    return false;
                } else if (alertText !== '') {
                    throw `Error: ${alertText}`;
                } else if (acceptedText.indexOf('Bet placed') > -1
                    || acceptedText.indexOf('Bet was placed successfully') > -1) {
                    return true;
                }
                await delayPromise(400);
            }
            throw `No bet result in ${(Date.now() - started)}`;
        };
        const checkBalance = willPlace => {
            const bl = bkHere === 'casinowinner' ? balance : getBalance();
            if (bl < willPlace) {
                throw `NO_FUNDS - now: ${bl}, we need: ${willPlace}`;
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
            const place = willPlace.toString().replace('.00', '').trim();
            dLog('green', 'Betsson', `Will place (performBet): ${place}, balance: ${getBalance()}`);
            const $input = () => $(findSel(['input[placeholder="Stake"]',
                '#betslip_holder input[type="text"]']));
            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            if ($input().val() !== place) {
                await clearAndSimulate($input()[0], place);
                await delayPromise(800);
                dLog('green', bkHere, `STAKE entered ${place}`);
                let entered = parseFloat($input().val());
                dLog('green', 'Betsson',
                    `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
                if (isNaN(entered) || willPlace !== entered) {
                    dLog('red', 'Betsson', 'Entered !== willPlace - try to reenter!');
                    continue;
                }
                await delayPromise(300);
            }
            const $placeBtn = $(findSel(['button[test-id="place.bet"]', '#betslip_submit']));
            if ($placeBtn.length === 0 || $placeBtn.attr('disabled')) {
                throw 'No place button or button disabled!';
            }
            if ($placeBtn.trt().indexOf('Accept Odds Changes') > -1) {
                await checkCoefs(data);
            }
            await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
        } while (!await checkSuccess());
        await delayPromise(1000);
        // Hint: collect result
        let res;
        if (bkHere !== 'casinowinner') {
            res = {
                external_id: $('div.obg-coupon-summary-header div:first').trt().replace(/[^\d]/g, ''),
                coef: $('span.obg-coupon-summary-value-odds').trt(),
                stake: $('div[test-id="total-stake"] span:last').trt().replace(/[^\d.]/g, ''),
                max: currentBetData.max,
            };
            await mouseChain({
                target: $('button:textEquals("Continue")')[0],
                events: fullClick, error: 'Continue'
            });
        } else {
            await mouseChain({
                target: $('#openBets-tab-link')[0], events: fullClick,
                error: 'OpB', scroll: true
            });
            await delayPromise(1000);
            const $all = await waitForElement('li.openbets-tab-all',
                333, 10000, true);
            await mouseChain({target: $all[0], events: fullClick, error: '$all B'});
            await delayPromise(1000);
            const $md = await waitForElement('div.columnMoreDetails:first',
                333, 10000, true);
            await mouseChain({target: $md[0], events: fullClick, error: '$md B'});
            await delayPromise(1000);
            const $itd = await waitForElement('#OpenBetItemDetails:first:visible',
                333, 10000, true);
            res = {
                external_id: $itd.find('p.OpenBetItemCouponId').trt()
                    .replace(/[^\d]/g, ''),
                coef: $itd.find('span.odds').trt(),
                stake: $itd.find('span.OpenBetItemStakeValue').trt()
                    .replace(/[^\d.]/g, ''),
                max: currentBetData.max,
            };
            await mouseChain({
                target: $('#betslip_tab_menu')[0],
                events: fullClick, error: 'betslip_tab_menu'
            });
        }
        return {success: true, message: res,};
    };

    const collectBetResultsCW = async (inD, balance) => {
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        dLog('green', bkHere,
            [`collectBetResultsCW, limit: ${limit}, balance: ${balance}, data: `, data]);
        if (window.self === window.top && document.location.href.indexOf('section=bethistory') === -1) {
            const $sports = await waitForElement('a[title="Sports"]', 333, 10000);
            if (!$sports.parent().hasClass('selected')) {
                await delayPromise(1000);
                await mouseChain({target: $sports[0], events: fullClick, error: '$sports'});
                await delayPromise(3000);
            }
            await bMess('CWSportCommand').set({action: 'BET_RESULT', data, balance});
            dLog('red', 'CW', `Awaiting for result`);
            return await bMess('CWSportResult')
                .get(110000, 10000, 300, true);
        } else if (window.self !== window.top && document.location.href.indexOf('section=bethistory') === -1) {
            const $bh = await waitForElement('#bet-history', 333, 10000);
            await mouseChain({target: $bh[0], events: fullClick, error: '$bh'});
            await delayPromise(3000);
        }
        const $cs = await waitForElement('#selBetHistoryStatus', 333, 10000);
        await delayPromise(1000);
        if ($cs.val() !== '0') {
            await selectLikePuppeteer($cs[0], ['0']);
            await delayPromise(1000);
            await mouseChain({target: $('div.search:visible')[0], events: fullClick, error: 'SCH'});
            await delayPromise(3000);
        }
        const collected = [];
        const $rows = await waitForElement('#divBetHistoryList div[class*="row"]:visible',
            333, 15000).catch(() => $([]));
        await delayPromise(1000);
        await $rows.eachAsync(async function () {
            const $this = $(this);
            const external_id = $this
                .find('div[style="float:left;width:80px;text-align:center;font-weight:bold;"]')
                .trt();
            const stake = $this.find('div[style="float:left;width:80px;text-align:center;"]').trt();
            if (data.length === 0 || data.indexOf(external_id) > -1) {
                await mouseChain({target: $this[0], events: fullClick, error: 'CL1', scroll: true});
                await delayPromise(1000);
                await waitForCondition(() => $this.next()
                    .find('div[style="float:left;width:280px;"]').trt() !== '', 333, 10000);
                const stat = $this
                    .find('div[style="float:left;width:80px;text-align:right;"]')
                    .trt();
                const match = $this.next().find('div[style="float:left;width:280px;"]').trt();
                const bkPivot = $this.next().find('div[style="font-style:italic"]').trt();
                const coef = $this.next()
                    .find('div[style="float: left; width: 80px; text-align: center;"]:visible')
                    .trt();
                collected.push({
                    external_id,
                    stake,
                    coef,
                    status: stat === 'Open' ? 'ACCEPTED' : stat === 'Lost' ? 'LOSE' : stat === 'Won' ? 'WON' : 'REFUNDED',
                    match,
                    bkPivot,
                    result: stat === 'Won' ? parseFloat(stake) * parseFloat(coef) : '',
                });
                await delayPromise(1000);
                await mouseChain({target: $this[0], events: fullClick, error: 'CL2'});
            }
        });
        dLog('green', bkHere, ['Collected', collected]);
        return {success: true, message: collected};
    };

    const collectBetResults = async (inD, command, balance, inplay) => {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inplay ? 1 : inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        if (bkHere === 'casinowinner') {
            return await collectBetResultsCW(inD, balance);
        }
        dLog('green', 'Betsson',
            [`collectBetResults, limit: ${limit}, inplay: ${inplay}, data: `, data]);
        if (document.location.href.indexOf('sportsbook/bet-history') === -1) {
            await checkInplay();
            const $bh = await waitForElement('a.obg-m-betslip-bet-history-btn', 333, 15000);
            await mouseChain({target: $bh[0], events: fullClick, error: '$bh'});
            await delayPromise(1000);
        }
        const $all = await waitForElement('obg-tab-label:textEquals("All")', 333, 15000);
        if (!$all.hasClass('active')) {
            await mouseChain({target: $all[0], events: fullClick, error: '$all'});
            await delayPromise(3000);
        }
        const $myBets = () => $('span.obg-bet-history-row-event');
        await waitForCondition(() => $myBets().length > 0,
            333, 15000, 'No Bets!');
        let checked = 0;
        for (const bet of $myBets()) {
            checked++;
            if (checked > limit) {
                break;
            }
            const $bet = $(bet);
            const external_id = $bet.attr('test-id');
            if (data.length === 0 || data.indexOf(external_id) > -1) {
                await mouseChain({target: $bet[0], events: fullClick, error: '$bet'});
                const statusSel = 'span.obg-m-coupon-selection-bet-status';
                await waitForCondition(() =>
                    $('div.obg-coupon-summary-header').trt().indexOf(external_id) > -1
                    && $(statusSel).trt() !== '',
                    333, 15000, 'Bet not opened!');
                await delayPromise(1500);
                const status = $(statusSel).trt();
                const $teams = $('div.obg-m-coupon-selection-participant');
                collected.push({
                    external_id,
                    status: status === 'Open' ? 'ACCEPTED' : status === 'Lost' ? 'LOSE'
                        : status === 'Won' ? 'WON' : 'REFUNDED',
                    match: `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}`,
                    bkPivot: $('div.obg-m-coupon-selection-market-selection-data').trt(),
                    coef: $('span.obg-coupon-summary-value-odds').trt(),
                    stake: $('div[test-id="total-stake"] span:last').text()
                        .replace(/[^\d.]/g, '').trim(),
                    result: ['Open', 'Lost'].indexOf(status) > -1 ? ''
                        : $('span.obg-coupon-summary-value-payout').text()
                            .replace(/[^\d.]/g, '').trim(),
                });
            }
        }
        dLog('green', 'Betsson', ['Collected', collected]);
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
            dLog('green', 'Betsson', [command, data]);
            const res = await this.cLinks[command](data, balance)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'Betsson', `${command} sports result: ${res.message}`);
            await bMess('DafabetCashierResult').set(res);
            return res;
        }
    };

    const cashierProcessor = command => {
        dLog('green', 'Betsson', `CashierProcessor: ${command.action}`);
        if (cashierCommands.exists(command.action)) {
            // Hint: execute command
            ourCommand.set(command);
            cashierCommands.execute(command.action, command.data, command.balance)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'Betsson', ['Unknown Cashier command:', command]);
        }
    };

    const cwProcessor = command => {
        dLog('green', 'Betsson', [`cwProcessor: ${command.action}`, command]);
        if (commands.exists(command.action)) {
            // Hint: execute command
            ourCommand.set(command);
            commands.execute(command.action, command.data, command.balance)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'Betsson', ['Unknown CW command:', command]);
        }
    };

    const commands = new class commands {
        constructor() {
            this.cLinks = {
                'BET': proceedBet,
                'EXPRESS_BET': proceedBet,
                'BET_RESULT': collectBetResults,
                'DEPOSIT': deposit,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data, balance) {
            currentBetData.init(data);
            //dLog('green', 'Betsson', [`commands execute ${command}`, data, formatStack((new Error()).stack)]);
            const res = await this.cLinks[command](data, command, balance || getBalance()).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', bkHere, `${command} result: ${res.message}`);
            if (window.self !== window.top && bkHere === 'casinowinner') {
                await bMess('CWSportResult').set(res);
            } else {
                port.postMessage(this.prepareResult(command, res));
            }
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

    const messageProcessor = message => {
        dLog('green', 'Betsson', [`messageProcessor, busy: ${busy}, top: ${(window.self === window.top)}`,
            message]);
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
            commands.execute(message.action, message.data, message.balance)
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

    if (window.self === window.top && document.location.href.indexOf('cashier') === -1
        && document.location.href.indexOf('payment') === -1) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message);
        });
    }

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess(document.location.href.indexOf('payment') > -1 ? 'BetssonCashier' : 'Betsson')
                .set(ourCommand.get(), increaseDelay ? 150000 : 0)
                .then(() => dLog('green', 'Betsson',
                    ['Command was set till unload:', ourCommand.get()]));
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
            bMess('Betsson').check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'Betsson',
                        [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                            currentCommand]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'Betsson', 'No command!'));
        } else if (document.location.href.indexOf('payment') > -1) {
            bMess('BetssonCashier').check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'CASHIER',
                        [`CASHIER at ${(window.self === window.top)}/${document.location.href} with:`,
                            currentCommand]);
                    cashierProcessor(currentCommand);
                })
                .catch(() => dLog('red', 'CASHIER', 'No command!'));
        } else if (document.location.href.indexOf('bpsgameserver.com/?token=') > -1
            || document.location.href.indexOf('bpsgameserver.com/LiveClient2/?token=') > -1) {
            // Hint: sports frame (here the most of work)
            (async () => {
                while (!stopSports) {
                    const csc = await bMess('CWSportCommand').check(30000, true)
                        .catch(() => null);
                    if (csc !== null) {
                        dLog('red', 'CW', ['CWSportCommand:', csc])
                        cwProcessor(csc);
                    }
                    await delayPromise(500);
                }
            })();
            dLog('green', 'BB', `CasinoWinner processor initialized! ${document.location.href}`);
        }
    }

})();