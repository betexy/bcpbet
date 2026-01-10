<?php

use yii\db\Migration;

/**
 * Class m231108_145430_onlyLeagues_to_configs
 */
class m231108_145430_onlyLeagues_to_configs extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%configs}}', 'onlyLeagues', $this->text());
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%configs}}', 'onlyLeagues');

        return true;
    }
}
