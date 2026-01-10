<?php

namespace app\modules\PaySystems\helpers;


use app\modules\BotManager\Helpers\BotsHelper;
use app\modules\BotManager\models\Bots;
use app\modules\BotManager\models\BotsQueue;
use app\modules\BotManager\models\SettingsForm;
use app\modules\Emails\models\Mailboxes;
use app\modules\PaySystems\models\History;
use app\modules\PaySystems\models\Paysystems;
use app\modules\PaySystems\models\PaysystemsBots;
use app\modules\PaySystems\models\PaysystemsQueue;
use app\modules\PaySystems\models\Wallets;
use Yii;
use yii\base\Exception;
use yii\helpers\ArrayHelper;
use yii\helpers\VarDumper;
use yii\web\BadRequestHttpException;

class PaySystemsHelper
{

    /**
     * @param $data
     * @return array
     */
    public static function proceedRequest($data)
    {
        if (in_array($data['status'], ['ready', 'report', 'after_withdrawal', 'deposit_no_funds'])) {
            $bot = Bots::findOne(['websocket_uid' => $data['websocket_uid']]);
            if (empty($bot)) {
                return ['status' => 'error', 'message' => "Bot with websocket_uid '{$data['websocket_uid']}' not found :("];
            } else {
                if ($data['status'] === 'report' && !empty($data['id']) && !empty($data['succeed']) && isset($data['message'])) {
                    return self::proceedReport($data);
                } elseif ($data['status'] === 'after_withdrawal') {
                    $data['data']['just_withdrawn'] = true;
                    //return self::scheduleCommand('CheckBalance', $data['data'], $bot);
                    return ['status' => 'error', 'message' => 'Status after_withdrawal is prohibited now!'];
                } elseif ($data['status'] === 'deposit_no_funds') {
                    return self::scheduleCommand('TransferFundsFromMaster', $data['data'], $bot);
                } else {
                    return ['status' => 'success', 'message' => self::getCommandForBot($bot->id)];
                }
            }
        } else {
            return ['status' => 'error', 'message' => 'Status ' . $data['status'] . ' not implemented :('];
        }
    }

    public static function proceedCheckBalance()
    {
        file_put_contents(\Yii::getAlias('@runtime/logs/proceedCheckBalance.log'),
            date('Y-m-d H:i:s') . PHP_EOL, FILE_APPEND);
        $queueQuery = BotsQueue::find()
            ->where(['status' => 0, 'action' => 'CHECK_WALLET_BALANCE'])
            ->andWhere(['<', 'updated_at', time() - (2 * 60)])
            ->orderBy(['id' => SORT_ASC])
            ->limit(2)
            ->with('wallet');
        //$command = $queueQuery->createCommand();
        //file_put_contents(\Yii::getAlias('@runtime/logs/proceedCheckBalance.log'),
        //    date('Y-m-d H:i:s') . ": " . $command->getRawSql() . PHP_EOL, FILE_APPEND);
        $queue = $queueQuery->all();
        foreach ($queue as $item) {
            if ($item->bot_class !== 'Wallets') {
                $item->status = 3;
                $item->response = json_encode(['error' => "Wrong bot class: $item->id, $item->bots_id, $item->bot_class"]);
                $item->safeSave();
                continue;
            }
            try {
                echo "Item: $item->id Wallet: $item->bots_id, $item->bot_class" . PHP_EOL;
                $wallet = Wallets::findOne($item->bots_id);
                CryptoHelper::getBalances($wallet);
                $item->status = 2;
                $item->response = json_encode(['USDT' => $wallet->withdrawal_balance_usdt,
                    'BNB' => $wallet->withdrawal_balance_bnb]);
                $item->safeSave();
                if (strpos($item->data, 'STAKE_WITHDRAWAL_REQUEST_71032') !== false) {
                    // Hint: here we received successfully checked balance
                    // После вывода с акка и чека, что деньги дошли - перевод на этот аккаунт BNB
                    // необходимого для транзакции и вывод с него на кошелек Бинанса
                    $wRes = BotsQueue::finalWithdrawals(
                        json_decode($item->data, true),
                        json_decode($item->response, true),
                        $item);
                    if ($wRes['status'] === 2) {
                        // Done
                        $item->status = 2;
                        $item->response = json_encode(array_merge(json_decode($item->response, true),
                            ['finalWithdrawals success' => $wRes['message']]));
                        $item->safeSave();
                    } elseif ($wRes['status'] === 3) {
                        // Done with error
                        $item->status = 3;
                        $item->response = json_encode(array_merge(json_decode($item->response, true),
                            ['finalWithdrawals error' => $wRes['message']]));
                        $item->safeSave();
                    }
                }
            } catch (\Exception $e) {
                $item->status = 3;
                $item->response = json_encode(['error' => $e->getMessage()]);
                $item->safeSave();
            }
        }
    }

