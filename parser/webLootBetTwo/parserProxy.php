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
	
// $parsing_url = 'http://194.55.234.95:8111/forks?token=b4af422daa9e3eae0ca27b52b6349259&bk_name=pinnacle&bk2_name=lootbet&min_fi=0.5';
$parsing_url = 'http://api.oddscp.com:8111/valuebets?bk_name=lootbet&min_fi=6&get_market_data=2&token=b4af422daa9e3eae0ca27b52b6349259';

$prev = '';
while (true) {
	usleep(500000);
	$content = getContent($parsing_url);
	if ($content === $prev) {
		continue;
	}
	$content_length = strlen($content);
	$file_count = count(glob(__DIR__. '/*.json'));
	if ($content_length > 10 && $file_count < 20) {
		file_put_contents(__DIR__.'/'.time().'.json', $content);
	} elseif ($content_length > 10) {
		file_put_contents(__DIR__.'/stats.txt', "$parsing_url\ncontent_length: $content_length, file_count: $file_count");
	}
	file_put_contents(__DIR__.'/current.json', $content);	
	$prev = $content;
}


