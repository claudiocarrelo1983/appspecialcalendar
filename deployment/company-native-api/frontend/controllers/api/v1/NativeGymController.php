<?php
namespace frontend\controllers\api\v1;

use common\helpers\GymClientOverviewHelper;
use common\helpers\HealthDateRange;
use common\helpers\Helpers;
use common\helpers\NativeGymService;
use common\helpers\SecurityAccess;
use common\models\Company;
use Yii;
use yii\filters\VerbFilter;
use yii\web\ForbiddenHttpException;

class NativeGymController extends BaseApiController
{
    public function behaviors()
    {
        return parent::behaviors() + ['verbs' => ['class' => VerbFilter::class,
            'actions' => ['index' => ['GET'], 'sessions' => ['GET'], 'checkin' => ['POST'], 'checkout' => ['POST'], 'logout' => ['POST'],
                'notifications'=>['GET'],'notification-read'=>['POST'],'language'=>['POST'],'birthdays'=>['GET'],'csrf'=>['GET']]]];
    }

    public function beforeAction($action)
    {
        Yii::$app->response->headers->set('Cache-Control', 'no-store, private');
        Yii::$app->response->headers->set('X-SC-Native-Api-Revision', \common\helpers\NativeGymCompanyScope::REVISION);
        if ($action->id === 'index') \common\helpers\NativeGymCompanyScope::recordContextRequest();
        $language = Yii::$app->user->identity->language_site ?? Yii::$app->language;
        Yii::$app->language = str_starts_with(strtolower((string)$language), 'pt') ? 'pt' : 'en';
        return parent::beforeAction($action); // Keep Yii session authentication and CSRF validation.
    }

    protected function scope(): array
    {
        return \common\helpers\NativeGymCompanyScope::resolve();
    }

    public function actionIndex()
    {
        if ($response = $this->requireAuthenticated()) return $response;
        if (Yii::$app->user->identity->level !== 'client') return $this->success(['enabled' => false]);
        [$client, $company] = $this->scope();
        return $this->success(NativeGymService::snapshot($client, $company));
    }

    public function actionCsrf()
    {
        if ($response = $this->requireAuthenticated()) return $response;
        return $this->success(['param'=>Yii::$app->request->csrfParam,'token'=>Yii::$app->request->getCsrfToken()]);
    }

    public function actionSessions()
    {
        if ($response = $this->requireAuthenticated()) return $response;
        [$client, $company] = $this->scope();
        if (!$company->hasAttribute('gym_client_session_enabled') || !$company->gym_client_session_enabled) {
            throw new ForbiddenHttpException(Yii::t('app', 'gym_client_checkin_unavailable'));
        }
        $from = Yii::$app->request->get('from');
        $to = Yii::$app->request->get('to');
        if (($from !== null && !is_string($from)) || ($to !== null && !is_string($to))) {
            return $this->error(Yii::t('health', 'Choose a date range of one year or less.'), [], 422);
        }
        $range = new HealthDateRange(['from' => $from, 'to' => $to]);
        $page = filter_var(Yii::$app->request->get('page', 1), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]);
        if (!$range->validate() || !$page) return $this->error(Yii::t('health', 'Choose a date range of one year or less.'), [], 422);
        return $this->success(NativeGymService::sessions($client, $company->company_code, $range, $page));
    }

    public function actionCheckin()
    {
        if ($response = $this->requireAuthenticated()) return $response;
        [$client, $company] = $this->scope();
        if (!GymClientOverviewHelper::checkin($client, $company->company_code)) {
            return $this->error(Yii::t('app', 'gym_client_checkin_unavailable'), [], 409);
        }
        return $this->success(NativeGymService::snapshot($client, $company));
    }

    public function actionCheckout()
    {
        if ($response = $this->requireAuthenticated()) return $response;
        [$client, $company] = $this->scope();
        $id = filter_var(Yii::$app->request->post('id'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!$id || !GymClientOverviewHelper::checkout($client, $company->company_code, $id)) {
            return $this->error(Yii::t('app', 'gym_client_checkout_unavailable'), [], 409);
        }
        return $this->success(NativeGymService::snapshot($client, $company));
    }

    public function actionLogout()
    {
        if ($response = $this->requireAuthenticated()) return $response;
        if (!Yii::$app->user->logout()) return $this->error(Yii::t('app', 'permission_denied'), [], 409);
        return $this->success(['loggedOut' => true]);
    }

    public function actionLanguage()
    {
        if ($response = $this->requireAuthenticated()) return $response;
        [$client, $company] = $this->scope();
        $language = Yii::$app->request->post('language');
        if (!in_array($language, ['en', 'pt'], true)) return $this->error(Yii::t('app', 'client_settings_invalid'), [], 422);
        $client->language_site = $language;
        if (!$client->save(false, ['language_site'])) return $this->error(Yii::t('app', 'client_settings_invalid'), [], 500);
        Yii::$app->language = $language;
        Yii::$app->response->cookies->add(new \yii\web\Cookie(['name'=>'lang','value'=>$language,
            'httpOnly'=>true,'sameSite'=>\yii\web\Cookie::SAME_SITE_LAX,'secure'=>Yii::$app->request->isSecureConnection]));
        return $this->success(NativeGymService::snapshot($client, $company));
    }

    public function actionNotifications()
    {
        if ($response=$this->requireAuthenticated()) return $response;
        [$client,$company]=$this->scope();
        $page=filter_var(Yii::$app->request->get('page',1),FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>10000]]);
        if (!$page) return $this->error(Yii::t('app','notification_read_error'),[],422);
        return $this->success(NativeGymService::notifications((int)$client->id,$company->company_code,$page));
    }

    public function actionBirthdays()
    {
        if ($response = $this->requireAuthenticated()) return $response;
        [, $company] = $this->scope();
        $today = (new \DateTimeImmutable('now', new \DateTimeZone(Yii::$app->timeZone)))->format('m-d');
        $rows = [];
        foreach (Helpers::getBirthdayDates($company->company_code) as $person) {
            $date = (string)$person['birthday_sort'];
            $rows[] = ['name'=>(string)$person['full_name'], 'date'=>substr($date,3,2).'/'.substr($date,0,2), 'today'=>$date===$today];
        }
        return $this->success(['rows'=>$rows]);
    }

    public function actionNotificationRead()
    {
        if ($response=$this->requireAuthenticated()) return $response;
        [$client,$company]=$this->scope();
        $id=filter_var(Yii::$app->request->post('id'),FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
        $checked=Yii::$app->request->post('checked');
        if (!$id || !in_array($checked,['0','1',0,1],true)) return $this->error(Yii::t('app','notification_read_error'),[],422);
        if (!\common\helpers\CompanyNotificationService::available()) return $this->error(Yii::t('app','notification_read_error'),[],404);
        $recipient=\common\models\CompanyNotificationRecipient::findOne([
            'notification_id'=>$id,'company_code'=>$company->company_code,'user_id'=>$client->id]);
        if (!$recipient) return $this->error(Yii::t('app','notification_read_error'),[],404);
        $recipient->read_at=(int)$checked===1?($recipient->read_at?:time()):null;
        if (!$recipient->save(false,['read_at'])) return $this->error(Yii::t('app','notification_read_error'),[],500);
        return $this->success(NativeGymService::notifications((int)$client->id,$company->company_code));
    }
}
