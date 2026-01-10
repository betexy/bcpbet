<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\SimsManager\models\Smses */

$this->title = "To {$model->number} from {$model->scrum}";
$this->params['breadcrumbs'][] = ['label' => 'SIM manager', 'url' => ['/sims-manager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('SimsManager', 'Smses'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="smses-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('SimsManager', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
    </p>

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            'id',
            'receive_id',
            'number',
            'scrum',
            'provid',
            'msg:ntext',
            'time_received',
            'goip_name',
            'sims_channels_id',
            'status',
            'smscnum',
            'senttime',
            'comment:ntext',
        ],
    ]) ?>

</div>
