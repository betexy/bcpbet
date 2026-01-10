(function () {

    "use strict";

    /**
     * @import libs/jquery-3.3.1.min.js
     */

    let newAPI = false;
    let authClicked = 0;
    let busy = false;
    let increaseDelay = false;
    let stopSports = false;
    let check = 0;

    const port = window.self === window.top
        ? chrome.runtime.connect({name: 'port_pariby'})
        : {postMessage: () => console.log(arguments)};

    const settings = {
        authCheckInterval: 2000,
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        url: 'https://pm.by/en/sport/Live/page',
        login: '',
        password: '',
        phone: '',
        email: '',
        uid: '',
    };

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
        'FOOTBALL': 'Football',
    };

    const ourCommand = new ourCommandProto();

    const getBalance = returnNull => {
        const $b = $('.account-block_user-cash:visible');
        if ($b.length > 0) {
            return parseFloat($b.trt().replace(/[^\d.]/g, ''));
        } else {
            return returnNull ? 'null' : 0;
        }
    };

    const authCheck = function () {
        (async () => {
            const enterError = await bMess('PB_AUTH_STATE').check(10000, true)
                .catch(() => null);

            if (enterError === true) {
                port.postMessage({
                    answered: "auth_error",
                    status: "ERROR",
                });
                bsError(port, 'ERROR AUTH!');
                return;
            }

            await closeAllWeNeed({
                '#cookiescript_close': '#cookiescript_close',
            });

            const $login = $(findSel(['a:has("i.digi_icon-login")',
                'a.tb--access-btn span:textEquals("LoginButton")', ]));
            if ($login.length > 0) {
                port.postMessage({m: "tech works! 2"});
                await delayPromise(555);
                await tryToLogIn().catch(e => bsError(port, 'Error login: ' + e));
            } else {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch(e => dLog('red', 'PB', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const tryToLogIn = async () => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }

        if (document.location.href.indexOf('https://pm.by/en/sport/Live/page/popup/login') === -1) {
            const $loginLink = $(findSel(['a:has("i.digi_icon-login")',
                'a.tb--access-btn span:textEquals("LoginButton")', ]));

            if ($loginLink.length > 0) {
                await mouseChain({target: $loginLink[0], events: fullClick});
                await delayPromise(555);
            }
        }
    };

    const closePreviousCoupons = async (data) => {
        if ($('#tstSlnBetSlipHeaderClosed').length > 0) {
            await mouseChain({target: $('#tstSlnBetSlipHeaderClosed')[0], events: fullClick});
            await delayPromise(888);
        }
        if ($('button#tstSlnRemoveAllBetsBtn').length > 0) {
            await mouseChain({target: $('button#tstSlnRemoveAllBetsBtn')[0], events: fullClick});
        }

        if ($('button.dg_betslip_ico-remove').length > 0) {
            await mouseChain({target: $('button.dg_betslip_ico-remove')[0], events: fullClick});
        }

        return {success: true, message: 'All were closed!'};
    };

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 80;
        dLog('green', 'PB', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => checkEventName(v.team1
            + ' vs ' + v.team2, match));
        const $coupons = await waitForElement('div.dg_betslip_stake',
            333, 9999, true);
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        
        $coupons.each(function () {
            const $this = $(this);
            const match = $this.find('#tstSlnTeamNameDetailsFromCashout span:eq(0)').trt() + ' vs ' + $this.find('#tstSlnTeamNameDetailsFromCashout span:eq(2)').trt();
            let localCoef = $this.find('div[type="default"]').trt();
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

    const collectBetResult = async (data) => {
        const $bet = await waitForElement('.dg_betHistory_order_item:first',
            333, 9999, true);
        await delayPromise(555);
        await mouseChain({target: $bet[0], events: fullClick, error: 'my bets'});
        await delayPromise(1222);

        const id = $bet.find('.dg_betHistory_page_bet_id').trt();
        const coef = $bet.parent().find('.dg_betHistory_order_details_odds').trt();
        const stake = $bet.find('.dg_betHistory_page_amount').trt().replace(/[^\d.]/g, '');

        // back to live
        await mouseChain({target: $('div.lv_back_btn')[0], events: fullClick, error: 'live back'});
        await delayPromise(555);

        return {
            success: true,
            message: {
                external_id: id,
                coef: coef,
                stake: stake,
                max: '7777777',
            },
        };
    };

    const getBetResult = async (data) => {
        const checkSuccess = async () => {
            // Please wait while your bet is placed
            await waitForElement('#tstSlnBetSlipHeaderClosed', 333, 20000, true, 1, 'No success after bet submit!');
            return true;
        };
        
        do {
            await checkCoefs(data);
            const willPlace = parseFloat(data[0].stake);
            const $input = data.length > 1 ? $('div.dg_betslip_placebet_wrapper input') : $('div.dg_betslip_stake_input input');
            await clearAndInputNumber($input[0], willPlace.toString().replace('.00', '').trim());
            await delayPromise(777);
            dLog('green', 'PB', `STAKE entered ${willPlace}`);
            
            if ($('div[type="error"]').length) {
                throw 'Error after stake entered';
            }

            const $placeBtn = $('#tstSlnBetSlipPlaceBetBtn');

            if ($placeBtn.length === 0 || $placeBtn.attr('disabled')) {
                throw 'No place button or button disabled!';
            }

            await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
            await delayPromise(777);

            if ($('.dg-bet-slip__notification-text').length > 0) {
                throw $('.dg-bet-slip__notification-text').trt();
            }

            if ($('div[type="error"]').length) {
                throw 'Error after stake submit';
            }
        } while (!await checkSuccess());

        // open history
        await delayPromise(555);
        await mouseChain({target: $('#tstSlnBetSlipHeaderClosed')[0], events: fullClick});
        await waitForElement('#tstSlnBetHistoryBtn', 333, 5555, true, 1, '#tstSlnBetHistoryBtn');
        await delayPromise(555);
        await mouseChain({target: $('#tstSlnBetHistoryBtn')[0], events: fullClick});

        return {success: true, message: 'bet history open'};
    };

    const openEvent = async data => {
        dLog('red', 'BB', ['openEvent', data]);

        let $el = $([]);
        const eventName = `${data.team1} — ${data.team2}`.toLowerCase();
        const checkWeAreThere = function () {
            const
                team1 = $('span.lv_team_name_text:eq(0)').trt(),
                team2 = $('span.lv_team_name_text:eq(1)').trt(),
                checkEvent = `${team1} — ${team2}`.toLowerCase();

                return checkEvent === eventName || locutus_similar_text(checkEvent, eventName, true) > 80;
        };
        const checkScore = async () => {
            if (!data.score || data.sport !== 'FOOTBALL'
                || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(data.market) > -1) {
                return true;
            }
            const
                score = $('span.lv_score:eq(0)').trt()
                    + ':' + $('span.lv_score:eq(1)').trt(),
                scoreNeed = data.score.replace(/[^\d:]/g, '').trim();

            if (score !== scoreNeed) {
                throw `SCORE_CHANGED => we need ${scoreNeed}, we have ${score}`
            }
        };

        const findEvent = async () => {
            await waitForElement('div.lv_sportsBar', 333, 30000);
            await delayPromise(777);
            const sport = accordance[data.sport];
            const $sportTab = await waitForElement(`div.lv_sportsBar:first div.lv_sportTab[title="${sport}"]`,
                333, 10000, true);
            
            if (!$sportTab.hasClass('lv_sportTab-selected')) {
                await mouseChain({target: $sportTab[0], events: fullClick});
            }

            const $events = await waitForElement('div.lv_event_row div.lv_event_details',
                333, 10000, true);

            $events.each(function () {
                const $teams = $(this).find('span.lv_team_name');
                if ($teams.length === 2) {
                    let checkEvent = `${$teams.eq(0).trt()} — ${$teams.eq(1).trt()}`.toLowerCase();
                    const res = checkEvent === eventName
                        || locutus_similar_text(checkEvent, eventName, true) > 80;
                    dLog('color: darkgray;', 'PB',
                        `"${checkEvent}" ${(res ? '==' : '!=')} "${eventName}"`);
                    if (res) {
                        $el = $(this);
                        return false;
                    }
                }
            });

        };

        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }

        await findEvent();

        if ($el.length === 1) {
            await mouseChain({
                target: $el[0],
                events: fullClick,
                scroll: true,
                error: 'EVENT'
            });
            await bMess('PB_EVENT_PAGE').check(30000, true);
        } else {
            throw 'Wrong length of Event: ' + $el.length;
        }

        await waitForCondition(() => checkWeAreThere(),
            777, 30000, 'We are not on event!');
        await checkScore();

        return 'Switched to event!';
    };

    const getBetElement = async data => {
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['Result',],
                    pivotKeys: ['Win1',],
                },
                'TWO': {
                    roots: ['Result',],
                    pivotKeys: ['Win2',],
                },
                'DRAW': {
                    roots: ['Result',],
                    pivotKeys: ['X',],
                },
                'ONE_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['1X',],
                },
                'TWO_DRAW': {
                    roots: ['Double Chance'],
                    pivotKeys: ['X2',],
                },
                'ONE_TWO': {
                    roots: ['Double Chance'],
                    pivotKeys: ['12',],
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['Total', 'Asian Total',],
                    pivotKeys: ['Over  (#PIVOT#)'],
                },
                'UNDER': {
                    roots: ['Total', 'Asian Total',],
                    pivotKeys: ['Under  (#PIVOT#)'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['Total Team 1',],
                    pivotKeys: ['Over  (#PIVOT#)'],
                },
                'UNDER': {
                    roots: ['Total Team 1',],
                    pivotKeys: ['Under  (#PIVOT#)'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['Total Team 2',],
                    pivotKeys: ['Over  (#PIVOT#)'],
                },
                'UNDER': {
                    roots: ['Total Team 2',],
                    pivotKeys: ['Under  (#PIVOT#)'],
                },
            },
            'HDP': {
                'HOME': {
                    roots: ['Handicap', 'Asian Handicap'],
                    pivotKeys: ['Handicap 1  (-#HPIVOT#)'],
                },
                'AWAY': {
                    roots: ['Handicap', 'Asian Handicap'],
                    pivotKeys: ['Handicap 2  (+#HPIVOT#)'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    roots: ['European Handicap (#EPIVOT#)'],
                    pivotKeys: ['Win1']
                },
                'H2': {
                    roots: ['European Handicap (#EPIVOT#)'],
                    pivotKeys: ['Win2']
                },
                'HX': {
                    roots: ['European Handicap (#EPIVOT#)'],
                    pivotKeys: ['X']
                }
            },
        };

        if (typeof markets[data.market] === 'undefined' || typeof markets[data.market][data.target] === 'undefined') {
            throw `Unsupported ${data.time_value} / ${data.market} / ${data.target}`;
        }

        const m = markets[data.market][data.target];

        const ePivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };

        const hPivot = pvt => {
            const p = Math.abs(pvt);
            return p === 0 ? '0' : p;
        };

        replaceInner(m, {
            '#TEAM1#': data.team1,
            '#TEAM2#': data.team2,
            '#PIVOT#': data.pivot,
            '#HPIVOT#': hPivot(data.pivot),
            '#EPIVOT#': ePivot(data.pivot),
        });

        dLog('green', 'PB', ['markets: ', m]);

        const $ts = (data.sport === 'FOOTBALL' && data.time_value.indexOf('FULL') === -1) ? $('button[title="1st half"]') : $('button[title="Main"]');

        if ($ts.length === 0) {
            throw `No TabSelector`;
        }

        if (!$ts.hasClass('lv_filter_tab-selected')) {
            await mouseChain({target: $ts[0], events: fullClick, error: '$ts'});
            await delayPromise(1555);
        }

        let $found = $([]);

        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = $(`span.lv_header_text:textEquals("${root}")`);

            if ($root.length === 0) {
                continue;
            }

            if ($root.closest('div.lv_market').hasClass('lv_market-closed')) {
                await mouseChain({target: $root[0], events: fullClick, error: '$root'});
                await delayPromise(1333);
            }

            for (const pvt of m.pivotKeys) {
                const $pivot = $root.closest('div.lv_market').find(`span.lv_stake_holder:textEqualsI("${pvt}")`);

                if ($pivot.length === 1) {
                    $found = $pivot.parent();
                    break;
                } else if ($pivot.length > 1) {
                    throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                }
            }
        }

        if ($found.length === 0) {
            throw `${data.sport}/${data.type}/${data.time_value}/${data.market}/${data.target}/${data.pivot} not found :(`;
        } else {
            $found[0].scrollIntoView();
        }

        return $found;
        //#-#-FINISH
    };

    const openCoupon = async paramData => {
        dLog('green', 'PB', ['openCoupon, paramData:', paramData]);

        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'PB', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'PB', 'Event must be opened!');
            const $element = await getBetElement(data);
            const coefWeWaitFor = $element.find('span.lv_stake_factor').trt();
            dLog('green', 'PB', 'We got element! Coef: ' + coefWeWaitFor);
            await mouseChain({target: $element[0], events: ['click'], error: 'target click'});
            await delayPromise(1000);
        }
    }

    const proceedBetSport = async (data, balance) => {
        const checkBalance = willPlace => {
            if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };

        // expand event list if needed
        if ($('button.lv_showMore:textEquals("Show More")').length > 0) {
            await mouseChain({target: $('button.lv_showMore:textEquals("Show More")')[0], events: fullClick});
            await delayPromise(1222);
        }

        await bMess('PBPerformBet').set({command: 'BET_CLOSE', data});
        await bMess('PBBetResult')
            .get(15000, 10000, 300, true);
        await delayPromise(555);
        await openCoupon(data);
        await delayPromise(555);
        const willPlace = parseFloat(data[0].stake);
        checkBalance(willPlace);
        await delayPromise(555);
        await bMess('PBPerformBet').set({command: 'BET_SUBMIT', data});
        const pbResult = await bMess('PBBetResult')
            .get(60000, 10000, 300, true);

        if (pbResult.success) {
            await bMess('PBPerformBet').set({command: 'BET_HISTORY', data});
            const bhResult = await bMess('PBBetResult')
                .get(40000, 10000, 300, true);

            return bhResult;

        } else {
            throw pbResult.message;
        }
    };

    const collectBetResultsSports = async (inD, command, balance, inplay) => {
        throw 'collectBetResultsSports';
    };

    const betProcessor = (command, data) => {
        if (betCommands.exists(command)) {
            // Hint: execute command
            betCommands.execute(command, data);
        } else {
            dLog('red', 'PB', ['Unknown Bet command:', command]);
        }
    };

    const betCommands = new class betCommands {
        constructor() {
            this.cLinks = {
                'BET_HISTORY': collectBetResult,
                'BET_SUBMIT': getBetResult,
                'BET_CLOSE': closePreviousCoupons,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data) {
            dLog('green', 'PB', [command, data]);
            const res = await this.cLinks[command](data)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}`
                }));
            dLog(res.success ? 'green' : 'red', 'PB', [`${command} bet result was set:`, res]);
            await bMess('PBBetResult').set(res);
            
            return res;
        }
    };

    const sportCommands = new class SportCommands {
        constructor() {
            this.cLinks = {
                'BET': proceedBetSport,
                'EXPRESS_BET': proceedBetSport,
                'BET_RESULT': collectBetResult,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data, balance) {
            currentBetData.init(data);
            dLog('green', 'PB', [command, data]);
            const res = await this.cLinks[command](data, balance)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'PB', [`${command} sports result was set:`, res]);
            await bMess('PBSportResult').set(res);
            return res;
        }
    };

    const sportProcessor = command => {
        dLog('green', 'PB', `SportProcessor: ${command.action}`);
        if (sportCommands.exists(command.action)) {
            // Hint: execute command
            ourCommand.set(command);
            sportCommands.execute(command.action, command.data, command.balance)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'PB', ['Unknown Sport command:', command]);
        }
    };

    const executeSportCommand = async (data, command, balance) => {
        dLog('green', 'PB', `executeSportCommand: ${command}, ${balance}`);
        await bMess('PBSportCommand').set({action: command, data, balance});
        const res = await bMess('PBSportResult')
            .get(120000, 10000, 300, true);

        return res;
    };

    const commands = new class commands {
        constructor() {
            this.cLinks = {
                'BET': executeSportCommand,
                'EXPRESS_BET': executeSportCommand,
                'BET_RESULT': executeSportCommand,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data) {
            currentBetData.init(data);
            //dLog('green', 'PB', [`commands execute ${command}`, data, formatStack((new Error()).stack)]);
            const res = await this.cLinks[command](data, command, getBalance()).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'PB', [`${command} result:`, res]);
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
    }

    const messageProcessor = message => {
        dLog('green', 'PB', [`messageProcessor (${busy})`, message]);
        newAPI = !!message.newAPI;
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
        } else if (message.action === "auth") {
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            bMess('PB_AUTH_SET').set(message);
            bMess('PB_AUTH_STATE').set(false);
            authCheck();
        } else if (busy) {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY"
            });
        } else if (commands.exists(message.action)) {
            // Hint: execute command
            bMess('PB_EVENT_PAGE').set(false);
            busy = true;
            ourCommand.set(message);
            commands.execute(message.action, message.data)
                .finally(() => {
                    busy = false;
                    ourCommand.clear();
                    window.location.href = settings.url;
                });
        } else {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: `${message.action} not supported!`
            });
        }
    };

    if (window.self === window.top) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message);
        });
    }

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('green', 'PB', ['Command was set till unload:', ourCommand.get()]);
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess('PARIBY_COMMAND', true).set(ourCommand.get(), increaseDelay ? 130000 : 0);
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});

        if (window.self === window.top) {
            // Hint: main window (outer with auth, menu, balance, etc.)
            bMess('PARIBY_COMMAND', true).check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'PB', [
                        `Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand
                    ]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'PB', 'No command!'));
        } else if (document.location.href.indexOf('https://iframes.pm.by/login.html') === 0) {
            (async () => {
                const pbSettings = await bMess('PB_AUTH_SET').check(60000, true)
                    .catch(() => null);
                if (pbSettings) {
                    await waitForElement('#login-phone', 333, 10000);
                    await clearAndSimulate($('#login-phone')[0], pbSettings.login);
                    await delayPromise(2222);
                    await clearAndSimulate($('#password')[0], pbSettings.password);
                    await delayPromise(2222);

                    if (!$('#permission').is(':checked')) {
                        await mouseChain({target: $('#permission')[0], events: fullClick});
                        await delayPromise(777);
                    }

                    if ($('button[type="submit"]').is(':disabled')) {
                        await bMess('PB_AUTH_STATE').set(true);
                    }

                    await mouseChain({target: $('button[type="submit"]')[0], events: fullClick, error: 'submit login'});
                    await delayPromise(3555);
                    authClicked = Date.now();

                    if ($('div[class^="Alert_alert__header_"]').length > 0 || $('#login-phone').length > 0) {
                        await bMess('PB_AUTH_STATE').set(true);
                    }
                } else {
                    await bMess('PB_AUTH_STATE').set(true);
                }

                dLog('', 'PB', 'Auth clicked!');
            })();
        } else if (document.location.href.indexOf('about:srcdoc') === 0) {
            let sportProcessorState = false;
            (async () => {
                while (!stopSports) {
                    if (document.location.hash === '#/Live') {
                        const csc = await bMess('PBSportCommand').check(10000, true)
                            .catch(() => null);

                        if (!sportProcessorState) {
                            sportProcessorState = true;
                            dLog('green', 'PB', 'Sport processor initialized!');
                        }

                        if (csc !== null) {
                            sportProcessor(csc);
                        }
                    }

                    if (document.location.hash === '') {
                        const pb = await bMess('PBPerformBet').check(10000, true)
                            .catch(() => null);
                        
                        if (pb !== null) {
                            if (pb.command === 'BET_SUBMIT') {
                                betProcessor(pb.command, pb.data);
                            }

                            if (pb.command === 'BET_CLOSE') {
                                betProcessor(pb.command, pb.data);
                            }
                        }
                    }

                    if (document.location.hash === '#/bet-history') {
                        const pb = await bMess('PBPerformBet').check(10000, true)
                            .catch(() => null);
                        
                        if (pb !== null) {
                            if (pb.command === 'BET_HISTORY') {
                                betProcessor(pb.command, pb.data);
                            }
                        }
                    }

                    await delayPromise(333);
                }
            })();
        } else if (document.location.href.indexOf('https://smdvkm.live/') === 0) {
            bMess('PB_EVENT_PAGE').set(true);
        }
    }
})();
