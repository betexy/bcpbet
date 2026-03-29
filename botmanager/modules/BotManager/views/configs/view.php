<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $configsDataProvider \yii\data\ActiveDataProvider */
/* @var $configsChildDataProvider \yii\data\ActiveDataProvider */
/* @var $model app\modules\BotManager\models\Configs */

$this->title = $model->id . " - " . $model->name;
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('configs', 'Configs'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);

$this->registerJsFile(\yii\helpers\Url::toRoute(['files/internal-js', 'name' => 'chosen.jquery.min.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerCssFile(\yii\helpers\Url::toRoute(['files/internal-js', 'name' => 'chosen.min.css']));
$this->registerJs("$('#bm_configs_select, #bm_configs_select_by_id').chosen();", $this::POS_READY);

$this->registerJs("$('#bm_add_configs, #bm_add_configs_by_id').click(function(e) { 
    const inputSelector = $(this).attr('id') === 'bm_add_configs_by_id' ? '#bm_configs_select_by_id' : '#bm_configs_select';
    e.preventDefault();
    $.post('" . \yii\helpers\Url::toRoute(['configs/add-configs']) . "', {configs: $(inputSelector).val(), id: " . $model->id . " }, 
        function(data) { if (data === 'ok') { $(inputSelector).val([]).trigger('chosen:updated');
            $.pjax.reload({container:'#linked_configs'}); } 
            else { alert(data); } });
    return false; });", $this::POS_READY);

$this->registerJs("let bm_linked_delete = function(id) {
    $.post('" . \yii\helpers\Url::toRoute(['configs/delete-config']) . "?id=' + id, {}, 
        function(data) { if (data === 'ok') { $.pjax.reload({container:'#linked_configs'}); } 
            else { alert(data); } });
    return false;
};", $this::POS_END);
?>
<div class="configs-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('configs', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>

        <?= Html::a(Yii::t('configs', 'Clone'), ['clone', 'id' => $model->id], ['class' => 'btn btn-success']) ?>

        <?= Html::a(Yii::t('configs', 'Delete'), ['delete', 'id' => $model->id], [
            'class' => 'btn btn-danger',
            'style' => 'float: right;',
            'data' => [
                'confirm' => Yii::t('configs', 'Are you sure you want to delete this item?'),
                'method' => 'post',
            ],
        ]) ?>
    </p>

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            'id',
            'name',
            'bookie',
            'express:boolean',
            'new_expresses:boolean',
            'is_fork:boolean',
            'second_bookie',
            'source',
            'currency',
            'url:url',
            'eventTimeLimit',
            'eventMaxBets',
            'successBetInterval',
            'stake',
            'coefFrom',
            'coefTo',
            'incomeFrom',
            'incomeTo',
            'lastScoreTennis',
            'lastScoreBasketball',
            'excludeSports',
            'excludeMarkets',
            'excludeTargets',
            'excludePivots',
            'excludeBets',
            'excludeLeagues',
            'onlyLeagues',
            'excludeSportMarketTarget',
            [
                'attribute' => 'onlySecondBookie',
                'format' => 'raw',
                'value' => function ($model) {
                    return !empty($model->onlySecondBookie)
                        ? implode(', ', $model->onlySecondBookie) : '-';
                },
            ],
            'skipPinnacleBetfairForks:boolean',
            'created_at:datetime',
            'updated_at:datetime',
        ],
    ]) ?>

    <h2>Queue</h2>
    <h4>Add by name:</h4>
    <div class="row">
        <div class="col-md-10">
            <?= \yii\helpers\BaseHtml::dropDownList('bm_configs_select', null,
                \app\modules\BotManager\models\Configs::retrieveForSelect($model->id),
                ['multiple' => true, 'id' => 'bm_configs_select', 'style' => 'width: 950px']) ?>
        </div>
        <div class="col-md-2">
            <?= Html::a(Yii::t('BotManager', 'Add config(s) to queue'), '#',
                ['class' => 'btn btn-success', 'id' => 'bm_add_configs']) ?>
        </div>
    </div>

    <br/>
    <h4>Add by ID:</h4>
    <div class="row">
        <div class="col-md-10">
            <?= \yii\helpers\BaseHtml::dropDownList('bm_configs_select_by_id', null,
                \app\modules\BotManager\models\Configs::retrieveForSelect($model->id, true),
                ['multiple' => true, 'id' => 'bm_configs_select_by_id', 'style' => 'width: 950px']) ?>
        </div>
        <div class="col-md-2">
            <?= Html::a(Yii::t('BotManager', 'Add config(s) to queue'), '#',
                ['class' => 'btn btn-success', 'id' => 'bm_add_configs_by_id']) ?>
        </div>
    </div>

    <br/>

    <?php \yii\widgets\Pjax::begin(['id' => 'linked_configs']) ?>
    <?php try {
        echo \yii\grid\GridView::widget([
            'dataProvider' => $configsDataProvider,
            'columns' => [
                'child.id',
                'child.name',
                [
                    'class' => 'yii\grid\ActionColumn',
                    'buttons' => [
                        'delete' => function ($url, $model) {
                            return "<a href='#' class='btn btn-danger' onclick='return bm_linked_delete({$model->id});'>Delete</a>";
                        },
                        'view' => function ($url, $model) {
                            return Html::a('View', $url, ['class' => 'btn btn-info', 'data-pjax' => '0', 'target' => '_blank']);
                        },
                    ],
                    'urlCreator' => function ($action, $model, $key, $index) {
                        if ($action === 'delete') {
                            return \yii\helpers\Url::toRoute(['configs/delete-config', 'id' => $model->id]);
                        } else if ($action === 'view') {
                            return \yii\helpers\ Url::to(['configs/view', 'id' => $model->child_id]);
                        }
                    },
                    'template' => '{view} {delete}',
                ],
            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>
    <?php \yii\widgets\Pjax::end() ?>

    <h3>Child of:</h3>
    <?php \yii\widgets\Pjax::begin(['id' => 'child_of']) ?>
    <?php try {
        echo \yii\grid\GridView::widget([
            'dataProvider' => $configsChildDataProvider,
            'columns' => [
                'parent.id',
                [
                        'attribute' => 'parent.name',
                        'format' => 'raw',
                        'value' => function ($model) {
                            return Html::a($model->parent->name, ['configs/view', 'id' => $model->parent_id],
                                ['data-pjax' => '0', 'target' => '_blank']);
                        }
                ]
            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>
    <?php \yii\widgets\Pjax::end() ?>

</div>
