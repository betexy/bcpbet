<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\ServerIp;

/**
 * ServerIpSearch represents the model behind the search form of `app\modules\BotManager\models\ServerIp`.
 */
class ServerIpSearch extends ServerIp
{
    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'created_at', 'updated_at', 'bm_server_id'], 'integer'],
            [['ip'], 'safe'],
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
        $query = ServerIp::find();

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

        if (!empty($this->bm_server_id)) {
            $query->andFilterWhere((int)$this->bm_server_id === -1
                ? ['is', 'bm_server_id', new \yii\db\Expression('null')]
                : ['bm_server_id' => $this->bm_server_id]);
        }

        $query->andFilterWhere(['like', 'ip', $this->ip]);

        return $dataProvider;
    }
}
