<?php
namespace common\helpers;

use common\models\Company;
use Yii;
use yii\base\InvalidConfigException;
use yii\web\ForbiddenHttpException;

/** Trusted server-side app registry. No app/tenant is inferred from a browser user ID. */
class MobilePushApps
{
    public static function all()
    {
        $apps = Yii::$app->params['mobilePushApps'] ?? null;
        if ($apps === null) {
            try { $apps = json_decode(getenv('MOBILE_PUSH_APPS_JSON') ?: '{}', true, 512, JSON_THROW_ON_ERROR); }
            catch (\Throwable $e) { throw new InvalidConfigException('Invalid mobile push app registry.'); }
        }
        if (!is_array($apps)) { throw new InvalidConfigException('Invalid mobile push app registry.'); }
        $domains = Yii::$app->params['mobilePushDomains'] ?? null;
        if ($domains === null) {
            $domainJson = getenv('MOBILE_PUSH_DOMAINS_JSON');
            $file = Yii::getAlias('@common/config/mobile-push-domains.json');
            if ($domainJson === false || $domainJson === '') {
                $domainJson = is_file($file) ? file_get_contents($file) : '{}';
            }
            try { $domains = json_decode($domainJson, true, 512, JSON_THROW_ON_ERROR); }
            catch (\Throwable $e) { throw new InvalidConfigException('Invalid mobile push domain registry JSON.'); }
        }
        $apps = MobilePushDomains::merge($apps, MobilePushDomains::apps($domains));
        foreach ($apps as $id => $app) {
            if (!is_string($id) || strlen($id) > 160 || !is_array($app)
                || !is_string($app['projectId'] ?? null)
                || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/Di', $app['projectId'])
                || !is_string($app['pagecode'] ?? null) || !is_array($app['origins'] ?? null) || !$app['origins']
                || (isset($app['title']) && !is_string($app['title']))) {
                throw new InvalidConfigException('Invalid mobile push application configuration.');
            }
            if (isset($app['accessTokenEnv']) && (!is_string($app['accessTokenEnv'])
                || !preg_match('/^[A-Z][A-Z0-9_]*$/D', $app['accessTokenEnv']))) {
                throw new InvalidConfigException('Invalid push credential environment variable.');
            }
            foreach ($app['origins'] as $origin) {
                $parts = is_string($origin) ? parse_url($origin) : false;
                if (!$parts || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])
                    || isset($parts['query']) || isset($parts['fragment']) || !empty($parts['path'])
                    || (($parts['scheme'] ?? '') !== 'https' && !(($parts['scheme'] ?? '') === 'http'
                        && in_array($parts['host'], ['localhost', '127.0.0.1', '::1'], true)))) {
                    throw new InvalidConfigException('Push origins must be exact HTTPS origins (HTTP localhost is allowed for development).');
                }
            }
        }
        return $apps;
    }

    public static function get($appId, $projectId)
    {
        if (!is_string($appId) || !is_string($projectId)) { throw new ForbiddenHttpException('Unknown application.'); }
        $app = self::all()[$appId] ?? null;
        if (!$app || ($app['projectId'] ?? '') !== $projectId) { throw new ForbiddenHttpException('Unknown application.'); }
        $company = Company::find()->where(['company_code_url' => $app['pagecode'] ?? '', 'active' => 1])->one();
        if (!$company) { throw new ForbiddenHttpException('Application company unavailable.'); }
        return array_merge($app, ['appId' => $appId, 'companyCode' => $company->company_code,
            'title' => $app['title'] ?? ($company->company_name ?: Yii::$app->name)]);
    }

    public static function forRequest($appId, $projectId)
    {
        $app = self::get($appId, $projectId);
        if (!in_array(Yii::$app->request->hostInfo, $app['origins'] ?? [], true)) {
            throw new ForbiddenHttpException('Application origin unavailable.');
        }
        if (!Yii::$app->user->isGuest) {
            $company = Yii::$app->has('activeCompany') ? Yii::$app->activeCompany->getCompanyCode() : Yii::$app->user->identity->company_code;
            if ($company !== $app['companyCode'] || !ClassReminderService::hasAccess(Yii::$app->user->identity, $app['companyCode'])) {
                throw new ForbiddenHttpException('Company access denied.');
            }
        }
        return $app;
    }
}
