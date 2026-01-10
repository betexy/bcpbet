<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\SimsManager\models\Smses */

$this->title = "To {$model->number} from {$model->scrum}";
$this->params['breadcrumbs'][] = ['label' => 'SIM manager', 'url' => ['/sims-manager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('SimsManager', 'Smses'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' => "To {$model->number} from {$model->scrum}", 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('SimsManager', 'Update');
?>
<div class="smses-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
