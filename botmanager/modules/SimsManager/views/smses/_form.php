<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\SimsManager\models\Smses */
/* @var $form yii\widgets\ActiveForm */
?>

<div class="smses-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= \yii\widgets\DetailView::widget([
        'model' => $model,
        'attributes' => [
            'id',
            'receive_id',
            'number',
            'scrum',
            'provid',
            'msg:ntext',
            'time_received',
            'goip_name',
            'sims_channels_id',
            'status',
            'smscnum',
            'senttime',
        ],
    ]) ?>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('SimsManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
