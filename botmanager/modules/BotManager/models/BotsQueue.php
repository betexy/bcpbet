<?php

namespace app\modules\BotManager\models;

use app\modules\BotManager\Helpers\transliterator\TransliteratorHelper;
use app\modules\Emails\models\Mailboxes;
use app\modules\PaySystems\helpers\CryptoHelper;
use app\modules\PaySystems\models\Wallets;
use Yii;
use yii\behaviors\TimestampBehavior;
use yii\helpers\ArrayHelper;
use yii\helpers\VarDumper;
use app\modules\Accounts\models\AccountBookmaker;

/**
 * This is the model class for table "bm_bots_queue".
 *
 * @property int $id
 * @property int $deleted
 * @property int $bots_id
 * @property string $bot_class
 * @property int $created_at
 * @property int $updated_at
 * @property int $status
 * @property string $action
 * @property string $data
 * @property string $response
 * @property int $run_after_success
 * @property int $run_after_fail
 * @property int $executor
 *
 * @property array $dataDecoded
 * @property Bots $bot
 * @property Wallets $wallet
 */
class BotsQueue extends \yii\db\ActiveRecord
{

    private static $debug = true;

    public static $actionsList = [
        'UPDATE_EXTENSION' => 'Update the Extension with selected BKs and settings',
        'INSTALL_EXTENSION' => 'Install the Extension with selected BKs and settings',
        'CHECK_INSTALLED' => 'Check installed software',
        'INSTALL_NECESSARY_SOFTWARE' => 'Install Remote and Browser if necessary',
        'CHANGE_INI_DATA' => 'Update Settings of Bot',
        'REGISTER_IN_BK' => 'Register in BK',
        'STAKE_WITHDRAWAL' => 'Withdrawal from stake',
        'CHECK_WALLET_BALANCE' => 'Check wallet balance',
        //'DEPOSIT' => 'Deposit',
        //'WITHDRAW' => 'Withdraw',
    ];

    public static $statusesList = [
        0 => 'Just added',
        1 => 'Action sent to bot',
        2 => 'Action resolved with Success',
        3 => 'Action Failed',
    ];

    public static $statusesListShort = [
        0 => 'New',
        1 => 'Sent',
        2 => 'Success',
        3 => 'Failed',
    ];

