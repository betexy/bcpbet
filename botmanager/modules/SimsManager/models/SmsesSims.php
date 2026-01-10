<?php

namespace app\modules\SimsManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "{{%sims_smses_sims}}".
 *
 * @property int $id
 * @property int $deleted
 * @property int $created_at
 * @property int $updated_at
 * @property int $sims_smses_id
 * @property int $sims_sims_id
 *
 * @property Sims $sims
 * @property Smses $smses
 */
class SmsesSims extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%sims_smses_sims}}';
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
            [['deleted', 'created_at', 'updated_at', 'sims_smses_id', 'sims_sims_id'], 'integer'],
            [['sims_smses_id', 'sims_sims_id'], 'required'],
            [['sims_sims_id'], 'exist', 'skipOnError' => true, 'targetClass' => Sims::class, 'targetAttribute' => ['sims_sims_id' => 'id']],
            [['sims_smses_id'], 'exist', 'skipOnError' => true, 'targetClass' => Smses::class, 'targetAttribute' => ['sims_smses_id' => 'id']],
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
            'sims_smses_id' => Yii::t('SimsManager', 'Smses ID'),
            'sims_sims_id' => Yii::t('SimsManager', 'Sims ID'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSims()
    {
        return $this->hasOne(Sims::class, ['id' => 'sims_sims_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSmses()
    {
        return $this->hasOne(Smses::class, ['id' => 'sims_smses_id']);
    }
}
