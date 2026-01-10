<?php

/* @var $this yii\web\View */
/* @var $model app\modules\PaySystems\models\History */
/* @var $paySystems app\modules\PaySystems\models\Paysystems[] */

/* @var $form yii\widgets\ActiveForm */

use yii\helpers\Html;
use yii\widgets\ActiveForm;

$currencies = [4 => 'USDT', 5 => 'BNB', 6 => 'LTC',];

$this->title = Yii::t('pay-systems', 'Withdrawal from PS');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('pay-systems', 'Wallets'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;

?>

<div class="wallets-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <?= Html::hiddenInput('History[datetime]', time()) ?>

    <?= Html::hiddenInput('History[datetime_string]', date('Y-m-d H:i:s')) ?>

    <?= $form->field($model, 'ps_paysystems_id')->dropDownList($paySystems) ?>

    <?= $form->field($model, 'currency')->dropDownList($currencies) ?>

    <?= $form->field($model, 'receiver')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'amount')->textInput(['maxlength' => true, 'type' => 'number', 'step' => '0.001']) ?>

    <?= Html::submitButton(Yii::t('pay-systems', 'Withdraw'), ['class' => 'btn btn-success']) ?>

    <?php ActiveForm::end(); ?>

</div>

