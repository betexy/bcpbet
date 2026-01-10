<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Files */

$this->title = $model->name;
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Files'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="files-view">

    <h1><?= Html::encode($this->title) ?> ( <?= $model->tag ?> )</h1>

    <p>
    <div class="row">
        <div class="col-md-1">
            <?= Html::a(Yii::t('BotManager', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        </div>
        <div class="col-md-2">
            <?= Html::a(Yii::t('BotManager', 'Update File'), ['update-file', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('BotManager', 'Download'), ['download', 'id' => $model->id], ['class' => 'btn btn-success']) ?>
        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('BotManager', 'Create'), ['files/create'], ['class' => 'btn btn-warning']) ?>
        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('BotManager', 'Delete'), ['delete', 'id' => $model->id], [
                'class' => 'btn btn-danger',
                'data' => [
                    'confirm' => Yii::t('BotManager', 'Are you sure you want to delete this item?'),
                    'method' => 'post',
                ],
            ]) ?>
        </div>
    </div>
    </p>

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            'id',
            'created_at:datetime',
            'updated_at:datetime',
            'name',
            'source_path',
            'source_name',
            'file_name',
            'file_path',
            'comment:ntext',
        ],
    ]) ?>

</div>
