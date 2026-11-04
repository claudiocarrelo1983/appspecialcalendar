<?php
namespace common\helpers;

use common\models\CompanyUserMembership;
use common\models\GymBooking;
use common\models\GymClassSchedule;
use common\models\MobileClassReminder;
use common\models\MobilePushCompanySettings;
use common\models\MobilePushDevice;
use common\models\MobilePushOccurrence;
use common\models\MobilePushPreference;
use common\models\Sheddule;
use common\models\User;
use Yii;

/** Database outbox. Acceptance by Expo/APNs/FCM is not proof of device delivery. */
class ClassReminderService
{
    private $deliveryNow;
    const LEAD_SECONDS = 3600;
    const MAX_ATTEMPTS = 5;

    public static function settings($companyCode)
    {
        $row = MobilePushCompanySettings::findOne(['company_code' => $companyCode]);
        $zone = $row ? $row->timezone : Yii::$app->timeZone;
        new \DateTimeZone($zone);
        return ['minutes' => $row ? (int)$row->reminder_minutes : 60, 'timezone' => $zone];
    }

    public static function timestamp($value, $timezone = 'Europe/Lisbon')
    {
        return (new \DateTimeImmutable($value, new \DateTimeZone($timezone)))->getTimestamp();
    }

    public static function isDue($startsAt, $now, $minutes = 60)
    {
        $due = $startsAt - $minutes * 60;
        // A delayed scheduler must not silently lose an unsent reminder. The outbox
        // occurrence key prevents duplicates; never catch up after the class starts.
        return $startsAt > $now && $now >= $due;
    }

    public static function hasAccess(User $user, $company)
    {
        if (!(int)$user->active || (int)$user->status !== User::STATUS_ACTIVE) { return false; }
        if (Yii::$app->db->schema->getTableSchema(CompanyUserMembership::tableName()) === null) {
            return $user->company_code === $company;
        }
        return CompanyUserMembership::find()->where(['user_id' => $user->id, 'company_code' => $company,
            'status' => CompanyUserMembership::STATUS_APPROVED])->andWhere(['<=', 'access_start', date('Y-m-d')])
            ->andWhere(['or', ['access_expires' => null], ['>=', 'access_expires', date('Y-m-d')]])->exists();
    }

    private function groupBooking($booking, User $user, $company = null, $timezone = 'Europe/Lisbon')
    {
        $company = $company ?: $user->company_code;
        if (!$booking || $booking->client_guid !== $user->guid || $booking->company_code !== $company
            || !$booking->active || $booking->booking_status !== GymBooking::STATUS_BOOKED) { return null; }
        $schedule = $booking->schedule;
        $class = $booking->gymClass;
        if (!$schedule || !$class || !$schedule->active || !$class->active || !$schedule->isAvailableOn($booking->booking_date)) { return null; }
        return ['type' => 'group', 'id' => (int)$booking->id, 'classId' => $class->code, 'language' => $user->language_site,
            'start' => self::timestamp($booking->booking_date . ' ' . $schedule->occurrenceStartTime($booking->booking_date), $timezone),
            'name' => $class->name, 'route' => ['company_code' => $company, 'date' => $booking->booking_date,
                'schedule_id' => $booking->schedule_id, 'booking_id' => $booking->id]];
    }

    public static function isCompanyAdmin(User $user, $company)
    {
        return $user->level === 'admin' && $user->company_code === $company;
    }

    private function groupSchedule($schedule, $date, User $user, $company, $timezone)
    {
        if (!self::isCompanyAdmin($user, $company) || !$schedule || !$schedule->active
            || $schedule->company_code !== $company || !$schedule->isAvailableOn($date)) return null;
        $class = $schedule->gymClass;
        if (!$class || !$class->active || $class->company_code !== $company) return null;
        // Once an admin chooses categories without an opening window, the shared
        // category candidates own these reminders; avoid duplicates and opt-outs.
        if (!DashboardGymClientHelper::bookingWindowHours($company) && \common\models\GymBookingAlert::available()
            && \common\models\GymBookingAlert::find()->where(['user_id' => $user->id, 'company_code' => $company])->exists()) return null;
        return ['type' => 'group_schedule', 'id' => (int)$schedule->id, 'classId' => $class->code,
            'language' => $user->language_site, 'name' => $class->name,
            'start' => self::timestamp($date . ' ' . $schedule->occurrenceStartTime($date), $timezone),
            'route' => ['company_code' => $company, 'date' => $date, 'class_code' => $class->code]];
    }

