<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\helpers\StringHelper;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\PaySystems\models\WalletsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('pay-systems', 'Wallets');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="wallets-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('pay-systems', 'Create Wallet'), ['create'], ['class' => 'btn btn-success']) ?>

        <?= Html::a(Yii::t('pay-systems', 'Withdraw from PS'), ['withdrawal'], ['class' => 'btn btn-danger', 'style' => 'float: right;']) ?>
    </p>

    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
            //['class' => 'yii\grid\SerialColumn'],
            /*
            [
                'attribute' => 'id',
                'contentOptions' => ['style' => 'width: 50px; text-align: right;'],
            ],
            */
            [
                'attribute' => 'deposit_address',
                'format' => 'raw',
                'value' => function ($m) {
                    return
                        Html::beginForm(['quick-withdrawal', 'id' => $m->id], 'post', ['class' => 'form-inline'])
                        .
                        Html::a('...' . mb_substr($m->deposit_address, -6), ['wallets/view', 'id' => $m->id],
                            ['style'=> 'margin-right: 5px;'])
                        .
                        Html::textInput('History[amount]', '0',
                            ['class' => 'form-control', 'placeholder' => 'Amount', 'style' => 'width: 50px; margin-right: 5px;'])
                        .
                        Html::button(Yii::t('pay-systems', 'W'),
                            ['type' => 'submit', 'class' => 'btn btn-warning', 'data' => [
                                'confirm' => Yii::t('pay-systems', 'Are you sure you want withdrawal?'),
                                'method' => 'post',
                            ]])
                        .
                        Html::endForm();
                },
                'contentOptions' => ['style' => 'width: 190px; text-align: right;'],
            ],
            [
                'attribute' => 'withdrawal_address',
                'label' => 'W-addr',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::a('...' . mb_substr($m->withdrawal_address, -6), ['wallets/view', 'id' => $m->id]);
                },
                'contentOptions' => ['style' => 'width: 30px; text-align: right;'],
            ],
            [
                'attribute' => 'balance',
                'format' => 'raw',
                'label' => 'Balances',
                'value' => function ($m) {
                    $null = function ($i) {
                        return empty($i) ? 'null' : (float)$i;
                    };
                    return empty($m->withdrawal_address)
                        ? 'no withdrawal address'
                        : "{$null($m->withdrawal_balance_usdt)} USDT ({$null($m->withdrawal_balance_bnb)} BNB)";
                },
            ],
            /*
            [
                'attribute' => 'network',
                'contentOptions' => ['style' => 'width: 50px;'],
            ],
            */
            //'uid',
            //'bookie',
            [
                'attribute' => 'login',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::a($m->login, ['wallets/view', 'id' => $m->id]);
                },
                //'contentOptions' => ['style' => 'width: 50px;'],
            ],
            [
                'attribute' => 'stakeAccount',
                'label' => 'Betexy name',
                'format' => 'raw',
                'value' => function ($m) {
                    return empty($m->stakeAccount) ? null : Html::a($m->stakeAccount->name,
                        ['/BotManager/stake/view', 'id' => $m->stakeAccount->id]);
                },
                //'contentOptions' => ['style' => 'width: 50px;'],
            ],
            [
                'attribute' => 'mailbox',
                'format' => 'raw',
                'value' => function ($m) {
                    return empty($m->mailbox) ? null : Html::a($m->mailbox->address, ['wallets/view', 'id' => $m->id]);
                },
                //'contentOptions' => ['style' => 'width: 50px;'],
            ],
            //'approved:boolean',
            /*
            [
                'attribute' => 'comment',
                'format' => 'ntext',
            ],
            */
            [
                'attribute' => 'updated_at',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::a(date('d/m/y H:i', $m->updated_at), ['wallets/view', 'id' => $m->id]);
                },
                'contentOptions' => ['style' => 'width: 120px; text-align: right;'],
            ],

            //['class' => 'yii\grid\ActionColumn', 'template' => '{view} {delete}'],
        ],
    ]); ?>

    <?php Pjax::end(); ?>

</div>
