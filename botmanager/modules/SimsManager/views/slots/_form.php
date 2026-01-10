<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\SimsManager\models\Slots */
/* @var $form yii\widgets\ActiveForm */
?>

<div class="slots-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->field($model, 'slot_id')->textInput(['readonly' => true]) ?>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('SimsManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
