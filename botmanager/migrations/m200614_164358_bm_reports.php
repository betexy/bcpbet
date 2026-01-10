<?php

use yii\db\Migration;

/**
 * Class m200614_164358_bm_reports
 */
class m200614_164358_bm_reports extends Migration
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

        $this->createTable('{{%bm_report}}', [
            'id' => $this->primaryKey(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'parsed' => $this->boolean()->notNull()->defaultValue(0),
            'parse_error' => $this->boolean()->notNull()->defaultValue(0),
            'raw' => $this->text(),
            'remote_ip' => $this->string(20),
            // Bet / Wallet / Bot, maybe something else
            'category' => $this->string(50),
            // Parsed data
            'action' => $this->string(50),
            'result' => $this->string(50),
            'message' => $this->string(50),
            'room_bk' => $this->string(50),
            'room_uid' => $this->string(50),
            'room_state' => $this->string(50),
            'room_balance' => $this->string(50),
            'data_status' => $this->string(50),
            'data' => $this->text(),
            'comment' => $this->text(),
        ], $tableOptions);
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropTable('{{%bm_report}}');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m200614_164358_bm_reports cannot be reverted.\n";

        return false;
    }
    */
}
