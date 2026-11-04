<?php

use common\helpers\Helpers;
use yii\helpers\Html;
use yii\helpers\Url;
use yii\widgets\ActiveForm;

/** @var yii\web\View $this */
/** @var frontend\models\FormSignupClientForm $model */
/** @var array $companyArr */
/** @var string $pagecode */
/** @var string $signupLevel */
/** @var bool $isGymSignup */
/** @var array $locationOptions */
/** @var string|null $visitorCountryCode */

$isHousekeepingSignup = ($signupLevel ?? 'client') === 'cleaner';
$isGymSignup = (bool)($isGymSignup ?? false);
$signupTitle = $isHousekeepingSignup ? Yii::t('app', 'subscription_form') : Yii::t('app', 'signup_block_title_1');
$this->title = $signupTitle;
$this->params['companyAuthPage'] = true;
$this->params['disableLoadingOverlay'] = true;
$companyName = $companyArr['company_name'] ?? Yii::$app->name;
$locationOptions = $locationOptions ?? [];
$visitorCountryCode = strtoupper((string)($visitorCountryCode ?? ''));
$bankMethod = $model->bank_method ?: 'uk_bank';
$model->bank_method = $bankMethod;
$loginUrl = Url::to(['/site/login', 'pagecode' => $pagecode]);
$passwordResetUrl = Url::to(['/site/request-password-reset', 'pagecode' => $pagecode]);
$brandColor = preg_match('/^#[0-9a-fA-F]{6}$/', (string)($companyArr['color'] ?? ''))
    ? $companyArr['color']
    : '#2563eb';

$bannerCss = 'banner-header-page';
$imageDisplay = '';

if (!empty($companyArr['image_banner_url'])) {
    $imageDisplay = $companyArr['image_banner_url'];
    $bannerCss = 'banner-header-page-custom';
} elseif (!empty($companyArr['image_banner'])) {
    $companyPath = rtrim((string)($companyArr['path'] ?? ''), '/');
    $companyBanner = ltrim((string)$companyArr['image_banner'], '/');
    $imageDisplay = $companyPath !== '' ? $companyPath . '/' . $companyBanner : '/' . $companyBanner;
    $bannerCss = 'banner-header-page-custom';
}
$logoDisplay = \common\helpers\CompanyAuthImage::logo($companyArr);
$imageDisplay = \common\helpers\CompanyAuthImage::url($imageDisplay);
?>
<style>
    .company-auth-signup { --company-auth-brand: <?= Html::encode($brandColor) ?>; --company-auth-background: <?= $imageDisplay ? 'url("' . Html::encode($imageDisplay) . '")' : 'linear-gradient(#152025, #384145)' ?>; }
    .banner-header-page-custom {
        position: relative;
        height: auto;
        overflow: hidden;
        background: url(<?= Html::encode($imageDisplay) ?>) center / cover no-repeat;
        padding-top: 100px;
    }

    .banner-header-page-custom::before {
        content: "";
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.40);
        z-index: 0;
    }

    .form-login-page .btn-dark,
    .form-login-page .btn-primary {
        background-color: <?= Html::encode($brandColor) ?> !important;
        border-color: <?= Html::encode($brandColor) ?> !important;
        color: #fff !important;
    }

    .form-login-page a {
        color: <?= Html::encode($brandColor) ?>;
    }
    .signup-company-logo {
        display: block;
        border-radius: 999px;
        height: 110px;
        max-height: 110px;
        max-width: 110px;
        object-fit: contain;
        width: 110px;
    }
    .signup-company-logo-wrap {
        align-items: center;
        background: #fff;
        border: 1px solid rgba(15, 23, 42, .06);
        border-radius: 999px;
        box-shadow: 0 20px 48px rgba(15, 23, 42, .14);
        display: inline-flex;
        height: 154px;
        justify-content: center;
        margin: 0 auto;
        padding: .8rem;
        width: 154px;
    }
    .signup-company-logo-area {
        padding: 2.1rem 0 1.6rem;
        text-align: center;
    }
</style>

