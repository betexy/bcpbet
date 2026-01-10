(function () {

    "use strict";

    let waitSource = false;
    let sourceExpress = false;
    let authClicked = 0;
    let wasAuthCheck = false;
    let busy = false;
    let increaseDelay = false;
    let domLoaded = 0;
    const isBy = document.location.href.indexOf('betcity.by') > -1;
    const port = chrome.runtime.connect({name: "port_betcity" + (isBy ? 'by' : '')});
    const settings = {
        authCheckInterval: 2000,
        url: 'https://betcity.ru/en/live',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 1,
        betweenBets: 25000,
        newExpresses: false,
        source: {
            X: 444,
            Y: 445,
            Z: 446,
        },
        sourceRandom: 0,
        sourceDate: 0,
    };

    let currentBetData = false;
    let enterError = false;

    const ourCommand = new ourCommandProto();

    const sportAccordance = {
        'FOOTBALL': 'Soccer',
        'TENNIS': 'Tennis',
        'HOCKEY': 'Ice Hockey',
        'VOLLEYBALL': 'Volleyball',
        'CYBERSPORT': 'Electronic Sports',
        'BASEBALL': '',
        'BASKETBALL': 'Basketball',
        'HANDBALL': ''
    };

    const $coupons = () => $('div.cart-items-container div.cart-item');

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

    const messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        let $logLink = $('a.btn.btn_signin:visible');
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE',
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
            settings.login = message.login;
            settings.password = message.password;
            settings.phone = message.phone;
            settings.uid = message.uid;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = 1;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            settings.newExpresses = !!(settings?.stake_fork && settings.stake_fork?.newExpresses);
            settings.lastScoreBasketball = message?.stake_fork?.lastScoreBasketball || '';
            settings.newExpressBetsAmount = Number(message?.stake_fork?.newExpressBetsAmount) || 2;

            if (settings.lastScoreBasketball === '999') {
                settings.sourceDate = Date.now();
                settings.sourceRandom = getSourceRandom();

                if (settings.sourceRandom >= 15 && settings.sourceRandom <= 19) {
                    settings.newExpresses = true;
                    waitSource = true;
                    if (settings.sourceRandom >= 15 && settings.sourceRandom <= 17) {
                        settings.newExpressBetsAmount = 1;
                    }
                } else {
                    waitSource = false;
                }
                dLog('blue', 'BETCITY', `Source current random value - ${settings.sourceRandom}`);
            }

            authCheck();
            wasAuthCheck = true;
        } else if (message.action === 'REGISTER') {
            busy = true;
            ourCommand.set(message);
            register(message.data)
                .then(() => bsDebug(port, 'It\'s looks like ' + message.action + ' done!'))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                });
        } else if ($logLink.length !== 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (message.action === 'BET') {
            if (waitSource) {
                port.postMessage({
                    answered: message.action,
                    status: "error",
                    answer: "BUSY"
                });
            } else {
                busy = true;
                ourCommand.set(message);
                proceedBet(message.data, 'BET')
                    .then(() => bsDebug(port, "It's looks like BET done!"))
                    .catch((e) => bsError(port, 'Error till BET: ' + e))
                    .then(() => {
                        busy = false;
                        ourCommand.clear();
                        return mouseChain({target: $('a.menu__item[href="/en/live"]').first()[0], events: ['click']});
                    });
            }
        } else if (message.action === 'EXPRESS_BET') {
            if (waitSource) {
                port.postMessage({
                    answered: message.action,
                    status: "error",
                    answer: "BUSY"
                });
            } else {
                busy = true;
                ourCommand.set(message);
                proceedBet(message.data, 'EXPRESS_BET')
                    .then(() => bsDebug(port, "It's looks like EXPRESS_BET done!"))
                    .catch((e) => bsError(port, 'Error till EXPRESS_BET: ' + e))
                    .then(() => {
                        busy = false;
                        ourCommand.clear();
                        return mouseChain({target: $('a.menu__item[href="/en/live"]').first()[0], events: ['click']});
                    });
            }
        } else if (message.action === 'BET_RESULT') {
            busy = true;
            ourCommand.set(message);
            collectBetResults(message.data)
                .then(() => bsDebug(port, "It's looks like BET_RESULT done!"))
                .catch((e) => bsError(port, 'Error till BET_RESULT: ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                    return mouseChain({target: $('a.menu__item[href="/en/live"]').first()[0], events: ['click']});
                });
        } else if (message.action === 'DEPOSIT') {
            busy = true;
            ourCommand.set(message);
            deposit(message.data)
                .then(() => bsDebug(port, "It's looks like DEPOSIT done!"))
                .catch((e) => bsError(port, 'Error till DEPOSIT: ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                    return mouseChain({target: $('a.menu__item[href="/en/live"]').first()[0], events: ['click']});
                });
        } else if (message.action === 'WITHDRAW') {
            busy = true;
            ourCommand.set(message);
            withdraw(message.data)
                .then(() => bsDebug(port, "It's looks like WITHDRAW done!"))
                .catch((e) => bsError(port, 'Error till WITHDRAW: ' + e))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                    return mouseChain({target: $('a.menu__item[href="/en/live"]').first()[0], events: ['click']});
                });
        }
    };

    /**
     * Find new express bet
     */
    const ProccedExpressNew = async () => {
        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));
        const topEvents = 'app-line-event-unit';
        const currentBets = [];
        const $coefs = () => $('button.line-event__main-bets-button');

        // select -top prematch-
        await mouseChain({target: $('a.left-filter__item-name > span:contains("Top soccer")')[0], events: ['click'], error: 'top prematch'});
        await delayPromise(999);

        await waitForElement(topEvents, 333, 7777);

        const findOption = coef => {
            return isNaN(coef) ? false : coef >= 1.01 && coef <= 1.4;
        };

        const getUniqueRandomNumber = (length) => {
            return Math.floor(Math.random() * length);
        };

        do {
            const randomCoef = getUniqueRandomNumber($coefs().length);
            const eventName = $coefs().eq(randomCoef)
                .closest('div.line-event')
                .find('a.line-event__name b').toArray()
                .map(el => $(el).trt()).join(' - ');

            if (currentBets.indexOf(eventName) > -1) {
                continue;
            }

            if (eventName.length < 5) {
                dLog('red', 'BETCITY', `'${eventName}' is too short - ${eventName.length}`);
                continue;
            }

            if (used[eventName] >= 1) {
                dLog('big-yellow', 'BETCITY', `${eventName} used ${used[eventName]} times!`);
                continue;
            }

            if ($coefs().eq(randomCoef).hasClass('line-event__main-bets-button_in-cart')) {
                continue;
            }

            if (!findOption(parseFloat($coefs().eq(randomCoef).trt()))) {
                continue;
            }

            currentBets.push(eventName);
            await mouseChain({target: $coefs().eq(randomCoef)[0], events: ['click'], error: 'EVENT'});
            await delayPromise(2222);
        } while ($coupons().length < settings.newExpressBetsAmount);

        // check 2 events
        if ($coupons().length === settings.newExpressBetsAmount
            && currentBets.length === settings.newExpressBetsAmount ) {
            dLog('green', 'BETCITY', [`We get selected bets: '${currentBets}', now used:`, used]);
            bMess('WasSuccessExpressNew').set(true).finally();
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
    };

    /**
     * Proceeds bets and expresses
     * @param data {array}
     * @param command {string}
     * @returns {Promise<any>}
     */
    const proceedBet = function (data, command) {
        return new Promise(function (onSuccess, onReject) {
            currentBetData = {
                data: data,
                max: 0,
                external_id: '',
                willPlace: 0
            };

            const betFinished = async function (success, message) {
                const resultData = {
                    "external_id": success ? message.external_id : '',
                    "status": success ? 'ACCEPTED' : ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED']
                        .find(t => message.indexOf(t) > -1) || 'FAILED',
                    "market": currentBetData.data[0].market,
                    "target": currentBetData.data[0].target,
                    "pivot": currentBetData.data[0].pivot,
                    "coef": message.coef,
                    "stake": message.stake,
                    "maximum": currentBetData.max
                };
                if (resultData.status === 'LIMITED') {
                    message = 'Tried to bet 0';
                }

                if (success) {
                    await eventsWorkAll('betcity.by',
                        settings.eventMaxBets, settings.eventTimeLimit,
                        currentBetData.data, true, true);
                    await bMess('WasSuccessStake').set(Date.now());
                    await bMess('Stake Maximums').set(0);

                    if (settings.newExpresses) {
                        // Hint: currentFirstBet MUST exists, otherwise some shit happened!
                        await bMess('WasSuccessExpressNew').set(false);
                        const currentFirstBet = await bMess('currentFirstBet').check(1080000, true);
                        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));

                        if (!used[currentFirstBet]) {
                            used[currentFirstBet] = 1;
                        }

                        dLog('BETCITY', 'blue-big',
                            [`We set bet with first: '${currentFirstBet}', now used:`, used]);

                        if (settings.newExpressBetsAmount > 1) {
                            const currentSecondBet = await bMess('currentSecondBet').check(1080000, true);
                            if (!used[currentSecondBet]) {
                                used[currentSecondBet] = 1;
                            }

                            dLog('BETCITY', 'blue-big',
                            [`We set bet with second: '${currentSecondBet}', now used:`, used]);
                        }

                        await bMess('usedEvents').set(used);
                    }
                }

                const doNotSend = !!currentBetData.data[0].betFromParser && !success
                    && resultData.status !== 'LIMITED';
                if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'BETCITY.CUPIS';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = '444' || 'oddscp';
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
                dLog('blue', 'BETCITY.BY', [`prepareResult was sent:`, m]);

                success ? onSuccess() : onReject(message);
                //bsError(port, 'Just check we successfully empty command!');
                //checkWeAreInInplay(typeof currentBetData.data[0].doNotGoHome !== 'undefined' && currentBetData.data[0].doNotGoHome);
            };
            const report = function (success, message, willPlace) {
                bsDebug(port, "Report (proceedBet) was fired with success: " + success + ', message: '
                    + message + ', willPlace: ' + willPlace,
                    (new Error().stack), message);
                if (success) {
                    betFinished(true, message)
                        .then(() => {
                            busy = false;
                            ourCommand.clear();
                        });
                } else {
                    betFinished(false, message)
                        .then(() => {
                            busy = false;
                            ourCommand.clear();
                        });
                }
            };
            const checkSuccess = function (willPlace) {
                (async () => {
                    let $alertText = $([]), $acceptedText = $([]);
                    await waitForCondition(() => {
                        $alertText = $('div#cartFooter b.cart-footer__message');
                        $acceptedText = $('h2:contains("The betting process has been completed")');
                        return $alertText.length > 0 || $acceptedText.length > 0;
                    }, 333, 60000, 'Unknown status');
                    await delayPromise(555);
                    if ($alertText.length > 0) {
                        throw `Error: ${$alertText.trt()}`;
                    }
                    if ($('div.cart-top__right').is(':visible')) {
                        await delayPromise(555);
                        await mouseChain({target: $('div.cart-top__left')[0], events: fullClick});
                        await delayPromise(333);
                    }
                    await mouseChain({
                        target: $('a.user-info__item-step[href="/en/account/current"]')[0],
                        events: fullClick
                    });
                    await delayPromise(3333);
                    const $el = await waitForElementF('div.ac-item:first', 333, 15000, true)();
                    await delayPromise(500);
                    report(true, {
                        external_id: (() => {
                            let rer = /Betting № (\d+),/.exec($el.find('span:contains("Betting №")').text());
                            return rer === null || typeof rer[1] === 'undefined'
                                ? $el.find('span:contains("Betting №")').text().trim()
                                : rer[1].trim();
                        })(),
                        coef: $el.find('div.account-base-item__sub_right').first().next().text().trim(),
                        stake: $el.find('div.account-base-item__sub_right').first().text().replace(/[^\d.]/g, '').trim()
                    }, willPlace);
                })()
                    .catch(e => report(false, 'Wait BET status: ' + e));
            };
            let loops = 0;
            let reChecks = 0;
            const afterEnterStake = function (willPlace) {
                // Hint: CHECK entered!
                const entered = parseFloat($('app-input-dropdown input').val());
                bsDebug(port, 'After enter stake check: willPlace = ' + parseFloat(willPlace) + ', entered: ' + entered);
                if (isNaN(entered) || parseFloat(willPlace) !== entered) {
                    reChecks++;
                    if (reChecks <= 3) {
                        delayPromise(2222)
                            .then(() => performExactBet(willPlace));
                        bsError(port, 'Entered !== willPlace - try to reenter!');
                    } else {
                        report(false, 'Maybe we try to bet too few :(');
                    }
                    return;
                }
                const $acceptBtn = $('button.button_submit:contains("I agree to odds change")');
                const $placeBtn = $('button.button_submit:contains("Bet")');

                const clickAndCheck = function (selector) {
                    return new Promise((onSuccess, onReject) => {
                        let clicks = 0;
                        const lets = function () {
                            clicks++;
                            console.log('%c' + 'clickAndCheck: ' + clicks + ' for "' + selector + '"',
                                'background: orange; color: blue; font-size: 14px; font-weight: normal');
                            const target = $(selector).get(0);
                            const rect = target.getBoundingClientRect();
                            mouseChain({target: target, events: ['click']})
                                .then(delayFunction(3333))
                                .then(waitForCondition(() => {
                                    return $('b.cart-footer__message:contains("Upper limit is exceeded"):visible').length === 0
                                }, 333, 3333, 'limited', true))
                                .then(waitForCondition(() => {
                                    return ['BUTTON', 'DIV', 'SPAN'].indexOf(document.elementFromPoint(rect.left, rect.top).nodeName) > -1;
                                }, 333, 3333, 'Not element!', true))
                                .then(onSuccess)
                                .catch(e => {
                                    if (e.indexOf('Not element!') > -1 && clicks < 4) {
                                        lets();
                                    } else if (e.indexOf('limited') > -1) {
                                        onReject('LIMITED');
                                    } else {
                                        onReject('We cant click bet! ' + e);
                                    }
                                });
                        };
                        lets();
                    });
                };

                let $errors = [];
                // Hint: CHECK errors
                if ($acceptBtn.length === 1 && elementIsVisible($acceptBtn[0])) {
                    bsDebug(port, 'ReCheck coefs!');
                    checkCoefs(data)
                        .then(delayFunction(333))
                        // Hint: Accept Btn here places bet!
                        .then(() => clickAndCheck('button.button_submit:contains("I agree to odds change")'))
                        .then(delayFunction(777))
                        .then(() => checkSuccess(willPlace))
                        .catch((e) => report(false, 'Coefs changed: ' + e));
                } else if ($errors.length > 0) {
                    report(false, 'We got errors: ' + $errors.text().trim());
                } else if ($placeBtn.length === 0 || $placeBtn.hasClass('disabled')) {
                    if (loops <= 3) {
                        loops++;
                        delayPromise(1111).then(() => afterEnterStake(willPlace));
                    } else {
                        report(false, 'No place button or button disabled (' + loops + ')!');
                    }
                } else {
                    delayPromise(333)
                        .then(() => clickAndCheck('button.button_submit:contains("Bet")'))
                        .then(delayFunction(777))
                        .then(() => checkSuccess(willPlace))
                        .catch((e) => report(false, 'Error during place bet ' + e));
                }
            };
            const performExactBet = function (willPlaceInput) {
                const willPlace = typeof willPlaceInput !== 'undefined' ? parseFloat(willPlaceInput) : parseFloat(data[0].stake);
                // Hint: Let's enter stake
                delayPromise(333)
                    .then(() => clearAndInputNumber($('app-input-dropdown input')[0], willPlace.toString().replace('.00', '')))
                    .then(delayFunction(333))
                    .then(() => {
                        console.log('%cSTAKE entered ' + willPlace, 'background: yellow; font-weight: bold;');
                        afterEnterStake(willPlace);
                    })
                    .catch((e) => report(false, 'Error during place bet ' + e));
            };
            const performCheckAndBet = function (max) {
                if (settings.newExpresses && $coupons().length < settings.newExpressBetsAmount + 1) {
                    throw `less than ${settings.newExpressBetsAmount + 1} events in the newExpresses`;
                }

                checkCoefs(data)
                    .then(() => {
                        currentBetData.max = max;
                        let willPlace = parseFloat(data[0].stake);
                        if (max !== -1 && willPlace > max) {
                            willPlace = max;
                        }
                        let balance = getBalance();
                        if (isNaN(balance)) {
                            report(false, 'Get balance error');
                        } else if (balance < willPlace) {
                            report(false, 'NO_FUNDS - now: ' + balance + ', we need: ' + willPlace);
                        } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                            report(false, 'Undefined or NaN will place');
                        } else {
                            bsDebug(port, 'Will place (performBet): ' + willPlace + ', balance: ' + balance);
                            if (data.length > 1 && !$('span.cart-header__item:contains("combo")').hasClass('cart-header__item_active')) {
                                return mouseChain({
                                    target: $('span.cart-header__item:contains("combo")')[0],
                                    events: ['click']
                                })
                                    .then(delayFunction(1000))
                                    .then(() => performExactBet(willPlace));
                            } else if (data.length === 1 && !$('span.cart-header__item:contains("single")').hasClass('cart-header__item_active')) {
                                return mouseChain({
                                    target: $('span.cart-header__item:contains("single")')[0],
                                    events: ['click']
                                })
                                    .then(delayFunction(1000))
                                    .then(() => performExactBet(willPlace));
                            } else {
                                performExactBet(willPlace);
                            }
                        }
                    })
                    .catch((e) => report(false, 'Error till checkCoefs (' + 0 + '): ' + e));
            };
            const performBet = function () {
                openCoupon(data)
                    .then(performCheckAndBet)
                    .catch((e) => report(false, "Error during openCoupon! " + e));
            };
            (async () => {
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
                    const checkRes = await eventsWorkAll('betcity.by',
                        settings.eventMaxBets, settings.eventTimeLimit,
                        currentBetData.data, false, true);
                    if (checkRes !== 'OK') {
                        dLog('red', 'BETCITY', `We got errors: ${checkRes}`);
                        throw checkRes;
                    } else {
                        dLog('big-blue', 'BETCITY',
                            `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                        for (const d of currentBetData.data) {
                            const eventName = `${d.team1} - ${d.team2}`;
                            dLog('blue', 'BETCITY', `${settings.eventMaxBets} for ${eventName} not reached`);
                        }
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

                await closePreviousCoupons(settings.newExpresses ? true : false);

                //if sourceExpress check coupon for events
                if (sourceExpress && settings.lastScoreBasketball === '999') {
                    if ($coupons().length !== 1) {
                        throw 'Error Express source BET, No 1 event in coupon!';
                    }
                }
            })()
                .then(switchType)
                .then((p) => {
                    bsDebug(port, p);
                    performBet();
                })
                .catch((e) => report(false, 'Error till close coupons: ' + e));

        });
    };

    /**
     * Switch type of bets
     * @returns {Promise<any>}
     */
    const switchType = function () {
        return new Promise(function (onSuccess, onReject) {
            delayPromise(555)
                .then(() => (currentBetData.data[0].type === 'LIVE') ? 'a[href="/en/live"]:textEquals("LIVE")' : 'a[href="/en/line"]:textEquals("Betting list")')
                .then((elStr) => ($(elStr).hasClass('menu__item menu__item_active') === false) ? mouseChain({
                    target: $(elStr)[0],
                    events: ['click']
                }) : delayFunction(111))
                .then(delayFunction(333))
                .then(() => {
                    const blockTypeLine = currentBetData.data[0].type !== 'LIVE' ? 'div.champs-container' : 'app-live-block';
                    waitForElementF(blockTypeLine, 333, 10000, true);
                })
                .then(delayFunction(333))
                .then(() => onSuccess())
                .catch((e) => onReject(e));
        });
    };

    /**
     * Checks coefs into the coupon
     * @param data
     * @returns {Promise<string,string>}
     */
    const checkCoefs = function (data) {
        return new Promise(function (onSuccess, onReject) {
            /*TEST TOP START
            (function (data) {
                console.log(data);
                let onSuccess = function (m) {
                    console.log('Success: ' + m);
                };
                let onReject = function (m) {
                    console.log('Reject: ' + m);
                };
                //TEST TOP FINISH */
            const checkCoupon = function () {
                return new Promise(function (onSuccess, onReject) {
                    const findInData = function (match) {
                        let result = false;
                        $.each(data, function () {
                            let localMatch = this.team1.toLowerCase() + ' - ' + this.team2.toLowerCase();
                            if (localMatch === match || locutus_similar_text(localMatch, match, true) > 60) {
                                result = this;
                                return false;
                            }
                        });
                        return result;
                    };
                    const $couponsCoefs = (data.length === 1 && settings.newExpresses === true)
                        ? $coupons().last()
                        : $coupons();
                    let errors = [];
                    let checked = 0;
                    $couponsCoefs.each(function () {
                        const $this = $(this);
                        const match = $this.find('span.cart-item__event').text().trim().toLowerCase();
                        if ($this.hasClass('market-unavailable')) {
                            errors.push(match + ' LOW_COEF, market unavailable!');
                            checked++;
                            return true;
                        }
                        const localCoef = parseFloat($this.find('span.cart-item__dop-kf').text().trim());
                        const localData = findInData(match);
                        if (localData !== false && localData.coef !== '' && !isNaN(localCoef)) {
                            const checkCoef = parseFloat(localData.coef);
                            if (isNaN(checkCoef)) {
                                errors.push(match + ' wrong coef: ' + localData.coef);
                            } else if (checkCoef > localCoef) {
                                errors.push(match + ' LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef);
                            } else if (localCoef >= checkCoef * 1.2) {
                                errors.push(match + ' TOO BIG coef, have: ' + localCoef + ', need: ' + checkCoef);
                            }
                            checked++;
                        } else if (localData === false || isNaN(localCoef)) {
                            errors.push(match + ' LOW_COEF - wrong match or localCoef!');
                            checked++;
                        } else if (localData.coef === '') {
                            checked++;
                        }
                    });
                    if (errors.length === 0 && checked === data.length) {
                        onSuccess('Coefs fine!');
                    } else {
                        onReject(errors.join('; ') + (checked !== data.length ? ' some stakes not checked ('
                            + checked + '/' + data.length + ')!' : ''));
                    }
                });
            };
            checkCoupon()
                .then((m) => onSuccess(m))
                .catch((e) => onReject(e));
            /* TEST BOTTOM START
        })([
            {team1: 'Manchester Utd', team2: 'PSG', coef: '1.84'},
            {team1: 'Doncaster R', team2: 'Southend Utd', coef: '1.27'}
        ]);
            //TEST BOTTOM FINISH */
        });
    };

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<object,string>} jQuery element for bet
     */
    const getBetElement = function (data) {
        return new Promise(function (reportSuccess, reportReject) {
            //#-#-START
            const onSuccess = function ($d) {
                if (typeof $d[0] === 'undefined') {
                    onReject('Bet inactive!');
                } else {
                    console.log('%cSuccess: ' + $d.text().trim(), 'background: green;');
                    $d[0].scrollIntoView(true);
                    if (data.type === 'LIVE') {
                        $d.closest('div.line-event__container-dops').get(0).scrollTop -= 25;
                    }
                    reportSuccess($d);
                }
            };
            const onReject = function (d) {
                console.log('%cReject', 'background: red;');
                console.log(d);
                reportReject(d);
            };

            const $ts = data.type === 'LIVE' ? $('span.scoreboard-content__team-name') : $('span.line-event__name-teams b');
            const eventName = $ts.eq(0).text().trim() + ' v ' + $ts.eq(1).text().trim();

            const teams = eventName.split(' v ');
            if (teams.length === 2) {
                data.team1 = teams[0].toLowerCase();
                data.team2 = teams[1].toLowerCase();
                data.team1b = teams[0];
                data.team2b = teams[1];
            } else {
                onReject('No teams!');
                return;
            }

            const markets = {
                'ONE_TWO': {
                    'ONE': {roots: ['Full time result'], pivotKeys: ['1']},
                    'TWO': {roots: ['Full time result'], pivotKeys: ['2']},
                    'DRAW': {roots: ['Full time result'], pivotKeys: ['X']},
                    'ONE_DRAW': {roots: ['Double chance'], pivotKeys: ['1X']},
                    'TWO_DRAW': {roots: ['Double chance'], pivotKeys: ['X2']},
                    'ONE_TWO': {roots: ['Double chance'], pivotKeys: ['12']}
                },
                'TOTAL': {
                    'OVER': {
                        roots: ['Total', 'Asian total'],
                        subroots: ['#PIVOT#', '#PIVOTR#', '#PIVOTR2#'],
                        pivotKeys: ['Over', 'Over (#PIVOT#)', 'Over (#PIVOTR#)', 'Over (#PIVOTR2#)']
                    },
                    'UNDER': {
                        roots: ['Total', 'Asian total'],
                        subroots: ['#PIVOT#', '#PIVOTR#', '#PIVOTR2#'],
                        pivotKeys: ['Under', 'Under (#PIVOT#)', 'Under (#PIVOTR#)', 'Under (#PIVOTR2#)']
                    },
                },
                'T1_TOTAL': {
                    'OVER': {
                        roots: ['Ind. Total'],
                        subroots: ['IT1 (#PIVOT#)', 'IT1 (#PIVOTR#)', 'IT1 (#PIVOTR2#)'],
                        pivotKeys: ['Over']
                    },
                    'UNDER': {
                        roots: ['Ind. Total'],
                        subroots: ['IT1 (#PIVOT#)', 'IT1 (#PIVOTR#)', 'IT1 (#PIVOTR2#)'],
                        pivotKeys: ['Under']
                    }
                },
                'T2_TOTAL': {
                    'OVER': {
                        roots: ['Ind. Total'],
                        subroots: ['IT2 (#PIVOT#)', 'IT2 (#PIVOTR#)', 'IT2 (#PIVOTR2#)'],
                        pivotKeys: ['Over']
                    },
                    'UNDER': {
                        roots: ['Ind. Total'],
                        subroots: ['IT2 (#PIVOT#)', 'IT2 (#PIVOTR#)', 'IT2 (#PIVOTR2#)'],
                        pivotKeys: ['Under']
                    }
                },
                'HDP': {
                    'HOME': {
                        roots: ['Handicap', 'Asian handicap'],
                        pivotKeys: ['Han1 (#PIVOT#)', 'Han1 (#PIVOTR#)', 'Han1 (#PIVOTR2#)', 'Han1 (#PIVOTZ#)']
                    },
                    'AWAY': {
                        roots: ['Handicap', 'Asian handicap'],
                        pivotKeys: ['Han2 (#PIVOT#)', 'Han2 (#PIVOTR#)', 'Han2 (#PIVOTR2#)', 'Han2 (#PIVOTZ#)']
                    }
                },
                'CORNER_HDP': {
                    'HOME': {
                        roots: ['Handicap', 'Asian handicap'],
                        pivotKeys: ['Han1 (#PIVOT#)', 'Han1 (#PIVOTR#)', 'Han1 (#PIVOTR2#)', 'Han1 (#PIVOTZ#)']
                    },
                    'AWAY': {
                        roots: ['Handicap', 'Asian handicap'],
                        pivotKeys: ['Han2 (#PIVOT#)', 'Han2 (#PIVOTR#)', 'Han2 (#PIVOTR2#)', 'Han2 (#PIVOTZ#)']
                    }
                },
                'CORNER_TOTAL': {
                    'OVER': {
                        roots: ['Total', 'Asian total'],
                        subroots: ['#PIVOT#', '#PIVOTR#', '#PIVOTR2#'],
                        pivotKeys: ['Over']
                    },
                    'UNDER': {
                        roots: ['Total', 'Asian total'],
                        subroots: ['#PIVOT#', '#PIVOTR#', '#PIVOTR2#'],
                        pivotKeys: ['Under']
                    },
                },
            };

            if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
                onReject('Unsupported ' + data.time_value + '/' + data.market + '/' + data.target);
                return;
            }

            const specialPivotFormatter = function (market, pivot) {
                function round(value, precision) {
                    const multiplier = Math.pow(10, precision || 0);
                    return Math.round(value * multiplier) / multiplier;
                }

                const fp = parseFloat(pivot);
                let res = '';
                if (!isNaN(fp)) {
                    if (market.indexOf('TOTAL') > -1) {
                        // dot zero adding
                        res = round(fp, 1).toFixed(1).toString();
                    } else if (market.indexOf('HDP') > -1) {
                        if (parseFloat(data.pivot) === 0) {
                            res = (data.pivot.toString().indexOf('-') > -1 ? '-' : '+') + round(fp, 2).toFixed(2).toString();
                        } else {
                            res = (fp > 0 ? '+' : '') + round(fp, 2).toFixed(2).toString();
                        }
                    }
                }
                return res;
            };
            const specialPivotZFormatter = function () {
                function round(value, precision) {
                    const multiplier = Math.pow(10, precision || 0);
                    return Math.round(value * multiplier) / multiplier;
                }

                const fp = parseFloat(data.pivot ? data.pivot.toString() : '');
                let res = 'XXCCVVZ';
                if (!isNaN(fp)) {
                    if (fp === 0) {
                        res = '' + round(fp, 1).toFixed(1).toString().replace('.0', '');
                    } else {
                        res = (fp > 0 ? '+' : '') + round(fp, 1).toFixed(1).toString().replace('.0', '');
                    }
                }
                //bsDebug(port, 'specialPivotZFormatter: ' + data.pivot + ' / ' + fp + ' / ' + res);
                return res;
            };
            const replaceInner = function (element, parent, index) {
                if (typeof element === 'string') {
                    parent[index] = element.replace('#TEAM1#', data.team1).replace('#TEAM2#', data.team2)
                        .replace('#TEAM1B#', data.team1b).replace('#TEAM2B#', data.team2b)
                        .replace('#PIVOT#', data.pivot).replace('#PIVOTR#', specialPivotFormatter(data.market, data.pivot))
                        .replace('#PIVOTR2#', specialPivotFormatter(data.market, data.pivot, true))
                        .replace('#PIVOTZ#', specialPivotZFormatter());
                } else if (typeof element === 'object') {
                    for (let i in element) {
                        replaceInner(element[i], element, i);
                    }
                } else {
                    // console.log(typeof element + ' not supported! (' + element + ')');
                }
            };

            replaceInner(markets, null, null);

            const getRootParams = function () {
                let additions = {};
                let specialAdditions = {
                    condition: [],
                    func: () => {
                    }
                };
                let needChange = [];
                let needRemove = [];
                let replacements = [];
                let needAddTo = [];
                let needAddToBeginning = false;
                const needRemoveFill = () => {
                    needRemove.push('Full time result');
                    needRemove.push('Double chance');
                    needRemove.push('Total');
                    needRemove.push('Asian total');
                    needRemove.push('Ind. Total');
                    needRemove.push('Handicap');
                    needRemove.push('Asian handicap');
                }
                if (data.sport === 'FOOTBALL' && data.time_value === 'HALF_TIME') {
                    if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) === -1) {
                        needAddTo.push('Halves result');
                        if (typeof markets[data.market]['subroots'] === 'undefined') {
                            markets[data.market][data.target]['subroots'] = ['1st half'];
                        } else {
                            markets[data.market][data.target]['subroots'].unshift('1st half');
                        }
                    } else {
                        needAddTo.push('Ind. Total 1st half');
                    }
                    needRemoveFill();
                } else if (data.sport === 'BASKETBALL') {

                    if (data.time_value !== 'FULL_MATCH') {
                        const quarter = ['1st', '2nd', '3rd', '4th'][parseInt(data.time_value.replace(/[^\d.]/g, '').trim()) - 1];
                        if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) === -1) {
                            needAddTo.push('Quarters result');
                        } else {
                            markets[data.market][data.target]['special'] = markets[data.market][data.target]['subroots'];
                            needAddTo.push('Quarters Ind. Total');
                        }
                        if (typeof markets[data.market]['subroots'] === 'undefined') {
                            markets[data.market][data.target]['subroots'] = [quarter + ' quarter'];
                        } else {
                            markets[data.market][data.target]['subroots'].unshift(quarter + ' quarter');
                            markets[data.market][data.target]['subroots'] = [quarter + ' quarter'];
                        }
                        needRemoveFill();
                    } else {
                        if (data.market === 'ONE_TWO') {
                            markets[data.market][data.target]['roots'] = ['Regular time'];
                        }
                    }
                } else if (data.sport === 'VOLLEYBALL' && data.time_value !== 'FULL_MATCH') {
                    const set = ['1st', '2nd', '3rd', '4th', '5th'][parseInt(data.time_value.replace(/[^\d.]/g, '').trim()) - 1];
                    if (['HDP'].indexOf(data.market) === -1) {
                        needAddTo.push('Sets result');
                    } else {
                        markets[data.market][data.target]['special'] = markets[data.market][data.target]['subroots'];
                        needAddTo.push('Sets handicap');
                    }

                    if (['HDP'].indexOf(data.market) === -1) {
                        if (typeof markets[data.market]['subroots'] === 'undefined') {
                            markets[data.market][data.target]['subroots'] = [set + ' set'];
                        } else {
                            markets[data.market][data.target]['subroots'].unshift(set + ' set');
                            markets[data.market][data.target]['subroots'] = [set + ' set'];
                        }
                    }
                    needRemoveFill();
                } else if (data.sport === 'TENNIS' && data.time_value !== 'FULL_MATCH') {
                    const set = ['1st', '2nd', '3rd', '4th', '5th'][parseInt(data.time_value.replace(/[^\d.]/g, '').trim()) - 1];
                    if (['HDP'].indexOf(data.market) === -1) {
                        needAddTo.push('Sets result');
                    } else {
                        markets[data.market][data.target]['special'] = markets[data.market][data.target]['subroots'];
                        needAddTo.push('Sets handicap');
                    }

                    if (['HDP'].indexOf(data.market) === -1) {
                        if (typeof markets[data.market]['subroots'] === 'undefined') {
                            markets[data.market][data.target]['subroots'] = [set + ' set'];
                        } else {
                            markets[data.market][data.target]['subroots'].unshift(set + ' set');
                            markets[data.market][data.target]['subroots'] = [set + ' set'];
                        }
                    }
                    needRemoveFill();
                } else if (data.sport === 'HOCKEY' && data.time_value !== 'FULL_MATCH') {
                    const period = ['1st', '2nd', '3rd'][parseInt(data.time_value.replace(/[^\d.]/g, '').trim()) - 1];
                    //let suffix = parseInt(period) % 2 === 0 ? 'nd' : 'rd';
                    if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) === -1) {
                        needAddTo.push('Periods result');
                    } else {
                        markets[data.market][data.target]['special'] = markets[data.market][data.target]['subroots'];
                        needAddTo.push('Periods Ind. Total');
                    }
                    if (typeof markets[data.market]['subroots'] === 'undefined') {
                        markets[data.market][data.target]['subroots'] = [period + ' period'];
                    } else {
                        markets[data.market][data.target]['subroots'].unshift(period + ' period');
                        markets[data.market][data.target]['subroots'] = [period + ' period'];
                    }
                    needRemoveFill();
                } else if (data.sport === 'CYBERSPORT' && data.time_value !== 'FULL_MATCH') {
                    const map = ['1st', '2nd', '3rd', '4th'][parseInt(data.time_value.replace(/[^\d.]/g, '').trim()) - 1];
                    needAddTo.push('Maps results');

                    if (typeof markets[data.market]['subroots'] === 'undefined') {
                        markets[data.market][data.target]['subroots'] = [map + ' map'];
                    } else {
                        markets[data.market][data.target]['subroots'].unshift(map + ' map');
                        markets[data.market][data.target]['subroots'] = [map + ' map'];
                    }
                }
                return {
                    additions: additions,
                    specialAdditions: specialAdditions,
                    needChange: needChange,
                    needRemove: needRemove,
                    replacements: replacements,
                    needAddTo: needAddTo,
                    needAddToBeginning: needAddToBeginning
                };
            };

            marketsModifierWrapper(data, 'roots', getRootParams(), markets);

            const finalPrepareForMarket = function (market) {
                market.rootsLC = market.roots.map(v => v.toLowerCase());
                return market;
            };

            const market = finalPrepareForMarket(markets[data.market][data.target]);

            console.log('%cFinal market is:', 'background: green; color: white; font-weight: bold;');
            console.log(market);

            const performGet = function () {
                let currentRoot = -1;
                const lookForPivot = function ($candidate) {
                    console.log('%clookForPivot in:', 'background: green; color: white; font-weight: bold;');
                    console.log($candidate);
                    let found = false;
                    for (let i in market.pivotKeys) {
                        const p = market.pivotKeys[i];
                        $candidate.find('div.dops-item-row__block-content').each(function () {
                            const $check = $(this);
                            console.log('"' + $check.find('>span').text().trim() + '" === "' + p + '"');
                            if ($check.find('>span').text().replace(/\s+/g, ' ').trim() === p) {
                                found = true;
                                onSuccess($check.find('button'));
                                return false;
                            }
                        });
                        if (found) {
                            break;
                        }
                    }
                    return found;
                };
                const checkSubroots = function ($candidate, subrootsIn) {
                    console.log('%c' + 'Subroot in:', 'background: red; color: white; font-size: 16px; font-weight: bold');
                    console.log($candidate);
                    const subroots = typeof subrootsIn === 'undefined' ? market.subroots : subrootsIn;
                    let found = false;
                    for (let i in subroots) {
                        const subroot = subroots[i];
                        console.log('%cChecking subroot: "' + subroot + '"', 'color: green; font-size: 18px; font-weight: bold;');
                        let finders = [{
                            eFind: 'div.dops-item-row__section div.dops-item-row__block-content:first-child',
                            ePivots: 'div.dops-item-row__section'
                        }];
                        if ($candidate.find('div.dops-item-row__title').length > 0 && typeof subrootsIn === 'undefined') {
                            finders = [{
                                eFind: 'div.dops-item-row__title',
                                ePivots: 'div.dops-item-row.dops-item-row_horizontal'
                            }];
                        }
                        for (let fIdx in finders) {
                            const find = finders[fIdx];
                            $candidate.find(find.eFind).each(function () {
                                const $this = $(this);
                                console.log('"' + $this.text().replace(/\s+/g, ' ').trim() + '" === "' + subroot + '"');
                                if ($this.text().replace(/\s+/g, ' ').trim() === subroot
                                    && (typeof market.special === 'undefined' || typeof subrootsIn !== 'undefined'
                                        ? lookForPivot($this.closest(find.ePivots))
                                        : checkSubroots($this.closest(find.ePivots), market.special))) {
                                    found = true;
                                    return false;
                                }
                            });
                            if (found) {
                                break;
                            }
                        }
                        if (found) {
                            break;
                        }
                    }
                    return found;
                };
                const checkRoot = function ($candidate) {
                    $candidate[0].scrollIntoView();
                    // $candidate.closest('div.line-event__container-dops').get(0).scrollTop -= 25;
                    let found = false;
                    if (typeof market.subroots !== 'undefined') {
                        found = checkSubroots($candidate);
                    } else {
                        console.log('$candidateCheck ', $candidate);
                        if (lookForPivot($candidate)) {
                            found = true;
                        }
                    }
                    return found;
                };
                const nextRoot = function () {
                    const checkOne = function ($candidate, callback) {
                        delayPromise(777)
                            .then(() => checkRoot($candidate))
                            .then((found) => {
                                if (!found) {
                                    callback();
                                }
                            })
                            .catch((e) => onReject('Checking root: ' + e));
                    };
                    currentRoot++;
                    if (currentRoot >= market.roots.length) {
                        onReject('Root not found :(');
                    } else {
                        const $candidate = $('div.dops div.dops-item')
                            .filter(function () {
                                return $(this)
                                    .find(`span:textEquals("${market.roots[currentRoot]}")`).length > 0;
                            });
                        if ($candidate.length === 1) {
                            checkOne($candidate, nextRoot);
                        } else if ($candidate.length > 1) {
                            let currentCandidate = -1;
                            const checkCandidate = function () {
                                currentCandidate++;
                                if ($candidate.length > currentCandidate) {
                                    checkOne($candidate.eq(currentCandidate), checkCandidate);
                                } else {
                                    nextRoot();
                                }
                            };
                            checkCandidate();
                        } else if ($candidate.length === 0) {
                            nextRoot();
                        }
                    }
                };
                nextRoot();
            };
            const performGetFind = function () {
                delayPromise(555)
                    .then(() => findMainLine(data))
                    .then((el) => {
                        if (el.length) {
                            onSuccess(el)
                        } else {
                            performGet();
                        }
                    })
                    .catch((e) => onReject('Error performGetFind ' + e));
            }

            performGetFind();
            //#-#-FINISH
        });
    };

    /**
     * Find in main line of markets
     * @param data
     * @returns {Promise<w.fn.init|jQuery|HTMLElement|*|jQuery>}
     */
    const findMainLine = async (data) => {
        let $el = $([]);
        if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) === -1 || data.type === 'LIVE') {
            return $el;
        }
        await waitForElement('app-line-main-dops-container', 300, 7777);
        switch (data.market) {
            case 'ONE_TWO':
                const idx = ['ONE', 'DRAW', 'TWO'].indexOf(data.target);
                if (idx !== -1) {
                    return $('.line-event__main-bets-button').eq(idx);
                }
            case 'HDP':
                data.pivot = parseFloat(data.pivot);
                if (data.target === 'HOME') {
                    const pivotHere = parseFloat($('.line-event__main-bets-button').eq(3).text().trim());
                    if (data.pivot === pivotHere) {
                        return $('.line-event__main-bets-button').eq(4);
                    }
                }
                if (data.target === 'AWAY') {
                    const pivotHere = parseFloat($('.line-event__main-bets-button').eq(5).text().trim());
                    if (data.pivot === pivotHere) {
                        return $('.line-event__main-bets-button').eq(6);
                    }
                }
            case 'TOTAL':
                const pivotHere = parseFloat($('.line-event__main-bets-button').eq(7).text().trim());
                data.pivot = parseFloat(data.pivot);
                if (data.target === 'OVER') {
                    if (data.pivot === pivotHere) {
                        return $('.line-event__main-bets-button').eq(9);
                    }
                }
                if (data.target === 'UNDER') {
                    if (data.pivot === pivotHere) {
                        return $('.line-event__main-bets-button').eq(8);
                    }
                }
            default:
                return $el;
        }

        return $el;
    };

    /**
     * Opens coupon with stake (stakes)
     * @param {object[]} paramData - array of bets to open
     * @returns {Promise<float, string>}
     */
    const openCoupon = function (paramData) {
        bsDebug(port, 'openCoupon, paramData:', paramData);
        return new Promise(function (onSuccess, onReject) {
            const result = function (success, message) {
                if (success) {
                    if (lData.length > 0) {
                        ourCommand.add('express', ourCommand.getAdded('express') + 1);
                        data = paramData[ourCommand.getAdded('express')];
                        if (typeof data !== 'undefined') {
                            bsDebug(port, 'openCoupon - We got data: ' + (typeof data), data);
                            openElement();
                        } else {
                            if ($('span.cart-header__item_active').text().trim() === 'combo') {
                                onSuccess(parseFloat(message));
                            } else {
                                mouseChain({
                                    target: $('span.cart-header__item:contains("combo")')[0],
                                    events: ['click']
                                })
                                    .then(delayFunction(1000))
                                    .then(() => $('app-input-dropdown input').attr('placeholder').replace(/[^\d.]/g, '').trim())
                                    .then((max) => onSuccess(parseFloat(max.toString())))
                                    .catch(e => onReject('Express MAX error: ' + e));
                            }
                        }
                    } else {
                        onSuccess(parseFloat(message));
                    }
                } else {
                    bsError(port, message);
                    onReject(message);
                }
            };
            const checkCoupon = function () {
                return new Promise((onSuccess, onReject) => {
                    const event = (data.team1 + ' - ' + data.team2).toLowerCase();
                    let result = false;
                    let matches = [];
                    $('div.cart-items-container span.cart-item__event').each(function () {
                        const teams = $(this).text().trim().toLowerCase();
                        matches.push(teams);
                        if (event === teams || locutus_similar_text(event, teams, true) > 60) {
                            onSuccess($(this).parent());
                            result = true;
                            return false;
                        }
                    });
                    if (!result) {
                        onReject('Wrong match opened: ' + matches.join(', '));
                    }
                });
            };
            let lData = paramData.slice();
            let data = {};
            let $betElement;
            const openElement = function () {
                (data.type === 'LIVE' ? openEvent(data) : openEventPrematch(data))
                    .then(() => bsDebug(port, 'Event must be opened!'))
                    .then(() => getBetElement(data))
                    .then($el => $betElement = $el)
                    .then(() => bsDebug(port, 'We got element! Coef: ' + $betElement.text().trim()))
                    .then(() => mouseChain({target: $betElement[0], events: ['click']}))
                    .then(waitForElementF('div.cart-item', 333, 10000, true))
                    .then(checkCoupon)
                    .then(() => $('app-input-dropdown input').attr('placeholder').replace(/[^\d.]/g, '').trim())
                    .then((max) => result(true, max))
                    .catch((e) => result(false, 'Error till open event: ' + e));
            };
            if (ourCommand.getAdded('express') !== false) {
                data = paramData[ourCommand.getAdded('express')];
            } else {
                data = lData.shift();
            }
            if (typeof data !== 'undefined') {
                bsDebug(port, 'openCoupon - basic - We got data: ' + (typeof data), data);
                openElement();
            } else {
                onReject('There is no input data!');
            }
        });
    };

    const openEventPrematch = async (data) => {
        const team1 = data.team1.toLowerCase();
        const team2 = data.team2.toLowerCase();
        const eventName = team1 + ' — ' + team2;
        const sport = typeof sportAccordance[data.sport] === 'undefined' ? '' : sportAccordance[data.sport];

        if (sport === '') {
            throw ('Sport ' + data.sport + ' not supported or presented :(');
        }

        const checkWeAreThere = function () {
            const $teams = $('span.line-event__name-teams b');
            if ($teams.length === 2) {
                const checkEvent = ($teams.eq(0).text().trim() + ' — ' + $teams.eq(1).text().trim()).toLowerCase();
                return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 60;
            } else {
                return false;
            }
        }
        const findEvent = async () => {
            const $champsList = await waitForElement('div.champs', 333, 7777);
            if ($champsList.find('span.champs-header__item:first:textEquals("events")').length > 0) {
                const league = data.league;
                const $leagueEl = $champsList.find('div.champs-container__item:first div.champs__champ').filter(function () {
                    if (locutus_similar_text($(this).find('a.champs__champ-name').text().trim(), league, true) > 98) {
                        return $(this);
                    }
                });

                if ($leagueEl.length > 0) {
                    await mouseChain({
                        target: $leagueEl.find('a.champs__champ-name')[0],
                        events: fullClick,
                        scroll: true
                    });
                    await delayPromise(555);
                    const $eventsList = await waitForElement('span.line-event__name-teams:visible', 333, 7777);
                    let $el = [];
                    await $eventsList.eachAsync(async function () {
                        const $teams = $(this).find('b');
                        if ($teams.length === 2) {
                            const checkEvent = ($teams.eq(0).text().trim() + ' — ' + $teams.eq(1).text().trim()).toLowerCase();
                            if (checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70) {
                                $el = $(this);
                                return false;
                            }
                        }
                    });

                    if ($el.length === 1) {
                        if ($el.closest('div.line-event_activ').length === 0) {
                            await mouseChain({target: $el[0], events: fullClick, scroll: true});
                            await waitForElement('div.dops', 333, 7777);
                        }
                    } else {
                        throw 'Wrong length of Event: ' + $el.length;
                    }

                } else {
                    throw 'Wrong length of League: ' + $leagueEl.length;
                }
            } else {
                throw 'champ list is not exist!';
            }
        }
        const switchToSport = async () => {
            const $filterList = await waitForElement('div.left-filter', 333, 7777);
            const $sportLabel = $filterList.find('span:textEquals("' + sport + '")');
            if ($sportLabel.length) {
                await mouseChain({
                    target: $sportLabel[0],
                    events: fullClick,
                    error: 'Error while sport click'
                });
                await delayPromise(3333);
            }
        }

        if (!checkWeAreThere()) {
            await switchToSport();
            await findEvent();
            await waitForCondition(() => checkWeAreThere() === true, 333, 15000, 'It looks like we are not there!');
        } else {
            return 'We probably on event page!';
        }
    };

    /**
     * Open event table, if we're on it already -  onSuccess
     * @param {object} data
     * @returns {Promise<any>}
     */
    const openEvent = function (data) {
        return new Promise(function (onSuccess, onReject) {
            bsDebug(port, 'openEvent', data);
            const team1 = data.team1.toLowerCase();
            const team2 = data.team2.toLowerCase();
            const eventName = team1 + ' — ' + team2;
            const sport = typeof sportAccordance[data.sport] === 'undefined' ? '' : sportAccordance[data.sport];

            if (sport === '') {
                onReject('Sport ' + data.sport + ' not supported or presented :(');
            }

            const checkScore = function () {
                if (data.score && ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) === -1) {
                    const score = $('div.scoreboard-content__main-score').text().trim();
                    if (score === data.score.replace(/[^0-9:]/g, '').trim()) {
                        onSuccess(score);
                    } else {
                        onReject(score);
                    }
                } else {
                    onSuccess('');
                }
            };
            const result = function (status, message) {
                if (status) {
                    waitForCondition(() => {
                        return checkWeAreThere();
                    }, 777, 10000, 'It looks like we are not there!')
                        .then(() => data.sport === 'FOOTBALL' ? checkScore() : onSuccess())
                        .catch((e) => onReject('SCORE_CHANGED we need: "' + data?.score + '", we have: "' + e + '"'));
                } else {
                    onReject(message);
                }
            };
            const checkWeAreThere = function () {
                //bsDebug(port, 'checkWeAreThere');
                const sportHere = $('a.scoreboard-header__champ-name:first span').text().trim();
                const $teams = $(findSel([
                    'div.scoreboard-content__row_teams span.scoreboard-content__team-name',
                    'span.scoreboard-content__team-name:visible',
                ]));
                if ($teams.length === 2 && sportHere === sport) {
                    const checkEvent = ($teams.eq(0).text().trim() + ' — ' + $teams.eq(1).text().trim()).toLowerCase();
                    return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 60;
                } else {
                    return false;
                }
            };
            const switchToSport = async () => {
                const selectSportLink = async () => {
                    if ($sportLabel.closest('label.sports-filter__item_active').length === 0) {
                        //clear all checkboxes
                        if ($('div.sports-filter label.sports-filter__item_active:textEquals("All")').length === 0) {
                            await mouseChain({
                                target: $('div.sports-filter label.sports-filter__item_all')[0],
                                events: fullClick,
                                error: 'Error while All click'
                            });
                            await delayPromise(1500);
                            await mouseChain({
                                target: $filterList.find('span.sports-filter__item-text:textEquals("' + sport + '")')[0],
                                events: fullClick,
                                error: 'Error while sport click'
                            });
                            await delayPromise(555);
                        } else {
                            //select sport
                            if ($filterList.find('span.sports-filter__item-text:textEquals("' + sport + '")').parent().hasClass('sports-filter__item_active') !== true) {
                                await mouseChain({
                                    target: $filterList.find('span.sports-filter__item-text:textEquals("' + sport + '")')[0],
                                    events: fullClick,
                                    error: 'Error while sport click'
                                });
                            }
                            await delayPromise(555);
                        }
                    }
                };
                const $filterList = await waitForElement('span.sports-filter__list', 333, 7777);
                const $sportLabel = $filterList.find('span.sports-filter__item-text:textEquals("' + sport + '")');

                if ($sportLabel.length > 0) {
                    //select sport link
                    return await selectSportLink();
                } else {
                    throw sport + ' not presented at moment!';
                }
            };
            const findEvent = async () => {
                await switchToSport();
                bsDebug(port, 'switchToSport: ' + sport);
                await delayPromise(222);
                let $el = [];
                const $eventsList = await waitForElement('span.line-event__name-teams:visible', 333, 7777);
                await $eventsList.eachAsync(async function () {
                    const $teams = $(this).find('div.line-event__name-text');
                    if ($teams.length === 2) {
                        const checkEvent = ($teams.eq(0).text().trim() + ' — ' + $teams.eq(1).text().trim()).toLowerCase();
                        //console.log(checkEvent + ' === ' + eventName);
                        if (checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 70) {
                            $el = $(this);
                            return false;
                        }
                    }
                });

                if ($el.length === 1) {
                    await mouseChain({target: $el[0], events: fullClick, scroll: true});
                } else {
                    throw 'Wrong length of Event: ' + $el.length;
                }
            };
            const goRightPage = function () {
                delayPromise(111)
                    .then(() => {
                        if ($('div.line__controls:visible').length === 0) {
                            return mouseChain({
                                target: $('a.menu__item[href="/en/live"]').first()[0],
                                events: ['click'],
                                scroll: true
                            })
                                .then(delayFunction(2222));
                        }
                    })
                    .then(findEvent)
                    .then(() => result(true, ''))
                    .catch((e) => result(false, 'findEvent 1:' + e));
            };
            if (!checkWeAreThere()) {
                goRightPage();
            } else {
                result(true, 'We probably on event page!');
            }
        });
    };

    /**
     * Close early opened coupons
     * @param skipParam [{boolean}] default FALSE - whether we need to skip closing
     * @returns {Promise<string,string>}
     */
    const closePreviousCoupons = async state => {
        bsDebug(port, 'closePreviousCoupons', state);
        if (state) {
            for (let i=0; i<$coupons().length; i++) {
                if ($coupons().length > settings.newExpressBetsAmount) {
                    await mouseChain({
                        target: $coupons().last().find('span.cart-item__remove')[0], 
                        events: fullClick, 
                        error: 'closeCoupon'
                    });
                    await delayPromise(555);
                }
            }
        } else {
            const removeStakes = async () => {
                const closeOne = async () => {
                    for (const $close of $('span.cart-item__remove')) {
                        await mouseChain({target: $close[0], events: fullClick, scroll: true, error: 'clearOne'});
                    }
                };
                // Hint: Click 'Remove all' once or every 'Close'
                const $clearBtn = $('div.cart-top__left span.icon_close');
                if ($clearBtn.length === 1) {
                    await mouseChain({target: $clearBtn[0], events: fullClick, scroll: true, error: 'clearAll'});
                } else {
                    await closeOne();
                }
            };
            await removeStakes();
        }
    };

    const register = function (data) {
        bsDebug(port, 'register!');
        return new Promise(function (onSuccess, onReject) {
            let betcityAccordance = {
                'москва': 'Москва',
                'московская область': 'Московская область',
                'ярославская область': 'Ярославская область',
                'ивановская область': 'Ивановская область',
                'костромская область': 'Костромская область',
                'вологодская область': 'Вологодская область',
                'архангельская область': 'Архангельская область',
                'ненецкий автономный округ': 'Ненецкий автономный округ',
                'коми республика': 'Республика Коми',
                'тверская область': 'Тверская область',
                'новгородская область': 'Новгородская область',
                'псковская область': 'Псковская область',
                'мурманская область': 'Мурманская область',
                'карелия республика': 'Республика Карелия',
                'ленинградская область': 'Ленинградская область',
                'санкт-петербург': 'Санкт-Петербург',
                'смоленская область': 'Смоленская область',
                'калининградская область': 'Калининградская область',
                'брянская область': 'Брянская область',
                'калужская область': 'Калужская область',
                'крым республика': 'Республика Крым',
                'севастополь': 'Севастополь',
                'тульская область': 'Тульская область',
                'орловская область': 'Орловская область',
                'курская область': 'Курская область',
                'белгородская область': 'Белгородская область',
                'ростовская область': 'Ростовская область',
                'краснодарский край': 'Краснодарский край',
                'ставропольский край': 'Ставропольский край',
                'калмыкия республика': 'Республика Калмыкия',
                'кабардино-балкарская республика': 'Кабардино-Балкарская республика',
                'северная осетия - алания республика': '',
                'чеченская республика': 'Республика Северная Осетия— Алания',
                'дагестан республика': 'Республика Дагестан',
                'карачаево-черкесская республика': 'Карачаево-Черкесская Республика',
                'адыгея республика': 'Республика Адыгея',
                'ингушетия республика': 'Республика Ингушетия',
                'рязанская область': 'Рязанская область',
                'тамбовская область': 'Тамбовская область',
                'воронежская область': 'Воронежская область',
                'липецкая область': 'Липецкая область',
                'волгоградская область': 'Волгоградская область',
                'саратовская область': 'Саратовская область',
                'астраханская область': 'Астраханская область',
                'татарстан республика': 'Республика Татарстан',
                'марий эл республика': 'Республика Марий Эл',
                'удмуртская республика': 'Удмуртская Республика',
                'чувашия республика': 'Чувашская Республика',
                'мордовия республика': 'Республика Мордовия',
                'ульяновская область': 'Ульяновская область',
                'пензенская область': 'Пензенская область',
                'самарская область': 'Самарская область',
                'башкортостан республика': 'Республика Башкортостан',
                'челябинская область': 'Челябинская область',
                'оренбургская область': 'Оренбургская область',
                'владимирская область': 'Владимирская область',
                'нижегородская область': 'Нижегородская область',
                'кировская область': 'Кировская область',
                'пермский край': 'Пермский край',
                'свердловская область': 'Свердловская область',
                'тюменская область': 'Тюменская область',
                'ханты-мансийский-югра автономный округ': 'Ханты-Мансийский автономный округ',
                'ямало-ненецкий автономный округ': 'Ямало-Ненецкий автономный округ',
                'новосибирская область': 'Новосибирская область',
                'томская область': 'Томская область',
                'курганская область': 'Курганская область',
                'омская область': 'Омская область',
                'красноярский край': 'Красноярский край',
                'алтай республика': 'Республика Алтай',
                'кемеровская область': 'Кемеровская область',
                'хакасия республика': 'Республика Хакасия',
                'алтайский край': 'Алтайский край',
                'иркутская область': 'Иркутская область',
                'тыва республика': 'Республика Тыва',
                'бурятия республика': 'Республика Бурятия',
                'забайкальский край': 'Забайкальский край',
                'амурская область': 'Амурская область',
                'саха (якутия) республика': 'Республика Саха (Якутия)',
                'еврейская автономная область': 'Еврейская автономная область',
                'хабаровский край': 'Хабаровский край',
                'камчатский край': 'Камчатский край',
                'магаданская область': 'Магаданская область',
                'чукотский автономный округ': 'Чукотский автономный округ',
                'приморский край': 'Приморский край',
                'сахалинская область': 'Сахалинская область'
            };
            let report = function (success, message) {
                port.postMessage({
                    answered: "REGISTER",
                    data: {
                        success: success,
                        queue_id: ourCommand.get().queue_id
                    },
                    answer: message
                });
                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                }
            };
            let waitForConfirmUrl = function (timeout, maxWait) {
                let max = typeof maxWait === 'number' ? maxWait : 180000;
                return new Promise(function (onSuccess, onReject) {
                    let waitStarted = Date.now();
                    let performCheck = function () {
                        bsEmailCheck(data.email, 'BETCITY_CONFIRM_CODE', timeout)
                            .then((m) => {
                                bsDebug(port, 'Email answer:', m);
                                if (m.status === 'success' && typeof m.message === 'object' && m.message.length > 0
                                    && typeof m.message[0].data === 'string') {
                                    onSuccess(m.message[0].data);
                                } else if (Date.now() - waitStarted < max) {
                                    delayPromise(5555).then(performCheck);
                                } else {
                                    throw 'We had waited for email with confirm url for ' + (Date.now() - waitStarted) + 'ms and nothing :(';
                                }
                            })
                            .catch((e) => onReject(e));
                    };
                    performCheck();
                });
            };
            let paypass;
            let regoroll = function () {
                waitForElement('a[href="/en/reg"]', 333, 30000)
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('#login', 333, 20000, true))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#login')[0], data['nickname']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#password')[0], data['password']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#password_repeat')[0], data['password']))
                    .then(delayFunction(3333))
                    // Hint: I specially leave it here
                    .then(() => {
                        let $currency = $('select#currency');
                        $currency[0].focus();
                        $currency.find('option[value="1"]').prop('selected', true);
                        fireInputEvent($currency[0]);
                        fireChangeEvent($currency[0]);
                        $currency[0].blur();
                    })
                    .then(delayFunction(3333))
                    // Hint: To remember the way to do it differently
                    .then(() => {
                        let $country = $('select#country');
                        return selectLikePuppeteer($country[0], ['1']);
                    })
                    .then(delayFunction(3333))
                    .then(() => {
                        let $email = $('input#email');
                        $email.val(data['email']);
                        fireInputEvent($email[0]);
                        fireChangeEvent($email[0]);
                    })
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#phone')[0], data['phone']))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({
                        target: $('span:textEquals("Subscribe to news")').parent().find('input[type="checkbox"]')[0],
                        events: ['click']
                    }))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({
                        target: $('span:contains("I confirm that I am 18 years old")').parent().find('input[type="checkbox"]')[0],
                        events: ['click']
                    }))
                    .then(delayFunction(3333))
                    .then(waitForCondition(() => {
                        let aStatus = $('div.antigate_solver a.status').last().text().trim();
                        if (aStatus === 'Solved') {
                            return true;
                        } else if (aStatus.indexOf('Outdated') > -1) {
                            mouseChain({target: $('a.control.reload')[0], events: ['click']})
                                .then().catch();
                            return false;
                        } else {
                            return false;
                        }
                    }, 555, 120000, 'reCaptcha not solved for 120s', true))
                    .then(() => ourCommand.add('waitForEmail', Math.ceil(Date.now() / 1000) - 60))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({target: $('#submit_button')[0], events: ['click'], scroll: true}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('input#verify', 333, 15000, true))
                    // Hint: Wait for email...
                    .then(() => waitForConfirmUrl(ourCommand.getAdded('waitForEmail')))
                    .then((code) => clearAndSimulate($('input#verify')[0], code))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({target: $('#submit_button')[0], events: ['click'], scroll: true}))
                    .then(waitForElementF('div.reg-success', 333, 20000, true))
                    .then(delayFunction(5555))
                    // Hint: Fill in user data form
                    .then(waitForElementF('a.header-menu__item[href="/en/account/pslist/in"]', 333, 15000, true))
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('input#second_name', 333, 15000, true))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#first_name')[0], data['first_name']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#last_name')[0], data['second_name']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#second_name')[0], data['third_name']))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({target: $('input[type="radio"][name="sex"]')[0], events: ['click']}))
                    .then(delayFunction(3333))
                    .then(() => {
                        let region = typeof betcityAccordance[data['region']] === 'string' ? betcityAccordance[data['region']] : '';
                        if (region === '') {
                            throw data['region'] + ' has no accordance in BetCity :(';
                        }
                        let $r = $('app-select[formcontrolname="region"] select');
                        if ($r.val() !== region) {
                            return selectLikePuppeteer($r.get(0), [region])
                        }
                    })
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('input#city')[0], data['city']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('textarea#address')[0], data['address']))
                    .then(delayFunction(3333))
                    .then(() => {
                        let bdp = data['birth_date'].split('-');
                        if (bdp.length !== 3 || isNaN(parseInt(bdp[0])) || isNaN(parseInt(bdp[1])) || isNaN(parseInt(bdp[2]))) {
                            throw 'Incorrect data format: ' + data['birth_date'];
                        }
                        return selectLikePuppeteer($('select#birth_day').get(0), [bdp[2]])
                            .then(delayFunction(3333))
                            .then(() => selectLikePuppeteer($('select#birth_month').get(0), [parseInt(bdp[1]).toString()]))
                            .then(delayFunction(3333))
                            .then(() => selectLikePuppeteer($('select#birth_year').get(0), [bdp[0]]))
                            .then(delayFunction(3333))
                            .then(() => selectLikePuppeteer($('select#agree_data').get(0), ['1']));
                    })
                    .then(delayFunction(3333))
                    .then(() => mouseChain({
                        target: $('button[type="submit"]:textEquals("Save")')[0],
                        events: ['click']
                    }))
                    .then(delayFunction(3333))
                    .then(waitForElementF('div.pays-list', 333, 20000, true))
                    .then(delayFunction(3333))
                    // Hint: setup payment password
                    .then(waitDelayClickF('a.menu__item[href="/en/account/current"]'))
                    .then(waitDelayClickF('div.sub-menu a:textEquals("Account details")'))
                    .then(waitDelayClickF('button:textEquals("To create payment password")'))
                    .then(waitForElementF('span:contains("Your new payment password")'))
                    .then(($el) => paypass = $el.text().replace(/[^\d]/g, '').trim())
                    .then(() => console.log(paypass))
                    .then(delayFunction(3333))
                    // Hint: Success!
                    .then(() => report(true, {
                        login: data['email'], password: data['password'],
                        comment: 'Paypass: ' + paypass + ', all text: "' + $('span:contains("Your new payment password")').text().trim() + '"'
                    }))
                    .catch((e) => report(false, 'Register 1: ' + e));
            };
            delayPromise(1111).then(regoroll);
        });
    };

    const withdraw = function (data) {
        bsDebug(port, 'Withdraw!', data);
        return new Promise(function (onSuccess, onReject) {
            const report = function (success, message) {
                bsDebug(port, 'Report! ' + success + ' / ' + message);
                port.postMessage({
                    answered: "WITHDRAW",
                    status: success ? "SUCCESS" : "FAILED",
                    answer: message
                });
                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                }
            };

            let depositResult = {};
            const getDepositResult = function () {
                chrome.storage.local.get(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET'], function (result) {
                    //bsDebug(port, 'Deposit result:', result, 'COLOR:yellow,red');
                    if (typeof result.DEPOSIT_RESULT !== 'undefined' && typeof result.DEPOSIT_RESULT_WAS_SET !== 'undefined'
                        && Date.now() - result.DEPOSIT_RESULT_WAS_SET < 70000) {
                        depositResult = result.DEPOSIT_RESULT;
                    } else {
                        depositResult = {};
                    }
                });
            };
            const selector = 'div.sub-menu a:textEquals("Withdraw")';
            delayPromise(111)
                .then(() => {
                    if (window.location.href.indexOf('/en/account/') === -1) {
                        return waitForElement('a.menu__item[href="/en/account/current"]', 333, 10000)
                            .then(($el) => delayPromise(2222, $el))
                            .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                            .then(delayFunction(3333));
                    }
                })
                .then(waitForElementF(selector, 333, 15000, true))
                .then(($el) => delayPromise(2222, $el))
                .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                .then(delayFunction(2000))
                .then(waitForCondition(() => {
                    return $(selector).hasClass('sub-menu__item_active');
                }, 333, 10000, 'Withdraw not selected', true))
                .then(delayFunction(2000))
                // Hint: Click Qiwi
                .then(waitForElementF('div.pays-header:has(span.pays-header-name:contains("Visa QIWI Wallet"))', 333, 20000, true))
                .then(($el) => delayPromise(2222, $el))
                .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                .then(delayFunction(3333))
                .then(waitForElementF('form.pays-form', 333, 20000, true))
                .then(() => delayPromise(2222))
                .then(() => clearAndInputNumber($('input[type="text"][name="amount"]')[0], data.amount))
                .then(delayFunction(3333))
                .then(() => {
                    ourCommand.add('increaseDelay', true);
                    ourCommand.add('close', true);
                    //ourCommand.add('qiwiPayCheckNew', true);
                    chrome.storage.local.remove(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET'], function () {
                        chrome.storage.local.set({
                            'QIWI_COMMAND': ourCommand.get(),
                            'QIWI_COMMAND_WAS_SET': Date.now()
                        });
                    });
                })
                .then(() => mouseChain({target: $('button:contains("Make a request")')[0], events: ['click']}))
                .then(delayFunction(3333))
                .then(() => {
                    const err = $('span.pays-form-items__label-sub_error').text().trim();
                    if (err !== '') {
                        throw err;
                    }
                })
                .then(waitForElementF('a.pays-form-footer__button_info:textEquals("Go to the CUPIS.")', 333, 20000, true))
                .then(($el) => delayPromise(2222, $el))
                .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                //.then(delayFunction(3333))
                .then(waitForCondition(() => {
                    getDepositResult();
                    return typeof depositResult.success === 'boolean';
                }, 1000, 400000, 'no deposit result (or it is outdated) for 400s!', true))
                .then(() => console.log(depositResult))
                .then(() => report(depositResult.success, typeof depositResult.message === 'string' ? depositResult.message : 'No message :('))
                .catch((e) => report(false, 'When go: ' + e));
        });
    };

    /**
     * Deposit
     * @param data
     * @returns {Promise<any>}
     */
    const deposit = function (data) {
        bsDebug(port, 'Deposit!', data);
        return new Promise(function (onSuccess, onReject) {
            const report = function (success, message) {
                ourCommand.add('increaseDelay', false);
                ourCommand.add('qiwiEntered', false);
                bsDebug(port, 'Report! ' + success + ' / ' + message);
                port.postMessage({
                    answered: "DEPOSIT",
                    status: ((s, m) => {
                        if (s) {
                            return 'SUCCESS';
                        } else if (m.indexOf('NO_FUNDS') > -1) {
                            return 'NO_FUNDS';
                        } else if (m.indexOf('RESTRICTED') > -1) {
                            return 'RESTRICTED';
                        } else {
                            return 'FAILED';
                        }
                    })(success, message),
                    answer: message
                });
                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                }
            };
            let depositResult = {};
            const getDepositResult = function () {
                chrome.storage.local.get(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET'], function (result) {
                    //bsDebug(port, 'Deposit result:', result, 'COLOR:yellow,red');
                    if (typeof result.DEPOSIT_RESULT !== 'undefined' && typeof result.DEPOSIT_RESULT_WAS_SET !== 'undefined'
                        && Date.now() - result.DEPOSIT_RESULT_WAS_SET < 70000) {
                        depositResult = result.DEPOSIT_RESULT;
                    } else {
                        depositResult = {};
                    }
                });
            };
            const letsRockNRoll = function () {
                bsDebug(port, 'letsRockNRoll');
                //'a.menu__item[href="/en/account/current"]'
                waitForElement('a.menu__item[href="/en/account/current"]', 333, 15000, true)
                    .then(($el) => delayPromise(2222, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                    .then(delayFunction(3333))

                    .then(waitForElementF('a.sub-menu__item[href="/en/account/pslist/in"]', 333, 15000, true))
                    .then(($el) => delayPromise(2222, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                    .then(delayFunction(3333))

                    .then(waitForElementF('div.pays-header:has(span.pays-header-name:contains("Visa QIWI Wallet"))', 333, 20000, true))
                    .then(($el) => delayPromise(2222, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('input[name="amount"]', 333, 20000, true))
                    .then(($el) => delayPromise(2222, $el))
                    .then(($el) => clearAndInputNumber($el[0], data.amount))
                    .then(delayFunction(3333))
                    .then(() => {
                        ourCommand.add('increaseDelay', true);
                        ourCommand.add('close', true);
                        //ourCommand.add('qiwiPayCheckNew', true);
                        chrome.storage.local.remove(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET'], function () {
                            chrome.storage.local.set({
                                'QIWI_COMMAND': ourCommand.get(),
                                'QIWI_COMMAND_WAS_SET': Date.now()
                            });
                        });
                    })
                    .then(() => mouseChain({
                        target: $('button:contains("To be filled in")')[0],
                        events: ['click']
                    }))
                    .then(delayFunction(3333))
                    .then(waitForElementF('a.pays-form-footer__button_info:textEquals("Go to the CUPIS.")',
                        333, 15000, true))
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                    // Hint: Go to QIWI
                    .then(waitForCondition(() => {
                        getDepositResult();
                        return typeof depositResult.success === 'boolean';
                    }, 1000, 400000, 'no deposit result (or it is outdated) for 400s!', true))
                    // Hint: Success!
                    .then(() => console.log(depositResult))
                    .then(() => report(depositResult.success, typeof depositResult.message === 'string' ? depositResult.message : 'No message :('))
                    .catch((e) => report(false, 'Deposit 1: ' + e));

            };
            letsRockNRoll();
        });
    };

    /**
     * Collect bet history
     * @param inD
     * @returns {Promise<any>}
     */
    const collectBetResults = inD => new Promise(function (onSuccess, onReject) {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        bsDebug(port, 'collectBetResults, limit: ' + limit + ', data:', data);
        const report = function (success, message) {
            bsDebug(port, 'Collect data: success = ' + success + ', message = ' + message + ', data:', data);
            port.postMessage({
                answered: ourCommand.get().action,
                status: success ? "success" : "error",
                answer: success ? collected : message
            });

            if (success) {
                onSuccess(collected);
            } else {
                onReject(message);
            }
        };

        const doCollect = function () {

            const tabActive = $('a.sub-menu__item_active').text().trim();
            const tabActiveSelect = tabActive === "Unsettled bets" ? 'div.ac-item' : 'div.account-base-item';

            return waitForElement(tabActiveSelect, 333, 10000)
                .catch(() => console.log('No bets on tab :('))
                .then(() => {

                    $(tabActiveSelect).each(function () {
                        const $this = $(this);
                        const external_id = $(this).find('span:contains("Betting №")').text().trim().split(',')[0].replace(/[^\d.]/g, '').trim();
                        let status = 'ACCEPTED';
                        let stake = parseFloat($this.find('div.account-base-item__sub_right').first().text().replace(/[^\d.]/g, '').trim());
                        let result = parseFloat($this.find('div.account-base-item__sub_right').eq(1).text().replace(/[^\d.]/g, '').trim());
                        if ($this.hasClass('account-base-item_win')) {
                            status = 'WON';
                        } else if ($this.hasClass('account-base-item_cancel')) {
                            status = 'REFUNDED';
                        } else if ($this.hasClass('account-base-item_defeat')) {
                            status = 'LOSE';
                        }
                        if (data.length === 0 && collected.length < limit || data.indexOf(external_id) > -1) {
                            collected.push({
                                external_id: external_id,
                                status: status,
                                match: $this.next().find('span.account-base-item__sub_double > span').first().text().trim(),
                                bkPivot: $this.next().find('span.account-base-item__sub').eq(2).text().trim(),
                                coef: $this.find('div.account-base-item__sub_right').first().next().text().trim(),
                                stake: stake.toString(),
                                result: result.toString()
                            });
                        }
                    });
                });
        };

        const needCollect = [
            'div.sub-menu a:textEquals("Unsettled bets")',
            'div.sub-menu a:textEquals("Settled bets")'
        ];
        const performCollect = function () {
            return new Promise((onSuccess, onReject) => {
                //let datesAdded = false;
                const openAndCollect = function (selector) {
                    console.log('selector ', selector);
                    if (typeof selector === 'undefined'
                        || collected.length >= limit
                        || (data.length !== 0 && collected.length === data.length)) {
                        onSuccess(collected);
                    } else {
                        waitForElement(selector, 333, 10000, true)
                            .then($sel => {
                                if (!$sel.hasClass('sub-menu__item_active')) {
                                    return mouseChain({target: $sel[0], events: ['click']})
                                        .then(delayFunction(2000))
                                        .then(waitForCondition(() => {
                                            return $(selector).hasClass('sub-menu__item_active') || $(selector).is(':disabled');
                                        }, 333, 10000, 'Not selected', true))
                                        .then(delayFunction(2000));
                                }
                            })
                            // .then(() => {
                            //     const date = $('span.datepicker__date-chain button:enabled:visible').last();
                            //     if (!datesAdded && date.length > 0) {
                            //         datesAdded = true;
                            //         needCollect.push('span.datepicker__date-chain button:contains("' + date.text().trim() + '")');
                            //     }
                            // })
                            .then(() => {
                                return doCollect();
                            })
                            .then(() => openAndCollect(needCollect.shift()))
                            .catch(e => onReject('performCollect: ' + e));
                    }
                };
                openAndCollect(needCollect.shift())
            });
        };
        delayPromise(111)
            .then(() => {
                if (window.location.href.indexOf('/en/account/') === -1) {
                    return waitForElement('a.menu__item[href="/en/account/current"]', 333, 10000)
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(3333));
                }
            })
            .then(performCollect)
            .then(collected => report(true, collected))
            .catch(e => report(false, 'Can\'t collect 1: ' + e));
    });

    /**
     * Authorization
     */
    const authCheck = function () {
        authCheckWorker()
            .then()
            .catch(e => dLog('red', 'betcity', `Auth check error: ${e}, ${formatStack(e.stack)}`))
            .finally(async () => {
                await delayPromise(settings.authCheckInterval);
                authCheck();
            });
    };

    const authCheckWorker = async () => {
        const
            $logLink = $('a.user-auth-block__button:contains("Sign In")'),
            $pushConfirm = $('div.push-confirm:visible'),
            $pushUpdate = $('button.button:textEquals("Update")');

        if (enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            dLog('red', 'betcity', 'ERROR AUTH!');
            return;
        }

        await closeAllWeNeed({
            'button:textEquals("I accept")': 'button:textEquals("I accept")',
            'button.cookie-modal__button': 'button.cookie-modal__button',
        });

        if ($pushConfirm.length > 0) {
            await mouseChain({
                target: $pushConfirm.find('div.push-confirm__button:textEquals("Later")')[0],
                events: ['click'], error: 'push confirm later',
            });
        }

        if ($pushUpdate.length > 0) {
            await mouseChain({
                target: $pushUpdate[0],
                events: ['click'], error: 'push update',
            });
        }

        if (Date.now() - domLoaded > 3000 && $('a[href="/en/line"]').length === 0) {
            window.location.href = window.location.origin + '/en/live';
        }

        if ($logLink.length > 0) {
            port.postMessage({m: "tech works! 2"});
            await delayPromise(1000);
            await tryToLogIn();
        } else {

            if (settings.lastScoreBasketball === '999') {
                if (Date.now() - settings.sourceDate >= 300000) {
                    settings.sourceDate = Date.now();
                    settings.sourceRandom = getSourceRandom();
                    if (settings.sourceRandom >= 15 && settings.sourceRandom <= 19) {
                        settings.newExpresses = true;
                        if (settings.sourceRandom >= 15 && settings.sourceRandom <= 17) {
                            settings.newExpressBetsAmount = 1;
                        }
                    } else {
                        waitSource = false;
                        settings.newExpresses = false;
                    }

                    dLog('blue', 'BETCITY', `Source current random value - ${settings.sourceRandom}`);
                }
            }

            if (settings.newExpresses && !busy) {
                busy = true;
                const WasSuccessExpressNew = await bMess('WasSuccessExpressNew').infinite().catch(() => 0);
                const betsState = await waitForCondition(() => $coupons().length > 0, 333, 2222).catch(() => $([]));

                if (WasSuccessExpressNew && betsState.length === 0) {
                    await bMess('WasSuccessExpressNew').remove();
                }

                if (!WasSuccessExpressNew) {
                    dLog('green', 'BETCITY', 'START find NewExpress event!');
                    // clear coupons
                    await closePreviousCoupons(false);

                    waitSource = false;
                    await ProccedExpressNew().catch((e) => {
                        dLog('red', 'BETCITY', 'ProccedExpressNew Error - ' + e);
                        bMess('WasSuccessExpressNew').set(false);
                    });
                }
                busy = false;
            }

            const $balanceEl = $('span.user-info__item-step-head:textEquals("Balance")').next();
            if ($balanceEl.length > 0) {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(false),
                });
            }
        }
    };

    const tryToLogIn = async () => {
        console.log('%c' + 'tryToLogIn',
            'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');

        if (settings.login.indexOf('@') > -1) {
            throw 'INVALID_CREDENTIALS';
        }

        const $logLink = $('a.user-auth-block__button:contains("Sign In")');
        if ($logLink.length !== 1) {
            throw 'No $logLink!';
        }
        if (Date.now() - authClicked < 50000) {
            throw 'Too soon!';
        }

        authClicked = Date.now();
        await mouseChain({target: $logLink[0], events: ['click'], scroll: true, error: 'LogLink'});
        await waitForElement('input[name="login"]', 333, 10000);
        await delayPromise(1000);

        const tText = ['Login', '№ account', 'Phone']
            [settings.login.indexOf('+') === 0 ? 2
            : settings.login.replace(/[\d]/g, '') === '' ? 1 : 0];
        dLog('red', 'BC', `tText is ${tText}`);
        settings.login = tText === 'Phone' ? settings.login.replace('+7', '') : settings.login;
        await mouseChain({
            target: $(`div.login__tabs-item:textEquals(${tText})`)[0],
            events: ['click'],
            scroll: true,
            error: 'login tab click'
        });
        await delayPromise(1500);

        await clearAndSimulate($('input[name="login"]')[0], settings.login);
        await delayPromise(3000);
        await clearAndSimulate($('input[name="pass"]')[0], settings.password);
        await delayPromise(3000);
        await mouseChain({target: $('button#loginBtnSignIn')[0], events: ['click'], error: 'LS'});
        await delayPromise(3000);
        const err = $('span.login-row__error:visible').text().trim();
        if (err.length > 0) {
            enterError = true;
            authClicked = Date.now() + 24 * 3600 * 1000;
            throw err;
        }
    };

    /**
     * Get balance
     * @param returnNull
     * @returns {number}
     */
    function getBalance(returnNull) {
        const $b = $('span.user-info__item-step-head:textEquals("Balance")').next();
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.text().replace(/[^\d.]/g, '').trim());
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            chrome.storage.local.set({
                'BETCITY_COMMAND': ourCommand.get(),
                'BETCITY_COMMAND_WAS_SET':
                    increaseDelay ? Date.now() + 120000 : Date.now()
            });
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        domLoaded = Date.now();
        port.postMessage({m: "PAGE LOADED!"});
        console.log('loaded and message sent!');
        chrome.storage.local.get(['BETCITY_COMMAND', 'BETCITY_COMMAND_WAS_SET'], function (result) {
            bsDebug(port, 'Saved command:', result);
            if (typeof result.BETCITY_COMMAND !== 'undefined' && typeof result.BETCITY_COMMAND_WAS_SET !== 'undefined'
                && Date.now() - result.BETCITY_COMMAND_WAS_SET < 40000) {
                let currentCommand = result.BETCITY_COMMAND;
                chrome.storage.local.remove(['BETCITY_COMMAND', 'BETCITY_COMMAND_WAS_SET'], function () {
                    waitForCondition(() => {
                        return wasAuthCheck !== false;
                    }, 222, 10000, 'AuthCheck was not', false)
                        .then(() => messageProcessor(currentCommand))
                        .catch((e) => bsError(port, 'Something wrong with auth check! ' + e));
                });
            } else {
                chrome.storage.local.remove(['BETCITY_COMMAND', 'BETCITY_COMMAND_WAS_SET']);
            }
        });
    }

})();
