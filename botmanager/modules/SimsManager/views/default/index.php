<?php

use yii\helpers\Url;
use yii\helpers\Html;
use yii\helpers\ArrayHelper;
use yii\widgets\Pjax;

use app\modules\SimsManager\models\Slots;
use app\modules\SimsManager\models\Channels;
use app\modules\SimsManager\models\Sims;
use app\modules\SimsManager\models\Smses;
use app\modules\SimsManager\models\Actions;

$this->title = Yii::t('SimsManager', 'SIMs - Main Page');
$this->params['breadcrumbs'][] = ['label' => 'SIM manager', 'url' => ['/sims-manager']];
$this->params['breadcrumbs'][] = $this->title;

$slotsCount = (int)Slots::find()->count();
$channelsCount = (int)Channels::find()->count();
$simsCount = (int)Sims::find()->count();

$numbers = ArrayHelper::merge(['' => '---'],
    ArrayHelper::map(Slots::find()->joinWith(['sims'])->all(), 'id', function ($m) {
        return empty($m->sim) ? '' : "{$m->sim->number} [ {$m->sim->comment} ]";
    }));

$channels = ArrayHelper::merge(['' => '---'],
    ArrayHelper::map(Channels::find()->where(['only_manual' => true])->all(), 'id', 'channel_id'));

