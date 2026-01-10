<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;
use yii\helpers\ArrayHelper;
use app\modules\PaySystems\models\History;
use app\modules\PaySystems\models\Paysystems;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\PaySystems\models\HistorySearch */
/* @var $dataProvider yii\data\ActiveDataProvider */
/* @var $type integer - view type */

$this->title = Yii::t('PaySystems', 'Transactions History');
$this->params['breadcrumbs'][] = ['label' => 'Pay systems', 'url' => ['/pay-systems']];
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
            location.href = '" . \yii\helpers\Url::to(['history/view']) . "?id=' + id;
    });
", $this::POS_READY);

?>
<div class="history-index">

    <h1><?= Html::encode($this->title) ?></h1>
    <?php Pjax::begin(); ?>

    <?php $columns = [
        [
            'attribute' => 'ps_paysystems_id',
            'filter' => ArrayHelper::map(Paysystems::find()->orderBy(['id' => 'ASC'])->all(), 'id', 'shortTitle'),
            'format' => 'raw',
            'value' => function ($m) {
                return Html::a($m->paysystems->shortTitle, ['paysystems/view', 'id' => $m->ps_paysystems_id, 'data-pjax' => '0',]);
            }
        ],
        'datetime:datetime',
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
                return '<strong style="color: ' . ($m->type === 1 ? 'darkred' : 'green') . ';">'
                    . $m->printAmount
                    . '</strong> ' . History::$currencies[$m->currency];
            }
        ],
        //'sender',
        //'receiver',
        'description:ntext',
        'comment:ntext',
    ];
    if (Yii::$app->controller->action->actionMethod === 'actionSpecialIndex') {
        $columns[3]['footer'] = Yii::$app->formatter->asCurrency($dataProvider->query->sum('amount'), $type < 2 ? 'RUB' : 'EUR');
    }
    ?>

    <?= GridView::widget([
        'showFooter' => Yii::$app->controller->action->actionMethod === 'actionSpecialIndex',
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'rowOptions' => function ($model) {
            return ['data-id' => $model->id];
        },
        'columns' => $columns
    ]); ?>
    <?php Pjax::end(); ?>
</div>
