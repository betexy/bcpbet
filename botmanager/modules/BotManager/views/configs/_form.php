<?php

use app\modules\BotManager\models\Configs;
use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Configs */
/* @var $form yii\widgets\ActiveForm */


?>

<div class="configs-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <?= $form->field($model, 'name')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'bookie')->dropDownList($model::getBookies()) ?>

    <?= $form->field($model, 'express')->dropDownList([0 => 'No', 1 => 'Yes']) ?>

    <?= $form->field($model, 'new_expresses')->dropDownList([0 => 'No', 1 => 'Yes']) ?>

    <?= $form->field($model, 'is_fork')->dropDownList([0 => 'No', 1 => 'Yes']) ?>

    <?= $form->field($model, 'second_bookie')->dropDownList($model::getBookies(true)) ?>

    <?= $form->field($model, 'source')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'currency')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'url')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'eventTimeLimit')->textInput() ?>

    <?= $form->field($model, 'eventMaxBets')->textInput() ?>

    <?= $form->field($model, 'successBetInterval')->textInput() ?>

    <?= $form->field($model, 'stake')->textInput() ?>

    <?= $form->field($model, 'coefFrom')->textInput() ?>

    <?= $form->field($model, 'coefTo')->textInput() ?>

    <?= $form->field($model, 'incomeFrom')->textInput() ?>

    <?= $form->field($model, 'incomeTo')->textInput() ?>

    <?= $form->field($model, 'lastScoreTennis')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'lastScoreBasketball')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'excludeSports')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'excludeMarkets')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'excludeTargets')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'excludePivots')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'excludeBets')->textarea(['rows' => 3]) ?>

    <?= $form->field($model, 'excludeLeagues')->textarea(['rows' => 3]) ?>

    <?= $form->field($model, 'onlyLeagues')->textarea(['rows' => 3]) ?>

    <?= $form->field($model, 'excludeSportMarketTarget')->textarea(['rows' => 3]) ?>

    <?= $form->field($model, 'onlySecondBookie')->listBox(Configs::getSecondBookies(), ['multiple' => true]) ?>

    <?= $form->field($model, 'skipPinnacleBetfairForks')->dropDownList([0 => 'No', 1 => 'Yes']) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('configs', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
