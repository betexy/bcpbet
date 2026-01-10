<?php

namespace app\modules\PaySystems\models;

use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\PaySystems\models\Wallets;

/**
 * WalletsSearch represents the model behind the search form of `app\modules\PaySystems\models\Wallets`.
 */
class WalletsSearch extends Wallets
{

    public $mailbox;
    public $balance;
    public $stakeAccount;

    /**
     * {@inheritdoc}
     */
    public function rules(): array
    {
        return [
            [['id', 'approved', 'deleted', 'created_at', 'updated_at'], 'integer'],
            [['deposit_address', 'withdrawal_address', 'withdrawal_balance', 'uid', 'login', 'bookie', 'network',
                'comment', 'mailbox', 'balance', 'stakeAccount', ], 'safe'],
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
        $query = Wallets::find()->joinWith('mailbox')->joinWith('stakeAccount');

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
            'wallets.id' => $this->id,
            'approved' => $this->approved,
            'wallets.deleted' => $this->deleted,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ]);

        $query
            ->andFilterWhere(['like', 'deposit_address', trim($this->deposit_address)])
            ->andFilterWhere(['like', 'withdrawal_address', trim($this->withdrawal_address)])
            ->andFilterWhere(['like', 'bookie', trim($this->bookie)])
            ->andFilterWhere(['like', 'uid', trim($this->uid)])
            ->andFilterWhere(['like', 'wallets.login', trim($this->login)])
            ->andFilterWhere(['like', 'comment', trim($this->comment)])
            ->andFilterWhere(['like', 'network', trim($this->network)])
            ->andFilterWhere(['like', 'e_mailboxes.address', trim($this->mailbox)])
            ->andFilterWhere(['like', 'stake_accounts.name', trim($this->stakeAccount)])
            ->andFilterWhere(['like', 'CONCAT_WS(" ", withdrawal_balance_bnb, withdrawal_balance_usdt)', trim($this->balance)]);



        return $dataProvider;
    }
}
