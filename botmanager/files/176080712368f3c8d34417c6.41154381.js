(function () {

    "use strict";

    /**
     * @import libs/jquery-3.3.1.min.js
     */

    let authAvailable = 0;
    let newAPI = false;
    let authClicked = 0;
    let busy = false;
    let increaseDelay = false;
    let enterError = false;

    const port = window.self === window.top
        ? chrome.runtime.connect({name: `port_vbet`})
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
        fork: {
            shoulder: 0,
            maxWait: 0,
            maxLosePercent: 0,
            minWinPercent: 0,
        },
        forkOnly: false,
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 1,
        betweenBets: 25000,
        hostname: document.location.hostname,
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
        'FOOTBALL': ['Soccer'],
        'HOCKEY': ['IceHockey'],
        'VOLLEYBALL': ['Volleyball'],
        'TENNIS': ['Tennis'],
        'TABLETENNIS': ['TableTennis'],
        'BASEBALL': ['Baseball'],
        'BASKETBALL': ['Basketball'],
        'CYBERSPORT': ['Dota2', 'CounterStrike'],
    };

    const ourCommand = new ourCommandProto();
    const smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);

    const getBalance = returnNull => {
        const $b = $('span.hdr-user-info-texts-bc');
        if ($b.length > 0) {
            return parseFloat($b.trt().replace(',', '')
                .replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    };

    const changeLang = async () => {
        const $ls = $('div.leng-b[class*="selected-"] span');
        if ($ls.length > 0 && $ls.trt() !== 'EN') {
            await mouseChain({
                target: $ls.parent()[0], events: fullClick, error: 'mainL'
            });
            const $en = await waitForElement(`li.eng`, 333, 5000);
            await mouseChain({target: $en[0], events: fullClick, error: '$en'});
            await delayPromise(10000);
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
            await changeLang();
            await closeAllWeNeed({
                'a[aria-label="dismiss cookie message"]': 'a[aria-label="dismiss cookie message"]',
                'div.account-popup-message:contains("VBET holds")':
                    'div.account-popup-buttons a:contains("I AGREE")',
                'div.game-preview-container div.gameinfo-container:visible':
                    'div.game-preview-header div.sb-arrow-inner',
            });
            const $av = $('li.animation-view-icon-v3');
            if ($av.length > 0 && !$av.hasClass('active')) {
                await mouseChain({target: $av[0], events: fullClick, error: '$av'});
            }
            if (checkSE(['button[title="Sign in"]:visible'], true)
                && authAvailable < 4) {
                authAvailable++;
                dLog('', 'VBET', `Fake auth skipped ${authAvailable}`);
            } else if (checkSE(['button[title="Sign in"]:visible'], true)) {
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
            .catch(e => dLog('red', 'Vbet', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const checkRecaptcha = async () => {
        const $rc = await waitForElement('div.bet-status-recaptcha', 333, 7000)
            .catch(() => $([]));
        if ($rc.length > 0) {
            dLog('red', 'Vbet', 'Recaptcha - awaiting solving!');
            await waitForCondition(() => {
                let aStatus = $('div.antigate_solver a.status').last().trt();
                if (aStatus === 'Solved') {
                    return true;
                } else if (aStatus.indexOf('Outdated') > -1) {
                    mouseChain({target: $('a.control.reload')[0], events: ['click']})
                        .then().catch();
                    return false;
                } else {
                    return false;
                }
            }, 555, 200000, 'reCaptcha not solved for 200s');
            dLog('red', 'Vbet', 'Recaptcha solved!');
            await delayPromise(2000);
            await mouseChain({
                target: $('button[ng-click="submitRecaptcha()"]')[0],
                events: fullClick, error: 'submitRecaptcha'
            });
            dLog('red', 'Vbet', 'Recaptcha submitted!');
            await delayPromise(1000);
        } else {
            dLog('red', 'Vbet', 'No Recaptcha!');
        }
    };

    const tryToLogIn = async () => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        await mouseChain({
            target: $('button[title="Sign in"]:visible')[0], events: fullClick,
            error: 'login'
        });
        const sels = [
            findSel(['input[name="username"]']),
            findSel(['input[name="password"]']),
            findSel(['input[name="remember_me"]']),
            findSel(['div.entrance-form-action-item-bc button[title="Sign in"]:visible']),
        ];
        await waitForCondition(() => checkSE(sels), 333, 10000, 'No inputs!');
        await checkRecaptcha();
        await delayPromise(500);
        await clearAndSimulate($(sels[0])[0], settings.login);
        await delayPromise(2000);
        await clearAndSimulate($(sels[1])[0], settings.password);
        await delayPromise(3000);
        if ($(sels[2]).length > 0 && !$(sels[2]).prop('checked')) {
            await mouseChain({target: $(sels[2])[0], events: fullClick, error: 'sels2'});
            await delayPromise(3000);
        }
        authClicked = Date.now();
        authAvailable = 0;
        await mouseChain({target: $(sels[3])[0], events: fullClick, error: 'Enter'});
        dLog('red', 'Vbet', `Auth clicked!`);
        await checkRecaptcha();
        const $errorMessage = await waitForElement('div.entrance-f-error-message-bc:visible', 333, 3333).catch(() => $([]));
        if ($errorMessage.length > 0) {
            enterError = true;
        }
        return "auth_clicked";
    };

    const closePreviousCoupons = async skip => {
        if (skip) {
            return 'skipped!';
        }

        // Hint: Click 'Remove all' once or every 'Close'
        let $clearBtn = $('span:textEquals("Remove All")');
        if ($clearBtn.length === 1) {
            await mouseChain({
                target: $clearBtn[0],
                events: fullClick,
                scroll: true,
                error: 'c0'
            });
            await delayPromise(888);
            return 'ClearBtn clicked!';
        }
        const closes = 'div.remove-icon-betslip-v3:visible';
        while ($(closes).length > 0) {
            await mouseChain({
                target: $(closes).eq(0)[0], events: fullClick, scroll: true, error: 'c1'
            });
            await delayPromise(500);
        }
        return 'All were closed!';
    };

    const openEvent = async data => {
        dLog('red', 'Vbet', ['openEvent', data]);
        const eventName = `${data.team1} - ${data.team2}`.toLowerCase();
        const eventEl = `li.sport-search-result-item-bc p:textEqualsI("${eventName}")`;
        const checkWeAreThere = function () {
            const $teams = $('p.game-d-c-b-r-c-team-name');
            if ($teams.length === 2) {
                const checkEvent = (`${$teams.eq(0).trt()} - `
                    + `${$teams.eq(1).trt()}`)
                    .toLowerCase();
                return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70;
            } else {
                return false;
            }
        };
        const sports = accordance[data.sport];
        const searchEl = 'div.left-menu-search input.ss-input-bc';

        if (!sports) {
            throw `Sport ${sports} is not available`;
        }

        if (checkWeAreThere()) {
            return 'We probably on event page!'
        }

        // wait for search selector
        await waitForElement(searchEl, 222, 5555);
        // typing event
        await clearAndSimulate($(searchEl)[0], `${data.team1}`.toLowerCase());
        // wait for event
        const $event = await waitForElement(eventEl, 222, 7777).catch(() => $([]));

        if ($event.length === 0) {
            throw 'Wrong length of Event: ' + $event.length;
        }

        // click on event
        await mouseChain({target: $(eventEl)[0], events: fullClick, error: 'eventEl'});
        await waitForCondition(() => checkWeAreThere(),
            777, 30000, 'We are not on event!');
        return 'Switched to event!';
    };

    const getBetElement = async data => {
        //#-#-START
        const bet = JSON.parse(JSON.stringify(data));
        const $teams = $(findSel(['p.game-d-c-b-r-c-team-name']));
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
                    roots: ['Total Goals', 'Total Goals Asian',],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    roots: ['Total Goals', 'Total Goals Asian',],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['#TEAM1# Total Goals',],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    roots: ['#TEAM1# Total Goals',],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['#TEAM2# Total Goals',],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    roots: ['#TEAM2# Total Goals',],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    roots: ['Corners: Total',],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    roots: ['Corners: Total',],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    roots: ['Goals Handicap', 'Goals Asian Handicap',],
                    pivotKeys: ['#PIVOTH#'],
                    specials: ['#TEAM1#'],
                },
                'AWAY': {
                    roots: ['Goals Handicap', 'Goals Asian Handicap'],
                    pivotKeys: ['#PIVOTH#'],
                    specials: ['#TEAM2#'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    roots: ['Goals Handicap 3 Way'],
                    pivotKeys: ['#PIVOTH#'],
                },
                'H2': {
                    roots: ['Goals Handicap 3 Way'],
                    pivotKeys: ['#PIVOTH#'],
                },
                'HX': {
                    roots: ['Goals Handicap 3 Way'],
                    pivotKeys: ['Tie: #TEAM1#', 'Tie: #TEAM2#'],
                }
            },
        };

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw `Unsupported ${data.time_value} / ${data.market} / ${data.target}`;
        }

        const params = new AllMarkets(bet);
        params.proceed_football = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Result', '1st Half Result');
                } else {
                    this.addToEl('roots', '1st Half ', true);
                }
            }
        };

        params.proceed_tennis = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Winner');
                } else {
                    this.addToEl('roots', '1st Set ', true);
                }
            }
        };
        params.proceed_basketball = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Result', `${this.tDigit}${this.th} Quarter Winner (2-Way)`);
                } else {
                    this.addToEl('roots', `${this.tDigit}${this.th} Quarter `, true);
                }
            } else {
                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total Goals', 'Total Points');
                }
                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', '#TEAM1# Total Goals', '#TEAM1# Total Points');
                }
                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# Total Goals', '#TEAM1# Total Points');
                }
                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Goals Handicap', 'Points Handicap');
                }
            }
        };
        params.proceed_hockey = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Result', `${this.tDigit}${this.th} Period Result`);
                } else {
                    this.addToEl('roots', `${this.tDigit}${this.th} Period `, true);
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', 'Match Result', 'Match Winner (Including Overtime)');
                    this.addReplIn('roots', 'Double Chance', 'Double Chance (Regular Time)');
                }
                if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total Goals', 'Total Goals (Regular Time)');
                }
                if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', '#TEAM1# Total Goals', '#TEAM1# Total Goals (Regular Time)');
                }
                if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# Total Goals', '#TEAM1# Total Goals (Regular Time)');
                }
                if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Goals Handicap', 'Goals Handicap (Regular Time)');
                }
            }
        };

        const final = applyAllMarkets(bet, ['roots', 'pivotKeys', 'tabs'], params, markets, true);
        const m = final[bet.market][bet.target];
        const ePivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };
        const hPivot = pvt => parseFloat(pvt) > 0 ? `+${pvt}` : pvt;

        replaceInner(m, {
            '#TEAM1#': data.team1,
            '#TEAM2#': data.team2,
            '#PIVOT#': data.pivot,
            '#EPIVOT#': ePivot(data.pivot),
            '#PIVOTH#': hPivot(data.pivot),
        });

        dLog('green', 'Vbet', ['Final market is:', m]);

        const searchMarketInpt = 'div.game-details-section input.ss-input-bc';
        await waitForElement('div.horizontal-sl-tab-bc:textEquals("All")', 222, 7777);

        /**
         *
         * @param $root
         * @param type
         * @returns {jQuery<HTMLElement>}
         */
