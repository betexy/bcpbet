<?php

use yii\helpers\Html;


/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\RdpTable */

$this->title = Yii::t('BotManager', 'Create Server (table)');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Servers'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="server-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_formTable', [
        'model' => $model,
    ]) ?>

</div>
