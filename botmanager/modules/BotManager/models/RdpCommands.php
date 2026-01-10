<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;
use yii\helpers\VarDumper;

/**
 * This is the model class for table "rdp_commands".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property int $forced_send
 * @property string ip
 * @property int $sent_at
 * @property int $finished_at
 * @property string|null $command
 * @property string|null $result
 * @property string|null $comment
 */
class RdpCommands extends \yii\db\ActiveRecord
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
        return 'rdp_commands';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            //[['created_at', 'updated_at'], 'required'],
            [['created_at', 'updated_at', 'forced_send', 'sent_at', 'finished_at'], 'integer'],
            [['command', 'result', 'comment', 'ip',], 'string'],
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
            'forced_send' => Yii::t('BotManager', 'Forced send'),
            'ip' => Yii::t('BotManager', 'IP'),
            'sent_at' => Yii::t('BotManager', 'Sent At'),
            'finished_at' => Yii::t('BotManager', 'Finished At'),
            'command' => Yii::t('BotManager', 'Command'),
            'result' => Yii::t('BotManager', 'Result'),
            'comment' => Yii::t('BotManager', 'Comment'),
        ];
    }

    public static function createLoginCommand(RdpActivity $model, $interval = 0)
    {
        $command = new RdpCommands();
        $command->ip = $model->ip;
        $command->command = json_encode(['action' => 'rdp_login', 'server' => $model->table->name,
            'guacamole_link' => $model->table->guacamole_link]);
        if ($interval > 0) {
            $command->forced_send = time() + $interval;
        }
        if (!$command->save()) {
            return 'Command: ' . VarDumper::dumpAsString($command->getErrorSummary(true));
        } else {
            $model->last_login = time();
            if (!$model->save()) {
                return 'Model: ' . VarDumper::dumpAsString($model->getErrorSummary(true));
            } else {
                return true;
            }
        }
    }
}
