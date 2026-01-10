<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\ConfigsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('configs', 'Configs');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="configs-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('configs', 'Create Configs'), ['create'], ['class' => 'btn btn-success']) ?>
    </p>

    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
            //['class' => 'yii\grid\SerialColumn'],

            'id',
            //'created_at',
            //'updated_at',
            [
                'attribute' => 'name',
                'format' => 'raw',
                'contentOptions' => ['style' => 'min-width: 400px;'],
                'value' => function ($m) {
                    return Html::a($m->name, ['configs/view', 'id' => $m->id]);
                },
            ],
            [
                'attribute' => 'bookie',
                'filter' => \app\modules\BotManager\models\Configs::getBookies(),
                'value' => function ($m) {
                    return empty($m->is_fork) ? $m->bookie : $m->bookie . ' / ' . $m->second_bookie;
                },
            ],
            [
                'attribute' => 'source',
                //'value' => function($model) {
                //    return empty($model->source) ? 'oddscp' : $model->source;
                //},
            ],
            'currency',
            [
                'attribute' => 'url',
                'contentOptions' => ['style' => 'min-width: 300px;'],
            ],
            'express:boolean',
            [
                'attribute' => 'is_fork',
                'label' => 'Fork',
                'format' => 'boolean',
            ],
            //'url:url',
            //'eventTimeLimit:datetime',
            //'eventMaxBets',
            //'stake',
            //'coefFrom',
            //'coefTo',
            //'incomeFrom',
            //'incomeTo',
            //'lastScoreTennis',
            //'lastScoreBasketball',
            //'excludeSports',
            //'excludeMarkets',
            //'excludeTargets',
            //'excludePivots',
            //'excludeBets',
            //'excludeLeagues',
            //'excludeSportMarketTarget',

            /*
            [
                'class' => 'yii\grid\ActionColumn',
                'template' => '{view} {update}',
            ],
            */
        ],
    ]); ?>

    <?php Pjax::end(); ?>

</div>
