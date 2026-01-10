(() => {
    //console.log('%c' + 'Push remover loaded!', 'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 45px;');

    let iteration = 0;
    let t = setInterval(() => {
        if (document.querySelector('div.grv-dialog-host') && document.querySelector('div.grv-dialog-host').shadowRoot) {
            const s = document.querySelector('div.grv-dialog-host').shadowRoot.querySelector('button.sub-dialog-btn.block_btn');
            if (!!s) {
                s.click();
                clearInterval(t);
                console.log('%c' + 'Cancel from pushes clicked!', 'background: green; color: white; font-size: 12px; font-weight: bold; padding: 15px;');
            }
        }
        if (iteration >= 90) {
            console.log('%c' + 'Pari push checker stopped!', 'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 15px;');
            clearInterval(t);
        }
        if (iteration % 10 === 0) {
            //console.log(`Iterations: ${iteration}`);
        }
        iteration++;
    }, 1000);

    console.log('%c' + 'Push remover executed', 'background: blue; color: white; font-size: 12px; font-weight: bold; padding: 15px;');
})();
