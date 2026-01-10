<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\Server;

/**
 * ServerSearch represents the model behind the search form of `app\modules\BotManager\models\Server`.
 */
class ServerSearch extends RdpActivity
{

    public $name;
    public $table_deleted;
    public $table_last_yc_reboot;

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'created_at', 'updated_at', 'logins_failed', 'table_deleted',
                'deleted',], 'integer'],
            [['name', 'ip', 'comment'], 'safe'],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function scenarios()
    {
        // bypass scenarios() implementation in the parent class
        return Model::scenarios();
    }

    /**
     * Creates data provider instance with search query applied
     *
     * @param array $params
     *
     * @return ActiveDataProvider
     */
    public function search(array $params)
    {
        $query = RdpActivity::find();
        $query->joinWith(['table',]);
        // add conditions that should always apply here

        $dataProvider = new ActiveDataProvider([
            'query' => $query,
        ]);

        $dataProvider->sort->attributes['name'] = [
            // The tables are the ones our relation are configured to
            // in my case they are prefixed with "tbl_"
            'asc' => ['rdp_table.name' => SORT_ASC],
            'desc' => ['rdp_table.name' => SORT_DESC],
        ];

        $dataProvider->sort->attributes['table_deleted'] = [
            // The tables are the ones our relation are configured to
            // in my case they are prefixed with "tbl_"
            'asc' => ['rdp_table.deleted' => SORT_ASC],
            'desc' => ['rdp_table.deleted' => SORT_DESC],
        ];

        $dataProvider->sort->attributes['table_last_yc_reboot'] = [
            // The tables are the ones our relation are configured to
            // in my case they are prefixed with "tbl_"
            'asc' => ['rdp_table.last_yc_reboot' => SORT_ASC],
            'desc' => ['rdp_table.last_yc_reboot' => SORT_DESC],
        ];

        $this->load($params);

        if (!$this->validate()) {
            // uncomment the following line if you do not want to return any records when validation fails
            // $query->where('0=1');
            return $dataProvider;
        }

        // grid filtering conditions
        $query->andFilterWhere([
            'id' => $this->id,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ]);

        $query->andFilterWhere(['like', 'rdp_table.ip', $this->ip])
            ->andFilterWhere(['like', 'comment', $this->comment])
            ->andFilterWhere(['=', 'logins_failed', $this->logins_failed])
            ->andFilterWhere(['like', 'rdp_table.name', $this->name])
            ->andFilterWhere(['=', 'rdp_activity.deleted', $this->deleted]);

        if ($this->table_deleted !== '') {
            $query->andFilterWhere(
                ['or',
                    ['is', 'rdp_table.deleted', new \yii\db\Expression('null')],
                    ['=', 'rdp_table.deleted', $this->table_deleted]
                ]
            );
        }

        return $dataProvider;
    }
}
