<?php

use common\helpers\Helpers;
use yii\grid\GridView;
use yii\helpers\Html;
use yii\helpers\Json;
use yii\helpers\Url;
use yii\widgets\ActiveForm;

/** @var yii\web\View $this */
/** @var common\models\GymCheckinSearch $searchModel */
/** @var yii\data\ActiveDataProvider $dataProvider */
/** @var common\models\GymCheckin $model */

$this->title = Yii::t('app', 'gym_checkin');
?>

<?= Helpers::displayAminBreadcrumbs('members', 'gym_checkin', ['gym-checkin']) ?>

<div class="container-fluid py-4">
    <div class="d-flex flex-column flex-xl-row gap-4">
        <div class="col-xl-4">
            <div class="card border-0 shadow-sm rounded-4">
                <div class="card-body p-4">
                    <div class="d-flex align-items-center gap-3 mb-3">
                        <div class="rounded-4 bg-primary text-white d-grid place-items-center" style="width:52px;height:52px;"><i class="bx bx-qr-scan fs-3"></i></div>
                        <div><h1 class="h4 fw-bold mb-0"><?= Html::encode(Yii::t('app', 'member_checkin')) ?></h1><div class="text-muted"><?= Html::encode(Yii::t('app', 'validate_membership_before_access')) ?></div></div>
                    </div>
                    <?php if (!empty($scannedMember)): ?>
                        <p class="fw-semibold"><?= Html::encode($scannedMember->full_name ?: $scannedMember->username) ?></p>
                    <?php endif; ?>
                    <?php $form = ActiveForm::begin(); ?>
                        <?= $form->field($model, 'client_guid')->textInput(['class' => 'form-control rounded-4', 'readonly' => !empty($scannedMember)]) ?>
                        <?= $form->field($model, 'notes')->textarea(['rows' => 3, 'class' => 'form-control rounded-4', 'value' => '']) ?>
                        <button class="btn btn-success rounded-4 w-100" type="submit"><i class="bx bx-log-in-circle"></i> <?= Html::encode(Yii::t('app', 'check_in')) ?></button>
                    <?php ActiveForm::end(); ?>
                </div>
            </div>
        </div>
        <div class="flex-fill">
            <div class="card border-0 shadow-sm rounded-4 mb-4"><div class="card-body">
                <?php $filter = ActiveForm::begin(['method' => 'get', 'action' => ['index'], 'options' => ['class' => 'row g-3 align-items-end']]); ?>
                <div class="col-md-5">
                    <?= $filter->field($searchModel, 'q')->textInput(['class' => 'form-control rounded-4', 'autocomplete' => 'off', 'list' => 'gym-checkin-member-options', 'data-member-autocomplete' => 1, 'value' => ''])->label(Yii::t('app', 'search')) ?>
                    <?= Html::activeHiddenInput($searchModel, 'client_guid', ['data-member-guid' => 1, 'value' => '']) ?>
                    <datalist id="gym-checkin-member-options"></datalist>
                </div>
                <div class="col-md-3"><?= $filter->field($searchModel, 'date_from')->input('date', ['class' => 'form-control rounded-4', 'value' => ''])->label(Yii::t('app', 'date_from')) ?></div>
                <div class="col-md-3"><?= $filter->field($searchModel, 'date_to')->input('date', ['class' => 'form-control rounded-4', 'value' => ''])->label(Yii::t('app', 'date_to')) ?></div>
                <div class="col-md-1"><button class="btn btn-primary rounded-4 w-100"><i class="bx bx-search"></i></button></div>
                <?php ActiveForm::end(); ?>
            </div></div>
            <div class="card border-0 shadow-sm rounded-4 overflow-hidden"><div class="card-body p-0">
                <?= GridView::widget([
                    'dataProvider' => $dataProvider,
                    'filterModel' => $searchModel,
                    'filterRowOptions' => ['class' => 'd-none'],
                    'tableOptions' => ['class' => 'table align-middle mb-0'],
                    'layout' => '{items}<div class="px-4 py-3">{pager}</div>',
                    'columns' => [
                        ['label' => Yii::t('app', 'client'), 'value' => static fn($row) => $row->client->full_name ?? $row->client_guid],
                        ['label' => Yii::t('app', 'membership'), 'value' => static fn($row) => $row->membership->title ?? $row->membership_code],
                        'checkin_date',
                        'checkout_date',
                        'status',
                        ['format' => 'raw', 'value' => static fn($row) => $row->checkout_date ? '' : Html::a(Yii::t('app', 'check_out'), ['checkout', 'id' => $row->id], ['class' => 'btn btn-sm btn-outline-primary rounded-4', 'data-method' => 'post'])],
                    ],
                ]) ?>
            </div></div>
        </div>
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
