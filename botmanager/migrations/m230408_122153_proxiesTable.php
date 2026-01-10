<?php

use yii\db\Migration;

/**
 * Class m230408_122153_proxiesTable
 */
class m230408_122153_proxiesTable extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        // Create proxies table
        $tableOptions = $this->db->driverName === 'mysql'
            ? 'CHARACTER SET utf8 COLLATE utf8_general_ci ENGINE=InnoDB' : null;
        $this->createTable('{{%proxies}}', [
            'id' => $this->primaryKey(),
            'betexy_id' => $this->integer()->null(),
            'deleted' => $this->boolean()->notNull()->defaultValue(false),
            'name' => $this->string()->notNull(),
            'protocol' => $this->string()->notNull(),
            'host' => $this->string()->notNull(),
            'port' => $this->integer()->notNull(),
            'country' => $this->string()->notNull(),
            'login' => $this->string()->null(),
            'password' => $this->string()->null(),
            'is_mobile' => $this->boolean()->notNull()->defaultValue(false),
            'comment' => $this->text()->null(),
            'registered_at' => $this->integer()->null(),
            'finish_at' => $this->integer()->null(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
        ], $tableOptions);

        // Link to proxy from stake account
        $this->addColumn('{{%stake_accounts}}', 'proxies_id', $this->integer()->null()
            ->after('mailboxes_id'));
        $this->addColumn('{{%stake_accounts}}', 'betexy_id', $this->integer()->null()
            ->after('id'));
        $this->addForeignKey('stake_accounts_proxies_fk', '{{%stake_accounts}}', 'proxies_id',
            '{{%proxies}}', 'id');
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown(): bool
    {
        $this->dropForeignKey('stake_accounts_proxies_fk', '{{%stake_accounts}}');
        $this->dropColumn('{{%stake_accounts}}', 'proxies_id');
        $this->dropColumn('{{%stake_accounts}}', 'betexy_id');
        $this->dropTable('{{%proxies}}');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230408_122153_proxiesTable cannot be reverted.\n";

        return false;
    }
    */
}
