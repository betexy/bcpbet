<?php

use yii\db\Migration;

/**
 * Class m230519_054423_readyForStakeToMailboxes
 */
class m230519_054423_readyCheckedAtToMailboxes extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%e_mailboxes}}', 'ready_checked_at', $this->integer()
            ->notNull()->defaultValue(0)->after('checked_at'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%e_mailboxes}}', 'ready_checked_at');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230519_054423_readyForStakeToMailboxes cannot be reverted.\n";

        return false;
    }
    */
}
