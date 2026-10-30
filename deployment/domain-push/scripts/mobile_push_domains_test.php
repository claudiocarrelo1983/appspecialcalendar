<?php
// Isolated SQLite fixtures only. No production connection and no push delivery.
defined('YII_ENV') or define('YII_ENV', 'test');
defined('YII_DEBUG') or define('YII_DEBUG', true);
$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
require $root . '/vendor/yiisoft/yii2/Yii.php';
require $root . '/common/config/bootstrap.php';

use common\helpers\MobilePushApps;
use common\helpers\MobilePushDomains;
use yii\base\InvalidConfigException;
use yii\web\ForbiddenHttpException;

$domains = json_decode(file_get_contents($root . '/common/config/mobile-push-domains.json'), true, 512, JSON_THROW_ON_ERROR);
new yii\web\Application([
    'id' => 'push-domain-test', 'basePath' => $root . '/frontend',
    'components' => [
        'db' => ['class' => yii\db\Connection::class, 'dsn' => 'sqlite::memory:'],
        'request' => ['cookieValidationKey' => 'test-only', 'scriptFile' => __FILE__,
            'scriptUrl' => '/index.php', 'hostInfo' => 'https://c20261027151705426.specialcalendar.com'],
        'user' => ['identityClass' => common\models\User::class, 'enableSession' => false],
    ],
    'params' => ['mobilePushApps' => [], 'mobilePushDomains' => $domains],
]);
$checks = 0;
$assert = static function ($ok, $message) use (&$checks) {
    ++$checks;
    if (!$ok) { throw new RuntimeException($message); }
};
$throws = static function ($fn, $class) use ($assert) {
    try { $fn(); } catch (Throwable $e) { $assert($e instanceof $class, get_class($e)); return; }
    $assert(false, 'Expected rejection.');
};
Yii::$app->db->createCommand('CREATE TABLE company (id INTEGER PRIMARY KEY, company_code TEXT, company_code_url TEXT, company_name TEXT, active INTEGER)')->execute();
foreach ($domains as $domain => $config) {
    Yii::$app->db->createCommand()->insert('company', ['company_code' => $config['pagecode'],
        'company_code_url' => $config['pagecode'], 'company_name' => $config['title'], 'active' => 1])->execute();
}
$demo = $domains['c20261027151705426.specialcalendar.com'];
$ftx = $domains['c20260531125358085.specialcalendar.com'];
$assert(count(MobilePushApps::all()) === 2, 'Both domain configs are discovered.');
$assert(MobilePushApps::forRequest($demo['appId'], $demo['projectId'])['pagecode'] === $demo['pagecode'], 'Demo resolves on its own domain.');
$throws(static function () use ($ftx) { MobilePushApps::forRequest($ftx['appId'], $ftx['projectId']); }, ForbiddenHttpException::class);
Yii::$app->request->hostInfo = 'https://c20260531125358085.specialcalendar.com';
$assert(MobilePushApps::forRequest($ftx['appId'], $ftx['projectId'])['pagecode'] === $ftx['pagecode'], 'FTX resolves on its own domain.');
$throws(static function () use ($demo) { MobilePushApps::forRequest($demo['appId'], $demo['projectId']); }, ForbiddenHttpException::class);
$throws(static function () use ($demo) { MobilePushApps::get($demo['appId'], 'wrong-project'); }, ForbiddenHttpException::class);
$throws(static function () { MobilePushApps::get('com.unknown.app', '2c8e7c35-68dc-40c6-b7ea-461f61de6c93'); }, ForbiddenHttpException::class);

foreach (['https://demo.example', '*.specialcalendar.com', 'demo.example/path', 'DEMO.example', 'demo.example:443'] as $domain) {
    $throws(static function () use ($domain, $demo) { MobilePushDomains::apps([$domain => $demo]); }, InvalidConfigException::class);
}
$throws(static function () use ($demo) { MobilePushDomains::apps(['c999.specialcalendar.com' => $demo]); }, InvalidConfigException::class);
$conflict = $demo;
$conflict['appId'] = $ftx['appId'];
$throws(static function () use ($domains, $conflict) {
    MobilePushDomains::apps(array_replace($domains, ['c20261027151705426.specialcalendar.com' => $conflict]));
}, InvalidConfigException::class);
$legacy = [$ftx['appId'] => ['projectId' => $ftx['projectId'], 'pagecode' => $ftx['pagecode'],
    'origins' => ['https://specialcalendar.com', 'http://localhost']]];
$merged = MobilePushDomains::merge($legacy, MobilePushDomains::apps($domains));
$assert(in_array('https://specialcalendar.com', $merged[$ftx['appId']]['origins'], true), 'Explicit legacy origins remain valid.');
$assert(!in_array('https://specialcalendar.com', $merged[$demo['appId']]['origins'], true), 'Legacy aliases do not leak across apps.');
$assert(!isset($merged[$demo['appId']]['icon']), 'Mobile branding is not copied into push payload settings.');

$future = $demo;
$future['appId'] = 'com.future.app';
$future['pagecode'] = 'c999';
Yii::$app->params['mobilePushDomains']['c999.specialcalendar.com'] = $future;
$assert(count(MobilePushApps::all()) === 3, 'A future domain works by adding configuration only.');
$old = Yii::$app->params['mobilePushDomains'];
unset(Yii::$app->params['mobilePushDomains']);
putenv('MOBILE_PUSH_DOMAINS_JSON=' . json_encode($domains));
$assert(count(MobilePushApps::all()) === 2, 'Environment JSON registry is supported.');
putenv('MOBILE_PUSH_DOMAINS_JSON=invalid-json');
$throws(static function () { MobilePushApps::all(); }, InvalidConfigException::class);
putenv('MOBILE_PUSH_DOMAINS_JSON');
$assert(count(MobilePushApps::all()) === 2, 'Default registry file loads without params-local.php changes.');
Yii::$app->params['mobilePushDomains'] = $old;
echo "PASS: $checks domain registry checks; exact origins, company isolation, legacy compatibility and future apps.\n";
