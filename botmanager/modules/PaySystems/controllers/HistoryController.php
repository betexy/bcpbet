<?php

namespace app\modules\PaySystems\controllers;

use app\modules\PaySystems\models\Paysystems;
use Yii;
use app\modules\PaySystems\models\History;
use app\modules\PaySystems\models\HistorySearch;
use yii\filters\AccessControl;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;
use yii\data\ActiveDataProvider;

/**
 * HistoryController implements the CRUD actions for History model.
 */
class HistoryController extends Controller
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
                ],
            ],
        ];
    }

    /**
     * Lists all History models.
     * @return mixed
     */
    public function actionIndex()
    {
        $searchModel = new HistorySearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    /**
     * Show record with a special filter
     * @param $type 0 - IN QIWI, 1 - OUT QIWI, 2 - IN SKRILL, 3 - OUT SKRILL
     * @return string
     */
    public function actionSpecialIndex($type)
    {
        $searchModel = null;
        if ((int)$type < 2) {
            $conditions = ['and',
                ['type' => $type],
                ["NOT REGEXP","description", '.*\\+7[0-9]{10}.*'],
                ['in', 'ps_paysystems_id', Paysystems::find()->select('id')->where(['type' => 1])]];
        } else {
            $conditions = ['and',
                ['type' => $type - 2],
                ['in', 'ps_paysystems_id', Paysystems::find()->select('id')->where(['type' => 2])]];
        }
        $dataProvider = new ActiveDataProvider([
            'query' => History::find()->where($conditions),
            'pagination' => [
                'pageSize' => 20,
            ],
            'sort' => [
                'defaultOrder' => [
                    'id' => SORT_DESC,
                ]
            ],
        ]);

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
            'type' => (int)$type
        ]);
    }

    /**
     * Displays a single History model.
     * @param integer $id
     * @param boolean $wallets
     * @return string
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionView(int $id, bool $wallets = false): string
    {
        return $this->render('view', [
            'model' => $this->findModel($id),
            'wallets' => $wallets,
        ]);
    }

    /**
     * Creates a new History model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new History();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    /**
     * Updates an existing History model.
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
     * Deletes an existing History model.
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
     * Finds the History model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return History the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = History::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('PaySystems', 'The requested page does not exist.'));
    }
}
