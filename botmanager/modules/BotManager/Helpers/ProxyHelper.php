<?php

namespace app\modules\BotManager\Helpers;

use app\modules\BotManager\models\Proxies;
use app\modules\BotManager\models\SettingsForm;
use app\modules\BotManager\models\StakeAccounts;
use Yii;
use yii\db\Exception;
use yii\helpers\Json;
use yii\helpers\VarDumper;
use yii\web\BadRequestHttpException;

class ProxyHelper
{
    private $logging = true;

    private static $instance = null;
    private $apiKey;
    private $betexyKey = 'Buka6ZFx$4Musdu!qR@kEQyEn';
    private $url = 'https://panel.proxyline.net/api';
    private $betexy_url = 'https://cloud.betexy.com/dark';
    private $luminati_url = 'https://api.brightdata.com/zone/ips/refresh';
    private $betexy_login;


    private $countries = [
        'ru' => 'Россия',
        'ca' => 'Канада',
        'us' => 'США',
        'de' => 'Германия',
        'gb' => 'Великобритания',
        'nl' => 'Нидерланды',
        'es' => 'Испания',
        'it' => 'Италия',
        'id' => 'Индонезия',
        'cn' => 'Китай',
        'in' => 'Индия',
        'jp' => 'Япония',
        'au' => 'Австралия',
        'at' => 'Австрия',
        'az' => 'Азербайджан',
        'al' => 'Албания',
        'dz' => 'Алжир',
        'ar' => 'Аргентина',
        'am' => 'Армения',
        'bd' => 'Бангладеш',
        'by' => 'Беларусь',
        'be' => 'Бельгия',
        'bg' => 'Болгария',
        'bo' => 'Боливия',
        'ba' => 'Босния и Герцеговина',
        'br' => 'Бразилия',
        'hu' => 'Венгрия',
        've' => 'Венесуэла',
        'vn' => 'Вьетнам',
        'gr' => 'Греция',
        'ge' => 'Грузия',
        'eg' => 'Египет',
        'zm' => 'Замбия',
        'il' => 'Израиль',
        'ie' => 'Ирландия',
        'is' => 'Исландия',
        'kz' => 'Казахстан',
        'qa' => 'Катар',
        'ke' => 'Кения',
        'cy' => 'Кипр',
        'co' => 'Колумбия',
        'cr' => 'Коста-Рика',
        'cu' => 'Куба',
        'kg' => 'Кыргызстан',
        'lv' => 'Латвия',
        'lr' => 'Либерия',
        'lb' => 'Ливан',
        'lt' => 'Литва',
        'lu' => 'Люксембург',
        'my' => 'Малайзия',
        'mv' => 'Мальдивы',
        'ma' => 'Марокко',
        'mx' => 'Мексика',
        'md' => 'Молдова',
        'mc' => 'Монако',
        'mn' => 'Монголия',
        'np' => 'Непал',
        'nz' => 'Новая Зеландия',
        'no' => 'Норвегия',
        'ae' => 'ОАЭ',
        'py' => 'Парагвай',
        'pe' => 'Перу',
        'pl' => 'Польша',
        'pt' => 'Португалия',
        'ro' => 'Румыния',
        'sa' => 'Саудовская Аравия',
        'sc' => 'Сейшелы',
        'rs' => 'Сербия',
        'sg' => 'Сингапур',
        'sk' => 'Словакия',
        'si' => 'Словения',
        'th' => 'Таиланд',
        'tz' => 'Танзания',
        'tn' => 'Тунис',
        'tm' => 'Туркменистан',
        'tr' => 'Турция',
        'uz' => 'Узбекистан',
        'ua' => 'Украина',
        'uy' => 'Уругвай',
        'ph' => 'Филиппины',
        'fi' => 'Финляндия',
        'fr' => 'Франция',
        'hr' => 'Хорватия',
        'cz' => 'Чехия',
        'cl' => 'Чили',
        'ch' => 'Швейцария',
        'se' => 'Швеция',
        'lk' => 'Шри-Ланка',
        'ee' => 'Эстония',
        'za' => 'Южная Африка',
        'jm' => 'Ямайка',
    ];

