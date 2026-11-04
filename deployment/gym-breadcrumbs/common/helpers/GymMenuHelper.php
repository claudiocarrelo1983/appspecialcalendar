<?php
namespace common\helpers;

use Yii;

/** Resolve navigation ancestry for menu pages and their related action screens. */
class GymMenuHelper
{
    private static $menus=[];

    public static function currentPage(): ?array
    {
        if(realpath(Yii::$app->basePath)!==realpath(Yii::getAlias('@frontend')))return null;
        $level=Yii::$app->user->identity->level??null;
        $page=self::pageForPath(Yii::$app->request->pathInfo,$level);
        return $page??self::pageForPath(Yii::$app->controller?Yii::$app->controller->route:'',$level);
    }

    public static function pageForPath(string $path,?string $level=null): ?array
    {
        $path=self::normalize($path);
        $aliases=['personal-classes/client-index'=>'personal-classes-client','dashboard-gym-client/report'=>'report-client',
            'fitness-integrations'=>'gym-sessions','health-tools'=>'workout-timer'];
        foreach($aliases as $from=>$to)if($path===$from||strpos($path,$from.'/')===0){$path=$to.substr($path,strlen($from));break;}
        $best=null;$menus=$level==='client'?['gym-client','gym-all']:['gym-all','gym-client'];
        foreach($menus as $menu){
            if(!isset(self::$menus[$menu]))self::$menus[$menu]=json_decode(file_get_contents(Yii::getAlias('@frontend/web/json/other/special-gym/'.$menu.'.json')),true);
            $match=self::findPage(self::$menus[$menu]['left-menu']??[],$path);
            if($match!==null&&($best===null||strlen($match['path'])>strlen($best['path'])))$best=$match;
        }
        if($best===null&&($path==='group-notifications'||strpos($path,'group-notifications/')===0))$best=['title'=>'group_notifications_title','icon'=>'bx bx-bell','path'=>'group-notifications','parents'=>[]];
        if($best===null)return null;
        $suffix=trim(substr($path,strlen($best['path'])),'/');
        $best['action']=explode('/',$suffix)[0]?:'index';
        $best['trail']=$best['parents'];
        if($best['action']!=='index')$best['trail'][]=['label'=>$best['title'],'url'=>'/'.$best['path']];
        if(!$best['trail'])$best['trail'][]=['label'=>$level==='client'?'gym_breadcrumb_member_account':'gym_breadcrumb_administration','url'=>null];
        return $best;
    }

    private static function normalize(string $path): string
    {
        $path=(string)parse_url($path,PHP_URL_PATH);
        $path=trim(preg_replace('#^(\.\./)+#','',$path),'/');
        return preg_replace('#/index$#','',$path);
    }

    private static function findPage(array $items,string $path,array $parents=[],string $parentIcon='bx bx-dumbbell'): ?array
    {
        $best=null;
        foreach($items as $item){
            $icon=$item['icon']??$parentIcon;
            if(strpos($icon,'bx ')!==0)$icon='bx bx-group';
            $url=self::normalize((string)($item['url']??''));
            $valid=$url!==''&&$url!=='null';
            if($valid&&($path===$url||strpos($path,$url.'/')===0)){
                $candidate=['title'=>$item['title'],'icon'=>$icon,'path'=>$url,'parents'=>$parents];
                if($best===null||strlen($url)>strlen($best['path']))$best=$candidate;
            }
            $trail=array_merge($parents,[['label'=>$item['title'],'url'=>$valid?'/'.$url:null]]);
            $child=self::findPage($item['submenu']??[],$path,$trail,$icon);
            if($child!==null&&($best===null||strlen($child['path'])>strlen($best['path'])))$best=$child;
        }
        return $best;
    }
}
