<?php

use yii\helpers\Html;
use yii\grid\GridView;
use yii\widgets\Pjax;
/* @var $this yii\web\View */
/* @var $searchModel app\modules\Accounts\models\AccountSearch */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('Emails', 'Accounts');
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="account-index">

    <h1><?= Html::encode($this->title) ?></h1>
    <?php Pjax::begin(); ?>
    <?php // echo $this->render('_search', ['model' => $searchModel]); ?>

    <p>
        <?= Html::a(Yii::t('Emails', 'Create Account'), ['create'], ['class' => 'btn btn-success']) ?>
    </p>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'filterModel' => $searchModel,
        'columns' => [
            'id',
            'first_name',
            'second_name',
            'third_name',
            'birth_date',
            //'email:email',
            //'email_password:email',
            //'phone',
            //'comment:ntext',
            //'created_at',
            //'name',
            //'has_passport',
            //'has_registration',
            //'has_selfie',
            //'has_driver_license',
            //'has_address_verification',
            //'has_skrill_verification',
            //'has_qiwi_verification',
            //'city',
            //'postal_code',
            //'address',
            //'skrill_login',
            //'skrill_password',
            //'qiwi_login',
            //'qiwi_password',
            //'first_name_en',
            //'second_name_en',
            //'city_en',
            //'address_en',

            ['class' => 'yii\grid\ActionColumn'],
        ],
    ]); ?>
    <?php Pjax::end(); ?>
</div>
