<?php

use yii\helpers\Html;


/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Bots */

$this->title = Yii::t('BotManager', 'Create Bots');
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Bots'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="bots-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
