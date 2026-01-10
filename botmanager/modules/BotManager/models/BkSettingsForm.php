<?php

namespace app\modules\BotManager\models;

use Yii;
use yii\base\Model;
use yii\helpers\ArrayHelper;
use yii\helpers\Url;
use yii\helpers\VarDumper;

class BkSettingsForm extends Model
{

    public $internalBks;
    public $bkMapping;
    public $bkUrls;
    public $bkScripts;
    public $bkAllFrames;
    public $bkStartUrls;
    public $bkUrlCheck;

    public $bkLiveUrl;
    public $bkAutoload;
    public $bkAutoCheck;
    public $bkCheckSpecial;

    private $arrays = ['internalBks', 'bkMapping', 'bkUrls', 'bkScripts', 'bkAllFrames', 'bkStartUrls', 'bkUrlCheck',
        'bkLiveUrl', 'bkAutoload', 'bkAutoCheck', 'bkCheckSpecial'];
    private $complexArrays = ['bkUrls', 'bkScripts'];
    private $boolData = ['bkAllFrames', 'bkAutoload', 'bkCheckSpecial'];

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [$this->arrays, function ($attribute) {
                if (!is_array($this->$attribute)) {
                    $this->addError($attribute, 'Is not array!');
                }
            }],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'internalBks' => Yii::t('BotManager', 'Internal BKs'),
            'bkMapping' => Yii::t('BotManager', 'BK mapping'),
            'bkUrls' => Yii::t('BotManager', 'BK urls'),
            'bkScripts' => Yii::t('BotManager', 'BK script'),
            'bkAllFrames' => Yii::t('BotManager', 'All frames'),
            'bkStartUrls' => Yii::t('BotManager', 'Start URL'),
            'bkUrlCheck' => Yii::t('BotManager', 'URL Check'),
            'bkLiveUrl' => Yii::t('BotManager', 'Path to Live'),
            'bkAutoload' => Yii::t('BotManager', 'Is autoloaded'),
            'bkAutoCheck' => Yii::t('BotManager', 'Auto Check'),
            'bkCheckSpecial' => Yii::t('BotManager', 'Content script check not at document_start'),
        ];
    }

    public function loadBk($internalName, $data)
    {
        foreach ($this->arrays as $key) {
            if (isset($data[$key])) {
                if (in_array($key, $this->complexArrays)) {
                    $value = explode(';', $data[$key]);
                    foreach ($value as &$val) {
                        $val = !in_array($key, $this->boolData) ? trim($val) : (boolean)json_decode(strtolower($data[$key]));
                    }
                    $value = array_filter($value, function ($v) use ($key) {
                        return !in_array($key, $this->boolData) ? !empty($v) : true;
                    });
                } else {
                    $value = !in_array($key, $this->boolData) ? trim($data[$key]) : (boolean)json_decode(strtolower($data[$key]));
                }
                $this->$key[$internalName] = $value;
            } else {
                unset($this->$key[$internalName]);
            }
        }
    }

    public function deleteBk($internalName)
    {
        foreach ($this->arrays as $attribute) {
            unset($this->$attribute[$internalName]);
        }
    }

    public function loadData($onlyBks = [])
    {
        $filename = Yii::getAlias(Yii::$app->controller->module->files_dir_alias) . 'bkSettings.php';
        if (!file_exists($filename)) {
            $data = [];
        } else {
            $data = require Yii::getAlias(Yii::$app->controller->module->files_dir_alias) . 'bkSettings.php';
        }

        $this->setAttributes($this->setDefaults($data));
        // Leave only necessary bk
        if (!empty($onlyBks)) {
            foreach ($this->arrays as $attribute) {
                $needRemove = array_diff(array_keys($this->$attribute), $onlyBks);
                if (!empty($needRemove)) {
                    foreach ($needRemove as $bk) {
                        unset($this->$attribute[$bk]);
                    }
                }
            }
        }
        return $this;
    }

    public function save()
    {
        if ($this->validate() && $this->sort()) {
            return (bool)file_put_contents(Yii::getAlias(Yii::$app->controller->module->files_dir_alias) . 'bkSettings.php',
                "<?php\r\nreturn " . VarDumper::export($this->getAttributes()) . ";\r\n");
        } else {
            return false;
        }
    }

    private function setDefaults($data)
    {
        foreach ($this->arrays as $key) {
            if (empty($data[$key])) {
                $data[$key] = Yii::$app->controller->module->$key;
            }
        }
        if (empty($data['internalBks']['extension'])) {
            $data['internalBks']['extension'] = 'Not BK';
        }
        return $data;
    }

    private function sort()
    {
        $order = $this->internalBks;
        uasort($order, function ($a, $b) {
            return strnatcmp(mb_strtolower($a), mb_strtolower($b));
        });
        $order = ['extension' => $order['extension']] + $order;
        foreach ($this->arrays as $arrayName) {
            $temp = [];
            foreach (array_keys($order) as $bk) {
                if (empty($this->$arrayName[$bk])) {
                    continue;
                }
                $temp[$bk] = $this->$arrayName[$bk];
            }
            $this->$arrayName = $temp;
        }
        return true;
    }

}