<?php

namespace frontend\controllers;

use common\helpers\Helpers;
use common\helpers\PermissionsHelpers;
use common\helpers\UploadSecurityHelper;
use common\models\CompanyAccessRequest;
use common\models\CompanyUserMembership;
use common\models\DebtHistory;
use common\models\Debts;
use common\models\BodyMeasurement;
use common\models\FitnessAssessment;
use common\models\GymAttendance;
use common\models\GymWaitlist;
use common\models\Membership;
use common\models\MembershipHistory;
use common\models\PersonalClassPackage;
use common\models\PersonalClassPurchase;
use common\models\ProgressPhoto;
use common\models\ShedduleSearch;
use common\models\User;
use common\models\UserSearch;
use frontend\models\SignupForm;
use yii\web\Controller;
use yii\web\BadRequestHttpException;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;
use frontend\models\PasswordResetRequestForm;
use common\models\Sheddule;
use common\helpers\HelpersCache;
use common\models\Company;
use common\models\SendingLog;
use common\models\DebtsSearch;
use Yii;
use yii\data\ActiveDataProvider;
use yii\helpers\FileHelper;
use yii\helpers\Url;
use yii\web\Response;
use yii\web\UploadedFile;

/**
 * ClientsController implements the CRUD actions for Clients model.
 */
class ClientsListController extends Controller
{
    use CrudDuplicateTrait;

  
    public function beforeAction($action)
    {
        if (!parent::beforeAction($action)) {
            return false;
        }

        $allowed = Helpers::adminBeforeAction($this, true);
        if ($allowed && ($profile = \common\helpers\ClientFitnessProfile::client())) {
            if ($action->id !== 'view' && (int)Yii::$app->request->get('id') !== (int)$profile->id) throw new NotFoundHttpException(Yii::t('app','client_not_found'));
            foreach (['membership'=>'t-members-memberships','client-memberships'=>'t-members-memberships','personal-class'=>'t-members-personal-classes','debt'=>'t-members-debts'] as $prefix=>$permission) {
                if (strpos($action->id,$prefix)===0 && !\common\helpers\ClientFitnessProfile::can($permission)) throw new \yii\web\ForbiddenHttpException(Yii::t('app','not_allowed'));
            }
        }
        return $allowed;
    }
    
    public function actionAutocomplete($term)
    {
        Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;

        $data = User::find()
            ->select([
                'label' => 'full_name',
                'value' => 'full_name',
                'id'
            ])
            ->where(['like', 'full_name', $term])
            ->andWhere([
                'company_code' => \common\helpers\SecurityAccess::companyCode(),
                'level' => 'client'
            ])
            ->limit(10)
            ->asArray()
            ->all();

        return $data;
    }

    public function actionFamilyDependentAutocomplete($id, $q = null)
    {
        return $this->familyClientAutocompleteResults($id, $q);
    }

    public function actionFamilyClientAutocomplete($id = null, $q = null)
    {
        return $this->familyClientAutocompleteResults($id, $q);
    }

    private function familyClientAutocompleteResults($id = null, $q = null)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;

        $currentClient = !empty($id) ? $this->findModel($id) : null;
        $companyCode = $currentClient ? $currentClient->company_code : \common\helpers\SecurityAccess::companyCode();
        $query = User::find()
            ->alias('client')
            ->select([
                'id' => 'client.id',
                'guid' => 'client.guid',
                'full_name' => 'client.full_name',
                'username' => 'client.username',
                'email' => 'client.email',
                'contact_number' => 'client.contact_number',
            ])
            ->where([
                'client.company_code' => $companyCode,
                'client.level' => 'client',
                'client.active' => 1,
            ]);

        if ($currentClient !== null) {
            $query->andWhere(['<>', 'client.guid', $currentClient->guid]);
        }

        $q = trim((string)$q);
        if ($q !== '') {
            $query->andWhere([
                'or',
                ['like', 'client.full_name', $q],
                ['like', 'client.first_name', $q],
                ['like', 'client.last_name', $q],
                ['like', 'client.username', $q],
                ['like', 'client.email', $q],
                ['like', 'client.contact_number', $q],
            ]);
        }

        $items = [];
        foreach ($query->orderBy(['client.full_name' => SORT_ASC, 'client.username' => SORT_ASC])->limit(50)->all() as $client) {
            $name = trim((string)($client->full_name ?: $client->username ?: $client->email ?: $client->guid));
            $secondary = trim((string)($client->email ?: $client->contact_number ?: $client->username));
            $items[] = [
                'guid' => $client->guid,
                'label' => $secondary === '' ? $name : $name . ' - ' . $secondary,
                'name' => $name,
            ];
        }

