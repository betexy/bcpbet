<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;
use yii\helpers\ArrayHelper;

/* @var $this yii\web\View */
/* @var $model app\modules\SimsManager\models\Sims */
/* @var $form yii\widgets\ActiveForm */

$this->registerJsFile(\yii\helpers\Url::toRoute(['/BotManager/files/internal-js', 'name' => 'chosen.jquery.min.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerCssFile(\yii\helpers\Url::toRoute(['/BotManager/files/internal-js', 'name' => 'chosen.min.css']));

$this->registerJs("$('#sims_slot').chosen();", $this::POS_READY);

if (!empty($model->slot)) {
    $model->sims_slots_id = $model->slot->id;
}

?>

<div class="sims-form">

    <?php $form = ActiveForm::begin(); ?>

    <div class="row">
        <div class="col-md-4">
            <?= $form->field($model, 'number')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="row">
        <div class="col-md-4">
            <?= $form->field($model, 'sims_slots_id')->dropDownList(
                ArrayHelper::merge(['' => '---'],
                    ArrayHelper::map(\app\modules\SimsManager\models\Slots::find()->all(), 'id', 'id')),
                ['multiple' => false, 'id' => 'sims_slot', 'class' => 'form-control',]
            ) ?>
        </div>
    </div>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('SimsManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
