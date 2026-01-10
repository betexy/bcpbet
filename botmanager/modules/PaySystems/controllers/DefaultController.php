<?php

namespace app\modules\PaySystems\controllers;

use app\controllers\BaseController;
use yii\filters\AccessControl;
use yii\web\Controller;

/**
 * Default controller for the `pay-systems` module
 */
class DefaultController extends BaseController
{

    public function behaviors()
    {
        return [
            'access' => [
                'class' => AccessControl::class,
                'rules' => [
                    [
                        'allow' => true,
                        'roles' => ['@'],
                    ],
                ],
            ],
        ];
    }

    /**
     * Renders the index view for the module
     * @return string
     */
    public function actionIndex()
    {
        return $this->render('index');
    }
}
