<?php

use yii\helpers\Html;
use yii\widgets\DetailView;

/* @var $this yii\web\View */
/* @var $model app\modules\Emails\models\Emails */

$this->title = "{$model->from_name} {$model->from_address}";
$this->params['breadcrumbs'][] = ['label' => 'Emails', 'url' => ['/emails']];
$this->params['breadcrumbs'][] = ['label' => $model->mailboxes->address, 'url' => ['/emails/mailboxes/view', 'id' => $model->mailboxes->id]];
$this->params['breadcrumbs'][] = ['label' => Yii::t('Emails', 'Emails'), 'url' => ['index']];
$this->params['breadcrumbs'][] = $this->title;
\yii\web\YiiAsset::register($this);

$dt = \DateTime::createFromFormat('Y-m-d H:i:s', $model->imap_datetime);
$imap_datetime = empty($dt) ? '???' : Yii::$app->formatter->asDatetime($dt);

$this->registerJs('
    $("#iframe").on(\'load\', function(){
        this.style.height=this.contentDocument.body.scrollHeight +\'px\';
    });
', $this::POS_READY);

$this->registerJs('function showHtmlPart() {    
    let src = "'. \yii\helpers\Url::toRoute(['emails/show-body', 'id' => $model->id]) .'";
     $("body").on("load", "#iframe", function() {
            $(this).height( $(this).contents().find("body").height() );
            console.log("Yo!");
    });    
    $("#iframe").prop("src", src).show();
}', $this::POS_END);

?>
<div class="emails-view">

    <div class="row" style="margin-bottom: 10px;">
        <div class="col-md-11">

        </div>
        <div class="col-md-1">
            <?= Html::a(Yii::t('Emails', 'Delete'), ['delete', 'id' => $model->id], [
                'class' => 'btn btn-danger',
                'data' => [
                    'confirm' => Yii::t('Emails', 'Are you sure you want to delete this item?'),
                    'method' => 'post',
                ],
            ]) ?>
        </div>
    </div>

    <h3><?= Html::encode($this->title) ?></h3>
    <h3><?= $imap_datetime ?></h3>
    <h3><?= $model->subject ?></h3>
    <div id="emailBody">
        <?php if (!empty($model->text_html)) { ?>
            <a href="#" onclick="showHtmlPart(); return false;"><h5>Show html part</h5></a>
            <iframe id="iframe" scrolling="no" style="width: 100%; border: 1px solid #eee; display: none;" src=""></iframe>
        <?php } else { ?>
            <h5>There is no html part...</h5>
        <?php } ?>
    </div>
    <?php try {
        echo DetailView::widget([
            'model' => $model,
            'attributes' => [
                [
                    'attribute' => 'id',
                    'label' => 'ID, Created, Updated at',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return "<strong>{$m->id}</strong>  --- "
                            . Yii::$app->formatter->asDatetime($m->created_at) . ' --- '
                            . Yii::$app->formatter->asDatetime($m->updated_at);
                    }
                ],
                [
                    'attribute' => 'address',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return Html::a($m->address, ['mailboxes/view', 'id' => $m->e_mailboxes_id]);
                    }
                ],
                [
                    'attribute' => 'imap_id',
                    'label' => 'Sys info',
                    'format' => 'raw',
                    'value' => function ($m) {
                        return "{$m->folder} / {$m->imap_id} / {$m->message_id} / {$m->imap_datetime}";
                    }
                ],
                'from_name',
                'from_address',
                'to',
                'to_string',
                'cc',
                'reply_to',
                'subject',
                'text_plain:ntext',
                'attachments:ntext',
                [
                    'attribute' => 'comment',
                    'label' => 'Pattern',
                    'format' => 'raw',
                    'value' => function($m) {
                        if (!empty($m->comment)) {
                            $p = json_decode($m->comment);
                            if (!empty($p)) {
                                return "{$p->pattern} ($p->data)";
                            } else {
                                return '<span color="red">JSON error!</span>';
                            }
                        } else {
                            return null;
                        }
                    }
                ],
            ],
        ]);
    } catch (Exception $e) {
        echo $e->getMessage();
    } ?>

</div>
