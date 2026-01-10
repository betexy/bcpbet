<?php

namespace app\modules\BotManager\models;

use app\modules\BotManager\Helpers\ProxyHelper;
use app\modules\Emails\models\Mailboxes;
use app\modules\PaySystems\models\Wallets;
use Yii;
use yii\behaviors\TimestampBehavior;
use yii\db\Exception;

/**
 * This is the model class for table "stake_accounts".
 *
 * @property int $id
 * @property int $betexy_id
 * @property int $deleted
 * @property string $name
 * @property int|null $mailboxes_id
 * @property int|null $proxies_id
 * @property string|null $register
 * @property string|null $register_filling
 * @property string|null $configs_stakes
 * @property string|null $browser
 * @property string|null $profile
 * @property string|null $login
 * @property string|null $password
 * @property string|null $comment
 * @property int $registered_at
 * @property int $last_start_at
 * @property int $created_at
 * @property int $updated_at
 *
 * @property Mailboxes $mailbox
 * @property Proxies $proxy
 * @property Wallets $wallet
 */
class StakeAccounts extends \yii\db\ActiveRecord
{

    public static $browsers = [
        "multilogin" => "Multilogin",
        "betstorm" => "BetStorm",
        "gologin" => "GoLogin",
        "dolphin" => "Dolphin Anty",
        "incogniton" => "Incogniton",
    ];

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'stake_accounts';
    }

    /**
     * @inheritdoc
     */
    public function behaviors()
    {
        return [
            TimestampBehavior::class,
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['deleted', 'mailboxes_id', 'registered_at', 'last_start_at', 'created_at', 'updated_at',
                'betexy_id',], 'integer'],
            [['name',], 'required'],
            [['profile', 'login', 'password', 'comment'], 'string'],
            [['name', 'register', 'register_filling', 'configs_stakes', 'browser',], 'string', 'max' => 255],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('BotManager', 'ID'),
            'betexy_id' => Yii::t('BotManager', 'Betexy ID'),
            'wallet' => Yii::t('BotManager', 'Wallet'),
            'deleted' => Yii::t('BotManager', 'Deleted'),
            'name' => Yii::t('BotManager', 'Name'),
            'mailboxes_id' => Yii::t('BotManager', 'Mailboxes ID'),
            'register' => Yii::t('BotManager', 'Register'),
            'register_filling' => Yii::t('BotManager', 'Fill up balance'),
            'configs_stakes' => Yii::t('BotManager', 'Configs Stakes'),
            'browser' => Yii::t('BotManager', 'Browser'),
            'profile' => Yii::t('BotManager', 'Profile'),
            'login' => Yii::t('BotManager', 'Login'),
            'password' => Yii::t('BotManager', 'Password'),
            'comment' => Yii::t('BotManager', 'Comment'),
            'registered_at' => Yii::t('BotManager', 'Registered at'),
            'last_start_at' => Yii::t('BotManager', 'Last start at'),
            'created_at' => Yii::t('BotManager', 'Created at'),
            'updated_at' => Yii::t('BotManager', 'Updated at'),
        ];
    }

    public function delete()
    {
        $this->deleted = 1;
        $this->save();
    }

    public function getMailbox(): \yii\db\ActiveQuery
    {
        return $this->hasOne(Mailboxes::class, ['id' => 'mailboxes_id']);
    }

    public function getProxy(): \yii\db\ActiveQuery
    {
        return $this->hasOne(Proxies::class, ['id' => 'proxies_id']);
    }

    public function getWallet(): \yii\db\ActiveQuery
    {
        return $this->hasOne(Wallets::class, ['login' => 'login']);
    }

    /**
     * @throws Exception
     */
    public function getRegister(): array
    {
        $register = explode(';', $this->register);
        return [
            'email' => $register[0],
            'login' => $register[1],
            'password' => $register[2],
            'birthdate' => $register[3],
            'name' => $register[4],
            'last_name' => $register[5],
            'country' => ProxyHelper::get()->getCountryCode($register[6]),
            'address' => $register[7],
            'city' => $register[8],
            'zip' => $register[9],
            'job' => $register[10],
        ];
    }

    /**
     * @throws Exception
     */
    public function changeEmail(Mailboxes $mailbox)
    {
        if (!empty($this->mailbox) && !empty($this->register)
            && strpos($this->register, $this->mailbox->address) !== false) {
            $current_email = $this->mailbox->address;
            $this->register = str_replace($current_email, $mailbox->address, $this->register);
        }
        $this->mailboxes_id = $mailbox->id;
        if (!$this->save()) {
            throw new Exception('Error save change email: '
                . var_export($this->getErrors(), true));
        }
    }

}
