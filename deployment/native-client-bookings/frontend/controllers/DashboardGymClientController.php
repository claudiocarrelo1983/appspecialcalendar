<?php

namespace frontend\controllers;

use common\helpers\DashboardGymClientHelper;
use common\helpers\GymClientReportHelper;
use common\helpers\DashboardPersonalClassBookingsHelper;
use common\helpers\GymClassStripePaymentHelper;
use common\models\DashboardGymClientSearch;
use common\models\CompanyAccessRequest;
use common\models\CompanyUserMembership;
use common\models\GymBooking;
use common\models\GymClass;
use common\models\GymClassSchedule;
use common\models\GymClassStripePayment;
use common\models\GymWaitlist;
use common\models\User;
use common\models\WaiverSigned;
use common\helpers\Helpers;
use common\helpers\PermissionsHelpers;
use common\helpers\UploadSecurityHelper;
use Yii;
use yii\filters\VerbFilter;
use yii\web\Controller;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;
use yii\web\UploadedFile;
use yii\web\Response;

class DashboardGymClientController extends Controller
{
    public function behaviors()
    {
        return [
            'verbs' => [
                'class' => VerbFilter::class,
                'actions' => [
                    'report' => ['GET'], 'native-schedule' => ['GET'],
                    'book' => ['POST'],
                    'booking-alert' => ['POST'],
                    'cancel-booking' => ['POST'],
                    'join-waitlist' => ['POST'],
                    'leave-waitlist' => ['POST'],
                    'sign-waiver' => ['POST'],
                    'upload-picture' => ['POST'],
                    'checkout' => ['POST'],
                    'checkin' => ['POST'],
                    'start-stripe-payment' => ['POST'],
                    'refresh-stripe-payment' => ['POST'],
                    'stripe-payment-webhook' => ['POST'],
                ],
            ],
        ];
    }

