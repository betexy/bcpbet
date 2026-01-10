<?php

namespace app\modules\BotManager\controllers;

use app\modules\BotManager\models\Bots;
use app\modules\BotManager\models\Server;
use Yii;
use app\modules\BotManager\models\ServerIp;
use app\modules\BotManager\models\ServerIpSearch;
use yii\helpers\VarDumper;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;
use yii\web\Response;

/**
 * ServerIpController implements the CRUD actions for ServerIp model.
 */
class ServerIpController extends Controller
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
                    'delete' => ['POST'],
                    'unlink' => ['POST'],
                    'addNew' => ['POST'],
                ],
            ],
        ];
    }

    /**
     * Lists all ServerIp models.
     * @return mixed
     */
    public function actionIndex()
    {
        Yii::$app->log->targets['debug'] = null;
        $searchModel = new ServerIpSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);
        $dataProvider->pagination = ['pageSize' => 100];

        $this->layout = 'ajax';

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    public function actionAddNew()
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $ip = Yii::$app->request->post('ip', false);
        $bm_server_id = Yii::$app->request->post('bm_server_id', false);
        if (empty($ip) || empty($bm_server_id)) {
            return ['status' => 'error', 'message' => 'Bad data!'];
        }
        $server = Server::findOne(['id' => $bm_server_id]);
        if (!$server) {
            return ['status' => 'error', 'message' => "Server {$bm_server_id} not found!"];
        }
        $model = ServerIp::findOne(['ip' => $ip]);
        if (!$model) {
            $model = new ServerIp();
            $model->ip = $ip;
        }
        $model->bm_server_id = $bm_server_id;
        if ($model->save()) {
            return ['status' => 'success'];
        } else {
            return ['status' => 'error', 'message' => VarDumper::dumpAsString($model->errors)];
        }
    }

    /**
     * Displays a single ServerIp model.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionView($id)
    {
        return $this->render('view', [
            'model' => $this->findModel($id),
        ]);
    }

    /**
     * Creates a new ServerIp model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new ServerIp();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    /**
     * Updates an existing ServerIp model.
     * If update is successful, the browser will be redirected to the 'view' page.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionUpdate($id)
    {
        $model = $this->findModel($id);

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('update', [
            'model' => $model,
        ]);
    }

    /**
     * Deletes an existing ServerIp model.
     * If deletion is successful, the browser will be redirected to the 'index' page.
     * @param $id
     * @return Response
     * @throws NotFoundHttpException
     * @throws \Throwable
     * @throws \yii\db\StaleObjectException
     */
    public function actionDelete($id)
    {
        $this->findModel($id)->delete();

        return $this->redirect(['index']);
    }

    /**
     * @param $id
     * @return Response
     * @throws NotFoundHttpException
     */
    public function actionUnlink($id)
    {
        $model = $this->findModel($id);
        $model->bm_server_id = null;
        $model->save();
        return $this->redirect(['index']);
    }

    /**
     * Finds the ServerIp model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return ServerIp the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = ServerIp::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('BotManager', 'The requested page does not exist.'));
    }
}
