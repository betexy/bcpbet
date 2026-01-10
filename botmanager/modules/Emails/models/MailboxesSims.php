<?php

namespace app\modules\Emails\models;

use app\modules\SimsManager\models\Sims;
use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "{{%e_mailboxes_sims}}".
 *
 * @property int $id
 * @property int $deleted
 * @property int $created_at
 * @property int $updated_at
 * @property int $e_mailboxes_id
 * @property int $sims_sims_id
 *
 * @property Mailboxes $mailboxes
 * @property Sims $sims
 */
class MailboxesSims extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%e_mailboxes_sims}}';
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
            [['updated_at', 'e_mailboxes_id', 'sims_sims_id'], 'integer'],
            [['created_at', 'updated_at', 'e_mailboxes_id', 'sims_sims_id'], 'required'],
            [['e_mailboxes_id'], 'exist', 'skipOnError' => true, 'targetClass' => Mailboxes::class, 'targetAttribute' => ['e_mailboxes_id' => 'id']],
            [['sims_sims_id'], 'exist', 'skipOnError' => true, 'targetClass' => Sims::class, 'targetAttribute' => ['sims_sims_id' => 'id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('PaySystems', 'ID'),
            'deleted' => Yii::t('PaySystems', 'Deleted'),
            'created_at' => Yii::t('PaySystems', 'Created At'),
            'updated_at' => Yii::t('PaySystems', 'Updated At'),
            'e_mailboxes_id' => Yii::t('PaySystems', 'E Mailboxes ID'),
            'sims_sims_id' => Yii::t('PaySystems', 'Sims Sims ID'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getMailboxes()
    {
        return $this->hasOne(Mailboxes::class, ['id' => 'e_mailboxes_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSims()
    {
        return $this->hasOne(Sims::class, ['id' => 'sims_sims_id']);
    }
}
