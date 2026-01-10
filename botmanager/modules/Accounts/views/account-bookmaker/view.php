<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\Accounts\models\AccountBookmaker */

$this->title = $model->id;
$this->params['breadcrumbs'][] = ['label' => Yii::t('Emails', 'Account Bookmakers'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);
?>
<div class="account-bookmaker-view">

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
            [
                'attribute' => 'account_id',
                'value' => function ($i) {
                    return "{$i->account->first_name} {$i->account->second_name} {$i->account->third_name}";
                },
            ],
            'bookmaker.name',
            'bm_login',
            'bm_password',
            'comment:ntext',
        ],
    ]) ?>

</div>
