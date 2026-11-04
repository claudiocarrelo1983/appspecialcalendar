<?php

use yii\helpers\Html;
use yii\helpers\Url;
use yii\widgets\ActiveForm;
use common\helpers\Helpers;
use common\models\Company;

/** @var yii\web\View $this */
/** @var app\models\Company $model */

$companyCodeUrl = $model->company_code_url ?: Yii::$app->user->identity->company_code_url;
$bookingUrl = Yii::$app->request->hostInfo . '/' . $companyCodeUrl . '/booking';
$signupUrl = Yii::$app->request->hostInfo . '/form-signup?pagecode=' . $companyCodeUrl;
$pageUrl = Url::toRoute(['/page', 'pagecode' => $companyCodeUrl], true);
$defaultLogoUrl = '/images/icon-specialcalendar.png';
$legacyDefaultLogos = ['generic-logo.jpg', 'logo-calendar-dark.png', 'logo_page.png', 'icon-specialcalendar.png'];
$storedLogoName = ltrim((string)$model->image_logo, '/');
$hasCustomLogo = !empty($storedLogoName) && !in_array(basename($storedLogoName), $legacyDefaultLogos, true);
$logoUrl = Helpers::companyLogoUrl($model) ?: $defaultLogoUrl;
$mobileLogoReady = $model->hasAttribute('image_logo_mobile');
$mobileLogoUrl = \common\helpers\CompanyBranding::mobileLogoUrl($model) ?: Helpers::defaultAdminLogoUrl('dark');
$desktopLogoUrl = Helpers::companyLogoUrl($model) ?: Helpers::defaultAdminLogoUrl('light');
$companyAssetUrl = static function (?string $image, ?string $path) {
    if (empty($image)) {
        return '';
    }

    $image = (string)$image;
    if (str_starts_with($image, '/uploads/') || str_starts_with($image, '/images/')) {
        return $image;
    }

    return rtrim((string)$path, '/') . '/' . ltrim($image, '/');
};
$bannerUrl = $companyAssetUrl($model->image_banner, $model->path);
$hasCustomBanner = !empty($bannerUrl);
$companyName = $model->company_name ?: Yii::$app->name;
$languagesValue = is_array($model->languages) ? $model->languages : explode('|', (string)$model->languages);
$model->languages = array_filter($languagesValue);
$durationOptions = Helpers::calendarTimeIntervalDurationDropdown();
$bookingAdvanceOptions = ['00:00:00' => '00:00', '00:15:00' => '00:15'];
foreach ($durationOptions as $duration => $label) {
    $bookingAdvanceOptions[$duration . ':00'] = $label;
}
if (preg_match('/^\d{2}:\d{2}$/', (string)$model->booking_advance_time)) {
    $model->booking_advance_time .= ':00';
}
if ($model->booking_advance_time !== null && trim((string)$model->booking_advance_time) !== ''
    && !isset($bookingAdvanceOptions[$model->booking_advance_time])) {
    $bookingAdvanceOptions[$model->booking_advance_time] = $model->booking_advance_time;
}
$cancellationOptions = ['00:00:00' => '00:00', '00:15:00' => '00:15'];
foreach ($durationOptions as $duration => $label) {
    $cancellationOptions[$duration . ':00'] = $label;
}
foreach ([6, 12, 24, 48, 72] as $hours) {
    $cancellationOptions[sprintf('%02d:00:00', $hours)] = sprintf('%02d:00', $hours);
}
if ($model->cancelation_time === null || trim((string)$model->cancelation_time) === '') {
    $model->cancelation_time = '01:00:00';
}
if (!isset($cancellationOptions[$model->cancelation_time])) {
    $cancellationOptions[$model->cancelation_time] = $model->cancelation_time;
}
$logoInputId = Html::getInputId($model, 'logoimage');
$bannerInputId = Html::getInputId($model, 'bannerimage');
$brandColor = Company::normalizeBrandColor($model->color, '#0d6efd');
$model->coin = strtolower(Helpers::normalizeCurrencyCode($model->coin));
$brandPalette = [
    '#2563eb',
    '#0ea5e9',
    '#14b8a6',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#ec4899',
    '#8b5cf6',
    '#111827',
    '#64748b',
];
?>

