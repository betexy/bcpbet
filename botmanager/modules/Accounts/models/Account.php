<?php

namespace app\modules\Accounts\models;

use yii\behaviors\TimestampBehavior;
use yii\db\ActiveRecord;

/**
 * @property int                $id
 * @property string             $first_name
 * @property string             $second_name
 * @property string             $third_name
 * @property string             $birth_date
 * @property string             $email
 * @property string             $email_password
 * @property string             $phone
 * @property string             $comment
 * @property int                $created_at
 * @property int                $has_passport
 * @property int                $has_registration
 * @property int                $has_selfie
 * @property int                $has_driver_license
 * @property int                $has_address_verification
 * @property int                $has_skrill_verification
 * @property int                $has_qiwi_verification
 * @property string             $city
 * @property string             $postal_code
 * @property string             $address
 * @property string             $skrill_login
 * @property string             $skrill_password
 * @property string             $skrill_pin
 * @property string             $qiwi_login
 * @property string             $qiwi_password
 * @property string             $qiwi_pin
 * @property string             $bitcoin_login
 * @property string             $bitcoin_password
 * @property string             $bitcoin_email
 * @property string             $bitcoin_wallet
 * @property string             $first_name_en
 * @property string             $second_name_en
 * @property string             $city_en
 * @property string             $address_en
 *
 * @property AccountBookmaker[] $accountBookmakers
 */
class Account extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'account';
    }

    /**
     * @inheritdoc
     */
    public function behaviors()
    {
        return [
            'timestamp' => [
                'class' => 'yii\behaviors\TimestampBehavior',
                'attributes' => [
                    ActiveRecord::EVENT_BEFORE_INSERT => ['created_at', false],
                    ActiveRecord::EVENT_BEFORE_UPDATE => false,
                ],
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['first_name', 'second_name', 'birth_date', 'email', 'email_password', 'phone', 'created_at'], 'required'],
            [['birth_date', 'skrill_pin', 'qiwi_pin'], 'safe'],
            [['comment'], 'string'],
            [
                [
                    'created_at',
                    'has_passport',
                    'has_registration',
                    'has_selfie',
                    'has_driver_license',
                    'has_address_verification',
                    'has_skrill_verification',
                    'has_qiwi_verification',
                ],
                'integer',
            ],
            [
                [
                    'first_name',
                    'second_name',
                    'third_name',
                    'email',
                    'email_password',
                    'phone',
                    'city',
                    'postal_code',
                    'address',
                    'skrill_login',
                    'skrill_password',
                    'qiwi_login',
                    'qiwi_password',
                    'first_name_en',
                    'second_name_en',
                    'address_en',
                    'city_en',
                    'bitcoin_wallet',
                    'bitcoin_login',
                    'bitcoin_password',
                    'bitcoin_email',
                ],
                'string',
                'max' => 255,
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'first_name' => 'First Name',
            'second_name' => 'Second Name',
            'third_name' => 'Third Name',
            'birth_date' => 'Birth Date',
            'email' => 'Email',
            'email_password' => 'Email Password',
            'phone' => 'Phone',
            'comment' => 'Comment',
            'created_at' => 'Created At',
            'has_passport' => 'Has Passport',
            'has_registration' => 'Has Registration',
            'has_selfie' => 'Has Selfie',
            'has_driver_license' => 'Has Driver License',
            'has_address_verification' => 'Has Address Verification',
            'has_skrill_verification'  => 'Verif',
            'has_qiwi_verification'    => 'Verif',
            'city'                     => 'City',
            'postal_code'              => 'Postal Code',
            'address'                  => 'Address',
            'skrill_login'             => 'Skrill Login',
            'skrill_password'          => 'Skrill Password',
            'skrill_pin'               => 'Skrill Pin',
            'qiwi_login'               => 'Qiwi Login',
            'qiwi_password'            => 'Qiwi Password',
            'qiwi_pin'                 => 'Qiwi Pin',
            'bitcoin_login'            => 'BTC login',
            'bitcoin_password'         => 'BTC password',
            'bitcoin_wallet'           => 'BTC wallet',
            'bitcoin_email'            => 'BTC email',
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getAccountBookmakers()
    {
        return $this->hasMany(AccountBookmaker::class, ['account_id' => 'id']);
    }
}
