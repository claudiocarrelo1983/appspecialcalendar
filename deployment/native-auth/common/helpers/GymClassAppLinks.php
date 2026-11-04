<?php
namespace common\helpers;

use common\models\Company;
use Yii;
use yii\helpers\Url;

/** HTTPS links retain their web fallback and use a separate host for each company app. */
class GymClassAppLinks
{
    public const PATHS = ['/dashboard-gym', '/dashboard-gym/index', '/dashboard-gym-client', '/dashboard-gym-client/index', '/clients-list/view'];

    public const AUTH_PATHS = ['/login','/site/login','/form-signup','/form-signup/index','/request-password-reset','/site/request-password-reset','/reset-password','/site/reset-password'];

    public static function passwordResetUrl($pagecode, $token)
    {
        $company=Company::findOne(['company_code_url'=>$pagecode,'active'=>1]);
        $route=['/site/reset-password','pagecode'=>$pagecode,'token'=>$token];
        return $company ? self::routeUrl($company->company_code,$route) : Url::to($route,true);
    }

    public static function classUrl($companyCode, $date, $scheduleId)
    {
        $route = ['/dashboard-gym-client/index', 'company_code' => $companyCode,
            'date' => $date, 'schedule_id' => (int)$scheduleId];
        return self::routeUrl($companyCode, $route);
    }

    public static function memberUrl($companyCode, $memberId)
    {
        return self::routeUrl($companyCode, ['/clients-list/view', 'id' => (int)$memberId, 'company_code' => $companyCode]);
    }

    private static function routeUrl($companyCode, array $route)
    {
        $fallback = Url::to($route, true);
        try {
            $company = Company::findOne(['company_code' => $companyCode, 'active' => 1]);
            if (!$company) return $fallback;
            $apps = MobilePushApps::all();
            foreach ($apps as $app) {
                if ($app['pagecode'] !== $company->company_code_url) continue;
                $origin = self::origin($app);
                if ($origin === null || !self::exclusive($origin, $app['pagecode'], $apps)) continue;
                $path = array_shift($route);
                return $origin . $path . '?' . http_build_query($route, '', '&', PHP_QUERY_RFC3986);
            }
        } catch (\Throwable $e) {
            Yii::warning('Company app link configuration unavailable; using the web link.', 'mobile-push');
        }
        return $fallback;
    }

    private static function origin(array $app)
    {
        $origin = $app['classLinkOrigin'] ?? ('https://' . $app['pagecode'] . '.specialcalendar.com');
        if (!is_string($origin) || !in_array($origin, $app['origins'], true)) return null;
        $parts = parse_url($origin);
        if (!$parts || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])
            || isset($parts['port']) || isset($parts['user']) || isset($parts['pass'])
            || !empty($parts['path']) || isset($parts['query']) || isset($parts['fragment'])
            || in_array(strtolower($parts['host']), ['specialcalendar.com', 'www.specialcalendar.com'], true)) return null;
        return $origin;
    }

    private static function exclusive($origin, $pagecode, array $apps)
    {
        foreach ($apps as $app) {
            if ($app['pagecode'] !== $pagecode && in_array($origin, $app['origins'], true)) return false;
        }
        return true;
    }

    private static function appsForOrigin($origin)
    {
        $apps = MobilePushApps::all();
        foreach ($apps as $id => $app) {
            if (self::origin($app) !== $origin || !self::exclusive($origin, $app['pagecode'], $apps)) continue;
            if (!Company::find()->where(['company_code_url' => $app['pagecode'], 'active' => 1])->exists()) continue;
            yield [$id, $app];
        }
    }

    public static function android($origin)
    {
        $statements = [];
        foreach (self::appsForOrigin($origin) as [$id, $app]) {
            $fingerprints = $app['appLinks']['androidSha256CertFingerprints'] ?? [];
            if (!is_array($fingerprints)) continue;
            $fingerprints = array_values(array_unique(array_filter($fingerprints, static function ($value) {
                return is_string($value) && preg_match('/^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/D', $value);
            })));
            $package = $app['appLinks']['androidPackage'] ?? $id;
            if (!$fingerprints || !is_string($package) || !preg_match('/^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/D', $package)) continue;
            $statements[] = ['relation' => ['delegate_permission/common.handle_all_urls'],
                'target' => ['namespace' => 'android_app', 'package_name' => $package, 'sha256_cert_fingerprints' => $fingerprints]];
        }
        return $statements;
    }

    public static function apple($origin)
    {
        $details = [];
        foreach (self::appsForOrigin($origin) as [$id, $app]) {
            $appId = $app['appLinks']['appleAppId'] ?? null;
            if (!is_string($appId) || !preg_match('/^[A-Z0-9]{10}\.[a-zA-Z0-9.-]+$/D', $appId)) continue;
            $details[] = ['appID' => $appId, 'paths' => array_merge(self::PATHS,self::AUTH_PATHS,['/'.$app['pagecode'].'/login','/'.$app['pagecode'].'/request-password-reset','/'.$app['pagecode'].'/reset-password'])];
        }
        return ['applinks' => ['apps' => [], 'details' => $details]];
    }
}
