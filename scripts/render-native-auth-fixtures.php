<?php
// Render real workspace forms with empty models. No accounts, email or login requests.
define('YII_ENABLE_ERROR_HANDLER',false);define('YII_ENV','test');
$root='C:/inetpub/wwwroot/workspace';
require $root.'/vendor/autoload.php';require $root.'/vendor/yiisoft/yii2/Yii.php';
require $root.'/common/config/bootstrap.php';require $root.'/frontend/config/bootstrap.php';
$config=yii\helpers\ArrayHelper::merge(require $root.'/common/config/main.php',require $root.'/common/config/main-local.php',require $root.'/frontend/config/main.php',require $root.'/frontend/config/main-local.php');
if(!preg_match('/host=(localhost|127\.0\.0\.1)(;|$)/',$config['components']['db']['dsn']??''))throw new RuntimeException('Only local fixture rendering is allowed');
$config['components']['request']=['class'=>yii\web\Request::class,'scriptFile'=>$root.'/frontend/web/index.php','scriptUrl'=>'/index.php','hostInfo'=>'http://localhost','url'=>'/login','cookieValidationKey'=>'native-auth-fixture'];
$config['components']['session']=['class'=>yii\web\Session::class,'useCookies'=>false,'savePath'=>sys_get_temp_dir()];
$config['components']['user']['enableAutoLogin']=false;
$app=new yii\web\Application($config);
$directory=dirname(__DIR__).'/build/auth-fixtures';@mkdir($directory,0777,true);
$controller=new yii\web\Controller('site',$app);$app->controller=$controller;$count=0;
foreach(['ftx'=>'c20260531125358085','demo'=>'c20261027151705426'] as $brand=>$pagecode){
    $company=common\models\Company::find()->where(['company_code_url'=>$pagecode,'active'=>1])->asArray()->one();
    if(!$company){echo "Skipped local fixture for ".$brand.": company is not in this local database.\n";continue;}
    $app->request->setHostInfo('https://'.$pagecode.'.specialcalendar.com');
    $app->request->setQueryParams(['pagecode'=>$pagecode]);
    $locations=common\models\CompanyLocations::find()->where(['company_code'=>$company['company_code'],'active'=>1])->all();$options=[];
    foreach($locations as $location)$options[$location->location_code]=$location->location_code;
    $models=[
        'login'=>['client/login/login_client.php',new common\models\LoginForm()],
        'register'=>['form-signup/index.php',new frontend\models\FormSignupClientForm(['company_code'=>$company['company_code'],'company_code_url'=>$pagecode,'signup_level'=>'client','client_category'=>'gym'])],
        'forgot'=>['client/login/requestPasswordResetToken.php',new frontend\models\PasswordResetRequestForm()],
    ];
    foreach($models as $kind=>[$view,$model]){
        $app->request->setUrl(($kind==='register'?'/form-signup':($kind==='forgot'?'/site/request-password-reset':'/login')).'?pagecode='.$pagecode);
        $html=$app->view->renderFile($root.'/frontend/views/'.$view,['model'=>$model,'companyArr'=>$company,'company'=>$pagecode,'pagecode'=>$pagecode,'myData'=>[],'signupLevel'=>'client','isGymSignup'=>true,'locationOptions'=>$options,'visitorCountryCode'=>'PT']);
        file_put_contents($directory.'/'.$brand.'-'.$kind.'.html',$html);
        $count++;
    }
}
if($app->session->getIsActive())$app->session->destroy();
echo "Rendered $count real company authentication form fixtures; no accounts or email requests.\n";
