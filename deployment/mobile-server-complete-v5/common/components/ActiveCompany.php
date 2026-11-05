<?php

namespace common\components;

use common\models\Company;
use common\models\CompanyPlan;
use common\models\CompanyUserMembership;
use Yii;
use yii\base\Component;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

class ActiveCompany extends Component
{
    public $sessionKey = 'active_company_code';

    private $_company;
    private $_membership;
    private $_availableCompanies;

    public function getCompanyCode()
    {
        $company = $this->getCompany();

        if ($company !== null) {
            return $company->company_code;
        }

        if (!$this->hasMembershipTable() && !Yii::$app->user->isGuest) {
            return Yii::$app->user->identity->company_code ?? null;
        }

        return null;
    }

    public function getCompany()
    {
        if (Yii::$app->user->isGuest) {
            return null;
        }

        if ($this->_company !== null) {
            return $this->_company;
        }

        $membership = $this->getMembership();
        if ($membership === null) {
            if ($this->hasMembershipTable()) {
                $this->_company = $this->findLegacyStaffCompany();
                return $this->_company;
            }

            $companyCode = Yii::$app->user->identity->company_code ?? null;
            if (empty($companyCode)) {
                return null;
            }

            $this->_company = Company::find()
                ->where([
                    'company_code' => $companyCode,
                    'active' => 1,
                ])
                ->one();

            return $this->_company;
        }

        $this->_company = Company::find()
            ->where([
                'company_code' => $membership->company_code,
                'active' => 1,
            ])
            ->one();

        if ($this->_company === null) {
            $this->reset();
        }

        return $this->_company;
    }

    public function getMembership()
    {
        if (Yii::$app->user->isGuest) {
            return null;
        }

        if ($this->_membership !== null) {
            return $this->_membership;
        }

        $userId = Yii::$app->user->id;
        $requestedCompanyCode = Yii::$app->session->get($this->sessionKey);

        if (!$this->hasMembershipTable()) {
            return null;
        }

        if ($requestedCompanyCode !== null) {
            $this->_membership = $this->findActiveMembership($userId, $requestedCompanyCode);
        }

        if ($this->_membership === null) {
            $this->_membership = CompanyUserMembership::find()
                ->where([
                    'user_id' => $userId,
                    'status' => CompanyUserMembership::STATUS_APPROVED,
                    'is_primary' => 1,
                ])
                ->andWhere(['<=', 'access_start', date('Y-m-d')])
                ->andWhere(['or', ['access_expires' => null], ['>=', 'access_expires', date('Y-m-d')]])
                ->orderBy(['approved_date' => SORT_DESC, 'id' => SORT_ASC])
                ->one();
        }

        if ($this->_membership === null && !empty(Yii::$app->user->identity->company_code)) {
            $this->_membership = $this->findActiveMembership($userId, Yii::$app->user->identity->company_code);
        }

        if ($this->_membership !== null) {
            Yii::$app->session->set($this->sessionKey, $this->_membership->company_code);
        } else {
            Yii::$app->session->remove($this->sessionKey);
        }

        return $this->_membership;
    }

    public function getAvailableCompanies()
    {
        if (Yii::$app->user->isGuest) {
            return [];
        }

        if (!$this->hasMembershipTable()) {
            return [];
        }

        if ($this->_availableCompanies !== null) {
            return $this->_availableCompanies;
        }

        $today = date('Y-m-d');

        $this->_availableCompanies = CompanyUserMembership::find()
            ->alias('membership')
            ->innerJoin(['company' => Company::tableName()], 'company.company_code = membership.company_code')
            ->where([
                'membership.user_id' => Yii::$app->user->id,
                'membership.status' => CompanyUserMembership::STATUS_APPROVED,
                'company.active' => 1,
            ])
            ->andWhere(['<=', 'membership.access_start', $today])
            ->andWhere(['or', ['membership.access_expires' => null], ['>=', 'membership.access_expires', $today]])
            ->orderBy(['membership.is_primary' => SORT_DESC, 'company.company_name' => SORT_ASC])
            ->all();

        return $this->_availableCompanies;
    }

