<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\Emails\models\Mailboxes */

$this->title = Yii::t('Emails', 'Update Mailboxes: ' . $model->id, [
    'nameAttribute' => '' . $model->id,
]);
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('Emails', 'Mailboxes'), 'url' => ['index']];
$this->params['breadcrumbs'][] = ['label' => $model->id, 'url' => ['view', 'id' => $model->id]];
$this->params['breadcrumbs'][] = Yii::t('Emails', 'Update');
?>
<div class="mailboxes-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
