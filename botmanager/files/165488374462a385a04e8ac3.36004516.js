/**
 * CONTENT
 */

"use strict";

(function () {

    let checkIndexInArray = 0;

    const port = chrome.runtime.connect({name: "port_check"});

    chrome.storage.local.get(function (data) {
        if (typeof data.OLIMP_URL !== 'undefined' && data.OLIMP_URL !== ''
            && window.location.href.indexOf(data.OLIMP_URL) > -1) {
            chrome.runtime.sendMessage({
                olimpLoaded: true,
                olimpUrl: data.OLIMP_URL,
                thisUrl: window.location.href
            });
        }
    });

    const checkRule = r => {
        if (!r.condition) {
            //console.log(`Check rule ${r.id} => ${r.value}`);
            const check = r.value.indexOf(';') > -1 ? r.value.split(';')[checkIndexInArray].trim() : r.value.trim();
            return (r.id === 'href' ? document.location.href : document.title).indexOf(check) > -1;
        } else {
            return checkCondition(r);
        }
    };

    const checkCondition = c => {
        //console.log(`Check condition ${c.condition}`);
        return c.rules[(c.condition === 'AND' ? 'every' : 'some')](r => checkRule(r));
    };

    const checkAll = () => {
        console.log('%c' + 'checkAll - FUNCTION',
            'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        chrome.storage.local.get(['AUTOLOAD_MESSAGING'], s => {
            console.log('%c' + 'checkAll - chrome.storage.local.get LISTENER',
                'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            if (!s.AUTOLOAD_MESSAGING) {
                console.log('%c' + 'checkAll: NO SETTINGS!', 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                return;
            }
            const settings = s.AUTOLOAD_MESSAGING;
            if (settings.checkIndexInArray) {
                checkIndexInArray = typeof settings.checkIndexInArray === 'number'
                    ? settings.checkIndexInArray : parseInt(settings.checkIndexInArray);
            }
            console.log('%c'
                + `CHECK script (${document.location.href}) Main: ${(window.self === window.top)} %O`,
                'background: green; color: white; font-weight: bold;',
                settings);
            Object.keys(settings.checks).forEach(bk => {
                if (checkCondition(JSON.parse(settings.checks[bk]))) {
                    const bkUp = bk.toUpperCase();
                    console.log('%c' + `checkAll - WE ARE ON ${bkUp} !`,
                        'background: blue; color: white; font-weight: bold;');
                    const params = {};
                    params[bkUp + '_URL'] = document.location.origin + settings.liveUrls[bk];
                    params[bkUp + '_HOST'] = document.location.host;
                    params[bkUp + '_MAIN'] = window.top === window.self;
                    chrome.storage.local.set({
                        'contentLoadedFor_MESSAGING': {
                            bk: bk, host: document.location.host,
                        },
                        'contentLoadedFor_MESSAGING_CHECK': Date.now(),
                    }, () => {
                        console.log('%c' + `contentLoadedFor was set for '${bk}'`,
                            'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
                        chrome.storage.local.set(params, () => {
                            params['m'] = bkUp + '_URL';
                            port.postMessage(params);
                            const mess = {};
                            mess[bk + 'Loaded'] = true;
                            mess[bk + 'Url'] = params[bkUp + '_URL'];
                            mess['thisUrl'] = document.location.href;
                            mess['scripts'] = settings.scripts[bk].join(';');
                            chrome.runtime.sendMessage(mess);
                            console.log('%c' + `checkAll (${bkUp}/${window.top === window.self}) - message sent !`,
                                'background: blue; color: white; font-weight: bold;');
                        });
                    });
                }
            });
        });
    };

    if (document.readyState === 'loading') {
        console.log('%c' + 'checkAll - LOADING',
            'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        document.addEventListener('DOMContentLoaded', checkAll, {once: true});
    } else {
        checkAll();
        console.log('%c' + 'checkAll - NORMAL',
            'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
    }

    console.log('%c' +
        `CONTENT SCRIPT CHECK AT ${(window.self === window.top ? 'TOP' : 'CHILD')} '${document.location.href}'`,
        'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');

})();
