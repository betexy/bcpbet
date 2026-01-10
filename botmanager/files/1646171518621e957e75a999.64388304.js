"use strict";

(() => {

    let interval, lastID, maxRecaptchaLoops = 15;

    /**
     *
     * @param {number} rType - 0 - wait result, 1 - solve coordinates, 2 - solve recaptcha, classic method
     * @param {number} requestId - for 0 - id of being checked request
     * @param {Object} [captcha]
     * @param {string} [captcha.captchaBase64] - for rType 1 and 2
     * @param {string} [captcha.instructions] - for rType 2
     * @param {string} [captcha.cols] - for rType 2
     * @param {string} [captcha.rows] - for rType 2
     * @param {string} [captcha.previousID ] - for rType 2
     * @returns {Promise<Object>}
     */
    let sentToRucaptcha = function (rType, requestId, captcha) {
        return new Promise(function (onSuccess, onReject) {
            let messageToSend = {
                backgroundSpecialAction: 'ajaxUrl',
                url: rType ? 'rucaptchaSend' : 'rucaptchaRes',
                noBaseAuth: true,
                data: {
                    key: 'd8d55d8baee6cef4411e09fa60a82974',
                    json: 1
                }
            };
            if (rType === 1) {
                messageToSend.data['body'] = captcha.captchaBase64;
                messageToSend.data['method'] = 'base64';
                messageToSend.data['coordinatescaptcha'] = 1;
                messageToSend.data['language'] = 1;
            } else if (rType === 2) {
                messageToSend.data['body'] = captcha.captchaBase64;
                messageToSend.data['method'] = 'base64';
                messageToSend.data['recaptcha'] = 1;
                messageToSend.data['can_no_answer'] = 1;
                messageToSend.data['language'] = 1;
                messageToSend.data['textinstructions'] = captcha.instructions;
                messageToSend.data['recaptchacols'] = captcha.cols;
                messageToSend.data['recaptcharows'] = captcha.rows;
                if (typeof captcha.previousID === 'string' && captcha.previousID.length > 0) {
                    messageToSend.data['previousID '] = captcha.previousID;
                }
            } else {
                messageToSend.data['action'] = 'get';
                messageToSend.data['id'] = requestId;
                messageToSend['useGET'] = true;
            }
            try {
                chrome.runtime.sendMessage(
                    messageToSend,
                    (response) => {
                        console.log('%c responseCallback: ' + response.success, 'background: green; color: white; font-weight: bold;');
                        console.log(response);
                        if (response.success) {
                            onSuccess(response.message);
                        } else {
                            onReject(response.message);
                        }
                    });
            } catch (e) {
                onReject('Error till send message: ' + e);
            }
        });
    };

    let recogniseReCaptcha = function (classicRecaptcha) {
        return new Promise((onSuccess, onReject) => {
            let requestId = 0;
            let waitStarted = 0;
            let captchaObject;
            let waitForResponse = function () {
                return new Promise(function (onSuccess, onReject) {
                    let errors = 0;
                    let performWait = function () {
                        sentToRucaptcha(0, requestId)
                            .then((res) => {
                                console.log(res);
                                if (res.request === 'CAPCHA_NOT_READY') {
                                    delayPromise(5000).then(performWait);
                                } else if (res.request === 'ERROR_CAPTCHA_UNSOLVABLE') {
                                    onReject('RuCaptcha can\'t solve it ERROR_CAPTCHA_UNSOLVABLE :(');
                                } else if (res.request === 'ERROR_BAD_DUPLICATES') {
                                    onReject('RuCaptcha can\'t solve it ERROR_BAD_DUPLICATES :(');
                                } else if (parseInt(res.status) === 1) {
                                    onSuccess(res.request);
                                } else if (Date.now() - waitStarted < 60000) {
                                    delayPromise(5000).then(performWait);
                                } else {
                                    errors++;
                                    if (errors < 5) {
                                        console.log('%c' + 'Bad status from rucaptcha: ' + JSON.stringify(res),
                                            'background: red; color: yellow; font-size: 13px; font-weight: bold; padding: 3px;');
                                        delayPromise(5000).then(performWait);
                                    } else {
                                        throw 'Bad status from rucaptcha: ' + JSON.stringify(res);
                                    }
                                }
                            })
                            .catch((e) => {
                                errors++;
                                if (errors < 5) {
                                    console.log('%c' + 'Error requesting recaptcha: ' + e,
                                        'background: red; color: yellow; font-size: 13px; font-weight: bold; padding: 3px;');
                                    delayPromise(5000).then(performWait);
                                } else {
                                    onReject('Errors (' + errors + '): ' + e);
                                }
                            });
                    };
                    delayPromise(5000).then(performWait);
                });
            };
            // $('#rc-imageselect div.rc-imageselect-instructions').text().trim(); - instructions
            // #recaptcha-verify-button - continue or done button
            // getBase64Image($('#rc-imageselect div.rc-imageselect-challenge img:first').get(0), true) - img

            (classicRecaptcha
                ? delayPromise(11)
                    .then(() => {
                        // rc-imageselect-table-42
                        const rcClass = $('#rc-imageselect div.rc-imageselect-challenge table').attr('class');
                        captchaObject = {
                            captchaBase64: getBase64Image($('#rc-imageselect div.rc-imageselect-challenge img:last').get(0), true),
                            instructions: $('#rc-imageselect div.rc-imageselect-instructions').text()
                                .replace($('#rc-imageselect div.rc-imageselect-instructions span').text(), '').trim(),
                            cols: rcClass.indexOf('33') > -1 ? 3 : (rcClass.indexOf('42') > -1 ? 2 : 4),
                            rows: rcClass.indexOf('33') > -1 ? 3 : 4,
                            previousID: $('div.rc-imageselect-error-dynamic-more:visible').length > 0 ? lastID : ''
                        };
                        console.log(captchaObject);
                    })
                : html2canvas($('#rc-imageselect').get(0))
                    .then(canvas => {
                        let image = canvas.toDataURL('image/jpeg');
                        captchaObject = {captchaBase64: image.replace(/^data:image\/(png|jpg);base64,/, "")};
                    }))
                .then(() => sentToRucaptcha(classicRecaptcha ? 2 : 1, 0, captchaObject))
                .then((res) => {
                    console.log(res);
                    if (parseInt(res.status) === 1) {
                        requestId = res.request;
                        lastID = requestId.toString();
                        waitStarted = Date.now();
                    } else {
                        throw 'Bad status from rucaptcha: ' + JSON.stringify(res);
                    }
                })
                .then(delayFunction(20000))
                .then(waitForResponse)
                .then((r) => onSuccess(r))
                .catch((e) => onReject(e));
        });
    };

    let clickPointsAndSubmit = function (points) {
        return new Promise((onSuccess, onReject) => {
            let rect = $('#rc-imageselect').get(0).getBoundingClientRect();
            let clickPoint = function () {
                let point = points.shift();
                if (typeof point === 'undefined') {
                    // We suppose it is last point
                    mouseChain({target: $('#recaptcha-verify-button')[0], events: ['click']})
                        .then(() => console.log('%c' + 'CLICKED!!!',
                            'background: lightgreen; color: black; font-size: 30px; font-weight: bold; padding: 20px;'))
                        .then(onSuccess)
                        .catch(e => onReject('cPAS final stage: ' + e));
                }
                let meX = rect.left + parseInt(point.x), meY = rect.top + parseInt(point.y);
                console.log('%c' + 'Point (' + meX + 'x' + meY + '):', 'background: blue; color: yellow; font-size: 12px; font-weight: bold', point);
                bsSendMouseClick('onexbet', meX, meY)
                    .then(delayFunction(getRandomRounded(1000, 2500)))
                    .then(clickPoint)
                    .catch(e => onReject('cPAS point ' + JSON.stringify(point) + ' click: ' + e));
            };
            clickPoint();
        });
    };

    let clickImagesAndSubmit = function (imNumbers) {
        return new Promise((onSuccess, onReject) => {
            let clickImage = function () {
                let number = imNumbers.shift();
                if (typeof number === 'undefined') {
                    // We suppose it is last point
                    mouseChain({target: $('#recaptcha-verify-button')[0], events: ['click']})
                        .then(() => console.log('%c' + 'CLICKED!!!',
                            'background: lightgreen; color: black; font-size: 30px; font-weight: bold; padding: 20px;'))
                        .then(onSuccess)
                        .catch(e => onReject('cPAS final stage: ' + e));
                }
                console.log('%c' + 'Number: ' + number, 'background: blue; color: yellow; font-size: 12px; font-weight: bold');
                mouseChain({
                    target: $('#rc-imageselect div.rc-image-tile-target').eq(parseInt(number) - 1)[0],
                    events: ['click']
                })
                    .then(delayFunction(getRandomRounded(1000, 2500)))
                    .then(clickImage)
                    .catch(e => onReject('cPAS number ' + number + ' click: ' + e));
            };
            clickImage();
        });
    };

    let recaptchaLoop = function () {
        return new Promise((onSuccess, onReject) => {
            let success = false;
            const oneLoop = (recaptchaLoop) => {
                if (recaptchaLoop > maxRecaptchaLoops || success) {
                    return Promise.resolve(recaptchaLoop + ' loops!');
                } else {
                    return recogniseReCaptcha(true)
                        .then(r => {
                            console.log('%c' + 'Result (' + recaptchaLoop + '): ' + r,
                                'background: blue; color: white; font-size: 14px; font-weight: normal; padding: 10px;');
                            console.log(r);
                            return r.replace('click:', '').split('/');
                        })
                        .then(r => clickImagesAndSubmit(r))
                        .then(delayFunction(5000))
                        .then(waitForNotConditionF(() => {
                            return $('div.rc-imageselect-incorrect-response:visible').length > 0 // repeat
                                || $('div.rc-imageselect-error-select-more:visible').length > 0 // need all
                                || $('div.rc-imageselect-error-dynamic-more:visible').length > 0 // New !!!
                                || $('#recaptcha-verify-button:visible').length > 0; // button
                            //|| (elementIsVisible($('#rc-imageselect').get(0)) && $('#rc-imageselect').width() < 500); // recaptcha still visible
                        }, 333, 5000, 'Nevermind!'))
                        .then(() => {
                            console.log('%c' + 'THEN (' + recaptchaLoop + '): ' + r,
                                'background: green; color: white; font-size: 14px; font-weight: normal; padding: 10px;');
                            success = true;
                            return oneLoop(++recaptchaLoop);
                        })
                        .catch(r => {
                            const t = $('div.rc-imageselect-incorrect-response:visible').length.toString()
                                + '-' + $('div.rc-imageselect-error-select-more:visible').length.toString()
                                + '-' + $('div.rc-imageselect-error-dynamic-more:visible').length.toString()
                                + '-' + $('#recaptcha-verify-button:visible').length.toString();
                            console.log('%c' + 'THROW (' + recaptchaLoop + ') ' + t + ': ' + r,
                                'background: red; color: white; font-size: 14px; font-weight: normal; padding: 10px;');
                            success = false;
                            return oneLoop(++recaptchaLoop)
                        });
                }
            };
            oneLoop(1)
                .then((s) => success ? onSuccess('Resolved in ' + s) : onReject('Not done for ' + s))
                .catch((e) => onReject('Error: ' + e));
        });
    };

    let checkRecaptcha = function () {
        if ($('div.rc-doscaptcha-header-text:visible').length > 0) {
            console.log('%c' + 'L A T E R', 'background: red; color: white; font-size: 20px; font-weight: bold; padding: 10px 50px;');
            chrome.storage.local.set({'ONEXBET_NEED_STOP': Date.now()});
        } else if (elementIsVisible($('#rc-imageselect').get(0)) && $('#rc-imageselect').width() < 500) {
            clearInterval(interval);
            if (window.location.href.indexOf('/api2/bframe') > -1) {
                //console.log('%c' + '-= BBB =- bframe -= BBB =-', 'background: red; color: white; font-size: 15px; font-weight: bold; padding: 10px;');
            } else if (window.location.href.indexOf('/api2/anchor') > -1) {
                //console.log('%c' + '-= AAA =- anchor -= AAA =-', 'background: red; color: white; font-size: 15px; font-weight: bold; padding: 10px;');
            }
            chrome.storage.local.set({'RUCAPTCHA_OCCURRED': Date.now()});
            console.log('%c' + 'Recaptcha HERE! ' + window.location.href, 'background: darkblue; color: orange; font-size: 16px; font-weight: normal; padding: 10px;');
            console.log($('#rc-imageselect'));
            delayPromise(2000)
                .then(recaptchaLoop)
                .then(() => {
                    chrome.storage.local.set({'RUCAPTCHA_RECOGNIZED': Date.now()});
                })
                .catch(e => console.log('%c' + 'Error: ' + e, 'background: red; color: white; font-size: 14px; font-weight: normal'))
                .then(() => {
                    // Hint: here we need to resume interval...
                    console.log('%c' + 'Plan to resume in 5 minutes!', 'background: green; color: yellow; font-size: 20px; font-weight: bold; padding: 20px;');
                    delayPromise(300000)
                        .then(() => interval = setInterval(checkRecaptchaIfNeeded, 1000));
                });

        } else if (elementIsVisible($('#rc-imageselect').get(0))) {
            console.log('%c' + '-= !!! =- Recaptcha width is: ' + $('#rc-imageselect').width() + 'px -= !!! =-',
                'background: red; color: white; font-size: 15px; font-weight: bold; padding: 10px;');
        }
    };

    const checkRecaptchaIfNeeded = () => chrome && chrome.storage && chrome.storage.local
    && chrome.storage.local.get ? chrome.storage.local.get(['RUCAPTCHA_RECAPTCHA_CHECK'],
        function (result) {
            if (result.RUCAPTCHA_RECAPTCHA_CHECK) {
                checkRecaptcha();
            }
        }
    ) : null;

    interval = setInterval(checkRecaptchaIfNeeded, 1000);
    console.log('%c' + 'Recaptcha: ' + window.location.href,
        'background: transparent; color: lightgray; font-size: 12px; font-weight: normal; padding: 1px;');

})();