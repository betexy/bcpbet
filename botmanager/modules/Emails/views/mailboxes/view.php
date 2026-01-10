<?php

use app\modules\Emails\models\Mailboxes;
use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\Emails\models\Mailboxes */

$this->title = "{$model->address} ({$model::$types[$model->type]})";

$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('Emails', 'Mailboxes'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);

$this->registerCss('
    #emails_list tbody tr:hover td {
        color: #337ab7;
        cursor: pointer;
    }
');

$this->registerJs("    
    $('#emails_list').on('click', 'tbody td', function (e) {
        var id = $(this).closest('tr').data('id');
        if(e.target == this)
            location.href = '" . \yii\helpers\Url::to(['emails/view']) . "?id=' + id;
    });
", $this::POS_READY);

?>
<div class="mailboxes-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-2">
            <?= Html::a(Yii::t('Emails', 'Check mail'), ['check-mail', 'id' => $model->id], ['class' => 'btn btn-info']) ?>
        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('Emails', 'Analyze'), ['mailboxes/analyze', 'id' => $model->id], ['class' => 'btn btn-warning']) ?>
        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('Emails', 'Folders'), ['mailboxes/folders', 'id' => $model->id], ['class' => 'btn btn-info']) ?>
        </div>
        <div class="col-md-5">

        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('Emails', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('Emails', 'Delete'), ['delete', 'id' => $model->id], [
                'class' => 'btn btn-danger',
                'data' => [
                    'confirm' => Yii::t('Emails', 'Are you sure you want to delete this item?'),
                    'method' => 'post',
                ],
            ]) ?>
        </div>
    </div>

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
                    'attribute' => 'checked_at',
                    'label' => 'Checked at / Ready checked at',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return (empty($m->checked_at) ? '<span style="color: red;">Not checked</span>'
                                : Yii::$app->formatter->asDatetime($m->checked_at))
                            . ' / '
                            . (empty($m->ready_checked_at) ? '<span style="color: red;">Not checked</span>'
                                : Yii::$app->formatter->asDatetime($m->ready_checked_at));
                    }
                ],
                'mail_count',
                [
                    'attribute' => 'address',
                    'format' => 'raw',
                    'label' => 'Address (type)',
                    'value' => function ($m) {
                        return "<strong>{$m->address}</strong> ({$m::$types[$m->type]}){$wallet}";
                    }
                ],
                'do_not_use:boolean',
                [
                    'attribute' => 'address',
                    'format' => 'raw',
                    'label' => '[ Wallet UID ], [ Stake account ]',
                    'value' => function ($m) {
                        /**
                         * @var Mailboxes $m
                         */
                        $wallet = '<span style="color: red;">Not set</span>';
                        if (!empty($m->wallet)) {
                            $wallet = Html::a($m->wallet->uid, ['/pay-systems/wallets/view',
                                'id' => $m->wallet->id]);
                        }
                        $acc = '<span style="color: red;">Not set</span>';
                        if (!empty($m->account)) {
                            $acc = Html::a($m->account->name, ['/BotManager/stake/view',
                                'id' => $m->account->id]);
                        }
                        return "[ {$wallet} ], [ {$acc} ]";
                    }
                ],
                [
                    'attribute' => 'login',
                    'format' => 'raw',
                    'label' => 'Login / Password',
                    'value' => function ($m) {
                        return "{$m->login} / {$m->password}";
                    }
                ],
                [
                    'attribute' => 'folders',
                    'format' => 'ntext',
                    'label' => 'Folders',
                    'value' => function ($m) {
                        $f = $m->obtainFolders();
                        return empty($f) ? 'Not filled yet!' : implode(', ', $f);
                    }
                ],
                'comment:ntext',
            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>

    <?php \yii\widgets\Pjax::begin(['id' => 'emails_list']) ?>

    <?php try {
        echo \yii\grid\GridView::widget([
            'dataProvider' => new \yii\data\ActiveDataProvider([
                'query' => \app\modules\Emails\models\Emails::find()->where(['e_mailboxes_id' => $model->id]),
                'pagination' => [
                    'pageSize' => 20,
                ],
                'sort' => [
                    'defaultOrder' => [
                        'id' => SORT_DESC,
                    ]
                ],
            ]),
            'rowOptions' => function ($model) {
                return ['data-id' => $model->id];
            },
            'columns' => [
                [
                    'attribute' => 'imap_datetime',
                    'contentOptions' => ['style' => 'width: 100px;'],
                    'value' => function ($m) {
                        $dt = \DateTime::createFromFormat('Y-m-d H:i:s', $m->imap_datetime);
                        return empty($dt) ? '' : $dt->format('d.m H:i');
                    },
                    'filter' => false,
                ],
                'folder',
                'from_name',
                'from_address',
                'subject',
                [
                    'attribute' => 'comment',
                    'label' => 'Pattern',
                    'format' => 'raw',
                    'value' => function ($m) {
                        if (!empty($m->comment)) {
                            $p = json_decode($m->comment);
                            if (!empty($p)) {
                                return "{$p->pattern}";
                            } else {
                                return '<span style="color:red;">JSON error!</span>';
                            }
                        } else {
                            return null;
                        }
                    }
                ],
            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>

    <?php \yii\widgets\Pjax::end() ?>


</div>
