(function () {

    "use strict";

    let command = {};

    let report = function (success, message) {
        dLog('orange', 'SKRILL', '-= ' + success + ' / ' + message + ' =-');
        chrome.storage.local.set({
            'DEPOSIT_RESULT': {
                success: success,
                message: message
            },
            'DEPOSIT_RESULT_WAS_SET': Date.now()
        });
        chrome.storage.local.remove(['SKRILL_COMMAND', 'SKRILL_COMMAND_WAS_SET'], function () {
            if (!success) {
                delayPromise(3333)
                    .then(() => {
                        if (command.close) {
                            closeWithCheck();
                        } else if (!command['iFrame']) {
                            window.location.href = command.data.url;
                        }
                    });
            } else if (command.close) {
                delayPromise(3333)
                    .then(closeWithCheck);
            }
        });
    };

    const closeWithCheck = function () {
        window.close();
        setTimeout(() => {
            // If we're here - window not closed...
            window.location.href = command.data.url;
        }, 3333);
    };

    const simpleEnterPin = async $pin => {
        console.log('%c -= simpleEnterPin =-', 'background: yellow; color: red; font-weight: bold;');
        dLog('green', 'Skrill', `We'd been asked about pin`);
        await clearAndSimulate($pin[0], command.data.pin);
        const sel = ['#send_code_btn:visible', '#login_btn:visible', 'button[type="submit"]',
            'button.ps-primary-button:contains("Log in")'].find(s => $(s).length > 0);
        await waitDelayClickF(sel, null, null, null, false)();
        await delayPromise(3333);
        const $e = $('div.generalError:visible');
        if ($e.length > 0) {
            throw $e.text().trim();
        }
    };

    const enterPin = async $pin => {
        console.log('%c -= enterPin =-', 'background: yellow; color: red; font-weight: bold;');
        bsLogger('green', 'Skrill', `We'd been asked about pin`);
        await clearAndSimulate($pin[0], command.data.pin);
        await waitDelayClickF('#login_btn:visible', null, null, null, false)();
        await delayPromise(3333);
        const $e = $('div.generalError:visible');
        if ($e.length > 0) {
            throw $e.text().trim();
        }
        return confirmAmount();
    };

    const pinOrEmailOnPage = () => {
        const pinEmailSelectors = [
            '#pin_option',
            '#email_code',
            '.sent-email__title.mat-card-title',
            'div.mat-radio-label-content:contains("PIN"):visible',
            'header.page-header:contains("ownership of this account")',
            'input[placeholder="Verification code"]',
            '#instrument_number:visible', '#pin_code',
            'input[name="verifyPin"]',
            'input[formcontrolname="challengeValue"]',
            'input[placeholder*="PIN"]',
        ];
        return checkSE(pinEmailSelectors, false, true);
    };

    const checkAndEnterPinOrEmail = async () => {
        let $po = $('#pin_option');
        const pinSelector = 'div.mat-radio-label-content:contains("PIN"):visible';
        const emails = ['#email_code', '.sent-email__title.mat-card-title',
            'ps-card-title:contains("Check your email")', 'ps-card.challenge-email input[name="verificationCode"]'];
        if ($(pinSelector).length > 0) {
            dLog('green', 'Skrill', `Other select PIN form`);
            await delayPromise(3333);
            await renewCommand();
            await mouseChain({
                target: $('button.ps-primary-button:contains("Next")')[0],
                events: ['click'], error: 'nexus',
            });
            await delayPromise(7777);
            return await checkAndEnterPinOrEmail();
        } else if ($('header.page-header:contains("ownership of this account")').length > 0) {
            dLog('green', 'Skrill', `Select PIN form`);
            await mouseChain({target: $('button:textEquals("Next")')[0], events: fullClick, error: 'next'});
            await delayPromise(5000);
            return await checkAndEnterPinOrEmail();
        } else if (checkSE(emails)) {
            dLog('green', 'Skrill',
                `checkAndEnterPinOrEmail - we'd been asked about email (${findSel(emails)})`);
            const started = Math.ceil(Date.now() / 1000);
            const startedInternal = Date.now();
            let code = '';
            while (code === '' && Date.now() - startedInternal < 210000) {
                const res = await bsEmailCheck(command.data.login, 'SKRILL_CONFIRM_CODE', started);
                dLog('green', 'Skrill', ['Email answer is', res]);
                if (res && res.status && res.status === 'success' && res.message && res.message[0] && res.message[0].data) {
                    code = res.message[0].data;
                    break;
                } else {
                    await delayPromise(5000);
                }
            }
            if (code === '') {
                throw `We didn't receive email code!`;
            }
            await clearAndSimulate($(findSel(['input[placeholder="Verification code"]', '#email_code',
                'ps-card.challenge-email input[name="verificationCode"]']))[0], code);
            await delayPromise(1000);
            await mouseChain({
                target: $(findSel(['button.submit', '#send_code_btn', 'button:contains("CONTINUE")']))[0],
                events: fullClick,
                error: 'send_code_btn'
            });
            await delayPromise(3000);
            return await checkAndEnterPinOrEmail();
        } else if ($po.length > 0) {
            dLog('orange', 'Skrill', 'PIN 1');
            await delayPromise(3333);
            await mouseChain({target: $po[0], events: ['click'], error: '$po'});
            await delayPromise(3333);
            await mouseChain({target: $('#login_btn')[0], events: ['click'], error: 'login_btn'});
            const $pin = await waitForElement('#instrument_number:visible', 333, 7777);
            await simpleEnterPin($pin);
            return true;
        } else {
            let $pin = $(['#instrument_number:visible', '#pin_code', 'input[name="verifyPin"]',
                'input[formcontrolname="challengeValue"]', 'input[placeholder*="PIN"]']
                .find(s => $(s).length > 0));
            if ($pin.length > 0) {
                dLog('orange', 'Skrill', 'PIN 2');
                await simpleEnterPin($pin);
                return true;
            } else {
                dLog('green', 'Skrill', 'Nor pin nor email code');
                return false;
            }
        }
    };

    const checkPinOrEmail = async performLoginAfter => {
        let $po = $('#pin_option');
        const $eo = $('#email_code');
        if ($eo.length > 0) {
            bsLogger('green', 'Skrill', `checkPinOrEmail - asked about email`);
            const started = Math.ceil(Date.now() / 1000);
            const startedInternal = Date.now();
            let code = '';
            while (code === '' && Date.now() - startedInternal < 210000) {
                const res = await bsEmailCheck(command.data.login, 'SKRILL_CONFIRM_CODE', started);
                bsLogger('green', 'Skrill', ['Email answer is', res]);
                if (res && res.status && res.status === 'success' && res.message && res.message[0] && res.message[0].data) {
                    code = res.message[0].data;
                    break;
                } else {
                    await delayPromise(5000);
                }
            }
            if (code === '') {
                throw `We didn't receive email code!`;
            }
            await clearAndSimulate($eo[0], code);
            await delayPromise(1000);
            await mouseChain({target: $('#send_code_btn')[0], events: fullClick, error: 'send_code_btn 2'})
        } else if ($po.length > 0) {
            await delayPromise(3333);
            await mouseChain({target: $po[0], events: ['click'], error: '$po 2'});
            await delayPromise(3333);
            await mouseChain({target: $('#login_btn')[0], events: ['click'], error: 'login_btn 2'});
            const $pin = await waitForElement('#instrument_number:visible', 333, 7777);
            return enterPin($pin)
        } else {
            let $pin = $('#instrument_number:visible');
            if ($pin.length > 0) {
                return enterPin($pin);
            } else if (performLoginAfter) {
                return performLogin();
            } else {
                return confirmAmount();
            }
        }
    };

    const performLogin = async () => {
        dLog('yellow', 'Skrill', '-= performLogin =-');
        await delayPromise(12000);
        await checkRecaptcha(6);
        const nls = 'button[translate="introduction.LOGIN"]';
        if ($(nls).length > 0) {
            await mouseChain({target: $(nls)[0], events: fullClick, error: 'nls'});
            await delayPromise(3500);
        }
        await delayPromise(3333);
        //await checkRecaptcha();
        const $email = $('#email');
        if ($email.val() !== command.data.login) {
            await clearAndInputEmail($email[0], command.data.login);
            await delayPromise(3333);
        }
        await clearAndSimulate($('#password')[0], command.data.password);
        await delayPromise(3333);
        let $remember = $('input[ng-model="storage.rememberMe"]');
        if ($remember.length > 0 && !$remember.prop('checked')) {
            await mouseChain({target: $remember[0], events: ['click'], error: '$remember'});
        }
        await delayPromise(3333);
        let $el = $('#login_btn');
        if (['BUTTON', 'INPUT'].indexOf($el.get(0).tagName) === -1) {
            $el = $el.find('button');
        }
        await mouseChain({
            target: $el[0],
            events: ['mouseover', 'mousedown', 'click', 'mouseup'],
            error: 'LoginButton 2'
        });
        await delayPromise(7777);
        await checkRecaptcha(7);
        await pinEmailProcessing();
        return checkPinOrEmail();
    };

    const checkRecaptcha = async source => {
        dLog('orange', 'Skrill', `checkRecaptcha (${source})`);
        if (await bMess('SKRILL_RECAPTCHA').check(30000).catch(() => null) === 'true') {
            dLog('orange', 'Skrill', `Wait for FRAME recapcha (${source})!`);
            await waitForConditionF(async () => await bMess('SKRILL_RECAPTCHA').check(30000).catch(() => null) === 'false',
                500, 200000, `FRAME reCaptcha (${source}) not solved for 200s`)();
            dLog('green', 'Skrill', `FRAME reCaptcha (${source}) solved!`);
            await renewCommand();
            C
        } else if ($('div.antigate_solver a.status').length > 0) {
            dLog('orange', 'Skrill', `Wait for recapcha (${source})!`);
            await waitForConditionF(async () => {
                let aStatus = $('div.antigate_solver a.status').last().text().trim();
                if (pinOrEmailOnPage()) {
                    dLog('orange', 'Skrill', 'pinOrEmailOnPage when reCaptcha :) !');
                    await renewCommand();
                    return true;
                } else if (aStatus === 'Solved') {
                    dLog('orange', 'Skrill', 'SOLVED!');
                    await renewCommand();
                    return true;
                } else if (aStatus.indexOf('Outdated') > -1) {
                    await mouseChain({target: $('a.control.reload')[0], events: ['click'], error: 'Outdated'})
                        .catch(e => console.log(e));
                    return false;
                } else {
                    return false;
                }
            }, 555, 200000, `reCaptcha (${source}) not solved for 200s`)();
            dLog('green', 'Skrill', `reCaptcha (${source}) solved!`);
        } else {
            //dLog('color: black; font-weight: bold;', 'Skrill', 'No recapcha!');
            dLog('orange', 'Skrill', 'No recapcha!');
        }
    };

    const checkRecaptchaFrame = async () => {
        dLog('black', 'Skrill', `checkRecaptchaFrame at ${document.location.href}`);
        const $r = await waitForElement('div.antigate_solver a.status', 200, 10000);
        if ($r.length > 0) {
            dLog('black', 'Skrill', `FRAME recapcha at ${document.location.href}`);
            await bMess('SKRILL_RECAPTCHA').set('true');
            await waitForConditionF(async () => {
                let aStatus = $('div.antigate_solver a.status').last().text().trim();
                if (aStatus === 'Solved') {
                    dLog('black', 'Skrill', 'FRAME SOLVED!');
                    await renewCommand();
                    return true;
                } else if (aStatus.indexOf('Outdated') > -1) {
                    await mouseChain({target: $('a.control.reload')[0], events: ['click'], error: 'Outdated'})
                        .catch(e => console.log(e));
                    return false;
                } else {
                    return false;
                }
            }, 555, 200000, 'reCaptcha not solved for 200s')();
            await bMess('SKRILL_RECAPTCHA').set('false');
        } else {
            //dLog('color: black; font-weight: bold;', 'Skrill', `No recapcha at ${document.location.href}`);
            dLog('black', 'Skrill', `No recapcha at ${document.location.href}`);
        }
    };

    let logIn = function () {
        console.log('%c -= logIn =-', 'background: yellow; color: red; font-weight: bold;');
        waitForCondition(() => $('#login_btn').length > 0
            || $('#instrument_number:visible').length > 0 || $('#pin_option').length > 0
            || $('button[translate="introduction.LOGIN"]').length > 0,
            333, 20000, 'No PIN or LogIn!')
            .then(() => checkPinOrEmail(true), () => checkPinOrEmail())
            .catch(e => report(false, `LogIn: ${e}`));
    };

    const pinEmailProcessing = async () => {
        let iterations = 0;
        while (!await checkAndEnterPinOrEmail() && iterations < 3) {
            iterations++;
            dLog('', 'Skrill', `pinEmailProcessing: ${iterations}`);
            await delayPromise(3000);
        }
    };

    let confirmAmount = async () => {
        await pinEmailProcessing();
        let data = command.data;
        dLog('orange', 'SKRILL', ['-= confirmAmount =-', data]);
        const $el = await waitForElement('li[href="#/wallet/balance"]', 333, 135000, true);
        await mouseChain({target: $el[0], events: fullClick, error: 'wallet/balance'});
        await delayPromise(3333);
        if ($('span[translate="errors.INSUFFICIENT_BALANCE"]:visible').length > 0) {
            throw 'NO_FUNDS';
        }
        const $el2 = await waitForElement('#pay_button:visible', 333, 15000);
        await mouseChain({target: $el2[0], events: fullClick, error: 'pay_button', scroll: true});
        await delayPromise(3000);
        await pinEmailProcessing();
        await waitForCondition(() => !!findSel(['div:contains("Successful payment")',
            'div:contains("Платеж выполнен успешно")']), 333, 15000, 'no success :(');
        report(true, 'Everything is OK :)');
    };

    const skrillCommandDo = async () => {
        if (command.command === 'TRANSFER_INTERNAL') {
            const $el = await waitForElement('a[routerlink="/send-money"]:visible', 333, 10000);
            await mouseChain({target: $el[0], events: fullClick, scroll: true, error: 'send-money'});
            await waitDelayClickF('article.skrill-to-skrill button')();
            const $el2 = await waitForElement('#amount', 333, 10000, true);
            await delayPromise(3333);
            await clearAndSimulate($el2[0], parseInt(command.data.amount) === -1 ? getBalance() : command.data.amount);
            const $el3 = await waitForElement('div.usc-input--container div.usc-input--text input', 333, 10000);
            await mouseChain({target: $el3[0], events: fullClick, scroll: true, error: '$el3'});
            await delayPromise(3333);
            await clearAndSimulate($el3[0], command.data.recipient);
            await delayPromise(3333);
            await mouseChain({
                target: $('div.navigation-area button:contains("NEXT")')[0],
                events: fullClick,
                scroll: true,
                error: 'NEXT'
            });
            await waitForNotConditionF(() => $('#transfer_error:visible').length > 0,
                333, 10000, 'Transfer error!')();
            const $el4 = await waitForElement('div.navigation-area button:contains("SEND")', 333, 10000);
            await mouseChain({target: $el4[0], events: fullClick, scroll: true, error: 'SEND'});
            await waitForElement('div.title:contains("MONEY SENT!"):visible', 333, 10000);
            await delayPromise(10000);
        }
    };

    let skrillCommand = function () {
        if (command.command === 'CHECK_BALANCE') {
            report(true, getBalance());
        } else if (['TRANSFER_INTERNAL', 'HISTORY'].indexOf(command.command) > -1) {
            if (command.command === 'TRANSFER_INTERNAL') {
                skrillCommandDo()
                    .then(() => report(true, getBalance()))
                    .catch(e => report(false, `Fill transfer form: ${e} ${$('#transfer_error').text().trim()}`));
            } else if (command.command === 'HISTORY') {
                bsBLogger('green', 'SKRILL', 'Go to History from skrillCommand');
                delayPromise(111)
                    .then(waitDelayClickF('#transactions-menu-option'))
                    .then(delayFunction(3333))
                    .then(skrillRocks)
                    .catch((e) => report(false, 'Go to history: ' + e));
            }
        }
    };

    const getBalance = () => {
        const $b1 = $('div.title:contains("Available balance")').next();
        const $b2 = $('span.balance-wrapper span.balance:visible');
        return $b1.length === 0 && $b2.length === 0
            ? null
            : ($b1.length > 0 ? $b1 : $b2).text().replace(/[^\d.]/g, '').trim();
    };

    const renewCommand = async () => await bMess('SKRILL_COMMAND', true).set(command);

    const collectHistory = async () => {
        const drSel = 'usc-select:has(div.usc-select--label:contains("Date Range"))';
        const rowsSel = 'mat-select[aria-label="Rows per page:"]';
        const moSel = 'mat-option:has(span.mat-option-text:contains("50")):visible';
        const $rs = await waitForElement(rowsSel, 333, 25000);
        if ($rs.find('div.mat-select-value').text().trim() !== '50') {
            await delayPromise(1000);
            await mouseChain({
                target: $rs.find('div.mat-select-value')[0],
                events: fullClick,
                scroll: true,
                error: '$rs'
            });
            await waitForCondition(() => $(moSel).length > 0,
                500, 5000, '50 rows');
            await delayPromise(3000);
            await mouseChain({target: $(moSel)[0], events: fullClick, error: 'moSel'});
            await delayPromise(5000);
        }
        const $dr = await waitForElement(drSel, 333, 25000);
        if ($dr.find('usc-select-option.usc-select--item__selected').text().trim() !== 'Last 7 days') {
            await delayPromise(1000);
            await mouseChain({
                target: $dr.find('div.usc-select--open-hitbox')[0],
                events: fullClick,
                scroll: true, error: 'hitbox'
            });
            await waitForCondition(() => $(drSel).find('div.usc-select--item--label:contains("Last 7 days"):visible').length > 0,
                500, 5000, 'Last 7 days');
            await delayPromise(3000);
            await mouseChain({
                target: $(drSel).find('usc-select-option:has(div.usc-select--item--label:contains("Last 7 days"):visible)')[0],
                events: fullClick, error: 'drSel'
            });
            await delayPromise(5000);
        }
        const $el = await waitForElement('div.transactions', 333, 25000);
        await delayPromise(3000);
        let collected = [];
        $el.find('pw-transaction-summary').each(function () {
            let $this = $(this);
            collected.push({
                description: $this.find('pw-transaction-description').text().trim(),
                amount: $this.find('span.transaction-amount').text().replace(/[^0-9\.]/g, '').trim(),
                fee: '',
                type: $this.find('span.transaction-amount').text().indexOf('+') > -1 ? 'IN' : 'OUT',
                datetime: $this.find('span.transaction-date span.date').text().trim()
            });
        });
        bsBLogger('green', 'SKRILL', ['collectHistory', collected]);
        return collected;
    };

    const skrillRocks = () => {
        (async () => {
            dLog('blue', 'Skrill', `SkrillRocks ${command.loginClicked}`);
            if (!command.loginClicked) {
                await checkRecaptcha(1);
            }
            await pinEmailProcessing();
            const acceptSel = 'button.btn.button-teal:visible';
            const loginSel = '#login:visible';
            const myaccSel = '#myaccount:visible';
            const onPage = () => ['/wallet/ng/transaction-history', '/wallet/account/login', '/wallet/ng/dashboard']
                .findIndex(s => window.location.href.indexOf(s) > -1);
            bsBLogger('green', 'SKRILL', `-= skrillRocks =- A:${$(acceptSel).length} / L:${$(loginSel).length} / MA:${$(myaccSel).length}`);
            if ($(acceptSel).length > 0) {
                await mouseChain({target: $(acceptSel)[0], events: fullClick, error: 'acceptSel'})
                    .catch(e => bsBLogger('red', 'SKRILL', `'Error til; accept click: ${e}`));
                await delayPromise(3000);
            }
            if (($(loginSel).length > 0 || $(myaccSel).length > 0) && !command.loginClicked) {
                const realLogSel = $(loginSel).length > 0 ? '#login' : '#myaccount';
                await waitForElement(realLogSel, 333, 15000, true);
                command.loginClicked = true;
                bsBLogger('green', 'SKRILL', '-= LOGIN/ACCOUNT click =-');
                await renewCommand();
                await mouseChain({target: $(realLogSel)[0], events: fullClick, error: 'realLogSel'});
                if ($(myaccSel).length > 0) {
                    chrome.runtime.sendMessage({
                        closeTabByPartOfUrl: window.location.href,
                        closeExact: true
                    }, r => bsBLogger('blue', 'SKRILL', `Close result: ${r}`));
                }
                await delayPromise(8000);
            } else if (command.loginClicked && onPage() === -1) {
                await waitForCondition(() => onPage() > -1, 500, 240000, 'Still not on page :(');
            }
            if (onPage() === 0) {
                dLog('blue', 'SKRILL', `HISTORY here`);
                //console.log(collected);
                report(true, {collected: await collectHistory(), balance: command.balanceBefore});
            } else if (onPage() === 1 && !command.loginClickedTwice) {
                dLog('blue', 'SKRILL', `ACCOUNT PAGE here - Attempt to Log In`);
                await delayPromise(11000);
                //await checkRecaptcha(2);
                await pinEmailProcessing();
                const pinSelector = 'div.mat-radio-label-content:contains("PIN"):visible';
                const pinInput = 'input[placeholder*="PIN"]';
                await waitForCondition(() => $('#user_authentication_email:visible').length > 0 || getBalance() !== null
                    || $(pinSelector).length > 0 || $(pinInput).length > 0,
                    333, 25000, 'No login form / pin or account form for 25s');
                if (getBalance() !== null) {
                    bsBLogger('blue', 'SKRILL', `We are logged in!`);
                    skrillCommand();
                } else {
                    //await checkRecaptcha(3);
                    await pinEmailProcessing();
                    const $el = await waitForElement('#user_authentication_email', 333, 15000, true);
                    await delayPromise(3000);
                    await clearAndInputEmail($el[0], command.data.login);
                    await delayPromise(3000);
                    await clearAndSimulate($('#user_authentication_password')[0], command.data.password);
                    // Hint: check recaptcha on page
                    //await checkRecaptcha(4);
                    await pinEmailProcessing();
                    let $lb = $('#login_button');
                    if (['BUTTON', 'INPUT'].indexOf($lb.get(0).tagName) === -1) {
                        $lb = $lb.find('button');
                    }
                    command.loginClickedTwice = true;
                    await renewCommand();
                    await delayPromise(3000);
                    await mouseChain({target: $lb[0], events: fullClick, error: 'Login Button'});
                    await delayPromise(8000);
                    await checkRecaptcha(5);
                    await pinEmailProcessing();
                    skrillRocks();
                }
            } else if (onPage() === 1 && command.loginClickedTwice) {
                bsBLogger('blue', 'SKRILL', `ACCOUNT PAGE here ('${document.location.href}'/${(window.self === window.top)}) - WAITING...`);
                await pinEmailProcessing();
                await waitForCondition(() => onPage() === 2, 500, 240000, 'Still not on page :(');
                skrillCommand();
            } else if (onPage() === 2) {
                skrillCommand();
            }
        })()
            .catch(e => report(false, `skrillRocks ${e}`));
    };

    let afterDOMLoaded = function () {
        if (window.self === window.top) {
            dLog('yellow', 'Skrill', '-= afterDOMLoaded =-');
        } else {
            dLog('yellow', 'Skrill', 'Frame loaded: ' + window.location.href);
            checkRecaptchaFrame()
                .catch(e => dLog('black', 'Skrill', `NO RECAPTCHA: ${e}`));
        }
        waitForElement(['button.accept-cookies-button', '#onetrust-accept-btn-handler'],
            333, 15000)
            .then($el => delayPromise(3000, $el))
            .then($el => mouseChain({target: $el[0], events: fullClick, error: 'acb'}))
            .catch(e => console.log(e));
        bMess('SKRILL_COMMAND', true, true).get(15000, 60000)
            .then(currentCommand => {
                command = currentCommand;
                dLog('blue', 'Skrill', ['Command received:', command]);
                if (typeof command.command === 'string'
                    && window.self === window.top && window.location.href.indexOf('pay.skrill.com/') === -1) {
                    command.close = true;
                    delayPromise(7777).then(skrillRocks);
                } else if (window.location.href.indexOf('pay.skrill.com/') > -1) {
                    logIn();
                }
            })
            .catch(e => bsLogger('red', 'Skrill', `afterDOM error: ${e}`));
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    console.log('%c -= Hmm... =-', 'background: yellow; color: red; font-weight: bold;');

})();

if (1 !== 1) {
    // Hint: for manual execution
    // after setting this you need go to https://www.skrill.com/en/
    bMess('SKRILL_COMMAND', true)
        .set({
            //command: 'TRANSFER_INTERNAL',
            //command: 'HISTORY',
            command: 'CHECK_BALANCE',
            qiwiPayCheck: true,
            data: {
                login: 'polovina1993g@mail.ru',
                password: 'Omsklolo010',
                pin: '',
                recipient: '',
                amount: 0
            }
        })
        .then(() => console.log('Command was set! Start wait...'))
        .then(() => bMess('DEPOSIT_RESULT', true)
            .get(360000, 30000, 1000, true))
        .then(depositResult => console.log('%c' + 'Done: %O', 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;', depositResult))
        .catch(e => console.log('%c' + `Error: ${e}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'));
}