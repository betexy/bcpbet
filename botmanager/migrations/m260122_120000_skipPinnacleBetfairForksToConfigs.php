<?php

use yii\db\Migration;

class m260122_120000_skipPinnacleBetfairForksToConfigs extends Migration
{
    public function safeUp()
    {
        $this->addColumn('{{%configs}}', 'skipPinnacleBetfairForks', $this->boolean()
            ->notNull()->defaultValue(false));
    }

    public function safeDown()
    {
        $this->dropColumn('{{%configs}}', 'skipPinnacleBetfairForks');

        return true;
    }
}
