<?php

namespace app\modules\BotManager\commands;

use Yii;
use app\modules\BotManager\models\Report;
use yii\console\Controller;
use yii\helpers\Console;
use yii\helpers\VarDumper;

class ReportsController extends Controller
{
    public function actionIndex($limit = 10000, $echoInterval = 2000)
    {
        $this->rollUp($limit, $echoInterval);
    }

    public function actionRecognize($limit = 10000, $echoInterval = 2000)
    {
        $this->rollUp($limit, $echoInterval, 'recognizeCategory', false);
    }

    public function actionParse($limit = 10000, $echoInterval = 2000)
    {
        $this->rollUp($limit, $echoInterval, 'parseAnswer', false);
    }

    private function rollUp($limit, int $echoInterval, $function = 'both', $notParsed = true)
    {
        $time = microtime(true);
        $i = 0;
        while ($i < $limit) {
            set_time_limit($echoInterval / 1000 + 20);
            $stepIterator = 0;
            $offset = $echoInterval * floor($i / $echoInterval);
            $iterationStarted = microtime(true);
            $reports = Report::find()
                ->limit($echoInterval);
            if ($notParsed) {
                $reports->where(['parsed' => 0]);
            } else {
                $reports->where(['>=', 'id', $offset]);
            }
            foreach ($reports->all() as $report) {
                if ($function === 'both') {
                    $report->parseAnswer();
                    $report->recognizeCategory();
                } else {
                    $report->$function();
                }
                if (!$report->save()) {
                    file_put_contents(dirname(__FILE__) . '/../../../report_errors.log',
                        VarDumper::dumpAsString($report->getErrors()) . " in\r\n" .
                        VarDumper::dumpAsString($report->getAttributes($report->fields())) . "\r\n",
                        FILE_APPEND);
                }
                $i++;
                $stepIterator++;
            }
            echo "{$offset} - {$i} (" . number_format($i / $limit * 100, 2) . " %) of {$limit} done in "
                . (microtime(true) - $iterationStarted) . "s\r\n";
            if ($stepIterator !== $echoInterval) {
                break;
            }
        }
        $this->stdout("All (${i}) done in " . (microtime(true) - $time) . "s\r\n",
            Console::BOLD, Console::FG_CYAN);
    }

}
