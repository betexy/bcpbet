<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "proxies".
 *
 * @property int $id
 * @property string $provider
 * @property int $betexy_id
 * @property int $deleted
 * @property string $name
 * @property string $protocol
 * @property string $host
 * @property int $port
 * @property string $country
 * @property string|null $login
 * @property string|null $password
 * @property boolean $is_mobile
 * @property string|null $comment
 * @property int|null $registered_at
 * @property int|null $finish_at
 * @property int $created_at
 * @property int $updated_at
 *
 * @property StakeAccounts $stakeAccount
 */
class Proxies extends \yii\db\ActiveRecord
{

    // Hint: these protocols as in the Betexy
    public static $protocols = [
        'HTTP' => 'HTTP',
        'SOCKS' => 'SOCKS',
        'SSH' => 'SSH',
    ];

    public static $providers = [
        'proxyline' => 'ProxyLine',
        'luminati' => 'Luminati',
    ];

    // Hint: these countries as in the Betexy
    public static $countries = [
        'ru' => 'Россия',
        'us' => 'США',
        'fr' => 'Франция',
        'de' => 'Германия',
        'ua' => 'Украина',
        'nl' => 'Нидерланды',
        'cz' => 'Чехия',
        'gb' => 'Великобритания',
        'es' => 'Испания',
        'by' => 'Белоруссия',
        'kz' => 'Казахстан',
        'ee' => 'Эстония',
        'sh' => 'Швейцария',
        'sg' => 'Сингапур',
        'br' => 'Бразилия',
        'it' => 'Италия',
        'ae' => 'ОАЭ',
        'cn' => 'Китай',
        'pl' => 'Польша',
        'fi' => 'Финляндия',
        'au' => 'Австралия',
        'jp' => 'Япония',
        'in' => 'Индия',
        'tr' => 'Турция',
        'pt' => 'Португалия',
        'be' => 'Бельгия',
        'vn' => 'Вьетнам',
        'no' => 'Норвегия',
        'az' => 'Азербайджан',
        'am' => 'Армения',
        'ge' => 'Грузия',
        'md' => 'Молдова',
        'bd' => 'Бангладеш',
        'lt' => 'Литва',
        'lv' => 'Латвия',
        'id' => 'Индонезия',
        'gr' => 'Греция',
        'se' => 'Швеция',
        'qa' => 'Катар',
        'mv' => 'Мальдивы',
        'ca' => 'Канада',
        'ro' => 'Румыния',
        'cl' => 'Чили',
        'pe' => 'Перу',
        'ar' => 'Аргентина',
        'ie' => 'Ирландия',
        'al' => 'Albania',
        'dz' => 'Algeria',
        'ba' => 'Bosnia and Herzegovina',
        'bg' => 'Bulgaria',
        'co' => 'Colombia',
        'hr' => 'Croatia',
        'eg' => 'Egypt',
        'my' => 'Malaysia',
        'mx' => 'Mexico',
        'ma' => 'Morocco',
        'py' => 'Paraguay',
        'ph' => 'Philippines',
        'si' => 'Slovenia',
        'lk' => 'Sri Lanka',
        'th' => 'Thailand',
        'tn' => 'Tunisia',
        'uy' => 'Uruguay',
        'uz' => 'Uzbekistan',
    ];

    /**
     * {@inheritdoc}
     */
    public static function tableName(): string
    {
        return 'proxies';
    }

    /**
     * @inheritdoc
     */
    public function behaviors(): array
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
            [['deleted', 'port', 'registered_at', 'finish_at', 'created_at', 'updated_at', 'betexy_id',], 'integer'],
            [['name', 'protocol', 'host', 'port', 'country',], 'required'],
            [['comment'], 'string'],
            [['name', 'protocol', 'host', 'country', 'login', 'password', 'provider',], 'string', 'max' => 255],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels(): array
    {
        return [
            'id' => Yii::t('BotManager', 'ID'),
            'provider' => Yii::t('BotManager', 'Provider'),
            'betexy_id' => Yii::t('BotManager', 'Betexy ID'),
            'deleted' => Yii::t('BotManager', 'Deleted'),
            'name' => Yii::t('BotManager', 'Name'),
            'protocol' => Yii::t('BotManager', 'Protocol'),
            'host' => Yii::t('BotManager', 'Host'),
            'port' => Yii::t('BotManager', 'Port'),
            'country' => Yii::t('BotManager', 'Country'),
            'login' => Yii::t('BotManager', 'Login'),
            'password' => Yii::t('BotManager', 'Password'),
            'is_mobile' => Yii::t('BotManager', 'Mobile'),
            'comment' => Yii::t('BotManager', 'Comment'),
            'registered_at' => Yii::t('BotManager', 'Registered At'),
            'finish_at' => Yii::t('BotManager', 'Finish At'),
            'created_at' => Yii::t('BotManager', 'Created At'),
            'updated_at' => Yii::t('BotManager', 'Updated At'),
            'stakeAccount.name' => Yii::t('BotManager', 'Stake account'),
        ];
    }

    /**
     * Gets query for [[StakeAccount]].
     *
     * @return \yii\db\ActiveQuery
     */
    public function getStakeAccount(): \yii\db\ActiveQuery
    {
        return $this->hasOne(StakeAccounts::class, ['proxies_id' => 'id']);
    }

    public function delete()
    {
        $this->deleted = 1;
        $this->save();
    }

    public function save($runValidation = true, $attributeNames = null): bool
    {
        if (empty($this->provider)) {
            $this->provider = 'proxyline';
        }
        return parent::save($runValidation, $attributeNames);
    }


}
