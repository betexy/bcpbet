<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\Emails\models\Screenshots */

$this->title = "{$model->name} ({$model->tag})";
$this->params['breadcrumbs'][] = ['label' => 'Emails', 'url' => ['/emails']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('Emails', 'Screenshots'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="screenshots-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('Emails', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        <?= Html::a(Yii::t('Emails', 'Delete'), ['delete', 'id' => $model->id], [
            'class' => 'btn btn-danger',
            'data' => [
                'confirm' => Yii::t('Emails', 'Are you sure you want to delete this item?'),
                'method' => 'post',
            ],
        ]) ?>
    </p>

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            [
                'attribute' => 'id',
                'label' => 'ID, Created, Updated at',
                'format' => 'raw',
                'value' => function ($m) {
                    return "<strong>{$m->id}</strong>  --- "
                        . Yii::$app->formatter->asDatetime($m->created_at) . ' --- '
                        . Yii::$app->formatter->asDatetime($m->updated_at);
                }
            ],
            [
                'attribute' => 'name',
                'label' => 'Name (tag)',
                'format' => 'raw',
                'value' => function ($m) {
                    return "{$m->name} (<strong>{$m->tag}</strong>)";
                }
            ],
            'description:ntext',
            'comment:ntext',
            [
                'attribute' => 'image',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::img($m->image);
                }
            ]
        ],
    ]) ?>

</div>
