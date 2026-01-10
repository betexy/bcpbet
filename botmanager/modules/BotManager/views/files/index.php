<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;
use yii\helpers\ArrayHelper;

use app\modules\BotManager\models\Files;
/* @var $this yii\web\View */
/* @var $searchModel app\modules\BotManager\models\FilesSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('BotManager', 'Files');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="files-index">

    <h1><?= Html::encode($this->title) ?></h1>
    <?php if( Yii::$app->session->hasFlash('errorFlashMessage') ): ?>
        <div class="alert alert-danger alert-dismissible" role="alert">
            <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
            <?php echo Yii::$app->session->getFlash('errorFlashMessage'); ?>
        </div>
    <?php endif;?>
    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <p>
        <?= Html::a(Yii::t('BotManager', 'Create Files'), ['create'], ['class' => 'btn btn-success']) ?>
    </p>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
            //['class' => 'yii\grid\SerialColumn'],

            [
                'attribute' => 'created_at',
                'value' => function($model) {
                    return Yii::$app->formatter->asDate($model->created_at);
                },
                'contentOptions' => ['style' => 'width: 50px;']
            ],
            [
                'attribute' => 'updated_at',
                'value' => function($model) {
                    return Yii::$app->formatter->asDate($model->updated_at);
                },
                'contentOptions' => ['style' => 'width: 50px;']
            ],
            [
                'attribute' => 'name',
                'format' => 'html',
                'value' => function($model) {
                    return Html::a($model->name, ['files/view', 'id' => $model->id]);
                }
            ],
            [
                'attribute' => 'tag',
                'filter' => ArrayHelper::map(Files::find()->select('tag')->distinct()->all(), 'tag', 'tag')
            ],
            'source_path',
            'source_name',
            'comment:ntext',

            ['class' => 'yii\grid\ActionColumn', 'template' => '{update} {delete}'],
        ],
    ]); ?>
    <?php Pjax::end(); ?>
</div>
