/**
 * Code from Chrome Extension:
 * https://chrome.google.com/webstore/detail/%D0%B1%D0%BB%D0%BE%D0%BA%D0%B8%D1%80%D0%BE%D0%B2%D1%89%D0%B8%D0%BA-%D1%8F%D0%BD%D0%B4%D0%B5%D0%BA%D1%81%D0%BC%D0%B5%D1%82%D1%80%D0%B8%D0%BA%D0%B8/gchpojdbkmdnbgpmlncnhafkpgnddcmd
 * Special thanks to!
 */
(function () {
    var code = [
            'window.Ya = window.Ya || {};',
            'Ya._metrika = Ya._metrika || {};',
            'Ya._metrika.oo = true;'
        ].join(''),
        script = document.createElement('script');

    script.type = 'text/javascript';
    script.innerText = code;
    document.documentElement.insertBefore(script, document.documentElement.firstChild);
})();
