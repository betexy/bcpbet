<?php

namespace app\modules\BotManager\models;

use Yii;

/**
 * This is the model class for table "bm_files_file_groups".
 *
 * @property int $id
 * @property int $file_groups_id
 * @property int $files_id
 *
 * @property FileGroups $fileGroups
 * @property Files $files
 */
class FilesFileGroups extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'bm_files_file_groups';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['file_groups_id', 'files_id'], 'required'],
            [['file_groups_id', 'files_id'], 'integer'],
            [['file_groups_id'], 'exist', 'skipOnError' => true, 'targetClass' => FileGroups::class, 'targetAttribute' => ['file_groups_id' => 'id']],
            [['files_id'], 'exist', 'skipOnError' => true, 'targetClass' => Files::class, 'targetAttribute' => ['files_id' => 'id']],
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
            'files_id' => Yii::t('BotManager', 'Files ID'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getFileGroups()
    {
        return $this->hasOne(FileGroups::class, ['id' => 'file_groups_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getFiles()
    {
        return $this->hasOne(Files::class, ['id' => 'files_id']);
    }
}
