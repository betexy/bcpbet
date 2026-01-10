<?php

use yii\db\Migration;

/**
 * Class m210731_082149_addForcedSendToRdpCommands
 */
class m210731_082149_addForcedSendToRdpCommands extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%rdp_commands}}', 'forced_send', $this->integer()
            ->null()->after('updated_at'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%rdp_commands}}', 'forced_send');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m210731_082149_addForcedSendToRdpCommands cannot be reverted.\n";

        return false;
    }
    */
}
