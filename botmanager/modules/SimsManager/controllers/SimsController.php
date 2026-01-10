<?php

namespace app\modules\SimsManager\controllers;

use app\controllers\BaseController;
use Yii;
use app\modules\SimsManager\models\Sims;
use app\modules\SimsManager\models\SimsSearch;
use yii\base\ErrorException;
use yii\db\Exception;
use yii\filters\AccessControl;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;
use yii\web\UploadedFile;

/**
 * SimsController implements the CRUD actions for Sims model.
 */
class SimsController extends BaseController
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
                    'import' => ['POST'],
                ],
            ],
        ];
    }

    /**
     * Lists all Sims models.
     * @return mixed
     */
    public function actionIndex()
    {
        $searchModel = new SimsSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    /**
     * Displays a single Sims model.
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
     * Creates a new Sims model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new Sims();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    /**
     * Updates an existing Sims model.
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

    /**
     * @return \yii\console\Response|\yii\web\Response
     * @throws \yii\web\RangeNotSatisfiableHttpException
     */
    public function actionExport()
    {
        $lines = [];
        foreach (Sims::find()->all() as $sim) {
            $lines[] = implode(';', [$sim->number, $sim->slot->slot_id, base64_encode($sim->comment)]);
        }
        return Yii::$app->response->sendContentAsFile(implode("\r\n", $lines), 'sims_' . time() . '.csv');
    }

    /**
     * @return \yii\web\Response
     */
    public function actionImport()
    {
        $file = UploadedFile::getInstanceByName('csv_file');
        if (!empty($file)) {
            $csv = file_get_contents($file->tempName);
            if (Sims::importFromCsv($csv)) {
                Yii::$app->session->addFlash('success', "Import complete!");
            } else {
                Yii::$app->session->addFlash('error', 'Error importing data!');
            }
        } else {
            Yii::$app->session->setFlash('error', 'Error downloading file!');
        }
        return $this->redirect(['index']);
    }

    /**
     * Finds the Sims model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return Sims the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = Sims::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('SimsManager', 'The requested page does not exist.'));
    }
}
