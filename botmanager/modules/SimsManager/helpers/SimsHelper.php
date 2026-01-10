<?php

namespace app\modules\SimsManager\helpers;

use Yii;
use yii\helpers\StringHelper;
use yii\helpers\VarDumper;
use app\modules\SimsManager\models\Channels;
use app\modules\SimsManager\models\Slots;
use app\modules\SimsManager\models\SlotsChannels;
use app\modules\SimsManager\models\Smses;
use app\modules\SimsManager\models\SmsesSims;
use app\modules\SimsManager\models\Actions;
use app\modules\SimsManager\models\Answers;

class SimsHelper
{

    private static $smsMapping = [
        'id' => 'receive_id',
        'srcnum' => 'scrum',
        'provid' => 'provid',
        'msg' => 'msg',
        'time' => 'time_received',
        'goipname' => 'goip_name',
        'status' => 'status',
        'smscnum' => 'smscnum',
        'senttime' => 'senttime',
    ];

    /**
     * Request currently bound channels
     * @throws \yii\base\InvalidConfigException
     */
    public static function requestBound()
    {
        foreach (Channels::find()->all() as $channel) {
            $res = self::askSimBankAbout('&get=bind&line=' . $channel->channel_id);
            $resParts = explode(' ', trim($res));
            //$channel->comment = print_r($resParts, true)." ".VarDumper::dumpAsString($resParts === 2 && (int)Slots::find()->where(['slot_id' => (int)$resParts[0]])->count() === 1);
            if ($res === '') {
                SlotsChannels::removeLinksForChannel($channel->id);
                $channel->comment = 'Nothing bound! Checked at ' . Yii::$app->formatter->asTime(time());
            } elseif (count($resParts) === 2 && (int)Slots::find()->where(['slot_id' => (int)$resParts[0]])->count() === 1) {
                $slot = Slots::find()->where(['slot_id' => (int)$resParts[0]])->one();
                $sCh = SlotsChannels::find()->where(['sims_channels_id' => $channel->id, 'deleted' => 0])->one();
                if (empty($sCh) || $sCh->slot->slot_id !== $slot->slot_id) {
                    if (!empty($sCh)) {
                        $sCh->deleted = 1;
                        $sCh->save();
                    }
                    $res = SlotsChannels::bindSlotToChannel($slot->id, $channel->id);
                    $channel->comment = $res !== true ? $res : 'Created/updated at ' . Yii::$app->formatter->asDatetime(time());
                } else {
                    $channel->comment = "Already bound " . Yii::$app->formatter->asDate($sCh->updated_at)
                        . ", checked at " . Yii::$app->formatter->asTime(time());
                }
                self::checkWaitForBound($slot);
            } else {
                $channel->comment = "Wrong res: '{$res}', or Slot not exists in the system!";
            }
            $channel->save();
        }
    }

    public static function bindSlotToChannel($slots_id, $channels_id)
    {
        $slot = Slots::findOne($slots_id);
        $channel = Channels::findOne($channels_id);
        $res = 'Slot or Channel wrong!';
        if ($slot && $channel) {
            $res = self::askSimBankAbout("&set=bind&sim={$slot->slot_id}&line={$channel->channel_id}");
        }
        return StringHelper::startsWith($res, 'OK.bind');
    }

    public static function requestSmses()
    {
        $res = self::getSmses();
        if (!is_array($res)) {
            return ['status' => 'error', 'message' => $res];
        } else {
            $errors = [];
            $added = 0;
            foreach ($res as $smsDraft) {
                $sms = new Smses();
                foreach (self::$smsMapping as $key => $field) {
                    if (!($field === 'senttime' && $smsDraft[$key] === '0000-00-00 00:00:00')) {
                        $sms->$field = $smsDraft[$key];
                    }
                }
                $channel = Channels::find()->where(['goip_sms_id' => $smsDraft['goipname']])->one();
                if (!empty($channel) && !empty($channel->sim)) {
                    $sms->sims_channels_id = $channel->id;
                    $sms->number = $channel->sim->number;
                } else {
                    $sms->number = 'UNKNOWN!';
                    $errors[] = "No bound Sim for channel '{$smsDraft['goipname']}'";
                }
                if (!$sms->save()) {
                    $errors[] = 'Error till sms save: ' . VarDumper::dumpAsString($sms->errors);
                } elseif (!empty($channel) && !empty($channel->sim)) {
                    $added++;
                    self::createAnswerForSMS($channel->id, $sms);
                    $smsesSims = new SmsesSims();
                    $smsesSims->sims_sims_id = $channel->sim->id;
                    $smsesSims->sims_smses_id = $sms->id;
                    $smsesSims->deleted = 0;
                    $smsesSims->save();
                }
            }
            return ['status' => empty($errors) ? 'success' : 'error',
                'message' => empty($errors) ? "{$added} SMSs were added!" : implode(', ', $errors)];
        }
    }

