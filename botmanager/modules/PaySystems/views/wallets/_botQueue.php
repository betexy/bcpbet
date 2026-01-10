<?php

use app\modules\PaySystems\helpers\PaySystemsHelper;
use yii\helpers\Html;
use yii\helpers\Url;
use app\modules\BotManager\models\BotsQueue;
use app\modules\BotManager\models\FileGroups;
use app\modules\Accounts\models\AccountBookmaker;

/* @var $this yii\web\View */
/* @var $model \app\modules\BotManager\models\Bots */
/* @var $queueDataProvider \yii\data\ActiveDataProvider */

?>

<?php \yii\widgets\Pjax::begin(['id' => 'bot_queue']) ?>
<?php try {
    echo \yii\grid\GridView::widget([
        'dataProvider' => $queueDataProvider,
        'rowOptions' => function ($m) {
            if ($m->deleted) {
                return ['style' => 'background-color: gray;'];
            }
        },
        'columns' => [
            [
                'attribute' => 'id',
                'format' => 'raw',
                'value' => function ($m) {
                    return $m->id . '<br />' . Html::a(
                            '<span class="glyphicon glyphicon-trash"></span>',
                            ['wallets/delete-bot-queue', 'id' => $m->id],
                            [
                                'title' => Yii::t('yii', 'Delete'),
                                'data-confirm' => Yii::t('yii', $m-> deleted
                                    ? 'Are you sure you want to restore this item?'
                                    : 'Are you sure you want to delete this item?'),
                                'data-method' => 'post',
                                'data-pjax' => '0',
                            ]
                        );
                },
            ],
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
                'attribute' => 'status',
                'value' => function ($model) {
                    return BotsQueue::$statusesList[$model->status];
                }
            ],
            [
                'attribute' => 'data',
                'format' => 'ntext',
                'value' => function ($m) {
                    return str_replace(['Array', "\n", "\r", '(', ')'], '', print_r(json_decode($m->data, true), true));
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
                    } else if (in_array($model->action, ['REGISTER_IN_BK', 'CHECK_WALLET_BALANCE',])) {
                        $parsed = json_decode($model->response);
                        return $parsed === null ? $model->response : PaySystemsHelper::cleanExport($parsed, true);
                    } else {
                        return str_replace(['Array', "\n", "\r", '(', ')'], '', print_r(json_decode($model->response, true), true));
                    }
                }
            ],
        ],
    ]);
} catch (Exception $e) {
    echo $e->getMessage();
} ?>

<?php \yii\widgets\Pjax::end() ?>
