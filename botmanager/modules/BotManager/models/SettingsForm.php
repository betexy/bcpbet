<?php

namespace app\modules\BotManager\models;

use app\modules\PaySystems\models\Paysystems;
use app\modules\PaySystems\models\Wallets;
use Yii;
use yii\base\Model;
use yii\helpers\ArrayHelper;
use yii\helpers\Url;
use yii\helpers\VarDumper;

class SettingsForm extends Model
{

    public $gaz;
    public $gaz_price;
    public $bnb_for_transaction;
    public $bnb_source_wallet_id;
    public $withdrawal_address;

    public $only_existing_wallets;
    public $max_amount;
    public $withdraw_interval;

    public $proxy_api_key;
    public $luminati_api_key;
    public $betexy_login;
    public $betexy_password;
    public $default_browser;

    public $default_pay_system;
    public $default_currency;

    public $server_url;
    public $reports_interval;
    public $bot_path;
    public $max;
    public $multiloginapp_login;
    public $multiloginapp_password;

    public $websocket_url;
    public $test_url;
    public $extension_id;
    public $software_versions_id;
    public $run_into_the_chrome;
    public $test_mode_on;
    public $active_bks;
    public $default_bk_id;
    public $winline_base_url;

    public $users;
    public $http_login;
    public $http_password;
    public $payment_method;
    public $remote_type;

    public $anticaptcha_key;
    public $install_anticaptcha;

    public $sms_api_url;
    public $sms_api_http_login;
    public $sms_api_http_password;
    public $ps_api_url;
    public $ps_api_http_login;
    public $ps_api_http_password;
    public $email_api_url;
    public $email_api_http_login;
    public $email_api_http_password;
    public $screenshot_api_url;
    public $screenshot_api_http_login;
    public $screenshot_api_http_password;

    public $forks_reload_interval;

    public $double_enabled_by_default;
    public $double_default_url;
    public $double_use_main_uid;

    public $allow_server_change;

