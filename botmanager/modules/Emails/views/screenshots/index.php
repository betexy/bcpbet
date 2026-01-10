<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;
use yii\helpers\ArrayHelper;
use yii\helpers\Url;
use app\modules\Emails\models\Screenshots;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\Emails\models\ScreenshotsSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('Emails', 'Screenshots');
$this->params['breadcrumbs'][] = ['label' => 'Emails', 'url' => ['/emails']];
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
            location.href = '" . Url::to(['screenshots/view']) . "?id=' + id;
    });
", $this::POS_READY);

?>
<div class="screenshots-index">

    <h1><?= Html::encode($this->title) ?></h1>
    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <?php try {
        echo GridView::widget([
            'dataProvider' => $dataProvider,
            'filterModel' => $searchModel,
            'rowOptions' => function ($model) {
                return ['data-id' => $model->id];
            },
            'columns' => [
                'updated_at:datetime',
                'name',
                [
                    'attribute' => 'tag',
                    'filter' => ArrayHelper::map(Screenshots::find()->select('tag')->distinct()->orderBy(['tag' => 'ASC'])->all(), 'tag', 'tag'),
                ],
                //'description:ntext',
                'comment:ntext',
                //'image:ntext',

                ['class' => 'yii\grid\ActionColumn', 'template' => '{delete}'],
            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>
    <div class="row">
        <div class="col-md-12" style="text-align: right;">
            <?= Html::button('Delete all', ['class' => 'btn btn-danger',
                'onclick' => "if (confirm('Are you sure?')) $.post('" . Url::to(['screenshots/delete-all']) . "'); return false;"]); ?>
        </div>
    </div>
    <?php Pjax::end(); ?>
</div>
