<?php

use yii\db\Migration;

/**
 * Class m181111_075846_addMultiloginPort
 */
class m181111_075846_addMultiloginPort extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%bm_bots}}', 'multilogin_port_number', $this->integer());
        $this->addColumn('{{%bm_bots}}', 'server_name', $this->string(255));
        $this->addColumn('{{%bm_bots}}', 'install_anticaptcha', $this->boolean());
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%bm_bots}}', 'server_name');
        $this->dropColumn('{{%bm_bots}}', 'multilogin_port_number');
        $this->dropColumn('{{%bm_bots}}', 'install_anticaptcha');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m181111_075846_addMultiloginPort cannot be reverted.\n";

        return false;
    }
    */
}
