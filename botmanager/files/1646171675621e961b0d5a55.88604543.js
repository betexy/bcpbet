(function () {

    "use strict";

    const ourCommand = new ourCommandProto();

    const report = function (success, message) {
        dLog('background: yellow; color: red; font-weight: bold;', 'Neteller', `-= REPORT: ${success}/${message} =-`);
        if (message.indexOf('do not have enough money') > -1) {
            message = `NO_FUNDS ${message}`;
        }
        bMess('DEPOSIT_RESULT', true).set({success: success, message: message})
            .then(() => bMess('NETELLER_COMMAND').remove())
            .then(delayFunction(3000))
            .then(async () => {
                if (ourCommand.get().close) {
                    closeWithCheck();
                } else if (!success && !ourCommand.get().iFrame) {
                    window.location.href = ourCommand.get().data.url;
                }
                ourCommand.clear();
                const $ret = $('a.button:contains("Return to Betting deposit")');
                if ($ret.length > 0) {
                    await delayPromise(3000);
                    await mouseChain({target: $ret[0], events: fullClick, error: '$ret'});
                }
            });
    };

    const closeWithCheck = function () {
        window.close();
        setTimeout(() => {
            // If we're here - window not closed...
            window.location.href = ourCommand.get().data.url;
        }, 3333);
    };

    const getBalance = () =>
        $('span.meta-available-balance').next().text().replace(/[^\d.]/g, '').trim();

    const emailSel = 'input[name="verificationCode"]:visible';
    const pinSel = 'input[placeholder="Verification code"]';
    const pinASel = '#secureIdAnswer';
    const pinBSel = 'input[name="verifyPin"]:visible';

    const checkEmailAndPin = async () => {
        dLog('yellow', 'Neteller', 'checkEmailAndPin');
        if ($(emailSel).length > 0) {
            dLog('orange', 'Neteller', '-= Email =-');
            const started = Math.ceil(Date.now() / 1000) - 10;
            const startedInternal = Date.now();
            let code = '';
            while (code === '' && Date.now() - startedInternal < 210000) {
                const res = await bsEmailCheck(ourCommand.get().data.login, 'NETELLER_CONFIRM_CODE', started);
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
            await clearAndSimulate($(emailSel)[0], code);
            await delayPromise(1000);
            await mouseChain({
                target: $('button:textEqualsI("Continue")')[0],
                events: fullClick,
                error: 'continue'
            });
            dLog('orange', 'Neteller', '-= Finished Email =-');
            await delayPromise(10000);
            return await checkEmailAndPin();
        } else if (checkSE([pinSel, pinASel, pinBSel], false, true) && !ourCommand.getAdded('SpecialPin')) {
            dLog('orange', 'Neteller', '-= Pin =-');
            await delayPromise(1000);
            await clearAndSimulate($(findSel([pinSel, pinASel, pinBSel], true))[0], ourCommand.get().data.pin);
            await delayPromise(1000);
            const $trustDevice = $('input[name="trustDevice"]');
            if ($trustDevice.length > 0) {
                await mouseChain({target: $trustDevice[0], events: fullClick, error: 'trustDevice'});
                await delayPromise(1000);
            }
            await mouseChain({
                target: $(findSel(['[type="submit"]', 'button:textEqualsI("Submit")'], true))[0],
                events: fullClick,
                error: 'submit'
            });
            dLog('orange', 'Neteller', '-= Finished Pin =-');
            await delayPromise(10000);
            return await checkEmailAndPin();
        }
    };

    const logIn = async () => {
        dLog('green', 'Neteller', '-= logIn =-');
        await delayPromise(2000);
        const secSel = 'button.security-check:textEquals("Enter your secure id")';
        const secASel = 'a.security-check:textEquals("Enter your secure id")';
        const pSels = ['#form-login-password', '#password'];
        const goodSels = ['span.meta-available-balance', '#checkout_button', 'div.alert-box.error', 'div.alert-box'];
        const customerCountry = '#customerCountry';
        await checkEmailAndPin();
        if ($(customerCountry).length > 0) {
            await selectLikePuppeteer($(customerCountry)[0], ['RU']);
            await delayPromise(500);
            await mouseChain({target: $('#select_country_btn')[0], events: fullClick, error: 'select_country_btn'});
            return await logIn();
        } else if ($(secSel).length > 0 || $(secASel).length > 0) {
            dLog('orange', 'Neteller', '-= Security check =-');
            await delayPromise(1000);
            await mouseChain({
                target: $([secSel, secASel].find(s => $(s).length > 0))[0],
                events: fullClick,
                error: 'secSel'
            });
            dLog('orange', 'Neteller', '-= Finished Security =-');
            await delayPromise(15000);
            return await logIn();
        } else if ($('p:contains("Please confirm you are not a robot before signing in to your NETELLER account:")').length > 0
            || $('div:contains("Please verify yourself below to access your account.")').length > 0) {
            dLog('orange', 'Neteller', '-= Recaptcha =-');
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
            await delayPromise(3000);
            const verify = '#btn-verify';
            if ($(verify).length > 0) {
                await mouseChain({target: $(verify)[0], events: ['click']});
            } else {
                await mouseChain({target: $('#btn-login')[0], events: ['click']});
            }
            dLog('orange', 'Neteller', '-= Finished Recaptcha =-');
            await delayPromise(15000);
        } else if (pSels.some(s => $(s).length > 0)) {
            const data = ourCommand.get().data;
            dLog('orange', 'Neteller', ['-= Logging =-', data]);
            const aSel = ['#form-login-account_id', '#login_identity'].find(s => $(s).length > 0);
            if (!aSel) {
                throw 'No aSel!';
            }
            if ($(aSel).val() !== data.login) {
                await clearAndSimulate($(aSel)[0], data.login);
                await delayPromise(3000);
            }
            await clearAndSimulate($(pSels.find(s => $(s).length > 0))[0], data.password);
            await delayPromise(3000);
            const $ls = $('label.switch');
            if ($ls.length > 0) {
                await mouseChain({target: $ls[0], events: ['click']});
                await delayPromise(3000);
            }
            await mouseChain({
                target: $(['#btn-login', '#checkout_continue_btn'].find(s => $(s).length > 0))[0],
                events: ['click'], error: 'Login',
            });
            await waitForCondition(() => ['h3:textEquals("Confirm your order")', 'span.meta-available-balance']
                .some(s => $(s).length > 0), 333, 60000, 'Not logged!');
        } else if (checkSE(goodSels, false, true)) {
            dLog('orange', 'Neteller', '-= Logged in! =-');
            return true;
        } else {
            dLog('orange', 'Neteller', '-= Unsupported situation, trying to resolve it! =-');
            await delayPromise(10000);
            if (document.location.href.indexOf('challenge-email') > -1) {
                await logIn();
            } else {
                await delayPromise(270000);
                throw 'Unsupported situation error!';
            }
        }
    };

    const executeCommand = async () => {
        dLog('blue', 'Neteller', `executeCommand: ${ourCommand.toString()}`);
        await logIn();
        const command = ourCommand.get();
        if (command.action) {
            dLog('red', 'Neteller', `ACTION: ${command.action}`);
            if (command.action === 'DEPOSIT') {
                const rSels = [
                    'div.alert-box.error',
                    'h3:contains("Thanks for your purchase!")',
                    '#checkout_button',
                    emailSel,
                    pinSel,
                ];
                await waitForCondition(() => checkSE(rSels, false, true),
                    333, 20000, 'No confirmation!');
                if ($(rSels[2]).length > 0) {
                    await mouseChain({target: $(rSels[2])[0], events: fullClick, error: 'cor'});
                    await delayPromise(10000);
                }
                await checkEmailAndPin();
                if ($(rSels[0]).length > 0) {
                    throw `Neteller: ${$(rSels[0]).text().trim()}`;
                } else if (rSels[1].length > 0) {
                    report(true, `It should be Okay :)`);
                    return true;
                }
            } else {
                throw `Unsupported command ${command.action} for Neteller!`;
            }
            await delayPromise(5000);
            return await executeCommand();
        } else if (command.command) {
            dLog('red', 'Neteller', `COMMAND: ${command.command}`);
            if (command.command === 'CHECK_BALANCE') {
                report(true, getBalance());
            } else if (command.command === 'TRANSFER_INTERNAL') {
                if (ourCommand.getAdded('prevBalance') === false) {
                    const $bal = parseFloat(getBalance());
                    if (isNaN($bal) || $bal < parseFloat(ourCommand.getAdded('data').amount)) {
                        throw `NO_FUNDS Insufficient balance: we need ${ourCommand.getAdded('data').amount}, we have only ${$bal}!`;
                    }
                    ourCommand.add('prevBalance', $bal);
                }
                if (window.location.href.indexOf('/moneyTransfer/') === -1) {
                    const $transfer = await waitForElement('#btn-menu-main-money-transfer', 333, 30000);
                    await mouseChain({target: $transfer[0], events: ['click'], error: 'tf1'});
                } else if (window.location.href.indexOf('/moneyTransfer/moneyTransferNav') > -1) {
                    const $toAccount = await waitForElement('span:contains("Send money to an email or NETELLER Account"):not([class])', 333, 30000);
                    await mouseChain({target: $toAccount[0], events: ['click'], error: 'tf2'});
                } else if (window.location.href.indexOf('/moneyTransfer/index') > -1) {
                    let $secure;
                    $secure = await waitForElement('#form-money-transfer-step-1-secure_id', 333, 12000)
                        .catch(() => $secure = $([]));
                    if ($secure.length > 0) {
                        await delayPromise(3000);
                        await clearAndSimulate($secure[0], ourCommand.getAdded('data').pin);
                        await mouseChain({
                            target: $('#btn-money-transfer-step-2')[0],
                            events: ['click'],
                            error: 'tf3'
                        });
                    }
                } else if (window.location.href.indexOf('/moneyTransfer/moneyTransferStepOne') > -1) {
                    const amount = ourCommand.getAdded('data').amount;
                    const $email = await waitForElement('#form-money-transfer-step-1-email_new', 333, 30000);
                    await clearAndInputEmail($email[0], ourCommand.getAdded('data').recipient);
                    await delayPromise(3000);
                    await clearAndSimulate($('#form-money-transfer-step-1-amount')[0],
                        parseInt(amount) === -1 ? getBalance() : amount);
                    await delayPromise(3000);
                    await selectLikePuppeteer($('#form-money-transfer-step-1-currency')[0], ['USD']);
                    await delayPromise(3000);
                    await mouseChain({
                        target: $('#btn-money-transfer-step-1')[0],
                        events: ['click'],
                        error: 'tf4'
                    });
                } else if (window.location.href.indexOf('/moneyTransfer/moneyTransferStepTwo/') > -1) {
                    const $confirm = await waitForElement('#btn-money-transfer-step-2', 333, 30000);
                    await delayPromise(3000);
                    ourCommand.add('SpecialPin', true);
                    await mouseChain({target: $confirm[0], events: ['click'], error: 'tf5'});
                } else if (window.location.href.indexOf('/moneyTransfer/moneyTransferStepThree/') > -1) {
                    const $secure = await waitForElement('input[name="verifyPin"]', 333, 12000)
                        .catch(() => $([]));
                    if ($secure.length > 0) {
                        await delayPromise(3000);
                        await clearAndSimulate($secure[0], ourCommand.getAdded('data').pin);
                        await mouseChain({
                            target: $('button:textEquals("Confirm")')[0],
                            events: ['click'],
                            error: 'tf6'
                        });
                    }
                    let $success;
                    $success = await waitForElement('div.alert-box:contains("successfully")', 333, 30000)
                        .catch(() => $success = $([]));
                    if ($success.length > 0) {
                        report(true, getBalance());
                    } else {
                        throw `It looks like money was sent, but no success message :(`;
                    }
                } else {
                    await delayPromise(120000);
                    throw `Unknown location ${window.location.href}`;
                }
            } else if (command.command === 'HISTORY') {
                if (window.location.href.indexOf('/transaction/') === -1) {
                    const $history = await waitForElement('#btn-menu-main-history', 333, 30000);
                    await mouseChain({target: $history[0], events: ['click']});
                }
                await delayPromise(15000);
                const $tr = await waitForElement('#fn-history tr.even, #fn-history tr.odd', 333, 25000);
                const collected = [];
                $tr.each(function () {
                    const $tds = $(this).find('td');
                    collected.push({
                        description: $tds.eq(1).text().trim(),
                        amount: $tds.eq(3).text().replace(/[^0-9.]/g, '').trim(),
                        type: $tds.eq(3).find('span.positive').length > 0 ? 'IN' : 'OUT',
                        datetime: $tds.eq(0).text().trim()
                    });
                });
                report(true, {collected: collected, balance: getBalance()});
            }
        } else {
            throw `Strange operation: ${ourCommand.toString()}`;
        }
    };

    const afterDOMLoaded = () => {
        if (window.self === window.top) {
            dLog('background: yellow; color: red; font-weight: bold;', 'Neteller', '-= afterDOMLoaded =-');
            bMess('NETELLER_COMMAND', true).check(60000, true)
                .then(async res => {
                    dLog('green', 'Neteller', ['Command received:', res]);
                    if (res) {
                        ourCommand.set(res);
                        await executeCommand();
                    }
                })
                .catch(e => report(false, `Execute command: ${e}, ${formatStack(e.stack)}`));
        } else {
            dLog('', 'Neteller', `Frame loaded: ${window.location.href}`);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    addEventListener("unload", () => {
        if (ourCommand.isSet()) {
            bsBLogger('background: yellow; color: red; font-weight: bold;', 'Neteller', ['Command was set till unload:', ourCommand.get()]);
            bMess('NETELLER_COMMAND', true).set(ourCommand.get(), 0);
        }
    }, true);

    const ccInterval = setInterval(async () => {
        const $cookies = $('#onetrust-accept-btn-handler');
        if ($cookies.length > 0) {
            await mouseChain({target: $cookies[0], events: fullClick, error: '$cookies'});
            clearInterval(ccInterval);
        }
    }, 1000);

})();