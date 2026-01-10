<?php

use app\modules\BotManager\models\StakeAccounts;
use app\modules\PaySystems\models\History;
use yii\widgets\ActiveForm;
use yii\helpers\Html;
use yii\helpers\ArrayHelper;

use app\modules\BotManager\models\SettingsForm;
use app\modules\BotManager\models\FileGroups;


/* @var $this yii\web\View */
/* @var $model SettingsForm */

$usersOptions = empty($model->users) ? [] : $model->users;

$extensions = ArrayHelper::map(FileGroups::findAll(['type' => 0]), 'id', 'name');
$versions = ArrayHelper::map(\app\modules\BotManager\models\SoftwareVersions::find()->all(), 'id', 'name');

$this->title = Yii::t('BotManager', 'Settings');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = $this->title;

$this->registerJsFile(\yii\helpers\Url::toRoute(['files/internal-js', 'name' => 'chosen.jquery.min.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerCssFile(\yii\helpers\Url::toRoute(['files/internal-js', 'name' => 'chosen.min.css']));

$this->registerJsFile(\yii\helpers\Url::toRoute(['files/internal-js', 'name' => 'service.flextabledit.jquery.min.js']), ['depends' => 'yii\web\JqueryAsset']);

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

$this->registerJs("$('#active_bks').chosen();", $this::POS_READY);

$this->registerJs("$('#active_bks').chosen().change(function(){
        let thisVal = $(this).val();
        let defaultVal = $('#default_bk_id').val();
        if (thisVal.indexOf(defaultVal) === -1) {
            $('#default_bk_id').val('');   
        }
        console.log($(this).val());
    });", $this::POS_READY);
$this->registerJs("$('#default_bk_id').change(function(){
        let thisVal = $(this).val();
        let chosenVal = $('#active_bks').val();
        if (chosenVal.indexOf(thisVal) === -1) {
            $('#active_bks option[value=\"' + thisVal + '\"]').prop('selected', true);
            $('#active_bks').trigger('chosen:updated');   
        }
    });", $this::POS_READY);

$this->registerJs("$('#addUserButton').click(function(e) {
        e.preventDefault();        
        let id = $('#add_user_id').val().toString();
        let slug =  $('#add_user_slug').val().toString().toLowerCase();
        if (isNaN(parseInt(id)) || slug.indexOf(' ') > -1) {
            alert('Check data!');
            return false;
        }
        let html = \"<div class='row usersRow'><div class='col-md-2'>#ID#</div><div class='col-md-3'>#SLUG# (#ID#)</div>\" 
            + \"<input type='hidden' name='SettingsForm[users][#ID#]' value='#SLUG#' />\" 
            + \"<div class='col-md-1'><a class='btn btn-danger editUserButton'>Edit</a></div>\"+ \"</div>\";
        console.log(html);
        $('#usersBlock').append(html.replace(/#ID#/g, id).replace(/#SLUG#/g, slug));
        $('#add_user_id, #add_user_slug').val(''); 
        return false;  
    });", $this::POS_READY);

$this->registerJs("$('body').on('click', 'a.editUserButton', function(e) {
        e.preventDefault();   
        let row = $(this).parent().parent();    
        let id = row.find('div.col-md-2').text().trim();
        let slug =  $('input[name=\"SettingsForm[users][' + id + ']\"]').val();
        $('#add_user_id').val(id);
        $('#add_user_slug').val(slug); 
        row.remove();
        return false;  
    });", $this::POS_READY);

$this->registerCss("
div.row.usersRow {
    margin: 5px 0px;                          
}
div.row.usersRow div.col-md-2, div.row.usersRow div.col-md-3 {
    font-weight: bold;
    border-bottom: 1px solid grey;
    background-color: lightgrey;
    padding: 7px;
    border-radius: 5px;
    margin-left: 3px;
}
");

$paySystems = ArrayHelper::map(\app\modules\PaySystems\models\Paysystems::find()->all(), 'id', 'title');

$settings = new SettingsForm();
$settings->loadData();
$defaults = $settings->loadData(true);

?>

<div class="settings-update">

    <h1><?= Html::encode($this->title) ?></h1>

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <?php if (true) { ?>

        <h3>Jwt:</h3>
        <blockquote style="word-break: break-all; font-size: 14px; font-family: monospace;"><?=\app\modules\BotManager\Helpers\BotsHelper::genToken(1) ?></blockquote>

        <h2>Binance settings:</h2>

        <div class="row"
             style="padding-bottom: 10px; border: 2px solid #4EC012; border-radius: 5px; background-color: #89C063; margin-bottom: 7px;">
            <div class="col-md-3">
                <br/>
                <?= $form->field($model, 'only_existing_wallets')->checkbox() ?>
                Default: <strong><?= $defaults['only_existing_wallets']; ?></strong>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'max_amount')->textInput(['maxlength' => true]) ?>
                Default: <strong><?= $defaults['max_amount']; ?></strong>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'withdraw_interval')->textInput(['maxlength' => true]) ?>
                Default: <strong><?= $defaults['withdraw_interval']; ?></strong>
            </div>
            <div class="col-md-3">
                <?= $form->field($model, 'default_pay_system')->dropDownList($paySystems) ?>
                Default: <strong><?= $paySystems[$defaults['default_pay_system']]; ?></strong>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'default_currency')->dropDownList(History::$currencies) ?>
                Default: <strong><?= History::$currencies[$defaults['default_currency']] ?></strong>
            </div>
        </div>

        <div class="row"
             style="padding-bottom: 10px; border: 2px solid #A9C015FF; border-radius: 5px; background-color: #AFAA3CFF; margin-bottom: 7px;">
            <div class="col-md-2">
                <?= $form->field($model, 'gaz')->textInput(['maxlength' => true]) ?>
                Default: <strong><?= $defaults['gaz']; ?></strong>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'gaz_price')->textInput(['maxlength' => true]) ?>
                Default: <strong><?= $defaults['gaz_price']; ?></strong>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'bnb_for_transaction')->textInput(['maxlength' => true]) ?>
                Default: <strong><?= $defaults['bnb_for_transaction']; ?></strong>
            </div>
            <div class="col-md-1">
                <?= $form->field($model, 'bnb_source_wallet_id')->label("BNB ID")->textInput(['maxlength' => true]) ?>
                <strong style="color: red;">none</strong>
            </div>
            <div class="col-md-4">
                <?= $form->field($model, 'withdrawal_address')->textInput(['maxlength' => true]) ?>
                Default: <strong style="color: red;">none</strong>
            </div>
        </div>

        <div class="row"
             style="border: 2px solid #12C097FF; border-radius: 5px; background-color: #56D8B5FF; margin-bottom: 7px;">
            <div class="col-md-2">
                <?= $form->field($model, 'proxy_api_key')->textInput(['maxlength' => true]) ?>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'luminati_api_key')->textInput(['maxlength' => true]) ?>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'betexy_login')->textInput(['maxlength' => true]) ?>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'betexy_password')->textInput(['maxlength' => true]) ?>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'default_browser')->dropDownList(StakeAccounts::$browsers) ?>
            </div>
        </div>

        <?php if (true) { ?>
            <div class="form-group">
                <br/>
                <?= Html::submitButton(Yii::t('BotManager', 'Save'), ['class' => 'btn btn-success']) ?>
            </div>
        <?php } ?>

        <h2>Old settings:</h2>

        <h3>Users:</h3>

        <div class="row">
            <div class="col-md-2">
                <?= Html::input('string', 'add_user_id', '', ['id' => 'add_user_id', 'class' => 'form-control', 'placeholder' => 'Internal User ID']) ?>
            </div>
            <div class="col-md-3">
                <?= Html::input('string', 'add_user_slug', '', ['id' => 'add_user_slug', 'class' => 'form-control', 'placeholder' => 'External URL slug']) ?>
            </div>
            <div class="col-md-1">
                <a class="btn btn-warning" id="addUserButton">Add</a>
            </div>
        </div>

        <div id="usersBlock">
            <?php if (is_array($model->users)) foreach ($model->users as $userId => $userSlug) { ?>
                <div class='row usersRow'>
                    <div class='col-md-2'><?= $userId ?></div>
                    <div class='col-md-3'><?= "{$userSlug} ({$userId})" ?></div>
                    <input type='hidden' name='SettingsForm[users][<?= $userId ?>]' value='<?= $userSlug ?>'/>
                    <div class="col-md-1">
                        <a class="btn btn-danger editUserButton">Edit</a>
                    </div>
                </div>
            <?php } ?>
        </div>

    <?php } ?>

    <h3>Defaults for software:</h3>

    <?= $form->field($model, 'server_url')->textInput(['maxlength' => true]) ?>

    <div class="row">
        <div class="col-md-6">
            <?= $form->field($model, 'http_login')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-6">
            <?= $form->field($model, 'http_password')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <?= $form->field($model, 'bot_path')->textInput(['maxlength' => true]) ?>

    <div class="row">
        <div class="col-md-6">
            <?= $form->field($model, 'max')->textInput(['type' => 'number']) ?>
        </div>
        <div class="col-md-6">
            <?= $form->field($model, 'reports_interval')->textInput(['type' => 'number']) ?>
        </div>
    </div>

    <div class="row">
        <div class="col-md-6">
            <?= $form->field($model, 'multiloginapp_login')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-6">
            <?= $form->field($model, 'multiloginapp_password')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <h3>Defaults for Bot:</h3>

    <div class="row">
        <div class="col-md-2">
            <br/>
            <?= $form->field($model, 'install_anticaptcha')->checkbox() ?>
        </div>
        <div class="col-md-6">
            <?= $form->field($model, 'anticaptcha_key')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="row">
        <div class="col-md-8">
            <?= $form->field($model, 'websocket_url')->textInput(['maxlength' => true]) ?>
        </div>
        <?php /*
        <div class="col-md-2">
            <?= $form->field($model, 'payment_method')->dropDownList(\app\modules\BotManager\models\Bots::$paymentMethods) ?>
        </div>
        */ ?>
        <div class="col-md-2">
            <?= $form->field($model, 'remote_type')->dropDownList(\app\modules\BotManager\models\Bots::$remoteTypes) ?>
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
        <div class="col-md-2">
            <?= $form->field($model, 'forks_reload_interval')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="row"
         style="border: 2px solid #C01700; border-radius: 5px; background-color: #C0B3A4; margin-bottom: 7px;">
        <div class="col-md-12">
            <strong>Double websocket defaults:</strong>
        </div>
        <div class="col-md-3" style="padding-top: 1.5em;">
            <?= $form->field($model, 'double_enabled_by_default')->checkbox() ?>
        </div>
        <div class="col-md-6">
            <?= $form->field($model, 'double_default_url')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3" style="padding-top: 1.5em;">
            <?= $form->field($model, 'double_use_main_uid')->checkbox(['disabled' => true]) ?>
        </div>
    </div>

    <div class="row"
         style="border: 2px solid #9AC006; border-radius: 5px; background-color: #B1C052; margin-bottom: 7px;">
        <div class="col-md-6">
            <?= $form->field($model, 'sms_api_url')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'sms_api_http_login')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'sms_api_http_password')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="row"
         style="border: 2px solid #4EC012; border-radius: 5px; background-color: #89C063; margin-bottom: 7px;">
        <div class="col-md-6">
            <?= $form->field($model, 'ps_api_url')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'ps_api_http_login')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'ps_api_http_password')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="row"
         style="border: 2px solid #15A1C0; border-radius: 5px; background-color: #71B6C0; margin-bottom: 7px;">
        <div class="col-md-6">
            <?= $form->field($model, 'email_api_url')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'email_api_http_login')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'email_api_http_password')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="row"
         style="border: 2px solid #C029A4; border-radius: 5px; background-color: #C092B7; margin-bottom: 7px;">
        <div class="col-md-6">
            <?= $form->field($model, 'screenshot_api_url')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'screenshot_api_http_login')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'screenshot_api_http_password')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="row">
        <div class="col-md-9">
            <label class="control-label" for="active_bks">Active BKs:</label>
            <?= \yii\helpers\BaseHtml::dropDownList('SettingsForm[active_bks]', $model->active_bks,
                ArrayHelper::map(FileGroups::findAll(['type' => 1]), 'id', 'name'),
                ['multiple' => true, 'id' => 'active_bks', 'class' => 'form-control', 'style' => 'width: 750px;']) ?>
        </div>
        <div class="col-md-3">
            <label class="control-label" for="default_bk_id">Default:</label>
            <?= \yii\helpers\BaseHtml::dropDownList('SettingsForm[default_bk_id]', $model->default_bk_id,
                ArrayHelper::merge(['' => ''], ArrayHelper::map(FileGroups::findAll(['type' => 1]), 'id', 'name')),
                ['id' => 'default_bk_id', 'class' => 'form-control']) ?>
        </div>
    </div>

    <div class="row">
        <div class="col-md-3">
            <?= $form->field($model, 'allow_server_change')->checkbox() ?>
        </div>
    </div>

    <?php ActiveForm::end(); ?>

</div>
