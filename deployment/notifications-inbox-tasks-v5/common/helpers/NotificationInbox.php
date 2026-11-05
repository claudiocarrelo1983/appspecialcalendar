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
                $rows[] = ['key'=>'notice:'.$notice->id, 'id'=>(int)$notice->id,
                    'type'=>ClassInvitations::bookingPath($notice) ? 'class-invitation' : 'notification',
                    'title'=>(string)$notice->title, 'body'=>mb_substr((string)$notice->body, 0, 180),
                    'created_at'=>(int)$notice->created_at, 'read'=>$recipient->read_at !== null,
                    'url'=>['/group-notifications/view', 'id'=>(int)$notice->id]];
            }
        }
        if (in_array($viewer->level, ['admin','team','cleaner','supervisor'], true)) {
            foreach (TaskAssignmentNotifications::pending($company, $viewer->guid) as $task) {
                $created = strtotime((string)($task['notification_created_at'] ?? $task['created_date'] ?? ''));
                if ($created === false || $created < $now - 15 * 86400) continue;
                $rows[] = ['key'=>'task:'.$task['id'], 'id'=>(int)$task['id'], 'type'=>'task',
                    'title'=>(string)$task['title'], 'body'=>mb_substr(strip_tags((string)$task['notes']), 0, 180),
                    'created_at'=>$created, 'read'=>false, 'url'=>['/task-operations/view','id'=>(int)$task['id']]];
            }
        }
        usort($rows, static fn($a,$b) => ($b['created_at'] <=> $a['created_at']) ?: ($b['id'] <=> $a['id']) ?: strcmp($a['key'],$b['key']));
        return $rows;
    }
}
