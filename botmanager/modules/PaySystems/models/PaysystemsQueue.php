<?php

namespace app\modules\PaySystems\models;

use Yii;
use yii\behaviors\TimestampBehavior;
use yii\helpers\VarDumper;

/**
 * This is the model class for table "{{%ps_paysystems_queue}}".
 *
 * @property int $id
 * @property int $ps_paysystems_id
 * @property int $created_at
 * @property int $updated_at
 * @property int $sent_at
 * @property int $plan_send_at
 * @property int $status
 * @property string $command
 * @property string $data
 * @property string $response
 *
 * @property Paysystems $paysystems
 */
class PaysystemsQueue extends \yii\db\ActiveRecord
{

    public static $commands = [
        //'CHECK_BALANCE' => 'Check balance',
        //'CHECK_BALANCE_UNTIL_CHANGE' => 'Check after withdrawal',
        //'TRANSFER_INTERNAL' => 'Send money to another account (internal)',
        //'TRANSFER_EXTERNAL' => 'Send money to another account (external)',
        //'HISTORY' => 'Get account\'s history',
        'BINANCE_WITHDRAW' => 'Deposit from binance',
    ];

    // modules/BotManager/models/BotsQueue.php $statusesList
    public static $statusesList = [
        0 => 'New',
        1 => 'Sent',
        2 => 'Success',
        3 => 'Failed',
        4 => 'Awaiting',
    ];

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%ps_paysystems_queue}}';
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
            [['ps_paysystems_id', 'status'], 'required'],
            [['ps_paysystems_id', 'created_at', 'updated_at', 'sent_at', 'plan_send_at', 'status'], 'integer'],
            [['data', 'response'], 'string'],
            [['command'], 'string', 'max' => 255],
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
            'ps_paysystems_id' => Yii::t('PaySystems', 'Ps Paysystems ID'),
            'created_at' => Yii::t('PaySystems', 'Created At'),
            'updated_at' => Yii::t('PaySystems', 'Updated At'),
            'sent_at' => Yii::t('PaySystems', 'Sent At'),
            'plan_send_at' => Yii::t('PaySystems', 'Plan Send At'),
            'status' => Yii::t('PaySystems', 'Status'),
            'command' => Yii::t('PaySystems', 'Command'),
            'data' => Yii::t('PaySystems', 'Data'),
            'response' => Yii::t('PaySystems', 'Response'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getPaysystems()
    {
        return $this->hasOne(Paysystems::class, ['id' => 'ps_paysystems_id']);
    }

    public function performCommandActions()
    {
        if ($this->status === 2 && in_array($this->command, ['CHECK_BALANCE', 'TRANSFER_INTERNAL'])) {
            $response = json_decode($this->response, true);
            $this->updateBalance((float)$response['message']);
        } elseif ($this->status === 2 && in_array($this->command, ['HISTORY'])) {
            $response = json_decode($this->response, true);
            $this->updateBalance((float)$response['message']['balance']);
            return $this->storeTransactions($response);
        } elseif ($this->command === 'CHECK_BALANCE_UNTIL_CHANGE') {
            $response = json_decode($this->response, true);
            $data = json_decode($this->data, true);
            if ($this->status === 2 && (float)$response['message'] === (float)$data['balance_before']
                && $this->checkWasFirstCheckWithinDay()) {
                self::planCheckBalance($this->paysystems->id, $this->paysystems->balance);
            } elseif ($this->status === 3) {
                self::planCheckBalance($this->paysystems->id, $this->paysystems->balance, 300);
            } elseif ($this->status === 2) {
                $this->updateBalance((float)$response['message']);
            }
        }
        return true;
    }

    private function storeTransactions($response)
    {
        if (!is_array($response['message']['collected'])) {
            return true;
        }
        $errors = [];
        foreach ($response['message']['collected'] as $transaction) {
            $r = History::storeTransaction($this->paysystems, $transaction);
            if ($r !== true) {
                $errors[] = $r;
            }
        }
        return empty($errors) ? true : implode(', ', $errors);
    }

    private function updateBalance($newBalance)
    {
        $this->paysystems->balance = $newBalance;
        $this->paysystems->checked_at = time();
        if (!$this->paysystems->save(false)) {
            Yii::error(var_export($this->paysystems->errors, true), 'PAYSYSTEMS');
            return false;
        } elseif (!empty($this->paysystems->when_amount) && !empty($this->paysystems->send_amount) && !empty($this->paysystems->ps_paysystems_id_master)
            && ((float)$this->paysystems->balance >= (float)$this->paysystems->when_amount)
            && self::checkNoPlannedTransfers($this->paysystems->id)
        ) {
            $queue = new PaysystemsQueue();
            $queue->command = 'TRANSFER_INTERNAL';
            $queue->ps_paysystems_id = $this->paysystems->id;
            $queue->data = json_encode(['recipient' => $this->paysystems->master->login, 'amount' => $this->paysystems->send_amount]);
            $queue->status = 0;
            if (!$queue->save()) {
                Yii::error(var_export($queue->errors, true), 'PAYSYSTEMS_QUEUE');
                return false;
            }
        }
        return true;
    }

    private function checkWasFirstCheckWithinDay()
    {
        return (int)PaysystemsQueue::find()
                ->where(['ps_paysystems_id' => $this->ps_paysystems_id, 'status' => 2, 'command' => 'CHECK_BALANCE_UNTIL_CHANGE'])
                ->andWhere(['like', 'data', 'SmQpX3UfmkkQ5KM7nJQ7'])
                ->andWhere(['>=', 'updated_at', time() - 86400])
                ->count() > 0;
    }

    private static function checkNoPlannedTransfers($id, $additionalCondition = false)
    {
        $query = PaysystemsQueue::find()->where(['ps_paysystems_id' => $id, 'status' => 0, 'command' => 'TRANSFER_INTERNAL']);
        $count = (int)$query->count();
        if ($additionalCondition === false || $count === 0) {
            return $count === 0;
        } else {
            $result = true;
            foreach ($query->all() as $queue) {
                $data = json_decode($queue->data);
                if (!empty($data[$additionalCondition['key']]) && $data[$additionalCondition['key']] === $additionalCondition['value']) {
                    $result = false;
                    break;
                }
            }
            return $result;
        }
    }

    public static function planCheckBalance($paysystems_id, $balance_before, $interval = 1800, $justWithdrawn = false)
    {
        $queue = new PaysystemsQueue();
        $queue->command = 'CHECK_BALANCE_UNTIL_CHANGE';
        $queue->ps_paysystems_id = $paysystems_id;
        $queue->plan_send_at = time() + $interval;
        $queue->status = 0;
        $dataToStore = ['balance_before' => $balance_before];
        if ($justWithdrawn) {
            $dataToStore['justWithdrawn'] = 'SmQpX3UfmkkQ5KM7nJQ7';
        }
        $queue->data = json_encode($dataToStore);
        if ($queue->save()) {
            return true;
        } else {
            return VarDumper::dumpAsString($queue->errors);
        }
    }

    public static function transferFundsFromMaster(Paysystems $ps, $amount)
    {
        if (empty($ps->master)) {
            return 'No master!';
        } elseif (!self::checkNoPlannedTransfers($ps->master->id, ['key' => 'recipient', 'value' => $ps->login])) {
            return 'Transfer already planned!';
        } else {
            $queue = new PaysystemsQueue();
            $queue->command = 'TRANSFER_INTERNAL';
            $queue->ps_paysystems_id = $ps->master->id;
            $queue->status = 0;
            $queue->data = json_encode(['recipient' => $ps->login, 'amount' => $amount]);
            if ($queue->save()) {
                return true;
            } else {
                return VarDumper::dumpAsString($queue->errors);
            }
        }
    }
}
