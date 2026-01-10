<?php

namespace app\modules\BotManager\controllers;

use app\controllers\BaseController;
use app\modules\BotManager\Helpers\BotsHelper;
use app\modules\BotManager\models\BkSettings;
use app\modules\BotManager\models\BkSettingsForm;
use app\modules\BotManager\models\Bots;
use app\modules\BotManager\models\FileGroups;
use app\modules\BotManager\models\FileGroupsSearch;
use app\modules\BotManager\models\FilesFileGroups;
use app\modules\BotManager\models\SoftwareVersions;
use Yii;
use yii\data\ActiveDataProvider;
use yii\filters\AccessControl;
use yii\filters\VerbFilter;
use yii\helpers\VarDumper;
use yii\web\NotFoundHttpException;
use yii\web\Response;

/**
 * FileGroupsController implements the CRUD actions for FileGroups model.
 */
class FileGroupsController extends BaseController
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
                    'delete-linked' => ['POST'],
                    'add-files' => ['POST'],
                    'remove-bk' => ['POST'],
                    'settings-save' => ['POST'],
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
        $searchModel = new FileGroupsSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    /**
     * @return string
     */
    public function actionSettings()
    {
        $model = new BkSettingsForm();
        if (!Yii::$app->request->isPost) {
            $model->loadData();
        }
        return $this->render('settings');
    }

    public function actionSettingsSave($internalName)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $model = new BkSettingsForm();
        $model->loadData();
        $model->loadBk($internalName, Yii::$app->request->post());
        if ($model->save()) {
            return ['status' => 'success'];
        } else {
            return ['status' => 'error', 'message' => VarDumper::dumpAsString($model->getErrors())];
        }
    }

    public function actionForceSort()
    {
        $model = new BkSettingsForm();
        $model->loadData();
        if ($model->save()) {
            Yii::$app->session->setFlash('success', 'Should be done!');
        } else {
            Yii::$app->session->setFlash('error', VarDumper::dumpAsString($model->getErrors()));
        }
        return $this->redirect('settings');
    }

    public function actionRemoveBk()
    {
        $bk = Yii::$app->request->post('internalName');
        if (empty($bk)) {
            Yii::$app->session->setFlash('error', 'Bad BK name!');
        } else {
            $model = (new BkSettingsForm())->loadData();
            $model->deleteBk($bk);
            if ($model->save()) {
                Yii::$app->session->setFlash('success', 'BK removed!');
            } else {
                Yii::$app->session->setFlash('error', 'Error saving!');
            }
        }
        return $this->redirect('settings');
    }

    /**
     * Displays a single FileGroups model.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionView($id)
    {
        $model = $this->findModel($id);
        return $this->render('view', [
            'model' => $model,
            'filesDataProvider' => new ActiveDataProvider([
                'query' => FilesFileGroups::find()->andFilterWhere(['file_groups_id' => $model->id]),

                /*
                'sort' => [
                    'defaultOrder' => ['id' => SORT_DESC],
                    'attributes' => [
                        'files.source_path' => [
                            'asc' => ['bm_files.source_path' => SORT_ASC],
                            'desc' => ['bm_files.source_path' => SORT_DESC],
                        ],
                    ],
                ],
                */

                'pagination' => [
                    'pageSize' => 20,
                ],
            ]),
            'settingsDataProvider' => new ActiveDataProvider([
                'query' => BkSettings::find()->andFilterWhere(['file_groups_id' => $model->id]),
                'sort' => [
                    'attributes' => [
                        'bkText' => [
                            'asc' => ['bk_internal' => SORT_ASC],
                            'desc' => ['bk_internal' => SORT_DESC],
                        ],
                    ],
                ],
                'pagination' => [
                    'pageSize' => 20,
                ],
            ])
        ]);
    }

    public function actionAddFiles()
    {
        $id = Yii::$app->request->post('id');
        $files = Yii::$app->request->post('files');
        if (!empty($files) && !empty($id)) {
            foreach ($files as $file_id) {
                $test = FilesFileGroups::findAll(['file_groups_id' => $id, 'files_id' => $file_id]);
                if (empty($test)) {
                    $link = new FilesFileGroups();
                    $link->file_groups_id = $id;
                    $link->files_id = $file_id;
                    $link->save();
                }
            }
            return 'ok';
        } else {
            return 'Bad parameters!';
        }
    }

    public function actionAddSettings()
    {
        $id = Yii::$app->request->post('id');
        $settings = Yii::$app->request->post('settings');
        if (!empty($settings) && !empty($id)) {
            foreach ($settings as $internal_bk) {
                $test = BkSettings::findAll(['file_groups_id' => $id, 'bk_internal' => $internal_bk]);
                if (empty($test)) {
                    $link = new BkSettings();
                    $link->file_groups_id = $id;
                    $link->bk_internal = $internal_bk;
                    $link->save();
                }
            }
            return 'ok';
        } else {
            return 'Bad parameters!';
        }
    }

    /**
     * @param $id
     * @param $user_id
     * @param $bot_name
     * @param bool $testing
     * @param bool $obfuscate
     * @param string $cas
     * @return mixed|\yii\console\Response|\yii\web\Response
     * @throws NotFoundHttpException
     * @throws \yii\web\RangeNotSatisfiableHttpException
     */
    public function actionDownload($id, $user_id, $bot_name, bool $testing = false, bool $obfuscate = false,
                                   string $comment = '')
    {
        $model = $this->findModel($id);
        if ($model->type === 2) {
            $tempModel = new SoftwareVersions();
            $tempModel->file_groups_id = $id;
            $tempModel->code = 'directDownload';
            return Yii::$app->response->sendContentAsFile(BotsHelper::prepareSoftware($tempModel, false, $user_id, $bot_name),
                $tempModel->code . '.zip');
        } else if ($model->type === 0) {
            $tempModel = new Bots();
            $tempModel->setDefaults();
            $tempModel->extension_id = $id;
            $tempModel->thisIsTemp = true;
            if ($id>192)
                return Yii::$app->response->sendContentAsFile(BotsHelper::prepareExtensionV3($tempModel),
                    'extension3Defaults.zip');
            return Yii::$app->response->sendContentAsFile(BotsHelper::prepareExtension($tempModel),
                'extensionDefaults.zip');
        } else if ($model->type === 1) {
            // BK download
            $mappings = FileGroups::getBkMapping();
            $testing = !empty($testing);
            $filename = "extension_{$model->name}" . ($testing ? '_TEST' : '') . '.zip';
            $params = [
                'bk' => $mappings[$model->bk_internal],
                'login' => '*** TEST ***',
                'password' => '*** TEST ***',
                'phone' => '1231231231',
                'uid' => 'dfhsdkfjh',
                'ws_url' => 'ws://localhost:2020',
                'email' => 'no-email',
                'email_password' => 'no-email',
                'urls' => '*** TEST ***',
                'use_chrome' => false,
                'profile' => '*** TEST ***',
                'restart' => false,
                'second_name' => '*** TEST ***',
                'experimental' => false,
            ];
            if ($testing) {
                $params['testing'] = true;
            }
            if (!empty($comment)) {
                $params['comment'] = $comment;
            }
            return Yii::$app->response->sendContentAsFile(
                BotsHelper::prepareExtensionByBk($params, 0, false, (int)$obfuscate),
                $filename
            );
        }
        Yii::$app->session->setFlash('error', 'Download available only for Extension and Software!');
        return $this->actionView($id);
    }

    /**
     * Creates a new FileGroups model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new FileGroups();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    /**
     * Updates an existing FileGroups model.
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

    public function actionUpdateSettings($settings_id)
    {
        $model = BkSettings::findOne($settings_id);
        if ($model && $model->load(Yii::$app->request->post()) && $model->save()) {
            return 'ok';
        } else {
            return 'Wrong parameters!';
        }
    }

    /**
     * Deletes an existing FileGroups model.
     * If deletion is successful, the browser will be redirected to the 'index' page.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     * @throws \Exception|\Throwable in case delete failed.
     */
    public function actionDelete($id)
    {
        $this->findModel($id)->delete();

        return $this->redirect(['index']);
    }

    /**
     * Deletes an existing FilesFileGroups model.
     * If deletion is successful, the browser will be redirected to the 'index' page.
     * @param integer $id
     * @return mixed
     * @throws \Exception|\Throwable in case delete failed.
     */
    public function actionDeleteLinked($id)
    {
        $model = FilesFileGroups::findOne($id);
        if ($model) {
            $model->delete();
        }
        return 'ok';
    }

    /**
     * Deletes an existing BkSettings model.
     * If deletion is successful, the browser will be redirected to the 'index' page.
     * @param integer $id
     * @return mixed
     * @throws \Exception|\Throwable in case delete failed.
     */
    public function actionDeleteSettings($id)
    {
        $model = BkSettings::findOne($id);
        if ($model) {
            $model->delete();
        }
        return 'ok';
    }

    /**
     * Finds the FileGroups model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return FileGroups the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = FileGroups::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('BotManager', 'The requested page does not exist.'));
    }
}
