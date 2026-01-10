<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

use app\modules\BotManager\models\Files;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Files */
/* @var $form yii\widgets\ActiveForm */
?>

<div class="files-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <?= $form->field($model, 'name')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'source_name')->textInput(['maxlength' => true]) ?>
    <div class="form-group">
        <span style="font-weight: bold; color: red;">
            Warning! Source name is used as filename when download or pack into the extension!
        </span>
    </div>

    <div class="row">
        <div class="col-md-6">
            <?= $form->field($model, 'source_path')->textInput(['maxlength' => true, 'list' => 'source_path_list']) ?>
            <datalist id="source_path_list">
                <?php foreach (Files::$sourcePaths as $value) { ?>
                    <option value="<?= $value ?>"/>
                <?php } ?>
            </datalist>
        </div>
        <div class="col-md-6">
            <?= $form->field($model, 'tag')->textInput(['maxlength' => true, 'list' => 'tags_list']) ?>
            <datalist id="tags_list">
                <?php foreach (Files::$tags as $value) { ?>
                    <option value="<?= $value ?>"/>
                <?php } ?>
            </datalist>
        </div>
    </div>

    <div class="form-group">
        <span style="font-weight: bold; color: red;">
            Warning! Source Path must contain pattern in the resultant archive! ( <span style="font-family: monospace;">@root/</span> - means "..")
        </span>
    </div>

    <div class="form-group">
        <label class="control-label" for="">File Name:</label>
        <?= $model->file_name ?>
    </div>

    <div class="form-group">
        <label class="control-label" for="">File Path:</label>
        <?= $model->file_path ?>
    </div>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('BotManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
