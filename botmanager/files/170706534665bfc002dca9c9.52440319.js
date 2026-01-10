(function () {

    "use strict";

    if (window.self !== window.top) {
        return;
    }

    const extendedDebugging = false;
    let enterError = false;
    let newAPI = false;
    let needStop = false;
    let currency = '';
    let lastSMS = '';
    let authClicked = 0;
    let busy = false;
    const bkHere = window.location.href.indexOf('.fon.bet') > -1 ? 'fonru'
        : window.location.href.indexOf('fonbet.by') > -1 ? 'fonbetby'
            : window.location.href.indexOf('baterybet.in') > -1 ? 'fonbetgr'
                : window.location.href.indexOf('paribet.ru') > -1 ? 'paribet'
                    : 'fonbetkz';
    const bkHereBig = ({
        'fonru': 'FON.RU',
        'fonbetby': 'FONBET.BY',
        'fonbetgr': 'FONBET.GR',
        'paribet': 'PARIBET',
        'fonbetkz': 'FONBET.KZ',
    })[bkHere] || 'FONBET';
    let port = chrome.runtime.connect({name: `port_${bkHere}`});
    let settings = {
        checkFootball: false,
        waitForFootbalInterval: 60000,
        authCheckInterval: 2000,
        alwaysClosePreviousCoupon: false,
        delayGetMax: 990,
        maxWaitForBetStatus: 50000,
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 3,
        betweenBets: 25000,
        newExpresses: false,
    };
    let currentBetData = {};

    let ourCommand = new ourCommandProto();

    let smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);

    let messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;
        if (newAPI) {
            bsLogger('blue', 'FONRU', 'We are using new API!');
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
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            settings.newExpresses = !!(settings?.stake_fork && settings.stake_fork?.newExpresses);
            authCheck();
        } else if (message.action === "takeScreenshot") {
            screenshotHelper(port, 'fon', ['tr.table__row._type_details:visible', 'section.table__inner'], message.data);
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
        } else if (message.action === 'MAXIMUM') {
            busy = true;
            getMax(message.data);
        } else if (message.action === 'BET_RESULT') {
            collectBetResult(message);
        } else if (['DEPOSIT', 'WITHDRAW', 'CHECK_PAYMENTS', 'MONITOR'].indexOf(message.action) > -1) {
            busy = true;
            ourCommand.set(message);
            ({
                'DEPOSIT': deposit,
                'WITHDRAW': withdraw,
                'CHECK_PAYMENTS': checkPayments,
                'MONITOR': monitor
            }[message.action])(message.data)
                .then(() => bsDebug(port, 'It\'s looks like ' + message.action + ' done!'))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(() => delayPromise(990))
                .then(() => delayPromise(990))
                .then(() => delayPromise(990))
                .then(() => delayPromise(990))
                .then(() => delayPromise(990))
                .then(() => delayPromise(990))
                .then(() => delayPromise(990))
                .then(() => {
                    busy = false;
                    ourCommand.clear();
                    return mouseChain({
                        target: $('a.menu__link[href^="/live"]')[0],
                        events: ['click'],
                        scroll: true
                    });
                });
        } else if (['READY_TO_BET', 'ARB_BET'].indexOf(message.action) > -1) {
            busy = true;
            ourCommand.set(message);
            proceedSpecialBet(message)
                .then(() => bsDebug(port, 'It\'s looks like ' + message.action + ' done!'))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .finally(() => {
                    busy = false;
                    ourCommand.clear();
                    bsDebug(port, 'Command was cleared!');
                });
        }
    };

    const monitor = (data) => new Promise((onSuccess, onReject) => {
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
        const getOdds = (name, node, parentResult) => {
            if (node instanceof Element) {
                const odd = parseFloat(node.innerText);
                parentResult[name] = isNaN(odd) ? 0 : odd;
            } else if (typeof node === 'object') {
                parentResult[name] = {};
                Object.keys(node).forEach(key => getOdds(key, node[key], parentResult[name]));
            } else if (typeof node === 'boolean') {
                parentResult[name] = {};
            } else {
                console.log('%c' + `Strange node: ${name} = '${JSON.stringify(node)}'`,
                    'background: red; color: white; font-size: 12px; font-weight: normal; padding: 3px;');
            }
        };
        const scanMarkets = (data) => new Promise((onSuccess, onReject) => {
            const resultDraft = {}, result = {};
            findEvent(data)
                .then(fsRes => getMarkets(fsRes.matchedEvent.element, fsRes.halfEvent, fsRes.cornersEvent))
                //.then(markets => Object.keys(markets).forEach(root => getOdds(root, markets[root], result)))
                .then(markets => getOdds('markets', markets, resultDraft))
                .then(() => {
                    result['HALF_TIME'] = JSON.parse(JSON.stringify(resultDraft['markets']['half']));
                    delete resultDraft['markets']['half'];
                    result['FULL_TIME'] = JSON.parse(JSON.stringify(resultDraft['markets']));
                    ['TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'CORNER_TOTAL'].forEach(m => {
                        if (typeof result['FULL_TIME'][m] === 'object') {
                            const nm = {'OVER': {}, 'UNDER': {}};
                            Object.keys(result['FULL_TIME'][m]).forEach(p => ['OVER', 'UNDER'].forEach(
                                t => result['FULL_TIME'][m][p][t] ? nm[t][parseFloat(p)] = result['FULL_TIME'][m][p][t] : 1
                            ));
                            result['FULL_TIME'][m] = JSON.parse(JSON.stringify(nm));
                        }
                    });
                })
                .then(() => console.log(result))
                .then(() => onSuccess(result))
                .catch(e => onReject(`Event error: ${e}`));
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
                    console.log(`Scan performed after %c${startedAfter}%cs in %c${scanPerformed}%cs`,
                        'font-weight: bold; background: yellow; font-size: 13px;', '', 'font-weight: bold; background: yellow; font-size: 13px;', '');
                    previousScan = Date.now();
                    //console.profileEnd('Suspicious');
                    counter++;
                    if (needStop) { //} || counter >= 10) {
                        throw needStop ? 'Stopped by NEED_STOP 2!' : `We reach ${counter}`;
                    }
                })
                .then(waitForNotConditionF(() => needStop, 333, scanInterval, 'NEED_STOP occurred!'))
                .then(scan)
                .catch(e => report('FINISHED', e));
        };
        const expandedSelector = 'td._state_expanded';
        if ($(expandedSelector).length > 0) {
            const closeOne = async () => {
                await mouseChain({
                    target: $(expandedSelector).eq(0).find('span')[0],
                    events: ['click'],
                    scroll: true
                });
                await delayPromise(500);
                if ($(expandedSelector).length > 0) {
                    await closeOne();
                }
            };
            closeOne()
                .finally(scan);
        } else {
            scan();
        }
    });

    const proceedSpecialBet = function (message) {
        bsDebug(port, 'proceedSpecialBet');
        let interval = typeof message.data[0].interval === 'undefined' ? 0 : parseInt(message.data[0].interval);
        let data = message.data;
        let maximum = 0;
        data[0].score = '';
        return new Promise(function (onSuccess, onReject) {
            let report = function (success, rMessage) {
                bsDebug(port, message.action + ' report: ' + success, message);
                if (message.action === 'ARB_BET' && success) {
                    port.postMessage({
                        answered: "BET",
                        data: {
                            "external_id": '',
                            "status": 'ACCEPTED',
                            "market": data[0].market,
                            "target": data[0].target,
                            "pivot": data[0].pivot,
                            "coef": rMessage.coef,
                            "stake": rMessage.stake,
                            "maximum": maximum
                        },
                        answer: 'Everything is Okay!'
                    });
                } else if (message.action === 'ARB_BET') {
                    port.postMessage({
                        answered: "BET",
                        data: {
                            "external_id": '',
                            "status": 'FAILED',
                            "market": data[0].market,
                            "target": data[0].target,
                            "pivot": data[0].pivot,
                            "coef": data[0].coef,
                            "stake": data[0].stake,
                            "maximum": maximum
                        },
                        answer: rMessage
                    });
                }
                if (success) {
                    onSuccess(rMessage);
                } else {
                    onReject(rMessage);
                }
            };
            let balance = $('span.header__login-balance').last().text().replace(/[^\d\.]/g, '').trim();
            if (parseFloat(balance) < parseFloat(message.data[0].stake)) {
                report(false, "LOW_FUNDS: we have " + balance + ", we need: " + message.data[0].stake);
                return;
            }
            if (message.action === 'READY_TO_BET') {
                data[0].coef = 1;
                getMaxPromise(data)
                    .then((m) => {
                        maximum = m.max;
                        bsDebug(port, 'Max is: ' + maximum);
                    })
                    .then(() => report(true, 'It might be okay!'))
                    .catch((e) => report(false, 'Error stage 1: ' + e));
            } else if (message.action === 'ARB_BET') {
                let maxTime = Date.now() + interval * 1000;
                let waitForCoef = function () {
                    checkCouponAndCoefs(data)
                        .then((res) => {
                            proceedBet(data);
                            //report(true, {coef: res, stake: data[0].stake});
                            delayPromise(990)
                                .then(() => delayPromise(990))
                                .then(() => delayPromise(990))
                                .then(() => onSuccess('It must be done by proceedBet!'));
                        })
                        .catch((error) => {
                            if (error === 'WRONG_COUPON') {
                                report(false, 'Wrong coupon opened, it may be cuz of match is end, etc...');
                            } else if (Date.now() < maxTime) {
                                delayPromise(990).then(waitForCoef);
                            } else {
                                if (!isNaN(error) && typeof data[0].fall_coef !== 'undefined' && !isNaN(parseFloat(data[0].fall_coef))
                                    && error >= parseFloat(data[0].fall_coef)) {
                                    data[0].coef = data[0].fall_coef;
                                    proceedBet(data);
                                    delayPromise(990)
                                        .then(() => delayPromise(990))
                                        .then(() => delayPromise(990)).then(() => onSuccess('It must be done by proceedBet FALL_COEF!'));
                                } else {
                                    report(false, 'We had wait for ' + (Date.now() - (maxTime - interval * 1000))
                                        + 'ms and nothing :(');
                                }
                            }
                        });
                };
                if (interval < 0) {
                    report(false, 'Wrong interval: ' + interval);
                } else {
                    waitForCoef();
                }
            } else {
                report(false, 'Unsupported action: ' + message.action);
            }
        });
    };

    const checkCoupon = data => {
        dLog('green', 'Fon', [`checkCoupon - let's check data:`, data]);
        const errors = [];
        const findInData = evt => data.find(bet => [1, 2]
            .every(i => (console.log(bet, evt, bet[`team${i}`].length > 0, evt.indexOf(bet[`team${i}`].toLowerCase()) > -1),
            bet[`team${i}`].length > 0 && evt.indexOf(bet[`team${i}`].toLowerCase()) > -1)));
        let totalCoef = 1;
        let checked = 0;
        const couponsLink = bkHere === 'fonru' ? 'div[class^="new-coupon--"] tr[class^="stake-wide--"]'
            : 'div[class^="coupon-cart--"] tr[class^="coupon-cart-bet--"]';
        const $coupons = (data.length === 1 && settings.newExpresses === true) ? $(couponsLink).last() : $(couponsLink);
        $coupons.each(function () {
            const $this = $(this);
            const localCoef = bkHere === 'fonru' ? parseFloat($this.find('td[class^="column4-"] span[class^="v-current-"]').trt())
                : parseFloat($this.find('td:last').trt());
            const event = bkHere === 'fonru' ? $this.find('div[class^=event-data-]').trt()
                .replace($this.find('span[class^=bet-score-]').trt(), '').trim().toLowerCase()
                    : $this.find('td:eq(1)').trt().toLowerCase();
            const localData = findInData(event);
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if (!newAPI && localData && localData.coef !== '' && !isNaN(localCoef)) {
                let checkCoef = parseFloat(localData.coef);
                if (isNaN(checkCoef) || checkCoef > localCoef) {
                    errors.push(event + ' LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef);
                } else if (localCoef > checkCoef * 1.6) {
                    errors.push('Coef TOO BIG: ' + totalCoef + ' instead of ' + data[0].coef);
                }
                checked++;
            } else if (!localData || isNaN(localCoef)) {
                errors.push(`'${event}' LOW_COEF - wrong match or localCoef`);
                console.log('localData ', localData);
                console.log('localCoef ', localCoef);
                checked++;
            } else if (localData.coef === '' || newAPI) {
                checked++;
            }
        });
        if (!newAPI && errors.length === 0 && checked === data.length) {
            return 'Coefs fine!';
        } else if (newAPI && errors.length === 0 && checked === data.length) {
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
            if (totalCoef >= nCheck * 1.6) {
                throw 'Coef TOO BIG: ' + totalCoef + ' instead of ' + data[0].coef;
            } else if (totalCoef < nCheck) {
                throw 'LOW_COEF ' + data[0].coef + ' > ' + totalCoef;
            } else {
                return 'Coefs fine!';
            }
        } else {
            throw errors.join('; ') + (checked !== data.length ? ' some stakes not checked ('
                + checked + '/' + data.length + ')!' : '');
        }
    };

    const checkCouponAndCoefs = function (data) {
        return new Promise(function (onSuccess, onReject) {
            let realCheck = function () {
                let $dels = $('article[class^="coupon"]:first tbody[class^="coupon__table-body"]');
                let eventHere = res[0];
                let eventNeed = data[0].team1 + ' — ' + data[0].team2;
                let odd = parseFloat($('article[class^="coupon"]:first span[class^="coupon__table-stake"]').text().trim());
                if ($dels.length === 1 && (eventHere === eventNeed || locutus_similar_text(eventHere, eventNeed, true) > 80)) {
                    if (parseFloat(data[0].coef) > odd) {
                        console.log("Coef has low value, we need: " + data[0].coef + ", we have: " + odd);
                        onReject(odd);
                    } else {
                        onSuccess(odd);
                    }
                } else {
                    onReject('WRONG_COUPON');
                }
            };
            let res = /[A-Z].*/.exec($('article[class^="coupon"]:first td[class*="_type_info"] span:not([class])').text().trim());
            if (!res || typeof res[0] !== 'string') {
                onReject('WRONG_COUPON');
            } else {
                let $agree = $('article[class^="coupon"]:first a[class^="coupon__table-agree-btn"]');
                if ($agree.length > 0) {
                    mouseChain({target: $agree[0], events: ['click']})
                        .then(() => delayPromise(777))
                        .finally(realCheck);
                } else {
                    realCheck();
                }
            }
        });
    };

    const checkPayments = function () {
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
            let clickNwait = function ($el) {
                mouseChain({target: $el[0], events: ['click']})
                    .then(() => delayPromise(990))
                    .then(() => delayPromise(990))
                    .then(() => delayPromise(990))
                    .then(letsRockNRoll)
                    .catch((e) => report(false, 'clickNwait: ' + e));
            };
            let checkFilters = function () {
                return new Promise(function (onSuccess, onReject) {
                    let $filters = $('span.account-block__head-text:textEquals("Filters")').parent().next()
                        .find('input[type="checkbox"]');
                    $filters.last()[0].scrollIntoView(true);
                    let operate = function () {
                        let clicked = false;
                        $filters = $('span.account-block__head-text:textEquals("Filters")').parent().next()
                            .find('input[type="checkbox"]')
                            .each(function () {
                                let $this = $(this);
                                let text = $this.next().text().trim().toLowerCase();
                                let our = text.indexOf('deposit') > -1 || text.indexOf('withdrawal') > -1 || text.indexOf('payout') > -1;
                                if ((!$this.is(':checked') && our) || ($this.is(':checked') && !our)) {
                                    //bsDebug(port, text + ' = ' + our + ' / ' + $this.is(':checked'));
                                    clicked = true;
                                    mouseChain({target: $this[0], events: ['click'], scroll: true})
                                        .then(() => delayPromise(990))
                                        .then(() => delayPromise(990))
                                        .then(() => delayPromise(990))
                                        .then(() => delayPromise(990))
                                        .then(() => delayPromise(990))
                                        .then(() => delayPromise(990))
                                        .then(() => delayPromise(990))
                                        .then(() => delayPromise(990))
                                        .then(() => delayPromise(990))
                                        .then(() => delayPromise(990))
                                        .then(() => delayPromise(990))
                                        .then(() => delayPromise(990))
                                        .then(operate)
                                        .catch((e) => onReject('Filter click: ' + e));
                                    return false;
                                }
                            });
                        if (!clicked) {
                            onSuccess();
                        }
                    };
                    operate();
                })
            };
            let letsRockNRoll = function () {
                bsDebug(port, 'letsRockNRoll');
                if (document.location.href.indexOf('/account/history/operations') > -1) {
                    waitForElement('span.account-block__head-text:textEquals("Filters")')
                        .then(($el) => {
                            $el[0].scrollIntoView(true);
                            if (!$el.next().hasClass('_expanded')) {
                                return mouseChain({target: $el.next()[0], events: ['click']})
                            }
                        })
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(checkFilters)
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => {
                            $('a[href="#!/account/history/operations"]')[0].scrollIntoView();
                            collected = [];
                            $('div.operation-list__data div.wrap').each(function () {
                                let $this = $(this);
                                let desc = $this.find('div.column-3').text().trim() + ' ' + $this.find('div.column-4').text().trim();
                                let ch = $this.find('div.column-4').text().trim().toLowerCase();
                                collected.push({
                                    date: $this.find('div.column-1').text().trim() + ' ' + $this.find('div.column-2').text().trim(),
                                    description: desc,
                                    type: ch.indexOf('deposit') > -1 ? 'IN'
                                        : (ch.indexOf('withdrawal') > -1 || ch.indexOf('payout') > -1 ? 'OUT' : ''),
                                    paysystem: ch.indexOf('qiwi') > -1 ? 'QIWI' : (ch.indexOf('skrill') > -1 ? 'SKRILL' : ''),
                                    amount: $this.find('div.column-5').text().replace(/[^0-9\.]/g, '').trim(),
                                    success: true
                                });
                            });
                            report(true, 'All data collected!');
                        })
                        .catch((e) => report(false, 'Filters: ' + e));
                } else if (document.location.href.indexOf('/account/history/bets') > -1) {
                    waitForElement('a[href="#!/account/history/operations"]')
                        .then(($el) => {
                            if (!$el.hasClass('_state_active')) {
                                return mouseChain({target: $el[0], events: ['click']})
                            }
                        })
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(() => delayPromise(990))
                        .then(letsRockNRoll)
                        .catch((e) => report(false, 'Go to operations: ' + e));
                } else if (document.location.href.indexOf('/account/deposit') > -1) {
                    waitForElement('a[href="#!/account/history"]')
                        .then(($el) => clickNwait($el))
                        .catch((e) => report(false, 'Go to history: ' + e));
                } else {
                    clickNwait($('a[href="/#!/account/deposit"]'));
                }
            };
            letsRockNRoll();
        });
    };

    const withdraw = async data => {
        let needRelease = false;
        bsDebug(port, 'Withdraw!', data);
        const sendReport = (success, message) => {
            bsDebug(port, 'Report! ' + success + ' / ' + message);
            port.postMessage({
                answered: "WITHDRAW",
                status: success ? "SUCCESS" : "FAILED",
                answer: message
            });
            if (needRelease) {
                bsSendSmsApi(port, 'BIND_RELEASE', {
                    "websocket_uid": settings.uid,
                    "request_id": ourCommand.getAdded('sms_api_request_id')
                });
            }
        };
        return await (async () => {
            if (typeof settings.phone !== 'string' || settings.phone === ''
                || typeof settings.uid !== 'string' || settings.uid === '') {
                throw 'There is no phone or websocket_uid!';
            } else {
                await bsBindNumber(port, settings, smsApiMessage, ourCommand);
                needRelease = true;
            }
            const bSelector = 'form[class^="PaymentsForm"] button';
            await clickSequence([
                (new QueueObject('a[href="/account/deposit/"]', $el => document.location.href.indexOf('/account/payments/') === -1)),
                (new QueueObject('a[href="/account/payments/withdraw"]', $el => $el.attr('class').indexOf('active') === -1)),
                (new QueueObject('div[class^="Ps__itemBox"]:has(div[title="QIWI Wallet"])', $el => $el.attr('class').indexOf('selected') === -1)),
            ]);
            const $wText = await waitForElement('form[class^="PaymentsForm"] div[class^="PaymentsForm__headerText"]', 300, 30000);
            if ($wText.text().trim().substr(-4) !== data.login.substr(-4)) {
                throw `Wrong number, we need ${data.login}, we have ${$wText.text().trim()}, ${$wText.text().trim().substr(-4)} !== ${data.login.substr(-4)}`;
            }
            await clearAndSimulate($('form[class^="PaymentsForm"] input[data-fieldtype="amount"]')[0], data.amount);
            await delayPromise(990);
            await mouseChain({target: $(bSelector)[0], events: fullClick, error: 'Continue 1'});
            const $code = await waitForElement('input[data-fieldtype="code"]', 300, 15000);
            bsDebug(port, 'Awaiting for SMS');
            const code = await smsApiMessage.waitForSMSCode(['Fonbet', 'CUPIS'],
                (m) => {
                    dLog('orange', 'FoN', `sms: '${m}'`);
                    return (m.indexOf('Код') > -1 && m.indexOf('Номер счета:') > -1)
                        || (m.indexOf('Password') > -1 && m.indexOf('Account number:') > -1)
                        || (m.indexOf('Password') > -1)
                        || (m.indexOf('sword:') > -1)
                        || (m.indexOf('Kod:') > -1);
                },
                (m) => {
                    let r = m.match(/([0-9]+)/g);
                    return r && typeof r[0] === 'string' ? r[0] : '';
                }, 300000);
            await clearAndSimulate($code[0], code);
            await delayPromise(990);
            await mouseChain({target: $(bSelector)[0], events: fullClick, error: 'Continue 2'});
            await delayPromise(5000);
            const $alert = $('div[class^="Alert_"]:visible');
            if ($alert.length > 0) {
                throw $alert.text().trim();
            } else {
                sendReport(true, 'It should be okay!');
                return true;
            }
        })()
            .catch(e => sendReport(false, 'Withdraw: ' + e));
    };

    const deposit = async data => {
        dLog('green', 'Fon', ['Deposit!', data]);
        const sendReport = (success, message, wallet_balance) => {
            const report = {
                answered: "DEPOSIT",
                status: success ? 'SUCCESS' : ['NO_FUNDS', 'RESTRICTED'].find(t => message.indexOf(t) > -1) || 'FAILED',
                answer: message,
                balance: getBalance(),
                wallet_balance,
            };
            dLog('green', 'Fon', [`Report! ${success} / ${message} / ${wallet_balance}:`, report]);
            port.postMessage(report);
        };
        return await (async () => {
            await clickSequence([
                // (new QueueObject('div.header__login-item._type_account',
                //     () => document.location.href.indexOf('/account/deposit/') === -1)),
                (new QueueObject('a[href="/account/payments/"]', null, null, null,
                    null, true)),
                (new QueueObject('a[href="/account/deposit"]', null, null, null,
                    null, true)),
            ]);
            await delayPromise(3000);
            await clickSequence([new QueueObject('a[href="/account/payments"]',
                $el => !$el.hasClass('_active'))]);
            await delayPromise(3000);
            const $qiwi = $('div[title="QIWI Wallet"]').closest('div[class^="Ps__itemBox"]');
            if ($qiwi.attr('class').indexOf('style_selected') === -1) {
                await mouseChain({target: $qiwi[0], events: fullClick, error: '$qiwi'});
                await delayPromise(5000);
            }
            const $depText = await waitForElement('form[class^="PaymentsForm"] div[class^="PaymentsForm__headerText"]',
                300, 30000);
            if ($depText.trt().substr(-4) !== data.login.substr(-4)) {
                throw `Wrong number, we need ${data.login}, we have ${$depText.text().trim()}, ${$depText.text().trim().substr(-4)} !== ${data.login.substr(-4)}`;
            }
            await clearAndSimulate($('form[class^="PaymentsForm"] input[data-fieldtype="amount"]')[0], data.amount);
            await delayPromise(990);
            ourCommand.add('close', true);
            await bMess('QIWI_COMMAND', true).set(ourCommand.get());
            await mouseChain({
                target: $('form[class^="PaymentsForm"] button')[0],
                events: fullClick,
                error: 'Continue'
            });
            const depositResult = await bMess('DEPOSIT_RESULT', true).get(120000);
            dLog('green', 'Fon', ['DEPOSIT_RESULT:', depositResult]);
            if (typeof depositResult.success === 'boolean') {
                if (data.paysystem === 'SKRILL') {
                    chrome.storage.local.remove(['SKRILL_COMMAND', 'SKRILL_COMMAND_WAS_SET']);
                }
                const message = typeof depositResult.message === 'string' ? depositResult.message : 'No message :(';
                const wallet_balance = depositResult.balance ? parseFloat(depositResult.balance) : 0;
                sendReport(depositResult.success, message, wallet_balance > 0 ? wallet_balance - parseFloat(data.amount) : 0);
                return message;
            } else {
                throw `Wrong answer: ${JSON.stringify(depositResult)}`;
            }
        })()
            .catch(e => sendReport(false, `Deposit: ${e}, ${formatStack(e.stack)}`, 0));
    };

    const performScan = (message, limit) => {
        const ourAnswer = [];
        let counter = 0;
        let $coupons = $('div[class^="coupon-list--"] article[class^="coupon"]:visible');
        if ($coupons.length > 0) {
            $coupons.each(function () {
                let $coupon = $(this);
                let results = getCouponsDetails($coupon);
                //console.log(results.number, results.status);
                if (message.data.length === 0 || message.data.indexOf(results.number) > -1) {
                    if (limit !== 0 && counter >= limit) {
                        return false;
                    }
                    let cur = {external_id: results.number};
                    if (['Loss', 'Lost'].indexOf(results.status) > -1) {
                        cur.status = 'LOSE';
                    } else if (['Win', 'Winnings'].indexOf(results.status) > -1) {
                        cur.status = 'WON';
                    } else if (results.status === 'Bet placed') {
                        cur.status = 'ACCEPTED';
                    } else if (results.status === 'Cancelled') {
                        cur.status = 'CANCELED';
                    } else if (['Return', 'Returned'].indexOf(results.status) > -1) {
                        cur.status = 'REFUNDED';
                    } else {
                        cur.status = results.status;
                    }
                    if (cur.status === '') {
                        cur.status = 'ACCEPTED';
                    }
                    cur.bkPivot = results.typeStake;
                    cur.coef = results.coef;
                    cur.stake = results.amount;
                    cur.result = results.result;
                    cur.match = results.match;
                    ourAnswer.push(cur);
                    counter++;
                }
            });
        }
        return {counter, ourAnswer};
    };

    const collectBetResultAll = async (message, limit) => {
        const tabSel = 'div[class^="coupon-layout__coupons"] div[class^="tab2--"]';
        if ($(tabSel).attr('class').indexOf('active') === -1) {
            await mouseChain({target: $(tabSel)[0], events: fullClick});
            await delayPromise(990);
            await delayPromise(990);
        }
        const allSel = 'div[class^="filter--"] div:contains("All")';
        if ($(allSel).attr('class').indexOf('active') === -1) {
            await mouseChain({target: $(allSel)[0], events: fullClick});
            await delayPromise(990);
            await delayPromise(990);
        }
        let result = performScan(message, limit);
        const showMoreSel = 'div[class^="coupon__showmore"]';
        if ($(showMoreSel).length > 0 && result.counter < limit) {
            await mouseChain({
                target: $(showMoreSel)[0],
                events: fullClick,
                error: 'Show more!',
                scroll: true
            });
            await delayPromise(990);
            await delayPromise(990);
            await delayPromise(990);
            result = performScan(message, limit);
        }
        return result.ourAnswer;
    };

    const collectBetResultBy = async (message, limit) => {
        const ourAnswer = [];
        const $tabHistory = $('div[class*="mode-switcher--"] span[class*="clear-outline--"]:eq(1)');

        if ($tabHistory.attr('class').indexOf('active') === -1) {
            await mouseChain({target: $tabHistory[0], events: fullClick});
            await delayPromise(1777);
        }

        if ($('a[href="/account/history/bets/"]').length === 0) {
            throw 'bet history link is not available!';
        }

        await mouseChain({target: $('a[href="/account/history/bets/"]')[0], events: fullClick});
        await delayPromise(3555);

        const $list = await waitForElement('div[class*="virtual-list--"] > div', 300, 3555);

        console.log('list ', $list)

        await $list.eachAsync(async function (key) {
            const $this = $(this);

            if (++key > limit) return false;
            const betId = $this.find('div[class*="cellCouponNumber--"]').trt();

            if (message.data.length === 0 || message.data.indexOf(betId) > -1) {
                const
                    sts = $this.find('div[class*="cellResult--"]').trt(),
                    status = sts === 'Not settled'
                        ? 'ACCEPTED'
                        : sts === 'Win' ? 'WON' : sts === 'Loss' ? 'LOSE' : 'REFUNDED';
                ourAnswer.push({
                    external_id: betId,
                    status,
                    stake: sts === 'Win' ? $this.find('div[class*="cellSum--"] span').trt().replace(/[^\d.]/g, '')
                        : $this.find('div[class*="cellSum--"]').trt().replace(/[^\d.]/g, ''),
                    result: status === 'ACCEPTED' ? ''
                        : sts === 'Win' ? parseFloat($this.find('div[class*="cellSum--"] > div').clone().children().remove().end().trt().replace(/[^\d.]/g, ''))
                            : parseFloat($this.find('div[class*="cellSum--"]').trt().replace(/[^\d.]/g, '')),
                });
            }
        });

        delayPromise(1000)
            .then(mouseChain({target: $('a[data-testid="btn.Live"]')[0],
                events: fullClick, error: 'btn.Live'}));

        return ourAnswer;
    };

    const collectBetResult = function (message) {
        let limit = 50;
        if (message.data.length === 2 && message.data[0] === 'limit') {
            limit = parseInt(message.data[1]);
            message.data = [];
        }
        if (message.data.length > 0) {
            for (let j in message.data) {
                let r = /(\d+)/.exec(message.data[j]);
                if (r && r[0]) {
                    message.data[j] = r[0];
                }
            }
        }
        bsDebug(port, `collectBetResult: data: ${message.data.length}, limit: ${limit}`);
        (async () => {
            if (bkHere === 'fonbetby') {
                return await collectBetResultBy(message, limit);
            } else {
                return await collectBetResultAll(message, limit);
            }
        })()
            .then(ourAnswer => port.postMessage({answered: "BET_RESULT", status: "success", answer: ourAnswer}))
            .catch(e => port.postMessage({answered: "BET_RESULT", status: "error", answer: e}));
    };

    const getMaxPromise = function (paramData) {
        return new Promise(function (onSuccess, onReject) {
            getMax(paramData, true, function (m) {
                onSuccess(m);
            }, function (m) {
                onReject(m);
            });
        });
    };

    const getMax = function (paramData, callback, successCallback, errorCallback) {
        // HINT: If we're in the Express bet we must check coef for all bets!
        let lData = paramData.slice();
        let report = function (success, message) {
            console.log(`getMax: ${success}`, message, (new Error()).stack);
            if (!success) {
                message = message.replace('Odds changed', 'LOW_COEF');
            }
            if (!callback) {
                port.postMessage({
                    answered: "MAXIMUM",
                    status: success ? 'success' : "error",
                    answer: success && paramData[0].fork ? {
                        max: parseFloat(message.max),
                        coef: parseFloat(message.coef),
                        balance: getBalance(),
                        currency: currency
                    } : message
                });
                busy = false;
            } else {
                if (success) {
                    successCallback(message);
                } else {
                    errorCallback(message);
                }
            }
        };
        let justGetMax = function () {
            let $coupon = $('div[class*="coupon__head"][class*="_new_coupon"]').parent();
            if ($coupon.length === 1) {
                let $stakes = $coupon.find('a[class*="coupon__foot-sum-stake"]');
                let odd = parseFloat($('i[class^="coupon__info-text"]').last().text().trim());
                if ($stakes.length === 2 && !isNaN(odd)) {
                    report(true, {
                        max: $stakes[1].innerText.replace(/[^\d.]/g, '').trim(),
                        coef: odd
                    });
                } else {
                    report(false, 'justGetMax - max not found!');
                }
            } else {
                report(false, 'justGetMax - coupon not found!');
            }
        };
        const openCoupon = (data, betElement) => new Promise((onSuccess, onReject) => {
            if (data.doNotOpen) {
                onSuccess({max: 0, coef: parseFloat(betElement.textContent)});
            } else {
                mouseChain({target: betElement, events: ['mousemove', 'click'], scroll: true, scrollTop: true})
                    .then(waitForElementF('div[class^="new-coupon-"]:visible', 333, 5000))
                    .then(($el) => delayPromise(settings.delayGetMax, $el))
                    .then(($coupon) => {
                        let $stakes = $coupon.find('div[class^="info-block-"][class*="min-max"] span[class^="info-block__value"]');
                        let totalOdds = $coupon.find('div[class^="info-block-"]:has(span[class^="info-block__key"]:contains("Odds:")) '
                            + 'span[class^="info-block__value"]').text().trim();
                        if ($stakes.length !== 2) {
                            onReject('Wrong stakes length (' + $stakes.length + ')!');
                        } else if ((!newAPI || newAPI && paramData.length === 1) && parseFloat(betElement.textContent) < parseFloat(data.coef)) {
                            onReject('LOW_COEF we need 1: ' + data.coef + ', we have 2: ' + betElement.textContent + ' ' + newAPI + '/' + paramData.length);
                        } else {
                            onSuccess({
                                max: $stakes.last().text().replace(/[^\d.]/g, '').trim(),
                                coef: totalOdds !== '' ? parseFloat(totalOdds) : parseFloat(betElement.textContent)
                            });
                        }
                    })
                    .catch(e => onReject('Get coef and max error: ' + e));
            }
        });
        let performGetMax = function () {
            // HINT: It'll be fired for every match in data
            let data = lData.shift();
            let lastData = lData.length < 1;
            let checkScore = !!data.score;
            let feRes;
            findEvent(data)
                .then(f => feRes = f)
                .then(() => {
                    if (checkScore && ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) === -1
                        && data.sport === 'FOOTBALL') {
                        let $score = $(feRes.matchedEvent.element).closest('tr.table__row').find('span.table__score-normal');
                        if ($score.length < 1 || $score.text().trim() !== checkScore) {
                            throw `SCORE_CHANGED we have: "${$score.text().trim()}", we need: "${checkScore}" for  ${data.team1} - ${data.team2}`;
                        }
                    }
                })
                .then(() => getMarkets(feRes.matchedEvent.element, feRes.cornersEvent, feRes.halfEvent, feRes.timeEvents, data))
                .then(markets => getBetElementOldStyle(data, markets))
                .then(betElement => {
                    if (betElement.textContent === '') {
                        throw 'betElement not found or empty for ' + data.time_value + ' M:' + data.market
                        + ', P:' + data.pivot + ', T:' + data.target + ' not present! Match: ' + data.team1 + ' - ' + data.team2;
                    } else {
                        return betElement;
                    }
                })
                .then(betElement => openCoupon(data, betElement))
                .then(res => {
                    if (lastData) {
                        report(true, res);
                    } else {
                        performGetMax();
                    }
                })
                .catch(e => report(false, e));
        };
        if (ourCommand.getAdded('action') === 'ARB_BET') {
            bsDebug(port, 'getMax WITHOUT open');
            justGetMax();
        } else {
            bsDebug(port, 'getMax OPEN');
            // Close previous coupon
            closePreviousCoupon(false)
                .then(performGetMax)
                .catch(e => report(false, "Can't close previous coupon! " + e));
        }
    };

    const closePreviousCoupon = async state => {
        const started = Date.now();
        //dLog('', 'FON', 'closePreviousCoupon started!');
        const closeSelectorAll = findSel(['div[class^="new-coupon__header-clear"]',
            'div[class^="stakes-head__clear"]', 'div[class^="coupon-cart-header-"] span[class^="clear-outline-"]']);
        const closeSelector = findSel(['div[class^="stake-clear-"]', 'tr[class^="coupon-cart-bet-"] span[class^="clear-outline-"]']);
        const coupons = findSel(['tr[class^="coupon-cart-bet-"]', 'div[class^="event-data-"]']);
        if ($(coupons).length > 0) {
            if (state) {
                if ($(coupons).length > 1) {
                    await mouseChain({target: $(closeSelector)[1], events: fullClick, error: 'closeSelector'});
                    await delayPromise(300);
                }
            } else {
                await mouseChain({target: $(closeSelectorAll)[0], events: fullClick, error: 'closeSelectors'});
                await delayPromise(300);
            }
        }

        dLog('', 'FON', `closePreviousCoupon'd finished in the ${(Date.now() - started)} ms!`);
    };

    const searchGlobalEventFill = async bet => {
        const match = bet.home + ' — ' + bet.away;
        if ($('input[class^="search__input"]').length === 0) {
            await mouseChain({
                target: $('a.search__link')[0],
                events: fullClick,
                error: 'search link'
            });
        }
        await delayPromise(333);
        const $searchInput = await waitForElement('input[class^="search__input"]', 300, 5000, true);
        if (match !== $searchInput.val()) {
            await clearAndSimulate($searchInput[0], match);
            await delayPromise(555);
        }
        const $searchResult = await waitForElement('div[class^="search-result__event-"] a[class^="search-result__event-name"]', 300, 7000, true).catch(() => $([]));
        if ($searchResult.length === 0) {
            throw 'fill event not found';
        }
        await mouseChain({
            target: $searchResult[0],
            events: fullClick,
            error: 'fill event click error',
        });
        await delayPromise(555);
    };

    const findMenu = async () => {
        const menuSelectors = ['div[class^="vertical-panel__grow-"]', 'div[class^="horizontal-panel__items"]'];
        const res = menuSelectors.indexOf(findSel(menuSelectors));
        const $live = $('a.menu__link[href="/live/"]');
        if (res === -1 && $live.length > 0) {
            await mouseChain({target: $live[0], events: fullClick, error: '$live123'});
            await delayPromise(300);
            return await findMenu();
        }
        return res;
    };

    const getCouponsDetails = function ($this) {
        let enteredLoopDT = (new Date());
        let match = $this.find('a[class^="coupon__event"]:first').text().trim();
        let $typeStake = $this.find('td[class^="coupon__table-col"]').eq(1);
        let typeStake;
        if ($typeStake.length > 1) {
            /*let tss = [];
            $.each($typeStake, function (idx, val) {
                tss.push($(val).text().trim());
            });*/
            typeStake = $($typeStake[0]).text().trim();
        } else {
            typeStake = $typeStake.text().trim();
        }
        let odds = $this.find('td[class^="coupon__table-col"]:last').text().trim();
        let time = $this.find('div[class^="caption--"] span:last').text().trim();
        let timeDT;
        if (time.indexOf('.') > -1) {
            let tdSplitted = time.split('  ');
            if (tdSplitted.length < 2) {
                tdSplitted = time.split(' ');
            }
            let dateSplitted = tdSplitted[0].split('.');
            let timeSplitted = tdSplitted[1].split(':');
            timeDT = new Date(enteredLoopDT.getFullYear(), parseInt(dateSplitted[1]) - 1, parseInt(dateSplitted[0]),
                parseInt(timeSplitted[0]), parseInt(timeSplitted[1]), parseInt(timeSplitted[2]));
        } else {
            let timeSplitted = time.split(':');
            timeDT = new Date(enteredLoopDT.getFullYear(), enteredLoopDT.getMonth(), enteredLoopDT.getDate(),
                parseInt(timeSplitted[0]), parseInt(timeSplitted[1]), parseInt(timeSplitted[2]));
        }
        let $amount = $this.find('div[class*="coupon__info-item"]>i[class*="_icon_stake-"]').next();
        if ($amount.length === 0) {
            $amount = $this.find('div[class*="coupon__info-item"]>div[class*="coupon__info-item"][title="Bet amount"]');
        }
        if ($amount.length === 0) {
            const getI = bkHere === 'fonbetkz' ? 'has(i[class^="coupon__info-text--"]):last span:first' : 'has(i[class*="base-amount--"]):first span:first';
            $amount = $this.find('div[class^="coupon__info-item"]:' + getI);
        }
        let number = $this.find('div[class^="caption--"]').text().replace(time, '')
            .replace('Free bet ', '').replace('#', '').trim();
        let r = /(\d{9,})/.exec(number);
        if (r && typeof r[0] !== 'undefined') {
            number = r[0];
        }
        let amount = $amount.text().replace(/\s/g, '').replace(/[^\d.]/g, '').trim();
        let error = $('div[class^="error-box-"]:visible, div[class^="coupon-cart-footer__error"]').trt();
        let status = $this.find('div[class*="coupon__info-head"] div[class*="coupon__info-label"]>span').text().trim();
        let win = $this.find('div[class*="coupon__info-item"]>div[class*="coupon__info-item"][title="Total returns"]')
            .text().replace(/\s/g, '').replace(/[^\d.]/g, '').trim();
        if (win === '' || isNaN(parseFloat(win)) || parseFloat(win) === 0) {
            win = $this.find('div[class^="coupon__info-item"]:has(i[class*="icon_stake-win-"]):first span[style="display: inline-block;"]:last')
                .text().replace(/\s/g, '').replace(/[^\d.]/g, '').trim();
        }
        let coef = $this.find('div[class*="coupon__info-item"]>div[class*="coupon__info-item"][title="Общий коэффициент"]').text().trim();
        return {
            match: match,
            typeStake: typeStake,
            odds: odds,
            timeDT: timeDT,
            number: number,
            amount: amount,
            error: error,
            status: status,
            result: status === 'ACCEPTED' ? '' : win,
            coef: coef
        };
    };

    const takeScreen = async message => {
        if (!extendedDebugging) {
            return;
        }
        const mess = message || 'No message';
        // Hint: store text screenshot
        chrome.runtime.sendMessage({
            loggerName: 'textScreen',
            params: {data: $('aside').html(), message: mess}
        });
        await delayPromise(4000);
    };

    const searchEventFill = async bet => {
        const match = bet.home + ' — ' + bet.away;
        const selectedSport = 'div[class^="vertical-panel__grow-"] div[class*="_marked-"]';
        if ($(selectedSport).length > 0) {
            if ($(selectedSport).is('[class*="_bottom-padding-"') === false) {
                await mouseChain({
                    target: $(selectedSport).find('span[class^="filter-component-expander-"]')[0],
                    events: fullClick,
                    error: 'expand click error',
                });
                await delayPromise(222);
            }
            const $searchEl = await waitForElement(selectedSport + ' input[placeholder="Поиск"]', 300, 10000).catch(e => $([]));
            if ($searchEl.length > 0) {
                if (match !== $searchEl.val()) {
                    await clearAndSimulateD($searchEl[0], match, 1);
                    await delayPromise(888);
                }
                if ($(selectedSport).find('span[class*="filter-item-event__text-"]').length === 0) {
                    throw 'fill event not found';
                }
                await mouseChain({
                    target: $(selectedSport).find('span[class*="filter-item-event__text-"]')[0],
                    events: fullClick,
                    error: 'fill event click error',
                });
                await delayPromise(888);
            } else {
                dLog('', 'FC', ['Find event:', bet]);
                dLog('', 'FC', `Ready to start finding ${match}`);
                // Hint: find event new way - supports virtual DOM
                let matchedEvent = $([]);
                const $el = () => $('div[class^="sport-section-virtual-list"] > div');
                let $cur = $el().eq(0), $this, idx = 0;
                await waitForCondition(() => $el().length > 0, 333, 10000);
                await delayPromise(1000);
                do {
                    $cur[0].scrollIntoView(true);
                    await delayPromise(25);
                    $this = $cur.find('a');
                    if ($this.length > 0) {
                        const eventHere = $this.trt().toLowerCase();
                        console.log($this.trt() + ' => ' + $this.attr('href'));
                        console.log(`'${eventHere}' === '${match}'`);
                        if (eventHere === match || locutus_similar_text(eventHere, match.toLocaleLowerCase(), true) > 80) {
                            matchedEvent = $this;
                            break;
                        }
                    }
                    $cur = $cur.next();
                } while ($cur.length > 0);

                if (matchedEvent.length > 0) {
                    await mouseChain({
                        target: matchedEvent[0],
                        events: fullClick,
                        error: 'fill event click error',
                    });
                    await delayPromise(888);
                } else {
                    throw 'event not found';
                }
            }
        } else {
            throw 'sport is not selected!';
        }
    };

    const closePrevSearchAndSwitchType = async bet => {
        const
            prevSearch = 'span[class^="filter-component-cancel-"]',
            p = 'div[class^="filter-component-sport-mode-"]' + ' '
                + 'div[class^="filter-component-sport-mode__item"]',
            selected = $(`${p}[class*="selected-"]`).trt();
        if ($(prevSearch).length > 0) {
            await mouseChain({target: $(prevSearch)[0], events: fullClick, error: 'prevSearch'});
            await delayPromise(50);
        }
        let nc = '', nw = '';
        if (bet.type === 'LIVE' && selected !== 'Live') {
            nc = `${p}:contains("Live")`;
            nw = 'Live';
        } else if (bet.type === 'PREMATCH' && selected !== 'Pre-match') {
            nc = `${p}:contains("Pre-match")`
            nw = 'Pre-match';
        }
        if (nc) {
            let c = 0, done = false;
            while (!done && c < 10) {
                console.log(`switchType ${bet.type} ${c}`);
                await mouseChain({target: $(nc)[0], events: fullClick, error: 'nc!'});
                done = await waitForCondition(() => $(`${p}[class*="selected-"]`).trt() === nw,
                    50, 4000, `Type change!`).catch(e => false);
                c++;
            }
            if (!done) {
                throw `Error switching to ${bet.type} ${c} times`;
            }
        }
    };

    const ProccedExpressNew = async () => {
        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));
        let $betEl = $([]);
        const eventsLinks = 'div[class^="sport-section-virtual-list"] > div';
        const $events = () => $(eventsLinks);

        const findFirstOption = async ($coefEl, time) => {
            if (!isNaN(time) && time < 85) {
                const coef = parseFloat($coefEl.trt());
                return isNaN(coef) ? false : coef >= 1.01 && coef <= 1.05;
            }

            return false;
        };

        const findSecondOption = async ($coefEl, time, pivot) => {
            if (!(time > 70)) {
                return false;
            }

            const pivotLocal = Math.abs($coefEl.find('span:first').trt());

            if (pivot !== pivotLocal) {
                return false;
            }

            const coef = parseFloat($coefEl.find('span:eq(1)').trt());
            return isNaN(coef) ? false : coef >= 1.1 && coef <= 1.6;
        };

        const findEventNew = async () => {
            let $event = $([]);
            let stopLeagueLoop = false;
            let $currentEvt = $events().eq(0);
            let skipLeague = false;

            do {
                if ($currentEvt.is('div[class*="sport-competition-"]')) {
                    if (['FC', 'FС'].some(liga => $currentEvt.find('div[class^="table-component-text--"]:first').trt().indexOf(liga) > -1)) {
                        skipLeague = true;
                    } else {
                        skipLeague = false;
                    }
                }

                if ($currentEvt.find('a').length > 0) {
                    if (!skipLeague) {
                        const coefLine = bkHere === 'fonbetgr' ? 'div[class*="_normal-"]' : 'div[class*="cell-state-normal-"]';
                        const $coefsLine = () => $currentEvt.find(coefLine);
                        const time = parseFloat($currentEvt.find('span[class^="event-block-current-time__time-"]').trt());
                        const scoreArray = $currentEvt.find('span[class^="event-block-score__score-"]').trt().split(':');
                        const pivot = Math.abs(parseFloat(scoreArray[0]) - parseFloat(scoreArray[1]));
                        const eventName = $currentEvt.find('a').trt();

                        for (let i=0; i<$coefsLine().length; i++) {
                            if (bkHere === 'fonbetgr') {
                                const except = ['_disable-', 'table-component-factor-value_param-'].some((name) => $coefsLine().eq(i).is(`div[class*="${name}"]`));

                                if (except) {
                                    continue;
                                }
                            }

                            const
                                isHDP = $coefsLine().eq(i).children(),
                                isFitting = (!isHDP && (await findFirstOption($coefsLine().eq(i), time)))
                                    || (isHDP && ((await findSecondOption($coefsLine().eq(i), time, pivot)) || (await findFirstOption($coefsLine().eq(i), time))));
                            if (!isFitting) {
                                continue;
                            }

                            if (eventName.length < 5 || used[eventName] >= 1) {
                                continue;
                            }

                            $event = $coefsLine().eq(i);
                            stopLeagueLoop = true;
                            break;
                        }
                    }

                    $currentEvt[0].scrollIntoView(true);
                    await delayPromise(25);
                }

                if (stopLeagueLoop) {
                    break;
                }

                $currentEvt = $currentEvt.next();
            } while ($currentEvt.length > 0);

            return $event;
        };

        if (document.location.href !== 'https://www.fon.bet/live/') {
            await mouseChain({target: $('a[href="/live/"]')[0], events: ['click'], scroll: true});
            await delayPromise(333);
            await waitForElement('div[class^="filter-component-row-container-"]', 333, 12222);
        }

        if (document.location.href !== 'https://www.fon.bet/live/football/') {
            await mouseChain({target: $('a[href="/live/football/"]')[0], events: ['click'], scroll: true});
            await delayPromise(333);
            await waitForElement(eventsLinks, 333, 12222);
        }

        // find event
        $betEl = await findEventNew();

        if ($betEl.length > 0) {
            const eventName = $betEl.closest('div[class^="sport-base-event-"]').find('a[class^="table-component-text-"]').trt();
            await bMess('currentFirstBet').set(eventName);
            dLog('FON', 'green', [`We get first bet: '${eventName}', now used:`, used]);
            await mouseChain({target: $betEl[0], events: ['click'], scroll: true});
            await delayPromise(777);
            bMess('WasSuccessExpressNew').set(true).finally();
        } else {
            bMess('WasSuccessExpressNew').set(false).finally();
            dLog('red', 'FON', 'New express event not found!');
        }
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
            if (!success) {
                await takeScreen(message);
            }

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

                if (settings.newExpresses) {
                    // Hint: currentFirstBet MUST exists, otherwise some shit happened!
                    await bMess('WasSuccessExpressNew').set(false);
                    const
                        currentFirstBet = await bMess('currentFirstBet')
                            .check(1080000, true),
                        used = await bMess('usedEvents').check(1080000).catch(() => ({}));
                    if (!used[currentFirstBet]) {
                        used[currentFirstBet] = 2;
                    } else {
                        used[currentFirstBet]++;
                    }
                    await bMess('usedEvents').set(used);
                    dLog('FON', 'blue-big',
                        [`We set bet with first: '${currentFirstBet}', now used:`, used]);
                }
            } else {
                if (settings.newExpresses) {
                    const coupons = findSel(['tr[class^="coupon-cart-bet-"]', 'tr[class^="stake-wide--"]']);
                    const $coupons = () => $(coupons);
                    let checkCoef = false;

                    if ($coupons().length > 0) {
                        const isAvailable = bkHere === 'fonbetgr' ? $coupons().eq(0).is('[class*="_blocked-"]') === false
                            : $coupons().eq(0).find('div[class^="overlay-unavailable-"]').length === 0;

                        if (isAvailable) {
                            const isHDP = ['1','2'].some(i => $coupons().eq(0).find('td:eq(2)').trt() === i);
                            let couponCoefLink = bkHere === 'fonbetgr' ? 'value-' : 'v-current-';
                            const couponCoef = parseFloat($coupons().eq(0).find(`span[class^="${couponCoefLink}"]`).trt());

                            if (isHDP) {
                                // check second option
                                checkCoef = isNaN(couponCoef) ? false : couponCoef >= 1.1 && couponCoef <= 1.6;

                                if (!checkCoef) {
                                    // check first option
                                    checkCoef = isNaN(couponCoef) ? false : couponCoef >= 1.01 && couponCoef <= 1.05;
                                }
                            } else {
                                // check first option
                                checkCoef = isNaN(couponCoef) ? false : couponCoef >= 1.01 && couponCoef <= 1.05;
                            }

                            if (!checkCoef) {
                                dLog('red', 'FON', 'Had error in bet newExpress, checkCoef - false');
                                bMess('WasSuccessExpressNew').set(false).finally();
                                await closePreviousCoupon(false);
                            } else {
                                dLog('red', 'FON', 'Had error in bet newExpress, checkCoef - true');
                                await closePreviousCoupon(true);
                            }
                        } else {
                            dLog('red', 'FON', 'Had error in bet newExpress, coupon is disabled');
                            bMess('WasSuccessExpressNew').set(false).finally();
                            await closePreviousCoupon(false);
                        }
                    } else {
                        dLog('red', 'FON', 'Had error in bet newExpress, no coupons');
                        bMess('WasSuccessExpressNew').set(false).finally();
                    }
                }
            }

            busy = false;
            const doNotSend = !!currentBetData.data[0].betFromParser && !success
                && resultData.status !== 'LIMITED';
            if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                resultData.type = 'VALUE';
                resultData.mode = currentBetData.data[0].type;
                resultData.bookmaker = bkHereBig;
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
        proceedBetWork(data, command)
            .then(m => (bsLogger('red', 'FoN', `SUCCEEDED proceedBetWork has taken: ${(Date.now() - started)}`), report(true, m)))
            .catch(m => (bsLogger('red', 'FoN', `FAILED proceedBetWork has taken: ${(Date.now() - started)}`), report(false, m)));
    };

    const proceedBetWork = async (data, command) => {
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
        const inputSel = bkHere === 'fonru' ? 'div[class^="new-coupon-"]:visible input[class^="sum-panel__input"]'
            : 'input[class^="coupon-sum__editor--"]';
        const checkSuccess = async () => {
            await waitForElement('div[class^="coupon-list--"] tr[class^="bet--"]:visible', 333, 30000,
                true, 1, 'No success!');
            return true;
        };
        const getMax = async () => {
            const maxLink = bkHere === 'fonru' ? 'div[class^="new-coupon-"] div[class*="min-max"] span[class^="info-block__value-"]'
                : 'span[class*="min-max--"]';
            const max = () => parseFloat(
                $(maxLink)
                    .last().text().replace(/[^\d]/g, '').trim());
            await waitForCondition(() => !isNaN(max()),
                333, 10000, 'Wrong max!');
            currentBetData.max = max();
            return max();
        };
        const closeAllBets = async () => {
            const closeBetsSelectors = bkHere === 'fonru' ? 'div[class*="svgDelete--"]' : 'div[class^="coupon-list--"] span[class*="_delete--"]';
            for (let i = 0; i < $(closeBetsSelectors).length; i++) {
                await mouseChain({
                    target: $(closeBetsSelectors)[0],
                    events: fullClick,
                    error: 'closeBetsSelectors'
                });
                await delayPromise(777);
            }
            bsDebug(port, 'closeAllBets');
        }
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
            let checkCouponRes;
            const coupons = findSel(['tr[class^="coupon-cart-bet-"]', 'tr[class^="stake-wide--"]']);

            if (settings.newExpresses && $(coupons).length < 2) {
                throw 'less than 2 events in the newExpresses';
            }

            try {
                checkCouponRes = checkCoupon(data);
            } catch (e) {
                checkCouponRes = e;
            }
            dLog('green', 'FC', `Check coupon: ${checkCouponRes}`);
            if (checkCouponRes !== 'Coefs fine!') {
                throw `Error checking coupon: ${checkCouponRes}`;
            }
            if (parseFloat($(inputSel).val()) !== stake) {
                await clearAndSimulate($(inputSel)[0],
                    stake.toString().replace('.00', '').trim());
            }
            let $butt = () => bkHere === 'fonru'
                ? $('div[class^="new-coupon-"]:visible div[class^="place-button"] div[class^="button"][class*="normal-bet"]')
                : $('div[class^="coupon-cart--"]:visible span[class*="button-place--"]');
            let $agree = bkHere === 'fonru'
                ? $('div[class^="new-coupon-"]:visible').find('div[class^="place-button"] div[class^="button-accept"]')
                : $('div[class^="coupon-cart--"]:visible span[resource-name="double_check"]');
            const buttState = bkHere === 'fonru'
                ? $butt().attr('class').indexOf('disabled') === -1
                : $butt().attr('tabindex') !== '-1';
            if ($butt().length === 1 && buttState) {
                await mouseChain({target: $butt()[0], events: fullClick, error: "Bet button"});
                return true;
            } else if ($agree.length > 0) {
                await mouseChain({target: $agree[0], events: fullClick, error: "Agree button"});
                // try submit again
                await delayPromise(777);
                await mouseChain({target: $butt()[0], events: fullClick, error: "Bet button 2"});
                return true;
            }
            await delayPromise(getRandomRounded(400, 990));
            return false;
        };
        // ONLY for fonbetcupis
        const waitForResult = async stake => {
            // Now we'll use simple algorithm : new coupon is our!
            let wasPleaseWait = false;
            let wasError = '';
            let maxReached = 0;
            let wasOk = false;
            let betDetails = false;
            const sels = {
                coupons: 'div[class^="coupon-list--"] article[class^="coupon"]:visible',
                error: 'div[class*="coupon__error-button-area"] a:visible',
                errorNew: 'div[class^="error-box-"]:visible',
                ok: 'div[class^="button-area"] div:contains("OK")',
            };
            const checkStopWait = async () => {
                if (Object.values(sels).every(s => $(s).length === 0)) {
                    return false;
                }
                await delayPromise(2555);
                const details = getCouponsDetails($(sels.coupons).eq(0));
                dLog('green', 'Fon', ['wait status:', details]);
                if (details.error.indexOf('Interval between bets is too short') > -1) {
                    if ($(sels.ok).length > 0) {
                        await mouseChain({target: $(sels.ok)[0], events: fullClick, error: 'OkD11'});
                    }
                    throw details.error;
                } else if (details.number.indexOf('Please wait') > -1) {
                    wasPleaseWait = true;
                } else if (details.number.indexOf('Bet not placed') > -1) {
                    throw 'Bet not placed';
                } else if (details.error.length > 0 && details.error.indexOf('No rights') > -1) {
                    throw 'Bot LIMITED!';
                } else if (details.number.length > 3 && !isNaN(parseInt(details.number))) {
                    await delayPromise(200);
                    betDetails = JSON.parse(JSON.stringify(details));
                } else if ($(sels.errorNew).length > 0
                    && $(sels.errorNew).text().trim().indexOf('maximum') > -1) {
                    const mr = /Max=(\d+)/gi.exec($(sels.errorNew).text().trim()
                        .replace(/\s/g, ''));
                    if (mr && mr[1] && parseInt(mr[1]) > 0) {
                        maxReached = parseInt(mr[1]);
                        if ($(sels.ok).length > 0) {
                            await mouseChain({target: $(sels.ok)[0], events: ['click']})
                            await delayPromise(getRandomRounded(700, 990))
                        }
                    } else {
                        throw `BAD NEW MAX: '${details.error}'`;
                    }
                } else if ($(sels.errorNew).length > 0 && $(sels.errorNew).text().trim().indexOf('Odds changed') > -1) {
                    if ($(sels.ok).length > 0) {
                        await mouseChain({target: $(sels.ok)[0], events: fullClick, error: 'OkD8'});
                        await delayPromise(getRandomRounded(700, 990));
                        wasOk = true;
                    } else {
                        throw `Nothing to press for '${details.error}'`;
                    }
                } else if ($(sels.errorNew).length > 0 && $(sels.errorNew).text().trim().indexOf('prohibited') > -1) {
                    if ($(sels.ok).length > 0) {
                        await mouseChain({target: $(sels.ok)[0], events: fullClick, error: 'OkD8'});
                    }
                    throw `LIMITED - Placing bets prohibited`;
                } else if ($(sels.error).length > 0) {
                    throw 'bad bet :( ' + $(sels.error).text().trim();
                } else if (details.number.indexOf('New bet') > -1 && wasPleaseWait) {
                    wasOk = true;
                    dLog('green', 'Fon', 'New bet && wasPleaseWait');
                } else {
                    await delayPromise(200);
                    betDetails = getCouponsDetails($(sels.coupons).eq(0));
                    if (!betDetails.number || !betDetails.odds || !betDetails.amount) {
                        betDetails = false;
                    }
                }
                dLog('blue', 'Fon', [`fin: ${maxReached}/${wasOk}`, betDetails]);
                return !!(betDetails || maxReached || wasOk);
            };
            await waitForCondition(async () => await checkStopWait(), 500,
                parseInt(settings.maxWaitForBetStatus), 'checkStopWait error!')
                .catch(async e => {
                    await takeScreen();
                    if ($(sels.error).length > 0) {
                        await mouseChain({target: $(sels.error)[0], events: fullClick, error: "EP56"});
                    }
                    wasError = e;
                });
            const closeNew = async () => await mouseChain({
                target: $('article[class^="coupon"]:visible div[class*="_close"]')[0],
                events: fullClick,
                error: 'CloseNew'
            }).catch(e => console.log('Bad close!'));
            if (wasError !== '') {
                return {error: true, message: wasError};
            } else if (maxReached > 0) {
                await closeNew();
                return {error: false, action: 'rebet', maxReached};
            } else if (wasOk) {
                await closeNew();
                return {error: false, action: 'rebet'};
            } else if (betDetails) {
                await closeNew();
                return {error: false, action: 'success', betDetails};
            }
        };
        bsDebug(port, 'proceedBetCupis', data);

        const menuNumber = await findMenu();
        await closePreviousCoupon(settings.newExpresses);
        await delayPromise(1777);

        if (menuNumber === -1) {
            throw 'sport menu not found';
        }

        await delayPromise(777);
        dLog('red', 'FC', 'Event page!');
        let $el = $([]);

        for (const bet of data) {
            if (menuNumber === 1) {
                await searchGlobalEventFill(bet);
            } else {
                await closePrevSearchAndSwitchType(bet);
                await switchSport(bet);
                await searchEventFill(bet);
            }

            // get bet element
            $el = await getBetElementDirectLink(bet);
            const elState = bkHere === 'fonru' ? 'div[class*="_blocked--"]' : 'div[class*="text-state-empty"]';
            if ($el.find(elState).length > 0) {
                throw 'Stake blocked!';
            }
            await delayPromise(555);
            await mouseChain({
                target: bkHere === 'fonru' ? $el.find('div[class*="factor-td--"]')[0] : $el[0],
                events: fullClick,
                scroll: true
            });
            await delayPromise(1111);
        }
        const max = await getMax();
        //throw `Now we simple getting max, and it is: ${max}`;
        let stake = calcStake(max);
        bsDebug(port, `Stake calculated: ${stake}`);
        let betPlaced = false, iterations = 0, iterationsBets = 0, closeBets = false, resultSuccess = false;
        await delayPromise(1777);
        if (bkHere === 'fonru') {
            while (!betPlaced && iterations <= 3) {
                betPlaced = await tryPlaceBet(stake);
                bsDebug(port, `Iteration: ${iterations}, bet placed: ${betPlaced}`);
                if (betPlaced) {
                    let result = await waitForResult(stake);
                    bsDebug(port, 'Bet placed result: ', result);
                    if (result.error) {
                        throw `waitBetResult error: ${result.message}`;
                    }
                    if (result.maxReached) {
                        stake = result.maxReached;
                        betPlaced = false;
                        dLog('red', 'FC', `MAX REACHED: ${stake} on iteration ${iterations}`);
                    } else if (result.action && result.action === 'success') {
                        resultSuccess = result.betDetails;
                        break;
                    }
                }
                iterations++;
            }
            await delayPromise(1777);
            if (resultSuccess !== false) {
                await closeAllBets();
                return resultSuccess;
            }
            if (!betPlaced) {
                throw `Bet not placed ${iterations} times :(`;
            }

            await delayPromise(555);
        } else {
            do {
                betPlaced = await tryPlaceBet(stake);
                bsDebug(port, `Iteration: ${iterations}, bet placed: ${betPlaced}`);
                if (!betPlaced) {
                    throw `Bet not placed!`;
                }
            } while (!await checkSuccess());

            await delayPromise(777);

            const number = $('div[class^="coupon-list--"] div[class*="caption--"]').clone().children().remove().end().text().toLowerCase().replace(/[^\d.]/g, '');
            const odds = $('div[class^="coupon-list--"] span[class*="_type_coef--"]').parent().clone().children().remove().end().trt();
            const amount = $('div[class^="coupon-list--"] span[class*="_type_sum--"]').next().trt().replace(/[^\d.]/g, '');

            await delayPromise(555);
            await closeAllBets();

            return {
                number,
                odds,
                amount,
            };
        }
    };

    const openCoupon = async data => {
        const started = Date.now();
        dLog('', 'FON', ['openCoupon started!', data]);
        const waitForEvents = async () => {
            await delayPromise(150);
            await waitForElement('div[class^="sport-section-virtual-list"] > div', 300, 40000,
                false, 1, 'No events!');
            await delayPromise(150);
        };

        if (data[0].type === 'PREMATCH' && document.location.href.indexOf('/bets/') === -1) {
            const $prematch = await waitForElement('a.menu__link[href="/sports/"]', 300, 10000);
            await mouseChain({target: $prematch[0], events: fullClick, error: 'GoToBets'});
            await waitForEvents();
        } else if (data[0].type === 'LIVE' && document.location.href.indexOf('/live') === -1) {
            const liveWaitStarted = Date.now();
            const $live = await waitForElement('a.menu__link[href^="/live"]', 300, 10000);
            dLog('', 'FON', `We'd wait for LIVE for ${(Date.now() - liveWaitStarted)} ms!`);
            await mouseChain({target: $live[0], events: fullClick, error: 'GoToLive'})
            const eventsWaitStarted = Date.now();
            await waitForEvents();
            dLog('', 'FON', `We'd wait for EVENTS for ${(Date.now() - eventsWaitStarted)} ms!`);
        }

        for (const bet of data) {
            const findEventStarted = Date.now();
            const feRes = await findEvent(bet);
            console.log('feRes ', feRes);
            dLog('', 'FON', `EVENT'd found for ${(Date.now() - findEventStarted)} ms!`);
            if (!!bet.score && ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(bet.market) === -1
                && bet.sport === 'FOOTBALL') {
                let $score = $(feRes.matchedEvent.element)
                    .find('span[class^="event-block-score__score"]');
                if ($score.length < 1 || $score.trt() !== bet.score) {
                    throw `SCORE_CHANGED we have: "${$score.text().trim()}", we need: "${bet.score}" for  ${bet.team1} - ${bet.team2}`;
                }
            }
            let tries = 0;
            let el;
            do {
                const markets = await getMarkets(feRes.matchedEvent.element, feRes.cornersEvent,
                    feRes.halfEvent, feRes.timeEvents, bet, feRes.$headings);
                console.log('markets: ', markets);
                el = await getBetElementOldStyle(bet, markets);
                if (!el || $(el).trt() === '') {
                    tries++;
                    dLog('red', 'Fon', `We didn't find bet ${tries} times!`);
                    await delayPromise(1000);
                }
            } while ((!el || $(el).trt() === '') && tries < 25);
            dLog('', 'FON', `BET'd found: ${$(el).trt()}!`);
            if (!el && $(el).trt() === '') {
                throw `No record 3 for ${bet.time_value}/${bet.market}/${bet.target}/${bet.pivot} present!`;
            }
            if ($(el).attr('class') && $(el).attr('class').indexOf('blocked') > -1) {
                throw 'Stake blocked!';
            }
            if ($(el).find('div[class^="table-component"]').length > 0) {
                await mouseChain({
                    target: $(el).find('div[class^="table-component"]')[0],
                    events: fullClick, error: 'Bet click!'
                });
            } else {
                await mouseChain({target: el, events: fullClick, error: 'Bet click!'});
            }
            dLog('', 'FON', `BET clicked!`);
            await delayPromise(990);
        }
        dLog('', 'FON', `openCoupon finished in ${(Date.now() - started)} ms!`);
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
            const $hl = $('a.header__lang-item.header__link i');
            if ($hl.length > 0 && $hl.attr('class').indexOf('_icon_ru') === -1) {
                console.log('%c' + `We need switch to russian 1!`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                await mouseChain({target: $hl[0], events: ['click'], scroll: true});
                await waitDelayClickF('a.header__lang-item:has(i._icon_ru)', 5000)()
                    .catch(e => console.log('%c' + `Switching 1: ${e}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'))
                await delayPromise(990);
            }
            const $lg = $('span[resource-name^="langIcon_"]');
            if ($lg.length > 0 && $lg.attr('resource-name').indexOf('_ru') === -1) {
                console.log('%c' + `We need switch to russian 2!`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                await mouseChain({target: $lg[0], events: ['click'], scroll: true, error: '$lg'});
                await waitDelayClickF('span[resource-name="langIcon_ru"]', 5000)()
                    .catch(e => console.log('%c' + `Switching 2: ${e}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'))
                await delayPromise(990);
            }
            const $slider = $('div[class^="slider__iconArrow"][class*="_kind_up"]');
            if ($slider.length > 0) {
                await mouseChain({target: $slider[0], events: fullClick})
                    .catch(e => console.log(e));
            }
            const $agree = $('a.modal-window__button:contains("Agree")');
            if ($agree.length > 0) {
                await mouseChain({target: $agree[0], events: ['click']})
                    .catch(e => console.log(e));
            }
            const closes = ['span.toolbar__btn-text:textEquals("Close")',
                'div[class^="step-start"] div[class^="close-button"]'];
            if (findSel(closes)) {
                await mouseChain({target: $(findSel(closes))[0], events: fullClick})
                    .catch(e => console.log(e));
            }
            const $questionPopup = $('div[class*="onBoardingStep"] div[class^="close-button"]');
            if ($questionPopup.length > 0) {
                await mouseChain({target: $questionPopup[0], events: fullClick})
                    .catch(e => console.log(e));
            }
            let $logLink = $(findSel([
                'a.header__link:contains("Вход")',
                'a.header__link:contains("Вход")',
                'a.header-btn:contains("Вход")',
                'span[data-testid="btn.logIn"]',
            ]));
            if ($logLink.length === 1) {
                port.postMessage({m: "tech works!"});
                let logged = true;
                const m = await tryToLogIn($logLink)
                    .catch(e => {
                        logged = false;
                        port.postMessage({m: "ERROR AUTH! " + e});
                        dLog('color: yellow; background: black; font-size: 12px;',
                            'Fon', `ERROR: ${e}`);
                    });
                if (logged) {
                    port.postMessage({m: m});
                }
            } else {
                if (settings.newExpresses && !busy) {
                    const WasSuccessExpressNew = await bMess('WasSuccessExpressNew').infinite().catch(() => 0);
                    const coupons = findSel(['tr[class^="coupon-cart-bet-"]', 'div[class^="event-data-"]']);
                    const $coupons = await waitForElement(coupons,
                        333, 2222).catch(() => $([]));

                    if (WasSuccessExpressNew && $coupons.length === 0) {
                        await bMess('WasSuccessExpressNew').remove();
                    }

                    if (!WasSuccessExpressNew) {
                        dLog('green', 'FON', 'START find NewExpress event!');
                        // clear coupons
                        if ($(coupons).length > 0) {
                            await closePreviousCoupon(false);
                        }

                        busy = true;
                        await ProccedExpressNew().catch((e) => {
                            dLog('red', 'FON', 'ProccedExpressNew Error - ' + e);
                            bMess('WasSuccessExpressNew').set(false).finally();
                        });
                        busy = false;
                    }
                }

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
        const $b = bkHere === 'fonru' ? $('span.header__login-balance:visible:first')
            : $('a[class*="header--account-button-main--"] span:last');
        if ($b.length > 0) {
            const bText = $b.trt();
            currency = $('span.header__login-currency:visible:first').text().trim() === '€' ? 'EUR' : 'RUB';
            return parseFloat(bText.replace(/[^\d.]/g, '').trim());
        } else {
            currency = '';
            return returnNull ? 'null' : 0;
        }
    };

    const switchSport = async bet => {
        const accordance = {
            'FOOTBALL': 'Футбол',
            'HOCKEY': 'Хоккей',
            'VOLLEYBALL': 'Волейбол',
            'TENNIS': 'Теннис',
            'TABLETENNIS': 'Настольный теннис',
            'BASEBALL': 'Бейсбол',
            'BASKETBALL': 'Баскетбол',
            'CYBERSPORT': 'Киберспорт',
        };
        const cs = accordance[bet.sport];
        if ($(`div[class^="filter-component-row-container"] span:textEquals("${cs}")`)
            .is('[class*="selected"]') === false) {
            await mouseChain({
                target: $(`span:textEquals("${cs}")`)
                    .closest('div[class^="filter-component-row-container"]').find('a')[0],
                events: fullClick, error: `Open ${cs}`
            });
        }
        await delayPromise(777);
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

    const tryToLogIn = async ($logLink) => {
        const ac = 'color: white; background: black; font-sze: 20px;';
        dLog(ac, 'Fon', `TryToLogin: ${$logLink.length}`);
        if ($logLink.length !== 1) {
            throw `$logLink length is ${$logLink.length}`;
        }
        if (Date.now() - authClicked < 20000) {
            throw `Too soon! ${authClicked} / ${Date.now()} / ${(Date.now() - authClicked)}`;
        }
        //await mouseChain({target: $logLink[0], events: fullClick, error: '$logLink'});
        await dClick($logLink[0]);
        authClicked = Date.now();
        dLog(ac, 'Fon', `AUTH clicked!`);
        const sels = [
            'input[type="text"]',
            'input[type="password"]',
        ];
        const submit = findSel(['button:textEquals("Вход")', 'span[class^="button--"]:textEquals("Вход")']);
        const error = 'div[class^="error--"]';
        await waitForCondition(() => checkSE([sels[0], sels[1]]),
            333, 10000, 'No form!');
        await delayPromise(500);
        if (settings.login.indexOf('+') > -1 && bkHere !== 'fonru') {
            await mouseChain({target: $('div[data-testid="tabItem_phone"]')[0], events: fullClick, error: 'phone'});
            await delayPromise(500);
            $(sels[0]).val(settings.login);
            fireChangeEvent($(sels[0])[0]);
            $(sels[0]).val(settings.login);
            fireInputEvent($(sels[0])[0]);
            $(sels[0]).val(settings.login);
            await mouseChain({target: $('div[data-testid="tabItem_phone"]')[0], events: fullClick, error: 'phone'});
            $(sels[0]).val(settings.login);
        } else {
            await clearAndSimulate($(sels[0])[0], settings.login);
        }
        await delayPromise(1000);
        await clearAndSimulate($(sels[1])[0], settings.password);
        await delayPromise(1000);
        if (settings.login.indexOf('+') > -1 && bkHere !== 'fonru') {
            await mouseChain({target: $('div[data-testid="tabItem_phone"]')[0], events: fullClick, error: 'phone'});
            await delayPromise(500);
            $(sels[0]).val(settings.login);
            fireChangeEvent($(sels[0])[0]);
            $(sels[0]).val(settings.login);
            fireInputEvent($(sels[0])[0]);
            $(sels[0]).val(settings.login);
            await mouseChain({target: $('div[data-testid="tabItem_phone"]')[0], events: fullClick, error: 'phone'});
            $(sels[0]).val(settings.login);
            await clearAndSimulate($(sels[1])[0], settings.password);
            await delayPromise(1000);
        }
        authClicked = Date.now();
        await mouseChain({
            target: $(submit)[0],
            events: fullClick, error: 'LC2',
        });
        await delayPromise(2222);
        if ($(error).length > 0) {
            enterError = true;
            throw $(error).trt();
        }
        return 'auth_clicked';
    };

    const getBetElementDirectLink = async data => {
        let markets = {
            'ONE_TWO': {
                'ONE': {root: ['Исход матча (основное время)'], subroots: [], pivotKey: '#TEAM1#'},
                'TWO': {root: ['Исход матча (основное время)'], subroots: [], pivotKey: '#TEAM2#'},
                'DRAW': {root: ['Исход матча (основное время)'], subroots: [], pivotKey: 'Ничья'},
                'ONE_DRAW': {root: ['Исход матча (основное время)'], subroots: [], pivotKey: '#TEAM1# или ничья'},
                'TWO_DRAW': {root: ['Исход матча (основное время)'], subroots: [], pivotKey: 'Ничья или #TEAM2#'},
                'ONE_TWO': {root: ['Исход матча (основное время)'], subroots: [], pivotKey: '#TEAM1# или #TEAM2#'}
            },
            'TOTAL': {
                'OVER': {
                    root: ['Тотал голов в матче'], subroots: [],
                    pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                },
                'UNDER': {
                    root: ['Тотал голов в матче'], subroots: [],
                    pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    root: ['Индивидуальные тоталы голов'], subroots: [],
                    pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                },
                'UNDER': {
                    root: ['Индивидуальные тоталы голов'], subroots: [],
                    pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                }
            },
            'T2_TOTAL': {
                'OVER': {
                    root: ['Индивидуальные тоталы голов'], subroots: [],
                    pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                },
                'UNDER': {
                    root: ['Индивидуальные тоталы голов'], subroots: [],
                    pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                }
            },
            'HDP': {
                'HOME': {
                    root: ['Исход матча с учетом форы'],
                    subroots: [],
                    pivotKeys: ['Фора (#HPIVOT#)', 'Фора (#PIVOTR#)']
                },
                'AWAY': {
                    root: ['Исход матча с учетом форы'],
                    subroots: [],
                    pivotKeys: ['Фора (#HPIVOT#)', 'Фора (#PIVOTR#)']
                }
            },
            'CORNER_TOTAL': {
                'OVER': {
                    root: ['Угловые. Тотал в матче'], subroots: [],
                    pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                },
                'UNDER': {
                    root: ['Угловые. Тотал в матче'], subroots: [],
                    pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                }
            },
            'CORNER_HDP': {
                'HOME': {
                    root: ['Угловые. Исход с учетом форы'],
                    subroots: [],
                    pivotKeys: ['Фора (#HPIVOT#)', 'Фора (#PIVOTR#)']
                },
                'AWAY': {
                    root: ['Угловые. Исход с учетом форы'],
                    subroots: [],
                    pivotKeys: ['Фора (#HPIVOT#)', 'Фора (#PIVOTR#)']
                }
            },

            half: {
                'ONE_TWO': {
                    'ONE': {root: ['Исход 1‑го тайма'], subroots: [], pivotKey: '#TEAM1#'},
                    'TWO': {root: ['Исход 1‑го тайма'], subroots: [], pivotKey: '#TEAM2#'},
                    'DRAW': {root: ['Исход 1‑го тайма'], subroots: [], pivotKey: 'Ничья'},
                    'ONE_DRAW': {root: ['Исход 1‑го тайма'], subroots: [], pivotKey: '#TEAM1# или ничья'},
                    'TWO_DRAW': {root: ['Исход 1‑го тайма'], subroots: [], pivotKey: 'Ничья или #TEAM2#'},
                    'ONE_TWO': {root: ['Исход 1‑го тайма'], subroots: [], pivotKey: '#TEAM1# или #TEAM2#'}
                },
                'TOTAL': {
                    'OVER': {
                        root: ['Тотал голов в 1‑м тайме'],
                        subroots: [],
                        pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['Тотал голов в 1‑м тайме'],
                        subroots: [],
                        pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                    },
                },
                'T1_TOTAL': {
                    'OVER': {
                        root: ['Индивидуальные тоталы голов в 1‑м тайме'],
                        subroots: [],
                        pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['Индивидуальные тоталы голов в 1‑м тайме'],
                        subroots: [],
                        pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                    }
                },
                'T2_TOTAL': {
                    'OVER': {
                        root: ['Индивидуальные тоталы голов в 1‑м тайме'],
                        subroots: [],
                        pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                    },
                    'UNDER': {
                        root: ['Индивидуальные тоталы голов в 1‑м тайме'],
                        subroots: [],
                        pivotKeys: ['Тотал #PIVOT#', 'Тотал #PIVOTR#']
                    }
                },
                'HDP': {
                    'HOME': {
                        root: ['Исход 1‑го тайма с учетом форы'],
                        subroots: [],
                        pivotKeys: ['Фора (#HPIVOT#)', 'Фора (#PIVOTR#)']
                    },
                    'AWAY': {
                        root: ['Исход 1‑го тайма с учетом форы'],
                        subroots: [],
                        pivotKeys: ['Фора (#HPIVOT#)', 'Фора (#PIVOTR#)']
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
        // check score of football
        if (!!data.score && data.type === 'LIVE' && ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) === -1
            && data.sport === 'FOOTBALL') {
            const scoreTable = bkHere === 'fonru' ? 'div[class^="score-table--"]' : 'div[class^="scoreboard__table--"]';
            const $scoreTable = await waitForElement(scoreTable, 333, 8000, true);

            if (bkHere === 'fonru') {
                const $scoreEls = $scoreTable.find('div[class^="score-table__container--"]:first div[class^="ev-score--"]');
                if ($scoreEls.length !== 2) {
                    throw 'SCORE wrong length of element!';
                } else {
                    const scoreMatch = $scoreEls.eq(0).trt() + ':' + $scoreEls.eq(1).trt();
                    if (scoreMatch !== data.score) {
                        throw `SCORE_CHANGED we have: "${scoreMatch}", we need: "${data.score}" for  ${data.home} - ${data.away}`;
                    }
                }
            } else {
                const $scoreTable = await waitForElement('div[class^="scoreboard__table--"]', 333, 8000, true);
                const scoreMatch = $scoreTable.find('div[class^="column__t1"]:eq(1)').trt() + ':' + $scoreTable.find('div[class^="column__t2"]:eq(1)').trt();
                if (scoreMatch !== data.score) {
                    throw `SCORE_CHANGED we have: "${scoreMatch}", we need: "${data.score}" for  ${data.home} - ${data.away}`;
                }
            }
        }
        const team1 = data.home.toLowerCase();
        const team2 = data.away.toLowerCase();

        const market = markets[data.market][data.target];

        let modifyRoots = function () {
            let eSet, prefix, setPrx, push;
            if (data.time_value.indexOf('FULL') === -1) {
                eSet = data.time_value.replace(/\D/g, '');
                prefix = {1: 'в', 2: 'во', 3: 'в', 4: 'в', 5: 'в'}[eSet];
                setPrx = prefix + ' ' + eSet;
            }

            if (data.sport === 'TENNIS') {
                if (data.time_value.indexOf('FULL') > -1) {
                    push = {
                        'ONE_TWO': 'Победа в матче',
                        'TOTAL': 'Тотал геймов',
                        'T1_TOTAL': 'Индивидуальные тоталы геймов',
                        'T2_TOTAL': 'Индивидуальные тоталы геймов',
                    }[data.market];
                } else {
                    push = {
                        'ONE_TWO': `Победа ${setPrx}‑м сете`,
                        'HDP': `Победа ${setPrx}‑м сете с учетом форы`,
                        'TOTAL': `Тотал геймов ${setPrx}‑м сете`,
                        'T1_TOTAL': `Индивидуальные тоталы геймов ${setPrx}‑м сете`,
                        'T2_TOTAL': `Индивидуальные тоталы геймов ${setPrx}‑м сете`,
                    }[data.market];
                }
            } else if (data.sport === 'TABLETENNIS' || data.sport === 'VOLLEYBALL') {
                if (data.time_value.indexOf('FULL') > -1) {
                    push = {
                        'ONE_TWO': 'Result',
                        'TOTAL': 'Total points',
                        'T1_TOTAL': 'Team totals points',
                        'T2_TOTAL': 'Team totals games',
                    }[data.market];
                } else {
                    push = {
                        'ONE_TWO': `Result in ${setPrx} set`,
                        'HDP': `Handicap in ${setPrx} set`,
                        'TOTAL': `Total points in ${setPrx} set`,
                        'T1_TOTAL': `Team totals points in ${setPrx} set`,
                        'T2_TOTAL': `Team totals points in ${setPrx} set`,
                    }[data.market];
                }
            } else if (data.sport === 'HOCKEY') {
                if (data.time_value.indexOf('FULL') > -1) {
                    push = {
                        'ONE_TWO': 'Result in match',
                        'HDP': 'Handicap in match',
                        'TOTAL': 'Totals goals in match',
                        'T1_TOTAL': 'Team totals in match',
                        'T2_TOTAL': 'Team totals in match',
                    }[data.market];
                } else {
                    push = {
                        'ONE_TWO': `Result in ${setPrx} period`,
                        'HDP': `Handicap in ${setPrx} period`,
                        'TOTAL': `Total goals in ${setPrx} period`,
                        'T1_TOTAL': `Team totals in ${setPrx} period`,
                        'T2_TOTAL': `Team totals in ${setPrx} period`,
                    }[data.market];
                }
            } else if (data.sport === 'BASKETBALL') {
                //TODO: do basket
            }
            if (data.sport === 'CYBERSPORT') {
                if (data.time_value.indexOf('FULL') > -1) {

                } else {
                    push = {
                        'ONE_TWO': `${setPrx} map result`,
                        'HDP': `${setPrx} map handicap`,
                        'TOTAL': `${setPrx} map total`,
                        //'T1_TOTAL': `Team totals in ${setPrx} period`,
                        //'T2_TOTAL': `Team totals in ${setPrx} period`,
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
            } else {
                // console.log(typeof element + ' not supported! (' + element + ')');
            }
        };
        const convertPivotMinus = function (pivot) {
            const pivotArr = pivot.split('');
            const modifyMinus = pivotArr.map(function (character) {
                if (character.charCodeAt(0) === 8209) {
                    return '-';
                }
                return character;
            });
            return modifyMinus.join('');
        }

        replaceInner(markets, null, null);

        const performGet = async () => {
            dLog('green', 'FC', ['market: ', market]);
            const betGroups = await waitForElement('div[class^="market-group-box--"]',
                333, 8000);
            let $element = [];

            await betGroups.eachAsync(async function () {
                const $this = $(this);
                const headName = $this.find('div[class^="header--"]');

                if (bkHere === 'fonru') {
                    if (market.root.indexOf(headName.find('div[class^="text-new--"]').trt()) === -1) {
                        return true;
                    }
                } else {
                    const marketName = headName.find('div[class^="text--"]').trt().replace(/ /g, ' ');

                    if (market.root.indexOf(marketName) === -1) {
                        console.log('%c' + `Skipping '${market.root.join("', '")}' of '${marketName}' = ${market.root.indexOf(marketName)}`,
                            'background: orange; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                        return true;
                    } else {
                        headName[0].scrollIntoView(true);
                        console.log('%c' + `Working in ${marketName}`,
                            'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    }
                }

                //expanded if needed
                if (headName.find('div[class*="_collapsed--"]').length > 0) {
                    await mouseChain({
                        target: headName.find('div[class*="_collapsed--"]')[0],
                        events: fullClick,
                        error: 'can\'t expand bet head',
                        scroll: true
                    });
                    await delayPromise(1888);
                }

                const wrapSel = bkHere === 'fonru'
                    ? 'div[class^="cell-wrap--"]'
                    : 'div[class^="normal-row--"] div[class^="cell--"]';
                await waitForCondition(() => $this.find(wrapSel).length > 0,
                    300, 5555);

                $this.find(wrapSel).each(function () {
                    const $t = $(this);
                    let pivotKeys = '';
                    let elementText = '';
                    switch (data.market) {
                        case 'ONE_TWO':
                            const textSel = bkHere === 'fonru' ? 'div[class^="t--"]' : 'div[class^="text--"]';
                            elementText = $t.find(textSel).html()
                                .replace(/&nbsp;/g, ' ').toLowerCase();
                            pivotKeys = market.pivotKey.toLowerCase();
                            if (pivotKeys === elementText
                                || locutus_similar_text(pivotKeys, elementText, true) > 90) {
                                $element = $t;
                            } else {
                                console.log(`'${pivotKeys}' !== '${elementText}'`);
                            }
                            break;
                        case 'TOTAL':
                        case 'CORNER_TOTAL':
                            if ($(this).length > 0) {
                                elementText = $(this).find('div[class^="common-text--"]').length > 0
                                    ? $(this).find('div[class^="common-text--"]').html().replace(/&nbsp;/g, ' ')
                                    : $(this).html().replace(/&nbsp;/g, ' ')
                                pivotKeys = market.pivotKeys;
                                if (pivotKeys.indexOf(elementText) > -1) {
                                    if (data.target === 'OVER') {
                                        $element = $(this).next();
                                    } else {
                                        $element = $(this).next().next();
                                    }
                                }
                            }
                            break;
                        case 'CORNER_HDP':
                        case 'HDP':
                            if ($t.length > 0) {
                                elementText = convertPivotMinus($t.trt());
                                console.log(`elementText: ${elementText}`);
                                let
                                    pivotHdp = parseFloat(
                                        elementText.replace(/[^\d-.+]/g, '')),
                                    $headerHDPDraft = $(this).parent().parent()
                                        .find('div[class^="header-row"] div[class*="_style-uppercase"]'),
                                    $headerHDP = $headerHDPDraft.length > 0 ? $headerHDPDraft
                                        : $(this).parent().parent()
                                            .find('div[class^="row-header"] div[class*="_style-uppercase"]'),
                                    headerHDP = $headerHDP.html().replace(/&nbsp;/g, ' ').toLowerCase(),
                                    currentTarget = data.target === 'HOME' ? team1 : team2,
                                    checkHeader = headerHDP === currentTarget
                                        || locutus_similar_text(headerHDP, currentTarget, true) > 90;
                                console.log(`${headerHDP} === ${currentTarget} ${headerHDP === currentTarget}`);
                                pivotKeys = market.pivotKeys;
                                const comparePivots = pivotKeys.find(function (pivot) {
                                    let pvt = parseFloat(pivot.replace(/[^\d-.+]/g, ''));
                                    console.log(`HDP: '${pvt}' === '${pivotHdp}' ${pvt === pivotHdp}`);
                                    return pvt === pivotHdp;
                                });
                                console.log(`comparePivots: ${comparePivots}, '${headerHDP}' === '${currentTarget}'`);
                                if (comparePivots && checkHeader) {
                                    $element = $t.next();
                                }
                            }
                            break;
                        case 'T1_TOTAL':
                        case 'T2_TOTAL':
                            if ($(this).length > 0) {
                                elementText = $(this).html().replace(/&nbsp;/g, ' ');
                                let headerHDP = $(this).parent().parent()
                                    .find('div[class^="header-row"] div[class*="_style-uppercase"]')
                                    .html().replace(/&nbsp;/g, ' ');
                                let currentTarget = data.market === 'T1_TOTAL' ? team1 : team2;
                                let checkHeader = headerHDP.toLowerCase() === currentTarget;
                                pivotKeys = market.pivotKeys;
                                if (pivotKeys.indexOf(elementText) > -1 && checkHeader) {
                                    if (data.target === 'OVER') {
                                        $element = $(this).next();
                                    } else {
                                        $element = $(this).next().next();
                                    }
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

        return await performGet()
    };

    const getBetElementOldStyle = (data, markets) => {
        data.pivot = parseFloat(data.pivot);
        data.pivot = data.pivot.toString();
        let lMarkets = data.time_value === 'HALF_TIME'
            ? markets.half : data.time_value === 'TIME_1' ? markets.half : markets;
        console.log('%c' + 'Markets is:', 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        console.log(lMarkets);
        console.log(data.market, lMarkets[data.market]);
        let betElement;
        if (['TENNIS'].indexOf(data.sport) > -1 && data.time_value !== 'FULL_MATCH'
            && data.time_value.indexOf('GAME') > -1 && data.time_value.indexOf('SET') > -1
            && lMarkets[data.time_value]) {
            betElement = lMarkets[data.time_value][data.target];
        } else if (data.time_value.indexOf('SET') > -1 || data.time_value.indexOf('PERIOD') > -1
            || data.time_value.indexOf('MAP') > -1) {
            if (lMarkets[data.time_value] && lMarkets[data.time_value][data.market]) {
                const our = lMarkets[data.time_value][data.market];
                if (['TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                    betElement = our[data.pivot] ? our[data.pivot][data.target] : null;
                } else if (['HDP', 'CORNER_HDP'].indexOf(data.market) > -1) {
                    betElement = our[data.target] ? our[data.target][data.pivot] : null;
                } else {
                    betElement = our[data.target];
                }
            } else {
                throw `No record 1 for ${data.time_value}/${data.market}/${data.target}/${data.pivot} present!`;
            }
        } else if (lMarkets[data.market]) {
            const our = lMarkets[data.market];
            if (['TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                betElement = our[data.pivot] ? our[data.pivot][data.target] : null;
            } else if (['HDP', 'CORNER_HDP'].indexOf(data.market) > -1) {
                betElement = our[data.target] ? our[data.target][data.pivot] : null;
            } else {
                betElement = our[data.target];
            }
        } else {
            throw `No record 2 for ${data.time_value}/${data.market}/${data.target}/${data.pivot} present!`;
        }
        return betElement;
    };

    /**
     *
     * @param element
     * @param cornersElement
     * @param halfElement
     * @param timeEvents
     * @param bet
     * @return {Promise<any>}
     */
    const getMarkets = async (element, cornersElement, halfElement, timeEvents, bet, $headings) => {
        let markets = {
            'TOTAL': {}, //{pivot: false, 'OVER': false, 'UNDER': false},
            'T1_TOTAL': {}, //{pivot: false, 'OVER': false, 'UNDER': false},
            'T2_TOTAL': {}, //{pivot: false, 'OVER': false, 'UNDER': false},
            'CORNER_TOTAL': {}, // {pivot: false, 'OVER': false, 'UNDER': false},
            'HDP': {HOME: {}, AWAY: {}}, // {pivot_HOME: false, pivot_AWAY: false, 'HOME': false, 'AWAY': false},
            'CORNER_HDP': {HOME: {}, AWAY: {}}, // {pivot_HOME: false, pivot_AWAY: false, 'HOME': false, 'AWAY': false},
            'ONE_TWO': {
                'ONE': false,
                'TWO': false,
                'DRAW': false,
                'ONE_DRAW': false,
                'TWO_DRAW': false,
                'ONE_TWO': false
            },
            half: {
                'TOTAL': {},
                'T1_TOTAL': {},
                'T2_TOTAL': {},
                'HDP': {HOME: {}, AWAY: {}},
                'ONE_TWO': {
                    'ONE': false,
                    'TWO': false,
                    'DRAW': false,
                    'ONE_DRAW': false,
                    'TWO_DRAW': false,
                    'ONE_TWO': false
                }
            }
        };
        let tDigit, period;
        let $row = $([]);
        if (bet.market.indexOf('CORNER') > -1) {
            $row = $(cornersElement);
        } else if (bet.time_value.indexOf('FULL') > -1) {
            $row = $(element);
        } else if (bet.time_value.indexOf('HALF') > -1) {
            $row = $(halfElement);
        } else {
            // Hint: Period
            tDigit = bet.time_value.replace(/[^\d]/g, '').trim();
            period = Object.keys(timeEvents).find(k => k.indexOf(tDigit) > -1);
            $row = $(timeEvents[period]);
        }
        if (!$row || $row.length === 0) {
            throw 'No row!';
        }
        // Hint: the idea is to collect markets for our $row (half/period/full/corners) and then
        // Hint: pass it to the necessary part of markets' tree
        const $buttons = $row.find('div[class^="table-component-factor-value"]');
        console.log('%c' + 'Buttons:',
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        console.log($buttons);
        let numbers = {};
        if ($headings.length > 0) {
            // Hint: bets located in the row
            numbers = {
                'ONE': -1,
                'TWO': -1,
                'DRAW': -1,
                'ONE_DRAW': -1,
                'ONE_TWO': -1,
                'TWO_DRAW': -1,
                'HDP_HOME': -1,
                'HDP_AWAY': -1,
                'TOTAL_PIVOT': -1,
                'TOTAL_OVER': -1,
                'TOTAL_UNDER': -1,
            };
            const as = {
                'X': 'DRAW',
                '1X': 'ONE_DRAW',
                '12': 'ONE_TWO',
                'X2': 'TWO_DRAW',
                'Total': 'TOTAL_PIVOT',
                'O': 'TOTAL_OVER',
                'U': 'TOTAL_UNDER',
            };
            $headings.find('div[class^="table-component-text"]').each(function (idx) {
                const t = $(this).trt();
                // console.log('%c' + `CHECK IT: ${idx} => '${$(this).trt()}'`,
                //     'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                if (t === '1' && numbers.ONE === -1) {
                    numbers.ONE = idx - 1;
                } else if (t === '1' && numbers.ONE > -1) {
                    numbers.HDP_HOME = idx - 1;
                } else if (t === '2' && numbers.TWO === -1) {
                    numbers.TWO = idx - 1;
                } else if (t === '2' && numbers.TWO > -1) {
                    numbers.HDP_AWAY = idx - 1;
                } else if (as[t]) {
                    const adder = as[t] === 'HDP_AWAY' ? 0 : as[t].indexOf('TOTAL') > -1 ? 0 : 0;
                    numbers[as[t]] = (idx - 1) + adder;
                }
            });
        }
        console.log(numbers);
        markets['ONE_TWO']['ONE'] = $buttons[0];
        markets['ONE_TWO']['TWO'] = $buttons[2];
        markets['ONE_TWO']['DRAW'] = $buttons[1];
        ['ONE_DRAW', 'ONE_TWO', 'TWO_DRAW']
            .forEach(c => numbers[c] ? markets['ONE_TWO'][c] = $buttons[numbers[c]] : null);
        if (numbers.TOTAL_PIVOT) {
            markets['TOTAL'][$buttons[numbers.TOTAL_PIVOT].textContent] = {
                'OVER': $buttons[numbers.TOTAL_OVER],
                'UNDER': $buttons[numbers.TOTAL_UNDER]
            };
        }
        if (numbers.HDP_HOME) {
            markets['HDP']['HOME'][$buttons.eq(numbers.HDP_HOME).find('span:first').trt()
                .replace('+', '')] = $buttons.eq(numbers.HDP_HOME + 1).find('span:last').get(0);
        }
        if (numbers.HDP_AWAY) {
            markets['HDP']['AWAY'][$buttons.eq(numbers.HDP_AWAY).find('span:first').trt()
                .replace('+', '')] = $buttons.eq(numbers.HDP_AWAY + 1).find('span:last').get(0);
        }
        // Hint: bets from details
        const $details = $row.next();
        if (!$details.attr('class') ||
            $details.attr('class').indexOf('details-container') === -1) {
            throw 'Wrong details!';
        }
        const accordanceRu = {
            'Исходы': 'ONE_TWO',
            'Фора': 'HDP',
            'Тотал': 'TOTAL',
            'Форы': 'HDP',
            'Тоталы': 'TOTAL',
            'Инд. тоталы-1': 'T1_TOTAL',
            'Инд. тоталы-2': 'T2_TOTAL',
        };
        const accordance = {
            'Hcap': 'HDP',
            'Total': 'TOTAL',
            'Totals': 'TOTAL',
            'Team Totals-1': 'T1_TOTAL',
            'Team Totals-2': 'T2_TOTAL',
            '1x2': 'ONE_TWO'
        };
        $details.find('div[class^="grid--"]').each(function () {
            const caption = $(this).find('div[class^="grid-caption"]').trt();
            if (!accordance[caption]) {
                //console.log(`!accordance '${caption}'`);
                return true;
            }
            // Hint: specially for debug
            if (!markets[accordance[caption]]) {
                markets[accordance[caption]] = {};
                if (accordance[caption] === 'HDP') {
                    markets[accordance[caption]]['HOME'] = {};
                    markets[accordance[caption]]['AWAY'] = {};
                }
            }
            const $rows = $(this).find('div[class^="grid-table"] > div');
            if (accordance[caption].indexOf('TOTAL') > -1) {
                for (let i = 1; i < $rows.length; i++) {
                    const pivot = $rows.eq(i).find('div').eq(0).trt();
                    const $cols = $rows.eq(i).find('div:not([class])');
                    markets[accordance[caption]][pivot] = {
                        'OVER': $cols.eq(0).get(0),
                        'UNDER': $cols.eq(1).get(0),
                    };
                }
            } else if (accordance[caption] === 'HDP') {
                for (let i = 1; i < $rows.length; i++) {
                    const $pivots = $rows.eq(i).find('div[class^="param"]');
                    const $values = $rows.eq(i).find('div:not([class])');
                    markets['HDP']['HOME'][$pivots.eq(0).trt().replace('+', '')] = $values.eq(0).get(0);
                    markets['HDP']['AWAY'][$pivots.eq(1).trt().replace('+', '')] = $values.eq(1).get(0);
                }
            } else if (accordance[caption] === 'ONE_TWO') {
                const $values = $rows.eq(1).find('div:not([class])');
                markets['ONE_TWO']['ONE_DRAW'] = $values.eq(0).get(0);
                markets['ONE_TWO']['ONE_TWO'] = $values.eq(1).get(0);
                markets['ONE_TWO']['TWO_DRAW'] = $values.eq(2).get(0);
            }

        });
        // Hint: relocate if necessary
        if (bet.market.indexOf('CORNER') > -1) {
            markets['CORNER_TOTAL'] = markets['TOTAL'];
            markets['CORNER_HDP'] = markets['HDP'];
        } else if (bet.time_value.indexOf('FULL') > -1) {
            // Do nothing
        } else if (bet.time_value.indexOf('HALF') > -1) {
            markets.half = {
                'TOTAL': markets['TOTAL'],
                'T1_TOTAL': markets['T1_TOTAL'],
                'T2_TOTAL': markets['T2_TOTAL'],
                'HDP': markets['HDP'],
                'ONE_TWO': markets['ONE_TWO']
            };
        } else {
            // Hint: Period
            const accordanceRu = {
                'сет': 'SET',
                'период': 'PERIOD',
                'карта': 'MAP',
                'unknown': '',
            };
            const accordance = {
                'set': 'SET',
                'period': 'PERIOD',
                'map': 'MAP',
                'unknown': '',
            };
            const key = Object.keys(accordance).find(k => period.indexOf(k) > -1) || 'unknown';
            const root = `${accordance[key]}_${period.replace(/[^\d]/g, '').trim()}`;
            markets[root] = {
                'ONE_TWO': markets['ONE_TWO'],
                'TOTAL': markets['TOTAL'],
                'HDP': markets['HDP'],
            };
        }
        // Hint: that's it!
        console.log('%c' + 'Markets:',
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        console.log(markets);
        return markets;

    };

    /**
     *
     * @param bet
     * @returns {Promise<{Object}>}
     * @return {Object} Object.data
     * @return {Object} Object.matchedEvent
     * @return {Object} Object.cornersEvent
     * @return {Object} Object.halfEvent
     *      matchedEvent.element (a.table__match-title-text)
     *      cornersEvent (tr.table__row)
     *      halfEvent (tr.table__row)
     */
    const findEvent = async bet => {
        dLog('', 'FON', ['Find event:', bet]);
        let separator = '—';
        let matchedEvent = {
            element: null,
            straight: false
        };
        let cornersEvent = null;
        let halfEvent = null;
        const checkDate = $el => {
            return true;
        };
        const checkSport = href => {
            if (!href) {
                return false;
            }
            const accordance = {
                'FOOTBALL': 'football',
                'HOCKEY': 'hockey',
                'VOLLEYBALL': 'volleyball',
                'TENNIS': 'tennis',
                'TABLETENNIS': 'table-tennis',
                'BASEBALL': 'baseball',
                'BASKETBALL': 'basketball',
                'CYBERSPORT': 'esports',
            };
            const parts = href.split('/');
            return accordance[bet.sport] && parts
                && [2, 3].some(i => parts[i] && parts[i] === accordance[bet.sport]);
        };
        if (bet.type === 'PREMATCH' && document.location.href.indexOf('/line') === -1) {
            await mouseChain({
                target: $('a[href="/sports/"]')[0], events: fullClick, error: 'Prematch'
            });
            await delayPromise(3000);
        } else if (bet.type === 'LIVE' && document.location.href.indexOf('/live') === -1) {
            await mouseChain({
                target: $('a[href="/live/"]')[0], events: fullClick, error: 'Live'
            });
            await delayPromise(3000);
        }
        const eventName = `${bet.team1} ${separator} ${bet.team2}`.toLowerCase();
        dLog('', 'FON', `Ready to start finding ${eventName}`);
        // Hint: switch to sport
        const accordance = {
            'FOOTBALL': 'Football', //'Футбол',
            'HOCKEY': 'Hockey', //'Хоккей',
            'VOLLEYBALL': 'Volleyball', //'Волейбол',
            'TENNIS': 'Tennis', //'Теннис',
            'TABLETENNIS': 'Table tennis', //'Настольный теннис',
            'BASEBALL': 'Baseball', //'Бейсбол',
            'BASKETBALL': 'Basketball', //'Баскетбол',
            'CYBERSPORT': 'Esports', //'Киберспорт',
        };
        let ord = bet.sport === 'CYBERSPORT' ? 'first' : 'last';
        let sp1sel = `div[class^="filter-component-row-container"] a:${ord}`;
        let sportsWay = 1;
        if ($(sp1sel).length === 0) {
            await mouseChain({
                target: $('div[class^="filter-item-drop-down-element__button"]:last')[0],
                events: fullClick, error: 'sp2 - first',
            });
            await delayPromise(1000);
            ord = ord === 'first' ? 'nth-child(2)' : ord;
            sp1sel = `a[class^="filter-component-drop-down-element-item"]:${ord}`;
            sportsWay = 2;
        }
        if ($(sp1sel).length > 0) {
            await mouseChain({
                target: $(sp1sel)[0],
                events: fullClick, error: `sp1sel`
            });
        }
        await delayPromise(1000);
        const cs = accordance[bet.sport];
        if (sportsWay === 2) {
            await mouseChain({
                target: $('div[class^="filter-item-drop-down-element__button"]').eq(1)[0],
                events: fullClick, error: 'sp2 - second',
            });
            await delayPromise(1000);
        }
        await mouseChain({
            target: $(sportsWay === 1
                ? `div[class^="filter-component-row-container"]:has(span:textEquals("${cs}")) a`
                : `a[class^="filter-component-drop-down-element-item"]:has(span:textEquals("${cs}"))`
            )[0],
            events: fullClick, error: `Open ${cs}`
        });
        // Hint: find event new way - supports virtual DOM
        const $el = () => $('div[class^="sport-section-virtual-list"] > div');
        await waitForCondition(() => $el().length > 0, 333, 10000);
        await delayPromise(1000);
        let $cur = $el().eq(0), $this, idx = 0;
        let $headings = $([]);
        do {
            $cur[0].scrollIntoView(true);
            await delayPromise(25);
            $this = $cur.find('a');
            if ($this.length > 0) {
                const eventHere = $this.trt().toLowerCase();
                console.log($this.trt() + ' => ' + $this.attr('href'));
                if (bet.bk_event_native_id) {
                    const parts = $this.attr('href').split('/');
                    const idHere = parts.length > 3 ? parts[parts.length - 2].trim() : '';
                    if (idHere === bet.bk_event_native_id) {
                        const eParts = eventHere.split(` ${separator} `);
                        if (eParts.length !== 2) {
                            dLog('red', 'FON', `Strange eventHere: '${eventHere}'`);
                        } else {
                            bet.team1 = eParts[0].trim();
                            bet.team2 = eParts[1].trim();
                        }
                        matchedEvent = {element: $this.get(0), straight: true};
                        break;
                    } else {
                        console.log(`'${idHere}' !== '${bet.bk_event_native_id}'`);
                    }
                } else {
                    console.log(`'${eventHere}' === '${eventName}'`,
                        checkSport($this.attr('href')), checkDate($this));
                    if (checkSport($this.attr('href')) && checkDate($this)
                        && (eventHere === eventName
                            || locutus_similar_text(eventHere, eventName, true) > 80)) {
                        matchedEvent = {element: $this.get(0), straight: true};
                        break;
                    }
                }
            } else {
                if ($cur.attr('class') && $cur.attr('class').indexOf('sport-competition-') > -1) {
                    $headings = $cur.clone();
                }
            }
            $cur = $cur.next();
        } while ($cur.length > 0);
        // Hint: finish
        if (matchedEvent.element === null) {
            throw `Event ${bet.team1} - ${bet.team2} (${bet.bk_event_native_id}) not found!`;
        }
        let $matchRow = $(matchedEvent.element).parent().parent().parent();
        const $closeBtn = $matchRow.find('div[class*="_details-expanded"]:visible');
        if ($closeBtn.length > 0) {
            await mouseChain({target: $closeBtn[0], events: fullClick, error: '$closeBtn', scroll: true});
            await delayPromise(3000);
        }
        const $icon = $matchRow.find('div[class^="table-component-expander"]');
        if ($icon.attr('class') && $icon.attr('class').indexOf('collapsed') > -1) {
            await mouseChain({target: $icon[0], events: fullClick, error: 'expand row', scroll: true});
            await delayPromise(3000);
        }

        // Try to find Corners and 1st half
        let $cornersRow = null;
        let $halfRow = null;
        const timeRows = {};
        //var $matchRow = $($('a.table__match-title-text:contains("SV Post Wien — Mannsworth")')[0]).parent().parent().parent();
        let $next = $matchRow.next();
        // Hint: let's find all sets, halves, etc.
        $next.get(0).scrollIntoView(true);
        await delayPromise(3000);

        //expand more info if needed
        let $nextExpand = $next;
        while ($nextExpand.find('div[class^="table-component-favorite"]').length === 0) {
            if (!$nextExpand.attr('class')) {
                console.log('%c' + 'OHHHH2',
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                console.log($nextExpand);
                await delayPromise(5000);
            }
            if ($nextExpand.attr('class') && $nextExpand.attr('class').indexOf('sport-show-more') > -1) {
                const text = $nextExpand.find('div[class*="sport-show-more__caption"]').trt();
                if (text && text.indexOf('Show more') > -1 && bet.market === 'CORNER_TOTAL') {
                    await mouseChain({
                        target: $nextExpand.find('div[class*="sport-show-more__caption"]')[0],
                        events: fullClick, error: `show more`
                    });
                    await delayPromise(3000);
                }
            }
            $nextExpand = $nextExpand.next();
        }

        while ($next.find('div[class^="table-component-favorite"]').length === 0) {
            if (!$next.attr('class')) {
                console.log('%c' + 'OHHHH',
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                console.log($next);
                await delayPromise(5000);
            }
            if ($next.attr('class') && $next.attr('class').indexOf('sport-base-event') > -1) {
                let text = $next.find('div[class*="sport-sub-event__name"]').trt();
                if (text && text.indexOf('угловые') > -1 || text.indexOf('corners') > -1) {
                    $cornersRow = $next;
                    cornersEvent = $cornersRow.length === 1 ? $cornersRow[0] : null;
                } else if (text && ['1-й тайм', '1st half'].indexOf(text) > -1) {
                    $halfRow = $next;
                    halfEvent = $halfRow.length === 1 ? $halfRow[0] : null;
                } else if (text && (text.indexOf('set') > -1 || text.indexOf('сет') > -1
                    || text.indexOf('period') > -1 || text.indexOf('период') > -1
                    || text.indexOf('map') > -1 || text.indexOf('карта') > -1
                    || text.indexOf('quarter') > -1 || text.indexOf('четверть') > -1) && $next.length > 0) {
                    if (['угловые', 'corners'].indexOf(text) > -1) {
                        $cornersRow = $next;
                        cornersEvent = $cornersRow.length === 1 ? $cornersRow[0] : null;
                    } else if (['1-й тайм', '1st half'].indexOf(text) > -1) {
                        $halfRow = $next;
                        halfEvent = $halfRow.length === 1 ? $halfRow[0] : null;
                    } else if (text.indexOf('сет') > -1 || text.indexOf('set') > -1
                        || text.indexOf('период') > -1 || text.indexOf('period') > -1
                        || text.indexOf('карта') > -1 || text.indexOf('map') > -1
                        || text.indexOf('четверть') > -1 || text.indexOf('quarter') > -1 && $next.length > 0) {
                        timeRows[text] = $next[0];
                    }
                }
                console.log('%c' + `${$next.attr('class')} => `
                    + `${$next.find('div[class*="sport-sub-event__name"]').trt()}`,
                    'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            }
            $next = $next.next();
        }
        const found = {
            data: bet,
            matchedEvent: {element: $matchRow.get(0)},
            cornersEvent: cornersEvent,
            halfEvent: halfEvent,
            timeEvents: timeRows,
            $headings: $headings,
        };
        // Hint: expand we need
        const expand = async row => {
            await mouseChain({
                target: $(row).find('div[class*="sport-base-event__other-factors"]')[0],
                events: fullClick, error: 'expand', scroll: true,
            });
            await delayPromise(3000);
        };
        if (bet.market.indexOf('CORNER') > -1) {
            await expand(found.cornersEvent);
        } else if (bet.time_value.indexOf('FULL') > -1) {
            await expand(found.matchedEvent.element);
        } else if (bet.time_value.indexOf('HALF') > -1) {
            await expand(found.halfEvent);
        } else {
            const tDigit = bet.time_value.replace(/[^\d]/g, '').trim();
            const our = Object.keys(found.timeEvents).find(k => k.indexOf(tDigit) > -1);
            await expand(found.timeEvents[our]);
        }
        return found;
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
            bMess('FON_RU').set(ourCommand.get())
                .then(() => dLog('green', 'fonru', ['Command was set till unload:', ourCommand.get()]))
        }
    }, true);

    function afterDOMLoaded() {
        (async () => {
            const command = await bMess('FON_RU').check(40000);
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
