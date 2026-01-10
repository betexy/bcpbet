<?php

use yii\helpers\Html;
use yii\helpers\Url;
use app\modules\BotManager\models\BotsQueue;
use app\modules\BotManager\models\FileGroups;
use app\modules\Accounts\models\AccountBookmaker;

/* @var $this yii\web\View */
/* @var $model \app\modules\BotManager\models\Bots */
/* @var $queueDataProvider \yii\data\ActiveDataProvider */

$this->registerJs("
let saveAmount = function() {
    let amount = parseInt($('#amount_amount').val());
    let bk = $('#amount_bk').val();
    if (bk !== null && bk !== '' && !isNaN(amount) && amount > 0) { 
        createQueueAction($('#amount_action').val(), JSON.stringify({amount: amount, bk: bk})); 
        $('#amount_modal').modal('hide');
    }
    return false;
};
let saveSettings = function() {
    let bot_name = $('#settings_name').val();    
    if (bot_name !== '') { 
        createQueueAction('CHANGE_INI_DATA', JSON.stringify({bot_name: bot_name})); 
        $('#bot_settings').modal('hide');
    }
    return false;
};
let registerOlimp = function() {
    let olimp_account_bookmaker = $('#olimp_account_bookmaker').val();
    let olimp_passport_number = $('#olimp_passport_number').val();
    createQueueAction('REGISTER_IN_BK', JSON.stringify({account_bookmaker: olimp_account_bookmaker, passport_number: olimp_passport_number}));
    return true;
};     
let createQueueAction = function(action, additional) {
    let params = {
        'BotsQueue[bots_id]' : {$model->id},
        'BotsQueue[action]' : action,
        'BotsQueue[status]' : 0
    };
    if (['DEPOSIT', 'WITHDRAW', 'CHANGE_INI_DATA', 'REGISTER_IN_BK'].indexOf(action) > -1) {
        params['BotsQueue[data]'] = additional;
    }
    console.log(params);
    $('#please_wait').modal('show');
    $.ajax({
        type: \"POST\", 
        url: '" . Url::toRoute(['bots/create-bot-action']) . "', 
        data: params, 
        dataType: \"json\",
        success: function(data) { 
            if (data.status === 'success') { 
                $.pjax.reload({container:'#bot_queue', timeout: false}).done(function() {
                    $.pjax.reload({container:'#linked_bks'});    
                }); 
            }
            if (typeof data.message === 'string' && data.message.length > 0) {
                $('#response_modal_body').text(data.message);
                $('#response_modal').modal('show');
            } 
        }            
    }).always(() => {
        $('#please_wait').modal('hide');
    });
};", $this::POS_END);

$this->registerJs("
    $('#bm_add_action_to_queue').click(function(e) {
        e.preventDefault();
        let action = $('#bots_queue_action').val();
        if (['DEPOSIT','WITHDRAW'].indexOf(action) > -1) {
            $('#amount_action').val(action);
            $('#amount_modal').modal('show');
        } else if (action === 'CHANGE_INI_DATA') {
            $('#bot_settings').modal('show');   
        } else if (action === 'REGISTER_IN_BK') {
            weAddInReal = 'REGISTER_IN_BK';
            $.colorbox({iframe: true, href: \"select-account-bookmaker\", innerWidth: 1000, innerHeight: \"80%\"}); return false;
        } else {
            createQueueAction(action);
        }        
        return false;
    });
", $this::POS_READY);

$this->registerJs("let bm_queue_delete = function(id) {
    if (confirm('Are you sure?')) {
        $.post('" . Url::toRoute(['bots/delete-bot-action']) . "?id=' + id, {}, 
            function(data) { if (data === 'ok') { $.pjax.reload({container:'#bot_queue'}); } 
                else { alert(data); } });
    }
    return false;
};", $this::POS_END);

$this->registerJs("let bm_queue_apply_settings = function(id, path) {
    if (confirm('Are you sure? All current settings would overwritten!')) {
        $.post('" . Url::toRoute(['bots/apply-settings']) . "?id=' + id, 
            {path: path}, 
            function(data) { if (data === 'ok') { window.location.reload(true); } 
                else { alert(data); } });
    }
    return false;
};", $this::POS_END);

$this->registerJs("let bm_queue_view_settings = function(id, path) {
    window.open('" . Url::toRoute(['bots/view-settings']) . "?id=' + id + '&path=' + path);    
    return false;
};", $this::POS_END);

?>

    <div class="row">
        <div class="col-md-2" style="font-size: 30px;">
            <a href="#" onclick="$.pjax.reload({container:'#bot_queue'}); return false;">Actions:</a>
        </div>
        <div class="col-md-3">

        </div>
        <div class="col-md-5">
            <?= Html::dropDownList('', null, BotsQueue::$actionsList,
                ['class' => 'form-control', 'id' => 'bots_queue_action']) ?>
        </div>
        <div class="col-md-1">
            <button class="btn btn-success" id="bm_add_action_to_queue">Add action to queue</button>
        </div>
    </div>
<?php \yii\widgets\Pjax::begin(['id' => 'bot_queue']) ?>
<?php try {
    echo \yii\grid\GridView::widget([
        'dataProvider' => $queueDataProvider,
        'columns' => [
            'id',
            [
                'attribute' => 'created_at',
                'contentOptions' => ['style' => 'width: 100px;'],
                'value' => function ($m) {
                    return Yii::$app->formatter->asRelativeTime($m->created_at);
                }
            ],
            [
                'attribute' => 'updated_at',
                'contentOptions' => ['style' => 'width: 100px;'],
                'value' => function ($m) {
                    return Yii::$app->formatter->asRelativeTime($m->updated_at);
                }
            ],
            [
                'attribute' => 'action',
                'format' => 'raw',
                'value' => function ($model) {
                    $text = BotsQueue::$actionsList[$model->action];
                    if (in_array($model->action, ['DEPOSIT', 'WITHDRAW'])) {
                        $data = json_decode($model->data, true);
                        if (!empty($data['amount']) && !empty($data['bk'])) {
                            $text .= ' ' . FileGroups::getBkInternals()[$data['bk']]
                                . ": <strong style='color: green;'>{$data['amount']}</strong>";
                        } else {
                            $text .= " <strong style='color: red;'>WRONG VALUE: {$model->data}</strong>";
                        }
                    } else if ($model->action === 'CHANGE_INI_DATA') {
                        $data = json_decode($model->data);
                        $text = "Update: bot_name = '{$data->bot_name}'";
                    } else if ($model->action === 'REGISTER_IN_BK') {
                        $data = json_decode($model->data);
                        $ab = AccountBookmaker::findOne($data->account_bookmaker);
                        if (empty($ab)) {
                            $text = "<strong style='color: red;'>WRONG account_bookmaker!!! '{$data->account_bookmaker}'</strong>";
                        } else {
                            $text = "Register {$ab->account->first_name} {$ab->account->second_name} {$ab->account->third_name} at {$ab->bookmaker}"
                                . "{$data->nickname} / {$data->password}, {$data->mothers_maiden_name} ({$data->mothers_maiden_name_en})"
                                . (!empty($data->passport_number) ? ", passport: {$data->passport_number}" : '');
                        }
                    }
                    return $text;
                }
            ],
            [
                'attribute' => 'run_after_success',
                'label' => 'S/E',
                //'contentOptions' => ['style' => 'width: 100px;'],
                'format' => 'raw',
                'value' => function ($m) {
                    $runAfter = empty($m->run_after_success) && empty($m->run_after_fail) ? '-'
                        : (!empty($m->run_after_success)
                            ? "<strong style='color: green;'>{$m->run_after_success}</strong>"
                            : "<strong style='color: red;'>{$m->run_after_fail}</strong>");
                    return "{$runAfter}/" . substr($m::$executorsList[$m->executor], 0, 1);
                }
            ],
            [
                'attribute' => 'status',
                'value' => function ($model) {
                    return BotsQueue::$statusesList[$model->status];
                }
            ],
            [
                'attribute' => 'response',
                'format' => 'raw',
                'value' => function ($model) {
                    if ($model->action === 'CHECK_INSTALLED' && !empty($model->data)) {
                        $result = [];
                        $data = json_decode($model->data, true);
                        foreach (array_keys($data) as $path) {
                            $result[] = "There are settings in the path: <span style='font-family: monospace;'>{$path}</span> "
                                . Html::button('Import', ['class' => 'btn btn-warning',
                                    'onclick' => "return bm_queue_apply_settings({$model->id}, '" . base64_encode($path) . "');"])
                                . '   '
                                . Html::button('View', ['class' => 'btn btn-info',
                                    'onclick' => "return bm_queue_view_settings({$model->id}, '" . base64_encode($path) . "');"]);
                        }
                        return implode("<br />", $result);
                    } else if ($model->action === 'REGISTER_IN_BK') {
                        $parsed = json_decode($model->response);
                        return $parsed === null ? $model->response : var_export($parsed, true);
                    } else {
                        return $model->response;
                    }
                }
            ],
            [
                'class' => 'yii\grid\ActionColumn',
                'buttons' => [
                    'delete' => function ($url, $model) {
                        //if ($model->status === 0) {
                        return Html::a(
                            '<span class="glyphicon glyphicon-trash"></span>',
                            $url,
                            [
                                'title' => 'Delete',
                                'onclick' => "return bm_queue_delete({$model->id});",
                            ]
                        );
                        //} else {
                        //    return '';
                        //}
                    },
                ],
                'template' => '{delete}',
            ],
        ],
    ]);
} catch (Exception $e) {
    echo $e->getMessage();
} ?>

<?php \yii\widgets\Pjax::end() ?>