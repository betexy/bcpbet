(function () {

    "use strict";

    let command = {};

    let report = function (success, message) {
        console.log('%c -= ' + success + ' / ' + message + ' =-', 'background: green; color: white; font-weight: bold;');
        chrome.storage.local.set({
            'DEPOSIT_RESULT': {
                success: success,
                message: message
            },
            'DEPOSIT_RESULT_WAS_SET': Date.now()
        });
        chrome.storage.local.remove(['BLOCKCHAIN_COMMAND', 'BLOCKCHAIN_COMMAND_WAS_SET'], function () {
            if (!success) {
                delayPromise(3333)
                    .then(() => {
                        if (typeof command.close === 'boolean' && command.close) {
                            window.close();
                        }
                    });
            } else if (typeof command.close === 'boolean' && command.close) {
                window.close();
            } else {
                delayPromise(17000)
                    .then(() => {
                        if (window.location.href !== command.data.url) {
                            window.location.href = command.data.url;
                        }
                    });
            }
        });
    };

    let renewCommand = function () {
        return new Promise(function (onSuccess, onReject) {
            chrome.storage.local.set({
                'BLOCKCHAIN_COMMAND': command,
                'BLOCKCHAIN_COMMAND_WAS_SET': Date.now()
            }, function () {
                onSuccess();
            });
        });
    };

    /**
     *
     * @param timeout
     * @param maxWait
     * @returns {Promise<String>}
     */
    let waitForConfirmUrl = function (timeout, maxWait) {
        let max = typeof maxWait === 'number' ? maxWait : 180000;
        return new Promise(function (onSuccess, onReject) {
            let waitStarted = Date.now();
            let performCheck = function () {
                bsEmailCheck(command.data.email, 'BLOCKCHAIN_CONFIRM_LINK', timeout)
                    .then((m) => {
                        console.log('%cEmail answer:', 'background: blue; color: white; font-weight: bold;');
                        console.log(m);
                        if (m.status === 'success' && typeof m.message === 'object' && m.message.length > 0
                            && typeof m.message[0].data === 'string') {
                            onSuccess(m.message[0].data);
                        } else if (Date.now() - waitStarted < max) {
                            delayPromise(5555).then(performCheck);
                        } else {
                            throw 'We had waited for email with confirm url for ' + (Date.now() - waitStarted) + 'ms and nothing :(';
                        }
                    })
                    .catch((e) => onReject(e));
            };
            performCheck();
        });
    };

    let logInto = function () {
        return new Promise(function (onSuccess, onReject) {
            let waitForBalance = function () {
                waitForCondition(() => {
                    let balance = parseFloat($('div[data-e2e="BTCBalance"]').text().replace(/[^\d\.]/g, '').trim());
                    return !isNaN(balance) && balance > 0;
                }, 555, 30000, 'Balance is 0 for 20 s')
                    .then(() => onSuccess($('div[data-e2e="BTCBalance"]').text().replace(/[^\d\.]/g, '').trim()))
                    .catch(() => onSuccess($('div[data-e2e="BTCBalance"]').text().replace(/[^\d\.]/g, '').trim()));
            };
            if (command.goToLink) {
                waitForElement('span:contains("Login approved! Please return")', 333, 30000)
                    .then(() => {
                        command.goToLink = false;
                    })
                    .then(renewCommand)
                    .then(delayFunction(3333))
                    .then(() => window.history.back())
                    .catch((e) => onReject('After approved login: ' + e));
            } else {
                waitForCondition(() => {
                    return $('input[data-e2e="loginGuid"]').length > 0 || $('div[data-e2e="BTCBalance"]').length > 0;
                }, 555, 30000, 'We are somewhere else!')
                    .then(() => {
                        if ($('input[data-e2e="loginGuid"]').length > 0) {
                            return delayPromise(3333)
                                .then(() => {
                                    if ($('input[data-e2e="loginGuid"]').val() !== command.data.login) {
                                        return clearAndSimulate($('input[data-e2e="loginGuid"]')[0], command.data.login)
                                            .then(delayFunction(3333));
                                    }
                                })
                                .then(() => clearAndSimulate($('input[data-e2e="loginPassword"]')[0], command.data.password))
                                .then(delayFunction(3333))
                                .then(() => mouseChain({target: $('button[data-e2e="loginButton"]')[0], events: ['click']}))
                                .then(delayFunction(7777))
                                .then(() => {
                                    if ($('span:contains("Authorization required. Please check your mailbox."):visible').length > 0) {
                                        return waitForConfirmUrl(Math.ceil(Date.now() / 1000) - 10)
                                            .then((link) => {
                                                command.goToLink = link;
                                            })
                                            .then(renewCommand)
                                            .then(delayFunction(3333))
                                            .then(() => {
                                                document.location.href = command.goToLink;
                                            });
                                    } else if ($('span:contains("Error decrypting wallet"):visible').length > 0) {
                                        throw 'Error decrypting wallet!';
                                    }
                                })
                                .then(waitForElementF('div[data-e2e="BTCBalance"]', 333, 30000))
                                .then(waitForBalance);
                        } else if ($('div[data-e2e="BTCBalance"]').length > 0) {
                            waitForBalance();
                        } else {
                            throw 'No balance and no login :(';
                        }
                    })
                    .catch((e) => onReject('Logging in: ' + e));
            }
        });
    };
    //logInto().then((m) => console.log(m)).catch((e) => console.error(e));

    let executeCommand = function () {
        logInto()
            .then((balance) => {
                command.close = true;
                if (command.command === 'CHECK_BALANCE') {
                    report(true, balance);
                } else if (command.command === 'HISTORY') {
                    return waitForElement('li[href="#/btc/transactions"]', 333, 10000)
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(3333))
                        .then(waitForElementF('div[class*="TransactionRowContainer"]', 333, 20000))
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => {
                            let collected = [];
                            $el.each(function () {
                                let $this = $(this);
                                collected.push({
                                    description: $this.find('div[class^="Addresses__Wrapper"]').text().trim(),
                                    amount: $this.find('div[data-e2e="BTCAmt"]').text().replace(/[^\d.]/g, '').trim(),
                                    type: $this.find('div[data-e2e="transactionListItemStatus"]').text().indexOf('Received') > -1 ? 'IN' : 'OUT',
                                    datetime: $this.find('div[class^="template__StatusColumn"] div').last().text().trim()
                                });
                            });
                            report(true, {
                                collected: collected,
                                balance: balance
                            });
                        });
                } else if (command.command === 'TRANSFER_INTERNAL') {
                    let haveBalance = parseFloat(balance);
                    let needBalance = parseFloat(command.data.amount);
                    if (isNaN(haveBalance) || isNaN(needBalance) || haveBalance < needBalance) {
                        report(false, 'NO_FUNDS - we need: ' + needBalance + ', we have: ' + haveBalance);
                        return;
                    }
                    return waitForElement('button[class^="template__ActionButton"]:has(span:textEquals("Send"))', 333, 10000)
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(waitForElementF('div[class^="SelectBoxCoin__HeaderWrapper"]', 333, 10000, true))
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => {
                            if ($el.find('div[class$="_single-value"]').text().trim() !== 'Bitcoin') {
                                throw 'No Bitcoin selected!';
                            }
                        })
                        .then(() => clearAndSimulate($('input[data-e2e="sendBtcAddressTextBox"]')[0], command.data.recipient))
                        .then(delayFunction(3333))
                        .then(() => clearAndSimulate($('input[data-e2e="sendBtcCryptoAmount"]')[0], command.data.amount))
                        .then(delayFunction(3333))
                        .then(() => mouseChain({
                            target: $('div[class^="Send__FeeFormContainer-"] div[class^="SelectBox__Container"] div[class$="bc__control"]')[0],
                            events: ['debuggerClick'],
                            clickInBK: 'blockchain',
                            clickToCenter: true
                        }))
                        .then(delayFunction(1111))
                        .then(waitForElementF('div[class*="bc__menu"] span:contains("Priority")', 333, 10000, true))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(3333))
                        .then(() => mouseChain({target: $('button[type="submit"]:contains("Continue")')[0], events: ['click']}))
                        .then(delayFunction(3333))
                        .then(waitForElementF('button[type="button"]:contains("Send Bitcoin")', 333, 10000, true))
                        .then(($el) => delayPromise(3333, $el))
                        .then(($el) => mouseChain({target: $el[0], events: ['click']}))
                        .then(delayFunction(11111))
                        .then(() => mouseChain({target: $('li[data-e2e="dashboardLink"]')[0], events: ['click']}))
                        .then(delayFunction(11111))
                        .then(() => report(true, parseFloat($('div[data-e2e="BTCBalance"]').text().replace(/[^\d\.]/g, '').trim())))
                }
            })
            .catch((e) => report(false, 'Can\'t login: ' + e));
    };

    let afterDOMLoaded = function () {
        console.log('AFTER DOM LOADED!');
        chrome.storage.local.get(['BLOCKCHAIN_COMMAND', 'BLOCKCHAIN_COMMAND_WAS_SET'], function (result) {
            if (typeof result.BLOCKCHAIN_COMMAND !== 'undefined' && typeof result.BLOCKCHAIN_COMMAND_WAS_SET !== 'undefined'
                && Date.now() - result.BLOCKCHAIN_COMMAND_WAS_SET < 60000) {
                let currentCommand = result.BLOCKCHAIN_COMMAND;
                console.log(currentCommand);
                command = currentCommand;
                executeCommand();
            } else {
                console.log('%c -= REMOVE ONE =-', 'background: red; color: yello; font-weight: bold;');
                chrome.storage.local.remove(['BLOCKCHAIN_COMMAND', 'BLOCKCHAIN_COMMAND_WAS_SET']);
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afterDOMLoaded);
    } else {
        afterDOMLoaded();
    }

    console.log('SCRIPT LOADED!');
})();