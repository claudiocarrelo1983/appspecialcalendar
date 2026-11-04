<?php
// Exercise the actual workspace model with a fixed UTC clock and no database.
namespace yii\db {
    class ActiveRecord {
        public $start_time,$end_time,$break_start_time;
        public $break_minutes=0,$pause_minutes=0,$total_minutes=0,$overtime_minutes=0,$scheduled_minutes=0;
        public function hasAttribute($name){return property_exists($this,$name);}
    }
}
namespace common\models {
    function gmdate($format){return '2026-11-03 10:18:00';}
}
namespace {
    date_default_timezone_set('Europe/Lisbon');
    require is_file(__DIR__.'/../common/models/Timesheet.php') ? __DIR__.'/../common/models/Timesheet.php' : 'C:/inetpub/wwwroot/workspace/common/models/Timesheet.php';
    use common\models\Timesheet;
    $checks=0;
    $check=static function($actual,$expected,$label)use(&$checks){$checks++;if($actual!==$expected)throw new \RuntimeException($label.': expected '.$expected.', got '.$actual);};
    $cases=[
        ['new clock-in','2026-11-03 10:18:00',null,0,0,null,true,0],
        ['one second elapsed','2026-11-03 10:17:59',null,0,0,null,true,0],
        ['one hour elapsed','2026-11-03 09:18:00',null,0,0,null,true,60],
        ['future running clock-in','2026-11-03 10:19:00',null,0,0,null,true,0],
        ['reversed closed datetimes','2026-11-03 10:18:00','2026-11-03 09:18:00',0,0,null,true,0],
        ['equal closed datetimes','2026-11-03 10:18:00','2026-11-03 10:18:00',0,0,null,true,0],
        ['closed work with breaks','2026-11-03 08:00:00','2026-11-03 10:00:00',15,5,null,true,100],
        ['active break','2026-11-03 09:18:00',null,0,0,'2026-11-03 09:48:00',true,30],
        ['active plus completed break','2026-11-03 09:18:00',null,10,5,'2026-11-03 09:48:00',true,15],
        ['partial active break rounds up','2026-11-03 09:18:00',null,0,0,'2026-11-03 10:17:30',true,59],
        ['future break does not add time','2026-11-03 09:18:00',null,0,0,'2026-11-03 10:19:00',true,60],
        ['break before shift is bounded','2026-11-03 09:18:00',null,0,0,'2026-11-02 09:00:00',true,0],
        ['running excluded from final totals','2026-11-03 09:18:00',null,0,0,null,false,0],
        ['negative break values ignored','2026-11-03 09:18:00',null,-10,-5,null,true,60],
        ['breaks cannot make negative work','2026-11-03 09:18:00',null,90,0,null,true,0],
        ['dated overnight shift','2026-11-02 22:00:00','2026-11-03 06:00:00',30,0,null,true,450],
        ['real full-day shift','2026-11-02 10:18:00','2026-11-03 10:18:00',0,0,null,true,1440],
        ['missing start',null,null,0,0,null,true,0],
        ['invalid start','invalid',null,0,0,null,true,0],
        ['invalid end','2026-11-03 09:18:00','invalid',0,0,null,true,0],
        ['summer DST overnight UTC','2026-03-29 00:30:00','2026-03-29 02:30:00',0,0,null,true,120],
        ['winter DST overnight UTC','2026-10-25 00:30:00','2026-10-25 02:30:00',0,0,null,true,120],
    ];
    foreach($cases as [$name,$start,$end,$break,$pause,$active,$running,$expected]){
        $row=new Timesheet();$row->start_time=$start;$row->end_time=$end;$row->break_minutes=$break;$row->pause_minutes=$pause;$row->break_start_time=$active;
        $check($row->actualWorkedMinutes($running),$expected,$name);
    }
    $row=new Timesheet();$row->start_time='2026-11-03 09:18:00';$row->break_start_time='2026-11-03 09:48:00';
    $check($row->actualWorkedMinutes(),30,'running pause');
    $check($row->break_minutes,0,'display must not mutate completed breaks');
    $row->break_minutes=30;$row->break_start_time=null;$row->end_time='2026-11-03 10:18:00';
    $check($row->actualWorkedMinutes(),30,'ending break does not deduct twice');
    $row->calculateTotals(20);$check($row->total_minutes,30,'persisted total calculation');$check($row->overtime_minutes,10,'overtime calculation');
    echo "Timesheet worked minutes: $checks checks passed. No database connection or attendance writes.\n";
}
