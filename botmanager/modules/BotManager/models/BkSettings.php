<?php

namespace app\modules\BotManager\models;

use Yii;

/**
 * This is the model class for table "bm_bk_settings".
 *
 * @property int $id
 * @property int $file_groups_id
 * @property string $bk_internal
 * @property string $bkText
 * @property string $url_one
 * @property string $url_two
 * @property string $url_three
 * @property array $settings
 * @property string $comment
 *
 * @property FileGroups $extension
 */
class BkSettings extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'bm_bk_settings';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['file_groups_id', 'bk_internal'], 'required'],
            [['file_groups_id'], 'integer'],
            [['settings'], 'safe'],
            [['comment'], 'string'],
            [['bk_internal', 'url_one', 'url_two', 'url_three'], 'string', 'max' => 255],
            [['file_groups_id'], 'exist', 'skipOnError' => true, 'targetClass' => FileGroups::class,
                'targetAttribute' => ['file_groups_id' => 'id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('BotManager', 'ID'),
            'file_groups_id' => Yii::t('BotManager', 'File Groups ID'),
            'bk_internal' => Yii::t('BotManager', 'Bk Internal'),
            'url_one' => Yii::t('BotManager', 'Manifest mask override'),
            'url_two' => Yii::t('BotManager', 'Url Two'),
            'url_three' => Yii::t('BotManager', 'Url Three'),
            'settings' => Yii::t('BotManager', 'Settings'),
            'comment' => Yii::t('BotManager', 'Comment'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getExtension()
    {
        return $this->hasOne(FileGroups::class, ['id' => 'file_groups_id']);
    }

    public function getBkText()
    {
        return FileGroups::getBkInternals()[$this->bk_internal];
    }

}
