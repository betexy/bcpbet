<?php

use yii\db\Migration;

/**
 * Class m190524_183124_servers
 */
class m190524_183124_servers extends Migration
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

        $this->createTable('{{%bm_server}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'name' => $this->string()->notNull(),
            'resource' => $this->integer()->notNull()->defaultValue(0),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%bm_server_ip}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'ip' => $this->string(40)->notNull(),
            'bm_server_id' => $this->integer()->null(),
        ], $tableOptions);

        $this->createIndex('bm_server_ip_ip_idx', '{{%bm_server_ip}}', ['ip']);

        $this->addForeignKey('bm_server_ip_bm_server_fk', '{{%bm_server_ip}}', 'bm_server_id',
            '{{%bm_server}}', 'id');

        $this->addForeignKey('bm_bots_bm_server_fk', '{{%bm_bots}}', 'bm_server_id',
            '{{%bm_server}}', 'id');

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropIndex('bm_server_ip_ip_idx', '{{%bm_server_ip}}');
        $this->dropForeignKey('bm_server_ip_bm_server_fk', '{{%bm_server_ip}}');
        $this->dropForeignKey('bm_bots_bm_server_fk', '{{%bm_bots}}');
        $this->dropTable('{{%bm_server_ip}}');
        $this->dropTable('{{%bm_server}}');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m190524_183124_servers cannot be reverted.\n";

        return false;
    }
    */
}
