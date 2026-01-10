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
	
	$parsing_url = 'http://194.55.234.95:8111/forks?token=b4af422daa9e3eae0ca27b52b6349259&bk_name=pinnacle&bk2_name=stake&sport=hockey&score_filter=0&min_fi=0';

    while (true) {
        $content = getContent($parsing_url);
	//if (strlen($content) > 10) {
	//    file_put_contents(__DIR__.'/'.time().'.json', $content);
	//}
        file_put_contents(__DIR__.'/current.json', $content);
        usleep(500000);
    }


