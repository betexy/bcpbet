<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\SimsManager\models\SmsesSearch */
/* @var $form yii\widgets\ActiveForm */
?>

<div class="smses-search">

    <?php $form = ActiveForm::begin([
        'action' => ['index'],
        'method' => 'get',
        'options' => [
            'data-pjax' => 1
        ],
    ]); ?>

    <?= $form->field($model, 'id') ?>

    <?= $form->field($model, 'receive_id') ?>

    <?= $form->field($model, 'number') ?>

    <?= $form->field($model, 'scrum') ?>

    <?= $form->field($model, 'provid') ?>

    <?php // echo $form->field($model, 'msg') ?>

    <?php // echo $form->field($model, 'time_received') ?>

    <?php // echo $form->field($model, 'goip_name') ?>

    <?php // echo $form->field($model, 'sims_channels_id') ?>

    <?php // echo $form->field($model, 'status') ?>

    <?php // echo $form->field($model, 'smscnum') ?>

    <?php // echo $form->field($model, 'senttime') ?>

    <?php // echo $form->field($model, 'comment') ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('SimsManager', 'Search'), ['class' => 'btn btn-primary']) ?>
        <?= Html::resetButton(Yii::t('SimsManager', 'Reset'), ['class' => 'btn btn-default']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
