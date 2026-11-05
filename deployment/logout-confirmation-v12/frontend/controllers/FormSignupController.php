<?php

namespace frontend\controllers;

use common\helpers\Helpers;
use common\helpers\HelpersCache;
use common\helpers\PermissionsHelpers;
use common\models\Company;
use common\models\CompanyLocations;
use frontend\models\FormSignupClientForm;
use Yii;
use yii\web\Controller;

class FormSignupController extends Controller
{
    public function actionIndex($pagecode = null)
    {
        $pagecode = $pagecode ?: Yii::$app->request->get('pagecode');
        $companyCode = Helpers::findCompanyCodePage($pagecode);
        $signupLevel = 'client';

        if (!empty($companyCode) && $pagecode === $companyCode && $this->companyIsHousekeeping($companyCode)) {
            $signupLevel = 'cleaner';
        }

        if (empty($companyCode) && !empty($pagecode)) {
            $companyExists = Yii::$app->db->createCommand(
                'SELECT company_code FROM company WHERE company_code = :company_code',
                [':company_code' => $pagecode]
            )->queryScalar();

            if (!empty($companyExists)) {
                $companyCode = $companyExists;
                if ($this->companyIsHousekeeping($companyCode)) {
                    $signupLevel = 'cleaner';
                }
            }
        }

        if (empty($companyCode)) {
            return $this->goHome();
        }

        PermissionsHelpers::adminLaguagesSet();

        $companyArr = $this->freshCompanyArr($companyCode, HelpersCache::myCompanyArrCache($companyCode));
        if (empty($companyArr)) {
            return $this->goHome();
        }

        $selectedLanguage = strtolower((string)Yii::$app->request->cookies->getValue('lang', ''));
        if (in_array($selectedLanguage, ['pt', 'en'], true)) {
            Yii::$app->language = $selectedLanguage;
        } elseif ($this->visitorPrefersEnglish()) {
            Yii::$app->language = 'en';
        } elseif (!empty($companyArr['language'])) {
            Yii::$app->language = $companyArr['language'];
        }

        $companyCodeUrl = Helpers::findCompanyPageByCompanyCode($companyCode) ?: $pagecode;
        $visitorCountryCode = $this->visitorCountryCode();
        $isUkVisitor = in_array($visitorCountryCode, ['GB', 'UK'], true);
        $locationOptions = $this->companyLocationOptions($companyCode);
        $isGymSignup = $this->companyIsGym($companyCode);
        $this->layout = 'specialcalendarpage';

        $model = new FormSignupClientForm([
            'company_code' => $companyCode,
            'company_code_url' => $companyCodeUrl,
            'company' => $companyArr['company_name'] ?? Yii::t('app', 'client'),
            'signup_level' => $signupLevel,
            'client_category' => $isGymSignup ? 'gym' : '',
            'contact_country_code' => $isUkVisitor ? '0044' : '00351',
            'bank_country' => $visitorCountryCode ?: 'PT',
            'newsletter' => 1,
        ]);
        $model->bank_method = 'uk_bank';

        if ($model->load(Yii::$app->request->post())) {
            $model->company_code = $companyCode;
            $model->company_code_url = $companyCodeUrl;
            $model->company = $companyArr['company_name'] ?? Yii::t('app', 'client');
            $model->signup_level = $signupLevel;
            $model->client_category = $isGymSignup ? 'gym' : '';
            $model->bank_country = $model->bank_country ?: ($visitorCountryCode ?: 'PT');
           
            if ($user = $model->signup()) {
                if ($signupLevel === 'cleaner') {
                    $model->sendConfirmationEmail($user);
                    Yii::$app->session->setFlash('success', Yii::t('app', 'signup_confirmation_email_sent'));

                    return $this->redirect(['/site/login', 'pagecode' => $companyCodeUrl]);
                }

                Yii::$app->session->setFlash('success', Yii::t('app', $isGymSignup ? 'Your registration is awaiting administrator approval. You can sign in after approval.' : 'client_signup_successfully'));
                return $this->redirect(['/site/login', 'pagecode' => $companyCodeUrl]);
            }
        }

        return $this->render('index', [
            'model' => $model,
            'companyArr' => $companyArr,
            'pagecode' => $companyCodeUrl,
            'signupLevel' => $signupLevel,
            'isGymSignup' => $isGymSignup,
            'locationOptions' => $locationOptions,
            'visitorCountryCode' => $visitorCountryCode,
        ]);
    }

    private function visitorPrefersEnglish()
    {
        $countryCode = $this->visitorCountryCode();
        if ($countryCode !== null && in_array($countryCode, $this->englishCountryCodes(), true)) {
            return true;
        }

        $acceptLanguage = strtolower((string)Yii::$app->request->headers->get('Accept-Language', ''));
        if ($acceptLanguage === '') {
            return false;
        }

        $firstLanguage = trim(explode(',', $acceptLanguage)[0]);

        return strpos($firstLanguage, 'en') === 0;
    }

