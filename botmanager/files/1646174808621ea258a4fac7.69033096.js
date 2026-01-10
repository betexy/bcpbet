(function () {

    "use strict";

    // https://perfectmoney.com/

    /**
     * @import libs/jquery-3.3.1.min.js
     */

    const ourCommand = new ourCommandProto();

    const getBalance = wallet => {
        if (document.location.href.indexOf('send_money.html') > -1) {
            const t = $('font[size="4"]').text().trim();
            return t.split(',')[0].replace(/[^\d.]/g, '').trim();
        } else {
            const $b = $(`a[href^="/account_view.html"]:textEquals("${wallet}")`).parent().parent()
                .find('div[dir="ltr"]');
            return $b.text().replace(/[^\d.]/g, '').trim();
        }
    }

    const checkLogin = async data => {
        const one = ['input[name="Login"]', 'input[name="Password"]'];
        const two = ['input[name="login"]', 'input[name="password"]'];
        const three = ['a[href="https://perfectmoney.com/login.html"]'];
        let loginPresented = true;
        await waitForCondition(() =>
            checkSE(one, true) || checkSE(two, true) || checkSE(three),
            333, 5000)
            .catch(() => loginPresented = false);
        const $lang = $('select[name="lang"]');
        if ($lang.length > 0 && $lang.val() !== 'ru_RU') {
            await selectLikePuppeteer($lang[0], ['ru_RU']);
        }
        if (!loginPresented) {
            return;
        }
        if (checkSE(one, true) || checkSE(two, true)) {
            const work = checkSE(one, true) ? one : two;
            if ($('#cpt_img').length > 0) {
                await delayPromise(5000);
                const captcha = await recogniseCaptcha();
                await clearAndSimulate($(findSel(['input[name="Turing"]', 'input[name="turing"]']))[0],
                    captcha);
                await delayPromise(1000);
            }
            await clearAndSimulate($(work[0])[0], data.login);
            await delayPromise(1000);
            await clearAndSimulate($(work[1])[0], data.password);
            await delayPromise(1000);
            await mouseChain({
                target: $(findSel(['input[value="Просмотреть платеж"]', 'input[value="Логин"]',
                    'input[value="Make payment"]', 'input[value="Preview payment"]']))[0],
                events: fullClick,
                error: 'VwPm'
            });
        } else if (checkSE(three)) {
            await mouseChain({target: $(three[0])[0], events: fullClick, error: 'two[0]'});
        }
        await delayPromise(100000);
    };

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
            messageToSend.data['body'] = getBase64Image($('#cpt_img').get(0));
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
                    dLog('green', 'PM', [`responseCallback: ${response.success}`, response]);
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

    const deposit = async data => {
        await checkLogin(data);
        const mpSel = 'input[value="Make payment"]', raSel = '#r_account';
        if ($(mpSel).length > 0 && $(raSel).length > 0) {
            if (!$(raSel).prop('checked')) {
                await mouseChain({target: $(raSel)[0], events: fullClick, error: 'raSel'});
                await delayPromise(3000);
            }
            await mouseChain({target: $(mpSel)[0], events: fullClick, error: 'mpSel'});
        } else if (document.location.href.indexOf('/api/step2.asp') > -1) {
            const $sel = await waitForElement('select[name="PAYER_ACCOUNT"]', 333, 15000);
            const bDraft = $sel
                .find(`option[value="${data.pin.replace(/[^\d]/g, '')}"]`)
                .text().trim();
            const bRes = /(\d+\.\d+)/.exec(bDraft);
            const balance = bRes && bRes[1] ? parseFloat(bRes[1]) : -1;
            if (balance === -1) {
                throw `Can't parse balance!`;
            }
            await bMess('PERFECT_WB').set(balance);
            const weNeed = parseFloat(data.amount) * 1.02;
            if (balance < weNeed) {
                throw `NO_FUNDS - we have ${balance}, we need ${weNeed}`;
            }
            await mouseChain({
                target: $(findSel(['input[value="Подтверждение платежа"]',
                    'input[value="Confirm payment"]']))[0],
                events: fullClick,
                error: 'payConf'
            });
        } else if (document.location.href.indexOf('/api/step3.asp') > -1) {
            const $cont = $(findSel(['input[value="Продолжить"]', 'input[value="Continue"]']));
            if ($cont.length > 0) {
                delayPromise(3000)
                    .then(() => mouseChain({target: $cont[0], events: fullClick, error: '$cont'}))
                    .finally(() => {
                    });
            }
            if ($(findSel(['td:contains("Оплата прошла успешно")',
                'td:contains("The payment was successful.")'])).length > 0) {
                return {success: true, message: 'Everything should be OK!'};
            } else {
                return {success: false, message: 'Something went wrong!'};
            }
        } else {
            throw `deposit unsupported situation ${document.location.href}!`;
        }
        await delayPromise(100000);
    };

    const goAccount = async () => {
        if (document.location.href.indexOf('/profile.html') === -1) {
            const $ma = await waitForElement('a[href="https://perfectmoney.com/profile.html"]',
                333, 15000);
            await mouseChain({target: $ma[0], events: fullClick, error: '$ma'});
            await delayPromise(100000);
        }
    };

    const checkBalance = async data => {
        await checkLogin(data);
        await goAccount();
        return {success: true, message: getBalance(data.pin), balance: getBalance(data.pin),};
    };

    const transfer = async data => {
        await checkLogin(data);
        if (ourCommand.getAdded('wasSuccess') && document.location.href.indexOf('/profile.html') > -1) {
            return {
                success: true,
                balance: ourCommand.getAdded('balance') - ourCommand.getAdded('charged'),
                message: parseFloat(data.amount) === -1
                    ? ourCommand.getAdded('charged').toString()
                    : getBalance(data.pin).toString(),
            };
        } else if (document.location.href.indexOf('/result.html') > -1) {
            const $success = await waitForElement('td:contains("успешно завершена")', 333, 15000)
                .catch(() => $([]));
            if ($success.length === 0) {
                throw `It looks like money was sent, but no success message :(`;
            } else {
                ourCommand.add('wasSuccess', true);
                await delayPromise(5000);
                await mouseChain({target: $('a[href="/profile.html"]')[0], events: fullClick, error: 'gma'});
            }
        } else if (document.location.href.indexOf('/send_preview.html') > -1) {
            const $sm = await waitForElement('input[value="Отправить деньги"]', 333, 15000);
            await delayPromise(3000);
            await mouseChain({target: $sm[0], events: fullClick, error: '$sm'});
        } else if (document.location.href.indexOf('/send_money.html') > -1) {
            const $amount = () => $('input[name="currency"]').prev();
            const $recipient = () => $('#payees').prev().prev();
            const $submit = () => $(findSel(['input[value="Предпросмотр платежа"]',
                'input[value="Payment preview"]']));
            await waitForCondition(() =>
                $amount().length > 0 && $recipient().length > 0 && $submit().length > 0,
                333, 10000, 'No elements!');
            await delayPromise(1000);
            const balance = parseFloat(getBalance());
            ourCommand.add('balance', balance);
            dLog('blue', 'PM', `Balance before transfer: ${balance} (${data.amount})`);
            const need = parseFloat(data.amount) === -1
                ? getRounded(balance * 0.98, 0.01, true)
                : parseFloat(data.amount) * 1.02;
            if (isNaN(balance) || isNaN(need) || balance < need) {
                throw `NO_FUNDS: we need: ${need}, we have: ${balance}`;
            }
            ourCommand.add('charged', need);
            await clearAndSimulate($amount()[0], parseFloat(data.amount) === -1 ? need : data.amount);
            await delayPromise(3000);
            await clearAndSimulate($recipient()[0], data.recipient);
            await delayPromise(3000);
            await mouseChain({target: $submit()[0], events: fullClick, error: '$submit'});
        } else if (document.location.href.indexOf('/send.html') === -1) {
            await goAccount();
            const $send = await waitForElement('a[href="/send.html"]', 333, 15000);
            await delayPromise(1000);
            await mouseChain({target: $send[0], events: fullClick, error: '$send'});
        } else if (document.location.href.indexOf('/send.html') > -1) {
            const $b = () => $(`b:textEquals("${data.pin}")`).parent().parent();
            const $ep = () => $b().find(findSelIn(
                ['a:textEquals("Единичный платеж")', 'a:textEquals("Single payment")'], $b()));
            await waitForCondition(() => $ep().length > 0,
                333, 15000, 'No $ep');
            await delayPromise(1000);
            await mouseChain({target: $ep()[0], events: fullClick, error: '$ep()'});
        }
        await delayPromise(100000);
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
            dLog('green', 'PM', [command, data]);
            const res = await this.cLinks[command](data)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            res['balance'] = res.balance
                || (await bMess('PERFECT_WB').check(30000).catch(() => 0)).toString();
            if (res.success && command === 'TRANSFER_INTERNAL' && parseInt(data.amount) === -1) {
                res['balance'] = 0;
            }
            dLog(res.success ? 'green' : 'red', 'PM', `${command} result: ${res.message}`);
            await bMess('DEPOSIT_RESULT', true).set(res);
            if (!res.success && ['CHECK_BALANCE', 'TRANSFER_INTERNAL'].indexOf(command) === -1) {
                window.location.href = data.url;
            }
            return res;
        }
    };

    const messageProcessor = command => {
        const action = command.action || command.command;
        dLog('green', 'PM', `messageProcessor: ${action}`);
        if (commands.exists(action)) {
            // Hint: execute command
            ourCommand.set(command);
            commands.execute(action, command.data)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'PM', [`Unknown PM command ${action}:`, command]);
        }
    };

    addEventListener("unload", function () {
        if (ourCommand.isSet()) {
            dLog('green', 'PM', ['Command was set till unload:', ourCommand.get()]);
            bMess('PERFECT_COMMAND', true).set(ourCommand.get());
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        if (window.self === window.top) {
            bMess('PERFECT_COMMAND', true).check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'PM', [`Execute:`, currentCommand]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'PM', 'No command!'));
        } else {
            dLog('', 'PM', `Frame loaded: ${window.location.href}`);
        }
    }

})();