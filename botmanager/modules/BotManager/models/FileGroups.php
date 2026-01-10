<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\helpers\ArrayHelper;
use yii\helpers\VarDumper;

/**
 * This is the model class for table "bm_file_groups".
 *
 * @property int $id
 * @property int $type
 * @property string $bk_internal
 * @property string $typeText
 * @property string $bkInternalText
 * @property string $name
 * @property string $comment
 * @property string $filesText
 *
 * @property Bots[] $bots
 * @property BotsBks[] $botsBks
 * @property Files[] $files
 * @property BkSettings[] $bkSettings
 */
class FileGroups extends \yii\db\ActiveRecord
{

    public static $types = [
        0 => 'Extension',
        1 => 'BK',
        2 => 'Software',
        3 => 'Plugin',
    ];

    public static $bkInternals = [];

    public static $bkMapping = [];

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'bm_file_groups';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['type', 'name'], 'required'],
            [['type'], 'integer'],
            [['comment'], 'string'],
            [['name', 'bk_internal', 'bkInternalText'], 'string', 'max' => 255],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('BotManager', 'ID'),
            'type' => Yii::t('BotManager', 'Type'),
            'bk_internal' => Yii::t('BotManager', 'BK internal name'),
            'bkInternalText' => Yii::t('BotManager', 'BK internal name'),
            'typeText' => Yii::t('BotManager', 'Type'),
            'name' => Yii::t('BotManager', 'Name'),
            'comment' => Yii::t('BotManager', 'Comment'),
        ];
    }

    public function getTypeText()
    {
        return self::$types[$this->type];
    }

    public function getBkInternalText()
    {
        return self::getBkInternals()[$this->bk_internal];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getBots()
    {
        return $this->hasMany(Bots::class, ['extension_id' => 'id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getBotsBks()
    {
        return $this->hasMany(BotsBks::class, ['bk_id' => 'id']);
    }

    public function getFullFiles($end = false): array
    {
        $result = $this->files;
        if (!empty($result)) {
            // Adding sodium.js
            $result[] = Files::findOne(112);
        }
        return $result;
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getFiles()
    {
        return $this->hasMany(Files::class, ['id' => 'files_id'])->viaTable('bm_files_file_groups', ['file_groups_id' => 'id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getBkSettings()
    {
        return $this->hasMany(BkSettings::class, ['file_groups_id' => 'id']);
    }

    public function getFilesText()
    {
        return implode(', ', ArrayHelper::map($this->files, 'source_name', 'source_name'));
    }

    public static function getBkInternals()
    {
        if (empty(self::$bkInternals)) {
            self::$bkInternals = (new BkSettingsForm())->loadData()->internalBks;
        }
        return self::$bkInternals;
    }

    public static function getBkMapping()
    {
        if (empty(self::$bkMapping)) {
            self::$bkMapping = (new BkSettingsForm())->loadData()->bkMapping;
        }
        return self::$bkMapping;
    }

}
