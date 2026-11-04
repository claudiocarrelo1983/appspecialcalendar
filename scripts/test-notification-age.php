<?php
define('YII_ENABLE_ERROR_HANDLER',false);
$root='C:/inetpub/wwwroot/workspace';
require $root.'/vendor/autoload.php';require $root.'/vendor/yiisoft/yii2/Yii.php';
Yii::setAlias('@common',$root.'/common');
new yii\console\Application(['id'=>'notification-age-test','basePath'=>__DIR__,'components'=>[
    'db'=>['class'=>yii\db\Connection::class,'dsn'=>'sqlite::memory:'],
]]);
$db=Yii::$app->db;
$db->createCommand('CREATE TABLE company_notification (id INTEGER PRIMARY KEY, company_code TEXT, created_at INTEGER)')->execute();
$db->createCommand('CREATE TABLE company_notification_recipient (id INTEGER PRIMARY KEY, notification_id INTEGER, company_code TEXT, user_id INTEGER, read_at INTEGER)')->execute();
$now=1800000000;$cutoff=$now-15*86400;
foreach([[1,'demo',$now],[2,'demo',$cutoff],[3,'demo',$cutoff-1],[4,'ftx',$now],[5,'demo',$now]] as $row){
    $db->createCommand()->insert('company_notification',['id'=>$row[0],'company_code'=>$row[1],'created_at'=>$row[2]])->execute();
    $db->createCommand()->insert('company_notification_recipient',['id'=>$row[0],'notification_id'=>$row[0],'company_code'=>$row[1],'user_id'=>$row[0]===5?2:1,'read_at'=>null])->execute();
}
$query=common\helpers\CompanyNotificationService::inbox('demo',1,$now);
$ids=array_map('intval',(clone $query)->select('notification_id')->column());
if($ids!==[1,2])throw new RuntimeException('Creation ordering, age boundary or recipient/company isolation failed');
if((int)(clone $query)->andWhere(['read_at'=>null])->count()!==2)throw new RuntimeException('Unread badge includes expired notifications');
if((int)(clone $query)->offset(1)->limit(1)->select('notification_id')->scalar()!==2)throw new RuntimeException('Ordering/filtering must precede pagination');
if((int)$db->createCommand('SELECT COUNT(*) FROM company_notification')->queryScalar()!==5)throw new RuntimeException('History must be preserved');
$groupNotices=[(object)['notification'=>(object)['created_at'=>strtotime('2026-11-01 10:00:00')],'notification_id'=>100]];
$tasks=[['id'=>1,'created_date'=>'2026-11-01 12:00:00','task_date'=>'2026-10-01']];
$notifications=[['id'=>50,'created_date'=>'2026-11-01 11:00:00']];
$source=file_get_contents($root.'/frontend/views/admin/notifications.php');
$start=strpos($source,'    $notificationFeed=[];');$end=strpos($source,'?>',$start);
if($start===false||$end===false)throw new RuntimeException('Mixed feed missing');
eval(substr($source,$start,$end-$start));
if(array_column($notificationFeed,'type')!==['task','message','notice'])throw new RuntimeException('Tasks and notices must be interleaved by creation time, not due date or ID');
echo "Notification age, mixed creation ordering, scope, unread count, pagination and history preservation checks passed.\n";
