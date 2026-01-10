let tickInterval = setInterval(() => {
    chrome.runtime.sendMessage({ 'KEEP ALIVE': 'ALWAYS' });
}, 20000);
