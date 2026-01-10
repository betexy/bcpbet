<?php

use yii\db\Migration;

/**
 * Class m230122_051708_wallets
 */
class m230122_051708_wallets extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $tableOptions = $this->db->driverName === 'mysql'
            ? 'CHARACTER SET utf8 COLLATE utf8_general_ci ENGINE=InnoDB' : null;

        $this->createTable('{{%wallets}}', [
            'id' => $this->string(255)->notNull(),
            'network' => $this->string()->notNull()->defaultValue('bsc'),
            'approved' => $this->boolean()->notNull()->defaultValue(false),
            'uid' => $this->string(255)->notNull(),
            'bookie' => $this->string(255)->notNull(),
            'login' => $this->string(255)->notNull(),
            'comment' => $this->text()->null(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
        ], $tableOptions);

        $this->addPrimaryKey('pk_wallets', '{{%wallets}}', 'id');

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown(): bool
    {
        $this->dropTable('{{%wallets}}');

        return true;

    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230122_051708_wallets cannot be reverted.\n";

        return false;
    }
    */
}
