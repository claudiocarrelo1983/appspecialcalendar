<?php

use yii\helpers\Html;
use yii\helpers\Url;
use common\helpers\Helpers;

$base_url = Helpers::getApplicationDomain(); 
$displayLink = 1;
$isClient = !Yii::$app->user->isGuest && Yii::$app->user->identity->level === 'client';

switch($base_url){
    case 'localhost:100':
    case 'myspecialgym.com':
        $displayLink = 0;
         break;
    case 'localhost:82':
    case 'localhost:86':
    case 'teamtvde.pt':
        $displayLink = 0;
            break;
    case 'localhost':
    case 'specialcalendar.com':
    case 'specialcalendar.pt':
        $displayLink = 1;

        break;
    default:
        $displayLink = 0;
    break;
}   

?>
 
<header data-fitness-account="<?= Html::encode(!Yii::$app->user->isGuest ? hash('sha256', \common\helpers\SecurityAccess::companyCode() . ':' . Yii::$app->user->identity->guid) : '') ?>" id="page-topbar" data-company-mobile-logo="<?= Html::encode(\common\helpers\CompanyBranding::mobileLogoUrl() ?: '') ?>">
    <div class="navbar-header">
        <div class="d-flex">
            <!-- LOGO -->
            <div class=" d-block d-lg-none">              
               <div>
                    <span class="pl-3">                
                        <?= Html::img(Helpers::companyLogoUrl() ?: Helpers::defaultAdminLogoUrl('dark'), [
                            'alt' => Yii::t('app', 'company_logo'),
                            'height' => 40,
                            'style' => 'max-width: 170px; object-fit: contain;',
                            'onerror' => 'this.onerror=null;this.src=' . \yii\helpers\Json::htmlEncode(Helpers::defaultAdminLogoUrl('dark')),
                        ]) ?>
                    </span>	
                </div>     
            </div>


            <div class="navbar-brand-box p-2 d-none d-lg-block">              
                <?= Html::a(
                    Yii::t('app',
                        '<div class="navbar-box-small">
                            <span class="logo-sm">                
                                '. Helpers::iconHeaderAdminImage(70).'
                            </span>	
                        </div>
                        <div class="navbar-box-big">
                            <span class="logo-lg">	
                                <div class="header-logo">					
                                    '. Helpers::logoHeaderAdminImage(70).'
                                </div>
                            </span>	
                        </div>'),
                    Url::home(),     
                    [
                    'class' => 'logo logo-light',
                    'data-hash' => '',         
                    'data-hash-offset' => 0,  
                    'data-hash-offset-lg' => 130,  
                    ]      
                ) ?>      
            </div>

            <button type="button" class="btn btn-sm px-3 font-size-16 header-item waves-effect d-none d-lg-block" id="vertical-menu-btn">
                <i class="fa fa-fw fa-bars"></i>
            </button>
            <!--

            <div class="dropdown dropdown-mega d-none d-lg-block p-3">                    
                    
                    <?= Html::a(
                        Yii::t('app', 'home'), 
                        Url::home(),     
                        [
                        'class' => 'btn',
                        'data-hash' => '',         
                        'data-hash-offset' => 0,  
                        'data-hash-offset-lg' => 130,  
                        ]      
                    ) ?>                
         
            </div>  
            -->
        </div>

        <div class="d-flex justify-content-center">

        
            <?php //$this->render('/site/mainmenu'); ?>


            <!--
            <div class="dropdown dropdown-mega d-none d-lg-block p-3">
        
            </div>
            -->
            <?= $this->render('/admin/countries'); ?>
            <?php if (!Yii::$app->user->isGuest && Yii::$app->user->identity->level === 'client'): ?>
            <div class="px-0 dropdown d-flex justify-content-center">
                <?= $this->render('/admin/notifications'); ?>
            </div>
            <?php endif ?>

            <div class="px-0 dropdown d-flex justify-content-center ms-1 d-none d-lg-flex">
                <button type="button" class="btn header-item noti-icon waves-effect" data-bs-toggle="fullscreen">
                    <i class="bx bx-fullscreen"></i>
                </button>
            </div>    
            <?php

                $arrCompanyPlan = Helpers::arrCompanyPlan([
                    'company_code' => \common\helpers\SecurityAccess::companyCode()
                ]);

                $planName = $arrCompanyPlan['plan_name'] ?? 'default';
                $housekeepingSignupUrl = Url::toRoute([
                    '/form-signup',
                    'pagecode' => Yii::$app->user->identity->company_code,
                ], true);

                switch ($planName) {

                    case 'hotel':
                        ?>
                        <?php if (!$isClient): ?>
                            <div class="px-0 dropdown d-flex justify-content-center">
                                <?= $this->render('/admin/notifications'); ?>
                            </div>
                            <div class="px-0 dropdown d-flex justify-content-center">
                                <?= Html::button(
                                    '<i class="bx bx-share-alt"></i><span class="badge bg-danger rounded-pill"></span>',
                                    [
                                        'class' => 'btn header-item noti-icon waves-effect',
                                        'encode' => false,
                                        'data-bs-toggle' => 'tooltip',
                                        'data-bs-placement' => 'bottom',
                                        'title' => Yii::t('app', 'subscription_form'),
                                        'onclick' => "window.open('" . $housekeepingSignupUrl . "', '_blank')",
                                    ]
                                ) ?>
                            </div>
                        <?php endif; ?>
                        <?php
                        break;

                    case 'gym':
                        ?>
                        <?php if (!$isClient): ?>
                            <div class="px-0 dropdown d-flex justify-content-center">
                                <?= $this->render('/admin/notifications'); ?>
                            </div>
                            <div class="px-0 dropdown d-flex justify-content-center">
                                <?= Html::button(
                                    '<i class="bx bx-share-alt"></i><span class="badge bg-danger rounded-pill"></span>',
                                    [
                                        'class' => 'btn header-item noti-icon waves-effect',
                                        'encode' => false,
                                        'data-bs-toggle' => 'tooltip',
                                        'data-bs-placement' => 'bottom',
                                        'title' => Yii::t('app', 'subscription_form'),
                                        'onclick' => "window.open('" . $housekeepingSignupUrl . "', '_blank')",
                                    ]
                                ) ?>
                            </div>
                        <?php endif; ?>

                        <div class="px-0 dropdown d-flex justify-content-center">
                            <?= $this->render('/admin/birthdays'); ?>
                        </div>
                        <?php
                        break;

                    default:
                        ?>
                        <?php if (!$isClient): ?>
                            <div class="px-0 dropdown d-flex justify-content-center">
                                <?= $this->render('/admin/notifications'); ?>
                            </div>
                        <?php endif; ?>

                        <div class="px-0 dropdown d-flex justify-content-center">
                            <?= Html::button(
                                '<i class="bx bx-globe"></i><span class="badge bg-danger rounded-pill"></span>',
                                [
                                    'class' => 'btn header-item noti-icon waves-effect',
                                    'encode' => false,
                                    'data-bs-toggle' => 'tooltip',
                                    'data-bs-placement' => 'bottom',
                                    'title' => Yii::t('app', 'booking_page'),
                                    'onclick' => "window.open('" . Url::toRoute([
                                        '/page',
                                        'pagecode' => Yii::$app->user->identity->company_code_url
                                    ], true) . "', '_blank')",
                                ]
                            ) ?>
                        </div>

                        <div class="px-0 dropdown d-flex justify-content-center">
                            <?= $this->render('/admin/birthdays'); ?>
                        </div>
                        <?php
                        break;
                }
                ?>


            <div class=" dropdown d-flex justify-content-center">
                <?= $this->render('/admin/myaccount'); ?>
            </div>    

        </div>
    </div>
</header>
