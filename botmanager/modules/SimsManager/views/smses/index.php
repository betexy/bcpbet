<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\SimsManager\models\SmsesSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('SimsManager', 'SMS');
$this->params['breadcrumbs'][] = ['label' => 'SIM manager', 'url' => ['/sims-manager']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="smses-index">

    <h1><?= Html::encode($this->title) ?></h1>
    <p>
        <?= Html::a(Yii::t('SimsManager', 'Load from GOIP SMS Server'), ['goip-load'], ['class' => 'btn btn-info']) ?>
    </p>

    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
            //['class' => 'yii\grid\SerialColumn'],
            //'id',
            'receive_id',
            [
                'attribute' => 'number',
                'value' => function ($model) {
                    /**
                     * @var $model \app\modules\SimsManager\models\Smses
                     */
                    return $model->number . (empty($model->sim) ? '' : " [ {$model->sim->comment} ]");
                }
            ],
            'scrum',
            //'provid',
            'msg:ntext',
            [
                'attribute' => 'time_received',
                'value' => function ($model) {
                    $dt = \DateTime::createFromFormat('Y-m-d H:i:s', $model->time_received);
                    return empty($dt) ? '' : $dt->format('d.m/H:i');
                }
            ],
            //'goip_name',
            //'sims_channels_id',
            //'status',
            //'smscnum',
            //'senttime',
            'comment:ntext',

            ['class' => 'yii\grid\ActionColumn', 'template' => '{view}'],
        ],
    ]); ?>
    <?php Pjax::end(); ?>
</div>
