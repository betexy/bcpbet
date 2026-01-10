<?php

use app\modules\BotManager\models\Server;
use yii\helpers\Url;
use yii\web\View;

/* @var $this View */

$this->title = "Server's table";
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Servers'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;

\yii\web\YiiAsset::register($this);

$this->registerJsFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'serverCommentHelper.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerCss('input.serverComment {background: transparent;}');
$this->registerJs('var urlToBotSave = "' . Url::toRoute(['bots/save-bot-comment']) . '";', $this::POS_END);

$servers = Server::find()->orderBy(['name' => SORT_ASC])->all();

?>

<h3>Servers:</h3>

<?php foreach ($servers as $server) { ?>
    <div class="row" style="background-color: #0d6aad; color: white; font-weight: bold;">
        <div class="col-md-4">
            <?= "{$server->name} {$server->ip}" ?>
        </div>
        <div class="col-md-6">
            <?= $server->comment ?>
        </div>
        <div class="col-md-2">
            <?= ((int)$server->resource - count($server->bots)) . "/{$server->resource} free" ?>
        </div>
    </div>
    <div class="row">
        <div class="col-md-12">
            <?= $this->render('_bots', [
                'model' => $server,
                'noSummary' => true,
                'unassigned' => false,
                'showHeader' => false,
                'onlyActive' => false
            ]) ?>
        </div>
    </div>
<?php } ?>

<h3>Unassigned bots:</h3>
<div class="row">
    <div class="col-md-12">
        <?= $this->render('_bots', [
            'model' => null,
            'noSummary' => true,
            'unassigned' => true,
            'showHeader' => true,
            'onlyActive' => false
        ]) ?>
    </div>
</div>
