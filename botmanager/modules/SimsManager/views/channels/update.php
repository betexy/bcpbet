<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\SimsManager\models\Channels */

$this->title = Yii::t('SimsManager', 'Update Channels: ' . $model->channel_id, [
    'nameAttribute' => '' . $model->id,
]);
$this->params['breadcrumbs'][] = ['label' => Yii::t('SimsManager', 'Channels'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' => $model->channel_id, 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('SimsManager', 'Update');
?>
<div class="channels-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
