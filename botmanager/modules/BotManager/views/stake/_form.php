<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\StakeAccounts */
/* @var $form yii\widgets\ActiveForm */

?>

<div class="stake-accounts-form">

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            'id',
            //'deleted',
            'name',
            'mailbox.address',
            'register',
            'configs_stakes',
            'browser',
            'profile:ntext',
            'login:ntext',
            'password:ntext',
            //'comment:ntext',
            'registered_at:datetime',
            'created_at:datetime',
            'updated_at:datetime',
        ],
    ]) ?>

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <?= $form->field($model, 'comment')->textarea(['rows' => 4]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('BotManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
