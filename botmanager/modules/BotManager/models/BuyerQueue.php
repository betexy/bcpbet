<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "buyer_queue".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property int $sent_at
 * @property int $finished_at
 * @property string|null $command
 * @property int|null $is_live
 * @property int|null $success
 * @property string|null $response
 * @property string|null $comment
 */
class BuyerQueue extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'buyer_queue';
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
            //[['created_at', 'updated_at'], 'required'],
            [['created_at', 'updated_at', 'sent_at', 'finished_at', 'is_live', 'success'], 'integer'],
            [['command', 'response', 'comment'], 'string'],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('app', 'ID'),
            'created_at' => Yii::t('app', 'Created At'),
            'updated_at' => Yii::t('app', 'Updated At'),
            'sent_at' => Yii::t('app', 'Sent At'),
            'finished_at' => Yii::t('app', 'Finished At'),
            'command' => Yii::t('app', 'Command'),
            'is_live' => Yii::t('app', 'Is Live'),
            'success' => Yii::t('app', 'Success'),
            'response' => Yii::t('app', 'Response'),
            'comment' => Yii::t('app', 'Comment'),
        ];
    }
}
