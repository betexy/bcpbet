<?php

namespace app\modules\PaySystems\models;

use app\modules\BotManager\models\StakeAccounts;
use app\modules\Emails\models\Mailboxes;
use Yii;
use yii\behaviors\TimestampBehavior;
use yii\helpers\VarDumper;

/**
 * This is the model class for table "wallets".
 *
 * @property int $id
 * @property string $deposit_address
 * @property int $deleted
 * @property string $withdrawal_address
 * @property string $withdrawal_balance_usdt
 * @property string $withdrawal_balance_bnb
 * @property string $chg_password
 * @property int $mailboxes_id
 * @property string $network
 * @property int $approved
 * @property string $uid
 * @property string $bookie
 * @property string $login
 * @property string $comment
 * @property int $created_at
 * @property int $updated_at
 *
 * @property Mailboxes $mailbox
 * @property StakeAccounts $stakeAccount
 */
class Wallets extends \yii\db\ActiveRecord
{

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
    public static function tableName(): string
    {
        return 'wallets';
    }

    /**
     * {@inheritdoc}
     */
    public function rules(): array
    {
        return [
            [['id', 'approved', 'deleted', 'created_at', 'updated_at', 'mailboxes_id'], 'integer'],
            [['deposit_address', 'network'], 'required'],
            [['deposit_address', 'withdrawal_address', 'withdrawal_balance_usdt', 'withdrawal_balance_bnb',
                'network', 'uid', 'bookie', 'login'], 'string', 'max' => 255],
            [['comment'], 'safe',],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels(): array
    {
        return [
            'id' => Yii::t('pay-system', 'ID'),
            'deposit_address' => Yii::t('pay-system', 'Deposit address'),
            'deleted' => Yii::t('pay-system', 'Deleted'),
            'withdrawal_address' => Yii::t('pay-system', 'Withdrawal address'),
            'withdrawal_balance_usdt' => Yii::t('pay-system', 'Balance USDT'),
            'withdrawal_balance_bnb' => Yii::t('pay-system', 'Balance BNB'),
            'network' => Yii::t('pay-system', 'Network'),
            'mailboxes_id' => Yii::t('pay-system', 'Mailbox'),
            'e_mailboxes' => Yii::t('pay-system', 'Mailbox'),
            'approved' => Yii::t('pay-system', 'Approved'),
            'uid' => Yii::t('pay-system', 'UID'),
            'bookie' => Yii::t('pay-system', 'Bookie'),
            'login' => Yii::t('pay-system', 'Login'),
            'comment' => Yii::t('pay-system', 'Comment'),
            'created_at' => Yii::t('pay-system', 'Created At'),
            'updated_at' => Yii::t('pay-system', 'Updated At'),
        ];
    }

    public function save($runValidation = true, $attributeNames = null)
    {
        if ((int)$this->mailboxes_id === 0) {
            $this->mailboxes_id = null;
        }
        return parent::save($runValidation, $attributeNames);
    }


    public function delete()
    {
        $this->deleted = 1;
        $this->save();
    }

    public function getMailbox(): \yii\db\ActiveQuery
    {
        return $this->hasOne(Mailboxes::class, ['id' => 'mailboxes_id']);
    }

    public function getStakeAccount(): \yii\db\ActiveQuery
    {
        return $this->hasOne(StakeAccounts::class, ['login' => 'login']);
    }

}
