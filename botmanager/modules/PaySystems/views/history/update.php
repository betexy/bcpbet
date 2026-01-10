<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\PaySystems\models\History */

$this->title = $model->title;
$this->params['breadcrumbs'][] = ['label' => 'Pay systems', 'url' => ['/pay-systems']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('PaySystems', 'Transactions History'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' => $model->id, 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('PaySystems', 'Update');
?>
<div class="history-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
