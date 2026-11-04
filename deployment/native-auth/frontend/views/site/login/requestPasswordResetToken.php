<?php

/* @var $this yii\web\View */
/* @var $form yii\bootstrap4\ActiveForm */
/* @var $model \frontend\models\PasswordResetRequestForm */

use yii\bootstrap4\Html;
use yii\bootstrap4\ActiveForm;
use yii\helpers\Url;

$this->title = Yii::t('app','login_block_forgot_password_2');;

$path2 = 'reset_token';
?>


<div role="main" class="main banner-header banner-header-unique">
    <div class="container py-5 ">  
        <div class="row justify-content-center p-2">
            <div class="col-lg-5  form-login p-3 p-lg-5">
                <h2 class="font-weight-bold text-7 mb-0">
                    <?= Yii::t('app', "login_block_forgot_password_2") ?>
                </h2>
                <p class="text-1rem text-color-default negative-ls-05 pt-3 pb-4 ">
                    <?= Yii::t('app', "login_block_text_1") ?>           
                </p>

                <?php if (Yii::$app->session->hasFlash('success')): ?>
                    <div class="alert alert-success text-decoration-none text-color-dark text-color-hover-primary font-weight-semibold text-2">
                        <?= Yii::$app->session->getFlash('success') ?>
                    </div>
                <?php endif; ?>
                 <?php if (Yii::$app->session->hasFlash('error')): ?>
                    <div class="alert alert-danger text-decoration-none text-color-dark text-color-hover-primary font-weight-semibold text-2">
                        <?= Yii::$app->session->getFlash('error') ?>
                    </div>
                <?php endif; ?>
            
                <div class="m-2 pb-2 pt-2">        
                <?php $form = ActiveForm::begin(['id' => 'login-form','options'=>['data-native-auth'=>'forgot','data-native-auth-logo'=>\common\helpers\CompanyBranding::mobileLogoUrl() ?: '', 'data-native-auth-messages'=>\yii\helpers\Json::encode(\common\helpers\NativeAuthPresentation::messages()), 'data-native-auth-color'=>$companyArr['color'] ?? '', 'data-native-auth-company'=>$companyArr['company_name'] ?? Yii::$app->name]]); ?>                   
                    <div class="row">                           
                        <div class="form-group col-12">                                     
                            <?= $form->field($model, 'email')->textInput(['class' => 'form-control form-control-lg text-4',  'autofocus' => true])->label(Yii::t('app', "email"))?>
                        </div>                    
                    </div>                                           
                </div>                  

                <div class="row">
                    <div class="form-group col">
                        <?= Html::submitButton(Yii::t('app', "login_button_2"), ['class' => 'btn btn-dark w-100 py-2', 'name' => 'login-button']) ?>
                    </div>
                </div>
                <?php ActiveForm::end(); ?>

                <div class="row pt-2">
                    <div class="form-group col">
                        <?= '<a href="'.Url::toRoute('site/login').'" class="ext-decoration-none text-color-dark text-color-hover-primary font-weight-semibold text-2">'.Yii::t('app', "login_question").'</a>' ?>                            
                    </div>
                </div>
            </div>
        </div>
    </div>   
    <div class="vector vector-1-dark"></div>   
    <div class="vector vector-2-dark"></div>    
    <div class="vector vector-3-dark"></div>  
</div>  
