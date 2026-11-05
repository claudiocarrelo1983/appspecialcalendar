<?php
use common\helpers\GymMemberQrAccess;
use yii\grid\GridView;
use yii\helpers\Html;
use yii\helpers\Json;
use yii\helpers\Url;
use yii\widgets\ActiveForm;

$this->title = Yii::t('app', 'member_checkin');
$this->registerCssFile('@web/css/gym-checkin.css?v=' . substr(hash_file('sha256', Yii::getAlias('@frontend/web/css/gym-checkin.css')), 0, 12), ['depends' => [\frontend\assets\GymMobileLayoutAsset::class]]);
$canCreate = GymMemberQrAccess::can('create');
$canCheckout = GymMemberQrAccess::can('edit');
$canViewAttendance = GymMemberQrAccess::can('view');
$icon = static function ($name) {
    $paths = [
        'entry' => '<path d="M9 5H5v14h4M13 8l4 4-4 4M8 12h9"/>',
        'exit' => '<path d="M15 5h4v14h-4M11 8l-4 4 4 4M7 12h9"/>',
        'search' => '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
        'person' => '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
        'view' => '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
        'clock' => '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ];
    return '<svg class="checkin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . ($paths[$name] ?? $paths['clock']) . '</svg>';
};
$column = static fn($label) => ['data-gym-label' => Yii::t('app', $label)];
?>
<div class="gym-checkin-page">
    <div class="gym-page-heading checkin-page-heading">
        <span class="gym-page-heading__icon checkin-icon-badge"><?= $icon('entry') ?></span>
        <div class="gym-page-heading__copy">
            <div class="gym-page-heading__category"><?= Html::encode(Yii::t('app', 'checkin_category')) ?></div>
            <h1 id="member-checkin-title" class="gym-page-heading__title"><?= Html::encode($this->title) ?></h1>
        </div>
    </div>
    <div class="checkin-columns<?= $canViewAttendance ? '' : ' checkin-columns-single' ?>">
        <section class="card rounded-4 shadow-sm checkin-confirmation" aria-labelledby="member-checkin-title">
            <div class="card-body">
                <p class="checkin-intro text-muted"><?= Html::encode(Yii::t('app', 'validate_membership_before_access')) ?></p>
                <?php if (!empty($scannedMember)): ?>
                    <div class="checkin-member"><span class="checkin-icon-badge"><?= $icon('person') ?></span><div><span class="text-muted small"><?= Html::encode(Yii::t('app', 'checkin_member_label')) ?></span><strong><?= Html::encode($scannedMember->full_name ?: $scannedMember->username) ?></strong></div></div>
                    <?php if (GymMemberQrAccess::canScan()): ?>
                        <?= Html::a($icon('view') . Html::encode(Yii::t('app', 'checkin_view_client')), ['/clients-list/view', 'id' => $scannedMember->id], ['class' => 'btn btn-outline-primary checkin-secondary checkin-view-client w-100', 'data-checkin-client-details' => '1']) ?>
                    <?php endif; ?>
                <?php endif; ?>
                <?php if ($canCreate): ?>
                    <?php $form = ActiveForm::begin(['id' => 'member-checkin-form']); ?>
                        <?php if (!empty($scannedMember)): ?>
                            <?= Html::activeHiddenInput($model, 'client_guid') ?>
                        <?php else: ?>
                            <?= $form->field($model, 'client_guid')->textInput(['class' => 'form-control rounded-4'])->label(Yii::t('app', 'checkin_member_code')) ?>
                        <?php endif; ?>
                        <?= $form->field($model, 'notes')->textarea(['rows' => 2, 'class' => 'form-control rounded-4'])->label(Yii::t('app', 'checkin_notes_label')) ?>
                        <?= Html::submitButton($icon('entry') . Html::encode(Yii::t('app', 'checkin_action_in')), ['class' => 'btn btn-primary checkin-primary w-100']) ?>
                    <?php ActiveForm::end(); ?>
                <?php else: ?>
                    <p class="alert alert-info rounded-4 mb-0"><?= Html::encode(Yii::t('app', 'qr_checkin_permission_hint')) ?></p>
                <?php endif; ?>
            </div>
        </section>
        <?php if ($canViewAttendance): ?>
        <div class="checkin-records">
            <section class="card rounded-4 shadow-sm checkin-filter" aria-labelledby="checkin-filter-title"><div class="card-body">
                <h2 id="checkin-filter-title"><?= $icon('search') ?> <?= Html::encode(Yii::t('app', 'checkin_find_records')) ?></h2>
                <?php $filter = ActiveForm::begin(['id' => 'gym-checkin-filter', 'method' => 'get', 'action' => ['index'], 'options' => ['class' => 'checkin-filter-fields', 'data-gym-filter-ready' => '1']]); ?>
                    <div class="checkin-search-field">
                        <?= $filter->field($searchModel, 'q')->textInput(['class' => 'form-control rounded-4', 'autocomplete' => 'off', 'list' => 'gym-checkin-member-options', 'data-member-autocomplete' => 1])->label(Yii::t('app', 'checkin_search_member')) ?>
                        <?= Html::activeHiddenInput($searchModel, 'client_guid', ['data-member-guid' => 1]) ?>
                        <datalist id="gym-checkin-member-options"></datalist>
                    </div>
                    <?= $filter->field($searchModel, 'date_from')->input('date', ['class' => 'form-control rounded-4'])->label(Yii::t('app', 'checkin_date_from')) ?>
                    <?= $filter->field($searchModel, 'date_to')->input('date', ['class' => 'form-control rounded-4'])->label(Yii::t('app', 'checkin_date_to')) ?>
                    <?= Html::submitButton($icon('search') . Html::encode(Yii::t('app', 'checkin_filter_action')), ['class' => 'btn btn-primary checkin-primary']) ?>
                <?php ActiveForm::end(); ?>
            </div></section>
            <section class="card rounded-4 shadow-sm checkin-history" aria-labelledby="checkin-history-title"><div class="card-body">
                <h2 id="checkin-history-title"><?= $icon('clock') ?> <?= Html::encode(Yii::t('app', 'checkin_history_title')) ?></h2>
                <?= GridView::widget([
                    'dataProvider' => $dataProvider,
                    'filterRowOptions' => ['class' => 'd-none'],
                    'tableOptions' => ['class' => 'table align-middle gym-app-card-table', 'data-gym-table-ready' => '1'],
                    'rowOptions' => ['data-gym-record' => '1'],
                    'layout' => '{items}<div class="checkin-pager">{pager}</div>',
                    'emptyText' => Yii::t('app', 'checkin_no_records'),
                    'columns' => [
                        ['label' => Yii::t('app', 'checkin_member_label'), 'value' => static fn($row) => $row->client->full_name ?? $row->client_guid, 'contentOptions' => $column('checkin_member_label')],
                        ['label' => Yii::t('app', 'checkin_membership_label'), 'value' => static fn($row) => $row->membership->title ?? $row->membership_code, 'contentOptions' => $column('checkin_membership_label')],
                        ['attribute' => 'checkin_date', 'label' => Yii::t('app', 'checkin_action_in'), 'format' => ['datetime', 'php:d/m/Y H:i'], 'contentOptions' => $column('checkin_action_in')],
                        ['attribute' => 'checkout_date', 'label' => Yii::t('app', 'checkin_action_out'), 'format' => 'text', 'value' => static fn($row) => $row->checkout_date ? Yii::$app->formatter->asDatetime($row->checkout_date, 'php:d/m/Y H:i') : Yii::t('app', 'checkin_no_checkout'), 'contentOptions' => $column('checkin_action_out')],
                        ['attribute' => 'status', 'label' => Yii::t('app', 'checkin_status_label'), 'format' => 'raw', 'contentOptions' => $column('checkin_status_label'), 'value' => static function ($row) use ($icon) {
                            $out = $row->status === 'checked_out';
                            $key = ['checked_in' => 'checkin_status_in', 'checked_out' => 'checkin_status_out'][$row->status] ?? 'checkin_status_unknown';
                            return Html::tag('span', $icon($out ? 'exit' : 'entry') . Html::encode(Yii::t('app', $key)), ['class' => 'checkin-status' . ($out ? ' checkin-status-out' : '')]);
                        }],
                        ['label' => Yii::t('app', 'checkin_actions_label'), 'format' => 'raw', 'contentOptions' => ['class' => 'gym-app-actions'], 'value' => static fn($row) => $row->checkout_date || !$canCheckout ? '' : Html::a($icon('exit') . Html::encode(Yii::t('app', 'checkin_action_out')), ['checkout', 'id' => $row->id], ['class' => 'btn btn-outline-primary checkin-secondary', 'data-method' => 'post'])],
                    ],
                ]) ?>
            </div></section>
        </div>
        <?php endif; ?>
    </div>
</div>

<?php
$memberAutocompleteUrl = Json::htmlEncode(Url::to(['/gym-waitlist/member-autocomplete']));
$this->registerJs(<<<JS
(function () {
    const input = document.querySelector('[data-member-autocomplete]');
    const guid = document.querySelector('[data-member-guid]');
    const list = document.getElementById('gym-checkin-member-options');
    let options = [];
    let timer = null;

    function escapeAttr(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function syncGuid() {
        const selected = options.find((item) => item.label === input.value);
        if (guid) guid.value = selected ? selected.guid : '';
    }

    async function loadMembers() {
        const response = await fetch({$memberAutocompleteUrl} + '?' + new URLSearchParams({ q: input.value || '' }).toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const payload = await response.json();
        options = payload.results || [];
        list.innerHTML = options.map((item) => `<option value="\${escapeAttr(item.label)}"></option>`).join('');
        syncGuid();
    }

    input?.addEventListener('input', () => {
        if (guid) guid.value = '';
        window.clearTimeout(timer);
        timer = window.setTimeout(loadMembers, 220);
    });
    input?.addEventListener('change', syncGuid);
    input?.addEventListener('focus', () => { if (!options.length) loadMembers(); });
})();
JS);
?>
