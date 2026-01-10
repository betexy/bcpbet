<?php

namespace app\modules\SimsManager\models;

use Yii;

/**
 * This is the model class for table "{{%sims_slots}}".
 *
 * @property int $id
 * @property int $slot_id
 * @property string $comment
 *
 * @property Sims $sim
 * @property Sims[] $sims
 * @property SimsSlots $simSlots
 * @property SlotsChannels $slotsChannels
 */
class Slots extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%sims_slots}}';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['slot_id'], 'required'],
            [['slot_id'], 'integer'],
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
            'slot_id' => Yii::t('SimsManager', 'Slot ID'),
            'comment' => Yii::t('SimsManager', 'Comment'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSlotsChannels()
    {
        return $this->hasMany(SlotsChannels::class, ['sims_slots_id' => 'id'])->where(['deleted' => 0]);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSimsSlots()
    {
        return $this->hasMany(SimsSlots::class, ['sims_slots_id' => 'id'])->where(['deleted' => 0]);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSims()
    {
        return $this->hasMany(Sims::class, ['id' => 'sims_sims_id'])->viaTable('{{%sims_sims_slots}}',
            ['sims_slots_id' => 'id'], function (yii\db\ActiveQuery $query) {
                return $query->onCondition(['deleted' => 0]);
            });
    }

    public function getSim()
    {
        return empty($this->simsSlots) ? null : $this->simsSlots[0]->sim;
    }

}
