<?php

use yii\db\Migration;

/**
 * Class m190107_153034_botsModifications
 */
class m190107_153034_botsModifications extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%bm_bots_queue}}', 'run_after_success', $this->integer()->notNull()->defaultValue(0));
        $this->addColumn('{{%bm_bots_queue}}', 'run_after_fail', $this->integer()->notNull()->defaultValue(0));
        $this->addColumn('{{%bm_bots_queue}}', 'executor', $this->integer()->notNull()->defaultValue(0));
        $this->addColumn('{{%bm_files}}', 'created_at', $this->integer()->notNull()->defaultValue(0));
        $this->addColumn('{{%bm_files}}', 'updated_at', $this->integer()->notNull()->defaultValue(0));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%bm_bots_queue}}', 'run_after_success');
        $this->dropColumn('{{%bm_bots_queue}}', 'run_after_fail');
        $this->dropColumn('{{%bm_bots_queue}}', 'executor');
        $this->dropColumn('{{%bm_files}}', 'created_at');
        $this->dropColumn('{{%bm_files}}', 'updated_at');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m190107_153034_botsModifications cannot be reverted.\n";

        return false;
    }
    */
}
