<?php

namespace app\modules\BotManager\models;

use app\modules\BotManager\Helpers\BotsHelper;
use app\modules\PaySystems\models\PaysystemsBots;
use Yii;
use yii\base\Exception;
use yii\base\InvalidConfigException;
use yii\db\ActiveQuery;
use yii\helpers\ArrayHelper;
use yii\helpers\Html;
use yii\helpers\VarDumper;
use yii\log\Logger;

/**
 * This is the model class for table "bm_bots".
 *
 * @property int $id
 * @property string $virtual_machine_uid
 * @property string $virtual_machine_name
 * @property string $websocket_url
 * @property string $websocket_uid
 * @property int $test_mode_on
 * @property string $test_url
 * @property int $extension_id
 * @property int $default_bk_id
 * @property string $multilogin_profile_name
 * @property int $last_request
 * @property string $last_status
 * @property int $run_into_the_chrome
 * @property int $multilogin_installed
 * @property int $chrome_installed
 * @property int $extension_installed
 * @property string $software_versions_id
 * @property string $comment
 * @property int[] $bm_bk_select
 * @property string $description
 *
 * @property int $user_id
 * @property int $payment_method
 * @property string $payment_login
 * @property string $payment_password
 * @property int $remote_type
 * @property string $remote_login
 * @property string $remote_password
 * @property boolean $remote_installed
 * @property integer $multilogin_port_number
 * @property string $server_name
 * @property int $install_anticaptcha
 *
 * @property string $logic_name
 * @property string $readableName
 *
 * @property string $comment_vpn
 * @property string $comment_proxy
 * @property string $comment_multilogin
 * @property string $guacamole_link
 * @property string $textComment
 * @property string $guacamoleIcon
 * @property int $bm_server_id
 *
 * @property int $double_enabled
 * @property string $double_url
 * @property string $double_uid
 *
 * @property int[] $bmBkSelect
 *
 * @property BotsQueue[] $queue
 * @property FileGroups $defaultBk
 * @property FileGroups $extension
 * @property FileGroups[] $botsBks
 * @property BotsBks[] $botsBksLink
 * @property SoftwareVersions $softwareVersion
 * @property BkSettings[] $bkSettings
 * @property PaysystemsBots[] $paysystemsBots
 * @property Server $server
 *
 * @property boolean $thisIsTemp;
 * @property string[] $tempParams
 * @property boolean $use_chrome
 * @property boolean $restart
 * @property boolean $experimental
 * @property array $buyer
 * @property array $stake_forks
 * @property array $register
 * @property array $bet365
 */
class Bots extends \yii\db\ActiveRecord
{

    public $thisIsTemp = false;
    public $tempParams = [];
    public $use_chrome = false;
    public $restart = false;
    public $experimental = false;
    public $end = 0;
    public $buyer;
    public $stake_forks;
    public $register;
    public $bet365;

    public $bm_bk_select = [];

    public static $paymentMethods = [
        0 => 'Not specified',
        5 => 'Binance API',
        1 => 'QIWI',
        2 => 'Skrill',
        3 => 'Blockchain.info',
        4 => 'Neteller',
    ];

    public static $remoteTypes = [
        0 => 'Not specified',
        1 => 'Team Viewer',
    ];