    public static function proceedBinanceQueue()
    {
        file_put_contents(\Yii::getAlias('@runtime/logs/proceedBinanceQueue.log'),
            date('Y-m-d H:i:s') . PHP_EOL, FILE_APPEND);
        $queue = PaysystemsQueue::find()
            ->where(['status' => 0, 'command' => 'BINANCE_WITHDRAW'])
            ->andWhere(['is', 'sent_at', new \yii\db\Expression('null')])
            ->orderBy(['id' => SORT_ASC])
            ->limit(1)
            ->one();
        if (empty($queue)) {
            echo "It looks like queue is empty" . PHP_EOL;
            return;
        }
        $data = json_decode($queue->data, true);
        if (empty($data['amount']) || empty($data['wallet'])) {
            echo "Wrong data" . PHP_EOL;
            $queue->status = 3;
            $queue->save();
            return;
        }
        $history = new History();
        $history->ps_paysystems_id = $queue->ps_paysystems_id;
        // OUT
        $history->type = 1;
        // USDT
        $history->currency = 4;
        $history->receiver = $data['wallet'];
        $history->amount = $data['amount'];
        $history->comment .= "[Withdrawal by queue id: {$queue->id}]";
        $history->datetime = time();
        $history->datetime_string = date('Y-m-d H:i:s', $history->datetime);
        // Hint: here should be a payment via Binance API
        $res = $history->save(false, null, true);
        $queue->response = empty($res)
            ? self::cleanExport($history->getErrors())
            : "[History id: {$history->id}][{$history->comment}]";
        $queue->status = strpos($history->comment, 'ERROR:') !== false || empty($res) ? 3 : 2;
        $queue->sent_at = time();
        if (!$queue->save()) {
            Yii::error('Can\'t save queue: ' . VarDumper::dumpAsString($queue->errors));
        }
    }

    public static function cleanExport($p)
    {
        $s = var_export($p, true);
        return preg_replace('/\s+/', ' ', str_replace(["\r", "\n", "\t", "array"], '', $s));
    }

    public static function withdrawFromWallet($wallet, $pattern = '', $balance = 0): array
    {
        $model = Wallets::findOne(['deposit_address' => $wallet]);
        if (empty($model)) {
            return ['status' => 'error', 'message' => "Withdrawal wallet not found: $wallet"];
        }
        list ($success, $message) = BotsQueue::createStakeWithdrawal($model->id, '0', $pattern, $balance);
        return ['status' => $success ? 'success' : 'error', 'message' => $message,];
    }

