<?php

use app\modules\BotManager\models\Proxies;
use kartik\select2\Select2;
use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Proxies */
/* @var $form yii\widgets\ActiveForm */

if ($model->isNewRecord) {
    $model->provider = 'luminati';
}

?>

<div class="proxies-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->field($model, 'provider')->dropDownList(Proxies::$providers) ?>

    <?= $form->field($model, 'name')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'protocol')->dropDownList(Proxies::$protocols) ?>

    <?= $form->field($model, 'host')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'port')->textInput() ?>

    <?= $form->field($model, 'country')->widget(Select2::class, [
        'data' => Proxies::$countries,
        'options' => [
            'placeholder' => Yii::t('BotManager', 'Select country...'),
            'class' => 'form-control', // add the same class as DropDownList
        ],
        'theme' => 'default', // apply the default theme
    ])->label(Yii::t('BotManager', 'Country')); ?>

    <?= $form->field($model, 'login')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'password')->textInput(['maxlength' => true]) ?>

    <?= $form->field($model, 'is_mobile')->dropDownList([0 => 'No', 1 => 'Yes']) ?>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('BotManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
