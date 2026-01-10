<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\helpers\Url;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\RdpInstallQueueSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('BotManager', 'Install Queue');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => 'Servers', 'url' => ['/BotManager/server']];
$this->params['breadcrumbs'][] = $this->title;

$this->registerCss('
    tbody tr:hover td {
        color: #337ab7;
        cursor: pointer;
    }
');

$this->registerJs("    
    $('body').on('click', 'tbody td', function (e) {
        var id = $(this).closest('tr').data('id');
        if(e.target == this)
            location.href = '" . Url::to(['install-queue/view']) . "?id=' + id;
    });
", $this::POS_READY);

?>
<div class="rdp-install-queue-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-2">
            <?= Html::a(Yii::t('BotManager', 'Activity of servers'), ['server/index'], ['class' => "btn btn-success"]) ?>
        </div>
        <div class="col-md-2">
            <?= Html::a(Yii::t('BotManager', 'Install server'), ['install-queue/index'], ['class' => "btn btn-success disabled"]) ?>
        </div>
        <div class="col-md-8" style="text-align: right">
            <?= Html::a(Yii::t('BotManager', 'Install New Server'), ['create'], ['class' => 'btn btn-danger']) ?>
        </div>
    </div>

    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'rowOptions' => function ($model) {
            return ['data-id' => $model->id];
        },
        'columns' => [
            'finished:boolean',
            'success:boolean',
            [
                'attribute' => 'created_at',
                'value' => function ($m) {
                    return $m->created_at === 0 ? null : Yii::$app->formatter->asRelativeTime($m->created_at);
                },
            ],
            [
                'attribute' => 'sent_at',
                'value' => function ($m) {
                    return $m->sent_at === 0 ? null : Yii::$app->formatter->asRelativeTime($m->sent_at);
                },
            ],
            [
                'attribute' => 'finished_at',
                'value' => function ($m) {
                    return $m->finished_at === 0 ? null : Yii::$app->formatter->asRelativeTime($m->finished_at);
                },
            ],
            [
                'attribute' => 'command',
                'label' => 'Command',
                'format' => 'raw',
                'value' => function ($m) {
                    $html = $m->command;
                    try {
                        $parsed = json_decode($html, true);
                        $html = "<strong>{$parsed['action']}</strong> {$parsed['data']['ip']} / {$parsed['data']['root_password']}"
                            . "<br /><strong>{$parsed['data']['name']}</strong> {$parsed['data']['socket']}";
                    } catch (Exception $e) {

                    }
                    return $html;
                }
            ],
            'response:ntext',
        ],
    ]); ?>

    <?php Pjax::end(); ?>

</div>
