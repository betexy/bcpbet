<?php

use app\modules\BotManager\models\RdpActivity;
use app\modules\BotManager\models\RdpCommands;
use yii\grid\GridView;
use app\modules\BotManager\models\Bots;
use yii\data\ActiveDataProvider;
use yii\helpers\Html;
use yii\web\View;
use app\modules\BotManager\models\Server;

/* @var $this View */
/* @var $model RdpActivity */
/* @var $noSummary boolean */
/* @var $unassigned boolean */
/* @var $showHeader boolean */

$query = ['ip' => $model->ip];

?>

<?php try {
    echo GridView::widget([
        'layout' => $noSummary ? "{items}\n{pager}" : "{summary}\n{items}\n{pager}",
        'showHeader' => $showHeader,
        'dataProvider' => new ActiveDataProvider([
            'query' => RdpCommands::find()->andFilterWhere($query),
            'pagination' => [
                'pageSize' => 30,
            ],
            //'sort' => ['defaultOrder' => ['last_request' => SORT_DESC]]
            'sort' => ['defaultOrder' => ['sent_at' => SORT_DESC]]
        ]),
        'columns' => [
            'created_at:datetime',
            'sent_at:datetime',
            'finished_at:datetime',
            'command:ntext',
            [
                'attribute' => 'result',
                'label' => 'Result',
                'format' => 'raw',
                'value' => function ($m) {
                    try {
                        $parsed = json_decode($m->result);
                        $html = "Success: <strong>" . Yii::$app->formatter->asBoolean($parsed->success)
                            . "</strong>, Command ID: <strong>{$parsed->command_id}</strong>"
                            . "<br />Response: {$parsed->response}";

                    } catch (Exception $e) {
                        $html = "{$e->getMessage()} trying to parse '{$m->result}'";
                    }
                    return $html;
                }
            ],
        ],
    ]);
} catch (Exception $exception) {
    echo $exception->getMessage();
} ?>