    public function beforeAction($action)
    {
        if ($action->id === 'stripe-payment-webhook') {
            $this->enableCsrfValidation = false;
            return parent::beforeAction($action);
        }

        if (!parent::beforeAction($action)) {
            return false;
        }

        $userAgent = Helpers::getUserAgent();

        if (Yii::$app->user->isGuest) {
            if ($action->id === 'index' && Yii::$app->request->get('schedule_id')) {
                $sharedDate = Yii::$app->request->get('date');
                $sharedSchedule = filter_var(Yii::$app->request->get('schedule_id'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
                $sharedCompany = Yii::$app->request->get('company_code');
                if ($sharedSchedule && is_string($sharedDate) && preg_match('/^\d{4}-\d{2}-\d{2}$/D', $sharedDate) && is_string($sharedCompany)) {
                    Yii::$app->session->set('gymSharedClassRoute', ['/dashboard-gym-client/index', 'date' => $sharedDate, 'schedule_id' => $sharedSchedule, 'company_code' => $sharedCompany]);
                }
            }
            $pagecode = Yii::$app->request->get('pagecode');
            $companyCode = Yii::$app->request->get('company_code');

            if (empty($pagecode) && !empty($companyCode)) {
                $pagecode = Helpers::findCompanyPageByCompanyCode($companyCode) ?: $companyCode;
            }

            $this->redirect([
                '/site/login',
                'pagecode' => $pagecode ?: 'c20260531125358085',
            ])->send();
            return false;
        }

        $this->layout = 'admin' . $userAgent;
        PermissionsHelpers::adminLaguagesSet();

        if ((Yii::$app->session['userSessionTimeout'] ?? 0) < time()) {
            Yii::$app->user->logout();
            $this->refresh();
            return false;
        }

        Yii::$app->session->set('userSessionTimeout', time() + Yii::$app->params['sessionTimeoutSeconds']);

        if (Yii::$app->user->identity->level !== 'client') {
            throw new ForbiddenHttpException(Yii::t('app', 'client_access_only'));
        }

        return true;
    }

    public function actionNativeSchedule()
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        Yii::$app->response->headers->set('Cache-Control', 'no-store, private');
        $query = Yii::$app->request->queryParams;
        $date = $query['date'] ?? date('Y-m-d');
        if (!\common\helpers\NativeClientBookings::validDate($date)) throw new \yii\web\BadRequestHttpException();
        if (isset($query['client_guid']) && !is_string($query['client_guid'])) throw new \yii\web\BadRequestHttpException();
        $client = $this->resolveManagedClient($query['client_guid'] ?? null);
        $requestedCompany = $query['company_code'] ?? null;
        if (preg_match('/^(c[0-9]+)\.specialcalendar\.com$/Di', Yii::$app->request->hostName, $hostMatch)) {
            $hostCompany = \common\models\Company::findOne(['company_code_url'=>strtolower($hostMatch[1]),'active'=>1]);
            if (!$hostCompany) throw new ForbiddenHttpException();
            $requestedCompany = $hostCompany->company_code;
        }
        $company = $this->dashboardCompanyCode($requestedCompany, $client);
        $search = (new DashboardGymClientSearch())->search(['date' => $date]);
        $data = DashboardGymClientHelper::build($client, $search, $company);
        return ['success' => true, 'data' => \common\helpers\NativeClientBookings::build($data, $date, $this->managedClients(Yii::$app->user->identity))];
    }

    public function actionIndex()
    {
        $accountClient = Yii::$app->user->identity;
        if ($accountClient === null) {
            return $this->redirect(['site/login']);
        }

        $searchModel = (new DashboardGymClientSearch())->search(Yii::$app->request->queryParams);
        $selectedClient = $this->resolveManagedClient(Yii::$app->request->get('client_guid'));
        $companyCode = $this->dashboardCompanyCode(
            Yii::$app->request->get('company_code', Yii::$app->request->post('company_code')),
            $selectedClient
        );

        return $this->render('index', [
            'searchModel' => $searchModel,
            'data' => DashboardGymClientHelper::build($selectedClient, $searchModel, $companyCode) + [
                'accountClient' => $accountClient,
                'managedClients' => $this->managedClients($accountClient),
                'selectedClientGuid' => $selectedClient->guid,
                'personalUpcomingBookings' => DashboardPersonalClassBookingsHelper::clientUpcomingBookings($companyCode, $selectedClient->guid),
            ],
            'options' => DashboardGymClientHelper::options($companyCode),
        ]);
    }

    public function actionCheckin()
    {
        $client = $this->resolveManagedClient(Yii::$app->request->post('client_guid'));
        $companyCode = $this->dashboardCompanyCode(Yii::$app->request->post('company_code'), $client);
        $success = \common\helpers\GymClientOverviewHelper::checkin($client, $companyCode);
        $message = Yii::t('app', $success ? 'gym_client_checkin_success' : 'gym_client_checkin_unavailable');
        if (Yii::$app->request->isAjax) {
            Yii::$app->response->format = Response::FORMAT_JSON;
            return ['success' => (bool)$success, 'type' => $success ? 'success' : 'warning', 'message' => $message];
        }
        Yii::$app->session->setFlash($success ? 'success' : 'warning', $message);
        return $this->redirect(['index', 'company_code' => $companyCode, 'client_guid' => $client->guid]);
    }

    public function actionCheckout()
    {
        $client = $this->resolveManagedClient(Yii::$app->request->post('client_guid'));
        $companyCode = $this->dashboardCompanyCode(Yii::$app->request->post('company_code'), $client);
        $id = filter_var(Yii::$app->request->post('checkin_id'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $success = $id && \common\helpers\GymClientOverviewHelper::checkout($client, $companyCode, $id);
        $message = Yii::t('app', $success ? 'gym_client_checkout_success' : 'gym_client_checkout_unavailable');
        if (Yii::$app->request->isAjax) {
            Yii::$app->response->format = Response::FORMAT_JSON;
            return ['success' => (bool)$success, 'type' => $success ? 'success' : 'warning', 'message' => $message];
        }
        Yii::$app->session->setFlash($success ? 'success' : 'warning', $message);
        return $this->redirect(['index', 'company_code' => $companyCode, 'client_guid' => $client->guid]);
    }

    public function actionReport()
    {
        $request = Yii::$app->request;
        $client = Yii::$app->user->identity;
        $companyCode = $this->dashboardCompanyCode($request->get('company_code'), $client);
        $from = $request->get('from', date('Y-m-01'));
        $to = $request->get('to', date('Y-m-t'));
        foreach ([$from, $to] as $date) {
            $parsed = is_string($date) ? \DateTimeImmutable::createFromFormat('!Y-m-d', $date) : false;
            if ($parsed === false || $parsed->format('Y-m-d') !== $date) {
                throw new \yii\web\BadRequestHttpException(Yii::t('app', 'client_report_invalid_dates'));
            }
        }
        if ($from > $to || (strtotime($to) - strtotime($from)) > 366 * 86400) {
            throw new \yii\web\BadRequestHttpException(Yii::t('app', 'client_report_invalid_dates'));
        }
        $status = $request->get('status', '');
        $type = $request->get('type', '');
        $status = in_array($status, GymClientReportHelper::statusKeys(), true) ? $status : '';
        $type = in_array($type, ['group', 'personal'], true) ? $type : '';
        $data = GymClientReportHelper::build($client, $companyCode, $from, $to);
        $typeRows = array_values(array_filter($data['rows'], static fn($row) => $type === '' || $row['type'] === $type));
        $rows = array_values(array_filter($typeRows, static fn($row) => $status === '' || $row['status'] === $status));
        $paginationParams = ['from' => $from, 'to' => $to, 'status' => $status, 'type' => $type, 'company_code' => $companyCode];
        foreach (['class_page', 'package_page'] as $pageParam) {
            $paginationParams[$pageParam] = filter_var($request->get($pageParam, 1), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) ?: 1;
        }

        return $this->render('report', [
            'client' => $client,
            'companyCode' => $companyCode, 'from' => $from, 'to' => $to, 'status' => $status, 'type' => $type,
            'stats' => GymClientReportHelper::summarize($typeRows),
            'packageStats' => GymClientReportHelper::packageStats($data['purchases']),
            'classProvider' => new \yii\data\ArrayDataProvider([
                'allModels' => $rows, 'key' => 'id', 'pagination' => ['pageSize' => 10, 'defaultPageSize' => 10, 'pageSizeLimit' => [10, 10], 'pageSizeParam' => false, 'pageParam' => 'class_page', 'route' => '/dashboard-gym-client/report', 'params' => $paginationParams], 'sort' => false,
            ]),
            'packageProvider' => new \yii\data\ArrayDataProvider([
                'allModels' => $data['purchases'], 'key' => 'id', 'pagination' => ['pageSize' => 10, 'defaultPageSize' => 10, 'pageSizeLimit' => [10, 10], 'pageSizeParam' => false, 'pageParam' => 'package_page', 'route' => '/dashboard-gym-client/report', 'params' => $paginationParams], 'sort' => false,
            ]),
        ]);
    }

    public function actionUploadPicture()
    {
        $client = $this->resolveManagedClient(Yii::$app->request->post('client_guid'));
        $companyCode = $this->dashboardCompanyCode(Yii::$app->request->post('company_code'), $client);
        $redirectParams = array_filter([
            'index',
            'company_code' => $companyCode,
            'client_guid' => Yii::$app->request->post('client_guid'),
            'date' => Yii::$app->request->post('date'),
        ], static fn($value) => $value !== null && $value !== '');
        $client->userimage = UploadedFile::getInstance($client, 'userimage');

        if (!$client->userimage instanceof UploadedFile) {
            Yii::$app->session->setFlash('danger', Yii::t('app', 'invalid_file_upload'));
            return $this->redirect($redirectParams);
        }

        if (!$client->validate(['userimage'])) {
            Yii::$app->session->setFlash('danger', implode(' ', $client->getFirstErrors()));
            return $this->redirect($redirectParams);
        }

        $directory = UploadSecurityHelper::companyViewDirectory($companyCode, 'dashboard-gym-client');
        $fileName = UploadSecurityHelper::saveProfileImage($client->userimage, $directory, 'client-profile-' . $client->guid);

        if ($fileName === false) {
            Yii::$app->session->setFlash('danger', Yii::t('app', 'invalid_file_upload'));
            return $this->redirect($redirectParams);
        }

        $client->image = UploadSecurityHelper::companyViewPublicPath($companyCode, 'dashboard-gym-client', $fileName);
        $saveAttributes = ['image'];
        if ($client->hasAttribute('updated_at')) {
            $client->updated_at = time();
            $saveAttributes[] = 'updated_at';
        }
        if (!$client->save(false, $saveAttributes)) {
            Yii::error([
                'message' => 'Failed to save dashboard gym client profile picture.',
                'client_id' => $client->id,
                'client_guid' => $client->guid,
                'company_code' => $companyCode,
                'image' => $client->image,
                'errors' => $client->getErrors(),
            ], __METHOD__);
            Yii::$app->session->setFlash('danger', Yii::t('app', 'save_failed'));
            return $this->redirect($redirectParams);
        }

        if (!Yii::$app->user->isGuest && (int)Yii::$app->user->id === (int)$client->id) {
            Yii::$app->user->switchIdentity(User::findOne($client->id) ?: $client);
        }

        Yii::$app->session->setFlash('success', Yii::t('app', 'profile_picture_updated'));

        return $this->redirect($redirectParams);
    }

    public function actionBookingAlert($class_code)
    {
        $user = Yii::$app->user->identity;
        $company = $this->dashboardCompanyCode(Yii::$app->request->post('company_code'), $user);
        $class = $this->findClass($class_code, $company);
        if (!\common\models\GymBookingAlert::available()) {
            throw new \yii\web\BadRequestHttpException();
        }
        $enabled = Yii::$app->request->post('enabled');
        if (!in_array($enabled, ['0', '1'], true)) throw new \yii\web\BadRequestHttpException();
        $key = \common\models\GymBookingAlert::selectionKey($company, $user->id, $class->code);
        Yii::$app->db->createCommand()->upsert(\common\models\GymBookingAlert::tableName(), [
            'selection_key' => $key, 'company_code' => $company, 'user_id' => $user->id,
            'class_code' => $class->code, 'enabled' => (int)$enabled, 'created_at' => time(),
        ], ['enabled' => (int)$enabled, 'created_at' => time()])->execute();
        if (Yii::$app->request->isAjax) {
            Yii::$app->response->format = Response::FORMAT_JSON;
            return ['success' => true, 'enabled' => $enabled === '1', 'message' => Yii::t('app', 'gym_booking_alert_saved')];
        }
        Yii::$app->session->setFlash('success', Yii::t('app', 'gym_booking_alert_saved'));
        return $this->ajaxOrRedirect(true, 'success', Yii::t('app', 'gym_booking_alert_saved'));
    }

    public function actionBook($class_code, $date = null, $schedule_id = null)
    {
        $actor = Yii::$app->user->identity;
        $client = $this->resolveManagedClient(Yii::$app->request->post('client_guid'));
        $companyCode = $this->dashboardCompanyCode(Yii::$app->request->post('company_code'));
        $class = $this->findClass($class_code, $companyCode);
        $date = $date ?: date('Y-m-d');
        $schedule = $this->findSchedule($class->code, $schedule_id, $date, $companyCode);
        $canBook = DashboardGymClientHelper::canBook($client, $class, $date, $schedule, $companyCode);

        if ($canBook !== true) {
            Yii::$app->session->setFlash('danger', $canBook);
            return $this->ajaxOrRedirect(false, 'danger', $canBook);
        }



        $membership = DashboardGymClientHelper::activeMembership($client, $companyCode);
        $booking = GymBooking::findOne([
            'company_code' => $companyCode,
            'schedule_id' => $schedule->id,
            'booking_date' => $date,
            'client_guid' => $client->guid,
        ]);

        if ($booking === null) {
            $booking = new GymBooking();
        }

        $booking->setAttributes([
            'company_code' => $companyCode,
            'schedule_id' => $schedule->id,
            'class_code' => $class->code,
            'client_guid' => $client->guid,
            'membership_code' => $membership->code ?? null,
            'booking_date' => $date,
            'start_datetime' => $date . ' ' . $schedule->occurrenceStartTime($date),
            'end_datetime' => $schedule->occurrenceEndDateTime($date),
            'booking_status' => GymBooking::STATUS_BOOKED,
            'cancelled_date' => null,
            'cancelled_by' => null,
            'active' => 1,
        ]);

        if ($booking->save()) {
            $message = Yii::t('app', 'class_booked_successfully');
            Yii::$app->session->setFlash('success', $message);
            return $this->ajaxOrRedirect(true, 'success', $message);
        } else {
            $message = implode(' ', $booking->getFirstErrors());
            Yii::$app->session->setFlash('danger', $message);
            return $this->ajaxOrRedirect(false, 'danger', $message);
        }
    }

    public function actionCancelBooking($id)
    {
        $actor = Yii::$app->user->identity;
        $client = $this->resolveManagedClient(Yii::$app->request->post('client_guid'));
        $model = GymBooking::find()
            ->where(['id' => $id, 'company_code' => $this->dashboardCompanyCodes(), 'client_guid' => $client->guid])
            ->one();
        if ($model === null) {
            throw new NotFoundHttpException(Yii::t('app', 'The requested page does not exist.'));
        }
        if (!DashboardGymClientHelper::cancellationInfo($model)['allowed']) {
            return $this->ajaxOrRedirect(false,'danger',Yii::t('app','cancellation_window_closed'));
        }
        $model->booking_status = GymBooking::STATUS_CANCELLED;
        $model->cancelled_date = date('Y-m-d H:i:s');
        $model->cancelled_by = $actor->guid;
        $model->save(false);
        $message = Yii::t('app', 'booking_cancelled_successfully');
        Yii::$app->session->setFlash('danger', $message);

        return $this->ajaxOrRedirect(true, 'danger', $message);
    }

    public function actionJoinWaitlist($class_code, $date = null)
    {
        $client = $this->resolveManagedClient(Yii::$app->request->post('client_guid'));
        $companyCode = $this->dashboardCompanyCode(Yii::$app->request->post('company_code'));
        $class = $this->findClass($class_code, $companyCode);
        $date = $date ?: date('Y-m-d');
        $schedule = $this->findSchedule($class->code, Yii::$app->request->post('schedule_id'), $date, $companyCode);
        $cutoff = DashboardGymClientHelper::bookingCutoffInfo($companyCode, $schedule, $date);

        if ($cutoff['not_open']) {
            return $this->ajaxOrRedirect(false, 'warning', Yii::t('app', 'gym_booking_not_open', ['time' => $cutoff['opens_at']]));
        }

        if ($cutoff['is_closed']) {
            $message = Yii::t('app', 'class_booking_advance_time_closed');
            Yii::$app->session->setFlash('danger', $message);
            return $this->ajaxOrRedirect(false, 'danger', $message);
        }

        if (DashboardGymClientHelper::isWaitlisted($client, $class->code, $date, $companyCode)) {
            $message = Yii::t('app', 'member_already_on_waitlist');
            Yii::$app->session->setFlash('warning', $message);
            return $this->ajaxOrRedirect(false, 'warning', $message);
        }
        $membership = DashboardGymClientHelper::activeMembership($client, $companyCode);
        $waitlist = new GymWaitlist([
            'company_code' => $companyCode,
            'client_guid' => $client->guid,
            'membership_code' => $membership->code ?? null,
            'class_code' => $class->code,
            'waitlist_status' => GymWaitlist::STATUS_WAITING,
            'notes' => $date,
        ]);
        if ($waitlist->save()) {
            $message = Yii::t('app', 'waitlist_joined_successfully');
            Yii::$app->session->setFlash('success', $message);
            return $this->ajaxOrRedirect(true, 'success', $message);
        } else {
            $message = implode(' ', $waitlist->getFirstErrors());
            Yii::$app->session->setFlash('danger', $message);
            return $this->ajaxOrRedirect(false, 'danger', $message);
        }
    }

    public function actionLeaveWaitlist($id)
    {
        $client = $this->resolveManagedClient(Yii::$app->request->post('client_guid'));
        $model = GymWaitlist::find()
            ->where(['id' => $id, 'company_code' => $this->dashboardCompanyCodes(), 'client_guid' => $client->guid])
            ->one();
        if ($model === null) {
            throw new NotFoundHttpException(Yii::t('app', 'The requested page does not exist.'));
        }
        $model->waitlist_status = GymWaitlist::STATUS_CANCELLED;
        $model->active = 0;
        $model->save(false);
        $message = Yii::t('app', 'waitlist_left_successfully');
        Yii::$app->session->setFlash('success', $message);

        return $this->ajaxOrRedirect(true, 'success', $message);
    }

    public function actionSignWaiver($waiver_code)
    {
        $client = $this->resolveManagedClient(Yii::$app->request->post('client_guid'));
        $companyCode = $this->dashboardCompanyCode(Yii::$app->request->post('company_code'));
        if (!Waiver::findOne(['code' => $waiver_code, 'company_code' => $companyCode, 'active' => 1])) throw new NotFoundHttpException();
        $exists = WaiverSigned::find()->where(['company_code' => $companyCode, 'client_guid' => $client->guid, 'waiver_code' => $waiver_code, 'active' => 1])->exists();
        if (!$exists) {
            (new WaiverSigned([
                'company_code' => $companyCode,
                'client_guid' => $client->guid,
                'waiver_code' => $waiver_code,
                'signature' => Yii::$app->user->identity->full_name ?: $client->full_name,
                'ip_address' => Yii::$app->request->userIP,
            ]))->save(false);
        }
        Yii::$app->session->setFlash('success', Yii::t('app', 'waiver_signed_successfully'));
        return $this->ajaxOrRedirect(true, 'success', Yii::t('app', 'waiver_signed_successfully'));
    }

    public function actionStartStripePayment($class_code, $date = null, $schedule_id = null)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;

        try {
            $client = $this->resolveManagedClient(Yii::$app->request->post('client_guid'));
            $companyCode = $this->dashboardCompanyCode(Yii::$app->request->post('company_code'), $client);
            $class = $this->findClass($class_code, $companyCode);
            $date = $date ?: date('Y-m-d');
            $schedule = $this->findSchedule($class->code, $schedule_id ?: Yii::$app->request->post('schedule_id'), $date, $companyCode);
            $payment = GymClassStripePaymentHelper::createCheckoutSession($client, $class, $schedule, $date, $companyCode);

            return [
                'success' => true,
                'type' => 'success',
                'message' => Yii::t('app', 'stripe_checkout_ready'),
                'checkout_url' => $payment->checkout_url,
                'payment_code' => $payment->code,
            ];
        } catch (\Throwable $e) {
            Yii::warning($e->getMessage(), __METHOD__);
            return [
                'success' => false,
                'type' => 'danger',
                'message' => $e->getMessage(),
            ];
        }
    }

    public function actionRefreshStripePayment($payment_code)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $client = $this->resolveManagedClient(Yii::$app->request->post('client_guid'));
        $payment = GymClassStripePayment::find()
            ->where([
                'code' => $payment_code,
                'client_guid' => $client->guid,
                'company_code' => $this->dashboardCompanyCodes(),
            ])
            ->one();

        if ($payment === null) {
            throw new NotFoundHttpException(Yii::t('app', 'payment_not_found'));
        }

        try {
            $payment = GymClassStripePaymentHelper::refreshStatus($payment);
            return [
                'success' => $payment->payment_status === GymClassStripePayment::PAYMENT_PAID,
                'type' => $payment->payment_status === GymClassStripePayment::PAYMENT_PAID ? 'success' : 'info',
                'message' => Yii::t('app', 'payment_status') . ': ' . Yii::t('app', $payment->payment_status),
                'payment_status' => $payment->payment_status,
                'booking_status' => $payment->booking_status,
            ];
        } catch (\Throwable $e) {
            Yii::warning($e->getMessage(), __METHOD__);
            return [
                'success' => false,
                'type' => 'danger',
                'message' => $e->getMessage(),
            ];
        }
    }

    public function actionStripePaymentReturn($payment_code)
    {
        $payment = GymClassStripePayment::find()
            ->where(['code' => $payment_code, 'company_code' => $this->dashboardCompanyCodes()])
            ->one();

        if ($payment === null) {
            throw new NotFoundHttpException(Yii::t('app', 'payment_not_found'));
        }

        try {
            $payment = GymClassStripePaymentHelper::refreshStatus($payment);
            Yii::$app->session->setFlash(
                $payment->payment_status === GymClassStripePayment::PAYMENT_PAID ? 'success' : 'info',
                Yii::t('app', 'payment_status') . ': ' . Yii::t('app', $payment->payment_status)
            );
        } catch (\Throwable $e) {
            Yii::$app->session->setFlash('danger', $e->getMessage());
        }

        return $this->redirect(['index', 'company_code' => $payment->company_code, 'date' => $payment->booking_date]);
    }

    public function actionStripePaymentWebhook()
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $payload = Yii::$app->request->rawBody;
        $signature = Yii::$app->request->headers->get('Stripe-Signature');

        try {
            GymClassStripePaymentHelper::handleWebhook($payload, $signature);
            return ['received' => true];
        } catch (\Throwable $e) {
            Yii::warning($e->getMessage(), __METHOD__);
            Yii::$app->response->statusCode = 400;
            return ['received' => false, 'message' => $e->getMessage()];
        }
    }

