<?php
define('YII_ENABLE_ERROR_HANDLER',false);
$server=$argv[1]??'C:/inetpub/wwwroot/workspace';
$implementation=$argv[2]??__DIR__.'/../deployment/class-invitations';
require $server.'/vendor/autoload.php';require $server.'/vendor/yiisoft/yii2/Yii.php';
Yii::setAlias('@common',$server.'/common');
require $implementation.'/common/helpers/ClassInvitations.php';
require $implementation.'/common/helpers/CompanyNotificationService.php';
new yii\web\Application(['id'=>'invitations-test','basePath'=>__DIR__,'components'=>['db'=>['class'=>yii\db\Connection::class,'dsn'=>'sqlite::memory:']]]);
$user=new class extends yii\base\Component { public $isGuest=false;public $id=1;public $identity; };
$user->identity=(object)['level'=>'admin','company_code'=>'ftx','full_name'=>'Coach','username'=>'coach'];Yii::$app->set('user',$user);
$db=Yii::$app->db;
foreach([
'CREATE TABLE user(id INTEGER PRIMARY KEY, full_name TEXT,first_name TEXT,last_name TEXT,username TEXT,company_code TEXT,company_code_parent TEXT,active INTEGER,status INTEGER,level TEXT)',
'CREATE TABLE gym_classes(code TEXT,company_code TEXT,name TEXT,active INTEGER,PRIMARY KEY(code,company_code))',
'CREATE TABLE company(company_code TEXT PRIMARY KEY,company_code_url TEXT,active INTEGER)',
'CREATE TABLE gym_classes_schedule(id INTEGER PRIMARY KEY,company_code TEXT,class_code TEXT,active INTEGER,day_of_week INTEGER,recurrence_type TEXT,start_time TEXT,end_time TEXT)',
'CREATE TABLE company_notification(id INTEGER PRIMARY KEY AUTOINCREMENT,company_code TEXT,created_by INTEGER,submission_key TEXT UNIQUE,title TEXT,body TEXT,recipient_mode TEXT,selection TEXT,recipient_count INTEGER,created_at INTEGER)',
'CREATE TABLE company_notification_recipient(id INTEGER PRIMARY KEY AUTOINCREMENT,notification_id INTEGER,company_code TEXT,user_id INTEGER,push_status TEXT,next_attempt_at INTEGER,updated_at INTEGER)',
] as $sql)$db->createCommand($sql)->execute();
foreach([[1,'Coach','ftx','admin',1],[2,'Alice','ftx','client',1],[3,'Other club','demo','client',1],[4,'Inactive','ftx','client',0],[5,'Trainer','ftx','coach',1]] as [$id,$name,$company,$level,$active])$db->createCommand()->insert('user',['id'=>$id,'full_name'=>$name,'username'=>$name,'company_code'=>$company,'level'=>$level,'active'=>$active,'status'=>10])->execute();
$db->createCommand()->insert('gym_classes',['code'=>'muay','company_code'=>'ftx','name'=>'Muay Thai','active'=>1])->execute();
$db->createCommand()->insert('gym_classes_schedule',['id'=>7,'company_code'=>'ftx','class_code'=>'muay','active'=>1,'day_of_week'=>0,'recurrence_type'=>'daily','start_time'=>'10:00','end_time'=>'11:00'])->execute();
function invitationCheck($value,$message){if(!$value)throw new RuntimeException($message);}
use common\helpers\ClassInvitations as Invitations;
$date=(new DateTimeImmutable('tomorrow'))->format('Y-m-d');$token='11111111-1111-4111-8111-111111111111';
$db->createCommand()->insert('company',['company_code'=>'ftx','company_code_url'=>'c20260531125358085','active'=>1])->execute();
invitationCheck(Invitations::companyForHost('c20260531125358085.specialcalendar.com','demo')==='ftx','Company app host overrides a different session company');
invitationCheck(Invitations::companyForHost('specialcalendar.com','demo')==='demo','Main website retains authorized session company');
invitationCheck(array_map('intval',Invitations::clients('ftx')->select('recipient.id')->column())===[2],'Directory isolates active company clients');
$db->createCommand()->update('user',['full_name'=>'','first_name'=>'Alice','last_name'=>'Silva'],['id'=>2])->execute();
foreach(['Alice','Silva','Alice Silva','Silva Alice'] as $q){
    $matches=Invitations::searchClients('ftx',$q)->all();
    invitationCheck(count($matches)===1&&(int)$matches[0]->id===2&&Invitations::clientName($matches[0])==='Alice Silva','Search finds split names and displays them');
}
invitationCheck(Invitations::searchClients('ftx','Other club')->count()==0,'Search cannot reveal another company');
invitationCheck(Invitations::searchClients('ftx','Inactive')->count()==0,'Search cannot reveal inactive accounts');
$notice=Invitations::send('ftx',7,$date,2,$token);
invitationCheck($notice->recipient_count===1,'Exactly one selected recipient');
invitationCheck(array_map('intval',$db->createCommand('SELECT user_id FROM company_notification_recipient')->queryColumn())===[2],'Only selected client receives invitation');
invitationCheck(str_contains(Invitations::bookingPath($notice),'schedule_id=7')&&str_contains(Invitations::bookingPath($notice),'company_code=ftx'),'Push targets exact class and company');
invitationCheck(Invitations::send('ftx',7,$date,2,$token)->id===$notice->id,'Retry does not create duplicate invitation');
invitationCheck($db->createCommand('SELECT COUNT(*) FROM company_notification')->queryScalar()==1,'No duplicate notice');
foreach([3,4,5] as $recipient){try{Invitations::send('ftx',7,$date,$recipient,$token);throw new RuntimeException('Recipient accepted');}catch(yii\web\ForbiddenHttpException $expected){}}
try{Invitations::send('ftx',7,'2026-02-31',2,$token);throw new RuntimeException('Invalid date accepted');}catch(yii\web\BadRequestHttpException $expected){}
require $implementation.'/frontend/controllers/ClassInvitationsController.php';
$controller=new frontend\controllers\ClassInvitationsController('class-invitations',Yii::$app);
$companyProperty=new ReflectionProperty($controller,'company');$companyProperty->setAccessible(true);$companyProperty->setValue($controller,'ftx');
Yii::$app->request->setBodyParams(['schedule_id'=>7,'date'=>'2020-01-01','recipient_id'=>2,'token'=>$token]);
$response=$controller->actionSend();
invitationCheck($response->statusCode===409&&$response->data['reason']==='class_started','Past class returns explicit JSON reason');
invitationCheck($db->createCommand('SELECT COUNT(*) FROM company_notification')->queryScalar()==1,'Past class sends no invitation');
$db->createCommand()->insert('user',['id'=>6,'full_name'=>'Bob','username'=>'bob','company_code'=>'ftx','level'=>'client','active'=>1,'status'=>10])->execute();
$user->id=2;$user->identity->level='client';
invitationCheck(!Invitations::clients('ftx')->andWhere(['recipient.id'=>2])->exists(),'Sender is excluded from recipients');
invitationCheck(Invitations::send('ftx',7,$date,6,$token)->created_by===2,'Clients can invite a company peer');
try{common\helpers\CompanyNotificationService::create(new common\models\CompanyNotificationForm(),'ftx');throw new RuntimeException('Client gained bulk notification permission');}catch(yii\web\ForbiddenHttpException $expected){}
$user->id=5;$user->identity->level='coach';
invitationCheck(Invitations::send('ftx',7,$date,2,$token)->created_by===5,'Other active levels can share');
$user->id=3;$user->identity->company_code='demo';
try{Invitations::send('ftx',7,$date,2,$token);throw new RuntimeException('Cross-company sender accepted');}catch(yii\web\ForbiddenHttpException $expected){}
$user->id=4;$user->identity->company_code='ftx';
try{Invitations::send('ftx',7,$date,2,$token);throw new RuntimeException('Inactive sender accepted');}catch(yii\web\ForbiddenHttpException $expected){}
echo "Class invitation company isolation, recipients, idempotency, permissions and booking URL checks passed.\n";
