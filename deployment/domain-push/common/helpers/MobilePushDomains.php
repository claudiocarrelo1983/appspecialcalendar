<?php
namespace common\helpers;

use yii\base\InvalidConfigException;

/** Converts exact company domains into the existing app-scoped push registry. */
class MobilePushDomains
{
    public static function apps($domains)
    {
        if (!is_array($domains)) {
            throw new InvalidConfigException('Invalid mobile push domain registry.');
        }
        $apps = [];
        foreach ($domains as $domain => $settings) {
            if (!is_string($domain) || $domain !== strtolower($domain)
                || !filter_var($domain, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME)
                || strpos($domain, '.') === false || !is_array($settings)
                || !is_string($settings['appId'] ?? null)
                || !preg_match('/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/Di', $settings['appId'])
                || strlen($settings['appId']) > 160
                || !is_string($settings['pagecode'] ?? null)
                || !preg_match('/^c[0-9]+$/D', $settings['pagecode'])) {
                throw new InvalidConfigException('Invalid mobile push company domain configuration.');
            }
            if (preg_match('/^(c[0-9]+)\.specialcalendar\.com$/D', $domain, $matches)
                && $matches[1] !== $settings['pagecode']) {
                throw new InvalidConfigException('Push domain and company pagecode do not match.');
            }
            $id = $settings['appId'];
            $app = array_intersect_key($settings, array_flip(['projectId', 'pagecode', 'title', 'accessTokenEnv']));
            $app['origins'] = ['https://' . $domain];
            if (isset($apps[$id])) {
                self::assertSameApp($apps[$id], $app);
                $app['origins'] = array_values(array_unique(array_merge($apps[$id]['origins'], $app['origins'])));
            }
            $apps[$id] = $app;
        }
        return $apps;
    }

    public static function merge(array $legacy, array $domainApps)
    {
        foreach ($domainApps as $id => $app) {
            if (isset($legacy[$id])) {
                if (!is_array($legacy[$id]) || !is_array($legacy[$id]['origins'] ?? null)) {
                    throw new InvalidConfigException('Invalid legacy mobile push application.');
                }
                self::assertSameApp($legacy[$id], $app);
                $origins = array_values(array_unique(array_merge($legacy[$id]['origins'], $app['origins'])));
                $app = array_merge($legacy[$id], $app, ['origins' => $origins]);
            }
            $legacy[$id] = $app;
        }
        return $legacy;
    }

    private static function assertSameApp(array $first, array $second)
    {
        foreach (['projectId', 'pagecode', 'accessTokenEnv'] as $key) {
            if (isset($first[$key], $second[$key]) && $first[$key] !== $second[$key]) {
                throw new InvalidConfigException('A push application cannot use conflicting company or credential configurations.');
            }
        }
    }
}