    public static $logicNames = [
        'logic' => 'Value',
        'logic_forks' => 'Forks',
    ];

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'bm_bots';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['virtual_machine_name', 'virtual_machine_uid', 'extension_id', 'software_versions_id'], 'required'],
            [['test_mode_on', 'extension_id', 'default_bk_id', 'last_request', 'run_into_the_chrome', 'multilogin_installed',
                'chrome_installed', 'extension_installed', 'software_versions_id', 'user_id', 'payment_method', 'remote_type',
                'remote_installed', 'multilogin_port_number', 'install_anticaptcha', 'bm_server_id',
                'double_enabled'], 'integer'],
            [['comment'], 'string'],
            [['virtual_machine_uid', 'virtual_machine_name', 'websocket_url', 'websocket_uid', 'test_url',
                'multilogin_profile_name', 'last_status', 'payment_login', 'payment_password', 'remote_login',
                'remote_password', 'server_name', 'logic_name', 'comment_vpn', 'comment_proxy', 'comment_multilogin',
                'guacamole_link', 'double_url', 'double_uid'],
                'string', 'max' => 255],
            ['bm_bk_select', function ($attribute, $params) {
                if (!is_array($this->bm_bk_select)) {
                    $this->addError('bm_bk_select', 'Is not array!');
                }
            }],
            [['extension_id'], 'exist', 'skipOnError' => true, 'targetClass' => FileGroups::class, 'targetAttribute' => ['extension_id' => 'id']],
            [['logic_name'], 'default', 'value' => 'logic']
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('BotManager', 'ID'),
            'virtual_machine_uid' => Yii::t('BotManager', 'VM Uid'),
            'virtual_machine_name' => Yii::t('BotManager', 'Virtual Machine Name'),
            'websocket_url' => Yii::t('BotManager', 'WS Url'),
            'websocket_uid' => Yii::t('BotManager', 'WS Uid'),
            'test_mode_on' => Yii::t('BotManager', 'Test Mode On'),
            'test_url' => Yii::t('BotManager', 'Test Url'),
            'extension_id' => Yii::t('BotManager', 'Extension'),
            'default_bk_id' => Yii::t('BotManager', 'Default Bk'),
            'multilogin_profile_name' => Yii::t('BotManager', 'Multilogin Profile Name'),
            'last_request' => Yii::t('BotManager', 'Last Request'),
            'last_status' => Yii::t('BotManager', 'Last Status'),
            'run_into_the_chrome' => Yii::t('BotManager', 'Run into'),
            'software_versions_id' => Yii::t('BotManager', 'Software Version'),
            'multilogin_installed' => Yii::t('BotManager', 'Multilogin installed?'),
            'chrome_installed' => Yii::t('BotManager', 'Chrome installed?'),
            'extension_installed' => Yii::t('BotManager', 'Extension installed?'),
            'comment' => Yii::t('BotManager', 'Comment'),
            'bm_bk_select' => Yii::t('BotManager', 'Active BKs'),
            'bmBkSelect' => Yii::t('BotManager', 'Active BKs'),
            'softwareVersion' => Yii::t('BotManager', 'Version of software'),
            'user_id' => Yii::t('BotManager', 'User ID'),
            'payment_method' => Yii::t('BotManager', 'Payment Method'),
            'payment_login' => Yii::t('BotManager', 'Payment Login'),
            'payment_password' => Yii::t('BotManager', 'Payment Password'),
            'remote_type' => Yii::t('BotManager', 'Remote type'),
            'remote_login' => Yii::t('BotManager', 'Remote login'),
            'remote_password' => Yii::t('BotManager', 'Remote password'),
            'remote_installed' => Yii::t('BotManager', 'Remote installed?'),
            'multilogin_port_number' => Yii::t('BotManager', 'Multilogin Port'),
            'server_name' => Yii::t('BotManager', 'Server Name'),
            'install_anticaptcha' => Yii::t('BotManager', 'Install Anticaptcha Plugin'),
            'comment_vpn' => Yii::t('BotManager', 'VPN'),
            'comment_proxy' => Yii::t('BotManager', 'Proxy'),
            'comment_multilogin' => Yii::t('BotManager', 'Multilogin'),
            'textComment' => Yii::t('BotManager', 'Additional comment'),
            'bm_server_id' => Yii::t('BotManager', "VM's Server"),
            'guacamole_link' => Yii::t('BotManager', "Guacamole link"),
            'guacamoleIcon' => Yii::t('BotManager', "Guacamole link"),
            'double_enabled' => Yii::t('BotManager', "WS2 enabled"),
            'double_url' => Yii::t('BotManager', "WS2 url"),
            'double_uid' => Yii::t('BotManager', "WS2 uid"),
        ];
    }

    /**
     * @return ActiveQuery
     */
    public function getExtension()
    {
        return $this->hasOne(FileGroups::class, ['id' => 'extension_id']);
    }

    public function getServer()
    {
        return $this->hasOne(Server::class, ['id' => 'bm_server_id']);
    }

    public function getGuacamoleIcon()
    {
        return !empty($this->guacamole_link)
            ? Html::a(Html::img(['files/internal-js', 'name' => 'rdp.png']), $this->guacamole_link,
                ['target' => '_blank', 'style' => 'font-weight: bold;'])
            : '';
    }

    /**
     * @return array|ActiveQuery
     * @throws InvalidConfigException
     */
    public function getBotsBks()
    {
        if ($this->thisIsTemp) {
            $result = [];
            foreach ($this->bm_bk_select as $bkId) {
                $bk = FileGroups::findOne($bkId);
                $result[] = $bk;
            }
            return $result;
        } else {
            return $this->hasMany(FileGroups::class, ['id' => 'bk_id'])->viaTable('bm_bots_bks', ['bots_id' => 'id']);
        }
        //return $this->hasMany(BotsBks::class, ['bots_id' => 'id']);
    }

    /**
     * @return array|ActiveQuery
     */
    public function getBotsBksLink()
    {
        if ($this->thisIsTemp) {
            $result = [];
            foreach ($this->bm_bk_select as $bkId) {
                $link = new BotsBks();
                $link->bk_id = $bkId;
                foreach (['login', 'password', 'url', 'email', 'email_password', 'urls', 'second_name', 'betexy_bot_id',
                             'fork', 'buyer', 'stake_forks', 'register', 'bet365', ] as $key) {
                    if (!empty($this->tempParams[$key])) {
                        $link->$key = $this->tempParams[$key];
                    }
                }
                $result[] = $link;
            }
            return $result;
        } else {
            return $this->hasMany(BotsBks::class, ['bots_id' => 'id']);
        }
    }

    /**
     * @return ActiveQuery
     */
    public function getQueue()
    {
        return $this->hasMany(BotsQueue::class, ['bots_id' => 'id'])
            ->where(['status' => 0, ])
            ->orderBy(['created_at' => SORT_ASC]);
    }

    public function getPaysystemsBots()
    {
        return $this->hasMany(PaysystemsBots::class, ['bm_bots_id' => 'id'])->where(['deleted' => 0]);
    }

    public function getBmBkSelect()
    {
        return ArrayHelper::map($this->botsBks, 'id', 'id');
    }

    public function getDefaultBk()
    {
        return FileGroups::findOne($this->default_bk_id);
    }

    public function getSoftwareVersion()
    {
        return SoftwareVersions::findOne($this->software_versions_id);
    }

    public function getReadableName()
    {
        $parts = [$this->virtual_machine_name];
        if (!empty($this->server_name)) {
            $parts[] = "@ {$this->server_name}";
        }
        if (!empty($this->user_id)) {
            $parts[] = "({$this->user_id})";
        }
        $parts[] = " - " . self::$logicNames[$this->logic_name];
        return implode(' ', $parts);
    }

    public function getDescription()
    {
        // extension_installed, run_into_the_chrome, multilogin_installed, chrome_installed
        $result = [
            'extension ' . ($this->extension_installed ? '' : 'NOT ') . 'installed',
            'multilogin ' . ($this->multilogin_installed ? '' : 'NOT ') . 'installed',
            'chrome ' . ($this->chrome_installed ? '' : 'NOT ') . 'installed',
            'run into <strong>' . ($this->run_into_the_chrome ? 'Chrome' : 'Multilogin') . '</strong>',
            "default bk:  " . (empty($this->defaultBk) ? '---' : "<strong>{$this->defaultBk->name}</strong>"),
            "extension: <strong>{$this->extension->name}</strong>",
            "v: <strong>" . (empty($this->softwareVersion) ? '---' : $this->softwareVersion->code) . "</strong>",
            "remote: <strong>" . self::$remoteTypes[$this->remote_type] . "</strong> (" . ($this->remote_installed ? '' : 'NOT ') . "installed)",
            //"payment: <strong>".self::$paymentMethods[$this->payment_method]."</strong>",
        ];
        if (!empty($this->multilogin_profile_name)) {
            $result[] = "multilogin profile: '{$this->multilogin_profile_name}', port: {$this->multilogin_port_number}";
        }
        if ($this->remote_type > 0 && $this->remote_installed) {
            $result[] = "remote {$this->remote_login} / {$this->remote_password}";
        }
        if (!empty($this->install_anticaptcha)) {
            $result[] = '<span style="color: yellow; background-color: gray;">anticaptcha</span>';
        }
        if (!empty($this->textComment)) {
            $result[] = $this->textComment;
        }
        return implode(', ', $result);
    }

    public function getTextComment()
    {
        $res = [];
        foreach (['comment_vpn', 'comment_proxy', 'comment_multilogin'] as $t) {
            if (!empty($this->$t)) {
                $res[] = $this->getAttributeLabel($t) . ': ' . $this->$t;
            }
        }
        return implode(', ', $res);
    }

    public function getBkNameByIndex($idx)
    {
        $names = [];
        if (!empty($this->botsBks)) {
            $t = $this->botsBks;
            !empty($this->defaultBk) ? $names[] = $this->defaultBk->name : null;
            foreach ($t as $bk) {
                $names[] = $bk->name;
            }
            $names = array_values(array_unique($names));
        }
        return empty($names[$idx]) ? null : $names[$idx];
    }

    public function beforeValidate()
    {
        if ($this->isNewRecord && !method_exists($this, 'search')) {
            $this->setDefaults();
        } else if (!method_exists($this, 'search')
            && Yii::$app->request->post('Bots', false) === false) {
            $this->bm_bk_select = $this->bmBkSelect;
        }
        return parent::beforeValidate();
    }

    public function beforeDelete()
    {
        if (!parent::beforeDelete()) {
            return false;
        }
        $allLinks = BotsBks::findAll(['bots_id' => $this->id]);
        foreach ($allLinks as $link) {
            $link->delete();
        }
        $allQueue = BotsQueue::findAll(['bots_id' => $this->id]);
        foreach ($allQueue as $link) {
            $link->delete();
        }
        $allLogs = BotsLog::findAll(['bots_id' => $this->id]);
        foreach ($allLogs as $link) {
            $link->delete();
        }
        $allPs = PaysystemsBots::findAll(['bm_bots_id' => $this->id]);
        foreach ($allPs as $link) {
            $link->delete();
        }
        return true;
    }

    public function setDefaults()
    {
        $defaults = new SettingsForm();
        $defaults->loadData();
        foreach (['websocket_url', 'test_url', 'extension_id', 'software_versions_id', 'remote_type',
                     'run_into_the_chrome', 'test_mode_on', 'default_bk_id', 'install_anticaptcha'] as $default) {
            $this->$default = $defaults->$default;
        }
        $this->payment_method = 0;
        $this->multilogin_port_number = 35000;
        $this->bm_bk_select = empty($defaults->active_bks) ? [] : $defaults->active_bks;
        $this->virtual_machine_name = 'Please specify!';
        $this->double_enabled = $defaults->double_enabled_by_default;
        if ($defaults->double_default_url) {
            $this->double_url = $defaults->double_default_url;
        }
    }

    public function afterSave($insert, $changedAttributes)
    {
        parent::afterSave($insert, $changedAttributes);
        // Let's save relations
        $allLinks = BotsBks::findAll(['bots_id' => $this->id]);
        $heresBks = empty($this->bm_bk_select) ? [] : $this->bm_bk_select;
        foreach ($allLinks as $link) {
            if (array_search($link->bk_id, $heresBks) === false) {
                $link->delete();
            }
        }
        $arrayLinks = ArrayHelper::map($allLinks, 'bk_id', 'bk_id');
        foreach ($heresBks as $bk) {
            if (array_search($bk, $arrayLinks) === false) {
                $link = new BotsBks();
                $link->bots_id = $this->id;
                $link->bk_id = $bk;
                $link->login = '';
                $link->password = '';
                if (!$link->save()) {
                    echo "<br />";
                    VarDumper::dump($link->errors);
                }
            }
        }
    }

    public function checkServer($ip)
    {
        $serverIp = ServerIp::findOne(['ip' => $ip]);
        if (empty($serverIp)) {
            $serverIp = new ServerIp();
            $serverIp->ip = $ip;
            if (!$serverIp->save()) {
                Yii::getLogger()->log('Error save serverIp: ' . var_export($serverIp->errors, true), Logger::LEVEL_ERROR, 'Bots');
                return;
            }
        }
        $this->bm_server_id = !empty($serverIp->bm_server_id) ? $serverIp->bm_server_id : null;
    }

    public static function getPaysystemNameClear($paysystem_id)
    {
        return $paysystem_id === 3 ? 'blockchain' : self::$paymentMethods[$paysystem_id];
    }

    /**
     * @throws Exception
     */
    public static function botRequest($params, $user_id, $ip)
    {
        /**
         * @var $model Bots
         */
        if (!($model = Bots::findOne(['virtual_machine_uid' => $params['uid']]))) {
            $model = new Bots();
            $model->virtual_machine_uid = $params['uid'];
            $model->user_id = $user_id;
            $model->websocket_uid = Yii::$app->security->generateRandomString(12);
        }
        if (empty($model->user_id)) {
            $model->user_id = $user_id;
        }
        $model->virtual_machine_name = $params['name'];
        $model->last_request = time();
        $model->last_status = $params['action'];
        if (!empty($ip)) {
            $model->checkServer($ip);
        }
        if (!$model->save()) {
            return ['error' => VarDumper::dumpAsString($model->getErrors())];
        } else {
            if ($model->last_status === 'reply') {
                $queue = BotsQueue::findOne($params['answered']);
                if ($queue && $queue->setAnswer($params)) {
                    // todo: Everything is OK
                } else {
                    // todo: Set error to Bot :)
                }
            }
            return [
                'id' => $model->id,
                'action' => $model->last_status === 'ready' ? BotsHelper::actionForBot($model) : '',
                'version' => $model->softwareVersion->code
            ];
        }
    }
}

