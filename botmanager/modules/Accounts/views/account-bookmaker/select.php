<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;
use yii\helpers\ArrayHelper;
use app\modules\Accounts\models\Account;
use app\models\Bookmaker;

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
                'attribute' => 'account_id',
                'value' => function ($i) {
                    return "{$i->account->first_name} {$i->account->second_name} {$i->account->third_name}";
                },
                'filter' => ArrayHelper::map(Account::find()->all(), 'id', function ($i) {
                    return "{$i->first_name} {$i->second_name} {$i->third_name}";
                })
            ],
            [
                'attribute' => 'bookmaker_id',
                'value' => 'bookmaker.name',
                'filter' => ArrayHelper::map(Bookmaker::find()->all(), 'id', 'name')
            ],
            'bm_login',
            'bm_password',
            'comment:ntext',
        ],
    ]);
} catch (Exception $e) {
    echo $e->getMessage();
} ?>

<?php Pjax::end(); ?>

<?= Html::button('Select', ['class' => 'btn btn-info', 'onclick' => 'SelectAllWeNeed(); return false;']) ?>
