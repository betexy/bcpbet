<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;
use yii\helpers\Url;

/**
 * This is the model class for table "rdp_install_queue".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property int $sent_at
 * @property int $finished_at
 * @property string|null $command
 * @property string|null $ssh_result
 * @property boolean $success
 * @property string|null $response
 * @property int $rdp_command_id
 * @property boolean $finished
 * @property string|null $guacamole_link
 * @property string|null $comment
 */
class RdpInstallQueue extends \yii\db\ActiveRecord
{

    public $ip;
    public $root_password;
    public $socket;
    public $name;

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
        return 'rdp_install_queue';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['name', 'socket', 'ip', 'root_password'], 'required'],
            [['created_at', 'updated_at', 'sent_at', 'finished_at', 'rdp_command_id', 'finished', 'success'], 'integer'],
            [['command', 'response', 'comment', 'name', 'socket', 'ip', 'root_password', 'ssh_result',
                'guacamole_link'], 'string'],
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
            'sent_at' => Yii::t('BotManager', 'Sent At'),
            'finished_at' => Yii::t('BotManager', 'Finished At'),
            'command' => Yii::t('BotManager', 'Command'),
            'ssh_result' => Yii::t('BotManager', 'SSH Result'),
            'success' => Yii::t('BotManager', 'Success'),
            'response' => Yii::t('BotManager', 'Response'),
            'comment' => Yii::t('BotManager', 'Comment'),
            'name' => Yii::t('BotManager', 'Name'),
            'socket' => Yii::t('BotManager', 'Socket'),
            'ip' => Yii::t('BotManager', 'IP'),
            'root_password' => Yii::t('BotManager', 'Root Password'),
            'rdp_command_id' => Yii::t('BotManager', 'RDP Command ID'),
            'finished' => Yii::t('BotManager', 'Finished'),
            'guacamole_link' => Yii::t('BotManager', 'Guacamole Link'),
        ];
    }

    public function save($runValidation = true, $attributeNames = null)
    {
        if ($runValidation) {
            $this->command = json_encode([
                'action' => 'install_server',
                'data' => [
                    'ip' => $this->ip,
                    'root_password' => $this->root_password,
                    'name' => $this->name,
                    'socket' => $this->socket,
                    'domain' => str_replace('//', '', Url::base('')),
                ],
            ]);
        }
        return parent::save($runValidation, $attributeNames);
    }
}
