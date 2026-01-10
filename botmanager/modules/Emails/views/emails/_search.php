<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\Emails\models\EmailsSearch */
/* @var $form yii\widgets\ActiveForm */
?>

<div class="emails-search">

    <?php $form = ActiveForm::begin([
        'action' => ['index'],
        'method' => 'get',
        'options' => [
            'data-pjax' => 1
        ],
    ]); ?>

    <?= $form->field($model, 'id') ?>

    <?= $form->field($model, 'created_at') ?>

    <?= $form->field($model, 'updated_at') ?>

    <?= $form->field($model, 'e_mailboxes_id') ?>

    <?= $form->field($model, 'imap_id') ?>

    <?php // echo $form->field($model, 'message_id') ?>

    <?php // echo $form->field($model, 'imap_datetime') ?>

    <?php // echo $form->field($model, 'from_name') ?>

    <?php // echo $form->field($model, 'from_address') ?>

    <?php // echo $form->field($model, 'to') ?>

    <?php // echo $form->field($model, 'to_string') ?>

    <?php // echo $form->field($model, 'cc') ?>

    <?php // echo $form->field($model, 'reply_to') ?>

    <?php // echo $form->field($model, 'subject') ?>

    <?php // echo $form->field($model, 'text_plain') ?>

    <?php // echo $form->field($model, 'text_html') ?>

    <?php // echo $form->field($model, 'attachments') ?>

    <?php // echo $form->field($model, 'comment') ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('Emails', 'Search'), ['class' => 'btn btn-primary']) ?>
        <?= Html::resetButton(Yii::t('Emails', 'Reset'), ['class' => 'btn btn-default']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
