<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\behaviors\TimestampBehavior;
use yii\helpers\ArrayHelper;

/**
 * This is the model class for table "bm_files".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property string $name
 * @property string $source_name
 * @property string $source_path
 * @property string $file_name
 * @property string $file_path
 * @property string $tag
 * @property string $comment
 *
 */
class Files extends \yii\db\ActiveRecord
{

    public static $sourcePaths = [
        '@root/',
        '@root/js/',
        '@root/libs/',
    ];

    public static $tags = [
        'Extension',
        'BK',
        'Software',
        'Plugin',
        'Testing',
    ];

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'bm_files';
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
            [['name', 'source_name', 'source_path', 'file_name', 'file_path'], 'required'],
            [['created_at', 'updated_at'], 'integer'],
            [['comment'], 'string'],
            [['name', 'source_name', 'source_path', 'file_name', 'file_path', 'tag'], 'string', 'max' => 255],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('BotManager', 'ID'),
            'created_at' => Yii::t('BotManager', 'Created At'),
            'updated_at' => Yii::t('BotManager', 'Updated At'),
            'name' => Yii::t('BotManager', 'Name'),
            'source_name' => Yii::t('BotManager', 'Source Name'),
            'source_path' => Yii::t('BotManager', 'Source Path'),
            'file_name' => Yii::t('BotManager', 'File Name'),
            'file_path' => Yii::t('BotManager', 'File Path'),
            'tag' => Yii::t('BotManager', 'Tag'),
            'comment' => Yii::t('BotManager', 'Comment'),
        ];
    }

    /**
     * Delete the file, linked to current record
     * @return bool
     */
    public function unlinkFile()
    {
        if (!empty($this->file_name) && !empty($this->file_path) && file_exists($this->file_path . $this->file_name)) {
            return unlink($this->file_path . $this->file_name);
        } else {
            return true;
        }
    }

    public static function retrieveFilesByExt($ext)
    {
        if (is_array($ext)) {
            $result = [];
            foreach ($ext as $ex) {
                $result = ArrayHelper::merge($result,
                    ArrayHelper::map(self::find()->andFilterWhere(['like', 'source_name', "%.{$ex}", false])->orderBy('name')->all(), 'id', 'name'));
            }
            return $result;
        } else {
            return ArrayHelper::map(self::find()->andFilterWhere(['like', 'source_name', "%.{$ext}", false])->orderBy('name')->all(), 'id', 'name');
        }
    }

    public static function retrieveFilesByTags($tags)
    {
        if (is_array($tags)) {
            $result = [];
            foreach ($tags as $tag) {
                $result = ArrayHelper::merge($result,
                    ArrayHelper::map(self::find()->andFilterWhere(['like', 'tag', "{$tag}", false])->orderBy('name')->all(), 'id', 'name'));
            }
            return $result;
        } else {
            return ArrayHelper::map(self::find()->andFilterWhere(['like', 'tag', "{$tags}", false])->orderBy('name')->all(), 'id', 'name');
        }
    }

}

