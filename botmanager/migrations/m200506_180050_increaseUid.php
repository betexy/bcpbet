<?php

use yii\db\Migration;

/**
 * Class m200506_180050_increaseUid
 */
class m200506_180050_increaseUid extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->alterColumn('{{%sims_requests}}', 'websocket_uid', 'string(40) not null');
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->alterColumn('{{%sims_requests}}', 'websocket_uid', 'string(30) not null');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m200506_180050_increaseUid cannot be reverted.\n";

        return false;
    }
    */
}
