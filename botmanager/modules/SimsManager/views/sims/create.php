<?php

use yii\helpers\Html;


/* @var $this yii\web\View */
/* @var $model app\modules\SimsManager\models\Sims */

$this->title = Yii::t('SimsManager', 'Create SIM card');
$this->params['breadcrumbs'][] = ['label' => Yii::t('SimsManager', 'Sims'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="sims-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
