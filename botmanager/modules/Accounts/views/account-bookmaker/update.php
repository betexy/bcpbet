<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\Accounts\models\AccountBookmaker */

$this->title = Yii::t('Emails', 'Update Account Bookmaker: ' . $model->id, [
    'nameAttribute' => '' . $model->id,
]);
$this->params['breadcrumbs'][] = ['label' => Yii::t('Emails', 'Account Bookmakers'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' => $model->id, 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('Emails', 'Update');
?>
<div class="account-bookmaker-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
