<?php
// Real Yii models and resolver, SQLite memory only. Never loads production DB config.
define('YII_ENABLE_ERROR_HANDLER', false);
$workspace = $argv[1] ?? 'C:/inetpub/wwwroot/workspace';
require $workspace . '/vendor/autoload.php';
require $workspace . '/vendor/yiisoft/yii2/Yii.php';
require $workspace . '/common/config/bootstrap.php';
class MemoryCompanySession extends yii\base\Component {
    private $values = [];
    public function get($key) { return $this->values[$key] ?? null; }
    public function set($key, $value) { $this->values[$key] = $value; }
    public function remove($key) { unset($this->values[$key]); }
}
new yii\web\Application(['id'=>'gym-team-company-test','basePath'=>$workspace.'/frontend',
 'runtimePath'=>sys_get_temp_dir().'/gym-team-scope-'.getmypid(), 'components'=>[
 'db'=>['class'=>yii\db\Connection::class,'dsn'=>'sqlite::memory:'],
 'user'=>['class'=>yii\web\User::class,'identityClass'=>common\models\User::class,'enableSession'=>false],
 'session'=>['class'=>MemoryCompanySession::class],
 'request'=>['cookieValidationKey'=>'test','scriptFile'=>__FILE__,'scriptUrl'=>'/index.php'],
 'activeCompany'=>['class'=>common\components\ActiveCompany::class],
 'i18n'=>['translations'=>['app'=>['class'=>yii\i18n\PhpMessageSource::class,'basePath'=>'@common/messages','fileMap'=>['app'=>'supplemental.php']]]],
 ]]);
$db=Yii::$app->db;
foreach ([
 'company'=>'id INTEGER PRIMARY KEY, company_code TEXT, active INTEGER',
 'company_plan'=>'id INTEGER PRIMARY KEY, company_code TEXT, plan_name TEXT, active INTEGER',
 'user'=>'id INTEGER PRIMARY KEY, guid TEXT, company_code TEXT, level TEXT, active INTEGER, status INTEGER',
 'company_user_membership'=>'id INTEGER PRIMARY KEY, user_id INTEGER, company_code TEXT, role TEXT, status TEXT, access_start TEXT, access_expires TEXT, is_primary INTEGER, approved_date TEXT, permissions TEXT',
 'user_roles_permissions'=>'id INTEGER PRIMARY KEY, company_code TEXT, company TEXT, level TEXT, permissions TEXT',
] as $table=>$columns) $db->createCommand("CREATE TABLE $table ($columns)")->execute();
foreach (['FTX'=>'gym','DEMO'=>'gym','HOTEL'=>'hotel','BASIC'=>'basic'] as $code=>$plan) {
 $db->createCommand()->insert('company',['company_code'=>$code,'active'=>1])->execute();
 $db->createCommand()->insert('company_plan',['company_code'=>$code,'plan_name'=>$plan,'active'=>1])->execute();
}
$checks=0;
function expect($ok,$message) {global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function account($id,$company,$level='team',$active=1,$status=10) {
 Yii::$app->db->createCommand()->insert('user',['id'=>$id,'guid'=>'test-'.$id,'company_code'=>$company,'level'=>$level,'active'=>$active,'status'=>$status])->execute();
 Yii::$app->user->setIdentity(common\models\User::findOne($id));Yii::$app->activeCompany->reset();
}
function denied() {try {common\helpers\SecurityAccess::companyCode();return false;}catch(yii\web\ForbiddenHttpException $error){return true;}}
foreach (['FTX','DEMO'] as $i=>$company) {
 account($i+1,$company);
 expect(common\helpers\SecurityAccess::companyCode()===$company,'Legacy gym Team must resolve its own company: '.$company);
 Yii::$app->session->set('active_company_code',$company==='FTX'?'DEMO':'FTX');Yii::$app->activeCompany->reset();
 expect(common\helpers\SecurityAccess::companyCode()===$company,'Session must not select another company');
 expect(!Yii::$app->activeCompany->can('company_access_manage'),'Team must not gain company management');
 $db->createCommand()->insert('user_roles_permissions',['company_code'=>$company,'company'=>'specialcalendar','level'=>'team','permissions'=>'t-classes-schedule,t-members-attendance'])->execute();
 expect(Yii::$app->activeCompany->can('t-classes-schedule'),'Existing granted Team permission must work');
 expect(!Yii::$app->activeCompany->can('billing-manage'),'Missing permission must remain denied');
}
foreach (['revoked','rejected','pending','expired','approved'] as $i=>$status) {
 account(10+$i,'FTX');
 $db->createCommand()->insert('company_user_membership',['user_id'=>10+$i,'company_code'=>'FTX','role'=>'team','status'=>$status,'is_primary'=>1,'access_start'=>'2020-01-01','access_expires'=>'2020-01-02'])->execute();
 expect(denied(),'Explicit denied/expired membership must not fall back: '.$status);
}
account(20,'FTX');
$db->createCommand()->insert('company_user_membership',['user_id'=>20,'company_code'=>'DEMO','role'=>'team','status'=>'approved','is_primary'=>1,'access_start'=>'2020-01-01','access_expires'=>'2099-01-01','permissions'=>'["t-members-attendance"]'])->execute();
expect(common\helpers\SecurityAccess::companyCode()==='DEMO','Approved membership continues to select its authorized company');
expect(Yii::$app->activeCompany->can('t-members-attendance'),'Approved membership permissions retained');
expect(!Yii::$app->activeCompany->can('billing-manage'),'Approved membership does not gain permission');
foreach ([['FTX','client',1,10],['FTX','team',0,10],['FTX','team',1,0],['BASIC','team',1,10],['FTX','cleaner',1,10]] as $i=>$values) {
 account(30+$i,...$values);expect(denied(),'Invalid gym identity must remain denied');
}
account(40,'HOTEL','cleaner');expect(common\helpers\SecurityAccess::companyCode()==='HOTEL','Existing hotel legacy access retained');
account(41,'FTX','admin');expect(common\helpers\SecurityAccess::companyCode()==='FTX','Legacy gym admin own-company access');
$db->createCommand()->update('company',['active'=>0],['company_code'=>'FTX'])->execute();account(42,'FTX');expect(denied(),'Inactive company remains denied');
Yii::$app->user->setIdentity(null);Yii::$app->activeCompany->reset();expect(denied(),'Guest remains denied');
echo "Gym Team active-company checks passed: $checks. No production records changed.\n";
