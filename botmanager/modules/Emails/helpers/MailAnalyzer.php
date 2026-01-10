<?php

namespace app\modules\Emails\helpers;

use app\modules\Emails\models\Emails;
use yii\helpers\VarDumper;

class MailAnalyzer
{

    private $patterns;

    public function __construct()
    {
        $this->patterns = require dirname(__FILE__) . '/mailPatterns.php';
    }

    public function analyze(Emails $email, $pattern = 'all')
    {
        foreach ($this->patterns as $pId => $p) {
            if ($pattern === 'all' || (is_array($pattern) && in_array($pId, $pattern)) || $pattern === $pId) {
                if (!empty($p['checkField']['field']) && !empty($p['checkField']['value'])
                    &&
                    !$this->checkField($email->{$p['checkField']['field']}, $p['checkField']['value'],
                        !empty($p['checkField']['approximately']))
                ) {
                    continue;
                }
                if (!empty($p['checkBody']) || !empty($p['checkBodyOr'])) {
                    foreach ((empty($p['checkBodyOr']) ? [$p['checkBody']] : $p['checkBodyOr']) as $checkBody) {
                        if (!empty($checkBody['selector'])) {
                            $obj = QueryHelper::getFirstObject($email->{$checkBody['field']}, $checkBody['selector']);
                            if (!empty($obj)) {
                                return [
                                    'pattern' => $pId,
                                    'data' => $obj->attr($checkBody['attr']),
                                ];
                            }
                        } elseif (!empty($checkBody['regex'])) {
                            $r = [];
                            $res = preg_match($checkBody['regex'], $email->{$checkBody['field']}, $r);
                            if (!empty($res) && !empty($r) && is_array($r) && !empty($r[1])) {
                                return [
                                    'pattern' => $pId,
                                    'data' => trim($r[1]),
                                ];
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * @param $field - Field's value in the database
     * @param $value - Field comparison value
     * @param bool $approximately
     * @return bool - true when field NOT MATCH!
     */
    private function checkField($field, $value, bool $approximately = false): bool
    {
        $isEmpty = empty($field);
        $stringNotMatchStrict = (!$approximately && !is_array($value) && $field !== $value);
        $strictNotInArray = (!$approximately && is_array($value) && !in_array($field, $value));
        $approxStringNotMatch = ($approximately && !is_array($value) && mb_strpos($field, $value) !== false);
        $approxNotInArray = ($approximately && is_array($value) && array_reduce($value, function ($carry, $current) use ($field) {
                return $carry || mb_strpos($field, $current) !== false;
            }, false));
        return $isEmpty || $stringNotMatchStrict || $strictNotInArray || $approxStringNotMatch || $approxNotInArray;

    }

}
