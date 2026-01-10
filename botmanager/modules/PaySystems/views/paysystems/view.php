<?php

use yii\helpers\Html;
use yii\widgets\DetailView;
use yii\helpers\Url;
use yii\bootstrap\Modal;
use app\modules\PaySystems\models\History;

require_once __DIR__ . '/additions.php';

/* @var $this yii\web\View */
/* @var $model app\modules\PaySystems\models\Paysystems */

$this->title = $model->title;
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('PaySystems', 'Paysystems'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;

$this->registerJsFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'jquery.colorbox-min.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerCssFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'colorbox.css']));

$this->registerJsFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'chosen.jquery.min.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerCssFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'chosen.min.css']));

$this->registerCss('
    table.historyTable tr {
        border-bottom: 1px solid blue;
    }
    table.historyTable td {
        padding: 0px 2px;
        text-align: center;
        border-right: 1px solid lightblue;
    }
    table.historyTable tr td:last-child {
        text-align: left;
        border-right: none;
    }
');

$this->registerJs('function AddRelationCallback(selected) {
    console.log(selected);
    if (selected && selected.length > 0) {
        $.post("' . Url::toRoute(['paysystems/add-relation']) . '", {id: ' . $model->id . ', selection: selected.join(",")}, function() {
            $.pjax.reload({container: \'#botsRelation\'});
        });
    }
}
function moneyTransferTo() {
    let action = $(\'#modal_action\').val().trim(); 
    let recipient = $(\'#modal_recipient\').val().trim(); 
    let amount = $(\'#modal_amount\').val().trim();
    if (action === \'\' || recipient === \'\' || amount === \'\' || amount === \'0\') {
        alert(\'All fields are necessary!\');
        return false;
    } else {
        createQueueAction(action, JSON.stringify({recipient: recipient, amount: $("#BTC_amount").val() === "1" ? amount : parseInt(amount)}));
        $(\'#modal_action\').val(\'\'); 
        $(\'#modal_recipient\').val(\'\');
        $(\'#modal_amount\').val(0);
        $("#modal_form").modal("hide");
        return true;
    }
}
function createQueueAction(action, additional) {
        let params = {
            \'PaysystemsQueue[ps_paysystems_id]\' : ' . $model->id . ',
            \'PaysystemsQueue[command]\' : action,
            \'PaysystemsQueue[status]\' : 0
        };
        if ([\'TRANSFER_INTERNAL\'].indexOf(action) > -1) {
            params[\'PaysystemsQueue[data]\'] = additional;
        }
        console.log(params);
        $.post(\'' . \yii\helpers\Url::toRoute(['paysystems/create-action']) . '\', params, 
            function(data) { 
                if (data === \'ok\') { 
                    $.pjax.reload({container:\'#ps_queue\'}); 
                } else { 
                    alert(data); 
                } 
            }
        );
}
', $this::POS_END);

$this->registerJs('
    $(\'#ps_actions_add_to_queue\').click(function(e) {
        e.preventDefault();
        let action = $(\'#ps_queue_action\').val();
        if ([\'TRANSFER_INTERNAL\'].indexOf(action) > -1) {
            $(\'#modal_action\').val(action);
            $(\'#modal_form\').modal(\'show\');
            $(\'select#modal_recipient\').chosen({ width: \'100%\' });
        } else {
            createQueueAction(action);
        }
        return false;
    });
', $this::POS_READY);

\yii\web\YiiAsset::register($this);
?>
<div class="paysystems-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <div class="row">
        <div class="col-md-2">
            <?= Html::a(Yii::t('PaySystems', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        </div>
        <div class="col-md-2">
            <?= Html::a(Yii::t('PaySystems', 'Create'), ['create'], ['class' => 'btn btn-warning']) ?>
        </div>
        <div class="col-md-2">
            <?= Html::a(Yii::t('PaySystems', 'Delete'), ['delete', 'id' => $model->id], [
                'class' => 'btn btn-danger',
                'data' => [
                    'confirm' => Yii::t('PaySystems', 'Are you sure you want to delete this item?'),
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
                [
                    'attribute' => 'id',
                    'label' => 'ID, Created, Updated at',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return "<strong>{$m->id}</strong>  --- "
                            . Yii::$app->formatter->asRelativeTime($m->created_at) . ' --- '
                            . Yii::$app->formatter->asRelativeTime($m->updated_at);
                    }
                ],
                [
                    'attribute' => 'master.title',
                    'label' => 'When ' . $model->when_amount . ', send ' . $model->send_amount . ' to',
                    'format' => 'raw',
                    'value' => function ($m) {
                        if (empty($m->master)) {
                            return '---';
                        } else {
                            return Html::a($m->master->title, ['paysystems/view', 'id' => $m->master->id]);
                        }
                    }
                ],
                [
                    'attribute' => 'type',
                    'value' => function ($m) {
                        return \app\modules\BotManager\models\Bots::$paymentMethods[$m->type];
                    }
                ],
                [
                    'attribute' => 'login',
                    'label' => 'Login, password, PIN',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return "{$m->login}, {$m->password}" . (empty($m->pin) ? '' : ", {$m->pin}");
                    }
                ],
                [
                    'attribute' => 'balance',
                    'label' => 'Balance, checked at',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return Yii::$app->formatter->asDecimal($m->balance, $m->type === 3 ? 5 : 2) . ", " . Yii::$app->formatter->asRelativeTime($m->checked_at);
                    }
                ],
                [
                    'attribute' => 'additions',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return showAdditions($m);
                    },
                ],
                'comment:ntext',
            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>

    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-2" style="font-size: 24px;">
            <a href="#" onclick="$.pjax.reload({container:'#ps_queue'}); return false;">Actions:</a>
        </div>
        <div class="col-md-3">

        </div>
        <div class="col-md-5">
            <?= Html::dropDownList('', null, \app\modules\PaySystems\models\PaysystemsQueue::$commands,
                ['class' => 'form-control', 'id' => 'ps_queue_action']) ?>
        </div>
        <div class="col-md-1">
            <button class="btn btn-success" id="ps_actions_add_to_queue">Add action to queue</button>
        </div>
    </div>

    <?= $this->render('_psQueue', [
        'dataProvider' => new \yii\data\ActiveDataProvider([
            'query' => \app\modules\PaySystems\models\PaysystemsQueue::find()->where(['ps_paysystems_id' => $model->id]),
            'pagination' => [
                'pageSize' => 20,
            ],
            'sort' => [
                'defaultOrder' => [
                    'updated_at' => SORT_DESC,
                ]
            ],
        ]),
    ]) ?>

    <h3>Transactions:</h3>
    <?php \yii\widgets\Pjax::begin(['id' => 'psTransactions']); ?>
    <?php try {
        echo \yii\grid\GridView::widget([
            'dataProvider' => new \yii\data\ActiveDataProvider([
                'query' => History::find()->where(['ps_paysystems_id' => $model->id]),
                'pagination' => [
                    'pageSize' => 20,
                ],
                'sort' => [
                    'defaultOrder' => [
                        'datetime' => SORT_DESC,
                    ]
                ],
            ]),
            'columns' => [
                [
                    'attribute' => 'datetime',
                    'value' => function ($m) {
                        return Yii::$app->formatter->asRelativeTime($m->datetime);
                    },
                    'filter' => '',
                ],
                [
                    'attribute' => 'type',
                    'value' => function ($m) {
                        return History::$types[$m->type];
                    },
                    'filter' => History::$types,
                ],
                [
                    'attribute' => 'amount',
                    'format' => 'raw',
                    'contentOptions' => ['style' => 'text-align: right'],
                    'value' => function ($m) {
                        return Html::a(
                            '<strong style="color: ' . ($m->type === 1 ? 'darkred' : 'green') . ';">'
                            . $m->printAmount
                            . '</strong> ' . History::$currencies[$m->currency], ['history/view', 'id' => $m->id, 'data-pjax' => '0']);
                    }
                ],
                //'sender',
                //'receiver',
                'description:ntext',
                'comment:ntext',
            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>
    <?php \yii\widgets\Pjax::end(); ?>

    <h3>Bots:
        <?= Html::button('Add relation', ['class' => 'btn btn-success',
            'onclick' =>
                '$.colorbox({iframe: true, href: "' . Url::toRoute(['/BotManager/bots/select']) . '", innerWidth: 1000, innerHeight: "80%"}); return false;']) ?>
    </h3>
    <?php \yii\widgets\Pjax::begin(['id' => 'botsRelation']); ?>
    <?php try {
        echo \yii\grid\GridView::widget([
            'dataProvider' => new \yii\data\ActiveDataProvider([
                'query' => \app\modules\PaySystems\models\PaysystemsBots::find()->where(['ps_paysystems_id' => $model->id, 'deleted' => 0]),
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
                ['attribute' => 'bots.server_name'],
                [
                    'attribute' => 'bots.virtual_machine_name',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return Html::a($m->bots->virtual_machine_name, ['/BotManager/bots/view', 'id' => $m->bots->id]);
                    }
                ],
                ['attribute' => 'bots.description', 'format' => 'html'],
                [
                    'class' => 'yii\grid\ActionColumn',
                    'buttons' => [
                        'delete' => function ($url, $model) {
                            return Html::a('<span class="glyphicon glyphicon-trash"></span>',
                                Url::toRoute(['paysystems/delete-relation', 'id' => $model->id]),
                                [
                                    'title' => Yii::t('PaySystems', 'Delete relation to bot'),
                                    'onclick' => '$.post($(this).attr("href"), {}, function() { $.pjax.reload({container: \'#botsRelation\'}); }); return false;'
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

    <?php Modal::begin(['id' => 'modal_form', 'header' => '<strong>Transfer money to</strong>', 'size' => '']) ?>
    <?= Html::input('hidden', 'modal_action', '', ['id' => 'modal_action']) ?>
    <?php if ($model->type === 3) { ?>
        <label for="modal_recipient">Recipient's wallet:</label>
        <?= Html::input('hidden', 'BTC_amount', '1', ['id' => 'BTC_amount']) ?>
        <?= Html::input('text', 'modal_recipient', '', ['id' => 'modal_recipient', 'class' => 'form-control']) ?>
        <br/>
    <?php } else { ?>
        <label for="modal_recipient">Select recipient:</label>
        <?= Html::dropDownList('modal_recipient', '', $model->recipientsList,
        ['id' => 'modal_recipient', 'class' => 'form-control', 'style' => 'width: 568px;']) ?>
        <br/>
    <?php } ?>
    <label for="modal_amount">Amount:</label>
    <?= Html::input('number', 'modal_amount', '0',
        ['id' => 'modal_amount', 'maxlength' => true, 'class' => 'form-control']) ?>
    <br/>
    <?= Html::button('OK', ['class' => 'btn btn-primary', 'onclick' => 'moneyTransferTo();']) ?>
    <?php Modal::end() ?>

</div>
