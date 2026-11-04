<?php
namespace common\helpers;

use common\models\Company;
use common\models\CompanyUserMembership;
use Yii;
use yii\web\ForbiddenHttpException;

/** Resolve the URL's club, then authorize the logged-in client for that club. */
final class NativeGymCompanyScope
{
    public const REVISION = 'company-scope-v3';

    private static function writeDiagnostic(string $event): void
    {
        try {
            // Export directly: a host's error-only logger must not discard this record.
            $target = new \yii\log\FileTarget([
                'logFile' => Yii::$app->getRuntimePath() . '/logs/native-gym-access.log',
                'logVars' => [], 'prefix' => static fn() => '',
                'maxFileSize' => 1024, 'maxLogFiles' => 3,
            ]);
            $target->collect([[$event, \yii\log\Logger::LEVEL_WARNING, 'native-gym-access', microtime(true), []]], true);
        } catch (\Throwable $error) {
            // Keep the access decision unchanged even if the runtime directory is unwritable.
            Yii::$app->response->headers->set('X-SC-Native-Log-Status', 'unwritable');
            Yii::error('native-gym-diagnostic-log-unwritable', 'native-gym-access');
        }
    }

    public static function recordContextRequest(): void
    {
        self::writeDiagnostic('native-gym-context-request:' . (Yii::$app->user->isGuest ? 'guest' : 'authenticated'));
    }

    private static function deny(string $reason, string $message = 'company_access_denied'): void
    {
        // Fixed reason codes only: never log identities, cookies, tokens or account data.
        Yii::$app->response->headers->set('X-SC-Native-Access-Reason', $reason);
        self::writeDiagnostic('native-gym-access-denied:' . $reason);
        throw new ForbiddenHttpException(Yii::t('app', $message));
    }

    public static function resolve(): array
    {
        $client = Yii::$app->user->identity;
        if (!$client) self::deny('missing_identity', 'client_access_only');
        if ($client->level !== 'client') self::deny('client_role_required', 'client_access_only');
        if ((int)$client->active !== 1) self::deny('account_inactive', 'client_access_only');
        if ((int)$client->status !== 10) self::deny('account_status', 'client_access_only');

        $host = strtolower(Yii::$app->request->hostName);
        if (preg_match('/^(c[0-9]+)\.specialcalendar\.com$/D', $host, $matches)) {
            $company = Company::findOne(['company_code_url' => $matches[1], 'active' => 1]);
        } else {
            $code = Yii::$app->has('activeCompany') ? Yii::$app->activeCompany->getCompanyCode() : null;
            $company = Company::findOne(['company_code' => $code ?: $client->company_code, 'active' => 1]);
        }
        if (!$company) self::deny('company_unavailable');
        if ((Helpers::arrCompanyPlan(['company_code' => $company->company_code])['plan_name'] ?? '') !== 'gym') self::deny('gym_plan_required');

        $hasMemberships = Yii::$app->db->schema->getTableSchema(CompanyUserMembership::tableName(), true) !== null;
        if ($hasMemberships) {
            // Query the URL's company directly, rather than an unrelated primary/session club.
            $membership = CompanyUserMembership::findOne([
                'user_id' => $client->id, 'company_code' => $company->company_code,
            ]);
            if ($membership !== null) {
                $today = date('Y-m-d');
                if ($membership->status !== CompanyUserMembership::STATUS_APPROVED) self::deny('membership_not_approved');
                if ($membership->role !== 'client') self::deny('membership_role');
                if (!$membership->access_start || substr($membership->access_start, 0, 10) > $today) self::deny('membership_not_started');
                if ($membership->access_expires !== null && substr($membership->access_expires, 0, 10) < $today) self::deny('membership_expired');
                return [$client, $company];
            }
            // Once enrolled in the membership system, missing access is a denial.
            // Never use the legacy identity to override an explicit access decision.
            if (CompanyUserMembership::find()->where(['user_id' => $client->id])->exists()) {
                self::deny('company_membership_missing');
            }
        }

        // Existing clients created before company memberships use their trusted
        // account company, as the existing club login/dashboard already does.
        if ((string)$client->company_code !== (string)$company->company_code) {
            self::deny('account_company_mismatch');
        }
        return [$client, $company];
    }
}
