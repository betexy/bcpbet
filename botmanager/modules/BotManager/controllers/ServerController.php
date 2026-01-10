<?php

namespace app\modules\BotManager\controllers;

use app\modules\BotManager\Helpers\YCHelper;
use app\modules\BotManager\models\RdpActivity;
use app\modules\BotManager\models\RdpCommands;
use app\modules\BotManager\models\RdpTable;
use app\modules\BotManager\models\ServerIp;
use Yii;
use app\modules\BotManager\models\Server;
use app\modules\BotManager\models\ServerSearch;
use yii\base\BaseObject;
use yii\helpers\VarDumper;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;
use yii\web\Response;

/**
 * ServerController implements the CRUD actions for Server model.
 */
class ServerController extends Controller
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
                    'assign-ips' => ['POST'],
                ],
            ],
        ];
    }

    /**
     * Lists all Server models.
     * @return mixed
     */
    public function actionIndex()
    {
        $searchModel = new ServerSearch();
        $searchModel->deleted = 0;
        $searchModel->table_deleted = 0;
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);
        $dataProvider->sort->defaultOrder = ['last_activity' => SORT_DESC];
        $dataProvider->pagination = ['pageSize' => 150];

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    public function actionGuacamoleSync()
    {
        $command = new RdpCommands();
        $command->command = json_encode(['action' => 'rdp_scan']);
        if (!$command->save()) {
            Yii::$app->session->setFlash('error', VarDumper::dumpAsString($command->getErrorSummary(true)));
        } else {
            Yii::$app->session->setFlash('success', 'Sync command was set!');
        }
        return $this->redirect(['index']);
    }

    /**
     * @param $id
     * @param $deleted
     * @return Response
     * @throws NotFoundHttpException
     */
    public function actionSetDeleted($id, $deleted)
    {
        $model = $this->findActivity($id);
        $model->deleted = (int)$deleted;
        if (empty($deleted)) {
            $model->logins_failed = 0;
        }
        if (!$model->save()) {
            Yii::$app->session->setFlash('error', VarDumper::dumpAsString($model->getErrorSummary(true)));
        } else {
            Yii::$app->session->setFlash('success', 'Activity set to ' . (empty($deleted) ? 'active' : 'deleted') . '!');
        }
        return $this->redirect(['view', 'id' => $id]);
    }

    /**
     * @param $id
     * @return Response
     * @throws NotFoundHttpException
     */
    public function actionReboot($id)
    {
        $model = $this->findActivity($id);
        $si = dirname(__FILE__) . "/../Helpers/server_installer";
        $command = "{$si} {$model->ip} --password=ybfq*o9*r*a3899b82qt --username=bEttTor --only-reboot=true";
        set_time_limit(60);
        $res = shell_exec($command);
        $show = str_replace(['bEttTor', 'ybfq*o9*r*a3899b82qt'], ['*******', '********************'], $res);
        Yii::$app->session->setFlash('success', "Server {$model->ip}:<br /><pre>{$show}</pre>");
        return $this->redirect(['index',]);
    }

    public function actionRebootYc($id)
    {
        set_time_limit(600000);
        $model = $this->findActivity($id);
        $res = YCHelper::reboot($model->table->id);
        Yii::$app->session->setFlash($res === 'ok' ? 'success' : 'error', $res);
        return $this->redirect(['index',]);
    }

    /**
     * @param $id
     * @return Response
     * @throws NotFoundHttpException
     */
    public function actionLogin($id)
    {
        $model = $this->findActivity($id);
        if (empty($model->table) || empty($model->table->name)) {
            Yii::$app->session->setFlash('error', "Where is no name for {$model->ip}");
        } else {
            $res = RdpCommands::createLoginCommand($model);
            if ($res !== true) {
                Yii::$app->session->setFlash('error', $res);
            } else {
                Yii::$app->session->setFlash('success', "Login command was set for {$model->ip}!");
            }
        }
        return $this->redirect(['view', 'id' => $id]);
    }

    public function actionTable()
    {
        return $this->render('table');
    }

    /**
     * Displays a single Server model.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionView($id)
    {
        return $this->render('viewActivity', [
            'model' => $this->findActivity($id),
        ]);
    }

    /**
     * Update table record for corresponding server.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException
     */
    public function actionUpdateTable($id)
    {
        $model = $this->findActivity($id)->table;

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $id]);
        }

        return $this->render('updateTable', [
            'model' => $model,
        ]);
    }

    /**
     * Create table record for corresponding server.
     * @param integer $id
     * @return mixed
     */
    public function actionCreateTable($id)
    {
        $activity = $this->findActivity($id);
        $model = new RdpTable();
        $model->ip = $activity->ip;

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $id]);
        }

        return $this->render('createTable', [
            'model' => $model,
        ]);
    }

    public function actionSaveComment()
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $id = Yii::$app->request->post('id', false);
        $field = Yii::$app->request->post('field', false);
        $value = Yii::$app->request->post('value', '');
        if (empty($id) || empty($field)) {
            return ['status' => 'error', 'message' => 'Bad data!'];
        }
        $model = RdpActivity::findOne(['id' => $id]);
        if (!$model) {
            return ['status' => 'error', 'message' => "Activity {$id} not found!"];
        }
        $model->$field = $value;
        if ($model->save()) {
            return ['status' => 'success'];
        } else {
            return ['status' => 'error', 'message' => VarDumper::dumpAsString($model->errors)];
        }
    }

    public function actionViewOld($id)
    {
        return $this->render('view', [
            'model' => $this->findModel($id),
        ]);
    }

    /**
     * @param $id
     * @return array
     * @throws NotFoundHttpException
     */
    public function actionGetIp($id)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $model = $this->findModel($id);
        return ['ip' => $model->ip];
    }

    public function actionAssignIps()
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $ipsDraft = Yii::$app->request->post('ips', false);
        $id = Yii::$app->request->post('id', false);
        if (empty($ipsDraft) || empty($id)) {
            return ['status' => 'error', 'message' => 'Bad data!'];
        }
        $server = Server::findOne(['id' => $id]);
        if (!$server) {
            return ['status' => 'error', 'message' => "Server {$id} not found!"];
        }
        $ips = explode(';', $ipsDraft);
        $errors = [];
        foreach ($ips as $ip) {
            $model = ServerIp::findOne($ip);
            if (!$model) {
                $errors[] = "IP with id {$ip} not found :(";
                continue;
            }
            $model->bm_server_id = $id;
            if (!$model->save()) {
                $errors[] = VarDumper::dumpAsString($model->errors);
            }
        }
        if (empty($errors)) {
            return ['status' => 'success'];
        } else {
            return ['status' => 'error', 'message' => implode(', ', $errors)];
        }
    }

    /**
     * Creates a new Server model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new Server();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    /**
     * Updates an existing Server model.
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
     * Deletes an existing Server model.
     * If deletion is successful, the browser will be redirected to the 'index' page.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionDelete($id)
    {
        $this->findModel($id)->delete();

        return $this->redirect(['index']);
    }

    /**
     * Finds the Server model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return Server the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = Server::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('BotManager', 'The requested page does not exist.'));
    }

    /**
     * @param $id
     * @return RdpActivity|null
     * @throws NotFoundHttpException
     */
    protected function findActivity($id)
    {
        if (($model = RdpActivity::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('BotManager', 'The requested page does not exist.'));
    }
}
