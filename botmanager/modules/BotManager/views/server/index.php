<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\helpers\Url;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\ServerSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('BotManager', 'Activity of servers');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;

$this->registerCss('
    tbody tr:hover td {
        color: #337ab7;
        cursor: pointer;
    }
');

$this->registerJs("    
    $('body').on('click', 'tbody td', function (e) {
        var id = $(this).closest('tr').data('id');
        if(e.target == this)
            location.href = '" . Url::to(['server/view']) . "?id=' + id;
    });
", $this::POS_READY);

?>
<div class="server-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-2">
            <?= Html::a(Yii::t('BotManager', 'Activity of servers'), ['index'], ['class' => "btn btn-success disabled"]) ?>
        </div>
        <div class="col-md-2">
            <?= Html::a(Yii::t('BotManager', 'Install server'), ['install-queue/index'], ['class' => "btn btn-success"]) ?>
        </div>
        <!--
        <div class="col-md-6">
            <?= Html::a(Yii::t('BotManager', 'Guacamole Sync'), ['guacamole-sync'], ['class' => 'btn btn-success']) ?>
        </div>
        -->
    </div>


    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?php try {
        echo GridView::widget([
            'dataProvider' => $dataProvider,
            'filterModel' => $searchModel,
            'rowOptions' => function ($model) {
                return ['data-id' => $model->id];
            },
            'columns' => [
                'ip',
                [
                    'attribute' => 'table.guacamole_link',
                    'label' => 'GL',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return empty($m->table->guacamole_link) ? ''
                            : Html::a(Html::img(['files/internal-js', 'name' => 'guac-tricolor.png']),
                                $m->table->guacamole_link,
                                ['target' => '_blank',]);
                    },
                ],
                [
                    'attribute' => 'table_deleted',
                    'value' => 'table.deleted',
                    'format' => 'boolean',
                ],
                'deleted:boolean',
                [
                    'attribute' => 'name',
                    'value' => 'table.name',
                ],
                [
                    'attribute' => 'last_activity',
                    'value' => function ($m) {
                        return $m->last_activity === 0 ? null : Yii::$app->formatter->asRelativeTime($m->last_activity);
                    },
                ],
                [
                    'attribute' => 'last_login',
                    'value' => function ($m) {
                        return $m->last_login === 0 ? null : Yii::$app->formatter->asRelativeTime($m->last_login);
                    },
                ],
                [
                    'attribute' => 'table_last_yc_reboot',
                    'label' => 'YCrbt',
                    'value' => function ($m) {
                        return empty($m->table->last_yc_reboot) ? null
                            : Yii::$app->formatter->asRelativeTime($m->table->last_yc_reboot);
                    },
                ],
                [
                    'attribute' => 'id',
                    'label' => 'Reboot',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return Html::a('SSH', Url::to(['server/reboot', 'id' => $m->id]),
                                ['class' => 'btn btn-primary'])
                            . (empty($m->table->yc_id) ? '' : '&nbsp;&nbsp;'
                                . Html::a('YC', Url::to(['server/reboot-yc', 'id' => $m->id]),
                                    ['class' => 'btn btn-warning']));
                    },
                ],
            ],
        ]);
    } catch (Exception $exception) {
        echo $exception->getMessage();
    } ?>
    <?php Pjax::end(); ?>
</div>
