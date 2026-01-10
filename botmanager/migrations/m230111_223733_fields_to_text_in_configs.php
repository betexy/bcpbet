<?php

use yii\db\Migration;

/**
 * Class m230111_223733_fields_to_text_in_configs
 */
class m230111_223733_fields_to_text_in_configs extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->alterColumn('{{%configs}}', 'excludeBets', $this->text());
        $this->alterColumn('{{%configs}}', 'excludeLeagues', $this->text());
        $this->alterColumn('{{%configs}}', 'excludeSportMarketTarget', $this->text());
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->alterColumn('{{%configs}}', 'excludeBets', $this->string());
        $this->alterColumn('{{%configs}}', 'excludeLeagues', $this->string());
        $this->alterColumn('{{%configs}}', 'excludeSportMarketTarget', $this->string());

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230111_223733_fields_to_text_in_configs cannot be reverted.\n";

        return false;
    }
    */
}
