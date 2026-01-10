<?php

namespace app\modules\BotManager\Helpers;

use app\modules\BotManager\models\BkSettingsForm;
use app\modules\BotManager\models\Bots;
use app\modules\BotManager\models\BotsQueue;
use app\modules\BotManager\models\Configs;
use app\modules\BotManager\models\FileGroups;
use app\modules\BotManager\models\Files;
use app\modules\BotManager\models\RdpActivity;
use app\modules\BotManager\models\RdpCommands;
use app\modules\BotManager\models\RdpTable;
use app\modules\BotManager\models\SettingsForm;
use app\modules\BotManager\models\SoftwareVersions;
use app\modules\BotManager\models\Xbots;
use DateTimeImmutable;
use Lcobucci\JWT\JwtFacade;
use Lcobucci\JWT\Signer\Hmac\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;
use Lcobucci\JWT\Token\Builder;
use yii\db\Expression;
use yii\helpers\VarDumper;
use yii\web\NotFoundHttpException;

class BotsHelper
{

    const TYPE_B365 = 4;
    const TYPE_BOTH = 3;
    const TYPE_REGISTER = 2;
    const TYPE_STAKE_FORK = 1;
    const TYPE_UNKNOWN = 0;
    const TYPE_EMPTY = -1;

    public static function actionForBot(Bots $bot, $forExtension = false)
    {
        $actions = $bot->queue;
        if (count($actions) > 0) {
            $action = $actions[0];
            if (($action->executor === 1 && !$forExtension) ||
                ((!empty($action->run_after_success) || !empty($action->run_after_fail)) && !self::checkActionBeforeSend($action))) {
                return '';
            } elseif ($action->executor === 1 && $forExtension) {
                return $action->prepareCommandForExtension();
            } else if ($action->executor === 0 && !$forExtension) {
                return $action->prepareCommandForBot();
            } else {
                return '';
            }
        } else {
            return '';
        }
    }

    public static function prepareSoftware(SoftwareVersions $soft, $noIni = false, $user_id = '', $bot_name = '')
    {
        require_once __DIR__ . '/libs/zip.lib.php';
        $zip = new \ZipFile();
        if (!$noIni) {
            $zip->addFile(self::prepareSoftwareIniFile($user_id, $bot_name), 'BotManager.ini');
        }
        foreach ($soft->files->files as $file) {
            $fullName = str_replace('@root/', '', $file->source_path) . $file->source_name;
            $zip->addFile(file_get_contents($file->file_path . $file->file_name), $fullName);
        }
        return $zip->file();
    }

    public static function prepareSoftwareNew($os, $module)
    {
        $soft = self::selectSoftware($os, $module);
        if (!empty($soft)) {
            require_once __DIR__ . '/libs/zip.lib.php';
            $zip = new \ZipFile();
            foreach ($soft->files->files as $file) {
                $fullName = str_replace('@root/', '', $file->source_path) . $file->source_name;
                $zip->addFile(file_get_contents($file->file_path . $file->file_name), $fullName);
            }
            return $zip->file();
        } else {
            return '';
        }
    }

    public static function getSoftwareVersion($os, $module): string
    {
        $soft = self::selectSoftware($os, $module);
        if (!empty($soft)) {
            return $soft->code;
        } else {
            return '';
        }
    }

    public static function getConfigUpdate($os, $version)
    {
        $vRecord = SoftwareVersions::findOne(['name' => "config-{$os}"]);
        if (!empty($vRecord) && $os === 'mg') {
            return $vRecord->comment;
        } elseif (!empty($vRecord) && !empty($vRecord->code) && trim($vRecord->code) !== trim($version)
            && $vRecord->comment !== '') {
            $json = json_decode($vRecord->comment, true);
            $json[] = ['section' => 'Misc', 'option' => 'config_version', 'value' => $vRecord->code];
            foreach ($json as $k => $j) {
                $json[$k]["value"] = (string)$j["value"];
            }
            return json_encode($json);
        } else {
            return '';
        }
    }
    
    
    
    public static function prepareExtensionV3(Bots $bot, $noManifest = false, $testing = false, $special = false,
                                            bool $obfuscate = false, bool $withConsole = false): string 
    {
        require_once __DIR__ . '/libs/zip.lib.php';
        $zip = new \ZipFile();
        $backgroundReplace = [];
        $activeBks = [];
        foreach ($bot->botsBksLink as $bkLink)
            $activeBks[] = $bkLink->bk->bk_internal;
        
        $backgroundReplace["#TENNISI_BACKGROUND#"] = '';
        if (in_array('tennisi', $activeBks)) {
            $file = self::getRealFile('', $testing);
            $fullName = str_replace('@root/', '', $file->source_path) . $file->source_name;
            
        }
        if (!$noManifest) {
            $zip->addFile(self::prepareManifestV3($bot), 'manifest.json');
        }
        $settings = self::prepareSettings($bot, false, $special);
        if ($obfuscate) {
            $source = tempnam(sys_get_temp_dir(), 'obf') . '.js';
            $target = tempnam(sys_get_temp_dir(), 'obf') . '.js';
            file_put_contents($source, $settings);
            BotsHelper::obfuscateFile($source, $target, 'settings', $withConsole);
            $settings = file_get_contents($target);
            unlink($source);
            unlink($target);
        }
        $backgroundReplace["#SETTINGS#"] = $settings;
        if (empty($bot->logic_name))
            $bot->logic_name = 'logic';
        //$bot->validate();
        $added = [];
        foreach ($bot->extension->getFullFiles(!empty($bot->end)) as $fileDraft) {
            $file = self::getRealFile($fileDraft, $testing);
            $fullName = str_replace('@root/', '', $file->source_path) . $file->source_name;
            if (empty($added[$fullName])) {
                $contents = self::getExtensionFile($file->file_path . $file->file_name, $fullName,
                    $obfuscate, $withConsole);
                switch ($fullName) {
                    case 'js/' . $bot->logic_name . '.js':
                        $backgroundReplace["#LOGIC#"] = $contents;
                        break;
                    case 'libs/baseAuth.js':
                        $backgroundReplace["#TENNISI_BACKGROUND#"] = $contents;
                        break;
                    case 'background.js':
                        break;
                    default:
                    $zip->addFile($contents, $fullName);
                }
                $added[$fullName] = true;
            }
        }
        if (!$special) {
            foreach ($bot->botsBks as $bk) {
                foreach ($bk->files as $fileDraft) {
                    $file = self::getRealFile($fileDraft, $testing);
                    $fullName = str_replace('@root/', '', $file->source_path) . $file->source_name;
                    if (empty($added[$fullName])) {
                        $zip->addFile(self::getExtensionFile($file->file_path . $file->file_name, $fullName,
                            $obfuscate, $withConsole),
                            $fullName);
                        $added[$fullName] = true;
                    }
                }
            }
        }
        $tpl = file_get_contents(__DIR__ . '/tpls/backgroundV3.tpl');
        $zip->addFile(str_replace(array_keys($backgroundReplace), array_values($backgroundReplace), $tpl), 'background.js');
        return $zip->file();
    }

    /**
     * @throws \SodiumException
     */
    public static function prepareExtension(Bots $bot, $noManifest = false, $testing = false, $special = false,
                                            bool $obfuscate = false, bool $withConsole = false): string
    {
        require_once __DIR__ . '/libs/zip.lib.php';
        $zip = new \ZipFile();
        if (!$noManifest) {
            $zip->addFile(self::prepareManifest($bot), 'manifest.json');
        }
        $settings = self::prepareSettings($bot, false, $special);
        if ($obfuscate) {
            $source = tempnam(sys_get_temp_dir(), 'obf') . '.js';
            $target = tempnam(sys_get_temp_dir(), 'obf') . '.js';
            file_put_contents($source, $settings);
            BotsHelper::obfuscateFile($source, $target, 'settings', $withConsole);
            $settings = file_get_contents($target);
            unlink($source);
            unlink($target);
        }
        $zip->addFile($settings, 'settings.js');
        //$zip->addFile(self::prepareSettings($bot, false, $special), 'settings.js');
        $added = [];
        foreach ($bot->extension->getFullFiles(!empty($bot->end)) as $fileDraft) {
            $file = self::getRealFile($fileDraft, $testing);
            $fullName = str_replace('@root/', '', $file->source_path) . $file->source_name;
            if (empty($added[$fullName])) {
                $contents = self::getExtensionFile($file->file_path . $file->file_name, $fullName,
                    $obfuscate, $withConsole);
                $zip->addFile($contents, $fullName);
                $added[$fullName] = true;
            }
        }
        if (!$special) {
            foreach ($bot->botsBks as $bk) {
                foreach ($bk->files as $fileDraft) {
                    $file = self::getRealFile($fileDraft, $testing);
                    $fullName = str_replace('@root/', '', $file->source_path) . $file->source_name;
                    if (empty($added[$fullName])) {
                        $zip->addFile(self::getExtensionFile($file->file_path . $file->file_name, $fullName,
                            $obfuscate, $withConsole),
                            $fullName);
                        $added[$fullName] = true;
                    }
                }
            }
        }
        return $zip->file();
    }

