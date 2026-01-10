/**
 * @import jquery-3.3.1.min.js
 */


function findFrameByUrl(frameTree, url) {
    const find = (tree) => {
        for (const nodeName of Object.keys(tree)) {
            if (nodeName === 'frameTree') {
                const res = find(tree[nodeName]);
                if (res !== null) {
                    return res;
                }
            } else if (nodeName === 'childFrames') {
                for (const chFrame of tree[nodeName]) {
                    const res = find(chFrame);
                    if (res !== null) {
                        return res;
                    }
                }
            } else if (nodeName === 'frame') {
                const frameUrl = tree[nodeName].url + (!!tree[nodeName].urlFragment ? tree[nodeName].urlFragment : '');
                console.log(`Checking '${frameUrl}'.indexOf('${url}')`);
                if (frameUrl.indexOf(url) > -1) {
                    return tree[nodeName];
                } else {
                    return null;
                }
            } else {
                throw `Unsupported: ${nodeName}`
            }
        }
        return null;
    };
    return find(frameTree)
}

function checkNewCoefs(data, checked, totalCoef, errors) {
    if (errors.length === 0 && checked === data.length) {
        const nCheck = data[0].coef && !isNaN(parseFloat(data[0].coef)) ? parseFloat(data[0].coef) : totalCoef / 1.21;
        if (totalCoef >= nCheck * 1.2) {
            throw `Coef TOO BIG: ${totalCoef} instead of ${data[0].coef}`;
        } else if (totalCoef < nCheck) {
            throw `LOW_COEF ${data[0].coef} > ${totalCoef}`;
        } else {
            return `Coefs fine! here: ${totalCoef}, need: ${nCheck}/${data[0].coef}`;
        }
    } else {
        throw errors.join('; ') + (checked !== data.length ? ` some stakes not checked (${checked}/${data.length})!` : '');
    }
}

/**
 * Our types
 */

class ArbFork {
    bookie = '';
    shoulder = 0;
    maxWait = 60;
    maxLosePercent = 5;
    minWinPercent = 5;

    constructor(params) {
        for (const param of Object.keys(params)) {
            if (this.hasOwnProperty(param)) {
                this[param] = params[param];
            }
        }
    }

    enabled() {
        return this.bookie !== '';
    }

    getAll() {
        return {
            shoulder: this.shoulder,
            maxWait: this.maxWait,
            maxLosePercent: this.maxLosePercent,
            minWinPercent: this.minWinPercent,
        };
    }
}

class QrCode {
    static FROM_PAGE = 'kXXr3fssW9jKftY6A3W5KEAGhaWw87';
    static monitorStop = false;
    static gotQrCode = false;
    static qrCodeSent = 0;
    static qrCodeInterval = 300000;
    static monitorCycle = 30000;
    longitude = '';
    latitude = '';
    country = '';
    proxy = '';
    apikey = '';
    xcftToken = '';
    attributes = ['longitude', 'latitude', 'country', 'proxy', 'apikey',];

    constructor(params) {
        if (!params && typeof params !== 'object') {
            return;
        }
        for (const param of Object.keys(params)) {
            if (this.hasOwnProperty(param)) {
                this[param] = params[param];
            }
        }
    }

    static async getXcftToken() {
        return new Promise(resolve => {
            let resolved = false;
            setTimeout(function () {
                if (resolved) return;
                resolved = true;
                resolve("");
            }, 1000);

            let a = ns_gen5_net.Loader2.Counter++,
                l = function (t) {
                    if (resolved) return;
                    resolved = true;
                    window.removeEventListener("xcft" + a, l);
                    var e = t.detail;
                    resolve(e);
                }

            window.addEventListener("xcft" + a, l);
            window.dispatchEvent(new CustomEvent("xcftr", {
                detail: a
            }));
        });
    }

    static async getXcftTokenTest() {
        return new Promise(resolve => {
            setTimeout(function () {
                resolve("Test!");
            }, 1000);
        });
    }

    static waitForConditionF(conditionFunc, interval, max, errorMessage) {
        let message = typeof errorMessage === 'undefined' ? 'Condition is NOT true' : errorMessage;
        return () => new Promise(function (onSuccess, onReject) {
            let waitStarted = Date.now();
            const checkRes = function (res) {
                if (res === true) {
                    onSuccess('Good!');
                } else if (Date.now() - waitStarted <= max) {
                    setTimeout(waitForC, interval);
                } else {
                    onReject(`${message} in ${(Date.now() - waitStarted)} ms`);
                }
            };
            const waitForC = function () {
                const res = conditionFunc();
                if (res instanceof Promise) {
                    res.then(r => checkRes(r)).catch(e => onReject(e));
                } else {
                    checkRes(res);
                }
            };
            waitForC();
        });
    }

    static monitorQrCode(source) {
        const self = this;
        let wasError = false;
        console.log(`monitorQrCode: ${source || 'new'}`);
        this.waitForConditionF(() => {
            self.gotQrCode = document.querySelector('canvas.atm-QrCodeScreen_Qrcode') !== null;
            return self.monitorStop || ((Date.now() - self.qrCodeSent > self.qrCodeInterval) && self.gotQrCode);
        }, 1000, self.monitorCycle, 'no QrCode')()
            .then(async () => {
                if (self.gotQrCode && (Date.now() - self.qrCodeSent > self.qrCodeInterval)) {
                    console.log(`We are ready to send!`);
                    const toSend = {
                        direction: self.FROM_PAGE,
                        action: 'qrCode',
                        token: await self.getXcftToken(),
                    };
                    window.postMessage.call(window, toSend, "*");
                    self.qrCodeSent = Date.now();
                    console.log(`we sent token: ${toSend.token}`, toSend);
                } else {
                    console.log(`No need to send - ${self.gotQrCode}, Date.now() - ${self.qrCodeSent} = `
                        + (Date.now() - self.qrCodeSent) + ` <= ${self.qrCodeInterval}!`);
                }
                self.gotQrCode = false;
            })
            .catch(e => (console.error(e), wasError = true))
            .then(() => self.monitorStop ? null
                : setTimeout(() => this.monitorQrCode(`repeat (${wasError})`), 1000)
            );
    }

    static sendQrCodeToBackground(token) {
        self = this;
        return new Promise(function (onSuccess, onReject) {
            dLog('', 'helper', `sendQrCodeToBackground token: ${token}`);
            chrome.runtime.sendMessage(
                {
                    backgroundSpecialAction: 'qrCode',
                    token: token,
                },
                (response) => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        dLog('red', 'helper',
                            ['sendQrCodeToBackground chrome.runtime.lastError: ', error]);
                        onReject(error);
                    } else {
                        dLog('green', 'helper', ['sendQrCodeToBackground response: ', response]);
                        onSuccess(response);
                    }
                });
        });
    }

    enabled() {
        return this.attributes.every(attribute => !!this[attribute]);
    }

    getAll() {
        return this.attributes.reduce((acc, attribute) => {
            acc[attribute] = this[attribute];
            return acc;
        }, {});
    }

    async getQueryBody() {
        return {
            "d": this.xcftToken,
            "la": this.latitude,
            "lo": this.longitude,
            "t": this.getTimestamp(),
            "c": this.country,
            "p": this.proxy,
        };
    }

    async sendQuery() {
        if (!this.xcftToken || !this.enabled()) {
            return;
        }
        const
            url = 'https://api2.forksmarket.ru/api/qr/autosolve?apikey=' + this.apikey,
            resp = this.makeXHRRequest('POST', url, await this.getQueryBody())
                .then(response => ({success: true, data: response.json()}))
                .catch(error => ({success: false, data: error}));
        console.log('%c' + resp.data,
            resp.success
                ? 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;'
                : 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'
        );
    }

    makeXHRRequest(method, url, data) {
        return new Promise(function (resolve, reject) {
            const xhr = new XMLHttpRequest();

            xhr.open(method, url);
            xhr.setRequestHeader('Content-Type', 'application/json');

            xhr.onload = function () {
                if (xhr.status === 200) {
                    resolve(xhr.response);
                } else {
                    reject(xhr.statusText);
                }
            };

            xhr.onerror = function () {
                reject('Network Error');
            };

            xhr.send(JSON.stringify(data));
        });
    }

    async sendQueryFetch() {
        if (!this.xcftToken || !this.enabled()) {
            return;
        }
        const
            url = 'https://api2.forksmarket.ru/api/qr/autosolve?apikey=' + this.apikey,
            resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(await this.getQueryBody()),
            })
                .then(r => r.json())
                .then(response => ({success: true, data: response}))
                .catch(error => ({success: false, data: error}));
        console.log('%c' + `sendQueryFetch:`,
            resp.success
                ? 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;'
                : 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'
        );
        console.log(resp);
        return resp;
    }

    getTimestamp() {
        return parseInt(new Date().getTime() / 1000).toString();
    }

}

class RegisterCommand {
    bk = '';
    email = '';
    login = '';
    password = '';
    birthdate = '';
    name = '';
    last_name = '';
    country = '';
    address = '';
    city = '';
    zip = '';
    job = '';
    amount = '';
    binance_api = ''

    attributes = [
        'bk', 'email', 'login', 'password', 'birthdate', 'name', 'last_name', 'country', 'address', 'city', 'zip', 'job',
        'amount', 'binance_api',
    ];

    constructor(params) {
        for (const attribute of this.attributes) {
            if (typeof params === 'object' && params.hasOwnProperty(attribute)) {
                this[attribute] = params[attribute] || '';
            }
        }
    }

    getAll(testing) {
        if (testing) {
            this.login = '*** TEST ***';
        }
        return this.attributes.reduce((acc, attribute) => {
            acc[attribute] = this[attribute];
            return acc;
        }, {});
    }

    enabled() {
        return this.bk === 'gamdom'
            ? ['email', 'login', 'password'].every(attribute => !!this[attribute])
            : this.attributes.every(attribute => !!this[attribute]);
    }

    disable() {
        for (const attribute of this.attributes) {
            this[attribute] = '';
        }
    }
}

class BetInPool {
    bet = null;
    added = null;

    constructor(bet) {
        this.bet = bet;
        this.added = new Date();
    }
}

function newBetInPool(bet) {
    return new BetInPool(bet);
}

class BetsPool {
    interval = 2000;
    bets;
    checkFields = ['sport', 'league', 'team1', 'team2',];

    constructor() {
        this.bets = [];
    }

    addBet(bet) {
        const self = this;
        let add = true;
        this.bets = this.bets.filter(betInPool => {
            if (JSON.stringify(betInPool.bet) === JSON.stringify(bet)) {
                return false;
            }
            return !self.checkFields.every(t => betInPool.bet.data[0][t] === bet.data[0][t]);

        });
        if (add) {
            this.bets.push(new BetInPool(bet));
            dLog('', 'betsPool', [`Bet added ${this.bets.length}:`, bet]);
        }
    }

    isReady(logging) {
        const self = this;
        this.bets = this.bets.filter(bet => Date.now() - bet.added < self.interval);
        if (logging) {
            dLog('', 'betsPool', `isReady? (${this.bets.length})`);
        }
        return this.bets.length >= 2;
    }

    getCommand() {
        let coef = 1, stake = 0, bookie = '';
        const bets = [];
        for (const bet of this.bets) {
            if (bets.length === 2) {
                break;
            }
            bets.push(bet.bet.data[0]);
            coef = coef * parseFloat(bet.bet.data[0].coef);
            stake = stake === 0 || bet.bet.data[0].stake < stake ? parseFloat(bet.bet.data[0].stake) : stake;
            bookie = bet.bet.bk;
        }
        for (const bet of bets) {
            bet.coef = coef;
            bet.stake = stake;
        }
        const res = {
            "action": "EXPRESS_BET",
            "bk": bookie,
            "data": bets,
        };
        dLog('green', 'betsPool', ['getCommand:', res]);
        return res;
    }

}

function newBetsPool() {
    return new BetsPool();
}

class StakeFork {
    number = 0;
    bookie = '';
    express = false;
    newExpresses = false;
    originalBookie = '';
    eventTimeLimit = 0;
    eventMaxBets = 0;
    successBetInterval = 0;
    link = '';
    stake = 1;
    source = 'oddscp';
    currency = 'USD';
    coefFrom = 0;
    coefTo = 0;
    incomeFrom = 0;
    incomeTo = 0;
    lastScoreTennis = '';
    lastScoreBasketball = '';
    excludeSports = [];
    excludeMarkets = [];
    excludeTargets = [];
    excludePivots = [];
    excludeBets = [];
    excludeLeagues = [];
    onlyLeagues = [];
    onlySecondBookie = [];
    excludeSportMarketTarget = [];
    prevForkForStake = '';
    overrideBookie = '';
    aliveSecMoreThan = 0;
    arbFork = new ArbFork({});

    constructor(params, extBkToInternal, context) {
        this.number = params.number || 0;
        const bookie = params?.bookie || 'STAKE';
        this.bookie = extBkToInternal(bookie === 'BETWAYES' ? 'BETWAY' : bookie, context);
        this.express = params?.express || false;
        this.newExpresses = params?.new_expresses || false;
        this.originalBookie = params?.bookie || 'STAKE';
        this.eventTimeLimit = parseInt(params?.eventTimeLimit || '7200') * 1000;
        this.eventMaxBets = parseInt(params?.eventMaxBets || '3');
        this.successBetInterval = parseInt(params?.successBetInterval || '30');
        this.link = params?.linkToParser || '';
        this.stake = context.bbStake > -1 ? context.bbStake : (params?.stake || 1);
        this.source = params?.source || 'oddscp';
        this.currency = context.bbCurrency !== '' ? context.bbCurrency : (params?.currency || 'USD');
        this.coefFrom = params?.coefFrom || 0;
        this.coefTo = params?.coefTo || 0;
        this.incomeFrom = params?.incomeFrom ? parseFloat(params.incomeFrom) : 0;
        this.incomeTo = params?.incomeTo ? parseFloat(params.incomeTo) : 0;
        this.lastScoreTennis = params?.lastScoreTennis || '';
        this.lastScoreBasketball = params?.lastScoreBasketball || '';
        this.excludeSports = params?.excludeSports || [];
        this.excludeMarkets = params?.excludeMarkets || [];
        this.excludeTargets = params?.excludeTargets || [];
        this.excludePivots = params?.excludePivots || [];
        this.excludeBets = params?.excludeBets || [];
        this.excludeLeagues = params?.excludeLeagues || [];
        this.onlyLeagues = params?.onlyLeagues || [];
        this.onlySecondBookie = params?.onlySecondBookie || [];
        this.excludeSportMarketTarget = params?.excludeSportMarketTarget || [];
        if (bookie === 'TRUSTDICE') {
            this.overrideBookie = 'stake';
        } else if (bookie === 'TOPSPORT') {
            this.overrideBookie = 'artemisbet';
        } else if (bookie === 'GAMDOM' || bookie === 'BETFLIP') {
            this.overrideBookie = 'lootbet';
            this.aliveSecMoreThan = 100;
        } else if (bookie === 'BETCITY.BY') {
            this.overrideBookie = 'fortune';
        } else if (bookie === '1XBET') {
            this.overrideBookie = '1xbet';
        } else if (bookie === 'PARIBET') {
            this.overrideBookie = 'fonbet';
        } else if (bookie === 'FONRU') {
            this.overrideBookie = 'fonbet';
        } else if (bookie === 'OLIMP.KZ') {
            this.overrideBookie = 'olimp';
        } else if (bookie === 'PINUP.CUPIS') {
            this.overrideBookie = 'bingoboom';
        } else if (bookie === 'UBET') {
            this.overrideBookie = 'bingoboom';
        } else if (bookie === 'BETBOOM') {
            this.overrideBookie = 'bingoboom';
        } else if (bookie === 'MELBET.RU') {
            this.overrideBookie = 'bingoboom';
        } else if (bookie === 'FAVBET') {
            this.overrideBookie = 'favbet';
        }

        if (params?.arbFork) {
            this.arbFork = new ArbFork(params.arbFork);
        }
    }

    check(bet, source) {
        /*
        aliveSecMoreThan
        coefFrom
        coefTo
        excludeSports
        excludeMarkets
        excludeTargets
        excludeLeagues
        onlyLeagues
        excludePivots
        excludeBets
        excludeSportMarketTarget
        onlySecondBookie
        */
        // Hint: if onlyLeagues present and it is not - we shouldn't check more
        if (this.onlyLeagues && this.onlyLeagues?.length > 0
            && this.onlyLeagues.indexOf(bet.data[0].league) === -1) {
            return {ok: false, errors: `${bet.data[0].league} not in onlyLeagues!`};
        }

        if (this.onlySecondBookie && this.onlySecondBookie?.length > 0
            && source?.second_bk && this.onlySecondBookie.indexOf(source.second_bk) > -1) {
            return {ok: false, errors: `${source.second_bk} not in onlySecondBookie!`};
        }

        const bad = [];
        if (this.aliveSecMoreThan > 0 && !!source['alive_sec'] && parseInt(source['alive_sec'])
            && parseInt(source['alive_sec']) > this.aliveSecMoreThan) {
            bad.push(`alive_sec ${source['alive_sec']} is more than ${this.aliveSecMoreThan}!`);
        }
        if (this.coefFrom > 0 && bet.data[0].coef < this.coefFrom) {
            bad.push(`Bet coef ${bet.data[0].coef} smaller than coef from ${this.coefFrom}`);
        }
        if (this.coefTo > 0 && bet.data[0].coef > this.coefTo) {
            bad.push(`Bet coef ${bet.data[0].coef} bigger than coef to ${this.coefTo}`);
        }
        if (this.excludeSports
            && this.excludeSports.indexOf(bet.data[0].sport) > -1) {
            bad.push(`Sport excluded: ${bet.data[0].sport}`);
        }
        if (this.excludeMarkets
            && this.excludeMarkets.indexOf(bet.data[0].market) > -1) {
            bad.push(`Market excluded: ${bet.data[0].market}`);
        }
        if (this.excludeTargets
            && this.excludeTargets.indexOf(bet.data[0].target) > -1) {
            bad.push(`Target excluded: ${bet.data[0].target}`);
        }
        if (this.excludeLeagues
            && this.excludeLeagues.indexOf(bet.data[0].league) > -1) {
            bad.push(`League excluded: ${bet.data[0].target}`);
        }
        if (this.excludePivots) {
            for (const pvt of this.excludePivots) {
                const parts = pvt.split(" ");
                if (parts.length !== 3) {
                    continue;
                }
                const exPvt = parseFloat(parts[2]);
                const betPvt = parseFloat(bet.data[0].pivot);
                if (bet.data[0].market === parts[0] && bet.data[0].target === parts[1]
                    && (exPvt > 0 && betPvt > 0 && exPvt === betPvt)) {
                    bad.push(`Pivot excluded: ${pvt} / `
                        + `${bet.data[0].market} ${bet.data[0].target} ${betPvt}`);
                    break;
                }
            }
        }
        if (this.excludeBets) {
            let mayContinue = true;
            for (const excl of this.excludeBets) {
                const parts = excl.split(" ");
                if (parts.length !== 3) {
                    continue;
                }
                if (bet.data[0].market !== parts[0] || bet.data[0].target !== parts[1]) {
                    continue;
                }
                const nTimeValue = parseInt(parts[2].replace(/\D/g, ''));
                if (parts[2] === 'FULL' && bet.data[0].time_value.indexOf('FULL') > -1) {
                    mayContinue = false;
                } else if (parts[2] === 'SET_GAME' && bet.data[0].time_value.indexOf('_GAME_') > -1) {
                    mayContinue = false;
                } else if (nTimeValue > 0
                    && nTimeValue === parseInt(bet.data[0].time_value.replace(/\D/g, ''))) {
                    mayContinue = false;
                }
                if (!mayContinue) {
                    bad.push(
                        `Bet excluded: ${excl} / `
                        + `${bet.data[0].market} ${bet.data[0].target} ${bet.data[0].time_value}`);
                    break;
                }
            }
        }
        if (this.excludeSportMarketTarget) {
            for (const smt of this.excludeSportMarketTarget) {
                const parts = smt.split(" ");
                if (parts.length !== 3) {
                    continue;
                }
                if (bet.data[0].sport === parts[0]
                    && bet.data[0].market === parts[1]
                    && bet.data[0].target === parts[2]) {
                    bad.push(`SMT excluded: ${smt} / `
                        + `${bet.data[0].sport} ${bet.data[0].market} ${bet.data[0].target}`);
                    break;
                }
            }
        }
        return {ok: bad.length === 0, errors: bad};
    }

