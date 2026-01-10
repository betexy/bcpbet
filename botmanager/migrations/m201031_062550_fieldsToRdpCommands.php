<?php

use yii\db\Migration;

/**
 * Class m201031_062550_fieldsToRdpCommands
 */
class m201031_062550_fieldsToRdpCommands extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%rdp_commands}}', 'ip', $this->string(15)->null()
            ->after('updated_at'));

        $this->createIndex('rdp_commands_ip_idx', '{{%rdp_commands}}', ['ip']);
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropIndex('rdp_commands_ip_idx', '{{%rdp_commands}}');
        $this->dropColumn('{{%rdp_commands}}', 'ip');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m201031_062550_fieldsToRdpCommands cannot be reverted.\n";

        return false;
    }
    */
}
