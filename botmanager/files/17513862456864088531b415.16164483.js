function save_options() {
    const
        stake = document.getElementById('stake').value,
        currency = document.getElementById('currency').value;
    chrome.storage.sync.get({
        bbStake: -1,
        bbCurrency: '',
    }, function (items) {
        if (items.bbStake === stake && items.bbCurrency === currency) {
            return;
        }
        chrome.storage.sync.set({
            bbStake: stake,
            bbCurrency: currency,
        }, function () {
            // Update status to let user know options were saved.
            const status = document.getElementById('status');
            chrome.runtime.sendMessage({
                backgroundSpecialAction: 'reload',
            }, function(response) {
                status.textContent = 'Options saved';
                setTimeout(function () {
                    window.close();
                }, 3000);
            });
        });
    });
}

function restore_options() {
    chrome.storage.sync.get({
        bbStake: -1,
        bbCurrency: '',
    }, function (items) {
        document.getElementById('stake').value = items.bbStake;
        document.getElementById('currency').value = items.bbCurrency;
    });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
