<?php

use yii\helpers\Html;
use yii\widgets\DetailView;
use app\modules\PaySystems\models\History;

/* @var $this yii\web\View */
/* @var $model History */
/* @var $wallets boolean */

$this->title = $model->title;
if ($wallets) {
    $this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
    $this->params['breadcrumbs'][] = ['label' => Yii::t('pay-systems', 'Wallets'), 'url' => ['wallets/index']];
} else {
    $this->params['breadcrumbs'][] = ['label' => 'Pay systems', 'url' => ['/pay-systems']];
    $this->params['breadcrumbs'][] = ['label' => Yii::t('PaySystems', 'Transactions History'), 'url' => ['index']];
}
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="history-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('PaySystems', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        <?= Html::a(Yii::t('PaySystems', 'Delete'), ['delete', 'id' => $model->id], [
            'class' => 'btn btn-danger',
            'data' => [
                'confirm' => Yii::t('PaySystems', 'Are you sure you want to delete this item?'),
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
            'datetime:datetime',
            'datetime_string',
            [
                'attribute' => 'ps_paysystems_id',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::a($m->paysystems->title, ['paysystems/view', 'id' => $m->ps_paysystems_id]);
                }
            ],
            [
                'attribute' => 'type',
                'format' => 'raw',
                'value' => function ($m) {
                    return History::$types[$m->type];
                }
            ],
            [
                'attribute' => 'amount',
                'format' => 'raw',
                'value' => function ($m) {
                    return $m->printAmount . ' ' . History::$currencies[$m->currency];
                }
            ],
            'sender',
            'receiver',
            'description:ntext',
            'tech:ntext',
            'comment:ntext',
        ],
    ]) ?>

</div>
