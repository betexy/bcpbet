<?php

use yii\db\Migration;

/**
 * Class m201031_005015_fieldsToRdpActivity
 */
class m201031_005015_fieldsToRdpActivity extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%rdp_activity}}', 'deleted', $this->boolean()->defaultValue(0)
            ->after('ip'));
        $this->addColumn('{{%rdp_activity}}', 'last_login', $this->integer()->defaultValue(0)
            ->after('last_activity'));
        $this->addColumn('{{%rdp_activity}}', 'logins_failed', $this->integer()
            ->defaultValue(0)->after('last_login'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%rdp_activity}}', 'deleted');
        $this->dropColumn('{{%rdp_activity}}', 'last_login');
        $this->dropColumn('{{%rdp_activity}}', 'logins_failed');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m201031_005015_fieldsToRdpActivity cannot be reverted.\n";

        return false;
    }
    */
}
