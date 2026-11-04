<?php
namespace common\helpers;

use common\models\Company;
use common\models\CompanyNotification;
use common\models\CompanyNotificationRecipient;
use common\models\CompanyNotificationForm;
use common\models\CompanyUserMembership;
use common\models\MobilePushDevice;
use common\models\MobilePushPreference;
use common\models\User;
use Yii;
use yii\db\Query;
use yii\web\ForbiddenHttpException;

class CompanyNotificationService
{
    public static function sidebarMenu(array $structure,$company)
    {
        if (Yii::$app->user->isGuest || !$company) return $structure;
        $manage=self::canManage($company);
        $menu=['key'=>'t-group-notifications','title'=>'group_notifications_title','icon'=>'bx bx-bell',
            'url'=>$manage?'null':'/group-notifications','submenu'=>[]];
        if ($manage) foreach (['create'=>'group_notifications_compose','sent'=>'group_notifications_sent','index'=>'group_notifications_inbox'] as $action=>$label) {
            $menu['submenu'][]=['key'=>'t-group-notifications-'.$action,'title'=>$label,
                'url'=>'/group-notifications/'.$action,'parent'=>'t-group-notifications','submenu'=>[]];
        }
        $result=[];$inserted=false;
        foreach ($structure as $key=>$item) {
            if (($item['key']??'')==='t-group-notifications') continue;
            $result[$key]=$item;
            if (($item['key']??'')==='t-members') { $result['t-group-notifications']=$menu;$inserted=true; }
        }
        if (!$inserted) $result['t-group-notifications']=$menu;
        if (isset($result['t-client-settings'])) {
            $settings = $result['t-client-settings'];
            unset($result['t-client-settings']);
            $result['t-client-settings'] = $settings;
        }
        return $result;
    }

