<?php

use yii\db\Migration;

/**
 * Class m190310_104219_bot_type
 */
class m190310_104219_bot_type extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%bm_bots}}', 'logic_name', $this->string(255)->defaultValue('logic'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%bm_bots}}', 'logic_name');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m190310_104219_bot_type cannot be reverted.\n";

        return false;
    }
    */
}
