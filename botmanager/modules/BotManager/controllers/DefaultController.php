<?php

namespace app\modules\BotManager\controllers;

use app\controllers\BaseController;
use app\modules\BotManager\Helpers\BotsHelper;
use app\modules\BotManager\models\Bots;
use app\modules\BotManager\models\ServerIp;
use app\modules\BotManager\models\SettingsForm;
use Yii;
use app\modules\BotManager\models\BotsSearch;
use yii\data\ActiveDataProvider;
use yii\filters\AccessControl;
use yii\helpers\ArrayHelper;
use yii\web\Controller;
use yii\web\NotFoundHttpException;

/**
 * Default controller for the `BotManager` module
 */
class DefaultController extends BaseController
{

    public function behaviors()
    {
        return [
            'access' => [
                'class' => AccessControl::class,
                'rules' => [
                    [
                        'allow' => true,
                        'roles' => ['@'],
                    ],
                ],
            ],
        ];
    }

    /**
     * Renders the index view for the module
     * @return string
     */
    public function actionIndex()
    {
        $unassignedIps = ServerIp::find()->where(['is', 'bm_server_id', new \yii\db\Expression('null')])->all();
        if (count($unassignedIps) > 0) {
            Yii::$app->session->setFlash('error', 'There are few unassigned IPs: <strong>'
                . implode(', ', ArrayHelper::map($unassignedIps, 'id', 'ip')) . '</strong>');
        }
        return $this->render('index', [
            'dataProvider' => new ActiveDataProvider([
                'query' => Bots::find()->where(['>=', 'last_request', time() - 120]),
                'pagination' => [
                    'pageSize' => 20,
                ],
                'sort' => ['defaultOrder' => ['id' => SORT_DESC]]
            ]),
        ]);
    }

    /**
     * @return string
     */
    public function actionSettings()
    {
        $model = new SettingsForm();
        if (Yii::$app->request->isPost && $model->load(Yii::$app->request->post()) && $model->save()) {
            Yii::$app->session->setFlash('success', 'Settings were saved!');
            return $this->actionIndex();
        } else {
            if (!Yii::$app->request->isPost) {
                $model->loadData();
            }
            return $this->render('settings', [
                'model' => $model,
            ]);
        }
    }

    public function actionTest()
    {
        $bot = Bots::findOne(6);
        $result = BotsHelper::prepareExtension($bot);
        return $result;
    }

    public function actionTestingGround($id)
    {
        if (array_search($id, ['kb', 'b1', 'b2', 'b3', 'b4', 'b5']) === false) {
            throw new NotFoundHttpException(Yii::t('BotManager',
                'The requested page does not exist.'));
        }
        $bkOptions = [
            'empty1' => '',
            '1XBET' => '1xBet',
            '1XSTAVKA' => '1xStavka',
            '21BET' => '21bet',
            '32RED' => '32red',
            '888SPORT' => '888sport',
            'ASTEKBET' => 'Astekbet',
            'BET365' => 'Bet365',
            'BETANDYOU' => 'BetAndYou',
            'BETBOOM' => 'BetBoom',
            'BETCITY' => 'BetCity',
            'BETSSON' => 'Betsson',
            'BETWAY' => 'BetWay',
            'BETWINNER' => 'BetWinner',
            'BFSPORTSBOOK' => 'BetFair',
            'BOYLESPORTS' => 'BoyleSports',
            'BWIN' => 'Bwin',
            'BWIN.CUPIS' => 'Bwin Cupis',
            'CAMPOBET' => 'Campobet',
            'CASINOWINNER' => 'Casino Winner',
            'CLOUDBET' => 'CloudBet',
            'DOUBLEBET' => 'Db-bet',
            'DAFABET' => 'Dafabet',
            'GAMEBOOKERS' => 'GameBookers',
            'FANSPORT' => 'FanSport',
            'FAVBET' => 'Favbet',
            'FONBET' => 'Fon',
            'FONBET.CUPIS' => 'Fon Cupis',
            'LADBROKES' => 'Ladbrokes',
            'LEON' => 'Leon',
            'LEON.CUPIS' => 'Leon Cupis',
            'LIGASTAVOK' => 'Liga Stavok',
            'LINEBET' => 'Linebet',
            'MARATHON' => 'Marathon',
            'MARATHON.CUPIS' => 'Marathon Cupis',
            'MELBET' => 'MelBet',
            'BET8GR' => 'Mostobet',
            'NORDICBET' => 'Nordic Bet',
            'OLIMP' => 'Olimp',
            'OLIMP.CUPIS' => 'Olimp Cupis',
            'PADDYPOWER' => 'PaddyPower',
            'PARIMATCH' => 'PariMatch Off',
            'PARIMATCH.CUPIS' => 'PariMatch Cup',
            'PARTYPOKER' => 'PartyPoker',
            'PINUP' => 'PinUp',
            'PINUP.CUPIS' => 'PinUp Cupis',
            'RIOBET' => 'Riobet',
            'SPORTINGBET' => 'Sportingbet',
            'TENNISI' => 'Tennisi',
            'TITANBET' => 'Titan',
            'VBET' => 'Vbet',
            'UNIBET' => 'Unibet',
            'WILLIAMHILL' => 'WilliamHill',
            'WINLINEBET' => 'Winlinebet',
            'WINLINE.CUPIS' => 'Winline Cupis',
            'ZULABET' => 'Zulabet',
            'empty2' => '',
            'BTC' => 'Blockchain',
            'NETELLER' => 'Neteller',
            'QIWI' => 'Qiwi',
            'SKRILL' => 'Skrill',
            'PAYEER' => 'Payeer',
            'PM' => 'Perfect Money',
            'YOU_MONEY' => 'You Money',
            'empty3' => '',
            'WHATISMYIP' => 'Test (wimi)',
            'MYIP' => 'Test (mi)',
        ];
        $html = [];
        array_walk($bkOptions, function ($value, $key) use (&$html) {
            $html[] = '<option value="' . (strpos($key, 'empty') !== false ? '' : $key) . '">' . $value . '</option>';
        });
        $bkOptionsHtml = implode(PHP_EOL, $html);
        $this->layout = 'testing-ground';
        return $this->render('testing-ground', [
            'id' => $id,
            'bkOptionsHtml' => $bkOptionsHtml,
        ]);
    }

    public function actionBbBot($id)
    {
        return 'Yo!' . $id;
    }
}
