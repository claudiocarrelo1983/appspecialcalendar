<?php
require __DIR__.'/team-qr-access.test.php';
Yii::setAlias('@webroot', $workspace.'/frontend/web');
Yii::setAlias('@web', '');
Yii::setAlias('@bower', $workspace.'/vendor/bower-asset');
Yii::$app->request->enableCsrfValidation=false;
Yii::$app->request->setPathInfo('checkin-preview');
Yii::$app->request->setUrl('/gym-checkin/index');
Yii::$app->controller=new yii\web\Controller('gym-checkin',Yii::$app);
Yii::$app->set('assetManager',['class'=>yii\web\AssetManager::class,'basePath'=>sys_get_temp_dir().'/checkin-preview-assets','baseUrl'=>'/assets']);
@mkdir(sys_get_temp_dir().'/checkin-preview-assets',0777,true);
Yii::$app->set('formatter',['class'=>yii\i18n\Formatter::class,'timeZone'=>'UTC','nullDisplay'=>'—']);
Yii::$app->i18n->translations['app']=new yii\i18n\PhpMessageSource(['basePath'=>$workspace.'/frontend/messages','fileMap'=>['app'=>'gym-checkin.php'],'forceTranslation'=>true]);
$db->createCommand()->createTable('gym_checkins',['id'=>'pk','company_code'=>'string','client_guid'=>'string','membership_code'=>'string','checkin_date'=>'datetime','checkout_date'=>'datetime','status'=>'string','notes'=>'text','created_date'=>'datetime'])->execute();
account(95,'FTX','admin');
$provider=new yii\data\ArrayDataProvider(['allModels'=>[
 (object)['id'=>1,'client'=>(object)['full_name'=>'Claudio Carrelo'],'client_guid'=>'member-1','membership'=>(object)['title'=>'Monthly'],'membership_code'=>'month','checkin_date'=>'2026-11-05 10:45:00','checkout_date'=>null,'status'=>'checked_in'],
 (object)['id'=>2,'client'=>(object)['full_name'=>'Claudio Carrelo'],'client_guid'=>'member-1','membership'=>(object)['title'=>'Monthly'],'membership_code'=>'month','checkin_date'=>'2026-11-04 09:00:00','checkout_date'=>'2026-11-04 10:30:00','status'=>'checked_out'],
], 'sort'=>['attributes'=>['checkin_date','checkout_date','status']], 'pagination'=>false]);
$model=new common\models\GymCheckin(['client_guid'=>'sample-guid','notes'=>'']);
$search=new common\models\GymCheckinSearch(['date_from'=>'2026-11-01']);
$member=(object)['id'=>1619,'full_name'=>'Claudio Carrelo','username'=>'claudio'];
foreach(['en','pt']as$lang){
 Yii::$app->language=$lang;
 $html=Yii::$app->view->renderFile($workspace.'/frontend/views/gym-checkin/index.php',['model'=>$model,'searchModel'=>$search,'dataProvider'=>$provider,'scannedMember'=>$member]);
 expect(!str_contains($html,'>checked_in<')&&!str_contains($html,'>checked_out<')&&!str_contains($html,'>check_out<'),'Statuses and checkout actions translated: '.$lang);
 expect(str_contains($html,'checkin-status-out')&&str_contains($html,'<svg'),'Badges include reliable vector icons');
 expect((bool)preg_match('/<input[^>]+type="hidden"[^>]+name="GymCheckin\[client_guid\]"/', $html),'Scanned identity is retained without exposing the code input');
 expect(str_contains($html,'2026-11-01'),'Filter selection is retained');
 expect(str_contains($html,$lang==='en'?'Checked out':'Saída registada'),'Status label uses selected language');
 expect(str_contains($html,'data-method="post"'),'Check out remains a POST action');
 expect(!str_contains($html,'Gym check-in')&&!str_contains($html,'Entradas no ginásio'),'Old gym check-in heading removed');
 expect(substr_count($html,'id="member-checkin-title"')===1,'One member check-in heading');
 expect(str_contains($html,'gym-page-heading__category'),'Heading uses the shared category and title structure');
 expect(str_contains($html,'data-checkin-client-details="1"')&&str_contains($html,'clients-list')&&str_contains($html,'1619'),'View details points to the scanned client');
 expect(str_contains($html,$lang==='en'?'View client details':'Ver dados do sócio'),'View client details label is translated');
 file_put_contents(__DIR__.'/../build/checkin-render-'.$lang.'.html',$html);
}
account(96,'FTX');
$db->createCommand()->update('user_roles_permissions',['permissions'=>'t-members-list'],['company_code'=>'FTX','level'=>'team'])->execute();
$db->createCommand()->update('user_roles_permissions_crud',['view'=>1],['page'=>'t-members-list'])->execute();
$html=Yii::$app->view->renderFile($workspace.'/frontend/views/gym-checkin/index.php',['model'=>$model,'searchModel'=>$search,'dataProvider'=>$provider,'scannedMember'=>$member]);
expect(str_contains($html,'member-checkin-title'),'Client-view Team can see the member confirmation');
expect(!str_contains($html,'checkin-history-title')&&!str_contains($html,'id="member-checkin-form"'),'Client-view alone must not expose attendance history or mutations');
expect(str_contains($html,'data-checkin-client-details="1"'),'Client-view permission retains the details button');
echo "Check-in layout: $checks combined checks passed.\n";
