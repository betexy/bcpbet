<?php

namespace app\modules\SimsManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "{{%sims_sims_slots}}".
 *
 * @property int $id
 * @property int $deleted
 * @property int $created_at
 * @property int $updated_at
 * @property int $sims_sims_id
 * @property int $sims_slots_id
 *
 * @property Sims $sim
 * @property Slots $slot
 */
class SimsSlots extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%sims_sims_slots}}';
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
            [['deleted', 'created_at', 'updated_at', 'sims_sims_id', 'sims_slots_id'], 'integer'],
            [['deleted', 'sims_sims_id', 'sims_slots_id'], 'required'],
            [['sims_sims_id'], 'exist', 'skipOnError' => true, 'targetClass' => Sims::class, 'targetAttribute' => ['sims_sims_id' => 'id']],
            [['sims_slots_id'], 'exist', 'skipOnError' => true, 'targetClass' => Slots::class, 'targetAttribute' => ['sims_slots_id' => 'id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('SimsManager', 'ID'),
            'deleted' => Yii::t('SimsManager', 'Deleted'),
            'created_at' => Yii::t('SimsManager', 'Created At'),
            'updated_at' => Yii::t('SimsManager', 'Updated At'),
            'sims_sims_id' => Yii::t('SimsManager', 'Sim ID'),
            'sims_slots_id' => Yii::t('SimsManager', 'Slot ID'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSim()
    {
        return $this->hasOne(Sims::class, ['id' => 'sims_sims_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSlot()
    {
        return $this->hasOne(Slots::class, ['id' => 'sims_slots_id']);
    }
}
