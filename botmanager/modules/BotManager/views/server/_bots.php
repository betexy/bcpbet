<?php

use yii\grid\GridView;
use app\modules\BotManager\models\Bots;
use yii\data\ActiveDataProvider;
use yii\helpers\Html;
use yii\web\View;
use app\modules\BotManager\models\Server;

/* @var $this View */
/* @var $model Server */
/* @var $noSummary boolean */
/* @var $unassigned boolean */
/* @var $showHeader boolean */
/* @var $onlyActive boolean */

if ($onlyActive) {
    $query = $unassigned
        ? ['and', ['and', 'last_request >= ' . (time() - 120)], ['is', 'bm_server_id', new \yii\db\Expression('null')]]
        : ['and', ['and', 'last_request >= ' . (time() - 120)], ['bm_server_id' => $model->id]];
} else {
    $query = $unassigned
        ? ['is', 'bm_server_id', new \yii\db\Expression('null')]
        : ['bm_server_id' => $model->id];
}

?>

<?php try {
    echo GridView::widget([
        'layout' => $noSummary ? "{items}\n{pager}" : "{summary}\n{items}\n{pager}",
        'showHeader' => $showHeader,
        'dataProvider' => new ActiveDataProvider([
            'query' => Bots::find()->andFilterWhere($query),
            'pagination' => [
                'pageSize' => 30,
            ],
            //'sort' => ['defaultOrder' => ['last_request' => SORT_DESC]]
            'sort' => ['defaultOrder' => ['virtual_machine_name' => SORT_ASC]]
        ]),
        'rowOptions' => function ($model) {
            return count($model->botsBks) > 4 ? ['style' => 'background-color: pink'] : [];
        },
        'columns' => [
            [
                'attribute' => 'virtual_machine_name',
                'label' => 'Name',
                'format' => 'raw',
                'value' => function ($m) {
                    return Html::a($m->readableName, ['bots/view', 'id' => $m->id])
                        . (!empty($m->guacamoleIcon) ? "<br /><br />{$m->guacamoleIcon}" : '');
                }
            ],
            [
                'attribute' => 'id',
                'label' => 'BK 1',
                'value' => function ($m) {
                    /**
                     * @var Bots $m
                     */
                    return $m->getBkNameByIndex(0);
                }
            ],
            [
                'attribute' => 'id',
                'label' => 'BK 2',
                'value' => function ($m) {
                    /**
                     * @var Bots $m
                     */
                    return $m->getBkNameByIndex(1);
                }
            ],
            [
                'attribute' => 'id',
                'label' => 'BK 3',
                'value' => function ($m) {
                    /**
                     * @var Bots $m
                     */
                    return $m->getBkNameByIndex(2);
                }
            ],
            [
                'attribute' => 'id',
                'label' => 'BK 4',
                'value' => function ($m) {
                    /**
                     * @var Bots $m
                     */
                    return $m->getBkNameByIndex(3);
                }
            ],
            [
                'attribute' => 'id',
                'format' => 'raw',
                'label' => 'Comment',
                'value' => function ($m) {
                    $res = [
                        '<tr><td>Proxy:</td><td>'
                        . Html::input('string', 'comment_proxy', $m->comment_proxy,
                            ['id' => "proxy_{$m->id}", 'data-value' => $m->comment_proxy, 'data-id' => $m->id, 'class' => 'serverComment'])
                        . '</td></tr>',
                        '<tr><td>VPN:</td><td>'
                        . Html::input('string', 'comment_vpn', $m->comment_vpn,
                            ['id' => "vpn_{$m->id}", 'data-value' => $m->comment_vpn, 'data-id' => $m->id, 'class' => 'serverComment'])
                        . '</td></tr>',
                        '<tr><td>Multi:</td><td>'
                        . Html::input('string', 'comment_multilogin', $m->comment_multilogin,
                            ['id' => "multilogin_{$m->id}", 'data-value' => $m->comment_multilogin, 'data-id' => $m->id, 'class' => 'serverComment'])
                        . '</td></tr>',
                    ];
                    return '<table>' . implode("\n", $res) . '</table>';
                }
            ],
        ],
    ]);
} catch (Exception $exception) {
    echo $exception->getMessage();
} ?>
