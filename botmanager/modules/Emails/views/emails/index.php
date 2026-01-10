<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;
use yii\helpers\ArrayHelper;
use app\modules\Emails\models\Mailboxes;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\Emails\models\EmailsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('Emails', 'Emails');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => 'Emails', 'url' => ['/emails']];
$this->params['breadcrumbs'][] = $this->title;

$this->registerCss('
    tbody tr:hover td {
        color: #337ab7;
        cursor: pointer;
    }
');

$this->registerJs("    
    $('body').on('click', 'tbody td', function (e) {
        var id = $(this).closest('tr').data('id');
        if(e.target == this)
            location.href = '" . \yii\helpers\Url::to(['emails/view']) . "?id=' + id;
    });
", $this::POS_READY);

?>
<div class="emails-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= Html::beginForm(['emails/bulk'], 'post'); ?>
    <div class="row" style="margin-bottom: 5px;">
        <div class="col-md-2">
            <?= Html::dropDownList('action', '', ['' => '', 'Delete' => 'Delete emails'], ['class' => 'form-control',]) ?>
        </div>
        <div class="col-md-2">
            <?= Html::submitButton('Bulk action', ['class' => 'btn btn-success', 'onclick' => 'if (!confirm("Are you sure?")) return false;']); ?>
        </div>
    </div>
    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?php try {
        echo GridView::widget([
            'dataProvider' => $dataProvider,
            'filterModel' => $searchModel,
            'rowOptions' => function ($model) {
                return ['data-id' => $model->id];
            },
            'columns' => [
                ['class' => 'yii\grid\CheckboxColumn'],
                [
                    'attribute' => 'address',
                    'filter' => ArrayHelper::map(Mailboxes::find()->orderBy(['address' => 'ASC'])->all(), 'id', 'address'),
                    'format' => 'raw',
                    'value' => function ($m) {
                        return Html::a($m->address, ['mailboxes/view', 'id' => $m->e_mailboxes_id, 'data-pjax' => '0',]);
                    }
                ],
                [
                    'attribute' => 'imap_datetime',
                    'contentOptions' => ['style' => 'width: 100px;'],
                    'value' => function ($m) {
                        $dt = \DateTime::createFromFormat('Y-m-d H:i:s', $m->imap_datetime);
                        return empty($dt) ? '' : $dt->format('d.m H:i');
                    },
                    'filter' => false,
                ],
                'from_name',
                'from_address',
                'to_string',
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
                                return '<span color="red">JSON error!</span>';
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
    <?php Pjax::end(); ?>
    <?= Html::endForm(); ?>
</div>