    public static function available()
    {
        return Yii::$app->db->schema->getTableSchema(CompanyNotification::tableName())!==null
            && Yii::$app->db->schema->getTableSchema(CompanyNotificationRecipient::tableName())!==null;
    }
    public static function canManage($company)
    {
        if (Yii::$app->user->isGuest) return false;
        $user=Yii::$app->user->identity;
        return SecurityAccess::isPlatformAdmin() || ($user->level==='admin' && $user->company_code===$company)
            || SecurityAccess::canManageCompany($company);
    }
    public static function eligibleUsers($company)
    {
        $query=User::find()->alias('recipient')->where(['recipient.active'=>1,'recipient.status'=>User::STATUS_ACTIVE]);
        $legacy=['or',['recipient.company_code'=>$company],['recipient.company_code_parent'=>$company]];
        if (Yii::$app->db->schema->getTableSchema(CompanyUserMembership::tableName())) {
            $membership=(new Query())->select(new \yii\db\Expression('1'))->from(['member'=>CompanyUserMembership::tableName()])
                ->where('member.user_id = recipient.id')->andWhere(['member.company_code'=>$company]);
            $approved=(clone $membership)->andWhere(['member.status'=>'approved'])
                ->andWhere(['or',['member.access_start'=>null],['<=','member.access_start',date('Y-m-d')]])
                ->andWhere(['or',['member.access_expires'=>null],['>=','member.access_expires',date('Y-m-d')]]);
            $query->andWhere(['or',['exists',$approved],['and',$legacy,['not exists',$membership]]]);
        } else $query->andWhere($legacy);
        return $query;
    }
    public static function recipientIds(CompanyNotificationForm $form,$company)
    {
        $query=self::eligibleUsers($company);
        if ($form->recipient_mode==='levels') {
            $levels=array_values(array_unique($form->levels));
            $available=(clone $query)->select('recipient.level')->distinct()->column();
            if (array_diff($levels,$available)) throw new \InvalidArgumentException(Yii::t('app','group_notifications_invalid_recipients'));
            $query->andWhere(['recipient.level'=>$levels]);
        } else {
            $ids=array_values(array_unique(array_map('intval',$form->people)));
            $query->andWhere(['recipient.id'=>$ids]);
            $found=array_map('intval',(clone $query)->select('recipient.id')->column());
            if (array_diff($ids,$found)) throw new \InvalidArgumentException(Yii::t('app','group_notifications_invalid_recipients'));
        }
        $ids=array_map('intval',$query->select('recipient.id')->column());
        if (!$ids) throw new \InvalidArgumentException(Yii::t('app','group_notifications_select_recipients'));
        return $ids;
    }
    public static function create(CompanyNotificationForm $form,$company)
    {
        if (!self::canManage($company)) throw new ForbiddenHttpException();
        return self::store($form,$company);
    }
    public static function createClassInvitation(CompanyNotificationForm $form,$company)
    {
        if (!ClassInvitations::canShare($company)||$form->recipient_mode!=='people'||count($form->people)!==1
            ||!ClassInvitations::clients($company)->andWhere(['recipient.id'=>(int)$form->people[0]])->exists()) throw new ForbiddenHttpException();
        return self::store($form,$company);
    }
    private static function store(CompanyNotificationForm $form,$company)
    {
        if (!$form->validate()) throw new \InvalidArgumentException(Yii::t('app','group_notifications_invalid_recipients'));
        $old=CompanyNotification::findOne(['submission_key'=>$form->submission_key]);
        if ($old) {
            if ($old->company_code!==$company||(int)$old->created_by!==(int)Yii::$app->user->id) throw new ForbiddenHttpException();
            return $old;
        }
        $ids=self::recipientIds($form,$company);
        return Yii::$app->db->transaction(function() use($form,$company,$ids) {
            $notice=new CompanyNotification();
            $notice->setAttributes(['company_code'=>$company,'created_by'=>Yii::$app->user->id,'submission_key'=>$form->submission_key,
                'title'=>$form->title,'body'=>$form->body,'recipient_mode'=>$form->recipient_mode,
                'selection'=>json_encode($form->recipient_mode==='levels'?$form->levels:$ids),
                'recipient_count'=>count($ids),'created_at'=>time()],false);
            $notice->save(false);
            foreach(array_chunk($ids,200) as $chunk) {
                $rows=[];foreach($chunk as $id) $rows[]=[$notice->id,$company,$id,'pending',time(),time()];
                Yii::$app->db->createCommand()->batchInsert(CompanyNotificationRecipient::tableName(),
                    ['notification_id','company_code','user_id','push_status','next_attempt_at','updated_at'],$rows)->execute();
            }
            return $notice;
        });
    }
    public static function inbox($company,$userId)
    {
        return CompanyNotificationRecipient::find()->with('notification')->where(['company_code'=>$company,'user_id'=>$userId])->orderBy(['id'=>SORT_DESC]);
    }
    public static function dispatch($limit=100,$notificationId=null,ExpoPushClient $client=null)
    {
        if (!self::available()) return ['accepted'=>0,'processed'=>0];
        $now=time();$client=$client?:new ExpoPushClient();$claimed=[];$groups=[];$counts=[];
        CompanyNotificationRecipient::updateAll(['push_status'=>'uncertain','updated_at'=>$now],
            ['and',['push_status'=>'sending'],['<','updated_at',$now-300]]);
        $query=CompanyNotificationRecipient::find()->with('notification')->where(['push_status'=>'pending'])
            ->andWhere(['<=','next_attempt_at',$now])->orderBy(['id'=>SORT_ASC])->limit(max(1,min(100,(int)$limit)));
        if ($notificationId!==null) $query->andWhere(['notification_id'=>$notificationId]);
        foreach($query->all() as $row) {
            if (!CompanyNotificationRecipient::updateAll(['push_status'=>'sending','updated_at'=>$now,
                'attempts'=>new \yii\db\Expression('attempts + 1')],['id'=>$row->id,'push_status'=>'pending'])) continue;
            $row->attempts++;$claimed[$row->id]=$row;$counts[$row->id]=['accepted'=>0,'failed'=>0,'uncertain'=>0,'retry'=>false];
            $notice=$row->notification;
            if (!CompanyPushNotifications::enabled($row->company_code)) continue;
            if (!$notice||!self::eligibleUsers($row->company_code)->andWhere(['recipient.id'=>$row->user_id])->exists()) continue;
            $company=Company::findOne(['company_code'=>$row->company_code,'active'=>1]);
            if (!$company||!Yii::$app->db->schema->getTableSchema(MobilePushDevice::tableName())
                ||!Yii::$app->db->schema->getTableSchema(MobilePushPreference::tableName())) continue;
            $seen=[];
            foreach(MobilePushDevice::find()->where(['user_id'=>$row->user_id,'company_code'=>$row->company_code,'enabled'=>1])->orderBy(['id'=>SORT_DESC])->limit(10)->all() as $device) {
                if (!MobilePushDevice::validToken($device->token)||isset($seen[$device->token])) continue;
                if (!MobilePushPreference::find()->where(['user_id'=>$row->user_id,'company_code'=>$row->company_code,'app_id'=>$device->app_id,'enabled'=>1])->exists()) continue;
                try { $app=MobilePushApps::get($device->app_id,$device->project_id); }
                catch(\yii\web\ForbiddenHttpException $e) { continue; }
                catch(\yii\base\InvalidConfigException $e) { continue; }
                if ($app['companyCode']!==$row->company_code) continue;
                $seen[$device->token]=true;$key=$app['appId'].':'.$app['projectId'];$groups[$key]['app']=$app;
                $groups[$key]['items'][]=['recipient'=>$row->id,'device_id'=>$device->id,'user_id'=>$row->user_id,'company_code'=>$row->company_code,'payload'=>['to'=>$device->token,
                    'title'=>mb_substr($company->company_name?:$company->company_code,0,80),
                    'body'=>mb_substr(strip_tags($notice->title.': '.$notice->body),0,220),
                    'sound'=>'default','channelId'=>'class-reminders','priority'=>'high','expiration'=>$now+3600,
                    'data'=>['type'=>ClassInvitations::bookingPath($notice)?'class-invitation':'company-notification','companyCode'=>$row->company_code,'url'=>ClassInvitations::bookingPath($notice)?:('/group-notifications/view?id='.(int)$notice->id)]]];
            }
        }
        foreach($groups as $group) foreach(array_chunk($group['items'],100) as $items) {
            // A device can change accounts while a batch is being assembled.
            $items=array_values(array_filter($items,static function($item) use($group) {
                return CompanyPushNotifications::enabled($item['company_code'])
                    && MobilePushDevice::find()->where(['id'=>$item['device_id'],'user_id'=>$item['user_id'],
                    'company_code'=>$item['company_code'],'token'=>$item['payload']['to'],'enabled'=>1])->exists()
                    && MobilePushPreference::find()->where(['user_id'=>$item['user_id'],'company_code'=>$item['company_code'],
                        'app_id'=>$group['app']['appId'],'enabled'=>1])->exists();
            }));
            if (!$items) continue;
            try {
                $tickets=$client->request('send',array_column($items,'payload'),getenv($group['app']['accessTokenEnv']??'EXPO_ACCESS_TOKEN')?:null);
                foreach($items as $index=>$item) {
                    $id=$item['recipient'];$ticket=$tickets[$index]??[];
                    if (($ticket['status']??'')==='ok') $counts[$id]['accepted']++;
                    else { $counts[$id]['failed']++; if (($ticket['details']['error']??'')==='MessageRateExceeded') $counts[$id]['retry']=true; }
                }
            } catch(\Throwable $e) {
                foreach($items as $item) {
                    $id=$item['recipient'];
                    if ($e instanceof ExpoPushException&&!$e->ambiguous) { $counts[$id]['failed']++;$counts[$id]['retry']=$e->retryable; }
                    else $counts[$id]['uncertain']++;
                }
                Yii::warning('Company notification push request failed; provider content omitted.','mobile-push');
            }
        }
        $accepted=0;
        foreach($claimed as $id=>$row) {
            $count=$counts[$id];$accepted+=$count['accepted'];
            $status=$count['accepted']?($count['failed']||$count['uncertain']?'partial':'accepted'):
                ($count['uncertain']?'uncertain':($count['failed']?'failed':'in_app_only'));
            if (!$count['accepted']&&!$count['uncertain']&&$count['retry']&&$row->attempts<3) $status='pending';
            CompanyNotificationRecipient::updateAll(['push_status'=>$status,'updated_at'=>time(),
                'next_attempt_at'=>time()+60*$row->attempts],['id'=>$id,'push_status'=>'sending']);
        }
        return ['accepted'=>$accepted,'processed'=>count($claimed)];
    }
}
