<?php

namespace app\modules\BotManager\models;

use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\StakeAccounts;

/**
 * StakeAccountsSearch represents the model behind the search form of `app\modules\BotManager\models\StakeAccounts`.
 */
class StakeAccountsSearch extends StakeAccounts
{

    public $mailbox;
    public $proxy;
    public $betexy_id;
    public $wallet;

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'deleted', 'mailboxes_id', 'registered_at', 'created_at', 'updated_at', 'betexy_id',], 'integer'],
            [['name', 'register', 'configs_stakes', 'browser', 'profile', 'login', 'password', 'comment',
                'mailbox', 'proxy', 'wallet', ], 'safe'],
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
        $query = StakeAccounts::find()->joinWith('mailbox')->joinWith('proxy')->joinWith('wallet');

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
            'stake_accounts.deleted' => $this->deleted,
            'mailboxes_id' => $this->mailboxes_id,
            'registered_at' => $this->registered_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ]);

        $query->andFilterWhere(['like', 'name', $this->name])
            ->andFilterWhere(['like', 'stake_accounts.betexy_id', $this->betexy_id])
            ->andFilterWhere(['like', 'register', $this->register])
            ->andFilterWhere(['like', 'configs_stakes', $this->configs_stakes])
            ->andFilterWhere(['like', 'browser', $this->browser])
            ->andFilterWhere(['like', 'profile', $this->profile])
            ->andFilterWhere(['like', 'stake_accounts.login', $this->login])
            ->andFilterWhere(['like', 'password', $this->password])
            ->andFilterWhere(['like', 'comment', $this->comment])
            ->andFilterWhere(['like', 'e_mailboxes.address', trim($this->mailbox)])
            ->andFilterWhere(['like', 'wallets.deposit_address', trim($this->wallet)])
            ->andFilterWhere(['like', 'proxies.host', trim($this->proxy)]);

        return $dataProvider;
    }
}
