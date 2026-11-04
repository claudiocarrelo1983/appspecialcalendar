<?php
namespace common\helpers;

use common\models\CompanyNotification;
use common\models\CompanyNotificationForm;
use common\models\GymClassSchedule;
use Yii;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;

class ClassInvitations
{
    public static function companyForHost($host,$fallback)
    {
        if (!preg_match('/^(c[0-9]+)\.specialcalendar\.com$/Di',$host,$match)) return $fallback;
        $company=\common\models\Company::findOne(['company_code_url'=>strtolower($match[1]),'active'=>1]);
        if (!$company) throw new \yii\web\NotFoundHttpException();
        return $company->company_code;
    }
    public static function canShare($company)
    {
        return !Yii::$app->user->isGuest && (CompanyNotificationService::canManage($company)
            || CompanyNotificationService::eligibleUsers($company)->andWhere(['recipient.id'=>Yii::$app->user->id])->exists());
    }
    public static function clients($company)
    {
        return CompanyNotificationService::eligibleUsers($company)
            ->andWhere(['recipient.level'=>'client'])
            ->andWhere(['<>','recipient.id',Yii::$app->user->id]);
    }
    public static function searchClients($company,$q)
    {
        $query=self::clients($company);
        $schema=\common\models\User::getTableSchema();
        $fields=array_values(array_filter(['full_name','first_name','last_name','username'],static fn($field)=>isset($schema->columns[$field])));
        foreach (array_slice(preg_split('/\s+/u',trim($q),-1,PREG_SPLIT_NO_EMPTY),0,10) as $term) {
            $condition=['or'];
            foreach ($fields as $field) $condition[]=['like','recipient.'.$field,$term];
            $query->andWhere($condition);
        }
        return $query->orderBy(['recipient.full_name'=>SORT_ASC,'recipient.id'=>SORT_ASC])->limit(20);
    }
    public static function clientName($user)
    {
        $name=trim((string)$user->full_name);
        if ($name==='') $name=trim(($user->hasAttribute('first_name')?(string)$user->first_name:'').' '.($user->hasAttribute('last_name')?(string)$user->last_name:''));
        return $name!==''?$name:(string)$user->username;
    }

    public static function bookingPath($notice)
    {
        $data=json_decode((string)$notice->selection,true);
        if (!is_array($data)||($data['kind']??null)!=='class-invitation') return null;
        $date=$data['date']??null;$schedule=$data['schedule_id']??null;
        if (!is_string($date)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date)
            ||date('Y-m-d',strtotime($date))!==$date||!is_int($schedule)||$schedule<1) return null;
        return '/dashboard-gym-client/index?'.http_build_query(['company_code'=>$notice->company_code,
            'date'=>$date,'schedule_id'=>$schedule], '', '&', PHP_QUERY_RFC3986);
    }

    public static function send($company,$scheduleId,$date,$recipientId,$token)
    {
        if (!self::canShare($company)) throw new ForbiddenHttpException();
        if (!is_string($date)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date)||date('Y-m-d',strtotime($date))!==$date
            ||!is_string($token)||!preg_match('/^[a-f0-9-]{36}$/Di',$token)) throw new BadRequestHttpException();
        $schedule=GymClassSchedule::findOne(['id'=>$scheduleId,'company_code'=>$company,'active'=>1]);
        if (!$schedule||!$schedule->gymClass||!(int)$schedule->gymClass->active||!$schedule->isAvailableOn($date)
            ||!self::clients($company)->andWhere(['recipient.id'=>$recipientId])->exists()) throw new ForbiddenHttpException();
        $start=new \DateTimeImmutable($date.' '.$schedule->occurrenceStartTime($date),new \DateTimeZone('Europe/Lisbon'));
        if ($start<=new \DateTimeImmutable('now',new \DateTimeZone('Europe/Lisbon'))) throw new BadRequestHttpException(Yii::t('app','This class has already started.'),4201);
        if (!CompanyNotificationService::available()) throw new \yii\web\ServiceUnavailableHttpException();
        $key=hash('sha256',json_encode([$company,(int)Yii::$app->user->id,(int)$scheduleId,$date,(int)$recipientId,$token]));
        $existing=CompanyNotification::findOne(['company_code'=>$company,'created_by'=>Yii::$app->user->id,'submission_key'=>$key]);
        if ($existing) return $existing;
        if (CompanyNotification::find()->where(['company_code'=>$company,'created_by'=>Yii::$app->user->id])
            ->andWhere(['>=','created_at',time()-60])->count()>=20) throw new \yii\web\TooManyRequestsHttpException();
        $sender=Yii::$app->user->identity->full_name?:Yii::$app->user->identity->username;
        $form=new CompanyNotificationForm(['title'=>mb_substr(Yii::t('app','Class invitation').': '.$schedule->gymClass->name,0,160),
            'body'=>mb_substr($sender,0,100).' — '.$schedule->gymClass->name.' · '.$date.' · '.substr($schedule->occurrenceStartTime($date),0,5),
            'recipient_mode'=>'people','people'=>[(string)$recipientId],'submission_key'=>$key]);
        try {
            return Yii::$app->db->transaction(function() use($form,$company,$scheduleId,$date,$recipientId){
                $notice=CompanyNotificationService::createClassInvitation($form,$company);
                $notice->updateAttributes(['selection'=>json_encode(['kind'=>'class-invitation','schedule_id'=>(int)$scheduleId,'date'=>$date,'people'=>[(int)$recipientId]])]);
                return $notice;
            });
        } catch (\yii\db\IntegrityException $error) {
            $existing=CompanyNotification::findOne(['company_code'=>$company,'created_by'=>Yii::$app->user->id,'submission_key'=>$key]);
            if ($existing) return $existing;
            throw $error;
        }
    }
}
