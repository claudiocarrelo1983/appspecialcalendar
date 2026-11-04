<?php
namespace common\helpers;

use BaconQrCode\Common\ErrorCorrectionLevel;
use BaconQrCode\Encoder\Encoder;
use common\models\Company;
use common\models\GymBooking;
use common\models\GymCheckin;
use common\models\User;
use Yii;

/** Explicit mobile DTOs; never serialize user or membership ActiveRecords. */
final class NativeGymService
{
    public static function snapshot(User $client, Company $company): array
    {
        $code = $company->company_code;
        $now = new \DateTimeImmutable('now', new \DateTimeZone(Yii::$app->timeZone));
        $overview = GymClientOverviewHelper::build($client, $code);
        $membership = DashboardGymClientHelper::activeMembership($client, $code);
        $ready = $membership && (empty($membership->start_date) || substr($membership->start_date, 0, 10) <= $now->format('Y-m-d'))
            && ((int)$membership->visits_allowed <= 0 || $membership->visits_used < $membership->visits_allowed)
            && DashboardGymClientHelper::missingMandatoryWaivers($client, $code) === 0;
        $bookings = [];
        if (Yii::$app->db->schema->getTableSchema(GymBooking::tableName()) !== null) {
            foreach (GymBooking::find()->with('gymClass')
                ->where(['company_code' => $code, 'client_guid' => $client->guid, 'active' => 1])
                ->andWhere(['not in', 'booking_status', [GymBooking::STATUS_CANCELLED, GymBooking::STATUS_NO_SHOW]])
                ->andWhere(['>=', 'end_datetime', $now->format('Y-m-d H:i:s')])
                ->orderBy(['start_datetime' => SORT_ASC, 'id' => SORT_ASC])->limit(5)->all() as $booking) {
                $bookings[] = ['id' => (int)$booking->id, 'title' => (string)($booking->gymClass->name ?? ''),
                    'startsAt' => self::iso($booking->start_datetime), 'endsAt' => self::iso($booking->end_datetime)];
            }
        }
        $pass = null;
        $logo = CompanyBranding::mobileLogoUrl($company);
        $logo = $logo ?: '/images/logo-calendar-dark.png';
        if (!preg_match('#^https?://#i', $logo)) $logo = rtrim(Yii::$app->request->hostInfo, '/') . '/' . ltrim($logo, '/');
        $photo = null;
        foreach (['image','photo','avatar'] as $attribute) {
            if ($client->hasAttribute($attribute) && !empty($client->{$attribute})) {
                $photo = self::profileImageUrl((string)$client->{$attribute});
                break;
            }
        }
        if ($overview['showPass'] && $membership) {
            $pass = ['title' => (string)$membership->title, 'validUntil' => substr($membership->end_date, 0, 10),
                'startsOn' => substr((string)$membership->start_date, 0, 10),
                'status' => !empty($membership->start_date) && substr($membership->start_date, 0, 10) > $now->format('Y-m-d') ? 'upcoming' : 'active',
                'matrix' => self::qrMatrix(GymClassAppLinks::memberUrl($code, $client->id))];
        }
        return ['enabled' => true, 'accountKey' => hash('sha256', $code . ':' . $client->guid),
            'language' => str_starts_with(strtolower((string)($client->language_site ?: Yii::$app->language)), 'pt') ? 'pt' : 'en',
            'serverTime' => $now->format(DATE_ATOM), 'timezone' => Yii::$app->timeZone,
            'client' => ['name' => (string)($client->full_name ?: $client->username), 'number' => (int)$client->id, 'avatarUrl' => $photo],
            'company' => ['name' => (string)$company->company_name, 'color' => Company::normalizeBrandColor($company->color, '#0d6efd'), 'logoUrl' => $logo],
            'features' => ['pass' => (bool)$overview['showPass'], 'sessions' => (bool)$overview['showSession'],
                'week' => (bool)$overview['showWeek'], 'timer' => HealthToolsAccess::can('workout-timer')],
            'pass' => $pass, 'session' => $overview['session'] ?? null,
            'canCheckin' => (bool)($overview['showSession'] && $ready && empty($overview['session']['inGym'])),
            'week' => $overview['showWeek'] ? array_intersect_key($overview, array_flip(['days', 'count', 'goal', 'percent', 'streak'])) : null,
            'bookings' => $bookings, 'unreadNotifications' => self::unreadNotifications((int)$client->id, $code)];
    }

