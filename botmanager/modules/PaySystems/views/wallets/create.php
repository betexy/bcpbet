<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\PaySystems\models\Wallets */

$this->title = Yii::t('pay-systems', 'Create Wallet');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('pay-systems', 'Wallets'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="wallets-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
