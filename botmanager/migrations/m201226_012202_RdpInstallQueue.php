<?php

use yii\db\Migration;

/**
 * Class m201226_012202_RdpInstallQueue
 */
class m201226_012202_RdpInstallQueue extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $tableOptions = $this->db->driverName === 'mysql'
            ? 'CHARACTER SET utf8 COLLATE utf8_general_ci ENGINE=InnoDB' : null;

        $this->createTable('{{%rdp_install_queue}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'sent_at' => $this->integer()->notNull()->defaultValue(0),
            'finished_at' => $this->integer()->notNull()->defaultValue(0),
            'command' => $this->text(),
            'ssh_result' => 'LONGTEXT',
            'success' => $this->boolean()->defaultValue(false),
            'response' => $this->text(),
            'rdp_command_id' => $this->integer()->notNull()->defaultValue(0),
            'finished' => $this->boolean()->defaultValue(0),
            'guacamole_link' => $this->string(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createIndex('rdp_install_queue_created_sent_idx', '{{%rdp_install_queue}}', ['created_at', 'sent_at']);
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropIndex('rdp_install_queue_created_sent_idx', '{{%rdp_install_queue}}');

        $this->dropTable('{{%rdp_install_queue}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m201226_012202_RdpInstallQueue cannot be reverted.\n";

        return false;
    }
    */
}
