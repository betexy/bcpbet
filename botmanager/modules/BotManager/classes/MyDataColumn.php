<?php


namespace app\modules\BotManager\classes;


use yii\helpers\Html;

class MyDataColumn extends \yii\grid\DataColumn
{

    public $linkTo;

    /**
     * {@inheritdoc}
     */
    protected function renderDataCellContent($model, $key, $index)
    {
        if (!empty($this->linkTo)) {
            return Html::a(parent::renderDataCellContent($model, $key, $index), [$this->linkTo, 'id' => $model->id]);
        } else {
            return parent::renderDataCellContent($model, $key, $index);
        }
    }

}