<?php
define('YII_ENABLE_ERROR_HANDLER',false);
$server=$argv[1]??'C:/inetpub/wwwroot/workspace';
require $server.'/vendor/autoload.php';require $server.'/vendor/yiisoft/yii2/Yii.php';
Yii::setAlias('@common',$server.'/common');Yii::setAlias('@frontend',$server.'/frontend');
class GymHeadingTestMessages extends yii\i18n\MessageSource {
 protected function loadMessages($category,$language){return array_merge(require Yii::getAlias('@frontend/messages/en/gym-navigation.php'),['health_tools'=>'Health Tools','workout_timer'=>'Timer','breadcrumb'=>'Breadcrumb']);}
}
new yii\web\Application(['id'=>'gym-heading-test','basePath'=>$server.'/frontend','language'=>'en','components'=>[
 'request'=>['hostInfo'=>'https://club.example','scriptUrl'=>'/index.php'],
 'user'=>['identityClass'=>common\models\User::class,'enableSession'=>false],
 'urlManager'=>['enablePrettyUrl'=>true,'showScriptName'=>false],
 'i18n'=>['translations'=>['app'=>['class'=>GymHeadingTestMessages::class,'forceTranslation'=>true]]],
]]);
$checks=0;$routes=0;
function headingCheck($valid,$label){global $checks;$checks++;if(!$valid)throw new RuntimeException($label);}
function verifyGymItems($items,$level){global $routes;
 foreach($items as $item){
  if(!empty($item['url'])&&$item['url']!=='null'){
   $routes++;$base=trim(preg_replace('#^(\.\./)+#','',$item['url']),'/');$base=preg_replace('#/index$#','',$base);
   foreach(['','/index','/create','/update/123','/edit/123','/view/123'] as $suffix){
    $page=common\helpers\GymMenuHelper::pageForPath($base.$suffix,$level);
    headingCheck($page!==null&&$page['path']===$base,'Route ancestry: '.$base.$suffix);
    headingCheck($page['title']===$item['title']&&strpos($page['icon'],'bx ')===0,'Menu title/icon: '.$base.$suffix);
    headingCheck(!empty($page['trail']),'Category available: '.$base.$suffix);
   }
  }
  verifyGymItems($item['submenu']??[],$level);
 }
}
foreach(['gym-all'=>'admin','gym-client'=>'client'] as $file=>$level){$menu=json_decode(file_get_contents($server.'/frontend/web/json/other/special-gym/'.$file.'.json'),true);verifyGymItems($menu['left-menu'],$level);}
foreach(['personal-classes/client-index'=>'personal-classes-client','dashboard-gym-client/report'=>'report-client','fitness-integrations'=>'gym-sessions','health-tools'=>'workout-timer'] as $alias=>$target)headingCheck(common\helpers\GymMenuHelper::pageForPath($alias,'client')['path']===$target,'Existing route alias: '.$alias);
headingCheck(common\helpers\GymMenuHelper::pageForPath('memberships-unrelated/create')===null,'No substring matching of unrelated routes');
Yii::$app->request->setPathInfo('workout-timer/update/123');
$html=common\widgets\GymPageHeading::widget(['canonical'=>true,'title'=>'Edit timer','icon'=>'bx bx-timer']);
headingCheck(strpos($html,'Health Tools')<strpos($html,'Edit timer'),'Category appears above title');
headingCheck(strpos($html,'href="/workout-timer"')!==false,'CRUD heading links back to the menu page');
headingCheck(substr_count($html,'<h1 ')===1&&strpos($html,'bx bx-timer')!==false,'One title and matching icon');
headingCheck(common\widgets\GymPageHeading::widget(['title'=>'Old duplicate'])==='','Legacy shared heading does not duplicate canonical layout heading');
$escaped=common\widgets\GymPageHeading::widget(['canonical'=>true,'title'=>'<img src=x onerror=bad()>']);
headingCheck(strpos($escaped,'<img')===false&&strpos($escaped,'&lt;img')!==false,'Dynamic page titles are escaped');
foreach(['admin','admin-mobile','main'] as $layout)headingCheck(substr_count(file_get_contents($server.'/frontend/views/layouts/'.$layout.'.php'),"'canonical'=>true")===1,'One canonical heading in '.$layout.' layout');
$preview='<!doctype html><html><meta charset="utf-8"><title>Gym page headings</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#101b30}.sample{padding:20px;border:1px solid #e4eaf2;border-radius:18px;margin-bottom:16px}.gym-page-heading{display:flex;align-items:center;gap:12px}.gym-page-heading__icon{width:44px;height:44px;border-radius:14px;background:#e6f3ec;display:flex;align-items:center;justify-content:center;color:#198754}.gym-page-heading__category{color:#718099;font-size:12px}.gym-page-heading__category a{color:inherit;text-decoration:none}.gym-page-heading__title{font-size:22px;margin:4px 0 0}</style><body><p>Workspace breadcrumb examples — sample titles</p>';
foreach(['workout-timer'=>'Timer','workout-timer/create'=>'Create timer','clients-list/update/123'=>'Edit client','memberships/view/123'=>'View membership'] as $path=>$title){Yii::$app->request->setPathInfo($path);$page=common\helpers\GymMenuHelper::currentPage();$preview.='<div class="sample">'.common\widgets\GymPageHeading::widget(['canonical'=>true,'title'=>$title,'icon'=>$page['icon']]).'</div>';}
file_put_contents(dirname(__DIR__).'/build/gym-breadcrumb-preview.html',$preview.'</body></html>');
echo "Gym menu headings: $routes menu links, $checks route, CRUD, alias, rendering and escaping checks passed.\n";
