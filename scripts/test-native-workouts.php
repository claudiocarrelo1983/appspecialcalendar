<?php
define('YII_ENABLE_ERROR_HANDLER',false);
$root='C:/inetpub/wwwroot/workspace';require $root.'/vendor/autoload.php';require $root.'/vendor/yiisoft/yii2/Yii.php';Yii::setAlias('@common',$root.'/common');
new yii\console\Application(['id'=>'workout-history-test','basePath'=>__DIR__,'components'=>['db'=>['class'=>yii\db\Connection::class,'dsn'=>'sqlite::memory:']]]);
require $root.'/console/migrations/native-fitness/m261101_180000_native_workouts.php';
$migration=new m261101_180000_native_workouts();$migration->safeUp();$migration->safeUp();
$row=['id'=>'12345678-1234-4123-8123-123456789abc','mode'=>'interval','seconds'=>120,'at'=>time()*1000];
$service=common\helpers\NativeWorkoutHistory::class;
$service::store('demo',1,[$row]);$service::store('demo',1,[$row]);$service::store('demo',2,[$row]);$service::store('ftx',1,[$row]);
$query=(new yii\db\Query())->from('native_workout_history');
if((int)(clone $query)->count()!==3||(int)(clone $query)->where(['company_code'=>'demo','user_id'=>1])->count()!==1)throw new RuntimeException('Idempotence or account scope failed');
foreach([['seconds'=>0],['seconds'=>86401],['mode'=>'invented'],['at'=>(time()+900)*1000],['id'=>'not-a-uuid']] as $bad){
    try{$service::validateRows([array_replace($row,$bad)]);throw new RuntimeException('Accepted invalid workout');}catch(yii\web\UnprocessableEntityHttpException $expected){}
}
if((int)(clone $query)->count()!==3)throw new RuntimeException('Invalid input changed stored records');
echo "Native workout migration, durable idempotence, company/user scope and payload validation passed.\n";