    private function findClass($classCode, $companyCode)
    {
        $model = GymClass::findOne(['company_code' => $companyCode, 'code' => $classCode, 'active' => 1]);
        if ($model !== null) {
            return $model;
        }
        throw new NotFoundHttpException(Yii::t('app', 'The requested page does not exist.'));
    }

    private function findSchedule($classCode, $scheduleId, $date, $companyCode)
    {
        $query = GymClassSchedule::find()
            ->where([
                'company_code' => $companyCode,
                'class_code' => $classCode,
                'active' => 1,
            ]);

        if ($scheduleId !== null) {
            $query->andWhere(['id' => $scheduleId]);
        } else {
            $query->andWhere(['day_of_week' => (int) date('w', strtotime($date))]);
        }

        $schedule = $query->one();
        if ($schedule !== null && $schedule->isAvailableOn($date)) {
            return $schedule;
        }

        throw new NotFoundHttpException(Yii::t('app', 'The requested page does not exist.'));
    }

    private function dashboardCompanyCode($requestedCompanyCode = null, User $client = null)
    {
        $allowed = $this->dashboardCompanyCodes();
        $requestedCompanyCode = trim((string)$requestedCompanyCode);
        if ($requestedCompanyCode !== '' && in_array($requestedCompanyCode, $allowed, true)) {
            return $requestedCompanyCode;
        }

        $activeCompanyCode = Yii::$app->has('activeCompany') ? Yii::$app->activeCompany->getCompanyCode() : null;
        if (!empty($activeCompanyCode) && in_array($activeCompanyCode, $allowed, true)) {
            return $activeCompanyCode;
        }

        $clientCompanyCode = $client !== null ? trim((string)$client->company_code) : '';
        if ($clientCompanyCode !== '' && in_array($clientCompanyCode, $allowed, true)) {
            return $clientCompanyCode;
        }

        return $allowed[0] ?? Yii::$app->user->identity->company_code;
    }

