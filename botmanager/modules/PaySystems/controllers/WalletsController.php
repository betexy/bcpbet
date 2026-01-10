<?php

namespace app\modules\PaySystems\controllers;

use app\modules\BotManager\models\BotsQueue;
use app\modules\BotManager\models\SettingsForm;
use app\modules\PaySystems\helpers\CryptoHelper;
use app\modules\PaySystems\models\History;
use app\modules\PaySystems\models\PaysystemsQueue;
use Yii;
use app\modules\PaySystems\models\Wallets;
use app\modules\PaySystems\models\WalletsSearch;
use yii\data\ActiveDataProvider;
use yii\db\StaleObjectException;
use yii\helpers\ArrayHelper;
use yii\helpers\VarDumper;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;
use app\modules\PaySystems\models\Paysystems;

/**
 * WalletsController implements the CRUD actions for Wallets model.
 */
class WalletsController extends Controller
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
     * Lists all Wallets models.
     * @return mixed
     */
    public function actionIndex()
    {
        $searchModel = new WalletsSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);
        $dataProvider->query->andWhere(['wallets.deleted' => 0]);
        $dataProvider->sort->attributes['mailbox'] = [
            'asc' => ['e_mailboxes.address' => SORT_ASC],
            'desc' => ['e_mailboxes.address' => SORT_DESC],
        ];
        $dataProvider->sort->attributes['balance'] = [
            'asc' => ['withdrawal_balance_usdt' => SORT_ASC],
            'desc' => ['withdrawal_balance_usdt' => SORT_DESC],
        ];
        $dataProvider->sort->attributes['stakeAccount'] = [
            'asc' => ['stake_accounts.name' => SORT_ASC],
            'desc' => ['stake_accounts.name' => SORT_DESC],
        ];

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
        ]);
    }

    /**
     * Displays a single Wallets model.
     * @param string $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionView(string $id)
    {
        $model = $this->findModel($id);
        return $this->render('view', [
            'model' => $model,
            'queueDataProvider' => new ActiveDataProvider([
                'query' => BotsQueue::find()->andFilterWhere(['bots_id' => $model->id, 'bot_class' => 'Wallets']),
                'pagination' => [
                    'pageSize' => 10,
                ],
                'sort' => ['defaultOrder' => ['id' => SORT_DESC]]
            ]),
        ]);
    }

    /**
     * Creates a new Wallets model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return mixed
     */
    public function actionCreate()
    {
        $model = new Wallets();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('create', [
            'model' => $model,
        ]);
    }

    /**
     * @throws NotFoundHttpException
     */
    public function actionCreateAddress($id): \yii\web\Response
    {
        $model = $this->findModel($id);
        try {
            CryptoHelper::createAddress($model);
        } catch (\Exception $e) {
            Yii::$app->session->setFlash('error', $e->getMessage());
            return $this->redirect(['view', 'id' => $model->id]);
        }
        Yii::$app->session->setFlash('success', "Withdrawal address created!");
        return $this->redirect(['view', 'id' => $model->id]);
    }

    /**
     * @throws NotFoundHttpException
     */
    public function actionGetBalances($id): \yii\web\Response
    {
        $model = $this->findModel($id);
        try {
            CryptoHelper::getBalances($model);
        } catch (\Exception $e) {
            Yii::$app->session->setFlash('error', $e->getMessage());
            return $this->redirect(['view', 'id' => $model->id]);
        }
        Yii::$app->session->setFlash('success', "Balance refreshed!");
        return $this->redirect(['view', 'id' => $model->id]);
    }

    /**
     * @throws NotFoundHttpException
     */
    public function actionSendMoney($id)
    {
        $data = Yii::$app->request->post();
        if (empty($data) || empty($data['address']) || empty($data['amount'])) {
            Yii::$app->session->setFlash('error', "Address or amount is empty!");
            Yii::$app->session->setFlash('error', "Address or amount is empty!");
            return $this->redirect(['view', 'id' => $id]);
        }
        if ((float)$data['amount'] <= 0) {
            Yii::$app->session->set('data', $data);
            Yii::$app->session->setFlash('error', "Amount must be greater than 0!");
            return $this->redirect(['view', 'id' => $id]);
        }
        if (strlen($data['address']) !== 42) {
            Yii::$app->session->set('data', $data);
            Yii::$app->session->setFlash('error', "It seems like address is not valid!");
            return $this->redirect(['view', 'id' => $id]);
        }
        Yii::$app->session->set('data', []);
        $model = $this->findModel($id);
        try {
            $res = CryptoHelper::sendMoney($model, $data['address'], $data['amount'], $data['currency']);
        } catch (\Exception $e) {
            Yii::$app->session->setFlash('error', $e->getMessage());
            return $this->redirect(['view', 'id' => $model->id]);
        }
        Yii::$app->session->setFlash('success', "txid: {$res}");
        return $this->redirect(['view', 'id' => $model->id]);

    }

    /**
     * Updates an existing Wallets model.
     * If update is successful, the browser will be redirected to the 'view' page.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionUpdate($id)
    {
        $model = $this->findModel($id);
        if ($model->deleted) {
            Yii::$app->session->setFlash('error', "Wallet is deleted!");
            return $this->redirect(['view', 'id' => $model->id]);
        }
        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['view', 'id' => $model->id]);
        }

        return $this->render('update', [
            'model' => $model,
        ]);
    }

    /**
     * Deletes an existing Wallets model.
     * If deletion is successful, the browser will be redirected to the 'index' page.
     * @param integer $id
     * @return mixed
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionDelete($id)
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
     * @throws StaleObjectException
     * @throws \Throwable
     */
    public function actionDeleteBotQueue($id): \yii\web\Response
    {
        $model = BotsQueue::findOne($id);
        if ($model->deleted) {
            $model->deleted = 0;
            $model->save();
        } else {
            $model->delete();
        }
        return $this->redirect(['view', 'id' => $model->wallet->id]);
    }

    public function actionWithdrawal()
    {
        $model = new History();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['history/view', 'id' => $model->id, 'wallets' => true]);
        }

        return $this->render('withdrawal', [
            'paySystems' => ArrayHelper::map(Paysystems::find()->where(['type' => 5])->orderBy('login')->all(), 'id', 'login'),
            'model' => $model,
        ]);
    }

    /**
     * @throws NotFoundHttpException
     */
    public function actionQuickWithdrawal($id)
    {
        $settings = new SettingsForm();
        $settings->loadData();
        $m = $this->findModel($id);
        $h = new History();
        $h->ps_paysystems_id = $settings->default_pay_system;
        $h->receiver = $m->deposit_address;
        $h->datetime = time();
        $h->datetime_string = date('Y-m-d H:i:s');
        $h->currency = $settings->default_currency;
        if ($h->load(Yii::$app->request->post()) && $h->save()) {
            return $this->redirect(['history/view', 'id' => $h->id, 'wallets' => true]);
        } else {
            if ($h->getErrors()) {
                $errors = $h->getErrorSummary(true);
            } else {
                $errors = ['No model errors, but no success!'];
            }
            Yii::$app->session->setFlash('error', implode('; ', $errors));
        }
        return $this->redirect(['index',]);
    }

    public function actionWalletWithdrawal(int $id): \yii\web\Response
    {
        $amount = (int)Yii::$app->request->post('amount', '0');
        list ($success, $message) = BotsQueue::createStakeWithdrawal($id, $amount);
        Yii::$app->session->setFlash($success ? 'success' : 'error', $message);
        return $this->redirect(['view', 'id' => $id,]);
    }

    /**
     * Finds the Wallets model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param integer $id
     * @return Wallets the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        if (($model = Wallets::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('pay-systems', 'The requested page does not exist.'));
    }
}
