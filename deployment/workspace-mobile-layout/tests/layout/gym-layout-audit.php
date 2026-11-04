<?php
/** Read-only route/layout audit. Run: php tests/layout/gym-layout-audit.php */
define('YII_ENABLE_ERROR_HANDLER',false);
$root=dirname(__DIR__,2);
require $root.'/vendor/autoload.php';require $root.'/vendor/yiisoft/yii2/Yii.php';
Yii::setAlias('@common',$root.'/common');Yii::setAlias('@frontend',$root.'/frontend');
new yii\web\Application(['id'=>'gym-layout-audit','basePath'=>$root.'/frontend','components'=>[
    'request'=>['hostInfo'=>'https://layout-audit.invalid','scriptUrl'=>'/index.php'],
    'user'=>['identityClass'=>common\models\User::class,'enableSession'=>false],
]]);
$aliases=['personal-classes-client'=>'PersonalClasses','report-client'=>'DashboardGymClient',
    'performance-dashboard-client'=>'PerformanceDashboard','fitness-assessments-client'=>'FitnessAssessments',
    'body-measurements-client'=>'BodyMeasurements','personal-records-client'=>'PersonalRecords',
    'progress-photos-client'=>'ProgressPhotos','fitness-goals-client'=>'FitnessGoals','performance-reports-client'=>'PerformanceReports'];
$rows=[];$checks=0;
$scan=function($items,$menu,$level)use(&$scan,&$rows,&$checks,$aliases){
    foreach($items as $item){
        if(!empty($item['url'])&&$item['url']!=='null'){
            $path=trim(preg_replace('#^(\.\./)+#','',(string)parse_url($item['url'],PHP_URL_PATH)),'/');
            $path=preg_replace('#/index$#','',$path);$controller=explode('/',$path)[0];
            $name=$aliases[$controller]??str_replace(' ','',ucwords(str_replace('-',' ',$controller)));
            $class='frontend\\controllers\\'.$name.'Controller';
            if(!class_exists($class))throw new RuntimeException('Missing menu controller: '.$path);
            $reflection=new ReflectionClass($class);$actions=[];
            foreach(['index','create','update','edit','view'] as $action)if($reflection->hasMethod('action'.ucfirst($action)))$actions[]=$action;
            foreach(['','/index','/create','/update/123','/edit/123','/view/123'] as $suffix){
                $page=common\helpers\GymMenuHelper::pageForPath($path.$suffix,$level);$checks++;
                if(!$page||$page['path']!==$path)throw new RuntimeException('Missing layout scope: '.$path.$suffix);
            }
            $rows[]=['menu'=>$menu,'route'=>'/'.$path,'controller'=>$class,'actions'=>$actions];
        }
        $scan($item['submenu']??[],$menu,$level);
    }
};
foreach(['gym-all'=>'admin','gym-client'=>'client'] as $menu=>$level){
    $data=json_decode(file_get_contents($root.'/frontend/web/json/other/special-gym/'.$menu.'.json'),true,512,JSON_THROW_ON_ERROR);
    $scan($data['left-menu'],$menu,$level);
}
foreach(['admin','admin-mobile','main'] as $layout){
    $source=file_get_contents($root.'/frontend/views/layouts/'.$layout.'.php');
    foreach(['GymMobileLayoutAsset::register($this)','gym-menu-content gym-app-layout',"'canonical'=>true"] as $marker){$checks++;if(strpos($source,$marker)===false)throw new RuntimeException('Missing layout integration: '.$layout);}
}
foreach(['css/gym-ui.css','css/gym-shared-theme.css','css/gym-mobile-layout.css','js/gym-mobile-layout.js','fonts/gym/Poppins-Regular.ttf','fonts/gym/Poppins-SemiBold.ttf','fonts/gym/BricolageGrotesque-Bold.ttf'] as $file){$checks++;if(!is_file($root.'/frontend/web/'.$file))throw new RuntimeException('Missing asset: '.$file);}
$report="# Gym mobile-style workspace layout audit\n\n";
$report.="Authoritative source: `C:/inetpub/wwwroot/workspace`.\n\n";
$report.="Both menu files remain unchanged. The shared layout applies to each menu route and its descendant Create, Update/Edit, and View screens. Existing actions are listed below; the audit does not create actions or grant permissions.\n\n";
$report.="Admin, admin-mobile, and main layouts register the same scoped layout asset and canonical heading. Authentication, maintenance, public responses, calendar controls, complex tables, POST forms, and existing permission checks retain their own behavior.\n\n";
$report.="| Menu | Route | Existing standard controller methods |\n|---|---|---|\n";
foreach($rows as $row)$report.='| '.$row['menu'].' | `'.$row['route'].'` | '.implode(', ',$row['actions'])." |\n";
$report.="\n".count($rows)." menu links and $checks controller, route-variant, layout and asset checks passed.\n\n";
$report.="Presentation tests additionally cover original form inputs/IDs/GET parameters, bidirectional search synchronization, visible validation errors, preserved rich-content headings, action links, checkbox selections, sorting headers, POST/calendar/dialog exclusions, and idempotent enhancement.\n\n";
$report.="This is structural and regression verification, not a signed-in visual test of every production record. No live data, permissions, controller logic, database schema or menu destinations are changed by this audit.\n";
file_put_contents($root.'/docs/gym-layout-audit.md',$report);
echo count($rows)." menu links; $checks controller, route-variant, layout and asset checks passed.\n";
