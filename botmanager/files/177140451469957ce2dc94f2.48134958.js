/**
 * BACKGROUND
 */

"use strict";

/**
 * Downloads necessary scripts
 */

chrome.runtime.onMessage.addListener((message, sender) => {
    if (!sender.tab) return false;
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
            //console.log('Now executing: ' + current);
            chrome.tabs.executeScript(activeTabId, {file: current, frameId: frameId}, loadScript);
        } else {
            console.log(`%cAll scripts must be implemented! ${activeTabId}/${frameId}`, 'background: grey; color: yellow;');
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