$this->registerJsFile(\yii\helpers\Url::toRoute(['/BotManager/files/internal-js', 'name' => 'chosen.jquery.min.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerCssFile(\yii\helpers\Url::toRoute(['/BotManager/files/internal-js', 'name' => 'chosen.min.css']));

$this->registerJs("$('.needChosen').chosen();", $this::POS_READY);

$this->registerJs("function refreshData() {
    if (confirm('Are you sure? Data refreshes automatically each minute...')) {
        $.get('/sims-manager/channels/request-bound', function(d) {
            $.pjax.reload({container: '#currentlyBound'});
            $('#boundPanel').removeClass('panel-success').addClass('panel-warning');
            setTimeout(function() {
                $('#boundPanel').removeClass('panel-warning').addClass('panel-success');   
            }, 1000);
        });
    }
}", $this::POS_END);

$this->registerJs("function refreshSMSData() {
    if (confirm('Are you sure? Data refreshes automatically each 20 seconds...')) {
        $.get('/sims-manager/smses/goip-load', function(d) {
            $.pjax.reload({container: '#lastSMS'});
            $('#smsPanel').removeClass('panel-success').addClass('panel-warning');
            setTimeout(function() {
                $('#smsPanel').removeClass('panel-warning').addClass('panel-success');   
            }, 1000);
        });
    }
}", $this::POS_END);

$this->registerJs("
    var refreshGridsHops = 0;
    var refreshGrids = setInterval(function() {
        refreshGridsHops++;
        $.pjax.reload({container: '#currentlyRequestsBound', timeout: false})
            .done(function() {
                if (refreshGridsHops === 4) {
                    refreshGridsHops = 0;
                    $.pjax.reload({container: '#currentlyBound', timeout: false});
                } else if (refreshGridsHops === 3) {
                    $.pjax.reload({container: '#lastSMS', timeout: false});
                }
            });
    }, 5000);
", $this::POS_END);

?>
<?php if ($slotsCount === 0) { ?>
    <div class="panel panel-info">
        <div class="panel-heading">
            Fill Slots with data
        </div>
        <div class="panel-body">
            <form class="form-inline" method="post" action="<?= Url::to('sims-manager/default/generate') ?>">
                <input type="hidden" name="type" value="slots"/>
                <input type="hidden" name="<?= Yii::$app->request->csrfParam ?>" value="<?= Yii::$app->request->csrfToken ?>"/>
                <div class="row">
                    <div class="col-md-2">
                        <div class="input-group">
                            <span class="input-group-addon">Count:</span>
                            <input type="text" class="form-control" value="128" name="count"/>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="input-group">
                            <span class="input-group-addon">First Slot ID:</span>
                            <input type="text" class="form-control" value="15128001" name="first_id"/>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <input type="submit" value="Generate" class="btn btn-success"/>
                    </div>
                </div>
            </form>
        </div>
    </div>
<?php } ?>
<?php if ($channelsCount === 0) { ?>
    <div class="panel panel-info">
        <div class="panel-heading">
            Fill Channels with data
        </div>
        <div class="panel-body">
            <form class="form-inline" method="post" action="<?= Url::to('sims-manager/default/generate') ?>">
                <input type="hidden" name="type" value="channels"/>
                <input type="hidden" name="<?= Yii::$app->request->csrfParam ?>" value="<?= Yii::$app->request->csrfToken ?>"/>
                <div class="row">
                    <div class="col-md-2">
                        <div class="input-group">
                            <span class="input-group-addon">Count:</span>
                            <input type="text" class="form-control" value="4" name="count"/>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="input-group">
                            <span class="input-group-addon">First Channel (Line) ID:</span>
                            <input type="text" class="form-control" value="1050401" name="first_id"/>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <input type="submit" value="Generate" class="btn btn-success"/>
                    </div>
                </div>
            </form>
        </div>
    </div>
<?php } ?>

<div class="sims-manager-default-index">
    <div class="row">
        <div class="col-md-5">
            <a class="btn btn-success" href="<?= Url::toRoute(['/sims-manager/sims']) ?>">SIM Cards</a>
            &nbsp;&nbsp;
            <a class="btn btn-success" href="<?= Url::toRoute(['/sims-manager/slots']) ?>">Slots</a>
            &nbsp;&nbsp;
            <a class="btn btn-success" href="<?= Url::toRoute(['/sims-manager/channels']) ?>">Channels</a>
            &nbsp;&nbsp;
            <a class="btn btn-success" href="<?= Url::toRoute(['/sims-manager/smses']) ?>">SMSs</a>&nbsp;&nbsp;
            &nbsp;&nbsp;
            <a class="btn btn-info" href="<?= Url::toRoute(['/sims-manager/requests']) ?>">Requests</a>
        </div>
    </div>
    <br/>
    <div class="panel panel-success" id="smsPanel">
        <div class="panel-heading">
            Last five SMSs - <a href="#" onclick="refreshSMSData(); return false;">Refresh</a>
        </div>
        <div class="panel-body">
            <?php Pjax::begin(['id' => 'lastSMS']); ?>
            <?php try {
                echo \yii\grid\GridView::widget([
                    'dataProvider' => new \yii\data\ActiveDataProvider([
                        'query' => Smses::find(),
                        'pagination' => [
                            'pageSize' => 5,
                        ],
                        'sort' => [
                            'defaultOrder' => [
                                'id' => SORT_DESC,
                            ]
                        ],
                    ]),
                    'showFooter' => false,
                    'showHeader' => true,
                    'layout' => "{items}",
                    'columns' => [
                        ['attribute' => 'receive_id', 'enableSorting' => false,],
                        [
                            'attribute' => 'number',
                            'enableSorting' => false,
                            'value' => function ($model) {
                                return $model->number . (empty($model->sim->comment) ? '' : " [ {$model->sim->comment} ]");
                            }
                        ],
                        [
                            'attribute' => 'scrum',
                            'enableSorting' => false,
                            'format' => 'raw',
                            'value' => function ($model) {
                                return Html::a($model->scrum, ['smses/view', 'id' => $model->id]);
                            }
                        ],
                        ['attribute' => 'msg', 'format' => 'ntext', 'enableSorting' => false,],
                        [
                            'attribute' => 'time_received',
                            'enableSorting' => false,
                            'value' => function ($model) {
                                $dt = \DateTime::createFromFormat('Y-m-d H:i:s', $model->time_received);
                                return empty($dt) ? '' : Yii::$app->formatter->asRelativeTime($dt->format('Y-m-d H:i:s'));
                            }
                        ],
                    ],
                ]);
            } catch (Exception $e) {
                echo $e->getMessage();
            } ?>
            <?php Pjax::end(); ?>
        </div>
    </div>
    <br/>
    <?php if ($slotsCount > 0 && $channelsCount > 0 && $simsCount > 0) { ?>
        <div class="panel panel-success" id="boundPanel">
            <div class="panel-heading">
                Currently bound (BANK) - <a href="#" onclick="refreshData(); return false;">Refresh data</a>
            </div>
            <div class="panel-body">
                <?php Pjax::begin(['id' => 'currentlyBound']); ?>
                <?php try {
                    echo \yii\grid\GridView::widget([
                        'dataProvider' => (new \app\modules\SimsManager\models\ChannelsSearch())->search([]),
                        'showFooter' => false,
                        'showHeader' => true,
                        'layout' => "{items}",
                        'columns' => [
                            [
                                'attribute' => 'channel_id',
                                'enableSorting' => false,
                            ],
                            [
                                'attribute' => 'SlotGOIP',
                                'label' => 'Slot ID / GOIP ID',
                                'enableSorting' => false,
                                'format' => 'ntext',
                                'value' => function ($model) {
                                    return empty($model->slot) ? '' : "{$model->slot->slot_id} / {$model->goip_sms_id}";
                                },
                            ],
                            [
                                'attribute' => 'number',
                                'value' => function ($model) {
                                    return empty($model->sim) ? '' : "{$model->sim->number} [ {$model->sim->comment} ]";
                                },
                                'enableSorting' => false,
                            ],
                            [
                                'attribute' => 'comment',
                                'format' => 'ntext',
                                'enableSorting' => false,
                            ],
                        ],
                    ]);
                } catch (Exception $e) {
                    echo $e->getMessage();
                } ?>
                <?php Pjax::end(); ?>
            </div>
        </div>
        <br/>
        <div class="panel panel-warning" id="boundRequestsPanel">
            <div class="panel-heading">
                Currently bound (REQUESTS) - <a href="#"
                                                onclick="$.pjax.reload({container: '#currentlyRequestsBound'}); return false;">Refresh
                    data</a>
            </div>
            <div class="panel-body">
                <?php Pjax::begin(['id' => 'currentlyRequestsBound']); ?>
                <?php try {
                    echo \yii\grid\GridView::widget([
                        'dataProvider' => new \yii\data\ActiveDataProvider([
                            'query' => Actions::find()->where(['active' => true]),
                            'pagination' => [
                                'pageSize' => 5,
                            ],
                            'sort' => [
                                'defaultOrder' => [
                                    'id' => SORT_DESC,
                                ]
                            ],
                        ]),
                        'showFooter' => false,
                        'showHeader' => true,
                        'layout' => "{items}",
                        'columns' => [
                            [
                                'attribute' => 'id',
                                'enableSorting' => false,
                            ],
                            [
                                'attribute' => 'bound_at',
                                'label' => 'Bound',
                                'enableSorting' => false,
                                'format' => 'raw',
                                'value' => function ($m) {
                                    return Yii::$app->formatter->asRelativeTime($m->bound_at);
                                }
                            ],
                            [
                                'attribute' => 'sims.number',
                                'value' => function ($model) {
                                    return empty($model->sims) ? '' : "{$model->sims->number} [ {$model->sims->comment} ]";
                                },
                                'enableSorting' => false,
                            ],
                            [
                                'attribute' => 'requests.id',
                                'label' => 'Request ID',
                                'enableSorting' => false,
                            ],
                            [
                                'attribute' => 'websocket_uid',
                                'label' => 'UID, Name',
                                'format' => 'raw',
                                'value' => function ($m) {
                                    return "{$m->requests->websocket_uid}, <strong>{$m->requests->bots->virtual_machine_name}</strong>";
                                }
                            ],
                            [
                                'class' => 'yii\grid\ActionColumn',
                                'buttons' => [
                                    'delete' => function ($url, $model) {
                                        return Html::a('<span class="glyphicon glyphicon-trash"></span>',
                                            Url::toRoute(['default/unbind', 'request_id' => $model->requests->id]),
                                            [
                                                'title' => Yii::t('SimsManager', 'Unbind'),
                                                'onclick' =>
                                                    '$.post($(this).attr("href"), {}, function(d) { console.log(d); '
                                                    . '$.pjax.reload({container: \'#currentlyRequestsBound\'}); }); return false;'
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
                <?php Pjax::end(); ?>
            </div>
        </div>
        <br/>
        <div class="panel panel-info">
            <div class="panel-heading">
                Bind Number to Channel
            </div>
            <div class="panel-body">
                <form class="form-inline" method="post" action="<?= Url::to('sims-manager/default/bind') ?>">
                    <input type="hidden" name="<?= Yii::$app->request->csrfParam ?>"
                           value="<?= Yii::$app->request->csrfToken ?>"/>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="input-group">
                                <span class="input-group-addon">Number:</span>
                                <?= Html::dropDownList('bind_number', '', $numbers,
                                    ['multiple' => false, 'id' => 'bind_number', 'style' => 'min-width: 420px',
                                        'class' => 'form-control needChosen']) ?>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="input-group">
                                <span class="input-group-addon">Channel:</span>
                                <?= Html::dropDownList('bind_channel', '', $channels,
                                    ['multiple' => false, 'id' => 'bind_channel', 'class' => 'form-control needChosen']) ?>
                            </div>
                        </div>
                        <div class="col-md-1">
                            <input type="submit" value="BIND" class="btn btn-danger"/>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    <?php } ?>
</div>

