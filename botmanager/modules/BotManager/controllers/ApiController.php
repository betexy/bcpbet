<?php

namespace app\modules\BotManager\controllers;

use app\modules\BotManager\Helpers\BotsHelper;
use app\modules\BotManager\models\Bots;
use app\modules\BotManager\models\BotsQueue;
use app\modules\BotManager\models\BuyerQueue;
use app\modules\BotManager\models\FileGroups;
use app\modules\BotManager\models\MarginReport;
use app\modules\BotManager\models\PsCodes;
use app\modules\BotManager\models\Report;
use app\modules\BotManager\models\SettingsForm;
use app\modules\BotManager\models\Xbots;
use Exception;
use Yii;
use yii\console\Response;
use yii\filters\VerbFilter;
use yii\helpers\Json;
use yii\web\NotFoundHttpException;
use yii\web\RangeNotSatisfiableHttpException;

class ApiController extends \yii\web\Controller
{

    public function actions()
    {
        static $actions;
        if (empty($actions)) {
            $settings = new SettingsForm();
            $settings->loadData();
            $actions = [];
            if (is_array($settings->users)) {
                foreach ($settings->users as $id => $slug) {
                    $actions[$slug] = [
                        'class' => 'app\modules\BotManager\Helpers\ApiHelper',
                        'user' => $slug,
                        'userId' => $id
                    ];
                }
            }
        }
        return $actions;
    }

    /**
     * {@inheritdoc}
     */
    public function behaviors()
    {
        return [
            'verbs' => [
                'class' => VerbFilter::class,
                'actions' => [
                    'bb_bot' => ['POST'],
                ],
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function beforeAction($action)
    {
        Yii::$app->response->format = \yii\web\Response::FORMAT_RAW;
        $this->enableCsrfValidation = false;
        try {
            return parent::beforeAction($action);
        } catch (Exception $e) {
            echo $e->getMessage();
            return false;
        }
    }

    /**
     * @return array
     * @throws NotFoundHttpException
     */
    public function actionIndex()
    {
        throw new NotFoundHttpException;
        /*
        $post = Yii::$app->request->post();
        if (!empty($post['uid']) && !empty($post['action'])) {
            Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
            return Bots::botRequest($post, '');
        } else {
            throw new \yii\web\NotFoundHttpException;
        }
        */
    }

    /**
     * @param $id
     * @param $type
     * @return Response|\yii\web\Response
     * @throws NotFoundHttpException
     * @throws RangeNotSatisfiableHttpException
     * @throws \SodiumException
     */
    public function actionGetFile($id, $type)
    {
        if ($id && in_array($type, ['software', 'extension', 'file_group'])) {
            $model = $type === 'file_group' ? FileGroups::findOne($id) : Bots::findOne($id);
            if ($type === 'software') {
                return Yii::$app->response->sendContentAsFile(BotsHelper::prepareSoftware($model->softwareVersion, true),
                    $model->softwareVersion->code . '.zip');
            } else if ($type === 'extension') {
                return Yii::$app->response->sendContentAsFile(BotsHelper::prepareExtension($model), 'extension.zip');
            } else if ($type === 'file_group' && !empty($model->files[0])) {
                return Yii::$app->response->sendFile($model->files[0]->file_path . $model->files[0]->file_name, $model->files[0]->source_name);
            } else {
                throw new NotFoundHttpException;
            }
        } else {
            throw new NotFoundHttpException;
        }
    }

    public function actionAddToXbots($params)
    {
        $params = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $params)), true);
        $xbot = Xbots::findOne(['betexy_bot_id' => $params['betexy_bot_id'], 'betexy_user_id' => $params['betexy_user_id']]);
        $dt = new \DateTime();
        $addDays = empty($params['add_days']) ? 7 : $params['add_days'];
        $dt->modify("+$addDays days");
        if (empty($xbot)) {
            $xbot = new Xbots();
            $xbot->name = $params['name'];
            $xbot->bookie = $params['bookie'];
            $xbot->betexy_bot_id = $params['betexy_bot_id'];
            $xbot->betexy_user_id = $params['betexy_user_id'];
            $xbot->active = 1;
            $xbot->due_date = $dt->format('Y-m-d');
        } else {
            $xbot->active = 1;
            $xbot->due_date = $dt->format('Y-m-d');
        }
        $xbot->save();
        return json_encode(['id' => $xbot->id, 'name' => $xbot->name, 'due_date' => $xbot->due_date]);
    }

