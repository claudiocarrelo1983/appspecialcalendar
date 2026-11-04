<?php

/* @var $this yii\web\View */
/* @var $form yii\bootstrap4\ActiveForm */
/* @var $model \common\models\LoginForm */

use yii\bootstrap4\Html;
use yii\bootstrap4\ActiveForm;
use yii\helpers\Url;
use common\helpers\Helpers;



$this->title = 'Login';
$this->params['companyAuthPage'] = true;
$this->params['disableLoadingOverlay'] = true;
$this->params['breadcrumbs'][] = $this->title;

$path2 = 'login';
$signupPagecode = $pagecode ?? $company ?? Yii::$app->request->get('pagecode');
$signupRoute = empty($signupPagecode) ? ['site/signup-client'] : ['/form-signup/index', 'pagecode' => $signupPagecode];
$passwordResetRoute = empty($signupPagecode) ? ['/request-password-reset'] : ['/site/request-password-reset', 'pagecode' => $signupPagecode];
$brandColor = preg_match('/^#[0-9a-fA-F]{6}$/', (string)($companyArr['color'] ?? ''))
    ? $companyArr['color']
    : '#2563eb';
$bannerImage = '';
if (!empty($companyArr['image_banner_url'])) {
    $bannerImage = $companyArr['image_banner_url'];
} elseif (!empty($companyArr['image_banner'])) {
    $companyPath = rtrim((string)($companyArr['path'] ?? ''), '/');
    $companyBanner = ltrim((string)$companyArr['image_banner'], '/');
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
    .main:not(.pagecode-login-page),
    .main-content,
    .content,
    .content-page,
    .wrapper {
        margin: 0 !important;
        min-height: 0 !important;
        padding: 0 !important;
    }
    .pagecode-login-page {
        --company-auth-brand: <?= Html::encode($brandColor) ?>;
        --company-auth-background: <?= $bannerImage ? 'url("' . Html::encode($bannerImage) . '")' : 'linear-gradient(#152025, #384145)' ?>;
        align-items: center;
        background: <?= $bannerImage ? 'linear-gradient(115deg, rgba(6, 18, 23, .78), rgba(6, 18, 23, .36)), url("' . Html::encode($bannerImage) . '") center / cover no-repeat' : 'linear-gradient(135deg, #152025 0%, #384145 48%, #111827 100%)' ?>;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: clamp(1rem, 3vh, 2rem);
        min-height: 100dvh;
        padding: clamp(1rem, 3vh, 2rem) clamp(1rem, 4vw, 2.5rem);
        position: relative;
        width: 100%;
        z-index: 10000;
    }
    .pagecode-login-page::before {
        background: radial-gradient(circle at 78% 20%, rgba(255,255,255,.22), transparent 28%),
            linear-gradient(90deg, rgba(0,0,0,.24), transparent 54%);
        content: "";
        inset: 0;
        pointer-events: none;
        position: absolute;
    }
    .pagecode-login-shell {
        margin: auto;
        max-width: 1120px;
        position: relative;
        width: 100%;
        z-index: 1;
    }
    .pagecode-auth-topbar {
        align-items: center;
        display: flex;
        justify-content: space-between;
        flex-shrink: 0;
        gap: 1rem;
        margin: 0 auto;
        max-width: 1120px;
        width: 100%;
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
        min-height: 44px;
        padding: .55rem 1.8rem .55rem .8rem;
        pointer-events: auto;
        text-transform: uppercase;
    }
    .pagecode-auth-language:focus {
        box-shadow: none;
        outline: 2px solid rgba(255,255,255,.6);
        outline-offset: 3px;
    }
    .pagecode-login-card {
        background: rgba(255,255,255,.96);
        border: 1px solid rgba(255,255,255,.62);
        border-radius: 28px;
        box-shadow: 0 28px 80px rgba(0,0,0,.32);
        margin: 0 auto;
        box-sizing: border-box;
        max-width: 560px;
        padding: clamp(1.35rem, 4vh, 2.65rem);
        scrollbar-width: thin;
        width: 100%;
    }
    .pagecode-login-brand {
        align-items: center;
        display: flex;
        flex-direction: column;
        gap: .85rem;
        margin-bottom: clamp(1.1rem, 3vh, 1.8rem);
        text-align: center;
    }
    .pagecode-login-logo-frame {
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
    .form-login .form-group {
        margin-bottom: .9rem;
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
    .form-login .invalid-feedback {
        font-weight: 700;
        margin-top: .35rem;
    }
    .login-show-password {
        align-items: center;
        color: #0f172a;
        display: inline-flex;
        font-size: .92rem;
        font-weight: 700;
        gap: .45rem;
        margin: .1rem 0 1rem;
    }
    .login-show-password input {
        height: 16px;
        width: 16px;
    }
    .pagecode-login-submit {
        border-radius: 14px;
        font-weight: 850;
        min-height: 48px;
    }
    .pagecode-login-logo {
        max-height: 100%;
        max-width: 100%;
        object-fit: contain;
    }
    .login-card-links {
        align-items: center;
        display: flex;
        flex-wrap: nowrap;
        gap: .75rem;
        justify-content: space-between;
        margin-top: 1rem;
    }
    .login-card-links > div {
        flex: 0 1 auto;
        font-size: clamp(.78rem, 1.2vw, .9rem);
        font-weight: 700;
        line-height: 1.25;
        min-width: 0;
        white-space: nowrap;
    }
    .login-card-links a {
        font-weight: 850;
        text-decoration: none;
    }
    .login-card-links a:hover {
        text-decoration: underline;
    }
    @media (max-width: 575.98px) {
        .pagecode-login-page {
            padding: 1rem .85rem;
        }
        .pagecode-auth-topbar-logo {
            height: 56px;
            width: 56px;
        }
        .pagecode-login-card {
            border-radius: 22px;
            padding: 1.15rem;
        }
        .pagecode-login-logo-frame {
            height: 116px;
            width: 116px;
        }
        .login-card-links {
            align-items: stretch;
            flex-direction: column;
            gap: .45rem;
            text-align: center;
        }
        .login-card-links > div {
            white-space: normal;
        }
    }
    @media (max-height: 760px) and (min-width: 576px) {
        .pagecode-login-card {
            padding-bottom: 1.35rem;
            padding-top: 1.35rem;
        }
        .pagecode-login-brand {
            margin-bottom: .9rem;
        }
        .form-login .form-control {
            min-height: 48px;
        }
    }
</style>

<?php
$logoDisplay = \common\helpers\CompanyAuthImage::logo($companyArr);
$activeLanguagesArr = Helpers::arrLanguagesClient();
?>

<div role="main" class="main pagecode-login-page company-auth-mobile">
    <div class="pagecode-auth-topbar">
        <a class="pagecode-auth-topbar-logo" href="<?= Html::encode(Url::to(['/site/login', 'pagecode' => $signupPagecode])) ?>" aria-label="<?= Html::encode($companyArr['company_name'] ?? Yii::$app->name) ?>">
            <?= Html::img($logoDisplay, [
                'onerror' => \common\helpers\CompanyAuthImage::logoFallbackScript(),
                'alt' => Html::encode($companyArr['company_name'] ?? 'logo'),
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
    <div class="pagecode-login-shell">
        <div class="form-login pagecode-login-card">
            <div class="pagecode-login-brand">
                <div class="pagecode-login-logo-frame">
                    <?= Html::img($logoDisplay, [
                        'alt' => Html::encode($companyArr['company_name'] ?? 'logo'),
                        'class' => 'img-fluid logo-specialcalendar-mobile pagecode-login-logo',
                        'loading' => 'eager',
                        'onerror' => \common\helpers\CompanyAuthImage::logoFallbackScript(),
                    ]) ?>
                </div>
            </div>
            <?php $form = ActiveForm::begin(['id' => 'login-form','options'=>['data-native-auth'=>'login','data-native-auth-logo'=>\common\helpers\CompanyBranding::mobileLogoUrl() ?: '', 'data-native-auth-messages'=>\yii\helpers\Json::encode(\common\helpers\NativeAuthPresentation::messages()), 'data-native-auth-color'=>$companyArr['color'] ?? '', 'data-native-auth-company'=>$companyArr['company_name'] ?? Yii::$app->name]]); ?>
                <?= $form->field($model, 'username')->textInput([
                    'class' => 'form-control form-control-lg text-4',
                    'data-company-autofocus' => true,
                    'autocomplete' => 'username',
                ])->label(Yii::t('app', "login_label_username_2"))?>

                <?= $form->field($model, 'password', ['template' => '{label}<div class="company-auth-password">{input}' . $this->render('_password-toggle') . '</div>{error}{hint}'])->passwordInput([
                    'class' => 'form-control form-control-lg text-4',
                    'id' => 'password-input',
                    'autocomplete' => 'current-password',
                ])->label(Yii::t('app', "login_label_password_2"))?>

                <div>
                    <?= Html::submitButton(Yii::t('app', "login_button_2"), [
                        'class' => 'btn btn-dark w-100 py-2 pagecode-login-submit',
                        'name' => 'login-button',
                    ]) ?>
                </div>
            <?php ActiveForm::end(); ?>

            <div class="login-card-links">
                <div>
                    <?= Yii::t('app', 'login_block_dont_have_account_question') ?>
                    <?= Html::a(Yii::t('app', 'register'), $signupRoute) ?>
                </div>
                <div class="text-right">
                    <?= Html::a(
                        Yii::t('app', 'login_block_forgot_password_2'),
                        $passwordResetRoute,
                        [
                            'class' => 'text-decoration-none text-color-dark text-color-hover-primary font-weight-semibold text-2',
                            'data-hash' => '',
                            'data-hash-offset' => 0,
                            'data-hash-offset-lg' => 130,
                        ]
                    ) ?>
                </div>
            </div>
            <?= $this->render('_legal-links', ['pagecode' => $signupPagecode]) ?>
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
