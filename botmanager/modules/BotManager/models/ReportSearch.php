<?php

namespace app\modules\BotManager\models;

use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\Report;

/**
 * ReportSearch represents the model behind the search form of `app\modules\BotManager\models\Report`.
 */
class ReportSearch extends Report
{

    const DAY_SECONDS = 24 * 60 * 60;

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'updated_at', 'parsed', 'parse_error'], 'integer'],
            [['raw', 'created_at', 'remote_ip', 'category', 'action', 'result', 'message', 'room_bk', 'room_uid', 'room_state', 'room_balance', 'data_status', 'data', 'comment'], 'safe'],
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
        $query = Report::find();

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
            'updated_at' => $this->updated_at,
            'parsed' => $this->parsed,
            'parse_error' => $this->parse_error,
        ]);

        $query->andFilterWhere(['like', 'raw', $this->raw])
            ->andFilterWhere(['=', 'remote_ip', $this->remote_ip])
            ->andFilterWhere(['=', 'category', $this->category])
            ->andFilterWhere(['=', 'action', $this->action])
            ->andFilterWhere(['like', 'result', $this->result])
            ->andFilterWhere(['like', 'message', $this->message])
            ->andFilterWhere(['=', 'room_bk', $this->room_bk])
            ->andFilterWhere(['like', 'room_uid', $this->room_uid])
            ->andFilterWhere(['like', 'room_state', $this->room_state])
            ->andFilterWhere(['like', 'room_balance', $this->room_balance])
            ->andFilterWhere(['like', 'data_status', $this->data_status])
            ->andFilterWhere(['like', 'data', $this->data])
            ->andFilterWhere(['like', 'comment', $this->comment]);

        // $query->andFilterWhere(['between', 'created_at', $start, $start + self::DAY_SECONDS]);
        if ($this->created_at) {
            if ($this->created_at === 'last24h') {
                $query->andFilterWhere(['>=', 'created_at', time() - self::DAY_SECONDS]);
            } elseif ($this->created_at === 'last_week') {
                $query->andFilterWhere(['>=', 'created_at', time() - self::DAY_SECONDS * 7]);
            } elseif ($this->created_at === 'today') {
                $query->andFilterWhere(['>=', 'created_at', strtotime(date('Y-m-d 00:00:00'))]);
            }
        }

        return $dataProvider;
    }
}
