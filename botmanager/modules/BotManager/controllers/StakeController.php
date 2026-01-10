<?php

namespace app\modules\BotManager\controllers;

use app\modules\BotManager\models\SettingsForm;
use app\modules\BotManager\models\StakeAccountsCreateForm;
use Yii;
use app\modules\BotManager\models\StakeAccounts;
use app\modules\BotManager\models\StakeAccountsSearch;
use yii\db\Exception;
use yii\db\StaleObjectException;
use yii\helpers\VarDumper;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;

/**
 * StakeController implements the CRUD actions for StakeAccounts model.
 */
class StakeController extends Controller
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
     * Lists all StakeAccounts models.
     * @return mixed
     * @throws Exception
     */
    public function actionIndex()
    {
        $searchModel = new StakeAccountsSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);
        $dataProvider->query->andWhere(['stake_accounts.deleted' => 0]);
        $dataProvider->sort->attributes['mailbox'] = [
            'asc' => ['e_mailboxes.address' => SORT_ASC],
            'desc' => ['e_mailboxes.address' => SORT_DESC],
        ];
        $dataProvider->sort->attributes['proxy'] = [
            'asc' => ['proxies.host' => SORT_ASC],
            'desc' => ['proxies.host' => SORT_DESC],
        ];
        $dataProvider->sort->attributes['wallet'] = [
            'asc' => ['wallets.deposit_address' => SORT_ASC],
            'desc' => ['wallets.deposit_address' => SORT_DESC],
        ];

        $form = new StakeAccountsCreateForm();
        if ($form->load(Yii::$app->request->post()) && $form->validate() && $form->createAccounts()) {
            Yii::$app->session->setFlash('success', "Created {$form->createdAccounts} accounts!");
            return $this->redirect(['index']);
        }

        $settings = new SettingsForm();
        $settings->loadData();
        $form->binanceApiId = $settings->default_pay_system;
        $form->browser = $settings->default_browser;

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
            'model' => $form,
            'deleted' => false,
        ]);
    }

    /**
     * Lists all deleted StakeAccounts models.
     * @return mixed
     * @throws Exception
     */
    public function actionDeleted()
    {
        $searchModel = new StakeAccountsSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);
        $dataProvider->query->andWhere(['stake_accounts.deleted' => 1]);
        $dataProvider->sort->attributes['mailbox'] = [
            'asc' => ['e_mailboxes.address' => SORT_ASC],
            'desc' => ['e_mailboxes.address' => SORT_DESC],
        ];

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
            'model' => null,
            'deleted' => true,
        ]);
    }

    /**
     * Displays a single StakeAccounts model.
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
     * Updates an existing StakeAccounts model.
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
     * @throws NotFoundHttpException
     */
    public function actionClear($id): \yii\web\Response
    {
        $model = $this->findModel($id);
        $model->registered_at = null;
        $model->comment = null;
        if ($model->save()) {
            Yii::$app->session->setFlash('success', "Account cleared!");
        } else {
            Yii::$app->session->setFlash('error',  VarDumper::dumpAsString($model->getErrorSummary(true)));
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
     * Finds the StakeAccounts model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return StakeAccounts the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = StakeAccounts::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('BotManager', 'The requested page does not exist.'));
    }
}
