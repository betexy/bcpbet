<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;
use yii\helpers\ArrayHelper;
use app\modules\Accounts\models\Account;
use app\models\Bookmaker;

/* @var $this yii\web\View */
/* @var $model app\modules\Accounts\models\AccountBookmaker */
/* @var $form yii\widgets\ActiveForm */
?>

<div class="account-bookmaker-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->field($model, 'account_id')->dropDownList(ArrayHelper::map(Account::find()->all(), 'id', function ($i) {
        return "{$i->first_name} {$i->second_name} {$i->third_name}";
    })) ?>

    <?= $form->field($model, 'bookmaker_id')->dropDownList(ArrayHelper::map(Bookmaker::find()->all(), 'id', 'name')) ?>

    <?= $form->field($model, 'bm_login')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'bm_password')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'comment')->textarea(['rows' => 3]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('Emails', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