    private static $variants = [
        'excludeSports' =>
            ['FOOTBALL', 'TENNIS', 'TABLETENNIS', 'BASKETBALL', 'BASEBALL', 'HOCKEY', 'VOLLEYBALL',
                'CYBERSPORT', 'HANDBALL', 'esports.lol',],
        'excludeMarkets' =>
            ['TOTAL', 'T1_TOTAL', 'T2_TOTAL', 'CORNER_TOTAL', 'HDP', 'EURO_HDP', 'CORNER_HDP', 'ONE_TWO'],
        'excludeTargets' =>
            ['OVER', 'UNDER', 'HOME', 'AWAY', 'H1', 'HX', 'H2', 'ONE', 'TWO', 'DRAW', 'ONE_DRAW', 'TWO_DRAW', 'ONE_TWO'],
    ];

    private static function prepareStakeFork($params)
    {
        $res = $params;
        foreach (['excludeSports', 'excludeMarkets', 'excludeTargets', 'excludePivots', 'excludeBets',
                     'excludeLeagues', 'excludeSportMarketTarget',] as $excl) {
            if (empty($params[$excl])) {
                $res[$excl] = '[]';
            } else {
                $exclude = [];
                if (in_array($excl, ['excludePivots', 'excludeBets', 'excludeSportMarketTarget', 'excludeLeagues'])) {
                    foreach (explode(';', $params[$excl]) as $ep) {
                        $exclude[] = trim($ep);
                    }
                } else {
                    foreach (self::$variants[$excl] as $var) {
                        if (strpos($params[$excl], $var) !== false) {
                            if ($var === 'TENNIS'
                                && strpos($params[$excl], 'TABLETENNIS') !== false
                                && substr_count($params[$excl], 'TENNIS') === 1) {
                                $var = 'TABLETENNIS';
                            }
                            if (!in_array($var, $exclude)) {
                                $exclude[] = $var;
                            }
                        }
                    }
                }
                $res[$excl] = empty($exclude) ? '[]' : '["' . implode('", "', $exclude) . '"]';
            }
        }
        return $res;
    }

    /**
     * @param $params [ betexy_bot_id, with_console, bk, login, password, phone, uid, ws_url, email, email_password,
     *  urls, use_chrome, profile, restart, second_name, experimental, comment, testing ]
     * @param int $id = 0
     * @param bool $onlySettings = false
     * @param int $obf = 0
     * @return string
     * @throws NotFoundHttpException
     * @throws \SodiumException
     */
    public static function prepareExtensionByBk($params, int $id = 0, bool $onlySettings = false,
                                                int $obf = 0): string
    {
        //file_put_contents(__DIR__.'/../../../ggg.log', var_export($params, true), FILE_APPEND);
        $bot = self::createBot($params);
        $extension = FileGroups::findOne(empty($id) ? ['name' => 'Base'] : ['id' => $id]);
        if (empty($extension)) {
            throw new \yii\web\NotFoundHttpException("Extension not found!");
        }
        $bookie = self::getBookie($params['bk']);
        $bot->extension_id = $extension->id;
        $bot->bm_bk_select = empty($bookie) ? [] : [$bookie->id];
        if (!empty($bot->tempParams['fork_second_bookie'])) {
            $second = self::getBookie($bot->tempParams['fork_second_bookie']);
            $bot->bm_bk_select = array_merge($bot->bm_bk_select, [$second->id]);
        }
        $obfuscate = getenv('DO_NOT_OBFUSCATE') !== 'true' && ($obf > 0 || $bot->end > 0);
        if ($onlySettings) {
            return self::prepareSettings($bot, true, (int)$id === 122);
        } else {
            return self::prepareExtensionV3($bot, !empty($id), !empty($params['testing']), (int)$id === 122,
                $obfuscate, !empty($params['with_console']));
        }
    }

    public static function applySettingsFromFile(BotsQueue $action, $file)
    {
        $errors = [];
        $bm_bk_select = [];
        $default_bk_id = 0;
        $settings = self::parseSettingsFromFile($file);
        foreach ($settings['settings']['active_bks'] as $bk) {
            $bkId = FileGroups::find()->where(['type' => 1, 'bk_internal' => $bk])->orderBy(['id' => SORT_ASC])->one()->id;
            if ($bk === $settings['settings']['default_bk']) {
                $default_bk_id = $bkId;
            }
            $bm_bk_select[] = $bkId;
        }
        $action->bots->bm_bk_select = $bm_bk_select;
        $action->bots->default_bk_id = $default_bk_id;
        $action->bots->websocket_url = $settings['settings']['websocket_url'];
        $action->bots->websocket_uid = $settings['settings']['websocket_uid'];
        $action->bots->test_mode_on = $settings['settings']['test_mode_on'] === 'true' ? 1 : 0;
        $action->bots->test_url = $settings['settings']['test_url'];
        if (!$action->bots->save(false)) {
            $errors[] = VarDumper::dumpAsString($action->bots->getErrors());
        } else {
            foreach ($action->bots->botsBksLink as $link) {
                $link->login = empty($settings['bks'][$link->bk->bk_internal]['login'])
                    ? '' : $settings['bks'][$link->bk->bk_internal]['login'];
                $link->password = empty($settings['bks'][$link->bk->bk_internal]['password'])
                    ? '' : $settings['bks'][$link->bk->bk_internal]['password'];
                if (!$link->save()) {
                    $errors[] = VarDumper::dumpAsString($link->getErrors());
                }
            }
        }
        return $errors;
    }

    public static function parseSettingsFromFile($file)
    {
        $summary = [
            'bks' => [],
            'settings' => [
                'websocket_url' => '',
                'websocket_uid' => '',
                'test_mode_on' => '',
                'test_url' => '',
                'default_bk' => '',
                'active_bks' => '',
            ],
        ];
        foreach (array_keys($summary['settings']) as $key) {
            $res = [];
            if ($key !== 'active_bks') {
                preg_match_all('/' . $key . '\s*:\s*(.*?)\s*,/is', $file, $res, PREG_SET_ORDER);
            } else {
                preg_match_all('/' . $key . '\s*:\s*\[(.*?)]\s*,/is', $file, $res, PREG_SET_ORDER);
            }
            $summary['settings'][$key] = str_replace(['\'', '"', ' ', '  ', '   '], '', trim($res[0][1]));
        }
        $summary['settings']['active_bks'] = explode(',', $summary['settings']['active_bks']);
        $res = [];
        preg_match_all('/([\w\d]+)_login.*?:.*?(\'|")(.*?)(\'|").*?([\w\d]+)_password.*?:.*?(\'|")(.*?)(\'|")/is',
            $file, $res, PREG_SET_ORDER);
        foreach ($res as $r) {
            if ($r[1] === $r[5]) {
                $summary['bks'][$r[1]] = [
                    'login' => $r[3],
                    'password' => $r[7]
                ];
            }
        }
        return $summary;
    }

    public static function recordActivity()
    {
        $activity = RdpActivity::findOne(['ip' => $_SERVER['REMOTE_ADDR']]);
        if (!$activity) {
            $activity = new RdpActivity();
            $activity->ip = $_SERVER['REMOTE_ADDR'];
        }
        $activity->last_activity = time();
        $activity->save();
    }

    public static function getGuacamoleCommand()
    {
        $command = RdpCommands::find()->where(['and',
            ['sent_at' => 0],
            ['is not', 'forced_send', new Expression('null')],
            ['<=', 'forced_send', time()]
        ])->orderBy(['forced_send' => SORT_ASC])
            ->limit(1)->one();
        if (empty($command)) {
            $command = RdpCommands::find()->where(['and',
                ['sent_at' => 0],
                ['is', 'forced_send', new Expression('null')],
            ])->orderBy(['created_at' => SORT_ASC])
                ->limit(1)->one();
        }
        if (!empty($command)) {
            $command->sent_at = time();
            $command->save();
            return json_encode(['id' => $command->id, 'command' => json_decode($command->command)]);
        } else {
            return '{}';
        }
    }

    public static function addGuacamoleCommand($ip, $servername, $queue_id)
    {
        $command = new RdpCommands();
        $command->ip = $ip;
        $command->command = json_encode(['action' => 'rdp_add', 'server' => $ip,
            'servername' => $servername, 'queue_id' => $queue_id]);
        $command->save();
        $table = new RdpTable();
        $table->ip = $ip;
        $table->name = $servername;
        $table->save();
        return json_encode(['success' => true, 'message' => "Command was added with ID: [{$command->id}]!"]);
    }

