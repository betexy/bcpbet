(() => {

    'use strict';
    if (document.location.href.indexOf('winline.by') === -1) {
        window.location.replace('https://winline.by');
        return true;
    }

    const isMain = window.self === window.top;
    let limited = false;
    let authClicked = 0;
    let wasAuthCheck = false;
    let busy = false;
    let increaseDelay = false;
    let enterError = false;
    const port = isMain ? chrome.runtime.connect({name: "port_winline"})
        : {postMessage: (...args) => console.log(args)};
    let settings = {
        authCheckInterval: 2000,
        url: 'https://winlinebk10.com/now/',
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
        'FOOTBALL': 'Футбол',
        'HOCKEY': 'Хоккей',
        'TENNIS': 'Теннис',
        'CYBERSPORT': 'Киберспорт',
    };

    const accordanceID = {
        'FOOTBALL': '149',
        'HOCKEY': '102',
        'TENNIS': '167',
        'CYBERSPORT': '100248',
    };

    /**
     * Balance
     * @param returnNull - if true - return null when balance does not exists
     * @return {number}
     */
    function getBalance(returnNull) {
        const $b = $('span.login__number').eq(1);
        if ($b.length > 0) {
            return parseFloat($b.trt().replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    };

    const goLive = async () => {
        const $live = await waitForElement('a[href="/live"]', 333, 10000);
        if ($live.hasClass('router-link-active') === false) {
            await mouseChain({target: $live[0], events: fullClick, error: 'goLive'});
            await waitForElement('div.events-header__title:textEquals("Live Сейчас")',333,5555);
        }
    };

    const selectLanguage = async() => {
        await mouseChain({target: $('div.lang-control')[0], events: fullClick, error: 'lang'});
        await delayPromise(1111);
        await mouseChain({target: $('div.lang-control__item:textEquals("ru")')[0], events: fullClick, error: 'lang ru'});
        await delayPromise(1111);
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
            if ($('div.lang-control').length > 0) {
                if ($('div.lang-control > div.text-uppercase:textEquals("ru")').length === 0) {
                    await selectLanguage();
                }
            }
            if ($('form[data-t="login-form"]').length > 0) {
                wasAuthCheck = false;
                port.postMessage({m: "tech works! 2"});
                await delayPromise(1000);
                await tryToLogIn().catch(e => bsError(port, 'Error login: ' + e));
            } else if (checkSE(['div[data-t="button-login-main"]'], true)) {
                wasAuthCheck = false;
                await mouseChain({target: $('div[data-t="button-login-main"]')[0], events: fullClick, error: 'lang'});
                await delayPromise(1000);
                await waitForElement('form[data-t="login-form"]',333,5555);
                await tryToLogIn().catch(e => bsError(port, 'Error login: ' + e));
            } else {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch(e => console.log('%c' + e, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'))
            .finally(() => delayPromise(settings.authCheckInterval).then(authCheck));
    };

    const tryToLogIn = async () => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        const els = {
            user: 'input[data-t="input-phone"]',
            password: 'input[data-t="input-password"]',
            login: 'div.btn__data:textEquals("Войти")',
        };
        await waitForCondition(() => checkSE(Object.values(els), true),
            333, 10000);
        await delayPromise(1111);
        if ($(els.user).val() !== settings.login) {
            const code = $('input[data-t="input-country-phone-code"]').val().replace(/[^\d:]/g, '');
            const login = settings.login.replace(`+${code}`, '');
            await clearAndSimulate($('input[data-t="input-country-phone-code"]')[0], ' ');
            await delayPromise(1111);
            await clearAndSimulate($(els.user)[0], login);
            await delayPromise(1111);
            await clearAndSimulate($('input[data-t="input-country-phone-code"]')[0], code);
            await delayPromise(1111);
        }
        if ($(els.password).val() !== settings.password) {
            await clearAndSimulate($(els.password)[0], settings.password);
            await delayPromise(1111);
        }
        authClicked = Date.now();
        dLog('', 'winline', 'Auth clicked!');

        await mouseChain({target: $(els.login)[0], events: fullClick, error: 'login'});
        await delayPromise(333);
        const $error = await waitForElement('div[data-t="error-message"]',333,2888).catch(() => $([]));

        if ($error.length > 0) {
            enterError = true;
        }

        return "auth_clicked";
    };

    const closePreviousCoupons = async () => {
        const $coupons = $('div.coupon-clear');
        let currentCoupon = 0;
        const $dc = $('i.coupon-item__remove');
        if ($dc.length > 0) {
            await mouseChain({target: $dc[0], events: fullClick, error: 'dc'});
            await delayPromise(500);
        }
        if ($coupons.length > 0) {
            while (typeof $coupons[currentCoupon] !== 'undefined') {
                await mouseChain({target: $coupons[currentCoupon], events: ['click'], error: 'clcp'});
                await delayPromise(1000);
                currentCoupon++;
            }
            return 'We deleted all!';
        } else {
            return 'No open coupons';
        }
    };

    const searchEvent = async (searchEl, bet) => {
        const sportID = accordanceID[bet.sport];
        let $el = $([]);
        await clearAndSimulate(searchEl[0], bet.team1);
        await delayPromise(888);
        // expand sport
        await mouseChain({target: $(`div.left-menu__search-sport i[data-id="${sportID}"]`)[0], events: fullClick, error: 'sportID'});
        await delayPromise(1888);
        $el = $('div.left-menu__search-match__item div.-active + a').filter(function() {
            const eventName = $(this).trt().toLowerCase();
            const checkEvent = (bet.team1 + ' - ' + bet.team2).toLowerCase();
            return checkEvent.toLowerCase() === eventName || locutus_similar_text(checkEvent, eventName, true) > 85;
        });
        
        if ($el.length > 0) {
            await mouseChain({target: $el[0], events: fullClick});
            await delayPromise(888);
        } else {
            throw 'Event not found!';
        }

    };

    const switchToSport = async sport => {
        dLog('red', 'winlinebet', `switchToSport: ${sport}`);
        await waitForElement('div.events-sorting', 333, 10000);
        const s = accordance[sport];
        if ($('div.-all').hasClass('-active') === false) {
            await mouseChain({target: $('div.-all')[0], events: fullClick, error: '-all'});
            await delayPromise(1111);
        }
        const $sportSel = $(`div[title="${s}"]`)
        await mouseChain({
            target: $sportSel[0],
            events: fullClick,
            error: `switchToSport`,
            scroll: true
        });
        await delayPromise(2555);
    };

    const findEvent = async () => {
        if (document.location.href.indexOf('/live') === -1) {
            await goLive();
            await delayPromise(1111);
        }
        await switchToSport(data.sport);
        let lastEvents = [];
        const eventsSelector = 'a.events-item__stat__match__title';
        const getCandidates = () => $('a.events-item__stat__match__title').filter(function() {
            if ($(this).closest('div.vue-recycle-scroller__item-view').find('div').attr('data-index') > -1) {
                const eventName = $(this).trt().toLowerCase();
                const checkEvent = (data.team1 + ' - ' + data.team2).toLowerCase();
                return checkEvent.toLowerCase() === eventName || locutus_similar_text(checkEvent, eventName, true) > 85;
            }
        });
        const allChecked = () => JSON.stringify($(eventsSelector)) === JSON.stringify(lastEvents);
        while (getCandidates().length !== 1 && !allChecked()) {
            lastEvents = $(eventsSelector);
            $(eventsSelector).last()[0].scrollIntoView(true);
            await delayPromise(2000);
        }
        if (getCandidates().length === 1) {
            await mouseChain({target: getCandidates()[0], events: fullClick});
        } else {
            throw 'Event not found!';
        }
    };

    const openEvent = async data => {
        dLog('red', 'winlinebet', ['openEvent', data]);
        const eventName = `${data.team1} - ${data.team2}`.toLowerCase();
        const checkWeAreThere = function () {
            const $teams = $('div.event-header-match__title');
            const team1 = $teams.eq(0).trt();
            const team2 = $teams.eq(1).trt();
            const checkEvent = `${team1} - ${team2}`.toLowerCase();
            return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70;
        };
        const checkScore = async () => {
            if (data.score === '' || data.sport !== 'FOOTBALL'
                || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                return true;
            }
            const getScore = () => {
                return $('div.event-header-match__score__title').trt();
            };
            await waitForCondition(() => getScore() !== '',
                700, 10000, 'No score');
            dLog('orange', 'winlinebet', `Check score: ${getScore()}`);
            if (getScore() !== data.score.replace(/[^\d:]/g, '').trim()) {
                throw `SCORE_CHANGED => we need ${data.score}, we have ${getScore()}`;
            }
        };
        if (checkWeAreThere() && await checkScore()) {
            return 'We probably on event page!'
        }

        const searchEl = await waitForElement('div#searchInput input', 333, 5555).catch(() => $([]));

        if (searchEl.length > 0) {
            await searchEvent(searchEl, data);
        } else {
            await findEvent();
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
                    roots: ['1x2',],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    roots: ['1x2',],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    roots: ['1x2',],
                    pivotKeys: ['Ничья',],
                },
                'ONE_DRAW': {
                    roots: ['Двойной шанс'],
                    pivotKeys: ['#TEAM1# или Ничья',],
                },
                'TWO_DRAW': {
                    roots: ['Двойной шанс'],
                    pivotKeys: ['Ничья или #TEAM2#',],
                },
                'ONE_TWO': {
                    roots: ['Двойной шанс'],
                    pivotKeys: ['#TEAM1# или #TEAM2#',],
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['Тотал',],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    roots: ['Тотал',],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['#TEAM1# тотал',],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    roots: ['#TEAM1# тотал',],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['#TEAM2# тотал',],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    roots: ['#TEAM2# тотал',],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    roots: ['Тотал угловых',],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    roots: ['Тотал угловых',],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    roots: ['Фора'],
                    pivotKeys: ['#HPIVOT#'],
                },
                'AWAY': {
                    roots: ['Фора'],
                    pivotKeys: ['#HPIVOT#'],
                }
            },
        };

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw `Unsupported ${data.time_value} / ${data.market} / ${data.target}`;
        }

        const m = markets[data.market][data.target];
        let hdpValue = '';
        if (data.time_value.indexOf('FULL') === -1) {
            const timing = data.time_value.replace(/[^\d]/g, '').trim();

            if (data.market === 'HDP' && parseFloat(data.pivot) === 0) {
                hdpValue = 0;
                m.roots[0] = m.roots[0] + ' 0';
                m.pivotKeys[0] = data.target === 'HOME' ? '#TEAM1#' : '#TEAM2#';
            }

            if (data.sport === 'FOOTBALL') {
                m.roots[0] = '1 половина - ' + m.roots[0];
            }
            if (data.sport === 'TENNIS') {
                if (data.market === 'ONE_TWO') {
                    m.roots[0] = m.roots[0].replace('1x2', `${timing} сет - Победитель`);
                } else {
                    m.roots[0] = `${timing} сет - ${m.roots[0]}`;
                }
            }
            if (data.sport === 'HOCKEY') {
                m.roots[0] = `${timing} период - ${m.roots[0]}`;
            }
            if (data.sport === 'CYBERSPORT') {
                if (data.market === 'ONE_TWO') {
                    m.roots[0] = `${timing} карта - 1x2`;
                }
                if (['TOTAL', 'T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                    m.roots[0] = `${timing} карта - ${m.roots[0]} (вкл. ОТ)`;
                }
                if (data.market === 'HDP') {
                    m.roots[0] = `${timing} карта - ${m.roots[0]} (вкл. ОТ)`;
                }
            }
        } else {
            if (data.market === "HDP" && parseFloat(data.pivot) === 0) {
                hdpValue = 0;
                m.roots[0] = m.roots[0] + ' 0';
                m.pivotKeys[0] = data.target === 'HOME' ? '#TEAM1#' : '#TEAM2#';
            }
            if (data.sport === 'TENNIS') {
                if (data.market === 'ONE_TWO') {
                    m.roots[0] = m.roots[0].replace('1x2', 'Победитель');
                }
                if (data.market === 'HDP') {
                    m.roots[0] = m.roots[0].replace('Фора', 'Фора по геймам');
                }
                if (['TOTAL', 'T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                    m.roots[0] = m.roots[0] + ' геймов';
                }
            }
            if (data.sport === 'CYBERSPORT') {
                if (data.market === 'ONE_TWO') {
                    m.roots[0] = m.roots[0].replace('1x2', 'Победитель');
                }
                if (data.market === 'HDP') {
                    m.roots[0] = m.roots[0].replace('Фора', 'Фора по картам');
                }
                if (data.market === 'TOTAL') {
                    m.roots[0] = m.roots[0].replace('Тотал', 'Тотал по картам');
                }
            }
        }

        const hPivot = pvt => parseInt(pvt) > 0 ? `+${pvt}` : pvt;
        const coef = parseFloat(data.coef);

        replaceInner(m, {
            '#TEAM1#': data.team1,
            '#TEAM2#': data.team2,
            '#PIVOT#': data.pivot,
            '#HPIVOT#': hPivot(data.pivot),
        });
        dLog('green', 'winlinebet', ['Final market is:', m]);
        const $all = await waitForElement('div.page-tabs__item span:textEquals("Все")', 333, 15000);

        if (!$all.hasClass('-active')) {
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
                const $pivot = $root.closest('div.mg').find(`div.mg-group__item-title:textEquals("${pvt}")`);
                if ($pivot.length === 1) {
                    return $pivot.closest('div.mg-group__item').find('div.button-odds');
                } else if ($pivot.length > 1) {
                    throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                }
            }
            return $([]);
        };

        const $findTotalPivot = ($root) => {
            const indx = data.target === 'UNDER' ? 0 : 1;
            for (const pvt of m.pivotKeys) {
                const $pivot = $root.closest('div.mg').find(`div.mg-total__markets-item__cell span:textEquals("${pvt}")`);
                if ($pivot.length === 1) {
                    return $pivot.closest('div.mg-total__markets-item').find('div.button-odds').eq(indx);
                } else if ($pivot.length > 1) {
                    throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                }
            }
            return $([]);
        };

        const $findHDPCoef = ($root) => {
            const indx = data.target === 'HOME' ? '1' : '2';
            for (const pvt of m.pivotKeys) {
                const $pivot = $root.closest('div.mg').find(`div.mg-total__markets-item__cell span:nth-child(${indx}):textEquals(${pvt})`);
                if ($pivot.length === 1) {
                    return $pivot.closest('div.mg-total__markets-item').find('div.button-odds').eq(indx-1);
                } else if ($pivot.length > 1) {
                    throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                }
            }
            return $([]);
        };

        let $found = $([]);
        const $marketsList = await waitForElement('div.event-markets-list', 333, 10000);
        await delayPromise(333);
        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () => $marketsList.find(`div.mg-header__name:textEqualsIS("${root}")`);
            if ($root().length === 0) {
                continue;
            }
            if ($root().closest('div.mg-header').hasClass('-closed')) {
                await mouseChain({
                    target: $root()[0], events: fullClick, error: 'header', scroll: true
                });
                await delayPromise(1555);
            }
            $found = ['TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'CORNER_TOTAL'].indexOf(data.market) > -1 ? $findTotalPivot($root())
                : (['HDP'].indexOf(data.market) > -1 && hdpValue !== 0) ? $findHDPCoef($root()) : $findPivot($root());
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
        dLog('green', 'winlinebet', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'winlinebet', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'winlinebet', 'Event must be opened!');
            const $element = await getBetElement(data);
            console.log('$element ', $element);
            let coefWeWaitFor = $element.trt();
            dLog('green', 'winlinebet', 'We got element! Coef: ' + coefWeWaitFor);
            const waitForCouponVisibleStarted = Date.now();
            let elementWasClicked = 0;
            let performElementClick = async function () {
                dLog('green', 'winlinebet', 'performElementClick ' + elementWasClicked + ' (' + coefWeWaitFor
                    + ') /' + (Date.now() - elementWasClicked));
                await mouseChain({target: $element[0], events: fullClick, error: 'performElementClick'})
                elementWasClicked = Date.now();
            };
            const checkCoupon = () => {
                let event = (data.team1 + ' - ' + data.team2).toLowerCase();
                let result = false;
                $('div.coupon-item').each(function () {
                    let ev = $(this).find('a.coupon-item__content__player').trt().replace(/\*/g, '').trim().toLowerCase();
                    if (event === ev || locutus_similar_text(event, ev, true) > 80) {
                        result = true;
                        return false;
                    } else {
                        dLog('red', 'winlinebet', `'${ev}' !== '${event}'`);
                    }

                });
                return result;
            };
            while (!checkCoupon() && Date.now() - waitForCouponVisibleStarted < 10000) {
                await performElementClick();
                await delayPromise(2222);
            }
            if (!checkCoupon()) {
                throw `Coupon not opened!`;
            }
            const getMaxHere = async () => '777777';
            if (paramData.length > 1) {
                dLog('red', 'winlinebet', `Express here! ${i}/${(paramData.length - 1)}`);
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
            return localMatch === match.toLowerCase()
                || locutus_similar_text(localMatch, match.toLowerCase(), true) > 70;
        });
        const $coupons = $('div.coupon-item');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $(this).find('a.coupon-item__content__player').trt()
                .replace(/\*/g, '').trim().toLowerCase();
            console.log(match);
            if ($this.find('div.bets-item__disabler').length > 0) {
                errors.push(match + ' LOW_COEF, market unavailable!');
                checked++;
                return true;
            }
            let localCoef = decOdds($this.find('span.coupon-item__header__koef').trt());
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
                if ($('div.w-popup-header div:textEquals("Ставка принята")').length > 0) {
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
            // Hint: Try to perform bet
            await checkCoefs(data);
            let willPlace = parseFloat(data[0].stake);
            if (currentBetData.max !== -1 && willPlace > currentBetData.max) {
                willPlace = currentBetData.max;
            }
            checkBalance(willPlace);
            dLog('green', 'winlinebet', `Will place (performBet): ${willPlace}`);
            /**
             * @returns {JQuery<HTMLElement>}
             */
            const $input = () => $('input.coupon-select__field');
            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input().length}`;
            }
            await mouseChain({target: $input()[0], events: fullClick, error: 'l1'});
            await clearAndSimulate($input()[0], willPlace.toString().replace('.00', '').trim());
            await delayPromise(888);
            dLog('green', 'winlinebet', `STAKE entered ${willPlace}`);
            let entered = parseFloat($input().val());
            dLog('green', 'winlinebet',
                `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'winlinebet', 'Entered !== willPlace - try to reenter!');
                continue;
            }
            await delayPromise(222);
            const $placeBtn = $('div.aside-footer__area-button div.btn');
            if ($placeBtn.length === 0 || $placeBtn.hasClass('-disabled')) {
                throw 'No place button or button disabled!';
            }
            await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
        } while (!await checkSuccess());
        await delayPromise(777);
        //close succes popup
        await mouseChain({target: $('div.w-popup-buttons__success')[0], events: fullClick, error: 'bet success'});
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
        const $privateCab = await waitForElement('a.navigation__item-link:textEquals("Личный кабинет")', 333, 10000);
        await delayPromise(333);
        await mouseChain({target: $privateCab[0], events: fullClick, error: 'privateCab'});
        await delayPromise(333);
        const $historyLink = await waitForElement('a.private-menu__subitem:textEquals("История ставок")', 333, 18000);
        await mouseChain({target: $historyLink[0], events: fullClick, error: '$historyLink'});
        await delayPromise(555);
        const $historyData = await waitForElement('div.private-bets tr.-select:first', 333, 18000);
        await delayPromise(555);

        collected.external_id = $historyData.find('div.number').trt().replace(/[^\d.]/g, '').trim();
        collected.coef = $historyData.find('td.private-table__koef').trt();
        collected.stake = $historyData.find('div.private-table__count__redeem strong').trt().replace(/[^\d.]/g, '').trim();

        return collected;
    };

    const collectBetResults = async (inD, command) => {
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        dLog('', 'winlinebet', [`collectBetResults, limit: ${limit}, data:`, data]);
        const collected = [];
        const $privateCab = await waitForElement('a.navigation__item-link:textEquals("Личный кабинет")', 333, 10000);
        await delayPromise(333);
        await mouseChain({target: $privateCab[0], events: fullClick, error: 'privateCab'});
        await delayPromise(333);
        const $historyLink = await waitForElement('a.private-menu__subitem:textEquals("История ставок")', 333, 10000);
        await mouseChain({target: $historyLink[0], events: fullClick, error: '$historyLink'});
        await delayPromise(333);
        const $historyData = await waitForElement('div.private-bets tr.-select', 333, 10000);

        await $historyData.eachAsync(async function (idx) {
            idx++;
            const $this = $(this);
            const status = $this.find('td.private-table__status').hasClass('-live') === true ? 'ACCEPTED'
                : $this.find('td.private-table__result div').hasClass('-win') === true ? 'WON'
                    : 'LOSE';
            const statusVal = parseFloat($this.find('td.private-table__result div._wrapper').trt().replace(/[^\d.]/g, '').trim());
            const stake = $this.find('div.private-table__count__redeem strong').trt().replace(/[^\d.]/g, '').trim();
            const bet = {
                external_id: $this.find('div.number').trt().replace(/[^\d.]/g, '').trim(),
                status: status,
                coef: $this.find('td.private-table__koef').trt(),
                stake,
                result: status !== 'ACCEPTED' ? status === 'WON' ? parseFloat(stake) + statusVal : parseFloat(stake) - statusVal : '',
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
            dLog(res.success ? 'green' : 'red', 'winlinebet', `${command} result: ${res.message}`);
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
                .catch(e => dLog('red', 'winlinebet', `Error till execute: ${e}`))
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
            const command = await bMess('WINLINEBET').check(40000);
            await waitForCondition(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck), 333, 60000, 'No auth check!');
            bsLogger('green', 'winlinebet', [`Restoring with (${isMain}): `, command]);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));
        port.postMessage({m: "PAGE LOADED!"});
        console.log('%c' + `WINLINEBET loaded and message sent! (${isMain}) ${document.location.href}`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", async () => {
        await ourCommand.save('WINLINEBET', increaseDelay ? 150000 : 0);
        bsLogger('green', 'winlinebet', [`Command was set till unload (${isMain}):`, ourCommand.get()]);
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

})();
