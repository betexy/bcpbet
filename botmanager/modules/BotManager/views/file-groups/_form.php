<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\FileGroups */
/* @var $form yii\widgets\ActiveForm */

$this->registerJs("$('#filegroups-bk_internal').change( 
    function() {
        if ($(this).val() === 'extension') {
            $('#filegroups-type option[value=\"0\"]').prop('selected', true);
        } else {
            $('#filegroups-type option[value=\"1\"]').prop('selected', true);
        }
        if ($('#filegroups-name').val() === '') { 
            $('#filegroups-name').val($(this).find('option:selected').text());    
        } 
     } 
);", $this::POS_READY);

?>

<div class="file-groups-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <?= $form->field($model, 'type')->dropDownList($model::$types) ?>

    <?= $form->field($model, 'name')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'bk_internal')->dropDownList($model::getBkInternals()) ?>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('BotManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
