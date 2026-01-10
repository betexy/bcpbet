<?php

use yii\helpers\Url;
use yii\helpers\Html;
use app\modules\PaySystems\models\History;
use app\modules\PaySystems\models\Paysystems;

/* @var $this yii\web\View */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('PaySystems', 'PaySystems - Main Page');
$this->params['breadcrumbs'][] = ['label' => 'Pay systems', 'url' => ['/pay-systems']];
$this->params['breadcrumbs'][] = $this->title;

/*
echo History::find()->where(['and',
    ['type' => 0],
    ["NOT REGEXP","description", '.*\\+7[0-9]{10}.*'],
    ['in', 'ps_paysystems_id', Paysystems::find()->select('id')->where(['type' => 1])]])
    ->createCommand()->getRawSql();
*/

$inQiwi = History::find()->where(['and',
    ['type' => 0],
    ["NOT REGEXP", "description", '.*\\+7[0-9]{10}.*'],
    ['in', 'ps_paysystems_id', Paysystems::find()->select('id')->where(['type' => 1])]])
    ->sum('amount');

$outQiwi = History::find()->where(['and',
    ['type' => 1],
    ["NOT REGEXP", "description", '.*\\+7[0-9]{10}.*'],
    ['in', 'ps_paysystems_id', Paysystems::find()->select('id')->where(['type' => 1])]])
    ->sum('amount');

$inSkrill = History::find()->where(['and',
    ['type' => 0],
   // ["NOT REGEXP", "description", '.*\\+7[0-9]{10}.*'],
    ['in', 'ps_paysystems_id', Paysystems::find()->select('id')->where(['type' => 2])]])
    ->sum('amount');

$outSkrill = History::find()->where(['and',
    ['type' => 1],
    //["NOT REGEXP", "description", '.*\\+7[0-9]{10}.*'],
    ['in', 'ps_paysystems_id', Paysystems::find()->select('id')->where(['type' => 2])]])
    ->sum('amount');

$this->registerCss('div.row.totals div.col-md-4 { font-size: 20px; font-weight: bold; }')

?>

<div class="row">
    <div class="col-md-4">
        <a class="btn btn-success" href="<?= Url::toRoute(['/pay-systems/paysystems']) ?>">Pay Systems</a>
        <a class="btn btn-success" href="<?= Url::toRoute(['/pay-systems/history']) ?>">Transactions History</a>
    </div>
</div>

<div class="jumbotron">
    <h2>QIWI in/out report for all data:</h2>
    <div class="row">
        <div class="col-md-4">
            <?= Html::a('Total IN:', ['history/special-index', 'type' => 0]) ?>
        </div>
        <div class="col-md-4">
            <?= Html::a('Total OUT:', ['history/special-index', 'type' => 1]) ?>
        </div>
        <div class="col-md-4">
            IN - OUT:
        </div>
    </div>
    <div class="row totals">
        <?php try { ?>
            <div class="col-md-4">
                <?= Yii::$app->formatter->asCurrency($inQiwi, 'RUB') ?>
            </div>
            <div class="col-md-4">
                <?= Yii::$app->formatter->asCurrency($outQiwi, 'RUB') ?>
            </div>
            <div class="col-md-4">
                <?= Yii::$app->formatter->asCurrency($inQiwi - $outQiwi, 'RUB') ?>
            </div>
        <?php } catch (\yii\base\InvalidConfigException $e) {
            echo $e->getMessage();
        } ?>
    </div>
</div>

<div class="jumbotron">
    <h2>SKRILL in/out report for all data:</h2>
    <div class="row">
        <div class="col-md-4">
            <?= Html::a('Total IN:', ['history/special-index', 'type' => 2]) ?>
        </div>
        <div class="col-md-4">
            <?= Html::a('Total OUT:', ['history/special-index', 'type' => 3]) ?>
        </div>
        <div class="col-md-4">
            IN - OUT:
        </div>
    </div>
    <div class="row totals">
        <?php try { ?>
            <div class="col-md-4">
                <?= Yii::$app->formatter->asCurrency($inSkrill, 'EUR') ?>
            </div>
            <div class="col-md-4">
                <?= Yii::$app->formatter->asCurrency($outSkrill, 'EUR') ?>
            </div>
            <div class="col-md-4">
                <?= Yii::$app->formatter->asCurrency($inSkrill - $outSkrill, 'EUR') ?>
            </div>
        <?php } catch (\yii\base\InvalidConfigException $e) {
            echo $e->getMessage();
        } ?>
    </div>
</div>
