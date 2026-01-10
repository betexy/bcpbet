<?php

namespace app\modules\Accounts\models;

use app\models\Bot;
use Constants\Bookmakers;
use yii\db\ActiveRecord;

/**
 * @property int       $id
 * @property int       $account_id
 * @property string    $bookmaker
 * @property string    $bm_login
 * @property string    $bm_password
 * @property int       $status_id
 * @property int       $bot_id
 * @property int       $bot_manager_id
 * @property string    $comment
 *
 * @property Account   $account
 * @property AccountStatus $accountStatus
 * @property Bot $bot
 */
class AccountBookmaker extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'account_bookmaker';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['account_id', 'bookmaker', 'bm_login', 'bm_password'], 'required'],
            [['account_id', 'status_id', 'bot_id', 'bot_manager_id'], 'integer'],
            [['bm_login', 'bm_password', 'comment'], 'string'],
            ['bookmaker', 'in', 'range' => array_keys(Bookmakers::getList())],
            [
                ['account_id'],
                'exist',
                'skipOnError'     => true,
                'targetClass'     => Account::class,
                'targetAttribute' => ['account_id' => 'id'],
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id'           => 'ID',
            'account_id'   => 'Account',
            'bookmaker_id' => 'Bookmaker',
            'bm_login'     => 'BM Login',
            'bm_password'  => 'BM Password',
            'status_id'    => 'Status',
            'bot_id'       => 'Bot',
            'bot_manager_id' => 'VM',
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getAccount()
    {
        return $this->hasOne(Account::class, ['id' => 'account_id']);
    }
}
