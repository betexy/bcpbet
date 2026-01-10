<?php

use yii\helpers\Html;


/* @var $this yii\web\View */
/* @var $model app\modules\PaySystems\models\Paysystems */

$this->title = Yii::t('PaySystems', 'Create Pay System');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('PaySystems', 'Paysystems'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="paysystems-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
