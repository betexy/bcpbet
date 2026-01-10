<?php

use yii\db\Migration;

/**
 * Class m230201_055207_fieldsToWallets
 */
class m230201_055207_fieldsToWallets extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%wallets}}', 'withdrawal_address', $this->string()
            ->null()->after('id'));
        $this->addColumn('{{%wallets}}', 'withdrawal_balance_usdt', $this->string()
            ->null()->after('withdrawal_address'));
        $this->addColumn('{{%wallets}}', 'withdrawal_balance_bnb', $this->string()
            ->null()->after('withdrawal_balance_usdt'));
        $this->addColumn('{{%wallets}}', 'chg_password', $this->string()
            ->null()->after('withdrawal_balance_bnb'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%wallets}}', 'withdrawal_address');
        $this->dropColumn('{{%wallets}}', 'withdrawal_balance_usdt');
        $this->dropColumn('{{%wallets}}', 'withdrawal_balance_bnb');
        $this->dropColumn('{{%wallets}}', 'chg_password');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230201_055207_fieldsToWallets cannot be reverted.\n";

        return false;
    }
    */
}