    /**
     * @param $params
     * @param string $abrah = ''
     * @param string $testing = ''
     * @param int $id = 0
     * @param int $obf = 0
     * @return Response|\yii\web\Response
     * @throws NotFoundHttpException
     * @throws RangeNotSatisfiableHttpException
     * @throws \SodiumException
     */
    public function actionGetExtension($params, string $abrah = '', string $testing = 'false', int $id = 0, int $obf = 0)
    {
        /*
        echo base64_encode(json_encode([
            // hint: new param
            'betexy_bot_id' => ID of the bot in the betexy
            // hint: new param
            'with_console' => whether enable console when obfuscating
            'bk' => '1XBET',
            'login' => 'test',
            'password' => 'test',
            'phone' => '1231231231',
            'uid' => 'dfhsdkfjh',
            'ws_url' => 'ws://localhost:2020',
            'email' => 'no-email',
            'email_password' => 'no-email',
            'urls' => 'https://www.fonbet.com/#!/live;https://www.fonbet-4b97a.com/#!/live',
            'use_chrome' => true,
            'profile' => 'profile5',
            'restart' => true,
            'second_name' => 'Petrov',
            'experimental' => false,
        ============================================================================================================================================
        Warning: DEPRECATED!!! these variants are used only for bk = STAKE:
        ============================================================================================================================================
             // id of template ; stake | next
            'comment' => '1;2|3;4',
            // registration variant
            // почта;логин;пароль;дата рождения;имя;фамилия;страна;адрес;город;индекс;место работы;сумма пополнения;айди бинанс апи
            // если суммы нет - 10, если айди бинанса нет - первый
            'comment' => 'kudryashov.fil@bk.ru; datco777; Ribnita55; 21.06.1962; Alexandr; Datco; Moldova; Boris Glavan NR.1 AP.9; Ribnita; 5500; -',
             one more - BOTH:
        почта;логин;пароль;дата рождения;имя;фамилия;страна;адрес;город;индекс;место работы;сумма пополнения;айди бинанс апи|шаблон;сумма|шаблон;сумма
        ============================================================================================================================================
        Warning: DEPRECATED!!!  these variants are used only for bk != STAKE:
        ============================================================================================================================================
        old format - longitude;latitude;country;proxy;api-key
        one more - BOTH: 1;2|3;4|latitude;longitude;country;proxy;api-key
        Warning: DEPRECATED!!! now we use -> latitude;longitude;country;proxy;api-key
        proxy is - (http|socks5)://[user:pass@]host:port
        ============================================================================================================================================
        Hint: command and parameters: [qr]longitude;latitude;country;proxy;api-key[cas]1;2|3;4
        cas- Config And Stake
        [cas]1;2|3;4|5;6% - the percent sign means "floating stake" based on the balance
        [register]почта;логин;пароль;дата рождения;имя;фамилия;страна;адрес;город;индекс;место работы;сумма пополнения;айди бинанс апи
        [qr]longitude;latitude;country;proxy;api-key
        ============================================================================================================================================
            'fork' => [
                "bookie" => "STAKE",
                "uid" => "stake",
                "shoulder" => 2,
                "betAmount" => 100,
                "maxWait" => 10,
                "maxLosePercent" => 5,
                "minWinPercent" => 3,
            ],
            'buyer' => [
                "uid" => "1xstavka",
                "secret" => "1020304051",
                "amount" => 150.0,
                "percentDecrease" => 5.0,
                "waitBetmax" => true,
                "sendToAll" => true,
            ],
            'stake_fork' => [
                    "bookie" => "STAKE",
                    "uid" => "stake",
                    "url" => "http://bcp.bet/stake",
                    "source" => "oddscp",
                    "currency" => "USD",
                    "eventTimeLimit" => 7200,
                    "eventMaxBets" => 3,
                    "successBetInterval" => 30,
                    "stake" => 1,
                    "coefFrom" => 0,
                    "coefTo" => 0,
                    "incomeFrom" => 1.9,
                    "incomeTo" => 2.1,
                    "lastScoreTennis" => "0:0",
                    "lastScoreBasketball" => "0:0",
                    "excludeSports" => "FOOTBALL, TENNIS ; BASKETBALL.BASEBALL, HOCKEY, VOLLEYBALL-CYBERSPORT",
                    "excludeMarkets" => "ONE_TWO-HDP;EURO_HDP",
                    "excludeTargets" => "ONE-AWAY",
                    "excludePivots" => "T1_TOTAL OVER 1.5;HDP HOME 1.25;TOTAL UNDER 1.5",
                    "excludeBets" => "TOTAL OVER 1;ONE_TWO WIN SET_GAME",
                    "excludeLeagues" => "Футбол Россия. Премьер-лига;Футбол Россия. Первая лига",
                    "excludeSportMarketTarget" => "BASKETBALL TOTAL OVER;BASKETBALL TOTAL UNDER",
            ],
            OR
            'stake_forks' => [
                [
                    "bookie" => "STAKE",
                    "uid" => "stake",
                    "url" => "http://bcp.bet/stake"",
                    "source" => "oddscp",
                    "currency" => "USD",
                    "eventTimeLimit" => 7200,
                    "eventMaxBets" => 3,
                    "successBetInterval" => 30,
                    "stake" => 1,
                    "coefFrom" => 0,
                    "coefTo" => 0,
                    "incomeFrom => 1.9,
                    "incomeTo => 2.1,
                    "lastScoreTennis => "0:0",
                    "lastScoreBasketball => "0:0",
                    "excludeSports" => "FOOTBALL, TENNIS ; BASKETBALL.BASEBALL, HOCKEY, VOLLEYBALL-CYBERSPORT",
                    "excludeMarkets" => "ONE_TWO-HDP;EURO_HDP",
                    "excludeTargets" => "ONE-AWAY",
                    "excludePivots" => "T1_TOTAL OVER 1.5;HDP HOME 1.25;TOTAL UNDER 1.5",
                    "excludeBets" => "TOTAL OVER 1;ONE_TWO WIN SET_GAME",
                    "excludeLeagues" => "Футбол Россия. Премьер-лига;Футбол Россия. Первая лига",
                    "excludeSportMarketTarget" => "BASKETBALL TOTAL OVER;BASKETBALL TOTAL UNDER",
                ]
            ],
        ]));
        */
        $params = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $params)), true);
        //file_put_contents(dirname(__FILE__) . '/../../../params_id='.$id.'_'.$obf.'.txt', var_export($params, true));
        // Hint: old format
        if (!empty($params['stake_fork_url']) && !empty($params['stake_fork'])) {
            $params['stake_fork']['url'] = $params['stake_fork_url'];
        }
        // Hint: less old format
        if (empty($params['stake_forks']) && !empty($params['stake_fork']) && !empty($params['stake_fork']['url'])) {
            $params['stake_forks'] = [$params['stake_fork']];
        }
        // Hint: checking urls
        if (!empty($params['stake_forks']) && is_array($params['stake_forks'])) {
            foreach ($params['stake_forks'] as $key => $stake_fork) {
                if (empty($stake_fork['url'])) {
                    unset($params['stake_forks'][$key]);
                }
            }
        } else if (!empty($params['stake_forks']) && !is_array($params['stake_forks'])) {
            unset($params['stake_forks']);
        }
        if (!empty($params['stake_fork'])) {
            unset($params['stake_fork']);
        }
        if (strlen($abrah) > 0) {
            $abrah = "_{$abrah}";
        }
        if ($testing === 'true') {
            $params['testing'] = true;
        }
        return Yii::$app->response->sendContentAsFile(
            BotsHelper::prepareExtensionByBk($params, $id, $obf), "extension{$abrah}.zip");
    }

    public function actionGetBetexyUserBots($user_id)
    {
        $xbots = Xbots::find()->where(['betexy_user_id' => $user_id, 'active' => 1])->all();
        $res = [];
        foreach ($xbots as $xbot) {
            $now = (int)time();
            $till = (int)strtotime($xbot->due_date . " 23:59:59");
            if ($now < $till) {
                $res[] = $xbot->betexy_bot_id;
            }
        }
        return json_encode($res);
    }

    /**
     * @param $params
     * @return string
     * @return Response|\yii\web\Response
     * @throws NotFoundHttpException
     */
    public function actionGetSettings($params)
    {
        $params = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $params)), true);
        return base64_encode(BotsHelper::prepareExtensionByBk($params, 0, true));
    }

    /**
     * Return new version if available
     * @param string $os
     * @param string $module
     * @return Response|\yii\web\Response
     * @throws RangeNotSatisfiableHttpException
     */
    public function actionSoftwareUpdate(string $os, string $module = '')
    {
        return Yii::$app->response->sendContentAsFile(BotsHelper::prepareSoftwareNew($os, $module), 'update.zip');
    }

    /**
     * @param string $os
     * @param string $module
     * @return string
     */
    public function actionSoftwareVersion(string $os, string $module = '')
    {
        BotsHelper::recordActivity();
        return BotsHelper::getSoftwareVersion($os, $module);
    }

    /**
     * @param string $os
     * @param string $version
     * @return string
     */
    public function actionConfigUpdate(string $os, string $version): string
    {
        return BotsHelper::getConfigUpdate($os, $version);
    }

    /**
     * @throws Exception
     */
    public function actionDirectCommand(string $uid = ''): array
    {
        Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        if (Yii::$app->request->isPost) {
            $result = Yii::$app->request->getRawBody();
            if (!empty($result)) {
                return BotsQueue::directCommandResult(json_decode($result, true));
            } else {
                Yii::warning("Empty direct command result!");
                return ["status" => "error", "message" => "Empty direct command result!"];
            }
        } else {
            return [];
            //return BotsQueue::getStakeWithdrawalCommand($uid);
        }
    }

    public function actionReport()
    {
        Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        $payload = Yii::$app->request->post('payload', '');
        if (empty($payload)) {
            return Json::encode(["success" => false, "message" => "No payload!"]);
        }
        
        $result = Report::createFromPayload($payload);
        
        // Handle parser bet unlock if report is from new parser
        try {
            $jsonPayload = json_decode($payload, true);
            if (isset($jsonPayload['parser_bet_id']) && isset($jsonPayload['parser_url'])) {
                // This is a report from new parser - unlock bet if not placed successfully
                $this->unlockParserBet(
                    $jsonPayload['parser_bet_id'],
                    $jsonPayload['parser_url'],
                    $jsonPayload['client_id'] ?? '',
                    $jsonPayload['data']['status'] ?? 'FAILED'
                );
            }
        } catch (\Exception $e) {
            // Log error but don't fail the report
            Yii::error("Error unlocking parser bet: " . $e->getMessage());
        }
        
        return Json::encode($result);
    }
    
    /**
     * Unlock parser bet in Redis if bet was not placed successfully
     */
    private function unlockParserBet($betId, $parserUrl, $clientId, $status)
    {
        try {
            // Use Yii Redis component if available, otherwise connect directly
            if (Yii::$app->has('redis')) {
                $redis = Yii::$app->redis;
            } else {
                // Fallback: direct Redis connection
                $redis = new \Redis();
                $redis->connect('redis', 6379, 2.0);
            }
            
            $queueKey = 'parser_queue:' . md5($parserUrl);
            $betLockKey = "parser_lock:{$queueKey}:{$betId}";
            
            // Only unlock if bet was not successfully placed (status is not ACCEPTED)
            if ($status !== 'ACCEPTED' && $status !== 'SUCCESS') {
                // Check if this bet is still locked by this client
                $lockedBy = $redis->get($betLockKey);
                if ($lockedBy === $clientId) {
                    // Unlock the bet
                    $redis->del($betLockKey);
                    
                    // Also remove bet info
                    $betInfoKey = "parser_bet_info:{$queueKey}:{$betId}";
                    $redis->del($betInfoKey);
                }
            } else {
                // Bet was successfully placed - remove lock after some time (cleanup)
                // Keep lock for a while to prevent immediate reuse, but set shorter expiry
                $redis->expire($betLockKey, 10); // Keep for 10 seconds, then auto-expire
            }
            
            // Close connection only if we created it directly
            if (!Yii::$app->has('redis') && $redis instanceof \Redis) {
                $redis->close();
            }
        } catch (\Exception $e) {
            // Redis might not be available, log but don't fail
            Yii::error("Redis unlock error: " . $e->getMessage());
        }
    }

    public function actionMarginReport()
    {
        Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        $payload = Yii::$app->request->post('payload', '');
        return Json::encode(empty($payload)
            ? ["success" => false, "message" => "No payload!"]
            : MarginReport::createFromPayload($payload));
    }

    /**
     * To use bb_* actions directly you must configure web.php like this:
     * 'urlManager' => [
     *      'enablePrettyUrl' => true,
     *      'showScriptName' => false,
     *      'rules' => [
     *          'bb_test.php' => 'BotManager/api/bb_test',
     *          'bb_bot.php' => 'BotManager/api/bb_bot',
     *          'bb_parser.php' => 'BotManager/api/bb_parser',
     *      ],
     * ],
     * and also configure nginx like this:
     * server part, after location ~ \.php$ {
     * and before location / {
     * :
     * location = /bb_test.php {
     *      try_files $uri $uri/ /index.php?$query_string;
     *      gzip_static on;
     * }
     * location = /bb_bot.php {
     *      try_files $uri $uri/ /index.php?$query_string;
     *      gzip_static on;
     * }
     * location = /bb_parser.php {
     *      try_files $uri $uri/ /index.php?$query_string;
     *      gzip_static on;
     * }
     * p.s. If Basic Auth used, also add to above code (location) these strings:
     * auth_basic off;
     * you may also need to move auth_basic* from server to location /
     * @param $action
     * @return string
     * @throws NotFoundHttpException
     */
    public function actionBb_test($action)
    {
        if ($action !== 'get_command') {
            throw new NotFoundHttpException(Yii::t('BotManager',
                'The requested page does not exist.'));
        }
        Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        /*
         var_dump(BuyerQueue::find()
            ->where(['=', 'sent_at', 0])
            ->orderBy(['updated_at' => SORT_DESC])
            ->limit(1)->prepare(Yii::$app->db->queryBuilder)->createCommand()->rawSql);
        */
        $queue = BuyerQueue::find()
            ->where(['=', 'sent_at', 0])
            ->orderBy(['updated_at' => SORT_DESC])
            ->limit(1)->one();
        if (!empty($queue) and !empty($queue->command)) {
            $command = json_decode($queue->command, true);
            if (!empty($command['data']) and is_array($command['data'])) {
                $command['data']['concrete_id'] = $queue->id;
            }
            $queue->sent_at = time();
            $queue->save();
            return $command;
        } else {
            return '';
        }
    }

    /**
     * @param $action
     * @return string
     * @throws NotFoundHttpException
     */
    public function actionBb_bot($action)
    {
        if ($action !== 'store') {
            throw new NotFoundHttpException(Yii::t('BotManager',
                'The requested page does not exist.'));
        }
        $json = json_decode(Yii::$app->request->post('json', ''), true);
        if (!empty($json) && !empty($json['action']) && !empty($json['id'])) {
            $queue = BuyerQueue::findOne(['id' => $json['id']]);
            if (empty($queue)) {
                return 'command not found';
            }
            $queue->finished_at = time();
            $queue->success = (int)($json['action'] === 'SUCCEED');
            $queue->response = $json['answer'];
            if ($queue->save()) {
                return 'saved!';
            } else {
                return var_export($queue->getErrors(), true);
            }
        } else {
            return 'bad request!';
        }
    }

    /**
     * @param $action
     * @return string
     * @throws NotFoundHttpException
     */
    public function actionBb_parser($action)
    {
        if ($action !== 'store') {
            throw new NotFoundHttpException(Yii::t('BotManager',
                'The requested page does not exist.'));
        }
        $data = json_decode(Yii::$app->request->getRawBody());
        if (!empty($data)) {
            $parsed = BotsHelper::parseIncomingBetJson($data);
            if (!empty($parsed)) {
                $queue = new BuyerQueue();
                $queue->is_live = $parsed['type'] === 'LIVE';
                $queue->command = json_encode([
                    'action' => 'BET',
                    'data' => $parsed,
                    'room' => [
                        'bk' => $parsed['bk'],
                        'uid' => mb_strtolower($parsed['bk']),
                        'check_limited' => 0,
                    ]
                ]);
                $queue->save();
            }
        }
        return "";
    }

    public function actionGetIp()
    {
        echo $_SERVER['REMOTE_ADDR'];
        die();
    }

    public function actionGuacamoleCommand()
    {
        return $this->guacamole('command');
    }

    public function actionGuacamoleResponse()
    {
        return $this->guacamole('response');
    }

    public function actionGuacamoleAdd()
    {
        return $this->guacamole('add');
    }

    public function actionAddBlocked($account_id, $code)
    {
        Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        $count = PsCodes::find()->where(['account_id' => $account_id, 'code' => $code])->count();
        if (!empty($count)) {
            return json_encode(['success' => false, 'message' => "Code {$code} already used!"]);
        }
        $model = new PsCodes();
        $model->account_id = $account_id;
        $model->code = $code;
        if ($model->save()) {
            return json_encode(['success' => true, 'message' => "Code saved with id {$model->id}"]);
        } else {
            return json_encode(['success' => false, 'message' => 'Error saving code: ' . var_export($model->getErrors(), true)]);
        }
    }

    public function actionGetBlocked($account_id)
    {
        Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        $codes = PsCodes::find()->where(['account_id' => $account_id])->all();
        $result = [];
        foreach ($codes as $code) {
            /* @var PsCodes $code */
            $result[] = $code->code;
        }
        return json_encode(['success' => true, 'message' => $result]);
    }

    public function actionStoreEvents()
    {
        Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        $events = json_decode(Yii::$app->request->getRawBody(), true);
        $counter = 0;
        foreach ($events as $event => $details) {
            Yii::$app->redis->set($event, json_encode($details), "EX",
                $details['type'] === 'PREMATCH' ? '3700' : "300");
            $counter++;
        }
        return json_encode(['success' => true, 'message' => "Stored {$counter} events!"]);
    }

    public function actionGetEvent($event_id)
    {
        Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        try {
            $data = json_decode(Yii::$app->redis->get($event_id), true);
            return json_encode(array_merge(['success' => true], empty($data) ? [] : $data));
        } catch (Exception $e) {
            return json_encode(['success' => false, 'message' => $e->getMessage()]);
        }

    }

    private $compareResults = [];

    public function actionFindEvent()
    {
        $this->compareResults = [];
        $started = microtime(true);
        Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        $type = Yii::$app->request->post('type', '');
        $home = Yii::$app->request->post('home', '');
        $away = Yii::$app->request->post('away', '');
        $sport = strtolower(Yii::$app->request->post('sport', ''));
        $wasError = Yii::$app->request->post('wasError', false);
        if (empty($type) && (empty($home) || empty($away))) {
            return json_encode(['success' => false,
                    'message' => "Bad params: " . var_export(Yii::$app->request->post(), true)]
            );
        }
        $foundFull = [];
        $foundOne = [];
        foreach (Yii::$app->redis->keys('*') as $event_id) {
            $event = Yii::$app->redis->get($event_id);
            if (empty($event)) {
                continue;
            }
            if ($wasError) {
                $parsed = json_decode($event);
                if ($parsed->type === $type && $parsed->sport === $sport
                    && (($this->compareTeams($parsed->homeTeam, $home)
                            && $this->compareTeams($parsed->awayTeam, $away))
                        || ($this->compareTeams($parsed->homeTeam, $away)
                            && $this->compareTeams($parsed->awayTeam, $home)))
                ) {
                    $foundFull[$event_id] = $event_id;
                } elseif ($parsed->type === $type && $parsed->sport === $sport
                    && ($this->compareTeams($parsed->homeTeam, $home)
                        || $this->compareTeams($parsed->awayTeam, $away)
                        || $this->compareTeams($parsed->homeTeam, $away)
                        || $this->compareTeams($parsed->awayTeam, $home)
                    )) {
                    $foundOne[$event_id] = $event_id;
                }
            } else {
                if (!empty($home) && !empty($away) && strpos($event, $type) !== false
                    && strpos($event, $sport) !== false
                    && strpos($event, $home) !== false && strpos($event, $away) !== false) {
                    $foundFull[$event_id] = $event_id;
                } elseif (
                    (empty($home) || empty($away))
                    && strpos($event, $type) !== false
                    && strpos($event, $sport) !== false
                    && (!empty($home) && strpos($event, $home) !== false
                        || !empty($away) && strpos($event, $away) !== false)) {
                    $foundOne[$event_id] = $event_id;
                }
            }
        }
        if (!empty($foundFull)) {
            ksort($foundFull);
            return ['success' => true, 'message' => array_key_first($foundFull),
                'spent' => microtime(true) - $started, 'compareResults' => $this->compareResults,
                'foundFull' => $foundFull,];
        } elseif (!empty($foundOne)) {
            ksort($foundOne);
            return ['success' => true, 'message' => array_key_first($foundOne),
                'spent' => microtime(true) - $started, 'compareResults' => $this->compareResults,
                'foundOne' => $foundOne,];
        } else {
            return ['success' => false, 'message' => "Event {$type}/{$sport}/{$home}/{$away} not found!",
                'spent' => microtime(true) - $started, 'compareResults' => $this->compareResults];
        }
    }

    private function compareTeams($first, $second): bool
    {
        if ($first === $second) {
            return true;
        } else {
            $percent = 0;
            similar_text($first, $second, $percent);
            if ($percent > 50) {
                $this->compareResults[] = "'{$first}' vs '{$second}' = {$percent}";
            }
            return $percent > 70;
        }
    }


    private function guacamole($action)
    {
        Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        $token = Yii::$app->request->post('token', '');
        if ($token !== 'KsMtKa$@!s9YxsAa3*de') {
            return Json::encode(["success" => false, "message" => "Hi, '{$token}"]);
        } elseif ($action === 'response') {
            return BotsHelper::setGuacamoleResponse(json_decode(Yii::$app->request->post('response', ''), true));
        } elseif ($action === 'add') {
            return BotsHelper::addGuacamoleCommand(Yii::$app->request->post('ip', ''),
                Yii::$app->request->post('servername', ''),
                Yii::$app->request->post('queue_id', ''));
        } else {
            return BotsHelper::getGuacamoleCommand();
        }
    }

}

