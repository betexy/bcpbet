<?php

use yii\db\Migration;

/**
 * Class m200623_031040_reportIndeces
 */
class m200623_031040_reportIndeces extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->createIndex('bm_report_remote_ip_idx', '{{%bm_report}}', 'remote_ip');
        $this->createIndex('bm_report_category_idx', '{{%bm_report}}', 'category');
        $this->createIndex('bm_report_action_idx', '{{%bm_report}}', 'action');
        $this->createIndex('bm_report_room_bk_idx', '{{%bm_report}}', 'room_bk');
        $this->createIndex('bm_report_parsed_idx', '{{%bm_report}}', 'parsed');
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {

        $this->dropIndex('bm_report_remote_ip_idx', '{{%bm_report}}');
        $this->dropIndex('bm_report_category_idx', '{{%bm_report}}');
        $this->dropIndex('bm_report_action_idx', '{{%bm_report}}');
        $this->dropIndex('bm_report_room_bk_idx', '{{%bm_report}}');
        $this->dropIndex('bm_report_parsed_idx', '{{%bm_report}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m200623_031040_reportIndeces cannot be reverted.\n";

        return false;
    }
    */
}
