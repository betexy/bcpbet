<?php

use yii\db\Migration;

/**
 * Class m230306_072654_classicalIdToWallets
 */
class m230306_072654_classicalIdToWallets extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->execute('ALTER TABLE wallets DROP PRIMARY KEY');
        $this->execute('ALTER TABLE wallets CHANGE id deposit_address varchar(255) NOT NULL UNIQUE');
        $this->execute('ALTER TABLE wallets ADD id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST');
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->execute('ALTER TABLE wallets MODIFY COLUMN id int(11) NOT NULL');
        $this->execute('ALTER TABLE wallets DROP COLUMN id');
        $this->execute('ALTER TABLE wallets DROP INDEX deposit_address');
        $this->execute('ALTER TABLE wallets CHANGE deposit_address id varchar(255) NOT NULL PRIMARY KEY FIRST');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230306_072654_classicalIdToWallets cannot be reverted.\n";

        return false;
    }
    */
}