    public static function sessions(User $client, string $companyCode, HealthDateRange $range, int $page): array
    {
        if (Yii::$app->db->schema->getTableSchema(GymCheckin::tableName()) === null) {
            return ['rows' => [], 'page' => 1, 'hasMore' => false, 'stats' => null];
        }
        $now = new \DateTimeImmutable('now', new \DateTimeZone(Yii::$app->timeZone));
        $query = GymSessionStats::query($companyCode, $client->guid, $range);
        $records = (clone $query)->orderBy(['checkin_date' => SORT_DESC, 'id' => SORT_DESC])->offset(($page - 1) * 20)->limit(21)->all();
        return ['page' => $page, 'hasMore' => count($records) > 20,
            'rows' => array_map(static fn($record) => ['id' => (int)$record->id] + GymSessionStats::row($record, $now), array_slice($records, 0, 20)),
            'stats' => GymSessionStats::summarize($query, $now), 'from' => $range->from, 'to' => $range->to];
    }

    public static function unreadNotifications(int $userId, string $companyCode): int
    {
        return CompanyNotificationService::available()
            ? (int)CompanyNotificationService::inbox($companyCode,$userId)->andWhere(['read_at'=>null])->count() : 0;
    }

    public static function notifications(int $userId, string $companyCode, int $page = 1): array
    {
        if (!CompanyNotificationService::available()) return ['rows'=>[],'unread'=>0,'hasMore'=>false];
        $records=CompanyNotificationService::inbox($companyCode,$userId)->offset(($page-1)*20)->limit(21)->all();
        $rows=[];
        foreach(array_slice($records,0,20) as $record) {
            $notice=$record->notification;
            if (!$notice) continue;
            $rows[]=['id'=>(int)$notice->id,'title'=>(string)$notice->title,'body'=>mb_substr((string)$notice->body,0,400),
                'bookingUrl'=>ClassInvitations::bookingPath($notice),
                'createdAt'=>date(DATE_ATOM,(int)$notice->created_at),'read'=>$record->read_at!==null];
        }
        return ['rows'=>$rows,'unread'=>self::unreadNotifications($userId,$companyCode),'hasMore'=>count($records)>20];
    }

    public static function qrMatrix(string $text): array
    {
        $matrix = Encoder::encode($text, ErrorCorrectionLevel::M())->getMatrix();
        $rows = [];
        for ($y = 0; $y < $matrix->getHeight(); $y++) {
            $row = '';
            for ($x = 0; $x < $matrix->getWidth(); $x++) $row .= $matrix->get($x, $y) === 1 ? '1' : '0';
            $rows[] = $row;
        }
        return $rows;
    }

    public static function profileImageUrl(string $source): string
    {
        // Keep public images on the same company host as the profile page,
        // even when urlManager has a different canonical website host.
        $url = preg_match('#^https?://#i', $source) ? $source : rtrim(Yii::$app->request->hostInfo, '/') . '/' . ltrim($source, '/');
        // A changed photo must not reuse the native image cache, even if its
        // public filename was retained. Never read paths outside the web root.
        if (parse_url($url, PHP_URL_HOST) === Yii::$app->request->hostName) {
            $root = realpath(Yii::getAlias('@frontend/web'));
            $path = $root ? realpath($root . '/' . ltrim(rawurldecode((string)parse_url($url, PHP_URL_PATH)), '/')) : false;
            if ($path && str_starts_with(str_replace('\\', '/', $path), rtrim(str_replace('\\', '/', $root), '/') . '/')
                && preg_match('/\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i', $path) && is_file($path) && is_readable($path)) {
                $hash = hash_file('sha256', $path);
                if ($hash) $url .= (str_contains($url, '?') ? '&' : '?') . 'v=' . substr($hash, 0, 16);
            }
        }
        return $url;
    }

    private static function iso($value): string
    {
        return (new \DateTimeImmutable($value, new \DateTimeZone(Yii::$app->timeZone)))->format(DATE_ATOM);
    }
}
