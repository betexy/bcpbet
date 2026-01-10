<?php

namespace app\modules\BotManager\controllers;

use app\modules\BotManager\Helpers\ProxyHelper;
use app\modules\Emails\helpers\imap\Exception;
use Yii;
use app\modules\BotManager\models\FillingOptions;
use app\modules\BotManager\models\FillingOptionsSearch;
use yii\helpers\FileHelper;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;
use yii\web\UploadedFile;

/**
 * FillingOptionsController implements the CRUD actions for FillingOptions model.
 */
class FillingOptionsController extends Controller
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
     * Lists all FillingOptions models.
     * @return mixed
     */
    public function actionIndex()
    {
        $searchModel = new FillingOptionsSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    public function actionCountries()
    {
        $countries = ProxyHelper::get()->countriesEn;
        return "<h1>Supported countries:</h1><pre>" . implode(PHP_EOL,
                array_map(function ($f) {
                    return is_array($f) ? implode(', ', $f) : $f;
                }, $countries)) . "</pre>";
    }

    /**
     * Displays a single FillingOptions model.
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
     * Creates a new FillingOptions model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new FillingOptions();

        if ($model->load(Yii::$app->request->post())) {
            try {
                $model->save();
            } catch (\Exception $e) {
                $model->addError('value', FillingOptions::humanError($e->getMessage()));
                return $this->render('create', [
                    'model' => $model,
                ]);
            }
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    /**
     * Updates an existing FillingOptions model.
     * If update is successful, the browser will be redirected to the 'view' page.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionUpdate($id)
    {
        $model = $this->findModel($id);

        if ($model->load(Yii::$app->request->post())) {
            try {
                $model->save();
            } catch (\Exception $e) {
                $model->addError('value', FillingOptions::humanError($e->getMessage()));
                return $this->render('update', [
                    'model' => $model,
                ]);
            }
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('update', [
            'model' => $model,
        ]);
    }

    /**
     * Deletes an existing FillingOptions model.
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
     * @throws \yii\db\Exception
     */
    public function actionImport(): \yii\web\Response
    {
        if (Yii::$app->request->isPost) {
            $file = UploadedFile::getInstanceByName('file_import');
            if ($file) {
                $fillingOption = Yii::$app->request->post('fillingOption');
                $content = file_get_contents($file->tempName);
                $lines = explode("\n", $content);
                $inserted = 0;
                $errors = [];
                foreach ($lines as $line) {
                    if (!FillingOptions::findOne(['name' => $fillingOption, 'value' => trim($line)])) {
                        $current = new FillingOptions();
                        $current->name = $fillingOption;
                        $current->value = trim($line);
                        $res = false;
                        try {
                            $res = $current->save();
                        } catch (\Exception $e) {
                            $errors[] = FillingOptions::humanError($e->getMessage());
                        }
                        if ($res) {
                            $inserted++;
                        }
                    }
                }
                if ($inserted > 0) {
                    Yii::$app->getSession()->setFlash('success',
                        "Successfully imported $inserted lines of " . FillingOptions::getOptions()[$fillingOption]);
                }
                if (!empty($errors)) {
                    Yii::$app->getSession()->setFlash('error', implode(PHP_EOL, $errors));
                }
            } else {
                Yii::$app->getSession()->setFlash('error', 'No file!');
            }
        } else {
            Yii::$app->getSession()->setFlash('error', 'Not POST method!');
        }
        return $this->redirect(['index']);
    }

    /**
     * Finds the FillingOptions model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return FillingOptions the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = FillingOptions::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('BotManager', 'The requested page does not exist.'));
    }
}
