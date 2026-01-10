<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\Emails\models\Mailboxes */
/* @var $form yii\widgets\ActiveForm */
?>

<div class="mailboxes-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <?php if (!$model->isNewRecord) { ?>

        <div class="row">
            <div class="col-md-4">
                <label class="control-label" for="mailboxes-checked_at">Checked At</label>
                <?= Html::input('text', 'checked_at',
                    empty($model->checked_at) ? 'Not checked' : Yii::$app->formatter->asDatetime($model->checked_at),
                    ['class' => 'form-control', 'readonly' => true, 'id' => 'mailboxes-checked_at']) ?>
            </div>
            <div class="col-md-4">
                <label class="control-label" for="mailboxes-created_at">Created At</label>
                <?= Html::input('text', 'created_at', Yii::$app->formatter->asDatetime($model->created_at),
                    ['class' => 'form-control', 'readonly' => true, 'id' => 'mailboxes-created_at']) ?>
            </div>
            <div class="col-md-4">
                <label class="control-label" for="mailboxes-updated_at">Updated At</label>
                <?= Html::input('text', 'updated_at', Yii::$app->formatter->asDatetime($model->updated_at),
                    ['class' => 'form-control', 'readonly' => true, 'id' => 'mailboxes-updated_at']) ?>
            </div>
        </div>
        <br />
    <?php } ?>

    <div class="row">
        <div class="col-md-2">
            <?= $form->field($model, 'type')->dropDownList($model::$types) ?>
        </div>
        <div class="col-md-8">
            <?= $form->field($model, 'address')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-2">
            <br />
            <?= $form->field($model, 'do_not_use')->checkbox() ?>
        </div>
    </div>

    <div class="row">
        <div class="col-md-3">
            <?= $form->field($model, 'login')->textInput() ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'password')->textInput() ?>
        </div>
        <div class="col-md-6">
            <?= $form->field($model, 'secret')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('Emails', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
