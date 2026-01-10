<?php

use yii\db\Migration;

/**
 * Class m230202_034629_newFieldsToWallets
 */
class m230202_034629_newFieldsToWallets extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%wallets}}', 'deleted', $this->boolean()
            ->notNull()->defaultValue(false)->after('id'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown(): bool
    {
        $this->dropColumn('{{%wallets}}', 'deleted');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230202_034629_newFieldsToWallets cannot be reverted.\n";

        return false;
    }
    */
}
