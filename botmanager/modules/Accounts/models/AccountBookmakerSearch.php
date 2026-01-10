<?php

namespace app\modules\Accounts\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\Accounts\models\AccountBookmaker;

/**
 * AccountBookmakerSearch represents the model behind the search form of `app\modules\Accounts\models\AccountBookmaker`.
 */
class AccountBookmakerSearch extends AccountBookmaker
{
    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'account_id', 'bookmaker_id'], 'integer'],
            [['bm_login', 'bm_password', 'comment'], 'safe'],
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
        $query = AccountBookmaker::find();

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
            'account_id' => $this->account_id,
            'bookmaker_id' => $this->bookmaker_id,
        ]);

        $query->andFilterWhere(['like', 'bm_login', $this->bm_login])
            ->andFilterWhere(['like', 'bm_password', $this->bm_password])
            ->andFilterWhere(['like', 'comment', $this->comment]);

        return $dataProvider;
    }
}
