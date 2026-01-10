"use strict";

(function () {

    if (document.location.href.indexOf('playmeagame.com') > -1
        || document.location.href.indexOf('secpaysys.com') > -1) {
        dLog('blue', 'Olimp', `PAYMENT MODE ${document.location.href}`);
        let command;
        (async () => {
            command = await bMess('QIWI_COMMAND', true).check(30000);
            const $ph = await waitForElement('input[id^="qiwi_phone-"]', 300, 15000);
            await clearAndSimulate($ph[0], (command.data.login.indexOf('+') === -1 ? '+' : '') + command.data.login);
            await delayPromise(1000);
            const pSel = '#make_payment_billing_info';
            let i = 0;
            while (i < 10) {
                const $pb = await waitForElement(pSel, 300, 30000, true)
                    .catch(() => $([]));
                if ($pb.length === 0) {
                    break;
                }
                await delayPromise(10000);
                command.qiwiEnteredSpecial = true;
                await bMess('OLIMPOLD_COMMAND', true).set(command, 150000);
                await bMess('QIWI_COMMAND', true).set(command);
                await mouseChain({target: $(pSel)[0], events: fullClick, error: 'pay button'});
                i++;
                console.log('%c' + `PB clicked ${i}!`,
                    'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            }
        })()
            .catch(e => command ? qiwiReport(command, false, `ogixz: ${e}!`) : console.error(e));
        return;
    }

    let needStop = false;
    let currency = '';
    let lastCoef = 0;
    let lastSMS = '';
    let authClicked = 0;
    let wasAuthCheck = false;
    let increaseDelay = false;
    let busy = false;
    let busyReleased = Date.now();
    const kzDomain = 'olimpbet.kz';
    const bkHere = window.location.href.indexOf(kzDomain) > -1 ? "olimpkz" : "olimpold";
    let port = chrome.runtime.connect({name: `port_${bkHere}`});
    let settings = {
        authCheckInterval: 2000,
        url: 'https://olimp.com/betting',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        email: '',
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 1,
        betweenBets: 25000,
    };
    let lastMax = -1;

    let newAPI = false;

    const setBusy = off => {
        if (off) {
            busy = false;
            busyReleased = Date.now();
        } else {
            busy = true;
        }
        bMess(`olimpold_busy`).set(busy).finally();
    };

    let currentBetData = false;
    let currentCommand = '';

    let ourCommand = new ourCommandProto();

    let smsApiMessage;

    let messageProcessor = function (message) {
        console.log('messageProcessor', message, busy);
        newAPI = !!message.newAPI;
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        }
        if (message.action === 'CHECK_LIMITED') {
            waitForCondition(() => !busy, 333, 600000, 'still busy')
                .then(async () => {
                    setBusy();
                    ourCommand.set(message);
                    await checkLimited().catch(e => dLog('red', 'Olimp',
                        `Error till checkLimited ${e}, ${formatStack(e.stack)}`));
                    setBusy(true);
                    ourCommand.clear();
                })
                .catch(e => dLog('red', 'Olimp', `Error till CHECK_LIMITED ${e}, ${formatStack(e.stack)}`));
            return;
        }
        if (message.action === 'MAXIMUM' && message.data[0].fork && busy) {
            waitForCondition(() => !busy, 200, 30000, 'Still busy!')
                .then(() => messageProcessor(message))
                .catch(e => chrome.runtime.sendMessage({
                    loggerName: 'textLogger',
                    params: {data: `olimp MAXIMUM ${e} for ` + JSON.stringify(message)}
                }));
            return;
        }
        if (message.action === 'NEED_STOP') {
            needStop = true;
            setBusy(true);
            return;
        } else if (message.action !== 'NEED_STOP' && !ourCommand.isSet()) {
            needStop = false;
        }
        currentCommand = message.action;
        let $logLink = $('div.log-area button.enterBtn');
        if (message.action === 'SMS') {
            lastSMS = message.data;
        } else if (message.action === 'SMS_API' && typeof message.data !== 'undefined') {
            smsApiMessage.setMessage(message.data.status, message.data.message);
        } else if (message.action !== 'auth' && busy) {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY"
            });
        } else if (message.action === "auth") {
            if (message.login === 'reger') {
                bsDebug(port, 'Awaiting for registration command!');
                checkLanguage()
                    .then(() => bsDebug(port, 'Switched to Russian!'))
                    .catch((e) => bsError(port, 'Switching to Russian: ' + e));
                return;
            }
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.phone = message.phone;
            settings.uid = message.uid;
            settings.email = message.email;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = 1;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            wasAuthCheck = true;
            smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);
            authCheck();
        } else if (message.action === "takeScreenshot") {
            screenshotHelper(port, 'olimpold', ['table.live_main_table', '#betline'], message.data);
        } else if (message.action === 'REGISTER') {
            setBusy();
            ourCommand.set(message);
            register(message.data)
                .then(() => bsDebug(port, 'It\'s looks like ' + message.action + ' done!'))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(() => {
                    setBusy(true);
                    ourCommand.clear();
                });
        } else if ($logLink.length !== 0) {
            port.postMessage({answered: message.action, status: "FAILED", answer: "Not logged in!"});
        } else if (message.action === 'MAXIMUM') {
            setBusy();
            ourCommand.set(message);
            bsDebug(port, 'MAXIMUM for: ' + message.data[0].market + '/' + message.data[0].target + '/' + message.data[0].pivot);
            let max;
            const r = (success, e) => {
                setBusy(true);
                port.postMessage({
                    answered: 'MAXIMUM',
                    status: success ? 'success' : 'error',
                    answer: success ? (message.data[0].fork ? {
                        max: max,
                        coef: lastCoef,
                        balance: getBalance(),
                        currency: currency
                    } : max) : "Error: " + e
                });
                ourCommand.clear();
            };
            closePreviousCoupons()
                .then(() => openCoupon(message.data))
                .then(m => max = m)
                .then(() => checkCoefs(message.data))
                .then(() => r(true, ''))
                .catch(e => r(false, e));
        } else if (message.action === 'BET_RESULT') {
            setBusy();
            ourCommand.set(message);
            const r = (success, m) => {
                success ? bsDebug(port, "It's looks like BET_RESULT done!") : bsError(port, 'Error till BET_RESULT: ' + e);
                setBusy(true);
                ourCommand.clear();
                port.postMessage({
                    answered: "BET_RESULT",
                    status: success ? "success" : "error",
                    answer: m
                });
            };
            collectBetResults(message.data)
                .then(collected => r(true, collected))
                .catch(e => r(false, e))
                .then(() => mouseChain({
                    target: $('a[data-id="shlinelive"]')[0],
                    events: ['click'],
                    scroll: true
                }));
        } else if (['BET', 'EXPRESS_BET', 'DEPOSIT', 'WITHDRAW', 'CHECK_PAYMENTS', 'READY_TO_BET', 'ARB_BET', 'MONITOR'].indexOf(message.action) > -1) {
            setBusy();
            ourCommand.set(message);
            ({
                'BET': proceedBet, 'EXPRESS_BET': proceedBet,
                'CHECK_PAYMENTS': checkPayments, 'DEPOSIT': deposit, 'WITHDRAW': withdraw,
                'READY_TO_BET': proceedSpecialBet, 'ARB_BET': proceedSpecialBet,
                'MONITOR': monitor
            }[message.action])(['READY_TO_BET', 'ARB_BET'].indexOf(message.action) > -1 ? message : message.data)
                .then(() => bsDebug(port, 'It\'s looks like ' + message.action + ' done!'))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(() => {
                    setBusy(true);
                    ourCommand.clear();
                    bsDebug(port, 'Command was cleared!');
                    //return mouseChain({target: $('#live_href')[0], events: ['click'], scroll: true});
                });
        }
    };

    const checkLimited = async () => {
        const next = async () => {
            ourCommand.add('checking', checking + 1);
            await checkLive();
            await delayPromise(30000);
        };
        const checking = ourCommand.getAdded('checking', 0);
        if ($('div.gameNameLine span[id^="match_live_name_"]').text().trim() !== '') {
            // Hint: we're on event, could check
            const $tls = $('div.tab span.googleStatIssue:has(span.googleStatIssueName:textStarts("Тот("))');
            if ($tls.length === 0) {
                await next();
            }
            const $coefs = $tls.find('#googleStatKef');
            if ($coefs.length !== 2) {
                await next();
            }
            const m = 1 / parseFloat($coefs.eq(0).text().trim()) + 1 / parseFloat($coefs.eq(1).text().trim());
            if (isNaN(m)) {
                await next();
            }
            port.postMessage({
                answered: 'CHECK_LIMITED',
                limited: m > 1.1,
                answer: m > 1.1 ? `Margin is ${m} > 1.1` : 'FREE',
            });
        } else {
            // Hint: we're on live, need event
            await uncheckSports('');
            await mouseChain({
                target: $('a.l-name-tab[id^="match_live_name_"]:visible').eq(checking)[0],
                events: fullClick, error: 'event',
            });
            await delayPromise(30000);
        }
    };

    const getOdds = () => {
        const marketAccordance = {
            'ONE_TWO': ['main'],
            'TOTAL': ['main', 'Доп. тотал:', 'Азиатские тоталы:'],
            'T1_TOTAL': ['Инд.тотал:'],
            'T2_TOTAL': ['Инд.тотал:'],
            'HDP': ['main', 'Победа с учетом форы:', 'Азиатские форы:'],
            'EURO_HDP': ['Победа с учетом форы 3 исхода:']
        };
        const targetAccordance = {
            // Hint: smallest pivots must be in the end, cuz I using indexOf instead of ===
            'ONE_TWO': {
                'ONE': ['П1'],
                'TWO': ['П2'],
                'ONE_DRAW': ['1Х'],
                'TWO_DRAW': ['Х2'],
                'DRAW': ['Х'],
                'ONE_TWO': ['12'],
            },
            'TOTAL': {
                'OVER': ['бол'],
                'UNDER': ['мен']
            },
            'T1_TOTAL': {
                'OVER': ['бол'],
                'UNDER': ['мен']
            },
            'T2_TOTAL': {
                'OVER': ['бол'],
                'UNDER': ['мен']
            },
            'HDP': {
                'HOME': ['Ф1', '#TEAM1#'],
                'AWAY': ['Ф2', '#TEAM2#']
            },
            'EURO_HDP': {
                'H1': ['#TEAM1#'],
                'HX': ['Ничья'],
                'H2': ['#TEAM2#']
            }
        };
        const parseNobr = (nobr, market) => {
            const $nobr = $(nobr);
            const rMarket = market === 'main' ? 'main' : $nobr.prevAll('b').first().text().trim();
            const $gsk = $nobr.find('span[id="googleStatKef"]');
            let res = [];
            if ($gsk.length === 2) {
                let probablyName = $nobr.find('span.googleStatIssueName').text().trim();
                let temp = $nobr.html();
                //console.log(temp);
                if (probablyName.indexOf('Тот(') > -1) {
                    // Hint: Main Total
                    temp = temp.replace('М -', '<span class="ownPvt">мен</span>')
                        .replace('Б -', '<span class="ownPvt">бол</span>');
                } else if (probablyName.length === 0) {
                    // Hint: Goals
                    temp = temp.replace('Обе забьют: да -', '<span class="ownPvt">Обе забьют: да</span>')
                        .replace('Обе забьют: нет -', '<span class="ownPvt">Обе забьют: нет</span>');
                } else if (['Инд.тотал:', 'Победа и тотал:', 'Доп. тотал:', 'Азиатские тоталы:'].indexOf(rMarket) > -1) {
                    // Hint: T1_TOTAL, T2_TOTAL, WIN_TOTAL
                    if (['Инд.тотал:'].indexOf(rMarket) > -1) {
                        temp = temp.replace(new RegExp('(' + team1 + '.*?)\\s-', 'g'), '<span class="ownPvt">$1</span>')
                            .replace(new RegExp('(' + team2 + '.*?)\\s-', 'g'), '<span class="ownPvt">$1</span>');
                    } else {
                        temp = temp.replace(new RegExp('(' + team1 + '.*?)\\s-', 'g'), '<span class="ownPvt">$1</span>')
                            .replace(new RegExp('(' + team2 + '.*?)\\s-', 'g'), '<span class="ownPvt">$1</span>')
                            .replace(/(Ничья.*?)\s-/g, '<span class="ownPvt">$1</span>')
                            .replace(/(1Х.*?)\s-/g, '<span class="ownPvt">$1</span>')
                            .replace(/(12.*?)\s-/g, '<span class="ownPvt">$1</span>')
                            .replace(/(Х2.*?)\s-/g, '<span class="ownPvt">$1</span>')
                            .replace(/(Тотал \([\d.]+\) мен)/g, '<span class="ownPvt">$1</span>')
                            .replace(/(Тотал \([\d.]+\) бол)/g, '<span class="ownPvt">$1</span>');
                    }
                    probablyName = '';
                }
                const $temp = $('<span>' + temp + '</span>');
                const $gsk2 = $temp.find('span[id="googleStatKef"]');
                const $ownPvt = $temp.find('span.ownPvt');
                [0, 1].forEach((i) => res.push({
                    market: rMarket,
                    target: (probablyName.length > 0 ? probablyName + ' ' : '') + $ownPvt.eq(i).text().trim(),
                    odd: $gsk2.eq(i).text().trim(),
                }));
                if ($ownPvt.length !== 2) {
                    console.log(`${rMarket} '${team1}' - '${team2}' (${probablyName})`);
                    console.log($nobr.html());
                    console.log(temp);
                    console.log('%c' + '--- --- ---', 'background: lightyellow;');
                }
            } else if ($gsk.length === 1) {
                res.push({
                    market: rMarket,
                    target: $nobr.find('span.googleStatIssueName').text().trim(),
                    odd: $gsk.eq(0).text().trim()
                });
            } else {
                console.log('%c' + 'Strange length of gsk:' + $gsk.length, 'background: red; color: white;');
            }
            return res;
        };
        const getMainOdds = () => {
            let odds = [];
            $('div[class="tab"]>nobr').each(function () {
                odds = odds.concat(parseNobr(this, 'main'));
            });
            return odds;
        };
        const getAdditionalOdds = () => {
            let odds = [];
            $('div[class="tab"]>div nobr').each(function () {
                odds = odds.concat(parseNobr(this, 'additional'));
            });
            return odds;
        };
        const findTarget = (market, target) => {
            if (typeof targetAccordance[market] === 'undefined') {
                return '';
            }
            for (let t in targetAccordance[market]) {
                if (targetAccordance[market].hasOwnProperty(t)) {
                    if (targetAccordance[market][t].some(
                        v => target.indexOf(v.replace('#TEAM1#', team1).replace('#TEAM2#', team2)) > -1)
                    ) {
                        return t;
                    }
                }
            }
            return '';
        };
        const findMarket = odd => {
            let r = [];
            for (let m in marketAccordance) {
                if (marketAccordance.hasOwnProperty(m) && marketAccordance[m].indexOf(odd.market) > -1) {
                    r.push(m);
                }
            }
            if (r.length === 3) {
                // Hint: main
                return odd.target.indexOf('Тот') > -1 ? 'TOTAL'
                    : (odd.target.indexOf('Ф') > -1 ? 'HDP' : 'ONE_TWO');
            } else if (r.length === 2) {
                // Hint: t1, t2
                return odd.target.indexOf(team1) > -1 ? 'T1_TOTAL' : 'T2_TOTAL';
            } else if (r.length === 1) {
                return r[0];
            } else {
                return '';
            }
        };
        const filterOdds = odds => {
            let result = {};
            odds.forEach((odd) => {
                const market = findMarket(odd);
                if (market !== '') {
                    if (typeof result[market] === 'undefined') {
                        result[market] = {};
                    }
                    const target = findTarget(market, odd.target);
                    if (target !== '') {
                        if (typeof result[market][target] === 'undefined') {
                            result[market][target] = {}; //[];
                        }
                        //result[market][target].push(odd);
                        if (market === 'ONE_TWO') {
                            result[market][target] = parseFloat(odd.odd);
                        } else {
                            const pivotDraft = /\((.*?)\)/.exec(odd.target);
                            if (pivotDraft !== null && typeof pivotDraft[1] !== 'undefined') {
                                result[market][target][pivotDraft[1]] = parseFloat(odd.odd);
                            } else {
                                console.log('Bad pivot: ' + odd.target);
                            }
                        }
                    } else {
                        console.log('Target not found for "' + market + '" in %O', odd);
                    }
                } else {
                    // Hint: we do not parse some markets :)
                }
            });
            return result;
        };
        const teams = $('span[id^="match_live_name"]').text().trim().split('-');
        const team1 = teams[0].trim(), team2 = teams[1].trim();
        let allOdds;
        try {
            allOdds = getMainOdds();
        } catch (e) {
            throw `getMainOdds: ${e}`;
        }
        try {
            allOdds = allOdds.concat(getAdditionalOdds());
        } catch (e) {
            throw `getAdditionalOdds: ${e}`;
        }
        //console.log(allOdds);
        try {
            allOdds = filterOdds(allOdds);
        } catch (e) {
            throw `filterOdds: ${e}`;
        }
        //console.log(allOdds);
        return allOdds;
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
                    console.log(`Scan performed after %c${startedAfter}%cs in %c${scanPerformed}%cs`,
                        'font-weight: bold; background: yellow; font-size: 13px;', '', 'font-weight: bold; background: yellow; font-size: 13px;', '');
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

    let register = function (data) {
        bsDebug(port, 'register!');
        return new Promise(function (onSuccess, onReject) {
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
            let getSecretQuestionAndAnsert = function () {
                function jsUcfirst(string) {
                    return string[0].toUpperCase() + string.slice(1);
                }

                let getMonth = function (months) {
                    return getRandomRounded(0, 1) === 1
                        ? jsUcfirst(months[getRandomRounded(0, 11)])
                        : months[getRandomRounded(0, 11)];
                };
                let aliases = [
                    'Чирий', 'Трэш', 'Тыр', 'Клямпер', 'Мальчик', 'Кривой', 'Бэн', 'Силя', 'Пашканчик', 'Терминатор', 'Батон',
                    'Кот', 'Сика', 'Шапито', 'Репа', 'Мозг', 'Боров', 'Свин', 'Свинец', 'Свиноеб', 'Навзик', 'Чиж', 'Лещ',
                    'Чиркан', 'Молодой', 'Панк', 'Пышный', 'Очки', 'Бух', 'Петух', 'Бокс', 'Губастый', 'Клюй', 'Васек',
                    'Крыл', 'Мамазона', 'Нос', 'Фрол', 'Базай', 'Воробей', 'Питон', 'Люссак', 'Пидаль', 'Иозеф', 'Микуль',
                    'Блин', 'Федот', 'Боб', 'Зевс', 'Вавилон', 'Гондурас', 'Кабан'
                ];
                let months1 = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
                let months2 = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
                let options = [
                    'Девичья фамилия Вашей бабушки?',
                    'Какое прозвище было у Вас в детстве?',
                    'Месяц и год рождения Вашего любимого спортсмена?'
                ];
                let random1 = getRandomRounded(0, 2);
                let random2 = getRandomRounded(0, 2);
                let answer = random1 === 0 ? data['mothers_maiden_name']
                    : random1 === 1 ? aliases[getRandomRounded(0, aliases.length - 1)]
                        : (random2 === 0 ? getRandomRounded(1970, 1990) + ' ' + getMonth(months1) :
                            random2 === 1 ? getMonth(months1) + ', ' + getRandomRounded(1965, 1995)
                                : getRandomRounded(2, 27) + ' ' + getMonth(months2) + ' ' + getRandomRounded(1972, 1993));
                return {
                    question: options[random1],
                    answer: answer
                };
            };
            let waitForConfirmUrl = function (timeout, maxWait) {
                let max = typeof maxWait === 'number' ? maxWait : 180000;
                return new Promise(function (onSuccess, onReject) {
                    let waitStarted = Date.now();
                    let performCheck = function () {
                        bsEmailCheck(data.email, 'OLIMP_CONFIRM_LINK', timeout)
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
            let regoroll = function () {
                let secret = getSecretQuestionAndAnsert();
                waitForElement('#registration_link_id:contains("Регистрация")', 333, 15000, true)
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                    .then(delayFunction(3333))
                    .then(waitForElementF('a:textEquals("Полная регистрация")', 333, 30000, true))
                    .then(($el) => delayPromise(3333, $el))
                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                    .then(waitForElementF('#sec_q_list_span:visible', 333, 15000, true))
                    .then(delayFunction(2222))
                    .then(() => {
                        $('#submit_full_reg')[0].scrollIntoView(false);
                    })
                    .then(delayFunction(2222))
                    .then(() => clearAndSimulate($('#given_name')[0], data['first_name']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('#family_name')[0], data['second_name']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('#additional_name')[0], data['third_name']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('#password')[0], data['password']))
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('#password_again')[0], data['password']))
                    .then(delayFunction(3333))
                    .then(() => {
                        $('#submit_full_reg')[0].scrollIntoView(false);
                        if ($('#country_flag').attr('src').indexOf('flags/RU.png') === -1) {
                            return mouseChain({target: $('#country_code')[0], events: ['click']})
                                .then(waitForElementF('li img.country-flag[src$="flags/RU.png"]:visible', 333, 7777, true))
                                .then(($el) => delayPromise(3333, $el))
                                .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                                .then(delayFunction(3333));
                        }
                    })
                    .then(() => clearAndSimulate($('#tel_number')[0], data['phone'].replace('+', '').replace(/^7/, '')))
                    .then(delayFunction(3333))
                    .then(() => {
                        let $email = $('#email');
                        $email.val(data['email']);
                        fireInputEvent($email[0]);
                        fireChangeEvent($email[0]);
                    })
                    .then(delayFunction(3333))
                    .then(() => clearAndSimulate($('#passport')[0], data['passport_number']))
                    .then(delayFunction(3333))
                    .then(() => {
                        let $cls = $('#currency_list_span');
                        if ($cls.text().indexOf('RUB') === -1) {
                            return mouseChain({target: $cls[0], events: ['click']})
                                .then(waitForElementF('a[data-id="3"]:visible', 333, 7777, true))
                                .then(($el) => delayPromise(3333, $el))
                                .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                                .then(delayFunction(3333));
                        }
                    })
                    .then(() => {
                        let $sqls = $('#sec_q_list_span');
                        if ($sqls.text().indexOf(secret.question) === -1) {
                            return mouseChain({target: $sqls[0], events: ['click']})
                                .then(waitForElementF('a:contains("' + secret.question + '"):visible', 333, 7777, true))
                                .then(($el) => delayPromise(3333, $el))
                                .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                                .then(delayFunction(3333));
                        }
                    })
                    .then(() => clearAndSimulate($('#sec_a')[0], secret.answer))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({target: $('label[for="accept_terms"]')[0], events: ['click']}))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({target: $('label[for="accept_terms_age"]')[0], events: ['click']}))
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
                    .then(delayFunction(3333))
                    .then(() => ourCommand.add('waitForEmail', Math.ceil(Date.now() / 1000) - 60))
                    .then(() => mouseChain({target: $('#submit_full_reg')[0], events: ['click']}))
                    .then((waitForElementF('#login_num:visible', 333, 20000)))
                    .then(($el) => {
                        $el.get(0).scrollIntoView();
                        ourCommand.add('olimp_id', $el.text().trim());
                    })
                    .then(() => waitForConfirmUrl(ourCommand.getAdded('waitForEmail')))
                    .then((code) => clearAndSimulate($('#reg_captcha').get(0), code))
                    .then(delayFunction(3333))
                    .then(() => mouseChain({target: $('#verify_code_email_approve')[0], events: ['click']}))
                    .then(delayFunction(7777))
                    .then(waitForCondition(() => {
                        return $('#err_full_reg_text:visible').length > 0
                            || $('div.verif_sucsess:textEquals("Ваш email адрес успешно верифицирован!"):visible').length > 0;
                    }, 333, 30000, 'no result', true))
                    .then(() => {
                        let $success = $('div.verif_sucsess:textEquals("Ваш email адрес успешно верифицирован!"):visible');
                        let $error = $('#err_full_reg_text:visible');
                        if ($success.length > 0) {
                            return true;
                        } else if ($error.length > 0) {
                            throw $error.text().trim();
                        }
                    })
                    .then(delayFunction(3333))
                    .then(() => mouseChain({target: $('#registation_closePopUp')[0], events: ['click']}))
                    .then(() => report(true, {
                        login: data['email'],
                        password: data['password'],
                        comment: 'ID:' + ourCommand.getAdded('olimp_id') + ', ' + secret.question + ': ' + secret.answer
                    }))
                    .catch((e) => report(false, 'Registration: ' + e));
            };
            //delayPromise(7777).then(() => report(true, {login: data['nickname'], password: data['password']}))
            delayPromise(1111).then(regoroll);
        });
    };

    let proceedSpecialBet = function (message) {
        bsDebug(port, 'proceedSpecialBet');
        let interval = typeof message.data[0].interval === 'undefined' ? 0 : parseInt(message.data[0].interval);
        let maximum = 0;
        let data = message.data;
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
            let balance = parseFloat($('span.currusum:not(.menusum)').text().replace(/[^0-9\.]/, '').trim());
            if (balance < parseFloat(message.data[0].stake)) {
                report(false, "LOW_FUNDS: we have " + balance + ", we need: " + data.stake);
                return;
            }
            if (message.action === 'READY_TO_BET') {
                data[0].coef = 1;
                closePreviousCoupons()
                    .then(() => openCoupon(data))
                    .then((max) => {
                        maximum = max;
                        chrome.storage.local.set({'OLIMP_READY_MAX': max}, function () {
                            bsDebug(port, 'Max is: ' + max);
                        });
                    })
                    .then(() => report(true, 'It might be okay!'))
                    .catch((e) => report(false, 'Error stage 1: ' + e));
            } else if (message.action === 'ARB_BET') {
                let maxTime = Date.now() + interval * 1000;
                let waitForCoef = function () {
                    checkCouponAndCoefs(data)
                        .then((res) => {
                            proceedBet(data)
                                .then((s) => onSuccess('Success during proceedBet: ' + s))
                                .catch((e) => onReject('Error during proceedBet: ' + e));
                            //report(true, {coef: res, stake: data[0].stake});
                        })
                        .catch((error) => {
                            if (error === 'WRONG_COUPON') {
                                report(false, 'Wrong coupon opened, it may be cuz of match is end, etc...');
                            } else if (Date.now() < maxTime) {
                                delayPromise(1000).then(waitForCoef);
                            } else {
                                if (!isNaN(error) && typeof data[0].fall_coef !== 'undefined' && !isNaN(parseFloat(data[0].fall_coef))
                                    && error >= parseFloat(data[0].fall_coef)) {
                                    data[0].coef = data[0].fall_coef;
                                    proceedBet(data)
                                        .then((s) => onSuccess('Success during proceedBet FALL_COEF: ' + s))
                                        .catch((e) => onReject('Error during proceedBet FALL_COEF: ' + e));
                                } else {
                                    report(false, 'We had wait for ' + (Date.now() - (maxTime - interval * 1000))
                                        + 'ms and nothing :(');
                                }
                            }
                        });
                };
                chrome.storage.local.get(['OLIMP_READY_MAX'], function (r) {
                    ourCommand.add('max', r.OLIMP_READY_MAX);
                    maximum = r.OLIMP_READY_MAX;
                    if (interval < 0) {
                        report(false, 'Wrong interval: ' + interval);
                    } else {
                        waitForCoef();
                    }
                });
            } else {
                report(false, 'Unsupported action: ' + message.action);
            }
        });
    };

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
                if (document.location.href.indexOf('page=account&action=history') > -1) {
                    waitForElement('table.table_as-account', 333, 15000)
                        .then(($table) => {
                            collected = [];
                            $table.find('tr').each(function () {
                                let $this = $(this);
                                let desc = $this.find('div.operation_name').text().replace('(Отмена)', '')
                                    .replace(/(?:\r\n|\r|\n)/g, ' ').trim();
                                let type = ['Снятие денег со счета', 'Подготовлено к снятию'].some(t => desc.indexOf(t) > -1) ? 'OUT' : 'IN';
                                let paysystem = '';
                                if (type === 'IN') {
                                    paysystem = desc.indexOf('MoneyBookers') > 0 ? 'SKRILL' : desc.indexOf('QiwiWallet') > 0 ? 'QIWI' : '';
                                } else {
                                    paysystem = desc.match(/.*\*\*\*\*\d\d.*/) !== null ? 'QIWI' :
                                        desc.match(/.*\*\*\*\*\w\w.*/) ? 'SKRILL' : '';
                                }
                                //console.log($this.find('div.apm-flow__ico_in'), desc);
                                if (desc !== '') {
                                    collected.push({
                                        date: $this.find('span.date').text().trim() + ' ' + $this.find('span.time').text().trim(),
                                        description: desc,
                                        type: type,
                                        paysystem: paysystem,
                                        amount: $this.find('div.summ').text().replace('-', '').trim(),
                                        success: true
                                    });
                                }
                            });
                            console.log(collected);
                            report(true, 'Collected')
                        })
                        .catch((e) => report(false, 'Catch: ' + e));
                } else {
                    waitForElement('#dropdownMenuLink1', 333, 15000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(1000))
                        .then(waitForElementF('a[role="menuitem"][href="/index.php?page=account&action=history"]', 333, 15000))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(3333))
                        .then(letsRockNRoll)
                        .catch((e) => report(false, 'Go to Transactions History: ' + e));
                }
            };
            letsRockNRoll();
        });
    };

    const withdraw = async data => {
        let error = false;
        const res = await withdrawDo(data).catch(e => (error = true, `Withdraw: ${e}, ${formatStack(e.stack)}`));
        dLog(error ? 'red' : 'green', 'Olimp', `Withdraw: ${res}`);
        port.postMessage({
            answered: "WITHDRAW",
            status: !error ? "SUCCESS" : "FAILED",
            answer: res
        });
        if (error) {
            throw error;
        }
    };

    const recognize = async () => {
        await waitForCondition(() => {
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
        }, 555, 200000, 'reCaptcha not solved for 200s');
        dLog('orange', 'Olimp', 'ReCaptcha solved!');
    };

    const enterSms = async route => {
        dLog('blue', 'Olimp', `Enter SMS & Captcha - route ${route}`);
        let captcha = false;
        const sendSel = '#txt_send_sms';
        const captchaImg = '#captcha_img';
        await waitForElement('#sms_code', 333, 15000);
        await delayPromise(1000);
        if ($(sendSel).length > 0) {
            await mouseChain({target: $(sendSel)[0], events: ['click'], error: 'sendSel'});
        }
        if (elementIsVisible($(captchaImg)[0])) {
            await mouseChain({target: $('#captcha_select')[0], events: ['click'], error: 'cptSel'});
            await waitForCondition(() => !elementIsVisible($(captchaImg)[0]),
                333, 10000, 'Captcha still visible!');
            await delayPromise(1000);
        }
        recognize().then(() => captcha = true);
        let code = '', startedInternal = Date.now();
        while (code === '' && Date.now() - startedInternal < 420000) {
            const res = await bsEmailCheck(settings.email, 'OLIMP_VERIFICATION_CODE',
                Math.ceil(Date.now() / 1000) - 5);
            dLog('green', 'Olimp', ['Email answer is', res]);
            if (res && res.status && res.status === 'success' && res.message && res.message[0] && res.message[0].data) {
                code = res.message[0].data;
                break;
            } else {
                await delayPromise(5000);
            }
        }
        if (code === '') {
            throw 'No email code received!';
        }
        await clearAndSimulate($('#sms_code')[0], code);
        await waitForCondition(() => captcha, 333, 100000, 'Captcha not recognized :(');
        ourCommand.add('smsAndCaptchaEntered', true);
        await mouseChain({target: $('#send_code')[0], events: ['click'], error: 'send_code'});
        dLog('green', 'Olimp', '-= SMS and CAPTCHA should be Okay! =-');
        await delayPromise(3000);
    };

    const withdrawDo = async data => {
        dLog('green', 'Olimp', ['Withdraw Do', data]);
        if ((ourCommand.getAdded('qiwiEntered') || ourCommand.getAdded('skrillEntered'))
            && (document.location.href.indexOf('page=account&action=history') > -1 || ourCommand.getAdded('enterSms'))) {
            // Hint: final page
            if (ourCommand.getAdded('enterSms')) {
                await waitForElement('#cashAlertWindowClose', 333, 60000, true);
                await delayPromise(3000);
                const h = $('div.headTitle').text().trim();
                if (h.indexOf('Подготовить деньги к снятию') === -1) {
                    throw `CHECK IT: ${h} / ${ourCommand.getAdded('enterSms')}`;
                }
            }
            const $c = $('#cashAlertWindowClose');
            if ($c.length > 0) {
                await mouseChain({target: $c[0], events: ['click'], error: '$c'});
            }
            return 'All seems to be Okay :)';
        } else if ((ourCommand.getAdded('qiwiEntered') || ourCommand.getAdded('skrillEntered'))
            && document.location.href.indexOf('index.php') > -1) {
            // Hint: SMS and CAPTCHA page
            await enterSms('2')
                .catch(e => ourCommand.add('enterSms', `QX: ${e}`));
        } else if ((document.location.href.indexOf('page=account&action=out&terminal=qiwi') > -1 && data.paysystem === 'QIWI')
            || (document.location.href.indexOf('page=account&action=out&terminal=skrill') > -1 && data.paysystem === 'SKRILL')) {
            // Hint: fill withdrawal form
            await waitForCondition(() => checkSE(data.paysystem === 'QIWI'
                ? ['#country_code', '#tel_number', '#out_sum'] : ['input[name="mb_email"]', '#out_sum'], true),
                333, 15000, `No ${data.paysystem} inputs!`);
            await delayPromise(3000);
            if (data.paysystem === 'QIWI' && $('#country_code_az').text() !== 'RU') {
                await mouseChain({target: $('#country_code')[0], events: ['click'], error: 'mcP-1'});
                await waitDelayClickF('li img.country-flag[src$="flags/RU.png"]')();
                await delayPromise(3000);
            }
            if (data.paysystem === 'QIWI') {
                await clearAndSimulate($('#tel_number')[0], data.login.replace('+', '').replace(/^7/, ''));
            } else {
                await clearAndInputEmail($('input[name="mb_email"]')[0], data.login);
            }
            await delayPromise(3000);
            await clearAndSimulate($('#out_sum')[0], data.amount);
            await delayPromise(3000);
            ourCommand.add(data.paysystem === 'QIWI' ? 'qiwiEntered' : 'skrillEntered', true);
            await mouseChain({target: $('#out_submit')[0], events: ['click'], error: 'mcP-2'});
            await delayPromise(35000);
            throw 'We are not at QiwiPay for more then 30 seconds!';
        } else if (document.location.href.indexOf('page=account&action=out') > -1) {
            // Hint: select paysystem or enter sms / captcha
            const sms = await waitForCondition(() => $('#sms_code').length > 0, 333, 10000, '')
                .catch(e => false);
            if (sms) {
                await enterSms('1')
            } else {
                let pA = data.paysystem === 'SKRILL' ? 'img[src="/img/icons/pay7.jpg"]' : 'img[alt="Qiwi"]';
                const $el = await waitForElement(pA, 333, 15000);
                await mouseChain({target: $el[0], events: ['click'], error: '$el1234'});
                await delayPromise(3000);
            }
        } else {
            // Hint: go to withdraw
            const $el = await waitForElement('#dropdownMenuLink1', 333, 15000)
            await mouseChain({target: $el[0], events: ['click'], error: '$el9823'});
            await delayPromise(1000);
            const $el2 = await waitForElement('a[role="menuitem"][href="/index.php?page=account&action=out"]', 333, 15000);
            await mouseChain({target: $el2[0], events: ['click'], error: '$el-2'});
            await delayPromise(3000);
        }
        return await withdrawDo(data);
    };

    const depositDo = async data => {
        bsDebug(port, `letsRockNRoll: ${ourCommand.getAdded('qiwiEntered')}`);
        if (ourCommand.getAdded('qiwiEntered') || ourCommand.getAdded('qiwiEnteredSpecial')) {
            bsLogger('green', 'OLIMP', 'Wait for DEPOSIT_RESULT');
            if (data.paysystem === 'SKRILL') {
                chrome.storage.local.remove(['SKRILL_COMMAND', 'SKRILL_COMMAND_WAS_SET']);
            }
            const depositResult = await bMess('DEPOSIT_RESULT', true).get(120000, 120000);
            bsLogger('green', 'OLIMP', [`We got deposit after wait!`, depositResult]);
            return depositResult;
        } else if (document.location.href.indexOf('cashier.paywallk.com') > -1) {
            dLog('green', 'Pay-Walk', 'We are on cashier.paywallk.com!');
            const $el = await waitForElement('input[name="PaymentData[qiwi_phone]"]', 300, 10000,);
            await delayPromise(1000);
            await clearAndSimulate($el[0], data.login.replace('+', ''));
            await delayPromise(777);
            if ($($el).hasClass('validation-error')) throw 'phone number is not valid!';
            increaseDelay = true;
            ourCommand.add('qiwiEntered', true);
            await bMess('QIWI_COMMAND', true).set(ourCommand.get(), true);
            dLog('green', 'Pay-Walk', 'Phone number has been entered!');
            await mouseChain({target: $('#span-button-pay')[0], events: fullClick, error: '#sbp'});
            await delayPromise(100000);
        } else if (document.location.href.indexOf('page=account&action=in&terminal=qw') > -1 && data.paysystem === 'QIWI') {
            const $am = await waitForElement('#amount', 300, 15000, false, 1, 'Amount!');
            await clearAndSimulate($am[0], data.amount);
            await bMess('QIWI_COMMAND', true).set(ourCommand.get(), true);
            await delayPromise(1000);
            await mouseChain({
                target: $('input[value="Пополнить счет"]')[0],
                events: ['click'],
                error: 'Refill'
            });
            await delayPromise(5555);
        } else if (document.location.href.indexOf('page=account&action=in&terminal=skrill') > -1 && data.paysystem === 'SKRILL') {
            let skrillError = false;
            await waitForElement('#user_sum', 333, 15000)
                .then(($el) => clearInputElement({
                    string: data.amount,
                    element: $el[0],
                    long: true,
                    fireChange: true,
                    fireInput: true
                }))
                .then(emulateKeyboardLikeHuman)
                .then(() => chrome.storage.local.set({
                    'SKRILL_COMMAND': ourCommand.get(),
                    'SKRILL_COMMAND_WAS_SET': Date.now()
                }))
                .then(() => {
                    increaseDelay = true;
                    ourCommand.add('qiwiEntered', true);
                })
                .then(delayFunction(3333))
                .then(() => mouseChain({target: $('#skrill_sbmt')[0], events: ['click']}))
                .then(delayFunction(3333))
                .catch((e) => skrillError = 'Skrill go: ' + e);
            if (skrillError) throw skrillError;
        } else if (document.location.href.indexOf('page=account&action=in') > -1) {
            let pA = data.paysystem === 'SKRILL' ? 'img[src="/img/icons/pay7.jpg"]' : 'img[src="/img/icons/qiwi_koshelek.png"]';
            await waitForElement(pA, 333, 7777);
            await mouseChain({target: $(pA)[0], events: ['click'], error: 'pay-system link image not available!'});
            await delayPromise(3333);
        } else {
            await mouseChain({
                target: $('a.balance-link')[0],
                events: ['click'],
                error: 'user link is not available!'
            });
            await delayPromise(3333);
        }
        return await depositDo(data);
    };

    const deposit = async data => {
        let error = false;
        const res = await depositDo(data).catch(e => (error = e));
        dLog(error ? 'red' : 'green', 'Olimp', `Deposit: ${res}`);
        const message = typeof res === 'string' ? res : res.message;
        port.postMessage({
            answered: "DEPOSIT",
            status: message.indexOf('NO_FUNDS') > -1 ? 'NO_FUNDS' : (res.success ? "SUCCESS" : "FAILED"),
            answer: message,
            balance: getBalance(),
            wallet_balance: res.balance || '',
        });
        if (error) {
            throw message;
        }
    };

    /**
     * Collecting bet results
     * @param {array} inputData
     * @returns {Promise<any>}
     */
    let collectBetResults = function (inputData) {
        return new Promise(function (onSuccess, onReject) {
            let collected = [];
            let limit = 0;
            let data = inputData;
            if (data.length === 2 && data[0] === 'limit') {
                limit = parseInt(data[1]);
                data = [];
            }
            bsDebug(port, 'collectBetResults, limit: ' + limit + ', data:', data);
            let report = function (success, message) {
                bsDebug(port, 'Collect data: success = ' + success + ', message = ' + message + ', data:', data);
                if (success) {
                    onSuccess(collected);
                } else {
                    onReject(message);
                }
            };

            let performCollectBetCurrent = 0;
            let performCollectBet = function () {
                let statuses = {
                    'Не рассчитано...': 'ACCEPTED',
                    'Проиграло': 'LOSE',
                    'Выиграло': 'WON',
                    'Возврат': 'REFUNDED',
                    'Отменена': 'CANCELLED'
                };
                let findNext = function ($row, hasClass) {
                    let $current = $row;
                    do {
                        $current = $current.next();
                    } while ($current.length > 0 && !$current.hasClass(hasClass));
                    return $current;
                };
                let $bets = $('tr.bet_js');
                if (typeof $bets[performCollectBetCurrent] !== 'undefined'
                    && ((limit === 0 && data.length === 0)
                        || (limit > 0 && collected.length < limit)
                        || (data.length > 0 && collected.length < data.length)
                    )
                ) {
                    let $lastRow, result, match, bkPivot;
                    $bets[performCollectBetCurrent].scrollIntoView();
                    let external_id = $bets.eq(performCollectBetCurrent).attr('data-betid');
                    if (parseInt($bets.eq(performCollectBetCurrent).find('div.first_cell').parent().prop('rowspan')) > 1) {
                        $lastRow = findNext($bets.eq(performCollectBetCurrent), 'total_js');
                        result = parseFloat($bets.eq(performCollectBetCurrent).find('td.pay ').text().trim());
                        match = $bets.eq(performCollectBetCurrent).find('a.match_name').text().trim();
                        bkPivot = $bets.eq(performCollectBetCurrent).find('div.event_name_inside').text().trim();
                    } else {
                        $lastRow = $bets.eq(performCollectBetCurrent);
                        result = parseFloat($lastRow.find('td.status').next().text().trim());
                        match = $lastRow.find('a.match_name').text().trim();
                        bkPivot = $lastRow.find('div.event_name_inside').text().trim();
                    }
                    let statusDraft = $lastRow.find('td.status').text().trim();
                    const stake = parseFloat($lastRow.find('td.status').prev().text().trim());
                    if (data.length === 0 || data.indexOf(external_id) > -1) {
                        collected.push({
                            external_id: external_id,
                            status: typeof statuses[statusDraft] === 'string' ? statuses[statusDraft] : (() => {
                                if (isNaN(result)) {
                                    return 'ACCEPTED';
                                } else if (result > stake) {
                                    return 'WON';
                                } else if (result === stake) {
                                    return 'REFUNDED';
                                } else {
                                    return 'LOSE';
                                }
                            })(),
                            match: match,
                            bkPivot: bkPivot,
                            coef: parseFloat($lastRow.find('td.status').prev().prev().text().trim()),
                            stake: stake,
                            result: isNaN(result) ? 0 : result
                        });
                    }
                    performCollectBetCurrent++;
                    delayPromise(777).then(performCollectBet);
                } else if (typeof $bets[performCollectBetCurrent] === 'undefined'
                    && (parseInt($('select[name="page"]').val()) === 1 || parseInt($('select[name="page"]').val()) === 2)) {
                    const curp = parseInt($('select[name="page"]').val());
                    // Here we can go next page if necessary...
                    mouseChain({target: $('span.selectboxit')[0], events: ['click']})
                        .then(delayFunction(777))
                        .then(waitForElementF(`ul.selectboxit-list:visible li[data-val="${(curp + 1)}"] a`, 333, 10000))
                        .then($el => mouseChain({
                            target: $el[0],
                            events: ['mouseover', 'mousedown', 'click', 'mouseup']
                        }))
                        .then(delayFunction(3333))
                        .then(() => mouseChain({
                            target: $('div.button:contains("Перейти")')[0],
                            events: ['click']
                        }))
                        .then(delayFunction(3333))
                        .then(waitForElementF('table.table_as', 333, 10000))
                        .then(delayFunction(3333))
                        .then(() => performCollectBetCurrent = 0)
                        .then(performCollectBet)
                        .catch(e => report(true, e));
                } else {
                    report(true, '');
                }
            };

            goBetsStats()
                .then(async () => {
                    dLog('green', 'Olimp', 'Applying filters!');
                    const sels = ['#history_f_c', '#history_f_u', 'div.button:textEquals("Применить")',];
                    await delayPromise(1500);
                    await mouseChain({target: $(sels[0])[0], events: fullClick, error: 'sels 0'});
                    await delayPromise(2500);
                    await mouseChain({target: $(sels[1])[0], events: fullClick, error: 'sels 1-1'});
                    await delayPromise(2500);
                    await mouseChain({target: $(sels[1])[0], events: fullClick, error: 'sels 1-2'});
                    await delayPromise(2000);
                    await mouseChain({target: $(sels[2])[0], events: fullClick, error: 'sels 2'});
                    await delayPromise(2000);
                })
                .then(waitForCondition(() => {
                    return $('tr.bet_js').length > 0;
                }, 333, 20000, 'No bets!', true))
                .then(performCollectBet)
                .catch((e) => report(false, 'Error in goBetsStats: ' + e));

        });
    };

    let goBetsStats = function () {
        return new Promise(function (onSuccess, onReject) {
            if (window.location.href.indexOf('index.php?page=history') > -1) {
                onSuccess('We already here!');
            } else {
                mouseChain({target: $('a.bets-history-link')[0], events: ['click']})
                    .then(() => onSuccess('Link clicked!'))
                    .catch((e) => onReject('Error due goBetsStats: ' + e));
            }
        });
    };

    let checkCouponAndCoefs = function (data) {
        return new Promise(function (onSuccess, onReject) {
            let $dels = $('div.busket-item-delete');
            let eventHere = $('div.busket-item-body div.item-title').text().trim();
            let eventNeed = data[0].team1 + ' - ' + data[0].team2;
            let odd = parseFloat($('div.busket-item-body div.item-koef').text().trim());
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
        });
    };

    /**
     * Checks coefs into the coupon
     * @param data
     * @returns {Promise<string,string>}
     */
    let checkCoefs = function (data) {
        return new Promise(function (onSuccess, onReject) {
            /* TEST TOP START
            (function (data) {
                console.log(data);
                let onSuccess = function (m) {
                    console.log('Success: ' + m);
                };
                let onReject = function (m) {
                    console.log('Reject: ' + m);
                };
                 //TEST TOP FINISH */
            let checkCoupon = function () {
                return new Promise(function (onSuccess, onReject) {
                    let findInData = function (match) {
                        let result = false;
                        $.each(data, function () {
                            let localMatch = this.team1.toLowerCase() + ' - ' + this.team2.toLowerCase();
                            if (localMatch === match.toLowerCase() || locutus_similar_text(localMatch, match.toLowerCase(), true) > 90) {
                                result = this;
                                return false;
                            }
                        });
                        return result;
                    };
                    let $coupon = $('#wraper_basket_b');
                    let $coupons = $coupon.find('div.busket-item.busket_item_js');
                    let errors = [];
                    let checked = 0;
                    let totalCoef = 1;
                    $coupons.each(function () {
                        let $this = $(this);
                        let match = $this.find('div.item-title').text().trim();
                        if ($this.hasClass('market-unavailable')) {
                            errors.push(match + ' LOW_COEF, market unavailable!');
                            checked++;
                            return true;
                        }
                        let localCoef = parseFloat($this.find('div.koef div.value').text().trim());
                        lastCoef = localCoef;
                        let localData = findInData(match);
                        totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
                        if (!newAPI && localData !== false && localData.coef !== '' && !isNaN(localCoef)) {
                            let checkCoef = parseFloat(localData.coef);
                            if (!isNaN(checkCoef) && (checkCoef - localCoef) > 0.22) {
                                error.push(' LOW_COEF: Tried to bet 0');
                            } else if (isNaN(checkCoef) || checkCoef > localCoef) {
                                errors.push(match + ' LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef);
                            }
                            checked++;
                        } else if (localData === false || isNaN(localCoef)) {
                            errors.push(match + ' LOW_COEF - wrong match or localCoef!');
                            checked++;
                        } else if (localData.coef === '' || newAPI) {
                            checked++;
                        }
                    });
                    if (!newAPI && errors.length === 0 && checked === data.length) {
                        onSuccess('Coefs fine!');
                    } else if (newAPI && errors.length === 0 && checked === data.length) {
                        const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
                        if (totalCoef >= nCheck * 1.2) {
                            onReject('Coef TOO BIG: ' + totalCoef + ' instead of ' + data[0].coef);
                        } else if (totalCoef < nCheck) {
                            onReject('LOW_COEF ' + data[0].coef + ' > ' + totalCoef);
                        } else {
                            onSuccess('Coefs fine!');
                        }
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
            {team1: 'Сёнан Беллмаре', team2: 'Йокогама', coef: '1.84'},
            {team1: 'Соннам ФК', team2: 'Тэджон Ситизен', coef: '1.27'}
        ]);
            //TEST BOTTOM FINISH */
        });
    };

    const proceedBet = data => new Promise(function (onSuccess, onReject) {
        currentBetData = {
            data: data,
            max: 0,
        };
        const result = async (success, res) => {
            const resultData = {
                "external_id": success ? res.external_id : '',
                "status": success
                    ? 'ACCEPTED'
                    : ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED'].find(c => typeof res === 'string' && res.indexOf(c) > -1) || 'FAILED',
                "market": data[0].market,
                "target": data[0].target,
                "pivot": data[0].pivot,
                "coef": success ? res.coef.toString() : data[0].coef,
                "stake": success ? res.stake.toString() : data[0].stake,
                "maximum": lastMax
            };
            if (success) {
                await eventsWorkAll('olimp',
                    settings.eventMaxBets, settings.eventTimeLimit,
                    currentBetData.data, true, true);
                await bMess('WasSuccessStake').set(Date.now());
                await bMess('Stake Maximums').set(0);
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
                fBetResult.bookmaker = 'OLIMP.KZ';
                fBetResult.placedCoef = resultData.coef;
                fBetResult.coef = currentBetData.data[0].coef;
                fBetResult.source = '480' || 'oddscp';
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
            port.postMessage({
                answered: !!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED'
                    ? "F_BET" : "BET",
                data: !!currentBetData.data[0].betFromParser ? fBetResult : resultData,
                answer: success ? 'Everything is Okay!' : res,
                doNotSend,
            });
            setBusy(true);
            ourCommand.clear();
            success ? onSuccess() : onReject(res);
        };
        proceedBetDo(data)
            .then(res => result(true, res))
            .catch(e => result(false, `proceedBetDo: ${e}, ${formatStack(e.stack)}`));
    });

    const proceedBetDo = async data => {
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
            const checkRes = await eventsWorkAll('olimp',
                settings.eventMaxBets, settings.eventTimeLimit,
                currentBetData.data, false, true);
            if (checkRes !== 'OK') {
                dLog('red', 'OLIMP', `We got errors: ${checkRes}`);
                throw checkRes;
            } else {
                dLog('big-blue', 'OLIMP',
                    `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                for (const d of currentBetData.data) {
                    const eventName = `${d.team1} - ${d.team2}`;
                    dLog('blue', 'OLIMP', `${settings.eventMaxBets} for ${eventName} not reached`);
                }
            }
        }
        const event = i => `${data[i].team1} - ${data[i].team2}`.toLowerCase();
        const checkEvent = match => data.some((d, k) => match.indexOf(event(k)) > -1);
        const checkSuccess = async () => {
            const checks = [
                '#error-wraper-betslip:contains("Сменился коэффициент")',
                '#error-wraper-betslip:contains("Ваша ставка успешно принята!")',
                '#error-wraper-betslip:contains("Слишком маленькая сумма ставки")',
            ];
            await waitForCondition(() => checks.some(c => $(c).length > 0), 200, 30000, 'Failed :(');
            if ($(checks[0]).length > 0) {
                await delayPromise(3000);
            }
            return $(checks[1]).length > 0;
        };
        if (ourCommand.getAdded('collect_result_only')) {
            const counter = ourCommand.getAdded('collect_result_counter') || 0;
            while (counter < 3) {
                const res = await collectBetResults(['limit', '1']);
                ourCommand.add('collect_result_counter', counter + 1);
                // [{"external_id":"166","status":"ACCEPTED"
                // ,"match":"Хоккей. Киберхоккей. NHL20 Matches.  Питтсбург (кибер) - Нью-Йорк Рейнджерс (кибер)","bkPivot":"Основные. Вторая не проиграет",
                // "coef":1.17,"stake":30,"result":0}], No stack!
                if (!res || !res[0] || !res[0].match || !res[0].external_id || !res[0].coef || !res[0].stake) {
                    throw `Wrong collect result: ${JSON.stringify(res)}`;
                }
                if (!checkEvent(res[0].match.toLowerCase())) {
                    if (counter < 3) {
                        dLog('blue', 'Olimp', `We'll sleep 10s before the next loop!`);
                        await delayPromise(10000);
                    } else {
                        throw `Wrong check event: '${res[0].match.toLowerCase()}' != '${event(0)}'`;
                    }
                } else {
                    lastMax = ourCommand.getAdded('lastMax');
                    return {
                        external_id: res[0].external_id.toString(),
                        coef: res[0].coef.toString(),
                        stake: res[0].stake.toString(),
                    };
                }
            }
            throw `Result not collected ${counter} times!`;
        }
        await closePreviousCoupons();
        lastMax = await openCoupon(data);
        let willPlace = parseFloat(data[0].stake);
        if (willPlace > lastMax) {
            willPlace = lastMax;
        }
        let $balance = $('span.currusum:not(.menusum)');
        let balance = parseFloat($balance.text().trim().replace(',', '').replace(/[^\d.]/g, '').trim());
        if (isNaN(balance)) {
            throw 'Get balance error';
        } else if (balance < willPlace) {
            throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
        } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
            throw 'Undefined or NaN will place';
        }
        const inputSel = 'div.summ-basket input', changeSel = '#ischange', pBtn = 'button[name="formsubmit"]';
        do {
            await checkCoefs(data);
            if ($(inputSel).length !== 1) {
                throw `Wrong number of bet's inputs: ${$(inputSel).length}`;
            }
            const entered = () => parseFloat($(inputSel).val().replace(/[^\d.]/g, ''));
            while (entered() !== willPlace) {
                await clearAndSimulate($(inputSel)[0], willPlace);
                await delayPromise(400);
                dLog('orange', 'Olimp', `${entered()} === ${willPlace}`);
            }
            if (elementIsVisible($(changeSel)[0]) && $(changeSel).text().trim().indexOf('Изменение коэффициента') > -1) {
                continue;
            }
            if ($(pBtn).length === 1) {
                await mouseChain({target: $(pBtn)[0], events: fullClick, scroll: true, error: 'pBtn'});
            } else {
                throw `Something wrong with $placeBtn: ${$(pBtn).length}`;
            }
        } while (!await checkSuccess());
        ourCommand.add('collect_result_only', true);
        ourCommand.add('lastMax', lastMax);
        dLog('orange', 'Olimp', `Let's collect result!`);
        await goBetsStats();
        await delayPromise(100000);
        // Collecting bet result old:
        /*
        const sel = '#history_body_b div.stake-item:first:visible';
        const event = i => `${data[i].team1} - ${data[i].team2}`.toLowerCase();
        const mEvent = () => $(sel).find(' span.stake-title:first').text().trim().toLowerCase();
        const checkEvent = () => data.some((d, k) => mEvent() === event(k) || locutus_similar_text(mEvent(), event(k), true) > 90);
        await mouseChain({target: $('#history-button')[0], events: fullClick, scroll: true, error: 'sCh'});
        await waitForCondition(() => $(sel).length > 0, 333, 30000, 'History coupon ot shown!');
        await waitForCondition(() => checkEvent(), 333, 10000, `Event mismatch '${mEvent()}'!`);
        await delayPromise(1500);
        return {
            external_id: $(sel).attr('data-betid'),
            coef: $(sel).find('div.item-koef').text().trim(),
            stake: $(sel).find('div.number-pan').text().trim(),
        };
        */
    };

    const checkLive = async () => {
        const $getLink = bkHere === 'olimpold' ? 'olimp.com/betting' : kzDomain + '/betting';
        if (window.location.href.indexOf($getLink) === -1) {
            await waitForElement('li.live-link a', 333, 10000);
            await delayPromise(2000);
            await mouseChain({target: $('li.live-link a')[0], events: fullClick, scroll: true, error: 'live'});
            await delayPromise(1000);
        }
    };

    const uncheckSports = async sport => {
        const $checkedLis = $('div.filter-live input:checked[data-sport!="' + sport + '"]:visible');
        const count = $checkedLis.length;
        await $checkedLis.eachAsync(async function () {
            await mouseChain({target: $(this)[0], events: fullClick, error: 'unch'});
            await delayPromise(1100);
        });
        return count > 0;
    };

    /**
     * Open event table, if we're on it already -  onSuccess
     * @param {object} data
     * @returns {Promise<any>}
     */
    let openEvent = async (data) => {
        if (!data.score) {
            data.score = '';
        }
        //bsDebug(port, 'openEvent', data);
        let sportAccordance = {
            'FOOTBALL': '1',
            'TENNIS': '3',
            'TABLETENNIS': '40',
            'HOCKEY': '2',
            'VOLLEYBALL': '10',
            'BASEBALL': '29',
            'CYBERSPORT': '112',
            'BASKETBALL': '5',
            'HANDBALL': ''
        };
        let eventName = `${data.team1} - ${data.team2}`.toLowerCase();
        if (typeof sportAccordance[data.sport] !== 'string' || sportAccordance[data.sport] === '') {
            throw data.sport + ' not supported!';
        }
        let sport = sportAccordance[data.sport];
        const checkScoreByText = function (scoreText) {
            if (data.score !== '' && ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) === -1
                && data.sport === 'FOOTBALL') {
                //bsDebug(port, 'checkScoreByText: "' + scoreText + '" === "' + score + '"');
                let cleanScore = data.score.replace(/[^0-9:]/g, '').trim();
                let re = /(^\d+:\d+)/;
                let res = re.exec(scoreText);
                return res !== null && typeof res[1] === 'string' && res[1] === cleanScore;
            } else {
                return true;
            }
        };
        const checkScore = async () => {
            if (data.score === '' || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1
                || data.sport !== 'FOOTBALL') {
                return '';
            }
            let waitForScoreStarted = 0;
            let score = '';
            while (score === '' && Date.now() - waitForScoreStarted < 10000) {
                score = $('div.gameNameLine font.txtmed').text().trim();
                await delayPromise(700);
            }
            if (score === '' || !checkScoreByText(score)) {
                throw score;
            }
        };
        const checkWeAreThere = function () {
            if (data.bk_event_native_id) {
                return $(`div.gameNameLine span[id="match_live_name_${data.bk_event_native_id}"]`).length > 0;
            } else {
                let checkEvent = $('div.gameNameLine span[id^="match_live_name_"]').text().trim().toLowerCase();
                if (checkEvent.length > 2) {
                    return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 90;
                } else {
                    return false;
                }
            }
        };
        const switchToSport = async () => {
            let wasSwitch = false;
            await waitForElement('div.filter-live', 333, 7777);
            let $sport = $('div.filter-live input[data-sport="' + sport + '"]');
            if ($sport.length === 0) {
                throw `There is no ${data.sport} at the moment!`;
            }
            if (!$sport.is(':visible')) {
                await mouseChain({target: $('div.dropSportFilter div.btn')[0], events: ['click'], error: 'btn'});
                await delayPromise(500);
            }
            if (!$sport.is(':checked')) {
                wasSwitch = true;
                await mouseChain({target: $sport[0], events: ['mouseenter', 'click', 'mouseleave'], error: '$s1'});
                await delayPromise(3000);
            }
            if (await uncheckSports(sport)) {
                wasSwitch = true;
            }
            return wasSwitch;
        };
        const findEvent = async () => {
            if (data.bk_event_native_id) {
                const $evt = $(`a.l-name-tab[id="match_live_name_${data.bk_event_native_id}"]:visible`);
                if ($evt.length === 0) {
                    throw 'Event not found!';
                } else {
                    await mouseChain({target: $evt[0], events: fullClick, error: 'evt', scroll: true});
                    return;
                }
            }
            const wasSwitch = await switchToSport();
            if (wasSwitch) {
                await delayPromise(3333);
            }
            let $el = [];
            $('a.l-name-tab[id^="match_live_name_"]:visible').each(function () {
                let checkEvent = $(this).text().trim().toLowerCase();
                if (checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 90) {
                    $el = $(this);
                    return false;
                }
            });
            let rId;
            if ($el.length === 1) {
                let scoreAll = $el.parent().find('font.txtmed.l-name-tab').text().trim();
                if (!checkScoreByText(scoreAll)) {
                    throw 'SCORE_CHANGED: we need: "' + data.score + '", we have: "' + scoreAll + '"';
                } else {
                    $el.get(0).scrollIntoView();
                    rId = $el.attr('id');
                }
            } else {
                throw 'Event not found!';
            }
            await delayPromise(500, rId);
            await mouseChain({target: $('#' + rId)[0], events: fullClick, error: 'rId',});
        };
        if (checkWeAreThere()) {
            const scoreAll = $('div.gameNameLine font.txtmed').text().trim();
            if (!checkScoreByText(scoreAll)) {
                throw 'SCORE_CHANGED, we need: "' + data.score + '", we have: "' + scoreAll + '"';
            }
            return 'We probably on event page!';
        }
        await checkLive();
        await findEvent();
        await waitForCondition(() => checkWeAreThere(), 777, 30000, 'checkWeAreThere');
        await checkScore();
    };

    /**
     * Opens coupon with stake (stakes)
     * @param {object[]} paramData - array of bets to open
     * @returns {Promise<float>}
     */
    let openCoupon = function (paramData) {
        bsDebug(port, 'openCoupon, paramData:', paramData);
        return new Promise(function (onSuccess, onReject) {
            let result = function (success, message) {
                if (success) {
                    let getMaxHere = function () {
                        //bsDebug(port, 'getMaxHere: ' + isExpress);
                        if (typeof data !== 'undefined' && typeof data.doNotOpen !== 'undefined' && data.doNotOpen === true) {
                            onSuccess(1000050000);
                            return;
                        }
                        let max = parseFloat($('div.msbtn input').val().replace(/[^0-9\.]/g, '').toString());
                        if (!isNaN(max) && max > 0) {
                            onSuccess(Math.round(max * 1000) / 1000);
                        } else {
                            onReject('Max is NaN or 0!');
                        }
                    };
                    if (lData.length > 0) {
                        ourCommand.add('express', ourCommand.getAdded('express') + 1);
                        bsDebug(port, 'EXPRESS must be added!');
                        data = paramData[ourCommand.getAdded('express')];
                        bsDebug(port, 'openCoupon - We got data: ' + (typeof data), data);
                        if (typeof data !== 'undefined') {
                            openElement();
                        } else {
                            delayPromise(3333).then(() => getMaxHere(true));
                        }
                    } else {
                        delayPromise(3333).then(() => getMaxHere(false));
                    }
                } else {
                    bsError(port, message);
                    onReject(message);
                }
            };
            let lData = paramData.slice();
            let data = {};
            let openElement = function () {
                openEvent(data)
                    .then(() => {
                        bsDebug(port, 'Event must be opened!');
                        getBetElement(data)
                            .then((elementId) => {
                                let ourSelector = 'span[id="' + elementId + '"]';
                                waitForElement(ourSelector, 333, 10000)
                                    .then(($el) => {
                                        bsDebug(port, 'We got element! Coef: ' + $el.text().trim());
                                        $el[0].scrollIntoView();
                                        if (!elementIsVisible($el[0])) {
                                            window.scrollBy(0, -110);
                                        }
                                    })
                                    .then(() => waitForElement(ourSelector, 333, 5000))
                                    .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                                    .then(waitForCondition(() => {
                                        return $(ourSelector).length > 0 && $(ourSelector).hasClass('sel');
                                    }, 333, 10000, 'Coupon not visible for 10 secs...', true))
                                    .then(() => result(true, ''))
                                    .catch((e) => result(false, e));
                            })
                            .catch((e) => result(false, 'Error in getBetElement: ' + e));
                    })
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

    /**
     *  Get bet element and scroll into market and element
     * @param {object} data - one of data's rows
     * @returns {Promise<jQuery|string>} jQuery element for bet
     */
    let getBetElement = function (data) {
        return new Promise(function (reportSuccess, reportReject) {
            //#-#-START
            let onSuccess = function (elementId) {
                let $d = $('span[id="' + elementId + '"]');
                if (typeof $d[0] === 'undefined') {
                    onReject('Bet inactive for "' + elementId + '"!');
                } else {
                    console.log('%cSuccess', 'background: green;');
                    $d[0].scrollIntoView();
                    if (!elementIsVisible($d[0])) {
                        window.scrollBy(0, -110);
                    }
                    console.log($d.text().trim());
                    reportSuccess(elementId);
                }
            };

            let onReject = function (d) {
                console.log('%cReject', 'background: red;');
                console.log(d);
                reportReject(d);
            };

            let eventName = typeof eventNameIn === 'undefined' || eventNameIn === '' ? $('span[id^="match_live_name_"]').text().trim() : eventNameIn;

            let teams = eventName.split(' - ');
            if (teams.length === 2) {
                data.team1 = teams[0].toLowerCase();
                data.team2 = teams[1].toLowerCase();
                data.team1b = teams[0];
                data.team2b = teams[1];
            } else {
                onReject('No teams!');
                return;
            }

            let markets = {
                'ONE_TWO': {
                    'ONE': {root: ['Основные'], subroots: [], pivotKey: 'П1'},
                    'TWO': {root: ['Основные'], subroots: [], pivotKey: 'П2'},
                    'DRAW': {root: ['Основные'], subroots: [], pivotKey: 'Х'},
                    'ONE_DRAW': {root: ['Основные'], subroots: [], pivotKey: '1Х'},
                    'TWO_DRAW': {root: ['Основные'], subroots: [], pivotKey: 'Х2'},
                    'ONE_TWO': {root: ['Основные'], subroots: [], pivotKey: '12'}
                },
                'TOTAL': {
                    'OVER': {
                        root: ['Основные', 'Доп. тотал:', 'Азиатские тоталы:'], subroots: [],
                        pivotKeys: ['Тотал (#PIVOT#) бол', 'Тотал (#PIVOTR#) бол', 'Тотал (#PIVOTR2#) бол', 'Тот(#PIVOT#)']
                    },
                    'UNDER': {
                        root: ['Основные', 'Доп. тотал:', 'Азиатские тоталы:'], subroots: [],
                        pivotKeys: ['Тотал (#PIVOT#) мен', 'Тотал (#PIVOTR#) мен', 'Тотал (#PIVOTR2#) мен', 'Тот(#PIVOT#)']
                    },
                },
                'T1_TOTAL': {
                    'OVER': {
                        root: ['Инд.тотал:', 'Азиатские инд.тоталы:'], subroots: [],
                        pivotKeys: ['#TEAM1B# (#PIVOT#) бол', '#TEAM1B# (#PIVOTR#) бол', '#TEAM1B# (#PIVOTR2#) бол']
                    },
                    'UNDER': {
                        root: ['Инд.тотал:', 'Азиатские инд.тоталы:'], subroots: [],
                        pivotKeys: ['#TEAM1B# (#PIVOT#) мен', '#TEAM1B# (#PIVOTR#) мен', '#TEAM1B# (#PIVOTR2#) мен']
                    }
                },
                'T2_TOTAL': {
                    'OVER': {
                        root: ['Инд.тотал:', 'Азиатские инд.тоталы:'], subroots: [],
                        pivotKeys: ['#TEAM2B# (#PIVOT#) бол', '#TEAM2B# (#PIVOTR#) бол', '#TEAM2B# (#PIVOTR2#) бол']
                    },
                    'UNDER': {
                        root: ['Инд.тотал:', 'Азиатские инд.тоталы:'], subroots: [],
                        pivotKeys: ['#TEAM2B# (#PIVOT#) мен', '#TEAM2B# (#PIVOTR#) мен', '#TEAM2B# (#PIVOTR2#) мен']
                    }
                },
                'HDP': {
                    'HOME': {
                        root: ['Основные', 'Победа с учетом форы:', 'Азиатские форы:'],
                        subroots: [],
                        pivotKeys: ['П1 с форой (#PIVOT#)', 'П1 с форой (#PIVOTR#)', 'П1 с форой (#PIVOTR2#)',
                            'Ф1(#PIVOT#)', 'Ф1(#PIVOTR#)', 'Ф1(#PIVOTR2#)',
                            '#TEAM1B# (#PIVOT#)', '#TEAM1B# (#PIVOTR#)', '#TEAM1B# (#PIVOTR2#)']
                    },
                    'AWAY': {
                        root: ['Основные', 'Победа с учетом форы:', 'Азиатские форы:'],
                        subroots: [],
                        pivotKeys: ['П2 с форой (#PIVOT#)', 'П2 с форой (#PIVOTR#)', 'П2 с форой (#PIVOTR2#)',
                            'Ф2(#PIVOT#)', 'Ф2(#PIVOTR#)', 'Ф2(#PIVOTR2#)',
                            '#TEAM2B# (#PIVOT#)', '#TEAM2B# (#PIVOTR#)', '#TEAM2B# (#PIVOTR2#)']
                    }
                },
                'EURO_HDP': {
                    'H1': {
                        root: ['Победа с учетом форы 3 исхода:'],
                        subroots: [],
                        pivotKeys: ['#TEAM1B# (#PIVOT#)', '#TEAM1B# (#PIVOTR#)', '#TEAM1B# (#PIVOTR2#)']
                    },
                    'H2': {
                        root: ['Победа с учетом форы 3 исхода:'],
                        subroots: [],
                        pivotKeys: ['#TEAM2B# (#PIVOT#)', '#TEAM2B# (#PIVOTR#)', '#TEAM2B# (#PIVOTR2#)']
                    },
                    'HX': {
                        root: ['Победа с учетом форы 3 исхода:'],
                        subroots: [],
                        pivotKeys: ['Ничья (#PIVOT#)', 'Ничья (#PIVOTR#)', 'Ничья (#PIVOTR2#)']
                    }
                },
                'CORNER_TOTAL': {
                    'OVER': {
                        root: ['Основные', 'Доп. тотал:', 'Азиатские тоталы:'], subroots: [],
                        pivotKeys: ['Тотал (#PIVOT#) бол', 'Тотал (#PIVOTR#) бол', 'Тотал (#PIVOTR2#) бол', 'Тот(#PIVOT#)']
                    },
                    'UNDER': {
                        root: ['Основные', 'Доп. тотал:', 'Азиатские тоталы:'], subroots: [],
                        pivotKeys: ['Тотал (#PIVOT#) мен', 'Тотал (#PIVOTR#) мен', 'Тотал (#PIVOTR2#) мен', 'Тот(#PIVOT#)']
                    },
                },
                'CORNER_HDP': {
                    'HOME': {
                        root: ['Основные', 'Победа с учетом форы:', 'Азиатские форы:'],
                        subroots: [],
                        pivotKeys: ['П1 с форой (#PIVOT#)', 'П1 с форой (#PIVOTR#)', 'П1 с форой (#PIVOTR2#)',
                            'Ф1(#PIVOT#)', 'Ф1(#PIVOTR#)', 'Ф1(#PIVOTR2#)',
                            '#TEAM1B# (#PIVOT#)', '#TEAM1B# (#PIVOTR#)', '#TEAM1B# (#PIVOTR2#)']
                    },
                    'AWAY': {
                        root: ['Основные', 'Победа с учетом форы:', 'Азиатские форы:'],
                        subroots: [],
                        pivotKeys: ['П2 с форой (#PIVOT#)', 'П2 с форой (#PIVOTR#)', 'П2 с форой (#PIVOTR2#)',
                            'Ф2(#PIVOT#)', 'Ф2(#PIVOTR#)', 'Ф2(#PIVOTR2#)',
                            '#TEAM2B# (#PIVOT#)', '#TEAM2B# (#PIVOTR#)', '#TEAM2B# (#PIVOTR2#)']
                    }
                },
                half: {
                    'ONE_TWO': {
                        'ONE': {root: ['Исходы по таймам:'], subroots: [], pivotKey: 'П1 в 1-м тайме'},
                        'TWO': {root: ['Исходы по таймам:'], subroots: [], pivotKey: 'П2 в 1-м тайме'},
                        'DRAW': {root: ['Исходы по таймам:'], subroots: [], pivotKey: 'Х в 1-м тайме'},
                        'ONE_DRAW': {root: ['Исходы по таймам:'], subroots: [], pivotKey: '1Х в 1-м тайме'},
                        'TWO_DRAW': {root: ['Исходы по таймам:'], subroots: [], pivotKey: 'Х2 в 1-м тайме'},
                        'ONE_TWO': {root: ['Исходы по таймам:'], subroots: [], pivotKey: '12 в 1-м тайме'}
                    },
                    'TOTAL': {
                        'OVER': {
                            root: ['Исходы по таймам:'],
                            subroots: [],
                            pivotKeys: ['Тотал 1-го тайма (#PIVOT#) бол', 'Тотал 1-го тайма (#PIVOTR#) бол', 'Тотал 1-го тайма (#PIVOTR2#) бол']
                        },
                        'UNDER': {
                            root: ['Исходы по таймам:'],
                            subroots: [],
                            pivotKeys: ['Тотал 1-го тайма (#PIVOT#) мен', 'Тотал 1-го тайма (#PIVOTR#) мен', 'Тотал 1-го тайма (#PIVOTR2#) мен']
                        },
                    },
                    'T1_TOTAL': {
                        'OVER': {
                            root: ['Инд.тотал 1-го тайма:'],
                            subroots: [],
                            pivotKeys: ['#TEAM1B# (#PIVOT#) бол', '#TEAM1B# (#PIVOTR#) бол', '#TEAM1B# (#PIVOTR2#) бол']
                        },
                        'UNDER': {
                            root: ['Инд.тотал 1-го тайма:'],
                            subroots: [],
                            pivotKeys: ['#TEAM1B# (#PIVOT#) мен', '#TEAM1B# (#PIVOTR#) мен', '#TEAM1B# (#PIVOTR2#) мен']
                        }
                    },
                    'T2_TOTAL': {
                        'OVER': {
                            root: ['Инд.тотал 1-го тайма:'],
                            subroots: [],
                            pivotKeys: ['#TEAM2B# (#PIVOT#) бол', '#TEAM2B# (#PIVOTR#) бол', '#TEAM2B# (#PIVOTR2#) бол']
                        },
                        'UNDER': {
                            root: ['Инд.тотал 1-го тайма:'],
                            subroots: [],
                            pivotKeys: ['#TEAM2B# (#PIVOT#) мен', '#TEAM2B# (#PIVOTR#) мен', '#TEAM2B# (#PIVOTR2#) мен']
                        }
                    },
                    'HDP': {
                        'HOME': {
                            root: ['Исходы по таймам:'],
                            subroots: [],
                            pivotKeys: ['П1 в 1-м т. с форой (#PIVOT#)', 'П1 в 1-м т. с форой (#PIVOTR#)', 'П1 в 1-м т. с форой (#PIVOTR2#)']
                        },
                        'AWAY': {
                            root: ['Исходы по таймам:'],
                            subroots: [],
                            pivotKeys: ['П2 в 1-м т. с форой (#PIVOT#)', 'П2 в 1-м т. с форой (#PIVOTR#)', 'П2 в 1-м т. с форой (#PIVOTR2#)']
                        }
                    },
                }
            };

            if (data.time_value === 'HALF_TIME' && data.sport === 'FOOTBALL') {
                markets = markets.half;
            } else {
                delete markets.half;
            }

            if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
                onReject('Unsupported ' + data.time_value + '/' + data.market + '/' + data.target);
                return;
            }

            let specialPivotFormatter = function (market, pivot, twoParam) {
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

            let replaceInner = function (element, parent, index) {
                if (typeof element === 'string') {
                    parent[index] = element.replace('#TEAM1#', data.team1).replace('#TEAM2#', data.team2)
                        .replace('#TEAM1B#', data.team1b).replace('#TEAM2B#', data.team2b)
                        .replace('#PIVOT#', data.pivot).replace('#PIVOTR#', specialPivotFormatter(data.market, data.pivot))
                        .replace('#PIVOTR2#', specialPivotFormatter(data.market, data.pivot, true));
                } else if (typeof element === 'object') {
                    for (let i in element) {
                        replaceInner(element[i], element, i);
                    }
                } else {
                    // console.log(typeof element + ' not supported! (' + element + ')');
                }
            };
            replaceInner(markets, null, null);

            let getRootParams = function () {
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
                if (data.sport === 'BASKETBALL') {
                    if (data.time_value === 'FULL_MATCH') {
                        replacements.push({from: 'Победа с учетом форы:', to: 'Доп. форы:'});
                        replacements.push({from: 'Доп. тотал:', to: 'Доп. тоталы:'});
                    } else if (data.time_value === 'HALF_TIME') {
                        replacements.push({from: 'Победа с учетом форы:', to: 'Исходы по половинам:'});
                        replacements.push({from: 'Доп. тотал:', to: 'Исходы по половинам:'});
                        replacements.push({from: 'П1 с форой', to: 'П1 в 1-й пол. с форой'});
                        replacements.push({from: 'П2 с форой', to: 'П2 в 1-й пол. с форой'});
                        replacements.push({from: 'Тотал', to: 'Тотал 1-й половины'});
                    } else {
                        replacements.push({from: 'Победа с учетом форы:', to: 'Исходы по четвертям:'});
                        replacements.push({from: 'Доп. тотал:', to: 'Исходы по четвертям:'});
                        replacements.push({from: 'Основные', to: 'Исходы по четвертям:'});
                        let q = data.time_value.replace(/[^\d]/g, '').trim();
                        markets['ONE_TWO']['ONE']['pivotKey'] = 'П1 в ' + q + '-й ч.';
                        markets['ONE_TWO']['TWO']['pivotKey'] = 'П2 в ' + q + '-й ч.';
                        markets['ONE_TWO']['DRAW']['pivotKey'] = 'Х в ' + q + '-й ч.';
                        replacements.push({from: 'П1 с форой', to: 'П1 в ' + q + '-й ч. с форой'});
                        replacements.push({from: 'П2 с форой', to: 'П2 в ' + q + '-й ч. с форой'});
                        replacements.push({from: 'Тотал', to: 'Тотал ' + q + '-й четверти'});
                    }
                } else if (data.sport === 'TENNIS') {
                    if (data.time_value === 'FULL_MATCH') {
                        replacements.push({from: 'Доп. тотал:', to: 'Доп.тотал:'});
                    } else {
                        if (data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') > -1) {
                            let parts = data.time_value.split('_GAME_');
                            let set = parts[0].replace(/[^\d]/g, '');
                            let game = parts[1];
                            replacements.push({from: 'Основные', to: set + 'й сет ' + game + 'й гейм:'});
                            replacements.push({from: 'Доп. тотал:', to: 'It must to be removed!'});
                            replacements.push({from: 'Победа с учетом форы:', to: 'It must to be removed!'});
                            markets['ONE_TWO']['ONE']['pivotKey'] = data.team1b;
                            markets['ONE_TWO']['TWO']['pivotKey'] = data.team2b;
                        } else {
                            let set = data.time_value.replace(/[^\d]/g, '');
                            replacements.push({from: 'Победа с учетом форы:', to: 'Ставки по сетам:'});
                            replacements.push({from: 'Доп. тотал:', to: 'Ставки по сетам:'});
                            replacements.push({from: 'Основные', to: 'Ставки по сетам:'});
                            markets['ONE_TWO']['ONE']['pivotKey'] = 'П1 в ' + set + '-м сете';
                            markets['ONE_TWO']['TWO']['pivotKey'] = 'П2 в ' + set + '-м сете';
                            replacements.push({from: 'П1 с форой', to: 'П1 в ' + set + '-м c. с форой'});
                            replacements.push({from: 'П2 с форой', to: 'П2 в ' + set + '-м c. с форой'});
                            replacements.push({from: 'Тотал', to: 'Тотал в ' + set + '-м сете'});
                        }
                    }
                } else if (data.sport === 'HOCKEY') {
                    if (data.time_value === 'FULL_MATCH') {
                        replacements.push({from: 'Инд.тотал:', to: 'Инд. тотал:'});
                    } else {
                        let period = data.time_value.replace(/[^\d]/g, '').trim();
                        replacements.push({from: 'Основные', to: period + ' период: Исходы по периодам:'});
                        replacements.push({from: 'Доп. тотал:', to: period + ' период: Доп. тотал:'});
                        replacements.push({from: 'Инд.тотал:', to: period + ' период: Инд. тотал:'});
                        replacements.push({
                            from: 'Победа с учетом форы 3 исхода:',
                            to: period + ' период: Фора 3 исхода:'
                        });
                    }
                } else if (data.sport === 'VOLLEYBALL') {
                    if (data.time_value !== 'FULL_MATCH') {
                        let set = data.time_value.replace(/[^\d]/g, '');
                        replacements.push({from: 'Победа с учетом форы:', to: 'Ставки по партиям:'});
                        replacements.push({from: 'Доп. тотал:', to: 'Ставки по партиям:'});
                        replacements.push({from: 'Основные', to: 'Ставки по партиям:'});
                        markets['ONE_TWO']['ONE']['pivotKey'] = set + '-я партия Победа первой';
                        markets['ONE_TWO']['TWO']['pivotKey'] = set + '-я партия Победа второй';
                        replacements.push({from: 'П1 с форой', to: 'П1 в ' + set + '-ой партии с форой'});
                        replacements.push({from: 'П2 с форой', to: 'П2 в ' + set + '-ой партии с форой'});
                        replacements.push({from: 'Тотал', to: 'Тотал ' + set + '-ой партии'});
                    }
                } else if (data.sport === 'TABLETENNIS') {
                    if (data.time_value !== 'FULL_MATCH') {
                        let set = data.time_value.replace(/[^\d]/g, '');
                        replacements.push({from: 'Победа с учетом форы:', to: 'Ставки по сетам:'});
                        replacements.push({from: 'Доп. тотал:', to: 'Ставки по сетам:'});
                        replacements.push({from: 'Основные', to: 'Ставки по сетам:'});
                        markets['ONE_TWO']['ONE']['pivotKey'] = 'П1 в ' + set + '-м сете';
                        markets['ONE_TWO']['TWO']['pivotKey'] = 'П2 в ' + set + '-м сете';
                        replacements.push({from: 'П1 с форой', to: 'П1 в ' + set + '-м c. с форой'});
                        replacements.push({from: 'П2 с форой', to: 'П2 в ' + set + '-м c. с форой'});
                        replacements.push({from: 'Тотал', to: 'Тотал в ' + set + '-м сете'});
                        replacements.push({from: 'Инд.тотал:', to: 'Инд. тотал ' + set + '-го сета:'});
                    }
                } else if (data.sport === 'BASEBALL') {
                    if (data.time_value === 'FULL_MATCH') {
                        replacements.push({from: 'Победа с учетом форы:', to: 'Доп. форы:'});
                    } else {
                        let inning = data.time_value.replace(/[^\d]/g, '');
                        replacements.push({from: 'Доп. тотал:', to: 'Исходы по иннингам:'});
                        replacements.push({from: 'Основные', to: 'Исходы по иннингам:'});
                        replacements.push({from: 'Победа с учетом форы:', to: 'Исходы по иннингам:'});
                        replacements.push({from: 'П1 в', to: 'П1 в ' + inning + '-м иннинге'});
                        replacements.push({from: 'П2 в', to: 'П2 в ' + inning + '-м иннинге'});
                        replacements.push({from: 'Х в', to: 'Х в ' + inning + '-м иннинге'});
                        replacements.push({from: 'П1 с форой', to: 'П1 в ' + inning + '-м ин. с форой'});
                        replacements.push({from: 'П2 с форой', to: 'П2 в ' + inning + '-м ин. с форой'});
                        replacements.push({from: 'Тотал', to: 'Тотал ' + inning + '-го иннинга'});
                    }
                } else if (data.sport === 'CYBERSPORT') {
                    if (data.time_value !== 'FULL_MATCH') {
                        let map = data.time_value.replace(/[^\d]/g, '');
                        replacements.push({from: 'Основные', to: 'Карта ' + map + ':'});
                        replacements.push({from: 'Доп. тотал:', to: 'Карта ' + map + ':'});
                        markets['ONE_TWO']['ONE']['pivotKey'] = 'Победа ' + data.team1b;
                        markets['ONE_TWO']['TWO']['pivotKey'] = 'Победа ' + data.team2b;
                        replacements.push({from: 'Тотал', to: 'Тотал Карты ' + map});
                    }
                } else if (data.sport === 'CYBERSPORT') {
                    if (data.time_value !== 'FULL_MATCH') {
                        let parts = data.time_value.split(';');
                        if (parts.length === 1 && data.time_value.indexOf('MAP') > -1) {
                            let map = data.time_value.replace(/[^\d]/g, '');
                            replacements.push({from: 'Основные', to: 'Карта ' + map + ':'});
                            replacements.push({from: 'Доп. тотал:', to: 'Карта ' + map + ':'});
                            markets['ONE_TWO']['ONE']['pivotKey'] = 'Победа ' + data.team1b;
                            markets['ONE_TWO']['TWO']['pivotKey'] = 'Победа ' + data.team2b;
                            replacements.push({from: 'Тотал', to: 'Тотал Карты ' + map});
                        }
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
            marketsModifierWrapper(data, 'pivotKeys', getRootParams(), markets);

            let finalPrepareForMarket = function (market) {
                market.rootLC = market.root.map(v => v.toLowerCase());
                return market;
            };

            let market = finalPrepareForMarket(markets[data.market][data.target]);
            bsDebug(port, 'Get bet element', market);

            let performGet = function () {
                let rootProcess = function () {
                    let currentRoot = 0;
                    let rootOuterFunction = function () {
                        if (currentRoot >= rootCandidates.length) {
                            onReject('No roots / pivots were found!');
                            return;
                        }
                        //rootCandidates[currentRoot].scrollIntoView();
                        //window.scrollBy(0, -110);
                        let $cRoot = $(rootCandidates[currentRoot]);
                        let $element = [];
                        //console.log('%c=====================================', 'background: red;');
                        //console.log($cRoot);
                        if (typeof market.pivotKey === 'string' && $cRoot.find('span.googleStatIssueName').text().trim() === market.pivotKey) {
                            $element = $cRoot.find('#googleStatKef');
                        } else if (typeof market.pivotKeys === 'object') {
                            let $check = $cRoot.find('span.googleStatIssueName');
                            for (let currentPivot in market.pivotKeys) {
                                //console.log(market.pivotKeys[currentPivot]);
                                if (market.pivotKeys.hasOwnProperty(currentPivot) && ['TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                                    if ($check.html().indexOf(market.pivotKeys[currentPivot]) > -1) {
                                        let weNeedToReplace = market.pivotKeys[currentPivot].indexOf('Тот(') > -1
                                            ? (data.target === 'OVER' ? 'Б -' : 'М -')
                                            : market.pivotKeys[currentPivot];
                                        if ($check.html().indexOf(weNeedToReplace) === -1) {
                                            $check = $check.parent();
                                            console.log('%cChange check to parent', 'color: red; font-weight: bold;');
                                        }
                                        $check.html($check.html().replace(weNeedToReplace, '<span class="nextX">' + weNeedToReplace + '</span>'));
                                        console.log('EXIT POINT # 3');
                                        //console.log($check);
                                        //console.log($check.html());
                                        //console.log(market.pivotKeys[currentPivot], weNeedToReplace, $check.html().indexOf(weNeedToReplace));
                                        onSuccess(
                                            ($check.find('span.nextX').next().next().hasClass('hide')
                                                ? $check.find('span.nextX').next().next().next()
                                                : $check.find('span.nextX').next().next()).find('#googleStatKef').parent().parent().attr('id')
                                        );
                                        $check.html($check.html().replace('<span class="nextX">' + weNeedToReplace + '</span>', weNeedToReplace));
                                        return;
                                    }
                                } else if (market.pivotKeys.hasOwnProperty(currentPivot) && market.pivotKeys[currentPivot] === $check.text().trim()) {
                                    console.log('EXIT POINT # 2');
                                    onSuccess($cRoot.find('#googleStatKef').parent().parent().attr('id'));
                                    return;
                                }
                            }
                        }
                        if ($element.length === 1) {
                            console.log('EXIT POINT # 1');
                            onSuccess($element.parent().parent().attr('id'));
                        } else if ($element.length > 1) {
                            onReject('Very strange length of $element: ' + $element.length);
                        } else {
                            currentRoot++;
                            rootOuterFunction();
                        }
                    };
                    rootOuterFunction();
                };
                let rootCandidates = [];
                for (let currentRoot in market.root) {
                    if (market.root.hasOwnProperty(currentRoot) && market.root[currentRoot] === 'Основные') {
                        $.merge(rootCandidates, $('table.koeftable2 div.tab>nobr'));
                    } else if (market.root.hasOwnProperty(currentRoot)) {
                        let weAreInElement = false;
                        let $nobrs = $('table.koeftable2 div.tab div>b, table.koeftable2 div.tab div>nobr').filter(function () {
                            let $this = $(this);
                            if ($this[0].tagName === 'NOBR' && weAreInElement) {
                                return true;
                            } else if ($this[0].tagName === 'B') {
                                weAreInElement = $this.text().trim() === market.root[currentRoot];
                                return false;
                            } else {
                                return false;
                            }
                        });
                        if ($nobrs.length > 0) {
                            $.merge(rootCandidates, $nobrs);
                        }
                    }
                }
                if (rootCandidates.length > 0) {
                    rootProcess();
                } else {
                    onReject('Root candidates not found!');
                }
            };
            ///let performGetStarted = Date.now();
            performGet();
            //#-#-FINISH
        });
    };

    /**
     * Close early opened coupons
     * @returns {Promise<string>}
     */
    let closePreviousCoupons = function () {
        let skip = ourCommand.getAdded('express') !== false;//typeof skipParam === 'undefined' ? false : skipParam;
        //let goToInplay = typeof goToInplayParam === 'undefined' ? true : goToInplayParam;
        //bsDebug(port, 'closePreviousCoupons - skip? ' + skip + ', goHome? ' + goToInplay);
        return new Promise(function (onSuccess, onReject) {
            if (skip) {
                bsDebug(port, 'closePreviousCoupons - SKIP');
                onSuccess('skipped!');
                return;
            } else {
                bsDebug(port, 'closePreviousCoupons - WORK');
            }
            let removeStakes = function () {
                let closeOne = function () {
                    let $closes = $('div.busket-body div.busket-item-delete');
                    if ($closes.length > 0) {
                        mouseChain({target: $closes[0], events: ['click'], scroll: true})
                            .then(() => {
                                setTimeout(closeOne, 500);
                            })
                            .catch((e) => onReject('Error till close: ' + e));
                    } else {
                        onSuccess('All were closed!');
                    }
                };
                // Hint: Click 'Remove all' once or every 'Close'
                let $clearBtn = $('div.busket-body span.clearAllbasket');
                if ($clearBtn.length === 1) {
                    mouseChain({target: $clearBtn[0], events: ['click'], scroll: true, scrollTop: true})
                        .then(delayFunction(1000))
                        .then(() => {
                            bsDebug(port, 'ClearBtn clicked!');
                            onSuccess('ClearBtn clicked!');
                        })
                        .catch((e) => onReject('Error till ClearBtn click: ' + e));
                } else {
                    closeOne();
                }
            };
            removeStakes();
        });
    };

    let authCheck = function () {
        // console.log('%c authCheck', 'background: red; color: white;');
        //console.log(settings);
        let $logLink = $('div.log-area button.enterBtn');
        let $security = $('b:contains("Пожалуйста, уделите 5 минут безопасности Вашего счета.")');
        if ($logLink.length > 0) {
            // Hint: Log In
            port.postMessage({m: "tech works! 2"});
            delayPromise(1000)
                .then(tryToLogIn)
                .then(() => {
                    bsDebug(port, "We're logged in!");
                    setBusy(false);
                })
                .catch((e) => dLog('red', 'OKZ', 'Error login: ' + e))
                .then(delayFunction(settings.authCheckInterval))
                .then(authCheck);
        } else if ($('title').text().indexOf('ТЕХНИЧЕСКИЕ РАБОТЫ') > -1) {
            port.postMessage({m: "tech works! 2"});
            delayPromise(settings.authCheckInterval).then(authCheck);
        } else if ($security.length > 0) {
            port.postMessage({m: "tech works! 3"});
            waitForElement('input[value="Далее"][type="submit"]', 333, 10000)
                .then(($el) => delayPromise(3333, $el))
                .then(($el) => mouseChain({target: $el[0], events: ['click'], scroll: true}))
                .then(() => bsDebug(port, "Security settings were saved!"))
                .catch((e) => bsError(port, 'Error saving security settings: ' + e))
                .then(delayFunction(settings.authCheckInterval))
                .then(authCheck);
        } else {
            port.postMessage({
                m: "authorized!",
                balance: getBalance(true)
            });
            delayPromise(settings.authCheckInterval)
                .then(checkLanguage)
                .then(authCheck);
        }
    };

    function getBalance(returnNull) {
        const $b = $('span.currusum:not(.menusum):first');
        if ($b.length > 0) {
            const bText = $b.text().trim();
            currency = $b.prev().hasClass('value-type3') ? 'RUB' : 'EUR';
            return parseFloat(bText.replace(/[\s']/g, '').trim());
        } else {
            currency = '';
            return returnNull ? 'null' : 0;
        }
    }

    let checkLanguage = function () {
        return new Promise(function (onSuccess, onReject) {
            let errors = 0;
            let performCheck = function () {
                let $langSpan = $('div.lang-item span.active');
                if ($langSpan.length === 1 && $langSpan.text().trim() === 'Русский') {
                    // Everything is OK - we go to new version and store it's url
                    onSuccess();
                } else if ($langSpan.length === 1 && $langSpan.text().trim() !== 'Русский') {
                    mouseChain({target: $langSpan[0], events: ['click']})
                        .then(() => waitForElement('div.lang-container div[rel="nofollow"]:contains("Русский")', 333, 5000, true)
                            .then(($el) => mouseChain({target: $el[0], events: ['click']})
                                .then(onSuccess)))
                        .catch((e) => {
                            errors++;
                            console.log('Error ' + errors + ': ' + e);
                            if (errors <= 5) {
                                setTimeout(performCheck, 777);
                            } else {
                                onReject('No success with ' + errors + ' tries...');
                            }
                        });
                } else if ($langSpan.length === 0) {
                    setTimeout(performCheck, 777);
                }
            };
            performCheck();
        });
    };

    const tryToLogIn = async () => {
        let $logLink = $('div.log-area button.enterBtn');
        if ($logLink.length !== 1) {
            throw 'No $logLink!';
        }
        if (Date.now() - authClicked <= 60000) {
            throw 'Too soon!';
        }
        const $formAction = bkHere === 'olimpold'
            ? $("form[action='https://olimp.com/index.php']")
            : $("form[action='https://olimpbet.kz/index.php']");
        const $formInputs = $formAction.find("input");
        await clearAndSimulate($formInputs.eq(0)[0], settings.login);
        await delayPromise(2000);
        await clearAndSimulate($formInputs.eq(1)[0], settings.password);
        await delayPromise(2000);
        await mouseChain({target: $logLink[0], events: fullClick, error: 'login'});
        authClicked = Date.now();
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("beforeunload", function () {
        if (ourCommand.isSet()) {
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            chrome.storage.local.set({
                'OLIMPOLD_COMMAND': ourCommand.get(),
                'OLIMPOLD_COMMAND_WAS_SET': increaseDelay ? Date.now() + 150000 : Date.now()
            });
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        let aInfo = document.createElement('input');
        aInfo.type = 'hidden';
        aInfo.id = 'alertOverideInfo1215';
        aInfo.value = '';
        document.body.appendChild(aInfo);
        let aScript = document.createElement('script');
        aScript.innerHTML = "alert = function(mess) { "
            + "let aiel = document.getElementById('alertOverideInfo1215'); aiel.value = mess; console.error('ALERT: ' + mess); }";
        document.body.appendChild(aScript);

        port.postMessage({m: "PAGE LOADED!"});
        chrome.storage.local.get(['OLIMPOLD_COMMAND', 'OLIMPOLD_COMMAND_WAS_SET'], function (result) {
            bsDebug(port, 'Saved command:', result);
            if (typeof result.OLIMPOLD_COMMAND !== 'undefined' && typeof result.OLIMPOLD_COMMAND_WAS_SET !== 'undefined'
                && Date.now() - result.OLIMPOLD_COMMAND_WAS_SET < 40000) {
                let currentCommand = result.OLIMPOLD_COMMAND;
                //console.log(currentCommand);
                chrome.storage.local.remove(['OLIMPOLD_COMMAND', 'OLIMPOLD_COMMAND_WAS_SET'], function () {
                    //bsDebug(port, 'Restoring with: ', currentCommand);
                    waitForCondition(() => {
                        return wasAuthCheck !== false;
                    }, 222, 10000, 'AuthCheck was not', false)
                        .then(() => messageProcessor(currentCommand))
                        .catch((e) => bsError(port, 'Something wrong with auth check! ' + e));
                });
            } else {
                chrome.storage.local.remove(['OLIMPOLD_COMMAND', 'OLIMPOLD_COMMAND_WAS_SET']);
            }
        });
    }

    function recogniseCaptcha() {
        return new Promise(function (onSuccess, onReject) {
            let requestId = 0;
            let waitStarted = 0;
            let waitForResponse = function () {
                return new Promise(function (onSuccess, onReject) {
                    let performWait = function () {
                        sentToRucaptcha(false, requestId)
                            .then((res) => {
                                console.log(res);
                                if (res.request === 'CAPCHA_NOT_READY') {
                                    delayPromise(5000).then(performWait);
                                } else if (parseInt(res.status) === 1) {
                                    onSuccess(res.request);
                                } else if (Date.now() - waitStarted < 60000) {
                                    delayPromise(5000).then(performWait);
                                } else {
                                    throw 'Bad status from rucaptcha: ' + JSON.stringify(res);
                                }
                            })
                            .catch((e) => onReject(e));
                    };
                    delayPromise(5000).then(performWait);
                });
            };
            sentToRucaptcha(true, 0)
                .then((res) => {
                    console.log(res);
                    if (parseInt(res.status) === 1) {
                        requestId = res.request;
                        waitStarted = Date.now();
                    } else {
                        throw 'Bad status from rucaptcha: ' + JSON.stringify(res);
                    }
                })
                .then(waitForResponse)
                .then((r) => onSuccess(r))
                .catch((e) => onReject(e));
        });
    }

    function sentToRucaptcha(first, requestId) {
        return new Promise(function (onSuccess, onReject) {
            let messageToSend = {
                backgroundSpecialAction: 'ajaxUrl',
                url: first ? 'rucaptchaSend' : 'rucaptchaRes',
                noBaseAuth: true,
                data: {
                    key: '027c6f1330bbc6acba3867081de6df69',
                    json: 1
                }
            };
            if (first) {
                messageToSend.data['body'] = getBase64Image($('#captcha_img').get(0));
                messageToSend.data['method'] = 'base64';
                messageToSend.data['textinstructions'] = $('#captcha_method2').text().trim();
            } else {
                messageToSend.data['action'] = 'get';
                messageToSend.data['id'] = requestId;
                messageToSend['useGET'] = true;
            }
            try {
                chrome.runtime.sendMessage(
                    messageToSend,
                    (response) => {
                        console.log('%c responseCallback: ' + response.success, 'background: green; color: white; font-weight: bold;');
                        console.log(response);
                        if (response.success) {
                            onSuccess(response.message);
                        } else {
                            onReject(response.message);
                        }
                    });
            } catch (e) {
                onReject('Error till send message: ' + e);
            }
        });
    }

})
();

if (1 !== 1) {
    /**
     * This script is just to get real Url of new version of Olimp
     */

    let goNewVersion = function () {
        let $newLink = $('a.g:contains("Новая версия сайта")');
        if ($newLink.length === 1) {
            let olimpUrlDraft = $newLink.attr('href');
            let olimpUrl = olimpUrlDraft.substring(0, olimpUrlDraft.indexOf('?'));
            chrome.storage.local.set({OLIMP_URL: olimpUrl}, function () {
                mouseChain({target: $newLink[0], events: ['click'], rejectOnPreventDefault: false})
                    .then(/*() => chrome.runtime.sendMessage({olimpLoaded: true})*/)
                    .catch((e) => {
                        console.log('Error 2: ' + e);
                        setTimeout(checkLanguage, 777);
                    });
            });
        } else {
            setTimeout(checkLanguage, 777);
        }
    };

    checkLanguage();
}