    private function personalBooking(array $row, User $user, $company = null, $timezone = 'Europe/Lisbon', $admin = false)
    {
        $company = $company ?: $user->company_code;
        if (($admin ? !self::isCompanyAdmin($user, $company) : $row['client_username'] !== $user->guid) || $row['company_code'] !== $company
            || !(int)($row['active'] ?? 1)
            || !in_array(DashboardPersonalClassBookingsHelper::statusKey($row['booking_status'] ?? ''), ['booked', 'confirmed'], true)) { return null; }
        return ['type' => $admin ? 'personal_admin' : 'personal', 'id' => (int)$row['id'], 'classId' => $row['package_code'] ?? '', 'language' => $user->language_site,
            'start' => self::timestamp($row['date'] . ' ' . $row['time'], $timezone),
            'name' => $row['service_name'] ?: ($row['package_title'] ?? ''),
            'route' => ['company_code' => $row['company_code'], 'date' => $row['date'], 'booking_id' => $row['id']]];
    }

    private function candidates(User $user, $company, $now, array $settings)
    {
        yield from GymBookingOpeningAlerts::candidates($user, $company, $now);
        $zone = new \DateTimeZone($settings['timezone']);
        $from = (new \DateTimeImmutable('@' . $now))->setTimezone($zone)->format('Y-m-d');
        $to = (new \DateTimeImmutable('@' . ($now + $settings['minutes'] * 60)))->setTimezone($zone)->format('Y-m-d');
        $admin = self::isCompanyAdmin($user, $company);
        if ($admin) {
            foreach (GymClassSchedule::find()->with('gymClass')->where(['company_code' => $company, 'active' => 1])->each() as $schedule) {
                for ($day = new \DateTimeImmutable($from, $zone); $day->format('Y-m-d') <= $to; $day = $day->modify('+1 day')) {
                    $candidate = $this->groupSchedule($schedule, $day->format('Y-m-d'), $user, $company, $settings['timezone']);
                    if ($candidate && self::isDue($candidate['start'], $now, $settings['minutes'])) yield $candidate;
                }
            }
        }
        $query = GymBooking::find()->with(['schedule', 'gymClass'])->where(['client_guid' => $user->guid,
            'company_code' => $company, 'active' => 1, 'booking_status' => GymBooking::STATUS_BOOKED])
            ->andWhere(['between', 'booking_date', $from, $to]);
        foreach ($admin ? [] : $query->each() as $booking) {
            $candidate = $this->groupBooking($booking, $user, $company, $settings['timezone']);
            if ($candidate && self::isDue($candidate['start'], $now, $settings['minutes'])) { yield $candidate; }
        }
        if (Yii::$app->db->schema->getTableSchema(Sheddule::tableName()) !== null
            && Yii::$app->db->schema->getTableSchema(\common\models\PersonalClassPurchase::tableName()) !== null) {
            $personal = DashboardPersonalClassBookingsHelper::query($company, null, false)
                ->select(['personal_booking.*', 'package_title' => 'personal_purchase.title'])->asArray()
                ->andWhere(['between', 'personal_booking.date', $from, $to]);
            if (!$admin) $personal->andWhere(['personal_booking.client_username' => $user->guid]);
            foreach ($personal->each() as $row) {
                $candidate = $this->personalBooking($row, $user, $company, $settings['timezone'], $admin);
                if ($candidate && self::isDue($candidate['start'], $now, $settings['minutes'])) { yield $candidate; }
            }
        }
    }

