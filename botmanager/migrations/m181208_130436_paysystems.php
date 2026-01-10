<?php

use yii\db\Migration;

/**
 * Class m181208_130436_paysystems
 */
class m181208_130436_paysystems extends Migration
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

        $this->createTable('{{%ps_paysystems}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'type' => $this->integer()->notNull()->defaultValue(0),
            'is_master' => $this->boolean()->notNull()->defaultValue(0),
            'login' => $this->string(100)->notNull(),
            'password' => $this->string(100)->notNull(),
            'pin' => $this->string(100),
            'balance' => $this->decimal(17, 5),
            'checked_at' => $this->integer(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%ps_paysystems_queue}}', [
            'id' => $this->primaryKey(),
            'ps_paysystems_id' => $this->integer()->notNull(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'sent_at' => $this->integer(),
            'status' => $this->integer()->notNull(),
            'command' => $this->string(255),
            'data' => $this->text(),
            'response' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%ps_paysystems_bots}}', [
            'id' => $this->primaryKey(),
            'deleted' => $this->boolean()->notNull()->defaultValue(0),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'ps_paysystems_id' => $this->integer()->notNull(),
            'bm_bots_id' => $this->integer()->notNull(),
        ], $tableOptions);

        $this->addForeignKey('ps_paysystems_queue_paysystem_fk', '{{%ps_paysystems_queue}}', 'ps_paysystems_id',
            '{{%ps_paysystems}}', 'id');

        $this->addForeignKey('ps_paysystems_bots_paysystem_fk', '{{%ps_paysystems_bots}}', 'ps_paysystems_id',
            '{{%ps_paysystems}}', 'id');
        $this->addForeignKey('ps_paysystems_bots_bot_fk', '{{%ps_paysystems_bots}}', 'bm_bots_id',
            '{{%bm_bots}}', 'id');

        $this->createIndex('ps_paysystems_type_master_idx', '{{%ps_paysystems}}', ['type', 'is_master']);

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {

        $this->dropForeignKey('ps_paysystems_bots_bot_fk', '{{%ps_paysystems_bots}}');
        $this->dropForeignKey('ps_paysystems_bots_paysystem_fk', '{{%ps_paysystems_bots}}');
        $this->dropForeignKey('ps_paysystems_queue_paysystem_fk', '{{%ps_paysystems_queue}}');

        $this->dropIndex('ps_paysystems_type_master_idx', '{{%ps_paysystems}}');

        $this->dropTable('{{%ps_paysystems_bots}}');
        $this->dropTable('{{%ps_paysystems_queue}}');
        $this->dropTable('{{%ps_paysystems}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m181208_130436_paysystems cannot be reverted.\n";

        return false;
    }
    */
}
