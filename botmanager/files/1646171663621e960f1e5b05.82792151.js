(() => {
    'use strict';

    class ForkLoop extends MainCycle {
        constructor() {
            super();
            this.forkCycle = true;
            this.settings = {
                maxOutdatedIn: 40000
            };
            this.error = '';
            this.betResults = [];
            this.command = {};
            this.maxesReached = {};
            this.fork = {};
            this.firstShBk = '';
            this.secondShBk = '';
            this.internalFork = false;
            this.stake = 0;
            this.euro_rub = 0;
            this.euro_btc = 0;
            this.lastMonitorCheck = 0;
            this.commandStopped = false;
            this.stoppedOrChecked = [];
            this.loadMaxesReached();
            this.common.showDebug = true;
            this.common.enableLogging = true;
            this.activeBk = '';
            this.bkRotate = [];
            this.monitor = {};
            this.monitorForks = [];
            this.monitorStarted = 0;
            this.monitorRestarting = false;
            //this._runScanners();
            //this.common.s.own_ws_bks.push('bet365');
            this.common.logger('textLogger', {data: `Logic forks starting... `});
        }

        /**
         * Activate or stop tabsActivator (set tabs active in loop)
         * @param {boolean} [isStart] - if true - start, default - false
         * @param {number} [interval] - default from settings
         */
        tabsActivator(isStart, interval) {
            this.common.logger('textLogger', {
                data: `tabsActivator (${isStart}/${this.bkRotate.join(', ')}): ${(new Error).stack}`
                    .replace('\n', ' ').replace(/\s+/g, ' ').trim()
            });
            if (this.common.intervals['tabsActivatorInterval'] && this.common.intervals['tabsActivatorInterval'] > 0) {
                clearInterval(this.common.intervals['tabsActivatorInterval']);
                this.common.intervals['tabsActivatorInterval'] = null;
            }
            if (isStart) {
                const self = this;
                this.common.intervals['tabsActivatorInterval'] = setInterval(() => {
                    if (self.commandStopped) {
                        return;
                    }
                    if (self.monitorStarted > 0 && Date.now() - self.lastMonitorCheck > 70000) {
                        self.report(false,
                            `tabsActivator timeout check: ${(Date.now() - self.monitorStarted)} / ${(Date.now() - self.lastMonitorCheck)}`);
                        return;
                    }
                    //const newActive = Object.keys(this.fork).filter(k => k !== self.activeBk);
                    const newActive = self.bkRotate.filter(k => k !== self.activeBk);
                    self.common.openBk(newActive[0], false)
                    //.then(() => console.log('%c' + `${self.activeBk} / ${newActive[0]}`,
                    //    'background: gray; color: white; padding: 0px 100px; margin-left: 100px;'))
                        .then(() => self.activeBk = newActive[0]);
                }, interval ? interval : this.common.s.forks_reload_interval);
            }
        }

        prepareMonitor(command) {
            // TODO: Checks
            //if (command.data.length !== 2) {
            //    self.report(false, 'Wrong data!');
            //    return;
            //}
            this.internalFork = false;
            const self = this;
            this.monitorStarted = Date.now();
            this.bkRotate = [];
            this.monitor = {};
            this.monitorForks = [];
            // Checks
            this.stake = parseFloat(command.data[0].stake);
            if (isNaN(this.stake) || this.stake < 1) {
                this.report(false, 'Wrong stake: ' + this.stake + '!');
                return false;
            }
            this.euro_rub = parseFloat(command.data[0].euro_rub);
            this.euro_btc = parseFloat(command.data[0].euro_btc);
            console.log('%c' + 'prepareMonitor: ' + [this.stake, this.euro_rub, this.euro_btc].join(' / '),
                'background: #8BC000; color: #4504C0; font-size: 12px; font-weight: normal; padding: 1px 10px;');
            if (isNaN(this.euro_rub) || isNaN(this.euro_btc) || this.euro_rub <= 0 || this.euro_btc <= 0) {
                this.report(false, 'Bad EURO prices: ' + this.euro_rub + ' / ' + this.euro_btc);
                return false;
            }
            // Finish checks
            if (!command.data.every(d => d.bk && d.bk !== '' && self.common.extBkToInternal(d.bk) && self.common.extBkToInternal(d.bk) !== '')) {
                this.report(false, 'Something wrong with BKs!');
                return false;
            }
            //
            this.commandStopped = false;
            this.notAllMonitor = 0;
            command.data.forEach(d => {
                const iBk = self.common.extBkToInternal(d.bk);
                self.common.openBkAndSendActionWithData({
                    action: 'MONITOR',
                    data: [d]
                }, iBk);
                self.bkRotate.push(iBk);
                self.activeBk = iBk;
            });
            // Hint: we provide additional 2 minutes for initial open, etc
            this.lastMonitorCheck = Date.now() + 120000;
            waitForCondition(() => self.bkRotate.length > 1, 333, 60000, '')
                .then(() => self.tabsActivator(true));
        }

        prepareFork(command) {
            console.log('%c' + 'prepareFork %O', 'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;', command);
            this.monitorStarted = 0;
            this.betResults = [];
            this.fork = {};
            this.command = JSON.parse(JSON.stringify(command));
            if (command.data.length !== 2) {
                this.report(false, 'Insufficient data length ' + command.data.length + ' instead of 2!');
                return false;
            }
            const order = command.bk === command.data[0].bk ? [0, 1] : command.bk === command.data[1].bk ? [1, 0] : [];
            if (order.length !== 2) {
                this.report(false, 'Strange data!');
                return false;
            }
            this.firstShBk = this.common.extBkToInternal(command.data[order[0]].bk);
            this.secondShBk = this.common.extBkToInternal(command.data[order[1]].bk);
            if (this.common.s.active_bks.indexOf(this.firstShBk) === -1 || this.common.s.active_bks.indexOf(this.secondShBk) === -1) {
                this.report(false, `Shoulders bookies (${this.firstShBk}/${this.secondShBk}) not in active list: ${this.common.s.active_bks.join(', ')}`);
                return false;
            }
            if (this.firstShBk === this.secondShBk) {
                this.report(false, 'Fork\'s shoulders\'re same!');
                return false;
            }
            [this.firstShBk, this.secondShBk].forEach((bk, idx) => {
                this.fork[bk] = command.data[order[idx]];
                this.fork[bk].fork = true;
                this.fork[bk].finished = false;
                this.fork[bk].succeed = false;
                this.fork[bk].betResultProcessed = false;
                this.fork[bk].collected = 0;
            });
            this.stake = parseFloat(this.fork[this.firstShBk].stake);
            if (isNaN(this.stake) || this.stake < 1) {
                this.report(false, 'Wrong stake: ' + this.stake + '!');
                return false;
            }
            this.euro_rub = parseFloat(command.data[order[0]].euro_rub);
            this.euro_btc = parseFloat(command.data[order[0]].euro_btc);
            if (isNaN(this.euro_rub) || isNaN(this.euro_btc) || this.euro_rub <= 0 || this.euro_btc <= 0) {
                this.report(false, 'Bad EURO prices: ' + this.euro_rub + ' / ' + this.euro_btc);
                return false;
            }
            this.commandStopped = false;
            this.bkRotate = [this.firstShBk, this.secondShBk];
            console.log('%c' + 'prepareFork: ' + [this.stake, this.euro_rub, this.euro_btc].join(' / '),
                'background: #8BC000; color: #4504C0; font-size: 12px; font-weight: normal; padding: 1px 10px;');
            return true;
        }

        monitorCheck() {
            if (!this.common.intervals['tabsActivatorInterval']) {
                this.tabsActivator(true);
            }
            if (Object.keys(this.monitor).length !== 2) {
                console.log('Not all results...');
                return;
            }
            this.lastMonitorCheck = Date.now();
            const self = this;
            const getOddByPath = (bk, path) => {
                const parts = path.split('/');
                let node = self.monitor[bk]['FULL_TIME'];
                parts.forEach(part => node = node[part] || {});
                return typeof node === 'number' ? node : 1;
            };
            const fTable = [
                {shoulder1: 'ONE_TWO/ONE', shoulder2: 'ONE_TWO/TWO_DRAW', type: 1},
                {shoulder1: 'ONE_TWO/TWO', shoulder2: 'ONE_TWO/ONE_DRAW', type: 1},
                {shoulder1: 'ONE_TWO/DRAW', shoulder2: 'ONE_TWO/ONE_TWO', type: 1},
                {shoulder1: 'ONE_TWO/ONE_DRAW', shoulder2: 'ONE_TWO/TWO', type: 1},
                {shoulder1: 'ONE_TWO/TWO_DRAW', shoulder2: 'ONE_TWO/ONE', type: 1},
                {shoulder1: 'ONE_TWO/ONE_TWO', shoulder2: 'ONE_TWO/DRAW', type: 1},
                //
                {shoulder1: 'ONE_TWO/ONE_DRAW', shoulder2: 'HDP/AWAY/0.5', type: 1},
                {shoulder1: 'HDP/HOME/-0.5', shoulder2: 'ONE_TWO/TWO_DRAW', type: 1},
                //
                {shoulder1: 'TOTAL/OVER', shoulder2: 'TOTAL/UNDER', type: 2},
                {shoulder1: 'TOTAL/UNDER', shoulder2: 'TOTAL/OVER', type: 2},
                {shoulder1: 'T1_TOTAL/OVER', shoulder2: 'T1_TOTAL/UNDER', type: 2},
                {shoulder1: 'T1_TOTAL/UNDER', shoulder2: 'T1_TOTAL/OVER', type: 2},
                {shoulder1: 'T2_TOTAL/OVER', shoulder2: 'T2_TOTAL/UNDER', type: 2},
                {shoulder1: 'T2_TOTAL/UNDER', shoulder2: 'T2_TOTAL/OVER', type: 2},
                //
                {shoulder1: 'HDP/HOME', shoulder2: 'HDP/AWAY', type: 2},
                {shoulder1: 'HDP/AWAY', shoulder2: 'HDP/HOME', type: 2}
            ];
            this.monitorForks = [];
            this.bkRotate.forEach(shoulder1 => {
                const shoulder2 = this.bkRotate.filter(t => t !== shoulder1)[0];
                const checkOne = (path1, path2) => {
                    const odd1 = getOddByPath(shoulder1, path1), odd2 = getOddByPath(shoulder2, path2);
                    const l = 1 / odd1 + 1 / odd2;
                    if (l < 0.985) {
                        const fork = {l: l, one: shoulder1, two: shoulder2, path1: path1, path2: path2, odd1: odd1, odd2: odd2};
                        self.monitorForks.push(fork);
                        console.log('%c' + `FORK: %O`,
                            'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;',
                            JSON.parse(JSON.stringify(fork)));
                        self.common.logger('forkLogger', {data: JSON.stringify(fork)});
                    }
                };
                const getNode = fk => {
                    const parts = fk.shoulder1.split('/');
                    try {
                        const n = parts.length === 2 ? self.monitor[shoulder1]['FULL_TIME'][parts[0]][parts[1]] : false;
                        return n && typeof n === 'object' ? n : {};
                    } catch (e) {
                        return {};
                    }
                };
                fTable.forEach(fk => fk.type === 1
                    ? checkOne(fk.shoulder1, fk.shoulder2)
                    : Object.keys(getNode(fk))
                        .forEach(pivot => checkOne(fk.shoulder1 + `/${pivot}`, fk.shoulder2 + `/${pivot}`))
                );
            });
            /*
            // WARNING! REMOVE THIS AFTER TEST
            if (Math.random() < 0.5) {
                self.monitorForks.push({
                    l: 0.9,
                    one: 'bet365',
                    two: 'fon',
                    path1: 'ONE_TWO/ONE',
                    path2: 'ONE_TWO/TWO_DRAW',
                    odd1: 3,
                    odd2: 4
                });
            }
            // WARNING!
            */
            // Hint: if we found fork
            if (!this.commandStopped && this.monitorForks.length > 0) {
                this.forkFromMonitor();
            } else if (Date.now() - this.monitorStarted > 900000) {
                this.stopTheMonitor('');
                this.report(false, `Monitor stopped by timeout ${(Date.now() - this.monitorStarted)}`, this.common.command.currentCommand);
            }
        }

        forkFromMonitor() {
            // 0. Get max fork
            // 1. Stop the monitor
            // 2. Proceed fork
            // 3. Check result
            // 4. If success - leave match, else continue monitor
            // Hint: we need this to do not restart monitor!
            this.stoppedOrChecked = [];
            this.stopTheMonitor('');
            // Hint: wait for monitor stops
            const self = this;
            waitForCondition(() => self.stoppedOrChecked.length === 2, 333, 20000, 'Not stopped :(')
                .then(() => {
                    let smallest = 1, smallestIdx = -1;
                    self.monitorForks.forEach((f, idx) => f.l < smallest ? (smallest = f.l, smallestIdx = idx) : 1);
                    if (smallestIdx > -1) {
                        self.doFork(JSON.parse(JSON.stringify(self.monitorForks[smallestIdx])));
                    } else {
                        console.log('%c' + `There is no smallest (${smallestIdx}) in %O!`,
                            'background: red; color: white; font-size: 14px; font-weight: bold; padding: 10px;',
                            JSON.parse(JSON.stringify(self.monitorForks)));
                        self.common.logger('textLogger', {data: `monitorCheck (no smallest): ` + JSON.stringify(self.monitorForks)});
                    }
                })
                .catch(e => {
                    self.commandStopped = false;
                    self.common.logger('textLogger', {data: `ERROR in forkFromMonitor: ${e}`});
                    self.report(false, `ERROR in forkFromMonitor: ${e}`);
                });
        }

        calcFork() {
            // If all results collected in last 60 seconds
            // Fixme: make mechanism for renew outdated max results
            //console.log(this.fork);
            if (Object.keys(this.fork)
                .every(v => !this.fork[v].finished && Date.now() - this.fork[v].collected <= this.settings.maxOutdatedIn)) {
                console.log('%c' + 'calcFork # O-N-E', 'background: #EE120D; color: #6DE1EE; font-size: 12px; font-weight: bold; padding: 10px 50px;');
                // Hint: FIRST ATTEMPT - relevant data
                const l = 1 / this.fork[this.firstShBk].coef + 1 / this.fork[this.secondShBk].coef;
                let message, pretty = false;
                if (l < 1) {
                    this.calcShoulders(l);
                    const sumOfStakesEur = this.fork[this.firstShBk].stakeEur + this.fork[this.secondShBk].stakeEur;
                    const profit1eur = this.fork[this.firstShBk].stakeEur * this.fork[this.firstShBk].coef - sumOfStakesEur;
                    const profit2eur = this.fork[this.secondShBk].stakeEur * this.fork[this.secondShBk].coef - sumOfStakesEur;
                    if (profit1eur <= 0 || profit2eur <= 0) {
                        message = `Fork is not profitable: ${l}\n` + this.printFork(sumOfStakesEur, profit1eur, profit2eur);
                        this.report(false, message);
                    } else {
                        message = 'Fork is beautiful, let\'s bet!\n' + this.printFork(sumOfStakesEur, profit1eur, profit2eur);
                        this.betFork(false);
                        pretty = true;
                    }
                } else {
                    message = 'There is no fork: ' + l;
                    this.report(false, message);
                }
                console.log('%c' + 'calcFork: ' + message,
                    (pretty ? 'background: #8BC000; color: #4504C0;' : 'background: #C00016; color: #08C097;') +
                    ' font-size: 12px; font-weight: normal; padding: 1px 10px;');
            } else if (Object.keys(this.fork).every(v => !this.fork[v].finished && this.fork[v].collected > 0)) {
                console.log('%c' + 'calcFork # T-W-O', 'background: #EE120D; color: #6DE1EE; font-size: 12px; font-weight: bold; padding: 10px 50px;');
                // Hint: FIRST ATTEMPT - outdated
                this.report(false, 'Outdated maxes! '
                    + (Date.now() - this.fork[Object.keys(this.fork)[0]].collected) + (Date.now() - this.fork[Object.keys(this.fork)[1]].collected));
            } else if (Object.keys(this.fork).every(v => this.fork[v].finished)) {
                console.log('%c' + 'calcFork # D-O-N-E', 'background: #EE120D; color: #6DE1EE; font-size: 12px; font-weight: bold; padding: 10px 50px;');
                // Hint: here the fork is done!
                console.log('%c' + 'Fork is done - what\'ve we forget here?', 'background: red; color: blue; font-size: 14px; font-weight: bold; padding: 5px 25px;');
            } else if (Object.keys(this.fork).some(v => this.fork[v].finished)) {
                console.log('%c' + 'calcFork # O-V-E-R-L-A-P', 'background: #EE120D; color: #6DE1EE; font-size: 12px; font-weight: bold; padding: 10px 50px;');
                // Hint: OVERLAP here
                this.calcOverlap();
            } else {
                console.log('%c' + 'calcFork # NOTHING', 'color: lightgray; font-size: 12px; font-weight: bold; padding: 0px 50px;');
            }
        }

        calcOverlap() {
            const goodBk = Object.keys(this.fork).find(bk => this.fork[bk].finished);
            const overlapBk = Object.keys(this.fork).find(bk => !this.fork[bk].finished);
            const l = 1 / this.fork[goodBk].coef + 1 / this.fork[overlapBk].coef;
            let message = '', pretty = false;
            if (l > 1) {
                // Hint: Next iteration of get max
                message = `No fork (${l}) for ${this.fork[overlapBk].coef} (already got ${this.fork[goodBk].coef}) :(`;
                this.getMaxOverlap(overlapBk);
            } else {
                // Hint: Just calculate and bet fork
                //console.log(JSON.parse(JSON.stringify(this.fork)));
                this.calcAndCheckShoulder(l, overlapBk, goodBk);
                pretty = true;
                message = `Try to OVERLAP (${overlapBk}) with ${this.fork[overlapBk].coef} * ${this.fork[overlapBk].stakeBk} ${this.fork[overlapBk].currency}`;
                this.betFork(true);
            }
            console.log('%c' + 'calcOverlap: ' + message,
                (pretty ? 'background: #8BC000; color: #4504C0;' : 'background: #C00016; color: #08C097;') +
                ' font-size: 12px; font-weight: normal; padding: 1px 10px;');
        }

        betFork(isOverlap) {
            if (this.commandStopped) {
                return;
            }
            const self = this;
            Object.keys(this.fork).forEach(bk => {
                if (!self.fork[bk].finished) {
                    const d = {};
                    ['sport', 'time_value', 'league', 'team1', 'team2', 'market', 'target', 'pivot', 'coef', 'score']
                        .forEach(key => d[key] = self.fork[bk][key]);
                    d.bk = bk;
                    d.stake = self.fork[bk].stakeBk;
                    d.overlap = isOverlap;
                    if (isOverlap) {
                        // Hint: calc minimum possible coef
                        const goodBk = Object.keys(this.fork).find(bk => this.fork[bk].finished);
                        d.coef = floorToPrecision(1 / (1 - 1 / this.fork[goodBk].coef), 2);
                    }
                    self.fork[bk].betResultProcessed = false;
                    self.common.openBkAndSendActionWithData({
                        action: 'BET',
                        data: [d]
                    }, bk);
                }
            });
        }

        requestMaxIfWeNeed(bk) {
            const self = this;
            if (Object.keys(this.fork).every(v => this.fork[v].betResultProcessed)
                && !Object.keys(this.fork).some(v => this.fork[v].succeed)) {
                // If all bets results processed and no successful forks
                //this.betResults.push(betData);
                this.fork[bk].finished = true;
                console.log(JSON.parse(JSON.stringify(this.fork)));
                this.report(false, 'Unsuccessful fork :(');
            } else {
                waitForCondition(() => {
                    return Object.keys(self.fork).every(v => self.fork[v].betResultProcessed);
                }, 333, 60000, 'Not Bet result of other shoulder :(')
                    .then(() => {
                        if (Object.keys(self.fork).some(v => self.fork[v].succeed)) {
                            self.getMaxOverlap(bk);
                        } else {
                            console.log(JSON.parse(JSON.stringify(self.fork)));
                            self.report(false, 'We bet nothing :(');
                        }
                    })
                    .catch(e => this.report(false, 'betCheck: ' + e));
            }
        }

        betCheck(betData) {
            //console.log('%c' + 'betCheck ' + betData.bk,
            //    'background: yellow; color: darkblue; font-size: 13px; font-weight: bold; padding: 5px 30px;');
            //console.log(betData);
            if (betData.data && betData.data.status === 'LOW_COEF') {
                // Hint: we'll try to place again this shoulder
                this.fork[betData.bk].betResultProcessed = true;
                this.requestMaxIfWeNeed(betData.bk);
            } else {
                this.betResults.push(betData);
                this.fork[betData.bk].finished = true;
                this.fork[betData.bk].stake = betData.data.stake;
                this.fork[betData.bk].coef = betData.data.coef;
                this.fork[betData.bk].succeed = betData.data.status === 'ACCEPTED';
                this.fork[betData.bk].betResultProcessed = true;
                if (betData.data.status !== 'ACCEPTED') {
                    this.common.messageToBk(betData.bk, {
                        action: 'takeScreenshot',
                        data: {
                            name: betData.data.status + ' at ' + (new Date).toLocaleString(),
                            tag: betData.bk,
                            description: betData.answer + ' for ' + JSON.stringify(this.fork[betData.bk])
                        },
                    });
                }
                if (Object.keys(this.fork).every(v => this.fork[v].finished)) {
                    this.report(true, 'Fork finished!');
                }
            }
        }

        getMaxOverlap(bk) {
            if (this.commandStopped) {
                return;
            }
            // Fixme: place max wait time here!
            console.log('%c' + 'betCheck - OVERLAP in ' + bk,
                'background: yellow; color: darkblue; font-size: 13px; font-weight: bold; padding: 5px 30px;');
            const d = JSON.parse(JSON.stringify(this.fork[bk]));
            d.coef = '';
            this.common.openBkAndSendActionWithData({
                action: 'MAXIMUM',
                data: [d]
            }, bk);
        }

        calcShoulders(l) {
            // Hint: if direct calculation - do nothing, if not - recalculate other shoulder
            if (this.calcAndCheckShoulder(l, this.firstShBk)) {
                if (!this.calcAndCheckShoulder(l, this.secondShBk)) {
                    this.calcAndCheckShoulder(l, this.firstShBk, this.secondShBk);
                }
            } else {
                if (!this.calcAndCheckShoulder(l, this.secondShBk, this.firstShBk)) {
                    this.calcAndCheckShoulder(l, this.firstShBk, this.secondShBk);
                }
            }
        }

        /**
         * Calculate shoulder stake and check it fits max and balance
         * @param {number} l - fork coefficient
         * @param {string} bk - bk of calculating shoulder
         * @param {string} [overBk] - if present we must calculate stake from stake of this bk
         * @returns {boolean} - true if shoulder fits max and balance, otherwise - no
         */
        calcAndCheckShoulder(l, bk, overBk) {
            const stakeEur = overBk
                ? (this.fork[overBk].stakeEur * this.fork[overBk].coef) / this.fork[bk].coef
                : this.stake / (l * this.fork[bk].coef);
            const stakeBk = this.convertAndRound(stakeEur, bk);
            console.log(`calcAndCheckShoulder: ${l}, ${bk}, ${overBk}: ${stakeEur} = ${stakeBk}`);
            let finalStakeBk = stakeBk;
            if (finalStakeBk > this.fork[bk].balance) {
                finalStakeBk = this.fork[bk].balance;
            }
            if (finalStakeBk > this.fork[bk].max) {
                finalStakeBk = this.fork[bk].max;
                this.renewMax(bk, true);
            } else {
                this.renewMax(bk, false);
            }
            this.fork[bk].stakeBk = finalStakeBk;
            this.fork[bk].stakeEur = this.convertToEur(finalStakeBk, bk);
            return finalStakeBk === stakeBk;
        }

        printFork(sumOfStakesEur, profit1eur, profit2eur) {
            let r;
            try {
                r = `${this.fork[this.firstShBk].stakeBk} * ${this.fork[this.firstShBk].coef} = `
                    + (this.fork[this.firstShBk].stakeBk * this.fork[this.firstShBk].coef)
                    + ' pr.: ' + this.convertAndRound(profit1eur, this.firstShBk) + ' ' + this.fork[this.firstShBk].currency + '\n'
                    + `${this.fork[this.secondShBk].stakeBk} * ${this.fork[this.secondShBk].coef} = `
                    + (this.fork[this.secondShBk].stakeBk * this.fork[this.secondShBk].coef)
                    + ' pr.: ' + this.convertAndRound(profit2eur, this.secondShBk) + ' ' + this.fork[this.secondShBk].currency + '\n'
                    + `EUR: ${this.fork[this.firstShBk].stakeEur.toFixed(2)} + ${this.fork[this.secondShBk].stakeEur.toFixed(2)}`
                    + ` = ${sumOfStakesEur.toFixed(2)} profit: ${profit1eur.toFixed(2)} || ${profit2eur.toFixed(2)}`;
            } catch (e) {
                r = `(${sumOfStakesEur} / ${profit1eur} / ${profit2eur}): ${e}`;
            }
            return r;
        }

        renewMax(bk, isReached) {
            this.maxesReached[bk] = isReached
                ? this.maxesReached[bk] + 1
                : (this.maxesReached[bk] > 2 ? this.maxesReached[bk] + 1 : 0);
            chrome.storage.local.set({'FORK_MAXES_REACHED': this.maxesReached});
        }

        loadMaxesReached() {
            const self = this;
            chrome.storage.local.get(['FORK_MAXES_REACHED'], r => {
                self.maxesReached = r.FORK_MAXES_REACHED ? r.FORK_MAXES_REACHED : {};
                console.log('Maxes: ', self.maxesReached);
            });
        }

        convertAndRound(value, bk) {
            if (this.fork[bk].currency === 'EUR') {
                return floorToPrecision(value, 1);
            } else if (this.fork[bk].currency === 'RUB') {
                return roundTo(value * this.euro_rub, 10);
            } else if (this.fork[bk].currency === 'BTC') {
                return floorToPrecision(value * this.euro_btc, 3);
            } else {
                return 0;
            }
        }

        convertToEur(value, bk) {
            if (this.fork[bk].currency === 'EUR') {
                return value;
            } else if (this.fork[bk].currency === 'RUB') {
                return value / this.euro_rub;
            } else if (this.fork[bk].currency === 'BTC') {
                return value / this.euro_btc;
            } else {
                console.log('%c' + bk + ' has unknown currency! ' + this.fork[bk].currency,
                    'background: red; color: yellow; font-size: 20px; font-weight: bold; padding: 30px 100px;');
                return 0;
            }
        }

        restartMonitor() {
            if (this.monitorRestarting) {
                return;
            }
            this.monitorRestarting = true;
            const self = this;
            this.stoppedOrChecked = [];
            const sendCheck = exceptBk => self.bkRotate
                .forEach(b => b !== exceptBk ? self.common.messageToBk(b, {action: 'CHECK_BUSY'}) : 1);
            waitForCondition(() => self.stoppedOrChecked.length === 2 ? true : (sendCheck(), false),
                1000, 60000, 'Still busy :(')
                .then(delayFunction(3333))
                .then(() => {
                    console.log('%c' + `Restarting monitor!`, 'background: #C01E72; color: #40C024; font-size: 14px; font-weight: bold; padding: 1px 30px;');
                    self.common.logger('textLogger', {data: `Restarting monitor!`});
                    self.prepareMonitor(JSON.parse(JSON.stringify(self.common.command.currentCommand)));
                    this.monitorRestarting = false;
                })
                .catch(e => {
                    self.commandStopped = false;
                    self.internalFork = false;
                    self.report(false, `restartMonitor: ${e}`);
                    this.monitorRestarting = false;
                });
        }

        report(success, message, monitor) {
            if (this.commandStopped) {
                return;
            }
            if (this.internalFork && !success) {
                console.log('%c' + `Need to restart monitor! M: ${message}`, 'background: #C01E72; color: #40C024; font-size: 14px; font-weight: bold; padding: 1px 30px;');
                this.common.logger('textLogger', {data: `report: Need to restart monitor! (${message}): `});
                this.restartMonitor();
                return;
            }
            this.commandStopped = true;
            const self = this;
            self.tabsActivator();
            // Add all unsuccessful bets to result
            console.log('%c' + `report (${success}/${monitor}): ${message}`, 'background: #C01E72; color: #40C024; font-size: 14px; font-weight: bold; padding: 1px 30px;');
            if (this.command.data && this.betResults.length !== this.command.data.length) {
                this.command.data.forEach(commandRow => {
                    const res = self.betResults.find(resultsRow => self.common.extBkToInternal(commandRow.bk) === resultsRow.bk);
                    if (!res) {
                        const temp = JSON.parse(JSON.stringify(commandRow));
                        temp.bk = self.common.extBkToInternal(temp.bk);
                        temp.data = commandRow;
                        temp.data.status = 'FAILED';
                        temp.answer = message;
                        self.betResults.push(temp);
                    }
                });
            }
            // Send result and set extension to free
            if (this.command.data) {
                this.betResults.forEach((val, idx) => {
                    self.common.sendAnswer(val.bk, {
                        action: 'BET_RESULT',
                        data: val.data,
                        answer: val.answer + (self.maxesReached[val.bk] && self.maxesReached[val.bk] > 2 ? ' Maximum reached!' : '')
                    }, idx === self.betResults.length - 1);
                });
            } else {
                const res = JSON.parse(JSON.stringify(this.common.command.currentCommand));
                if (typeof res.data === 'object' && Array.isArray(res.data)) {
                    res.data.forEach(c => c.status = monitor && monitor.data && monitor.data.status ? monitor.data.status : 'FAILED');
                } else if (typeof res.data === 'object') {
                    res.data.status = monitor && monitor.data && monitor.data.status ? monitor.data.status : 'FAILED';
                }
                self.common.sendAnswer(res.bk, {
                    action: res.action,
                    data: res.data,
                    answer: message
                });
            }
        }

        stopTheMonitor(exceptBk) {
            if (!this.commandStopped) {
                const self = this;
                this.bkRotate.forEach(b => b !== exceptBk ? self.common.messageToBk(b, {action: 'NEED_STOP'}) : 1);
            }
        }

        proceedAnswer() {
            const self = this;
            return {
                'CHECK_BUSY': (message, bk) => {
                    console.log('%c' + `CHECK_BUSY: ${bk} = ${message.answer}`, 'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    if (message.answer === 'FREE' && self.stoppedOrChecked.indexOf(bk) === -1) {
                        self.stoppedOrChecked.push(bk);
                    }
                },
                'BET': (message, bk) => {
                    console.log('%c' + ' -= ' + bk + ' : BET =-',
                        'background: #8BC000; color: #4504C0; font-size: 12px; font-weight: normal; padding: 1px 10px;');
                    message.bk = bk;
                    console.log(message);
                    self.betCheck(message);
                },
                'MAXIMUM': (message, bk) => {
                    // Fixme: Maxes also could be with LOW_COEF, etc...
                    const m = message.answer;
                    console.log(m);
                    // Hint: possible maxes answers: number, string or object
                    if (typeof m === 'string') {
                        self.common.messageToBk(bk, {
                            action: 'takeScreenshot',
                            data: {
                                name: `MAXIMUM error ${bk} at ${(new Date).toLocaleString()}`,
                                tag: bk,
                                description: m + ' for ' + JSON.stringify(this.fork[bk])
                            },
                        });
                        self.report(false, `We can't get max (${bk}): ${m}`);
                    } else if (typeof m === 'object' && m.coef && m.max && m.balance && m.currency) {
                        console.log('%c' + ` -= '${bk} =- Coef: ${m.coef}, max: ${m.max}, balance: ${m.balance} ${m.currency}`,
                            'background: #8BC000; color: #4504C0; font-size: 12px; font-weight: normal; padding: 1px 10px;');
                        Object.assign(self.fork[bk], m);
                        self.fork[bk].collected = Date.now();
                        self.calcFork();
                    } else {
                        self.report(false, `It looks like ${bk} not supported forks: "${m}"!`);
                    }
                },
                'MONITOR': (message, bk) => {
                    //console.log(bk, message);
                    if (!message.data) {
                        console.log('%c' + `DAMN message (${bk}): %O`, 'background: red; color: yellow; font-size: 16x; font-weight: normal; padding: 1px;', message);
                        this.common.logger('textLogger', {data: `MONITOR (${bk}): DAMN! ` + JSON.stringify(message)});
                    } else if (message.data.status !== 'DATA') {
                        if (typeof message.answer === 'string' && message.answer.indexOf('NEED_STOP') > -1) {
                            if (self.stoppedOrChecked.indexOf(bk) === -1) {
                                self.stoppedOrChecked.push(bk);
                            } else {
                                console.log('%c' + `${bk} already in stoppedByNeedStop!!!`,
                                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                                self.common.logger('textLogger', {data: `${bk} already in stoppedByNeedStop!!!`});
                            }
                            console.log('%c' + `${bk} NEED_STOP report!`,
                                'background: yellow; color: blue; font-size: 12px; font-weight: normal; padding: 1px;');
                        } else {
                            self.stopTheMonitor(bk);
                            self.report(false, `MONITOR ${bk} - ${message.data.status}: ${message.answer}!`, message);
                        }
                    } else {
                        const checkStarted = Date.now();
                        self.monitor[bk] = JSON.parse(JSON.stringify(message.answer));
                        console.log(JSON.parse(JSON.stringify(self.monitor)));
                        self.monitorCheck();
                        console.log('%c' + `${bk}: scan = ${message.data.profiling} s / check = ${(Date.now() - checkStarted)} ms`,
                            'background: lightyellow; color: black; font-size: 12px; font-weight: normal; padding: 1px;');
                        if (self.monitorForks.length > 0) {
                            console.log('%c' + JSON.stringify(self.monitorForks),
                                'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                        }
                    }
                },
                'takeScreenshot': (message, bk) => {
                    console.log('%c' + `Screenshot (${bk}): ${message.status} / ${message.answer}`,
                        'background: yellow; color: black; padding: 1px 10px;');
                }
            };
        }

        // {l: l, one: shoulder1, two: shoulder2, path1: path1, path2: path2, odd1: odd1, odd2: odd2}
        doFork(fork, serverSide) {
            const self = this;
            let command;
            if (!serverSide) {
                command = {action: 'FORK', bk: self.common.intBkToExternal(fork.one), data: []};
                ['1', '2'].forEach(sh => {
                    const bk = self.common.intBkToExternal(sh === '1' ? fork.one : fork.two);
                    const data = JSON.parse(JSON.stringify(self.common.command.currentCommand.data.find(v => v.bk === bk)));
                    const path = fork['path' + sh].split('/');
                    data.market = path[0], data.target = path[1], data.pivot = path[2], data.coef = fork['odd' + sh];
                    command.data.push(data);
                });
                this.internalFork = true;
            } else {
                command = fork;
                this.internalFork = false;
            }
            this.common.logger('textLogger', {data: `doFork (${(this.internalFork ? 'LOCAL' : 'SERVER')}): ` + JSON.stringify(command)});
            if (!this.prepareFork(command)) {
                return;
            }
            this.monitorRestarting = false;
            self.common.openBkAndSendActionWithData({
                action: 'MAXIMUM',
                data: [self.fork[self.firstShBk]]
            }, self.firstShBk);
            self.common.openBkAndSendActionWithData({
                action: 'MAXIMUM',
                data: [self.fork[self.secondShBk]]
            }, self.secondShBk);
            self.activeBk = self.secondShBk;
            self.tabsActivator(true);
        }

        proceedCommand() {
            const self = this;
            return {
                /*
                'FORK': (command, bk) => {
                    this.internalFork = false;
                    if (!self.prepareFork(command)) {
                        return;
                    }
                    self.common.openBkAndSendActionWithData({
                        action: 'MAXIMUM',
                        data: [self.fork[self.firstShBk]]
                    }, self.firstShBk);
                    self.common.openBkAndSendActionWithData({
                        action: 'MAXIMUM',
                        data: [self.fork[self.secondShBk]]
                    }, self.secondShBk);
                    self.activeBk = self.secondShBk;
                    self.tabsActivator(true);
                }, */
                'FORK': (command, bk) => {
                    self.prepareMonitor(command);
                },
                'MONITOR': (command, bk) => {
                    self.prepareMonitor(command);
                }
            };
        }

        _runScanners() {
            console.log('%c' + '_runScanners', 'background: green; color: white; font-size: 14px; font-weight: bold; padding: 10px;');
            const self = this;
            waitForCondition(() => {
                    //console.log(`${self.common.bkTabs['fon']} / ${self.common.bkBalances['fon']} ${self.common.bkBalancesUpdated['fon']}`);
                    return (Math.floor(Date.now() / 1000) - self.common.bkBalancesUpdated['fon']) < 10000;
                },
                1000, 120000, 'Fon not authorized!')
                .then(() => chrome.tabs.executeScript(self.common.bkTabs['fon'],
                    {
                        file: 'libs/scanner.js',
                        //allFrames: true,
                        runAt: 'document_start'
                    },
                    () => console.log('%c' + 'Scanner script loaded!', 'background: green; color: white; font-size: 14px; font-weight: bold; padding: 10px;')))
                .catch(e => console.log('%c' + e, 'background: red; color: yellow; font-size: 14px; font-weight: bold; padding: 10px;'));
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.scannerData && request.bk) {
                    console.log(JSON.parse(request.scannerData));
                }
                return false;
            });
            // urls: ["https://*/line/topEvents3*"],
            //                 types: ['xmlhttprequest']
        }
    }

    const forkLoop = new ForkLoop();

})();