<?php

use \yii\helpers\Url;

$this->title = Yii::t('Emails', 'Emails - Main Page');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
//$this->params['breadcrumbs'][] = ['label' => 'Emails', 'url' => ['/emails']];
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

<div class="emails-default-index">
    <div class="row">
        <div class="col-md-1">
            <a class="btn btn-success" href="<?= Url::toRoute(['/emails/mailboxes']) ?>">Mailboxes</a>
        </div>
        <div class="col-md-1">
            <a class="btn btn-success" href="<?= Url::toRoute(['/emails/emails']) ?>">Emails</a>
        </div>
        <div class="col-md-1">
            <a class="btn btn-success" href="<?= Url::toRoute(['/emails/default/mail-settings']) ?>">Mail Settings</a>
        </div>
        <div class="col-md-1"></div>
        <div class="col-md-1">
            <a class="btn btn-success" href="<?= Url::toRoute(['/emails/screenshots']) ?>">Screenshots</a>
        </div>
    </div>
</div>

<h3>Last emails:</h3>

<?php \yii\widgets\Pjax::begin(['id' => 'emails_list']) ?>

<?php try {
    echo \yii\grid\GridView::widget([
        'dataProvider' => new \yii\data\ActiveDataProvider([
            'query' => \app\modules\Emails\models\Emails::find(),
            'pagination' => [
                'pageSize' => 20,
            ],
            'sort' => [
                'defaultOrder' => [
                    'imap_datetime' => SORT_DESC,
                ]
            ],
        ]),
        'rowOptions' => function ($model) {
            return ['data-id' => $model->id];
        },
        'columns' => [
            [
                'attribute' => 'address',
                'format' => 'raw',
                'value' => function ($m) {
                    return \yii\helpers\Html::a($m->address, ['mailboxes/view', 'id' => $m->e_mailboxes_id], ['data-pjax' => '0']);
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
            'subject',
            [
                'attribute' => 'comment',
                'label' => 'Pattern',
                'format' => 'raw',
                'value' => function($m) {
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

<?php \yii\widgets\Pjax::end() ?>