    public function candidateForDelivery(MobileClassReminder $delivery)
    {
        $user = User::findOne($delivery->user_id);
        if (!$user || !self::hasAccess($user, $delivery->company_code)) { return null; }
        $settings = self::settings($delivery->company_code);
        if ($delivery->booking_type === 'booking_open') {
            $schedule = GymClassSchedule::findOne($delivery->booking_id);
            $date = (new \DateTimeImmutable('@' . $delivery->starts_at))->setTimezone(new \DateTimeZone($settings['timezone']))->format('Y-m-d');
            return $schedule ? GymBookingOpeningAlerts::candidate($user, $delivery->company_code, $schedule, $date, $this->deliveryNow ?? time()) : null;
        } elseif ($delivery->booking_type === 'group') {
            $candidate = $this->groupBooking(GymBooking::findOne($delivery->booking_id), $user, $delivery->company_code, $settings['timezone']);
        } elseif ($delivery->booking_type === 'group_schedule') {
            $date = (new \DateTimeImmutable('@' . $delivery->starts_at))->setTimezone(new \DateTimeZone($settings['timezone']))->format('Y-m-d');
            $candidate = $this->groupSchedule(GymClassSchedule::findOne($delivery->booking_id), $date, $user, $delivery->company_code, $settings['timezone']);
        } elseif (in_array($delivery->booking_type, ['personal', 'personal_admin'], true)) {
            $row = Sheddule::find()->where(['id' => $delivery->booking_id])->asArray()->one();
            $candidate = $row ? $this->personalBooking($row, $user, $delivery->company_code, $settings['timezone'], $delivery->booking_type === 'personal_admin') : null;
        } else $candidate = null;
        if ($candidate) { $candidate['remindAt'] = $candidate['start'] - $settings['minutes'] * 60; }
        return $candidate;
    }

    public static function openedInformation(MobileClassReminder $delivery, $candidate = null, $now = null)
    {
        $now = $now ?? time();
        $settings = self::settings($delivery->company_code);
        $zone = new \DateTimeZone($settings['timezone']);
        $date = (new \DateTimeImmutable('@' . $delivery->starts_at))->setTimezone($zone)->format('Y-m-d');
        $info = ['user_id' => (int)$delivery->user_id, 'company_code' => $delivery->company_code,
            'name' => $candidate['name'] ?? '', 'starts_at' => (int)$delivery->starts_at,
            'timezone' => $settings['timezone'], 'state' => $candidate ? 'scheduled' : 'unavailable'];
        $schedule = null;
        if ($delivery->booking_type === 'group') {
            $booking = GymBooking::findOne(['id' => $delivery->booking_id, 'company_code' => $delivery->company_code]);
            if ($booking) {
                $schedule = $booking->schedule;
                $info['name'] = $booking->gymClass->name ?? $info['name'];
                if (!$booking->active || $booking->booking_status === GymBooking::STATUS_CANCELLED) $info['state'] = 'cancelled';
            }
        } elseif (in_array($delivery->booking_type, ['group_schedule', 'booking_open'], true)) {
            $schedule = GymClassSchedule::findOne(['id' => $delivery->booking_id, 'company_code' => $delivery->company_code]);
            if ($schedule) $info['name'] = $schedule->gymClass->name ?? $info['name'];
        }
        if ($schedule && $schedule->company_code === $delivery->company_code && $info['state'] !== 'cancelled') {
            $start = self::timestamp($date . ' ' . $schedule->occurrenceStartTime($date), $settings['timezone']);
            if ($start !== (int)$delivery->starts_at) $info['state'] = 'changed';
            elseif (!$schedule->active || !$schedule->isAvailableOn($date) || !$schedule->gymClass || !$schedule->gymClass->active) $info['state'] = 'unavailable';
            else {
                $end = self::timestamp($schedule->occurrenceEndDateTime($date), $settings['timezone']);
                $info['state'] = $end <= $now ? 'finished' : ($start <= $now ? 'in_progress' : 'scheduled');
            }
        } elseif ($info['state'] !== 'cancelled' && $delivery->starts_at <= $now) {
            $info['state'] = 'past';
        }
        // Delivery eligibility can expire before the user taps the notification.
        // Keep a validated occurrence link; the current dashboard supplies the
        // permitted Book/Cancel forms and rechecks their rules on submission.
        $info['actionable'] = false;
        if ($schedule && $schedule->company_code === $delivery->company_code && in_array($info['state'], ['scheduled','in_progress','finished'], true)) {
            $info['route'] = ['company_code'=>$delivery->company_code,'date'=>$date,'schedule_id'=>(int)$schedule->id];
            $info['actionable'] = $info['state'] === 'scheduled' && in_array($delivery->booking_type, ['group','booking_open'], true);
        }
        return $info;
    }

