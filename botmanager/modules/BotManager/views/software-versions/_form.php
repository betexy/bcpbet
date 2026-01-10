<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;
use yii\helpers\ArrayHelper;

use app\modules\BotManager\models\FileGroups;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\SoftwareVersions */
/* @var $form yii\widgets\ActiveForm */
/* @var string[] $filesArray */

?>

<div class="software-versions-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->field($model, 'name')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'code')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'file_groups_id')
        ->dropDownList(ArrayHelper::map(FileGroups::findAll(['type' => 2]), 'id', 'name')) ?>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <div class="form-group">
        Note! For config-windows and config-linux comment field uses as content, example:
        <pre>
            [{"section":"Multilogin","option":"restart_delay","value":45000},{"section":"Testing","option":"example","value":"for example"}]
        </pre>
    </div>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('BotManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
