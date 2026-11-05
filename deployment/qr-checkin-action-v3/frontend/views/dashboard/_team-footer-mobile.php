<?php

use common\helpers\PermissionsHelpers;
use yii\helpers\Html;

/** @var callable $canAccess */
$middleLinks = [];
$menu = PermissionsHelpers::getSidebarMenu()['left-menu'] ?? [];
$role = 'team';
$labels = [
    't-members-list' => 'clients',
    't-members-memberships' => 'memberships',
    't-classes-gym-classes' => 'classes',
];
$icons = [
    't-members-list' => 'bx bx-group',
    't-members-memberships' => 'bx bx-id-card',
    't-members-attendance' => 'bx bx-check-square',
    't-members-waivers' => 'bx bx-file',
    't-members-debts' => 'bx bx-wallet',
    't-classes-schedule' => 'bx bx-calendar',
    't-classes-gym-classes' => 'bx bx-dumbbell',
    't-members-personal-classes' => 'bx bx-package',
    't-coaches-list' => 'bx bx-user-voice',
    't-coaches-tasks' => 'bx bx-task',
    't-coaches-vacations' => 'bx bx-sun',
    't-coaches-permissions' => 'bx bx-shield',
];
$iconName = static function ($icon) {
    return preg_match('/\b(?:bx|bxs|bxl)-[a-z0-9-]+\b/', $icon, $match) ? $match[0] : trim($icon);
};
// Reserve the fixed end icons and avoid shared parent icons in the middle.
$usedIcons = ['bx-home-circle' => true, 'bx-user-circle' => true];
$fallbackIcons = ['bx bx-grid-alt', 'bx bx-list-ul', 'bx bx-calendar', 'bx bx-briefcase'];
foreach ($menu as $section) {
    foreach (!empty($section['submenu']) ? $section['submenu'] : [$section] as $link) {
        $key = $link['key'] ?? '';
        $url = $link['url'] ?? '';
        if (strpos($key, 't-dashboard') === 0 || !$canAccess($key)
            || (isset($link['roles']) && !in_array($role, $link['roles'], true))
            || !is_string($url) || $url === '' || $url === 'null') {
            continue;
        }
        $url = '/' . ltrim($url, './');
        if ($url === '/profile' || isset($middleLinks[$url])) {
            continue;
        }
        $icon = $icons[$key] ?? $link['icon'] ?? $section['icon'] ?? 'bx bx-grid-alt';
        if (isset($usedIcons[$iconName($icon)])) {
            foreach ($fallbackIcons as $fallbackIcon) {
                if (!isset($usedIcons[$iconName($fallbackIcon)])) {
                    $icon = $fallbackIcon;
                    break;
                }
            }
        }
        $usedIcons[$iconName($icon)] = true;
        $middleLinks[$url] = [
            'url' => $url,
            'label' => $labels[$key] ?? $link['title'],
            'icon' => $icon,
        ];
        if (count($middleLinks) === 2) {
            break 2;
        }
    }
}
$links = array_merge([
    ['url' => '/dashboard-gym', 'label' => 'dashboard', 'icon' => 'bx bx-home-circle'],
], array_values($middleLinks), [
    ['url' => '/profile', 'label' => 'profile', 'icon' => 'bx bx-user-circle'],
]);
$currentController = Yii::$app->controller->id;
?>
<div class="d-block d-lg-none">
    <nav class="mobile-bottom-nav d-flex justify-content-evenly align-items-center">
        <?php if (!empty($canScan)): ?>
            <button type="button" class="btn nav-item team-qr-scan-button" data-bs-toggle="modal" data-bs-target="#gymMemberQrScanner">
                <div><i class="bx bx-qr-scan text-10" aria-hidden="true"></i></div>
                <div class="text-1"><?= Html::encode(Yii::t('app', 'gym_qr_read')) ?></div>
            </button>
        <?php endif; ?>
        <?php foreach ($links as $link): ?>
            <?php $active = trim(explode('/', ltrim($link['url'], '/'))[0]) === $currentController; ?>
            <?= Html::a(
                '<div class="nav-item' . ($active ? ' active' : '') . '">'
                . '<div><i class="text-10 ' . Html::encode($link['icon']) . '" aria-hidden="true"></i></div>'
                . '<div class="text-1">' . Html::encode(Yii::t('app', $link['label'])) . '</div></div>',
                $link['url'],
                $active ? ['aria-current' => 'page'] : []
            ) ?>
        <?php endforeach; ?>
    </nav>
</div>