    private function eligibleDevice(MobilePushDevice $device)
    {
        if (!$device->enabled || !MobilePushDevice::validToken($device->token)
            || !CompanyPushNotifications::enabled($device->company_code)) { return false; }
        $preference = MobilePushPreference::findOne(['user_id' => $device->user_id, 'company_code' => $device->company_code, 'app_id' => $device->app_id]);
        return $preference && $preference->enabled;
    }

    /** Read-only aggregate diagnostics: no tokens, credentials or recipient names. */
    public function diagnostics($now = null)
    {
        $now = $now ?? time();
        $result=['worker_time'=>date(DATE_ATOM,$now),'environment'=>YII_ENV,'default_timezone'=>Yii::$app->timeZone,
            'configured_apps'=>count(MobilePushApps::all()),
            'enabled_devices'=>0,'eligible_devices'=>0,'due_candidates'=>0,
            'skipped'=>['token_or_preference'=>0,'unknown_app'=>0,'company_or_membership'=>0],
            'lead_times_minutes'=>[],'recent_delivery_statuses'=>[]];
        foreach (MobilePushDevice::find()->where(['enabled'=>1])->each() as $device) {
            $result['enabled_devices']++;
            if (!$this->eligibleDevice($device)) { $result['skipped']['token_or_preference']++; continue; }
            try { $app=MobilePushApps::get($device->app_id,$device->project_id); }
            catch (\yii\web\ForbiddenHttpException $e) { $result['skipped']['unknown_app']++; continue; }
            $user=User::findOne($device->user_id);
            if (!$user||$device->company_code!==$app['companyCode']||!self::hasAccess($user,$device->company_code)) {
                $result['skipped']['company_or_membership']++; continue;
            }
            $result['eligible_devices']++;
            $settings=self::settings($device->company_code);
            $result['lead_times_minutes'][]=$settings['minutes'];
            foreach ($this->candidates($user,$device->company_code,$now,$settings) as $candidate) $result['due_candidates']++;
        }
        $result['lead_times_minutes']=array_values(array_unique($result['lead_times_minutes']));
        $result['recent_delivery_statuses']=(new \yii\db\Query())->select(['status','error_code','count'=>new \yii\db\Expression('COUNT(*)')])
            ->from(MobileClassReminder::tableName())->where(['>=','updated_at',$now-86400])->groupBy(['status','error_code'])->all();
        return $result;
    }

    private function fresh(MobileClassReminder $delivery, $now)
    {
        $device = MobilePushDevice::findOne($delivery->device_id);
        if (!$device || !$this->eligibleDevice($device) || (int)$device->user_id !== (int)$delivery->user_id
            || $device->company_code !== $delivery->company_code || $device->app_id !== $delivery->app_id
            || $device->project_id !== $delivery->project_id || (int)$device->binding_version !== (int)$delivery->binding_version
            || !hash_equals((string)$delivery->token_hash, hash('sha256', $device->token))) { return null; }
        try { $app = MobilePushApps::get($device->app_id, $device->project_id); }
        catch (\yii\web\ForbiddenHttpException $e) { return null; }
        if ($app['companyCode'] !== $device->company_code) { return null; }
        $this->deliveryNow = $now;
        try { $candidate = $this->candidateForDelivery($delivery); }
        finally { $this->deliveryNow = null; }
        return $candidate && $candidate['start'] === (int)$delivery->starts_at && $candidate['start'] > $now
            ? [$device, $candidate, $app] : null;
    }

