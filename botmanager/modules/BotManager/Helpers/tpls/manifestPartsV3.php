<?php

return [
    'tennisi_background' => 'libs/baseAuth.js',
    'include_js_for' => '{
            "js": [
                "libs/jquery-3.3.1.min.js",
                "libs/js.cookie.min.js",
                "libs/emulatetab.joelpurra.min.js",
                "libs/helper.js",
                "libs/similar_text.js",
                "libs/levenshtein.js"
            ],
            "matches": [
                #INCLUDE_JS_FOR#
            ],
            "all_frames": true#PARRRIBY#
        }',
    'leon_redirects' => '{
            "js": [
                "js/leonRedirect.js"
            ],
            "matches": [
                "*://*.leonbche.com/*",
                "*://*.leonbets7625.com/*",
                "*://*.swleon2087.com/*",
                "*://*.swleon6913.com/*",
                "*://*.swleon1121.com/*"
            ]
        }',
    'content_script' => "        {\r\n            \"js\": [\r\n                #JS#\r\n            ],"
        . "\r\n            \"matches\": [\r\n                #MATCHES#\r\n            ]#BET365##PARIBY#        }",
    'for_all_frames' => ",\r\n            \"all_frames\": true",
    'for_match_about_blank' => ",\r\n            \"match_about_blank\": true\r\n",
    'document_start' => ",\r\n            \"run_at\": \"document_start\"",
];