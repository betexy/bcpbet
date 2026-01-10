<?php

namespace app\modules\Emails\controllers;

use app\controllers\BaseController;
use app\modules\Emails\helpers\MailHelper;
use Yii;
use app\modules\Emails\models\Mailboxes;
use app\modules\Emails\models\MailboxesSearch;
use yii\filters\AccessControl;
use yii\helpers\ArrayHelper;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;
use yii\web\UploadedFile;

/**
 * MailboxesController implements the CRUD actions for Mailboxes model.
 */
class MailboxesController extends BaseController
{

    /**
     * @inheritdoc
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
     * @return string
     * @throws \ReflectionException
     */
    public function actionIndex()
    {
        $searchModel = new MailboxesSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    public function actionCheckMail($id)
    {
        try {
            $result = MailHelper::checkMail($id);
        } catch (\Exception $e) {
            $result = ['success' => false, 'message' => $e->getMessage()];
        }
        if (!$result['success']) {
            Yii::$app->session->setFlash('error', $result['message']);
        } else {
            Yii::$app->session->addFlash('success', 'New messages saved: ' . count($result['message']['success']));
            foreach ($result['message']['error'] as $err) {
                Yii::$app->session->addFlash('error', $err);
            }
        }
        return $this->redirect(['mailboxes/view', 'id' => $id]);
    }

    public function actionCheckAll()
    {
        $all = Mailboxes::find()->all();
        foreach ($all as $mailbox) {
            set_time_limit(777);
            $result = MailHelper::checkMail($mailbox->id);
            if (!$result['success']) {
                Yii::$app->session->addFlash('error', $mailbox->address . ': ' . $result['message']);
            } else {
                Yii::$app->session->addFlash('success', $mailbox->address . ': New messages saved: ' . count($result['message']['success']));
                foreach ($result['message']['error'] as $err) {
                    Yii::$app->session->addFlash('error', $mailbox->address . ': ' . $err);
                }
            }
        }
        return $this->redirect(['mailboxes/index']);
    }

    public function actionAnalyze($id)
    {
        if ($id === 'all') {
            $ids = ArrayHelper::map(Mailboxes::find()->all(), 'id', 'id');
        } else {
            $ids = [$id => $id];
        }
        $result = 0;
        foreach ($ids as $id) {
            if (MailHelper::analyzeMailbox($id)) {
                $result++;
            }
        }
        Yii::$app->session->addFlash('success', "Successfully analyzed {$result} mailboxes!");
        if (count($ids) === 1) {
            return $this->redirect(['mailboxes/view', 'id' => $id]);
        } else {
            return $this->redirect(['mailboxes/index']);
        }
    }

    public function actionFolders($id)
    {

        $res = MailHelper::getFolders($id);
        Yii::$app->session->addFlash(($res['success'] === true ? 'success' : 'error'), $res['message']);
        return $this->redirect(['mailboxes/view', 'id' => $id]);
    }

    /**
     * Displays a single Mailboxes model.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionView($id)
    {
        return $this->render('view', [
            'model' => $this->findModel($id),
            'types' => Mailboxes::$types
        ]);
    }

    /**
     * Creates a new Mailboxes model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new Mailboxes();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    /**
     * Updates an existing Mailboxes model.
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
     * Deletes an existing Mailboxes model.
     * If deletion is successful, the browser will be redirected to the 'index' page.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionDelete($id)
    {
        $model = $this->findModel($id);
        foreach ($model->emails as $email) {
            $email->delete();
        }
        $model->delete();

        return $this->redirect(['index']);
    }

    public function actionImport(): \yii\web\Response
    {
        if (Yii::$app->request->isPost) {
            $type = (int)Yii::$app->request->post('type', -1);
            if ($type < 0) {
                Yii::$app->getSession()->setFlash('error',  'No type selected!');
            } else {
                Yii::$app->getSession()->setFlash('success', `Type is '{$type}'`);
                $file = UploadedFile::getInstanceByName('file_import');
                if ($file) {
                    $content = file_get_contents($file->tempName);
                    $lines = explode("\n", $content);
                    $inserted = 0;
                    foreach ($lines as $line) {
                        $parts = array_map(function ($r) {
                            return trim($r);
                        }, explode(';', $line));
                        if (!Mailboxes::findOne(['address' => $parts[0], 'login' => $parts[0], 'password' => $parts[1], 'type' => 3])) {
                            $current = new Mailboxes();
                            $current->address = $parts[0];
                            $current->type = $type;
                            $current->login = $parts[0];
                            $current->password = $parts[1];
                            if (!$current->save()) {
                                Yii::$app->getSession()->setFlash('error', 'Error: ' . $current->getFirstError('value'));
                                return $this->redirect(['index']);
                            }
                            $inserted++;
                        }
                    }
                    Yii::$app->getSession()->setFlash('success',
                        "Successfully imported $inserted mailboxes");
                } else {
                    Yii::$app->getSession()->setFlash('error', 'No file!');
                }
            }
        } else {
            Yii::$app->getSession()->setFlash('error', 'Not POST method!');
        }
        return $this->redirect(['index']);
    }

    /**
     * Finds the Mailboxes model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return Mailboxes the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = Mailboxes::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('Emails', 'The requested page does not exist.'));
    }
}
