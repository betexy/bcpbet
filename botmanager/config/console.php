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
if (YII_DEBUG && !NO_DEBUG_DB_CONSOLE) {
    $targets[] = [
        'class' => 'yii\log\FileTarget',
        'levels' => ['info'],
        'categories' => ['yii\db\Command::query'],
        'logVars' => [],
        'logFile' => '@app/runtime/logs/db.log',
    ];
}

$config = [
    'id' => 'basic-console',
    'basePath' => dirname(__DIR__),
    'bootstrap' => [
        'log',
        'sims-manager',
        'bot-manager',
        'pay-systems',
        'emails',
    ],
    'controllerNamespace' => 'app\commands',
    'aliases' => [
        '@bower' => '@vendor/bower-asset',
        '@npm' => '@vendor/npm-asset',
        '@tests' => '@app/tests',
    ],
    'components' => [
        'urlManager' => [
            'enablePrettyUrl' => true,
            'baseUrl' => 'http://example.org',
            'scriptUrl' => 'http://example.org',
            'hostInfo' => 'http://example.org',
        ],
        'redis' => [
            'class' => 'yii\redis\Connection',
            'hostname' => 'redis',
            'port' => 6379,
            'database' => 0,
        ],
        'cache' => [
            'class' => 'yii\caching\FileCache',
        ],
        // Hint: log levels are defined in vendor/yiisoft/yii2/log/Target.php:
        /*
         static $levelMap = [
             'error' => Logger::LEVEL_ERROR,
             'warning' => Logger::LEVEL_WARNING,
             'info' => Logger::LEVEL_INFO,
             'trace' => Logger::LEVEL_TRACE,
             'profile' => Logger::LEVEL_PROFILE,
         ];
        */
        'log' => [
            'traceLevel' => YII_DEBUG ? 3 : 0,
            'targets' => $targets,
        ],
        'db' => $db,
        'i18n' => [
            'translations' => [
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
    ],
    'params' => $params,
    'modules' => [
        'sims-manager' => [
            'class' => 'app\modules\SimsManager\SimsManager',
            'apiUrl' => 'http://176.112.203.98/smb_scheduler/api.php?username=admin&password=9Vz95YG9ecqPBvmURGUM',
            'apiBasicAuth' => 'jambo:cw3J3P2BRSEwfCwzGNS3',
            'GOIPUrl' => 'http://176.112.203.98/goip/getSmses.php',
            'GOIPLoginPassword' => [
                'username' => 'y6JuYkhY4v5',
                'password' => '2gHRPRFUfCWG36s8P4Gh',
            ],
            'requestsPerMinute' => 6,
        ],
        'bot-manager' => [
            'class' => 'app\modules\BotManager\Module',
            'files_dir_alias' => '@app/files/',
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
    /*
    'controllerMap' => [
        'fixture' => [ // Fixture generation command line.
            'class' => 'yii\faker\FixtureController',
        ],
    ],
    */
];

if (YII_DEBUG) {
    // configuration adjustments for 'dev' environment
    $config['bootstrap'][] = 'gii';
    $config['modules']['gii'] = [
        'class' => 'yii\gii\Module',
    ];
}
if (YII_ENV_TEST) {
    $config['components']['log']['targets'][] = [
        'class' => 'yii\log\FileTarget',
        'levels' => ['info',],
        //'levels' => ['info', 'trace', ],
        'logFile' => '@runtime/logs/debug.log',
    ];
}

return $config;
