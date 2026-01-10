<?php

use yii\db\Migration;

/**
 * Class m230122_051008_lastScoreBasketball_to_configs
 */
class m230122_051008_lastScoreBasketball_to_configs extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%configs}}', 'lastScoreBasketball', $this->string()
            ->null()->after('lastScoreTennis'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%configs}}', 'lastScoreBasketball');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230122_051008_lastScoreBasketball_to_configs cannot be reverted.\n";

        return false;
    }
    */
}
