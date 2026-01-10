<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\Accounts\models\Account */

$this->title = Yii::t('Emails', 'Update Account: ' . "{$model->first_name} {$model->second_name} {$model->third_name}", [
    'nameAttribute' => '' . "{$model->first_name} {$model->second_name} {$model->third_name}",
]);
$this->params['breadcrumbs'][] = ['label' => Yii::t('Emails', 'Accounts'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' =>"{$model->first_name} {$model->second_name} {$model->third_name}", 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('Emails', 'Update');
?>
<div class="account-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
