<?php

use yii\db\Migration;

/**
 * Class m181202_073010_requests
 */
class m181202_073010_requests extends Migration
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

        $this->createTable('{{%sims_requests}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'websocket_uid' => $this->string(30)->notNull(),
            'bm_bots_id' => $this->integer()->notNull(),
            'command' => $this->string(30)->notNull(),
            'request' => $this->text(),
            'response' => $this->text()
        ], $tableOptions);

        $this->createTable('{{%sims_actions}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'sims_requests_id' => $this->integer()->notNull(),
            // Line is on hold by Bot
            'active' => $this->boolean()->notNull()->defaultValue(false),
            // Action is in queue for check bound
            'in_queue' => $this->boolean()->notNull()->defaultValue(false),
            // Operations with this action completely finished
            'finished' => $this->boolean()->notNull()->defaultValue(false),
            'sims_sims_id' => $this->integer(),
            'sims_channels_id' => $this->integer(),
            'bound_at' => $this->integer(),
            'released_at' => $this->integer(),
        ], $tableOptions);

        $this->createTable('{{%sims_answers}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'sent_at' => $this->integer()->notNull()->defaultValue(0),
            'sims_requests_id' => $this->integer()->notNull(),
            'command' => $this->string(30)->notNull(),
            'content' => $this->text(),
        ], $tableOptions);

        $this->addForeignKey('sims_requests_bm_bots', '{{%sims_requests}}', 'bm_bots_id',
            '{{%bm_bots}}', 'id');

        $this->addForeignKey('sims_actions_sims_requests', '{{%sims_actions}}', 'sims_requests_id',
            '{{%sims_requests}}', 'id');
        $this->addForeignKey('sims_actions_sims_sims', '{{%sims_actions}}', 'sims_sims_id',
            '{{%sims_sims}}', 'id');
        $this->addForeignKey('sims_actions_sims_channels', '{{%sims_actions}}', 'sims_channels_id',
            '{{%sims_channels}}', 'id');

        $this->addForeignKey('sims_answers_sims_requests', '{{%sims_answers}}', 'sims_requests_id',
            '{{%sims_requests}}', 'id');

        $this->createIndex('sims_actions_sims_sims_id_active_idx', '{{%sims_actions}}', ['sims_sims_id', 'active']);
        $this->createIndex('sims_actions_in_queue_idx', '{{%sims_actions}}', ['sims_sims_id', 'active', 'in_queue']);
        $this->createIndex('sims_actions_sims_channels_idx', '{{%sims_actions}}', ['sims_channels_id', 'active']);

        $this->createIndex('sims_answers_sent_at_idx', '{{%sims_answers}}', ['sent_at', 'sims_requests_id']);

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropForeignKey('sims_requests_bm_bots', '{{%sims_requests}}');

        $this->dropForeignKey('sims_actions_sims_requests', '{{%sims_actions}}');
        $this->dropForeignKey('sims_actions_sims_sims', '{{%sims_actions}}');
        $this->dropForeignKey('sims_actions_sims_channels', '{{%sims_actions}}');

        $this->dropForeignKey('sims_answers_sims_requests', '{{%sims_answers}}');

        $this->dropIndex('sims_actions_sims_sims_id_active_idx', '{{%sims_actions}}');
        $this->dropIndex('sims_actions_in_queue_idx', '{{%sims_actions}}');
        $this->dropIndex('sims_actions_sims_channels_idx', '{{%sims_actions}}');

        $this->dropIndex('sims_answers_sent_at_idx', '{{%sims_answers}}');

        $this->dropTable('{{%sims_actions}}');
        $this->dropTable('{{%sims_requests}}');
        $this->dropTable('{{%sims_answers}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m181202_073010_requests cannot be reverted.\n";

        return false;
    }
    */
}
