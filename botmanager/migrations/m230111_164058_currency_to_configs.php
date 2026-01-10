<?php

use yii\db\Migration;

/**
 * Class m230111_164058_currency_to_configs
 */
class m230111_164058_currency_to_configs extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%configs}}', 'currency', $this->string()
            ->null()->after('source')->defaultValue('USD'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%configs}}', 'currency');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230111_164058_currency_to_configs cannot be reverted.\n";

        return false;
    }
    */
}
