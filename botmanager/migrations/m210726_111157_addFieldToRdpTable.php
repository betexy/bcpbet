<?php

use yii\db\Migration;

/**
 * Class m210726_111157_addFieldToRdpTable
 */
class m210726_111157_addFieldToRdpTable extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%rdp_table}}', 'last_yc_reboot_attempt', $this->integer()
            ->null()->after('last_yc_reboot'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%rdp_table}}', 'last_yc_reboot_attempt');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m210726_111157_addFieldToRdpTable cannot be reverted.\n";

        return false;
    }
    */
}
