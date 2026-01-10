<?php

use yii\data\ActiveDataProvider;
use yii\helpers\Html;
use yii\helpers\Url;
use yii\widgets\DetailView;
use app\modules\BotManager\models\Bots;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Server */

$this->title = empty($model->table) ? $model->ip : "{$model->table->name} ({$model->ip})";
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Servers'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);

$this->registerJsFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'serverCommentHelper.js']),
    ['depends' => 'yii\web\JqueryAsset']);
$this->registerCss('input.serverComment {background: transparent;}');
$this->registerJs('var urlToBotSave = "' . Url::toRoute(['server/save-comment']) . '";', $this::POS_END);

?>
<div class="server-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-4">
            <?= Html::a(Yii::t('BotManager', 'Login'), ['login', 'id' => $model->id], ['class' => 'btn btn-success']) ?>
            <?= Html::a(Yii::t('BotManager', 'Reboot'), ['reboot', 'id' => $model->id], ['class' => 'btn btn-warning']) ?>
        </div>
        <div class="col-md-4">
            <?= Html::a(Yii::t('BotManager', !empty($model->table)
                ? 'Update corresponding server'
                : 'Create corresponding server'),
                [!empty($model->table) ? 'update-table' : 'create-table', 'id' => $model->id],
                ['class' => 'btn btn-' . (!empty($model->table) ? 'success' : 'info')]) ?>
        </div>
        <div class="col-md-4" style="text-align: right;">
            <?= Html::a(Yii::t('BotManager', 'Set deleted'), ['set-deleted', 'id' => $model->id, 'deleted' => '1'],
                ['class' => 'btn btn-danger',
                    'data' => ['confirm' => Yii::t('BotManager', 'Are you sure you want to set this item as deleted?'),
                        'method' => 'post',],]) ?>
            <?= Html::a(Yii::t('BotManager', 'Set not deleted'),
                ['set-deleted', 'id' => $model->id, 'deleted' => 0], ['class' => 'btn btn-info']) ?>
        </div>
    </div>

    <?php try {
        echo DetailView::widget(
            ['model' => $model,
                'attributes' => [
                    ['attribute' => 'id',
                        'label' => 'ID, Created, Updated at',
                        'format' => 'raw',
                        'value' => function ($m) {
                            return "<strong>{$m->id}</strong>  --- "
                                . Yii::$app->formatter->asDatetime($m->created_at) . ' --- '
                                . Yii::$app->formatter->asDatetime($m->updated_at);
                        }],
                    ['attribute' => 'name',
                        'value' => function ($model) {
                            return $model->table->name;
                        },],
                    'ip',
                    [
                        'attribute' => 'table.guacamole_link',
                        'label' => 'Guacamole link',
                        'format' => 'raw',
                        'value' => function ($m) {
                            return empty($m->table->guacamole_link) ? '' : Html::a($m->table->guacamole_link, $m->table->guacamole_link,
                                ['target' => '_blank']);
                        },
                    ],
                    [
                        'attribute' => 'table.yc_id',
                        'label' => 'YC (instance / account)',
                        'format' => 'raw',
                        'value' => function ($m) {
                            return empty($m->table->yc_id) ? null
                                : $m->table->yc_id . ' / ' . [1 => 'First', 2 => 'Second'][$m->table->yc_account];
                        },
                    ],
                    'deleted:boolean',
                    ['attribute' => 'last_activity',
                        'value' => function ($m) {
                            return $m->last_activity === 0 ? null : Yii::$app->formatter->asRelativeTime($m->last_activity);
                        },],
                    ['attribute' => 'last_login',
                        'value' => function ($m) {
                            return $m->last_login === 0 ? null : Yii::$app->formatter->asRelativeTime($m->last_login);
                        },],
                    ['attribute' => 'table_last_yc_reboot_attempt',
                        'value' => function ($m) {
                            return empty($m->table->last_yc_reboot_attempt) ? null
                                : Yii::$app->formatter->asRelativeTime($m->table->last_yc_reboot_attempt);
                        },],
                    ['attribute' => 'table_last_yc_reboot',
                        'value' => function ($m) {
                            return empty($m->table->last_yc_reboot) ? null
                                : Yii::$app->formatter->asRelativeTime($m->table->last_yc_reboot);
                        },],
                    'logins_failed',
                    ['attribute' => 'comment',
                        'format' => 'raw',
                        'value' => function ($m) {
                            return Html::textarea('comment', $m->comment,
                                ['id' => "comment_{$m->id}", 'data-value' => $m->comment, 'data-id' => $m->id,
                                    'class' => 'form-control serverComment']);
                        },
                    ],
                    [
                        'attribute' => 'table.comment',
                        'label' => 'Comment (table)',
                        'format' => 'raw',
                        'value' => function ($m) {
                            return empty($m->table->comment) ? '' : $m->table->comment;
                        },
                    ]
                ]
            ]);
    } catch (Exception $exception) {
        echo $exception->getMessage();
    } ?>

    <br/>

    <?= $this->render('_commands', ['model' => $model,
        'noSummary' => false,
        'unassigned' => false,
        'showHeader' => true,]) ?>

</div>
