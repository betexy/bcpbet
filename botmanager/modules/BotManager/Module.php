<?php

namespace app\modules\BotManager;

use yii\base\BootstrapInterface;
use yii\base\Module as BaseModule;

/**
 * BotManager module definition class
 *
 * @property string $files_dir_alias
 * @property string $internal_js_alias
 *
 */
class Module extends BaseModule implements BootstrapInterface
{
    public $files_dir_alias;
    public $internal_js_alias;
    public $internalBks = [];
    public $bkMapping = [];
    public $bkUrls = [];
    public $bkStartUrls = [];
    public $bkUrlCheck = [];
    public $bkScripts = [];
    public $bkAllFrames = [];
    public $bkAutoload = [];
    public $bkLiveUrl = [];
    public $bkAutoCheck = [];
    public $bkCheckSpecial = [];

    /**
     * {@inheritdoc}
     */
    public $controllerNamespace = 'app\modules\BotManager\controllers';

    /**
     * {@inheritdoc}
     */
    public function init()
    {
        parent::init();

        // custom initialization code goes here
    }

    public function bootstrap($app)
    {
        if ($app instanceof \yii\console\Application) {
            $this->controllerNamespace = 'app\modules\BotManager\commands';
        }
    }

}
