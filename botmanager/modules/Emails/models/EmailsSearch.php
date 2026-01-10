<?php

namespace app\modules\Emails\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\Emails\models\Emails;

/**
 * EmailsSearch represents the model behind the search form of `app\modules\Emails\models\Emails`.
 */
class EmailsSearch extends Emails
{

    public $address;

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'created_at', 'updated_at', 'e_mailboxes_id', 'imap_id', 'address'], 'integer'],
            [['message_id', 'imap_datetime', 'from_name', 'from_address', 'to', 'to_string', 'cc', 'reply_to',
                'subject', 'text_plain', 'text_html', 'attachments', 'comment'], 'safe'],
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

        $query = Emails::find();

        $query->joinWith(['mailboxes']);

        // add conditions that should always apply here

        $dataProvider = new ActiveDataProvider([
            'query' => $query,
        ]);

        $dataProvider->sort->attributes['address'] = [
            // The tables are the ones our relation are configured to
            // in my case they are prefixed with "tbl_"
            'asc' => ['e_mailboxes.address' => SORT_ASC],
            'desc' => ['e_mailboxes.address' => SORT_DESC],
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
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'e_mailboxes_id' => $this->e_mailboxes_id,
            'imap_id' => $this->imap_id,
        ]);

        $query->andFilterWhere(['like', 'message_id', $this->message_id])
            ->andFilterWhere(['like', 'imap_datetime', $this->imap_datetime])
            ->andFilterWhere(['like', 'from_name', $this->from_name])
            ->andFilterWhere(['like', 'from_address', $this->from_address])
            ->andFilterWhere(['like', 'to', $this->to])
            ->andFilterWhere(['like', 'to_string', $this->to_string])
            ->andFilterWhere(['like', 'cc', $this->cc])
            ->andFilterWhere(['like', 'reply_to', $this->reply_to])
            ->andFilterWhere(['like', 'subject', $this->subject])
            ->andFilterWhere(['like', 'text_plain', $this->text_plain])
            ->andFilterWhere(['like', 'text_html', $this->text_html])
            ->andFilterWhere(['like', 'attachments', $this->attachments])
            ->andFilterWhere(['like', 'comment', $this->comment])
            ->andFilterWhere(['=', 'e_mailboxes_id', $this->address]);

        return $dataProvider;
    }
}
