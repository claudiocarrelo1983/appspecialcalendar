<?php
// Real server route selection, synthetic identities and SQLite memory only.
require __DIR__.'/gym-team-active-company.test.php';
Yii::setAlias('@frontend',$workspace.'/frontend');
$db->createCommand()->update('company',['active'=>1])->execute();
$controller=new frontend\controllers\SiteController('site',Yii::$app);
$method=new ReflectionMethod($controller,'postLoginRoute');$method->setAccessible(true);
$id=110;
foreach(['FTX','DEMO']as$company)foreach(['client','team','admin']as$role){
 account($id++,$company,$role);
 $route=$method->invoke($controller,'login');
 expect($route===[$role==='client'?'/dashboard-gym-client/index':'/dashboard-gym/index'],$company.' '.$role.' uses its expected dashboard');
}
Yii::$app->user->setIdentity(null);
expect($method->invoke($controller,'login')===['/site/login'],'Guest stays on login');
echo "Server login routing passed for Member, Team and Admin in FTX and Demo.\n";

// Probe the current workspace API with the real ActiveCompany service, rather
// than the obsolete SavedScopeCompany stub in the legacy deployment fixture.
class CurrentMemberScopeProbe extends frontend\controllers\api\v1\NativeGymController {public function memberScope(){return $this->scope();}}
$db->createCommand()->addColumn('company','company_code_url','string')->execute();
$db->createCommand()->addColumn('company','company_name','string')->execute();
$probe=new CurrentMemberScopeProbe('native-gym',Yii::$app);
foreach(['FTX'=>'c20260531125358085','DEMO'=>'c20261027151705426']as$company=>$code){
 $db->createCommand()->update('company',['company_code_url'=>$code],['company_code'=>$company])->execute();
 Yii::$app->request->setHostInfo('https://'.$code.'.specialcalendar.com');
 account($id++,$company,'client');
 $db->createCommand()->insert('company_user_membership',['user_id'=>Yii::$app->user->id,'company_code'=>$company,'role'=>'client','status'=>'approved','is_primary'=>1,'access_start'=>date('Y-m-d',strtotime('-1 day'))])->execute();
 Yii::$app->activeCompany->reset();
 [$member,$scopeCompany]=$probe->memberScope();
 expect($scopeCompany->company_code===$company,'Current Member API resolves its own company');
 foreach(['team','admin']as$role){
  account($id++,$company,$role);$denied=false;
  try{$probe->memberScope();}catch(yii\web\ForbiddenHttpException $failure){$denied=true;}
  expect($denied,'Staff cannot enter Member-only API: '.$role);
 }
}
echo "Current Member API scope and staff separation passed for FTX and Demo.\n";
