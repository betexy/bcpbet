<?php

use app\modules\BotManager\models\Proxies;
use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Proxies */

$this->title = $model->name;
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Proxies'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="proxies-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?php if (!$model->deleted) echo Html::a(Yii::t('BotManager', 'Update'),
            ['update', 'id' => $model->id], ['class' => 'btn btn-primary']); ?>
        <?php
        if (!empty($model->deleted)) {
            echo Html::a(Yii::t('BotManager', 'Set not deleted'), ['delete', 'id' => $model->id], [
                'class' => 'btn btn-danger',
                'data' => [
                    'confirm' => Yii::t('BotManager', 'Are you sure you want to set this item not deleted?'),
                    'method' => 'post',
                ]
            ]);
        } else {
            echo Html::a(Yii::t('BotManager', 'Delete'), ['delete', 'id' => $model->id], [
                'class' => 'btn btn-danger',
                'style' => 'float: right;',
                'data' => [
                    'confirm' => Yii::t('BotManager', 'Are you sure you want to delete this item?'),
                    'method' => 'post',
                ],
            ]);
        }
        ?>
        <?php
        if (!empty($model->stakeAccount) && $model->provider === 'luminati') {
            echo Html::a(Yii::t('BotManager', 'Free proxy'), ['free-proxy', 'id' => $model->id], [
                'class' => 'btn btn-warning',
                'style' => 'float: right; margin-right: 30px;',
                'data' => [
                    'confirm' => Yii::t('BotManager', 'Are you sure you want to free this proxy?'),
                    'method' => 'post',
                ],
            ]);
        }
        ?>
    </p>

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            [
                'attribute' => 'id',
                'label' => 'ID (deleted) --- Created --- Updated at',
                'format' => 'raw',
                'value' => function ($m) {
                    return "<strong>{$m->id}</strong> (" . ($m->deleted ? 'Yes' : 'No') . ") --- "
                        . Yii::$app->formatter->asDatetime($m->created_at) . ' --- '
                        . Yii::$app->formatter->asDatetime($m->updated_at);
                }
            ],
            [
                'attribute' => 'provider',
                'format' => 'raw',
                'value' => function (app\modules\BotManager\models\Proxies $m) {
                    return Proxies::$providers[$m->provider];
                },
            ],
            'name',
            [
                'attribute' => 'stakeAccount',
                'format' => 'raw',
                'value' => function (app\modules\BotManager\models\Proxies $m) {
                    return empty($m->stakeAccount) ? null : Html::a($m->stakeAccount->name, ['stake/view', 'id' => $m->stakeAccount->id]);
                },
            ],
            [
                'attribute' => 'country',
                'value' => function ($m) {
                    return Proxies::$countries[$m->country] . " ( {$m->country} )";
                }
            ],
            [
                'attribute' => 'protocol',
                'label' => 'Protocol :// host : port',
                'value' => function ($m) {
                    return "{$m->protocol}://{$m->host}:{$m->port}";
                }
            ],
            [
                'attribute' => 'login',
                'label' => 'Login:Password',
                'value' => function ($m) {
                    return "{$m->login} : {$m->password}";
                }
            ],
            'comment:ntext',
            [
                'attribute' => 'registered_at',
                'label' => 'Registered At --- will Finish At',
                'format' => 'raw',
                'value' => function ($m) {
                    return Yii::$app->formatter->asDatetime($m->registered_at) . ' --- '
                    . Yii::$app->formatter->asDatetime($m->finish_at);
                }
            ],
        ],
    ]) ?>

</div>
