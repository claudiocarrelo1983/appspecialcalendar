<?php

use yii\helpers\Html;

/** @var string $date */
/** @var array $week */
/** @var array $filters */
/** @var array $options */
/** @var array $clientOptions */
/** @var bool $embedded */

$embedded = $embedded ?? false;
$monday = date('Y-m-d', strtotime('monday this week', strtotime($date)));
$sunday = date('Y-m-d', strtotime($monday . ' +6 days'));
$previousWeek = date('Y-m-d', strtotime($monday . ' -7 days'));
$nextWeek = date('Y-m-d', strtotime($monday . ' +7 days'));



?>
<div class="<?= $embedded ? '' : 'classes-schedule-page p-3 p-lg-4' ?>">
    <?php if (!$embedded): ?>
        <div class="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-4">
            <div>
                <h1 class="h3 fw-bold mb-1"><?= Html::encode(Yii::t('app', 'weekly_timetable')) ?></h1>
                <div class="text-muted"><?= Html::encode(Yii::$app->formatter->asDate($monday, 'php:d/m/Y')) ?> - <?= Html::encode(Yii::$app->formatter->asDate($sunday, 'php:d/m/Y')) ?></div>
            </div>
            <div class="d-flex flex-wrap gap-2 justify-content-end">
                <?= Html::a('<i class="bx bx-chevron-left"></i>', ['classes-schedule/week', 'date' => $previousWeek], ['class' => 'btn btn-reset-modern rounded-4', 'title' => 'Previous week', 'aria-label' => 'Previous week']) ?>
                <?= Html::a('<i class="bx bx-chevron-right"></i>', ['classes-schedule/week', 'date' => $nextWeek], ['class' => 'btn btn-reset-modern rounded-4', 'title' => 'Next week', 'aria-label' => 'Next week']) ?>
                <?= $this->render('_view_actions', ['date' => $date, 'active' => 'week']) ?>
            </div>
        </div>
        <?= $this->render('_filters', ['filters' => $filters, 'options' => $options]) ?>
    <?php else: ?>
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
            <div class="fw-semibold"><?= Html::encode(Yii::$app->formatter->asDate($monday, 'php:d/m/Y')) ?> - <?= Html::encode(Yii::$app->formatter->asDate($sunday, 'php:d/m/Y')) ?></div>
            <div class="d-flex flex-wrap gap-2 justify-content-end">
                <div class="btn-group gym-schedule-week-nav" role="group" aria-label="<?= Html::encode(Yii::t('app', 'gym_schedule_week_label')) ?>">
                    <?= Html::a('<i class="bx bx-chevron-left"></i>', ['classes-schedule/index', 'date' => $previousWeek], ['class' => 'btn btn-reset-modern rounded-start-4', 'title' => 'Previous week', 'aria-label' => 'Previous week']) ?>
                    <?= Html::a(Html::encode(Yii::t('app', 'gym_schedule_week_label')), ['classes-schedule/index', 'date' => $date], ['class' => 'btn btn-reset-modern gym-schedule-week-label', 'title' => Yii::t('app', 'week'), 'aria-label' => Yii::t('app', 'week')]) ?>
                    <?= Html::a('<i class="bx bx-chevron-right"></i>', ['classes-schedule/index', 'date' => $nextWeek], ['class' => 'btn btn-reset-modern rounded-end-4', 'title' => 'Next week', 'aria-label' => 'Next week']) ?>
                </div>
                <?php if (Yii::$app->user->identity->level !== 'client'): ?>
                    <?= Html::a('<i class="bx bx-plus"></i>' . Html::encode(Yii::t('app', 'create_gym_class')), ['gym-classes/create'], ['class' => 'btn btn-primary-modern rounded-4 d-inline-flex align-items-center gap-2']) ?>
                <?php endif; ?>
            </div>
        </div>
    <?php endif; ?>
    <div class="weekly-planner-scroll">
        <div class="weekly-planner-grid">
        <?php foreach ($week as $day => $items): ?>
            <div class="weekly-day-column card border-0 shadow-sm rounded-4">
                <div class="card-body p-3 d-flex flex-column">
                    <div class="h6 fw-bold mb-3"><?= Html::encode(Yii::$app->formatter->asDate($day, 'php:D d/m')) ?></div>
                    <div class="weekly-day-stack d-flex flex-column gap-3 flex-grow-1">
                    <?php foreach ($items as $item): ?>
                        <?= $this->render('_week_class_card', ['item' => $item]) ?>
                    <?php endforeach; ?>
                    <?php if (empty($items)): ?>
                        <div class="weekly-empty-state border rounded-4 d-flex flex-column align-items-center justify-content-center text-muted">
                            <i class="bx bx-calendar fs-2 mb-2"></i>
                            <span><?= Html::encode(Yii::t('app', 'no_classes')) ?></span>
                        </div>
                    <?php endif; ?>
                    <?php if (Yii::$app->user->identity->level !== 'client'): ?>
                        <?= Html::a('<i class="bx bx-plus fs-4"></i><span>' . Html::encode(Yii::t('app', 'add_class')) . '</span>', ['gym-classes/create', 'date' => $day], ['class' => 'weekly-add-class border rounded-4 d-flex flex-column align-items-center justify-content-center text-muted text-decoration-none']) ?>
                    <?php endif; ?>
                    </div>
                </div>
            </div>
        <?php endforeach; ?>
        </div>
    </div>
</div>
<?= $this->render('_description_autosave') ?>
<style>
.classes-schedule-page{min-height:100vh}
.weekly-planner-scroll{overflow-x:auto;padding-bottom:4px}
.weekly-planner-grid{display:grid;gap:4px;grid-template-columns:repeat(7,minmax(210px,1fr));min-width:1470px}
.weekly-day-column{min-height:650px}
.weekly-class-card{min-height:150px}
.weekly-empty-state{border-style:dashed!important;min-height:360px}
.weekly-add-class{border-style:dashed!important;min-height:145px;transition:background-color .15s ease,border-color .15s ease,color .15s ease}
.weekly-add-class:hover{background:#f8fafc;border-color:#94a3b8!important;color:#334155!important}
@media (max-width: 991.98px){
    .weekly-planner-grid{grid-template-columns:repeat(7,minmax(240px,260px));min-width:max-content}
    .weekly-day-column{min-height:560px}
}
</style>
