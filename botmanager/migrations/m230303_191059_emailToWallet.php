<?php

use yii\db\Migration;

/**
 * Class m230303_191059_emailToWallet
 */
class m230303_191059_emailToWallet extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%wallets}}', 'mailboxes_id', $this->integer()
            ->null()->after('chg_password'));

        $this->addForeignKey('wallet_email_fk', '{{%wallets}}', 'mailboxes_id',
            '{{%e_mailboxes}}', 'id');
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown(): bool
    {
        $this->dropForeignKey('wallet_email_fk', '{{%wallets}}');
        $this->dropColumn('{{%wallets}}', 'mailboxes_id');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230303_191059_emailToWallet cannot be reverted.\n";

        return false;
    }
    */
}
