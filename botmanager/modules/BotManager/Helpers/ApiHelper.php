<?php

namespace app\modules\BotManager\Helpers;

use app\modules\BotManager\models\Bots;
use Yii;
use yii\helpers\VarDumper;

class ApiHelper
{
    public $user;
    public $userId;
    public $id;

    public function __construct()
    {

    }

    /**
     * @param $params
     * @return array|string
     * @throws \yii\web\NotFoundHttpException
     */
    public function runWithParams($params)
    {
        $post = Yii::$app->request->post();
        if (!empty($post['uid']) && !empty($post['action'])) {
            Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
            return Bots::botRequest($post, $this->userId, Yii::$app->request->remoteIP);
        } else {
            throw new \yii\web\NotFoundHttpException;
        }
    }

    public function getUniqueId()
    {
        return 'AbraCadabra'.$this->user;
    }

}