<?php
namespace common\helpers;

use Yii;
use yii\web\ForbiddenHttpException;

/** Server-owned authority; request filters must never supply this context. */
final class SecurityAccess
{
    public static function isPlatformAdmin()
    {
        return Yii::$app && Yii::$app->has('user') && !Yii::$app->user->isGuest
            && Yii::$app->user->identity->level === 'superadmin';
    }

    public static function requirePlatformAdmin()
    {
        if (!self::isPlatformAdmin()) {
            throw new ForbiddenHttpException(Yii::t('app', 'permission_denied'));
        }
    }

    public static function companyCode()
    {
        if (Yii::$app->user->isGuest) {
            throw new ForbiddenHttpException(Yii::t('app', 'permission_denied'));
        }
        // ActiveCompany validates memberships or an eligible staff account company. Do not
        // fall back to an old identity company after a membership was revoked.
        $code = Yii::$app->has('activeCompany')
            ? Yii::$app->activeCompany->getCompanyCode()
            : (Yii::$app->user->identity->company_code ?? null);
        if (!is_string($code) || $code === '') {
            throw new ForbiddenHttpException(Yii::t('app', 'company_access_denied'));
        }
        return $code;
    }

    public static function canManageCompany($code)
    {
        if (self::isPlatformAdmin()) {
            return true;
        }
        return Yii::$app->has('activeCompany')
            && Yii::$app->activeCompany->getCompanyCode() === $code
            && Yii::$app->activeCompany->can('company_access_manage');
    }
}
