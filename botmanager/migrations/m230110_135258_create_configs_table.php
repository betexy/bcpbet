<?php

use yii\db\Migration;

/**
 * Handles the creation of table `{{%configs}}`.
 */
class m230110_135258_create_configs_table extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {
        $tableOptions = $this->db->driverName === 'mysql'
            ? 'CHARACTER SET utf8 COLLATE utf8_general_ci ENGINE=InnoDB' : null;

        $this->createTable('{{%configs}}', [
            'id' => $this->primaryKey(),
            'name' => $this->string()->notNull()->defaultValue(''),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
            'bookie' => $this->string()->notNull(),
            'source' => $this->string(),
            'url' => $this->string()->notNull(),
            'eventTimeLimit' => $this->integer(),
            'eventMaxBets' => $this->integer(),
            'stake' => $this->float(),
            'coefFrom' => $this->float(),
            'coefTo' => $this->float(),
            'incomeFrom' => $this->float(),
            'incomeTo' => $this->float(),
            'lastScoreTennis' => $this->string(),
            'excludeSports' => $this->string(),
            'excludeMarkets' => $this->string(),
            'excludeTargets' => $this->string(),
            'excludePivots' => $this->string(),
            'excludeBets' => $this->string(),
            'excludeLeagues' => $this->string(),
            'excludeSportMarketTarget' => $this->string(),
        ], $tableOptions);

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        $this->dropTable('{{%configs}}');
    }
}
