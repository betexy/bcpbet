(function () {

    "use strict";

    let command = {};

    const doDeposit = async () => {
        command.close = true;
        const $el = await waitForElement('div.arrow-div', 333, 30000);
        if ($el.closest('div.pm_container').find('div.pm_available')
            .attr('title') !== command.data.login) {
            await mouseChain({
                target: $(`div.pm_available[title="${command.data.login}"]`)[0],
                events: ['click'], error: 'dpma1',
            });
            await delayPromise(3000);
        } else {
            dLog('orange', 'SCH', 'Skrill Selected!');
        }
        const ia1s = '#item_amount_1';
        const $el2 = await waitForElement(ia1s, 333, 30000);
        await delayPromise(15000);
        $el2[0].scrollIntoView();
        await clearAndSimulate($el2[0], command.data.amount);
        await delayPromise(5500);
        await clearAndSimulate($(ia1s)[0], command.data.amount);
        await delayPromise(5500);
        await bMess(`${command.data.paysystem}_COMMAND`, true).set(command);
        if (parseFloat($(ia1s).val()) !== parseFloat(command.data.amount)) {
            dLog('red', 'SCH', `-= WRONG AMOUNT: ${$(ia1s).val()} instead of command.data.amount !!! =-`);
            throw 'Bad bad bad!';
        }
        await mouseChain({target: $('#continueButton')[0], events: ['click'], error: 'cb', scroll: true});
    };

    const doWithdraw = async () => {
        if (command.data.pay_system === 'SKRILL') {
            const $el = await waitForElement('span.upm-logo.apmgw_moneybookers', 333, 30000);
            $el[0].scrollIntoView();
            await clearAndSimulate($el.parent().parent().find('input.sub_amount')[0], command.data.amount);
            await delayPromise(5000);
            await mouseChain({
                target: $('span.upm-logo.apmgw_moneybookers').parent().parent()
                    .find('button.sub_withdraw')[0],
                events: ['click'],
                error: 'sub_withdraw',
            });
        } else if (command.data.pay_system === 'NETELLER') {
            const $tr = await waitForElement('tr:has(span.apmgw_neteller)', 333, 30000);
            $tr[0].scrollIntoView();
            const login = $tr.find('span.pm-details').text().trim();
            if (login !== command.data.login) {
                throw `Insufficient login ${login} instead of ${command.data.login}`;
            }
            await delayPromise(1000);
            await clearAndSimulate($tr.find('input.sub_amount')[0], command.data.amount);
            await delayPromise(5000);
            await mouseChain({
                target: $tr.find('button.sub_withdraw')[0],
                events: ['click'],
                error: 'sub_withdraw',
            });
        } else {
            throw `Unsupported PS: ${command.data.pay_system}`;
        }
        const $el2 = await waitForElement('button.ok.modal_close:visible',
            333, 30000, true);
        await bMess('DEPOSIT_RESULT', true).set({
            success: true,
            message: 'It looks good!'
        });
        await delayPromise(3000);
        await mouseChain({target: $el2[0], events: ['click']});
    };

    let afterDOMLoaded = function () {
        if (window.self === window.top) {
            dLog('green', 'SCH', '-= afterDOMLoaded =-');
        } else {
            console.log('Frame loaded: ' + window.location.href);
        }
        bMess('SCH_COMMAND', true).get(100000, 60000)
            .then(async currentCommand => {
                dLog('green', 'SCH', ['-= SF GOT command =-', currentCommand]);
                command = currentCommand;
                await bMess('SCH_COMMAND', true).remove();
                if (command.action === 'DEPOSIT') {
                    await doDeposit()
                        .catch(e => dLog('red', 'SCH', `Error: ${e}, ${formatStack(e.stack)}`));
                } else if (command.action === 'WITHDRAW') {
                    await doWithdraw()
                        .catch(async e => {
                            await bMess('DEPOSIT_RESULT', true).set({
                                success: false,
                                message: 'Something went wrong: ' + e
                            });
                        });
                } else {
                    throw `Unsupported: ${command.action}`
                }
            })
            .catch(e => dLog('color: darkgray', 'SCH', 'NO COMMAND!'));
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

})();