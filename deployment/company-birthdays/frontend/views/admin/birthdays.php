<?php
use common\helpers\CompanyBirthdays;
use yii\helpers\Html;
use yii\helpers\Url;

$companyCode = Yii::$app->has('activeCompany') ? Yii::$app->activeCompany->getCompanyCode() : null;
$companyCode = $companyCode ?: (Yii::$app->user->identity->company_code ?? '');
$birthdayRows = CompanyBirthdays::rows((string)$companyCode, (int)(Yii::$app->user->id ?? 0));
$todayCount = count(array_filter($birthdayRows, static fn($row) => $row['today']));
$canOpenClient = !Yii::$app->user->isGuest && Yii::$app->user->identity->level !== 'client';
?>
<button type="button" class="btn header-item noti-icon waves-effect" id="page-header-notifications-dropdown"
    data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" title="<?= Html::encode(Yii::t('app', 'birthday_notifications')) ?>">
    <i class="bx bx-gift <?= $todayCount ? 'bx-tada' : '' ?>"></i>
    <?php if ($todayCount): ?><span class="badge bg-danger rounded-pill"><?= $todayCount ?></span><?php endif; ?>
</button>
<div class="px-0 dropdown-menu dropdown-menu-lg dropdown-menu-end p-0" aria-labelledby="page-header-notifications-dropdown">
    <div class="p-3"><h6 class="m-0"><?= Html::encode(Yii::t('app', 'birthday_notifications')) ?></h6></div>
    <div data-simplebar style="max-height: 300px;">
        <?php foreach ([true, false] as $today): ?>
            <?php $group = array_filter($birthdayRows, static fn($row) => $row['today'] === $today); ?>
            <?php if (!$group) continue; ?>
            <div class="dropdown-header fw-bold <?= $today ? 'text-success' : 'text-warning' ?> px-3">
                <?= Html::encode(Yii::t('app', $today ? 'birthdays_today' : 'upcoming_birthdays')) ?>
            </div>
            <?php foreach ($group as $row): ?>
                <a class="text-reset notification-item" data-birthday-today="<?= $today ? '1' : '0' ?>" data-birthday-self="<?= $row['isSelf'] ? '1' : '0' ?>"
                    href="<?= Html::encode($canOpenClient ? Url::toRoute(['/clients-list/view', 'id' => $row['id']]) : '#') ?>">
                    <div class="d-flex"><div class="flex-grow-1">
                        <h6 class="mb-1"><?= Html::encode($row['name']) ?></h6>
                        <?php if ($today && $row['isSelf']): ?>
                            <p class="mb-1 text-success fw-semibold">🎂 <?= Html::encode(Yii::t('app', str_starts_with(Yii::$app->language, 'pt') ? 'Parabéns, {name}!' : 'Happy birthday, {name}!', ['name' => $row['name']])) ?></p>
                        <?php else: ?>
                            <p class="mb-1 text-primary">🎂 <?= Html::encode(Yii::t('app', 'birthday')) ?></p>
                        <?php endif; ?>
                        <p class="mb-0 text-muted"><?= Html::encode($row['date']) ?></p>
                    </div></div>
                </a>
            <?php endforeach; ?>
        <?php endforeach; ?>
        <?php if (!$birthdayRows): ?><div class="p-3 text-muted"><?= Html::encode(Yii::t('app', 'no_messages')) ?></div><?php endif; ?>
    </div>
</div>
