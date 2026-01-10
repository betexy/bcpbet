<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\FillingOptions */
$this->title = Yii::t('BotManager', $model->name, [], 'ru') . " = {$model->value}";
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Filling Options', [], 'ru'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', $model->name, [], 'ru'), 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('BotManager', 'Update');
?>
<div class="filling-options-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
