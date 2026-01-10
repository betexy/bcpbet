<?php

namespace app\modules\BotManager\models;

use Yii;

/**
 * This is the model class for table "configs_configs".
 *
 * @property int $id
 * @property int $parent_id
 * @property int $child_id
 *
 * @property Configs $child
 * @property Configs $parent
 */
class ConfigsConfigs extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'configs_configs';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['parent_id', 'child_id'], 'required'],
            [['parent_id', 'child_id'], 'integer'],
            [['child_id'], 'exist', 'skipOnError' => true, 'targetClass' => Configs::class, 'targetAttribute' => ['child_id' => 'id']],
            [['parent_id'], 'exist', 'skipOnError' => true, 'targetClass' => Configs::class, 'targetAttribute' => ['parent_id' => 'id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('BotManager', 'ID'),
            'parent_id' => Yii::t('BotManager', 'Parent ID'),
            'child_id' => Yii::t('BotManager', 'Child ID'),
        ];
    }

    /**
     * Gets query for [[Child]].
     *
     * @return \yii\db\ActiveQuery
     */
    public function getChild()
    {
        return $this->hasOne(Configs::class, ['id' => 'child_id']);
    }

    /**
     * Gets query for [[Parent]].
     *
     * @return \yii\db\ActiveQuery
     */
    public function getParent()
    {
        return $this->hasOne(Configs::class, ['id' => 'parent_id']);
    }
}
