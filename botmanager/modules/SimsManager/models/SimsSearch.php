<?php

namespace app\modules\SimsManager\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\SimsManager\models\Sims;

/**
 * SimsSearch represents the model behind the search form of `app\modules\SimsManager\models\Sims`.
 */
class SimsSearch extends Sims
{

    public $slot;

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id'], 'integer'],
            [['number', 'comment', 'slot'], 'safe'],
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

        $query = Sims::find();

        // add conditions that should always apply here
        $query->joinWith(['slots']);

        $dataProvider = new ActiveDataProvider([
            'query' => $query,
        ]);

        $dataProvider->sort->attributes['slot'] = [
            // The tables are the ones our relation are configured to
            // in my case they are prefixed with "tbl_"
            'asc' => ['sims_slots.slot_id' => SORT_ASC],
            'desc' => ['sims_slots.slot_id' => SORT_DESC],
        ];

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

        $query->andFilterWhere(['like', 'number', $this->number])
            ->andFilterWhere(['like', 'sims_sims.comment', $this->comment])
            ->andFilterWhere(['like', 'sims_slots.slot_id', $this->slot]);

        return $dataProvider;
    }
}
