<?php

use yii\helpers\Html;
use common\helpers\Helpers;

/** @var yii\web\View $this */
/** @var common\models\HotelOperations $model */

$this->title = Yii::t('app', 'task_operations');

$attributeValue = static function ($model, $attribute) {
    return $model->hasAttribute($attribute) ? $model->{$attribute} : null;
};

$priorityMap = [
    'low' => ['label' => Yii::t('app', 'low'), 'class' => 'text-bg-success', 'icon' => 'bx bx-chevron-down'],
    'medium' => ['label' => Yii::t('app', 'medium'), 'class' => 'text-bg-warning', 'icon' => 'bx bx-minus'],
    'high' => ['label' => Yii::t('app', 'high'), 'class' => 'text-bg-danger', 'icon' => 'bx bx-chevrons-up'],
];

$statusMap = [
    'open' => ['label' => Yii::t('app', 'open'), 'class' => 'text-bg-primary', 'icon' => 'bx bx-folder-open'],
    'pending' => ['label' => Yii::t('app', 'pending'), 'class' => 'text-bg-warning', 'icon' => 'bx bx-time-five'],
    'in_progress' => ['label' => Yii::t('app', 'in_progress'), 'class' => 'text-bg-info', 'icon' => 'bx bx-loader-circle'],
    'completed' => ['label' => Yii::t('app', 'completed'), 'class' => 'text-bg-success', 'icon' => 'bx bx-check-circle'],
    'inspected' => ['label' => Yii::t('app', 'inspected'), 'class' => 'text-bg-secondary', 'icon' => 'bx bx-search-alt'],
];

$priorityValue = (string)$attributeValue($model, 'priority');
$statusValue = (string)$attributeValue($model, 'status');
$priority = $priorityMap[$priorityValue] ?? ['label' => Yii::t('app', $priorityValue), 'class' => 'text-bg-secondary', 'icon' => 'bx bx-flag'];
$status = $statusMap[$statusValue] ?? ['label' => Yii::t('app', $statusValue), 'class' => 'text-bg-secondary', 'icon' => 'bx bx-info-circle'];
$assignedToValue = $attributeValue($model, 'assigned_to');
$reportedByValue = $attributeValue($model, 'reported_by');
$createdByValue = $attributeValue($model, 'created_by');
$updatedByValue = $attributeValue($model, 'updated_by');
$assignedTo = !empty($assignedToValue) ? (Helpers::getUsersFullNameAll($assignedToValue) ?: $assignedToValue) : '-';
$reportedBy = !empty($reportedByValue) ? (Helpers::getUsersFullNameAll($reportedByValue) ?: $reportedByValue) : '-';
$createdBy = !empty($createdByValue) ? (Helpers::getUsersFullNameAll($createdByValue) ?: $createdByValue) : '-';
$updatedBy = !empty($updatedByValue) ? (Helpers::getUsersFullNameAll($updatedByValue) ?: $updatedByValue) : '-';
$taskDateTime = trim((string)($attributeValue($model, 'task_date') ?: '') . ' ' . (string)($attributeValue($model, 'task_time') ?: ''));

$formatDate = static function ($value, $withTime = false, $withSeconds = false) {
    if (empty($value) || $value === '0000-00-00' || $value === '0000-00-00 00:00:00') {
        return '-';
    }

    $timestamp = strtotime((string)$value);
    if ($timestamp === false) {
        return (string)$value;
    }

    return date($withSeconds ? 'd/m/Y H:i:s' : ($withTime ? 'd/m/Y H:i' : 'd/m/Y'), $timestamp);
};

