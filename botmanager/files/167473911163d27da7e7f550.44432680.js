(() => {
    'use strict';

    class Multibet {
        /**
         * Multibet prepare
         * @param {MainLoop} parent
         */
        constructor(parent) {
            this.working = false;
            this._parent = parent;
            this.data = false;
            this.marker = false;
            this.stakes = [];
            this.currentData = {};
            this.betResults = [];
            this.interval = false;
            this.bk = '';
        }

        start(data, bk) {
            this.working = true;
            this.bk = bk;
            this.data = data;
            this.marker = data[0];
            this.betResults = [];
            this.interval = typeof this.marker.interval !== 'undefined' ? parseInt(this.marker.interval) * 1000 : 10000;
            this.marker['doNotOpen'] = true;
            this.stakes = data.slice(1);
            this._parent.common.openBk(bk, false)
                .then(() => this.rockNroll());
        }

        rockNroll() {
            this.currentData = this.stakes.shift();
            //console.log('%crockNroll', 'background: yellow; font-weight: bold;');
            //console.log((new Error().stack));
            console.log('Max for', this.marker);
            console.log('Current is', this.currentData);
            if (this.currentData) {
                this.currentData.coef = '1.2';
                this.currentData.score = '';
                this._parent.proceedCommand()['MAXIMUM']({
                    action: 'MAXIMUM',
                    data: [this.marker]
                }, this.bk);
                //console.log('Maximum was sent for this stake: ', this.currentData);
            } else {
                this.loopFinished('GOOD', 'Everything is OK!');
            }
        }

        proceedAnswer() {
            const self = this;
            return {
                'MAXIMUM': (message, bk) => {
                    // HINT: score and coef and market availability will check getMax :)
                    if (message.status === 'success') {
                        if (typeof message.answer.coef !== 'undefined' && parseFloat(message.answer.coef) < parseFloat(self.marker.coef)) {
                            // HINT: here we finish the cycle
                            self.loopFinished('LOW_COEF', message.answer);
                        } else {
                            console.log('%cHERE WE BET!!!', 'background: red; color: white; font-weigh: bold;');
                            console.log(self.currentData);
                            self._parent.proceedCommand()['BET']({
                                action: 'BET',
                                data: [this.currentData]
                            }, this.bk);
                        }
                    } else {
                        // HINT: here we finish the cycle
                        if (message.answer.indexOf('SCORE_CHANGED')) {
                            self.loopFinished('SCORE_CHANGED', message.answer);
                        } else if (message.answer.indexOf('LOW_COEF')) {
                            self.loopFinished('LOW_COEF', message.answer);
                        } else {
                            self.loopFinished('FAILED', message.answer);
                        }
                    }
                },
                'BET': (message, bk) => {
                    this.betResults.push(message);
                    let self = this;
                    if (message.data.status === 'ACCEPTED') {
                        delayPromise(self.interval)
                            .then(() => self.rockNroll());
                    } else {
                        this.rockNroll();
                    }
                }
            };
        }

        loopFinished(status, answer) {
            console.log('Loop finished!', this.stakes);
            if (status !== 'GOOD') {
                this.betResults.push({
                    answered: "BET",
                    data: {
                        "external_id": '',
                        "status": status,
                        "market": this.currentData.market,
                        "target": this.currentData.target,
                        "pivot": this.currentData.pivot,
                        "coef": this.currentData.coef,
                        "stake": this.currentData.stake,
                        "maximum": this.currentData.max
                    },
                    answer: answer
                });
            }
            const self = this;
            this.stakes.forEach(val => {
                self.betResults.push({
                    answered: "BET",
                    data: {
                        "external_id": '',
                        "status": status,
                        "market": val.market,
                        "target": val.target,
                        "pivot": val.pivot,
                        "coef": val.coef,
                        "stake": val.stake,
                        "maximum": val.max
                    },
                    answer: answer
                });
            });
            this.betResults.forEach(val => {
                self._parent.common.sendAnswer(self.bk, {
                    action: 'BET_RESULT',
                    data: val.data,
                    answer: val.answer
                });
            });
            this.working = false;
        }
    }

    class Complex {
        /**
         * Multibet prepare
         * @param {MainLoop} parent
         */
        constructor(parent) {
            this.working = false;
            this._parent = parent;
            this.data = false;
            this.marker = false;
            this.stakes = false;
            this.currentData = {};
            this.betResults = [];
            this.interval = false;
            this.bk = '';
        }

        start(data, bk) {
            this.working = true;
            this.data = data;
            this.marker = data[0];
            this.stakes = data.slice(1);
            this.currentData = {};
            this.betResults = [];
            this.interval = typeof this.marker.interval !== 'undefined' ? parseInt(this.marker.interval) * 1000 : 10000;
            this.bk = bk;
            this.marker['doNotOpen'] = true;
            this.marker['doNotGoHome'] = true;
            this.rockNroll();
        }

        rockNroll() {
            this.currentData = this.stakes.shift();
            console.log('COMPLEX, coef for', this.marker);
            console.log('COMPLEX, current is', this.currentData);
            if (this.currentData) {
                this.currentData.coef = '1.2';
                this.currentData.score = '';
                this.currentData.doNotGoHome = true;
                this.currentData.collectAfterAll = true;
                this._parent.proceedCommand()['MAXIMUM']({
                    action: 'MAXIMUM',
                    data: [this.marker]
                }, this.bk);
            } else {
                this.betsFinished('GOOD', 'Everything is OK!');
            }
        }

        betsFinished(status, answer) {
            console.log('Loop finished!', this.stakes);
            if (status !== 'GOOD') {
                this.betResults.push({
                    answered: "BET",
                    data: {
                        "external_id": '',
                        "status": status,
                        "market": this.currentData.market,
                        "target": this.currentData.target,
                        "pivot": this.currentData.pivot,
                        "coef": this.currentData.coef,
                        "stake": this.currentData.stake,
                        "maximum": this.currentData.max
                    },
                    answer: answer
                });
            }
            const self = this;
            this.stakes.forEach(val => {
                self.betResults.push({
                    answered: "BET",
                    data: {
                        "external_id": '',
                        "status": status,
                        "market": val.market,
                        "target": val.target,
                        "pivot": val.pivot,
                        "coef": val.coef,
                        "stake": val.stake,
                        "maximum": val.max
                    },
                    answer: answer
                });
            });
            this._parent.common.openBkAndSendActionWithData({
                action: 'BET_RESULT',
                data: ['limit', this.data.length]
            }, this.bk);
        }

        proceedAnswer() {
            const self = this;
            return {
                'MAXIMUM': (message, bk) => {
                    if (message.status === 'success') {
                        console.log('%cCOMPLEX - WE BET !!!', 'background: red; color: white; font-weigh: bold;');
                        console.log(self.currentData);
                        self._parent.proceedCommand()['BET']({
                            action: 'BET',
                            data: [self.currentData]
                        }, self.bk);
                    } else {
                        // HINT: here we finish the cycle
                        if (message.answer.indexOf('SCORE_CHANGED')) {
                            self.betsFinished('SCORE_CHANGED', message.answer);
                        } else if (message.answer.indexOf('LOW_COEF')) {
                            self.betsFinished('LOW_COEF', message.answer);
                        } else {
                            self.betsFinished('FAILED', message.answer);
                        }
                    }
                },
                'BET': (message, bk) => {
                    self.betResults.push(message);
                    if (message.data.status === 'ACCEPTED') {
                        delayPromise(self.interval)
                            .then(() => self.rockNroll());
                    } else {
                        self.rockNroll();
                    }
                },
                'BET_RESULT': (message, bk) => {
                    console.log('%c' + 'BET_RESULT answer is:', 'background: darkblue; color: cyan; font-size: 12px; font-weight: normal; padding: 1px;');
                    console.log(message);
                    self.betResults.forEach(betResultVal => {
                        if (betResultVal.data.external_id === 'MULTI') {
                            const brItem = betResultVal.data;
                            const found = message.answer.find(answerVal => {
                                if (answerVal.bkPivot !== brItem.bkPivot) {
                                    console.log('%' + self.bk + ': ' + answerVal.bkPivot + ' !== ' + brItem.bkPivot,
                                        'background: red; color: white; font-weight: bold;');
                                    return false;
                                }
                                return parseFloat(answerVal.stake) === parseFloat(brItem.stake)
                                    && parseFloat(answerVal.coef) === parseFloat(brItem.coef)
                                    && answerVal.bkPivot === brItem.bkPivot;
                            });
                            if (found) {
                                betResultVal.data.external_id = found.external_id;
                            }
                        }
                    });
                    self.loopFinished();
                },
            };
        }

        loopFinished() {
            const self = this;
            this.betResults.forEach(val => {
                self._parent.common.sendAnswer(self.bk, {
                    action: 'BET_RESULT',
                    data: val.data,
                    answer: val.answer
                });
            });
            this.working = false;
        }

    }

    class MainLoop extends MainCycle {
        constructor() {
            super();
            this.multibet = new Multibet(this);
            this.complex = new Complex(this);
        }

        proceedCommand() {
            const self = this;
            return {
                'BET': (command, bk) => this.common.openBkAndSendActionWithData(command, bk),
                'EXPRESS_BET': (command, bk) => this.common.openBkAndSendActionWithData(command, bk),
                'READY_TO_BET': (command, bk) => this._arbBet(command, bk),
                'ARB_BET': (command, bk) => this._arbBet(command, bk),
                'MULTI_BET': (command, bk) => {
                    if (['paddy', 'favbet', 'myip'].indexOf(bk) > -1) {
                        console.log('%cMULTI_BET - complex - for ' + bk + ', ' + nowFormatted(self.currentOperationWasSet),
                            'background: red; color: yellow; font-weight: bold;');
                        self.complex.start(command.data, bk);
                    } else if (['marathon'].indexOf(bk) > -1) {
                        this.common.openBkAndSendActionWithData({
                            action: 'MULTI_BET',
                            data: command.data,
                        }, bk);
                    } else {
                        console.log('%cMULTI_BET - standard - for ' + bk + ', ' + nowFormatted(),
                            'background: orange; color: blue; font-weight: bold;');
                        self.multibet.start(command.data, bk);
                    }
                },
                'MAXIMUM': (command, bk) => this.common.openBkAndSendActionWithData(command, bk),
                'openEvent': (command, bk) => {
                    this.common.openBk(bk, false)
                        .then(() => {
                            let data = command.data.shift();
                            self.common.messageToBk(bk, {
                                action: 'open_event',
                                data: data
                            });
                        });
                },
                'MONITOR': (command, bk) => this.common.openBkAndSendActionWithData(command, bk),
                'GET_EVENTS': (command, bk) => this.common.openBkAndSendActionWithData(command, bk),
            };
        }

        proceedAnswer() {
            // TODO: Think about this mechanism
            const self = this;
            //console.log('%c' + 'proceedAnswer: ' + this.multibet.working + ' / ' + this.complex.working,
            //    'background: black; color: yellow; font-size: 15px; font-weight: bold; padding: 5px 20px;');
            if (this.multibet.working) {
                return this.multibet.proceedAnswer();
            } else if (this.complex.working) {
                return this.complex.proceedAnswer();
            } else {
                return {
                    'F_BET': async (message, bk) => {
                        // Check if this is from new parser and send report
                        const isNewParser = message.data && message.data[0] && 
                            (message.data[0]._parser_bet_id || message.data[0].betFromParser === true);
                        
                        if (isNewParser && message.data && message.data[0]) {
                            const betData = message.data[0];
                            // Check if parser URL contains /new/
                            const parserUrl = betData._parser_url || '';
                            if (parserUrl && parserUrl.indexOf('/new/') > -1) {
                                const reportData = {
                                    action: 'BET_RESULT',
                                    result: message.data[0].status === 'ACCEPTED' ? 'SUCCESS' : 'FAILED',
                                    message: message.data[0].status === 'ACCEPTED' ? 'Bet placed successfully' : `Bet not placed: ${message.data[0].status}`,
                                    room: {
                                        bk: this.common.intBkToExternal(bk),
                                        uid: this.common.s.websocket_uid,
                                        state: message.data[0].status === 'ACCEPTED' ? 'ACCEPTED' : 'FAILED',
                                        balance: message?.data?.balance || this.common.bkBalances[bk] || '0'
                                    },
                                    data: {
                                        status: message.data[0].status || 'FAILED',
                                        bet_id: betData._parser_bet_id || '',
                                        parser_url: parserUrl,
                                        external_id: message.data[0].external_id || '',
                                        market: message.data[0].market || '',
                                        target: message.data[0].target || '',
                                        pivot: message.data[0].pivot || '',
                                        coef: message.data[0].coef || '',
                                        stake: message.data[0].stake || '',
                                        maximum: message.data[0].maximum || '0'
                                    },
                                    original_command: 'BET',
                                    betFromParser: true,
                                    parser_bet_id: betData._parser_bet_id || '',
                                    parser_url: parserUrl,
                                    client_id: betData._parser_client_id || this.common.s.websocket_uid,
                                    timestamp: Date.now()
                                };
                                
                                // Send report to Reports API
                                await this.common._sendParserReport(reportData);
                            }
                        }
                        
                        this.common.sendAnswer(bk, {
                            action: 'F_BET',
                            data: message.data,
                            answer: message.answer,
                            balance: message?.data?.balance,
                            doNotSend: !!message.doNotSend,
                        });
                    },
                    'FORK_BET': (message, bk) => {
                        this.common.sendAnswer(bk, {
                            action: 'FORK_BET',
                            data: message.data,
                            answer: message.answer,
                            balance: message?.data?.balance,
                            doNotSend: !!message.doNotSend,
                        });
                    },
                    'BET': (message, bk) => {
                        this.common.sendAnswer(bk, {
                            action: 'BET_RESULT',
                            data: message.data,
                            answer: message.answer,
                            balance: message?.data?.balance,
                            doNotSend: !!message.doNotSend,
                        });
                    },
                    'EXPRESS_BET': (message, bk) => {
                        this.common.sendAnswer(bk, {
                            action: 'BET_RESULT',
                            data: message.data,
                            answer: message.answer,
                            balance: message?.data?.balance,
                            doNotSend: !!message.doNotSend,
                        });
                    },
                    'MAXIMUM': (message, bk) => {
                        this.common.sendAnswer(bk, {
                            action: 'MAXIMUM',
                            data: {
                                maximum: message.answer
                            }
                        });
                    },
                    'open_event': (message, bk) => {
                        this.common.sendAnswer(bk, {
                            action: 'open_event',
                            data: message
                        });
                    },
                    'MULTI_BET': (message, bk) => {
                        console.log(message);
                        if (['marathon'].indexOf(bk) > -1) {
                            message.data.forEach(val => self.common.sendAnswer(bk, val));
                        }
                    },
                    'MONITOR': (message, bk) => {
                        if (!message.data || message.data.status !== 'DATA') {
                            this.common.sendAnswer(bk, {
                                action: 'MONITOR',
                                data: message
                            });
                        } else {
                            console.log('%c' + 'MONITOR: %O', 'background: lightblue; color: black; font-size: 12px; font-weight: normal; padding: 1px;', message);
                        }
                    },
                    'GET_EVENTS': (message, bk) => {
                        this.common.sendAnswer(bk, {
                            action: 'GET_EVENTS',
                            data: message
                        });
                    },
                };
            }
        }

    }

    const mainLoop = new MainLoop();

})();
