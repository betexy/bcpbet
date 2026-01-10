class Common {
    constructor() {
        this._bkUrlCheck = JSON.parse(JSON.stringify(this._predefined('bkUrlCheck')));
        this._bkUrls = JSON.parse(JSON.stringify(this._predefined('bkUrls')));
        this.bkUrls = this._gBkUrls();
        this._settings = Common._getSettings();
        const self = this;
        self.initialOpenBks()
            .then(() => console.log(`BK should be loaded!`))
            .catch(e => console.error(`Initial open:`, e))
    }

    async initialOpenBks() {
        console.log('%c' + `initialOpenBks: ${this._settings.active_bks.join(', ')}`,
            'background: green; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
        for (const bk of this._settings.active_bks) {
            await this.reopenBk(bk);
        }
        await this._delayPromise(3000);
        const self = this;
        chrome.tabs.query({}, tabs => {
            if (!self._settings.active_bks
                    .every(bk => tabs.some(tb => tb.url.indexOf(self.bkUrls[bk]) > -1))
                && tabs.length === 1) {
                chrome.runtime.reload();
            }
        });
    }

    reopenBk(bk) {
        const self = this;
        return new Promise((onSuccess) => {
            self.openBk(bk, true)
                .then(() => onSuccess());
        });
    }

    openBk(bk, dontCheckInExistingTabs) {
        const self = this;
        return new Promise((onSuccess) => {
            self.getBkTab(bk, dontCheckInExistingTabs)
                .then(() => {
                    //console.log('We are in ' + bk + ' tab!');
                    onSuccess();
                });
        });
    }

    getBkTab(bk, dontCheckInExistingTabs) {
        const self = this;
        //console.log('%c' + `getBkTab ${bk} / ${dontCheckInExistingTabs} / %O`,
        //    'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;', self.bkTabs);
        return new Promise((onSuccess) => {
            // Create new tab for BK
            //console.log('%c' + `chrome.tabs.create ${self.bkUrls[bk]}`, 'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
            chrome.tabs.create({url: self.bkUrls[bk]}, newTab => {
                onSuccess(newTab);
            });
        });
    }

    _gBkUrls() {
        const t = Object.assign({}, this._bkUrls);
        const self = this;
        Object.keys(this._bkUrls).map(key => {
            if (bbSettings.url_rewrite[key] && self._bkUrlCheck[key]) {
                const d = /^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)/.exec(bbSettings.url_rewrite[key]);
                if (d && d[1]) {
                    self._bkUrlCheck[key] = d[1];
                }
            }
            return t[key] = bbSettings.url_rewrite[key] || self._bkUrls[key];
        });
        return t;
    }

    static _getSettings() {
        return {
            active_bks: bbSettings.active_bks || [],
        };
    }

    _predefined(type) {
        const localBkUrls = JSON.parse(JSON.stringify(bbSettings.commonSettings.bkUrls));
        Object.keys(localBkUrls).forEach(bk => {
            if (localBkUrls[bk].indexOf(';') > -1) {
                localBkUrls[bk] = localBkUrls[bk].split(';')[0].trim();
            }
        });
        return {
            'bkUrls': localBkUrls,
            'bkUrlCheck': bbSettings.commonSettings.bkUrlCheck,
        }[type];
    }

    /**
     * Delay in ms
     * @param ms
     * @param {Object} [throughout]
     * @returns {Promise<any>}
     */
    _delayPromise(ms, throughout) {
        let through = typeof throughout === 'undefined' ? true : throughout;
        return new Promise(function (onSuccess, onReject) {
            setTimeout(function () {
                onSuccess(through);
            }, ms);
        });
    }
}

const t = new Common();

