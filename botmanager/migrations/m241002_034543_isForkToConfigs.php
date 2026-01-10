<?php

use yii\db\Migration;

/**
 * Class m241002_034543_isForkToConfigs
 */
class m241002_034543_isForkToConfigs extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%configs}}', 'is_fork', $this->boolean()
            ->notNull()->defaultValue(false));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%configs}}', 'is_fork');

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
