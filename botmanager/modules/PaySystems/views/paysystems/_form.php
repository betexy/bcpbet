<?php

use yii\helpers\Html;
use yii\widgets\ActiveForm;
use yii\helpers\ArrayHelper;

/* @var $this yii\web\View */
/* @var $model app\modules\PaySystems\models\Paysystems */
/* @var $form yii\widgets\ActiveForm */

$masters = ArrayHelper::map(
    \app\modules\PaySystems\models\Paysystems::find()->where(['and', ['type' => $model->type, 'is_master' => 1], ['<>', 'id', $model->id]])->all(),
    'id', 'login');

if ($model->is_master) {
    $masters = ArrayHelper::merge(['' => ''], $masters);
}

$this->registerJs('
    $("#paysystems-type").change(function() {
        if (parseInt($(this).val()) === 3) {
            $("#additionsRowBinance").hide();
            $("#additionsRow").show();
        } else if (parseInt($(this).val()) === 5) {
            $("#additionsRow").hide();
            $("#additionsRowBinance").show();
            $("#paysystems-login").val("bla-bla-bla");
            $("#paysystems-password").val("bla-bla-bla");
        } else {
            $("#additionsRow").hide();
            $("#additionsRowBinance").hide();
        }
    });
');

?>

<div class="paysystems-form">

    <?php $form = ActiveForm::begin(); ?>

    <?= $form->errorSummary($model); ?>

    <div class="row">
        <div class="col-md-2">
            <?= $form->field($model, 'type')->dropDownList(\app\modules\BotManager\models\Bots::$paymentMethods,
                ['readonly' => !$model->isNewRecord, 'disabled' => !$model->isNewRecord]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'login')->textInput(['maxlength' => true, 'readonly' => false]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'password')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-3">
            <?= $form->field($model, 'pin')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-md-1">
            <?= $form->field($model, 'is_master')->dropDownList([0 => 'No', 1 => 'Yes']) ?>
        </div>
    </div>

    <?php if (!$model->isNewRecord && $model->type !== 5) { ?>
        <div class="row" id="secondRow">
            <div class="col-md-2">
                <?= $form->field($model, 'when_amount')->textInput(['maxlength' => true]) ?>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'send_amount')->textInput(['maxlength' => true]) ?>
            </div>
            <div class="col-md-4">
                <?= $form->field($model, 'ps_paysystems_id_master')->dropDownList($masters) ?>
            </div>
            <div class="col-md-2">
                <?= $form->field($model, 'balance')->textInput(['maxlength' => true, 'readonly' => true]) ?>
            </div>
            <div class="col-md-2">
                <label class="control-label" for="paysystems-checked_at">Checked At</label>
                <?= Html::input('text', 'checked_at', empty($model->checked_at) ? '' : Yii::$app->formatter->asDatetime($model->checked_at),
                    ['class' => 'form-control', 'readonly' => true, 'id' => 'paysystems-checked_at']) ?>
            </div>
        </div>
    <?php } ?>
    <?php if ($model->isNewRecord || in_array((int)$model->type, [3, 5])) {
        $additions = is_array($model->additions) ? (object)$model->additions : json_decode($model->additions);
        ?>
        <?php if ($model->type === 3 || $model->isNewRecord) { ?>
            <div class="row" id="additionsRow" <?= $model->isNewRecord ? 'style="display: none;"' : '' ?>>
                <div class="col-md-3">
                    <label class="control-label" for="paysystems-additions-email">Blockchain.com Email</label>
                    <?= Html::input('text', 'Paysystems[additions][email]', empty($additions->email) ? '' : $additions->email,
                        ['class' => 'form-control', 'id' => 'paysystems-additions-email']) ?>
                    <div class="help-block"></div>
                </div>
                <div class="col-md-5">
                    <label class="control-label" for="paysystems-additions-wallet">BTC Wallet</label>
                    <?= Html::input('text', 'Paysystems[additions][wallet]', empty($additions->wallet) ? '' : $additions->wallet,
                        ['class' => 'form-control', 'id' => 'paysystems-additions-wallet']) ?>
                    <div class="help-block"></div>
                </div>
            </div>
        <?php }
        if ($model->type === 5 || $model->isNewRecord) { ?>
            <div class="row" id="additionsRowBinance" <?= $model->isNewRecord ? 'style="display: none;"' : '' ?>>
                <div class="col-md-6">
                    <label class="control-label" for="paysystems-additions-binance-api-key">Binance API key</label>
                    <?= Html::input('text', 'Paysystems[additions][apiKey]', empty($additions->apiKey) ? '' : $additions->apiKey,
                        ['class' => 'form-control', 'id' => 'paysystems-additions-binance-api-key']) ?>
                    <div class="help-block"></div>
                </div>
                <div class="col-md-6">
                    <label class="control-label" for="paysystems-additions-binance-secret-key">Binance Secret
                        key</label>
                    <?= Html::input('text', 'Paysystems[additions][secretKey]', empty($additions->secretKey) ? '' : $additions->secretKey,
                        ['class' => 'form-control', 'id' => 'paysystems-additions-binance-secret-key']) ?>
                    <div class="help-block"></div>
                </div>
            </div>
        <?php } ?>
    <?php } ?>

    <?= $form->field($model, 'comment')->textarea(['rows' => 6]) ?>

    <div class="form-group">
        <?= Html::submitButton(Yii::t('SimsManager', 'Save'), ['class' => 'btn btn-success']) ?>
    </div>

    <?php ActiveForm::end(); ?>

</div>
