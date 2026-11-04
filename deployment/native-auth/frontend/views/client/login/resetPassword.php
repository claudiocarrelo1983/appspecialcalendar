<?php
use common\helpers\CompanyAuthImage;
use yii\helpers\Html;

$this->title = Yii::t('app', 'password_reset_title');
$this->params['companyAuthPage'] = true;
$this->params['disableLoadingOverlay'] = true;
$logo = CompanyAuthImage::logo($companyArr);
$brand = preg_match('/^#[0-9a-fA-F]{6}$/', (string)($companyArr['color'] ?? '')) ? $companyArr['color'] : '#2563eb';
$this->registerCss('body{margin:0}#header,#footer,.scroll-to-top{display:none!important}.password-reset-page{min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:24px 16px;background:linear-gradient(135deg,#f3f8ff,#e1edff)}.password-reset-card{width:100%;max-width:460px;padding:32px;background:#fff;border-radius:24px;box-shadow:0 12px 36px #172b4d14}.password-reset-logo{display:block;max-width:160px;max-height:100px;object-fit:contain;margin:0 auto 24px}.password-reset-card .btn-primary{background:'.$brand.';border-color:'.$brand.'}.password-reset-card input{border-radius:12px}@media(max-width:575px){.password-reset-card{padding:24px 20px}}');
?>
<main class="password-reset-page" data-native-auth-company="<?= Html::encode($companyArr['company_name'] ?? Yii::$app->name) ?>" data-native-auth-logo="<?= Html::encode(\common\helpers\CompanyBranding::mobileLogoUrl() ?: '') ?>">
    <section class="password-reset-card" aria-labelledby="password-reset-title">
        <?= Html::img($logo, ['class' => 'password-reset-logo', 'alt' => $companyArr['company_name'] ?? Yii::$app->name, 'onerror' => CompanyAuthImage::logoFallbackScript()]) ?>
        <h1 id="password-reset-title" class="h3 mb-4"><?= Html::encode($this->title) ?></h1>
        <?= $this->render('_reset_password_content', ['model' => $model, 'loginUrl' => $loginUrl, 'requestUrl' => $requestUrl]) ?>
    </section>
</main>