    private function enqueue(MobilePushDevice $device, array $candidate, $now)
    {
        $key = ['company_code' => $device->company_code, 'booking_type' => $candidate['type'],
            'booking_id' => $candidate['id'], 'starts_at' => $candidate['start'], 'reminder_type' => 'class-reminder'];
        Yii::$app->db->createCommand()->upsert(MobilePushOccurrence::tableName(), $key + [
            'occurrence_key' => MobilePushKeys::occurrence($key), 'created_at' => $now], false)->execute();
        $occurrence = MobilePushOccurrence::findOne($key);
        Yii::$app->db->createCommand()->upsert(MobileClassReminder::tableName(), [
            'reminder_id' => $occurrence->id, 'device_id' => $device->id, 'booking_type' => $candidate['type'],
            'booking_id' => $candidate['id'], 'starts_at' => $candidate['start'], 'status' => 'pending',
            'user_id' => $device->user_id, 'company_code' => $device->company_code,
            'app_id' => $device->app_id, 'project_id' => $device->project_id, 'binding_version' => $device->binding_version,
            'token_hash' => hash('sha256', $device->token), 'open_code' => bin2hex(random_bytes(32)),
            'next_attempt_at' => $now, 'created_at' => $now, 'updated_at' => $now,
        ], false)->execute();
        $delivery = MobileClassReminder::findOne(['reminder_id' => $occurrence->id, 'device_id' => $device->id]);
        if ($delivery && (int)$delivery->user_id === (int)$device->user_id
            && (int)$delivery->binding_version !== (int)$device->binding_version && $delivery->attempts < self::MAX_ATTEMPTS) {
            // A refreshed token may replace an unsent snapshot; accepted deliveries are immutable.
            MobileClassReminder::updateAll(['binding_version' => $device->binding_version,
                'token_hash' => hash('sha256', $device->token), 'status' => 'pending', 'next_attempt_at' => $now,
                'updated_at' => $now], ['id' => $delivery->id, 'user_id' => $device->user_id,
                'status' => ['pending', 'retry', 'skipped']]);
        }
    }

    private function finish(MobileClassReminder $row, $status, $code, $now, array $extra = [])
    {
        $updated = MobileClassReminder::updateAll($extra + ['status' => $status, 'error_code' => $code, 'updated_at' => $now],
            ['id' => $row->id, 'status' => $row->status]);
        if ($updated) { $row->status = $status; }
        if ($updated && $status === 'receipt_unknown') { Yii::error(['delivery_id' => (int)$row->id, 'code' => $code], 'mobile-push'); }
    }

    private function fail(MobileClassReminder $row, $code, $retryable, $ambiguous, $now)
    {
        $delay = min(900, 60 * (2 ** max(0, (int)$row->attempts - 1)));
        $retry = $retryable && !$ambiguous && $row->attempts < self::MAX_ATTEMPTS && $now + $delay < $row->starts_at;
        $this->finish($row, $ambiguous ? 'uncertain' : ($retry ? 'retry' : 'failed'), $code, $now, ['next_attempt_at' => $now + $delay]);
        $log = ['delivery_id' => (int)$row->id, 'code' => $code, 'retry' => $retry];
        if ($retry) { Yii::warning($log, 'mobile-push'); } else { Yii::error($log, 'mobile-push'); }
    }

    private function invalidate(MobileClassReminder $row, $now)
    {
        MobilePushDevice::updateAll(['enabled' => 0, 'updated_at' => $now], ['id' => $row->device_id,
            'user_id' => $row->user_id, 'binding_version' => $row->binding_version]);
    }

    private function credential(array $app)
    {
        $name = $app['accessTokenEnv'] ?? 'EXPO_ACCESS_TOKEN';
        if (!is_string($name) || !preg_match('/^[A-Z][A-Z0-9_]*$/D', $name)) { throw new \RuntimeException('Invalid push credential configuration.'); }
        return getenv($name) ?: null;
    }

    public static function payloadFor(MobileClassReminder $row, MobilePushDevice $device, array $candidate, array $app, $now)
    {
        Yii::$app->i18n->translations['class-reminders'] = ['class' => \yii\i18n\PhpMessageSource::class,
            'basePath' => '@frontend/messages', 'forceTranslation' => true];
        $language = strtolower(substr(($candidate['language'] ?? '') ?: ($device->language ?: 'en'), 0, 2));
        if (!in_array($language, ['pt', 'en', 'es', 'fr', 'de', 'it'], true)) { $language = 'en'; }
        $minutes = max(1, (int)ceil(($candidate['start'] - $now) / 60));
        $key = $minutes === 60 ? 'class_reminder_one_hour' : 'class_reminder_minutes';
        if ($candidate['type'] === 'booking_open' && ($candidate['openingAlert'] ?? true)) $key = 'class_booking_open';
        return ['to' => $device->token, 'sound' => 'default', 'channelId' => 'class-reminders', 'priority' => 'high',
            'expiration' => min($now + 600, $candidate['start'] - 1),
            'title' => mb_substr($app['title'], 0, 80), 'body' => Yii::t('class-reminders', $key,
                ['class' => mb_substr($candidate['name'], 0, 80), 'minutes' => $minutes], $language),
            'data' => ['type' => 'class-reminder', 'bookingId' => $candidate['id'], 'classId' => $candidate['classId'],
                'occurrence' => $candidate['start'], 'appId' => $row->app_id, 'projectId' => $row->project_id,
                'url' => '/mobile-notifications/open?code=' . $row->open_code]];
    }

