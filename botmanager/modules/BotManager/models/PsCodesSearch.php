<?php

namespace app\modules\BotManager\models;

use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\PsCodes;

/**
 * PsCodesSearch represents the model behind the search form of `app\modules\BotManager\models\PsCodes`.
 */
class PsCodesSearch extends PsCodes
{
    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            //[['id', 'created_at', 'updated_at'], 'integer'],
            [['account_id', 'code'], 'safe'],
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
        $query = PsCodes::find();

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
        ]);

        $query->andFilterWhere(['like', 'account_id', $this->account_id])
            ->andFilterWhere(['like', 'code', $this->code]);

        return $dataProvider;
    }
}
