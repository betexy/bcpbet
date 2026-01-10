<?php

namespace app\modules\Emails\models;

use app\modules\BotManager\models\StakeAccounts;
use app\modules\Emails\helpers\MailAnalyzer;
use app\modules\Emails\helpers\MailHelper;
use app\modules\PaySystems\models\Wallets;
use app\modules\PaySystems\PaySystems;
use Yii;
use yii\behaviors\TimestampBehavior;
use yii\db\Exception;

/**
 * This is the model class for table "{{%e_mailboxes}}".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property int $checked_at
 * @property int $ready_checked_at
 * @property int $deleted_at
 * @property int $mail_count
 * @property int $type
 * @property boolean $do_not_use
 * @property string $address
 * @property string $login
 * @property string $password
 * @property string $secret
 * @property string $folders
 * @property string $comment
 *
 * @property Emails[] $emails
 * @property MailboxesSims[] $mailboxesSims
 * @property Wallets $wallet
 * @property StakeAccounts $account
 *
 */
class Mailboxes extends \yii\db\ActiveRecord
{

    public static $types = [
        -1 => 'Unsupported',
        0 => 'mail.ru',
        1 => 'yandex.ru',
        2 => 'gmail.com',
        3 => 'yahoo.com',
        4 => 'inbox.eu',
        5 => 'mail.uk',
        7 => 'outlook',
    ];

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%e_mailboxes}}';
    }

    /**
     * @inheritdoc
     */
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
            [['address'], 'required'],
            [['login', 'password'], 'required', 'when' => function ($model) {
                return $model->type > -1;
            }, 'whenClient' => "function (attribute, value) { return $('#mailboxes-type').val() !== '-1'; }"],
            [['created_at', 'updated_at', 'checked_at', 'type', 'mail_count', 'do_not_use', 'ready_checked_at',
                'deleted_at', ], 'integer'],
            [['folders'], 'string'],
            [['comment'], 'string'],
            [['address'], 'string', 'max' => 255],
            [['login', 'password', 'secret'], 'string', 'max' => 100],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('PaySystems', 'ID'),
            'created_at' => Yii::t('PaySystems', 'Created At'),
            'updated_at' => Yii::t('PaySystems', 'Updated At'),
            'checked_at' => Yii::t('PaySystems', 'Checked At'),
            'ready_checked_at' => Yii::t('PaySystems', 'Ready checked At'),
            'deleted_at' => Yii::t('PaySystems', 'Deleted At'),
            'mail_count' => Yii::t('PaySystems', 'Mail Count'),
            'type' => Yii::t('PaySystems', 'Type'),
            'do_not_use' => Yii::t('PaySystems', 'Do not use for Stake'),
            'address' => Yii::t('PaySystems', 'Address'),
            'login' => Yii::t('PaySystems', 'Login'),
            'password' => Yii::t('PaySystems', 'Password'),
            'secret' => Yii::t('PaySystems', 'Secret'),
            'folders' => Yii::t('PaySystems', 'Folders'),
            'comment' => Yii::t('PaySystems', 'Comment'),
        ];
    }

    public static function find()
    {
        return new WithDeletedQuery(get_called_class());
    }


    public function save($runValidation = true, $attributeNames = null): bool
    {
        if (empty($this->folders)) {
            $this->folders = '[]';
        }
        return parent::save($runValidation, $attributeNames);
    }

    public function delete(): bool
    {
        $this->deleted_at = time();
        return $this->save(false);
    }

    public function checkForPattern($patterns, $timestamp, $returnAll = false): array
    {
        if (!is_array($patterns)) {
            $patterns = [$patterns];
        } else {
            $returnAll = true;
        }
        try {
            $checkResult = MailHelper::checkMail($this);
        } catch (\Exception $e) {
            return ['status' => 'error', 'message' => 'Check email error: ' . $e->getMessage()];
        }
        if (!$checkResult['success']) {
            return ['status' => 'error', 'message' => $checkResult['message']];
        } else {
            $result = [];
            $analyzer = new MailAnalyzer();
            $emails = Emails::find()->where(['and', ['e_mailboxes_id' => $this->id], ['>=', 'created_at', $timestamp]])
                ->orderBy(['id' => SORT_DESC])->all();
            foreach ($patterns as $pattern) {
                foreach ($emails as $email) {
                    $analyzeResult = $analyzer->analyze($email, $pattern);
                    $email->comment = $analyzeResult !== false ? json_encode($analyzeResult) : null;
                    $email->save();
                    if ($analyzeResult !== false) {
                        $preparedResult = [
                            'data' => $analyzeResult['data'],
                            'email_id' => $email->id,
                        ];
                        $result[$pattern] = $preparedResult;
                        if (!$returnAll) {
                            break;
                        }
                    }
                }
            }
            return ['status' => 'success', 'message' => $result];
        }
    }

    public function obtainFolders()
    {
        $r = [];
        if (!empty($this->folders)) {
            try {
                $r = json_decode($this->folders, true);
            } catch (\Exception $e) {

            }
        }
        return $r;
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getEmails()
    {
        return $this->hasMany(Emails::class, ['e_mailboxes_id' => 'id',]);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getMailboxesSims()
    {
        return $this->hasMany(MailboxesSims::class, ['e_mailboxes_id' => 'id']);
    }

    public function getWallet()
    {
        return $this->hasOne(Wallets::class, ['mailboxes_id' => 'id']);
    }

    public function getAccount()
    {
        return $this->hasOne(StakeAccounts::class, ['mailboxes_id' => 'id']);
    }
}
