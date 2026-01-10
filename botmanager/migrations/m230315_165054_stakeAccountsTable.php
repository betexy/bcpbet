<?php

use yii\db\Migration;

/**
 * Class m230221_165054_stakeAccountsTable
 */
class m230315_165054_stakeAccountsTable extends Migration
{
    /**
     * {@inheritdoc}
     */
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $tableOptions = $this->db->driverName === 'mysql'
            ? 'CHARACTER SET utf8 COLLATE utf8_general_ci ENGINE=InnoDB' : null;
        // почта;логин;пароль;дата рождения;имя;фамилия;страна;адрес;город;индекс;место работы;сумма пополнения;айди бинанс апи
        $this->createTable('{{%stake_accounts}}', [
            'id' => $this->primaryKey(),
            'deleted' => $this->boolean()->notNull()->defaultValue(false),
            'name' => $this->string()->notNull(),
            'mailboxes_id' => $this->integer()->null(),
            'register' => $this->string()->null(),
            'register_filling' => $this->string()->null(),
            'configs_stakes' => $this->string()->null(),
            'browser' => $this->string()->null(),
            'profile' => $this->text()->null(),
            'login' => $this->text()->null(),
            'password' => $this->text()->null(),
            'comment' => $this->text()->null(),
            'registered_at' => $this->integer()->null(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
        ], $tableOptions);
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown(): bool
    {
        $this->dropTable('{{%stake_accounts}}');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230221_165054_stakeAccountsTable cannot be reverted.\n";

        return false;
    }
    */
}
