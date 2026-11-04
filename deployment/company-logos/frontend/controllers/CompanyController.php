<?php

namespace frontend\controllers;

use common\models\Company;
use common\models\CompanySearch;
use common\models\MobilePushCompanySettings;
use yii\web\Controller;
use yii\web\NotFoundHttpException;
use yii\filters\VerbFilter;
use Yii;
use common\helpers\Helpers;
use common\helpers\HelpersCache;
use common\helpers\PermissionsHelpers;
use common\helpers\UploadSecurityHelper;
use yii\web\UploadedFile;

/**
 * CompanyController implements the CRUD actions for Company model.
 */
class CompanyController extends Controller
{

    public function beforeAction($action)
    {

        if (!parent::beforeAction($action)) {
            return false;
        }

        // Check only when the user is logged in
        if ( !Yii::$app->user->isGuest)  {
            if (Yii::$app->session['userSessionTimeout'] < time()) {
                Yii::$app->user->logout();
                $this->refresh();
            } else {
                Yii::$app->session->set('userSessionTimeout', time() + Yii::$app->params['sessionTimeoutSeconds']);
                return true; 
            }
        } else {
            return true;
        }
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
                    ],
                ],
            ]
        );
    }

    /**
     * Lists all Company models.
     *
     * @return string
     */
    public function actionIndex()
    {
      
        PermissionsHelpers::adminLaguagesSet();  

        $resultPermission = PermissionsHelpers::adminPermissionsAccess();

        if($resultPermission){     
            return $this->redirect(['site/login']);
        }      

     
        $paymentCheck = PermissionsHelpers::adminPaymentCheck();

        if($paymentCheck){    
            return $this->redirect(['/my-plan']);    
        }    

        return $this->actionUpdate();
    }

    /**
     * Updates an existing Company model.
     * If update is successful, the browser will be redirected to the 'view' page.
     * @param int $id ID
     * @return string|\yii\web\Response
     * @throws NotFoundHttpException if the model cannot be found
     */
    public function actionUpdate()
    {

        PermissionsHelpers::adminLaguagesSet();  

        $resultPermission = PermissionsHelpers::adminPermissionsAccess();

        if($resultPermission){     
            return $this->redirect(['site/login']);
        }      

        $paymentCheck = PermissionsHelpers::adminPaymentCheck();

        if($paymentCheck){    
            return $this->redirect(['/my-plan']);    
        }    
        
        $this->layout = 'admin';  
   
        $model = $this->findModel();
        $companyPlan = Helpers::arrCompanyPlan(['company_code' => $model->company_code]);
        $reminderSettings = ($companyPlan['plan_name'] ?? '') === 'gym'
            ? MobilePushCompanySettings::forCompany($model->company_code) : null;
        if ($model->cancelation_time === null || trim((string)$model->cancelation_time) === '') {
            $model->cancelation_time = '01:00:00';
        }
        $model->booking_advance_time = (empty($model->booking_advance_time) ? '00:30:00' : $model->booking_advance_time);

        if ($this->request->isPost && $model->load($this->request->post())) {       
            if (($companyPlan['plan_name'] ?? '') !== 'gym' && $model->hasAttribute('gym_clock_enabled')) {
                $model->gym_clock_enabled = $model->getOldAttribute('gym_clock_enabled');
            }
            $reminderInput = $this->request->post('MobilePushCompanySettings', []);
            $saveReminderSettings = $reminderSettings !== null && is_array($reminderInput)
                && array_key_exists('reminder_minutes', $reminderInput);
            if ($saveReminderSettings) {
                // Only the lead time is editable here; tenant and timezone come from the server.
                $reminderSettings->reminder_minutes = $reminderInput['reminder_minutes'];
                $reminderSettings->updated_at = time();
                if (!$reminderSettings->validate()) {
                    $model->addError('company_code', Yii::t('app', 'company_class_reminder_invalid'));
                }
            }
            $model->company_code_url = $model->getOldAttribute('company_code_url');
            $removeLogo = Yii::$app->request->post('remove_logo') === '1';
            $removeBanner = Yii::$app->request->post('remove_banner') === '1';

            if(!empty($model->languages)){
                if(is_array($model->languages)){
                    $model->languages = implode('|', $model->languages);  
                }               
            }

            
            $model->path = Helpers::imgPath('company');
            $pathSave = Helpers::imgRoot('company');
            $pathRoot = Helpers::imgUrl('company');
            
            if (!file_exists($pathRoot)) {            
                mkdir($pathRoot, 0777, true);
            }

            if ($removeLogo) {
                $model->image_logo = null;
            }

            if ($removeBanner) {
                $model->image_banner = null;
            }
        
            $model->logoimage = UploadedFile::getInstance($model, 'logoimage');          
    
            if(isset($model->logoimage->name)){

                $model->logoimage = UploadedFile::getInstance($model, 'logoimage');           

                if($model->validate()){
                    $fileNameLogo = UploadSecurityHelper::savePublicImage($model->logoimage, $pathSave, 'logo-' . Yii::$app->user->identity->company_code);
                    if ($fileNameLogo !== false) {
                        $model->image_logo = '/' . $fileNameLogo;
                    } else {
                        $model->addError('logoimage', Yii::t('app', 'invalid_file_upload'));
                    }
                }else{
                    $model->path = '/images/';
                    $model->image_logo = 'icon-specialcalendar.png';
                }
            }


            $model->mobileLogoImage = UploadedFile::getInstance($model, 'mobileLogoImage');
            if (!$model->hasAttribute('image_logo_mobile')) {
                if ($model->mobileLogoImage) $model->addError('mobileLogoImage', Yii::t('app','company_mobile_logo_unavailable'));
            } else {
                if (Yii::$app->request->post('remove_mobile_logo') === '1') $model->image_logo_mobile = null;
                if ($model->mobileLogoImage && $model->validate()) {
                    $mobileFile = UploadSecurityHelper::savePublicImage($model->mobileLogoImage, $pathSave, 'mobile-logo-' . $model->getOldAttribute('company_code'));
                    if ($mobileFile !== false) $model->image_logo_mobile = '/' . $mobileFile;
                    else $model->addError('mobileLogoImage', Yii::t('app','invalid_file_upload'));
                }
            }

            $model->bannerimage = UploadedFile::getInstance($model, 'bannerimage');          
    
            if(isset($model->bannerimage->name)){

                $model->bannerimage = UploadedFile::getInstance($model, 'bannerimage');           
                if($model->validate()){
                    $fileNameLogo = UploadSecurityHelper::savePublicImage($model->bannerimage, $pathSave, 'banner-' . Yii::$app->user->identity->company_code);
                    if ($fileNameLogo !== false) {
                        $model->image_banner = '/' . $fileNameLogo;
                    } else {
                        $model->addError('bannerimage', Yii::t('app', 'invalid_file_upload'));
                    }
                }else{
                    $model->path = '/images/company/';
                    $model->image_banner = 'generic-background.jpg'; //
                }
            }
        

            $model->cancelation_time = (($model->cancelation_time === null || trim((string)$model->cancelation_time) === '') ? '01:00:00' : $model->cancelation_time);
            $model->booking_advance_time = ((empty( $model->booking_advance_time)) ? '00:30:00' :  $model->booking_advance_time);
            $model->timespan = ((empty( $model->timespan)) ? '00:30:00' :  $model->timespan);
            $model->created_date = date('Y-m-d H:i:s');        
            
            
            /*
            $model->validate();


            print"<pre>";
            print_r($model->getErrors());
            die();
            */
           

            if(!$model->hasErrors() && $this->saveCompanySettings($model, $saveReminderSettings ? $reminderSettings : null)){

                HelpersCache::deleteDir($model->company_code, 'company');

                HelpersCache::makeDirectory($model->company_code, 'company', date('YmdHis'));

                Yii::$app->db->createCommand("UPDATE user SET 
                    company_code_url=:company_code_url            
                    WHERE id=:id AND company_code=:company_code")
                ->bindValue(':company_code_url', $model->company_code_url)
                ->bindValue(':id', Yii::$app->user->identity->id)
                ->bindValue(':company_code', $model->company_code)
                ->execute();

                if (Yii::$app->has('activeCompany')) {
                    $activeCompany = Yii::$app->activeCompany->getCompany();
                    if ($activeCompany && $activeCompany->company_code === $model->company_code) $activeCompany->refresh();
                }
                Helpers::applyCompanyCurrency();
                Yii::$app->session->setFlash('success', Yii::t('app','submit_save'));             
      
            }          
        }        

        $model->languages = explode('|', $model->languages);   
    
        return $this->render('update', [
            'model' => $model,
            'reminderSettings' => $reminderSettings,
        ]);
    }

    protected function saveCompanySettings(Company $model, ?MobilePushCompanySettings $reminderSettings)
    {
        $transaction = Yii::$app->db->beginTransaction();
        try {
            if (!$model->save() || ($reminderSettings !== null && !$reminderSettings->save())) {
                $transaction->rollBack();
                return false;
            }
            $transaction->commit();
            return true;
        } catch (\Throwable $exception) {
            $transaction->rollBack();
            Yii::error('Company settings could not be saved.', __METHOD__);
            $model->addError('company_code', Yii::t('app', 'save_failed'));
            return false;
        }
    }

    /**
     * Finds the Company model based on its primary key value.
     * If the model is not found, a 404 HTTP exception will be thrown.
     * @param int $id ID
     * @return Company the loaded model
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel()
    {
        // Missing/revoked company access is a permission failure, not a missing company.
        $companyCode = \common\helpers\SecurityAccess::companyCode();
        if (($model = Company::findOne(['company_code' => $companyCode])) !== null) {
            return $model;
        }

        throw new NotFoundHttpException('The requested page does not exist.');
    }
}