    private function dashboardCompanyCodes()
    {
        $codes = [];
        if (Yii::$app->has('activeCompany')) {
            foreach (Yii::$app->activeCompany->getAvailableCompanies() as $membership) {
                if (!empty($membership->company_code)) {
                    $codes[] = $membership->company_code;
                }
            }
        }

        $membershipCodes = CompanyUserMembership::find()
            ->select('company_code')
            ->where([
                'user_id' => Yii::$app->user->id,
                'status' => CompanyUserMembership::STATUS_APPROVED,
            ])
            ->andWhere(['<=', 'access_start', date('Y-m-d')])
            ->andWhere(['or', ['access_expires' => null], ['>=', 'access_expires', date('Y-m-d')]])
            ->column();

        foreach ($membershipCodes as $companyCode) {
            if (!empty($companyCode)) {
                $codes[] = $companyCode;
            }
        }

        $requestedCodes = CompanyAccessRequest::find()
            ->select('company_code')
            ->where([
                'user_id' => Yii::$app->user->id,
                'status' => [
                    CompanyAccessRequest::STATUS_PENDING,
                    CompanyAccessRequest::STATUS_APPROVED,
                ],
            ])
            ->column();

        foreach ($requestedCodes as $companyCode) {
            if (!empty($companyCode)) {
                $codes[] = $companyCode;
            }
        }

        if (!empty(Yii::$app->user->identity->company_code)) {
            $codes[] = Yii::$app->user->identity->company_code;
        }

        return array_values(array_unique($codes));
    }

