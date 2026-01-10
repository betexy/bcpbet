<?php

use yii\helpers\Html;
use yii\helpers\Url;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\rdpTable */
/* @var $form yii\widgets\ActiveForm */

?>

<div class="server-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <?php if ($model->isNewRecord) { ?>
        <h4 style="color: red;">Creating new server (table)!</h4>
    <?php } ?>

    <?= $form->field($model, 'name')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'guacamole_link')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'yc_id')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'yc_account')->dropDownList([1 => 'First', 2 => 'Second']) ?>

    <?= $form->field($model, 'ip')->textarea(['rows' => 1, 'readonly' => true, 'disabled' => true,
        'id' => 'serverIp']) ?>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('BotManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