    getBkParams() {
        return {
            eventMaxBets: this.eventMaxBets,
            eventTimeLimit: this.eventTimeLimit,
            newExpresses: this.newExpresses,
            lastScoreBasketball: this.lastScoreBasketball,
        }
    }
}

/**
 *
 * @param {object} snapshot
 * @param {array[ DOMSnapshot.DocumentSnapshot ]} snapshot.documents
 * @param {array[ string ]} snapshot.strings
 */
function parseDOMSnapshot(snapshot) {
    const getAttributes = attrs => {
        const res = {};
        for (let i = 0; i < attrs.length - 1; i = i + 2) {
            res[snapshot.strings[attrs[i]]] = snapshot.strings[attrs[i + 1]];
        }
        return res;
    };
    const documents = {};
    for (const doc of snapshot.documents) {
        //documents[snapshot.strings[doc.documentURL]] = snapshot.strings[doc.baseURL];
        const hash = snapshot.strings[doc.frameId];
        documents[hash] = {
            title: snapshot.strings[doc.title],
            documentURL: snapshot.strings[doc.documentURL],
            baseURL: snapshot.strings[doc.baseURL],
            frameId: snapshot.strings[doc.frameId],
            systemId: snapshot.strings[doc.systemId],
            publicId: snapshot.strings[doc.publicId],
            iframes: [],
        };
        for (let i = doc.nodes.nodeType.length; i > 0; i--) {
            if (snapshot.strings[doc.nodes.nodeName[i]] === 'IFRAME') {
                documents[hash].iframes.push({
                    backendNodeId: doc.nodes.backendNodeId[i],
                    parentIndex: doc.nodes.parentIndex[i],
                    attrs: getAttributes(doc.nodes.attributes[i]),
                });
            }
        }
    }
    return documents;
}

function checkRules(rules, check, debug) {
    const
        log = msg => !!debug ? console.log(msg) : null,
        checkCondition = (c, d) => {
            log(`Check condition ${c.condition}`);
            return c.rules[(c.condition === 'AND' ? 'every' : 'some')](r => checkRule(r, d));
        },
        checkRule = (r, d) => {
            log(r);
            if (!r.condition) {

                const check = r.value.indexOf(';') > -1
                    ? r.value.split(';')[self.checkIndexInArray].trim()
                    : r.value.trim();
                const res = (r.id === 'href' ? d.href : d.title).indexOf(check) > -1;
                log(`Check rule ${r.id} => ${r.value} =>>> ${res}`);
                log(` [ '${check}' -> '${d?.href}' '${d?.title}' ]`);
                return res;
            } else {
                return checkCondition(r, d);
            }
        };
    return checkCondition(rules, check);
}

