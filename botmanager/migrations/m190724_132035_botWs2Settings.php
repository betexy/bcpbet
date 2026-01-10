<?php

use yii\db\Migration;

/**
 * Class m190724_132035_botWs2Settings
 */
class m190724_132035_botWs2Settings extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%bm_bots}}', 'double_enabled', $this->boolean()->defaultValue(false));
        $this->addColumn('{{%bm_bots}}', 'double_url', $this->string(255)->null());
        $this->addColumn('{{%bm_bots}}', 'double_uid', $this->string(255)->null());
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%bm_bots}}', 'double_uid');
        $this->dropColumn('{{%bm_bots}}', 'double_url');
        $this->dropColumn('{{%bm_bots}}', 'double_enabled');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m190724_132035_botWs2Settings cannot be reverted.\n";

        return false;
    }
    */
}
