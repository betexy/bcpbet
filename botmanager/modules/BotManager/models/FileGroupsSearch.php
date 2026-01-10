<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\FileGroups;
use yii\helpers\VarDumper;

/**
 * FileGroupsSearch represents the model behind the search form of `app\modules\BotManager\models\FileGroups`.
 */
class FileGroupsSearch extends FileGroups
{

    public $typeText;
    public $bkInternalText;

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'type'], 'integer'],
            [['name', 'comment', 'typeText', 'bk_internal', 'bkInternalText'], 'safe'],
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

        $query = FileGroups::find();

        // add conditions that should always apply here

        $dataProvider = new ActiveDataProvider([
            'query' => $query,
        ]);

        $sort = $dataProvider->getSort();
        //echo "<pre>";
        //VarDumper::dump($sort);
        $sort->attributes['typeText'] = [
            'asc' => ['type' => SORT_ASC],
            'desc' => ['type' => SORT_DESC],
            'default' => SORT_ASC
        ];
        $sort->attributes['bkInternalText'] = [
            'asc' => ['bk_internal' => SORT_ASC],
            'desc' => ['bk_internal' => SORT_DESC],
            'default' => SORT_ASC
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
            'type' => $this->typeText,
            'bk_internal' => $this->bkInternalText,
        ]);

        $query->andFilterWhere(['like', 'name', $this->name])
            ->andFilterWhere(['like', 'comment', $this->comment]);

        return $dataProvider;
    }
}
