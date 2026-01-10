<?php

namespace app\models;

use yii\db\ActiveRecord;

/**
 * @property int    $id
 * @property string $name
 */
class Bookmaker extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName(): string
    {
        return 'bookmaker';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['name'], 'required'],
            [['name'], 'string', 'max' => 255],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels(): array
    {
        return [
            'id'   => 'ID',
            'name' => 'Name',
        ];
    }
}

/*
+---------------+
| name          |
+---------------+
| Fonbet        |
| Pinnacle      |
| Sbobet        |
| Sportmarket   |
| Betfair       |
| 188bet        |
| 18bet         |
| PaddyPower    |
| Marathon      |
| Winlinebet    |
| BFSportsbook  |
| Bet8gr        |
| Favbet        |
| Bet365        |
| Olimp         |
| PariMatch     |
| LigaStavok    |
| Leon          |
| 1xbet         |
| DafaSportssss |
| Tennisi       |
+---------------+
 */