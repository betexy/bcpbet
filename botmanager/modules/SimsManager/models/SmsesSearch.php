<?php

namespace app\modules\SimsManager\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\SimsManager\models\Smses;

/**
 * SmsesSearch represents the model behind the search form of `app\modules\SimsManager\models\Smses`.
 */
class SmsesSearch extends Smses
{
    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'receive_id', 'provid', 'sims_channels_id', 'status'], 'integer'],
            [['number', 'scrum', 'msg', 'time_received', 'goip_name', 'smscnum', 'senttime', 'comment'], 'safe'],
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

        $query = Smses::find();

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
            'receive_id' => $this->receive_id,
            'provid' => $this->provid,
            'time_received' => $this->time_received,
            'sims_channels_id' => $this->sims_channels_id,
            'status' => $this->status,
            'senttime' => $this->senttime,
        ]);

        $query->andFilterWhere(['like', 'number', $this->number])
            ->andFilterWhere(['like', 'scrum', $this->scrum])
            ->andFilterWhere(['like', 'msg', $this->msg])
            ->andFilterWhere(['like', 'goip_name', $this->goip_name])
            ->andFilterWhere(['like', 'smscnum', $this->smscnum])
            ->andFilterWhere(['like', 'comment', $this->comment]);

        return $dataProvider;
    }
}