    /**
     * Fill up wallet from Binance account
     * @param $data
     * @return array
     * @throws BadRequestHttpException
     * @throws Exception
     */
    public static function fillUpWalletFromBinance($data): array
    {
        $settings = new SettingsForm();
        $settings->loadData();
        if (empty($data) || !is_array($data) || empty($data['ps_id']) || empty($data['amount'])
            || empty($data['wallet']) || empty($data['uid'])) {
            throw new BadRequestHttpException('Wrong data');
        }
        $ps = Paysystems::findOne(['id' => $data['ps_id']]);
        if (empty($ps)) {
            throw new BadRequestHttpException('Wrong PS ID');
        }
        $mailbox = Mailboxes::findOne(['address' => $data['email']]);
        if (empty($mailbox)) {
            throw new BadRequestHttpException('There is no email: ' . $data['email']);
        }
        // Hint: check wallet exists and create it if not
        $wallet = Wallets::findOne(['deposit_address' => $data['wallet']]);
        if (empty($wallet)) {
            $wallet = new Wallets();
            $wallet->deposit_address = $data['wallet'];
            $wallet->network = empty($data['network']) ? 'bsc' : $data['network'];
            $wallet->approved = 0;
            $wallet->uid = $data['uid'];
            $wallet->bookie = $data["bk"];
            $wallet->login = $data['login'];
            $wallet->mailboxes_id = $mailbox->id;
            if (!$wallet->save()) {
                throw new BadRequestHttpException('Can\'t save wallet 1: ' . VarDumper::dumpAsString($wallet->errors));
            }
            CryptoHelper::createAddress($wallet);
        }
        // Hint: check email address with wallet
        if (empty($wallet->mailbox)) {
            $wallet->mailboxes_id = $mailbox->id;
            if (!$wallet->save()) {
                throw new BadRequestHttpException('Can\'t save wallet 2: ' . VarDumper::dumpAsString($wallet->errors));
            }
        } elseif ($wallet->mailbox->address !== $data['email']) {
            throw new BadRequestHttpException("Email address {$data['email']} is not equal to wallet"
                . " email address {$wallet->mailbox->address}!");
        }
        $tQueue = PaysystemsQueue::find()
            ->where(['AND',
                ['<>', 'status', 3],
                ['command' => 'BINANCE_WITHDRAW'],
                ['ps_paysystems_id' => $data['ps_id']],
                ['>=', 'created_at', time() - (int)$settings->withdraw_interval * 3600],
                ['like', 'data', $data['wallet']],
            ]);
        //->where(['status' => 0, 'command' => 'BINANCE_WITHDRAW', 'ps_paysystems_id' => $data['ps_id']])
        $command = $tQueue->createCommand();
        file_put_contents(\Yii::getAlias('@runtime/logs/PaysystemsQueue-1.log'), $command->getRawSql() . PHP_EOL, FILE_APPEND);
        $pQueue = $tQueue->all();
        foreach ($pQueue as $item) {
            $itemData = json_decode($item->data, true);
            file_put_contents(\Yii::getAlias('@runtime/logs/PaysystemsQueue-1.log'),
                "{$itemData['wallet']} === {$data['wallet']}" . PHP_EOL, FILE_APPEND);
            if ($itemData['wallet'] === $data['wallet']) {
                throw new BadRequestHttpException('Wallet already in queue');
            }
        }
        // Hint: check also last withdrawal from wallet
        $lastWithdrawal = BotsQueue::find()->where([
            'AND',
            ['action' => 'STAKE_WITHDRAWAL'],
            ['status' => 2,],
            ['bots_id' => $wallet->id],
            ['bot_class' => 'Wallets'],
            ['<=', 'updated_at', time() - (int)$settings->withdraw_interval * 3600 * 48],
        ])->limit(1)->one();
        if (!empty($lastWithdrawal)) {
            $diff = time() - $lastWithdrawal->updated_at;
            $mess = "Last successful withdrawal from wallet {$wallet->id} was "
                . "id {$lastWithdrawal->id} {$diff}s ago and it is less than 48 hrs";
            file_put_contents(\Yii::getAlias('@runtime/logs/PaysystemsQueue-2.log'),
                $mess . PHP_EOL, FILE_APPEND);
            throw new BadRequestHttpException($mess);
        }
        $queue = new PaysystemsQueue();
        $queue->ps_paysystems_id = $data['ps_id'];
        $queue->status = 0; // new
        $queue->command = 'BINANCE_WITHDRAW';
        $queue->data = json_encode($data);
        $queue->save();
        return ["Queue ID" => $queue->id, "Wallet" => $wallet->id,];
    }

    private static function getCommandForBot($bots_id)
    {
        $task = PaysystemsQueue::find()
            ->where(['in', 'ps_paysystems_id', ArrayHelper::map(
                PaysystemsBots::findAll(['deleted' => 0, 'bm_bots_id' => $bots_id]), 'ps_paysystems_id', 'ps_paysystems_id'
            )])
            ->andWhere(['status' => 0])
            ->andWhere(['OR', ['plan_send_at' => 0], ['<=', 'plan_send_at', time()]])
            ->orderBy(['id' => SORT_ASC])
            ->one();
        if (empty($task)) {
            $bot = Bots::findOne($bots_id);
            $action = BotsHelper::actionForBot($bot, true);
            return empty($action) ? [] : $action;
        } else {
            $task->sent_at = time();
            $task->status = 1;
            $task->save();
            return [
                'queue_id' => $task->id,
                'paysystem' => Bots::getPaysystemNameClear($task->paysystems->type),
                'command' => self::prepareCommandForCommand($task->command),
                'data' => self::prepareDataForCommand($task)
            ];
        }
    }

