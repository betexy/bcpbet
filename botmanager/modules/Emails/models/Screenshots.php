<?php

namespace app\modules\Emails\models;

use Yii;
use yii\behaviors\TimestampBehavior;

/**
 * This is the model class for table "{{%e_screenshots}}".
 *
 * @property int $id
 * @property int $created_at
 * @property int $updated_at
 * @property string $name
 * @property string $tag
 * @property string $description
 * @property string $comment
 * @property string $image
 */
class Screenshots extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%e_screenshots}}';
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
            [['name'], 'required'],
            [['created_at', 'updated_at'], 'integer'],
            [['description', 'comment', 'image'], 'string'],
            [['name', 'tag'], 'string', 'max' => 255],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('Emails', 'ID'),
            'created_at' => Yii::t('Emails', 'Created At'),
            'updated_at' => Yii::t('Emails', 'Updated At'),
            'name' => Yii::t('Emails', 'Name'),
            'tag' => Yii::t('Emails', 'Tag'),
            'description' => Yii::t('Emails', 'Description'),
            'comment' => Yii::t('Emails', 'Comment'),
            'image' => Yii::t('Emails', 'Image'),
        ];
    }
}
