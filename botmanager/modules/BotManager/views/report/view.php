<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Report */

$this->title = $model->id;
$this->params['breadcrumbs'][] = ['label' => Yii::t('bm', 'Reports'), 'url' => ['/BotManager/report']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('bm', 'Raw'), 'url' => ['/BotManager/report/raw']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="report-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('bm', 'Delete'), ['delete', 'id' => $model->id], [
            'class' => 'btn btn-danger',
            'data' => [
                'confirm' => Yii::t('bm', 'Are you sure you want to delete this item?'),
                'method' => 'post',
            ],
        ]) ?>
    </p>

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            'id',
            'created_at:datetime',
            'updated_at:datetime',
            'parsed:boolean',
            'parse_error:boolean',
            'raw:ntext',
            'remote_ip',
            'category',
            'action',
            'result',
            'message:ntext',
            'room_bk',
            'room_uid',
            'room_state',
            'room_balance',
            'data_status',
            'data:ntext',
            'comment:ntext',
        ],
    ]) ?>

</div>
