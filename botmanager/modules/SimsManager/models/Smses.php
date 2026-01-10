<?php

namespace app\modules\SimsManager\models;

use Yii;

/**
 * This is the model class for table "{{%sims_smses}}".
 *
 * @property int $id
 * @property int $receive_id
 * @property string $number
 * @property string $scrum
 * @property int $provid
 * @property string $msg
 * @property string $time_received
 * @property string $goip_name
 * @property int $sims_channels_id
 * @property int $status
 * @property string $smscnum
 * @property string $senttime
 * @property string $comment
 *
 * @property Channels $channels
 * @property SmsesSims[] $smsesSims
 * @property Sims $sim
 */
class Smses extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%sims_smses}}';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['receive_id'], 'required'],
            [['receive_id', 'provid', 'sims_channels_id', 'status'], 'integer'],
            [['msg', 'comment'], 'string'],
            [['time_received', 'senttime'], 'safe'],
            [['number'], 'string', 'max' => 20],
            [['scrum', 'goip_name', 'smscnum'], 'string', 'max' => 30],
            [['sims_channels_id'], 'exist', 'skipOnError' => true, 'targetClass' => Channels::class, 'targetAttribute' => ['sims_channels_id' => 'id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('SimsManager', 'ID'),
            'receive_id' => Yii::t('SimsManager', 'Ext. ID'),
            'number' => Yii::t('SimsManager', 'Number'),
            'scrum' => Yii::t('SimsManager', 'Sender'),
            'provid' => Yii::t('SimsManager', 'Provid'),
            'msg' => Yii::t('SimsManager', 'Msg'),
            'time_received' => Yii::t('SimsManager', 'Received'),
            'goip_name' => Yii::t('SimsManager', 'Goip Name'),
            'sims_channels_id' => Yii::t('SimsManager', 'Sims Channels ID'),
            'status' => Yii::t('SimsManager', 'Status'),
            'smscnum' => Yii::t('SimsManager', 'Smscnum'),
            'senttime' => Yii::t('SimsManager', 'Senttime'),
            'comment' => Yii::t('SimsManager', 'Comment'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getChannels()
    {
        return $this->hasOne(Channels::class, ['id' => 'sims_channels_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSmsesSims()
    {
        return $this->hasMany(SmsesSims::class, ['sims_smses_id' => 'id'])->where(['deleted' => 0]);
    }

    public function getSim()
    {
        return empty($this->smsesSims) ? null : $this->smsesSims[0]->sims;
    }
}
