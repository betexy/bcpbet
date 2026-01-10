<?php

namespace app\modules\PaySystems\helpers;

use app\modules\BotManager\models\SettingsForm;
use app\modules\PaySystems\models\History;
use app\modules\PaySystems\models\Wallets;
use Yii;
use yii\base\Exception;
use Binance\API;
use yii\helpers\VarDumper;

class CryptoHelper
{

    private static $debug = true;
    private static $apiKey = "wfjbngxjeskwg8sgsg4co04484408w04c8g0g0kk8ow04gwoos8g4s8wcwgcwkoc";
    private static $apiUrl = "https://eu.bsc.chaingateway.io/v1/";
    private static $usdt = "0x55d398326f99059ff775485246999027b3197955";

    /**
     * @throws Exception
     */
    public static function createAddress(Wallets $wallet)
    {
        $password = Yii::$app->getSecurity()->generateRandomString();
        $res = self::apiRequest('newAddress', ['password' => $password]);
        $address = $res["binancecoinaddress"];
        if (empty($address)) {
            throw new Exception("Error while create address: " . print_r($res, true));
        }
        $wallet->withdrawal_address = $address;
        $wallet->withdrawal_balance_bnb = "0";
        $wallet->withdrawal_balance_usdt = "0";
        $wallet->chg_password = $password;
        if (!$wallet->save()) {
            throw new Exception("Error while saving wallet: " . print_r($wallet->getErrors(), true));
        }
    }

    /**
     * @throws Exception
     */
    public static function getBalances(Wallets $wallet)
    {
        $dataBNB = [
            "binancecoinaddress" => $wallet->withdrawal_address,
            "apikey" => self::$apiKey,
        ];
        $resBNB = self::apiRequest('getBinancecoinBalance', $dataBNB, true);
        $dataUSDT = [
            "contractaddress" => self::$usdt,
            "binancecoinaddress" => $wallet->withdrawal_address,
            "apikey" => self::$apiKey,
        ];
        $resUSDT = self::apiRequest('getTokenBalance', $dataUSDT, true);
        $wallet->withdrawal_balance_usdt = $resUSDT['balance'];
        $wallet->withdrawal_balance_bnb = $resBNB['balance'];
        if (!$wallet->save()) {
            throw new Exception("Error while saving wallet: " . print_r($wallet->getErrors(), true));
        }
    }

    /**
     * @throws Exception
     */
    public static function sendMoney(Wallets $model, $address, $amount, $currency)
    {
        if (!in_array($currency, ['BNB', 'USDT'])) {
            throw new Exception("Unsupported currency: " . $currency);
        }
        $settings = new SettingsForm();
        $settings->loadData();
        $data = [
            "from" => $model->withdrawal_address,
            "to" => $address,
            "password" => $model->chg_password,
            "amount" => $amount,
            "apikey" => self::$apiKey,
            "gas" => $settings->gaz,
            "gasprice" => $settings->gaz_price,
        ];
        self::debug("=============================================================================");
        self::debug("-----------------------------------------------------------------------------");
        self::debug("Send money, data:\n" . VarDumper::dumpAsString($data));
        $endpoint = '';
        if ($currency === 'BNB') {
            $endpoint = 'sendBinancecoin';
            // Response:
            // {"ok": true,
            // "txid": "0xcff06775098019d18f7bab6a350c18e86f89399d b63cbce5269104e6c9a79499",
            // "from": "0xa1f36016221d48ce7f15cde7b826a4fbe09bacce",
            // "to": "0xef4943d727e34280a2efa0b3352dfd61f508ee48",
            // "amount": "0.05"}
        } elseif ($currency === 'USDT') {
            $endpoint = 'sendToken';
            $data["contractaddress"] = self::$usdt;
            // Response:
            // {"ok": true,
            // "txid": "0xcff06775098019d18f7bab6a350c18e86f89399d b63cbce5269104e6c9a79499",
            // "contractaddress": "0x5b86a33f0c232fe909eb4602a9d039072869d915",
            // "from": "0xa1f36016221d48ce7f15cde7b826a4fbe09bacce",
            // "to": "0xef4943d727e34280a2efa0b3352dfd61f508ee48",
            // "amount": "0.05"}
        }
        $res = self::apiRequest($endpoint, $data, true);
        if (!empty($res['ok']) && $res['ok'] === true && !empty($res['txid'])) {
            self::getBalances($model);
            return $res['txid'];
        } else {
            throw new Exception("Error while sending: " . print_r($res, true));
        }
    }

