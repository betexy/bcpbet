<?php

use yii\db\Migration;

/**
 * Class m190524_165252_botsExtension
 */
class m190524_165252_botsExtension extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%bm_bots}}', 'comment_vpn', $this->string()->null());
        $this->addColumn('{{%bm_bots}}', 'comment_proxy', $this->string()->null());
        $this->addColumn('{{%bm_bots}}', 'comment_multilogin', $this->string()->null());
        $this->addColumn('{{%bm_bots}}',  'bm_server_id', $this->integer()->null());
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%bm_bots}}', 'comment_vpn');
        $this->dropColumn('{{%bm_bots}}', 'comment_proxy');
        $this->dropColumn('{{%bm_bots}}', 'comment_multilogin');
        $this->dropColumn('{{%bm_bots}}', 'bm_server_id');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m190524_165252_botsExtension cannot be reverted.\n";

        return false;
    }
    */
}
