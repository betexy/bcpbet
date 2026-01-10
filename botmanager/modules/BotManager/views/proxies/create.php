<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;

use app\modules\BotManager\models\Proxies;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Proxies */

$this->title = Yii::t('BotManager', 'Create Proxies');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Proxies'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;

?>
<div class="proxies-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
