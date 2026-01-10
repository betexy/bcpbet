<?php

namespace app\modules\SimsManager\commands;

use Yii;
use yii\console\Controller;

use app\modules\SimsManager\helpers\SimsHelper;

class RequestsController extends Controller
{

    public function actionIndex()
    {
        $time = microtime(true);
        $interval = 60 / Yii::$app->controller->module->requestsPerMinute;
        $check = 60 - $interval;
        //echo "{$interval} / {$check}\r\n";
        do {
            $current = $this->runRequest('requestSmses');
            sleep(self::cs($interval, $current));
            $spent = (microtime(true) - $time);
            //echo "Currently: {$current}, total: {$spent}\r\n";
        } while ($spent < $check);
        //echo 'Done in ' . (microtime(true) - $time) . "s\r\n";
        //file_put_contents(dirname(__FILE__) . '/../../../crontest.log', date('Y-m-d H:i:s')
        //    . " : requests done in " . (microtime(true) - $time) . "s\n\r", FILE_APPEND);
    }

    public function actionBindPerMinute()
    {
        $time = microtime(true);
        do {
            $current = $this->runRequest('requestBound');
            sleep(self::cs(28, $current));
            $spent = (microtime(true) - $time);
            //echo "Currently: {$current}, total: {$spent}\r\n";
        } while ($spent < 30);
        //echo 'Done in ' . (microtime(true) - $time) . "s\r\n";
        //file_put_contents(dirname(__FILE__) . '/../../../crontest.log', date('Y-m-d H:i:s')
        //    . " : requests/bind-per-minute done in " . (microtime(true) - $time) . "s\n\r", FILE_APPEND);
    }

    private function runRequest($requestName)
    {
        $time = microtime(true);
        try {
            SimsHelper::$requestName();
        } catch (\Exception $e) {
            echo "Error: {$e->getMessage()}\r\n";
        }
        return microtime(true) - $time;
    }

    private static function cs($interval, $current)
    {
        $res = (int)floor($interval - $current);
        return $res < 0 ? 0 : $res;
    }

}