    private function visitorCountryCode()
    {
        $headers = [
            'CF-IPCountry',
            'CloudFront-Viewer-Country',
            'X-Country-Code',
            'X-GeoIP-Country-Code',
        ];

        foreach ($headers as $header) {
            $value = strtoupper(trim((string)Yii::$app->request->headers->get($header, '')));
            if ($this->isCountryCode($value)) {
                return $value;
            }
        }

        $serverKeys = [
            'HTTP_CF_IPCOUNTRY',
            'HTTP_CLOUDFRONT_VIEWER_COUNTRY',
            'HTTP_X_COUNTRY_CODE',
            'HTTP_X_GEOIP_COUNTRY_CODE',
            'GEOIP_COUNTRY_CODE',
        ];

        foreach ($serverKeys as $serverKey) {
            $value = strtoupper(trim((string)($_SERVER[$serverKey] ?? '')));
            if ($this->isCountryCode($value)) {
                return $value;
            }
        }

        return null;
    }

    private function isCountryCode($value)
    {
        return preg_match('/^[A-Z]{2}$/', $value) === 1;
    }

    private function englishCountryCodes()
    {
        return [
            'AG', 'AI', 'AU', 'BB', 'BM', 'BS', 'BZ', 'CA', 'DM', 'GB',
            'GD', 'GG', 'GI', 'IE', 'IM', 'JE', 'JM', 'KN', 'KY', 'LC',
            'MS', 'MT', 'NZ', 'SG', 'TC', 'TT', 'UK', 'US', 'VC', 'VG',
            'ZA',
        ];
    }

    private function companyIsHousekeeping($companyCode)
    {
        if (Yii::$app->db->schema->getTableSchema('company_plan', true) === null) {
            return false;
        }

        $planName = Yii::$app->db->createCommand(
            'SELECT plan_name FROM company_plan WHERE company_code = :company_code ORDER BY id DESC',
            [':company_code' => $companyCode]
        )->queryScalar();

        $planName = strtolower((string)$planName);

        return strpos($planName, 'hotel') !== false
            || strpos($planName, 'housekeeping') !== false
            || strpos($planName, 'limpeza') !== false;
    }

    private function companyIsGym($companyCode)
    {
        if (Yii::$app->db->schema->getTableSchema('company_plan', true) === null) {
            return false;
        }

        $planName = Yii::$app->db->createCommand(
            'SELECT plan_name FROM company_plan WHERE company_code = :company_code ORDER BY id DESC',
            [':company_code' => $companyCode]
        )->queryScalar();

        return strtolower((string)$planName) === 'gym';
    }

    private function companyLocationOptions($companyCode)
    {
        $locations = CompanyLocations::find()
            ->select(['location_code', 'full_name', 'location', 'city'])
            ->where(['company_code' => $companyCode, 'active' => 1])
            ->orderBy(['full_name' => SORT_ASC, 'city' => SORT_ASC])
            ->asArray()
            ->all();

        $options = [];
        foreach ($locations as $location) {
            $parts = array_filter([
                trim((string)($location['full_name'] ?? '')),
                trim((string)($location['city'] ?? '')),
                trim((string)($location['location'] ?? '')),
            ]);
            $options[$location['location_code']] = !empty($parts)
                ? implode(' - ', array_unique($parts))
                : $location['location_code'];
        }

        return $options;
    }

    private function freshCompanyArr($companyCode, array $cachedCompanyArr = [])
    {
        $company = Company::find()
            ->where(['company_code' => $companyCode])
            ->asArray()
            ->one();

        if (empty($company)) {
            return $cachedCompanyArr;
        }

        $companyArr = array_merge($cachedCompanyArr, $company);
        $companyArr['image_logo_url'] = $this->companyAssetUrl($companyArr, 'image_logo');
        $companyArr['image_banner_url'] = $this->companyAssetUrl($companyArr, 'image_banner');

        return $companyArr;
    }

    private function companyAssetUrl(array $companyArr, $field)
    {
        $image = trim((string)($companyArr[$field] ?? ''));
        if ($image === '') {
            return '';
        }

        $path = trim(str_replace('\\', '/', (string)($companyArr['path'] ?? '')), '/');
        $image = ltrim(str_replace('\\', '/', $image), '/');
        $url = strpos($image, 'images/') === 0 ? '/' . $image : '/' . trim($path . '/' . $image, '/');

        return file_exists(Yii::getAlias('@webroot') . $url) ? $url : '';
    }
}
