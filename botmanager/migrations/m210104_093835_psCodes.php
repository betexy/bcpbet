<?php

use yii\db\Migration;

/**
 * Class m210104_093835_psCodes
 */
class m210104_093835_psCodes extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {

        $tableOptions = $this->db->driverName === 'mysql'
            ? 'CHARACTER SET utf8 COLLATE utf8_general_ci ENGINE=InnoDB' : null;

        $this->createTable('{{%ps_codes}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'account_id' => $this->string(255)->notNull(),
            'code' => $this->string(255)->notNull(),
        ], $tableOptions);

        $this->createIndex('ps_codes_account_id_idx', '{{%ps_codes}}', ['account_id',]);

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropIndex('ps_codes_account_id_idx', '{{%ps_codes}}');

        $this->dropTable('{{%ps_codes}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m210104_093835_psCodes cannot be reverted.\n";

        return false;
    }
    */
}
