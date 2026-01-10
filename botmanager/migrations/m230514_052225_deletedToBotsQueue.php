<?php

use yii\db\Migration;

/**
 * Class m230514_052225_deletedToBotsQueue
 */
class m230514_052225_deletedToBotsQueue extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%bm_bots_queue}}', 'deleted', $this->boolean()
            ->notNull()->defaultValue(false)->after('id'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%bm_bots_queue}}', 'deleted');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230514_052225_deletedToBotsQueue cannot be reverted.\n";

        return false;
    }
    */
}
