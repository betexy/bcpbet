(function () {

    "use strict";

    if (window.self !== window.top) {
        return;
    }

    let newAPI = false;
    let wasAuthCheck = false;
    let authClicked = 0;
    let busy = false;
    let port = chrome.runtime.connect({name: "port_paddy"});
    let settings = {
        authCheckInterval: 2000,
        url: 'https://www.paddypower.com/inplay',
        resultsUrl: 'https://myactivity.paddypower.com/#/sportsbook',
        waitTillLoadingMs: 6000,
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 3,
        betweenBets: 25000,
        newExpresses: false,
    };

    let currentCommand = '';
    let currentBetData = {};

    let ourCommand = new ourCommandProto();

    const sportAccordance = {
        'FOOTBALL': 'football',
        'TENNIS': 'tennis',
        'TABLETENNIS': 'table-tennis',
        'BASEBALL': 'baseball',
        'HOCKEY': 'ice-hockey',
        'BASKETBALL': 'basketball',
        'VOLLEYBALL': 'volleyball',
        'HANDBALL': 'handball',
        'CYBERSPORT': 'esports',
    };

    let messageProcessor = function (message) {
        console.log(message);
        currentCommand = '';
        newAPI = !!message.newAPI;
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        }
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
            settings.renew = message.renew;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            settings.newExpresses = !!(settings?.stake_fork && settings.stake_fork?.newExpresses);
            authCheck(settings);
            wasAuthCheck = true;
        } else if (typeof Cookies.get("loggedIn") !== 'undefined' && $('input[placeholder="username"]').length > 0) {
            port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
        } else if (message.action === "BET") {
            busy = true;
            ourCommand.set(message);
            proceedBet(message.data)
                .then(() => {
                    bsDebug(port, "It's looks like BET done!");
                    busy = false;
                    ourCommand.clear();
                })
                .catch((e) => {
                    bsError(port, 'Error till BET: ' + e);
                    busy = false;
                    ourCommand.clear();
                });
        } else if (message.action === "EXPRESS_BET") {
            busy = true;
            ourCommand.set(message);
            proceedBet(message.data)
                .then(() => {
                    bsDebug(port, "It's looks like EXPRESS_BET done!");
                    busy = false;
                    ourCommand.clear();
                })
                .catch((e) => {
                    bsError(port, 'Error till EXPRESS_BET: ' + e);
                    busy = false;
                    ourCommand.clear();
                });
        } else if (message.action === 'BET_RESULT') {
            busy = true;
            ourCommand.set(message);
            betResult(message.data, false)
                .then(() => {
                    bsDebug(port, "It's looks like BET_RESULT done!");
                    busy = false;
                    ourCommand.clear();
                })
                .catch((e) => {
                    bsError(port, 'Error till BET_RESULT: ' + e);
                    busy = false;
                    ourCommand.clear();
                });
        } else if (message.action === 'MULTI_RESULT') {
            // Here we'll collect results for successfull stakes in multi (complex)
            busy = true;
            ourCommand.set(message);
            betResult(message.data, false, true)
                .then(() => {
                    bsDebug(port, "It's looks like MULTI_RESULT done!");
                    busy = false;
                    ourCommand.clear();
                })
                .catch((e) => {
                    bsError(port, 'Error till MULTI_RESULT: ' + e);
                    busy = false;
                    ourCommand.clear();
                });
        } else if (['DEPOSIT', 'WITHDRAW', 'CHECK_PAYMENTS'].indexOf(message.action) > -1) {
            busy = true;
            ourCommand.set(message);
            (function (d) {
                return message.action === 'DEPOSIT' ? deposit(d) : message.action === 'WITHDRAW' ? withdraw(d) : checkPayments(d);
            })(message.data)
                .then(() => bsDebug(port, 'It\'s looks like ' + message.action + ' done!'))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(delayFunction(7777))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                    return mouseChain({
                        target: $('a[data-gtml="paddypower logo"]')[0],
                        events: ['click'],
                        scroll: true
                    });
                });
        }
    };

    const withdraw = data => new Promise((onSuccess, onReject) => {
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
        const $getIFrame = selector => $($(selector)[0].contentDocument);
        (async () => {
            if (document.location.href.indexOf('/payments/withdraw') > -1) {
                await waitForCondition(() => $getIFrame('#iframePage').find('a.selector').length > 0,
                    333, 30000, 'No buttons!');
                await delayPromise(3000);
                if ($getIFrame('#iframePage').find('a.selector.selected span.long').trt() !== 'Alternative Methods') {
                    await mouseChain({
                        target: $getIFrame('#iframePage').find('a.apm-tab.selector')[0],
                        events: ['click']
                    });
                    await delayPromise(3000);
                }
                await bMess('SCH_COMMAND', true).set(ourCommand.get());
                const depositResult = await bMess('DEPOSIT_RESULT', true).get(180000, 30000);
                report(depositResult.success, 'WP1: ' + (depositResult.message || 'No message :('));
                await bMess('SCH_COMMAND', true).remove();
                await bMess('DEPOSIT_RESULT', true).remove();
            } else if (document.location.href.indexOf('/summary/accountsummary') > -1) {
                const $el = await waitForElement('li.has-sub-menu:has(a:contains("Payments"))', 333, 20000, true);
                await delayPromise(1500);
                $el.addClass('open');
                const $el2 = await waitForElement('ul.dropdown-menu a:contains("Withdraw")', 333, 3333, true);
                await delayPromise(1000);
                await mouseChain({target: $el2[0], events: ['click'], error: 'Withdraw btn'});
            } else {
                const $el = await waitForElement('a.ssc-unc:contains("My Account")', 333, 20000, true);
                await delayPromise(3000);
                await mouseChain({target: $el[0], events: ['click'], error: 'My Account'});
                await delayPromise(3000);
                const $el2 = await waitForElement('a.ssc-myPaddypowerAccount', 333, 5555, true);
                await delayPromise(1000);
                await mouseChain({target: $el2[0], events: ['click'], error: 'Account 2'});
            }
        })()
            .catch(e => report(false, e));
    });

    const depositDo = async data => {
        const $getIFrame = selector => $($(selector)[0].contentDocument);
        if (document.location.href.indexOf('/payments/deposit') > -1) {
            await waitForCondition(() => $getIFrame('#iframePage').find('a.selector').length > 0,
                333, 30000, 'No buttons!');
            await delayPromise(3000);
            if ($getIFrame('#iframePage').find('a.selector.selected span.long').trt() !== 'Alternative Methods') {
                await mouseChain({
                    target: $getIFrame('#iframePage').find('a.apm-tab.selector')[0],
                    events: ['click'],
                    error: 'dlho1',
                });
                await delayPromise(3000);
            }
            await bMess('SCH_COMMAND', true).set(ourCommand.get());
            return await bMess('DEPOSIT_RESULT', true).get(180000);
        } else if (document.location.href.indexOf('/summary/accountsummary') > -1) {
            const $el = await waitForElement('#depositFundsButton', 333, 20000, true);
            await delayPromise(3000);
            await mouseChain({target: $el[0], events: ['click'], error: 'sas$el2'});
        } else {
            const $el = await waitForElement('a.ssc-unc:contains("My Account")', 333, 20000, true);
            await delayPromise(3000);
            await mouseChain({target: $el[0], events: ['click'], error: 'dd$el1'});
            await delayPromise(3000);
            const $el2 = await waitForElement('a[data-gtml="my account - myPaddypowerAccount"]', 333, 5555, true);
            await delayPromise(1000);
            await mouseChain({target: $el2[0], events: ['click'], error: 'dd$el2'});
        }
        await delayPromise(100000);
    };

    const deposit = data => new Promise(function (onSuccess, onReject) {
        dLog('green', 'Paddy', ['Deposit!', data]);
        const report = (success, message, wallet_balance) => {
            dLog('green', 'Paddy', `Report! ${success} / ${message} / ${wallet_balance}`);
            port.postMessage({
                answered: "DEPOSIT",
                status: message.indexOf('NO_FUNDS') > -1 ? 'NO_FUNDS' : (success ? "SUCCESS" : "FAILED"),
                answer: message,
                balance: getBalance(),
                wallet_balance: wallet_balance || '',
            });
            success ? onSuccess(message) : onReject(message);
        };
        depositDo(data)
            .then(depRes => report(depRes.success, depRes.message || 'No message!', depRes.balance))
            .catch(e => report(false, `Error till deposit: ${e}, ${formatStack(e.stack)}`));
    });

    let checkPayments = function () {
        bsDebug(port, 'checkPayments!');
        return new Promise(function (onSuccess, onReject) {
            let collected = [];
            let report = function (success, message) {
                bsDebug(port, 'Report! ' + success + ' / ' + message);
                port.postMessage({
                    answered: "CHECK_PAYMENTS",
                    data: success ? collected : [],
                    answer: message
                });
                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                }
            };
            let letsRockNRoll = function () {
                bsDebug(port, 'letsRockNRoll');
                if (document.location.href.indexOf('myactivity.paddypower.com/#/transactions') > -1) {
                    waitForElement('div.right--side__cell.date-range__cell', 333, 20000, true)
                        .then(($el) => {
                            if ($el.text().indexOf('Last 7 Days') === -1) {
                                return waitForElement('div.right--side__cell.option__cell', 333, 20000, true)
                                    .then(($el) => delayPromise(3333, $el))
                                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                                    .then(waitForElementF('button.date-range__selector', 333, 3333, true))
                                    .then(($el) => delayPromise(1111, $el))
                                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                                    .then(waitForElementF('span[data-qa-val="7"]', 333, 3333, true))
                                    .then(($el) => delayPromise(1111, $el))
                                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                                    .then(delayFunction(3333))
                                    .then(() => mouseChain({
                                        target: $('div.right--side__cell.option__cell')[0],
                                        events: ['click']
                                    }))
                                    .then(delayFunction(3333))
                                    .then(waitForElementF('div.right--side__cell.refresh__cell', 333, 3333, true))
                                    .then(($el) => delayPromise(1111, $el))
                                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                                    .then(delayFunction(5555));
                            }
                        })
                        .then(delayFunction(3333))
                        .then(() => {
                            let performCollect = function () {
                                //collected = [];
                                $('tr.bet--row').each(function () {
                                    if ($(this).find('td[data-label="Description"]').text().indexOf('Deposit') > -1 ||
                                        $(this).find('td[data-label="Description"]').text().indexOf('Withdrawal') > -1) {
                                        let $this = $(this);
                                        let desc = $(this).find('td[data-label="Description"]').trt();
                                        let type = desc.indexOf('Deposit') > -1 ? 'IN' : 'OUT';
                                        collected.push({
                                            date: $this.find('td[data-label="Date"]').trt(),
                                            description: $(this).find('td[data-label="Description"] span.ref-id').trt(),
                                            type: type,
                                            paysystem: 'SKRILL',
                                            amount: $this.find('td[data-label="' + (type === 'IN' ? 'In (€)' : 'Out (€)') + '"]')
                                                .text().replace(/[^\d.]/g, '').trim(),
                                            success: true
                                        });
                                    }
                                });
                                report(true, 'It have to be good :)');
                                //console.log(collected);
                            };
                            let performRoll = function () {
                                let $desc = $('td[data-label="Description"]');
                                let countBeforeRoll = $desc.length;
                                $desc.last().get(0).scrollIntoView();
                                waitForCondition(() => {
                                    return $('td[data-label="Description"]').length > countBeforeRoll;
                                }, 1111, 11111, 'Finish!')
                                    .then(delayFunction(777))
                                    .then(performRoll)
                                    .catch((e) => performCollect());
                            };
                            performRoll();
                        })
                        .catch((e) => report(false, 'Collecting: ' + e));
                } else if (document.location.href.indexOf('/summary/accountsummary') > -1) {
                    waitForElement('li.link-group:has(span:contains("Betting Activity"))', 333, 20000, true)
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => {
                            $el.find('a').css('color', '#31953e').css('opacity', 100);
                            $el.find('span+.dropdown').css('transform', 'scaleY(1)').css('height', 'auto').css('overflow', 'visible');
                        })
                        .then(waitForElementF('a[data-page-tag="Transaction History"]', 333, 3333, true))
                        .then(($el) => delayPromise(1111, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .catch((e) => report(false, 'Go to Transactions history: ' + e));
                } else {
                    waitForElement('a.ssc-unc:contains("My Account")', 333, 20000, true)
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(3333))
                        .then(waitForElementF('a[data-gtml="my account - myPaddypowerAccount"]', 333, 5555, true))
                        .then(($el) => delayPromise(1111, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .catch((e) => report(false, 'Go to: ' + e));
                }
            };
            letsRockNRoll();
        });
    };

    const collectInfo = async (inD, justPlaced) => {
        const res = await collectInfoDo(inD, justPlaced)
            .then(m => ({success: true, message: m}))
            .catch(e => ({success: false, message: e}));
        dLog(!!res.status ? 'green' : 'red', 'Paddy',
            [`collectInfo RESULT success = ${res.success}, justPlaced = ${justPlaced}, message:`,
                res.message]);
        if (!justPlaced) {
            port.postMessage({
                answered: "BET_RESULT",
                status: res.success ? "success" : "error",
                answer: res.message,
            });
        }
        if (res.success) {
            return res.message;
        } else {
            throw res.message;
        }

    };

    /*
    {
        "stake": "0.30",
        "match": "Chindia Targoviste v UTA Arad - Handicap Betting",
        "leg": "UTA Arad (+1)",
        "odd": "1.3"
    }
     */
    const collectInfoDo = async (inD, justPlaced) => {
        await delayPromise(1000);
        const $myBets = await waitForElement('a[href="/my-bets"]',
            250, settings.waitTillLoadingMs);
        if ($myBets.length === 1 && $myBets.attr('class').indexOf('--selected') === -1) {
            await mouseChain({target: $myBets[0], events: fullClick, error: 'B3'});
            await delayPromise(1000);
        }
        const $pwc = $('div.accordion__title:contains("Rewards Club")');
        if ($pwc.length > 0) {
            $pwc.closest('promotion').remove();
        }
        const $betPanels = () => $('div.bets div.bet');
        const collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 100;
        dLog('', 'paddy', [`collectInfo, justPlaced = ${justPlaced}, limit = ${limit}, data:'`,
            data]);
        let counter = 0;
        let justResult = {};
        for (const c of ['Open', 'Settled']) {
            if (justPlaced && !!justResult?.external_id) {
                break;
            }
            const $current = await waitForElement(`span.tab__title:textEquals("${c}")`, 100, 1000);
            if ($current.closest('a').attr('class').indexOf('active') === -1) {
                await mouseChain({target: $current[0], events: fullClick, error: 'B4'});
                await delayPromise(3000);
            }
            $betPanels().each(function () {
                counter++;
                const current = collectDetails(this);
                if (limit !== 0 && counter > limit) {
                    return false;
                }
                if (justPlaced) {
                    const
                        currentMatch = current.match.replace(/(.*-\s)/, '').trim(),
                        dataMatch = data.match.replace(/(\s-\s.*)/, '').trim(),
                        compareMatch = locutus_similar_text(currentMatch, dataMatch, true) > 97;
                    if (compareMatch === true && parseFloat(current.stake) === parseFloat(data.stake)
                        && parseFloat(current.odd) >= parseFloat(data.odd)) {
                        // We suppose our patient is here!
                        current.external_id = current.id;
                        justResult = current;
                        return false;
                    } else {
                        dLog('blue', 'PPW',
                            [
                                `CM: ${compareMatch} => '${currentMatch}' vs '${dataMatch}'`,
                                current,
                                ` or ${parseFloat(current.stake)} !== ${parseFloat(data.stake)}`,
                                ` or ${parseFloat(current.odd)} !== ${parseFloat(data.odd)}`,
                            ]);
                        return true;
                    }
                }
                if (data.length === 0 || data.indexOf(current.id) > -1) {
                    let cur = {
                        external_id: current.id,
                        status: current.status,
                        bkPivot: current.target,
                        coef: current.odd,
                        stake: current.stake,
                        result: current.returns,
                        match: current.match
                    };
                    collected.push(cur);
                } else {
                    dLog('', 'Paddy', `Skip: ${current.id}`);
                }
            });
        }
        if (justPlaced && !!justResult?.external_id) {
            dLog('green', 'Paddy', [`Just placed: ${justResult.external_id}`, justResult]);
            return justResult;
        } else if (justPlaced) {
            throw `Bet not collected G2 - ${counter} times!`;
        }
        return collected;
    };


    let collectDetails = function (betPanel) {
        let $panel = $(betPanel);
        let status = 'ACCEPTED';
        if ($panel.find('div.result').length === 1) {
            let resultValue = $panel.find('div.result span.result__label').trt();
            switch (resultValue) {
                case 'W':
                    status = 'WON';
                    break;
                case 'L':
                    status = "LOSE";
                    break;
                case 'V':
                    status = "REFUNDED";
                    break;
            }
        }

        let type = 'PREMATCH';
        let $scoreBoardCheck = $(this).find('div.ui-scoreboard-coupon-template');

        if ($scoreBoardCheck.length === 1) {
            type = 'LIVE';
        }

        const res = {
            type: type,
            match: $panel.find('span.bet-header__subtitle').trt(),
            //market: $panel.find('div.event__description span.market__name').trt().replace(/\s\s+/g, ' '),
            target: $panel.find('span.bet-header__title').trt(),
            odd: $panel.find('div.bet-header__odds-container span.themed-label__content').trt(),
            stake: $panel.find('div.bet-monetary-info__stake span.themed-label__content').trt()
                .replace(/[^\d.]/, ''),
            id: $panel.find('span.bet-footer__bet-receipt-id-value').trt(),
            status: status,
            returns: $panel.find('div.bet-monetary-info__returns-value span.themed-label__content')
                .trt().replace(/[^\d.]/, ''),
        };

        if (res.status === 'WON' && parseFloat(res.returns) <= parseFloat(res.stake)) {
            res.status = parseFloat(res.returns) === parseFloat(res.stake) ? 'REFUNDED' : 'LOSE';
        }

        return res;
    };

    const getBalance = returnNull => {
        const $b = $('div.account-info__primary-label');
        if ($b.length > 0) {
            return parseFloat($b.text().replace(',', '').replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    };

    let authCheck = function () {
        //dLog('yellow', 'Paddy', 'Auth Check');
        let repeat = true;
        let limitedSent = false;
        let isDenied = async () => {
            let $denied = await waitForElement('p:contains("account is denied - this account has been closed")', 130, 3000)
                .catch(e => $([]));
            if ($denied.length > 0) {
                port.postMessage({
                    m: "authorized!",
                    balance: 'null',
                    limited: true
                });
                limitedSent = true;
                dLog('orange', 'Paddy', 'BK is LIMITED sent!');
                repeat = false;
            }
            return $denied.length > 0;
        }
        (async () => {
            await closeAllWeNeed({
                '#onetrust-accept-btn-handler:textEquals("Accept all cookies")':
                    '#onetrust-accept-btn-handler:textEquals("Accept all cookies")',
            });
            const $username = $('input[placeholder="email/username"]');
            if (!limitedSent && !await isDenied() && $username.length === 1) {
                port.postMessage({m: "tech works!"});
                const m = await tryToLogIn(settings).catch(e => `ERROR AUTH! ${e}, ${formatStack(e)}`);
                if (m.indexOf('ERROR AUTH!') > -1) {
                    port.postMessage({m: "ERROR AUTH! " + e});
                } else {
                    port.postMessage({m: m});
                }
            } else if (!limitedSent && !await isDenied() && window.location.href !== settings.url
                && $username.length === 1) {
                // TODO: Maybe, we need to delete this shit?
                // Maybe we're on wrong page
                dLog('red', 'Paddy', 'URL CHANGED IN authCheck');
                window.location.href = settings.url;
            } else if (!limitedSent && !await isDenied()) {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            } else {
                port.postMessage({m: "tech works!"});
            }
        })()
            .finally(() => {
                if (repeat) {
                    delayPromise(settings.authCheckInterval)
                        .then(() => authCheck());
                } else {
                    dLog('red', 'Paddy', 'Auth repeat stopped!');
                }
            });
    };

    let tryToLogIn = function (settings) {
        return new Promise(function (resolve, reject) {
            let $username = $('input[placeholder="email/username"]');
            let $password = $('input[placeholder="password"]');
            let $remember = $('input[type="checkbox"][value="Remember me"]');
            let $login = $('input[type="submit"][value="Log In"]');

            let performInput = function ($username, $password, $remember, $login) {
                let clickLogin = function () {
                    if ($login.length === 1) {
                        setTimeout(function () {
                            mouseChain({target: $login[0], events: ['click']})
                                .then(() => {
                                    authClicked = Date.now();
                                    resolve("auth_clicked");
                                })
                                .catch(e => reject('Error when click! ' + e));
                        }, 300);
                    } else {
                        port.postMessage({m: "Here must be reject!"});
                        reject("There is no active button!");
                    }
                };
                let clickRemember = function () {
                    if ($remember.length === 1) {
                        mouseChain({target: $remember[0], events: ['click']})
                            .then(() => clickLogin())
                            .catch(e => reject('Error when click! ' + e));
                    } else {
                        clickLogin();
                    }
                };
                let enterPassword = function () {
                    port.postMessage({m: 'Account value is: ' + $username.val()});
                    clearInputElement({
                        element: $password[0],
                        string: settings.password,
                        long: true,
                        fireInput: true
                    })
                        .then(emulateKeyboardLikeHuman).then(clickRemember).catch(function (e) {
                        reject(e);
                    });
                };
                clearInputElement({element: $username[0], string: settings.login, long: true, fireInput: true})
                    .then(emulateKeyboardLikeHuman).then(enterPassword).catch(function (e) {
                    reject(e);
                });
            };

            if ($username.length === 1 && $password.length === 1 && $login.length === 1) {
                if (Date.now() - authClicked < 30000) {
                    reject('Too soon');
                } else {
                    performInput($username, $password, $remember, $login);
                }
            } else {
                reject('Some inputs not exists!');
            }
        });
    };


    // data for justPlaced
    // {stake: '0.30', match: 'Esbjerg v Start - Over/Under 1.5 Goals', leg: 'Over 1.5 Goals', odd: '1.29'}
    // {
    //     "stake": "0.30",
    //     "match": "Chindia Targoviste v UTA Arad - Handicap Betting",
    //     "leg": "UTA Arad (+1)",
    //     "odd": "1.3"
    // }
    let betResult = function (data, justPlaced) {
        return new Promise(function (onSuccess, onReject) {
            let runCollectInfo = function () {
                collectInfo(data, justPlaced)
                    .then(res => onSuccess(res))
                    .then(() => returnInplay())
                    .catch((e) => onReject('Error in collectInfo: ' + e));
            };
            if (document.location.href !== settings.resultsUrl) {
                let $myBets = $('a[href="/my-bets"]');

                if ($myBets.length === 0) {
                    onReject('There is no $myBets! ' + $myBets.length);
                }

                if (!$myBets.hasClass('header__my-bets--active')) {
                    mouseChain({
                        target: $myBets[0],
                        events: ['click'],
                        scroll: true,
                        rejectOnPreventDefault: false
                    })
                        .then(() => setTimeout(runCollectInfo, 1555))
                        .catch((e) => onReject('Error till click $myBets: ' + e));
                } else {
                    setTimeout(runCollectInfo, 1555)
                }
            } else {
                setTimeout(runCollectInfo, 1555)
            }
        });
    };

    /**
     * Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<JQuery>} jQuery element for bet
     */
    const getBetElement = data => new Promise(function (onSuccess, onReject) {
        getBetElementDo(data)
            .then($el => onSuccess($el))
            .catch(e => onReject(e));
    });

    const openAllMarkets = async () => {
        const sel = 'a span.tab__title:textEquals("All Markets")';
        if ($(sel).closest('a.tab--active').length === 0) {
            await mouseChain({target: $(sel)[0], events: ['click'], scroll: true, error: 'OAllM'});
            await delayPromise(1000);
        }
    };

    const getBetElementDo = async data => {
        //#-#-START
        const $teams = await waitForElement('ui-scoreboard-runner span', 300, 10000, false, 2);
        [0, 1].forEach(idx => data[`team${(idx + 1)}`] = $teams.eq(idx).text().replace('@', '').trim().toLowerCase());

        let markets = {
            'ONE_TWO': {
                'ONE': {
                    tab: 'Popular',
                    roots: ['Match Odds'],
                    pivotKeys: ['#TEAM1#', 'home'],
                },
                'TWO': {
                    tab: 'Popular',
                    roots: ['Match Odds'],
                    pivotKeys: ['#TEAM2#', 'away'],
                },
                'DRAW': {
                    tab: 'Popular',
                    roots: ['Match Odds'],
                    pivotKeys: ['The Draw', 'draw'],
                },
                'ONE_DRAW': {
                    tab: 'Popular',
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# And Draw'],
                },
                'TWO_DRAW': {
                    tab: 'Popular',
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM2# And Draw'],
                },
                'ONE_TWO': {
                    tab: 'Popular',
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# And #TEAM2#'],
                }
            },
            'HDP': {
                'HOME': {
                    tab: 'Other Markets',
                    roots: ['Draw no Bet'],
                    pivotKeys: ['#TEAM1# (#PIVOTH#)', '#TEAM1# (#PIVOT#)', '#TEAM1#'],
                },
                'AWAY': {
                    tab: 'Other Markets',
                    roots: ['Draw no Bet'],
                    pivotKeys: ['#TEAM2# (#PIVOTH#)', '#TEAM2# (#PIVOT#)', '#TEAM2#'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    tab: 'Popular',
                    roots: ['Handicap Betting', '^Alternative Handicaps'],
                    pivotKeys: ['#TEAM1# (#PIVOTH#)'],
                },
                'H2': {
                    tab: 'Popular',
                    roots: ['Handicap Betting', '^Alternative Handicaps'],
                    pivotKeys: ['#TEAM2# (#PIVOTH#)'],
                },
                'HX': {
                    tab: 'Popular',
                    roots: ['Handicap Betting', '^Alternative Handicaps'],
                    pivotKeys: ['Handicap Draw (#PIVOTH#)'],
                }
            },
            'TOTAL': {
                'OVER': {
                    tab: 'Goals',
                    roots: ['Over/Under Goals Markets'],
                    pivotKeys: ['Over (#PIVOTH#)', 'Over #PIVOT#'],
                },
                'UNDER': {
                    tab: 'Goals',
                    roots: ['Over/Under Goals Markets'],
                    pivotKeys: ['Under (#PIVOTH#)', 'Under #PIVOT#'],
                }
            },
            'T1_TOTAL': {
                'OVER': {
                    tab: 'Goals',
                    roots: ['Home Team Total Goals Markets'],
                    pivotKeys: ['Over (#PIVOTH#)', 'Over #PIVOT#'],
                },
                'UNDER': {
                    tab: 'Goals',
                    roots: ['Home Team Total Goals Markets'],
                    pivotKeys: ['Under (#PIVOTH#)', 'Under #PIVOT#'],
                }
            },
            'T2_TOTAL': {
                'OVER': {
                    tab: 'Goals',
                    roots: ['Away Team Total Goals Markets'],
                    pivotKeys: ['Over (#PIVOTH#)', 'Over #PIVOT#'],
                },
                'UNDER': {
                    tab: 'Goals',
                    roots: ['Away Team Total Goals Markets'],
                    pivotKeys: ['Under (#PIVOTH#)', 'Under #PIVOT#'],
                }
            }
        };

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw 'Unsupported ' + data.time_value + '/' + data.market + '/' + data.target;
        }

        if (data.sport === 'FOOTBALL' && data.market === 'HDP' && parseFloat(data.pivot) !== 0) {
            throw 'Paddy supports only HDP 0 for FOOTBALL!';
        }

        const market = markets[data.market][data.target];

        const tDigit = data.time_value.replace(/[^\d]/g, '');
        if (data.sport === 'TENNIS') {
            if (data.time_value !== 'FULL_MATCH' && data.market === 'ONE_TWO') {
                if (data.time_value.indexOf('SET') > -1
                    && data.time_value.indexOf('GAME') > -1) {
                    const parts = data.time_value.split('_GAME_');
                    market.roots =
                        [`Set ${parts[0].replace(/[^\d]/g, '')} Game ${parts[1].trim()} Winner`];
                } else {
                    market.roots = [`Set ${tDigit} Winner`];
                }
            } else if (data.market === 'TOTAL') {
                market.roots = [data.time_value.indexOf('SET') > -1
                    ? `Set ${tDigit} Total Games Over/Under #PIVOT#` : `Total Games Over/Under #PIVOT#`];
            } else if (data.market === 'T1_TOTAL') {
                market.roots = [data.time_value.indexOf('SET') > -1
                    ? `Set ${tDigit} Player A Total Games #PIVOT#` : `Player A Total Games #PIVOT#`];
            } else if (data.market === 'T2_TOTAL') {
                market.roots = [data.time_value.indexOf('SET') > -1
                    ? `Set ${tDigit} Player B Total Games #PIVOT#` : `Player B Total Games #PIVOT#`];
            } else if (data.market === 'ONE_TWO') {
                market.pivotKeys = [data.target === 'ONE' ? '1' : '2'];
            } else if (data.market === 'HDP') {
                if (data.time_value === 'FULL_MATCH') {
                    market.roots = [`Game Handicap ${Math.abs(data.pivot)}`];
                }
            }
        } else if (data.sport === 'HOCKEY') {
            market.roots = [data.market === 'TOTAL' ? 'Total Goals Scored' : data.market === 'HDP'
                ? 'Handicap Betting' : market.roots];
        } else if (data.sport === 'FOOTBALL' && data.time_value === 'HALF_TIME') {
            market.roots = ['Half Time'];
        } else if (data.sport === 'TABLETENNIS') {
            if (data.time_value !== 'FULL_MATCH') {
                market.roots = data.market === 'TOTAL' ? [`Total Goals Scored`] : data.market === 'HDP'
                    ? ['Point Handicap', 'Match Points Handicap'] : market.roots;
            } else {
                market.roots = data.market === 'HDP' ? ['Point Handicap', 'Match Points Handicap'] : market.roots;
            }
            if (data.market === 'ONE_TWO') {
                market.pivotKeys = [data.target === 'ONE' ? '1' : '2'];
            }
        } else if (data.sport === 'CYBERSPORT') {
            if (data.time_value !== 'FULL_MATCH') {
                market.roots = [data.market === 'ONE_TWO' ? `Map ${tDigit} Winner` : market.roots];
            } else {
                market.roots = [data.market === 'HDP' ? 'Map Handicap' : market.roots];
            }
        } else if (data.sport === 'BASEBALL') {
            market.roots = [data.market === 'ONE_TWO' ? 'Money Line' : data.market === 'TOTAL' ? `Total Runs`
                : data.market === 'HDP' ? `Run Line` : market.roots];
        } else if (data.sport === 'BASKETBALL') {
            market.roots = [data.market === 'ONE_TWO' ? 'Match Betting' : data.market === 'TOTAL' ? `Total Points`
                : data.market === 'HDP' ? `Handicap Betting` : market.roots];
        } else if (data.sport === 'VOLLEYBALL') {
            if (data.time_value !== 'FULL_MATCH') {
                market.roots = [data.market === 'ONE_TWO' ? `To Win ${tDigit}st Set` : market.roots];
            } else {
                market.roots = [data.market === 'ONE_TWO' ? 'Match Betting' : market.roots];
            }
        }

        replaceInner(market, {
            '#TEAM1#': data.team1,
            '#TEAM2#': data.team2,
            '#PIVOT#': data.pivot,
            '#PIVOTH#': parseFloat(data.pivot) > 0 ? `+${parseFloat(data.pivot)}` : parseFloat(data.pivot),
        });

        dLog('green', 'Paddy', ['Final market is:', market]);

        if ($('a span.tab__title:textEquals("All Markets")').length > 0) {
            await openAllMarkets();
            await waitForElement('div.accordion__title', 333, 5555);
        } else {
            const $currenTab = await waitForElement(`span.tab__title:textEquals("${market.tab}")`, 333, 10000);

            if ($currenTab.closest('a').hasClass('tab--active') === false) {
                await mouseChain({
                    target: $currenTab.closest('a')[0],
                    events: fullClick
                });
                await delayPromise(777);
                await waitForElement('div.accordion__title', 333, 5555);
            }
        }

        const proceedTotals = $parent => {
            let $pivots = $parent.find('div.market-row');
            let curPivotFound = false;
            let floatPivot = parseFloat(data.pivot);
            let $found = $([]);

            $pivots.each(function () {
                let pivotText = $(this).find('div.market-row__text').trt().replace(/[^\d.]/g, '');
                let cPivot = parseFloat(pivotText.toString());
                if (isNaN(cPivot) || isNaN(floatPivot)) {
                    console.log('Check pivots: ' + cPivot + ' / ' + floatPivot);
                } else if (cPivot === floatPivot) {
                    curPivotFound = true;
                    return false;
                } else {
                    console.log(`Let's check ${cPivot}, ${floatPivot}`);
                }
            });

            if (curPivotFound) {
                const idx = data.target === 'OVER' ? 0 : 1;
                $found = $parent.find('.abc-button').eq(idx);
            }

            return $found;
        };

        const proceedVertical = $container => {
            const $items = $container.find('div.market-row');
            let $found = $([]);
            $items.each(function () {
                const $this = $(this);
                const pivot = $this.find('div.market-row__text').trt().toLowerCase();
                if (market.pivotKeys.indexOf(pivot) > -1) {
                    $found = $this.find('.abc-button');
                    return false;
                } else {
                    console.log(`'${pivot}' not in '${market.pivotKeys.join(`', '`)}'`);
                }
            });
            return $found;
        };

        const proceedHorizontal = $container => {
            const $columns = $container.find('div.subheader div');
            const $items = $container.find('div.abc-horizontal-buttons__odds');
            let $found = $([]);
            if ($columns.length !== $items.length) {
                console.log(`proceedHorizontal: ${$columns.length} !== ${$items.length}`);
                return $found;
            }
            $columns.each(function (idx, val) {
                const pivot = $(this).trt().toLowerCase();
                if (market.pivotKeys.indexOf(pivot) > -1) {
                    $found = $items.eq(idx).find('.abc-button');
                    return false;
                } else {
                    console.log(`'${pivot}' not in '${market.pivotKeys.join(`', '`)}'`);
                }
            });
            return $found;
        };

        const getType = $container => {
            if ($container.find('div.accordion__title:contains("Goals Markets")').length > 0) {
                return 'totals';
            } else if ($container.find('div.abc-horizontal-buttons').length > 0) {
                return 'horizontal';
            } else if ($container.find('div.market-row-list').length > 0) {
                return 'vertical';
            } else {
                throw 'Unknown row type!';
            }
        };

        const findPivot = $container => {
            const type = getType($container);
            console.log('%c' + `Type is '${type}'`, 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            if (type === 'totals') {
                return proceedTotals($container);
            } else if (type === 'vertical') {
                return proceedVertical($container);
            } else if (type === 'horizontal') {
                return proceedHorizontal($container);
            } else {
                throw `Unsupported type: '${type}'`;
            }
        };

        let $found = $([]);
        for (const root of market.roots) {
            const func = root.indexOf('^') === 0 ? 'textStartsI' : 'textEqualsI';
            const sch = root.indexOf('^') === 0 ? root.replace('^', '') : root;
            const contSel = `div.accordion__title:${func}('${sch}')`;
            let $containers = $([]);
            await waitForCondition(() => ($containers = $(contSel).closest('div.accordion'), $containers.length > 0),
                300, 10000, `Market not found: ${data.market}, ${func}:(${sch})`);
            await $containers.eachAsync(async function () {
                const $container = $(this);
                if (!$container.hasClass('accordion--open')) {
                    const $el = $container.find('div.accordion__header');
                    await mouseChain({target: $el[0], events: fullClick, scrollTop: true, error: 'CRK1'});
                } else {
                    $container[0].scrollIntoView(true);
                }
                $found = findPivot($container);
                if ($found.length > 0) {
                    return false;
                }
            });
            if ($found.length > 0) {
                break;
            }
        }
        if ($found.length === 0) {
            throw `${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot} not found :(`;
        }
        return $found;
        //#-#-FINISH
    };

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 80;
        dLog('', 'Paddy', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const openEvent = async data => {
        const sport = sportAccordance[data.sport];
        const eventName = data.team1 + ' - ' + data.team2;
        const checkWeAreHere = () => {
            const
                team1 = $('.ui-scoreboard-runner__home').trt(),
                team2 = $('.ui-scoreboard-runner__away').trt(),
                checkEvent = `${team1} - ${team2}`;
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };
        const checkScore = async () => {
            if (!data.score || data.sport !== 'FOOTBALL'
                || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                return true;
            }

            const
                score = $('.ui-scoreboard-score:eq(0)').trt()
                    + ':' + $('.ui-scoreboard-score:eq(1)').trt(),
                scoreNeed = data.score.replace(/[^\d:]/g, '').trim();

            if (score !== scoreNeed) {
                throw `SCORE_CHANGED ${score} !== ${scoreNeed}}`;
            }

            return true;
        };

        if (!checkWeAreHere()) {
            await checkWeAreInInplay();
            const sportTabSel = `a.ribbon__item.sports--${sport}`;
            const $sportTab = await waitForElement(sportTabSel, 300, settings.waitTillLoadingMs);
            let $event = $([]);

            if (!$sportTab.hasClass('ribbon__item--selected')) {
                await mouseChain({target: $sportTab[0], events: fullClick, error: '$sportTab'});
                await delayPromise(555);
            }

            const eventSel = 'a.avb-item__scoreboard';
            await waitForElement(eventSel, 333, 15000);

            $(eventSel).each(function () {
                const eventHere = $(this).find('.ui-scoreboard-runner__home').trt() + ' - ' + $(this).find('.ui-scoreboard-runner__away').trt();

                if (checkEventName(eventHere, eventName)) {
                    $event = $(this);
                    return false;
                }
            });

            if ($event.length === 0) {
                throw `Event ${eventName} not found at ${document.location.href}`;
            }
            await mouseChain({target: $event[0], events: fullClick, error: '$event', scroll: true});
            await waitForCondition(() => checkWeAreHere(), 300, 10000, 'We are not on event!');
        }

        await delayPromise(1111);
        await checkScore();
    };

    const checkWeAreInInplay = async skip => {
        if (skip || window.location.href === 'https://www.paddypower.com/inplay') {
            return;
        }
        const backA = 'span.back-button';
        const inplayA = 'nav.abc-tab-bar a[href="/inplay"]';

        while ($(backA).length === 1) {
            await mouseChain({target: $(backA)[0], events: fullClick, error: 'backA', scroll: true});
            await delayPromise(2222);
        }

        if ($(inplayA).length === 1) {
            await mouseChain({target: $(inplayA)[0], events: fullClick, error: 'inplayA', scroll: true});
            await delayPromise(777);
        } else {
            window.location.href = 'https://www.paddypower.com/inplay';
        }
    };

    const returnInplay = async skip => {
        await mouseChain({target: $('a#IN_PLAY')[0], events: fullClick, error: 'inplayAMenu', scroll: true});
        await delayPromise(1555);
    };

    /**
     * Opens coupon with stake (stakes)
     * @param {object[]} paramData - array of bets to open
     * @returns {Promise<string, string>}
     */

    const openCoupon = async data => {
        dLog('green', 'Paddy', ['openCoupon, paramData:', data]);
        for (const bet of data) {
            await openEvent(bet);
            const $el = await getBetElement(bet);
            dLog('green', 'Paddy', 'We got bet: ' + $el);
            await mouseChain({target: $el[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(555);
        }
    }

    const checkCoefs = async data => {
        const findInData = match => data.find(v => {
            const localMatch = v.team1.toLowerCase() + ' v ' + v.team2.toLowerCase();
            return localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 60;
        });
        const $coupons = await waitForElement('section.sbk-betslip-single__content', 200, 4444);
        let errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $this.find('span.single-info__market-name').text().replace(/(\s-\s.*)/, '').trim().toLowerCase();
            const localCoef = decOdds($this.find('div.odds__regular span:first:visible').trt());
            const localData = findInData(match);
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if (!newAPI && localData && localData.coef !== '' && !isNaN(localCoef)) {
                let checkCoef = parseFloat(localData.coef);
                console.log(`${match} / ${localCoef} vs ${checkCoef}`);
                if (isNaN(checkCoef)) {
                    errors.push(match + ' wrong coef: ' + localData.coef);
                } else if (checkCoef > localCoef) {
                    errors.push(match + ' LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef);
                } else if (localCoef >= checkCoef * 1.2) {
                    errors.push(match + ' TOO BIG coef, have: ' + localCoef + ', need: ' + checkCoef);
                }
                checked++;
            } else if (!localData || isNaN(localCoef)) {
                errors.push(match + ' LOW_COEF - wrong match or localCoef!');
                checked++;
            } else if (localData.coef === '' || newAPI) {
                checked++;
            }
        });
        if (!newAPI && errors.length === 0 && checked === data.length) {
            console.log('%c' + 'checkCoupon => Coefs fine!', 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            return 'Coefs fine!';
        } else if (newAPI) {
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
            if (totalCoef >= nCheck * 1.2) {
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

    const checkLimited = async text => {
        const limiteds = await bMess('PADDY_LIMITEDS').check(864e6).catch(() => []);
        limiteds.push(`${nowFormatted()}: ${text}`);
        if (limiteds.length >= 3) {
            throw `LIMITED ${limiteds.join('; ')}`
        }
        await bMess('PADDY_LIMITEDS').set(limiteds);
        throw `Max is 0!`;
    };

    const proceedBet = data => new Promise((onSuccess, onReject) => {
        currentBetData = {
            data: data,
            max: 0
        };
        let betFinished = async function (success, message) {
            const status = success ? 'ACCEPTED'
                : ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED'].find(t => message.indexOf(t) > -1) || 'FAILED';
            let resultData = {
                "external_id": success ? message.external_id : '',
                "status": status,
                "market": currentBetData.data[0].market,
                "target": currentBetData.data[0].target,
                "pivot": currentBetData.data[0].pivot,
                "coef": success ? message.odd : currentBetData.data[0].coef,
                "stake": success ? message.stake : currentBetData.data[0].stake,
                "maximum": null,
            };

            if (success) {
                await eventsWorkAll('PADDY',
                    settings.eventMaxBets, settings.eventTimeLimit,
                    currentBetData.data, true, true);
                await bMess('WasSuccessStake').set(Date.now());
                await bMess('Stake Maximums').set(0);
                if (settings.newExpresses) {
                    // Hint: currentFirstBet MUST exists, otherwise some shit happened!
                    const
                        currentFirstBet = await bMess('currentFirstBet').check(1080000, true),
                        used = await bMess('usedEvents').check(1080000).catch(() => ({}));
                    if (!used[currentFirstBet]) {
                        used[currentFirstBet] = 1;
                    } else {
                        used[currentFirstBet]++;
                    }
                    await bMess('usedEvents').set(used);
                    dLog('PADDY', 'blue-big', [`We set bet with first: '${currentFirstBet}', now used:`, used]);
                }
            }
            
            const
                doNotSend = !!currentBetData.data[0].betFromParser && !success
                    && resultData.status !== 'LIMITED',
                fBetResult = {};
            if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                for (const g of ['external_id', 'status', 'market', 'target', 'pivot', 'coef',
                    'stake', 'maximum',]) {
                    fBetResult[g] = resultData[g];
                }
                fBetResult.type = 'VALUE';
                fBetResult.mode = currentBetData.data[0].type;
                fBetResult.bookmaker = 'PADDY';
                fBetResult.placedCoef = resultData.coef;
                fBetResult.coef = currentBetData.data[0].coef;
                fBetResult.source = currentBetData.data[0]?.source || 'oddscp';
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

            dLog('green', 'PADDY', ['Result data: ', resultData]);
            port.postMessage({
                answered: !!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED'
                    ? "F_BET" : "BET",
                data: !!currentBetData.data[0].betFromParser ? fBetResult : resultData,
                answer: success ? 'Everything is Okay!' : message,
                doNotSend,
            });
            success ? onSuccess() : onReject(message);
            busy = false;
            ourCommand.clear();
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
                const checkRes = await eventsWorkAll('PADDY',
                    settings.eventMaxBets, settings.eventTimeLimit,
                    currentBetData.data, false, true);
                if (checkRes !== 'OK') {
                    dLog('red', 'PADDY', `We got errors: ${checkRes}`);
                    throw checkRes;
                } else {
                    dLog('big-blue', 'PADDY',
                        `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                    for (const d of currentBetData.data) {
                        const eventName = `${d.team1} - ${d.team2}`;
                        dLog('blue', 'PADDY', `${settings.eventMaxBets} for ${eventName} not reached`);
                    }
                }
            }

            if ($('div.switch-toggle').hasClass('switch-toggle--enabled')) {
                await mouseChain({
                    target: $('button.switch-toggle__button')[0],
                    events: fullClick,
                    scroll: true
                });
                await delayPromise(1500);
            }
        })()
            .then(() => proceedBetDo(data))
            .then(m => betFinished(true, m))
            .catch(e => betFinished(false, `BetDo: ${e}, ${formatStack(e.stack)}`));
    });

    const proceedBetDo = async data => {
        const $errors = () => $('div.sbk-betslip .sbk-betslip-bet__message');
        const checkMaxReached = async () => {
            if ($errors().trt().indexOf('maximum') > -1) {
                // Hint: Just maxes
                currentBetData.max = $errors().find('a.sbk-betslip-bet__message-link').trt().replace(/[^\d.]/, '');
                if (parseFloat(currentBetData.max) === 0) {
                    await checkLimited(`Max is ${currentBetData.max} in ${$errors().find('a.sbk-betslip-bet__message-link').trt()}`);
                } else {
                    data[0].stake = currentBetData.max;
                    await delayPromise(1000);
                }
                return true;
            } else {
                return false;
            }
        };
        const checkSuccess = async () => {
            const errText = () => $('div.sbk-betslip span.error__message').trt();
            let waitStarted = Date.now();
            do {
                if (await checkMaxReached()) {
                    dLog('blue', '!!!!!!!', 'Max reached!');
                    return false;
                } else if ($('div.sbk-betslip span.success-info__message').length === 1) {
                    dLog('green', '!!!!!!!', 'Placed!');
                    return true;
                } else if (errText().length > 0) {
                    dLog('red', '!!!!!!!', `Error: ${errText()}!`);
                    throw (errText().indexOf('odds have changed') > -1 ? 'LOW_COEF:' : '') + errText();
                }
                await delayPromise(200);
            } while (Date.now() - waitStarted < 50000);
            throw 'Error 528';
        };
        const collectCouponDetails = async () => {
            let $coupon = $('div.sbk-betslip-receipt');
            if ($coupon.length !== 1) {
                throw 'Bet placed but there is no coupon!';
            }
            let $expand = $coupon.find('span.content-accordion__header__label-1');
            if ($expand.trt() === 'See the bet receipt') {
                await mouseChain({target: $expand[0], events: fullClick, error: '$expand'});
                await delayPromise(400);
            }
            let result = {
                stake: $coupon.find('span.total-stake__value').trt().replace(/[^0-9\.]/, ''),
                match: $coupon.find('div.line-title').trt(),
                leg: $coupon.find('span.leg-name').trt(),
                odd: $coupon.find('div.leg__odds').trt()
            };
            if (result.odd.length < 1) {
                result.odd = $coupon.find('div.combination__odds').trt();
            }
            dLog('green', 'Paddy', ['result:', result]);
            let $closeBetReceipt = $('section.close-receipt button');
            if ($closeBetReceipt.length !== 1) {
                throw 'Close receipt button not found!';
            }
            await mouseChain({target: $closeBetReceipt[0], events: fullClick, error: '$closeBetReceipt'});
            await delayPromise(400);
            if (typeof currentBetData.data[0].collectAfterAll === 'undefined'
                || !currentBetData.data[0].collectAfterAll) {
                ourCommand.add('coupon', result);
                return await betResult(result, true);
            } else {
                // Hint: It must be possible in the Multics ONLY
                result.external_id = 'MULTI';
                result.bkPivot = result.leg;
            }
            return result;
        };
        const wasCoupon = ourCommand.getAdded('coupon');
        if (wasCoupon !== false) {
            dLog('green', 'Paddy', 'WILL collectBetResults !!!');
            return await betResult(wasCoupon, true);
        }
        await closePreviousCoupons();
        await openCoupon(data);
        do {
            await checkCoefs(data);
            let willPlace = parseFloat(data[0].stake);
            let balance = parseFloat($('div.account-info__primary-label').trt()
                .replace(',', '').replace(/[^\d.]/g, '').trim());
            if (isNaN(balance)) {
                throw 'Get balance error';
            } else if (balance < willPlace) {
                throw 'NO_FUNDS - now: ' + balance + ', we need: ' + willPlace;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
            dLog('green', 'Paddy', 'Will place (performBet): ' + willPlace + ', balance: ' + balance);
            const $input = await waitForElement(data.length === 1 ? 'div.sbk-betslip input.input-text' : 'div.multiple-info input',
                300, 3000);
            if ($input.length !== 1) {
                throw `Wrong number of bet's inputs: ${$input.length}`;
            }
            // try to fiil stake 3 times
            for (let i = 0; i < 3; i++) {
                if (parseFloat(willPlace.toString().replace('.00', '').trim()) === parseFloat($input.val())) {
                    break;
                } else {
                    await clearAndSimulate($input[0], willPlace.toString().replace('.00', '').trim());
                    await delayPromise(1333);
                }
            }
            dLog('yellow', 'Paddy', 'STAKE entered ' + willPlace);
            const $placeBtn = () => $('div.sbk-betslip button.place-bet-button');
            await waitForCondition(() => $errors().length > 0 || $placeBtn().length > 0,
                300, 10000, 'Nor errors nor place!');
            if (await checkMaxReached()) {
                continue;
            }
            if ($errors().length > 0) {
                throw 'Error during bet: ' + $errors().trt();
            }
            if ($placeBtn().length !== 1 || $placeBtn().hasClass('button--disabled')) {
                throw 'No place button or button disabled!';
            }
            await mouseChain({target: $placeBtn()[0], events: fullClick, error: '$placeBtn'});
        } while (!await checkSuccess());
        return await collectCouponDetails();
    };

    /**
     * Close early opened coupons
     */
    const closePreviousCoupons = async () => {
        dLog('green', 'Paddy', 'closePreviousCoupons');
        const $betContainer = $('div.header__betslip-summary-bar-container--open');

        if ($betContainer.length > 0) {
            // expand if needed
            if ($betContainer.find('div.betslip-summary-bar--open').length === 0) {
                await mouseChain({target: $('div.betslip-summary-bar__chevron')[0], events: fullClick, error: 'expand'});
                await delayPromise(444);
            }

            const $closeButton = await waitForElement('button.clear-all-bets', 222, 5555);
            await mouseChain({target: $closeButton[0], events: fullClick, error: '$closeButton'});
            await delayPromise(444);
        }
    }

// ---

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            chrome.storage.local.set({
                'PADDY_COMMAND': ourCommand.get(),
                'PADDY_COMMAND_WAS_SET': Date.now()
            });
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});
        chrome.storage.local.get(['PADDY_COMMAND', 'PADDY_COMMAND_WAS_SET'], function (result) {
            bsDebug(port, 'Saved command:', result);
            if (typeof result.PADDY_COMMAND !== 'undefined' && typeof result.PADDY_COMMAND_WAS_SET !== 'undefined'
                && Date.now() - result.PADDY_COMMAND_WAS_SET < 40000) {
                let currentCommand = result.PADDY_COMMAND;
                console.log(currentCommand);
                chrome.storage.local.remove(['PADDY_COMMAND', 'PADDY_COMMAND_WAS_SET'], function () {
                    waitForCondition(() => {
                        return wasAuthCheck !== false;
                    }, 222, 10000, 'AuthCheck was not', false)
                        .then(() => bsDebug(port, 'Restoring with: ', currentCommand))
                        .then(() => messageProcessor(currentCommand))
                        .catch((e) => bsError(port, 'Something wrong with auth check! ' + e));
                });
            } else {
                chrome.storage.local.remove(['PADDY_COMMAND', 'PADDY_COMMAND_WAS_SET']);
            }
        });
    }

})();
