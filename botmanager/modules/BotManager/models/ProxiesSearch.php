<?php

namespace app\modules\BotManager\models;

use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\Proxies;

/**
 * ProxiesSearch represents the model behind the search form of `app\modules\BotManager\models\Proxies`.
 */
class ProxiesSearch extends Proxies
{

    public $stakeAccount;
    public $betexy_id;

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'deleted', 'port', 'registered_at', 'finish_at', 'created_at', 'updated_at', 'betexy_id',], 'integer'],
            [['name', 'protocol', 'host', 'country', 'login', 'password', 'comment', 'stakeAccount', 'provider', ], 'safe'],
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
        $query = Proxies::find()->joinWith('stakeAccount');

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
            'proxies.deleted' => $this->deleted,
            'port' => $this->port,
            'registered_at' => $this->registered_at,
            'finish_at' => $this->finish_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'provider' => $this->provider,
        ]);

        $query->andFilterWhere(['like', 'name', $this->name])
            ->andFilterWhere(['like', 'proxies.betexy_id', $this->betexy_id])
            ->andFilterWhere(['like', 'protocol', $this->protocol])
            ->andFilterWhere(['like', 'host', $this->host])
            ->andFilterWhere(['like', 'country', $this->country])
            ->andFilterWhere(['like', 'login', $this->login])
            ->andFilterWhere(['like', 'password', $this->password])
            ->andFilterWhere(['like', 'comment', $this->comment])
            ->andFilterWhere(['like', 'stake_accounts.name', $this->stakeAccount]);

        return $dataProvider;
    }
}
