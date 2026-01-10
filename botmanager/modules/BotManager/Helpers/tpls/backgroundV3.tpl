
/*------------ begin settings -----------------*/
#SETTINGS#
/*------------ end settings -------------------*/


/*------------ begin offscreen -------------------*/

let creating; // avoid races
async function setupOffscreenDocument(path = 'offscreen.html') {
const offscreenUrl = chrome.runtime.getURL(path);

// Prefer runtime.getContexts (Chrome 116+); otherwise fall back
if ('getContexts' in chrome.runtime) {
const existing = await chrome.runtime.getContexts({
contextTypes: ['OFFSCREEN_DOCUMENT'],
documentUrls: [offscreenUrl],
});
if (existing.length > 0) return;
}

if (creating) {
await creating;
return;
}
creating = chrome.offscreen.createDocument({
url: path,
reasons: ['BLOBS'], // pick the most appropriate reason for your use
justification: 'Maintain a persistent WebSocket and relay events.',
});
await creating;
creating = null;
}
chrome.runtime.onInstalled.addListener(() => setupOffscreenDocument());
chrome.runtime.onStartup.addListener(() => setupOffscreenDocument());

/*------------ end offscreen -------------------*/


/*-------------- begin helper -----------------*/

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

function isAsyncFunction(fn) {
    return fn && fn.constructor && fn.constructor.name === 'AsyncFunction';
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

function nowFormatted(dtParam) {
    let cd = typeof dtParam === 'undefined' ? new Date() : new Date(dtParam);
    return cd.getHours() + ':' + cd.getMinutes() + ':' + cd.getSeconds() + ' (' + cd.getMilliseconds() + ')';
}

const bsDebugDouble = (port, message, dataParam) => {
    console.log(message);
    if (dataParam) {
        console.log(dataParam);
    }
    bsDebug(port, message, dataParam);
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

/*-------------- end helper -------------------*/

/*------------ begin blockers -----------------*/
/*------------ end blockers -------------------*/

/*------------- begin injects -----------------*/
chrome.runtime.onMessage.addListener((message, sender) => {
    const tabId = sender.tab.id;
    const frameId = sender.frameId;
    if (!Object.keys(message).some(k => k.indexOf('Loaded') > -1)
        || !Object.keys(message).some(k => k === 'scripts')) {
        return false;
    }
    console.log('%c' + 'onMessage!!!', 'background: blue; color: white; font-weight: bold;');
    console.log(message);
    const scripts = [
        "libs/jquery-3.3.1.min.js",
        "libs/js.cookie.min.js",
        "libs/emulatetab.joelpurra.min.js",
        "libs/helper.js",
        "libs/similar_text.js",
        "libs/levenshtein.js"
    ];
    message.scripts.split(';').forEach(s => s.length > 3 ? scripts.push(`js/${s}`) : null);

    let activeTabId = tabId;

    let loadScript = function () {
        let current = scripts.shift();
        if (typeof current !== 'undefined') {
            // console.log('Now executing: ' + current);
            chrome.scripting.executeScript(
                {
                    target: { tabId: activeTabId, frameIds: [frameId] },
                    files: [current]
                },
                () => loadScript()
            );
        } else {
            console.log(
                `%cAll scripts must be implemented! ${activeTabId}/${frameId}`,
                'background: grey; color: yellow;'
            );
        }
    };


    //const urlPattern = message.fonLoaded
    //    ? message.thisUrl.replace('#!/live', '')
    //    : message.bwinLoaded ? message.thisUrl.replace(/live(#|\?).*/, '*') : message.thisUrl;
    /*
    chrome.tabs.query({url: urlPattern}, tabs => {
        let activeTab = tabs[0];
        if (!activeTab) {
            console.log('%c' + 'INJECTS! No tab for url: "' + urlPattern + '"',
                'background: red; color: yellow; font-size: 14px; font-weight: bold; padding: 5px 20px;');
            return;
        }
        activeTabId = activeTab.id;
        loadScript();
    });
     */

    loadScript();

    // Do not wait for callback!
    return false;

});
/*------------- end injects -------------------*/

/*----------- begin tweetnacl -----------------*/
!function(i){"use strict";var m=function(r,n){this.hi=0|r,this.lo=0|n},v=function(r){var n,e=new Float64Array(16);if(r)for(n=0;n<r.length;n++)e[n]=r[n];return e},a=function(){throw new Error("no PRNG")},o=new Uint8Array(16),e=new Uint8Array(32);e[0]=9;var c=v(),w=v([1]),g=v([56129,1]),y=v([30883,4953,19914,30187,55467,16705,2637,112,59544,30585,16505,36039,65139,11119,27886,20995]),l=v([61785,9906,39828,60374,45398,33411,5274,224,53552,61171,33010,6542,64743,22239,55772,9222]),t=v([54554,36645,11616,51542,42930,38181,51040,26924,56412,64982,57905,49316,21502,52590,14035,8553]),f=v([26200,26214,26214,26214,26214,26214,26214,26214,26214,26214,26214,26214,26214,26214,26214,26214]),s=v([41136,18958,6951,50414,58488,44335,6150,12099,55207,15867,153,11085,57099,20417,9344,11139]);function h(r,n){return r<<n|r>>>32-n}function b(r,n){var e=255&r[n+3];return(e=(e=e<<8|255&r[n+2])<<8|255&r[n+1])<<8|255&r[n+0]}function B(r,n){var e=r[n]<<24|r[n+1]<<16|r[n+2]<<8|r[n+3],t=r[n+4]<<24|r[n+5]<<16|r[n+6]<<8|r[n+7];return new m(e,t)}function p(r,n,e){var t;for(t=0;t<4;t++)r[n+t]=255&e,e>>>=8}function S(r,n,e){r[n]=e.hi>>24&255,r[n+1]=e.hi>>16&255,r[n+2]=e.hi>>8&255,r[n+3]=255&e.hi,r[n+4]=e.lo>>24&255,r[n+5]=e.lo>>16&255,r[n+6]=e.lo>>8&255,r[n+7]=255&e.lo}function u(r,n,e,t,o){var i,a=0;for(i=0;i<o;i++)a|=r[n+i]^e[t+i];return(1&a-1>>>8)-1}function A(r,n,e,t){return u(r,n,e,t,16)}function _(r,n,e,t){return u(r,n,e,t,32)}function U(r,n,e,t,o){var i,a,f,u=new Uint32Array(16),c=new Uint32Array(16),w=new Uint32Array(16),y=new Uint32Array(4);for(i=0;i<4;i++)c[5*i]=b(t,4*i),c[1+i]=b(e,4*i),c[6+i]=b(n,4*i),c[11+i]=b(e,16+4*i);for(i=0;i<16;i++)w[i]=c[i];for(i=0;i<20;i++){for(a=0;a<4;a++){for(f=0;f<4;f++)y[f]=c[(5*a+4*f)%16];for(y[1]^=h(y[0]+y[3]|0,7),y[2]^=h(y[1]+y[0]|0,9),y[3]^=h(y[2]+y[1]|0,13),y[0]^=h(y[3]+y[2]|0,18),f=0;f<4;f++)u[4*a+(a+f)%4]=y[f]}for(f=0;f<16;f++)c[f]=u[f]}if(o){for(i=0;i<16;i++)c[i]=c[i]+w[i]|0;for(i=0;i<4;i++)c[5*i]=c[5*i]-b(t,4*i)|0,c[6+i]=c[6+i]-b(n,4*i)|0;for(i=0;i<4;i++)p(r,4*i,c[5*i]),p(r,16+4*i,c[6+i])}else for(i=0;i<16;i++)p(r,4*i,c[i]+w[i]|0)}function E(r,n,e,t){U(r,n,e,t,!1)}function x(r,n,e,t){return U(r,n,e,t,!0),0}var d=new Uint8Array([101,120,112,97,110,100,32,51,50,45,98,121,116,101,32,107]);function K(r,n,e,t,o,i,a){var f,u,c=new Uint8Array(16),w=new Uint8Array(64);if(!o)return 0;for(u=0;u<16;u++)c[u]=0;for(u=0;u<8;u++)c[u]=i[u];for(;64<=o;){for(E(w,c,a,d),u=0;u<64;u++)r[n+u]=(e?e[t+u]:0)^w[u];for(f=1,u=8;u<16;u++)f=f+(255&c[u])|0,c[u]=255&f,f>>>=8;o-=64,n+=64,e&&(t+=64)}if(0<o)for(E(w,c,a,d),u=0;u<o;u++)r[n+u]=(e?e[t+u]:0)^w[u];return 0}function Y(r,n,e,t,o){return K(r,n,null,0,e,t,o)}function L(r,n,e,t,o){var i=new Uint8Array(32);return x(i,t,o,d),Y(r,n,e,t.subarray(16),i)}function T(r,n,e,t,o,i,a){var f=new Uint8Array(32);return x(f,i,a,d),K(r,n,e,t,o,i.subarray(16),f)}function k(r,n){var e,t=0;for(e=0;e<17;e++)t=t+(r[e]+n[e]|0)|0,r[e]=255&t,t>>>=8}var z=new Uint32Array([5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252]);function R(r,n,e,t,o,i){var a,f,u,c,w=new Uint32Array(17),y=new Uint32Array(17),l=new Uint32Array(17),s=new Uint32Array(17),h=new Uint32Array(17);for(u=0;u<17;u++)y[u]=l[u]=0;for(u=0;u<16;u++)y[u]=i[u];for(y[3]&=15,y[4]&=252,y[7]&=15,y[8]&=252,y[11]&=15,y[12]&=252,y[15]&=15;0<o;){for(u=0;u<17;u++)s[u]=0;for(u=0;u<16&&u<o;++u)s[u]=e[t+u];for(s[u]=1,t+=u,o-=u,k(l,s),f=0;f<17;f++)for(u=w[f]=0;u<17;u++)w[f]=w[f]+l[u]*(u<=f?y[f-u]:320*y[f+17-u]|0)|0;for(f=0;f<17;f++)l[f]=w[f];for(u=c=0;u<16;u++)c=c+l[u]|0,l[u]=255&c,c>>>=8;for(c=c+l[16]|0,l[16]=3&c,c=5*(c>>>2)|0,u=0;u<16;u++)c=c+l[u]|0,l[u]=255&c,c>>>=8;c=c+l[16]|0,l[16]=c}for(u=0;u<17;u++)h[u]=l[u];for(k(l,z),a=0|-(l[16]>>>7),u=0;u<17;u++)l[u]^=a&(h[u]^l[u]);for(u=0;u<16;u++)s[u]=i[u+16];for(s[16]=0,k(l,s),u=0;u<16;u++)r[n+u]=l[u];return 0}function P(r,n,e,t,o,i){var a=new Uint8Array(16);return R(a,0,e,t,o,i),A(r,n,a,0)}function M(r,n,e,t,o){var i;if(e<32)return-1;for(T(r,0,n,0,e,t,o),R(r,16,r,32,e-32,r),i=0;i<16;i++)r[i]=0;return 0}function N(r,n,e,t,o){var i,a=new Uint8Array(32);if(e<32)return-1;if(L(a,0,32,t,o),0!==P(n,16,n,32,e-32,a))return-1;for(T(r,0,n,0,e,t,o),i=0;i<32;i++)r[i]=0;return 0}function O(r,n){var e;for(e=0;e<16;e++)r[e]=0|n[e]}function C(r){var n,e;for(e=0;e<16;e++)r[e]+=65536,n=Math.floor(r[e]/65536),r[(e+1)*(e<15?1:0)]+=n-1+37*(n-1)*(15===e?1:0),r[e]-=65536*n}function F(r,n,e){for(var t,o=~(e-1),i=0;i<16;i++)t=o&(r[i]^n[i]),r[i]^=t,n[i]^=t}function Z(r,n){var e,t,o,i=v(),a=v();for(e=0;e<16;e++)a[e]=n[e];for(C(a),C(a),C(a),t=0;t<2;t++){for(i[0]=a[0]-65517,e=1;e<15;e++)i[e]=a[e]-65535-(i[e-1]>>16&1),i[e-1]&=65535;i[15]=a[15]-32767-(i[14]>>16&1),o=i[15]>>16&1,i[14]&=65535,F(a,i,1-o)}for(e=0;e<16;e++)r[2*e]=255&a[e],r[2*e+1]=a[e]>>8}function G(r,n){var e=new Uint8Array(32),t=new Uint8Array(32);return Z(e,r),Z(t,n),_(e,0,t,0)}function q(r){var n=new Uint8Array(32);return Z(n,r),1&n[0]}function D(r,n){var e;for(e=0;e<16;e++)r[e]=n[2*e]+(n[2*e+1]<<8);r[15]&=32767}function I(r,n,e){var t;for(t=0;t<16;t++)r[t]=n[t]+e[t]|0}function V(r,n,e){var t;for(t=0;t<16;t++)r[t]=n[t]-e[t]|0}function X(r,n,e){var t,o,i=new Float64Array(31);for(t=0;t<31;t++)i[t]=0;for(t=0;t<16;t++)for(o=0;o<16;o++)i[t+o]+=n[t]*e[o];for(t=0;t<15;t++)i[t]+=38*i[t+16];for(t=0;t<16;t++)r[t]=i[t];C(r),C(r)}function j(r,n){X(r,n,n)}function H(r,n){var e,t=v();for(e=0;e<16;e++)t[e]=n[e];for(e=253;0<=e;e--)j(t,t),2!==e&&4!==e&&X(t,t,n);for(e=0;e<16;e++)r[e]=t[e]}function J(r,n){var e,t=v();for(e=0;e<16;e++)t[e]=n[e];for(e=250;0<=e;e--)j(t,t),1!==e&&X(t,t,n);for(e=0;e<16;e++)r[e]=t[e]}function Q(r,n,e){var t,o,i=new Uint8Array(32),a=new Float64Array(80),f=v(),u=v(),c=v(),w=v(),y=v(),l=v();for(o=0;o<31;o++)i[o]=n[o];for(i[31]=127&n[31]|64,i[0]&=248,D(a,e),o=0;o<16;o++)u[o]=a[o],w[o]=f[o]=c[o]=0;for(f[0]=w[0]=1,o=254;0<=o;--o)F(f,u,t=i[o>>>3]>>>(7&o)&1),F(c,w,t),I(y,f,c),V(f,f,c),I(c,u,w),V(u,u,w),j(w,y),j(l,f),X(f,c,f),X(c,u,y),I(y,f,c),V(f,f,c),j(u,f),V(c,w,l),X(f,c,g),I(f,f,w),X(c,c,f),X(f,w,l),X(w,u,a),j(u,y),F(f,u,t),F(c,w,t);for(o=0;o<16;o++)a[o+16]=f[o],a[o+32]=c[o],a[o+48]=u[o],a[o+64]=w[o];var s=a.subarray(32),h=a.subarray(16);return H(s,s),X(h,h,s),Z(r,h),0}function W(r,n){return Q(r,n,e)}function $(r,n){return a(n,32),W(r,n)}function rr(r,n,e){var t=new Uint8Array(32);return Q(t,e,n),x(r,o,t,d)}var nr=M,er=N;function tr(){var r,n,e,t=0,o=0,i=0,a=0,f=65535;for(e=0;e<arguments.length;e++)t+=(r=arguments[e].lo)&f,o+=r>>>16,i+=(n=arguments[e].hi)&f,a+=n>>>16;return new m((i+=(o+=t>>>16)>>>16)&f|(a+=i>>>16)<<16,t&f|o<<16)}function or(r,n){return new m(r.hi>>>n,r.lo>>>n|r.hi<<32-n)}function ir(){var r,n=0,e=0;for(r=0;r<arguments.length;r++)n^=arguments[r].lo,e^=arguments[r].hi;return new m(e,n)}function ar(r,n){var e,t,o=32-n;return n<32?(e=r.hi>>>n|r.lo<<o,t=r.lo>>>n|r.hi<<o):n<64&&(e=r.lo>>>n|r.hi<<o,t=r.hi>>>n|r.lo<<o),new m(e,t)}var fr=[new m(1116352408,3609767458),new m(1899447441,602891725),new m(3049323471,3964484399),new m(3921009573,2173295548),new m(961987163,4081628472),new m(1508970993,3053834265),new m(2453635748,2937671579),new m(2870763221,3664609560),new m(3624381080,2734883394),new m(310598401,1164996542),new m(607225278,1323610764),new m(1426881987,3590304994),new m(1925078388,4068182383),new m(2162078206,991336113),new m(2614888103,633803317),new m(3248222580,3479774868),new m(3835390401,2666613458),new m(4022224774,944711139),new m(264347078,2341262773),new m(604807628,2007800933),new m(770255983,1495990901),new m(1249150122,1856431235),new m(1555081692,3175218132),new m(1996064986,2198950837),new m(2554220882,3999719339),new m(2821834349,766784016),new m(2952996808,2566594879),new m(3210313671,3203337956),new m(3336571891,1034457026),new m(3584528711,2466948901),new m(113926993,3758326383),new m(338241895,168717936),new m(666307205,1188179964),new m(773529912,1546045734),new m(1294757372,1522805485),new m(1396182291,2643833823),new m(1695183700,2343527390),new m(1986661051,1014477480),new m(2177026350,1206759142),new m(2456956037,344077627),new m(2730485921,1290863460),new m(2820302411,3158454273),new m(3259730800,3505952657),new m(3345764771,106217008),new m(3516065817,3606008344),new m(3600352804,1432725776),new m(4094571909,1467031594),new m(275423344,851169720),new m(430227734,3100823752),new m(506948616,1363258195),new m(659060556,3750685593),new m(883997877,3785050280),new m(958139571,3318307427),new m(1322822218,3812723403),new m(1537002063,2003034995),new m(1747873779,3602036899),new m(1955562222,1575990012),new m(2024104815,1125592928),new m(2227730452,2716904306),new m(2361852424,442776044),new m(2428436474,593698344),new m(2756734187,3733110249),new m(3204031479,2999351573),new m(3329325298,3815920427),new m(3391569614,3928383900),new m(3515267271,566280711),new m(3940187606,3454069534),new m(4118630271,4000239992),new m(116418474,1914138554),new m(174292421,2731055270),new m(289380356,3203993006),new m(460393269,320620315),new m(685471733,587496836),new m(852142971,1086792851),new m(1017036298,365543100),new m(1126000580,2618297676),new m(1288033470,3409855158),new m(1501505948,4234509866),new m(1607167915,987167468),new m(1816402316,1246189591)];function ur(r,n,e){var t,o,i,a=[],f=[],u=[],c=[];for(o=0;o<8;o++)a[o]=u[o]=B(r,8*o);for(var w,y,l,s,h,v,g,b,p,A,_,U,E,x,d=0;128<=e;){for(o=0;o<16;o++)c[o]=B(n,8*o+d);for(o=0;o<80;o++){for(i=0;i<8;i++)f[i]=u[i];for(t=tr(u[7],ir(ar(x=u[4],14),ar(x,18),ar(x,41)),(p=u[4],A=u[5],_=u[6],0,U=p.hi&A.hi^~p.hi&_.hi,E=p.lo&A.lo^~p.lo&_.lo,new m(U,E)),fr[o],c[o%16]),f[7]=tr(t,ir(ar(b=u[0],28),ar(b,34),ar(b,39)),(l=u[0],s=u[1],h=u[2],0,v=l.hi&s.hi^l.hi&h.hi^s.hi&h.hi,g=l.lo&s.lo^l.lo&h.lo^s.lo&h.lo,new m(v,g))),f[3]=tr(f[3],t),i=0;i<8;i++)u[(i+1)%8]=f[i];if(o%16==15)for(i=0;i<16;i++)c[i]=tr(c[i],c[(i+9)%16],ir(ar(y=c[(i+1)%16],1),ar(y,8),or(y,7)),ir(ar(w=c[(i+14)%16],19),ar(w,61),or(w,6)))}for(o=0;o<8;o++)u[o]=tr(u[o],a[o]),a[o]=u[o];d+=128,e-=128}for(o=0;o<8;o++)S(r,8*o,a[o]);return e}var cr=new Uint8Array([106,9,230,103,243,188,201,8,187,103,174,133,132,202,167,59,60,110,243,114,254,148,248,43,165,79,245,58,95,29,54,241,81,14,82,127,173,230,130,209,155,5,104,140,43,62,108,31,31,131,217,171,251,65,189,107,91,224,205,25,19,126,33,121]);function wr(r,n,e){var t,o=new Uint8Array(64),i=new Uint8Array(256),a=e;for(t=0;t<64;t++)o[t]=cr[t];for(ur(o,n,e),e%=128,t=0;t<256;t++)i[t]=0;for(t=0;t<e;t++)i[t]=n[a-e+t];for(i[e]=128,i[(e=256-128*(e<112?1:0))-9]=0,S(i,e-8,new m(a/536870912|0,a<<3)),ur(o,i,e),t=0;t<64;t++)r[t]=o[t];return 0}function yr(r,n){var e=v(),t=v(),o=v(),i=v(),a=v(),f=v(),u=v(),c=v(),w=v();V(e,r[1],r[0]),V(w,n[1],n[0]),X(e,e,w),I(t,r[0],r[1]),I(w,n[0],n[1]),X(t,t,w),X(o,r[3],n[3]),X(o,o,l),X(i,r[2],n[2]),I(i,i,i),V(a,t,e),V(f,i,o),I(u,i,o),I(c,t,e),X(r[0],a,f),X(r[1],c,u),X(r[2],u,f),X(r[3],a,c)}function lr(r,n,e){var t;for(t=0;t<4;t++)F(r[t],n[t],e)}function sr(r,n){var e=v(),t=v(),o=v();H(o,n[2]),X(e,n[0],o),X(t,n[1],o),Z(r,t),r[31]^=q(e)<<7}function hr(r,n,e){var t,o;for(O(r[0],c),O(r[1],w),O(r[2],w),O(r[3],c),o=255;0<=o;--o)lr(r,n,t=e[o/8|0]>>(7&o)&1),yr(n,r),yr(r,r),lr(r,n,t)}function vr(r,n){var e=[v(),v(),v(),v()];O(e[0],t),O(e[1],f),O(e[2],w),X(e[3],t,f),hr(r,e,n)}function gr(r,n,e){var t,o=new Uint8Array(64),i=[v(),v(),v(),v()];for(e||a(n,32),wr(o,n,32),o[0]&=248,o[31]&=127,o[31]|=64,vr(i,o),sr(r,i),t=0;t<32;t++)n[t+32]=r[t];return 0}var br=new Float64Array([237,211,245,92,26,99,18,88,214,156,247,162,222,249,222,20,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16]);function pr(r,n){var e,t,o,i;for(t=63;32<=t;--t){for(e=0,o=t-32,i=t-12;o<i;++o)n[o]+=e-16*n[t]*br[o-(t-32)],e=Math.floor((n[o]+128)/256),n[o]-=256*e;n[o]+=e,n[t]=0}for(o=e=0;o<32;o++)n[o]+=e-(n[31]>>4)*br[o],e=n[o]>>8,n[o]&=255;for(o=0;o<32;o++)n[o]-=e*br[o];for(t=0;t<32;t++)n[t+1]+=n[t]>>8,r[t]=255&n[t]}function Ar(r){var n,e=new Float64Array(64);for(n=0;n<64;n++)e[n]=r[n];for(n=0;n<64;n++)r[n]=0;pr(r,e)}function _r(r,n,e,t){var o,i,a=new Uint8Array(64),f=new Uint8Array(64),u=new Uint8Array(64),c=new Float64Array(64),w=[v(),v(),v(),v()];wr(a,t,32),a[0]&=248,a[31]&=127,a[31]|=64;var y=e+64;for(o=0;o<e;o++)r[64+o]=n[o];for(o=0;o<32;o++)r[32+o]=a[32+o];for(wr(u,r.subarray(32),e+32),Ar(u),vr(w,u),sr(r,w),o=32;o<64;o++)r[o]=t[o];for(wr(f,r,e+64),Ar(f),o=0;o<64;o++)c[o]=0;for(o=0;o<32;o++)c[o]=u[o];for(o=0;o<32;o++)for(i=0;i<32;i++)c[o+i]+=f[o]*a[i];return pr(r.subarray(32),c),y}function Ur(r,n,e,t){var o,i=new Uint8Array(32),a=new Uint8Array(64),f=[v(),v(),v(),v()],u=[v(),v(),v(),v()];if(e<64)return-1;if(function(r,n){var e=v(),t=v(),o=v(),i=v(),a=v(),f=v(),u=v();if(O(r[2],w),D(r[1],n),j(o,r[1]),X(i,o,y),V(o,o,r[2]),I(i,r[2],i),j(a,i),j(f,a),X(u,f,a),X(e,u,o),X(e,e,i),J(e,e),X(e,e,o),X(e,e,i),X(e,e,i),X(r[0],e,i),j(t,r[0]),X(t,t,i),G(t,o)&&X(r[0],r[0],s),j(t,r[0]),X(t,t,i),G(t,o))return 1;q(r[0])===n[31]>>7&&V(r[0],c,r[0]),X(r[3],r[0],r[1])}(u,t))return-1;for(o=0;o<e;o++)r[o]=n[o];for(o=0;o<32;o++)r[o+32]=t[o];if(wr(a,r,e),Ar(a),hr(f,u,a),vr(u,n.subarray(32)),yr(f,u),sr(i,f),e-=64,_(n,0,i,0)){for(o=0;o<e;o++)r[o]=0;return-1}for(o=0;o<e;o++)r[o]=n[o+64];return e}function Er(r,n){if(32!==r.length)throw new Error("bad key size");if(24!==n.length)throw new Error("bad nonce size")}function xr(){for(var r=0;r<arguments.length;r++)if(!(arguments[r]instanceof Uint8Array))throw new TypeError("unexpected type, use Uint8Array")}function dr(r){for(var n=0;n<r.length;n++)r[n]=0}i.lowlevel={crypto_core_hsalsa20:x,crypto_stream_xor:T,crypto_stream:L,crypto_stream_salsa20_xor:K,crypto_stream_salsa20:Y,crypto_onetimeauth:R,crypto_onetimeauth_verify:P,crypto_verify_16:A,crypto_verify_32:_,crypto_secretbox:M,crypto_secretbox_open:N,crypto_scalarmult:Q,crypto_scalarmult_base:W,crypto_box_beforenm:rr,crypto_box_afternm:nr,crypto_box:function(r,n,e,t,o,i){var a=new Uint8Array(32);return rr(a,o,i),nr(r,n,e,t,a)},crypto_box_open:function(r,n,e,t,o,i){var a=new Uint8Array(32);return rr(a,o,i),er(r,n,e,t,a)},crypto_box_keypair:$,crypto_hash:wr,crypto_sign:_r,crypto_sign_keypair:gr,crypto_sign_open:Ur,crypto_secretbox_KEYBYTES:32,crypto_secretbox_NONCEBYTES:24,crypto_secretbox_ZEROBYTES:32,crypto_secretbox_BOXZEROBYTES:16,crypto_scalarmult_BYTES:32,crypto_scalarmult_SCALARBYTES:32,crypto_box_PUBLICKEYBYTES:32,crypto_box_SECRETKEYBYTES:32,crypto_box_BEFORENMBYTES:32,crypto_box_NONCEBYTES:24,crypto_box_ZEROBYTES:32,crypto_box_BOXZEROBYTES:16,crypto_sign_BYTES:64,crypto_sign_PUBLICKEYBYTES:32,crypto_sign_SECRETKEYBYTES:64,crypto_sign_SEEDBYTES:32,crypto_hash_BYTES:64,gf:v,D:y,L:br,pack25519:Z,unpack25519:D,M:X,A:I,S:j,Z:V,pow2523:J,add:yr,set25519:O,modL:pr,scalarmult:hr,scalarbase:vr},i.randomBytes=function(r){var n=new Uint8Array(r);return a(n,r),n},i.secretbox=function(r,n,e){xr(r,n,e),Er(e,n);for(var t=new Uint8Array(32+r.length),o=new Uint8Array(t.length),i=0;i<r.length;i++)t[i+32]=r[i];return M(o,t,t.length,n,e),o.subarray(16)},i.secretbox.open=function(r,n,e){xr(r,n,e),Er(e,n);for(var t=new Uint8Array(16+r.length),o=new Uint8Array(t.length),i=0;i<r.length;i++)t[i+16]=r[i];return t.length<32||0!==N(o,t,t.length,n,e)?null:o.subarray(32)},i.secretbox.keyLength=32,i.secretbox.nonceLength=24,i.secretbox.overheadLength=16,i.scalarMult=function(r,n){if(xr(r,n),32!==r.length)throw new Error("bad n size");if(32!==n.length)throw new Error("bad p size");var e=new Uint8Array(32);return Q(e,r,n),e},i.scalarMult.base=function(r){if(xr(r),32!==r.length)throw new Error("bad n size");var n=new Uint8Array(32);return W(n,r),n},i.scalarMult.scalarLength=32,i.scalarMult.groupElementLength=32,i.box=function(r,n,e,t){var o=i.box.before(e,t);return i.secretbox(r,n,o)},i.box.before=function(r,n){xr(r,n),function(r,n){if(32!==r.length)throw new Error("bad public key size");if(32!==n.length)throw new Error("bad secret key size")}(r,n);var e=new Uint8Array(32);return rr(e,r,n),e},i.box.after=i.secretbox,i.box.open=function(r,n,e,t){var o=i.box.before(e,t);return i.secretbox.open(r,n,o)},i.box.open.after=i.secretbox.open,i.box.keyPair=function(){var r=new Uint8Array(32),n=new Uint8Array(32);return $(r,n),{publicKey:r,secretKey:n}},i.box.keyPair.fromSecretKey=function(r){if(xr(r),32!==r.length)throw new Error("bad secret key size");var n=new Uint8Array(32);return W(n,r),{publicKey:n,secretKey:new Uint8Array(r)}},i.box.publicKeyLength=32,i.box.secretKeyLength=32,i.box.sharedKeyLength=32,i.box.nonceLength=24,i.box.overheadLength=i.secretbox.overheadLength,i.sign=function(r,n){if(xr(r,n),64!==n.length)throw new Error("bad secret key size");var e=new Uint8Array(64+r.length);return _r(e,r,r.length,n),e},i.sign.open=function(r,n){if(xr(r,n),32!==n.length)throw new Error("bad public key size");var e=new Uint8Array(r.length),t=Ur(e,r,r.length,n);if(t<0)return null;for(var o=new Uint8Array(t),i=0;i<o.length;i++)o[i]=e[i];return o},i.sign.detached=function(r,n){for(var e=i.sign(r,n),t=new Uint8Array(64),o=0;o<t.length;o++)t[o]=e[o];return t},i.sign.detached.verify=function(r,n,e){if(xr(r,n,e),64!==n.length)throw new Error("bad signature size");if(32!==e.length)throw new Error("bad public key size");var t,o=new Uint8Array(64+r.length),i=new Uint8Array(64+r.length);for(t=0;t<64;t++)o[t]=n[t];for(t=0;t<r.length;t++)o[t+64]=r[t];return 0<=Ur(i,o,o.length,e)},i.sign.keyPair=function(){var r=new Uint8Array(32),n=new Uint8Array(64);return gr(r,n),{publicKey:r,secretKey:n}},i.sign.keyPair.fromSecretKey=function(r){if(xr(r),64!==r.length)throw new Error("bad secret key size");for(var n=new Uint8Array(32),e=0;e<n.length;e++)n[e]=r[32+e];return{publicKey:n,secretKey:new Uint8Array(r)}},i.sign.keyPair.fromSeed=function(r){if(xr(r),32!==r.length)throw new Error("bad seed size");for(var n=new Uint8Array(32),e=new Uint8Array(64),t=0;t<32;t++)e[t]=r[t];return gr(n,e,!0),{publicKey:n,secretKey:e}},i.sign.publicKeyLength=32,i.sign.secretKeyLength=64,i.sign.seedLength=32,i.sign.signatureLength=64,i.hash=function(r){xr(r);var n=new Uint8Array(64);return wr(n,r,r.length),n},i.hash.hashLength=64,i.verify=function(r,n){return xr(r,n),0!==r.length&&0!==n.length&&(r.length===n.length&&0===u(r,0,n,0,r.length))},i.setPRNG=function(r){a=r},function(){var o="undefined"!=typeof self?self.crypto||self.msCrypto:null;if(o&&o.getRandomValues){i.setPRNG(function(r,n){var e,t=new Uint8Array(n);for(e=0;e<n;e+=65536)o.getRandomValues(t.subarray(e,e+Math.min(n-e,65536)));for(e=0;e<n;e++)r[e]=t[e];dr(t)})}else"undefined"!=typeof require&&(o=require("crypto"))&&o.randomBytes&&i.setPRNG(function(r,n){var e,t=o.randomBytes(n);for(e=0;e<n;e++)r[e]=t[e];dr(t)})}()}("undefined"!=typeof module&&module.exports?module.exports:self.nacl=self.nacl||{});
/*------------- end tweetnacl -----------------*/

/*-------------- begin common -----------------*/
let enableFullLogs, manualCommand;
console.log('%c' + 'Common version 3.1.0',
    'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');

class Common {
    _pingForks = 0;
    _pingForkLastState = false;

    constructor(mainCycle) {
        dLog('', 'constructor', 'mainCycle');
        this.bbStake = -1;
        this.bbCurrency = '';
        this.register = new RegisterCommand();
        this.qrCode = new QrCode();
        this.stakeForks = [];
        this.arbFork = null;
        this.domTree = {};
        this.checkMailAnswer = '';
        this.debuggerAt = null;
        this.checkIndexInArray = 0;
        this.mainCycle = mainCycle;
        this.forkCycle = mainCycle.forkCycle;
        this.showDebug = true;
        this.enableLogging = true;
        this.ws = null;
        this.wsDouble = null;
        this.command = {
            lastReceivedCommand: {},
            previousCommand: {},
            currentCommand: {},
            currentCommandWasSet: 0,
            lastDepositWithdraw: {},
            getText: function () {
                return Object.keys(this.currentCommand).length === 0 ? '' :
                    (this.currentCommand.action
                        ? this.currentCommand.action + ' for ' + this.currentCommand.bk + (this.currentCommand.double ? ' DOUBLE' : '')
                        : this.currentCommand.command + ' for ' + this.currentCommand.paysystem);
            }
        };
        this._tabs = {};
        this.createTabErrors = [];
        this._autoloadBks = JSON.parse(JSON.stringify(this._predefined('autoloadBks')));
        this.setAutoloadSettings();
        this._bks = JSON.parse(JSON.stringify(this._predefined('bks')));
        this._bkUrls = JSON.parse(JSON.stringify(this._predefined('bkUrls')));
        this._bkUrlCheck = JSON.parse(JSON.stringify(this._predefined('bkUrlCheck')));
        this._bkUrlsWasOverridenFor = [];
        this.scanner_bks = bbSettings.scanner_bks || [];
        this.limitedBks = [];
        this.stopped = {};
        this.stopSchedule = {};
        this.intervals = {};
        this.bkTabs = this._gBkTabs();
        this.bkReady = this._gBkTabs();
        this.bkBalances = this._gBkBalances();
        this.bkBalancesUpdated = this._gBkBalances();
        this.portQueue = this._gPortQueue();
        this.activePorts = {};
        this.cutChecked = Date.now();
        // TODO: Why I'd stopped using this mechanism? - maybe it is cuz my check was based on bkUrls?
        this._bkTitleCheck = {
            //olimp: 'Олимп'
        };
        this._settings = Common._getSettings();
        this.expires = this._settings.expires || 0;
        this.bkUrls = this._gBkUrls();
        const self = this;
        const checkResult = this._checkSettings(self)
            .then(() => {
                if (checkResult.length > 0) {
                    alert(checkResult.join('\n'));
                    throw checkResult;
                }
                self._addListener();
                self.switchOpenProhibited = false;
            })
            .then(() => self.loadSpecialSettings())
            .then(() => self.openExtensions())
            .then(() => self.closeOldTabs())
            .then(async () => {
                await delayPromise(5000);
                await self.checkChromeInitialized();
                await self.loadWindowList();
                self._portsInit();
                if (self._settings.restart) {
                    await self.removeFromStopped();
                }
            })
            .then(() => {
                chrome.storage.local.get(['stopped'], async result => {
                    self.stopped = result.stopped || {};
                    do {
                        self.createTabErrors = [];
                        await self.initialOpenBks(self.stopped)
                        if (self.createTabErrors.length > 0) {
                            console.log('%c' + 'createTabErrors:',
                                'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                            console.log(self.createTabErrors);
                            await delayPromise(5000);
                        }
                    } while (self.createTabErrors.length > 0);
                    self._serverInit();
                    self._checkCurrentOperationInit();
                    self._eightyMinutesInit();
                    //self._psApiInit();
                    self._fileMonitorInit();
                    self._getForkForStakeInit();
                    if (this.expires) {
                        self._hourlyBetResults();
                    }
                    const afterStart = await bMess('afterStart').check(30000, true)
                        .catch(() => null);
                    console.log('%c' + 'afterStart:',
                        'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    console.log(afterStart);
                    if (afterStart && afterStart.delay) {
                        await delayPromise(afterStart.delay);
                    }
                    if (afterStart && afterStart.action) {
                        self.proceedCommand(afterStart);
                    }
                    //self._sendStatus();
                });
            })
            .then(async () => {
                self.cutChecked = await bMess('cutChecked').check(86400000)
                    .catch(() => Date.now() - 300000);
            });
    }

    get busy() {
        // TODO: It must be the only way to check extension busy or free!
        return Object.keys(this.command.currentCommand).length !== 0;
    }

    get s() {
        return this._settings;
    }

    get autoloadBks() {
        const a = [];
        this._autoloadBks.forEach(bk => a.push(bk.toUpperCase() + '_URL'));
        return a;
    }

    static _getSettings() {
        const self = this;
        const hardcodedUrlRewrites = urls => {
            const result = {};
            Object.keys(urls).forEach(bk => {
                if (bk === 'winline') {
                    result[bk] = 'https://winline.by';
                } else if (urls[bk].indexOf('.kim') > -1) {
                    result[bk] = urls[bk].replace('.kim', '.ceo');
                } else {
                    result[bk] = urls[bk];
                }
            });
            return result;
        };
        return {
            expires: bbSettings.expires || 0,
            maxWaitForMail: 30000,
            experimental: bbSettings.experimental || false,
            use_chrome: false,
            restart: bbSettings.restart || false,
            profile: bbSettings.profile || '',
            maxWaitForRelease: 1200000,
            websocket_url: bbSettings.websocket_url || '',
            websocket_uid: bbSettings.websocket_uid || '',
            test_mode_on: bbSettings.test_mode_on || '',
            test_url: bbSettings.test_url || '',
            test_interval: bbSettings.test_interval || 1000,
            sms_api_url: bbSettings?.sms_api_url || '',
            sms_api_http_login: bbSettings?.sms_api_http_login || '',
            sms_api_http_password: bbSettings?.sms_api_http_password || '',
            ps_api_url: bbSettings?.ps_api_url || bbSettings?.sms_api_url?.replace('sims-manager', 'pay-systems'),
            ps_api_http_login: bbSettings?.ps_api_http_login || bbSettings?.sms_api_http_login,
            ps_api_http_password: bbSettings?.ps_api_http_password || bbSettings?.sms_api_http_password,
            email_api_url: bbSettings?.email_api_url || bbSettings?.sms_api_url?.replace('sims-manager', 'emails'),
            email_api_http_login: bbSettings?.email_api_http_login || bbSettings?.sms_api_http_login,
            email_api_http_password: bbSettings?.email_api_http_password || bbSettings?.sms_api_http_password,
            codes_url: bbSettings?.codes_api_url || bbSettings?.sms_api_url
                ?.replace('sims-manager', 'BotManager'),
            codes_http_login: bbSettings?.email_api_http_login || bbSettings?.sms_api_http_login,
            codes_http_password: bbSettings?.email_api_http_password || bbSettings?.sms_api_http_password,
            default_bk: bbSettings.default_bk || '',
            active_bks: bbSettings.active_bks || [],
            screenshot_api_url: bbSettings?.screenshot_api_url || '',
            screenshot_api_http_login: bbSettings?.screenshot_api_http_login || '',
            screenshot_api_http_password: bbSettings?.screenshot_api_http_password || '',
            forks_reload_interval: bbSettings.forks_reload_interval || 5000,
            own_ws_bks: bbSettings.own_ws_bks || [],
            double: bbSettings.double || {
                enabled: false,
                url: 'ws://ws.gamb.fun',
                uid: bbSettings.websocket_uid || '',
                server_name: bbSettings.server_name || ''
            },
            url_rewrite: hardcodedUrlRewrites(bbSettings.url_rewrite || {}),
        };
    }

    async loadSpecialSettings() {
        const self = this;
        const uid = await bMess('UID_OVERRIDE').check(86400000).catch(e => self.s.websocket_uid);
        if (this.s.websocket_uid !== uid) {
            dLog('bigred', '!!! UID OVERRIDE !!!', `${this.s.websocket_uid} => ${uid}`);
            this._settings.websocket_uid = uid;
        }
    }

    openExtensions() {
        return new Promise((onSuccess) => {
            chrome.tabs.query({}, tabs => {
                for (const tab of tabs) {
                    if (tab.url === 'chrome://extensions/') {
                        onSuccess();
                        return;
                    } else {
                        console.log('%c' + `Here is: '${tab.url}'`,
                            'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    }
                }
                chrome.tabs.create({url: 'chrome://extensions'}, onSuccess);
            });
        });
    }

    async _sendStatus() {
        const self = this;
        await waitForCondition(() => self.ws.readyState === 1, 100, 60000, 'WS not connected');
        for (const bk of this._settings.active_bks) {
            if (!this.stopped[bk]) {
                this.openBkAndSendActionWithData({
                    action: 'CHECK_BUSY',
                    data: [],
                    room: {
                        bk: this.intBkToExternal(bk),
                    }
                }, bk);
            } else {
                this.sendAnswer(bk, {
                    action: 'CALL_STOPPED',
                    data: [],
                    answer: 'BK ' + this.intBkToExternal(bk) + ' is STOPPED!',
                    bk: bk
                });
            }
        }
    }

    // await bMess('CHROME_INITIALIZED').set(true);
    async checkChromeInitialized() {
        const self = this;
        if (!this._settings.use_chrome) {
            return;
        }
        console.log('%c' + 'checkChromeInitialized', 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        if (await bMess('CHROME_INITIALIZED').check(30000, true).catch(() => false)) {
            return;
        }
        let connected = false;
        let confirmed = false;
        let answerReceived = false;
        let lastMessage = '';
        let parsedDataProfile = '';
        let error = false;
        const ws = new WebSocket(this._settings.websocket_url);
        ws.onopen = function (event) {
            //console.log('checkChromeInitialized ws OPENED!');
            connected = true;
        };
        ws.onclose = function (event) {
            //console.log('%c' + 'checkChromeInitialized CLOSED!', 'background: red; color: white; font-weight: bold;');
            connected = false;
        };
        ws.onmessage = function (event) {
            //console.log('%c' + 'checkChromeInitialized Received:', 'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            console.log(event.data);
            let parsed = false;
            try {
                parsed = JSON.parse(event.data);
            } catch (e) {
                console.log(e);
            }
            if (parsed.action === 'BET-STORM-RESULT') {
                parsedDataProfile = parsed.data.profile;
                confirmed = parsed.data && parsed.data.success && parsed.data.profile === self._settings.profile;
                error = parsed.data && parsed.data.success === false && parsed.data.profile === self._settings.profile;
                lastMessage = parsed.data && parsed.data.message ? parsed.data.message : 'No message!';
                answerReceived = true;
            }
        }
        await waitForCondition(() => connected, 100, 60000, 'WS not connected!');
        const started = Date.now();
        do {
            ws.send(JSON.stringify({
                action: 'BET-STORM-RESULT',
                data: {
                    profile: this._settings.profile,
                }
            }));
            await waitForCondition(() => answerReceived, 100, 3000).catch(() => null);
            if (answerReceived && !confirmed) {
                await delayPromise(3000);
            }
        } while (!confirmed && !error && Date.now() - started < 90000);
        ws.close();
        if (!confirmed) {
            throw `Bet-storm not active: ${lastMessage}`;
        } else {
            console.log('%c' + `Profile ('${self._settings.profile}' === '${parsedDataProfile}') looks active, but we'll wait 10s`,
                'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            await delayPromise(10000);
        }
    }

    setAutoloadSettings() {
        const fixKim = input => input.replace('.kim', '.ceo');
        bMess('AUTOLOAD').set({
            bks: this.autoloadBks,
            scripts: JSON.parse(JSON.stringify(bbSettings.commonSettings.bkScripts)),
            checks: JSON.parse(fixKim(JSON.stringify(bbSettings.commonSettings.bkAutoCheck))),
            liveUrls: JSON.parse(JSON.stringify(bbSettings.commonSettings.bkLiveUrl)),
            checkIndexInArray: this.checkIndexInArray,
        });
    }

    messageToBk(bk, message) {
        if (!this.portQueue[bk]) {
            this.portQueue[bk] = [];
        }
        this.portQueue[bk].push(message);
    }

    removeFromStopped(bk) {
        const self = this;
        return new Promise(onSuccess => {
            chrome.storage.local.get(['stopped'], function (result) {
                const stopped = !bk ? {} : result.stopped || {};
                if (bk) {
                    stopped[bk] = false;
                    self.stopSchedule[bk] = false;
                }
                self.stopped = stopped;
                chrome.storage.local.set({'stopped': stopped}, () => {
                    console.log('%c' + `Store Stopped: ${JSON.stringify(stopped)}, our stopped: ${JSON.stringify(self.stopped)}`,
                        'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    onSuccess();
                });
            });
        });
    }

    proceedCommand(command) {
        // Hint: BOT_RESTART and RESTART_BOT now in _checkCommandAndSet
        this.command.lastReceivedCommand = command;
        if (!this._checkCommandAndSet(command)) {
            return;
        }
        const self = this;
        const bk = this.extBkToInternal(command.bk);
        console.log('%c' + nowFormatted() + ' proceedCommand: ' + command.bk + ' = ' + bk + ' (' + command.action + ')',
            'background: orange; color: red; font-size: 12px; padding: 3px; 3px;');
        console.log(command);
        let wasInitialRequest = false;
        const ops = [
            {
                name: 'Fork bet',
                condition: () => command.action === 'FORK_BET',
                operation: async () => {
                    if (!self?.arbFork?.enabled()) {
                        dLog('bigred', 'Common', [`There is an arb bet, but arbFork is disabled!`, command]);
                    } else {
                        const {success, result} =
                            await self._transformFork(
                                JSON.parse(command.data),
                                new StakeFork({arbFork: self.arbFork},
                                    self.extBkToInternal, self),
                                false
                            );
                        if (success) {
                            self.openBkAndSendActionWithData(result, bk)
                        } else {
                            dLog('red', 'Common', [`Bad arb bet!`, command]);
                        }
                    }
                },
            },
            {
                name: 'Wait 5 minutes',
                condition: () => command.action === 'WAIT5MINUTES',
                operation: () => {
                    delayPromise(60000)
                        .then(() => console.log('%c' + 'One of five!', 'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;'))
                        .then(delayFunction(60000))
                        .then(() => console.log('%c' + 'Two of five!', 'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;'))
                        .then(delayFunction(60000))
                        .then(() => console.log('%c' + 'Three of five!', 'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;'))
                        .then(delayFunction(60000))
                        .then(() => console.log('%c' + 'Four of five!', 'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;'))
                        .then(delayFunction(60000))
                        .then(() => console.log('%c' + 'Five of five!', 'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;'))
                        .then(() => self.sendAnswer(bk, {
                            action: 'WAIT5MINUTES',
                            data: {
                                status: 'FINISHED',
                            }
                        }))
                },
            },
            {
                name: 'Command in MainCycle',
                condition: () => Object.keys(self.mainCycle.proceedCommand()).indexOf(command.action) > -1,
                operation: () => self.mainCycle.proceedCommand()[command.action](command, bk),
            },
            {
                name: 'STOP command',
                condition: () => command.action === 'STOP',
                operation: () => chrome.storage.local.get(['stopped'], function (result) {
                    if (!result.stopped) {
                        result.stopped = {};
                    }
                    if (!result.stopped[bk] && !command.newAPI) {
                        // Hint: Here we'll wait for release of currentOperation, if set
                        self._waitForCommandRelease()
                            .then(() => self.proceedCommand({
                                action: 'BET_RESULT',
                                bk: command.bk,
                                data: []
                            }))
                            .catch(() => self.sendAnswer(bk, {answer: 'BUSY'}));
                    }
                    result.stopped[bk] = true;
                    chrome.storage.local.set({'stopped': result.stopped});
                    if (command.newAPI) {
                        self.performClose(bk);
                        self.sendAnswer(bk, {
                            action: 'STOP',
                            data: {
                                status: 'STOPPED',
                            }
                        })
                    }
                }),
            },
            {
                name: 'START command',
                condition: () => command.action === 'START',
                operation: () => self.removeFromStopped(bk)
                    .then(() => self.openBk(bk, false))
                    .then(() => self.sendAnswer(bk, {
                        action: 'START',
                        data: {
                            status: 'STARTED',
                        }
                    })),
            },
            {
                name: 'Confirmation action',
                condition: () => command.action === 'CONFIRMATION',
                operation: () => self.messageToBk(bk, {
                    action: 'CONFIRMATION',
                    data: command.data ? command.data : false
                }),
            },
            {
                name: 'SMS action',
                condition: () => command.action === 'SMS',
                operation: () => self.messageToBk(bk, {
                    action: 'SMS',
                    data: command.data && command.data.code ? command.data.code : false
                }),
            },
            {
                name: 'takeScreenshot action',
                condition: () => command.action === 'takeScreenshot',
                operation: () => self.messageToBk(bk, {
                    action: 'takeScreenshot',
                    data: command.data
                }),
            },
            {
                name: 'DEPOSIT/WITHDRAW command',
                condition: () => ['DEPOSIT', 'WITHDRAW'].indexOf(command.action) > -1,
                operation: () => self._waitForCommandRelease()
                    .then(() => {
                        self.currentCommandSet(command);
                        command.data.url = self.bkUrls[bk];
                        command.data.bkPassword = self._settings[bk + '_password'];
                        self.openBkAndSendActionWithData(command, bk);
                        self.command.lastDepositWithdraw = command.data;
                    })
                    .catch(() => self.sendAnswer(bk, {answer: 'BUSY'})),
            },
            {
                name: 'CHANGE command',
                condition: () => command.action.indexOf('CHANGE') === 0,
                operation: () => {
                    bMess('UID_OVERRIDE')
                        .set(command.action
                            .replace('CHANGE(', '').replace(')', ''))
                        .then(() => self._reload());
                }
            },
            {
                name: 'PING command',
                condition: () => command.action === 'PING',
                operation: () => {
                    if (self._settings[bk + '_login'] === '*** TEST ***' && command.data.login
                        && command.data.password) {
                        self._settings[bk + '_login'] = command.data.login;
                        self._settings[bk + '_password'] = command.data.password;
                        self.reopenBkForce(bk);
                    }
                    if (['william', 'bet365'].indexOf(bk) > -1) {
                        self.messageToBk(bk, {
                            action: 'UPDATE_BALANCE'
                        });
                    }
                    if (bk === 'fon') {
                        self.openBk('fon', false);
                    }
                    const data = {
                        status: self.bkReady[bk] ? 'AVAILABLE' : 'BUSY',
                        funds: self.bkBalances[bk] === 'null' ? null : parseFloat(self.bkBalances[bk]),
                        fundsUpdated: self.bkBalancesUpdated[bk]
                    };
                    let test = '';
                    // if (data.status === 'AVAILABLE' && ['gamebookers', 'partypoker'].indexOf(bk) > -1 && !wasInitialRequest) {
                    //     wasInitialRequest = true;
                    //     data.status = "BUSY";
                    //     test = `BAD: ${data.status}/${(['gamebookers', 'partypoker'].indexOf(bk) > -1)}/${wasInitialRequest}`;
                    // }
                    if (['qiwi', 'skrill', 'blockchain', 'neteller', 'pm', 'payeer'].indexOf(bk) > -1) {
                        data.status = 'AVAILABLE';
                        data.funds = 0;
                        data.fundsUpdated = Date.now();
                    }
                    self.sendAnswer(bk, {
                        action: 'PONG',
                        data: data,
                        answer: `${bk} ${wasInitialRequest}: ${self.bkReady[bk]} test: ${test}`,
                    });
                },
            },
            {
                name: 'STATUS command',
                condition: () => command.action === 'STATUS',
                operation: () => {
                    if (self._settings[bk + '_login'] === '*** TEST ***' && command.data.login
                        && command.data.password) {
                        self._settings[bk + '_login'] = command.data.login;
                        self._settings[bk + '_password'] = command.data.password;
                        self.reopenBkForce(bk);
                    }
                    if (!self.bkReady[bk]) {
                        self.sendAnswer(bk, {
                            action: 'STATUS',
                            data: {
                                status: 'BUSY',
                                funds: self.bkBalances[bk] === 'null' ? null : parseFloat(self.bkBalances[bk]),
                                fundsUpdated: self.bkBalancesUpdated[bk]
                            }
                        });
                    } else {
                        command.action = "CHECK_BUSY";
                        self.openBkAndSendActionWithData(command, bk);
                    }
                },
            },
            {
                name: 'TIME_CHECK command',
                condition: () => command.action === 'TIME_CHECK',
                operation: () => {
                    self.sendAnswer(bk, {
                        action: 'TIME_CHECK',
                        data: {
                            status: !self.bkReady[bk] || self.bkBalances[bk] === 'null'
                            || (Math.floor(Date.now() / 1000) - self.bkBalancesUpdated[bk] > 70)
                                ? 'INACTIVE' : 'AVAILABLE',
                        },
                        answer: 'It was time_check request',
                    });
                },
            },
            {
                name: 'BET_RESULT command',
                condition: () => command.action === 'BET_RESULT',
                operation: () => self.openBkAndSendActionWithData(command, bk),
            },
            {
                name: 'CHECK_PAYMENTS command',
                condition: () => ['CHECK_PAYMENTS'].indexOf(command.action) > -1,
                operation: () => {
                    command.data.url = self.bkUrls[bk];
                    command.data.bkPassword = self._settings[bk + '_password'];
                    self.openBkAndSendActionWithData(command, bk);
                    self.command.lastDepositWithdraw = command.data;
                },
            },
            {
                name: 'REGISTER command',
                condition: () => ['REGISTER'].indexOf(command.action) > -1,
                operation: () => {
                    if (bk === 'onexbet') {
                        self._settings[bk + '_login'] = 'reger_work';
                    }
                    self.openBk(bk, false)
                        .then(() => {
                            self.messageToBk(bk, {
                                action: command.action,
                                data: command.data,
                                queue_id: command?.queue_id
                            });
                        });
                },
            },
            {
                name: 'CHECK_LIMITED',
                condition: () => 1 === 1,
                operation: () => {
                    self.openBkAndSendActionWithData(command, bk);
                },
            },
            {
                name: 'Action NOT SUPPORTED',
                condition: () => 1 === 1,
                operation: () => self.sendAnswer(bk, {
                    action: command.action,
                    data: {
                        status: 'NOT SUPPORTED',
                    },
                    answer: command.action + ' not supported for ' + command.bk
                }),
            },
        ];
        for (const op of ops) {
            if (op.condition()) {
                console.log('%c' + `${op.name} found!`,
                    'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                if (isAsyncFunction(op.operation)) {
                    op.operation()
                        .then(r => {
                        });
                } else {
                    op.operation();
                }
                break;
            }
        }
    }

    openBkAndSendActionWithData(command, bk) {
        const self = this;
        this.openBk(bk, false)
            .then(() => {
                if (Array.isArray(command.data)) {
                    command.data.forEach(function (item, idx) {
                        if (item.time_value) {
                            //item.time_value = item.time_value.replace(/(\w+)_(\d+)/g, '$2_$1');
                            if (['FOOTBALL', 'HANDBALL'].indexOf(item.sport) > -1
                                && ['1_TIME', 'TIME_1'].indexOf(item.time_value) > -1) {
                                command.data[idx].time_value = 'HALF_TIME';
                            }
                        }
                        if (item.score) {
                            if (item.score.search(/\d+:\d+/) === -1) {
                                command.data[idx].score = '';
                            }
                        }
                        if (!item.team1 && !!item.home) {
                            command.data[idx].team1 = item.home;
                        }
                        if (!item.team2 && !!item.away) {
                            command.data[idx].team2 = item.away;
                        }
                    });
                }
                const data = JSON.parse(JSON.stringify(command.data));
                self.messageToBk(bk, {
                    action: command.action,
                    data: ['BET', 'ARB_BET', 'FORK_BET', 'READY_TO_BET'].indexOf(command.action) > -1 ? [data.shift()] : data,
                    newAPI: true,
                    check_limited: !!command.check_limited,
                });
            });
    }

    _waitForCommandRelease() {
        const self = this;
        return new Promise((onSuccess, onReject) => {
            const waitStarted = Date.now();
            const wait = () => {
                if (!self.busy) {
                    onSuccess();
                } else if (Date.now() - waitStarted < self._settings.maxWaitForRelease) {
                    delayPromise(333).then(wait);
                } else {
                    onReject();
                }
            };

            wait();
        });
    }

    _checkCommandAndSet(command) {
        if (command && ['BOT_RESTART', 'RESTART_BOT'].indexOf(command.action) > -1) {
            const self = this;
            bMess('afterStart')
                .set({
                    action: 'STATUS',
                    bk: command.room.bk,
                    data: [],
                    room: JSON.parse(JSON.stringify(command.room)),
                    delay: 20000,
                })
                .then(() => chrome.runtime.reload());
            return false;
        } else if (!command) {
            dLog('red', 'Common', [`Empty command!`, formatStack((new Error()).stack)]);
        }
        const bk = this.extBkToInternal(command.bk);
        if (['qiwi', 'skrill', 'blockchain', 'neteller', 'pm', 'payeer', 'you_money'].indexOf(bk) === -1
            && (!bk || this._settings.active_bks.indexOf(bk) === -1)) {
            this.sendAnswer(bk, {
                action: command.action === 'PING' ? 'PONG' : command.action,
                data: {
                    status: 'BUSY'
                },
                answer: 'Unsupported BK! ' + command.bk + '/' + bk
            });
            return false;
        }
        if (this.limitedBks.indexOf(bk) > -1) {
            this.sendAnswer(bk,
                {
                    action: "BAD_REQUEST",
                    data: {
                        request: command.action,
                        status: "LIMITED"
                    },
                    answer: 'BK LIMITED! balance is ' + this.bkBalances[bk],
                    memo: 'limitedBks',
                }
            );
            this.performClose(bk);
            return false;
        }
        if (command.action !== 'START' && this.stopped[bk]) {
            this.sendAnswer(bk, {
                action: 'CALL_STOPPED',
                data: [],
                answer: 'BK ' + command.bk + ' is STOPPED!',
                bk: command.bk
            });
            return false;
        }
        // Commands witch can be executed till busy
        if (['STOP', 'START', 'SMS', 'DEPOSIT', 'WITHDRAW', 'takeScreenshot'].indexOf(command.action) > -1) {
            // But we have not to change current command!
            return true;
        } else if (this._checkExtensionIsFree(command, true, 'P4')) {
            if (bbSettings?.batery_stakeForks && ("excludePivots" in bbSettings.batery_stakeForks[0])) {
                let ignore = false;
                const currentMinutes = new Date().getMinutes();

                for (let i = 0; i < bbSettings.batery_stakeForks[0].excludePivots.length; i++) {
                    const [start, end] = bbSettings.batery_stakeForks[0].excludePivots[i].split('-').map(i => parseInt(i));
                    if (currentMinutes >= start && currentMinutes <= end) {
                        ignore = true;
                        break;
                    }
                }

                if (ignore) {
                    return false;
                }
            }

            if (command.action !== 'CHECK_LIMITED') {
                this.currentCommandSet(command);
            }
            return true;
        } else if (command.action === 'BET_RESULT'
            && !this._checkExtensionIsFree(command, true, 'P1')
            && command.bk.indexOf('365') === -1) {
            const brCommand = JSON.parse(JSON.stringify(command));
            const self = this;
            console.log('%c' + `Wait for command (${this.command.getText()}) release for BET_RESULT`,
                'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 10px; ');
            waitForCondition(() => self._checkExtensionIsFree(brCommand, true, 'P2'), 50, 330000)
                .then(() => console.log('%c' + 'BET_RESULT that has been delayed is starting now',
                    'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 10px;'))
                .then(() => self.proceedCommand(brCommand))
                .catch(e => console.log('%c' + `delayed BET_RESULT error: ${e}, ${formatStack(e)}`,
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 10px;'));
            return false;
        } else {
            // Hint: simple for answer BED_REQUEST
            if (command.action === 'BET' && command.data && command.data[0] && command.data[0].betFromParser) {
                dLog('', 'Common', [`_checkCommandAndSet:`, command]);
            } else {
                this._checkExtensionIsFree(command, false, 'P5');
            }
            return false;
        }
    }

    _checkExtensionIsFree(command, doNotSendAnswer, debug) {
        // TODO: Check this accuracy!
        if (this.busy &&
            !(command.action === 'ARB_BET' && this.command.currentCommand.action === 'READY_TO_BET'
                && this.command.currentCommand.bk === command.bk)
        ) {
            if (!doNotSendAnswer) {
                const left = this.getMaxTimeForCurrentOperation() - (Date.now() - this.command.currentCommandWasSet);
                this.sendAnswer(this.extBkToInternal(command.bk), {
                    action: 'BAD_REQUEST',
                    data: {
                        status: 'BUSY',
                        request: command.action
                    },
                    answer: `Bot executing ${this.command.getText()} ${(debug || '')} `
                        + `- ${command.action}, left: ${left / 1000} sec`,
                    bk: command.bk,
                    command: command,
                });
            }
            return false;
        } else {
            return true;
        }
    }

    proceedAnswer(message, bk) {
        if (Object.keys(this.mainCycle.proceedAnswer()).indexOf(message.answered) > -1) {
            this.mainCycle.proceedAnswer()[message.answered](message, bk);
        } else if (message.answered === 'DEBUG') {
            this.debug(message, bk);
        } else if (message.answered === 'auth_error') {
            this.sendAnswer(bk, {
                action: 'STATUS',
                result: 'FAILED',
                message: 'Wrong login or password',
                room: {
                    bk: bk,
                    uid: this.s.websocket_uid,
                    state: "INVALID_CREDENTIALS",
                    balance: null,
                },
                data: {
                    status: "INVALID_CREDENTIALS",
                }
            });
        } else if (message.answered === 'registerUsernameError') {
            this.sendAnswer(bk, {
                action: 'STATUS',
                result: 'FAILED',
                message: 'registerUsernameError',
                room: {
                    bk: bk,
                    uid: this.s.websocket_uid,
                    state: "INVALID_CREDENTIALS",
                    balance: null,
                },
                data: {
                    status: "INVALID_CREDENTIALS",
                }
            });
        } else if (message.answered === 'entry_limit') {
            this.sendAnswer(bk, {
                action: 'STATUS',
                result: 'FAILED',
                message: 'Entry limit!',
                room: {
                    bk: bk,
                    uid: this.s.websocket_uid,
                    state: "ENTRY_LIMIT",
                    balance: null,
                },
                data: {
                    status: "ENTRY_LIMIT",
                }
            });
        } else if (message.answered === 'proxy_error') {
            this.sendAnswer(bk, {
                action: 'STATUS',
                result: 'FAILED',
                message: 'Proxy error!',
                room: {
                    bk: bk,
                    uid: this.s.websocket_uid,
                    state: "PROXY_ERROR",
                    balance: null,
                },
                data: {
                    status: "PROXY_ERROR",
                }
            });
        } else if (message.answered === 'WITHDRAW_LIMITED') {
            this.sendAnswer(bk, {
                action: 'STATUS',
                result: 'FAILED',
                message: 'WITHDRAW_LIMITED',
                room: {
                    bk: bk,
                    uid: this.s.websocket_uid,
                    state: "WITHDRAW_LIMITED",
                    balance: message?.balance || null,
                },
                data: {
                    status: "WITHDRAW_LIMITED"
                }
            });
        } else if (message.answered === 'CONFIRMATION') {
            this.sendAnswer(bk, {
                action: 'CONFIRMATION',
                result: message.status,
                message: "",
                room: {
                    bk: bk,
                    uid: this.s.websocket_uid,
                    state: "BUSY",
                    "balance": null,
                },
                data: {}
            });
        } else if (message.answered === 'get_balance') {
            this.sendAnswer(bk, {
                action: 'PONG',
                data: {
                    status: message.status === "success" ? 'AVAILABLE' : 'BUSY',
                    funds: message.status !== "success" ? null : parseFloat(message.answer),
                    fundsUpdated: Math.floor(Date.now() / 1000)
                }
            });
        } else if (message.answered === 'takeScreenshot') {
            this.sendAnswer(bk, {
                action: 'takeScreenshot',
                data: {
                    status: message.status
                },
                answer: message.answer
            });
        } else if (['DEPOSIT', 'WITHDRAW'].indexOf(message.answered) > -1) {
            const data = {status: message.status,};
            if (message?.queue_id) {
                data.queue_id = message.queue_id;
            }
            this.sendAnswer(bk, {
                action: message.answered,
                data,
                answer: message.answer,
                balance: message.balance || false,
                wallet_balance: typeof message.wallet_balance === 'undefined' ? -2 : message.wallet_balance,
            });
            this.command.lastDepositWithdraw = {};
        } else if (message.answered === 'CHECK_PAYMENTS') {
            this.sendAnswer(bk, {
                action: message.answered,
                data: message.data,
                answer: message.answer
            });
            this.command.lastDepositWithdraw = {};
        } else if (message.answered === 'REGISTER') {
            let self = this;
            this.apiCommand('ps', {
                data: JSON.stringify({
                    "websocket_uid": this.s.websocket_uid,
                    "status": "report",
                    "id": message.data.queue_id,
                    "succeed": message.data.success ? "success" : "error",
                    "message": message.answer,
                    "from_extension": true
                })
            })
                .then(() => self.currentCommandClear())
                .catch((e) => self.sendAnswer(bk, {
                    action: message.answered,
                    data: message.data,
                    answer: e + ', when sent:' + message.answer
                }));
        } else if (message.answered === 'REGISTER_NEW') {
            this.sendAnswer(bk, {
                action: 'STATUS',
                answer: `REGISTER_NEW: ${message.status} => ${message.answer}`,
                data: {
                    status: 'BUSY',
                    funds: this.bkBalances[bk] === 'null' ? null : parseFloat(this.bkBalances[bk]),
                    fundsUpdated: this.bkBalancesUpdated[bk],
                }
            });
        } else if (message.answered === 'BET_RESULT') {
            this.sendAnswer(bk, {
                action: 'BET_RESULT',
                data: message.status === 'success' ? message.answer : [],
                answer: message.status === 'success' ? '' : message.answer,
                limited: message.limited || false,
            });
            const self = this;
            chrome.storage.local.get(['stopped'], function (result) {
                if (result.stopped && result.stopped[bk] && typeof self.stopSchedule[bk] !== 'number') {
                    self.sendAnswer(bk, {
                        action: 'STOP',
                        data: {
                            status: 'STOPPED',
                        }
                    });
                    //self.stopSchedule[bk] = Date.now() + getRandomRounded(300000, 1800000);
                    self.stopSchedule[bk] = Date.now() + getRandomRounded(60000, 120000);
                }
            });
        } else if (['CHECK_BUSY', 'CHECK_LIMITED'].indexOf(message.answered) > -1) {
            this.sendAnswer(bk, {
                action: message.answered === 'CHECK_BUSY' ? 'STATUS' : 'CHECK_LIMITED',
                data: {
                    status: message.limited ? 'LIMITED' : message.answer.indexOf('FREE') > -1 ? 'AVAILABLE' : 'BUSY',
                    funds: this.bkBalances[bk] === 'null' ? null : parseFloat(this.bkBalances[bk]),
                    fundsUpdated: this.bkBalancesUpdated[bk]
                },
                answer: message.answer || '',
            });
        } else {
            console.log('%c' + 'UNSUPPORTED ANSWER: ' + message.answered, 'background: red; color: yellow; font-size: 16px; font-weight: bold; padding: 10px 20px;');
            console.log(message, bk);
        }
    }

    _gBkTabs() {
        return this._fillBks(false);
    }

    _gBkBalances() {
        return this._fillBks('null');
    }

    _gBkUrls() {
        const t = Object.assign({}, this._bkUrls);
        const self = this;
        Object.keys(this._bkUrls).map(key => {
            if (self.s.url_rewrite[key] && self._bkUrlCheck[key]) {
                const d = /^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)/
                    .exec(self.s.url_rewrite[key]);
                if (d && d[1]) {
                    self._bkUrlCheck[key] = d[1];
                }
            }
            return t[key] = self.s.url_rewrite[key] || self._bkUrls[key];
        });
        return t;
    }

    _gPortQueue() {
        return this._fillBks([]);
    }

    debug(message, bk) {
        if (!this.showDebug) {
            return;
        }
        const backColor = message.error ? 'red' : (message.backColor || 'green');
        const fontColor = message.fontColor || 'white';
        console.log('%c' + bk + ' (' + nowFormatted() + '):' + message.answer,
            'background: ' + backColor + '; color: ' + fontColor + '; font-weight: bold;');
        Object.keys(message).forEach(key => key.indexOf('data') > -1 ? console.log(message[key]) : 1);
    }

    extBkToInternal(externalName, context) {
        const self = context || this;
        if (externalName === 'OLIMP') {
            return self.s.active_bks.indexOf('olimpold') > -1 ? 'olimpold' : 'olimp';
        } else {
            return Object.keys(self._bks).find(key => self._bks[key] === externalName);
        }
    }

    intBkToExternal(internalName) {
        if (['olimpold', 'olimp'].indexOf(internalName) > -1) {
            return 'OLIMP';
        } else {
            return this._bks[internalName];
        }
    }

    checkTab(tabId) {
        return new Promise((onSuccess) => {
            chrome.tabs.get(tabId, i => {
                if (!chrome.runtime.lastError) {
                    onSuccess(true);
                } else {
                    onSuccess(false);
                }
            });
        });
    }

    closeOldTabs() {
        const self = this;
        return new Promise((onSuccessOut) => {
            chrome.storage.local.get(['BE_OPENED_TABS'], r => {
                /**
                 * @type {Array}
                 */
                const ot = typeof r.BE_OPENED_TABS === 'undefined' ? [] : r.BE_OPENED_TABS;
                (async () => {
                    for (const o of ot) {
                        const tabId = parseInt(o);
                        if (await self.checkTab(tabId)) {
                            chrome.tabs.remove(tabId, () => console.log(`Tab ${tabId} removed!`));
                        }
                    }
                })()
                    .catch(e => dLog('red', 'BACK', `closeOldTabs: ${e}`))
                    .then(() => onSuccessOut());
            });
        });
    }

    loadWindowList() {
        const self = this;
        return new Promise((onSuccess) => {
            const popups = [];
            // Hint: We'll close popups first
            // TODO: Check - are we really need?
            const closePopups = () => {
                const current = popups.shift();
                if (current) {
                    chrome.windows.remove(current, () => {
                        console.log('Popup ' + current + ' closed!');
                        closePopups();
                    });
                } else {
                    virtuallyWork();
                }
            };
            const virtuallyWork = () => chrome.windows.getAll({populate: true},
                function (windowList) {
                    self._tabs = {};
                    for (let i = 0; i < windowList.length; i++) {
                        for (let j = 0; j < windowList[i].tabs.length; j++) {
                            self._tabs[windowList[i].tabs[j].id] = windowList[i].tabs[j];
                            //console.log(tabs[windowList[i].tabs[j].id]);
                            for (const bkWeCheckNow in self._bkUrlCheck) {
                                if (!self._bkUrlCheck.hasOwnProperty(bkWeCheckNow)) {
                                    continue;
                                }
                                // Hint: New way - first we check title!
                                if (typeof self._bkTitleCheck[bkWeCheckNow] === 'string'
                                    && windowList[i].tabs[j].title.indexOf(self.bkTitleCheck[bkWeCheckNow]) > -1) {
                                    self.bkTabs[bkWeCheckNow] = windowList[i].tabs[j].id;
                                    console.log('%c!!! loadWindowList: ' + bkWeCheckNow + ' found by title!',
                                        'background: orange; color: darkblue; font-weight: bold;');
                                    break;
                                } else if (typeof self._bkUrlCheck[bkWeCheckNow] === 'string'
                                    && windowList[i].tabs[j].url.indexOf(self._bkUrlCheck[bkWeCheckNow]) > -1) {
                                    self.bkTabs[bkWeCheckNow] = windowList[i].tabs[j].id;
                                    break;
                                }
                            }
                        }
                    }
                    onSuccess();
                });
            chrome.windows.getAll({populate: true}, windowList => {
                for (let i = 0; i < windowList.length; i++) {
                    if (windowList[i].type === 'popup') {
                        popups.push(windowList[i].id);
                    }
                }
                if (popups.length === 0) {
                    virtuallyWork();
                } else {
                    closePopups();
                }
            });
        });
    }

    checkBkInExistingTabs(bk) {
        for (const t in this._tabs) {
            if (this._tabs.hasOwnProperty(t)) {
                if (typeof this._bkTitleCheck[bk] === 'string' && this._tabs[t].title.indexOf(this._bkTitleCheck[bk]) > -1) {
                    console.log('%c!!! checkBkInExistingTabs: ' + bk + ' found by title!',
                        'background: orange; color: darkblue; font-weight: bold;');
                    return this._tabs[t].id;
                } else if (this._tabs[t].url.indexOf(this._bkUrlCheck[bk]) > -1) {
                    return this._tabs[t].id;
                }
            }
        }
        return false;
    }

    _setTabActive(tabId) {
        return new Promise((success, reject) => {
            chrome.tabs.update(tabId, {active: true}, () => {
                if (!chrome.runtime.lastError) {
                    success(true);
                } else {
                    reject(chrome.runtime.lastError);
                }
            });
        });
    }

    _createTab(url) {
        const self = this;
        return new Promise(onSuccess => {
            chrome.tabs.create({url: url}, function (tab) {
                if (chrome.runtime.lastError) {
                    self.createTabErrors.push(chrome.runtime.lastError);
                    console.warn('Error: ' + chrome.runtime.lastError.message);
                    onSuccess(undefined);
                } else {
                    onSuccess(tab);
                }
            });
        });
    }

    async getBkTab(bk, dontCheckInExistingTabs) {
        const bkTabId = await this.getTabId(bk);
        let result;
        if (bkTabId) {
            await this._setTabActive(bkTabId);
            result = bkTabId;
        } else {
            const newTab = await this._createTab(this.bkUrls[bk]);
            await this._addToOpenedTabs(newTab.id);
            result = newTab.id;
        }
        await this.loadWindowList();
        return result;
    }

    getTabId(bk) {
        const
            self = this,
            auto = !!bbSettings.commonSettings.bkAutoCheck[bk],
            autoRules = auto ? JSON.parse(bbSettings.commonSettings.bkAutoCheck[bk]) : null,
            conditionType = typeof this._bkTitleCheck[bk] === 'string' ? 'title' : 'url',
            condition = typeof this._bkTitleCheck[bk] === 'string' ? this._bkTitleCheck[bk] : this._bkUrlCheck[bk];
        if (auto) {
            console.log('%c' + 'AUTO',
                'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            console.log(autoRules);
        } else {
            console.log('%c' + `NON AUTO ${conditionType} = ${condition}`,
                'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        }
        return new Promise(success => {
            chrome.tabs.query({}, tabs => {
                for (const tab of tabs) {
                    if (!auto && tab[conditionType].indexOf(condition) > -1) {
                        success(tab.id);
                        return;
                    } else if (auto) {
                        if (checkRules(autoRules, {href: tab.url, title: tab.title})) {
                            success(tab.id);
                            return;
                        }
                    }
                }
                success(null);
            });
        });
    }

    _addToOpenedTabs(id) {
        return new Promise((onSuccess) => {
            chrome.storage.local.get(['BE_OPENED_TABS'], r => {
                const ot = r.BE_OPENED_TABS || [];
                ot.push(id);
                chrome.storage.local.set({'BE_OPENED_TABS': Array.from(new Set(ot))}, () => {
                    onSuccess(id);
                });
            });
        });
    }

    async openBk(bk, dontCheckInExistingTabs) {
        const self = this;
        await waitForCondition(() => self.switchOpenProhibited === false,
            333, 60000, 'switchOpenProhibited');
        try {
            await self.getBkTab(bk, dontCheckInExistingTabs);
        } catch (e) {
            this.createTabErrors.push(`openBk: ${e}`);
            console.log('%c' + `openBk: ${e}`,
                'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        }
    }

    reopenBk(bk) {
        const self = this;
        return new Promise((onSuccess) => {
            let bkTabId = self.bkTabs[bk] ? self.bkTabs[bk] : self.checkBkInExistingTabs(bk);
            // dLog('red', bk, `reopenBk ${bk}: ${bkTabId}`);
            if (bkTabId) {
                self.bkTabs[bk] = false;
                chrome.tabs.remove(bkTabId, () => {
                    if (chrome.runtime.lastError) {

                    }
                    self.openBk(bk, true)
                        .then(() => onSuccess());
                });
            } else {
                self.openBk(bk, true)
                    .then(() => onSuccess());
            }
        });
    }

    async reopenBkForce(bk) {
        const bkTabId = await this.getBkTab(bk);
        dLog('orange', '---------------------------------------------------------------------------------',
            `reopenBkForce - got ${bkTabId}`);
        await (() => new Promise(onSuccess => chrome.tabs.remove(bkTabId, () => {
            if (chrome.runtime.lastError) {

            }
            onSuccess();
        })))();
        await this.getBkTab(bk);
    }

    _needInitialOpen(bk, stopped) {
        if (this._settings[bk + '_login'] === '*** TEST ***' && !this.register.enabled()) {
            dLog('orange', 'COMMON', `Skip initial open because of TEST and not register!`);
            return false;
        } else if (stopped[bk]) {
            dLog('orange', 'COMMON', `Skip initial open because of ${bk} stopped!`);
            return false;
        }
        return true;
    }

    async initialOpenBks(stopped) {
        const self = this;
        console.log('%c' + `initialOpenBks: ${this._settings.active_bks.join(', ')}, stopped: ${Object.keys(stopped).join(', ')}`,
            'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        let was = false;
        for (const bk of this._settings.active_bks) {
            const exists = await this.getTabId(bk);
            if (exists) {
                await this.closeByTabId(exists);
                was = true;
            }
        }
        if (was) {
            //    this._reload();
        }
        for (const bk of this._settings.active_bks) {
            if (!this._needInitialOpen(bk, stopped)) {
                continue;
            }
            await this.reopenBk(bk);
            if (this.s.experimental) {
                setTimeout(() => {
                    self._switchToOtherTab(bk);
                }, 10000);
            }
        }
    };

    /**
     *
     * @param type - sms | ps | email
     * @param data
     * @return {Promise<any>}
     */
    apiCommand(type, data) {
        const self = this;
        return new Promise(function (onSuccess, onReject) {
            //console.log(url, data);
            const urlName = type + '_api_url', loginName = type + '_api_http_login',
                passwordName = type + '_api_http_password';
            $.ajax({
                type: "POST",
                url: self.s[urlName],
                dataType: 'json',
                username: self.s[loginName],
                password: self.s[passwordName],
                data: data,
                success: function (d) {
                    //console.log(d);
                    onSuccess(d);
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.error('apiCommand');
                    console.log(jqXHR, textStatus, errorThrown);
                    onReject(textStatus);
                }
            });
        });
    };

    _fillBks(value) {
        const t = Object.assign({}, this._bks);
        Object.keys(this._bks).map(key => t[key] = JSON.parse(JSON.stringify(value)));
        return t;
    }

    _checkIsBoth() {
        return this?.stakeForks?.length > 0 && this?.register?.enabled();
    }

    async _checkSettings(self) {
        let errors = [];
        let gotBbStake = false;
        chrome.storage.sync.get({
            bbStake: -1,
            bbCurrency: '',
        }, function (items) {
            self.bbStake = items.bbStake;
            self.bbCurrency = items.bbCurrency;
            if (self.bbStake > -1) {
                dLog('', 'background', `We got stake: ${self.bbStake}`);
            }
            if (self.bbCurrency !== '') {
                dLog('', 'background', `We got currency: ${self.bbCurrency}`);
            }
            gotBbStake = true;
        });
        while (!gotBbStake) {
            await delayPromise(50);
        }
        for (const [idx, val] of self._settings.active_bks.entries()) {
            if (typeof bbSettings[val + '_login'] === 'undefined'
                || typeof bbSettings[val + '_password'] === 'undefined') {
                errors.push(`Login or password for ${val} not defined!`);
            } else {
                dLog('blue', 'COMMON', [val + '_login', bbSettings[val + '_login']]);
                self._settings[val + '_login'] = bbSettings[val + '_login'];
                self._settings[val + '_password'] = bbSettings[val + '_password'];
                self._settings[val + '_phone'] = bbSettings[val + '_phone'];
                self._settings[val + '_email'] = bbSettings[val + '_email'];
                self._settings[val + '_second_name'] = bbSettings[val + '_second_name'];
                self._settings[val + '_jwt'] = bbSettings[val + '_jwt'] || '';
                self._settings[val + '_buyer'] = bbSettings[val + '_buyer'];
                self._settings[val + '_fork'] = bbSettings[val + '_fork'];
                if (bbSettings[val + '_stakeForks'] && typeof bbSettings[val + '_stakeForks'] === 'object'
                    && Array.isArray(bbSettings[val + '_stakeForks'])) {
                    // Hint: new approach
                    let i = 1;
                    for (const csf of bbSettings[val + '_stakeForks']) {
                        csf.number = i;
                        const stakeFork = new StakeFork(csf,
                            self.extBkToInternal, self);
                        if (stakeFork.bookie) {
                            self.stakeForks.push(stakeFork);
                            i++;
                        }

                    }
                } else if (bbSettings[val + '_stakeFork'] && bbSettings[val + '_stakeFork']['linkToParser']) {
                    // Hint: old approach
                    self.stakeForks.push(
                        new StakeFork(bbSettings[val + '_stakeFork'],
                            self.extBkToInternal, self)
                    );
                }
                if (bbSettings[val + '_fork']) {
                    self.arbFork = new ArbFork(bbSettings[val + '_fork']);
                    dLog('bigred', 'Common', ['arbFork:', self.arbFork.getAll()]);
                }
                if (self.stakeForks.length > 0) {
                    dLog('red', 'Common', ['stakeForks:', self.stakeForks]);
                }
                if (bbSettings[val + '_register'] && typeof bbSettings[val + '_register'] === 'object') {
                    bbSettings[val + '_register']['bk'] = val;
                    self.register = new RegisterCommand(bbSettings[val + '_register']);
                    dLog('red', 'Common', ['RegisterCommand:', self.register.getAll()]);
                } else {
                    dLog('orange', 'Common', [`No RegisterCommand: ${val + '_register'}`,
                        bbSettings[val + '_register']]);
                }
                if (bbSettings[val + '_qrCode'] && typeof bbSettings[val + '_qrCode'] === 'object') {
                    self.qrCode = new QrCode(bbSettings[val + '_qrCode']);
                    dLog('red', 'Common', ['QrCode:', self.qrCode.getAll()]);
                } else {
                    dLog('orange', 'Common', [`No QrCode: ${val + '_qrCode'}`,
                        bbSettings[val + '_qrCode']]);
                }
            }
        };
        if (this._checkIsBoth()) {
            dLog('big-red', 'Common', ['Both stakeForks and register enabled!']);
        }
        if (this._settings.test_mode_on && this._settings.test_url.length < 10) {
            errors.push('TEST mode enabled, but there is no Test Url!');
        }
        if (!this._settings.test_mode_on && (this._settings.websocket_url.length < 10 || this._settings.websocket_uid < 5)) {
            //errors.push('SERVER mode enabled, but there is no url or uid!');
        }
        if (this._settings.default_bk.length < 3 || this._settings.active_bks.indexOf(this._settings.default_bk) === -1) {
            //errors.push('Wrong Default BK!');
        }
        if (this._settings.active_bks.length < 1) {
            //errors.push('Empty Active BKs list!');
        }
        for (const [idx, val] of this._settings.active_bks.entries()) {
            if (typeof self._settings[val + '_login'] !== 'string' || self._settings[val + '_login'].length < 3) {
                errors.push('No login for ' + val);
            }
            if (typeof self._settings[val + '_password'] !== 'string' || self._settings[val + '_password'].length < 3) {
                errors.push('No password for ' + val);
            }
        };
        return errors;
    }

    closeTabByPartOfUrlOrId(partOfUrl, exact, tabId) {
        return new Promise(function (onSuccess, onReject) {
            if (tabId) {
                chrome.tabs.remove(tabId, function () {
                    onSuccess();
                });
            } else {
                chrome.windows.getAll({populate: true}, windowList => {
                    let tabId = -1;
                    for (let i = 0; i < windowList.length; i++) {
                        for (let j = 0; j < windowList[i].tabs.length; j++) {
                            if ((exact && windowList[i].tabs[j].url === partOfUrl)
                                || (!exact && windowList[i].tabs[j].url.indexOf(partOfUrl) > -1)) {
                                tabId = windowList[i].tabs[j].id;
                            }
                        }
                    }
                    if (tabId > -1) {
                        chrome.tabs.remove(tabId, function () {
                            onSuccess();
                        });
                    } else {
                        onSuccess();
                    }
                });
            }
        });
    }

    /**
     *
     *
     * @param {object} condition
     * @param {string[]} condition.every
     * @param {string[]} condition.some
     * @param maxTimeout
     * @param tabId
     * @returns {Promise<boolean>}
     */
    async closeThisEx(condition, maxTimeout, tabId) {
        const checkAndClose = () => new Promise(function (result) {
            chrome.tabs.query({}, function (tabs) {
                const check = l => condition.some.some(d => l.indexOf(d) > -1)
                    && condition.every.every(d => l.indexOf(d) > -1);
                const selected = tabs.some(t => check(t.url));
                if (selected) {
                    chrome.tabs.remove(tabId, function () {
                        if (chrome.runtime.lastError) {
                            console.log('Error till closeThisEx:', chrome.runtime.lastError);
                        }
                        result(true);
                    });
                } else {
                    result(false);
                }
            });
        });
        await waitForCondition(checkAndClose, 250, maxTimeout, 'Not closed!');
        return true;
    }

    performClose(bk) {
        let bkTabId = this.bkTabs[bk] !== false ? this.bkTabs[bk] : this.checkBkInExistingTabs(bk);
        if (bkTabId) {
            chrome.tabs.remove(bkTabId, () => {
                if (chrome.runtime.lastError) {
                    console.log('Error till CLOSE_ME:', chrome.runtime.lastError);
                }
                this.loadWindowList();
            });
        }
    }

    closeByTabId(tabId) {
        return new Promise(onSuccess => {
            chrome.tabs.remove(tabId, onSuccess);
        });
    }

    closeAllUnusedTabs() {
        const self = this;

        function getKeyByValue(object, value) {
            return Object.keys(object).find(key => object[key] === value);
        }

        (() => {
            console.log('%c!!! -------------------------- !!!', 'background: pink; color: blue; font-weight: bold;');
            console.log('%c!!! closeAllUnusedTabs !!!', 'background: pink; color: blue; font-weight: bold;');
            console.log('%c!!! -------------------------- !!!', 'background: pink; color: blue; font-weight: bold;');
        })();
        this.loadWindowList()
            .then(() => chrome.tabs.query({}, tabs => {
                let needRemove = [];
                tabs.forEach((i) => {
                    if (['chrome://extensions', 'about:blank', 'file://'].every(s => i.url.indexOf(s) === -1)
                        && typeof getKeyByValue(self.bkTabs, i.id) !== 'string') {
                        needRemove.push(i.id);
                    }
                    //console.log(i.url);
                });
                if (needRemove.length === tabs.length) {
                    needRemove.shift();
                }
                chrome.tabs.remove(needRemove);
            }));
    }

    async psWorks(dmess) {
        this.command.lastReceivedCommand = dmess;
        const data = dmess.data;
        data.close = true;
        const cmd = (dmess.paysystem === 'pm' ? 'PERFECT' : dmess.paysystem.toUpperCase()) + '_COMMAND';
        await bMess(cmd, dmess.paysystem !== 'you_money')
            .set({
                command: dmess.command,
                qiwiPayCheck: true,
                data
            });
        dLog('orange', '', [`We set ${cmd}`, dmess]);
        await this.openBk(dmess.paysystem.toLowerCase(), false);
        let res, err = '';
        res = await bMess('DEPOSIT_RESULT', true).get(360000)
            .catch(e => (err = e, res = false));
        if (!dmess.newAPI) {
            const resultPrepared = {
                "websocket_uid": this.s.websocket_uid,
                "status": "report",
                "id": dmess.queue_id,
                "succeed": res && res.success ? "success" : "error",
                "message": res && res.message ? res.message : err
            };
            await this.apiCommand('ps', {data: JSON.stringify(resultPrepared)})
                .catch(e => console.log(`%cPS send result: ${e}`, 'background: red; color: white; font-weight: bold; font-size: 22px;'));
        } else {
            this.sendAnswer(dmess.bk, {
                action: dmess.command,
                data: {
                    success: res && res.success,
                    pay_system: dmess.paysystem.toUpperCase(),
                    hash: dmess.data.hash || '',
                    login: dmess.data.login,
                    wallet_balance: res
                        ? (['QIWI', 'PM', 'PAYEER'].indexOf(dmess.paysystem.toUpperCase()) > -1
                            ? res.balance || ''
                            : res.message ? res.message.toString() : '')
                        : '',
                },
                answer: res ? res.message || 'No message!' : 'No res!',
            });
        }
        await bMess('DEPOSIT_RESULT', true).remove();
        await delayFunction(15000)();
        await this.closeTabByPartOfUrlOrId(this._bkUrlCheck[dmess.paysystem.toLowerCase()]);
    }

    logger(loggerName, params) {
        this.s.test_url = 'http://unioffers.ru/kb/';
        const loggers = {
            'logger': 'http://nbets.real/logger.php',
            'forkLogger': this.s.test_url + 'bb_bot.php?action=fork',
            'textLogger': this.s.test_url + 'bb_bot.php?action=textLog',
            'textScreen': this.s.test_url + 'bb_bot.php?action=textScreen'
        };
        if (typeof loggers[loggerName] !== 'string') {
            return;
        }
        params['botId'] = this.s.websocket_uid;
        const ajaxParams = {
            type: "POST",
            url: loggers[loggerName],
            data: params,
            success: function (d) {
                //console.log('%crequest success', 'font-weight: bold; color: white; background: blue;');
                //console.log(d);
                //sendResponse({success: true, message: d});
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log('%c' + 'Response error (logger):', 'background: transparent; color: red; font-size: 14px; font-weight: bold');
                console.log(jqXHR, textStatus, errorThrown);
                //sendResponse({success: false, message: textStatus});
            }
        };
        $.ajax(ajaxParams);
    }

    _blockedCodes(request, sendResponse) {
        const ajaxParams = {
            type: "POST",
            url: `${this.s.codes_url}/${request.blocked_action}`,
            data: {},
            success: function (d) {
                console.log(`%c_blockedCodes success`, 'font-weight: bold; color: white; background: blue;');
                //console.log(d);
                sendResponse({success: true, message: d});
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log('%c' + 'Response error (logger):',
                    'background: transparent; color: red; font-size: 14px; font-weight: bold');
                console.log(jqXHR, textStatus, errorThrown);
                sendResponse({success: false, message: textStatus});
            }
        };
        if (this.s.codes_http_login) {
            ajaxParams['username'] = this.s.codes_http_login;
            ajaxParams['password'] = this.s.codes_http_password;
        }
        $.ajax(ajaxParams);
    }

    _ajaxCall(request, url, sendResponse) {
        const data = request.data;
        if (typeof data.key === 'undefined') {
            data.key = this.s.websocket_uid;
        }
        let ajaxParams = {
            type: typeof request.useGET !== 'boolean' || request.useGET === false ? "POST" : "GET",
            url: url,
            dataType: 'json',
            data: request.data,
            success: function (d) {
                console.log('%crequest success', 'font-weight: bold; color: white; background: blue;');
                //console.log(d);
                sendResponse({success: true, message: d});
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log('%c' + 'Response error:', 'background: transparent; color: red; font-size: 14px; font-weight: bold');
                console.log(jqXHR, textStatus, errorThrown);
                sendResponse({success: false, message: textStatus});
            }
        };
        if (!request.noBaseAuth) {
            ajaxParams['username'] = request.url === 'screenshot' ? this.s.screenshot_api_http_login : this.s.sms_api_http_login;
            ajaxParams['password'] = request.url === 'screenshot' ? this.s.screenshot_api_http_password : this._settings.sms_api_http_password;
        }
        console.log('%c' + `Performing ajaxCall to ${request.url} with params:`,
            'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;',
            ajaxParams);
        $.ajax(ajaxParams);
    }

    _debuggerPromise(action, tabId, method, params) {
        const self = this;
        return new Promise(onSuccess => {
            if (action === 'attach' && self.debuggerAt !== tabId) {
                self.debuggerAt = tabId;
                chrome.debugger.attach({tabId: tabId}, "1.0", onSuccess);
            } else if (action === 'detach' && self.debuggerAt === tabId) {
                // Disable detaching
                //self.debuggerAt = null;
                //chrome.debugger.detach({tabId: tabId}, onSuccess);
                onSuccess(true);
            } else if (action === 'sendCommand') {
                chrome.debugger.sendCommand({tabId: tabId}, method, params, onSuccess);
            } else {
                onSuccess(true);
            }
        });
    }

    _mouseEventsChain(request, sendResponse) {
        const self = this;
        const tabId = this.bkTabs[request.bk];
        let current;
        const finish = () => chrome.debugger.detach({tabId: tabId}, () => sendResponse('Done!'));
        const goNextEvent = () => {
            if (request.debuggerEventsChain.length > 0) {
                setTimeout(debuggerEvent, typeof request.timeout !== 'number' ? 777 : request.timeout);
            } else {
                finish();
            }
        };
        const chromeSendCommand = (globalType, type, x, y, callback) => {
            if (['keyCode', 'keyFunction'].indexOf(globalType) > -1) {
                chrome.debugger.sendCommand({tabId: tabId}, 'Input.dispatchKeyEvent', {
                    type: type,
                    windowsVirtualKeyCode: x,
                    nativeVirtualKeyCode: x,
                    macCharCode: x
                }, callback);
            } else {
                chrome.debugger.sendCommand({tabId: tabId}, 'Input.dispatchMouseEvent', {
                    type: type,
                    button: 'left',
                    buttons: 1,
                    x: x,
                    y: y
                }, callback);
            }
        };
        let clickGo = function (res) {
            if (typeof res === 'undefined' || typeof res[0] === 'undefined' || res[0] === null) {
                console.error('No element with current!', current, res);
                goNextEvent();
            } else {
                console.log('%cTo perform:', 'background: blue; color: white; padding: 2px;', res[0]);
                if (current.type.indexOf('key') > -1) {
                    let keyCode = parseInt(res[0]);
                    chromeSendCommand(current.type, 'keyDown', keyCode, 0, () => {
                        chromeSendCommand(current.type, 'keyUp', keyCode, 0, () => {
                            console.log('%cDebugger -= KEYBOARD =- click (' + keyCode + ') performed at ' + request.bk,
                                'background: blue; color: yellow; font-weight: bold;');
                            goNextEvent();
                        });
                    });
                } else {
                    let leftPoint = res[0].left;
                    let topPoint = res[0].top;
                    chromeSendCommand(current.type, 'mouseMoved', leftPoint, topPoint, () => {
                        setTimeout(() => {
                            chromeSendCommand(current.type, 'mousePressed', leftPoint, topPoint, () => {
                                chromeSendCommand(current.type, 'mouseReleased', leftPoint, topPoint, () => {
                                    console.log('%cDebugger -= MOUSE =- click performed to ' + leftPoint + 'x' + topPoint + ' at ' + request.bk,
                                        'background: blue; color: yellow; font-weight: bold;');
                                    goNextEvent();
                                });
                            });
                        }, 555);
                    });
                }
            }
        };

        const debuggerEvent = (tabId, request) => {
            let current = request.debuggerEventsChain.shift();
            console.log('We took element:', current);
            let now = Date.now();

            if (current.type === 'keyCode') {
                clickGo([current.body]);
            }
            else if (current.type === 'selector') {
                const selector = current.body.replace(/"/g, '\\"');
                const codeFunc = () => {
                    const ___rect = document.querySelector(selector).getBoundingClientRect();
                    return {
                        left: getRandomRounded(___rect.left, ___rect.right),
                        top: getRandomRounded(___rect.top, ___rect.bottom)
                    };
                };
                chrome.scripting.executeScript(
                    {
                        target: { tabId },
                        func: codeFunc
                    },
                    (results) => clickGo(results.map(r => r.result))
                );
            }
            else if (current.type === 'function' || current.type === 'keyFunction') {
                const funcBody = current.body;
                const codeFunc = new Function(funcBody);
                chrome.scripting.executeScript(
                    {
                        target: { tabId },
                        func: codeFunc
                    },
                    (results) => clickGo(results.map(r => r.result))
                );
            }
            else {
                goNextEvent();
            }
        };
        (async () => {
            await self.loadWindowList();
            await this._debuggerPromise('attach', tabId, '', {});
            await delayPromise(3333);
            debuggerEvent();
        })();
    }

    _fonChangeUrl(newIndex) {
        this.checkIndexInArray = newIndex;
        // Hint: we have to update bkUrls
        const fonUrl = bbSettings.commonSettings.bkUrls['fon'].split(';')[this.checkIndexInArray].trim();
        this.bkUrls['fon'] = fonUrl + bbSettings.commonSettings.bkLiveUrl['fon'];
        const d = /^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)/.exec(fonUrl);
        if (d && d[1]) {
            this._bkUrlCheck['fon'] = d[1];
        }
        // Hint: we allows to override url again from contentScriptCheck
        const index = this._bkUrlsWasOverridenFor.indexOf('fon');
        if (index !== -1) {
            this._bkUrlsWasOverridenFor.splice(index, 1);
        }
        this.setAutoloadSettings();
        console.log('%c' + `checkIndexInArray changed to ${this.checkIndexInArray}`,
            'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    }

    async _puppeteerType(text, bk, delay) {
        const check = () => new Promise(onSuccess => {
            chrome.tabs.query({active: true}, tabs => onSuccess(tabs[0].id));
        });
        const self = this;
        const active = await check();
        const tabId = !isNaN(parseInt(bk)) ? bk : self.bkTabs[bk];
        const t = tabId === active ? tabId : (
            dLog('red', 'BG', `Try to use not active tab (${self.bkTabs[bk]}) instead of ${active}!`),
                active
        );
        // Hint: check tab exists
        dLog('orange', 'BG', `_puppeteerType (${t}): ${text}, ${bk}, ${delay}`);
        await self._debuggerPromise('attach', t, '', {});
        let finalText = text, modifiers = 0;
        if (text === '[CTRL+V]') {
            finalText = 'v';
            //  Alt=1, Ctrl=2, Meta/Command=4, Shift=8 (default: 0).
            modifiers = 2;
        }
        for (const char of finalText) {
            if (!!keyDefinitions[char]) {
                dLog('orange', 'BG', `PT - 1: '${char}'`);
                const description = _keyDescriptionForString(char);
                await self._debuggerPromise('sendCommand', t, 'Input.dispatchKeyEvent', {
                    type: description.text ? 'keyDown' : 'rawKeyDown',
                    modifiers: modifiers,
                    windowsVirtualKeyCode: description.keyCode,
                    code: description.code,
                    key: description.key,
                    text: description.text,
                    unmodifiedText: description.text,
                    autoRepeat: false,
                    location: description.location,
                    isKeypad: description.location === 3,
                });
                if (delay) {
                    await delayPromise(delay);
                }
                await self._debuggerPromise('sendCommand', t, 'Input.dispatchKeyEvent', {
                    type: 'keyUp',
                    modifiers: modifiers,
                    key: description.key,
                    windowsVirtualKeyCode: description.keyCode,
                    code: description.code,
                    location: description.location,
                });
            } else {
                dLog('orange', 'BG', `PT - 2: '${char}'`);
                if (delay) {
                    await delayPromise(delay);
                }
                await self._debuggerPromise('sendCommand', t, 'Input.insertText', {
                    text: char
                });
            }
        }
        await self._debuggerPromise('detach', t, '', {});
        dLog('orange', 'BG', `Detached!`);
    }

    /*
    chrome.runtime.sendMessage({captureDomSnapshot: true}, r => {
        console.log('%c' + 'Result is:', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        console.log(r);
    });
    chrome.runtime.sendMessage({getFrameTree: true}, r => {
        console.log('%c' + 'Result is:', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        console.log(r);
    });
    chrome.runtime.sendMessage({getFrameOffset: '#MembersIframe'}, r => {
        console.log('%c' + 'Result is:', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        console.log(r);
    });
     */

    //chrome.tabs.query({active: true}, t => t.forEach(t => console.log(t.id)));

    _addListener() {
        const self = this;
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            return self._listener(self, request, sender, sendResponse);
        });
    }

    _listener(self, request, sender, sendResponse) {
        const superExtendedLog = false;
        if (superExtendedLog) {
            console.log('%c' + `_listener fired from (${sender.url}) with request:`,
                'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            console.log(request);
        }
        const countNumbers = number => !superExtendedLog ? null : console.log('%c' + number,
            'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        const urls = {
            'rucaptchaSend': 'http://rucaptcha.com/in.php',
            'rucaptchaRes': 'http://rucaptcha.com/res.php',
        };
        if (request.KEEP_ALIVE) {
            // just trying to keep us alive
            chrome.runtime.getPlatformInfo(platformInfo => {
                // should be enough
                // console.log(platformInfo);
            });
        } else if (request.changeAutoloadSettings) {
            countNumbers('ONE');
            if (request.changeAutoloadSettings === 'checkIndexInArray' && request.valueToStore) {
                self._fonChangeUrl(typeof request.valueToStore === 'number' ? request.valueToStore : parseInt(request.valueToStore));
            }
        } else if (typeof request.loggerName === 'string' && self.enableLogging) {
            countNumbers('TWO');
            // Hint: LOGGER
            self.logger(request.loggerName, request.params);
            return false;
        } else if (typeof request.saveHtmlFileName === 'string' && typeof request.saveHtml === 'string') {
            countNumbers('THREE');
            // Hint: SEND_HTML to log websocket, if active
            if (self.logsEnabled()) {
                self.wsLog.send(JSON.stringify({
                    action: 'SAVE_HTML',
                    data: {
                        fileName: request.saveHtmlFileName,
                        html: request.saveHtml,
                    },
                }));
                sendResponse({success: true, message: "it should be sent"});
                return true;
            }
        } else if (typeof request.bLogger === 'string' && typeof request.bk === 'string' && self.showDebug && request.data) {
            countNumbers('FOUR');
            specialLog(request.bLogger, request.bk, request.data);
            if (self.logsEnabled()) {
                self.wsLog.send(JSON.stringify({
                    action: 'MESSAGE',
                    data: request.data,
                }));
            }
            return false;
        } else if (typeof request.documentUrl === 'string') {
            countNumbers('FIVE');
            // Hint: WS OVERRIDE
            //console.log('%c' + `webSocketUrl: '${request.webSocketUrl}',  documentUrl: ${request.documentUrl}, fakerId: ${request.fakerId}`,
            console.log('%c' + `documentUrl: ${request.documentUrl}`,
                'color: gray; font-size: 12px; font-weight: bold; padding: 0px;');
            const bks = Object.keys(self._bkUrlCheck).filter(bk => request.documentUrl
                .indexOf(self._bkUrlCheck[bk]) > -1);
            //sendResponse(false);
            sendResponse(bks.length > 0 && self.s.own_ws_bks.indexOf(bks[0]) > -1);
            return true;
        } else if (typeof request.contentScriptLoaded === 'string') {
            countNumbers('SIX');
            // Hint: contentScriptLoaded
            console.log(`contentScriptLoaded: ${request.contentScriptLoaded}`);
            return false;
        } else if (typeof request.backgroundSpecialAction === 'string'
            && request.backgroundSpecialAction === 'ajaxUrl'
            && typeof request.url !== 'undefined' && typeof urls[request.url] !== 'undefined'
            && typeof request.data !== 'undefined'
        ) {
            countNumbers('SEVEN');
            // Hint: AJAX REQUEST
            self._ajaxCall(request, urls[request.url], sendResponse);
            return true;
        } else if (typeof request.backgroundSpecialAction === 'string'
            && request.backgroundSpecialAction === 'qrCode'
            && typeof request.token === 'string'
            && this.qrCode.enabled()
        ) {
            countNumbers('SEVEN ONE');
            // Hint: Send QR CODE
            self.qrCode.xcftToken = request.token;
            self.qrCode.sendQueryFetch()
                .then(r => sendResponse(r))
                .catch(e => sendResponse(e));
            return true;
        } else if (typeof request.backgroundSpecialAction === 'string'
            && request.backgroundSpecialAction === '_checkMail'
            && typeof request.data !== 'undefined'
        ) {
            countNumbers('EIGHT');
            // Hint: CHECKING MAIL
            self._checkMail(request.data, sendResponse);
            return true;
        } else if (typeof request.backgroundSpecialAction === 'string'
            && request.backgroundSpecialAction === 'blockedCodes'
            && typeof request.blocked_action === 'string'
        ) {
            countNumbers('NINE');
            // Hint: BLOCKED CODES REQUEST
            self._blockedCodes(request, sendResponse);
            return true;
        } else if (typeof request.backgroundSpecialAction === 'string'
            && request.backgroundSpecialAction === 'reload'
        ) {
            self._reload();
            return true;
        } else if (request.pType && typeof request.bk === 'string') {
            countNumbers('TEN');
            // Hint: DEBUGGER TYPE
            self._puppeteerType(request.pType, request.bk === 'sender' ? sender.tab.id : request.bk,
                request.typeDelay || 0)
                .then(() => sendResponse('Done!'));
            return true;
        } else if (request.pressEnter && typeof request.bk === 'string') {
            countNumbers('ELEVEN');
            // Hint: PRESS ENTER
            const dc = {type: '', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, macCharCode: 13};
            const dCommand = type => {
                const d = JSON.parse(JSON.stringify(dc));
                d.type = type;
                return d;
            };
            const t = request.bk !== 'sender' ? self.bkTabs[request.bk] : sender.tab.id;
            (async () => {
                await self._debuggerPromise('attach', t, '', {});
                await self._debuggerPromise('sendCommand', t, 'Input.dispatchKeyEvent',
                    dCommand('keyUp'));
                await self._debuggerPromise('sendCommand', t, 'Input.dispatchKeyEvent',
                    dCommand('keyDown'));
                await self._debuggerPromise('detach', t, '', {});
            })()
                .then(() => sendResponse('Done!'));
            return true;
        } else if (request.mouseClickEvent && typeof request.bk === 'string') {
            countNumbers('TWELVE');
            // Hint: MOUSE CLICK TO COORDINATES
            const x = parseInt(request.meX), y = parseInt(request.meY);
            console.log('%c' + `mouseClickEvent (${request.bk}${(request.debug ? '/' + request.debug : '')})`
                + ` to ${x} x ${y}`,
                'background: lightblue; color: darkgreen; font-size: 10px; font-weight: bold; padding: 3px 10px;');
            const click = {type: '', button: 'left', x: x, y: y, modifiers: 0, clickCount: 1,};
            const move = {type: '', button: 'none', x: x, y: y, modifiers: 0,};
            const dCommand = type => {
                const d = JSON.parse(JSON.stringify(type === 'mouseMoved' ? move : click));
                d.type = type;
                return d;
            };
            const t = request.bk !== 'sender' ? self.bkTabs[request.bk] : sender.tab.id;
            const deb = type => ['sendCommand', t, 'Input.dispatchMouseEvent', dCommand(type)];
            self.loadWindowList()
                .then(() => self._setTabActive(t))
                .then(() => self.switchOpenProhibited = true)
                .then(() => self._debuggerPromise('attach', t, '', {}))
                .then(() => self._debuggerPromise(...deb('mouseMoved')))
                .then(() => self._debuggerPromise(...deb('mousePressed')))
                .then(() => delayPromise(25))
                .then(() => self._debuggerPromise(...deb('mouseReleased')))
                .then(() => self._debuggerPromise('detach', t, '', {}))
                .then(() => self.switchOpenProhibited = false)
                .then(() => sendResponse('Done!'));
            return true;
        } else if (request.debuggerEventsChain && typeof request.bk === 'string') {
            countNumbers('THIRTEEN');
            // Hint: MOUSE EVENTS CHAIN
            // mousePressed, mouseReleased, mouseMoved, mouseWheel
            self._mouseEventsChain(request, sendResponse);
            console.log('debuggerEventsChain for ' + request.bk, request.debuggerEventsChain);
            return true;
        } else if (typeof request.openBk === 'string') {
            countNumbers('FOURTEEN');
            // Hint: OPEN BK
            self.openBk(request.openBk.toLowerCase(), false)
                .then(() => sendResponse('Done!'));
            return true;
        } else if (typeof request.closeTabByPartOfUrl === 'string') {
            countNumbers('FIFTEEN');
            // Hint: CLOSE BY PART OF URL
            self.closeTabByPartOfUrlOrId(request.closeTabByPartOfUrl, request.closeExact)
                .then(() => sendResponse(`${request.closeTabByPartOfUrl} closed!`));
            return true;
        } else if (typeof request.closeThisByCondition === 'object') {
            countNumbers('SIXTEEN');
            // Hint: CLOSE this tab if other tab exists
            self.closeThisEx(request.closeThisByCondition, request.maxTimeout, sender.tab.id)
                .then(() => sendResponse(true))
                .catch(e => sendResponse(false));
            return true;
        } else if (typeof request.includeFile === 'string' && typeof request.bk === 'string') {
            countNumbers('SEVENTEEN');

            chrome.scripting.executeScript(
                {
                    target: { tabId: self.bkTabs[request.bk] },
                    files: [request.includeFile],
                    world: 'MAIN' // чтобы скрипт выполнялся в контексте страницы
                },
                () => sendResponse('Done!')
            );

            return true; // оставляем, чтобы Chrome понимал, что sendResponse будет вызван асинхронно
        } else if (request.addThisToOpenedTabs) {
            countNumbers('EIGHTEEN');
            // Hint: Add tab to opened tabs
            self._addToOpenedTabs(sender.id)
                .then(() => sendResponse(`${sender.id} added!`));
            return true;
        } else if (typeof request.getFrameOffset === 'string') {
            countNumbers('NINETEEN');
            // Hint: Get frame offset
            (async () => {
                await self._debuggerPromise('attach', sender.tab.id, '', {});
                //const frameTree = await self._debuggerPromise('sendCommand', sender.tab.id,
                //    'Page.getFrameTree', {});
                //const frame = findFrameByUrl(frameTree, request.getFrameOffset);
                //console.log(frame);
                //if (!frame) {
                //    return null;
                //}
                const {exceptionDetails, result: remoteObject} = await self._debuggerPromise(
                    'sendCommand', sender.tab.id, 'Runtime.evaluate', {
                        expression: `document.querySelector('${request.getFrameOffset}')`
                    });
                console.log('%c' + 'remoteObj:', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                console.log(remoteObject);
                const box = await self._debuggerPromise('sendCommand', sender.tab.id,
                    'DOM.getBoxModel', {objectId: remoteObject.objectId});
                console.log(box);
                return box;
            })()
                .then(answer => sendResponse(answer));
            return true;
        } else if (typeof request.captureDomSnapshot === "boolean") {
            countNumbers('TWENTY');
            // Hint: performing DOM snapshot
            self._debuggerPromise('attach', sender.tab.id, '', {})
                .then(() =>
                    self._debuggerPromise('sendCommand', sender.tab.id, 'DOMSnapshot.captureSnapshot', {
                        computedStyles: [],
                        includePaintOrder: false,
                        includeDOMRects: false,
                        includeBlendedBackgroundColors: false,
                        includeTextColorOpacities: false,
                    }))
                .then(res => {
                    console.log('%c' + 'DOMSnapshot:', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    const parsed = parseDOMSnapshot(res);
                    console.log(res);
                    console.log(parsed);
                    sendResponse(parsed);
                });
            return true;
        } else if (typeof request.getFrameTree === "boolean") {
            countNumbers('TWENTY-ONE');
            // Hint: getting Frame Tree
            self._debuggerPromise('attach', sender.tab.id, '', {})
                .then(() =>
                    self._debuggerPromise('sendCommand', sender.tab.id, 'Page.getFrameTree', {}))
                .then(res => {
                    console.log('%c' + 'Page.FrameTree:', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                    console.log(res);
                    sendResponse(res);
                });
            return true;
        } else if (!!request.SendBets) {
            countNumbers('TWENTY-TWO');
            // Hint: Send bets a-la betbuyer
            const messages = [];
            request.send.forEach(good => {
                const prepared = {
                    bookmaker: good.bk,
                    market: request.bet.bet.market,
                    target: request.bet.bet.target,
                    pivot: request.bet.bet.pivot,
                    homeTeam: request.bet.homeTeam,
                    awayTeam: request.bet.awayTeam,
                    league: request.bet.league,
                    coef: good.coef,
                    sport: request.bet.sport,
                    timeValue: request.bet.period === 'FULL_MATCH' ? 'FULL_TIME' : request.bet.period,
                    score: request.bet.score,
                    mode: request.bet.mode,
                    stake: request.bet.stake,
                    bk_event_native_id: '', // bet.event_native_id,
                    direct_link: '',
                };
                prepared['source_bk'] = request.bk === '1XSTAVKA' ? '1XBET' : request.bk;
                if (request.bk === '1XSTAVKA' && good.bk === '1XBET' && !!request.bet.direct_link) {
                    prepared['direct_link'] = request.bet.direct_link;
                }
                messages.push(prepared);
            });
            this._sendAjaxBets(messages, request.settings.secret);
        } else {
            countNumbers('TWENTY-THREE');
        }
    }

    _sendAjaxBets(message, secret, server) {
        const url = server || 0;
        const params = {
            type: "POST",
            url: [
                'https://bsa.betexy.com/bet?secret=' + secret,
                'http://185.231.155.140/bb_parser.php?action=store&format=our&secret=' + secret
            ][url],
            dataType: 'json',
            data: Array.isArray(message) ? JSON.stringify(message) : message,
            contentType: Array.isArray(message) ? 'json' : "application/x-www-form-urlencoded; charset=UTF-8",
            success: function (d) {
                console.log(message);
                console.log('message sent with result:', d);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log('%c' + 'Error sending', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                console.log(message);
                console.log(jqXHR, textStatus, errorThrown);
            }
        };
        if (url === 0) {
            params.username = 'partner';
            params.password = '9mE4qrey2Mvy3r3T';
        }
        $.ajax(params);
    }

    askTab(tabId, question, needAnswer) {
        return new Promise(function (success) {
            if (!!needAnswer) {
                chrome.tabs.sendMessage(tabId, question, success);
            } else {
                chrome.tabs.sendMessage(tabId, question);
                success(true);
            }
        });
    }

    currentCommandSet(command) {
        // TODO: It also used for PaySystems!
        this.command.currentCommandWasSet = Date.now();
        this.command.currentCommand = command;
        console.log('%c' + nowFormatted() + ' ' + this.command.getText() + ' was set!',
            'background: pink; color: black; font-size: 12px; font-weight: bold; padding: 3px; 3px;');
    }

    currentCommandClear() {
        const self = this;
        const clear = () => {
            const message = self.busy
                ? self.command.getText() + ' was cleared!'
                : `We hadn't any command`;
            console.log('%c' + nowFormatted() + ' ' + message,
                'background: pink; color: black; font-size: 12px; font-weight: bold; padding: 3px; 3px;');
            self.command.previousCommand = self.command.currentCommand;
            self.command.currentCommand = {};
        };
        if (this.forkCycle) {
            delayPromise(1000)
                .then(clear);
        } else {
            clear();
        }
    }

    _finalSend(answer) {
        const self = this;
        if (!this.ws || this.ws.readyState !== 1) {
            waitForCondition(() => self.ws && self.ws.readyState === 1, 333, 15000,
                'Ws not connected!')
                .then(() => self._finalSend(answer))
                .catch(() => self._finalSend(answer));
        } else {
            try {
                self.ws.send(JSON.stringify(answer));
                if (answer.action === "PING_FORK") {
                    if (answer.busy === this._pingForkLastState && this._pingForks <= 10) {
                        this._pingForks++;
                        return;
                    } else if (answer.busy !== this._pingForkLastState) {
                        this._pingForkLastState = answer.busy;
                        this._pingForks = 0;
                    } else if (this._pingForks > 10) {
                        this._pingForks = 0;
                    }
                }
                dLog('blue', 'COMMON', ['We sent:', answer]);
            } catch (e) {
                console.error(e);
                console.log('%c' + `We'd tried to send:`,
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                console.log(answer);
                self._wsInitPromise()
                    .then(delayFunction(1000))
                    .then(() => self._finalSend(null, null, null, answer));
            }
            self.command.lastReceivedCommand = {};
        }
    };

    _checkMail(answer, sendResponse) {
        const self = this;
        (new Promise(async (result) => {
            self.checkMailAnswer = '';
            self._finalSend(answer);
            let error = '';
            const parsed = JSON.parse(answer.data);
            dLog('blue', 'COMMON', `Wait for email for: `
                + (parsed.overrideTimeout || self.s.maxWaitForMail));
            await waitForCondition(() => !!self.checkMailAnswer, 100,
                parsed.overrideTimeout || self.s.maxWaitForMail,
                'No answer from checkMail').catch(e => error = e);
            let emailRes = !!error
                ? error
                : JSON.parse(JSON.stringify(self.checkMailAnswer));
            dLog('blue', 'COMMON', ['We got checkMail answer:', emailRes]);
            result({success: !error, message: emailRes});
            self.checkMailAnswer = '';
        })).then(sendResponse);
    }

    /**
     * Send response to server
     * @param bk - internal bk name
     * @param answer
     * @param releaseCommand - should we release command? (default - yes)
     * @param [readyAnswer] - should we just send already prepared command? if yes - command must be here, default - null
     */
    sendAnswer(bk, answer, releaseCommand, readyAnswer) {
        const self = this;
        if (readyAnswer) {
            this._finalSend(readyAnswer);
            return;
        }
        const shouldRelease = typeof releaseCommand === 'undefined' ? true : releaseCommand;
        console.log('%c' + nowFormatted() + ' should sendAnswer from ' + bk + ':',
            'background: blue; color: white; font-size: 13px; font-weight: bold; padding: 3px; 40px;');
        console.log(answer);
        // This is 100% guarantee for real cloning :)
        const ccBackup = JSON.parse(JSON.stringify(this.command.currentCommand));
        const commandBackup = JSON.parse(JSON.stringify(this.command));
        // We do not clear current operation if we executing command
        if (answer.action !== 'BAD_REQUEST' && answer.action !== 'WAIT_FOR_SMS' && shouldRelease) {
            this.currentCommandClear();
        }
        if (!!answer.doNotSend) {
            dLog('red', 'Common', `Don't need false result for parser's bet!`);
            return;
        }
        if (typeof answer.bk !== 'string' || answer.bk.length < 3) {
            answer.bk = this.intBkToExternal(bk);
        }
        if (ccBackup.bm_id || this.command.lastReceivedCommand.bm_id) {
            answer.bm_id = ccBackup.bm_id || this.command.lastReceivedCommand.bm_id;
        }
        if (!ccBackup.bm_id && answer.action === "STATUS" && answer.result === "FAILED"
            && commandBackup && commandBackup.previousCommand && commandBackup.previousCommand.bm_id) {
            answer.bm_id = commandBackup.previousCommand.bm_id;
        }
        if (answer.action === 'BAD_REQUEST' || answer.answer === 'BUSY') {
            answer.original_command = this.command.lastReceivedCommand.action;
            answer.busy = true;
            if (['BET', 'EXPRESS_BET'].indexOf(this.command.lastReceivedCommand.action) > -1) {
                answer.action = 'BET_RESULT';
                answer.data = {
                    "external_id": '',
                    "status": 'NOT_PLACED',
                    "market": this.command.lastReceivedCommand.data[0].market,
                    "target": this.command.lastReceivedCommand.data[0].target,
                    "pivot": this.command.lastReceivedCommand.data[0].pivot,
                    "coef": this.command.lastReceivedCommand.data[0].coef,
                    "stake": this.command.lastReceivedCommand.data[0].stake,
                    "maximum": '0',
                };
            } else {
                answer.action = 'STATUS';
                answer.data = {
                    "request": this.command.lastReceivedCommand.action,
                };
            }
            answer.memo = 'Second sendAnswer';
        } else {
            answer.original_command = ccBackup.action;
        }
        answer.funds = answer.balance && !isNaN(parseFloat(answer.balance))
            ? parseFloat(answer.balance)
            : this.bkBalances[bk] === 'null' ? null : parseFloat(this.bkBalances[bk]);
        if (answer.wallet_balance === -2) {
            answer.wallet_balance = '';
        } else if (answer.wallet_balance) {
            answer.wallet_balance = answer.wallet_balance.toString();
        }
        if (['DEPOSIT', 'WITHDRAW'].indexOf(ccBackup.action) > -1
            && typeof ccBackup.data === 'object' && !(ccBackup.data instanceof Array) && ccBackup.data.hash
            && typeof answer.data === 'object' && !(answer.data instanceof Array)
        ) {
            answer.data['hash'] = ccBackup.data.hash;
        }
        this._finalSend(JSON.parse(JSON.stringify(answer)));
        if (this.s.experimental &&
            !(answer.action === 'PONG' && answer.data && answer.data.status === 'BUSY')) {
            this._switchToOtherTab();
        }
    }

    _switchToOtherTab(bk, counter) {
        if (this._settings.active_bks.indexOf('stake') > -1) {
            console.log(`We're not switching tab for stake!`);
            return;
        }
        if (bk && !this.bkReady[bk] && (!counter || counter < 20)) {
            const self = this;
            setTimeout(() => {
                self._switchToOtherTab(bk, counter ? counter++ : 1);
            }, 10000);
            return;
        }
        const self = this;
        chrome.tabs.query({}, function (tabs) {
            for (const tab of tabs) {
                if (!tab.active && (!bk || self.bkTabs[bk] !== tab.id)) {
                    chrome.tabs.get(tab.id, tab => {
                        if (!chrome.runtime.lastError) {
                            chrome.tabs.update(tab.id, {active: true}, () =>
                                console.log(`Tab switched: ${bk}/${counter}/${self.bkTabs[bk]}/${tab.id}`)
                            );
                        } else {
                            console.error(chrome.runtime.lastError);
                        }
                    });
                }
            }
        });
    }

    _predefinedCommandProcessor() {
        const self = this;
        return {
            'CLOSE_ME': async (bk, message) => {
                console.log('CLOSE_ME', message);
                if (typeof message.condition === 'string') {
                    let waitStarted = Date.now();
                    let waitProcedure = function () {
                        console.log('waitProcedure...');
                        chrome.tabs.query({url: message.condition}, function (tabs) {
                            if (tabs.length > 0) {
                                self.performClose(bk);
                            } else if (typeof message.wait !== 'undefined' && Date.now() - waitStarted < message.wait) {
                                delayPromise(3333).then(waitProcedure);
                            } else if (typeof message.no_condition !== 'undefined'
                                && typeof message.no_condition.function === 'string') {
                                if (self._callbacks()[message.no_condition.function]) {
                                    self._callbacks()[message.no_condition.function](message.no_condition.success, message.no_condition.message, bk);
                                    console.log('NO_CONDITION EXECUTED!');
                                }
                            } else {
                                console.log('JUST NO: ' + typeof message.no_condition);
                            }
                        });
                    };
                    waitProcedure();
                } else {
                    self.performClose(bk);
                }
            },
            'SEND_ANSWER': async (bk, message) => {
                self.sendAnswer(bk, message.toSend);
            },
            'SMS_API_SEND': async (bk, message) => {
                self.apiCommand('sms', {
                    action: message.toSend.action,
                    data: JSON.stringify(message.toSend.data)
                })
                    .then((d) => {
                        console.log('we sent data:', d);
                        self.messageToBk(bk, {
                            action: 'SMS_API',
                            data: d
                        });
                    })
                    .catch((e) => {
                        self.messageToBk(bk, {
                            action: 'SMS_API',
                            data: {
                                status: 'error',
                                message: 'smsApiCommand: ' + e
                            }
                        });
                    });
            },
            'PAGE LOADED!': async (bk, message) => {
                // Hint: Bookie content script page init
                if (await bMess('STAKE_AlreadyRegistered')
                    .check(300, false, true)
                    .catch(() => false)) {
                    dLog('orange', 'common',
                        `Register command presented,  but we are already registered!`);
                    self.register.disable();
                }
                if (self.register.enabled()) {
                    const mess = {
                        action: 'REGISTER_NEW',
                        data: self.register.getAll(self._settings[bk + '_login'] === '*** TEST ***'),
                        bk: self.intBkToExternal(bk),
                    };
                    mess.data['uid'] = self._settings.websocket_uid;
                    dLog('orange', 'common', [`REGISTER_NEW message to BK ${bk}`, mess]);
                    self.proceedCommand(mess);
                } else if (self._settings[bk + '_login'] !== '*** TEST ***') {
                    const mess = {
                        action: 'auth',
                        login: self._settings[bk + '_login'],
                        password: self._settings[bk + '_password'],
                        uid: self._settings.websocket_uid,
                        start_url: self.bkUrls[bk],
                        phone: typeof self._settings[bk + '_phone'] !== 'string' ? '' : self._settings[bk + '_phone'],
                        email: typeof self._settings[bk + '_email'] !== 'string' ? '' : self._settings[bk + '_email'],
                        second_name: typeof self._settings[bk + '_second_name'] !== 'string' ? '' : self._settings[bk + '_second_name'],
                        renew: typeof self._settings[bk + '_renew'] === 'undefined' ? '' : parseInt(self._settings[bk + '_renew']) * 60000,
                        fork: self?.arbFork?.bookie ? self.arbFork.getAll() : {},
                        buyer: self.s[bk + '_buyer'],
                        // TODO: Improve for multiple stake forks
                        stake_fork: self.stakeForks.length > 0 ? self.stakeForks[0].getBkParams() : {},
                    };
                    if (self.qrCode.enabled()) {
                        mess.qr_code = self.qrCode.getAll();
                    }
                    dLog('orange', 'common', [`Message to BK ${bk}`, mess]);
                    self.messageToBk(bk, mess);
                } else {
                    dLog('orange', 'common', 'Do not login with *** TEST ***');
                    self.messageToBk(bk, {action: 'auth', login: '*** TEST ***'});
                }
            },
            'DEPOSIT_REQUEST': async (bk, message) => {
                // under the hood it calls /pay-systems/api/add-payment through bot manager
                self._finalSend({
                    action: "DEPOSIT_REQUEST",
                    bk,
                    data: {
                        address: message.address,
                        amount: message.amount,
                        binance_api: message.binance_api,
                        login: self._settings[bk + '_login'],
                        email: message.email,
                    },
                });
            },
            'authorized!': async (bk, message) => {
                self.bkReady[bk] = !message.limited;
                if (typeof message.balance !== 'undefined' && message.balance !== 'null') {
                    self.bkBalances[bk] = message.balance;
                    self.bkBalancesUpdated[bk] = Math.floor(Date.now() / 1000);
                }
                if (typeof message.forkFree !== 'undefined') {
                    self._finalSend({
                        action: "PING_FORK",
                        busy: !message.forkFree,
                    });
                }
                if (message.limited) {
                    if (self.limitedBks.indexOf(bk) === -1) {
                        console.log('%c' + bk + ' added to limited!',
                            'background: orange; color: darkred; font-size: 16px; font-weight: bold; padding: 10px 30px;');
                        self.limitedBks.push(bk);
                    }
                }
            },
            'B365ES logout!': async (bk, message) => {
                self.sendAnswer(bk, {
                    action: 'LOG_OUT',
                    data: {
                        status: 'BUSY',
                    }
                });
            },
            'auth clicked!': async (bk, message) => {
                self.sendAnswer(bk, {
                    action: 'LOG_IN',
                    data: {
                        status: 'AVAILABLE',
                        funds: self.bkBalances[bk] === 'null' ? null : parseFloat(self.bkBalances[bk]),
                        fundsUpdated: self.bkBalancesUpdated[bk]
                    }
                });
            },
        };
    }

    _callbacks() {
        const self = this;
        return {
            'depositResultBadCallback': (success, message, bk) => chrome.storage.local.set({
                'DEPOSIT_RESULT': {
                    success: success,
                    message: message
                },
                'DEPOSIT_RESULT_WAS_SET': Date.now()
            }, function () {
                delayPromise(777)
                    .then(() => self.reopenBk(bk))
                    .then(() => console.log('depositResultBadCallback finished!'));
            })
        };
    }

    getMaxTimeForCurrentOperation() {
        const currentCommandBk = this.extBkToInternal(this.command.currentCommand.bk);
        if (['DEPOSIT', 'WITHDRAW'].indexOf(this.command.currentCommand.action) > -1) {
            // Hint: 35 minutes
            return 2100000;
        } else if (['REGISTER', 'REGISTER_NEW', 'ARB_BET'].indexOf(this.command.currentCommand.action) > -1) {
            // Hint: ~16,7 minutes || 10 minutes
            return currentCommandBk === 'onexbet' ? 1000000 : 600000;
        } else if (['READY_TO_BET'].indexOf(this.command.currentCommand.action) > -1) {
            // Hint: 20 minutes
            return 1200000;
        } else if (['MONITOR', 'FORK', 'GET_EVENTS'].indexOf(this.command.currentCommand.action) > -1) {
            // Hint: 90 minutes
            return 5400000;
        } else if (['BET'].indexOf(this.command.currentCommand.action) > -1) {
            return 120000;
        } else if (['BET_RESULT'].indexOf(this.command.currentCommand.action) > -1 &&
            ['pinupcupis', 'betboom', 'bet365',
                'bet365it', 'bet365es', 'bet365gr', 'bet365ru'].indexOf(this.command.currentCommand.bk) > -1) {
            return 950000;
        } else if (['CHECK_BUSY'].indexOf(this.command.currentCommand.action) > -1) {
            return 120000;
        } else {
            // Hint: 5 minutes
            return 1200000;
        }
    }

    clearIntervals() {
        for (const interval in this.intervals) {
            if (this.intervals.hasOwnProperty(interval)) {
                clearInterval(this.intervals[interval]);
                this.intervals[interval] = 0;
                delete this.intervals[interval];
            }
        }
    }

    psApiCommand(message) {
        if (['CHECK_BALANCE', 'TRANSFER_INTERNAL', 'HISTORY'].indexOf(message.command) > -1
            && ['qiwi', 'skrill', 'blockchain', 'neteller', 'pm', 'payeer'].indexOf(message.paysystem.toLowerCase()) > -1) {
            const self = this;
            this.currentCommandSet(message);
            this.psWorks(message)
                .finally(() => self.currentCommandClear());
        } else if (message.paysystem.toLowerCase() === 'extension') {
            // Hint: Here must be Register, I think...
            const command = {
                action: message.command,
                bk: message.data.bk,
                data: message.data.data,
                queue_id: message.queue_id
            };
            console.log('%cCommand from PS:', 'font-weight: bold; color: white; background: blue;');
            console.log(command);
            this.proceedCommand(command);
        }
    }

    _psApiInit() {
        const self = this;
        let errors = 0;
        if (typeof this.s.ps_api_url === 'string' && this.s.ps_api_url !== ''
            && typeof this.s.websocket_uid === 'string' && this.s.websocket_uid !== '') {
            this.intervals['psApiInterval'] = setInterval(() => {
                if (self._checkExtensionIsFree({}, true, 'P3')) {
                    self.apiCommand('ps', {
                        data: JSON.stringify({
                            "websocket_uid": self.s.websocket_uid,
                            "status": "ready"
                        })
                    })
                        .then(d => {
                            //console.log(d);
                            if (typeof d.message.command === 'string' && typeof d.message.paysystem === 'string') {
                                self.psApiCommand(JSON.parse(JSON.stringify(d.message)));
                            }
                        })
                        .catch((e) => {
                            errors++;
                            console.error('Error #' + errors, e);
                            if (errors >= 5) {
                                clearInterval(self.intervals['psApiInterval']);
                                self.intervals['psApiInterval'] = 0;
                            }
                        });
                }
            }, 60000);
            console.log(nowFormatted() + ' _psApiInit: ' + this.s.ps_api_url);
        }
    }

    _fileMonitorInit() {
        const self = this;
        const checkAndExecCommand = function (json) {
            chrome.storage.local.get(['FM_LAST_GUID'], result => {
                if (typeof json.guid === 'string' && json.guid !== ''
                    && ((typeof result.FM_LAST_GUID === 'string' && json.guid !== result.FM_LAST_GUID)
                        || typeof result.FM_LAST_GUID !== 'string')) {
                    chrome.storage.local.set({'FM_LAST_GUID': json.guid}, function () {
                        console.log('%c' + 'DIRECT COMMAND!', 'background: red; color: white; font-weight: bold;');
                        console.log(json);
                        self.proceedCommand(json);
                    });
                }
            });
        };
        const fileUrl = chrome.runtime.getURL('directCommand.json');
        this.intervals['fileMonitorInterval'] = setInterval(() => {
            //console.log('%c' + `manualCommand: ${manualCommand}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            if (manualCommand === 'START') {
                console.log(self._settings.active_bks);
                for (const bk of self._settings.active_bks) {
                    self.removeFromStopped(bk)
                        .then(() => self.openBk(bk, false))
                }
            } else if (manualCommand === 'RESTART') {
                self._reload();
            }
            if (!!manualCommand) {
                console.log('%c' + `Manual command: ${manualCommand}`,
                    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 13px;');
                manualCommand = false;
            }
            fetch(fileUrl)
                .then((response) => response.json()) //assuming file contains json
                .then((json) => checkAndExecCommand(json))
                .catch((e) => console.error('fileMonitor: ' + e))
        }, 60000);
        console.log(nowFormatted() + ' _fileMonitorInit fileUrl: "' + fileUrl + '"');
    }

    _eightyMinutesInit() {
        let self = this;
        let counter = 0;
        // Hint: Reload extension every 80 minutes
        this.intervals['eightyMinutes'] = setInterval(() => {
            counter++;
            const minutes = (new Date()).getMinutes();
            if (counter >= 300 && !self.busy &&
                minutes !== 0 && minutes !== 20 && minutes !== 40) {
                self._reload();
            }
            // Hint: stoppedSchedule...
            for (let bk in self.stopSchedule) {
                if (self.stopSchedule.hasOwnProperty(bk) && typeof self.stopSchedule[bk] === 'number'
                    && Date.now() >= self.stopSchedule[bk]) {
                    self.openBk(bk, false)
                        .then(() => chrome.tabs.remove(self.bkTabs[bk], () => self.stopSchedule[bk] = false));
                }
            }
            // Every 8h we'll close all not used tabs
            chrome.storage.local.get(['LAST_DAILY_CHECK'], r => {
                if (typeof r.LAST_DAILY_CHECK === 'undefined') {
                    chrome.storage.local.set({'LAST_DAILY_CHECK': Date.now()});
                } else {
                    if (Date.now() - r.LAST_DAILY_CHECK > 8 * 60 * 60000) {
                        chrome.storage.local.set({'LAST_DAILY_CHECK': Date.now()}, () => self.closeAllUnusedTabs());
                    }
                }
            });
            // Try to catch /not-available/ fon
            if ((new Date()).getMinutes() % 3 === 0) {
                chrome.windows.getAll({populate: true}, windowList => {
                    windowList.forEach(window => window.tabs.forEach(tab => {
                        if (tab.url.indexOf('/not-available/') > -1) {
                            self._fonChangeUrl(1);
                            chrome.tabs.remove(tab.id, () => {
                                if (chrome.runtime.lastError) {
                                    console.log('Error till catch /not-available/:', chrome.runtime.lastError);
                                }
                                self.openBk('fon', true)
                                    .then(delayFunction(1000))
                                    .then(() => self.loadWindowList());
                            });
                        }
                    }));
                });
            }
        }, 60000);
        console.log(nowFormatted() + ' _eightyMinutesInit');
    }

    _hourlyBetResults() {
        let self = this;
        this._settings.maxWaitForRelease = 50 * 60000;
        this.intervals['hourlyBetResults'] = setInterval(() => {
            self._waitForCommandRelease()
                .then(() => {
                    const bks = Object.values(self.s.active_bks);
                    if (bks[0]) {
                        console.log('%c' + `well, '${bks[0]}/${self.intBkToExternal(bks[0])}'`,
                            'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                        self.proceedCommand({
                            action: 'BET_RESULT',
                            bk: self.intBkToExternal(bks[0]),
                            data: []
                        });
                    }
                })
                .catch(() => console.log('Still busy'));
        }, 60 * 60000);
        console.log(nowFormatted() + ' _hourlyBetResults');
    }

    _transformGeneric() {
        return {
            sports: {
                "baseball": "BASEBALL",
                "basketball": "BASKETBALL",
                "hockey": "HOCKEY",
                "soccer": "FOOTBALL",
                "tennis": "TENNIS",
                "volleyball": "VOLLEYBALL",
                "cybersport": "CYBERSPORT",
                "handball": "HANDBALL",
                "esports.lol": "esports.lol",
                "soccer.cyber": "soccer.cyber",
            },
            getMarket: (betType, bet) => {
                const accordance = {
                    "WIN": "ONE_TWO",
                    "WIN_OT": "ONE_TWO",
                    "WIN_RT": "ONE_TWO",
                    "SET_WIN": "ONE_TWO",
                    "GAME_WIN": "ONE_TWO",
                    "HALF_WIN": "ONE_TWO",
                    "HALF_WIN_OT": "ONE_TWO",
                    "TOTALS": "TOTAL",
                    "TOTALS_OT": "TOTAL",
                    "TOTALS_RT": "TOTAL",
                    "ASIAN_TOTALS": "TOTAL",
                    "SET_TOTALS": "TOTAL",
                    "HALF_TOTALS": "TOTAL",
                    "HALF_TOTALS_OT": "TOTAL",
                    "TOTALS_CORNERS": "CORNER_TOTAL",
                    "ASIAN_TOTALS_CORNERS": "CORNER_TOTAL",
                    "HALF_ASIAN_TOTALS_CORNERS": "CORNER_TOTAL",
                    "HANDICAP": "HDP",
                    "HANDICAP_OT": "HDP",
                    "HANDICAP_RT": "HDP",
                    "SET_HANDICAP": "HDP",
                    "HALF_HANDICAP": "HDP",
                    "HALF_HANDICAP_OT": "HDP",
                    "HANDICAP_3W": "EURO_HDP",
                };
                if (betType.indexOf('TEAM_TOTALS') > -1) {
                    return bet.indexOf('P1') > -1 ? 'T1_TOTAL' : bet.indexOf('P2') > -1 ? 'T2_TOTAL' : null;
                } else {
                    return accordance[betType];
                }
            },
            getTarget: (betType, bet) => {
                if (betType.indexOf('WIN') > -1) {
                    const accordance = {
                        '_P1': 'ONE',
                        '_P2': 'TWO',
                        '_PX': 'DRAW',
                        '_1X': 'ONE_DRAW',
                        '_12': 'ONE_TWO',
                        '_X2': 'TWO_DRAW',
                    };
                    return accordance[Object.keys(accordance).find(k => bet.indexOf(k) > -1)];
                } else if (betType.indexOf('TOTALS') > -1) {
                    return bet.indexOf('OVER') > -1 ? 'OVER' : bet.indexOf('UNDER') > -1 ? 'UNDER' : null;
                } else if (betType === 'HANDICAP_3W') {
                    return bet.indexOf('P1') > -1 ? 'H1' : bet.indexOf('P2') > -1 ? 'H2' : 'HX';
                } else if (bet.indexOf('HANDICAP') > -1) {
                    return bet.indexOf('P1') > -1 ? 'HOME' : bet.indexOf('P2') > -1 ? 'AWAY' : null;
                } else {
                    return null;
                }
            },
            getPivot: bet => {
                const res = /\(([\d-+.]+)\)/.exec(bet);
                return res && res[1] || '';
            },
            getTimeValue: bet => {
                if (bet.indexOf('GAME__') === 0) {
                    // GAME__02_03__P1 (победа П1 во 2-м сете 3-м гейме)
                    // WARNING! THIS IS SPECIAL INVERSE ORDER BECAUSE OF STAKE!!!
                    const digits = /(\d+)\D+(\d+)/.exec(bet);
                    return digits && digits[1] && digits[2]
                        ? `SET_${digits[2]}_GAME_${digits[1]}`
                        : '';
                } else if (bet.indexOf('SET_') === 0) {
                    const res = /SET_(\d{2})_/.exec(bet);
                    return res && res[1] ? `SET_${res[1]}` : '';
                } else if (bet.indexOf('HALF_') === 0) {
                    return `HALF_TIME`;
                } else {
                    return 'FULL_MATCH';
                }
            },
        }
    }

    hexToBytes(hex) {
        const clean = hex.trim().toLowerCase();
        if (clean.length % 2 !== 0) throw new Error("Invalid hex");
        const out = new Uint8Array(clean.length / 2);
        for (let i = 0; i < out.length; i++) {
            out[i] = parseInt(clean.substr(i * 2, 2), 16);
        }
        return out;
    }

    b64ToAscii(b64) {
        return atob(b64);
    }

    async somethingFunny(data) {
    try {
        const b64CipherHex = data.slice(0, data.length - 64);
        const b64NonceHex  = data.slice(data.length - 64);

        const cipherHex = atob(b64CipherHex);
        const nonceHex  = atob(b64NonceHex);

        const ciphertext = this.hexToBytes(cipherHex);
        const nonce      = this.hexToBytes(nonceHex);

        const keyHex = atob('N2ZiMzE2OTk2MWVkZTJhYzU2MWUwMzNkZmNiNWYxZTBkMTgxMmI4ZTI5NGFlN2Q1NzEyMDg5ZWVjODM1YzlmZQ==');
        const key    = this.hexToBytes(keyHex);

        const plain = nacl.secretbox.open(ciphertext, nonce, key);
        if (!plain) return data;

        return new TextDecoder().decode(plain);
    } catch (e) {
        return data;
    }
    }

    /**
     * Transform fork to our bet
     * @param {object} source
     * @param {StakeFork} stakeFork
     * @param {boolean} needCheck - when we need to check date
     * @private
     */
    async _transformFork(source, stakeFork, needCheck) {
        const
            dnt = !!source['doNotTransform'],
            bad = [],
            self = this,
            sports = this._transformGeneric().sports,
            getMarket = this._transformGeneric().getMarket,
            getTarget = this._transformGeneric().getTarget,
            getPivot = this._transformGeneric().getPivot,
            getTimeValue = this._transformGeneric().getTimeValue;
        let sportHere = '';
        if (this.expires && needCheck) {
            if (source['btsid']) {
                const sentAt = await this.somethingFunny(source['btsid']);
                if (isNaN(parseInt(sentAt))) {
                    return {
                        success: false,
                        result: 'Wrong bet match!',
                    };
                }
                const diff = Math.abs(this.expires - sentAt);
                // TODO: remove
                /*
                dLog('', 'Common', [
                        `btsid: ${source['btsid']}`,
                        `${sentAt} => ${formatUnixTimestamp(sentAt)}`,
                        `${this.expires} => ${formatUnixTimestamp(this.expires)} ` +
                        `diff is ${diff} seconds`,
                    ]
                );
                */
                if (diff < 28800/* 8hrs */) {
                    return {
                        success: false,
                        result: `Your subscription expired, ${sentAt}, ${diff}, ${self.expires}!`,
                    };
                }
            } else {
                return {
                    success: false,
                    result: 'Wrong bet type!',
                };
            }
        }
        if (!dnt) {
            if (!!parseInt(source['is_cyber']) && source['sport'] === 'soccer') {
                source['sport'] = 'soccer.cyber';
            } else if (!!parseInt(source['is_cyber']) && source['sport'] !== 'esports.lol') {
                //dLog('red', 'Common', `is_cyber? ${source['is_cyber']}`);
                source['sport'] = 'cybersport';
            }
            if (stakeFork.incomeFrom !== 0 && stakeFork.incomeTo !== 0) {
                const income = parseFloat(source['income']);
                if (!isNaN(income) && (income < stakeFork.incomeFrom || income > stakeFork.incomeTo)) {
                    bad.push(`not in the range! ${stakeFork.incomeFrom} >= ${income} <= ${stakeFork.incomeTo}`);
                }
            }
            sportHere = sports[source['sport']];
            if (!sportHere) {
                bad.push(`sport ${source['sport']} not found`);
            }
        } else {
            sportHere = source['sport'];
        }
        const
            checkBookie = stakeFork.arbFork.enabled()
                ? stakeFork.arbFork.bookie
                : (stakeFork.overrideBookie || stakeFork.bookie),
            pfx = source['BK1_name'] === checkBookie ? 'BK1_' : 'BK2_',
            response = {
                bk: self.intBkToExternal(stakeFork.bookie),
                newAPI: true,
                action: stakeFork.arbFork.enabled() ? "FORK_BET" : "BET",
                data: [],
            },
            teams = dnt
                ? [source[`homeTeam`], source[`awayTeam`]]
                : source[`${pfx}game`].split(' vs '),
            betRow = {
                "direct_link": source?.extraData?.bk?.directLink,
                "time_value": dnt ? source['timeValue'] : getTimeValue(source[`${pfx}bet`])
                    .replace('FULL_MATCH', 'FULL_TIME'),
                "type": source['mode'] && ['LIVE', 'PREMATCH'].indexOf(source['mode']) > -1 ? source['mode'] : "LIVE",
                "sport": sportHere,
                "league": dnt ? source['league'] : source[`${pfx}league`],
                "team1": teams && teams[0] || '',
                "team2": teams && teams[1] || '',
                "market": dnt ? source['market'] : getMarket(source[`${pfx}bet_type`], source[`${pfx}bet`]),
                "target": dnt ? source['target'] : getTarget(source[`${pfx}bet_type`], source[`${pfx}bet`]),
                "coef": dnt ? source['coef'] : source[`${pfx}cf`],
                "stake": stakeFork.arbFork.enabled()
                    ? source[`${pfx}amount`]
                    : (stakeFork.stake || 1),
                "pivot": dnt ? source['pivot'] : getPivot(source[`${pfx}bet`]),
                "betFromParser": true,
                "arbFork": stakeFork.arbFork.enabled(),
                "source": stakeFork.source,
                "currency": stakeFork.currency,
                "successBetInterval": stakeFork.successBetInterval || 30000,
            };
        if (!dnt && stakeFork.bookie !== "topsport") {
            betRow["direct_link"] = source[`${pfx}href`].replace('//sports.b', '//b');
        }
        if (!dnt && betRow.sport === 'BASKETBALL' && !!stakeFork.lastScoreBasketball && !!source[`${pfx}score`]
            && source[`${pfx}score`].slice(-1) !== 'B') {
            bad.push(`lastScoreBasketball: ${source[`${pfx}score`]} doesn't end with B`);
        }
        if (!dnt && betRow.sport === 'TENNIS' && !!stakeFork.lastScoreTennis && !!source[`${pfx}score`]) {
            const
                re = /(\d{1,2}:\d{1,2})/g,
                matches = (source[`${pfx}score`].match(re) || []).map(e => e.replace(re, '$1')),
                match = matches.pop();
            if (!match || (match !== '0:0' && match !== '00:00')) {
                bad.push(`lastScoreTennis: ${source[`${pfx}score`]} => ${match} not 0:0 nor 00:00`);
            }
        }
        if (bad.length === 0 && stakeFork.originalBookie === 'BETWAYES') {
            betRow.direct_link = source[`${pfx}href`]
                .replace('betway.com', 'betway.es')
                .replace('//sports.b', '//b');
        }
        response.data.push(betRow);
        if (!betRow.market || !betRow.target || !betRow.sport || !betRow.time_value) {
            bad.push(`market: '${!!betRow.market}', target: '${!!betRow.target}', `
                + `sport: '${!!betRow.sport}', time_value: '${!!betRow.time_value}'`);
        }
        return {
            success: bad.length === 0,
            result: bad.length === 0 ? response : bad.join('; '),
        };
    }

    _getForkForStakeInit() {
        if (this.stakeForks.length === 0 || !this.stakeForks.every(e => !!e?.link)) {
            dLog('red', 'COMMON', [
                `No stake fork! length === 0: ${this.stakeForks.length === 0} || `
                + `not every has link: ${!this.stakeForks.every(e => (console.log(e), !!e?.link))}`,
                this.stakeForks,
            ]);
            return;
        }
        const
            self = this,
            test = {
                bk: 'STAKE',
                newAPI: true,
                action: "BET",
                data: [
                    {
                        "time_value": 'FULL',
                        "type": "PREMATCH",
                        "sport": 'FOOTBALL',
                        "league": "Premier League",
                        "team1": 'Brighton & Hove Albion FC',
                        "team2": 'Aston Villa FC',
                        "market": 'ONE_TWO',
                        "target": "TWO",
                        "pivot": '',
                        "coef": 1.4,
                        "stake": 0.4,
                        "direct_link": 'https://betway.com/en/sports/in-play',
                        "betFromParser": true,
                    }
                ],
            };
        const
            fluentLog = (type, bk, data) => {
                if (!!enableFullLogs) {
                    dLog(type, bk, data);
                }
            },
            pool = new BetsPool();
        let
            lastAlert = 0,
            errors = 0;
        this.intervals['forkForStake'] = setInterval(async () => {
            if (self._settings[self.s.active_bks[0] + '_login'] !== '*** TEST ***'
                && !self._checkExtensionIsFree('BET', true)) {
                //console.log(`Skip because not free!`);
                //console.log(this.command.currentCommand);
                return;
            }
            for (const stakeFork of self.stakeForks) {
                if (self.s[stakeFork.bookie + '_login'] !== '*** TEST ***'
                    && !self.bkReady[stakeFork.bookie]) {
                    //console.log(`Skip because ${stakeFork.bookie} not ready!`);
                    continue;
                }
                const response = await fetch(stakeFork.link, {
                    headers: {Authorization: `Bearer ${self._settings[stakeFork.bookie + '_jwt']}`}
                })
                    .catch(e => {
                        dLog('red', 'Common', `forkForStake: ${e}, ${errors}, ${Date.now() - lastAlert}`);
                        if (e.message.indexOf('Failed to fetch') > -1) {
                            errors++;
                            if (errors >= 120 && Date.now() - lastAlert > 120000) {
                                lastAlert = Date.now();
                                errors = 0;
                                alert(`Невозможно подключиться! Проверьте прокси!`);
                            }
                        }
                        return null;
                    });
                const encryptedRespText = response && response.ok ? await response.text() : '';
                if (!encryptedRespText || stakeFork.prevForkForStake === encryptedRespText) {
                    continue;
                }
                stakeFork.prevForkForStake = encryptedRespText;
                // TODO: enable, when needed!
                const respText = await this.somethingFunny(encryptedRespText);
                let json = [];
                try {
                    json = JSON.parse(respText);
                } catch (e) {
                    dLog('red', 'Common', [`Error in JSON: ${e}, response:`, respText]);
                }
                if (json && typeof json === 'object' && Array.isArray(json)) {
                    const sorted = json.sort((a, b) =>
                        a['income'] < b['income'] ? 1 : a['income'] === b['income'] ? 0 : -1);
                    for (const current of sorted) {
                        const {success, result} =
                            await self._transformFork(current, stakeFork, true)
                                .catch(e => {
                                    const mess = `Error in _transformFork: ${e}, ${formatStack(e.stack)}`;
                                    dLog('red', 'common', mess);
                                    return {success: false, result: mess};
                                });
                        if (success) {
                            const {ok, errors} = stakeFork.check(result, current);
                            if (ok) {
                                if (!!stakeFork.express) {
                                    pool.addBet(result);
                                    if (pool.isReady(enableFullLogs)) {
                                        self.proceedCommand(pool.getCommand());
                                    }
                                } else {
                                    self.proceedCommand(result);
                                }
                                return;
                            } else {
                                fluentLog('red', 'COMMON',
                                    `Bad check (${stakeFork.number}): ${errors}`);
                            }
                        } else {
                            fluentLog('red', 'Common',
                                [`Unknown or inappropriate bet from parser `
                                + `${stakeFork.number} (${stakeFork.link}), errors = ${result}, current:`,
                                    current]);
                        }
                    }
                }
            }
        }, 1000);
        /*
        console.log(nowFormatted() + ' _getForkForStakeInit');
        setTimeout(() => {
            //self.proceedCommand(test);
            let dl = '';
            if (self.stakeFork.originalBookie === 'BETWAYES') {
                dl = test.data[0].direct_link
                    .replace('betway.com', 'betway.es')
                    .replace('//sports.b', '//b');
            } else {
                dl = test.data[0].direct_link;
            }
            dLog('bigred', 'Common', `${self.stakeFork.originalBookie} => ${dl}`)
        }, 15000);
         */
    }

    _checkCurrentOperationInit() {
        let self = this;
        this.intervals['checkCO'] = setInterval(() => {
            if (self.busy && (Date.now() - self.command.currentCommandWasSet) > self.getMaxTimeForCurrentOperation()
                && self.command.currentCommand.bk !== 'fon') {
                const currentCommandBk = this.extBkToInternal(self.command.currentCommand.bk);
                console.log('%c' + nowFormatted() + ':' + ' RELOADING because current operation '
                    + self.command.currentCommand.action + ' for ' + currentCommandBk + ' was set too long time ago: '
                    + nowFormatted(self.command.currentCommandWasSet),
                    'background: green; color: white; font-weight: bold;');
                if (self.command.currentCommand.newAPI && ['BET', 'EXPRESS_BET', 'EXPRESS'].indexOf(self.command.currentCommand.action) > -1) {
                    self.sendAnswer(currentCommandBk, {
                        action: self.command.currentCommand.action,
                        data: {
                            external_id: '',
                            status: 'NOT_PLACED',
                            "pivot": self.command.currentCommand.data[0].pivot,
                            "bkPivot": self.command.currentCommand.data[0].pivot,
                            "coef": self.command.currentCommand.data[0].coef,
                            "stake": self.command.currentCommand.data[0].stake,
                            "maximum": 0,
                            "market": self.command.currentCommand.data[0].market,
                            "target": self.command.currentCommand.data[0].target,
                        },
                        answer: 'REBOOT by timeout (' + (Date.now() - self.command.currentCommandWasSet) + 'ms instead of ' + self.getMaxTimeForCurrentOperation() + 'ms)!'
                    });
                } else {
                    self.sendAnswer(currentCommandBk, {
                        action: self.command.currentCommand.action,
                        data: {
                            status: 'FAILED',
                            request: self.command.currentCommand
                        },
                        answer: 'REBOOT by timeout (' + (Date.now() - self.command.currentCommandWasSet) + 'ms instead of ' + self.getMaxTimeForCurrentOperation() + 'ms)!'
                    });
                }
                self.clearIntervals();
                delayPromise(3333)
                    .then(() => {
                        fetch(self._settings.test_url + 'bb_bot.php?action=error', {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/x-www-form-urlencoded"
                            },
                            body: new URLSearchParams({
                                id: bbSettings.websocket_uid
                            })
                        })
                        .finally(() => {
                            self._reload();
                        });
                    });
            }
        }, 1000);
        console.log(nowFormatted() + ' _checkCurrentOperationInit');
    }

    _portsInit() {
        let self = this;
        chrome.runtime.onConnect.addListener(port => {
            const listener = self._getPortListener(port);
            if (listener) {
                port.onMessage.addListener(listener);
            }
        });
        this.intervals['ports'] = setInterval(() => {
            Object.keys(self.activePorts).forEach(bk => {
                const message = self.portQueue[bk].shift();
                if (message) {
                    try {
                        self.activePorts[bk].postMessage(message);
                    } catch (e) {
                        self.messageToBk(bk, message);
                    }
                }
            });
        }, 333);
        console.log(nowFormatted() + ' _portsInit');
    }

    _serverInit() {
        if (!this._settings.test_mode_on) {
            this._wsInit();
        } else {
            this._testInit();
        }
        if (this.s.double && this.s.double.enabled && this.s.double.uid && this.s.double.uid.length > 0) {
            this._wsInitDouble();
        }
        if (!this.expires) {
            this._logWsInit();
        }
    }

    _reload() {
        bMess('CHROME_INITIALIZED').set(true)
            .then(() => bMess('wasRebootByTimeout').set(Date.now()))
            .then(() => chrome.runtime.reload());
    }

    _prepareAndProceedCommand(parsed) {
        console.log('_prepareAndProceedCommand!!!');
        if (parsed.action === 'CHECK_MAILBOX_FOR_PATTERN') {
            dLog('green', 'common', [`checkMailAnswer`, parsed]);
            this.checkMailAnswer = parsed.data;
            return;
        }
        const newApi = inCommand => {
            const command = JSON.parse(JSON.stringify(inCommand));
            command.bk = command.room.bk;
            command.newAPI = true;
            command.check_limited = command.room.check_limited || false;
            if (command.action === "BET") {
                const betRow = JSON.parse(JSON.stringify(command.data));
                betRow.score = betRow.score.replace('-', ':');
                betRow.time_value = betRow.sport === 'FOOTBALL' || betRow.time_value !== 'FULL_TIME'
                    ? betRow.time_value : 'FULL_MATCH';
                betRow.team1 = betRow.home;
                betRow.team2 = betRow.away;
                if (betRow.bk_event_native_id && ['1XBET', '1XSTAVKA'].indexOf(command.bk) > -1) {
                    betRow.bk_event_native_id = false;
                } else if (betRow.bk_event_native_id) {
                    betRow.team1 = '';
                    betRow.team2 = '';
                }
                command.data = [];
                command.data.push(betRow);
            } else if (command.action === "EXPRESS") {
                command.action = "EXPRESS_BET";
                const betsData = JSON.parse(JSON.stringify(command.data));
                command.data = [];
                for (const bet of betsData.bets) {
                    bet.time_value = bet.sport === 'FOOTBALL' || bet.time_value !== 'FULL_TIME'
                        ? bet.time_value : 'FULL_MATCH';
                    bet.score = bet.score.replace('-', ':');
                    bet.coef = betsData.coef;
                    bet.stake = betsData.stake;
                    bet.team1 = bet.home;
                    bet.team2 = bet.away;
                    if (bet.bk_event_native_id && ['1XBET', '1XSTAVKA',].indexOf(command.bk) > -1) {
                        bet.bk_event_native_id = false;
                    } else if (bet.bk_event_native_id) {
                        bet.team1 = '';
                        bet.team2 = '';
                    }
                    command.data.push(bet);
                }
            } else if (command.action === "MAXIMUM") {
                const bets = JSON.parse(command.data);
                command.data = [];
                for (const bet of bets) {
                    bet.score = bet.score.replace('-', ':');
                    bet.team1 = bet.home;
                    bet.team2 = bet.away;
                    command.data.push(bet);
                }
            } else if (['DEPOSIT', 'WITHDRAW'].indexOf(command.action) > -1) {
                command.data.paysystem = command.data.pay_system;
                command.last_name = command.data.second_name;
            } else if (['START_BK', 'STOP_BK'].indexOf(command.action) > -1) {
                command.action = command.action.replace('_BK', '');
            } else if (['TRANSFER_FUNDS', 'WALLET_BALANCE'].indexOf(command.action) > -1) {
                command.paysystem = command.data.pay_system.toLowerCase();
                command.command = command.action === 'WALLET_BALANCE' ? 'CHECK_BALANCE' : 'TRANSFER_INTERNAL';
            }
            console.log('%c' + 'Command formatted:', 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            console.log(command);
            return command;
        };
        const self = this;
        chrome.storage.local.get(['stopped'], function (result) {
            self.stopped = result.stopped || {};
            if (['TRANSFER_INTERNAL', 'CHECK_BALANCE', 'TRANSFER_FUNDS', 'WALLET_BALANCE'].indexOf(parsed.action) > -1) {
                self.psWorks(parsed.room && parsed.room.bk ? newApi(parsed) : parsed)
                    .finally(() => self.currentCommandClear());
            } else {
                self.proceedCommand(parsed.room && parsed.room.bk ? newApi(parsed) : parsed);
            }
        });
    }

    async _wsInitPromise() {
        this._wsInit();
        await waitForCondition(() => self.ws.readyState === 1, 100, 60000, 'WS not connected');
        return true;
    }

    _wsInit() {
        if (this.ws && this.ws.readyState === 1) {
            console.log('%c' + '_wsInit when ws connected!', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            return;
        }
        if (!this._settings.websocket_url) {
            console.log('%c' + 'No WS url, working off chain', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            return;
        }
        const readyStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
        let self = this;
        this.ws = null;
        this.ws = new WebSocket(this._settings.websocket_url);
        this.ws.onerror = function (event) {
            console.log('Socket error!');
            console.error(event);
            /*
            setTimeout(() => {
                if (readyStates[self.ws.readyState] !== 'OPEN') {
                    self._reload();
                }
            }, 60000);
             */
        };
        this.ws.onmessage = function (event) {
            console.log(event.data);
            let parsed = false;
            let ignore = false;

            try {
                parsed = JSON.parse(event.data);
            } catch (e) {
                console.log(e);
            }
            if (parsed && typeof parsed.action === 'string') {
                if (self.s.experimental) {
                    chrome.storage.local.get(['BE_COMMANDS_ENABLED'], function (result) {
                        if (!result || typeof result.BE_COMMANDS_ENABLED === 'undefined'
                            || result.BE_COMMANDS_ENABLED) {
                            self._prepareAndProceedCommand(parsed);
                        } else {
                            console.log('Command ignored:', parsed);
                        }
                    });
                } else if (ignore) {
                    console.log('Command ignored:', parsed);
                } else {
                    self._prepareAndProceedCommand(parsed);
                }
            }
        };
        this.ws.onopen = function (event) {
            //console.log(`WS ONOPEN FIRED with state: ${readyStates[self.ws.readyState]}`);
            if (self.ws.readyState !== 1) {
                return;
            }
            //await waitForCondition(() => self.ws.readyState === 1, 100, 30000, 'WS still not connected');
            try {
                self.ws.send(JSON.stringify({
                    action: 'HELLO',
                    data: {
                        uid: self._settings.websocket_uid
                    }
                }));
            } catch (e) {
                console.log('%c' + 'WHAT THE MATTER, CHROME?', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                console.error(e);
            }
            console.log('%c' + readyStates[self.ws.readyState], 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        };
        this.ws.onclose = function (event) {
            console.log('%c CLOSED!', 'background: red; color: white; font-weight: bold;');
            //console.log(event);
            console.log('reconnecting in 10 secs...');
            setTimeout(function () {
                self._wsInit();
            }, 10000);
        };
        console.log(nowFormatted() + ' _wsInit');
        // Hint: just to check WS's behavior when "A reload is required so that the existing AbsoluteOrientationSensor
        //  and RelativeOrientationSensor objects on this page use the overridden values that have been provided.
        //  Close the inspector and reload again to return to the normal behavior." message appears in the console
        const threeMinuteCheck = setInterval(() => {
            console.log('%c' + `First WS is ${readyStates[self.ws.readyState]}`, 'background: lightyellow; color: gray;');
        }, 180000);
    }

    _wsInitDouble() {
        let self = this;
        this.wsDouble = new WebSocket(this.s.double.url);
        this.wsDouble.onerror = function (event) {
            console.log('Double socket error!');
            console.error(event);
        };
        this.wsDouble.onmessage = function (event) {
            console.log(event.data);
            let parsed = false;
            try {
                parsed = JSON.parse(event.data);
            } catch (e) {
                console.log(e);
            }
            if (parsed && typeof parsed.action === 'string') {
                chrome.storage.local.get(['stopped'], function (result) {
                    self.stopped = result.stopped || {};
                    parsed['double'] = true;
                    self.proceedCommand(JSON.parse(JSON.stringify(parsed)));
                });
            }
        };
        this.wsDouble.onopen = function (event) {
            console.log('DOUBLE OPENED!');
            //console.log(event);
            // we need to send "hello"
            console.log(self.wsDouble.send(JSON.stringify({
                action: 'HELLO',
                data: {
                    uid: self.s.double.uid,
                    bookies: self.s.active_bks.map(i => self.intBkToExternal(i)),
                    server_name: self.s.double.server_name
                }
            })));
            console.log(self.wsDouble.readyState);
        };
        this.wsDouble.onclose = function (event) {
            console.log('%c DOUBLE CLOSED!', 'background: red; color: white; font-weight: bold;');
            //console.log(event);
            console.log('reconnecting in 10 secs...');
            setTimeout(function () {
                self._wsInitDouble();
            }, 10000);
        };
        console.log(nowFormatted() + ' _wsInitDouble');
    }

    _testInit() {
        const self = this;
        const url = self._settings.test_url + 'bb_test.php?action=get_command&uid=' + self.s.websocket_uid;
        this.intervals['ping'] = setInterval(function () {
            $.get(url, function (data) {
                let parsed;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    if (data !== '') {
                        console.log('%c' + 'Not parsed!', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                        console.log(data);
                    }
                    return;
                }
                console.log(parsed);
                if (typeof parsed.action === 'string') {
                    chrome.storage.local.get(['stopped'], function (result) {
                        self.stopped = result.stopped || {};
                        if (self.s.experimental) {
                            chrome.storage.local.get(['BE_COMMANDS_ENABLED'], function (result) {
                                if (!result || typeof result.BE_COMMANDS_ENABLED === 'undefined'
                                    || result.BE_COMMANDS_ENABLED) {
                                    self.proceedCommand(parsed);
                                } else {
                                    console.log('Command ignored:', parsed);
                                }
                            });
                        } else {
                            self.proceedCommand(parsed);
                        }
                    });
                }
                if (parsed.trans) {
                    $.get(`${url}&accepted=${parsed.trans}`, function (data) {
                        console.log('Accepted sent!');
                    });
                }
            }).fail(function () {
                //clearInterval(self.intervals['ping']);
                //self.intervals['ping'] = 0;
                //alert('Server is inaccessible!');
            });
        }, self.s.test_interval);
        console.log(nowFormatted() + ' _testInit');
    }

    logsEnabled() {
        return this?.wsLog?.readyState === 1;
    }

    _logWsInit() {
        let self = this;
        /**
         * @type {WebSocket}
         */
        this.wsLog = new WebSocket('ws://localhost:9892');
        this.wsLog.onerror = function (event) {

        };
        this.wsLog.onmessage = function (event) {

        };
        this.wsLog.onopen = function (event) {
            self.wsLog.send(JSON.stringify({
                action: 'HELLO',
                data: {
                    uid: self._settings.websocket_uid
                }
            }));
        };
        this.wsLog.onclose = function (event) {
            if (!self.wsLogErrors) {
                self.wsLogErrors = 1;
            } else {
                self.wsLogErrors++;
            }
            if (self.wsLogErrors < 10) {
                setTimeout(function () {
                    self._logWsInit();
                }, 10000);
            }
        };
        console.log(nowFormatted() + ' _wsInitLog');
    }

    _getPortListener(port) {
        const self = this;
        const specialListeners = {
            'port_check': message => {
                console.log('port_check connected!');
                if (typeof message.m === 'string' && self.autoloadBks.indexOf(message.m) > -1) {
                    const bk = message.m.replace('_URL', '');
                    if (message[bk + '_MAIN'] && self._bkUrlsWasOverridenFor.indexOf(bk) === -1) {
                        self._bkUrlCheck[bk.toLowerCase()] = message[bk + '_HOST'];
                        self.bkUrls[bk.toLowerCase()] = message[bk + '_URL'];
                        self._bkUrlsWasOverridenFor.push(bk);
                    } else if (message[bk + '_MAIN']) {
                        if (message[bk + '_HOST'].indexOf('unibet.co.uk') > -1) {
                            self._bkUrlCheck[bk.toLowerCase()] = message[bk + '_HOST'];
                            self.bkUrls[bk.toLowerCase()] = message[bk + '_URL'];
                        }
                        self.debug({answer: `Attempt to override existing url '${self.bkUrls[bk.toLowerCase()]}' with '${message[bk + '_URL']}' for ${bk}`},
                            'COMMON');
                    }
                }
            },
        };
        if (Object.keys(specialListeners).indexOf(port.name) > -1) {
            return specialListeners[port.name];
        } else {
            const bk = port.name.replace('port_', '');
            if (this._settings.active_bks.indexOf(bk) === -1 && bk !== 'cupis') {
                console.log('%c' + `${bk} not in active bks`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                return null;
            }
            this.activePorts[bk] = port;
            return message => {
                // Hint: legacy code
                if (['olimp'].indexOf(bk) > -1 && self._bkUrlCheck.olimp === 'olimp.com') {
                    chrome.storage.local.get(data => {
                        if (typeof data.OLIMP_URL !== 'undefined' && data.OLIMP_URL !== '') {
                            self._bkUrlCheck.olimp = data.OLIMP_URL.replace('http://', '').replace('https://', '');
                            console.log('%cOLIMP check url was set: ' + self._bkUrlCheck.olimp, 'background: grey;');
                            fetch(self._settings.test_url + 'bb_bot.php?action=olimp_url', {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/x-www-form-urlencoded"
                                },
                                body: new URLSearchParams({
                                    id: bbSettings.websocket_uid
                                })
                            }).finally(() => {});
                        }
                    });
                }
                // Hint: relevant listener for bookie's port
                if (typeof message.m === 'string' && typeof self._predefinedCommandProcessor()[message.m] === 'function') {
                    (self._predefinedCommandProcessor()[message.m](bk, message))
                        .catch(e => `Error in predefined command processor: ${e}`);
                } else if (typeof message.m === 'string' && message.m.length >= 11 && message.m.substring(0, 11) === 'tech works!') {
                    self.bkReady[bk] = false;
                } else if (typeof message.m === 'string') {
                    console.log(bk + ': ' + message.m);
                } else if (typeof message.answer === 'string' && message.answer === 'LIMITED'
                    && message.answered !== 'CHECK_BUSY') {
                    self.limitedBks.push(bk);
                    console.log(bk + ' LIMITED!');
                } else if (typeof message.answered === 'string') {
                    self.proceedAnswer(message, bk);
                } else {
                    console.log(bk, message);
                }
            };
        }
    }

    _predefined(type) {
        const localBkUrls = JSON.parse(JSON.stringify(bbSettings.commonSettings.bkUrls));
        const self = this;
        Object.keys(localBkUrls).forEach(bk => {
            if (localBkUrls[bk].indexOf(';') > -1) {
                localBkUrls[bk] = localBkUrls[bk].split(';')[self.checkIndexInArray].trim();
            }
        });
        if (!!localBkUrls['fonbetcupis']) {
            localBkUrls['fonbetcupis'] = 'https://www.fon.bet/live';
        }
        return {
            'bks': Object.assign({}, {
                // PS:
                'blockchain': 'BTC',
                'neteller': 'NETELLER',
                'payeer': 'PAYEER',
                'pm': 'PM',
                'qiwi': 'QIWI',
                'skrill': 'SKRILL',
                'cupis': 'CUPIS',
                'you_money': 'YOU_MONEY',
                // Test "bookies"
                'whatismyip': 'WHATISMYIP',
                'myip': 'MYIP'
            }, bbSettings.commonSettings.bks),
            'bkUrls': Object.assign({}, {
                // PS:
                qiwi: 'https://w.qiwi.com/',
                skrill: 'https://www.skrill.com/en/',
                blockchain: 'https://login.blockchain.com/en/',
                neteller: 'https://member.neteller.com/?lang=en',
                payeer: 'https://payeer.com',
                pm: 'https://perfectmoney.com',
                you_money: 'https://yoomoney.ru',
                // test:
                whatismyip: 'https://app.multiloginapp.com/WhatIsMyIP',
                myip: 'https://www.myip.com/'
            }, localBkUrls),
            'bkUrlCheck': Object.assign({}, {
                // PS:
                qiwi: 'qiwi.com',
                skrill: 'skrill.com',
                blockchain: 'blockchain.com',
                neteller: 'neteller.com',
                payeer: 'payeer.com',
                pm: 'perfectmoney.com',
                you_money: 'yoomoney.ru',
                // test:
                whatismyip: 'app.multiloginapp.com',
                myip: 'myip.com'
            }, bbSettings.commonSettings.bkUrlCheck),
            'autoloadBks': bbSettings.commonSettings.autoloadBks
        }[type];
    }

    _overrideWebSockets(bk, tabId) {
        const self = this;

        waitForCondition(
            () => typeof tabId === 'number' || self.bkTabs[bk] !== false,
            1000,
            120000,
            bk + ' not authorized!'
        )
        .then(async () => {
            try {
                const targetTabId = typeof tabId === 'number' ? tabId : self.bkTabs[bk];

                // MV3: вставка скрипта ws.js через executeScript с files
                await chrome.scripting.executeScript({
                    target: { tabId: targetTabId },
                    files: ['libs/ws.js'],
                    world: 'MAIN' // чтобы скрипт исполнялся в контексте страницы
                });

                console.log(
                    `%cWS script loaded in ${bk} / ${targetTabId}!`,
                    'background: green; color: white; font-size: 12px; font-weight: bold; padding: 1px;'
                );
            } catch (e) {
                console.log(
                    `%c${e}`,
                    'background: red; color: yellow; font-size: 12px; font-weight: bold; padding: 3px;'
                );
            }
        });
    }
}

if (bbSettings.experimental) {
    chrome.storage.local.get(['BE_COMMANDS_ENABLED'], function (result) {
        if (!result || typeof result.BE_COMMANDS_ENABLED === 'undefined' || result.BE_COMMANDS_ENABLED) {
            chrome.action.setIcon({path: "icon3.png"});
        } else {
            chrome.action.setIcon({path: "icon2.png"});
        }
    });

    chrome.browserAction.onClicked.addListener(function (tab) {
        chrome.storage.local.get(['BE_COMMANDS_ENABLED'], function (result) {
            if (!result || typeof result.BE_COMMANDS_ENABLED === 'undefined' || result.BE_COMMANDS_ENABLED) {
                chrome.storage.local.set({'BE_COMMANDS_ENABLED': false}, () => {
                    chrome.action.setIcon({path: "icon2.png"});
                });
            } else {
                chrome.storage.local.set({'BE_COMMANDS_ENABLED': true}, () => {
                    chrome.action.setIcon({path: "icon3.png"});
                });
            }
        });
    });
} else {
    chrome.action.setIcon({path: "/icon.png"});
}

/*-------------- end common -------------------*/

/*----------- begin mainCycle -----------------*/
function  MainCycle () {
    this.forkCycle = false;
    this.delayedBetsSupport = [
        'bet365',
        'marathon',
        'fon',
        'olimpold',
        'cloudbet'
    ];
    this.common = new Common(this);

    this._arbBet = function (command, bk) {
        if (this.delayedBetsSupport.indexOf(bk) === -1) {
            this.common.sendAnswer(bk, {
                action: command.action,
                data: {
                    status: 'NOT SUPPORTED',
                },
                answer: command.action + ' not supported for ' + command.bk
            });
        } else if (command.action === 'ARB_BET' && typeof (command.data[0] !== 'undefined') && parseInt(command.data[0].interval) === -1) {
            this.common.currentCommandClear();
        } else if (command.action === 'ARB_BET' && this.common.command.previousCommand.action !== 'READY_TO_BET') {
            this.common.sendAnswer('BET_RESULT', {
                action: 'BET_RESULT',
                data: {
                    "external_id": '',
                    "status": 'FAILED',
                    "market": command.data[0].market,
                    "target": command.data[0].target,
                    "pivot": command.data[0].pivot,
                    "coef": command.data[0].coef,
                    "stake": command.data[0].stake,
                    "maximum": null
                },
                answer: 'ARB_BET must follow for READY_TO_BET, but it is ' + this.common.command.previousCommand.action
            });
        } else {
            this.common.openBkAndSendActionWithData(command, bk);
        }
    }

}
/*----------- end mainCycle -------------------*/

/*--------------- begin logic -----------------*/
#LOGIC#
/*--------------- end logic -------------------*/

/*------------ begin baseAuth -----------------*/
#TENNISI_BACKGROUND#
/*------------ end baseAuth -------------------*/
