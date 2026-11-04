<?php
namespace common\helpers;

use Yii;
use common\models\User;
use common\models\CompanyUserMembership;
use yii\db\Query;
use yii\web\ForbiddenHttpException;

/** Optional company-scoped team overrides. An absent row inherits the team role. */
final class IndividualTeamPermissions
{
    const TABLE='{{%company_team_permissions}}';
    public static function available(): bool
    {
        return Yii::$app->db->schema->getTableSchema(self::TABLE)!==null;
    }
    public static function canManage(string $company): bool
    {
        if(Yii::$app->user->isGuest)return false;
        $user=Yii::$app->user->identity;
        if($user->level==='superadmin')return true;
        if($user->level==='admin'&&$user->company_code===$company)return true;
        $membership=Yii::$app->has('activeCompany')?Yii::$app->activeCompany->getMembership():null;
        return $membership&&$membership->company_code===$company&&$membership->status===CompanyUserMembership::STATUS_APPROVED&&$membership->role==='admin';
    }
    public static function teamQuery(string $company)
    {
        $members=CompanyUserMembership::find()->select('user_id')->where(['company_code'=>$company,'role'=>'team','status'=>CompanyUserMembership::STATUS_APPROVED]);
        return User::find()->where(['or',['company_code'=>$company,'level'=>'team'],['id'=>$members]])->andWhere(['<>','status',User::STATUS_DELETED]);
    }
    public static function selected(string $company,int $id)
    {
        if(!self::canManage($company))throw new ForbiddenHttpException();
        $member=self::teamQuery($company)->andWhere(['id'=>$id])->one();
        if(!$member)throw new ForbiddenHttpException();
        return $member;
    }
    public static function read(string $company,int $id): ?array
    {
        if(!self::available())return null;
        $json=(new Query())->select('permissions')->from(self::TABLE)->where(['company_code'=>$company,'user_id'=>$id])->scalar();
        if($json===false)return null;
        $data=json_decode((string)$json,true);
        // A malformed override must never silently restore broader role permissions.
        return is_array($data)&&isset($data['base'],$data['crud'])?$data:['base'=>[],'crud'=>[]];
    }
    public static function current(): ?array
    {
        if(Yii::$app->user->isGuest||!self::available())return null;
        $company=SecurityAccess::companyCode();$user=Yii::$app->user->identity;
        if(self::canManage($company))return null;
        $member=Yii::$app->has('activeCompany')?Yii::$app->activeCompany->getMembership():null;
        if($user->level!=='team'&&($member->role??null)!=='team')return null;
        return self::read($company,(int)$user->id);
    }
    public static function normalize(array $posted,array $menu): array
    {
        $base=[];$crud=[];
        $walk=function(array $items,?string $parent=null)use(&$walk,&$base,&$crud,$posted){
            foreach($items as $item){
                $key=$item['key']??'';if(!$key)continue;
                $values=is_array($posted[$key]??null)?$posted[$key]:[];
                $selected=!empty($values['base']);
                foreach(['view','create','edit','delete','duplicate'] as $action){$crud[$key][$action]=!empty($values[$action]);$selected=$selected||$crud[$key][$action];}
                if($selected){$base[$key]=$key;if($parent)$base[$parent]=$parent;}
                $walk($item['submenu']??[],$key);
            }
        };
        $walk($menu['left-menu']??[]);
        foreach($menu['permissions']??[] as $key)if(is_string($key)&&!empty($posted[$key]['base']))$base[$key]=$key;
        return ['base'=>array_values($base),'crud'=>$crud];
    }
    public static function routeAllowed(array $permissions,string $route,array $items): bool
    {
        $route=trim($route,'/');$best=null;
        $walk=function($items)use(&$walk,&$best,$route){foreach($items as $item){
            $path=trim(preg_replace('#^(\.\./)+#','',(string)($item['url']??'')),'/');
            if($path!==''&&$path!=='null'&&($route===$path||strpos($route,$path.'/')===0)&&($best===null||strlen($path)>strlen($best['path'])))$best=['path'=>$path,'key'=>$item['key']];
            $walk($item['submenu']??[]);
        }};$walk($items);
        if(!$best||strpos($best['key'],'t-dashboard')===0)return true;
        if(!in_array($best['key'],$permissions['base'],true))return false;
        $action=explode('/',trim(substr($route,strlen($best['path'])),'/'))[0];
        $crud=[''=>'view','index'=>'view','view'=>'view','create'=>'create','update'=>'edit','edit'=>'edit','delete'=>'delete','remove'=>'delete','duplicate'=>'duplicate'];
        return !isset($crud[$action])||!empty($permissions['crud'][$best['key']][$crud[$action]]);
    }
    public static function save(string $company,int $id,array $posted,bool $inherit=false): void
    {
        self::selected($company,$id);
        if(!self::available())throw new \yii\web\ServiceUnavailableHttpException();
        if($inherit){Yii::$app->db->createCommand()->delete(self::TABLE,['company_code'=>$company,'user_id'=>$id])->execute();return;}
        $data=self::normalize($posted,PermissionsHelpers::getSidebarMenu());
        Yii::$app->db->createCommand()->upsert(self::TABLE,['company_code'=>$company,'user_id'=>$id,'permissions'=>json_encode($data),'updated_by'=>(int)Yii::$app->user->id,'updated_at'=>date('Y-m-d H:i:s')])->execute();
    }
}
