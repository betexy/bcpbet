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
    const port = isMain ? chrome.runtime.connect({name: "port_ladbrokes"}) : {postMessage: (...args) => console.log(args)};
    let settings = {
        authCheckInterval: 2000,
        url: 'https://sports.ladbrokes.com/in-play/football',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        maxWaitForScore: 60000
    };

    const loginSelector = 'a.menu-item-link:textEquals("LOG IN")';

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
        'CYBERSPORT': 'ESports',
    };

    const deposit = async data => {
        const res = await depositWork(data).catch(e => ({success: false, message: e}));
        ['increaseDelay', 'cashierOpened', 'depositOpened', 'paysystemOpened'].forEach(c => ourCommand.add(c, false));
        bsDebug(port, 'Report! ' + res.success + ' / ' + res.message);
        if (isMain) {
            port.postMessage({
                answered: "DEPOSIT",
                status: res.success ? 'SUCCESS' : ['NO_FUNDS', 'RESTRICTED'].find(t => res.message.indexOf(t) > -1) || 'FAILED',
                answer: res.message
            });
        }
        if (!res.success) {
            throw res.message;
        }
    };

    const depositWork = async data => {
        const dRep = async (success, message) => await bMess('DEPOSIT_RESULT', true).set({
            success: success,
            message: message
        });
        if (isMain && !ourCommand.getAdded('cashierOpened')) {
            bsLogger('blue', 'LB', `depositWork 1 ${document.location.href}`);
            const $db = await waitForElement('a[data-crlat="quickDepositButton"]', 300, 10000);
            ['cashierOpened'].forEach(c => ourCommand.add(c, true));
            await ourCommand.save('LADBROKES', 30000);
            await delayPromise(1000);
            await mouseChain({target: $db[0], events: fullClick, error: 'DB', scroll: true});
            const depositResult = await bMess('DEPOSIT_RESULT', true).get(200000)
                .catch(e => ({success: false, message: e}));
            bsLogger('green', 'LB', ['depositWork 1 depositResult', depositResult]);
            for (const c of ['DEPOSIT_RESULT', 'SKRILL_COMMAND', 'NETELLER_COMMAND']) {
                await bMess('DEPOSIT_RESULT', true).remove();
            }
            depositResult.message = depositResult.message || 'No message :(';
            return depositResult;
        } else if (!isMain && !ourCommand.getAdded('depositOpened')) {
            bsLogger('blue', 'LB', `depositWork 2 ${document.location.href}`);
            const $dep = await waitForElement('li[data-url="/deposit"]:visible', 300, 30000);
            ourCommand.add('depositOpened', true);
            await ourCommand.save('LADBROKES', 30000);
            await delayPromise(1000);
            await mouseChain({target: $dep[0], events: fullClick, error: 'dep', scroll: true});
            return await depositWork(data);
        } else if (!isMain && ourCommand.getAdded('depositOpened')) {
            bsLogger('blue', 'LB', `depositWork 3 ${document.location.href}`);
            const $acc = await waitForElement('#neteller-stored-account-id', 300, 30000);
            const accHere = $acc.find('option:selected').trt();
            if (accHere !== data.login) {
                await dRep(false, `Wrong account selected: '${accHere}' instead of '${data.login}'`);
            }
        }
    };

    /**
     * Balance
     * @param returnNull - if true - return null when balance does not exists
     * @return {number}
     */
    function getBalance(returnNull) {
        const $b = $('div.user-balance');
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.text().replace(/[^\d.]/g, '').trim());
    }

    const goLive = async () => {
        const $live = await waitForElement('a[title="In-Play"]', 333, 10000);
        await mouseChain({target: $live[0], events: fullClick, error: 'goLive'});
    };

    const authCheck = () => {
        //dLog('', 'LB', 'authCheck!');
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
                'div.cookie-content a[data-crlat="acceptAndClose"]': 'div.cookie-content a[data-crlat="acceptAndClose"]',
                'div.cookie-consent-message a.btn': 'div.cookie-consent-message a.btn',
                'button.btn-style2[data-crlat="button.Ok"]': 'button.btn-style2[data-crlat="button.Ok"]',
                'label[for="NoLimit"]': 'label[for="NoLimit"]',
                'label[for="fundprotection"]': 'label[for="fundprotection"]',
                'div.deposit-limits': 'button:contains("Submit")',
                '#onetrust-accept-btn-handler': '#onetrust-accept-btn-handler',
            });
            const videoSel = 'div.watch-live-widget';
            if ($(videoSel).length > 0) {
                $(videoSel).remove();
            }
            if ($('button.price-odds-button').trt().indexOf('/') > -1) {
                await waitDelayClick('div.avatar-icon', 1000);
                await waitDelayClick('span.list-nav-txt:textEquals("Settings"):visible', 1000);
                await waitDelayClick('span.list-nav-txt:textEquals("Betting Settings"):visible', 1000);
                await waitDelayClick('a.switch-btn:textEquals("Decimal"):visible', 1000);
                await delayPromise(1000);
                await goLive();
            }
            if ($('div.modal-content div.boost-title').length > 0) {
                await mouseChain({
                    target: $(`span:textEquals("Don't show this again")`).prev()[0],
                    events: fullClick,
                    error: 'dshta'
                });
                await delayPromise(1000);
                await mouseChain({target: $('a.thanks')[0], events: fullClick, error: 'thanks'});
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
            .catch(e => dLog('red', 'LB', `authCheck: ${e}`))
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
            remember: '#rememberMe',
            submit: 'button.login',
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
        if (!$(controls.remember).prop('checked')) {
            await delayPromise(1000);
            await mouseChain({target: $(controls.remember)[0], events: fullClick, error: 'l3'});
        }
        await delayPromise(1000);
        await mouseChain({target: $(controls.submit)[0], events: fullClick, error: 'l4'});
        authClicked++;
        authClickedTime = Date.now();
        bsDebug(port, `Auth clicked ${authClicked}!`);
        const $error = await waitForElement('div.theme-error-i div.cms-container', 300, 5000).catch(() => $([]));
        if ($error.length > 0) {
            enterError = true;
            throw $error.trt();
        }
    };

    const closePreviousCoupons = async skip => {
        if (skip) {
            return 'skipped!';
        }
        const closes = 'div.bs-stake-delete-button';
        while ($(closes).length > 0) {
            await mouseChain({target: $(closes).eq(0)[0], events: ['click'], scroll: true, error: 'c1'});
            await delayPromise(500);
        }
        return 'All were closed!';
    };

    const openEvent = async data => {
        dLog('red', 'LB', ['openEvent', data]);
        const eventName = `${data.team1} — ${data.team2}`.toLowerCase();
        const word = data.league.substr(0,
            data.league.indexOf('.') === -1 ? data.league.indexOf(' ') : data.league.indexOf('.')).trim();
        const checkWeAreThere = function () {
            const teams = $('h1[data-crlat="topBarTitle"]').trt().split(' v ');
            console.log('teams ', teams);
            if (teams.length === 2) {
                const checkEvent = `${teams[0].trim()} — ${teams[1].trim()}`.toLowerCase();
                return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70;
            } else {
                return false;
            }
        };
        const switchToSport = async sport => {
            dLog('red', 'LB', `switchToSport: ${sport}`);
            const s = accordance[sport];
            const sportSel = `li[data-crlat="carouselMenu.item"] a[title="${s}"]`;
            const $sport = await waitForElement(sportSel, 333, 15000);
            if (!$sport.hasClass('active')) {
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
                const $scores = $('#homeScore, #awayScore');
                return $scores.eq(0).trt() + ':' + $scores.eq(1).trt();
            };
            await waitForCondition(() => getScore() !== '',
                700, 10000, 'No score');
            dLog('orange', 'LB', `Check score: ${getScore()}`);
            if (getScore() !== data.score.replace(/[^\d:]/g, '').trim()) {
                //throw `SCORE_CHANGED => we need ${data.score}, we have ${getScore()}`;
                return true;
            }
        };
        if (checkWeAreThere() && await checkScore()) {
            return 'We probably on event page!'
        }
        if (document.location.href.indexOf('/in-play/') === -1) {
            await goLive();
            await delayPromise(3000);
        }
        await switchToSport(data.sport);
        await delayPromise(1000);
        let $el = $([]);
        const checked = [];
        const tryToFindEvent = $leagueWrapper => {
            let $el = null;
            $leagueWrapper.find('div.sport-card-names').each((idx, val) => {
                const $ts = $(val).find('a');
                const eventHere = $ts.length === 2 ? ($ts.eq(0).trt() + ' v ' + $ts.eq(1).trt()).toLowerCase() : '';
                console.log(`${eventHere} === ${eventName}`);
                if (eventHere === eventName || locutus_similar_text(eventHere, eventName, true) > 80) {
                    $el = $(val);
                    return false;
                }
            });
            return $el;
        };
        const tryToFindInLeagues = async selector => {
            dLog('blue', 'LB', `Working with selector ${selector}`);
            await $(selector).eachAsync(async (idx, val) => {
                const league = $(val).trt();
                if (checked.indexOf(league) > -1) {
                    dLog('blue', 'LB', `${league} checked already!`);
                    return true;
                }
                checked.push(league);
                dLog('blue', 'LB', `Checking ${league}`);
                const $leagueHeader = $(val);
                $leagueHeader[0].scrollIntoView();
                if (!$leagueHeader.closest('accordion').hasClass('is-expanded')) {
                    await mouseChain({target: $leagueHeader[0], events: fullClick});
                    await delayPromise(1000);
                }
                $el = tryToFindEvent($leagueHeader.closest('accordion'));
                if ($el) {
                    return false;
                }
            });
        };
        const leaguesSelectors = [
            `div[data-crlat="tabContent"] span.header-title:textStartsI("${word}")`,
            'div[data-crlat="tabContent"] span.header-title',
        ];
        for (const currentLS of leaguesSelectors) {
            await tryToFindInLeagues(currentLS);
            if ($el.length > 0) {
                break;
            }
        }
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
        data.team1 = '';
        data.team2 = '';
        const $teamsRoot = $(`accordion:visible span.header-title:textEqualsIS("Match Betting")`).closest('accordion');
        if ($teamsRoot.length > 0) {
            data.team1 = $teamsRoot.find('strong.col-name:first').trt();
            data.team2 = $teamsRoot.find('strong.col-name:last').trt();
        }
        if (data.team1 === '' || data.team2 === '') {
            const $teams = $('span.team-label');
            if ($teams.length === 2) {
                data.team1 = $teams.eq(0).trt();
                data.team2 = $teams.eq(1).trt();
            } else {
                const teams = $('breadcrumbs li:last').trt().split(' v ');
                if (teams.length !== 2) {
                    throw 'No teams!';
                }
                data.team1 = teams[0];
                data.team2 = teams[1];
            }
        }

        const markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Match Betting',],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    roots: ['Match Betting',],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    roots: ['Match Betting',],
                    pivotKeys: ['Draw',],
                },
                'ONE_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or Draw',],
                },
                'TWO_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM2# or Draw',],
                },
                'ONE_TWO': {
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or #TEAM2#',],
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['Over/Under Total Goals',],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    roots: ['Over/Under Total Goals',],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['Over/Under Goals #TEAM1#',],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    roots: ['Over/Under Goals #TEAM1#',],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['Over/Under Goals #TEAM2#',],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    roots: ['Over/Under Goals #TEAM2#',],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    roots: ['Over/Under Total Corners #PIVOT#',],
                    pivotKeys: ['Over #PIVOT#'],
                },
                'UNDER': {
                    roots: ['Over/Under Total Corners #PIVOT#',],
                    pivotKeys: ['Under #PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    roots: ['Draw No Bet'],
                    pivotKeys: ['#TEAM1#'],
                },
                'AWAY': {
                    roots: ['Draw No Bet'],
                    pivotKeys: ['#TEAM2#'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    roots: ['Handicap Results'],
                    pivotKeys: ['#HPIVOT# Goals'],
                    specials: ['#TEAM1#'],
                },
                'H2': {
                    roots: ['Handicap Results'],
                    pivotKeys: ['#HPIVOT# Goals'],
                    specials: ['#TEAM2#'],
                },
                'HX': {
                    roots: ['Handicap Results'],
                    pivotKeys: ['#HPIVOT# Goals'],
                    specials: ['Handicap Draw'],
                }
            },
        };

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw `Unsupported ${data.time_value} / ${data.market} / ${data.target}`;
        }

        const m = markets[data.market][data.target];

        if (data.market === 'HDP' && parseFloat(data.pivot) !== 0) {
            throw `Ladbrokes supports only HDP 0 and EURO_HDP!`;
        }
        if (data.time_value.indexOf('FULL') === -1) {
            if (data.market === 'ONE_TWO' && ['ONE', 'TWO', 'DRAW'].indexOf(data.target) > -1) {
                m.roots = ['1st Half / 2nd Half Result'];
            }
        }

        dLog('green', 'Ladbrokes', ['Final market is:', m]);

        const ePivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };

        const hPivot = pvt => parseInt(pvt) > 0 ? `+${pvt}` : pvt

        replaceInner(m, {
            '#TEAM1#': data.team1,
            '#TEAM2#': data.team2,
            '#PIVOT#': data.pivot,
            '#EPIVOT#': ePivot(data.pivot),
            '#HPIVOT#': hPivot(data.pivot),
        });

        const $all = await waitForElement('a.switch-btn:contains("All Markets")', 333, 15000);
        if (!$all.hasClass('active')) {
            await mouseChain({target: $all[0], events: fullClick, error: '$all'});
            await delayPromise(1000);
        }

        /**
         *
         * @param $root
         * @param type
         * @returns {jQuery<HTMLElement>}
         */
        const $findPivot = ($root, type) => {
            for (const pvt of m.pivotKeys) {
                if (!type || type === 1) {
                    const $pivot = $root
                        .find(`div[data-crlat="oddsCard"]`
                            + ` span[data-crlat="outcomeEntity.name"]:textEqualsIS("${pvt}"):visible`).closest('div');
                    if ($pivot.length === 1) {
                        return $pivot.find('button.btn-bet');
                    } else if ($pivot.length > 1) {
                        throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                    }
                } else if (type === 2) {
                    let pType = 0;
                    let $pivot = $root.find(`strong.odds-name:textEqualsIS("${pvt}"):visible`);
                    if ($pivot.length === 0) {
                        $pivot = $root.find(`strong.col-name:textEqualsIS("${pvt}"):visible`);
                        pType = 1;
                    }
                    if ($pivot.length === 1) {
                        if (pType === 1) {
                            return $pivot.parent().find('button.btn-bet');
                        } else {
                            return $pivot.closest('div.odds-card').find('button.btn-bet')
                                .eq(data.market.indexOf('TOTAL') > -1 && data.target === 'UNDER' ? 1 : 0);
                        }
                    } else if ($pivot.length > 1) {
                        throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                    }
                }
            }
            return $([]);
        };

        const switchPeriod = async $root => {
            const t = data.time_value.indexOf('FULL') === -1 ? '1st Half' : '90 mins';
            const $mt = $root.find(`a.switch-btn:contains("${t}")`);
            if ($mt.length === 0 && data.time_value.indexOf('FULL') === -1) {
                throw `No tab for ${data.time_value}/${t}`;
            }
            if ($mt.length > 0 && !$mt.hasClass('active')) {
                await mouseChain({target: $mt[0], events: fullClick, scroll: true, error: '$mt'});
                window.scrollBy(0, -50);
                await delayPromise(1000);
            }
        };

        let $found = $([]);
        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () => $(`accordion:visible span.header-title:textEqualsIS("${root}")`).closest('accordion');
            if ($root().length === 0) {
                continue;
            }
            if (!$root().hasClass('is-expanded')) {
                await mouseChain({
                    target: $root().find('header')[0], events: fullClick, error: 'h3', scroll: true
                });
                await delayPromise(1000);
            }
            if ($root().find('a.switch-btn').length > 0) {
                // Hint: market has tabs
                await switchPeriod($root());
                $found = $findPivot($root(), 2);
                if ($found.length === 0
                    && $root().find('button[data-crlat="showAllButton"]').length > 0) {
                    await mouseChain({
                        target: $root().find('button[data-crlat="showAllButton"]')[0],
                        events: fullClick,
                        error: 'Show all'
                    });
                    await delayPromise(500);
                    $found = $findPivot($root(), 2);
                }
            } else {
                $found = $findPivot($root());
            }
            if ($found.length > 0) {
                break;
            }
        }
        if ($found.length === 0) {
            throw `${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot}`
            + ' not found :(';
        } else {
            $found.closest('accordion')[0].scrollIntoView();
            window.scrollBy(0, -50);
        }
        return $found;
        //#-#-FINISH
    };

    const switchToDecimal = async () => {
        await mouseChain({target: $('div.avatar-content')[0], events: fullClick, error: 'ava'});
        const $settings = await waitForElement('a.menu-item-link:textEquals("Settings")',
            333, 10000);
        await delayPromise(5000);
        await mouseChain({target: $settings[0], events: fullClick, error: 'settings'});
        const $bettings = await waitForElement('a.nav-link:textEquals("Betting Settings")',
            333, 10000);
        await delayPromise(5000);
        await mouseChain({target: $bettings[0], events: fullClick, error: 'bettings'});
        const $decimal = await waitForElement('a[data-crlat="buttonSwitch"]:textEquals("Decimal")',
            333, 10000);
        await delayPromise(5000);
        await mouseChain({target: $decimal[0], events: fullClick, error: 'decimal'});
        await delayPromise(5000);
        await mouseChain({
            target: $('a[data-crlat="btnBack"]')[0], events: fullClick, error: 'btnBack'
        });
    };

    const openCoupon = async paramData => {
        dLog('green', 'LB', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'LB', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'LB', 'Event must be opened!');
            const $element = await getBetElement(data);
            console.log($element);
            let coefWeWaitFor = $element.find('span.odds-price').trt();
            dLog('green', 'LB', 'We got element! Coef: ' + coefWeWaitFor);
            const waitForCouponVisibleStarted = Date.now();
            let elementWasClicked = 0;
            let performElementClick = async function () {
                dLog('green', 'LB', 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                    + ') /' + (Date.now() - elementWasClicked));
                await mouseChain({target: $element[0], events: fullClick, error: 'performElementClick'})
                elementWasClicked = Date.now();
            };
            const checkCoupon = () => {
                let event = (data.team1 + ' - ' + data.team2).toLowerCase();
                let result = false;
                $('div.bs-stake-event-name').each(function () {
                    let ev = $(this).text().replace(/\*/g, '').trim().toLowerCase();
                    if (event === ev || locutus_similar_text(event, ev, true) > 60) {
                        result = true;
                        return false;
                    } else {
                        dLog('red', 'LB', `'${ev}' !== '${event}'`);
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
                dLog('red', 'LB', `Express here! ${i}/${(paramData.length - 1)}`);
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
        const $coupons = $('div.single-stake');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $this.find('div.bs-stake-event-name').text()
                .replace(/\*/g, '').trim();
            console.log(match);
            if ($this.hasClass('suspended')) {
                errors.push(match + ' LOW_COEF, market unavailable!');
                checked++;
                return true;
            }
            let localCoef = decOdds($this.find('strong.stake-odd-number').trt());
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
                const alertText = $('div.bs-notification-message:visible').trt();
                const acceptedText = $('span.receipt-header').trt();
                if (alertText.indexOf('Price Change') > -1) {
                    return false;
                } else if (alertText.indexOf('Maximum stake is') > -1
                    && alertText.indexOf('0.00') > -1) {
                    throw `LIMITED: ${alertText}`;
                } else if (alertText !== '') {
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
            dLog('green', 'LB', `Will place (performBet): ${willPlace}`);
            /**
             * @returns {JQuery<HTMLElement>}
             */
            const $input = () => $(`input[name="${(data.length > 1 ? 'amountMultiple' : 'amount')}"]`);
            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input().length}`;
            }
            await clearAndInputNumber($input()[0], willPlace.toString()
                .replace('.00', '').trim());
            await delayPromise(800);
            dLog('green', 'LB', `STAKE entered ${willPlace}`);
            let entered = parseFloat($input().val());
            dLog('green', 'LB',
                `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'LB', 'Entered !== willPlace - try to reenter!');
                continue;
            }
            await delayPromise(300);
            const $placeBtn = $('button[data-uat="betNowBtn"]');
            if ($placeBtn.length === 0 || $placeBtn.attr('disabled')) {
                throw 'No place button or button disabled!';
            } else if ($placeBtn.text().indexOf('ACCEPT') > -1) {
                await checkCoefs(data);
            }
            await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
        } while (!await checkSuccess());
        // Hint: collect result
        return {
            success: true,
            message: {
                external_id: $('span.bet-id').text().replace('Receipt No:', '').trim(),
                coef: decOdds($('strong.bs-receipt-odds').text()
                    .replace('@', '').trim()).toString(),
                stake: $('span[data-crlat="totalStake"]').text().replace(/[^\d.]/g, '').trim(),
                max: currentBetData.max,
            },
        };
    };

    const collectBetResults = async (inD, command) => {
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        dLog('', 'LAD', [`collectBetResults, limit: ${limit}, data:`, data]);
        const collected = [];
        await mouseChain({target: $('div.avatar-content')[0], events: fullClick, error: 'ava'});
        await delayPromise(3000);
        const $myBets = await waitForElement('a.menu-item-link:textEquals("My Bets")',
            333, 10000);
        await delayPromise(3000);
        await mouseChain({target: $myBets[0], events: fullClick, error: 'myBets'});
        for (const text of ['open-bets', 'bet-history']) {
            const $current = await waitForElement(`a[href="/${text}"]`, 333, 15000);
            await delayPromise(500);
            if (!$current.parent().hasClass('active')) {
                await mouseChain({target: $current[0], events: fullClick, error: `Click ${text}`});
                await delayPromise(1000);
            }
            const betsSel = 'div.bet-item';
            await waitForCondition(() => !!findSel(['div.no-bets-msg', betsSel]),
                333, 15000, `where are we? ${document.location.href}`);
            await $(betsSel).eachAsync(async function () {
                const $this = $(this);
                if (text !== 'open-bets') {
                    await waitForCondition(() => $this.find('span[data-crlat="cashout.totalStatus"]').length > 0,
                        222, 5555, 'failed status el');
                }
                const status = text === 'open-bets' ? 'ACCEPTED'
                    : $this.find('span[data-crlat="cashout.totalStatus"]').trt() === 'won' ? 'WON'
                        : 'LOSE';
                await waitForCondition(() => $this.find('span[data-crlat="oddsValue"]').length > 0,
                    222, 5555, 'failed coef el');
                const bet = {
                    external_id: $this.find('span[data-uat="betId"]').trt(),
                    status: status,
                    coef: $this.find('span[data-crlat="oddsValue"]').trt(),
                    stake: $this.find('span[data-uat="totalStake"]').text()
                        .replace(/[^\d.]/g, '').trim(),
                    result: status !== 'ACCEPTED' ? $this.find('span[data-uat="totalEstReturns"]')
                        .text().replace(/[^\d.]/g, '').trim() : '',
                };
                if (data.length === 0 || data.indexOf(bet.external_id) > -1) {
                    collected.push(bet);
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
                'DEPOSIT': deposit,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data) {
            currentBetData.init(data);
            //dLog('green', 'LB', [`commands execute ${command}`, data, formatStack((new Error()).stack)]);
            const res = await this.cLinks[command](data, command).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'LB', `${command} result: ${res.message}`);
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
                .catch(e => dLog('red', 'LB', `Error till execute: ${e}`))
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
            const command = await bMess('LADBROKES').check(40000);
            await waitForCondition(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck), 333, 60000, 'No auth check!');
            bsLogger('green', 'LB', [`Restoring with (${isMain}): `, command]);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));
        port.postMessage({m: "PAGE LOADED!"});
        console.log('%c' + `ladbrokes loaded and message sent! (${isMain}) ${document.location.href}`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", async () => {
        await ourCommand.save('LADBROKES', increaseDelay ? 150000 : 0);
        bsLogger('green', 'LB', [`Command was set till unload (${isMain}):`, ourCommand.get()]);
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

})();
