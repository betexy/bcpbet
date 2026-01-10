<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\SimsManager\models\Sims */

$this->title = Yii::t('SimsManager', 'SIM: ' . $model->number, [
    'nameAttribute' => '' . $model->id,
]);
$this->params['breadcrumbs'][] = ['label' => Yii::t('SimsManager', 'Sims'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' => 'SIM '.$model->number, 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('SimsManager', 'Update');
?>
<div class="sims-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
