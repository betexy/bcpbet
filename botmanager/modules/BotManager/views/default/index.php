<?php

use app\modules\BotManager\Helpers\LockHelper;
use yii\helpers\Url;
use yii\widgets\ListView;
use app\modules\BotManager\models\SoftwareVersions;

/* @var $this yii\web\View */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('BotManager', 'Bots - Main Page');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;

$win = SoftwareVersions::findOne(['id' => 2]);
$lin = SoftwareVersions::findOne(['id' => 3]);

?>
<style>
    #topButtons a.btn {
        margin: 0 2px;
        font-size: 13px;
        padding: 1px 8px;
    }
</style>
<div class="BotManager-default-index">
    <div class="row">
        <div class="col-md-12" id="topButtons">
            <a class="btn btn-success" href="<?= Url::toRoute(['/BotManager/configs']) ?>">Configs</a>
            <a class="btn btn-success" href="<?= Url::toRoute(['/BotManager/xbots']) ?>">Xbots</a>
            <a class="btn btn-success" href="<?= Url::toRoute(['/BotManager/server']) ?>">Servers</a>
            <a class="btn btn-success" href="<?= Url::toRoute(['/BotManager/file-groups']) ?>">E & B & S</a>
            <a class="btn btn-success" href="<?= Url::toRoute(['/BotManager/software-versions']) ?>">Versions</a>
            <a class="btn btn-success" href="<?= Url::toRoute(['/BotManager/files']) ?>">Files</a>
            <a class="btn btn-success" href="<?= Url::toRoute(['/BotManager/default/settings']) ?>">Settings</a>
            <a class="btn btn-success" href="<?= Url::toRoute(['/pay-systems/paysystems']) ?>">PS</a>
            <a class="btn btn-success" href="<?= Url::toRoute(['/pay-systems/wallets']) ?>">Wallets</a>
            <a class="btn btn-success" href="<?= Url::toRoute(['/BotManager/filling-options']) ?>">Filling options</a>
            <a class="btn btn-success" href="<?= Url::toRoute(['/emails/mailboxes']) ?>">Mailboxes</a>
            <a class="btn btn-success" href="<?= Url::toRoute(['/BotManager/stake']) ?>">Stake accounts</a>
            <a class="btn btn-success" href="<?= Url::toRoute(['/BotManager/proxies']) ?>">Proxies</a>
        </div>
    </div>
    <h2>Cron tasks:</h2>
    <?php
        $crones =  LockHelper::getInstance()->getStats();
        foreach ($crones as $cron) {
            echo $cron . '<br />';
        }
    ?>

</div>
