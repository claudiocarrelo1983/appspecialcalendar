<?php
define('YII_ENABLE_ERROR_HANDLER', false);
$server=$argv[1]??'C:/inetpub/wwwroot/workspace';
require $server.'/vendor/autoload.php';require $server.'/vendor/yiisoft/yii2/Yii.php';
require __DIR__.'/../deployment/account-login-warnings/common/helpers/AccountLoginWarnings.php';
require __DIR__.'/../deployment/account-login-warnings/console/migrations/account-login-warnings/m261030_150000_account_login_warnings.php';
new yii\web\Application(['id'=>'login-warning-test','basePath'=>__DIR__,'components'=>['db'=>['class'=>yii\db\Connection::class,'dsn'=>'sqlite::memory:']]]);
$migration=new m261030_150000_account_login_warnings();$migration->safeUp();
use common\helpers\AccountLoginWarnings as Warnings;
function loginWarningCheck($condition,$message){if(!$condition)throw new RuntimeException($message);}
$a=hash('sha256','device-a');$b=hash('sha256','device-b');$c=hash('sha256','device-c');
Warnings::record(1,$a,86400);loginWarningCheck(Warnings::status(1,$a)===null,'First device must not warn');
Warnings::record(1,$a,86400);loginWarningCheck(Warnings::status(1,$a)===null,'Same browser or app must not warn itself');
Warnings::record(1,$b,86400);$first=Warnings::status(1,$a);
loginWarningCheck(is_string($first)&&strlen($first)===64&&Warnings::status(1,$b)===$first,'Both devices receive one warning for the new login');
Warnings::touch(1,$b);loginWarningCheck(Warnings::status(1,$a)===$first,'Ordinary reopen/remembered sessions must not generate new warnings');
Warnings::acknowledge(1,$a,$first);loginWarningCheck(Warnings::status(1,$a)===null&&Warnings::status(1,$b)===$first,'Acknowledging on one device does not clear another device');
Warnings::record(2,$c,86400);loginWarningCheck(Warnings::status(2,$c)===null,'Different users are isolated');
Warnings::record(1,$c,86400);$second=Warnings::status(1,$a);Warnings::acknowledge(1,$a,$first);
loginWarningCheck($second!==$first&&Warnings::status(1,$a)===$second,'A late acknowledgement cannot clear a newer warning');
Warnings::acknowledge(2,$c,$second);loginWarningCheck(Warnings::status(1,$a)===$second,'Cannot acknowledge another account');
Yii::$app->db->createCommand()->update(Warnings::TABLE,['expires_at'=>time()-1],['user_id'=>1])->execute();
Warnings::record(1,hash('sha256','new-device'),86400);
loginWarningCheck(Warnings::status(1,hash('sha256','new-device'))===null,'Expired devices must not trigger a warning');
echo "Account/device warning, acknowledgement, expiry and isolation checks passed.\n";
