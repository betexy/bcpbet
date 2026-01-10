<?php

use yii\db\Migration;

/**
 * Class m230415_203958_last_start_atToStakeAccounts
 */
class m230415_203958_last_start_atToStakeAccounts extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%stake_accounts}}', 'last_start_at', $this->integer()
            ->null()->after('registered_at'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%stake_accounts}}', 'last_start_at');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230415_203958_last_start_atToStakeAccounts cannot be reverted.\n";

        return false;
    }
    */
}
