<?php

use yii\db\Migration;

/**
 * Class m210726_084527_addFieldToRdpTable
 */
class m210726_084527_addFieldToRdpTable extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%rdp_table}}', 'yc_account', $this->integer()->defaultValue(1)
            ->null()->after('yc_id'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%rdp_table}}', 'yc_account');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m210726_084527_addFieldToRdpTable cannot be reverted.\n";

        return false;
    }
    */
}
