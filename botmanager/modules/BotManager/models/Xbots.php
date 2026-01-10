<?php

namespace app\modules\BotManager\models;

use app\modules\BotManager\Helpers\ProxyHelper;
use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "xbots".
 *
 * @property int $id
 * @property int $betexy_bot_id
 * @property int $betexy_user_id
 * @property string $bookie
 * @property string $name
 * @property string|null $due_date
 * @property int $active
 * @property int $created_at
 * @property int $updated_at
 */
class Xbots extends \yii\db\ActiveRecord
{

    public static $jwtKey = 'CqDs7XpUG9W62vLKbS6xmyXyF6emFYdjxrM6b7MNQYJEgiNDdtZcN8cFBhopLmjv';

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'xbots';
    }


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
            [['created_at', 'updated_at', 'betexy_bot_id', 'betexy_user_id', 'active'], 'integer'],
            [['name', 'bookie'], 'string', 'max' => 255],
            [['due_date'], 'validateDueDate',],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('BotManager', 'ID'),
            'betexy_bot_id' => Yii::t('BotManager', 'Betexy Bot ID'),
            'betexy_user_id' => Yii::t('BotManager', 'Betexy User ID'),
            'name' => Yii::t('BotManager', 'Name'),
            'due_date' => Yii::t('BotManager', 'Due Date'),
            'active' => Yii::t('BotManager', 'Active'),
            'created_at' => Yii::t('BotManager', 'Created At'),
            'updated_at' => Yii::t('BotManager', 'Updated At'),
        ];
    }

    public function validateDueDate($attribute, $params)
    {
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $this->$attribute, $matches)) {
            $this->addError($attribute, 'The date must be in the format YYYY-MM-DD.');
            return;
        }

        // Checking if it's a valid date (e.g., not February 30)
        if (!checkdate($matches[2], $matches[3], $matches[1])) {
            $this->addError($attribute, 'The date is not valid.');
        }
    }

    public static function refreshAll(): bool
    {
        $ids = [];
        $bots = Xbots::find()->all();
        foreach ($bots as $bot) {
            if (empty($bot->betexy_bot_id)) {
                continue;
            }
            $ids[] = $bot->betexy_bot_id;
        }
        $res = ProxyHelper::get()->curlBetexy([
            "action" => "getRoomsInfo",
            'rooms' => $ids,
        ], 'roomsInfo');
        if (empty($res) || !is_array($res)) {
            file_put_contents(__DIR__ . '/../../../runtime/logs/refreshAll.log',
                date('Y-m-d H:i:s') . "\n" . print_r($res, true). "\n", FILE_APPEND);
            return false;
        }
        foreach ($res as $room) {
            $bot = Xbots::findOne(['betexy_bot_id' => $room['id']]);
            if (!empty($bot)) {
                $bot->name = $room['name'];
                $bot->bookie = $room['bookie'];
                $bot->save();
            }
        }
        return true;
    }

    public static function addADay($bookie)
    {
        $bots = Xbots::find()->where(['bookie' => $bookie, 'active' => 1])->all();
        foreach ($bots as $bot) {
            $due = \DateTime::createFromFormat('Y-m-d', $bot->due_date);
            $due->modify('+1 day');
            $bot->due_date = $due->format('Y-m-d');
            $bot->save();
        }
        return true;
    }

}