    public $countriesEn = [
        'ru' => ['Russia', 'Russian Federation'],
        'ca' => 'Canada',
        'us' => 'USA',
        'de' => 'Germany',
        'gb' => 'United Kingdom',
        'nl' => 'Netherlands',
        'es' => 'Spain',
        'it' => 'Italy',
        'id' => 'Indonesia',
        'cn' => 'China',
        'in' => 'India',
        'jp' => 'Japan',
        'au' => 'Australia',
        'at' => 'Austria',
        'az' => 'Azerbaijan',
        'al' => 'Albania',
        'dz' => 'Algeria',
        'ar' => 'Argentina',
        'am' => 'Armenia',
        'bd' => 'Bangladesh',
        'by' => 'Belarus',
        'be' => 'Belgium',
        'bg' => 'Bulgaria',
        'bo' => 'Bolivia',
        'ba' => 'Bosnia and Herzegovina',
        'br' => 'Brazil',
        'hu' => 'Hungary',
        've' => 'Venezuela',
        'vn' => ['Vietnam', 'Viet Nam'],
        'gr' => 'Greece',
        'ge' => 'Georgia',
        'eg' => 'Egypt',
        'zm' => 'Zambia',
        'il' => 'Israel',
        'ie' => 'Ireland',
        'is' => 'Iceland',
        'kz' => ['Kazakhstan', 'Kazahstan'],
        'qa' => 'Qatar',
        'ke' => 'Kenya',
        'cy' => 'Cyprus',
        'co' => 'Colombia',
        'cr' => 'Costa Rica',
        'cu' => 'Cuba',
        'kg' => 'Kyrgyzstan',
        'lv' => 'Latvia',
        'lr' => 'Liberia',
        'lb' => 'Lebanon',
        'lt' => 'Lithuania',
        'lu' => 'Luxembourg',
        'my' => 'Malaysia',
        'mv' => 'Maldives',
        'ma' => 'Morocco',
        'mx' => 'Mexico',
        'md' => ['Moldova', 'Moldova (Republic of)'],
        'mc' => 'Monaco',
        'mn' => 'Mongolia',
        'np' => 'Nepal',
        'nz' => 'New Zealand',
        'no' => 'Norway',
        'ae' => 'UAE',
        'py' => 'Paraguay',
        'pe' => 'Peru',
        'pl' => 'Poland',
        'pt' => 'Portugal',
        'ro' => 'Romania',
        'sa' => 'Saudi Arabia',
        'sc' => 'Seychelles',
        'rs' => 'Serbia',
        'sg' => 'Singapore',
        'sk' => 'Slovakia',
        'si' => 'Slovenia',
        'th' => 'Thailand',
        'tz' => 'Tanzania',
        'tn' => 'Tunisia',
        'tm' => 'Turkmenistan',
        'tr' => 'Turkey',
        'uz' => 'Uzbekistan',
        'ua' => 'Ukraine',
        'uy' => 'Uruguay',
        'ph' => 'Philippines',
        'fi' => 'Finland',
        'fr' => 'France',
        'hr' => 'Croatia',
        'cz' => 'Czech Republic',
        'cl' => 'Chile',
        'ch' => 'Switzerland',
        'se' => 'Sweden',
        'lk' => 'Sri Lanka',
        'ee' => 'Estonia',
        'za' => 'South Africa',
        'jm' => 'Jamaica',
    ];

    private $lastAnswer;

    public static function get()
    {
        if (!self::$instance) {
            self::$instance = new self();
        };
        return self::$instance;
    }

    /**
     * @throws Exception
     */
    public function getFreeProxyByCountry(string $country)
    {
        $db = Yii::$app->db;
        $sql = "SELECT p.id FROM proxies p LEFT JOIN stake_accounts s ON s.proxies_id = p.id
            WHERE p.deleted = 0 AND p.country = '$country' AND s.id IS NULL
            AND ((p.registered_at IS NOT NULL AND p.registered_at > 0) OR p.provider = 'luminati')
            AND (p.finish_at IS NULL or FROM_UNIXTIME(p.finish_at) > DATE_ADD(CURDATE(), INTERVAL 24 HOUR))
            LIMIT 1;";
        $command = $db->createCommand($sql);
        $results = $command->queryAll();
        if (!empty($results)) {
            $proxy = Proxies::findOne($results[0]['id']);
            if ($proxy) {
                return $proxy;
            }
        }
        return null;
    }

    /**
     * @throws Exception
     */
    public function getFreeProxyCountries()
    {
        $db = Yii::$app->db;
        $sql = "SELECT DISTINCT p.country FROM proxies p LEFT JOIN stake_accounts s ON s.proxies_id = p.id
            WHERE p.deleted = 0 AND s.id IS NULL
            AND ((p.registered_at IS NOT NULL AND p.registered_at > 0) OR p.provider = 'luminati')
            AND (p.finish_at IS NULL or FROM_UNIXTIME(p.finish_at) > DATE_ADD(CURDATE(), INTERVAL 24 HOUR))";
        $command = $db->createCommand($sql);
        $results = $command->queryAll();
        $countries = [];
        if (!empty($results)) {
            foreach ($results as $result) {
                $countries[] = $result['country'];
            }
        }
        return $countries;
    }

