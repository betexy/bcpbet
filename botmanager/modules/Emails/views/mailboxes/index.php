<?php

use app\modules\Emails\models\Mailboxes;
use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;
use yii\helpers\Url;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\Emails\models\MailboxesSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('Emails', 'Mailboxes');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="mailboxes-index">

    <h1><?= Html::encode($this->title) ?></h1>
    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-1">
            <?= Html::a(Yii::t('Emails', 'Check all'), ['mailboxes/check-all'], ['class' => 'btn btn-info']) ?>
        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('Emails', 'Analyze all'), ['mailboxes/analyze', 'id' => 'all'], ['class' => 'btn btn-warning']) ?>
        </div>
        <div class="col-md-1"></div>
        <div class="col-md-2">
            <?= Html::a(Yii::t('Emails', 'Create Mailboxes'), ['create'], ['class' => 'btn btn-success']) ?>
        </div>
        <div class="col-md-1"></div>
        <div class="col-md-6">
            <div class="row">
                <form class="form-inline" method="post" enctype="multipart/form-data"
                      action="<?= Url::to('/emails/mailboxes/import') ?>">
                    <?= Html::hiddenInput(Yii::$app->request->csrfParam, Yii::$app->request->csrfToken); ?>
                    <div class="col-md-3">
                        <?= Html::dropDownList('type', null, Mailboxes::$types, ['class' => 'form-control']) ?>
                    </div>
                    <div class="col-md-7">
                        <?= Html::fileInput('file_import', null,
                            ['accept' => '.txt', 'class' => 'form-control']) ?>
                    </div>
                    <div class="col-md-2">
                        <?= Html::submitButton(Yii::t('BotManager', 'Import'), ['class' => 'btn btn-success']) ?>
                    </div>
                </form>
            </div>
        </div>

    </div>
    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
            [
                'attribute' => 'checked_at',
                'filter' => false,
                'format' => 'raw',
                'value' => function ($m) {
                    return empty($m->checked_at) ? '<span style="color: red;">Not checked</span>' : Yii::$app->formatter->asDatetime($m->checked_at);
                }
            ],
            [
                'attribute' => 'wallet.id',
                'label' => 'Wallet',
            ],
            [
                'attribute' => 'account.name',
                'label' => 'Stake account',
            ],
            'mail_count',
            [
                'attribute' => 'type',
                'value' => function ($m) {
                    return Mailboxes::$types[$m->type];
                },
                'filter' => Mailboxes::$types
            ],
            [
                'attribute' => 'do_not_use',
                'format' => 'boolean',
                'label' => 'No stake?',
            ],
            [
                'attribute' => 'address',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::a($m->address, ['mailboxes/view', 'id' => $m->id]);
                }
            ],
            'comment:ntext',
        ],
    ]); ?>
    <?php Pjax::end(); ?>
</div>
