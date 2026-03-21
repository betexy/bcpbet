(function () {

    "use strict";

    if (window.self !== window.top) {
        return;
    }

    let enterError = false;
    let newAPI = false;
    let authClicked = 0;
    let busy = false;
    const bkHere = 'onexbetmobile';
    let port = chrome.runtime.connect({name: `port_${bkHere}`});
    let settings = {
        checkFootball: false,
        waitForFootbalInterval: 60000,
        authCheckInterval: 2000,
        alwaysClosePreviousCoupon: false,
        delayGetMax: 990,
        maxWaitForBetStatus: 50000,
        stake_fork: {},
        eventTimeLimit: 2400000,
        eventMaxBets: 3,
        betweenBets: 25000,
    };
    let currentBetData = {};
    let ourCommand = new ourCommandProto();
    let smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);
    const loginStr = 'a[href="/en/user/login"]';
    const balance = 'div.balance:visible';
    const menuLink = 'nav.bottom-navigation__wrapper li:last span.bottom-navigation-link-container__caption';

    let messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;
        if (newAPI) {
            bsLogger('blue', 'onexbetmobile', 'We are using new API!');
        }
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        }
        if (message.action === 'MAXIMUM' && message.data[0].fork && busy) {
            waitForCondition(() => !busy, 200, 30000, 'Still busy!')
                .then(() => messageProcessor(message))
                .catch(e => chrome.runtime.sendMessage({
                    loggerName: 'textLogger',
                    params: {data: `fon MAXIMUM ${e} for ` + JSON.stringify(message)}
                }));
            return;
        }

        if (message.action === 'SMS_API' && message.data) {
            smsApiMessage.setMessage(message.data.status, message.data.message);
        } else if (message.action !== 'auth' && busy) {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY"
            });
        } else if (message.action === "auth") {
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.phone = message.phone;
            settings.uid = message.uid;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 2400000;
            settings.betweenBets = message.betweenBets || 40000;
            authCheck();
        } else if (message.action === "check_balance") {
            let $balances = $('span.header__login-balance');
            if ($balances.length > 0) {
                port.postMessage({
                    answered: "check_balance",
                    status: "success",
                    answer: getBalance()
                });
            }
        } else if (message.action === 'BET') {
            ourCommand.set(message);
            busy = true;
            proceedBet(message.data, 'BET');
        } else if (message.action === 'EXPRESS_BET') {
            ourCommand.set(message);
            busy = true;
            proceedBet(message.data, 'EXPRESS_BET');
        }
    };

    const checkCoupon = async (data, $cell) => {
        dLog('green', 'onexbetmobile', [`checkCoupon - let's check data:`, data]);
        let totalCoef = 1;
        const errors = [];

        const localCoef = parseFloat($cell.next().trt());
        totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
        if (!newAPI && data.coef !== '' && !isNaN(localCoef)) {
            let checkCoef = parseFloat(data.coef);
            if (isNaN(checkCoef) || checkCoef > localCoef) {
                errors.push('LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef);
            } else if (localCoef > checkCoef * 1.6) {
                errors.push('Coef TOO BIG: ' + totalCoef + ' instead of ' + checkCoef);
            }
        } else if (isNaN(localCoef)) {
            errors.push('LOW_COEF - wrong localCoef');
            console.log('localCoef ', localCoef);
        }

        if (!newAPI && errors.length === 0) {
            return 'Coefs fine!';
        } else if (newAPI && errors.length === 0) {
            const nCheck = data.coef && !isNaN(parseFloat(data.coef)) ? parseFloat(data.coef) : totalCoef / 1.21;
            if (totalCoef >= nCheck * 1.6) {
                throw 'Coef TOO BIG: ' + totalCoef + ' instead of ' + data.coef;
            } else if (totalCoef < nCheck) {
                throw 'LOW_COEF ' + data.coef + ' > ' + totalCoef;
            } else {
                return 'Coefs fine!';
            }
        } else {
            throw errors.join('; ') + ' some stakes not checked';
        }
    };

    const closePreviousCoupon = async (state) => {
        const started = Date.now();
        const $closeBtns = () => $('ul.quick-coupon-events__cards button[aria-label="Delete"]');
        const lengthBets = $closeBtns().length;
        
        if ($('ul.quick-coupon-events__cards').length > 0) {
            if (state) {
                for (let i=0; i<lengthBets; i++) {
                    if (lengthBets > settings.newExpressBetsAmount) {
                        await mouseChain({target: $closeBtns().last()[0], events: fullClick, error: 'closeCouponLast'});
                        await delayPromise(555);
                    }
                }
            } else {
                for (let i=0; i<lengthBets; i++) {
                    await mouseChain({target: $closeBtns()[0], events: fullClick, error: 'closeCoupon'});
                    await delayPromise(555);
                }
            }
        }

        dLog('', 'onexbetmobile', `closePreviousCoupon'd finished in the ${(Date.now() - started)} ms!`);
    };

    const goHome = async () => {
        await mouseChain({target: $('a.header-logo')[0], events: fullClick, error: 'goHome'});
    };

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 90;
        dLog('green', 'onexbetmobile', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const searchEventFill = async bet => {
        const eventName = bet.home + ' - ' + bet.away;
        const searchInpt = 'input.search-app-head__search';
        const searchBtn = 'a[aria-label="Search"]';
        const matchTypeLabel = bet.type === 'LIVE' ? 'Live' : 'Sports';
        const events = 'ul.ui-game-card-scoreboard-teams';
        let $event = $([]);

        const checkWeAreThere = function () {
            const
                $teams = $('span.scoreboard-intro__team'),
                team1 = $teams.eq(0).trt(),
                team2 = $teams.eq(1).trt(),
                checkEvent = `${team1} - ${team2}`;
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };

        if (checkWeAreThere() === true) {
            return 'Switched to event!';
        }

        if ($(searchInpt).length === 0) {
            // check search button exist
            if ($(searchBtn).length === 0) {
                await goHome();
            }

            await waitForElement(searchBtn, 222, 8888);
            await mouseChain({
                target: $(searchBtn)[0], 
                events: fullClick, 
                error: 'searchBtn'
            });
        }

        await waitForElement(searchInpt, 222, 8888);
        await delayPromise(555);
        // select 'exact match' if needed
        if (!$('span.selection-ico-tumbler').hasClass('selection-ico-tumbler--checked')) {
            await mouseChain({target: $('span.selection-ico-tumbler')[0], events: fullClick, error: 'Exact match'});
        }
        await delayPromise(333);
        await clearAndSimulate($(searchInpt)[0], eventName);
         // wait for match type switcher
        await waitForElement('ul.search-app-head__switches', 222, 7777);
        // select match type
        await mouseChain({target: $(`li.ui-switches-item:textEquals("${matchTypeLabel}") label > span`)[0], events: fullClick, error: 'matchTypeLabel'});
        await delayPromise(333);
        const $events = await waitForElement(events, 222, 5555).catch(() => $([]));
        await delayPromise(333);

        await $events.eachAsync(async function () {
            const $teams = $(this).find('span.ui-game-card-scoreboard-teams-name__caption');

            if ($teams.length === 2) {
                const checkEvent = `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}`;
                if (checkEventName(checkEvent, eventName)) {
                    $event = $(this);
                    return false;
                }
            }
        });

        if ($event.length === 0) {
            throw 'Event not found!';
        }

        // go to event page
        await mouseChain({target: $event[0], events: fullClick, error: '$event'});
        await delayPromise(333);
        await waitForCondition(checkWeAreThere,
            500, 12222, 'We are not on event!');
        await delayPromise(333);

        return 'Switched to event!';
    };

    const proceedBet = (data, command) => {
        dLog('green', 'onexbetmobile', 'proceedBet start!');
        for (const b of data) {
            b.home = b.team1;
            b.away = b.team2;
        }
        const started = Date.now();
        currentBetData = {
            data: data,
            max: 777777,
        };
        const report = async (success, message) => {
            bsDebug(port, `Bet finished ${success}, '${message}'`, (new Error()).stack);
            let status = 'ACCEPTED';

            if (!success) {
                status = ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED'].find(c => typeof message === 'string' && message.indexOf(c) > -1) || 'FAILED';
            }
            const resultData = {
                "external_id": success ? message.number : '',
                "status": status,
                "market": data[0].market,
                "target": data[0].target,
                "pivot": data[0].pivot,
                "coef": success ? message.odds : data[0].coef,
                "stake": success ? message.amount : data[0].stake,
                "maximum": currentBetData.max
            };
            if (success) {
                await eventsWorkAll(bkHere,
                    settings.eventMaxBets, settings.eventTimeLimit,
                    currentBetData.data,
                    true, false);
                await bMess('WasSuccessStake').set(Date.now());
                await bMess('Stake Maximums').set(0);
            }

            busy = false;
            const doNotSend = !!currentBetData.data[0].betFromParser && !success
                && resultData.status !== 'LIMITED';
            if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                resultData.type = 'VALUE';
                resultData.mode = currentBetData.data[0].type;
                resultData.bookmaker = '1XBET.MOBILE';
                resultData.placedCoef = resultData.coef;
                resultData.coef = currentBetData.data[0].coef;
                resultData.source = currentBetData.data[0]?.source || 'oddscp';
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
            const m = {
                answered: !!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED'
                    ? "F_BET" : "BET",
                data: resultData,
                answer: success ? 'Everything is Okay!' : message,
                doNotSend,
            };
            port.postMessage(m);
            ourCommand.clear();
            bsDebug(port, `Result data (${success}): `, resultData);
        };
        proceedBetWork(data)
            .then(m => (bsLogger('red', 'onexbetmobile', `SUCCEEDED proceedBetWork has taken: ${(Date.now() - started)}`), report(true, m)))
            .catch(m => (bsLogger('red', 'onexbetmobile', `FAILED proceedBetWork has taken: ${(Date.now() - started)}`), report(false, m)));
    };

    const proceedBetWork = async (data) => {
        const
            realSuccessInterval = data[0].successBetInterval || settings.betweenBets,
            wasSuccessStake = await bMess('WasSuccessStake')
                .check(realSuccessInterval)
                .catch(() => 0),
            successDiff = Date.now() - wasSuccessStake;
        let $el = $([]);

        if (successDiff < realSuccessInterval) {
            throw `To early after previous success bet ${successDiff} instead of ${realSuccessInterval}!`
        }
        if (!!currentBetData.data[0].betFromParser) {
            const checkRes = await eventsWorkAll(bkHere,
                settings.eventMaxBets, settings.eventTimeLimit,
                currentBetData.data, false, true);
            if (checkRes !== 'OK') {
                dLog('red', 'onexbetmobile', `We got errors: ${checkRes}`);
                throw checkRes;
            } else {
                dLog('big-blue', 'onexbetmobile',
                    `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                for (const d of currentBetData.data) {
                    const eventName = `${d.team1} - ${d.team2}`;
                    dLog('blue', 'onexbetmobile', `${settings.eventMaxBets} for ${eventName} not reached`);
                }
            }
        }
        const inputSel = 'input[placeholder="Enter stake"]';
        const checkSuccess = async () => {
            await waitForCondition(() => $('ul.quick-coupon-events__cards').length === 0,
                333, 33333, 'Submitted coupon is not closed!');
            return true;
        };
        const calcStake = max => {
            let stake = parseFloat(data[0].stake);
            if (isNaN(stake) || stake <= 0) {
                throw `Wrong stake: ${data[0].stake}`;
            }
            if (stake > max) {
                stake = max;
            }
            let balance = getBalance();
            if (stake > balance) {
                stake = balance;
            }
            return stake;
        };
        const tryPlaceBet = async stake => {
            dLog('green', 'onexbetmobile', 'tryPlaceBet');
            
            if (parseFloat($(inputSel).val()) !== stake) {
                await clearAndSimulate($(inputSel)[0], stake.toString().replace('.00', '').trim());
            }
            const submit = 'button.quick-coupon-put-bet-button:textEquals("Place a bet")';
            if ($(submit).length > 0) {
                await mouseChain({target: $(submit)[0], events: fullClick, error: "submit coupon"});
                return true;
            }
            await delayPromise(getRandomRounded(400, 770));

            return false;
        };
        bsDebug(port, `proceedBetWork`, data);

        await closePreviousCoupon();
        await delayPromise(333);
        dLog('green', 'onexbetmobile', 'Go to event page!');

        for (const bet of data) {
            // find event
            await searchEventFill(bet);
            dLog('green', 'onexbetmobile', 'Event must be opened!');
            // get bet element
            $el = await getBetElementDirectLink(bet);
            await checkCoupon(bet, $el);
            await delayPromise(555);
        }

        // click on bet
        await mouseChain({
            target: $el[0],
            events: fullClick,
            error: 'click on bet'
        });
        await waitForElement('ul.quick-coupon-events__cards', 222, 5555);

        const stake = calcStake(currentBetData.max);
        bsDebug(port, `Stake calculated: ${stake}`);
        let betPlaced = false;
        await delayPromise(999);

        do {
            betPlaced = await tryPlaceBet(stake);
            bsDebug(port, `Bet placed: ${betPlaced}`);
            if (!betPlaced) {
                throw `Bet not placed!`;
            }
        } while (!await checkSuccess());

        await delayPromise(777);
        // select menu
        await mouseChain({
            target: $(menuLink)[0],
            events: fullClick,
            error: 'select menu'
        });
        await delayPromise(333);
        await waitForElement('div.navigation-menu-section-item-button-caption:textEquals("Bet history")', 222, 7777);
        await delayPromise(333);
        // select bet history
        await mouseChain({
            target: $('div.navigation-menu-section-item-button-caption:textEquals("Bet history")')[0],
            events: fullClick,
            error: 'Bet history'
        });
        await delayPromise(1555);

        const $firstBet = await waitForElement('ul.bets-history-betting__coupons > li:first', 222, 11111);
        await delayPromise(333);
        const number = $firstBet.find('div.bets-history-betting-coupon-head__content > span').trt().replace(/[^\d.]/g, '');
        const odds = $firstBet.find('div.bets-history-betting-coupon-content-row:eq(0) > span:last').trt();
        const amount = $firstBet.find('div.bets-history-betting-coupon-content-row:eq(1) > span:last').trt().replace(/[^\d.]/g, '');
        await goHome();
        await delayPromise(333);

        return {
            number,
            odds,
            amount,
        };
    };

    const switchToEng = async () => {
        const modalLink = '#inline-modal-__V3_HOST_APP__';
        const $menu = await waitForElement(menuLink, 333, 5555).catch(() => $([]));

        if ($menu.length === 0) {
            return;
        }

        if (!$(modalLink).hasClass('is-open')) {
            await mouseChain({target: $(menuLink)[0], events: fullClick, error: 'MENU'});
        }

        await waitForCondition(() => $(modalLink).hasClass('is-open'),
            333, 5555, 'Modal is not open!');
        await delayPromise(3333);

        if ($(modalLink).find('span.navigation-menu-dropdown__angle:last').length > 0) {
            await mouseChain({
                target: $(modalLink).find('span.navigation-menu-dropdown__angle:last')[0], 
                events: fullClick, 
                error: 'LANG LIST'
            });
            await delayPromise(3333);
        }

        await mouseChain({
            target: $('span.language-settings-modal-option__title:textEquals("English")')[0], 
            events: fullClick, 
            error: 'ENG LANG'
        });
    };

    const authCheck = function () {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (!isMobile) {
            throw 'No mobile version!';
        }
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
                'button.notification-web-push-agree__button:textEquals("Block")': 'button.notification-web-push-agree__button:textEquals("Block")',
                'button.ui-notification-close[title="Close"]': 'button.ui-notification-close[title="Close"]',
            });

            if (document.location.href.indexOf('/en') === -1) {
                await switchToEng();
            }

            if($(loginStr).length > 0) {
                port.postMessage({m: "tech works!"});
                await tryToLogIn()
            } else if($(balance).length > 0) {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true)
                });
            }
        })()
            .catch(e => console.log('%c' + `authCheck: ${e}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'))
            .then(() => delayPromise(990))
            .then(() => delayPromise(990))
            .then(() => authCheck());
    };

    function getBalance(returnNull) {
        const $b = $(balance);
        if ($b.length > 0) {
            const bText = $b.trt();
            return parseFloat(bText.replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    };

    const tryToLogIn = async () => {
        const ac = 'color: white; background: black; font-sze: 20px;';
        dLog(ac, 'onexbetmobile', `TryToLogin: ${$(loginStr).length}`);
        if (Date.now() - authClicked < 20000) {
            throw `Too soon! ${authClicked} / ${Date.now()} / ${(Date.now() - authClicked)}`;
        }

        if (document.location.href.indexOf('/user/login') === -1) {
            await mouseChain({target: $(loginStr)[0], events: fullClick, error: 'loginStr'});
        }
        
        const sels = [
            'form input.ui-field__input:first',
            'form input.ui-field__input:last',
        ];
        const submit = 'form.auth-form-by-password button[type="submit"]';
        const remember = 'form span.selection-ico-checkbox';
        await waitForCondition(() => checkSE([sels[0], sels[1]]),
            333, 10000, 'No login form!');
        await delayPromise(333);

        await clearAndSimulate($(sels[0])[0], settings.login);
        await delayPromise(1000);
        await clearAndSimulate($(sels[1])[0], settings.password);
        await delayPromise(1000);

        if (!$(remember).hasClass('selection-ico-checkbox--checked')) {
            await mouseChain({target: $(remember)[0], events: fullClick, error: 'Remember'});
        }
        await mouseChain({
            target: $(submit)[0],
            events: fullClick, error: 'submit login',
        });
        await delayPromise(333);
        const $account = await waitForElement(balance, 333, 28888).catch(() => $([]));

        if ($account.length === 0) {
            enterError = true;
        }

        authClicked = Date.now();
        dLog(ac, 'onexbetmobile', `AUTH clicked!`);

        return 'auth_clicked';
    };

    const getBetElementDirectLink = async data => {
        let tab = 'Regular time';
        let eSet, prefix, setPrx;
        let markets = {
            'ONE_TWO': {
                'ONE': {root: ['1X2'], subroots: [], pivotKeys: ['W1']},
                'TWO': {root: ['1X2'], subroots: [], pivotKeys: ['W2']},
                'DRAW': {root: ['1X2'], subroots: [], pivotKeys: ['X']},
                'ONE_DRAW': {root: ['Double Chance'], subroots: [], pivotKeys: ['1Х']},
                'TWO_DRAW': {root: ['Double Chance'], subroots: [], pivotKeys: ['2X']},
                'ONE_TWO': {root: ['Double Chance'], subroots: [], pivotKeys: ['12']}
            },
            'TOTAL': {
                'OVER': {
                    root: ['Total', 'Asian Total'], subroots: [],
                    pivotKeys: ['Over #PIVOT#', 'Over #PIVOTR#']
                },
                'UNDER': {
                    root: ['Total', 'Asian Total'], subroots: [],
                    pivotKeys: ['Under #PIVOT#', 'Under #PIVOTR#']
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    root: ['Total 1','Asian Team Total 1'], subroots: [],
                    pivotKeys: ['#PIVOT# Over', '#PIVOTR# Over']
                },
                'UNDER': {
                    root: ['Total 1','Asian Team Total 1'], subroots: [],
                    pivotKeys: ['#PIVOT# Under', '#PIVOTR# Under']
                }
            },
            'T2_TOTAL': {
                'OVER': {
                    root: ['Total 2','Asian Team Total 2'], subroots: [],
                    pivotKeys: ['#PIVOT# Over', '#PIVOTR# Over']
                },
                'UNDER': {
                    root: ['Total 2','Asian Team Total 2'], subroots: [],
                    pivotKeys: ['#PIVOT# Under', '#PIVOTR# Under']
                }
            },
            'HDP': {
                'HOME': {
                    root: ['Handicap', 'Asian Handicap'],
                    subroots: [],
                    pivotKeys: ['1 (#HPIVOT#)', '1 (#PIVOTR#)']
                },
                'AWAY': {
                    root: ['Handicap', 'Asian Handicap'],
                    subroots: [],
                    pivotKeys: ['2 (#HPIVOT#)', '2 (#PIVOTR#)']
                }
            },
            'CORNER_TOTAL': {
                'OVER': {
                    root: ['Total. Corners', 'Asian Total. Corners'], subroots: [],
                    pivotKeys: ['Over #PIVOT#', 'Over #PIVOTR#']
                },
                'UNDER': {
                    root: ['Total. Corners', 'Asian Total. Corners'], subroots: [],
                    pivotKeys: ['Under #PIVOT#', 'Under #PIVOTR#']
                }
            },
            'CORNER_HDP': {
                'HOME': {
                    root: ['Handicap. Corners'],
                    subroots: [],
                    pivotKeys: ['1 (#HPIVOT#)', '1 (#PIVOTR#)']
                },
                'AWAY': {
                    root: ['Handicap. Corners'],
                    subroots: [],
                    pivotKeys: ['2 (#HPIVOT#)', '2 (#PIVOTR#)']
                }
            },

            half: {
                'ONE_TWO': {
                    'ONE': {root: ['1X2. 1st half'], subroots: [], pivotKeys: ['W1']},
                    'TWO': {root: ['1X2. 1st half'], subroots: [], pivotKeys: ['W2']},
                    'DRAW': {root: ['1X2. 1st half'], subroots: [], pivotKeys: ['X']},
                    'ONE_DRAW': {root: ['Double Chance. 1st half'], subroots: [], pivotKeys: ['1Х']},
                    'TWO_DRAW': {root: ['Double Chance. 1st half'], subroots: [], pivotKeys: ['2X']},
                    'ONE_TWO': {root: ['Double Chance. 1st half'], subroots: [], pivotKeys: ['12']}
                },
                'TOTAL': {
                    'OVER': {
                        root: ['Total. 1st half', 'Asian Total. 1st half'], subroots: [],
                        pivotKeys: ['Over #PIVOT#', 'Over #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['Total. 1st half', 'Asian Total. 1st half'], subroots: [],
                        pivotKeys: ['Under #PIVOT#', 'Under #PIVOTR#']
                    },
                },
                'T1_TOTAL': {
                    'OVER': {
                        root: ['Total 1. 1st half','Asian Team Total 1. 1st half'], subroots: [],
                        pivotKeys: ['#PIVOT# Over', '#PIVOTR# Over']
                    },
                    'UNDER': {
                        root: ['Total 1. 1st half','Asian Team Total 1. 1st half'], subroots: [],
                        pivotKeys: ['#PIVOT# Under', '#PIVOTR# Under']
                    }
                },
                'T2_TOTAL': {
                    'OVER': {
                        root: ['Total 2. 1st half','Asian Team Total 2. 1st half'], subroots: [],
                        pivotKeys: ['#PIVOT# Over', '#PIVOTR# Over']
                    },
                    'UNDER': {
                        root: ['Total 2. 1st half','Asian Team Total 2. 1st half'], subroots: [],
                        pivotKeys: ['#PIVOT# Under', '#PIVOTR# Under']
                    }
                },
                'HDP': {
                    'HOME': {
                        root: ['Handicap. 1st half', 'Asian Handicap. 1st half'],
                        subroots: [],
                        pivotKeys: ['1 (#HPIVOT#)', '1 (#PIVOTR#)']
                    },
                    'AWAY': {
                        root: ['Handicap. 1st half', 'Asian Handicap. 1st half'],
                        subroots: [],
                        pivotKeys: ['2 (#HPIVOT#)', '2 (#PIVOTR#)']
                    }
                },
                'CORNER_TOTAL': {
                    'OVER': {
                        root: ['Total. 1st half Corners', 'Asian Total. 1st half Corners'], subroots: [],
                        pivotKeys: ['Over #PIVOT#', 'Over #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['Total. 1st half Corners', 'Asian Total. 1st half Corners'], subroots: [],
                        pivotKeys: ['Under #PIVOT#', 'Under #PIVOTR#']
                    }
                },
                'CORNER_HDP': {
                    'HOME': {
                        root: ['Handicap. 1st half Corners'],
                        subroots: [],
                        pivotKeys: ['1 (#HPIVOT#)', '1 (#PIVOTR#)']
                    },
                    'AWAY': {
                        root: ['Handicap. 1st half Corners'],
                        subroots: [],
                        pivotKeys: ['2 (#HPIVOT#)', '2 (#PIVOTR#)']
                    }
                },
            }
        };

        if (data.time_value.indexOf('FULL') > -1) {
            delete markets.half;
        } else {
            markets = markets.half;
        }

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw 'Unsupported ' + data.time_value + '/' + data.market + '/' + data.target;
        }

        const team1 = data.home.toLowerCase();
        const team2 = data.away.toLowerCase();
        const market = markets[data.market][data.target];

        if (data.time_value.indexOf('FULL') === -1) {
            eSet = data.time_value.replace(/\D/g, '');
            prefix = {1: 'st', 2: 'nd', 3: 'rd', 4: 'th', 5: 'th'}[eSet];
            setPrx = eSet + prefix;
        }

        const specialPivotFormatter = function (market, pivot, twoParam) {
            let two = typeof twoParam === 'undefined' ? false : twoParam;

            function round(value, precision) {
                let multiplier = Math.pow(10, precision || 0);
                return Math.round(value * multiplier) / multiplier;
            }

            let fp = parseFloat(pivot);
            let res = '';
            if (!isNaN(fp)) {
                if (market.indexOf('TOTAL') > -1) {
                    // dot zero adding
                    res = two ? round(fp, 2).toString() : round(fp, 1).toFixed(1).toString();
                } else if (market.indexOf('HDP') > -1) {
                    res = (fp > 0 ? '+' : '') + (two ? round(fp, 2).toString() : round(fp, 1).toFixed(1).toString());
                }
            }
            return res;
        };
        const hPivot = pvt => {
            return parseFloat(pvt) === 0 ? '0' : parseFloat(pvt) > 0 ? `+${pvt}` : pvt;
        };
        const replaceInner = function (element, parent, index) {
            if (typeof element === 'string') {
                parent[index] = element.replace('#TEAM1#', team1).replace('#TEAM2#', team2).replace('#HPIVOT#', hPivot(data.pivot))
                    .replace('#PIVOT#', data.pivot).replace('#PIVOTR#', specialPivotFormatter(data.market, data.pivot));
            } else if (typeof element === 'object') {
                for (let i in element) {
                    replaceInner(element[i], element, i);
                }
            }
        };

        // define tab label
        if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) > -1) {
            if (data.market.indexOf('CORNER') > -1) {
                tab = 'Corners';
            }
            if (data.sport === 'BASKETBALL') {
                if (data.market === 'ONE_TWO') {
                    market.root = '1X2 In Regular Time';
                }
            }
        } else {
            if (data.sport === 'HOCKEY') {
                tab = setPrx + ' period';
            } else if (data.sport === 'BASKETBALL') {
                tab = setPrx + ' quarter';
            } else if (data.sport === 'FOOTBALL') {
                if (data.market.indexOf('CORNER')) {
                    tab = 'Corners. 1st half';
                } else {
                    tab = '1st half';
                }
            }
        }

        replaceInner(markets, null, null);

        const performGet = async () => {
            dLog('green', 'onexbetmobile', ['market: ', market]);
            let $element = [];
            
            // select tab
            await mouseChain({
                target: $(`li.game-sub-games__item:textEquals("${tab}")`)[0],
                events: fullClick,
                error: 'TAB'
            });
            await delayPromise(333);

            // find pivot element
            for (const root of market.root) {
                let fullRoot = (data.sport !== 'FOOTBALL' && ['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) === -1)
                    ? root + '. ' + tab : root;

                await waitForElement(`span.game-markets-group-header-title:textEquals("${fullRoot}")`, 222, 5555);
                const $marketGroup = $(`span.game-markets-group-header-title:textEquals("${fullRoot}")`)
                    .closest('div.game-markets-group');

                for (const pivot of market.pivotKeys) {
                    const $pivot = $marketGroup.find(`span.ui-market__name:textEquals("${pivot}")`);

                    if ($pivot.length > 0) {
                        $element = $pivot;
                        break;
                    }
                }
            }

            if ($element.length === 1) {
                return $element;
            } else if ($element.length > 1) {
                throw 'Very strange length of $element: ' + $element.length;
            } else {
                throw 'Bet not found!';
            }
        };

        return await performGet();
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            bMess('1XBET.MOBILE').set(ourCommand.get())
                .then(() => dLog('green', 'onexbetmobile', ['Command was set till unload:', ourCommand.get()]))
        }
    }, true);

    function afterDOMLoaded() {
        (async () => {
            const command = await bMess('1XBET.MOBILE').check(40000);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));

        const started = Date.now();
        setTimeout(() => {
            port.postMessage({m: "PAGE LOADED!"});
            bsLogger('red', 'onexbetmobile', `Page loaded sent! Time after: ${(Date.now() - started)}`);
        }, 12000);
    };

})();
