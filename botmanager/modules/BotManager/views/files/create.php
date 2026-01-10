<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

use app\modules\BotManager\models\Files;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Files */

$this->title = Yii::t('BotManager', $model->isNewRecord ? 'Create Files' : "Update file: {$model->name}");
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Files'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
$options = ['enctype' => 'multipart/form-data'];
if (!$model->isNewRecord) {
    $options['action'] = ['update-file', 'id' => $model->id];
}
?>
<div class="files-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?php $form = ActiveForm::begin(['options' => $options]); ?>

    <?= $form->errorSummary($model); ?>

    <?= $form->field($model, 'file_name')->fileInput(['accept' => '.js, .json, .html, .png, .zip, .exe, .dll']) ?>

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
        <?= Html::submitButton(Yii::t('BotManager', 'Upload'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
