<?php

use yii\db\Migration;

/**
 * Class m190526_164100_guacamoleLinkToBot
 */
class m190526_164100_guacamoleLinkToBot extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%bm_bots}}', 'guacamole_link', $this->string()->null());
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%bm_bots}}', 'guacamole_link');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m190526_164100_guacamoleLinkToBot cannot be reverted.\n";

        return false;
    }
    */
}
