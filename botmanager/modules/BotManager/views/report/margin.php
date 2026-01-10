<?php

use app\modules\BotManager\models\MarginReport;
use yii\helpers\ArrayHelper;
use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;
use app\modules\BotManager\classes\MyDataColumn;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\MarginReportSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('bm', 'Margin Reports');
$this->params['breadcrumbs'][] = ['label' => 'Reports', 'url' => ['/BotManager/report']];
$this->params['breadcrumbs'][] = $this->title;

$remote_ips = ArrayHelper::merge(
    ['' => ' - - - '],
    ArrayHelper::map(MarginReport::getAllRemotes(), 'remote_ip', 'remote_ip')
);

$room_uids = ArrayHelper::merge(
    ['' => ' - - - '],
    ArrayHelper::map(MarginReport::getAllUIDs(), 'room_uid', 'room_uid')
);

$statuses = ArrayHelper::merge(
    ['' => ' - - - '],
    ArrayHelper::map(MarginReport::getAllStatuses(), 'status', 'status')
);

?>
<div class="margin-report-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <?php Pjax::begin(); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
            [
                'class' => MyDataColumn::class,
                'linkTo' => 'report/margin-view',
                'attribute' => 'created_at',
                'format' => 'datetime',
                'filter' => Html::activeDropDownList(
                    $searchModel,
                    'created_at',
                    ['' => ' - - - ', 'today' => 'Today', 'last24h' => 'Last 24hrs', 'last_week' => 'Last Week'],
                    ['multiple' => false, 'class' => 'form-control', 'style' => '']
                ),
                'headerOptions' => ['style' => 'min-width: 135px'],
            ],
            [
                'class' => MyDataColumn::class,
                'linkTo' => 'report/margin-view',
                'attribute' => 'remote_ip',
                'filter' => Html::activeDropDownList(
                    $searchModel,
                    'remote_ip',
                    $remote_ips,
                    ['multiple' => false, 'class' => 'form-control', 'style' => '']
                ),
            ],
            [
                'class' => MyDataColumn::class,
                'linkTo' => 'report/margin-view',
                'attribute' => 'room_uid',
                'filter' => Html::activeDropDownList(
                    $searchModel,
                    'room_uid',
                    $room_uids,
                    ['multiple' => false, 'class' => 'form-control', 'style' => '']
                ),
                'headerOptions' => ['style' => 'min-width: 300px'],
            ],
            [
                'class' => MyDataColumn::class,
                'linkTo' => 'report/margin-view',
                'attribute' => 'status',
                'filter' => Html::activeDropDownList(
                    $searchModel,
                    'status',
                    $statuses,
                    ['multiple' => false, 'class' => 'form-control', 'style' => '']
                ),
            ],
            [
                'attribute' => 'coef',
                'contentOptions' => ['style' => 'text-align: right;'],
            ],
            [
                'attribute' => 'requested_coef',
                'contentOptions' => ['style' => 'text-align: right;'],
            ],
            [
                'attribute' => 'margin',
                'contentOptions' => ['style' => 'text-align: right;'],
                'format' => ['decimal', 4],
            ],
            //'comment:ntext',
        ],
    ]); ?>

    <?php Pjax::end(); ?>

</div>
