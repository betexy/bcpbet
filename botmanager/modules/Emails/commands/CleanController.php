<?php

namespace app\modules\Emails\commands;

use app\modules\BotManager\Helpers\ProxyHelper;
use app\modules\BotManager\models\FillingOptions;
use app\modules\Emails\models\Mailboxes;
use Yii;
use yii\console\Controller;
use yii\db\Exception;
use yii\db\StaleObjectException;
use yii\helpers\BaseConsole;
use yii\helpers\VarDumper;

class CleanController extends Controller
{

    /**
     * @throws StaleObjectException
     * @throws \Throwable
     */
    public function actionIndex()
    {
        $excludeFilename = dirname(__FILE__) . '/exclude.txt';
        $exclude = file_exists($excludeFilename)
            ? array_map(function ($c) {
                return trim($c);
            }, explode(PHP_EOL, file_get_contents($excludeFilename)))
            : [];
        $this->stdout("It will delete almost all emails instead of:" . PHP_EOL,
            BaseConsole::BOLD, BaseConsole::FG_RED);
        echo (empty($exclude) ? 'nothing' : '"' . implode(PHP_EOL, $exclude)) . PHP_EOL;
        if (!$this->confirm('Are you sure you want to proceed?')) {
            return;
        }
        $mailboxes = Mailboxes::find()->all();
        foreach ($mailboxes as $mailbox) {
            if (!in_array($mailbox->address, $exclude)) {
                $mailbox->delete();
                $this->stdout("Mailbox {$mailbox->address} deleted" . PHP_EOL, BaseConsole::FG_BLUE);
            } else {
                $this->stdout("Mailbox {$mailbox->address} skipped" . PHP_EOL, BaseConsole::FG_YELLOW);
            }
        }
    }

    public function actionTest()
    {
        $sql = 'SELECT m.id FROM e_mailboxes m LEFT JOIN stake_accounts s ON s.mailboxes_id = m.id '
            . 'WHERE m.deleted_at IS NULL AND (m.do_not_use IS NULL OR m.do_not_use = 0) AND s.name IS NULL '
            . 'ORDER BY RAND() LIMIT 1';
        try {
            $res = Yii::$app->getDb()->createCommand($sql)->query()->read();
            echo str_repeat('-', 80) . PHP_EOL;
            var_dump($res);
            echo PHP_EOL;
            $final = !empty($res) ? Mailboxes::findOne(array_shift($res)) : null;
            echo str_repeat('-', 80) . PHP_EOL;
            var_dump("{$final->id} => {$final->address}");
            echo PHP_EOL;
        } catch (Exception $e) {
            echo str_repeat('-', 80) . PHP_EOL;
            var_dump($e);
            echo PHP_EOL;
            return null;
        }
    }

    /**
     * @throws Exception
     */
    public function actionTestTwo()
    {
        $this->stdout("Test" . PHP_EOL, BaseConsole::BOLD, BaseConsole::FG_GREY);
        $countryCity = FillingOptions::getRandom('country_city');
        $this->stdout("Country and city: {$countryCity}" . PHP_EOL, BaseConsole::BOLD, BaseConsole::FG_YELLOW);
    }

}
