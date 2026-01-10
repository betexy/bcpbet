<?php

use yii\db\Migration;

/**
 * Class m180922_153912_bm_bots
 */
class m180922_153912_bm_bots extends Migration
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


        $this->createTable('{{%bm_file_groups}}', [
            'id' => $this->primaryKey(),
            'type' => $this->integer()->notNull(),
            'bk_internal' => $this->string(255),
            'name' => $this->string(255)->notNull(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%bm_files}}', [
            'id' => $this->primaryKey(),
            'name' => $this->string(255)->notNull(),
            'source_name' => $this->string(255)->notNull(),
            'source_path' => $this->string(255)->notNull(),
            'file_name' => $this->string(255)->notNull(),
            'file_path' => $this->string(255)->notNull(),
            'tag' => $this->string(255),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%bm_files_file_groups}}', [
            'id' => $this->primaryKey(),
            'file_groups_id' => $this->integer()->notNull(),
            'files_id' => $this->integer()->notNull(),
        ], $tableOptions);

        $this->createTable('{{%bm_bots}}', [
            'id' => $this->primaryKey(),
            'virtual_machine_uid' => $this->string(255)->notNull(),
            'virtual_machine_name' => $this->string(255)->defaultValue('not set')->notNull(),
            'websocket_url' => $this->string(255)->defaultValue('not set')->notNull(),
            'websocket_uid' => $this->string(255)->defaultValue('not set')->notNull(),
            'test_mode_on' => $this->boolean()->notNull()->defaultValue(false),
            'test_url' => $this->string(255),
            'extension_id' => $this->integer(),
            'default_bk_id' => $this->integer(),
            'software_versions_id' => $this->integer(),
            'multilogin_profile_name' => $this->string(255),
            'last_request' => $this->integer(),
            'last_status' => $this->string(255),
            'run_into_the_chrome' => $this->boolean()->defaultValue(false),
            'multilogin_installed' => $this->boolean()->defaultValue(false),
            'chrome_installed' => $this->boolean()->defaultValue(false),
            'extension_installed' => $this->boolean()->defaultValue(false),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%bm_bots_queue}}', [
            'id' => $this->primaryKey(),
            'bots_id' => $this->integer()->notNull(),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'status' => $this->integer()->notNull(),
            'action' => $this->string(255),
            'data' => $this->text(),
            'response' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%bm_bots_log}}', [
            'id' => $this->bigPrimaryKey(),
            'bots_id' => $this->integer()->notNull(),
            'bk_internal' => $this->string(255)->notNull(),
            'created_at' => $this->integer()->notNull(),
            'message_string' => $this->text(),
            'message_json' => $this->json(),
        ], $tableOptions);

        $this->createTable('{{%bm_bots_bks}}', [
            'id' => $this->primaryKey(),
            'bots_id' => $this->integer()->notNull(),
            'bk_id' => $this->integer()->notNull(),
            'login' => $this->string(255)->notNull(),
            'password' => $this->string(255)->notNull(),
            'url' => $this->string(255),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%bm_software_versions}}', [
            'id' => $this->primaryKey(),
            'name' => $this->string(255)->notNull(),
            'code' => $this->string(255)->notNull(),
            'file_groups_id' => $this->integer()->notNull(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->createTable('{{%bm_bk_settings}}', [
            'id' => $this->primaryKey(),
            'file_groups_id' => $this->integer()->notNull(),
            'bk_internal' => $this->string(255)->notNull(),
            'url_one' => $this->string(255),
            'url_two' => $this->string(255),
            'url_three' => $this->string(255),
            'settings' => $this->json(),
            'comment' => $this->text(),
        ], $tableOptions);


        // Bots and their friend:

        $this->createIndex('bm_bots_vm_uid_idx', '{{%bm_bots}}', 'virtual_machine_uid');

        $this->addForeignKey('bm_bots_queue_bots_fk', '{{%bm_bots_queue}}', 'bots_id',
            '{{%bm_bots}}', 'id');

        $this->addForeignKey('bm_bots_log_bots_fk', '{{%bm_bots_log}}', 'bots_id',
            '{{%bm_bots}}', 'id');

        $this->addForeignKey('bm_bots_extension_fk', '{{%bm_bots}}', 'extension_id',
            '{{%bm_file_groups}}', 'id');

        // BKs

        $this->addForeignKey('bm_bots_bks_bits_fk', '{{%bm_bots_bks}}', 'bots_id',
            '{{%bm_bots}}', 'id');

        $this->addForeignKey('bm_bots_bks_bk_fk', '{{%bm_bots_bks}}', 'bk_id',
            '{{%bm_file_groups}}', 'id');

        $this->addForeignKey('bm_bk_settings_file_groups_fk', '{{%bm_bk_settings}}', 'file_groups_id',
            '{{%bm_file_groups}}', 'id');

        // Files

        $this->addForeignKey('bm_ffg_file_groups_fk', '{{%bm_files_file_groups}}', 'file_groups_id',
            '{{%bm_file_groups}}', 'id');

        $this->addForeignKey('bm_ffg_files_fk', '{{%bm_files_file_groups}}', 'files_id',
            '{{%bm_files}}', 'id');

        $this->addForeignKey('bm_software_versions_file_groups_fk', '{{%bm_software_versions}}', 'file_groups_id',
            '{{%bm_file_groups}}', 'id');

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {

        $this->dropForeignKey('bm_bots_log_bots_fk', '{{%bm_bots_log}}');
        $this->dropForeignKey('bm_bk_settings_file_groups_fk', '{{%bm_bk_settings}}');
        $this->dropForeignKey('bm_software_versions_file_groups_fk', '{{%bm_software_versions}}');
        $this->dropForeignKey('bm_ffg_file_groups_fk', '{{%bm_files_file_groups}}');
        $this->dropForeignKey('bm_ffg_files_fk', '{{%bm_files_file_groups}}');
        $this->dropForeignKey('bm_bots_bks_bk_fk', '{{%bm_bots_bks}}');
        $this->dropForeignKey('bm_bots_extension_fk', '{{%bm_bots}}');
        $this->dropForeignKey('bm_bots_bks_bits_fk', '{{%bm_bots_bks}}');
        $this->dropForeignKey('bm_bots_queue_bots_fk', '{{%bm_bots_queue}}');

        $this->dropIndex('bm_bots_vm_uid_idx', '{{%bm_bots}}');

        $this->dropTable('{{%bm_bots_log}}');
        $this->dropTable('{{%bm_bk_settings}}');
        $this->dropTable('{{%bm_bots_bks}}');
        $this->dropTable('{{%bm_bots}}');
        $this->dropTable('{{%bm_files}}');
        $this->dropTable('{{%bm_file_groups}}');
        $this->dropTable('{{%bm_files_file_groups}}');
        $this->dropTable('{{%bm_bots_queue}}');
        $this->dropTable('{{%bm_software_versions}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m180922_153912_bm_bots cannot be reverted.\n";

        return false;
    }
    */
}
