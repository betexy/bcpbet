(() => {
    'use strict';

    const isMain = window.self === window.top;

    let limited = false;
    let authClicked = 0;
    let authClickedTime = 0;
    let wasAuthCheck = false;
    let busy = false;
    let waitSource = false;
    let increaseDelay = false;
    let enterError = false;
    let sourceExpress = false;
    let loaded = Date.now();

    const balance = 'span.account-select-toggle__value';
    const port = isMain ? chrome.runtime.connect({name: 'port_onexbet'})
        : {postMessage: (...args) => console.log(args)};
    const settings = {
        restartEvery: 1800000,
        authCheckInterval: 2000,
        url: 'https://1xlite-5227452.bar/',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        maxWaitForScore: 60000,
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
        eventMaxBets: 3,
        betweenBets: 25000,
        hostname: document.location.hostname,
        newExpresses: false,
        source: {
            X: 381,
            Y: 382,
            Z: 383,
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
            this.data = data;
            this.max = 0;
            this.external_id = '';
            this.willPlace = 0;
        }
    };

    const $coupons = () => $('li.coupon-bet');

    const getSourceRandom = () => {
        return Math.floor(Math.random() * 30) + 1;
    };

    const getCurrentSource = src => {
        sourceExpress = false;

        if (src >= 1 && src <= 10) {
            return 'X';
        }
        if (src >= 11 && src <= 16) {
            return 'Y';
        }
        if (src === 17) {
            sourceExpress = true;
            return 'XY';
        }
        if (src === 18) {
            return 'XY';
        }
        if (src >= 19 && src <= 20) {
            return 'Z';
        }

        return 'skip';
    };

    function getBalance(returnNull) {
        return $(balance).length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($(balance).trt().replace(/[^\d.]/g, ''));
    };

    const authCheck = () => {
        // if (!busy && Date.now() - loaded > settings.restartEvery) {
        //     dLog('bigred', '1XBET', 'RELOAD 1');
        //     window.location.reload();
        // }
        (async () => {
            return;
            if (enterError === true) {
                return;
            }
            await closeAllWeNeed({
                'div[data-id="NOTIFICATION_WEB_PUSH_AGREE"] span:textEquals("Блокировать")':
                'div[data-id="NOTIFICATION_WEB_PUSH_AGREE"] span:textEquals("Блокировать")',
            });
            const $balance = await waitForElement(balance, 222, 7777).catch(() => $([]));
            if (!limited && $balance.length === 0) {
                wasAuthCheck = false;
                port.postMessage({m: "tech works! 2"});
                await tryToLogin();
            } else {
                if (settings.lastScoreBasketball === '999') {
                    if (Date.now() - settings.sourceDate >= 300000) {
                        settings.sourceDate = Date.now();
                        settings.sourceRandom = getSourceRandom();
                        if (settings.sourceRandom >= 17 && settings.sourceRandom <= 17) {
                            settings.newExpresses = true;
                            if (settings.sourceRandom >= 18 && settings.sourceRandom <= 18) {
                                settings.newExpressBetsAmount = 1;
                            }
                        } else {
                            waitSource = false;
                            settings.newExpresses = false;
                        }

                        dLog('blue', '1XBET', `Source current random value - ${settings.sourceRandom}`);
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
                        dLog('green', '1XBET', 'START find NewExpress event!');
                        // clear coupons
                        if ($coupons().length > 0) {
                            await closePreviousCoupons(false);
                        }

                        waitSource = false;
                        await ProccedExpressNew().catch((e) => {
                            dLog('red', '1XBET', 'ProccedExpressNew Error - ' + e);
                            bMess('WasSuccessExpressNew').set(false);
                        });                        
                    }
                    busy = false;
                }

                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                    limited: limited
                });
            }
        })()
            .catch(e => dLog('red', '1XBET', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    const tryToLogin = async () => {
        if (Date.now() - authClickedTime < 60000) {
            throw 'too soon!';
        }

        const loginForm = 'div.auth-form';
        const $loginLink = () => $(findSel(['button.auth-dropdown-trigger:textEquals("Вход")', 'button.auth-dropdown-trigger:textEquals("Log in")']));

        if ($(loginForm).length === 0) {
            await mouseChain({target: $loginLink()[0], events: fullClick, error: 'Log in'});
            await delayPromise(333);
        }

        await waitForCondition(() => $(loginForm).length > 0,
            333, 10000, 'No login form');
        await clearAndInputEmail($(loginForm).find('input#username')[0],
            settings.login);
        await delayPromise(777);
        await clearAndSimulate($(loginForm).find('input#username-password')[0],
            settings.password);
        await delayPromise(777);
        if (!$(loginForm).find('input.selection__input').is(":checked")) {
            await mouseChain({
                target: $(loginForm).find('input.selection__input')[0],
                events: fullClick,
                error: 'selection'
            });
        }
        await delayPromise(777);
        await mouseChain({
            target: $(loginForm).find('button[type="submit"]')[0],
            events: fullClick,
            error: 'submit form'
        });
        await delayPromise(555);
        const $balance = await waitForElement(balance,
            333, 27000).catch(() => $([]));
        await delayPromise(333);
        authClicked++;
        authClickedTime = Date.now();
        dLog('green', '1XBET', `Auth clicked ${authClicked}!`);
        if ($balance.length === 0) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            enterError = true;
            limited = true;
            throw 'AUTH ERROR!';
        }
    };

    const closePreviousCoupons = async (state) => {
        const $closeCoupon = $('button.coupon-delete-bets');
        const $closeBtns = () => $('button.coupon-bet-remove');
        if ($closeCoupon.length > 0) {
            if (state) {
                for (let i=0; i<$closeBtns().length; i++) {
                    if ($closeBtns().length > settings.newExpressBetsAmount) {
                        await mouseChain({target: $closeBtns().last()[0], events: fullClick, error: 'closeCoupon'});
                        await delayPromise(555);
                    }
                }
            } else {
                await mouseChain({target: $closeCoupon[0], events: fullClick, error: '$closeCoupon'});
                await delayPromise(555);
            }
        }
    };

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 75;
        dLog('green', '1XBET', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const openEvent = async data => {
        dLog('red', '1XBET', ['openEvent', data]);
        let $el = $([]);
        const inputSearch = 'input.games-search-modal__input';
        const events = 'li.games-search-modal-results-list__item';
        const eventName = `${data.team1.replaceAll(/\(.*\)/g, '').trim()} - ${data.team2.replaceAll(/\(.*\)/g, '').trim()}`;

        const checkWeAreThere = function () {
            const $teams = data.type === 'LIVE'
                ? $('a.scoreboard-team-name__link, span.scoreboard-team-name__text')
                : $('span.scoreboard-team-name__text');
            const team1 = $teams.eq(0).trt();
            const team2 = $teams.eq(1).trt();
            const checkEvent = `${team1} - ${team2}`;
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };

        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }

        const findEvent = async () => {
            const $searchBtn = () => $(
                findSel(['div.games-search-modal__dropdown button[aria-label="Искать"]'
                    , 'div.games-search-modal__dropdown button[aria-label="Search"]'])
            );
            if ($(inputSearch).length === 0) {
                await mouseChain({target: $('button.games-search-app-search__button')[0], events: fullClick, error: '$searchButton', scroll: true,});
                await waitForCondition(() => $(inputSearch).length > 0,
                    333, 5555, 'Search input is not available!');
            }

            await delayPromise(777);
            await clearAndSimulate($(inputSearch)[0], eventName);

            await mouseChain({
                target: $searchBtn()[0], 
                events: fullClick, error: 'Search button',
            });
            await waitForCondition(() => $(events).length > 0,
                333, 5555, 'Events list is not available!');
            await delayPromise(555);
            $(events).each(function () {
                const checkEvent = $(this).find('span.games-search-modal-card-info__main').trt();
                dLog('blue', '1XBET', `Check: '${checkEvent}' === '${eventName}'`);
                if (checkEventName(checkEvent, eventName)) {
                    $el = $(this).find('a');
                    return false;
                }
            });
        };

        await findEvent();

        if ($el.length === 0) {
            throw 'Event not found!';
        }

        // go to event page
        await mouseChain({target: $el[0], events: fullClick, error: 'EVENT', scroll: true,});
        await waitForCondition(checkWeAreThere,
            333, 10000, 'We are not on event!');
        await delayPromise(222);

        return 'Switched to event!';
    };

    const openCoupon = async paramData => {
        dLog('green', '1XBET', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', '1XBET', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', '1XBET', 'Event must be opened!');
            //const $element = await getBetElement(data);
            //await mouseChain({target: $element[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(333);
        }
    };

    const getBetElement = async betIn => {
        return $([]);
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => checkEventName(v.team1.toLowerCase()
            + ' - ' + v.team2.toLowerCase(), match));
        await waitForCondition(() => $coupons().length > 0,
            333, 10000, 'No coupons!');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        const $couponsCoefs = (data.length === 1 && settings.newExpresses === true)
            ? $coupons().last()
            : $coupons();
        $couponsCoefs.each(function () {
            const $this = $(this);
            const match = $this.find('span.ui-coupon-bet-teams__name').eq(0).trt() + ' - ' +
                $this.find('span.ui-coupon-bet-teams__name').eq(1).trt();
            let localCoef = $this.find('span.ui-coupon-coef__value').trt();
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

    const ProccedExpressNew = async () => {
        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));
        const $lineFootball = () => 
            $(findSel(['a.menu-sport-list__link[href="/ru/line/football"]', 'a.menu-sport-list__link[href="/en/line/football"]']));
        const sports = () => 
            $(findSel(['a.header-navigation-section-link[href="/ru/line"]', 'a.header-navigation-section-link[href="/en/line"]']));
        const currentBets = [];
        const $coefs = () => $('span.dashboard-markets__market button.ui-market__toggle');

        // go to LINE
        await mouseChain({target: sports()[0], events: fullClick, error: 'LINE'});
        await waitForElement($lineFootball(), 222, 5555);
        await mouseChain({target: $lineFootball()[0], events: fullClick, error: 'LINE FOOTBALL'});
        await delayPromise(1222);
        await waitForCondition(() => $coefs().length > 0, 300, 9999, 'No coefs!');

        const findOption = coef => {
            return isNaN(coef) ? false : coef >= 1.01 && coef <= 1.15;
        };

        const getUniqueRandomNumber = (length) => {
            return Math.floor(Math.random() * length);
        }

        do {
            const randomCoef = getUniqueRandomNumber($coefs().length);
            const eventName = $coefs().eq(randomCoef)
                .closest('li.dashboard-game')
                .find('span.dashboard-game-team-info__name').toArray()
                .map(el => $(el).trt()).join(' - ');

            if (currentBets.indexOf(eventName) > -1) {
                continue;
            }

            if (eventName.length < 5) {
                dLog('red', '1XBET', `'${eventName}' is too short - ${eventName.length}`);
                continue;
            }

            if (used[eventName] >= 1) {
                dLog('big-yellow', '1XBET', `${eventName} used ${used[eventName]} times!`);
                continue;
            }

            if (
                $coefs().eq(randomCoef)
                .parent().hasClass('ui-market--toggled')
            ) {
                continue;
            }

            if (!findOption(parseFloat($coefs().eq(randomCoef).trt()))) {
                continue;
            }

            currentBets.push(eventName);
            await mouseChain({target: $coefs().eq(randomCoef)[0], events: ['click'], error: 'NE EVENT'});
            await delayPromise(2555);
        } while ($coupons().length < settings.newExpressBetsAmount);

        // check 2 events
        if ($coupons().length === settings.newExpressBetsAmount 
            && currentBets.length === settings.newExpressBetsAmount
        ) {
            dLog('green', '1XBET', [`We get selected bets: '${currentBets}', now used:`, used]);
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
        if (command === 'BET' && !!currentBetData.data[0].betFromParser) {
            const eventName = `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`;
            if (!await eventsWork('1XBET', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', '1XBET',
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

        let willPlace = parseFloat(data[0].stake);

        const checkSuccess = async () => {
            const successText = () => 
                $(findSel([
                    'div.ui-coupon-modal-header__title:textEquals("Ваша ставка принята!")', 
                    'div.ui-coupon-modal-header__title:textEquals("Bet accepted!")'
                ]));
            // Please wait while your bet is placed
            await waitForCondition(() => 
                $(successText).length > 0,
                333, 45000, 'No success!'
            );
            return $(successText).length === 0;
        };
        const checkBalance = async willPlace => {
            const balance = getBalance();
            if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };

        if (!willPlace) {
            throw`Bad will place: ${willPlace}, ${data[0].stake}`;
        }

        await checkBalance(willPlace);
        await closePreviousCoupons(settings.newExpresses ? true : false);
        await delayPromise(555);

        //if sourceExpress check coupon for events
        if (sourceExpress && settings.lastScoreBasketball === '999') {
            if ($coupons().length !== 1) {
                throw 'Error Express source BET, No 1 event in coupon!';
            }
        }

        await openCoupon(data);

        if (settings.newExpresses && $coupons().length < settings.newExpressBetsAmount + 1) {
            throw `less than ${settings.newExpressBetsAmount + 1} events in the newExpresses`;
        }

        do {
            await checkCoefs(data);
            const place = willPlace.toString().replace('.00', '').trim();
            const $input = () => $('input.ui-number-input__field');
            dLog('green', '1XBET', `Will place (performBet): ${place}`);

            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }

            if (parseFloat($input().val()) !== parseFloat(place)) {
                await clearAndInputNumber($input()[0], place);
                await delayPromise(555);
                dLog('green', '1XBET', `STAKE entered ${willPlace}`);
            }

            const entered = parseFloat($input().val());
            dLog('green', '1XBET', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', '1XBET', 'Entered !== willPlace - try to reenter!');
                continue;
            }

            const $placeBtn = $(findSel(['button:textEquals("Сделать ставку")', 'button:textEquals("Place a bet")']));

            if ($placeBtn.length === 0) {
                throw 'No place button or button disabled!';
            }

            await mouseChain({target: $placeBtn[0], events: fullClick, error: '$placeBtn'});
            await delayPromise(333);
        } while (!await checkSuccess());

        await delayPromise(555);

        const response = {
            success: true,
            message: {
                external_id: $('div.ui-coupon-modal-header__info').trt().replace(/[^\d.]/g, ''),
                coef: $('span.ui-coupon-modal-params-item__value:eq(0)').trt(),
                stake: $('span.ui-coupon-modal-params-item__value:eq(2)').trt().replace(/[^\d.]/g, ''),
                max: '7777777',
            },
        };

        const $successBtn = $(findSel([
            'button.coupon-success-modal-controls__item:textEquals("Ок")', 
            'button.coupon-success-modal-controls__item:textEquals("Ok")'
        ]));
        await mouseChain({target: $successBtn[0], events: fullClick, error: 'SuccessBtn'});

        return response;
    };

    const commands = new class commands {
        constructor() {
            this.cLinks = {
                'BET': proceedBet,
                'EXPRESS_BET': proceedBet,
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
            dLog(res.success ? 'green' : 'red', '1XBET',
                `${command} result: ${res.message}`);
            await port.postMessage(await this.prepareResult(command, res));
            if (!res?.success) {
                throw res?.message || 'Unknown error';
            }
            return res;
        }

        async prepareResult(command, res) {
            dLog('', '1XBET', [`prepareResult '${command}':`, res, currentBetData,]);
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('1xBet', settings,
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

                        dLog('1XBET', 'blue-big',
                            [`We set bet with first: '${currentFirstBet}', now used:`, used]);

                        if (settings.newExpressBetsAmount > 1) {
                            const currentSecondBet = await bMess('currentSecondBet').check(1080000, true);
                            if (!used[currentSecondBet]) {
                                used[currentSecondBet] = 1;
                            }

                            dLog('1XBET', 'blue-big',
                            [`We set bet with second: '${currentSecondBet}', now used:`, used]);
                        }

                        await bMess('usedEvents').set(used);
                    }
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
                    resultData.bookmaker = '1XBET';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = '381' || 'oddscp';
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
            } else {
                return {};
            }
        }
    };

    const messageProcessor = (message, direct) => {
        console.log('%c' + `${(direct ? 'Direct' : 'Saved')} : messageProcessor (${busy}) %O`,
            `background: ${(direct ? 'green' : 'yellow')}; color: ${(direct ? 'white' : 'black')}; font-size: 12px; font-weight: bold; padding: 3px;`,
            message);
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        }
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
            settings.fork = message.fork;
            settings.forkOnly = typeof message.fork === 'object' && Object.keys(message.fork).length > 0;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            settings.lastScoreBasketball = message?.stake_fork?.lastScoreBasketball || '';
            settings.newExpresses = !!(settings?.stake_fork && settings.stake_fork?.newExpresses);
            settings.newExpressBetsAmount = Number(message?.stake_fork?.newExpressBetsAmount) || 2;
            ['login', 'password', 'phone', 'email', 'uid',].forEach(k => settings[k] = message[k]);
            if (message.start_url) {
                settings.url = message.start_url;
            }
            if (settings.lastScoreBasketball === '999') {
                settings.sourceDate = Date.now();
                settings.sourceRandom = getSourceRandom();

                if (settings.sourceRandom >= 17 && settings.sourceRandom <= 18) {
                    settings.newExpresses = true;
                    waitSource = true;
                    if (settings.sourceRandom >= 17 && settings.sourceRandom <= 18) {
                        settings.newExpressBetsAmount = 1;
                    }
                } else {
                    waitSource = false;
                }
                dLog('blue', '1XBET', `Source current random value - ${settings.sourceRandom}`);
            }
            dLog(`yellow`, '1XBET', [`messageProcessor auth settings:`, settings,]);
            authCheck();
            wasAuthCheck = true;
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
                commands.execute(message.action, message.data)
                    .finally(() => {
                        busy = false;
                        ourCommand.clear();
                    });
            }
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
            const command = await bMess('ONEXBET_COMMAND').check(40000);
            await waitForCondition(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck), 333, 60000, 'No auth check!');
            bsLogger('green', '1XBET', [`Restoring with (${isMain}): `, command]);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));
        port.postMessage({m: "PAGE LOADED!"});
        console.log('%c' + `1XBET loaded and message sent! (${isMain}) ${document.location.href}`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", async () => {
        await ourCommand.save('ONEXBET_COMMAND', increaseDelay ? 150000 : 0);
        bsLogger('green', '1XBET', [`Command was set till unload (${isMain}):`, ourCommand.get()]);
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

})();
