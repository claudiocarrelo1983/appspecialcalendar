<?php
namespace common\helpers;
use common\models\GymBooking;

/** Sharing/reading an invitation never creates or implies a booking. */
final class InvitationBookingState
{
    public static function forSchedules(string $company,string $clientGuid,string $date,array $scheduleIds): array
    {
        if (!$scheduleIds) return [];
        $rows=GymBooking::find()->where(['company_code'=>$company,'client_guid'=>$clientGuid,
            'schedule_id'=>array_values(array_unique($scheduleIds)),'booking_date'=>$date,'active'=>1,
            'booking_status'=>[GymBooking::STATUS_BOOKED,GymBooking::STATUS_ATTENDED,
                GymBooking::STATUS_CHECKED_IN,GymBooking::STATUS_CHECKED_OUT]])->all();
        $result=[];foreach($rows as $row)$result[(int)$row->schedule_id]=$row;
        return $result;
    }
    public static function find(string $company,string $clientGuid,int $schedule,string $date): ?GymBooking
    {
        return GymBooking::find()->where(['company_code'=>$company,'client_guid'=>$clientGuid,
            'schedule_id'=>$schedule,'booking_date'=>$date,'active'=>1,
            'booking_status'=>[GymBooking::STATUS_BOOKED,GymBooking::STATUS_ATTENDED,
                GymBooking::STATUS_CHECKED_IN,GymBooking::STATUS_CHECKED_OUT]])->one();
    }
}
