<?php

use yii\db\Migration;

/**
 * Class m230616_181512_deleted_at_to_mailboxes
 */
class m230616_181512_deletedAtToMailboxes extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%e_mailboxes}}', 'deleted_at', $this->integer()->null()
            ->after('ready_checked_at'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%e_mailboxes}}', 'deleted_at');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230616_181512_deleted_at_to_mailboxes cannot be reverted.\n";

        return false;
    }
    */
}
