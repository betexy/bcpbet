<?php

namespace app\modules\PaySystems;

use yii\base\BootstrapInterface;
use yii\base\Module as BaseModule;

/**
 * pay-systems module definition class
 */
class PaySystems extends BaseModule implements BootstrapInterface
{
    public $files_dir_alias;

    /**
     * {@inheritdoc}
     */
    public $controllerNamespace = 'app\modules\PaySystems\controllers';

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
            $this->controllerNamespace = 'app\modules\PaySystems\commands';
        }
    }
}
