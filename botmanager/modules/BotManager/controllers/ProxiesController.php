<?php

namespace app\modules\BotManager\controllers;

use app\modules\BotManager\Helpers\ProxyHelper;
use Yii;
use app\modules\BotManager\models\Proxies;
use app\modules\BotManager\models\ProxiesSearch;
use yii\db\StaleObjectException;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;

/**
 * ProxiesController implements the CRUD actions for Proxies model.
 */
class ProxiesController extends Controller
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
                ],
            ],
        ];
    }

    /**
     * Lists all Proxies models.
     * @return mixed
     */
    public function actionIndex()
    {
        $searchModel = new ProxiesSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);
        $dataProvider->query->andWhere(['proxies.deleted' => 0]);
        $dataProvider->sort->attributes['stakeAccount'] = [
            'asc' => ['stake_accounts.name' => SORT_ASC],
            'desc' => ['stake_accounts.name' => SORT_DESC],
        ];

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
            'deleted' => false,
        ]);
    }

    /**
     * Lists all deleted Proxies models.
     * @return mixed
     */
    public function actionDeleted()
    {
        $searchModel = new ProxiesSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);
        $dataProvider->query->andWhere(['proxies.deleted' => 1]);

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
            'deleted' => true,
        ]);
    }

    public function actionBalance(): \yii\web\Response
    {
        Yii::$app->session->setFlash('success', 'Balance is: $' . ProxyHelper::get()->getBalance());
        return $this->redirect(['index']);
    }

    /**
     * Displays a single Proxies model.
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
     * Creates a new Proxies model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new Proxies();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    /**
     * Updates an existing Proxies model.
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
     * @throws \Throwable
     * @throws StaleObjectException
     * @throws NotFoundHttpException
     */
    public function actionFreeProxy($id): \yii\web\Response
    {
        $model = $this->findModel($id);
        if ($model->stakeAccount && !empty($model->stakeAccount->proxies_id)) {
            $newIp = ProxyHelper::get()->changeLuminatiIP($model);
            $model->stakeAccount->proxies_id = null;
            $model->stakeAccount->save();
            Yii::$app->session->setFlash(!empty($newIp) ? 'error' : 'success',
                !empty($newIp) ? "Proxy freed but IP not changed due: $newIp!" : 'Proxy freed!');
        }
        return $this->redirect(['view', 'id' => $model->id]);
    }

    /**
     * @throws \Throwable
     * @throws StaleObjectException
     * @throws NotFoundHttpException
     */
    public function actionDelete($id): \yii\web\Response
    {
        $model = $this->findModel($id);
        if ($model->deleted) {
            $model->deleted = 0;
            $model->save();
            return $this->redirect(['view', 'id' => $model->id]);
        } else {
            $model->delete();
        }
        return $this->redirect(['index']);
    }

    /**
     * Finds the Proxies model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return Proxies the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = Proxies::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('BotManager', 'The requested page does not exist.'));
    }
}
