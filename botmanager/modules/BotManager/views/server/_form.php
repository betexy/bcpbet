<?php

use yii\helpers\Html;
use yii\helpers\Url;
use yii\widgets\ActiveForm;

/* @var $this yii\web\View */
/* @var $model app\modules\BotManager\models\Server */
/* @var $form yii\widgets\ActiveForm */

$this->registerJsFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'jquery.colorbox-min.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerCssFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'colorbox.css']));

$this->registerJsFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'jquery.ipmask.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerJs('$(\'#ipMasked\').ipmask();', $this::POS_READY);

$this->registerJs('
function renewIps() {
    $.get("' . Url::toRoute(['server/get-ip', 'id' => $model->id]) . '", function(d) { 
        if (d && d.ip) {
            $("#serverIp").html(d.ip);
        }
    }, "JSON");    
}
function colorboxClosed() {
    renewIps();
}
function AddRelationCallback(selected) {
    if (selected && selected.length > 0) {       
        $.post("' . Url::toRoute(['server/assign-ips']) . '", {id: ' . $model->id . ', ips: selected.join(",")}, function(d) {
            if (d && d.status && d.status === "success") {
                renewIps();            
            } else {
                alert("Error save!\n" + (d.message || ""));
            }
        }, "JSON");
    }
}
function addNewIp() {
    $.post("' . Url::toRoute(['server-ip/add-new']) . '", {
        bm_server_id: "' . $model->id . '",
        ip: $("#ipMasked").val()
    }, function(d) {
        if (d && d.status && d.status === "success") {
            renewIps();
            $("#ipMasked").val("");
        } else {
            alert("Error save!\n" + (d.message || ""));
        }
    }, "JSON")
    .fail(function() { alert("Error addNewIp!"); });
}
', $this::POS_END);

?>

<div class="server-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <?= $form->field($model, 'name')->textInput(['maxlength' => true]) ?>

    <?php if ($model->isNewRecord) { ?>
        <h4 style="color: green;">You can add or assign IPs after save!</h4>
    <?php } else { ?>

        <?= $form->field($model, 'ip')->textarea(['rows' => 1, 'readonly' => true, 'disabled' => true, 'id' => 'serverIp']) ?>

        <div class="row">
            <div class="col-md-1" style="padding-top: 5px;">
                <strong>Add IPs:</strong>
            </div>
            <div class="col-md-3">
                <div class="input-group">
                    <?= Html::input('text', '', '', ['class' => 'form-control', 'id' => 'ipMasked']) ?>
                    <span class="input-group-btn">
                    <button type="button" class="btn btn-info" onclick="addNewIp(); return false;">Add new</button>
                </span>
                </div>
            </div>
            <div class="col-md-1">
                <?= Html::button('Select', ['class' => 'btn btn-default',
                    'onclick' => '$.colorbox({onClosed: colorboxClosed, iframe: true, href: "' . Url::toRoute(['server-ip/index'])
                        . '", innerWidth: 1000, innerHeight: "80%"}); return false;']) ?>
            </div>
        </div>
        <br/>
    <?php } ?>

    <div class="row">
        <div class="col-md-3">
            <?= $form->field($model, 'resource')->textInput(['type' => 'number']) ?>
        </div>
    </div>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('BotManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
