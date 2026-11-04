<?php

/* @var $this yii\web\View */
/* @var $form yii\bootstrap4\ActiveForm */
/* @var $model \frontend\models\PasswordResetRequestForm */

use yii\bootstrap4\Html;
use yii\bootstrap4\ActiveForm;
use common\helpers\Helpers;
use yii\helpers\Url;

$this->title = 'Request password reset';
$this->params['companyAuthPage'] = true;
$this->params['disableLoadingOverlay'] = true;
$this->params['breadcrumbs'][] = $this->title;

$path2 = 'reset_token';

$companyArr2 = $companyArr ?? Helpers::myCompanyArr();
$code = Helpers::findCompanyCode();
$pagecode = $pagecode ?? Yii::$app->request->get('pagecode');
$loginUrl = empty($pagecode) ? Url::toRoute('site/login') : Url::to(['/site/login', 'pagecode' => $pagecode]);
$brandColor = preg_match('/^#[0-9a-fA-F]{6}$/', (string)($companyArr2['color'] ?? ''))
    ? $companyArr2['color']
    : '#2563eb';
$bannerImage = '';
if (!empty($companyArr2['image_banner_url'])) {
    $bannerImage = $companyArr2['image_banner_url'];
} elseif (!empty($companyArr2['image_banner'])) {
    $companyPath = rtrim((string)($companyArr2['path'] ?? ''), '/');
    $companyBanner = ltrim((string)$companyArr2['image_banner'], '/');
    $bannerImage = $companyPath !== '' ? $companyPath . '/' . $companyBanner : '/' . $companyBanner;
}

$bannerImage = \common\helpers\CompanyAuthImage::url($bannerImage);
?>

