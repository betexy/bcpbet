<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\Files;

/**
 * FilesSearch represents the model behind the search form of `app\modules\BotManager\models\Files`.
 */
class FilesSearch extends Files
{
    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id'], 'integer'],
            [['name', 'source_name', 'source_path', 'file_name', 'file_path', 'tag', 'comment'], 'safe'],
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
     * @throws \ReflectionException
     */
    public function search($params)
    {
        // -= FILTERS SAVE =-
        $savedName = (new \ReflectionClass($this))->getShortName();
        if (!isset($params[$savedName])) {
            if (isset(Yii::$app->session[$savedName])) {
                $params[$savedName] = Yii::$app->session[$savedName];
            }
        } else {
            Yii::$app->session[$savedName] = $params[$savedName];
        }

        $query = Files::find();

        // add conditions that should always apply here

        $dataProvider = new ActiveDataProvider([
            'query' => $query,
        ]);

        // -= SORTING SAVE =-
        if (!isset($params['sort'])) {
            if (isset(Yii::$app->session[$savedName . 'sort'])) {
                $dataProvider->setSort(Yii::$app->session[$savedName . 'sort']);
            }
        } else {
            Yii::$app->session[$savedName . 'sort'] = $dataProvider->sort;
        }

        $this->load($params);

        if (!$this->validate()) {
            // uncomment the following line if you do not want to return any records when validation fails
            // $query->where('0=1');
            return $dataProvider;
        }

        // grid filtering conditions
        $query->andFilterWhere([
            'id' => $this->id,
        ]);

        $query->andFilterWhere(['like', 'name', $this->name])
            ->andFilterWhere(['like', 'file_name', $this->file_name])
            ->andFilterWhere(['like', 'file_path', $this->file_path])
            ->andFilterWhere(['like', 'source_name', $this->source_name])
            ->andFilterWhere(['like', 'source_path', $this->source_path])
            ->andFilterWhere(['like', 'tag', $this->tag])
            ->andFilterWhere(['like', 'comment', $this->comment]);

        return $dataProvider;
    }
}