    private static function prepareCommandForCommand($command)
    {
        return $command === 'CHECK_BALANCE_UNTIL_CHANGE' ? 'CHECK_BALANCE' : $command;
    }

    private static function prepareDataForCommand(PaysystemsQueue $task)
    {
        $taskData = json_decode($task->data, true);
        $data = empty($taskData) ? [] : $taskData;
        $data['login'] = $task->paysystems->login;
        $data['password'] = $task->paysystems->password;
        $data['pin'] = $task->paysystems->pin;
        if ((int)$task->paysystems->type === 3) {
            $additions = json_decode($task->paysystems->additions);
            $data['email'] = empty($additions->email) ? '' : $additions->email;
            $data['wallet'] = empty($additions->wallet) ? '' : $additions->wallet;
        }
        return $data;
    }

    private static function proceedReport($data)
    {
        if (!empty($data['from_extension'])) {
            $queue = BotsQueue::findOne($data['id']);
            if ($queue && $queue->setExtensionAnswer($data)) {
                return ['status' => 'success', 'message' => "Extension answer accepted!"];
            } else {
                return ['status' => 'error', 'message' => $queue ? 'Error during save: ' . var_export($queue->errors, true) : "No queue {$data['id']}!"];
            }
        } else {
            $psq = PaysystemsQueue::findOne($data['id']);
            if (empty($psq)) {
                return ['status' => 'error', 'message' => "PS action with id {$data['id']} not found :("];
            }
            if ($psq->status !== 1) {
                return ['status' => 'error', 'message' => "PS action with id {$data['id']} has status: " . BotsQueue::$statusesListShort[$psq->status]];
            }
            $psq->response = json_encode($data);
            $psq->status = $data['succeed'] === 'success' ? 2 : 3;
            if (!$psq->save()) {
                return ['status' => 'error', 'message' => 'Error during save: ' . VarDumper::dumpAsString($psq->errors)];
            } else {
                $result = $psq->performCommandActions();
                return ['status' => 'success', 'message' => "It looks good! Transactions performed: " . ($result === true ? 'YES' : $result)];
            }
        }
    }

    /**
     * @param string $type CheckBalance || TransferFundsFromMaster
     * @param array $data
     * @param Bots $bot
     * @return array
     */
    private static function scheduleCommand($type, array $data, Bots $bot)
    {
        $ps = self::getPsOrError($data, $bot);
        if (!$ps instanceof Paysystems) {
            return $ps;
        }
        if ($type === 'CheckBalance') {
            $res = PaysystemsQueue::planCheckBalance($ps->id, $ps->balance, 1800, !empty($data['just_withdrawn']));
        } elseif ($type === 'TransferFundsFromMaster') {
            $res = PaysystemsQueue::transferFundsFromMaster($ps, $data['amount']);
        } else {
            $res = "Unsupported type: '{$type}'";
        }
        if ($res !== true) {
            return ['status' => 'error', 'message' => 'Error during save: ' . $res];
        }
        return ['status' => 'success', 'message' => "It looks good!"];
    }

    private static function getPsOrError(array $data, Bots $bot)
    {
        if (empty($data['paysystem']) || empty($data['login'])) {
            return ['status' => 'error', 'message' => 'No login/paysystem!'];
        }
        $ps = Paysystems::find()
            ->where(['in', 'id', ArrayHelper::map($bot->paysystemsBots, 'ps_paysystems_id', 'ps_paysystems_id')])
            ->andWhere(['and',
                ['type' => array_search(strtolower($data['paysystem']), array_map('strtolower', Bots::$paymentMethods))],
                ['like', 'login', $data['login']]
            ])
            ->one();
        if (empty($ps)) {
            return ['status' => 'error', 'message' => "Paysystem {$data['paysystem']} with login '{$data['login']}' for bot id '{$bot->id}' not found :("];
        }
        return $ps;
    }


}
