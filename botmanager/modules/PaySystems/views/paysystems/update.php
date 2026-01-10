<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\PaySystems\models\Paysystems */

$this->title = $model->title;
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('PaySystems', 'Paysystems'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' => $this->title, 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('PaySystems', 'Update');
?>
<div class="paysystems-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
