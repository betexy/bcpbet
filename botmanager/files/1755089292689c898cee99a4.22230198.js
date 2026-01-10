(function () {

    "use strict";

    if (window.self !== window.top) {
        return;
    }

    let busy = false;
    let increaseDelay = false;
    let authClicked = 0;
    let enterError = false;

    const port = chrome.runtime.connect({name: 'port_winlinecupis'});

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
        stakeFork: {},
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 3,
        betweenBets: 25000,
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
            await waitForElement('div.user-account__label:textEquals("Баланс:") + div.user-account__value',
                333,4444).catch(() => $([]));
            await closeAllWeNeed({
                'div.ww-dialog__wrapper button:textEquals("OK")': 'div.ww-dialog__wrapper button:textEquals("OK")',
            });
            if (checkSE(['h1.ww-dialog__title:textEquals("Авторизация")'], true)) {
                port.postMessage({m: "tech works! 2"});
                await delayPromise(1000);
                await tryToLogIn().catch(e => bsError(port, 'Error login: ' + e));
            } else if (checkSE(['div.auth-notice__block-buttons button:textEquals("Войти")'], true)) {
                await mouseChain({
                    target: $('div.auth-notice__block-buttons button:textEquals("Войти")')[0], 
                    events: fullClick, error: 'auth'});
                await delayPromise(555);
                await waitForElement('h1.ww-dialog__title:textEquals("Авторизация")',333,5555);
                await tryToLogIn().catch(e => bsError(port, 'Error login: ' + e));
            } else {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch(e => console.log('%c' + e, 
                'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'))
            .finally(() => delayPromise(settings.authCheckInterval).then(authCheck));
    };

    const tryToLogIn = async () => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        const els = {
            user: 'input[placeholder="Введите номер телефона"]',
            password: 'input[type="password"]',
            login: 'button[type="submit"]',
        };
        await waitForCondition(() => checkSE(Object.values(els), true),
            333, 5555);
        await delayPromise(555);
        const getPhoneCode = settings.login.slice(0, 2);
        if (getPhoneCode === '+7') {
            settings.login = settings.login.replace('+7', '');
        }
        if ($(els.user).val() !== settings.login) {
            await clearAndSimulateD($(els.user)[0], settings.login);
            await delayPromise(1111);
        }
        if ($(els.password).val() !== settings.password) {
            await clearAndSimulate($(els.password)[0], settings.password);
            await delayPromise(1111);
        }
        authClicked = Date.now();
        dLog('green', 'winlinecupis', 'Auth clicked!');

        await mouseChain({target: $(els.login)[0], events: fullClick, error: 'login'});
        await delayPromise(333);
        const $error = await waitForElement('div.ww-dialog--error',333,2333).catch(() => $([]));

        if ($error.length > 0) {
            enterError = true;
        }
        return 'It looks okay!';
    };

    const getBalance = returnNull => {
        const $b = $('div.user-account__label:textEquals("Баланс:") + div.user-account__value');
        if ($b.length > 0) {
            return parseFloat($b.trt().replace(/[^\d.]/g, ''));
        } else {
            return returnNull ? 'null' : 0;
        }
    };

    const checkBalance = willPlace => {
        const balance = getBalance();
        if (balance < willPlace) {
            throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
        } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
            throw 'Undefined or NaN will place';
        }
    };

    const checkEvent = (event, eventHere) => {
        const res = eventHere === event ||
            locutus_similar_text(eventHere, event, true) > 75;
        console.log(`'${event}' ${res ? '===' : '!=='} '${eventHere}'`);
        return res;
    };

    const findEvent = async (event) => {
        let $evt = $([]);
        
        const $events = await waitForElement('div.ww-feature-sport-list div.body-left__names',
            250, 5000, true);
        $events.each(function () {
            const $teams = $(this).find('div.name');
            const eventHere = `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}`;
            if (checkEvent(event, eventHere)) {
                $evt = $(this);
                return false;
            }
        });
        if ($evt.length === 0) {
            return false;
        } else {
            await mouseChain({
                target: $evt.closest('a')[0],
                events: fullClick, error: 'findEvent'
            });
        }
        return true;
    };

    const goToLive = async () => {
        const $liveLink = $('a.header-menu__link:textEquals("Live сейчас")');
        if ($liveLink.hasClass('header-menu__link--active') === false
            || $('div.ww-feature-sport-list div.body-left__names:visible').length === 0
        ) {
            await mouseChain({
                target: $liveLink[0],
                events: fullClick, error: '$liveLink'
            });
            await delayPromise(333);
        }

        return true;
    };

    const goToSport = async (sport) => {
        const liveLinks = {
            'FOOTBALL': 'live/sport/futbol',
            'HOCKEY': 'live/sport/xokkej',
        }
        const accordance = {
            'FOOTBALL': 'Футбол',
            'HOCKEY': 'Хоккей',
            'TENNIS': 'Теннис',
        };
        if (document.location.href.indexOf(liveLinks[sport]) === -1) {
            await mouseChain({
                target: $(`a.sport-menu__list-item__link span:textEquals("${accordance[sport]}")`)[0],
                events: fullClick, error: 'sport link'
            });
            await delayPromise(250);
        }

        return true;
    };

    const openEvent = async bet => {
        const event = `${bet.team1} - ${bet.team2}`.toLowerCase();
        const checkWeAreHere = () => {
            const teams = [];
            $('div.ww-markets__stickybar div.competitors__names span')
                .each((i, el) => teams.push($(el).trt()));
            const eventHere = teams.join(' - ').toLowerCase();
            return checkEvent(event, eventHere);
        };
        if (checkWeAreHere()) {
            return;
        }
        await goToLive();
        await goToSport(bet.sport);
        const eventFound = await findEvent(event);
        if (eventFound === false) {
            throw `Event not found!`;
        }
        await waitForCondition(checkWeAreHere, 250, 10000);
    };

    const openCoupon = async data => {
        for (const bet of data) {
            await openEvent(bet);
            const $el = await getBetElement(bet);
            dLog('green', 'winlinecupis',
                `We got bet: ${$el}`);
            await mouseChain({target: $el[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(333);
        }
    };

    const getBetElement = async bet => {
        let tries = 1;
        //#-#-START
        const teams = [];
        $('div.ww-markets__stickybar div.competitors__names span')
            .each((i, el) => teams.push($(el).trt()));
        bet.team1 = bet.team1 || teams[0];
        bet.team2 = bet.team2 || teams[1];

        const markets = {
            'ONE_TWO': {
                'ONE': {
                    tab: ['Все'],
                    roots: ['Исход 1X2',],
                    pivotRoots: ['осн.время'],
                    pivotKeys: ['П1',],
                },
                'TWO': {
                    tab: ['Все'],
                    roots: ['Исход 1X2',],
                    pivotRoots: ['осн.время'],
                    pivotKeys: ['П2',],
                },
                'DRAW': {
                    tab: ['Все'],
                    roots: ['Исход 1X2',],
                    pivotRoots: ['осн.время'],
                    pivotKeys: ['X',],
                },
                'ONE_DRAW': {
                    tab: ['Все'],
                    roots: ['Двойной шанс'],
                    pivotRoots: ['осн.время'],
                    pivotKeys: ['1X',],
                },
                'TWO_DRAW': {
                    tab: ['Все'],
                    roots: ['Двойной шанс'],
                    pivotRoots: ['осн.время'],
                    pivotKeys: ['X2',],
                },
                'ONE_TWO': {
                    tab: ['Все'],
                    roots: ['Двойной шанс'],
                    pivotRoots: ['осн.время'],
                    pivotKeys: ['12',],
                }
            },
            'TOTAL': {
                'OVER': {
                    tab: ['Все'],
                    roots: ['Тотал (осн.время)',],
                    pivotKeys: ['б #PIVOT#',],
                },
                'UNDER': {
                    tab: ['Все'],
                    roots: ['Тотал (осн.время)',],
                    pivotKeys: ['м #PIVOT#',],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tab: ['Все'],
                    roots: ['Тотал (осн.время) #TEAM1#',],
                    pivotKeys: ['б #PIVOT#',],
                },
                'UNDER': {
                    tab: ['Все'],
                    roots: ['Тотал (осн.время) #TEAM1#',],
                    pivotKeys: ['м #PIVOT#',],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tab: ['Все'],
                    roots: ['Тотал (осн.время) #TEAM2#',],
                    pivotKeys: ['б #PIVOT#',],
                },
                'UNDER': {
                    tab: ['Все'],
                    roots: ['Тотал (осн.время) #TEAM2#',],
                    pivotKeys: ['м #PIVOT#',],
                },
            },
            'HDP': {
                'HOME': {
                    tab: ['Все'],
                    roots: ['Фора (осн.время)'],
                    pivotRoots: ['#TEAM1#'],
                    pivotKeys: ['#PIVOT#'],
                },
                'AWAY': {
                    tab: ['Все'],
                    roots: ['Фора (осн.время)'],
                    pivotRoots: ['#TEAM2#'],
                    pivotKeys: ['#PIVOT#'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    tab: ['Все'],
                    roots: ['Европейский гандикап (осн. время)'],
                    pivotKeys: ['П1'],
                },
                'H2': {
                    tab: ['Все'],
                    roots: ['Европейский гандикап (осн. время)'],
                    pivotKeys: ['X'],
                },
                'HX': {
                    tab: ['Все'],
                    roots: ['Европейский гандикап (осн. время)'],
                    pivotKeys: ['П2'],
                }
            },
        };

        if (typeof markets[bet.market] === 'undefined' || typeof markets[bet.market][bet.target] === 'undefined') {
            throw `Unsupported ${bet.time_value} / ${bet.market} / ${bet.target}`;
        }

        const params = new AllMarkets(bet);
        params.proceed_football = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('pivotRoots', ['1 тайм']);
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', ['1 тайм тотал']);
                } else if (bet.market === 'T1_TOTAL') {
                    this.addTotal('roots', ['1 тайм тотал #TEAM1#']);
                } else if (bet.market === 'T2_TOTAL') {
                    this.addTotal('roots', ['1 тайм тотал #TEAM2#']);
                } else if (bet.market === 'HDP') {
                    this.addTotal('roots', ['1 тайм фора']);
                }
            }
        };

        params.proceed_tennis = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('roots', [`${this.tDigit} сет`]);
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', [`${this.tDigit} сет тотал`]);
                } else if (bet.market === 'HDP') {
                    this.addTotal('roots', [`${this.tDigit} сет фора`]);
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('pivotRoots', ['матч']);
                    this.addTotal('roots', ['Исход 12']);
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', ['Тотал (матч)']);
                } else if (bet.market === 'T1_TOTAL') {
                    this.addTotal('roots', ['Тотал (матч) #TEAM1#']);
                } else if (bet.market === 'T2_TOTAL') {
                    this.addTotal('roots', ['Тотал (матч) #TEAM2#']);
                } else if (bet.market === 'HDP') {
                    this.addTotal('roots', ['Фора (матч)']);
                }
            }
        };

        params.proceed_hockey = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('pivotRoots', [`${this.tDigit} период`]);
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', [`${this.tDigit} период тотал`]);
                } else if (bet.market === 'T1_TOTAL') {
                    this.addTotal('roots', [`${this.tDigit} период тотал #TEAM1#`]);
                } else if (bet.market === 'T2_TOTAL') {
                    this.addTotal('roots', [`${this.tDigit} период тотал #TEAM2#`]);
                } else if (bet.market === 'HDP') {
                    this.addTotal('roots', [`${this.tDigit} период фора`]);
                }
            }
        };

        const final = applyAllMarkets(bet, ['tab', 'roots', 'pivotKeys', 'pivotRoots'],
            params, markets);

        const m = final[bet.market][bet.target];

        const ePivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };

        const hPivot = pvt => parseInt(pvt) > 0 ? `+${pvt}` : pvt

        replaceInner(m, {
            '#TEAM1#': bet.team1,
            '#TEAM2#': bet.team2,
            '#PIVOT#': bet.pivot,
            '#EPIVOT#': ePivot(bet.pivot),
            '#HPIVOT#': hPivot(bet.pivot),
            '#IPIVOT#': hPivot(bet.pivot * -1),
        });

        dLog('green', 'winlinecupis', ['Final market is:', m]);

        const $findPivot = $root => {
            let $res = $([]);
            if (m.pivotRoots && m.pivotRoots.length > 0) {
                for (const pRoot of m.pivotRoots) {
                    for (const pvt of m.pivotKeys) {
                        let test = `Checking pivot: '${pvt}' - `;
                        let $pivot = $root.find(`div.market-row span:textEquals("${pRoot}")`).closest('div').find(`span.row-btn__text:textEquals("${pvt}")`);
                        console.log(`${test}result: ${$pivot.length}`);
                        if ($pivot.length === 1) {
                            $res = $pivot;
                            break;
                        }
                    }
                    if ($res.length > 0) {
                        break;
                    }
                }
            } else {
                for (const pvt of m.pivotKeys) {
                    let test = `Checking pivot: '${pvt}' - `;
                    let $pivot = $root.find(`span.row-btn__text:textEquals("${pvt}")`);
                    console.log(`${test}result: ${$pivot.length}`);
                    if ($pivot.length === 1) {
                        return $pivot;
                    } else if ($pivot.length > 1) {
                        throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                    }
                }
            }
            return $res;
        };

        let $found = $([]);
        waitForElement('div.marketbook--live div.market-group', 222, 7777);
        do {
            console.log(`OUTER ${tries}!`);
            for (const tab of m.tab) {
                const $tab = await waitForElement(`div.ww-tabs__list div.ww-tabs__item:textEquals("${tab}")`,
                    50, 777).catch(() => $([]));
                if ($tab.length > 1) {
                    if ($tab.hasClass('ww-tabs__item--active') === false) {
                        await mouseChain({target: $tab[0], events: fullClick, error: '$tab'});
                        await delayPromise(1222);
                    }
                }
                for (const root of m.roots) {
                    console.log(`Checking root: ${root}`);
                    const $root = () => $(`h5.market-title:textEquals("${root}")`);
                    if ($root().length === 0) {
                        continue;
                    }
                    $root()[0].scrollIntoView();
                    window.scrollBy(0, -200);
                    const $marketBox = $root().closest('div.market');
                    // Open if necessary
                    if ($marketBox.hasClass('--collapsed') === 'true') {
                        await mouseChain({
                            target: $root()[0],
                            events: fullClick, error: 'collapse', scroll: true
                        });
                        await delayPromise(1000);
                    }
                    $found = $findPivot($marketBox);
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
            } else {
                tries++;
                await delayPromise(1555);
            }
        } while (tries <= 3);
        return $found;
        //#-#-FINISH
    };

    const closePrevious = async () => {
        const $rb = $('div.ww-coupon__btn-clear');
        if ($rb.length > 0) {
            await mouseChain({target: $rb[0], events: fullClick, error: '$rb'});
        }
        await delayPromise(222);
    };

    const checkSuccess = async () => {
        const $status = await waitForElement('div.ww-dialog__wrapper h1', 250, 40000,).catch(e => $([]));
        if ($status.length > 0) {
            if ($status.trt() !== 'Купон принят') {
                throw $status.trt();
            }
            return true;
        }
        throw 'bet is not clicked!';
    };

    const proceedBet = async (data, command) => {
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
            const checkRes = await eventsWorkAll('Winlinecupis',
                settings.eventMaxBets, settings.eventTimeLimit,
                currentBetData.data, false, true);
            if (checkRes !== 'OK') {
                dLog('red', 'WINLINE.CUPIS', `We got errors: ${checkRes}`);
                throw checkRes;
            } else {
                dLog('big-blue', 'WINLINE.CUPIS',
                    `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                for (const d of currentBetData.data) {
                    const eventName = `${d.team1} - ${d.team2}`;
                    dLog('blue', 'WINLINE.CUPIS', `${settings.eventMaxBets} for ${eventName} not reached`);
                }
            }
        }
        await closePrevious();
        let willPlace = parseFloat(data[0].stake);
        if (!willPlace) {
            throw`Bad will place: ${willPlace}, ${data[0].stake}`;
        }
        await waitForCondition(() => !!getBalance(true), 50, 1000)
            .catch(() => `Balance still zero :(`);
        checkBalance(willPlace);
        await openCoupon(data);
        do {
            await checkCoefs(data);
            checkBalance(willPlace);
            const place = willPlace.toString().replace('.00', '').trim();
            dLog('green', 'winlinecupis', `Will place (performBet): ${place}, balance: ${getBalance()}`);
            const $input = () => $('input[placeholder="Ставка"]');
            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            if (parseFloat($input().val()) !== parseFloat(place)) {
                await clearAndSimulate($('input[placeholder="Ставка"]')[0], place);
                await delayPromise(300);
            }
            const $pb = $('div.btn__rowOne:textEquals("Заключить пари")');
            if ($pb.length !== 1) {
                throw 'No place button or its not active!';
            } else {
                await mouseChain({target: $pb[0], events: fullClick, error: '$pb'});
                dLog('green', 'winlinecupis', `Place bet clicked!`);
            }
        } while (!await checkSuccess());
        await delayPromise(1000);
        await mouseChain({
            target: $('div.ww-dialog__actions button.ww-btn:textEquals("ОК")')[0], 
            events: fullClick, error: 'BA'});
        await delayPromise(1222);
        return await collectBetResult();
    };

    const collectBetResult = async () => {
        if ($('div.ww-coupon-header__tab span:textEquals("В игре")').closest('div').hasClass('ww-coupon-header__tab--active') === false) {
            await mouseChain({target: $('div.ww-coupon-header__tab span:textEquals("В игре")')[0], events: fullClick, error: 'play tab'});
            await delayPromise(1222);
        }
        const
            external_id = $('div.ww-mybets-item__bet-id:first').trt().replace(/[^\d.]/g, ''),
            stake = $('span.ww-mybets-list__sum_amount:first').trt(),
            coef = $('div.ww-bets-item__coeff:first').trt();
        if (!external_id) {
            throw `It looks like bet placed, but not connected!`;
        }
        dLog('green', 'winlinecupis', [`Bet placed!`]);
        return {
            success: true,
            message: {
                external_id,
                coef: parseFloat(coef),
                stake: parseFloat(stake),
                max: '7777777',
                status: 'ACCEPTED',
            },
        };
    };

    const checkCoefs = async data => {
        $('div[class^=style_multiplesContainer] div[data-test-id="Betslip-Card"]')
        const findInData = match => data.find(v =>
            locutus_similar_text(`${v.team1} - ${v.team2}`.toLowerCase(), match.toLowerCase(), true) > 75);
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $('div.ww-bets-item').each(function () {
            const disabled = $(this).find('div.ww-bets-item__disable').length > 0;
            const match = $(this).find('div.ww-bets-item__members').trt();
            let localCoef = parseFloat($(this).find('div.ww-bets-item__coeff').trt());
            console.log(`${match} - ${localCoef}`);
            let localData = findInData(match);
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if (!localData || isNaN(localCoef) || disabled) {
                errors.push(match + ' LOW_COEF - wrong match or localCoef!');
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

    const collectBetResults = async (inD, command) => {
        const collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        let gone = 0;
        await mouseChain({
            target: $('a:textEquals("Перейти в историю пари")')[0],
            events: fullClick, error: 'collectBetResults link'
        });
        await delayPromise(500);
        const $historyBets = await waitForElement('div.bet-history__list div.bet-item',
            250, 10000);
        await delayPromise(500);
        $historyBets.each(function () {
            gone++;
            const $this = $(this);
            const
                external_id = $this.find('div.bet-item__id').trt().replace(/\D/g, ''),
                $statusIco = $this.find('svg-icon.bet-item__status'),
                status = $statusIco.hasClass('bet-item__status--success') === true
                    ? 'WON'
                    : $statusIco.hasClass('bet-item__status--fail') === true
                        ? 'LOSE'
                        : 'ACCEPTED',
                stake = $this.find('div.bet-item__sum b').trt(),
                coef = $this.find('div.bet-item-line__outcome-rate').trt(),
                payout = $this.find('div.bet-item__total b').trt();
            if (!!external_id && (data.length === 0 || data.indexOf(external_id) > -1)) {
                collected.push({
                    external_id,
                    coef,
                    stake: parseFloat(stake),
                    status,
                    result: status === 'WON' ? parseFloat(payout) : '0',
                });
            }
            if (gone >= limit) {
                return false;
            }
            
        });
        dLog('green', 'winlinecupis', ['Collected', collected]);
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
            dLog(res.success ? 'green' : 'red', 'winlinecupis', `${command} result: ${res.message}`);
            this.prepareResult(command, res)
                .then(m => port.postMessage(m));
            if (!res?.success) {
                throw res?.message || 'Unknown error';
            }
            return res;
        }

        async prepareResult(command, res) {
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWorkAll('Winlinecupis',
                        settings.eventMaxBets, settings.eventTimeLimit,
                        currentBetData.data, true, true);
                    await bMess('WasSuccessStake').set(Date.now());
                    await bMess('Stake Maximums').set(0);
                }
                let balance = 0;
                await waitForCondition(() => (balance = getBalance(), balance > 0), 250, 5000)
                    .catch(() => dLog('red', 'winlinecupis',
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


                const
                    doNotSend = !!currentBetData.data[0].betFromParser && !res.success
                        && resultData.status !== 'LIMITED',
                    fBetResult = {};
                if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                    for (const g of ['external_id', 'status', 'market', 'target', 'pivot', 'coef',
                        'stake', 'maximum',]) {
                        fBetResult[g] = resultData[g];
                    }
                    fBetResult.type = 'VALUE';
                    fBetResult.mode = currentBetData.data[0].type;
                    fBetResult.bookmaker = 'WINLINE.CUPIS';
                    fBetResult.placedCoef = resultData.coef;
                    fBetResult.coef = currentBetData.data[0].coef;
                    fBetResult.source = '495' || 'oddscp';
                    fBetResult.currency = currentBetData.data[0]?.currency || 'USD';
                    fBetResult.externalId = resultData.external_id;
                    fBetResult.sport = currentBetData.data[0].sport;
                    fBetResult.timeValue = currentBetData.data[0].time_value;
                    fBetResult.league = currentBetData.data[0].league;
                    fBetResult.homeTeam = currentBetData.data[0].team1;
                    fBetResult.awayTeam = currentBetData.data[0].team2;
                    fBetResult.score = currentBetData.data[0].score;
                    fBetResult.pivot = resultData.pivot || null;
                }

                return {
                    answered: !!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED'
                        ? "F_BET" : "BET",
                    data: !!currentBetData.data[0].betFromParser ? fBetResult : resultData,
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
    }

    const messageProcessor = message => {
        dLog('green', 'winlinecupis', [`messageProcessor (${busy})`, message]);
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

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('green', 'winlinecupis', ['Command was set till unload:', ourCommand.get()]);
            bMess('winlinecupis')
                .set(ourCommand.get(), increaseDelay ? 150000 : 0);
        }
    }, true);

    const afterDOMLoaded = () => {
        bMess('winlinecupis',).check(40000, true)
            .then(currentCommand => {
                dLog('orange', 'winlinecupis',
                    [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand]);
                messageProcessor(currentCommand);
            })
            .catch(() => dLog('color: darkgray;', 'winlinecupis', 'No command!'));
        port.postMessage({m: "PAGE LOADED!"});
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

})();
