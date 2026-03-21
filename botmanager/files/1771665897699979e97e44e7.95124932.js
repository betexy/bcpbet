const t1s2t3 = (function () {

    if (window.self !== window.top) {
        return;
    }

    "use strict";

    let
        busy = false,
        increaseDelay = false,
        authClicked = 0,
        authCheckStarted = 0,
        lastAuthCheck = 0,
        fillUpStarted = false,
        limited = false,
        globalStatus = '',
        possibleMaximums = 25,
        loaded = Date.now(),
        waitSource = false,
        sourceExpress = false;

    const port = chrome.runtime.connect({name: 'port_vave'});

    const settings = {
        restartEvery: 1800000,
        authCheckInterval: 2000,
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        url: '',
        login: '',
        password: '',
        phone: '',
        email: '',
        uid: '',
        fork: {
            shoulder: 0,
            maxWait: 0,
            maxLosePercent: 0,
            minWinPercent: 0,
        },
        forkOnly: false,
        stake_fork: {},
        eventTimeLimit: 2400000,
        eventMaxBets: 3,
        betweenBets: 25000,
        hostname: document.location.hostname,
        newExpresses: false,
        source: {
            X: 489,
            Y: 490,
            Z: 491,
        },
        sourceRandom: 0,
        sourceDate: 0,
    };

    const ourCommand = new ourCommandProto();
    const currentBetData = new class CurrentBetData {
        constructor() {
            this.init([]);
        }

        init(data) {
            this.data = JSON.parse(JSON.stringify(data));
            this.max = 0;
            this.external_id = '';
            this.willPlace = 0;
        }
    };
    const $coupons = () => $('div[data-test="couponBetEvent"]').parent();
    const getSourceRandom = () => Math.floor(Math.random() * 30) + 1;
    const getCurrentSource = src => {
        sourceExpress = false;

        if (src >= 1 && src <= 13) {
            return 'X';
        }
        if (src >= 14 && src <= 19) {
            return 'Y';
        }
        if (src >= 20 && src <= 21) {
            return 'Z';
        }

        return 'skip';
    };

    const authCheck = () => {
        lastAuthCheck = Date.now();

        if (!busy && Date.now() - loaded > settings.restartEvery) {
            dLog('bigred', 'vave', 'RELOAD 1');
            window.location.reload();
        }

        (async () => {
            await closeAllWeNeed({
                'button[data-test="acceptCookieButton"]': 'button[data-test="acceptCookieButton"]',
                'button[class^="promo-snackbar-module_close"]': 'button[class^="promo-snackbar-module_close"]',
                'div[class^="coupon-footer-remove-stopped-events-module_Wrapper_"]':
                    'button[data-test="betslip-remove-stopped-events"]',
                '#onesignal-slidedown-cancel-button': '#onesignal-slidedown-cancel-button'
            });
            const $loginLink = () => $('button[data-test="login"]');
            if ($loginLink().length > 0) {
                // Hint: Log In
                authorized = false;
                port.postMessage({m: "tech works! 2"});
                await tryToLogIn();
            }  else {
                authorized = true;
                if (document.title.indexOf('Maintenance') > -1
                    || $('body').trt().indexOf('404 page not found') > -1) {
                    document.location.reload();
                }

                if (settings.lastScoreBasketball === '999') {
                    if (Date.now() - settings.sourceDate >= 300000) {
                        settings.sourceDate = Date.now();
                        settings.sourceRandom = getSourceRandom();
                        if (settings.sourceRandom >= 33 && settings.sourceRandom <= 33) {
                            settings.newExpresses = true;
                            if (settings.sourceRandom >= 33 && settings.sourceRandom <= 33) {
                                settings.newExpressBetsAmount = 1;
                            }
                        } else {
                            waitSource = false;
                            settings.newExpresses = false;
                        }
                        dLog('blue', 'vave', `Source current random value - ${settings.sourceRandom}`);
                    }
                }

                if (settings.newExpresses && !busy) {
                    busy = true;
                    const WasSuccessExpressNew = await bMess('WasSuccessExpressNew').infinite().catch(() => 0);
                    const couponsExist = await waitForCondition(() => $coupons().length > 0,
                        222, 1777).catch(() => $([]));

                    if (WasSuccessExpressNew && couponsExist.length === 0) {
                        await bMess('WasSuccessExpressNew').remove();
                    }

                    if (!WasSuccessExpressNew) {
                        dLog('green', 'vave', 'START find NewExpress event!');
                        // clear coupons
                        await closePrevious(false);

                        waitSource = false;
                        await ProccedExpressNew().catch((e) => {
                            dLog('red', 'vave', 'ProccedExpressNew Error - ' + e);
                            bMess('WasSuccessExpressNew').set(false);
                        });
                    }
                    busy = false;
                }

                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
            // dLog('', 'vave', `Auth check, authorized: ${$loginLink().length}`);
        })()
            .catch(e => dLog('red', 'vave', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck('repeat'));
    };

    const tryToLogIn = async () => {
        let errors = [], wait = 300000;
        if (Date.now() - authClicked < 60000) {
            errors.push('Too soon!');
            wait = 60000 - (Date.now() - authClicked);
        }
        if (errors.length > 0) {
            dLog('red', 'vave', `tryToLogIn: ${errors.join('; ')}, will wait: ${wait}`);
            await delayPromise(wait);
            return;
        }
        await mouseChain({
            target: $('button[data-test="login"]')[0], events: fullClick,
            error: 'Login link',
        });
        const els = {
            user: 'input[data-test="username"]',
            password: 'input[data-test="password"]',
            login: 'button[data-test="submitLogin"]',
        };
        await waitForCondition(() => checkSE(Object.values(els), true),
            333, 10000);
        await delayPromise(3000);
        if ($(els.user).val() !== settings.login) {
            await clearAndInputEmail($(els.user)[0], settings.login);
            await delayPromise(3000);
        }
        if ($(els.password).val() !== settings.password) {
            await clearAndSimulate($(els.password)[0], settings.password);
            await delayPromise(3000);
        }
        await mouseChain({target: $(els.login)[0], events: fullClick, error: 'login'});
        await delayPromise(333);

        authClicked = Date.now();
        dLog('', 'vave', 'Auth clicked!');

        // waitForError(true)
            // .then(e => dLog('green', 'vave', `waitForError 1 done: ${e}`));

        return "auth_clicked";
    };

    const getBalance = returnNull => {
        const $b = $('div[data-test="balanceAmount"]');
        if ($b.length > 0) {
            return parseFloat($b.trt());
        } else {
            return returnNull ? 'null' : 0;
        }
    }

    const checkBalance = willPlace => {
        const balance = getBalance();
        if (balance < willPlace) {
            throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
        } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
            throw 'Undefined or NaN will place';
        }
    };

    const collectBetResults = async (inD, command) => {
        const collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        let captured = 0;
        await mouseChain({
            target: $('div[data-test="personAccountButton"]').find('div')[0],
            events: fullClick, error: 'collectBetResults 1'
        });
        const $bh = await waitForElement('a[href="/cabinet/betting-history"]', 250, 10000);
        await delayPromise(500);
        await mouseChain({
            target: $bh[0],
            events: fullClick, error: 'collectBetResults 1a'
        });
        const $s = await waitForElement('div.cabinet-section div[data-test="selected-item-text"]', 
            300, 10000, 'We are not in history!');
        await delayPromise(500);
        if ($s.trt() !== 'All') {
            await mouseChain({
                target: $s.parent()[0],
                events: fullClick, error: 'collectBetResults 1b'
            });
            await delayFunction(100);
            const $all = await waitForElement('div[data-test="listItem"]:textEquals("All")', 300, 5000, 'No all');
            await mouseChain({
                target: $all[0],
                events: fullClick, error: 'collectBetResults $all'
            });
            await delayFunction(3000);
        }
        let gone = 0;
        const $bets = await waitForElement('div[class^="cabinet-bet-table-item_tableItem_"]', 300, 10000, 'No history')
            .catch(() => $([]));
        await delayPromise(1000);
        for (let i = 0; i < $bets.length; i++) {
            gone++;
            const 
                $cur = $bets.eq(i),
                external_id = $cur.find('div[class*="cabinet-bet-table-item_itemId"]').trt().replace(/\D/g, ''),
                $stakes = $cur.find('div[class^="cabinet-bet-table-stake_stake_"]'),
                statusDraft = $cur.find('div.status-badge').trt(),
                status = statusDraft === 'won' ? 'WON' : statusDraft === 'lost' ? 'LOSE' : 'ACCEPTED';
            if (!!external_id && (data.length === 0 || data.indexOf(external_id) > -1)) {
                collected.push({
                    external_id,
                    coef: decOdds($cur.find('div[class*="cabinet-bet-table-item_itemOdds"]').trt()),
                    stake: $stakes.eq(0).trt(),
                    status,
                    result: status === 'ACCEPTED' ? '0' : ($stakes.eq(1).trt() === '' ? '0' : $stakes.eq(1).trt()),
                });
            }
            if (gone > limit) {
                break;
            }
            // dLog('big-red', 'vave', [`i: ${i}, gone: ${gone}, external_id: ${external_id}, data.length: ${data.length}`]);
            await delayPromise(1000);
        } 
        dLog('green', 'vave', ['Collected', collected]);
        delayPromise(1000)
           .then(() => goToLive());
        return {success: true, message: collected};
    };

    const checkEvent = (event, eventHere) => {
        const res = eventHere === event ||
            locutus_similar_text(eventHere, event, true) > 70;
        if (!res) {
            dLog('', 'vave', `'${event}' !== '${eventHere}'`);
        }
        return res;
    };

    const getCurrentTeams = () => {
        const
            teams = ['', ''],
            $teams = $('div[data-test="teamName"]');
        if ($teams.length == 2) {
            teams[0] = $teams.eq(0).trt();
            teams[1] = $teams.eq(1).trt();
        }

        return teams;
    };

    const findBySearch = async (team1, type, event) => {
    let $evt = $([]);
    const searchInput = 'input[data-test="search-modal-input"]';

    // селекторы событий в модалке
    const liveEvents =
        'div[data-test="search-results"] div[data-test="eventTableRow"]:has(img[src*="icon-live.svg"])';
    const prematchEvents =
        'div[data-test="search-results"] div[data-test="eventTableRow"]:has(span[data-test="eventDate"])';

    const events = type === 'LIVE' ? liveEvents : prematchEvents;

    if ($(searchInput).length === 0) {
        await dClick($('input[data-test="sport-menu-search"]')[0], false, 'menu search');
        await waitForElement(searchInput, 333, 5555);
    }

    await clearAndSimulate($(searchInput)[0], team1);
    await delayPromise(333);

    // ждём появления хотя бы одной строки события
    await waitForElement(events, 222, 15555);
    await delayPromise(888);

    $(events).each(function () {
        const t1 = $(this).find('div[data-test="teamName"]').eq(0).trt();
        const t2 = $(this).find('div[data-test="teamName"]').eq(1).trt();
        const eventHere = `${t1} - ${t2}`.toLowerCase();

        if (checkEvent(event, eventHere)) {
            $evt = $(this);
            return false; // break
        }
    });

    if ($evt.length === 0) {
        return false;
    } else {
        // кликаем по строке (или по ссылке внутри)
        const $clickTarget = $evt.find('a[data-test="eventLink"]').first().length
            ? $evt.find('a[data-test="eventLink"]').first()
            : $evt;

        await dClick($clickTarget[0], true, 'findEvent');
        await delayPromise(555);

        // закрываем модалку, если она ещё открыта
        const $modal = $('div[data-test="modalNotificationPopup"]');
        if ($modal.length) {
            const $closeBtn = $modal.find('button[data-test="modalCloseButton"]').first();
            if ($closeBtn.length) {
                await mouseChain({ target: $closeBtn[0], events: fullClick, error: 'events modal' });
                await delayPromise(1111);
            }
        }

        await delayPromise(555);
    }

    return true;
};


    const openEvent = async bet => {
        if (!!bet.direct_link && bet.direct_link.indexOf(settings.hostname) === -1) {
            const url = new URL(bet.direct_link);
            url.hostname = settings.hostname;
            bet.direct_link = url.href;
        }
        if (!!bet.direct_link && document.location.href !== bet.direct_link) {
            document.location.href = bet.direct_link;
            await waitForCondition(() => document.location.href === bet.direct_link,
                250, 10000);
            await delayPromise(500);
        }

        let eventFound = false;
        const event = `${bet.team1} - ${bet.team2}`.toLowerCase();
        const checkWeAreHere = () => {
            const teams = getCurrentTeams();
            if (!!bet.direct_link && document.location.href === bet.direct_link) {
                bet.team1 = bet.team1 || teams[0];
                bet.team2 = bet.team2 || teams[1];
                return true;
            }
            const eventHere = teams.join(' - ').toLowerCase();
            return checkEvent(event, eventHere);
        };
        if (checkWeAreHere()) {
            return;
        }

          const cleanedTeam2 = bet.team2
            .replace(/[(){}\[\]]/g, "")                 // убираем любые скобки
            .replace(/\b\w{1,3}\b/g, "")                // убираем слова до 3 символов
            .replace(/\s+/g, " ")
            .trim();

          eventFound = await findBySearch(cleanedTeam2, bet.type, event);

        if (!eventFound) {
            throw `Event not found!`;
        }
        await waitForCondition(checkWeAreHere, 250, 15000);
    };

    const openCoupon = async data => {
        for (const bet of data) {
            if (!!bet.direct_link) {
                bet.direct_link.replace('.kim', '.ceo');
            }
            await openEvent(bet);
            const $el = await getBetElement(bet);
            dLog('green', 'vave',
                `We got bet: ${$el.find('div[data-test="fixture-odds"]').trt()}`);
            await mouseChain({target: $el[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(500);
        }
        const
            $single = $('button[data-test="betslip-singlebet-tab"]'),
            $multi = $('button[data-test="betslip-multibet-tab"]');
        if (data.length === 1 && $single.attr('data-active') != 'true') {
            await mouseChain({target: $single[0], events: fullClick, error: '$single'});
            await delayPromise(500);
        } else if (data.length > 1 && $multi.attr('data-active') != 'true') {
            await mouseChain({target: $multi[0], events: fullClick, error: '$multi'});
            await delayPromise(500);
        }
    };

    const getBetElement = async bet => {
        if (bet.time_value.indexOf('_GAME_') > -1) {
            const
                source = bet.time_value,
                digits = /(\d+)\D+(\d+)/.exec(source);
            if (digits && digits[1] && digits[2]) {
                bet.time_value = `SET_${digits[2]}_GAME_${digits[1]}`;
                dLog('orange', 'vave', `${source} => ${bet.time_value}`);
            }
        }
        let tries = 1;
        //#-#-START
        const teams = getCurrentTeams();
        bet.team1 = teams[0];
        bet.team2 = teams[1];
        
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    tab: ['Main'],
                    roots: ['1x2',],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    tab: ['Main'],
                    roots: ['1x2',],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    tab: ['Main'],
                    roots: ['1x2',],
                    pivotKeys: ['draw',],
                },
                'ONE_DRAW': {
                    tab: ['Main'],
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or draw',],
                },
                'TWO_DRAW': {
                    tab: ['Main'],
                    roots: ['Double Chance'],
                    pivotKeys: ['draw or #TEAM2#',],
                },
                'ONE_TWO': {
                    tab: ['Main'],
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or #TEAM2#',],
                }
            },
            'TOTAL': {
                'OVER': {
                    tab: ['Main', 'Asian Lines'],
                    roots: ['Total', 'Asian Total',],
                    pivotKeys: ['over #PIVOT#'],
                },
                'UNDER': {
                    tab: ['Main', 'Asian Lines'],
                    roots: ['Total', 'Asian Total',],
                    pivotKeys: ['under #PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tab: ['Goals'],
                    roots: ['#TEAM1# total',],
                    pivotKeys: ['over #PIVOT#'],
                },
                'UNDER': {
                    tab: ['Goals'],
                    roots: ['#TEAM1# total',],
                    pivotKeys: ['under #PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tab: ['Goals'],
                    roots: ['#TEAM2# total',],
                    pivotKeys: ['over #PIVOT#'],
                },
                'UNDER': {
                    tab: ['Goals'],
                    roots: ['#TEAM2# total',],
                    pivotKeys: ['under #PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    tab: ['Corners'],
                    roots: ['Total Corners',],
                    pivotKeys: ['over (#PIVOT#)', 'over #PIVOT#'],
                },
                'UNDER': {
                    tab: ['Corners'],
                    roots: ['Total Corners',],
                    pivotKeys: ['under (#PIVOT#)', 'under #PIVOT#'],
                },
            },
            'CORNER_HDP': {
                'HOME': {
                    tab: ['Corners'],
                    roots: ['Corner Handicap',],
                    pivotKeys: ['#TEAM1# (#PIVOT#)',],
                },
                'AWAY': {
                    tab: ['Corners'],
                    roots: ['Corner Handicap',],
                    pivotKeys: ['#TEAM3# (#PIVOT#)',],
                },
            },
            'HDP': {
                'HOME': {
                    tab: ['Main', 'Asian Lines'],
                    roots: ['Handicap', 'Asian Handicap',],
                    pivotKeys: ['#TEAM1# (#HPIVOT#)'],
                },
                'AWAY': {
                    tab: ['Main', 'Asian Lines'],
                    roots: ['Handicap', 'Asian Handicap',],
                    pivotKeys: ['#TEAM2# (#HPIVOT#)'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    tab: ['Specials'],
                    roots: ['Handicap'],
                    pivotKeys: ['#TEAM1# (#EPIVOT#)'],
                },
                'H2': {
                    tab: ['Specials'],
                    roots: ['Handicap'],
                    pivotKeys: ['#TEAM2# (#EPIVOT#)'],
                },
                'HX': {
                    tab: ['Specials'],
                    roots: ['Handicap'],
                    pivotKeys: ['Draw (#EPIVOT#)'],
                }
            },
        };

        if (typeof markets[bet.market] === 'undefined' || typeof markets[bet.market][bet.target] === 'undefined') {
            throw `Unsupported ${bet.time_value} / ${bet.market} / ${bet.target}`;
        }

        const params = new AllMarkets(bet);

        params.proceed_football = function (bet) {
            if (bet.market.indexOf('HDP') === 0 && parseFloat(bet.pivot) === 0) {
                this.addTotal('roots', ['Draw no bet']);
                this.addTotal('pivotKeys', [`#TEAM${bet.target === 'HOME' ? '1' : '2'}#`]);
                console.log(`#TEAM${bet.target === 'HOME' ? '1' : '2'}#`);
            } else if (bet.market.indexOf('T1') === 0 || bet.market.indexOf('T2') === 0) {
                this.addTotal('tab', ['Goals']);
                this.addTotal('roots',
                    [`#TEAM${bet.market.indexOf('T1') === 0 ? '1' : '2'}# Total`]);
            }
            if (!this.full) {
                this.addTotal('tab', ['1st Half']);
                this.addToEl('roots', '1st half -', true);
            }
        };

        params.proceed_tennis = function (bet) {
            if (bet.market === 'ONE_TWO') {
                if (bet.time_value.indexOf('SET') > -1 && bet.time_value.indexOf('GAME') > -1) {
                    const parts = bet.time_value.split('_GAME_');
                    this.addTotal('tab', ['Games']);
                    this.addTotal('roots',
                        [`${this.tDigit}${this.th} Set Game ${parseInt(parts[1].trim())} - Winner`]);
                } else {
                    this.addTotal('roots', ['Winner']);
                }
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total Games']);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Game Handicap']);
            }
            if (!this.full && bet.time_value.indexOf('GAME') === -1) {
                this.addTotal('tab', ['Sets']);
                this.addToEl('roots', `${this.tDigit}${this.th} Set -`, true);
            }
        };

        params.proceed_baseball = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addTotal('roots', ['Winner (Incl. Extra Innings)', '1x2']);
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total (Incl. Extra Innings)', 'Total']);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Handicap (Incl. Extra Innings)', 'Handicap']);
            }
            if (!this.full) {
                this.addTotal('tab', ['Innings']);
                this.addToEl('roots', `${this.tDigit}${this.th} Inning -`, true);
            }
        }

        params.proceed_hockey = function (bet) {
            if (bet.market.indexOf('TOTAL') > -1) {
                this.addTo('tab', 'Goals');
                if (bet.market.indexOf('T1') === 0 || bet.market.indexOf('T2') === 0) {
                    this.addTotal('roots',
                        [`#TEAM${bet.market.indexOf('T1') === 0 ? '1' : '2'}# Total`]);
                } else {
                    this.addTotal('roots',
                        ['Total', 'Asian Total', 'Total (Incl. Overtime and Penalties)']);
                }
            } else if (bet.market === 'HDP' && parseFloat(bet.pivot) === 0) {
                this.addTotal('roots', ['Draw No Bet']);
                this.addTotal('pivotKeys', [bet.target === 'HOME' ? '#TEAM1#' : '#TEAM2#']);
            } else if (bet.market === 'HDP') {
                this.addTotal('tab', ['Main']);
                this.addTo('roots', 'Handicap');
                this.addTo('roots', 'Handicap (Incl. Overtime and Penalties)');
            }
            if (!this.full) {
                this.addTotal('tab', ['Periods']);
                this.addToEl('roots', `${this.tDigit} period -`, true);
            }
        }

        params.proceed_volleyball = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addTotal('roots', ['Winner']);
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total Points']);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Point Handicap']);
            }
            if (!this.full) {
                this.addTotal('tab', ['Sets']);
                this.addToEl('roots', `${this.tDigit}${this.th} Set -`, true);
            }
        }

        params.proceed_cybersport = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addTotal('roots', ['Winner',
                    'Winner (Incl. Overtime)', 'Match Winner - twoway', ]);
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total Rounds (Incl. Overtime)', 'Total Maps']);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Round Handicap (Incl. Overtime)', 'Map handicap']);
            }
            if (!this.full) {
                this.addTotal('tab', ['Maps' , `Map ${this.tDigit}`]);
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('roots', [`${this.tDigit} map - winner (incl. overtime)`]);
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', [`${this.tDigit} map - total rounds (incl. overtime)`]);
                } else if (bet.market === 'HDP') {
                    this.addTotal('roots', [`${this.tDigit} map - round handicap (incl. overtime)`]);
                }
            }
        }

        params.proceed_basketball = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addTotal('roots', ['Winner (Incl. Overtime)', '1x2']);
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total (Incl. Overtime)', 'Total']);
            } else if (bet.market.indexOf('T1_') > -1 || bet.market.indexOf('2') > -1) {
                const d = bet.market.replace(/\D/g, '');
                this.addTotal('roots', [`#TEAM${d}# Total (Incl. Overtime)`]);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Handicap (Incl. Overtime)', 'Handicap']);
            }
            if (!this.full && ['HALF_1', 'TIME_1', 'HALF_TIME'].indexOf(bet.time_value) > -1) {
                this.addTotal('tab', ['Half']);
                const digit = this.tDigit || '1'
                this.addToEl('roots', `${digit}${this.calcTh(digit)} Half -`, true);
            } else if (!this.full) {
                this.addTotal('tab', ['Quarters']);
                this.addToEl('roots', `${this.tDigit}${this.th} quarter -`, true);
            }
        }

        params.proceed_handball = function (bet) {
            if (bet.market === 'HDP' && parseFloat(bet.pivot) === 0) {
                this.addTotal('tab', ['Main']);
                this.addTotal('roots', ['Draw No Bet']);
                this.addTotal('pivotKeys', [bet.target === 'HOME' ? '#TEAM1#' : '#TEAM2#']);
            }
            if (!this.full) {
                this.addTotal('tab', ['Half']);
                const digit = !this.tDigit ? 1 : this.tDigit;
                this.addToEl('roots', `${digit}${this.calcTh(digit)} Half -`, true);
            }
        }

        const final = applyAllMarkets(bet, ['tab', 'roots', 'pivotKeys',],
            params, markets);

        const m = final[bet.market][bet.target];

        const ePivot = pvt => {
            const p = parseFloat(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };

        const hPivot = pvt => parseFloat(pvt) > 0 ? `+${pvt}` : pvt

        // dLog('green', 'BW', ['Source market is:', JSON.parse(JSON.stringify(m))]);
        
        replaceInner(m, {
            '#TEAM1#': bet.team1,
            '#TEAM2#': bet.team2,
            '#PIVOT#': bet.pivot,
            '#EPIVOT#': ePivot(bet.pivot),
            '#HPIVOT#': hPivot(bet.pivot),
        });

        dLog('green', 'BW', ['Final market is:', m]);

        const $findPivot = $root => {
            let $res = $([]);
            console.log('%c' + 'WAY TWO', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            for (const pvt of m.pivotKeys) {
                let test = `Checking pivot: '${pvt}' - `;
                const sel = `div[data-test="factor-name"] > span:textEqualsI("${pvt}")`;
                let $pivot = $root.find(sel);
                console.log(`${test}result: ${$pivot.length}`);
                if ($pivot.length === 1) {
                    return $pivot.parent();
                } else if ($pivot.length > 1) {
                    throw `Strange pivot length ${$pivot.length} for ${$root}/${pvt}`;
                }
            }
            return $res;
        };

        let $found = $([]);
        do {
            console.log(`OUTER ${tries}!`);
            for (const tab of m.tab) {
                const $tab = await waitForElement(
                    `button[data-test="eventMarket"]:textEqualsI("${tab}")`,
                    250, 3000)
                    .catch(() => $([]));
                if ($tab.length > 0 && $tab.attr('class').indexOf('_active_') === -1) {
                    await mouseChain({target: $tab[0], events: fullClick, error: '$tab'});
                    await delayPromise(1500);
                }
                for (const root of m.roots) {
                    console.log(`Checking root: ${root}`);
                    const $root = () => $(`div[data-test="sport-event-table-market-header"] > span:textEqualsI("${root}")`);
                    if ($root().length === 0) {
                        console.log(`No root ${root}`);
                        continue;
                    }
                    $found = $findPivot($root().closest('div[data-test="fullEventMarket"]'));
                    if ($found.length > 0) {
                        break;
                    }
                }
                if ($found.length > 0) {
                    break;
                }
            }
            if ($found.length === 0 && tries >= 3) {
                throw `${bet.sport}/${bet.type}/${bet.time_value}/${bet.market}/${bet.target}/${bet.pivot}`
                + ' not found :(';
            } else if ($found.length === 0) {
                tries++;
                await delayPromise(2500);
            } else {
                $found[0].scrollIntoView();
                $(window).scrollTop($(window).scrollTop() - 75);
                break;
            }
        } while (tries <= 3);
        return $found;
        //#-#-FINISH
    };

    const closePrevious = async state => {
        const closeCoupon = 'svg[data-test="removeBetsBtn"]';
        const confirmCoupon = 'button[data-test="removeBetsConfirmBtn"]';
        const $closeBtns = () => $('button[data-test="reset-betslip"], svg[data-test="betslip-remove-event"]');
        if ($coupons().length > 0) {
            if (state) {
                for (let i=0; i<$coupons().length; i++) {
                    if ($$coupons().length > settings.newExpressBetsAmount) {
                        await mouseChain({target: $closeBtns().last()[0], events: fullClick, error: 'closeCoupon'});
                        await delayPromise(777);
                    }
                }
            } else {
                await mouseChain({target: $(closeCoupon)[0], events: fullClick, error: 'closePreviousCoupons'});
                await delayPromise(1888);
                if ($(confirmCoupon).length > 0) {
                    await mouseChain({target: $(confirmCoupon)[0], events: fullClick, error: 'closeConfirm'});
                    await delayPromise(1111);
                }
            }
        }
    };

    const placeBetSels = [
        'button[data-test="betslip-place-bet"]',
    ];

    const waitForStatus = async (source, interval, max) => {
        dLog('pink', 'vave',
            `Waiting for status: ${source}, interval: ${interval || 50}, max: ${max || 40000}`);
        globalStatus = '';
        stopWaitForStatus = false;
        const statuses = [
            'div[data-test="couponNotification"]:contains("Bet is successful")',
        ];
        let $vb = $([]);
        await waitForCondition(() => {
            $vb = $(findSel(statuses));
            console.log($('div[data-test="couponNotification"]').trt());
            return $vb.length > 0 || stopWaitForStatus
        }, interval || 50, max || 40000,)
            .catch(e => `waitForStatus(${source}) error: ${e}`);
        //console.log($vb, $vb.html(), $vb.trt());
        dLog('pink', 'vave',
            `We ${stopWaitForStatus ? 'stop wait for' : 'got'} status (source: ${source}):'${$vb.trt()}'`);
        globalStatus = $vb.trt();
        return $vb.trt();
    };

    const checkSuccess = async () => {
        const status = await waitForStatus('checkSuccess');
        if (status.indexOf('Maximum exceeded') > -1) {
            const maxes = await bMess('vave Maximums')
                .infinite()
                .catch(e => 0);
            await bMess('Stake Maximums').set(maxes + 1);
            dLog('yellow', 'vave', `Maximum exceeded ${maxes + 1} times`);
            if (maxes + 1 >= possibleMaximums) {
                throw 'STAKE_MAXED';
            }
            throw `checkSuccess maximum error (${maxes + 1} times): ${status}`;
        }
        if (status.indexOf('Please wait') > -1) {
            throw status;
        }
        if (status.indexOf('Please contact support') > -1) {
            limitedReason = status;
            limitedSend = false;
            limited = true;
            throw status + 'WITHDRAW_LIMITED';
        }
        return status.length > 0 && status.indexOf('successful') > -1;
    };

    const ProccedExpressNew = async () => {
        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));
        const $coefs = () => $('div[class*="events-table-outcome-module_textBase_"]');
        const timeArrow = 'div[data-test="timeFilterArrow"]';
        const timeFilter = 'div[data-test="timeFilter"]';
        const currentBets = [];

        // go to football
        if (document.location.href.indexOf('prematch/football') === -1) {
            // select sport betting
            await mouseChain({target: $('ul.site-nav--real a[href="/prematch"]')[0], events: fullClick, error: 'sport betting'});
            await delayPromise(1555);
            await mouseChain({target: $('div[data-test="sportTypeScroll"] a[href="/prematch/football"]')[0], events: fullClick, error: 'football nav'});
        }

        // select 6hrs
        await waitForElement(timeArrow, 222, 3333);
        if ($(timeArrow).trt() !== '24 h') {
            if ($(timeFilter).length === 0) {
                await mouseChain({target: $(timeArrow)[0], events: fullClick, error: 'timeArrow'});
                await delayPromise(1777);
            }

            await mouseChain({target: $(`${timeFilter}:textEquals("6 hours")`)[0], events: fullClick, error: '24 hours'});
        }
        
        await waitForCondition(() => $coefs().length > 0,
                333, 7777, 'No builder events24!');

        const findOption = coef => {
            return isNaN(coef) ? false : coef >= 1.01 && coef <= 1.15;
        };

        const getUniqueRandomNumber = (length) => {
            return Math.floor(Math.random() * length);
        }

        do {
            const randomCoef = getUniqueRandomNumber($coefs().length);
            const eventName = $coefs().eq(randomCoef)
                .closest('div[data-test="eventTableRow"]')
                .find('div[data-test="teamName"]').toArray()
                .map(el => $(el).trt()).join(' - ');

            if (currentBets.indexOf(eventName) > -1) {
                continue;
            }

        if (eventName.length < 5) {
            if (!sessionStorage.getItem('tooShortOnce')) {
                dLog('red', 'stake', `'${eventName}' is too short - ${eventName.length}`);
                sessionStorage.setItem('tooShortOnce', '1');
            }
            continue;
        }

            if (used[eventName] >= 1) {
                dLog('big-yellow', 'vave', `${eventName} used ${used[eventName]} times!`);
                continue;
            }

            if (
                $coefs().eq(randomCoef)
                .closest('div[class*="events-table-outcome-module_active_"]').length > 0
            ) {
                continue;
            }

            if (!findOption(decOdds($coefs().eq(randomCoef).trt()))) {
                continue;
            }

            currentBets.push(eventName);
            await mouseChain({target: $coefs().eq(randomCoef)[0], events: ['click'], error: 'EVENT'});
            await delayPromise(2222);
        } while ($coupons().length < settings.newExpressBetsAmount);

        // check 2 events
        if ($coupons().length === settings.newExpressBetsAmount 
            && currentBets.length === settings.newExpressBetsAmount
        ) {
            dLog('green', 'vave', [`We get selected bets: '${currentBets}', now used:`, used]);
            bMess('WasSuccessExpressNew').set(true);
            await bMess('currentFirstBet').set(currentBets[0]);
            await delayPromise(333);

            if (settings.newExpressBetsAmount > 1) {
                await bMess('currentSecondBet').set(currentBets[1]);
                await delayPromise(333);
            }
        }

        if ($coupons().length !== settings.newExpressBetsAmount) {
            throw 'New express events not found or wrong quantity selected!';
        }

        await delayPromise(333);
    };

    const proceedBet = async (data, command, testing) => {
        if (!!testing) {
            dLog('blue', 'vave', `We'll sleep 10s because of testing!`);
            await delayPromise(10000);
            return {
                success: true,
                message: {
                    coef: 1.5,
                    stake: await calcStake(data[0].stake),
                    max: 100500,
                },
            }
        }
        const fields = ['team1', 'team2', 'home', 'away',];
        for (const d of data) {
            if (fields.some(f => d[f] === 'EHC Red Bull München' || d[f] === 'EHC Red Bull Munchen')) {
                throw `We don't bet to EHC Red Bull München!`;
            }
        }
        const
            realSuccessInterval = data[0].successBetInterval || settings.betweenBets,
            wasSuccessStake = await bMess('WasSuccessStake')
                .check(realSuccessInterval)
                .catch(() => 0),
            successDiff = Date.now() - wasSuccessStake;
        if (successDiff < realSuccessInterval) {
            throw `To early after previous success bet ${successDiff} instead of ${realSuccessInterval}!`
        }
        if (command === 'BET' && !!currentBetData.data[0].betFromParser) {
            const eventName = `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`;
            if (!await eventsWork('vave', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'vave',
                    `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                    + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
            }
        }

        if (settings.lastScoreBasketball === '999') {
            const currentSource = getCurrentSource(settings.sourceRandom);
            data[0].source = Number(data[0].source);

            if (currentSource === 'X') {
                if (settings.source['X'] !== data[0].source) {
                    throw `Source X ${settings.source['X']} is NOT equal ${data[0].source}!`;
                }
            } else if (currentSource === 'Y') {
                if (settings.source['Y'] !== data[0].source) {
                    throw `Source Y ${settings.source['Y']} is NOT equal ${data[0].source}!`;
                }
            } else if (currentSource === 'XY') {
                if (settings.source['X'] !== data[0].source 
                    && settings.source['Y'] !== data[0].source 
                ) {
                    throw `Source XY is NOT equal ${data[0].source}!`;
                }
            } else if (currentSource === 'Z') {
                if (settings.source['Z'] !== data[0].source) {
                    throw `Source Z ${settings.source['Z']} is NOT equal ${data[0].source}!`;
                }
            } else {
                throw 'Source is out of range';
            }
        }

        await delayPromise(555);
        await closePrevious(settings.newExpresses ? true : false);
        await waitForCondition(() => !!getBalance(true), 55, 3333)
            .catch(() => `Balance still zero :(`);
        let willPlace = parseFloat(data[0].stake);
        if (!willPlace) {
            throw `Bad will place: ${willPlace}, ${data[0].stake}`;
        }
        checkBalance(willPlace);

        if (sourceExpress && settings.lastScoreBasketball === '999') {
            if ($coupons().length !== 1) {
                throw 'Error Express source BET, No 1 event in coupon!';
            }
        }
        // open coupon
        await openCoupon(data);

        if (settings.newExpresses && $coupons().length < settings.newExpressBetsAmount + 1) {
            throw `less than ${settings.newExpressBetsAmount + 1} events in the newExpresses`;
        }

        do {
            await checkCoefs(data);
            checkBalance(willPlace);
            const place = willPlace.toString().replace('.00', '').trim();
            dLog('green', 'vave', `Will place (performBet): ${place}, balance: ${getBalance()}`);
            const $input = () => $('input[data-test="betslip-amount"]');
            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            if (parseFloat($input().val().toString()) !== parseFloat(place)) {
                $input().val(place);
                fireInputEvent($input()[0]);
                fireChangeEvent($input()[0]);
                await delayPromise(300);
            }
            const $pb = $(findSel(placeBetSels));
            stopWaitForStatus = true;
            if ($pb.length !== 1) {
                throw `No place button or its not active! ${globalStatus}`;
            } else {
                await mouseChain({target: $pb[0], events: fullClick, error: '$pb'});
                dLog('green', 'vave', `Place bet ${findSel(placeBetSels)} clicked!`);
            }
            // --- Check for max stake cut (poll every 1s for 5s) ---
            for (let _cutTry = 0; _cutTry < 5; _cutTry++) {
                await delayPromise(1000);
                const $cutError = $('div[data-test="betslip-error-text"]');
                if ($cutError.length > 0) {
                    const errorText = $cutError.trt();
                    if (/Maximum bet amount/i.test(errorText)) {
                        const matchNum = errorText.match(/[\d,.]+/);
                        dLog('red', 'vave', `[CUT] Max bet amount detected: ${matchNum ? matchNum[0] : '?'}`);
                        port.postMessage({
                            m: 'FARM_CUT_DETECTED',
                            cutInfo: {
                                reason: 'max_bet_limited',
                                max_stake: matchNum ? matchNum[0] : null,
                                error_text: errorText.substring(0, 200),
                                bk: 'VAVE', timestamp: Date.now()
                            }
                        });
                    }
                    break;
                }
            }
            // --- END cut check ---
        } while (!await checkSuccess());
        let res = {}, tries = 0;
        do {
            if (tries > 0) {
                await delayPromise(1000);
            }
            res = await getLastBet(false);
        } while (!res.external_id && tries < 5);

        if (!res.external_id) {
            throw `It looks like bet placed, but not connected!`;
        }
        dLog('green', 'vave', [`Bet placed:`, res]);
        
        return {
            success: true,
            message: res,
        }
    };

    const getLastBet = async () => {
        const $myBets = $('div[data-test="betslip-my-bets"]').parent();
        await mouseChain({target: $myBets[0], events: fullClick, error: '$my-bets'});
        await delayPromise(1111);
        const $items = () => $('div[data-test="couponHistoryItem"]');
        await waitForCondition(() => $items().length > 0, 300, 15555, 'No my bets!');
        const $bet = $items().eq(0);
        const res = {
            external_id: $bet.find('span[data-test="betting-history-bet_id"]').trt().replace(/\D/g, ''),
            coef: decOdds($bet.find('div[data-test="betting-history-winFull"]').parent().clone().children().remove().end().trt()),
            stake: parseFloat($bet.find('span[data-test="stake"]').trt().replace(/[^\d.]/g, '')),
            max: '7777777',
        };
        await mouseChain({target: $('div[data-test="betslip-betslip"]')[0], events: fullClick, error: '$bet-slip'});
        return res;
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v =>
            locutus_similar_text(`${v.team1} – ${v.team2}`.toLowerCase(), match.toLowerCase(), true) > 70);
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        const $couponsCoefs = (data.length === 1 && settings.newExpresses === true)
            ? $coupons().last()
            : $coupons();
        $couponsCoefs.each(function () {
            const $this = $(this)
            const match = $this.find('a').trt();
            let localCoef = decOdds($this.find('div[data-test="couponOddValue"]').trt());
            console.log(`checkCoefs ${match} - ${localCoef}`);
            let localData = findInData(match);
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if (!localData || isNaN(localCoef)) {
                errors.push(`LOW_COEF - wrong match (${match}) or localCoef (${localCoef})!`);
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
            throw errors.join('; ') + (checked !== data.length
                ? ` some stakes not checked (${checked}/${data.length})!` : '');
        }
    };

    const commands = new class commands {
        constructor() {
            this.testing = false;
            this.wasRegister = false;
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
            this.cLinks = {
                'BET': proceedBet,
                'EXPRESS_BET': proceedBet,
                'BET_RESULT': collectBetResults,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async executeInternal(command, data) {
            if (fillUpStarted) {
                throw 'Fill up is in progress!';
            }
            //await checkMaximums('executeInternal', command);
            currentBetData.init(data);
            if (command === 'REGISTER_NEW') {
                this.wasRegister = true;
                this.register = data;
                this.testing = data.login === "*** TEST ***";
                dLog('', 'vave', [`execute REGISTER_NEW, ${this.wasRegister}:`, this.register]);
            }
            let res;
            if (!this.testing && settings.forkOnly && ['BET', 'EXPRESS_BET'].indexOf(command) !== -1) {
                res = {success: false, message: 'Fork only mode'};
            } else {
                res = await this.cLinks[command](data, command, this.testing).catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            }
            return res;
        }

        async execute(command, data) {
            // Hint: the goal of executeInternal is to catch errors thrown during execution
            const res = await this.executeInternal(command, data)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog((res.success ? 'green' : 'red'), 'vave', [`${command} execute result:`, res]);
            this.prepareResult(command, res)
                .then(m => {
                    port.postMessage(m);
                    dLog('blue', 'vave', [`prepareResult was sent:`, m]);
                })
                .catch(e => dLog('error', 'vave', [`prepareResult result: ${e} for:`, res]));
            if (!res.success && res.message.indexOf('STAKE_MAXED') > -1) {
                busy = true;
                //await checkMaximums('execute', command);
            }
            if (!res?.success) {
                throw res?.message || 'Unknown error';
            }
            return res;
        }

        async prepareResult(command, res) {
            dLog('', 'Stake', [`prepareResult '${command}':`, res, currentBetData,]);
            if (['BET', 'EXPRESS_BET', 'FORK_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('vave', settings,
                        `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`,
                        true, false);
                    await bMess('WasSuccessStake').set(Date.now());
                    await storeBet(res.message.stake, true);
                    await bMess('Stake Maximums').set(0);

                    if (settings.newExpresses) {
                        // Hint: currentFirstBet MUST exists, otherwise some shit happened!
                        await bMess('WasSuccessExpressNew').set(false);
                        const currentFirstBet = await bMess('currentFirstBet').check(1080000, true);
                        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));

                        if (!used[currentFirstBet]) {
                            used[currentFirstBet] = 1;
                        }

                        dLog('vave', 'blue-big',
                            [`We set bet with first: '${currentFirstBet}', now used:`, used]);

                        if (settings.newExpressBetsAmount > 1) {
                            const currentSecondBet = await bMess('currentSecondBet').check(1080000, true);
                            if (!used[currentSecondBet]) {
                                used[currentSecondBet] = 1;
                            }

                            dLog('vave', 'blue-big',
                            [`We set bet with second: '${currentSecondBet}', now used:`, used]);
                        }

                        await bMess('usedEvents').set(used);
                    }
                }
                let balance = 0;
                await waitForCondition(() => (balance = getBalance(), balance > 0), 250, 5000)
                    .catch(() => dLog('red', 'vave',
                        `It seems like it is really zero on the balance :(`));
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
                    balance,
                };
                const doNotSend = !!currentBetData.data[0].betFromParser && !res.success
                    && resultData.status !== 'LIMITED';
                if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'VAVE';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = '489' || 'oddscp';
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
            } else if (command === 'REGISTER_NEW') {
                dLog('orange', 'vave', [`prepareResult for REGISTER_NEW`,
                    `authCheckStarted: ${authCheckStarted}, lastAuthCheck: ${Date.now() - lastAuthCheck}ms ago`]);
                if (authCheckStarted > 0 && Date.now() - lastAuthCheck > settings.authCheckInterval + 2000) {
                    authCheckStarted = 0;
                }
                if (res.success) {
                    authCheck(`prepareResult for REGISTER_NEW`);
                } else {
                    dLog('orange', 'vave', `There were errors till registration: ${res.message}`);
                }
                return {
                    answered: "REGISTER_NEW",
                    status: res.success ? "success" : "error",
                    answer: res.message
                };
            } else if (command === 'WITHDRAW') {
                const withdrawalResult = {
                    answered: "WITHDRAW",
                    status: res.success ? "success" : "error",
                    answer: res.message,
                };
                if (currentBetData?.data?.queue_id) {
                    withdrawalResult.queue_id = currentBetData.data.queue_id;
                }
                if (res.success) {
                    delayPromise(30000)
                        .then(() => {
                            port.postMessage({
                                answered: 'CHECK_BUSY',
                                answer: busy ? 'BUSY' : 'FREE',
                            });
                            dLog('', 'vave', `CHECK_BUSY after 30s: ${busy}`);
                        });
                    delayPromise(60000)
                        .then(() => {
                            port.postMessage({
                                answered: 'CHECK_BUSY',
                                answer: busy ? 'BUSY' : 'FREE',
                            });
                            dLog('', 'vave', `CHECK_BUSY after 60s: ${busy}`);
                        });
                }
                dLog('big-orange', 'vave', ['WITHDRAWAL RESULT:', withdrawalResult]);
                return withdrawalResult;
            } else {
                return {};
            }
        }
    };

    const messageProcessor = message => {
        dLog('green', 'vave', [`messageProcessor (${busy}/${window.self === window.top})`,
            message]);
        let letsAuth = false;
        if (limited) {
            return;
        }
        if (message.action === 'REGISTER_NEW') {
            settings.login = message.data.login;
            settings.password = message.data.password;
            settings.uid = message.data.uid;
            dLog(`yellow`, 'vave', [`messageProcessor REGISTER_NEW settings:`, settings,]);
            authCheck(`message.action === 'REGISTER_NEW'`);
        }
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY1' : 'FREE',
            });
        } else if (message.action === "auth" || letsAuth) {
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.phone = message.phone;
            settings.email = message.email;
            settings.uid = message.uid;
            settings.fork = message.fork;
            settings.forkOnly = typeof message.fork === 'object' && Object.keys(message.fork).length > 0;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 2400000;
            settings.betweenBets = message.betweenBets || 40000;
            settings.lastScoreBasketball = message?.stake_fork?.lastScoreBasketball || '';
            settings.newExpresses = !!(settings?.stake_fork && settings.stake_fork?.newExpresses);
            settings.newExpressBetsAmount = Number(message?.stake_fork?.newExpressBetsAmount) || 2;
            if (settings.login === '*** TEST ***') {
                commands.testing = true;
            } else {
                if (settings.lastScoreBasketball === '999') {
                    settings.sourceDate = Date.now();
                    settings.sourceRandom = getSourceRandom();

                    if (settings.sourceRandom >= 33 && settings.sourceRandom <= 33) {
                        settings.newExpresses = true;
                        waitSource = true;
                        if (settings.sourceRandom >= 33 && settings.sourceRandom <= 33) {
                            settings.newExpressBetsAmount = 1;
                        }
                    } else {
                        waitSource = false;
                    }
                    dLog('blue', 'vave', `Source current random value - ${settings.sourceRandom}`);
                }
                authCheck(`message.action === "auth" (${message.action === "auth"}) || letsAuth (${letsAuth})`);
            }
            dLog(`yellow`, 'vave', [`messageProcessor auth settings (testing: ${commands.testing}):`,
                settings,]);
        } else if (message.action === 'FARM_CHECK_BETS') {
            console.log('[PENDING] Received FARM_CHECK_BETS command, starting checkPendingBets...');
            checkPendingBets()
                .then(count => {
                    console.log(`[PENDING] checkPendingBets returned: ${count}`);
                    port.postMessage({m: 'FARM_PENDING_BETS', count});
                })
                .catch(e => console.log('[PENDING] checkPendingBets error:', e));
        } else if (commands.exists(message.action)) {
            // Hint: execute command
            if (waitSource) {
                port.postMessage({
                    answered: message.action,
                    status: "error",
                    answer: "BUSY"
                });
            } else {
                busy = true;
                ourCommand.set(message);
                // wait for login value
                waitForCondition(() => !!settings.login, 100, 10000)
                    .then(() => commands.execute(message.action, message.data))
                    .finally(() => {
                        busy = false;
                        ourCommand.clear();
                        mouseChain({target: $('li[data-test="menuItems"] > a[href="/prematch"]')[0], events: fullClick, error: 'go to Top'});
                    });
            }
        } else {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: `${message.action} not supported!`
            });
        }
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('green', 'vave', ['Command was set till unload:', ourCommand.get()]);
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess('vave')
                .set(ourCommand.get(), increaseDelay ? 150000 : 0);
        }
    }, true);

    async function checkPendingBets() {
        console.log('[PENDING] checkPendingBets() called');
        try {
            // 1. Click My Bets tab
            const $myBets = $('div[data-test="betslip-my-bets"]').parent();
            console.log(`[PENDING] My Bets button: ${$myBets.length} elements`);
            if ($myBets.length === 0) {
                console.log('[PENDING] My Bets button not found');
                return null;
            }
            await mouseChain({target: $myBets[0], events: fullClick, error: 'myBetsBtn'});
            console.log('[PENDING] My Bets clicked, waiting for page...');

            // 2. Wait for bets to load
            const $items = () => $('div[data-test="couponHistoryItem"]');
            let loaded = false;
            for (let i = 0; i < 30; i++) {
                await delayPromise(500);
                if ($items().length > 0) { loaded = true; break; }
                const bodyText = document.body.textContent || '';
                if (bodyText.includes('No bets') || bodyText.includes('Нет ставок')) { loaded = true; break; }
                if (i % 5 === 4) console.log(`[PENDING] Waiting... (${(i+1)*500}ms)`);
            }
            console.log(`[PENDING] Page loaded: ${loaded}, items: ${$items().length}`);
            if (!loaded) {
                console.log('[PENDING] My Bets page failed to load');
                await _navBackToBetslip();
                return null;
            }

            // 3. Count pending bets
            const $statuses = $('div[data-test="bet-status"]');
            let pendingCount = 0;
            $statuses.each(function() {
                const text = $(this).text().toLowerCase().trim();
                console.log(`[PENDING] bet-status text: '${text}'`);
                if (text === 'pending') pendingCount++;
            });

            console.log(`[PENDING] Result: ${pendingCount} pending bets`);
            // 4. Navigate back to betslip
            await _navBackToBetslip();
            return pendingCount;
        } catch (e) {
            console.log(`[PENDING] ERROR: ${e}`);
            try { await _navBackToBetslip(); } catch (e2) {}
            return null;
        }
    }

    async function _navBackToBetslip() {
        console.log('[PENDING] Navigating back to Betslip...');
        const $betslip = $('div[data-test="betslip-betslip"]');
        if ($betslip.length > 0) {
            await mouseChain({target: $betslip[0], events: fullClick, error: 'betslipBtn'});
            await delayPromise(1000);
        }
    }

    const afterDOMLoaded = () => {
        bMess('vave',).check(40000, true)
            .then(currentCommand => {
                dLog('orange', 'vave',
                    [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand]);
                messageProcessor(currentCommand);
            })
            .catch(() => dLog('color: darkgray;', 'vave', 'No command!'));
        port.postMessage({m: "PAGE LOADED!"});
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    //return commands;
    return false;

})();
dLog('big-red', 'vave', ['vave script loaded!', t1s2t3]);
