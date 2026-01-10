<?php

use yii\helpers\Html;


/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\SoftwareVersions */

$this->title = Yii::t('BotManager', 'Create Software Versions');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Software Versions'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="software-versions-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
