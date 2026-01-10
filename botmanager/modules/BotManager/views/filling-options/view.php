<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\FillingOptions */

$this->title = Yii::t('BotManager', $model->name, [], 'ru') . " = {$model->value}";
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Filling Options'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="filling-options-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('BotManager', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        <?= Html::a(Yii::t('BotManager', 'Create'), ['filling-options/create'], ['class' => 'btn btn-warning']) ?>
        <?= Html::a(Yii::t('BotManager', 'Delete'), ['delete', 'id' => $model->id], [
            'class' => 'btn btn-danger',
            'style' => 'float: right',
            'data' => [
                'confirm' => Yii::t('BotManager', 'Are you sure you want to delete this item?'),
                'method' => 'post',
            ],
        ]) ?>
    </p>

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            'id',
            [
                'attribute' => 'name',
                'value' => function ($m) {
                    return Yii::t('BotManager', $m->name, [], 'ru');
                }
            ],
            'value',
            'comment:ntext',
            'created_at:datetime',
            'updated_at:datetime',
        ],
    ]) ?>

</div>
