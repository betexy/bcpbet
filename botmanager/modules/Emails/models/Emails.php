<?php

namespace app\modules\Emails\models;

use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "{{%e_emails}}".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property int $e_mailboxes_id
 * @property string $folder
 * @property int $imap_id
 * @property string $message_id
 * @property string $imap_datetime
 * @property string $from_name
 * @property string $from_address
 * @property string $to
 * @property string $to_string
 * @property string $cc
 * @property string $reply_to
 * @property string $subject
 * @property string $text_plain
 * @property string $text_html
 * @property string $attachments
 * @property string $comment
 *
 * @property Mailboxes $mailboxes
 * @property string address
 */
class Emails extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%e_emails}}';
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
            [['e_mailboxes_id', 'imap_id', 'imap_datetime'], 'required'],
            [['created_at', 'updated_at', 'e_mailboxes_id', 'imap_id'], 'integer'],
            [['folder', 'text_plain', 'text_html', 'attachments', 'comment'], 'string'],
            [['message_id', 'from_name', 'from_address', 'to', 'to_string', 'cc', 'reply_to', 'subject'], 'string', 'max' => 255],
            [['imap_datetime'], 'string', 'max' => 30],
            [['e_mailboxes_id'], 'exist', 'skipOnError' => true, 'targetClass' => Mailboxes::class, 'targetAttribute' => ['e_mailboxes_id' => 'id']],
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
            'e_mailboxes_id' => Yii::t('PaySystems', 'Mailboxes ID'),
            'folder' => Yii::t('PaySystems', 'Folder'),
            'imap_id' => Yii::t('PaySystems', 'Imap ID'),
            'message_id' => Yii::t('PaySystems', 'Message ID'),
            'imap_datetime' => Yii::t('PaySystems', 'Datetime'),
            'from_name' => Yii::t('PaySystems', 'From Name'),
            'from_address' => Yii::t('PaySystems', 'From Address'),
            'to' => Yii::t('PaySystems', 'To'),
            'to_string' => Yii::t('PaySystems', 'To'),
            'cc' => Yii::t('PaySystems', 'Cc'),
            'reply_to' => Yii::t('PaySystems', 'Reply To'),
            'subject' => Yii::t('PaySystems', 'Subject'),
            'text_plain' => Yii::t('PaySystems', 'Text Plain'),
            'text_html' => Yii::t('PaySystems', 'Text Html'),
            'attachments' => Yii::t('PaySystems', 'Attachments'),
            'comment' => Yii::t('PaySystems', 'Comment'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getMailboxes()
    {
        return $this->hasOne(Mailboxes::class, ['id' => 'e_mailboxes_id']);
    }

    public function getAddress()
    {
        return $this->mailboxes->address;
    }

}
