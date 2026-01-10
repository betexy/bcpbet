<?php

namespace app\modules\BotManager\models;

use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\MarginReport;

/**
 * MarginReportSearch represents the model behind the search form of `app\modules\BotManager\models\MarginReport`.
 */
class MarginReportSearch extends MarginReport
{

    const DAY_SECONDS = 24 * 60 * 60;

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'created_at', 'updated_at'], 'integer'],
            [['raw', 'remote_ip', 'room_uid', 'status', 'comment'], 'safe'],
            [['coef', 'requested_coef', 'margin'], 'number'],
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
        $query = MarginReport::find();

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
            'coef' => $this->coef,
            'requested_coef' => $this->requested_coef,
            'margin' => $this->margin,
        ]);

        $query->andFilterWhere(['like', 'raw', $this->raw])
            ->andFilterWhere(['like', 'remote_ip', $this->remote_ip])
            ->andFilterWhere(['=', 'room_uid', $this->room_uid])
            ->andFilterWhere(['like', 'status', $this->status])
            ->andFilterWhere(['like', 'comment', $this->comment]);

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
