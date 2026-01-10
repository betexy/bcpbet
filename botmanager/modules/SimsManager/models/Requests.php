<?php

namespace app\modules\SimsManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;
use app\modules\BotManager\models\Bots;

/**
 * This is the model class for table "{{%sims_requests}}".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property string $websocket_uid
 * @property int $bm_bots_id
 * @property string $command
 * @property string $request
 * @property string $response
 *
 * @property Bots $bots
 * @property Actions[] $actions
 * @property Answers[] $answers
 */
class Requests extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%sims_requests}}';
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
            [['websocket_uid', 'bm_bots_id', 'command'], 'required'],
            [['created_at', 'updated_at', 'bm_bots_id'], 'integer'],
            [['request', 'response'], 'string'],
            [['websocket_uid', 'command'], 'string', 'max' => 40],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('SimsManager', 'ID'),
            'created_at' => Yii::t('SimsManager', 'Created At'),
            'updated_at' => Yii::t('SimsManager', 'Updated At'),
            'websocket_uid' => Yii::t('SimsManager', 'Websocket Uid'),
            'bm_bots_id' => Yii::t('SimsManager', 'Bm Bots ID'),
            'command' => Yii::t('SimsManager', 'Command'),
            'request' => Yii::t('SimsManager', 'Request'),
            'response' => Yii::t('SimsManager', 'Response'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getActions()
    {
        return $this->hasMany(Actions::class, ['sims_requests_id' => 'id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getAnswers()
    {
        return $this->hasMany(Answers::class, ['sims_requests_id' => 'id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getBots()
    {
        return $this->hasOne(Bots::class, ['id' => 'bm_bots_id']);
    }

}
