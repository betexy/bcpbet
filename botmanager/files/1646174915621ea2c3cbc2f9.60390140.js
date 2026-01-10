(function () {

    "use strict";

    // https://payeer.com/

    /**
     * @import libs/jquery-3.3.1.min.js
     */

    const ourCommand = new ourCommandProto();

    const getBalance = async () => {
        const $ab = await waitForElement('#btn-amount', 333, 15000);
        await mouseChain({target: $ab[0], events: fullClick, error: '$ab'});
        const $euro = await waitForElement('div.balance-item.balance-item--eur', 333, 3000);
        delayPromise(500)
            .then(() => mouseChain({target: $ab[0], events: fullClick, error: '$ab2'}));
        return $euro.text().replace(/[^\d.]/g, '').trim();
    }

    const sentToRucaptcha = (first, requestId) => new Promise((onSuccess, onReject) => {
        let messageToSend = {
            backgroundSpecialAction: 'ajaxUrl',
            url: first ? 'rucaptchaSend' : 'rucaptchaRes',
            noBaseAuth: true,
            data: {
                //key: '027c6f1330bbc6acba3867081de6df69',
                key: 'd8d55d8baee6cef4411e09fa60a82974',
                json: 1
            }
        };
        if (first) {
            messageToSend.data['body'] = getBase64Image($('img.captcha').get(0));
            messageToSend.data['method'] = 'base64';
            messageToSend.data['language'] = 2;
        } else {
            messageToSend.data['action'] = 'get';
            messageToSend.data['id'] = requestId;
            messageToSend['useGET'] = true;
        }
        try {
            chrome.runtime.sendMessage(
                messageToSend,
                (response) => {
                    dLog('green', 'Payeer', [`responseCallback: ${response.success}`, response]);
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

    /**
     * Init and recognize captcha using rucaptcha service
     * @returns {Promise<string>}
     */
    const recogniseCaptcha = async () => {
        let requestId = 0;
        const res = await sentToRucaptcha(true, 0);
        dLog('', 'PB', ['Recaptcha initial res:', res]);
        if (parseInt(res.status) === 1) {
            requestId = res.request;
        } else {
            throw `Bad status from rucaptcha: ${JSON.stringify(res)}`;
        }
        await delayPromise(5000);
        let started = Date.now();
        do {
            const res = await sentToRucaptcha(false, requestId);
            dLog('', 'PB', ['Recaptcha res:', res]);
            if (res.request !== 'CAPCHA_NOT_READY' && parseInt(res.status) === 1) {
                return res.request;
            }
            await delayPromise(5000);
        } while (Date.now() - started < 60000);
        throw `Captcha not recognized!`;
    };

    const checkLogin = async data => {
        const zero = ['div.welcome a[href="/en/account/"]', 'div.welcome a[href="/en/auth/"]',];
        const one = ['input[name="email"]',];
        const two = ['input[name="password"]',];
        const three = ['input[name="captcha_code"]'];
        let loginPresented = true;
        await waitForCondition(() => checkSE(zero) ||
            (checkSE(one, true) && checkSE(two, true) && checkSE(three, true)),
            333, 5000)
            .catch(() => loginPresented = false);
        //const $lang = $('select[name="lang"]');
        //if ($lang.length > 0 && $lang.val() !== 'ru_RU') {
        //    await selectLikePuppeteer($lang[0], ['ru_RU']);
        //}
        if (!loginPresented) {
            return;
        }
        if (checkSE(zero)) {
            await delayPromise(1000);
            await mouseChain({target: $(findSel(zero))[0], events: fullClick, error: 'zero'});
        } else {
            if ($('img.captcha').length > 0) {
                await delayPromise(5000);
                const captcha = await recogniseCaptcha();
                await clearAndSimulate($(findSel(three))[0], captcha);
                await delayPromise(1000);
            }
            await clearAndSimulate($(findSel(one))[0], data.login);
            await delayPromise(1000);
            await clearAndSimulate($(findSel(two))[0], data.password);
            await delayPromise(1000);
            await mouseChain({
                target: $(findSel(['button:contains("Go next")']))[0],
                events: fullClick,
                error: 'VwPm'
            });
        }
        await delayPromise(100000);
    };

    const deposit = async data => {
        if (document.location.href.indexOf('/merchant/') > -1) {
            const sels = ['li:has(div.ps_name:textEquals("Payeer"))', 'a.confirm-button'];
            await waitForCondition(() => !!findSel(sels),
                333, 15000);
            await delayPromise(1000);
            await mouseChain({target: $(findSel(sels))[0], events: fullClick, error: '$payeer'});
            await delayPromise(3000);
            return await deposit();
        }
        await checkLogin(data);
        const $b = await waitForElement('select[name="schet"] option:selected', 333, 15000);
        const balance = parseFloat($b.text().replace(/[^\d.]/g, '').trim());
        if (isNaN(balance)) {
            throw `Can't parse balance!`;
        }
        await bMess('PAYEER_WB').set(balance);
        const weNeed = parseFloat(data.amount);
        if (balance < weNeed) {
            throw `NO_FUNDS - we have ${balance}, we need ${weNeed}`;
        }
        await mouseChain({
            target: $(findSel(['a.confirm.button_green']))[0],
            events: fullClick,
            error: 'payConf'
        });
        return {success: true, message: 'Everything should be OK!'};
    };

    const checkBalance = async data => {
        await checkLogin(data);
        return {success: true, message: await getBalance(data.pin), balance: await getBalance(data.pin)};
    };

    const transfer = async data => {
        await checkLogin(data);
        if (document.location.href.indexOf('/account/send/') === -1) {
            const $trans = await waitForElement('li.transfer a', 333, 15000);
            await delayPromise(1000);
            await mouseChain({target: $trans[0], events: fullClick, error: '$trans'});
            await delayPromise(5000);
        }
        const sels = ['input[name="param_ACCOUNT_NUMBER"]', 'input[name="sum_receive"]',
            'select[name="curr_receive"]', 'button:contains("Send")'];
        await waitForCondition(() => checkSE(sels, true),
            333, 15000, 'Wrong place!');
        await delayPromise(1000);
        await clearAndSimulate($(sels[0])[0], data.recipient);
        if ($(sels[2]).val() !== 'EUR') {
            await delayPromise(3000);
            await selectLikePuppeteer($(sels[2])[0], ['EUR']);
            await delayPromise(1000);
        }
        const balance = parseFloat(await getBalance());
        await bMess('PAYEER_WB').set(balance);
        const amount = parseInt(data.amount) === -1
            ? getRounded(balance * 0.995, 0.01, true) : parseFloat(data.amount);
        await delayPromise(3000);
        await clearAndSimulate($(sels[1])[0], amount.toString());
        await delayPromise(2000);
        const need = parseInt(data.amount) === -1
            ? balance : parseFloat($('input[name="sum_pay"]').val());
        if (isNaN(balance) || isNaN(need) || balance < need) {
            throw `NO_FUNDS: we need: ${need}, we have: ${balance}`;
        }
        await delayPromise(1000);
        await mouseChain({target: $(sels[3])[0], events: fullClick, error: 'sels[3]'});
        const res = () => $('div.result').text().trim();
        await waitForCondition(() => res() !== '', 333, 15000, 'No result!');
        return {
            success: res().indexOf('successfully completed') > -1,
            balance: res().indexOf('successfully completed') > -1 ? balance - need : balance,
            message: parseInt(data.amount) === -1 ? amount.toString() : res(),
        };
    };

    const commands = new class Commands {
        constructor() {
            this.cLinks = {
                'DEPOSIT': deposit,
                'CHECK_BALANCE': checkBalance,
                'TRANSFER_INTERNAL': transfer,
            };
        }

        exists(command) {
            return Object.keys(this.cLinks).indexOf(command) > -1;
        }

        async execute(command, data) {
            dLog('green', 'Payeer', [command, data]);
            const res = await this.cLinks[command](data)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            res['balance'] = res.balance
                || (await bMess('PAYEER_WB').check(30000).catch(() => 0)).toString();
            if (res.success && command === 'TRANSFER_INTERNAL' && parseInt(data.amount) === -1) {
                res['balance'] = 0;
            }
            dLog(res.success ? 'green' : 'red', 'Payeer', `${command} result: ${res.message}`);
            await bMess('DEPOSIT_RESULT', true).set(res);
            if (!res.success && ['CHECK_BALANCE', 'TRANSFER_INTERNAL'].indexOf(command) === -1) {
                window.location.href = data.url;
            }
            return res;
        }
    };

    const messageProcessor = command => {
        const action = command.action || command.command;
        dLog('green', 'Payeer', `messageProcessor: ${action}`);
        if (commands.exists(action)) {
            // Hint: execute command
            ourCommand.set(command);
            commands.execute(action, command.data)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'Payeer', [`Unknown Payeer command ${action}:`, command]);
        }
    };

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('green', 'Payeer', ['Command was set till unload:', ourCommand.get()]);
            bMess('PAYEER_COMMAND', true).set(ourCommand.get());
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        if (window.self === window.top) {
            bMess('PAYEER_COMMAND', true).check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'Payeer', [`Execute:`, currentCommand]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'Payeer', 'No command!'));
        } else {
            dLog('', 'Payeer', `Frame loaded: ${window.location.href}`);
        }
    }

})();