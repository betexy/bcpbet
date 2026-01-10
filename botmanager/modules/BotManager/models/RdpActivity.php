<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "rdp_activity".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property string $ip
 * @property int $deleted
 * @property RdpTable $table
 * @property int $last_activity
 * @property int $last_login
 * @property int $logins_failed
 * @property string|null $comment
 */
class RdpActivity extends \yii\db\ActiveRecord
{

    public $name;


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
    public static function tableName()
    {
        return 'rdp_activity';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['ip', 'last_activity'], 'required'],
            [['created_at', 'updated_at', 'last_activity', 'deleted', 'last_login', 'logins_failed'], 'integer'],
            [['comment'], 'string'],
            [['ip'], 'string', 'max' => 15],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('BotManager', 'ID'),
            'created_at' => Yii::t('BotManager', 'Created At'),
            'updated_at' => Yii::t('BotManager', 'Updated At'),
            'ip' => Yii::t('BotManager', 'IP'),
            'deleted' => Yii::t('BotManager', 'Deleted'),
            'name' => Yii::t('BotManager', 'Name'),
            'last_activity' => Yii::t('BotManager', 'Last Activity'),
            'last_login' => Yii::t('BotManager', 'Last Login'),
            'logins_failed' => Yii::t('BotManager', 'Fails'),
            'comment' => Yii::t('BotManager', 'Comment'),
        ];
    }

    public function getTable() {
        return $this->hasOne(RdpTable::class, ['ip' => 'ip']);
    }
}