<section class="company-auth-desktop-header section section-concept section-no-border section-dark section-angled section-angled-reverse">
    <header id="header" class="header-transparent">
        <div class="header-body-page mt-3">
            <div class="header-top white-text d-block d-md-none d-none">
                <div class="container">
                    <?= $this->render('/site/top_header_specialcalendar_page', ['companyArr' => $companyArr]) ?>
                </div>
            </div>
            <?= $this->render('/site/headerSpecialCalendarPage', ['companyArr' => $companyArr]) ?>
        </div>
    </header>
</section>

<div role="main" class="main company-auth-mobile company-auth-signup <?= Html::encode($bannerCss) ?>">
    <div class="pagecode-auth-topbar company-auth-mobile-topbar">
        <select class="pagecode-auth-language" id="company-auth-language-mobile" aria-label="<?= Html::encode(Yii::t('legal', 'language')) ?>" onchange="changeSiteLanguage(this)" data-csrf="<?= Html::encode(Yii::$app->request->getCsrfToken()) ?>" data-url="<?= Html::encode(Url::base(true)) ?>" data-guid="">
            <?php foreach (Helpers::arrLanguagesClient() as $key => $language): ?>
                <option value="<?= Html::encode($key) ?>" <?= Yii::$app->language === $key ? 'selected' : '' ?>><?= Html::encode(strtoupper($key)) ?></option>
            <?php endforeach; ?>
        </select>
    </div>
    <div class="my-4 container-fluid container-lg pb-3">
        <div class="row justify-content-center pt-4 px-1">
            <div class="col-12 col-lg-9 form-login-page px-3 px-lg-5 pt-4">
                <div class="signup-company-logo-area">
                    <span class="signup-company-logo-wrap">
                        <?= Html::img($logoDisplay, [
                            'alt' => Html::encode($companyName),
                            'class' => 'img-fluid signup-company-logo',
                            'loading' => 'eager',
                            'onerror' => \common\helpers\CompanyAuthImage::logoFallbackScript(),
                        ]) ?>
                    </span>
                </div>
           

                <h2 class="font-weight-bold text-9 mb-0 pt-4">
                    <?= Html::encode($signupTitle) ?>
                </h2>
            
                <div class="separator"></div>

                <?php foreach (Yii::$app->session->getAllFlashes() as $type => $message): ?>
                    <div class="alert alert-<?= Html::encode($type === 'error' ? 'danger' : $type) ?>">
                        <?= Html::encode($message) ?>
                    </div>
                <?php endforeach; ?>

                <div class="pb-2 pt-2">
                   
                 <?php $form = ActiveForm::begin(['id' => 'form-signup', 'options' => ['enctype' => 'multipart/form-data','data-native-auth'=>'register','data-native-auth-logo'=>\common\helpers\CompanyBranding::mobileLogoUrl() ?: '', 'data-native-auth-messages'=>\yii\helpers\Json::encode(\common\helpers\NativeAuthPresentation::messages()), 'data-native-auth-color'=>$companyArr['color'] ?? '', 'data-native-auth-company'=>$companyArr['company_name'] ?? Yii::$app->name]]); ?> 
                                <?php if ($isHousekeepingSignup): ?>
                                    <?= Html::activeHiddenInput($model, 'gender', ['value' => $model->gender ?: 'men']) ?>
                                    <?= Html::activeHiddenInput($model, 'dob', ['value' => $model->dob ?: '1970-01-01']) ?>
                                    <?= Html::activeHiddenInput($model, 'nif', ['value' => $model->nif ?: '000000000']) ?>
                                <?php endif; ?>
                                <div class="row">
                                    <div class="col-12 pb-3">
                                        <h4 class="font-weight-bold pt-3 title-booking">                                       
                                            <?= Yii::t('app', "signup_block_dados") ?>                
                                        </h4>      
                                    </div>                                                  
                              
                                    <div class="form-grou col-lg-6">                              
                                        <?= $form->field($model, 'first_name')->textInput(['maxlength' => true, 'class' => 'form-control text-3 h-auto py-2'])->label(Yii::t('app', "signup_block_first_name").':') ?>                             
                                    </div>
                                    <div class="form-group  col-lg-6">
                                        <?= $form->field($model, 'last_name')->textInput(['maxlength' => true, 'class' => 'form-control text-3 h-auto py-2'])->label(Yii::t('app', "signup_block_last_name").':') ?>
                                    </div>                             
                                </div>                   
                                <?php if (!$isHousekeepingSignup): ?>
                                    <div class="row ">
                                        <div class="form-group col-lg-12 pt-2">
                                            <?= $form->field($model, 'gender')->dropdownList(
                                                Helpers::dropdownGender(),
                                                ['prompt'=> Yii::t('app', "select_gender"), 'class' => 'form-control text-3 h-auto py-2'])->label(Yii::t('app', "gender").':');
                                            ?>
                                        </div>

                                        <div class="form-group col-lg-12 pt-2">
                                            <?= $form->field($model, 'dob')->input('date', ['class' => 'form-control text-3 h-auto py-2'])->label(Yii::t('app', "dob").':') ?>
                                        </div>
                                    </div>
                                <?php endif; ?>
                                <div class="row ">  
                                    <?php if (!$isHousekeepingSignup): ?>
                                        <div class="form-group col-lg-12 pt-2">
                                            <?= $form->field($model, 'nif')->textInput(['maxlength' => true, 'class' => 'form-control text-3 h-auto py-2'])->label(Yii::t('app', "signup_block_nif").':') ?>
                                        </div>
                                    <?php endif; ?>
                                    <div class="form-group col-lg-12 pt-2">                        
                                        <?= $form->field($model, 'email')->textInput(['class' => 'form-control text-3 h-auto py-2', 'data-company-autofocus' => true])->label(Yii::t('app', "signup_block_email").':') ?>
                                    </div> 
                                                                      
                                </div>                  
                                <div class="row pt-2">  
                                    <div class="form-group col-lg-4 "> 
                                        <?= $form->field($model, 'contact_country_code')->dropdownList(
                                            Helpers::dropdownCountryCode(),
                                            [ 'class' => 'form-control text-3 h-auto py-2'])->label(Yii::t('app', "contact_country_code").':')
                                        ?>                              
                                    </div>
                                    <div class="form-group col-lg-8">          
                                        <?= $form->field($model, 'contact_number')->textInput(['maxlength' => true, 'class' => 'form-control text-3 h-auto py-2'])->label(Yii::t('app', "signup_block_contact_number").':') ?>                             
                                    </div>   
                                        
                                </div>

                                <div class="row pt-2">
                                    <div class="form-group col-12">
                                        <?= $form->field($model, 'location_code')->dropDownList(
                                            $locationOptions,
                                            [
                                                'prompt' => Yii::t('app', 'select_location_code'),
                                                'class' => 'form-control text-3 h-auto py-2',
                                                'required' => true,
                                            ]
                                        )->label(Yii::t('app', 'location_code') . ':') ?>
                                    </div>
                                </div>

                                <?php if (!$isGymSignup): ?>
                                    <div class="row pt-2">
                                        <div class="form-group col-12">
                                            <?= $form->field($model, 'proof_id_type')->radioList(
                                                [
                                                    'id_card' => Yii::$app->language === 'pt' ? 'Cartão de cidadão / ID' : 'ID card',
                                                    'passport' => Yii::$app->language === 'pt' ? 'Passaporte' : 'Passport',
                                                ],
                                                [
                                                    'class' => 'signup-proof-id-types d-flex flex-column flex-md-row gap-2',
                                                    'itemOptions' => ['class' => 'me-2'],
                                                ]
                                            )->label(Yii::$app->language === 'pt' ? 'Tipo de identificação:' : 'Identification type:') ?>
                                        </div>
                                        <div class="form-group col-12 col-lg-6 signup-proof-id-field signup-proof-id-front">
                                            <?= $form->field($model, 'proof_id_file')->fileInput([
                                                'class' => 'form-control text-3 h-auto py-2 js-proof-file',
                                                'accept' => '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp',
                                                'required' => true,
                                                'data-proof-data-target' => 'signup-proof-id-data',
                                                'data-proof-name-target' => 'signup-proof-id-name',
                                            ])->label(Yii::$app->language === 'pt' ? 'Frente do ID ou passaporte:' : 'ID front or passport:') ?>
                                            <?= Html::activeHiddenInput($model, 'proof_id_data', ['id' => 'signup-proof-id-data']) ?>
                                            <?= Html::activeHiddenInput($model, 'proof_id_name', ['id' => 'signup-proof-id-name']) ?>
                                        </div>
                                        <div class="form-group col-12 col-lg-6 signup-proof-id-field signup-proof-id-back">
                                            <?= $form->field($model, 'proof_id_back_file')->fileInput([
                                                'class' => 'form-control text-3 h-auto py-2 js-proof-file',
                                                'accept' => '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp',
                                                'required' => true,
                                                'data-proof-data-target' => 'signup-proof-id-back-data',
                                                'data-proof-name-target' => 'signup-proof-id-back-name',
                                            ])->label(Yii::$app->language === 'pt' ? 'Verso do ID:' : 'ID back:') ?>
                                            <?= Html::activeHiddenInput($model, 'proof_id_back_data', ['id' => 'signup-proof-id-back-data']) ?>
                                            <?= Html::activeHiddenInput($model, 'proof_id_back_name', ['id' => 'signup-proof-id-back-name']) ?>
                                        </div>
                                    </div>
                                <?php endif; ?>

                                <?php if (!$isGymSignup): ?>
                                    <div class="row pt-4">
                                        <div class="col-12">
                                            <h4 class="font-weight-bold pt-3 title-booking">
                                                <?= Html::encode(Yii::$app->language === 'pt' ? 'Dados bancários' : 'Bank details') ?>
                                            </h4>
                                        </div>
                                        <?= Html::activeHiddenInput($model, 'bank_country', [
                                            'id' => 'signup-bank-country',
                                            'value' => $visitorCountryCode ?: $model->bank_country,
                                        ]) ?>
                                        <div class="form-group col-12 pt-2">
                                            <?= $form->field($model, 'bank_method')->radioList(
                                                [
                                                    'iban' => Yii::$app->language === 'pt' ? 'IBAN' : 'IBAN',
                                                    'uk_bank' => Yii::$app->language === 'pt' ? 'Sort code e número de conta' : 'Sort code and account number',
                                                ],
                                                [
                                                    'class' => 'signup-bank-methods d-flex flex-column flex-md-row gap-2',
                                                    'itemOptions' => ['class' => 'me-2'],
                                                ]
                                            )->label(Yii::$app->language === 'pt' ? 'Tipo de conta:' : 'Account type:') ?>
                                        </div>
                                        <div class="form-group col-12 pt-2 signup-bank-field signup-bank-iban">
                                            <?= $form->field($model, 'iban')->textInput([
                                                'maxlength' => 34,
                                                'class' => 'form-control text-3 h-auto py-2',
                                                'autocomplete' => 'off',
                                                'pattern' => '[A-Za-z]{2}[0-9A-Za-z ]{13,32}',
                                                'title' => Yii::$app->language === 'pt' ? 'Insira um IBAN válido.' : 'Enter a valid IBAN.',
                                                'required' => $bankMethod === 'iban',
                                            ])->label('IBAN:') ?>
                                        </div>
                                        <div class="form-group col-lg-6 pt-2 signup-bank-field signup-bank-uk">
                                            <?= $form->field($model, 'sort_code')->textInput([
                                                'maxlength' => 8,
                                                'class' => 'form-control text-3 h-auto py-2',
                                                'placeholder' => '00-00-00',
                                                'autocomplete' => 'off',
                                                'pattern' => '\\d{2}-?\\d{2}-?\\d{2}',
                                                'title' => Yii::$app->language === 'pt' ? 'Insira o sort code no formato 00-00-00 ou 000000.' : 'Enter the sort code as 00-00-00 or 000000.',
                                                'required' => $bankMethod === 'uk_bank',
                                            ])->label(Yii::$app->language === 'pt' ? 'Sort code:' : 'Sort code:') ?>
                                        </div>
                                        <div class="form-group col-lg-6 pt-2 signup-bank-field signup-bank-uk">
                                            <?= $form->field($model, 'account_number')->textInput([
                                                'maxlength' => 8,
                                                'class' => 'form-control text-3 h-auto py-2',
                                                'placeholder' => '00000000',
                                                'autocomplete' => 'off',
                                                'pattern' => '\\d{8}',
                                                'title' => Yii::$app->language === 'pt' ? 'Insira um número de conta com 8 dígitos.' : 'Enter an 8 digit account number.',
                                                'required' => $bankMethod === 'uk_bank',
                                            ])->label(Yii::$app->language === 'pt' ? 'Número de conta:' : 'Account number:') ?>
                                        </div>
                                        <div class="form-group col-12 pt-2">
                                            <?= $form->field($model, 'bank_proof_file')->fileInput([
                                                'class' => 'form-control text-3 h-auto py-2 js-proof-file',
                                                'accept' => '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp',
                                                'required' => true,
                                                'data-proof-data-target' => 'signup-bank-proof-data',
                                                'data-proof-name-target' => 'signup-bank-proof-name',
                                            ])->label(Yii::$app->language === 'pt' ? 'Comprovativo do IBAN / sort code:' : 'IBAN / sort code proof:') ?>
                                            <?= Html::activeHiddenInput($model, 'bank_proof_data', ['id' => 'signup-bank-proof-data']) ?>
                                            <?= Html::activeHiddenInput($model, 'bank_proof_name', ['id' => 'signup-bank-proof-name']) ?>
                                        </div>
                                    </div>
                                <?php endif; ?>
                              
                                           
                                <div class="row">
                                    <div class="col-12 pt-5">
                                        <h4 class="font-weight-bold pt-3 title-booking">                                       
                                            <?= Yii::t('app', "login_data") ?>                
                                        </h4>      
                                    </div>                               
                                    <div class="form-group col-12 pt-2">
                                        <?= $form->field($model, 'username')->textInput(['class' => 'form-control form-control-lg text-4', 'data-company-autofocus' => true])->label(Yii::t('app', "signup_block_username").':')?>
                                    </div>
                                </div>
                                <div class="row pb-4">
                                    <div class="form-group col-12 pt-2"> 
                                        <?= $form->field($model, 'password')->passwordInput(['autocomplete' =>'new-password','id' => 'password-input','class' => 'form-control form-control-lg text-4'])->label(Yii::t('app', "signup_block_password").':')?>
                                    </div>
                                    <div class="pt-3">
                                        <label class="company-auth-checkbox"><input type="checkbox" onclick="viewInputPassword(this)" aria-controls="password-input"> <?= Yii::t('app', 'show_password') ?></label>
                                    </div>                            
                                </div>

                                <div class="row pb-4">
                                    <div class="form-group col-12">
                                        <?= $form->field($model, 'terms_and_conditions')->checkBox([
                                            'required' => true,
                                            'label' => Yii::t('app', 'signup_block_validation_terms') . ' '
                                                . '<a href="' . Html::encode(Url::to(['/terms-and-conditions', 'pagecode' => $pagecode])) . '" class="text-decoration-none">' . Yii::t('app', 'menu_terms') . '</a>'
                                                . ' ' . Yii::t('app', 'and') . ' '
                                                . '<a href="' . Html::encode(Url::to(['/privacy-policy', 'pagecode' => $pagecode])) . '" class="text-decoration-none">' . Yii::t('app', 'privacy_policy') . '</a>',
                                        ]) ?>
                                    </div>
                                </div>
                            
                                <div class="row ">
                                    <div class="form-group col">
                                        <button type="submit" class="btn btn-dark w-100 py-2" data-loading-text="Loading...">
                                            <?= Yii::t('app', "signup_block_register") ?>
                                        </button>
                                    </div>
                                </div>

                                <div class="row justify-content-between pt-2">
                                    <div class="col-7 text-1">
                                        <?= Yii::t('app', "login_question") ?>
                                        <?= Html::a(Yii::t('app', "login"), $loginUrl, ['class' => 'text-decoration-none']) ?>
                                    </div>
                                    <div class="col-5 text-right text-1">
                                        <?= Html::a(
                                            Yii::t('app', 'login_block_forgot_password_2'),
                                            $passwordResetUrl,
                                            [
                                                'class' => 'text-decoration-none text-color-dark text-color-hover-primary font-weight-semibold text-2',
                                                'data-hash' => '',
                                                'data-hash-offset' => 0,
                                                'data-hash-offset-lg' => 130,
                                            ]
                                        ) ?>
                                    </div>
                                </div>
                            <?php ActiveForm::end(); ?>
                    <div class="company-auth-mobile-footer"><?= $this->render('/client/login/_legal-links', ['pagecode' => $pagecode]) ?></div>
                </div>
            </div>
        </div>
        </div>
    <div class="vector vector-1-dark"></div>
    <div class="vector vector-2-dark"></div>
    <div class="vector vector-3-dark"></div>
