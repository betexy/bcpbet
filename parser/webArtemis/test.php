<?php
echo "ARTEMIS\n\n";
header('Content-Type: application/json; charset=UTF-8');
echo utf8_encode(file_get_contents(dirname(__FILE__) . '/1675916364.json'));
