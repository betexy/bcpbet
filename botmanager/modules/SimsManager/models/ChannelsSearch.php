<?php

namespace app\modules\SimsManager\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\SimsManager\models\Channels;

/**
 * ChannelsSearch represents the model behind the search form of `app\modules\SimsManager\models\Channels`.
 */
class ChannelsSearch extends Channels
{

    public $slot;
    public $number;

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'channel_id', 'slot', 'goip_sms_id', 'only_manual'], 'integer'],
            [['comment', 'number'], 'safe'],
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
            $session = Yii::$app->session;
            $session[$savedName] = $params[$savedName];
        }

        $query = Channels::find();

        $query->joinWith(['slots', 'sims']);

        // add conditions that should always apply here

        $dataProvider = new ActiveDataProvider([
            'query' => $query,
        ]);

        $dataProvider->sort->attributes['number'] = [
            // The tables are the ones our relation are configured to
            // in my case they are prefixed with "tbl_"
            'asc' => ['sims_sims.number' => SORT_ASC],
            'desc' => ['sims_sims.number' => SORT_DESC],
        ];

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
            $session = Yii::$app->session;
            $session[$savedName . 'sort'] = $dataProvider->sort;
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

        $query->andFilterWhere(['like', 'comment', $this->comment])
            ->andFilterWhere(['like', 'channel_id', $this->channel_id])
            ->andFilterWhere(['like', 'sims_sims.number', $this->number])
            ->andFilterWhere(['like', 'sims_slots.slot_id', $this->slot])
            ->andFilterWhere(['like', 'goip_sms_id', $this->goip_sms_id])
            ->andFilterWhere(['only_manual' => $this->only_manual]);

        return $dataProvider;
    }
}
