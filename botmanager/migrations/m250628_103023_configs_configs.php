<?php

use yii\db\Migration;

/**
 * Class m250628_103023_configs_configs
 */
class m250628_103023_configs_configs extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $tableOptions = null;
        if ($this->db->driverName === 'mysql') {
            $tableOptions = 'CHARACTER SET utf8 COLLATE utf8_general_ci ENGINE=InnoDB';
        }

        $this->createTable('{{%configs_configs}}', [
            'id' => $this->primaryKey(),
            'parent_id' => $this->integer()->notNull(),
            'child_id' => $this->integer()->notNull(),
        ], $tableOptions);

        $this->addForeignKey('configs_configs_parent', '{{%configs_configs}}', 'parent_id',
            '{{%configs}}', 'id');
        $this->addForeignKey('configs_configs_child', '{{%configs_configs}}', 'child_id',
            '{{%configs}}', 'id' );
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropForeignKey('configs_configs_parent', '{{%configs_configs}}');
        $this->dropForeignKey('configs_configs_child', '{{%configs_configs}}');
        $this->dropTable('{{%configs_configs}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m250628_103023_configs_configs cannot be reverted.\n";

        return false;
    }
    */
}
