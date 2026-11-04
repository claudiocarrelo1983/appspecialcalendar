<?php
define('YII_ENABLE_ERROR_HANDLER',false);
$root='C:/inetpub/wwwroot/workspace';require $root.'/vendor/autoload.php';require $root.'/vendor/yiisoft/yii2/Yii.php';
Yii::setAlias('@common',$root.'/common');Yii::setAlias('@frontend',$root.'/frontend');
$files=dirname(__DIR__).'/build/company-logo-tests';@mkdir($files.'/images/company',0777,true);Yii::setAlias('@webroot',$files);
new yii\web\Application(['id'=>'company-logo-tests','basePath'=>__DIR__,'components'=>[
 'db'=>['class'=>yii\db\Connection::class,'dsn'=>'sqlite::memory:'],
 'request'=>['hostInfo'=>'https://company.example','scriptUrl'=>'/index.php'],
 'user'=>['identityClass'=>common\models\User::class,'enableSession'=>false],
]]);
Yii::setAlias('@webroot',$files);
Yii::$app->db->createCommand('CREATE TABLE company(id INTEGER PRIMARY KEY, company_code TEXT, image_logo TEXT, path TEXT, active INTEGER)')->execute();
require $root.'/console/migrations/company-branding/m261101_120000_company_mobile_logo.php';
$migration=new m261101_120000_company_mobile_logo(['db'=>Yii::$app->db]);$migration->safeUp();$migration->safeUp();
function logoCheck($valid,$message){if(!$valid)throw new RuntimeException($message);}
$pixel=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=');
file_put_contents($files.'/images/company/desktop.png',$pixel);file_put_contents($files.'/images/company/mobile.png',$pixel);
$company=['company_code'=>'one','path'=>'/images/company/','image_logo'=>'desktop.png','image_logo_mobile'=>'mobile.png'];
logoCheck(common\helpers\Helpers::companyLogoUrl($company)==='/images/company/desktop.png','Desktop logo remains independent');
logoCheck(strpos(common\helpers\CompanyBranding::mobileLogoUrl($company),'/images/company/mobile.png?v=')===0,'Mobile logo selects its own asset with cache version');
$company['image_logo_mobile']=null;logoCheck(strpos(common\helpers\CompanyBranding::mobileLogoUrl($company),'/images/company/desktop.png?v=')===0,'Unset mobile logo falls back to desktop');
$company['image_logo_mobile']='missing.png';logoCheck(strpos(common\helpers\CompanyBranding::mobileLogoUrl($company),'/images/company/desktop.png?v=')===0,'Missing mobile file falls back safely');
$model=new common\models\Company();$model->image_logo_mobile='mobile.png';$model->load(['Company'=>['image_logo_mobile'=>'/uploads/another-company.png']]);
logoCheck($model->image_logo_mobile==='mobile.png','A form cannot assign arbitrary stored mobile-logo paths');
$model->mobileLogoImage=new yii\web\UploadedFile(['name'=>'logo.png','tempName'=>$files.'/images/company/mobile.png','type'=>'image/png','size'=>strlen($pixel),'error'=>UPLOAD_ERR_OK]);
logoCheck($model->validate(['mobileLogoImage']),'Valid PNG upload accepted');
file_put_contents($files.'/fake.png','<?php echo "not an image";');
$model->mobileLogoImage=new yii\web\UploadedFile(['name'=>'logo.png','tempName'=>$files.'/fake.png','type'=>'image/png','size'=>26,'error'=>UPLOAD_ERR_OK]);
logoCheck(!$model->validate(['mobileLogoImage']),'Fake image content is rejected');
logoCheck(Yii::$app->db->schema->getTableSchema('company',true)->columns['image_logo_mobile']->allowNull,'Migration is nullable and repeatable');
echo "Company desktop/mobile logo selection, reset fallback, path safety, upload content and migration checks passed.\n";
