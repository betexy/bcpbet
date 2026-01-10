<?php

namespace app\modules\BotManager\commands;

use app\modules\BotManager\Helpers\LockHelper;
use app\modules\BotManager\Helpers\ProxyHelper;
use app\modules\BotManager\models\SettingsForm;
use app\modules\BotManager\models\StakeAccounts;
use app\modules\BotManager\models\StakeAccountsCreateForm;
use app\modules\Emails\helpers\MailHelper;
use yii\console\Controller;
use yii\db\Exception;
use yii\helpers\BaseConsole;
use yii\helpers\VarDumper;

class StakeController extends Controller
{

    private $settings;

    /**
     * @throws Exception
     */
    public function __construct($id, $module, $config = [])
    {
        parent::__construct($id, $module, $config);
        $this->settings = SettingsForm::get();
        $this->settings->loadData();
        $this->stdout("Settings should be loaded ({$this->settings->proxy_api_key})!" . PHP_EOL,
            BaseConsole::BOLD, BaseConsole::FG_CYAN);
    }

    public function actionIndex()
    {
        $sleep = YII_DEBUG ? 1 : mt_rand(11, 30);
        $this->stdout("Sleeping for {$sleep} seconds" . PHP_EOL, BaseConsole::FG_GREY);
        sleep($sleep);
        try {
            if (!empty($this->settings->proxy_api_key)) {
                $this->stdout("before buyProxy" . PHP_EOL, BaseConsole::FG_GREY);
                $this->buyProxy();
                file_put_contents(\Yii::getAlias('@runtime/logs/StakeController.log'),
                    date('Y-m-d H:i:s') . " Proxy API key is fine!!" . PHP_EOL, FILE_APPEND);
            } else {
                file_put_contents(\Yii::getAlias('@runtime/logs/StakeController.log'),
                    date('Y-m-d H:i:s') . " Proxy API key is empty!" . PHP_EOL, FILE_APPEND);
            }
            if (!empty($this->settings->betexy_login)) {
                $this->stdout("before betexyProxy" . PHP_EOL, BaseConsole::FG_GREY);
                $this->betexyProxy();
                $this->stdout("before betexyAccount" . PHP_EOL, BaseConsole::FG_GREY);
                $this->betexyAccount();
                $this->stdout("before betexyStart" . PHP_EOL, BaseConsole::FG_GREY);
                $this->betexyStart();
            }
        } catch (\Exception $e) {
            file_put_contents(\Yii::getAlias('@runtime/logs/stake-index.log'),
                date('Y-m-d H:i:s') . ' ' . $e->getMessage() . PHP_EOL, FILE_APPEND);
        }
    }

    /**
     * @return void
     * @throws Exception
     */
    private function betexyStart()
    {
        $stakeAccount = StakeAccounts::find()
            ->joinWith('proxy')
            ->where(['and',
                ['not', ['stake_accounts.registered_at' => null]],
                ['not', ['stake_accounts.betexy_id' => null]],
                ['not', ['stake_accounts.proxies_id' => null]],
                ['not', ['stake_accounts.mailboxes_id' => null]],
                ['not', ['proxies.betexy_id' => null]],
                ['stake_accounts.last_start_at' => null],
            ])
            ->limit(1)
            ->one();
        if (!$this->ensureMailbox($stakeAccount)) {
            return;
        }
        if (empty($stakeAccount)) {
            $this->stdout("We don't need start accounts" . PHP_EOL, BaseConsole::FG_BLACK);
            return;
        }
        $this->startAccount($stakeAccount);
    }

    /**
     * @throws Exception
     */
    private function betexyAccount()
    {
        $stakeAccount = StakeAccounts::find()
            ->joinWith('proxy')
            ->where(['and',
                ['stake_accounts.registered_at' => null],
                ['stake_accounts.betexy_id' => null],
                ['not', ['stake_accounts.proxies_id' => null]],
                ['not', ['stake_accounts.mailboxes_id' => null]],
                ['not', ['proxies.betexy_id' => null]],
            ])
            ->limit(1)
            ->one();
        if (!$this->ensureMailbox($stakeAccount)) {
            return;
        }
        if (empty($stakeAccount)) {
            $this->stdout("We don't need save accounts to Betexy" . PHP_EOL, BaseConsole::FG_BLACK);
            return;
        }
        $this->storeAccountToBetexy($stakeAccount);
    }

    /**
     * @throws Exception
     */
    private function betexyProxy()
    {
        $stakeAccount = StakeAccounts::find()
            ->joinWith('proxy')
            ->where(['and',
                ['stake_accounts.registered_at' => null],
                ['not', ['stake_accounts.proxies_id' => null]],
                ['not', ['stake_accounts.mailboxes_id' => null]],
                ['proxies.betexy_id' => null],
            ])
            ->limit(1)
            ->one();
        if (!$this->ensureMailbox($stakeAccount)) {
            return;
        }
        if (empty($stakeAccount)) {
            $this->stdout("We don't need save proxies to Betexy" . PHP_EOL, BaseConsole::FG_BLACK);
            return;
        }
        $this->storeProxyToBetexy($stakeAccount);
    }

