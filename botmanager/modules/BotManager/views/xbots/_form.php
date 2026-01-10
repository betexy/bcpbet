<?php

use app\modules\BotManager\models\Xbots;
use yii\helpers\ArrayHelper;
use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Xbots */
/* @var $form yii\widgets\ActiveForm */

$bookies = ArrayHelper::map(Xbots::find()->select('bookie')->orderBy('bookie')->distinct()->asArray()->all(), 'bookie', 'bookie');

?>

<div class="xbots-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->field($model, 'betexy_bot_id')->textInput() ?>

    <?= $form->field($model, 'betexy_user_id')->textInput() ?>

    <?= $form->field($model, 'name')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'bookie')->dropDownList($bookies, ['class' => 'form-control',]) ?>

    <?= $form->field($model, 'due_date')->textInput() ?>

    <?= $form->field($model, 'active')->checkbox() ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('BotManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
