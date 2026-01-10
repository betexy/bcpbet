<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\Accounts\models\Account */

$this->title = "{$model->first_name} {$model->second_name} {$model->third_name}";
$this->params['breadcrumbs'][] = ['label' => Yii::t('Emails', 'Accounts'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="account-view">

    <h1><?= Html::encode($this->title) ?></h1>

    <p>
        <?= Html::a(Yii::t('Emails', 'Update'), ['update', 'id' => $model->id], ['class' => 'btn btn-primary']) ?>
        <?= Html::a(Yii::t('Emails', 'Delete'), ['delete', 'id' => $model->id], [
            'class' => 'btn btn-danger',
            'data' => [
                'confirm' => Yii::t('Emails', 'Are you sure you want to delete this item?'),
                'method' => 'post',
            ],
        ]) ?>
    </p>

    <?= DetailView::widget([
        'model' => $model,
        'attributes' => [
            'id',
            'created_at:datetime',
            'first_name',
            'second_name',
            'third_name',
            'birth_date',
            'email:email',
            'email_password:email',
            'phone',
            'has_passport:boolean',
            'has_registration:boolean',
            'has_selfie:boolean',
            'has_driver_license:boolean',
            'has_address_verification:boolean',
            'has_skrill_verification:boolean',
            'has_qiwi_verification:boolean',
            'city',
            'postal_code',
            'address',
            'skrill_login',
            'skrill_password',
            'qiwi_login',
            'qiwi_password',
            'first_name_en',
            'second_name_en',
            'city_en',
            'address_en',
            'comment:ntext',
        ],
    ]) ?>

</div>
