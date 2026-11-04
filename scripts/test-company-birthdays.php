<?php
define('YII_ENABLE_ERROR_HANDLER', false);
$server = $argv[1] ?? 'C:/inetpub/wwwroot/workspace';
require $server . '/vendor/autoload.php';
require $server . '/vendor/yiisoft/yii2/Yii.php';
require __DIR__ . '/../deployment/company-birthdays/common/helpers/CompanyBirthdays.php';
function birthdayCheck($value, $message) { if (!$value) throw new RuntimeException($message); }
$now = new DateTimeImmutable('2026-12-30 23:30:00', new DateTimeZone('Europe/Lisbon'));
$rows = common\helpers\CompanyBirthdays::upcoming([
    ['id'=>1,'full_name'=>'Me','dob'=>'1990-12-30'],
    ['id'=>2,'full_name'=>'New year','dob'=>'2001-01-01'],
    ['id'=>3,'full_name'=>'Later','dob'=>'2000-01-10'],
    ['id'=>4,'full_name'=>'Invalid','dob'=>'2000-02-30'],
], 1, $now);
birthdayCheck(count($rows) === 2 && $rows[0]['name'] === 'Me' && $rows[1]['name'] === 'New year', 'Today first and upcoming across year boundary');
birthdayCheck($rows[0]['today'] && $rows[0]['isSelf'] && !$rows[1]['isSelf'], 'Personal greeting applies only to the signed-in person');
birthdayCheck($rows[0]['date'] === '30/12' && !str_contains(json_encode($rows), '1990'), 'Birth year stays private');
$leap = [['id'=>5,'full_name'=>'Leap day','dob'=>'2000-02-29']];
birthdayCheck(count(common\helpers\CompanyBirthdays::upcoming($leap, 5, new DateTimeImmutable('2028-02-29'))) === 1, 'Leap day birthday');
birthdayCheck(count(common\helpers\CompanyBirthdays::upcoming($leap, 5, new DateTimeImmutable('2027-02-28'))) === 0, 'Do not move leap day birthdays to another date');

new yii\web\Application(['id'=>'birthday-test','basePath'=>__DIR__,'timeZone'=>'Europe/Lisbon','components'=>[
    'db'=>['class'=>yii\db\Connection::class,'dsn'=>'sqlite::memory:'],
    'user'=>['class'=>yii\web\User::class,'identityClass'=>stdClass::class,'enableSession'=>false],
]]);
$identity = new class implements yii\web\IdentityInterface {
    public function getId(){return 1;} public function getAuthKey(){return '';} public function validateAuthKey($key){return false;}
    public static function findIdentity($id){return null;} public static function findIdentityByAccessToken($token,$type=null){return null;}
};
Yii::$app->user->setIdentity($identity);
$db = Yii::$app->db;
$db->createCommand('CREATE TABLE user (id INTEGER PRIMARY KEY, full_name TEXT, dob TEXT, level TEXT, company_code TEXT, company_code_parent TEXT)')->execute();
foreach (['company_user_membership','company_access_request'] as $table) $db->createCommand("CREATE TABLE {$table} (user_id INTEGER, company_code TEXT, status TEXT, access_start TEXT, access_expires TEXT)")->execute();
$dob = '1990-' . date('m-d');
foreach ([[1,'Client','client','FTX'],[2,'Coach','coach','FTX'],[3,'Admin','admin','FTX'],[4,'Other company','client','OTHER'],[5,'Approved guest','client','OTHER'],[6,'Expired access','client','OTHER']] as [$id,$name,$level,$company]) {
    $db->createCommand()->insert('user',['id'=>$id,'full_name'=>$name,'dob'=>$dob,'level'=>$level,'company_code'=>$company])->execute();
}
$db->createCommand()->insert('company_user_membership',['user_id'=>5,'company_code'=>'FTX','status'=>'approved'])->execute();
$db->createCommand()->insert('company_access_request',['user_id'=>6,'company_code'=>'FTX','status'=>'approved','access_expires'=>'2000-01-01'])->execute();
$shared = common\helpers\CompanyBirthdays::rows('FTX', 1);
$names = array_column($shared,'name');sort($names);
birthdayCheck($names === ['Admin','Approved guest','Client','Coach'], 'All account levels, approved company membership only; other companies and expired access excluded');
birthdayCheck(count(array_filter($shared,static fn($row)=>$row['isSelf'])) === 1, 'Exactly one personal birthday');
echo "Company birthday date, identity, privacy and company-scope checks passed.\n";
