<?php

use yii\helpers\Html;


/* @var $this yii\web\View */
/* @var $model app\modules\Accounts\models\Account */

$this->title = Yii::t('Emails', 'Create Account');
$this->params['breadcrumbs'][] = ['label' => Yii::t('Emails', 'Accounts'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="account-create">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= $this->render('_form', [
        'model' => $model,
    ]) ?>

</div>