    /**
     * @param StakeAccounts $acc
     * @return bool
     */
    private function ensureMailbox(StakeAccounts $acc): bool
    {
        if ($acc->mailbox->ready_checked_at < time() - 43200) {
            $this->stdout("Mailbox {$acc->mailbox->id} is not ready, let's check!" . PHP_EOL, BaseConsole::FG_BLACK);
            try {
                $checkResult = MailHelper::checkMail($acc->mailbox);
            } catch (\Exception $e) {
                $mess = "Mailbox {$acc->mailbox->id} check error: " . $e->getMessage();
                $checkResult = ['success' => false, 'message' => $mess];
                $this->stdout($mess . PHP_EOL, BaseConsole::FG_RED);
            }
            if (!empty($checkResult['success'])) {
                $this->stdout("Mailbox {$acc->mailbox->id} check success!" . PHP_EOL, BaseConsole::FG_GREEN);
                $acc->mailbox->ready_checked_at = time();
                $acc->mailbox->save();
                return true;
            } else {
                // Set mailbox as invalid
                $acc->mailbox->do_not_use = 1;
                $acc->mailbox->comment .= " invalid: {$checkResult['message']}";
                $acc->mailbox->save();
                // Try to link another mailbox
                $email = StakeAccountsCreateForm::getEmail();
                if (empty($email)) {
                    $this->setBad($acc, "Previous mailbox invalid: {$checkResult['message']} and there "
                        . 'are no email addresses without linked stake account!');
                    return false;
                } else {
                    try {
                        $acc->changeEmail($email);
                    } catch (\Exception $e) {
                        $this->setBad($acc, "Previous mailbox invalid: {$checkResult['message']} and "
                            . "can't link new mailbox: {$e->getMessage()}");
                        return false;
                    }
                    return $this->ensureMailbox($acc);
                }
            }
        } else {
            $this->stdout("Mailbox {$acc->mailbox->id}, ready: {$acc->mailbox->ready_checked_at} >= "
                . (time() - 43200) . PHP_EOL, BaseConsole::FG_GREEN, BaseConsole::BG_BLACK);
            return true;
        }
    }

    /**
     * @throws Exception
     */
    private function buyProxy()
    {
        // 1. Get first not registered stake accounts and check it has no proxy but has mailbox
        $stakeAccount = StakeAccounts::find()
            ->where(['and',
                ['registered_at' => null],
                ['proxies_id' => null],
                ['not', ['mailboxes_id' => null]],
            ])
            ->limit(1)
            ->one();
        if (empty($stakeAccount)) {
            $this->stdout("We don't need buy proxy" . PHP_EOL, BaseConsole::FG_BLACK);
            return;
        }
        $this->stdout("-= We got account: {$stakeAccount->id} and mailbox {$stakeAccount->mailbox->id} =-"
            . PHP_EOL, BaseConsole::FG_BLACK, BaseConsole::BG_CYAN);
        if (!$this->ensureMailbox($stakeAccount)) {
            return;
        }
        $this->stdout("Let's buy proxy for account: #{$stakeAccount->id} {$stakeAccount->name}" . PHP_EOL,
            BaseConsole::BOLD, BaseConsole::FG_BLACK);
        try {
            $register = $stakeAccount->getRegister();
        } catch (\Exception $e) {
            $this->saveError("Error during getRegister: ", $stakeAccount, $e);
        }
        // 1.1. Get proxy if exists
        $existingProxy = ProxyHelper::get()->getFreeProxyByCountry($register['country']);
        if (empty($existingProxy)) {
            // 2. If there is no proxy - buy it
            echo print_r($register, true) . PHP_EOL;
            try {
                $proxy = ProxyHelper::get()->buyProxy($register['country']);
                echo "registered_at: " . date('Y-m-d H:i:s', $proxy->registered_at) . PHP_EOL;
                echo "finish_at: " . date('Y-m-d H:i:s', $proxy->finish_at) . PHP_EOL;
            } catch (\Exception $e) {
                $this->saveError("Can't buy proxy: ", $stakeAccount, $e);
            }
        } else {
            $proxy = $existingProxy;
        }
        // 3. Set proxy to stake account
        $stakeAccount->proxies_id = $proxy->id;
        if (!$stakeAccount->save()) {
            throw new Exception("Can't save stake account: " . VarDumper::dumpAsString($stakeAccount->getErrors()));
        } else {
            $this->stdout("We bought proxy, id is: {$stakeAccount->proxies_id}!" . PHP_EOL,
                BaseConsole::BOLD, BaseConsole::FG_GREEN);
            // 4. Store proxy in Betexy
            $this->storeProxyToBetexy($stakeAccount);
        }
    }

