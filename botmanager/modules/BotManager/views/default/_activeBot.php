<?php

use yii\helpers\Html;
use yii\helpers\Url;
use app\modules\BotManager\models\BotsQueue;

$formatter = \Yii::$app->formatter;

/**
 * @var $model \app\modules\BotManager\models\Bots
 * @var $lastQueue BotsQueue
 */

$lastQueue = BotsQueue::find()->where(['bots_id' => $model->id])->orderBy(['created_at' => SORT_DESC])->one();
$text = [$model->virtual_machine_name];
if (!empty($model->user_id)) {
    $text[] = "({$model->user_id})";
}
if (!empty($model->server_name)) {
    $text[] = "@ {$model->server_name}";
}

?>
<div class="row" style="margin-bottom: 10px; border-bottom: 1px solid lightgrey;">
    <div class="col-md-5">
        <a href="<?= Url::toRoute(['bots/view', 'id' => $model->id]) ?>"><?= Html::encode(implode(' ', $text)) ?></a>
        <?php /* <strong><?= (empty($model->softwareVersion) ? '---' : $model->softwareVersion->code) ?></strong> */ ?>
    </div>
    <div class="col-md-1">
        <?= empty($lastQueue) ? '---' : BotsQueue::$statusesListShort[$lastQueue->status] ?>
    </div>
    <div class="col-md-4"><?= Html::encode($model->comment) ?></div>
    <div class="col-md-2">
        <a href="<?= Url::toRoute(['bots/view', 'id' => $model->id]) ?>"><?= $formatter->asDatetime($model->last_request) ?>
            (<?= $model->last_status ?>)</a>
    </div>
</div>
