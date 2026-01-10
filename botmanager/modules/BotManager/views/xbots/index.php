<?php

use app\modules\BotManager\models\Xbots;
use yii\grid\GridView;
use yii\helpers\ArrayHelper;
use yii\helpers\Html;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\XbotsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('BotManager', 'Xbots');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;

$users = ArrayHelper::map(Xbots::find()->select('betexy_user_id')
    ->where(['active' => 1])->distinct()->asArray()->all(), 'betexy_user_id', 'betexy_user_id');
$bookies = ArrayHelper::map(Xbots::find()->select('bookie')
    ->where(['and', ['!=', 'bookie', ''], ['active' => 1]])->distinct()->orderBy('bookie')
    ->asArray()->all(), 'bookie', 'bookie');
?>
<div class="xbots-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= Html::beginForm(['day'], 'post'); ?>
    <div class="row" style="margin-bottom: 5px;">
        <div class="col-md-1">
            <?= Html::a(Yii::t('BotManager', 'Create Xbot'), ['create'], ['class' => 'btn btn-success']) ?>
        </div>
        <div class="col-md-2"></div>
        <div class="col-md-2">
            <?= Html::dropDownList('bookie', '', $bookies, ['class' => 'form-control',]) ?>
        </div>
        <div class="col-md-2">
            <?= Html::submitButton('Add a day',
                ['class' => 'btn btn-success', 'onclick' => 'return confirm("Are you sure?");']); ?>
        </div>
        <div class="col-md-5" style="text-align: right;">
            <?= Html::a(Yii::t('BotManager', 'Refresh'), ['refresh'],
                ['class' => 'btn btn-warning', 'onclick' => 'return confirm("Are you sure?");']) ?>

        </div>
    </div>
    <?= Html::endForm(); ?>

    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [

            'id',
            'betexy_bot_id',
            [
                'attribute' => 'betexy_user_id',
                'filter' => $users
            ],
            [
                'attribute' => 'bookie',
                'filter' => $bookies,
            ],
            [
                'attribute' => 'name',
                'format' => 'raw',
                //'contentOptions' => ['style' => 'min-width: 400px;'],
                'value' => function ($m) {
                    return Html::a($m->name, ['xbots/view', 'id' => $m->id]);
                },
            ],
            'due_date',
            'active:boolean',
            //'created_at',
            //'updated_at',

        ],
    ]); ?>

    <?php Pjax::end(); ?>

</div>
