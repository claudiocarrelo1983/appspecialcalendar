<?php

/* @var $this yii\web\View */
/* @var $form yii\bootstrap4\ActiveForm */
/* @var $model \frontend\models\SignupForm */

use yii\bootstrap4\Html;
use yii\bootstrap4\ActiveForm;
use yii\helpers\Url;
use common\helpers\Helpers;


$this->title = Yii::t('app','signup_block_title_1');

$path2 = 'sign_up';
$signupFlashErrors = Yii::$app->session->getFlash('error', [], true);
$signupErrors = array_values(array_filter(array_merge(
    $modelSignupForm->getFirstErrors(),
    (array)$signupFlashErrors
)));

$streetLabel = Yii::t('app', 'signup_block_street');
$streetLabel = $streetLabel === 'signup_block_street'
    ? (Yii::$app->language === 'en' ? 'Street' : 'Rua')
    : $streetLabel;

?>

   <div role="main" class="main main banner-header-s banner-header-signup">
        <div class="container py-5 px-4 justify-content-center">  
            <div class="row justify-content-center ">   
                <div class="col-lg-9  form-login ">          
                    <div class="row justify-content-center py-5">                
                        <div class="col-md-9 col-lg-10">    
                     
                            <h2 class="font-weight-bold text-9 mb-0">
                                <?= Yii::t('app', "signup_block_title_1") ?>
                            </h2>
                            <p class="font-weight-regular text-3 text-color-dark negative-ls-05  pt-2">
                                <?= Yii::t('app', "breadcrumb_start_free_trial") ?>           
                            </p>
                            <div class="separator"></div>
                            <?php if (Yii::$app->session->getFlash('signup_csrf_warning', false, true)): ?>
                                <div class="alert alert-warning rounded-4" role="alert"><?= Html::encode(Yii::t('app', 'signup_form_expired')) ?></div>
                            <?php endif; ?>
                            <?php if (!empty($signupErrors)): ?>
                                <div class="alert alert-danger" role="alert">
                                    <ul class="mb-0">
                                        <?php foreach ($signupErrors as $error): ?>
                                            <li><?= Html::encode($error) ?></li>
                                        <?php endforeach; ?>
                                    </ul>
                                </div>
                            <?php endif; ?>
                            <?php $form = ActiveForm::begin(['id' => 'form-signup','options'=>['data-native-auth'=>'register','data-native-auth-logo'=>\common\helpers\CompanyBranding::mobileLogoUrl() ?: '', 'data-native-auth-messages'=>\yii\helpers\Json::encode(\common\helpers\NativeAuthPresentation::messages()), 'data-native-auth-color'=>$companyArr['color'] ?? '', 'data-native-auth-company'=>$companyArr['company_name'] ?? Yii::$app->name]]); ?> 
                                <div class="row">
                                    <div class="col-12 pb-3">
                                        <h4 class="font-weight-bold pt-3 title-booking">                                       
                                            <?= Yii::t('app', "signup_block_dados") ?>                
                                        </h4>      
                                    </div>                                                  
                              
                                    <div class="form-group col-lg-12">
                                        <?= $form->field($modelSignupForm, 'full_name')->textInput(['maxlength' => true, 'class' => 'form-control text-3 h-auto py-2'])->label(Yii::t('app', 'full_name').':') ?>
                                        <?= Html::activeHiddenInput($modelSignupForm, 'first_name') ?>
                                        <?= Html::activeHiddenInput($modelSignupForm, 'last_name') ?>
                                    </div>
                                </div>                   
                                <div class="row ">  
                                    <?= Html::activeHiddenInput($modelSignupForm, 'gender', ['value' => 'men']) ?>
                                    <?= Html::activeHiddenInput($modelSignupForm, 'job_title', ['value' => 'Admin']) ?>
                                    <?= Html::activeHiddenInput($modelSignupForm, 'coin', ['value' => 'euro']) ?>
                                    <div class="form-group col-lg-12 pt-2">          
                                        <?= $form->field($modelSignupForm, 'company')->textInput(['maxlength' => true, 'class' => 'form-control text-3 h-auto py-2'])->label(Yii::t('app', "signup_block_company").':') ?>                             
                                    </div>
                                    <div class="form-group col-lg-12 pt-2">
                                        <?= $form->field($modelSignupForm, 'plan_name')->dropdownList(
                                            Helpers::dropdownSignupClientPlan(true),
                                            ['prompt'=> Yii::t('app', "select_plan"), 'class' => 'form-control text-3 h-auto py-2']
                                        )->label(Yii::t('app', "signup_block_plan").':'); 
                                        ?>
                                    </div>
                                </div> 
                                <div class="row ">  
                                    <div class="form-group col-lg-12 pt-2">                        
                                        <?= $form->field($modelSignupForm, 'email')->textInput(['class' => 'form-control text-3 h-auto py-2',  'autofocus' => true])->label(Yii::t('app', "signup_block_email").':') ?>
                                    </div> 
                                        <div class="form-group col-lg-12">                        
                                        <?= $form->field($modelSignupForm, 'voucher_parent')->textInput(['class' => 'form-control text-3 h-auto py-2'])->label(Yii::t('app', "signup_block_voucher").':') ?>
                                    </div>                                            
                                </div>                  
                                <div class="row pt-2">  
                                    <div class="form-group col-lg-4 "> 
                                        <?= $form->field($modelSignupForm, 'contact_country_code')->dropdownList(
                                            Helpers::dropdownCountryCode(),
                                            [ 'class' => 'form-control text-3 h-auto py-2'])->label(Yii::t('app', "contact_country_code").':')
                                        ?>                              
                                    </div>
                                    <div class="form-group col-lg-8">          
                                        <?= $form->field($modelSignupForm, 'contact_number')->textInput(['maxlength' => true, 'class' => 'form-control text-3 h-auto py-2'])->label(Yii::t('app', "signup_block_contact_number").':') ?>                             
                                    </div>   
                                        
                                </div>
                              
                                <?= Html::activeHiddenInput($modelSignupForm, 'address') ?>
                                <?= Html::activeHiddenInput($modelSignupForm, 'adress_line_1') ?>
                                <?= Html::activeHiddenInput($modelSignupForm, 'adress_line_2') ?>
                                <?= Html::activeHiddenInput($modelSignupForm, 'city') ?>
                                <?= Html::activeHiddenInput($modelSignupForm, 'postcode') ?>
                                <?= Html::activeHiddenInput($modelSignupForm, 'location') ?>
                                <?= Html::activeHiddenInput($modelSignupForm, 'country', ['value' => 'PT']) ?>
                             
                                <div class="row">
                                    <div class="col-12 pt-5">
                                        <h4 class="font-weight-bold pt-3 title-booking">                                       
                                            <?= Yii::t('app', "signup_block_login") ?>                
                                        </h4>      
                                    </div>                               
                                    <div class="form-group col-12 pt-2">
                                        <?= $form->field($modelSignupForm, 'username')->textInput(['class' => 'form-control form-control-lg text-4',  'autofocus' => true])->label(Yii::t('app', "signup_block_username").':')?>
                                    </div>
                                </div>
                                <div class="row pb-4">
                                    <div class="form-group col-12 pt-2"> 
                                        <?= $form->field($modelSignupForm, 'password')->passwordInput(['autocomplete' =>'new-password','id' => 'password-input','class' => 'form-control form-control-lg text-4'])->label(Yii::t('app', "signup_block_password").':')?>
                                    </div>
                                    <div class="pt-3">
                                        <input type="checkbox"  onclick="viewInputPassword(this)">  <?= Yii::t('app', 'show_password') ?>
                                    </div>                            
                                </div>                   
                                <div class="row">
                                    <div class="form-group col-12 pt-2">                    
                                        <?= $form->field($modelSignupForm, 'newsletter')->checkBox(['label' => Yii::t('app', "signup_block_validation_newsletter"),'data-size'=>'small', 'class'=>'form-control ']) ?>
                                    </div>
                           
                                    <div class="form-group col-12">  
                                        <?= $form->field($modelSignupForm, 'privacy')->checkBox(['label' => 
                                                Yii::t('app', "signup_block_validation_privacy").' 
                                                <a href="'.Url::toRoute('/privacy-policy').'" class="text-decoration-none">'.Yii::t('app', "menu_privacy").'</a>',
                                                'data-size'=>'small', 
                                                'class'=>'form-control ',
                                                'id'=>'active']
                                            ) 
                                        ?>                 
                                    </div>
                                </div>

                                <div class="row">
                                    <div class="form-group col ">                    
                                        <?= $form->field($modelSignupForm, 'terms_and_conditions')->checkBox(['label' => 
                                                Yii::t('app', "signup_block_validation_terms").' 
                                                <a href="'.Url::toRoute('/terms-and-conditions').'" class="text-decoration-none">'.Yii::t('app', "menu_terms").'</a>',
                                                'data-size'=>'small', 
                                                'class'=>'form-control ',
                                                'id'=>'active']
                                            ) 
                                        ?>
                                    </div>
                                </div>      
                                
                                <div class="row ">
                                    <div class="form-group col">
                                        <button type="submit" class="btn btn-dark w-100 py-2" data-loading-text="Loading...">
                                            <?= Yii::t('app', "signup_block_register") ?>
                                        </button>
                                    </div>
                                </div>

                                <div class="row ">
                                    <div class="form-group col text-center">
                                        <?= Yii::t('app', "login_question") ?>
                                        <?= '<a href="'.Url::toRoute('site/login').'" class="text-decoration-none">'.Yii::t('app', "login").'</a>' ?>                            
                                    </div>
                                </div>
                            <?php ActiveForm::end(); ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="vector vector-1-dark"></div>   
        <div class="vector vector-2-dark"></div>    
        <div class="vector vector-3-dark"></div>  
    </div>
