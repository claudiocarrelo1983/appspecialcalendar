<?php
namespace common\helpers;

use common\models\User;
use Yii;

/** The signed-in recipient's messages and active assigned tasks, never company-wide tasks. */
final class NotificationInbox
{
    public static function rows(string $company, User $viewer, ?int $now = null): array
    {
        $now = $now ?? time();
        $rows = [];
        if (CompanyNotificationService::available()) {
            foreach (CompanyNotificationService::inbox($company, $viewer->id, $now)->all() as $recipient) {
                $notice = $recipient->notification;
                if (!$notice) continue;
                $invitation=ClassInvitations::bookingPath($notice);
                $booking=[];if($invitation)parse_str((string)parse_url($invitation,PHP_URL_QUERY),$booking);
                $rows[] = ['key'=>'notice:'.$notice->id, 'id'=>(int)$notice->id,
                    'type'=>ClassInvitations::bookingPath($notice) ? 'class-invitation' : 'notification',
                    'title'=>(string)$notice->title, 'body'=>mb_substr((string)$notice->body, 0, 180),
                    'created_at'=>(int)$notice->created_at, 'read'=>$recipient->read_at !== null,
                    'url'=>['/group-notifications/view', 'id'=>(int)$notice->id],
                    'bookingQuery'=>['company_code'=>$company,'date'=>$booking['date']??null], 'schedule'=>$booking['schedule_id']??null];
            }
        }
        if (in_array($viewer->level, ['admin','team','cleaner','supervisor'], true)) {
            foreach (TaskAssignmentNotifications::inbox($company, $viewer->guid) as $task) {
                $created = strtotime((string)($task['notification_created_at'] ?? $task['created_date'] ?? ''));
                if ($created !== false && $created < $now - 15 * 86400) continue;
                $rows[] = ['key'=>'task:'.$task['id'], 'id'=>(int)$task['id'], 'type'=>'task',
                    'title'=>(string)$task['title'], 'body'=>mb_substr(strip_tags((string)$task['notes']), 0, 180),
                    'created_at'=>$created===false?null:$created,
                    'read'=>in_array($task['status'],['completed','resolved'],true)||(bool)$task['notification_checked'],
                    'url'=>['/task-operations/view','id'=>(int)$task['id']]];
            }
        }
        usort($rows, static fn($a,$b) => ($b['created_at'] <=> $a['created_at']) ?: ($b['id'] <=> $a['id']) ?: strcmp($a['key'],$b['key']));
        return $rows;
    }
}
