<?php

use app\modules\BotManager\models\Proxies;
use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\ProxiesSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */
/* @var $deleted boolean */

$this->title = Yii::t('BotManager', 'Proxies');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="proxies-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('BotManager', 'Create proxy'), ['create'], ['class' => 'btn btn-success']) ?>
        <?= Html::a(Yii::t('BotManager', 'Check balance'), ['balance'], ['class' => 'btn btn-info']) ?>
        <?php if ($deleted) {
            echo Html::a(Yii::t('BotManager', 'Show not deleted'), ['proxies/index'], ['class' => 'btn btn-success', 'style' => 'float: right;',]);
        } else {
            if (Proxies::find()->where(['deleted' => 1])->count() > 0) {
                echo Html::a(Yii::t('BotManager', 'Show deleted'), ['proxies/deleted'], ['class' => 'btn btn-danger', 'style' => 'float: right;',]);
            }
        } ?>

    </p>

    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
            //'id',
            [
                'attribute' => 'provider',
                'format' => 'raw',
                'value' => function ($m) {
                    return  Html::a(Proxies::$providers[$m->provider], ['proxies/view', 'id' => $m->id]);
                },
                'filter' => Html::activeDropDownList(
                    $searchModel,
                    'provider',
                    Proxies::$providers,
                    ['class' => 'form-control', 'prompt' => 'All'],
                ),

            ],
            [
                'attribute' => 'name',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::a($m->name, ['proxies/view', 'id' => $m->id]);
                },
            ],
            [
                'attribute' => 'betexy_id',
                'format' => 'raw',
                'value' => function ($m) {
                    return $m->betexy_id ? Html::a($m->betexy_id, 'https://cloud.betexy.com/proxies/create?id='
                        . $m->betexy_id, ['target' => '_blank']) : null;
                },
            ],
            [
                'attribute' => 'protocol',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::a($m->protocol, ['proxies/view', 'id' => $m->id]);
                },
            ],
            [
                'attribute' => 'host',
                'format' => 'raw',
                'label' => 'Host:Port',
                'value' => function ($m) {
                    return Html::a("{$m->host}:{$m->port}", ['proxies/view', 'id' => $m->id]);
                },
            ],
            [
                'attribute' => 'country',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::a(Proxies::$countries[$m->country] . " ( {$m->country} )",
                        ['proxies/view', 'id' => $m->id]);
                }
            ],
            [
                'attribute' => 'stakeAccount',
                'format' => 'raw',
                'value' => function ($m) {
                    return empty($m->stakeAccount) ? null : Html::a($m->stakeAccount->name,
                        ['stake/view', 'id' => $m->stakeAccount->id]);
                },
            ],
            //'login',
            //'password',
            'comment:ntext',
            //'registered_at',
            'finish_at:datetime',
            //'created_at',
            //'updated_at',
        ],
    ]); ?>

    <?php Pjax::end(); ?>

</div>
