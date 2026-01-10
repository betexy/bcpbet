<?php

use yii\db\Migration;

/**
 * Class m241002_044543_forkSecondBookieToConfigs
 */
class m241002_044543_forkSecondBookieToConfigs extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%configs}}', 'second_bookie', $this->string()->null());
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%configs}}', 'second_bookie');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m231103_034543_newExpressesToConfigs cannot be reverted.\n";

        return false;
    }
    */
}
