<?php

namespace app\modules\Emails\models;

use Yii;
use yii\base\Model;
use yii\helpers\VarDumper;

/**
 * Class MailsettingsForm
 * @package app\modules\Emails\models
 *
 */
class MailsettingsForm extends Model
{

    public $type_0_IMAP;
    public $type_0_IMAP_port;
    public $type_1_IMAP;
    public $type_1_IMAP_port;
    public $type_2_IMAP;
    public $type_2_IMAP_port;
    public $type_3_IMAP;
    public $type_3_IMAP_port;
    public $type_4_IMAP;
    public $type_4_IMAP_port;
    public $type_5_IMAP;
    public $type_5_IMAP_port;
    public $type_6_IMAP;
    public $type_6_IMAP_port;
    public $type_7_IMAP;
    public $type_7_IMAP_port;

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['type_0_IMAP', 'type_0_IMAP_port',], 'required'],
            [['type_0_IMAP', 'type_1_IMAP', 'type_2_IMAP', 'type_3_IMAP',
                'type_4_IMAP', 'type_5_IMAP', 'type_6_IMAP', 'type_7_IMAP',], 'safe'],
            [['type_0_IMAP_port', 'type_1_IMAP_port', 'type_2_IMAP_port', 'type_3_IMAP_port',
                'type_4_IMAP_port', 'type_5_IMAP_port', 'type_6_IMAP_port', 'type_7_IMAP_port',], 'integer'],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'type_0_IMAP' => Yii::t('Emails', 'Mail.ru IMAP server'),
            'type_0_IMAP_port' => Yii::t('Emails', 'Mail.ru IMAP port'),
            'type_1_IMAP' => Yii::t('Emails', 'Yandex.ru IMAP server'),
            'type_1_IMAP_port' => Yii::t('Emails', 'Yandex.ru IMAP port'),
            'type_2_IMAP' => Yii::t('Emails', 'Gmail.com IMAP server'),
            'type_2_IMAP_port' => Yii::t('Emails', 'Gmail.com IMAP port'),
            'type_3_IMAP' => Yii::t('Emails', 'Yahoo.com IMAP server'),
            'type_3_IMAP_port' => Yii::t('Emails', 'Yahoo.com IMAP port'),
            'type_4_IMAP' => Yii::t('Emails', 'inbox.eu IMAP server'),
            'type_4_IMAP_port' => Yii::t('Emails', 'inbox.eu IMAP port'),
            'type_5_IMAP' => Yii::t('Emails', 'mail.uk IMAP server'),
            'type_5_IMAP_port' => Yii::t('Emails', 'mail.uk IMAP port'),
            'type_6_IMAP' => Yii::t('Emails', 'mail.uk IMAP server'),
            'type_6_IMAP_port' => Yii::t('Emails', 'mail.uk IMAP port'),
            'type_7_IMAP' => Yii::t('Emails', 'Outlook IMAP server'),
            'type_7_IMAP_port' => Yii::t('Emails', 'Outlook IMAP port'),
        ];
    }

    public function loadData()
    {
        $filename = Yii::getAlias(Yii::$app->controller->module->files_dir_alias) . 'mailSettings.php';
        if (!file_exists($filename)) {
            $data = [
                'type_0_IMAP' => 'imap.mail.ru',
                'type_0_IMAP_port' => '993',
                'type_1_IMAP' => 'imap.yandex.ru',
                'type_1_IMAP_port' => '993',
                'type_2_IMAP' => 'imap.gmail.com',
                'type_2_IMAP_port' => '993',
                'type_3_IMAP' => 'imap.mail.yahoo.com',
                'type_3_IMAP_port' => '993',
            ];
        } else {
            $data = require Yii::getAlias(Yii::$app->controller->module->files_dir_alias) . 'mailSettings.php';
        }
        $this->setAttributes($data);
        return $this;
    }

    public function save()
    {
        if ($this->validate()) {
            return (bool)file_put_contents(Yii::getAlias(Yii::$app->controller->module->files_dir_alias) . 'mailSettings.php',
                "<?php\r\nreturn " . VarDumper::export($this->getAttributes()) . ";\r\n");
        } else {
            return false;
        }
    }

}
