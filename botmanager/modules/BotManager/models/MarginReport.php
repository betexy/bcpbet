<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;
use yii\db\Query;
use yii\helpers\VarDumper;

/**
 * This is the model class for table "bm_margin_report".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property string|null $raw
 * @property string|null $remote_ip
 * @property string|null $room_uid
 * @property string|null $status
 * @property float|null $coef
 * @property float|null $requested_coef
 * @property float|null $margin
 * @property string|null $comment
 */
class MarginReport extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'bm_margin_report';
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
            [['created_at', 'updated_at'], 'integer'],
            [['raw', 'comment'], 'string'],
            [['coef', 'requested_coef', 'margin'], 'number'],
            [['remote_ip'], 'string', 'max' => 20],
            [['room_uid'], 'string', 'max' => 50],
            [['status'], 'string', 'max' => 50],
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
            'raw' => Yii::t('BotManager', 'Raw'),
            'remote_ip' => Yii::t('BotManager', 'Remote Ip'),
            'room_uid' => Yii::t('BotManager', 'Room UID'),
            'status' => Yii::t('BotManager', 'Status'),
            'coef' => Yii::t('BotManager', 'Coef'),
            'requested_coef' => Yii::t('BotManager', 'Requested Coef'),
            'margin' => Yii::t('BotManager', 'Margin'),
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
            $stats = !isset($jsonAll['statistics']) ? [] : json_decode($jsonAll['statistics'], true);
            $data = $getData($json['data'] ?? []);
            $this->status = $data['status'] ?? '-NO-STATUS-';
            $this->coef = $data['coef'] ?? '';
            $this->requested_coef = $stats['requested_coef'] ?? '';
            $this->margin = $stats['margin'] ?? '';
            $this->room_uid = isset($json['room']) && isset($json['room']['uid']) ? $json['room']['uid'] : '';
        } catch (\Exception $e) {
            $this->comment = "parseAnswer: {$e->getMessage()}";
        }
        return $this;
    }

    /**
     * {@inheritdoc}
     * @return MarginReportQuery the active query used by this AR class.
     */
    public static function find()
    {
        return new MarginReportQuery(get_called_class());
    }

    public static function getAllRemotes()
    {
        return (new Query())->select('remote_ip')->distinct()->from(MarginReport::tableName())->all();
    }

    public static function getAllUIDs()
    {
        return (new Query())->select('room_uid')->distinct()->from(MarginReport::tableName())->all();
    }

    public static function getAllStatuses()
    {
        return (new Query())->select('status')->distinct()->from(MarginReport::tableName())->all();
    }

    public static function createFromPayload($payload)
    {
        $new = new MarginReport();
        $new->raw = $payload;
        $new->remote_ip = $_SERVER['REMOTE_ADDR'];
        $new->parseAnswer();
        if ($new->save()) {
            return ['success' => true, 'message' => $new->id];
        } else {
            file_put_contents(dirname(__FILE__) . '/../../../margin_report_errors.log',
                VarDumper::dumpAsString($new->getErrors()) . " in\r\n" .
                VarDumper::dumpAsString($new->getAttributes($new->fields())) . "\r\n",
                FILE_APPEND);
            return ['success' => false, 'message' => VarDumper::dumpAsString($new->getErrors())];
        }
    }
}