    public function run($send = false, $now = null, ExpoPushClient $client = null, $limit = 100)
    {
        $fixedNow = $now;
        $now = $now ?? time();
        $client = $client ?: new ExpoPushClient();
        $limit = max(1, min(500, (int)$limit));
        $counts = ['due' => 0, 'accepted' => 0, 'skipped' => 0, 'failed' => 0];
        foreach (MobilePushDevice::find()->where(['enabled' => 1])->andWhere(['not', ['app_id' => null]])->each() as $device) {
            if (!$this->eligibleDevice($device)) { continue; }
            try { $app = MobilePushApps::get($device->app_id, $device->project_id); }
            catch (\yii\web\ForbiddenHttpException $e) { continue; }
            $user = User::findOne($device->user_id);
            if (!$user || $device->company_code !== $app['companyCode'] || !self::hasAccess($user, $device->company_code)) { continue; }
            foreach ($this->candidates($user, $device->company_code, $now, self::settings($device->company_code)) as $candidate) {
                $counts['due']++;
                if ($send) { $this->enqueue($device, $candidate, $now); }
            }
        }
        if (!$send) { return $counts; }
        MobileClassReminder::updateAll(['status' => 'uncertain', 'error_code' => 'worker-interrupted', 'updated_at' => $now],
            ['and', ['status' => 'sending'], ['<', 'updated_at', $now - 300]]);
        MobileClassReminder::updateAll(['status' => 'failed', 'error_code' => 'retry-limit', 'updated_at' => $now],
            ['and', ['status' => ['pending', 'retry']], ['>=', 'attempts', self::MAX_ATTEMPTS]]);
        $rows = MobileClassReminder::find()->where(['status' => ['pending', 'retry']])
            ->andWhere(['<=', 'next_attempt_at', $now])->orderBy(['id' => SORT_ASC])->limit($limit)->all();
        $groups = [];
        foreach ($rows as $row) { $groups[$row->app_id . ':' . $row->project_id][] = $row; }
        foreach ($groups as $group) {
            foreach (array_chunk($group, 100) as $chunk) {
                $batch = []; $messages = []; $app = null;
                foreach ($chunk as $row) {
                    $freshNow = $fixedNow ?? time();
                    $fresh = $this->fresh($row, $freshNow);
                    if (!$fresh) { $this->finish($row, 'skipped', 'booking-or-binding-changed', $freshNow); $counts['skipped']++; continue; }
                    if ($freshNow < $fresh[1]['remindAt']) {
                        $this->finish($row, 'retry', 'lead-time-changed', $freshNow, ['next_attempt_at' => $fresh[1]['remindAt']]); continue;
                    }
                    if (!MobileClassReminder::updateAll(['status' => 'sending', 'updated_at' => $freshNow,
                        'attempts' => new \yii\db\Expression('attempts + 1')],
                        ['and', ['id' => $row->id, 'status' => ['pending', 'retry']], ['<=', 'next_attempt_at', $freshNow], ['<', 'attempts', self::MAX_ATTEMPTS]])) { continue; }
                    $row->attempts++;
                    $row->status = 'sending';
                    [$device, $candidate, $app] = $fresh;
                    $messages[] = self::payloadFor($row, $device, $candidate, $app, $freshNow);
                    $batch[] = $row;
                }
                if (!$batch) { continue; }
                // Recheck the whole batch immediately before the external request, after claims.
                $verified = []; $messages = [];
                foreach ($batch as $row) {
                    $freshNow = $fixedNow ?? time();
                    $fresh = $this->fresh($row, $freshNow);
                    if (!$fresh) { $this->finish($row, 'skipped', 'booking-or-binding-changed', $freshNow); $counts['skipped']++; continue; }
                    if ($freshNow < $fresh[1]['remindAt']) {
                        $this->finish($row, 'retry', 'lead-time-changed', $freshNow, ['next_attempt_at' => $fresh[1]['remindAt'],
                            'attempts' => new \yii\db\Expression('attempts - 1')]); continue;
                    }
                    [$device, $candidate, $app] = $fresh;
                    $verified[] = $row;
                    $messages[] = self::payloadFor($row, $device, $candidate, $app, $freshNow);
                }
                $batch = $verified;
                if (!$batch) { continue; }
                try {
                    $tickets = $client->request('send', $messages, $this->credential($app));
                    foreach ($batch as $index => $row) {
                        $ticket = $tickets[$index] ?? null;
                        $freshNow = $fixedNow ?? time();
                        if (($ticket['status'] ?? '') === 'ok' && is_string($ticket['id'] ?? null)) {
                            $this->finish($row, 'accepted', null, $freshNow, ['ticket_id' => substr($ticket['id'], 0, 255),
                                'accepted_at' => $freshNow, 'next_attempt_at' => $freshNow + 900]);
                            $counts['accepted']++;
                        } elseif (($ticket['status'] ?? '') === 'error') {
                            $code = self::errorCode($ticket);
                            if ($code === 'DeviceNotRegistered') { $this->invalidate($row, $freshNow); }
                            $this->fail($row, $code, $code === 'MessageRateExceeded', false, $freshNow); $counts['failed']++;
                        } else { $this->fail($row, 'ticket-uncertain', false, true, $freshNow); $counts['failed']++; }
                    }
                } catch (ExpoPushException $e) {
                    foreach ($batch as $row) { if ($row->status === 'sending') { $this->fail($row, $e->getMessage(), $e->retryable, $e->ambiguous, $fixedNow ?? time()); $counts['failed']++; } }
                } catch (\Throwable $e) {
                    foreach ($batch as $row) { if ($row->status === 'sending') { $this->fail($row, 'send-uncertain', false, true, $fixedNow ?? time()); $counts['failed']++; } }
                }
                usleep(200000); // At most 500 messages/run; never mix branded app/project batches.
            }
        }
        return $counts;
    }

