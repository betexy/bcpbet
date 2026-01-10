<?php

use yii\db\Migration;

/**
 * Class m181127_152346_sms
 */
class m181127_152346_sms extends Migration
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

        $this->createTable('{{%sims_smses}}', [
            'id' => $this->primaryKey(),
            'receive_id' => $this->integer()->notNull(),
            'number' => $this->string(20),
            'scrum' => $this->string(30),
            'provid' => $this->integer(),
            'msg' => $this->text(),
            'time_received' => $this->dateTime(),
            'goip_name' => $this->string(30),
            'sims_channels_id' => $this->integer(),
            'status' => $this->boolean(),
            'smscnum' => $this->string(30),
            'senttime' => $this->dateTime(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%sims_smses_sims}}', [
            'id' => $this->primaryKey(),
            'deleted' => $this->boolean()->notNull()->defaultValue(0),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'sims_smses_id' => $this->integer()->notNull(),
            'sims_sims_id' => $this->integer()->notNull(),
        ], $tableOptions);

        $this->addForeignKey('sims_smses_channels', '{{%sims_smses}}', 'sims_channels_id',
            '{{%sims_channels}}', 'id', 'NO ACTION');

        $this->addForeignKey('sims_smses_sims_smses', '{{%sims_smses_sims}}', 'sims_smses_id',
            '{{%sims_smses}}', 'id');

        $this->addForeignKey('sims_smses_sims_sims', '{{%sims_smses_sims}}', 'sims_sims_id',
            '{{%sims_sims}}', 'id');

        $this->createIndex('sims_smses_sims_smses_deleted_idx', '{{%sims_smses_sims}}', ['sims_smses_id', 'sims_sims_id', 'deleted']);

        $this->createIndex('sims_smses_number_time_idx', '{{%sims_smses}}', ['number', 'time_received']);

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropForeignKey('sims_smses_channels', '{{%sims_smses}}');
        $this->dropForeignKey('sims_smses_sims_smses', '{{%sims_smses_sims}}');
        $this->dropForeignKey('sims_smses_sims_sims', '{{%sims_smses_sims}}');

        $this->dropIndex('sims_smses_sims_smses_deleted_idx', '{{%sims_smses_sims}}');
        $this->dropIndex('sims_smses_number_time_idx', '{{%sims_smses}}');

        $this->dropTable('{{%sims_smses_sims}}');
        $this->dropTable('{{%sims_smses}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m181127_152346_sms cannot be reverted.\n";

        return false;
    }
    */
}
