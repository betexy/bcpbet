<?php

namespace app\modules\SimsManager\controllers;

use app\controllers\BaseController;
use app\modules\SimsManager\models\Actions;
use app\modules\SimsManager\models\Requests;
use Yii;
use yii\filters\AccessControl;
use yii\filters\VerbFilter;
use yii\web\Controller;
use app\modules\SimsManager\helpers\SimsHelper;
use app\modules\SimsManager\models\Channels;
use app\modules\SimsManager\models\Slots;
use yii\web\Response;

/**
 * Default controller for the `sims-manager` module
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
            'verbs' => [
                'class' => VerbFilter::class,
                'actions' => [
                    'generate' => ['POST'],
                    'bind' => ['POST'],
                    'unbind' => ['POST'],
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

    public function actionGenerate()
    {
        $post = Yii::$app->request->post();
        $firstId = (int)$post['first_id'];
        for ($i = 0; $i < (int)$post['count']; $i++) {
            if ($post['type'] === 'channels') {
                $model = new Channels();
                $model->channel_id = $firstId + $i;
                $model->save();
            } elseif ($post['type'] === 'slots') {
                $model = new Slots();
                $model->slot_id = $firstId + $i;
                $model->save();
            }
        }
        return $this->redirect('/sims-manager');
    }

    /**
     * @return \yii\web\Response
     * @throws \yii\base\InvalidConfigException
     */
    public function actionBind()
    {
        $post = Yii::$app->request->post();
        if (!empty($post['bind_number']) && !empty($post['bind_channel'])) {
            $res = SimsHelper::bindSlotToChannel($post['bind_number'], $post['bind_channel']);
            if ($res === true) {
                SimsHelper::requestBound();
                Yii::$app->session->setFlash('success', "Bind request was sent. You have to refresh bound to check it is succeed. Note: it may takes some time.");
            } else {
                Yii::$app->session->setFlash('error', "Something went wrong: '{$res}'!");
            }
        } else {
            Yii::$app->session->setFlash('error', 'You have to select both number and channel!');
        }
        return $this->redirect('/sims-manager');
    }

    public function actionUnbind($request_id)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $request = new Requests();
        $request->command = 'BIND_RELEASE';
        return Actions::proceedAction($request, ['request_id' => $request_id]);
    }

}
