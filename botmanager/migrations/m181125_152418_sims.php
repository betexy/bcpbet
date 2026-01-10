<?php

use yii\db\Migration;

/**
 * Class m181125_152418_sims
 */
class m181125_152418_sims extends Migration
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

        $this->createTable('{{%sims_sims}}', [
            'id' => $this->primaryKey(),
            'number' => $this->string(20)->notNull(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%sims_slots}}', [
            'id' => $this->primaryKey(),
            'slot_id' => $this->integer()->notNull(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%sims_channels}}', [
            'id' => $this->primaryKey(),
            'channel_id' => $this->integer()->notNull(),
            'goip_sms_id' => $this->integer(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%sims_sims_slots}}', [
            'id' => $this->primaryKey(),
            'deleted' => $this->boolean()->notNull()->defaultValue(0),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'sims_sims_id' => $this->integer()->notNull(),
            'sims_slots_id' => $this->integer()->notNull(),
        ], $tableOptions);

        $this->createTable('{{%sims_slots_channels}}', [
            'id' => $this->primaryKey(),
            'deleted' => $this->boolean()->notNull()->defaultValue(0),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'sims_slots_id' => $this->integer()->notNull(),
            'sims_channels_id' => $this->integer()->notNull(),
        ], $tableOptions);

        $this->createIndex('sims_sims_number', '{{%sims_sims}}', 'number');

        $this->addForeignKey('sims_sims_slots_sims', '{{%sims_sims_slots}}', 'sims_sims_id',
            '{{%sims_sims}}', 'id');

        $this->addForeignKey('sims_sims_slots_slots', '{{%sims_sims_slots}}', 'sims_slots_id',
            '{{%sims_slots}}', 'id');

        $this->addForeignKey('sims_slots_channels_slots', '{{%sims_slots_channels}}', 'sims_slots_id',
            '{{%sims_slots}}', 'id');

        $this->addForeignKey('sims_slots_channels_channels', '{{%sims_slots_channels}}', 'sims_channels_id',
            '{{%sims_channels}}', 'id');

        $this->createIndex('sims_sims_slots_deleted', '{{%sims_sims_slots}}', ['sims_sims_id', 'sims_slots_id', 'deleted']);

        $this->createIndex('sims_slots_channels_deleted', '{{%sims_slots_channels}}', ['sims_slots_id', 'sims_channels_id', 'deleted']);

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {

        $this->dropForeignKey('sims_slots_channels_channels', '{{%sims_slots_channels}}');
        $this->dropForeignKey('sims_slots_channels_slots', '{{%sims_slots_channels}}');
        $this->dropForeignKey('sims_sims_slots_slots', '{{%sims_sims_slots}}');
        $this->dropForeignKey('sims_sims_slots_sims', '{{%sims_sims_slots}}');

        $this->dropIndex('sims_sims_number', '{{%sims_sims}}');
        $this->dropIndex('sims_slots_channels_deleted', '{{%sims_slots_channels}}');
        $this->dropIndex('sims_sims_slots_deleted', '{{%sims_sims_slots}}');

        $this->dropTable('{{%sims_slots_channels}}');
        $this->dropTable('{{%sims_sims_slots}}');
        $this->dropTable('{{%sims_channels}}');
        $this->dropTable('{{%sims_slots}}');
        $this->dropTable('{{%sims_sims}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m181125_152418_sims cannot be reverted.\n";

        return false;
    }
    */
}
