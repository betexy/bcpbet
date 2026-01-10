<?php

use yii\db\Migration;

/**
 * Class m210711_133507_addGLtoRdpTable
 */
class m210711_133507_addGLtoRdpTable extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%rdp_table}}', 'guacamole_link', $this->string(500)->null()
            ->after('name'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%rdp_table}}', 'guacamole_link');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m210711_133507_addGLtoRdpTable cannot be reverted.\n";

        return false;
    }
    */
}