    public function changeLuminatiIP(Proxies $proxy): string
    {
        $settings = SettingsForm::get();
        $settings->loadData();
        if (empty($settings->luminati_api_key)) {
            return "No Luminati API key";
        }
        $zone = substr($proxy->login, strpos($proxy->login, 'zone-') + 5);
        $this->log('FUCK', $zone);
        list($res, $errNo, $err) = $this->curl($this->luminati_url, $settings->luminati_api_key,
            json_encode(['zone' => $zone]), 'changeLuminatiIP: ' . $zone);
        if ($errNo) {
            return $err;
        }
        return '';
    }

    /**
     * Get short for country, i.e. Albania - al
     * @param string $country
     * @return string|false
     */
    public function getCountryCode(string $country)
    {
        foreach ($this->countriesEn as $code => $value) {
            if (is_array($value) ? in_array($country, $value) : $value === $country) {
                return $code;
            }
        }
        return false;
    }

    public function getBalance()
    {
        $res = $this->request("balance");
        return empty($res['balance']) ? 0 : (float)$res['balance'];
    }

    /**
     * @throws Exception
     */
    public function buyProxy($country): Proxies
    {
        if (!in_array($country, array_keys($this->countries))) {
            throw new Exception("Country not supported!");
        }
        $balance = $this->getBalance();
        $calc = $this->calcOrder($country);
        if ($calc === 0) {
            throw new Exception("Can't calculate order!");
        } elseif ($balance < $calc) {
            throw new Exception("Not enough money on balance ($balance < $calc)!");
        }
        $res = $this->order($country)[0];
        if (empty($res['id'])) {
            throw new Exception($res);
        }
        return $this->createProxy($res);
    }

    public function postToBetexy(StakeAccounts $stakeAccount): array
    {
        $data = [
            "action" => "proxy",
            "betexy_login" => $this->betexy_login,
            "mark" => $stakeAccount->proxy->name,
            "proto" => $stakeAccount->proxy->protocol,
            "host" => $stakeAccount->proxy->host,
            "port" => $stakeAccount->proxy->port,
            "is_mobile" => empty($stakeAccount->proxy->is_mobile) ? 0 : 1,
            "country" => $this->fixCountry($stakeAccount->proxy->country),
            "username" => $stakeAccount->proxy->login,
            "password" => $stakeAccount->proxy->password,
        ];
        return $this->curlBetexy($data, 'betexy_proxy');
    }

    /**
     * @throws BadRequestHttpException
     */
    public function postAccountToBetexy(StakeAccounts $stakeAccount): array
    {
        $data = generateBetexyRoomRequest([
            'name' => $stakeAccount->name . "@" . date("Y-m-d H:i:s"),
            'login' => $stakeAccount->login,
            'password' => $stakeAccount->password,
            'proxy_id' => $stakeAccount->proxy->betexy_id,
            'comment' => '[register]' . $stakeAccount->register . '[cas]' . $stakeAccount->configs_stakes,
        ]);
        $data['action'] = 'room';
        $data['betexy_login'] = $this->betexy_login;
        return $this->curlBetexy($data, 'betexy_room');
    }

    public function startAccount(StakeAccounts $stakeAccount)
    {
        $data = [
            'action' => 'run',
            'betexy_login' => $this->betexy_login,
            'id' => $stakeAccount->betexy_id,
        ];
        return $this->curlBetexy($data, 'betexy_run');
    }

    public function curlBetexy($data, $postfix = 'run')
    {
        if (empty($data['betexy_login'])) {
            $data['betexy_login'] = $this->betexy_login;
        }
        list($res, $errNo, $err) = $this->curl($this->betexy_url, $this->betexyKey, json_encode($data), $postfix);
        $this->lastAnswer = empty($res) ? [] : json_decode($res, true);
        $result = [
            'status' => 'error',
            'message' => 'Unknown error',
            'id' => -1,
        ];
        if ($errNo) {
            $result['message'] = "Curl error: " . $err;
        } else {
            $data = json_decode($res, true);
            if ($data['status'] === 'error') {
                $result['message'] = $data['message'];
                if ($data['fieldErrors']) {
                    $result['message'] .= ' ' . var_export($data['fieldErrors'], true);
                }
            } elseif ($data['status'] === 'success' && !empty($data['data']) && !empty($data['data']['id'])) {
                $result['message'] = $data['message'];
                $result['status'] = 'success';
                $result['id'] = $data['data']['id'];
            } else {
                $result = $data['data'];
            }
        }
        return $result;
    }

