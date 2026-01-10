<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;
use app\modules\BotManager\models\FileGroups;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\FileGroupsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('BotManager', 'Extensions & BKs & Software');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="file-groups-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-6">
            <?= Html::a(Yii::t('BotManager', 'Create Extension or BK or Software'), ['create'], ['class' => 'btn btn-success']) ?>
        </div>
        <div class="col-md-6" style="text-align: right;">
            <?= Html::a(Yii::t('BotManager', 'BK Settings'), ['settings'], ['class' => 'btn btn-danger']) ?>
        </div>
    </div>

    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?php try {
        echo GridView::widget([
            'dataProvider' => $dataProvider,
            'filterModel' => $searchModel,
            'columns' => [
                //['class' => 'yii\grid\SerialColumn'],

                //'id',
                [
                    'attribute' => 'typeText',
                    'filter' => FileGroups::$types
                ],
                [
                    'attribute' => 'name',
                    'format' => 'raw',
                    'value' => function ($model) {
                        return Html::a($model->name, ['file-groups/view', 'id' => $model->id]);
                    }
                ],
                [
                    'attribute' => 'bkInternalText',
                    'filter' => FileGroups::getBkInternals()
                ],
                //'bk_internal',
                'filesText:ntext',
                'comment:ntext',

                ['class' => 'yii\grid\ActionColumn', 'template' => '{update} {delete}'],
            ]
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>
    <?php Pjax::end(); ?>
</div>
