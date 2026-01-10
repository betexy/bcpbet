<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\SimsManager\models\Slots */

$this->title = Yii::t('SimsManager', 'Update Slots: ' . $model->slot_id, [
    'nameAttribute' => '' . $model->id,
]);
$this->params['breadcrumbs'][] = ['label' => Yii::t('SimsManager', 'Slots'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' => $model->slot_id, 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('SimsManager', 'Update');
?>
<div class="slots-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
