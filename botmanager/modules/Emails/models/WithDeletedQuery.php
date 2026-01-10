<?php

namespace app\modules\Emails\models;

class WithDeletedQuery extends \yii\db\ActiveQuery
{

    public function init()
    {
        parent::init();
        $this->andWhere(['deleted_at' => null]);
    }

    public function includingDeleted()
    {
        $this->where([]);
        return $this;
    }

}
