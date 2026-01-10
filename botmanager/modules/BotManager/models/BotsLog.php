<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;
use yii\db\ActiveRecord;

/**
 * This is the model class for table "bm_bots_log".
 *
 * @property int $id
 * @property int $bots_id
 * @property string $bk_internal
 * @property int $created_at
 * @property string $message_string
 * @property array $message_json
 *
 * @property Bots $bots
 */
class BotsLog extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'bm_bots_log';
    }

    /**
     * @inheritdoc
     */
    public function behaviors()
    {
        return [
            TimestampBehavior::class,
            'attributes' => [
                ActiveRecord::EVENT_BEFORE_INSERT => ['created_at'],
            ],
        ];
    }


    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['bots_id', 'bk_internal',], 'required'],
            [['bots_id', 'created_at'], 'integer'],
            [['message_string'], 'string'],
            [['message_json'], 'safe'],
            [['bk_internal'], 'string', 'max' => 255],
            [['bots_id'], 'exist', 'skipOnError' => true, 'targetClass' => Bots::class, 'targetAttribute' => ['bots_id' => 'id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('BotManager', 'ID'),
            'bots_id' => Yii::t('BotManager', 'Bots ID'),
            'bk_internal' => Yii::t('BotManager', 'Bk Internal'),
            'created_at' => Yii::t('BotManager', 'Created At'),
            'message_string' => Yii::t('BotManager', 'Message String'),
            'message_json' => Yii::t('BotManager', 'Message Json'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getBots()
    {
        return $this->hasOne(Bots::class, ['id' => 'bots_id']);
    }
}
