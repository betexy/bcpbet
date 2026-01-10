<?php

namespace app\modules\PaySystems\controllers;

use app\modules\PaySystems\helpers\PaySystemsHelper;
use Yii;
use yii\base\Exception;
use yii\filters\VerbFilter;
use yii\web\BadRequestHttpException;
use yii\web\Response;

class ApiController extends \yii\web\Controller
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
                    'index' => ['POST'],
                ],
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function beforeAction($action)
    {
        $this->enableCsrfValidation = false;
        try {
            return parent::beforeAction($action);
        } catch (\Exception $e) {
            echo $e->getMessage();
            return false;
        }
    }


    public function actionIndex()
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $data = json_decode(Yii::$app->request->post('data', ''), true);
        if (empty($data) || !is_array($data) || empty($data['status']) || empty($data['websocket_uid'])) {
            return ['status' => 'error', 'message' => $data];
        } else {
            return PaySystemsHelper::proceedRequest($data);
        }
    }

    /*
     * Add payment to the queue and wallet of it's not exist
     * "bm" below is a bot`s answer to BotManager
     * @param {json} $data
     * @param {string} $data['uid'] - websocket uid (bot`s uid) (bm.uid)
     * @param {string} $data['bk'] - bookie (bm.bk)
     * @param {string} $data['ps_id'] - PaySystem id (bm.data.binance_api)
     * @param {string} $data['amount'] - amount of money (bm.data.amount)
     * @param {string} $data['wallet'] - wallet address (bm.data.address)
     * @param {string} $data['login'] - bookie login (bm.data.login)0
     * @param {string} $data['email'] - email address (bm.data.email)
     * @return array
     */
    public function actionAddPayment(): array
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $data = json_decode(Yii::$app->getRequest()->getRawBody(), true);
        try {
            $from = preg_replace('|\d|','', $data['ps_id']);
            $data['ps_id'] = preg_replace('|\D|','', $data['ps_id']);
            file_put_contents(\Yii::getAlias('@runtime/logs/add_payments.log'),
                date('Y-m-d H:i:s') . " [$from]:" . PHP_EOL . var_export($data, true) . PHP_EOL, FILE_APPEND);
            $res = PaySystemsHelper::fillUpWalletFromBinance($data);
            return ['status' => 'success', 'message' => $res];
        } catch (Exception $e) {
            return ['status' => 'error', 'message' => $e->getMessage()];
        }
    }

}
