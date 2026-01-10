<?php

use yii\db\Migration;

/**
 * Class m200926_045020_mailboxesFields
 */
class m200926_045020_mailboxesFields extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%e_mailboxes}}', 'folders', $this->text()->after('secret'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%e_mailboxes}}', 'folders');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m200926_045020_mailboxesFields cannot be reverted.\n";

        return false;
    }
    */
}
