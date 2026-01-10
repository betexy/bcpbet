<?php

use yii\db\Migration;

/**
 * Class m230305_161331_changesForBotsQueue
 */
class m230305_161331_changesForBotsQueue extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->dropForeignKey('bm_bots_queue_bots_fk', '{{%bm_bots_queue}}');
        $this->dropIndex('bm_bots_queue_bots_fk', '{{%bm_bots_queue}}');
        $this->addColumn('{{%bm_bots_queue}}', 'bot_class', $this->string()->notNull()
            ->after('bots_id')->defaultValue('Bots'));
        $this->createIndex('bm_bots_queue_bots_id_bot_class_idx', '{{%bm_bots_queue}}', ['bots_id', 'bot_class']);

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropIndex('bm_bots_queue_bots_id_bot_class_idx', '{{%bm_bots_queue}}');
        $this->dropColumn('{{%bm_bots_queue}}', 'bot_class');
        $this->addForeignKey('bm_bots_queue_bots_fk', '{{%bm_bots_queue}}', 'bots_id',
            '{{%bm_bots}}', 'id');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230305_161331_changesForBotsQueue cannot be reverted.\n";

        return false;
    }
    */
}
