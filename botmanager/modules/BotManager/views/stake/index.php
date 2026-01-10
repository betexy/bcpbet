<?php

use app\modules\BotManager\models\StakeAccounts;
use app\modules\PaySystems\models\Paysystems;
use yii\helpers\ArrayHelper;
use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\ActiveForm;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\StakeAccountsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */
/* @var $model app\modules\BotManager\models\StakeAccountsCreateForm */
/* @var $deleted boolean */

$this->title = Yii::t('BotManager', 'Stake Accounts');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="stake-accounts-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <div class="row">

        <?php if (empty($deleted)) { ?>

            <?php $form = ActiveForm::begin(); ?>

            <?= $model->createdAccounts > 0 ? "<div class='alert alert-success'>Created {$model->createdAccounts} accounts</div>" : '' ?>

            <?= $form->errorSummary($model); ?>

            <div class="col-md-2">
                <?= $form->field($model, 'numberOfAccounts')->textInput(['maxlength' => true]) ?>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'configsAndStakes')->textInput(['maxlength' => true]) ?>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'fillUpAmount')->textInput(['maxlength' => true]) ?>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'binanceApiId')->dropDownList(ArrayHelper::map(Paysystems::findAll(['type' => 5]), 'id', 'login')) ?>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'browser')->dropDownList(StakeAccounts::$browsers) ?>
            </div>
            <div class="col-md-1">
                <?= Html::submitButton(Yii::t('BotManager', 'Create Stake Accounts'), ['class' => 'btn btn-success']) ?>
            </div>
            <?php ActiveForm::end(); ?>
        <?php } ?>

    </div>
    <p>
        <a>&nbsp;</a>
        <?php if ($deleted) {
            echo Html::a(Yii::t('BotManager', 'Show not deleted'), ['stake/index'], ['class' => 'btn btn-success', 'style' => 'float: right;',]);
        } else {
            if (StakeAccounts::find()->where(['deleted' => 1])->count() > 0) {
                echo Html::a(Yii::t('BotManager', 'Show deleted'), ['stake/deleted'], ['class' => 'btn btn-danger', 'style' => 'float: right;',]);
            }
        } ?>
    </p>

    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
            //['class' => 'yii\grid\SerialColumn'],

            //'id',
            //'deleted',
            [
                'attribute' => 'name',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::a($m->name, ['stake/view', 'id' => $m->id]);
                },
                //'contentOptions' => ['style' => 'width: 50px; text-align: right;'],
            ],
            [
                'attribute' => 'betexy_id',
                'format' => 'raw',
                'value' => function ($m) {
                    return $m->betexy_id ? Html::a($m->betexy_id, 'https://cloud.betexy.com/rooms/create?id='
                        . $m->betexy_id, ['target' => '_blank']) : null;
                },
            ],
            [
                'attribute' => 'login',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::a($m->login, ['stake/view', 'id' => $m->id]);
                },
                //'contentOptions' => ['style' => 'width: 50px; text-align: right;'],
            ],
            [
                'attribute' => 'wallet',
                'format' => 'raw',
                'value' => function ($m) {
                    return empty($m->wallet) ? null
                        : Html::a('...' . mb_substr($m->wallet->deposit_address, -6),
                            ['/pay-systems/wallets/view', 'id' => $m->wallet->id]);
                },
                //'contentOptions' => ['style' => 'width: 50px; text-align: right;'],
            ],
            [
                'attribute' => 'mailbox',
                'format' => 'raw',
                'value' => function ($m) {
                    return empty($m->mailbox) ? null : Html::a($m->mailbox->address, ['/emails/mailboxes/view', 'id' => $m->mailbox->id]);
                },
            ],
            [
                'attribute' => 'proxy',
                'format' => 'raw',
                'value' => function ($m) {
                    return empty($m->proxy) ? null : Html::a($m->proxy->host, ['proxies/view', 'id' => $m->proxy->id]);
                },
            ],
            //'register',
            //'configs_stakes',
            //'browser',
            'profile:ntext',
            //'login:ntext',
            //'password:ntext',
            'registered_at:datetime',
            [
                'attribute' => 'comment',
                'format' => 'raw',
                'value' => function ($m) {
                    return empty($m->comment) ? null : Html::a($m->comment, ['stake/view', 'id' => $m->id]);
                },
            ],
            //'created_at',
            //'updated_at',

            //['class' => 'yii\grid\ActionColumn'],
        ],
    ]); ?>

    <?php Pjax::end(); ?>

</div>
