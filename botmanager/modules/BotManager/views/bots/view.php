<?php

use yii\helpers\Html;
use yii\widgets\DetailView;
use yii\bootstrap\Modal;
use yii\helpers\Url;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Bots */
/* @var $bksDataProvider \yii\data\ActiveDataProvider */
/* @var $queueDataProvider \yii\data\ActiveDataProvider */

$this->title = $model->readableName;
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Bots'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);

$this->registerJs("let bm_bk_save = function(id) {
    let params = {
        'BotsBks[login]' : $('input[data-bb-id=\"' + id + '\"][name=\"login\"]').val(),
        'BotsBks[password]' : $('input[data-bb-id=\"' + id + '\"][name=\"password\"]').val(),
        'BotsBks[url]' : $('input[data-bb-id=\"' + id + '\"][name=\"url\"]').val(),
        'BotsBks[comment]' : $('input[data-bb-id=\"' + id + '\"][name=\"comment\"]').val(),
    };
    //console.log(params);
    $.post('" . \yii\helpers\Url::toRoute(['bots/update-bk']) . "?bots_bks_id=' + id, params, 
        function(data) { if (data === 'ok') { $.pjax.reload({container:'#linked_bks'}); } 
            else { alert(data); } });
    return false;
};", $this::POS_END);

$this->registerJsFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'jquery.colorbox-min.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerCssFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'colorbox.css']));

