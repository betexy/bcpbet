<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\BotsSearch */
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
<?php try {
    echo GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'rowOptions' => function ($model) {
            if ($model->last_request < time() - 120) {
                return ['style' => 'background-color: #ffb3b3;'];
            } else {
                return ['style' => 'background-color: #ceff9e;'];
            }
        },
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
                'attribute' => 'server_name',
                'filter' => \yii\helpers\ArrayHelper::map(
                    \app\modules\BotManager\models\Bots::find()->select('server_name')->distinct()->orderBy('server_name')->all(),
                    'server_name', 'server_name')
            ],
            [
                'attribute' => 'virtual_machine_name',
                'label' => 'VM name',
                'format' => 'html',
                'value' => function ($model) {
                    $text = [$model->virtual_machine_name];
                    if (!empty($model->user_id)) {
                        $text[] = "({$model->user_id})";
                    }
                    if (!empty($model->server_name)) {
                        $text[] = "@ {$model->server_name}";
                    }
                    return implode(' ', $text);
                },
            ],
            'description:html',
        ],
    ]);
} catch (Exception $e) {
    echo $e->getMessage();
} ?>

<?php Pjax::end(); ?>

<?= Html::button('Select', ['class' => 'btn btn-info', 'onclick' => 'SelectAllWeNeed(); return false;']) ?>