    public static $executorsList = [
        0 => 'Software',
        1 => 'Extension',
    ];

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'bm_bots_queue';
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
            [['bots_id', 'action', 'status'], 'required'],
            [['bots_id', 'created_at', 'updated_at', 'status', 'run_after_success', 'run_after_fail',
                'deleted', 'executor'], 'integer'],
            [['data', 'response'], 'string'],
            [['action', 'bot_class'], 'string', 'max' => 255],
            //[['bots_id'], 'exist', 'skipOnError' => true, 'targetClass' => Bots::class, 'targetAttribute' => ['bots_id' => 'id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('BotManager', 'ID'),
            'deleted' => Yii::t('BotManager', 'Deleted'),
            'bots_id' => Yii::t('BotManager', 'Bots ID'),
            'bot_class' => Yii::t('BotManager', 'Bot Class'),
            'created_at' => Yii::t('BotManager', 'Created At'),
            'updated_at' => Yii::t('BotManager', 'Updated At'),
            'status' => Yii::t('BotManager', 'Status'),
            'action' => Yii::t('BotManager', 'Action'),
            'data' => Yii::t('BotManager', 'Data'),
            'response' => Yii::t('BotManager', 'Response'),
            'run_after_success' => Yii::t('BotManager', 'After success of'),
            'run_after_fail' => Yii::t('BotManager', 'After fail of'),
            'executor' => Yii::t('BotManager', 'Executor'),
        ];
    }

    public function getBot()
    {
        if ($this->bot_class === 'Bots') {
            return $this->hasOne(Bots::class, ['id' => 'bots_id',]);
        } else {
            return null;
        }
    }

    public function getWallet()
    {
        if ($this->bot_class === 'Wallets') {
            return $this->hasOne(Wallets::class, ['id' => 'bots_id',]);
        } else {
            return null;
        }
    }

    public function getDataDecoded()
    {
        return json_decode($this->data, true);
    }

    /**
     * Store answer to action
     * @param $params
     * @return bool|string
     */
    public function setAnswer($params)
    {
        $this->response = base64_decode($params['response']);
        if (!empty($params['data'])) {
            $this->data = base64_decode($params['data']);
        }
        $this->status = 2;
        try {
            if ($this->save()) {
                $this->answerProcedures();
                return true;
            } else {
                return VarDumper::dumpAsString($this->getErrors());
            }
        } catch (\Exception $e) {
            return $e->getMessage();
        } catch (\Throwable $t) {
            return $t->getMessage();
        }
    }

    public function setExtensionAnswer($params)
    {
        $this->response = json_encode($params['message']);
        $this->status = $params['succeed'] === 'success' ? 2 : 3;
        try {
            if ($this->save() && $this->answerProcedures()) {
                return true;
            } else {
                return false;
            }
        } catch (\Exception $e) {
            $this->addError('Exception', var_export($e->getMessage(), true));
            return false;
        } catch (\Throwable $t) {
            $this->addError('Throwable', var_export($t->getMessage(), true));
            return false;
        }
    }

    /**
     * Creates a new Action in Bot's Queue
     * @return bool
     */
    public function create()
    {
        if ($this->action === 'REGISTER_IN_BK') {
            $this->generateNecessary();
            list($ab, $fg, $existingBk) = $this->retrieveAndCheck();
            if (count($this->errors) === 0) {
                if (empty($existingBk)) {
                    $bbk = new BotsBks();
                    $bbk->bots_id = $this->bots_id;
                    $bbk->bk_id = $fg->id;
                    $bbk->login = 'reger';
                    $bbk->password = 'reger';
                    $bbk->url = $ab->account->phone;
                    if (!$bbk->save()) {
                        $this->addError('BotsBks save', var_export($bbk->errors, true));
                    }
                }
                if (count($this->errors) === 0) {
                    $bq = new BotsQueue();
                    $bq->bots_id = $this->bots_id;
                    $bq->action = 'UPDATE_EXTENSION';
                    $bq->status = 0;
                    if (!$bq->save()) {
                        $this->addError('BotsQueue save', var_export($bq->errors, true));
                    } else {
                        $this->executor = 1;
                        $this->run_after_success = $bq->id;
                    }
                }
            }
        }
        return count($this->errors) > 0 ? false : $this->save();
    }

    /**
     * @return array
     */
    public function prepareCommandForExtension()
    {
        // TODO: Add support for necessary commands, now we needs REGISTER only
        $data = json_decode($this->data);
        $ab = AccountBookmaker::findOne($data->account_bookmaker);
        $regData = [
            'nickname' => $data->nickname,
            'password' => $data->password,
            'mothers_maiden_name' => $data->mothers_maiden_name,
        ];
        if (!empty($data->passport_number)) {
            $regData['passport_number'] = $data->passport_number;
        }
        foreach ($ab->account->attributes as $name => $value) {
            if (in_array($name, ['first_name', 'second_name', 'third_name', 'birth_date', 'email', 'phone', 'city', 'postal_code',
                'address', 'skrill_login', 'qiwi_login', 'first_name_en', 'second_name_en', 'city_en', 'address_en',])) {
                $regData[$name] = $value;
            }
        }
        $regData['region'] = $this->getRegionFromZIP($regData['postal_code']);
        $regData['birth_date'] = str_replace('-', '/', $regData['birth_date']);
        $this->status = 1;
        $this->save();
        return [
            'queue_id' => $this->id,
            'paysystem' => 'extension',
            'command' => 'REGISTER',
            'data' => [
                'bk' => $ab->bookmaker,
                'data' => $regData,
            ],
        ];
    }

    /**
     * @return array
     */
    public function prepareCommandForBot()
    {
        $this->status = 1;
        $this->save();
        $settings = new SettingsForm();
        $settings->loadData();
        return [
            'id' => $this->id,
            'action' => $this->action,
            'data' => $this->data,
            'settings' => [
                'chrome' => $this->bots->run_into_the_chrome,
                'profile' => empty($this->bots->multilogin_profile_name) ? '' : $this->bots->multilogin_profile_name,
                'port' => empty($this->bots->multilogin_port_number) ? '35000' : $this->bots->multilogin_port_number,
                'remote' => $this->bots->remote_type,
                'anticaptcha_key' => !empty($this->bots->install_anticaptcha) && !empty($settings->anticaptcha_key) ? $settings->anticaptcha_key : '',
                'anticaptcha_id' => !empty($this->bots->install_anticaptcha)
                    ? (function () {
                        $a = FileGroups::find()->where(['type' => 3])->orderBy(['id' => SORT_DESC])->limit(1)->one();
                        return empty($a) ? 0 : $a->id;
                    })()
                    : 0,
            ],
        ];
    }

    public function safeSave()
    {
        if (!$this->save()) {
            $errors = $this->getErrors();
            $show = array_values(array_map(function ($el) {
                return is_array($el) ? array_shift($el) : '';
            }, $errors));
            self::debug("Error while saving BotsQueue: " . implode('; ', $show), 'BotQueueSafe');
        }
    }

    public function delete()
    {
        $this->deleted = 1;
        return $this->save();
    }


    /**
     * @throws \Exception
     */
    public static function createCheckBalance(BotsQueue $model, $data = [])
    {
        $oldData = empty($model->data) ? [] : json_decode($model->data, true);
        $check = new BotsQueue();
        $check->bots_id = $model->bots_id;
        $check->bot_class = $model->bot_class;
        $check->action = 'CHECK_WALLET_BALANCE';
        $check->status = 0;
        $check->data = json_encode(array_merge($oldData, $data));
        if (!$check->save()) {
            $errors = $check->getErrors();
            $show = array_values(array_map(function ($el) {
                return is_array($el) ? array_shift($el) : '';
            }, $errors));
            self::debug("Error while creating check balance request: " . implode('; ', $show),
                'createCheckBalanceErrors');
        }
    }

    public static function createStakeWithdrawal(int $id, int $amount, $pattern = '', $balance = 0): array
    {
        $settings = new SettingsForm();
        $settings->loadData();
        $model = Wallets::findOne($id);
        $notFound = empty($model);
        $noWithdrawalAddress = empty($model->withdrawal_address);
        $noMailbox = empty($model->mailbox->address);
        if ($notFound || $noWithdrawalAddress || $noMailbox) {
            return [false, "Wallet not found ($notFound) or no withdrawal_address ($noWithdrawalAddress) or "
                . "no email ($noMailbox)!"];
        }
        $exists = self::find()->where([
            'AND',
            ['deleted' => 0],
            ['action' => 'STAKE_WITHDRAWAL'],
            ['<>', 'status', 3,],
            ['bots_id' => $model->id],
            ['bot_class' => 'Wallets'],
            ['>=', 'created_at', time() - (int)$settings->withdraw_interval * 3600]
        ])->all();
        if (count($exists) > 0) {
            return [false, "Already in queue: " . count($exists) . "! " . implode("; ", array_map(function ($el) {
                    return $el->id;
                }, $exists))];
        }
        if ($amount < 0) {
            return [false, 'Only positive amount allowed!'];
        }
        $queue = new BotsQueue();
        $queue->bots_id = $model->id;
        $queue->bot_class = 'Wallets';
        $queue->action = 'STAKE_WITHDRAWAL';
        $queue->data = json_encode(['amount' => $amount, 'address' => $model->withdrawal_address,
            'email' => $model->mailbox->address, 'pattern' => $pattern, 'balance' => $balance,]);
        $queue->status = 0;
        if (!$queue->save()) {
            $errors = $queue->getErrors();
            $show = array_values(array_map(function ($el) {
                return is_array($el) ? array_shift($el) : '';
            }, $errors));
            return [false, "Error while creating withdrawal request: " . implode('; ', $show)];
        } else {
            return [true, "Withdrawal request for {$amount} to {$model->withdrawal_address} created!"];
        }
    }

    /**
     * @param $result array
     * @return string[]
     * @throws \Exception
     */
    public static function directCommandResult(array $result): array
    {
        $queueQuery = BotsQueue::findOne($result['queue_id']);
        if (empty($queueQuery)) {
            return ["status" => "error", "message" => "Queue {$result['queue_id']} not found!"];
        } else {
            $queueQuery->status = $result['status'] === 'success' ? 2 : 3;
            $queueQuery->response = json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            $queueQuery->save();
            $data = empty($queueQuery->data) ? [] : json_decode($queueQuery->data, true);
            if ($queueQuery->status === 2 && $queueQuery->action === 'STAKE_WITHDRAWAL') {
                self::createCheckBalance($queueQuery, ['times' => 1]);
            } elseif ($queueQuery->status === 2 && $queueQuery->action === 'CHECK_WALLET_BALANCE'
                && !empty($data['pattern']) && $data['pattern'] === 'STAKE_WITHDRAWAL_REQUEST_71032'
                && !empty($queueQuery->wallet->withdrawal_address)) {
                // Hint: here we received successfully checked balance
                // После вывода с акка и чека, что деньги дошли - перевод на этот аккаунт BNB
                // необходимого для транзакции и вывод с него на кошелек Бинанса
                self::finalWithdrawals($data, $result, $queueQuery);
            } elseif ($queueQuery->status === 3 && $queueQuery->action === 'CHECK_WALLET_BALANCE'
                && (empty($data['times']) || (int)$data['times'] < 7)) {
                $times = empty($data['times']) ? 1 : (int)$data['times'] + 1;
                self::createCheckBalance($queueQuery, ['times' => $times]);
            }
            return ["status" => "success", "message" => "Queue {$result['queue_id']} updated!"];
        }
    }

    public static function getStakeWithdrawalCommand($uid): array
    {
        $wallet = Wallets::findOne(['uid' => $uid]);
        self::debug("getStakeWithdrawalCommand uid {$uid}, wallet id {$wallet->id}", 'getStakeWithdrawalCommand');
        if (empty($wallet) || empty($wallet->withdrawal_address) || empty($wallet->mailbox->address)) {
            return [];
        }
        $queueQuery = BotsQueue::find()
            ->where(['bots_id' => $wallet->id, 'bot_class' => 'Wallets', 'action' => 'STAKE_WITHDRAWAL',
                'status' => 0, 'deleted' => 0, ])
            ->orderBy(['id' => SORT_ASC]);
        $queue = $queueQuery->one();
        if (empty($queue)) {
            return [
                //'no-$queue' => $queueQuery->createCommand()->getRawSql(),
            ];
        }
        $queue->status = 1;
        $queue->save();
        return [
            "action" => "WITHDRAW",
            "data" => [
                "pay_system" => "STAKE_USDT",
                "amount" => !empty($queue->dataDecoded) ? $queue->dataDecoded["amount"] ?? 0 : 0,
                "queue_id" => $queue->id,
                "address" => $wallet->withdrawal_address,
                "email" => $wallet->mailbox->address,
            ],
            "room" => [
                "bk" => "STAKE",
                "uid" => $queue->wallet->uid,
            ],
        ];
    }

    public static function finalWithdrawals(array $data, array $result, BotsQueue $queueQuery): array
    {
        $balance = isset($data['balance']) ? (double)$data['balance'] : 0;
        $usdtDraft = isset($result['USDT']) ? (double)$result['USDT'] : 0;
        $usdt = floor($usdtDraft * 100) / 100;
        $bnb = isset($result['BNB']) ? (double)$result['BNB'] : 0;
        $times = empty($data['times']) ? 1 : (int)$data['times'] + 1;
        $settings = new SettingsForm();
        $settings->loadData();
        $condition1 = $balance === 0 && $usdt > 0;
        $condition2 = $balance > 0 && $usdt > 0;
        $condition3 = ($usdt + 1.1) >= $balance;
        self::debug("balance: $balance, usdt: $usdt, bnb: $bnb\n"
            . "1) $balance === 0 && $usdt > 0: '$condition1', "
            . "2) $balance > 0 && $usdt > 0: '$condition2', "
            . "3) $usdt + 1.1 = " . ($usdt + 1.9) . " >= $balance: '$condition3'");
        if ($condition1 || ($condition2 && $condition3)) {
            self::debug("Entered main trunc!");
            if ($bnb < (double)$settings['bnb_for_transaction']) {
                // перевод на этот аккаунт BNB (5) необходимого для транзакции
                $amount = (double)$settings['bnb_for_transaction'] - $bnb;
                self::debug("Adding $amount BNB");
                $bnbResult = CryptoHelper::sendFromBNBSourceWallet($queueQuery->wallet->withdrawal_address,
                    $amount, 'BNB');
                $result['sendFromBNBSourceWallet'] = $bnbResult;
                $queueQuery->response = json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
                if (!$queueQuery->save()) {
                    self::debug("Queue {$queueQuery->id} save 1: "
                        . var_export($queueQuery->getErrors(), true));
                } else {
                    self::debug("Response after adding BNB: " . $queueQuery->response);
                }
                self::debug("Adding result: " . var_export($bnbResult, true));
                if (!$bnbResult['success']) {
                    return ['status' => -1, 'message' => 'Error adding BNB: ' . $bnbResult['message']];
                }
            }
            // вывод с него на кошелек Бинанса
            self::debug("Sending $usdt USDT to: {$queueQuery->wallet->withdrawal_address}");
            $r = CryptoHelper::sendToWithdrawalAddress($queueQuery->wallet, $usdt);
            self::debug("Sending result: " . var_export($r, true));
            $result['sendToWithdrawalAddress USDT'] = $r;
            $queueQuery->response = json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            if (!$queueQuery->save()) {
                self::debug("Queue {$queueQuery->id} save 2: " . var_export($queueQuery->getErrors(), true));
                return ['status' => -1, 'message' => 'Error saving queue!'];
            } elseif (!$r['success']) {
                return ['status' => 3, 'message' => $r['message']];
            }
            return ['status' => 2, 'message' => "Successfully sent to {$queueQuery->wallet->withdrawal_address}!"];
        } else if ($times < 10) {
            self::debug("Entered sub trunc, times: $times!");
            try {
                self::createCheckBalance($queueQuery, ['times' => $times]);
            } catch (\Exception $e) {
                self::debug("createCheckBalance for {$queueQuery->id} error: {$e->getMessage()}");
            }
            return ['status' => 0, 'message' => "Continue trying, now: $times times!"];
        } else {
            $mess = "Unsuccessfully tried: $times times!";
            self::debug($mess);
            return ['status' => 3, 'message' => $mess];
        }
    }

    private function getRegionFromZIP($zip)
    {
        if (empty($zip)) {
            return '';
        }
        static $indices = [];
        if (empty($indices)) {
            $file = file(dirname(__FILE__) . '/../Helpers/libs/indices.csv');
            foreach ($file as $line) {
                $row = explode(';', str_replace('"', '', $line));
                $region = trim(mb_strtolower(empty($row[1]) ? $row[2] : $row[1]));
                if (!empty($row[0]) && !empty($region)) {
                    $indices[(int)$row[0]] = $region;
                }
            }
        }
        return !empty($indices[(int)substr($zip, 0, 3)]) ? $indices[(int)substr($zip, 0, 3)] : '';
    }

    /**
     * @return array [
     *          AccountBookmaker $ab,
     *          FileGroups $fg,
     *          BotsBks $existingBk,
     * ]
     */
    private function retrieveAndCheck()
    {
        $data = json_decode($this->data);
        $ab = AccountBookmaker::findOne($data->account_bookmaker);
        $bkInternal = array_search($ab->bookmaker, FileGroups::getBkMapping());
        $existingBk = null;
        $fg = null;
        if (empty($ab)) {
            $this->addError('ab', "Error loading AccountBookmaker with id {$data->account_bookmaker}!");
        } else if ($bkInternal === false) {
            $this->addError('bkInternal', "Bk {$ab->bookmaker} not supported!");
        } else if ((int)Mailboxes::find()->where(['address' => $ab->account->email])->count() === 0) {
            $this->addError('Mailboxes', "Mailboxes {$ab->account->email} not found!");
        } else {
            $bkIds = ArrayHelper::map(FileGroups::findAll(['type' => 1, 'bk_internal' => $bkInternal]), 'id', 'id');
            $existingBk = BotsBks::find()
                ->where(['bots_id' => $this->bots_id])
                ->andWhere(['and', ['login' => 'reger'], ['password' => 'reger'], ['url' => $ab->account->phone]])
                ->andWhere(['in', 'bk_id', $bkIds])
                ->one();
            $bbkCount = BotsBks::find()
                ->where(['bots_id' => $this->bots_id])
                ->andWhere(['!=', 'id', empty($existingBk) ? 0 : $existingBk->id])
                ->andWhere(['in', 'bk_id', $bkIds])
                ->count();
            if ($bbkCount > 0) {
                $this->addError('bkInternal', "Bk {$ab->bookmaker} already exists in this bot!");
            } else {
                $fg = FileGroups::findOne(['type' => 1, 'bk_internal' => $bkInternal]);
                if (empty($fg)) {
                    $this->addError('bk', "FileGroup for '{$bkInternal}' not found :(");
                }
            }
        }
        return [$ab, $fg, $existingBk];
    }

    private function generateNecessary()
    {
        $data = json_decode($this->data, true);
        $ab = AccountBookmaker::findOne($data['account_bookmaker']);
        if (empty($data['password'])) {
            $data['password'] = $ab->bm_password;
            /*
            try {
                $data['password'] = Yii::$app->getSecurity()->generateRandomString(mt_rand(8, 12));
            } catch (\yii\base\Exception $e) {
                $data['password'] = mt_rand(10000000, 99000000);
            }
            */
        }
        if (empty($data['nickname'])) {
            $data['nickname'] = $ab->bm_login;
            //$data['nickname'] = preg_replace('/[^\w\d]/', '', substr($ab->account->email, 0, strpos($ab->account->email, '@')))
            //    . mt_rand(111, 999);
        }
        if (empty($data['mothers_maiden_name'])) {
            $femLn = require dirname(__FILE__) . '/../Helpers/libs/fem_ln.php';
            $data['mothers_maiden_name'] = $femLn[mt_rand(0, count($femLn) - 1)];
        }
        if (empty($data['mothers_maiden_name_en'])) {
            $data['mothers_maiden_name_en'] = TransliteratorHelper::process($data['mothers_maiden_name'], '', 'ru');
        }
        $this->data = json_encode($data);
    }

    private function answerProcedures()
    {
        $result = true;
        if ($this->action === 'CHECK_INSTALLED') {
            $this->proceduresForCheckInstalled();
        } elseif (in_array($this->action, ['INSTALL_EXTENSION', 'UPDATE_EXTENSION'])) {
            $this->proceduresForInstallExtension();
        } elseif ($this->action === 'INSTALL_NECESSARY_SOFTWARE') {
            $this->proceduresForInstallSoftware();
        } elseif (in_array($this->action, ['DEPOSIT', 'WITHDRAW', 'CHANGE_INI_DATA'])) {
            $this->proceduresForCheckIniData();
        } elseif ($this->action === 'REGISTER_IN_BK' && $this->status === 2) {
            $result = $this->proceduresForRegister();
        }
        return $result;
    }

    private function proceduresForCheckInstalled()
    {
        $answer = json_decode($this->response);
        $this->bots->extension_installed = (int)!empty($answer->extension_installed);
        $this->bots->multilogin_installed = (int)!empty($answer->multilogin_installed);
        $this->bots->chrome_installed = (int)!empty($answer->chrome_installed);
        if ($this->bots->remote_type > 0) {
            $this->bots->remote_installed = (int)!empty($answer->remote_installed);
        }
        if (!$this->bots->save()) {
            $errors = VarDumper::dumpAsString($this->bots->getErrors());
        } else {
            $errors = '';
        }
        $this->response = $answer->answer . (empty($errors) ? '' : ", errors Bot save: {$errors}");
        $this->save();
    }

    private function proceduresForInstallExtension()
    {
        $answer = json_decode($this->response);
        $this->response = "Success: " . (empty($answer->succeed) ? 'FALSE' : 'TRUE') . ", answer: {$answer->answer}";
        $this->status = empty($answer->succeed) ? 3 : 2;
        $this->save();
    }

    private function proceduresForInstallSoftware()
    {
        $answer = json_decode($this->response);
        $this->status = empty($answer->succeed) ? 3 : 2;
        $addi = '';
        if ($this->bots->remote_type > 0) {
            $this->bots->remote_installed = (int)(!empty($answer->remote_installed) && $answer->remote_installed === 'true');
            $this->bots->remote_login = empty($answer->remote_login) ? '' : $answer->remote_login;
            $this->bots->remote_password = empty($answer->remote_password) ? '' : $answer->remote_password;
            $addi = $this->bots->remote_installed
                ? "Remote installed with login: '{$this->bots->remote_login}', password: '{$this->bots->remote_password}'"
                . (empty($answer->remote_computer_name) ? '' : ", computer_name: '{$answer->remote_computer_name}'")
                : "Remote not installed :(";
        }
        $this->bots->multilogin_installed = (int)(!empty($answer->multilogin_installed) && $answer->multilogin_installed === 'true');
        if (!$this->bots->save()) {
            $errors = VarDumper::dumpAsString($this->bots->getErrors());
        } else {
            $errors = '';
        }
        $this->response = "Success: " . (empty($answer->succeed) ? 'FALSE' : 'TRUE') . ", {$addi}"
            . (empty($errors) ? '' : ", errors Bot save: {$errors}");
        $this->save();
    }

    private function proceduresForCheckIniData()
    {
        $answer = json_decode($this->response);
        $this->status = empty($answer->succeed) ? 3 : 2;
        $this->response = $answer->answer;
        $this->save();
    }

    private function proceduresForRegister()
    {
        $answer = json_decode($this->response);
        list($ab, $fg, $existingBk) = $this->retrieveAndCheck();
        /**
         * @var BotsBks $existingBk
         * @var AccountBookmaker $ab
         */
        $existingBk->login = $answer->login;
        $existingBk->password = $answer->password;
        if (!empty($answer->comment)) {
            $existingBk->comment = (!empty($existingBk->comment) ? "{$existingBk->comment}, " : '') . "reger: {$answer->comment}";
        }
        if (!$existingBk->save()) {
            $this->addError('existingBk', $existingBk->errors);
        }
        // Hint: We must update the extension to renew settings
        $bq = new BotsQueue();
        $bq->bots_id = $this->bots_id;
        $bq->action = 'UPDATE_EXTENSION';
        $bq->status = 0;
        if (!$bq->save()) {
            $this->addError('BotsQueue save', var_export($bq->errors, true));
        }
        $data = json_decode($this->data);
        if (!empty($data->mothers_maiden_name) && !empty($data->mothers_maiden_name_en)) {
            $ab->comment = "{$ab->comment} {$data->mothers_maiden_name} ({$data->mothers_maiden_name_en})";
        }
        $ab->comment = "{$ab->comment}{$answer->comment}";
        $ab->bm_login = $answer->login;
        $ab->bm_password = $answer->password;
        if (!$ab->save()) {
            $this->addError('AccountBookmaker save', var_export($ab->errors, true));
        }
        return count($this->errors) === 0;
    }

    private static function debug($msg, $log = 'finals')
    {
        if (self::$debug) {
            file_put_contents(\Yii::getAlias("@runtime/logs/{$log}.log"), "{$msg}\n", FILE_APPEND);
        }
    }

}
