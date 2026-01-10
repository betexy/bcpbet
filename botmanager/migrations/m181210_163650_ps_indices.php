<?php

use yii\db\Migration;

/**
 * Class m181210_163650_ps_indices
 */
class m181210_163650_ps_indices extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->createIndex('bm_bots_websocket_uid_idx', '{{%bm_bots}}', ['websocket_uid']);
        $this->addColumn('{{%ps_paysystems_queue}}', 'plan_send_at', $this->integer()->defaultValue(0));
        $this->addColumn('{{%ps_paysystems}}', 'ps_paysystems_id_master', $this->integer()->defaultValue(0));
        $this->addColumn('{{%ps_paysystems}}', 'when_amount', $this->decimal(12, 2)->defaultValue(0));
        $this->addColumn('{{%ps_paysystems}}', 'send_amount', $this->decimal(12, 2)->defaultValue(0));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropIndex('bm_bots_websocket_uid_idx', '{{%bm_bots}}');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m181210_163650_ps_indices cannot be reverted.\n";

        return false;
    }
    */
}
