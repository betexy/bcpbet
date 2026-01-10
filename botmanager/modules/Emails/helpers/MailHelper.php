<?php

namespace app\modules\Emails\helpers;

use app\modules\Emails\helpers\imap\IncomingMail;
use app\modules\Emails\helpers\imap\Exception;
use app\modules\Emails\helpers\imap\Mailbox;
use app\modules\Emails\helpers\imap\ImapConnection;
use app\modules\Emails\models\Mailboxes;
use app\modules\Emails\models\Emails;
use app\modules\Emails\models\MailsettingsForm;
use yii\web\BadRequestHttpException;

class MailHelper
{
    private static $logs = false;

    /**
     * @param Mailboxes|int $id
     * @return array
     * @throws BadRequestHttpException
     */
    public static function checkMail($id): array
    {
        ini_set('max_execution_time', 300);
        if (!$id instanceof Mailboxes) {
            $mailboxes = Mailboxes::findOne($id);
            if (empty($mailboxes)) {
                return ['success' => false, 'message' => "Mailbox with id {$id} not found :("];
            }
        } else {
            $mailboxes = $id;
        }
        self::log("Checking mailbox {$mailboxes->id} {$mailboxes->type} {$mailboxes->address}");
        $folders = self::loadFolders($mailboxes);
        $result = [
            'success' => [],
            'error' => []
        ];
        foreach ($folders as $secret) {
            self::log("--- {$secret} ------------------------------------------------------------------------");
            if (mb_stripos($secret, 'inbox') === false) {
                self::log("Skip {$secret}");
                continue;
            }
            self::log("Checking {$secret} => " . strtoupper($secret));
            $mailboxes->secret = strtoupper($secret);
            $mailbox = new Mailbox(self::getImapConnection($mailboxes));
            //$mailbox->readMailParts = false;
            try {
                $dt = new \DateTime();
                $dt->modify('-10 days');
                // also should be possible d-M-Y and without quotes, but... I did not test it, cuz I'm lazy
                $criteria = $mailboxes->type === 7 ? 'ALL' : 'SINCE "' . $dt->format('j-M-Y') . '"';
                $res = $mailbox->searchMailBox($criteria);
                self::log("searchMailBox {$mailboxes->secret} type: {$mailboxes->type} => `{$criteria}`, res:"
                    . PHP_EOL . print_r($res, true));
            } catch (Exception|\Exception $e) {
                return ['success' => false, 'message' => "«" . $e->getMessage() . "»"];
            }
            self::log("Let's get max of {$mailboxes->secret}!");
            $maxId = (int)$mailboxes->getEmails()->where(['folder' => $mailboxes->secret])->max('imap_id');
            self::log("maxId in {$mailboxes->secret}: {$maxId}");
            foreach ($res as $mailId) {
                if ((int)$mailId > $maxId) {
                    try {
                        $mail = $mailbox->getMail($mailId);
                        $r = self::saveEmail($mailboxes->id, $mail, $mailboxes->secret);
                        self::log('saveEmail res:' . PHP_EOL . print_r($r, true));
                        $result[$r['status']][] = $r['message'];
                    } catch (Exception $e) {
                        $result['error'][] = $e->getMessage();
                        continue;
                    }
                }
            }
        }
        $mailboxes->checked_at = time();
        $mailboxes->mail_count = Emails::find()->where(['e_mailboxes_id' => $mailboxes->id])->count();
        $mailboxes->save();
        $res = ['success' => true, 'message' => $result];
        self::log('checkMail res:' . PHP_EOL . print_r($res, true));
        return $res;
    }

    public static function analyzeMailbox($mailboxes_id)
    {
        $mailboxes = Mailboxes::findOne($mailboxes_id);
        if (empty($mailboxes)) {
            return false;
        }
        $analyzer = new MailAnalyzer();
        foreach ($mailboxes->emails as $email) {
            $res = $analyzer->analyze($email);
            $email->comment = $res !== false ? json_encode($res) : null;
            $email->save();
        }
        return true;
    }

    public static function deleteEmail(Emails $email)
    {
        $mailbox = new Mailbox(self::getImapConnection($email->mailboxes));
        try {
            $mailbox->deleteMail($email->imap_id);
            $mailbox->expungeDeletedMails();
        } catch (Exception $e) {
            return $e->getMessage();
        }
        return true;
    }

