<?php

use yii\db\Migration;

/**
 * Class m231014_084128_create_xbots
 */
class m231014_084128_create_xbots extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {

        $tableOptions = $this->db->driverName === 'mysql'
            ? 'CHARACTER SET utf8 COLLATE utf8_general_ci ENGINE=InnoDB' : null;

        $this->createTable('{{%xbots}}', [
            'id' => $this->primaryKey(),
            'betexy_bot_id' => $this->integer()->notNull(),
            'betexy_user_id' => $this->integer()->notNull(),
            'name' => $this->string()->notNull()->defaultValue(''),
            'due_date' => $this->string(),
            'active' => $this->boolean()->notNull()->defaultValue(0),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
        ], $tableOptions);


    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropTable('{{%xbots}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m231014_084128_create_xbots cannot be reverted.\n";

        return false;
    }
    */
}
