<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\SimsManager\models\RequestsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('SimsManager', 'Requests');
$this->params['breadcrumbs'][] = ['label' => 'SIM manager', 'url' => ['/sims-manager']];
$this->params['breadcrumbs'][] = $this->title;

?>
<div class="requests-index">

    <h1><?= Html::encode($this->title) ?></h1>
    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
            //['class' => 'yii\grid\SerialColumn'],

            ['attribute' => 'id', 'contentOptions' => ['style' => 'width: 80px;']],
            [
                'attribute' => 'created_at',
                'format' => 'datetime',
                'filter' => false,
                'contentOptions' => ['style' => 'min-width: 130px;']
            ],
            [
                'attribute' => 'updated_at',
                'format' => 'datetime',
                'filter' => false,
                'contentOptions' => ['style' => 'min-width: 130px;']
            ],
            [
                'attribute' => 'command',
                'format' => 'raw',
                'value' => function ($model) {
                    return Html::a(\app\modules\SimsManager\models\Actions::$actions[$model->command],
                        ['requests/view', 'id' => $model->id]);
                },
                'filter' => \app\modules\SimsManager\models\Actions::$actions,
            ],
            'websocket_uid',
            'bots.virtual_machine_name',
            [
                'attribute' => 'Active?',
                'format' => 'raw',
                'value' => function ($model) {
                    if ($model->command === 'BIND_HOLD') {
                        return empty($model->actions) || empty($model->actions[0]) || empty($model->actions[0]->active) ? '-' : 'Yes';
                    } else {
                        return '';
                    }
                }
            ],

            //['class' => 'yii\grid\ActionColumn'],
        ],
    ]); ?>
    <?php Pjax::end(); ?>
</div>
<?php

//\yii\helpers\VarDumper::dump(\yii\helpers\ArrayHelper::map(\app\modules\SimsManager\models\Channels::getFreeChannels(), 'id', 'channel_id'), 10, true);
//\yii\helpers\VarDumper::dump(\yii\helpers\ArrayHelper::map(\app\modules\SimsManager\models\Actions::findAll(['active' => true]), 'sims_channels_id', 'id'), 10, true);

?>
