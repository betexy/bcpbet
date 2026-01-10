<?php

namespace app\modules\Emails\controllers;

use app\controllers\BaseController;
use app\modules\Emails\helpers\imap\Exception;
use app\modules\Emails\helpers\MailHelper;
use Yii;
use app\modules\Emails\models\Emails;
use app\modules\Emails\models\EmailsSearch;
use yii\db\StaleObjectException;
use yii\filters\AccessControl;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;

/**
 * EmailsController implements the CRUD actions for Emails model.
 */
class EmailsController extends BaseController
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
                    'bulk' => ['POST'],
                    'delete' => ['POST'],
                ],
            ],
        ];
    }

    /**
     * Lists all Emails models.
     * @return mixed
     */
    public function actionIndex()
    {
        $searchModel = new EmailsSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);
        $dataProvider->sort->defaultOrder = ['id' => SORT_DESC];
        $dataProvider->pagination->pageSize = 50;

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    public function actionBulk()
    {
        $action = Yii::$app->request->post('action');
        $selection = (array)Yii::$app->request->post('selection');
        $results = [];
        foreach ($selection as $id) {
            if (!empty($action) && $action === 'Delete') {
                $model = Emails::findOne($id);
                if (empty($model)) {
                    $results[] = "ERROR email {$id} not found!";
                }
                $res = MailHelper::deleteEmail($model);
                if ($res === true) {
                    try {
                        $model->delete();
                        $results[] = "Email {$id} deleted!";
                    } catch (\Exception $e) {
                        $results[] = "ERROR {$id}: {$e->getMessage()}";
                    } catch (\Throwable $t) {
                        $results[] = "ERROR {$id}: {$t->getMessage()}";
                    }
                } else {
                    $results[] = "ERROR {$id}: {$res}";
                }
            }
        }
        if (empty($results)) {
            $results[] = 'Nothing!';
        }
        Yii::$app->session->setFlash('success', implode("\r\n", $results));
        return $this->redirect(['emails/index']);
    }

    /**
     * Displays a single Emails model.
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
     * @param $id
     * @return string
     * @throws NotFoundHttpException
     */
    public function actionShowBody($id)
    {
        $model = $this->findModel($id);
        if ($model) {
            Yii::$app->response->format = Yii::$app->response::FORMAT_RAW;
            return empty($model->text_html) ? $model->text_plain : $model->text_html;
            //Yii::$app->response->content = empty($model->text_plain) ? $model->text_html : $model->text_plain;
            //Yii::$app->response->send();
        }
    }

    /**
     * Creates a new Emails model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new Emails();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    /**
     * Updates an existing Emails model.
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
     * Deletes an existing Emails model.
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
     * Finds the Emails model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return Emails the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = Emails::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('Emails', 'The requested page does not exist.'));
    }
}
