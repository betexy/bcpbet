<?php

namespace app\modules\Emails\helpers;

\Yii::setAlias('@PhpQuery', dirname(__FILE__) . '/PhpQuery');

use PhpQuery\PhpQueryObject;
use PhpQuery\PhpQuery as PhpQuery;

PhpQuery::use_function(__NAMESPACE__);

class QueryHelper
{

    /**
     * @param $html
     * @param $selector
     * @return PhpQueryObject|null
     */
    public static function getFirstObject($html, $selector)
    {
        $doc = PhpQuery::newDocument($html);
        $result = null;
        if (!is_array($selector)) {
            $selector = [$selector];
        }
        foreach ($selector as $sel) {
            foreach ($doc[$sel] as $elem) {
                $result = pq($elem);
            }
            if ($result !== null) {
                break;
            }
        }
        return $result;
    }

    /**
     * Возвращаем html по селектору
     * @param $html - код, по ссылке
     * @param $selector - селектор
     * @param $num - какой по счёту вернуть, по умолчанию - первый
     * @param $orMinNum - когда в селекторе есть || или && - минимальное число символов для приёма результата
     * @return string
     */
    public static function getContentBySelector($html, $selector, $num = false, $orMinNum = 0)
    {
        $isOR = (mb_strpos($selector, '||') !== false);
        $isAND = (mb_strpos($selector, '&&') !== false);
        $result = "";
        if ($isOR) {
            $ors = explode('||', $selector);
            foreach ($ors as $or) {
                $result = trim(self::getContentBySelector($html, $or, $num));
                if (!empty($result) && (mb_strlen($result) > $orMinNum))
                    break;
            }
        } elseif ($isAND) {
            $ands = explode('&&', $selector);
            foreach ($ands as $and) {
                $promResult = trim(self::getContentBySelector($html, $and, $num));
                if (!empty($promResult) && (mb_strlen($promResult) > $orMinNum))
                    $result .= $promResult;
            }
        } else {
            $doc = PhpQuery::newDocument($html);
            $i = 1;
            foreach ($doc[$selector] as $elem) {
                if ($num === '*') {
                    // Забираем всё
                    $result .= pq($elem)->html();
                } elseif (!empty($num) && ((int)$num === $i)) {
                    $result = pq($elem)->html();
                    break;
                } elseif (empty($num)) {
                    $result = pq($elem)->html();
                    break;
                } else {
                    $i++;
                }
            }
        }
        return $result;
    }

    public static function onlyText($html)
    {
        $doc = phpQuery::newDocument($html);
        return (pq($doc)->text());
    }

    public static function fetchLinks($html, $selector)
    {
        $doc = phpQuery::newDocument($html);
        $res = array();
        foreach ($doc[$selector] as $elem) {
            $res[] = array(0 => pq($elem)->attr('href'));
        }
        return $res;
    }

    public static function selectorReplace($html, $selector, $replace, $limit = false)
    {
        $selector = trim($selector);
        if ($limit == -1)
            $limit = false;
        $doc = phpQuery::newDocument($html);
        $i = 0;
        foreach ($doc[$selector] as $elem) {
            pq($elem)->replaceWith($replace);
            $i++;
            if (!empty($limit) && ($i >= $limit)) {
                break;
            }
        }
        $result = (string)$doc;
        return $result;
    }

    public static function str_replace_first($search, $replace, $subject)
    {
        $pos = strpos($subject, $search);
        if ($pos !== false) {
            return substr_replace($subject, $replace, $pos, strlen($search));
        }
        return $subject;
    }

}