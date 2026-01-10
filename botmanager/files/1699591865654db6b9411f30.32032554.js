const t1s2t3 = (function () {

    if (window.self !== window.top) {
        return;
    }

    "use strict";

    const
        TEN_MINUTES = 600000,
        ONE_HOUR = 3600000;

    let
        busy = false,
        increaseDelay = false,
        authClicked = 0,
        //
        enterError = false,
        invalidCredentials = false,
        registerProcess = false,
        //
        ourCurrency = '',
        switchingCurrency = false,
        authCheckStarted = 0,
        lastAuthCheck = 0,
        fillUpStarted = false,
        authorized = false,
        bscAddress = '',
        waitForCaptchaSolved = 100000,
        eventsPeriod = 7200000,
        tryingToLogIn = 0,
        weAreSurePageLoaded = false,
        limited = false,
        limitedSend = false,
        limitedReason = '',
        registerUsernameError = false,
        stopWaitForStatus = false,
        globalStatus = '',
        authCheckMaximumsSilenceInterval = 30,
        proceedTaCActive = false,
        possibleMaximums = 25;

    /**
     * Using local storage (total 22 (including 5 below), real: 17):
     * bMess('registerUsernameError' - 5 use
     * bMess('zenit' - 2 uses
     * bMess('stakeDepositRequest' - 2 use
     * bMess('STAKE_AlreadyRegistered' - 3 use
     * bMess('WasSuccessStake' - 2 use
     * bMess('Maximums sent' - 3 use
     * bMess('Stake Maximums' - 4 use
     */

    const sureSelectors = ['button[data-test="login-link"]', 'button[data-test="coin-toggle"]'];

    const setEnterError = (value, source) => {
        enterError = value;
        dLog('red', 'zenit', `setEnterError: ${value} from ${source}`);
    };

    const setInvalidCredentials = (value, source) => {
        invalidCredentials = value;
        dLog('red', 'zenit', `setInvalidCredentials: ${value} from ${source}`);
    };

    const port = chrome.runtime.connect({name: 'port_zenit'});

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
    };

    const ourCommand = new ourCommandProto();

    const currentBetData = new class CurrentBetData {
        constructor() {
            this.init([]);
        }

        init(data) {
            this.data = JSON.parse(JSON.stringify(data));
            this.max = 0;
            this.external_id = '';
            this.willPlace = 0;
        }
    };

    const checkLanguage = async () => {
        await delayPromise(100);
        const $lt = $('button[data-test="language-toggle"]').first();
        if ($lt.length > 0 && $lt.trt().length > 0 && $lt.trt() !== 'English') {
            dLog('blue', 'zenit', `switching language from ${$lt.trt()}/${$lt.trt().length}!`);
            await mouseChain({target: $lt[0], events: fullClick, error: '$lt', scroll: true});
            await delayPromise(250);
            const $e = await waitForElement('button[data-test="language-toggle-locale-en"]',
                200, 10000, true);
            await delayPromise(100);
            await mouseChain({target: $e[0], events: fullClick, error: '$e', scroll: true});
        }
    };

    let pingForkInterval = null;
    const pingFork = () => {
        if (!settings.forkOnly) {
            return;
        }
        pingForkInterval = setInterval(() => {
            port.postMessage({
                m: "authorized!",
                balance: getBalance(true),
                forkFree: !busy && authorized,
            });
        }, 500)
    };

    const checks = async () => {
        await checkLanguage();
        if ($('div[data-test="left-sidebar"]').width() < 200) {
            await mouseChain({
                target: $('div[data-test="left-sidebar"] button').first()[0],
                events: fullClick,
                error: 'left-sidebar'
            });
            dLog('blue', 'zenit', 'left sidebar expanded!');
        }
        const $refresh = $('div[data-notification-name="refresh"]');
        if ($refresh.length > 0) {
            document.location.reload();
        }
        const $accept = $('button[data-test="accept-cookie-consent"]');
        if ($accept.length > 0) {
            await mouseChain({target: $accept[0], events: fullClick, error: '$accept'});
            dLog('blue', 'zenit', 'accept clicked!');
            await delayPromise(300);
        }
        const $bad = $('div[data-test="notification"]:contains("session has expired")');
        if ($bad.length > 0) {
            await mouseChain({
                target: $('button[data-test="user-dropdown-toggle"]')[0],
                events: fullClick, error: 'user-dropdown-toggle'
            });
            await delayPromise(300);
            const $bd = await waitForElement('button.variant-dropdown:contains("Logout")',
                333, 3000);
            await mouseChain({target: $bd[0], events: fullClick, error: '$bd'});
            await delayPromise(300);
            const $dg = await waitForElement('button.variant-danger:contains("Logout")',
                333, 3000);
            await mouseChain({target: $dg[0], events: fullClick, error: '$dg'});
            dLog('blue', 'zenit', 'left bad work!');
        }
        const $ic = $('#intercom-container');
        if ($ic.length > 0) {
            $ic.remove();
        }
    };

    let onlyChecksShown = false;
    const onlyCheck = () => {
        if (authCheckStarted > 0) {
            dLog('orange', 'zenit', 'onlyCheck -> authCheckStarted!');
            return;
        }
        if (!onlyChecksShown) {
            dLog('orange', 'zenit', 'onlyCheck');
            onlyChecksShown = true;
        }
        checks()
            .catch(e => dLog('red', 'zenit', `onlyCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => {
                if (authCheckStarted > 0) {
                    dLog('orange', 'zenit', 'onlyCheck stopped, now authCheck');
                } else {
                    onlyCheck();
                }
            });
    };

    const authCheck = from => {
        if (from !== 'repeat') {
            dLog('yellow', 'zenit', `Auth check from: ${from}/${authCheckStarted}`);
        }
        //dLog('', 'zenit',
        //    `authCheck tick 0 => ${from}, limited: ${limited}, limitedSend: ${limitedSend}`);
        if (limited && !limitedSend) {
            busy = true;
            const m = {
                answered: 'WITHDRAW_LIMITED',
                answer: (limitedReason !== '' ? limitedReason : 'It looks like bot is') + ' WITHDRAW_LIMITED!',
                status: 'LIMITED',
                balance: getBalance(true),
                doNotSend: false,
            };
            port.postMessage(m);
            limitedSend = true;
            dLog('', 'zenit', ['authCheck: WITHDRAW_LIMITED send:', m]);
            return;
        } else if (limited && limitedSend) {
            busy = true;
            dLog('', 'zenit', `WITHDRAW_LIMITED, but the already sent it`);
            port.postMessage({m: "tech works! 2"});
            return;
        }
        if (!commands.wasRegister && enterError === true) {
            port.postMessage({
                answered: "auth_error",
                status: "ERROR",
            });
            dLog('red', 'zenit', 'ERROR AUTH!');
            return;
        }
        if (from !== 'repeat' && authCheckStarted > 0) {
            dLog('orange', 'zenit', `authCheck already started (${from})`);
            return;
        } else if (authCheckStarted === 0) {
            authCheckStarted++;
        }
        lastAuthCheck = Date.now();
        (async () => {
            weAreSurePageLoaded = !!findSel(sureSelectors);
            if (weAreSurePageLoaded) {
                await checks();
            }
            await proceedTaC(true);
            if (await bMess('registerUsernameError')
                .check(300, false, true)
                .catch(() => false)) {
                dLog('red', 'zenit', 'registerUsernameError');
                port.postMessage({
                    answered: "registerUsernameError",
                    status: "ERROR",
                });
                await delayPromise(90000000);
                return;
            }
            const $loginLink = () => $('button[data-test="login-link"]');
            //dLog('', 'zenit',
            //    `authCheck tick ${authCheckStarted}, ${$loginLink().length}/${weAreSurePageLoaded}`);
            if ($loginLink().length > 0) {
                // Hint: Log In
                authorized = false;
                port.postMessage({m: "tech works! 2"});
                if (!elementIsVisible($loginLink()[0])) {
                    dLog('', 'zenit', `authCheck start wait for login link visible!`);
                    await waitForCondition(() => elementIsVisible($loginLink()[0]),
                        100, 10000, 'Login link not visible!');
                }
                await delayPromise(1000);
                if ($closeModal().length === 0) {
                    await tryToLogIn();
                } else if ($closeModal(true).length > 0) {
                    dLog('', 'zenit', 'registration process or something like that');
                } else {
                    dLog('', 'zenit', 'it looks like Sign in form already shown');
                }
            } else if (weAreSurePageLoaded) {
                authorized = true;
                if (!ourCurrency && !switchingCurrency) {
                    dLog('', 'zenit', `authCheck wait for switchCurrency`);
                    await switchCurrency();
                    dLog('', 'zenit', `authCheck released from switchCurrency`);
                }
                // In case then pingForkInterval is not null, we send message from there
                if (settings.forkOnly && !pingForkInterval) {
                    pingFork();
                } else if (!settings.forkOnly) {
                    if (commands.wasRegister && getBalance() < 1 && !bscAddress) {
                        dLog('', 'zenit', `authCheck wait for fillUp`);
                        await fillUp('authCheck');
                        dLog('', 'zenit', `authCheck released from fillUp`);
                    }
                    const mess = {
                        m: "authorized!",
                        balance: getBalance(true),
                    }
                    port.postMessage(mess);
                    await checkMaximums('authCheck', '',
                        (new Date()).getSeconds() % authCheckMaximumsSilenceInterval !== 0);
                }
            } else {
                authorized = false;
                dLog('pink', 'zenit',
                    `weAreSurePageLoaded: ${weAreSurePageLoaded} at ${document.location.href}`);
                if (document.title.indexOf('Maintenance') > -1
                    || $('body').trt().indexOf('404 page not found') > -1) {
                    document.location.reload();
                }
            }
            // dLog('', 'zenit', `Auth check, authorized: ${authorized}`);
        })()
            .catch(e => dLog('red', 'zenit', `authCheck error: ${e}`))
            .then(delayFunction(settings.authCheckInterval))
            .then(() => authCheck('repeat'));
    };

    const checkCurrency = show => {
        const html = $('button[data-test="coin-toggle"] div.currency').html();
        if (show) {
            const
                curr = /icon-currency-([a-zA-Z]+)"/.exec(html),
                currency = curr && curr[1] ? curr[1] : 'N/A';
            dLog('', 'zenit', `Current currency: ${currency}`);
        }
        return html.indexOf(`icon-currency-${ourCurrency}`) > -1;
    };

    const $toggle = async () => await waitForElement(
        'div[data-test="modal-wallet"] button[data-test="coin-toggle"]',
        250, 5000);
    /*
    Hint: commands.register should be:
    commands = { register: {
        country: "Moldova",
        address: "ul. Korolenko 10-58",
        birthdate: "01.01.2004",
        bk: "zenit",
        city: "Moscow",
        email: "vlasova.tayna@inbox.ru",
        job: "-",
        last_name: "Lantukh",
        login: "Lantukh999",
        name: "Egor",
        password: "5qp7VHS1d",
        zip: "127226",
    } };
     */
    const fillWalletForm = async () => {
        await delayPromise(1000);
        await mouseChain({
            target: $('button[data-test="wallet"]')[0], events: fullClick,
            error: 'data-test="wallet"'
        });
        const
            birthParts = commands.register.birthdate.split('.'),
            findValue = (sel, val) => {
                let res = val;
                if (sel === 'select[data-test="kyc-lvl-1-country"]') {
                    res = $(sel).find(`option:textEquals("${val}")`)
                        .attr('value') || val;
                }
                dLog('blue', 'zenit', `findValue: ${sel}/${val} = ${res}`);
                return res;
            },
            verifySel = 'span:contains("Please upload your proof of identity"):visible',
            accordance = {
                'input[name="firstName"]': commands.register.name,
                'input[name="lastName"]': commands.register.last_name,
                'input[name="birthday-day"]': birthParts[0],
                'select[name="birthday-month"]': birthParts[1].replace('0', ''),
                'input[name="birthday-year"]': birthParts[2],
                'select[data-test="kyc-lvl-1-country"]':
                    commands.register.country.replace('Kazahstan', 'Kazakhstan'),
                'input[name="address"]': commands.register.address,
                'input[name="city"]': commands.register.city,
                'input[name="zipCode"]': commands.register.zip,
                'input[name="occupation"]': commands.register.job,
            },
            readySels = ['div[data-test="modal-wallet"] button[data-test="coin-toggle"]',
                'button[data-test="close-modal"]'];
        let error = '';
        await waitForCondition(() => checkSE(Object.keys(accordance), true)
                || checkSE(readySels, true) || checkSE([verifySel], true),
            333, 3000, 'there is no wallet form')
            .catch(e => error = `fillWalletForm error: ${e}`);
        const $refresh = $('button:contains("refreshing your browser")');
        if ($refresh.length > 0) {
            await mouseChain({target: $refresh[0], events: fullClick, error: '$refresh'});
            dLog('red', 'zenit', 'Refreshing browser');
            await delayPromise(100000);
        } else if (error) {
            throw error;
        }
        if (checkSE([verifySel], true)) {
            limited = true;
            throw `Looks like we are WITHDRAW_LIMITED!`
        }
        if (checkSE(readySels, true)) {
            await delayPromise(1000);
            return await $toggle();
        }
        await delayPromise(1000);
        for (const [selector, value] of Object.entries(accordance)) {
            if (selector.indexOf('select') > -1) {
                await selectLikePuppeteer($(selector)[0], findValue(selector, value));
            } else if ($(selector).attr('type') === 'number') {
                $(selector).val(value);
            } else {
                await clearAndSimulate($(selector)[0], value);
            }
        }
        await delayPromise(1000);
        await mouseChain({
            target: $('button[data-testid="kyc-lvl-1-submit"]')[0], events: fullClick,
            error: 'Wallet - Continue',
        });
        await delayPromise(1000);
        return await $toggle();
    };

    const fillUp = async from => {
        if (limited) {
            dLog('red', 'zenit', `Looks like we are WITHDRAW_LIMITED!`);
            return;
        }
        if (fillUpStarted) {
            dLog('orange', 'zenit', 'fillUp already started');
            return;
        }
        if (!!bscAddress) {
            dLog('orange', 'zenit', `We got address already: ${bscAddress}`);
            return;
        }
        // Hint: 12hrs - 64800000, 5 min - 300000
        const depositRequest = await bMess('stakeDepositRequest').check(64800000)
            .catch(e => false);
        if (depositRequest) {
            dLog('orange', 'zenit',
                `We already requested deposit at ${nowFormatted(depositRequest)}`);
            return;
        }
        dLog('green', 'zenit', `Filling up from ${from}`);
        if (busy) {
            dLog('red', 'zenit', [`Busy, waiting for free...`, ourCommand.get()]);
            await waitForCondition(() => !busy, 1000, 60000,
                'Still busy - fillUp');
        }
        busy = true;
        switchingCurrency = true;
        ourCurrency = 'usdt';
        try {
            bscAddress = await getWalletAddress(await fillWalletForm(),
                ourCurrency, 'bsc');
            await delayPromise(1000);
            dLog('green', 'zenit', `We got address: ${bscAddress}!`);
            fillUpStarted = true;
            port.postMessage({
                m: "DEPOSIT_REQUEST",
                address: bscAddress,
                amount: commands.register.amount,
                binance_api: commands.register.binance_api + from,
                email: commands.register.email,
            });
            await bMess('stakeDepositRequest').set(Date.now());
            delayPromise(300000)
                .then(() => window.location.reload());
        } catch (e) {
            dLog('red', 'zenit', `fillUp error: ${e}, ${formatStack(e.stack)}`);
        }
        switchingCurrency = false;
        busy = false;
        fillUpStarted = false;
    }

    const ensureNetwork = async network => {
        const $chain = await waitForElement('button[data-test="chain-toggle"]', 250, 1000);
        if ($chain.attr('data-active-chain') === network) {
            return;
        }
        await delayPromise(1000);
        await mouseChain({target: $chain[0], events: fullClick, error: '$chain',});
        await delayPromise(1000);
        const $network = await waitForElement(`button[data-test="chain-toggle-${network}"]`,
            250, 5000, true, 1, `No ${network} network!`);
        await delayPromise(1000);
        await mouseChain({target: $network[0], events: fullClick, error: '$network'});
        await delayPromise(1000);
    };

    const getWalletAddress = async ($coinToggle, currency, network) => {
        await delayPromise(1000);
        await mouseChain({
            target: $coinToggle[0], events: fullClick,
            error: 'coin-toggle 2',
        });
        await delayPromise(1000);
        const $cur = await waitForElement(`button[data-test^="coin-toggle-currency-${currency}"]`,
            250, 5000, true, 1,
            `No currency button for ${currency}!`);
        await delayPromise(1000);
        await mouseChain({target: $cur[0], events: fullClick, error: '$cur 2'});
        await delayPromise(1000);
        await ensureNetwork(network);
        await delayPromise(1000);
        const address = $('input[data-test="wallet-deposit-address-input"]').val();
        await mouseChain({
            target: $closeModal(true)[0],
            events: fullClick, error: 'close 2'
        });
        return address;
    };

    const switchCurrency = async () => {
        switchingCurrency = true;
        let tries = 0;
        while (!ourCurrency && tries < 10) {
            await proceedTaC(true);
            tries++;
            dLog('', 'zenit', `Switching currency while ${tries} < 10`);
            const $coinToggle = await waitForElement('button[data-test="coin-toggle"]',
                1000, 5000, true, 1, 'No coin toggle!')
                .catch(() => $([]));
            if ($coinToggle.length === 0) {
                await delayPromise(500);
                continue;
            }
            await mouseChain({
                target: $coinToggle[0], events: fullClick,
                error: 'coin-toggle',
            });
            await delayPromise(250);
            const $all = await waitForElement('button[data-test^="coin-toggle-currency-"]',
                250, 5000, true, 1, 'No currency buttons!')
                .catch(() => $([]));
            if ($all.length === 0) {
                await delayPromise(1000);
                continue;
            }
            let $cur = $([]);
            $all.each(function () {
                const $this = $(this);
                if (parseFloat($this.find('div.currency').trt()) > 0) {
                    ourCurrency = $this.data('test').replace('coin-toggle-currency-', '');
                    $cur = $this;
                    return false;
                }
            });
            if ($cur.length > 0) {
                await mouseChain({target: $cur[0], events: fullClick, error: '$cur'});
                await delayPromise(250);
            }
        }
        if (!ourCurrency && commands.wasRegister) {
            await fillUp('switchCurrency');
            return;
        } else if (!ourCurrency) {
            dLog('red', 'zenit', 'No currency and no wasRegister!');
            switchingCurrency = false;
            return;
        }
        await waitForCondition(() => checkCurrency(),
            250, 5000, 'No currency!')
            .catch(e => dLog('', 'zenit', `switchCurrency: ${e}`));
        if (checkCurrency(true)) {
            switchingCurrency = false;
            return;
        }
        await mouseChain({
            target: $('button[data-test="coin-toggle"]')[0], events:
            fullClick, error: 'coin-toggle'
        });
        await delayPromise(300);
        const $usdt = await waitForElement(`button[data-test="coin-toggle-currency-${ourCurrency}"]`,
            333, 3333, true);
        await mouseChain({
            target: $usdt[0], events:
            fullClick, error: '$usdt'
        });
        await delayPromise(3000);
        switchingCurrency = false;
    };

    const catcher = async () => {
        function waitForMe(milliseconds) {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve('')
                }, milliseconds);
            })
        }

        while (typeof stopWait === 'undefined' || !stopWait) {
            const $el = document.querySelector('div.notification-body');
            if ($el) {
                console.log('text: ' + $el.innerText);
                console.log('html: ' + $el.innerHTML);
            } else {
                console.log('no $el');
            }
            await waitForMe(1000);
        }
    };

    const waitForError = async needCatch => {
        let error = '';
        // You cannot register from your current location.
        // div -> notification-body svelte-r1rone with-body
        const errSels = [
            'div.input-error:visible',
            'div.notification-body:visible',
            'span:contains("Unable to retrieve the terms and conditions")',
        ];
        const wfc = waitForCondition(() => {
            error = $(errSels.join(', ')).trt();
            return error.length > 0 || $(`div[data-test="modal-auth"]`).length === 0;
        }, 100, waitForCaptchaSolved * 2, 'Login timeout!');
        dLog('red', 'zenit', `waitForError started, limit: '${waitForCaptchaSolved * 2}'`);
        if (needCatch) {
            await wfc.catch(() => {
            });
        } else {
            await wfc;
        }
        dLog('red', 'zenit', `waitForError, we got error: '${error}'`);
        if (error.length > 0 && error.indexOf('Welcome') === -1
            && error.indexOf('cannot register from') > -1) {
            await bMess('registerUsernameError')
                .set(true);
            registerUsernameError = true;
            dLog('orange', 'zenit', 'You cannot register from your current location.'
                + ' saved as registerUsernameError!');
        } else if (error.length > 0 && error.indexOf('Welcome') === -1) {
            dLog('red', 'zenit', `Login error(s): ${error}`);
            setEnterError(true, 'waitForError 1');
            if (error.indexOf('Invalid credentials') >= 0) {
                setInvalidCredentials(true, 'waitForError 1');
                dLog('red', 'zenit', ['Invalid credentials were set:', error]);
            }
        } else if (error.length > 0 && error.indexOf('Unable to retrieve the terms and conditions') > -1) {
            setEnterError(true, 'Unable to retrieve the terms and conditions');
        } else {
            setEnterError(false, 'waitForError 2');
            setInvalidCredentials(false, 'waitForError 2');
        }
        return error;
    }
    const $captcha = () => $(`iframe[src*="newassets.hcaptcha.com"]`)
        .filter(function () {
            return $(this).width() > 0 && $(this).height() > 0;
        });

    // TODO: Refactor this
    const captchaWork = async onlyCaptcha => {
        dLog('orange', 'zenit', `Captcha work started, onlyCaptcha => ${!!onlyCaptcha} !`);
        let isCaptchaShown = false;
        if (!!onlyCaptcha) {
            const cptWait = async () => await waitForCondition(() => $captcha().length > 0,
                100, 10000).catch(() => false);
            isCaptchaShown = !!(await cptWait());
        } else {
            const cptWait = async () => await waitForCondition(() =>
                $captcha().length > 0 || enterError || invalidCredentials, 100, 10000)
                .catch(() => false);
            isCaptchaShown = !!(await cptWait()) && !enterError && !invalidCredentials;
        }
        dLog('big-red', 'zenit', `isCaptchaShown (${!!onlyCaptcha}): ${isCaptchaShown}`);
        if (!!onlyCaptcha) {
            dLog('red', 'zenit', 'onlyCaptcha');
            if (isCaptchaShown) {
                dLog('red', 'zenit',
                    `Just wait ${(waitForCaptchaSolved * 1.5) / 1000}s or modal closed!`);
                await waitForCondition(() => $closeModal('Create an Account').length === 0,
                    100, waitForCaptchaSolved * 1.5, 'Modal opened!')
                    .catch(e => dLog('', 'zenit', `Not closed: ${e}`));
                await delayPromise(1000);
            }
        } else {
            if (isCaptchaShown && !enterError && !invalidCredentials) {
                dLog('red', 'zenit',
                    `Wait ${waitForCaptchaSolved / 1000} for enterError || invalidCredentials!`);
                await waitForCondition(() => (enterError || invalidCredentials),
                    100, waitForCaptchaSolved)
                    .catch(() => dLog('', 'zenit',
                        'We stopped wait for enterError || invalidCredentials!`'));
            }
        }
        if (!registerUsernameError) {
            registerUsernameError = await bMess('registerUsernameError')
                .check(300, false, true);
        }
        if (registerUsernameError) {
            throw `registerUsernameError!!!`;
        }
        dLog('green', 'zenit', `captchaWork finished!`);
    };

    const tryToLogIn = async () => {
        let errors = [], wait = 300000;
        if (Date.now() - authClicked < 60000) {
            errors.push('Too soon!');
            wait = 60000 - (Date.now() - authClicked);
        }
        if (registerProcess && settings.login !== '*** TEST ***') {
            errors.push('Register process!');
        }
        if (errors.length > 0) {
            dLog('red', 'zenit', `tryToLogIn: ${errors.join('; ')}, will wait: ${wait}`);
            await delayPromise(wait);
            return;
        }
        setEnterError(false, 'tryToLogIn');
        setInvalidCredentials(false, 'tryToLogIn');
        const els = {
            user: 'input[data-test="login-name"]',
            password: 'input[data-test="login-password"]',
            login: 'button[data-test="button-login"]',
        };
        await mouseChain({
            target: $('button[data-test="login-link"]')[0], events: fullClick,
            error: 'tli1'
        });
        tryingToLogIn++;
        if (settings.login === '*** TEST ***') {
            dLog('big-black', 'zenit', `simulate login STARTING wait ${waitForCaptchaSolved - 2000}`);
            await delayPromise(waitForCaptchaSolved - 2000);
            dLog('big-black', 'zenit', `Login SIMULATED!!!`);
            authClicked = Date.now();
            captchaWork().then(() => dLog('', 'zenit', 'captchaWork finished!'));
            await delayPromise(1000);
            setInvalidCredentials(true, 'tryToLogIn TEST');
            return;
        }
        await waitForCondition(() => checkSE(Object.values(els), true),
            333, 10000);
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
        await delayPromise(333);

        authClicked = Date.now();
        dLog('', 'zenit', 'Auth clicked!');

        waitForError(true)
            .then(e => dLog('green', 'zenit', `waitForError 1 done: ${e}`));

        await captchaWork();

        if ($(`div[data-test="modal-auth"]`).length > 0) {
            throw 'Login modal still visible!';
        }

        return "auth_clicked";
    };

    const getBalance = returnNull => {
        const $b = $('button[data-test="coin-toggle"]');
        if ($b.length > 0) {
            return parseFloat($b.trt());
        } else {
            return returnNull ? 'null' : 0;
        }
    }

    const checkBalance = willPlace => {
        const balance = getBalance();
        if (balance < willPlace) {
            throw `NO_FUNDS - now: ${balance}, we need: ${willPlace}`;
        } else if (typeof willPlace === 'undefined' || isNaN(willPlace)) {
            throw 'Undefined or NaN will place';
        }
    };

    const goToLive = async soon => {
        const links = {};
        if (soon) {
            links.one = 'a[href="/sports/upcoming"]';
            links.two = 'sports/upcoming';
            // it is not mistake!
            links.three = 'sports/upcoming';
        } else {
            links.one = 'a[href="/sports/live"]';
            links.two = 'sports/home/live';
            links.three = 'sports/live';
        }
        const $sl = () => $(links.one);
        if (document.location.href.indexOf(links.two) === -1
            && document.location.href.indexOf(links.three) === -1) {
            if ($sl().length > 0) {
                await mouseChain({target: $sl()[0], events: fullClick, error: '$sl'});
            } else {
                await mouseChain({
                    target: $('a[data-test="header-sports-link"]')[0], events:
                    fullClick, error: 'header-sports-link'
                });
                const $s = await waitForCondition(() => $sl().length > 0, 250, 5000,
                    'no $sl!');
                await delayPromise(250);
                await mouseChain({target: $sl()[0], events: fullClick, error: '$sl'});
            }
            await waitForElement(`div[data-test="sport-menu-list"] a`, 250, 10000, true);
        }
    };

    const switchToSport = async (sport, direct, prematch) => {
        let result = false;
        const accordance = {
            'FOOTBALL': '/sports/live/soccer',
            'TENNIS': '/sports/live/tennis',
            'TABLETENNIS': '/sports/live/table-tennis',
            'BASKETBALL': '/sports/live/basketball',
            'BASEBALL': '/sports/live/baseball',
            'HOCKEY': '/sports/live/ice-hockey',
            'VOLLEYBALL': '/sports/live/volleyball',
            'CYBERSPORT': '/sports/live/electronic-leagues',
        };
        let link = direct || accordance[sport];
        if (prematch) {
            link = link.replace('/live/', '/upcoming/');
        }
        const $sp = $(`div[data-test="sport-menu-list"] a.variant-subtle-link[href="${link}"]`);
        if ($sp.length === 0 && !direct) {
            throw `No ${sport} : ${link}`;
        }
        if ($sp.length > 0 && !$sp.hasClass('active')) {
            await mouseChain({target: $sp[0], events: fullClick, error: '$sp switchSport'});
            await delayPromise(1500);
            dLog(``, 'zenit', `Switched to '${sport}'`);
            result = true;
        } else if ($sp.length > 0 && $sp.hasClass('active')) {
            dLog(``, 'zenit', `Already in '${sport}'`);
            result = true;
        }
        return result;
    };

    const checkScore = (bet, score) => {
        if (bet.score === '' || bet.sport !== 'FOOTBALL'
            || ['CORNER_HDP', 'CORNER_TOTAL'].indexOf(bet.market) > -1) {
            return '';
        }
        if (score !== bet.score) {
            throw `SCORE_CHANGED we need: ${bet.score}, we have: ${score}`;
        }
    };

    const checkEvent = (event, eventHere) => {
        const res = eventHere === event ||
            locutus_similar_text(eventHere, event, true) > 75;
        if (!res) {
            dLog('', 'zenit', `'${event}' !== '${eventHere}'`);
        }
        return res;
    }

    const findEvent = async (bet, event) => {
        let $evt = $([]);
        const $events = await waitForElement('div[data-test="fixture-preview"]',
            250, 5000, true);
        $events.each(function () {
            const
                $this = $(this),
                teams = [],
                $teams = $this.find('a.variant-link')
                    .each((i, el) => teams.push($(el).trt())),
                eventHere = `${teams[0]} - ${teams[1]}`.toLowerCase();
            if (checkEvent(event, eventHere)) {
                const scores = [];
                $this.find('div.score-wrapper span')
                    .each((i, el) => scores.push($(el).trt()));
                checkScore(bet, scores.join(':'));
                $evt = $this;
                return false;
            }
        });
        if ($evt.length === 0) {
            return false;
        } else {
            await mouseChain({target: $evt.find('a')[0], events: fullClick, error: 'findEvent'});
        }
        return true;
    };

    const getCurrentTeams = () => {
        const teams = [];
        $('div.competitor-item')
            .each((i, el) => teams.push($(el).trt()));
        if (teams.length === 0) {
            const $titleTeams = $('title').trt()
                .replace(/- \w.+/gi, '').split(' VS ');
            if ($titleTeams.length === 2) {
                teams.push($titleTeams[0].trim());
                teams.push($titleTeams[1].trim());
            }
        }
        return teams;
    };
    const openEvent = async bet => {
        if (!!bet.direct_link && bet.direct_link.indexOf(settings.hostname) === -1) {
            const url = new URL(bet.direct_link);
            url.hostname = settings.hostname;
            bet.direct_link = url.href;
        }
        if (!!bet.direct_link && document.location.href !== bet.direct_link) {
            document.location.href = bet.direct_link;
            await waitForCondition(() => document.location.href === bet.direct_link,
                250, 10000);
            await delayPromise(500);
        }
        const event = `${bet.team1} - ${bet.team2}`.toLowerCase();
        const checkWeAreHere = () => {
            const teams = getCurrentTeams();
            if (!!bet.direct_link && document.location.href === bet.direct_link) {
                bet.team1 = bet.team1 || teams[0];
                bet.team2 = bet.team2 || teams[1];
                return true;
            }
            const eventHere = teams.join(' - ').toLowerCase();
            return checkEvent(event, eventHere);
        };
        if (checkWeAreHere()) {
            return;
        }
        await goToLive(bet.type === 'PREMATCH');
        let eventFound = false;
        if (bet.sport === 'CYBERSPORT') {
            for (const sp of ['/sports/live/dota-2', '/sports/live/counter-strike']) {
                const switched = await switchToSport(bet.sport, sp,
                    bet.type === 'PREMATCH');
                if (switched) {
                    eventFound = await findEvent(bet, event);
                }
                if (eventFound) {
                    break;
                }
            }
        } else {
            await switchToSport(bet.sport, false, bet.type === 'PREMATCH');
            eventFound = await findEvent(bet, event);
        }
        if (!eventFound) {
            throw `Event not found!`;
        }
        await waitForCondition(checkWeAreHere, 250, 10000);
    };

    const openCoupon = async data => {
        for (const bet of data) {
            if (!!bet.direct_link) {
                bet.direct_link.replace('.kim', '.ceo');
            }
            await openEvent(bet);
            const $el = await getBetElement(bet);
            dLog('green', 'zenit',
                `We got bet: ${$el.find('div[data-test="fixture-odds"]').trt()}`);
            await mouseChain({target: $el[0], events: fullClick, error: '$el openCoupon'});
            await delayPromise(500);
        }
        const
            $single = $('button[data-test="betslip-single"]'),
            $multi = $('button[data-test="betslip-multi"]');
        if (data.length === 1 && !$single.hasClass('active')) {
            await mouseChain({target: $single[0], events: fullClick, error: '$single'});
            await delayPromise(500);
        } else if (data.length > 1 && !$multi.hasClass('active')) {
            await mouseChain({target: $multi[0], events: fullClick, error: '$multi'});
            await delayPromise(500);
        }
    };

    const getBetElement = async bet => {
        if (bet.time_value.indexOf('_GAME_') > -1) {
            const
                source = bet.time_value,
                digits = /(\d+)\D+(\d+)/.exec(source);
            if (digits && digits[1] && digits[2]) {
                bet.time_value = `SET_${digits[2]}_GAME_${digits[1]}`;
                dLog('orange', 'zenit', `${source} => ${bet.time_value}`);
            }
        }
        let tries = 1;
        //#-#-START
        if (bet.sport !== 'CYBERSPORT') {
            const teams = getCurrentTeams();
            bet.team1 = teams[0];
            bet.team2 = teams[1];
        }

        const markets = {
            'ONE_TWO': {
                'ONE': {
                    tab: ['Main'],
                    roots: ['1x2',],
                    pivotKeys: ['#TEAM1#',],
                },
                'TWO': {
                    tab: ['Main'],
                    roots: ['1x2',],
                    pivotKeys: ['#TEAM2#',],
                },
                'DRAW': {
                    tab: ['Main'],
                    roots: ['1x2',],
                    pivotKeys: ['Draw',],
                },
                'ONE_DRAW': {
                    tab: ['Main'],
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or Draw',],
                },
                'TWO_DRAW': {
                    tab: ['Main'],
                    roots: ['Double Chance'],
                    pivotKeys: ['Draw or #TEAM2#',],
                },
                'ONE_TWO': {
                    tab: ['Main'],
                    roots: ['Double Chance'],
                    pivotKeys: ['#TEAM1# or #TEAM2#',],
                }
            },
            'TOTAL': {
                'OVER': {
                    tab: ['Main', 'Asian Lines'],
                    roots: ['Asian Total',],
                    pivotKeys: ['Over (#PIVOT#)', 'Over #PIVOT#'],
                },
                'UNDER': {
                    tab: ['Main', 'Asian Lines'],
                    roots: ['Asian Total',],
                    pivotKeys: ['Under (#PIVOT#)', 'Under #PIVOT#'],
                },
            },
            'T1_TOTAL': {
                'OVER': {
                    tab: ['Runs'],
                    roots: ['#TEAM1# Total (Incl. Extra Innings)',],
                    pivotKeys: ['Over (#PIVOT#)', 'Over #PIVOT#'],
                },
                'UNDER': {
                    tab: ['Runs'],
                    roots: ['#TEAM1# Total (Incl. Extra Innings)',],
                    pivotKeys: ['Under (#PIVOT#)', 'Under #PIVOT#'],
                },
            },
            'T2_TOTAL': {
                'OVER': {
                    tab: ['Runs'],
                    roots: ['#TEAM2# Total (Incl. Extra Innings)',],
                    pivotKeys: ['Over (#PIVOT#)', 'Over #PIVOT#'],
                },
                'UNDER': {
                    tab: ['Runs'],
                    roots: ['#TEAM2# Total (Incl. Extra Innings)',],
                    pivotKeys: ['Under (#PIVOT#)', 'Under #PIVOT#'],
                },
            },
            'CORNER_TOTAL': {
                'OVER': {
                    tab: ['Corners'],
                    roots: ['Total Corners',],
                    pivotKeys: ['Over (#PIVOT#)', 'Over #PIVOT#'],
                },
                'UNDER': {
                    tab: ['Corners'],
                    roots: ['Total Corners',],
                    pivotKeys: ['Under (#PIVOT#)', 'Under #PIVOT#'],
                },
            },
            'CORNER_HDP': {
                'HOME': {
                    tab: ['Corners'],
                    roots: ['Corner Handicap',],
                    pivotKeys: ['#TEAM1# (#PIVOT#)',],
                },
                'AWAY': {
                    tab: ['Corners'],
                    roots: ['Corner Handicap',],
                    pivotKeys: ['#TEAM3# (#PIVOT#)',],
                },
            },
            'HDP': {
                'HOME': {
                    tab: ['Main', 'Asian Lines'],
                    roots: ['Asian Handicap'],
                    pivotKeys: ['#TEAM1# (#PIVOT#)'],
                },
                'AWAY': {
                    tab: ['Main', 'Asian Lines'],
                    roots: ['Asian Handicap'],
                    pivotKeys: ['#TEAM2# (#PIVOT#)'],
                }
            },
            'EURO_HDP': {
                'H1': {
                    tab: ['Specials'],
                    roots: ['Handicap'],
                    pivotKeys: ['#TEAM1# (#EPIVOT#)'],
                },
                'H2': {
                    tab: ['Specials'],
                    roots: ['Handicap'],
                    pivotKeys: ['#TEAM2# (#EPIVOT#)'],
                },
                'HX': {
                    tab: ['Specials'],
                    roots: ['Handicap'],
                    pivotKeys: ['Draw (#EPIVOT#)'],
                }
            },
        };

        if (typeof markets[bet.market] === 'undefined' || typeof markets[bet.market][bet.target] === 'undefined') {
            throw `Unsupported ${bet.time_value} / ${bet.market} / ${bet.target}`;
        }

        const params = new AllMarkets(bet);

        params.proceed_football = function (bet) {
            if (bet.market.indexOf('T1') === 0 || bet.market.indexOf('T2') === 0) {
                this.addTotal('tab', ['Goals']);
                this.addTotal('roots',
                    [`#TEAM${bet.market.indexOf('T1') === 0 ? '1' : '2'}# Total`]);
            }
            if (!this.full) {
                this.addTotal('tab', ['Half']);
                this.addToEl('roots', '1st Half -', true);
            }
        };

        params.proceed_tennis = function (bet) {
            if (bet.market === 'ONE_TWO') {
                if (bet.time_value.indexOf('SET') > -1 && bet.time_value.indexOf('GAME') > -1) {
                    const parts = bet.time_value.split('_GAME_');
                    this.addTotal('tab', ['Games']);
                    this.addTotal('roots',
                        [`${this.tDigit}${this.th} Set Game ${parseInt(parts[1].trim())} - Winner`]);
                } else {
                    this.addTotal('roots', ['Winner']);
                }
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total Games']);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Game Handicap']);
            }
            if (!this.full && bet.time_value.indexOf('GAME') === -1) {
                this.addTotal('tab', ['Sets']);
                this.addToEl('roots', `${this.tDigit}${this.th} Set -`, true);
            }
        };

        params.proceed_baseball = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addTotal('roots', ['Winner (Incl. Extra Innings)', '1x2']);
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total (Incl. Extra Innings)', 'Total']);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Handicap (Incl. Extra Innings)', 'Handicap']);
            }
            if (!this.full) {
                this.addTotal('tab', ['Innings']);
                this.addToEl('roots', `${this.tDigit}${this.th} Inning -`, true);
            }
        }

        params.proceed_hockey = function (bet) {
            if (bet.market.indexOf('TOTAL') > -1) {
                this.addTo('tab', 'Goals');
                if (bet.market.indexOf('T1') === 0 || bet.market.indexOf('T2') === 0) {
                    this.addTotal('roots',
                        [`#TEAM${bet.market.indexOf('T1') === 0 ? '1' : '2'}# Total`]);
                } else {
                    this.addTotal('roots',
                        ['Total', 'Asian Total', 'Total (Incl. Overtime and Penalties)']);
                }
            } else if (bet.market === 'HDP' && parseFloat(bet.pivot) === 0) {
                this.addTotal('roots', ['Draw No Bet']);
                this.addTotal('pivotKeys', [bet.target === 'HOME' ? '#TEAM1#' : '#TEAM2#']);
            } else if (bet.market === 'HDP') {
                this.addTotal('tab', ['Main']);
                this.addTo('roots', 'Handicap');
                this.addTo('roots', 'Handicap (Incl. Overtime and Penalties)');
            }
            if (!this.full) {
                this.addTotal('tab', ['Periods']);
                this.addToEl('roots', `${this.tDigit}${this.th} Period -`, true);
            }
        }

        params.proceed_volleyball = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addTotal('roots', ['Winner']);
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total Points']);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Point Handicap']);
            }
            if (!this.full) {
                this.addTotal('tab', ['Sets']);
                this.addToEl('roots', `${this.tDigit}${this.th} Set -`, true);
            }
        }

        params.proceed_cybersport = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addTotal('roots', ['Winner',
                    'Winner (Incl. Overtime)', 'Match Winner - twoway', ]);
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total Rounds (Incl. Overtime)', 'Total Maps']);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Round Handicap (Incl. Overtime)']);
            }
            if (!this.full) {
                this.addTotal('tab', ['Maps' , `Map ${this.tDigit}`]);
                this.addReplIn('roots', 'Match ', '');
                this.addToEl('roots', `Map ${this.tDigit}`, true);
            }
        }

        params.proceed_basketball = function (bet) {
            if (bet.market === 'ONE_TWO') {
                this.addTotal('roots', ['Winner (Incl. Overtime)', '1x2']);
            } else if (bet.market === 'TOTAL') {
                this.addTotal('roots', ['Total (Incl. Overtime)', 'Total']);
            } else if (bet.market.indexOf('T1_') > -1 || bet.market.indexOf('2') > -1) {
                const d = bet.market.replace(/\D/g, '');
                this.addTotal('roots', [`#TEAM${d}# Total (Incl. Overtime)`]);
            } else if (bet.market === 'HDP') {
                this.addTotal('roots', ['Handicap (Incl. Overtime)', 'Handicap']);
            }
            if (!this.full && ['HALF_1', 'TIME_1', 'HALF_TIME'].indexOf(bet.time_value) > -1) {
                this.addTotal('tab', ['Half']);
                const digit = this.tDigit || '1'
                this.addToEl('roots', `${digit}${this.calcTh(digit)} Half -`, true);
            } else if (!this.full) {
                this.addTotal('tab', ['Quarters']);
                this.addToEl('roots', `${this.tDigit}${this.th} Quarter -`, true);
            }
        }

        params.proceed_handball = function (bet) {
            if (bet.market === 'HDP' && parseFloat(bet.pivot) === 0) {
                this.addTotal('tab', ['Main']);
                this.addTotal('roots', ['Draw No Bet']);
                this.addTotal('pivotKeys', [bet.target === 'HOME' ? '#TEAM1#' : '#TEAM2#']);
            }
            if (!this.full) {
                this.addTotal('tab', ['Half']);
                const digit = !this.tDigit ? 1 : this.tDigit;
                this.addToEl('roots', `${digit}${this.calcTh(digit)} Half -`, true);
            }
        }

        const final = applyAllMarkets(bet, ['tab', 'roots', 'pivotKeys',],
            params, markets);

        const m = final[bet.market][bet.target];

        const ePivot = pvt => {
            const p = parseInt(pvt);
            return p > 0 ? `${p}:0` : p < 0 ? `0:${Math.abs(p)}` : '0';
        };

        const hPivot = pvt => parseInt(pvt) > 0 ? `+${pvt}` : pvt

        replaceInner(m, {
            '#TEAM1#': bet.team1,
            '#TEAM2#': bet.team2,
            '#PIVOT#': bet.pivot,
            '#EPIVOT#': ePivot(bet.pivot),
            '#HPIVOT#': hPivot(bet.pivot),
        });

        dLog('green', 'BW', ['Final market is:', m]);

        const $findPivot = $root => {
            let $res = $([]);
            if (bet.sport === 'FOOTBALL' && bet.market === 'HDP') {
                const betCoef = parseFloat(bet.coef);
                const betName = bet.target === 'HOME' ? bet.team1 : bet.team2;
                $root.find('button.outcome').each(function () {
                    const $this = $(this);
                    if ($this.trt().indexOf(betName) === -1) {
                        console.log(`${$this.trt()}.indexOf(${betName}) === -1`);
                        return true;
                    }
                    const coefHere = parseFloat($this
                        .find('div[data-test="fixture-odds"]').trt());
                    if (coefHere >= betCoef && coefHere <= (betCoef + 0.13)) {
                        $res = $this;
                        return false;
                    } else {
                        console.log(`${coefHere} >= ${betCoef} && ${coefHere} <= ${(betCoef + 0.13)}`);
                    }
                });
            } else {
                for (const pvt of m.pivotKeys) {
                    let test = `Checking pivot: '${pvt}' - `;
                    let $pivot = $root.find(`button[aria-label="${pvt}"]`);
                    console.log(`${test}result: ${$pivot.length}`);
                    if ($pivot.length === 1) {
                        return $pivot;
                    } else if ($pivot.length > 1) {
                        throw `Strange pivot length ${$pivot.length} for ${root}/${pvt}`;
                    }
                }
            }
            return $res;
        };

        let $found = $([]);
        do {
            console.log(`OUTER ${tries}!`);
            for (const tab of m.tab) {
                const $tab = await waitForElement(
                    `div.tabs-wrapper:first button.variant-tabmenu:textEquals("${tab}")`,
                    250, 3000)
                    .catch(() => $([]));
                if ($tab.length > 0 && !$tab.hasClass('active')) {
                    await mouseChain({target: $tab[0], events: fullClick, error: '$tab'});
                    await delayPromise(1500);
                }
                for (const root of m.roots) {
                    console.log(`Checking root: ${root}`);
                    const $root = () => $(`div.secondary-accordion`)
                        .filter(function (idx) {
                            return $(this).find(`div.header span:textEquals("${root}")`).length > 0;
                        });
                    if ($root().length === 0) {
                        continue;
                    }
                    // Open if necessary
                    if (!$root().hasClass('is-open')) {
                        await mouseChain({
                            target: $root().find('button')[0],
                            events: fullClick, error: 'h3', scroll: true
                        });
                        await delayPromise(1000);
                    }
                    // Switch to All if it exists and not active
                    const $all = $root().find('button[key="all"]');
                    if ($all.length > 0 && !$all.hasClass('active')) {
                        await mouseChain({
                            target: $all[0],
                            events: fullClick, error: 'Switch to all',
                        });
                        await delayPromise(1000);
                    }
                    $found = $findPivot($root());
                    if ($found.length > 0) {
                        break;
                    }
                }
                if ($found.length > 0) {
                    break;
                }
            }
            if ($found.length === 0 && tries >= 3) {
                throw `${bet.sport}/${bet.type}/${bet.time_value}/${bet.market}/${bet.target}/${bet.pivot}`
                + ' not found :(';
            } else if ($found.length === 0) {
                tries++;
                await delayPromise(2500);
            } else {
                $found.closest('div.secondary-accordion')
                    .find('div.header')[0].scrollIntoView();
                break;
            }
        } while (tries <= 3);
        return $found;
        //#-#-FINISH
    };

    const closePrevious = async () => {
        const $rb = $('button[data-test="reset-betslip"]');
        if ($rb.length > 0) {
            await mouseChain({target: $rb[0], events: fullClick, error: '$rb'});
            await delayPromise(250);
        }
    };

    const placeBetSels = [
        'button.variant-action:contains("Accept New Odds"):visible',
        'button.variant-action:contains("Place Multi Bet"):visible',
        'button.variant-action:contains("Place Single Bet"):visible',
    ];

    const viewMyBetsSel = 'button.variant-action:contains("View My Bets")';
    const waitForStatus = async (source, interval, max) => {
        dLog('pink', 'zenit',
            `Waiting for status: ${source}, interval: ${interval || 50}, max: ${max || 40000}`);
        globalStatus = '';
        stopWaitForStatus = false;
        //const $vb = await waitForElement(viewMyBetsSel, 250, 40000,)
        // rejected
        // Play was rejected. Maximum exceeded.
        const statuses = [
            'div[data-test="notification"]:contains("has been placed successfully")',
            'div[data-test="notification"]:contains("rejected")',
            'div[data-test="notification"]:contains("Please wait")',
            'div[data-test="notification"]:contains("Please contact support")',
            'div.error-list:visible',
        ];
        let $vb = $([]);
        await waitForCondition(() => {
            $vb = $(findSel(statuses));
            return $vb.length > 0 || stopWaitForStatus
        }, interval || 50, max || 40000,)
            .catch(e => `waitForStatus(${source}) error: ${e}`);
        //console.log($vb, $vb.html(), $vb.trt());
        dLog('pink', 'zenit',
            `We ${stopWaitForStatus ? 'stop wait for' : 'got'} status (source: ${source}):'${$vb.trt()}'`);
        globalStatus = $vb.trt();
        return $vb.trt();
    };
    const checkSuccess = async () => {
        const status = await waitForStatus('checkSuccess');
        if (status.indexOf('Maximum exceeded') > -1) {
            const maxes = await bMess('Stake Maximums')
                .infinite()
                .catch(e => 0);
            await bMess('Stake Maximums').set(maxes + 1);
            dLog('yellow', 'zenit', `Maximum exceeded ${maxes + 1} times`);
            if (maxes + 1 >= possibleMaximums) {
                throw 'STAKE_MAXED';
            }
            throw `checkSuccess maximum error (${maxes + 1} times): ${status}`;
        }
        if (status.indexOf('Please wait') > -1) {
            throw status;
        }
        if (status.indexOf('Please contact support') > -1) {
            limitedReason = status;
            limitedSend = false;
            limited = true;
            throw status + 'WITHDRAW_LIMITED';
        }
        return status.length > 0 && status.indexOf('successfully') > -1;
    };

    const proceedForkBet = async (dataIn, command, testing) => {
        // Hint: here we need open coupon or do bet (depending of shoulder number)
        if (testing) {
            dLog('green', 'zenit',
                [`proceedForkBet (shoulder: ${settings.fork.shoulder}):`, dataIn]);
            await delayPromise(30000);
            throw `Testing proceedForkBet!`;
        }
        const data = JSON.parse(JSON.stringify(dataIn));
        const res = await this.proceedBet(data, command, testing)
            .catch(e => null);

    };

    const $closeModal = any => {
        const searchFor = typeof any === 'string' ? any : 'Sign In';
        if (!!any) {
            return $('button[data-test="close-modal"]');
        } else {
            return $(`div.modal-content:has(h1:textEquals("${searchFor}")) button[data-test="close-modal"]`);
        }
    }

    const proceedForkBetConfirm = async (data, command, testing) => {
        // Hint: confirmation for bet if shoulder number is 2
        await delayPromise(10000);
        throw `Testing proceedForkBetConfirm!`;
    };

    const getRegistered = async (data, command, testing) => {
        dLog('green', 'zenit',
            [`getRegistered (${command}), testing: ${testing}:`, data]);
        if (await bMess('registerUsernameError')
            .check(300, false, true)
            .catch(() => false)) {
            dLog('red', 'zenit', `registerUsernameError`);
            await delayPromise(3000000);
            return;
        }
        if (await bMess('zenit_AlreadyRegistered')
            .check(300, false, true)
            .catch(() => false)) {
            dLog('green', 'zenit', `We registered already!`);
            return {
                success: true,
                message: `Already registered in auth!`,
            }
        }
        const
            regButtonSel = 'button[data-test="button-register"]',
            els = {
                'email': 'input[data-test="register-email"]',
                'login': 'input[data-test="register-name"]',
                'password': 'input[data-test="register-password"]',
                'birthDay': 'input[data-test="register-dob"][name="dob-day"]',
                'birthMonth': 'select[data-test="register-dob"][name="dob-month"]',
                'birthYear': 'input[data-test="register-dob"][name="dob-year"]',
            };
        // Hint: here the strange situation when we were reloaded page
        if ($closeModal('Create an Account').length > 0) {
            await clearAndSimulate($(els['password'])[0], data['password']);
            await delayPromise(3000);
            await mouseChain({target: $(els['agree'])[0], events: fullClick, error: 'els[agree]'});
            await delayPromise(3000);
            await mouseChain({target: $(regButtonSel)[0], events: fullClick, error: 'regButtonSel'});
            // Hint: here could be a captcha!
            await captchaWork(true);
            await waitForCondition(() => $closeModal('Create an Account').length !== 0,
                333, 10000, 'Create an Account still opened!')
                .catch(e => dLog('red', 'zenit', e));
            return {
                success: $closeModal('Create an Account').length === 0,
                message: $closeModal('Create an Account').length === 0
                    ? 'Account should be created after reload!'
                    : 'Create an Account still opened!',
            }
        }
        onlyCheck();
        const waitTime = 60000 + 60000 + waitForCaptchaSolved * 1.5 + 3000;
        // Hint: First - we should try to login
        dLog('blue', 'zenit',
            `We should wait for loaded and was try to login or authorized for ${waitTime}`);
        const check = () =>
            !!weAreSurePageLoaded
            // Hint: page should be loaded and we should try to login or we should be authorized
            && (authorized || (tryingToLogIn > 0 && (enterError || invalidCredentials)));
        await waitForCondition(check,
            250, waitTime,
            `We still not sure page loaded (${!!weAreSurePageLoaded}) `
            + `or we are not authorized (${authorized}) `
            + `or we not tried to login (${tryingToLogIn}) `
            + `or we haven't enter errors (${enterError}) or invalid credentials (${invalidCredentials})`);
        if (!authorized && enterError && !invalidCredentials) {
            throw `There were enter errors!`;
        }
        if (!invalidCredentials || authorized) {
            await bMess('STAKE_AlreadyRegistered').set(true);
            return {
                success: true,
                message: `Already registered in getRegistered!`,
            }
        }
        dLog('blue', 'Stake', 'registerProcess started!');
        registerProcess = true;
        const $closeModalSel = await waitForElement($closeModal, 250, 1000)
            .catch(e => $([]));
        if ($closeModalSel.length > 0) {
            await mouseChain({
                target: $closeModalSel[0],
                events: fullClick,
                error: '$close'
            });
            dLog('green', 'zenit', `Closed login modal`);
            await delayPromise(1000);
        } else {
            dLog('green', 'zenit', `Login modal already closed`);
        }
        await mouseChain({
            target: (await waitForElement('button[data-test="register-link"]', 250, 40000))[0],
            events: fullClick,
            error: '$reg'
        });
        if (testing) {
            dLog('big-orange', 'zenit', 'Started just waiting for 30 seconds...');
            await delayPromise(30000);
            if ($closeModal(true).length > 0) {
                await mouseChain({
                    target: $closeModal(true)[0],
                    events: fullClick,
                    error: '$close 123'
                });
                dLog('green', 'zenit', `Closed login modal`);
                await delayPromise(1000);
            }
            delayPromise(1000)
                .then(() => window.location.reload());
            return {
                success: true,
                message: `Testing getRegistered!`,
            }
        }
        const parts = data.birthdate.split('.');
        data['birthDay'] = parts[0];
        data['birthMonth'] = parts[1];
        data['birthYear'] = parts[2];
        await waitForCondition(() => Object.values(els)
                .every(e => $(e).length > 0),
            250, 10000, 'Els not shown!');
        await delayPromise(1000);
        for (const k of Object.keys(els)) {
            if (k === 'birthMonth') {
                await selectLikePuppeteer($(els[k])[0], [parseInt(data[k]).toString()]);
            } else if (k === 'email') {
                if ($(els[k]).val() !== data[k]) {
                    await clearAndInputEmail($(els[k])[0], data[k]);
                }
            } else if (['birthDay', 'birthYear'].indexOf(k) > -1) {
                if ($(els[k]).val() !== data[k]) {
                    await clearAndInputNumber($(els[k])[0], data[k]);
                }
            } else {
                if (k === 'password' || $(els[k]).val() !== data[k]) {
                    await clearAndSimulate($(els[k])[0], data[k]);
                }
            }
            await delayPromise(3000);
        }
        const inputError = $('div.input-error').trt();
        dLog('red', 'zenit', `inputError: ${inputError}`);
        if (['contains invalid characters', 'must be less than 14',]
            .some(r => inputError.indexOf(r) > -1)) {
            await bMess('registerUsernameError')
                .set(true);
            registerUsernameError = true;
        }
        await mouseChain({
            target: $(regButtonSel)[0], events: fullClick, error: 'data-test="button-register"'
        });
        // Hint: Here could be a registerUsernameError way 2 - You cannot register from your current location.
        waitForError(true)
            .then(e => dLog('green', 'zenit', `waitForError 2 done: ${e}`));
        // Hint: new terms
        await proceedTaC();
        // Hint: here could be a captcha!
        await captchaWork(true);
        await waitForCondition(() => $closeModal('Create an Account').length !== 0,
            333, 10000, 'Create an Account still opened!')
            .catch(e => dLog('red', 'zenit', e));
        if ($closeModal('Create an Account').length === 0 && !!findSel(sureSelectors)) {
            dLog('green', 'zenit', `We should to reload page!`);
            delayPromise(10000)
                .then(() => window.location.reload());
        }
        registerProcess = false;
        if ($closeModal('Create an Account').length === 0) {
            await bMess('STAKE_AlreadyRegistered').set(true);
        }
        return {
            success: $closeModal('Create an Account').length === 0,
            message: $closeModal('Create an Account').length === 0
                ? 'Account should be created - main approach!'
                : 'Create an Account still opened!',
        }
    };

    const proceedTaC = async quick => {
        if (!!quick && $('#Terms_and_Conditions:visible').length === 0) {
            return;
        }
        if (proceedTaCActive) {
            dLog('orange', 'zenit', 'proceedTaCActive - return');
            return;
        }
        proceedTaCActive = true;
        try {
            let $TaC = () => waitForElement('#Terms_and_Conditions',
                250, 3000, true)
                .catch(e => $([]));
            dLog('', 'zenit', 'TaC - work');
            while ((await $TaC()).length > 0) {
                dLog('yellow', 'zenit', 'Terms and Conditions');
                const $tAcDiv = $('div[data-test="terms-content"]');
                await delayPromise(3000);
                $tAcDiv.get(0).scrollTop = $tAcDiv.get(0).scrollHeight;
                await delayPromise(5000);
                const $acceptTerms = $('label[data-test="accept-terms"]');
                if ($acceptTerms.length > 0) {
                    await mouseChain({
                        target: $acceptTerms[0],
                        events: fullClick, error: 'accept-terms'
                    });
                    await delayPromise(3000);
                }
                await mouseChain({
                    target: $('button[data-test="submit-terms"]')[0],
                    events: fullClick, error: 'submit-terms'
                });
                await delayPromise(1000);
            }
            proceedTaCActive = false;
        } catch (e) {
            proceedTaCActive = false;
            dLog('red', 'zenit', `proceedTaC error: ${e}, ${formatStack(e.stack)}`);
            throw e;
        }
    };

    const calcStake = async stakeIn => {
        let res;
        if (typeof stakeIn !== 'string' || stakeIn.indexOf('%') === -1) {
            res = parseFloat(stakeIn);
        } else {
            const lastBets = await storeBet(-1, true);
            res = parseFloat(roundTo((getBalance() + lastBets)
                * parseFloat(stakeIn.replace('%', '')) / 100,
                0.1).toFixed(2));
        }
        dLog('', 'zenit', `calcStake(${stakeIn}) = ${res}`);
        return res;
    };

    const proceedBet = async (data, command, testing) => {
        if (!!testing) {
            dLog('blue', 'zenit', `We'll sleep 10s because of testing!`);
            await delayPromise(10000);
            return {
                success: true,
                message: {
                    coef: 1.5,
                    stake: await calcStake(data[0].stake),
                    max: 100500,
                },
            }
        }
        for (const d in data) {
            if (['esports.lol', 'soccer.cyber'].indexOf(data[d].sport) > -1) {
                data[d].sport = 'CYBERSPORT';
            }
            //data[d].direct_link = null;
        }
        const fields = ['team1', 'team2', 'home', 'away',];
        for (const d of data) {
            if (fields.some(f => d[f] === 'EHC Red Bull München' || d[f] === 'EHC Red Bull Munchen')) {
                throw `We don't bet to EHC Red Bull München!`;
            }
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
        if (command === 'BET' && !!currentBetData.data[0].betFromParser) {
            const eventName = `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`;
            if (!await eventsWork('zenit', settings, eventName, false, true)) {
                throw `Max amount of bets ${settings.eventMaxBets} to ${eventName} already done!`;
            } else {
                dLog('big-blue', 'STAKE',
                    `We'll do bet to ${eventName} because of ${settings.eventMaxBets} not reached `
                    + `and wasSuccessStake ${successDiff} > ${realSuccessInterval}!`);
            }
        }
        await closePrevious();
        await waitForCondition(() => !!getBalance(true), 50, 5000)
            .catch(() => `Balance still zero :(`);
        let willPlace = await calcStake(data[0].stake);
        if (!willPlace) {
            throw `Bad will place: ${willPlace}, ${data[0].stake}, ${await calcStake(data[0].stake)}`;
        }
        checkBalance(willPlace);
        await openCoupon(data);
        do {
            waitForStatus('proceedBet', 5, 10000)
                .then(() => console.log(`waitForStatus('proceedBet') done!`));
            await checkCoefs(data);
            checkBalance(willPlace);
            const place = willPlace.toString().replace('.00', '').trim();
            dLog('green', 'zenit', `Will place (performBet): ${place}, balance: ${getBalance()}`);
            const $input = () => $('input[data-test="input-bet-amount"]');
            if ($input().length !== 1) {
                throw `2 Wrong number of bet's inputs: ${$input.length}`;
            }
            if (parseFloat($input().val().toString()) !== parseFloat(place)) {
                $input().val(place);
                fireInputEvent($input()[0]);
                fireChangeEvent($input()[0]);
                await delayPromise(300);
            }
            const $pb = $(findSel(placeBetSels));
            stopWaitForStatus = true;
            if ($pb.length !== 1) {
                throw `No place button or its not active! ${globalStatus}`;
            } else {
                await mouseChain({target: $pb[0], events: fullClick, error: '$pb'});
                dLog('green', 'zenit', `Place bet ${findSel(placeBetSels)} clicked!`);
            }
        } while (!await checkSuccess());
        let res = {}, tries = 0;
        do {
            if (tries > 0) {
                await delayPromise(1000);
            }
            res = await collectBetResult(false);
        } while (!res.external_id && tries < 5);
        if (!res.external_id) {
            throw `It looks like bet placed, but not connected!`;
        }
        dLog('green', 'zenit', [`Bet placed:`, res]);
        return {
            success: true,
            message: res,
        }
    };

    const checkCoefs = async data => {
        const findInData = match => data.find(v =>
            locutus_similar_text(`${v.team1} - ${v.team2}`.toLowerCase(), match.toLowerCase(), true) > 70);
        const $coupons = $('div[data-test="betslip-bet"]');
        const errors = [];
        let checked = 0;
        let totalCoef = 1;
        $coupons.each(function () {
            const $this = $(this);
            const match = $(this).find('a.variant-subtle-link span span').trt();
            let localCoef = parseFloat($this.find('div.odds').trt());
            console.log(`checkCoefs ${match} - ${localCoef}`);
            let localData = findInData(match);
            totalCoef = totalCoef * (isNaN(localCoef) ? 1 : localCoef);
            if (!localData || isNaN(localCoef)) {
                errors.push(`LOW_COEF - wrong match (${match}) or localCoef (${localCoef})!`);
                checked++;
            } else {
                checked++;
            }
        });
        if (errors.length === 0 && checked === data.length) {
            const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef))
                ? parseFloat(data[0].coef) : totalCoef / 1.21;
            if (totalCoef >= nCheck * 1.2) {
                throw `Coef TOO BIG: ${totalCoef} instead of ${data[0].coef}`;
            } else if (totalCoef < nCheck) {
                throw `LOW_COEF ${data[0].coef} > ${totalCoef}`;
            } else {
                return `Coefs fine! here: ${totalCoef}, need: ${nCheck}/${data[0].coef}`;
            }
        } else {
            throw errors.join('; ') + (checked !== data.length
                ? ` some stakes not checked (${checked}/${data.length})!` : '');
        }
    };

    // Test:
    /*
    await checkCoefs([
        {team1: 'FC Pacos Ferreira', team2: 'CS Maritimo Madeira', coef: '2.1'},
        {team1: 'SL Benfica', team2: 'GD Chaves', coef: '2.1'},
    ]);
     */

    const collectBetResult = async $betIn => {
        let $bet = $([]);
        if (!$betIn) {
            const
                $mbs = () => $(viewMyBetsSel),
                $mb = () => $('button[aria-label="Open Dropdown"]')
                    .find('span:textEquals("My Bets")'),
                $a = () => $('button.variant-tabmenu').find('span:textEquals("Active")');
            await delayPromise(300);
            await waitForCondition(() => [$mbs, $mb, $a].some($r => $r().length > 0),
                250, 10000, false, 1, 'No [mbs, mb, a]!');
            if ($mbs().length > 0) {
                await mouseChain({target: $mbs()[0], events: fullClick, error: 'viewMyBetsSel'});
                await delayPromise(1000);
            } else if ($mb().length > 0 && $a().length > 0 && !$a().hasClass('active')) {
                await mouseChain({target: $a()[0], events: fullClick, error: 'collectBetResult a'});
                await delayPromise(1000);
            }
            $bet = (await waitForElement('div.betlist-scroll div.sport-bet-preview',
                250, 10000)).eq(0);
        } else {
            $bet = $betIn;
        }
        if ($bet.length === 0) {
            throw `collectBetResult - no $bet!`;
        }
        const $d = await waitForElement(() => $bet.find('button.variant-subtle-link')
            .find('use').first(), 250, 10000, false, 1, 'No USE');
        await mouseChain({target: $d[0], events: fullClick, error: 'USE', scroll: true});
        await delayPromise(500);
        const id = () => $('h2.weight-semibold:contains("ID")').trt().replace(/\D/g, '');
        await waitForCondition(() => !!id() > 0 && !!parseInt(id()),
            250, 10000, 'No ID');
        const external_id = id();
        await mouseChain({
            target: $closeModal(true)[0], events: fullClick,
            error: 'bet detaild close'
        });
        await delayPromise(500);
        const statusDraft = $bet.find('div.date-time div.badge').trt();
        return {
            external_id,
            coef: parseFloat($bet.find('div.total-odds').trt()),
            stake: parseFloat($bet.find('div.total-stake').trt()),
            payout: parseFloat($bet.find('span.payout').trt()),
            max: '7777777',
            status: statusDraft === 'Win' ? 'WON' : statusDraft === 'Loss' ? 'LOSE' : 'ACCEPTED',
        };
    };

    const collectBetResults = async (inD, command) => {
        const collected = [];
        const data = inD.length === 2 && inD[0] === 'limit' ? [] : inD;
        const limit = inD.length === 2 && inD[0] === 'limit'
            ? (parseInt(inD[1]) <= 30 ? parseInt(inD[1]) : 30) : 30;
        let captured = 0;
        await mouseChain({
            target: $('a[href="/sports/my-bets"]')[0],
            events: fullClick, error: 'collectBetResults 1'
        });
        await waitForElement('div.page-content span:textEquals("My Bets")', 250, 10000);
        await delayPromise(5000);
        let gone = 0;
        for (const cur of ['Active', 'Settled']) {
            captured++;
            if (captured > limit) {
                break;
            }
            const $cur = await waitForElement(`a.variant-tabmenu:textEquals("${cur}")`,
                250, 5000);
            if (!$cur.hasClass('active')) {
                await mouseChain({target: $cur[0], events: fullClick, error: '$cur'});
                await delayPromise(15000);
            }
            do {
                await $('div.page-content div.sport-bet-preview').eachAsync(async function () {
                    gone++;
                    const res = await collectBetResult($(this));
                    dLog('', 'zenit', [`We got:`, res]);
                    if (!!res.external_id && (data.length === 0 || data.indexOf(res.external_id) > -1)) {
                        collected.push({
                            external_id: res.external_id,
                            coef: res.coef,
                            stake: res.stake,
                            status: res.status,
                            result: res.status === 'ACCEPTED' ? '0' : res.payout,
                        });
                    }
                    if (gone > limit) {
                        return false;
                    }
                });
                const $next = $('button[data-test="pagination-next"]');
                if (gone <= limit && $next.length > 0 && !$next.is(':disabled')) {
                    await mouseChain({target: $next[0], events: fullClick, error: '$next'});
                    await delayPromise(10000);
                } else {
                    break;
                }
            } while (gone <= limit);
        }
        dLog('green', 'zenit', ['Collected', collected]);
        return {success: true, message: collected};
    };

    const withdraw = async (data, command, testing) => {
        dLog('orange', 'zenit', [`Withdraw (${command}/${testing})`, data]);
        if (!data.address || !(data.amount === '0' || !!data.amount) || !data.email) {
            throw 'No address or amount or email!';
        }
        await waitForCondition(() => getBalance() > 1, 250, 30000, 'No balance!');
        let amount = parseFloat(data.amount);
        if (amount !== 0 && amount < 3) {
            throw `Amount is too low: ${amount} instead of 3!`;
        } else if (amount > getBalance()) {
            throw `Amount is too high: ${amount} instead of ${getBalance()}!`;
        }
        const response = `Will withdraw ${amount} to ${data.address} using ${data.email}`;
        dLog('green', 'zenit', response);
        await mouseChain({
            target: $('button[data-test="wallet"]')[0], events: fullClick,
            error: 'data-test="wallet"',
        });
        const $w = await waitForElement('button[data-test="wallet-nav-withdraw"]',
            250, 10000);
        await delayPromise(500);
        await mouseChain({target: $w[0], events: fullClick, error: '$w'});
        let started = (Date.now() / 1000), notificationText = 'new';
        const $resend =
            await waitForElement('button[type="submit"]:has(span:textEquals("Resend Email"))',
                250, 10000).catch(() => $([]));
        await delayPromise(500);
        if ($resend.length > 0) {
            const resents = await bMess('Resend emails')
                .check(90000000)
                .catch(e => 0);
            dLog('orange', 'zenit', `Resend email found ${resents}!`);
            if (resents > 3) {
                throw `We already sent email ${resents} times!`;
            }
            // Hint: here we need to get a new email
            let success = false, attempt = 0, onlyWait = false;
            while (!success && attempt < 5) {
                attempt++;
                if (!onlyWait) {
                    await mouseChain({target: $resend[0], events: fullClick, error: '$resend'});
                    await bMess('Resend emails').set(resents + 1);
                    dLog('orange', 'zenit', 'Resend clicked!');
                }
                // div.notification-body.svelte-r1rone.with-body
                // Verification email resent to tesm**********@yahoo.com
                // Verification email resent to rich***************@outlook.com
                // Hint: here could be a captcha
                const $notification = await waitForElement('div.notification-body',
                    100, 60000, true)
                    .catch(() => $([]));
                notificationText = $notification.trt();
                if (notificationText.indexOf('You are not allowed to do that') > -1) {
                    dLog('red', 'zenit', `Captcha (${notificationText}) wait 5s!`);
                    await delayPromise(5000);
                    onlyWait = true;
                } else if (notificationText.indexOf('Email Confirmed') > -1) {
                    dLog('red', 'zenit', `Email confirmed, let's withdraw!`);
                    success = true;
                    await delayPromise(5000);
                    await mouseChain({
                        target: $('button[data-test="close-modal"]')[0],
                        events: fullClick, error: 'modal2'
                    });
                    await delayPromise(5000);
                    return await withdraw(data, command, testing);
                } else if (notificationText.indexOf("resent to") === -1) {
                    dLog('red', 'zenit',
                        `Strange notification ('${notificationText}') wait 0.5s!`);
                    await delayPromise(500);
                    onlyWait = true;
                } else {
                    success = true;
                }
            }
            if (!success) {
                throw `Couldn't resent email ${attempt} times!`;
            }
            dLog('green', 'zenit', `Starting wait for email`);
            let confirmationUrl = '';
            await waitForCondition(async () => {
                const tick = await bsNewEmailCheck(data.email, 'STAKE_WELCOME',
                    started, true);
                if (tick && typeof tick === 'object' && tick['STAKE_WELCOME'] && tick['STAKE_WELCOME']?.data) {
                    confirmationUrl = tick['STAKE_WELCOME'].data;
                    return true;
                }
                return false;
            }, 10000, 330000, `No email for ${response}!`);
            document.location.href = confirmationUrl;
            await delayPromise(10000);
            throw `Testing ${response} - GOT NEW!`;
        } else {
            await ensureNetwork('bsc');
            const
                $address = await waitForElement('input[data-test="withdrawal-address"]',
                    250, 30000, true),
                $amount = await waitForElement('input[data-test="withdraw-amount"]',
                    250, 30000, true);
            await delayPromise(500);
            await clearAndSimulate($address[0], data.address);
            await delayPromise(500);
            if (amount === 0) {
                await mouseChain({
                    target: $('button:textEquals("Max")')[0], events: fullClick,
                    error: 'max'
                });
            } else {
                await clearAndInputNumber($amount[0], amount);
            }
            await delayPromise(500);
            await mouseChain({
                target: $('button[data-test="withdraw-submit"]')[0],
                events: fullClick, error: 'withdraw-submit',
            });
            const $email = await waitForElement('input[data-test="email-code"]',
                250, 30000, true);
            let success = false, attempt = 0;
            while (!success && attempt < 3) {
                attempt++;
                dLog('green', 'Stake', `Starting wait for confirmation code ${attempt}`);
                let withdrawalCode = '';
                await waitForCondition(async () => {
                    const tick = await bsNewEmailCheck(data.email, 'STAKE_WITHDRAW_CODE',
                        started, true).catch(e => e);
                    if (tick && typeof tick === 'object' && tick['STAKE_WITHDRAW_CODE'] && tick['STAKE_WITHDRAW_CODE']?.data) {
                        withdrawalCode = tick['STAKE_WITHDRAW_CODE'].data;
                        return true;
                    }
                    return false;
                }, 10000, 300000, `No email for ${response}!`);
                await clearAndSimulate($email[0], withdrawalCode);
                await delayPromise(2500);
                // div.notification-body.svelte-r1rone.with-body
                // Invalid Email code or withdrawal address.
                await mouseChain({
                    target: $('button[data-test="withdraw-complete"]')[0],
                    events: fullClick, error: 'withdraw-complete',
                });
                const $notification = await waitForElement('div.notification-body',
                    100, 10000, true);
                notificationText = $notification.trt();
                if (notificationText.indexOf("Invalid") > -1) {
                    started = (Date.now() / 1000);
                    await mouseChain({
                        target: $('button:textEquals("Request a new code")')[0],
                        events: fullClick, error: 'Request',
                    });
                    // div.notification-body.svelte-r1rone.with-body
                    // Verification email resent to kamp**************@yahoo.com
                    await delayPromise(500);
                } else if (notificationText.indexOf("was successful") > -1) {
                    // div.notification-body.svelte-r1rone.with-body
                    // Withdrawal  Your withdrawal of  4.00000000   was successful.
                    success = true;
                } else {
                    throw `Unknown notification: ${notificationText}`;
                }
            }
            await mouseChain({
                target: $('button[data-test="close-modal"]')[0],
                events: fullClick, error: 'modal2'
            });
        }
        return {success: true, message: notificationText + (data.email === 'DIRECT' ? ' (DIRECT)' : '')};
    };

    const checkMaximums = async (from, command, silent) => {
        const
            maxes = await bMess('Stake Maximums').infinite(true),
            balance = await getBalance(),
            checkOne = maxes && maxes >= possibleMaximums && balance < 1,
            checkTwo = maxes && maxes >= possibleMaximums && command !== 'WITHDRAW',
            maximumsWasSent = await checkMaximumsSent(from, silent);
        if (maximumsWasSent > -1) {
            return maximumsWasSent;
        }
        if (!silent) {
            dLog('orange', 'zenit',
                `Maximums from ${from}: ${maxes}, balance: ${balance}, one: ${checkOne}, two: ${checkTwo}`);
        }
        if (checkOne) {
            throw 'Maximums reached, no balance for withdrawal!';
        } else if (checkTwo) {
            dLog('orange', 'zenit', 'Start executing maximumWithdrawal!');
            // STAKE_MAXED
            await commands.maximumWithdrawal(from);
            throw 'Maximums reached, withdrawal request sent! STAKE_MAXED';
        }
    }

    /**
     * Check if maximums was sent
     * @param from - executed from
     * @param silent
     * @return {Promise<number>}
     */
    const checkMaximumsSent = async (from, silent) => {
        const wasSent = await bMess('Maximums sent').infinite(true);
        if (!silent) {
            dLog('blue', 'maximumWithdrawal', [`Maximums was sent from ${from}:`,
                wasSent]);
        }
        if (wasSent !== null && wasSent.success && wasSent.timestamp
            && Date.now() - wasSent.timestamp < ONE_HOUR) {
            if (!silent) {
                dLog('', 'zenit',
                    'Maximums was sent successfully, next not early than '
                    + (ONE_HOUR - (Date.now() - wasSent.timestamp)) / 1000 / 60 + ' minutes');
            }
            return (ONE_HOUR - (Date.now() - wasSent.timestamp)) / 1000;
        } else if (wasSent !== null && !wasSent.success && wasSent.timestamp
            && Date.now() - wasSent.timestamp < TEN_MINUTES) {
            if (!silent) {
                dLog('', 'zenit',
                    'Maximums was sent with error, next not early than '
                    + (TEN_MINUTES - (Date.now() - wasSent.timestamp)) / 1000 + ' seconds');
            }
            return (TEN_MINUTES - (Date.now() - wasSent.timestamp)) / 1000;
        }
        return -1;
    };

    const commands = new class commands {
        constructor() {
            this.testing = false;
            this.wasRegister = false;
            this.register = {
                bk: '',
                email: '',
                login: '',
                password: '',
                birthdate: '',
                name: '',
                last_name: '',
                country: '',
                address: '',
                city: '',
                zip: '',
                job: '',
                amount: '',
                binance_api: '',
            };
            this.cLinks = {
                'BET': proceedBet,
                'EXPRESS_BET': proceedBet,
                'FORK_BET': proceedForkBet,
                'FORK_BET_CONFIRM': proceedForkBetConfirm,
                'BET_RESULT': collectBetResults,
                'REGISTER_NEW': getRegistered,
                'WITHDRAW': withdraw,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async executeInternal(command, data) {
            if (fillUpStarted) {
                throw 'Fill up is in progress!';
            }
            //await checkMaximums('executeInternal', command);
            currentBetData.init(data);
            if (command === 'REGISTER_NEW') {
                this.wasRegister = true;
                this.register = data;
                this.testing = data.login === "*** TEST ***";
                dLog('', 'zenit', [`execute REGISTER_NEW, ${this.wasRegister}:`, this.register]);
            }
            let res;
            if (!this.testing && settings.forkOnly && ['BET', 'EXPRESS_BET'].indexOf(command) !== -1) {
                res = {success: false, message: 'Fork only mode'};
            } else {
                res = await this.cLinks[command](data, command, this.testing).catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            }
            return res;
        }

        async execute(command, data) {
            // Hint: the goal of executeInternal is to catch errors thrown during execution
            const res = await this.executeInternal(command, data)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            dLog((res.success ? 'green' : 'red'), 'zenit', [`${command} execute result:`, res]);
            this.prepareResult(command, res)
                .then(m => {
                    port.postMessage(m);
                    dLog('blue', 'zenit', [`prepareResult was sent:`, m]);
                })
                .catch(e => dLog('error', 'zenit', [`prepareResult result: ${e} for:`, res]));
            if (!res.success && res.message.indexOf('STAKE_MAXED') > -1) {
                busy = true;
                //await checkMaximums('execute', command);
            }
            if (!res?.success) {
                throw res?.message || 'Unknown error';
            }
            return res;
        }

        async maximumWithdrawal(point) {
            dLog('green', 'maximumWithdrawal', `Got from point: ${point}`);
            busy = true;
            fillUpStarted = true;
            switchingCurrency = true;
            ourCurrency = 'usdt';
            try {
                await delayPromise(1000);
                await mouseChain({
                    target: $('button[data-test="wallet"]')[0], events: fullClick,
                    error: 'data-test="wallet"'
                });
                bscAddress = await getWalletAddress(await $toggle(),
                    ourCurrency, 'bsc');
                await delayPromise(1000);
                dLog('green', 'zenit', `Got withdrawal address: ${bscAddress}!`);
                // Hint: We should to ask server retrieve withdrawal
                const res = await bsNewEmailCheck(bscAddress,
                    'STAKE_WITHDRAWAL_REQUEST_71032', -1, true,
                    getBalance());
                dLog('blue', 'STAKE', [`Answer for withdrawal request:`, res]);
                await bMess('Maximums sent').set({
                    success: true,
                    timestamp: Date.now(),
                });
            } catch (e) {
                dLog('red', 'Stake', `MaximumWithdrawal error: ${e}, ${formatStack(e.stack)}`);
                await bMess('Maximums sent').set({
                    success: false,
                    timestamp: Date.now(),
                });
            }
            busy = false;
            fillUpStarted = false;
            switchingCurrency = false;
        }

        async prepareResult(command, res) {
            dLog('', 'Stake', [`prepareResult '${command}':`, res, currentBetData,]);
            if (['BET', 'EXPRESS_BET', 'FORK_BET'].indexOf(command) > -1) {
                if (res.success) {
                    await eventsWork('stake', settings,
                        `${currentBetData.data[0].team1} - ${currentBetData.data[0].team2}`,
                        true, false);
                    await bMess('WasSuccessStake').set(Date.now());
                    await storeBet(res.message.stake, true);
                    await bMess('Stake Maximums').set(0);
                }
                let balance = 0;
                await waitForCondition(() => (balance = getBalance(), balance > 0), 250, 5000)
                    .catch(() => dLog('red', 'Stake',
                        `It seems like it is really zero on the balance :(`));
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
                    balance,
                };
                /*
                const t = {
                    "type": "VALUE",
                    "mode": "LIVE\/PREMATCH",
                    "bookmaker": "STAKE",
                    "coef": 2.3,
                    "placedCoef": 2.2,
                    "source": "VTS",
                    "externalId": "mixed bk bet id",
                    "currency": "ISO4217 string USD",
                    "stake": 345.45,
                    "sport": "FOOTBALL\/HOCKEY\/TENNIS\/BASKETBALL\/VOLLEYBALL\/HANDBALL\/BASEBALL\/TABLETENNIS\/CYBERSPORT",
                    "market": "ONE_TWO\/TOTAL\/T1_TOTAL\/T2_TOTAL\/CORNER_TOTAL\/YC_TOTAL\/HDP\/CORNER_HDP\/YC_HDP\/EURO_HDP",
                    "target": "ONE\/TWO\/DRAW\/OVER\/UNDER\/HOME\/AWAY\/ONE_TWO\/ONE_DRAW\/TWO_DRAW\/H1\/H2\/HX",
                    "pivot": 2.5,
                    "timeValue": "FULL_TIME\/1_SET\/2_GAME\/3_QUARTER\/1_PERIOD\/2_INNING\/2_TIME\/1_HALF\/3_MAP\/3_SET_2_GAME",
                    "league": "string",
                    "homeTeam": "string",
                    "awayTeam": "string",
                    "score": "1-0"
                };
                 */
                const doNotSend = !!currentBetData.data[0].betFromParser && !res.success
                    && resultData.status !== 'LIMITED';
                if (!!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED') {
                    resultData.type = 'VALUE';
                    resultData.mode = currentBetData.data[0].type;
                    resultData.bookmaker = 'STAKE';
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
                return {
                    answered: !!currentBetData.data[0].betFromParser && resultData.status !== 'LIMITED'
                        ? "F_BET" : "BET",
                    data: resultData,
                    answer: res.success ? 'Everything is Okay!' : res.message,
                    doNotSend,
                };
            } else if (command === 'BET_RESULT') {
                return {
                    answered: "BET_RESULT",
                    status: res.success ? "success" : "error",
                    answer: res.message
                };
            } else if (command === 'REGISTER_NEW') {
                dLog('orange', 'stake', [`prepareResult for REGISTER_NEW`,
                    `authCheckStarted: ${authCheckStarted}, lastAuthCheck: ${Date.now() - lastAuthCheck}ms ago`]);
                if (authCheckStarted > 0 && Date.now() - lastAuthCheck > settings.authCheckInterval + 2000) {
                    authCheckStarted = 0;
                }
                if (res.success) {
                    authCheck(`prepareResult for REGISTER_NEW`);
                } else {
                    dLog('orange', 'Stake', `There were errors till registration: ${res.message}`);
                }
                return {
                    answered: "REGISTER_NEW",
                    status: res.success ? "success" : "error",
                    answer: res.message
                };
            } else if (command === 'WITHDRAW') {
                const withdrawalResult = {
                    answered: "WITHDRAW",
                    status: res.success ? "success" : "error",
                    answer: res.message,
                };
                if (currentBetData?.data?.queue_id) {
                    withdrawalResult.queue_id = currentBetData.data.queue_id;
                }
                if (res.success) {
                    delayPromise(30000)
                        .then(() => {
                            port.postMessage({
                                answered: 'CHECK_BUSY',
                                answer: busy ? 'BUSY' : 'FREE',
                            });
                            dLog('', 'Stake', `CHECK_BUSY after 30s: ${busy}`);
                        });
                    delayPromise(60000)
                        .then(() => {
                            port.postMessage({
                                answered: 'CHECK_BUSY',
                                answer: busy ? 'BUSY' : 'FREE',
                            });
                            dLog('', 'Stake', `CHECK_BUSY after 60s: ${busy}`);
                        });
                }
                dLog('big-orange', 'Stake', ['WITHDRAWAL RESULT:', withdrawalResult]);
                return withdrawalResult;
            } else {
                return {};
            }
        }
    }

    const messageProcessor = message => {
        dLog('green', 'stake', [`messageProcessor (${busy}/${window.self === window.top})`,
            message]);
        let letsAuth = false;
        if (limited) {
            return;
        }
        if (message.action === 'REGISTER_NEW') {
            settings.login = message.data.login;
            settings.password = message.data.password;
            settings.uid = message.data.uid;
            dLog(`yellow`, 'stake', [`messageProcessor REGISTER_NEW settings:`, settings,]);
            authCheck(`message.action === 'REGISTER_NEW'`);
        }
        if (message.action === 'CHECK_BUSY') {
            port.postMessage({
                answered: message.action,
                answer: busy ? 'BUSY1' : 'FREE',
            });
        } else if (message.action === "auth" || letsAuth) {
            port.postMessage({m: "AUTH " + message.login + ' / ' + message.password});
            settings.login = message.login;
            settings.password = message.password;
            settings.phone = message.phone;
            settings.email = message.email;
            settings.uid = message.uid;
            settings.fork = message.fork;
            settings.forkOnly = typeof message.fork === 'object' && Object.keys(message.fork).length > 0;
            settings.stake_fork = message?.stake_fork;
            settings.eventMaxBets = message?.stake_fork?.eventMaxBets || 3;
            settings.eventTimeLimit = message?.stake_fork?.eventTimeLimit * 1000 || 7200000;
            settings.betweenBets = message.betweenBets || 40000;
            if (settings.login === '*** TEST ***') {
                commands.testing = true;
            } else {
                authCheck(`message.action === "auth" (${message.action === "auth"}) || letsAuth (${letsAuth})`);
            }
            dLog(`yellow`, 'stake', [`messageProcessor auth settings (testing: ${commands.testing}):`,
                settings,]);
        } else if (busy) {
            port.postMessage({
                answered: message.action,
                status: "error",
                answer: "BUSY2",
            });
        } else if (commands.exists(message.action)) {
            // Hint: execute command
            busy = true;
            ourCommand.set(message);
            // wait for login value
            waitForCondition(() => !!settings.login, 100, 10000)
                .then(() => commands.execute(message.action, message.data))
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
            dLog('green', 'stake', ['Command was set till unload:', ourCommand.get()]);
            // Hint: We allow payment to be done in 120 seconds for DEPOSIT
            bMess('stake')
                .set(ourCommand.get(), increaseDelay ? 150000 : 0);
        }
    }, true);

    const afterDOMLoaded = () => {
        bMess('stake',).check(40000, true)
            .then(currentCommand => {
                dLog('orange', 'stake',
                    [`Restoring at ${(window.self === window.top)}/${document.location.href} with:`,
                        currentCommand]);
                messageProcessor(currentCommand);
            })
            .catch(() => dLog('color: darkgray;', 'stake', 'No command!'));
        port.postMessage({m: "PAGE LOADED!"});
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    //return commands;
    return false;

})();
//dLog('big-red', 'stake', ['Stake script loaded!', t1s2t3]);
