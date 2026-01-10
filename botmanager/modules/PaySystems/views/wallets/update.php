<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\PaySystems\models\Wallets */

$this->title = Yii::t('pay-systems', 'Update Wallet: {name}', [
    'name' => $model->id,
]);
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('pay-systems', 'Wallets'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' => $model->id, 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('pay-systems', 'Update');
?>
<div class="wallets-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
