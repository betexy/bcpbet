<?php

namespace app\modules\BotManager\models;

use app\modules\BotManager\Helpers\ProxyHelper;
use Yii;
use yii\behaviors\TimestampBehavior;
use yii\db\Exception;

/**
 * This is the model class for table "filling_options".
 *
 * @property int $id
 * @property string $name
 * @property string $value
 * @property string|null $comment
 * @property int $created_at
 * @property int $updated_at
 */
class FillingOptions extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName(): string
    {
        return 'filling_options';
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
     * @throws Exception
     */
    public function save($runValidation = true, $attributeNames = null)
    {
        if ($this->name === 'country_city') {
            $parts = explode(';', $this->value);
            ProxyHelper::get()->getCountryCode($parts[0]);
        }
        return parent::save($runValidation, $attributeNames);
    }

    public static function getOptions(): array
    {
        return [
            'first_name' => Yii::t('BotManager', 'First name', [], 'ru'),
            'last_name' => Yii::t('BotManager', 'Last name', [], 'ru'),
            'birth_date' => Yii::t('BotManager', 'Birth date', [], 'ru'),
            'country_city' => Yii::t('BotManager', 'Country; City', [], 'ru'),
            'street' => Yii::t('BotManager', 'Street', [], 'ru'),
            'zipcode' => Yii::t('BotManager', 'Zipcode', [], 'ru'),
        ];
    }

    /**
     * @throws Exception
     */
    public static function getRandom($option)
    {
        if ($option === 'country_city') {
            $freeCountries = [];
            $freeCountriesShorts = ProxyHelper::get()->getFreeProxyCountries();
            foreach ($freeCountriesShorts as $short) {
                $full = ProxyHelper::get()->countriesEn[$short];
                $freeCountries = array_merge($freeCountries, is_array($full) ? $full : [$full]);
            }
            if (empty($freeCountries)) {
                throw new Exception(Yii::t('BotManager', 'No free proxy countries', [], 'ru'));
            }
            $query = FillingOptions::find();
            foreach ($freeCountries as $country) {
                $query->orWhere(['LIKE', 'value', $country]);
            }
            $res = $query->orderBy('RAND()')->limit(1)->one();
            if (empty($res)) {
                throw new Exception('No country_city options for countries: ' . implode(', ', $freeCountries));
            }
            return $res->value;
        } else {
            return FillingOptions::find()->where(['name' => $option])
                ->orderBy('RAND()')->limit(1)->one()->value;
        }
    }

    public static function humanError($message): string
    {
        if (strpos($message, 'Duplicate entry') !== false) {
            $subMessage = substr($message, strpos($message, 'Duplicate entry'),
                strpos($message, 'for key') - strpos($message, 'Duplicate entry')
            );
            $firstSingleQuote = strpos($subMessage, "'");
            $secondSingleQuote = strpos($subMessage, "'", $firstSingleQuote + 1);
            $keyValue = substr($subMessage, $firstSingleQuote + 1,
                $secondSingleQuote - $firstSingleQuote - 1);
            $parts = explode('-', $keyValue);
            return Yii::t('BotManager', "Значение '{value}' для '{name}' уже существует!",
                [
                    'name' => Yii::t('BotManager', $parts[0], [], 'ru'),
                    'value' => $parts[1]
                ], 'ru');
        } else {
            return $message;
        }

    }

    /**
     * {@inheritdoc}
     */
    public function rules(): array
    {
        return [
            [['name', 'value',], 'required'],
            [['comment'], 'string'],
            [['id', 'created_at', 'updated_at'], 'integer'],
            [['name', 'value',], 'string', 'max' => 255],
            [['value'], function ($attribute, $params, $validator) {
                if ($this->name === 'county_city' && substr_count($this->value, ';') !== 1) {
                    $this->addError($attribute, Yii::t('BotManager',
                        'Should be «country; city»!', [], 'ru'));
                }
            }],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels(): array
    {
        return [
            'id' => Yii::t('BotManager', 'ID', [], 'ru'),
            'name' => Yii::t('BotManager', 'Option name', [], 'ru'),
            'value' => Yii::t('BotManager', 'Option value', [], 'ru'),
            'comment' => Yii::t('BotManager', 'Comment', [], 'ru'),
            'created_at' => Yii::t('BotManager', 'Created At', [], 'ru'),
            'updated_at' => Yii::t('BotManager', 'Updated At', [], 'ru'),
        ];
    }


}