    public static function setGuacamoleResponse($response)
    {
        $command = RdpCommands::findOne(['id' => $response['command_id']]);
        if (!empty($command)) {
            $command->finished_at = time();
            $command->result = json_encode($response);
            $command->save();
            $original = json_decode($command->command, true);
            if ($original['action'] === 'rdp_scan' && is_array($response['response'])) {
                set_time_limit(300);
                foreach ($response['response'] as $rec) {
                    $t = RdpTable::findOne(['ip' => $rec['ip']]);
                    if (empty($t)) {
                        $t = new RdpTable();
                        $t->ip = $rec['ip'];
                    }
                    $t->name = $rec['name'];
                    $t->save();
                }
            } elseif ($original['action'] === 'rdp_login') {
                $activity = RdpActivity::findOne(['ip' => $command->ip]);
                if (empty($response['success'])) {
                    $activity->logins_failed = (int)$activity->logins_failed + 1;
                    if ((int)$activity->logins_failed >= 5) {
                        $activity->deleted = 1;
                    }
                } else {
                    $activity->logins_failed = 0;
                }
                $activity->save();
            }
            return json_encode(['success' => true, 'message' => "Response saved!"]);
        } else {
            return json_encode(['success' => false, 'message' => "Command {$response['command_id']} not found!"]);
        }
    }

    public static function parseIncomingBetJson($json)
    {
        $getSportLabel = function ($sport) {
            $firstOccurrence = array_search($sport, [
                'VOLLEYBALL' => 'Vo',
                'HOCKEY' => 'IH',
                'BASKETBALL' => 'B',
                'FOOTBALL' => 'SOC',
                'HANDBALL' => 'HB',
                'TENNIS' => 'T',
            ]);
            $secondOccurrence = array_search($sport, [
                'FOOTBALL' => 'FOOTBALL',
                'TENNIS' => 'TENNIS',
            ]);
            if (!empty($firstOccurrence)) {
                return $firstOccurrence;
            } elseif (!empty($secondOccurrence)) {
                return $secondOccurrence;
            } else {
                return 'BASEBALL';
            }
        };
        $parseTimeValue = function ($draft) {
            $timeValue = trim($draft);
            $accordance = [
                'Full Time Incl. OT' => 'FULL_TIME',
                'Full Time' => 'FULL_TIME',
                '1_TIME' => '1st Half',
                '1st Period' => '1_PERIOD',
                '2nd Period' => '2_PERIOD',
                '3rd Period' => '3_PERIOD',
                '1Q' => '1_QUARTER',
                '2Q' => '2_QUARTER',
                '3Q' => '3_QUARTER',
                '4Q' => '4_QUARTER',
                '1st Set' => '1_SET',
                '2nd Set' => '2_SET',
                '3rd Set' => '3_SET',
                '1st Inning' => '1_INNING'
            ];
            return $accordance[$timeValue] ?? 'FULL_MATCH';
        };
        $parseForecast = function ($draft) {
            $forecast = trim($draft);
            $forecastArr = explode(' ', $forecast);
            $count = count($forecastArr);
            if ($count === 1) {
                $accordance = [
                    'Ф1' => ['market' => 'HDP', 'target' => 'HOME', 'pivot' => ''],
                    'Ф2' => ['market' => 'HDP', 'target' => 'AWAY', 'pivot' => ''],
                    'ТМ' => ['market' => 'TOTAL', 'target' => 'UNDER', 'pivot' => ''],
                    'ТБ' => ['market' => 'TOTAL', 'target' => 'OVER', 'pivot' => ''],
                    'П1' => ['market' => 'ONE_TWO', 'target' => 'ONE', 'pivot' => ''],
                    'П2' => ['market' => 'ONE_TWO', 'target' => 'TWO', 'pivot' => ''],
                ];
                return $accordance[$forecastArr[0]] ?? false;
            } elseif ($count === 2) {
                if (strpos($forecast, 'Хозяева ТБ') !== false) {
                    $pivot = str_replace('Хозяева ТБ', "", $forecast);
                    $idx = 'T1B';
                } elseif (strpos($forecast, 'Хозяева ТМ') !== false) {
                    $pivot = str_replace('Хозяева ТМ', "", $forecast);
                    $idx = 'T1M';
                } elseif (strpos($forecast, 'Гости ТБ') !== false) {
                    $pivot = str_replace('Гости ТБ', "", $forecast);
                    $idx = 'T2B';
                } elseif (strpos($forecast, 'Гости ТМ') !== false) {
                    $pivot = str_replace('Гости ТМ', "", $forecast);
                    $idx = 'T2M';
                } else {
                    $pivot = '';
                    $idx = '';
                }
                if (empty($idx)) {
                    $pivot = is_numeric($forecastArr[1]) ? $forecastArr[1] : '';
                    $idx = ($forecastArr[0] == '(1x2)') ? $forecastArr[1] : $forecastArr[0];
                }
                $accordance = [
                    'T1B' => ['market' => 'T1_TOTAL', 'target' => 'OVER', 'pivot' => $pivot],
                    'T1M' => ['market' => 'T1_TOTAL', 'target' => 'UNDER', 'pivot' => $pivot],
                    'T2B' => ['market' => 'T2_TOTAL', 'target' => 'OVER', 'pivot' => $pivot],
                    'T2M' => ['market' => 'T2_TOTAL', 'target' => 'UNDER', 'pivot' => $pivot],
                    'Ф1' => ['market' => 'HDP', 'target' => 'HOME', 'pivot' => $pivot],
                    'Ф2' => ['market' => 'HDP', 'target' => 'AWAY', 'pivot' => $pivot],
                    'ТМ' => ['market' => 'TOTAL', 'target' => 'UNDER', 'pivot' => $pivot],
                    'ТБ' => ['market' => 'TOTAL', 'target' => 'OVER', 'pivot' => $pivot],
                    'П1' => ['market' => 'ONE_TWO', 'target' => 'ONE', 'pivot' => $pivot],
                    'П2' => ['market' => 'ONE_TWO', 'target' => 'TWO', 'pivot' => $pivot],
                    'Хозяева' => ['market' => 'ONE_TWO', 'target' => 'ONE', 'pivot' => $pivot],
                    'Гости' => ['market' => 'ONE_TWO', 'target' => 'TWO', 'pivot' => $pivot],
                    'Ничья' => ['market' => 'ONE_TWO', 'target' => 'DRAW', 'pivot' => $pivot],
                    'Over' => ['market' => 'TOTAL', 'target' => 'OVER', 'pivot' => $pivot],
                ];
                return $accordance[$idx] ?? false;
            } else {
                $pivot = is_numeric($forecastArr[2]) ? $forecastArr[2] : '';
                if (strpos($forecast, 'Хозяева ТБ') !== false) {
                    $idx = 'T1B';
                } elseif (strpos($forecast, 'Хозяева ТМ') !== false) {
                    $idx = 'T1M';
                } elseif (strpos($forecast, 'Гости ТБ') !== false) {
                    $idx = 'T2B';
                } elseif (strpos($forecast, 'Гости ТМ') !== false) {
                    $idx = 'T2M';
                } elseif (strpos($forecast, '(АН) Хозяева') !== false) {
                    $idx = 'HH';
                    if ($pivot === '-0.5') {
                        $idx = 'HHM';
                    } elseif ($pivot === '+0.5') {
                        $idx = 'HHP';
                    }
                    $pivot = floatval($pivot);
                    if ($pivot == -0) {
                        $pivot = 0;
                    }
                } elseif (strpos($forecast, '(АН) Гости') !== false) {
                    $idx = 'HA';
                    if ($pivot === '-0.5') {
                        $idx = 'HAM';
                    } elseif ($pivot === '+0.5') {
                        $idx = 'HAP';
                    }
                    $pivot = floatval($pivot);
                    if ($pivot == -0) {
                        $pivot = 0;
                    }
                } elseif (strpos($forecast, '(O/U) ТБ') !== false) {
                    $idx = 'TO';
                } elseif (strpos($forecast, '(O/U) ТМ') !== false) {
                    $idx = 'TU';
                } else {
                    $idx = '';
                }
                $accordance = [
                    'HHM' => ['market' => 'ONE_TWO', 'target' => 'ONE', 'pivot' => $pivot],
                    'HHP' => ['market' => 'ONE_TWO', 'target' => 'ONE_DRAW', 'pivot' => $pivot],
                    'HAM' => ['market' => 'ONE_TWO', 'target' => 'TWO', 'pivot' => $pivot],
                    'HAP' => ['market' => 'ONE_TWO', 'target' => 'TWO_DRAW', 'pivot' => $pivot],
                    'HH' => ['market' => 'HDP', 'target' => 'HOME', 'pivot' => $pivot],
                    'HA' => ['market' => 'HDP', 'target' => 'AWAY', 'pivot' => $pivot],
                    'T1B' => ['market' => 'T1_TOTAL', 'target' => 'OVER', 'pivot' => $pivot],
                    'T1M' => ['market' => 'T1_TOTAL', 'target' => 'UNDER', 'pivot' => $pivot],
                    'T2B' => ['market' => 'T2_TOTAL', 'target' => 'OVER', 'pivot' => $pivot],
                    'T2M' => ['market' => 'T2_TOTAL', 'target' => 'UNDER', 'pivot' => $pivot],
                    'TU' => ['market' => 'TOTAL', 'target' => 'UNDER', 'pivot' => $pivot],
                    'TO' => ['market' => 'TOTAL', 'target' => 'OVER', 'pivot' => $pivot],
                ];
                return $accordance[$idx] ?? false;
            }
        };
        $getBkLabel = function ($draft) {
            $labels = [
                "1XBET" => "1xBet",
                "1XSTAVKA" => "1xStavka",
                "21BET" => "21Bet",
                "888SPORT" => "888sport",
                "BET365" => "Bet365",
                "BETCITY" => "BetCity",
                "BFSPORTSBOOK" => "BetFair",
                "BWIN" => "BWin",
                "CLOUDBET" => "CloudBet",
                "FAVBET" => "Favbet",
                "FONBET" => "Fon",
                "FONBET.CUPIS" => "Fon Cupis",
                "LEON" => "Leon",
                "LIGASTAVOK" => "Liga Stavok",
                "MARATHON" => "Марафон",
                "BET8GR" => "Mostobet",
                "OLIMP" => "Olimp",
                "PADDYPOWER" => "PaddyPower",
                "PARIMATCH" => "PariMatch",
                "TENNISI" => "Tennisi",
                "TITAN" => "Titanbet",
                "UNIBET" => "Unibet",
                "WILLIAMHILL" => "WilliamHill",
                "WINLINE.CUPIS" => "Winline Cupis",
                "WINLINEBET" => "Winlinebet",
            ];
            $key = array_search($draft, $labels);
            return empty($key) ? 'FONBET' : $key;
        };
        $response = [];
        $response['sport'] = $getSportLabel($json['sport']);
        $response["time_value"] = $parseTimeValue($json['time_value']);
        $response['type'] = $json['mode'] ?? 'PREMATCH';
        $response["league"] = $json['league'];
        $response["team1"] = $json['team1'];
        $response["team2"] = $json['team2'];
        $response["home"] = $response["team1"];
        $response["away"] = $response["team2"];
        $forecast = $parseForecast($json['forecast']);
        $date = date('Y/m/d', time());
        if (!empty($forecast)) {
            $response["market"] = $forecast['market'];
            $response["date"] = $date;
            $response["target"] = $forecast['target'];
            $response["coef"] = $json['coefficient'];
            $response["stake"] = '100';
            $response["score"] = '';
            if ($forecast['pivot'] !== '') {
                $response["pivot"] = $forecast['pivot'];
            }
        }
        $response["team1"] = preg_replace('/\(.*?\)/', '', $response["team1"]);
        $response["team2"] = preg_replace('/\(.*?\)/', '', $response["team2"]);
        $response["capper_id"] = $json['capper'];
        $response["bk"] = $getBkLabel($json['bookmaker']);
        $response["source"] = $json['capper'];
        return $response;
    }