const $findPivot = ($root, type) => {
    for (const pvt of m.pivotKeys) {
        const $market = $root.closest('div.sgm-market-g');

        // ==== спец-ветка для Total Goals (column-3 с базами .market-base) ====
        const $gridTG = $market.find('div.sgm-market-g-item-bc.sgm-market-separate.column-3').first();
        if ($gridTG.length && $gridTG.find('.sgm-market-g-i-cell-bc.market-bc.empty-market-bc.market-base').length) {
            const normNum = s => String(s).replace(/[^\d.,-]/g, '').replace(',', '.').trim();
            const want = normNum(typeof data.pivot !== 'undefined' ? data.pivot : pvt);

            const $base = $gridTG
                .find('.sgm-market-g-i-cell-bc.market-bc.empty-market-bc.market-base .market-coefficient-bc')
                .filter((i, el) => normNum($(el).text()) === want)
                .closest('.sgm-market-g-i-cell-bc.market-bc.empty-market-bc.market-base')
                .first();

            if ($base.length) {
                const isOver = ['HOME','OVER','O','OVER_GOALS'].indexOf(data.target) > -1;
                // после base идут две котировки: 0 -> Over, 1 -> Under
                const $cell = $base.nextAll('.sgm-market-g-i-cell-bc.market-bc').eq(isOver ? 0 : 1);
                if ($cell.length) return $cell;
            }
            // если grid TG есть, но нужной базы нет — пробуем следующий pvt
            continue;
        }
        // ==== конец ветки Total Goals ====

        // ==== спец-ветка для Match Result (type === 1): headers → odds ====
        if (type === 1) {
            const $gridMR = $market.find('div.sgm-market-g-item-bc.column-3').first();
            if ($gridMR.length && $gridMR.find('.sgm-market-g-i-cell-bc.market-bc.m-g-header').length >= 3) {
                const norm = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
                const $headers = $gridMR.find('.sgm-market-g-i-cell-bc.market-bc.m-g-header');
                const $cells   = $gridMR.find('.sgm-market-g-i-cell-bc.market-bc');
                const N = $headers.length; // обычно 3
                let idx = -1;
                $headers.each((i, el) => {
                    if (idx < 0 && norm($(el).text()) === norm(pvt)) idx = i;
                });
                if (idx >= 0) {
                    const $cell = $cells.eq(N + idx);
                    if ($cell.length) return $cell;
                }
                // если не нашли по этому pvt — пробуем следующий pvt
                continue;
            }
        }
        // ==== конец ветки Match Result ====

        // ==== твои исходные fallbacks ====
        if (type === 1) {
            let $pivot = $market.find(`span.market-name-bc:textEqualsI("${pvt}")`);
            if ($pivot.length > 0) {
                return $pivot;
            }
        } else if (type === 2) {
            if (data.market === 'EURO_HDP') {
                let side = '3n';
                if (data.target === 'H1') { side = '3n -2'; }
                if (data.target === 'HX') { side = '3n -1'; }
                const $pivot = $market
                    .find(`div.sgm-market-g-i-cell-bc:nth-child(${side}) span.market-name-bc:textEquals(${pvt})`);
                if ($pivot.length > 0) {
                    return $pivot;
                }
            } else {
                const side = ['HOME', 'OVER'].indexOf(data.target) > -1 ? 'odd' : 'even';
                const $pivot = $market
                    .find(`div.sgm-market-g-i-cell-bc:nth-child(${side}) span.market-name-bc:textEquals(${pvt})`);
                if ($pivot.length > 0) {
                    return $pivot;
                }
            }
        }
        // ==== конец fallbacks ====
    }
    return $([]);
};