<style>
    html,
    body {
        height: 100%;
        margin: 0;
    }
    #footer,
    .scroll-to-top,
    .footer,
    .footer-copyright,
    .body > footer {
        display: none !important;
    }
    .body,
    .main:not(.pagecode-auth-page),
    .main-content,
    .content,
    .content-page,
    .wrapper {
        margin: 0 !important;
        min-height: 0 !important;
        padding: 0 !important;
    }
    .pagecode-auth-page {
        --company-auth-brand: <?= Html::encode($brandColor) ?>;
        --company-auth-background: <?= $bannerImage ? 'url("' . Html::encode($bannerImage) . '")' : 'linear-gradient(#152025, #384145)' ?>;
        align-items: center;
        background: <?= $bannerImage ? 'linear-gradient(115deg, rgba(6, 18, 23, .78), rgba(6, 18, 23, .36)), url("' . Html::encode($bannerImage) . '") center / cover no-repeat' : 'linear-gradient(135deg, #152025 0%, #384145 48%, #111827 100%)' ?>;
        box-sizing: border-box;
        display: grid;
        min-height: 100dvh;
        padding: clamp(7.25rem, 16vh, 9.5rem) clamp(1rem, 4vh, 2.5rem) clamp(1rem, 4vh, 2.5rem);
        position: relative;
        width: 100%;
        z-index: 10000;
    }
    .pagecode-auth-page::before {
        background: radial-gradient(circle at 78% 20%, rgba(255,255,255,.22), transparent 28%),
            linear-gradient(90deg, rgba(0,0,0,.24), transparent 54%);
        content: "";
        inset: 0;
        pointer-events: none;
        position: absolute;
    }
    .pagecode-auth-shell {
        margin: 0 auto;
        max-width: 1120px;
        position: relative;
        width: 100%;
        z-index: 1;
    }
    .pagecode-auth-topbar {
        align-items: center;
        display: flex;
        justify-content: space-between;
        left: 0;
        padding: clamp(1.1rem, 3vw, 2rem) clamp(1.25rem, 5vw, 4rem);
        pointer-events: none;
        position: absolute;
        right: 0;
        top: 0;
        z-index: 2;
    }
    .pagecode-auth-topbar-logo {
        align-items: center;
        background: rgba(255,255,255,.95);
        border: 1px solid rgba(255,255,255,.5);
        border-radius: 999px;
        box-shadow: 0 14px 32px rgba(0,0,0,.24);
        display: inline-flex;
        height: clamp(72px, 8vw, 102px);
        justify-content: center;
        padding: .35rem;
        pointer-events: auto;
        width: clamp(72px, 8vw, 102px);
    }
    .pagecode-auth-topbar-logo img {
        border-radius: 999px;
        height: 100%;
        object-fit: contain;
        width: 100%;
    }
    .pagecode-auth-language {
        background: transparent;
        border: 0;
        color: #050505;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 900;
        min-height: 38px;
        padding: .35rem 1.55rem .35rem .55rem;
        pointer-events: auto;
        text-transform: uppercase;
    }
    .pagecode-auth-language:focus {
        box-shadow: none;
        outline: 2px solid rgba(255,255,255,.6);
        outline-offset: 3px;
    }
    .pagecode-auth-card {
        box-sizing: border-box;
        background: rgba(255,255,255,.96);
        border: 1px solid rgba(255,255,255,.62);
        border-radius: 28px;
        box-shadow: 0 28px 80px rgba(0,0,0,.32);
        margin: 0 auto;
        max-width: 560px;
        padding: clamp(1.35rem, 4vh, 2.65rem);
        scrollbar-width: thin;
        width: 100%;
    }
    .pagecode-auth-brand {
        align-items: center;
        display: flex;
        justify-content: center;
        margin-bottom: clamp(1.1rem, 3vh, 1.8rem);
    }
    .pagecode-auth-logo-frame {
        align-items: center;
        background: #fff;
        border: 1px solid rgba(15,23,42,.08);
        border-radius: 999px;
        box-shadow: 0 14px 34px rgba(15,23,42,.12);
        display: inline-flex;
        height: clamp(116px, 18vh, 168px);
        justify-content: center;
        padding: .7rem;
        width: clamp(116px, 18vh, 168px);
    }
    .form-login .btn-dark,
    .form-login .btn-primary {
        background-color: <?= Html::encode($brandColor) ?> !important;
        border-color: <?= Html::encode($brandColor) ?> !important;
        color: #fff !important;
    }

    .form-login a {
        color: <?= Html::encode($brandColor) ?>;
    }
    .form-login label {
        color: #334155;
        font-size: .92rem;
        font-weight: 800;
        margin-bottom: .38rem;
    }
    .form-login .form-control {
        border: 1px solid #d8dee8;
        border-radius: 14px;
        box-shadow: none;
        font-size: 1rem !important;
        min-height: 54px;
        padding: .75rem .95rem;
    }
    .form-login .form-control:focus {
        border-color: <?= Html::encode($brandColor) ?>;
        box-shadow: 0 0 0 .18rem rgba(14, 133, 67, .14);
    }
    .pagecode-auth-submit {
        border-radius: 14px;
        font-weight: 850;
        min-height: 48px;
    }
    .pagecode-login-logo {
        max-height: 100%;
        max-width: 100%;
        object-fit: contain;
    }
    @media (max-width: 575.98px) {
        .pagecode-auth-page {
            padding: 6.25rem .85rem .85rem;
        }
        .pagecode-auth-card {
            border-radius: 22px;
            padding: 1.15rem;
            width: 100%;
        }
    }
</style>

<?php
$logoDisplay = \common\helpers\CompanyAuthImage::logo($companyArr2);
$activeLanguagesArr = Helpers::arrLanguagesClient();
?>