    /**
     * @param $name - internal bookie name
     * @return FileGroups|null
     * @throws NotFoundHttpException
     */
    private static function getBookie($name): ?FileGroups
    {
        $mappings = FileGroups::getBkMapping();
        if (in_array($name, ['BTC', 'NETELLER', 'QIWI', 'SKRILL', 'PM', 'PAYEER'])) {
            $bookie = null;
        } else {
            $internal_name = array_search($name, $mappings);
            if ($internal_name === false) {
                throw new \yii\web\NotFoundHttpException("Internal name '{$name}' not found!");
            }
            $bookie = FileGroups::findOne(['bk_internal' => $internal_name]);
            if (empty($bookie)) {
                throw new \yii\web\NotFoundHttpException("FileGroup for '$internal_name' not found!");
            }
        }
        return $bookie;
    }

    /**
     * @param $params [ bk, login, password, phone, uid, ws_url, email, email_password, urls, use_chrome, profile, restart, testing ]
     * @return Bots
     * @throws NotFoundHttpException
     */
    private static function createBot($params): Bots
    {
        $bot = new Bots();
        $betexy_bot_id = empty($params['betexy_bot_id']) ? 1 : $params['betexy_bot_id'];
        $bot->end = self::getEnd($betexy_bot_id);
        $bot->multilogin_profile_name = $params['profile'];
        $bot->logic_name = 'logic';
        $bot->websocket_uid = $params['uid'];
        // Hint: not a very good solution to determine betexy bot, but why not?
        $bot->websocket_url = !empty($bot->end) ? "ws://77.232.40.91:9091" : $params['ws_url'];
        $bot->thisIsTemp = true;
        $bot->use_chrome = empty($params['use_chrome']) ? false : $params['use_chrome'];
        $bot->restart = empty($params['restart']) ? false : $params['restart'];
        $bot->experimental = empty($params['experimental']) ? false : $params['experimental'];
        $bot->tempParams = [
            'login' => empty($params['login']) ? "" : $params['login'],
            'password' => empty($params['password']) ? "" : $params['password'],
            'url' => empty($params['phone']) ? "" : $params['phone'],
            'urls' => empty($params['urls']) ? "" : $params['urls'],
            'email' => empty($params['email']) ? "" : $params['email'],
            'email_password' => empty($params['email_password']) ? "" : $params['email_password'],
            'second_name' => empty($params['second_name']) ? '' : $params['second_name'],
            'betexy_bot_id' => $betexy_bot_id,
        ];
        if (!empty($params['fork'])) {
            $bot->tempParams['fork'] = $params['fork'];
        }
        if (!empty($params['buyer'])) {
            $bot->tempParams['buyer'] = $params['buyer'];
        }
        $commands = self::parseCommands($params['comment']);
        if (!empty($commands['cas'])) {
            $stakeForks = self::getStakeForks($commands['cas'], $params['uid']);
            if (!empty($stakeForks)) {
                $params['stake_forks'] = $stakeForks;
            }
        }
        if (!empty($commands['register'])) {
            $register = self::getRegister($commands['register']);
            if (!empty($register)) {
                $bot->tempParams['register'] = $register;
            }
        }
        if (!empty($commands['qr'])) {
            $b365 = self::getBet365($commands['qr']);
            if (!empty($b365)) {
                $bot->tempParams['bet365'] = $b365;
            }
        }
        if (!empty($commands['fork'])) {
            $params['stake_forks'] = self::getStakeForks($commands['cas'], $params['uid'], true);
            if (!empty($params['stake_forks'])) {
                $bot->tempParams['fork_second_bookie'] = $params['stake_forks'][0]['second_bookie'];
            }
        }
        if (!empty($params['stake_forks'])) {
            foreach ($params['stake_forks'] as $key => $sf) {
                $bot->tempParams['stake_forks'][$key] = self::prepareStakeFork($sf);
            }
        }
        return $bot;
    }

    private static function parseCommands($comment): array
    {
        $res = [];
        $matches = [];
        preg_match_all('/\[(.*?)](.*?)(?=\[|$)/s', $comment, $matches);
        if (empty($matches) || count($matches) !== 3) {
            return $res;
        }
        for ($i = 0; $i < count($matches[0]); $i++) {
            $res[$matches[1][$i]] = $matches[2][$i];
        }
        return $res;
    }

    /**
     * @throws NotFoundHttpException
     */
    private static function getEnd($betexy_bot_id): int
    {
        if (empty($betexy_bot_id) || $betexy_bot_id === 1) {
            return 0;
        }
        $xbot = Xbots::findOne(['betexy_bot_id' => $betexy_bot_id]);
        if (empty($xbot) || empty($xbot->active)) {
            throw new NotFoundHttpException(\Yii::t('BotManager',
                "No bot $betexy_bot_id or bot inactive!"));
        }
        // For our bots, firstly
        if (empty($xbot->due_date)) {
            return 0;
        }
        $now = (int)time();
        $till = (int)strtotime($xbot->due_date . " 23:59:59");
        if ($now >= $till) {
            throw new NotFoundHttpException(\Yii::t('BotManager', 'Bot expired!'));
        }
        return $till;
    }

    private static function getRealFile(Files $file, $testing = false)
    {
        if (!$testing) {
            return $file;
        }
        $testOne = Files::findOne([
            'tag' => 'Testing',
            'source_name' => $file->source_name,
            'source_path' => $file->source_path
        ]);
        return empty($testOne) ? $file : $testOne;
    }

