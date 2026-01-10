<?php

use app\modules\BotManager\models\Files;
use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\FileGroups */
/* @var $filesDataProvider \yii\data\ActiveDataProvider */
/* @var $settingsDataProvider \yii\data\ActiveDataProvider */

$this->title = $model->name;
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Extensions & BKs & Software'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);

$this->registerJsFile(\yii\helpers\Url::toRoute(['files/internal-js', 'name' => 'chosen.jquery.min.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerCssFile(\yii\helpers\Url::toRoute(['files/internal-js', 'name' => 'chosen.min.css']));

$this->registerJs("$('#bm_files_select, #bm_bk_settings').chosen();", $this::POS_READY);
$this->registerJs("$('#bm_add_files').click(function(e) { 
    e.preventDefault();
    $.post('" . \yii\helpers\Url::toRoute(['file-groups/add-files']) . "', {files: $('#bm_files_select').val(), id: " . $model->id . " }, 
        function(data) { if (data === 'ok') { $('#bm_files_select').val([]).trigger('chosen:updated');  $.pjax.reload({container:'#linked_files'}); } 
            else { alert(data); } });
    return false; });", $this::POS_READY);
$this->registerJs("$('#bm_add_bk').click(function(e) { 
    e.preventDefault();
    $.post('" . \yii\helpers\Url::toRoute(['file-groups/add-settings']) . "', {settings: $('#bm_bk_settings').val(), id: " . $model->id . " }, 
        function(data) { if (data === 'ok') { $('#bm_bk_settings').val([]).trigger('chosen:updated');  $.pjax.reload({container:'#linked_settings'}); } 
            else { alert(data); } });
    return false; });", $this::POS_READY);
$this->registerJs("let bm_linked_delete = function(id) {
    $.post('" . \yii\helpers\Url::toRoute(['file-groups/delete-linked']) . "?id=' + id, {}, 
        function(data) { if (data === 'ok') { $.pjax.reload({container:'#linked_files'}); } 
            else { alert(data); } });
    return false;
};", $this::POS_END);
$this->registerJs("let bm_settings_delete = function(id) {
    if (confirm('Are you sure?')) {
        $.post('" . \yii\helpers\Url::toRoute(['file-groups/delete-settings']) . "?id=' + id, {}, 
            function(data) { if (data === 'ok') { $.pjax.reload({container:'#linked_settings'}); } 
                else { alert(data); } });
    }
    return false;
};", $this::POS_END);
$this->registerJs("let bm_settings_save = function(id) {
    let params = {
        'BkSettings[url_one]' : $('input[data-bb-id=\"' + id + '\"][name=\"url_one\"]').val(),
        'BkSettings[comment]' : $('input[data-bb-id=\"' + id + '\"][name=\"comment\"]').val(),
    };
    $.post('" . \yii\helpers\Url::toRoute(['file-groups/update-settings']) . "?settings_id=' + id, params, 
        function(data) { if (data === 'ok') { $.pjax.reload({container:'#linked_settings'}); } 
            else { alert(data); } });
    return false;
};", $this::POS_END);

$this->registerJs("function letsDoStuff(el) {
    if ($('#botName').length === 0) {
        if ($('#comment').val().length > 0) {
            let href = $(el).attr('href');
            $(el).attr('href', href + '&comment=' + $('#comment').val()); 
        }
        return true;
    }
    let id = parseInt($('#userSelect').val());
    let bot_name = $('#botName').val(); 
    if (isNaN(id) || id < 1 || bot_name.length < 3) {
        alert('You need provide User and Bot name both!');
        return false;
    } else {
        let href = $(el).attr('href');
        $(el).attr('href', href.replace(/(user_id=\d+)(&|$)/, 'user_id=' + id + '$2').replace(/(bot_name=.*)(&|$)/, 'bot_name=' + bot_name + '$2'));
        return true;
    }
}", $this::POS_END);

$settings = new \app\modules\BotManager\models\SettingsForm();
$settings->loadData();

?>
<div class="file-groups-view">

    <h3><?= Html::encode($this->title) ?></h3>

    <div class="row">
        <div class="col-md-1">
            <?= Html::a(Yii::t('BotManager', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('BotManager', 'Create'), ['file-groups/create'], ['class' => 'btn btn-warning']) ?>
        </div>
        <?php if ($model->type === 2) { ?>
            <div class="col-md-2">
                <?= Html::dropDownList('userSelect', '', \yii\helpers\ArrayHelper::merge(['' => ' - - - '], $settings->users),
                    ['class' => 'form-control', 'id' => 'userSelect']) ?>
            </div>
        <?php } else if ($model->type === 2) { ?>
            <input type="hidden" id="userSelect" value="<?= Yii::$app->user->id ?>"/>
        <?php } ?>
        <?php if ($model->type === 2) { ?>
            <div class="col-md-2">
                <?= Html::input('string', 'botName', '',
                    ['class' => 'form-control', 'placeholder' => 'Bot name', 'id' => 'botName']) ?>
            </div>
        <?php } ?>
        <div class="col-md-7" style="background-color: lightgray">
            <div class="row">
                <div class="col-md-2" style="background-color: lightgray">
                    <label for="comment" style="padding-top: 7px">Download:</label>
                </div>
                <div class="col-md-2" style="background-color: lightgray">
                    <?= Html::a(Yii::t('BotManager', 'Simple'),
                        ['file-groups/download', 'id' => $model->id, 'user_id' => Yii::$app->user->id, 'bot_name' => 'Please specify!'],
                        ['class' => 'btn btn-info', 'onclick' => 'return letsDoStuff(this);']) ?>
                </div>
                <div class="col-md-2" style="background-color: lightgray">
                    <?= Html::a(Yii::t('BotManager', 'Test'),
                        ['file-groups/download', 'id' => $model->id, 'user_id' => Yii::$app->user->id,
                            'bot_name' => 'Please specify!', 'testing' => 1],
                        ['class' => 'btn btn-info', 'onclick' => 'return letsDoStuff(this);']) ?>
                </div>
                <div class="col-md-3" style="background-color: lightgray">
                    <?= Html::a(Yii::t('BotManager', 'Test Obfuscated'),
                        ['file-groups/download', 'id' => $model->id, 'user_id' => Yii::$app->user->id,
                            'bot_name' => 'Please specify!', 'testing' => 1, 'obfuscate' => 1],
                        ['class' => 'btn btn-info', 'onclick' => 'return letsDoStuff(this);']) ?>
                </div>
                <div class="col-md-3" style="background-color: lightgray">
                    <?= Html::input('string', 'comment', '', ['class' => 'form-control', 'id' => 'comment',
                        'placeholder' => 'Comment']) ?>
                </div>

            </div>
        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('BotManager', 'Delete'), ['delete', 'id' => $model->id], [
                'class' => 'btn btn-danger',
                'data' => [
                    'confirm' => Yii::t('BotManager', 'Are you sure you want to delete this item?'),
                    'method' => 'post',
                ],
            ]) ?>
        </div>
    </div>
    <br/>

    <?php try {
        echo DetailView::widget([
            'model' => $model,
            'attributes' => [
                'id',
                'typeText',
                'name',
                'bkInternalText',
                'comment:ntext',
            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>

    <h3>Files:</h3>
    <div class="row">
        <div class="col-md-4">
            <?= \yii\helpers\BaseHtml::dropDownList('bm_files_select', null,
                Files::retrieveFilesByTags([0 => 'Extension', 1 => 'BK', 2 => 'Software', 3 => 'Plugin'][$model->type]),
                ['multiple' => true, 'id' => 'bm_files_select', 'style' => 'width: 330px']) ?>
        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('BotManager', 'Add files'), '#',
                ['class' => 'btn btn-success', 'id' => 'bm_add_files']) ?>
        </div>
        <div class="col-md-1"></div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('BotManager', 'Upload new'), '/BotManager/files/create',
                ['class' => 'btn btn-warning', 'id' => 'bm_create_files']) ?>
        </div>
    </div>
    <br/>

    <?php \yii\widgets\Pjax::begin(['id' => 'linked_files']) ?>
    <?php try {
        echo \yii\grid\GridView::widget([
            'dataProvider' => $filesDataProvider,
            'columns' => [
                //'id',
                'files.name',
                'files.source_path',
                'files.source_name',

                [
                    'class' => 'yii\grid\ActionColumn',
                    'buttons' => [
                        'delete' => function ($url, $model) {
                            return "<a href='#' class='btn btn-danger' onclick='return bm_linked_delete({$model->id});'>Delete</a>";
                        },
                        'view' => function ($url, $model) {
                            return Html::a('View', ['files/view', 'id' => $model->files->id], ['class' => 'btn btn-info']);
                        },
                    ],
                    'urlCreator' => function ($action, $model, $key, $index) {
                        if ($action === 'delete') {
                            return \yii\helpers\Url::toRoute(['file-groups/delete-linked', 'id' => $model->id]);
                        } else if ($action === 'update') {

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

    <?php if ($model->type === 0) { ?>

        <h3>Bookie start urls settings:</h3>
        <p>
            <?php
            $onlyBk = $model::getBkInternals();
            unset($onlyBk['extension']);
            echo \yii\helpers\BaseHtml::dropDownList('bm_bk_settings', null, $onlyBk,
                ['multiple' => true, 'id' => 'bm_bk_settings', 'style' => 'width: 300px']) ?>
            <?= Html::a(Yii::t('BotManager', 'Add settings for BK'), '#',
                ['class' => 'btn btn-success', 'id' => 'bm_add_bk']) ?>
        </p>

        <?php \yii\widgets\Pjax::begin(['id' => 'linked_settings']) ?>
        <?php try {
            echo \yii\grid\GridView::widget([
                'dataProvider' => $settingsDataProvider,
                'columns' => [
                    //'id',
                    'bkText',
                    [
                        'attribute' => 'url_one',
                        'label' => 'Start url',
                        'format' => 'raw',
                        'value' => function ($model) {
                            return Html::input('string', "url_one", $model->url_one,
                                ['class' => 'form-control', 'data-bb-id' => $model->id]);
                        }
                    ],
                    [
                        'attribute' => 'comment',
                        'format' => 'raw',
                        'value' => function ($model) {
                            return Html::input('string', "comment", $model->comment,
                                ['class' => 'form-control', 'data-bb-id' => $model->id]);
                        }
                    ],
                    [
                        'class' => 'yii\grid\ActionColumn',
                        'buttons' => [
                            'delete' => function ($url, $model) {
                                return Html::a(
                                    '<span class="glyphicon glyphicon-trash"></span>',
                                    $url,
                                    [
                                        'title' => 'Delete',
                                        'onclick' => "return bm_settings_delete({$model->id});",
                                    ]
                                );
                            },
                            'save' => function ($url, $model) {
                                return Html::a(
                                    '<span class="glyphicon glyphicon-floppy-save"></span>',
                                    $url,
                                    [
                                        'title' => 'Save changes',
                                        'onclick' => "return bm_settings_save({$model->id});",
                                    ]
                                );
                            },
                        ],
                        'template' => '{save} {delete}',
                    ],
                ],
            ]);
        } catch (Exception $e) {
            echo $e->getMessage();
        } ?>
        <?php \yii\widgets\Pjax::end() ?>

    <?php } ?>

</div>
