<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Xbots */

$this->title = Yii::t('BotManager', 'Update Xbots: {name}', [
    'name' => $model->name,
]);
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Xbots'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' => $model->name, 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('BotManager', 'Update');
?>
<div class="xbots-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
