<?php

namespace app\modules\SimsManager;

use yii\base\BootstrapInterface;
use yii\base\Module as BaseModule;

/**
 * sims-manager module definition class
 */
class SimsManager extends BaseModule implements BootstrapInterface
{

    public $apiUrl;
    public $apiBasicAuth;
    public $GOIPUrl;
    public $GOIPLoginPassword;
    public $requestsPerMinute;

    /**
     * {@inheritdoc}
     */
    public $controllerNamespace = 'app\modules\SimsManager\controllers';

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
            $this->controllerNamespace = 'app\modules\SimsManager\commands';
        }
    }

}
