<?php

namespace app\modules\SimsManager\models;

use Yii;
use yii\helpers\ArrayHelper;
use yii\helpers\VarDumper;

/**
 * This is the model class for table "{{%sims_channels}}".
 *
 * @property int $id
 * @property int $channel_id
 * @property int $goip_sms_id
 * @property string $comment
 * @property int $only_manual
 *
 * @property Sims $sim
 * @property Sims[] $sims
 * @property SimsSlots $simsSlots
 * @property Slots $slot
 * @property Slots[] $slots
 * @property SlotsChannels[] $slotsChannels
 */
class Channels extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%sims_channels}}';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['channel_id'], 'required'],
            [['channel_id', 'goip_sms_id', 'only_manual'], 'integer'],
            [['comment'], 'string'],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('SimsManager', 'ID'),
            'channel_id' => Yii::t('SimsManager', 'Channel ID'),
            'goip_sms_id' => Yii::t('SimsManager', 'GOIP SMS ID'),
            'comment' => Yii::t('SimsManager', 'Comment'),
            'only_manual' => Yii::t('SimsManager', 'Manual binding only'),
            'slot.slot_id' => Yii::t('SimsManager', 'Slot'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSlotsChannels()
    {
        return $this->hasMany(SlotsChannels::class, ['sims_channels_id' => 'id'])->where(['deleted' => 0]);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSlots()
    {
        return $this->hasMany(Slots::class, ['id' => 'sims_slots_id'])->viaTable('{{%sims_slots_channels}}',
            ['sims_channels_id' => 'id'], function (yii\db\ActiveQuery $query) {
                return $query->onCondition(['sims_slots_channels.deleted' => 0]);
            });
    }

    public function getSlot()
    {
        return empty($this->slotsChannels) ? null : $this->slotsChannels[0]->slot;
    }

    public function getSimsSlots()
    {
        return empty($this->slot) ? null : SimsSlots::find()->where(['deleted' => 0, 'sims_slots_id' => $this->slot->id])->one();
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSims()
    {
        return $this->hasMany(Sims::class, ['id' => 'sims_sims_id'])->via('slots')
            ->viaTable('{{%sims_sims_slots}}', ['sims_slots_id' => 'id'], function (yii\db\ActiveQuery $query) {
                return $query->onCondition(['sims_sims_slots.deleted' => 0]);
            });
    }

    public function getSim()
    {
        return empty($this->simsSlots) ? null : $this->simsSlots->sim;
    }

    /**
     * @return Channels[]
     */
    public static function getFreeChannels()
    {
        $freeChannels = Channels::find()
            ->where(['and',
                ['only_manual' => false],
                ['not in', 'id', ArrayHelper::map(Actions::findAll(['active' => true]), 'sims_channels_id', 'sims_channels_id')]
            ])
            ->orderBy(['channel_id' => SORT_DESC])
            ->all();
        return empty($freeChannels) ? [] : $freeChannels;
    }

    /**
     * Check SIM is bound by hand
     * @param Sims $sim
     * @return bool
     */
    public static function checkSimIsBound(Sims $sim)
    {
        return (int)SlotsChannels::find()
                ->where(['deleted' => 0, 'sims_slots_id' => $sim->slot->id])
                ->andWhere(['in', 'sims_channels_id', ArrayHelper::map(Channels::findAll(['only_manual' => true]), 'id', 'id')])
                ->count() > 0;
    }

}
