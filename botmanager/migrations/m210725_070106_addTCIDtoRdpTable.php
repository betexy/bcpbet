<?php

use yii\db\Migration;

/**
 * Class m210725_070106_addTCIDtoRdpTable
 */
class m210725_070106_addTCIDtoRdpTable extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%rdp_table}}', 'yc_id', $this->string()->null()
        ->after('guacamole_link'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%rdp_table}}', 'yc_id');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m210725_070106_addTCIDtoRdpTable cannot be reverted.\n";

        return false;
    }
    */
}
