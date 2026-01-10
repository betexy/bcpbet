<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\Accounts\models\AccountSearch */
/* @var $form yii\widgets\ActiveForm */
?>

<div class="account-search">

    <?php $form = ActiveForm::begin([
        'action' => ['index'],
        'method' => 'get',
        'options' => [
            'data-pjax' => 1
        ],
    ]); ?>

    <?= $form->field($model, 'id') ?>

    <?= $form->field($model, 'first_name') ?>

    <?= $form->field($model, 'second_name') ?>

    <?= $form->field($model, 'third_name') ?>

    <?= $form->field($model, 'birth_date') ?>

    <?php // echo $form->field($model, 'email') ?>

    <?php // echo $form->field($model, 'email_password') ?>

    <?php // echo $form->field($model, 'phone') ?>

    <?php // echo $form->field($model, 'comment') ?>

    <?php // echo $form->field($model, 'created_at') ?>

    <?php // echo $form->field($model, 'name') ?>

    <?php // echo $form->field($model, 'has_passport') ?>

    <?php // echo $form->field($model, 'has_registration') ?>

    <?php // echo $form->field($model, 'has_selfie') ?>

    <?php // echo $form->field($model, 'has_driver_license') ?>

    <?php // echo $form->field($model, 'has_address_verification') ?>

    <?php // echo $form->field($model, 'has_skrill_verification') ?>

    <?php // echo $form->field($model, 'has_qiwi_verification') ?>

    <?php // echo $form->field($model, 'city') ?>

    <?php // echo $form->field($model, 'postal_code') ?>

    <?php // echo $form->field($model, 'address') ?>

    <?php // echo $form->field($model, 'skrill_login') ?>

    <?php // echo $form->field($model, 'skrill_password') ?>

    <?php // echo $form->field($model, 'qiwi_login') ?>

    <?php // echo $form->field($model, 'qiwi_password') ?>

    <?php // echo $form->field($model, 'first_name_en') ?>

    <?php // echo $form->field($model, 'second_name_en') ?>

    <?php // echo $form->field($model, 'city_en') ?>

    <?php // echo $form->field($model, 'address_en') ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('Emails', 'Search'), ['class' => 'btn btn-primary']) ?>
        <?= Html::resetButton(Yii::t('Emails', 'Reset'), ['class' => 'btn btn-default']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
