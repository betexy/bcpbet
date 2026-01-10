<?php

namespace app\modules\SimsManager\models;

use Yii;
use yii\helpers\Html;
use yii\helpers\VarDumper;

/**
 * This is the model class for table "{{%sims_sims}}".
 *
 * @property int $id
 * @property string $number
 * @property string $comment
 * @property int $sims_slots_id
 *
 * @property Slots $slot
 * @property Slots[] $slots
 * @property SimsSlots[] $simsSlots
 */
class Sims extends \yii\db\ActiveRecord
{

    public $sims_slots_id;
    private $csvImport = false;

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%sims_sims}}';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['number'], 'required'],
            [['comment'], 'string'],
            [['sims_slots_id'], 'integer'],
            [['number'], 'string', 'max' => 20],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('SimsManager', 'ID'),
            'number' => Yii::t('SimsManager', 'Phone number'),
            'comment' => Yii::t('SimsManager', 'Comment'),
            'sims_slots_id' => Yii::t('SimsManager', 'Slot'),
            'slot.slot_id' => Yii::t('SimsManager', 'Slot'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSimsSlots()
    {
        return $this->hasMany(SimsSlots::class, ['sims_sims_id' => 'id'])->where(['deleted' => 0]);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSlots()
    {
        return $this->hasMany(Slots::class, ['id' => 'sims_slots_id'])->viaTable('{{%sims_sims_slots}}',
            ['sims_sims_id' => 'id'], function (yii\db\ActiveQuery $query) {
                return $query->onCondition(['deleted' => 0]);
            });
    }

    public function getSlot()
    {
        return empty($this->simsSlots) ? null : $this->simsSlots[0]->slot;
    }

    /**
     * @return bool
     * @throws \Throwable
     * @throws \yii\db\StaleObjectException
     */
    public function beforeDelete()
    {
        if (!parent::beforeDelete()) {
            return false;
        }
        if (SimsSlots::find()->where(['sims_sims_id' => $this->id])->count() > 0) {
            foreach (SimsSlots::find()->where(['sims_sims_id' => $this->id])->all() as $SimSlot) {
                $SimSlot->delete();
            }
        }
        if (Actions::find()->where(['sims_sims_id' => $this->id])->count() > 0) {
            foreach (Actions::find()->where(['sims_sims_id' => $this->id])->all() as $SimSlot) {
                $SimSlot->delete();
            }
        }
        if (SmsesSims::find()->where(['sims_sims_id' => $this->id])->count() > 0) {
            foreach (SmsesSims::find()->where(['sims_sims_id' => $this->id])->all() as $SimSlot) {
                $SimSlot->delete();
            }
        }
        return true;
    }

    public function afterSave($insert, $changedAttributes)
    {
        parent::afterSave($insert, $changedAttributes);
        if (empty($this->slot) || $this->slot->id !== (int)$this->sims_slots_id) {
            // Hint: check it's free first!
            $check = SimsSlots::find()->where(['deleted' => 0, 'sims_slots_id' => (int)$this->sims_slots_id]);
            if ($check->count() > 0) {
                $used = $check->one();
                if ($this->csvImport) {
                    $used->deleted = 1;
                    $used->save();
                } else {
                    Yii::$app->session->setFlash('error', "This SLOT already used in: "
                        . Html::a($used->sim->number, ['sims/view', 'id' => $used->sim->id], ['target' => '_blank']));
                }
            } else {
                foreach ($this->simsSlots as $slot) {
                    $slot->deleted = 1;
                    $slot->save();
                }
                if (!empty($this->sims_slots_id)) {
                    $new = new SimsSlots();
                    $new->sims_slots_id = $this->sims_slots_id;
                    $new->sims_sims_id = $this->id;
                    $new->deleted = 0;
                    if (!$new->save()) {
                        Yii::$app->session->setFlash('error', VarDumper::dumpAsString($new->errors));
                    }
                }
            }
        }
    }

    /**
     * Import from csv-string
     * @param string $csv
     * @return bool
     */
    public static function importFromCsv($csv)
    {
        $success = true;
        $data = explode("\n", $csv);
        foreach ($data as $r) {
            $row = explode(';', trim($r));
            if (count($row) === 3 && !empty($row[0])) {
                $sim = Sims::findOne(['number' => $row[0]]);
                if (empty($sim)) {
                    $sim = new Sims();
                    $sim->number = $row[0];
                }
                $sim->csvImport = true;
                $sim->comment = base64_decode($row[2]);
                if (!empty($row[1])) {
                    $slot = Slots::findOne(['slot_id' => $row[1]]);
                    $sim->sims_slots_id = empty($slot) ? null : $slot->id;
                } else {
                    $sim->sims_slots_id = null;
                }
                if (!$sim->save()) {
                    $success = false;
                    Yii::$app->session->addFlash('error', "Error saving sim: " . VarDumper::dumpAsString($sim->errors));
                }
            } else {
                $success = false;
                Yii::$app->session->addFlash('error', "Wrong data: '{$r}': " . VarDumper::dumpAsString($row));
            }
        }
        return $success;
    }

    /**
     * @param $number
     * @return Sims|string
     */
    public static function getByNumberAndCheckSlot($number)
    {
        $numbers = [$number];
        if (substr($number, 0, 1) == '+') {
            $numbers[] = substr($number, 1, strlen($number));
        } else {
            $numbers[] = '+' . $number;
        }
        $sim = Sims::findOne(['number' => $numbers]);
        if (empty($sim)) {
            return "Sim for number {$number} not found!";
        }
        if (empty($sim->slot)) {
            return "Sim for number {$number}, id {$sim->id} not connected to slot!";
        }
        return $sim;
    }

}