    public static function releaseLongBounds()
    {
        $longs = Actions::find()->where(['active' => 1])
            ->andWhere(['or',
                ['and', ['is', 'bound_at', new \yii\db\Expression('null')], ['<=', 'created_at', time() - 1000]],
                ['and', ['is not', 'bound_at', new \yii\db\Expression('null')], ['<=', 'bound_at', time() - 1000]]
            ])
            ->all();
        //VarDumper::dump($longs->createCommand()->getRawSql());
        $released = [];

        $released[] = Actions::find()->where(['active' => 1])
            ->andWhere(['or',
                ['and', ['is', 'bound_at', new \yii\db\Expression('null')], ['<=', 'created_at', time() - 1000]],
                ['and', ['is not', 'bound_at', new \yii\db\Expression('null')], ['<=', 'bound_at', time() - 1000]]
            ])->createCommand()->rawSql;

        foreach ($longs as $long) {
            /**
             * @var Actions $long
             */
            $long->released_at = time();
            $long->active = 0;
            $long->finished = 1;
            if (!$long->save()) {
                echo 'Error save Answers: ' . VarDumper::dumpAsString($long->errors);
            } else {
                $released[] = $long->channels->channel_id;
            }
        }
        return $released;
    }

    private static function checkWaitForBound(Slots $slot)
    {
        if (!empty($slot->sim)) {
            $inQueue = Actions::find()->where(['active' => 1, 'in_queue' => 1, 'sims_sims_id' => $slot->sim->id])->one();
            if (!empty($inQueue)) {
                $inQueue->in_queue = 0;
                $inQueue->bound_at = time();
                $inQueue->save();
                $answer = new Answers();
                $answer->sent_at = 0;
                $answer->sims_requests_id = $inQueue->sims_requests_id;
                $answer->command = 'BOUND';
                $answer->content = json_encode(['m' => "Number {$slot->sim->number} bound to channel!"]);
                if (!$answer->save()) {
                    echo 'Error save Answers: ' . VarDumper::dumpAsString($answer->errors);
                }
            }
        }
    }

    private static function createAnswerForSMS($channel_id, Smses $sms)
    {
        $action = Actions::find()->where(['active' => 1, 'sims_channels_id' => $channel_id])->one();
        if (!empty($action)) {
            $answer = new Answers();
            $answer->sent_at = 0;
            $answer->sims_requests_id = $action->sims_requests_id;
            $answer->command = 'SMS';
            $answer->content = json_encode(['m' => $sms->msg, 'sender' => $sms->scrum, 'smses_id' => $sms->id]);
            if (!$answer->save()) {
                echo 'Error save Answers 2: ' . VarDumper::dumpAsString($answer->errors);
            }
        }
    }

    private static function getSmses()
    {
        $ch = curl_init(Yii::$app->controller->module->GOIPUrl);
        curl_setopt($ch, CURLOPT_USERPWD, Yii::$app->controller->module->apiBasicAuth);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, [
            'username' => Yii::$app->controller->module->GOIPLoginPassword['username'],
            'password' => Yii::$app->controller->module->GOIPLoginPassword['password'],
            'id' => Smses::find()->max('receive_id'),
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
        $parsed = json_decode($res, true);
        if (!empty($parsed) && !empty($parsed['status']) && is_array($parsed['data'])) {
            return $parsed['data'];
        } else {
            return "Wrong result: {$res}";
        }
        //file_put_contents(dirname(__FILE__) . '/../../../SB.log', $res . "\n\r", FILE_APPEND);
    }

    private static function askSimBankAbout($request)
    {
        $auth = base64_encode(Yii::$app->controller->module->apiBasicAuth);
        $context = stream_context_create([
            "http" => [
                "header" => "Authorization: Basic {$auth}"
            ]
        ]);
        $res = file_get_contents(Yii::$app->controller->module->apiUrl . $request, false, $context);
        //file_put_contents(dirname(__FILE__) . '/../../../SB.log', $res . "\n\r", FILE_APPEND);
        return $res;
    }

}