// sport, type, time_value, date, team1, team2, market, target, pivot, coef, score, stake, doNotOpen, interval, fall_coef, fork, bk, euro_rub, euro_btc
class SportEventObject {
    /**
     * Event, we have to deal with
     * @param {Object} [inParams]
     * @param {string} [inParams.bk]
     * @param {string} [inParams.type]
     * @param {string} [inParams.sport]
     * @param {string} [inParams.league]
     * @param {string} [inParams.time_value]
     * @param {string} [inParams.date]
     * @param {string} [inParams.team1]
     * @param {string} [inParams.team2]
     * @param {string} [inParams.market]
     * @param {string} [inParams.target]
     * @param {string} [inParams.pivot]
     * @param {string} [inParams.coef]
     * @param {string} [inParams.score]
     * @param {string} [inParams.stake]
     * @param {boolean} [inParams.doNotOpen]
     * @param {string} [inParams.interval]
     * @param {string} [inParams.fall_coef]
     * @param {boolean} [inParams.fork]
     * @param {string} [inParams.euro_rub]
     * @param {string} [inParams.euro_btc]
     */
    constructor(inParams) {
        const params = inParams || {};
        this.bk = params.bk || '';
        this.type = params.type || '';
        this.sport = params.sport || '';
        this.league = params.league || '';
        this.time_value = params.time_value || '';
        this.date = params.date || '';
        this.team1 = params.team1 || '';
        this.team2 = params.team2 || '';
        this.home = this.team1;
        this.away = this.team2;
        this.team1spec = this.team1;
        this.team2spec = this.team2;
        this.market = params.market || '';
        this.target = params.target || '';
        this.pivot = params.pivot || '';
        this.coef = params.coef || '';
        this.score = params.score || '';
        this.stake = params.stake || '';
        this.doNotOpen = params.doNotOpen || false;
        this.interval = params.interval || '';
        this.fall_coef = params.fall_coef || '';
        this.fork = params.fork || false;
        this.euro_rub = params.euro_rub || '';
        this.euro_btc = params.euro_btc || '';
    }
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const fullClick = ['mouseover', 'mousedown', 'click', 'mouseup', 'mouseout'];

const $getIFrame = (selector, parent) => {
    const s = s => parent ? parent.find(s) : $(s);
    return typeof s(selector)[0] === 'object'
        ? $(s(selector)[0].contentDocument || s(selector)[0].contentWindow.document)
        : $([]);
};

const formatStack = stack => stack
    ? stack.replace(/\n/g, ' ')
        .replace(/chrome-extension:\/\/\w+\//g, '')
        .replace(/\s+/g, ' ').trim()
    : 'No stack!';

const uuidGen = () => ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

/**
 * Replacements in object recursively
 * @param {string|Object} element
 * @param {Object} replacements - from => to
 * @param {Object} [parent]
 * @param {string} [index]
 */
const replaceInner = (element, replacements, parent, index) => {
    if (typeof element === 'string') {
        let source = element;
        Object.keys(replacements).forEach(s => source = source.replace(s, replacements[s]));
        parent[index] = source;
    } else if (typeof element === 'object') {
        for (const i in element) {
            if (element.hasOwnProperty(i)) {
                replaceInner(element[i], replacements, element, i);
            }
        }
    } else {
        throw typeof element + ' not supported! (' + element + ')';
    }
};

/**
 * Replace full strings in object recursively
 * @param {string|Object} element
 * @param {Object} replacements - from => to
 * @param {Object} [parent]
 * @param {string} [index]
 */
const replaceInnerStrong = (element, replacements, parent, index) => {
    if (typeof element === 'string') {
        let source = element;
        Object.keys(replacements).forEach(s => source === s ? source = replacements[s] : null);
        parent[index] = source;
    } else if (typeof element === 'object') {
        for (const i in element) {
            if (element.hasOwnProperty(i)) {
                replaceInnerStrong(element[i], replacements, element, i);
            }
        }
    } else {
        throw typeof element + ' not supported! (' + element + ')';
    }
};

/**
 * All objects elements to lower case recursively
 * @param {string|Object} element
 * @param {Object} [parent]
 * @param {string} [index]
 */
const objToLower = (element, parent, index) => {
    if (typeof element === 'string') {
        parent[index] = element.toLowerCase();
    } else if (typeof element === 'object') {
        for (const i in element) {
            if (element.hasOwnProperty(i)) {
                objToLower(element[i], element, i);
            }
        }
    } else {
        throw typeof element + ' not supported! (' + element + ')';
    }
};

/**
 * Prepare Event Name array from data
 * @param {SportEventObject} data
 * @param {string} [separator] - default 'v'
 * @param {boolean} [upperCase] - default false
 * @returns {string[]}
 */
const getEventVariants = (data, separator, upperCase) => {
    const sep = separator || 'v';
    const lc = str => !upperCase ? str.toLowerCase() : str;
    const event = [];
    const team1 = (data.team1 === '' ? data.home : data.team1).split(':;');
    const team2 = (data.team2 === '' ? data.away : data.team2).split(':;');
    team1.forEach(t1 => team2.forEach(t2 => event.push(lc(`${t1} ${sep} ${t2}`))));
    team2.forEach(t2 => team1.forEach(t1 => event.push(lc(`${t1} ${sep} ${t2}`))));
    ['1', '2'].forEach(tn => {
        if (data[`team${tn}`].indexOf(',') > -1) {
            const ps = data[`team${tn}`].split(',').map(i => i.trim());
            data[`team${tn}spec`] = `${ps[1].substr(0, 1)}.${ps[0]}`;
        }
    });
    if (data.team1spec && data.team2spec) {
        event.push(lc(`${data.team1spec} ${sep} ${data.team2spec}`));
    }
    return Array.from(new Set(event));
};

/**
 * Check needle match one of haystack variants
 * @param {string} needle
 * @param {string|string[]} haystack
 * @param {number} [similarPercent]
 * @param {boolean} [strictMore] - if we need similarPercent of needle strictly more than expected otherwise more or equal
 * @returns {boolean}
 */
const compareVariants = (needle, haystack, similarPercent, strictMore) => {
    const h = typeof haystack === 'string' ? [haystack] : haystack;
    const compare = (a, b) => strictMore ? a > b : a >= b;
    return h.some(h => !similarPercent || similarPercent === 100
        ? h.toLowerCase() === needle.toLowerCase()
        : h.toLowerCase() === needle.toLowerCase()
        || compare(locutus_similar_text(h.toLowerCase(), needle.toLowerCase(), true), similarPercent));
};

/**
 *
 * @param collectionSel
 * @param subSel
 * @returns {JQuery<*>}
 */
const $getCollection = (collectionSel, subSel) => {
    const $collection = $(collectionSel);
    if (!subSel) {
        return $collection;
    } else {
        const $res = $([]);
        $collection.each(function () {
            $.merge($res, $(this).find(subSel));
        });
        return $res;
    }
};

/**
 * Find element in collection or in sub-collection
 * @param {string|Object} collectionSelOrEl
 * @param {string|string[]} compareWith
 * @param {string} [subSel]
 * @param {number} [percent]
 * @param {boolean} [debug]
 * @returns {JQuery<*>}
 */
const findInCollection = (collectionSelOrEl, compareWith, subSel, percent, debug) => {
    percent = percent || 80;
    let $res = $([]);
    (typeof collectionSelOrEl === 'string' ? $(collectionSelOrEl) : collectionSelOrEl).each(function () {
        const $this = $(this), test = (subSel ? $this.find(subSel) : $this).text().trim().toLowerCase();
        if (compareVariants(test, compareWith, percent, true)) {
            $res = $this;
            if (debug) {
                console.log('%c' + `'${test}' === '${compareWith}'`, 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            }
            return false;
        } else {
            if (debug) {
                console.log('%c' + `'${test}' !== '${compareWith}'`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            }
        }
    });
    return $res;
};

/**
 * Report from qiwi, cupis, etc.
 * @param {object} command
 * @param {object} command.data
 * @param {string} command.data.url
 * @param {boolean|null} command.close
 * @param {boolean|null} command.iFrame
 * @param {boolean} success
 * @param {string} message
 */
const qiwiReport = (command, success, message) => {
    const redirectTo = url => {
        dLog('blue', 'QIWI', `Attempting to redirect to ${url} from ${window.location.href}, isMain: ${(window.top === window.self)}`);
        try {
            window.top.location.href = url;
        } catch (e) {
            bsLogger('error', 'QIWI', e);
        }
    };
    const closeWithCheck = () => {
        window.close();
        setTimeout(() => {
            // If we're here - window not closed...
            redirectTo(command.data.url);
        }, 3333);
    };
    (async () => {
        let balance = await bMess('QIWI_WB').check(30000).catch(() => '');
        if (balance === '') {
            balance = $('div[class^="account-info-amount-"]').text()
                .replace(',', '.').replace(/[^\d.]/g, '').trim();
        }
        if (balance === '') {
            balance = $('span[class^="balance-"]').text().trim()
                .replace(/,/g, '.').replace(/[^\d.]/g, '').trim();
        }
        await bMess('DEPOSIT_RESULT', true).set({
            success: success,
            message: !success && message.indexOf('Change Password') > -1 ? 'Change Password' : message,
            balance,
        });
        dLog(success ? 'green' : 'red', 'QIWI', `qiwiReport $'${balance}' R (${document.location.href}): ${message}`);
        await bMess('QIWI_COMMAND', true).remove();
        if (!success) {
            await delayPromise(3000);
            if (typeof command.close === 'boolean' && command.close) {
                closeWithCheck();
            } else if (typeof command.iFrame === 'undefined' || !command.iFrame) {
                redirectTo(command.data.url);
            }
        } else if (typeof command.close === 'boolean' && command.close) {
            closeWithCheck();
        } else {
            await delayPromise(17000);
            if (window.location.href !== command.data.url) {
                redirectTo(command.data.url);
            }
        }
    })();
};

function fireEvent(type, element) {
    let event = new Event(type, {
        'bubbles': true,
        'cancelable': true
    });
    element.dispatchEvent(event);
}

/**
 * Fires input event on element
 * @param element
 */
function fireInputEvent(element) {
    fireEvent('input', element);
}

/**
 * Fires change event on element
 * @param element
 */
function fireChangeEvent(element) {
    fireEvent('change', element);
}


//name_event может быть = click, mousedown, mouseup, mouseover, mousemove, mouseout
function create_mouse_event(name_event, target) {
    if (typeof target === 'undefined') {
        return false;
    }
    let evt = document.createEvent("MouseEvents");
    evt.initMouseEvent(name_event, true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    target.dispatchEvent(evt);
}

/**
 * Promise mouse click function
 * @param {Object} params - object of parameters
 * @param {Object} params.target: element
 * @param {string} params.event: click, mousedown, mouseup, mouseover, mousemove, mouseout,
 * @param {string[]} [params.events]: [ sequence of events to do ]}
 * @return Promise
 */
function create_mouse_event_promise(params) {
    if (typeof params.events === 'object') {
        params.event = params.events.shift();
        console.log('PERFORM: ' + params.event);
    }
    return new Promise(function (resolve, reject) {
        let evt = document.createEvent("MouseEvents");
        evt.initMouseEvent(params.event, true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        if (params.target.dispatchEvent(evt)) {
            resolve(params);
        } else {
            reject(params);
        }
    });
}

/**
 * Fire chain of mouse events
 * @param {Object} params - object of parameters
 * @param {Object} params.target - Element
 * @param {string[]} params.events - sequence of events to fire - debuggerClick (if click throw debugger - as real user)
 *  ['mouseover', 'mousedown', 'click', 'mouseup', 'mouseout']
 * @param {int} [params.interval] - interval to sleep between events, ms, default 1
 * @param {boolean} [params.scroll] - whether we need scroll into element before mouse events, default false
 * @param {boolean} [params.scrollTop] - scroll into view element on top or bottom, default false
 * @param {boolean} [params.rejectOnPreventDefault] - do we need reject if somebody call preventDefault on event, default FALSE
 * @param {boolean} [params.debug] - if we need to console debug
 * @param {int} [params.x] - if we need to Events with coordinates - X, default: -1
 * @param {int} [params.y] - if we need to Events with coordinates - Y, default: -1
 * @param {string} [params.clickInBK] - NECESSARY if debuggerClick - bk for click
 * @param {boolean} [params.clickToCenter] - if debuggerClick - click to random in the center, default - true
 * @param {string} [params.error] - error message
 * @return Promise
 */
const mouseChain = params => new Promise((onSuccess, onReject) => {
    //dLog('bigred', 'B365', ['!!!!!! ATTEMPT TO CLICK !!!!!', params]);
    //onSuccess(params);
    //return;
    const reject = e => onReject(params.error ? ` -= ${params.error} =- ${e}` : e);
    if (!Array.isArray(params.events) || params.events.length === 0) {
        reject('Wrong events!');
    }
    (async function () {
        const eventX = typeof params.x === 'number' ? params.x : -1,
            eventY = typeof params.y === 'number' ? params.y : -1,
            clickToCenter = typeof params.clickToCenter === 'boolean' ? params.clickToCenter : true,
            rect = params.target.getBoundingClientRect(),
            leftPoint = clickToCenter ? getRandomRounded(rect.left + 2, rect.right - 2) : Math.ceil(rect.left),
            topPoint = clickToCenter ? getRandomRounded(rect.top + 2, rect.bottom - 2) : Math.ceil(rect.left),
            rejectOnPreventDefault = typeof params.rejectOnPreventDefault === 'boolean' ? params.rejectOnPreventDefault : false;
        if (params.scroll || params.scrollTop) {
            params.target.scrollIntoView(typeof params.scrollTop === 'boolean' && params.scrollTop);
            await delayPromise(100);
        }
        await params.events.forEachAsync(async (event) => {
            if (event === 'debuggerClick') {
                if (params.debug) {
                    console.log(`Rectangle: ${rect.top}-${rect.right}-${rect.bottom}-${rect.left}\nClick to: ${leftPoint}x${topPoint}`);
                    console.log(document.elementFromPoint(leftPoint, topPoint));
                }
                const r = await bsSendMouseClick(params.clickInBK, leftPoint, topPoint);
                console.log('%c' + `Debugger mouse click performed to ${leftPoint}x${topPoint} at ${params.clickInBK}, %O`,
                    'background: blue; color: yellow; font-weight: bold;', r);
            } else {
                const evt = document.createEvent("MouseEvents");
                evt.initMouseEvent(event, true, true, window, 0,
                    (eventX > -1 && eventY > -1) ? eventX : 0, (eventX > -1 && eventY > -1) ? eventY : 0,
                    0, 0, false, false, false, false, 0, null);
                const dispatchResult = params.target.dispatchEvent(evt);
                if (params.debug) {
                    console.log(dispatchResult, rejectOnPreventDefault, (!rejectOnPreventDefault && !dispatchResult),
                        (dispatchResult || (!rejectOnPreventDefault && !dispatchResult)));
                }
                if (!dispatchResult && rejectOnPreventDefault) {
                    throw `Event ${event} was cancelled!`;
                } else if (params.debug) {
                    console.log(`PERFORMED MOUSE: ${event}`);
                }
            }
            await delayPromise(params.interval ? params.interval : 1);
        });
    })().then(() => onSuccess(params)).catch(e => reject(e));
});

function mouseChainOld(params) {
    return new Promise(function (resolve, onReject) {
        const reject = (e) => onReject(params.error ? ' -= ' + params.error + ' =- ' + e : e);
        let rejectOnPreventDefault = typeof params.rejectOnPreventDefault === 'boolean' ? params.rejectOnPreventDefault : false;
        let event;
        if (typeof params.events === 'object') {
            event = params.events.shift();
        } else {
            reject('Wrong parameters!');
            return;
        }
        let eventX = typeof params.x === 'number' ? params.x : -1;
        let eventY = typeof params.y === 'number' ? params.y : -1;
        let rect;
        try {
            rect = params.target.getBoundingClientRect();
        } catch (e) {
            reject(e);
            return;
        }
        const clickToCenter = typeof params.clickToCenter === 'boolean' ? params.clickToCenter : true;
        let leftPoint = clickToCenter ? getRandomRounded(rect.left + 2, rect.right - 2) : Math.ceil(rect.left);
        let topPoint = clickToCenter ? getRandomRounded(rect.top + 2, rect.bottom - 2) : Math.ceil(rect.left);
        let nextEvent = function () {
            event = params.events.shift();
            if (typeof event === 'string' && event.length > 1) {
                setTimeout(performEvent, params.interval ? params.interval : 1);
            } else {
                resolve(params);
            }
        };
        let performEvent = function () {
            if (event === 'debuggerClick') {
                if (params.debug) {
                    console.log('Rectangle: ' + rect.top + ' - ' + rect.right + ' - ' + rect.bottom + ' - ' + rect.left);
                    console.log('Click to: ' + leftPoint + ' x ' + topPoint);
                    console.log(document.elementFromPoint(leftPoint, topPoint));
                }
                bsSendMouseClick(params.clickInBK, leftPoint, topPoint)
                    .then((r) => console.log('%cDebugger mouse click performed to ' + leftPoint + 'x' + topPoint + ' at ' + params.clickInBK,
                        'background: blue; color: yellow; font-weight: bold;', r))
                    .catch((e) => reject(e))
                    .then(nextEvent);
            } else {
                let evt = document.createEvent("MouseEvents");
                if (eventX > -1 && eventY > -1) {
                    evt.initMouseEvent(event, true, true, window, 0, eventX, eventY, 0, 0, false, false, false, false, 0, null);
                } else {
                    evt = document.createEvent("MouseEvents");
                    evt.initMouseEvent(event, true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
                }
                let dispatchResult = params.target.dispatchEvent(evt);
                if (params.debug) {
                    console.log(dispatchResult, rejectOnPreventDefault, (!rejectOnPreventDefault && !dispatchResult),
                        (dispatchResult || (!rejectOnPreventDefault && !dispatchResult)));
                }
                if (dispatchResult || (!dispatchResult && !rejectOnPreventDefault)) {
                    if (params.debug) {
                        console.log('PERFORMED MOUSE: ' + event);
                    }
                    nextEvent();
                } else {
                    reject('Event ' + event + ' was cancelled!');
                }
            }
        };
        if (typeof event === 'string' && event.length > 1) {
            if (typeof params.scroll === 'boolean' && params.scroll) {
                params.target.scrollIntoView(typeof params.scrollTop === 'boolean' && params.scrollTop);
                setTimeout(performEvent, 100);
            } else {
                performEvent();
            }
        } else {
            reject('Empty event!');
        }
    });
}

/**
 * Emulates enter string into the element
 * @param {object} params - object of params
 * @param {string} params.string - Emulated string
 * @param {object} params.element - element
 * @param {boolean} [params.long] - whether do big pause (default: false)
 * @param {boolean} [params.over] - if we need mouse_over event first (default: false)
 * @param {boolean} [params.click] - if we need click first (default: false)
 * @param {boolean} [params.fireInput] - fire input event then key pressed (default: false)
 * @param {boolean} [params.fireChange] - fire change event then key pressed (default: false)
 * @param {string} [params.emulateTab] - whether we need focus next element - selector of current (default: '')
 * @param {boolean} [params.allowEmptyString] - if true, success, when empty string
 * @param {boolean} [params.longest] - if true, very long delay
 * @returns {Promise<object,string>}
 */
function emulateKeyboardLikeHuman(params) {
    return new Promise(function (resolve, reject) {
        let enter_string = typeof params.string !== 'undefined' ? params.string.toString() : '',
            dom_object = params.element,
            over = typeof params.over !== 'undefined' ? params.over : false,
            click = typeof params.click !== 'undefined' ? params.click : false,
            long = typeof params.long !== 'undefined' ? params.long : false,
            fireInput = typeof params.fireInput !== 'undefined' ? params.fireInput : false,
            fireChange = typeof params.fireChange !== 'undefined' ? params.fireChange : false,
            emulateTab = typeof params.emulateTab !== 'undefined' ? params.emulateTab : '';
        console.log('Lets enter: ', params);
        let ourString = enter_string;
        //console.log('ourString is: ' + ourString);
        if (ourString.length < 1) {
            if (!params.allowEmptyString) {
                reject('Empty string to enter!');
            } else {
                resolve(params);
            }
            return;
        }
        let pause = params.longest ? 150 : (long ? 50 : 10);
        if (!dom_object) {
            reject('Keyboard Element is wrong!');
            return;
        }
        let i = 0;
        let performEnter = function () {
            if (typeof ourString[i] === 'undefined') {
                reject("On place " + i + " in string '" + ourString + "' there is nothing!");
                return;
            }
            emulate_keyboard(ourString[i], dom_object);
            if (fireInput) {
                fireInputEvent(dom_object);
            }
            if (fireChange) {
                fireChangeEvent(dom_object);
            }
            i = i + 1;
            if (i <= (ourString.length - 1)) {
                let wait = getRandomRounded(pause, pause * 2);
                //console.log(wait, ourString[i]);
                setTimeout(function () {
                    performEnter();
                }, wait);
            } else {
                if (emulateTab !== '') {
                    //dom_object.blur();
                    $(emulateTab).emulateTab();
                }
                resolve(params);
            }
        };
        if (over && click) {
            create_mouse_event_promise({
                events: ["mouseover", "mousedown", "click", "mouseup"],
                target: dom_object
            })
                .then(create_mouse_event_promise)
                .then(create_mouse_event_promise)
                .then(create_mouse_event_promise)
                .then(performEnter)
                .catch(function (e) {
                    console.log(e);
                });
        } else if (over && !click) {
            create_mouse_event_promise({event: "mouseover", target: dom_object})
                .then(performEnter)
                .catch(function (e) {
                    console.log(e);
                });
        } else if (click && !over) {
            create_mouse_event_promise({events: ["mousedown", "click", "mouseup"], target: dom_object})
                .then(create_mouse_event_promise)
                .then(create_mouse_event_promise)
                .then(performEnter)
                .catch(function (e) {
                    console.log(e);
                });
        }
        {
            dom_object.focus();
            performEnter();
        }
    });
}

/**
 *
 * @param obj
 * @returns {boolean}
 */
function ObjectIsElement(obj) {
    let IsElem = true;
    if (obj == null) {
        IsElem = false;
    } else if (typeof (obj.appendChild) != "object" && typeof (obj.appendChild) != "function") {
        //IE8 and below returns "object" when getting the type of a function, IE9+ returns "function"
        IsElem = false;
    } else if ((obj.appendChild + '').replace(/[\r\n\t\b\f\v\xC2\xA0\x00-\x1F\x7F-\x9F ]/ig, '').search(/\{\[NativeCode]}$/i) === -1) {
        IsElem = false;
    } else if (obj.nodeType !== 1) {
        IsElem = false;
    }
    return IsElem;
}

/**
 * Clears input element (promise - on success will call resolve with params)
 * @param params - { element: element }
 * @returns {Promise<{}>}
 */
function clearInputElement(params) {
    let element = params.element;
    //console.log(element);
    return new Promise(function (resolve, reject) {
        if (!(element instanceof Element) && !ObjectIsElement(element)) {
            reject('ClearInputElement Element is wrong!');
        } else {
            element.focus();
            setTimeout(function () {
                element.setSelectionRange(0, element.value.length);
                setTimeout(function () {
                    document.execCommand("delete");
                    setTimeout(function () {
                        resolve(params);
                    }, 50);
                }, 50);
            }, 50);
        }
    });
}

function dispatchMouseEvent(eventType, target) {
    return new Promise(function (resolve, reject) {
        let event = new MouseEvent(eventType, {});
        if (target.dispatchEvent(event)) {
            resolve(true);
        } else {
            reject(false);
        }
    });
}

function emulate_keyboard(symbol, dom_object) // symbol - строка, не число (пример - "7" а не 7)
{

    // в идеале - инициализирую 3 последовательных события:
    // keydown - клавиша нажата, доступен код клавиши
    // keypress - поялвение символа, доступен код символа
    // keyup - клавиша отпущена
    // работает и с одним keyup (у 10bet проверяется только OnKeyup)

    var element = dom_object;
    var key = symbol;

    create_keyboard_event(element, "keydown", key);

    // позиция в инпуте
    var pos = element.selectionStart;
    var posEnd = element.selectionEnd;

    // формирую новое значение инпута = предыдущее значение инпута + новый вводимый символ (в соотв. месте)
    element.value = element.value.substr(0, pos) + key + element.value.substr(posEnd);

    // сдвигаю курсор в инпуте на 1 шаг вправо
    element.selectionStart = pos + 1;
    element.selectionEnd = pos + 1;

    create_keyboard_event(element, "keypress", key);
    create_keyboard_event(element, "keyup", key);

}

function create_keyboard_event(dom_object, name_event, key) {
    if (typeof key === 'undefined') {
        return;
    }
    var keyboardEvent = document.createEvent("KeyboardEvent");
    var initMethod = typeof keyboardEvent.initKeyboardEvent !== 'undefined' ? "initKeyboardEvent" : "initKeyEvent";
    keyboardEvent[initMethod]
    (
        name_event, // тип события : keydown, keyup, keypress
        true, // "всплытие" вызова события к родительским элементам - true/false
        true, // может ли это событие быть отменено - true/false
        window, // viewArg
        false, // ctrl
        false, // alt
        false, // shift
        false, // meta
        key.charCodeAt(0), // Значение кода клавиши, к-ая была нажата, иначе = 0
        0 // charCodeArgs
    );

    dom_object.dispatchEvent(keyboardEvent);
}

function getRandomRounded(min, max, round, down) {
    round = round || 1;
    down = down || false;
    min = parseInt(min);
    max = parseInt(max);
    var result = Math.floor(Math.random() * (max - min + 1)) + min;
    if (down) {
        return Math.floor(result / round) * round;
    } else {
        return Math.ceil(result / round) * round;
    }
}

function getRounded(numb, round, down) {
    const test = typeof numb === 'number' ? numb : parseFloat(numb);
    return Math[down ? 'floor' : 'ceil'](test / round) * round;
}

const bsDebugDouble = (port, message, dataParam) => {
    console.log(message);
    if (dataParam) {
        console.log(dataParam);
    }
    bsDebug(port, message, dataParam);
};

/**
 * Output debug message - all parameters after dataParam will be displayed
 * parameter COLOR:color - will set color for main message background and text (ex. COLOR:yellow,white), default color: green,white
 * @param port - port parameter
 * @param message - message
 * @param [dataParam] - some data
 */
function bsDebug(port, message, dataParam) {
    if (!port || !message) {
        return;
    }
    if (!port.onMessage) {
        console.log('%c' + message, 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        if (dataParam) {
            console.log(dataParam);
        }
        return;
    }
    let data = typeof dataParam === 'undefined' ? false : dataParam;
    let pMessage = {
        answered: "DEBUG",
        answer: message
    };
    if (
        data
        && (typeof data !== 'object'
            || (typeof data === 'object' && data.constructor === Array && data.length > 0)
            || (data.constructor === Object && Object.keys(data).length > 0)
        )) {
        pMessage.data = data;
    }
    let extArguments = arguments;
    let extData = 1;
    let checkParams = function (i) {
        if (typeof extArguments[i] !== 'undefined') {
            if (typeof extArguments[i] === 'string' && extArguments[i].substring(0, 6) === 'COLOR:') {
                let temp = extArguments[i].substring(6).split(',');
                pMessage['backColor'] = temp[0].trim();
                pMessage['fontColor'] = temp[1].trim();
            } else {
                pMessage['data' + extData] = extArguments[i];
                extData++;
            }
            i++;
            checkParams(i);
        }
    };
    checkParams(3);
    port.postMessage(pMessage);
}

function bsError(port, message, dataParam) {
    if (!port || !message) {
        return;
    }
    if (!port.onMessage) {
        console.log('%c' + message, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        if (dataParam) {
            console.log(dataParam);
        }
        return;
    }
    let data = typeof dataParam === 'undefined' ? false : dataParam;
    let pMessage = {
        answered: "DEBUG",
        answer: message,
        error: true
    };
    if (data) {
        pMessage.data = data;
    }
    port.postMessage(pMessage);
}

/**
 * Writes to background log
 * @param {string} type - 'pink', 'red', 'green', 'blue', 'yellow', 'orange', 'black', 'error',
 * you can also ADD bigger or big to type and it will be bigger - 35/35 or big - 25/15
 *  or custom parameters like 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'
 * @param {string} bk - bk name (or window name, etc.)
 * @param {string|array} data
 */
function bsBLogger(type, bk, data) {
    chrome.runtime.sendMessage({bLogger: type, bk: bk, data: data}, r => {
        const error = chrome.runtime.lastError;
    });
}

/**
 * Alias to bsBLogger
 * @param {string} type - 'pink', 'red', 'green', 'blue', 'yellow', 'orange', 'black', 'error',
 * you can also ADD bigger or big to type and it will be bigger - 35/35 or big - 25/15
 *  or custom parameters like 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'
 * @param {string} bk - bk name (or window name, etc.)
 * @param {string|array} data
 */
function bsLogger(type, bk, data) {
    return bsBLogger(type, bk, data);
}

/**
 * Alias to bsBLogger with duplicating into the console
 * @param {string} type - 'pink', 'red', 'green', 'blue', 'yellow', 'orange', 'black', 'error',
 * you can also ADD bigger or big to type and it will be bigger - 35/35 or big - 25/15
 *  or custom parameters like 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'
 * @param {string} bk - bk name (or window name, etc.)
 * @param {string|array} data
 */
function dLog(type, bk, data) {
    specialLog(type, bk, data);
    return bsBLogger(type, bk, data);
}

/**
 * Colored and formatted console output
 * @param {string} typeIn - 'pink', 'red', 'green', 'blue', 'yellow', 'orange', 'black', 'error',
 * you can also ADD bigger(-) or big(-) to type and it will be bigger - 35/35 or big - 25/15
 * or custom parameters like 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;'
 * @param {string} bk - bk name (or window name, etc.)
 * @param {string|array} data
 */
function specialLog(typeIn, bk, data) {
    const getFrontColorByBackground = bgColor => bgColor === 'yellow' ? 'red'
        : bgColor === 'pink' ? 'navy' : 'white';
    let format, sizeAndPadding, sType;
    if (typeIn.indexOf('bigger') > -1) {
        sType = typeIn.replace('-', '').replace('bigger', '');
        sizeAndPadding = 'font-weight: bold; font-size: 35px; padding: 35px;';
    } else if (typeIn.indexOf('big') > -1) {
        sType = typeIn.replace('-', '').replace('big', '');
        sizeAndPadding = 'font-weight: bold; font-size: 25px; padding: 15px;';
    } else {
        sType = typeIn;
        sizeAndPadding = 'font-weight: bold;';
    }
    if (['pink', 'red', 'green', 'blue', 'yellow', 'orange', 'black'].indexOf(sType) > -1) {
        format = `background: ${sType}; color: ${getFrontColorByBackground(sType)}; ${sizeAndPadding}`;
    } else if (sType === 'error') {
        format = '';
    } else {
        format = sType;
    }
    console[sType === 'error'
        ? 'error'
        : 'log'](`%c${bk} (${nowFormatted()}): ${(typeof data === 'string' ? data : data[0])}`, format);
    if (typeof data === 'object' && Array.isArray(data)) {
        data.slice(1).forEach(m => console.log(m));
    }
}

function isAsyncFunction(fn) {
    return fn && fn.constructor && fn.constructor.name === 'AsyncFunction';
}

function nowFormatted(dtParam) {
    let cd = typeof dtParam === 'undefined' ? new Date() : new Date(dtParam);
    return cd.getHours() + ':' + cd.getMinutes() + ':' + cd.getSeconds() + ' (' + cd.getMilliseconds() + ')';
}

function formatUnixTimestamp(timestamp) {
    const date = new Date(timestamp * 1000); // Convert the timestamp to milliseconds

    const year = date.getFullYear();
    const month = ("0" + (date.getMonth() + 1)).slice(-2); // Months are 0-based in JS
    const day = ("0" + date.getDate()).slice(-2);
    const hours = ("0" + date.getHours()).slice(-2);
    const minutes = ("0" + date.getMinutes()).slice(-2);
    const seconds = ("0" + date.getSeconds()).slice(-2);

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function waitForElementO(params) {
    return waitForElement(
        params.s || '',
        params.i || 1,
        params.m || 10,
        params.v || false,
        params.ma || 1,
        params.e || ''
    );
}

/**
 * Wait for element
 * @param {String|string[]|function} selector - jQuery selector for element or function which returns JQuery object
 * @param {number} interval - interval between checks
 * @param {number} max - maximum wait time
 * @param {boolean} [visibleParam] - if TRUE - element must be visible for user
 * @param {number} [minAmount] - minimal amount of elements
 * @param {string} [error] - error message
 * @returns {Promise<JQuery|jQuery>}
 */
function waitForElement(selector, interval, max, visibleParam, minAmount, error) {
    return new Promise(function (resolve, reject) {
        const visible = typeof visibleParam === 'undefined' ? false : visibleParam;
        const len = minAmount || 1;
        const waitStarted = Date.now();
        const $getEl = () => typeof selector === 'function' ? selector() : jQuery(findSel(selector));
        const waitForEl = () => {
            let $el = $getEl();
            if (!$el) {
                console.log(selector.toString());
                throw `BAD ^^& SELECTOR!!!`;
            }
            if (($el.length >= len && !visible) || ($el.length >= len && visible && elementIsVisible($el[0]))) {
                resolve($el);
            } else if (Date.now() - waitStarted <= max) {
                setTimeout(waitForEl, interval);
            } else {
                reject('Element "' + (error
                        ? error : (typeof selector === 'string' ? selector : 'from function ' + typeof selector))
                    + '" was not shown for '
                    + (Date.now() - waitStarted) + 'ms');
            }
        };
        waitForEl();
    });
}

/**
 * Wait for element
 * @param {String|function} selector - jQuery selector for element
 * @param {number} interval - interval between checks
 * @param {number} max - maximum wait time
 * @param {boolean} [visibleParam] - if TRUE - element must be visible for user
 * @returns {function}
 */
function waitForElementF(selector, interval, max, visibleParam) {
    return () => waitForElement(selector, interval, max, visibleParam);
}

/**
 * Wait @max@ time until conditionFunc becomes true or Promise.resolve
 * @param {function} conditionFunc (must return boolean or Promise with boolean result)
 * @param {int} interval
 * @param {int} max
 * @param {string} [errorMessage]
 * @returns {function}
 */
function waitForConditionF(conditionFunc, interval, max, errorMessage) {
    let message = typeof errorMessage === 'undefined' ? 'Condition is NOT true' : errorMessage;
    return () => new Promise(function (onSuccess, onReject) {
        let waitStarted = Date.now();
        const checkRes = function (res) {
            if (res === true) {
                onSuccess('Good!');
            } else if (Date.now() - waitStarted <= max) {
                setTimeout(waitForC, interval);
            } else {
                onReject(`${message} in ${(Date.now() - waitStarted)} ms`);
            }
        };
        const waitForC = function () {
            const res = conditionFunc();
            if (res instanceof Promise) {
                res.then(r => checkRes(r)).catch(e => onReject(e));
            } else {
                checkRes(res);
            }
        };
        waitForC();
    });
}

function waitForCondition(conditionFunc, interval, max, errorMessage, asFunction) {
    return asFunction
        ? waitForConditionF(conditionFunc, interval, max, errorMessage)
        : waitForConditionF(conditionFunc, interval, max, errorMessage)();
}

/**
 * Wait @time@ for conditionFunc is false
 * @param {function} conditionFunc
 * @param {int} interval
 * @param {int} time
 * @param {string} [errorMessage]
 * @returns {function}
 */
function waitForNotConditionF(conditionFunc, interval, time, errorMessage) {
    const message = typeof errorMessage === 'undefined' ? 'Bad condition is true' : errorMessage;
    return function () {
        return new Promise(function (onSuccess, onReject) {
            const waitStarted = Date.now();
            const checkRes = function (res) {
                if (res === true) {
                    onReject(message + ' in ' + (Date.now() - waitStarted) + ' ms');
                } else if (Date.now() - waitStarted <= time) {
                    setTimeout(waitForC, interval);
                } else {
                    onSuccess('Good!');
                }
            };
            const waitForC = function () {
                const res = conditionFunc();
                if (res instanceof Promise) {
                    res.then(() => checkRes(true)).catch(() => checkRes(false));
                } else {
                    checkRes(res);
                }
            };
            waitForC();
        });
    };
}

/**
 * Wait @time@ for conditionFunc is false
 * @param {function} conditionFunc
 * @param {int} interval
 * @param {int} time
 * @param {string} [errorMessage]
 * @returns {Promise<any>}
 */
function waitForNotCondition(conditionFunc, interval, time, errorMessage) {
    let message = typeof errorMessage === 'undefined' ? 'Bad condition is true' : errorMessage;
    return new Promise(function (onSuccess, onReject) {
        let waitStarted = Date.now();
        let waitForC = function () {
            let res = conditionFunc();
            if (res === true) {
                onReject(message + ' in ' + (Date.now() - waitStarted) + ' ms');
            } else if (Date.now() - waitStarted <= time) {
                setTimeout(waitForC, interval);
            } else {
                onSuccess('Good!');
            }
        };
        waitForC();
    });
}

/**
 * Checks if some or every selectors are presented
 * @param {string[]} sels
 * @param {boolean} [every=false]
 * @param {boolean} [debug=false]
 * @returns {boolean}
 */
function checkSE(sels, every, debug) {
    return sels[(every ? 'every' : 'some')](s => $(s).length > 0
        ? (debug ? dLog('green', 'Helper', `Exists: ${s}`) : null, true)
        : (debug ? dLog('red', 'Helper', `Does not exists: ${s}`) : null, false));
}

/**
 * Finds selector
 * @param {string|string[]} sels
 * @param {boolean} [debug]
 * @returns {string|undefined}
 */
function findSel(sels, debug) {
    const sa = typeof sels === 'string' ? [sels] : sels;
    const found = sa.find(s => $(s).length > 0);
    if (debug) {
        dLog(found ? 'green' : 'red', 'Helper', `Found: ${found}`);
    }
    return found;
}

/**
 * Find selector in the element
 * @param {string[]} sels
 * @param {JQuery} $elem
 * @param {boolean} [debug]
 * @returns {string|undefined}
 */
function findSelIn(sels, $elem, debug) {
    const found = sels.find(s => $elem.find(s).length > 0);
    if (debug) {
        dLog(found ? 'green' : 'red', 'Helper', `Found: ${found}`);
    }
    return found;
}

function elementIsVisible(elem) {
    //if (!(elem instanceof Element)) throw Error('DomUtil: elem is not an element.');
    if (!(elem instanceof Element)) {
        return false;
    }
    const style = getComputedStyle(elem);
    if (style.display === 'none') return false;
    if (style.visibility !== 'visible') return false;
    if (parseFloat(style.opacity) < 0.1) return false;
    if (elem.offsetWidth + elem.offsetHeight + elem.getBoundingClientRect().height +
        elem.getBoundingClientRect().width === 0) {
        return false;
    }
    const elemCenter = {
        x: elem.getBoundingClientRect().left + elem.offsetWidth / 2,
        y: elem.getBoundingClientRect().top + elem.offsetHeight / 2
    };
    if (elemCenter.x < 0) return false;
    if (elemCenter.x > (document.documentElement.clientWidth || window.innerWidth)) return false;
    if (elemCenter.y < 0) return false;
    if (elemCenter.y > (document.documentElement.clientHeight || window.innerHeight)) return false;
    let pointContainer = document.elementFromPoint(elemCenter.x, elemCenter.y);
    do {
        if (pointContainer === elem) return true;
    } while (pointContainer !== null && (pointContainer = pointContainer.parentNode));
    return false;
}

/**
 * Delay in ms
 * @param {number} ms
 * @param {mixed} [throughout]
 * @returns {function}
 */
function delayFunction(ms, throughout) {
    let through = typeof throughout === 'undefined' ? true : throughout;
    return function () {
        return new Promise(function (onSuccess, onReject) {
            setTimeout(function () {
                onSuccess(through);
            }, ms);
        });
    }
}

/**
 * Delay in ms
 * @param ms
 * @param {Object} [throughout]
 * @returns {Promise<any>}
 */
function delayPromise(ms, throughout) {
    let through = typeof throughout === 'undefined' ? true : throughout;
    return new Promise(function (onSuccess, onReject) {
        setTimeout(function () {
            onSuccess(through);
        }, ms);
    });
}

/**
 * Clear element and simulate input
 * @param element {HTMLElement}
 * @param string {string}
 * @param {boolean} [longInput=true] long input, default: true
 * @param {boolean} [fireChange=true] fire change event, default: true
 * @param {boolean} [fireInput=true] fire input event, default: true
 * @param {boolean} [longest=false] longest delay when input, default: false
 * @returns {Promise<boolean>}
 */
function clearAndSimulate(element, string, longInput, fireChange, fireInput, longest) {
    return new Promise(function (onSuccess, onReject) {
        let long = typeof longInput === 'boolean' ? longInput : true;
        let change = typeof fireChange === 'boolean' ? fireChange : true;
        let input = typeof fireInput === 'boolean' ? fireInput : true;
        clearInputElement({
            string: string,
            element: element,
            long,
            longest,
            fireChange: change,
            fireInput: input
        })
            .then(emulateKeyboardLikeHuman)
            .then(() => onSuccess(true))
            .catch((e) => onReject(e));
    });
}

async function clearAndSimulateD(element, string, longInput) {
    const delay = !!!longInput ? 25 : typeof longInput === 'number' ? longInput : 100;
    await clearInputElement({element: element});
    await dType(element, string, false, delay);
}

/**
 * Selects and option in select element
 * source: node_modules/puppeteer/lib/DOMWorld.js -> select
 * @param {Element} element
 * @param {string|string[]} valuesIn
 * @returns {Promise<string[]>}
 */
function selectLikePuppeteer(element, valuesIn) {
    return new Promise((onSuccess, onReject) => {
        const values = typeof valuesIn === 'string' ? [valuesIn] : valuesIn;
        if (element.nodeName.toLowerCase() !== 'select') {
            onReject('Element is not a -select- element.');
            return;
        }
        const options = Array.from(element.options);
        element.value = undefined;
        for (const option of options) {
            option.selected = values.includes(option.value);
            if (option.selected && !element.multiple)
                break;
        }
        element.dispatchEvent(new Event('input', {'bubbles': true}));
        element.dispatchEvent(new Event('change', {'bubbles': true}));
        onSuccess(options.filter(option => option.selected).map(option => option.value));
    });
}

/**
 * Clears and simulate enter
 * Preferred for inputs with type=number
 * @param element - input
 * @param value - string of digits to enter in
 * @returns {Promise<string>}
 */
function clearAndInputNumber(element, value) {
    return new Promise((onSuccess, onReject) => {
        if (element.nodeName.toLowerCase() !== 'input') {
            onReject('Element is not an -input- element.');
            return;
        }
        if (isNaN(parseInt(value))) {
            onReject('Value -' + value + '- is not number.');
            return;
        }
        element.focus();
        element.value = '';
        let s = 0, string = value.toString();
        try {
            let performEnter = function () {
                create_keyboard_event(element, "keydown", string[s]);
                element.value = element.value + string[s];
                create_keyboard_event(element, "keypress", string[s]);
                create_keyboard_event(element, "keyup", string[s]);
                fireInputEvent(element);
                fireChangeEvent(element);
                if (s++ < string.length - 1) {
                    setTimeout(performEnter, getRandomRounded(50, 100));
                } else {
                    element.blur();
                    onSuccess(value);
                }
            };
            performEnter();
        } catch (e) {
            onReject(e);
        }
    });
}

/**
 * Clears and simulate enter
 * Preferred for inputs with type=email
 * @param {HTMLElement} element - input
 * @param {string} value - string of digits to enter in
 * @param {boolean} [doNotCheckEmailValidity] - string of digits to enter in
 * @returns {Promise<string>}
 */
function clearAndInputEmail(element, value, doNotCheckEmailValidity) {
    return new Promise((onSuccess, onReject) => {
        if (element.nodeName.toLowerCase() !== 'input') {
            onReject('Element is not an -input- element.');
            return;
        }
        if (!doNotCheckEmailValidity && value.indexOf('@') === -1) {
            onReject('Value -' + value + '- is not email.');
            return;
        }
        element.focus();
        element.value = '';
        let s = 0, string = value.toString();
        try {
            let performEnter = function () {
                create_keyboard_event(element, "keydown", string[s]);
                element.value = element.value + string[s];
                create_keyboard_event(element, "keypress", string[s]);
                create_keyboard_event(element, "keyup", string[s]);
                fireInputEvent(element);
                fireChangeEvent(element);
                if (s++ < string.length - 1) {
                    setTimeout(performEnter, getRandomRounded(50, 100));
                } else {
                    element.blur();
                    onSuccess(value);
                }
            };
            performEnter();
        } catch (e) {
            onReject(e);
        }
    });
}


/**
 *
 * @param {HTMLElement} element
 * @param {string|number} value
 * @param {boolean} [fireInputAfter]
 * @param {boolean} [fireChangeAfter]
 * @returns {Promise<any>}
 */
function clickSelectAllDeleteEnter(element, value, fireInputAfter, fireChangeAfter) {
    return new Promise(function (onSuccess, onReject) {
        if (!(element instanceof Element)) {
            onReject('clickAndSelectAll: ' + element + ' is not Element!');
        } else {
            mouseChain({target: element, events: ['click']})
                .then(delayFunction(333))
                .then(() => {
                    element.focus();
                    document.execCommand('selectAll', false, null);
                })
                .then(delayFunction(333))
                .then(() => {
                    document.execCommand("delete", false, null);
                })
                .then(delayFunction(333))
                .then(() => emulateKeyboardLikeHuman({
                    string: value,
                    element: element,
                    long: true,
                    allowEmptyString: true
                }))
                .then(() => {
                    if (typeof fireInputAfter === 'boolean' && fireInputAfter && typeof fireChangeAfter === 'boolean' && fireChangeAfter) {
                        return delayPromise(333)
                            .then(() => fireInputEvent(element))
                            .then(delayFunction(100))
                            .then(() => fireChangeEvent(element));
                    } else if (typeof fireInputAfter === 'boolean' && fireInputAfter) {
                        return delayPromise(333)
                            .then(() => fireInputEvent(element));
                    } else if (typeof fireChangeAfter === 'boolean' && fireChangeAfter) {
                        return delayPromise(333)
                            .then(() => fireChangeEvent(element));
                    }
                })
                .then(onSuccess)
                .catch((e) => onReject('clickAndSelectAll: ' + e));
        }
    });
}

/*
delayPromise(3333)
    .then(() => clickSelectAllDeleteEnter( $('#inputC')[0], '330', true))
    .then((m) => console.log(m)).catch((e) => console.error(e));
    */

let waitUntil = function (expression) {
    return new Promise(function (resolve) {
        let checkExpression = function () {
            if (expression())
                resolve();
            else
                setTimeout(checkExpression, 100);
        };
        checkExpression();
    });
};

// Wait until all selectors appear exactly one time
// supports: 1 single selector
//           2 single selector that is child for given
//           array of selectors
//           array of selectors that is child for given

function waitForSelector(context, selector, options) {
    let interval = 200;
    let timeout = null;
    let waitOneOf = false;

    let checkSelector = function (selector, count) {
        return count === 1;
    };

    if (options != null) {
        if (options.interval != null) interval = options.interval;
        if (options.timeout != null) timeout = options.timeout;
        if (options.checkSelector != null) checkSelector = options.checkSelector;
        if (options.waitOneOf === true) waitOneOf = true;
    }

    let simpleSelectors = null;
    let complexSelectors = null;

    if (typeof (selector) === 'string') {
        simpleSelectors = [selector];
    }

    if (typeof (selector) === 'object') {
        if (Array.isArray(selector)) {
            simpleSelectors = selector;
        } else {
            complexSelectors = [selector];
        }
    }

    return new Promise(function (resolve, reject) {
        var start = Date.now();
        let checkSelectors = function () {
            let targetElements = [];
            let everythingAppears = !waitOneOf;

            if (simpleSelectors != null) {
                for (let i in simpleSelectors) {
                    let selector = simpleSelectors[i];
                    if (checkSelector(selector, $(selector).length) || waitOneOf) {
                        if (checkSelector(selector, $(selector).length)) {
                            if (waitOneOf) everythingAppears = true;
                            targetElements.push($(selector)[0]);
                        } else
                            targetElements.push(null);
                    } else {
                        if (!waitOneOf) everythingAppears = false;
                    }
                }
            } else if (complexSelectors != null) {
                for (let i in complexSelectors) {
                    let pair = complexSelectors[i];
                    let selector = pair.selector;
                    let $key = pair.parent;

                    if (checkSelector(selector, $key.find(selector).length) || waitOneOf) {
                        if (checkSelector(selector, $key.find(selector).length)) {
                            if (waitOneOf) everythingAppears = true;
                            targetElements.push($key.find(selector)[0]);
                        } else
                            targetElements.push(null);
                    } else {
                        if (!waitOneOf) everythingAppears = false;
                    }
                }
            }
            if (everythingAppears) {
                if (context != null) {
                    context.elements = targetElements;
                }
                resolve();
            } else {
                if ((timeout != null) && (Date.now() - start > timeout)) {
                    reject('Timeout while waiting elements: ' + JSON.stringify(selector));
                } else {
                    setTimeout(checkSelectors, interval);
                }
            }
        };
        checkSelectors();
    });
}

/**
 * Waits for element visible, delays after it shown and then clicks it
 * @param {string|function} selector for element or function returns JQuery object
 * @param {null|number} [maxWaitIn] default 10000
 * @param {null|string[]} [eventsIn] default ['click]
 * @param {null|number} [delayIn] default 3333
 * @param {boolean} [visibleParam] default true
 * @param {boolean} [useDebugger] default true
 * @returns {Function}
 */
function waitDelayClickF(selector, maxWaitIn, eventsIn,
                         delayIn, visibleParam, useDebugger) {
    const maxWait = typeof maxWaitIn === 'number' ? maxWaitIn : 10000;
    const delay = typeof delayIn === 'number' ? delayIn : 3333;
    const events = eventsIn && Array.isArray(eventsIn) ? eventsIn : ['mouseover', 'mousedown', 'click', 'mouseup'];
    const visible = typeof visibleParam === 'boolean' ? visibleParam : true;
    return async () => {
        const $el = await waitForElement(selector, 333, maxWait, visible);
        await delayPromise(delay);
        if (useDebugger) {
            await dClick($el[0], true, 'waitDelayClickF');
        } else {
            await mouseChain({target: $el[0], events: events, scroll: true, error: 'waitDelayClickF'});
        }
    }
}

/**
 * Waits for element visible, delays after it shown and then clicks it
 * @param {string|function} selector for element or function returns JQuery object
 * @param {number} [delay=3000]
 * @param {boolean} [visible=true]
 * @param {number} [maxWait=10000]
 * @param {boolean} [useDebugger=false]
 * @returns {Promise<void>}
 */
async function waitDelayClick(selector, delay, visible, maxWait, useDebugger) {
    const $el = await waitForElement(selector, 333, maxWait || 10000,
        typeof visible === 'boolean' ? visible : true);
    await delayPromise(delay || 3000);
    if (useDebugger) {
        await dClick($el[0], true, 'waitDelayClick');
    } else {
        await mouseChain({
            target: $el[0], events: fullClick, scroll: true,
            error: `WDC: ${selector}`
        });
    }
}


function wait(timeout) {
    return function () {
        return new Promise(function (resolve, reject) {
            setTimeout(resolve, timeout);
        });
    }
}

let multiplySelectorValues = function ($odds) {
    let m = 1;
    $odds.each(function () {
        if (decOdds($(this).text().trim()) > 0)
            m = m * decOdds($(this).text().trim());
    });
    return m;
};

function closeThisTabByCondition(condition, maxWait) {
    return new Promise(onSuccess => chrome.runtime.sendMessage({
        closeThisByCondition: condition,
        maxTimeout: maxWait,
    }, onSuccess));
}

function bsEmailCheck(address, pattern, timestamp) {
    console.log('%cbsEmailCheck, ' + address + ', ' + pattern + ', ' + timestamp, 'background: green; color: white; font-weight: bold;');
    return new Promise(function (onSuccess, onReject) {
        chrome.runtime.sendMessage(
            {
                backgroundSpecialAction: 'ajaxUrl',
                url: 'email',
                data: {
                    action: 'CHECK_MAILBOX_FOR_PATTERN',
                    data: JSON.stringify({
                        address: address,
                        pattern: pattern,
                        timestamp: timestamp
                    })
                }
            },
            (response) => {
                dLog('green', 'bsEmailCheck',
                    [`responseCallback: ${response.success}`, response]);
                if (response.success) {
                    onSuccess(response.message);
                } else {
                    onReject(response.message);
                }
            });
    });
}

/**
 * Hint: It is also used to request a withdrawal, pattern STAKE_WITHDRAWAL_REQUEST_71032,
 *      address: withdrawal wallet address
 * Check email for pattern or patterns after timestamp
 * @param address {string}
 * @param pattern {string|string[]}
 * @param timestamp {number} - could be -1 for all history
 * @param [debug] {bool} - default - false
 * @param [balance] {number} - account balance for STAKE_WITHDRAWAL_REQUEST_71032
 * @returns {Promise<Object>|Promise<null>}
 * @return Object.data - code {string}
 * @return Object.email_id - email_id {number}
 * Object: {pattern: {data: string, email_id: number}}
 * {
 *      {STAKE_WELCOME: {data: 'https://bla-bla', email_id: 1},
 *      {STAKE_WITHDRAW_CODE: {data: '766112', email_id: 2}
 * }
 */
function bsNewEmailCheck(address, pattern, timestamp, debug, balance) {
    dLog('green', 'helper', `bsNewEmailCheck, ${address}, ${pattern}, ${timestamp}`);
    return new Promise(function (onSuccess, onReject) {
        const answer = (good, m) => {
            if (!!debug) {
                dLog(good ? 'green' : 'red', 'bsNewEmailCheck',
                    typeof m === 'object' ? ['answer:', m] : `answer: ${m}`);
            }
            good ? onSuccess(m) : onReject(m);
        }
        const preparedData = {
            address: address,
            pattern: pattern,
            timestamp: timestamp,
        };
        if (address.indexOf('outlook.com') > -1) {
            preparedData.overrideTimeout = 150000;
        }
        if (pattern === 'STAKE_WITHDRAWAL_REQUEST_71032' && typeof balance === 'number') {
            preparedData.balance = balance;
        }
        chrome.runtime.sendMessage(
            {
                backgroundSpecialAction: '_checkMail',
                data: {
                    action: 'CHECK_MAILBOX_FOR_PATTERN',
                    data: JSON.stringify(preparedData),
                }
            },
            (response) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    dLog('red', 'bsNewEmailCheck',
                        ['responseCallback chrome.runtime.lastError: ', error]);
                    onReject(error);
                    return;
                }
                if (!!debug) {
                    dLog('green', 'bsNewEmailCheck', [`responseCallback ():`, response]);
                }
                // Hint: success here just means that there were no errors of communication
                if (response?.success && response?.message) {
                    /**
                     * possible variants:
                     * {success: true, message: 'Mailbox esmisagla1987@yahoo.com not found!'}
                     * {success: true, message: '[]'}
                     * {success: true, message: '[{"data":"766112","email_id":2}]'}
                     * {
                     *     "success": true,
                     *     "message": "{\"STAKE_WELCOME\":{\"data\":\"http://url143.stake.com/bla-bla-bla\",
                     *      \"email_id\":1},\"STAKE_WITHDRAW_CODE\":{\"data\":\"766112\",\"email_id\":2}}"
                     * }
                     * {
                     *     "success": true,
                     *     "message": "{\"STAKE_WITHDRAW_CODE\":{\"data\":\"766112\",\"email_id\":2}}"
                     * }
                     *
                     */
                    if (pattern === 'STAKE_WITHDRAWAL_REQUEST_71032'
                        && response.message.indexOf('not found') > -1) {
                        answer(false, response.message);
                    } else if (pattern === 'STAKE_WITHDRAWAL_REQUEST_71032') {
                        answer(true, response.message);
                    } else {
                        try {
                            const parsed = JSON.parse(response.message);
                            if (typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                                answer(true, parsed);
                            } else {
                                answer(true, null);
                            }
                        } catch (e) {
                            console.log('JSON not parsed:');
                            console.log(response.message);
                            answer(false, `Parse JSON error: ${e}, ${formatStack(e.stack)}`);
                        }
                    }
                } else {
                    answer(false, response?.message || `Bad message: ${response}`);
                }
            });
    });
}

function getBoxOffset(querySelector) {
    return new Promise(function (success) {
        chrome.runtime.sendMessage({getFrameOffset: querySelector}, r => {
            if (r && r.model && r.model.content) {
                // Top Left corner x and y
                success({x: r.model.content[0], y: r.model.content[1]});
            } else {
                success(null);
            }
        });
    });
}

function nestedOffset(parentOffset, selOrElem) {
    try {
        const offset = (typeof selOrElem === 'string' ? $(selOrElem).get(0) : selOrElem).getBoundingClientRect();
        return {x: parentOffset.x + offset.x, y: parentOffset.y + offset.y};
    } catch (e) {
        throw `nestedOffset: ${e} => ${parentOffset} - ${selOrElem}`;
    }
}

/**
 * Performs type with debugger in the current tab:
 * 1. Move mouse to element and click there
 * 2. Send keys
 * 3. If specified - send <enter>
 * @param {HTMLElement} elem
 * @param {string} text
 * @param {boolean} [enter] - default no
 * @param {number} [delay] - default 25ms
 * @returns {Promise<boolean>}
 */
async function dType(elem, text, enter, delay) {
    try {
        let res = text === '' && enter || await dClick(elem, false, 'dType');
        res = res && (text === '' && enter || await bsType('sender', text, delay || 25));
        if (res && enter) {
            res = await bsSendEnter('sender');
        }
        return res;
    } catch (e) {
        dLog('red', 'HELPER', `Error till dType: ${e}, ${formatStack(e.stack)}`);
        return false;
    }
}

class CoordsObject {
    constructor(props) {
        this.x = props.x;
        this.y = props.y;
    }
}

/**
 * Performs mouse click with debugger in the current tab:
 * 1. Move mouse
 * 2. Mouse left key down
 * 3. Mouse left key up
 * @param {HTMLElement|CoordsObject|string} [elem] - element or { x: abscissa, y: ordinate } or JS for querySelector
 * @param {boolean} [scroll]
 * @param {string|boolean} [debug] - show debug information, marked with <debug>
 * @param {CoordsObject|function|boolean} [iframe] - if we're in an iframe and need offsets
 * @param {boolean} [scrollFalse]
 * @returns {Promise<boolean>}
 */
async function dClick(elem, scroll, debug, iframe, scrollFalse, offsetX) {
    const
        isDomEntity = entity => typeof entity === 'object' && entity.nodeType !== undefined,
        offX = offsetX || 0;
    if (!elem || (!isDomEntity(elem) && !elem.x && !elem.y)) {
        throw `elem or x and y must be specified in ${debug}!`;
    }
    try {
        if (scroll && elem) {
            if (!!scrollFalse) {
                elem.scrollIntoView(false);
            } else {
                elem.scrollIntoView();
            }
        }
        const coords = isDomEntity(elem)
            ? {
                x: elem.getBoundingClientRect().left + elem.offsetWidth / 2,
                y: elem.getBoundingClientRect().top + elem.offsetHeight / 2
            } : elem;
        if (typeof iframe === 'object') {
            coords.x += iframe.x;
            coords.y += iframe.y;
        } else if (typeof iframe === 'function') {
            const iframeRes = await iframe();
            coords.x += iframeRes.x;
            coords.y += iframeRes.y;
        }
        if (debug) {
            dLog('', 'CLICK', `Attempting to click to ${debug} at ${coords.x}, ${coords.y}`);
        }
        if ([coords.x, coords.y].some(t => isNaN(t) || t === 0)) {
            dLog('red', 'CLICK', [`BAD COORDINATES (${debug}): ${coords.x}, ${coords.y} for:`,
                elem]);
            return false;
        }
        return await bsSendMouseClick('sender', coords.x + offX, coords.y, debug);
    } catch (e) {
        dLog('red', 'HELPER', `Error till dClick: ${e}, ${formatStack(e.stack)}`);
        return false;
    }
}

async function dClickOffsetX(elem, offsetX) {
    return dClick(elem, false, false, false, false, offsetX);
}

function bsSendEnter(bk) {
    console.log('%cbsSendEnter', 'background: green; color: white; font-weight: bold;');
    return new Promise(function (onSuccess, onReject) {
        chrome.runtime.sendMessage({pressEnter: true, bk: bk},
            (r) => {
                onSuccess(r);
            });
    });
}

function bsType(bk, text, delay) {
    //console.log('%c' + `bsType ${text} for ${bk} with delay ${delay} ms`,
    //    'background: green; color: white; font-weight: bold;');
    return new Promise(function (onSuccess) {
        chrome.runtime.sendMessage({pType: text, bk: bk, typeDelay: delay || 0},
            (r) => {
                onSuccess(r);
            });
    });
}

function bsSendMouseClick(bk, x, y, debug) {
    if (debug) {
        dLog('background: lightblue; color: darkgreen; font-size: 10px; font-weight: bold; padding: 3px 10px;',
            'Helper', `Debugger click (${bk}/${debug}) to ${x} x ${y}`);
    }
    return new Promise(function (onSuccess, onReject) {
        chrome.runtime.sendMessage({mouseClickEvent: true, bk: bk, meX: x, meY: y, debug: debug}, (r) => {
            onSuccess(r);
        });
    });
}

/**
 * Produces sequence of events via Debugger
 * @param {string} bk - to determine the tab
 * @param {Object[]} events to produce in format:
 *  { type: selector|function|keyCode|keyFunction, body: selector or function contents or key code }
 * @param {number} [timeoutIn] - delay between clicks
 * @returns {Promise<String>}
 */
function bsDebuggerEventsChain(bk, events, timeoutIn) {
    let timeout = typeof timeoutIn === 'number' ? timeoutIn : 3333;
    console.log('%cbsDebuggerEventsChain', 'background: green; color: white; font-weight: bold;');
    return new Promise(function (onSuccess, onReject) {
        chrome.runtime.sendMessage({debuggerEventsChain: events, bk: bk, timeout}, (r) => {
            //console.log('%c -= ??? FINISHED ??? =-', 'background: purple; color: yellow; padding: 3px;');
            //console.log((new Error()).stack);
            onSuccess(r);
        });
    });
}

function bsSendSmsApi(port, action, data) {
    port.postMessage({
        m: "SMS_API_SEND",
        toSend: {
            action: action,
            data
        },
    });
}

/**
 *  Wait for message from smsApi
 * @param {object} port
 * @param {smsApiMessageProto} smsApiMessage
 * @param {object} settings
 * @param {object} ourCommand
 * @param {string} command
 * @param {number} [interval]
 * @param {number} [max]
 * @returns {Promise<any>}
 */
function bsSmsApiCheckWait(port, smsApiMessage, settings, ourCommand, command, interval, max) {
    interval = interval || 15000;
    max = max || 360000;
    return new Promise(function (onSuccess, onReject) {
        let waitStarted = Date.now();
        let checkMessages = function () {
            smsApiMessage.clear();
            bsSendSmsApi(port, 'CHECK', {
                "websocket_uid": settings.uid,
                "request_id": ourCommand.getAdded('sms_api_request_id'),
            });
            waitForCondition(() => {
                return smsApiMessage.hasMessage;
            }, 333, 20000, 'No SMS API response for 20s')
                .then(() => {
                    bsDebug(port, 'CHECK: ' + smsApiMessage.status, smsApiMessage.message);
                    if (smsApiMessage.status !== 'success') {
                        onReject('Check error: ' + smsApiMessage.status + ' / ' + smsApiMessage.message);
                        smsApiMessage.clear();
                    } else {
                        if (typeof smsApiMessage.message === 'object' && typeof smsApiMessage.message.length === 'number'
                            && smsApiMessage.message.length > 0) {
                            for (let j in smsApiMessage.message) {
                                console.log(smsApiMessage.message[j]);
                                if (typeof smsApiMessage.message[j] !== 'undefined'
                                    && typeof smsApiMessage.message[j].command === 'string'
                                    && smsApiMessage.message[j].command === command) {
                                    onSuccess(smsApiMessage.message);
                                    smsApiMessage.clear();
                                }
                            }
                        } else if (Date.now() - waitStarted < max) {
                            smsApiMessage.clear();
                            delayPromise(interval).then(checkMessages);
                        } else {
                            onReject('Waited for ' + command + ' for ' + (Date.now() - waitStarted) + 'ms and nothing :(');
                        }
                    }
                })
                .catch((e) => onReject('Error till check: ' + e));
        };
        checkMessages();
    });
}

/**
 *
 * @param port
 * @param settings
 * @param {smsApiMessageProto} smsApiMessage
 * @param ourCommand
 * @returns {Promise<any>}
 */
async function bsBindNumber(port, settings, smsApiMessage, ourCommand) {
    smsApiMessage.clear();
    bsSendSmsApi(port, 'BIND_HOLD', {"websocket_uid": settings.uid, "number": settings.phone});
    await delayPromise(1111);
    await waitForCondition(() => smsApiMessage.hasMessage, 333, 10000, 'No SMS API response for 10s');
    //bsDebug(port, 'SmsApi: ' + smsApiMessage.status, smsApiMessage.message);
    if (smsApiMessage.status !== 'success') {
        let error = `Can't hold number: ${smsApiMessage.status} / ${smsApiMessage.message}`;
        smsApiMessage.clear();
        throw error;
    } else {
        ourCommand.add('sms_api_request_id', smsApiMessage.message);
        smsApiMessage.clear();
    }
    dLog('green', 'Helper', 'BIND_HOLD successfully sent!');
    await delayPromise(3000);
    return await bsSmsApiCheckWait(port, smsApiMessage, settings, ourCommand, 'BOUND');
}

function marketsModifier(data, input, params) {
    let output = input;
    let additions = params['additions'] || {};
    let specialAdditions = params['specialAdditions'] || {
        condition: [],
        func: () => {
        }
    };
    let needChange = params['needChange'] || [];
    let needRemove = params['needRemove'] || [];
    let replacements = params['replacements'] || [];
    let needAddTo = params['needAddTo'] || false;
    if (needChange.indexOf(input) > -1) {
        output = typeof additions[data.time_value] === 'string'
            ? (additions[data.time_value] + ' ' + output) : output;
    } else if (needRemove.indexOf(input) > -1) {
        output = 'It must to be removed!';
    }
    if (specialAdditions.condition.indexOf(input) > -1) {
        console.log('Added for ' + input);
        output += ' ' + specialAdditions.func();
    }
    replacements.forEach((item) => {
        output = output.replace(item.from, item.to);
    });
    return {
        output: output,
        additions: needAddTo,
        addToBeginning: params['needAddToBeginning'] || false
    };
}

function marketsModifierWrapper(data, part, params, markets) {
    for (const mmm of Object.keys(markets)) {
        for (const ttt of Object.keys(markets[mmm])) {
            if (params['totals']) {
                markets[mmm][ttt][part] = params['totals'];
            } else if (typeof markets[mmm][ttt][part] !== 'undefined') {
                markets[mmm][ttt][part].forEach((root, idx) => {
                    let needModify = marketsModifier(data, root, params);
                    if (needModify.output === 'It must to be removed!') {
                        delete markets[mmm][ttt][part][idx];
                    } else {
                        markets[mmm][ttt][part][idx] = needModify.output;
                    }
                    if (typeof needModify.additions !== 'undefined' && needModify.additions !== false) {
                        needModify.additions.forEach((value) => {
                            if (needModify.addToBeginning) {
                                markets[mmm][ttt][part].unshift(value);
                            } else {
                                markets[mmm][ttt][part].push(value);
                            }
                        });
                    }
                });
                if (params['addTo']) {
                    params['addTo'].forEach(t => markets[mmm][ttt][part].push(t));
                }
            }
        }
    }
}

/**
 * Replacement for multiple markets
 * @param {Object} data
 * @param {string[]} parts
 * @param {AllMarkets} params
 * @param {Object} markets
 */
function marketsModifierAll(data, parts, params, markets) {
    for (const part of parts) {
        marketsModifierWrapper(data, part, params.get(part), markets);
    }
}

function getBase64Image(img, asJpeg) {
    var canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    var dataURL = asJpeg ? canvas.toDataURL("image/jpeg") : canvas.toDataURL("image/png");
    return dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
}

function takeAndSendScreenshot(bk, selector, tag, name, description) {
    return new Promise((onSuccess, onReject) => {
        const doStuff = () => {
            html2canvas($(selector).get(0))
                .then(canvas => canvas.toDataURL('image/jpeg'))
                .then(image => chrome.runtime.sendMessage(
                    {
                        backgroundSpecialAction: 'ajaxUrl',
                        url: 'screenshot',
                        data: {
                            action: 'UPLOAD_SCREENSHOT',
                            image: image,
                            tag: tag,
                            name: name,
                            description: description
                        }
                    },
                    response => {
                        console.log('%c responseCallback: ' + response.success, 'background: green; color: white; font-weight: bold;');
                        console.log(response);
                        if (response.success) {
                            onSuccess(response.message);
                        } else {
                            onReject(response.message);
                        }
                    }))
                .catch(e => onReject('takeAndSendScreenshot: ' + e));
        };
        if (typeof html2canvas === 'undefined') {
            bsInclude('libs/html2canvas.min.js', bk)
                .then(doStuff);
        } else {
            doStuff();
        }
    });
}

function saveHtml(fileName, html) {
    return new Promise((onSuccess, onReject) => {
        chrome.runtime.sendMessage({
            saveHtmlFileName: fileName,
            saveHtml: html,
        }, response => {
            console.log('%c saveHtml: ' + response.success, 'background: green; color: white; font-weight: bold;');
            console.log(response);
            if (response.success) {
                onSuccess(response.message);
            } else {
                onReject(response.message);
            }
        });
    });
}

function bsInclude(file, bk) {
    return new Promise((onSuccess) => {
        chrome.runtime.sendMessage({includeFile: file, bk: bk}, onSuccess);
    });
}

/**
 * Take screenshot and send it to server
 * @param {object} port
 * @param {string} bk
 * @param {string|string[]} selector
 * @param {object} [data]
 */
function screenshotHelper(port, bk, selector, data) {
    const rep = (success, message) => {
        port.postMessage({
            answered: "takeScreenshot",
            status: success ? "success" : "error",
            answer: message
        });
    };
    const d = typeof data === 'object' ? data : {};
    const selectors = typeof selector === 'string' ? [selector] : selector;
    const s = selectors.filter(val => $(val).length > 0);
    if (s.length > 0) {
        takeAndSendScreenshot(bk, s[0],
            d.tag ? d.tag : bk,
            d.name ? d.name : 'Test screenshot ' + Date.now(),
            d.description ? d.description : 'Collected at ' + (new Date).toLocaleString()
        )
            .then(m => rep(true, 'Must be saved! ' + JSON.stringify(m)))
            .catch(e => rep(false, 'Error: ' + e));
    } else {
        rep(false, "There is no element :(");
    }
}

/**
 * String odds to float calculating english odds format to decimal
 * @param {string} odds
 * @returns {number}
 */
function decOdds(odds) {
    if (odds.indexOf('/') > -1) {
        return floorToPrecision(1 + (odds.split('/')[0].trim() / odds.split('/')[1].trim()), 2, true);
    } else {
        return parseFloat(odds);
    }
}

/**
 * Floor to precision
 * @param {number} val
 * @param {number} precision
 * @param {boolean} [ceil] - round ceil, otherwise floor
 * @returns {number}
 */
function floorToPrecision(val, precision, ceil) {
    const round = precision === 0 ? 1 : Math.pow(10, precision);
    if (!ceil) {
        return Math.floor(val * round) / round;
    } else {
        return Math.ceil(val * round) / round;
    }
}

/**
 * Rounds val to
 * @param {number} val
 * @param {number} roundTo
 * @param {boolean} [ceil] - round ceil, otherwise floor
 * @returns {number}
 */
function roundTo(val, roundTo, ceil) {
    if (!ceil) {
        return Math.floor(val / roundTo) * roundTo;
    } else {
        return Math.ceil(val / roundTo) * roundTo;
    }
}

/**
 * Add or request blocked UMoney codes
 * @param account_id
 * @param code
 */
function blockedCodes(account_id, code) {
    return new Promise((onSuccess, onReject) => {
        chrome.runtime.sendMessage(
            {
                backgroundSpecialAction: 'blockedCodes',
                blocked_action: code
                    ? `add-blocked?account_id=${account_id}&code=${code}`
                    : `get-blocked?account_id=${account_id}`,
            },
            response => {
                console.log('%c responseCallback: ' + response.success, 'background: green; color: white; font-weight: bold;');
                console.log(response);
                if (response.success) {
                    const res = JSON.parse(response.message);
                    onSuccess(res.message);
                } else {
                    onReject(response.message);
                }
            });
    });
}

function parseDCodes(draft) {
    return draft.split(',').map(v => v.trim().replace(/^\d+./g, '').trim());
}

/**
 * Search by selector in the key of needClose object, close by selector of it's value
 * @param {Object} needClose
 * @param {boolean} [useDebugger]
 * @returns {Promise<void>}
 */
async function closeAllWeNeed(needClose, useDebugger) {
    await Object.keys(needClose).forEachAsync(async (sel) => {
        if ($(sel).length > 0 && elementIsVisible($(sel)[0])) {
            console.log('%c' + `Closing ${sel}`, 'background: lightyellow; color: gray; font-size: 12px; font-weight: bold; padding: 3px;');
            if (useDebugger) {
                await dClick($(needClose[sel])[0], false, 'closeAllWeNeed');
            } else {
                await mouseChain({
                    target: $(needClose[sel])[0],
                    events: ['mouseover', 'mousedown', 'click', 'mouseup']
                });
            }
            await delayPromise(1000);
        }
    }).catch(e => console.error(`closeAllWeNeed: ${e}`));
}

class QueueObject {
    /**
     * Creates queue object
     * @param {string|string[]|function} selector - JQuery selector to check and click (if no action)
     * @param {function|null} [condition] - condition function($(selector)), if not present, then $(selector).length > 0
     * @param {string|function|null} [action] - element (selector or result of function()) for action, if not present - uses selector
     * @param {boolean|null} [noClick] - if true, then do not click (in mind: action function does all stuff)
     * @param {number|null} [needWait] - if we need wait for selector, ms
     * @param {boolean|null} [continueIfNoElement] - break or not execution if no element
     * @param {boolean|null} [debug] - if we needs in debug messages
     */
    constructor(selector, condition, action, noClick, needWait,
                continueIfNoElement, debug) {
        this.selector = selector;
        this.condition = condition || null;
        this.action = action || null;
        this.noClick = noClick || null;
        this.needWait = needWait || 0;
        this.continueIfNoElement = continueIfNoElement || false;
        this.debug = debug || false;
    }
}

/**
 * Performs sequence of checks and actions
 * @param {QueueObject[]} queue - array of objects like
 * @param {number|null} [delayOverride] - if we need perform another delay, default 3000
 * @param {number|null} [initialDelay] - delay before we'll start, default 500
 * @param {boolean} [profiling] - if we need to track execution, default false
 * @param {boolean} [useDebugger]
 * @param {number|null} [intervalOverride] - delay before getTarget, default = 1000
 * @param {number|null} [beforeTargetDelay] - delay before getTarget, default = 1000
 * @return {Promise<void>}
 */
async function clickSequence(queue, delayOverride, initialDelay,
                             profiling, useDebugger, intervalOverride, beforeTargetDelay) {
    const started = Date.now();
    const delay = delayOverride || 3000;
    const delayInitial = initialDelay || 500;
    const intv = intervalOverride || 333;
    const btDelay = beforeTargetDelay || 1000;
    const profile = message => profiling ? console.log(message) : null;
    const getTarget = async (qObj, $el) => {
        if (!qObj.action) {
            return await waitForElement(qObj.selector, intv, 30000);
        } else if (typeof qObj.action === 'string') {
            return await waitForElement(qObj.action, intv, 30000);
        } else if (typeof qObj.action === 'function') {
            const res = qObj.action($el);
            return res instanceof Promise ? await res : res;
        }
    };
    $(window).scrollTop(0);
    await delayPromise(delayInitial);
    await queue.forEachAsync(async (qObj) => {
        const started = Date.now();
        if (qObj.debug) {
            bsLogger('blue', 'Helper', `Processing: '${qObj.selector}'`);
        }
        const $el = qObj.needWait === 0
            ? (typeof qObj.selector === 'function' ? qObj.selector() : $(findSel(qObj.selector)))
            : await waitForElement(qObj.selector,
                intv, qObj.needWait)
                .catch(e => {
                    if (qObj.debug) {
                        bsLogger('red', 'Helper', e);
                    }
                    return $([]);
                });
        if ($el.length === 0 && !qObj.continueIfNoElement) {
            throw `Where is no element: ${qObj.selector}`;
        } else if ($el.length === 0) {
            bsLogger('red', 'Helper', `Where is no element: ${qObj.selector}, but we continue`);
            return;
        }
        const conditionOne = qObj.condition && typeof qObj.condition === 'function' && qObj.condition($el);
        const conditionTwo = !qObj.condition && $el.length > 0;
        if (conditionOne || conditionTwo) {
            await delayPromise(btDelay);
            const $target = await getTarget(qObj, $el);
            if (!qObj.noClick) {
                if (useDebugger) {
                    await dClick($target[0], true, 'clickSequence');
                } else {
                    await mouseChain({
                        target: $target[0],
                        events: fullClick,
                        scroll: true,
                        error: `Click: ${qObj.selector}`
                    });
                }
            }
            await delayPromise(delay);
            profile(`We delaying ${delay} for ${qObj.selector} (${conditionOne}/${conditionTwo})`);
        }
        profile(`It takes ${(Date.now() - started)} for ${qObj.selector}`);
    });
    profile(`It takes ${(Date.now() - started)} for all`);
}

/**
 * -------------------------------------------------------------------------------------------------------------------------------
 * START OF CLASSES
 */

/**
 * @constructor
 */
function ourCommandProto() {
    this._message = {};
    this.isSet = function () {
        return !(Object.keys(this._message).length === 0 && this._message.constructor === Object);
    };
    this.set = function (message) {
        //bsDebug(port, 'SET SET SET', message);
        this.clear();
        this._message = message;
    };
    this.add = function (name, value) {
        this._message[name] = value;
    };
    this.getAdded = function (name, defaultValue) {
        return typeof this._message[name] === 'undefined' ? (defaultValue || false) : this._message[name];
    };
    this.get = function () {
        return this._message;
    };
    this.clear = function () {
        this._message = {};
    };
    this.saveCommandForFurtherUse = function (prefix) {
        let self = this;
        return new Promise(function (onSuccess, onReject) {
            let storeData = {};
            storeData[prefix + '_COMMAND'] = self.get();
            storeData[prefix + '_COMMAND_WAS_SET'] = self.getAdded('increaseDelay') ? Date.now() + 150000 : Date.now();
            chrome.storage.local.set(storeData, function () {
                onSuccess();
            });
        });
    };
    this.save = async (prefix, increaseDelay) => {
        if (this.isSet()) {
            await bMess(prefix).set(this.get(), typeof increaseDelay === 'number' ? increaseDelay : 0);
        }
    };
    this.toString = function () {
        return this.isSet() ? JSON.stringify(this._message) : 'Not set!';
    };
}

class AllMarkets {
    constructor(data) {
        this._clear();
        this.data = data;
        this.proceed_football = function (data) {
        };
        this.proceed_tennis = function (data) {
        };
        this.proceed_hockey = function (data) {
        };
        this.proceed_volleyball = function (data) {
        };
        this.proceed_baseball = function (data) {
        };
        this.proceed_basketball = function (data) {
        };
        this.proceed_handball = function (data) {
        };
        this.proceed_tabletennis = function (data) {
        };
        this.proceed_cybersport = function (data) {
        };
    }

    _clear() {
        // digit from period/quarter, etc. ex: then PERIOD_3 will be 3
        this.tDigit = '';
        // tDigit translated to addition, ex: 3 to rd
        this.th = '';
        // tDigit translated to text, ex: 3 to Third
        this.tht = '';
        this.replacements = {};
        this.replacementsIn = {};
        this.needRemove = {};
        // For total replace of all children
        this.totals = {};
        this.addToObject = {};
        this.specialAdditions = {};
        this.addToElement = {};
        this.addToBeginningOfTheElement = {};
    }

    /**
     * Shortcut to addReplacement
     * @param {string} type
     * @param {string} from
     * @param {string} to
     */
    addRepl(type, from, to) {
        this.addReplacement(type, from, to);
    }

    /**
     * Shortcut to addReplacementIn
     * @param {string} type
     * @param {string} from
     * @param {string} to
     */
    addReplIn(type, from, to) {
        this.addReplacementIn(type, from, to);
    }

    /**
     * Replace "from" to "to" in the "type" array
     * @param {string} type
     * @param {string} from
     * @param {string} to
     */
    addReplacement(type, from, to) {
        if (!this.replacements[type]) {
            this.replacements[type] = [];
        }
        this.replacements[type].push({from, to});
    }

    /**
     * Replace "from" to "to" in the elements of "type" array
     * @param {string} type
     * @param {string} from
     * @param {string} to
     */
    addReplacementIn(type, from, to) {
        if (!this.replacementsIn[type]) {
            this.replacementsIn[type] = [];
        }
        this.replacementsIn[type].push({from, to});
    }

    /**
     * Removes "text" element from the "type" array
     * @param {string} type
     * @param {string} text
     */
    addRemove(type, text) {
        if (!this.needRemove[type]) {
            this.needRemove[type] = [];
        }
        this.needRemove[type].push(text);
    }

    /**
     *  Fully replaces the "type" with "replacement"
     * @param {string} type
     * @param {any} replacement
     */
    addTotal(type, replacement) {
        this.totals[type] = replacement;
    }

    /**
     * Adds "text" to the "type" array
     * @param {string} type
     * @param {string} text
     */
    addTo(type, text) {
        if (!this.addToObject[type]) {
            this.addToObject[type] = [];
        }
        this.addToObject[type].push(text);
    }

    /**
     * Adds "text" to the end (or to the beginning) of all elements in the type
     * @param {string} type
     * @param {string} text
     * @param {boolean} [toBeginning] - default false
     */
    addToEl(type, text, toBeginning) {
        this.addToElement[type] = text;
        if (toBeginning) {
            this.addToBeginningOfTheElement[type] = true;
        }
    }

    /**
     * Adds to all elements matching condition in the "type" array space and result of the "func"
     * ex: condition ['Winner'], function () => '1st half', will replace Winner with Winner 1st half
     * @param {string} type
     * @param {string[]} condition
     * @param {function} func
     * @param {boolean} [toBeginning] - default false
     */
    addSpecial(type, condition, func, toBeginning) {
        this.specialAdditions[type] = {
            condition,
            addToBeginning: toBeginning || false,
            func,
        };
    }

    calcTh(digit) {
        const d = parseInt(digit);
        return !isNaN(d) ? d < 4 ? ['st', 'nd', 'rd'][d - 1] : 'th' : '';
    }

    calcTht(digit) {
        const d = parseInt(digit);
        return !isNaN(d) ? d < 4 ? ['First', 'Second', 'Third'][d - 1] : 'Fourth' : '';
    }

    get(type) {
        this._clear();
        if (this.data.time_value.indexOf('_GAME_') > -1) {
            const parts = this.data.time_value.split('_GAME_');
            this.tDigit = parseInt(parts[0].replace(/\D/g, ''));
        } else {
            this.tDigit = parseInt(this.data.time_value.replace(/\D/g, ''));
        }
        this.mDigit = this.data.market.replace(/\D/g, '');
        this.hDigit = this.data.target === 'HOME' ? 1 : 2;
        this.th = this.calcTh(this.tDigit);
        this.tht = this.calcTht(this.tDigit);
        this.full = this.data.time_value.indexOf('FULL') > -1;
        this[`proceed_${this.data.sport.toLowerCase()}`](this.data);
        return {
            // The branch
            totals: this.totals[type] || null,
            addTo: this.addToObject[type] || [],
            // The element
            needRemove: this.needRemove[type] || [],
            replacements: this.replacements[type] || [],
            replacementsIn: this.replacementsIn[type] || [],
            addToElements: this.addToElement[type] || false,
            addToElementsBeginning: this.addToBeginningOfTheElement[type] || false,
            specialAdditions: this.specialAdditions[type] || {
                condition: [],
                addToBeginning: false,
                func: () => {
                }
            },
        };
    }
}

/**
 *
 * @param {Object} data
 * @param {string[]} types
 * @param {AllMarkets} params
 * @param {Object} markets
 * @param {boolean} [noSpace] - when we don't need spaces in additions, default - false
 * @param {boolean} [debug]
 * @returns {Object}
 */
function applyAllMarkets(data, types, params, markets, noSpace, debug) {
    const final = JSON.parse(JSON.stringify(markets));
    for (const type of types) {
        const mod = params.get(type);
        if (debug) {
            console.log('%c ' + `mod for ${type}:`,
                'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            console.log(mod);
        }
        for (const market of Object.keys(final)) {
            for (const target of Object.keys(final[market])) {
                if (debug) {
                    console.log('%c' + `Working with ${market}/${target}`,
                        'background: orange; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    console.log(JSON.parse(JSON.stringify(final[market][target][type])));
                }
                if (mod['totals']) {
                    // Hint: replace the branch fully
                    final[market][target][type] = JSON.parse(JSON.stringify(mod['totals']));
                    if (debug) {
                        console.log(`totals processed!`);
                    }
                }
                if (mod.addTo && Array.isArray(mod.addTo) && mod.addTo.length > 0) {
                    // Hint: add values to the branch
                    if (!final[market][target][type] || !Array.isArray(final[market][target][type])) {
                        final[market][target][type] = [];
                    }
                    mod['addTo'].forEach(t => final[market][target][type].push(t));
                    if (debug) {
                        console.log(`addTo processed!`);
                    }
                }
                if (final[market][target][type] && Array.isArray(final[market][target][type])) {
                    // Hint: operate the branch's elements
                    final[market][target][type].forEach((val, idx) => {
                        if (debug) {
                            console.log(`Operating the ${val}/${idx}`);
                        }
                        if (mod.needRemove.indexOf(val) > -1) {
                            console.log('%c' + `We'll delete ${val}`,
                                'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                            delete final[market][target][type][idx];
                        } else {
                            if (mod.replacements && Array.isArray(mod.replacements)) {
                                for (const r of mod.replacements) {
                                    if (val === r.from) {
                                        final[market][target][type][idx] = r.to;
                                    }
                                }
                            }
                            // Hint: replace part in branch elements
                            if (mod.replacementsIn && Array.isArray(mod.replacementsIn)) {
                                for (const r of mod.replacementsIn) {
                                    final[market][target][type][idx] = final[market][target][type][idx]
                                        .replace(r.from, r.to);
                                }
                            }
                            const sep = noSpace ? '' : ' ';
                            if (mod.addToElements) {
                                final[market][target][type][idx] = mod.addToElementsBeginning
                                    ? `${mod.addToElements}${sep}${final[market][target][type][idx]}`
                                    : `${final[market][target][type][idx]}${sep}${mod.addToElements}`;
                            }
                            if (mod.specialAdditions && mod.specialAdditions.condition.indexOf(val) > -1) {
                                final[market][target][type][idx] = mod.specialAdditions.addToBeginning
                                    ? `${mod.specialAdditions.func()}${sep}${final[market][target][type][idx]}`
                                    : `${final[market][target][type][idx]}${sep}${mod.specialAdditions.func()}`;
                            }
                        }
                    });
                }
                if (debug) {
                    console.log(JSON.parse(JSON.stringify(final[market][target][type])));
                }
            }
        }
        if (debug) {
            console.log('%c' + `After '${type}':`,
                'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            console.log(JSON.parse(JSON.stringify(final)));
        }
    }
    return final;
}

/**
 * @constructor
 */
function marketsParamsProto(data) {
    this.tDigit = '';
    this.data = data;
    // Object { time_value => addition } for needChange - prepends to item content!
    this.additions = {};
    // Append func() result to item if item.indexOf(condition) > -1
    this.specialAdditions = {
        condition: [],
        func: () => {
        }
    };
    // Elements we need to change with additions
    this.needChange = [];
    // Element must be removed
    this.needRemove = [];
    // Object[] - { from: '', to: '' } - simple item.replace(from, to)
    this.replacements = [];
    // Here the thing we need to add to node
    this.needAddTo = [];
    // If we want to prepend element to node
    this.needAddToBeginning = false;
    this.proceed_football = function (data) {
    };
    this.proceed_tennis = function (data) {
    };
    this.proceed_hockey = function (data) {
    };
    this.proceed_volleyball = function (data) {
    };
    this.proceed_baseball = function (data) {
    };
    this.proceed_basketball = function (data) {
    };
    this.proceed_handball = function (data) {
    };
    this.get = function () {
        //const self = this;
        //['FOOTBALL', 'TENNIS', 'HOCKEY', 'VOLLEYBALL', 'BASEBALL', 'BASKETBALL', 'HANDBALL']
        //    .forEach(sport => self['proceed_' + sport.toLowerCase()](self.data));
        this.tDigit = this.data.time_value.replace(/\D/g, '');
        this['proceed_' + this.data.sport.toLowerCase()](this.data);
        return {
            additions: this.additions,
            specialAdditions: this.specialAdditions,
            needChange: this.needChange,
            needRemove: this.needRemove,
            replacements: this.replacements,
            needAddTo: this.needAddTo,
            needAddToBeginning: this.needAddToBeginning
        };
    };
}

/**
 * Represents the API for SMS
 * @constructor
 * @param {Object} port
 * @param {Object} settings
 * @param {Object} ourCommand
 */
function smsApiMessageProto(port, settings, ourCommand) {
    this.port = port;
    this.settings = settings;
    this.ourCommand = ourCommand;
    this.hasMessage = false;
    this.status = 'error';
    this.message = 'No message!';
    this.setMessage = function (status, message) {
        if (typeof status !== 'undefined' && typeof message !== 'undefined') {
            //bsDebug(port, 'We set status:' + status + ', message: ', message);
            this.status = status;
            this.message = message;
            this.hasMessage = true;
        } else {
            this.clear();
        }
    };
    this.clear = function () {
        this.hasMessage = false;
        this.status = 'error';
        this.message = 'No message!';
    };
    /**
     *
     * @param {string|string[]} sender
     * @param {string|function} checkText
     * @param {function} afterFunction
     * @param {number} [maxWaitTimeIn]
     * @returns {Promise<any>}
     */
    this.waitForSMSCode = function (sender, checkText, afterFunction, maxWaitTimeIn) {
        let self = this;
        let maxWaitTime = typeof maxWaitTimeIn === 'number' ? maxWaitTimeIn : 150000;
        return new Promise(function (onSuccess, onReject) {
            let waitStarted = Date.now();
            let letsCheckText = function (text) {
                if (typeof checkText === 'string') {
                    return text.indexOf(checkText) > -1;
                } else if (typeof checkText === 'function') {
                    return checkText(text);
                } else {
                    onReject('Wrong type of checkText: ' + (typeof checkText));
                    return false;
                }
            };
            let performWait = function () {
                bsSmsApiCheckWait(self.port, self, self.settings, self.ourCommand, 'SMS')
                    .then((m) => {
                        bsDebug(self.port, 'after bsSmsApiCheckWait:', m);
                        let found = false;
                        for (let j in m) {
                            if (typeof m[j].content !== 'undefined'
                                && typeof m[j].content.m === 'string'
                                && typeof m[j].content.sender !== 'undefined'
                                && (typeof sender === 'string'
                                    ? m[j].content.sender === sender
                                    : sender.indexOf(m[j].content.sender) > -1)
                                && letsCheckText(m[j].content.m)) {
                                let cleanContent = afterFunction(m[j].content.m);
                                onSuccess(cleanContent);
                                found = true;
                                break;
                            }
                        }
                        if (!found && Date.now() - waitStarted < maxWaitTime) {
                            performWait();
                        } else {
                            throw 'No code for ' + (Date.now() - waitStarted) + 'ms';
                        }
                    })
                    .catch((e) => onReject('waitForSMSCode: ' + e));
            };
            performWait();
        });
    }
}


/**
 * Stores info about bet and calc total amount of bets
 * @param stake - if equals to -1 we store nothing
 * @param [debug] - whether to debug or not, default is false
 * @return {Promise<number>} - total amount of bets
 */
const storeBet = async (stake, debug) => {
    const bets = await bMess(`betsDone`).infinite()
        .then(r => typeof r !== 'object' ? ({}) : r)
        .catch(() => ({}));
    let total = 0;
    if (stake !== -1) {
        bets[Date.now()] = stake;
    }
    for (const betTime of Object.keys(bets)) {
        // Count not older than 50 minutes
        if (Date.now() - betTime > 3000000) {
            delete bets[betTime];
        } else {
            total += bets[betTime];
        }
    }
    await bMess(`betsDone`).set(bets);
    if (debug) {
        dLog('', 'storeBet', [`storeBet (${stake}) = ${total}`,
            JSON.parse(JSON.stringify(bets))]);
    }
    return total;
}

/**
 * Check bets in events
 * @param bk {string}
 * @param eventMaxBets {number}
 * @param eventTimeLimit {number}
 * @param data {object[]}
 * @param [add] {boolean} - whenever we need to add bet to event
 * @param [debug] {boolean}
 * @returns {Promise<string>}
 */
// s
const eventsWorkAll = async (bk, eventMaxBets, eventTimeLimit,
                             data, add, debug) => {
    for (const d of data) {
        const
            t1 = d.team1 || d.homeTeam || d.home,
            t2 = d.team2 || d.awayTean || d.away,
            eventName = `${t1} - ${t2}`.toLowerCase();
        // Note: till add eventsWork should always return true!
        if (!(await eventsWork(bk, {eventMaxBets: eventMaxBets, eventTimeLimit: eventTimeLimit,},
            eventName, add, debug))) {
            return `Max amount of bets (${eventMaxBets}) to ${eventName} already done!`;
        }
    }
    return 'OK';
};

/**
 * Check bets in events
 * @param bk {string}
 * @param settings {object}
 * @param settings.eventMaxBets {number}
 * @param settings.eventTimeLimit {number}
 * @param event {string}
 * @param [add] {boolean} - whenever we need to add bet to event
 * @param [debug] {boolean}
 * @returns {Promise<boolean>}
 */
const eventsWork = async (bk, settings,
                          event, add, debug) => {
    // Get all
    const events = await bMess(`${bk}EventsStore`).check(settings.eventTimeLimit)
        .then(r => typeof r !== 'object' ? ({}) : r)
        .catch(() => ({}));
    if (debug) {
        dLog('green', 'events',
            [`We got events (${bk}EventsStore) for check (${settings.eventTimeLimit}):`,
                JSON.parse(JSON.stringify(events))
            ]);
    }
    // Delete old
    let wasDelete = false;
    for (const evt of Object.keys(events)) {
        if (evt && events[evt] && (events[evt].timestamp
            && Date.now() - events[evt].timestamp) > settings.eventTimeLimit) {
            if (debug) {
                dLog('bigred', 'events', `We'll delete '${evt}'!`);
            }
            delete events[evt];
            wasDelete = true;
        }
    }
    if (wasDelete) {
        await bMess(`${bk}EventsStore`).set(events);
        if (debug) {
            dLog('big-green', 'events', [`We store events (${bk}EventsStore):`,
                JSON.parse(JSON.stringify(events))]);
        }
    }
    if (!!add) {
        // Count plus one
        if (!events[event]) {
            events[event] = {timestamp: Date.now(), count: 1};
            if (debug) {
                dLog('big-green', 'events',
                    `We ADD '${event}' (${events[event].timestamp}/${events[event].count})!`);
            }
        } else {
            events[event] = {
                timestamp: Date.now(),
                count: parseInt(events[event].count || '1') + 1,
            };
            if (debug) {
                dLog('big-green', 'events',
                    `We UPDATE '${event}' (${events[event].timestamp}/${events[event].count})!`);
            }
        }
        await bMess(`${bk}EventsStore`).set(events);
        if (debug) {
            dLog('big-green', 'events', [`We store events (${bk}EventsStore):`,
                JSON.parse(JSON.stringify(events))]);
        }
        return true;
    } else {
        // Check how many counts
        if (debug) {
            dLog('big-green', 'events',
                `We check '${event}': ${!!events[event]}, `
                + `max: ${settings.eventMaxBets}, now: ${!!events[event] ? events[event].count : 'NO EVENT'}!`);
        }
        return !events[event] || !!events[event] && parseInt(events[event].count) < settings.eventMaxBets;
    }
};

/**
 * Alias for new bMessagingProto
 * @param {string} name - name of message
 * @param {boolean} [oldStyle] - use old format of naming
 * @param {boolean} [debug]
 */
function bMess(name, oldStyle, debug) {
    return new bMessagingProto(name, oldStyle || false, debug || false);
}

/**
 * @constructor
 * @param {string} name - name of message
 * @param {boolean} [oldStyle] - use old format of naming
 * @param {boolean} [debug]
 */
function bMessagingProto(name, oldStyle, debug) {
    this.name = oldStyle ? `${name}` : `${name}_MESSAGING`;
    this.checkName = oldStyle ? `${name}_WAS_SET` : `${name}_MESSAGING_CHECK`;
    this.checkConditionName = oldStyle ? `${name}_CONDITION` : `${name}_MESSAGING_CONDITION`;
    this.result = null;
    this.debug = !!debug;
    this.nullIfError = false;

    this.setNIE = () => {
        this.nullIfError = true;
        return this;
    }

    /**
     * Wait for message
     * @param maxWaiting
     * @param validity
     * @param checkInterval
     * @param needRemove
     * @return {Promise<any>}
     */
    this.get = (maxWaiting, validity, checkInterval, needRemove) => new Promise((onSuccess, onReject) => {
        const checkValidity = validity || 30000;
        const delay = checkInterval || 333;
        const self = this;
        waitForCondition(async () => await self.check(checkValidity, !!needRemove)
                .then(r => self.nullIfError ? r !== null : true).catch(() => false),
            delay, maxWaiting, `No result of ${self.name.replace('_MESSAGING', '')}`)
            .then(() => onSuccess(JSON.parse(JSON.stringify(self.result))))
            .catch(e => {
                if (self.nullIfError) {
                    onSuccess(null);
                } else {
                    onReject(e);
                }
            });
    });

    /**
     * Check and get immediately
     * @param [validity]
     * @param [needRemove]
     * @param [infinite] {boolean}
     * @return {Promise<any>}
     */
    this.check = (validity, needRemove, infinite) => new Promise((onSuccess, onReject) => {
        const
            self = this,
            rej = e => {
                if (self.nullIfError) {
                    onSuccess(null);
                } else {
                    onReject(e);
                }
            };
        this.result = null;
        const checkInterval = validity || 30000;
        chrome.storage.local.get([self.name, self.checkName, self.checkConditionName], function (result) {
            const conditions = [
                () => typeof result[self.name] !== 'undefined',
                () => typeof result[self.checkName] === 'number',
                () => self.checkCondition(result),
            ];
            if (!infinite) {
                conditions.push(() => Date.now() - result[self.checkName] <= checkInterval);
            }
            if (self.debug) {
                dLog('background: yellow; color: gray; font-size: 12px; padding: 0px;', 'Helper',
                    [`result (${checkInterval}):`, result]);
                dLog('color: darkgray', `Helper at ${Date.now()}`, `${conditions.map(c => c()).join(' / ')}`);
            }
            if (conditions.every(c => c())) {
                const aCommand = JSON.parse(JSON.stringify(result[self.name]));
                self.result = aCommand;
                if (needRemove) {
                    self.remove().then(() => onSuccess(aCommand));
                } else {
                    onSuccess(aCommand);
                }
            } else {
                if (needRemove) {
                    self.remove().then(() => rej('No command!'));
                } else {
                    rej('No command!');
                }
            }
        });
    });

    // Alias for infinite check with no exception possibility
    this.infinite = nullIfError => new Promise((onSuccess, onReject) => {
        this.check(1, false, true)
            .then(result => onSuccess(result))
            .catch(e => {
                if (nullIfError) {
                    onSuccess(null);
                } else {
                    onReject(e);
                }
            });
    });


    this.checkCondition = result => {
        if (result[this.checkConditionName]) {
            if (Array.isArray(result[this.checkConditionName])) {
                return result[this.checkConditionName].some(p => document.location.href.indexOf(p) > -1);
            } else {
                return false;
            }
        } else {
            return true;
        }
    };

    this.set = (data, increase, condition) => new Promise(onSuccess => {
        const inc = increase || 0;
        const willSet = {};
        willSet[this.name] = data;
        willSet[this.checkName] = Date.now() + inc;
        willSet[this.checkConditionName] = condition ? condition : false;
        if (this.debug) {
            dLog('background: yellow; color: gray; font-size: 12px; padding: 0px;', 'Helper',
                [`willSet ${Date.now()}:`, willSet]);
        }
        chrome.storage.local.set(willSet, () => onSuccess(willSet));
    });

    this.remove = () => new Promise(onSuccess => {
        chrome.storage.local.remove([this.name, this.checkName, this.checkConditionName],
            () => onSuccess());
    });
}

/**
 * FINISH OF CLASSES
 * -------------------------------------------------------------------------------------------------------------------------------
 */

/**
 * -------------------------------------------------------------------------------------------------------------------------------
 * START OF EXTENSIONS
 */

/**
 * From https://github.com/uMaxmaxmaximus/date-timezone
 */
/*
(function() {
    var offsetDate;
    offsetDate = new Date();
    Date.prototype.timezoneOffset = offsetDate.getTimezoneOffset();
    Date.setTimezoneOffset = function(timezoneOffset) {
        return this.prototype.timezoneOffset = timezoneOffset;
    };
    Date.getTimezoneOffset = function(timezoneOffset) {
        return this.prototype.timezoneOffset;
    };
    Date.prototype.getTimezoneOffset = function() {
        return this.timezoneOffset;
    };
    Date.prototype.setTimezoneOffset = function(timezoneOffset) {
        return this.timezoneOffset = timezoneOffset;
    };
    Date.prototype.toString = function() {
        var offsetTime;
        offsetTime = this.timezoneOffset * 60 * 1000;
        offsetDate.setTime(this.getTime() - offsetTime);
        return offsetDate.toUTCString();
    };
    return ['Milliseconds', 'Seconds', 'Minutes', 'Hours', 'Date', 'Month', 'FullYear', 'Year', 'Day'].forEach((function(_this) {
        return function(key) {
            Date.prototype["get" + key] = function() {
                var offsetTime;
                offsetTime = this.timezoneOffset * 60 * 1000;
                offsetDate.setTime(this.getTime() - offsetTime);
                return offsetDate["getUTC" + key]();
            };
            return Date.prototype["set" + key] = function(value) {
                var offsetTime, time;
                offsetTime = this.timezoneOffset * 60 * 1000;
                offsetDate.setTime(this.getTime() - offsetTime);
                offsetDate["setUTC" + key](value);
                time = offsetDate.getTime() + offsetTime;
                this.setTime(time);
                return time;
            };
        };
    })(this));
})();
 */

/**
 * Async iterate
 * @param callback - async function or function returns Promise
 * @return {Promise<void>}
 */
Array.prototype.forEachAsync = async function (callback) {
    for (let t = 0; t < this.length; t++) {
        await callback(this[t], t, this);
    }
};

/**
 * Async iterate with possibility to break
 * @param callback - async function or function returns Promise
 * @return {Promise<void>}
 */
Array.prototype.forEachAsyncBreakable = async function (callback) {
    for (let t = 0; t < this.length; t++) {
        const result = await callback(this[t], t, this);
        if (result === false) {
            break;
        }
    }
};

Array.prototype.forEachAsyncParallel = async function (callback) {
    await Promise.all(this.map(callback));
};

//The way of how to find element by text exact match
$.expr[':'].textEquals = $.expr.createPseudo(function (arg) {
    return function (elem) {
        return $(elem).text().trim() === arg;
    };
});

// Text equals case insensitive
$.expr[':'].textEqualsI = $.expr.createPseudo(function (arg) {
    return function (elem) {
        return $(elem).text().trim().toLowerCase() === arg.trim().toLowerCase();
    };
});

// Replaces \n with space, case insensitive, multiple spaces interprets as one
$.expr[':'].textEqualsIS = $.expr.createPseudo(function (arg) {
    return function (elem) {
        return $(elem).text()
            .replace('\n', ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase() === arg.trim().replace(/\s+/g, ' ').toLowerCase();
    };
});

// Search by start
$.expr[':'].textStarts = $.expr.createPseudo(function (arg) {
    return function (elem) {
        return $(elem).text().trim().indexOf(arg) === 0;
    };
});

// Search by start case insensitive
$.expr[':'].textStartsI = $.expr.createPseudo(function (arg) {
    return function (elem) {
        return $(elem).text().trim().toLowerCase().indexOf(arg.toLowerCase()) === 0;
    };
});

$.expr[':'].textStartsIS = $.expr.createPseudo(function (arg) {
    return function (elem) {
        return $(elem).text().replace('\n', ' ')
            .replace(/\s+/g, ' ')
            .trim().toLowerCase().indexOf(arg.trim().replace(/\s+/g, ' ').toLowerCase()) === 0;
    };
});

// for ex.: $('a:regex(href, ^\/live\/\\d+\/\\d+$)');
$.expr[':'].regex = $.expr.createPseudo(function (expression) {
    return function (elem) {
        const
            matchParams = expression.split(','),
            validLabels = /^(data|css):/,
            attr = {
                method: matchParams[0].match(validLabels) ?
                    matchParams[0].split(':')[0] : 'attr',
                property: matchParams.shift().replace(validLabels, '')
            },
            regexFlags = 'ig',
            regex = new RegExp(matchParams.join('').replace(/^\s+|\s+$/g, ''), regexFlags);
        return regex.test($(elem)[attr.method](attr.property));
    }
});

/**
 * Async JQuery iterate
 * @param callback - async function or function returns Promise - if callback return false - the cycle breaks
 * @return {Promise<void>}
 */
const jQueryEachAsync = async function (callback) {
    const class2type = {
        "[object Boolean]": "boolean",
        "[object Number]": "number",
        "[object String]": "string",
        "[object Function]": "function",
        "[object Array]": "array",
        "[object Date]": "date",
        "[object RegExp]": "regexp",
        "[object Object]": "object",
        "[object Error]": "error",
        "[object Symbol]": "symbol"
    };

    function toType(obj) {
        if (obj == null) {
            return obj + "";
        }

        // Support: Android <=2.3 only (functionish RegExp)
        return typeof obj === "object" || typeof obj === "function" ? class2type[toString.call(obj)] || "object" : typeof obj;
    }

    function isFunction(obj) {

        // Support: Chrome <=57, Firefox <=52
        // In some browsers, typeof returns "function" for HTML <object> elements
        // (i.e., `typeof document.createElement( "object" ) === "function"`).
        // We don't want to classify *any* DOM node as a function.
        return typeof obj === "function" && typeof obj.nodeType !== "number";
    }

    function isWindow(obj) {
        return obj != null && obj === obj.window;
    }

    function isArrayLike(obj) {

        // Support: real iOS 8.2 only (not reproducible in simulator)
        // `in` check used to prevent JIT error (gh-2145)
        // hasOwn isn't used here due to false negatives
        // regarding Nodelist length in IE
        var length = !!obj && "length" in obj && obj.length,
            type = toType(obj);

        if (isFunction(obj) || isWindow(obj)) {
            return false;
        }

        return type === "array" || length === 0 || typeof length === "number" && length > 0 && (length - 1) in obj;
    }

    var length, i = 0, obj = this;
    if (isArrayLike(obj)) {
        length = obj.length;
        for (; i < length; i++) {
            var result = await callback.call(obj[i], i, obj[i]);
            if (result === false) {
                break;
            }
        }
    } else {
        for (i in obj) {
            if (!obj.hasOwnProperty(i)) {
                continue;
            }
            var result = await callback.call(obj[i], i, obj[i]);
            if (result === false) {
                break;
            }
        }
    }
    return obj;
};
$.fn.eachAsync = jQueryEachAsync;
jQuery.fn.eachAsync = jQueryEachAsync;

const jQueryTrimText = function () {
    return this.text().trim();
};

$.fn.trt = jQueryTrimText
jQuery.fn.trt = jQueryTrimText;

String.prototype.extractNumber = function () {
    return this.trim().replace(/[^0-9.]/g, '');
};

String.prototype.getIndicesOf = function (searchStr, caseSensitive) {
    let str = this;
    let searchStrLen = searchStr.length;
    if (searchStrLen === 0) {
        return [];
    }
    let startIndex = 0, index, indices = [];
    if (!caseSensitive) {
        str = str.toLowerCase();
        searchStr = searchStr.toLowerCase();
    }
    while ((index = str.indexOf(searchStr, startIndex)) > -1) {
        indices.push(index);
        startIndex = index + searchStrLen;
    }
    return indices;
};

/**
 * FINISH OF EXTENSIONS
 * -------------------------------------------------------------------------------------------------------------------------------
 */

/**
 * Puppeteer
 **/
const keyDefinitions = {
    '0': {keyCode: 48, key: '0', code: 'Digit0'},
    '1': {keyCode: 49, key: '1', code: 'Digit1'},
    '2': {keyCode: 50, key: '2', code: 'Digit2'},
    '3': {keyCode: 51, key: '3', code: 'Digit3'},
    '4': {keyCode: 52, key: '4', code: 'Digit4'},
    '5': {keyCode: 53, key: '5', code: 'Digit5'},
    '6': {keyCode: 54, key: '6', code: 'Digit6'},
    '7': {keyCode: 55, key: '7', code: 'Digit7'},
    '8': {keyCode: 56, key: '8', code: 'Digit8'},
    '9': {keyCode: 57, key: '9', code: 'Digit9'},
    Power: {key: 'Power', code: 'Power'},
    Eject: {key: 'Eject', code: 'Eject'},
    Abort: {keyCode: 3, code: 'Abort', key: 'Cancel'},
    Help: {keyCode: 6, code: 'Help', key: 'Help'},
    Backspace: {keyCode: 8, code: 'Backspace', key: 'Backspace'},
    Tab: {keyCode: 9, code: 'Tab', key: 'Tab'},
    Numpad5: {
        keyCode: 12,
        shiftKeyCode: 101,
        key: 'Clear',
        code: 'Numpad5',
        shiftKey: '5',
        location: 3,
    },
    NumpadEnter: {
        keyCode: 13,
        code: 'NumpadEnter',
        key: 'Enter',
        text: '\r',
        location: 3,
    },
    Enter: {keyCode: 13, code: 'Enter', key: 'Enter', text: '\r'},
    '\r': {keyCode: 13, code: 'Enter', key: 'Enter', text: '\r'},
    '\n': {keyCode: 13, code: 'Enter', key: 'Enter', text: '\r'},
    ShiftLeft: {keyCode: 16, code: 'ShiftLeft', key: 'Shift', location: 1},
    ShiftRight: {keyCode: 16, code: 'ShiftRight', key: 'Shift', location: 2},
    ControlLeft: {
        keyCode: 17,
        code: 'ControlLeft',
        key: 'Control',
        location: 1,
    },
    ControlRight: {
        keyCode: 17,
        code: 'ControlRight',
        key: 'Control',
        location: 2,
    },
    AltLeft: {keyCode: 18, code: 'AltLeft', key: 'Alt', location: 1},
    AltRight: {keyCode: 18, code: 'AltRight', key: 'Alt', location: 2},
    Pause: {keyCode: 19, code: 'Pause', key: 'Pause'},
    CapsLock: {keyCode: 20, code: 'CapsLock', key: 'CapsLock'},
    Escape: {keyCode: 27, code: 'Escape', key: 'Escape'},
    Convert: {keyCode: 28, code: 'Convert', key: 'Convert'},
    NonConvert: {keyCode: 29, code: 'NonConvert', key: 'NonConvert'},
    Space: {keyCode: 32, code: 'Space', key: ' '},
    Numpad9: {
        keyCode: 33,
        shiftKeyCode: 105,
        key: 'PageUp',
        code: 'Numpad9',
        shiftKey: '9',
        location: 3,
    },
    PageUp: {keyCode: 33, code: 'PageUp', key: 'PageUp'},
    Numpad3: {
        keyCode: 34,
        shiftKeyCode: 99,
        key: 'PageDown',
        code: 'Numpad3',
        shiftKey: '3',
        location: 3,
    },
    PageDown: {keyCode: 34, code: 'PageDown', key: 'PageDown'},
    End: {keyCode: 35, code: 'End', key: 'End'},
    Numpad1: {
        keyCode: 35,
        shiftKeyCode: 97,
        key: 'End',
        code: 'Numpad1',
        shiftKey: '1',
        location: 3,
    },
    Home: {keyCode: 36, code: 'Home', key: 'Home'},
    Numpad7: {
        keyCode: 36,
        shiftKeyCode: 103,
        key: 'Home',
        code: 'Numpad7',
        shiftKey: '7',
        location: 3,
    },
    ArrowLeft: {keyCode: 37, code: 'ArrowLeft', key: 'ArrowLeft'},
    Numpad4: {
        keyCode: 37,
        shiftKeyCode: 100,
        key: 'ArrowLeft',
        code: 'Numpad4',
        shiftKey: '4',
        location: 3,
    },
    Numpad8: {
        keyCode: 38,
        shiftKeyCode: 104,
        key: 'ArrowUp',
        code: 'Numpad8',
        shiftKey: '8',
        location: 3,
    },
    ArrowUp: {keyCode: 38, code: 'ArrowUp', key: 'ArrowUp'},
    ArrowRight: {keyCode: 39, code: 'ArrowRight', key: 'ArrowRight'},
    Numpad6: {
        keyCode: 39,
        shiftKeyCode: 102,
        key: 'ArrowRight',
        code: 'Numpad6',
        shiftKey: '6',
        location: 3,
    },
    Numpad2: {
        keyCode: 40,
        shiftKeyCode: 98,
        key: 'ArrowDown',
        code: 'Numpad2',
        shiftKey: '2',
        location: 3,
    },
    ArrowDown: {keyCode: 40, code: 'ArrowDown', key: 'ArrowDown'},
    Select: {keyCode: 41, code: 'Select', key: 'Select'},
    Open: {keyCode: 43, code: 'Open', key: 'Execute'},
    PrintScreen: {keyCode: 44, code: 'PrintScreen', key: 'PrintScreen'},
    Insert: {keyCode: 45, code: 'Insert', key: 'Insert'},
    Numpad0: {
        keyCode: 45,
        shiftKeyCode: 96,
        key: 'Insert',
        code: 'Numpad0',
        shiftKey: '0',
        location: 3,
    },
    Delete: {keyCode: 46, code: 'Delete', key: 'Delete'},
    NumpadDecimal: {
        keyCode: 46,
        shiftKeyCode: 110,
        code: 'NumpadDecimal',
        key: '\u0000',
        shiftKey: '.',
        location: 3,
    },
    Digit0: {keyCode: 48, code: 'Digit0', shiftKey: ')', key: '0'},
    Digit1: {keyCode: 49, code: 'Digit1', shiftKey: '!', key: '1'},
    Digit2: {keyCode: 50, code: 'Digit2', shiftKey: '@', key: '2'},
    Digit3: {keyCode: 51, code: 'Digit3', shiftKey: '#', key: '3'},
    Digit4: {keyCode: 52, code: 'Digit4', shiftKey: '$', key: '4'},
    Digit5: {keyCode: 53, code: 'Digit5', shiftKey: '%', key: '5'},
    Digit6: {keyCode: 54, code: 'Digit6', shiftKey: '^', key: '6'},
    Digit7: {keyCode: 55, code: 'Digit7', shiftKey: '&', key: '7'},
    Digit8: {keyCode: 56, code: 'Digit8', shiftKey: '*', key: '8'},
    Digit9: {keyCode: 57, code: 'Digit9', shiftKey: '(', key: '9'},
    KeyA: {keyCode: 65, code: 'KeyA', shiftKey: 'A', key: 'a'},
    KeyB: {keyCode: 66, code: 'KeyB', shiftKey: 'B', key: 'b'},
    KeyC: {keyCode: 67, code: 'KeyC', shiftKey: 'C', key: 'c'},
    KeyD: {keyCode: 68, code: 'KeyD', shiftKey: 'D', key: 'd'},
    KeyE: {keyCode: 69, code: 'KeyE', shiftKey: 'E', key: 'e'},
    KeyF: {keyCode: 70, code: 'KeyF', shiftKey: 'F', key: 'f'},
    KeyG: {keyCode: 71, code: 'KeyG', shiftKey: 'G', key: 'g'},
    KeyH: {keyCode: 72, code: 'KeyH', shiftKey: 'H', key: 'h'},
    KeyI: {keyCode: 73, code: 'KeyI', shiftKey: 'I', key: 'i'},
    KeyJ: {keyCode: 74, code: 'KeyJ', shiftKey: 'J', key: 'j'},
    KeyK: {keyCode: 75, code: 'KeyK', shiftKey: 'K', key: 'k'},
    KeyL: {keyCode: 76, code: 'KeyL', shiftKey: 'L', key: 'l'},
    KeyM: {keyCode: 77, code: 'KeyM', shiftKey: 'M', key: 'm'},
    KeyN: {keyCode: 78, code: 'KeyN', shiftKey: 'N', key: 'n'},
    KeyO: {keyCode: 79, code: 'KeyO', shiftKey: 'O', key: 'o'},
    KeyP: {keyCode: 80, code: 'KeyP', shiftKey: 'P', key: 'p'},
    KeyQ: {keyCode: 81, code: 'KeyQ', shiftKey: 'Q', key: 'q'},
    KeyR: {keyCode: 82, code: 'KeyR', shiftKey: 'R', key: 'r'},
    KeyS: {keyCode: 83, code: 'KeyS', shiftKey: 'S', key: 's'},
    KeyT: {keyCode: 84, code: 'KeyT', shiftKey: 'T', key: 't'},
    KeyU: {keyCode: 85, code: 'KeyU', shiftKey: 'U', key: 'u'},
    KeyV: {keyCode: 86, code: 'KeyV', shiftKey: 'V', key: 'v'},
    KeyW: {keyCode: 87, code: 'KeyW', shiftKey: 'W', key: 'w'},
    KeyX: {keyCode: 88, code: 'KeyX', shiftKey: 'X', key: 'x'},
    KeyY: {keyCode: 89, code: 'KeyY', shiftKey: 'Y', key: 'y'},
    KeyZ: {keyCode: 90, code: 'KeyZ', shiftKey: 'Z', key: 'z'},
    MetaLeft: {keyCode: 91, code: 'MetaLeft', key: 'Meta', location: 1},
    MetaRight: {keyCode: 92, code: 'MetaRight', key: 'Meta', location: 2},
    ContextMenu: {keyCode: 93, code: 'ContextMenu', key: 'ContextMenu'},
    NumpadMultiply: {
        keyCode: 106,
        code: 'NumpadMultiply',
        key: '*',
        location: 3,
    },
    NumpadAdd: {keyCode: 107, code: 'NumpadAdd', key: '+', location: 3},
    NumpadSubtract: {
        keyCode: 109,
        code: 'NumpadSubtract',
        key: '-',
        location: 3,
    },
    NumpadDivide: {keyCode: 111, code: 'NumpadDivide', key: '/', location: 3},
    F1: {keyCode: 112, code: 'F1', key: 'F1'},
    F2: {keyCode: 113, code: 'F2', key: 'F2'},
    F3: {keyCode: 114, code: 'F3', key: 'F3'},
    F4: {keyCode: 115, code: 'F4', key: 'F4'},
    F5: {keyCode: 116, code: 'F5', key: 'F5'},
    F6: {keyCode: 117, code: 'F6', key: 'F6'},
    F7: {keyCode: 118, code: 'F7', key: 'F7'},
    F8: {keyCode: 119, code: 'F8', key: 'F8'},
    F9: {keyCode: 120, code: 'F9', key: 'F9'},
    F10: {keyCode: 121, code: 'F10', key: 'F10'},
    F11: {keyCode: 122, code: 'F11', key: 'F11'},
    F12: {keyCode: 123, code: 'F12', key: 'F12'},
    F13: {keyCode: 124, code: 'F13', key: 'F13'},
    F14: {keyCode: 125, code: 'F14', key: 'F14'},
    F15: {keyCode: 126, code: 'F15', key: 'F15'},
    F16: {keyCode: 127, code: 'F16', key: 'F16'},
    F17: {keyCode: 128, code: 'F17', key: 'F17'},
    F18: {keyCode: 129, code: 'F18', key: 'F18'},
    F19: {keyCode: 130, code: 'F19', key: 'F19'},
    F20: {keyCode: 131, code: 'F20', key: 'F20'},
    F21: {keyCode: 132, code: 'F21', key: 'F21'},
    F22: {keyCode: 133, code: 'F22', key: 'F22'},
    F23: {keyCode: 134, code: 'F23', key: 'F23'},
    F24: {keyCode: 135, code: 'F24', key: 'F24'},
    NumLock: {keyCode: 144, code: 'NumLock', key: 'NumLock'},
    ScrollLock: {keyCode: 145, code: 'ScrollLock', key: 'ScrollLock'},
    AudioVolumeMute: {
        keyCode: 173,
        code: 'AudioVolumeMute',
        key: 'AudioVolumeMute',
    },
    AudioVolumeDown: {
        keyCode: 174,
        code: 'AudioVolumeDown',
        key: 'AudioVolumeDown',
    },
    AudioVolumeUp: {keyCode: 175, code: 'AudioVolumeUp', key: 'AudioVolumeUp'},
    MediaTrackNext: {
        keyCode: 176,
        code: 'MediaTrackNext',
        key: 'MediaTrackNext',
    },
    MediaTrackPrevious: {
        keyCode: 177,
        code: 'MediaTrackPrevious',
        key: 'MediaTrackPrevious',
    },
    MediaStop: {keyCode: 178, code: 'MediaStop', key: 'MediaStop'},
    MediaPlayPause: {
        keyCode: 179,
        code: 'MediaPlayPause',
        key: 'MediaPlayPause',
    },
    Semicolon: {keyCode: 186, code: 'Semicolon', shiftKey: ':', key: ';'},
    Equal: {keyCode: 187, code: 'Equal', shiftKey: '+', key: '='},
    NumpadEqual: {keyCode: 187, code: 'NumpadEqual', key: '=', location: 3},
    Comma: {keyCode: 188, code: 'Comma', shiftKey: '<', key: ','},
    Minus: {keyCode: 189, code: 'Minus', shiftKey: '_', key: '-'},
    Period: {keyCode: 190, code: 'Period', shiftKey: '>', key: '.'},
    Slash: {keyCode: 191, code: 'Slash', shiftKey: '?', key: '/'},
    Backquote: {keyCode: 192, code: 'Backquote', shiftKey: '~', key: '`'},
    BracketLeft: {keyCode: 219, code: 'BracketLeft', shiftKey: '{', key: '['},
    Backslash: {keyCode: 220, code: 'Backslash', shiftKey: '|', key: '\\'},
    BracketRight: {keyCode: 221, code: 'BracketRight', shiftKey: '}', key: ']'},
    Quote: {keyCode: 222, code: 'Quote', shiftKey: '"', key: "'"},
    AltGraph: {keyCode: 225, code: 'AltGraph', key: 'AltGraph'},
    Props: {keyCode: 247, code: 'Props', key: 'CrSel'},
    Cancel: {keyCode: 3, key: 'Cancel', code: 'Abort'},
    Clear: {keyCode: 12, key: 'Clear', code: 'Numpad5', location: 3},
    Shift: {keyCode: 16, key: 'Shift', code: 'ShiftLeft', location: 1},
    Control: {keyCode: 17, key: 'Control', code: 'ControlLeft', location: 1},
    Alt: {keyCode: 18, key: 'Alt', code: 'AltLeft', location: 1},
    Accept: {keyCode: 30, key: 'Accept'},
    ModeChange: {keyCode: 31, key: 'ModeChange'},
    ' ': {keyCode: 32, key: ' ', code: 'Space'},
    Print: {keyCode: 42, key: 'Print'},
    Execute: {keyCode: 43, key: 'Execute', code: 'Open'},
    '\u0000': {keyCode: 46, key: '\u0000', code: 'NumpadDecimal', location: 3},
    a: {keyCode: 65, key: 'a', code: 'KeyA'},
    b: {keyCode: 66, key: 'b', code: 'KeyB'},
    c: {keyCode: 67, key: 'c', code: 'KeyC'},
    d: {keyCode: 68, key: 'd', code: 'KeyD'},
    e: {keyCode: 69, key: 'e', code: 'KeyE'},
    f: {keyCode: 70, key: 'f', code: 'KeyF'},
    g: {keyCode: 71, key: 'g', code: 'KeyG'},
    h: {keyCode: 72, key: 'h', code: 'KeyH'},
    i: {keyCode: 73, key: 'i', code: 'KeyI'},
    j: {keyCode: 74, key: 'j', code: 'KeyJ'},
    k: {keyCode: 75, key: 'k', code: 'KeyK'},
    l: {keyCode: 76, key: 'l', code: 'KeyL'},
    m: {keyCode: 77, key: 'm', code: 'KeyM'},
    n: {keyCode: 78, key: 'n', code: 'KeyN'},
    o: {keyCode: 79, key: 'o', code: 'KeyO'},
    p: {keyCode: 80, key: 'p', code: 'KeyP'},
    q: {keyCode: 81, key: 'q', code: 'KeyQ'},
    r: {keyCode: 82, key: 'r', code: 'KeyR'},
    s: {keyCode: 83, key: 's', code: 'KeyS'},
    t: {keyCode: 84, key: 't', code: 'KeyT'},
    u: {keyCode: 85, key: 'u', code: 'KeyU'},
    v: {keyCode: 86, key: 'v', code: 'KeyV'},
    w: {keyCode: 87, key: 'w', code: 'KeyW'},
    x: {keyCode: 88, key: 'x', code: 'KeyX'},
    y: {keyCode: 89, key: 'y', code: 'KeyY'},
    z: {keyCode: 90, key: 'z', code: 'KeyZ'},
    Meta: {keyCode: 91, key: 'Meta', code: 'MetaLeft', location: 1},
    '*': {keyCode: 106, key: '*', code: 'NumpadMultiply', location: 3},
    '+': {keyCode: 107, key: '+', code: 'NumpadAdd', location: 3},
    '-': {keyCode: 109, key: '-', code: 'NumpadSubtract', location: 3},
    '/': {keyCode: 111, key: '/', code: 'NumpadDivide', location: 3},
    ';': {keyCode: 186, key: ';', code: 'Semicolon'},
    '=': {keyCode: 187, key: '=', code: 'Equal'},
    ',': {keyCode: 188, key: ',', code: 'Comma'},
    '.': {keyCode: 190, key: '.', code: 'Period'},
    '`': {keyCode: 192, key: '`', code: 'Backquote'},
    '[': {keyCode: 219, key: '[', code: 'BracketLeft'},
    '\\': {keyCode: 220, key: '\\', code: 'Backslash'},
    ']': {keyCode: 221, key: ']', code: 'BracketRight'},
    "'": {keyCode: 222, key: "'", code: 'Quote'},
    Attn: {keyCode: 246, key: 'Attn'},
    CrSel: {keyCode: 247, key: 'CrSel', code: 'Props'},
    ExSel: {keyCode: 248, key: 'ExSel'},
    EraseEof: {keyCode: 249, key: 'EraseEof'},
    Play: {keyCode: 250, key: 'Play'},
    ZoomOut: {keyCode: 251, key: 'ZoomOut'},
    ')': {keyCode: 48, key: ')', code: 'Digit0'},
    '!': {keyCode: 49, key: '!', code: 'Digit1'},
    '@': {keyCode: 50, key: '@', code: 'Digit2'},
    '#': {keyCode: 51, key: '#', code: 'Digit3'},
    $: {keyCode: 52, key: '$', code: 'Digit4'},
    '%': {keyCode: 53, key: '%', code: 'Digit5'},
    '^': {keyCode: 54, key: '^', code: 'Digit6'},
    '&': {keyCode: 55, key: '&', code: 'Digit7'},
    '(': {keyCode: 57, key: '(', code: 'Digit9'},
    A: {keyCode: 65, key: 'A', code: 'KeyA'},
    B: {keyCode: 66, key: 'B', code: 'KeyB'},
    C: {keyCode: 67, key: 'C', code: 'KeyC'},
    D: {keyCode: 68, key: 'D', code: 'KeyD'},
    E: {keyCode: 69, key: 'E', code: 'KeyE'},
    F: {keyCode: 70, key: 'F', code: 'KeyF'},
    G: {keyCode: 71, key: 'G', code: 'KeyG'},
    H: {keyCode: 72, key: 'H', code: 'KeyH'},
    I: {keyCode: 73, key: 'I', code: 'KeyI'},
    J: {keyCode: 74, key: 'J', code: 'KeyJ'},
    K: {keyCode: 75, key: 'K', code: 'KeyK'},
    L: {keyCode: 76, key: 'L', code: 'KeyL'},
    M: {keyCode: 77, key: 'M', code: 'KeyM'},
    N: {keyCode: 78, key: 'N', code: 'KeyN'},
    O: {keyCode: 79, key: 'O', code: 'KeyO'},
    P: {keyCode: 80, key: 'P', code: 'KeyP'},
    Q: {keyCode: 81, key: 'Q', code: 'KeyQ'},
    R: {keyCode: 82, key: 'R', code: 'KeyR'},
    S: {keyCode: 83, key: 'S', code: 'KeyS'},
    T: {keyCode: 84, key: 'T', code: 'KeyT'},
    U: {keyCode: 85, key: 'U', code: 'KeyU'},
    V: {keyCode: 86, key: 'V', code: 'KeyV'},
    W: {keyCode: 87, key: 'W', code: 'KeyW'},
    X: {keyCode: 88, key: 'X', code: 'KeyX'},
    Y: {keyCode: 89, key: 'Y', code: 'KeyY'},
    Z: {keyCode: 90, key: 'Z', code: 'KeyZ'},
    ':': {keyCode: 186, key: ':', code: 'Semicolon'},
    '<': {keyCode: 188, key: '<', code: 'Comma'},
    _: {keyCode: 189, key: '_', code: 'Minus'},
    '>': {keyCode: 190, key: '>', code: 'Period'},
    '?': {keyCode: 191, key: '?', code: 'Slash'},
    '~': {keyCode: 192, key: '~', code: 'Backquote'},
    '{': {keyCode: 219, key: '{', code: 'BracketLeft'},
    '|': {keyCode: 220, key: '|', code: 'Backslash'},
    '}': {keyCode: 221, key: '}', code: 'BracketRight'},
    '"': {keyCode: 222, key: '"', code: 'Quote'},
    SoftLeft: {key: 'SoftLeft', code: 'SoftLeft', location: 4},
    SoftRight: {key: 'SoftRight', code: 'SoftRight', location: 4},
    Camera: {keyCode: 44, key: 'Camera', code: 'Camera', location: 4},
    Call: {key: 'Call', code: 'Call', location: 4},
    EndCall: {keyCode: 95, key: 'EndCall', code: 'EndCall', location: 4},
    VolumeDown: {
        keyCode: 182,
        key: 'VolumeDown',
        code: 'VolumeDown',
        location: 4,
    },
    VolumeUp: {keyCode: 183, key: 'VolumeUp', code: 'VolumeUp', location: 4},
};

const _keyDescriptionForString = keyString => {
    const shift = 0 & 8;
    const definition = keyDefinitions[keyString];
    if (!definition) {
        throw `Unknown key: "${keyString}"`;
    }
    const description = {
        key: shift && definition.shiftKey ? definition.shiftKey : (definition.key ? definition.key : ''),
        keyCode: shift && definition.shiftKeyCode ? definition.shiftKeyCode
            : (definition.keyCode ? definition.keyCode : 0),
        code: definition.code || '',
        text: '',
        location: definition.location || 0,
    };
    if (description.key.length === 1) {
        description.text = description.key;
    }
    if (definition.text) {
        description.text = definition.text;
    }
    if (shift && definition.shiftText) {
        description.text = definition.shiftText;
    }
    // if any modifiers besides shift are pressed, no text should be sent
    if (0 & ~8) {
        description.text = '';
    }
    return description;
};

// **********************
// BetBuyer functionality
// **********************
class BetBuyer {
    static bookies = {
        'fonbet': 'FONBET',
        'stavka': '1XBET',
        'b365': 'BET365',
        //"1Bet": "",
        "1XСтавка": "1XBET",
        //"1win": "",
        //"1xbit": "",
        //"18bet": "",
        //"888": "",
        //"BETTERY": "",
        //"Baltbet": "",
        "Bet365": "BET365",
        "BetBoom": "TOTOGAMING",
        "BetCity": "BETCITY",
        //"BetOnline": "",
        //"Betfair Exchange": "",
        "Betfair Sportsbook": "BFSPORTSBOOK",
        "Betway": "BETWAY",
        //"Bookmaker": "",
        //"Bovada": "",
        "Bwin": "BWIN",
        //"Cloudbet": "",
        //"Coral": "",
        //"Dafabet": "",
        "FavBet": "FAVBET",
        "Fonbet": "FONBET",
        //"Fortuna": "",
        //"GGBet": "",
        //"Jetbull": "",
        "Leon": "LEON",
        "Vbet": "VBET",
        "Marathon": "MARATHON",
        //"Novibet": "",
        //"OPTIBET": "",
        "Olimp": "OLIMP",
        "Paddy Power": "PADDYPOWER",
        "Parimatch.ru": "PARIMATCH",
        "Pinnacle": "PIN88",
        "SBOBET": "SBOBET",
        "VBet": "VBET",
        //"Sportsbet.io": "",
        //"Superbet": "",
        "Tennisi": "TENNISI",
        //"TonyBet": "",
        "Unibet": "UNIBET",
        "William Hill": "WILLIAMHILL",
        "Winline": "WINLINEBET",
        "Бетсити": "BETCITY",
        //"Зенит": "",
        "Лига Ставок": "LIGASTAVOK",
        //"МОСТБЕТ": "",
    };

    static async getAllAsync(waitBetmax) {
        const nfs = 'span.betbuyer-warning:textEquals("не найдено")';
        const bms = () => document
            .querySelectorAll('div.betmax__betbuyer-coefficents div.betmax__coefficent-container');
        if (waitBetmax) {
            await waitForCondition(() => bms().length > 0
                || $(nfs).length > 0, 333, 1500)
                .catch(() => console.log('No betmax'));
            await delayPromise(300);
        }
        const all = [];
        for (const el of bms()) {
            if (this.bookies[el.getAttribute('title')]) {
                all.push({
                    bk: this.bookies[el.getAttribute('title')],
                    coef: el.querySelector('span').textContent
                });
            }
        }
        return all;
    }

    static sendAll(good, bet, settings, bkHere) {
        const
            cd = parseFloat(settings.coefDecrease),
            ec = parseFloat(bet.coef) - cd,
            toSend = [
                {bk: bkHere, coef: bet.coef},
            ];
        if (good.length > 0) {
            good.forEach(g => {
                if (parseFloat(g.coef) >= ec) {
                    toSend.push({bk: g.bk, coef: g.coef});
                }
            });
        } else if (settings.sendToAll) {
            Object.values(this.bookies).forEach(bk => toSend.push({bk: bk, coef: ec}));
        }
        chrome.runtime.sendMessage({
                SendBets: true, send: toSend, bet: bet,
                bk: bkHere, settings: settings
            },
            (r) => {
                console.log(r);
            });
    }
}