<div role="main" class="main pagecode-auth-page company-auth-mobile">
    <div class="pagecode-auth-topbar">
        <a class="pagecode-auth-topbar-logo" href="<?= Html::encode($loginUrl) ?>" aria-label="<?= Html::encode($companyArr2['company_name'] ?? Yii::$app->name) ?>">
            <?= Html::img($logoDisplay, [
                'onerror' => \common\helpers\CompanyAuthImage::logoFallbackScript(),
                'alt' => Html::encode($companyArr2['company_name'] ?? 'logo'),
            ]) ?>
        </a>
        <select class="pagecode-auth-language" id="language" aria-label="<?= Html::encode(Yii::t('legal', 'language')) ?>" onChange="changeSiteLanguage(this)" data-csrf="<?= Html::encode(Yii::$app->request->getCsrfToken()) ?>" data-url="<?= Html::encode(Url::base(true)) ?>" data-guid="<?= Html::encode(isset(Yii::$app->user->identity->guid) ? Yii::$app->user->identity->guid : '') ?>">
            <?php foreach ($activeLanguagesArr as $key => $language): ?>
                <option value="<?= Html::encode($key) ?>" <?= Yii::$app->language == $key ? 'selected' : '' ?>>
                    <?= Html::encode(strtoupper($key)) ?>
                </option>
            <?php endforeach; ?>
        </select>
    </div>
    <div class="pagecode-auth-shell">
        <div class="form-login pagecode-auth-card">
            <div class="pagecode-auth-brand">
                <div class="pagecode-auth-logo-frame">
                    <?= Html::img($logoDisplay, [
                        'alt' => Html::encode($companyArr2['company_name'] ?? 'logo'),
                        'class' => 'img-fluid logo-specialcalendar-mobile pagecode-login-logo',
                        'loading' => 'eager',
                        'onerror' => \common\helpers\CompanyAuthImage::logoFallbackScript(),
                    ]) ?>
                </div>
            </div>
            <h2 class="font-weight-bold text-5 mb-2">
                <?= Yii::t('app', "login_block_forgot_password_2") ?>
            </h2>
            <p class="text-2 text-color-grey mb-4">
                <?= Yii::t('app', "resend_request_password_reset_email_title") ?>
            </p>
            <?php $form = ActiveForm::begin(['id' => 'request-password-reset-form','options'=>['data-native-auth'=>'forgot','data-native-auth-logo'=>\common\helpers\CompanyBranding::mobileLogoUrl() ?: '', 'data-native-auth-messages'=>\yii\helpers\Json::encode(\common\helpers\NativeAuthPresentation::messages()), 'data-native-auth-color'=>$companyArr['color'] ?? '', 'data-native-auth-company'=>$companyArr['company_name'] ?? Yii::$app->name]]); ?>

            <?= $form->field($model, 'email')->textInput(['class'=> 'form-control form-control-lg text-4','data-company-autofocus' => true, 'autocomplete' => 'email', 'inputmode' => 'email'])->label(Yii::t('app','email')) ?>

                    <?php if (Yii::$app->session->hasFlash('success')): ?>                   
                        <div class="alert alert-success alert-dismissible rounded-4 mt-3" role="alert">
                            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>                        
                            <?= Yii::t('app','resend_request_password_reset_email_success_message') ?>
                        </div>
                    <?php endif; ?>
                    <?php if (Yii::$app->session->hasFlash('error')): ?>
                        <div class="alert alert-danger alert-dismissible rounded-4 mt-3" role="alert">
                            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                            <?= Yii::$app->session->getFlash('error') ?>
                        </div>
                    <?php endif; ?>

            <div>
                <?= Html::submitButton(Yii::t('app','submit_button'), ['class' => 'btn btn-dark w-100 py-2 pagecode-auth-submit', 'name' => 'login-button']) ?>
            </div>

            <?php ActiveForm::end(); ?>
            <div class="text-center pt-3">
                <?= Html::a(Yii::t('app', 'login_question'), $loginUrl, ['class' => 'text-decoration-none text-color-dark text-color-hover-primary font-weight-semibold text-2']) ?>
            </div>
            <?= $this->render('_legal-links', ['pagecode' => $pagecode]) ?>
        </div>
    </div>
</div>

<script>
    (function () {
        window.scrollTo(0, 0);

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
</script>
