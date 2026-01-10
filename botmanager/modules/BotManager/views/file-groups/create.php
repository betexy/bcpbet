<?php

use yii\helpers\Html;


/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\FileGroups */

$this->title = Yii::t('BotManager', 'Create File Groups');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Extensions & BKs & Software'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="file-groups-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
