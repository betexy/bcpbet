<?php

use yii\db\Migration;

/**
 * Class m240221_091111_bookieToXbots
 */
class m240221_091111_bookieToXbots extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $this->addColumn('{{%xbots}}', 'bookie',
            $this->string()->after('betexy_bot_id')->notNull()->defaultValue(''));
    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropColumn('{{%xbots}}', 'bookie');

        return true;
    }
}
