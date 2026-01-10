<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\FillingOptions */

$this->title = Yii::t('BotManager', 'Create Filling Options');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Filling Options'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="filling-options-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
