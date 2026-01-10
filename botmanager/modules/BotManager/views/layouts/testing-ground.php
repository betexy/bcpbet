<?php

/* @var $this View */

/* @var $content string */

use yii\helpers\Html;
use yii\helpers\Url;
use yii\web\View;

$this->registerJsFile(Url::toRoute(['files/internal-js', 'name' => 'jquery-3-3-1.min.js']), ['position' => View::POS_HEAD]);
$this->registerJsFile(Url::toRoute(['files/internal-js', 'name' => 'bootstrap-4-1-1.min.js']), ['position' => View::POS_HEAD]);
$this->registerCssFile(Url::toRoute(['files/internal-js', 'name' => 'bootstrap-4-1-1.min.css']), ['position' => View::POS_HEAD]);
$this->registerJsFile(Url::toRoute(['files/internal-js', 'name' => 'js.cookie.min.js']), ['position' => View::POS_HEAD]);
$this->registerCssFile(Url::toRoute(['files/internal-js', 'name' => 'bootstrap-table.min.css']), ['position' => View::POS_HEAD]);
$this->registerJsFile(Url::toRoute(['files/internal-js', 'name' => 'bootstrap-table.min.js']), ['position' => View::POS_HEAD]);
?>
<?php $this->beginPage() ?>
<!DOCTYPE html>
<html lang="<?= Yii::$app->language ?>">
<head>
    <meta charset="<?= Yii::$app->charset ?>">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= Html::encode($this->title) ?></title>
    <?php $this->head() ?>
</head>
<body>
<?php $this->beginBody() ?>

<?= $content ?>

<?php $this->endBody() ?>
</body>
</html>
<?php $this->endPage() ?>
