<?php

return [
    'MARATHON_CONFIRM_LINK' => [
        'checkField' => [
            'field' => 'from_address',
            'value' => 'support@marathonbet.com'
        ],
        'checkBody' => [
            'field' => 'text_html',
            'selector' => [
                'p:contains("перейдите по ссылке") a',
                'p:contains("please click on the link") a',
            ],
            'attr' => 'href',
        ]
    ],
    'ONEXBET_CONFIRM_LINK' => [
        'checkField' => [
            'field' => 'from_address',
            'value' => 'www@1xbet.com'
        ],
        'checkBody' => [
            'field' => 'text_html',
            'selector' => [
                'a[alt="Завершить регистрацию"]',
            ],
            'attr' => 'href',
        ]
    ],
    'CLOUDBET_CONFIRM_LINK' => [
        'checkField' => [
            'field' => 'from_address',
            'value' => 'support@cloudbet.com'
        ],
        'checkBody' => [
            'field' => 'text_html',
            'selector' => [
                'a:contains("Activate Account")',
            ],
            'attr' => 'href',
        ]
    ],
    'BLOCKCHAIN_CONFIRM_LINK' => [
        'checkField' => [
            'field' => 'from_address',
            'value' => 'no-reply@blockchain.info'
        ],
        'checkBody' => [
            'field' => 'text_html',
            'selector' => [
                'a:contains("Authorize Log In")',
            ],
            'attr' => 'href',
        ]
    ],
    'OLIMP_CONFIRM_LINK' => [
        'checkField' => [
            'field' => 'from_address',
            'value' => 'robot@olimp.com'
        ],
        'checkBody' => [
            'field' => 'text_html',
            'regex' => '|для верификации на сайте.*?Код: (\d{9,})|is',
        ]
    ],
    'BETCITY_CONFIRM_CODE' => [
        'checkField' => [
            'field' => 'from_address',
            'value' => 'support@betcityru.com'
        ],
        'checkBody' => [
            'field' => 'text_plain',
            'regex' => '|Activation code: ([\d\w]{9,})|is',
        ]
    ],
    'SKRILL_CONFIRM_CODE' => [
        'checkField' => [
            'field' => 'from_address',
            'value' => 'skrill@notifications.skrill.com'
        ],
        'checkBody' => [
            'field' => 'text_html',
            'regex' => '#(?:Here is your authentication code|Ваш код аутентификации):\s?([\d]{6})#is',
        ]
    ],
    'NETELLER_CONFIRM_CODE' => [
        'checkField' => [
            'field' => 'from_address',
            'value' => 'neteller@notifications.neteller.com'
        ],
        'checkBody' => [
            'field' => 'text_html',
            'regex' => '#(?:Here is your authentication code|Ваш код аутентификации):\s?([\d]{6})#is',
        ]
    ],
    '1XBET_ENTER_CODE' => [
        'checkField' => [
            'field' => 'from_address',
            'value' => ['no-reply@1xbet.com', 'no-reply@betwinner.com', 'no-reply@fan-sport.club',
                'no-reply@linebet.com', 'no-reply@astekbet.com',]
        ],
        'checkBodyOr' => [
            [
                'field' => 'text_plain',
                'regex' => '#Скопируйте Ваш код для подтверждения действия:.*?([\d]{5})#is',
            ],
            [
                'field' => 'text_html',
                'regex' => '#Скопируйте Ваш код для подтверждения действия:.*?([\d]{5})#is',
            ]
        ],
    ],
    'OLIMP_VERIFICATION_CODE' => [
        'checkField' => [
            'field' => 'from_address',
            'value' => ['robot@olimp.com',]
        ],
        'checkBody' => [
            'field' => 'text_html',
            'regex' => '#Код БК Олимп: ([\d]{6}). Для снятия денег!#is',
        ],
    ],
    'STAKE_WITHDRAW_CODE' => [
        'checkField' => [
            'field' => 'from_address',
            'value' => 'noreply@stake',
            'approximately' => true,
        ],
        'checkBody' => [
            'field' => 'subject',
            'regex' => '#Your unique withdrawal code ([\d]{6})#is',
        ],
    ],
    'STAKE_WELCOME' => [
        'checkField' => [
            'field' => 'from_address',
            'value' => ['noreply@stake',],
            'approximately' => true,
        ],
        'checkBody' => [
            'field' => 'text_html',
            'selector' => [
                'a:contains("Verify Email")',
            ],
            'attr' => 'href',
        ],
    ],
];
