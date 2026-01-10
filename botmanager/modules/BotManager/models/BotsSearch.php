<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;
use app\modules\BotManager\models\Bots;
use yii\helpers\VarDumper;

/**
 * BotsSearch represents the model behind the search form of `app\modules\BotManager\models\Bots`.
 *
 * @property $only_active int
 * @property $bm_bk_select int[]
 */
class BotsSearch extends Bots
{

    public $only_active;
    public $bm_server_id;

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['id', 'test_mode_on',/* 'extension_id', 'default_bk_id', */
                'last_request', 'only_active',
                'extension_installed', 'chrome_installed', 'multilogin_installed', 'run_into_the_chrome', 'bm_server_id', 'double_enabled'], 'integer'],
            [['virtual_machine_uid', 'virtual_machine_name', 'websocket_url', 'websocket_uid', 'test_url', 'multilogin_profile_name',
                'comment', 'server_name'], 'safe'],
            ['bm_bk_select', function ($attribute, $params) {
                if (!is_array($this->bm_bk_select)) {
                    $this->addError('bmBkSelect', 'Is not array!');
                }
            }],
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

        $query = Bots::find();

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

        //VarDumper::dump($this);

        if (!$this->validate()) {
            // uncomment the following line if you do not want to return any records when validation fails
            // $query->where('0=1');
            return $dataProvider;
        }

        if (isset($this->getRestrictedUsers()[Yii::$app->user->id])) {
            $query->where(['user_id' => Yii::$app->user->id]);
        }

        // grid filtering conditions
        $query->andFilterWhere([
            'id' => $this->id,
            'test_mode_on' => $this->test_mode_on,
            'double_enabled' => $this->double_enabled,
            'extension_installed' => $this->extension_installed,
            'chrome_installed' => $this->chrome_installed,
            'multilogin_installed' => $this->multilogin_installed,
            'run_into_the_chrome' => $this->run_into_the_chrome,
            'extension_id' => $this->extension_id,
            'default_bk_id' => $this->default_bk_id,
            'last_request' => $this->last_request,
            'bm_server_id' => $this->bm_server_id,
        ]);

        if (!empty($this->bm_bk_select)) {
            $query->andWhere(['IN', 'id', (new \yii\db\Query())->select('bots_id')->from('bm_bots_bks')
                ->where(['in', 'bk_id', $this->bm_bk_select])]);
        }

        $query->andFilterWhere(['like', 'virtual_machine_uid', $this->virtual_machine_uid])
            ->andFilterWhere(['like', 'virtual_machine_name', $this->virtual_machine_name])
            ->andFilterWhere(['like', 'websocket_url', $this->websocket_url])
            ->andFilterWhere(['like', 'websocket_uid', $this->websocket_uid])
            ->andFilterWhere(['like', 'test_url', $this->test_url])
            ->andFilterWhere(['like', 'multilogin_profile_name', $this->multilogin_profile_name])
            ->andFilterWhere(['like', 'comment', $this->comment])
            ->andFilterWhere(['like', 'server_name', $this->server_name]);

        if ($this->only_active) {
            $query->andFilterWhere(['and', 'last_request >= ' . (time() - 120)]);
        }

        return $dataProvider;
    }

    private function getRestrictedUsers()
    {
        static $users;
        if (empty($users)) {
            $settings = new SettingsForm();
            $settings->loadData();
            $users = empty($settings->users) ? [] : $settings->users;
        }
        return $users;
    }
}
