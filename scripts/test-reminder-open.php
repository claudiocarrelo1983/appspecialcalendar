<?php
namespace common\models {
    class MobilePushCompanySettings {
        public static function findOne($where) { return (object)['timezone'=>'UTC','reminder_minutes'=>2]; }
    }
    class MobileClassReminder {
        public $user_id=1,$company_code='demo',$booking_type='group_schedule',$booking_id=7,$starts_at;
    }
    class GymClassSchedule {
        public static $schedule;
        public static function findOne($where) { return self::$schedule; }
    }
}
namespace {
    require 'C:/inetpub/wwwroot/workspace/common/helpers/ClassReminderService.php';
    $schedule=new class {
        public $id=7,$company_code='demo',$active=1,$gymClass;
        public function occurrenceStartTime($date) { return '18:10:00'; }
        public function occurrenceEndDateTime($date) { return $date.' 19:10:00'; }
        public function isAvailableOn($date) { return true; }
    };
    $schedule->gymClass=(object)['active'=>1,'name'=>'HIIT'];
    \common\models\GymClassSchedule::$schedule=$schedule;
    $delivery=new \common\models\MobileClassReminder();
    $delivery->starts_at=strtotime('2026-11-01 18:10:00 UTC');
    foreach(['scheduled'=>'18:08','in_progress'=>'18:11','finished'=>'19:11'] as $state=>$time){
        $info=\common\helpers\ClassReminderService::openedInformation($delivery,null,strtotime('2026-11-01 '.$time.' UTC'));
        if($info['state']!==$state||($info['route']['schedule_id']??null)!==7||$info['route']['date']!=='2026-11-01'||$info['actionable'])throw new \RuntimeException('Reminder detail route failed: '.$state);
    }
    $schedule->active=0;
    $info=\common\helpers\ClassReminderService::openedInformation($delivery,null,strtotime('2026-11-01 18:11 UTC'));
    if(isset($info['route'])||$info['actionable'])throw new \RuntimeException('Unavailable class must not receive an actionable link');
    echo "Reminder links before start, in progress, after finish and unavailable-class checks passed.\n";
}
