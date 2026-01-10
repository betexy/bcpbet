<?php

/* @var $this \yii\web\View */

/* @var $content string */

use app\widgets\Alert;
use yii\helpers\Html;
use yii\bootstrap\Nav;
use yii\bootstrap\NavBar;
use yii\widgets\Breadcrumbs;
use app\assets\AppAsset;

AppAsset::register($this);
?>
<?php $this->beginPage() ?>
<!DOCTYPE html>
<html lang="<?= Yii::$app->language ?>">
<head>
    <meta charset="<?= Yii::$app->charset ?>">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php $this->registerCsrfMetaTags() ?>
    <title><?= Html::encode($this->title) ?></title>
    <?php $this->head() ?>
    <link rel="shortcut icon" href="<?php echo Yii::$app->request->baseUrl; ?>/favicon<?= YII_DEBUG ? "-l" : "-w"?>.ico" type="image/x-icon" />
</head>
<body>
<?php $this->beginBody() ?>

<div class="wrap">
    <?php
    NavBar::begin([
        'brandLabel' => Yii::$app->name,
        'brandUrl' => Yii::$app->homeUrl,
        'options' => [
            'class' => 'navbar-inverse navbar-fixed-top',
        ],
    ]);
    echo Nav::widget([
        'options' => ['class' => 'navbar-nav navbar-right'],
        'items' => [
            ['label' => 'Home', 'url' => ['/site/index']],
            ['label' => 'Bot manager', 'url' => ['/BotManager'], 'active' =>
                strpos(Yii::$app->request->url, 'BotManager') !== false &&
                strpos(Yii::$app->request->url, 'report') === false
            ],
            ['label' => 'Reports', 'url' => ['/BotManager/report'], 'active' => strpos(Yii::$app->request->url, 'report')],
            ['label' => 'SIM', 'url' => ['/sims-manager'], 'active' => strpos(Yii::$app->request->url, 'sims-manager')],
            [
                'label' => 'PS',
                'items' => [
                    [
                        'label' => 'Blocked codes', 'url' => ['/BotManager/ps-codes'], 'active' => strpos(Yii::$app->request->url, '/ps-codes')
                    ],
                    [
                        'label' => 'Paysystems', 'url' => ['/pay-systems/paysystems'], 'active' => strpos(Yii::$app->request->url, '/paysystems')
                    ],
                    [
                        'label' => 'Transactions', 'url' => ['/pay-systems/history'], 'active' => strpos(Yii::$app->request->url, '/history')
                    ],
                    [
                        'label' => 'All', 'url' => ['/pay-systems'], 'active' => strpos(Yii::$app->request->url, 'pay-systems')
                    ],
                ]
            ],
            ['label' => 'Emails', 'url' => ['/emails'], 'active' => strpos(Yii::$app->request->url, 'emails')],
            [
                'label' => 'TG',
                'items' => [
                    [
                        'label' => 'b1', 'url' => ['/BotManager/default/testing-ground?id=b1'],
                    ],
                    [
                        'label' => 'b2', 'url' => ['/BotManager/default/testing-ground?id=b2'],
                    ],
                    [
                        'label' => 'b3', 'url' => ['/BotManager/default/testing-ground?id=b3'],
                    ],
                    [
                        'label' => 'b4', 'url' => ['/BotManager/default/testing-ground?id=b4'],
                    ],
                    [
                        'label' => 'b5', 'url' => ['/BotManager/default/testing-ground?id=b5'],
                    ],
                ],
            ],
            ['label' => 'Gii', 'url' => ['/gii'], 'visible' => YII_ENV_DEV],
            Yii::$app->user->isGuest ? (
            ['label' => 'Login', 'url' => ['/site/login']]
            ) : (
                '<li>'
                . Html::beginForm(['/site/logout'], 'post')
                . Html::submitButton(
                    'Logout (' . Yii::$app->user->identity->username . ')',
                    ['class' => 'btn btn-link logout']
                )
                . Html::endForm()
                . '</li>'
            )
        ],
    ]);
    NavBar::end();
    ?>

    <div class="container">
        <?= Breadcrumbs::widget([
            'links' => isset($this->params['breadcrumbs']) ? $this->params['breadcrumbs'] : [],
        ]) ?>
        <?= Alert::widget() ?>
        <?= $content ?>
    </div>
</div>

<footer class="footer">
    <div class="container">
        <p class="pull-left">&copy; My Company <?= date('Y') ?></p>

        <p class="pull-right"><?= Yii::powered() ?></p>
    </div>
</footer>

<?php $this->endBody() ?>
</body>
</html>
<?php $this->endPage() ?>
