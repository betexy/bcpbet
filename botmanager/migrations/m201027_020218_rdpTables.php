<?php

use yii\db\Migration;

/**
 * Class m201027_020218_rdpTables
 */
class m201027_020218_rdpTables extends Migration
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


        $this->createTable('{{%rdp_activity}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'ip' => $this->string(15)->notNull(),
            'last_activity' => $this->integer()->notNull(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%rdp_table}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'ip' => $this->string(15)->notNull(),
            'deleted' => $this->boolean()->defaultValue(false),
            'name' => $this->string(255)->notNull(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createIndex('rdp_activity_ip_idx', '{{%rdp_activity}}', ['ip', 'last_activity']);
        $this->createIndex('rdp_table_ip_idx', '{{%rdp_table}}', 'ip');

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropIndex('rdp_activity_ip_idx', '{{%rdp_activity}}');
        $this->dropIndex('rdp_table_ip_idx', '{{%rdp_table}}');

        $this->dropTable('{{%rdp_table}}');
        $this->dropTable('{{%rdp_activity}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m201027_020218_rdpTables cannot be reverted.\n";

        return false;
    }
    */
}
