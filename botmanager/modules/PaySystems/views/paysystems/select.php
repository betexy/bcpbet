<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\PaySystems\models\PaysystemsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->registerJs('function SelectAllWeNeed() {
    let selected = [];
    $(\'input[data-rsid="rsid"]:checked\').each(function() {
        selected.push($(this).val());
    });  
    if (selected.length === 0) {
        alert("You would select some :)");
    } else {
        parent.AddRelationCallback(selected);
        parent.$.colorbox.close();
    }    
}', $this::POS_END);

?>

<?= Html::button('Select', ['class' => 'btn btn-info', 'onclick' => 'SelectAllWeNeed(); return false;']) ?>

<?php Pjax::begin(['id' => 'selectRelation']); ?>
<?php // echo $this->render('_search', ['model' => $searchModel]); ?>

<?= GridView::widget([
    'dataProvider' => $dataProvider,
    'filterModel' => $searchModel,
    'columns' => [
        [
            'attribute' => 'id',
            'format' => 'raw',
            'filter' => false,
            'label' => '',
            'value' => function($m) {
                return Html::checkbox('rSelectionId[]', false, ['value' => $m->id, 'data-rsid' => 'rsid']);
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
        //'password',
        //'pin',
        'balance',
        'checked_at',
        'comment:ntext',
    ],
]); ?>
<?php Pjax::end(); ?>

<?= Html::button('Select', ['class' => 'btn btn-info', 'onclick' => 'SelectAllWeNeed(); return false;']) ?>
