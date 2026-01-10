<?php

namespace app\modules\Accounts\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\Accounts\models\Account;

/**
 * AccountSearch represents the model behind the search form of `app\modules\Accounts\models\Account`.
 */
class AccountSearch extends Account
{
    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'created_at', 'has_passport', 'has_registration', 'has_selfie', 'has_driver_license', 'has_address_verification',
                'has_skrill_verification', 'has_qiwi_verification'], 'integer'],
            [['first_name', 'second_name', 'third_name', 'birth_date', 'email', 'email_password', 'phone', 'comment',
                'city', 'postal_code', 'address', 'skrill_login', 'skrill_password', 'qiwi_login', 'qiwi_password', 'first_name_en', 'second_name_en', 'city_en', 'address_en'], 'safe'],
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
        $query = Account::find();

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
            'has_passport' => $this->has_passport,
            'has_registration' => $this->has_registration,
            'has_selfie' => $this->has_selfie,
            'has_driver_license' => $this->has_driver_license,
            'has_address_verification' => $this->has_address_verification,
            'has_skrill_verification' => $this->has_skrill_verification,
            'has_qiwi_verification' => $this->has_qiwi_verification,
        ]);

        $query->andFilterWhere(['like', 'first_name', $this->first_name])
            ->andFilterWhere(['like', 'second_name', $this->second_name])
            ->andFilterWhere(['like', 'third_name', $this->third_name])
            ->andFilterWhere(['like', 'birth_date', $this->birth_date])
            ->andFilterWhere(['like', 'email', $this->email])
            ->andFilterWhere(['like', 'email_password', $this->email_password])
            ->andFilterWhere(['like', 'phone', $this->phone])
            ->andFilterWhere(['like', 'comment', $this->comment])
            ->andFilterWhere(['like', 'city', $this->city])
            ->andFilterWhere(['like', 'postal_code', $this->postal_code])
            ->andFilterWhere(['like', 'address', $this->address])
            ->andFilterWhere(['like', 'skrill_login', $this->skrill_login])
            ->andFilterWhere(['like', 'skrill_password', $this->skrill_password])
            ->andFilterWhere(['like', 'qiwi_login', $this->qiwi_login])
            ->andFilterWhere(['like', 'qiwi_password', $this->qiwi_password])
            ->andFilterWhere(['like', 'first_name_en', $this->first_name_en])
            ->andFilterWhere(['like', 'second_name_en', $this->second_name_en])
            ->andFilterWhere(['like', 'city_en', $this->city_en])
            ->andFilterWhere(['like', 'address_en', $this->address_en]);

        return $dataProvider;
    }
}
