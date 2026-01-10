// Base version 1
(function () {

    "use strict";

    chrome.runtime.sendMessage({contentScriptLoaded: 'bet365'});

    const FROM_PAGE = 'MKrEHU83iPE8&*GpMj8C';
    const TO_PAGE = 'W!pCHUKMsWM2Fsw4bdLR';

    let doNotLogin = false;
    let doNotCloseAnything = false;

    let
        newAPI = false,
        needStop = false,
        limited = false,
        authClicked = 0,
        wasAuthCheck = false,
        busy = false,
        increaseDelay = false,
        enterError = false,
        stopAuthStart = 0,
        autoParams = {},
        canContinue = false,
        bkHere = '',
        bkDomain = '',
        port,
        settings,
        logOutSent = false,
        weAreLogged = false;

    const checkUrls = ['bet365', '365838', '288sb', '288365', 'allsport365', '365sport365',
        '365365040', '365365304',
        // for https://www.bet365.com.au/#/IP/
        'bet365.com',
    ];

    bMess('contentLoadedFor').check()
        .then(m => {
            autoParams = m;
            dLog('bigred: ', '365', 'Auto load!');
        })
        .catch(e => dLog('bigred', '365', 'Classic load!'))
        .then(() => canContinue = true);

    waitForCondition(() => canContinue, 100, 3000).then(() => {
        if (!autoParams.bk || !autoParams.host) {
            bkHere = window.location.href.indexOf('bet365.com') > -1 ? "bet365"
                : window.location.href.indexOf('bet365.es') > -1 ? "bet365es"
                    : window.location.href.indexOf('bet365.gr') > -1 ? "bet365gr" :
                        window.location.href.indexOf('bet365.ee') > -1 ? "bet365it" :
                            window.location.href.indexOf('bet365.com.au') > -1 ? "bet365au" : "bet365ru";
            bkDomain = ({
                'bet365': '.com',
                'bet365es': '.es',
                'bet365gr': '.gr',
                'bet365ru': '.ru',
                'bet365it': '.ee',
                'bet365au': '.com.au',
            })[bkHere];
        } else {
            bkHere = autoParams.bk;
            bkDomain = autoParams.host.substring(autoParams.host.lastIndexOf('.'));
        }
        port = window.self === window.top
            ? chrome.runtime.connect({name: `port_${bkHere}`})
            : {postMessage: () => console.log(arguments)};
        settings = {
            stopAuthInterval: 120000,
            authCheckInterval: 2000,
            restartEvery: 1800000,
            waitTillLoadingMs: 60000,
            maxWaitForBetStatus: 50000,
            url: bkHere === "bet365" ? "https://www.bet365.com" : "https://www.bet365.ru",
            login: '',
            password: '',
            phone: '',
            uid: '',
            fork: {
                shoulder: 0,
                maxWait: 0,
                maxLosePercent: 0,
            },
            forkOnly: false,
            stake_fork: {},
            eventTimeLimit: 3600000,
            eventMaxBets: 3,
            betweenBets: 25000,
            hostname: document.location.hostname,
            newExpresses: false,
        };
    });

    let loaded = Date.now();

    let currentBetData = false;
    let currentCommand = '';

    const ourCommand = new ourCommandProto();

    const sportAccordance = {
        'FOOTBALL': 'Soccer',
        'TENNIS': 'Tennis',
        'TABLETENNIS': 'Table Tennis',
        'BASEBALL': 'Baseball',
        'HOCKEY': 'Ice Hockey',
        'BASKETBALL': 'Basketball',
        'VOLLEYBALL': 'Volleyball',
        'HANDBALL': 'Handball',
        'CYBERSPORT': 'Esports',
    };

    const getHeaderNameSport = {
        'FOOTBALL': 'Match Betting',
        'TENNIS': 'Match Coupon',
        'CYBERSPORT': 'Match Lists',
        'TABLETENNIS': 'Match Coupon'
    };

    const couponRowSel = [
        'div.bsm-BetslipStandardModule div.qbs-NormalBetItem_ContentWrapper:visible',
        'div.lqb-QuickBetslip div.lqb-QuickBetslip_ContentWrapper:last',
        'div.lqb-QuickBetslip_Content div.lqb-NormalBetItem_ContentWrapper:visible',
        'div.bss-NormalBetItem_Wrapper:visible',
    ];

    const messageProcessor = (message, direct) => {
        bsDebug(port, (direct ? 'D' : 'S') + `:messageProcessor (${busy})`, message);
        newAPI = !!message.newAPI;
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
                    params: {data: `bet365 MAXIMUM ${e} for ` + JSON.stringify(message)}
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
        currentCommand = message.action;
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
            if (message.login === 'do_not_login') {
                doNotLogin = true;
                wasAuthCheck = true;
                bsDebug(port, 'Do not login mode!');
                return;
            }
            if (!!message.qr_code) {
                dLog('green', 'b365', ['loadQrCode:', message.qr_code]);
                loadQrCode(message.qr_code);
            }
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.phone = message.phone;
            settings.uid = message.uid;
            settings.email = message.email;
            settings.fork = message.fork;
            settings.forkOnly = typeof message.fork === 'object' && Object.keys(message.fork).length > 0;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            settings.newExpresses = !!(settings?.stake_fork && settings.stake_fork?.newExpresses);
            if (message.start_url) {
                settings.url = message.start_url;
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
        } else if (!doNotLogin && getBalance(true) === 'null'
            && document.location.href.indexOf('https://members.') === -1) {
            waitForCondition(() => typeof wasAuthCheck === 'boolean' && wasAuthCheck,
                333, 30000, 'No auth check!')
                .catch(e => port.postMessage({
                    answered: message.action,
                    status: "error",
                    answer: `Not logged in (${wasAuthCheck}/${message.action})!`
                }))
                .then(() => bsDebug(port,
                    `Executing command (${busy}/${direct} => ${settings.login}/${settings.password}) after wasAuthCheck`, message))
                .then(() => {
                    if (!busy) {
                        messageProcessor(message, false);
                    }
                });
        } else if (!doNotLogin && message.action === 'UPDATE_BALANCE') {
            updateBalance();
        } else if (typeof methods[message.action] === "function") {
            if (doNotLogin && ['GET_EVENTS'].indexOf(message.action) === -1) {
                port.postMessage({
                    answered: message.action,
                    status: "error",
                    answer: "Instance working in 'do not login' mode!"
                });
                return;
            }
            busy = true;
            ourCommand.set(message);
            methods[message.action](message.data)
                .then(() => bsDebug(port, "It's looks like " + message.action + " done!"))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(() => {
                    dLog('green', 'b365', `Release: ${message.action}`);
                    busy = false;
                    ourCommand.clear();
                })
                .then(delayFunction(3000))
                .then(() => {
                    if (message.action === 'GET_EVENTS' && !busy && !ourCommand.isSet()) {
                        port.postMessage({
                            m: "CLOSE_ME",
                        })
                    }
                });
        }
    };

    const deposit = data => new Promise(function (onSuccess, onReject) {
        bsDebug(port, 'Deposit!', data);
        let report = function (s, message) {
            bsDebug(port, `Report! ${s} / ${message}`);
            port.postMessage({
                answered: "DEPOSIT",
                status: s ? 'SUCCESS' : ['NO_FUNDS', 'RESTRICTED'].find(c => typeof m === 'string' && m.indexOf(c) > -1) || 'FAILED',
                answer: message
            });
            s ? onSuccess(message) : onReject(message);
            if (window.location.href.indexOf('https://members.') > -1) {
                delayPromise(7777).then(() => {
                    window.close()
                });
            }
        };
        let depositResult = {};
        let getDepositResult = function () {
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
        let letsRockNRoll = function () {
            bsDebug(port, 'letsRockNRoll');
            if (ourCommand.getAdded('skrillEntered') !== false) {
                waitForCondition(() => {
                    getDepositResult();
                    return typeof depositResult.success === 'boolean';
                }, 1000, 120000, 'no deposit result (or it is outdated) for 120s!')
                    .then(() => {
                        //bsDebug(port, 'getDepositResult', depositResult, 'COLOR:yellow,red');
                        if (data.paysystem === 'SKRILL') {
                            chrome.storage.local.remove(['SKRILL_COMMAND', 'SKRILL_COMMAND_WAS_SET']);
                        }
                        report(depositResult.success, typeof depositResult.message === 'string' ? depositResult.message : 'No message :(');
                    })
                    .catch((e) => report(false, 'preFinal: ' + e));
            } else if (document.location.href.indexOf('/Members/Authenticated/Bank/Deposit/default.aspx') > -1) {
                bsDebug(port, '-= WORK =-');
                waitForElement('select', 333, 15000)
                    .then(($el) => {
                        if ($el.length === 1 && $el.val() !== '18') {
                            $el.val('18').trigger('change');
                            return delayPromise(3000);
                        } else if ($el.length > 1) {
                            throw 'We are somewhere else :(';
                        }
                    })
                    .then(delayFunction(1000))
                    .then(() => {
                        let $email = $('input[type="text"][id$="tEmail"]');
                        bsDebug(port, '"' + $email.val().trim() + '" === "' + data.login + '"? ' +
                            ($email.val().trim() !== data.login));
                        if ($email.val().trim() !== data.login) {
                            return clearAndSimulateD($email[0], data.login);
                        }
                    })
                    .then(delayFunction(1000))
                    .then(() => clearAndSimulateD($('input[type="text"][id$="tAmt"]')[0], data.amount))
                    .then(() => {
                        increaseDelay = true;
                        ourCommand.add('skrillEntered', true);
                        chrome.storage.local.set({
                            'SKRILL_COMMAND': ourCommand.get(),
                            'SKRILL_COMMAND_WAS_SET': Date.now()
                        });
                    })
                    .then(delayFunction(1000))
                    .then(() => dClick($('a[id$="_lkSbmt"]')[0]))
                    .then(waitForNotConditionF(() => {
                        let $error = $('div[mbname="DepositUnsuccessful"]:visible');
                        return $error.length > 0 && $error.trt().indexOf('problem processing your deposit') > -1;
                    }, 333, 5000, 'RESTRICTED!'))
                    //.then(() => report(true, 'Hmmm...'))
                    .catch((e) => report(false, 'Deposit: ' + e));
            } else {
                bsDebug(port, '-= GO =-');
                waitForElement('div.hm-MainHeaderMembersWide_Deposit', 333, 15000)
                    .then(() => (new bMessagingProto('BET_365')).set(ourCommand.get(), 0))
                    .then(delayFunction(1000))
                    .then(() => dClick($('div.hm-MainHeaderMembersWide_Deposit')[0]))
                    // Hint: here new window must appear...
                    .then(() => {
                        bsDebug('It looks like new window opened...');
                        busy = false;
                        ourCommand.clear();
                    })
                    .catch((e) => report(false, 'Go to deposit: ' + e));
            }
        };
        letsRockNRoll();
    });

    const withdraw = data => new Promise(function (onSuccess, onReject) {
        bsDebug(port, 'Withdraw!', data);
        let report = function (success, message) {
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
            if (window.location.href.indexOf('https://members.') > -1) {
                delayPromise(10000).then(() => {
                    window.close()
                });
            }
        };
        (async () => {
            bsLogger('green', 'b365', `withdraw processing at (${(window.self === window.top)})' ${document.location.href}`);
            if (document.location.href.indexOf('//members.') > -1) {
                if (window.self === window.top) {
                    await waitForElement('#mhMenu', 300, 15000);
                    await delayPromise(1000);
                    await clickSequence([new QueueObject(
                            '#mhMenu span.members-menuItem_Link:textEquals("Bank")',
                            $el => $el.attr('class').indexOf('HighlightedLink') === -1)],
                        null, null, false, true);
                } else {
                    if ($('#HeaderTitle').trt() !== 'Withdraw') {
                        const $a = await waitForElement('a:textEquals("Withdraw")', 300, 10000);
                        await dClick($a[0]);
                        bsLogger('green', 'b365', 'Switched to withdraw');
                    } else {
                        bsLogger('green', 'b365', 'Withdraw processing');
                    }
                    await delayPromise(2000);
                    const inputSel = 'input.hideAmount';
                    await waitForElement(inputSel, 300, 15000, false, 1,
                        `number at ${document.location.href}`);
                    await clearAndSimulateD($(inputSel)[0], data.amount.toString(), true);
                    bsLogger('green', 'b365', 'Amount entered');
                    await delayPromise(1000);
                    await clearAndSimulateD('input[type="password"]', ourCommand.getAdded('withdraw_password'));
                    bsLogger('green', 'b365', 'Password entered');
                    await delayPromise(2000);
                    await dClick($('a:textEquals("Withdraw")')[0]);
                    report(true, 'Everything should be okay!');
                }
            } else {
                const $el = await waitForElement('div.hm-MainHeaderMembersWide_MembersMenuIcon', 333, 15000);
                await dClick($el[0]);
                await waitForElement('div.um-MembersLinkRow:textEquals("Bank")', 333, 3333);
                ourCommand.add('withdraw_password', settings.password);
                await bMess('BET_365').set(ourCommand.get());
                await delayPromise(3000);
                await dClick($('div.um-MembersLinkRow:textEquals("Bank")')[0]);
                bsDebug('It looks like new window opened...');
                busy = false;
                ourCommand.clear();
            }
        })()
            .catch(e => report(false, 'Withdraw: ' + e));
    });

    const betResultsWorker = async function (data, limit) {
        dLog('blue', '365', `HXO betResultsWorker at ${document.location.href}`);
        const
            started = Date.now(),
            $rows = () => $('div.h-BetSummary'),
            $more = () => $('div.hl-SummaryRenderer_ShowMore:visible'),
            collectOneBet = ($details, settled) => {
                const
                    stakeTrt = $details.find('span.h-ConfirmationBetInfo_StakeRowValue').trt(),
                    rupies = stakeTrt.indexOf('RS.') > -1,
                    stakeDraft = /\d+.\d+/.exec(stakeTrt);
                let stake = stakeDraft && stakeDraft[0]
                    ? (rupies ? stakeDraft[0].replace(/[^\d.]/g, '') : stakeDraft[0]) : '';
                const
                    date = $details.find('div.h-BetConfirmationHeader_DateTimeContainer div').first().trt(),
                    returns = $details.find('div.h-ConfirmationBetInfo_ReturnContainer').text()
                        .replace('RS.', '').replace(/[^\d.]/g, '')
                        .trim().replace(/\.$/, "");
                let status = 'ACCEPTED';
                if (settled) {
                    const st = parseFloat(stake), rt = parseFloat(returns);
                    if ((st > rt && rt === 0) || (st > rt)) {
                        status = 'LOSE';
                    } else if (rt > st && rt > 0) {
                        status = 'WON';
                    } else {
                        status = 'REFUNDED';
                    }
                }
                const betStatus = $details.find('div.h-ConfirmationBetSelection_Status').trt();
                //dLog('', 'b365', `betStatus: '${betStatus}'`);
                if (betStatus.indexOf('½') > -1 && betStatus.indexOf('Lose') > -1) {
                    status = 'LOSE';
                } else if (betStatus.indexOf('½') > -1 && betStatus.indexOf('Lose') === -1) {
                    status = 'WON';
                } else if (betStatus.indexOf("Void") > -1) {
                    stake = returns;
                }
                if (betStatus.indexOf("Void") > -1 && betStatus.indexOf('Lose') > -1) {
                    stake = returns;
                }
                return {
                    external_id: $details.find('div.h-BetConfirmationHeader_Reference').trt(),
                    status: status,
                    date: date,
                    coef: multiplySelectorValues($details.find('div.h-ConfirmationBetSelection_Odds')),
                    stake: stake.replace('RS.', '')
                        .replace(/[^\d.]/g, ''),
                    result: returns,
                    bkPivot: $details.find('div.h-ConfirmationBetSelection_Name ').trt(),
                    match: $details.find('div.h-ConfirmationBetSelection_Fixture').trt()
                };
            },
            collected = new Set(),
            fOffset = async (frame) => {
                const membersFrameOffset = await getBoxOffset('#MembersIframe');
                if (!membersFrameOffset) {
                    throw `Can't get #MembersIframe offset!`;
                }
                let result = null;
                if (frame === 'membersFrame') {
                    result = membersFrameOffset;
                } else {
                    const membersHostFrameOffset = nestedOffset(membersFrameOffset,
                        '#MembersHostFrame');
                    if (frame === 'membersHostFrame') {
                        result = membersHostFrameOffset;
                    } else if (frame === 'historyV3Iframe') {
                        result = nestedOffset(membersHostFrameOffset,
                            $getIFrame('#MembersHostFrame')
                                .find('iframe.historyV3Iframe').get(0));
                    }
                }
                if (!result) {
                    throw `Unsupported frame ${frame}`;
                }
                dLog('', '365', `Got offset for ${frame}: ${result.x} x ${result.y}`);
                return result;
            };
        for (const now of ['Unsettled Bets', 'Settled Bets',]) {
            const $b = async () => await waitForElementO({
                s: `div.nm-MenuItem_Text:textEquals('${now}')`,
                i: 333, m: 25000, e: `results $b - ${now}`
            });
            await delayPromise(1000);
            let tr = 0;
            const checkNow = () => {
                const title = $('div.nh-NavigationHeaderModule_Title').trt();
                dLog('', 'b365', `${title} and ${now}`);
                return title.indexOf(now) > -1;
            }
            do {
                tr++;
                await dClick((await $b())[0], false, 'Z1',
                    await fOffset('membersFrame'));
                await delayPromise(5000);
            } while (tr < 5 && !checkNow())
            if (!checkNow()) {
                throw `We can't switch to ${now}!`;
            }
            await dClick($('div.hsc-HistoryRangeButton:textEquals("Last 48 Hours")')[0],
                false, 'Z2', await fOffset('membersFrame'));
            await delayPromise(5000);
            await dClick($('div.hsc-HistoryRangeSelector_ShowHistory')[0],
                false, 'Z2', await fOffset('membersFrame'));
            await waitForCondition(() => $rows().length > 0
                    || $('div.hl-SummaryRenderer_Message:contains(" there is no history")').length > 0,
                333, 25000,
                'Strange situation!');
            await delayPromise(5000);
            const checked = [], idsLength = data.length > 0 ? data.length : limit;
            let page = 0;
            while ($rows().length > checked.length) {
                dLog('blue', 'NNN', `In the loop: ${$rows().length} / ${checked.length}`);
                const
                    $cur = $rows().eq(checked.length),
                    $link = $cur.find('div.h-BetSummary_BetDetails');
                checked.push($cur.trt());
                // Open bet details
                await dClick($link[0], true, 'Z4',
                    async () => await fOffset('membersFrame'), true);
                await delayPromise(1555);
                const $area = await waitForElementO({
                    s: 'div.h-BetConfirmation',
                    i: 333, m: 20000, e: 'result $area'
                })
                    .catch(() => $([]));
                let needBack = false;
                if ($area.length !== 0) {
                    let bet = {}, counter = 0;
                    while (!bet?.external_id && counter < 3) {
                        bet = collectOneBet($area, now === 'Settled Bets');
                        counter++;
                    }
                    if (data.length === 0 || data.indexOf(bet.external_id) > -1) {
                        collected.add(JSON.stringify(bet));
                    }
                    needBack = true;
                    dLog('', 'B365', `Limit: ${limit}, collected: ${collected.size}, checked: ${checked.length}`);
                } else {
                    dLog('red', 'B365', 'No bet details!');
                }
                if (collected.size > limit
                    || checked.length > limit
                    || collected.size >= idsLength
                ) {
                    dLog('red', 'B365',
                        `Stopped because of: (${collected.size} || ${checked.length} > ${limit}) || ${collected.size} >(=) ${idsLength}`);
                    break;
                }
                await delayPromise(2222);
                // Close bet details
                if (needBack) {
                    await dClick($('div.hl-BackButtonWithHistory')[0],
                        false, 'Z5', await fOffset('membersFrame'));
                    await delayPromise(1222);
                } else {
                    dLog('red', 'B365', 'No bet details - no click to back!');
                }
                dLog('blue', 'NNN', `AFTER Z5 (${needBack}): ${$rows().length} / ${checked.length}`);
                // Hint: Every time he back = it's crap go fully back!
                // Check that we are in time, otherwise return all collected for the moment
                if (Date.now() - started > 1100000) {
                    dLog('bigred', '365',
                        `Stopped collecting at ${(Date.now() - started)} and ${checked.length}`);
                    const res = [];
                    for (const i of collected) {
                        res.push(JSON.parse(i));
                    }
                    return res;
                }
                await waitForCondition(() => $rows().length > 0, 333, 20000,
                    `No $rows at ${document.location.href}`);
                if ($rows().length === checked.length && $rows().length < limit && $more().length > 0) {
                    const rowsBefore = $rows().length;
                    dLog('blue', 'NNN', `rowsBefore: ${rowsBefore}`)
                    await delayPromise(2222);
                    await dClick($more()[0], true, 'Z6',
                        async () => await fOffset('membersFrame'), true);
                    dLog('', 'B365', `!!!  N E X T ( ${page} )  P A G E  !!!`);
                    page++;
                    await delayPromise(1000);
                    await waitForCondition(() => $rows().length > rowsBefore,
                        333, 20000, 'No more rows!')
                        .catch(e => dLog('blue', 'NNN', `${e}: ${$rows().length} / ${rowsBefore}`));
                    await delayPromise(1000);
                }
            }
            dLog('blue', 'NNN', `Out of the loop: ${$rows().length} <= ${checked.length}`);
            await delayPromise(5000);
            dLog('', `B365`, [`Collected ${now} stage:`, collected]);
        }
        dLog('', 'B365', `Finished collecting!`);
        const res = [];
        for (const i of collected) {
            res.push(JSON.parse(i));
        }
        return res;
    };

    const betResult = async (inD) => {
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 35 ? parseInt(inD[1]) : 60) : 60;
        dLog('blue', '365',
            `betResult (${(window.self === window.top)}) at ${document.location.href}`);
        if (window.self === window.top) {
            const $el = await waitForElement('div.hm-MainHeaderMembersWide_MembersMenuIcon',
                333, 15000, false, 1,
                `MEMBERS at ${document.location.href}`);
            await dClick($el[0], false, 'br1');
            let opened = true;
            await waitForElementO({
                s: 'div.ul-MembersLinkButton_Text:textEquals("History")',
                i: 333, m: 7000, e: 'User panel not opened!'
            }).catch(e => opened = false);
            if (!opened) {
                port.postMessage({
                    answered: 'BET_RESULT',
                    status: 'error',
                    answer: 'User panel not opened!',
                });
                return;
            }
            await delayPromise(3000);
            await bMess('BET_365').set(ourCommand.get());
            await dClick($('div.ul-MembersLinkButton_Text:textEquals("History")')[0],
                false, 'br2');
            const res = await bMess('BET_RESULTS').get(1090000)
                .catch(e => ({success: false, message: e}));
            const a = {
                answered: 'BET_RESULT',
                status: res.success ? 'success' : 'error',
                answer: res.message,
            };
            dLog('red', 'b365', ['Result is:', a]);
            port.postMessage(a);
            await delayPromise(1000);
            ourCommand.clear();
            await dClick($('div[class$="MainHeaderCentreWide "] div[class*="HeaderMenuItem"]:textEquals("In-Play")')[0],
                false, 'br3');
        } else if (checkUrls.some(c => document.location.href.indexOf(`members.${c}.`) > -1)
            && document.location.href.indexOf('/History') === -1
            && document.location.href.indexOf('hostedBy=MEMBERS_HOST') === -1) {
            dLog('green', 'B365', `BET_RESULT iFrame at ${document.location.href}`);
            const res = await betResultsWorker(data, limit).catch(e => `${e}, ${formatStack(e.stack)}`);
            ourCommand.clear();
            await bMess('BET_RESULTS').set({success: typeof res !== 'string', message: res,});
        } else {
            dLog('', '365', `Bad iFrame at ${document.location.href}`);
        }
    };

    const checkPayments = () => new Promise(function (onSuccess, onReject) {
        bsDebug(port, `checkPayments (${ourCommand.getAdded('action')})!`);
        const report = (success, message) => {
            bsDebug(port, 'Report! ' + success + ' / ' + message, ourCommand.getAdded('collected'));
            const a = ourCommand.getAdded('action') === 'BET_RESULT'
                ? {
                    answered: 'BET_RESULT',
                    status: success ? 'success' : 'error',
                    answer: success ? ourCommand.getAdded('collected') : message
                }
                : {
                    answered: 'CHECK_PAYMENTS',
                    data: success ? ourCommand.getAdded('collected') : [],
                    message: message
                };
            dLog('red', 'b365', ['Result is:', a]);
            port.postMessage(a);
            success ? onSuccess(message) : onReject(message);
            if (window.self !== window.top) {
                bMess('collectingFinished').set(true)
                    .then(() => ourCommand.clear())
                    .then(() => dLog('red', 'B365', 'collectingFinished is set!'));
            }
            if (window.location.href.indexOf('https://members.') > -1) {
                // chrome.runtime.sendMessage({closeTabByPartOfUrl: settings.url}, () => {
                // });
                delayPromise(111).then(async () => {
                    //window.close();
                    await dClick($('div[class$="Bet365LogoImage "]')[0]);
                    dLog('green', 'B365', ['! ! !  M U S T   B E   C L O S E D  ! ! !', ourCommand.get()['data']]);
                });
            }
        };
        const performCollect = () => {
            (async () => {
                await waitForCondition(() => $getIFrame('iframe.historyV3Iframe',
                        $getIFrame('#MembersHostFrame'))
                        .find('#bet365-searchresults div.fn-bet-summary-record').length > 0,
                    1000, 12000, '')
                    .catch(() => 'Nothing to collect...');
                let collected = ourCommand.getAdded('collected');
                $getIFrame('iframe.historyV3Iframe', $getIFrame('#MembersHostFrame'))
                    .find('#bet365-searchresults div.fn-bet-summary-record').each(function () {
                    let $this = $(this);
                    let desc = $this.find('div.result-item-row').text().replace(/(?:\r\n|\r|\n)/g, '').replace(/\s+/g, ' ').trim();
                    collected.push({
                        description: desc,
                        type: ourCommand.getAdded('oneCollected') ? 'OUT' : 'IN',
                        paysystem: desc.indexOf('Neteller') > -1 ? 'NETELLER' : 'SKRILL',
                        amount: $this.find('div.result-item-header').text().replace(/[^\d.]/g, '').trim(),
                        success: true
                    });
                });
                ourCommand.add('collected', JSON.parse(JSON.stringify(collected)));
                dLog('blue', 'B365', [`performCollect ${(ourCommand.getAdded('oneCollected') ? 'OUT' : 'IN')}`, JSON.parse(JSON.stringify(collected))]);
            })()
                .then(nextDw)
                .catch(e => report(false, `performCollect: ${e}`));
        };
        const selectPeriod = async () => {
            if (ourCommand.getAdded('action') === 'BET_RESULT') {
                await waitForElementO(
                    {
                        s: () => $getIFrame('#MembersHostFrame')
                            .find('a[id$="_MenuItem_dvItem"]:contains("Last 48 Hours")'),
                        i: 333, m: 20000, e: 'MembersHostFrame'
                    })
                    .catch(e => dLog('red', 'B365', 'Last 48 Hours'));
                await dClick($getIFrame('#MembersHostFrame')
                    .find('a[id$="_MenuItem_dvItem"]:contains("Last 48 Hours")')[0]);
            } else {
                await dClick($getIFrame('#MembersHostFrame')
                    .find('a[id$="_MenuItem_dvItem"]:contains("Choose Date Range")')[0]);
                await (async () => {
                    await delayPromise(3000);
                    const d = new Date();
                    const dString = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() - 5).toString()
                        .padStart(2, '0')}/${d.getFullYear()}`;
                    const $fromTo = $getIFrame('#MembersHostFrame').find('div[id$="_lblFromDate"]');
                    if ($fromTo.trt() !== dString) {
                        await dClick($fromTo[0]);
                        await delayPromise(1500);
                        const desiredMonth = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
                            'September', 'October', 'November', 'December'][(d.getMonth() - 6)];
                        while ($getIFrame('#MembersHostFrame').find('table.calHeader:first').text()
                            .trim().indexOf(desiredMonth) === -1) {
                            await dClick($getIFrame('#MembersHostFrame')
                                .find('a.nav.prevArrow')[0]);
                            await delayPromise(1500);
                        }
                        await dClick($getIFrame('#MembersHostFrame')
                            .find(`table.fl td:textEquals("${d.getDate()}"):first`)[0]);
                        await delayPromise(1000);
                    }
                    await dClick($getIFrame('#MembersHostFrame')
                        .find('input.SbmtBtn[value="Show History"]')[0]);
                })();
            }
        };
        const collectOneBet = ($details, settled) => {
            const stakeDraft = /\d+.\d+/.exec($details
                .find('table.bet-confirmation-details-row-stakedescription-table').trt());
            const stake = stakeDraft && stakeDraft[0] ? stakeDraft[0] : '';
            const date = $details.find('div.bet-confirmation-header-datetime').trt();
            const returns = $details.find('td.bet-confirmation-amounts-table-value:last').text()
                .replace('RS.', '').replace(/[^\d.]/g, '')
                .trim().replace(/\.$/, "");
            let status = 'ACCEPTED';
            if (settled) {
                if (parseFloat(stake) > parseFloat(returns) && parseFloat(returns) === 0) {
                    status = 'LOSE';
                } else if (parseFloat(returns) > parseFloat(stake) || parseFloat(returns) > 0) {
                    status = 'WON';
                } else {
                    status = 'REFUNDED';
                }
            }
            return {
                external_id: $details.find('div.bet-confirmation-header-ref').trt(),
                status: status,
                date: date,
                coef: multiplySelectorValues($details.find('div.bet-confirmation-details-row-odds')),
                stake: stake.replace('RS.', '').replace(/[^\d.]/g, ''),
                result: returns,
                bkPivot: /* $details.find('div.bet-confirmation-details-row-plbtdescription:first').trt() + ' ' + */
                    $details.find('div.bet-confirmation-details-row-selectionname:first').trt(),
                match: $details.find('div.bet-confirmation-details-row-eventname:first').text().replace(/\d+\/\d+\/\d+/, '').trim()
            };
        };
        const collectVisible = async () => {
            let localCollected = 0;
            let start = 0;
            let $more = $([]);
            const c = ourCommand.getAdded('collected');
            const $rows = () => $getIFrame('iframe.historyV3Iframe',
                $getIFrame('#MembersHostFrame'))
                .find('#bet365-searchresults div.fn-bet-summary-record');
            while (!checkFinish() && (start === 0 || $more.length > 0)) {
                if ($more.length > 0) {
                    bsDebug(port, `GO NEXT ITERATION! ${$rows().length}, ${start}`);
                    await dClick($more[0], true);
                    await delayPromise(2000);
                }
                await waitForCondition(() => (console.log(`${$rows().length}, ${start}`), $rows().length > start), 1500, 15000, '')
                    .catch(() => console.log(`There is no rows :(s`));
                let idx = 0;
                while (idx < $rows().length && !checkFinish()) {
                    let reviewed = ourCommand.getAdded('reviewed');
                    if (idx < start) {
                        console.log('%c' + `${idx} S K I P ! (${idx}<${start}), localCollected: ${localCollected}, reviewed: ${reviewed}`,
                            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                        idx++;
                        continue;
                    } else {
                        console.log('%c' + `${idx} W O R K ! (${idx}=>${start}), localCollected: ${localCollected}, reviewed: ${reviewed}`,
                            'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    }
                    ourCommand.add('reviewed', ++reviewed);
                    localCollected++;
                    const $this = $rows().eq(idx);
                    const $link = $this.find('div.bet-summary-bet-confirmation-link');
                    await dClick($link[0], true);
                    await delayPromise(1555);
                    const $area = await waitForElementO({
                        s:
                            () => $getIFrame('iframe.historyV3Iframe',
                                $getIFrame('#MembersHostFrame'))
                                .find('div.bet-confirmation-viewer'),
                        i: 333, m: 5000, e: 'historyV3Iframe'
                    });
                    await delayPromise(1888);
                    const bet = collectOneBet($area, ourCommand.getAdded('oneCollected'));
                    await delayPromise(1555);
                    await dClick($getIFrame('#MembersHostFrame').find('div.HeaderBack')[0]);
                    await delayPromise(1555);
                    if (bet.external_id !== '' &&
                        (ourCommand.getAdded('limit_data').length === 0
                            || ourCommand.getAdded('limit_data').indexOf(bet.external_id) > -1)) {
                        c.push(bet);
                    }
                    await delayPromise(1333);
                    idx++;
                }
                $more = $getIFrame('iframe.historyV3Iframe', $getIFrame('#MembersHostFrame'))
                    .find('#show-more-button:visible');
                bsDebug(port, `Collected on iteration: ${c.length} / ${localCollected} / ${$more.length}`);
                ourCommand.add('collected', c);
                start = $rows().length === 0 ? 100500 : localCollected;
            }
        };
        const collectBets = async () => {
            await collectVisible(0)
                .catch(e => bsError(port, `collectBets: ${e}`));
            nextDw();
        };
        const nextDw = () => {
            const dw = !ourCommand.getAdded('oneCollected') ? 'one' : 'two';
            ourCommand.add(dw + 'Collected', true);
            dLog('blue', 'b365', [
                `-= nextDw =- Now collected (${dw}): ${ourCommand.getAdded('collected').length}`
                + `(back: ${$getIFrame('#MembersHostFrame').find('div.HeaderBack').length}`
                + `, main: ${(window.top === window.self)})`,
                ourCommand.get()]);
            if (dw === 'two') {
                report(true, 'It must be Okay :)');
                delayPromise(1000)
                    .then(() => window.close());
            } else {
                const url = document.location.href;
                (async () => {
                    while (document.location.href === url
                    && ((await waitForElementO({
                        s: () => $getIFrame('#MembersHostFrame')
                            .find('div.HeaderBack'), i: 444, m: 3000, e: 'HeaderBack'
                    })).length > 0)) {
                        bsDebug(port, `We're going to click "BACK"!`);
                        await waitDelayClickF(() => $getIFrame('#MembersHostFrame')
                                .find('div.HeaderBack'),
                            30000, null, null, false, true)();
                        bsDebug(port, 'N-E-X-T D-W B-A-C-K C-L-I-C-K-E-D !!!');
                        await delayPromise(3000);
                    }
                })()
                    .then(letsRockNRoll)
                    .catch(e => report(false, `nextDw ${e}`));
            }
        };
        const checkFinish = () => {

            const r = (ourCommand.getAdded('limit_data').length > 0
                    && ourCommand.getAdded('collected').length >= ourCommand.getAdded('limit_data').length)
                || (ourCommand.getAdded('reviewed') >= ourCommand.getAdded('limit'));
            if (r) {
                console.log('%c' + 'CHECK FINISH OCCURS!', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            }
            return r;
        };
        let letsRockNRoll = async () => {
            dLog('green', 'B365', `letsRockNRoll at ${document.location.href}/${(window.self === window.top)}`);
            if (document.location.href.toLowerCase().indexOf('/members/services/host') > -1
                || document.location.href.toLowerCase().indexOf('members.bet365') > -1) {
                dLog('green', 'B365', `-= WORK NEW =-`);
                const tech = {
                    'BET_RESULT': step => ({
                        click: ['Unsettled Bets', 'Settled Bets'][step],
                        operation: collectBets
                    }),
                    'CHECK_PAYMENTS': step => ({
                        click: ['Deposits', 'Withdrawals'][step],
                        operation: performCollect
                    })
                }[ourCommand.get().action](ourCommand.getAdded('oneCollected') ? 1 : 0);
                await waitForCondition(() => $getIFrame('#MembersHostFrame')
                            .find('div.HeaderBack').length > 0
                        || $getIFrame('#MembersHostFrame')
                            .find(`a:textEquals("${tech.click}")`).length > 0,
                    333, 30000, 'No members conditions!')
                    .catch(e => dLog('red', 'B365', 'No members conditions!'));
                while ($getIFrame('#MembersHostFrame').find('div.HeaderBack').length > 0) {
                    bsDebug(port, `-= GO BACK =-`);
                    await delayPromise(2000);
                    await dClick($getIFrame('#MembersHostFrame').find('div.HeaderBack')[0]);
                    await delayPromise(3000);
                }
                await waitDelayClickF(() => $getIFrame('#MembersHostFrame')
                        .find(`a:textEquals("${tech.click}")`),
                    null, null, null, false, true)()
                    .catch(e => dLog('red', 'B365', 'Damn 1'));
                await waitForElementO(
                    {
                        s: () => $getIFrame('#MembersHostFrame')
                            .find('div[id*="mnuHistorySearchOptions"]'), i: 333,
                        m: 30000, e: 'mnuHistorySearchOptions'
                    })
                    .catch(e => dLog('red', 'B365', 'Damn 2'));
                await delayPromise(1200);
                await selectPeriod();
                await tech.operation(tech);
            } else if (document.location.href.indexOf('/members.') > -1
                && (document.location.href.indexOf('/Members/Services/History/Funding/Search/') > -1
                    || document.location.href.indexOf('/home/mainpage.asp') > -1)) {
                bsDebug(port, `-= DO NOTHING at ${document.location.href} =-`);
            } else if (!ourCommand.getAdded('historyOpened')) {
                bsDebug(port, `-= GO from ${document.location.href} =-`);
                ourCommand.add('oneCollected', false);
                ourCommand.add('twoCollected', false);
                ourCommand.add('collected', []);
                if (ourCommand.get().action === 'BET_RESULT') {
                    let limit = 30;
                    let data = ourCommand.get().data;
                    if (data.length === 2 && data[0] === 'limit') {
                        limit = parseInt(data[1]);
                        data = [];
                    }
                    ourCommand.add('reviewed', 0);
                    ourCommand.add('limit_data', data);
                    ourCommand.add('limit', limit > 30 ? 30 : limit);
                }
                const $el = await waitForElement('div.hm-MainHeaderMembersWide_MembersMenuIcon',
                    333, 15000, false, 1,
                    `MEMBERS at ${document.location.href}`)
                await dClick($el[0]);
                await waitForElementO({
                    s: 'div.ul-MembersLinkButton_Text:textEquals("History")',
                    i: 333, m: 7000, e: 'MembersLinkButton_Text'
                });
                ourCommand.add('historyOpened', true);
                await bMess('BET_365').set(ourCommand.get(), 0);
                await delayPromise(3333);
                await dClick($('div.ul-MembersLinkButton_Text:textEquals("History")')[0]);
                const res = await bMess('collectingFinished').get(200000);
                port = chrome.runtime.connect({name: `port_${bkHere}`});
                ourCommand.clear();
                await dClick($('div[class$="Bet365LogoImage "]')[0]);
            }
        };
        letsRockNRoll()
            .catch((e) => report(false, 'RnR: ' + e));
    });

    const maximum = (data) => new Promise((onSuccess, onReject) => {
        bsDebug(port, 'MAXIMUM for: ' + data[0].market + '/' + data[0].target + '/' + data[0].pivot);
        let max;
        const report = function (succeeded, e) {
            port.postMessage({
                answered: "MAXIMUM",
                status: succeeded ? 'success' : 'error',
                answer: !succeeded ? e
                    : (data[0].fork ? {
                        max: parseFloat(max.max),
                        coef: parseFloat(max.coef),
                        balance: parseFloat($('.hm-Balance').text().extractNumber()),
                        currency: 'EUR'
                    } : max.max)
            });
            succeeded ? onSuccess() : onReject(e);
        };
        closePreviousCoupons(ourCommand.getAdded('express') !== false)
            .then(() => openCoupon(data))
            .then((m) => max = m)
            .then(() => checkCoefs(data))
            .then(() => report(true))
            .catch((e) => report(false, e));
    });

    const proceedBet = data => new Promise((onSuccess, onReject) => {
        currentBetData = {
            data: data,
            max: 0
        };
        let acceptClicks = 0;
        const betFinished = async function (success, message) {
            bsDebug(port, 'Bet finished ' + success, message, (new Error()).stack);
            let status = 'ACCEPTED';
            if (success) {
                eventsWork('b365', settings,
                    `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`,
                    true, false).then(() => bMess('WasSuccessStake').set(Date.now()));
                    if (settings.newExpresses) {
                        // Hint: currentFirstBet MUST exists, otherwise some shit happened!
                        await bMess('WasSuccessExpressNew').set(false);
                        const
                            currentFirstBet = await bMess('currentFirstBet')
                                .check(1080000, true),
                            used = await bMess('usedEvents').check(1080000).catch(() => ({}));
                        if (!used[currentFirstBet]) {
                            used[currentFirstBet] = 1;
                        } else {
                            used[currentFirstBet]++;
                        }
                        await bMess('usedEvents').set(used);
                        dLog('B365', 'blue-big',
                            [`We set bet with first: '${currentFirstBet}', now used:`, used]);
                    }
            } else {
                if (settings.newExpresses) {
                    if ($(findSel(couponRowSel)).length > 0) {
                        const couponCoef = parseFloat($(findSel(couponRowSel)).eq(0).find('div.bss-NormalBetItem_OddsContainer').trt());
                        let checkCoef = false;

                        checkCoef = isNaN(couponCoef) ? false : couponCoef >= 1.1 && couponCoef <= 1.6;

                        if (!checkCoef) {
                            dLog('red', 'B365', 'Had error in bet newExpress, checkCoef - false');
                            bMess('WasSuccessExpressNew').set(false).finally();
                            //clear all
                            await closePreviousCoupons(true);
                        } else {
                            dLog('red', 'B365', 'Had error in bet newExpress, checkCoef - true');
                            await closePreviousCoupons(false);
                        }
                    } else {
                        dLog('red', 'B365', 'Had error in bet newExpress, no coupons');
                        bMess('WasSuccessExpressNew').set(false).finally();
                    }
                }
            }
            const resultData = {
                "external_id": success ? message.external_id : '',
                "status": status,
                "market": currentBetData.data[0].market,
                "target": currentBetData.data[0].target,
                "pivot": currentBetData.data[0].pivot,
                "coef": success ? message.odd.toString() : currentBetData.data[0].coef,
                "stake": success ? message.stake : currentBetData.data[0].stake,
                "maximum": currentBetData.max
            };
            if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                resultData.type = 'VALUE';
                resultData.mode = currentBetData.data[0].type;
                resultData.bookmaker = 'BET365';
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
            port.postMessage({
                answered: !!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED'
                    ? "F_BET" : "BET",
                data: resultData,
                answer: success ? `Everything is Okay!` : message,
                doNotSend: !!currentBetData.data[0].betFromParser && !success
                    && resultData.status !== 'LIMITED',
            });
            dLog('green', '365', [`Result data (${success}): `, resultData]);
            if (success) onSuccess(); else onReject(message);
        };
        let acceptSels = ['div.bsm-BetslipStandardModule div.bs-AcceptButton:first:visible'];
        const placeBetSel = 'div.bsm-BetslipStandardModule div.bss-PlaceBetButton:visible',
            wrapper = ['div.qbs-NormalBetItem_Wrapper', 'div.lqb-NormalBetItem_Wrapper',
                'div.bss-NormalBetItem_Wrapper'],
            staked = ['div.qbs-StakeBox_StakeValue-input', 'div.lqb-StakeBox_StakeValue-input'],
            inputOne = ['div.bsm-BetslipStandardModule div.qbs-NormalBetItem_DetailsContainer',
                'div.lqb-NormalBetItem_DetailsContainer'],
            accepts = ['div.qbs-AcceptButton_Text', 'div.lqb-AcceptButton'],
            maxSels = [
                'div.lqb-QuickBetHeader_MessageBody:contains("Your stake exceeds the maximum allowed")',
                'div.qbs-QuickBetHeader_MessageBody:contains("Your stake exceeds the maximum allowed")',
                'div.bs-BetslipReferralsMessage_Title:contains("Your stake exceeds the maximum allowed")'
            ];
        const enterBet = async (stake) => {
            /**
             * @type {JQuery<HTMLElement> | jQuery | HTMLElement}
             */
            if (isNaN(stake) || stake <= 0) {
                throw `Very strange stake: ${stake}`;
            }
            let coords = $('div[class*="-StakeBox_StakeValue"][class*="wrapper"]')[0]
                .getBoundingClientRect();
            await dClick(new CoordsObject({x: coords.left + 10, y: coords.top + 10}));
            //await dClick($('div[class*="-StakeBox_StakeValue"][class*="wrapper"]').parent()[0]);
            await delayPromise(50);
            await bsType('bet365', stake.toString());
            await delayPromise(100);
        };
        let errors = 0;
        const clickAccept = async () => {
            await dClick($(findSel(acceptSels))[0]);
            dLog('orange', 'b365', 'Accept was clicked!');
            await delayPromise(1500);
            await checkMax();
        };
        const checkMax = async () => {
            if ($(findSel(maxSels)).length > 0) {
                const acceptMaxSels = [
                    'div.qbs-AcceptOnlyButton_UpdateStake:visible',
                    'div.lqb-AcceptOnlyButton_UpdateStake:visible',
                    'div.bsf-AcceptButton:visible',
                ];
                await dClick($(findSel(acceptMaxSels))[0]);
                dLog('orange', 'b365', 'AcceptMax was clicked!');
                await delayPromise(1500);
                await clickAccept();
                await delayPromise(1500);
            }
        };
        const checkAccepted = async () => {
            const $qrCode = () => $('canvas.atm-QrCodeScreen_Qrcode:visible');
            if ($qrCode().length > 0) {
                await waitForCondition(() => $qrCode().length === 0, 100, 300000,
                    'qrCode still visible');
                await delayPromise(200);
            }
            const localAcceptSels = [
                'div.qbs-BetPlacement div.qbs-PlaceBetButton_Wrapper:visible',
                'div.bsf-PlaceBetButton:visible',
                'div.qbs-AcceptButton:visible',
                'div.bsf-AcceptButton:visible',
                'div.lqb-BetPlacement div.lqb-AcceptButton:visible',
                'div.lqb-BetPlacement div.lqb-PlaceBetButton:visible',
            ];
            const $m = $('div.bs-OpportunityChangeErrorMessage_Contents');
            if ($m.trt().indexOf('changed') > -1 && findSel(localAcceptSels)) {
                if (acceptClicks <= 0) {
                    await dClick($(findSel(localAcceptSels))[0]);
                    acceptClicks++;
                    await delayPromise(1200);
                    return true;
                } else {
                    throw `We clicked accept ${acceptClicks} times already!`;
                }
            } else {
                return false;
            }
        };
        const checkConfirmAndWait = async (stake) => {
            let placed = false;
            let tries = 0;
            while (!placed && tries < 1) {
                tries++;
                // Check and enter
                await checkCoefs(data);
                await enterBet(stake);

                if (await checkAccepted()) {
                    await checkConfirmAndWait(stake);
                    break;
                }

                // Accept or bet
                if ($(findSel(wrapper)).length > 0) {
                    await checkMax();
                    if ($(findSel(accepts)).trt().indexOf("Accept Change") > -1) {
                        await checkCoefs(data);
                    }
                    if (await checkAccepted()) {
                        await checkConfirmAndWait(stake);
                        break;
                    } else {
                        // dLog('bigred', '365', `No accept, point 2`);
                    }
                    acceptSels = [
                        'div.qbs-BetPlacement div.qbs-PlaceBetButton_Wrapper:visible',
                        'div.bsf-PlaceBetButton:visible',
                        'div.qbs-AcceptButton:visible',
                        'div.bsf-AcceptButton:visible',
                        'div.lqb-BetPlacement div.lqb-AcceptButton:visible',
                        'div.lqb-BetPlacement div.lqb-PlaceBetButton:visible',
                    ];
                    await checkMax();
                    if ($(findSel(acceptSels)).length === 1) {
                        await clickAccept();
                        await delayPromise(150);
                        const limiteds = [
                            'div.qbs-QuickBetHeader_MessageBody:contains("Certain restrictions may be applied to your account.")',
                            'div.lqb-QuickBetHeader_MessageBody:contains("Certain restrictions may be applied to your account.")',
                            'div.bs-DefaultMessage_MessageText:contains("Certain restrictions may be applied to your account.")',
                        ];
                        if ($(findSel(limiteds)).length > 0) {
                            throw 'Bets LIMITED';
                        }
                        if ($('div.qbs-QuickBetHeader_MessageBody:contains("Your stake exceeds the maximum allowed")').length > 0) {
                            const acceptMaxSel = 'div.qbs-AcceptOnlyButton_UpdateStake:visible';
                            await dClick($(acceptMaxSel)[0]);
                            dLog('orange', 'b365', 'AcceptMax was clicked!');
                            await delayPromise(150);
                            await clickAccept();
                            await delayPromise(150);
                        }
                    }

                    const betPlaced = [
                            'div.bss-ReceiptContent_Title:textEquals("Bet Placed")',
                            'div.qbs-QuickBetHeader_MessageBody:textEquals("Bet Placed")',
                            'div.lqb-QuickBetHeader_MessageBody:textEquals("Bet Placed")',
                        ],
                        betRef = [
                            'div.qbs-QuickBetHeader_BetReference',
                            'div.lqb-QuickBetHeader_BetReference',
                            'div.bss-ReceiptContent_BetRef',
                        ],
                        betVal = [
                            'div.qbs-StakeBox_StakeValue:visible',
                            'div.lqb-StakeBox_StakeValue:visible',
                            'div.bsf-StakeBox_StakeValue:visible',
                            'div.bsf-PlaceBetButton_TotalStakeAmount',
                        ],
                        betOdds = ['span.bs-OddsLabel', 'span.lbl-OddsLabel'],
                        doneSel = [
                            'div.qbs-QuickBetHeader_DoneButton',
                            'div.lqb-QuickBetHeader_DoneButton',
                            'div.bss-ReceiptContent_Done',
                        ];
                    let started = Date.now();
                    while (!findSel(betPlaced) && Date.now() - started <= 20000) {
                        if (await checkAccepted()) {
                            await checkConfirmAndWait(stake);
                            break;
                        } else {
                            //dLog('bigred', '365', `No accept, point 3`);
                        }
                        await delayPromise(30);
                    }
                    betFinished(true, {
                        external_id: $(findSel(betRef)).text()
                            .replace('Bet Ref ', '').trim(),
                        stake: $(findSel(betVal)).text()
                            .replace('RS.', '')
                            .replace(/[^\d.]/g, '')
                            .trim(),
                        odd: decOdds($(findSel(betOdds)).trt()),
                    });
                    await delayPromise(100);
                    if ($(findSel(doneSel)).length > 0) {
                        await dClick($(findSel(doneSel))[0]);
                    }
                    placed = true;
                    await delayPromise(150);
                    await dClick($('div.hm-HeaderMenuItem:textEquals("In-Play")')[0]);
                } else {
                    await checkMax();
                    if ($(findSel(acceptSels)).length === 1) {
                        await clickAccept();
                        continue;
                    } else if ($(placeBetSel).length === 1) {
                        await dClick($(placeBetSel)[0]);
                        dLog('orange', 'b365', 'PlaceBtn was clicked!');
                        await delayPromise(40);
                        if ($(placeBetSel).length > 0 && elementIsVisible($(placeBetSel)[0])) {
                            await dClick($(placeBetSel).parent()[0]);
                            dLog('orange', 'b365', 'PlaceBtn PARENT was clicked!');
                            await delayPromise(30);
                        }
                    } else {
                        throw 'No Accept and PlaceBet buttons :(';
                    }
                    const ss = acceptSels.concat(['div.bs-ReceiptContent_Title:textEquals("Bet Placed")',
                        'div.bs-ReceiptContent_BetRef', 'div.bss-PlaceBetButton_StakeAmount', 'span.bs-OddsLabel']);
                    await waitForCondition(() => ss.some(sel => $(sel).length > 0), 333, 30000,
                        'Wait unsuccessful :(');
                    if ($(findSel(acceptSels)).length === 1) {
                        await clickAccept();
                        continue;
                    }
                    await waitForCondition(() => ss.slice(1).every(sel => $(sel).length > 0), 333, 10000,
                        'Wait TWO unsuccessful :(');
                    betFinished(true, {
                        external_id: $(ss[2]).text().replace('Bet Ref ', '').trim(),
                        stake: $(ss[3]).text().replace(/[^\d.]/g, '').trim(),
                        odd: multiplySelectorValues($(ss[4]))
                    });
                    const doneSel = 'div.bs-ReceiptContent_Done';
                    if ($(doneSel).length > 0) {
                        await dClick($(doneSel)[0]);
                    }
                    placed = true;
                }
            }
            if (!placed) {
                throw `Bet not placed for ${tries} times :(`;
            }
        };
        let willPlace;
        (async () => {
            if (!!currentBetData.data[0].betFromParser) {
                const eventName = `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`;
                if (!await eventsWork('b365', settings, eventName, false, false)) {
                    throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
                } else {
                    const
                        realSuccessInterval = data[0].successBetInterval || settings.betweenBets,
                        wasSuccessStake = await bMess('WasSuccessStake')
                            .check(realSuccessInterval)
                            .catch(() => 0),
                        successDiff = Date.now() - wasSuccessStake;
                    dLog('big-blue', 'STAKE',
                        `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                        + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
                }
            }
        })()
            .then(() => closePreviousCoupons(ourCommand.getAdded('express') !== false))
            .then(() => openCoupon(data))
            .then(m => {
                currentBetData.max = m.max;
                willPlace = Math.min(parseFloat(data[0].stake), parseFloat(currentBetData.max));
                if (getBalance() < willPlace) {
                    throw `NO_FUNDS, we have ${getBalance()}, we need ${willPlace}`;
                }
                bsDebug(port, `Pretend to bet ${willPlace}, max is ${currentBetData.max}`);
            })
            .then(() => checkConfirmAndWait(willPlace))
            .catch(e => betFinished(false, `Start: ${e},${formatStack(e.stack)}`));
    });

    const ProccedExpressNew = async () => {
        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));
        let $event = $([]);
        let $eventIn = $([]);
        let eventName = '';
        const events = 'div.gl-Participant_General';
        const $liveLink = () => $('div.hm-HeaderMenuItem:textEquals("In-Play")');
        const $soccerLink = () => $('div.ovm-ClassificationBarButton_Text:textEquals("Soccer")');
        const $hdpLink = () => $('div.ovm-ClassificationMarketSwitcherMenu_Item:textEquals("Asian Handicap In-Play")');
        const $coefsList = () => $(events);
        await waitForElement(events, 333, 12888);

        const findFirstOption = async (coef) => {
            return isNaN(coef) ? false : coef >= 1.1 && coef <= 1.6;
        };

        const findSecondOption = (coef) => {
            return isNaN(coef) ? false : coef >= 1.1 && coef <= 1.5;
        };

        const findEventNew = async () => {
            for (let i=0; i<$coefsList().length; i++) {
                const isSuspended = $coefsList().eq(i).hasClass('ovm-ParticipantStackedCentered_Suspended');
                const isEventTime = parseFloat($coefsList().eq(i).closest('div.ovm-Fixture_Container').find('div.ovm-InPlayTimer').trt()) >= 70;
                const pivot = $coefsList().eq(i).find('span.ovm-ParticipantStackedCentered_Handicap').trt();
                const coef = parseFloat($coefsList().eq(i).find('span.ovm-ParticipantStackedCentered_Odds').trt());
                const pivotCheck = pivot === '0.0';
                const eventName = $coefsList().eq(i).closest('div.ovm-Fixture_Container').find('div.ovm-FixtureDetailsTwoWay_TeamName:eq(0)').trt() +
                    ' - ' + $coefsList().eq(i).closest('div.ovm-Fixture_Container').find('div.ovm-FixtureDetailsTwoWay_TeamName:eq(1)').trt();
                const isEsoccer = $coefsList().eq(i).closest('div.ovm-Competition').find('div.ovm-CompetitionHeader_NameText').trt().indexOf('Esoccer') > -1;

                if (used[eventName] >= 2 || isEsoccer) {
                    continue;
                }

                if (!isSuspended && pivotCheck && isEventTime) {
                    if (await findFirstOption(coef)) {
                        $event = $coefsList().eq(i);
                        break;
                    }
                }
            }
        };

        const findEventNewIn = async () => {
            const
                $events = () => $('div.ovm-FixtureDetailsTwoWay_Wrapper'),
                asianLines = 'div.ipe-GridHeaderTabLink > div:textEquals("Asian Lines")';

            for (let i=0; i<$events().length; i++) {
                const
                    isEsoccer = $events().eq(i)
                        .closest('div.ovm-Competition')
                        .find('div.ovm-CompetitionHeader_NameText')
                        .trt().indexOf('Esoccer') > -1,
                    isEventTime = parseFloat($events().eq(i)
                        .find('div.ovm-InPlayTimer').trt()) >= 70,
                    $asianHdp = () =>
                        $('div.gl-MarketGroupPod div.sip-MarketGroupButton_Text:textStarts("Asian Handicap")')
                            .closest('div.gl-MarketGroupPod')
                            .find('span.gl-ParticipantCentered_Handicap:textEquals("0.0")');

                if (!isEsoccer && isEventTime) {
                    $events().eq(i)[0].scrollIntoView();
                    $('div.ovm-OverviewScroller')[0].scrollBy(0, -50);
                    await delayPromise(333);
                    await dClick($events().eq(i)[0]);
                    const $asianLines = await waitForElement(asianLines,
                        333, 8888).catch(() => ({}));

                    if ($asianLines.length > 0) {
                        // select aian-lines if needed
                        if (!$asianLines.parent().hasClass('ipe-GridHeaderTabLink-selected')) {
                            await dClick($asianLines[0]);
                            await delayPromise(1555);
                        }

                        //find pivot
                        if ($asianHdp().length > 0) {
                            for (let j=0; j<$events().length; j++) {
                                const coef = parseFloat($asianHdp().eq(j).next().trt());

                                if (findSecondOption(coef)) {
                                    $eventIn = $asianHdp().eq(j);
                                    break;
                                }
                            }
                        }

                        if ($eventIn.length > 0) {
                            eventName = $('div.ipe-EventHeader_Fixture').trt();
                            break;
                        }
                    }

                    await dClick($('div.ipe-EventHeader_BreadcrumbBack')[0]);
                    await delayPromise(2888);
                }
            }
        };

        // click on live
        if (!$liveLink().hasClass('hm-HeaderMenuItem_LinkSelected')) {
            await dClick($liveLink()[0]);
            await delayPromise(1555);
        }

        // click on soccer link
        if (!$soccerLink().closest('div.ovm-ClassificationBarButton').hasClass('ovm-ClassificationBarButton-active')) {
            await dClick($soccerLink()[0]);
            await delayPromise(1555);
        }

        // click on handicap
        if (!$hdpLink().hasClass('ovm-ClassificationMarketSwitcherMenu_Item-active')) {
            await dClick($hdpLink()[0]);
            await delayPromise(1555);
        }

        await delayPromise(5000);
        await findEventNew();

        if ($event.length > 0) {
            dLog('red', 'b365', 'EVENT0');
            eventName = $event.closest('div.ovm-Fixture_Container').find('div.ovm-FixtureDetailsTwoWay_TeamName:eq(0)').trt() +
                ' v ' + $event.closest('div.ovm-Fixture_Container').find('div.ovm-FixtureDetailsTwoWay_TeamName:eq(1)').trt();
            await bMess('currentFirstBet').set(eventName);
            dLog('green', 'B365', `We get first bet: '${eventName}!'`);
            $event[0].scrollIntoView(true);
            await delayPromise(1555);
            await dClick($event[0]);
            await delayPromise(555);
            bMess('WasSuccessExpressNew').set(true).finally();
        } else {
            dLog('red', 'b365', 'EVENT1');
            await findEventNewIn();

            if ($eventIn.length > 0) {
                await bMess('currentFirstBet').set(eventName);
                dLog('green', 'B365', `We get first bet: '${eventName}!'`);
                await dClick($eventIn[0]);
                await delayPromise(555);
                bMess('WasSuccessExpressNew').set(true).finally();
            } else {
                bMess('WasSuccessExpressNew').set(false).finally();
                dLog('red', 'B365', 'New express event not found!');
            }
        }
    };

    let monitorMarkets = {};
    let monitorMarketsReceived = 0;
    const monitorMarketsReceiver = m => (monitorMarkets = JSON.parse(JSON.stringify(m)), monitorMarketsReceived = Date.now());

    const monitor = data => new Promise((onSuccess, onReject) => {
        const scanInterval = 4000;
        // @param status - FAILED, FINISHED, DATA
        const report = (status, message, profiling) => {
            port.postMessage({
                answered: "MONITOR",
                data: {
                    "status": status,
                    "profiling": profiling ? profiling : ''
                },
                answer: message
            });
            needStop = false;
            if (status === 'FAILED') {
                onReject(message);
            } else if (status === 'FINISHED') {
                onSuccess(message);
            }
        };
        let previousScan = Date.now();
        let counter = 0;
        const getOdds = async () => {
            monitorMarketsReceived = 0;
            window.postMessage.call(window, {
                direction: TO_PAGE,
                action: 'getOdds',
                eventName: $('div.ipe-GridHeader_FixtureCell').trt()
            }, "*");
            await waitForCondition(() => monitorMarketsReceived > 0, 333, 30000, 'Too long answer from page :(');
            return JSON.parse(JSON.stringify(monitorMarkets));
        };
        const scanMarkets = (data) => new Promise((onSuccess, onReject) => {
            const result = {};
            openEvent(data)
                .then(() => getOdds())
                .then(r => result['FULL_TIME'] = JSON.parse(JSON.stringify(r)))
                .then(() => console.log(result))
                .then(() => onSuccess(result))
                .catch(e => onReject(`scanMarkets error: ${e}`));
        });
        const scan = () => {
            const startedAfter = floorToPrecision((Date.now() - previousScan) / 1000, 3);
            const scanStarted = Date.now();
            //console.profile('Suspicious');
            delayPromise(111)
                .then(() => {
                    if (needStop) {
                        throw 'Stopped by NEED_STOP 1!';
                    }
                })
                .then(() => scanMarkets(data[0]))
                .then(scannedData => {
                    const scanPerformed = floorToPrecision((Date.now() - scanStarted) / 1000, 3);
                    report('DATA', scannedData, `after: ${startedAfter}, performed in ${scanPerformed}`);
                    previousScan = Date.now();
                    //console.profileEnd('Suspicious');
                    counter++;
                    if (needStop) {// || counter >= 1) {
                        throw needStop ? 'Stopped by NEED_STOP!' : `We reach ${counter}`;
                    }
                })
                .then(waitForNotConditionF(() => needStop, 333, scanInterval, 'NEED_STOP occurred!'))
                .then(scan)
                .catch(e => report('FINISHED', e));
        };
        loadScanner(monitorMarketsReceiver)
            .then(() => scan())
            .catch(e => report('FINISHED', `Load scanner: ${e}`));
    });

    /**
     * Get list of prematch events
     * if specified sport and league - get events for this sport and league
     * if specified sport and league === 'ALL' - get all events from all leagues of this sport
     * if specifies sport and not specified league - get all leagues for sport
     * if not specified sport or it is 'ALL' - get all leagues for all sports
     * @param {Array.<SportEventObject>} inputData
     * @returns {Promise<Object>}
     */
    const getEvents = async (inputData) => {
        /**
         * @type {SportEventObject} data
         */
        const data = inputData[0];
        let error = false;
        const res = await getEventsDo(data).catch(e => (bsError(port, `getEvents: ${e}`), error = true, e));
        port.postMessage({
            answered: 'GET_EVENTS',
            status: !error ? 'success' : 'error',
            answer: res
        });
        return res;
    };

    const methods = {
        'MAXIMUM': maximum,
        'DEPOSIT': deposit,
        'WITHDRAW': withdraw,
        'CHECK_PAYMENTS': checkPayments,
        'BET_RESULT': betResult,
        'BET': proceedBet,
        'EXPRESS_BET': proceedBet,
        'MONITOR': monitor,
        'GET_EVENTS': getEvents,
    };

    /**
     * Real get events / leagues
     * @param {SportEventObject} data
     * @returns {Promise<{leagues: Object, events: Object}>}
     */
    const getEventsDo = async (data) => {
        bsDebug(port, `GET_EVENTS:`, data);
        const {leaguesProcessed, leagues, events, errors} = getEventsLoadSaved();
        if (!data.sport || data.sport === 'ALL' || !data.league || data.league.length === 0
            || data.league === 'ALL') {
            await scrapLeagues(data, leagues);
            bsDebug(port, 'Got leagues:', leagues);
        } else {
            await goPrematchSport(sportAccordance[data.sport]);
            await delayPromise(1000);
        }
        const leaguesToGet = getLeaguesToGet(data, leagues);
        if (leaguesToGet.length > 0) {
            if (!events[data.sport]) {
                events[data.sport] = {};
            }
            for (const currentLeague of leaguesToGet) {
                if (await checkLeagueProcessed(leaguesProcessed, data.sport, currentLeague)) {
                    continue;
                }
                let leagueDone = true;
                await prematchGoToLeague({sport: data.sport, league: currentLeague}, true)
                    .catch(e => (errors.push(e), leagueDone = false));
                if (!leagueDone) {
                    events[data.sport][currentLeague] = [];
                } else {
                    events[data.sport][currentLeague] = JSON.parse(JSON.stringify(await prematchGetEvents(data.sport)));
                    bsDebug(port, `Events for ${data.sport}/${currentLeague}`, events[data.sport][currentLeague]);
                }
                leaguesProcessed.push(`${data.sport}:${currentLeague}`);
                getEventsSave(leaguesProcessed, leagues, events, errors);
                if (leaguesToGet.length > 1) {
                    await delayPromise(getRandomRounded(1000, 2000));
                }
            }
        }
        return {leagues, events, errors};
    };

    const checkLeagueProcessed = async (leaguesProcessed, sportOur, currentLeague) => {
        if (leaguesProcessed.indexOf(`${sportOur}:${currentLeague}`) > -1) {
            bsDebug(port, `${currentLeague} has been already processed`);
            await delayPromise(150);
            return true;
        } else {
            return false;
        }
    };

    const getLeaguesToGet = (data, leagues) =>
        data.sport && data.sport !== 'ALL' && data.league === 'ALL' && leagues[data.sport]
        && leagues[data.sport].length > 0
            ? leagues[data.sport]
            : data.sport && data.sport !== 'ALL' && data.league.length > 0 && data.league !== 'ALL'
                ? [data.league]
                : [];

    const scrapLeagues = async (data, leagues) => {
        const sportsToGet = !data.sport || data.sport === 'ALL' ? Object.keys(sportAccordance) : [data.sport];
        for (const sportOur of sportsToGet) {
            if (!leagues[sportOur]) {
                leagues[sportOur] = [];
            }
            await goPrematchSport(sportAccordance[sportOur]);
            await delayPromise(1000);
            const gotLeagues = await prematchGetLeagues(sportOur);
            bsDebug(port, `Leagues for ${sportOur}/${sportAccordance[sportOur]}`, gotLeagues);
            gotLeagues.forEach(l => l.trim().length > 0 ? leagues[sportOur].push(l) : null);
        }
    };

    const getEventsSave = (leaguesProcessed, leagues, events, errors) => {
        ourCommand.add('leaguesProcessed', leaguesProcessed);
        ourCommand.add('ge_leagues', leagues);
        ourCommand.add('ge_events', events);
        ourCommand.add('ge_errors', errors);
    };

    const getEventsLoadSaved = () => {
        return {
            leaguesProcessed: ourCommand.getAdded('leaguesProcessed', []),
            leagues: ourCommand.getAdded('ge_leagues', {}),
            events: ourCommand.getAdded('ge_events', {}),
            errors: ourCommand.getAdded('ge_errors', [])
        };
    };

    /**
     * @param qrParams {Object}
     * {
     *   "d": "AkIAAwAzA...",
     *   "la": 40.4249809,
     *   "lo": -3.4333565,
     *   "t": 1674847793,
     *   "c": "Spain",
     *   "p": "(http|socks5)://[user:pass@]host:port"
     * }
     */
    const loadQrCode = () => {
        if (window.Uu52mQZS8zqFi6eE6K9jv2cRowYhm8) {
            dLog('red', '365', `QrCode already loaded!`);
            return;
        }
        const work = () => {
            window.Uu52mQZS8zqFi6eE6K9jv2cRowYhm8 = true;
            const e = document.createElement('script');
            e.innerHTML = `(() => {
                if (window.Uu52mQZS8zqFi6eE6K9jv2cRowYhm8) {
                    console.log('QrCode already loaded!');
                    return;
                }
                window.Uu52mQZS8zqFi6eE6K9jv2cRowYhm8 = true;
                ${QrCode.toString()}
                QrCode.monitorQrCode();
                console.log('%c' + ' QrCode.monitorQrCode() started!',
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            })();`;
            (document.head || document.documentElement).appendChild(e);
            e.onload = function () {
                e.parentNode.removeChild(e);
            };
            let lastSent = 0;
            const pageMessageListener = event => {
                dLog('blue', 'b365', [`We got message:`, event]);
                if (!event.data || !event.data.direction || event.data.direction !== QrCode.FROM_PAGE) {
                    dLog('red', 'b365', [`Strange message!`, event.data]);
                } else {
                    if (Date.now() - lastSent < 60000) {
                        dLog('', 'b365', `Too fast - ${Date.now() - lastSent} < 60000!`);
                        return;
                    }
                    dLog('green', 'b365', [`Good message:`, event.data]);
                    /**
                     event.data = {
                    action: "qrCode", direction: "kXXr3fssW9jKftY6A3W5KEAGhaWw87",
                    token: "bla-bla-bla"
                    };
                     */
                    QrCode.sendQrCodeToBackground(event.data.token)
                        .then(m => dLog('green', 'b365', [`QrCode sent to background:`, m]))
                        .catch(e => dLog('red', 'b365', [`QrCode sent to background error:`, e]));
                    lastSent = Date.now();
                    //window.removeEventListener("message", pageMessageListener, false);
                }
            };
            window.addEventListener("message", pageMessageListener, false);
            dLog('green', 'b365', `QrCode loaded`)
        };
        waitForCondition(() => weAreLogged, 1000, 600000)
            .then(() => work())
            .catch(e => dLog('red', 'b365', [`QrCode load error:`, e]));
    };

    const loadScanner = marketsReceiver => new Promise((onSuccess, onReject) => {
        if (!window.DJ4Qc9HiHbVesHQu7S4RR4ho) {
            window.DJ4Qc9HiHbVesHQu7S4RR4ho = true;
            try {
                const e = document.createElement('script');
                // Hint: see 1test/bet365scanner.js
                e.innerHTML = '1test/bet365scanner.js';
                (document.head || document.documentElement).appendChild(e);
                e.onload = function () {
                    e.parentNode.removeChild(e);
                };
                const pageMessageListener = event => {
                    if (!event.data || !event.data.direction || event.data.direction !== FROM_PAGE) {
                        //console.log('%c' + 'Strange message! CONTENT %O', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;', event.data);
                        return;
                    }
                    console.log('%c' + `pageMessageListener - CONTENT: %O`,
                        'background: yellow; color: black; font-size: 12px; font-weight: normal; padding: 1px;', event.data);
                    marketsReceiver(event.data.markets);
                };
                window.addEventListener("message", pageMessageListener, false);
                console.log('%c' + 'Script loaded CONTENT', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                onSuccess('Script loaded!');
            } catch (e) {
                onReject('Script load error: ' + e);
            }
        } else {
            onSuccess('Already loaded!');
        }
    });

    /**
     * Opens coupon with stake (stakes)
     * @param {object[]} paramData - array of bets to open
     * @returns {Promise<float|string>}
     */
    const openCoupon = paramData => new Promise(function (onSuccess, onReject) {
        bsDebug(port, 'openCoupon, paramData:', paramData);
        const retrieveBetMax = async () => {
            if ($('div.qbs-NormalBetItem_Wrapper').length > 0 || $('div.lbs-StandardBetslip').length === 0) {
                const coefString = findSel(['div.qbs-NormalBetItem_Wrapper span.bs-OddsLabel', 'div.lqb-NormalBetItem_Wrapper span.lbl-OddsLabel']);
                const coef = $(coefString).trt();
                return {max: 111555777, coef: coef};
            } else {
                const coefString = findSel(['div.bsm-BetslipStandardModule div.bss-MultipleHeader', 'div.lbs-StandardBetslip div.lbs-MultipleHeader']);
                const $multiple = $(coefString);
                const $container = $multiple.length === 0 ? $(findSel(['div.bsm-BetslipStandardModule', 'div.lbs-StandardBetslip'])) : $multiple;
                const coef = $multiple.length === 0
                    ? $container.find(findSel(['div.bss-NormalBetItem_OddsContainer', 'div.lbl-OddsLabel'])).trt()
                    : $container.find(findSel(['div.bs-OddsLabel', 'div.lbl-OddsLabel'])).trt();
                return {max: 111555777, coef: coef};
            }
        };
        const result = function (success, message) {
            if (success) {
                if (lData.length > 0) {
                    ourCommand.add('express', ourCommand.getAdded('express') + 1);
                    data = paramData[ourCommand.getAdded('express')];
                    if (typeof data !== 'undefined') {
                        bsDebug(port, 'openCoupon - We got data: ' + (typeof data), data);
                        openElement()
                            .then(() => result(true, 'Max collect later...'))
                            .catch((e) => result(false, 'Error till: ' + e));
                    } else {
                        // Hint: For doubles we haven't max :(
                        retrieveBetMax()
                            .then(max => onSuccess(max))
                            .catch(e => onReject(e));
                    }
                } else {
                    // Hint: maybe I'll find maxes later...
                    retrieveBetMax()
                        .then(max => onSuccess(max))
                        .catch(e => onReject(e));
                }
            } else {
                bsError(port, message);
                onReject(message);
            }
        };
        const checkCoupon = async () => {
            if ($('div.qbs-NormalBetItem_Wrapper').length > 0
                || $('div.lbs-StandardBetslip_ContentWrapper').length === 0) {
                return true;
            } else {
                let event = (data.team1 + ' v ' + data.team2).toLowerCase();
                let $result = null;
                let matches = [];
                await openBetslip(true);
                await delayPromise(40);
                return true;
            }
        };
        let lData = paramData.slice();
        let data = {};
        let $betElement;
        const performClick = async elem => {
            console.log('elem ', elem);
            $(elem)[0].scrollIntoView(false);
            await delayPromise(1111);
            await dClick(elem);
            const $coupon = await waitForElementO({
                s: () => $(findSel(couponRowSel)), i: 30,
                m: 3000, e: 'openElement couponRowSel'
            }).catch(() => $([]));
            if ($coupon.length === 0) {
                await dClick(elem);
            }
            await waitForElementO({
                s: () => $(findSel(couponRowSel)), i: 30,
                m: 3000, e: 'openElement couponRowSel'
            });
        };
        const openElement = async () => {
            await openEvent(data);
            dLog('green', 'b365', 'Event must be opened!');
            $betElement = await getBetElement(data);
            const currentCoef = parseFloat($betElement.find('span[class$="_Odds"]').trt());
            dLog('green', 'b365', 'We got element! Coef: ' + currentCoef);
            await checkCoef(data, currentCoef);
            const elem = $betElement.get(0);
            await performClick(elem);
            await waitForCondition(() => elementIsVisible($('div.bsf-StakeBox_StakeAmount')[0]),
                300, 5555)
                .catch(async () => {
                    await performClick(elem);
                });
            await checkCoupon();
        };
        if (ourCommand.getAdded('express') !== false) {
            data = paramData[ourCommand.getAdded('express')];
        } else {
            data = lData.shift();
        }
        if (typeof data !== 'undefined') {
            bsDebug(port, 'openCoupon - basic - We got data: ' + (typeof data), data);
            openElement()
                .then(() => result(true, 'Max collect later...'))
                .catch((e) => result(false, 'Error till: ' + e));
        } else {
            onReject('There is no input data!');
        }
    });

    const getScore = data => {
        const types = {
            'FOOTBALL': 'div.ipn-Fixture-selected div.ipn-ScoresDefault_Score div.ipn-ScoresDefault_Score',
            'TENNIS': 'div.ipe-TennisHeaderLayout div.ipe-TennisHeaderLayout_ColumnSets div.ipe-TennisGridColumn_Cell:gt(0)',
            'BASEBALL': 'div.ipe-ScoreGridContainer div.ipe-ScoreGridCell_TextTotal',
            'HOCKEY': 'div.ipe-ScoreGridContainer div.ipe-ScoreGridCell_TextTotal',
            'BASKETBALL': 'div.ipe-ScoreGridContainer div.ipe-ScoreGridCell_TextTotal',
            'VOLLEYBALL': 'div.ipn-CompetitionContainer:has(div.ipn-Fixture-selected) div.ipn-ScoreDisplayPoints_TotalsPoint',
            'HANDBALL': 'div.ipe-ScoreGridContainer div.ipe-ScoreGridCell_TextTotal',
        };
        const $scores = $(types[data.sport]);
        if ($scores.length !== 2) {
            let found = '';
            $('div.sip-MarketGroupButton_Text').each(function() {
                const here = $(this).text();
                console.log('score header ', here);
                if ([
                    '1st Half Goal Line',
                    'Goal Line',
                    'Asian Handicap',
                    '1st Half Asian Handicap',
                ].find(s => here.indexOf(s) > -1)) {
                    const res = /\((.*)\)/.exec(here);
                    if (res && res[1]) {
                        found = res[1];
                        return false;
                    }
                }
            });
            return found ? found : '';
        } else {
            return $scores.eq(0).text().trim() + ':' + $scores.eq(1).text().trim();
        }
    };

    /**
     * Open event table, if we're on it already -  onSuccess
     * @param {object} data
     * @returns {Promise<any>}
     */
    const openEvent = async (data) => {
        if (data.type && data.type === 'PREMATCH') {
            await openEventPrematch(data);
            return;
        }
        const team1 = data.team1.toLowerCase();
        const team2 = data.team2.toLowerCase();
        const eventName = team1 + ' v ' + team2;
        const sport = typeof sportAccordance[data.sport] === 'undefined'
            ? '' : sportAccordance[data.sport];
        if (sport === '') {
            throw `Sport ${data.sport} not supported or presented :(`;
        }
        dLog('green', '365', `We'll open event ${eventName} of ${sport}`);
        if (data.direct_link) {
            console.log('data.direct_link');
            document.location.href = data.direct_link.replace('.com', bkDomain);
            await delayPromise(3000);
            return true;
        }
        const checkWeAreThere = function () {
            if (data.direct_link) {
                return document.location.href === data.direct_link.replace('.com', bkDomain);
            } else if(data.type === 'LIVE') {
                const name = $('div.ipe-EventHeader_Fixture').trt().toLowerCase();
                const res = name === eventName || locutus_similar_text(name, eventName, true) > 75;
                dLog('', '365', `checkWeAreThere - ${res} ('${name}' === '${eventName}')`);
                return res;
            } else {
                const $teams = $('div.sph-FixturePodHeader_TeamName');
                const localEvent = `${$teams.eq(0).trt()} v ${$teams.eq(1).trt()}`.toLowerCase();
                const res = localEvent === eventName || locutus_similar_text(localEvent, eventName, true) > 75;
                dLog('', '365', `checkWeAreTherePrematch - ${res} ('${localEvent}' === '${eventName}')`);
            }
        };
        if (checkWeAreThere()) {
            return;
        }
        if (['LIVE', 'PREMATCH'].indexOf(data.type) > -1) {
            await searchForEvent(data);
            await waitForCondition(checkWeAreThere, 50, 30000,
                'It looks like we are not there (searchForEvent)!');
            return true;
        }
        const findEvent = async () => {
            let $el = $([]), tries = 0;
            const evSel = 'div.ovm-FixtureDetailsEsports, '
                + `div.ovm-Fixture_Container div.ovm-FixtureDetailsWithIndicators, `
                + 'div.ovm-Fixture_Container div.ovm-FixtureDetailsTwoWay, '
                + 'div.ovm-Fixture_Container div.ovm-FixtureDetailsTwoWayBasketball';
            await waitForElement(evSel, 30, 10000, false,
                1, 'NO EVENTS!');
            do {
                await delayPromise(150);
                tries++;
                if (tries > 10) {
                    $(evSel).last().get(0).scrollIntoView();
                }
                $(evSel)
                    .each(function () {
                        const $teams = $(this).find(
                            'div.ovm-FixtureDetailsEsports_TeamName, '
                            + 'div.ovm-FixtureDetailsWithIndicators_Team, '
                            + 'div.ovm-FixtureDetailsTwoWay_TeamName, '
                            + 'div.ovm-FixtureDetailsTwoWayBasketball_TeamName');
                        const eventHere = $teams.eq(0).trt() + ' v ' + $teams.eq(1).trt().toLowerCase();
                        if (eventHere === eventName
                            || locutus_similar_text(eventHere, eventName, true) > 70) {
                            $el = $(this);
                            return false;
                        } else {
                            console.log(`findEvent (yUi): '${eventHere}' !== '${eventName}'`);
                        }
                    });
            } while ($el.length === 0 && tries <= 40);
            if ($el.length === 0) {
                throw 'Event not found in the findEvent :(';
            } else {
                await dClick($el[0], true, 'Open event', false, true);
            }
        };
        const goRightPageInclSport = async () => {
            dLog('green', 'b365', `goRightPageInclSport ${(data.direct_link || 'no direct link')}, bkHere: ${bkHere}, sport: ${sport}`);
            if (data.direct_link) {
                document.location.href = data.direct_link.replace('.com', bkDomain);
                await delayPromise(3000);
                return true;
            } else {
                await clickSequence([
                    new QueueObject(
                        'div[class*="MainHeaderTabRow_InPlayLabel"]',
                        $el => true),
                    //new QueueObject(
                    //    'div.ip-ControlBar_BBarItem:textEquals("Overview")',
                    //    $el => $el.attr('class').indexOf('Selected') === -1,
                    //),
                    new QueueObject(
                        'div.ovm-ClassificationBar_Contents div.ovm-ClassificationBarButton_Text:'
                        + `textEquals("${sport}")`,
                        $el => true, null, null, null, null, true
                    ),
                    bkHere === 'bet365au' ?
                        new QueueObject(
                            'div.ovm-ClassificationBar div.ovm-ClassificationBarButton:'
                            + `textEquals("${sport}${sport}")`,
                            $el => $el.attr('class').indexOf('-active') === -1, null, false, 0, true
                        )
                        :
                        new QueueObject(
                        'div.ovm-ClassificationBar div.ovm-ClassificationBarButton:'
                        + `textEquals("${sport}")`,
                        $el => $el.attr('class').indexOf('-active') === -1, null, false, 0, true
                    ),
                ], 300, 300, false, true);
                dLog('green', 'b365', `We should be in the ${sport}!`);
                return false;
            }
        };
        const findEventAtLeft = async () => {
            dLog('green', 'b365', `findEventAtLeft ${(data.direct_link || 'no direct link')}`);
            const $lhs = $('div[class$="EventViewView_LHS "]');
            if (data.direct_link || $lhs.length === 0 || !data.league) {
                // no left panel or direct link
                return false;
            }
            await waitForElement(`div[class$="CompetitionButton_Text "]`, 30, 3000);
            let $l = $([]), tries = 0;
            do {
                tries++;
                await delayPromise(100);
                $l = $(`div[class$="CompetitionButton_Text "]`)
                    .filter(function () {
                        const here = $(this).trt().replace('\n', ' ')
                            .replace(/\s+/g, ' ')
                            .trim()
                            .toLowerCase();
                        const lg = data.league.trim().replace(/\s+/g, ' ').toLowerCase();
                        return here === lg || here.indexOf(lg) > -1;
                    });
            } while ($l.length === 0 && tries <= 3);
            if ($l.length > 0) {
                $l.get(0).scrollIntoView();
                await delayPromise(100);
                if ($l.closest('div[class^="ipn-Competition "]')
                    .attr('class').indexOf('-closed') > -1) {
                    await dClick($l[0], true, 'Open league', false, false);
                    await delayPromise(100);
                }
                await delayPromise(100);
                let $el = $([]);
                $l.closest('div[class^="ipn-Competition "]')
                    .find('div.ipn-Fixture').each(function () {
                    const $teams = $(this).find('div.ipn-Fixture_Team');
                    const eventHere = $teams.eq(0).trt() + ' v ' + $teams.eq(1).trt();
                    if (eventHere.toLowerCase() === eventName || locutus_similar_text(eventHere.toLowerCase(), eventName, true) > 70) {
                        $el = $(this);
                        return false;
                    }
                });
                if ($el.length === 0) {
                    return false;
                } else {
                    await dClick($el[0], true, 'Open event LEFT', false, true);
                    await delayPromise(100);
                    return true;
                }
            }
            return false;
        };

        const res = await findEventAtLeft().catch(e => null);
        if (!res) {
            if (!await goRightPageInclSport()) {
                await findEvent();
            }
        }
        await waitForCondition(checkWeAreThere, 100, 30000,
            'We are not in the event!');
    };

    const openIfNecessary = async ($el, way) => {
        let opened = false;
        const elFind = {
            1: () => $el.find('div.slm-MarketGroup_HeaderClosed'),
            2: () => $el.find('div.slm-Market_HeaderClosed'),
            3: () => $el.find('div.sm-SplashMarket_HeaderOpen'),
            4: () => {
                const $ch = $el.closest('div.sm-SplashMarketGroup').find('div.sm-SplashMarketGroupButton_Chevron:visible');
                return $ch.length > 0 && parseFloat($ch.css('opacity')) > 0 ? $ch : $([]);
            },
        };
        $el[0].scrollIntoView();
        await delayPromise(150);
        const $expander = elFind[way]();
        if (way === 3 && $expander.length === 0) {
            await dClick($el.find('div.sm-SplashMarket_Header')[0], true);
            opened = true;
        } else if (way !== 3 && $expander.length > 0) {
            await dClick($expander[0], true);
            opened = true;
        }
        if (opened && way !== 4) {
            const checkSel = way === 3
                ? 'div.sm-SplashMarketContainer_Expanded span.sm-CouponLink_Title'
                : 'div.slm-CouponLink_Label';
            await waitForCondition(() => $el.find(checkSel).length > 0, 200, 3000,
                `No leagues for ${$el.find(way === 3 ? 'div.sm-SplashMarket_Title' : 'div.slm-Market_GroupName').trt()}`)
                .catch(e => console.log('%c' + e, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'));
            await delayPromise(200);
        }
    };

    const getWTypeAndSelector = () => {
        const wrapper = [
            'div.slm-MarketGroup',
            'div.sm-SplashMarketGroup',
        ].find(i => $(i).length > 0);
        const wType = wrapper === 'div.slm-MarketGroup' ? 1 : 2;
        const checks = wType === 1
            ? [
                'div.slm-MarketGroup_GroupName:contains("Full Time Result")',
                'div.slm-MarketGroup_GroupName:contains("Match Coupon")',
            ]
            : [
                'div.sm-SplashMarketGroupButton_Text:contains("Full Time Result")',
                'div.sm-SplashMarketGroupButton_Text:contains("Match Coupon")',
            ];
        const mWrapper = wType === 1 ? 'div.slm-Market' : 'div.sm-SplashMarket';
        const selector = `${wrapper}:has(${checks.find(i => $(i).length > 0)}) ${mWrapper}`;
        return {wType, selector};
    };

    /**
     * Open league for presented data
     * @param {SportEventObject} data
     * @returns {Promise<void>}
     */
    const prematchGoToLeague = async (data) => {
        const getHeaderSport = ['FOOTBALL', 'TENNIS', 'CYBERSPORT', 'TABLETENNIS'].indexOf(data.sport) > -1
            ? getHeaderNameSport[data.sport] : data.league.trim();
        let $breadcrumbSel = $(`div.sm-SplashMarketGroupButton_Text:textEquals(${getHeaderSport})`);
        const league = data.league.toLowerCase().trim();

        // expand league tab if collapsed
        if (!$breadcrumbSel.parent().hasClass('sm-SplashMarketGroup_Open')) {
            await dClick($breadcrumbSel.next()[0], true);
            await delayPromise(1500);
            $breadcrumbSel = $(`div.sm-SplashMarketGroupButton_Text:textEquals(${getHeaderSport})`);
        }

        //get list of leagues
        const $leaguesList = $breadcrumbSel.closest('div.sm-SplashMarketGroup').find('div.sm-SplashMarket');
        switch (data.sport) {
            case 'FOOTBALL':
                let $leagueLink = $([]);
                await $leaguesList.eachAsync(async function () {
                    const leagueName = $(this).find('div.sm-SplashMarket_Title').text().toLowerCase().trim();
                    if (league === leagueName) {
                        $leagueLink = $(this).find('div.sm-SplashMarket_Title');
                        return false;
                    }
                });
                if ($leagueLink.length > 0) {
                    await dClick($leagueLink[0], true);
                    await delayPromise(1000);
                    return $leaguesList.find('div.sm-SplashMarketContainer_Expanded');
                } else {
                    throw `No events link for '${data.league}`;
                }
                break;
            case 'TABLETENNIS':
                let $eventsListTTennis = $([]);
                const $fullListLinkTTennis = $leaguesList.find('span.sm-CouponLink_Title:textEquals("Full List")');
                if ($fullListLinkTTennis.length > 0) {
                    await dClick($fullListLinkTTennis[0], true);
                    await delayPromise(1333);
                    $eventsListTTennis = await waitForElementO(
                        {s: "div.cm-CouponMarketGrid", i: 300, m: 15000, e: 'TABLETENNIS grid'}
                    );
                    return $eventsListTTennis;
                } else {
                    throw 'Full link is not present on page';
                }
                break;
            case 'TENNIS':
                let $eventsListTennis = $([]);
                const $fullListLinkTennis = $leaguesList.find('span.sm-CouponLink_Title:textEquals("Full List")');
                if ($fullListLinkTennis.length > 0) {
                    await dClick($fullListLinkTennis[0], true);
                    await delayPromise(1333);
                    $eventsListTennis = await waitForElementO(
                        {s: "div.cm-CouponMarketGrid", i: 300, m: 15000, e: 'TENNIS grid'}
                    );
                    return $eventsListTennis;
                } else {
                    throw 'Full link is not present on page';
                }
                break;
            case 'CYBERSPORT':
                let $eventsListCS = $([]);
                const $fullListLinkCS = $leaguesList.find('span.sm-CouponLink_Title:textEquals("All Matches")');
                if ($fullListLinkCS.length > 0) {
                    await dClick($fullListLinkCS[0], true);
                    await delayPromise(1000);
                    $eventsListCS = await waitForElementO(
                        {s: "div.cm-CouponMarketGrid", i: 300, m: 15000, e: 'CYBERSPORT grid'}
                    );
                    return $eventsListCS;
                } else {
                    throw 'Full link is not present on page';
                }
                break;
            default:
                let $eventsListOther = $([]);
                const $fullListLinkOther = $leaguesList.find('span.sm-CouponLink_Title:textEquals("Game Lines")');

                if ($fullListLinkOther.length > 0) {
                    await dClick($fullListLinkOther[0], true);
                    await delayPromise(1000);
                    $eventsListOther = await waitForElementO(
                        {s: "div.cm-CouponMarketGrid", i: 300, m: 15000, e: 'default grid'}
                    );
                    return $eventsListOther;
                } else {
                    throw 'Full link is not present on page';
                }
        }
    };

    /**
     * Get leagues for sport
     * @param {string} sportOur
     * @param {string[]} getLeague
     * @returns {Promise<string[]|JQuery>}
     */
    const prematchGetLeagues = async (sportOur, getLeague) => {
        let leagues = [];
        const sports1 = ['BASKETBALL', 'BASEBALL', 'HOCKEY', 'VOLLEYBALL', 'HANDBALL', 'TENNIS',];
        const sports2 = ['FOOTBALL'];
        let $got = $([]);
        let way = 1;
        const leagueRes = $currentLeague => {
            const c = $currentLeague.trt();
            leagues.push(c);
            if (getLeague && compareVariants(c.toLowerCase(), getLeague, 100, true)) {
                $got = $currentLeague;
                return false;
            }
            return true;
        };
        if (sports1.indexOf(sportOur) > -1) {
            const mainSel = ['div.slm-MarketGroup', 'div.sm-SplashMarketGroup'].find(s => $(s).length > 0);
            way = mainSel === 'div.slm-MarketGroup' ? 1 : 4;
            const subSel = ['div.slm-MarketGroup_GroupName', 'div.sm-SplashMarketGroupButton_Text'].find(s => $(s).length > 0);
            $getCollection(mainSel, subSel).each(function () {
                const league = $(this).trt();
                if (league === 'Futures') {
                    // TODO: Make it if you wish
                    //$(this).closest(mainSel).find(subSel).each(function () {
                    //    return leagueRes($(this));
                    //});
                } else {
                    return leagueRes($(this));
                }
            });
        } else if (sports2.indexOf(sportOur) > -1) {
            const {wType, selector} = getWTypeAndSelector();
            await $(selector).eachAsync(async function () {
                const $this = $(this);
                const groupName = $this.find(wType === 1 ? 'div.slm-Market_GroupName' : 'div.sm-SplashMarket_Title').trt();
                way = wType === 1 ? 2 : 3;
                await openIfNecessary($this, way);
                $this.find(wType === 1 ? 'div.slm-CouponLink_Label' : 'div.sm-CouponLink').each(function () {
                    return leagueRes($(this));
                });
            });
        }
        return getLeague ? {$league: $got, way} : [...new Set(leagues)];
    };

    const prematchGetEvents = async (sportOur) => {
        const events = [];
        const sportsWayOne = ['BASKETBALL', 'HOCKEY', 'VOLLEYBALL', 'HANDBALL', 'BASEBALL'];
        const $eventsAll = await waitForElement(sportsWayOne.indexOf(sportOur) > -1
                ? (sportOur === 'BASEBALL'
                    ? 'div.sl-MarketHeaderLabel_Date, div.sl-CouponParticipantGameLineTwoWayWithPitchers_NameText'
                    : 'div.sl-MarketHeaderLabel_Date, div.sl-CouponParticipantGameLineTwoWay_NameText')
                : 'div.sl-MarketHeaderLabel_Date, div.sl-CouponParticipantWithBookCloses_Name', 333, 20000,
            false, 2)
            .catch(e => (console.log(e), $([])));
        let currentTeams = [];
        $eventsAll.each(function () {
            const $this = $(this);
            let eventHere = '';
            if ($this.hasClass('sl-MarketHeaderLabel_Date')) {
                return true;
            } else if (sportsWayOne.indexOf(sportOur) > -1) {
                if (currentTeams.length !== 2) {
                    currentTeams.push($this.trt());
                }
                if (currentTeams.length === 2) {
                    eventHere = currentTeams.join(' v ');
                    currentTeams = [];
                }
            } else if (sportsWayOne.indexOf(sportOur) === -1) {
                eventHere = $this.trt();
            }
            if (eventHere !== '') {
                events.push(eventHere);
            }
        });
        return [...new Set(events)];
    };

    const checkWeAreTherePrematch = (eventName) => {
        const $teamNames = $('div.sph-FixturePodHeader_TeamName');
        if ($teamNames.length !== 2) {
            return false;
        }
        const nameHere = `${$teamNames.eq(0).trt()} v ${$teamNames.eq(1).trt()}`.toLowerCase();

        return compareVariants(nameHere, eventName, 95, true);
    };

    const goPrematchSport = async (sportBookie) => await clickSequence([
        (new QueueObject('div.hm-MainHeaderCentreWide_Link:textEquals("Sports")')),
        (new QueueObject(`div.wn-PreMatchItem:textEquals("${sportBookie}")`, $s => !$s.hasClass('wn-PreMatchItem_Selected'))),
        //(new QueueObject('div.sm-SplashMarketGroupButton_Text:textEquals("Match Betting")', $s => !$s.hasClass('sm-SplashMarketGroup_Open'))),
    ], null, null, false, true);

    const switchMarketTab = async (data) => {
        const btnTab = 'div.sph-MarketGroupNavBarButton:textEquals';
        const reClick = async (str) => {
            if(!$(`${btnTab}("${str}")`).hasClass('sph-MarketGroupNavBarButton_Selected')) {
                await dClick($(`${btnTab}("${str}")`)[0]);
                await delayPromise(2555);
            }
        } 
        await waitForElement('div.sph-MarketGroupNavBarButton', 300, 15000);
        if (data.sport === 'FOOTBALL') {
            if (data.time_value !== 'FULL_TIME') {
                await dClick($(`${btnTab}("Half")`)[0]);
                await delayPromise(2555);
                await reClick("Half");
            }

            if (data.market === 'TOTAL' || data.market === 'T1_TOTAL' || data.market === 'T2_TOTAL') {
                await dClick($(`${btnTab}("Goals")`)[0]);
                await delayPromise(2555);
                await reClick("Goals");
            }

            if (data.market === 'CORNER_TOTAL' || data.market === 'CORNER_HDP') {
                await dClick($(`${btnTab}("Corners")`)[0]);
                await delayPromise(2555);
                await reClick("Corners");
            }
        }
        if (data.sport === 'TENNIS') {
            if (data.market === 'T1_TOTAL' || data.market === 'T2_TOTAL') {
                await dClick($(`${btnTab}("Player")`)[0]);
                await delayPromise(2555);
                await reClick("Player");
            }
        }
        if (data.sport === 'BASKETBALL') {
            if (data.market === 'HDP' || data.market === 'TOTAL') {
                await dClick($(`${btnTab}("Bet Builder")`)[0]);
                await delayPromise(2555);
                await reClick("Bet Builder");
            }
        }
    };

    const searchForEvent = async (data) => {
        const sport = typeof sportAccordance[data.sport] === 'undefined' ? '' : sportAccordance[data.sport];
        let tries = 0, $found = $([]), $noResult = $([]);
        const dataEvent = `${data.team1} v ${data.team2}`;
        do {
            const $close = $('div.sml-CloseButton');
            if ($close.length > 0) {
                await dClick($close[0]);
                await delayPromise(1555);
            }
            const $search = await waitForElement(findSel(['div.hm-SiteSearchIcon_Icon', 'div.wc-SearchBar_Icon']), 333, 10000);
            await dClick($search[0]);
            await waitForElement('input.sml-SearchTextInput', 333, 8888);
            await delayPromise(555);
            await navigator.clipboard.writeText(`${data.team1} v ${data.team2}`);
            await delayPromise(555);
            await dType($('input.sml-SearchTextInput')[0], `[CTRL+V]`);
            await delayPromise(555);
            dLog('green', '365', `Search value: ${$('input.sml-SearchTextInput').val()}`);
            if ($('input.sml-SearchTextInput').val() === '') {
                await dClick($('input.sml-SearchTextInput')[0]);
                await delayPromise(888);
                await navigator.clipboard.writeText(`${data.team1} v ${data.team2}`);
                await delayPromise(555);
                await dType($('input.sml-SearchTextInput')[0], `[CTRL+V]`);
                await delayPromise(555);
                dLog('green', '365', `Search value 2nd touch: ${$('input.sml-SearchTextInput').val()}`);
            }
            $noResult = await waitForElement('div.ssm-DynamicSearchPane_NoResults', 333, 1555).catch(() => $([]));
            if ($noResult.length > 0) {
                throw $noResult.trt();
            }
            await delayPromise(333);
            await waitForElement(`div.ssm-SearchClassificationRibbonItem_Selected:textEquals("${sport}")`, 333, 5555);
            $found = await waitForElement('span.ssm-SiteSearchLabelOnlyParticipant_Name',
                333, 10000).catch(() => $([]));
            if ($found.length > 0) {
                $found = $found.toArray().find(el => {
                    return locutus_similar_text($(el).trt(), dataEvent, true) > 90;
                });
                $found = $($found);
                if ($found.length === 1) {
                    await dClick($found[0]);
                }
                tries++;
                await delayPromise(222);
            } else {
                await delayPromise(1000);
                tries++;
            }
        } while ($found.length === 0 && tries < 2);

        if ($found.length === 0) {
            throw `Couldn't find event ${tries} times :(`;
        }
    };

    const openEventPrematch = async (data) => {
        if (data.direct_link) {
            document.location.href = data.direct_link.replace('.com', bkDomain);
            await delayPromise(3000);
            return true;
        }
        await searchForEvent(data);
        await delayPromise(999);
        //await switchMarketTab(data);

        return 'We have to be there :)';
    };

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<object|string>} jQuery element for bet
     */
    const getBetElement = async function (data) {
        if ((!data.team1 || !data.team2) && data.type === 'LIVE') {
            const $teams = await waitForElementO(
                {s: 'div.ipe-EventHeader_Fixture', i: 30, m: 10000, e: '$teams'}
            );
            const teams = $teams.trt().split(' v ');
            if (teams.length === 2) {
                data.team1 = teams[0].trim();
                data.team2 = teams[1].trim();
            }
        } else if ((!data.team1 || !data.team2) && data.type === 'PREMATCH') {
            data.team1 = $('div.sph-FixturePodHeader_TeamName').eq(0).trt();
            data.team2 = $('div.sph-FixturePodHeader_TeamName').eq(1).trt();
        }

        await switchMarketTab(data);
        await delayPromise(1111);

        return new Promise(function (reportSuccess, reportReject) {
            dLog('red', '365', [`getBetElement isMain: ${(window.self === window.top)}, data:`, data]);
            //#-#-START
            const dt = JSON.parse(JSON.stringify(data));
            let globalFound = false;
            let thirdHDPCheck = false;
            const onSuccess = function (d) {
                const $d = $(d);
                if (typeof $d[0] === 'undefined') {
                    onReject('Bet inactive!');
                } else {
                    globalFound = true;
                    $d[0].scrollIntoView(true);
                    reportSuccess($d);
                }
            };

            const onReject = function (d) {
                reportReject(d);
            };

            const targets = {
                'ONE_TWO': ['ONE', 'TWO', 'DRAW', 'ONE_DRAW', 'TWO_DRAW', 'ONE_TWO'],
                'ONE_TWO_3WAY': ['ONE', 'TWO', 'DRAW', 'ONE_DRAW', 'TWO_DRAW', 'ONE_TWO'],
                'TOTAL': ['OVER', 'UNDER'],
                'T1_TOTAL': ['OVER', 'UNDER'],
                'T2_TOTAL': ['OVER', 'UNDER'],
                'CORNER_TOTAL': ['OVER', 'UNDER'],
                'CORNER_HDP': ['HOME', 'AWAY'],
                'HDP': ['HOME', 'AWAY'],
                'EURO_HDP': ['H1', 'H2', 'HX']
            };

            const sportMarketsTargets = {
                'FOOTBALL': () => dt.time_value.indexOf('FULL') > -1
                    ? ['ONE_TWO', 'TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'CORNER_TOTAL', 'CORNER_HDP', 'HDP', 'EURO_HDP']
                    : [{'ONE_TWO': ['ONE', 'TWO', 'DRAW']}, 'TOTAL', 'CORNER_TOTAL', 'CORNER_HDP', 'HDP', 'EURO_HDP'],
                'TENNIS': () => dt.time_value.indexOf('FULL') > -1
                    ? [{'ONE_TWO': ['ONE', 'TWO']}, 'TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'HDP']
                    : dt.time_value.indexOf('GAME') > -1 ? [{'ONE_TWO': ['ONE', 'TWO']}]
                        : dt.time_value.indexOf('SET') > -1 ? [{'ONE_TWO': ['ONE', 'TWO']}, 'TOTAL'] : [],
                'BASEBALL': () => dt.time_value.indexOf('FULL') > -1
                    ? [{'ONE_TWO': ['ONE', 'TWO']}, 'TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'HDP']
                    : ['ONE_TWO', 'TOTAL', 'HDP'],
                'HOCKEY': () => dt.time_value.indexOf('FULL') > -1
                    ? [{'ONE_TWO': ['ONE', 'TWO']}, 'ONE_TWO_3WAY', 'TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'CORNER_TOTAL', 'HDP', 'EURO_HDP']
                    : [{'ONE_TWO': ['ONE', 'TWO']}, 'TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'HDP'],
                'BASKETBALL': () => ['FULL_MATCH', 'HALF_1'].indexOf(dt.time_value) > -1
                    ? [{'ONE_TWO': ['ONE', 'TWO']}, 'TOTAL', 'HDP']
                    : [{'ONE_TWO': ['ONE', 'TWO']}, 'TOTAL', 'HDP'],
                'VOLLEYBALL': () => dt.time_value.indexOf('FULL') > -1
                    ? [{'ONE_TWO': ['ONE', 'TWO']}, 'TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'HDP']
                    : [{'ONE_TWO': ['ONE', 'TWO']}, 'TOTAL', 'HDP'],
                'HANDBALL': () => ['ONE_TWO', 'TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'HDP', 'EURO_HDP'],
                'TABLETENNIS': () => dt.time_value.indexOf('FULL') > -1
                    ? [{'ONE_TWO': ['ONE', 'TWO']}, 'TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'HDP']
                    : [{'ONE_TWO': ['ONE', 'TWO']}, 'TOTAL', 'HDP'],
                'CYBERSPORT': () => dt.time_value.indexOf('FULL') > -1
                    ? ['ONE_TWO', 'TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'HDP']
                    : [{'ONE_TWO': ['ONE', 'TWO']}, 'TOTAL', 'HDP'],
            };

            const markets = {};
            sportMarketsTargets[dt.sport]().forEach(l => typeof l === 'string'
                ? markets[l] = targets[l]
                : markets[Object.keys(l)[0]] = Object.values(l)[0]);

            if (!markets[dt.market] || !markets[dt.market] || markets[dt.market].indexOf(dt.target) === -1) {
                onReject(`Unsupported  ${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}`);
                return;
            }

            const searchProto = function (type, roots, pivots, subroots, specials, immediatelySpecials) {
                this.type = type || 'direct';
                this.roots = roots || [];
                this.pivots = pivots || [];
                this.subroots = subroots || false;
                this.specials = specials || false;
                this.toString = function () {
                    return `${this.type} => ['${roots.join("', '")}'] ['${(subroots ? subroots.join("', '") : '')}'] ['${pivots.join("', '")}']`;
                };
                this.execSpecials = function () {
                    if (this.specials && typeof this.specials === 'function') {
                        specials();
                    }
                };
                if (immediatelySpecials && typeof immediatelySpecials === 'function') {
                    immediatelySpecials();
                }
                const replacers = {
                    team1: dt.team1,
                    team2: dt.team2,
                    score: (dt.score && dt.score.length > 0 ? dt.score : getScore(data)).replace(':', '-')
                };
                [this.roots, this.subroots, this.pivots]
                    .forEach(arr => arr && Array.isArray(arr) ?
                        arr.forEach((item, k) => arr[k] = (Array.isArray(item) ? item : [item])
                            .map(i => (i.replace('#TEAM1#', replacers.team1).replace('#TEAM2#', replacers.team2)
                                .replace('#PSCORE#', replacers.score)
                                .toLowerCase())
                            )
                        )
                        : null);
            };

            const overUnder = [({'OVER': 'Over', 'UNDER': 'Under'})[dt.target]];
            const overUnderML = [({'OVER': dt.team1, 'UNDER': dt.team2})[dt.target]];
            const hdpML = [({'HOME': dt.team1, 'AWAY': dt.team2})[dt.target]];
            const oneTwo = [({
                'ONE': '#TEAM1#',
                'TWO': '#TEAM2#',
                'DRAW': 'Draw',
                'ONE_DRAW': '#TEAM1# or Draw',
                'TWO_DRAW': ['#TEAM2# or Draw', 'Draw or #TEAM2#'],
                'ONE_TWO': '#TEAM1# or #TEAM2#',
            })[dt.target]];
            const oneTwoBaseball = [({
                'ONE': '#TEAM1#',
                'TWO': '#TEAM2#',
                'DRAW': 'Tie',
            })[dt.target]];
            const euroHdp = [({'H1': '#TEAM1#', 'H2': '#TEAM2#', 'HX': ['Tie', 'Draw']})[dt.target]];
            const ss = (fullTimeName, fullTime, overs) => dt.time_value.indexOf(fullTimeName) > -1 ? fullTime : overs;
            const tDigit = dt.time_value.replace(/[^\d]/g, '').trim();
            const basketballRoot = [dt.time_value.indexOf('FULL') > -1 ? 'Game Lines' : dt.time_value === 'HALF_TIME' ? '1st Half' :
                ['1st', '2nd', '3rd', '4th'][parseInt(tDigit) - 1] + (dt.type === 'PREMATCH' ? ' Quarter' : ' Quarter Lines')];

            const connectors = {
                // *****************************
                // FOOTBALL
                'FOOTBALL': {
                    'ONE_TWO': () => [
                        [
                            'one',
                            dt.time_value.indexOf('FULL') > -1 && ['ONE', 'TWO', 'DRAW'].indexOf(dt.target) > -1
                                ? ['Full Time Result', 'Fulltime Result']
                                : ss('FULL', ['Double Chance'], ['Half Time Result']),
                            oneTwo
                        ]
                    ],
                    'TOTAL': () => [
                        [
                            'two',
                            ss('FULL',
                                ['Match Goals', 'Alternative Match Goals', 'Alternative Total Goals', 'Goals Over/Under', 'Goal Line', 'Goal Line (#PSCORE#)'],
                                ['First Half Goals', '1st Half Goal Line',
                                    'Alternative 1st Half Goal Line', '1st Half Goal Line (#PSCORE#)']),
                            overUnder
                        ]
                    ],
                    'T1_TOTAL': () => [
                        ['two', ['Home Team Goals', 'Team Total Goals', '#TEAM1# Goals'], overUnder]
                    ],
                    'T2_TOTAL': () => [
                        ['two', ['Away Team Goals', 'Team Total Goals', '#TEAM2# Goals'], overUnder]
                    ],
                    'CORNER_TOTAL': () => [
                        [
                            'two',
                            ss('FULL', ['Asian Corners', '2-Way Corners',
                                'Asian Total Corners', 'Corners 2-Way'], ['1st Half Asian Corners']),
                            overUnder
                        ]
                    ],
                    'CORNER_HDP': () => [
                        ['three', ['Asian Handicap Corners'], hdpML]
                    ],
                    'HDP': () => [
                        [
                            'three', ss('FULL',
                            ['Asian Handicap', 'Alternative Asian Handicap', 'Asian Handicap (#PSCORE#)', 'Draw No Bet'],
                            ['1st Half Asian Handicap', 'Alternative 1st Half Asian Handicap',
                                '1st Half Asian Handicap (#PSCORE#)']),
                            hdpML
                        ]
                    ],
                    'EURO_HDP': () => [
                        [
                            'three',
                            ss('FULL', ['Handicap Result', 'Alternative Handicap Result',
                                '3-Way Handicap'], ['1st Half - Handicap', '1st Half Handicap']),
                            euroHdp
                        ]
                    ],
                },
                // *****************************
                // TENNIS
                'TENNIS': {
                    'ONE_TWO': () => [
                        [
                            // type
                            'auto',
                            // roots
                            ss('FULL', ['To Win', 'To Win Match'],
                                dt.time_value.indexOf('SET_') > -1
                                    ? dt.time_value.replace(/[^\d]/g, '') === '1'
                                        ? ['First Set Winner', 'To Win']
                                        : [`Set ${tDigit} winner`, 'To Win']
                                    : dt.time_value.indexOf('GAME_') > -1
                                        ? [`${tDigit}th Game winner`, 'To Win']
                                        : ['To Win']),
                            // pivots
                            oneTwo,
                            // subroots
                            false,
                            // specials
                            () => (dt.pivot = dt[dt.target === 'ONE' ? 'team1' : 'team2'],
                                    dt.pk = dt.time_value.indexOf('FULL') > -1 ? 'Match'
                                        : (dt.time_value.indexOf('SET_') > -1 ? `Set ${tDigit}` : `${tDigit}th Game Winner`)
                            )
                        ]
                    ],
                    'TOTAL': () => [
                        [
                            'two,five',
                            dt.time_value.indexOf('FULL') > -1
                                ? ['Total Games in Match']
                                : dt.time_value.indexOf('SET_') > -1
                                    ? [`Total Games in Set ${tDigit}`, '1st Set Total Games']
                                    : [],
                            overUnder
                        ],
                        ['auto',
                            ss('FULL', ['Alternative Total Games in Match',
                                'Total Games 2-Way'], []),
                            overUnder
                        ]
                    ],
                    'T1_TOTAL': () => [
                        [
                            'three',
                            ['Player Games Won'],
                            ['#TEAM1#'],
                            false,
                            false,
                            () => (dt.pivot = dt.target === 'OVER' ? `Over ${dt.pivot}` : `Under ${dt.pivot}`)]
                    ],
                    'T2_TOTAL': () => [
                        [
                            'three',
                            ['Player Games Won'],
                            ['#TEAM2#'],
                            false,
                            false,
                            () => (dt.pivot = dt.target === 'OVER' ? `Over ${dt.pivot}` : `Under ${dt.pivot}`)]
                    ],
                    'HDP': () => [
                        ['five', ['Match Handicap', 'Alternative Match Handicap', 'Match Handicap (Games)'], hdpML],
                    ],
                },
                // *****************************
                // BASEBALL
                'BASEBALL': {
                    'ONE_TWO': () => [
                        [
                            'six',
                            ss('FULL', ['Game Lines'],
                                [`${dt.time_value.replace(/[^\d]/g, '')}th Inning Lines`]),
                            oneTwoBaseball,
                            false,
                            () => (dt.pivot = dt.target === 'DRAW' ? 'Tie' : dt[dt.target === 'ONE' ? 'team1' : 'team2'],
                                dt.pk = dt.time_value.indexOf('INNING') === -1 ? 'Money Line' : 'Winner')
                        ]
                    ],
                    'TOTAL': () => [
                        [
                            'seven',
                            ss('FULL', ['Game Lines'], [`${tDigit} Innings Lines`]),
                            overUnderML,
                            false,
                            false,
                            () => (dt.specMarket = 'Total')
                        ],
                        ['two', ss('FULL', ['Alternative Game Total'], []), overUnder]
                    ],
                    'T1_TOTAL': () => [
                        [
                            'three',
                            ['Team Totals'],
                            ['#TEAM1#'],
                            false,
                            false,
                            () => (dt.pivot = dt.target === 'OVER' ? `Over ${dt.pivot}` : `Under ${dt.pivot}`)
                        ]
                    ],
                    'T2_TOTAL': () => [
                        [
                            'three',
                            ['Team Totals'],
                            ['#TEAM2#'],
                            false,
                            false,
                            () => (dt.pivot = dt.target === 'OVER' ? `Over ${dt.pivot}` : `Under ${dt.pivot}`)
                        ]
                    ],
                    'HDP': () => [
                        [
                            'seven',
                            ss('FULL', ['Game Lines'], [`${tDigit} Innings Lines`]),
                            hdpML,
                            false,
                            false,
                            () => (dt.specMarket = 'Run Line')
                        ],
                        [
                            'three',
                            ss('FULL', ['Alternative Run Line'], []),
                            hdpML
                        ]
                    ],
                },
                // *****************************
                // VOLLEYBALL
                'VOLLEYBALL': {
                    'ONE_TWO': () => [
                        [
                            'six',
                            ss('FULL', ['Game Lines'], [`Set ${tDigit} Lines`, '1st Set Lines']),
                            oneTwo,
                            false,
                            () => (dt.pk = dt[dt.target === 'ONE' ? 'team1' : 'team2'],
                                dt.pivot = (dt.type === 'PREMATCH' ? 'To Win' : 'Winner'))
                        ]
                    ],
                    'TOTAL': () => [
                        [
                            'seven',
                            ss('FULL', ['Game Lines'], [`Set ${tDigit} Lines`, '1st Set Lines']),
                            overUnderML,
                            false,
                            false,
                            () => (dt.specMarket = (dt.type === 'PREMATCH' ? 'Total Points' : 'Total'))
                        ],
                    ],
                    'HDP': () => [
                        [
                            'seven',
                            ss('FULL', ['Game Lines'], [`Set ${tDigit} Lines`, '1st Set Lines']),
                            hdpML,
                            false,
                            false,
                            () => (dt.specMarket = ((dt.type === 'PREMATCH' && dt.time_value.indexOf('FULL') > -1) ? 'Handicap - Sets' : (dt.type === 'PREMATCH' && dt.time_value.indexOf('FULL') === -1) ? 'Handicap' : 'Handicap'))
                        ],
                    ],
                    'T1_TOTAL': () => [
                        [
                            'three',
                            ['Team Totals', 'Team Total Points'],
                            ['#TEAM1#'],
                            false,
                            false,
                            () => (dt.pivot = dt.target === 'OVER' ? `Over ${dt.pivot}` : `Under ${dt.pivot}`)
                        ]
                    ],
                    'T2_TOTAL': () => [
                        [
                            'three',
                            ['Team Totals', 'Team Total Points'],
                            ['#TEAM2#'],
                            false,
                            false,
                            () => (dt.pivot = dt.target === 'OVER' ? `Over ${dt.pivot}` : `Under ${dt.pivot}`)
                        ]
                    ],
                },
                // *****************************
                // BASKETBALL
                'BASKETBALL': {
                    'ONE_TWO': () => [
                        [
                            'six',
                            basketballRoot,
                            oneTwo,
                            false,
                            () => (dt.pk = dt[dt.target === 'ONE' ? 'team1' : 'team2'], dt.pivot = 'Money Line')
                        ]
                    ],
                    'TOTAL': () => [
                        [dt.type === 'PREMATCH' ? 'eight' : 'seven', [dt.type === 'PREMATCH' ? 'Total' : basketballRoot], overUnderML, false, false, () => (dt.specMarket = 'Total')],
                    ],
                    'HDP': () => [
                        [dt.type === 'PREMATCH' ? 'nine' : 'seven', [dt.type === 'PREMATCH' ? 'Spread' : basketballRoot], hdpML, false, false, () => (dt.specMarket = 'Spread')],
                    ],
                },
                // *****************************
                // TABLETENNIS
                'TABLETENNIS': {
                    'ONE_TWO': () => [
                        [
                            'six',
                            ss('FULL', ['Match Lines'], [dt.time_value.indexOf('SET') > -1
                                ? `Set ${tDigit} Lines` : `Game ${tDigit} Lines`]),
                            oneTwo,
                            false,
                            () => (dt.pk = dt[dt.target === 'ONE' ? 'team1' : 'team2'], dt.pivot = 'Winner')
                        ],
                    ],
                    'TOTAL': () => [
                        [
                            'seven',
                            ss('FULL', ['Match Lines'], [dt.time_value.indexOf('SET') > -1
                                ? `Set ${tDigit} Lines` : `Game ${tDigit} Lines`]),
                            overUnderML,
                            false,
                            false, () => (dt.specMarket = 'Total')
                        ],
                    ],
                    'HDP': () => [
                        [
                            'seven',
                            ss('FULL', ['Match Lines'],
                                [dt.time_value.indexOf('SET') > -1 ? `Set ${tDigit} Lines` : `Game ${tDigit} Lines`]),
                            hdpML,
                            false,
                            false,
                            () => (dt.specMarket = 'Handicap')
                        ],
                    ],
                },
                // HOCKEY
                'HOCKEY': {
                    'ONE_TWO': () => [
                        [
                            'six',
                            ss('FULL', ['Game Lines'], [dt.time_value.indexOf('PERIOD') > -1
                                ? `${tDigit}st Period` : '1st Period']),
                            oneTwo,
                            false,
                            () => (dt.pk = dt[dt.target === 'ONE' ? 'team1' : 'team2'], dt.pivot = 'Money Line')
                        ],
                    ],
                    'TOTAL': () => [
                        [
                            'seven',
                            ss('FULL', ['Game Lines'], [dt.time_value.indexOf('PERIOD') > -1
                                ? `${tDigit}st Period` : `1st Period`]),
                            overUnderML,
                            false,
                            false,
                            () => (dt.specMarket = 'Total')
                        ],
                    ],
                    'HDP': () => [
                        [
                            'seven',
                            ss('FULL', ['Game Lines'], [dt.time_value.indexOf('PERIOD') > -1
                                ? `Set ${tDigit}st Period` : `1st Period`]),
                            hdpML,
                            false,
                            false,
                            () => (dt.specMarket = 'Line')
                        ],
                    ],
                },
                // CYBERSPORT
                'CYBERSPORT': {
                    'ONE_TWO': () => [
                        [
                            'two',
                            ss('FULL', ['Match Lines'],
                                [`Map ${tDigit} - Winner`, `Map ${tDigit} Lines`, `Map ${tDigit} - Lines`]),
                            oneTwo, false, false, () => (dt.pivot = 'To Win')
                        ],
                        [
                            'two',
                            ss('FULL', ['Match Lines'],
                                [`Map ${tDigit} - Winner`, `Map ${tDigit} Lines`, `Map ${tDigit} - Lines`]),
                            oneTwo, false, () => (dt.pivot = 'Winner')
                        ],
                        [
                            'one',
                            ss('FULL', ['Match Lines'],
                                [`Map ${tDigit} - Winner`, `Map ${tDigit} Lines`, `Map ${tDigit} - Lines`]),
                            oneTwo
                        ],
                        [
                            'one',
                            dt.time_value.indexOf('FULL') > -1 && ['ONE', 'TWO', 'DRAW'].indexOf(dt.target) > -1
                                ? ['Full Time Result', 'Fulltime Result']
                                : ss('FULL', ['Double Chance'], ['Half Time Result']),
                            oneTwo
                        ],
                    ],
                    'TOTAL': () => [
                        [
                            'seven',
                            ss('FULL', ['Match Lines'],
                                [`Map ${tDigit} - Lines`, `Map ${tDigit} Lines`]),
                            overUnderML,
                            false,
                            false,
                            () => (dt.specMarket = dt.time_value.indexOf('FULL') > -1 ? 'Total Maps' : 'Total Rounds')
                        ],
                        [
                            'two',
                            ss('FULL', ['Match Totals'],
                                [`Map ${tDigit} - Alt Total Rounds`]), overUnder
                        ],
                        [
                            'two',
                            ss('FULL',
                                ['Match Goals', 'Alternative Match Goals', 'Alternative Total Goals',
                                    'Goals Over/Under', 'Goal Line', 'Goal Line (#PSCORE#)'],
                                ['First Half Goals', '1st Half Goal Line', 'Alternative 1st Half Goal Line',
                                    '1st Half Goal Line (#PSCORE#)']),
                            overUnder
                        ],
                    ],
                    'T1_TOTAL': () => [
                        ['two', ['Home Team Goals', 'Team Total Goals', '#TEAM1# Goals'], overUnder]
                    ],
                    'T2_TOTAL': () => [
                        ['two', ['Away Team Goals', 'Team Total Goals', '#TEAM2# Goals'], overUnder]
                    ],
                    'HDP': () => [
                        [
                            'seven',
                            ss('FULL', ['Match Lines'],
                                [`Map ${tDigit} - Lines`, `Map ${tDigit} Lines`]),
                            hdpML,
                            false,
                            false,
                            () => (dt.specMarket = dt.time_value.indexOf('FULL') > -1
                                ? (dt.type === 'PREMATCH' ? 'Match Handicap' : 'Maps Handicap')
                                : 'Rounds Handicap')
                        ],
                        [
                            'three',
                            ss('FULL', ['Match Totals'],
                                [`Map ${tDigit} - Alt Rounds Handicap`]),
                            hdpML
                        ],
                        ['three',
                            ss('FULL',
                                ['Asian Handicap', 'Alternative Asian Handicap', 'Asian Handicap (#PSCORE#)'],
                                ['1st Half Asian Handicap', 'Alternative 1st Half Asian Handicap',
                                    '1st Half Asian Handicap (#PSCORE#)']),
                            hdpML
                        ],
                    ],
                },
            };

            dLog('', '365', ['Connectors: ', connectors[dt.sport][dt.market]()]);

            const searchers = [];
            connectors[dt.sport][dt.market]().forEach(c => searchers.push(new searchProto(...c)));

            const printSearchers = [];
            searchers.forEach(s => printSearchers.push(s.toString()));
            dLog('', '365', ['Searchers: ', printSearchers]);

            const calcFrom = source => {
                const parts = source.trim().split(',');
                let sum = 0;
                parts.forEach(p => sum += parseFloat(p.trim()));
                return sum / parts.length;
            };

            const pSel = sel => {
                let res = sel;
                for (const gl of ['gl-', 'gll-']) {
                    if (sel.indexOf(gl) > -1 && $(sel).length === 0) {
                        res = sel.replace(gl === 'gl-' ? /gl-/g : /gll-/g, gl === 'gl-' ? 'gll-' : 'gl-');
                        break;
                    }
                }
                return res;
            };

            const checkScore = () => {
                return true;
            }

            const checkHdpFCoef = (x, min, max, pivotState) => {
                if (!pivotState) return false;
                return x >= min && x <= max;
            }

            const findPivot = (searcher, $root) => {
                const types = {
                    // Classic ONE_TWO like FOOTBALL Root => [ Target - Coef ]
                    // looks at b365_img_1 in docs
                    'one': pk => {
                        console.log('ONE', pk);
                        let idx = -1;
                        let $selBase = $root.find(pSel('span.gll-Participant_Name'));
                        idx = Array.from($selBase).findIndex(el => locutus_similar_text($(el).trt().toLowerCase(), pk.toLowerCase(), true) > 65);

                        if (idx === -1) {
                            $selBase = $root.find('span.srb-ParticipantResponsiveText_Name');
                            idx = Array.from($selBase).findIndex(el => locutus_similar_text($(el).trt().toLowerCase(), pk.toLowerCase(), true) > 65);
                        }
                        if (idx === -1) {
                            $selBase = $root.find('span.gl-ParticipantBorderless_Name');
                            idx = Array.from($selBase).findIndex(el => locutus_similar_text($(el).trt().toLowerCase(), pk.toLowerCase(), true) > 65);
                        }
                        if (idx >= 0) {
                            onSuccess($selBase.eq(idx).closest(pSel('div.gll-Participant_General')));
                        } else {
                            throw `No pivotKey for ${$root}`;
                        }
                        return idx > -1 ? true : false;
                    },
                    // Usually for totals Root => Target column => Pivot row [ Coef ]
                    // b365_img_2, b365_img_2-1, b365_img_2-2
                    'two': pk => {
                        console.log('TWO', pk);
                        let pivotIdx = -1;
                        if (dt.type === 'PREMATCH' && (dt.market === 'T1_TOTAL' || dt.market === 'T2_TOTAL')) {
                            if (dt.market === 'T1_TOTAL') {
                                const $blocks = $root.find('div.gl-Market_General').eq(0);
                                $blocks.find('span.srb-ParticipantCenteredStackedWithMarketBorders_Handicap').each((i, v) => {
                                    if ($(v).trt().indexOf('Over')) {
                                        if (parseFloat($(v).text().replace(/[^\d.-]/g, '')) === parseFloat(dt.pivot)) {
                                            pivotIdx = i;
                                            onSuccess($(v));
                                        }
                                    }
                                    if ($(v).trt().indexOf('Under')) {
                                        if (parseFloat($(v).text().replace(/[^\d.-]/g, '')) === parseFloat(dt.pivot)) {
                                            pivotIdx = i;
                                            onSuccess($(v));
                                        }
                                    }
                                });
                            }
                            if (dt.market === 'T2_TOTAL') {
                                const $blocks = $root.find('div.gl-Market_General').eq(1);
                                $blocks.find('span.srb-ParticipantCenteredStackedWithMarketBorders_Handicap').each((i, v) => {
                                    if ($(v).trt().indexOf('Over')) {
                                        if (parseFloat($(v).text().replace(/[^\d.-]/g, '')) === parseFloat(dt.pivot)) {
                                            pivotIdx = i;
                                            onSuccess($(v));
                                        }
                                    }
                                    if ($(v).trt().indexOf('Under')) {
                                        if (parseFloat($(v).text().replace(/[^\d.-]/g, '')) === parseFloat(dt.pivot)) {
                                            pivotIdx = i;
                                            onSuccess($(v));
                                        }
                                    }
                                });
                            }
                        } else {
                            let $rows = $root.find('div.srb-ParticipantLabelCentered_Name');
                            if ($rows.length === 0) {
                                $rows = $root.find('div.srb-ParticipantLabel_Name');
                            }
                            if (dt.sport === 'TABLETENNIS' && dt.type === 'PREMATCH') {
                                switch (dt.market) {
                                    case 'ONE_TWO':
                                        dt.pivot = 'To Win';
                                        break;
                                    case 'HDP':
                                        dt.pivot = 'Handicap';
                                        break;
                                    case 'TOTAL':
                                        dt.pivot = 'Total';
                                }
                            } else if (dt.sport === 'TENNIS') {
                                switch (dt.market) {
                                    case 'ONE_TWO':
                                        dt.pivot = dt.time_value.indexOf('FULL') > -1 ? 'Match'
                                            : 'Set ' + dt.time_value.replace(/\D/g, '');
                                        break;
                                    case 'HDP':
                                        //dt.pivot = 'Handicap';
                                        break;
                                    case 'TOTAL':
                                    //dt.pivot = 'Total';
                                }
                            }

                            ($rows.length > 0 ? $rows : $root.find(pSel('span.gll-ParticipantRowName_Name')))
                                .each((i, v) => {
                                    if (calcFrom($(v).text()) === parseFloat(dt.pivot)
                                        || $(v).trt() === dt.pivot) {
                                        pivotIdx = i;
                                        return false;
                                    }
                                });
                            if (pivotIdx > -1) {
                                let $vs = $([]);
                                let $cols = $root.find(pSel('div.gl-Market_General-columnheader'));
                                $cols = $cols.length > 0 ? $cols : $root.find(pSel('div.gl-Market_General'));

                                let $sels = $cols.has(pSel(`div.gl-MarketColumnHeader`));
                                let idx = Array.from($sels).findIndex(el => locutus_similar_text($(el).trt().toLowerCase(), pk.toLowerCase(), true) > 65);
                                if (idx >= 0) {
                                    $vs = $sels.eq(idx).find(pSel('div.gl-ParticipantOddsOnly'));
                                }

                                if ($vs.length === 0 && idx >= 0) {
                                    $vs = $sels.eq(idx).find(pSel('div.gl-Participant_General'));
                                }
                                if ($vs.length < pivotIdx) {
                                    throw `pivotIdx ${pivotIdx} exists but no pivotValue for ${pk}!`;
                                }
                                onSuccess($vs.eq(pivotIdx));
                            }
                        }

                        return pivotIdx > -1;
                    },
                    // Special variance of two
                    // b365_img_6
                    'six': pk => {
                        console.log('SIX', pk);
                        const res = types.two(dt.pk);
                        dt.market = data.market;
                        dt.target = data.target;
                        dt.pivot = data.pivot;
                        delete dt.pk;
                        return res;
                    },
                    // Root => Target column => Row [ Pivot - Coef ]
                    // b365_img_3, b365_img_3-1
                    'three': pk => {
                        console.log('THREE', pk);
                        let findPivot = parseFloat(dt.pivot);
                        if (isNaN(findPivot)) {
                            findPivot = dt.pivot;
                        }
                        let $el = $([]);
                        let $els = $([]);
                        let $elsBase = $root.find(pSel(`div.gl-Market_General-columnheader:has(div.gl-MarketColumnHeader)`));
                        let idx = Array.from($elsBase).findIndex(el => locutus_similar_text($(el).find('div.gl-MarketColumnHeader').trt().toLowerCase(), pk.toLowerCase(), true) > 65);
                        if (idx >= 0) {
                            $els = $elsBase.eq(idx).find('div.gl-Participant_General');
                        }
                        if ($els.length === 0 && idx >= 0) {
                            $els = $elsBase.eq(idx).find('div.srb-ParticipantCenteredStackedWithMarketBorders');
                        }
                        $els.each(function () {
                            const $this = $(this);
                            const sel = ['EURO_HDP', 'HDP'].indexOf(dt.market) === -1
                                ? $(pSel('span.gl-ParticipantCentered_Name')).length === 0
                                    ? 'span.srb-ParticipantCenteredStackedWithMarketBorders_Handicap'
                                    : pSel('span.gl-ParticipantCentered_Name')
                                : $(pSel('span.gl-ParticipantCentered_Handicap')).length === 0
                                    ? 'span.srb-ParticipantCenteredStackedWithMarketBorders_Handicap'
                                    : pSel('span.gl-ParticipantCentered_Handicap');
                            if (checkScore() === true) {
                                const pivot = calcFrom($this.find(sel).text());
                                const text = $this.find(sel).text().replace(/\s+/g, ' ').trim();
                                if (text === findPivot.toString() || pivot === findPivot) {
                                    onSuccess($this);
                                    $el = $this;
                                    return false;
                                } else {
                                    console.log(`${text} !== ${findPivot.toString()} && ${pivot} !== ${findPivot}`);
                                }
                            } else {
                                thirdHDPCheck = true;
                                const coef = parseFloat(dt.coef);
                                let oddsSelector = 'span.gl-ParticipantCentered_Odds';
                                let checkPlayerTotal = true;

                                if ((dt.sport === 'TENNIS' || dt.sport === 'VOLLEYBALL')
                                    && dt.type === 'PREMATCH'
                                    && (dt.market === 'T1_TOTAL' || dt.market === 'T2_TOTAL')) {
                                    oddsSelector = 'span.srb-ParticipantCenteredStackedWithMarketBorders_Odds';
                                    checkPlayerTotal = $this.find('span.srb-ParticipantCenteredStackedWithMarketBorders_Handicap').trt() === dt.pivot;
                                }

                                const searchCoef = parseFloat($this.find(oddsSelector).trt());

                                if (checkHdpFCoef(searchCoef, coef, coef + 0.13, checkPlayerTotal)) {
                                    onSuccess($this);
                                    $el = $this;
                                    return false;
                                } else {
                                    console.log(`not checkHdpFCoef(${searchCoef}, ${coef}, ${checkPlayerTotal}`);
                                }
                            }
                        });
                        return $el.length > 0;
                    },
                    // Root => Target row => [ Pivot - Coef ]
                    'four': pk => {
                        console.log('FOUR', pk);
                        let rowIdx = -1, $el = $([]);
                        $root.find('div.gl-MarketColumnHeader').each((i, v) => {
                            let isN = locutus_similar_text($(v).trt().toLowerCase(), pk.toLowerCase(), true) > 65;
                            if (isN) {
                                rowIdx = i + 1;
                                return false;
                            }
                        });
                        if (rowIdx > -1) {
                            $root.find(`div.gll-MarketValues div.gll-Participant_General:nth-child(${rowIdx}) `).each(function () {
                                const $this = $(this);
                                const pivot = parseFloat($this.find('span.gll-ParticipantCentered_Handicap').trt());
                                if (pivot === parseFloat(dt.pivot)) {
                                    onSuccess($this);
                                    $el = $this;
                                    return false;
                                }
                            });
                        }
                        return $el.length > 0;
                    },
                    // Root => [ Target => Pivot - Coef ]
                    'five': pk => {
                        console.log('FIVE', pk);
                        let $el = $([]);
                        let $buttonsAll = $([]);
                        let $buttons = $([]);
                        let $buttonsTennis = $([]);
                        const pivot = dt.pivot > 0 ? '+' + dt.pivot : dt.pivot;
                        const $buttonsLst = $root.find(pSel(`div.gll-Participant_General:has(span.gll-ParticipantCentered_Name)`));
                        const idxBtn = Array.from($buttonsLst).findIndex(el => locutus_similar_text($(el).trt().toLowerCase(), pk.toLowerCase(), true) > 65);

                        if (idxBtn >= 0) {
                            $buttons = $buttonsLst.eq(idxBtn);
                        }

                        const $buttonsTennisLst = $root.find(pSel(`div.gll-Participant_General`))
                            .find(pSel(`span.gll-ParticipantBorderless_Name`));
                        const idxBtnTns = Array.from($buttonsTennisLst).findIndex(el => locutus_similar_text($(el).trt().toLowerCase(), `${pk} ${pivot}`.toLowerCase(), true) > 65);

                        if (idxBtnTns >= 0) {
                            $buttonsTennis = $buttonsTennisLst.eq(idxBtnTns);
                        }

                        $buttonsAll = $buttons.length > 0 ? $buttons : $buttonsTennis;

                        if (dt.type === 'PREMATCH' && dt.market === 'HDP') {
                            const $headerElst = $root.find(`div.gl-Market_General-columnheader:has(div.gl-MarketColumnHeader)`);
                            let $headerEl = $([]);
                            const headerIdx = Array.from($headerElst).findIndex(el => locutus_similar_text($(el).trt().toLowerCase(), pk.toLowerCase(), true) > 65);

                            if (headerIdx >= 0) {
                                $headerEl = $headerElst.eq(headerIdx);
                            }

                            if ($headerEl.length > 0) {
                                $headerEl.parent().find('div.gl-Participant_General').each(function () {
                                    const $this = $(this);
                                    if (parseFloat($this.find('span.gl-ParticipantCentered_Name').trt()) === parseFloat(dt.pivot)) {
                                        onSuccess($this);
                                        $el = $this;
                                        return false;
                                    }
                                });
                            }
                        } else {
                            ($buttonsAll.length > 0 ? onSuccess($buttonsAll) : $root
                                .find(pSel(`div.gll-Participant_General:has(span.gll-Participant_Name:textEqualsI("${pk}"))`))).each(function () {
                                const $this = $(this);
                                const $hdp = $this.find(pSel('span.gll-ParticipantCentered_Handicap'));
                                if (parseFloat(($hdp.length > 0 ? $hdp : $this
                                    .find(pSel('span.gll-Participant_Handicap'))).trt()) === parseFloat(dt.pivot)) {
                                    onSuccess($this);
                                    $el = $this;
                                    return false;
                                }
                            });
                        }

                        if ($buttonsAll.length > 0) {
                            $el = $buttonsAll;
                        }

                        return $el.length > 0;
                    },
                    //  Root => pk column => SpecMarket row [ Pivot - Coef ]
                    // b365_img_7, b365_img_7-1
                    'seven': pk => {
                        console.log('SEVEN ', pk);
                        const possibleRows = ['span.gll-ParticipantRowValue_Name', 'div.srb-ParticipantLabel_Name',
                            'span.gll-ParticipantRowName_Name'];
                        let rowIdx = -1, check = 0, $rows = $([]);
                        while ($rows.length === 0 && check < possibleRows.length) {
                            $rows = $root.find(pSel(possibleRows[check]));
                            check++;
                        }
                        console.log('dt ', dt);
                        console.log('$rows ', $rows);
                        $rows.each((i, v) => {
                            if ($(v).trt().toLowerCase() === dt.specMarket.toLowerCase()) {
                                rowIdx = i;
                                return false;
                            } else {
                                dLog('', '365', `seven: '${$(v).trt().toLowerCase()}' !== '${dt.specMarket.toLowerCase()}'`);
                            }
                        });
                        let $el = $([]);
                        console.log('rowIdx ', rowIdx);
                        if (rowIdx > -1) {
                            let $vs = $([]);
                            const findEl = 'div.gll-Participant_General';
                            let $els = $root.find(pSel('div.gll-MarketValues:has(div.gll-MarketColumnHeader'));
                            let idx = Array.from($els).findIndex(el => locutus_similar_text($(el).trt().toLowerCase(), pk.toLowerCase(), true) > 65);

                            if (idx >= 0) {
                                $vs = $els.eq(idx).find(findEl);
                            }

                            if ($vs.length === 0) {
                                $els = $root.find(pSel('div.gll-Market_General:has(div.gll-MarketColumnHeader'));
                                idx = Array.from($els).findIndex(el => locutus_similar_text($(el).trt().toLowerCase(), pk.toLowerCase(), true) > 65);

                                if (idx >= 0) {
                                    $vs = $els.find(findEl);
                                }
                            }
                            if ($vs.length < rowIdx) {
                                throw `pivotIdx ${rowIdx} exists but no pivotValue for ${pk}!`;
                            }
                            $el = $vs.eq(rowIdx);
                        }
                        if ($el.length === 1) {
                            let pSelHandicap = 'span.gll-ParticipantCentered_Handicap';
                            if ((dt.sport === 'HOCKEY' || dt.sport === 'BASKETBALL') && dt.type === 'PREMATCH') {
                                pSelHandicap = 'span.sab-ParticipantCenteredStackedOTB_Handicap';
                                const $hdp = $el.find(pSel(pSelHandicap));
                                let text = $hdp.length > 0 ? $hdp.text() : '';
                                if (dt.market === 'TOTAL') {
                                    text = text.replace(/[^\d.-]/g, '');
                                }
                                if (calcFrom(text) === parseFloat(dt.pivot)) {
                                    onSuccess($el);
                                    return true;
                                }
                            } else {
                                const $hdp = $el.find(pSel(pSelHandicap));
                                const $new = $el.find('span.sip-MergedHandicapParticipant_Name');
                                const $cNew = $el.find('span.srb-ParticipantCenteredStackedMarketRow_Handicap');
                                const text = $hdp.length > 0 ? $hdp.text()
                                    : $new.length > 0 ? $new.text().replace(/[^\d.-]/g, '')
                                        : $cNew.length > 0 ? $cNew.text().replace(/[^\d.-]/g, '')
                                            : $el.find(pSel('span.gll-ParticipantCentered_Name')).text().replace(/[^\d.-]/g, '');
                                if (calcFrom(text) === parseFloat(dt.pivot)) {
                                    onSuccess($el);
                                    return true;
                                }
                            }

                        }
                        return false;
                    },
                    // BASKETBALL TOTAL
                    'eight': pk => {
                        let $pvtEls = $root.find('div.bbl-BetBuilderParticipantLabel_Name');
                        let $bet = $([]);
                        let pvtIdx = null;

                        for (let i=0; i<$pvtEls.length; i++) {
                            if ($pvtEls.eq(i).trt() === `${dt.pivot} Points`) {
                                pvtIdx = i;
                                break;
                            }
                        }
                        if (pvtIdx !== null) {
                            const clmnIdx = dt.target === 'OVER' ? 1 : 2;
                            $bet = $root.find(`div.gl-Market_General-columnheader:eq(${clmnIdx}) span.bbl-MaxTeamSelectionsParticipant_Odds:eq(${pvtIdx})`).parent();

                            if ($bet.length === 1) {
                                onSuccess($bet);
                            } else if ($bet.length > 1) {
                                throw `Wrong length pivotKey (${$bet.length}) for ${root}`;
                            }
                        }

                        return $bet.length === 1;
                    },
                    // BASKETBALL HDP
                    'nine': pk => {
                        let $bet = $([]);
                        let betStr = null;
                        const clmnIdx = dt.target === 'HOME' ? 0 : 1;
                        betStr = $root.find(`div.gl-Market_General-columnheader:eq(${clmnIdx}) span.bbl-BetBuilderParticipant_Handicap`).toArray().find(el => {
                            return parseFloat($(el).trt()) === parseFloat(dt.pivot);
                        });

                        if (betStr !== null) {
                            $bet = $(betStr).parent();

                            if ($bet.length === 1) {
                                onSuccess($bet);
                            } else if ($bet.length > 1) {
                                throw `Wrong length pivotKey (${$bet.length}) for ${root}`;
                            }
                        }

                        return $bet.length === 1;
                    },
                };
                if (typeof searcher.execSpecials === 'function') {
                    searcher.execSpecials();
                }
                if (searcher.type === 'auto' || searcher.type.indexOf(',') > -1) {
                    return pk => (searcher.type === 'auto' ? Object.keys(types) : searcher.type.split(',')).some(t => {
                        const type = t.trim();
                        let r = false;
                        try {
                            r = types[type](pk);
                        } catch (e) {
                            console.log('%c' + `${pk}/${type} => ${e}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                        }
                        return r;
                    });
                } else if (Object.keys(types).indexOf(searcher.type) > -1) {
                    return types[searcher.type];
                } else {
                    throw `Unsupported type '${searcher.type}'`;
                }
            };

            const drawNoBet = ($root, target) => {
                let $el = $([]);
                const idx = target === 'HOME' ? '0' : '1';
                $el = $root.find(`span.gl-ParticipantBorderless_Name:eq(${idx})`);

                if ($el.length === 1) {
                    onSuccess($el.closest(pSel('div.gl-Participant_General')));
                }
            }

            const letsFind = async function () {
                const findBet = async function () {
                    await searchers.forEachAsyncBreakable(async (searcher) => {
                        // Super root
                        // Root
                        await searcher.roots.forEachAsyncBreakable(async (root) => {
                            await delayPromise(50);
                            const filterOp = 'textEqualsI';
                            const rootSelectors = [
                                `div.gl-MarketGroup:has(div[class$="sc-MarketGroupButtonWithStats_Text "]:${filterOp}("${root}")):visible`,
                                `div[class$="gl-MarketGroup "]:has(div[class$="cm-MarketGroupWithIconsButton_Text "]:${filterOp}("${root}")):visible`,
                                `div[class$="MarketGroup "]:has(div[class$="MarketGroupButton_Text "]:${filterOp}("${root}")):visible`,
                                `div[class$="MarketGroup "]:has(span[class$="MarketGroupButton_Text "]:${filterOp}("${root}")):visible`,
                            ];
                            const openMarket = dt.type === 'PREMATCH' ? 'div.gl-MarketGroup_Open' : 'div.sip-MarketGroup_Open';
                            const openMarketBtn = dt.type === 'PREMATCH' ? 'div:first' : 'sip-MarketGroupButton ';
                            let $root = $(findSel(rootSelectors));
                            dLog('', '365', `$root.length = ${$root.length} for root: '${root}'`);
                            console.log('ROOT ', $root);
                            if ($root.length === 0) {
                                return;
                            } else if ($root.length > 1) {
                                throw `Wrong root length (${$root.length}) for ${root}`;
                            }
                            //expand market-tab
                            if ($root.find(openMarket).length === 0) {
                                await dClick($root.find(openMarketBtn)[0], true);
                                await delayPromise(1777);                               
                                //redeclare root
                                $root = $(findSel(rootSelectors));
                            }

                            if (dt.sport === 'BASKETBALL' && dt.type === 'PREMATCH') {
                                const basketballTab = [dt.time_value.indexOf('FULL') > -1 ? 'Match' : dt.time_value === 'HALF_1' ? '1st Half' :
                                    ['1st', '2nd', '3rd', '4th'][parseInt(tDigit) - 1] + (dt.type === 'PREMATCH' ? ' Quarter' : ' Quarter Lines')];

                                await dClick($root.find(`div.bbl-TabSwitcherItem_TabText:textEqualsI("${basketballTab}")`)[0], true);
                                await delayPromise(1222);

                                if ($root.find('div:textEquals("Show more")').length > 0) {
                                    await dClick($root.find('div:textEquals("Show more")')[0], true);
                                    await delayPromise(1777);
                                }
                            }

                            if(dt.sport === 'FOOTBALL' 
                                && dt.market === 'HDP'
                                && dt.pivot === '0'
                                && `${root}` === 'draw no bet'
                            ) {
                                drawNoBet($root, dt.target);
                            } else {
                                searcher.pivots.some(pks => pks.some(pk => findPivot(searcher, $root)(pk)));
                            }
    
                            if (globalFound) {
                                return false;
                            }
                        });
                        if (globalFound) {
                            return false;
                        }
                    });
                }

                await findBet();

                if (!globalFound && thirdHDPCheck) {
                    throw 'LOW_COEF';
                } else if (!globalFound) {
                    if (data.sport === 'FOOTBALL'
                        && (data.market === 'HDP' || data.market === 'TOTAL')
                    ) {
                        const AL = findSel(['div.ipe-GridHeaderTabLink:visible > div:textEquals("Asian Lines"):first', 
                            'div.sph-MarketGroupNavBarButton:textEquals("Asian Lines")']);

                        if (AL) {
                            await dClick($(AL)[0]);
                            await delayPromise(2555);
                            await findBet();
                        }

                        if (!globalFound) {
                            throw `Final: ${data.sport}/${data.time_value}/${data.market}/${data.target}/${data.pivot} not found :(`;
                        }
                    } else {
                        throw `Final: ${data.sport}/${data.time_value}/${data.market}/${data.target}/${data.pivot} not found :(`;
                    }
                }
            };

            (async () => {
                let error = '';
                let counter = 0;
                const maxCounter = typeof (testMode) !== 'undefined' ? 1 : 20;
                while (!globalFound && counter < maxCounter && (error === '')) {
                    await letsFind().catch(e => error = e);
                    counter++;
                    await delayPromise(100);
                }
                if (!globalFound) {
                    onReject(`${counter}: ${error} - no luck :(`);
                }
            })()
                .catch(e => onReject(e));
            //#-#-FINISH
        });
    };

    const checkCoef = async (data, localCoef) => {
        const sourceCoef = parseFloat(data.coef);
        const maxExceed = (data.sport === 'CYBERSPORT' ? 2.6 : 2.6) + 0.05;
        const delta = sourceCoef - localCoef;
        console.log('%c' + `${sourceCoef} - ${localCoef} = ${delta}`,
            'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        if (delta > 0.055) {
            throw `LOW_COEF ${sourceCoef} > ${localCoef}`;
        } else if (Math.abs(delta) > maxExceed) {
            throw `Coef TOO BIG: ${sourceCoef} < ${localCoef}`;
        } else {
            return 'Coefs fine!';
        }
    };

    const checkCoefs = async (data) => {
        await delayPromise(300);
        const findInData = match => data.find(v => {
            const localMatch = `${v.team1} v ${v.team2}`.toLowerCase();
            return localMatch === match.toLowerCase()
                || locutus_similar_text(localMatch, match.toLowerCase(), true) > 60;
        });
        const
            $coupons = await waitForElement(couponRowSel,
                30, 1000, false, 1, 'No coupons!'),
            exprCoef = decOdds($('div[class$="MultipleHeader_OddsContainer "]').trt()),
            singleCoef = decOdds($('span[class*="OddsDropdownLabel"]').trt()),
            sourceCoef = parseFloat(data[0].coef),
            maxExceed = (data[0].sport === 'CYBERSPORT' ? 2.6 : 2.6) + 0.05;
        if (isNaN(sourceCoef) || sourceCoef < 1) {
            return 'Coefs fine, cuz not checked!';
        }
        if (data.length === 1 && settings.newExpresses === true) {
            $coupons = $coupons.last();
        }
        let
            errors = [],
            totalCoef = 1,
            checked = 0;
        if (!isNaN(exprCoef) && exprCoef > 0) {
            totalCoef = exprCoef;
            checked = data.length;
        } else if (!isNaN(singleCoef) && singleCoef > 0) {
            totalCoef = singleCoef;
            checked = data.length;
        } else {
            let multiple = $('div.qbs-NormalBetItem_Wrapper').length > 1;
            await $coupons.eachAsync(async function () {
                checked++;
                const
                    $this = $(this),
                    matchSection = [
                        'div.bss-NormalBetItem_BottomSection', 'div.qbs-NormalBetItem_BottomSection',
                        'div.lqb-NormalBetItem_BottomSection', ''],
                    coefSection = multiple
                        ? ['div.bss-NormalBetItem_OddsContainer']
                        : ['span.bs-OddsLabel', 'span.lbl-OddsLabel'],
                    $matchJq = await waitForElement(matchSection,
                        30, 4000, false, 1, 'Match section'),
                    match = $matchJq.trt().toLowerCase();
                if (!match) {
                    throw `Cant get match: ${$coupons.length}/${bkHere}/${multiple}`;
                }
                if ($this.parent().hasClass('suspended')) {
                    errors.push(match + ' LOW_COEF, market unavailable!');
                }
                const
                    localCoefFunc = () => decOdds(
                        $(`${findSel(couponRowSel)} ${findSelIn(coefSection, $this)}`).trt()
                    ),
                    localCoefIs = await waitForCondition(() => !isNaN(localCoefFunc()),
                        10, 5000, 'No coef!'),
                    localCoef = localCoefFunc(),
                    localData = findInData(match);
                totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
                if (!localData || isNaN(localCoef)) {
                    errors.push(`${match} LOW_COEF - wrong match or localCoef (${localCoef})!`);
                }
            });
        }
        if (errors.length === 0 && checked === data.length) {
            const delta = sourceCoef - totalCoef;
            console.log('%c' + `${sourceCoef} - ${totalCoef} = ${delta}`,
                'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            if (delta > 0.055) {
                throw `LOW_COEF ${sourceCoef} > ${totalCoef}`;
            } else if (Math.abs(delta) > maxExceed) {
                throw `Coef TOO BIG: ${sourceCoef} < ${totalCoef}`;
            } else {
                return 'Coefs fine!';
            }
        } else {
            throw errors.join('; ') + (checked !== data.length ? ' some stakes not checked ('
                + checked + '/' + data.length + ')!' : '');
        }
    };

    const register = () => new Promise((onSuccess, onReject) => {
        onReject('Not supported in bet365');
    });

    const updateBalance = () => {
        const aIcon = '.hm-MembersInfoButton_AccountIcon';
        if ($(aIcon).length === 1) {
            dClick($(aIcon)[0])
                .then(delayFunction(200))
                .then(waitForElementF('.hm-BalanceDropDown_RefreshBalance', 333, 10000))
                .then($el => dClick($el[0]))
                .then(delayFunction(1500))
                .then(() => dClick($(aIcon)[0]));
        }
    };

    const authCheck = () => {
        (async () => {
            if (!busy && Date.now() - loaded > settings.restartEvery) {
                dLog('bigred', '365', 'RELOAD 1');
                window.location.reload();
            }
            if (Date.now() - stopAuthStart < settings.stopAuthInterval) {
                return;
            } else if (stopAuthStart > 0 && Date.now() - stopAuthStart >= settings.stopAuthInterval) {
                port.postMessage({
                    m: "authorized!",
                    balance: balance
                });
                dLog('bigred', '365', 'RELOAD 2');
                window.location.reload();
            }
            $('div.lv-LiveVideoModule-3').remove();
            const needReload = ['div.bs-GeneralErrorMessage_Remove', 'div.bs-PlaceBetErrorMessage_Remove',]
            if (findSel(needReload)) {
                dLog('bigred', '365', 'RELOAD 3');
                window.location.reload();
            }
            await closeAllWeNeed({
                '#remindLater': '#remindLater',
                'div.ccm-CookieConsentPopup_Accept': 'div.ccm-CookieConsentPopup_Accept',
                'div.iip-IntroductoryPopup_Cross': 'div.iip-IntroductoryPopup_Cross',
                '#ActivatedEmailAddress': '#ActivatedEmailAddress',
                '#Continue': '#Continue',
                'div.pm-MessageOverlayCloseButton': 'div.pm-MessageOverlayCloseButton',
                'div.pm-FreeBetsPushGraphicCloseButton': 'div.pm-FreeBetsPushGraphicCloseButton',
                '#RemindMeLater': '#RemindMeLater',
                '.wl-PushTargetedMessageOverlay_CloseButton': '.wl-PushTargetedMessageOverlay_CloseButton',
                'div[class*="ClosableTabViewContainer"]:visible': 'div.lv-ClosableTabView_Button',
                'div.eba-AdvertWindow_NotNowBtnText': 'div.eba-AdvertWindow_NotNowBtnText',
                'div.pm-PushTargetedMessageOverlay_CloseButton': 'div.pm-PushTargetedMessageOverlay_CloseButton',
                'div.alm-ActivityLimitStayButton:textEquals("Remain Logged In")': 'div.alm-ActivityLimitStayButton:textEquals("Remain Logged In")',
                'div.llm-LastLoginModule_Button:textEquals("Continue")': 'div.llm-LastLoginModule_Button:textEquals("Continue")',
                'div[class*="GameContainer_CloseButton"]': 'div[class*="GameContainer_CloseButton"]',
                'div.alm-InactivityAlertRemainButton': 'div.alm-InactivityAlertRemainButton',
            }, true);
            if (document.location.href.indexOf('https://members.') > -1) {
                return 'Members area!';
            }
            const balance = getBalance(true);
            if (enterError === true) {
                port.postMessage({
                    answered: "auth_error",
                    status: "ERROR",
                });
                bsError(port, 'ERROR AUTH!');
                dLog('bigred', '365', 'RELOAD 4');
                window.location.reload();
            } else if (($('div.lms-StandardLogin_Container').length > 0 || balance === 'null') && !doNotLogin) {
                wasAuthCheck = false;
                port.postMessage({m: "tech works! 2"});
                await tryToLogin();
            } else {
                if (!doNotCloseAnything) {
                    await switchLanguage();
                }
                await bMess('WeWereLogged').set(true);

                if (settings.newExpresses && !busy) {
                    const WasSuccessExpressNew = await bMess('WasSuccessExpressNew').infinite().catch(() => 0);
                    await waitForElement('div.ovm-Fixture_Container',
                        333, 12222);

                    if (WasSuccessExpressNew && $(findSel(couponRowSel)).length === 0) {
                        await bMess('WasSuccessExpressNew').remove();
                    }

                    if (!WasSuccessExpressNew) {
                        dLog('green', 'B365', 'START find NewExpress event!');
                        // clear coupons
                        if ($(findSel(couponRowSel)).length > 0) {
                            await closePreviousCoupons(true);
                        }

                        busy = true;
                        await ProccedExpressNew().catch((e) => {
                            dLog('red', 'B365', 'ProccedExpressNew Error - ' + e);
                            bMess('WasSuccessExpressNew').set(false).finally();
                        }).then(() => busy = false);
                    }
                }

                port.postMessage({
                    m: "authorized!",
                    balance: balance
                });
                weAreLogged = true;
            }
        })()
            .catch(e => bsError(port, `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    /**
     * Switch language
     */
    const switchLanguage = async () => {
        const $sportHeader = await waitForElementO(
            {s: 'div.hm-ProductHeaderWide_ScrollContainer', i: 300, m: 20000, e: 'ScrollContainer'}
        );
        if ($sportHeader.find('div.hm-ProductHeaderWide_Link div.hm-HeaderMenuItem_Link:textEquals("Спорт")').length > 0) {
            const $elIcon = await waitForElementO(
                {s: 'div.hm-MainHeaderMembersWide_MembersMenuIcon', i: 300, m: 10000, e: 'MembersMenuIcon'}
            );
            await dClick($elIcon[0]);
            await delayPromise(1888);
            await dClick($('div.um-PreferencesTabButton')[0]);
            await delayPromise(1888);
            await dClick($('div.um-MembersInfoPreferences_Language')[0]);
            await delayPromise(1888);
            await dClick($('div.um-PreferenceDropDownItem:textEquals("English")')[0]);
        }
    };

    const tryToLogin = async () => {
        if (document.location.href.indexOf('.es/') > -1
            && await bMess('WeWereLogged').check().catch(() => false)) {
            if (!logOutSent) {
                dLog('', '365', 'We were logged!');
                port.postMessage({
                    m: "B365ES logout!",
                });
                logOutSent = true;
            }
            return;
        }
        const wasLogin = await bMess('B365_WAS_LOGIN')
            .check(settings.stopAuthInterval).catch(e => null);
        if (wasLogin) {
            // Hint: to skip for debug purposes
            // await bMess('B365_WAS_LOGIN').remove();
            dLog('', 'B365', `Too soon: ${(Date.now() - wasLogin)} < ${settings.stopAuthInterval}`);
            return;
        } else if (!!!settings.login || !!!settings.password) {
            dLog('', 'B365', `No login (${settings.login}) or password (${settings.login})!`);
            return;
        } else {
            dLog('', 'B365',
                `There is no login attempts logged (since ${settings.stopAuthInterval})!`);
        }
        const logIn = findSel(['div[class*="RHSLoggedOutWide_LoginContainer"]', 'div[class$="_Login "]']);
        if ($(logIn).length > 0 && elementIsVisible($(logIn)[0])) {
            await dClick($(logIn)[0]);
            await delayPromise(1000);
        } else {
            dLog('', 'B365', `Login not visible!`);
            return;
        }
        const controls = {
            login: 'input.lms-StandardLogin_Username:visible',
            password: 'input.lms-StandardLogin_Password:visible',
            submit: 'div.lms-LoginButton_Text:visible'
        };
        if (authClicked > 3) {
            limited = true;
        } else {
            await waitForCondition(() => Object.keys(controls).every(k => $(controls[k]).length > 0),
                333, 10000, 'No controls!');
            if ($(controls.login).val() !== settings.login) {
                await dClick($(controls.login)[0]);
                await delayPromise(1000);
                await clearAndSimulateD($(controls.login)[0], settings.login, 250);
            }
            await delayPromise(1000);
            await dClick($(controls.password)[0]);
            await delayPromise(1000);
            await clearAndSimulateD($(controls.password)[0], settings.password, 250);
            await delayPromise(1000);
            await bMess('B365_WAS_LOGIN').set(Date.now());
            dLog('red', '365', 'We have set B365_WAS_LOGIN');
            port.postMessage({m: "auth clicked!"});
            await dClick($(controls.submit)[0]);
            //await dType($(controls.submit)[0], '', true);

            const $errorMessage = await waitForElement('div.lmd-LoginModuleDefault_FailedLogin',
                333, 5222).catch(() => $([]));
            if ($errorMessage.length > 0) {
                enterError = true;
            }

            authClicked++;
            dLog('red', 'B365', `Auth clicked ${authClicked}! B365_WAS_LOGIN was set!`);
            logOutSent = false;
        }
    };

    const openBetslip = async (noDelay) => {
        const bsmSel = findSel([
                'div.lbs-StandardBetslip_ContentWrapper:visible',
                'div.bss-StandardBetslip_ContentWrapper:visible',
            ]),
            hSel = findSel(['div.bss-StandardHeader', 'div.lbs-StandardHeader ']),
            standart = 'div.lbs-StandardBetslip';

        if ($(standart).length > 0 && $(hSel).length > 0) {
            await dClick($(standart)[0]);
            dLog('b365', 'orange', 'Betslip standart opened!');
            return true;
        } else if ($(bsmSel).length === 0 || $(hSel).length === 0) {
            throw 'No betslip!';
        } else if ($(bsmSel).length > 0 && parseInt($(bsmSel).css('z-index')) < 70) {
            const defContent = findSel(['div.lbs-DefaultContent', 'div.bss-DefaultContent']);
            await dClick($(bsmSel).find(defContent)[0]);
            if (!noDelay) {
                await delayPromise(1000);
            }
            dLog('b365', 'orange', 'Betslip opened!');
            return true;
        } else {
            return true;
        }
    };

    const closePreviousCoupons = async (sp) => {
        if (settings.newExpresses === true && sp === false) {
            if ($(findSel(couponRowSel)).length > 1) {
                if ($('span.bss-OtherMultiplesButton_Text:textEquals("Show Selections"):visible').length > 0) {
                    await dClick($('span.bss-OtherMultiplesButton_Text:textEquals("Show Selections"):visible')[0]);
                    await delayPromise(1111);
                }

                await dClick($(findSel(couponRowSel)).eq(1).find('div.bss-RemoveButton')[0]);
                await delayPromise(1111);
            }
        } else {
            await closePreviousCouponsInside(sp);
            if (!sp) {
                await delayPromise(2000);
                await closePreviousCouponsInside();
            }
        }
    };

    const closePreviousCouponsInside = async (skipParam) => {
        if (skipParam) {
            return 'Skipped!';
        }
        const
            delMouseOver = ['div[class*="DeleteButton_MouseOver"]',
                'div.lbl-DeleteButton_DeleteIcon', 'div.bss-RemoveButton:visible'],
            betMinimizedSel = ['div[class*="NormalBetItem_Wrapper"] span[class*="NormalBetItem_IndicationMessage"]:visible',],
            bmTandM = ['div[class*="NormalBetItem_Wrapper"] div[class*="NormalBetItem_TitleAndMarket"]',],
            hasInPlay = ['div[class*="StandardBetslip_HasInPlayBet"] div[class*="-DefaultContent"]:visible',],
            closeSel = ['div[class*="ControlBar_RemoveAll"]:visible'],
            cancelBtn = 'span.lqb-NormalBetItem_IndicationMessage:textEquals("Cancel"):visible',
            removeBtn = ['div[class$="NormalBetItem_Remove"]'],
            showButton = ['div[class*="EditButton"]:textEquals("Show Options"):visible'];
        if ($(findSel(hasInPlay)).length > 0) {
            await dClick($(findSel(hasInPlay))[0]);
            await delayPromise(500);
            if ($(findSel(closeSel)).length > 0) {
                await dClick($(findSel(closeSel))[0], false, 'Close sel');
                await delayPromise(1500);
                return 'Closed!';
            } else {
                throw 'No close button!';
            }
        } else if ($(cancelBtn).length > 0) {
            await dClick($(cancelBtn)[0]);
            await delayPromise(500);
        } else if ($(findSel(delMouseOver)).length > 0) {
            if (elementIsVisible($(findSel(delMouseOver))[0])) {
                await dClick($(findSel(delMouseOver))[0]);
            } else {
                await dClickOffsetX($(findSel(delMouseOver))[0], 50);
            }
            await delayPromise(500);
        } else if ($(findSel(betMinimizedSel)).length > 0) {
            //bs-DeleteButton_
            await delayPromise(500);
            if ($(findSel(betMinimizedSel)).length > 0) {
                await dClick($(findSel(betMinimizedSel)).last()[0]);
            } else {
                let attempts = 0, closed = false;
                while (attempts < 5) {
                    attempts++;
                    if ($(findSel(delMouseOver)).length > 0) {
                        await delayPromise(300);
                        await dClick($(findSel(delMouseOver))[0]);
                        closed = true;
                        break;
                    } else {
                        await dClick($(findSel(bmTandM))[0]);
                        await delayPromise(300);
                    }
                }
                if (!closed) {
                    throw `Can't click close ${attempts} times!`;
                }
            }
            await delayPromise(500);
            return true;
        } else {
            const bs = await openBetslip().catch(() => false);
            if (!bs) {
                return 'No betslip 1!';
            }
            if (!elementIsVisible(
                $(findSel(['div.bss-StandardBetslip:visible', 'div.lbs-StandardBetslip']))[0])) {
                return 'No betslip 2!';
            }
            if (findSel(showButton)) {
                await dClick($(findSel(showButton))[0], false, 'showButton');
                await delayPromise(500);
            }
            if ($(findSel(closeSel)).length > 0 && elementIsVisible($(findSel(closeSel))[0])) {
                await dClick($(findSel(closeSel))[0], false, 'Close sel');
                await delayPromise(500);
                return 'Closed!';
            } else if (findSel(removeBtn)) {
                await dClick($(findSel(removeBtn))[0], false, 'removeBtn');
                await delayPromise(500);
            } else {
                throw 'No close button!';
            }
        }
    };

    const getBalance = returnNull => {
        const $b = $('.hm-Balance');
        if ($b.length > 0) {
            const bText = $b.trt();
            return bText.indexOf('RS.') > -1
                ? parseFloat(bText.replace('RS.', '').replace(/[^\d.]/g, '').trim())
                : parseFloat(bText.replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        waitForCondition(() => canContinue, 100, 3000).then(() => afterDOMLoadedDo());
    }

    function afterDOMLoadedDo() {
        (async () => {
            const currentCommand = await bMess('BET_365').check(40000);
            dLog('orange', 'b365', `ADL (${(window.self === window.top)}):`
                + ` ${currentCommand.action} at ${document.location.href}${document.location.href}`);
            if (window.self !== window.top
                && (['WITHDRAW'].indexOf(currentCommand.action) > -1
                    || ['BET_RESULT'].indexOf(currentCommand.action) > -1)
                && (document.location.href.toLowerCase().indexOf('/members/services/host') > -1
                    || checkUrls.some(c => document.location.href.toLowerCase().indexOf(`members.${c}.`) > -1))) {
                if (currentCommand && currentCommand.action && currentCommand.action !== 'BET_RESULT') {
                    port = chrome.runtime.connect({name: `port_${bkHere}`});
                    dLog('bigred', 'b365', 'Port was set in the frame!');
                }
                dLog('blue', '365', ['Restoring with0: ', currentCommand]);
                messageProcessor(currentCommand, false);
            } else if (window.self === window.top) {
                await waitForCondition(() => typeof wasAuthCheck === 'boolean' && wasAuthCheck, 333, 60000, 'No auth check!');
                dLog('blue', '365', ['Restoring with1: ', currentCommand]);
                messageProcessor(currentCommand, false);
            }
        })()
            .catch(e => dLog('orange', 'b365', `${e} (${(window.self === window.top)}):`
                + ` ${currentCommand.action} at ${document.location.href}${document.location.href}`));
        if (window.self === window.top) {
            port.postMessage({m: "PAGE LOADED!"});
            waitForElementO({s: 'div.bl-Preloader_Spinner', i: 333, m: 3000, e: 'Preloader_Spinner'})
                .then(delayFunction(30000))
                .then(() => {
                    if ($('div.bl-Preloader_Spinner').length > 0) {
                        dLog('bigred', '365', 'RELOAD 5');
                        document.location.reload()
                    }
                })
                .catch(e => dLog('', '365', `no Spinner! ${e}`));
        } else {
            if ($('div.modal-title:contains("You are currently unable to log in")').length > 0 &&
                $('div.modal-body:contains("reached the maximum number of")').length > 0) {
                $('button#ok');
            }
            (async () => {
                const $notActivateEmail = await waitForElement('#notActivateEmail', 300, 4444)
                    .catch(() => $([]));
                await closeAllWeNeed({
                    '#remindLater': '#remindLater',
                    '#ActivatedEmailAddress': '#ActivatedEmailAddress',
                    '#Continue': '#Continue',
                    '#rcc-btn-keep-current-setting': '#rcc-btn-keep-current-setting',
                    '#KeepCurrentLimitsButton': '#KeepCurrentLimitsButton',
                    '#RemindMeLater': '#RemindMeLater',
                }, true);
            })()
                .catch(e => e);
            (async () => {
                const termsCheck = '#TermsAndConditionsAndPrivacyPolicyAcceptance:visible';
                if ($(termsCheck).length > 0) {
                    await dClick($(termsCheck)[0]);
                    await delayPromise(3000);
                    await dClick($('#termsAndConditionsAndPrivacyPolicy button.accept-button')[0]);
                }
            })().then(() => waitForElement('#continue', 333, 30000, true))
                .then($el => delayPromise(3333, $el))
                .then($el => dClick($el[0]))
                .catch(e => e);
            (async () => {
                while (true) {
                    await delayPromise(10000);
                    const $casino = $('div[class*="GameContainer_CloseButton"]');
                    if ($casino && $casino.length > 0) {
                        await dClick($casino[0]);
                    }
                    const $noThanks = $getIFrame('#MembersHostFrame')
                        .find('a[id$="_NoThanks"]');
                    if ($noThanks && $noThanks.length > 0) {
                        await dClick($noThanks[0]);
                    }
                    const $vc = $('#ViewResponsibleGamblingControls');
                    if ($vc && $vc.length > 0) {
                        await dClick($vc[0]);
                    }
                    const $rm = $('#ReadMessage');
                    if ($rm && $rm.length > 0) {
                        await dClick($rm[0]);
                    }
                    const $rl = $('#RemindMeLater');
                    if ($rl && $rl.length > 0) {
                        await dClick($rl[0]);
                    }
                }
            })().catch(e => e);
        }
    }

    waitForCondition(() => canContinue, 100, 3000).then(() => {
        addEventListener("unload", () => {
            if (ourCommand.isSet()) {
                bsDebug(port, 'Command was set till unload:', ourCommand.get());
                bMess('BET_365').set(ourCommand.get(), increaseDelay ? 150000 : 0);
            }
        }, true);

        if (port.onMessage) {
            port.onMessage.addListener(function (message) {
                messageProcessor(message, true);
            });
        }
        console.log('%c' + '-= LOADED =-', 'background: red; color: white; font-size: 20px; font-weight: bold; padding: 30px;');
    });

})();
