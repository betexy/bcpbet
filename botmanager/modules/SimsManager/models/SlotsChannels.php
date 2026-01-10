<?php

namespace app\modules\SimsManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;
use yii\helpers\VarDumper;

/**
 * This is the model class for table "{{%sims_slots_channels}}".
 *
 * @property int $id
 * @property int $deleted
 * @property int $created_at
 * @property int $updated_at
 * @property int $sims_slots_id
 * @property int $sims_channels_id
 *
 * @property Channels $channel
 * @property Slots $slot
 */
class SlotsChannels extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%sims_slots_channels}}';
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
            [['deleted', 'created_at', 'updated_at', 'sims_slots_id', 'sims_channels_id'], 'integer'],
            [['deleted', 'sims_slots_id', 'sims_channels_id'], 'required'],
            [['sims_channels_id'], 'exist', 'skipOnError' => true, 'targetClass' => Channels::class, 'targetAttribute' => ['sims_channels_id' => 'id']],
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
            'sims_slots_id' => Yii::t('SimsManager', 'Slots ID'),
            'sims_channels_id' => Yii::t('SimsManager', 'Channels ID'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getChannel()
    {
        return $this->hasOne(Channels::class, ['id' => 'sims_channels_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSlot()
    {
        return $this->hasOne(Slots::class, ['id' => 'sims_slots_id']);
    }

    public static function removeLinksForChannel($channel_id)
    {
        $sChs = SlotsChannels::find()->where(['sims_channels_id' => $channel_id, 'deleted' => 0])->all();
        foreach ($sChs as $sCh) {
            $sCh->deleted = 1;
            $sCh->save();
        }
    }

    public static function bindSlotToChannel($slot_id, $channel_id)
    {
        $new = new SlotsChannels();
        $new->sims_slots_id = $slot_id;
        $new->sims_channels_id = $channel_id;
        $new->deleted = 0;
        if (!$new->save()) {
            return VarDumper::dumpAsString($new->errors);
        } else {
            return true;
        }
    }

}
