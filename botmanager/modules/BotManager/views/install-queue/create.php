<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\RdpInstallQueue */

$this->title = Yii::t('BotManager', 'Create Install Queue');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => 'Servers', 'url' => ['/BotManager/server']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Install Queue'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="rdp-install-queue-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
