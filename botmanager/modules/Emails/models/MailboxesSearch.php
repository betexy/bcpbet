<?php

namespace app\modules\Emails\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\Emails\models\Mailboxes;

/**
 * MailboxesSearch represents the model behind the search form of `app\modules\Emails\models\Mailboxes`.
 */
class MailboxesSearch extends Mailboxes
{
    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'created_at', 'updated_at', 'checked_at', 'type', 'do_not_use'], 'integer'],
            [['address', 'login', 'password', 'secret', 'comment'], 'safe'],
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

        $query = Mailboxes::find();

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
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'checked_at' => $this->checked_at,
            'type' => $this->type,
            'do_not_use' => $this->do_not_use,
        ]);

        $query->andFilterWhere(['like', 'address', $this->address])
            ->andFilterWhere(['like', 'login', $this->login])
            ->andFilterWhere(['like', 'password', $this->password])
            ->andFilterWhere(['like', 'secret', $this->secret])
            ->andFilterWhere(['like', 'comment', $this->comment]);

        return $dataProvider;
    }
}
