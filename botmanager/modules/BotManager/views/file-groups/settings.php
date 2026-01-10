<?php

use yii\bootstrap\Modal;
use yii\helpers\Url;
use yii\web\View;
use yii\widgets\ActiveForm;
use yii\helpers\Html;
use yii\helpers\ArrayHelper;

use app\modules\BotManager\models\BkSettingsForm;

/* @var $this yii\web\View */
/* @var $model BkSettingsForm */

$this->title = Yii::t('BotManager', 'BK settings');
$this->params['breadcrumbs'][] = ['label' => 'Bot manager', 'url' => ['/BotManager']];
$this->params['breadcrumbs'][] = ['label' => 'Extensions & BKs & Software', 'url' => ['/BotManager/file-groups']];
$this->params['breadcrumbs'][] = $this->title;

$model = (new BkSettingsForm())->loadData();
$this->registerJs('const bkData = ' . json_encode($model), $this::POS_HEAD);
$this->registerJs('const bkModalSaveUrl = "' . Url::toRoute(['file-groups/settings-save']) . '"', $this::POS_HEAD);

$this->registerJsFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'jQuery.extendext.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerJsFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'doT.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerJsFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'query-builder.js']), ['depends' => 'yii\web\JqueryAsset']);
$this->registerJs(file_get_contents(dirname(__FILE__) . '/query.js'));
$this->registerJs(file_get_contents(dirname(__FILE__) . '/modalBkEdit.js'));
$this->registerCssFile(Url::toRoute(['/BotManager/files/internal-js', 'name' => 'query-builder.default.min.css']));

$this->registerCss('
#BkSettingsForm input[type="text"].form-control {
    padding: 3px 6px; 
}
#BkSettingsForm input[type="text"].form-control.small {
    padding: 1px 3px; 
    height: auto;
}
#BkSettingsForm input[type="checkbox"].form-control.small {
    margin-top: 4px;
}
#BkSettingsForm td {
    padding: 8px 4px;
}
');

