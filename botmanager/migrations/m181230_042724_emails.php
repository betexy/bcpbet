<?php

use yii\db\Migration;

/**
 * Class m181230_042724_emails
 */
class m181230_042724_emails extends Migration
{
    /**
     * @return bool|void
     * @throws \yii\base\NotSupportedException
     */
    public function safeUp()
    {

        $tableOptions = null;
        if ($this->db->driverName === 'mysql') {
            $tableOptions = 'CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci ENGINE=InnoDB';
        }

        $this->createTable('{{%e_mailboxes}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'checked_at' => $this->integer()->notNull()->defaultValue(0),
            'mail_count' => $this->integer()->notNull()->defaultValue(0),
            'type' => $this->integer()->notNull()->defaultValue(0),
            'address' => $this->string()->notNull(),
            'login' => $this->string(100)->notNull(),
            'password' => $this->string(100)->notNull(),
            'secret' => $this->string(100),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%e_emails}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'e_mailboxes_id' => $this->integer()->notNull(),
            'imap_id' => $this->integer()->notNull(),
            'message_id' => $this->string()->notNull()->defaultValue(''),
            'imap_datetime' => $this->string(30)->notNull(),
            'from_name' => $this->string()->notNull()->defaultValue(''),
            'from_address' => $this->string()->notNull()->defaultValue(''),
            'to' => $this->string()->notNull()->defaultValue(''),
            'to_string' => $this->string()->notNull()->defaultValue(''),
            'cc' => $this->string()->notNull()->defaultValue(''),
            'reply_to' => $this->string()->notNull()->defaultValue(''),
            'subject' => $this->string()->notNull()->defaultValue(''),
            'text_plain' => $this->text(),
            'text_html' => $this->getDb()->getSchema()->createColumnSchemaBuilder('longtext'),
            'attachments' => $this->text(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%e_mailboxes_sims}}', [
            'id' => $this->primaryKey(),
            'deleted' => $this->boolean()->notNull()->defaultValue(0),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'e_mailboxes_id' => $this->integer()->notNull(),
            'sims_sims_id' => $this->integer()->notNull(),
        ], $tableOptions);

        $this->addForeignKey('e_emails_mailboxes_fk', '{{%e_emails}}', 'e_mailboxes_id',
            '{{%e_mailboxes}}', 'id');

        $this->addForeignKey('e_mailboxes_sims_fk_mailboxes', '{{%e_mailboxes_sims}}', 'e_mailboxes_id',
            '{{%e_mailboxes}}', 'id');
        $this->addForeignKey('e_mailboxes_sims_fk_sims', '{{%e_mailboxes_sims}}', 'sims_sims_id',
            '{{%sims_sims}}', 'id');

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {

        $this->dropForeignKey('e_mailboxes_sims_fk_sims', '{{%e_mailboxes_sims}}');
        $this->dropForeignKey('e_mailboxes_sims_fk_mailboxes', '{{%e_mailboxes_sims}}');
        $this->dropForeignKey('e_emails_mailboxes_fk', '{{%e_emails}}');

        $this->dropTable('{{%e_mailboxes_sims}}');
        $this->dropTable('{{%e_emails}}');
        $this->dropTable('{{%e_mailboxes}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m181230_042724_emails cannot be reverted.\n";

        return false;
    }
    */
}
