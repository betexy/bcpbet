<?php

use yii\db\Migration;

/**
 * Class m200624_023548_createdAtIndexforReports
 */
class m200624_023548_createdAtIndexforReports extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->createIndex('bm_report_created_at_idx', '{{%bm_report}}', 'created_at');
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropIndex('bm_report_created_at_idx', '{{%bm_report}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m200624_023548_createdAtIndexforReports cannot be reverted.\n";

        return false;
    }
    */
}
