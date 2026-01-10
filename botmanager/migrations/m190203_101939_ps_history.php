<?php

use yii\db\Migration;

/**
 * Class m190203_101939_ps_history
 */
class m190203_101939_ps_history extends Migration
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

        $this->createTable('{{%ps_history}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'datetime' => $this->integer()->notNull(),
            'datetime_string' => $this->string()->notNull(),
            'ps_paysystems_id' => $this->integer()->notNull(),
            'type' => $this->integer()->notNull()->defaultValue(0),
            'amount' => $this->decimal(20, 8),
            'currency' => $this->integer()->notNull()->defaultValue(0),
            'sender' => $this->string()->notNull()->defaultValue(''),
            'receiver' => $this->string()->notNull()->defaultValue(''),
            'description' => $this->text(),
            'tech' => $this->text(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->addForeignKey('ps_history_paysystem_fk', '{{%ps_history}}', 'ps_paysystems_id',
            '{{%ps_paysystems}}', 'id');

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {

        $this->dropForeignKey('ps_history_paysystem_fk', '{{%ps_history}}');

        $this->dropTable('{{%ps_history}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m190203_101939_ps_history cannot be reverted.\n";

        return false;
    }
    */
}
