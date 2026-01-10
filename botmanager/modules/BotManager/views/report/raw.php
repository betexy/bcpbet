<?php

use app\modules\BotManager\models\Report;
use app\modules\BotManager\classes\MyDataColumn;
use yii\db\Query;
use yii\helpers\ArrayHelper;
use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\ReportSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('bm', 'Raw');
$this->params['breadcrumbs'][] = ['label' => 'Reports', 'url' => ['/BotManager/report']];
$this->params['breadcrumbs'][] = $this->title;

$remote_ips = ArrayHelper::merge(
    ['' => ' - - - '],
    ArrayHelper::map(Report::getAllRemotes(), 'remote_ip', 'remote_ip')
);

$actions = ArrayHelper::merge(
    ['' => ' - - - '],
    ArrayHelper::map((new Query())->select('action')->distinct()->from(Report::tableName())->all(),
        'action', 'action')
);

$categories = ArrayHelper::merge(
    ['' => ' - - - '],
    ArrayHelper::map((new Query())->select('category')->distinct()->from(Report::tableName())->all(),
        'category', 'category')
);

$bks = ArrayHelper::merge(
    ['' => ' - - - '],
    ArrayHelper::map((new Query())->select('room_bk')->distinct()->from(Report::tableName())->all(),
        'room_bk', 'room_bk')
);

?>
<div class="report-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
            [
                'class' => MyDataColumn::class,
                'linkTo' => 'report/view',
                'attribute' => 'created_at',
                'format' => 'date',
                'filter' => Html::activeDropDownList(
                    $searchModel,
                    'created_at',
                    ['' => ' - - - ', 'today' => 'Today', 'last24h' => 'Last 24hrs', 'last_week' => 'Last Week'],
                    ['multiple' => false, 'class' => 'form-control', 'style' => '']
                ),
            ],
            'parsed:boolean',
            'parse_error:boolean',
            [
                'class' => MyDataColumn::class,
                'linkTo' => 'report/view',
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
                'linkTo' => 'report/view',
                'attribute' => 'category',
                'filter' => Html::activeDropDownList(
                    $searchModel,
                    'category',
                    $categories,
                    ['multiple' => false, 'class' => 'form-control', 'style' => '']
                ),
            ],
            [
                'class' => MyDataColumn::class,
                'linkTo' => 'report/view',
                'attribute' => 'action',
                'filter' => Html::activeDropDownList(
                    $searchModel,
                    'action',
                    $actions,
                    ['multiple' => false, 'class' => 'form-control', 'style' => '']
                ),
            ],
            [
                'class' => MyDataColumn::class,
                'linkTo' => 'report/view',
                'attribute' => 'room_bk',
                'filter' => Html::activeDropDownList(
                    $searchModel,
                    'room_bk',
                    $bks,
                    ['multiple' => false, 'class' => 'form-control', 'style' => '']
                ),
            ],
            'message:ntext',

            [
                'class' => 'yii\grid\ActionColumn',
                'template' => '{delete}',
            ],
        ],
    ]); ?>

    <?php Pjax::end(); ?>

</div>
