<?php

namespace app\modules\BotManager\commands;

use app\modules\BotManager\Helpers\YCHelper;
use app\modules\BotManager\models\RdpActivity;
use app\modules\BotManager\models\RdpCommands;
use Yii;
use yii\console\Controller;
use yii\db\Expression;
use yii\db\Query;
use yii\helpers\Console;
use yii\helpers\VarDumper;

class RdpController extends Controller
{
    public function actionIndex()
    {
        $query = [
            'and',
            ['rdp_activity.deleted' => 0],
            ['and',
                ['<=', 'last_activity', time() - 350],
                ['>=', 'last_activity', time() - 1800],
            ],
            ['or',
                ['last_login' => 0],
                ['<=', 'last_login', time() - 700]
            ],
            ['is not', 'rdp_table.name', new Expression('null')],
        ];
        $activities = RdpActivity::find()
            ->joinWith('table')
            ->where($query)
            ->orderBy(['last_activity' => SORT_DESC])
            ->limit(3)->all();
        /*
        var_dump(RdpActivity::find()
            ->joinWith('table')
            ->where($query)
            ->orderBy(['last_activity' => SORT_DESC])
            ->limit(3)->prepare(Yii::$app->db->queryBuilder)->createCommand()->rawSql);
         */
        foreach ($activities as $activity) {
            if (!empty($activity) && !empty($activity->table) && !empty($activity->table->name)) {
                RdpCommands::createLoginCommand($activity);
            } elseif (1 !== 1) {
                //echo "Empty table/name for {$activity->ip}\n";
                $query = ['and', ['like', 'command', 'rdp_scan'], ['>=', 'sent_at', time() - 3600]];
                //var_dump(RdpCommands::find()->where($query)->prepare(Yii::$app->db->queryBuilder)->createCommand()->rawSql);
                $lastScan = RdpCommands::find()->where($query)->one();
                if (empty($lastScan)) {
                    $command = new RdpCommands();
                    $command->command = json_encode(['action' => 'rdp_scan']);
                    $command->save();
                    file_put_contents(dirname(__FILE__) . '/../../../scans_add.log',
                        date('Y-m-d H:i:s') . ": Scan command added, cuz " . empty($lastScan) . "\r\n", FILE_APPEND);
                }
            }
        }
        // Removing command, what not sent in 10 minutes
        $deleteQuery = ['and', ['=', 'sent_at', 0], ['<=', 'created_at', time() - 3600]];
        RdpCommands::deleteAll($deleteQuery);
        self::restartServers();
    }

    public function actionTest()
    {
        $query = [
            'and',
            ['rdp_activity.deleted' => 0],
            ['<', 'last_activity', time() - 800],
            ['or',
                ['is', 'last_yc_reboot_attempt', new Expression('null')],
                ['<', 'last_yc_reboot_attempt', time() - 3600],
            ],
            ['is not', 'yc_id', new Expression('null')],
        ];
        var_dump(RdpActivity::find()
            ->joinWith('table')
            ->where($query)
            ->orderBy(['last_activity' => SORT_DESC])
            ->limit(1)->prepare(Yii::$app->db->queryBuilder)->createCommand()->rawSql);
        //echo "\n\n" . YCHelper::reboot(442) . "\n";
    }

    private static function restartServers()
    {
        // Checks and restarts servers, that down
        $query = [
            'and',
            ['rdp_activity.deleted' => 0],
            ['<', 'last_activity', time() - 800],
            ['or',
                ['is', 'last_yc_reboot_attempt', new Expression('null')],
                ['<', 'last_yc_reboot_attempt', time() - 3600],
            ],
            ['is not', 'yc_id', new Expression('null')],
        ];
        $activity = RdpActivity::find()
            ->joinWith('table')
            ->where($query)
            ->orderBy(['last_activity' => SORT_DESC])
            ->limit(1)->one();
        if (!empty($activity)) {
            YCHelper::reboot($activity->table->id);
            RdpCommands::createLoginCommand($activity, 120);
        }
    }

}