$detailItems = [
    ['icon' => 'bx bx-user-check', 'label' => Yii::t('app', 'assigned_to'), 'value' => $assignedTo],
    ['icon' => 'bx bx-calendar', 'label' => Yii::t('app', 'task_date'), 'value' => $taskDateTime !== '' ? $formatDate($taskDateTime, !empty($attributeValue($model, 'task_time'))) : '-'],
    ['icon' => 'bx bx-map', 'label' => Yii::t('app', 'room_location'), 'value' => $attributeValue($model, 'room_location') ?: '-'],
    ['icon' => 'bx bx-user', 'label' => Yii::t('app', 'guest_name'), 'value' => $attributeValue($model, 'guest_name') ?: '-'],
    ['icon' => 'bx bx-id-card', 'label' => Yii::t('app', 'reported_by'), 'value' => $reportedBy],
    ['icon' => 'bx bx-code-alt', 'label' => Yii::t('app', 'code'), 'value' => $attributeValue($model, 'operation_code') ?: ($attributeValue($model, 'guid') ?: '-')],
];

$metaItems = [
    Yii::t('app', 'company_code') => $attributeValue($model, 'company_code') ?: '-',
    Yii::t('app', 'created_date') => $formatDate($attributeValue($model, 'created_date'), true, true),
    Yii::t('app', 'updated_date') => $formatDate($attributeValue($model, 'updated_date'), true),
    Yii::t('app', 'resolved_date') => $formatDate($attributeValue($model, 'resolved_date'), true),
    Yii::t('app', 'created_by') => $createdBy,
    Yii::t('app', 'updated_by') => $updatedBy,
];

