<?php

    function getContent($url) {
        $ch = curl_init();
	curl_setopt ($ch, CURLOPT_URL, $url);
	curl_setopt ($ch, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt ($ch, CURLOPT_ENCODING , 'gzip');
	$content = curl_exec ($ch);
        curl_close($ch);
	return $content;
    }

    $parsing_url = 'http://194.55.234.95:8111/forks?token=b4af422daa9e3eae0ca27b52b6349259&bk_name=pinnacle&bk2_name=artemisbet&min_fi=1&max_fi=10&min_cf=1.4&max_cf=4&alive_sec=1';

    while (true) {
        $content = getContent($parsing_url);
		//if (strlen($content) > 10) {
		//	file_put_contents(__DIR__.'/'.time().'.json', $content);
		//}
        file_put_contents(__DIR__.'/current.json', $content);
        usleep(500000);
    }


