<?php

use yii\db\Migration;

/**
 * Class m230526_153654_folderToEmail
 */
class m230526_153654_folderToEmail extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%e_emails}}', 'folder', $this->string()
            ->notNull()->defaultValue('INBOX')->after('e_mailboxes_id'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%e_emails}}', 'folder');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230526_153654_folderToEmail cannot be reverted.\n";

        return false;
    }
    */
}
