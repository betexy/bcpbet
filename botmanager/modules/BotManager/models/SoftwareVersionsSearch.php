<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\SoftwareVersions;

/**
 * SoftwareVersionsSearch represents the model behind the search form of `app\modules\BotManager\models\SoftwareVersions`.
 */
class SoftwareVersionsSearch extends SoftwareVersions
{
    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'file_groups_id'], 'integer'],
            [['name', 'code', 'comment'], 'safe'],
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
        $query = SoftwareVersions::find();

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
            'name' => $this->name,
            'code' => $this->code,
            'file_groups_id' => $this->file_groups_id,
        ]);

        $query->andFilterWhere(['like', 'comment', $this->comment]);

        return $dataProvider;
    }
}
