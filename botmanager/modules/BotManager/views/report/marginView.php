<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\MarginReport */

$this->title = $model->id;
$this->params['breadcrumbs'][] = ['label' => Yii::t('bm', 'Reports'), 'url' => ['/BotManager/report']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('bm', 'Margin'), 'url' => ['/BotManager/report/margin']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="margin-report-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            'id',
            'created_at:datetime',
            'updated_at:datetime',
            'raw:ntext',
            'remote_ip',
            'room_uid',
            'status',
            'coef',
            'requested_coef',
            'margin',
            'comment:ntext',
        ],
    ]) ?>

</div>
