<?php

namespace app\modules\BotManager\models;

use Yii;

/**
 * This is the model class for table "bm_bots_bks".
 *
 * @property int $id
 * @property int $bots_id
 * @property int $bk_id
 * @property string $login
 * @property string $password
 * @property string $url
 * @property string $comment
 *
 * @property string $urls
 * @property string $email
 * @property string $email_password
 * @property string $second_name
 * @property string $betexy_bot_id
 * @property array $buyer
 * @property array $stake_forks
 * @property array $register
 * @property array $bet365
 *
 * @property Bots $bots
 * @property FileGroups $bk
 */
class BotsBks extends \yii\db\ActiveRecord
{

    public $urls = '';
    public $email = '';
    public $email_password = '';
    public $second_name = '';
    public $betexy_bot_id = '';
    public $fork = [];
    public $buyer = [];
    public $stake_forks = [];
    public $register = [];
    public $bet365 = [];

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'bm_bots_bks';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['bots_id', 'bk_id'], 'required'],
            [['bots_id', 'bk_id'], 'integer'],
            [['comment'], 'string'],
            [['login', 'password', 'url'], 'string', 'max' => 255],
            [['bots_id'], 'exist', 'skipOnError' => true, 'targetClass' => Bots::class, 'targetAttribute' => ['bots_id' => 'id']],
            [['bk_id'], 'exist', 'skipOnError' => true, 'targetClass' => FileGroups::class, 'targetAttribute' => ['bk_id' => 'id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id_bot' => Yii::t('BotManager', 'Id Bot'),
            'bots_id' => Yii::t('BotManager', 'Bots ID'),
            'bk_id' => Yii::t('BotManager', 'Bk ID'),
            'login' => Yii::t('BotManager', 'Login'),
            'password' => Yii::t('BotManager', 'Password'),
            'url' => Yii::t('BotManager', 'Phone'),
            'comment' => Yii::t('BotManager', 'Comment'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getBots()
    {
        return $this->hasOne(Bots::class, ['id' => 'bots_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getBk()
    {
        return $this->hasOne(FileGroups::class, ['id' => 'bk_id']);
    }
}