$this->registerJs('
let weAddInReal = "";
function AddRelationCallback(selected, bkSelected) {
    //console.log(selected);
    //console.log(bkSelected);
    if (selected && selected.length > 0) {
        if (weAddInReal === "") {
            $.post("' . Url::toRoute(['bots/add-relation']) . '", {id: ' . $model->id . ', selection: selected.join(",")}, function() {
                $.pjax.reload({container: \'#psRelation\'});
            });
        } else {
            if (weAddInReal === "REGISTER_IN_BK") {
                // console.log(selected[0], bkSelected[0]);
                if (bkSelected[0] === "OLIMP") {
                    $(\'#olimp_account_bookmaker\').val(selected[0]);
                    $(\'#olimp_modal\').modal(\'show\');    
                } else {
                    createQueueAction(\'REGISTER_IN_BK\', JSON.stringify({account_bookmaker: selected[0]}));
                }   
            }
            weAddInReal = "";
        };
    }
}
', $this::POS_END);

?>
<div class="bots-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-1">
            <?= Html::a(Yii::t('BotManager', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        </div>
        <div class="col-md-2">
            <?= Html::a(Yii::t('BotManager', 'Download Software'), ['bots/download', 'id' => $model->id, 'type' => 2],
                ['class' => 'btn btn-info']) ?>
        </div>
        <div class="col-md-2">
            <?= Html::a(Yii::t('BotManager', 'Download Extension'), ['bots/download', 'id' => $model->id, 'type' => 0],
                ['class' => 'btn btn-info']) ?>
        </div>
        <div class="col-md-1">

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

    <?php try {
        echo DetailView::widget([
            'model' => $model,
            'template' => "<tr><th style='width: 160px;'>{label}</th><td>{value}</td></tr>",
            'attributes' => [
                [
                    'attribute' => 'virtual_machine_name',
                    'label' => 'Name',
                    'value' => function ($model) {
                        return "{$model->virtual_machine_name}" . (!empty($model->server_name) ? " @ {$model->server_name}" : '');
                    }
                ],
                [
                    'attribute' => 'server.name',
                    'label' => "VM's Server",
                    'format' => 'raw',
                    'value' => function ($m) {
                        return empty($m->server) ? null : Html::a($m->server->name, ['server/view', 'id' => $m->server->id]);
                    }
                ],
                [
                    'attribute' => 'id',
                    'label' => 'ID, VM UID, activity',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return "{$m->id}, {$m->virtual_machine_uid}, " . \Yii::$app->formatter->asRelativeTime($m->last_request) . " ({$m->last_status})";
                    }
                ],
                [
                    'attribute' => 'websocket_uid',
                    'label' => 'WS UID, url, test',
                    'format' => 'raw',
                    'value' => function ($m) {
                        $res = "{$m->websocket_uid}, {$m->websocket_url}";
                        if ($m->test_mode_on) {
                            return "{$res}, test mode <strong style='color: red;'>ON</strong> at {$m->test_url}";
                        } else {
                            return "{$res}, test mode off";
                        }
                    }
                ],
                'description:html',
                [
                    'attribute' => 'bmBkSelect',
                    'format' => 'ntext',
                    'value' => function ($model) {
                        return implode(', ', \yii\helpers\ArrayHelper::map($model->botsBks, 'name', 'name'));
                    }
                ],
                [
                    'attribute' => 'softwareVersion.name',
                    'label' => 'Software',
                ],
                'textComment:ntext',
                [
                    'attribute' => 'guacamoleIcon',
                    'format' => 'raw',
                ],
                [
                    'attribute' => 'double_enabled',
                    'label' => 'Second websocket',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return !$m->double_enabled ? 'Disabled' : "<strong>WS2 Enabled</strong> {$m->double_url} with {$m->double_uid}";
                    }
                ],
                'comment:ntext',
            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>

    <?= $this->render('_botQueue', [
        'model' => $model,
        'queueDataProvider' => $queueDataProvider,
    ]) ?>

    <h2>BKs:</h2>

    <?php \yii\widgets\Pjax::begin(['id' => 'linked_bks']) ?>
    <?php $sort = $bksDataProvider->getSort();
    $sort->attributes['name'] = [
        'asc' => ['bm_file_groups.name' => SORT_ASC],
        'desc' => ['bm_file_groups.name' => SORT_DESC],
    ]; ?>
    <?php try {
        echo \yii\grid\GridView::widget([
            'dataProvider' => $bksDataProvider,
            'columns' => [
                [
                    'attribute' => 'name',
                    'value' => 'bk.name',
                    //'value' => function($model) {
                    //    return "{$model->bk->name} ({$model->bk->bk_internal})";
                    //}
                ],
                [
                    'attribute' => 'login',
                    'format' => 'raw',
                    'value' => function ($model) {
                        return Html::input('string', "login", $model->login, ['class' => 'form-control', 'data-bb-id' => $model->id]);
                    }
                ],
                [
                    'attribute' => 'password',
                    'format' => 'raw',
                    'value' => function ($model) {
                        return Html::input('string', "password", $model->password, ['class' => 'form-control', 'data-bb-id' => $model->id]);
                    }
                ],
                [
                    'attribute' => 'url',
                    'format' => 'raw',
                    'value' => function ($model) {
                        return Html::input('string', "url", $model->url, ['class' => 'form-control', 'data-bb-id' => $model->id]);
                    }
                ],
                [
                    'attribute' => 'comment',
                    'format' => 'raw',
                    'value' => function ($model) {
                        return Html::input('string', "comment", $model->comment, ['class' => 'form-control', 'data-bb-id' => $model->id]);
                    }
                ],
                [
                    'class' => 'yii\grid\ActionColumn',
                    'buttons' => [
                        'save' => function ($url, $model) {
                            return Html::a(
                                '<span class="glyphicon glyphicon-floppy-save"></span>',
                                $url,
                                [
                                    'title' => 'Save changes',
                                    'onclick' => "return bm_bk_save({$model->id});",
                                ]
                            );
                        },
                    ],
                    'template' => '{save}',
                ],

            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>
    <?php \yii\widgets\Pjax::end() ?>

    <h3>Pay systems:
        <?= Html::button('Add relation', ['class' => 'btn btn-success',
            'onclick' =>
                '$.colorbox({iframe: true, href: "' . Url::toRoute(['/pay-systems/paysystems/select']) . '", innerWidth: 1000, innerHeight: "80%"}); return false;']) ?>
    </h3>
    <?php \yii\widgets\Pjax::begin(['id' => 'psRelation']); ?>
    <?php try {
        echo \yii\grid\GridView::widget([
            'dataProvider' => new \yii\data\ActiveDataProvider([
                'query' => \app\modules\PaySystems\models\PaysystemsBots::find()->where(['bm_bots_id' => $model->id, 'deleted' => 0]),
                'pagination' => [
                    'pageSize' => 20,
                ],
                'sort' => [
                    'defaultOrder' => [
                        'updated_at' => SORT_DESC,
                    ]
                ],
            ]),
            'showFooter' => false,
            'showHeader' => true,
            'layout' => "{items}",
            'columns' => [
                //['attribute' => 'created_at', 'format' => 'datetime', 'enableSorting' => false,],
                //['attribute' => 'updated_at', 'format' => 'datetime', 'enableSorting' => false,],
                //['attribute' => 'bots.id'],
                [
                    'attribute' => 'paysystems.type',
                    'value' => function ($m) {
                        return \app\modules\BotManager\models\Bots::$paymentMethods[$m->paysystems->type];
                    }
                ],
                [
                    'attribute' => 'paysystems.login',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return Html::a($m->paysystems->login, ['/pay-systems/paysystems/view', 'id' => $m->paysystems->id]);
                    }
                ],
                [
                    'attribute' => 'balance',
                    'label' => 'Balance, checked at',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return Yii::$app->formatter->asDecimal($m->paysystems->balance, 2) . ", "
                            . Yii::$app->formatter->asRelativeTime($m->paysystems->checked_at);
                    }
                ],
                ['attribute' => 'paysystems.comment', 'format' => 'ntext'],
                [
                    'class' => 'yii\grid\ActionColumn',
                    'buttons' => [
                        'delete' => function ($url, $model) {
                            return Html::a('<span class="glyphicon glyphicon-trash"></span>',
                                Url::toRoute(['bots/delete-relation', 'id' => $model->id]),
                                [
                                    'title' => Yii::t('PaySystems', 'Delete relation to bot'),
                                    'onclick' => '$.post($(this).attr("href"), {}, function() { $.pjax.reload({container: \'#psRelation\'}); }); return false;'
                                ]);
                        }
                    ],
                    'template' => '{delete}',
                ],
            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>
    <?php \yii\widgets\Pjax::end(); ?>

    <?php Modal::begin(['id' => 'amount_modal', 'header' => '<strong>Enter amount:</strong>', 'size' => 'modal-sm']) ?>
    <?= Html::dropDownList('amount_bk', '',
        \yii\helpers\ArrayHelper::map($model->botsBks, 'bk_internal', 'name'),
        ['id' => 'amount_bk', 'class' => 'form-control', 'options' => \yii\helpers\ArrayHelper::map($model->botsBks, 'bk_internal', function ($array) {
            return ['disabled' => $array->bk_internal !== 'onexbet'];
        })]) ?>
    <br/>
    <?= Html::input('number', 'amount_amount', '1000', ['id' => 'amount_amount', 'class' => 'form-control']) ?>
    <br/>
    <?= Html::input('hidden', 'amount_action', '', ['id' => 'amount_action']) ?>
    <strong style="color: red;">First, ensure, that you have selected Payment Method and credentials!</strong>
    <br/>
    <?= Html::button('OK', ['class' => 'btn btn-primary', 'onclick' => 'return saveAmount();']) ?>
    <?php Modal::end() ?>

    <?php Modal::begin(['id' => 'bot_settings', 'header' => '<strong>Bot settings:</strong>', 'size' => '']) ?>
    <label for="settings_name">VM Name:</label>
    <?= Html::input('text', 'settings_name', $model->virtual_machine_name,
        ['id' => 'settings_name', 'maxlength' => true, 'class' => 'form-control']) ?>
    <br/>
    <?= Html::button('OK', ['class' => 'btn btn-primary', 'onclick' => 'return saveSettings();']) ?>
    <?php Modal::end() ?>

    <?php Modal::begin(['id' => 'please_wait', 'header' => '<strong>Please wait!</strong>', 'size' => '', 'closeButton' => false]) ?>
    <?php Modal::end() ?>

    <?php Modal::begin(['id' => 'response_modal', 'header' => '<strong>Response</strong>', 'size' => '']) ?>
    <div id="response_modal_body"></div>
    <?php Modal::end() ?>

    <?php Modal::begin(['id' => 'olimp_modal', 'header' => '<strong>Passport for Olimp:</strong>', 'size' => '']) ?>
    <label for="settings_name">Passport:</label>
    <?= Html::input('hidden', 'account_bookmaker', '', ['id' => 'olimp_account_bookmaker']) ?>
    <?= Html::input('text', 'olimp_passport_number', '',
        ['id' => 'olimp_passport_number', 'maxlength' => true, 'class' => 'form-control']) ?>
    <br/>
    <?= Html::button('OK', ['class' => 'btn btn-primary', 'onclick' => 'return registerOlimp();', 'data-dismiss' => 'modal']) ?>
    <?php Modal::end() ?>

</div>
