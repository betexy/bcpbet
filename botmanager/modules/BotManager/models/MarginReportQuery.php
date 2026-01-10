<?php

namespace app\modules\BotManager\models;

/**
 * This is the ActiveQuery class for [[MarginReport]].
 *
 * @see MarginReport
 */
class MarginReportQuery extends \yii\db\ActiveQuery
{
    /*public function active()
    {
        return $this->andWhere('[[status]]=1');
    }*/

    /**
     * {@inheritdoc}
     * @return MarginReport[]|array
     */
    public function all($db = null)
    {
        return parent::all($db);
    }

    /**
     * {@inheritdoc}
     * @return MarginReport|array|null
     */
    public function one($db = null)
    {
        return parent::one($db);
    }
}