    private static $instance;
    public static function get(): SettingsForm
    {
        if (!self::$instance) {
            self::$instance = new self();
            self::$instance->loadData();
        }
        return self::$instance;
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['only_existing_wallets', 'max_amount', 'withdraw_interval', 'ps_api_url', 'ps_api_http_login',
                'ps_api_http_password', 'default_browser', ], 'required'],
            [['server_url', 'bot_path', 'multiloginapp_login', 'multiloginapp_password',
                'websocket_url', 'test_url', 'winline_base_url', 'http_login', 'http_password', 'anticaptcha_key',
                'sms_api_url', 'sms_api_http_login', 'sms_api_http_password',
                'screenshot_api_url', 'screenshot_api_http_login', 'screenshot_api_http_password',
                'ps_api_url', 'ps_api_http_login', 'ps_api_http_password',
                'email_api_url', 'email_api_http_login', 'email_api_http_password', 'forks_reload_interval',
                'double_default_url', 'only_existing_wallets', 'max_amount', 'withdraw_interval',
                'proxy_api_key','luminati_api_key', 'betexy_login', 'betexy_password', 'default_browser',
                'withdrawal_address', ], 'safe'],
            [['default_browser'], 'in', 'range' => array_keys(StakeAccounts::$browsers)],
            ['active_bks', function ($attribute, $params) {
                if (!is_array($this->active_bks)) {
                    $this->addError('active_bks', 'Is not array!');
                }
            }],
            ['users', function ($attribute, $params) {
                if (!is_array($this->users)) {
                    $this->addError('users', 'Is not array!');
                }
            }],
            [['reports_interval', 'max', 'payment_method', 'install_anticaptcha',
                'extension_id', 'software_versions_id', 'run_into_the_chrome', 'test_mode_on', 'default_bk_id', 'remote_type',
                'allow_server_change', 'double_enabled_by_default', 'double_use_main_uid',
                'max_amount', 'withdraw_interval', 'only_existing_wallets', 'default_pay_system', 'default_currency',
                'gaz', 'gaz_price', 'bnb_source_wallet_id'], 'integer'],
            [['bnb_for_transaction'], 'double'],
            ['bnb_source_wallet_id', 'exist', 'targetClass' => Wallets::class,
                'targetAttribute' => ['bnb_source_wallet_id' => 'id'],
                'message' => 'Wallet with this ID does not exist.'],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            // Binance
            'gaz' => Yii::t('BotManager', 'Gaz'),
            'gaz_price' => Yii::t('BotManager', 'Gaz price'),
            'bnb_for_transaction' => Yii::t('BotManager', 'BNB for transaction'),
            'bnb_source_wallet_id' => Yii::t('BotManager', 'BNB source wallet ID'),
            'withdrawal_address' => Yii::t('BotManager', 'Main withdrawal address'),
            'ps_api_url' => Yii::t('BotManager', 'PS API Url'),
            'ps_api_http_login' => Yii::t('BotManager', 'PS API base-auth login'),
            'ps_api_http_password' => Yii::t('BotManager', 'PS API base-auth password'),
            'max_amount' => Yii::t('BotManager', 'Maximum withdrawal amount'),
            'withdraw_interval' => Yii::t('BotManager', 'Withdrawal interval per wallet (in hours)'),
            'only_existing_wallets' => Yii::t('BotManager', 'Withdrawals only to approved wallets'),
            'default_pay_system' => Yii::t('BotManager', 'Default pay system for withdrawal to wallet'),
            'default_currency' => Yii::t('BotManager', 'Default currency for withdrawal to wallet'),
            'default_browser' => Yii::t('BotManager', 'Default browser'),
            //
            'proxy_api_key' => Yii::t('BotManager', 'Proxy API key'),
            'luminati_api_key' => Yii::t('BotManager', 'Luminati API key'),
            'betexy_login' => Yii::t('BotManager', 'Betexy login'),
            'betexy_password' => Yii::t('BotManager', 'Betexy password'),
            //
            'server_url' => Yii::t('BotManager', 'Server Url'),
            'reports_interval' => Yii::t('BotManager', 'Reports Interval'),
            'bot_path' => Yii::t('BotManager', 'Path to extension'),
            'max' => Yii::t('BotManager', 'Max drives checking'),
            'multiloginapp_login' => Yii::t('BotManager', 'Multiloginapp login'),
            'multiloginapp_password' => Yii::t('BotManager', 'Multiloginapp password'),
            //
            'websocket_url' => Yii::t('BotManager', 'Websocket Url'),
            'test_mode_on' => Yii::t('BotManager', 'Test Mode On'),
            'test_url' => Yii::t('BotManager', 'Test Url'),
            'extension_id' => Yii::t('BotManager', 'Extension'),
            'default_bk_id' => Yii::t('BotManager', 'Default Bk'),
            'run_into_the_chrome' => Yii::t('BotManager', 'Run into'),
            'software_versions_id' => Yii::t('BotManager', 'Software Version'),
            'active_bks' => Yii::t('BotManager', 'Active BKs'),
            'winline_base_url' => Yii::t('BotManager', 'Base part of Winline URL'),
            //
            'users' => Yii::t('BotManager', 'Users'),
            'http_login' => Yii::t('BotManager', 'BaseAuth Login'),
            'http_password' => Yii::t('BotManager', 'BaseAuth Password'),
            'payment_method' => Yii::t('BotManager', 'Payment Method'),
            'remote_type' => Yii::t('BotManager', 'Remote Type'),
            //
            'anticaptcha_key' => Yii::t('BotManager', 'Anticaptcha Key'),
            'install_anticaptcha' => Yii::t('BotManager', 'Install anticaptcha'),
            //
            'sms_api_url' => Yii::t('BotManager', 'SMS API Url'),
            'sms_api_http_login' => Yii::t('BotManager', 'SMS API bauth login'),
            'sms_api_http_password' => Yii::t('BotManager', 'SMS API bauth password'),
            'email_api_url' => Yii::t('BotManager', 'Email API Url'),
            'email_api_http_login' => Yii::t('BotManager', 'Email API bauth login'),
            'email_api_http_password' => Yii::t('BotManager', 'Email API bauth password'),
            'screenshot_api_url' => Yii::t('BotManager', 'Screenshot API Url'),
            'screenshot_api_http_login' => Yii::t('BotManager', 'Screenshot API bauth login'),
            'screenshot_api_http_password' => Yii::t('BotManager', 'Screenshot API bauth password'),
            //
            'forks_reload_interval' => Yii::t('BotManager', 'Forks Reload Interval'),
            'allow_server_change' => Yii::t('BotManager', 'Enable WM Server editing'),
            //
            'double_enabled_by_default' => Yii::t('BotManager', 'WS2 Enabled'),
            'double_default_url' => Yii::t('BotManager', 'WS2 url'),
            'double_use_main_uid' => Yii::t('BotManager', 'Use main UID'),
        ];
    }

    public function loadData($returnDefaults = false)
    {
        $filename = dirname(__FILE__). '/../../../files/settings.php';
        $defaults = $this->getDefaults();
        $checks = ['forks_reload_interval', 'double_enabled_by_default', 'double_default_url', 'double_use_main_uid',
            'only_existing_wallets', 'max_amount', 'withdraw_interval', 'default_pay_system', 'default_currency',
            'default_browser', 'gaz', 'gaz_price', 'bnb_for_transaction',];
        if (!file_exists($filename) || $returnDefaults) {
            // Hint: default values for new installation
            $data = $defaults;
        } else {
            $data = require $filename;
            foreach ($checks as $check) {
                if (empty($data[$check])) {
                    $data[$check] = $defaults[$check];
                }
            }
            //$data['sms_api_url'] = $data['sms_api_url'] ?: 'http://otrs.ml/sims-manager/api';
            //$data['sms_api_http_login'] = $data['sms_api_http_login'] ?: 'sammy';
            //$data['sms_api_http_password'] = $data['sms_api_http_password'] ?: '1020304050';
        }
        if (empty($returnDefaults)) {
            $this->setAttributes($data);
            return $data;
        } else {
            return $defaults;
        }
    }

    public function save()
    {
        if ($this->validate()) {
            return (bool)file_put_contents(Yii::getAlias(Yii::$app->controller->module->files_dir_alias) . 'settings.php',
                "<?php\r\nreturn " . VarDumper::export($this->getAttributes()) . ";\r\n");
        } else {
            return false;
        }
    }

    private function getDefaults()
    {
        $soft = SoftwareVersions::find()->orderBy(['code' => SORT_DESC])->limit(1)->one();
        $extension = FileGroups::find()->where(['type' => 0])->limit(1)->one();
        $bks = ArrayHelper::map(FileGroups::findAll(['type' => 1]), 'id', 'id');
        return [
            'gaz' => 45000,
            'gaz_price' => 6,
            'bnb_for_transaction' => 0.00055,
            'bnb_source_wallet_id' => '',
            'withdrawal_address' => '',
            'proxy_api_key' => '',
            'luminati_api_key' => '',
            'betexy_login' => '',
            'betexy_password' => '',
            'only_existing_wallets' => '0',
            'max_amount' => '20',
            'withdraw_interval' => '24',
            'default_pay_system' => Paysystems::getMaxId(),
            'default_currency' => 4,
            'default_browser' => 'multilogin',
            'server_url' => Url::base('http') . Url::toRoute(['/BotManager/api']) . '/#SLUG#',
            'reports_interval' => '30000',
            'bot_path' => 'C:\Users\#CURRENT_USER#\Desktop',
            'max' => '1',
            'multiloginapp_login' => '',
            'multiloginapp_password' => '',
            'websocket_url' => 'ws://95.213.229.240/server:80',
            'test_mode_on' => '0',
            'test_url' => 'http://unioffers.ru/b/',
            'extension_id' => !empty($extension) ? $extension->id : '',
            'default_bk_id' => !empty($bks) ? array_values($bks)[0] : '',
            'run_into_the_chrome' => '0',
            'software_versions_id' => $soft ? $soft->id : '',
            'active_bks' => $bks,
            'winline_url' => 'winlinebk3',
            'users' => [],
            'http_login' => '',
            'http_password' => '',
            'payment_method' => 0,
            'remote_type' => 0,
            'anticaptcha_key' => '',
            'install_anticaptcha' => 0,
            'sms_api_url' => 'http://otrs.ml/sims-manager/api',
            'sms_api_http_login' => 'sammy',
            'sms_api_http_password' => '1020304050',
            'ps_api_url' => 'http://otrs.ml/sims-manager/api',
            'ps_api_http_login' => 'sammy',
            'ps_api_http_password' => '1020304050',
            'email_api_url' => 'http://otrs.ml/sims-manager/api',
            'email_api_http_login' => 'sammy',
            'email_api_http_password' => '1020304050',
            'screenshot_api_url' => 'http://otrs.ml/emails/api',
            'screenshot_api_http_login' => 'sammy',
            'screenshot_api_http_password' => '1020304050',
            'forks_reload_interval' => '3000',
            'allow_server_change' => 0,
            'double_enabled_by_default' => false,
            'double_default_url' => 'http://ws.gamb.fun',
            'double_use_main_uid' => true,
        ];
    }

}
