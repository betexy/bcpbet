(function () {
    "use strict";

    let doNotLogin = false;
    let stopScanPrematch = false;

    const isCupis = document.location.href.indexOf('marathonbet.ru') > -1;
    const isBy = document.location.href.indexOf('marathonbet.by') > -1;
    const historyLink = isBy ? 'https://www.marathonbet.by/en/myaccount/bethistory.htm' : 'https://www.marathonbet.com/en/myaccount/bethistory.htm';

    const sportAccordance = isCupis
        ? {
            'FOOTBALL': 'Футбол',
            'TENNIS': 'Теннис',
            'BASEBALL': 'Бейсбол',
            'HOCKEY': 'Хоккей',
            'BASKETBALL': 'Баскетбол',
            'VOLLEYBALL': 'Волейбол',
            'TABLETENNIS': 'Настольный теннис',
            'CYBERSPORT': 'Киберспорт',
        } : {
            'FOOTBALL': 'Football',
            'TENNIS': 'Tennis',
            'BASEBALL': 'Baseball',
            'HOCKEY': 'Ice Hockey',
            'BASKETBALL': 'Basketball',
            'VOLLEYBALL': 'Volleyball',
            'HANDBALL': 'Handball',
            'TABLETENNIS': 'Table Tennis',
            'CYBERSPORT': 'e-Sports',
        };

    // TODO: Do not forget disable it after work!
    const ignoreLimited = false;

    let newAPI = false;
    let currency = '';
    let limited = false;
    let authClicked = 0;
    let busy = false;
    let enterError = false;
    let port = chrome.runtime.connect({name: "port_" + (isCupis ? "marathoncupis" : "marathon")});
    let settings = {
        authCheckInterval: 2000,
        url: '',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 3,
        betweenBets: 25000,
    };

    let betResults = [];
    let currentBetData = false;
    let nextWasClicked = false;
    let ourCommand = new ourCommandProto();

    const selectEngLang = async () => {
        await mouseChain({target: $('div.languages a')[0], events: fullClick, error: '$langLink'});
        await delayPromise(1555);
        await mouseChain({target: $('div.language-menu:visible div.v-list-item__content:textEquals("English")')[0], events: fullClick, error: 'selectEng'});
        await delayPromise(777);
    }

    const goToLive = async () => {
        const link = ['#live_href', 'a[href="/en/live/popular"]', 'a[href="/en/"]'].find(s => $(s).length > 0);
        if (link) {
            if ($(link).parent().hasClass('nav-bar__item_active') === false) {
                await mouseChain({target: $(link)[0], events: fullClick, error: 'home'});
                await delayPromise(888);
            }
        }
    }

    const messageProcessor = function (message) {
        dLog('green', 'Mara', [`messageProcessor (${busy})`, message]);
        newAPI = !!message.newAPI;
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        }
        /*
        if (limited) {
            port.postMessage({
                answered: message.action,
                status: "LIMITED",
                answer: "LIMITED"
            });
            return;
        }
         */
        if (['auth', 'SCAN_PREMATCH'].indexOf(message.action) === -1 && busy) {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY"
            });
        } else if (['SCAN_PREMATCH'].indexOf(message.action) > -1) {
            stopScanPrematch = true;
        } else if (message.action === "auth") {
            if (message.login === 'reger') {
                bsDebug(port, 'Awaiting for registration command!');
                return;
            }
            if (message.login === 'do_not_login') {
                doNotLogin = true;
                bsDebug(port, 'Do not login mode!');
                return;
            }
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.renew = message.renew;
            settings.uid = message.uid;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            authCheck(settings);
        } else if (message.action === "takeScreenshot") {
            screenshotHelper(port, 'marathon', ['div.sport-category-container'], message.data);
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
        } else if (!doNotLogin && typeof Cookies.get("PUNTER_KEY_EXISTS") === 'undefined') {
            // Let's try to resend command after 15 seconds... maybe it is login lately
            if (typeof message.waitsForLogin === 'undefined' || message.waitsForLogin < 2) {
                message.waitsForLogin = typeof message.waitsForLogin === 'undefined' ? 0 : message.waitsForLogin + 1;
                ourCommand.set(message);
                bsDebug(port, 'Wait for login: ' + message.waitsForLogin);
                delayPromise(20000).then(() => {
                    messageProcessor(message);
                });
            } else {
                port.postMessage({answered: message.action, status: "error", answer: "Not logged in!"});
            }
        } else if (['BET', 'EXPRESS_BET'].indexOf(message.action) > -1) {
            busy = true;
            ourCommand.set(message);
            proceedBet(message.data)
                .finally(async () => {
                    /*
                    await mouseChain({
                        target: $('a[href$="/live/popular"]:first')[0],
                        events: fullClick,
                        error: 'alp'
                    });
                     */
                });
        } else if (message.action === 'BET_RESULT') {
            busy = true;
            ourCommand.set(message);
            if (!isCupis && window.location.href.indexOf(historyLink) === -1) {
                window.location.href = historyLink;
            } else if (isCupis && window.location.href.indexOf('https://www.marathonbet.ru/su/myaccount/bethistory.htm') === -1) {
                window.location.href = 'https://www.marathonbet.ru/su/myaccount/bethistory.htm';
            } else {
                collectData(message.data);
            }
        } else if (['DEPOSIT', 'WITHDRAW', 'CHECK_PAYMENTS'].indexOf(message.action) > -1) {
            busy = true;
            ourCommand.set(message);
            (d => message.action === 'DEPOSIT' ? deposit(d) : message.action === 'WITHDRAW' ? withdraw(d) : checkPayments(d))(message.data)
                .then(() => bsDebug(port, 'It\'s looks like ' + message.action + ' done!'))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(async () => {
                    busy = false;
                    ourCommand.clear();
                    await goToLive();
                });
        } else if (['GET_EVENTS', 'SCAN_PREMATCH'].indexOf(message.action) > -1) {
            busy = true;
            ourCommand.set(message);
            (message.action === 'GET_EVENTS' ? getEvents : scanPrematch)(message.data)
                .then(() => bsDebug(port, "It's looks like " + message.action + " done!"))
                .catch((e) => bsError(port, 'Error till ' + message.action + ': ' + e))
                .then(async () => {
                    busy = false;
                    ourCommand.clear();
                    await delayPromise(3000);
                    if (!busy && !ourCommand.isSet()) {
                        port.postMessage({
                            m: "CLOSE_ME",
                        })
                    } else {
                        bsError(port, `We can't send CLOSE_ME ${busy}/${ourCommand.isSet()}`);
                    }
                });
        }
    };

    const scanPrematch = async data => {
        stopScanPrematch = false;
        await clickSequence([
            new QueueObject('a[href="/en/all-events.htm"]', $el => !$el.parent().hasClass('selected')),
            new QueueObject('span.button.btn-clear'),
            new QueueObject('#top-sport-1'),
            new QueueObject('#period-group-select', null, async $el => await selectLikePuppeteer($el[0], ['12']), true),
            new QueueObject('span.button:textEquals("Show selections")'),
        ]);
        await waitForElement('div.bg.coupon-row', 300, 30000, false, 1, 'Tennis events');
        while (!stopScanPrematch) {
            await scanPrematchDo().catch(e => console.log('%c' + e, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'));
            await delayPromise(60000);
        }
    };

    const scanPrematchDo = async () => {
        await $('div.bg.coupon-row').eachAsync(async function () {
            const $this = $(this);
            const openCloseDetails = async text => {
                if (text) {
                    console.log('%c' + text, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                }
                await mouseChain({
                    target: $this.find('span.event-more-view')[0],
                    events: fullClick,
                    error: 'event-more-view',
                    scroll: true,
                    scrollTop: true,
                });
                return true;
            };
            const $coefficients = [0, 1].map(i => parseFloat($this.find('span.selection-link').eq(i).text().trim()));
            if (!$coefficients.every(c => c >= 1.76 && c <= 2.3)) {
                return;
            }
            const names = [0, 1].map(i => $this.find('a.member-link').eq(i).text().replace(/\s+/g, ' ').trim());
            const name = names.join(' vs ');
            const date = $this.find('td.date').text().trim();
            const tournament = $this.closest('div.category-content').prev().find('h2.category-label').text().trim();
            const isWomen = tournament.indexOf('Women') > -1;
            console.log(`That's it: ${$coefficients.join(' ')} in ${name}`);
            console.log(isWomen, tournament);
            await openCloseDetails();
            const $details = await waitForElement(() => $this.find('div[class^="market-details-"]'),
                300, 5000, false, 1, 'details').catch(() => $([]));
            if ($details.length === 0) {
                return openCloseDetails(`No details for ${name}`);
            }
            const detailsSel = `div[data-market-details="${$details.data('market-details')}"]`;
            const $tm = await waitForElement(() => $(detailsSel).find('td:contains("Total Markets"):visible'),
                300, 5000, false, 1, 'total markets').catch(() => $([]));
            if ($tm.length === 0) {
                return openCloseDetails(`No total markets for ${name}`);
            }
            await mouseChain({
                target: $tm[0],
                events: fullClick,
                error: 'Total Markets',
                scroll: true,
                scrollTop: true
            });
            const $ts = await waitForElement(() => $(detailsSel).find('div.name-field:textEquals("Total Sets")'),
                300, 5000, false, 1, 'No total sets').catch(() => $([]));
            if ($ts.length === 0) {
                return openCloseDetails(`No total Sets for ${name}`);
            }
            const $pivots = $ts.closest('div.market-inline-block-table-wrapper').find('div.coeff-handicap:textEquals("(2.5)")');
            if ($pivots.length !== 2) {
                return openCloseDetails(`No pivot for ${name}`);
            }
            const coef = parseFloat($pivots.last().parent().find('div.coeff-price').text().trim());
            if (isNaN(coef) || coef <= (isWomen ? 2.7 : 2.65)) {
                return openCloseDetails(`Bad coef ${coef} (${(isWomen ? 'Women' : 'Men')}) for ${name}`);
            }
            console.log('%c' + `!!! LET'S BET AT ${name} with ${coef} !!!`, 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            await sendBetToServer({
                team1: names[0],
                team2: names[1],
                coefficient: coef,
                league: tournament,
                // TODO: Insert correct date!
                date: correctDate(date),
            });
        });
    };

    const correctDate = date => {
        // 25.01.20, 23:17 (GMT)
        const siteNow = $('#timer').text().trim();
        const siteOffsetDraft = siteNow.match(/\(([\w\d+-]+)\)/);
        if (!siteOffsetDraft || !siteOffsetDraft[1]) {
            throw `Bad site timezone ${siteNow}!`;
        }
        const offset = parseInt(['+', '-'].some(s => siteOffsetDraft[1].indexOf(s) > -1) ? siteOffsetDraft[1].replace(/[^\d-]/g, '') : '0');
        const parts = siteNow.substr(0, 8).split('.');

        const d = new Date(parseInt(`20${parts[2]}`), parseInt(parts[1]), parseInt(parts[0]));

        if (/\d{2} \w{3} \d{2}:\d{2}/.test(date)) {
            // Hint: tomorrow's event
        }
    };

    const sendBetToServer = bet => new Promise((onSuccess, onReject) => {
        bet.sport = 'TENNIS';
        bet.type = 'PREMATCH';
        bet.time_value = 'FULL_TIME';
        bet.market = 'TOTAL';
        bet.target = 'OVER';
        bet.pivot = '2.5';
        const url = 'http://double.bcp.bet';
        const sampleData = {
            "source": "MARATHON_TENNIS",
            "do_not_check": true,
            "bk": "MARATHON",
            "stake": 1000,
            "expiration": Math.floor(Date.now() / 1000) + 120, // 2 minutes
            "data": [bet]
        };
        console.log(sampleData);
        onSuccess('test');
        /*
        $.ajax({
            type: "POST",
            url: url,
            dataType: 'json',
            contentType: "application/json; charset=utf-8",
            //username: self.s[loginName],
            //password: self.s[passwordName],
            data: JSON.stringify(sampleData),
            success: function (d) {
                onSuccess(d);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.error('API send:');
                console.log(jqXHR, textStatus, errorThrown);
                onReject(errorThrown);
            }
        });
        */
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
    const getEvents = async inputData => {
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

    /**
     * Real get events / leagues
     * @param {SportEventObject} data
     * @returns {Promise<{leagues: Object, events: Object}>}
     */
    const getEventsDo = async data => {
        bsDebug(port, `GET_EVENTS:`, data);
        const {leaguesProcessed, leagues, events, errors} = getEventsLoadSaved();
        await goToPrematch();
        if (!data.sport || data.sport === 'ALL' || !data.league || data.league.length === 0 || data.league === 'ALL') {
            await scrapLeagues(data, leagues);
            bsDebug(port, 'Got leagues:', leagues);
        } else {
            await goPrematchSport(sportAccordance[data.sport]);
            await delayPromise(2000);
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
                events[data.sport][currentLeague] = JSON.parse(JSON.stringify(await prematchGetEvents(data.sport, currentLeague)));
                bsDebug(port, `Events for ${data.sport}/${currentLeague}`, events[data.sport][currentLeague]);
                leaguesProcessed.push(`${data.sport}:${currentLeague}`);
                getEventsSave(leaguesProcessed, leagues, events, errors);
                if (leaguesToGet.length > 1) {
                    await delayPromise(getRandomRounded(2000, 3000));
                }
            }
        }
        return {leagues, events, errors};
    };

    const prematchGetEvents = async (sportOur, league) => {
        const events = [];
        const $league = $getPrematchSportContainer(sportAccordance[sportOur]).find('h2.category-label').filter(function () {
            return $(this).text().trim() === league;
        });
        if ($league.length > 0) {
            const league = `#${$league.closest('div.category-container').attr('id')}`;
            if ($(league).hasClass('collapsed')) {
                await mouseChain({
                    target: $(league).find('table.category-header td.collapse-button')[0],
                    events: fullClick, error: 'collapsed', scroll: true
                });
                await delayPromise(2500);
            } else {
                $(league).get(0).scrollIntoView();
            }
            // Get list of matches
            $(league).find('table[class="coupon-row-item"]').each(function () {
                const $members = $(this).find('table.member-area-content-table').find('a.member-link');
                events.push($members.eq(0).text().trim() + ' v ' + $members.eq(1).text().trim());
            });
        }
        return events;
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

    const getLeaguesToGet = (data, leagues) => data.sport && data.sport !== 'ALL' && data.league === 'ALL' && leagues[data.sport].length > 0
        ? leagues[data.sport]
        : data.sport && data.sport !== 'ALL' && data.league.length > 0 ? [data.league] : [];

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

    const register = function (data) {
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
            let waitForConfirmUrl = function (timeout, maxWait) {
                let max = typeof maxWait === 'number' ? maxWait : 180000;
                return new Promise(function (onSuccess, onReject) {
                    let waitStarted = Date.now();
                    let performCheck = function () {
                        bsEmailCheck(data.email, 'MARATHON_CONFIRM_LINK', timeout)
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
                if (ourCommand.getAdded('goToLink') !== false) {
                    // Warning: This code never executes!
                    // Hint: Cuz we are not on right domain after confirm link
                    waitForElement('h2:contains("welcome to Marathonbet")', 333, 60000)
                        .then(() => report(true, {login: data['nickname'], password: data['password']}))
                        .catch((e) => report(false, 'Four: ' + e));
                } else if (ourCommand.getAdded('waitForEmail') !== false) {
                    waitForConfirmUrl(ourCommand.getAdded('waitForEmail'))
                        .then((link) => {
                            bsDebug(port, 'We go to confirm link: ' + link);
                            ourCommand.add('goToLink', link);
                        })
                        .then(delayFunction(3333))
                        .then(() => report(true, {login: data['nickname'], password: data['password']}))
                        .then(() => {
                            document.location.href = ourCommand.getAdded('goToLink');
                        })
                        .then(delayFunction(3333))
                        .catch((e) => report(false, 'Three: ' + e));
                } else if (document.location.href.indexOf('/en/join.htm') > -1) {
                    // YYYY/MM/DD
                    let bdParts = data['birth_date'].split('/');
                    //let bDate = new Date(parseInt(bdParts[0]), parseInt(bdParts[1]) - 1, parseInt(bdParts[2]));
                    // DD/MM/YYYY
                    let bDate = [bdParts[2], bdParts[1], bdParts[0]].join('/');
                    bsDebug(port, 'Fill form with (birth - ' + bDate + '):', data);
                    (async () => {
                        const $el = await waitForElement('#form_country', 333, 10000);
                        await delayPromise(3000);
                        $el.find('option[value="178"]').prop('selected', true);
                        fireChangeEvent($el[0]);
                        const enters = {
                            '#form_firstname': 'first_name',
                            '#form_surname': 'second_name',
                            '#birthdayTxt': bDate,
                            '#form_town': 'city',
                            '#form_postcode': 'postal_code',
                            '#form_address1': 'address',
                            '#form_maskedPhone': 'phone',
                            '#form_nickname': 'nickname',
                            '#form_aemail': 'email',
                            '#form_password': 'password',
                            '#form_confirmpassword': 'password',
                        };
                        for (const selector of Object.keys(enters)) {
                            await delayPromise(getRandomRounded(2500, 3500));
                            await clearAndSimulate($(selector)[0], data[enters[selector]]);
                        }
                        await delayPromise(3000);
                        const $ccsec = $('#form_ccsecquestions');
                        $ccsec.find('option[value="1"]').prop('selected', true);
                        fireInputEvent($ccsec[0]);
                        fireChangeEvent($ccsec[0]);
                        await delayPromise(3000);
                        await clearAndSimulate($('#form_ccsanswer')[0], data['mothers_maiden_name'], true, true, true);
                        await delayPromise(3000);
                        await mouseChain({target: $('#form_agreement')[0], events: ['click'], scroll: true});
                        ourCommand.add('waitForEmail', Math.ceil(Date.now() / 1000));
                        await delayPromise(3000);
                        await mouseChain({target: $('#form_joinSubmit')[0], events: ['click'], scroll: true});
                        await delayPromise(1000);
                        let $errors = $('label.error:visible');
                        if ($errors.length > 0) {
                            throw 'Form errors: ' + $errors.text().trim();
                        }
                        const $join = await waitForElement('#form_joinConfirm', 333, 10000);
                        await delayPromise(2000);
                        await mouseChain({target: $join[0], events: ['click'], scroll: true});
                        await delayPromise(3000);
                    })()
                        .then(regoroll)
                        .catch(e => report(false, 'Two: ' + e));
                } else {
                    waitForElement('div.join a', 333, 10000)
                        .then($el => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(3333))
                        .catch((e) => report(false, 'One: ' + e));
                }
            };
            //delayPromise(7777).then(() => report(true, {login: data['nickname'], password: data['password']}))
            delayPromise(1111).then(regoroll);
        });
    };

    const checkPayments = function () {
        // VERSION_123
        return new Promise(function (onSuccess, onReject) {
            let collected = ourCommand.getAdded('collected') === false ? [] : ourCommand.getAdded('collected');
            bsDebug(port, 'checkPayments! ' + collected.length);
            let report = function (success, message) {
                bsDebug(port, 'Report! ' + success + ' / ' + message);
                port.postMessage({
                    answered: "CHECK_PAYMENTS",
                    data: success ? ourCommand.getAdded('collected') : [],
                    answer: message
                });
                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                }
            };
            let clickNwait = function ($el) {
                mouseChain({target: $el[0], events: ['click'], scroll: true})
                    .then(delayFunction(3333))
                    .then(letsRockNRoll)
                    .catch((e) => report(false, 'clickNwait: ' + e));
            };
            let letsRockNRoll = function () {
                bsDebug(port, 'letsRockNRoll');
                let collectCurrent = function () {
                    return waitForElement('#response', 333, 15000)
                        .then(($el) => {
                            //bsDebug(port, 'Before collect!: ' + JSON.stringify(collected));
                            $el.find('tr.row').each(function () {
                                let $tds = $(this).find('td');
                                let desc = $tds.eq(1).text().trim().toLowerCase();
                                collected.push({
                                    date: $tds.eq(0).text().trim(),
                                    description: $tds.eq(1).text().trim(),
                                    type: desc.indexOf('withdrawal') > -1 ? 'OUT' : (desc.indexOf('deposit') > -1 ? 'IN' : ''),
                                    paysystem: desc.indexOf('qiwi') > -1 ? 'QIWI' : (desc.indexOf('skrill') > -1 ? 'SKRILL' : ''),
                                    amount: $tds.eq(2).text().replace(/[^\d.]/g, '').trim(),
                                    success: true
                                });
                            });
                            ourCommand.add('collected', collected);
                            //bsDebug(port, 'collectCurrent, at moment: ' + JSON.stringify(collected));
                        })
                        .then(delayFunction(3333));
                };
                let selectNeeded = function (needed) {
                    waitForElement('#form_txoperation', 333, 15000)
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => {
                            $el.find('option[value="' + needed + '"]').prop('selected', true);
                            ourCommand.add(needed + '_selected', true);
                        })
                        .then(delayFunction(3333))
                        .then(() => mouseChain({target: $('#form_submit')[0], events: ['click']}))
                        .catch((e) => report(false, 'Select needed: ' + e));
                };
                if (document.location.href.indexOf('myaccount/accounthistory.htm') > -1) {
                    if (ourCommand.getAdded('DEPOSIT_selected') && !ourCommand.getAdded('WITHDRAW_selected')) {
                        bsDebug(port, 'Collecting deposits...');
                        delayPromise(1111)
                            .then(() => collectCurrent())
                            .then(() => selectNeeded('WITHDRAW'))
                            .catch((e) => report(false, 'DEPOSIT collect: ' + e));
                    } else if (ourCommand.getAdded('WITHDRAW_selected')) {
                        bsDebug(port, 'Collecting withdrawals...');
                        delayPromise(1111)
                            .then(() => collectCurrent())
                            .then(() => report(true, 'It must be good!'))
                            .catch((e) => report(false, 'WITHDRAW collect: ' + e));
                    } else {
                        bsDebug(port, 'Switching...');
                        selectNeeded('DEPOSIT');
                    }
                } else if (document.location.href.indexOf('myaccount/myaccount.htm') > -1) {
                    clickNwait($('a[href="/en/myaccount/accounthistory.htm"]'))
                } else {
                    clickNwait($('a.button[href="/en/myaccount/myaccount.htm"]'));
                }
            };
            letsRockNRoll();
        });
    };

    const withdraw = function (data) {
        bsDebug(port, 'Withdraw!', data);
        return new Promise(function (onSuccess, onReject) {
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
            };
            let pD = {
                'QIWI': {
                    go: 'a[href^="/en/withdraw.htm?type=qiwi"]',
                    page: 'withdraw.htm?type=qiwi'
                },
                'SKRILL': {
                    go: 'a[href^="/en/withdraw.htm?type=moneyBookers"]',
                    page: 'withdraw.htm?type=moneyBookers'
                }
            };
            let p = pD[data.paysystem];
            let letsRockNRoll = function () {
                bsDebug(port, 'letsRockNRoll');
                if (ourCommand.getAdded('enteredWithdraw') !== false) {
                    report(true, 'It may be okay...');
                } else if (document.location.href.indexOf(p.page) > -1) {
                    waitForElement('#form_amount', 333, 15000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(777))
                        .then(() => clearInputElement({
                            string: data.amount,
                            element: $('#form_amount')[0],
                            long: true,
                            fireChange: true,
                            fireInput: true
                        }))
                        .then(emulateKeyboardLikeHuman)
                        .then(delayFunction(3333))
                        .then(() => clearInputElement({
                            string: settings.password,
                            element: $('#form_check_password')[0],
                            long: true,
                            fireChange: true,
                            fireInput: true
                        }))
                        .then(emulateKeyboardLikeHuman)
                        .then(delayFunction(3333))
                        .then(() => {
                            ourCommand.add('enteredWithdraw', true);
                        })
                        .then(() => mouseChain({target: $('#form_dummy')[0], events: ['click']}))
                        .then(delayFunction(7777))
                        .then(letsRockNRoll)
                        .catch((e) => report(false, data.paysystem + ' enter data: ' + e));
                } else if (document.location.href.indexOf('withdraw.htm') > -1) {
                    waitForElement(p.go, 333, 15000, true)
                        .then(($el) => mouseChain({target: $el.last()[0], events: ['click']}))
                        .then(delayFunction(3333))
                        .then(letsRockNRoll)
                        .catch((e) => report(false, 'clickNwait: ' + e));
                } else {
                    waitForElement('div.menu-link:contains("Services")', 333, 15000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(waitForElementF('a.ur-link[href="/en/withdraw.htm"]', 333, 3333))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(3333))
                        .then(letsRockNRoll)
                        .catch((e) => 'Go to wd: ' + e);
                }
            };
            letsRockNRoll();
        });
    };

    const deposit = data => (isCupis ? depositCupis : depositOffshore)(data);

    const depositCupis = data => new Promise((onSuccess, onReject) => {
        const report = (success, message, wallet_balance) => {
            ourCommand.add('increaseDelay', false);
            ourCommand.add('qiwiEntered', false);
            dLog('green', 'Mara', `Report! ${success} / ${message}`);
            port.postMessage({
                answered: "DEPOSIT",
                status: success ? 'SUCCESS' : ['NO_FUNDS', 'RESTRICTED'].find(t => message.indexOf(t) > -1) || 'FAILED',
                answer: message,
                balance: getBalance(),
                wallet_balance: wallet_balance || '',
            });
            success ? onSuccess(message) : onReject(message);
        };
        depositCupisDo(data)
            .then(m => report(m.success, m.message || 'No message!', m.balance || ''))
            .catch(e => report(false, `depositDo: ${e}, ${formatStack(e.stack)}`));
    });

    const depositCupisDo = async data => {
        await delayPromise(1000);
        if (ourCommand.getAdded('formFilled')) {
            waitForElement('#punterMessage button', 300, 15000)
                .then($el => mouseChain({target: $($el)[0], events: fullClick, error: 'pmb'}))
                .catch(() => dLog('color: darkgray', 'Mara', 'No OK button after deposit :('));
            return await bMess('DEPOSIT_RESULT', true).get(120000);
        } else if (window.location.href.indexOf('deposit.htm?type=cupisQiwi') > -1) {
            await clearAndSimulate($('#form_amount')[0], data.amount);
            ourCommand.add('closeMara', true);
            await bMess('QIWI_COMMAND', true).set(ourCommand.get());
            await mouseChain({target: $('#form_dummy')[0], events: fullClick, error: 'form_dummy'});
            const $ok = await waitForElement('button[type="submit"]:textEquals("OK"):visible', 300, 15000);
            ourCommand.add('formFilled', true);
            ourCommand.add('increaseDelay', true);
            await mouseChain({target: $ok[0], events: fullClick, error: '$ok'});
        } else if (window.location.href.indexOf('deposit.htm') > -1) {
            await mouseChain({
                target: $('a.button[href*="cupisQiwi"]')[0],
                events: fullClick,
                error: 'qiwi',
                scroll: true,
            });
        } else {
            await mouseChain({
                target: $('a.green[href="/su/deposit.htm"]:visible')[0],
                events: fullClick,
                error: 'a'
            });
        }
        // Hint: here we should go to the another page
        await delayPromise(100000);
    };

    const depositOffshore = function (data) {
        bsDebug(port, 'Deposit!', data);
        return new Promise(function (onSuccess, onReject) {
            let report = function (success, message, wallet_balance) {
                ourCommand.add('increaseDelay', false);
                ourCommand.add('qiwiEntered', false);
                bsDebug(port, 'Report! ' + success + ' / ' + message);
                port.postMessage({
                    answered: "DEPOSIT",
                    status: success ? 'SUCCESS' : ['NO_FUNDS', 'RESTRICTED'].find(t => message.indexOf(t) > -1) || 'FAILED',
                    answer: message,
                    balance: getBalance(),
                    wallet_balance: wallet_balance || '',
                });
                if (success) {
                    onSuccess(message);
                } else {
                    onReject(message);
                }
            };
            let clickNwait = function ($el) {
                mouseChain({target: $el[0], events: ['click'], scroll: true})
                    .then(delayFunction(3333))
                    .then(letsRockNRoll)
                    .catch((e) => report(false, 'clickNwait: ' + e));
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
            let pD = {
                'QIWI': {
                    entered: 'qiwiEntered',
                    go: 'a.button[href^="/en/deposit.htm?type=qiwi"]',
                    page: 'deposit.htm?type=qiwi',
                    setF: function () {
                        chrome.storage.local.set({
                            'QIWI_COMMAND': ourCommand.get(),
                            'QIWI_COMMAND_WAS_SET': Date.now()
                        });
                    },
                    checkFirst: '#form_qiwi_mobile_phone:visible'
                },
                'SKRILL': {
                    entered: 'skrillEntered',
                    go: 'a.button[href^="/en/deposit.htm?type=moneyBookers"]',
                    page: 'deposit.htm?type=moneyBookers',
                    setF: function () {
                        chrome.storage.local.set({
                            'SKRILL_COMMAND': ourCommand.get(),
                            'SKRILL_COMMAND_WAS_SET': Date.now()
                        });
                    },
                    checkFirst: '#form_email_purse:visible'
                }
            };
            let p = pD[data.paysystem];
            let letsRockNRoll = function () {
                bsDebug(port, 'letsRockNRoll');
                if (ourCommand.getAdded(p.entered) !== false) {
                    //bsDebug(port, 'Started wait for deposit result...', [], 'COLOR:yellow,red');
                    waitForCondition(() => {
                        getDepositResult();
                        return typeof depositResult.success === 'boolean';
                    }, 1000, 120000, 'no deposit result (or it is outdated) for 120s!')
                        .then(() => {
                            //bsDebug(port, 'getDepositResult', depositResult, 'COLOR:yellow,red');
                            if (typeof depositResult.success === 'boolean') {
                                if (data.paysystem === 'SKRILL') {
                                    chrome.storage.local.remove(['SKRILL_COMMAND', 'SKRILL_COMMAND_WAS_SET']);
                                }
                                report(depositResult.success, depositResult.message || 'No message :(', depositResult.balance || '');
                            }
                        })
                        .catch((e) => report(false, 'preFinal: ' + e));
                } else if (document.location.href.indexOf(p.page) > -1) {
                    waitForElement('#form_amount', 333, 15000)
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(777))
                        .then(() => clearInputElement({
                            string: data.amount,
                            element: $('#form_amount')[0],
                            long: true,
                            fireChange: true,
                            fireInput: true
                        }))
                        .then(emulateKeyboardLikeHuman)
                        .then(delayFunction(3333))
                        .then(() => {
                            if ($(p.checkFirst).length > 0) {
                                return clearInputElement({
                                    string: data.login.replace('+', '').replace(/^7/, ''),
                                    element: $(p.checkFirst)[0],
                                    long: true,
                                    fireChange: true,
                                    fireInput: true
                                }).then(emulateKeyboardLikeHuman);
                            } else {
                                let $checkPassword = $('#form_check_password:visible');
                                if ($checkPassword.length === 1) {
                                    return clearInputElement({
                                        string: settings.password,
                                        element: $('#form_check_password')[0],
                                        long: true,
                                        fireChange: true,
                                        fireInput: true
                                    }).then(emulateKeyboardLikeHuman);
                                }
                            }
                        })
                        .then(delayFunction(3333))
                        .then(() => {
                            ourCommand.add('increaseDelay', true);
                            ourCommand.add(p.entered, true);
                            chrome.storage.local.remove(['DEPOSIT_RESULT', 'DEPOSIT_RESULT_WAS_SET'], function () {
                                p.setF();
                            });
                        })
                        .then(() => mouseChain({target: $('#form_dummy')[0], events: ['click']}))
                        .then(delayFunction(3333))
                        //.then(() => report(true, 'Temporary Ok...'))
                        .catch((e) => report(false, data.paysystem + ' enter data: ' + e));
                } else if (document.location.href.indexOf('deposit.htm') > -1) {
                    clickNwait($(p.go));
                } else {
                    clickNwait($('a.green[href="/en/deposit.htm"]'));
                }
            };
            letsRockNRoll();
        });
    };

    const collectData = function (data) {
        (async () => {
            let limit = 0;
            if (data.length === 2 && data[0] === 'limit') {
                limit = parseInt(data[1]);
                data = [];
            }
            console.log('%c collectInfo, limit: ' + limit, 'background: green; color: white;');
            console.log(data);
            let current = 0, collected = 0, currentID = '', realID = '', collectRowStarted = 0;
            const result = async (status, message) => {
                if (status) {
                    let $next = isCupis === true ? $('div#historyPager a:textEquals("Следующая")') : $('a:contains("Next")');
                    if (!nextWasClicked && $next.length > 0) {
                        ourCommand.add('results', betResults);
                        await mouseChain({target: $next[0], events: ['click'], scroll: true, error: 'Next click error'});
                        bsDebug(port, 'Go next page!');
                    }
                }
                port.postMessage({
                    answered: "BET_RESULT",
                    status: status ? "success" : "error",
                    answer: status ? betResults : message
                });
                busy = false;
                ourCommand.clear();
                await goToLive();
                console.log('We on live!');
            };
            const collectRow = async () => {
                if (currentID !== '' && $(`#place_BET_${currentID}`).is(':visible')) {
                    let $placeBet = $('#place_BET_' + currentID);
                    let $contBet = $('#container_BET_' + currentID);
                    let status = 'ACCEPTED';
                    let bkPivot = $contBet.find('td.bet-title').text().trim();
                    let match = $placeBet.find('span.sblue').text().trim();
                    let ourResult = $contBet.find('td.result').text().trim().replace(/[^\d.]/g, '').trim();
                    let coef = $contBet.find('td.coefficient').text().trim().replace(/[^\d'.]/g, '').trim();
                    let stake = $contBet.find('td.total-stake').text().trim().replace(/[^\d.]/g, '').trim();
                    let html = $contBet.find('td.open-bet').html();
                    const iconSrc = $contBet.find('td.open-bet img').attr('src');
                    dLog('green', 'Mara', `${realID} = '${iconSrc}' (${ourResult}/${stake})`);
                    if (iconSrc.indexOf('bet-status-lose-icon.png') > -1) {
                        status = 'LOSE';
                    } else if (iconSrc.indexOf('bet-status-win-icon.png') > -1) {
                        let betResult = parseFloat(ourResult);
                        let betStake = parseFloat(stake);
                        status = betResult > betStake ? 'WON' : betResult === betStake ? 'REFUNDED' : 'ACCEPTED';
                    }
                    if (bkPivot === 'Double') {
                        match = $placeBet.find('span.sblue').first().text().trim();
                        bkPivot = $placeBet.find('tr.selection-row span.normal:last-child').text().trim();
                    }
                    if (ourResult === 'nsettled') {
                        ourResult = '0';
                    }
                    collected++;
                    betResults.push({external_id: realID, status, bkPivot, coef, stake, result: ourResult, match});
                    if (limit === 0 || collected < limit) {
                        await delayPromise(300)
                        await openRow();
                    } else {
                        console.log('result point 1');
                        await result(true);
                    }
                } else if (Date.now() - collectRowStarted < 30000) {
                    await delayPromise(100)
                    await collectRow();
                } else {
                    await result(false, 'Results not shown during ' + (Date.now() - collectRowStarted) + 'ms');
                }
            };
            const openRow = async () => {
                let $rows = await waitForElement('tr.row.history-result-main', 333, 10000);
                if (current < $rows.length) {
                    let eventId = $rows.eq(current).attr('id').replace('container_BET_', '');
                    const id = $rows.eq(current).find('td.bet-number').text().trim();
                    if ((data.length > 0 && id !== '' && data.indexOf(id) > -1)
                        || (data.length === 0)) {
                        let $link = $rows.eq(current).find('td.bet-title');
                        if ($link.length === 1) {
                            $link[0].scrollIntoView(true);
                            await mouseChain({target: $link[0], events: ['click'], error: '$link'});
                            await delayPromise(500);
                            current++;
                            currentID = eventId;
                            realID = id;
                            collectRowStarted = Date.now();
                            await collectRow();
                        }
                    } else {
                        console.log('Not need: ' + eventId);
                        current++;
                        await openRow();
                    }
                } else {
                    console.log('result point 2');
                    await result(true);
                }
            };
            await openRow();
        })()
            .catch(e => dLog('red', 'Mara', `collectData: ${e}`));
    };

    const checkBalance = willPlace => {
        const balance = getBalance();
        if (isNaN(balance)) {
            throw 'Get balance error';
        } else if (balance < willPlace) {
            throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
        } else if (typeof willPlace === 'undefined') {
            throw 'Undefined willplace';
        }
    };

    const proceedBet = async data => {
        currentBetData = {
            data: data,
            max: 0
        };
        const sendReport = (success, message) => {
            const status = success ? 'ACCEPTED'
                : ['LOW_COEF', 'NO_FUNDS', 'SCORE_CHANGED', 'LIMITED'].find(t => message.indexOf(t) > -1) || 'FAILED';
            const report = {
                "external_id": success ? message.number : '',
                "status": status,
                "pivot": currentBetData.data[0].pivot,
                "bkPivot": success ? message.typeStake : '',
                "coef": success ? message.coef : currentBetData.data[0].coef,
                "stake": success ? message.amount : currentBetData.data[0].stake,
                "maximum": currentBetData.max,
                "market": currentBetData.data[0].market,
                "target": currentBetData.data[0].target
            };

            if (success) {
                await eventsWorkAll('Marathonbet',
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
                fBetResult.bookmaker = 'MARATHON.CUPIS';
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

            port.postMessage({
                answered: !!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED'
                    ? "F_BET" : "BET",
                data: !!currentBetData.data[0].betFromParser ? fBetResult : resultData,
                answer: success ? 'Everything is Okay!' : message,
                doNotSend,
            });
            
            busy = false;
            ourCommand.clear();
        };
        if (limited) {
            sendReport(false, 'Bk is LIMITED - upload docs!');
        } else {
            let error = '';

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
                const checkRes = await eventsWorkAll('Marathonbet',
                    settings.eventMaxBets, settings.eventTimeLimit,
                    currentBetData.data, false, true);
                if (checkRes !== 'OK') {
                    dLog('red', 'MARATHON.CUPIS', `We got errors: ${checkRes}`);
                    throw checkRes;
                } else {
                    dLog('big-blue', 'MARATHON.CUPIS',
                        `We'll do bet because of and wasSuccessStake ${successDiff} > ${realSuccessInterval} and`);
                    for (const d of currentBetData.data) {
                        const eventName = `${d.team1} - ${d.team2}`;
                        dLog('blue', 'MARATHON.CUPIS', `${settings.eventMaxBets} for ${eventName} not reached`);
                    }
                }
            }

            const m = await proceedBetWork(data)
                .catch(e => error = `proceedBetWork: ${e}, ${formatStack(e.stack)}`);

            dLog(!error ? 'green' : 'red', 'Mara', `proceedBetWork: ${(error || m)}`);
            sendReport(!error, error || m);
        }
    };

    const proceedBetWork = async data => {
        const checkStake = async () => {
            const checks = {
                'agree': '#betslip_apply_choices_block:visible',
                /*'changed': '#place-changed-terms:visible',*/
                'apply': '#betslip_apply_choices:visible'
            };
            if (Object.values(checks).some(s => $(s).length > 0)) {
                const newCoef = parseFloat($('div.bet-slip-open')
                    .find('td.choice-price span:first-child').trt());
                if (!isNaN(newCoef) && newCoef >= parseFloat(data[0].coef)) {
                    dLog('green', 'Mara', `We will try to bet with new coef: ${newCoef}`);
                    if ($(checks.changed).length > 0) {
                        await mouseChain({target: $(checks.changed)[0], events: fullClick, error: 'changed'});
                        await delayPromise(1000);
                        return true;
                    } else if ($(checks.apply).length > 0) {
                        await mouseChain({target: $(checks.apply)[0], events: fullClick, error: 'apply'});
                        await delayPromise(1000);
                        return true;
                    }
                } else {
                    const $cancelButton = $('#cancel-button:visible');
                    if ($cancelButton.length > 0) {
                        await mouseChain({target: $cancelButton[0], events: fullClick, error: 'cancel'});
                    }
                    throw `LOW_COEF ${newCoef}`;
                }
                return false;
            } else {
                return true;
            }
        };
        const enterAndPlace = async willPlace => {
            const pbSel = '#betslip_placebet_btn_id';
            do {
                if (isNaN(willPlace) || willPlace <= 0) {
                    throw `Tried to bet with '${willPlace}'`;
                }
                const $input = $('td.stake input');
                if ($input.length !== 1) {
                    throw 'There is no input for stake!'
                }
                await clearAndSimulate($input[0], willPlace.toString().replace('.00', '').trim());
                await delayPromise(300);
            } while (!await checkStake());
            await delayPromise(400);
            dLog('orange', 'Mara', `Stake entered, let's place it!`);
            if ($(pbSel).length !== 1 || $(pbSel).hasClass('btn-place-bet-disabled')) {
                throw 'PlaceBtn does not exists or disabled!';
            }
            await mouseChain({target: $(pbSel)[0], events: fullClick, errors: 'placeBtn'});
        };
        const waitForBetPlaced = async () => {
            const checks = {
                ok: '#ok-button:visible',
                agree: '#betslip_apply_choices_block:visible',
                apply: '#betslip_apply_choices:visible',
                cancel: '#cancel-button:visible',
                changed: '#place-changed-terms:visible',
            };
            const waitStarted = Date.now();
            while ($(checks.ok).length === 0 && Date.now() - waitStarted < settings.maxWaitForBetStatus) {
                bsDebug(port, "Wait status...", Object.keys(checks).map(s => `${s}: ${$(checks[s]).length}`).join(', '));
                if (!await checkStake()) {
                    return false;
                }
                await delayPromise(750);
            }
            if ($(checks.ok).length === 0) {
                throw 'Wait time exceeded: ' + (Date.now() - waitStarted) + ' > ' + settings.maxWaitForBetStatus;
            }
            await mouseChain({target: $(checks.ok)[0], events: ['click']}).catch(e => console.log(e));
            if ($('#detail-result-content').text().trim().indexOf('Live bets are not available') > -1) {
                throw 'LIMITED!';
            } else {
                await delayFunction(1000);
                return true;
            }
        };
        const openBetsList = 'div.open-bets-container div.open-bet-wrapper';
        const checkStatus = async () => {
            let openBets = '#header_open_bets';
            while (!$(openBets).hasClass('active')) {
                await mouseChain({target: $(openBets)[0], events: fullClick, error: 'openBets'});
                await delayPromise(1000);
            }
            if ($(openBetsList).length === 0) {
                throw "There is no open bets in list!";
            }
            if ($(openBetsList).eq(0).find('div.open-bet-details:visible').length === 0) {
                let $a = $(openBetsList).eq(0).find('div.header-info');
                dLog('green', 'Mara', `We opening Open Bet unsettled ${$a.length}`);
                if ($a.length > 0) {
                    await mouseChain({target: $a[0], events: fullClick, error: 'openBetsList->A'});
                    await delayPromise(1000);
                } else {
                    throw "Could not find link";
                }
            }
            const eventSeparator = isCupis ? data[0].sport === 'BASKETBALL' ? '@' : '-' : 'vs';
            const getAndCheckEvents = () => {
                const $coupon = $(openBetsList).eq(0).find('div.open-bet-details');
                const events = [];
                $coupon.find('div.open-bet-selection__event-name').each(function () {
                    events.push($(this).text().trim().toLowerCase());
                });
                dLog('blue', 'getAndCheckEvents', ['events:', events, events.length === data.length]);
                return events.length === data.length
                    && events.every(evt =>
                        data.some(d => compareVariants(evt,
                            getEventVariants(d, eventSeparator), 80, false)));
            };
            dLog('blue', 'Mara', [
                `Let's check event (${$(openBetsList).eq(0)
                    .find('div.open-bet-details div.event-name').text().trim().toLowerCase()}):`,
                getEventVariants(data[0], eventSeparator)
            ]);
            await waitForCondition(getAndCheckEvents, 200, 30000, 'Wrong open bet!');
        };
        const closeIcon = async () => {
            const $close = $(openBetsList).eq(0).find('div.ico-remove');
            if ($close.length === 1) {
                await mouseChain({target: $close[0], events: fullClick})
                    .catch(e => console.log('%cWARNING! We not close open bet!!! ' + e, 'background-color: red; color: white; font-weight: bold;'));
            }
        };
        const collectOpenBet = async () => {
            await waitForCondition(() => $(openBetsList).eq(0)
                    .find('div.open-bet-details').length > 0,
                300, 20000, 'collectOpenBet 1');
            const $coupon = $(openBetsList).eq(0).find('div.open-bet-details');
            const id = $coupon.closest('div.open-bet-wrapper')
                .find('div.header-info').text().trim();
            const idRes = /#(\d+)./.exec(id);
            const result = {
                typeStake: $coupon.closest('div.open-bet-wrapper').find('div.header-info').find('span').eq(0).text().trim()
                    .split(':')[1].trim().replace(/\.$/gm, ''),
                coef: $coupon.find('div.open-bet-details-summary__row').eq(1).find('b').eq(0).text().trim()
                    .replace('Price: ', '').replace('Коэфф.: ', ''),
                amount: $coupon.find('div.open-bet-details-summary__row').eq(0).find('b').eq(0).text().replace(/[^\d.]/g, '').trim(),
                number: idRes && idRes[1] ? idRes[1] : '',
            };
            await closeIcon();
            return result;
        };
        const max = await getMax(data);
        currentBetData.max = max;
        let willPlace = max < parseFloat(data[0].stake) ? max : parseFloat(data[0].stake);
        dLog('green', 'Mara', `We got max: ${max} and we'll place: ${willPlace}`);
        checkBalance(willPlace);
        do {
            await delayPromise(400);
            await enterAndPlace(willPlace);
        } while (!await waitForBetPlaced());
        await checkStatus();
        return await collectOpenBet();
    };

    const closePrevious = async data => {
        const $okButtonOuter = $('#ok-button:visible');
        if ($okButtonOuter.length === 1) {
            await mouseChain({target: $okButtonOuter[0], events: ['click']});
            await delayPromise(1000);
        }
        const $openBets = await waitForElement('#header_open_bets', 333, 10000, true);
        await delayPromise(555);
        if ($openBets.find('#open_bets_count').trt() !== '0') {
            if (!$openBets.hasClass('active')) {
                await mouseChain({target: $openBets[0], events: ['click']});
                await waitForElement('#header_open_bets.active', 333, 5000);
            }
            await waitForElement('div.open-bet-header-buttons__ico-remove', 333, 10000);
            await delayPromise(300);
            let pr = delayPromise(11);
            $('div.open-bet-header-buttons__ico-remove').each(function () {
                pr = pr.then(() => mouseChain({
                    target: $(this)[0],
                    events: ['click']
                })).then(delayFunction(500));
            });
            await pr;
        }
        const $betSlip = $('#header_bet_slip');
        if (!$betSlip.hasClass('active')) {
            await mouseChain({target: $betSlip[0], events: ['click']});
            await delayPromise(1000);
        }
        const $removeAll = $('span.button.btn-remove:visible');
        if (!data[0].doNotRemove && $removeAll.length > 0) {
            await mouseChain({target: $removeAll[0], events: ['click'], scroll: true});
            await delayPromise(1000);
        }
    };

    const findEventWrapper = async data => {
        dLog('blue', 'Mara', `data.type is '${data.type}'`);
        const sport = sportAccordance[data.sport];
        if (data.type && data.type === 'LIVE') {
            await goToLive();
            // Hint: we need switch to football and to live ONLY in case we'll bet prematch!!!
            let $sport = $(`a span:textEquals("${sport}")`);
            if ($sport.length < 1) {
                throw `No ${data.sport} live!`;
            } else if (!$sport.closest('div.submenu-header').hasClass('selected')) {
                // Check url here
                if (window.location.href.indexOf(settings.url) === -1) {
                    window.location.href = settings.url;
                    return;
                }
                //Switch to current sport
                await mouseChain({target: $sport[0], events: fullClick, error: 'Sport switch'});
                await delayPromise(1000);
            }
            //find event
            return await findEvent(data, true);
        } else {
            // In the other case (PREMATCH) - switching to All events
            await goToPrematch();
            await selectSport(data);
            await waitForElement('h1.events-page-label:textEquals("' + sport + '")', 333, 10000);
            await delayPromise(555);
            await mouseChain({
                target: $('span.v-btn__content:textEquals("Все время")')[0],
                events: fullClick,
                error: '$sportLink'
            });
            await delayPromise(2555);

            if (!$('input[aria-label="Категории"]').is(':checked')) {
                await mouseChain({
                    target: $('input[aria-label="Категории"]')[0],
                    events: fullClick,
                    error: 'click category'
                });
            }
            await delayPromise(4888);

            return await findEventPrematch(data);
        }
    };

    const checkCoefsExpress = async (paramData, totalCoef) => {
        const $buttAcc = await waitForElement('#button_accumulator', 300, 50000, true);
        await mouseChain({target: $buttAcc[0], events: fullClick, error: 'buttAcc'});
        await delayPromise(1000);
        // Hint: Checking coef in max for all stakes
        if (paramData.some(d => d.coef === '')) {
            return;
        }
        const $coefs = $(['div.choice-price', 'td.choice-price'].find(e => $(e).length > 0) + 'span')
            .filter(function () {
                return !$(this).hasClass('sprice-arrow')
            });
        if ($coefs.length !== paramData.length) {
            throw 'LOW_COEF coefs not match params!';
        }

        for (let i = 0; i < paramData.length; i++) {
            //check coefs for EXPRESS
            const localCoef = parseFloat($($coefs[i]).text().trim());
            const localData = paramData[i];
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if (!newAPI && localData !== false && localData.coef !== '' && !isNaN(localCoef)) {
                let checkCoef = parseFloat(localData.coef);
                if (!isNaN(checkCoef) && (checkCoef - localCoef) > 0.22) {
                    throw ' LOW_COEF: Tried to bet 0';
                } else if (isNaN(checkCoef) || checkCoef > localCoef) {
                    throw  ' LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef;
                }
            } else if (localData === false || isNaN(localCoef)) {
                throw 'LOW_COEF - wrong match or localCoef!';
            } else if (newAPI) {
                const nCheck = localData.coef && !isNaN(parseFloat(localData.coef)) ? parseFloat(localData.coef) : totalCoef / 1.21;
                if (totalCoef >= nCheck * 1.2) {
                    throw 'Coef TOO BIG: ' + totalCoef + ' instead of ' + localData.coef;
                } else if (totalCoef < nCheck) {
                    throw 'LOW_COEF ' + localData.coef + ' > ' + totalCoef;
                }
            }
        }
        // Here we'll place Save - let's do it for 10 seconds
        const $saveBtn = await waitForElement('#betslip_apply_choices:visible', 300, 10000);
        await mouseChain({target: $saveBtn[0], events: fullClick, error: '$saveBtn'});
        await delayPromise(500);
    };

    /**
     *
     * @param paramData
     * @param isLast - whenever we must get max for express
     * @returns {Promise<number>}
     */
    const performExactGetMax = async (paramData, isLast) => {
        bsDebug(port, `performExactGetMax: ${isLast}`, paramData);
        await waitForCondition(() => $('div.bet-slip-open').is(':visible'),
            300, 30000, 'Coupon not opened');

        let totalCoef = 1;
        if ($('#betslip_has_removed_choices_block').is(':visible')) {
            throw 'LOW_COEF or one of stakes becomes inactive!';
        } else if (isLast && paramData.length > 1 && ourCommand.get().action === 'EXPRESS') {
            await checkCoefsExpress(paramData, totalCoef);
            return parseFloat($('#max-stake').text().trim().replace(',', ''));
        } else {
            const minMaxSelector = 'div.min-max-stake span:visible';
            if ($(minMaxSelector).length > 0) {
                // Hint: Checking coef in max
                const localCoef = parseFloat($('td.choice-price span:first-child').text().trim());
                const localData = paramData[0];
                totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
                if (!newAPI && localData !== false && localData.coef !== '' && !isNaN(localCoef)) {
                    let checkCoef = parseFloat(localData.coef);
                    if (!isNaN(checkCoef) && (checkCoef - localCoef) > 0.22) {
                        throw ' LOW_COEF: Tried to bet 0';
                    } else if (isNaN(checkCoef) || checkCoef > localCoef) {
                        throw  ' LOW_COEF, have: ' + localCoef + ', need: ' + checkCoef;
                    } else {
                        return 77777;
                    }
                } else if (localData === false || isNaN(localCoef)) {
                    throw 'LOW_COEF - wrong match or localCoef!';
                } else if (newAPI) {
                    const nCheck = localData.coef && !isNaN(parseFloat(localData.coef)) ? parseFloat(localData.coef) : totalCoef / 1.21;
                    if (totalCoef >= nCheck * 1.2) {
                        throw 'Coef TOO BIG: ' + totalCoef + ' instead of ' + localData.coef;
                    } else if (totalCoef < nCheck) {
                        throw 'LOW_COEF ' + localData.coef + ' > ' + totalCoef;
                    } else {
                        return 77777;
                    }
                } else {
                    return 77777;
                }

            } else {
                throw 'Maximum not found!';
            }
        }
    };

    /**
     *
     * @param paramData
     * @returns {Promise<number>}
     */
    const getMax = async paramData => {
        dLog('blue', 'Mara', `getMax 1`);
        const performGetMax = async (tBodySel, data, isLast) => {
            dLog('blue', 'Mara', `performGetMax ${tBodySel}/${isLast}:`);
            const $bet = await getBetElement(data, tBodySel);
            if ($bet.closest('div.market-inline-block-table-wrapper').length > 0) {
                $bet.closest('div.market-inline-block-table-wrapper')[0].scrollIntoView();
            } else if ($bet.closest('div.foot-market-border').length > 0) {
                $bet.closest('div.foot-market-border')[0].scrollIntoView();
            } else {
                $bet[0].scrollIntoView();
            }
            dLog('blue', 'Mara', `we got betEl: '${($bet[0].nodeName === 'DIV' ? $bet.parent() : $bet[0].nodeName === 'TD' ? $bet.find('span') : $bet)
                .text().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()}'`);
            await mouseChain({target: $bet[0], events: fullClick, scroll: true, error: 'betEl'});
            await delayPromise(1500);
            return await performExactGetMax(paramData, isLast);
        };
        let max = 10000000;
        if (ourCommand.getAdded('action') !== 'ARB_BET') {
            await closePrevious(paramData);
        }
        //copy paramData
        let lData = paramData.slice();
        do {
            //get first array from lData
            const data = lData.shift();
            data.team1 = data.team1.replace(' (w)', '');
            data.team2 = data.team2.replace(' (w)', '');
            //start find event
            const elSel = await findEventWrapper(data);
            dLog('color: gray', 'Mara', `We got event: '${elSel}'`);
            await waitForCondition(() => $(elSel).find('div[data-mutable-id="shortcuts"]')
                .is(':visible'), 300, 20000, 'No markets!')
                .catch(e => dLog('red', 'Mara', `Markets: ${e}`));
            max = await performGetMax(elSel, data, lData.length === 0);
        } while (lData.length > 0);
        return max;
    };

    const selectSport = async (data) => {
        const $sportMenu = $('div.sport-menu').eq(1);
        if ($sportMenu.length > 0) {
            const sport = sportAccordance[data.sport];
            const $sportLink = $('div.sport-menu').eq(1).find(`a:textEquals("${sport}")`);
            await mouseChain({
                target: $sportLink[0],
                events: fullClick,
                error: '$sportLink'
            });
        } else {
            throw 'can\'t find sport menu';
        }
    };

    const goToPrematch = async () => {
        const selector = isCupis ? 'a[href="/su/all-events.htm"]' : 'a[href="/en/all-events.htm"]';
        if (!$(selector).parent().hasClass('active')) {
            await mouseChain({
                target: $(selector)[0],
                events: fullClick,
                error: 'All events'
            });
            await delayPromise(2000);
        }
        const categoriesSelector = 'input[name="collapseAllCategoriesCheckbox"]';
        if (!$(categoriesSelector).is(':checked')) {
            await mouseChain({
                target: $(categoriesSelector)[0],
                events: fullClick,
                error: 'categoriesSelector'
            });
            await delayPromise(3000);
        }
    };

    const getBetElement = async (data, bodySel) => {
        //#-#-START
        const tBodySel = $(bodySel).length === 0 ? 'div.coupon-row:has(div[data-mutable-id="shortcuts"]:visible)' : bodySel;
        if ($(tBodySel).length === 0) {
            throw `Event not opened!`;
        }
        const teams = $(tBodySel).find('div.member-names-view span.member');
        //const teams = $(tBodySel).attr('data-event-name').split(' vs ');
        //if (teams.length !== 2) {
        //    throw `No teams!`;
        //}
        data.team1 = teams.eq(0).text().replace('—', '').trim();
        data.team2 = teams.eq(1).text().replace('—', '').trim();

        let prematch = false;

        const $tableMAC = $(tBodySel).find([
            'table.member-area-content-table a.member-link',
            'table.member-area-content-table span[data-member-link="true"]'
        ].find(s => $(tBodySel).find(s).length === 2));
        if ($tableMAC.length === 2) {
            prematch = true;
        }
        const hTeam1 = prematch ? $tableMAC.eq(0).text().trim() : data.team1;
        const hTeam2 = prematch ? $tableMAC.eq(1).text().trim() : data.team2;

        if (data.bk_event_native_id) {
            data.team1 = hTeam1;
            data.team2 = hTeam2;
        }

        console.log(`data: ${data.team1}/${data.team2}, hTeams: ${hTeam1}/${hTeam2}`);

        const markets = {
            'TOTAL': {
                'OVER': {
                    roots: ['Total Markets'],
                    subroots: ['Total Goals', 'Asian Total Goals'],
                    pivotKeys: ['Over'],
                },
                'UNDER': {
                    roots: ['Total Markets'],
                    subroots: ['Total Goals', 'Asian Total Goals'],
                    pivotKeys: ['Under'],
                }
            },
            'T1_TOTAL': {
                'OVER': {
                    roots: ['Total Markets'],
                    subroots: ['Total Goals (#TEAM1#)', 'Asian Total Goals (#TEAM1#)'],
                    pivotKeys: ['Over'],
                },
                'UNDER': {
                    roots: ['Total Markets'],
                    subroots: ['Total Goals (#TEAM1#)', 'Asian Total Goals (#TEAM1#)'],
                    pivotKeys: ['Under'],
                }
            },
            'T2_TOTAL': {
                'OVER': {
                    roots: ['Total Markets'],
                    subroots: ['Total Goals (#TEAM2#)', 'Asian Total Goals (#TEAM2#)'],
                    pivotKeys: ['Over'],
                },
                'UNDER': {
                    roots: ['Total Markets'],
                    subroots: ['Total Goals (#TEAM2#)', 'Asian Total Goals (#TEAM2#)'],
                    pivotKeys: ['Under'],
                }
            },
            'CORNER_TOTAL': {
                'OVER': {
                    roots: ['Corner Markets'],
                    subroots: ['Total Corners', 'Asian Total Corners'],
                    pivotKeys: ['Over'],
                },
                'UNDER': {
                    roots: ['Corner Markets'],
                    subroots: ['Total Corners', 'Asian Total Corners'],
                    pivotKeys: ['Under'],
                }
            },
            'CORNER_HDP': {
                'HOME': {
                    roots: ['Corner Markets'],
                    subroots: ['Most Corners With Handicap'],
                    pivotKeys: ['#TEAM1#'],
                },
                'AWAY': {
                    roots: ['Corner Markets'],
                    subroots: ['Most Corners With Handicap'],
                    pivotKeys: ['#TEAM2#'],
                }
            },
            'HDP': {
                HOME: {
                    roots: ['Handicap Markets'],
                    subroots: ['To Win Match With Handicap', 'To Win Match With Asian Handicap'],
                    pivotKeys: ['#TEAM1#'],
                },
                AWAY: {
                    roots: ['Handicap Markets'],
                    subroots: ['To Win Match With Handicap', 'To Win Match With Asian Handicap'],
                    pivotKeys: ['#TEAM2#'],
                }
            },
            'EURO_HDP': {
                H1: {
                    roots: ['Handicap Markets'],
                    subroots: ['To Win Match With Handicap (3 way)'],
                    pivotKeys: ['#TEAM1# (#PIVOTH#)'],
                },
                H2: {
                    roots: ['Handicap Markets'],
                    subroots: ['To Win Match With Handicap (3 way)'],
                    pivotKeys: ['#TEAM2# (#PIVOTH#)'],
                },
                HX: {
                    roots: ['Handicap Markets'],
                    subroots: ['To Win Match With Handicap (3 way)'],
                    pivotKeys: ['Draw (#PIVOTH#)'],
                }
            },
            'ONE_TWO': {
                'ONE': {roots: ['All Markets'], subroots: ['Result'], pivotKeys: ['#TEAM1# To Win']},
                'TWO': {roots: ['All Markets'], subroots: ['Result'], pivotKeys: ['#TEAM2# To Win']},
                'DRAW': {roots: ['All Markets'], subroots: ['Result'], pivotKeys: ['Draw']},
                'ONE_DRAW': {roots: ['All Markets'], subroots: ['Result'], pivotKeys: ['#TEAM1# To Win or Draw']},
                'TWO_DRAW': {roots: ['All Markets'], subroots: ['Result'], pivotKeys: ['#TEAM2# To Win or Draw']},
                'ONE_TWO': {
                    roots: ['All Markets'],
                    subroots: ['Result'],
                    pivotKeys: ['#TEAM1# To Win or #TEAM2# To Win'],
                }
            },
        };

        const params = new AllMarkets(data);
        params.proceed_football = function (data) {
            if (data.time_value === 'HALF_TIME') {
                this.addTotal('roots', ['Half Markets']);
                const subroots = {
                    'ONE_TWO': ['1st Half Result'],
                    'EURO_HDP': ['To Win 1st Half With Handicap (3 way)'],
                    'HDP': ['To Win 1st Half With Handicap'],
                    'T2_TOTAL': ['Total Goals (#TEAM2#) - 1st Half'],
                    'T1_TOTAL': ['Total Goals (#TEAM1#) - 1st Half'],
                    'TOTAL': ['Total Goals  - 1st Half', 'Asian Total Goals - 1st Half'],
                };
                this.addTotal('subroots', subroots[data.market] || []);
            }
            if (isCupis && ['ONE_TWO', 'HDP', 'TOTAL'].indexOf(data.market) > -1) {
                this.addTo('roots', 'MAIN_ROW');
            }
        };
        params.proceed_tennis = function (data) {
            if (data.market === 'ONE_TWO') {
                if (data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') > -1) {
                    const parts = data.time_value.split('_GAME_');
                    const set = parts[0].replace(/[^\d]/g, '').trim();
                    this.addTotal('roots', ['Game Markets']);
                    this.addTotal('subroots', [`To Win Game, ${set}${this.calcTh(set)} Set`]);
                    this.addTo('pivotKeys', `Победа #TEAM${(data.target === 'ONE' ? '1' : '2')}#`);
                } else {
                    if (this.full) {
                        this.addTotal('roots', ['MAIN_ROW']);
                    } else {
                        this.addTotal('subroots', [`${this.tDigit}${this.th} Set Result`]);
                    }
                }
            } else if (data.market === 'TOTAL') {
                this.addTotal('subroots', [this.full ? 'Total Games' : `Total Games - ${this.tDigit}${this.th} Set`]);
            } else if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                this.addTotal('subroots', [`Total Games To Win (#TEAM${data.market.replace(/[^\d]/g, '')}#)`]);
            } else if (data.market === 'HDP') {
                this.addTotal('subroots', [this.full ? 'To Win Match With Handicap By Games' : `To Win ${this.tDigit}${this.th} Set With Handicap`]);
            }
            if (!this.full) {
                this.addTo('roots', 'Set Markets');
            }
        };
        params.proceed_basketball = function (data) {
            if (!this.full) {
                if (data.market === 'ONE_TWO') {
                    this.addTotal('roots', ['Map Quoters']);
                    this.addTotal('subroots', [`Result Map ${this.tDigit}${this.th} quoter`]);
                }
                if (data.market === 'HDP') {
                    this.addTotal('roots', ['Map Quoters']);
                    this.addTotal('subroots', [`HDP Map ${this.tDigit}${this.th} quoter`]);
                }
                if (data.market === 'TOTAL') {
                    this.addTotal('roots', ['Map Quoters']);
                    this.addTotal('subroots', [`Total Map ${this.tDigit}${this.th} quoter`]);
                }
                if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                    this.addTotal('roots', ['Map Quoters']);
                    this.addTotal('subroots', [`Total Map 1st quoter (#TEAM${data.market.replace(/[^\d]/g, '')}#)`]);
                }
            } else {
                if (data.market === 'ONE_TWO') {
                    this.addTotal('subroots', ['Result']);
                    this.addTotal('pivotKeys', [`#TEAM${(data.target === 'ONE' ? '1' : '2')}#`]);
                } else if (data.market === 'TOTAL') {
                    this.addTotal('subroots', ['Total Points']);
                } else if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                    this.addTotal('subroots', [`Total Points (#TEAM${data.market.replace(/[^\d]/g, '')}#)`]);
                } else if (data.market === 'HDP') {
                    this.addTotal('subroots', ['To Win Match With Handicap']);
                }
            }
        };
        params.proceed_hockey = function (data) {
            if (this.full) {
                this.addTo('roots', 'MAIN_ROW');
                return;
            }
            this.addTotal('roots', ['Period Markets']);
            if (data.market === 'ONE_TWO') {
                this.addTotal('subroots', [`${this.tDigit}${this.th} Period Result`]);
            } else if (data.market === 'TOTAL') {
                this.addTotal('subroots', [`Total Goals - ${this.tDigit}${this.th} Period`, `Asian Total Goals - ${this.tDigit}${this.th} Period`]);
            } else if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                this.addTotal('subroots', [`Total Goals (#TEAM${data.market.replace(/[^\d]/g, '')}#) - ${this.tDigit}${this.th} Period`]);
            } else if (data.market === 'HDP') {
                this.addTotal('subroots', [`To Win ${this.tDigit}${this.th} Period With Handicap`]);
            }
        };
        params.proceed_volleyball = function (data) {
            if (!this.full) {
                this.addTotal('roots', ['Set Markets']);
                if (data.market === 'ONE_TWO') {
                    this.addTotal('pivotKeys', [`#TEAM${(data.target === 'ONE' ? '1' : '2')}#`]);
                    this.addTotal('subroots', [`${this.tDigit}${this.th} Set Result`]);
                }
            }
            if (data.market === 'ONE_TWO' && this.full) {
                this.addTotal('roots', ['MAIN_ROW']);
            } else if (data.market === 'TOTAL') {
                this.addTotal('subroots', this.full
                    ? ['Total Points']
                    : [`Total ${this.tDigit}${this.th} Set Points`, `Total ${this.tDigit}${this.th} VSet Points`]
                );
            } else if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                this.addTotal('subroots', [this.full ? `Total Points (#TEAM${data.market.replace(/[^\d]/g, '')}#)`
                    : `Total Points (#TEAM${data.market.replace(/[^\d]/g, '')}#) - ${this.tDigit}${this.th} Set`]);
            } else if (data.market === 'HDP') {
                this.addTotal('subroots', this.full
                    ? ['To Win Match With Handicap By Points']
                    : [`${this.tDigit}${this.th} Set Handicap Points`, `${this.tDigit}${this.th} VSet Handicap Points`]
                );
            }
        };
        params.proceed_cybersport = function (data) {
            if (!this.full) {
                this.addTotal('roots', ['Map Markets']);
            }
            if (data.market === 'ONE_TWO' && this.full) {
                this.addTotal('roots', ['MAIN_ROW']);
            } else if (data.market === 'ONE_TWO' && !this.full) {
                this.addTotal('subroots', [`${this.tDigit}${this.th} Map Result`]);
            } else if (data.market === 'TOTAL') {
                if (isCupis && data.type === 'PREMATCH') {
                    this.addTotal('subroots', ['Total Cards']);
                } else {
                    this.addTotal('subroots', [this.full ? 'Total Rounds' : `Total Rounds - ${this.tDigit}${this.th} Map`]);
                }
            } else if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                this.addTotal('subroots', [`Total Rounds (#TEAM${data.market.replace(/[^\d]/g, '')}#)`]);
            } else if (data.market === 'HDP') {
                if (isCupis && data.type === 'PREMATCH') {
                    this.addTotal('subroots', ['To Win Match With Handicap By Cards']);
                } else {
                    this.addTotal('subroots', [`To Win ${(this.full ? 'Match' : `${this.tDigit}${this.th} Map`)} With Handicap By Rounds`]);
                }
            }
        };
        params.proceed_tabletennis = function (data) {
            if (!this.full) {
                this.addTotal('roots', ['Set Markets']);
            }
            if (data.market === 'ONE_TWO' && this.full) {
                this.addTotal('roots', ['MAIN_ROW']);
                this.addTotal('pivotKeys', [data.target === 'ONE' ? '#TEAM1#' : '#TEAM2#']);
            } else if (data.market === 'ONE_TWO' && !this.full) {
                this.addTotal('subroots', [`${this.tDigit}${this.th} Set Result`]);
                this.addTotal('pivotKeys', [data.target === 'ONE' ? '#TEAM1#' : '#TEAM2#']);
            } else if (data.market === 'TOTAL') {
                this.addTotal('subroots', [this.full ? 'Total Points' : `Total ${this.tDigit}${this.th} Set Points`]);
            } else if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                this.addTotal('subroots', [this.full ?
                    `Total Points (#TEAM${data.market.replace(/[^\d]/g, '')}#)` :
                    `Total Points (#TEAM${data.market.replace(/[^\d]/g, '')}#) - ${this.tDigit}${this.th} Set`]);
            } else if (data.market === 'HDP') {
                this.addTotal('subroots', [this.full ? `To Win Match With Handicap By Points`
                    : `${this.tDigit}${this.th} Set Handicap Points`]);
            }
        };
        params.proceed_baseball = function (data) {
            if (!this.full) {
                if (data.market === 'ONE_TWO') {
                    console.log('HERE')
                    this.addTotal('roots', ['Map Innings']);
                    this.addTotal('subroots', [`${this.tDigit}${this.th} Inning Result`]);
                }
                if (data.market === 'HDP') {
                    this.addTotal('roots', ['Map Innings']);
                    this.addTotal('subroots', [`To Win Match With Handicap By run ${this.tDigit}${this.th} inning`]);
                }
                if (data.market === 'TOTAL') {
                    this.addTotal('roots', ['Map Innings']);
                    this.addTotal('subroots', [`Total Runs ${this.tDigit}${this.th} inning`]);
                }
            } else {
                if (data.market === 'HDP') {
                    this.addTotal('subroots', ['To Win Match With Handicap By run']);
                }
                if (data.market === 'TOTAL') {
                    this.addTotal('subroots', ['Total Runs']);
                }
                if (['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) > -1) {
                    this.addTotal('subroots', [`Total Runs (#TEAM${data.market.replace(/[^\d]/g, '')}#)`]);
                }
            }

        };
        params.proceed_handball = function () {

        };
        marketsModifierAll(data, ['roots', 'subroots', 'pivotKeys',], params, markets);

        if (!markets[data.market] || !markets[data.market][data.target]) {
            throw `Unsupported market: ${data.market}/${data.target}`;
        }
        const market = markets[data.market][data.target];

        const trDr = {
            '#TEAM1# To Win': '#TEAM1# (победа)',
            '#TEAM1# To Win or #TEAM2# To Win': '#TEAM1# (победа) или #TEAM2# (победа)',
            '#TEAM1# To Win or Draw': '#TEAM1# (победа) или ничья',
            '#TEAM2# To Win': '#TEAM2# (победа)',
            '#TEAM2# To Win or Draw': '#TEAM2# (победа) или ничья',
            '1st Half Result': 'Результат, 1-й тайм',
            '1st Map Result': 'Результат, 1st карта',
            '1st Inning Result': 'Результат, 1st иннинг',
            'To Win Match With Handicap By run 1st inning': 'Победа с учетом форы в ранах, 1st иннинг',
            'Total Runs 1st inning': 'Тотал ранов, 1st иннинг',
            '1st Period Result': 'Результат, 1st период',
            '1st Set Handicap Points': 'Фора 1st партии по очкам',
            '1st VSet Handicap Points': 'Фора 2st партии по очкам',
            '1st Set Result': 'Результат, 1st сет',
            'All Markets': 'Все выборы',
            'Corner Markets': 'Угловые',
            'Total Corners': 'Тотал угловых',
            'Asian Total Corners': 'Азиатский тотал угловых',
            'Asian Total Goals': 'Азиатский тотал голов',
            'Asian Total Goals (#TEAM1#)': 'Азиатский тотал голов (#TEAM1#)',
            'Asian Total Goals (#TEAM1#) - 1st Half': 'Азиатский тотал голов (#TEAM1#), 1-й тайм',
            'Asian Total Goals (#TEAM2#)': 'Азиатский тотал голов (#TEAM2#)',
            'Asian Total Goals (#TEAM2#) - 1st Half': 'Азиатский тотал голов (#TEAM2#), 1-й тайм',
            'Asian Total Goals - 1st Half': 'Азиатский тотал голов, 1-й тайм',
            'Asian Total Goals - 1st Period': 'Азиатский тотал голов, 1st период',
            'Draw': 'Ничья',
            //'Draw (#PIVOTH#)': 'Draw (#PIVOTH#)',
            'Game Markets': 'Геймы',
            'Half Markets': 'Таймы',
            'Handicap Markets': 'Форы',
            'Map Markets': 'Карты',
            'Map Innings': 'Иннинги',
            'Map Quoters': 'Четверти',
            //'Normal Time Result': 'Normal Time Result',
            'Over': 'Больше',
            'Period Markets': 'Периоды',
            'Result': 'Результат',
            'Set Markets': 'Сеты',
            'Result Map 1st quoter': 'Результат, 1st четверть',
            'HDP Map 1st quoter': 'Победа с учетом форы, 1st четверть',
            'Total Map 1st quoter': 'Тотал очков, 1st четверть',
            'Total Map 1st quoter (#TEAM1#)': 'Тотал очков (#TEAM1#), 1st четверть',
            'Total Map 1st quoter (#TEAM2#)': 'Тотал очков (#TEAM2#), 1st четверть',
            'Most Corners With Handicap': 'Кто подаст больше угловых с учётом форы',
            'To Win 1st Half With Handicap': 'Победа с учетом форы, 1-й тайм',
            'To Win 1st Half With Handicap (3 way)': 'Победа с учетом форы, 1-й тайм (3 исхода)',
            'To Win 1st Map With Handicap By Rounds': 'Победа с учетом форы по раундам, 1st карта',
            'To Win 1st Period With Handicap': 'Победа с учетом форы, 1st период',
            'To Win 1st Set With Handicap': 'Победа с учетом форы по геймам, 1st сет',
            'To Win Game, 1st Set': 'Победа в гейме, 1st сет',
            'To Win Match With Asian Handicap': 'Победа с учетом азиатской форы',
            'To Win Match With Handicap': 'Победа с учетом форы',
            'To Win Match With Handicap By run': 'Победа с учетом форы в ранах',
            'Total Runs': 'Тотал ранов, матч',
            'Total Runs (#TEAM1#)': '#TEAM1#, тотал ранов, матч',
            'Total Runs (#TEAM2#)': '#TEAM2#, тотал ранов, матч',
            'To Win Match With Handicap (3 way)': 'Победа с учетом форы (3 исхода)',
            'To Win Match With Handicap By Games': 'Победа с учетом форы по геймам',
            'To Win Match With Handicap By Points': 'Фора матча по очкам',
            'To Win Match With Handicap By Rounds': 'Победа с учетом форы по раундам',
            'To Win Match With Handicap By Cards': 'Победа с учетом форы по картам',
            'Total 1st Set Points': 'Тотал 1st партии по очкам',
            'Total 1st VSet Points': 'Тотал 2st партии по очкам',
            'Total Games': 'Тотал геймов',
            'Total Games - 1st Set': 'Тотал геймов, 1st сет',
            'Total Games To Win (#TEAM1#)': 'Тотал выигранных геймов (#TEAM1#)',
            'Total Games To Win (#TEAM2#)': 'Тотал выигранных геймов (#TEAM2#)',
            'Total Goals': 'Тотал голов',
            'Total Goals  - 1st Half': 'Тотал голов, 1-й тайм',
            'Total Goals (#TEAM1#)': 'Тотал голов (#TEAM1#)',
            'Total Goals (#TEAM1#) - 1st Half': 'Тотал голов (#TEAM1#), 1-й тайм',
            'Total Goals (#TEAM1#) - 1st Period': 'Тотал голов (#TEAM1#) - 1-й период',
            'Total Goals (#TEAM2#)': 'Тотал голов (#TEAM2#)',
            'Total Goals (#TEAM2#) - 1st Half': 'Тотал голов (#TEAM2#), 1-й тайм',
            'Total Goals (#TEAM2#) - 1st Period': 'Тотал голов (#TEAM2#) - 1-й период',
            'Total Goals - 1st Period': 'Тотал голов, 1-й период',
            'Total Markets': 'Тоталы',
            'Total Points': 'Тотал очков',
            'Total Points (#TEAM1#)': 'Тотал очков (#TEAM1#)',
            'Total Points (#TEAM1#) - 1st Set': 'Тотал по очкам (#TEAM1#), 1st партия',
            'Total Points (#TEAM2#)': 'Тотал очков (#TEAM2#)',
            'Total Points (#TEAM2#) - 1st Set': 'Тотал по очкам (#TEAM2#), 1st партия',
            'Total Rounds': 'Тотал раундов',
            'Total Rounds (#TEAM1#)': 'Тотал раундов (#TEAM1#)',
            'Total Rounds (#TEAM2#)': 'Тотал раундов (#TEAM2#)',
            'Total Rounds - 1st Map': 'Тотал раундов, 1st карта',
            'Total Cards': 'Тотал карт',
            'Under': 'Меньше',
        };

        if (isCupis) {
            const translations = {};
            const tvDigit = data.time_value === 'HALF_TIME' ? '1'
                : data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') > -1
                    ? data.time_value.replace(/[^\d]/g, '').substr(0, 1)
                    : data.time_value.replace(/[^\d]/g, '');
            const tvSign = tvDigit + (!isNaN(tvDigit) ? tvDigit < 4 ? ['st', 'nd', 'rd'][tvDigit - 1] : 'th' : '');
            Object.keys(trDr)
                .forEach(tk => translations[tk.replace('1st', tvSign)]
                    = trDr[tk]
                    .replace('1st',
                        `${tvDigit}-` + (tk.indexOf('Map') > -1 || ((data.sport === 'VOLLEYBALL' || data.sport === 'TABLETENNIS') && (data.market !== 'HDP' && data.market !== 'TOTAL')) ? 'я' : 'й'))
                    .replace('2st', `${tvDigit}-й`)
                );
            dLog('green', 'Mara', ['Translations is:', translations]);
            replaceInnerStrong(market, translations);
            if (data.sport === 'VOLLEYBALL' || data.sport === 'TABLETENNIS') {
                replaceInner(market, {
                    'Сеты': 'Партии',
                    'сет': 'партия',
                    'Тотал очков': ['T1_TOTAL', 'T2_TOTAL'].indexOf(data.market) === -1 ? 'Тотал матча по очкам' : 'Тотал очков',
                });
            }
        }

        const getPivotH = () => {
            let t = data.target === 'H2' ? data.pivot * -1 : data.pivot;
            return t > 0 ? `+${t}` : t;
        };

        replaceInner(market, {
            '#TEAM1#': hTeam1,
            '#TEAM2#': hTeam2,
            '#PIVOTH#': getPivotH(),
        });

        dLog('green', 'Mara:', [`Final market is (${hTeam1}/${hTeam2}):`, market]);

        if (!market.roots || !market.subroots) {
            throw `Bad market!`;
        }

        let $found = $([]);

        const performGetElementNew = (subroots, root) => {
            console.log('performGetElementNew');
            const marketsIdx = {
                'TOTAL': {
                    'Меньше': 0,
                    'Больше': 1
                },
                'T1_TOTAL': {
                    'Меньше': 0,
                    'Больше': 1
                },
                'T2_TOTAL': {
                    'Меньше': 0,
                    'Больше': 1
                },
                'CORNER_TOTAL': {
                    'Меньше': 0,
                    'Больше': 1
                },
                'HDP': {
                    'HOME': 0,
                    'AWAY': 1
                },
            }
            let $candidates = $([]);
            let finalIndex = 'none';
            for (const $sub of subroots) {
                for (const pivot of market.pivotKeys) {
                    $candidates = $sub.find('table.td-border tr').filter(function () {
                        if (typeof this === 'undefined') {
                            return false;
                        }
                        if ($(this).find('td').length === 2) {
                            //get index by target

                            const getIndex = data.market === 'HDP' ? marketsIdx[data.market][data.target] : marketsIdx[data.market][pivot];
                            const txt = $(this).find('td').eq(getIndex).find('div.coeff-value').text().trim()
                                .replace('(', '').replace(')', '');

                            if (txt.indexOf(',') > -1) {
                                let splited = txt.split(',');
                                let total = 0;
                                splited.forEach(t => total += parseFloat(t));
                                finalIndex = getIndex;
                                return parseFloat(data.pivot) === total / splited.length;
                            } else {
                                finalIndex = getIndex;
                                return parseFloat(data.pivot) === parseFloat(txt);
                            }
                        } else {
                            return false;
                        }
                    });
                    if ($candidates.length > 0) {
                        break;
                    }
                }
                if ($candidates.length > 0) {
                    break;
                }
            }

            return finalIndex === 'none' ? $candidates : $candidates.find('td').eq(finalIndex)
        }

        const performGetElement = (subroots, root) => {
            let $candidates = $([]);
            for (const $sub of subroots) {
                console.log($sub);
                for (const pivot of market.pivotKeys) {
                    if (root === 'MAIN_ROW') {
                        const pvt = `"sn":"${pivot}"`;
                        console.log('%c' + `Working with '${pvt}'`, 'background: orange; color: black; font-size: 12px; font-weight: bold; padding: 3px;');
                        $candidates = $sub.find(`td.height-column-with-price`).filter(function () {
                            console.log($(this).attr('data-sel'));
                            if ($(this).attr('data-sel')) {
                                console.log($(this).attr('data-sel').indexOf(pvt) > -1);
                                return $(this).attr('data-sel').indexOf(pvt) > -1;
                            } else {
                                return false;
                            }
                        });
                    } else if (data.market === 'ONE_TWO') {
                        if (data.sport === 'TENNIS' && data.time_value.indexOf('SET') > -1 && data.time_value.indexOf('GAME') > -1) {
                            $candidates = $sub.find('td.height-column-with-price').filter(function () {
                                const ds = $(this).attr('data-sel') || '';
                                const parts = data.time_value.split('_GAME_');
                                const find = isCupis
                                    ? `Сет ${parts[0].replace(/[^\d]/g, '')}, гейм ${parts[1]}`
                                    : `Set ${parts[0].replace(/[^\d]/g, '')}, game ${parts[1]}`;
                                console.log(pivot);
                                console.log(find);
                                console.log(ds);
                                return ds.indexOf(pivot) > -1 && ds.indexOf(find) > -1;
                            });
                        } else {
                            $candidates = $sub.find(`div.result-left:textEquals("${pivot}")`);
                        }
                    } else if (data.market === 'EURO_HDP') {
                        console.log('%c' + `EURO_HDP for '${pivot}'`, 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                        $candidates = $sub.find('td.height-column-with-price').filter(function () {
                            return $(this).attr('data-sel').indexOf(pivot) > -1;
                        });
                    } else {
                        $candidates = $sub.find('td.height-column-with-price').filter(function () {
                            if (typeof this === 'undefined' || typeof $(this).attr('data-sel') !== 'string') {
                                return false;
                            }
                            if ($(this).attr('data-sel').indexOf(pivot) > -1) {
                                const sel = ['div.coeff-handicap', 'div.coeff-value'].find(s => $(this).find(s).length > 0);
                                if (!sel) {
                                    return false;
                                }
                                let txt = $(this).find(sel).text().trim()
                                    .replace('(', '').replace(')', '');
                                console.log(txt, $(this).attr('data-sel').indexOf(pivot));
                                if (txt.indexOf(',') > -1) {
                                    let splitted = txt.split(',');
                                    let total = 0;
                                    splitted.forEach(t => total += parseFloat(t));
                                    return parseFloat(data.pivot) === total / splitted.length;
                                } else {
                                    return parseFloat(data.pivot) === parseFloat(txt);
                                }
                            } else {
                                return false;
                            }
                        });
                    }
                    if ($candidates.length > 0) {
                        break;
                    }
                }
                if ($candidates.length > 0) {
                    break;
                }
            }
            return $candidates;
        };

        const performGetElementOneMarket = () => {
            const $rootRow = $(tBodySel).find('table.coupon-row-item').find('td.height-column-with-price');

            const marketIndexesNHL = {
                'ONE': 2,
                'DRAW': 1,
                'TWO': 0,
                'ONE_DRAW': 5,
                'ONE_TWO': 4,
                'TWO_DRAW': 3,
            };

            const marketIndexesBase = {
                'ONE': 1,
                'TWO': 0,
                'ONE_DRAW': 5,
                'ONE_TWO': 4,
                'TWO_DRAW': 3,
            };

            const marketIndexes = {
                'ONE': 0,
                'DRAW': 1,
                'TWO': 2,
                'ONE_DRAW': 3,
                'ONE_TWO': 4,
                'TWO_DRAW': 5,
            };

            const marketIndexesVol = {
                'ONE': 0,
                'TWO': 1,
                'ONE_DRAW': 2,
                'ONE_TWO': 3,
                'TWO_DRAW': 4,
            };

            const getIndex = (data.league === 'NHL' && data.market === 'ONE_TWO' && data.sport === 'HOCKEY')
                ? marketIndexesNHL[data.target] : ((['VOLLEYBALL', 'TABLETENNIS', 'TENNIS', 'BASKETBALL', 'CYBERSPORT'].includes(data.sport)) && data.market === 'ONE_TWO')
                    ? marketIndexesVol[data.target] : (data.market === 'ONE_TWO' && data.sport === 'BASEBALL') ? marketIndexesBase[data.target] : marketIndexes[data.target];
            $found = $rootRow.eq(getIndex);
        }

        //check for ONE_TWO market
        if (market.subroots.length === 1
            && market.subroots[0] === 'Результат') {
            performGetElementOneMarket();
        } else {
            for (const root of market.roots) {
                if (root !== 'MAIN_ROW') {
                    const $root = $(tBodySel).find('table.table-shortcuts-menu td:contains("' + root + '"):visible');
                    if ($root.length !== 1) {
                        dLog('orange', 'Mara', `Root ${root} not found (`);
                        continue;
                    }
                    await mouseChain({target: $root[0], events: fullClick, error: 'rootClick'});
                    await delayPromise(1000);
                }
                const subroots = [];
                for (const val of market.subroots) {
                    const $subroot = root !== 'MAIN_ROW' ? $(tBodySel).find(`div.name-field:textEqualsIS("${val}"):visible`)
                            .parent().parent().parent().parent().parent()
                        : !prematch ? $(tBodySel).find('tr.coefficients-row') : $(tBodySel).find('table[class="coupon-row-item"]');
                    if ($subroot.length === 1) {
                        subroots.push($subroot);
                    }
                }

                let $res = $([]);
                $res = performGetElementNew(subroots, root);

                if ($res.length === 0) {
                    $res = performGetElement(subroots, root);
                }

                //const $res = performGetElement(subroots, root);
                //const $res = performGetElementNew(subroots, root)
                console.log('%c' + `For '${root}':`, 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                console.log('RES ', $res);
                if ($res.length === 1) {
                    $found = $res.eq(0);
                    break;
                }
            }
        }

        if ($found.length === 0) {
            throw `Bet (${hTeam1} - ${hTeam2} ${data.market} / ${data.target} / ${data.pivot}) not found!`;
        }
        return $found;
        //#-#-FINISH
    };

    const scrapLeagues = async (data, leagues) => {
        const sportsToGet = !data.sport || data.sport === 'ALL' ? Object.keys(sportAccordance) : [data.sport];
        for (const sportOur of sportsToGet) {
            if (!leagues[sportOur]) {
                leagues[sportOur] = [];
            }
            await goPrematchSport(sportAccordance[sportOur]);
            await delayPromise(2000);
            const gotLeagues = await prematchGetLeagues(sportOur);
            bsDebug(port, `Leagues for ${sportOur}/${sportAccordance[sportOur]}`, gotLeagues);
            gotLeagues.forEach(l => l.trim().length > 0 ? leagues[sportOur].push(l) : null);
        }
    };

    const $getPrematchSportContainer = sportBookie => $(`div.sport-category-container:has(a:textEquals("${sportBookie}"))`);

    /**
     * Get leagues for sport
     * @param sportOur
     * @returns {Promise<string[]>}
     */
    const prematchGetLeagues = async sportOur => {
        const res = [];
        $getPrematchSportContainer(sportAccordance[sportOur]).find('h2.category-label').each(function () {
            res.push($(this).text().trim());
        });
        return res;
    };

    const goPrematchSport = async sportBookie => {
        if ($getPrematchSportContainer(sportBookie).hasClass('collapsed')) {
            await mouseChain({
                target: $getPrematchSportContainer(sportBookie).find('div.sport-category-header div.collapse-button')[0],
                events: fullClick,
                error: 'collapsed',
                scroll: true
            });
        } else {
            $getPrematchSportContainer(sportBookie).get(0).scrollIntoView();
        }
    };

    const findEventPrematch = async (data) => {
        if (!data.bk_event_native_id && (!data.team1 || !data.team2)) {
            throw 'Wrong teams!'
        }
        const $events = await waitForElement('div.sport-category-content', 333, 10000);
        const months = {
            '1': 'Jan',
            '2': 'Feb',
            '3': 'Mar',
            '4': 'Apr',
            '5': 'May',
            '6': 'Jun',
            '7': 'Jul',
            '8': 'Aug',
            '9': 'Sept',
            '10': 'Oct',
            '11': 'Nov',
            '12': 'Dec'
        };
        const tSel = '#timer';
        await waitForCondition(() => $(tSel).text().trim().length > 0, 300, 10000);
        const dateObj = getDateObj(months, $(tSel).text().trim());
        const eventName = getEventVariants(data);

        const leagues = [];

        if (!data.league) {
            $events.find('div.category-container').each(function () {
                leagues.push(`#${$(this).attr('id')}`);
            });
        } else {
            // Find league
            const leaguesToFind = data.league.toLowerCase().split(':;');
            const $league = $events.find('h2.category-label').filter(function () {
                const res = compareVariants($(this).text().trim().toLowerCase(), leaguesToFind, 95, true);
                console.log('%c' + `'${$(this).text().trim().toLowerCase()}' === '${leaguesToFind.join(`', '`)}'`,
                    `background-color: ${(res ? 'green' : 'transparent')};`);
                return res;
            });
            if ($league.length !== 1) {
                throw `${data.league} not found (${$league.length}):(`;
            }
            leagues.push(`#${$league.closest('div.category-container').attr('id')}`);
        }

        let eventState = false;
        let clickId = '';
        let clickIdTree = '';

        console.log('leagues ', leagues);

        do {
            const league = leagues.shift();
            $(league).get(0).scrollIntoView(true);
            if ($(league).hasClass('collapsed')) {
                await mouseChain({
                    target: $(league).find('table.category-header td.collapse-button')[0],
                    events: fullClick, error: 'collapsed',
                });
                await delayPromise(1500);
            }

            // Get list of matches
            $(league).find('div.coupon-row').each(function () {
                const $this = $(this);
                if (data.bk_event_native_id && $this.attr("data-event-treeid") === data.bk_event_native_id) {
                    clickId = $this.find('td.member-area-button').attr('id');
                    clickIdTree = $this.attr("data-event-treeid");
                    eventState = true;
                    return false;
                } else {
                    const $tds = $this.find('table.member-area-content-table');
                    const $members = $tds.find('a.member-link');
                    const eventHere = `${$members.eq(0).text().trim()} v ${$members.eq(1).text().trim()}`.toLowerCase();
                    const nameRes = compareVariants(eventHere, eventName, 95, true);

                    if (nameRes) {
                        //open
                        clickId = $this.find('td.member-area-button').attr('id');
                        clickIdTree = $this.attr("data-event-treeid");
                        eventState = true;
                        return false;
                    }
                }
            });
        } while (leagues.length > 0 && !eventState);

        if (!eventState) {
            throw `Event not found! (gerr)`;
        } else {
            const eventSelector = `div.coupon-row[data-event-treeid="${clickIdTree}"]`;
            if ($(eventSelector).find('div[class^="market-details-"]:visible').length === 0
                && $(eventSelector).find('td.member-area-button:has(span.event-more-view)').length > 0) {
                await mouseChain({
                    target: $(eventSelector).find('td.member-area-button:has(span.event-more-view)')[0],
                    events: fullClick, error: 'event not clicked', scroll: true
                });
                await delayPromise(1500);
            }
            dLog('orange', 'Mara', `eventSelector: '${eventSelector}'`);
            return eventSelector;
        }
    };

    // $('div.coupon-row').each(function() { const $t = $(this); console.log(`${$t.attr('data-event-treeid')} - ${$t.attr('data-event-name')}`); });
    const findEvent = async (data, openEvent) => {
        const sport = sportAccordance[data.sport];
        if (!sport) {
            throw `Sport ${data.sport} unsupported`;
        }
        let tBodySel = data.bk_event_native_id
            ? `div.coupon-row[data-event-treeid="${data.bk_event_native_id}"]`
            : `div.coupon-row[data-event-name="${data.team1} vs ${data.team2}"]`;
        const findStarted = Date.now();
        do {
            dLog('green', 'Mara', 'findEvent');
            if (!data.bk_event_native_id && $(tBodySel).length === 0) {
                const ourEvent = `${data.team1} - ${data.team2}`;
                const $f = $('div.coupon-row').filter(function () {
                    const eventHere = $(this).attr('data-event-name');
                    return eventHere === ourEvent || locutus_similar_text(eventHere, ourEvent, true) >= 80;
                });
                if ($f.length === 1) {
                    tBodySel = `div.coupon-row[data-event-name="${$f.attr('data-event-name')}"]`;
                }
            }
            const cSport = $(tBodySel).closest('div.foot-market')
                .attr('data-sport-type');
            const cScoreRes = /(^\d+:\d+)/.exec($(tBodySel).find(
                isCupis ? 'div.cl-left.red' : 'div.score-and-time span.score-state'
            ).text().trim());
            const cScore = cScoreRes && cScoreRes[1] ? cScoreRes[1] : '';
            if (data.sport === 'FOOTBALL' && $(tBodySel).length === 1 && cSport && data.score && cScore !== data.score) {
                throw 'SCORE_CHANGED we have: ' + cScore + ', we need: ' + data.score;
            }
            if ($(tBodySel).length === 1) {
                if (openEvent) {
                    $(tBodySel)[0].scrollIntoView();
                    if (!$(tBodySel).find('div[data-mutable-id="shortcuts"]').is(':visible')) {
                        // we need to expand
                        const exSel = `${tBodySel} td.member-area-button[data-event-more-view="event-more-view"]`;
                        await delayPromise(1000);
                        if ($(exSel).length === 0) {
                            throw 'There is no element for expand!';
                        }
                        //click to expand
                        await mouseChain({target: $(exSel)[0], events: fullClick, scroll: true, error: 'oe'});
                        dLog('blue', 'Mara', `Expand clicked '${exSel}'!`);
                        await delayPromise(1000);
                    }
                }
                return tBodySel;
            } else {
                if (typeof data.league === 'string' && data.league.length > 2) {
                    // If the league specified - open it
                    const leagueCompare = data.league.replace(/\s+/g, ' ').trim();
                    const $leagueRes = $('h2.category-label').filter(function () {
                        const ourLeague = $(this).text().replace(/\s+/g, ' ').trim();
                        return ourLeague === leagueCompare
                            || locutus_similar_text(ourLeague, leagueCompare, true) >= 80;
                    });
                    if ($leagueRes.length === 0) {
                        throw `League '${leagueCompare}' not found :(`;
                    }
                    $leagueRes[0].scrollIntoView(true);
                    if ($leagueRes.closest('div.category-container').hasClass('collapsed')) {
                        await delayPromise(300);
                        await mouseChain({
                            target: $leagueRes.closest('tr').find('td.collapse-button')[0],
                            events: fullClick,
                            error: '$leagueRes',
                            scroll: true
                        });
                    }
                } else {
                    // Otherwise, open the leagues sequentially until find ours
                    const $l = $('div.category-container.collapsed').first();
                    if ($l.find('td.collapse-button').length > 0) {
                        await delayPromise(300);
                        await mouseChain({
                            target: $l.find('td.collapse-button')[0],
                            events: fullClick,
                            error: `$l.length`,
                            scroll: true
                        });
                    } else {
                        break;
                    }
                }
                await delayPromise(1000);
            }
        } while (Date.now() - findStarted <= 60000);
        throw 'Event not found :(';
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
            await closeAllWeNeed({
                'button span:textEquals("Accept")': 'button span:textEquals("Accept")',
                'button span:textEquals("Close")': 'button span:textEquals("Close")',
            });
            if (!!isBy) {
                const $languageMenu = await waitForElement('span.language-menu__icon',333,7777).catch(() => $([]));
                if ($languageMenu.hasClass('marathon_icons-COUNTRY_GB') === false) {
                    await selectEngLang();
                }
            }
            const logSel = isCupis ? 'input[placeholder="Логин:"]' : 'input[placeholder="Login:"]';
            if (!doNotLogin && typeof Cookies.get("PUNTER_KEY_EXISTS") === 'undefined') {
                port.postMessage({m: "tech works!"});
                if ($(logSel).length === 1) {
                    await tryToLogIn(logSel);
                }
            } else {
                if (!ignoreLimited && $('a[href="/en/idupload.htm"]:visible').length > 0) {
                    limited = true;
                }
                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                });
            }
        })()
            .catch(e => dLog('red', 'Mara', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    function getDateObj(months, currentTimeString) {
        const currentTime = currentTimeString.split(' ');
        const arrDate = currentTime[0].split('.');
        const shortYear = arrDate[2].replace(",", "");
        const year = '20' + shortYear;
        const month = months[parseInt(arrDate[1]).toString()];
        const time = currentTime[1];
        const gmt = currentTime[2].match(/\(([^)]+)\)/)[1];
        return {'day': arrDate[0], 'year': year, 'month': month, 'time': time, 'gmt': gmt}
    };

    function getBalance(returnNull) {
        const $b = $(['#header_balance>span span', '#header_balance span',
            'a.balance__value_main', 'div.balance__value_main',
            'div.punter-balance__value'].find(s => $(s).length > 0));
        if ($b.length > 0) {
            const bText = $b.text().trim();
            currency = $b.parent().text().indexOf('₽') > -1 || isCupis ? 'RUB' : 'EUR';
            return parseFloat(bText.replace(/[^\d.]/g, '').trim());
        } else {
            currency = '';
            return returnNull ? 'null' : 0;
        }
    };

    const tryToLogIn = async logSel => {
        const passSel = isCupis ? 'input[placeholder="Пароль:"]' : 'input[placeholder="Password:"]';
        const sels = [logSel, passSel,
            'button.login-form__submit'];
        let last;
        if (sels.some(sel => (last = sel, $(sel).length !== 1))) {
            throw `Inputs '${last}' does not exists!`;
        }
        await mouseChain({target: $(sels[0])[0], events: fullClick, error: 'els 0'});
        await clearAndSimulate($(sels[0])[0], settings.login);
        await delayPromise(500);
        await clearAndSimulate($(sels[1])[0], settings.password);
        await delayPromise(500);
        if ($(sels[0]).val() !== settings.login || $(sels[1]).val() !== settings.password) {
            throw `Wrong login or password input '${$(sels[0]).val()}' / '${$(sels[1]).val()}'`;
        }
        await delayPromise(1000);
        await mouseChain({target: $(sels[2])[0], events: fullClick, error: 'els 3'});
        await delayPromise(500);
        const $errorMessage = await waitForElement('p.auth-dialog__error-message', 333, 4444).catch(() => $([]));
        if ($errorMessage.length > 0) {
            enterError = true;
        }
        authClicked = Date.now();
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
            bsDebug(port, 'Command was set till unload:', ourCommand.get());
            bMess('MARATHONE_COMMAND', true)
                .set(ourCommand.get(), ourCommand.getAdded('increaseDelay') ? 150000 : 0);
        }
    }, true);

    function afterDOMLoaded() {
        port.postMessage({m: "PAGE LOADED!"});
        const checkCommandForRemovePossibility = c => ['qiwiEntered', 'skrillEntered', 'increaseDelay'].some(n => !c[n]);
        bMess('MARATHONE_COMMAND', true).check(40000)
            .then(async currentCommand => {
                if (currentCommand.results) {
                    betResults = currentCommand.results;
                    nextWasClicked = true;
                }
                if (checkCommandForRemovePossibility(currentCommand)) {
                    await bMess('MARATHONE_COMMAND', true).remove();
                }
                messageProcessor(currentCommand);
            })
            .catch(e => dLog('color: darkgrey', 'MTH', e));
    }

})();
