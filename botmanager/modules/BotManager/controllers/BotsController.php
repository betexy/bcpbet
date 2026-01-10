<?php

namespace app\modules\BotManager\controllers;

use app\modules\Accounts\models\AccountBookmakerSearch;
use app\controllers\BaseController;

use app\modules\BotManager\models\SettingsForm;
use app\modules\PaySystems\models\PaysystemsBots;
use Symfony\Component\Finder\Exception\AccessDeniedException;
use Yii;
use yii\data\ActiveDataProvider;
use yii\filters\AccessControl;
use yii\helpers\VarDumper;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;
use app\modules\BotManager\models\Bots;
use app\modules\BotManager\models\BotsSearch;
use app\modules\BotManager\Helpers\BotsHelper;
use app\modules\BotManager\models\BotsBks;
use app\modules\BotManager\models\BotsQueue;
use yii\web\Response;

/**
 * BotsController implements the CRUD actions for Bots model.
 */
class BotsController extends BaseController
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
                    'apply-settings' => ['POST'],
                    'add-relation' => ['POST'],
                    'delete-relation' => ['POST'],
                    'save-bot-comment' => ['POST'],
                ],
            ],
        ];
    }

    /**
     * Lists all Bots models.
     * @return string
     * @throws \ReflectionException
     */
    public function actionIndex()
    {
        $searchModel = new BotsSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);
        $dataProvider->pagination = ['pageSize' => 100];

        $this->layout = 'fluid';

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    /**
     * Lists all Bots models.
     * @return string
     * @throws \ReflectionException
     */
    public function actionSelect()
    {
        Yii::$app->log->targets['debug'] = null;
        $searchModel = new BotsSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);
        $dataProvider->pagination = ['pageSize' => 100];

        $this->layout = 'ajax';

        return $this->render('select', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    /**
     * Lists all AccountBookmaker models.
     * @return mixed
     */
    public function actionSelectAccountBookmaker()
    {
        Yii::$app->log->targets['debug'] = null;
        $searchModel = new AccountBookmakerSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);
        $dataProvider->pagination = ['pageSize' => 100];

        $this->layout = 'ajax';

        return $this->render('select-account-bookmaker', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    public function actionAddRelation()
    {
        $id = (int)Yii::$app->request->post('id', '');
        $selection = Yii::$app->request->post('selection', '');
        foreach (explode(',', $selection) as $ps_id) {
            if (!empty($id) && !empty($ps_id)) {
                $exists = PaysystemsBots::findAll(['deleted' => 0, 'bm_bots_id' => $id, 'ps_paysystems_id' => (int)$ps_id]);
                if (empty($exists)) {
                    $link = new PaysystemsBots();
                    $link->deleted = 0;
                    $link->bm_bots_id = $id;
                    $link->ps_paysystems_id = (int)$ps_id;
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

    public function actionBulk()
    {
        $action = Yii::$app->request->post('action');
        $version = Yii::$app->request->post('version');
        $updates = Yii::$app->request->post('updates');
        $selection = (array)Yii::$app->request->post('selection');
        $results = [];
        $settings = new SettingsForm();
        $settings->loadData();
        foreach ($selection as $id) {
            if (!empty($action)) {
                $model = new BotsQueue();
                $model->bots_id = $id;
                $model->action = $action;
                $model->status = 0;
                if ($model->save()) {
                    $results[] = "Action added in queue for bot {$id}";
                } else {
                    $results[] = "ERROR bot {$id}: " . VarDumper::dumpAsString($model->getErrors());
                }
            } elseif (!empty($version)) {
                $model = Bots::findOne($id);
                $model->software_versions_id = $version;
                if ($model->save()) {
                    $results[] = "Version updated for bot {$id}";
                } else {
                    $results[] = "ERROR bot {$id}: " . VarDumper::dumpAsString($model->getErrors());
                }
            } elseif (!empty($updates)) {
                $model = Bots::findOne($id);
                if ($updates === 'enableWs2') {
                    $model->double_enabled = 1;
                    $model->double_url = $settings->double_default_url;
                    $model->double_uid = $settings->double_use_main_uid ? $model->websocket_uid : $model->double_uid;
                } elseif ($updates === 'disableWs2') {
                    $model->double_enabled = 0;
                }
                if ($model->save()) {
                    $results[] = "Version updated for bot {$id}";
                } else {
                    $results[] = "ERROR bot {$id}: " . VarDumper::dumpAsString($model->getErrors());
                }
            }
        }
        Yii::$app->session->setFlash('success', implode("\r\n", $results));
        return $this->actionIndex();
    }

    /**
     * Displays a single Bots model.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionView($id)
    {
        $model = $this->findModel($id);
        return $this->render('view', [
            'model' => $model,
            'bksDataProvider' => new ActiveDataProvider([
                'query' => BotsBks::find()->andFilterWhere(['bots_id' => $model->id])->joinWith('bk'),
                'pagination' => [
                    'pageSize' => 20,
                ],
            ]),
            'queueDataProvider' => new ActiveDataProvider([
                'query' => BotsQueue::find()->andFilterWhere(['bots_id' => $model->id, 'bot_class' => 'Bots']),
                'pagination' => [
                    'pageSize' => 10,
                ],
                'sort' => ['defaultOrder' => ['id' => SORT_DESC]]
            ]),
        ]);
    }

    /**
     * Creates a new Bots model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new Bots();
        $model->user_id = Yii::$app->user->getIdentity()->getId();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    public function actionCreateBotAction()
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $model = new BotsQueue();
        if ($model->load(Yii::$app->request->post()) && $model->create()) {
            return ['status' => 'success'];
        } else {
            return ['status' => 'error', 'message' => VarDumper::dumpAsString($model->errors)];
        }
    }


    public function actionSaveBotComment()
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $id = Yii::$app->request->post('id', false);
        $field = Yii::$app->request->post('field', false);
        $value = Yii::$app->request->post('value', '');
        if (empty($id) || empty($field)) {
            return ['status' => 'error', 'message' => 'Bad data!'];
        }
        $model = Bots::findOne(['id' => $id]);
        if (!$model) {
            return ['status' => 'error', 'message' => "Bot {$id} not found!"];
        }
        $model->$field = $value;
        if ($model->save()) {
            return ['status' => 'success'];
        } else {
            return ['status' => 'error', 'message' => VarDumper::dumpAsString($model->errors)];
        }
    }

    /**
     * @param $id
     * @param $type
     * @return mixed|\yii\console\Response|\yii\web\Response
     * @throws NotFoundHttpException
     * @throws \yii\web\RangeNotSatisfiableHttpException
     */
    public function actionDownload($id, $type)
    {
        $model = $this->findModel($id);
        if ((int)$type === 2) {
            return Yii::$app->response->sendContentAsFile(
                BotsHelper::prepareSoftware($model->softwareVersion, false, $model->user_id, $model->virtual_machine_name),
                "Direct_Software_{$id}.zip");
        } else if ((int)$type === 0) {
            $tempModel = new Bots();
            $tempModel->setDefaults();
            $tempModel->extension_id = $id;
            $tempModel->thisIsTemp = true;
            return Yii::$app->response->sendContentAsFile(BotsHelper::prepareExtension($model),
                "Direct_Extension_{$id}.zip");
        }
        Yii::$app->session->setFlash('error', 'Download available only for Extension and Software!');
        return $this->actionView($id);
    }

    /**
     * Updates an existing Bots model.
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

    public function actionApplySettings($id)
    {
        $model = BotsQueue::findOne($id);
        $path = base64_decode(Yii::$app->request->post('path', ''));
        $data = empty($model->data) ? [] : json_decode($model->data, true);
        if (!empty($path) && !empty($data[$path])) {
            $res = BotsHelper::applySettingsFromFile($model, $data[$path]);
            if (empty($res)) {
                Yii::$app->session->setFlash('success', "Settings from '{$path}' were applied!");
            } else {
                Yii::$app->session->setFlash('error', implode('<br />', $res));
            }
            return 'ok';
        } else {
            return 'Wrong data!';
        }
    }

    public function actionViewSettings($id, $path)
    {
        $model = BotsQueue::findOne($id);
        $path = base64_decode($path);
        $data = empty($model->data) ? [] : json_decode($model->data, true);
        if (!empty($path) && !empty($data[$path])) {
            return VarDumper::dumpAsString(BotsHelper::parseSettingsFromFile($data[$path]), 10, true);
            //return '<pre>'.$data[$path].'</pre>';
        } else {
            return 'Something went wrong!';
        }
    }

    public function actionUpdateBk($bots_bks_id)
    {
        $model = BotsBks::findOne($bots_bks_id);
        if ($model && $model->load(Yii::$app->request->post()) && $model->save()) {
            return 'ok';
        } else {
            return 'Wrong parameters!';
        }
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

    public function actionDeleteBotAction($id)
    {
        $model = BotsQueue::findOne($id);
        try {
            if ($model && $model->delete()) {
                return 'ok';
            } else {
                return VarDumper::dumpAsString($model->getErrors());
            }
        } catch (\Exception $e) {
            return $e->getMessage();
        } catch (\Throwable $e) {
            return $e->getMessage();
        }
    }

    /**
     * Finds the Bots model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return Bots the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     * @throws AccessDeniedException if user has no rights
     */
    protected function findModel($id)
    {
        if (($model = Bots::findOne($id)) !== null) {
            $settings = new SettingsForm();
            $settings->loadData();
            if (!isset($settings->users[Yii::$app->user->id]) || $model->user_id === (int)Yii::$app->user->id) {
                return $model;
            } else {
                throw new AccessDeniedException('You\'re not allowed to view this page!');
            }
        }

        throw new NotFoundHttpException(Yii::t('BotManager', 'The requested page does not exist.'));
    }
}
