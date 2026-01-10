<?php

use yii\db\Migration;

/**
 * Class m210715_032633_buyerQueue
 */
class m210715_032633_buyerQueue extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $tableOptions = $this->db->driverName === 'mysql'
            ? 'CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci ENGINE=InnoDB' : null;

        $this->createTable('{{%buyer_queue}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'sent_at' => $this->integer()->notNull()->defaultValue(0),
            'finished_at' => $this->integer()->notNull()->defaultValue(0),
            'command' => $this->text(),
            'is_live' => $this->boolean()->defaultValue(true),
            'success' => $this->boolean()->defaultValue(false),
            'response' => $this->text(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createIndex('buyer_queue_created_sent_idx', '{{%buyer_queue}}', ['created_at', 'sent_at']);
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropIndex('buyer_queue_created_sent_idx', '{{%buyer_queue}}');
        $this->dropTable('{{%buyer_queue}}');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m210715_032633_buyerQueue cannot be reverted.\n";

        return false;
    }
    */
}
