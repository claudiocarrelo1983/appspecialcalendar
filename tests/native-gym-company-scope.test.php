<?php
// Uses only SQLite in memory. No application/production database is loaded.
define('YII_ENABLE_ERROR_HANDLER', false);
$backend = $argv[1] ?? null;
if (!$backend) throw new RuntimeException('Pass the Yii2 repository path as the first argument.');
require $backend . '/vendor/autoload.php';
require $backend . '/vendor/yiisoft/yii2/Yii.php';
require $backend . '/common/config/bootstrap.php';
require __DIR__ . '/../deployment/company-native-api/common/helpers/NativeGymCompanyScope.php';
require __DIR__ . '/../deployment/company-native-api/frontend/controllers/api/v1/NativeGymController.php';

class ScopeRequest extends yii\web\Request {
    public $testHost;
    public function getHostName() { return $this->testHost; }
}
class SavedScopeCompany extends yii\base\Component {
    public function getCompanyCode() { return 'DEMO'; }
}
class ScopeProbe extends frontend\controllers\api\v1\NativeGymController {
    public function resolveCompany() { return $this->scope(); }
}
$testRuntime = sys_get_temp_dir() . '/sc-native-scope-' . getmypid();
new yii\web\Application(['id' => 'scope-tests', 'basePath' => $backend . '/frontend', 'runtimePath' => $testRuntime,
    'components' => [
        'db' => ['class' => yii\db\Connection::class, 'dsn' => 'sqlite::memory:'],
        'user' => ['class' => yii\web\User::class, 'identityClass' => common\models\User::class, 'enableSession' => false],
        'request' => ['class' => ScopeRequest::class, 'cookieValidationKey' => 'test', 'scriptFile' => __FILE__, 'scriptUrl' => '/index.php'],
        'activeCompany' => ['class' => SavedScopeCompany::class],
        'i18n' => ['translations' => ['app' => ['class' => yii\i18n\PhpMessageSource::class,
            'basePath' => '@common/messages', 'fileMap' => ['app' => 'supplemental.php']]]],
    ]]);
$db = Yii::$app->db;
foreach ([
    'company' => 'id INTEGER PRIMARY KEY, company_code TEXT, company_code_url TEXT, active INTEGER',
    'company_plan' => 'id INTEGER PRIMARY KEY, company_code TEXT, plan_name TEXT',
    'user' => 'id INTEGER PRIMARY KEY, guid TEXT, company_code TEXT, level TEXT, active INTEGER, status INTEGER',
    'company_user_membership' => 'id INTEGER PRIMARY KEY, user_id INTEGER, company_code TEXT, role TEXT, status TEXT, access_start TEXT, access_expires TEXT',
] as $table => $columns) $db->createCommand("CREATE TABLE $table ($columns)")->execute();
$hosts = ['DEMO' => 'c20261027151705426.specialcalendar.com', 'FTX' => 'c20260531125358085.specialcalendar.com'];
foreach ($hosts as $code => $host) {
    $db->createCommand()->insert('company', ['company_code' => $code, 'company_code_url' => explode('.', $host)[0], 'active' => 1])->execute();
    $db->createCommand()->insert('company_plan', ['company_code' => $code, 'plan_name' => 'gym'])->execute();
}
foreach ([1 => 'DEMO', 2 => 'FTX', 3 => 'DEMO'] as $id => $code) {
    $db->createCommand()->insert('user', ['id' => $id, 'guid' => 'test-' . $id, 'company_code' => $code,
        'level' => 'client', 'active' => 1, 'status' => 10])->execute();
}
$controller = new ScopeProbe('native-gym', Yii::$app);
$checks = 0;
function selectAccount(int $id, string $host): void {
    Yii::$app->user->switchIdentity(common\models\User::findOne($id));
    Yii::$app->request->testHost = $host;
}
function expectScope(string $code): void {
    global $controller, $checks;
    [, $company] = $controller->resolveCompany();
    if ($company->company_code !== $code) throw new RuntimeException('Wrong company returned');
    $checks++;
}
function expectDenied(): void {
    global $controller, $checks;
    try { $controller->resolveCompany(); }
    catch (yii\web\ForbiddenHttpException $e) {
        $reason = Yii::$app->response->headers->get('X-SC-Native-Access-Reason');
        if (!in_array($reason, ['missing_identity','client_role_required','account_inactive','account_status',
            'company_unavailable','gym_plan_required','membership_not_approved','membership_role',
            'membership_not_started','membership_expired','company_membership_missing','account_company_mismatch'], true)) {
            throw new RuntimeException('Missing safe denial diagnostic');
        }
        $checks++; return;
    }
    throw new RuntimeException('Expected access to be denied');
}
foreach ([1 => 'DEMO', 2 => 'FTX'] as $id => $code) {
    selectAccount($id, $hosts[$code]); expectScope($code); // Same legacy-client policy for both URLs.
}
Yii::$app->request->setQueryParams(['company_code' => 'DEMO', 'pagecode' => 'c20261027151705426']);
expectScope('FTX'); // Caller-supplied company fields cannot change the hostname's scope.
Yii::$app->request->setQueryParams([]);
selectAccount(2, $hosts['DEMO']); expectDenied(); // Never expose another company.
selectAccount(2, 'c999.specialcalendar.com'); expectDenied(); // Unknown company URL.
$membership = ['user_id' => 3, 'company_code' => 'FTX', 'role' => 'client', 'status' => 'approved',
    'access_start' => date('Y-m-d'), 'access_expires' => null];
