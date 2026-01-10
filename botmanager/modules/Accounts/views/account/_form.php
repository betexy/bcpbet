<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\Accounts\models\Account */
/* @var $form yii\widgets\ActiveForm */
?>

<div class="account-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-3">
            <?= $form->field($model, 'first_name')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'second_name')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'third_name')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'birth_date')->textInput(['maxlength' => true, 'placeholder' => 'YYYY-MM-DD']) ?>
        </div>
    </div>
    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-3">
            <?= $form->field($model, 'email')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'email_password')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'phone')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'city')->textInput(['maxlength' => true]) ?>
        </div>
    </div>
    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-2">
            <?= $form->field($model, 'postal_code')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-10">
            <?= $form->field($model, 'address')->textInput(['maxlength' => true]) ?>
        </div>
    </div>
    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-1">
            <?= $form->field($model, 'has_passport')->checkbox() ?>
        </div>
        <div class="col-md-1">
            <?= $form->field($model, 'has_registration')->checkbox() ?>
        </div>
        <div class="col-md-1">
            <?= $form->field($model, 'has_selfie')->checkbox() ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'has_driver_license')->checkbox() ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'has_address_verification')->checkbox() ?>
        </div>
        <div class="col-md-1">
            <?= $form->field($model, 'has_skrill_verification')->checkbox() ?>
        </div>
        <div class="col-md-1">
            <?= $form->field($model, 'has_qiwi_verification')->checkbox() ?>
        </div>
    </div>

    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-3">
            <?= $form->field($model, 'skrill_login')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'skrill_password')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'qiwi_login')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'qiwi_password')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-3">
            <?= $form->field($model, 'first_name_en')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'second_name_en')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'city_en')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'address_en')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <?= $form->field($model, 'comment')->textarea(['rows' => 3]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('Emails', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
