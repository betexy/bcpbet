<?php

namespace app\modules\BotManager\commands;

use app\modules\BotManager\models\RdpActivity;
use app\modules\BotManager\models\RdpCommands;
use app\modules\BotManager\models\RdpInstallQueue;
use app\modules\BotManager\models\RdpTable;
use app\modules\Emails\helpers\imap\Exception;
use Yii;
use yii\console\Controller;
use yii\helpers\Console;
use yii\helpers\Url;
use yii\helpers\VarDumper;

class RdpInstallController extends Controller
{
    public function actionIndex()
    {
        $nfQuery = ['and',
            ['finished_at' => 0],
            ['!=', 'sent_at', 0],
            ['<=', 'sent_at', time() - 2800],
        ];
        //var_dump(RdpInstallQueue::find()->where($nfQuery)->prepare(Yii::$app->db->queryBuilder)->createCommand()->rawSql);
        $notFinished = RdpInstallQueue::find()
            ->where($nfQuery)->all();
        foreach ($notFinished as $nf) {
            /** @var RdpInstallQueue $nf */
            $nf->finished_at = time();
            $nf->finished = true;
            $nf->success = false;
            $nf->response = 'Install not finished at ' . (time() - $nf->sent_at) . ' s';
            $nf->save(false);
        }
        $executing = RdpInstallQueue::find()->where(['and', ['finished_at' => 0], ['>', 'sent_at', 0]])->count();
        if (empty($executing)) {
            $queue = RdpInstallQueue::find()->where(['sent_at' => 0])->orderBy(['created_at' => SORT_ASC])
                ->limit(1)->one();
            if (!empty($queue)) {
                $queue_command = json_decode($queue->command, true);
                if (!empty($queue_command) && !empty($queue_command['action'])
                    && $queue_command['action'] === 'install_server'
                    && !empty($queue_command['data']) && is_array($queue_command['data'])) {
                    $si = dirname(__FILE__) . "/../Helpers/server_installer";
                    $pass = "--password=\"{$queue_command['data']['root_password']}\"";
                    $socket = "--web_socket=\"{$queue_command['data']['socket']}\"";
                    $name = "--servername=\"{$queue_command['data']['name']}\"";
                    $qid = "--queue-id={$queue->id}";
                    $dd = "--default-domain=\"{$queue_command['data']['domain']}\"";
                    $command = "{$si} {$queue_command['data']['ip']} {$pass} {$socket} {$name} {$qid} {$dd} --no-report=true";
                    $queue->sent_at = time();
                    $queue->comment = $queue->comment . "\n" . $command;
                    if (!$queue->save(false)) {
                        file_put_contents(dirname(__FILE__) . '/../../../ssh_errors.log',
                            date('Y-m-d H:i:s') . '>1: ' . var_export($queue->getErrors(), true) . "\n",
                            FILE_APPEND);
                    }
                    set_time_limit(2700);
                    try {
                        $res = shell_exec($command);
                        file_put_contents(dirname(__FILE__) . '/../../../last_ssh_result.log', $res);
                        $queue->ssh_result = $res;
                        $queue->finished_at = time();
                        if (strpos($queue->ssh_result, 'It seems, you need to change server password!') !== false) {
                            $queue->success = false;
                            $queue->response = 'It seems, you need to change server password!';
                            $queue->finished = true;
                        } elseif (strpos($queue->ssh_result, 'EVERYTHING DONE!') === false) {
                            $queue->success = false;
                            $queue->response = 'Error executing SSH!';
                            $queue->finished = true;
                        } else {
                            $rdp_command = new RdpCommands();
                            $rdp_command->ip = $queue_command['data']['ip'];
                            $rdp_command->command = json_encode(['action' => 'rdp_add',
                                'server' => $queue_command['data']['ip'],
                                'servername' => $queue_command['data']['name'], 'queue_id' => $queue->id]);
                            $rdp_command->save();
                            $table = new RdpTable();
                            $table->ip = $queue_command['data']['ip'];
                            $table->name = $queue_command['data']['name'];
                            $table->save();
                            $queue->rdp_command_id = $rdp_command->id;
                            $queue->success = true;
                            $queue->response = 'Server installed and added successfully!';
                        }
                        if (!$queue->save(false)) {
                            file_put_contents(dirname(__FILE__) . '/../../../ssh_errors.log',
                                date('Y-m-d H:i:s') . '>2: ' . var_export($queue->getErrors(), true) . "\n",
                                FILE_APPEND);
                        }
                    } catch (\Exception $e) {
                        file_put_contents(dirname(__FILE__) . '/../../../ssh_errors_' . date('Y-m-d H:i:s') . '.log',
                            $e->getMessage(), FILE_APPEND);
                        $queue->success = false;
                        $queue->response = 'Error in the PHP!';
                        $queue->finished = true;
                        $queue->save();
                    }
                } else {
                    $queue->sent_at = time();
                    $queue->finished_at = time();
                    $queue->success = false;
                    $queue->response = 'Bad command!';
                    $queue->save(false);
                }
            }
        }
    }

    public function actionGuacamole()
    {
        $query = ['and',
            ['finished' => 0],
            ['success' => 1],
            ['!=', 'rdp_command_id', 0],
        ];
        $notFinished = RdpInstallQueue::find()->where($query)->all();
        foreach ($notFinished as $nf) {
            /** @var RdpInstallQueue $nf */
            $rdp_command = RdpCommands::findOne(['id' => $nf->rdp_command_id]);
            if ($rdp_command->finished_at === 0) {
                continue;
            }
            $nf->finished = true;
            $result = json_decode($rdp_command->result, true);
            if (!empty($result) && !empty($result['success']) && !empty($result['response'])
                && strpos($result['response'], 'has been connected') !== false) {
                $res = [];
                preg_match('|\[(.*?)]|is', $result['response'], $res);
                $nf->guacamole_link = $res[1];
            } else {
                $nf->success = false;
                $nf->response = $nf->response . " Error getting guacamole link!";
            }
            if (!$nf->save(false)) {
                file_put_contents(dirname(__FILE__) . '/../../../ssh_errors.log',
                    date('Y-m-d H:i:s') . '>3: ' . var_export($nf->getErrors(), true) . "\n",
                    FILE_APPEND);
            }
        }
    }

}
