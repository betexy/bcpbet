<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "ps_codes".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property string $account_id
 * @property string $code
 */
class PsCodes extends \yii\db\ActiveRecord
{

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
    public static function tableName()
    {
        return 'ps_codes';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['account_id', 'code'], 'required'],
            [['created_at', 'updated_at'], 'integer'],
            [['account_id', 'code'], 'string', 'max' => 255],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('BotManager', 'ID'),
            'created_at' => Yii::t('BotManager', 'Created At'),
            'updated_at' => Yii::t('BotManager', 'Updated At'),
            'account_id' => Yii::t('BotManager', 'Account ID'),
            'code' => Yii::t('BotManager', 'Used Code'),
        ];
    }
}
