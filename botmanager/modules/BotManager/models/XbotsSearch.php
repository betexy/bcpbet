<?php

namespace app\modules\BotManager\models;

use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\Xbots;

/**
 * XbotsSearch represents the model behind the search form of `app\modules\BotManager\models\Xbots`.
 */
class XbotsSearch extends Xbots
{
    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'betexy_bot_id', 'betexy_user_id', 'due_date', 'active', 'created_at', 'updated_at'], 'integer'],
            [['name', 'bookie'], 'safe'],
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
        $query = Xbots::find();

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
            'bookie' => $this->bookie,
            'betexy_bot_id' => $this->betexy_bot_id,
            'betexy_user_id' => $this->betexy_user_id,
            'due_date' => $this->due_date,
            'active' => $this->active,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ]);

        $query->andFilterWhere(['like', 'name', $this->name]);

        return $dataProvider;
    }
}
