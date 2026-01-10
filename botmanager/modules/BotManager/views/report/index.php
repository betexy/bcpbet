<?php

$this->title = Yii::t('bm', 'All Reports');
$this->params['breadcrumbs'][] = ['label' => 'Reports', 'url' => ['/BotManager/report']];
$this->params['breadcrumbs'][] = $this->title;

?>

<div class="Report-default-index">
    <div class="row">
        <div class="col-md-1">
            <a class="btn btn-success" href="<?= \yii\helpers\Url::toRoute(['/BotManager/report/raw']) ?>">Raw</a>
        </div>
        <div class="col-md-1">
            <a class="btn btn-success" href="<?= \yii\helpers\Url::toRoute(['/BotManager/report/margin']) ?>">Margin</a>
        </div>
    </div>
</div>