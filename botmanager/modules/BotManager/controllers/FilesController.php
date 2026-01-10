<?php

namespace app\modules\BotManager\controllers;

use app\controllers\BaseController;
use Yii;
use app\modules\BotManager\models\Files;
use app\modules\BotManager\models\FilesSearch;
use yii\filters\AccessControl;
use yii\helpers\FileHelper;
use yii\helpers\StringHelper;
use yii\helpers\VarDumper;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;
use yii\web\UploadedFile;

/**
 * FilesController implements the CRUD actions for Files model.
 */
class FilesController extends BaseController
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
     * Lists all Files models.
     * @return mixed
     */
    public function actionIndex()
    {
        $searchModel = new FilesSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    /**
     * Displays a single Files model.
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
     * Download file.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionDownload($id)
    {
        $model = $this->findModel($id);
        if (!empty($model->file_name) && !empty($model->file_path) && file_exists($model->file_path . $model->file_name)) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = finfo_file($finfo, $model->file_path . $model->file_name);
            if (ob_get_level()) {
                ob_end_clean();
            }
            header('Content-Description: File Transfer');
            header('Content-Type: ' . $mime);
            header('Content-Disposition: attachment; filename="' . $model->source_name . '";');
            header('Expires: 0');
            header('Cache-Control: must-revalidate');
            header('Pragma: public');
            header('Content-Length: ' . filesize($model->file_path . $model->file_name));
            readfile($model->file_path . $model->file_name);
            return true;
        } else {
            return $this->render('view', [
                'model' => $model,
            ]);
        }
    }

    public function actionInternalJs($name)
    {
        $fileName = Yii::getAlias(Yii::$app->controller->module->internal_js_alias) . $name;
        if (file_exists($fileName)) {
            return Yii::$app->response->sendFile($fileName, null, ['inline' => true]);
        } else {
            return '';
        }
    }

    /**
     * Creates a new Files model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new Files();

        if (Yii::$app->request->isPost) {
            $file = UploadedFile::getInstance($model, 'file_name');
            if ($file) {
                $directory = Yii::getAlias(Yii::$app->controller->module->files_dir_alias);
                if (!is_dir($directory)) {
                    try {
                        FileHelper::createDirectory($directory);
                    } catch (\Exception $exception) {
                        return 'Error creating directory: ' . $directory;
                    }
                }
                $uid = uniqid(time(), true);
                $fileName = $uid . '.' . $file->extension;
                $filePath = $directory . $fileName;
                if ($file->saveAs($filePath)) {
                    $model->name = $file->name;
                    $model->source_name = $file->name;
                    //$model->source_path = StringHelper::endsWith($model->source_name, '.zip', false) ? '[software]' : '@ext/js/';
                    $model->source_path = Yii::$app->request->post('Files', ['source_path' => '@root/'])['source_path'];
                    $model->tag = Yii::$app->request->post('Files', ['tag' => ''])['tag'];
                    $model->file_name = $fileName;
                    $model->file_path = $directory;
                    $model->save();
                    return $this->redirect(['view', 'id' => $model->id]);
                }
            }
        }
        /*
        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }
        */
        return $this->render('create', [
            'model' => $model,
        ]);
    }

    /**
     * Delete file, show form, save new file
     * @param $id
     * @return string|\yii\web\Response
     * @throws NotFoundHttpException
     */
    public function actionUpdateFile($id)
    {
        $model = $this->findModel($id);
        if (Yii::$app->request->isPost) {
            $file = UploadedFile::getInstance($model, 'file_name');
            if ($file) {
                $directory = Yii::getAlias(Yii::$app->controller->module->files_dir_alias);
                if (!is_dir($directory)) {
                    try {
                        FileHelper::createDirectory($directory);
                    } catch (\Exception $exception) {
                        return 'Error creating directory: ' . $directory;
                    }
                }
                $uid = uniqid(time(), true);
                $fileName = $uid . '.' . $file->extension;
                $filePath = $directory . $fileName;
                if ($file->saveAs($filePath)) {
                    //$model->name = $file->name;
                    $model->source_name = $file->name;
                    //$model->source_path = StringHelper::endsWith($model->source_name, '.zip', false) ? '[software]' : '@ext/js/';
                    $model->source_path = Yii::$app->request->post('Files', ['source_path' => '@root/'])['source_path'];
                    //$model->tag = Yii::$app->request->post('Files', ['tag' => ''])['tag'];
                    $model->file_name = $fileName;
                    $model->file_path = $directory;
                    $model->save();
                    return $this->redirect(['view', 'id' => $model->id]);
                }
            }
        } else if ($model->unlinkFile()) {
            return $this->render('create', [
                'model' => $model,
            ]);
        } else {
            return $this->redirect(['view', 'id' => $id]);
        }
    }

    /**
     * Updates an existing Files model.
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
     * Deletes an existing Files model.
     * If deletion is successful, the browser will be redirected to the 'index' page.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     * @throws \Exception|\Throwable in case delete failed.
     */
    public function actionDelete($id)
    {
        $model = $this->findModel($id);

        try {
            if (!empty($model->file_name) && !empty($model->file_path) && file_exists($model->file_path . $model->file_name)) {
                if ($model->delete()) {
                    unlink($model->file_path . $model->file_name);
                } else {
                    Yii::$app->session->setFlash('errorFlashMessage',
                        'Error deleting: ' . VarDumper::dumpAsString($model->getErrors()), true);
                }
            } else {
                $model->delete();
            }
        } catch (\Exception $e) {
            Yii::$app->session->setFlash('errorFlashMessage',
                'Error deleting: ' . $e->getMessage(), true);
        }

        return $this->redirect(['index']);
    }

    /**
     * Finds the Files model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return Files the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = Files::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('BotManager', 'The requested page does not exist.'));
    }

}
