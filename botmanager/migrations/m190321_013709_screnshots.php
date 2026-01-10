<?php

use yii\db\Migration;

/**
 * Class m190321_013709_screnshots
 */
class m190321_013709_screnshots extends Migration
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

        $this->createTable('{{%e_screenshots}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'name' => $this->string()->notNull(),
            'tag' => $this->string(),
            'description' => $this->text(),
            'comment' => $this->text(),
            'image' => $this->getDb()->getSchema()->createColumnSchemaBuilder('longtext'),
        ], $tableOptions);
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropTable('{{%e_screenshots}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m190321_013709_screnshots cannot be reverted.\n";

        return false;
    }
    */
}
