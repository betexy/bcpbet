<?php

use yii\db\Migration;

/**
 * Class m200622_001910_reportsMessageToText
 */
class m200622_001910_reportsMessageToText extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->alterColumn('{{%bm_report}}', 'message', 'text null');
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->alterColumn('{{%bm_report}}', 'message', 'string(50) null');
        return true;
    }

}