    private function curl($url, $key, $jsonData, $postfix = 'run'): array
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
        $headers = [
            'Authorization: Bearer ' . $key,
            'Content-Type: application/json',
            'Content-Length: ' . strlen($jsonData)
        ];
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        $this->log("request_{$postfix}",
            var_export(['url' => $url, 'headers' => $headers, 'body' => $jsonData,],
                true) . PHP_EOL);
        $res = curl_exec($ch);
        $this->log("answer_{$postfix}", $res . PHP_EOL);
        $curlErrNo = curl_errno($ch);
        $curError = curl_error($ch);
        curl_close($ch);
        return [$res, $curlErrNo, $curError];
    }

    /**
     * @throws Exception
     */
    private function checkSave(): Proxies
    {
        $res = '[
    {
    "id": 9570682,
    "ip": "46.150.252.129",
    "internal_ip": null,
    "port_http": 64512,
    "port_socks5": 64513,
    "user": "Ju4EVhZy",
    "username": "Ju4EVhZy",
    "password": "BK7nh6BN",
    "order_id": 2286022,
    "type": "2",
    "ip_version": 4,
    "country": "ru",
    "date": "2023-04-08 17:27:34.105497+00:00",
    "date_end": "2023-04-18T20:27:34.105497+03:00",
    "tags": [],
    "access_ips": []
    }
    ]';
        $ready = json_decode($res, true)[0];
        return $this->createProxy($ready);
    }

    /**
     * @throws Exception
     */
    private function __construct()
    {
        require_once dirname(__FILE__) . '/libs/generateBetexyRoomRequest.php';
        $settings = SettingsForm::get();
        $this->apiKey = $settings->proxy_api_key;
        if (!$this->apiKey) {
            throw new Exception("Proxy API key not set!");
        }
        $this->betexy_login = $settings->betexy_login;
        if (!$this->betexy_login) {
            throw new Exception("There is no betexy login!");
        }
    }

    /**
     * @throws Exception
     */
    private function createProxy($ready): Proxies
    {
        $proxy = new Proxies();
        $proxy->name = $this->countries[$ready['country']] . " #" . $ready['id'] . ', order #' . $ready['order_id'];
        $proxy->protocol = 'SOCKS';
        $proxy->host = $ready['ip'];
        $proxy->port = $ready['port_socks5'];
        $proxy->country = $ready['country'];
        $proxy->login = $ready['username'];
        $proxy->password = $ready['password'];
        $proxy->registered_at = strtotime($ready['date']);
        $proxy->finish_at = strtotime($ready['date_end']);
        if (!$proxy->save()) {
            throw new Exception("Can't save proxy! " . print_r($proxy->getErrors(), true));
        }
        return $proxy;
    }

    /**
     * @throws Exception
     */
    private function calcOrder($country): float
    {
        $res = $this->order($country, true);
        if (!empty($res['amount'])) {
            return (float)$res['amount'];
        } else if (!empty($res['non_field_errors'])) {
            throw new Exception(var_export($res['non_field_errors'], true));
        } else if (!empty($res['type'])) {
            throw new Exception(is_array($res['type']) ? reset($res['type']) : $res['type']);
        } else {
            throw new Exception("Can't calculate order: " . var_export($res, true));
        }
    }

    private function order($country, $onlyCalc = false)
    {
        return $this->postProxyline('new-order' . ($onlyCalc ? '-amount' : ''), [
            'period' => '20',
            'type' => 'dedicated',
            'ip_version' => '4',
            'country' => $country,
            'quantity' => '1',
        ]);
    }

    private function request($path)
    {
        $url = $this->url . "/{$path}/?api_key={$this->apiKey}";
        $res = file_get_contents($url);
        $this->log('answer.txt', $res . PHP_EOL);
        $this->lastAnswer = empty($res) ? [] : json_decode($res, true);
        return $this->lastAnswer;
    }

    private function postProxyline($path, $data)
    {
        $url = $this->url . "/{$path}/?api_key={$this->apiKey}";
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        $res = curl_exec($ch);
        curl_close($ch);
        $this->log('answer.txt', $res . PHP_EOL);
        $this->lastAnswer = empty($res) ? [] : json_decode($res, true);
        return $this->lastAnswer;
    }

    private function fixCountry(string $country): string
    {
        return empty(Proxies::$countries[$country]) ? 'us' : $country;
    }

    private function log($name, $data)
    {
        if (!$this->logging) {
            return;
        }
        file_put_contents(dirname(__FILE__) . '/../../../runtime/logs/last_' . $name . '.log', $data . PHP_EOL);
    }

}
