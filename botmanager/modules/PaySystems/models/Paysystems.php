<?php

namespace app\modules\PaySystems\models;

use app\modules\SimsManager\models\Sims;
use Yii;
use app\modules\BotManager\models\Bots;
use yii\behaviors\TimestampBehavior;
use yii\helpers\ArrayHelper;
use yii\helpers\VarDumper;

/**
 * This is the model class for table "{{%ps_paysystems}}".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property int $type // 0 => 'Not specified', 1 => 'QIWI', 2 => 'Skrill', 3 => 'Blockchain.info'
 * @property int $is_master
 * @property int $ps_paysystems_id_master
 * @property string $login
 * @property string $password
 * @property string $pin
 * @property string $balance
 * @property string $when_amount
 * @property string $send_amount
 * @property int $checked_at
 * @property string $comment
 * @property string $additions
 *
 * @property string $title
 * @property string $shortTitle
 * @property string $numberOwner
 * @property string[] $recipientsList
 *
 * @property Paysystems $master
 * @property Bots[] $bots
 * @property PaysystemsBots[] $paysystemsBots
 * @property PaysystemsQueue[] $queue
 */
class Paysystems extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%ps_paysystems}}';
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
            [['login', 'password', 'is_master'], 'required'],
            [['created_at', 'updated_at', 'type', 'checked_at', 'is_master', 'ps_paysystems_id_master'], 'integer'],
            [['balance', 'when_amount', 'send_amount'], 'number'],
            [['comment',], 'string'],
            ['additions', 'each', 'rule' => ['string']],
            [['login', 'password', 'pin'], 'string', 'max' => 100],
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
            'type' => Yii::t('PaySystems', 'Type'),
            'is_master' => Yii::t('PaySystems', 'Master?'),
            'ps_paysystems_id_master' => Yii::t('PaySystems', 'Master'),
            'login' => Yii::t('PaySystems', 'Login'),
            'password' => Yii::t('PaySystems', 'Password'),
            'pin' => Yii::t('PaySystems', 'Pin'),
            'balance' => Yii::t('PaySystems', 'Balance'),
            'when_amount' => Yii::t('PaySystems', 'When amount reached'),
            'send_amount' => Yii::t('PaySystems', 'Send amount to master'),
            'checked_at' => Yii::t('PaySystems', 'Checked At'),
            'comment' => Yii::t('PaySystems', 'Comment'),
            'title' => Yii::t('PaySystems', 'Title'),
            'additions' => Yii::t('PaySystems', 'Additions'),
        ];
    }

    public function validate($attributeNames = null, $clearErrors = true)
    {
        if (parent::validate($attributeNames, $clearErrors)) {
            $this->additions = in_array((int)$this->type, [3, 5]) ? json_encode($this->additions) : null;
            return true;
        } else {
            return false;
        }
    }

    public function getMaster()
    {
        return $this->hasOne(Paysystems::class, ['id' => 'ps_paysystems_id_master']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getPaysystemsBots()
    {
        return $this->hasMany(PaysystemsBots::class, ['ps_paysystems_id' => 'id'])->where(['deleted' => 0]);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getBots()
    {
        return $this->hasMany(Bots::class, ['id' => 'bm_bots_id'])->via('paysystemsBots');
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getPaysystemsQueues()
    {
        return $this->hasMany(PaysystemsQueue::class, ['ps_paysystems_id' => 'id']);
    }

    public function getTitle()
    {
        return ($this->is_master ? '-= MASTER =- ' : '') . Bots::$paymentMethods[$this->type] . ' '
            . ($this->type === 3 ? (function ($m) {
                $a = json_decode($m->additions);
                return empty($a->email) ? '!!! NOT SET !!!' : $a->email;
            })($this) : $this->login . ' ' . $this->id);
    }

    public function getShortTitle()
    {
        return substr(Bots::$paymentMethods[$this->type], 0, 1) . ' '
            . ($this->type === 3 ? (function ($m) {
                $a = json_decode($m->additions);
                return empty($a->email) ? '!!! NOT SET !!!' : $a->email;
            })($this) : $this->login);
    }

    public function getRecipientsList()
    {
        if ($this->is_master) {
            return ArrayHelper::map(
                Paysystems::find()->where(['and', ['type' => $this->type], ['<>', 'id', $this->id]])->all(),
                'login', function ($ps) {
                return "{$ps->login} {$ps->numberOwner}";
            });
        } else {
            return ArrayHelper::map(
                Paysystems::find()->where(['and', ['type' => $this->type, 'is_master' => 1], ['<>', 'id', $this->id]])->all(),
                'login', 'login');
        }
    }

    public function getNumberOwner()
    {
        if ($this->type === 1) {
            $sim = Sims::findOne(['number' => $this->login]);
            return empty($sim) ? 'unknown' : $sim->comment;
        } else {
            return '';
        }
    }

    public static function getMaxId()
    {
        return self::find()->max('id');
    }

}
