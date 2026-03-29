<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;
use yii\helpers\ArrayHelper;

/**
 * This is the model class for table "configs".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property string $name
 * @property string $bookie
 * @property string $second_bookie
 * @property string $source
 * @property string $currency
 * @property string $url
 * @property int $eventTimeLimit
 * @property int $eventMaxBets
 * @property int $successBetInterval
 * @property float $stake
 * @property float $coefFrom
 * @property float $coefTo
 * @property float $incomeFrom
 * @property float $incomeTo
 * @property string $lastScoreTennis
 * @property string $lastScoreBasketball
 * @property string $excludeSports
 * @property string $excludeMarkets
 * @property string $excludeTargets
 * @property string $excludePivots
 * @property string $excludeBets
 * @property string $excludeLeagues
 * @property string $excludeSportMarketTarget
 * @property int $express
 * @property int $new_expresses
 * @property string $onlyLeagues
 * @property string $onlySecondBookie
 * @property string $is_fork
 * @property int $skipPinnacleBetfairForks
 */
class Configs extends \yii\db\ActiveRecord
{

    public static $bkSettings = null;

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'configs';
    }

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
            [['created_at', 'updated_at'], 'integer'],
            [['eventTimeLimit', 'eventMaxBets', 'successBetInterval', 'express', 'new_expresses', 'is_fork', 'skipPinnacleBetfairForks'], 'integer'],
            [['stake', 'coefFrom', 'coefTo', 'incomeFrom', 'incomeTo'], 'number'],
            [['excludeBets', 'excludeLeagues', 'excludeSportMarketTarget', 'onlyLeagues'], 'string'],
            [['name', 'bookie', 'second_bookie', 'source', 'currency', 'url', 'lastScoreTennis', 'lastScoreBasketball',
                'excludeSports', 'excludeMarkets', 'excludeTargets', 'excludePivots',], 'string', 'max' => 255],
            ['onlySecondBookie', 'each', 'rule' => ['string']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('configs', 'ID'),
            'name' => Yii::t('configs', 'Name'),
            'created_at' => Yii::t('configs', 'Created At'),
            'updated_at' => Yii::t('configs', 'Updated At'),
            'bookie' => Yii::t('configs', 'Bookie'),
            'second_bookie' => Yii::t('configs', 'Second Bookie (only for fork configs)'),
            'source' => Yii::t('configs', 'Source'),
            'currency' => Yii::t('configs', 'Currency'),
            'url' => Yii::t('configs', 'Url'),
            'eventTimeLimit' => Yii::t('configs', 'Event Time Limit'),
            'eventMaxBets' => Yii::t('configs', 'Event Max Bets'),
            'successBetInterval' => Yii::t('configs', 'Success Bet Interval'),
            'stake' => Yii::t('configs', 'Stake'),
            'coefFrom' => Yii::t('configs', 'Coef From'),
            'coefTo' => Yii::t('configs', 'Coef To'),
            'incomeFrom' => Yii::t('configs', 'Income From'),
            'incomeTo' => Yii::t('configs', 'Income To'),
            'lastScoreTennis' => Yii::t('configs', 'Last Score Tennis'),
            'lastScoreBasketball' => Yii::t('configs', 'Last Score Basketball'),
            'excludeSports' => Yii::t('configs', 'Exclude Sports'),
            'excludeMarkets' => Yii::t('configs', 'Exclude Markets'),
            'excludeTargets' => Yii::t('configs', 'Exclude Targets'),
            'excludePivots' => Yii::t('configs', 'Exclude Pivots'),
            'excludeBets' => Yii::t('configs', 'Exclude Bets'),
            'excludeLeagues' => Yii::t('configs', 'Exclude Leagues'),
            'excludeSportMarketTarget' => Yii::t('configs', 'Exclude Sport Market Target'),
            'express' => Yii::t('configs', 'Express'),
            'new_expresses' => Yii::t('configs', 'New expresses'),
            'onlyLeagues' => Yii::t('configs', 'Only Leagues'),
            'onlySecondBookie' => Yii::t('configs', 'Only if second bookie one of the following:'),
            'is_fork' => Yii::t('configs', 'Config for fork, not value bets'),
            'skipPinnacleBetfairForks' => Yii::t('configs', 'Skip if Pinnacle/Betfair fork exists on same match+market'),
        ];
    }


    public function afterFind()
    {
        parent::afterFind();
        $this->onlySecondBookie = json_decode($this->onlySecondBookie, true);
    }

    public function beforeSave($insert): bool
    {
        if (empty($this->source)) {
            $this->source = 'oddscp';
        }
        if (empty($this->currency)) {
            $this->currency = 'USD';
        }
        if (parent::beforeSave($insert)) {
            $this->onlySecondBookie = json_encode($this->onlySecondBookie);
            return true;
        }
        return false;
    }

    public function getChildConfigs()
    {
        return $this->hasMany(Configs::class, ['id' => 'child_id'])
            ->viaTable('configs_configs', ['parent_id' => 'id']);
    }

    public function getParentConfigs()
    {
        return $this->hasMany(Configs::class, ['id' => 'parent_id'])
            ->viaTable('configs_configs', ['child_id' => 'id']);
    }

    public static function getBookies($with_empty = false): array
    {
        /*
        if (empty(self::$bkSettings)) {
            self::$bkSettings = (new BkSettingsForm())->loadData();
        }
        $bookies = [];
        foreach (self::$bkSettings->bkMapping as $bkExternal) {
            $bookies[$bkExternal] = $bkExternal;
        }
        */
        $bookies = [
            '1XBET' => '1XBET',
            '1XBIT' => '1XBIT',
            '1WIN' => '1WIN',
            'BATERY' => 'BATERY',
            'BET365' => 'BET365',
            'BET365.MX' => 'BET365.MX',
            'BET365.ES' => 'BET365.ES',
            'BET365.RU' => 'BET365.RU',
            'BET365.GR' => 'BET365.GR',
            'BETANDYOU' => 'BETANDYOU',
            'BETBOOM' => 'BETBOOM',
            'BETCITY.BY' => 'BETCITY.BY',
            'BETCITY.CUPIS' => 'BETCITY.CUPIS',
            'BETFLIP' => 'BETFLIP',
            'BETSAFE' => 'BETSAFE',
            'BETWAY' => 'BETWAY',
            'BFSPORTSBOOK' => 'BFSPORTSBOOK',
            'COINPLAY' => 'COINPLAY',
            'COINSGAME' => 'COINSGAME',
            'FONBET' => 'FONBET',
            'FONBET.BY' => 'FONBET.BY',
            'FONBET.KZ' => 'FONBET.KZ',
            'FONBET.GR' => 'FONBET.GR',
            'FONBET.CUPIS' => 'FONBET.CUPIS',
            'FONBETCUPIS.MOBILE' => 'FONBETCUPIS.MOBILE',
            'FONRU' => 'FONRU',
            'FORTUNE' => 'FORTUNE',
            'GAMDOM' => 'GAMDOM',
            'LEON.CUPIS' => 'LEON.CUPIS',
            'LIGASTAVOK' => 'LIGASTAVOK',
            'LINEBET' => 'LINEBET',
            'MARATHON.CUPIS' => 'MARATHON.CUPIS',
            'MELBET' => 'MELBET',
            'MOSTBET' => 'MOSTBET',
            'OLIMP.CUPIS' => 'OLIMP.CUPIS',
            'OLIMP.KZ' => 'OLIMP.KZ',
            'OLIMP' => 'OLIMP',
            'OPTIBET' => 'OPTIBET',
            'PADDYPOWER' => 'PADDYPOWER',
            'PARIBET' => 'PARIBET',
            'PARIMATCH.BY' => 'PARIMATCH.BY',
            'PINNACLE' => 'PINNACLE',
            'PINUP' => 'PINUP',
            'PINUP.KZ' => 'PINUP.KZ',
            'ROLLBIT' => 'ROLLBIT',
            'STAKE' => 'STAKE',
            'TENNISI.CUPIS' => 'TENNISI.CUPIS',
            'TOPSPORT' => 'TOPSPORT',
            'TRUSTDICE' => 'TRUSTDICE',
            'WINLINE.CUPIS' => 'WINLINE.CUPIS',
            'UBET' => 'UBET',
            'BCGAME' => 'BCGAME',
            'FAIRSPIN' => 'FAIRSPIN',
            'FAVBET' => 'FAVBET',
            'MEGADICE' => 'MEGADICE',
            'SOLCASINO' => 'SOLCASINO',
            'VAVE' => 'VAVE',
            'WEISS' => 'WEISS',
            'WILD' => 'WILD',
            'BETIRO' => 'BETIRO',
            'CSGO500' => 'CSGO500',
            'CHIPS.GG' => 'CHIPS.GG',
            'ROOBET' => 'ROOBET',
            'CRASHINO' => 'CRASHINO',
            'IVIBET' => 'IVIBET',
            'CAMPEONBET' => 'CAMPEONBET',
            'OLYBET' => 'OLYBET',
            'WHALE' => 'WHALE',
            'OLYBET' => 'OLYBET',
            '4RABET' => '4RABET',
            'RAZED' => 'RAZED',
            'LUCKYBLOCK' => 'LUCKYBLOCK',
            'VBET' => 'VBET',
            'BITZ' => 'BITZ',
            'CRYPTOCASINO' => 'CRYPTOCASINO',
            'TETHER' => 'TETHER',
            'JETTON' => 'JETTON',
            'BETPANDA' => 'BETPANDA',
            'JUSTBIT' => 'JUSTBIT',
            'WSMCASINO' => 'WSMCASINO',
            'BETFURY' => 'BETFURY',
            'BETPLAY' => 'BETPLAY',
            'FORTUNEJACK' => 'FORTUNEJACK',
            'JBCOM' => 'JBCOM',
            'RAINBET' => 'RAINBET',
            'DUEL' => 'DUEL',
            'MELLSTROY' => 'MELLSTROY',
            'BOOKMAKERXYZ' => 'BOOKMAKERXYZ',
            'SHUFFLE' => 'SHUFFLE',
            'POLYMARKET' => 'POLYMARKET',
            'REALBET' => 'REALBET',

        ];
        return $with_empty ? array_merge(['' => ''], $bookies) : $bookies;
    }

    public static function getSecondBookies()
    {
        return [
            '1XBET' => '1XBET',
            '188BET' => '188BET',
            'BET365' => 'BET365',
            'BETFAIR' => 'BETFAIR',
            'FONBET' => 'FONBET',
            'MATCHBOOK' => 'MATCHBOOK',
            'OLIMP' => 'OLIMP',
            'PARIMATCH' => 'PARIMATCH',
            'PINNACLE' => 'PINNACLE',
            'PINUP' => 'PINUP',
            'SMARKETS' => 'SMARKETS',
            'WINLINEBET' => 'WINLINEBET',
            'ZENIT' => 'ZENIT',
        ];
    }

    public static function retrieveForSelect($id, $byID = false): array
    {
        $exclude = [];
        $children = Configs::findOne($id)->getChildConfigs()->select('id')->all();
        foreach ($children as $child) {
            $exclude[] = $child->id;
        }
        return ArrayHelper::map(self::find()->where(['and', ['!=', 'id', $id], ['is_fork' => false],
            ['not in', 'id', $exclude]])
            ->orderBy('name')->all(), 'id', $byID ? 'id' : 'name');
    }
}
