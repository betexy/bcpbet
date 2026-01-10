<?php

use yii\data\ActiveDataProvider;
use yii\helpers\Html;
use yii\helpers\Url;
use yii\widgets\DetailView;
use app\modules\BotManager\models\Bots;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Server */

$this->title = $model->name;
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => Yii::t('BotManager', 'Servers'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);

$this->registerJsFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'serverCommentHelper.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerCss('input.serverComment {background: transparent;}');
$this->registerJs('var urlToBotSave = "'.Url::toRoute(['bots/save-bot-comment']).'";', $this::POS_END);

?>
<div class="server-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('BotManager', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        <?= Html::a(Yii::t('BotManager', 'Delete'), ['delete', 'id' => $model->id], [
            'class' => 'btn btn-danger',
            'data' => [
                'confirm' => Yii::t('BotManager', 'Are you sure you want to delete this item?'),
                'method' => 'post',
            ],
        ]) ?>
    </p>

    <?php try {
        echo DetailView::widget([
            'model' => $model,
            'attributes' => [
                [
                    'attribute' => 'id',
                    'label' => 'ID, Created, Updated at',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return "<strong>{$m->id}</strong>  --- "
                            . Yii::$app->formatter->asDatetime($m->created_at) . ' --- '
                            . Yii::$app->formatter->asDatetime($m->updated_at);
                    }
                ],
                'name',
                'ip',
                'resource',
                'comment:ntext',
            ],
        ]);
    } catch (Exception $exception) {
        echo $exception->getMessage();
    } ?>

    <br/>

    <?= $this->render('_bots', [
        'model' => $model,
        'noSummary' => false,
        'unassigned' => false,
        'showHeader' => true,
        'onlyActive' => true
    ]) ?>

    <strong style="color: red;">Please note: table above shows only active bots, assigned to server!</strong>

</div>
