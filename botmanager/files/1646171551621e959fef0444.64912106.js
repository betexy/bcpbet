(() => {

    'use strict';

    let i;

    i = setInterval(() => {
        let answer;
        if (document.location.href.indexOf('red7mobile.com') > -1) {
            // Hint: HOCKEY
            answer = {
                match: $('div.top-scores td.teamAname').text().trim() + ' v ' + $('div.top-scores td.teamBname').text().trim(),
                score: $('div.top-scores td.matchScores').text().trim(),
                set: Date.now()
            };
        } else {
            if ($('#topContainer span.team_name').length > 0) {
                // Hint: FOOTBALL
                answer = {
                    match: $('#topContainer span.team_name').eq(0).text().trim() + ' v ' + $('#topContainer span.team_name').eq(1).text().trim(),
                    score: $('div.topScore[data-push="score"]').text().replace('-', ':').replace(/[^\d:]/g, '').trim(),
                    set: Date.now()
                };
            } else {
                // Hint: TENNIS
                answer = {
                    match: $('#topContainer td.box_teams div.name').eq(0).text().trim() + ' v ' + $('#topContainer span.team_name').eq(1).text().trim(),
                    score: $('#topContainer td.sets').eq(0).text().trim() + ':' + $('#topContainer td.sets').eq(1).text().trim(),
                    set: Date.now()
                };
            }
        }
        //console.log(answer);
        if (answer.score.indexOf(' ') > -1 || answer.score.length < 3 || answer.score.indexOf('{') > -1) {
            answer.score = '';
        }
        chrome.storage.local.set({'WILLIAMHILL_MSCORE': answer});
    }, 333);

    console.log('%c' + 'staticcache.org loaded! ' + i, 'background: transparent; color: green; font-size: 12px; font-weight: bold');

})();