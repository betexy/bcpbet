<?php

use app\modules\Emails\models\Mailboxes;
use kartik\select2\Select2;
use yii\helpers\ArrayHelper;
use yii\helpers\Html;
use yii\widgets\ActiveForm;
use kartik\select2\Select2Asset;

Select2Asset::register($this);

/* @var $this yii\web\View */
/* @var $model app\modules\PaySystems\models\Wallets */
/* @var $form yii\widgets\ActiveForm */

$condition = $model->isNewRecord
    ? ['wallets.id' => null]
    : ['OR', ['wallets.id' => $model->id], ['wallets.id' => null]];
$data = ArrayHelper::merge(['0' => 'not set'], ArrayHelper::map(Mailboxes::find()->joinWith('wallet')
    ->where($condition)->all(), 'id', 'address'));

?>

<div class="wallets-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <?= $form->field($model, 'deposit_address')->textInput(['maxlength' => true, 'readonly' => !$model->isNewRecord]) ?>

    <?= $form->field($model, 'withdrawal_address')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'withdrawal_balance_usdt')->textInput(['maxlength' => true, 'readonly' => true]) ?>

    <?= $form->field($model, 'withdrawal_balance_bnb')->textInput(['maxlength' => true, 'readonly' => true]) ?>

    <?= $form->field($model, 'network')->dropDownList(['bsc' => 'Binance Smart Chain']) ?>

    <?= $form->field($model, 'uid')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'bookie')->textInput(['maxlength' => true, 'value' => $model->isNewRecord ? 'STAKE' : $model->bookie]) ?>

    <?= $form->field($model, 'login')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'mailboxes_id')->widget(Select2::class, [
        'data' => $data,
        'value' => $model->isNewRecord ? '0' : $model->mailboxes_id,
        'options' => [
            'placeholder' => Yii::t('pay-system', 'Select a mailbox...'),
            'class' => 'form-control', // add the same class as DropDownList
        ],
        'theme' => 'default', // apply the default theme
    ])->label(Yii::t('pay-system', 'Mailbox')); ?>

    <br/>

    <?= $form->field($model, 'approved')->checkbox() ?>

    <?= $form->field($model, 'comment')->textarea() ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('pay-systems', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
