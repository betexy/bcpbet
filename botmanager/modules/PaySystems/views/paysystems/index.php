<?php

use app\modules\PaySystems\models\History;
use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\PaySystems\models\PaysystemsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

require_once __DIR__ . '/additions.php';

$this->title = Yii::t('PaySystems', 'Paysystems');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="paysystems-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?= Html::beginForm(['paysystems/bulk'], 'post'); ?>
    <div class="row" style="margin-bottom: 5px;">
        <div class="col-md-1">
            <?= Html::a(Yii::t('PaySystems', 'Create'), ['create'], ['class' => 'btn btn-success']) ?>
        </div>
        <div class="col-md-2"></div>
        <div class="col-md-2">
            <?= Html::dropDownList('action', '', ['' => '', 'DELETE' => 'Delete',
                'CHECK_BALANCE' => 'Check balance'], ['class' => 'form-control',]) ?>
        </div>
        <div class="col-md-2">
            <?= Html::submitButton('Bulk action', ['class' => 'btn btn-success',]); ?>
        </div>
    </div>

    <?php Pjax::begin(); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'rowOptions' => function ($model) {
            return $model->is_master ? ['style' => 'background-color: #ceff9e;'] : [];
        },
        'columns' => [
            //'created_at:datetime',
            ['class' => 'yii\grid\CheckboxColumn'],
            'id',
            [
                'attribute' => 'updated_at',
                'value' => function ($m) {
                    return Yii::$app->formatter->asRelativeTime($m->updated_at);
                }
            ],
            [
                'attribute' => 'type',
                'value' => function ($m) {
                    return \app\modules\BotManager\models\Bots::$paymentMethods[$m->type];
                },
                'filter' => \app\modules\BotManager\models\Bots::$paymentMethods,
            ],
            'login',
            //'is_master:boolean',
            /*
            [
                'attribute' => 'login',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::a($m->type !== 3 ? $m->login : (function ($m) {
                        $a = json_decode($m->additions);
                        return empty($a->email) ? '<strong style="color: red;">NOT SET !!!</strong>' : $a->email;
                    })($m), ['paysystems/view', 'id' => $m->id]);
                }
            ],
            */
            //'password',
            //'pin',
            /*
            [
                'attribute' => 'balance',
                'format' => 'raw',
                'contentOptions' => ['style' => 'text-align: right'],
                'value' => function ($m) {
                    return Yii::$app->formatter->asDecimal($m->balance, $m->type === 3 ? 5 : 2);
                }
            ],
            [
                'attribute' => 'checked_at',
                'format' => 'raw',
                'contentOptions' => ['style' => 'text-align: right'],
                'value' => function ($m) {
                    return Yii::$app->formatter->asRelativeTime($m->checked_at);
                }
            ],
            [
                'attribute' => 'bots',
                'value' => function ($m) {
                    return implode(', ', \yii\helpers\ArrayHelper::map($m->bots, 'virtual_machine_name', 'virtual_machine_name'));
                }
            ],
            */
            [
                'attribute' => 'additions',
                'format' => 'raw',
                'value' => function ($m) {
                    return showAdditions($m, true);
                },
            ],
            'comment:ntext',
        ],
    ]); ?>
    <?php Pjax::end(); ?>
    <?= Html::endForm(); ?>
</div>