$this->registerJs('
    function confirmRemove() {
        for (i = 0; i < 17; i++) {
            if (!confirm(`Think carefully! You need to confirm ${(17 - i)} more times...`)) {
                return false;
            }
        }
        return true;
    }
    function editFinished() {        
        $(`input[type="text"][name="${$(\'#editModalEdited\').val()}"]`).val($(`#editModalValue`).val());
        $(`#editModalEdited`).val(""); 
        $(`#editModalValue`).val("");
    }
', $this::POS_BEGIN);

$this->registerJs('
    $(`input[type="text"].small`).dblclick(function() {
        $(`#editModalEdited`).val($(this).attr(`name`)); 
        $(`#editModalValue`).val($(this).val());
        $(`#editModal`).modal(`show`);
    });
', $this::POS_READY);

$o = function ($a, $v) {
    return empty($a[$v]) ? '' : $a[$v];
};

$hint = '<strong style="color: green;">Hint: just double click input to edit value in modal dialogue</strong>';
$warningOne = '<strong style="color: darkorange;">If BK does not require loading from manifest (so-called "autoloaded BK")'
    . ' you have to leave url and script fields blank!</strong>';
$warningTwo = '<strong style="color: darkorange;">If BK needs loading from several urls - you need to separate them with semicolon!</strong>';

?>

    <div id="BkSettingsForm">

        <?php /* set display: block for debugging queries */ ?>
        <div class="panel panel-default" style="display: none;">
            <div class="panel-heading">
                <textarea id="builder-result" rows="1" cols="120" class="form-control" readonly></textarea>
            </div>
            <div class="panel-body">
                <div id="builder-basic"></div>
            </div>
            <div class="panel-footer">
                <div class="btn-group">
                    <button class="btn btn-warning reset" data-target="basic" id="btn-reset">Reset</button>
                    <button class="btn btn-success set-json" data-target="basic" id="btn-set-leon">Set rules leon</button>
                    <button class="btn btn-success set-json" data-target="basic" id="btn-set-unibet">Set rules unibet</button>
                    <button class="btn btn-success set-json" data-target="basic" id="btn-set-winline">Set rules winline</button>
                    <button class="btn btn-success set-json" data-target="basic" id="btn-set-onexbet">Set rules onexbet</button>
                    <button class="btn btn-success set-json" data-target="basic" id="btn-set-fon">Set rules fon</button>
                    <button class="btn btn-success set-json" data-target="basic" id="btn-set-bwin">Set rules bwin</button>
                    <button class="btn btn-primary parse-json" data-target="basic" id="btn-get">Get rules</button>
                </div>
            </div>
        </div>

        <div class="panel panel-default">
            <div class="panel-heading">
                <strong><?= Html::encode($this->title)?> (ordered by <span style="color: blue;">label</span>)</strong>
            </div>
            <div class="panel-body">
                <table class="table table-striped">
                    <thead>
                    <tr>
                        <th style="width: 20%;">Internal name</th>
                        <th style="width: 20%;">Mapping</th>
                        <th style="width: 20%; color: blue;">Label</th>
                        <th style="width: 20%;">File</th>
                        <th style="width: 15%;">Autoloaded</th>
                        <th style="width: 5%;">&nbsp;</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php foreach ($model->internalBks as $iBk => $label) { ?>
                        <tr data-isext="<?= ($iBk === 'extension' ? 'yes' : 'no') ?>"
                            style="<?= !empty($model->bkAutoload[$iBk]) ? 'color: blue; font-style: italic;' : '' ?>">
                            <td><?= $iBk ?></td>
                            <?php
                                $file = !is_array($model->bkScripts[$iBk]) ? '' : implode(', ', $model->bkScripts[$iBk]);
                                if ($iBk === 'extension') { ?>
                                <td data-field="bkMapping"></td>
                                <td data-field="internalBks"><?= $label ?></td>
                                <td data-field="file"><?= $file ?></td>
                                <td>&nbsp;</td>
                            <?php } else { ?>
                                <td data-field="bkMapping"><?= $o($model->bkMapping, $iBk) ?></td>
                                <td data-field="internalBks"><?= $label ?></td>
                                <td data-field="file"><?= $file ?></td>
                                <td data-field="bkAllFrames">
                                    <?= !empty($model->bkAutoload[$iBk]) ? 'Yes' : 'No' ?>
                                </td>
                            <?php } ?>
                            <td>
                                <a href="#" data-ibk="<?= $iBk ?>"><span class="glyphicon glyphicon-pencil"></span></a>
                            </td>
                        </tr>
                    <?php } ?>
                    </tbody>
                </table>
            </div>
        </div>

        <br/>

        <div class="panel panel-default">
            <div class="panel-heading">
                <strong>Add new BK</strong><br/>
                <strong style="color: red;">Warning! If you use internal name of existing BK, you'll overwrite it!</strong>
            </div>
            <div class="panel-body">
                <div class="row" style="margin-bottom: 15px;">
                    <div class="col-md-3">
                        <?= Html::input('text', 'internalName', '', ['class' => 'form-control',
                            'placeholder' => 'Internal name', 'id' => 'addNewName']) ?>
                    </div>
                    <div class="col-md-2">
                        <?= Html::button('Add new BK', ['class' => 'btn btn-success', 'id' => 'addNewBkModal']); ?>
                    </div>
                </div>
            </div>
        </div>

        <br/>

        <div class="panel panel-danger">
            <div class="panel-heading">Remove BK</div>
            <div class="panel-body">
                <?= Html::beginForm('/BotManager/file-groups/remove-bk') ?>
                <div class="row">
                    <div class="col-md-2">
                        <?= Html::input('text', 'internalName', '', ['class' => 'form-control', 'placeholder' => 'Internal name']) ?></div>
                </div>
                <br/>
                <button class="btn btn-danger" onclick="return confirmRemove();">Remove</button>
                <?= Html::endForm() ?>
            </div>
        </div>


    </div>

<?php Modal::begin(['id' => 'editBkModal', 'header' => '<strong id="editBkModalHeader">Edit:</strong>', 'size' => '']) ?>
<?= Html::input('hidden', 'id', '', ['id' => 'editBkModalId']); ?>
    <div data-type="TWO THREE" style="text-align: right;">
        <label class="radio-inline"><input type="radio" name="bkAutoload" id="bkAutoload_Ordinary">Ordinary</label>
        <label class="radio-inline"><input type="radio" name="bkAutoload" id="bkAutoload_Autoload">Autoload</label>
    </div>
    <div data-field="bkMapping" data-type="TWO THREE">
        <label for="bkMapping">Mapping:</label>
        <?= Html::input('text', "bkMapping", '', ['id' => 'bkMapping', 'class' => 'form-control native']) ?>
    </div>
    <div data-field="internalBks" data-type="ONE TWO THREE">
        <label for="internalBks">Label:</label>
        <?= Html::input('text', "internalBks", '', ['id' => 'internalBks', 'class' => 'form-control native']) ?>
    </div>
    <div data-field="bkUrls" data-type="TWO">
        <label for="bkUrls">URLs:</label>
        <?= Html::input('text', "bkUrls", '', ['id' => 'bkUrls', 'class' => 'form-control native']) ?>
        <p>Separate multiple URLs with semicolon</p>
    </div>
    <div data-field="bkStartUrls" data-type="TWO THREE">
        <label for="bkStartUrls">Start URL:</label>
        <?= Html::input('text', "bkStartUrls", '', ['id' => 'bkStartUrls', 'class' => 'form-control native']) ?>
    </div>
    <div data-field="bkLiveUrl" data-type="THREE">
        <label for="bkLiveUrl">Live URL:</label>
        <?= Html::input('text', "bkLiveUrl", '', ['id' => 'bkLiveUrl', 'class' => 'form-control native']) ?>
    </div>
    <div data-field="bkUrlCheck" data-type="TWO">
        <label for="bkUrlCheck">URL check:</label>
        <?= Html::input('text', "bkUrlCheck", '', ['id' => 'bkUrlCheck', 'class' => 'form-control native']) ?>
    </div>
    <div data-field="bkScripts" data-type="TWO THREE">
        <label for="bkScripts">Script:</label>
        <?= Html::input('text', "bkScripts", '', ['id' => 'bkScripts', 'class' => 'form-control native']) ?>
        <p>Separate multiple scripts with semicolon</p>
    </div>
    <div data-field="bkAllFrames" data-type="TWO">
        <label for="bkAllFrames">All Frames:</label>
        <?= Html::checkbox("bkAllFrames", false, ['id' => 'bkAllFrames', 'class' => 'small']) ?>
    </div>
    <div data-field="bkCheckSpecial" data-type="THREE">
        <label for="bkCheckSpecial">Content script check not at document_start:</label>
        <?= Html::checkbox("bkCheckSpecial", false, ['id' => 'bkCheckSpecial', 'class' => 'small']) ?>
    </div>
    <div data-field="bkAutoCheck" data-type="THREE">
        <div id="bkAutoCheck"></div>
    </div>
    <div style="text-align: center;">
        <br/>
        <?= Html::button('Save', ['class' => 'btn btn-success', 'id' => 'saveBkModal', 'data-dismiss' => 'modal']) ?>
    </div>
<?php Modal::end() ?>

<?php Modal::begin(['id' => 'editModal', 'header' => '<strong>Edit value</strong>', 'size' => '']) ?>
    <label for="settings_name">Passport:</label>
<?= Html::input('hidden', '', '', ['id' => 'editModalEdited']) ?>
<?= Html::input('text', '', '',
    ['id' => 'editModalValue', 'maxlength' => true, 'class' => 'form-control']) ?>
    <br/>
<?= Html::button('Save', ['class' => 'btn btn-success', 'onclick' => 'return editFinished(this);', 'data-dismiss' => 'modal']) ?>
<?= Html::button('Cancel', ['class' => 'btn btn-danger', 'data-dismiss' => 'modal', 'style' => 'margin-left: 20px;']) ?>
<?php Modal::end() ?>