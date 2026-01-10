<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;
use app\modules\Emails\models\Screenshots;

/* @var $this yii\web\View */
/* @var $model app\modules\Emails\models\Screenshots */
/* @var $form yii\widgets\ActiveForm */
?>

<div class="screenshots-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->field($model, 'name')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'tag')->textInput(['maxlength' => true, 'list' => 'tag_list']) ?>
    <datalist id="tag_list">
        <?php foreach (Screenshots::find()->select('tag')->distinct()->orderBy(['tag' => 'ASC'])->all() as $value) { ?>
            <option value="<?= $value->tag ?>"><?= $value->tag ?></option>
        <?php } ?>
    </datalist>

    <?= $form->field($model, 'description')->textarea(['rows' => 4]) ?>

    <?= $form->field($model, 'comment')->textarea(['rows' => 4]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('Emails', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
