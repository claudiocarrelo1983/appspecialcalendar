<?php

namespace common\models;

use Yii;

/**
 * This is the model class for table "hotel_operations".
 *
 * @property int $id
 * @property string|null $guid
 * @property string|null $company_code
 * @property string|null $company
 * @property string|null $module
 * @property string|null $type
 * @property string|null $priority
 * @property string|null $status
 * @property string|null $room_location
 * @property string|null $guest_name
 * @property int|null $assigned_to
 * @property string|null $title
 * @property string|null $description
 * @property string|null $image
 * @property string|null $notes
 * @property string|null $reported_by
 * @property string|null $task_date
 * @property string|null $task_time
 * @property string|null $resolved_date
 * @property string|null $created_date
 * @property string|null $updated_date
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property int|null $active
 */
class HotelOperations extends \yii\db\ActiveRecord
{
    public $imageFile;

    public function beforeSave($insert)
    {
        if (!parent::beforeSave($insert)) return false;
        if ($this->type === 'task') {
            // A submitted empty date must not override the database timestamp default.
            $this->created_date = $insert ? date('Y-m-d H:i:s') : $this->getOldAttribute('created_date');
        }
        return true;
    }

    public function afterSave($insert, $changedAttributes)
    {
        parent::afterSave($insert, $changedAttributes);
        \common\helpers\TaskAssignmentNotifications::assigned($this, $insert, $changedAttributes);
    }

    public function validateTaskAssignee($attribute)
    {
        if ($this->type === 'task' && !\common\helpers\TaskAssignmentNotifications::recipient($this->$attribute, $this->company_code)) {
            $this->addError($attribute, Yii::t('app', 'task_assignee_invalid'));
        }
    }


    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'hotel_operations';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['operation_code', 'company_code', 'type', 'room_location', 'guest_name', 'assigned_to', 'title', 'room_code', 'notes', 'image', 'reported_by', 'task_date', 'task_time', 'resolved_date', 'created_date', 'created_by'], 'default', 'value' => null],
            [['priority'], 'default', 'value' => 'medium'],
            [['status'], 'default', 'value' => 'open'],
            [['active'], 'default', 'value' => 1],
            [[ 'created_by', 'active'], 'integer'],
            [['assigned_to', 'notes'], 'string'],
            ['assigned_to', 'validateTaskAssignee'],
            [['title', 'assigned_to','priority', 'task_date', 'task_time'], 'required'],
            
            [['task_date', 'task_time', 'resolved_date', 'created_date'], 'safe'],
            [['operation_code', 'company_code',  'room_location', 'guest_name', 'title', 'image', 'reported_by','room_number'], 'string', 'max' => 255],
            [['type', 'priority', 'status'], 'string', 'max' => 100],
            [['imageFile'], 'file', 'skipOnEmpty' => true, 'extensions' => ['jpg', 'jpeg', 'png', 'webp'], 'checkExtensionByMimeType' => true, 'maxSize' => 4194304],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'guid' => 'Guid',
            'company_code' => 'Company Code',
            'company' => 'Company',
            'type' => 'Type',
            'priority' => 'Priority',
            'status' => 'Status',
            'room_location' => 'Room Location',
            'guest_name' => 'Guest Name',
            'assigned_to' => 'Assigned To',
            'title' => 'Title',
            'image' => 'Image',
            'imageFile' => 'Image',
            'notes' => 'Notes',
            'reported_by' => 'Reported By',
            'task_date' => 'Task Date',
            'task_time' => 'Task Time',
            'resolved_date' => 'Resolved Date',
            'created_date' => 'Created Date',
            'updated_date' => 'Updated Date',
            'created_by' => 'Created By',
            'updated_by' => 'Updated By',
            'active' => 'Active',
        ];
    }

}