    public static function getFolders($mailboxes_id)
    {
        $mailboxes = Mailboxes::findOne($mailboxes_id);
        $mailboxes->secret = '';
        $mailbox = new Mailbox(self::getImapConnection($mailboxes, true));
        try {
            $folders = $mailbox->getListingFolders();
        } catch (\Exception $e) {
            return ['success' => false, 'message' => "IMAP error: " . $e->getMessage()];
        }
        $res = [];
        foreach ($folders as $key => $val) {
            $res[] = "{$key} => {$val}";
        }
        return ['success' => true, 'message' => implode("<br />\n", $res)];
    }

    private static function loadFolders(Mailboxes $mailboxes)
    {
        $contains = function ($str, $arr) {
            foreach ($arr as $ca) {
                if (mb_stripos($str, $ca) !== false) {
                    return true;
                }
            }
            return false;
        };
        $folders = $mailboxes->obtainFolders();
        if (empty($folders)) {
            $mailbox = new Mailbox(self::getImapConnection($mailboxes, true));
            foreach ($mailbox->getListingFolders() as $f) {
                if ($contains($f, ['inbox', 'спам', 'spam', 'junk'])) {
                    $folders[] = $f;
                }
            }
            $mailboxes->folders = json_encode($folders);
            $mailboxes->save();
        }
        return $folders;
    }

    private static function saveEmail($mailboxes_id, IncomingMail $mail, $folder = 'INBOX')
    {
        $e = new Emails();
        $e->e_mailboxes_id = $mailboxes_id;
        $e->folder = $folder;
        $e->imap_id = $mail->id;
        $e->message_id = $mail->messageId;
        $e->imap_datetime = $mail->date;
        $e->from_name = empty($mail->fromName) ? '' : $mail->fromName;
        $e->from_address = $mail->fromAddress;
        $e->to = var_export($mail->to, true);
        $e->to_string = empty($mail->toString) ? '(empty)' : $mail->toString;
        $e->cc = var_export($mail->cc, true);
        $e->reply_to = var_export($mail->replyTo, true);
        $e->subject = $mail->subject;
        if (!$e->save()) {
            return ['status' => 'error', 'message' => var_export($e->errors, true)];
        } else {
            $attachments = $mail->getAttachments();
            $a = [];
            foreach ($attachments as $attachment) {
                $a[] = $attachment->name;
                //['id' => $attachment->id, 'name' => $attachment->name, 'file' => $attachment->filePath];
            }
            $e->text_plain = $mail->textPlain;
            $e->text_html = $mail->textHtml;
            $e->attachments = implode(', ', $a);
            if (!$e->save()) {
                return ['status' => 'error', 'message' => "Error saving email {$e->id}: " . var_export($e->errors, true)];
            } else {
                return ['status' => 'success', 'message' => "Mail saved with internal ID: {$e->id}"];
            }
        }
    }

    /**
     * @throws BadRequestHttpException
     */
    private static function getImapConnection(Mailboxes $mailboxes, $forFolders = false)
    {
        $settings = (new MailsettingsForm())->loadData();
        $imapString = "type_{$mailboxes->type}_IMAP";
        $imapPort = "type_{$mailboxes->type}_IMAP_port";
        if (empty($mailboxes->login) || empty($mailboxes->password) || empty($settings->$imapPort) || empty($settings->$imapString)) {
            throw new BadRequestHttpException("Wrong mail settings!");
        }
        $imapConnection = new ImapConnection();
        $imapConnection->imapPath = "{{$settings->$imapString}:{$settings->$imapPort}/imap/ssl}"
            . ($forFolders ? '' : (!empty($mailboxes->secret) ? "{$mailboxes->secret}" : 'INBOX'));
        self::log('imapPath: ' . $imapConnection->imapPath);
        $imapConnection->imapLogin = $mailboxes->login;
        $imapConnection->imapPassword = $mailboxes->password;
        $imapConnection->serverEncoding = 'UTF-8'; // 'utf-8'; //
        //$imapConnection->attachmentsDir = Yii::getAlias(Yii::$app->controller->module->attachments_path);
        $imapConnection->attachmentsDir = false;
        return $imapConnection;
    }

    private static function log($message)
    {
        if (!self::$logs) {
            return;
        }
        file_put_contents(\Yii::getAlias('@runtime/logs/mailboxes.log'), date('Y-m-d H:i:s')
            . ': ' . $message . PHP_EOL, FILE_APPEND);
    }

}