$db->createCommand()->insert('company_user_membership', $membership)->execute();
selectAccount(3, $hosts['FTX']); expectScope('FTX'); // URL wins over saved DEMO session.
selectAccount(3, $hosts['DEMO']); expectDenied(); // Enrolled user cannot use a missing membership.
selectAccount(3, $hosts['FTX']);
foreach (['revoked', 'expired', 'pending', 'rejected'] as $status) {
    $db->createCommand()->update('company_user_membership', ['status' => $status], ['user_id' => 3])->execute();
    expectDenied();
}
$db->createCommand()->update('company_user_membership', ['status' => 'approved', 'role' => 'admin'], ['user_id' => 3])->execute();
expectDenied();
$db->createCommand()->update('company_user_membership', ['role' => 'client', 'access_start' => date('Y-m-d', strtotime('+1 day'))], ['user_id' => 3])->execute();
expectDenied();
$db->createCommand()->update('company_user_membership', ['access_start' => date('Y-m-d'), 'access_expires' => date('Y-m-d', strtotime('-1 day'))], ['user_id' => 3])->execute();
expectDenied();
$db->createCommand()->update('company_user_membership', ['access_expires' => date('Y-m-d')], ['user_id' => 3])->execute();
expectScope('FTX');
$db->createCommand()->insert('company_user_membership', ['user_id' => 2, 'company_code' => 'FTX', 'role' => 'client',
    'status' => 'revoked', 'access_start' => date('Y-m-d'), 'access_expires' => null])->execute();
selectAccount(2, $hosts['FTX']); expectDenied(); // Legacy own-company identity cannot override revocation.
$db->createCommand()->update('company', ['active' => 0], ['company_code' => 'FTX'])->execute();
selectAccount(3, $hosts['FTX']); expectDenied();
$db->createCommand()->update('company', ['active' => 1], ['company_code' => 'FTX'])->execute();
$db->createCommand()->update('company_plan', ['plan_name' => 'hotel'], ['company_code' => 'FTX'])->execute();
expectDenied();
$db->createCommand()->update('company_plan', ['plan_name' => 'gym'], ['company_code' => 'FTX'])->execute();
$db->createCommand()->update('user', ['active' => 0], ['id' => 3])->execute();
selectAccount(3, $hosts['FTX']); expectDenied();
$db->createCommand()->update('user', ['active' => 1, 'status' => 0], ['id' => 3])->execute();
selectAccount(3, $hosts['FTX']); expectDenied();
$db->createCommand()->update('user', ['status' => 10, 'level' => 'gym'], ['id' => 3])->execute();
selectAccount(3, $hosts['FTX']); expectDenied();
Yii::$app->user->switchIdentity(null); expectDenied();
$db->createCommand('DROP TABLE company_user_membership')->execute();
$db->schema->refresh();
$db->createCommand()->update('user', ['status' => 10, 'active' => 1, 'level' => 'client'], ['id' => 2])->execute();
selectAccount(2, $hosts['FTX']); expectScope('FTX'); // Older sites without the new membership table.
selectAccount(2, $hosts['DEMO']); expectDenied();

// Dedicated output must work even when the site's general target ignores warnings.
Yii::$app->log->targets = [];
$_COOKIE['test-private-cookie'] = 'must-not-appear-in-log';
common\helpers\NativeGymCompanyScope::recordContextRequest();
$diagnosticFile = $testRuntime . '/logs/native-gym-access.log';
$diagnostic = file_get_contents($diagnosticFile);
if (!str_contains($diagnostic, 'native-gym-access-denied:membership_not_approved')
    || !str_contains($diagnostic, 'native-gym-context-request:authenticated')
    || str_contains($diagnostic, 'must-not-appear-in-log')
    || str_contains($diagnostic, '$_COOKIE') || str_contains($diagnostic, '$_SERVER')) {
    throw new RuntimeException('Dedicated diagnostic output is missing or exposes context');
}
$checks++;
unset($_COOKIE['test-private-cookie']);
unlink($diagnosticFile);
rmdir($testRuntime . '/logs');
rmdir($testRuntime);
echo "Native API company isolation: $checks checks passed.\n";
