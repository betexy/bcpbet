<?php

namespace app\modules\BotManager\models;

use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\Configs;

/**
 * ConfigsSearch represents the model behind the search form of `app\modules\BotManager\models\Configs`.
 */
class ConfigsSearch extends Configs
{
    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'created_at', 'updated_at', 'eventTimeLimit', 'eventMaxBets', 'express', 'is_fork'], 'integer'],
            [['name', 'bookie', 'second_bookie', 'source', 'currency', 'url', 'lastScoreTennis', 'lastScoreBasketball',
                'excludeSports', 'excludeMarkets', 'excludeTargets', 'excludePivots', 'excludeBets',
                'excludeLeagues', 'excludeSportMarketTarget'], 'safe'],
            [['stake', 'coefFrom', 'coefTo', 'incomeFrom', 'incomeTo'], 'number'],
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
        $query = Configs::find();

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
            'eventTimeLimit' => $this->eventTimeLimit,
            'eventMaxBets' => $this->eventMaxBets,
            'stake' => $this->stake,
            'coefFrom' => $this->coefFrom,
            'coefTo' => $this->coefTo,
            'incomeFrom' => $this->incomeFrom,
            'incomeTo' => $this->incomeTo,
            'express' => $this->express,
            'is_fork' => $this->is_fork,
        ]);

        $query->andFilterWhere(['like', 'bookie', $this->bookie])
            ->andFilterWhere(['like', 'second_bookie', $this->second_bookie])
            ->andFilterWhere(['like', 'source', $this->source])
            ->andFilterWhere(['like', 'currency', $this->currency])
            ->andFilterWhere(['like', 'url', $this->url])
            ->andFilterWhere(['like', 'lastScoreTennis', $this->lastScoreTennis])
            ->andFilterWhere(['like', 'lastScoreBasketball', $this->lastScoreBasketball])
            ->andFilterWhere(['like', 'excludeSports', $this->excludeSports])
            ->andFilterWhere(['like', 'excludeMarkets', $this->excludeMarkets])
            ->andFilterWhere(['like', 'excludeTargets', $this->excludeTargets])
            ->andFilterWhere(['like', 'excludePivots', $this->excludePivots])
            ->andFilterWhere(['like', 'excludeBets', $this->excludeBets])
            ->andFilterWhere(['like', 'excludeLeagues', $this->excludeLeagues])
            ->andFilterWhere(['like', 'excludeSportMarketTarget', $this->excludeSportMarketTarget]);

        return $dataProvider;
    }
}
