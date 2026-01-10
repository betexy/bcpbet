<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\SimsManager\models\SimsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('SimsManager', 'SIM Cards');
$this->params['breadcrumbs'][] = ['label' => 'SIM manager', 'url' => ['/sims-manager']];
$this->params['breadcrumbs'][] = $this->title;

$this->registerJs('function importSims() {
    if (confirm("Do you really sure and realize that this operation will remove all existing relations between Sims and Slots?")) {
        $("#importSimsButton").hide();
        $("#uploadCsvForm").show();
    }
}', $this::POS_END);

?>
<div class="sims-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-2">
            <?= Html::a(Yii::t('SimsManager', 'Create SIM card'), ['create'], ['class' => 'btn btn-success']) ?>
        </div>
        <div class="col-md-8 form-inline">
            <div class="row" id="uploadCsvForm" style="display: none;">
                <?= Html::beginForm(['import'], 'POST', ['enctype' => 'multipart/form-data']) ?>
                <div class="col-md-7">
                    <?= Html::fileInput('csv_file', null, ['accept' => '.csv']) ?>
                </div>
                <div class="col-md-2">
                    <?= Html::submitButton('Import', ['class' => 'btn btn-danger']) ?>
                </div>
                <div class="col-md-2">
                    <?= Html::button('Cancel', ['class' => 'btn btn-success',
                        'onclick' => '$("#uploadCsvForm").hide(); $("#importSimsButton").show();']) ?>
                </div>
                <?= Html::endForm() ?>
            </div>
        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('SimsManager', 'Import'), ['import'],
                ['class' => 'btn btn-danger', 'id' => 'importSimsButton', 'onclick' => 'importSims(); return false;']) ?>
        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('SimsManager', 'Export'), ['export'], ['class' => 'btn btn-info']) ?>
        </div>
    </div>

    <?php Pjax::begin(); ?>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
            //['class' => 'yii\grid\SerialColumn'],

            //'id',
            'number',
            [
                'attribute' => 'slot',
                'value' => 'slot.slot_id',
            ],
            'comment:ntext',

            [
                'class' => 'yii\grid\ActionColumn',
                'buttons' => [
                    'delete' => function ($url, $model) {
                        return Html::a('<span class="glyphicon glyphicon-trash"></span>', ['delete', 'id' => $model->id], [
                            'class' => '',
                            'data' => [
                                'confirm' => 'Are you absolutely sure ? You will lose all SMSes, etc.',
                                'method' => 'post',
                            ],
                        ]);
                    }
                ]
            ],
        ],
    ]); ?>
    <?php Pjax::end(); ?>
</div>
