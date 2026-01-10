<?php

use yii\db\Migration;

/**
 * Class m201028_011630_rdpCommands
 */
class m201028_011630_rdpCommands extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $tableOptions = $this->db->driverName === 'mysql'
            ? 'CHARACTER SET utf8 COLLATE utf8_general_ci ENGINE=InnoDB' : null;

        $this->createTable('{{%rdp_commands}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'sent_at' => $this->integer()->notNull()->defaultValue(0),
            'finished_at' => $this->integer()->notNull()->defaultValue(0),
            'command' => $this->text(),
            'result' => $this->text(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createIndex('rdp_commands_created_sent_idx', '{{%rdp_commands}}', ['created_at', 'sent_at']);

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropIndex('rdp_commands_created_sent_idx', '{{%rdp_commands}}');

        $this->dropTable('{{%rdp_commands}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m201028_011630_rdpCommands cannot be reverted.\n";

        return false;
    }
    */
}
