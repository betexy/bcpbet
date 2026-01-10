<?php

namespace app\modules\SimsManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;
use yii\db\ActiveRecord;
use yii\helpers\ArrayHelper;
use yii\helpers\VarDumper;
use app\modules\SimsManager\helpers\SimsHelper;
use app\modules\BotManager\models\Bots;

/**
 * This is the model class for table "{{%sims_actions}}".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property int $sims_requests_id
 * @property int $active
 * @property int $in_queue
 * @property int $finished
 * @property int $sims_sims_id
 * @property int $sims_channels_id
 * @property int $bound_at
 * @property int $released_at
 *
 * @property Channels $channels
 * @property Requests $requests
 * @property Sims $sims
 */
class Actions extends ActiveRecord
{

    static public $actions = [
        'BIND_HOLD' => 'Bind number to GoIP',
        'CHECK' => 'Check bind / SMS',
        'HISTORY' => 'History for request',
        'BIND_RELEASE' => 'Release number from GoIP',
    ];

    static private $debug = [];

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%sims_actions}}';
    }

    /**
     * @inheritdoc
     */
    public function behaviors()
    {
        return [
            TimestampBehavior::class,
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['sims_requests_id'], 'required'],
            [['created_at', 'updated_at', 'sims_requests_id', 'active', 'in_queue', 'finished',
                'sims_sims_id', 'sims_channels_id', 'bound_at', 'released_at'], 'integer'],
            [['sims_channels_id'], 'exist', 'skipOnError' => true, 'targetClass' => Channels::class, 'targetAttribute' => ['sims_channels_id' => 'id']],
            [['sims_requests_id'], 'exist', 'skipOnError' => true, 'targetClass' => Requests::class, 'targetAttribute' => ['sims_requests_id' => 'id']],
            [['sims_sims_id'], 'exist', 'skipOnError' => true, 'targetClass' => Sims::class, 'targetAttribute' => ['sims_sims_id' => 'id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('SimsManager', 'ID'),
            'created_at' => Yii::t('SimsManager', 'Created At'),
            'updated_at' => Yii::t('SimsManager', 'Updated At'),
            'sims_requests_id' => Yii::t('SimsManager', 'Sims Requests ID'),
            'active' => Yii::t('SimsManager', 'Active'),
            'in_queue' => Yii::t('SimsManager', 'In Queue'),
            'finished' => Yii::t('SimsManager', 'Finished'),
            'sims_sims_id' => Yii::t('SimsManager', 'Sims Sims ID'),
            'sims_channels_id' => Yii::t('SimsManager', 'Sims Channels ID'),
            'bound_at' => Yii::t('SimsManager', 'Bound At'),
            'released_at' => Yii::t('SimsManager', 'Released At'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getChannels()
    {
        return $this->hasOne(Channels::class, ['id' => 'sims_channels_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getRequests()
    {
        return $this->hasOne(Requests::class, ['id' => 'sims_requests_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSims()
    {
        return $this->hasOne(Sims::class, ['id' => 'sims_sims_id']);
    }

    public static function checkSimIsInActiveAction(Sims $sim)
    {
        return (int)Actions::find()->where(['active' => 1, 'sims_sims_id' => $sim->id])->count() > 0;
    }

    /**
     * @param Requests $request
     * @param array $data
     * @return array
     */
    public static function proceedAction(Requests $request, array $data)
    {
        self::$debug = [];
        if ($request->command === 'BIND_HOLD') {
            $res = self::actionBindHold($request, $data);
        } else if ($request->command === 'BIND_RELEASE') {
            $res = self::actionBindRelease($data);
        } else if ($request->command === 'CHECK') {
            $res = self::sendAnswers($data['request_id']);
        } else if ($request->command === 'HISTORY') {
            $res = self::sendAnswers($data['request_id'], true);
        } else {
            $res = ['status' => 'error', 'message' => "Unknown command: {$request->command}"];
        }
        if (!empty(self::$debug)) {
            $res['debug'] = self::$debug;
        }
        return $res;
    }

    /**
     * @param $post
     * @return array|string
     * @throws \yii\web\NotFoundHttpException
     */
    public static function checkRequestData($post)
    {
        if (empty($post['action']) || empty($post['data'])) {
            throw new \yii\web\NotFoundHttpException("There's no Action or Data");
        }
        $data = json_decode($post['data'], true);
        if ($post['action'] === 'BIND_HOLD' && empty($data['number'])) {
            return 'No number!';
        }
        if (in_array($post['action'], ['BIND_RELEASE', 'CHECK']) && empty($data['request_id'])) {
            return 'No request_id!';
        }
        if (empty($data['websocket_uid'])) {
            return 'No UID!';
        }
        /*
        $bot = Bots::findOne(['websocket_uid' => $data['websocket_uid']]);
        if (empty($bot)) {
            return "Bot with uid '{$data['websocket_uid']}' not found!";
        }
        */
        $data['bm_bots_id'] = 45;
        return $data;
    }

    private static function sendAnswers($request_id, $history = false)
    {
        $request = Requests::findOne($request_id);
        if (empty($request)) {
            return ['status' => 'error', 'message' => "Request ID {$request_id} not found!"];
        }
        if (empty($request->actions[0])) {
            return ['status' => 'error', 'message' => "Request ID {$request_id} has no actions!"];
        }
        if (!$history && empty($request->actions[0]->active)) {
            return ['status' => 'error', 'message' => "Request ID {$request_id} / {$request->actions[0]->id} NOT active!"];
        }
        $result = [];
        $condition = ['sims_requests_id' => $request_id];
        if (!$history) {
            $condition['sent_at'] = 0;
        }
        $answers = Answers::findAll($condition);
        foreach ($answers as $answer) {
            $result[] = [
                'command' => $answer->command,
                'content' => json_decode($answer->content),
            ];
            if (!$history) {
                $answer->sent_at = time();
                $answer->save();
            }
        }
        return ['status' => 'success', 'message' => $result];
    }

    private static function actionBindRelease(array $data)
    {
        $request = Requests::findOne($data['request_id']);
        if (empty($request)) {
            $result = ['status' => 'error', 'message' => "Request with id {$data['request_id']} not found :("];
        } elseif (empty($request->actions)) {
            $result = ['status' => 'error', 'message' => "Request {$data['request_id']} has no actions :("];
        } else {
            $action = $request->actions[0];
            if (!empty($action->finished) && empty($action->active)) {
                // Hint: IS finished and NOT active
                $result = ['status' => 'success', 'message' => "Action {$action->id} already finished ;)"];
            } elseif (empty($action->finished) && empty($action->active)) {
                // Hint: NOT finished and NOT active - may be freezing or overbound
                $action->finished = 1;
                $result = self::saveActionRS($action, 'was not active, now finished...', 'not active, but save error:');
            } elseif (empty($action->finished) && !empty($action->active)) {
                // Hint: NOT finished and IS active - normal way
                $action->finished = 1;
                $action->active = 0;
                $action->released_at = time();
                $result = self::saveActionRS($action, 'successfully released!', 'save error:');
            } elseif (!empty($action->finished) && !empty($action->active)) {
                // Hint: IS finished and IS active - bug
                $action->active = 0;
                $action->released_at = time();
                $result = self::saveActionRS($action, 'was finished, but active! Released', 'save error:');
            } else {
                $result = ['status' => 'error', 'message' => "Very-very strange situation..."];
            }
        }
        return $result;
    }

    private static function saveActionRS(Actions $action, $successMessage, $errorMessage)
    {
        if ($action->save()) {
            $result = ['status' => 'success', 'message' => "Action {$action->id} {$successMessage}"];
        } else {
            $result = ['status' => 'error', 'message' => "Action {$action->id} {$errorMessage} "
                . VarDumper::dumpAsString($action->errors)];
        }
        return $result;
    }

    /**
     * @param Requests $request
     * @param array $data
     * @return array
     */
    private static function actionBindHold(Requests $request, array $data)
    {
        self::$debug[] = 'Released longs: ' . implode(', ', SimsHelper::releaseLongBounds());
        $res = Actions::bindChannelForRequest($request, $data);
        if ($res === false) {
            $result = ['status' => 'reject', 'message' => 'There is no free channels at this time!'];
        } elseif ($res === true) {
            $result = ['status' => 'success', 'message' => $request->id];
        } else {
            $result = ['status' => 'error', 'message' => $res];
        }
        return $result;
    }

    /**
     * @param Requests $request
     * @param array $data
     * @return bool|string
     */
    private static function bindChannelForRequest(Requests $request, array $data)
    {
        $sim = Sims::getByNumberAndCheckSlot(strpos($data['number'], '+') === false ? "+{$data['number']}" : $data['number']);
        if (!$sim instanceof Sims) {
            return $sim;
        }
        // Check we have this already bound
        if (Channels::checkSimIsBound($sim) || self::checkSimIsInActiveAction($sim)) {
            return 'Number is bound! Rebound is impossible!';
        }
        // If we have not free channels - reject
        $freeChannels = Channels::getFreeChannels();
        self::$debug[] = 'Free channels: ' . implode(', ', ArrayHelper::map($freeChannels, 'id', 'channel_id'));
        if (empty($freeChannels)) {
            return false;
        }
        // Reserve channel
        $channel = $freeChannels[0];
        $res = SimsHelper::bindSlotToChannel($sim->slot->id, $channel->id);
        if ($res === true) {
            // Store action
            $action = new Actions();
            $action->sims_requests_id = $request->id;
            $action->active = 1;
            $action->in_queue = 1;
            $action->finished = 0;
            $action->sims_sims_id = $sim->id;
            $action->sims_channels_id = $channel->id;
            if (!$action->save()) {
                return 'It seems to be bound, but error saving Action occurs: ' . VarDumper::dumpAsString($action->errors);
            } else {
                self::$debug[] = "Action ({$action->id}) created to request ({$request->id}) / channel ({$channel->channel_id})";
                return true;
            }
        } else {
            return "Something went wrong till bound: {$res}";
        }
    }

}
