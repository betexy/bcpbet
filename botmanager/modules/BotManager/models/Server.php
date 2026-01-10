<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;
use yii\db\ActiveRecord;
use yii\helpers\ArrayHelper;

/**
 * This is the model class for table "{{%bm_server}}".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property string $name
 * @property int $resource
 * @property string $comment
 *
 * @property Bots[] $bots
 * @property string[] $ips
 * @property string $ip
 */
class Server extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%bm_server}}';
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
            [['name'], 'required'],
            [['created_at', 'updated_at', 'resource'], 'integer'],
            [['comment'], 'string'],
            [['name'], 'string', 'max' => 255],
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
            'name' => Yii::t('BotManager', 'Name'),
            'ip' => Yii::t('BotManager', 'IP'),
            'ips' => Yii::t('BotManager', 'IPs'),
            'comment' => Yii::t('BotManager', 'Comment'),
            'resource' => Yii::t('BotManager', 'Resource'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getBots()
    {
        return $this->hasMany(Bots::class, ['bm_server_id' => 'id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getIps()
    {
        return $this->hasMany(ServerIp::class, ['bm_server_id' => 'id']);
    }

    /**
     * @return string
     */
    public function getIp()
    {
        return implode(', ', ArrayHelper::map($this->ips, 'id', 'ip'));
    }

}
