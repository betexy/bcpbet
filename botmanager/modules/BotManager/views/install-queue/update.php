<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\RdpInstallQueue */

$this->title = Yii::t('BotManager', 'Update Install Queue: {name}', [
    'name' => $model->id,
]);
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => 'Servers', 'url' => ['/BotManager/server']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Rdp Install Queues'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' => $model->id, 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('BotManager', 'Update');
?>
<div class="rdp-install-queue-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
