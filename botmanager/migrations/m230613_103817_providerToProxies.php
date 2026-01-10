<?php

use yii\db\Migration;

/**
 * Class m230613_103817_providerToProxies
 */
class m230613_103817_providerToProxies extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%proxies}}', 'provider', $this->string()
            ->notNull()->defaultValue('proxyline')->after('id'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%proxies}}', 'provider');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230613_103817_providerToProxies cannot be reverted.\n";

        return false;
    }
    */
}
