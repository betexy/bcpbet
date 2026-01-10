(function () {

    "use strict";

    if (window.self !== window.top) {
        return;
    }

    let enterError = false;
    let newAPI = false;
    let needStop = false;
    let lastSMS = '';
    let authClicked = 0;
    let busy = false;
    const bkHere = 'foncupismobile';
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

    let messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;
        if (newAPI) {
            bsLogger('blue', 'FONBET-CUPIS', 'We are using new API!');
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
        if (message.action === 'NEED_STOP') {
            needStop = true;
            busy = false;
            return;
        } else if (message.action !== 'NEED_STOP' && !ourCommand.isSet()) {
            needStop = false;
        }
        if (message.action === 'SMS') {
            lastSMS = message.data;
        } else if (message.action === 'SMS_API' && message.data) {
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
        dLog('green', 'Fon', [`checkCoupon - let's check data:`, data]);
        let totalCoef = 1;
        const errors = [];

        const localCoef = parseFloat($cell.find('div[class*="value-"]').trt());
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

    const closePreviousCoupon = async () => {
        const started = Date.now();
        const newBet = findSel(['span[class*="sup-text--"]:textEquals("New bet slip")', 'span[class*="sup-text--"]:textEquals("Not settled")']);
        const closeOne = async () => {
            let $closes = $('div[class*="event-row-"] span[resource-name="close"]');
            if ($closes.length > 0) {
                await mouseChain({target: $closes[0], events: fullClick, error: 'Error till close coupon'});
                await delayPromise(999);
                await closeOne();
            } else {
                return 'All were closed!';
            }
        };
        dLog('green', 'FON', 'closePreviousCoupon started!');

        if ($('#bottomSheet').length > 0) {
            await closeOne();
        } else if ($(newBet).length === 0) {
            await mouseChain({target: $('div[class*="fader-info-"]')[0], events: fullClick});
            await delayPromise(1555);
            await closeOne();
        }

        dLog('', 'FON', `closePreviousCoupon'd finished in the ${(Date.now() - started)} ms!`);
    };

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 90;
        dLog('green', 'FC', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const searchEventFill = async bet => {
        const eventName = bet.home + ' - ' + bet.away;
        const searchInpt = 'div[class*="search-bar-"] input';
        const dateType = bet.type === 'LIVE' ? 'eventLive' : 'eventBets';
        const $events = () => $(`div[data-testid="${dateType}"]`);
        const checkWeAreThere = function () {
            const
                teams = findSel(['div[class*="scoreboard__table__team__name-"]', 'span[class*="scoreboard-compact__main__team__name-"]']),
                team1 = $(teams).eq(0).trt(),
                team2 = $(teams).eq(1).trt(),
                checkEvent = `${team1} - ${team2}`;
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };
        let $event = $([]);

        if (checkWeAreThere() === true) {
            return 'Switched to event!';
        }

        if ($(searchInpt).length === 0) {
            await mouseChain({target: $('div[class*="explore-button__icon-"]')[0], events: fullClick, error: 'searchThick'});
        }

        await waitForElement(searchInpt, 333, 4444);
        await clearAndSimulate($(searchInpt)[0], eventName, false, true, false, false);
        await delayPromise(1555);

        await $events().eachAsync(async function () {
            const $teams = $(this).find('div[data-testid="team"]');

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
            500, 10000, 'We are not on event!');
        await delayPromise(333);

        return 'Switched to event!';
    };

    const proceedBet = (data, command) => {
        for (const b of data) {
            b.home = b.team1;
            b.away = b.team2;
        }
        const started = Date.now();
        currentBetData = {
            data: data,
            max: 0,
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
                resultData.bookmaker = 'FONBETCUPIS.MOBILE';
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
            .then(m => (bsLogger('red', 'FoN', `SUCCEEDED proceedBetWork has taken: ${(Date.now() - started)}`), report(true, m)))
            .catch(m => (bsLogger('red', 'FoN', `FAILED proceedBetWork has taken: ${(Date.now() - started)}`), report(false, m)));
    };

    const proceedBetWork = async (data) => {
        const
            realSuccessInterval = data[0].successBetInterval || settings.betweenBets,
            wasSuccessStake = await bMess('WasSuccessStake')
                .check(realSuccessInterval)
                .catch(() => 0),
            successDiff = Date.now() - wasSuccessStake;
        const firstBet = 'div[class*="virtual-list-"] div[class*="coupon--"]:first';
        let $el = $([]);

        if (successDiff < realSuccessInterval) {
            throw `To early after previous success bet ${successDiff} instead of ${realSuccessInterval}!`
        }
        if (!!currentBetData.data[0].betFromParser) {
            const checkRes = await eventsWorkAll(bkHere,
                settings.eventMaxBets, settings.eventTimeLimit,
                currentBetData.data, false, true);
            if (checkRes !== 'OK') {
                dLog('red', 'FON', `We got errors: ${checkRes}`);
                throw checkRes;
            } else {
                dLog('big-blue', 'FON',
                    `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                for (const d of currentBetData.data) {
                    const eventName = `${d.team1} - ${d.team2}`;
                    dLog('blue', 'FON', `${settings.eventMaxBets} for ${eventName} not reached`);
                }
            }
        }
        const inputSel = 'input[name="coupon-sum"]';
        const checkSuccess = async () => {
            await waitForElement('#bottomSheet span[class*="text--"]:textEquals("Bet accepted"):visible', 333, 30000,
                true, 1, 'No success!');
            return true;
        };
        const getMax = async () => {
            const $maxLink = await waitForElement('#bottomSheet span[class*="_sizeM-"] span[class^="comment-"]:textEquals("max")', 333, 9999).catch(() => $([]));
            const balance = parseFloat($('#bottomSheet span[class*="balance-row-"]').trt().replace(/[^\d.]/g, '').trim());
            let max = 77777;

            if ($maxLink.length > 0) {
                const maxCpn = parseFloat($maxLink.parent().trt().replace(/[^\d]/g, '').trim());
                currentBetData.max = Number(maxCpn) ? maxCpn > balance ? balance : maxCpn : max;

                return currentBetData.max;
            }

            currentBetData.max = max;

            return currentBetData.max;
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
            dLog('green', 'FC', 'tryPlaceBet');
            
            if (parseFloat($(inputSel).val()) !== stake) {
                await clearAndSimulate($(inputSel)[0], stake.toString().replace('.00', '').trim());
            }
            let $submit = () => $('span[class*="submit-button--"]');
            if ($submit().length > 0) {
                await mouseChain({target: $submit()[0], events: fullClick, error: "submit button"});
                return true;
            }
            await delayPromise(getRandomRounded(400, 990));

            return false;
        };
        bsDebug(port, `proceedBetCupis`, data);

        await closePreviousCoupon();
        await delayPromise(555);
        dLog('red', 'FC', 'Event page!');

        for (const bet of data) {
            // find event
            await searchEventFill(bet);
            dLog('green', 'FC', 'Event must be opened!');
            // get bet element
            $el = await getBetElementDirectLink(bet);
            await checkCoupon(bet, $el);
            await delayPromise(888);
        }

        // click on bet
        await mouseChain({
            target: $el[0],
            events: fullClick,
            error: 'click on bet'
        });

        const max = await getMax();
        const stake = calcStake(max);
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
        // switch to my bets
        await mouseChain({
            target: $('#bottomSheet div[class*="caption-"]:textEquals("My bets")')[0],
            events: fullClick,
            error: 'click MY bets'
        });
        await delayPromise(2222);

        await mouseChain({
            target: $('div[class*="tab-bar-"] span:last')[0],
            events: fullClick,
            error: 'click LIVE bets'
        });
        await delayPromise(1555);

        const number = $(firstBet).find('span[class*="number--"]').trt().replace(/[^\d.]/g, '');
        const odds = $(firstBet).find('div[class*="coupon-footer--"] div[class*="factor--"]').trt();
        const amount = $(firstBet).find('div[class*="coupon-footer--"] div[class*="sum-placed--"]').trt();

        await mouseChain({
            target: $('span[class*="bottom-sheet-header__close-btn-"]')[0],
            events: fullClick,
            error: 'bottom-sheet-header__close-btn'
        });
        await delayPromise(333);

        return {
            number,
            odds,
            amount,
        };
    };

    const authCheck = function () {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const loginStr = 'a[href="/authProcess/login"]';

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
            if($(loginStr).length > 0) {
                port.postMessage({m: "tech works!"});
                await tryToLogIn(loginStr)
            } else {
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
        const $b = $('span[class*="balance-row-"]');
        if ($b.length > 0) {
            const bText = $b.trt();
            return parseFloat(bText.replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    };

    const switchToFootball = function (settings) {
        let $ef = $('div.events__filter ._type_sport');
        if ($ef.length === 1) {
            mouseChain({
                events: ['mouseover', 'mousedown', 'click', 'mouseup'],
                target: $ef[0],
                debug: true,
                interval: 5
            })
                .then(function () {
                    setTimeout(function () {
                        let $football = $('a.events__filter-item[href="#!/live/football"]');
                        if ($football.length === 1) {
                            mouseChain({
                                events: ['mouseover', 'mousedown', 'click', 'mouseup'],
                                target: $football[0],
                                debug: true,
                                interval: 5
                            }).then(() => {
                                port.postMessage({m: "authorized!"});
                                console.log('Switched to football!');
                                authCheck(settings);
                            }).catch(e => {
                                port.postMessage({m: "tech works!"});
                                console.log(e);
                                authCheck(settings);
                            });
                        } else {
                            // There is no football - close events switcher and let's wait
                            mouseChain({
                                events: ['mouseover', 'mousedown', 'click', 'mouseup'],
                                target: $ef[0],
                                debug: true,
                                interval: 5
                            }).then(() => {
                                port.postMessage({m: "There is no football!"});
                                setTimeout(() => {
                                    authCheck(settings);
                                }, getRandomRounded(settings.waitForFootbalInterval, settings.waitForFootbalInterval * 2))
                            }).catch(e => {
                                port.postMessage({m: "tech works!"});
                                console.log(e);
                                authCheck(settings);
                            });
                        }
                    }, 1000);
                })
                .catch(e => {
                    port.postMessage({m: "tech works!"});
                    console.log(e);
                    authCheck(settings);
                });
        } else {
            port.postMessage({m: "There is no switcher!"});
            setTimeout(() => {
                switchToFootball(settings);
            }, 1000);
        }
    };

    const switchTeamTotal = async ($root, market) => {
        const teamIdx = ['T1_', 'T2_'].findIndex(i => {
            return market.includes(i);
        })

        if (teamIdx > -1) {
            await mouseChain({
                target: $root.find(`div[class*="table-switcher-"] span[class*="button-"]:eq(${teamIdx})`)[0],
                events: fullClick,
                error: "Bet button"
            });
        }
    };

    const tryToLogIn = async (loginStr) => {
        const ac = 'color: white; background: black; font-sze: 20px;';
        dLog(ac, 'Fon', `TryToLogin: ${$(loginStr).length}`);
        if (Date.now() - authClicked < 20000) {
            throw `Too soon! ${authClicked} / ${Date.now()} / ${(Date.now() - authClicked)}`;
        }

        if ($('h1[class*="dialog-caption__caption-"]:textEquals("Log in to My Account")').length === 0) {
            await mouseChain({target: $(loginStr)[0], events: fullClick, error: 'loginStr'});
        }
        
        const sels = [
            'input[type="text"]',
            'input[type="password"]',
        ];
        const submit = 'span:textEquals("Log in")';
        const langEl = 'span[class*="dialog-caption__language-code-"]';
        await waitForCondition(() => checkSE([sels[0], sels[1]]),
            333, 10000, 'No login form!');
        await delayPromise(333);

        // select lang if needed
        if ($(langEl).trt() !== 'eng') {
            await mouseChain({target: $(langEl)[0], events: fullClick, error: 'langEl'});
            await delayPromise(1888);
            await mouseChain({
                target: $('span[class*="language-list__button__text-"]:textEquals("English")')[0], 
                events: fullClick, 
                error: 'English'
            });
            await delayPromise(1888);
        }

        if (settings.login.indexOf('+') > -1) {
            await mouseChain({target: $('div[class*="caption-"]:textEquals("Phone")')[0], events: fullClick, error: 'phone tab'});
            await delayPromise(1500);
        }

        await clearAndSimulate($(sels[0])[0], settings.login);
        await delayPromise(1000);
        await clearAndSimulate($(sels[1])[0], settings.password);
        await delayPromise(1000);
        await mouseChain({
            target: $(submit)[0],
            events: fullClick, error: 'submit login',
        });
        await delayPromise(333);
        const $account = await waitForElement('div[class*="accountDataContainer-"]', 333, 18888).catch(() => $([]));

        if ($account.length === 0) {
            enterError = true;
        }

        authClicked = Date.now();
        dLog(ac, 'Fon', `AUTH clicked!`);

        return 'auth_clicked';
    };

    const getBetElementDirectLink = async data => {
        let markets = {
            'ONE_TWO': {
                'ONE': {root: ['Full time result'], subroots: [], pivotKey: '1'},
                'TWO': {root: ['Full time result'], subroots: [], pivotKey: '2'},
                'DRAW': {root: ['Full time result'], subroots: [], pivotKey: 'X'},
                'ONE_DRAW': {root: ['Full time result'], subroots: [], pivotKey: '1Х'},
                'TWO_DRAW': {root: ['Full time result'], subroots: [], pivotKey: 'Х2'},
                'ONE_TWO': {root: ['Full time result'], subroots: [], pivotKey: '12'}
            },
            'TOTAL': {
                'OVER': {
                    root: ['Total goals'], subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
                'UNDER': {
                    root: ['Total goals'], subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    root: ['Team totals goals','Team total goals'], subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
                'UNDER': {
                    root: ['Team totals goals','Team total goals'], subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                }
            },
            'T2_TOTAL': {
                'OVER': {
                    root: ['Team totals goals','Team total goals'], subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
                'UNDER': {
                    root: ['Team totals goals','Team total goals'], subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                }
            },
            'HDP': {
                'HOME': {
                    root: ['Handicap'],
                    subroots: [],
                    pivotKeys: ['Hcap (#HPIVOT#)', 'Hcap (#PIVOTR#)']
                },
                'AWAY': {
                    root: ['Handicap'],
                    subroots: [],
                    pivotKeys: ['Hcap (#HPIVOT#)', 'Hcap (#PIVOTR#)']
                }
            },
            'CORNER_TOTAL': {
                'OVER': {
                    root: ['Total corners'], subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
                'UNDER': {
                    root: ['Total corners'], subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                }
            },
            'CORNER_HDP': {
                'HOME': {
                    root: ['Corners handicap'],
                    subroots: [],
                    pivotKeys: ['Hcap (#HPIVOT#)', 'Hcap (#PIVOTR#)']
                },
                'AWAY': {
                    root: ['Corners handicap'],
                    subroots: [],
                    pivotKeys: ['Hcap (#HPIVOT#)', 'Hcap (#PIVOTR#)']
                }
            },
            'OUT_TOTAL': {
                'OVER': {
                    root: ['Total throw‑ins'],
                    subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
                'UNDER': {
                    root: ['Total throw‑ins'],
                    subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                }
            },
            'T1_OUT_TOTAL': {
                'OVER': {
                    root: ['Team totals throw‑ins'],
                    subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
                'UNDER': {
                    root: ['Team totals throw‑ins'],
                    subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
            },
            'T2_OUT_TOTAL': {
                'OVER': {
                    root: ['Team totals throw‑ins'],
                    subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
                'UNDER': {
                    root: ['Team totals throw‑ins'],
                    subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
            },
            'T1_CORNER_TOTAL': {
                'OVER': {
                    root: ['Team totals corners'],
                    subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
                'UNDER': {
                    root: ['Team totals corners'],
                    subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
            },
            'T2_CORNER_TOTAL': {
                'OVER': {
                    root: ['Team totals corners'],
                    subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
                'UNDER': {
                    root: ['Team totals corners'],
                    subroots: [],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
            },
            'YC_TOTAL': {
                'OVER': {
                    root: ['Total yellow cards'],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
                'UNDER': {
                    root: ['Total yellow cards'],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                }
            },
            'FOUL_TOTAL': {
                'OVER': {
                    root: ['Total fouls'],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                },
                'UNDER': {
                    root: ['Total fouls'],
                    pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                }
            },

            half: {
                'ONE_TWO': {
                    'ONE': {root: ['1st half result'], subroots: [], pivotKey: '1'},
                    'TWO': {root: ['1st half result'], subroots: [], pivotKey: '2'},
                    'DRAW': {root: ['1st half result'], subroots: [], pivotKey: 'X'},
                    'ONE_DRAW': {root: ['1st half result'], subroots: [], pivotKey: '1X'},
                    'TWO_DRAW': {root: ['1st half result'], subroots: [], pivotKey: 'X2'},
                    'ONE_TWO': {root: ['1st half result'], subroots: [], pivotKey: '12'}
                },
                'TOTAL': {
                    'OVER': {
                        root: ['1st half total goals'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['1st half total goals'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                },
                'T1_TOTAL': {
                    'OVER': {
                        root: ['1st half team total goals'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['1st half team total goals'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    }
                },
                'T2_TOTAL': {
                    'OVER': {
                        root: ['1st half team total goals'],
                        subroots: [],
                        pivotKeys: ['Тотал #PIVOT#', 'Total #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['1st half team total goals'],
                        subroots: [],
                        pivotKeys: ['Тотал #PIVOT#', 'Total #PIVOTR#']
                    }
                },
                'HDP': {
                    'HOME': {
                        root: ['1st half handicap'],
                        subroots: [],
                        pivotKeys: ['Hcap (#HPIVOT#)', 'Hcap (#PIVOTR#)']
                    },
                    'AWAY': {
                        root: ['1st half handicap'],
                        subroots: [],
                        pivotKeys: ['Hcap (#HPIVOT#)', 'Hcap (#PIVOTR#)']
                    }
                },
                'CORNER_TOTAL': {
                    'OVER': {
                        root: ['Totals corners in 1st half'], subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['Totals corners in 1st half'], subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    }
                },
                'CORNER_HDP': {
                    'HOME': {
                        root: ['Сorners handicap in 1st half'],
                        subroots: [],
                        pivotKeys: ['Hcap (#HPIVOT#)', 'Hcap (#PIVOTR#)']
                    },
                    'AWAY': {
                        root: ['Сorners handicap in 1st half'],
                        subroots: [],
                        pivotKeys: ['Hcap (#HPIVOT#)', 'Hcap (#PIVOTR#)']
                    }
                },
                'OUT_TOTAL': {
                    'OVER': {
                        root: ['Total throw‑ins in 1st half'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['Total throw‑ins in 1st half'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    }
                },
                'T1_OUT_TOTAL': {
                    'OVER': {
                        root: ['Team totals throw‑ins in 1st half'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['Team totals throw‑ins in 1st half'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                },
                'T2_OUT_TOTAL': {
                    'OVER': {
                        root: ['Team totals throw‑ins in 1st half'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['Team totals throw‑ins in 1st half'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                },
                'T1_CORNER_TOTAL': {
                    'OVER': {
                        root: ['Team totals corners in 1st half'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['Team totals corners in 1st half'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                },
                'T2_CORNER_TOTAL': {
                    'OVER': {
                        root: ['Team totals corners in 1st half'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['Team totals corners in 1st half'],
                        subroots: [],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                },
                'YC_TOTAL': {
                    'OVER': {
                        root: ['Total yellow cards in 1st half'],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['Total yellow cards in 1st half'],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    }
                },
                'FOUL_TOTAL': {
                    'OVER': {
                        root: ['Total fouls in 1st half'],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['Total fouls in 1st half'],
                        pivotKeys: ['Total #PIVOT#', 'Total #PIVOTR#']
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

        let modifyRoots = function () {
            let eSet, prefix, setPrx, push;
            if (data.time_value.indexOf('FULL') === -1) {
                eSet = data.time_value.replace(/\D/g, '');
                prefix = {1: 'st', 2: 'nd', 3: 'rd', 4: 'th', 5: 'th'}[eSet];
                setPrx = eSet + prefix;
            }

            if (data.sport === 'TENNIS') {
                if (data.time_value.indexOf('FULL') > -1) {
                    push = {
                        'ONE_TWO': 'Result',
                        'TOTAL': 'Total games',
                        'T1_TOTAL': 'Team totals games',
                        'T2_TOTAL': 'Team totals games',
                    }[data.market];
                } else {
                    push = {
                        'ONE_TWO': `Result in ${setPrx} set`,
                        'HDP': `Handicap in ${setPrx} set`,
                        'TOTAL': `Total games in ${setPrx} set`,
                        'T1_TOTAL': `Team totals games in ${setPrx} set`,
                        'T2_TOTAL': `Team totals games in ${setPrx} set`,
                    }[data.market];
                }
            } else if (data.sport === 'HOCKEY') {
                if (data.time_value.indexOf('FULL') > -1) {
                    push = {
                        'ONE_TWO': 'Match result',
                        'TOTAL': 'Total goals in match',
                        'HDP': 'Handicap in match',
                        'T1_TOTAL': 'Total goals in match',
                        'T2_TOTAL': 'Total goals in match',
                    }[data.market];
                } else {
                    push = {
                        'ONE_TWO': `${setPrx} period result`,
                        'HDP': `Handicap in ${setPrx} period`,
                        'TOTAL': `Total goals in ${setPrx} period`,
                        'T1_TOTAL': `Team totals in ${setPrx} period`,
                        'T2_TOTAL': `Team totals in ${setPrx} period`,
                    }[data.market];
                }
            } else if (data.sport === 'BASKETBALL') {
                if (data.time_value.indexOf('FULL') > -1) {
                    push = {
                        'ONE_TWO': 'Result',
                        'TOTAL': 'Total points',
                        'T1_TOTAL': 'Team totals',
                        'T2_TOTAL': 'Team totals',
                    }[data.market];
                } else {
                    push = {
                        'ONE_TWO': `Result in ${setPrx} quarter`,
                        'HDP': `Handicap in ${setPrx} quarter`,
                        'TOTAL': `Total points in ${setPrx} quarter`,
                        'T1_TOTAL': `Team totals in ${setPrx} quarter`,
                        'T2_TOTAL': `Team totals in ${setPrx} quarter`,
                    }[data.market];
                }
            } else if (data.sport === 'CYBERSPORT') {
                if (data.time_value.indexOf('FULL') > -1) {
                    push = {
                        'ONE_TWO': 'Result',
                        'TOTAL': 'Total maps',
                        'HDP': 'Maps handicap',
                        'T1_TOTAL': 'Team totals goals',
                        'T2_TOTAL': 'Team totals goals',
                    }[data.market];
                } else {
                    push = {
                        'ONE_TWO': `${setPrx} map result`,
                        'HDP': `${setPrx} map handicap`,
                        'TOTAL': `${setPrx} map total`,
                    }[data.market];
                }
            }

            if (push) {
                market.root.push(push);
            }
        };

        if (data.sport !== 'FOOTBALL') {
            modifyRoots();
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

        replaceInner(markets, null, null);

        const performGet = async () => {
            dLog('green', 'FC', ['market: ', market]);
            const addTotals = ['CORNER_TOTAL', 'CORNER_HDP', 'OUT_TOTAL', 'T1_OUT_TOTAL', 'T2_OUT_TOTAL', 'T1_CORNER_TOTAL', 'T2_CORNER_TOTAL', 'YC_TOTAL', 'FOUL_TOTAL'];
            const tab = addTotals.indexOf(data.market) > -1 ? 'Team stats' : 'Popular';

            await mouseChain({
                target: $(`div[class^="caption-"]:textEquals("${tab}")`)[0],
                events: fullClick,
                scroll: true
            });
            await delayPromise(555);

            const betGroups = await waitForElement('div[class^="market-group-box--"]',
                333, 8000);
            let $element = [];

            await betGroups.eachAsync(async function () {
                const $this = $(this);
                const headName = $this.find('div[class*="title--"]');
                const marketName = headName.trt().replace(/ /g, ' ');

                if (market.root.indexOf(marketName) === -1) {
                    console.log('%c' + `Skipping '${market.root.join("', '")}' of '${marketName}' = ${market.root.indexOf(marketName)}`,
                        'background: orange; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    return true;
                } else {
                    headName[0].scrollIntoView(true);
                    console.log('%c' + `Working in ${marketName}`,
                        'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                }

                //expanded if needed
                if ($this.find('div[class*="body--"]').length === 0) {
                    await mouseChain({
                        target: $this.find('div[class*="icon--"]')[0],
                        events: fullClick,
                        error: 'can\'t expand bet head',
                        scroll: true
                    });
                    await delayPromise(1888);
                }

                if ($this.find('div[class*="body"] div[class*="widget-"]').length > 0) {
                    await mouseChain({
                        target: $this.find('div[class*="icon--"]')[0],
                        events: fullClick,
                        error: 'can\'t expand widget head',
                        scroll: true
                    });
                    await delayPromise(555);
                }

                await waitForCondition(() => $this.find('div[class*="body--"]').length > 0,
                    300, 5555);

                if (data.market.includes('TOTAL')) {
                    await switchTeamTotal($this, data.market);
                    await delayPromise(1111); 
                }

                $this.find('div[class*="row--"]').each(function () {
                    const $t = $(this);
                    switch (data.market) {
                        case 'ONE_TWO':
                            $element = $t
                                .find(`div[class^="text--"]:textEqualsI("${market.pivotKey}")`)
                                .closest('div[class*="cell--"]');
                            break;
                        case 'TOTAL':
                        case 'CORNER_TOTAL':
                        case 'OUT_TOTAL':
                        case 'YC_TOTAL':
                        case 'FOUL_TOTAL':
                        case 'T1_TOTAL':
                        case 'T2_TOTAL':
                        case 'T1_OUT_TOTAL':
                        case 'T2_OUT_TOTAL':
                        case 'T1_CORNER_TOTAL':
                        case 'T2_CORNER_TOTAL':
                            for (let i = 0; i < market.pivotKeys.length; i++) {
                                let $cell = $t.find(`div[class*="cell--"]:first:textEqualsI("${market.pivotKeys[i]}")`);
                                if ($cell.length > 0) {
                                    $element = data.target === 'OVER' 
                                        ? $t.find('div[class*="cell--"]:eq(1)') 
                                        : $t.find('div[class*="cell--"]:eq(2)');
                                    break;
                                }
                            }
                            break;
                        case 'CORNER_HDP':
                        case 'HDP':
                            const idx = data.target === 'HOME' 
                                ? 0 : 1;
                            for (let i = 0; i < market.pivotKeys.length; i++) {
                                let $cell = $t.find(`div[class*="cell--"]:eq(${idx}) div[class*="text--"]`);
                                let pivotData = parseFloat(market.pivotKeys[i].replace(/[^\d.]/g, '').trim());
                                let pivot = parseFloat($cell.trt().replace(/[^\d.]/g, '').trim());
                                if (pivotData === pivot) {
                                    $element = $cell.closest('div[class*="cell--"]');
                                    break;
                                }
                            }
                            break;
                    }
                    if ($element.length > 0) {
                        return false;
                    }
                });
                if ($element.length > 0) {
                    return false;
                }
            });

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
            bMess('FONBET_CUPIS').set(ourCommand.get())
                .then(() => dLog('green', 'FonbetCupis', ['Command was set till unload:', ourCommand.get()]))
        }
    }, true);

    function afterDOMLoaded() {
        (async () => {
            const command = await bMess('FONBET_CUPIS').check(40000);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));

        const started = Date.now();
        setTimeout(() => {
            port.postMessage({m: "PAGE LOADED!"});
            bsLogger('red', 'FoN', `Page loaded sent! Time after: ${(Date.now() - started)}`);
        }, 12000);
    };

})();
