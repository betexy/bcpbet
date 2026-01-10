<?php

use yii\db\Migration;

/**
 * Class m230417_090852_doNotUse_mailboxes
 */
class m230417_090852_doNotUse_mailboxes extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%e_mailboxes}}', 'do_not_use', $this->boolean()
            ->notNull()->defaultValue(false)->after('type'));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%e_mailboxes}}', 'do_not_use');
        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230417_090852_doNotUse_mailboxes cannot be reverted.\n";

        return false;
    }
    */
}
