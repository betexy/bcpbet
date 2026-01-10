<?php

namespace app\modules\PaySystems\controllers;

use app\controllers\BaseController;
use app\modules\PaySystems\models\PaysystemsBots;
use app\modules\PaySystems\models\PaysystemsQueue;
use Yii;
use app\modules\PaySystems\models\Paysystems;
use app\modules\PaySystems\models\PaysystemsSearch;
use yii\filters\AccessControl;
use yii\helpers\VarDumper;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;

/**
 * PaysystemsController implements the CRUD actions for Paysystems model.
 */
class PaysystemsController extends BaseController
{
    /**
     * {@inheritdoc}
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
            'verbs' => [
                'class' => VerbFilter::class,
                'actions' => [
                    'delete' => ['POST'],
                    'add-relation' => ['POST'],
                    'delete-relation' => ['POST'],
                    'create-action' => ['POST'],
                    'delete-action' => ['POST'],
                    'bulk' => ['POST'],
                ],
            ],
        ];
    }

    /**
     * Lists all Paysystems models.
     * @return mixed
     */
    public function actionIndex()
    {
        $searchModel = new PaysystemsSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    public function actionBulk()
    {
        $action = Yii::$app->request->post('action');
        $selection = (array)Yii::$app->request->post('selection');
        $results = [];
        foreach ($selection as $id) {
            if ($action === 'DELETE') {
                $model = Paysystems::findOne(['id' => $id]);
                if (!empty($model)) {
                    try {
                        if ($model->delete()) {
                            $results[] = "PaySystem {$id} deleted";
                        } else {
                            $results[] = "Error deleting {$id}: " . VarDumper::dumpAsString($model->getErrors());
                        }
                    } catch (\Throwable $e) {
                        $results[] = "Threw {$id}: " . VarDumper::dumpAsString($e->getMessage());
                    }
                } else {
                    $results[] = "{$id} not found";
                }
            } elseif (!empty($action)) {
                $model = new PaysystemsQueue();
                $model->ps_paysystems_id = $id;
                $model->command = $action;
                $model->status = 0;
                if ($model->save()) {
                    $results[] = "Action added for paysystem {$id}";
                } else {
                    $results[] = "ERROR bot {$id}: " . VarDumper::dumpAsString($model->getErrors());
                }
            }
        }
        if (empty($results)) {
            $results[] = 'Nothing!';
        }
        Yii::$app->session->setFlash('success', implode("\r\n", $results));
        return $this->redirect(['paysystems/index']);
    }

    /**
     * Lists all Paysystems models.
     * @return mixed
     */
    public function actionSelect()
    {
        Yii::$app->log->targets['debug'] = null;
        $searchModel = new PaysystemsSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);

        $this->layout = 'ajax';

        return $this->render('select', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    /**
     * Displays a single Paysystems model.
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
     * Creates a new Paysystems model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new Paysystems();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    public function actionCreateAction()
    {
        $model = new PaysystemsQueue();
        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return 'ok';
        } else {
            return VarDumper::dumpAsString($model->errors);
        }
    }

    /**
     * @param $id
     * @return string
     * @throws \Throwable
     * @throws \yii\db\StaleObjectException
     */
    public function actionDeleteAction($id)
    {
        $m = PaysystemsQueue::findOne($id);
        if (!empty($m)) {
            $m->delete();
        }
        return 'ok';
    }

    /**
     * Updates an existing Paysystems model.
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
     * @param $id
     * @return \yii\web\Response
     * @throws NotFoundHttpException
     * @throws \Throwable
     * @throws \yii\db\StaleObjectException
     */
    public function actionDelete($id)
    {
        $this->findModel($id)->delete();

        return $this->redirect(['index']);
    }

    public function actionAddRelation()
    {
        $id = (int)Yii::$app->request->post('id', '');
        $selection = Yii::$app->request->post('selection', '');
        foreach (explode(',', $selection) as $bot_id) {
            $exists = PaysystemsBots::findAll(['deleted' => 0, 'bm_bots_id' => (int)$bot_id, 'ps_paysystems_id' => $id]);
            if (empty($exists)) {
                if (!empty($id) && !empty($bot_id)) {
                    $link = new PaysystemsBots();
                    $link->deleted = 0;
                    $link->ps_paysystems_id = $id;
                    $link->bm_bots_id = (int)$bot_id;
                    $link->save();
                }
            }
        }
    }

    public function actionDeleteRelation($id)
    {
        $m = PaysystemsBots::findOne($id);
        if (!empty($m)) {
            $m->deleted = 1;
            $m->save();
        }
    }

    /**
     * Finds the Paysystems model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return Paysystems the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = Paysystems::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('SimsManager', 'The requested page does not exist.'));
    }
}
