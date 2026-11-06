<?php
use yii\helpers\Html;
use yii\helpers\Url;

$this->title = Yii::t('legal', $document . '_title');
$this->params['disableLoadingOverlay'] = true;
$name = trim((string)($companyArr['company_name'] ?? ''));
$brandColor = \common\models\Company::normalizeBrandColor($companyArr['color'] ?? null, '#2563eb');
$logo = \common\helpers\CompanyAuthImage::logo($companyArr);
$loginRoute = ['/site/login', 'pagecode' => $pagecode];
// Only the authenticated Settings entry opts out of the public login navigation.
$memberLegalContext = !Yii::$app->user->isGuest && Yii::$app->request->get('legal_context') === 'member-settings';
?>
<style>
    .scroll-to-top { display: none !important; }
    .company-legal-page { background: #f1f5f9; min-height: 100dvh; padding: clamp(1rem, 4vw, 3rem) 1rem; color: #334155; }
    .company-legal-shell { max-width: 960px; margin: 0 auto; }
    .company-legal-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
    .company-legal-logo-link { display: inline-flex; align-items: center; justify-content: center; max-width: 100%; padding: 6px; border: 1px solid #e2e8f0; border-radius: 18px; background: #fff; }
    .company-legal-logo { display: block; width: auto; height: auto; max-width: 180px; max-height: 80px; object-fit: contain; border-radius: 12px; }
    .company-legal-card { background: #fff; padding: clamp(1.25rem, 4vw, 3rem); border-radius: 1.5rem; overflow-wrap: anywhere; }
    .company-legal-card h1 { font-size: clamp(1.7rem, 5vw, 2.4rem); line-height: 1.2; }
    .company-legal-card h2 { font-size: 1.2rem; line-height: 1.4; margin: 1.75rem 0 .6rem; }
    .company-legal-card p { line-height: 1.8; }
    .company-legal-card ul, .company-legal-card ol { padding-left: 1.4rem; line-height: 1.7; }
    .company-legal-card li { padding-left: .2rem; margin-bottom: .75rem; }
    .company-legal-page a { color: <?= Html::encode($brandColor) ?>; text-decoration: underline; }
    .company-legal-page a:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; }
    .company-legal-details dt { font-weight: 700; }
    .company-legal-details dd { margin-bottom: .75rem; }
</style>
<main class="company-legal-page">
    <div class="company-legal-shell">
        <?php if (!$memberLegalContext): ?>
        <header class="company-legal-header">
            <?= Html::a(Html::img($logo, ['alt' => $name, 'class' => 'company-legal-logo', 'onerror' => \common\helpers\CompanyAuthImage::logoFallbackScript()]), $loginRoute, ['class' => 'company-legal-logo-link']) ?>
            <?= Html::a(Html::encode(Yii::t('legal', 'back_login')), $loginRoute, ['class' => 'py-2']) ?>
            <select id="language" class="form-select w-auto" aria-label="<?= Html::encode(Yii::t('legal', 'language')) ?>" onchange="changeSiteLanguage(this)" data-csrf="<?= Html::encode(Yii::$app->request->getCsrfToken()) ?>" data-url="<?= Html::encode(Url::base(true)) ?>" data-guid="">
                <?php foreach (['pt', 'en'] as $language): ?>
                    <option value="<?= $language ?>" <?= Yii::$app->language === $language ? 'selected' : '' ?>><?= strtoupper($language) ?></option>
                <?php endforeach; ?>
            </select>
        </header>
        <?php endif; ?>
        <article class="company-legal-card rounded-4 shadow-sm">
            <p class="fw-semibold mb-2"><?= Html::encode($name) ?></p>
            <h1><?= Html::encode($this->title) ?></h1>
            <?= $legalContent ?>
            <?php if (!$memberLegalContext): ?>
            <?= $this->render('@frontend/views/client/login/_legal-links', ['pagecode' => $pagecode]) ?>
            <div class="text-center mt-3"><?= Html::a(Html::encode(Yii::t('legal', 'back_login')), $loginRoute, ['class' => 'd-inline-block py-2']) ?></div>
            <?php endif; ?>
        </article>
    </div>
</main>
