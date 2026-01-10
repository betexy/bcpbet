<?php

use yii\db\Migration;

/**
 * Class m201009_121923_marginReports
 */
class m201009_121923_marginReports extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $tableOptions = null;
        if ($this->db->driverName === 'mysql') {
            $tableOptions = 'CHARACTER SET utf8 COLLATE utf8_general_ci ENGINE=InnoDB';
        }

        $this->createTable('{{%bm_margin_report}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'raw' => $this->text(),
            'remote_ip' => $this->string(20),
            'room_uid' => $this->string(50),
            'status' => $this->string(50),
            'coef' => $this->double(2),
            'requested_coef' => $this->double(2),
            'margin' => $this->double(2),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createIndex('bm_margin_report_created_at_idx', '{{%bm_margin_report}}', 'created_at');
        $this->createIndex('bm_margin_report_remote_ip_idx', '{{%bm_margin_report}}', 'remote_ip');
        $this->createIndex('bm_margin_report_room_uid_idx', '{{%bm_margin_report}}', 'room_uid');
        $this->createIndex('bm_margin_report_status_idx', '{{%bm_margin_report}}', 'status');
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropTable('{{%bm_margin_report}}');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m201009_121923_marginReports cannot be reverted.\n";

        return false;
    }
    */
}
