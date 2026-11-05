<?php
namespace common\helpers;

use Yii;

/** Same role grants as the Team menu, also checked at the check-in endpoint. */
final class GymMemberQrAccess
{
    public static function canScan(): bool { return self::can('scan'); }

    public static function can($operation = 'view'): bool
    {
        if (Yii::$app->user->isGuest || !in_array($operation, ['scan', 'view', 'create', 'edit', 'delete'], true)) return false;
        try { $company = SecurityAccess::companyCode(); } catch (\yii\web\ForbiddenHttpException $error) { return false; }
        $membership = Yii::$app->has('activeCompany') ? Yii::$app->activeCompany->getMembership() : null;
        $role = $membership->role ?? Yii::$app->user->identity->level;
        if ($role === 'admin') return true;
        if ($role !== 'team') return false;
        $permissions = array_map('trim', Helpers::getUserRolesPermissions(['company_code' => $company, 'level' => $role]));
        $required = ['t-members-list' => 'view'];
        if ($operation !== 'scan') $required['t-members-attendance'] = $operation;
        foreach ($required as $page => $crud) {
            if (!in_array($page, $permissions, true)) return false;
            $row = (new \yii\db\Query())->select([$crud])->from('user_roles_permissions_crud')
                ->where(['company_code' => $company, 'company' => Helpers::getCurrenctCompany(), 'level' => $role, 'page' => $page])->one();
            if ($row && !(bool)($row[$crud] ?? false)) return false;
        }
        return true;
    }
}
