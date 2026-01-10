<?php

namespace app\modules\PaySystems\models;

use app\modules\BotManager\models\Bots;
use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "{{%ps_paysystems_bots}}".
 *
 * @property int $id
 * @property int $deleted
 * @property int $created_at
 * @property int $updated_at
 * @property int $ps_paysystems_id
 * @property int $bm_bots_id
 *
 * @property Bots $bots
 * @property Paysystems $paysystems
 */
class PaysystemsBots extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%ps_paysystems_bots}}';
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
            [['deleted', 'created_at', 'updated_at', 'ps_paysystems_id', 'bm_bots_id'], 'integer'],
            [['ps_paysystems_id', 'bm_bots_id'], 'required'],
            [['bm_bots_id'], 'exist', 'skipOnError' => true, 'targetClass' => Bots::class, 'targetAttribute' => ['bm_bots_id' => 'id']],
            [['ps_paysystems_id'], 'exist', 'skipOnError' => true, 'targetClass' => Paysystems::class, 'targetAttribute' => ['ps_paysystems_id' => 'id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('PaySystems', 'ID'),
            'deleted' => Yii::t('PaySystems', 'Deleted'),
            'created_at' => Yii::t('PaySystems', 'Created At'),
            'updated_at' => Yii::t('PaySystems', 'Updated At'),
            'ps_paysystems_id' => Yii::t('PaySystems', 'Ps Paysystems ID'),
            'bm_bots_id' => Yii::t('PaySystems', 'Bm Bots ID'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getBots()
    {
        return $this->hasOne(Bots::class, ['id' => 'bm_bots_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getPaysystems()
    {
        return $this->hasOne(Paysystems::class, ['id' => 'ps_paysystems_id']);
    }
}
