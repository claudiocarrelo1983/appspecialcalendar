<?php
use yii\helpers\Html;
use yii\helpers\Json;
use yii\widgets\ActiveForm;

\frontend\assets\ClientSettingsAsset::register($this);
$this->title = Yii::t('app', 'client_settings');
$user = Yii::$app->user->identity;
$companyName = $company->company_name ?? $company->company_code ?? '';
$messages = [];
foreach (['browser', 'granted', 'denied', 'unknown', 'registered', 'enabling', 'enabled', 'failed', 'save_first'] as $key) {
    $messages[$key] = Yii::t('app', 'client_settings_device_' . $key);
}
?>
<div class="client-settings-page" data-client-settings data-messages="<?= Html::encode(Json::encode($messages)) ?>" data-saved-push-enabled="<?= $model->getSavedPushEnabled() ? '1' : '0' ?>">
    <header class="client-settings-header">
        <div class="d-flex align-items-center gap-3 min-w-0">
            <span class="client-settings-heading-icon"><i class="bx bx-cog" aria-hidden="true"></i></span>
            <div><div class="text-muted small"><?= Html::encode(Yii::t('app', 'client_settings_account')) ?></div><h1><?= Html::encode($this->title) ?></h1><p><?= Html::encode(Yii::t('app', 'client_settings_description')) ?></p></div>
        </div>
        <?= Html::a('<i class="bx bx-user-circle me-2" aria-hidden="true"></i>' . Html::encode(Yii::t('app', 'client_settings_edit_profile')), ['/profile'], ['class' => 'btn client-settings-secondary']) ?>
    </header>
    <nav class="client-settings-nav" aria-label="<?= Html::encode(Yii::t('app', 'client_settings')) ?>">
        <?php foreach (['notifications' => ['bx-bell','client_settings_notifications'], 'class-alerts' => ['bx-calendar-event','client_settings_class_alerts'], 'language' => ['bx-globe','client_settings_language'], 'account' => ['bx-shield-quarter','client_settings_security']] as $anchor => [$icon, $label]): ?>
            <a href="#client-settings-<?= $anchor ?>"><i class="bx <?= $icon ?>" aria-hidden="true"></i><?= Html::encode(Yii::t('app', $label)) ?></a>
        <?php endforeach; ?>
    </nav>
    <?= \common\widgets\Alert::widget() ?>
    <?php $form = ActiveForm::begin(['action' => ['/client-settings'], 'options' => ['id' => 'clientSettingsForm'], 'enableClientValidation' => false]); ?>
    <?php if ($model->hasErrors()): ?><?= $form->errorSummary($model, ['class' => 'alert alert-danger rounded-4']) ?><?php endif; ?>
    <div class="row g-3">
        <div class="col-12 col-xl-8">
            <section id="client-settings-notifications" class="card rounded-4 shadow-sm border-0 mb-3">
                <div class="card-body">
                    <div class="client-settings-section-title"><i class="bx bx-bell" aria-hidden="true"></i><div><h2><?= Html::encode(Yii::t('app', 'client_settings_notifications')) ?></h2><p><?= Html::encode(Yii::t('app', 'client_settings_notifications_hint')) ?></p></div></div>
                    <div class="client-settings-company"><i class="bx bx-building-house me-2" aria-hidden="true"></i><?= Html::encode($companyName) ?></div>
                    <?php if (!$companyPushEnabled): ?><div class="client-settings-notice"><?= Html::encode(Yii::t('app', 'client_settings_company_paused')) ?></div><?php endif; ?>
                    <?php foreach ($model->apps as $appId => $label): ?>
                        <div class="client-settings-switch-row">
                            <div><strong><?= Html::encode($label) ?></strong><p><?= Html::encode(Yii::t('app', 'client_settings_push_hint')) ?></p></div>
                            <div class="form-check form-switch">
                                <?= Html::hiddenInput('ClientSettingsForm[notifications][' . $appId . ']', '0') ?>
                                <?= Html::checkbox('ClientSettingsForm[notifications][' . $appId . ']', (bool)($model->notifications[$appId] ?? false), ['class' => 'form-check-input', 'role' => 'switch', 'value' => '1', 'aria-label' => Yii::t('app', 'client_settings_push_for', ['app' => $label])]) ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    <?php if (!$model->apps): ?><p class="text-muted small mb-3"><?= Html::encode(Yii::t('app', 'client_settings_push_unavailable')) ?></p><?php endif; ?>
                    <div class="client-settings-device">
                        <i class="bx bx-mobile-alt" aria-hidden="true"></i>
                        <div class="flex-grow-1 min-w-0"><strong><?= Html::encode(Yii::t('app', 'client_settings_this_device')) ?></strong><p data-client-push-status role="status" aria-live="polite"><?= Html::encode($messages['browser']) ?></p></div>
                        <button type="button" class="btn client-settings-secondary" data-client-enable-push hidden><?= Html::encode(Yii::t('app', 'client_settings_enable_device')) ?></button>
                    </div>
                    <p class="client-settings-device-count"><?= Html::encode(Yii::t('app', 'client_settings_devices', ['count' => $deviceCount])) ?></p>
                </div>
            </section>
            <section id="client-settings-class-alerts" class="card rounded-4 shadow-sm border-0">
                <div class="card-body">
                    <div class="client-settings-section-title"><i class="bx bx-calendar-event" aria-hidden="true"></i><div><h2><?= Html::encode(Yii::t('app', 'client_settings_class_alerts')) ?></h2><p><?= Html::encode(Yii::t('app', 'client_settings_alerts_hint')) ?></p></div></div>
                    <?php if ($model->alertsAvailable && $model->classes): ?>
                        <?= Html::hiddenInput('ClientSettingsForm[classAlerts]', '') ?>
                        <div class="client-settings-classes">
                        <?php foreach ($model->classes as $code => $label): ?>
                            <label class="client-settings-class-option">
                                <?= Html::checkbox('ClientSettingsForm[classAlerts][]', in_array($code, $model->classAlerts, true), ['value' => $code, 'class' => 'form-check-input']) ?>
                                <span><?= Html::encode($label) ?></span><i class="bx bx-bell" aria-hidden="true"></i>
                            </label>
                        <?php endforeach; ?>
                        </div>
                    <?php else: ?><p class="text-muted small mb-0"><?= Html::encode(Yii::t('app', 'client_settings_no_classes')) ?></p><?php endif; ?>
                </div>
            </section>
        </div>
        <div class="col-12 col-xl-4">
            <section id="client-settings-language" class="card rounded-4 shadow-sm border-0 mb-3">
                <div class="card-body">
                    <div class="client-settings-section-title"><i class="bx bx-globe" aria-hidden="true"></i><div><h2><?= Html::encode(Yii::t('app', 'client_settings_language')) ?></h2><p><?= Html::encode(Yii::t('app', 'client_settings_language_hint')) ?></p></div></div>
                    <?= $form->field($model, 'language')->dropDownList(['en' => 'English', 'pt' => 'Português'], ['class' => 'form-select'])->label(false) ?>
                    <p class="small text-muted mb-0"><?= Html::encode(Yii::t('app', 'client_settings_language_global')) ?></p>
                </div>
            </section>
            <section id="client-settings-account" class="card rounded-4 shadow-sm border-0 mb-3">
                <div class="card-body">
                    <div class="client-settings-section-title"><i class="bx bx-shield-quarter" aria-hidden="true"></i><div><h2><?= Html::encode(Yii::t('app', 'client_settings_security')) ?></h2><p><?= Html::encode(Yii::t('app', 'client_settings_security_hint')) ?></p></div></div>
                    <?php foreach ([
                        ['bx-user-circle', 'client_settings_edit_profile', ['/profile']],
                        ['bx-lock-alt', 'client_settings_password', ['/profile/change-password', 'id' => $user->id]],
                        ['bx-history', 'gym_sessions_history', ['/gym-sessions']],
                        ['bx-bell', 'client_settings_inbox', ['/group-notifications']],
                        ['bx-check-shield', 'client_settings_privacy', ['/privacy-policy', 'pagecode' => $company->company_code_url ?? null, 'legal_context' => 'member-settings']],
                    ] as [$icon, $label, $url]): ?>
                        <?= Html::a('<i class="bx ' . $icon . '" aria-hidden="true"></i><span>' . Html::encode(Yii::t('app', $label)) . '</span><i class="bx bx-chevron-right ms-auto" aria-hidden="true"></i>', $url, ['class' => 'client-settings-account-link']) ?>
                    <?php endforeach; ?>
                </div>
            </section>
            <section class="card rounded-4 shadow-sm border-0">
                <div class="card-body">
                    <h2 class="client-settings-privacy-title"><?= Html::encode(Yii::t('app', 'client_settings_account_control')) ?></h2>
                    <p class="small text-muted"><?= Html::encode(Yii::t('app', 'client_settings_delete_hint')) ?></p>
                    <?= Html::a('<i class="bx bx-trash me-2" aria-hidden="true"></i>' . Html::encode(Yii::t('app', 'client_settings_delete')), ['/profile/delete-account'], ['class' => 'btn btn-outline-danger rounded-4 w-100']) ?>
                </div>
            </section>
        </div>
    </div>
    <div class="client-settings-save card rounded-4 shadow-sm border-0 mt-3">
        <span><i class="bx bx-info-circle me-2" aria-hidden="true"></i><?= Html::encode(Yii::t('app', 'client_settings_save_hint')) ?></span>
        <button type="submit" class="btn client-settings-primary"><i class="bx bx-check me-2" aria-hidden="true"></i><?= Html::encode(Yii::t('app', 'client_settings_save')) ?></button>
    </div>
    <?php ActiveForm::end(); ?>
</div>
