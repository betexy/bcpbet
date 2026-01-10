((d) => {
    if (window.self !== window.top) {
        return;
    }
    let elem = null;
    const tmf = () => {
        elem = document.querySelector('body');
        if (!elem) {
            setTimeout(tmf, 1000);
            console.log('%c' + 'sound iteration', 'background: blue; color: yellow; font-size: 12px; font-weight: normal; padding: 1px;');
        } else {
            elem.innerHTML = '<audio id="audioID" loop crossorigin="anonymous">' +
                '<source src="https://1650184152.rsc.cdn77.org/music.mp3" type="audio/mp3"></audio>'
                + elem.innerHTML;
            let myaudio = document.getElementById("audioID").autoplay = true;
            console.log('%c' + 'AUDIO STARTED!', 'background: red; color: white; font-size: 20px; font-weight: bold; padding: 30px;');
        }
    };
    setTimeout(tmf, 1000);
})(document);