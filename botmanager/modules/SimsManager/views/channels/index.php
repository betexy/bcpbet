<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\SimsManager\models\ChannelsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('SimsManager', 'Channels');
$this->params['breadcrumbs'][] = ['label' => 'SIM manager', 'url' => ['/sims-manager']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="channels-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('SimsManager', 'Request currently bound slots'), ['channels/request-bound'], ['class' => 'btn btn-info']) ?>
    </p>

    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
            //['class' => 'yii\grid\SerialColumn'],

            //'id',
            'channel_id',
            'goip_sms_id',
            [
                'attribute' => 'slot',
                'value' => 'slot.slot_id',
            ],
            [
                'attribute' => 'number',
                'value' => function ($model) {
                    return empty($model->sim) ? '' : "{$model->sim->number} [ {$model->sim->comment} ]";
                }
            ],
            [
                'attribute' => 'only_manual',
                'format' => 'boolean',
                'label' => 'Manual?',
            ],
            'comment:ntext',

            [
                'class' => 'yii\grid\ActionColumn',
                'template' => '{view} {update}',
            ],
        ],
    ]); ?>
    <?php Pjax::end(); ?>
    <?php \yii\helpers\VarDumper::dump(
        \yii\helpers\ArrayHelper::map(\app\modules\SimsManager\models\Channels::getFreeChannels(), 'id', 'id')); ?>
</div>
