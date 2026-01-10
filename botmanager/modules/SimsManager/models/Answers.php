<?php

namespace app\modules\SimsManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "{{%sims_answers}}".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property int $sent_at
 * @property int $sims_requests_id
 * @property string $command
 * @property string $content
 *
 * @property Requests $requests
 */
class Answers extends \yii\db\ActiveRecord
{

    public static $answers = [
        'BOUND' => 'Sim card bound',
        'SMS' => 'SMS received',
    ];

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%sims_answers}}';
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
            [['sims_requests_id', 'command'], 'required'],
            [['created_at', 'updated_at', 'sent_at', 'sims_requests_id'], 'integer'],
            [['content'], 'string'],
            [['command'], 'string', 'max' => 30],
            [['sims_requests_id'], 'exist', 'skipOnError' => true, 'targetClass' => Requests::class, 'targetAttribute' => ['sims_requests_id' => 'id']],
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
            'sent_at' => Yii::t('SimsManager', 'Sent At'),
            'sims_requests_id' => Yii::t('SimsManager', 'Sims Requests ID'),
            'command' => Yii::t('SimsManager', 'Command'),
            'content' => Yii::t('SimsManager', 'Content'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSimsRequests()
    {
        return $this->hasOne(Requests::class, ['id' => 'sims_requests_id']);
    }
}
