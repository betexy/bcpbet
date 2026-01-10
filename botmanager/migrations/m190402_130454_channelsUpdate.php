<?php

use yii\db\Migration;

/**
 * Class m190402_130454_channelsUpdate
 */
class m190402_130454_channelsUpdate extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%sims_channels}}', 'only_manual', $this->boolean()->notNull()->defaultValue(false));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%sims_channels}}', 'only_manual');

        return true;
    }

    /*
    // Use up()/down() to run migration code without a transaction.
    public function up()
    {

    }

    public function down()
    {
        echo "m190402_130454_channelsUpdate cannot be reverted.\n";

        return false;
    }
    */
}
