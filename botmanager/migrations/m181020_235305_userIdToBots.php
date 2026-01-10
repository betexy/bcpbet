<?php

use yii\db\Migration;

/**
 * Class m181020_235305_userIdToBots
 */
class m181020_235305_userIdToBots extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%bm_bots}}', 'user_id', $this->integer());
        $this->addColumn('{{%bm_bots}}', 'payment_method', $this->integer()->notNull()->defaultValue(0));
        $this->addColumn('{{%bm_bots}}', 'payment_login', $this->string());
        $this->addColumn('{{%bm_bots}}', 'payment_password', $this->string());
        $this->addColumn('{{%bm_bots}}', 'remote_type', $this->integer()->notNull()->defaultValue(0));
        $this->addColumn('{{%bm_bots}}', 'remote_login', $this->string());
        $this->addColumn('{{%bm_bots}}', 'remote_password', $this->string());
        $this->addColumn('{{%bm_bots}}', 'remote_installed', $this->boolean()->defaultValue(false));
        $this->createIndex('bm_bots_user_id_idx', '{{%bm_bots}}', 'user_id');
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropIndex('bm_bots_user_id_idx', '{{%bm_bots}}');
        $this->dropColumn('{{%bm_bots}}', 'user_id');
        $this->dropColumn('{{%bm_bots}}', 'payment_method');
        $this->dropColumn('{{%bm_bots}}', 'payment_login');
        $this->dropColumn('{{%bm_bots}}', 'payment_password');
        $this->dropColumn('{{%bm_bots}}', 'remote_type');
        $this->dropColumn('{{%bm_bots}}', 'remote_login');
        $this->dropColumn('{{%bm_bots}}', 'remote_password');
        $this->dropColumn('{{%bm_bots}}', 'remote_installed');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m181020_235305_userIdToBots cannot be reverted.\n";

        return false;
    }
    */
}
