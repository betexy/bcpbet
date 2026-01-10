<?php

use yii\db\Migration;

/**
 * Class m240816_110031_onlySecondBookieToConfigs
 */
class m240816_110031_onlySecondBookieToConfigs extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%configs}}', 'onlySecondBookie', $this->text());
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%configs}}', 'onlySecondBookie');

        return true;
    }
}
