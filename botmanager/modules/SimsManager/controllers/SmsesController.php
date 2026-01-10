<?php

namespace app\modules\SimsManager\controllers;

use app\controllers\BaseController;
use app\modules\SimsManager\helpers\SimsHelper;
use Yii;
use app\modules\SimsManager\models\Smses;
use app\modules\SimsManager\models\SmsesSearch;
use yii\filters\AccessControl;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;

/**
 * SmsesController implements the CRUD actions for Smses model.
 */
class SmsesController extends BaseController
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
                    //'delete' => ['POST'],
                ],
            ],
        ];
    }

    /**
     * @return string
     * @throws \ReflectionException
     */
    public function actionIndex()
    {
        $searchModel = new SmsesSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);
        $dataProvider->sort->defaultOrder = ['id' => SORT_DESC];

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    /**
     * Displays a single Smses model.
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
     * Updates an existing Smses model.
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

    public function actionGoipLoad()
    {
        $res = SimsHelper::requestSmses();
        if (Yii::$app->request->isAjax) {
            Yii::$app->response->content = 'ok';
            return Yii::$app->response->send();
        } else {
            Yii::$app->session->setFlash($res['status'], $res['message']);
            return $this->redirect('index');
        }
    }

    /**
     * Finds the Smses model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return Smses the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = Smses::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('SimsManager', 'The requested page does not exist.'));
    }
}