$this->registerCss(<<<CSS
.task-operation-view { background: #f8fafc; min-height: 100vh; }
.task-operation-view .task-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.2rem; background: #fff; border: 1px solid rgba(148,163,184,.16); }
.task-operation-view .task-header-main { display: flex; align-items: center; gap: 1rem; min-width: 0; }
.task-operation-view .task-icon { width: 58px; height: 58px; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; background: rgba(var(--sc-primary-rgb, 14, 128, 66), .12); color: var(--sc-primary, #0e8042); font-size: 1.65rem; }
.task-operation-view .task-heading { overflow-wrap: anywhere; }
.task-operation-view .task-pill { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; font-size: 12px; font-weight: 700; line-height: 1; padding: 8px 12px; background: #f1f5f9; color: #64748b; }
.task-operation-view .task-pill.text-bg-success { background: #ecfdf5 !important; color: #15803d !important; }
.task-operation-view .task-pill.text-bg-warning { background: #fff7ed !important; color: #b45309 !important; }
.task-operation-view .task-pill.text-bg-danger { background: #fef2f2 !important; color: #b91c1c !important; }
.task-operation-view .task-pill.text-bg-primary { background: rgba(var(--sc-primary-rgb, 14, 128, 66), .12) !important; color: var(--sc-primary, #0e8042) !important; }
.task-operation-view .task-pill.text-bg-info { background: #eff6ff !important; color: #1d4ed8 !important; }
.task-operation-view .task-actions p { display: flex; flex-wrap: wrap; gap: .375rem; margin: 0; }
.task-operation-view .task-actions p > span { display: none; }
.task-operation-view .task-actions .btn { margin: 0; }
.task-operation-view .task-card { background: #fff; border: 0; border-radius: 18px; box-shadow: 0 10px 30px rgba(15,23,42,.06); }
.task-operation-view .task-detail-grid { display: grid; gap: 12px; grid-template-columns: repeat(2,minmax(0,1fr)); }
.task-operation-view .task-detail-item { background: #f8fafc; border-radius: 14px; min-height: 74px; padding: 13px 14px; }
.task-operation-view .task-detail-item dt { color: #64748b; font-size: 12px; font-weight: 700; margin-bottom: 6px; }
.task-operation-view .task-detail-item dd { color: #0f172a; font-size: 14px; font-weight: 800; overflow-wrap: anywhere; margin: 0; }
.task-operation-view .task-section-icon { align-items: center; background: rgba(var(--sc-primary-rgb, 14, 128, 66), .12); border-radius: 14px; color: var(--sc-primary, #0e8042); display: inline-flex; flex: 0 0 auto; font-size: 1.4rem; height: 44px; justify-content: center; width: 44px; }
.task-operation-view .task-text-block { white-space: pre-wrap; overflow-wrap: anywhere; color: #334155; line-height: 1.65; }
.task-operation-view .task-meta-grid { grid-template-columns: 1fr; }
@media (max-width: 767.98px) {
    .task-operation-view .task-header { align-items: stretch; flex-direction: column; }
    .task-operation-view .task-actions p { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); width: 100%; }
    .task-operation-view .task-actions > div, .task-operation-view .task-actions .btn { width: 100%; }
    .task-operation-view .task-actions .btn { justify-content: center; }
    .task-operation-view .task-detail-grid { grid-template-columns: 1fr; }
}
CSS);
?>

<?= Helpers::displayAminBreadcrumbs('team', 'task_operations', ['task_operations']) ?>

<div class="task-operation-view container-fluid py-4">
    <section class="task-header shadow-sm rounded-4 mb-4">
        <div class="task-header-main">
            <span class="task-icon"><i class="bx bx-task" aria-hidden="true"></i></span>
            <div class="min-w-0">
                <div class="text-uppercase small fw-bold text-muted mb-1"><?= Html::encode(Yii::t('app', 'task_operations')) ?></div>
                <h1 class="task-heading h3 fw-bold mb-2"><?= Html::encode($attributeValue($model, 'title') ?: Yii::t('app', 'details')) ?></h1>
                <div class="d-flex flex-wrap gap-2">
                    <span class="task-pill <?= Html::encode($priority['class']) ?>"><i class="<?= Html::encode($priority['icon']) ?>" aria-hidden="true"></i><?= Html::encode($priority['label']) ?></span>
                    <span class="task-pill <?= Html::encode($status['class']) ?>"><i class="<?= Html::encode($status['icon']) ?>" aria-hidden="true"></i><?= Html::encode($status['label']) ?></span>
                </div>
            </div>
        </div>
        <div class="task-actions"><?= Helpers::displayButtonsView($model); ?></div>
    </section>

    <div class="row g-4">
        <div class="col-12 col-xl-8">
            <div class="row g-4">
                <div class="col-12">
                    <section class="task-card rounded-4 shadow-sm p-4">
                        <div class="d-flex align-items-center gap-3 mb-3">
                            <span class="task-section-icon"><i class="bx bx-detail" aria-hidden="true"></i></span>
                            <h2 class="h5 fw-bold mb-0"><?= Html::encode(Yii::t('app', 'details')) ?></h2>
                        </div>
                        <dl class="task-detail-grid mb-0">
                            <?php foreach ($detailItems as $item): ?>
                                <div class="task-detail-item">
                                    <dt><?= Html::encode($item['label']) ?></dt>
                                    <dd><?= Html::encode((string)$item['value']) ?></dd>
                                </div>
                            <?php endforeach; ?>
                        </dl>
                    </section>
                </div>
                <div class="col-12">
                    <section class="task-card rounded-4 shadow-sm p-4">
                        <div class="d-flex align-items-center gap-3 mb-3">
                            <span class="task-section-icon"><i class="bx bx-note" aria-hidden="true"></i></span>
                            <h2 class="h5 fw-bold mb-0"><?= Html::encode(Yii::t('app', 'notes')) ?></h2>
                        </div>
                        <div class="task-text-block"><?= Html::encode($attributeValue($model, 'notes') ?: $attributeValue($model, 'description') ?: Yii::t('app', 'no_messages')) ?></div>
                    </section>
                </div>
            </div>
        </div>
        <aside class="col-12 col-xl-4">
            <section class="task-card rounded-4 shadow-sm p-4">
                <div class="d-flex align-items-center gap-3 mb-3">
                    <span class="task-section-icon"><i class="bx bx-history" aria-hidden="true"></i></span>
                    <h2 class="h5 fw-bold mb-0"><?= Html::encode(Yii::t('app', 'task_ui_history')) ?></h2>
                </div>
                <dl class="task-detail-grid task-meta-grid mb-0">
                    <?php foreach ($metaItems as $label => $value): ?>
                        <div class="task-detail-item">
                            <dt><?= Html::encode($label) ?></dt>
                            <dd><?= Html::encode((string)$value) ?></dd>
                        </div>
                    <?php endforeach; ?>
                </dl>
            </section>
        </aside>
    </div>
</div>
