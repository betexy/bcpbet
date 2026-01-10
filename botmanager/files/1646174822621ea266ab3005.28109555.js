(function () {

    "use strict";

    // https://yoomoney.ru/

    /**
     * @import libs/jquery-3.3.1.min.js
     */

    const ourCommand = new ourCommandProto();

    const getBalance = async () => {
        const $b = await waitForElement('div[class^="User2Balance"]', 333, 15000);
        const balance = parseFloat($b.text().replace(/[^\d.]/g, '').trim());
        if (isNaN(balance)) {
            throw `Can't parse balance!`;
        }
        await bMess('UMONEY_WB').set(balance);
        return balance;
    }

    const deposit = async data => {
        if (ourCommand.getAdded('payClicked')) {
            const $success = await waitForElement('h1.title:contains("Платеж прошел")', 333, 15000);
            const $back = await waitForElement('a:textEquals("Вернуться в магазин")', 333, 10000)
                .catch(() => $([]));
            if ($back.length > 0) {
                delayPromise(2000)
                    .then(() => mouseChain({target: $back[0], events: fullClick, error: ''}));
            }
            return {
                success: $success.length > 0, message: $success.length > 0
                    ? 'Everything should be OK!' : 'Something went wrong!'
            };
        }
        const balance = await getBalance();
        const weNeed = parseFloat(data.amount);
        if (balance < weNeed) {
            throw `NO_FUNDS - we have ${balance}, we need ${weNeed}`;
        }
        const $pay = () => $('button:textEquals("Заплатить")');
        await mouseChain({target: $pay()[0], events: fullClick, error: '$pay 1'});
        const $use = await waitForElement('span[role="button"]:textEquals("Использовать аварийный код")',
            333, 15000);
        await mouseChain({target: $use[0], events: fullClick, error: '$use'});
        await delayPromise(1000);
        const $ac = await waitForElement('span.secure-auth__answer-input input:visible',
            333, 15000);
        let $bad = $([]), tries = 0;
        do {
            await delayPromise(3000);
            const code = ourCommand.getAdded('codes')[tries];
            tries++;
            await clearAndSimulate($ac[0], code);
            const res = await blockedCodes(data.login, code);
            if (res.indexOf('already used') > -1) {
                continue;
            } else {
                ourCommand.add('payClicked', true);
                await mouseChain({target: $pay()[0], events: fullClick, error: '$pay 2'});
                $bad = await waitForElement('div.popup__content:contains("Вы ввели неверный пароль.")',
                    333, 5000).catch(() => $([]));
            }
        } while ($bad.length > 0 && tries < 5);
        if ($bad.length > 0) {
            throw `We used ${tries} codes and no one succeed :(`;
        } else {
            await delayPromise(1000000);
            return deposit(data);
        }
    };

    const checkBalance = async data => {
        return {success: true, message: await getBalance(), balance: await getBalance()};
    };

    const transfer = async data => {
        if (document.location.href.indexOf('/transfer/') === -1) {
            const $trans = await waitForElement('span[class^="MenuItem"]:textEquals("Переводы")',
                333, 15000);
            await delayPromise(1000);
            await mouseChain({target: $trans[0], events: fullClick, error: '$trans'});
            await delayPromise(5000);
        } else if (document.location.href.indexOf('/transfer/a2w') === -1) {
            const $umoney = await waitForElement('button[class^="Sidebar"]:has(div[name="money"])',
                333, 15000);
            await delayPromise(1000);
            await mouseChain({target: $umoney[0], events: fullClick, error: '$umoney'});
            await delayPromise(5000);
        }
        const blocked = await blockedCodes(data.login);
        const codes = parseDCodes(data.pin).filter(c => blocked.indexOf(c) === -1);
        dLog('', 'UMoney', ['Available codes:', codes]);
        if (codes.length < 2) {
            throw `We exhausted codes`;
        }
        ourCommand.add('codes', codes);
        dLog('blue', 'UMoney', 'Starting transfer!');
        const $where = () => $('input[placeholder="Кошелёк, телефон или почта"]');
        await waitForCondition(() => $where().length > 0,
            300, 15000, 'No $where');
        dLog('', 'UMoney', `Where found ${$where().length}`);
        await delayPromise(2000);
        await clearInputElement({element: $where()[0]});
        $where().get(0).focus();
        console.log(await bsType('you_money', data.recipient.toString(), 100));
        await delayPromise(3000);
        if ($where().val().replace(/\s/g, '').trim() !== data.recipient.toString()) {
            throw `Bad data: ${$where().val()} !== ${data.recipient.toString()}`;
        }
        dLog('', 'UMoney', `Where entered: '${$where().val()}', need: '${data.recipient.toString()}'`);
        await delayPromise(1000);
        const $next0 = await waitForElement('button:has(span.button2__text:textEquals("Дальше")):visible',
            33, 10000);
        await delayPromise(1000);
        await mouseChain({target: $next0[0], events: fullClick, error: '$next0'});
        dLog('', 'UMoney', `$next0 available and clicked!`);
        const amount = parseInt(data.amount) === -1 ? await getBalance() : parseFloat(data.amount);
        const $s = await waitForElement('span:textEquals("Сколько")', 333, 10000);
        await delayPromise(1000);
        await mouseChain({
            target: $s.parent().find('input')[1], events: fullClick,
            error: 'i1'
        });
        await delayPromise(1000);
        await clearAndSimulate($s.parent().find('input')[0], amount.toString());
        const $next = await waitForElement('button:textEquals("Дальше"):visible',
            333, 15000);
        await delayPromise(1000);
        await mouseChain({target: $next[0], events: fullClick, error: '$next', scroll: true});
        const $next2 = await waitForElement('a:textEquals("Заплатить"):visible',
            333, 15000);
        await delayPromise(1000);
        await mouseChain({target: $next2[0], events: fullClick, error: '$next2', scroll: true});
        // Hint: codes!
        const $use = await waitForElement('button:has(span:textEquals("У меня есть аварийный код"))',
            333, 15000);
        await delayPromise(1000);
        await mouseChain({target: $use[0], events: fullClick, error: '$use'});
        await delayPromise(1000);
        const $ac = await waitForElement('input[name="code"]:visible',
            333, 15000);
        let $bad = $([]), tries = 0;
        do {
            await delayPromise(3000);
            const code = ourCommand.getAdded('codes')[tries];
            tries++;
            const res = await blockedCodes(data.login, code);
            if (res.indexOf('already used') > -1) {
                continue;
            } else {
                ourCommand.add('payClicked', true);
                await clearAndSimulate($ac[0], code);
                $bad = await waitForElement('span:textEquals("Код не подходит")',
                    333, 5000).catch(() => $([]));
            }
        } while ($bad.length > 0 && tries < 5);
        if ($bad.length > 0) {
            throw `We used ${tries} codes and no one succeed :(`;
        }
        const $sent = await waitForElement('span:contains("отправили перевод"):visible',
            333, 15000).catch(() => $([]));
        return {
            success: $sent.length > 0,
            balance: await getBalance(),
            message: parseInt(data.amount) === -1 ? amount.toString() : data.amount,
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
            dLog('green', 'UMoney', [command, data]);
            const res = await this.cLinks[command](data)
                .catch(e => ({
                    success: false,
                    message: `${command}: ${e}, ${formatStack(e.stack)}`
                }));
            res['balance'] = await getBalance();
            if (res.success && command === 'TRANSFER_INTERNAL' && parseInt(data.amount) === -1) {
                res['balance'] = 0;
            }
            dLog(res.success ? 'green' : 'red', 'UMoney', `${command} result: ${res.message}`);
            await bMess('DEPOSIT_RESULT', true).set(res);
            if (!res.success && ['CHECK_BALANCE', 'TRANSFER_INTERNAL'].indexOf(command) === -1) {
                window.location.href = data.url;
            }
            return res;
        }
    };

    const messageProcessor = command => {
        const action = command.action || command.command;
        dLog('green', 'UMoney', `messageProcessor: ${action}`);
        if (commands.exists(action)) {
            // Hint: execute command
            ourCommand.set(command);
            commands.execute(action, command.data)
                .finally(() => {
                    ourCommand.clear();
                });
        } else {
            dLog('red', 'UMoney', [`Unknown UMoney command ${action}:`, command]);
        }
    };

    addEventListener("unload", async function () {
        if (ourCommand.isSet()) {
            dLog('green', 'UMoney', ['Command was set till unload:', ourCommand.get()]);
            await bMess('YOU_MONEY_COMMAND').set(ourCommand.get());
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    function afterDOMLoaded() {
        if (window.self === window.top) {
            bMess('YOU_MONEY_COMMAND').check(40000, true)
                .then(currentCommand => {
                    dLog('orange', 'UMoney', [`Execute:`, currentCommand]);
                    messageProcessor(currentCommand);
                })
                .catch(() => dLog('color: darkgray;', 'UMoney', 'No command!'));
            const ci = setInterval(async () => {
                await closeAllWeNeed({
                    'button:textEquals("Как-нибудь потом")': 'button:textEquals("Как-нибудь потом")',
                    'button.details__close-button': 'button, details__close-button'
                });
            }, 3000);
        } else {
            dLog('', 'UMoney', `Frame loaded: ${window.location.href}`);
        }
    }

})();