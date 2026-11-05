<?php
namespace common\helpers;

/** A public UI opt-out, never an authentication or company-data grant. */
class NativeGymPublicAuthPage
{
    public static function matches($origin, $referrer, $method): bool
    {
        if ($method !== 'GET' || !is_string($origin) || !is_string($referrer)) return false;
        $site = parse_url($origin); $page = parse_url($referrer);
        if (!$site || !$page || isset($page['user']) || isset($page['pass']) || isset($page['fragment'])) return false;
        $host = strtolower($site['host'] ?? '');
        if (!in_array($host, ['c20260531125358085.specialcalendar.com', 'c20261027151705426.specialcalendar.com'], true)) return false;
        if (($site['scheme'] ?? '') !== 'https' || ($page['scheme'] ?? '') !== 'https'
            || strtolower($page['host'] ?? '') !== $host || ($page['port'] ?? 443) !== ($site['port'] ?? 443)) return false;
        $code = explode('.', $host)[0]; $path = rtrim($page['path'] ?? '/', '/');
        if (str_starts_with($path, '/' . $code . '/')) $path = substr($path, strlen($code) + 1);
        // Login/root are deliberately excluded: logout confirmation relies on 401 there.
        return in_array($path, ['/form-signup', '/form-signup/index', '/site/signup-client',
            '/request-password-reset', '/site/request-password-reset', '/reset-password', '/site/reset-password'], true);
    }
}