</div>

<div class="company-auth-desktop-footer"><?= $this->render('/site/footer-page', ['companyArr' => $companyArr]) ?></div>

<script>
    (function () {
        document.querySelectorAll('a[target]').forEach(function (link) {
            link.removeAttribute('target');
        });

        document.addEventListener('click', function (event) {
            var link = event.target.closest && event.target.closest('a[href]');
            if (!link) {
                return;
            }

            link.removeAttribute('target');
            var url = new URL(link.href, window.location.href);
            if (url.origin !== window.location.origin) {
                event.preventDefault();
            }
        }, true);
    })();

    function cleanupSignupBodyState() {
        document.body.classList.remove('modal-open', 'loading-overlay-showing', 'show');
        document.body.style.removeProperty('display');
        document.body.style.removeProperty('padding-right');
    }

    cleanupSignupBodyState();
    window.addEventListener('load', cleanupSignupBodyState);

    const signupPassword = document.getElementById('signupPassword');
    const showSignupPassword = document.getElementById('showSignupPassword');

    if (signupPassword && showSignupPassword) {
        showSignupPassword.addEventListener('change', () => {
        signupPassword.type = showSignupPassword.checked ? 'text' : 'password';
        });
    }

    const contactCountry = document.getElementById('formsignupclientform-contact_country_code');
    const bankCountry = document.getElementById('signup-bank-country');
    const bankMethodInputs = document.querySelectorAll('input[name="FormSignupClientForm[bank_method]"]');
    const ibanFields = document.querySelectorAll('.signup-bank-iban');
    const ukFields = document.querySelectorAll('.signup-bank-uk');
    const ibanInput = document.getElementById('formsignupclientform-iban');
    const sortCodeInput = document.getElementById('formsignupclientform-sort_code');
    const accountNumberInput = document.getElementById('formsignupclientform-account_number');
    const proofInputs = document.querySelectorAll('.js-proof-file');
    const proofTypeInputs = document.querySelectorAll('input[name="FormSignupClientForm[proof_id_type]"]');
    const proofIdFrontInput = document.getElementById('formsignupclientform-proof_id_file');
    const proofIdBackInput = document.getElementById('formsignupclientform-proof_id_back_file');
    const proofIdBackFields = document.querySelectorAll('.signup-proof-id-back');

    function selectedBankMethod() {
        const selected = document.querySelector('input[name="FormSignupClientForm[bank_method]"]:checked');
        return selected ? selected.value : 'uk_bank';
    }

    function normalizedContactCountryCode() {
        return contactCountry ? contactCountry.value.replace(/\D/g, '').replace(/^0+/, '') : '';
    }

    function browserLooksUk() {
        const languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
        return languages.some((language) => /^en-(gb|uk)$/i.test(String(language)));
    }

    function setBankMethod(method) {
        bankMethodInputs.forEach((input) => {
            input.checked = input.value === method;
        });
        toggleBankFields();
    }

    function toggleBankFields() {
        const method = selectedBankMethod();
        const isIban = method === 'iban';
        const isUkBank = method === 'uk_bank';

        ibanFields.forEach((field) => {
            field.style.display = isIban ? '' : 'none';
        });
        ukFields.forEach((field) => {
            field.style.display = isUkBank ? '' : 'none';
        });

        if (ibanInput) {
            ibanInput.required = isIban;
            ibanInput.setAttribute('aria-required', isIban ? 'true' : 'false');
        }
        if (sortCodeInput) {
            sortCodeInput.required = isUkBank;
            sortCodeInput.setAttribute('aria-required', isUkBank ? 'true' : 'false');
        }
        if (accountNumberInput) {
            accountNumberInput.required = isUkBank;
            accountNumberInput.setAttribute('aria-required', isUkBank ? 'true' : 'false');
        }
    }

    function formatSortCodeValue(value) {
        const digits = String(value || '').replace(/\D/g, '').slice(0, 6);
        const parts = [];

        for (let index = 0; index < digits.length; index += 2) {
            parts.push(digits.slice(index, index + 2));
        }

        return parts.join('-');
    }

    function formatSortCodeInput() {
        if (!sortCodeInput) {
            return;
        }

        sortCodeInput.value = formatSortCodeValue(sortCodeInput.value);
    }

    function selectedProofIdType() {
        const selected = document.querySelector('input[name="FormSignupClientForm[proof_id_type]"]:checked');
        return selected ? selected.value : 'id_card';
    }

    function toggleProofIdFields() {
        const isIdCard = selectedProofIdType() === 'id_card';

        proofIdBackFields.forEach((field) => {
            field.style.display = isIdCard ? '' : 'none';
        });

        if (proofIdFrontInput) {
            proofIdFrontInput.required = true;
            proofIdFrontInput.setAttribute('aria-required', 'true');
        }

        if (proofIdBackInput) {
            proofIdBackInput.required = isIdCard;
            proofIdBackInput.setAttribute('aria-required', isIdCard ? 'true' : 'false');
            if (!isIdCard) {
                proofIdBackInput.value = '';
                const dataInput = document.getElementById(proofIdBackInput.dataset.proofDataTarget || '');
                const nameInput = document.getElementById(proofIdBackInput.dataset.proofNameTarget || '');
                if (dataInput) {
                    dataInput.value = '';
                }
                if (nameInput) {
                    nameInput.value = '';
                }
            }
        }
    }

    if (contactCountry) {
        contactCountry.addEventListener('change', () => {
            const countryCode = normalizedContactCountryCode();
            if (bankCountry) {
                bankCountry.value = countryCode === '44' ? 'GB' : (countryCode === '351' ? 'PT' : bankCountry.value);
            }
            if (countryCode === '44') {
                setBankMethod('uk_bank');
            } else if (countryCode === '351') {
                setBankMethod('iban');
            }
        });
    }

    if (bankCountry && ['GB', 'UK'].includes(String(bankCountry.value).toUpperCase())) {
        setBankMethod('uk_bank');
    } else if (normalizedContactCountryCode() === '44') {
        setBankMethod('uk_bank');
    } else if (normalizedContactCountryCode() !== '351' && browserLooksUk()) {
        if (contactCountry) {
            contactCountry.value = '0044';
        }
        if (bankCountry) {
            bankCountry.value = 'GB';
        }
        setBankMethod('uk_bank');
    }

    bankMethodInputs.forEach((input) => input.addEventListener('change', toggleBankFields));
    toggleBankFields();
    if (sortCodeInput) {
        sortCodeInput.addEventListener('input', formatSortCodeInput);
        sortCodeInput.addEventListener('blur', formatSortCodeInput);
        formatSortCodeInput();
    }
    proofTypeInputs.forEach((input) => input.addEventListener('change', toggleProofIdFields));
    toggleProofIdFields();

    function readProofFallback(input, callback) {
        const dataInput = document.getElementById(input.dataset.proofDataTarget || '');
        const nameInput = document.getElementById(input.dataset.proofNameTarget || '');
        const file = input.files && input.files[0] ? input.files[0] : null;

        if (!dataInput || !nameInput) {
            if (callback) {
                callback();
            }
            return;
        }

        dataInput.value = '';
        nameInput.value = '';

        if (!file) {
            if (callback) {
                callback();
            }
            return;
        }

        nameInput.value = file.name;

        const reader = new FileReader();
        reader.onload = () => {
            dataInput.value = String(reader.result || '');
            if (callback) {
                callback();
            }
        };
        reader.readAsDataURL(file);
    }

    proofInputs.forEach((input) => {
        input.addEventListener('change', () => readProofFallback(input));
    });

    const signupForm = document.getElementById('form-signup');
    if (signupForm && proofInputs.length) {
        signupForm.addEventListener('submit', (event) => {
            const pendingInputs = Array.from(proofInputs).filter((input) => {
                const dataInput = document.getElementById(input.dataset.proofDataTarget || '');
                const file = input.files && input.files[0] ? input.files[0] : null;
                return file && dataInput && !dataInput.value;
            });

            if (!pendingInputs.length) {
                return;
            }

            event.preventDefault();

            let remaining = pendingInputs.length;
            pendingInputs.forEach((input) => {
                readProofFallback(input, () => {
                    remaining -= 1;
                    if (remaining === 0) {
                        signupForm.submit();
                    }
                });
            });
        });
    }
</script>
