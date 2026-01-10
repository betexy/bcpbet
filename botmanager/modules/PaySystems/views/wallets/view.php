<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\PaySystems\models\Wallets */
/* @var $queueDataProvider \yii\data\ActiveDataProvider */

$this->title = 'Deposit addr: ' . $model->deposit_address;
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('pay-systems', 'Wallets'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="wallets-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?php if (!$model->deleted) echo Html::a(Yii::t('pay-systems', 'Update'),
            ['update', 'id' => $model->id], ['class' => 'btn btn-primary']); ?>

        <?php
        if (!empty($model->deleted)) {
            echo Html::a(Yii::t('pay-systems', 'Set not deleted'), ['delete', 'id' => $model->id], [
                'class' => 'btn btn-danger',
                'data' => [
                    'confirm' => Yii::t('pay-systems', 'Are you sure you want to set this item not deleted?'),
                    'method' => 'post',
                ]
            ]);
        } else {
            echo Html::a(Yii::t('pay-systems', 'Delete'), ['delete', 'id' => $model->id], [
                'class' => 'btn btn-danger',
                'data' => [
                    'confirm' => Yii::t('pay-systems', 'Are you sure you want to delete this item?'),
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
            'deposit_address',
            [
                'attribute' => 'withdrawal_address',
                'format' => 'raw',
                'value' => function ($m) {
                    if (empty($m->withdrawal_address)) {
                        $result[] = Html::a(Yii::t('pay-systems', 'Create BSC address'),
                            ['create-address', 'id' => $m->id], ['class' => 'btn btn-warning']);
                    } else {
                        $result[] = Html::textInput('withdrawal_address', $m->withdrawal_address,
                            ['class' => 'form-control', 'style' => 'width: 350px; float: left; margin-right: 10px;',
                                'readonly' => true]);
                    }
                    if (empty($m->mailboxes_id)) {
                        $result[] = 'You should link mailbox!';
                    } else {
                        $result[] =
                            Html::beginForm(['wallet-withdrawal', 'id' => $m->id], 'post', ['class' => 'form-inline'])
                            .
                            Html::textInput('amount', '0',
                                ['class' => 'form-control', 'placeholder' => 'Amount', 'style' => 'width: 100px'])
                            . ' (0 = all) ' .
                            Html::button(Yii::t('pay-systems', 'Withdraw!'),
                                ['type' => 'submit', 'class' => 'btn btn-warning', 'data' => [
                                    'confirm' => Yii::t('pay-systems', 'Are you sure you want withdrawal?'),
                                    'method' => 'post',
                                ]])
                            .
                            Html::endForm();
                    }
                    return implode(' ', $result);
                },
            ],
            [
                'attribute' => 'withdrawal_balance',
                'label' => 'Balance',
                'format' => 'raw',
                'value' => function ($m) {
                    $null = function ($i) {
                        return empty($i) ? 'null' : $i;
                    };
                    return empty($m->withdrawal_address)
                        ? 'you should set withdrawal address first'
                        : "{$null($m->withdrawal_balance_usdt)} USDT ({$null($m->withdrawal_balance_bnb)} BNB) "
                        . Html::a(Yii::t('pay-systems', 'Get actual balance'),
                            ['get-balances', 'id' => $m->id], ['class' => 'btn btn-success']);
                },
            ],
            [
                'attribute' => 'id',
                'label' => 'Send',
                'format' => 'raw',
                'value' => function ($m) {
                    if ((float)$m->withdrawal_balance_bnb === 0.0) {
                        return 'Insufficient BNB balance!';
                    }
                    $currencies = [];
                    if ((float)$m->withdrawal_balance_usdt > 0.0) {
                        $currencies['USDT'] = 'USDT';
                    }
                    $currencies['BNB'] = 'BNB';
                    $data = Yii::$app->session->get('data', []);
                    return
                        Html::beginForm(['send-money', 'id' => $m->id], 'post', ['class' => 'form-inline'])
                        .
                        Html::textInput('amount', empty($data['amount']) ? '' : $data['amount'],
                            ['class' => 'form-control', 'placeholder' => 'Amount', 'style' => 'width: 100px'])
                        . ' ' .
                        Html::textInput('address', empty($data['address']) ? '' : $data['address'],
                            ['class' => 'form-control', 'placeholder' => 'Address', 'style' => 'width: 350px'])
                        . ' ' .
                        Html::dropDownList('currency', empty($data['currency']) ? '' : $data['currency'],
                            $currencies, ['class' => 'form-control'])
                        . ' ' .
                        Html::button(Yii::t('pay-systems', 'Send'), ['type' => 'submit', 'class' => 'btn btn-success'])
                        .
                        Html::endForm();
                },
            ],
            [
                'attribute' => 'id',
                'label' => '',
                'format' => 'raw',
                'value' => function ($m) {
                    $addresses = empty($m->mailbox->address) ? 'no email' : Html::a($m->mailbox->address, [
                        '/emails/mailboxes/view', 'id' => $m->mailbox->id], ['target' => '_blank']);
                    $approved = empty($m->approved) ? 'not approved' : 'approved';
                    $created = $m->created_at === 0 ? null : Yii::$app->formatter->asRelativeTime($m->created_at);
                    $updated = $m->updated_at === 0 ? null : Yii::$app->formatter->asRelativeTime($m->updated_at);
                    return "id: <b>{$m->id}</b>, network: <b>{$m->network}</b>, <b>{$addresses}</b>, "
                        . "<b>{$approved}</b>, created: <b>{$created}</b>, updated: <b>{$updated}</b>";
                },
            ],
            [
                'attribute' => 'uid',
                'label' => '',
                'format' => 'raw',
                'value' => function ($m) {
                    $login = empty($m->stakeAccount) ? $m->login : Html::a($m->stakeAccount->name,
                        ['/BotManager/stake/view', 'id' => $m->stakeAccount->id]);
                    return "uid: <b>{$m->uid}</b>, bookie: <b>{$m->bookie}</b>, login: <b>{$login}</b>";
                },
            ],
            'comment:ntext',
        ],
    ]) ?>

    <?= $this->render('_botQueue', [
        'queueDataProvider' => $queueDataProvider,
    ]) ?>

    <h2>PS queue:</h2>

    <?= $this->render('/paysystems/_psQueue', [
        'dataProvider' => new \yii\data\ActiveDataProvider([
            'query' => \app\modules\PaySystems\models\PaysystemsQueue::find()->where(['like', 'data',
                '"wallet":"' . $model->deposit_address . '"']),
            'pagination' => [
                'pageSize' => 20,
            ],
            'sort' => [
                'defaultOrder' => [
                    'updated_at' => SORT_DESC,
                ]
            ],
        ]),
    ]) ?>

</div>
