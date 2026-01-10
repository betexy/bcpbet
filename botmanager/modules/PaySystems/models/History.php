<?php

namespace app\modules\PaySystems\models;

use app\modules\PaySystems\helpers\CryptoHelper;
use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "{{%ps_history}}".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property int $datetime
 * @property string $datetime_string
 * @property int $ps_paysystems_id
 * @property int $type
 * @property string $amount
 * @property int $currency
 * @property string $sender
 * @property string $receiver
 * @property string $description
 * @property string $tech
 * @property string $comment
 *
 * @property string $title
 * @property string $printAmount
 *
 * @property Paysystems $paysystems
 */
class History extends \yii\db\ActiveRecord
{

    static public $types = [
        0 => 'IN',
        1 => 'OUT',
    ];

    static public $currencies = [
        0 => 'RUB',
        1 => 'EUR',
        2 => 'USD',
        3 => 'BTC',
        4 => 'USDT',
        5 => 'BNB',
        6 => 'LTC',
    ];

    static public $psTypesCurrencies = [
        0 => null,
        1 => 0, // QIWI - RUB
        2 => 1, // SKRILL - EUR
        3 => 3, // BLOCKCHAIN - BTC
        4 => 2
    ];

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%ps_history}}';
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
            [['ps_paysystems_id', 'amount', 'receiver'], 'required'],
            [['created_at', 'updated_at', 'datetime', 'ps_paysystems_id', 'type', 'currency'], 'integer'],
            //['amount', 'compare', 'compareValue' => 10, 'operator' => '>=', 'type' => 'number'],
            //[['amount',], 'number'],
            [['amount'], 'number', 'min' => 0],
            [['amount'], 'compare', 'operator' => '>', 'compareValue' => 0],
            [['description', 'tech', 'comment'], 'string'],
            [['datetime_string', 'sender',], 'string', 'max' => 255],
            [['receiver'], 'string', 'min' => 42],
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
            'created_at' => Yii::t('PaySystems', 'Created At'),
            'updated_at' => Yii::t('PaySystems', 'Updated At'),
            'datetime' => Yii::t('PaySystems', 'Datetime'),
            'datetime_string' => Yii::t('PaySystems', 'Datetime String'),
            'ps_paysystems_id' => Yii::t('PaySystems', 'Paysystem'),
            'type' => Yii::t('PaySystems', 'Type'),
            'amount' => Yii::t('PaySystems', 'Amount'),
            'currency' => Yii::t('PaySystems', 'Currency'),
            'sender' => Yii::t('PaySystems', 'Sender'),
            'receiver' => Yii::t('PaySystems', 'Receiver'),
            'description' => Yii::t('PaySystems', 'Description'),
            'tech' => Yii::t('PaySystems', 'Tech'),
            'comment' => Yii::t('PaySystems', 'Comment'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getPaysystems()
    {
        return $this->hasOne(Paysystems::class, ['id' => 'ps_paysystems_id']);
    }

    public function getTitle()
    {
        return History::$types[$this->type] . ' ' . $this->printAmount . ' ' . History::$currencies[$this->currency];
    }

    public function getPrintAmount()
    {
        return Yii::$app->formatter->asDecimal($this->amount, $this->paysystems->type === 3 ? 5 : 2);
    }

    public function save($runValidation = true, $attributeNames = null, $cron = false): bool
    {
        $wasNew = $this->isNewRecord;
        if ($wasNew) {
            $this->type = 1;
        }
        $res = parent::save($runValidation, $attributeNames);
        if ($res && $wasNew) {
            $withdrawalResult = CryptoHelper::binanceWithdrawal($this, $cron);
            $this->sender = $withdrawalResult['sender'];
            $this->comment .= '[' . ($withdrawalResult['success'] ? '' : 'ERROR: ') . $withdrawalResult['message'] . ']';
            $this->datetime_string = $withdrawalResult['datetime_string'];
            $this->datetime = $withdrawalResult['datetime'];
            $this->tech = $withdrawalResult['tech'];
            $res = $this->save();
        }
        return $res;
    }

    public static function storeTransaction(Paysystems $ps, $transaction)
    {
        $prepared = [
            'currency' => self::$psTypesCurrencies[$ps->type],
            'datetime' => self::decodeDatetime((string)$transaction['datetime'], (int)$ps->type),
            'datetime_string' => (string)$transaction['datetime'],
            'description' => $transaction['description'],
            'type' => $transaction['type'] === 'IN' ? 0 : 1,
            'amount' => (float)$transaction['amount'],
            'ps_paysystems_id' => $ps->id
        ];
        $exists = History::find()->where($prepared)->andWhere(['ps_paysystems_id' => $ps->id])->count();
        if (empty($exists)) {
            $model = new History();
            foreach ($prepared as $field => $value) {
                $model->$field = $value;
            }
            if (!$model->save()) {
                return var_export($model->errors, true);
            } else {
                return true;
            }
        } else {
            return true;
        }
    }

    public static function decodeDatetime($psDate, $psType)
    {
        if ($psType === 1) {
            // QIWI
            $tDate = str_replace(
                ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
                ['January', 'February', 'March', 'April', 'May', 'June', 'Jule', 'August', 'September', 'October', 'November', 'December'],
                $psDate);
            $dt = \DateTime::createFromFormat('j F Y H:i:s', $tDate . ' ' . (new \DateTime('now'))->format('Y') . ' 00:00:00');
        } elseif ($psType === 2) {
            // SKRILL - 12/12/2018 20:15
            $dt = \DateTime::createFromFormat('d/m/Y H:i:s', "{$psDate}:00");
        } else {
            $dt = null;
        }
        return empty($dt) ? 0 : $dt->format('U');
    }

}
