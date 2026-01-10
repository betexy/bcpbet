<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "{{%bm_server_ip}}".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property string $ip
 * @property int $bm_server_id
 *
 * @property Server $server
 */
class ServerIp extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%bm_server_ip}}';
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
            [['ip'], 'required'],
            [['created_at', 'updated_at', 'bm_server_id'], 'integer'],
            [['ip'], 'string', 'max' => 40],
            [['bm_server_id'], 'exist', 'skipOnError' => true, 'targetClass' => Server::class, 'targetAttribute' => ['bm_server_id' => 'id']],
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
            'bm_server_id' => Yii::t('BotManager', 'Server'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getServer()
    {
        return $this->hasOne(Server::class, ['id' => 'bm_server_id']);
    }
}