let $found = $([]);
let type = data.market === 'ONE_TWO' ? 1 : 2;
for (const root of m.roots) {
    console.log(`Checking root: ${root}`);
    const $searchMarketInpt = await waitForElement(searchMarketInpt, 222, 2999).catch(() => $([]));

    if ($searchMarketInpt.length > 0) {
        // typing market
        await clearAndSimulate($(searchMarketInpt)[0], root);
        await delayPromise(888);
    } else {
        await mouseChain({
            target: $('div.game-details-section div.sport-search-bc i')[0],
            events: fullClick,
            error: 'searchBtn'
        });
        await delayPromise(333);
        await waitForElement(searchMarketInpt, 222, 4222);
        // typing market
        await clearAndSimulate($(searchMarketInpt)[0], root);
        await delayPromise(888);
    }

    await waitForElement('div.sgm-market-g', 222, 5555);
    const $root = () => $(`p.sgm-market-g-h-title-bc[title="${root}"]`);

    if ($root().length === 0) {
        continue;
    }

    $found = $findPivot($root(), type);

    if ($found.length > 0) {
        break;
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
        dLog('green', 'Vbet', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'Vbet', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'Vbet', 'Event must be opened!');
            const $element = await getBetElement(data);
            console.log($element);
            
            let coefWeWaitFor = $element.trt();
            dLog('green', 'Vbet', 'We got element! Coef: ' + coefWeWaitFor);
            const waitForCouponVisibleStarted = Date.now();
            let elementWasClicked = 0;
            let performElementClick = async function () {
                dLog('green', 'Vbet', 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                    + ') /' + (Date.now() - elementWasClicked));
                await mouseChain({target: $element[0], events: fullClick, error: 'performElementClick'})
                elementWasClicked = Date.now();
            };
            const checkCoupon = () => {
                let event = (data.team1 + ' - ' + data.team2).toLowerCase();
                let result = false;
                $('div.bs-bet-item-bc').each(function () {
                    let ev = $(this).find('span.bs-bet-i-h-title-bc-text').trt().toLowerCase();
                    if (event === ev || locutus_similar_text(event, ev, true) > 70) {
                        result = true;
                        return false;
                    } else {
                        dLog('red', 'Vbet', `'${ev}' !== '${event}'`);
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
                return 77777;
            };

            if (paramData.length > 1) {
                dLog('red', 'Vbet', `Express here! ${i}/${(paramData.length - 1)}`);
                if (i === paramData.length - 1) {
                    return await getMaxHere();
                }
            } else {
                return await getMaxHere();
            }
        }
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v =>
            locutus_similar_text(`${v.team1} - ${v.team2}`.toLowerCase(), match.toLowerCase(), true) > 70);
        const $coupons = $('div.bs-bet-item-bc');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $(this).find('span.bs-bet-i-h-title-bc-text').trt();
            console.log('match ', match);
            let localCoef = parseFloat($this.find('span.bs-bet-i-b-coefficient-bc').trt());
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

    const deposit = async data => {
        if (ourCommand.getAdded('waitForDeposit')) {
            const res = await bMess('DEPOSIT_RESULT', true).get(200000, 60000)
                .catch(() => ({success: false, message: 'No result for 200s :('}));
            const $close = $('div.my-bets-closed-icon-b');
            if ($close.length > 0) {
                delayPromise(1000)
                    .then(() => mouseChain({target: $close[0], events: fullClick, error: '$close'}))
                    .catch(e => console.log(e));
            }
            return res;
        } else {
            if ($('div.all-history-lightbox-content:visible').length === 0) {
                await mouseChain({
                    target: $('a[title="Deposit"]')[0],
                    events: fullClick, error: 'Deposit'
                });
                await delayPromise(5000);
            }
            const $dep = await waitForElement('div.group-tabs-wrapper li:has(span:textEquals("Deposit"))',
                333, 15000);
            if (!$dep.hasClass('active')) {
                await mouseChain({
                    target: $dep[0],
                    events: fullClick, error: '$dep'
                });
                await delayPromise(5000);
            }
            const $skrill = await waitForElement('li:has(div[title="Skrill"])', 333, 10000);
            if (!$skrill.hasClass('active')) {
                await mouseChain({
                    target: $skrill[0],
                    events: fullClick, error: '$skrill'
                });
                await delayPromise(5000);
            }
            const $email = await waitForElement('input[name="email"]:visible', 333, 10000);
            await clearAndInputEmail($email[0], data.login);
            await delayPromise(3000);
            await clearAndSimulate($('input[name="amount"]')[0], data.amount);
            await delayPromise(3000);
            await mouseChain({
                target: $('#deposit-button')[0],
                events: fullClick,
                error: 'deposit-button'
            });
            await delayPromise(3000);
            const $yes = await waitForElement('button[ng-if="activeDialog.yesno"]', 333, 10000);
            await bMess(`${data.paysystem}_COMMAND`, true).set(ourCommand.get());
            ourCommand.add('waitForDeposit', true);
            await delayPromise(1000);
            await mouseChain({
                target: $yes[0],
                events: fullClick,
                error: '$yes'
            });
            return await deposit(data);
        }
    };

    const withdraw = async data => {
        if ($('div.all-history-lightbox-content:visible').length === 0) {
            await mouseChain({
                target: $('a[title="Deposit"]')[0],
                events: fullClick, error: 'Deposit'
            });
            await delayPromise(5000);
        }
        const $wd = await waitForElement('div.group-tabs-wrapper li:has(span:textEquals("Withdraw"))',
            333, 15000);
        if (!$wd.hasClass('active')) {
            await mouseChain({
                target: $wd[0],
                events: fullClick, error: '$wd'
            });
            await delayPromise(5000);
        }
        const $skrill = await waitForElement('li:has(div[title="Skrill"])', 333, 10000);
        if (!$skrill.hasClass('active')) {
            await mouseChain({
                target: $skrill[0],
                events: fullClick, error: '$skrill'
            });
            await delayPromise(5000);
        }
        const $email = await waitForElement('input[name="email"]:visible', 333, 10000);
        await clearAndInputEmail($email[0], data.login);
        await delayPromise(3000);
        await clearAndSimulate($('input[name="withdrawAmount"]')[0], data.amount);
        await delayPromise(3000);
        await mouseChain({
            target: $('button.button-confirm')[0],
            events: fullClick,
            error: 'button-confirm'
        });
        await delayPromise(3000);
        const $yes = await waitForElement('button[ng-if="activeDialog.yesno"]', 333, 10000)
            .catch(() => $([]));
        if ($yes.length > 0) {
            await mouseChain({
                target: $yes[0],
                events: fullClick,
                error: '$yes'
            });
        }
        const $close = $('div.my-bets-closed-icon-b');
        if ($close.length > 0) {
            delayPromise(1000)
                .then(() => mouseChain({target: $close[0], events: fullClick, error: '$close'}))
                .catch(e => console.log(e));
        }
        return {
            success: true,
            message: 'It should be good!',
            wallet_balance: ''
        };
    };

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 85;
        dLog('green', 'Vbet', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    // use if needed
    const waitFirstBetResult = function ($el, event) {
        const
            team1 = $el.eq(0).trt(),
            team2 = $el.eq(1).trt(),
            checkEvent = `${team1} - ${team2}`;
        return checkEvent.length > 5 && checkEventName(checkEvent, event);
    };

const proceedBet = async (data, command) => {
    //const $accept = () => $('button[title="Accept changes and place bet"]');
    const
        realSuccessInterval = data[0].successBetInterval || settings.betweenBets,
        wasSuccessStake = await bMess('WasSuccessStake')
            .check(realSuccessInterval)
            .catch(() => 0),
        successDiff = Date.now() - wasSuccessStake;
    if (command === 'BET' && !!currentBetData.data[0].betFromParser) {
        const eventName = `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`;
        if (!await eventsWork('VBET', settings, eventName, false, true)) {
            throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
        } else {
            dLog('big-blue', 'Vbet',
                `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
        }
    }

    const checkSuccess = async () => {
        await waitForElement('p:textEquals("Your betslip is empty")', 333, 42000, true, 1, 'No success!');
        return true;
    };
    const checkBalance = willPlace => {
        const balance = getBalance();
        if (balance < willPlace) {
            throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
        } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
            throw 'Undefined or NaN will place';
        }
    };

    // --- helpers для доп. верификации (окно свежести по минутам) ---
    const POLL_MS = 333;
    const VERIFY_TIMEOUT_MS = 22000;

    const parseBetTime = (txt) => {
        // ожидается формат "DD.MM.YYYY, HH:mm", напр. "25.08.2025, 19:34"
        const m = String(txt).match(/(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}):(\d{2})/);
        if (!m) return NaN;
        const [ , dd, mm, yyyy, HH, MM ] = m.map(Number);
        return new Date(yyyy, mm - 1, dd, HH, MM, 0, 0).getTime(); // сек=0
    };

    const betsRoot = () => $('.bs-f-b-content-bc.open-bets');
    const betItems = () => betsRoot().find('> .bet-history-t-holder-hk-bc:visible');

    const readTopBet = () => {
        const $bet = betItems().first();
        if (!$bet.length) return null;
        const idTxt = $bet.find('p.bet-history-id').first().text() || '';
        const id = (idTxt.match(/\d+/) || [null])[0];
        const timeTxt = $bet.find('time.bet-history-day').first().text().trim();
        const createdAt = parseBetTime(timeTxt);
        const statusTxt = $bet.find('p.bet-history-status .ellipsis').first().text().trim();
        return { id, createdAt, status: statusTxt, $el: $bet };
    };

    const waitMs = (ms) => new Promise(r => setTimeout(r, ms));

    // Проверка свежести по минутам:
    // допускаем, что верхняя ставка в истории имеет минуту в диапазоне:
    // [ floor(startedAt до минуты) - 1 мин ; floor(startedAt до минуты) + 1 мин ]
    const verifyPlacedUI = async ({ startedAt }) => {
        const deadline = Date.now() + VERIFY_TIMEOUT_MS;

        const mStart   = Math.floor(startedAt / 60_000) * 60_000;
        const minBound = mStart - 60_000; // минута назад
        const maxBound = mStart + 60_000; // минута вперёд

        while (Date.now() < deadline) {
            if (!betsRoot().length || !betItems().length) {
                await waitMs(POLL_MS);
                continue;
            }
            const top = readTopBet();
            const fresh = (top && isFinite(top.createdAt))
                ? (top.createdAt >= minBound && top.createdAt <= maxBound)
                : false;

            if (fresh) {
                dLog('green', 'Vbet', `Verify OK (minute-window). betId=${top?.id}`);
                return { ok: true, topBet: top, minBound, maxBound };
            }
            await waitMs(POLL_MS);
        }
        dLog('red', 'Vbet', 'Verify FAILED by timeout (minute-window)');
        return { ok: false };
    };
    // --- конец helpers ---

    await closePreviousCoupons(false);
    currentBetData.max = await openCoupon(data);

    // метка времени последнего клика Place Bet
    let lastStartedAt = null;

    do {
        // Hint: Try to perform bet
        await checkCoefs(data);
        let willPlace = parseFloat(data[0].stake);
        if (currentBetData.max !== -1 && willPlace > currentBetData.max) {
            willPlace = currentBetData.max;
        }
        checkBalance(willPlace);
        dLog('green', 'Vbet', `Will place (performBet): ${willPlace}, balance: ${getBalance()}`);
        const $input = () => $('input[placeholder="Enter stake"]');
        if ($input().length !== 1) {
            throw `2 Wrong number of bet's inputs: ${$input().length}`;
        }

        $input()[0].scrollIntoView({ block: 'center' });
        $input()[0].click();
        await delayPromise(100);

        console.log('TO PLACE ', willPlace.toString().replace('.00', '').trim());
        console.log('input ', $input());
        await clearAndInputNumber($input()[0], willPlace.toString()
            .replace('.00', '').trim());
        await delayPromise(888);
        dLog('green', 'Vbet', `STAKE entered ${willPlace}`);
        let entered = parseFloat($input().val());
        dLog('green', 'Vbet',
            `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
        if (isNaN(entered) || willPlace !== entered) {
            dLog('red', 'Vbet', 'Entered !== willPlace - try to reenter!');
            continue;
        }

await delayPromise(300);
const $placeBtn = $('button[title="Place Bet"], button[title="Bet"], button[title="Bet Now"]');
if ($placeBtn.length === 0 || $placeBtn.prop('disabled')) {
  throw 'No place button or button disabled!';
}

const btn = $placeBtn[0];
if (document.hidden || !document.hasFocus()) {

  // <<< ВАЖНО: сохраняем момент клика
  lastStartedAt = Date.now();

  // вкладка в фоне: синтетический клик (не "trusted", но часто хватает)
  btn.scrollIntoView({ block: 'center', inline: 'nearest' });
  btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, view: window }));
  btn.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, view: window }));
  btn.click(); // fallback
} else {

  // <<< ВАЖНО: сохраняем момент клика
  lastStartedAt = Date.now();

  await mouseChain({ target: btn, events: fullClick, scroll: true, error: '$placeBtn' });
}
await delayPromise(120);
// [/edited-by-chatgpt]
} while (!await checkSuccess());

    // --- ДОПОЛНИТЕЛЬНАЯ ВЕРИФИКАЦИЯ (окно по минутам) ---
    dLog('blue', 'Vbet', `Placed, verifying in Open Bets...`);
    const $dbbVerify = await waitForElement('div[title="Open Bets"]', 333, 10555);
    await delayPromise(200);
    await mouseChain({target: $dbbVerify[0], events: fullClick, error: 'dbb_verify'});
    await delayPromise(777);

    const verify = await verifyPlacedUI({ startedAt: lastStartedAt });
    if (!verify.ok) {
        throw 'Verification failed: latest Open Bets item is not fresh enough (minute-window)';
    }
    // --- конец доп. верификации ---

    // Hint: collect result
    dLog('blue', 'Vbet', `Placed, let's collect!`);
    const $dbb = await waitForElement('div[title="Open Bets"]', 333, 10555);
    await delayPromise(555);
    await mouseChain({target: $dbb[0], events: fullClick, error: 'dbb'});
    await delayPromise(3777);
    const $bet = await waitForElement('div.bet-history-t-holder-hk-bc:visible:first', 333, 10555);
    const response = {
        success: true,
        message: {
            external_id: $bet.find('p.bet-history-id:visible').trt().replace(/[^\d]/g, ''),
            coef: $bet.find('b.bet-history-odds-coeff:visible').trt(),
            stake: $bet.find('b.bet-history-stake-money:visible').trt().replace(/[^\d.]/g, '').trim(),
            max: currentBetData.max,
        },
    };
    await delayPromise(555);
    await mouseChain({
        target: $('div[title="BetSlip"]')[0], events: fullClick, error: 'betslip'
    });

    return response;
};



    const collectBetResults = async (inD, command, balance, inplay) => {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inplay ? 1 : inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        dLog('green', 'Vbet',
            [`collectBetResults, limit: ${limit}, inplay: ${inplay}, data: `, data]);
        if ($('div.all-history-lightbox-content:visible').length === 0) {
            await mouseChain({
                target: $('div[ng-click="myBetsToggle()"]')[0],
                events: fullClick, error: 'myBets'
            });
            await delayPromise(5000);
        }
        const $all = await waitForElement('li:has(span:textEquals("All Bets"))', 333, 5000);
        if (!$all.hasClass('active')) {
            await mouseChain({
                target: $all[0],
                events: fullClick, error: 'all'
            });
            await delayPromise(5000);
        }
        if ($('div.select-box-period-b:last p[ng-if="!customPeriodApplied"]').trt() !== '72 hours') {
            await mouseChain({
                target: $('div.select-box-period-b:last')[0],
                events: fullClick, error: 'Period'
            });
            await delayPromise(1000);
            const $st = await waitForElement('li:textEquals("72 hours"):visible', 333, 3000);
            await mouseChain({target: $st[0], events: fullClick, error: '$st'});
            await delayPromise(1000);
            await mouseChain({
                target: $('button[ng-click="loadMixedBetHistory()"]')[0],
                events: fullClick, error: 'show'
            });
            await delayPromise(5000);
        }
        const rowSel = 'tr[ng-click="toggleBetDetails(bet)"]';
        let tick = 0;
        let $rows = $([]);
        do {
            $rows = await waitForElement(rowSel, 333, 15000).catch(() => $([]));
            if ($rows.length === 0) {
                tick++;
                await mouseChain({
                    target: $('button[ng-click="loadMixedBetHistory()"]')[0],
                    events: fullClick, error: 'show'
                });
                await delayPromise(5000);
            }
        } while ($rows.length === 0 && tick < 3);
        for (let i = 0; i < $rows.length; i++) {
            if (i >= limit) {
                break;
            }
            const $this = $(rowSel).eq(i);
            const $cols = $this.find('td');
            const external_id = $cols.eq(0).find('span:last').trt()
                .replace(/[^\d]/g, '');
            if (data.length === 0 || data.indexOf(external_id) > -1) {
                const stake = $cols.eq(3).find('input').val();
                const result = $cols.eq(6).trt().replace(/[^\d.]/g, '').trim();
                const state = $cols.eq(7).trt();
                const status = state === 'Won' ? 'WON' : state === 'Lost' ? 'LOSE'
                    : state === 'Returned' ? 'REFUNDED' : 'ACCEPTED';
                collected.push({
                    external_id,
                    status,
                    match: '',
                    bkPivot: '',
                    coef: $cols.eq(5).trt(),
                    stake: stake,
                    result: status === 'ACCEPTED' ? '' : result,
                });
            }
        }
        dLog('green', 'Vbet', ['Collected', collected]);
        const $close = $('div.my-bets-closed-icon-b');
        if ($close.length > 0) {
            delayPromise(1000)
                .then(() => mouseChain({target: $close[0], events: fullClick, error: '$close'}))
                .catch(e => console.log(e));
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
                'WITHDRAW': withdraw,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data) {
            currentBetData.init(data);
            //dLog('green', 'Vbet', [`commands execute ${command}`, data, formatStack((new Error()).stack)]);
            const res = await this.cLinks[command](data, command, getBalance()).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'Vbet', `${command} result: ${res.message}`);
            await port.postMessage(await this.prepareResult(command, res));
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

        async prepareResult(command, res) {
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('VBET', settings,
                        `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`,
                        true, false);
                    await bMess('WasSuccessStake').set(Date.now());
                    await storeBet(res.message.stake, true);
                    await bMess('Stake Maximums').set(0);
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
                if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'VBET';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = '441' || 'oddscp';
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
                    doNotSend: !!currentBetData.data[0].betFromParser && !res.success,
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
    };

    const messageProcessor = message => {
        dLog('green', 'Vbet', [`messageProcessor (${busy})`, message]);
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
            settings.fork = message.fork;
            settings.forkOnly = typeof message.fork === 'object' && Object.keys(message.fork).length > 0;
            settings.stake_fork = message?.stake_fork;
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
                .then(m => console.log(`${message.action} done!`, m))
                .catch(m => console.log(`${message.action} error!`, m))
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
            dLog('green', 'Vbet', ['Command was set till unload:', ourCommand.get()]);
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess('BETWAY_COMMAND', true).set(ourCommand.get(), increaseDelay ? 130000 : 0);
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
            bMess('BETWAY_COMMAND', true).check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'Vbet',
                        [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`, currentCommand]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'Vbet',
                    `No command at ${document.location.href}!`));
        }
    }

})();
