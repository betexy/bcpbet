(() => {

    'use strict';

    if (window.location.href.indexOf('pay.1cupis.ru') === -1
        && document.location.href.indexOf('cps-it.ru') === -1) {
        dLog('red', 'CUPIS', `Skipping ${document.location.href}`);
        return;
    }

    if (document['pUBU7ssx7BMkufDiM6x9']) {
        dLog('red', 'FC', 'CUPIS already loaded!');
        return;
    } else {
        document['pUBU7ssx7BMkufDiM6x9'] = true;
    }

    const port = chrome.runtime.connect({name: "port_cupis"});

    const settings = {uid: '123', phone: ''};
    const ourCommand = new ourCommandProto();
    const smsApiMessage = new smsApiMessageProto(port, settings, ourCommand);

    port.onMessage.addListener(function (message) {
        if (message.action === 'SMS_API' && message.data) {
            smsApiMessage.setMessage(message.data.status, message.data.message);
        }
    });

    const getNumber = number => {
        // '+7 (987) 654 32 10';
        const n = number.replace('+', '').replace(/^7/, '');
        return `+7 (${n.substr(0, 3)}) ${n.substr(3, 3)} ${n.substr(6, 2)} ${n.substr(8, 2)}`;
    };

    const afterDOMLoaded = () => {
        (async () => {
            /**
             * @type {object}
             */
            const command = await bMess('QIWI_COMMAND', true).check(30000);
            ourCommand.set(command);
            const $el = await waitForElement('#qiwi0_qiwi_phone', 333, 30000);
            await delayPromise(7000);
            const enter = command.data.login.replace('+', '').replace(/^7/, '');
            const correct = getNumber(command.data.login);
            let cnt = 0;
            bsBLogger('', 'CUPIS', `Number: '${enter}', '${correct}'`);
            do {
                if (cnt > 0) {
                    bsBLogger('', 'CUPIS', `${cnt}: '${$el.val().trim()}' === '${correct}'`);
                }
                await clearAndSimulate($el[0], enter);
                await delayPromise(5000);
                cnt++;
            } while (cnt < 3 && $el.val().trim() !== correct);
            if ($el.val().trim() !== correct) {
                qiwiReport(command, false, `CUPIS: We can't enter correct number!`);
                throw `Can't enter number!`;
            }
            await bMess('QIWI_COMMAND', true).set(command);
            const $btn = await waitForElement('#qiwi0_qiwi_submit', 300, 10000);
            await delayPromise(3000);
            await mouseChain({target: $btn[0], events: fullClick, error: 'Cupis Btn'});
            bsBLogger('green', 'CUPIS', 'We have to go to QIWI!');
        })()
            .catch(e => dLog('', 'CUPIS', `Cupis: ${e}`));
        (async () => {
            await waitForElement('h1.panel__header:contains("Перевод выполнен")', 333, 30000);
            await bMess('DEPOSIT_RESULT', true).set({success: true, message: 'Everything is Okay!'});
            await mouseChain({target: $('#result-move-start')[0], events: ['click']});
        })()
            .catch(e => dLog('', 'CUPIS', `Cupis 2: ${e}`));
        (async () => {
            /**
             * @type {object}
             */
            const command = await bMess('QIWI_COMMAND', true).check(30000);
            ourCommand.set(command);
            const $code = await waitForElement('input[name="validation"]', 333, 30000, true);
            await (async () => {
                settings.phone = command.data.login;
                dLog('blue', 'CUPIS', `Awaiting for SMS, req: ${ourCommand.getAdded('sms_api_request_id')}`);
                const code = await smsApiMessage.waitForSMSCode(['1cupis.ru'],
                    (m) => {
                        dLog('orange', 'CUPIS', `sms: '${m}'`);
                        return ['Для вывода', 'введите код'].every(t => m.indexOf(t) > -1);
                    },
                    (m) => {
                        let r = /введите код.*?(\d+)/g.exec(m);
                        return r && r[1] ? r[1] : '';
                    }, 300000);
                await clearAndSimulate($code[0], code);
                await delayPromise(700);
                await bMess('DEPOSIT_RESULT', true).set({success: true, message: 'Code entered!'});
                bsSendSmsApi(port, 'BIND_RELEASE', {
                    "websocket_uid": settings.uid,
                    "request_id": ourCommand.getAdded('sms_api_request_id')
                });
                await mouseChain({target: $('#other_qiwi_submit')[0], events: fullClick, error: 'oqs'});
            })()
                .catch(e => bMess('DEPOSIT_RESULT', true).set({success: false, message: `Cupis 3: ${e}`}));
        })()
            .catch(e => dLog('', 'CUPIS', `Cupis 3: ${e}`));
        (async () => {
            await waitForElement('h1.panel__header:contains("Ждем подтверждения")', 333, 30000);
            await bMess('DEPOSIT_RESULT', true).set({success: true, message: 'Everything is Okay!'});
            await mouseChain({target: $('#result-move-start')[0], events: ['click']});
        })()
            .catch(e => dLog('', 'CUPIS', `Cupis 4: ${e}`));
        (async () => {
            await waitForElement('strong:contains("has been successful!")', 333, 45000);
            await bMess('DEPOSIT_RESULT', true).set({success: true, message: 'Everything is Okay!'});
        })()
            .catch(e => dLog('', 'CUPIS', `Cupis 5: ${e}`));
        (async () => {
            const $pay = await waitForElement('#make_payment_billing_info', 333, 45000);
            if ($pay.length > 0) {
                await delayPromise(2000);
                await mouseChain({target: $pay[0], events: fullClick, error: '$pay'});
            }
        })()
            .catch(e => dLog('', 'CUPIS', `Cupis 6: ${e}`));

    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    dLog('red', 'CUPIS', 'Script loaded!');

})();