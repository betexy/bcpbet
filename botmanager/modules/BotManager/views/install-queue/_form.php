<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\RdpInstallQueue */
/* @var $form yii\widgets\ActiveForm */
?>

<div class="rdp-install-queue-form">

    <p><?= Html::errorSummary($model) ?></p>

    <?php $form = ActiveForm::begin(); ?>
    <?php if (empty($model->id)) { ?>
        <?= $form->field($model, 'ip')->textInput() ?>
        <?= $form->field($model, 'root_password')->textInput() ?>
        <?= $form->field($model, 'name')->textInput() ?>
        <?= $form->field($model, 'socket')->dropDownList([
            'wss://bcp.one/bot-server' => 'wss://bcp.one/bot-server',
            'wss://bcp.bet/bot-server' => 'wss://bcp.bet/bot-server',
        ]) ?>
    <? } else {
        $command = json_decode($model->command, true);
        if (!empty($command) && !empty($command['data']) && is_array($command['data'])) {
            echo Html::hiddenInput('RdpInstallQueue[ip]', $command['data']['ip']) . "\n";
            echo Html::hiddenInput('RdpInstallQueue[root_password]', $command['data']['root_password']) . "\n";
            echo Html::hiddenInput('RdpInstallQueue[name]', $command['data']['name']) . "\n";
            echo Html::hiddenInput('RdpInstallQueue[socket]', $command['data']['socket']) . "\n";
        }
    } ?>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('BotManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
