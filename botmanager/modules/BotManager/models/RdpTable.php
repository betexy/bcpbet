<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "rdp_table".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property string $ip
 * @property int $deleted
 * @property string $name
 * @property string $guacamole_link
 * @property string $yc_id
 * @property int $yc_account
 * @property int $last_yc_reboot
 * @property int $last_yc_reboot_attempt
 * @property string|null $comment
 *
 * @property RdpActivity $activity
 */
class RdpTable extends \yii\db\ActiveRecord
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
        return 'rdp_table';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['ip', 'name'], 'required'],
            [
                ['created_at', 'updated_at', 'deleted', 'last_yc_reboot', 'last_yc_reboot_attempt', 'yc_account'],
                'integer'
            ],
            [['comment'], 'string'],
            [['ip'], 'string', 'max' => 15],
            [['name'], 'string', 'max' => 255],
            [['guacamole_link'], 'string', 'max' => 500],
            [['yc_id'], 'string', 'max' => 255],
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
            'ip' => Yii::t('BotManager', 'Ip'),
            'deleted' => Yii::t('BotManager', 'Deleted'),
            'name' => Yii::t('BotManager', 'Name'),
            'guacamole_link' => Yii::t('BotManager', 'Guacamole link'),
            'yc_id' => Yii::t('BotManager', 'YaCloud ID'),
            'yc_account' => Yii::t('BotManager', 'YC account'),
            'last_yc_reboot' => Yii::t('BotManager', 'YC reboot'),
            'last_yc_reboot_attempt' => Yii::t('BotManager', 'Last YC reboot attempt'),
            'comment' => Yii::t('BotManager', 'Comment'),
        ];
    }

    public function getActivity() {
        return $this->hasOne(RdpActivity::class, ['ip' => 'ip']);
    }

}
