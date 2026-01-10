<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;
use yii\db\Query;
use yii\helpers\VarDumper;

/**
 * This is the model class for table "bm_report".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property int $parsed
 * @property int $parse_error
 * @property string|null $raw
 * @property string|null $remote_ip
 * @property string|null $category
 * @property string|null $action
 * @property string|null $result
 * @property string|null $message
 * @property string|null $room_bk
 * @property string|null $room_uid
 * @property string|null $room_state
 * @property string|null $room_balance
 * @property string|null $data_status
 * @property string|null $data
 * @property string|null $comment
 */
class Report extends \yii\db\ActiveRecord
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
    public function rules()
    {
        return [
            [['created_at', 'updated_at', 'parsed', 'parse_error'], 'integer'],
            [['raw', 'data', 'comment', 'message',], 'string'],
            [['remote_ip'], 'string', 'max' => 20],
            [['category', 'action', 'result', 'room_bk', 'room_uid', 'room_state', 'room_balance', 'data_status'], 'string', 'max' => 50],
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
            'parsed' => Yii::t('BotManager', 'Parsed'),
            'parse_error' => Yii::t('BotManager', 'Parse Error'),
            'raw' => Yii::t('BotManager', 'Raw'),
            'remote_ip' => Yii::t('BotManager', 'Remote Ip'),
            'category' => Yii::t('BotManager', 'Category'),
            'action' => Yii::t('BotManager', 'Action'),
            'result' => Yii::t('BotManager', 'Result'),
            'message' => Yii::t('BotManager', 'Message'),
            'room_bk' => Yii::t('BotManager', 'Bk'),
            'room_uid' => Yii::t('BotManager', 'Uid'),
            'room_state' => Yii::t('BotManager', 'State'),
            'room_balance' => Yii::t('BotManager', 'Balance'),
            'data_status' => Yii::t('BotManager', 'Status'),
            'data' => Yii::t('BotManager', 'Data'),
            'comment' => Yii::t('BotManager', 'Comment'),
        ];
    }

    public function parseAnswer()
    {
        $getData = function ($d) {
            if (isset($d) && gettype($d) === 'string') {
                try {
                    $res = json_decode($d, true);
                } catch (\Exception $e) {
                    $res = $d;
                }
            } else {
                $res = $d ?? '';
            }
            return $res;
        };
        try {
            $jsonAll = json_decode($this->raw, true);
            $json = !isset($jsonAll['statistics']) ? $jsonAll : json_decode($jsonAll['answer'], true);
            $this->action = $json['action'] ?? '';
            $this->result = $json['result'] ?? '';
            $this->message = $json['message'] ?? $json['answer'] ?? '';
            $data = $getData($json['data'] ?? []);
            $this->data = json_encode($data);
            $this->data_status = $data['status'] ?? '';
            if (isset($json['room'])) {
                $this->room_bk = $json['room']['bk'] ?? '';
                $this->room_uid = $json['room']['uid'] ?? '';
                $this->room_state = $json['room']['state'] ?? '';
                $this->room_balance = (string)$json['room']['balance'] ?? '';
            } else {
                $this->room_bk = '';
                $this->room_uid = '';
                $this->room_state = '';
                $this->room_balance = '';
            }
            $this->parsed = 1;
            $this->parse_error = 0;
        } catch (\Exception $e) {
            $this->parsed = 1;
            $this->parse_error = 1;
            $this->comment = "parseAnswer: {$e->getMessage()}";
        }
        return $this;
    }

    public function recognizeCategory()
    {
        if ($this->message === 'Not supported yet :(') {
            $this->category = 'Not Supported';
        } elseif ($this->message === 'Not logged in!') {
            $this->category = 'Not Logged';
        } elseif ($this->data_status === 'LOW_COEF') {
            $this->category = 'Low Coef';
        } elseif ($this->data_status === 'PROFILE_ERROR') {
            $this->category = 'Bet-Storm';
        } elseif ($this->room_state === 'BETS_LIMITED') {
            $this->category = 'Limited';
        } elseif ($this->action === 'BET_RESULT') {
            $this->category = 'Bet Result';
        } elseif ($this->action === 'BAD_REQUEST' && strpos($this->message, 'Bot executing') !== false) {
            $this->category = 'Bot Busy';
        } elseif ($this->action === 'BAD_REQUEST') {
            $this->category = 'Bad Request';
        } elseif (strpos($this->message, 'Bot executing') !== false) {
            $this->category = 'Bot Busy';
        } elseif (strpos($this->message, 'Error downloading extension') !== false) {
            $this->category = 'Start Server';
        } elseif (strpos($this->message, 'Error during preparing extension') !== false) {
            $this->category = 'Start Bot';
        } else if (strpos(mb_strtolower($this->message), 'too big') !== false) {
            $this->category = 'Big Coef';
        } else if (strpos($this->message, 'SCORE_CHANGED ') !== false) {
            $this->category = 'Score Changed';
        } elseif (strpos($this->message, 'Bot not responding') !== false) {
            $this->category = 'Start Bot';
        } else {
            $this->category = 'Unknown!';
        }
    }

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'bm_report';
    }

    /**
     * {@inheritdoc}
     * @return ReportQuery the active query used by this AR class.
     */
    public static function find()
    {
        return new ReportQuery(get_called_class());
    }

    public static function createFromPayload($payload)
    {
        $new = new Report();
        $new->raw = $payload;
        $new->remote_ip = $_SERVER['REMOTE_ADDR'];
        $new->parseAnswer();
        $new->recognizeCategory();
        if ($new->save()) {
            return ['success' => true, 'message' => $new->id];
        } else {
            file_put_contents(dirname(__FILE__) . '/../../../report_errors.log',
                VarDumper::dumpAsString($new->getErrors()) . " in\r\n" .
                VarDumper::dumpAsString($new->getAttributes($new->fields())) . "\r\n",
                FILE_APPEND);
            return ['success' => false, 'message' => VarDumper::dumpAsString($new->getErrors())];
        }
    }

    public static function getAllRemotes()
    {
        return (new Query())->select('remote_ip')->distinct()->from(Report::tableName())->all();
    }

}
