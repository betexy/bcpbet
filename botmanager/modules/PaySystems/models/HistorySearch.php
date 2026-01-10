<?php

namespace app\modules\PaySystems\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\PaySystems\models\History;

/**
 * HistorySearch represents the model behind the search form of `app\modules\PaySystems\models\History`.
 */
class HistorySearch extends History
{
    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'created_at', 'updated_at', 'datetime', 'ps_paysystems_id', 'type', 'currency'], 'integer'],
            [['datetime_string', 'sender', 'receiver', 'description', 'tech', 'comment'], 'safe'],
            [['amount'], 'number'],
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
    public function search($params)
    {
        $query = History::find();

        // add conditions that should always apply here

        $dataProvider = new ActiveDataProvider([
            'query' => $query,
        ]);

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
            'datetime' => $this->datetime,
            'ps_paysystems_id' => $this->ps_paysystems_id,
            'type' => $this->type,
            'amount' => $this->amount,
            'currency' => $this->currency,
        ]);

        $query->andFilterWhere(['like', 'datetime_string', $this->datetime_string])
            ->andFilterWhere(['like', 'sender', $this->sender])
            ->andFilterWhere(['like', 'receiver', $this->receiver])
            ->andFilterWhere(['like', 'description', $this->description])
            ->andFilterWhere(['like', 'tech', $this->tech])
            ->andFilterWhere(['like', 'comment', $this->comment]);

        return $dataProvider;
    }
}
