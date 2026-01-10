<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\RdpInstallQueue */

$this->title = $model->id;
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => 'Servers', 'url' => ['/BotManager/server']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Install Queue'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="rdp-install-queue-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-2">
            <?= Html::a(Yii::t('BotManager', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        </div>
        <div class="col-md-10" style="text-align: right">
            <?= Html::a(Yii::t('BotManager', 'Resend'), ['resend', 'id' => $model->id], ['class' => 'btn btn-warning']) ?>
        </div>
    </div>

    <!--
    <p>
        <?= Html::a(Yii::t('BotManager', 'Resend'), ['resend', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>

        <?= Html::a(Yii::t('BotManager', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        <?= Html::a(Yii::t('BotManager', 'Delete'), ['delete', 'id' => $model->id], [
        'class' => 'btn btn-danger',
        'data' => [
            'confirm' => Yii::t('BotManager', 'Are you sure you want to delete this item?'),
            'method' => 'post',
        ],
    ]) ?>
    </p>
    -->

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            'id',
            'created_at:datetime',
            'updated_at:datetime',
            'sent_at:datetime',
            'finished_at:datetime',
            'success:boolean',
            'response:ntext',
            'finished:boolean',
            [
                'attribute' => 'command',
                'label' => 'Command',
                'format' => 'raw',
                'value' => function ($m) {
                    $html = $m->command;
                    try {
                        $parsed = json_decode($html, true);
                        $html = "<strong>{$parsed['action']}</strong> {$parsed['data']['ip']} / {$parsed['data']['root_password']}"
                            . "<br /><strong>{$parsed['data']['name']}</strong> {$parsed['data']['socket']}";
                    } catch (Exception $e) {

                    }
                    return $html;
                }
            ],
            'rdp_command_id',
            [
                'attribute' => 'guacamole_link',
                'label' => 'Link',
                'format' => 'raw',
                'value' => function ($m) {
                    return empty($m->guacamole_link) ? '---'
                        : Html::a($m->guacamole_link, $m->guacamole_link, ['target' => '_blank']);
                }
            ],
            'comment:ntext',
            [
                'attribute' => 'ssh_result',
                'label' => 'SSH result:',
                'format' => 'raw',
                'value' => function ($m) {
                    if (empty($m->ssh_result)) {
                        return '---';
                    } else {
                        $res = str_replace(["\n", "\r\n", "\n\r"], "<br>", $m->ssh_result);
                        return "<div style='overflow-y: scroll; height:500px;'>{$res}</div>";
                    }
                }
            ],
        ],
    ]) ?>

</div>
