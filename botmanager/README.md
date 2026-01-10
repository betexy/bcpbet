Installation

Configuration for SimsManager:

web.php:

'modules' => [
    // ...   
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
    // ...
],
    
console.php:

'modules' => [
    // ...  
    'sims-manager' => [
    'class' => 'app\modules\SimsManager\SimsManager',
        'apiBasicAuth' => 'jambo:cw3J3P2BRSEwfCwzGNS3',
        'apiUrl' => 'http://176.112.203.98/smb_scheduler/api.php?username=admin&password=9Vz95YG9ecqPBvmURGUM',
        'GOIPUrl' => 'http://176.112.203.98/goip/getSmses.php',
        'GOIPLoginPassword' => [
            'username' => 'y6JuYkhY4v5',
            'password' => '2gHRPRFUfCWG36s8P4Gh',
        ],
        'requestsPerMinute' => 5,
    ]
    // ...  
],

also you need to apply modules' migrations

command to cron:
* * * * * /path/to/yii/yii sims-manager/requests
* * * * * /path/to/yii/yii sims-manager/requests/bind-per-minute