    private static function errorCode(array $response)
    {
        $code = $response['details']['error'] ?? '';
        return in_array($code, ['DeviceNotRegistered', 'MessageTooBig', 'MessageRateExceeded', 'InvalidCredentials',
            'MismatchSenderId', 'UNAUTHORIZED', 'PUSH_TOO_MANY_EXPERIENCE_IDS', 'TOO_MANY_REQUESTS'], true) ? $code : 'UnknownError';
    }

    public function checkReceipts(ExpoPushClient $client = null, $now = null)
    {
        $now = $now ?? time();
        $client = $client ?: new ExpoPushClient();
        $rows = MobileClassReminder::find()->where(['status' => 'accepted'])->andWhere(['not', ['reminder_id' => null]])
            ->andWhere(['<=', 'next_attempt_at', $now])->orderBy(['next_attempt_at' => SORT_ASC])->limit(1000)->all();
        $groups = [];
        foreach ($rows as $row) {
            if ($row->accepted_at < $now - 86400 || $row->receipt_attempts >= 12) { $this->finish($row, 'receipt_unknown', 'receipt-expired', $now); continue; }
            $groups[$row->app_id . ':' . $row->project_id][] = $row;
        }
        foreach ($groups as $group) {
            try {
                $app = MobilePushApps::get($group[0]->app_id, $group[0]->project_id);
                $receipts = $client->request('getReceipts', ['ids' => array_column(array_map(static function ($r) { return $r->attributes; }, $group), 'ticket_id')], $this->credential($app));
            }
            catch (\Throwable $e) { $receipts = []; Yii::warning('Push receipt polling failed; no tokens or payloads logged.', 'mobile-push'); }
            foreach ($group as $row) {
                $receipt = $receipts[$row->ticket_id] ?? null;
                if (!$receipt) {
                    $row->receipt_attempts++;
                    $row->next_attempt_at = $now + min(3600, 300 * (2 ** min(4, $row->receipt_attempts)));
                    $row->save(false); continue;
                }
                if (($receipt['status'] ?? '') === 'ok') { $this->finish($row, 'provider_accepted', null, $now); }
                else {
                    $code = self::errorCode($receipt);
                    if ($code === 'DeviceNotRegistered') { $this->invalidate($row, $now); }
                    if ($code === 'MessageRateExceeded') { $this->fail($row, $code, true, false, $now); }
                    else { $this->finish($row, 'failed', $code, $now); }
                    Yii::error(['delivery_id' => (int)$row->id, 'code' => $code], 'mobile-push');
                }
            }
        }
    }
}
