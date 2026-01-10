<?php

use yii\db\Migration;

/**
 * Class m230120_052420_successBetInterval_to_configs
 */
class m230120_052420_successBetInterval_to_configs extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%configs}}', 'successBetInterval', $this->integer()
            ->null()->after('eventMaxBets')->defaultValue('30'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%configs}}', 'successBetInterval');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230120_052420_successBetInterval_to_configs cannot be reverted.\n";

        return false;
    }
    */
}
