<?php

namespace app\modules\BotManager\Helpers;

use app\modules\BotManager\models\Proxies;
use yii\helpers\VarDumper;

class LockHelper
{


    // singleton template
    private static $instance = null;

    private function __construct()
    {

    }

    public static function getInstance(): ?LockHelper
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function lock($name): bool
    {
        $lock = Proxies::find()->where(['name' => $name . '_lock', 'protocol' => 'LOCK', 'deleted' => 1])->one();
        if (!empty($lock)) {
            return false;
        }
        $freeLock = Proxies::find()->where(['name' => $name . '_lock', 'deleted' => 1])->one();
        if (!empty($freeLock)) {
            $freeLock->protocol = 'LOCK';
            if (!$freeLock->save()) {
                file_put_contents(\Yii::getAlias('@runtime/logs/LockHelper.log'),
                    date('Y-m-d H:i:s') . ' lock save 1:' . PHP_EOL
                    . var_export($freeLock->getErrors(), true) . PHP_EOL, FILE_APPEND);
                return false;
            }
        } else {
            $proxy = new Proxies();
            $proxy->name = $name . '_lock';
            $proxy->protocol = 'LOCK';
            $proxy->host = '123';
            $proxy->port = 123;
            $proxy->country = '123';
            $proxy->deleted = 1;
            if (!$proxy->save()) {
                file_put_contents(\Yii::getAlias('@runtime/logs/LockHelper.log'),
                    date('Y-m-d H:i:s') . ' lock save 2:' . PHP_EOL
                    . var_export($proxy->getErrors(), true) . PHP_EOL, FILE_APPEND);
                return false;
            }
        }
        return true;
    }

    public function unlock($name)
    {
        $lock = Proxies::find()->where(['name' => $name . '_lock', 'protocol' => 'LOCK', 'deleted' => 1])->one();
        if (!empty($lock)) {
            $lock->protocol = 'UNLOCK';
            if (!$lock->save()) {
                file_put_contents(\Yii::getAlias('@runtime/logs/LockHelper.log'),
                    date('Y-m-d H:i:s') . ' unlock save:' . PHP_EOL
                    . var_export($lock->getErrors(), true) . PHP_EOL, FILE_APPEND);
            }
        }
    }

    public function getStats(): array
    {
        $loadLastLines = function ($filename, $count = 2) {
            if (!file_exists($filename) || filesize($filename) === 0) {
                return false;
            }
            $fp = fopen($filename, 'r');
            if (!$fp) {
                return false;
            }
            $lines = [];
            $pos = -1;
            $buf = '';
            fseek($fp, 0, SEEK_END);
            $size = ftell($fp);
            while (count($lines) < $count && abs($pos) <= $size) {
                fseek($fp, $pos, SEEK_END);
                $ch = fgetc($fp);
                if ($ch === "\n" && $buf !== '') {
                    array_unshift($lines, trim($buf));
                    $buf = '';
                } else {
                    $buf = $ch . $buf;
                }
                $pos--;
            }
            if ($buf !== '' && count($lines) < $count) {
                array_unshift($lines, trim($buf));
            }
            fclose($fp);
            return array_values(array_filter($lines, fn($l) => $l !== ''));
        };
        $linesAll = [
            'stake' => $loadLastLines(\Yii::getAlias('@runtime/logs/StakeController.log')),
            'balance' => $loadLastLines(\Yii::getAlias('@runtime/logs/proceedCheckBalance.log')),
            'payments' => $loadLastLines(\Yii::getAlias('@runtime/logs/proceedBinanceQueue.log')),
        ];
        $res = [];
        foreach ($linesAll as $key => $lines) {
            if (empty($lines) || !is_array($lines)) {
                $res[] = "<strong>{$key}</strong> -> was no requests";
            } else {
                $res[] = "<strong>{$key}</strong> -> " . $this->getLast($lines);
            }
        }
        return $res;
    }

    private function getLast($lines): string
    {
        $formatter = \Yii::$app->formatter;
        $getDateTime = function ($line) {
            // 2023-04-19 19:50:00
            preg_match('/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/', $line, $matches);
            if (!empty($matches[0])) {
                return \DateTime::createFromFormat('Y-m-d H:i:s', $matches[0]);
            } else {
                return null;
            }
        };
        $res = 'empty';
        if (count($lines) > 1) {
            $last = $lines[count($lines) - 1];
            $prev = $lines[count($lines) - 2];
            $dtLast = $getDateTime($last);
            $dtPrev = $getDateTime($prev);
            if ($dtLast !== null) {
                $res = 'last request was ' . $formatter->asRelativeTime($dtLast);
                if ($dtPrev !== null) {
                    $res .= ', interval was <strong>' . $formatter->asDuration($dtPrev->diff($dtLast)) . '</strong>';
                } else {
                    $res .= ', interval unknown!';
                }
            } else {
                $res = 'last line has no date';
            }
        } elseif (count($lines) === 1) {
            $dt = $getDateTime($lines[0]);
            $res = $dt !== null
                ? 'last request was ' . $formatter->asRelativeTime($dt) . ', interval unknown!'
                : 'last line has no date';
        }
        return $res;
    }
}
