<?php
define('YII_ENABLE_ERROR_HANDLER',false);
$server=$argv[1]??'C:/inetpub/wwwroot/workspace';
require $server.'/vendor/autoload.php';require $server.'/vendor/yiisoft/yii2/Yii.php';
Yii::setAlias('@common',$server.'/common');Yii::setAlias('@frontend',$server.'/frontend');
new yii\web\Application(['id'=>'native-client-schedule-test','basePath'=>__DIR__,'timeZone'=>'Europe/Lisbon','components'=>[
 'db'=>['class'=>yii\db\Connection::class,'dsn'=>'sqlite::memory:'],
 'request'=>['hostInfo'=>'https://c20260531125358085.specialcalendar.com','scriptUrl'=>'/index.php'],
 'urlManager'=>['enablePrettyUrl'=>true,'showScriptName'=>false],
 'user'=>['identityClass'=>common\models\User::class,'enableSession'=>false],
]]);
Yii::$app->db->createCommand('CREATE TABLE company(company_code TEXT PRIMARY KEY, company_code_url TEXT, active INTEGER)')->execute();
function nativeClientCheck($condition,$message){if(!$condition)throw new RuntimeException($message);}
use common\helpers\NativeClientBookings as NativeSchedule;
nativeClientCheck(NativeSchedule::validDate('2028-02-29')&&!NativeSchedule::validDate('2026-02-29')&&!NativeSchedule::validDate('2026-02-31')&&!NativeSchedule::validDate(['date']),'Strict calendar date validation');
$schedule=new class {
 public $id=7,$description='Class details';
 public function occurrenceStartTime($date){return '09:00:00';}public function occurrenceEndTime($date){return '10:30:00';}public function occurrenceRoom($date){return '';}
 public function dateOverride($date){return null;}
};
$class=(object)['code'=>'muay','name'=>'Muay Thai','description'=>'Class details','max_capacity'=>20,'instructor'=>(object)['full_name'=>'Coach']];
$client=(object)['guid'=>'managed-child','id'=>1619,'full_name'=>'Managed child','password_hash'=>'must-not-leak','auth_key'=>'must-not-leak'];
$data=['companyCode'=>'ftx','client'=>$client,'classes'=>[['class'=>$class,'schedule'=>$schedule,'date'=>'2020-01-01','booking'=>null,'waitlist'=>null,'booking_closed'=>true,'booking_not_open'=>false,'booking_opens_at'=>null,'booking_closes_at'=>null,'available'=>12,'booked'=>8,'participants'=>[]]],'kpis'=>['outstanding_balance'=>12.5],'waivers'=>['pending'=>[(object)['code'=>'terms','title'=>'Terms','content'=>'<p>Read this</p><p>Then agree</p>']]],'upcomingBookings'=>[],'classHistory'=>[]];
$dto=NativeSchedule::build($data,'2020-01-01',[(object)['guid'=>'managed-child','full_name'=>'Child']]);
nativeClientCheck($dto['clientGuid']==='managed-child'&&$dto['companyCode']==='ftx','Managed client and company remain explicit');
nativeClientCheck($dto['rows'][0]['status']==='finished'&&$dto['rows'][0]['actions']===[],'Past closed class cannot offer a booking action');
nativeClientCheck($dto['rows'][0]['calendarEvent']['startDate']==='2020-01-01T09:00:00Z','Calendar uses server club timezone');
nativeClientCheck($dto['classFilters'][0]['code']==='muay'&&$dto['waivers'][0]['content']==="Read this\nThen agree\n",'Filter identity and complete readable contract text retained');
nativeClientCheck(!str_contains(json_encode($dto),'must-not-leak')&&!str_contains(json_encode($dto),'password_hash'),'Only explicit DTO fields are serialized');
nativeClientCheck($dto['member']['name']==='Managed child'&&$dto['member']['number']===1619&&$dto['member']['status']==='inactive','Member summary follows the authorized selected client without inventing active membership');
$data['upcomingBookings']=[(object)['id'=>2,'gymClass'=>$class,'booking_date'=>'2027-01-01','start_datetime'=>'2027-01-01 09:00:00','booking_status'=>'booked']];
$data['classHistory']=[(object)['id'=>1,'gymClass'=>$class,'booking_date'=>'2020-01-01','start_datetime'=>'2020-01-01 09:00:00','booking_status'=>'attended']];
$dto=NativeSchedule::build($data,'2020-01-01',[]);
nativeClientCheck(array_column($dto['upcomingBookings'],'id')===[2]&&array_column($dto['bookingHistory'],'id')===[1],'Upcoming and history remain separate server-authorized lists');
// An earlier legacy rule must not capture native transport URLs.
Yii::$app->controllerNamespace='frontend\\controllers';
Yii::$app->urlManager->enablePrettyUrl=true;
Yii::$app->urlManager->addRules(['dashboard-gym-client/<action:[a-z-]+>'=>'site/error'],false);
(new common\components\MobilePushBootstrap())->bootstrap(Yii::$app);
foreach(['native-schedule','book','cancel-booking','join-waitlist','leave-waitlist','booking-alert','sign-waiver','start-stripe-payment','refresh-stripe-payment'] as $action) {
 $request=new yii\web\Request(['hostInfo'=>'https://c20260531125358085.specialcalendar.com','scriptUrl'=>'/index.php']);
 $request->setPathInfo('dashboard-gym-client/'.$action);
 $resolved=Yii::$app->urlManager->parseRequest($request);
 nativeClientCheck($resolved[0]==='dashboard-gym-client/'.$action,'Native transport route takes precedence: '.$action);
 $controller=Yii::$app->createController($resolved[0]);
 nativeClientCheck($controller&&$controller[0]->createAction($controller[1])!==null,'Packaged native action exists: '.$action);
}
echo "Native client schedule date, identity, closed-class, calendar, waiver and privacy checks passed.\n";