<div class="company-form company-settings" style="--sc-primary: <?= Html::encode($brandColor) ?>; --sc-primary-rgb: <?= Html::encode(Company::brandColorRgb($brandColor)) ?>;">
    <?php if (Yii::$app->session->hasFlash('success')): ?>
        <div class="alert alert-success alert-dismissible fade show rounded-4 shadow-sm mb-4" role="alert">
            <i class="bx bx-check-circle"></i>
            <?= Yii::$app->session->getFlash('success') ?>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    <?php endif; ?>

    <section class="company-settings-hero rounded-4 shadow-sm mb-4">
        <div class="company-settings-hero-copy">
            <span><?= Yii::t('app', 'company_details') ?></span>
            <h1 class="js-company-preview-name"><?= Html::encode($companyName) ?></h1>
            <div class="company-settings-url-row">
                <a class="company-settings-url js-company-page-url" href="<?= Html::encode($signupUrl) ?>" target="_blank" data-url-base="<?= Html::encode(Yii::$app->request->hostInfo . '/form-signup?pagecode=') ?>">
                    <i class="bx bx-link-external"></i>
                    <span><?= Html::encode($signupUrl) ?></span>
                </a>
                <button type="button" class="btn btn-light border rounded-4 company-settings-copy-url" data-copy-url="<?= Html::encode($signupUrl) ?>" title="<?= Html::encode(Yii::t('app', 'copy')) ?>">
                    <i class="bx bx-copy"></i>
                </button>
            </div>
        </div>
 
    </section>

    <?php $form = ActiveForm::begin([
        'options' => [
            'class' => 'company-settings-form',
            'enctype' => 'multipart/form-data',
        ],
    ]); ?>

    <?= Html::hiddenInput('remove_logo', '0', ['data-remove-logo' => 1]) ?>
    <?= Html::hiddenInput('remove_banner', '0', ['data-remove-banner' => 1]) ?>

    <nav class="company-settings-nav rounded-4 shadow-sm mb-4" aria-label="<?= Html::encode(Yii::t('app', 'company_settings_navigation')) ?>">
        <?php foreach ([
            'details' => ['bx-buildings', 'details'],
            'booking' => ['bx-calendar-check', 'company_settings_booking'],
            'notifications' => ['bx-bell', 'company_push_heading'],
            'client-dashboard' => ['bx-id-card', 'gym_client_overview_settings'],
            'address' => ['bx-map', 'our_address_title'],
            'social' => ['bx-world', 'social'],
            'access' => ['bx-shield-quarter', 'company_settings_access'],
            'language-settings' => ['bx-globe', 'company_settings_languages'],
            'branding' => ['bx-palette', 'company_settings_identity'],
        ] as $section => [$icon, $label]): ?>
            <a href="#company-<?= Html::encode($section) ?>"><i class="bx <?= Html::encode($icon) ?>" aria-hidden="true"></i><?= Html::encode(Yii::t('app', $label)) ?></a>
        <?php endforeach; ?>
    </nav>

    <div class="company-settings-cards">
            <section class="card border-0 rounded-4 shadow-sm company-settings-card mb-4">
                <div class="company-settings-preview-banner js-company-banner-preview" style="<?= $bannerUrl ? 'background-image: url(' . Html::encode($bannerUrl) . ');' : '' ?>">
                    <label
                        class="company-settings-media-action company-settings-banner-action"
                        for="<?= Html::encode($bannerInputId) ?>"
                        title="<?= Html::encode(Yii::t('app', 'banner_image')) ?>"
                        aria-label="<?= Html::encode(Yii::t('app', 'banner_image')) ?>"
                    >
                        <i class="bx bx-pencil"></i>
                    </label>
                    <button
                        type="button"
                        class="company-settings-media-action company-settings-media-delete company-settings-banner-delete<?= $hasCustomBanner ? '' : ' d-none' ?>"
                        title="<?= Html::encode(Yii::t('app', 'delete')) ?>"
                        aria-label="<?= Html::encode(Yii::t('app', 'delete')) ?>"
                        data-delete-company-media="banner"
                    >
                        <i class="bx bx-trash"></i>
                    </button>
                    <div class="company-settings-logo js-company-logo-preview">
                        <img
                            class="img-fluid my-3 logo-specialcalendar-page"
                            src="<?= Html::encode($logoUrl) ?>"
                            alt="<?= Html::encode($logoUrl === $defaultLogoUrl ? 'logo ' : $companyName) ?>"
                            loading="eager"
                            onerror="this.onerror=null;this.src='<?= Html::encode($defaultLogoUrl) ?>'"
                        >
                        <label
                            class="company-settings-media-action company-settings-logo-action"
                            for="<?= Html::encode($logoInputId) ?>"
                            title="<?= Html::encode(Yii::t('app', 'logo_image')) ?>"
                            aria-label="<?= Html::encode(Yii::t('app', 'logo_image')) ?>"
                        >
                            <i class="bx bx-pencil"></i>
                        </label>
                        <button
                            type="button"
                            class="company-settings-media-action company-settings-media-delete company-settings-logo-delete<?= $hasCustomLogo ? '' : ' d-none' ?>"
                            title="<?= Html::encode(Yii::t('app', 'delete')) ?>"
                            aria-label="<?= Html::encode(Yii::t('app', 'delete')) ?>"
                            data-delete-company-media="logo"
                        >
                            <i class="bx bx-trash"></i>
                        </button>
                    </div>
                    <div class="company-settings-hidden-upload">
                        <?= $form->field($model, 'logoimage')->fileInput([
                            'id' => $logoInputId,
                            'class' => 'company-settings-file-input',
                            'data-company-preview' => 'logo',
                            'accept' => 'image/png,image/jpeg,image/gif,image/webp',
                        ])->label(false) ?>
                        <?= $form->field($model, 'bannerimage')->fileInput([
                            'id' => $bannerInputId,
                            'class' => 'company-settings-file-input',
                            'data-company-preview' => 'banner',
                            'accept' => 'image/png,image/jpeg,image/gif,image/webp',
                        ])->label(false) ?>
                    </div>
                </div>
                <div class="card-body">
                    <h2 class="js-company-preview-name"><?= Html::encode($companyName) ?></h2>
                    <p class="mb-0"><?= Html::encode($model->email_1 ?: $model->contact_number_1) ?></p>
                </div>
            </section>

            <section id="company-logo-settings" class="card border-0 rounded-4 shadow-sm company-settings-card">
                <div class="card-body">
                    <div class="company-settings-section-title"><i class="bx bx-image"></i><h2><?= Html::encode(Yii::t('app','company_logo_settings')) ?></h2></div>
                    <div class="row g-3">
                        <div class="col-12 col-md-6 d-flex flex-column">
                            <h3 class="h6"><?= Html::encode(Yii::t('app','company_desktop_logo')) ?></h3>
                            <p class="text-muted small"><?= Html::encode(Yii::t('app','company_desktop_logo_hint')) ?></p>
                            <div class="js-company-logo-preview mb-3 p-3 rounded-3" style="background:#111827;min-height:104px;display:flex;align-items:center;justify-content:center"><img src="<?= Html::encode($desktopLogoUrl) ?>" alt="<?= Html::encode(Yii::t('app','company_desktop_logo')) ?>" style="width:100%;max-width:200px;height:72px;object-fit:contain"></div>
                            <label for="<?= Html::encode($logoInputId) ?>" class="btn btn-reset-modern align-self-start mt-auto"><?= Html::encode(Yii::t('app','company_choose_logo')) ?></label>
                        </div>
                        <div class="col-12 col-md-6 d-flex flex-column">
                            <h3 class="h6"><?= Html::encode(Yii::t('app','company_mobile_logo')) ?></h3>
                            <p class="text-muted small"><?= Html::encode(Yii::t('app','company_mobile_logo_hint')) ?></p>
                            <img class="js-company-mobile-logo-preview mb-3" src="<?= Html::encode($mobileLogoUrl) ?>" alt="<?= Html::encode(Yii::t('app','company_mobile_logo')) ?>" style="width:72px;height:72px;object-fit:contain">
                            <div class="company-settings-hidden-upload">
                                <?= $form->field($model,'mobileLogoImage')->fileInput(['class'=>'company-settings-file-input','accept'=>'image/png,image/jpeg,image/gif,image/webp','data-company-preview'=>'mobile-logo','disabled'=>!$mobileLogoReady])->label(false) ?>
                            </div>
                            <label for="<?= Html::encode(Html::getInputId($model,'mobileLogoImage')) ?>" class="btn btn-reset-modern align-self-start mt-auto <?= !$mobileLogoReady ? 'disabled' : '' ?>"><?= Html::encode(Yii::t('app','company_choose_logo')) ?></label>
                            <?php if($mobileLogoReady): ?>
                                <div class="mt-3"><?= Html::checkbox('remove_mobile_logo',false,['uncheck'=>'0','label'=>Yii::t('app','company_mobile_logo_reset')]) ?></div>
                            <?php else: ?><p class="text-muted small"><?= Html::encode(Yii::t('app','company_mobile_logo_unavailable')) ?></p><?php endif; ?>
                        </div>
                    </div>
                </div>
            </section>

            <section id="company-branding" class="card border-0 rounded-4 shadow-sm company-settings-card">
                <div class="card-body">
                    <div class="company-settings-section-title">
                        <i class="bx bx-image"></i>
                        <h2><?= Yii::t('app', 'page_style') ?></h2>
                    </div>
                    <div class="row g-3">
                        <div class="col-12">
                            <?= $form->field($model, 'company_code_url', [
                                'template' => '{label}<div class="d-flex align-items-stretch gap-2">{input}' . Html::button('<i class="bx bx-copy" aria-hidden="true"></i>', [
                                    'type' => 'button',
                                    'class' => 'btn btn-light border rounded-4 company-settings-copy-url flex-shrink-0',
                                    'data-copy-url' => $model->company_code_url,
                                    'title' => Yii::t('app', 'copy_company_code'),
                                    'aria-label' => Yii::t('app', 'copy_company_code'),
                                ]) . '</div>{hint}{error}',
                            ])->textInput([
                                'class' => 'form-control rounded-4',
                                'style' => 'min-width:0',
                                'maxlength' => true,
                                'readonly' => true,
                            ])->label(Yii::t('app', 'company_code_label')) ?>
                        </div>
                        <div class="col-12">
                            <?= $form->field($model, 'color')->textInput([
                                'class' => 'form-control rounded-4 company-settings-color-input',
                                'maxlength' => true,
                                'value' => $brandColor,
                                'placeholder' => '#0d6efd or rgb(13, 110, 253)',
                                'data-company-color-input' => 1,
                            ])->label(Yii::t('app', 'color')) ?>
                            <div class="company-settings-palette" role="group" aria-label="<?= Html::encode(Yii::t('app', 'color')) ?>">
                                <?php foreach ($brandPalette as $paletteColor): ?>
                                    <button
                                        type="button"
                                        class="company-settings-swatch<?= strtolower($paletteColor) === strtolower($brandColor) ? ' is-active' : '' ?>"
                                        style="--swatch-color: <?= Html::encode($paletteColor) ?>"
                                        data-company-color="<?= Html::encode($paletteColor) ?>"
                                        aria-label="<?= Html::encode($paletteColor) ?>"
                                    ></button>
                                <?php endforeach; ?>
                            </div>
                            <div class="company-settings-color-preview rounded-4">
                                <span class="rounded-4 company-settings-preview-sample js-company-brand-preview" style="background-color: <?= Html::encode($brandColor) ?>;">
                                    <?= Yii::t('app', 'preview') ?>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <section id="company-details" class="card border-0 rounded-4 shadow-sm company-settings-card mb-4">
                <div class="card-body">
                    <div class="company-settings-section-title">
                        <i class="bx bx-buildings"></i>
                        <h2><?= Yii::t('app', 'details') ?></h2>
                    </div>
                    <div class="row g-3">
                        <div class="col-12 col-lg-6">
                            <?= $form->field($model, 'company_name')->textInput([
                                'class' => 'form-control rounded-4',
                                'maxlength' => true,
                                'data-company-name-input' => 1,
                            ]) ?>
                        </div>
                        <div class="col-12 col-lg-6">
                            <?= $form->field($model, 'email_1')->textInput(['class' => 'form-control rounded-4', 'maxlength' => true]) ?>
                        </div>
                        <div class="col-12 col-lg-6">
                            <?= $form->field($model, 'contact_number_1')->textInput(['class' => 'form-control rounded-4', 'maxlength' => true]) ?>
                        </div>
                        <div class="col-12 col-lg-6">
                            <?= $form->field($model, 'nif')->textInput(['class' => 'form-control rounded-4', 'maxlength' => true]) ?>
                        </div>
                        <div class="col-12 col-lg-6">
                            <?= $form->field($model, 'coin')->dropDownList(Helpers::currencyArr(), [
                                'class' => 'form-select rounded-4',
                            ])->label(Yii::t('app', 'currency'))->hint(Yii::t('app', 'company_currency_hint')) ?>
                        </div>
                    </div>
                </div>
            </section>

            <?= $this->render('_notification_settings', ['form' => $form, 'model' => $model]) ?>
            <?= $this->render('_client_dashboard_settings', ['form' => $form, 'model' => $model]) ?>

            <?= $this->render('_booking_settings', [
                'form' => $form, 'model' => $model, 'bookingAdvanceOptions' => $bookingAdvanceOptions,
                'cancellationOptions' => $cancellationOptions, 'reminderSettings' => $reminderSettings ?? null,
            ]) ?>

            <section id="company-address" class="card border-0 rounded-4 shadow-sm company-settings-card mb-4">
                <div class="card-body">
                    <div class="company-settings-section-title">
                        <i class="bx bx-map"></i>
                        <h2><?= Yii::t('app', 'our_address_title') ?></h2>
                    </div>
                    <div class="row g-3">
                        <div class="col-12 col-lg-6">
                            <?= $form->field($model, 'address_line_1')->textInput(['class' => 'form-control rounded-4', 'maxlength' => true]) ?>
                        </div>
                        <div class="col-12 col-lg-6">
                            <?= $form->field($model, 'address_line_2')->textInput(['class' => 'form-control rounded-4', 'maxlength' => true]) ?>
                        </div>
                        <div class="col-12 col-md-6 col-lg-4">
                            <?= $form->field($model, 'city')->textInput(['class' => 'form-control rounded-4', 'maxlength' => true]) ?>
                        </div>
                        <div class="col-12 col-md-6 col-lg-4">
                            <?= $form->field($model, 'postcode')->textInput(['class' => 'form-control rounded-4', 'maxlength' => true]) ?>
                        </div>
                        <div class="col-12 col-md-6 col-lg-4">
                            <?= $form->field($model, 'location')->textInput(['class' => 'form-control rounded-4', 'maxlength' => true]) ?>
                        </div>
                        <div class="col-12">
                            <?= $form->field($model, 'country')->dropDownList(
                                Helpers::countriesDropdownArr(),
                                ['class' => 'form-select rounded-4']
                            ) ?>
                        </div>
                    </div>
                </div>
            </section>

            <section id="company-social" class="card border-0 rounded-4 shadow-sm company-settings-card mb-4">
                <div class="card-body">
                    <div class="company-settings-section-title">
                        <i class="bx bx-world"></i>
                        <h2><?= Yii::t('app', 'social') ?></h2>
                    </div>
                    <div class="row g-3">
                        <?php foreach (['website', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'twitter', 'pinterest'] as $field): ?>
                            <div class="col-12 col-md-6">
                                <?= $form->field($model, $field)->textInput([
                                    'class' => 'form-control rounded-4',
                                    'maxlength' => true,
                                ]) ?>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </section>

            <section id="company-access" class="card border-0 rounded-4 shadow-sm company-settings-card mb-4">
                <div class="card-body">
                    <div class="company-settings-section-title">
                        <i class="bx bx-shield-quarter" aria-hidden="true"></i>
                        <h2><?= Html::encode(Yii::t('app', 'company_settings_access')) ?></h2>
                    </div>
                    <div class="row g-3">
                        <?php foreach (['publish', 'login_required', 'display_client_page', 'publish_logo_main_page'] as $field): ?>
                            <div class="col-12 col-md-6">
                                <?= $form->field($model, $field)->dropDownList(Helpers::dropdownActive(), ['class' => 'form-select rounded-4']) ?>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </section>

            <section id="company-language-settings" class="card border-0 rounded-4 shadow-sm company-settings-card">
                <div class="card-body">
                    <div class="company-settings-section-title">
                        <i class="bx bx-globe" aria-hidden="true"></i>
                        <h2><?= Html::encode(Yii::t('app', 'company_settings_languages')) ?></h2>
                    </div>
                    <div class="row g-3">
                        <div class="col-12">
                            <div class="company-settings-language-box rounded-4">
                                <?= $form->field($model, 'languages')->checkboxList(
                                    Helpers::dropdownLanguage(),
                                    [
                                        'class' => 'company-settings-languages',
                                        'itemOptions' => ['class' => 'form-check-input'],
                                        'separator' => '',
                                    ]
                                )->label(false) ?>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
    </div>

    <div class="d-flex justify-content-end mt-4">
        <?= Html::submitButton('<i class="bx bx-save" aria-hidden="true"></i>' . Html::encode(Yii::t('app', 'save_button')), [
            'class' => 'btn btn-primary-modern rounded-4 d-inline-flex align-items-center justify-content-center gap-2',
        ]) ?>
    </div>

    <?php ActiveForm::end(); ?>
