<?php

use yii\helpers\Html;


/* @var $this yii\web\View */
/* @var $model app\modules\Emails\models\Mailboxes */

$this->title = Yii::t('Emails', 'Create Mailbox');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('Emails', 'Mailboxes'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="mailboxes-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
