<?php

use yii\db\Migration;

/**
 * Class m231103_034543_newExpressesToConfigs
 */
class m231103_034543_newExpressesToConfigs extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%configs}}', 'new_expresses', $this->boolean()
            ->notNull()->defaultValue(false));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%configs}}', 'new_expresses');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m231103_034543_newExpressesToConfigs cannot be reverted.\n";

        return false;
    }
    */
}
