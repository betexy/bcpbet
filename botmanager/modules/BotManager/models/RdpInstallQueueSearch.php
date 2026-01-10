<?php

namespace app\modules\BotManager\models;

use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\RdpInstallQueue;

/**
 * RdpInstallQueueSearch represents the model behind the search form of `app\modules\BotManager\models\RdpInstallQueue`.
 */
class RdpInstallQueueSearch extends RdpInstallQueue
{
    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['command', 'response', 'comment'], 'safe'],
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
        $query = RdpInstallQueue::find();

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
            'sent_at' => $this->sent_at,
            'finished_at' => $this->finished_at,
        ]);

        $query->andFilterWhere(['like', 'command', $this->command])
            ->andFilterWhere(['like', 'response', $this->response])
            ->andFilterWhere(['like', 'comment', $this->comment]);

        return $dataProvider;
    }
}
