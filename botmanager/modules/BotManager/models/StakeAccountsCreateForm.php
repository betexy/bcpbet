<?php

namespace app\modules\BotManager\models;

use app\modules\BotManager\Helpers\ProxyHelper;
use app\modules\Emails\models\Mailboxes;
use app\modules\PaySystems\models\Paysystems;
use Faker\Factory;
use Faker\Generator;
use Yii;
use yii\base\Model;
use yii\db\Exception;
use yii\helpers\VarDumper;

/**
 * StakeAccountsSearch represents the model behind the search form of `app\modules\BotManager\models\StakeAccounts`.
 */
class StakeAccountsCreateForm extends Model
{

    public $createdAccounts = 0;

    public $numberOfAccounts;
    public $configsAndStakes;
    public $fillUpAmount;
    public $binanceApiId;
    public $browser;

    private $register;
    /**
     * @var Generator
     */
    private $faker;

    /**
     * {@inheritdoc}
     */
    public function rules(): array
    {
        return [
            [['numberOfAccounts', 'fillUpAmount', 'binanceApiId', 'configsAndStakes', 'browser',], 'required'],
            [['numberOfAccounts', 'fillUpAmount', 'binanceApiId',], 'integer'],
            [['browser'], 'in', 'range' => array_keys(StakeAccounts::$browsers)],
            [['configsAndStakes'], 'match', 'pattern' => '/^(?:\d+;\d+%?\|)*\d+;\d+%?$/',
                'message' => 'Invalid format, should be digit;digit[%]|..: '],
            [['binanceApiId'], 'exist', 'skipOnError' => true, 'targetClass' => Paysystems::class,
                'targetAttribute' => ['binanceApiId' => 'id']],
        ];
    }

    /**
     * @throws Exception
     */
    public function createAccounts(): int
    {
        $this->faker = Factory::create();
        $this->createdAccounts = 0;
        while ($this->createdAccounts < $this->numberOfAccounts) {
            $email = self::getEmail();
            if (empty($email)) {
                $this->addError("", "There are no email addresses without linked stake account!");
                return false;
            }
            if (!$this->genRegister($email->address)) {
                return false;
            }
            $acc = new StakeAccounts();
            $acc->name = $this->faker->name;
            $acc->mailboxes_id = $email->id;
            $acc->register = implode(';', $this->register);
            $acc->register_filling = implode(';', [$this->binanceApiId, $this->fillUpAmount,]);
            $acc->configs_stakes = $this->configsAndStakes;
            $acc->browser = $this->browser;
            $acc->login = $this->register['login'];
            $acc->password = $this->register['password'];
            $this->storeAcc($acc);
            if ($acc->save()) {
                $this->createdAccounts++;
            } else {
                return false;
            }
        }
        return true;
    }

    private function storeAcc($acc)
    {
        file_put_contents(Yii::getAlias('@runtime') . "/accounts.log",
            VarDumper::dumpAsString($acc->attributes) . PHP_EOL, FILE_APPEND);
    }

    /**
     * @throws Exception
     */
    private function genRegister($email_address): bool
    {
        $fixUsername = function($username) {
            $length = strlen($username);
            if ($length >= 14) {
                return substr($username, $length - 13);
            } else {
                return $username;
            }
        };
        $exists = true;
        $counter = 0;
        while ($exists && $counter < 10) {
            $countryCity = array_map(function ($v) {
                return trim($v);
            }, explode(';', FillingOptions::getRandom('country_city')));
            if (ProxyHelper::get()->getCountryCode($countryCity[0]) === false) {
                throw new Exception("Can't find country code for country {$countryCity[0]}");
            }
            $this->register = [
                'email' => $email_address,
                'login' => $fixUsername(str_replace('.', '', trim($this->faker->userName))
                    . $this->generateRandomString(mt_rand(3, 5), 'Aa0')),
                'password' => $this->generateRandomString(mt_rand(12, 20), 'Aa0'),
                'birthdate' => FillingOptions::getRandom('birth_date'),
                'name' => FillingOptions::getRandom('first_name'),
                'last_name' => FillingOptions::getRandom('last_name'),
                'country' => $countryCity[0],
                'address' => $this->getStreetAddress(FillingOptions::getRandom('street')),
                'city' => $countryCity[1],
                'zip' => FillingOptions::getRandom('zipcode'),
                'job' => '-',
                'amount' => $this->fillUpAmount,
                'binance_api' => $this->binanceApiId,
            ];
            $inDb = StakeAccounts::findOne(['register' => implode(';', $this->register), 'deleted' => 0]);
            $exists = !empty($inDb);
            $counter++;
        }
        if ($exists) {
            $this->addError("", "Can't generate unique register data {$counter} times!");
            return false;
        } else {
            return true;
        }
    }

    public static function getEmail(): ?Mailboxes
    {
        $sql = 'SELECT m.id FROM e_mailboxes m LEFT JOIN stake_accounts s ON s.mailboxes_id = m.id '
            . 'WHERE m.deleted_at IS NULL AND (m.do_not_use IS NULL OR m.do_not_use = 0) AND s.name IS NULL '
            . 'ORDER BY RAND() LIMIT 1';
        try {
            $res = Yii::$app->getDb()->createCommand($sql)->query()->read();
            return !empty($res) ? Mailboxes::findOne(array_shift($res)) : null;
        } catch (Exception $e) {
            return null;
        }
    }

    private function getStreetAddress($street): string
    {
        return "$street {$this->faker->streetAddress}";
    }

    /**
     * Generate pseudo random string
     * @param $length
     * @param $pattern - A - uppercase random, a - lowercase random, 0 - number random, any other character will be used as is
     * @return string
     */
    private static function generateRandomString($length = 10, $pattern = 'Aa = 0'): string
    {
        $randomString = '';
        for ($c = 0; $c < (int)($length / strlen($pattern)) + 1; $c++) {
            for ($i = 0; $i < strlen($pattern); $i++) {
                $char = $pattern[$i];
                if ($char === 'A') {
                    $randomString .= chr(mt_rand(65, 90));
                } elseif ($char === 'a') {
                    $randomString .= chr(mt_rand(97, 122));
                } elseif ($char === '0') {
                    $randomString .= mt_rand(0, 9);
                } else {
                    $randomString .= $char;
                }
                if (strlen($randomString) >= $length) {
                    break;
                }
            }
            if (strlen($randomString) >= $length) {
                break;
            }
        }
        return $randomString;
    }

}