    private function resolveManagedClient($clientGuid = null)
    {
        $accountClient = Yii::$app->user->identity;
        $clientGuid = trim((string)$clientGuid);

        if ($clientGuid === '' || $clientGuid === $accountClient->guid) {
            return User::findOne($accountClient->id) ?: $accountClient;
        }

        $query = User::find()
            ->where([
                'guid' => $clientGuid,
                'level' => 'client',
                'company_code' => $this->dashboardCompanyCodes(),
            ]);

        if (User::getTableSchema()->getColumn('parent_guid') !== null) {
            $query->andWhere(['parent_guid' => $accountClient->guid]);
        } else {
            $query->andWhere('1=0');
        }

        $client = $query->one();
        if ($client !== null) {
            return $client;
        }

        throw new ForbiddenHttpException(Yii::t('app', 'dependent_access_denied'));
    }

    private function managedClients(User $accountClient)
    {
        $clients = [$accountClient];

        if (User::getTableSchema()->getColumn('parent_guid') === null) {
            return $clients;
        }

        $dependents = User::find()
            ->where([
                'parent_guid' => $accountClient->guid,
                'level' => 'client',
                'active' => 1,
                'company_code' => $this->dashboardCompanyCodes(),
            ])
            ->orderBy(['full_name' => SORT_ASC, 'username' => SORT_ASC])
            ->all();

        foreach ($dependents as $dependent) {
            $clients[] = $dependent;
        }

        return $clients;
    }

    private function ajaxOrRedirect($success, $type, $message)
    {
        if (Yii::$app->request->isAjax) {
            Yii::$app->response->format = Response::FORMAT_JSON;
            return [
                'success' => (bool) $success,
                'type' => $type,
                'message' => $message,
            ];
        }

        return $this->redirect(Yii::$app->request->referrer ?: ['index']);
    }

}
