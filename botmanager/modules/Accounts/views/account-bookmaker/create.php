<?php

use yii\helpers\Html;


/* @var $this yii\web\View */
/* @var $model app\modules\Accounts\models\AccountBookmaker */

$this->title = Yii::t('Emails', 'Create Account Bookmaker');
$this->params['breadcrumbs'][] = ['label' => Yii::t('Emails', 'Account Bookmakers'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="account-bookmaker-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
