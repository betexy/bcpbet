(function () {

    "use strict";

    const isMain = window.self === window.top;

    const textEquals = (selector, text) => $(selector).filter(function () {
        return $(this).text().trim() === text;
    });

    const waitTextEquals = (selector, text, interval, max, visible) => async () => {
        const started = Date.now();
        while (Date.now() - started < max) {
            const $elem = textEquals(selector, text);
            if ($elem.length > 0 && !visible) {
                return $elem;
            } else if ($elem.length > 0 && visible && elementIsVisible($elem[0])) {
                return $elem;
            } else {
                await delayPromise(interval);
            }
        }
    };

    let command = {};

    let renewCommand = function () {
        return new Promise(function (onSuccess, onReject) {
            chrome.storage.local.set({
                'QIWI_COMMAND': command,
                'QIWI_COMMAND_WAS_SET': Date.now()
            }, function () {
                onSuccess();
            });
        });
    };

    let payCheckNew = function () {
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
        waitForCondition(() => {
            return $('button.signinBtn[data-action="login"]').length > 0
                || $('a[data-action="logout"]:contains("Выйти")').length > 0;
        }, 333, 30000, 'Not loaded :(')
            .then(() => {
                let $login = $('button.signinBtn[data-action="login"]');
                if ($login.length > 0) {
                    loginPCh($login)
                        .then(delayFunction(3333))
                        // Hint: page must reload!
                        .then(payCheckNew);
                }
            })
            .then(delayFunction(3333))
            .then(() => {
                let $dismiss = $('a[data-action="dismiss"]:contains("Больше не показывать")');
                if ($dismiss.length > 0) {
                    return mouseChain({target: $dismiss[0], events: ['click']})
                        .then(delayFunction(3333))
                        .then(waitForElementF('button[type="button"]:contains("Закрыть")', 333, 10000, true))
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(3333));
                }
            })
            .then(waitForCondition(() => {
                return !isNaN(parseFloat($('div.account_current_amount:visible').text().replace(',', '.').replace(/[^\d.]/g, '').trim()));
            }, 500, 30000, 'No balance!', true))
            .then(() => {
                let $b = $('div.account_current_amount:visible');
                if (parseFloat($b.text().replace(',', '.')
                    .replace(/[^\d.]/g, '').trim()) < parseFloat(command.data.amount)) {
                    throw 'NO_FUNDS! We have: ' + $b.text().trim() + ', we need: ' + command.data.amount;
                }
            })
            .then(waitForElementF('a[href="/payment/order.action"]:contains("Счета")', 333, 10000, true))
            .then(($el) => {
                if (!$el.parent().hasClass('active')) {
                    return delayPromise(3333, $el)
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(3333));
                }
            })
            .then(delayFunction(3333))
            .then(waitForElementF('div.ordersLine.status_NOT_PAID', 333, 15000, true))
            .then(() => {
                let billAmount = parseFloat($('div.ordersLine.status_NOT_PAID').first().find('div.amount').text()
                    .replace(',', '.').replace(/[^\d.]/g, '').replace(/.$/, '').trim());
                if (billAmount !== parseFloat(command.data.amount)) {
                    throw 'Last bill is for ' + billAmount + ', not for ' + command.data.amount;
                }
            })
            .then(() => {
                command.qiwiPayCheckNew = false;
                return renewCommand();
            })
            .then(delayFunction(3333))
            .then(() => mouseChain({
                target: $('div.ordersLine.status_NOT_PAID').first().find('div.payOperation')[0],
                events: ['click']
            }))
            .then(delayFunction(3333))
            // Hint: Here the interesting situation - other Qiwi window will appear...
            .then(waitForCondition(() => {
                // Hint: We're waiting for result from another window!
                getDepositResult();
                return typeof depositResult.success === 'boolean';
            }, 1000, 150000, 'no deposit result (or it is outdated) for 150s!', true))
            // Hint: whatever success - we closes window...
            .then(() => console.log('%cWe got Depo result:', 'color: green; font-size: 22px;', depositResult))
            .then(delayFunction(5000))
            .then(() => chrome.runtime.sendMessage({closeTabByPartOfUrl: window.location.href}, (r) => {
                console.log('%cClose result:', 'color: blue; font-size: 22px;', r)
            }))
            .catch((e) => qiwiReport(command, false, 'Pay check qiwi NEW: ' + e))
    };

    const getBalance = async () => {
        const $el = await waitForElement('div[class^="account-info-amount-"]', 333, 15000);
        return parseFloat($el.text().replace(',', '.').replace(/[^\d.]/g, '').trim());
    };

    const collectHistory = async () => {
        command.close = true;
        const allSel = 'div[class^="history-main-all"]';
        const nextSel = 'div[class^="history-next-self"]';
        let weekCollected = false;
        const d = new Date();
        d.setDate(d.getDate() - 7);
        console.log(`Collecting till: ${d.toDateString()}`);
        const delta = d.toISOString().substring(0, 10).split('-');
        let collected = [], result = [];
        const collectAndCheckVisible = async mphSel => {
            collected = [], result = [];
            await waitForElement(mphSel, 333, 10000);
            await delayPromise(3000);
            $(mphSel).find('span[class^="history-item-header-info-provider-"]').each(function () {
                const $this = $(this);
                const comment = $this.parent().parent().find('span[class^="history-item-header-info-comment-"]').text().trim();
                const sumDraft = $this.parent().parent().find('span[class^="history-item-header-sum-amount-"]').text().replace(',', '.').replace(/[^\d+'.]/g, '').trim();
                const dString = $this.closest('div[class^="history-block-self-"]').find('span[class^="history-block-date-value-"]').text().trim();
                const mNumber = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
                    .findIndex(t => t === dString.replace(/[^\D]/g, '').trim());
                const dNumber = parseInt(dString.replace(/[^\d]/g, ''));
                const date = new Date();
                console.log(`${dString} = ${dNumber} = ${mNumber}`);
                date.setDate(dNumber);
                date.setMonth(mNumber);
                // TODO: Add year fix fof first numbers of january
                date.setYear(delta[0]);
                collected.push({
                    description: $this.text().trim() + (comment.length > 0 ? ' ' + comment : ''),
                    amount: sumDraft.replace('+', ''),
                    type: sumDraft.indexOf('+') > -1 ? 'IN' : 'OUT',
                    datetime: dString,
                    date: date
                });
            });
            console.log('All collected: %O', collected);
            result = collected.filter(i => i.date >= d ? true : (weekCollected = true, false));
            console.log('result 1: %O', result);
            if (result && result.length > 0 && !weekCollected && $(allSel).length > 0) {
                await mouseChain({target: $(allSel)[0], events: fullClick, scroll: true});
                await delayPromise(1500);
                return collectAndCheckVisible('div[class^="content-column-self"]:has(div[class^="history-block-self"])');
            } else if (result && result.length > 0 && !weekCollected && $(nextSel).length > 0) {
                await mouseChain({target: $(nextSel)[0], events: fullClick, scroll: true});
                await delayPromise(1500);
                return collectAndCheckVisible('div[class^="content-column-self"]:has(div[class^="history-block-self"])');
            }
        };
        await collectAndCheckVisible('div[class^="history-main-content-"]');
        // If there is no last week's results
        if (!result || result.length === 0) {
            result = collected.slice(0, 5);
            console.log('result 2: %O', result);
        }
        console.log('Final result: %O', result);
        qiwiReport(command, true, {
            collected: result,
            balance: $('div[class^="account-info-amount-"]').text().replace(',', '.').replace(/[^\d.]/g, '').trim()
        });
        await mouseChain({target: $('a[href="/main"]')[0], events: fullClick});
    };

    const transferOne = async () => {
        command.close = true;
        const balance = await getBalance();
        let amount = parseFloat(command.data.amount);
        if (isNaN(balance) || isNaN(amount) || balance < amount) {
            qiwiReport(command, false, `Balance or amount is wrong! Balance: ${balance}, `
                + `amount: ${amount} at ${isMain} => ${document.location.href}`);
            return;
        }
        const $el = await waitForElement('a[href="/transfer"]', 333, 10000, true);
        await mouseChain({target: $el[0], events: ['click'], error: 'TF1'});
        const $el2 = await waitTextEquals('h3', 'Перевод на QIWI Кошелек',
            333, 15000, true)();
        await clearAndSimulate($el2.parent().find('input')[0], command.data.recipient);
        await delayPromise(3000);
        command.balanceBefore = balance;
        await renewCommand();
        await mouseChain({
            target: textEquals('h3', 'Перевод на QIWI Кошелек').parent()
                .find('button')[0],
            events: ['click'], error: 'TF2',
        });
        await delayPromise(10000)
        await payCheck();
    };

    const transferTwo = async () => {
        await waitTextEquals('h1', 'Перевод на QIWI Кошелек', 333, 15000, true)();
        await waitForElement('div[class^="mask-text-input-form-field-input-"]', 333, 3333);
        await delayPromise(3000);
        await clearAndSimulate($('div[class^="mask-text-input-form-field-input-"]').last()
            .find('input')[0], parseInt(command.data.amount) === -1 ? getBalance() : command.data.amount);
        await delayPromise(3000);
        await mouseChain({
            target: $('button:contains("Оплатить")')[0],
            events: ['click'],
            scroll: true, error: 'TF3'
        });
        await delayPromise(1000);
        command.beforeConfirm = true;
        await renewCommand();
        const $el = await waitForElement('button:contains("Подтвердить")', 333, 15000);
        await mouseChain({target: $el[0], events: ['click'], scroll: true, error: 'TF4'});
        await delayPromise(3000);
        const errSel = 'h2:contains("Ошибка платежа"):visible';
        await waitForCondition(() => checkSE(['h3:contains("Платеж проведен")', errSel]),
            333, 10000, 'Nothing happens!');
        if ($(errSel).length > 0) {
            throw 'ACCOUNT IS LIMITED!!! ' + $('div[class^="error-dialog-content-"] p').text().trim();
        }
        await waitForCondition(async () => {
            const balance = await getBalance();
            return !isNaN(balance) && balance < command.balanceBefore;
        }, 333, 60000, 'Balance not changed for 60s!')
        await bMess('QIWI_WB').set(await getBalance());
        qiwiReport(command, true, `Transfer should be done!`);
    };

    const payCheck = async () => {
        if (!isMain) {
            return;
        } else if (command.beforePayCheckClick) {
            bsLogger('orange', 'QIWI', '-= PAY CHECK MODERN VARIANT =-');
            confirmAmount(command.data);
            return;
        }
        const payCheckCommand = typeof command.command === 'string' ? command.command : 'PAY_CHECK';
        dLog('yellow', 'QIWI', `-= PAY CHECK =- at ${isMain} => ${document.location.href}`);
        if (['https://qiwi.com/main', 'https://w.qiwi.com/main'].indexOf(document.location.href) > -1) {
            dLog('green', 'QIWI', `-= PAY CHECK ${payCheckCommand} =-`);
            if (payCheckCommand === "PAY_CHECK") {
                command.close = true;
                const balance = await getBalance();
                if (isNaN(balance) || balance < parseFloat(command.data.amount)) {
                    throw `NO_FUNDS: we have ${balance}, we need: ${command.data.amount}`;
                }
                const $el2 = await waitForElementF('div[class^="invoices-content-"] div[class^="item-self-"]',
                    333, 10000);
                const $b = $el2.first().find('span[class^="button-content-text-"]:contains("Оплатить")');
                if ($b.length === 1 && parseFloat($b.text().replace(/[^\d.]/g, '').trim())
                    === parseFloat(command.data.amount)) {
                    command.beforePayCheckClick = true;
                    await renewCommand()
                    await delayPromise(3000);
                    await mouseChain({target: $b.parent().parent()[0], events: ['click'], error: '$b'});
                } else {
                    throw 'There is no our check!';
                }
                await delayPromise(8000);
                // Hint: Here all our actions may be done...
                window.close();
            } else if (payCheckCommand === 'CHECK_BALANCE') {
                command.close = true;
                qiwiReport(command, true, (await getBalance()).toString());
            } else if (payCheckCommand === 'TRANSFER_INTERNAL' && typeof command.balanceBefore === 'undefined') {
                // Hint: first form of sending money
                await transferOne();
            } else if (payCheckCommand === 'HISTORY') {
                await collectHistory();
            }
        } else if (payCheckCommand === 'TRANSFER_INTERNAL' && typeof command.balanceBefore !== 'undefined') {
            // Hint: second form to send money
            await transferTwo();
        } else if (['https://w.qiwi.com/', 'https://qiwi.com/'].indexOf(document.location.href) > -1) {
            if (command.loginClicked) {
                dLog('green', 'QIWI', 'PAY CHECK LOGIN - FFF');
                await delayPromise(8000);
                await payCheck();
            } else {
                dLog('green', 'QIWI', 'PAY CHECK LOGIN - SSS');
                // Hint: Login # 1 - 1
                const $el = await waitTextEquals('button[type="submit"]', 'Войти', 333, 10000)()
                await loginPCh($el);
                await payCheck();
            }
        } else {
            dLog('green', 'QIWI', 'PAY CHECK WRONG: ' + command.wasWrong);
            if (command.wasWrong && command.wasWrong > 3) {
                qiwiReport(command, false, 'Wrong url: ' + document.location.href);
            } else {
                command.wasWrong = command.wasWrong ? command.wasWrong + 1 : 1;
                await renewCommand();
                await delayPromise(8000);
                await payCheck();
            }
        }
    };

    //command = {data: {login: '79237423586', password: 'Bghd1234!@#^vfg'}};
    // Hint: Login # 1
    let loginPCh = function ($el) {
        return mouseChain({target: $el[0], events: ['click']})
            .then(waitForElementF('input[type="tel"]', 333, 10000, true))
            .then(($el) => clearAndSimulate($el[0], (command.data.login.indexOf('+') === -1 ? '+' : '') + command.data.login))
            .then(delayFunction(1111))
            .then(() => clearAndSimulate($('input[type="password"]')[0], command.data.password))
            .then(delayFunction(1111))
            .then(() => {
                command.loginClicked = true;
                return renewCommand();
            })
            .then(() => mouseChain({
                target: textEquals('form button[type="submit"]', 'Войти')[0],
                events: ['click']
            }))
            .then(waitForNotConditionF(() => {
                return $('div[class^="auth-error-self-"]').text().trim() !== '';
            }, 333, 5555, 'Change Password'))
            .then(delayFunction(7777))
            .then(() => {
                if (elementIsVisible(textEquals('form button[type="submit"]', 'Войти')[0]) &&
                    $('div.antigate_solver a.status').length > 0) {
                    return waitForCondition(() => {
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
                    }, 555, 200000, 'reCaptcha not solved for 200s')
                        .then(delayFunction(3333))
                        .then(() => mouseChain({
                            target: textEquals('form button[type="submit"]', 'Войти')[0],
                            events: ['click']
                        }))
                        .then(delayFunction(7777));
                }
            });
    };

    const confirmAmount = data => {
        const payButtonSelector = 'button:contains("Оплатить"):visible';
        const payMethodSelector = '#PaymentMethod-Select';
        const wayOne = async () => {
            dLog('blue', 'QIWI', '-= Way ONE =-');
            if ($('#Mode-CARD').attr('data-isactive') === 'true') {
                await delayPromise(1000);
                await mouseChain({target: $('#Mode-QIWI')[0], events: fullClick, error: 'Mode-QIWI'});
                await delayPromise(6000);
            }
            if ($(payMethodSelector).val() === 'CARD/CARD') {
                await delayPromise(1000);
                await selectLikePuppeteer($(payMethodSelector)[0], ['QIWI/QIWI_RUB']);
                await delayPromise(6000);
            }
            const sels = {
                '0': 'li.checkout-payment-methods-item:contains("Visa Qiwi Wallet")',
                '1': `span:contains("${data.login}")`,
                '2': 'h2:contains("Оплата с Рублевого счёта Visa QIWI Wallet")',
                '3': 'h2:contains("Оплата с EUR счёта Visa QIWI Wallet")',
                '4': 'select option[value="QIWI/QIWI_RUB"]:selected',
                '5': 'select option[value="CARD/CARD"]:selected',
                '6': `button[class^="button-self-"]:textEquals("Оплатить ${data.amount} ₽")`,
                '7': `button:textEquals("Оплатить ${data.amount} ₽")`,
                '8': 'button:textEquals("Далее")',
            };
            await waitForCondition(() => Object.values(sels).some(s => $(s).length > 0), 333, 80000, 'No PS selectors!');
            if ($(sels['6']).length > 0 || $(sels['7']).length > 0) {
                await delayPromise(1000);
                await mouseChain({
                    target: $([sels['6'], sels['7']].find(s => $(s).length > 0))[0],
                    events: fullClick,
                    error: 'Invoice pay',
                    scroll: true
                });
            } else {
                if ($(sels['5']).length > 0) {
                    await delayPromise(1000);
                    await selectLikePuppeteer($(sels['5']).parent()[0], ['QIWI/QIWI_RUB']);
                    await delayPromise(5000);
                }
                if ($(sels['2']).length === 0 && $(sels['3']).length === 0 && $(sels['4']).length === 0) {
                    await delayPromise(3000);
                    await mouseChain({
                        target: $([sels['0'], sels['1']].find(s => $(s).length > 0))[0],
                        events: fullClick,
                        error: 'XuZ'
                    });
                    await delayPromise(3000);
                }
                let $butt = $('button[id^="SourceSwitcher"]:visible');
                if ($butt.text().indexOf('долларах') > -1) {
                    await mouseChain({target: $butt[0], events: ['click']});
                    const $el = await waitForElement('div[class^="optionContainer-"]:contains("рублях"):visible', 333, 3333);
                    await delayPromise(3000);
                    await mouseChain({target: $el[0], events: fullClick, error: 'ZuX'});
                    await delayPromise(3000);
                }
                const bSels = [
                    'div[class^="account-info-amount-"]',
                    'span[class^="balance-"]',
                    '#PaymentMethod-Select option[value="QIWI/QIWI_RUB"]',
                ];
                const balance = $(bSels.find(s => $(s).length > 0)).text()
                    .replace(/,/g, '.').replace(/[^\d.]/g, '').trim();
                if (balance !== '') {
                    await bMess('QIWI_WB').set(balance);
                }
                const noFunds = (balance !== '' && parseInt(balance) === 0) || await waitForCondition(() =>
                    textEquals('div:visible', 'У вас недостаточно средств для проведения платежа').length > 0
                    || $('span:contains("Вы можете пополнить кошелек с"):visible').length > 0, 300, 5000)
                    .catch(e => false);
                if (noFunds) {
                    throw 'NO_FUNDS';
                } else {
                    await mouseChain({target: $(payButtonSelector)[0], events: ['click'], error: 'Pay RYZ'});
                }
            }
            const sels2 = ['.checkout-alert-content:contains("Недостаточно средств")',
                'span:contains("Оплата проведена")', 'span:contains("Оплата успешно проведена")',];
            await waitForCondition(() => sels2.some(s => $(s).length > 0), 200, 15000, 'No confirmation!');
            if ($(sels2[0]).length > 0) {
                throw 'NO_FUNDS';
            }
            return 'Payment successful!';
        };
        const wayTwo = async () => {
            dLog('blue', 'QIWI', ' -= Way TWO =-');
            // Hint: Login # 2
            await mouseChain({
                target: $('label:contains("Пароль от QIWI Кошелька")')[0],
                events: ['click'],
                error: 'W21'
            });
            const $el = await waitForElement('input[type="password"]:visible', 333, 10000);
            await clearAndSimulate($el[0], data.password);
            await delayPromise(1000);
            await mouseChain({
                target: $('span:contains("Продолжить")').parent()[0],
                events: ['click'],
                error: 'W22'
            });
            await delayPromise(8000);
            if ($('#PasscodeForm-PasswordInput-Error:visible').length > 0) {
                throw 'Change Password';
            }
            return await wayOne();
        };
        const wayThree = async () => {
            dLog('blue', 'QIWI', '-= Way THREE =-');
            // Hint: Login # 3 - 2
            const sel = ['#password:visible', '#PasscodeForm-PasswordInput:visible'].find(s => $(s).length > 0);
            await clearAndSimulate($(sel)[0], data.password);
            await delayPromise(3000);
            await mouseChain({
                target: $(['#doLogin', '#PasscodeForm-Submit'].find(s => $(s).length > 0))[0],
                events: ['click']
            });
            await delayPromise(8000);
            if ($('*:contains("Неверный логин или пароль"):visible').length > 0) {
                throw 'Change Password';
            }
            return await wayOne();
        };
        (async () => {
            dLog('blue', 'QIWI', ['-= CONFIRM AMOUNT =-', data]);
            await delayPromise(1000);
            const sels = [
                'button:contains("Оплатить"):visible',
                'label:contains("Пароль от QIWI Кошелька")',
                'span:textEquals("Перейти к оплате")',
                '#password:visible',
                '#PasscodeForm-PasswordInput:visible',
                'button:textEquals("Далее")',
                '#radio-PaymentMode-QIWI'
            ];
            await waitForCondition(() => sels.some(s => $(s).length > 0),
                333, 15000, `No ${sels.join(', ')} at ${window.location.href}`);
            await delayPromise(1000);
            if ($(sels[6]).length > 0) {
                dLog('green', 'QIWI', `Radio QIWI`);
                await mouseChain({target: $('#radio-PaymentMode-QIWI')[0], events: fullClick, error: 'rpq'});
                await delayPromise(3000);
                await mouseChain({target: $('button:textEquals("Продолжить")')[0], events: fullClick, error: ''});
                await delayPromise(15000);
                confirmAmount(data);
                await delayPromise(300000);
            } else if ($(sels[2]).length > 0) {
                dLog('green', 'QiWi', `Sels[2] way! ${command.closeMara}`);
                await mouseChain({target: $(sels[2])[0], events: fullClick, error: 'sels[2]'});
                await delayPromise(300000);
            } else if ($(payButtonSelector).length > 0 || $(sels[5]).length > 0) {
                return await wayOne();
            } else if ($(sels[3]).length > 0 || $(sels[4]).length > 0) {
                return await wayThree();
            } else {
                return await wayTwo();
            }
        })()
            .then(m => qiwiReport(command, true, m))
            .catch(e => qiwiReport(command, false,
                `Confirm amount: ${e}, ${formatStack(e.stack)} at ${document.location.href}`));
    };

    let afterDOMLoaded = function () {
        console.log('AFTER DOM LOADED! ' + window.location.href);
        if (window.location.href.indexOf('sso.qiwi.com') === -1) {
            bMess('QIWI_COMMAND', true).check(60000)
                .then(currentCommand => {
                    console.log(currentCommand);
                    command = currentCommand;
                    if (command.closeMara) {
                        chrome.runtime.sendMessage({
                            addThisToOpenedTabs: true
                        }, r => dLog('blue', 'QIWI', `Add result: ${r}`));
                    }
                    if (typeof command.qiwiPayCheckNew === 'boolean' && command.qiwiPayCheckNew) {
                        delayPromise(10000).then(payCheckNew);
                    } else if (typeof command.qiwiPayCheck === 'boolean' && command.qiwiPayCheck) {
                        delayPromise(10000)
                            .then(() => payCheck())
                            .catch(e => qiwiReport(command, false, `Pay check: ${e}, ${formatStack(e.stack)}`));
                    } else {
                        delayPromise(7777).then(() => confirmAmount(currentCommand.data));
                    }
                })
                .catch(e => dLog('color: darkgray', 'QIWI', `No command: ${e}!`));
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    dLog('green', 'QIWI', 'SCRIPT LOADED!');
})();

if (1 !== 1) {
    // Hint: for manual execution
    bMess('QIWI_COMMAND', true)
        .set({
            command: 'TRANSFER_INTERNAL',
            //command: 'HISTORY',
            //command: 'CHECK_BALANCE',
            qiwiPayCheck: true,
            data: {
                login: '79538882836',
                password: 'mz5lhFNpa',
                pin: '',
                recipient: '79237026741',
                amount: 100
            }
        })
        .then(() => console.log('Command was set! Start wait...'))
        .then(() => bMess('DEPOSIT_RESULT', true)
            .get(180000, 30000, 1000, true))
        .then(depositResult => console.log(depositResult))
        .catch(e => {
            console.error(e);
        });
}