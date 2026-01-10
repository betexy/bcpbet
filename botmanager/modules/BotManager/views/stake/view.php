<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\StakeAccounts */

$this->title = $model->name;
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Stake Accounts'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="stake-accounts-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?php if (!$model->deleted) echo Html::a(Yii::t('BotManager', 'Update'),
            ['update', 'id' => $model->id], ['class' => 'btn btn-primary']); ?>
        <?= Html::a(Yii::t('BotManager', 'Clear errors'), ['clear', 'id' => $model->id], [
            'class' => 'btn btn-warning',
            'style' => 'margin-left: 10px;',
            'data' => [
                'confirm' => Yii::t('BotManager',
                    'Are you sure you want to clear comments and registered_at on this item?'),
                'method' => 'post',
            ],
        ]); ?>
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
    </p>

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            'id',
            //'deleted',
            'name',
            [
                'attribute' => 'betexy_id',
                'format' => 'raw',
                'value' => function ($m) {
                    return $m->betexy_id ? Html::a($m->betexy_id, 'https://cloud.betexy.com/rooms/create?id='
                        . $m->betexy_id, ['target' => '_blank']) : null;
                },
            ],
            [
                'attribute' => 'proxy_id',
                'label' => 'Proxy',
                'format' => 'raw',
                'value' => function ($m) {
                    return $m->proxy ? Html::a($m->proxy->name, ['proxies/view', 'id' => $m->proxy->id]) : null;
                }
            ],
            [
                'attribute' => 'wallet',
                'format' => 'raw',
                'value' => function ($m) {
                    return $m->wallet ? Html::a($m->wallet->deposit_address, ['/pay-systems/wallets/view', 'id' => $m->wallet->id]) : null;
                },
            ],
            'mailbox.address',
            'register',
            'configs_stakes',
            'browser',
            'profile:ntext',
            'login:ntext',
            'password:ntext',
            'comment:ntext',
            'registered_at:datetime',
            'created_at:datetime',
            'updated_at:datetime',
        ],
    ]) ?>

</div>