    public static function sendFromBNBSourceWallet($receiver, $amount, $currency = ''): array
    {
        $settings = new SettingsForm();
        $settings->loadData();
        $source = Wallets::findOne($settings['bnb_source_wallet_id']);
        if (empty($source)) {
            return ['success' => false, 'message' => 'Source wallet not found: ' . $settings['bnb_source_wallet_id']];
        }
        try {
            $res = CryptoHelper::sendMoney($source, $receiver, $amount, $currency);
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
        return ['success' => true, 'message' => $res];
    }

    public static function sendFromBinance($receiver, $amount, $currency = -1, $paySystem = -1): array
    {
        $settings = new SettingsForm();
        $settings->loadData();
        $history = new History();
        $history->datetime = time();
        $history->datetime_string = date('Y-m-d H:i:s');
        $history->currency = $currency > -1 ? $currency : $settings['default_currency'];
        $history->ps_paysystems_id = $paySystem > -1 ? $paySystem : $settings['default_pay_system'];
        $history->receiver = $receiver;
        $history->amount = $amount;
        // Hint: it should call binanceWithdrawal() method
        if (!$history->save()) {
            return ['success' => false, 'message' => "Save errors: " . var_export($history->getErrors(), true)];
        }
        $success = strpos($history->comment, 'ERROR:') === false;
        return ['success' => $success, 'message' => $success ? "History id: {$history->id}}" : $history->comment];
    }

    public static function sendToWithdrawalAddress(Wallets $model, $amount): array
    {
        $settings = new SettingsForm();
        $settings->loadData();
        try {
            self::debug("sendToWithdrawalAddress, model: {$model->id}, amount: {$amount}");
            $r = self::sendMoney($model, $settings->withdrawal_address, $amount, 'USDT');
            return ['success' => true, 'message' => "sendToBinance Transaction id: {$r}"];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public static function binanceWithdrawal(History $history, $cron = false): array
    {
        self::debug("binanceWithdrawal, history: {$history->id}, cron: {$cron}");
        $settings = new SettingsForm();
        $settings->loadData();
        $errors = [];
        $additions = [];
        $response = [];
        $tech = [];
        if (empty($history->paysystems) || $history->paysystems->type !== 5 || empty($history->paysystems->additions)) {
            $errors[] = 'Wrong pay system or empty API keys!';
        } else {
            $additions = json_decode($history->paysystems->additions, true);
            if (empty($additions['apiKey']) || strlen($additions['apiKey']) !== 64) {
                $errors[] = "Wrong API key!";
            }
            if (empty($additions['secretKey']) || strlen($additions['secretKey']) !== 64) {
                $errors[] = "Wrong secret key!";
            }
        }
        if ((float)$settings->max_amount < (float)$history->amount) {
            $errors[] = "Amount is too big {$history->amount} > {$settings->max_amount}!";
        }
        if ($cron && !empty($settings->only_existing_wallets)) {
            $wallet = Wallets::findOne($history->receiver);
            if (empty($wallet)) {
                $errors[] = "Wallet not found!";
            }
            if (!empty($wallet) && empty($wallet->approved)) {
                $errors[] = "Wallet not approved!";
            }
        }
        if (empty($errors)) {
            $api = new API($additions['apiKey'], $additions['secretKey']);
            $tech['asset'] = History::$currencies[$history->currency];
            $tech['address'] = $history->receiver;
            $tech['amount'] = $history->amount;
            if (in_array($history->currency, [3, 4, 5,])) {
                $tech['network'] = "BSC";
            }
            self::debug("binanceWithdrawal ({$history->currency}) tech:\n" . VarDumper::dumpAsString($tech));
            try {
                $response = $api->withdraw($tech['asset'], $tech['address'], $tech['amount'], null,
                    "", false, $tech['network'] ?? null);
                self::debug("response:\n" . VarDumper::dumpAsString($response));
            } catch (\Exception $e) {
                $errors[] = $e->getMessage();
                //self::debug("error:\n" . VarDumper::dumpAsString($e));
                self::debug("error message:\n" . VarDumper::dumpAsString($e->getMessage()));
            }
        }
        return [
            'success' => empty($errors),
            'message' => empty($errors) ? PaySystemsHelper::cleanExport($response) : implode('; ', $errors),
            'sender' => 'Binance',
            'datetime' => time(),
            'datetime_string' => date('Y-m-d H:i:s') . ': ' . (empty($errors) ? 'Success' : 'Error'),
            'tech' => PaySystemsHelper::cleanExport($tech),
        ];
    }

    /**
     * @throws Exception
     */
    private static function apiRequest($endpoint, $data, $noApiKey = false)
    {
        $ch = curl_init(self::$apiUrl . $endpoint);

        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        $params = [
            "Content-Type:application/json",
        ];
        if (!$noApiKey) {
            $params[] = "Authorization: " . self::$apiKey;
        }
        self::debug('=============================================================================');
        self::debug("apiRequest to {$endpoint} ({$noApiKey}) \n" .
            "params:\n" . print_r($params, true) . "\n" .
            "data:\n" . print_r($data, true)
        );

        curl_setopt($ch, CURLOPT_HTTPHEADER, $params);

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, FALSE);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, FALSE);

        $result = curl_exec($ch);

        if (curl_errno($ch)) {
            $error_msg = curl_error($ch);
            if ($error_msg !== '') {
                $msg = "Error while requesting {$endpoint}: {$error_msg}";
                self::debug($msg);
                throw new Exception($msg);
            }
        }

        self::debug("Result:\n" . print_r($result, true));

        curl_close($ch);

        return json_decode($result, true);
    }

    private static function debug($msg)
    {
        if (self::$debug) {
            file_put_contents(\Yii::getAlias('@runtime/logs/CryptoHelper.log'), "{$msg}\n", FILE_APPEND);
        }
    }

}