</div>

<style>
    .company-settings { color: #111827; }
    .company-settings-cards { display: flex; flex-direction: column; gap: 1.5rem; }
    .company-settings-cards > .company-settings-card { width: 100%; margin: 0 !important; }
    .company-settings-cards > #company-details { order: -2; }
    .company-settings-cards > #company-booking { order: -1; }
    @media (min-width: 1200px) {
        .company-settings-cards { display: block; column-count: 2; column-gap: 1.5rem; }
        .company-settings-cards > .company-settings-card { display: inline-block; vertical-align: top; break-inside: avoid; margin-bottom: 1.5rem !important; }
        .company-settings-cards.company-settings-cards--packed { display: grid; column-count: auto; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 1px; column-gap: 1.5rem; row-gap: 0; align-items: start; }
        .company-settings-cards.company-settings-cards--packed > .company-settings-card { display: block; min-width: 0; margin: 0 !important; align-self: start; }
    }
    .company-settings-nav { display: flex; flex-wrap: wrap; gap: .4rem; background: #fff; padding: .75rem; }
    .company-settings-nav a { display: inline-flex; align-items: center; gap: .4rem; padding: .6rem .8rem; border-radius: .75rem; color: #475569; font-size: .85rem; font-weight: 600; text-decoration: none; }
    .company-settings-nav a:hover, .company-settings-nav a:focus-visible { background: rgba(var(--sc-primary-rgb), .08); color: var(--sc-primary); }
    .company-settings-nav i { font-size: 1.1rem; }
    .company-settings-card[id] { scroll-margin-top: 6rem; }
    .company-settings-card .row > div { min-width: 0; }
    .company-settings-card .form-label, .company-settings-card .control-label { font-size: .875rem; font-weight: 600; line-height: 1.5; }
    .company-settings-card .hint-block { font-size: .8rem; color: #64748b; line-height: 1.6; margin-top: .5rem; }
    .company-settings-rule { background: #f8fafc; border: 1px solid #e8edf3; padding: 1.1rem; }
    .company-settings-rule-heading { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; }
    .company-settings-rule-heading i { color: var(--sc-primary); font-size: 1.15rem; }
    .company-settings-rule-heading h3 { margin: 0; font-size: .95rem; font-weight: 700; }
    .company-settings-section-title > i { flex-shrink: 0; }
    .company-settings-actions { position: sticky; bottom: 1rem; z-index: 10; border: 1px solid #e8edf3; box-shadow: 0 4px 24px rgba(15,23,42,.1) !important; }
    .company-settings-hero,
    .company-settings-actions {
        align-items: center;
        background: #fff;
        display: flex;
        gap: 1rem;
        justify-content: space-between;
        padding: 1.25rem;
    }
    .company-settings-hero-copy { min-width: 0; }
    .company-settings-hero-copy span {
        color: #64748b;
        display: block;
        font-size: .78rem;
        font-weight: 700;
        margin-bottom: .25rem;
        text-transform: uppercase;
    }
    .company-settings-hero-copy h1 {
        font-size: clamp(1.4rem, 2vw, 2rem);
        font-weight: 800;
        margin: 0 0 .5rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .company-settings-url-row {
        align-items: center;
        display: flex;
        gap: .5rem;
        min-width: 0;
    }
    .company-settings-url {
        align-items: center;
        color: var(--sc-primary);
        display: inline-flex;
        font-size: .9rem;
        gap: .4rem;
        min-width: 0;
        text-decoration: none;
    }
    .company-settings-url span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .company-settings-copy-url,
    .company-settings-hero-actions .btn,
    .company-settings-actions .btn {
        align-items: center;
        display: inline-flex;
        gap: .35rem;
        justify-content: center;
    }
    .company-settings-copy-url {
        flex: 0 0 auto;
        height: 2.15rem;
        width: 2.15rem;
    }
    .company-settings-card .card-body { padding: 1.25rem; }
    .company-settings-preview-banner {
        align-items: flex-end;
        background: linear-gradient(135deg, #f8fafc, #dbeafe);
        background-position: center;
        background-size: cover;
        border-radius: 1rem 1rem 0 0;
        display: flex;
        min-height: 11rem;
        padding: 1rem;
        position: relative;
    }
    .company-settings-logo {
        align-items: center;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 1rem;
        display: flex;
        height: 4.5rem;
        justify-content: center;
        margin-right: 2.75rem;
        overflow: visible;
        position: relative;
        width: 4.5rem;
    }
    .company-settings-hidden-upload {
        height: 1px;
        overflow: hidden;
        position: absolute;
        width: 1px;
    }
    .company-settings-file-input {
        height: 1px;
        opacity: 0;
        position: absolute;
        width: 1px;
    }
    .company-settings-media-action {
        align-items: center;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        box-shadow: 0 10px 22px rgba(15,23,42,.18);
        color: var(--sc-primary);
        cursor: pointer;
        display: inline-flex;
        height: 2rem;
        justify-content: center;
        margin: 0;
        position: absolute;
        transition: transform .18s ease, box-shadow .18s ease;
        width: 2rem;
        z-index: 2;
    }
    .company-settings-media-action:hover {
        box-shadow: 0 14px 28px rgba(15,23,42,.22);
        transform: translateY(-1px);
    }
    .company-settings .company-settings-media-action i {
        color: inherit !important;
    }
    .company-settings-media-action i {
        font-size: 1rem;
    }
    .company-settings-banner-action {
        right: .85rem;
        top: .85rem;
    }
    .company-settings-logo-action {
        right: -2.45rem;
        top: .25rem;
    }
    .company-settings-media-delete {
        color: #dc2626;
    }
    .company-settings-banner-delete {
        right: 3.15rem;
        top: .85rem;
    }
    .company-settings-logo-delete {
        bottom: .25rem;
        right: -2.45rem;
    }
    .company-settings-logo img {
        height: 100%;
        object-fit: contain;
        width: 100%;
    }
    .company-settings-logo i {
        color: var(--sc-primary);
        font-size: 1rem;
    }
    .company-settings-card h2 {
        font-size: 1.05rem;
        font-weight: 800;
        margin: 0 0 .25rem;
    }
    .company-settings-card p,
    .company-settings-actions-muted {
        color: #64748b;
        font-size: .85rem;
    }
    .company-settings-section-title {
        align-items: center;
        display: flex;
        gap: .6rem;
        margin-bottom: 1rem;
    }
    .company-settings-section-title i {
        align-items: center;
        background: rgba(var(--sc-primary-rgb), .12);
        border-radius: 14px;
        color: var(--sc-primary);
        display: inline-flex;
        font-size: 1.2rem;
        height: 2.35rem;
        justify-content: center;
        width: 2.35rem;
    }
    .company-settings-section-title h2,
    .company-settings-actions-title {
        font-size: 1.05rem;
        font-weight: 800;
        margin: 0;
    }
    .company-settings-language-box {
        background: #f8fafc;
        padding: 1rem;
    }
    .company-settings-color-input {
        cursor: pointer;
        height: 2.75rem;
        padding: .35rem;
    }
    .company-settings-palette {
        display: grid;
        gap: .5rem;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        margin-top: .75rem;
    }
    .company-settings-swatch {
        background: var(--swatch-color);
        border: 2px solid #fff;
        border-radius: 999px;
        box-shadow: 0 0 0 1px #dbe3ef, 0 8px 18px rgba(15,23,42,.12);
        cursor: pointer;
        height: 2.25rem;
        padding: 0;
        transition: box-shadow .18s ease, transform .18s ease;
    }
    .company-settings-swatch:hover,
    .company-settings-swatch.is-active {
        box-shadow: 0 0 0 3px rgba(37,99,235,.2), 0 10px 22px rgba(15,23,42,.18);
        transform: translateY(-1px);
    }
    .company-settings-color-preview {
        align-items: center;
        background: #f8fafc;
        display: flex;
        gap: .75rem;
        justify-content: space-between;
        margin-top: .9rem;
        padding: .75rem;
    }
    .company-settings-color-preview span {
        color: #64748b;
        font-size: .82rem;
        font-weight: 700;
    }
    .company-settings-color-preview .company-settings-preview-sample {
        border: 0;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: .85rem;
        font-weight: 800;
        min-height: 40px;
        width: 100%;
    }
    .company-settings-languages {
        display: flex;
        flex-wrap: wrap;
        gap: .75rem 1rem;
    }
    .company-settings-languages label {
        align-items: center;
        background: #fff;
        border-radius: 999px;
        display: inline-flex;
        gap: .4rem;
        margin: 0;
        padding: .45rem .75rem;
    }
    .js-company-unsaved {
        color: #b45309;
        display: none;
        font-weight: 700;
        margin-top: .2rem;
    }
    .js-company-unsaved.is-visible { display: block; }
    @media (max-width: 767.98px) {
        .company-settings-nav { flex-wrap: nowrap; overflow-x: auto; }
        .company-settings-nav a { flex-shrink: 0; }
        .company-settings-actions { bottom: .5rem; }
        .company-settings-hero,
        .company-settings-actions {
            align-items: stretch;
            flex-direction: column;
        }
        .company-settings-hero-actions .btn,
        .company-settings-actions .btn { width: 100%; }
    }
</style>

<?php
$this->registerJs(<<<JS
(function ($) {
    // Size each grid item independently so unequal cards do not leave empty rows.
    $('.company-settings-cards').each(function () {
        var container = this, cards = Array.from(container.children).filter(function (card) {
            return card.classList.contains('company-settings-card');
        });
        if (!window.ResizeObserver) return;
        var desktop = window.matchMedia('(min-width: 1200px)'), scheduled = false;
        function arrangeCards() {
            scheduled = false;
            container.classList.toggle('company-settings-cards--packed', desktop.matches);
            cards.forEach(function (card) {
                card.style.gridRowEnd = desktop.matches ? 'span ' + Math.ceil(card.getBoundingClientRect().height + 24) : '';
            });
        }
        function scheduleCards() {
            if (!scheduled) { scheduled = true; window.requestAnimationFrame(arrangeCards); }
        }
        var observer = new ResizeObserver(scheduleCards);
        cards.forEach(function (card) { observer.observe(card); });
        observer.observe(container);
        if (desktop.addEventListener) desktop.addEventListener('change', scheduleCards);
        else desktop.addListener(scheduleCards);
        scheduleCards();
    });

    function readImage(file, callback) {
        if (!file || !file.type || file.type.indexOf('image/') !== 0) {
            return;
        }

        var reader = new FileReader();
        reader.onload = function (event) {
            callback(event.target.result);
        };
        reader.readAsDataURL(file);
    }

    function markUnsaved() {
        $('.js-company-unsaved').addClass('is-visible');
    }

    $('[data-company-preview="banner"]').on('change', function () {
        readImage(this.files && this.files[0], function (src) {
            $('.js-company-banner-preview').css('background-image', 'url("' + src + '")');
            $('[data-remove-banner]').val('0');
            $('[data-delete-company-media="banner"]').removeClass('d-none');
        });
        markUnsaved();
    });

    $('[data-company-preview="mobile-logo"]').on('change', function () {
        readImage(this.files && this.files[0], function (src) {
            $('.js-company-mobile-logo-preview').attr('src', src);
            $('input[name="remove_mobile_logo"]').prop('checked', false);
        });
        markUnsaved();
    });

    $('[data-company-preview="logo"]').on('change', function () {
        readImage(this.files && this.files[0], function (src) {
            $('.js-company-logo-preview img').attr('src', src).attr('alt', '');
            $('[data-remove-logo]').val('0');
            $('[data-delete-company-media="logo"]').removeClass('d-none');
        });
        markUnsaved();
    });

    $('[data-delete-company-media]').on('click', function () {
        var mediaType = $(this).data('delete-company-media');

        if (mediaType === 'logo') {
            $('[data-remove-logo]').val('1');
            $('[data-company-preview="logo"]').val('');
            $('.js-company-logo-preview img')
                .attr('src', '{$defaultLogoUrl}')
                .attr('alt', 'logo ');
            $('[data-delete-company-media="logo"]').addClass('d-none');
        }

        if (mediaType === 'banner') {
            $('[data-remove-banner]').val('1');
            $('[data-company-preview="banner"]').val('');
            $('.js-company-banner-preview').css('background-image', '');
            $('[data-delete-company-media="banner"]').addClass('d-none');
        }

        markUnsaved();
    });

    $('[data-company-name-input]').on('input', function () {
        $('.js-company-preview-name').text($(this).val() || '');
        markUnsaved();
    });

    function normalizeBrandColor(color) {
        color = $.trim(color || '');

        if (/^#[0-9a-fA-F]{6}$/.test(color)) {
            return color.toLowerCase();
        }

        if (/^#[0-9a-fA-F]{3}$/.test(color)) {
            return '#' + color.charAt(1) + color.charAt(1) + color.charAt(2) + color.charAt(2) + color.charAt(3) + color.charAt(3);
        }

        var rgbMatch = color.match(/^rgb\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*\\)$/i);
        if (rgbMatch) {
            var rgb = [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
            if (rgb[0] <= 255 && rgb[1] <= 255 && rgb[2] <= 255) {
                return 'rgb(' + rgb.join(', ') + ')';
            }
        }

        return null;
    }

    function setBrandColor(color, updateInput) {
        var normalizedColor = normalizeBrandColor(color);
        if (!normalizedColor) {
            return;
        }

        if (updateInput !== false) {
            $('[data-company-color-input]').val(normalizedColor);
        }
        $('.js-company-brand-preview').css('background-color', normalizedColor);
        var brandRgb = normalizedColor.indexOf('#') === 0
            ? [parseInt(normalizedColor.slice(1, 3), 16), parseInt(normalizedColor.slice(3, 5), 16), parseInt(normalizedColor.slice(5, 7), 16)].join(', ')
            : normalizedColor.slice(4, -1);
        $('.company-settings').each(function () {
            this.style.setProperty('--sc-primary', normalizedColor);
            this.style.setProperty('--sc-primary-rgb', brandRgb);
        });
        $('.company-settings-swatch').removeClass('is-active');
        if (normalizedColor.indexOf('#') === 0) {
            $('.company-settings-swatch[data-company-color="' + normalizedColor.toLowerCase() + '"], .company-settings-swatch[data-company-color="' + normalizedColor.toUpperCase() + '"]').addClass('is-active');
        }
        markUnsaved();
    }

    $('.company-settings-swatch').on('click', function () {
        setBrandColor($(this).data('company-color'), true);
    });

    $('[data-company-color-input]').on('input change', function () {
        setBrandColor($(this).val(), false);
    });

    $('.company-settings-form').on('input change', 'input, select, textarea', function () {
        markUnsaved();
    });

    $('.company-settings-copy-url').on('click', function () {
        var button = $(this);
        var url = button.data('copy-url');
        var done = function () {
            button.addClass('btn-success text-white').removeClass('btn-light');
            window.setTimeout(function () {
                button.removeClass('btn-success text-white').addClass('btn-light');
            }, 1200);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done);
            return;
        }

        var temp = $('<textarea>').val(url).css({
            left: '-9999px',
            position: 'fixed',
            top: 0
        }).appendTo('body');
        temp[0].select();
        document.execCommand('copy');
        temp.remove();
        done();
    });

    $('.company-settings-form').on('submit', function () {
        $('.js-company-unsaved').removeClass('is-visible');
    });

})(jQuery);
JS
);
?>
