<?php
namespace common\helpers;

use common\models\Company;
use common\models\HotelOperations;
use common\models\MobilePushDevice;
use common\models\MobilePushPreference;
use common\models\User;
use Yii;

/** Task records are the durable in-app notification; push delivery is best effort. */
class TaskAssignmentNotifications
{
    public static function recipient($guid, $company)
    {
        return User::find()->where(['guid' => $guid, 'active' => 1, 'status' => User::STATUS_ACTIVE])
            ->andWhere(['not in', 'level', ['client', 'reseller', 'driver']])
            ->andWhere(['or', ['company_code' => $company], ['company_code_parent' => $company]])->one();
    }

    public static function pending($company, $guid)
    {
        $checked = (new \yii\db\Query())->select(new \yii\db\Expression('1'))
            ->from(['log' => 'hotel_checklist_logs'])
            ->where('log.company_code = task.company_code AND log.operation_code = task.operation_code')
            ->andWhere(['log.guid' => $guid, 'log.type' => 'task', 'log.checklist' => 1]);
        $assignedAt = new \yii\db\Expression("COALESCE((SELECT MAX(assignment.created_date) FROM {{%hotel_checklist_logs}} assignment WHERE assignment.company_code = task.company_code AND assignment.operation_code = task.operation_code AND assignment.guid = task.assigned_to AND assignment.type = 'task-assignment'), task.created_date)");
        return HotelOperations::find()->alias('task')->select(['task.*', 'notification_created_at' => $assignedAt])->where([
            'task.company_code' => $company, 'task.assigned_to' => $guid, 'task.type' => 'task', 'task.active' => 1,
        ])->andWhere(['or', ['task.status' => null], ['not in', 'task.status', ['completed', 'resolved', 'cancelled']]])
            ->andWhere(['not exists', $checked])->orderBy(['notification_created_at' => SORT_DESC, 'task.id' => SORT_DESC])->asArray()->all();
    }

    private static function recordAssignment(HotelOperations $task): void
    {
        $recipient = self::recipient($task->assigned_to, $task->company_code);
        if (!$recipient) return;
        // Keep the durable notification even when push is disabled or unavailable.
        Yii::$app->db->createCommand()->insert('hotel_checklist_logs', [
            'company_code' => $task->company_code, 'operation_code' => $task->operation_code,
            'guid' => $task->assigned_to, 'level' => $recipient->level, 'room_code' => $task->room_code,
            'type' => 'task-assignment', 'checklist' => 0, 'created_date' => date('Y-m-d H:i:s'),
        ])->execute();
        Yii::$app->db->createCommand()->update('hotel_checklist_logs', ['checklist' => 0], [
            'company_code' => $task->company_code, 'operation_code' => $task->operation_code,
            'guid' => $task->assigned_to, 'type' => 'task',
        ])->execute();
    }

    public static function assigned(HotelOperations $task, $insert, array $changed, ExpoPushClient $client = null)
    {
        if ($task->type !== 'task' || !(int)$task->active || !$task->assigned_to
            || in_array($task->status, ['completed', 'resolved', 'cancelled'], true)
            ) return;
        try {
            $assignmentChanged = $insert || (array_key_exists('assigned_to', $changed) && $changed['assigned_to'] !== $task->assigned_to);
            if (!$assignmentChanged) {
                // An explicit save can recover a legacy assignment that never had
                // a timestamp/event. Preserve the unknown original creation date.
                $missingCreated = empty($task->created_date) || $task->created_date === '0000-00-00 00:00:00';
                if (!$missingCreated || (new \yii\db\Query())->from('hotel_checklist_logs')->where([
                    'company_code' => $task->company_code, 'operation_code' => $task->operation_code,
                    'guid' => $task->assigned_to, 'type' => 'task-assignment',
                ])->exists()) return;
            }
            self::recordAssignment($task);
            if (!CompanyPushNotifications::enabled($task->company_code)) return;
            $user = self::recipient($task->assigned_to, $task->company_code);
            $company = Company::findOne(['company_code' => $task->company_code, 'active' => 1]);
            if (!$user || !$company) return;
            $schema = Yii::$app->db->schema;
            if (!$schema->getTableSchema(MobilePushDevice::tableName()) || !$schema->getTableSchema(MobilePushPreference::tableName())) return;
            $client = $client ?: new ExpoPushClient();
            $seen = [];
            foreach (MobilePushDevice::find()->where([
                'user_id' => $user->id, 'company_code' => $task->company_code, 'enabled' => 1,
            ])->all() as $device) {
                if (!MobilePushDevice::validToken($device->token)) continue;
                $preference = MobilePushPreference::findOne([
                    'user_id' => $user->id, 'company_code' => $task->company_code, 'app_id' => $device->app_id, 'enabled' => 1,
                ]);
                if (!$preference) continue;
                try { $app = MobilePushApps::get($device->app_id, $device->project_id, $device->company_code); }
                catch (\yii\web\ForbiddenHttpException $e) { continue; }
                if ($app['companyCode'] !== $task->company_code || isset($seen[$device->token])) continue;
                $seen[$device->token] = true;
                $payload = [['to' => $device->token, 'title' => $company->company_name ?: $company->company_code,
                    'body' => Yii::t('app', 'task_push_assigned', ['title' => mb_substr(strip_tags($task->title), 0, 180)], $user->language_site ?: 'en'),
                    'sound' => 'default', 'channelId' => 'class-reminders', 'priority' => 'high', 'expiration' => time() + 3600,
                    'data' => ['type' => 'task-assigned', 'companyCode' => $task->company_code,
                        'url' => '/task-operations/view?id=' . (int)$task->id]]];
                try {
                    if (!CompanyPushNotifications::enabled($task->company_code)) return;
                    $tickets = $client->request('send', $payload, getenv($app['accessTokenEnv'] ?? 'EXPO_ACCESS_TOKEN') ?: null);
                    if (($tickets[0]['status'] ?? null) !== 'ok') {
                        Yii::warning(['task_id' => (int)$task->id, 'code' => 'task-push-rejected'], 'mobile-push');
                    }
                }
                catch (\Throwable $e) {
                    // Never log provider payloads, tokens or personal task content.
                    Yii::warning(['task_id' => (int)$task->id, 'code' => 'task-push-failed'], 'mobile-push');
                }
            }
        } catch (\Throwable $e) {
            // Missing push configuration must not discard an otherwise valid task.
            Yii::warning(['task_id' => (int)$task->id, 'code' => 'task-push-unavailable'], 'mobile-push');
        }
    }
}
