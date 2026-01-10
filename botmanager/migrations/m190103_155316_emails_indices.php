<?php

use yii\db\Migration;

/**
 * Class m190103_155316_emails_indices
 */
class m190103_155316_emails_indices extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->createIndex('e_mailboxes_address_idx', '{{%e_mailboxes}}', ['address']);
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropIndex('e_mailboxes_address_idx', '{{%e_mailboxes}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m190103_155316_emails_indices cannot be reverted.\n";

        return false;
    }
    */
}
