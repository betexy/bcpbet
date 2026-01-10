<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;
use yii\helpers\ArrayHelper;
use app\modules\Accounts\models\Account;
use app\models\Bookmaker;

/* @var $this yii\web\View */
/* @var $searchModel app\modules\Accounts\models\AccountBookmakerSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('Emails', 'Account Bookmakers');
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="account-bookmaker-index">

    <h1><?= Html::encode($this->title) ?></h1>
    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <p>
        <?= Html::a(Yii::t('Emails', 'Create Account Bookmaker'), ['create'], ['class' => 'btn btn-success']) ?>
    </p>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
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

            ['class' => 'yii\grid\ActionColumn'],
        ],
    ]); ?>
    <?php Pjax::end(); ?>
</div>
