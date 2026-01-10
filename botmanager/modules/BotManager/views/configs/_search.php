<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\ConfigsSearch */
/* @var $form yii\widgets\ActiveForm */
?>

<div class="configs-search">

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

    <?= $form->field($model, 'bookie') ?>

    <?= $form->field($model, 'source') ?>

    <?= $form->field($model, 'is_fork') ?>

    <?php // echo $form->field($model, 'url') ?>

    <?php // echo $form->field($model, 'eventTimeLimit') ?>

    <?php // echo $form->field($model, 'eventMaxBets') ?>

    <?php // echo $form->field($model, 'stake') ?>

    <?php // echo $form->field($model, 'coefFrom') ?>

    <?php // echo $form->field($model, 'coefTo') ?>

    <?php // echo $form->field($model, 'incomeFrom') ?>

    <?php // echo $form->field($model, 'incomeTo') ?>

    <?php // echo $form->field($model, 'lastScoreTennis') ?>

    <?php // echo $form->field($model, 'lastScoreBasketball') ?>

    <?php // echo $form->field($model, 'excludeSports') ?>

    <?php // echo $form->field($model, 'excludeMarkets') ?>

    <?php // echo $form->field($model, 'excludeTargets') ?>

    <?php // echo $form->field($model, 'excludePivots') ?>

    <?php // echo $form->field($model, 'excludeBets') ?>

    <?php // echo $form->field($model, 'excludeLeagues') ?>

    <?php // echo $form->field($model, 'excludeSportMarketTarget') ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('configs', 'Search'), ['class' => 'btn btn-primary']) ?>
        <?= Html::resetButton(Yii::t('configs', 'Reset'), ['class' => 'btn btn-outline-secondary']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
