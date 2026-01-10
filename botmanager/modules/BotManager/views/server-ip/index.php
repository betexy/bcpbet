<?php

use app\modules\BotManager\models\Server;
use yii\helpers\ArrayHelper;
use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\ServerIpSearch */
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

$this->title = Yii::t('BotManager', 'Server Ips');

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
                'value' => function ($m) {
                    return Html::checkbox('rSelectionId[]', false, ['value' => $m->id, 'data-rsid' => 'rsid']);
                }
            ],
            //'updated_at:datetime',
            [
                'attribute' => 'ip',
                'format' => 'raw',
                'value' => function ($m) {
                    return "<strong>{$m->ip}</strong>";
                }
            ],
            [
                'attribute' => 'bm_server_id',
                'filter' => ArrayHelper::merge(['-1' => 'Not set'], ArrayHelper::map(Server::find()->orderBy(['name' => 'ASC'])->all(), 'id', 'name')),
                'label' => 'Server',
                'value' => function ($m) {
                    return empty($m->server) ? null : $m->server->name;
                }
            ],
            [
                'attribute' => 'server.name',
                'label' => 'Unlink',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::a('Unlink from server', ['server-ip/unlink', 'id' => $m->id],
                        ['data-method' => 'post', 'data-pjax' => '0', 'data-confirm' => 'Are you sure?']);
                }
            ],
            ['class' => 'yii\grid\ActionColumn', 'template' => '{delete}'],
        ],
    ]);
} catch (Exception $e) {
    echo $e->getMessage();
} ?>

<?php Pjax::end(); ?>

<?= Html::button('Select', ['class' => 'btn btn-info', 'onclick' => 'SelectAllWeNeed(); return false;']) ?>

