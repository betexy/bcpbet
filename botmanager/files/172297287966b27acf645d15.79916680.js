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

    const port = window.self === window.top
        ? chrome.runtime.connect({name: 'port_topsport'})
        : {postMessage: () => console.log(arguments)};

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
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 1,
        betweenBets: 25000,
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
        'HOCKEY': 'Ice Hockey',
        'VOLLEYBALL': 'Volleyball',
        'TENNIS': 'Tennis',
        'BASKETBALL': 'Basketball',
        'CYBERSPORT': '',
    };

    const ourCommand = new ourCommandProto();

    const getBalance = returnNull => {
        const $b = $('#balance');
        if ($b.length > 0) {
            return parseFloat($b.trt().replace(/[^\d.]/g, '').trim());
        } else {
            return returnNull ? 'null' : 0;
        }
    };

    const authCheck = function () {
        const $errorMessage = $('div.sign-in-forms-item div.alert-danger:visible');

        if ($errorMessage.length > 0) {
            let errors = [];
            $errorMessage.each((idx, el) => errors.push($(el).trt()));
            dLog('red', 'topsport', `Login error(s): ${errors.join(',')}`);
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            return;
        }

        (async () => {
            await closeAllWeNeed({
                '#c-p-bn': '#c-p-bn',
            });
            if (checkSE(['a[title="Login"]:visible'], true)) {
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
            .catch(e => dLog('red', 'topsport', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(authCheck);
    };

    const tryToLogIn = async () => {
        if (Date.now() - authClicked < 60000) {
            throw 'Too soon!';
        }
        const els = {
            user: 'input#login_name_widget',
            password: 'input#login_password_widget',
            login: 'button#login_login',
        };
        if ($('h2:textEquals("Login to TOPsport with")').length === 0) {
            await mouseChain({
                target: $('a[title="Login"]:visible')[0], events: fullClick,
                error: 'tli1'
            });
        }
        await waitForCondition(() => checkSE(Object.values(els), true),
            333, 10000);
        await delayPromise(1111);
        if ($(els.user).val() !== settings.login) {
            await clearAndSimulate($(els.user)[0], settings.login);
            await delayPromise(1111);
        }
        if ($(els.password).val() !== settings.password) {
            await clearAndSimulate($(els.password)[0], settings.password);
            await delayPromise(1111);
        }
        authClicked = Date.now();
        dLog('', 'topsport', 'Auth clicked!');

        await mouseChain({target: $(els.login)[0], events: fullClick, error: 'login'});
        await delayPromise(333);

        return "auth_clicked";
    };

    const closePreviousCoupons = async () => {
        const $remAll = $('span:textEquals("Clear All"):visible');

        if ($remAll.length > 0) {
            await mouseChain({target: $remAll[0], events: fullClick, error: 'close All coupons'});
            await delayPromise(333);
        }
    };

    const getBetElement = async bet => {
        //#-#-START
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    tabs: ['All'],
                    roots: ['Match Result'],
                    pivotKeys: ['#TEAM1#'],
                },
                'TWO': {
                    tabs: ['All'],
                    roots: ['Match Result'],
                    pivotKeys: ['#TEAM2#'],
                },
                'DRAW': {
                    tabs: ['All'],
                    roots: ['Match Result'],
                    pivotKeys: ['Draw',],
                },
                'ONE_DRAW': {
                    tabs: ['All'],
                    roots: ['Double Chance'],
                    pivotKeys: ['1X',],
                },
                'TWO_DRAW': {
                    tabs: ['All'],
                    roots: ['Double Chance'],
                    pivotKeys: ['X2',],
                },
                'ONE_TWO': {
                    tabs: ['All'],
                    roots: ['Double Chance'],
                    pivotKeys: ['12',],
                }
            },
            'TOTAL': {
                'OVER': {
                    tabs: ['All'],
                    roots: ['Total Goals', 'Total Goals Asian'],
                    pivotKeys: ['Over  (#PIVOT#)'],
                },
                'UNDER': {
                    tabs: ['All'],
                    roots: ['Total Goals', 'Total Goals Asian'],
                    pivotKeys: ['Under  (#PIVOT#)'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tabs: ['Teams'],
                    roots: ['#TEAM1# Total Goals'],
                    pivotKeys: ['Over  (#PIVOT#)'],
                },
                'UNDER': {
                    tabs: ['Teams'],
                    roots: ['#TEAM1# Total Goals'],
                    pivotKeys: ['Under  (#PIVOT#)'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tabs: ['Teams'],
                    roots: ['#TEAM2# Total Goals'],
                    pivotKeys: ['Over  (#PIVOT#)'],
                },
                'UNDER': {
                    tabs: ['Teams'],
                    roots: ['#TEAM2# Total Goals'],
                    pivotKeys: ['Under  (#PIVOT#)'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    tabs: ['Corners'],
                    roots: ['Corners Over/Under'],
                    pivotKeys: ['Over  (#PIVOT#)'],
                },
                'UNDER': {
                    tabs: ['Corners'],
                    roots: ['Corners Over/Under'],
                    pivotKeys: ['Under  (#PIVOT#)'],
                },
            },
            'HDP': {
                'HOME': {
                    tabs: ['All'],
                    roots: ['Goals Handicap', 'Goals Asian Handicap'],
                    pivotKeys: ['#TEAM1#  (#HPIVOT#)'],
                },
                'AWAY': {
                    tabs: ['All'],
                    roots: ['Goals Handicap', 'Goals Asian Handicap'],
                    pivotKeys: ['#TEAM2#  (#HPIVOT#)'],
                }
            },
        };

        if (typeof markets[bet.market] === 'undefined' || typeof markets[bet.market][bet.target] === 'undefined') {
            throw `Unsupported ${bet.time_value} / ${bet.market} / ${bet.target}`;
        }

        const params = new AllMarkets(bet);

        params.proceed_football = function (bet) {
            if (!this.full) {
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('roots', ['1st Half Result']);
                } else {
                    this.addToEl('roots', '1st Half', true);
                }
            }
        };

        params.proceed_tennis = function (bet) {
            let setGame = false;
            if (bet.market === 'ONE_TWO') {
                if (bet.time_value.indexOf('SET') > -1 && bet.time_value.indexOf('GAME') > -1) {
                    const parts = bet.time_value.split('_GAME_');
                    this.addTotal('roots', [`${this.tDigit}${this.th} Set ${parts[1].trim()}${this.calcTh(parseInt(parts[1].trim()))} Game `]);
                    setGame = true;
                } else {
                    this.addTotal('roots', ['Match Winner']);
                }
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Games Handicap']);
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total Games']);
            }
            if (!this.full) {
                if (!setGame) {
                    if (bet.market === 'ONE_TWO') {
                        this.addTotal('roots', [`${this.tDigit}${this.th} Set Winner`]);
                    } else {
                        this.addToEl('roots', `${this.tDigit}${this.th} Set`, true);
                    }
                }
            }
        };

        const final = applyAllMarkets(bet, ['roots', 'pivotKeys', 'tabs'], params, markets);
        const m = final[bet.market][bet.target];

        const hPivot = pvt => {
            return parseFloat(pvt) === 0 ? '0' : parseFloat(pvt) > 0 ? `+${pvt}` : pvt;
        };
        replaceInner(m, {
            '#TEAM1#': bet.team1,
            '#TEAM2#': bet.team2,
            '#PIVOT#': bet.pivot,
            '#HPIVOT#': hPivot(bet.pivot),
            '#HPIVOTI#': hPivot(bet.pivot * -1),
        });

        dLog('green', 'TopSport', ['Final market is:', m]);

        let $found = $([]);
        
        await waitForElement('div.right-left-events-wrapper', 333, 10000);
        console.log('%c' + 'Markets should be here!',
            'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        await delayPromise(255);

        for (const root of m.roots) {
            const $root = $(`div.market-title-v3[title="${root}"]`).parent();
            console.log(`Checking root: ${root} => ${$root.length}`);
            if ($root.length === 0) {
                continue;
            }
            for (const pvt of m.pivotKeys) {
                $root.find('div.single-events-b-v3').each(function () {
                    const currentPvt = $(this).attr('title').trim();
                    if(currentPvt === pvt) {
                        $found = $(this);
                        return false;
                    }
                });
                if ($found.length === 1) {
                    break;
                }
            }
            if ($found.length === 1) {
                break;
            }
        }
        
        if ($found.length === 0) {
            throw `${bet.sport}/${bet.type}/${bet.time_value}/${bet.market}/${bet.target}/${bet.pivot} not found :(`;
        }

        return $found;
        //#-#-FINISH
    };

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 70;
        dLog('', 'TopSport', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const openEvent = async data => {
        dLog('red', 'topsport', ['openEvent', data]);
        let $el = $([]);
        const eventName = `${data.team1} - ${data.team2}`.toLowerCase();
        const sport = accordance[data.sport];
        const checkWeAreThere = function () {
            const
                team1 = data.sport === 'FOOTBALL' 
                    ? $('div.game-score p>span:eq(0):visible').trt()
                        : $('b.team-form-player:eq(0):visible').trt(),
                team2 = data.sport === 'FOOTBALL' 
                    ? $('div.game-score p>span:eq(1):visible').trt()
                        : $('b.team-form-player:eq(1):visible').trt(),
                checkEvent = `${team1} — ${team2}`;
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };
        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }
        const findEvent = async () => {
            const
                resSel = `div#result-search dl > dt:textEquals("${sport}")`,
                searchEl = 'input[title="Search a competition or a team"]',
                $resSel = () => $(resSel).parent().find('dd');

            await waitForElement(searchEl, 333, 8888);
            await delayPromise(333);
            await clearAndSimulate($(searchEl)[0], data.team1,
                false, false, true);
            await delayPromise(333);
            await waitForElement(resSel, 333, 12000);
            await delayPromise(250);
            
            $resSel().each(function () {
                const $this = $(this);
                const team1 = $this.find('button > span').eq(0).trt();
                const team2 = $this.find('button > span').eq(1).trt();
                const checkEvent = `${team1} - ${team2}`.toLowerCase();
                dLog('blue', 'TopSport', `Check: '${checkEvent}' === '${eventName}'`);
                if (checkEventName(checkEvent, eventName)) {
                    $el = $(this);
                    return false;
                }
            });
            return $el.length > 0;
        };
        if (!!data.direct_link) {
            throw 'direct_link is not available now!';
        }
        if (await findEvent() === false) {
            throw 'Event not found!';
        }
        // go to event page
        await mouseChain({
            target: $el.find('button')[0],
            events: fullClick,
            error: 'EVENT'
        });
        await waitForCondition(checkWeAreThere,
            500, 20000, 'We are not on event!');

        return 'Switched to event!';
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => checkEventName(v.team1.toLowerCase()
            + ' - ' + v.team2.toLowerCase(), match));
        const $coupons = $('div.mini-list-events-b-v3 > ul > li');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $this.find('div.title-event-b-v3 span').trt();
            let localCoef = $this.find('span.bet-price-v3').trt();
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

    /*
    await checkCoefs([
        {team1: "bc zalgiris kaunas", team2: "bc prienai", coef: '1'},
        {team1: " KK Zadar", team2: "KK Crvena Zvezda (Red Star Belgrade)", coef: ''},
    ]);
     */

    const openCoupon = async paramData => {
        dLog('green', 'topsport', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'BB', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'BB', 'Event must be opened!');
            const $element = await getBetElement(data);
            await mouseChain({target: $element[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(500);
        }
    };

    const proceedBetSport = async (data, balance) => {
        const checkSuccess = async () => {
            // Please wait while your bet is placed
            await waitForElement('div.betslip-text-info-v3 span:textEquals("To select a bet, please click on any odd."):visible', 333, 30000,
                true, 1, 'No success!');
            return true;
        };
        const checkBalance = willPlace => {
            if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };
        await closePreviousCoupons();
        let willPlace = parseFloat(data[0].stake);
        if (!willPlace) {
            throw`Bad will place: ${willPlace}, ${data[0].stake}`;
        }
        checkBalance(willPlace);
        await openCoupon(data);
        do {
            await checkCoefs(data);
            const place = willPlace.toString().replace('.00', '').trim();
            dLog('green', 'Stake', `Will place (performBet): ${place}, balance: ${balance}`);
            const $input = () => $('input#express-bet-input');
            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            if (parseFloat($input().val()) !== parseFloat(place)) {
                await clearAndInputNumber($input()[0], place);
                await delayPromise(555);
                dLog('green', 'BB', `STAKE entered ${willPlace}`);
            }
            let entered = parseFloat($input().val());
            dLog('green', 'BB', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'BB', 'Entered !== willPlace - try to reenter!');
                continue;
            }
            await delayPromise(555);
            const $placeBtn = $(findSel(['button[type="submit"]:textEquals("Place bets!"):visible']));
            if ($placeBtn.length === 0 || $placeBtn.attr('disabled') === 'disabled') {
                throw 'No place button or button disabled!';
            }
            await delayPromise(333);
            await mouseChain({target: $placeBtn[0], events: fullClick, scroll: true, error: '$placeBtn'});
        } while (!await checkSuccess());
        await delayPromise(777);
        await mouseChain({
            target: $('div[data-mode="openBets"]')[0],
            events: fullClick,
            error: 'openBets'
        });
        await delayPromise(1222);
        const $openBets = await waitForElement('div.open:first',
            333, 9999, true);
        return {
            success: true,
            message: {
                external_id: $openBets.find('div.open-bets-time-id b').trt(),
                coef: $openBets.find('span.bet-price-v3').trt(),
                stake: $openBets.find('div.stake-row b').trt().replace(/[^\d.]/g, ''),
                max: '7777777',
            },
        };
    };

    const collectBetResultsSports = async (inD, balance) => {
        let collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30)
            : 30;
        dLog('', 'topsport', [
            `collectBetResults, on: '${document.location.href}', limit: ${limit}, data:`,
            data]);
        if (document.location.href.indexOf('/betting-history/') === -1) {
            const $myBets = await waitForElement('a[href="https://en.topsport.lt/betting-history"]',
                333, 9999);
            await mouseChain({target: $myBets[0], events: fullClick, error: '$myBets'});
            await delayPromise(1000);
            dLog('', 'topsport', 'My bets clicked!');
        } else {
            dLog('', 'topsport', 'Already on my bets page!');
        }
        let checked = 0;
        for (const tab of ['Open bets', 'Settled bets']) {
            const $tab = await waitForElement(`a:textEquals("${tab}")`, 333, 9999);
            if ($tab.attr('class').indexOf('isSelected') === -1) {
                await mouseChain({target: $tab[0], events: fullClick, error: '$tab'});
                dLog('', 'topsport', `Tab ${tab} clicked!`);
                await delayPromise(3000);
            } else {
                dLog('', 'topsport', `Tab ${tab} already selected!`);
                await delayPromise(3000);
            }
            const
                resSel = 'div.OM-BettingHistoryItemV1',
                noResSel = 'div.OM-BettingHistory__EmptyList';
            await waitForElement([resSel, noResSel], 333, 9999);
            if ($(noResSel).length > 0) {
                dLog('', 'topsport', `No results in the tab ${tab}!`);
                continue;
            }
            await $(resSel).eachAsync(async function () {
                if (checked > limit) {
                    return false;
                }
                checked++;
                const
                    $this = $(this),
                    betId = $this.find('a:textEquals("Bet details")').attr('href')
                        .split('/').slice(-1)[0];
                if (data.length === 0 || data.indexOf(betId) > -1) {
                    const
                        sts = $this.find('span.OM-BettingHistoryItemV1__BetStatusValueText').trt(),
                        status = tab === 'Open bets'
                            ? 'ACCEPTED'
                            : sts === 'Won' ? 'WON' : sts === 'Lost' ? 'LOSE' : 'REFUNDED';
                    collected.push({
                        external_id: betId,
                        status,
                        stake: $this.find('span.OM-BettingHistoryItemV1__UsedStakeAmount').trt()
                            .replace(/[^\d.]/g, ''),
                        result: status === 'ACCEPTED' ? ''
                            : parseFloat($this.find('div.OM-BettingHistoryItemV1__ReturnValue')
                                .trt().replace(/[^\d.]/g, '')),
                    });
                }
            });
            dLog('', 'topsport', [`${tab}, checked: ${checked}, collected:`, collected]);
        }
        await delayPromise(888);
        return {success: true, message: collected};
    };

    const sportCommands = new class SportCommands {
        constructor() {
            this.cLinks = {
                'BET': proceedBetSport,
                'EXPRESS_BET': proceedBetSport,
                'BET_RESULT': collectBetResultsSports,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data, balance) {
            currentBetData.init(data);
            dLog('green', 'topsport', [command, data]);
            const res = await this.cLinks[command](data, balance)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog(res.success ? 'green' : 'red', 'topsport', [`${command} sports result was set:`, res]);
            await bMess('TopSportResult').set(res);
            return res;
        }
    };

    const sportProcessor = command => {
        dLog('green', 'topsport', `SportProcessor: ${command.action}`);
        if (sportCommands.exists(command.action)) {
            // Hint: execute command
            ourCommand.set(command);
            sportCommands.execute(command.action, command.data, command.balance)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'topsport', ['Unknown Sport command:', command]);
        }
    };

    const executeSportCommand = async (data, command, balance) => {
        dLog('green', 'topsport', `executeSportCommand: ${command}, ${balance}`);
        let successDiff, realSuccessInterval;
        if (command === 'BET') {
            realSuccessInterval = data[0].successBetInterval || settings.betweenBets;
            const wasSuccessStake = await bMess('WasSuccessStake')
                .check(realSuccessInterval)
                .catch(() => 0);
            successDiff = Date.now() - wasSuccessStake;
            if (successDiff < realSuccessInterval) {
                throw `To early after previous success bet ${successDiff} instead of ${realSuccessInterval}!`
            }
        }
        if (command === 'BET' && !!currentBetData.data[0].betFromParser) {
            const eventName = `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`;
            if (!await eventsWork('topsport', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'topsport',
                    `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                    + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
            }
        }

        await bMess('TopSportCommand').set({action: command, data, balance});
        dLog('yellow', 'topsport', `Start waiting for command: ${command}`);
        return await bMess('TopSportResult', false)
            .get(120000, 10000, 300, true);
    };

    const commands = new class commands {
        constructor() {
            this.testing = false;
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
            const res = await this.cLinks[command](data, command, getBalance()).catch(e => ({
                success: false,
                message: `${command}: ${e}, ${formatStack(e.stack)}`
            }));
            dLog(res.success ? 'green' : 'red', 'topsport', [`${command} result:`, res]);
            this.prepareResult(command, res)
                .then(m => port.postMessage(m))
            if (!res.success) {
                throw res.message;
            }
            return res;
        }

        async prepareResult(command, res) {
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('topsport', settings,
                        `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`,
                        true, false);
                    await bMess('WasSuccessStake').set(Date.now());
                }
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
                if (res.message && typeof res.message === 'string'
                    && res.message.indexOf('Войдите в систему') > -1) {
                    delayPromise(1000)
                        .then(() => window.location.reload());
                }
                if (!!currentBetData.data[0].betFromParser) {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'TOPSPORT';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = currentBetData.data[0].source;
                    resultData.externalId = resultData.external_id;
                    resultData.currency = 'USD';
                    resultData.sport = currentBetData.data[0].sport;
                    resultData.timeValue = currentBetData.data[0].time_value;
                    resultData.league = currentBetData.data[0].league;
                    resultData.homeTeam = currentBetData.data[0].team1;
                    resultData.awayTeam = currentBetData.data[0].team2;
                    resultData.score = currentBetData.data[0].score;
                    resultData.pivot = resultData.pivot || null;
                }
                return {
                    answered: !!currentBetData.data[0].betFromParser ? "F_BET" : "BET",
                    data: resultData,
                    answer: res.success ? 'Everything is Okay!' : (resultData.status === 'LIMITED' ? 'Tried to bet 0' : res.message),
                    doNotSend: !!currentBetData.data[0].betFromParser && !res.success,
                };
            } else if (command === 'BET_RESULT') {
                const liveSel = 'li:has(span:textEquals("Live")):visible';
                if ($(liveSel).length > 0) {
                    delayPromise(500)
                        .then(() => mouseChain({
                            target: $(liveSel).find('a')[0],
                            events: fullClick, error: 'liveSel'
                        }))
                        .then(() => dLog('green', 'topsport', 'liveSel clicked'));
                }
                return {
                    answered: "BET_RESULT",
                    status: res.success ? "success" : "error",
                    answer: res.message
                };
            } else {
                return {};
            }
        }
    };

    const messageProcessor = message => {
        dLog('green', 'topsport', [`messageProcessor (${busy})`, message]);
        newAPI = !!message.newAPI;
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
            settings.stake_fork = message.stake_fork;
            settings.eventMaxBets = 1;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
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

    if (window.self === window.top) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message);
        });
    }

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('green', 'topsport', ['Command was set till unload:', ourCommand.get()]);
            bMess('TOPSPORT_COMMAND', true).set(ourCommand.get(), increaseDelay ? 130000 : 0);
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
            bMess('TOPSPORT_COMMAND', true).check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'topsport', [
                        `Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand
                    ]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'topsport', 'No command!'));
        } else if (document.location.href.indexOf('bc-sportsbook-spring.topsport.lt') > -1) {
            // live-tv => bc-sportsbook-spring.topsport.lt
            // live => om-sports2.topsport.lt
            // Hint: sports frame (here the most of work)
            (async () => {
                while (!stopSports) {
                    if ($('p.site-is-offline-j').length > 0) {
                        document.location.reload();
                    }
                    const csc = await bMess('TopSportCommand').check(10000, true)
                        .catch(() => null);
                    if (csc !== null) {
                        sportProcessor(csc);
                    }
                    await delayPromise(500);
                }
            })();
            dLog('green', 'topsport', 'Sport processor initialized!');
        }
    }

})();
