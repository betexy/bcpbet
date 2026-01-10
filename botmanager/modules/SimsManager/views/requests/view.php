<?php

use yii\helpers\Html;
use yii\widgets\DetailView;
use app\modules\SimsManager\models\Requests;

/* @var $this yii\web\View */
/* @var $model Requests */

$this->title = \app\modules\SimsManager\models\Actions::$actions[$model->command] . ' for ' . $model->bots->virtual_machine_name;
$this->params['breadcrumbs'][] = ['label' => 'SIM manager', 'url' => ['/sims-manager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('SimsManager', 'Requests'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="requests-view">

    <h1><?= Html::encode($this->title) ?></h1>

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
                            . Yii::$app->formatter->asDatetime($m->created_at) . ' --- '
                            . Yii::$app->formatter->asDatetime($m->updated_at);
                    }
                ],
                [
                    'attribute' => 'websocket_uid',
                    'label' => 'UID, Name',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return "{$m->websocket_uid}, <strong>{$m->bots->virtual_machine_name}</strong>";
                    }
                ],
                [
                    'attribute' => 'command',
                    'format' => 'raw',
                    'value' => function ($model) {
                        return \app\modules\SimsManager\models\Actions::$actions[$model->command];
                    }
                ],
                [
                    'attribute' => 'request',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return str_replace(['stdClass#1'], '', \yii\helpers\VarDumper::dumpAsString(json_decode($m->request)));
                    }
                ],
                [
                    'attribute' => 'response',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return str_replace(['stdClass#1'], '', \yii\helpers\VarDumper::dumpAsString(json_decode($m->response)));
                    }
                ],
            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>

    <?php
    if (!empty($model->actions[0])) {
        echo "<h3>Action:</h3>";
        try {
            echo DetailView::widget([
                'model' => $model->actions[0],
                'attributes' => [
                    [
                        'attribute' => 'id',
                        'label' => 'ID, Created, Updated at',
                        'format' => 'raw',
                        'value' => function ($m) {
                            return "<strong>{$m->id}</strong>  --- "
                                . Yii::$app->formatter->asDatetime($m->created_at) . ' --- '
                                . Yii::$app->formatter->asDatetime($m->updated_at);
                        }
                    ],
                    [
                        'attribute' => 'active',
                        'label' => 'Active, In Queue, Finished',
                        'format' => 'raw',
                        'value' => function ($m) {
                            $active = !empty($m->active) ? 'Yes' : 'No';
                            $in_queue = !empty($m->in_queue) ? 'Yes' : 'No';
                            $finished = !empty($m->finished) ? 'Yes' : 'No';
                            return "Active: <strong>{$active}</strong>, In Queue: <strong>{$in_queue}</strong>, Finished: <strong>{$finished}</strong>";
                        }
                    ],
                    [
                        'attribute' => 'sims',
                        'label' => 'Phone >> Channel',
                        'format' => 'raw',
                        'value' => function ($m) {
                            return "{$m->sims->number}   >>   {$m->channels->channel_id}";
                        }
                    ],
                    [
                        'attribute' => 'bound_at',
                        'label' => 'Bound >> Released, spent',
                        'format' => 'raw',
                        'value' => function ($m) {
                            if (!empty($m->bound_at) && !empty($m->released_at)) {
                                $minutes = floor(($m->released_at - $m->bound_at) / 60);
                                $seconds = ($m->released_at - $m->bound_at) - $minutes * 60;
                                $spent = " , spent: <strong>{$minutes}:{$seconds}</strong>";
                            } else {
                                $spent = '';
                            }
                            return Yii::$app->formatter->asDatetime($m->bound_at) . '   >>   '
                                . Yii::$app->formatter->asDatetime($m->released_at) . $spent;
                        }
                    ],
                ],
            ]);
        } catch (Exception $e) {
            echo $e->getMessage();
        }
    } ?>

    <?php
    if (!empty($model->answers)) {
        echo "<h3>Answers:</h3>";
        ?>
        <?php \yii\widgets\Pjax::begin(['id' => 'rAnswers']); ?>
        <?php try {
            echo \yii\grid\GridView::widget([
                'dataProvider' => new \yii\data\ActiveDataProvider([
                    'query' => \app\modules\SimsManager\models\Answers::find()->where(['sims_requests_id' => $model->id]),
                    'pagination' => [
                        'pageSize' => 20,
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
                    ['attribute' => 'created_at', 'format' => 'datetime', 'enableSorting' => false,],
                    ['attribute' => 'updated_at', 'format' => 'datetime', 'enableSorting' => false,],
                    [
                        'attribute' => 'sent_at',
                        'format' => 'raw',
                        'enableSorting' => false,
                        'value' => function ($m) {
                            return empty($m->sent_at)
                                ? '<strong style="color: red;">NOT SEND!</strong>'
                                : Yii::$app->formatter->asDatetime($m->sent_at);
                        },
                    ],
                    [
                        'attribute' => 'command',
                        'enableSorting' => false,
                        'value' => function ($m) {
                            return \app\modules\SimsManager\models\Answers::$answers[$m->command];
                        }
                    ],
                    [
                        'attribute' => 'content',
                        'format' => 'raw',
                        'enableSorting' => false,
                        'value' => function ($m) {
                            return str_replace(['stdClass#1'], '', \yii\helpers\VarDumper::dumpAsString(json_decode($m->content)));
                        }
                    ],
                ],
            ]);
        } catch (Exception $e) {
            echo $e->getMessage();
        } ?>
        <?php \yii\widgets\Pjax::end(); ?>

        <?php
        $this->registerJs('
            var rAnswersInterval = setInterval(function() {
                $.pjax.reload({container: "#rAnswers"});
            }, 10000);
        ', $this::POS_END);
    } ?>

</div>
