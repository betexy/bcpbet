<?php

namespace app\modules\SimsManager\controllers;

use Yii;
use yii\filters\VerbFilter;
use yii\helpers\VarDumper;
use yii\web\Controller;
use yii\web\Response;
use app\modules\SimsManager\models\Actions;
use app\modules\SimsManager\models\Requests;

class ApiController extends Controller
{
    /**
     * {@inheritdoc}
     */
    public function behaviors()
    {
        return [
            'verbs' => [
                'class' => VerbFilter::class,
                'actions' => [
                    'index' => ['POST'],
                ],
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function beforeAction($action)
    {
        $this->enableCsrfValidation = false;
        try {
            return parent::beforeAction($action);
        } catch (\Exception $e) {
            echo $e->getMessage();
            return false;
        }
    }


    /**
     * @return array|false|string|string[]
     * @throws \yii\web\NotFoundHttpException
     */
    public function actionIndex()
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $post = Yii::$app->request->post();
        $data = Actions::checkRequestData(Yii::$app->request->post());
        if (!is_array($data)) {
            return json_encode(['status' => 'error', 'message' => $data]);
        }
        $request = new Requests();
        $request->command = $post['action'];
        $request->websocket_uid = $data['websocket_uid'];
        $request->bm_bots_id = $data['bm_bots_id'];
        $request->request = $post['data'];
        if (!$request->save()) {
            $response = ['status' => 'error', 'message' => "Save errors: " . VarDumper::dumpAsString($request->errors)];
        } else {
            $result = Actions::proceedAction($request, $data);
            $request->response = json_encode($result);
            $request->save();
            $response = $result;
        }

        return $response;
    }

}
