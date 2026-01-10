<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\SimsManager\models\Sims */

$this->title = "SIM {$model->number}";
$this->params['breadcrumbs'][] = ['label' => Yii::t('SimsManager', 'SIM manager'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="sims-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('SimsManager', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        <?= Html::a(Yii::t('SimsManager', 'Create'), ['create'], ['class' => 'btn btn-warning']) ?>
        <?= Html::a(Yii::t('SimsManager', 'Delete'), ['delete', 'id' => $model->id], [
            'class' => 'btn btn-danger',
            'data' => [
                'confirm' => Yii::t('SimsManager', 'Are you sure you want to delete this item?'),
                'method' => 'post',
            ],
        ]) ?>
    </p>

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            'id',
            'number',
            'slot.slot_id',
            'comment:ntext',
        ],
    ]) ?>

</div>