        return ['results' => $items];
    }

 

    
    /**
     * @inheritDoc
     */
    public function behaviors()
    {
        return array_merge(
            parent::behaviors(),
            [
                'verbs' => [
                    'class' => VerbFilter::className(),
                    'actions' => [
                        'delete' => ['POST'],
                        'registration-decision' => ['POST'],
                        'waiting-list' => ['GET'],
                        ],
                ],
            ]
        );
    }

    /**
     * Lists all Clients models.
     *
     * @return string
     */
    public function actionWaitingList()
    {
        \common\helpers\GymRegistrationApproval::assertAdmin();
        return $this->render('waiting-list',['provider'=>new ActiveDataProvider([
            'query'=>\common\helpers\GymRegistrationApproval::pending(\common\helpers\SecurityAccess::companyCode())->orderBy(['id'=>SORT_DESC]),
            'pagination'=>['pageSize'=>24],
        ])]);
    }

    public function actionRegistrationDecision($id)
    {
        \common\helpers\GymRegistrationApproval::decide(\common\helpers\SecurityAccess::companyCode(),(int)$id,(string)Yii::$app->request->post('decision'));
        Yii::$app->session->setFlash('success',Yii::t('app','Registration updated.'));
        return $this->redirect(['waiting-list']);
    }

    public function actionIndex()
    {
        $userAgent = Helpers::getUserAgent();

        if (Yii::$app->user->isGuest) {
            return $this->redirect(['site/login' . $userAgent]);
        }

        PermissionsHelpers::adminLaguagesSet();

        if (PermissionsHelpers::adminPermissionsAccess()) {
            return $this->redirect(['site/login' . $userAgent]);
        }

        if (PermissionsHelpers::adminPaymentCheck()) {
            return $this->redirect(['/my-plan']);
        }

        $searchModel = new UserSearch();

        $searchModel->company_code = Yii::$app->activeCompany->getCompanyCode() ?: \common\helpers\SecurityAccess::companyCode();
        $searchModel->level = 'client';

        $params = Yii::$app->request->isPost
            ? Yii::$app->request->post()
            : Yii::$app->request->queryParams;

        $dataProvider = $searchModel->search($params);
        if ($this->isGymPlan()) {
            $followup = $params['fitness_followup'] ?? '';
            if ($followup === 'no_session' && (\common\helpers\ClientFitnessProfile::can('t-members-attendance') || \common\helpers\ClientFitnessProfile::can('t-classes-schedule'))) {
                $upcoming = \common\models\GymBooking::find()->select('client_guid')->where(['company_code'=>$this->activeCompanyCode()])->andWhere(['>=','start_datetime',date('Y-m-d H:i:s')])->andWhere(['not in','booking_status',['cancelled','no_show']]);
                $dataProvider->query->andWhere(['not in','user_table.guid',$upcoming]);
            } elseif ($followup === 'expiring' && \common\helpers\ClientFitnessProfile::can('t-members-personal-classes')) {
                $expiring = PersonalClassPurchase::find()->select('client_guid')->where(['company_code'=>$this->activeCompanyCode(),'status'=>PersonalClassPurchase::STATUS_ACTIVE])->andWhere(['between','expiry_date',date('Y-m-d'),date('Y-m-d',strtotime('+7 days'))])->andWhere(new \yii\db\Expression('[[usage_used]] < [[usage_limit]]'));
                $dataProvider->query->andWhere(['user_table.guid'=>$expiring]);
            }
            if (in_array($followup,['no_session','expiring'],true)) {
                $queryParams = Yii::$app->request->queryParams;
                $queryParams['fitness_followup'] = $followup;
                Yii::$app->request->setQueryParams($queryParams);
            }
        }

        $dataProvider->setPagination([
            'pageSize' => 70,
        ]);

        $models = $dataProvider->getModels();

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' => $dataProvider,
            'companyAccessMap' => $this->companyAccessMap($models, $searchModel->company_code),
            'canManageCompanyAccess' => $this->canManageCompanyAccess($searchModel->company_code),
            'fitnessSummaries' => $this->isGymPlan() ? \common\helpers\ClientFitnessSummary::forClients($models) : [],
            'isGymPlan' => $this->isGymPlan(),
        ]);
    }

     /**
     * Lists all Clients models.
     *
     * @return string
     */
    public function actionRessellerIndex()
    {     
        PermissionsHelpers::adminLaguagesSet();

        $resultPermission = PermissionsHelpers::adminPermissionsAccess();

        if($resultPermission){
            return $this->redirect(['site/login' . \common\helpers\Helpers::getUserAgent()]);
        }

        $this->layout = 'admin';  

        $searchModel = new UserSearch();
        
        $dataProvider = $searchModel->search([
            $searchModel->formName()=>
            [
                'company_code'=> \common\helpers\SecurityAccess::companyCode(),
                'voucher_parent'=> Yii::$app->user->identity->voucher,
                'active'=> 1,
                'status'=> 10,
                'level' => 'client'
                //'type'=> 'trial',
            ]
        ]);
     
        // ->andFilterWhere(['like', 'type', $this->type])
     

        return $this->render('index', [
            'searchModel' => $searchModel,
            'dataProvider' =>  $dataProvider,
        ]);
    }

    /**
     * Displays a single Clients model.
     * @param int $id ID
     * @return string
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionView($id)
    {  
        $package = Yii::$app->request->get('package');

        $arrPackage = [];
        if ($package !== null) {
            $arrPackage = ['id' => $package];
        }


        PermissionsHelpers::adminLaguagesSet();  

        $resultPermission = PermissionsHelpers::adminPermissionsAccess();

        if($resultPermission){     
            return $this->redirect(['site/login' . \common\helpers\Helpers::getUserAgent()]);
        }      


        $modelDebtHistoryForm = new DebtHistory();

        $paymentCheck = PermissionsHelpers::adminPaymentCheck();

        if($paymentCheck){    
            return $this->redirect(['/my-plan']);   
        }     

        $model = $this->findModel($id);
        if ($this->isGymPlan() && Yii::$app->user->identity->level !== 'client') {
            $profileClient = \common\helpers\PerformanceNoteAccess::clients($this->activeCompanyCode())->andWhere(['id' => (int)$id])->one();
            if (!$profileClient) throw new NotFoundHttpException(Yii::t('app', 'client_not_found'));
            $model = $profileClient;
            $requestedTab = Yii::$app->request->get('tab','home');
            $clientTab = \common\helpers\ClientFitnessProfile::clientPageTab($requestedTab);
            if ($clientTab !== $requestedTab || Yii::$app->request->get('fitness_profile')) return $this->redirect(['view','id'=>$model->id,'tab'=>$clientTab]);
        }
        $modelSheddule = $this->findModelShedduleGuid($model->guid);
   
        $searchSchedule = new ShedduleSearch();   
        $messagesArr = ReportsController::arrMessages();    

        $filter = array_merge([
            'client_guid' => $model->guid
        ],  $arrPackage);


        $packagesArr = Helpers::arrayPackageSheddule($filter);

        $arrFilterSchedule = [
            'company_code'=> \common\helpers\SecurityAccess::companyCode(),
            //'active'=> 1,
            //'status'=> 10,
            //'level' => 'client'
            //'type'=> 'trial',
            'client_username' =>  $modelSheddule->client_username
        ];

      
        $dataProviderSheddule = $searchSchedule->search([
            $searchSchedule->formName()=> $arrFilterSchedule
        ]);

        $placeholders = [            
            'full_name' => $model->full_name,
            'contact_number' => $model->contact_number,
            'email' => $model->email
        ];


        

        $searchModel = new ShedduleSearch();

        $searchModel->company_code = \common\helpers\SecurityAccess::companyCode();   
        $searchModel->client_username = $model->guid;         
       
        if ($searchModel->load($this->request->post())) {         

            $dataProvider = $searchModel->search($searchModel);

        }else{
            $dataProvider = $searchModel->search($this->request->queryParams);
        }


        $searchModelDept = new DebtsSearch();

        $searchModelDept->company_code = \common\helpers\SecurityAccess::companyCode();     
        $searchModelDept->client_guid = $model->guid;      

        if ($searchModelDept->load($this->request->post())) {        
            $dataProviderDept = $searchModelDept->search($searchModelDept);

        }else{
            $dataProviderDept = $searchModelDept->search($this->request->queryParams);
        }
        $dataProviderDept->query
            ->andWhere(['<>', 'type', Debts::TYPE_MEMBERSHIP]);

        $pointsSetup = (new \yii\db\Query())
            ->from('points_setup')
            ->where([
                'company_code' => \common\helpers\SecurityAccess::companyCode(),
                'active' => 1             
            ])->one();

        /*
        $points = (new \yii\db\Query())
            ->from('points_history')
            ->where([
                'client_guid' => $model->guid,
                'points_code' => (isset($pointsSetup['points_code']) ? $pointsSetup['points_code'] : ''),
                'company_code' => \common\helpers\SecurityAccess::companyCode()              
            ])->sum('points');
        */

        $pointsArr = (new \yii\db\Query())
            ->from('points_history')
            ->where([
                'client_guid' => $model->guid,
                'points_code' => (isset($pointsSetup['points_code']) ? $pointsSetup['points_code'] : ''),
                'company_code' => \common\helpers\SecurityAccess::companyCode()              
            ])->all();

        $isGymPlan = $this->isGymPlan();
        $membershipClientGuids = $isGymPlan ? $this->membershipScopeClientGuids($model) : [$model->guid];
        $dataProviderMembership = $isGymPlan ? $this->membershipDataProvider($membershipClientGuids) : null;
        $membershipPaymentTracker = $isGymPlan ? $this->clientMembershipPaymentTracker($membershipClientGuids) : null;
        $membershipFamilyDetails = $isGymPlan ? $this->clientMembershipFamilyDetails($model) : null;
        $dataProviderPersonalClasses = $this->personalClassPurchaseDataProvider($model->guid);
        $dataProviderProgressPhotos = $this->clientProgressPhotoDataProvider($model->guid);
        $dataProviderBodyMeasurements = $this->clientBodyMeasurementDataProvider($model->guid);
        $dataProviderFitnessAssessments = $this->clientFitnessAssessmentDataProvider($model->guid);
        $attendanceSummary = $this->clientAttendanceSummary($model->guid);
        $dataProviderAttendance = $this->clientAttendanceDataProvider($model->guid, null, 'attendance-page');
        $dataProviderGymAccessAttendance = $this->clientAttendanceDataProvider($model->guid, GymAttendance::TYPE_GYM_ACCESS, 'gym-access-attendance-page');
        $dataProviderClassAttendance = $this->clientAttendanceDataProvider($model->guid, GymAttendance::TYPE_CLASS_ATTENDANCE, 'class-attendance-page');

      


        /*
            
        print"<pre>";       
        print_r($points);
        print"<pre>";     
        die();
        */




        return $this->render('view', [
            'model' => $model,
            'modelDebtHistoryForm' => $modelDebtHistoryForm,
            'placeholders' => $placeholders,
            'messagesArr' => $messagesArr,
            'dataProviderSheddule' => $dataProviderSheddule,
            'dataProvider' => $dataProvider,
            'dataProviderDept' =>  $dataProviderDept,
            'packagesArr' => $packagesArr, 
            'pointsSetup' =>  $pointsSetup,
            'pointsArr' =>  $pointsArr,
            'isGymPlan' => $isGymPlan,
            'dataProviderMembership' => $dataProviderMembership,
            'membershipPaymentTracker' => $membershipPaymentTracker,
            'membershipFamilyDetails' => $membershipFamilyDetails,
            'dataProviderPersonalClasses' => $dataProviderPersonalClasses,
            'dataProviderProgressPhotos' => $dataProviderProgressPhotos,
            'dataProviderBodyMeasurements' => $dataProviderBodyMeasurements,
            'dataProviderFitnessAssessments' => $dataProviderFitnessAssessments,
            'attendanceSummary' => $attendanceSummary,
            'dataProviderAttendance' => $dataProviderAttendance,
            'dataProviderGymAccessAttendance' => $dataProviderGymAccessAttendance,
            'dataProviderClassAttendance' => $dataProviderClassAttendance
    
        ]);
    }

    public function actionPersonalClassForm($id, $purchase_id = null)
    {
        $client = $this->findClientModel($id);
        $model = empty($purchase_id)
            ? new PersonalClassPurchase([
                'company_code' => $this->activeCompanyCode(),
                'client_guid' => $client->guid,
                'purchase_date' => date('Y-m-d'),
            ])
            : $this->findClientPersonalClassPurchaseModel($purchase_id, $client->guid);

        return $this->renderPartial('_personal_class_form', [
            'model' => $model,
            'client' => $client,
            'packageOptions' => $this->personalClassPackageOptions(),
        ]);
    }

    public function actionDebtForm($id)
    {
        $client = $this->findModel($id);
        $model = new Debts([
            'company_code' => $this->activeCompanyCode(),
            'client_guid' => $client->guid,
            'type' => Debts::TYPE_CUSTOM,
            'full_amount' => 0,
            'paid_amount' => 0,
        ]);

        return $this->renderPartial('_debt_form', [
            'model' => $model,
            'client' => $client,
        ]);
    }

    public function actionDebtSave($id)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;

        $client = $this->findModel($id);
        $model = new Debts();

        if ($model->load(Yii::$app->request->post())) {
            $initialPaidAmount = (float)($model->paid_amount ?: 0);
            $model->company_code = $this->activeCompanyCode();
            $model->client_guid = $client->guid;
            $model->created_by = Yii::$app->user->identity->guid;
            $model->debts_code = 'd' . Helpers::generateRandowHumber();
            if (empty($model->booking_code)) {
                $model->booking_code = $model->debts_code;
            }
            if (empty($model->period)) {
                $model->period = date('Y-m');
            }
            $model->full_amount = (float)($model->full_amount ?: 0);

            if ($initialPaidAmount > $model->full_amount) {
                $model->addError('paid_amount', Yii::t('app', 'amount_exceeds_remaining'));
            } else {
                $model->paid_amount = 0;
                $model->remaining_amount = $model->full_amount;
            }

            if (!$model->hasErrors() && $model->save()) {
                if ($initialPaidAmount > 0) {
                    $history = new DebtHistory();
                    $history->client_guid = $model->client_guid;
                    $history->debt_code = $model->code;
                    $history->debts_code = $model->debts_code;
                    $history->company_code = $model->company_code;
                    $history->received_guid = Yii::$app->user->identity->guid;
                    $history->amount = $initialPaidAmount;
                    $history->action = 'create';
                    $history->notes = $model->notes;
                    $history->booking_code = $model->booking_code ?: $model->debts_code;
                    $history->code = $model->code;
                    $history->save(false);

                    DebtHistoryController::debtsUpdateHelper($model->client_guid, $model->debts_code);
                }

                $debtBlockData = $this->clientDebtBlockData($client);

                return [
                    'success' => true,
                    'html' => $this->renderPartial('debts', $debtBlockData),
                    'topbar' => $this->renderPartial('topbar-debt', [
                        'model' => $client,
                    ]),
                ];
            }
        }

        return [
            'success' => false,
            'message' => Yii::t('app', 'save_failed'),
            'errors' => $model->getErrors(),
            'form' => $this->renderPartial('_debt_form', [
                'model' => $model,
                'client' => $client,
            ]),
        ];
    }

    public function actionDebtDelete($id, $debt_id)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;

        $client = $this->findModel($id);
        $debt = Debts::findOne([
            'id' => $debt_id,
            'client_guid' => $client->guid,
            'company_code' => $this->activeCompanyCode(),
        ]);

        if (!$debt) {
            return [
                'success' => false,
                'message' => Yii::t('app', 'debt_not_found'),
            ];
        }

        DebtHistory::deleteAll([
            'client_guid' => $debt->client_guid,
            'company_code' => $debt->company_code,
            'debts_code' => $debt->debts_code,
        ]);

        if (!empty($debt->code)) {
            DebtHistory::deleteAll([
                'client_guid' => $debt->client_guid,
                'company_code' => $debt->company_code,
                'debt_code' => $debt->code,
            ]);
        }

        if ($debt->delete() === false) {
            return [
                'success' => false,
                'message' => Yii::t('app', 'delete_failed'),
            ];
        }

        $debtBlockData = $this->clientDebtBlockData($client);

        return [
            'success' => true,
            'html' => $this->renderPartial('debts', $debtBlockData),
            'topbar' => $this->renderPartial('topbar-debt', [
                'model' => $client,
            ]),
        ];
    }

    private function clientDebtBlockData($client)
    {
        $modelDebtHistoryForm = new DebtHistory();
        $searchModelDept = new DebtsSearch();
        $searchModelDept->company_code = \common\helpers\SecurityAccess::companyCode();
        $searchModelDept->client_guid = $client->guid;

        $dataProviderDept = $searchModelDept->search(Yii::$app->request->queryParams);
        $dataProviderDept->query
            ->andWhere(['<>', 'type', Debts::TYPE_MEMBERSHIP]);

        return [
            'modelUser' => $client,
            'dataProvider' => $dataProviderDept,
            'modelDebtHistoryForm' => $modelDebtHistoryForm,
        ];
    }

    public function actionPersonalClassSave($id, $purchase_id = null)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;

        $client = $this->findClientModel($id);
        $model = empty($purchase_id)
            ? new PersonalClassPurchase([
                'company_code' => $this->activeCompanyCode(),
                'client_guid' => $client->guid,
            ])
            : $this->findClientPersonalClassPurchaseModel($purchase_id, $client->guid);

        if ($model->load(Yii::$app->request->post())) {
            $model->company_code = $this->activeCompanyCode();
            $model->client_guid = $client->guid;
            $this->applyPersonalClassPackageToPurchase($model);

            if ($model->save()) {
                return [
                    'success' => true,
                    'html' => $this->renderPartial('personal-classes', [
                        'model' => $client,
                        'dataProvider' => $this->personalClassPurchaseDataProvider($client->guid),
                    ]),
                ];
            }
        }

        return [
            'success' => false,
            'message' => Yii::t('app', 'save_failed'),
            'errors' => $model->getErrors(),
            'form' => $this->renderPartial('_personal_class_form', [
                'model' => $model,
                'client' => $client,
                'packageOptions' => $this->personalClassPackageOptions(),
            ]),
        ];
    }

    public function actionPersonalClassDelete($id, $purchase_id)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;

        $client = $this->findClientModel($id);
        $this->findClientPersonalClassPurchaseModel($purchase_id, $client->guid)->delete();

        return [
            'success' => true,
            'html' => $this->renderPartial('personal-classes', [
                'model' => $client,
                'dataProvider' => $this->personalClassPurchaseDataProvider($client->guid),
            ]),
        ];
    }

    public function actionPersonalClassUsage($id)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;

        $client = $this->findClientModel($id);
        $purchase = $this->findClientPersonalClassPurchaseModel((int)Yii::$app->request->post('purchase_id'), $client->guid);
        $usedCount = Yii::$app->request->post('used_count');
        if ($usedCount === null) {
            $checked = (int)Yii::$app->request->post('checked') === 1;
            $usedCount = (int)$purchase->usage_used + ($checked ? 1 : -1);
        }
        $previousUsed = (int)$purchase->usage_used;
        $purchase->usage_used = max(0, min((int)$purchase->usage_limit, (int)$usedCount));
        $this->syncPersonalClassUsageLog($purchase, $previousUsed, (int)$purchase->usage_used);

        if (!$purchase->save(false, ['usage_used', 'usage_log', 'status', 'updated_date'])) {
            return [
                'success' => false,
                'message' => Yii::t('app', 'save_failed'),
            ];
        }

        return [
            'success' => true,
            'used' => (int)$purchase->usage_used,
            'remaining' => $purchase->remaining(),
            'percent' => $purchase->percentUsed(),
            'status' => $purchase->status,
            'status_badge' => $purchase->getStatusBadge(),
            'usage_log' => $this->personalClassUsageLogLabels($purchase),
        ];
    }

    public function actionPerformanceForm($id, $type)
    {
        $client = $this->findClientModel($id);
        $model = $this->newPerformanceModel($client, $type);

        return $this->renderPartial('_performance_form', [
            'model' => $model,
            'client' => $client,
            'type' => $type,
        ]);
    }

    public function actionPerformanceSave($id, $type)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;

        $client = $this->findClientModel($id);
        $model = $this->newPerformanceModel($client, $type);

        if ($model->load(Yii::$app->request->post())) {
            $model->company_code = \common\helpers\SecurityAccess::companyCode();
            $model->client_guid = $client->guid;

            if ($model instanceof ProgressPhoto) {
                $model->frontFile = UploadedFile::getInstance($model, 'frontFile');
                $model->sideFile = UploadedFile::getInstance($model, 'sideFile');
                $model->backFile = UploadedFile::getInstance($model, 'backFile');
                $this->saveClientProgressPhoto($model, 'frontFile', 'front_photo');
                $this->saveClientProgressPhoto($model, 'sideFile', 'side_photo');
                $this->saveClientProgressPhoto($model, 'backFile', 'back_photo');
            }

            if ($model->save()) {
                return [
                    'success' => true,
                    'html' => $this->renderPartial('performance', [
                        'model' => $client,
                        'dataProviderProgressPhotos' => $this->clientProgressPhotoDataProvider($client->guid),
                        'dataProviderBodyMeasurements' => $this->clientBodyMeasurementDataProvider($client->guid),
                        'dataProviderFitnessAssessments' => $this->clientFitnessAssessmentDataProvider($client->guid),
                    ]),
                ];
            }
        }

        return [
            'success' => false,
            'message' => Yii::t('app', 'save_failed'),
            'errors' => $model->getErrors(),
            'form' => $this->renderPartial('_performance_form', [
                'model' => $model,
                'client' => $client,
                'type' => $type,
            ]),
        ];
    }

    public function actionPerformanceDelete($id, $type, $record_id)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;

        if (!Yii::$app->request->isPost) {
            throw new BadRequestHttpException(Yii::t('app', 'Invalid request.'));
        }

        $client = $this->findClientModel($id);
        $this->findClientPerformanceModel($record_id, $client->guid, $type)->delete();

        return [
            'success' => true,
            'html' => $this->renderPartial('performance', [
                'model' => $client,
                'dataProviderProgressPhotos' => $this->clientProgressPhotoDataProvider($client->guid),
                'dataProviderBodyMeasurements' => $this->clientBodyMeasurementDataProvider($client->guid),
                'dataProviderFitnessAssessments' => $this->clientFitnessAssessmentDataProvider($client->guid),
            ]),
        ];
    }

    public function actionClientMemberships($id)
    {
        $this->ensureGymPlan();
        $model = $this->findClientModel($id);
        $membershipClientGuids = $this->membershipScopeClientGuids($model);

        return $this->renderPartial('memberships', [
            'model' => $model,
            'dataProvider' => $this->membershipDataProvider($membershipClientGuids),
            'paymentTracker' => $this->clientMembershipPaymentTracker($membershipClientGuids),
            'familyDetails' => $this->clientMembershipFamilyDetails($model),
        ]);
    }

    public function actionMembershipForm($id, $membership_id = null)
    {
        $this->ensureGymPlan();
        $pageClient = $this->findClientModel($id);
        $scopeClientGuids = $this->membershipScopeClientGuids($pageClient);
        $client = $this->resolveMembershipTargetClient($pageClient, Yii::$app->request->get('client_id'));
        $model = empty($membership_id)
            ? new Membership([
                'company_code' => $this->activeCompanyCode(),
                'client_guid' => $client->guid,
                'start_date' => $this->nextMembershipStartDate($client->guid),
            ])
            : $this->findClientMembershipModelInScope($membership_id, $scopeClientGuids);

        if (!$model->isNewRecord) {
            $client = $this->findClientByGuid($model->client_guid);
        }

        return $this->renderPartial('_membership_form', [
            'model' => $model,
            'client' => $client,
        ]);
    }

    public function actionMembershipSave($id, $membership_id = null)
    {
        $this->ensureGymPlan();
        Yii::$app->response->format = Response::FORMAT_JSON;

        $pageClient = $this->findClientModel($id);
        $scopeClientGuids = $this->membershipScopeClientGuids($pageClient);
        $client = $this->resolveMembershipTargetClient($pageClient, Yii::$app->request->get('client_id'));
        $model = empty($membership_id)
            ? new Membership([
                'company_code' => $this->activeCompanyCode(),
                'client_guid' => $client->guid,
            ])
            : $this->findClientMembershipModelInScope($membership_id, $scopeClientGuids);

        if (!$model->isNewRecord) {
            $client = $this->findClientByGuid($model->client_guid);
        }

        if ($model->load(Yii::$app->request->post())) {
            $model->company_code = $this->activeCompanyCode();
            $model->client_guid = $client->guid;

            if ($model->save()) {
                $this->logMembershipHistory($model, empty($membership_id) ? 'created' : 'updated');

                return [
                    'success' => true,
                    'message' => Yii::t('app', 'membership_saved'),
                    'html' => $this->renderPartial('memberships', [
                        'model' => $pageClient,
                        'dataProvider' => $this->membershipDataProvider($this->membershipScopeClientGuids($pageClient)),
                        'paymentTracker' => $this->clientMembershipPaymentTracker($this->membershipScopeClientGuids($pageClient)),
                        'familyDetails' => $this->clientMembershipFamilyDetails($pageClient),
                    ]),
                ];
            }
        }

        return [
            'success' => false,
            'message' => Yii::t('app', 'save_failed'),
            'errors' => $model->getErrors(),
            'form' => $this->renderPartial('_membership_form', [
                'model' => $model,
                'client' => $client,
            ]),
        ];
    }

    private function nextMembershipStartDate($clientGuid)
    {
        $lastEndDate = Membership::find()
            ->where([
                'company_code' => \common\helpers\SecurityAccess::companyCode(),
                'client_guid' => $clientGuid,
                'active' => 1,
            ])
            ->andWhere(['not in', 'status', [Membership::STATUS_CANCELLED]])
            ->andWhere(['not', ['end_date' => null]])
            ->max('end_date');

        if (empty($lastEndDate)) {
            return date('Y-m-d');
        }

        $nextDate = strtotime($lastEndDate . ' +1 day');

        return $nextDate === false ? date('Y-m-d') : date('Y-m-d', $nextDate);
    }

    public function actionMembershipDelete($id, $membership_id)
    {
        $this->ensureGymPlan();
        Yii::$app->response->format = Response::FORMAT_JSON;

        $client = $this->findClientModel($id);
        $membershipClientGuids = $this->membershipScopeClientGuids($client);
        $membership = $this->findClientMembershipModelInScope($membership_id, $membershipClientGuids);
        $membership->delete();

        return [
            'success' => true,
            'message' => Yii::t('app', 'membership_deleted'),
            'html' => $this->renderPartial('memberships', [
                'model' => $client,
                'dataProvider' => $this->membershipDataProvider($membershipClientGuids),
                'paymentTracker' => $this->clientMembershipPaymentTracker($membershipClientGuids),
                'familyDetails' => $this->clientMembershipFamilyDetails($client),
            ]),
        ];
    }

    public function actionMembershipTogglePayment($id)
    {
        $this->ensureGymPlan();
        Yii::$app->response->format = Response::FORMAT_JSON;

        $client = $this->findClientModel($id);
        $membership = $this->findClientMembershipModelInScope((int)Yii::$app->request->post('membership_id'), $this->membershipScopeClientGuids($client));
        $period = $this->normalizeMembershipPaymentPeriod(Yii::$app->request->post('period'));
        $checked = (int)Yii::$app->request->post('paid') === 1;
        $periodStart = $period . '-01';
        $periodEnd = date('Y-m-t', strtotime($periodStart));
        $dueInfo = $this->duePaymentForMembership($membership, $periodStart, $periodEnd);

        if ($dueInfo === null) {
            return [
                'success' => false,
                'message' => Yii::t('app', 'payment_not_due_for_period'),
            ];
        }

        $debt = $this->membershipDebtForExactPeriod($membership, $period);

        if ($debt === null) {
            $debt = new Debts([
                'company_code' => $membership->company_code,
                'client_guid' => $membership->client_guid,
                'membership_code' => $membership->code,
                'booking_code' => $membership->code,
                'received_guid' => Yii::$app->user->identity->guid ?? $membership->client_guid,
                'type' => Debts::TYPE_MEMBERSHIP,
                'period' => $period,
                'start_date' => $dueInfo['coverage_start'],
                'end_date' => $dueInfo['coverage_end'],
                'due_date' => $dueInfo['due_date'],
                'full_amount' => (float)$membership->price,
                'created_by' => Yii::$app->user->identity->guid ?? null,
            ]);
        }

        $debt->company_code = $membership->company_code;
        $debt->client_guid = $membership->client_guid;
        $debt->type = Debts::TYPE_MEMBERSHIP;
        $debt->period = $period;
        $debt->start_date = $debt->start_date ?: $dueInfo['coverage_start'];
        $debt->end_date = $debt->end_date ?: $dueInfo['coverage_end'];
        $debt->due_date = $debt->due_date ?: $dueInfo['due_date'];
        $debt->full_amount = (float)($debt->full_amount ?: $membership->price);
        $debt->created_by = $debt->created_by ?: (Yii::$app->user->identity->guid ?? null);
        $debt->received_guid = $debt->received_guid ?: (Yii::$app->user->identity->guid ?? $membership->client_guid);
        if ($debt->hasAttribute('membership_code')) {
            $debt->membership_code = $debt->membership_code ?: $membership->code;
        }
        $debt->booking_code = $debt->booking_code ?: $membership->code;
        $debt->code = $debt->code ?: ('db' . date('YmdHis') . Helpers::generateRandowHumber(6));
        $debt->debts_code = $debt->debts_code ?: $debt->code;

        if ($checked) {
            $debt->paid_amount = (float)$debt->full_amount;
            $debt->remaining_amount = 0;
            $debt->status = Debts::STATUS_PAID;
        } else {
            $debt->paid_amount = 0;
            $debt->remaining_amount = (float)$debt->full_amount;
            $debt->status = (!empty($debt->due_date) && strtotime($debt->due_date) < strtotime(date('Y-m-d')))
                ? Debts::STATUS_OVERDUE
                : Debts::STATUS_PENDING;
        }

        if (!$debt->save()) {
            return [
                'success' => false,
                'message' => Yii::t('app', 'save_failed'),
                'errors' => $debt->getErrors(),
            ];
        }

        $status = $this->paymentStatusForDebt($debt);
        $paymentTracker = $this->clientMembershipPaymentTracker($this->membershipScopeClientGuids($client));

        return [
            'success' => true,
            'status' => $status,
            'status_label' => $this->paymentStatusLabel($status),
            'paid_amount' => Helpers::formatCurrency($debt->paid_amount),
            'remaining_amount' => Helpers::formatCurrency($debt->remaining_amount),
            'hide_row' => $status === 'paid'
                && !empty($debt->due_date)
                && strtotime((string)$debt->due_date) < strtotime(date('Y-m-d')),
            'summary' => $this->formattedMembershipSummary($paymentTracker['summary'] ?? []),
        ];
    }

    public function actionMembershipToggleClass($id)
    {
        $this->ensureGymPlan();
        Yii::$app->response->format = Response::FORMAT_JSON;

        $client = $this->findClientModel($id);
        $membership = $this->findClientMembershipModelInScope((int)Yii::$app->request->post('membership_id'), $this->membershipScopeClientGuids($client));
        $allowed = (int)$membership->classes_allowed;

        if ($allowed <= 0) {
            return [
                'success' => false,
                'message' => Yii::t('app', 'save_failed'),
            ];
        }

        $usedCount = Yii::$app->request->post('used_count');
        if ($usedCount === null) {
            $usedCount = (int)$membership->classes_used;
            $checked = (int)Yii::$app->request->post('checked') === 1;
            $usedCount += $checked ? 1 : -1;
        }

        $membership->classes_used = max(0, min($allowed, (int)$usedCount));

        if (!$membership->save(false, ['classes_used', 'updated_date'])) {
            return [
                'success' => false,
                'message' => Yii::t('app', 'save_failed'),
            ];
        }

        return [
            'success' => true,
            'used' => (int)$membership->classes_used,
            'allowed' => $allowed,
            'remaining' => max(0, $allowed - (int)$membership->classes_used),
            'used_value' => Helpers::formatCurrency($this->membershipUsedClassPackValue($membership)),
            'remaining_value' => Helpers::formatCurrency($this->membershipRemainingClassPackValue($membership)),
        ];
    }

    /**
     * Creates a new Clients model.
     * If creation is successful, the browser will be redirected to the 'view' page.
     * @return string|\yii\web\Response
     */
    protected function applyClientActiveState($model)
    {
        if (!in_array($model->active, [0, 1, '0', '1', false, true], true)) {
            $model->addError('active', Yii::t('app', 'validation_required'));
            return false;
        }
        $model->active = (int) $model->active;
        $model->status = $model->active === 1 ? User::STATUS_ACTIVE : User::STATUS_INACTIVE;
        return true;
    }

    public function actionCreate()
    {    
        PermissionsHelpers::adminLaguagesSet();

        $resultPermission = PermissionsHelpers::adminPermissionsAccess();

        if($resultPermission){
            return $this->redirect(['site/login' . \common\helpers\Helpers::getUserAgent()]);
        }

        $this->layout = 'admin';  

        $model = new SignupForm();
        $model->active = 1;

        $model->username = 'clt'.Helpers::generateRandowHumber('5'); 
        $model->password = 'pw'.Helpers::generateRandowHumber('5');  
      
   
        if ($this->request->isPost) {
            if ($model->load($this->request->post())) {

                $model->terms_and_conditions = 1;
                $model->newsletter = 1;
                $model->privacy = 1;
                $model->company_code = \common\helpers\SecurityAccess::companyCode();
                $model->company = Yii::$app->user->identity->company;        
                $model->newsletter = 1;    

                $model->adress_line_1 = (empty(Yii::$app->user->identity->adress_line_1) ? 'client' : Yii::$app->user->identity->adress_line_1);    
                $model->adress_line_2 = (empty(Yii::$app->user->identity->adress_line_2) ? 'client' : Yii::$app->user->identity->adress_line_2);  
                $model->city = (empty(Yii::$app->user->identity->city) ? 'client' : Yii::$app->user->identity->city);   
                $model->location = (empty(Yii::$app->user->identity->location) ? 'client' : Yii::$app->user->identity->location);   
                $model->country = (empty(Yii::$app->user->identity->country) ? 'client' : Yii::$app->user->identity->country);  
                $model->postcode = (empty(Yii::$app->user->identity->postcode) ? 'client' : Yii::$app->user->identity->postcode); 
                $model->job_title = 'client';
                $model->level = 'client';
                $model->dob = date('Y-m-d', strtotime($model->dob));
                $model->created_date = date('Y-m-d H:i');
                $this->normalizeFamilyLink($model);

                $activeValid = $this->applyClientActiveState($model);
                $modelUser = $activeValid ? $model->signUpClient($model->active) : false;

                if ($modelUser) {

                    try {
                        Helpers::generateClientQrCodeIfEmpty($modelUser);
                    } catch (\Throwable $exception) {
                        Yii::error($exception->getMessage(), __METHOD__);
                    }

                    HelpersCache::deleteOldKey($model->company_code, 'team');
                    LogsController::saveLog($model,'create');    

                        return $this->redirect([
                            'view',
                            'id' => $modelUser->id
                        ]);

                        return $this->redirect(['../clients-list/view/',               
                            'id' => $modelUser->id                       
                        ]);
                   
                }

                /*

                    $model->validate();

                print"<pre>";
                print_r($model->getErrors());
                die();
                if($model->signUpClient()){
                    $modelUser = $this->findModelId($model->username);

                    $placeholders = [                 
                        'full_name' => $modelUser->full_name,
                        'contact_number' => $modelUser->contact_number,
                        'email' => $modelUser->email,     
                    ];

                    return $this->redirect(['../clients-list/view/',               
                        'id' => $modelUser->id                       
                    ]);
                }      
                */                  
            }
        }


        return $this->render('@frontend/views/clients-list/create', [
            'model' => $model,
            'parentOptions' => $this->parentClientOptions(),
        ]);
    }

    public function actionSaveQrSmsLog($id)
    {
        $model = User::find()
            ->where([
                'id' => $id,
                'company_code' => \common\helpers\SecurityAccess::companyCode(),
                'level' => 'client',
            ])
            ->one();

        if ($model === null) {
            throw new NotFoundHttpException(Yii::t('app', 'client_not_found'));
        }

        $qrCode = Helpers::generateClientQrCodeIfEmpty($model);
        $clientUrl = Url::to(['/clients-list/view', 'id' => $model->id], true);
        $qrCodeUrl = $qrCode ? Url::to($qrCode, true) : '';

        Yii::$app->db->createCommand()->insert('sending_log', [
            'booking_code' => 'client-qr-code-' . $model->id,
            'company_code' => $model->company_code,
            'client_username' => $model->guid,
            'team_username' => Yii::$app->user->identity->guid,
            'method' => 'sms',
            'type' => 'sms',
            'details_json' => json_encode([
                'company_code' => $model->company_code,
                'location_code' => $model->location_code,
                'full_name' => $model->full_name,
                'contact_country_code' => $model->contact_country_code,
                'contact_number' => $model->contact_number,
                'qr_code' => $model->qr_code,
                'qr_code_url' => $qrCodeUrl,
                'client_url' => $clientUrl,
                'message' => $qrCodeUrl,
            ], JSON_UNESCAPED_SLASHES),
            'layout_view' => 'sms-client-qr-code',
            'layout_template' => 'sms',
            'result_message' => 0,
            'error_message' => '',
            'schedule_to' => null,
            'instant_message' => 1,
            'language' => Yii::$app->language,
            'created_date' => date('Y-m-d H:i:s'),
        ])->execute();

        Yii::$app->session->setFlash('success', Yii::t('app', 'qr_sms_log_saved'));

        return $this->redirect(['index']);
    }

    /**
     * Updates an existing Clients model.
     * If update is successful, the browser will be redirected to the 'view' page.
     * @param int $id ID
     * @return string|\yii\web\Response
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionUpdate($id)
    {
        /*
        PermissionsHelpers::adminLaguagesSet();  

        $resultPermission = PermissionsHelpers::adminPermissionsAccess();

        if($resultPermission){     
            return $this->redirect(['site/login' . \common\helpers\Helpers::getUserAgent()]);
        }      

        $paymentCheck = PermissionsHelpers::adminPaymentCheck();

        if($paymentCheck){    
            return $this->redirect(['/my-plan/upgrade']);    
        }     

        */

        
        if (Yii::$app->user->isGuest) {    
            return $this->redirect(['site/login' . \common\helpers\Helpers::getUserAgent()]);
        }     

        $model = $this->findModel($id);
        // A company membership permits local operations, not control of a
        // client's account and password owned by another company.
        if ($model->company_code !== \common\helpers\SecurityAccess::companyCode()) {
            throw new \yii\web\ForbiddenHttpException(Yii::t('app', 'permission_denied'));
        }
        $model->active = (int) $model->status === User::STATUS_ACTIVE ? 1 : 0;
        //$modelPassword = new PasswordResetRequestForm();

        $post = Yii::$app->request->post();
        $postedPassword = trim((string)($post[$model->formName()]['password'] ?? ''));

        if ($this->request->isPost && $model->load($post)) {
            $model->level = 'client';
            $model->company_code = \common\helpers\SecurityAccess::companyCode();
            // The account identifier is never a form-editable field.
            $model->guid = $model->getOldAttribute('guid');

            if ($postedPassword !== '') {                
                $model->setPassword($postedPassword);
                $model->generateAuthKey(); // optional but recommended
            }  

            $model->full_name = $model->first_name.' '.$model->last_name;
            $model->location_code = Yii::$app->user->identity->location_code;
            $model->job_title = 'client';
            $this->normalizeFamilyLink($model, $model->guid);

            Yii::$app->db->createCommand()->update(
                'sheddule',
                [
                    'title' =>  $model->title,
                    'full_name' =>  $model->full_name,
                    'first_name' =>  $model->first_name,
                    'last_name' =>  $model->last_name,
                    'contact_country_code' =>  $model->contact_country_code,
                    'contact_number' =>  $model->contact_number,                    
                    'email' =>  $model->email,
                    'nif' =>  $model->nif
                ],
                [  
                    'client_username' => $model->guid,
                    'company_code' => $model->company_code                      
                    
                ])->execute();    

            /*
            $model->validate();
            print_r($model->getErrors());
            die();
            */
            
            if ($this->applyClientActiveState($model) && $model->save()) {
                if (($model->family_role ?? 'adult') !== 'dependent') {
                    $this->assignDependentToParent($model, $post['family_dependent_guid'] ?? null);
                }

                if ((int)$model->status === User::STATUS_WAITING_LIST) {
                    $this->ensureMembershipWaitlistForClient($model);
                }

                return $this->redirect(['view', 'id' => $model->id]);
            }
        }


        $companyCode = $this->activeCompanyCode();
        $companyAccessMap = $this->companyAccessMap([$model], $companyCode);

        $model->password = '';

        return $this->render('update', [
            'model' => $model,
            'companyAccessInfo' => $companyAccessMap[$model->id] ?? null,
            'companyCode' => $companyCode,
            'canManageCompanyAccess' => $this->canManageCompanyAccess($companyCode),
            'parentOptions' => $this->parentClientOptions($model->guid),
        ]);
    }

    private function parentClientOptions($excludeGuid = null)
    {
        $query = User::find()
            ->select(['guid', 'full_name', 'username'])
            ->where([
                'company_code' => \common\helpers\SecurityAccess::companyCode(),
                'level' => 'client',
                'active' => 1,
            ])
            ->andWhere(['or', ['parent_guid' => null], ['parent_guid' => '']])
            ->orderBy(['full_name' => SORT_ASC, 'username' => SORT_ASC]);

        if (!empty($excludeGuid)) {
            $query->andWhere(['<>', 'guid', $excludeGuid]);
        }

        $options = [];
        foreach ($query->all() as $client) {
            $options[$client->guid] = trim((string)($client->full_name ?: $client->username));
        }

        return $options;
    }

    private function normalizeFamilyLink($model, $ownGuid = null)
    {
        if (!$model->hasProperty('parent_guid') && !property_exists($model, 'parent_guid')) {
            return;
        }

        $familyRole = trim((string)($model->family_role ?? ''));
        $parentGuid = trim((string)$model->parent_guid);
        if ($familyRole !== 'dependent') {
            $model->parent_guid = null;
            if ($model->hasProperty('family_role') || property_exists($model, 'family_role')) {
                $model->family_role = 'adult';
            }
            return;
        }

        if ($parentGuid === '' || ($ownGuid !== null && $parentGuid === $ownGuid)) {
            $model->parent_guid = null;
            if ($model->hasProperty('family_role') || property_exists($model, 'family_role')) {
                $model->family_role = 'dependent';
            }
            return;
        }

        $parentExists = User::find()->where([
            'company_code' => \common\helpers\SecurityAccess::companyCode(),
            'level' => 'client',
            'guid' => $parentGuid,
        ])->exists();

        if (!$parentExists) {
            $model->parent_guid = null;
            if ($model->hasProperty('family_role') || property_exists($model, 'family_role')) {
                $model->family_role = 'adult';
            }
            return;
        }

        $model->parent_guid = $parentGuid;
        if ($model->hasProperty('family_role') || property_exists($model, 'family_role')) {
            $model->family_role = 'dependent';
        }
    }

    private function assignDependentToParent(User $parent, $dependentGuid)
    {
        $dependentGuid = trim((string)$dependentGuid);
        if ($dependentGuid === '' || $dependentGuid === $parent->guid || User::getTableSchema()->getColumn('parent_guid') === null) {
            return;
        }

        $dependent = User::find()->where([
            'company_code' => $parent->company_code,
            'level' => 'client',
            'guid' => $dependentGuid,
        ])->andWhere(['<>', 'guid', $parent->guid])->one();

        if ($dependent === null) {
            Yii::$app->session->setFlash('warning', Yii::t('app', 'dependent_access_denied'));
            return;
        }

        $dependent->parent_guid = $parent->guid;
        if ($dependent->hasAttribute('family_role')) {
            $dependent->family_role = 'dependent';
        }

        $columns = ['parent_guid'];
        if ($dependent->hasAttribute('family_role')) {
            $columns[] = 'family_role';
        }
        if ($dependent->hasAttribute('updated_at')) {
            $columns[] = 'updated_at';
        }

        $dependent->save(false, $columns);
    }

    private function ensureMembershipWaitlistForClient(User $client)
    {
        $activeStatuses = [
            GymWaitlist::STATUS_WAITING,
            GymWaitlist::STATUS_NOTIFIED,
            GymWaitlist::STATUS_ACCEPTED,
        ];

        $existing = GymWaitlist::find()
            ->where([
                'company_code' => $client->company_code,
                'class_code' => GymWaitlist::MEMBERSHIP_WAITLIST_CLASS_CODE,
                'client_guid' => $client->guid,
            ])
            ->orderBy(['id' => SORT_DESC])
            ->one();

        if ($existing && (int)$existing->active === 1 && in_array($existing->waitlist_status, $activeStatuses, true)) {
            return;
        }

        $waitlist = $existing ?: new GymWaitlist([
            'scenario' => GymWaitlist::SCENARIO_MEMBERSHIP_WAITLIST,
            'company_code' => $client->company_code,
            'class_code' => GymWaitlist::MEMBERSHIP_WAITLIST_CLASS_CODE,
            'client_guid' => $client->guid,
        ]);

        $waitlist->scenario = GymWaitlist::SCENARIO_MEMBERSHIP_WAITLIST;
        $waitlist->company_code = $client->company_code;
        $waitlist->class_code = GymWaitlist::MEMBERSHIP_WAITLIST_CLASS_CODE;
        $waitlist->client_guid = $client->guid;
        $waitlist->schedule_code = null;
        $waitlist->booking_code = null;
        $waitlist->converted_booking_code = null;
        $waitlist->waitlist_status = GymWaitlist::STATUS_WAITING;
        $waitlist->active = 1;
        $waitlist->position = GymWaitlist::nextPosition($client->company_code, GymWaitlist::MEMBERSHIP_WAITLIST_CLASS_CODE);
        $waitlist->save(false);
    }


    public function actionBookingCreate($id)
    {    
   
        $model = new Sheddule();       

        $foundModel = $this->findModelUser($id);      

        $modelSearch = new User();

        $this->layout = 'admin';

        PermissionsHelpers::adminLaguagesSet();

        $resultPermission = PermissionsHelpers::adminPermissionsAccess();

        if($resultPermission){
            return $this->redirect(['site/login' . \common\helpers\Helpers::getUserAgent()]);
        }      

        $model = new Sheddule();    
        $modelSearch = new User();
        $modelCompany = new Company();
        $modelSendingLog = new SendingLog();

        $arrSheddule = HelpersCache::arrayShedduleCache(\common\helpers\SecurityAccess::companyCode());

        $usersArr = HelpersCache::arrayTeamCache(\common\helpers\SecurityAccess::companyCode());         
    
        if ($this->request->isPost && $model->load($this->request->post())) {            
       
            $sendingMethod = (empty($model->sending_method) ? '' : implode('|',$model->sending_method));  

            if(!empty($model->id)){

                $date = date('Y-m-d', strtotime($model->date));
                $time = $model->time;             
                $model = $this->findModelSheddule($model->id);           
                $model->date = date('Y-m-d', strtotime($date));
                $model->time = date('H:i', ($time));        
            

            }else{
                     
                $model->booking_code = 'b'.Helpers::generateBookingCodeRandowHumber();
                $model->company_code = \common\helpers\SecurityAccess::companyCode();         
                $model->date = date('Y-m-d', strtotime($model->date));
                $model->time = date('H:i', ($model->time));
        
                $filter = [
                    'service_code' => $model->service_code,
                    'company_code' =>  $model->company_code
                ];

                $arrServices = Helpers::arrayServices($filter, 'one');

                $model->service_name = (isset($arrServices['page_code_title']) ? $arrServices['page_code_title'] : '');
                $model->price = (isset($arrServices['price']) ? $arrServices['price'] : 0);
                $model->service_name = (isset($arrServices['page_code_title']) ? $arrServices['page_code_title'] : '');
                $model->currency = (isset($arrServices['currency']) ? $arrServices['currency'] : '€');     

            }     
        
            $model->action = 'dashboard';

            if($model->validate()){   

                $model->save();   
                HelpersCache::deleteOldKey($model->company_code, 'scheddule');
                LogsController::saveLog($model,'change-drag-drop');                   

                if(!empty($sendingMethod)){

                    foreach(explode('|', $sendingMethod) as $method){                       
                  
                        $modelSendingLog::saveSendingLog($method, $model, $modelSendingLog);           
 
                    }                    
                }

                $this->refresh();
            }    
        }
        
        $myDataArr = []; 
   

        Helpers::validationActiveLogOut();  

        $error = Helpers::accessAccountAdmin(Yii::$app->user->identity);  
      
        if($error > 0){   
            return $this->redirect(['site/login' . \common\helpers\Helpers::getUserAgent()]);
        }       

        $companyArr = Helpers::myCompanyArr();
     
        $coin = Helpers::getCurrencySymbolSimple(Yii::$app->user->identity->currency);       

        $eventsArr = HelpersCache::eventsArrCache(\common\helpers\SecurityAccess::companyCode());  
      
        foreach($eventsArr as $event){
    
            $hours[] = date('H', strtotime($event['time']));         
            
            $myDataArr[] = [        
                'idNumber' => $event['id'],      
                'title' => (Yii::t('app', $event['service_name'])),          
                'color' =>  (($foundModel->contact_number == $event['contact_number']) ?  '#ff8300' : '#dddddd'),
                'start' => $event['date'].' '.$event['time'],
                'end' =>  date('Y-m-d H:i:s',strtotime($event['date'].' '.$event['time'].' + '.$event['time_taken'].' minute')),
                //'url' => Url::toRoute(['/sheddule-list/view/'.$event['id']]),
                'extraParams' =>[
                    'id' => $event['id'],
                    'color' => (($foundModel->id == $event['id']) ? '#ff8300' : (empty($event['color']) ? '#0088cc' : $event['color'])),      
                ]                  
            ];      

        }
     
      
        $modelCompany = $this->findModelCompany($companyArr['id']); 
        
        $slotMinTime = ((isset($companyArr['slot_min_time']) && !empty($companyArr['slot_min_time'])) ? $companyArr['slot_min_time'] : '00:00:00');
        $slotMaxTime = ((isset($companyArr['slot_max_time']) && !empty($companyArr['slot_max_time'])) ? $companyArr['slot_max_time'] : '23:45:00');
   
  
        $modelCompany->slot_min_time = strtotime($slotMinTime); 
        $modelCompany->slot_max_time = strtotime($slotMaxTime); 
        
        $usersArr = HelpersCache::arrayTeamSimpleCache(\common\helpers\SecurityAccess::companyCode());  

        $placeholders = [                 
            'full_name' => $foundModel->full_name,
            'contact_number' => $foundModel->contact_number,
            'email' => $foundModel->email,     
        ];

        return $this->render('/bookings-list/update-client',
            [      
                'model' => $model, 
                'foundModel' => $foundModel,
                'placeholders' => $placeholders,
                'modelSearch' => $modelSearch,
                'modelCompany' => $modelCompany,
                'arrSheddule' => $arrSheddule,
                'companyArr' => $companyArr,         
                'myData' => json_encode($myDataArr),  
                'slotMinTime' => $slotMinTime,      
                'slotMaxTime' => $slotMaxTime,      
                'usersArr' => $usersArr,             
                'coin' => $coin,
                'bookingDate' => date('Y-m-d'),
                'type' => 'client',
                'url' => 'clients-list/view/'.$foundModel->id, 
                'action' => '/clients-list/booking-create/'.$foundModel->id, 
                //'submitButton' => $submitButton
            ]
        );
    }

    public function  actionClientCreate(){

        $model = new Sheddule();    
        $modelSearch = new User();

        $id = (isset($_POST['id']) ? $_POST['id'] : '0');
        $coin = (isset($_POST['coin']) ? $_POST['coin'] : '€');            
        $current_date = (isset($_POST['current_date'])? $_POST['current_date'] : '');  
        
        $model->date = date('Y-m-d', strtotime($current_date));
        $model->time = strtotime(date('H:i', strtotime($current_date)));
        
        $foundModel = $this->findModelUser($id);    

       return $this->renderPartial('@frontend/views/bookings-list/modals/create-client', [
            'model' => $model,
            'modelSearch' => $modelSearch,
            'coin' => $coin,  
            'foundModel' => $foundModel,
            'action' => 'dashboard'     
   
            
    
       ]);

    }

    /**
     * Deletes an existing Clients model.
     * If deletion is successful, the browser will be redirected to the 'index' page.
     * @param int $id ID
     * @return \yii\web\Response
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionDelete($id)
    {      
        $target = $this->findModel($id);
        if ($target->company_code !== \common\helpers\SecurityAccess::companyCode()) {
            throw new \yii\web\ForbiddenHttpException(Yii::t('app', 'permission_denied'));
        }
        $getGuidById = $target->guid;

         Sheddule::deleteAll([     
            'client_username' => $getGuidById,
            'company_code' => \common\helpers\SecurityAccess::companyCode()
        ]);  


        PermissionsHelpers::adminLaguagesSet();

        $resultPermission = PermissionsHelpers::adminPermissionsAccess();

        if($resultPermission){
            return $this->redirect(['site/login' . \common\helpers\Helpers::getUserAgent()]);
        }

        if (Yii::$app->user->isGuest) {    
            return $this->goHome();
        }

        $model = $this->findModel($id);

        HelpersCache::deleteOldKey($model->company_code, 'scheddule');   
        LogsController::saveLog($model,'delete'); 

        $this->findModel($id)->delete();

        return $this->redirect(['index']);
    }

    public function actionSchedduleChangeToPaid(){
        
        PermissionsHelpers::adminLaguagesSet();

        $resultPermission = PermissionsHelpers::adminPermissionsAccess();

        if($resultPermission){
            return $this->redirect(['site/login' . \common\helpers\Helpers::getUserAgent()]);
        }

        $bookingCode = (isset($_POST['booking_code'])? $_POST['booking_code'] : ''); 
        $serviceCode = (isset($_POST['service_code'])? $_POST['service_code'] : ''); 
        $clientGuid = (isset($_POST['client_guid'])? $_POST['client_guid'] : '');     
        $paid = (isset($_POST['checked'])? $_POST['checked'] : '0'); 
        $price = (isset($_POST['price'])? $_POST['price'] : '0'); 

        $result = Yii::$app->db->createCommand("UPDATE sheddule SET paid=:paid WHERE booking_code=:booking_code")
        ->bindValue(':paid', $paid)
        ->bindValue(':booking_code', $bookingCode)
        ->execute();

        //$serviceArr = Helpers::arrayServices(['service_code' =>  $serviceCode], 'one');

        //$price = ((isset($serviceArr['price']))  ? $serviceArr['price'] : 0);

        $model = new Debts();
       
        $model->full_amount = $price;
        $model->remaining_amount = $price;
        $model->code = $serviceCode;
        $model->booking_code = $bookingCode;
        $model->client_guid = $clientGuid;
        $model->paid_amount = 0;
        $model->company_code = \common\helpers\SecurityAccess::companyCode();
        $model->received_guid = Yii::$app->user->identity->guid;
        $model->debts_code = 'd'.Helpers::generateRandowHumber();
        $model->type = 'service';

        if($paid){
            // ✅ delete existing debt
            Debts::deleteAll([
                'code' => $serviceCode,
                'booking_code' => $bookingCode,
                'client_guid' => $clientGuid,
                'company_code' => \common\helpers\SecurityAccess::companyCode()
            ]);  

            DebtHistory::deleteAll([
                'code' => $serviceCode,
                'booking_code' => $bookingCode,
                'client_guid' => $clientGuid,
                'company_code' => \common\helpers\SecurityAccess::companyCode()
            ]);  

        }else{
            if($model->validate()){
                $model->save();
            }
        }

     

   
        print"<pre>";
        print_r($model->getErrors());        
        die();

        return $result;

    }

    /**
     * Finds the Clients model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param int $id ID
     * @return Clients the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {        
        PermissionsHelpers::adminLaguagesSet();

        $resultPermission = PermissionsHelpers::adminPermissionsAccess();

        if($resultPermission){
            return $this->redirect(['site/login' . \common\helpers\Helpers::getUserAgent()]);
        }

        if (($model = $this->scopedClientQuery()->andWhere(['user_table.id' => $id])->one()) !== null) {
            return $model;
        }

        throw new NotFoundHttpException('The requested page does not exist.');
    }

    private function renderFitnessProfile(User $client)
    {
        \common\helpers\ClientFitnessProfile::activate($client);
        $tab = Yii::$app->request->get('tab', 'summary');
        $aliases = ['home'=>'summary', 'performance'=>'progress', 'attendance'=>'sessions', 'sheddule'=>'sessions', 'personal-classes'=>'payments', 'debts'=>'payments', 'memberships'=>'payments', 'package'=>'payments'];
        $tab = is_string($tab) ? ($aliases[$tab] ?? $tab) : 'summary';
        if (!is_string($tab) || !in_array($tab, ['summary', 'progress', 'notes', 'sessions', 'payments'], true)) $tab = 'summary';
        $sections = \common\helpers\ClientFitnessProfile::sections();
        if ($tab === 'progress') {
            $section = Yii::$app->request->get('section', '');
            $available = array_values(array_diff($sections, ['performance-dashboard']));
            if (!$available) throw new \yii\web\ForbiddenHttpException(Yii::t('app','not_allowed'));
            if (!in_array($section, $available, true)) $section = $available[0] ?? null;
            if ($section) return $this->redirect(\common\helpers\ClientFitnessProfile::sectionUrl($client, $section));
        }
        $canSessions = \common\helpers\ClientFitnessProfile::can('t-members-attendance') || \common\helpers\ClientFitnessProfile::can('t-classes-schedule');
        $canPayments = \common\helpers\ClientFitnessProfile::can('t-members-personal-classes') || \common\helpers\ClientFitnessProfile::can('t-members-memberships') || \common\helpers\ClientFitnessProfile::can('t-members-debts');
        if (($tab === 'sessions' && !$canSessions) || ($tab === 'payments' && !$canPayments) || ($tab === 'notes' && !$sections)) throw new \yii\web\ForbiddenHttpException(Yii::t('app', 'not_allowed'));
        $params = ['model'=>$client, 'tab'=>$tab, 'summary'=>\common\helpers\ClientFitnessSummary::forClients([$client])[$client->guid] ?? []];
        if ($tab === 'sessions') {
            if (\common\helpers\ClientFitnessProfile::can('t-members-attendance')) {
            $params += ['attendanceSummary'=>$this->clientAttendanceSummary($client->guid),
                'dataProviderAttendance'=>$this->clientAttendanceDataProvider($client->guid, null, 'attendance-page'),
                'dataProviderGymAccessAttendance'=>$this->clientAttendanceDataProvider($client->guid, GymAttendance::TYPE_GYM_ACCESS, 'gym-access-attendance-page'),
                'dataProviderClassAttendance'=>$this->clientAttendanceDataProvider($client->guid, GymAttendance::TYPE_CLASS_ATTENDANCE, 'class-attendance-page')];
            }
            if (\common\helpers\ClientFitnessProfile::can('t-classes-schedule')) $params['bookings'] = new ActiveDataProvider(['query'=>\common\models\GymBooking::find()->with('gymClass')->where(['company_code'=>$this->activeCompanyCode(),'client_guid'=>$client->guid])->orderBy(['start_datetime'=>SORT_DESC]),'pagination'=>['pageParam'=>'booking-page','pageSize'=>10]]);
        }
        if ($tab === 'payments') {
            if (\common\helpers\ClientFitnessProfile::can('t-members-personal-classes')) $params['purchases'] = $this->personalClassPurchaseDataProvider($client->guid);
            if (\common\helpers\ClientFitnessProfile::can('t-members-memberships')) {
                $params += ['memberships'=>$this->membershipDataProvider([$client->guid]),'paymentTracker'=>$this->clientMembershipPaymentTracker([$client->guid]),'familyDetails'=>$this->clientMembershipFamilyDetails($client)];
            }
            if (\common\helpers\ClientFitnessProfile::can('t-members-debts')) {
                $search = new DebtsSearch();
                $params['debts'] = $search->search([]);
                $params['debts']->query->andWhere(['company_code'=>$this->activeCompanyCode(),'client_guid'=>$client->guid])->andWhere(['<>','type',Debts::TYPE_MEMBERSHIP]);
            }
        }
        return $this->render('profile', $params);
    }

    protected function findClientModel($id)
    {
        $profile = \common\helpers\ClientFitnessProfile::client();
        if ($profile && (int)$profile->id !== (int)$id) throw new NotFoundHttpException(Yii::t('app','client_not_found'));
        if ($profile) return $profile;
        $model = User::findOne([
            'id' => $id,
            'company_code' => \common\helpers\SecurityAccess::companyCode(),
            'level' => 'client',
        ]);

        if ($model !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('app', 'client_not_found'));
    }

    protected function findClientMembershipModel($id, $clientGuid)
    {
        $model = Membership::findOne([
            'id' => $id,
            'client_guid' => $clientGuid,
            'company_code' => $this->activeCompanyCode(),
        ]);

        if ($model !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('app', 'membership_not_found'));
    }

    protected function findClientMembershipModelInScope($id, array $clientGuids)
    {
        $clientGuids = array_values(array_unique(array_filter($clientGuids)));
        $model = Membership::find()
            ->where([
                'id' => (int)$id,
                'company_code' => $this->activeCompanyCode(),
                'client_guid' => $clientGuids,
            ])
            ->one();

        if ($model !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('app', 'membership_not_found'));
    }

    protected function findClientByGuid($clientGuid)
    {
        $profile = \common\helpers\ClientFitnessProfile::client();
        if ($profile && $profile->guid === $clientGuid) return $profile;
        $model = User::findOne([
            'guid' => $clientGuid,
            'company_code' => \common\helpers\SecurityAccess::companyCode(),
            'level' => 'client',
        ]);

        if ($model !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('app', 'client_not_found'));
    }

    protected function findClientPersonalClassPurchaseModel($id, $clientGuid)
    {
        $model = PersonalClassPurchase::findOne([
            'id' => $id,
            'client_guid' => $clientGuid,
            'company_code' => $this->activeCompanyCode(),
        ]);

        if ($model !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('app', 'The requested page does not exist.'));
    }

    private function personalClassPurchaseDataProvider($clientGuid)
    {
        return new ActiveDataProvider([
            'query' => PersonalClassPurchase::find()
                ->where([
                    'company_code' => $this->activeCompanyCode(),
                    'client_guid' => $clientGuid,
                ])
                ->orderBy(['purchase_date' => SORT_DESC, 'id' => SORT_DESC]),
            'pagination' => ['pageSize' => 10],
        ]);
    }

    private function syncPersonalClassUsageLog(PersonalClassPurchase $purchase, $previousUsed, $usedCount)
    {
        if (!$purchase->hasAttribute('usage_log')) {
            return;
        }

        $log = $this->personalClassUsageLog($purchase);
        $now = date('Y-m-d H:i:s');

        for ($slot = 1; $slot <= (int)$usedCount; $slot++) {
            if (empty($log[$slot])) {
                $log[$slot] = $slot <= (int)$previousUsed && !empty($purchase->updated_date)
                    ? $purchase->updated_date
                    : $now;
            }
        }

        foreach (array_keys($log) as $slot) {
            if ((int)$slot > (int)$usedCount) {
                unset($log[$slot]);
            }
        }

        ksort($log, SORT_NUMERIC);
        $purchase->usage_log = empty($log) ? null : json_encode($log);
    }

    private function personalClassUsageLog(PersonalClassPurchase $purchase)
    {
        if (!$purchase->hasAttribute('usage_log') || empty($purchase->usage_log)) {
            return [];
        }

        $decoded = json_decode((string)$purchase->usage_log, true);
        if (!is_array($decoded)) {
            return [];
        }

        $log = [];
        foreach ($decoded as $slot => $date) {
            if ((int)$slot > 0 && !empty($date)) {
                $log[(int)$slot] = $date;
            }
        }

        return $log;
    }

    private function personalClassUsageLogLabels(PersonalClassPurchase $purchase)
    {
        return $purchase->usageLogLabels();
    }

    private function clientProgressPhotoDataProvider($clientGuid)
    {
        return new ActiveDataProvider([
            'query' => ProgressPhoto::find()
                ->where([
                    'company_code' => $this->activeCompanyCode(),
                    'client_guid' => $clientGuid,
                ])
                ->orderBy(['photo_date' => SORT_DESC, 'id' => SORT_DESC]),
            'pagination' => ['pageSize' => 8],
        ]);
    }

    private function clientBodyMeasurementDataProvider($clientGuid)
    {
        return new ActiveDataProvider([
            'query' => BodyMeasurement::find()
                ->where([
                    'company_code' => $this->activeCompanyCode(),
                    'client_guid' => $clientGuid,
                ])
                ->orderBy(['measurement_date' => SORT_DESC, 'id' => SORT_DESC]),
            'pagination' => ['pageSize' => 8],
        ]);
    }

    private function clientFitnessAssessmentDataProvider($clientGuid)
    {
        return new ActiveDataProvider([
            'query' => FitnessAssessment::find()
                ->with(['trainer'])
                ->where([
                    'company_code' => $this->activeCompanyCode(),
                    'client_guid' => $clientGuid,
                ])
                ->orderBy(['assessment_date' => SORT_DESC, 'id' => SORT_DESC]),
            'pagination' => ['pageSize' => 8],
        ]);
    }

    private function newPerformanceModel(User $client, $type)
    {
        $this->requirePerformanceType($type);
        $attributes = [
            'company_code' => $this->activeCompanyCode(),
            'client_guid' => $client->guid,
        ];

        if ($type === 'progress-photo') {
            return new ProgressPhoto($attributes + ['photo_date' => date('Y-m-d')]);
        }

        if ($type === 'body-measurement') {
            return new BodyMeasurement($attributes + ['measurement_date' => date('Y-m-d')]);
        }

        if ($type === 'fitness-assessment') {
            return new FitnessAssessment($attributes + ['assessment_date' => date('Y-m-d')]);
        }

        throw new NotFoundHttpException(Yii::t('app', 'The requested page does not exist.'));
    }

    private function findClientPerformanceModel($recordId, $clientGuid, $type)
    {
        $this->requirePerformanceType($type);
        $where = [
            'id' => $recordId,
            'company_code' => $this->activeCompanyCode(),
            'client_guid' => $clientGuid,
        ];

        if ($type === 'progress-photo') {
            $model = ProgressPhoto::findOne($where);
        } elseif ($type === 'body-measurement') {
            $model = BodyMeasurement::findOne($where);
        } elseif ($type === 'fitness-assessment') {
            $model = FitnessAssessment::findOne($where);
        } else {
            $model = null;
        }

        if ($model !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('app', 'The requested page does not exist.'));
    }

    private function requirePerformanceType($type)
    {
        $section = ['progress-photo'=>'progress-photos','body-measurement'=>'body-measurements','fitness-assessment'=>'fitness-assessments'][$type] ?? null;
        if (!$section || !\common\helpers\PerformanceNoteAccess::canManage(Yii::$app->user->identity,$this->activeCompanyCode(),$section)) throw new \yii\web\ForbiddenHttpException(Yii::t('app','not_allowed'));
    }

    private function saveClientProgressPhoto(ProgressPhoto $model, $fileAttribute, $pathAttribute)
    {
        if ($model->$fileAttribute === null) {
            return;
        }

        $dir = '@frontend/runtime/private/progress-photos/' . UploadSecurityHelper::safePathSegment($model->company_code);
        $filename = UploadSecurityHelper::savePublicImage($model->$fileAttribute, $dir, $pathAttribute . '-' . $model->client_guid . '-' . date('YmdHis'));

        if ($filename !== false) {
            $model->$pathAttribute = 'private:' . $filename;
        }
    }

    private function personalClassPackageOptions()
    {
        $options = [];
        foreach ($this->personalClassPackages() as $package) {
            $options[$package->code] = $package->title . ' - ' . Helpers::formatCurrency($package->price) . ' / ' . (int)$package->usage_limit . 'x';
        }

        return $options;
    }

    private function personalClassPackages()
    {
        return PersonalClassPackage::find()
            ->where([
                'company_code' => $this->activeCompanyCode(),
                'active' => 1,
            ])
            ->orderBy(['title' => SORT_ASC])
            ->all();
    }

    private function applyPersonalClassPackageToPurchase(PersonalClassPurchase $purchase)
    {
        if (empty($purchase->package_code)) {
            return;
        }

        $package = PersonalClassPackage::findOne([
            'company_code' => \common\helpers\SecurityAccess::companyCode(),
            'code' => $purchase->package_code,
        ]);

        if ($package === null) {
            return;
        }

        $purchase->title = $package->title;
        $purchase->price = (float)$package->price;
        $purchase->usage_limit = (int)$package->usage_limit;
        $purchase->usage_used = min((int)$purchase->usage_used, (int)$purchase->usage_limit);
    }

    private function membershipDataProvider($clientGuid)
    {
        $clientGuids = is_array($clientGuid) ? array_values(array_unique(array_filter($clientGuid))) : [$clientGuid];

        return new ActiveDataProvider([
            'query' => Membership::find()
                ->where([
                    'company_code' => \common\helpers\SecurityAccess::companyCode(),
                    'client_guid' => $clientGuids,
                ])
                ->orderBy([
                    new \yii\db\Expression('CASE WHEN start_date <= CURDATE() AND end_date >= CURDATE() THEN 0 WHEN start_date > CURDATE() THEN 1 ELSE 2 END'),
                    new \yii\db\Expression('CASE WHEN start_date > CURDATE() THEN start_date ELSE NULL END ASC'),
                    new \yii\db\Expression('CASE WHEN start_date <= CURDATE() AND end_date >= CURDATE() THEN end_date ELSE NULL END ASC'),
                    'end_date' => SORT_DESC,
                    'id' => SORT_DESC,
                ]),
            'pagination' => ['pageSize' => 10],
        ]);
    }

    private function clientAttendanceDataProvider($clientGuid, $attendanceType = null, $pageParam = 'attendance-page')
    {
        $query = GymAttendance::find()
            ->with(['membership', 'gymClass'])
            ->where([
                'company_code' => $this->activeCompanyCode(),
                'client_guid' => $clientGuid,
                'active' => 1,
            ]);

        if ($attendanceType !== null) {
            $query->andWhere(['attendance_type' => $attendanceType]);
        }

        return new ActiveDataProvider([
            'query' => $query->orderBy(['checkin_date' => SORT_DESC, 'id' => SORT_DESC]),
            'pagination' => [
                'pageSize' => 8,
                'pageParam' => $pageParam,
            ],
        ]);
    }

    private function clientAttendanceSummary($clientGuid)
    {
        $baseQuery = GymAttendance::find()
            ->where([
                'company_code' => $this->activeCompanyCode(),
                'client_guid' => $clientGuid,
                'active' => 1,
            ]);

        $lastAttendance = (clone $baseQuery)
            ->orderBy(['checkin_date' => SORT_DESC, 'id' => SORT_DESC])
            ->one();

        return [
            'total' => (int)(clone $baseQuery)->count(),
            'gym_access' => (int)(clone $baseQuery)->andWhere(['attendance_type' => GymAttendance::TYPE_GYM_ACCESS])->count(),
            'class_attendance' => (int)(clone $baseQuery)->andWhere(['attendance_type' => GymAttendance::TYPE_CLASS_ATTENDANCE])->count(),
            'attended' => (int)(clone $baseQuery)->andWhere(['attendance_status' => GymAttendance::STATUS_ATTENDED])->count(),
            'no_show' => (int)(clone $baseQuery)->andWhere(['attendance_status' => GymAttendance::STATUS_NO_SHOW])->count(),
            'last_checkin' => $lastAttendance ? $lastAttendance->checkin_date : null,
        ];
    }

    private function activeCompanyCode()
    {
        if (Yii::$app->has('activeCompany')) {
            $companyCode = Yii::$app->activeCompany->getCompanyCode();
            if (!empty($companyCode)) {
                return $companyCode;
            }
        }

        return \common\helpers\SecurityAccess::companyCode() ?? null;
    }

    private function companyAccessMap(array $clients, $companyCode)
    {
        $userIds = [];
        foreach ($clients as $client) {
            if ($client instanceof User && !empty($client->id)) {
                $userIds[] = (int)$client->id;
            }
        }

        $userIds = array_values(array_unique($userIds));
        if (empty($userIds) || empty($companyCode)) {
            return [];
        }

        $map = [];
        $today = date('Y-m-d');

        $memberships = CompanyUserMembership::find()
            ->where([
                'company_code' => $companyCode,
                'user_id' => $userIds,
            ])
            ->orderBy(['approved_date' => SORT_DESC, 'id' => SORT_DESC])
            ->all();

        foreach ($memberships as $membership) {
            $status = $membership->status;
            $isApproved = $status === CompanyUserMembership::STATUS_APPROVED
                && (empty($membership->access_start) || $membership->access_start <= $today)
                && (empty($membership->access_expires) || $membership->access_expires >= $today);

            $map[(int)$membership->user_id] = [
                'status' => $isApproved ? CompanyUserMembership::STATUS_APPROVED : $status,
                'label' => Yii::t('app', $isApproved ? 'approved' : $status),
                'class' => $isApproved ? 'text-bg-success' : ($status === CompanyUserMembership::STATUS_PENDING ? 'text-bg-warning' : 'text-bg-secondary'),
                'membership_id' => $membership->id,
                'role' => $membership->role,
                'approved_date' => $membership->approved_date,
            ];
        }

        $requests = CompanyAccessRequest::find()
            ->where([
                'company_code' => $companyCode,
                'user_id' => $userIds,
                'status' => [
                    CompanyAccessRequest::STATUS_PENDING,
                    CompanyAccessRequest::STATUS_APPROVED,
                    CompanyAccessRequest::STATUS_REJECTED,
                    CompanyAccessRequest::STATUS_REVOKED,
                ],
            ])
            ->orderBy(['requested_date' => SORT_DESC, 'id' => SORT_DESC])
            ->all();

        foreach ($requests as $request) {
            $userId = (int)$request->user_id;
            if (isset($map[$userId]) && $map[$userId]['status'] === CompanyUserMembership::STATUS_APPROVED) {
                $map[$userId]['request_id'] = $request->id;
                continue;
            }

            $map[$userId] = [
                'status' => $request->status,
                'label' => Yii::t('app', $request->status),
                'class' => $request->status === CompanyAccessRequest::STATUS_PENDING ? 'text-bg-warning' : ($request->status === CompanyAccessRequest::STATUS_APPROVED ? 'text-bg-success' : 'text-bg-secondary'),
                'request_id' => $request->id,
                'role' => $request->approved_role ?: $request->requested_role,
                'requested_date' => $request->requested_date,
            ];
        }

        return $map;
    }

    private function canManageCompanyAccess($companyCode)
    {
        if (Yii::$app->user->isGuest) {
            return false;
        }

        if (\common\helpers\SecurityAccess::isPlatformAdmin()) {
            return true;
        }

        return Yii::$app->has('activeCompany') && Yii::$app->activeCompany->getCompanyCode() === $companyCode
            && Yii::$app->activeCompany->can('company_access_manage');
    }

    private function clientMembershipPaymentTracker($clientGuid, array $params = [])
    {
        $clientGuids = is_array($clientGuid) ? array_values(array_unique(array_filter($clientGuid))) : [$clientGuid];
        $rows = [];
        $rowsByMembership = [];
        $stats = [
            'expected' => 0,
            'paid' => 0,
            'due' => 0,
            'expected_amount' => 0,
            'paid_amount' => 0,
            'remaining_amount' => 0,
        ];
        $monthlyFee = 0;

        $memberships = Membership::find()
            ->where([
                'company_code' => \common\helpers\SecurityAccess::companyCode(),
                'client_guid' => $clientGuids,
                'active' => 1,
            ])
            ->orderBy(['start_date' => SORT_ASC, 'id' => SORT_ASC])
            ->all();

        $activeMembershipCount = 0;
        foreach ($memberships as $membership) {
            if (!$this->isRecurringMembershipType($membership->membership_type)) {
                continue;
            }

            if ($membership->getEffectiveStatus() === Membership::STATUS_ACTIVE) {
                $activeMembershipCount++;
                $monthlyFee += (float)$membership->price / max(1, $this->membershipCycleMonths($membership->membership_type));
            }

            foreach ($this->membershipPaymentScheduleRows($membership) as $row) {
                $rows[] = $row;
                $rowsByMembership[$membership->id][] = $row;
                $stats['expected']++;
                $stats[$row['status']]++;
                $stats['expected_amount'] += (float)$row['amount'];
                $stats['paid_amount'] += (float)$row['paid_amount'];
                $stats['remaining_amount'] += (float)$row['remaining_amount'];
            }
        }

        return [
            'stats' => $stats,
            'summary' => [
                'amount_due' => $stats['remaining_amount'],
                'monthly_fee' => $monthlyFee,
                'payments_made' => $stats['paid_amount'],
                'active' => $activeMembershipCount,
            ],
            'rows' => $rows,
            'rowsByMembership' => $rowsByMembership,
        ];
    }

    private function membershipScopeClientGuids(User $client)
    {
        if (User::getTableSchema()->getColumn('parent_guid') === null) {
            return [$client->guid];
        }

        $responsibleGuid = !empty($client->parent_guid) ? $client->parent_guid : $client->guid;
        $guids = [$responsibleGuid, $client->guid];

        $dependentGuids = User::find()
            ->select('guid')
            ->where([
                'company_code' => $client->company_code,
                'level' => 'client',
                'parent_guid' => $responsibleGuid,
                'active' => 1,
            ])
            ->column();

        return array_values(array_unique(array_filter(array_merge($guids, $dependentGuids))));
    }

    private function resolveMembershipTargetClient(User $pageClient, $clientId = null)
    {
        if (empty($clientId)) {
            return $pageClient;
        }

        $targetClient = $this->findClientModel((int)$clientId);
        if (!in_array($targetClient->guid, $this->membershipScopeClientGuids($pageClient), true)) {
            throw new NotFoundHttpException(Yii::t('app', 'client_not_found'));
        }

        return $targetClient;
    }

    private function clientMembershipFamilyDetails(User $client)
    {
        if (User::getTableSchema()->getColumn('parent_guid') === null) {
            return null;
        }

        $responsibleGuid = !empty($client->parent_guid) ? $client->parent_guid : $client->guid;
        $responsible = User::find()
            ->where([
                'company_code' => $client->company_code,
                'level' => 'client',
                'guid' => $responsibleGuid,
            ])
            ->one();

        $dependents = User::find()
            ->where([
                'company_code' => $client->company_code,
                'level' => 'client',
                'parent_guid' => $responsibleGuid,
                'active' => 1,
            ])
            ->orderBy(['full_name' => SORT_ASC, 'username' => SORT_ASC])
            ->all();

        if (!$responsible instanceof User || (empty($client->parent_guid) && empty($dependents))) {
            return null;
        }

        return [
            'responsible' => $this->clientMembershipFamilyRow($responsible, 'responsible'),
            'dependents' => array_map(function (User $dependent) {
                return $this->clientMembershipFamilyRow($dependent, 'dependent');
            }, $dependents),
        ];
    }

    private function clientMembershipFamilyRow(User $client, $role)
    {
        $membership = $this->latestClientMembership($client->guid, $client->company_code);
        $debtSummary = $this->clientMembershipDebtSummary($client->guid, $client->company_code);

        return [
            'client' => $client,
            'role' => $role,
            'role_label' => Yii::t('app', $role),
            'membership' => $membership,
            'membership_title' => $membership ? $membership->title : Yii::t('app', 'no_membership_set'),
            'membership_type' => $membership ? (Membership::typeOptions()[$membership->membership_type] ?? Yii::t('app', $membership->membership_type)) : null,
            'membership_status' => $membership ? $membership->getEffectiveStatus() : null,
            'membership_status_label' => $membership ? Yii::t('app', $membership->getEffectiveStatus()) : Yii::t('app', 'no_membership_set'),
            'start_date' => $membership ? $membership->start_date : null,
            'end_date' => $membership ? $membership->end_date : null,
            'price' => $membership ? (float)$membership->price : 0,
            'debt_count' => $debtSummary['count'],
            'debt_amount' => $debtSummary['amount'],
        ];
    }

    private function latestClientMembership($clientGuid, $companyCode)
    {
        $memberships = Membership::find()
            ->where([
                'company_code' => $companyCode,
                'client_guid' => $clientGuid,
                'active' => 1,
            ])
            ->orderBy(['end_date' => SORT_DESC, 'start_date' => SORT_DESC, 'id' => SORT_DESC])
            ->all();

        foreach ($memberships as $membership) {
            if ($membership->getEffectiveStatus() === Membership::STATUS_ACTIVE) {
                return $membership;
            }
        }

        return $memberships[0] ?? null;
    }

    private function clientMembershipDebtSummary($clientGuid, $companyCode)
    {
        $query = Debts::find()
            ->where([
                'company_code' => $companyCode,
                'client_guid' => $clientGuid,
                'type' => Debts::TYPE_MEMBERSHIP,
            ])
            ->andWhere(['not in', 'status', [Debts::STATUS_PAID, Debts::STATUS_CANCELLED]])
            ->andWhere(['>', 'remaining_amount', 0]);

        return [
            'count' => (int)(clone $query)->count(),
            'amount' => (float)(clone $query)->sum('remaining_amount'),
        ];
    }

    private function membershipPaymentScheduleRows(Membership $membership)
    {
        $rows = [];

        if (empty($membership->start_date) || empty($membership->end_date) || !$this->isRecurringMembershipType($membership->membership_type)) {
            return $rows;
        }

        $cycleMonths = $this->membershipCycleMonths($membership->membership_type);
        $membershipEnd = strtotime($membership->end_date);
        $today = strtotime(date('Y-m-d'));
        if ($membershipEnd === false || $today === false) {
            return $rows;
        }

        $windowStart = strtotime(date('Y-m-01'));
        $windowEnd = strtotime(date('Y-m-t', strtotime('+12 months')));
        if ($windowStart === false || $windowEnd === false) {
            return $rows;
        }

        $scheduleEnd = min($windowEnd, $membershipEnd);
        $cycleStart = $membership->start_date;
        $dueDay = $this->membershipDueDay($membership);
        $typeOptions = Membership::typeOptions();

        while (($cycleStartTime = strtotime($cycleStart)) !== false && $cycleStartTime <= $scheduleEnd) {
            $period = date('Y-m', $cycleStartTime);
            $dueDate = $this->membershipDueDateForCycle($cycleStart, $dueDay);
            $nextCycleStart = $this->addMonthsClamped($cycleStart, $cycleMonths);
            $coverageEnd = date('Y-m-d', min($membershipEnd, strtotime($nextCycleStart . ' -1 day')));
            $debt = $this->membershipDebtForExactPeriod($membership, $period);
            $status = $this->paymentStatusForDebt($debt);
            $amount = $debt ? (float)$debt->full_amount : (float)$membership->price;
            $paid = $debt ? (float)$debt->paid_amount : 0;
            $remaining = $debt ? (float)$debt->remaining_amount : $amount;
            $isPaidPastPeriod = $status === 'paid' && strtotime($coverageEnd) !== false && strtotime($coverageEnd) < $windowStart;

            if ($isPaidPastPeriod) {
                if ($nextCycleStart === $cycleStart) {
                    break;
                }
                $cycleStart = $nextCycleStart;
                continue;
            }

            $rows[] = [
                'membership' => $membership,
                'debt' => $debt,
                'period' => $period,
                'status' => $status,
                'status_label' => $this->paymentStatusLabel($status),
                'amount' => $amount,
                'paid_amount' => $paid,
                'remaining_amount' => $remaining,
                'due_date' => $debt->due_date ?? $dueDate,
                'coverage_start' => $debt->start_date ?? $cycleStart,
                'coverage_end' => $debt->end_date ?? $coverageEnd,
                'cycle_label' => $typeOptions[$membership->membership_type] ?? Yii::t('app', $membership->membership_type),
            ];

            if ($nextCycleStart === $cycleStart) {
                break;
            }
            $cycleStart = $nextCycleStart;
        }

        usort($rows, static function ($left, $right) {
            return strcmp($left['due_date'] ?? '', $right['due_date'] ?? '');
        });

        return $rows;
    }

    private function normalizeMembershipPaymentPeriod($period)
    {
        $period = trim((string)$period);

        return preg_match('/^\d{4}-\d{2}$/', $period) ? $period : date('Y-m');
    }

    private function duePaymentForMembership(Membership $membership, $periodStart, $periodEnd)
    {
        if (empty($membership->start_date) || empty($membership->end_date) || !$this->isRecurringMembershipType($membership->membership_type)) {
            return null;
        }

        $membershipStart = strtotime($membership->start_date);
        $membershipEnd = strtotime($membership->end_date);
        $periodStartTime = strtotime($periodStart);
        $periodEndTime = strtotime($periodEnd);

        if ($membershipStart === false || $membershipEnd === false || $periodStartTime === false || $periodEndTime === false || $membershipStart > $periodEndTime || $membershipEnd < $periodStartTime) {
            return null;
        }

        $cycleMonths = $this->membershipCycleMonths($membership->membership_type);
        $targetPeriod = date('Y-m', $periodStartTime);
        $cycleStart = $membership->start_date;
        $dueDay = $this->membershipDueDay($membership);

        while (($cycleStartTime = strtotime($cycleStart)) !== false && $cycleStartTime <= $membershipEnd) {
            $period = date('Y-m', $cycleStartTime);
            $nextCycleStart = $this->addMonthsClamped($cycleStart, $cycleMonths);
            $coverageEnd = date('Y-m-d', min($membershipEnd, strtotime($nextCycleStart . ' -1 day')));

            if ($period === $targetPeriod) {
                return [
                    'due_date' => $this->membershipDueDateForCycle($cycleStart, $dueDay),
                    'coverage_start' => $cycleStart,
                    'coverage_end' => $coverageEnd,
                    'cycle_label' => Membership::typeOptions()[$membership->membership_type] ?? Yii::t('app', $membership->membership_type),
                ];
            }

            if ($nextCycleStart === $cycleStart) {
                break;
            }
            $cycleStart = $nextCycleStart;
        }

        return null;
    }

    private function membershipDueDay(Membership $membership)
    {
        $dueDate = !empty($membership->due_date) ? $membership->due_date : $membership->start_date;
        $dueTime = strtotime($dueDate);

        return $dueTime === false ? 1 : (int)date('j', $dueTime);
    }

    private function membershipDueDateForCycle($cycleStart, $dueDay)
    {
        $cycleTime = strtotime($cycleStart);
        if ($cycleTime === false) {
            return $cycleStart;
        }

        $year = (int)date('Y', $cycleTime);
        $month = (int)date('m', $cycleTime);
        $lastDay = (int)date('t', $cycleTime);
        $day = min(max(1, (int)$dueDay), $lastDay);

        return sprintf('%04d-%02d-%02d', $year, $month, $day);
    }

    private function addMonthsClamped($date, $months)
    {
        $timestamp = strtotime($date);
        if ($timestamp === false) {
            return $date;
        }

        $day = (int)date('j', $timestamp);
        $target = new \DateTime(date('Y-m-01', $timestamp));
        $target->modify('+' . (int)$months . ' month');
        $targetDay = min($day, (int)$target->format('t'));
        $target->setDate((int)$target->format('Y'), (int)$target->format('m'), $targetDay);

        return $target->format('Y-m-d');
    }

    private function membershipCycleMonths($membershipType)
    {
        return [
            'monthly' => 1,
            'quarterly' => 3,
            'semiannual' => 6,
            'yearly' => 12,
        ][$membershipType] ?? 1;
    }

    private function isRecurringMembershipType($membershipType)
    {
        return in_array($membershipType, ['monthly', 'quarterly', 'semiannual', 'yearly'], true);
    }

    private function membershipDebtForExactPeriod(Membership $membership, $period)
    {
        return Debts::find()
            ->where([
                'company_code' => \common\helpers\SecurityAccess::companyCode(),
                'type' => Debts::TYPE_MEMBERSHIP,
                'membership_code' => $membership->code,
                'period' => $period,
            ])
            ->orderBy(['id' => SORT_DESC])
            ->one();
    }

    private function formattedMembershipSummary(array $summary)
    {
        return [
            'amount_due' => Helpers::formatCurrency($summary['amount_due'] ?? 0),
            'monthly_fee' => Helpers::formatCurrency($summary['monthly_fee'] ?? 0),
            'payments_made' => Helpers::formatCurrency($summary['payments_made'] ?? 0),
            'active' => (string)($summary['active'] ?? 0),
        ];
    }

    private function paymentStatusForDebt($debt)
    {
        if ($debt !== null && ((float)$debt->remaining_amount <= 0 || $debt->status === Debts::STATUS_PAID)) {
            return 'paid';
        }

        return 'due';
    }

    private function paymentStatusLabel($status)
    {
        $labels = [
            'paid' => Yii::t('app', 'paid'),
            'due' => Yii::t('app', 'due'),
        ];

        return $labels[$status] ?? Yii::t('app', $status);
    }

    private function membershipClassPackUnitValue(Membership $membership)
    {
        $allowed = (int)$membership->classes_allowed;

        return $allowed > 0 ? (float)$membership->price / $allowed : 0;
    }

    private function membershipUsedClassPackValue(Membership $membership)
    {
        return min((int)$membership->classes_used, (int)$membership->classes_allowed) * $this->membershipClassPackUnitValue($membership);
    }

    private function membershipRemainingClassPackValue(Membership $membership)
    {
        return max(0, (int)$membership->classes_allowed - (int)$membership->classes_used) * $this->membershipClassPackUnitValue($membership);
    }

    private function isGymPlan()
    {
        $arrCompanyPlan = Helpers::arrCompanyPlan([
            'company_code' => $this->activeCompanyCode(),
        ]);

        return isset($arrCompanyPlan['plan_name']) && $arrCompanyPlan['plan_name'] === 'gym';
    }

    private function ensureGymPlan()
    {
        if (!$this->isGymPlan()) {
            throw new NotFoundHttpException(Yii::t('app', 'The requested page does not exist.'));
        }
    }

    private function logMembershipHistory(Membership $model, $action)
    {
        (new MembershipHistory([
            'membership_code' => $model->code,
            'action' => $action,
        ]))->save(false);
    }

    protected function findModelUser($id)
    {
        PermissionsHelpers::adminLaguagesSet();

        $resultPermission = PermissionsHelpers::adminPermissionsAccess();

        if($resultPermission){
            return $this->redirect(['site/login' . \common\helpers\Helpers::getUserAgent()]);
        }      
     
        if (($model = $this->scopedClientQuery()->andWhere(['user_table.id' => $id])->one()) !== null) {
            return $model;
        }
      
        throw new NotFoundHttpException('The requested page does not exist.');
    }

    protected function findModelId($username)
    {        
        PermissionsHelpers::adminLaguagesSet();

        $resultPermission = PermissionsHelpers::adminPermissionsAccess();

        if($resultPermission){
            return $this->redirect(['site/login' . \common\helpers\Helpers::getUserAgent()]);
        }

        if (($model = $this->scopedClientQuery()->andWhere(['user_table.username' => $username])->one()) !== null) {
            return $model;
        }

        throw new NotFoundHttpException('The requested page does not exist.');
    }


    protected function findModelShedduleGuid($guid)
    {

        if (($model = Sheddule::findOne(['client_username' => $guid, 'company_code' => \common\helpers\SecurityAccess::companyCode()])) !== null) {
            return $model;
        }

        return new Sheddule();
        //throw new NotFoundHttpException('The requested page does not exist.');
    }

    protected function findModelSheddule($id)
    {
        PermissionsHelpers::adminLaguagesSet();

        $resultPermission = PermissionsHelpers::adminPermissionsAccess();

        if($resultPermission){
            return $this->redirect(['site/login' . \common\helpers\Helpers::getUserAgent()]);
        }      

        if (($model = Sheddule::findOne(['id' => $id, 'company_code' => \common\helpers\SecurityAccess::companyCode()])) !== null) {
            return $model;
        }

        return new Sheddule();
        //throw new NotFoundHttpException('The requested page does not exist.');
    }
    
    public static function findModelCompany($id)
    {
        if (($model = Company::findOne(['id' => $id, 'company_code' => \common\helpers\SecurityAccess::companyCode()])) !== null) {
            return $model;
        }

        throw new NotFoundHttpException('The requested page does not exist.');
    }

    protected function scopedClientQuery()
    {
        $companyCode = \common\helpers\SecurityAccess::companyCode();
        return User::find()->alias('user_table')
            ->where(['user_table.level' => 'client'])
            ->andWhere((new \common\models\UserSearch())->companyClientAccessCondition($companyCode));
    }
}
