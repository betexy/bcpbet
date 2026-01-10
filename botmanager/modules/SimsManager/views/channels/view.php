<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\SimsManager\models\Channels */

$this->title = $model->channel_id;
$this->params['breadcrumbs'][] = ['label' => Yii::t('SimsManager', 'Channels'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="channels-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('SimsManager', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
    </p>

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            'id',
            'channel_id',
            'goip_sms_id',
            'slot.slot_id',
            'sims.number',
            'only_manual:boolean',
            'comment:ntext',
        ],
    ]) ?>

</div>
