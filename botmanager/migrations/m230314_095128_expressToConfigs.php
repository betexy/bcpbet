<?php

use yii\db\Migration;

/**
 * Class m230314_095128_expressToConfigs
 */
class m230314_095128_expressToConfigs extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%configs}}', 'express', $this->boolean()
            ->notNull()->defaultValue(false));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%configs}}', 'express');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m230314_095128_expressToConfigs cannot be reverted.\n";

        return false;
    }
    */
}
