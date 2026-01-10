<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\BotsSearch */
/* @var $form yii\widgets\ActiveForm */
?>

<div class="bots-search">

    <?php $form = ActiveForm::begin([
        'action' => ['index'],
        'method' => 'get',
        'options' => [
            'data-pjax' => 1
        ],
    ]); ?>

    <?= $form->field($model, 'id') ?>

    <?= $form->field($model, 'virtual_machine_uid') ?>

    <?= $form->field($model, 'virtual_machine_name') ?>

    <?= $form->field($model, 'websocket_url') ?>

    <?= $form->field($model, 'websocket_uid') ?>

    <?php // echo $form->field($model, 'test_mode_on') ?>

    <?php // echo $form->field($model, 'test_url') ?>

    <?php // echo $form->field($model, 'extension_id') ?>

    <?php // echo $form->field($model, 'default_bk_id') ?>

    <?php // echo $form->field($model, 'multilogin_profile_name') ?>

    <?php // echo $form->field($model, 'last_request') ?>

    <?php // echo $form->field($model, 'comment') ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('BotManager', 'Search'), ['class' => 'btn btn-primary']) ?>
        <?= Html::resetButton(Yii::t('BotManager', 'Reset'), ['class' => 'btn btn-default']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
