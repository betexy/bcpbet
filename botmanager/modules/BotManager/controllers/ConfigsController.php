<?php

namespace app\modules\BotManager\controllers;

use app\modules\BotManager\models\Configs;
use app\modules\BotManager\models\ConfigsConfigs;
use app\modules\BotManager\models\ConfigsSearch;
use Yii;
use yii\data\ActiveDataProvider;
use yii\db\StaleObjectException;
use yii\filters\VerbFilter;
use yii\web\Controller;
use yii\web\NotFoundHttpException;

/**
 * ConfigsController implements the CRUD actions for Configs model.
 */
class ConfigsController extends Controller
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
     * Lists all Configs models.
     * @return mixed
     */
    public function actionIndex()
    {
        $searchModel = new ConfigsSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    /**
     * Displays a single Configs model.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionView($id)
    {
        $model = $this->findModel($id);
        return $this->render('view', [
            'model' => $model,
            'configsDataProvider' => new ActiveDataProvider([
                'query' => ConfigsConfigs::find()
                    ->where(['configs_configs.parent_id' => $id]),
                'pagination' => [
                    'pageSize' => 20,
                ],
            ]),
            'configsChildDataProvider' => new ActiveDataProvider([
                'query' => ConfigsConfigs::find()
                    ->where(['configs_configs.child_id' => $id]),
                'pagination' => [
                    'pageSize' => 20,
                ],
            ]),
        ]);
    }

    /**
     * Creates a new Configs model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new Configs();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    /**
     * Updates an existing Configs model.
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

    public function actionClone($id)
    {
        $model = $this->findModel($id);
        $model->id = null;
        $model->isNewRecord = true;
        $model->name = $model->name . ' (clone)';
        $model->save();

        return $this->redirect(['update', 'id' => $model->id]);
    }

    /**
     * Deletes an existing Configs model.
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

    public function actionAddConfigs(): string
    {
        $id = Yii::$app->request->post('id');
        $configs = Yii::$app->request->post('configs');
        if (!empty($configs) && !empty($id)) {
            foreach ($configs as $config_id) {
                $test = ConfigsConfigs::findAll(['parent_id' => $id, 'child_id' => $config_id]);
                if (empty($test)) {
                    $link = new ConfigsConfigs();
                    $link->parent_id = $id;
                    $link->child_id = $config_id;
                    $link->save();
                }
            }
            return 'ok';
        } else {
            return 'Bad parameters!';
        }
    }


    /**
     * @throws \Throwable
     * @throws StaleObjectException
     */
    public function actionDeleteConfig($id): string
    {
        $model = ConfigsConfigs::findOne($id);
        if ($model) {
            $model->delete();
        } else {
            return 'Bad parameters!';
        }
        return 'ok';
    }

    /**
     * Finds the Configs model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return Configs the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = Configs::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('configs', 'The requested page does not exist.'));
    }
}
