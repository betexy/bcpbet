<?php

use yii\web\View;
use app\modules\Emails\models\MailsettingsForm;
use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this View */
/* @var $model MailsettingsForm */

$this->title = Yii::t('Emails', 'Mail Settings');
$this->params['breadcrumbs'][] = ['label' => 'Emails', 'url' => ['/emails']];
$this->params['breadcrumbs'][] = $this->title;

?>

<div class="mailsettings-update">
    <h1><?= Html::encode($this->title) ?></h1>

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <h3>Mail.ru:</h3>

    <div class="row">
        <div class="col-md-10">
            <?= $form->field($model, 'type_0_IMAP')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'type_0_IMAP_port')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <h3>Yandex.ru:</h3>

    <div class="row">
        <div class="col-md-10">
            <?= $form->field($model, 'type_1_IMAP')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'type_1_IMAP_port')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <h3>Gmail.com:</h3>

    <div class="row">
        <div class="col-md-10">
            <?= $form->field($model, 'type_2_IMAP')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'type_2_IMAP_port')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <h3>Yahoo.com:</h3>

    <div class="row">
        <div class="col-md-10">
            <?= $form->field($model, 'type_3_IMAP')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'type_3_IMAP_port')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <h3>inbox.eu:</h3>

    <div class="row">
        <div class="col-md-10">
            <?= $form->field($model, 'type_4_IMAP')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'type_4_IMAP_port')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <h3>mail.uk:</h3>

    <div class="row">
        <div class="col-md-10">
            <?= $form->field($model, 'type_5_IMAP')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'type_5_IMAP_port')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <h3>Outlook:</h3>

    <div class="row">
        <div class="col-md-10">
            <?= $form->field($model, 'type_7_IMAP')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'type_7_IMAP_port')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="form-group">
        <br/>
        <?= Html::submitButton(Yii::t('BotManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>

