<?php

use yii\db\Migration;

/**
 * Class m190104_161811_otrs_specified
 */
class m190104_161811_otrs_specified extends Migration
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

        $this->createTable('{{%bookmaker}}', [
            'id' => $this->primaryKey(),
            'name' => $this->string()->notNull(),
        ], $tableOptions);

        $this->createTable('{{%account}}', [
            'id' => $this->primaryKey(),
            'first_name' => $this->string()->notNull(),
            'second_name' => $this->string()->notNull(),
            'third_name' => $this->string(),
            'birth_date' => $this->string()->notNull(),
            'email' => $this->string()->notNull(),
            'email_password' => $this->string()->notNull(),
            'phone' => $this->string()->notNull(),
            'comment' => $this->text(),
            'created_at' => $this->integer()->notNull(),
            'has_passport' => $this->boolean()->notNull()->defaultValue(0),
            'has_registration' => $this->boolean()->notNull()->defaultValue(0),
            'has_selfie' => $this->boolean()->notNull()->defaultValue(0),
            'has_driver_license' => $this->boolean()->notNull()->defaultValue(0),
            'has_address_verification' => $this->boolean()->notNull()->defaultValue(0),
            'has_skrill_verification' => $this->boolean()->notNull()->defaultValue(0),
            'has_qiwi_verification' => $this->boolean()->notNull()->defaultValue(0),
            'city' => $this->string(),
            'postal_code' => $this->string(),
            'address' => $this->string(),
            'skrill_login' => $this->string(),
            'skrill_password' => $this->string(),
            'qiwi_login' => $this->string(),
            'qiwi_password' => $this->string(),
            'first_name_en' => $this->string(),
            'second_name_en' => $this->string(),
            'city_en' => $this->string(),
            'address_en' => $this->string(),
        ], $tableOptions);

        $this->createTable('{{%account_bookmaker}}', [
            'id' => $this->primaryKey(),
            'account_id' => $this->integer()->notNull(),
            'bookmaker_id' => $this->integer()->notNull(),
            'bm_login' => $this->string()->notNull(),
            'bm_password' => $this->string()->notNull(),
            'comment' => $this->text(),
        ], $tableOptions);

        $this->addForeignKey('account_bookmaker_fk_account', '{{%account_bookmaker}}', 'account_id',
            '{{%account}}', 'id');
        $this->addForeignKey('account_bookmaker_fk_bookmaker', '{{%account_bookmaker}}', 'bookmaker_id',
            '{{%bookmaker}}', 'id');

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {

        $this->dropForeignKey('account_bookmaker_fk_account', '{{%account_bookmaker}}');
        $this->dropForeignKey('account_bookmaker_fk_bookmaker', '{{%account_bookmaker}}');

        $this->dropTable('{{%account_bookmaker}}');
        $this->dropTable('{{%account}}');
        $this->dropTable('{{%bookmaker}}');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m190104_161811_otrs_specified cannot be reverted.\n";

        return false;
    }
    */
}
