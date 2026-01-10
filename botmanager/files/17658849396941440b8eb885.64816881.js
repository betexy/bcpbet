(() => {
    'use strict';

    const isMain = window.self === window.top;

    let limited = false;
    let authClicked = 0;
    let authClickedTime = 0;
    let wasAuthCheck = false;
    let busy = false;
    let increaseDelay = false;
    let enterError = false;
    let sourceExpress = false;

    const profile = 'div[class*="UserMenu_root_"]:visible';
    const port = isMain ? chrome.runtime.connect({name: 'port_shuflle'})
        : {postMessage: (...args) => console.log(args)};
    const settings = {
        restartEvery: 1800000,
        authCheckInterval: 2000,
        url: 'https://shuffle.com',
        waitTillLoadingMs: 6000,
        maxWaitForBetStatus: 50000,
        login: '',
        password: '',
        maxWaitForScore: 60000,
        phone: '',
        email: '',
        uid: '',
        fork: {
            shoulder: 0,
            maxWait: 0,
            maxLosePercent: 0,
            minWinPercent: 0,
        },
        forkOnly: false,
        stake_fork: {},
        eventTimeLimit: 3600000,
        eventMaxBets: 3,
        betweenBets: 25000,
        hostname: document.location.hostname,
        newExpresses: false,
        source: {
            X: 531,
            Y: 532,
            Z: 533,
        },
        sourceRandom: 0,
        sourceDate: 0,
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

    const accordance = {
        'FOOTBALL': 'Футбол',
        'HOCKEY': 'Хоккей',
        'BASKETBALL': 'Баскетбол',
        'CYBERSPORT': 'cybersport',
    };

    // Define shadow root element
    const
        loginForm = 'div[class*="AuthModal_desktop_"]',
        loginLink = 'button[class*="Header_authButton_"]:textEquals("Login")';

    const $coupons = () => $('div[class*="BetSlipAddingView_collapse_"]:first div[data-testid="bet-slips"]');

    const getSourceRandom = () => {
        return Math.floor(Math.random() * 30) + 1;
    };

    const getCurrentSource = src => {
        if (src >= 1 && src <= 10) {
            return 'X';
        }
        if (src >= 11 && src <= 16) {
            return 'Y';
        }
        if (src >= 17 && src <= 18) {
            return 'XY';
        }
        if (src >= 19 && src <= 20) {
            return 'Z';
        }

        return 'skip';
    };

    function getBalance(returnNull) {
        const $b = $('span[data-testid="balance"]');
        return $b.length === 0
            ? (typeof returnNull === 'boolean' && returnNull ? null : 0)
            : parseFloat($b.trt().replace(/[^\d.]/g, ''));
    };

    const selectCurrencyMega = async () => {
        if ($('button#balance-button img[alt="USDT"]').length === 0) {
            await mouseChain({target: $('button#balance-button')[0], events: fullClick, error: 'BALANCE BTN'});
            await waitForElement('button[data-testid="currency-USDT"]', 333, 5555);
            await mouseChain({target: $('button[data-testid="currency-USDT"]')[0], events: fullClick, error: 'USDT'});
        }
    };

    const authCheck = () => {
        (async () => {
            if (enterError === true) {
                return;
            }
            await closeAllWeNeed({
                'button[class*="ButtonVariants_root__"]:textEquals("Accept")': 'button[class*="ButtonVariants_root__"]:textEquals("Accept")',
            });
            
            const $profile = await waitForElement(profile, 222, 8888).catch(() => $([]));
            if (!limited && $profile.length === 0) {
                wasAuthCheck = false;
                port.postMessage({m: "tech works! 2"});
                await tryToLogin();
            } else {
                await selectCurrencyMega();

                if (settings.lastScoreBasketball === '999') {
                    if (Date.now() - settings.sourceDate >= 300000) {
                        settings.sourceDate = Date.now();
                        settings.sourceRandom = getSourceRandom();
                        dLog('blue', 'SHUFLLE', `Source current random value - ${settings.sourceRandom}`);
                    }
                }

                port.postMessage({
                    m: "authorized!",
                    balance: getBalance(true),
                    limited: limited
                });
            }
        })()
            .catch(e => dLog('red', 'SHUFLLE', `authCheck: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck());
    };

    const tryToLogin = async () => {
        if (Date.now() - authClickedTime < 60000) {
            throw 'too soon!';
        }

        if ($(loginForm).length === 0) {
            await mouseChain({target: $(loginLink)[0], events: fullClick, error: 'Log in'});
            await delayPromise(333);
        }
        await waitForCondition(() => $(loginForm).length > 0,
            333, 10000, 'No login form');
        await clearAndSimulate($(loginForm).find('input[name="username"]')[0],
            settings.login);
        await delayPromise(777);
        await clearAndSimulate($(loginForm).find('input[name="password"]')[0],
            settings.password);
        await delayPromise(777);
        await mouseChain({
            target: $(loginForm).find('button[type="submit"]')[0],
            events: fullClick,
            error: 'submit form'
        });
        await delayPromise(555);
        const $profile = await waitForElement(profile,
            333, 27000).catch(() => $([]));
        await delayPromise(333);
        authClicked++;
        authClickedTime = Date.now();
        dLog('green', 'SHUFLLE', `Auth clicked ${authClicked}!`);
        if ($profile.length === 0) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            enterError = true;
            limited = true;
            throw 'AUTH ERROR!';
        }
    };

    const closePreviousCoupons = async (state) => {
        const $closeCoupon = $('button:textEquals("Clear bets")');
        const $closeBtns = () => $('button[class*="BetTitleHeader_removeButton_"]');
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
    };

    const checkEventName = (eventNameIn, controlNameIn) => {
        const
            eventName = eventNameIn.toLowerCase(),
            controlName = controlNameIn.toLowerCase(),
            res = eventName === controlName
                || locutus_similar_text(eventName, controlName, true) > 65;
        dLog('green', 'SHUFLLE', `Event name '${eventName}' ${res ? '==' : '!='} '${controlName}'`);
        return res;
    };

    const openEvent = async data => {
        dLog('red', 'SHUFLLE', ['openEvent', data]);
        const 
            eventName =
                `${data.team1.replaceAll(/\(.*\)/g, '').trim()} vs ${data.team2.replaceAll(/\(.*\)/g, '').trim()}`
                .toLowerCase(),
            sport = accordance[data.sport],
            events = 'a[class*="SearchResultGameTile_root_"]';

        if (!sport) {
            throw 'No sport found!';
        }

        const checkWeAreThere = function () {
            const
                teamsLink = data.type === 'LIVE' 
                    ? 'CompetitorSection_teamName_' 
                    : 'PreLiveCompetitor_preLiveCompetitorName_',
                $teams = $(`span[class*="${teamsLink}"]`),
                team1 = $teams.eq(0).trt(),
                team2 = $teams.eq(1).trt(),
                checkEvent = `${team1} - ${team2}`;
            return checkEvent.length > 5 && checkEventName(checkEvent, eventName);
        };
        
        if (checkWeAreThere()) {
            return 'We probably on event page!';
        }

        const findEvent = async () => {
            let $el = $([]);
            const searchInput = 'input[class*="Searchinput_inputFilter_"]';

            if ($(searchInput).length === 0) {
                await mouseChain({
                    target: $('button[class*="SearchComponent_searchButton_"]:visible')[0], 
                    events: fullClick, 
                    error: '$searchButton',
                });
                await waitForElement(searchInput, 333, 7777);
            }

            await ($(searchInput)[0].dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:(()=>{try{const d=new DataTransfer();d.setData('text/plain',String(eventName));return d;}catch(_){return {getData:()=>String(eventName)}}})()})),($(searchInput)[0].value!==String(eventName))&&(($(searchInput)[0].value=String(eventName)),$(searchInput)[0].dispatchEvent(new Event('input',{bubbles:true})),$(searchInput)[0].dispatchEvent(new Event('change',{bubbles:true}))),Promise.resolve());

            await waitForElement(events, 333, 17777);
            await delayPromise(333);

            $(events).each(function () {
                const checkEvent = $(this).find('p[class*="SearchResultGameTile_matchVs_"]').trt();
                dLog('blue', 'SHUFLLE', `Check: '${checkEvent}' === '${eventName}'`);
                if (checkEventName(checkEvent, eventName)) {
                    $el = $(this);
                    return false;
                }
            });

            return $el;
        };

        const $event = await findEvent();

        if ($event.length === 0) {
            throw 'Event not found!';
        }

        // go to event page
        await mouseChain({target: $event[0], events: fullClick, error: 'EVENT', scroll: true,});
        await waitForCondition(checkWeAreThere,
            500, 15000, 'We are not on event!');
        await delayPromise(222);

        return 'Switched to event!';
    };

    const openCoupon = async paramData => {
        dLog('green', 'SHUFLLE', ['openCoupon, paramData:', paramData]);
        for (let i = 0; i < paramData.length; i++) {
            const data = paramData[i];
            dLog('green', 'SHUFLLE', [`openCoupon ITERATION ${i}- we using data ${(typeof data)}:`, data]);
            await openEvent(data);
            dLog('green', 'SHUFLLE', 'Event must be opened!');
            const $element = await getBetElement(data);
            await mouseChain({target: $element[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(333);
        }

    };

    const getBetElement = async betIn => {
        const bet = JSON.parse(JSON.stringify(betIn));
        //#-#-START
        const markets = {
            'ONE_TWO': {
                'ONE': {
                    tabs: ['Win'],
                    roots: ['1x2'],
                    pivotKeys: ['#TEAM1#'],
                },
                'TWO': {
                    tabs: ['Win'],
                    roots: ['1x2'],
                    pivotKeys: ['#TEAM2#'],
                },
                'DRAW': {
                    tabs: ['Win'],
                    roots: ['1x2'],
                    pivotKeys: ['Draw'],
                },
                'ONE_DRAW': {
                    tabs: ['Win'],
                    roots: ['Double chance'],
                    pivotKeys: ['#TEAM1# or draw'],
                },
                'TWO_DRAW': {
                    tabs: ['Win'],
                    roots: ['Double chance'],
                    pivotKeys: ['Draw or #TEAM2#'],
                },
                'ONE_TWO': {
                    tabs: ['Win'],
                    roots: ['Double chance'],
                    pivotKeys: ['#TEAM1# or #TEAM2#'],
                }
            },
            'TOTAL': {
                'OVER': {
                    tabs: ['Totals'],
                    roots: ['Total'],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Totals'],
                    roots: ['Total'],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tabs: ['Totals'],
                    roots: ['#TEAM1# total'],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Totals'],
                    roots: ['#TEAM1# total'],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tabs: ['Totals'],
                    roots: ['#TEAM2# total'],
                    pivotKeys: ['#PIVOT#'],
                },
                'UNDER': {
                    tabs: ['Totals'],
                    roots: ['#TEAM2# total'],
                    pivotKeys: ['#PIVOT#'],
                },
            },
            'HDP': {
                'HOME': {
                    tabs: ['Handicap'],
                    roots: ['Handicap'],
                    pivotKeys: ['#HPIVOT#'],
                },
                'AWAY': {
                    tabs: ['Handicap'],
                    roots: ['Handicap'],
                    pivotKeys: ['#HPIVOT#'],
                }
            },
        };
        if (typeof markets[bet.market] === 'undefined' || typeof markets[bet.market][bet.target] === 'undefined') {
            throw `Unsupported ${bet.time_value} / ${bet.market} / ${bet.target}`;
        }

        let $found = $([]);
        const params = new AllMarkets(bet);
        params.proceed_football = function () {
            if (this.full) {
                return;
            }
            this.addTotal('tabs', ['Half']);
            this.addToEl('roots', '1st half - ', true);
        };
        params.proceed_basketball = function (bet) {
            if (!this.full && ['HALF_1', 'TIME_1', 'HALF_TIME'].indexOf(bet.time_value) > -1) {
                this.addTotal('tabs', ['Half']);
                this.addToEl('roots', '1st half - ', true);
            } else if (!this.full) {
                this.addTotal('tabs', ['Quarter']);
                const
                    q1 = '1st quarter - ',
                    q2 = '2nd quarter - ',
                    q3 = '3rd quarter - ',
                    q4 = '4th quarter - ',
                    quarters = [q1, q2, q3, q4],
                    quarter = quarters[this.tDigit - 1];
                this.addToEl('roots', quarter, true);
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addReplIn('roots', '1x2', 'Winner (incl. overtime)');
                } else if (bet.market === 'HDP') {
                    this.addReplIn('roots', 'Handicap', 'Handicap (incl. overtime)');
                } else if (bet.market === 'TOTAL') {
                    this.addReplIn('roots', 'Total', 'Total (incl. overtime)');
                } else if (bet.market === 'T1_TOTAL') {
                    this.addReplIn('roots', '#TEAM1# total', '#TEAM1# total (incl. overtime)');
                } else if (bet.market === 'T2_TOTAL') {
                    this.addReplIn('roots', '#TEAM2# total', '#TEAM2# total (incl. overtime)');
                }
            }
        };
        params.proceed_hockey = function (bet) {
            if (!this.full) {
                const
                    p1 = '1st period - ',
                    p2 = '2nd period - ',
                    p3 = '3rd period - ',
                    periods = [p1, p2, p3],
                    period = periods[this.tDigit - 1];
                this.addTotal('tabs', ['Period']);
                this.addToEl('roots', period, true);
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addTo('roots', 'Winner (incl. overtime and penalties)');
                } else if (bet.market === 'HDP') {
                    this.addTo('roots', 'Handicap (incl. overtime and penalties)');
                } else if (bet.market === 'TOTAL') {
                    this.addTo('roots', 'Total (incl. overtime and penalties)');
                } else if (bet.market === 'T1_TOTAL') {
                    this.addTo('roots', '#TEAM1# total (incl. overtime and penalties)');
                } else if (bet.market === 'T2_TOTAL') {
                    this.addTo('roots', '#TEAM2# total (incl. overtime and penalties)');
                }
            }
        };
        params.proceed_cybersport = function (bet) {
            if (!this.full) {
                this.addTotal('tabs', [`Map ${this.tDigit}`]);
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('roots', [`Map ${this.tDigit} Winner - Twoway`, `Map ${this.tDigit} Winner - Threeway`]);
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', [`Total Kills - Map ${this.tDigit}`, `Total Rounds - Map ${this.tDigit}`]);
                } else if (bet.market === 'HDP') {
                    this.addTotal('roots', [`Map Kills Handicap - Map ${this.tDigit}`, `Round Handicap - Map ${this.tDigit}`]);
                } else if (bet.market === 'T1_TOTAL') {
                    this.addTotal('roots', [`Home Total Kills - Map ${this.tDigit}`, `Home Total Rounds - Map ${this.tDigit}`]);
                } else if (bet.market === 'T2_TOTAL') {
                    this.addTotal('roots', [`Away Total Kills - Map ${this.tDigit}`, `Away Total Rounds - Map ${this.tDigit}`]);
                }
            } else {
                if (bet.market === 'ONE_TWO') {
                    this.addTotal('tabs', ['Winner']);
                    this.addTotal('roots', ['Match Winner - Twoway']);
                } else if (bet.market === 'HDP') {
                    this.addTotal('roots', ['Match Kills Handicap']);
                } else if (bet.market === 'TOTAL') {
                    this.addTotal('roots', ['Match Total Kills']);
                } else if (bet.market === 'T1_TOTAL') {
                    this.addTotal('roots', ['Match Home Total Kills']);
                } else if (bet.market === 'T2_TOTAL') {
                    this.addTotal('roots', ['Match Away Total Kills']);
                }
            }
        };
        const final = applyAllMarkets(bet, ['roots', 'pivotKeys', 'tabs'], params, markets, true);
        const m = final[bet.market][bet.target];
        const hPivot = pvt => {
            return parseFloat(pvt) === 0 ? '0' : parseFloat(pvt) > 0 ? `+${pvt}` : pvt;
        };

        if (['HDP', 'TOTAL'].indexOf(bet.market) > -1
            && parseInt(bet.pivot.toString()) === parseFloat(bet.pivot.toString())) {
            m.pivotKeys.push(m.pivotKeys[0] + '.0');
        }

        const $findPivot = $root => {
            let $res = $([]);
            for (const pvt of m.pivotKeys) {
                console.log(`Checking pivot: '${pvt}'`);
                if (bet.market === 'ONE_TWO') {
                    if (
                        $root
                        .find(`p[class*="SportsBetSelectionButton_selectionName_"]:textEqualsI("${pvt}")`)
                        .length > 0
                    ) {
                        $res = $root.find(`p[class*="SportsBetSelectionButton_selectionName_"]:textEqualsI("${pvt}")`);
                        break;
                    }
                } else {
                    const idx = ['OVER', 'HOME'].indexOf(bet.target) > -1 ? 0 : 1;
                    console.log('idx ', idx)
                    console.log('RI ', $root.find(`div[class*="LadderMarketLayout_selections_"]:eq(${idx})`))
                    $res = $root.find(`div[class*="LadderMarketLayout_selections_"]:eq(${idx})`)
                        .find(`p[class*="SportsBetSelectionButton_selectionName_"]:textEqualsI("${pvt}")`);
                }
            }

            return $res;
        };

        replaceInner(m, {
            '#TEAM1#': bet.team1,
            '#TEAM2#': bet.team2,
            '#PIVOT#': bet.pivot,
            '#HPIVOT#': hPivot(bet.pivot),
        });

        dLog('green', 'SHUFLLE', ['Final market is:', m]);
        await waitForElement('div[class*="SportsMarketCollapse_subCollapseRoot_"]', 333, 9999);

        //select tab
        if (!$(`button[class*="TabView_tab_"]:textEquals("${m.tabs[0]}")`).prop('disabled')) {
            await mouseChain({
                target: $(`button[class*="TabView_tab_"]:textEquals("${m.tabs[0]}")`)[0],
                events: fullClick,
                error: `click tab ${m.tabs[0]}`
            });
            await waitForElement('div[class*="SportsMarketCollapse_subCollapseRoot_"]', 333, 9999);
            await delayPromise(555);
        }

        for (const root of m.roots) {
            console.log(`Checking root: ${root}`);
            const $root = () => $(`span[class*="MarketCollapseHeader_title_"]:textEqualsI("${root}")`)
                .closest('div[class*="SportsMarketCollapse_subCollapseRoot_"]');
            if ($root().length === 0) {
                console.log(`No root ${root}`);
                continue;
            }
            // expand All
            if ($root().find('button[class*="LadderMarketLayout_button_"]:textEquals("Show All")').length > 0) {
                await mouseChain({
                    target: $root().find('button[class*="LadderMarketLayout_button_"]:textEquals("Show All")')[0], 
                    events: fullClick, 
                    error: 'Show All'
                });
                await delayPromise(2222);
            }

            $found = $findPivot($root());
            if ($found.length > 0) {
                break;
            }
        }

        if ($found.length === 0) {
            throw `${bet.sport}/${bet.type}/${bet.time_value}/${bet.market}/${bet.target}/${bet.pivot} not found :(`;
        }
        $found.get(0).scrollIntoView();
        window.scrollBy(0, -100);
        return $found;
        //#-#-FINISH
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v => checkEventName(v.team1.toLowerCase()
            + ' vs ' + v.team2.toLowerCase(), match));
        await waitForCondition(() => 
            ($coupons().find('span[class*="BetTitleHeader_betTicketGameName_"]').length > 0
                && $coupons().find('span[class*="Odds_oddsWrapper_"]').length > 0),
            333, 10000, 'No coupons!');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        const $couponsCoefs = (data.length === 1 && settings.newExpresses === true)
            ? $coupons().last()
            : $coupons();
        $couponsCoefs.each(function () {
            const $this = $(this);
            const match = $this.find('span[class*="BetTitleHeader_betTicketGameName_"]').trt();
            let localCoef = $this.find('span[class*="Odds_oddsWrapper_"]').trt();
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

    const ProccedExpressNew = async () => {
        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));
        let coefsel = 'div[data-editor-id="outcomePlateName"] + div';
        const $coefs = (sel) => $(shadowRoot()).find(sel);
        const $events = () => $(shadowRoot()).find('div[data-editor-id="eventCard"]');
        const currentBets = [];

        if ($(shadowRoot()).find('div[data-editor-id="quickSearchField"] input').length === 0) {
            // go to builder tab
            if (document.location.href.indexOf('event-builder') === -1) {
                const $builderBtn = () => $(shadowRoot()).find('div[data-editor-id="headerNavigationButton"]:textEquals("Event Builder")');
                const builderBtnExist = await waitForCondition(() => $builderBtn().length > 0, 333, 15000).catch(() => $([]));

                // go to sport page
                if (builderBtnExist.length === 0) {
                    window.location.href = 'https://roobet.com/sports/';
                    await waitForCondition(() => $builderBtn().length > 0,
                        333, 22222, 'No $builderBtn!');
                }

                await mouseChain({target: $builderBtn()[0], events: fullClick, error: '$builderBtn'});
                await waitForCondition(() => $events().length > 0,
                    333, 22222, 'No builder events!');
            }
            
            if ($(shadowRoot()).find('div[data-editor-id="pillButton"]:eq(1) > div:textEquals("24h")').length === 0) {
                await mouseChain({target: $(shadowRoot()).find('div[data-editor-id="pillButton"]:eq(1)')[0], events: fullClick, error: 'timer select'});
                await delayPromise(2222);
                await mouseChain({target: $(shadowRoot()).find('div.simplebar-content > div > div:eq(1)')[0], events: fullClick, error: 'select 24'});
                await delayPromise(1111);
                await mouseChain({target: $(shadowRoot()).find('div[data-editor-id="pillButton"]:eq(1)')[0], events: fullClick, error: 'timer select close'});
                await waitForCondition(() => $events().length > 0,
                    333, 7777, 'No builder events24!');
            }
        } else {
            //coefsel = 
            await mouseChain({target: $(shadowRoot()).find('a[href="/"]')[0], events: fullClick, error: 'featured'});
            await delayPromise(555);
            await waitForCondition(() => $(shadowRoot()).find('div[label="Soccer"]').length > 0,
                222, 9999, 'Soccer label');
            await mouseChain({target: $(shadowRoot()).find('div[label="Soccer"]')[0], events: fullClick, error: 'Soccer click'});
            await delayPromise(1111);
            await waitForCondition(() => $(shadowRoot()).find('div.bt27').length > 0,
                222, 9999, 'Soccer label');
            await delayPromise(1111);
        }

        

        const findOption = coef => {
            return isNaN(coef) ? false : coef >= 1.01 && coef <= 1.15;
        };

        const getUniqueRandomNumber = (length) => {
            return Math.floor(Math.random() * length);
        }

        do {
            const randomCoef = getUniqueRandomNumber($coefs().length);
            const eventName = $coefs().eq(randomCoef)
                .closest('div[data-editor-id="eventCard"]')
                .find('div[style="height: 24px; line-height: 24px;"]').toArray()
                .map(el => $(el).trt()).join(' - ');

            if (currentBets.indexOf(eventName) > -1) {
                continue;
            }

            if (eventName.length < 5) {
                dLog('red', 'SHUFLLE', `'${eventName}' is too short - ${eventName.length}`);
                continue;
            }

            if (used[eventName] >= 1) {
                dLog('big-yellow', 'SHUFLLE', `${eventName} used ${used[eventName]} times!`);
                continue;
            }

            if (
                $coefs().eq(randomCoef)
                .closest('div[data-editor-id="outcomePlate"] > div')
                .hasClass('null')
            ) {
                continue;
            }

            if (!findOption(parseFloat($coefs().eq(randomCoef).trt()))) {
                continue;
            }

            currentBets.push(eventName);
            await mouseChain({target: $coefs().eq(randomCoef)[0], events: ['click'], error: 'EVENT'});
            await delayPromise(2555);
        } while ($coupons().length < settings.newExpressBetsAmount);

        // check 2 events
        if ($coupons().length === settings.newExpressBetsAmount 
            && currentBets.length === settings.newExpressBetsAmount
        ) {
            dLog('green', 'SHUFLLE', [`We get selected bets: '${currentBets}', now used:`, used]);
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

    const proceedBet = async (data, command) => {
        const
            realSuccessInterval = data[0].successBetInterval || settings.betweenBets,
            wasSuccessStake = await bMess('WasSuccessStake')
                .check(realSuccessInterval)
                .catch(() => 0),
            successDiff = Date.now() - wasSuccessStake;
        if (successDiff < realSuccessInterval) {
            throw `To early after previous success bet ${successDiff} instead of ${realSuccessInterval}!`
        }
        if (command === 'BET' && !!currentBetData.data[0].betFromParser) {
            const eventName = `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`;
            if (!await eventsWork('SHUFLLE', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'SHUFLLE',
                    `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                    + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
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

        let willPlace = parseFloat(data[0].stake);
        const checkSuccess = async () => {
            // Please wait while your bet is placed
            await waitForCondition(() => 
                $('div[class*="BetMessage_betMessageBase_"]:textEquals("Your bets have been accepted")').length > 0,
                333, 45000, 'No success!'
            );
            return $('div[class*="BetMessage_betMessageBase_"]:textEquals("Your bets have been accepted")').length;
        };
        const checkBalance = async willPlace => {
            const balance = getBalance();
            if (balance < willPlace) {
                throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
            } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
                throw 'Undefined or NaN will place';
            }
        };

        if (!willPlace) {
            throw`Bad will place: ${willPlace}, ${data[0].stake}`;
        }

        await checkBalance(willPlace);
        await closePreviousCoupons(settings.newExpresses ? true : false);
        await delayPromise(555);
        await openCoupon(data);

        //if sourceExpress check coupon for events
        if (sourceExpress && settings.lastScoreBasketball === '999') {
            if ($coupons().length !== 1) {
                throw 'Error Express source BET, No 1 event in coupon!';
            }
        }

        if (settings.newExpresses && $coupons().length < settings.newExpressBetsAmount + 1) {
            throw `less than ${settings.newExpressBetsAmount + 1} events in the newExpresses`;
        }

        do {
            await checkCoefs(data);
            const place = willPlace.toString().replace('.00', '').trim();
            const $input = () => $('input[placeholder="Enter stake"]:last');
            dLog('green', 'SHUFLLE', `Will place (performBet): ${place}`);

            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }

            if (parseFloat($input().val()) !== parseFloat(place)) {
                await clearAndInputNumber($input()[0], place);
                await delayPromise(555);
                dLog('green', 'SHUFLLE', `STAKE entered ${willPlace}`);
            }

            const entered = parseFloat($input().val());
            dLog('green', 'SHUFLLE', `After enter stake check: willPlace = ${willPlace}, entered: ${entered}`);
            if (isNaN(entered) || willPlace !== entered) {
                dLog('red', 'SHUFLLE', 'Entered !== willPlace - try to reenter!');
                continue;
            }

            const $placeBtn = $('button[data-testid="place-bet-button"]');

            if ($placeBtn.length === 0) {
                throw 'No place button or button disabled!';
            }

            await delayPromise(555);
            await mouseChain({target: $placeBtn[0], events: fullClick, error: '$placeBtn'});
        } while (!await checkSuccess());

        await delayPromise(555);
        await mouseChain({
            target: $('div[class*="BetPlacePanel_collapseBody_"] button[class*="BetTitleHeader_viewDetailBtn_"]:visible')[0],
            events: fullClick,
            error: 'open bet modal'
        });
        await delayPromise(555);
        await waitForCondition(() => 
            ($('span[class*="BetSlipModalHeader_betId_"]').length > 0
                && $('div[class*="BetInfoContainer_ready_"]').find('p:textEquals("Total Odds")').next().length > 0), 
            333, 10000, 'no open bet modal');
        await delayPromise(777);

        const response = {
            success: true,
            message: {
                external_id: $('span[class*="BetSlipModalHeader_betId_"]').trt(),
                coef: $('div[class*="BetInfoContainer_ready_"]').find('p:textEquals("Total Odds")').next().trt(),
                stake: $('div[class*="BetInfoContainer_ready_"]').find('p:textEquals("Your Stake")').next().trt(),
                max: '7777777',
            },
        };

        await mouseChain({
            target: $('button#close-modal')[0],
            events: fullClick,
            error: 'close bet modal'
        });
        await delayPromise(1555);
        await mouseChain({
            target: $('div[class*="DesktopNavigation_sidebarHeader_"] a[href="/sports?section=featured"]')[0],
            events: fullClick,
            error: 'close bet modal'
        });
        await delayPromise(333);

        return response;
    };

    const commands = new class commands {
        constructor() {
            this.cLinks = {
                'BET': proceedBet,
                'EXPRESS_BET': proceedBet,
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
            dLog(res.success ? 'green' : 'red', 'SHUFLLE',
                `${command} result: ${res.message}`);
            await port.postMessage(await this.prepareResult(command, res));
            if (!res?.success) {
                throw res?.message || 'Unknown error';
            }
            return res;
        }

        async prepareResult(command, res) {
            dLog('', 'SHUFLLE', [`prepareResult '${command}':`, res, currentBetData,]);
            if (['BET', 'EXPRESS_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('SHUFLLE', settings,
                        `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`,
                        true, false);
                    await bMess('WasSuccessStake').set(Date.now());
                    await storeBet(res.message.stake, true);
                    await bMess('Stake Maximums').set(0);

                    if (settings.newExpresses) {
                        // Hint: currentFirstBet MUST exists, otherwise some shit happened!
                        await bMess('WasSuccessExpressNew').set(false);
                        const currentFirstBet = await bMess('currentFirstBet').check(1080000, true);
                        const used = await bMess('usedEvents').check(1080000).catch(() => ({}));

                        if (!used[currentFirstBet]) {
                            used[currentFirstBet] = 1;
                        }

                        dLog('SHUFLLE', 'blue-big',
                            [`We set bet with first: '${currentFirstBet}', now used:`, used]);

                        if (settings.newExpressBetsAmount > 1) {
                            const currentSecondBet = await bMess('currentSecondBet').check(1080000, true);
                            if (!used[currentSecondBet]) {
                                used[currentSecondBet] = 1;
                            }

                            dLog('SHUFLLE', 'blue-big',
                            [`We set bet with second: '${currentSecondBet}', now used:`, used]);
                        }

                        await bMess('usedEvents').set(used);
                    }
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
                if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'SHUFFLE';
                    resultData.placedCoef = resultData.coef;
                    resultData.coef = currentBetData.data[0].coef;
                    resultData.source = '531' || 'oddscp';
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
                return {
                    answered: !!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED'
                        ? "F_BET" : "BET",
                    data: resultData,
                    answer: res.success ? 'Everything is Okay!' : res.message,
                    doNotSend: !!currentBetData.data[0].betFromParser && !res.success,
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
    };

    const messageProcessor = (message, direct) => {
        console.log('%c' + `${(direct ? 'Direct' : 'Saved')} : messageProcessor (${busy}) %O`,
            `background: ${(direct ? 'green' : 'yellow')}; color: ${(direct ? 'white' : 'black')}; font-size: 12px; font-weight: bold; padding: 3px;`,
            message);
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY' : 'FREE'
            });
            return;
        }
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
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.fork = message.fork;
            settings.forkOnly = typeof message.fork === 'object' && Object.keys(message.fork).length > 0;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            settings.lastScoreBasketball = message?.stake_fork?.lastScoreBasketball || '';
            settings.newExpresses = !!(settings?.stake_fork && settings.stake_fork?.newExpresses);
            settings.newExpressBetsAmount = Number(message?.stake_fork?.newExpressBetsAmount) || 2;
            ['login', 'password', 'phone', 'email', 'uid',].forEach(k => settings[k] = message[k]);
            if (message.start_url) {
                settings.url = message.start_url;
            }
            if (settings.lastScoreBasketball === '999') {
                settings.sourceDate = Date.now();
                settings.sourceRandom = getSourceRandom();
                dLog('blue', 'SHUFLLE', `Source current random value - ${settings.sourceRandom}`);
            }
            dLog(`yellow`, 'SHUFLLE', [`messageProcessor auth settings:`, settings,]);
            authCheck();
            wasAuthCheck = true;
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
                answer: `Unsupported action: ${message.action}!`
            });
        }
    };

    function afterDOMLoaded() {
        (async () => {
            const command = await bMess('SHUFLLE').check(40000);
            await waitForCondition(() => !isMain || (typeof wasAuthCheck === 'boolean' && wasAuthCheck), 333, 60000, 'No auth check!');
            bsLogger('green', 'SHUFLLE', [`Restoring with (${isMain}): `, command]);
            messageProcessor(command, false);
        })()
            .catch(e => console.log(e));
        port.postMessage({m: "PAGE LOADED!"});
        console.log('%c' + `SHUFLLE loaded and message sent! (${isMain}) ${document.location.href}`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", async () => {
        await ourCommand.save('SHUFLLE', increaseDelay ? 150000 : 0);
        bsLogger('green', 'SHUFLLE', [`Command was set till unload (${isMain}):`, ourCommand.get()]);
    }, true);

    if (port.onMessage) {
        port.onMessage.addListener(function (message) {
            messageProcessor(message, true);
        });
    }

})();
