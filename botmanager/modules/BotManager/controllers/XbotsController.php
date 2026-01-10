<?php

namespace app\modules\BotManager\controllers;

use app\modules\BotManager\models\Xbots;
use app\modules\BotManager\models\XbotsSearch;
use Yii;
use yii\filters\VerbFilter;
use yii\web\Controller;
use yii\web\NotFoundHttpException;

/**
 * XbotsController implements the CRUD actions for Xbots model.
 */
class XbotsController extends Controller
{
    /**
     * {@inheritdoc}
     */
    public function behaviors()
    {
        return [
            'verbs' => [
                'class' => VerbFilter::className(),
                'actions' => [
                    'delete' => ['POST'],
                ],
            ],
        ];
    }

    /**
     * Lists all Xbots models.
     * @return mixed
     */
    public function actionIndex()
    {
        $searchModel = new XbotsSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    /**
     * Displays a single Xbots model.
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
     * Creates a new Xbots model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new Xbots();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    /**
     * Updates an existing Xbots model.
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
     * Adds one day to the due date of active bots in the selected bookie
     * @return mixed
     */
    public function actionDay(): \yii\web\Response
    {
        $bookie = Yii::$app->request->post('bookie');
        if (Xbots::addADay($bookie)) {
            Yii::$app->session->setFlash('success', "A day added to {$bookie}");
        } else {
            Yii::$app->session->setFlash('error', "Error adding a day");
        }
        return $this->redirect(['index']);
    }

    /**
     * Refreshes the name and the bookie of all bots
     * @return mixed
     */
    public function actionRefresh(): \yii\web\Response
    {
        if (Xbots::refreshAll()) {
            Yii::$app->session->setFlash('success', "All bots refreshed");
        } else {
            Yii::$app->session->setFlash('error', "Error till refreshing bots");
        }
        return $this->redirect(['index']);
    }

    /**
     * Deletes an existing Xbots model.
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
     * Finds the Xbots model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return Xbots the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = Xbots::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('BotManager', 'The requested page does not exist.'));
    }
}
