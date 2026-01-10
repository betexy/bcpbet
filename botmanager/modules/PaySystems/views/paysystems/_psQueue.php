<?php

use yii\helpers\Html;
use yii\helpers\Url;
use app\modules\BotManager\models\BotsQueue;
use app\modules\BotManager\models\FileGroups;
use app\modules\Accounts\models\AccountBookmaker;

/* @var $this yii\web\View */
/* @var $dataProvider \yii\data\ActiveDataProvider */

?>

<?php \yii\widgets\Pjax::begin(['id' => 'ps_queue']) ?>

<?php try {
    echo \yii\grid\GridView::widget([
        'dataProvider' => $dataProvider,
        'columns' => [
            //'created_at:datetime',
            [
                'attribute' => 'sent_at',
                'format' => 'raw',
                'value' => function ($m) {
                    $data = json_decode($m->data, true);
                    return empty($m->sent_at)
                        ? (empty($m->plan_send_at)
                            ? '<strong style="color: red;">NOT SEND!</strong>'
                            : '<strong style="color: blue;">Plan: ' . Yii::$app->formatter->asTime($m->plan_send_at) . '</strong>')
                        : Yii::$app->formatter->asDatetime($m->sent_at);
                },
            ],
            [
                'attribute' => 'updated_at',
                'value' => function ($m) {
                    return Yii::$app->formatter->asRelativeTime($m->updated_at);
                },
                'filter' => '',
            ],
            [
                'attribute' => 'command',
                'value' => function ($model) {
                    return \app\modules\PaySystems\models\PaysystemsQueue::$commands[$model->command];
                    //return $model->command;
                }
            ],
            [
                'attribute' => 'status',
                'value' => function ($model) {
                    return \app\modules\BotManager\models\BotsQueue::$statusesList[$model->status];
                }
            ],
            [
                'attribute' => 'data',
                'format' => 'ntext',
                'value' => function ($m) {
                    return str_replace(['Array', "\n", "\r", '(', ')'], '', print_r(json_decode($m->data, true), true));
                }
            ],
            [
                'attribute' => 'response',
                'format' => 'raw',
                'value' => function ($m) {
                    $r = json_decode($m->response, true);
                    if ($r === NULL) {
                        return $m->response;
                    }
                    foreach (['websocket_uid', 'status', 'id'] as $check) {
                        if (isset($r[$check])) {
                            unset($r[$check]);
                        }
                    }
                    if ($m->command === 'HISTORY') {
                        if ($r['succeed'] === 'error') {
                            return $r['message'];
                        } elseif (empty($r['message']['collected'])) {
                            return '---';
                        } else {
                            $f = function ($row, $key) {
                                return empty($row[$key]) ? '' : "<td>{$row[$key]}</td>";
                            };
                            $rows = [];
                            foreach ($r['message']['collected'] as $row) {
                                $rows[] = "<tr>{$f($row, 'type')}{$f($row, 'datetime')}"
                                    . "{$f($row, 'amount')}{$f($row, 'fee')}"
                                    . "{$f($row, 'description')}";
                            }
                            return '<table class="historyTable">' . implode('', $rows) . '</table>';
                        }
                    } else {
                        return str_replace(['Array', "\n", "\r", '(', ')'], '', print_r($r, true));
                    }
                }
            ],
            [
                'class' => 'yii\grid\ActionColumn',
                'buttons' => [
                    'delete' => function ($url, $model) {
                        return Html::a('<span class="glyphicon glyphicon-trash"></span>',
                            Url::toRoute(['paysystems/delete-action', 'id' => $model->id]),
                            [
                                'title' => Yii::t('PaySystems', 'Delete queue action'),
                                'onclick' => '$.post($(this).attr("href"), {}, function() { $.pjax.reload({container: \'#ps_queue\'}); }); return false;'
                            ]);
                    }
                ],
                'template' => '{delete}',
            ],
        ],
    ]);
} catch (Exception $e) {
    echo $e->getMessage();
} ?>

<?php \yii\widgets\Pjax::end() ?>
