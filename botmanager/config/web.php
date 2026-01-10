<?php

$params = require __DIR__ . '/params.php';
$db = require __DIR__ . '/db.php';

$targets = [
    [
        'class' => 'yii\log\FileTarget',
        'levels' => ['error', 'warning'],
        'logFile' => '@runtime/logs/error.log',
    ],
];
if (YII_DEBUG && !NO_DEBUG_DB_WEB) {
    $targets[] = [
        'class' => 'yii\log\FileTarget',
        'levels' => ['info'],
        'categories' => ['yii\db\Command::query'],
        'logVars' => [],
        'logFile' => '@app/runtime/logs/db.log',
    ];
}

$config = [
    'id' => 'basic',
    'basePath' => dirname(__DIR__),
    'bootstrap' => ['log'],
    'aliases' => [
        '@bower' => '@vendor/bower-asset',
        '@npm' => '@vendor/npm-asset',
    ],
    'components' => [
        'redis' => [
            'class' => 'yii\redis\Connection',
            'hostname' => 'redis',
            'port' => 6379,
            'database' => 0,
        ],
        'request' => [
            // !!! insert a secret key in the following (if it is empty) - this is required by cookie validation
            'cookieValidationKey' => 'FICOp1C1gjqcNh9aMTzqJ95V0b_urIEd',
        ],
        'cache' => [
            'class' => 'yii\caching\FileCache',
        ],
        'user' => [
            'identityClass' => 'app\models\User',
            'enableAutoLogin' => true,
        ],
        'errorHandler' => [
            'errorAction' => 'site/error',
        ],
        'mailer' => [
            'class' => 'yii\swiftmailer\Mailer',
            // send all mails to a file by default. You have to set
            // 'useFileTransport' to false and configure a transport
            // for the mailer to send real emails.
            'useFileTransport' => true,
        ],
        'log' => [
            'traceLevel' => YII_DEBUG ? 3 : 0,
            'targets' => $targets,
        ],
        'db' => $db,
        'urlManager' => [
            'enablePrettyUrl' => true,
            'showScriptName' => false,
            'rules' => [
                'bb_test.php' => 'BotManager/api/bb_test',
                'bb_bot.php' => 'BotManager/api/bb_bot',
                'bb_parser.php' => 'BotManager/api/bb_parser',
                'get_event' => 'BotManager/api/get-event',
                'find_event' => 'BotManager/api/find-event',
            ],
        ],
        'i18n' => [
            'translations' => [
                'BotManager' => [
                    'class' => 'yii\i18n\PhpMessageSource',
                    'basePath' => '@app/modules/BotManager/messages',
                ],

                '*' => [
                    'class' => 'yii\i18n\PhpMessageSource',
                    'basePath' => '@app/messages', // if advanced application, set @frontend/messages
                    'sourceLanguage' => 'en',
                    'fileMap' => [
                        //'main' => 'main.php',
                    ],
                ],
            ],
        ],
        'formatter' => [
            'datetimeFormat' => 'dd.MM.yy H:i:s',
            'dateFormat' => 'dd.MM.yyyy',
            'timeFormat' => 'H:i:s',
            'decimalSeparator' => '.',
            'thousandSeparator' => ' ',
            'currencyCode' => 'EUR',
            'timeZone' => 'Asia/Novosibirsk',
        ],
    ],
    'modules' => [
        'admin' => [
            'class' => 'app\modules\admin\Module',
            'layout' => 'main',
        ],
        'Accounts' => [
            'class' => 'app\modules\Accounts\Module',
        ],
        'BotManager' => [
            'class' => 'app\modules\BotManager\Module',
            'files_dir_alias' => '@app/files/',
            'internal_js_alias' => '@app/modules/BotManager/Helpers/js/',
        ],
        'sims-manager' => [
            'class' => 'app\modules\SimsManager\SimsManager',
            'apiUrl' => 'http://176.112.203.98/smb_scheduler/api.php?username=admin&password=9Vz95YG9ecqPBvmURGUM',
            'apiBasicAuth' => 'jambo:cw3J3P2BRSEwfCwzGNS3',
            'GOIPUrl' => 'http://176.112.203.98/goip/getSmses.php',
            'GOIPLoginPassword' => [
                'username' => 'y6JuYkhY4v5',
                'password' => '2gHRPRFUfCWG36s8P4Gh',
            ],
        ],
        'pay-systems' => [
            'class' => 'app\modules\PaySystems\PaySystems',
            'files_dir_alias' => '@app/files/',
        ],
        'emails' => [
            'class' => 'app\modules\Emails\Emails',
            'files_dir_alias' => '@app/files/',
            'attachments_path' => '@app/files/emailAttachments'
        ],
    ],
    'params' => $params,
];

if (YII_DEBUG) {
    // configuration adjustments for 'dev' environment
    $allowed = ['127.0.0.1', '::1', '192.168.99.100', '192.168.*.*', '172.*.*.*'];
    $config['bootstrap'][] = 'debug';
    $config['modules']['debug'] = [
        'class' => 'yii\debug\Module',
        // uncomment the following to add your IP if you are not connecting from localhost.
        'allowedIPs' => $allowed,
    ];

    $config['bootstrap'][] = 'gii';
    $config['modules']['gii'] = [
        'class' => 'yii\gii\Module',
        // uncomment the following to add your IP if you are not connecting from localhost.
        'allowedIPs' => $allowed,
    ];
}

return $config;
