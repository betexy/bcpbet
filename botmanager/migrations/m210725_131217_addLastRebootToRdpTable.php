<?php

use yii\db\Migration;

/**
 * Class m210725_131217_addLastRebootToRdpTable
 */
class m210725_131217_addLastRebootToRdpTable extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%rdp_table}}', 'last_yc_reboot', $this->integer()->null()
            ->after('yc_id'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%rdp_table}}', 'last_yc_reboot');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m210725_131217_addLastRebootToRdpTable cannot be reverted.\n";

        return false;
    }
    */
}
