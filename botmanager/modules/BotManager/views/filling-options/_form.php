<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\FillingOptions */
/* @var $form yii\widgets\ActiveForm */
?>

<div style="color: red; font-size: 20px; font-weight: bold">
    Будьте внимательны!
    <br />
    При заполнении типа «Страна, город» необходимо в качестве разделителя использовать точку с запятой:
    <pre>Moldova; Kishinev</pre>
</div>
<br />
<div class="filling-options-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->field($model, 'name')->dropDownList(\app\modules\BotManager\models\FillingOptions::getOptions()) ?>

    <?= $form->field($model, 'value')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('BotManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