    /**
     * @throws Exception
     */
    private function storeProxyToBetexy(StakeAccounts $stakeAccount)
    {
        $this->stdout("Let's store proxy in Betexy: #{$stakeAccount->proxies_id} {$stakeAccount->proxy->name}"
            . PHP_EOL, BaseConsole::BOLD, BaseConsole::FG_BLACK);
        try {
            $betexy = ProxyHelper::get()->postToBetexy($stakeAccount);
            if ($betexy['status'] === 'error' || $betexy['id'] === -1) {
                throw new Exception("Can't store proxy in betexy: " . $betexy['message']);
            }
            $this->stdout("We saved proxy, our ID: {$stakeAccount->proxies_id} in betexy with ID: {$betexy['id']}!" . PHP_EOL,
                BaseConsole::BOLD, BaseConsole::FG_GREEN);
            $stakeAccount->proxy->betexy_id = $betexy['id'];
            if (!$stakeAccount->proxy->save()) {
                throw new Exception("Can't save proxy: " . VarDumper::dumpAsString($stakeAccount->getErrors()));
            } else {
                $this->stdout("We save proxy successfully!" . PHP_EOL,
                    BaseConsole::BOLD, BaseConsole::FG_GREEN);
                $this->storeAccountToBetexy($stakeAccount);
            }
        } catch (\Exception $e) {
            $this->saveError("Can't add proxy to betexy: ", $stakeAccount, $e);
        }
    }

    /**
     * @throws Exception
     */
    private function storeAccountToBetexy(StakeAccounts $stakeAccount)
    {
        $this->stdout("Let's store account in Betexy: #{$stakeAccount->id} {$stakeAccount->name}"
            . PHP_EOL, BaseConsole::BOLD, BaseConsole::FG_BLACK);
        try {
            $betexy = ProxyHelper::get()->postAccountToBetexy($stakeAccount);
            if ($betexy['status'] === 'error' || $betexy['id'] === -1) {
                throw new Exception("Can't store account in betexy: " . $betexy['message']);
            }
            $this->stdout("We saved account, our ID: {$stakeAccount->id} in betexy with ID: {$betexy['id']}!" . PHP_EOL,
                BaseConsole::BOLD, BaseConsole::FG_GREEN);
            $stakeAccount->betexy_id = $betexy['id'];
            $stakeAccount->registered_at = time();
            if (!$stakeAccount->save()) {
                throw new Exception("Can't save account: " . VarDumper::dumpAsString($stakeAccount->getErrors()));
            } else {
                $this->stdout("We save account successfully!" . PHP_EOL,
                    BaseConsole::BOLD, BaseConsole::FG_GREEN);
                $this->startAccount($stakeAccount);
            }
        } catch (\Exception $e) {
            $this->saveError("Can't add account to betexy: ", $stakeAccount, $e);
        }
    }

    private function startAccount(StakeAccounts $stakeAccount)
    {
        $this->stdout("Let's start account, our ID: {$stakeAccount->id}, betexy ID: {$stakeAccount->betexy_id}!" . PHP_EOL,
            BaseConsole::BOLD, BaseConsole::FG_BLACK);
        try {
            $betexy = ProxyHelper::get()->startAccount($stakeAccount);
            if ($betexy['status'] === 'error' || $betexy['id'] === -1) {
                throw new Exception("Can't start account: " . $betexy['message']);
            }
            $this->stdout("Account {$stakeAccount->id}/{$betexy['id']} should be started!" . PHP_EOL,
                BaseConsole::BOLD, BaseConsole::FG_GREEN);
            $stakeAccount->last_start_at = time();
            if (!$stakeAccount->save()) {
                throw new Exception("Can't save account: " . VarDumper::dumpAsString($stakeAccount->getErrors()));
            } else {
                $this->stdout("We save account (start) successfully!" . PHP_EOL,
                    BaseConsole::BOLD, BaseConsole::FG_GREEN);
            }
        } catch (\Exception $e) {
            $this->saveError("Can't start account: ", $stakeAccount, $e);
        }
    }

    private function setBad(StakeAccounts $stakeAccount, $error)
    {
        $stakeAccount->registered_at = time();
        $stakeAccount->comment .= " {$error}";
        $stakeAccount->save();
    }

    /**
     * @throws Exception
     */
    private function saveError($stage, StakeAccounts $stakeAccount, \Exception $e)
    {
        $error = $stage . $e->getMessage();
        $this->setBad($stakeAccount, $error);
        throw new Exception($error);
    }

}
