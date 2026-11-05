<?php
namespace common\helpers;

use common\models\GymBookingAlert;
use common\models\GymClass;
use common\models\GymClassRoom;
use Yii;

/** Explicit client-facing DTO; never serialize ActiveRecord objects or credentials. */
final class NativeClientBookings
{
    public static function validDate($date)
    {
        if (!is_string($date)) return false;
        $parsed=\DateTimeImmutable::createFromFormat('!Y-m-d',$date);
        return $parsed&&$parsed->format('Y-m-d')===$date;
    }
    public static function build(array $data,$date,array $managedClients)
    {
        $company=(string)$data['companyCode'];$client=$data['client'];$zone=new \DateTimeZone('Europe/Lisbon');
        $now=new \DateTimeImmutable('now',$zone);$rows=[];$filters=[];
        $scheduleIds=[];foreach($data['classes'] as $entry)if($entry['date']===$date)$scheduleIds[]=(int)$entry['schedule']->id;
        $recipientBookings=InvitationBookingState::forSchedules($company,(string)$client->guid,(string)$date,$scheduleIds);
        $action=static fn($kind,$label,$params,$enabled=true)=>['kind'=>$kind,'label'=>$label,'params'=>$params,'enabled'=>(bool)$enabled];
        foreach ($data['classes'] as $item) {
            if ($item['date']!==$date) continue;
            $class=$item['class'];$schedule=$item['schedule'];$start=$schedule->occurrenceStartTime($date);$end=$schedule->occurrenceEndTime($date);
            $event=['company_code'=>$company,'schedule_id'=>$schedule->id,'date'=>$date,'start_time'=>$start,'end_time'=>$end,
                'name'=>$class->name,'location'=>GymClassRoom::labelFor($schedule->occurrenceRoom($date),$company)?:'',
                'description'=>\common\models\GymClassSchedule::translatedDescription($schedule->dateOverride($date)['description']??$schedule->description?:$class->description),
                'url'=>GymClassAppLinks::classUrl($company,$date,$schedule->id)];
            $calendar=GymClassCalendarHelper::nativeEvent($event);$starts=new \DateTimeImmutable($calendar['startDate']);$ends=new \DateTimeImmutable($calendar['endDate']);
            $params=['company_code'=>$company,'client_guid'=>$client->guid,'class_code'=>$class->code,'date'=>$date,'schedule_id'=>(int)$schedule->id];
            $actions=[];$reason='';$booking=($recipientBookings[(int)$schedule->id]??null);$waitlist=$item['waitlist'];
            if ($booking) {
                if (DashboardGymClientHelper::cancellationInfo($booking)['allowed']) $actions[]=$action('cancel-booking',Yii::t('app','cancel_booking'),['id'=>(int)$booking->id]+$params);
                else $reason=Yii::t('app','cancellation_window_closed');
            } elseif ($waitlist) $actions[]=$action('leave-waitlist',Yii::t('app','leave_waitlist'),['id'=>(int)$waitlist->id]+$params);
            elseif ($item['booking_closed']) $reason=Yii::t('app',$item['booking_not_open']?'gym_booking_not_open':'class_booking_closed',['time'=>$item['booking_opens_at']]);
            elseif ($item['available']>0) {
                $canBook=DashboardGymClientHelper::canBook($client,$class,$date,$schedule,$company);
                if ($canBook!==true) $reason=(string)$canBook;
                $actions[]=$action('book',Yii::t('app','book_class'),$params,$canBook===true);
            } else $actions[]=$action('join-waitlist',Yii::t('app','join_waitlist'),$params);
            $price=!empty($item['individual_payment_available'])?Yii::$app->formatter->asCurrency($class->individual_price_cents/100,$class->individualCurrency()):null;
            if (!$booking&&!$waitlist&&!$item['booking_closed']&&$item['available']>0&&$price) {
                $actions[]=$action('start-stripe-payment',Yii::t('app','book_and_pay').' '.$price,$params,!empty($data['stripePaymentSettings'])&&$data['stripePaymentSettings']->canAcceptPayments());
            }
            $participants=[];
            foreach ($item['participants']??[] as $participant) if($participant->client)$participants[]=['name'=>(string)($participant->client->full_name?:$participant->client->username)];
            $filters[$class->code]=['code'=>$class->code,'label'=>$class->name];
            $rows[]=['key'=>$schedule->id.':'.$date,'schedule_id'=>(int)$schedule->id,'date'=>$date,'class_code'=>$class->code,'class_name'=>$class->name,
                'start_time'=>substr($start,0,5),'end_time'=>substr($end,0,5),'startDate'=>$calendar['startDate'],'endDate'=>$calendar['endDate'],
                'past'=>$starts<$now,'status'=>$ends<=$now?'finished':($starts<=$now?'in_progress':'upcoming'),
                'coach'=>(string)($class->instructor->full_name??''),'room'=>$event['location'],'description'=>html_entity_decode(strip_tags((string)$event['description']),ENT_QUOTES,'UTF-8'),
                'capacity'=>(int)$class->max_capacity,'available'=>(int)$item['available'],'registered'=>(int)$item['booked'],'booked'=>(bool)$booking,'booking_id'=>$booking?(int)$booking->id:null,'booking_client_guid'=>$booking?(string)$booking->client_guid:null,'waitlisted'=>(bool)$waitlist,
                'reason'=>$reason,'opensAt'=>$item['booking_opens_at'],'closesAt'=>$item['booking_closes_at'],'actions'=>$actions,'participants'=>$participants,
                'price'=>$price,'shareUrl'=>$event['url'],'calendarEvent'=>$calendar,'calendarUrl'=>GymClassCalendarHelper::googleUrl($event)];
        }
        $alerts=[];$alertsReady=GymBookingAlert::available();
        if($alertsReady){
            $selected=GymBookingAlert::find()->select('class_code')->where(['company_code'=>$company,'user_id'=>Yii::$app->user->id,'enabled'=>1])->column();
            foreach(GymClass::find()->where(['company_code'=>$company,'active'=>1])->orderBy(['name'=>SORT_ASC])->all() as $class)
                $alerts[]=['code'=>$class->code,'name'=>$class->name,'enabled'=>in_array($class->code,$selected,true)];
        }
        $family=[];foreach($managedClients as $member)$family[]=['guid'=>$member->guid,'name'=>$member->full_name?:$member->username];
        $waivers=[];foreach($data['waivers']['pending']??[] as $waiver)$waivers[]=['code'=>$waiver->code,'title'=>(string)($waiver->title??Yii::t('app','waivers')),
            'content'=>html_entity_decode(strip_tags(preg_replace('/<\/(p|div|li|h[1-6])>/i',"\n",(string)$waiver->content)),ENT_QUOTES,'UTF-8')];
        $history=[];
        foreach(array_merge($data['upcomingBookings']??[],$data['classHistory']??[]) as $entry){
            $history[(int)$entry->id]=['id'=>(int)$entry->id,'title'=>(string)($entry->gymClass->name??''),'date'=>(string)$entry->booking_date,
                'time'=>(string)$entry->start_datetime,'status'=>(string)$entry->booking_status];
        }
        $photo=null;
        foreach(['image','photo','avatar'] as $attribute) {
            if(method_exists($client,'hasAttribute')&&$client->hasAttribute($attribute)&&!empty($client->{$attribute})) {
                $photo=NativeGymService::profileImageUrl((string)$client->{$attribute});break;
            }
        }
        $club=\common\models\Company::find()->where(['company_code'=>$company])->one();
        $membership=$data['membership']['model']??null;
        $status=$membership?'active':'inactive';
        if($membership&&!empty($membership->start_date)&&substr($membership->start_date,0,10)>$now->format('Y-m-d'))$status='upcoming';
        $upcomingIds=array_fill_keys(array_map(static fn($entry)=>(int)$entry->id,$data['upcomingBookings']??[]),true);
        return ['member'=>['name'=>(string)($client->full_name??$client->username??''),'number'=>(int)($client->id??0),'avatarUrl'=>$photo,'companyName'=>(string)($club->company_name??$company),'status'=>$status],
            'upcomingBookings'=>array_values(array_filter($history,static fn($entry)=>isset($upcomingIds[$entry['id']]))),
            'bookingHistory'=>array_values(array_filter($history,static fn($entry)=>!isset($upcomingIds[$entry['id']]))),
            'revision'=>'native-client-bookings-v1','date'=>$date,'today'=>$now->format('Y-m-d'),'serverTime'=>$now->format(DATE_ATOM),'companyCode'=>$company,
            'membership'=>!empty($data['membership']['model'])?['title'=>(string)$data['membership']['model']->title,'start'=>(string)$data['membership']['model']->start_date,'end'=>(string)$data['membership']['model']->end_date]:null,'clientGuid'=>$client->guid,'family'=>$family,'rows'=>$rows,'classFilters'=>array_values($filters),'alerts'=>$alerts,'alertsReady'=>$alertsReady,
            'openingWindow'=>DashboardGymClientHelper::bookingWindowHours($company),'waivers'=>$waivers,'history'=>array_values($history),
            'kpis'=>array_map(static fn($value)=>is_scalar($value)||$value===null?$value:null,$data['kpis']??[])];
    }
}
