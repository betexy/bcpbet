<?php

namespace app\modules\Emails;

use yii\base\BootstrapInterface;
use yii\base\Module as BaseModule;

/**
 * pay-systems module definition class
 */
class Emails extends BaseModule implements BootstrapInterface
{
    public $files_dir_alias;
    public $attachments_path;

    /**
     * {@inheritdoc}
     */
    public $controllerNamespace = 'app\modules\Emails\controllers';

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
            $this->controllerNamespace = 'app\modules\Emails\commands';
        }
    }
}