    private static function getBoth($comment, $uid): array
    {
        $firstDelimiter = strpos($comment, '|');
        $registerDraft = substr($comment, 0, $firstDelimiter);
        $stakesForksDraft = substr($comment, $firstDelimiter + 1);
        return [self::getRegister($registerDraft), self::getStakeForks($stakesForksDraft, $uid)];
    }

    private static function getBet365($comment): array
    {
        // longitude;latitude;country;proxy;api-key
        // proxy is - (http|socks5)://[user:pass@]host:port
        $b365s = array_map(function ($p) {
            return trim($p);
        }, explode(';', $comment));
        if (count($b365s) !== 5) {
            return [];
        }
        return [
            'latitude' => $b365s[0],
            'longitude' => $b365s[1],
            'country' => $b365s[2],
            'proxy' => $b365s[3],
            'apikey' => $b365s[4],
        ];
    }

    private static function getRegister($comment): array
    {
        $registers = array_map(function ($p) {
            return trim($p);
        }, explode(';', $comment));
        $register = [];
        if (count($registers) >= 10) {
            $register = [
                'email' => $registers[0],
                'login' => $registers[1],
                'password' => $registers[2],
                'birthdate' => $registers[3],
                'name' => $registers[4],
                'last_name' => $registers[5],
                'country' => $registers[6],
                'address' => $registers[7],
                'city' => $registers[8],
                'zip' => $registers[9],
                'job' => $registers[10],
                'amount' => empty($registers[11]) ? '10' : $registers[11],
                'binance_api' => empty($registers[12]) ? '1' : $registers[12],
            ];
        }
        return $register;
    }

    private static function getStakeForks($comment, $uid, $onlyForks = false): array
    {
        $stakeForks = [];
        $forks = array_map(function ($p) {
            return trim($p);
        }, explode('|', $comment));
        foreach ($forks as $fork) {
            list($fId, $fStake) = array_map(function ($p) {
                return trim($p);
            }, explode(';', $fork));
            $config = Configs::findOne($fId);
            if (empty($config) || empty($fStake)) {
                continue;
            }
            if ($onlyForks && !$config->is_fork) {
                continue;
            }
            $stakeForks[] = self::fillStakeFork($config, $uid, $fStake);
            foreach ($config->getChildConfigs()->all() as $child) {
                $stakeForks[] = self::fillStakeFork($child, $uid, $fStake);
            }
        }
        return $stakeForks;
    }

    private static function fillStakeFork($config, $uid, $fStake): array
    {
        return [
            "bookie" => $config->bookie,
            "second_bookie" => $config->is_fork ? $config->second_bookie : '',
            "uid" => $uid,
            "url" => $config->url,
            "source" => !empty($config->source) ? $config->source : "oddscp",
            "currency" => !empty($config->currency) ? $config->currency : "USD",
            "eventTimeLimit" => !empty($config->eventTimeLimit) ? $config->eventTimeLimit : 7200,
            "eventMaxBets" => !empty($config->eventMaxBets) ? $config->eventMaxBets : 3,
            "successBetInterval" => !empty($config->successBetInterval) ? (int)$config->successBetInterval * 1000 : 30000,
            "stake" => trim($fStake),
            "coefFrom" => !empty($config->coefFrom) ? $config->coefFrom : 0,
            "coefTo" => !empty($config->coefTo) ? $config->coefTo : 0,
            "incomeFrom" => !empty($config->incomeFrom) ? $config->incomeFrom : 0,
            "incomeTo" => !empty($config->incomeTo) ? $config->incomeTo : 0,
            "lastScoreTennis" => !empty($config->lastScoreTennis) ? $config->lastScoreTennis : "",
            "lastScoreBasketball" => !empty($config->lastScoreBasketball) ? $config->lastScoreBasketball : "",
            "excludeSports" => !empty($config->excludeSports) ? $config->excludeSports : "",
            "excludeMarkets" => !empty($config->excludeMarkets) ? $config->excludeMarkets : "",
            "excludeTargets" => !empty($config->excludeTargets) ? $config->excludeTargets : "",
            "excludePivots" => !empty($config->excludePivots) ? $config->excludePivots : "",
            "excludeBets" => !empty($config->excludeBets) ? $config->excludeBets : "",
            "excludeLeagues" => !empty($config->excludeLeagues) ? $config->excludeLeagues : "",
            "excludeSportMarketTarget" => !empty($config->excludeSportMarketTarget) ? $config->excludeSportMarketTarget : "",
            "express" => !empty($config->express) ? 1 : 0,
            "new_expresses" => !empty($config->new_expresses) ? 1 : 0,
            "onlySecondBookie" => !empty($config->onlySecondBookie) ? $config->onlySecondBookie : [],
        ];
    }

    private static function checkActionBeforeSend(BotsQueue $action)
    {
        $action_id = !empty($action->run_after_success) ? $action->run_after_success : $action->run_after_fail;
        $checkAction = BotsQueue::findOne($action_id);
        if (empty($checkAction)) {
            $action->status = 3;
            $action->response = "FAIL: wrong run after {$action_id}!";
            $action->save();
            return false;
        } elseif ((!empty($action->run_after_success) && (int)$checkAction->status === 3)
            || (!empty($action->run_after_fail) && (int)$checkAction->status === 2)) {
            $action->status = 3;
            $action->response = "FAIL: action {$action_id} was " . BotsQueue::$statusesListShort[$checkAction->status] . "!";
            $action->save();
            return false;
        } elseif ((!empty($action->run_after_success) && (int)$checkAction->status !== 2)
            || (!empty($action->run_after_fail) && (int)$checkAction->status !== 3)) {
            return false;
        } elseif (time() - $checkAction->updated_at < 120) {
            return false;
        } else {
            return true;
        }
    }

    public static function getExtensionFile($filename, $name, $obfuscate = false, $withConsole = false)
    {
        if (!file_exists($filename)) {
            echo "File {$filename} ({$name}) does not exists!";
            die();
        }
        if (empty($obfuscate)) {
            return file_get_contents($filename);
        }
        $pi = pathinfo($filename);
        if ($pi['extension'] !== 'js' || strpos($name, '.min') !== false
            || in_array($name, ['libs/similar_text.js', 'libs/sodium.js', 'libs/levenshtein.js'])) {
            return file_get_contents($filename);
        }
        $modified = filemtime($filename);
        $obfuscated = [];
        $obfDir = __DIR__ . '/../../../files/';
        $obfFilename = $obfDir . str_replace(['/', '\\', ':'], '_', $filename) . '.obf'
            . (empty($withConsole) ? '' : 'c');
        if (file_exists($obfDir . 'obfuscated.json')) {
            $obfuscated = json_decode(file_get_contents($obfDir . 'obfuscated.json'), true);
        }
        if (empty($obfuscated[$filename]) || $obfuscated[$filename]['modified'] !== $modified
            || !file_exists($obfFilename)) {
            self::ol("Obfuscating {$filename} ({$name})" . ($withConsole ? ' WITH CONSOLE' : ''));
            self::ol(var_export($pi, true));
            self::obfuscateFile($filename, $obfFilename, $name, $withConsole);
            $obfuscated[$filename] = $obfuscated[$filename] ?? [];
            $obfuscated[$filename]['modified'] = $modified;
            $obfuscated[$filename]['name'] = $name;
            $obfuscated[$filename]['obfuscated_' . ($withConsole ? 'wc_' : '') . 'filename'] = $obfFilename;
        }
        file_put_contents($obfDir . 'obfuscated.json', json_encode($obfuscated, JSON_PRETTY_PRINT));
        return file_get_contents($obfFilename);
    }

    private static function obfuscate($content, $debug = ''): string
    {
        self::ol("Obfuscating content " . strlen($content));
        $sourceTmp = tempnam(sys_get_temp_dir(), 'src') . '.js';
        $targetTmp = tempnam(sys_get_temp_dir(), 'obf') . '.js';
        file_put_contents($sourceTmp, $content);
        self::obfuscateFile($sourceTmp, $targetTmp, $debug);
        $result = file_get_contents($targetTmp);
        try {
            unlink($sourceTmp);
            unlink($targetTmp);
        } catch (\Exception $e) {
            self::ol($e->getMessage());
        }
        return $result;
    }

