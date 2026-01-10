<?php

namespace app\modules\PaySystems\commands;

use app\modules\BotManager\Helpers\LockHelper;
use app\modules\PaySystems\helpers\PaySystemsHelper;
use yii\console\Controller;

class BinanceController extends Controller
{
    public function actionIndex()
    {

        //$start = microtime(true);
        //$r = time() . ": Binance queue processing started" . PHP_EOL;
        sleep(mt_rand(11, 30));
        try {
            PaySystemsHelper::proceedBinanceQueue();
        } catch (\Exception $e) {
            file_put_contents(\Yii::getAlias('@runtime/logs/binance-index.log'),
                date('Y-m-d H:i:s') . ' ' . $e->getMessage() . PHP_EOL, FILE_APPEND);
        }
        //$r .= time() . ": Binance queue processing finished in " . (microtime(true) - $start) . 's' . PHP_EOL;
        //file_put_contents(\Yii::getAlias('@runtime/logs/binance.log'), $r, FILE_APPEND);
    }

    public function actionBalances()
    {
        $start = microtime(true);
        //$r = time().": Check balance queue processing started" . PHP_EOL;
        $willSleep = mt_rand(11, 30);
        echo "Will sleep: $willSleep\n";
        sleep($willSleep);
        try {
            PaySystemsHelper::proceedCheckBalance();
        } catch (\Exception $e) {
            file_put_contents(\Yii::getAlias('@runtime/logs/binance-balance.log'),
                date('Y-m-d H:i:s') . ' ' . $e->getMessage() . PHP_EOL, FILE_APPEND);
        }
        echo "Finished in: " . (microtime(true) - $start) . 's' . PHP_EOL;
        //$r .= time().": Check balance processing finished in " . (microtime(true) - $start) . 's' . PHP_EOL;
        //file_put_contents(\Yii::getAlias('@runtime/logs/balance.log'), $r, FILE_APPEND);
    }

}
