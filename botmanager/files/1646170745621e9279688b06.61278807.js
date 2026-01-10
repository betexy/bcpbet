(function () {

    "use strict";

    let busy = false;
    let increaseDelay = false;
    let authClicked = 0;

    const port = chrome.runtime.connect({name: 'port_sbobet'});

    const settings = {
        authCheckInterval: 2000,
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        url: '',
        login: '',
        password: '',
        phone: '',
        email: '',
        uid: '',
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

    const authCheck = () => {
        (async () => {
            if (checkSE(['#LoginName', '#Password'], true)) {
                // Hint: Log In
                port.postMessage({m: "tech works! 2"});
                await delayPromise(1000);
                await tryToLogIn().catch(e => bsError(port, 'Error login: ' + e));
            } else {
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch(e => dLog('red', 'sbobet', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const tryToLogIn = async () => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        const els = {
            user: '#LoginName',
            password: '#Password',
            login: '#LoginBtn',
        };
        await waitForCondition(() => checkSE(Object.values(els), true), 333, 10000);
        await delayPromise(3000);
        if ($(els.user).val() !== settings.login) {
            await clearAndSimulate($(els.user)[0], settings.login);
            await delayPromise(3000);
        }
        if ($(els.password).val() !== settings.password) {
            await clearAndSimulate($(els.password)[0], settings.password);
            await delayPromise(3000);
        }
        await mouseChain({target: $(els.login)[0], events: fullClick, error: 'login'});
        authClicked = Date.now();
        dLog('', 'sbobet', 'Auth clicked!');
        return "auth_clicked";
    };

    const getBalance = returnNull => {
        const $b = $('#bet-credit');
        if ($b.length > 0) {
            return parseFloat($b.text().replace(',', '')
                .replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    }

    const closePreviousCoupons = async () => {
        const delSel = '#module-ticket input[value="Cancel"]';
        if ($(delSel).length > 0) {
            await mouseChain({target: $(delSel)[0], events: fullClick, error: 'delSel'});
            await delayPromise(1000);
            return 'Cleared!';
        }
        return 'Nothing to clear :(';
    };

    const openEvent = async bet => {
        if (bet.direct_link) {
            dLog('red', 'SB', `We got direct link: ${bet.direct_link}`);
            const changed = document.location.href.indexOf('sbobet.') === -1
                ? bet.direct_link.replace('sbobet', 'sbotop')
                : bet.direct_link;
            if (document.location.href === bet.direct_link || document.location.href === changed) {
                return;
            } else {
                dLog('red', 'SB', `Go to: ${changed}`);
                window.location.href = changed;
                await delayPromise(200000);
            }
        }
        const here = `${$('div.home-team').trt()} - ${$('div.away-team').trt()}`.toLowerCase();
        const weNeed = `${bet.team1} - ${bet.team2}`.toLowerCase();
        if (here === weNeed) {
            return;
        }
        const
            ourSport = ({'FOOTBALL': 'Football', 'HOCKEY': 'Ice Hockey', 'TENNIS': 'Tennis',})[bet.sport],
            sportSel = `div.live-event-header-body-inner:has(span:textEquals("${ourSport}"))`;

        await clickSequence([
            new QueueObject('li:textEquals("Live Sports")',
                $el => !$el.hasClass('selected'), null, null, 3000),
            new QueueObject('div.back-text', null, null, null,
                null, true),
            new QueueObject('li:textEquals("All Live Events")',
                $el => !$el.hasClass('selected'), $el => $el.find('span'), null, 3000),
            new QueueObject('li:textEquals("All Live Events")',
                $el => !$el.hasClass('selected'), $el => $el.find('span'), null,
                300, true),
            new QueueObject(sportSel,
                $el => !$el.closest('div.live-event-by-sport-block')
                    .find('div.live-event-body-inner').is(':visible'), null, null, 3000),
        ]);

        let $event = $([]);
        $(`div.live-event-by-sport-block:has(${sportSel}) div.live-event-button`).each(function () {
            const $rows = $(this).find('div.live-event-button-row');
            const eventHere = `${$rows.eq(0).trt()} - ${$rows.eq(1).trt()}`.toLowerCase();
            if (weNeed === eventHere || locutus_similar_text(weNeed, eventHere, true) > 70) {
                $event = $(this);
                return false;
            } else {
                console.log(`${eventHere} !== ${weNeed}`);
            }
        });
        if ($event.length === 0) {
            throw `Event ${weNeed} not found!`;
        }
        await mouseChain({target: $event[0], events: fullClick, error: '$event'});
        await delayPromise(1000);
    };

    const getBetElement = async (data, repeat) => {
        //#-#-START
        data.team1 = $('div.home-team').trt();
        data.team2 = $('div.away-team').trt();

        let markets = {
            'ONE_TWO': {
                'ONE': {
                    roots: ['1X2', 'Asian 1X2',],
                    pivotKeys: ['1',],
                },
                'TWO': {
                    roots: ['1X2', 'Asian 1X2',],
                    pivotKeys: ['2'],
                },
                'DRAW': {
                    roots: ['1X2', 'Asian 1X2',],
                    pivotKeys: ['X'],
                },
                'ONE_DRAW': {
                    roots: [''],
                    pivotKeys: [''],
                },
                'TWO_DRAW': {
                    roots: [''],
                    pivotKeys: [''],
                },
                'ONE_TWO': {
                    roots: [''],
                    pivotKeys: [''],
                }
            },
            'TOTAL': {
                'OVER': {
                    roots: ['OU',],
                    pivotKeys: ['Over',],
                },
                'UNDER': {
                    roots: ['OU',],
                    pivotKeys: ['Under',],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    roots: ['OU',],
                    pivotKeys: ['Over',],
                },
                'UNDER': {
                    roots: ['OU',],
                    pivotKeys: ['Under',],
                },
            },
            'HDP': {
                'HOME': {
                    roots: ['HDP',],
                    pivotKeys: [data.team1,],
                },
                'AWAY': {
                    roots: ['HDP',],
                    pivotKeys: [data.team2,],
                },
            },
        };

        const params = new AllMarkets(data);
        params.proceed_football = function (data) {
            if (!this.full) {
                this.addToEl('roots', 'FH.', true);
                if (data.market === 'ONE_TWO') {
                    this.addTo('roots', 'FH 1X2');
                }
            }
        };
        const final = applyAllMarkets(data, ['roots',], params, markets, true);

        if (typeof final[data.market] === 'undefined' || typeof final[data.market][data.target] === 'undefined') {
            throw 'Unsupported ' + data.time_value + '/' + data.market + '/' + data.target;
        }

        const m = final[data.market][data.target];

        dLog('green', 'Mara:', [`Final market is:`, m]);

        if (!m.roots) {
            throw `Bad market!`;
        }

        const findIdx = ($where, what) => {
            for (let i = 0; i < $where.length; i++) {
                if ($where.eq(i).trt() === what) {
                    return i;
                }
            }
            return -1;
        };

        let $el = $([]);
        for (const r of m.roots) {
            let way = 1;
            let $body = $(`thead th div[title="${r}"]`).closest('table').next();
            if ($body.length === 0) {
                $body = $(`thead th div[title="${r}"]`).closest('table').find('tbody');
                way = 2;
            }
            if ($body.length === 0
                || (way === 1 && $body.attr('id').indexOf('odds-table') === -1)) {
                continue;
            }
            const $cols = $body.find(way === 2 && data.market === 'ONE_TWO'
                ? 'tr.event-view-bet-option td' : 'tr.event-view-team-name td');
            if ($cols.length > 0) {
                for (const pk of m.pivotKeys) {
                    const idx = findIdx($cols, pk);
                    if (idx > -1) {
                        if (way === 2 && data.market === 'ONE_TWO') {
                            $el = $body.find('tr').eq(1).find('td').eq(idx);
                            break;
                        } else {
                            for (let i = 1; i < $body.find('tr').length; i++) {
                                const draft = $body.find('tr').eq(i).find('td').eq(idx).find('span.bet-option').trt();
                                const pivot = draft.indexOf('-') > 0
                                    ? parseFloat(draft.split('-').reduce((prev, cur) => prev + parseFloat(cur), 0)) / 2
                                    : parseFloat(draft);
                                if (pivot === parseFloat(data.pivot)) {
                                    $el = $body.find('tr').eq(i).find('td').eq(idx);
                                    break;
                                }
                            }
                        }
                    }
                    if ($el.length > 0) {
                        break;
                    }
                }
            } else {
                for (const pk of m.pivotKeys) {
                    const $td = $body.find(`td:has(span.bet-option:textEquals("${pk}"))`);
                    if ($td.length > 0) {
                        $el = $td;
                        break;
                    }
                }
            }
            if ($el.length > 0) {
                break;
            }
        }

        if ($el.length === 0 && !!repeat) {
            throw `${data.type}/${data.sport}/${data.time_value}/${data.market}/${data.target}/${data.pivot} not found!`;
        } else if ($el.length === 0) {
            await delayPromise(15000);
            dLog('red', 'SBO', `We'll try to find again`);
            return await getBetElement(data, true);
        }
        //#-#-FINISH
        return $el;
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => {
            const localMatch = v.team1.toLowerCase() + ' - ' + v.team2.toLowerCase();
            return localMatch === match || locutus_similar_text(localMatch, match, true) > 60;
        });
        const $coupons = $('div.ticket-content');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const $teams = $this.find('div.team-name span.Blue');
            const match = `${$teams.eq(0).trt()} - ${$teams.eq(1).trt()}`.toLowerCase();
            let localCoef = parseFloat($this.find('span.odds').trt());
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
                return 'Coefs fine!';
            }
        } else {
            throw errors.join('; ') + (checked !== data.length ? ` some stakes not checked (${checked}/${data.length})!` : '');
        }
    };

    const openCoupon = async data => {
        // Hint: live only for now
        dLog('green', 'SBO', ['openCoupon, paramData:', data]);
        for (let i = 0; i < data.length; i++) {
            await openEvent(data[i]);
            await delayPromise(1000);
            const $element = await getBetElement(data[i]);
            console.log($element);
            let coefWeWaitFor = $element.find('span.odds').trt();
            dLog('green', 'SBO', 'We got element! Coef: ' + coefWeWaitFor);
            await mouseChain({target: $element[0], events: fullClick, scroll: true, error: 'OpenEl'});
            await delayPromise(2000);
        }
        if ($('#min-max-number').length > 0) {
            return parseFloat($('#min-max-number').html().split('<br>')[0]
                .split('-').splice(-1)[0].trim());
        } else {
            return parseFloat($('div.stake-info div.stake-info-row:first span:last').trt()
                .split('-').splice(-1)[0].trim());
        }
    };

    const proceedBet = async (data, command) => {
        const checkBalance = willPlace => {
            const balance = getBalance();
            if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };
        const checkSuccess = async () => {
            await waitForElement('#ticket-successful-msg', 333, 5000, true);
            return true;
        };
        await closePreviousCoupons(false);
        currentBetData.max = await openCoupon(data);
        do {
            await checkCoefs(data);
            let willPlace = parseFloat(data[0].stake);
            if (currentBetData.max !== -1 && willPlace > currentBetData.max) {
                willPlace = currentBetData.max;
            }
            checkBalance(willPlace);
            dLog('green', 'SBO', `Will place (performBet): ${willPlace}, balance: ${getBalance()}`);
            await clearAndSimulate($('#stake')[0],
                willPlace.toString().replace('.00', '').trim());
            await delayPromise(800);
            dLog('green', 'SBO', `STAKE entered ${willPlace}`);
            const entered = parseFloat($('#stake').val());
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'SBO', 'Entered !== willPlace - try to reenter!');
                continue;
            }
            const $placeBtn = $('input[value="Place Bet"]');
            if ($placeBtn.length === 0) {
                throw 'No place button or button disabled!';
            }
            await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
        } while (!await checkSuccess());
        await delayPromise(500);
        const $coupon = $('div.bet-list div.bet-item:first');
        return {
            success: true,
            message: {
                external_id: $coupon.find('span.bet-id').trt(),
                coef: $coupon.find('span.odds-price').trt(),
                stake: $coupon.find('span.stake').trt(),
                max: currentBetData.max,
            },
        };
    };

    const collectBetResults = async (inD, command) => {
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit' ? (parseInt(inD[1]) <= 30
            ? parseInt(inD[1]) : 30) : 30;
        const allSel = 'div.mini-my-bet-view-all';
        if ($(allSel).length > 0) {
            dLog('orange', 'SBO', 'HOME');
            await bMess('sbobet').set(ourCommand.get());
            await mouseChain({target: $(allSel)[0], events: fullClick, error: 'All', scroll: true});
            const res = await bMess('SbobetWindowRes').get(200000);
            return {success: res.success, message: res.success ? res.collected : res.message};
        } else {
            dLog('orange', 'SBO', 'WINDOW');
            await delayPromise(3000);
            ourCommand.add('windowMode', true);
            const collected = ourCommand.getAdded('collected') || [];
            await delayPromise(1000);
            const settledSel = 'div.tab-active:contains("View Settled")';
            if (ourCommand.getAdded('RunningCollected')
                && $(settledSel).length > 0) {
                dLog('orange', 'SBO', 'Running collected');
                await mouseChain({
                    target: $(settledSel)[0],
                    events: fullClick, error: 'Step1-B',
                });
                dLog('orange', 'SBO', 'Settled clicked!');
                await delayPromise(5000);
                await mouseChain({
                    target: $(settledSel)[0],
                    events: fullClick, error: 'Step1-B',
                });
                dLog('orange', 'SBO', 'Settled clicked twice!');
                await delayPromise(5000);
                /* If we need switch to Running:
                $('a:contains("View Running")').parent().attr('class', 'tab-over');
                $('ul.date-group-dropdown:first').show();
                await delayPromise(1000);
                await mouseChain({
                    target: $('li.Nike_Independent_MyBets_Btn_AllDates')[0],
                    events: fullClick, error: 'Step1-A',
                }); */
            }
            // No bets
            if ($('div.popup-content-inner-window table tr.TRTotal').trt()
                .indexOf('No bets found') > -1) {
                if (!ourCommand.getAdded('RunningCollected')) {
                    dLog('orange', 'SBO', 'No bets - go next!');
                    ourCommand.add('RunningCollected', true);
                    return await collectBetResults(data, command);
                } else {
                    dLog('orange', 'SBO', 'No bets - finish!');
                    await bMess('SbobetWindowRes').set({success: true, collected});
                    window.close();
                    return;
                }
            }
            dLog('orange', 'SBO', 'Start collecting');
            await delayPromise(1000);
            $('table.ContentTable tr[bgcolor="#BBDEDE"], table.ContentTable tr[bgcolor="#CCDDFF"]')
                .each(function () {
                    const $cols = $(this).find('td');
                    const statDraft = $cols.eq(7).trt() === '' ? $cols.eq(5).trt() : $cols.eq(7).trt();
                    const res = parseFloat($cols.eq(6).find('span.FontBlue').trt());
                    const external_id = $cols.eq(1).find('span.FontMidBlue').trt();
                    if (data.length === 0 || data.indexOf(external_id) > -1) {
                        collected.push({
                            external_id,
                            status: statDraft.indexOf('Won') > -1 ? 'WON' : statDraft.indexOf('Lose') > -1 ? 'LOSE'
                                : statDraft.indexOf('Running') > -1 ? 'ACCEPTED' : 'REFUNDED',
                            coef: $cols.eq(4).find('span:not([class])').trt(),
                            stake: $cols.eq(5).find('span.FontBlue').trt(),
                            result: isNaN(res) ? '' : res + parseFloat($cols.eq(5).find('span.FontBlue').trt()),
                        });
                        dLog('orange', 'SBO', `Pushed: ${external_id}`);
                    } else {
                        dLog('orange', 'SBO', `Skipping: ${external_id}`);
                    }
                });
            dLog('orange', 'SBO', `Now collected: ${collected.length}`);
            ourCommand.add('collected', collected);
            if (!ourCommand.getAdded('RunningCollected')) {
                ourCommand.add('RunningCollected', true);
                return await collectBetResults(data, command);
            } else {
                await bMess('SbobetWindowRes').set({success: true, collected});
                window.close();
                return;
            }
        }
    }

    const commands = new class commands {
        constructor() {
            this.cLinks = {
                'BET': proceedBet,
                'EXPRESS_BET': proceedBet,
                'BET_RESULT': collectBetResults,
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
            dLog(res.success ? 'green' : 'red', 'sbobet', `${command} result: ${res.message}`);
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
                    answer: res.success ? 'Everything is Okay!'
                        : (resultData.status === 'LIMITED' ? 'Tried to bet 0' : res.message)
                };
            } else if (command === 'BET_RESULT') {
                // Hint: here we must catch errors in window mode
                if (ourCommand.getAdded('windowMode')) {
                    bMess('SbobetWindowRes').set({success: false, message: res.message})
                        .then(() => window.close());
                } else {
                    return {
                        answered: "BET_RESULT",
                        status: res.success ? "success" : "error",
                        answer: res.message
                    };
                }
            } else {
                return {};
            }
        }
    }

    const messageProcessor = message => {
        dLog('green', 'sbobet', [`messageProcessor (${busy})`, message]);
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
        } else if (message.action === "auth") {
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.phone = message.phone;
            settings.email = message.email;
            settings.uid = message.uid;
            authCheck();
        } else if (busy) {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY"
            });
        } else if (commands.exists(message.action)) {
            // Hint: execute command
            busy = true;
            ourCommand.set(message);
            commands.execute(message.action, message.data)
                .finally(() => {
                    busy = false;
                    ourCommand.clear();
                });
        } else {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: `${message.action} not supported!`
            });
        }
    };

    port.onMessage.addListener(function (message) {
        messageProcessor(message);
    });

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('green', 'sbobet', ['Command was set till unload:', ourCommand.get()]);
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess('sbobet')
                .set(ourCommand.get(), increaseDelay ? 150000 : 0);
        }
    }, true);

    const afterDOMLoaded = () => {
        bMess('sbobet',).check(40000, true)
            .then(currentCommand => {
                dLog('orange', 'sbobet',
                    [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand]);
                messageProcessor(currentCommand);
            })
            .catch(() => dLog('color: darkgray;', 'sbobet', 'No command!'));
        port.postMessage({m: "PAGE LOADED!"});
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

})();