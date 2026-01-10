<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\helpers\ArrayHelper;

/**
 * This is the model class for table "bm_software_versions".
 *
 * @property int $id
 * @property string $name
 * @property string $code
 * @property int $file_groups_id
 * @property string $comment
 *
 * @property FileGroups $files
 */
class SoftwareVersions extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'bm_software_versions';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['name', 'code', 'file_groups_id'], 'required'],
            [['file_groups_id'], 'integer'],
            [['name', 'code', 'comment'], 'string'],
            [['file_groups_id'], 'exist', 'skipOnError' => true, 'targetClass' => FileGroups::class, 'targetAttribute' => ['file_groups_id' => 'id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('BotManager', 'ID'),
            'name' => Yii::t('BotManager', 'Name'),
            'code' => Yii::t('BotManager', 'Code'),
            'file_groups_id' => Yii::t('BotManager', 'Files'),
            'comment' => Yii::t('BotManager', 'Comment'),
            'files.name' => Yii::t('BotManager', 'Files'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getFiles()
    {
        return $this->hasOne(FileGroups::class, ['id' => 'file_groups_id']);
    }

}