    private static function obfuscateFile($source, $target, $debug = '', $withConsole = false)
    {
        self::ol("Obfuscating {$source} to {$target} ({$debug})" . ($withConsole ? ' WITH CONSOLE' : ''));
        $flag = $withConsole ? 'false' : 'true';
        $opts = [
            "--compact true",
            //"--config <string>",
            "--control-flow-flattening true",
            "--control-flow-flattening-threshold 1",
            "--dead-code-injection true",
            "--dead-code-injection-threshold 1",
            "--debug-protection {$flag}",
            "--debug-protection-interval 4000",
            "--disable-console-output {$flag}",
            //"--domain-lock '<list>' (comma separated)",
            //"--domain-lock-redirect-url <string>",
            // "--exclude '<list>' (comma separated)",
            //"--force-transform-strings '<list>' (comma separated)",
            //"--identifier-names-cache-path <string>",
            "--identifier-names-generator \"hexadecimal\"",
            //"--identifiers-dictionary '<list>' (comma separated)",
            //"--identifiers-prefix <string>",
            "--ignore-imports false",
            "--log false",
            "--numbers-to-expressions true",
            "--options-preset \"high-obfuscation\"",
            "--rename-globals false",
            "--rename-properties false",
            "--rename-properties-mode \"safe\"",
            //"--reserved-names '<list>' (comma separated)",
            //"--reserved-strings '<list>' (comma separated)",
            //"--seed 1234567",
            "--self-defending true",
            "--simplify true",
            "--source-map false",
            //"--source-map-base-url <string>",
            //"--source-map-file-name <string>",
            //"--source-map-mode <string> [inline, separate]",
            //"--source-map-sources-mode <string> [sources, sources-content]",
            "--split-strings true",
            "--split-strings-chunk-length 5",
            "--string-array true",
            "--string-array-calls-transform false",
            "--string-array-calls-transform-threshold 1",
            "--string-array-encoding \"rc4\"",
            "--string-array-indexes-type \"hexadecimal-number\"",
            "--string-array-index-shift true",
            "--string-array-rotate true",
            "--string-array-shuffle true",
            "--string-array-wrappers-count 5",
            "--string-array-wrappers-chained-calls true",
            "--string-array-wrappers-parameters-max-count 5",
            "--string-array-wrappers-type \"function\"",
            "--string-array-threshold 1",
            "--target browser",
            "--transform-object-keys true",
            //"--unicode-escape-sequence <boolean>",
        ];
        $options = implode(' ', $opts);
        $command = "javascript-obfuscator {$source} --output {$target}1 {$options} --log true";
        $started = microtime(true);
        $res = shell_exec($command);
        // file_put_contents(__DIR__ . '/../../../111.log', date('Y-m-d H:i:s') . " $debug execution time: "
        // . (microtime(true) - $started) . PHP_EOL, FILE_APPEND);
        $pi = pathinfo($source);
        self::ol(var_export($pi, true));
        $mvCommand = "mv {$target}1/{$pi['basename']} {$target}";
        $mvRes = shell_exec($mvCommand);
        try {
            rmdir("{$target}1");
        } catch (\Exception $e) {
            self::ol($e->getMessage());
        }
        self::ol("{$command}\n\r{$res}\n\r{$mvCommand}\n\r{$mvRes}");
    }

    private static function ol($m)
    {
        if (getenv('WRITE_OBFUSCATION_LOG') === 'true') {
            file_put_contents(__DIR__ . '/../../../obfuscation.log', "$m\r\n", FILE_APPEND);
        }
    }

    private static function prepareManifestV3(Bots $bot)
    {
        $tpl = file_get_contents(__DIR__ . '/tpls/manifest_v3.tpl');
        $parts = require __DIR__ . '/tpls/manifestPartsV3.php';
        $bkSettings = (new BkSettingsForm())->loadData();
        $activeBks = [];
        $includeJsFor = [];
        $contentScripts = [];
        $pariOff = false;
        $contentCheckSpecial = false;
        foreach ($bot->botsBksLink as $bkLink) {
            if (!empty($bkSettings->bkCheckSpecial[$bkLink->bk->bk_internal])) {
                $contentCheckSpecial = true;
            }
            $activeBks[] = $bkLink->bk->bk_internal;
            if (empty($bkSettings->bkUrls[$bkLink->bk->bk_internal])) {
                continue;
            }
            $urls = implode(', ', $bkSettings->bkUrls[$bkLink->bk->bk_internal]);
            $jsFiles = is_array($bkSettings->bkScripts[$bkLink->bk->bk_internal])
                ? implode(', ', array_map(function ($p) {
                    return '"js/' . $p . '"';
                }, $bkSettings->bkScripts[$bkLink->bk->bk_internal]))
                : '"js/' . $bkSettings->bkScripts[$bkLink->bk->bk_internal] . '"';
            $includeJsFor[] = '                ' . $urls;
            $contentScripts[] = str_replace(
                ['#JS#', '#MATCHES#', '#BET365#', '#PARIBY#',],
                [
                    $jsFiles,
                    $urls,
                    in_array($bkLink->bk->bk_internal, array_keys($bkSettings->bkAllFrames)) ? $parts['for_all_frames'] : '',
                    $bkLink->bk->bk_internal === 'pariby' ? $parts['for_match_about_blank'] : '',
                ],
                $parts['content_script']
            );
            if ($bkLink->bk->bk_internal === 'parimatch') {
                $pariOff = true;
            }
        }
        $directs = ['        "directCommand.json"'];
        if ($pariOff) {
            $directs[] = '        "libs/pari_push_remover.js"';
        }
        $replace = [
            '#VERSION#' => $bot->extension->name,
            '#INCLUDE_JS_FOR#' => empty($includeJsFor)
                ? ''
                : ",\r\n" . str_replace(
                    ['#INCLUDE_JS_FOR#', '#PARRRIBY#',],
                    [
                        implode(",\r\n", $includeJsFor),
                        $bkLink->bk->bk_internal === 'pariby' ? $parts['for_match_about_blank'] : '',
                    ],
                    $parts['include_js_for']
                ),
            '#CONTENT_SCRIPTS#' => empty($contentScripts) ? '' : ",\r\n" . implode(",\r\n", $contentScripts) . "\r\n",
            '#DIRECT_RESOURCES#' => implode(",\r\n", $directs),
            '#DOCUMENT_START#' => empty($contentCheckSpecial) ? $parts['document_start'] : '',
        ];
        return str_replace(array_keys($replace), array_values($replace), $tpl);
    }

    private static function prepareManifest(Bots $bot)
    {
        $tpl = file_get_contents(__DIR__ . '/tpls/manifest.tpl');
        $parts = require __DIR__ . '/tpls/manifestParts.php';
        $bkSettings = (new BkSettingsForm())->loadData();
        $activeBks = [];
        $includeJsFor = [];
        $contentScripts = [];
        $pariOff = false;
        $contentCheckSpecial = false;
        foreach ($bot->botsBksLink as $bkLink) {
            if (!empty($bkSettings->bkCheckSpecial[$bkLink->bk->bk_internal])) {
                $contentCheckSpecial = true;
            }
            $activeBks[] = $bkLink->bk->bk_internal;
            if (empty($bkSettings->bkUrls[$bkLink->bk->bk_internal])) {
                continue;
            }
            $urls = implode(', ', $bkSettings->bkUrls[$bkLink->bk->bk_internal]);
            $jsFiles = is_array($bkSettings->bkScripts[$bkLink->bk->bk_internal])
                ? implode(', ', array_map(function ($p) {
                    return '"js/' . $p . '"';
                }, $bkSettings->bkScripts[$bkLink->bk->bk_internal]))
                : '"js/' . $bkSettings->bkScripts[$bkLink->bk->bk_internal] . '"';
            $includeJsFor[] = '                ' . $urls;
            $contentScripts[] = str_replace(
                ['#JS#', '#MATCHES#', '#BET365#', '#PARIBY#',],
                [
                    $jsFiles,
                    $urls,
                    in_array($bkLink->bk->bk_internal, array_keys($bkSettings->bkAllFrames)) ? $parts['for_all_frames'] : '',
                    $bkLink->bk->bk_internal === 'pariby' ? $parts['for_match_about_blank'] : '',
                ],
                $parts['content_script']
            );
            if ($bkLink->bk->bk_internal === 'parimatch') {
                $pariOff = true;
            }
        }
        $directs = ['        "directCommand.json"'];
        if ($pariOff) {
            $directs[] = '        "libs/pari_push_remover.js"';
        }
        $replace = [
            '#VERSION#' => $bot->extension->name,
            '#TENNISI_BACKGROUND#' => in_array('tennisi', $activeBks) ? $parts['tennisi_background'] : '',
            '#SODIUM#' => $parts['sodium_background'],
            '#INCLUDE_JS_FOR#' => empty($includeJsFor)
                ? ''
                : ",\r\n" . str_replace(
                    ['#INCLUDE_JS_FOR#', '#PARRRIBY#',],
                    [
                        implode(",\r\n", $includeJsFor),
                        $bkLink->bk->bk_internal === 'pariby' ? $parts['for_match_about_blank'] : '',
                    ],
                    $parts['include_js_for']
                ),
            '#CONTENT_SCRIPTS#' => empty($contentScripts) ? '' : ",\r\n" . implode(",\r\n", $contentScripts) . "\r\n",
            '#LOGIC_NAME#' => $bot->logic_name,
            '#DIRECT_RESOURCES#' => implode(",\r\n", $directs),
            '#DOCUMENT_START#' => empty($contentCheckSpecial) ? $parts['document_start'] : '',
        ];
        //foreach ($bot->extension->bkSettings as $override) {
        //    $replace[$parts['urls'][$override->bk_internal]] = $override->url_one;
        //}

        return str_replace(array_keys($replace), array_values($replace), $tpl);
    }

