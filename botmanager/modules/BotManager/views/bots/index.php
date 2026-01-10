<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;
use yii\helpers\ArrayHelper;
use app\modules\BotManager\models\Server;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\BotsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$versions = ArrayHelper::merge(
    ['' => ' - - - '],
    ArrayHelper::map(\app\modules\BotManager\models\SoftwareVersions::find()->all(), 'id', 'name')
);

$actions = ArrayHelper::merge(
    ['' => ' - - - '],
    \app\modules\BotManager\models\BotsQueue::$actionsList
);

$updates = ArrayHelper::merge(
    ['' => ' - - - '],
    ['enableWs2' => 'Enable WS2', 'disableWs2' => 'Disable WS2']
);

unset($actions['WITHDRAW']);
unset($actions['DEPOSIT']);
unset($actions['CHANGE_INI_DATA']);

$this->title = Yii::t('BotManager', 'Bots');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;

$bkFilter = ArrayHelper::map(\app\modules\BotManager\models\FileGroups::findAll(['type' => 1]), 'id', 'name');

$this->registerJsFile(\yii\helpers\Url::toRoute(['files/internal-js', 'name' => 'chosen.jquery.min.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerCssFile(\yii\helpers\Url::toRoute(['files/internal-js', 'name' => 'chosen.min.css']));
$this->registerCss('
ul.chosen-choices { 
    display: block;
    padding: 6px 12px;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 4px;
    line-height: 1.42857143;
}
select[name="BotsSearch[test_mode_on]"] {
    padding: 0;
}
');

$this->registerJs("let wch = function() {
    if ($('#botssearch-bm_bk_select').length > 0 && typeof $('#botssearch-bm_bk_select').data('chosen') === 'undefined') {
        $('#botssearch-bm_bk_select').chosen();
    } 
    setTimeout(wch, 333);    
}; wch(); 
", $this::POS_READY);

?>
<div class="bots-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= Html::beginForm(['bots/bulk'], 'post'); ?>
    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-5">
            <?= Html::dropDownList('action', '', $actions, ['class' => 'form-control',]) ?>
        </div>
        <div class="col-md-3">
            <?= Html::dropDownList('version', '', $versions, ['class' => 'form-control',]) ?>
        </div>
        <div class="col-md-2">
            <?= Html::dropDownList('updates', '', $updates, ['class' => 'form-control',]) ?>
        </div>
        <div class="col-md-2">
            <?= Html::submitButton('Perform!', ['class' => 'btn btn-success',]); ?>
        </div>
    </div>

    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>
    <?php try {
        echo GridView::widget([
            'layout' => "{pager}\n{items}\n{summary}\n{pager}",
            'dataProvider' => $dataProvider,
            'filterModel' => $searchModel,
            'rowOptions' => function ($model) {
                if ($model->last_request < time() - 120) {
                    return ['style' => 'background-color: #ffb3b3;'];
                } else {
                    return ['style' => 'background-color: #ceff9e;'];
                }
            },
            'columns' => [
                //['class' => 'yii\grid\SerialColumn'],

                //'virtual_machine_uid',
                ['class' => 'yii\grid\CheckboxColumn'],
                'id',
                [
                    'attribute' => 'virtual_machine_name',
                    'label' => 'VM name',
                    'format' => 'html',
                    'value' => function ($model) {
                        $text = [$model->virtual_machine_name];
                        if (!empty($model->user_id)) {
                            $text[] = "({$model->user_id})";
                        }
                        if (!empty($model->server_name)) {
                            $text[] = "@ {$model->server_name}";
                        }
                        return Html::a($model->readableName, ['bots/view', 'id' => $model->id]);
                    },
                ],
                //'websocket_url:url',
                //'websocket_uid',
                /*
                [
                    'attribute' => 'test_mode_on',
                    'format' => 'boolean',
                    'label' => 'Test',
                ],
                */
                [
                    'attribute' => 'bm_server_id',
                    'filter' => ArrayHelper::map(Server::find()->orderBy(['name' => 'ASC'])->all(), 'id', 'name'),
                    'format' => 'raw',
                    'value' => function ($m) {
                        return empty($m->server) ? '' : Html::a($m->server->name, ['server/view', 'id' => $m->server->id])
                            . (!empty($m->guacamoleIcon) ? "<br /><br />{$m->guacamoleIcon}" : '');
                    }
                ],
                [
                    'attribute' => 'double_enabled',
                    'format' => 'boolean'
                ],
                'description:html',
                [
                    'attribute' => 'bmBkSelect',
                    'format' => 'ntext',
                    'value' => function ($model) {
                        return implode(', ', \yii\helpers\ArrayHelper::map($model->botsBks, 'name', 'name'));
                    },
                    'filter' => Html::activeListBox(
                        $searchModel,
                        'bm_bk_select',
                        $bkFilter,
                        ['multiple' => true, 'class' => 'form-control', 'style' => 'width: 195px;']
                    )
                ],
                //'test_url:url',
                [
                    'attribute' => 'last_request',
                    'format' => 'ntext',
                    'filter' => false,
                    'value' => function ($model) {
                        return \Yii::$app->formatter->asRelativeTime($model->last_request) . " ({$model->last_status})";
                    }
                ],
                //'comment:ntext',

                [
                    'class' => 'yii\grid\ActionColumn',
                    'template' => '{update} {delete}',
                ],
            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>

    <?php Pjax::end(); ?>
    <?= Html::endForm(); ?>
</div>