    public function switchCompany($companyCode)
    {
        $membership = $this->findActiveMembership(Yii::$app->user->id, $companyCode);

        if ($membership === null || !Company::find()->where(['company_code' => $companyCode, 'active' => 1])->exists()) {
            throw new ForbiddenHttpException(Yii::t('app', 'company_access_denied'));
        }

        Yii::$app->session->set($this->sessionKey, $membership->company_code);
        Yii::$app->session->remove('gym_filters');
        Yii::$app->session->remove('gym_selected_ids');
        $this->_membership = $membership;
        $this->_company = null;
        $this->_availableCompanies = null;

        return true;
    }

    public function can($permissionName)
    {
        $membership = $this->getMembership();
        if ($membership === null) {
            $company = $this->findLegacyStaffCompany();
            if ($company === null) {
                return false;
            }

            $role = Yii::$app->user->identity->level;
            if ($role === 'admin') {
                return true;
            }

            $permissions = (new \yii\db\Query())
                ->select('permissions')->from('user_roles_permissions')
                ->where(['company_code' => $company->company_code,
                    'company' => 'specialcalendar', 'level' => $role])
                ->orderBy(['id' => SORT_ASC])->scalar();
            $decoded = json_decode((string) $permissions, true);
            $allowed = is_array($decoded) ? $decoded : array_map('trim', explode(',', (string) $permissions));

            return in_array($permissionName, array_filter($allowed), true);
        }

        if (in_array($membership->role, ['superadmin', 'admin'], true)) {
            return true;
        }

        return in_array($permissionName, $membership->permissionsArray(), true);
    }

    public function requirePermission($permissionName)
    {
        if (!$this->can($permissionName)) {
            throw new ForbiddenHttpException(Yii::t('app', 'permission_denied'));
        }
    }

    public function assertRecordBelongsToActiveCompany($record)
    {
        if ($record === null) {
            throw new NotFoundHttpException(Yii::t('app', 'The requested page does not exist.'));
        }

        if (!$record->hasAttribute('company_code') || $record->company_code !== $this->getCompanyCode()) {
            throw new NotFoundHttpException(Yii::t('app', 'The requested page does not exist.'));
        }

        return true;
    }

    public function cacheKey($key)
    {
        return $key . ':' . (string) $this->getCompanyCode();
    }

    public function reset()
    {
        Yii::$app->session->remove($this->sessionKey);
        $this->_company = null;
        $this->_membership = null;
        $this->_availableCompanies = null;
    }

    private function findActiveMembership($userId, $companyCode)
    {
        if (empty($userId) || empty($companyCode) || !$this->hasMembershipTable()) {
            return null;
        }

        $today = date('Y-m-d');

        return CompanyUserMembership::find()
            ->where([
                'user_id' => $userId,
                'company_code' => $companyCode,
                'status' => CompanyUserMembership::STATUS_APPROVED,
            ])
            ->andWhere(['<=', 'access_start', $today])
            ->andWhere(['or', ['access_expires' => null], ['>=', 'access_expires', $today]])
            ->one();
    }

    private function hasMembershipTable()
    {
        return Yii::$app->db->schema->getTableSchema(CompanyUserMembership::tableName(), true) !== null;
    }

    /** Existing Hotel staff and Gym admin/Team accounts use their assigned company until explicitly enrolled. */
    private function findLegacyStaffCompany()
    {
        if (Yii::$app->user->isGuest) {
            return null;
        }

        $identity = Yii::$app->user->identity;
        $companyCode = $identity->company_code ?? null;
        if (empty($companyCode) || (int) ($identity->status ?? 0) !== 10
            || (int) ($identity->active ?? 0) !== 1
            || !in_array($identity->level, ['admin', 'cleaner', 'supervisor', 'team'], true)) {
            return null;
        }

        // Explicit membership decisions must never be bypassed by legacy access.
        if ($this->hasMembershipTable()
            && CompanyUserMembership::find()->where(['user_id' => Yii::$app->user->id])->exists()) {
            return null;
        }

        $planName = CompanyPlan::find()->select('plan_name')
            ->where(['company_code' => $companyCode])
            ->orderBy(['active' => SORT_DESC, 'id' => SORT_DESC])->scalar();
        if ($planName !== 'hotel' && $planName !== 'gym') {
            return null;
        }
        // Gym clients must use membership enrolment; only existing staff qualify.
        if ($planName === 'gym' && !in_array($identity->level, ['admin', 'team'], true)) {
            return null;
        }

        // Only the trusted identity selects this company, never a request or session value.
        return Company::find()->where(['company_code' => $companyCode, 'active' => 1])->one();
    }
}
