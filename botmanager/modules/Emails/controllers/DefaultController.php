<?php

namespace app\modules\Emails\controllers;

use app\controllers\BaseController;
use Yii;
use app\modules\Emails\models\MailsettingsForm;
use yii\filters\AccessControl;
use yii\web\Controller;

/**
 * Default controller for the `emails` module
 */
class DefaultController extends BaseController
{

    /**
     * @inheritdoc
     */
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

    public function actionMailSettings()
    {
        $model = new MailsettingsForm();
        if (Yii::$app->request->isPost && $model->load(Yii::$app->request->post()) && $model->save()) {
            Yii::$app->session->setFlash('success', 'Settings were saved!');
            return $this->redirect('index');
        } else {
            if (!Yii::$app->request->isPost) {
                $model->loadData();
            }
            return $this->render('mailsettings', [
                'model' => $model,
            ]);
        }
    }
}