    private static function prepareStakeForks(array $sfs, $one = false): string
    {
        $makeOne = function ($stake) {
            $express = empty($stake['express']) ? '' : "\n                    express: 1,";
            $new_expresses = empty($stake['new_expresses']) ? '' : "\n                    new_expresses: 1,";
            return "{
                    bookie: '{$stake['bookie']}',
                    uid: '{$stake['uid']}',
                    linkToParser: '{$stake['url']}',
                    url: '{$stake['url']}',
                    source: '{$stake['source']}',
                    currency: '{$stake['currency']}',
                    eventTimeLimit: '{$stake['eventTimeLimit']}',
                    eventMaxBets: '{$stake['eventMaxBets']}',             
                    successBetInterval: '{$stake['successBetInterval']}',             
                    stake: '{$stake['stake']}',  
                    coefFrom: '{$stake['coefFrom']}',  
                    coefTo: '{$stake['coefTo']}',  
                    incomeFrom: '{$stake['incomeFrom']}',  
                    incomeTo: '{$stake['incomeTo']}',  
                    lastScoreTennis: '{$stake['lastScoreTennis']}',  
                    lastScoreBasketball: '{$stake['lastScoreBasketball']}',  
                    excludeSports: {$stake['excludeSports']},
                    excludeMarkets: {$stake['excludeMarkets']},
                    excludeTargets: {$stake['excludeTargets']},
                    excludePivots: {$stake['excludePivots']},
                    excludeBets: {$stake['excludeBets']},
                    excludeLeagues: {$stake['excludeLeagues']},
                    onlySecondBookie: " . json_encode($stake['onlySecondBookie']) . ",
                    excludeSportMarketTarget: {$stake['excludeSportMarketTarget']},{$express}{$new_expresses}
                }";
        };
        if (!$one) {
            $stakes = [];
            foreach ($sfs as $stake) {
                $stakes[] = $makeOne($stake);
            }
            return "[" . implode(", ", $stakes) . "]";
        } else {
            return $makeOne($sfs[0]);
        }
    }

    /**
     * @throws \SodiumException
     */
    private static function prepareSettings(Bots $bot, $withoutFile = false, $special = false): string
    {
        $tpl = file_get_contents(__DIR__ . '/tpls/settings' . ($special ? '_special' : '') . '.tpl');
        $expiresAt = '+1 month';
        if (!empty($bot->end)) {
            $days = ceil(($bot->end - time()) / 86400);
            $expiresAt = '+ ' . ($days < 30 ? $days : 30) . ' days';
        }
        $activeBks = [];
        $credentials = [];
        $rewrites = [];
        $cl = function ($v) {
            return empty($v) ? '0' : $v;
        };
        foreach ($bot->botsBksLink as $bkLink) {
            $coefDecrease = empty($bkLink->buyer['coefDecrease']) ? 0 : $bkLink->buyer['coefDecrease'];
            $amount = empty($bkLink->buyer['amount']) ? 0 : $bkLink->buyer['amount'];
            $forkText = !empty($bkLink->fork) ? "{
                    bookie: '{$bkLink->fork['bookie']}',
                    uid: '{$bkLink->fork['uid']}',
                    shoulder: '{$bkLink->fork['shoulder']}',    
                    betAmount: {$cl($bkLink->fork['betAmount'])},
                    maxWait: {$cl($bkLink->fork['maxWait'])},
                    maxLosePercent: {$cl($bkLink->fork['maxLosePercent'])},         
                    minWinPercent: {$cl($bkLink->fork['minWinPercent'])},         
                }" : "";
            $buyerText = !empty($bkLink->buyer) ? "{
                    uid: '{$bkLink->buyer['uid']}',
                    secret: '{$bkLink->buyer['secret']}',
                    amount: {$amount},
                    coefDecrease: {$coefDecrease},
                    waitBetmax: " . (empty($bkLink->buyer['waitBetmax']) ? 'false' : 'true') . ",
                    sendToAll: " . (empty($bkLink->buyer['sendToAll']) ? 'false' : 'true') . ",
                }" : "";
            $registerText = !empty($bkLink->register) ? "{
                    email: '{$bkLink->register["email"]}',
                    login: '{$bkLink->register["login"]}',
                    password: '{$bkLink->register["password"]}',
                    birthdate: '{$bkLink->register["birthdate"]}',
                    name: '{$bkLink->register["name"]}',
                    last_name: '{$bkLink->register["last_name"]}',
                    country: '{$bkLink->register["country"]}',
                    address: '{$bkLink->register["address"]}',
                    city: '{$bkLink->register["city"]}',
                    zip: '{$bkLink->register["zip"]}',
                    job: '{$bkLink->register["job"]}',
                    amount: '{$bkLink->register["amount"]}',
                    binance_api: '{$bkLink->register["binance_api"]}',
                }" : "";
            $bet365text = !empty($bkLink->bet365) ? "{
                    longitude: '{$bkLink->bet365["longitude"]}',
                    latitude: '{$bkLink->bet365["latitude"]}',
                    country: '{$bkLink->bet365["country"]}',
                    proxy: '{$bkLink->bet365["proxy"]}',
                    apikey: '{$bkLink->bet365["apikey"]}',
                }" : "";
            $stakeForksText = !empty($bkLink->stake_forks) ? self::prepareStakeForks($bkLink->stake_forks) : "";
            $activeBks[] = $bkLink->bk->bk_internal;
            $credentials[] = "\r\n// -= {$bkLink->bk->name} =-\r\n// {$bkLink->comment}\r\n'{$bkLink->bk->bk_internal}_login' : '{$bkLink->login}'"
                . ",\r\n'{$bkLink->bk->bk_internal}_password' : '" . addslashes($bkLink->password) . "'"
                . ",\r\n'{$bkLink->bk->bk_internal}_phone' : '{$bkLink->url}'"
                . ",\r\n'{$bkLink->bk->bk_internal}_email' : '{$bkLink->email}'"
                . ",\r\n'{$bkLink->bk->bk_internal}_email_password' : '{$bkLink->email_password}'"
                . ",\r\n'{$bkLink->bk->bk_internal}_urls' : '{$bkLink->urls}'"
                . ",\r\n'{$bkLink->bk->bk_internal}_second_name' : '{$bkLink->second_name}'"
                // Gen token if it needed, for betexy and our bots
                . (!empty($stakeForksText) && !empty($bkLink->betexy_bot_id)
                    ? ",\r\n{$bkLink->bk->bk_internal}_jwt : '" . self::genToken($bkLink->betexy_bot_id, $expiresAt) . "'\n" : "")
                . (!empty($bkLink->fork) ? ",\r\n{$bkLink->bk->bk_internal}_fork : {$forkText}\n" : "")
                . (!empty($bkLink->buyer) ? ",\r\n{$bkLink->bk->bk_internal}_buyer : {$buyerText}\n" : "")
                . (!empty($bkLink->register) ? ",\r\n{$bkLink->bk->bk_internal}_register : {$registerText}\n" : "")
                . (!empty($stakeForksText) ? ",\r\n{$bkLink->bk->bk_internal}_stakeForks : {$stakeForksText}\n" : "")
                . (!empty($bet365text) ? ",\r\n{$bkLink->bk->bk_internal}_qrCode : {$bet365text}\n" : "")
                . ($bkLink->bk->bk_internal === 'tennisi' ? ",\r\n{$bkLink->bk->bk_internal}_url : '*://*.tennisi.com/*'" : '');
            if (!empty($bkLink->urls)) {
                $rewrites[$bkLink->bk->bk_internal] = explode(';', $bkLink->urls)[0];
            }
        }

        $settings = new SettingsForm();
        $settings->loadData();

        $bkSettings = (new BkSettingsForm())->loadData($activeBks);

        $autoloaded = empty($activeBks) ? [] : array_keys($bkSettings->bkAutoload);
        $replace = [
            '#R#' => "\r\n",
            '#EXPIRES#' => (int)$bot->end,
            '#EXPEERIMENTAL#' => (int)$bot->experimental,
            '#USE_CHROME#' => (int)$bot->use_chrome,
            '#RESTART#' => (int)$bot->restart,
            '#PROFILE#' => $bot->multilogin_profile_name,
            '#WEBSOCKER_URL#' => $bot->websocket_url,
            '#WEBSOCKER_UID#' => $bot->websocket_uid,
            '#TEST_MODE_ON#' => empty($bot->test_mode_on) ? 'false' : 'true',
            '#TEST_URL#' => $bot->test_url,
            '#SMS_API_URL#' => $settings->sms_api_url,
            '#SMS_API_HTTP_LOGIN#' => $settings->sms_api_http_login,
            '#SMS_API_HTTP_PASSWORD#' => $settings->sms_api_http_password,
            '#PS_API_URL#' => $settings->ps_api_url,
            '#PS_API_HTTP_LOGIN#' => $settings->ps_api_http_login,
            '#PS_API_HTTP_PASSWORD#' => $settings->ps_api_http_password,
            '#EMAIL_API_URL#' => $settings->email_api_url,
            '#EMAIL_API_HTTP_LOGIN#' => $settings->email_api_http_login,
            '#EMAIL_API_HTTP_PASSWORD#' => $settings->email_api_http_password,
            '#SCREENSHOT_API_URL#' => $settings->screenshot_api_url,
            '#SCREENSHOT_API_HTTP_LOGIN#' => $settings->screenshot_api_http_login,
            '#SCREENSHOT_API_HTTP_PASSWORD#' => $settings->screenshot_api_http_password,
            '#DEFAULT_BK#' => empty($bot->defaultBk) ? '' : $bot->defaultBk->bk_internal,
            '#ACTIVE_BKS#' => empty($activeBks) ? '' : "'" . implode("', '", $activeBks) . "'",
            '#BK_CREDENTIALS#' => empty($credentials) ? '' : implode(", \r\n", $credentials),
            '#FORKS_RELOAD_INTERVAL#' => $settings->forks_reload_interval,
            '#COMMON_BKS#' => empty($activeBks) ? '' : implode(", \r\n", array_map(function ($k, $v) {
                return "'{$k}': '{$v}'";
            }, array_keys($bkSettings->bkMapping), array_values($bkSettings->bkMapping))),
            '#COMMON_BK_URLS#' => empty($activeBks) ? '' : implode(", \r\n", array_map(function ($k, $v) {
                return "'{$k}': '{$v}'";
            }, array_keys($bkSettings->bkStartUrls), array_values($bkSettings->bkStartUrls))),
            '#COMMON_BK_URL_CHECK#' => empty($activeBks) ? '' : implode(", \r\n", array_map(function ($k, $v) {
                return "'{$k}': '{$v}'";
            }, array_keys($bkSettings->bkUrlCheck), array_values($bkSettings->bkUrlCheck))),
            '#COMMON_AUTOLOAD#' => empty($autoloaded) ? '' : "'" . implode("', '", $autoloaded) . "'",
            '#COMMON_LIVEURL#' => empty($autoloaded) ? '' : implode(", \r\n", array_map(function ($k, $v) {
                return "'{$k}': '{$v}'";
            }, array_keys($bkSettings->bkLiveUrl), array_values($bkSettings->bkLiveUrl))),
            '#COMMON_AUTOCHECK#' => empty($autoloaded) ? '' : implode(", \r\n", array_map(function ($k, $v) {
                return "'{$k}': '{$v}'";
            }, array_keys($bkSettings->bkAutoCheck), array_values($bkSettings->bkAutoCheck))),
            '#COMMON_BKSCRIPTS#' => empty($autoloaded) ? '' : implode(", \r\n", array_map(function ($k, $v) {
                return "'{$k}': ['" . (is_array($v) ? implode("', '", $v) : $v) . "']";
            }, array_keys($bkSettings->bkScripts), array_values($bkSettings->bkScripts))),
            '#COMMON_COMMA#' => empty($credentials) ? '' : ',',
            '#WS2_ENABLED#' => $bot->double_enabled ? 'true' : 'false',
            '#WS2_URL#' => $bot->double_url,
            '#WS2_UID#' => $bot->websocket_uid,
            '#WS2_SERVER#' => $bot->server_name
        ];

        $url_rewrite = [];
        $settings_ur = [];
        if (empty($rewrites)) {
            foreach ($bot->extension->bkSettings as $row) {
                $url_rewrite[] = "'{$row->bk_internal}': '{$row->url_one}'";
                $settings_ur[$row->bk_internal] = $row->url_one;
            }
        } else {
            foreach ($rewrites as $bk => $url) {
                $url_rewrite[] = "'{$bk}': '{$url}'";
                $settings_ur[$bk] = $url;
            }
        }

        $replace['#URL_REWRITE#'] = implode(', ', $url_rewrite);

        $bkAutoCheck = $bkSettings->bkAutoCheck ?? [];
        array_walk($bkAutoCheck, function (&$val) {
            $val = empty($val) ? [] : json_decode($val);
        });

        if ($withoutFile) {
            return json_encode([
                'default_bk' => empty($bot->defaultBk) ? '' : $bot->defaultBk->bk_internal,
                'active_bks' => $activeBks,
                'url_rewrite' => $settings_ur,
                'bks' => $bkSettings->bkMapping,
                'bkUrls' => $bkSettings->bkStartUrls,
                'bkUrlCheck' => $bkSettings->bkUrlCheck,
                'autoloadBks' => $autoloaded,
                'bkLiveUrl' => $bkSettings->bkLiveUrl,
                'bkAutoCheck' => $bkAutoCheck,
            ]);
        } else {
            return str_replace(array_keys($replace), array_values($replace), $tpl);
        }
    }

    /**
     * @throws \SodiumException
     */
    public static function genToken($betexy_bot_id, $expires_at = '+1 month'): string
    {
        $signingKey = InMemory::plainText(Xbots::$jwtKey);
        $now = new DateTimeImmutable();
        $token = (new JwtFacade())->issue(
            new Sha256(),
            $signingKey,
            static fn(
                Builder           $builder,
                DateTimeImmutable $issuedAt
            ): Builder => $builder
                ->issuedAt($now)
                ->expiresAt($now->modify($expires_at))
                ->withClaim('ready', self::encrypt($betexy_bot_id))
        );
        return $token->toString();
    }

    /**
     * @throws \SodiumException
     * @throws \Exception
     */
    private static function encrypt($data): string
    {
        $key = hex2bin(base64_decode('N2ZiMzE2OTk2MWVkZTJhYzU2MWUwMzNkZmNiNWYxZTBkMTgxMmI4ZTI5NGFlN2Q1NzEyMDg5ZWVjODM1YzlmZQ=='));
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $encrypted = sodium_crypto_secretbox($data, $nonce, $key);
        return base64_encode(bin2hex($encrypted)) . base64_encode(bin2hex($nonce));
    }

    private static function prepareSoftwareIniFile($user_id, $bot_name)
    {
        $tpl = file_get_contents(__DIR__ . '/tpls/softwareIni.tpl');

        $defaults = new SettingsForm();
        $defaults->loadData();

        $replace = [
            '#BOT_NAME#' => $bot_name,
            '#SERVER_URL#' => str_replace(
                '#SLUG#',
                empty($defaults->users[$user_id]) ? '' : $defaults->users[$user_id],
                $defaults->server_url
            ),
            '#REPORTS_INTERVAL#' => $defaults->reports_interval,
            '#BOT_PATH#' => $defaults->bot_path,
            '#MAX#' => $defaults->max,
            '#MULTILOG#' => $defaults->multiloginapp_login,
            '#MULTIPASS#' => $defaults->multiloginapp_password,
            '#HTTP_LOG#' => $defaults->http_login,
            '#HTTP_PASS#' => $defaults->http_password,
        ];

        return str_replace(array_keys($replace), array_values($replace), $tpl);
    }

    private static function selectSoftware($os, $module)
    {
        return SoftwareVersions::findOne(['name' => $os . ($module ? "-$module" : '')]);
    }

    private static function typeOfComment($params): int
    {
        if (empty($params['comment'])) {
            return self::TYPE_EMPTY;
        }
        if ($params['bk'] !== 'STAKE') {
            return self::TYPE_B365;
        }
        if (mb_substr_count($params['comment'], ';') >= 10 && mb_substr_count($params['comment'], '|') > 0) {
            $subst = substr($params['comment'], strpos($params['comment'], '|') + 1);
            if (preg_match('/^\d+;\d+.*?/', $subst)) {
                return self::TYPE_BOTH;
            }
        }
        $isStakeFork = preg_match('/^\d+;\d+.*?/', $params['comment']);
        $isRegister = !$isStakeFork && mb_substr_count($params['comment'], ';') >= 10
            && mb_substr_count($params['comment'], '|') === 0;
        if ($isStakeFork) {
            return self::TYPE_STAKE_FORK;
        } elseif ($isRegister) {
            return self::TYPE_REGISTER;
        } else {
            return self::TYPE_UNKNOWN;
        }
    }

}
