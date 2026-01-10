<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\Emails\models\Screenshots */

$this->title = Yii::t('Emails', 'Update Screenshots: ' . $model->name, [
    'nameAttribute' => '' . $model->name,
]);
$this->params['breadcrumbs'][] = ['label' => 'Emails', 'url' => ['/emails']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('Emails', 'Screenshots'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' => $model->name, 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('Emails', 'Update');
?>
<div class="screenshots-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
