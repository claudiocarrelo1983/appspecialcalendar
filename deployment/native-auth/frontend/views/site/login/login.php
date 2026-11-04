<?php
use yii\bootstrap4\Html;
use yii\bootstrap4\ActiveForm;

/** @var yii\web\View $this */
/** @var common\models\LoginForm $model */
$this->title = Yii::t('app', 'login');
$this->params['breadcrumbs'][] = $this->title;
$this->registerCss(<<<CSS
.public-login-page.banner-header { height: auto; min-height: 750px; padding: 150px 16px 96px; overflow: hidden; }
.public-login-page > .container { position: relative; z-index: 1; }
.public-login-page .vector { pointer-events: none; }
.public-login-card { width: 100%; max-width: 460px; margin: 0 auto; padding: 36px; background: #fff; border-radius: 24px; box-shadow: 0 12px 36px rgba(15,23,42,.08); }
.public-login-card h1 { margin: 0 0 12px; font-size: 2rem; font-weight: 700; line-height: 1.2; }
.public-login-intro { margin: 0 0 24px; color: #64748b; line-height: 1.6; }
.public-login-card .alert { margin: 0 0 20px; font-size: .9rem; line-height: 1.6; overflow-wrap: anywhere; }
.public-login-card .form-group { margin-bottom: 18px; }
.public-login-card .control-label { display: block; margin-bottom: 8px; font-weight: 600; }
.public-login-card .form-control { min-height: 46px; border-radius: 10px; font-size: 1rem; }
.public-login-card .invalid-feedback, .public-login-card .help-block { line-height: 1.5; white-space: normal; }
.public-login-password-toggle { display: flex; align-items: center; gap: 8px; margin: 0 0 22px; font-size: .9rem; cursor: pointer; }
.public-login-password-toggle input { flex: 0 0 auto; width: 16px; height: 16px; margin: 0; }
.public-login-submit { width: 100%; min-height: 46px; border-radius: 10px; }
.public-login-links { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-top: 24px; font-size: .85rem; line-height: 1.6; }
.public-login-links > div { min-width: 0; overflow-wrap: anywhere; }
.public-login-links > div:last-child { text-align: right; }
.public-login-links a { color: #111827; font-weight: 600; }
.public-login-page + #footer { position: relative; }
@media (max-width: 575.98px) {
    .public-login-page.banner-header { min-height: 0; padding: 120px 12px 64px; }
    .public-login-page > .container { padding: 0; }
    .public-login-card { padding: 26px 22px; border-radius: 20px; }
    .public-login-links { grid-template-columns: minmax(0, 1fr); gap: 10px; }
    .public-login-links > div:last-child { text-align: left; }
}
CSS);
?>
<main class="main banner-header banner-header-unique public-login-page">
    <div class="container">
        <section class="public-login-card" aria-labelledby="public-login-title">
            <h1 id="public-login-title"><?= Html::encode(Yii::t('app', 'login')) ?></h1>
            <p class="public-login-intro"><?= Html::encode(Yii::t('app', 'login_block_text_1')) ?></p>
            <?php if (Yii::$app->session->hasFlash('warning')): ?>
                <div class="alert alert-warning rounded-4" role="alert"><?= Html::encode(Yii::$app->session->getFlash('warning')) ?></div>
            <?php endif; ?>
            <?= $this->render('_csrf_warning') ?>
            <?php $form = ActiveForm::begin(['id' => 'login-form','options'=>['data-native-auth'=>'login','data-native-auth-logo'=>\common\helpers\CompanyBranding::mobileLogoUrl() ?: '', 'data-native-auth-messages'=>\yii\helpers\Json::encode(\common\helpers\NativeAuthPresentation::messages()), 'data-native-auth-color'=>$companyArr['color'] ?? '', 'data-native-auth-company'=>$companyArr['company_name'] ?? Yii::$app->name]]); ?>
                <?= $form->field($model, 'username')->textInput([
                    'class' => 'form-control', 'autofocus' => true, 'autocomplete' => 'username',
                ])->label(Yii::t('app', 'login_label_username_2')) ?>
                <?= $form->field($model, 'password')->passwordInput([
                    'class' => 'form-control', 'id' => 'password-input', 'autocomplete' => 'current-password',
                ])->label(Yii::t('app', 'login_label_password_2')) ?>
                <label class="public-login-password-toggle">
                    <input type="checkbox" onclick="viewInputPassword(this)" aria-controls="password-input">
                    <span><?= Html::encode(Yii::t('app', 'show_password')) ?></span>
                </label>
                <?= Html::submitButton(Html::encode(Yii::t('app', 'login_button_2')), [
                    'class' => 'btn btn-dark public-login-submit', 'name' => 'login-button',
                ]) ?>
            <?php ActiveForm::end(); ?>
            <div class="public-login-links">
                <div>
                    <?= Html::encode(Yii::t('app', 'login_block_dont_have_account_question')) ?>
                    <?= Html::a(Html::encode(Yii::t('app', 'register')), ['site/signup-client']) ?>
                </div>
                <div><?= Html::a(Html::encode(Yii::t('app', 'login_block_forgot_password_2')), ['/request-password-reset']) ?></div>
            </div>
        </section>
    </div>
    <div class="vector vector-1-dark"></div>
    <div class="vector vector-2-dark"></div>
    <div class="vector vector-3-dark"></div>
</main>
