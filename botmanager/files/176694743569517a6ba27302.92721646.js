(function () {
    "use strict";

    let authClicked = 0;
    let authClickedCount = 0;
    let busy = false;
    const bkHere = "onewin";
    let port = chrome.runtime.connect({name: `port_${bkHere}`});
    let settings = {
        authCheckInterval: 2000,
        url: 'https://1wthbb.com/',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        stake_fork: {},
        eventTimeLimit: 2400000,
        eventMaxBets: 1,
        betweenBets: 25000,
        newExpresses: false,
        source: {
            X: 407,
            Y: 406,
            Z: 405,
        },
        sourceRandom: 0,
        sourceDate: 0,
    };

    let currentBetData = false;
    let enterError = false;
    let sourceExpress = false;
    let waitSource = false;

    let ourCommand = new ourCommandProto();
    const fullClick = ['mouseover', 'mousedown', 'click', 'mouseup'];
    const logLink = 'button[data-testid="header-auth-button"]';
    const $coupons = () => $('div[class^="_coupon_"] div[class^="_main_"]');

    const getSourceRandom = () => {
        return Math.floor(Math.random() * 30) + 1;
    };

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
    }

    const messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        let $logLink = $(logLink);
        if (message.action !== 'auth' && busy) {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY"
            });
        } else if (message.action === "auth") {
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = 1;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 2400000;
            settings.betweenBets = message.betweenBets || 40000;
            settings.lastScoreBasketball = message?.stake_fork?.lastScoreBasketball || '';
            settings.newExpresses = !!(settings?.stake_fork && settings.stake_fork?.newExpresses);
            settings.newExpressBetsAmount = Number(message?.stake_fork?.newExpressBetsAmount) || 2;
            if (settings.lastScoreBasketball === '999') {
                settings.sourceDate = Date.now();
                settings.sourceRandom = getSourceRandom();

                // if (settings.sourceRandom >= 16 && settings.sourceRandom <= 17) {
                //     settings.newExpresses = true;
                //     waitSource = true;
                //     if (settings.sourceRandom >= 17 && settings.sourceRandom <= 17) {
                //         settings.newExpressBetsAmount = 1;
                //     }
                // } else {
                //     waitSource = false;
                // }
                dLog('blue', '1WIN', `Source current random value - ${settings.sourceRandom}`);
            }
            authCheck();
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
                bsDebug(port, 'BET for: ' + message.data[0].market + '/' + message.data[0].target + '/' + message.data[0].pivot
                    + ', stake: ' + message.data[0].stake + ' on ' + message.data[0].coef + ', with ' + message.data[0].score);
                proceedBet(message.data);
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
                proceedBet(message.data);
                bsDebug(port, 'EXPRESS_BET', message);
            }
        } else if (message.action === 'BET_RESULT') {
            busy = true;
            ourCommand.set(message);
            let success = false;
            let error = '';
            let collected = [];
            collectBetResults(message.data)
                .then(c => (success = true, collected = c))
                .catch(e => error = e)
                .then(async () => {
                    port.postMessage({
                        answered: "BET_RESULT",
                        status: success ? "success" : "error",
                        answer: success ? collected : error
                    });
                    busy = false;
                    ourCommand.clear();
                });
        }
    };

    /**
     * Get balance
     * @param {*} returnNull 
     * @returns 
     */
    function getBalance(returnNull) {
        const $b = $('div[data-testid="header-balance-sum"]');
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.trt().replace(/[^\d.]/g, ''));
    };

    /**
     * Go to history page
     * @returns {Promise<string>}
     */
    const goToHistory = async () => {
        const historyLabel = bkHere === 'onewin' ? 'Bets history' : 'История ставок';
        const $menuButton = await waitForElement('div.user-menu__toggle', 333, 10000);
        await delayPromise(555);
        await mouseChain({target: $menuButton[0], events: fullClick, error: '$menuButton'});
        await delayPromise(555);
        const $betsHistory = await waitForElement(`span.user-menu__item:textEquals(${historyLabel})`, 333, 10000);
        await delayPromise(555);

        if (elementIsVisible($betsHistory[0])) {
            await mouseChain({target: $betsHistory[0], events: fullClick, error: '$betsHistory'});
            await delayPromise(555);
        } else {
            throw 'Bets history is not visible';
        }

        return 'Must be there!';
    };

    /**
     * Collecting bet results
     * @param inD
     * @returns {Promise<Array>}
     */
    const collectBetResults = async (inD) => {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 40 ? parseInt(inD[1]) : 40) : 40;
        const collectDetails = async ($rows) => {
            await $rows.eachAsync(async function (key) {
                if (++key > limit) return false;
                const
                    stake = $(this).find('p:textEquals("Bet amount")').next().trt().replace(/[^.\d]/g, ''),
                    result = $(this).find('p:textEquals("Bet amount")').parent().next().find('p[class^="_value_"]')
                        .trt().replace(/[^.\d]/g, ''),
                    coef = $(this).find('span[class*="_coef_"]').trt(),
                    external_id = $(this).find('div[class^="_id_"]').trt().replace(/\D/g, ''),
                    statusVal = $(this).find('span[class*="_status_"]').trt();
                let status = 'ACCEPTED';
                if (data.length === 0 || data.indexOf(external_id) > -1) {
                    if (bkHere === 'onewin') {
                        if (statusVal === 'Win') {
                            status = 'WON';
                        } else if (statusVal === 'Loss') {
                            status = 'LOSE';
                        } else if (statusVal === 'Return') {
                            status = 'REFUNDED';
                        }
                    } else {
                        if (statusVal === 'Победа') {
                            status = 'WON';
                        } else if (statusVal === 'Проигрыш') {
                            status = 'LOSE';
                        }
                    }

                    collected.push({
                        external_id: external_id,
                        status: status,
                        coef: isNaN(coef) || coef === -1 ? '' : coef.toString(),
                        stake: stake,
                        result: status === 'ACCEPTED' ? '' : status === 'LOSE' ? '0' : result,
                    });
                }
            });
        };

        if (window.location.href.indexOf('/betting/bets-history') === -1) {
            await goToHistory();
        }

        let $historyItems = await waitForElement('div[class^="_list_"] > div[class^="_root_"]',
            333, 10000).catch(() => $([]));
        if ($historyItems.length === 0) {
            return collected;
        }

        await collectDetails($historyItems);

        dLog('green', '1WIN', ['collectBetResult, inD / collected', inD, collected])
        return collected;
    };

    // === Edited by ChatGPT — добавлен перебор вкладок Soccer → Tennis → Basketball и перезагрузка при полном отсутствии событий ===
    const ProccedExpressNew = async () => {
        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));
        const $coefs = () => $('button[class*="_odd_"]');
        const sportTab = 'a[data-testid="header-navigation-betting"]';
        const sportBtn = 'nav a[href="/prematch"]';
        const currentBets = [];

        // go to Sports → Prematch
        if ($(sportTab).length > 0) {
            await mouseChain({target: $(sportTab)[0], events: fullClick, error: '$sportTab'});
            await waitForElement(sportBtn, 222, 7777);
            await delayPromise(555);
            await mouseChain({target: $(sportBtn)[0], events: fullClick, error: '$sportBtn'});
            await waitForElement('div[class*="_safeArea_"]', 222, 7777);
        } else {
            throw 'No Sports tab!';
        }

        const findOption = coef => !isNaN(coef) && coef >= 1.01 && coef <= 1.25;
        const getUniqueRandomNumber = (length) => Math.floor(Math.random() * length);

        // общий флаг: нашли ли что-то в принципе на всех вкладках
        let foundSomething = false;

        // перебираем нужные виды спорта по очереди
        for (const sportName of ['Soccer', 'Tennis', 'Basketball']) {
            // переключаем вкладку спорта (кнопка с текстом)
            const tabSpanSel = `div[class*="_safeArea_"] button span:textEquals("${sportName}")`;
            await waitForElement(tabSpanSel, 222, 7777, true);
            await mouseChain({ target: $(tabSpanSel).closest('button')[0], events: fullClick, error: `tab:${sportName}` });
            await waitForElement('button[class*="_odd_"] span[class*="_cf_"]', 222, 11111);

            // локальный флаг: нашли ли на этой вкладке
            let foundOnThisTab = false;

            // основной цикл набора экспресса на текущей вкладке
            do {
                const randomCoef = getUniqueRandomNumber($coefs().length);

                const eventName = $coefs().eq(randomCoef)
                    .closest('div[data-qa="match-card"]')
                    .find('div[class*="_competitors_"] span[class*="_name_"]')
                    .toArray()
                    .map(el => $(el).trt())
                    .join(' - ');

                if (currentBets.indexOf(eventName) > -1) { await delayPromise(222); continue; }
                if (eventName.length < 5) { await delayPromise(222); continue; }

                if (used[eventName] >= 1) {
                    dLog('big-yellow', '1WIN', `${eventName} used ${used[eventName]} times!`);
                    await delayPromise(222);
                    continue;
                }

                if ($coefs().eq(randomCoef).is('[class*="_selected_"]')) { await delayPromise(222); continue; }

                const cf = parseFloat($coefs().eq(randomCoef).find('span[class*="_cf_"]').trt());
                if (!findOption(cf)) { await delayPromise(222); continue; }

                // --- проверка даты матча (≤24ч)
                const $card = $coefs().eq(randomCoef).closest('div[data-qa="match-card"]');

                const timeEl = $card.find('span').filter(function () {
                    return /^\d{1,2}:\d{2}$/.test($(this).trt());
                }).first();

                const dateEl = $card.find('span').filter(function () {
                    return /^\d{2}\/\d{2}\/\d{4}$/.test($(this).trt());
                }).first();

                if (timeEl.length === 0 || dateEl.length === 0) {
                    await delayPromise(222);
                    break; // на этой вкладке не смогли определить дату/время — выходим к следующей
                }

                const [d, m, y] = dateEl.trt().split('/').map(Number);
                const [hh, mm] = timeEl.trt().split(':').map(Number);
                const matchDate = new Date(y, m - 1, d, hh, mm, 0, 0);

                const diff = matchDate - new Date();
                if (diff < 0 || diff > 24 * 60 * 60 * 1000) {
                    dLog('yellow', '1WIN', `skip by date (>24h or past): ${matchDate}`);
                    await delayPromise(222);
                    break; // матч вне окна — попробуем следующий спорт
                }
                // --- конец проверки даты

                // подходит — кликаем
                currentBets.push(eventName);
                await mouseChain({ target: $coefs().eq(randomCoef)[0], events: ['click'], error: `EVENT:${sportName}` });
                await delayPromise(2555);

                foundOnThisTab = true;
                foundSomething = true;
            } while ($coupons().length < settings.newExpressBetsAmount);

            // если уже набрали нужное количество — дальше вкладки не трогаем
            if ($coupons().length >= settings.newExpressBetsAmount) break;

            // иначе, если на этой вкладке ничего не нашли — идём к следующей
            if (!foundOnThisTab) {
                dLog('yellow', '1WIN', `No suitable events on ${sportName}, switching…`);
                await delayPromise(555);
            }
        }

        // если нигде не нашли вообще — перезагружаем страницу
        if (!foundSomething) {
            dLog('red', '1WIN', 'No suitable events on Soccer/Tennis/Basketball — reload page');
            location.reload();
            return;
        }

        // check 2 events
        if ($coupons().length === settings.newExpressBetsAmount 
            && currentBets.length === settings.newExpressBetsAmount
        ) {
            dLog('green', '1WIN', [`We get selected bets: '${currentBets}', now used:`, used]);
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
    // === Edited by ChatGPT — end ===



    /**
     * Perform bet
     * @param data
     */
    const proceedBet = function (data) {
        currentBetData = {
            data: data,
            max: 0
        };
        const betFinished = async function (success, message) {
            bsDebug(port, 'Bet finished ' + success, message);
            let status = 'ACCEPTED';
            if (!success) {
                const bad = ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED'].find(c => typeof message === 'string' && message.indexOf(c) > -1);
                status = bad || 'FAILED';
            }
            const resultData = {
                "external_id": success ? message.external_id : '',
                "status": status,
                "pivot": currentBetData.data[0].pivot,
                "coef": success ? message.coef : currentBetData.data[0].coef,
                "stake": success ? message.stake : currentBetData.data[0].stake,
                "maximum": currentBetData.max,
                "market": currentBetData.data[0].market,
                "target": currentBetData.data[0].target
            };

            if (success) {
                await eventsWorkAll('onewin',
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

                    dLog('1WIN', 'blue-big',
                        [`We set bet with first: '${currentFirstBet}', now used:`, used]);

                    if (settings.newExpressBetsAmount > 1) {
                        const currentSecondBet = await bMess('currentSecondBet').check(1080000, true);
                        if (!used[currentSecondBet]) {
                            used[currentSecondBet] = 1;
                        }

                        dLog('1WIN', 'blue-big',
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
                resultData.bookmaker = '1WIN';
                resultData.placedCoef = resultData.coef;
                resultData.coef = currentBetData.data[0].coef;
                resultData.source = '407' || 'oddscp';
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
            bsDebug(port, `Result data (${success}): `, resultData);
            busy = false;
            ourCommand.clear();
        };
        let result = false;
        const report = function (success, message) {
            if (success) {
                betFinished(true, message);
            } else {
                betFinished(false, message);
            }
        };
        (async () => {
            const collectDetails = async () => {
                await waitForCondition(() => $('p[class^="_title_"]:textEquals("Bet placed")').length === 1,
                    300, 22000, 'No success!');
                await delayPromise(1000);
                await mouseChain({
                    target: $('button:textEquals("Go to history")')[0], events: fullClick, error: 'Go to history'
                });
                const firstBet = 'div[class^="_content_"]:first';
                await waitForCondition(() => $(firstBet).find('p:textEquals("Bet amount")').next().length > 0,
                    300, 7777, 'No STAKE result!');
                await delayPromise(555);

                result = {
                    stake: $(firstBet).find('p:textEquals("Bet amount")').next().trt().replace(/[^.\d]/g, ''),
                    coef: $(firstBet).find('span[class*="_coef_"]').trt(),
                    external_id: $(firstBet).prev().find('div[class^="_id_"]').trt().replace(/[^\d]/g, ''),
                };
                await delayPromise(333);
            }
            const performExactBet = async willPlaceInput => {
                // Hint: Let's enter stake
                const $input = () => $('input[data-qa="amount"]:visible');
                if ($input().length !== 1) {
                    throw '2 Wrong number of bet\'s inputs: ' + $input.length;
                }
                willPlaceInput = parseFloat(willPlaceInput.toString().replace('.00', '').trim());
                if (willPlaceInput > parseFloat(data[0].stake)) {
                    willPlaceInput = parseFloat(data[0].stake);
                }
                dLog('yellow', '1WIN', 'ONE ' + willPlaceInput + ' on place: ' + $input().val());
                $input().val(willPlaceInput.toString());
                fireInputEvent($input()[0]);
                fireChangeEvent($input()[0]);
                await delayPromise(777);
                const $acceptBtn = $('button:textEquals("Place a bet")');
                if ($acceptBtn.length > 0) {
                    if ($acceptBtn.is(':disabled')) {
                        throw 'Accept button is disabled!';
                    }
                } else {
                    throw 'Accept button is not exist!';
                }
                await mouseChain({target: $acceptBtn[0], events: fullClick, error: "$acceptBtn"});
                await delayPromise(888);
                await collectDetails();
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
            if (!!currentBetData.data[0].betFromParser) {
                const checkRes = await eventsWorkAll('onewin',
                    settings.eventMaxBets, settings.eventTimeLimit,
                    currentBetData.data, false, true);
                if (checkRes !== 'OK') {
                    dLog('red', `${bkHere}`, `We got errors: ${checkRes}`);
                    throw checkRes;
                } else {
                    dLog('big-blue', `${bkHere}`,
                        `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                    for (const d of currentBetData.data) {
                        const eventName = `${d.team1} - ${d.team2}`;
                        dLog('blue', `${bkHere}`, `${settings.eventMaxBets} for ${eventName} not reached`);
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

            currentBetData.max = await openCoupon(data);

            if (settings.newExpresses && $coupons().length < settings.newExpressBetsAmount + 1) {
                throw `less than ${settings.newExpressBetsAmount + 1} events in the newExpresses`;
            }

            await checkCoefs(data);
            let willPlace = parseFloat(data[0].stake);
            if (willPlace > currentBetData.max) {
                willPlace = currentBetData.max;
            }
            const balance = getBalance(false);
            if (isNaN(balance)) {
                throw 'Get balance error';
            } else if (balance < willPlace) {
                throw 'NO_FUNDS - now: ' + balance + ', we need: ' + willPlace;
            } else {
                dLog('', '1WIN', 'Will place (performBet): ' + willPlace + ', balance: ' + balance);
                await delayPromise(888);
                await performExactBet(willPlace);
                if (result) {
                    report(true, result);
                } else {
                    report(false, 'Bet placed, but collect error!');
                }
            }
        })()
            .catch(e => report(false, `proceedBet: ${e}`))
    };

    /**
     * Checks coefs into the coupon
     * @param data
     * @returns {Promise<string,string>}
     */
    const checkCoefs = async (data) => {
        await waitForCondition(() => $coupons().length > 0,
            333, 10000, 'No coupons!');
        const findInData = match => data.find(v => {
            const localMatch = v.team1.toLowerCase() + ' - ' + v.team2.toLowerCase();
            return localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 60;
        });
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        const $couponsCoefs = (data.length === 1 && settings.newExpresses === true)
            ? $coupons().last()
            : $coupons();
        $couponsCoefs.each(function () {
            const $this = $(this);
            let match = $this.find('div[class^="_competitors_"]').trt();
            const localCoef = parseFloat($this.find('div[class^="_oddInfo_"] span').trt());
            const localData = findInData(match);

            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            console.log(`Coef here: '${localCoef}'`, match, localData);
            if (!localData || isNaN(localCoef)) {
                errors.push(match + ' LOW_COEF - wrong match or localCoef!');
                checked++;
            } else {
                checked++;
            }
        });
        if (errors.length === 0 && checked === data.length) {
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef))
                ? parseFloat(data[0].coef)
                : totalCoef / 1.21;
            console.log('%c' + `CHECK NEW API: we have: ${totalCoef}, we need: ${nCheck}`,
                'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            if (totalCoef >= nCheck * 1.5) {
                throw 'Coef TOO BIG: ' + totalCoef + ' instead of ' + data[0].coef;
            } else if (totalCoef < nCheck) {
                throw 'LOW_COEF ' + data[0].coef + ' > ' + totalCoef;
            } else {
                return 'Coefs fine!';
            }
        } else {
            const error = errors.join('; ') + (checked !== data.length ? ' some stakes not checked ('
                + checked + '/' + data.length + ')!' : '');
            console.log('%c' + `checkCoupon => ${error}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            throw error;
        }
    };

    /**
     * Open event table, if we're on it already -  onSuccess
     * @param {object} data
     * @returns {Promise<any>}
     */
    const openEvent = async (data) => {
        dLog('green', '1WIN', ['openEvent', data]);
        const team1 = data.team1.toLowerCase();
        const team2 = data.team2.toLowerCase();
        const lEvent = `${team1} - ${team2}`.toLowerCase();

        const checkWeAreThere = async (team1, team2) => {
            const $teams = await waitForElement('div[class*="_wrapper_"][sporttag] > div', 300, 7777)
                .catch(() => $([]));
            let cTeam1 = '', cTeam2 = '';
            if ($teams.length === 3) {
                cTeam1 = $teams.eq(0).trt().toLowerCase();
                cTeam2 = $teams.eq(2).trt().toLowerCase();
                console.log(cTeam1 + ' - ' + cTeam2);
                const rst = (cTeam1 === team1 && cTeam2 === team2) ||
                    (locutus_similar_text(cTeam1 + ' - ' + cTeam2, team1 + ' - ' + team2, true) > 80);
                return rst;
            } else {
                return false;
            }
        };
        const searchEvent = async (type, team2, lEvent) => {
            dLog('green', '1WIN', 'search event');

            let $eventFind = $([]);

            // Было: span[class^="_title_"] → .closest('section')
            // Стало: ищем section внутри _searchResultList_ по заголовку "Sports"/"Live" (классы вариативные)
            const $container = () => {
                const title = (type === 'LIVE' ? 'Live' : 'Sports');
                const $sec = $(`div[class*="_searchResultList_"] section:has(> header span[class*="_title_"]:textEquals("${title}"))`);
                return $sec.length ? $sec : $(`div[class*="_searchResultList_"] section`).first();
            };

            // Карточки матча остаются по role+data-qa
            const $rows = () => $container().find('div[role="button"][data-qa="match-card"]');

            const searchInput = 'input[placeholder="Search"]';

            if ($(searchInput).length === 0) {
                await waitForCondition(() => $('span[style*="search.svg"]').closest('button').length === 1,
                    222, 9999, 'No search icon');
                await mouseChain({
                    target: $('span[style*="search.svg"]').closest('button')[0],
                    events: fullClick,
                    error: 'search',
                });
                await delayPromise(1111);
            }

            await waitForElement(searchInput, 300, 5555);
            await clearAndSimulate($(searchInput)[0], team2);

            const c = $container()[0];
            if (c && c.scrollIntoView) c.scrollIntoView({ block: 'start' });

            await delayPromise(888);

            await waitForElement($rows, 300, 12222, false, 1, 'No event rows!');

            // Было: .find('._teamInfo_1v56i_67 span[class^="_name_"]')
            // Стало: привязка к стабильному блоку конкурентов, имена команд: _competitors_ → _name_
            await $rows().eachAsync(async function () {
                const $teams = $(this)
                .find('div[class*="_competitors_"] span[class*="_name_"]')
                .filter((_, el) => $(el).trt().trim().length > 1)
                .slice(0, 2);

                if ($teams.length === 2) {
                const hEvent = $teams.eq(0).trt().toLowerCase() + ' - ' + $teams.eq(1).trt().toLowerCase();
                if (hEvent === lEvent || locutus_similar_text(hEvent, lEvent, true) > 95) {
                    $eventFind = $(this);
                    return false;
                } else {
                    console.log(`'${hEvent}' !== '${lEvent}'`);
                }
                }
            });

            if ($eventFind.length === 0) {
                throw 'Event not found!';
            }

            await delayPromise(777);
            await mouseChain({ target: $eventFind[0], events: fullClick });
        };

        if (await checkWeAreThere(team1, team2)) {
            dLog('green', `${bkHere}`, `We're on the event!`);
            await delayPromise(555);
        } else {
            await mouseChain({
                target: $('nav[class*="segment-control_root-"] a[href="/betting"]')[0], 
                events: fullClick, 
                error: 'sport link'
            });
            await delayPromise(555);
            await searchEvent(data.type, team2, lEvent);

            if (!await checkWeAreThere(team1, team2)) {
                throw 'we not on the event!';
            }
            await delayPromise(333);
        }
    };

    /**
     * Opens coupon with stake (stakes)
     * @param {object[]} paramData - array of bets to open
     * @returns {Promise<string, string>}
     */
    const openCoupon = async (paramData) => {
        let lData = paramData.slice();
        let data = {};
        let max = 111555777;
        const result = async (success, message) => {
            if (success) {
                if (lData.length > 0) {
                    ourCommand.add('express', ourCommand.getAdded('express') + 1);
                    bsDebug(port, 'EXPRESS must be added!');
                    data = paramData[ourCommand.getAdded('express')];
                    bsDebug(port, 'openCoupon - We got data: ' + (typeof data), data);
                    if (typeof data !== 'undefined') {
                        await openElement(data);
                    } else {
                        await delayPromise(777);
                        return max;
                    }
                } else {
                    await delayPromise(777);
                    return max;
                }
            } else {
                bsError(port, message);
                throw message;
            }
        };
        const openElement = async (data) => {
            dLog('blue', '1WIN', ['Open element:', data]);
            await openEvent(data).catch((e) => result(false, 'Error till open event: ' + e));
            const $el = await getBetElement(data).catch((e) => result(false, 'Error in getBetElement: ' + e));

            if ($el.length === 0) {
                await result(false, 'Element not found!');
            }

            await delayPromise(777);
            await mouseChain({target: $el.find('button')[0], events: fullClick, error: '$el'});
            await delayPromise(777);
            return await result(true, 'Coupon opened!');
        }

        if (ourCommand.getAdded('express') !== false) {
            data = paramData[ourCommand.getAdded('express')];
        } else {
            data = lData.shift();
        }

        if (typeof data !== 'undefined') {
            bsDebug(port, 'openCoupon - basic - We got data: ' + (typeof data), data);
            return await openElement(data);
        } else {
            await result(false, 'There is no input data!');
        }
    };

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<any>} jQuery element for bet
     */
    const getBetElement = async (data) => {
        //#-#-START
        let $betEl = $([]);
        let markets = {
            'ONE_TWO': {
                'ONE': {root: ['Full time result'], pivotKey: ['#TEAM1#']},
                'TWO': {root: ['Full time result'], pivotKey: ['#TEAM2#']},
                'DRAW': {root: ['Full time result'], pivotKey: ['Draw']},
                'ONE_DRAW': {root: ['Double chance'], pivotKey: ['#TEAM1# Or Draw']},
                'TWO_DRAW': {root: ['Double chance'], pivotKey: ['Draw Or #TEAM2#']},
                'ONE_TWO': {root: ['Double chance'], pivotKey: ['#TEAM1# Or #TEAM2#']}
            },
            'TOTAL': {
                'OVER': {
                    root: ['Total', 'Asian Total'],
                    pivotKey: ['Over #PIVOTR#']
                },
                'UNDER': {
                    root: ['Total', 'Asian Total'],
                    pivotKey: ['Under #PIVOTR#']
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    root: ['Home team total'],
                    pivotKey: ['Over #PIVOTR#']
                },
                'UNDER': {
                    root: ['Home team total'],
                    pivotKey: ['Under #PIVOTR#']
                }
            },
            'T2_TOTAL': {
                'OVER': {
                    root: ['Away team total'],
                    pivotKey: ['Over #PIVOTR#']
                },
                'UNDER': {
                    root: ['Away team total'],
                    pivotKey: ['Under #PIVOTR#']
                }
            },
            'CORNER_TOTAL': {
                'OVER': {
                    root: ['Corners. Total'],
                    pivotKey: ['Over #PIVOTR#']
                },
                'UNDER': {
                    root: ['Corners. Total'],
                    pivotKey: ['Under #PIVOTR#']
                }
            },
            'HDP': {
                'HOME': {
                    root: ['Handicap'],
                    pivotKey: ['#TEAM1# #PIVOTR#', '#TEAM1# (#PIVOTR#)']
                },
                'AWAY': {
                    root: ['Handicap'],
                    pivotKey: ['#TEAM2# #PIVOTR#', '#TEAM2# (#PIVOTR#)']
                }
            },
            half: {
                'ONE_TWO': {
                    'ONE': {root: ['1st half. Result'], pivotKey: ['#TEAM1#']},
                    'TWO': {root: ['1st half. Result'], pivotKey: ['#TEAM2#']},
                    'DRAW': {root: ['1st half. Result'], pivotKey: ['Draw']},
                    'ONE_DRAW': {root: ['1st half. Double chance'], pivotKey: ['#TEAM1# Or Draw']},
                    'TWO_DRAW': {root: ['1st half. Double chance'], pivotKey: ['Draw Or #TEAM2#']},
                    'ONE_TWO': {root: ['1st half. Double chance'], pivotKey: ['#TEAM1# Or #TEAM2#']}
                },
                'TOTAL': {
                    'OVER': {
                        root: ['1st half. Total'],
                        pivotKey: ['Over #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['1st half. Total'],
                        pivotKey: ['Under #PIVOTR#']
                    },
                },
                'HDP': {
                    'HOME': {
                        root: ['1st half. Handicap'],
                        pivotKey: ['#TEAM1# #PIVOTR#', '#TEAM1# (#PIVOTR#)']
                    },
                    'AWAY': {
                        root: ['1st half. Handicap'],
                        pivotKey: ['#TEAM2# #PIVOTR#', '#TEAM2# (#PIVOTR#)']
                    }
                },
                'CORNER_TOTAL': {
                    'OVER': {
                        root: ['1st Half. Corners. Total'],
                        pivotKey: ['Over #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['1st Half. Corners. Total'],
                        pivotKey: ['Under #PIVOTR#']
                    }
                },
                'T1_TOTAL': {
                    'OVER': {
                        root: ['1st Half. Home team total'],
                        pivotKey: ['Over #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['1st Half. Home team total'],
                        pivotKey: ['Under #PIVOTR#']
                    },
                },
                'T2_TOTAL': {
                    'OVER': {
                        root: ['1st Half. Away team total'],
                        pivotKey: ['Over #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['1st Half. Away team total'],
                        pivotKey: ['Under #PIVOTR#']
                    },
                },
            }
        };

        if (data.time_value === 'HALF_TIME' && (data.sport === 'FOOTBALL' || data.sport === 'HANDBALL')) {
            markets = markets.half;
        } else {
            delete markets.half;
        }

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw 'Unsupported ' + data.time_value + '/' + data.market + '/' + data.target;
        }

        const specialPivotFormatter = function (market, pivot) {
            function round(value, precision) {
                let multiplier = Math.pow(10, precision || 0);
                return Math.round(value * multiplier) / multiplier;
            }

            let fp = parseFloat(pivot);
            let res = '';
            if (!isNaN(fp)) {
                if (market.indexOf('TOTAL') > -1) {
                    // dot zero adding
                    if (data.sport === 'TENNIS') {
                        res = fp.toString();
                    } else {
                        res = round(fp, 1).toFixed(1).toString();
                    }
                } else if (market.indexOf('HDP') > -1) {
                    res = fp.toString();
                }
            }
            return res;
        };
        const replaceInner = function (element, parent, index) {
            if (typeof element === 'string') {
                parent[index] = element.replace('#TEAM1#', data.team1).replace('#TEAM2#', data.team2)
                    .replace('#PIVOT#', data.pivot).replace('#PIVOTR#', specialPivotFormatter(data.market, data.pivot));
            } else if (typeof element === 'object') {
                // it's not use now
                for (let i in element) {
                    replaceInner(element[i], element, i);
                }
            } else {
                //console.log(typeof element + ' not supported! (' + element + ')');
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
            const idx = ['st', 'nd', 'rd', 'th'];
            if (data.sport === 'BASKETBALL') {
                if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) > -1) {
                    replacements.push({from: 'Full time result', to: 'Winner (incl. OT)'});
                    replacements.push({from: 'Handicap', to: 'Handicap (incl. OT)'});
                    replacements.push({from: 'Total', to: 'Total (incl. OT)'});
                    replacements.push({from: 'Home team total', to: 'Home team total (incl. OT)'});
                    replacements.push({from: 'Away team total', to: 'Away team total (incl. OT)'});
                } else {
                    const q = data.time_value.replace(/[^\d]/g, '');
                    const qIdx = `${q}${idx[q - 1]}`;
                    replacements.push({from: 'Full time result', to: qIdx + ' quarter. Result'});
                    replacements.push({from: 'Total', to: qIdx + ' quarter. Total'});
                    replacements.push({from: 'Handicap', to: qIdx + ' quarter. Handicap'});
                    replacements.push({from: 'Home team total', to: qIdx + ' quarter. Home team total'});
                    replacements.push({from: 'Away team total', to: qIdx + ' quarter. Away team total'});
                }
            } else if (data.sport === 'TENNIS') {
                if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) > -1) {
                    replacements.push({from: 'Full time result', to: 'Winner'});
                    replacements.push({from: 'Home team total', to: 'Player 1. Total'});
                    replacements.push({from: 'Away team total', to: 'Player 2. Total'});
                } else {
                    if (data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') === -1) {
                        const set = data.time_value.replace(/[^\d]/g, '');
                        const setIdx = `${set}${idx[set - 1]}`;
                        replacements.push({from: 'Full time result', to: setIdx + ' set. Winner'});
                        replacements.push({from: 'Total', to: setIdx + ' set. Total'});
                        replacements.push({from: 'Handicap', to: setIdx + ' set. Handicap'});
                    }
                }
            } else if (data.sport === 'HOCKEY') {
                if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) === -1) {
                    const period = data.time_value.replace(/[^\d]/g, '').trim();
                    const periodIdx = `${period}${idx[period - 1]}`;
                    replacements.push({from: 'Full time result', to: periodIdx + ' period. Result'});
                    replacements.push({from: 'Double Chance', to: periodIdx + ' period. Double chance'});
                    replacements.push({from: 'Total', to: periodIdx + ' period. Total'});
                    replacements.push({from: 'Handicap', to: periodIdx + ' period. Handicap'});
                    replacements.push({from: 'Home team total', to: periodIdx + ' period. Home team total'});
                    replacements.push({from: 'Away team total', to: periodIdx + ' period. Away team total'});
                }
                if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) > -1) {
                    markets['T1_TOTAL']['OVER'].pivotKey[0] = markets['T1_TOTAL']['OVER'].pivotKey[0].replace('Total Home Team', 'Total');
                    markets['T1_TOTAL']['UNDER'].pivotKey[0] = markets['T1_TOTAL']['UNDER'].pivotKey[0].replace('Total Home Team', 'Total');
                    markets['T2_TOTAL']['OVER'].pivotKey[0] = markets['T2_TOTAL']['OVER'].pivotKey[0].replace('Total Away Team', 'Total');
                    markets['T2_TOTAL']['UNDER'].pivotKey[0] = markets['T2_TOTAL']['UNDER'].pivotKey[0].replace('Total Away Team', 'Total');
                }
            } else if (data.sport === 'CYBERSPORT') {
                if (['FULL_MATCH', 'FULL_TIME'].indexOf(data.time_value) > -1) {
                    replacements.push({from: 'Full time result', to: 'Winner'});
                    replacements.push({from: 'Total', to: 'Total Maps'});
                    replacements.push({from: 'Handicap', to: 'Handicap Rounds'});
                } else {
                    const map = data.time_value.replace(/[^\d]/g, '').trim();
                    replacements.push({from: 'Full time result', to: `Map ${map}. Result`});
                    replacements.push({from: 'Total', to: `Map ${map}. Total rounds`});
                    replacements.push({from: 'Handicap', to: `Map ${map}. Round handicap`});
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

        marketsModifierWrapper(data, 'root', getRootParams(), markets);
        //marketsModifierWrapper(data, 'pivotKeys', getRootParams(true), markets);

        const finalPrepareForMarket = function (market) {
            market.rootLC = market.root.map(v => v.toLowerCase());
            return market;
        };
        const market = finalPrepareForMarket(markets[data.market][data.target]);

        dLog('green', '1WIN', ['Get bet element', market]);

        await waitForElement('div[class*="_group_"]', 222, 15000);

        const findPivot = $root => {
            let $res = $([]);
            for (const pvt of market.pivotKey) {
                console.log(`Checking pivot: '${pvt}'`);
                let $pivot = $([]);

                $pivot = $root.find(`div[class^="_cell_"]:has(div[class^="_content_"]:textEqualsI("${pvt}"))`);
                if ($pivot.length === 0) {
                    $pivot = $root.find(`div[class^="_cell_"]:has(span[class^="_name_"]:textEqualsI("${pvt}"))`);
                }
                if ($pivot.length === 1) {
                    $res = $pivot;
                    $root[0].scrollIntoView();
                    break;
                } else {
                    console.log(`Not found! (pivot length ${$pivot.length})`);
                }
            }

            return $res;
        };

        for (const root of market.root) {
            console.log(`Checking root: ${root}`);
            const $root = () => $(`div[class*="_group_"]:has(div[class^="_title_"]:textEqualsI("${root}"))`);

            if ($root().length === 0) {
                console.log(`No root ${root}`);
                continue;
            }

            $betEl = findPivot($root());
            if ($betEl.length > 0) {
                break;
            }
        }
        if ($betEl.length === 0) {
            throw `${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot} not found :(`;
        }

        return $betEl;
        //#-#-FINISH
    };

    /**
     * Close previous coupons
     * @param skipParam
     * @returns {Promise<string>}
     */
    const closePreviousCoupons = async (state) => {
        const $closeCoupon = $('span[style*="trash.svg"]').closest('button');
        const $closeBtns = () => $('svg[class*="_removeSelection_"]').last();
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
        dLog('green', '1WIN', 'closePreviousCoupons');
    };

    /**
     * Check and do authorization
     */
    const authCheck = function () {
        if (enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            bsError(port, 'ERROR AUTH!');
            return;
        }

        if (authClickedCount > 3) {
            bsError(port, 'ERROR AUTH! Not loggen in for ' + authClickedCount + ' times');
            port.postMessage({m: "ERROR AUTH! Not loggen in for " + authClickedCount + ' times'});
            return;
        }

        (async () => {
            //close all gift popups
            await closeAllWeNeed({
                'div[class*="CdpPopupTypeLarge_close_"]': 'div[class*="CdpPopupTypeLarge_close_"]',
                'div[class*="CdpPopupTypeSmall_close_"]': 'div[class*="CdpPopupTypeSmall_close_"]',
                'span:textEquals("Decline")': 'span:textEquals("Decline")',
                'div[class^="PushNotificationsPopupBase_root_"] button:textEquals("Later")':
                    'div[class^="PushNotificationsPopupBase_root_"] button:textEquals("Later")',
                'button[data-testid="subscribeNotificationPopup-close"]': 'button[data-testid="subscribeNotificationPopup-close"]',
                'button[data-testid="cdpPopup-small-close"]': 'button[data-testid="cdpPopup-small-close"]',
                'button[data-testid="modal-header-button-close"]': 'button[data-testid="modal-header-button-close"]',
            });

            if ($(logLink).length > 0) {
                // Hint: Log In
                port.postMessage({m: "tech works! 2"});
                await delayPromise(777);
                await tryToLogIn().catch(e => bsError(port, 'Error login: ' + e));
            } else {

                if (settings.lastScoreBasketball === '999') {
                    if (Date.now() - settings.sourceDate >= 300000) {
                        settings.sourceDate = Date.now();
                        settings.sourceRandom = getSourceRandom();
                        // if (settings.sourceRandom >= 15 && settings.sourceRandom <= 19) {
                        //     settings.newExpresses = true;
                        //     if (settings.sourceRandom >= 15 && settings.sourceRandom <= 17) {
                        //         settings.newExpressBetsAmount = 1;
                        //     }
                        // } else {
                        //     waitSource = false;
                        //     settings.newExpresses = false;
                        // }

                        dLog('blue', '1WIN', `Source current random value - ${settings.sourceRandom}`);
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
                        dLog('green', '1WIN', 'START find NewExpress event!');
                        // clear coupons
                        if ($coupons().length > 0) {
                            await closePreviousCoupons(false);
                        }

                        waitSource = false;
                        await ProccedExpressNew().catch((e) => {
                            dLog('red', '1WIN', 'ProccedExpressNew Error - ' + e);
                            bMess('WasSuccessExpressNew').set(false);
                        });                        
                    }
                    busy = false;
                }

                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(false)
                });
            }
        })()
            .catch(e => dLog('red', `${bkHere}`, `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    /**
     * Try login to account
     * @returns {Promise<string>}
     */
    const tryToLogIn = async () => {
        const emailTmpl = /^((?!\.)[\w\-_.]*[^.])(@\w+)(\.\w+(\.\w+)?[^.\W])$/;
        const loginForm = 'div[data-testid="modal-header-title"]:textEquals("Login")';
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }

        if ($(logLink).length !== 1) {
            throw 'No $logLink!';
        }

        if ($(loginForm).length === 0) {
            await mouseChain({target: $(logLink)[0], events: fullClick});
            await waitForElement(loginForm, 300, 7777);
            await delayPromise(222);
        }

        // select tab
        if (emailTmpl.test(settings.login)) {
            await mouseChain({target: $('button[data-testid="signInByPhone-form-tab-email"]')[0], events: fullClick});
            await delayPromise(1777);
            await clearAndInputEmail($('input[data-testid="signInByEmail-form-email"]')[0], settings.login,
                true, true, true);
        } else {
            await mouseChain({target: $('button[data-testid="signInByPhone-form-tab-phone"]')[0], events: fullClick});
            await delayPromise(1777);
            await clearAndSimulate($('input[data-testid="signInByPhone-form-phone"]')[0], settings.login,
                true, true, true);
        }

        await delayPromise(333);
        await clearAndSimulate($('input[data-testid="signInByEmail-form-password"]')[0], settings.password,
            true, true, true);
        await delayPromise(333);
        await mouseChain({
            target: $('button[data-testid="signInByEmail-form-submit"]')[0],
            events: fullClick
        });
        const $profile = await waitForElement('button[data-testid="sidebar-profile-button"]',
            333, 18888).catch(() => $([]));
        if ($profile.length === 0) {
            enterError = true;
        }
        await delayPromise(777);
        authClickedCount++;
        authClicked = Date.now();
        dLog('', `${bkHere}`, 'Auth clicked!');
        return "auth_clicked";
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            chrome.storage.local.set({'ONEWIN_COMMAND': ourCommand.get(), 'ONEWIN_COMMAND_WAS_SET': Date.now()});
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});
        chrome.storage.local.get(['ONEWIN_COMMAND', 'ONEWIN_COMMAND_WAS_SET'], function (result) {
            bsDebug(port, 'Saved command:', result);
            if (typeof result.ONEWIN_COMMAND !== 'undefined' && typeof result.ONEWIN_COMMAND_WAS_SET !== 'undefined'
                && Date.now() - result.ONEWIN_COMMAND_WAS_SET < 40000) {
                let currentCommand = result.ONEWIN_COMMAND;
                chrome.storage.local.remove(['ONEWIN_COMMAND', 'ONEWIN_COMMAND_WAS_SET'], function () {
                    //bsDebug(port, 'Restoring with: ', currentCommand);
                    messageProcessor(currentCommand);
                });
            } else {
                chrome.storage.local.remove(['ONEWIN_COMMAND', 'ONEWIN_COMMAND_WAS_SET']);
            }
        });
    }

})();
