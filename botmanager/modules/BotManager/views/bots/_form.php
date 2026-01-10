<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;
use yii\helpers\ArrayHelper;
use app\modules\BotManager\models\FileGroups;
use app\modules\BotManager\models\SoftwareVersions;
use app\modules\BotManager\models\Server;
use app\modules\BotManager\models\Bots;

/* @var $this yii\web\View */
/* @var $model Bots */
/* @var $form yii\widgets\ActiveForm */
/* @var $remoteTypes array */
/* @var $paymentMethods array */

$remoteTypes = $model::$remoteTypes;
$paymentMethods = $model::$paymentMethods;

$extensions = ArrayHelper::map(FileGroups::findAll(['type' => 0]), 'id', 'name');
$versions = ArrayHelper::map(SoftwareVersions::find()->all(), 'id', 'name');

$formatter = \Yii::$app->formatter;

$this->registerJsFile(\yii\helpers\Url::toRoute(['files/internal-js', 'name' => 'chosen.jquery.min.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerCssFile(\yii\helpers\Url::toRoute(['files/internal-js', 'name' => 'chosen.min.css']));

$this->registerCss('
ul.chosen-choices { 
    display: block;
    padding: 6px 12px;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 4px;
    line-height: 1.42857143;
}
label[for="bm_bk_select"] {
    width: 100%;
}
');

$this->registerJs("$('#bm_bk_select').chosen();", $this::POS_READY);
$this->registerJs("$('#bm_bk_select').chosen().change(function(){
        let thisVal = $(this).val();
        let defaultVal = $('#default_bk_id').val();
        if (thisVal.indexOf(defaultVal) === -1) {
            $('#default_bk_id').val('');   
        }
        console.log($(this).val());
    });", $this::POS_READY);
$this->registerJs("$('#default_bk_id').change(function(){
        let thisVal = $(this).val();
        let chosenVal = $('#bm_bk_select').val();
        if (chosenVal.indexOf(thisVal) === -1) {
            $('#bm_bk_select option[value=\"' + thisVal + '\"]').prop('selected', true);
            $('#bm_bk_select').trigger('chosen:updated');   
        }
    });", $this::POS_READY);

$settings = new \app\modules\BotManager\models\SettingsForm();
$settings->loadData();

if ($settings->double_use_main_uid) {
    $model->double_uid = $model->websocket_uid;
    $this->registerJs("$('#bots-websocket_uid').change(function(){
        $('#bots-double_uid').val($(this).val());        
    });", $this::POS_READY);
}
if (empty($model->double_url)) {
    $model->double_url = $settings->double_default_url;
}

?>

<div class="bots-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <div class="row">
        <div class="col-md-5">
            <?= $form->field($model, 'virtual_machine_name')->textInput(['maxlength' => true, 'readonly' => true]) ?>
        </div>
        <div class="col-md-5">
            <?= $form->field($model, 'virtual_machine_uid')->textInput(['maxlength' => true, 'readonly' => false]) ?>
        </div>
    </div>
    <div class="row">
        <div class="col-md-5">
            <?= $form->field($model, 'server_name')->textInput(['maxlength' => true, 'list' => 'servers_list']) ?>
            <datalist id="servers_list">
                <?php foreach (Bots::find()->select('server_name')->distinct()->orderBy('server_name')->all() as $value) { ?>
                    <option value="<?= $value->server_name ?>"><?= $value->server_name ?></option>
                <?php } ?>
            </datalist>
        </div>
        <div class="col-md-5">
            <?= $form->field($model, 'bm_server_id')
                ->dropDownList(ArrayHelper::merge(['' => ''], ArrayHelper::map(Server::find()->all(), 'id', 'name')),
                    empty($settings['allow_server_change']) ? ['readonly' => true, 'disabled' => true] : []) ?>
        </div>
    </div>

    <div class="row">
        <div class="col-md-2">
            <?= $form->field($model, 'logic_name')->dropDownList($model::$logicNames) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'websocket_uid')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-7">
            <?= $form->field($model, 'websocket_url')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="row">
        <div class="col-md-3">
            <br/>
            <?= $form->field($model, 'test_mode_on')->checkbox() ?>
        </div>
        <div class="col-md-9">
            <?= $form->field($model, 'test_url')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="row">
        <div class="col-md-2">
            <?= $form->field($model, 'extension_id')->dropDownList($extensions) ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'software_versions_id')->dropDownList($versions) ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'run_into_the_chrome')->dropDownList(['0' => 'Multilogin', '1' => 'Chrome']) ?>
        </div>
        <div class="col-md-5">
            <?= $form->field($model, 'multilogin_profile_name')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-1">
            <?= $form->field($model, 'multilogin_port_number')->textInput(['maxlength' => true])->label('Port') ?>
        </div>
    </div>

    <div class="row">
        <div class="col-md-2">
            <?= $form->field($model, 'multilogin_installed')->checkbox(['disabled' => true]) ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'chrome_installed')->checkbox(['disabled' => true]) ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'extension_installed')->checkbox(['disabled' => true]) ?>
        </div>
        <div class="col-md-2">
            <?= $form->field($model, 'remote_installed')->checkbox(['disabled' => true]) ?>
        </div>
        <div class="col-md-4">
            <div class="form-group">
                <label class="control-label" for="">Last request:</label>
                <?= $formatter->asDatetime($model->last_request) ?> (<?= $model->last_status ?>)
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-md-3">
            <?= $form->field($model, 'remote_type')->dropDownList($remoteTypes) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'remote_login')->textInput(['maxlength' => true, 'readonly' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'remote_password')->textInput(['maxlength' => true, 'readonly' => true]) ?>
        </div>
        <div class="col-md-3">
            <br/>
            <?= $form->field($model, 'install_anticaptcha')->checkbox() ?>
        </div>
    </div>

    <div class="row">
        <div class="col-md-4">
            <?= $form->field($model, 'comment_vpn')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-4">
            <?= $form->field($model, 'comment_proxy')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-4">
            <?= $form->field($model, 'comment_multilogin')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="row">
        <div class="col-md-12">
            <?= $form->field($model, 'guacamole_link')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="row" style="border: 2px solid #C01700; border-radius: 5px; background-color: #C0B3A4; margin-bottom: 7px;">
        <div class="col-md-3" style="padding-top: 1.5em;">
            <?= $form->field($model, 'double_enabled')->checkbox() ?>
        </div>
        <div class="col-md-6">
            <?= $form->field($model, 'double_url')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'double_uid')->textInput(['maxlength' => true, 'readonly' => $settings->double_use_main_uid]) ?>
        </div>
    </div>

    <?php /*
    <div class="row">
        <div class="col-md-3">
            <?= $form->field($model, 'payment_method')->dropDownList($paymentMethods) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'payment_login')->textInput(['maxlength' => true,]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'payment_password')->textInput(['maxlength' => true,]) ?>
        </div>
    </div>
    */ ?>

    <div class="row">
        <div class="col-md-9">
            <label class="control-label" for="bm_bk_select">Active BKs:</label>
            <?= \yii\helpers\BaseHtml::dropDownList('Bots[bm_bk_select]', $model->bmBkSelect,
                ArrayHelper::map(FileGroups::find()->where(['type' => 1])->orderBy('name')->all(), 'id', 'name'),
                ['multiple' => true, 'id' => 'bm_bk_select', 'class' => 'form-control', 'style' => 'width: 750px;']) ?>
        </div>
        <div class="col-md-3">
            <label class="control-label" for="default_bk_id">Default:</label>
            <?= \yii\helpers\BaseHtml::dropDownList('Bots[default_bk_id]', $model->default_bk_id,
                ArrayHelper::merge(['' => ''],
                    ArrayHelper::map(FileGroups::find()->where(['type' => 1])->orderBy('name')->all(), 'id', 'name')
                ),
                ['id' => 'default_bk_id', 'class' => 'form-control']) ?>
        </div>
    </div>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <p>
    <div class="form-group">
        <?= Html::submitButton(Yii::t('BotManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>
    </p>

    <?php ActiveForm::end(); ?>

</div>
