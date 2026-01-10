<?php

use yii\db\Migration;

/**
 * Class m190127_154641_psAddAdditionsColumn
 */
class m190127_154641_psAddAdditionsColumn extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%ps_paysystems}}', 'additions', $this->text()->null());
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%ps_paysystems}}', 'additions');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m190127_154641_psAddAdditionsColumn cannot be reverted.\n";

        return false;
    }
    */
}
