<?php

use app\modules\BotManager\models\FillingOptions;
use yii\helpers\Html;
use yii\grid\GridView;
use yii\helpers\Url;
use yii\widgets\ActiveForm;
use yii\widgets\Pjax;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\FillingOptionsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('BotManager', 'Filling Options');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;

?>
<div class="filling-options-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <div class="row">
        <div class="col-md-3">
            <?= Html::a(Yii::t('BotManager', 'Create Filling Options'), ['create'], ['class' => 'btn btn-success']) ?>
        </div>
        <div class="col-md-1">
            &nbsp;
        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('BotManager', 'Supported countries'), ['countries'], [ 'target' => '_blank']) ?>
        </div>
        <div class="col-md-7">
            <div class="row">
                <form class="form-inline" method="post" enctype="multipart/form-data"
                      action="<?= Url::to('/BotManager/filling-options/import') ?>">
                    <?= Html::hiddenInput(Yii::$app->request->csrfParam, Yii::$app->request->csrfToken); ?>
                    <div class="col-md-3">
                        <?= Html::dropDownList('fillingOption', null, FillingOptions::getOptions(), ['class' => 'form-control']) ?>
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
            //['class' => 'yii\grid\SerialColumn'],

            // 'id',
            [
                'attribute' => 'name',
                'format' => 'raw',
                'filter' => FillingOptions::getOptions(),
                'value' => function ($model) {
                    return Html::a(
                        Yii::t('BotManager', $model->name, [], 'ru'),
                        ['filling-options/view', 'id' => $model->id]);
                }
            ],
            [
                'attribute' => 'value',
                'format' => 'raw',
                'value' => function ($model) {
                    return Html::a($model->value, ['filling-options/view', 'id' => $model->id]);
                }
            ],
            'comment:ntext',
            'created_at:datetime',
            //'updated_at',

            ['class' => 'yii\grid\ActionColumn', 'template' => '{update} {delete}'],
        ],
    ]); ?>

    <?php Pjax::end(); ?>

</div>
