<?php

use yii\helpers\Html;

function showAdditions($m, $hideSecret = false): string
{
    $additions = json_decode($m->additions);
    $result = '-= no additions =-';
    if ((int)$m->type === 3) {
        $result = empty($additions->email) || empty($additions->wallet)
            ? '<strong style="color: red;">WARNING! email or wallet not set yet!!!</strong>'
            : "Email: {$additions->email}, wallet: {$additions->wallet}";
    } elseif ((int)$m->type === 5) {
        $result = empty($additions->apiKey) || empty($additions->secretKey)
            ? '<strong style="color: red;">WARNING! api and/or secret key(s) not set yet!!!</strong>'
            : "API key: {$additions->apiKey}".(empty($hideSecret) ? "<br />Secret key: {$additions->secretKey}" : '');
    }
    return $hideSecret ? Html::a($result, ['paysystems/view', 'id' => $m->id]) : $result;
}
