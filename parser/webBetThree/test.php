<?php
echo "webBetThree\n\n" . PHP_EOL;

 function getContent($url) {
        $ch = curl_init();
	curl_setopt ($ch, CURLOPT_URL, $url);
	curl_setopt ($ch, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt ($ch, CURLOPT_ENCODING , 'gzip');
	$content = curl_exec ($ch);
        curl_close($ch);
	return $content;
    }

$parsing_url = 'http://194.55.234.95:8111/forks?token=b4af422daa9e3eae0ca27b52b6349259&bk_name=fonbet&bk2_name=bet365&min_fi=0.5&sport=hockey';

$content = getContent($parsing_url);

echo "We got content: '{$content}' " . PHP_EOL . PHP_EOL;

$res = json_decode($content);

if (is_null($res)) {
	echo "error!";
} else {
	echo "ok!";
}

