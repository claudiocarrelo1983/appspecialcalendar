<?php

use common\helpers\Helpers;
use yii\helpers\Html;
use yii\helpers\Json;
use yii\helpers\Url;

/** @var yii\web\View $this */
/** @var common\models\User $model */

$this->title = Yii::t('app', 'clients_list');
\yii\web\YiiAsset::register($this);

$isGymPlan = $isGymPlan ?? false;
$allowedTabs = $isGymPlan
    ? ['home', 'debts', 'memberships', 'attendance', 'personal-classes', 'performance']
    : ['home', 'sheddule', 'package', 'points', 'debts', 'attendance', 'personal-classes', 'performance'];
$allowedTabs = array_values(array_unique($allowedTabs));
$tab = Yii::$app->request->get('tab', 'home');

if (!in_array($tab, $allowedTabs, true)) {
    $tab = 'home';
}
?>

<?= Helpers::displayAminBreadcrumbs('clients', 'clients_list', ['clients_list']) ?>
<div class="gym-app-record-view">
<?php if ($isGymPlan): ?>
    <?= $this->render('_qr-checkin-action', ['model' => $model]) ?>
<?php endif; ?>
<div class="gym-app-record-actions"><?= Helpers::displayButtonsView($model) ?></div>

<div id="topbar-debt">
    <?= $this->render('topbar-debt', [
        'model' => $model,
    ]) ?>
</div>

<div class="row">
    <div class="col-xl-12">
        <ul class="nav nav-tabs nav-tabs-custom card-header-tabs ms-auto ob-5 pt-4 client-view-tabs" role="tablist">
            <li class="nav-item d-flex justify-content-center">
                <a class="nav-link <?= ($tab === 'home' ? 'active' : '') ?>" data-bs-toggle="tab" href="#home">
                    <?= Yii::t('app', 'client_information') ?>
                </a>
            </li>

            <?php if (!$isGymPlan): ?>
                <li class="nav-item d-flex justify-content-center">
                    <a class="nav-link <?= ($tab === 'sheddule' ? 'active' : '') ?>" data-bs-toggle="tab" href="#sheddule">
                        <?= Yii::t('app', 'bookings') ?>
                    </a>
                </li>

                <li class="nav-item d-flex justify-content-center">
                    <a class="nav-link <?= ($tab === 'package' ? 'active' : '') ?>" data-bs-toggle="tab" href="#package">
                        <?= Yii::t('app', 'menu_packages') ?>
                    </a>
                </li>

                <li class="nav-item d-flex justify-content-center">
                    <a class="nav-link <?= ($tab === 'points' ? 'active' : '') ?>" data-bs-toggle="tab" href="#points">
                        <?= Yii::t('app', 'points') ?>
                    </a>
                </li>
            <?php endif; ?>

            <li class="nav-item d-flex justify-content-center">
                <a class="nav-link <?= ($tab === 'debts' ? 'active' : '') ?>" data-bs-toggle="tab" href="#debts">
                    <?= Yii::t('app', 'debts') ?>
                </a>
            </li>

            <?php if ($isGymPlan): ?>
                <li class="nav-item d-flex justify-content-center">
                    <a class="nav-link <?= ($tab === 'memberships' ? 'active' : '') ?>" data-bs-toggle="tab" href="#memberships">
                        <?= Yii::t('app', 'memberships') ?>
                    </a>
                </li>
            <?php endif; ?>

            <li class="nav-item d-flex justify-content-center">
                <a class="nav-link <?= ($tab === 'attendance' ? 'active' : '') ?>" data-bs-toggle="tab" href="#attendance">
                    <?= Yii::t('app', 'attendance') ?>
                </a>
            </li>

            <li class="nav-item d-flex justify-content-center">
                <a class="nav-link <?= ($tab === 'personal-classes' ? 'active' : '') ?>" data-bs-toggle="tab" href="#personal-classes">
                    <?= Yii::t('app', 'personal_classes') ?>
                </a>
            </li>

            <li class="nav-item d-flex justify-content-center">
                <a class="nav-link <?= ($tab === 'performance' ? 'active' : '') ?>" data-bs-toggle="tab" href="#performance">
                    <?= Yii::t('app', 'performance') ?>
                </a>
            </li>
        </ul>

        <div class="tab-content mt-5 text-muted">
            <div class="tab-pane <?= ($tab === 'home' ? 'active show' : '') ?>" id="home">
                <?= $this->render('info', [
                    'model' => $model,
                ]) ?>
            </div>

            <?php if (!$isGymPlan): ?>
                <div class="tab-pane <?= ($tab === 'sheddule' ? 'active show' : '') ?>" id="sheddule">
                    <?= $this->render('sheddule', [
                        'dataProvider' => $dataProvider,
                    ]) ?>
                </div>

                <div class="tab-pane <?= ($tab === 'package' ? 'active show' : '') ?>" id="package">
                    <?= $this->render('packages', [
                        'packagesArr' => $packagesArr,
                    ]) ?>
                </div>

                <div class="tab-pane <?= ($tab === 'points' ? 'active show' : '') ?>" id="points">
                    <div id="loyalty-card-block">
                        <?= $this->render('points', [
                            'pointsSetup' => $pointsSetup,
                            'pointsArr' => $pointsArr,
                            'model' => $model,
                        ]) ?>
                    </div>
                </div>
            <?php endif; ?>

            <div class="tab-pane <?= ($tab === 'debts' ? 'active show' : '') ?>" id="debts">
                <div class="d-flex justify-content-end mb-3">
                    <button type="button" class="btn btn-primary-modern rounded-4 d-inline-flex align-items-center gap-2" data-client-debt-form>
                        <i class="bx bx-plus"></i><?= Html::encode(Yii::t('app', 'debts_create')) ?>
                    </button>
                </div>
                <div id="debt-block">
                    <?= $this->render('debts', [
                        'modelUser' => $model,
                        'dataProvider' => $dataProviderDept,
                        'modelDebtHistoryForm' => $modelDebtHistoryForm,
                    ]) ?>
                </div>
            </div>

            <?php if ($isGymPlan): ?>
                <div class="tab-pane <?= ($tab === 'memberships' ? 'active show' : '') ?>" id="memberships">
                    <div id="client-membership-block">
                        <?= $this->render('memberships', [
                            'model' => $model,
                            'dataProvider' => $dataProviderMembership,
                            'paymentTracker' => $membershipPaymentTracker,
                            'familyDetails' => $membershipFamilyDetails,
                        ]) ?>
                    </div>
                </div>
            <?php endif; ?>

            <div class="tab-pane <?= ($tab === 'attendance' ? 'active show' : '') ?>" id="attendance">
                <div id="client-attendance-block">
                    <?= $this->render('attendance', [
                        'model' => $model,
                        'attendanceSummary' => $attendanceSummary,
                        'dataProviderAttendance' => $dataProviderAttendance,
                        'dataProviderGymAccessAttendance' => $dataProviderGymAccessAttendance,
                        'dataProviderClassAttendance' => $dataProviderClassAttendance,
                    ]) ?>
                </div>
            </div>

            <div class="tab-pane <?= ($tab === 'personal-classes' ? 'active show' : '') ?>" id="personal-classes">
                <div id="client-personal-class-block">
                    <?= $this->render('personal-classes', [
                        'model' => $model,
                        'dataProvider' => $dataProviderPersonalClasses,
                    ]) ?>
                </div>
            </div>

            <div class="tab-pane <?= ($tab === 'performance' ? 'active show' : '') ?>" id="performance">
                <div id="client-performance-block">
                    <?= $this->render('performance', [
                        'model' => $model,
                        'dataProviderProgressPhotos' => $dataProviderProgressPhotos,
                        'dataProviderBodyMeasurements' => $dataProviderBodyMeasurements,
                        'dataProviderFitnessAssessments' => $dataProviderFitnessAssessments,
                    ]) ?>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="clientGenericModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content rounded-4 border-0 shadow-sm">
            <div class="modal-header border-0 pb-0">
                <h5 class="modal-title fw-bold" id="clientGenericModalTitle"><?= Html::encode(Yii::t('app', 'loading')) ?></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?= Html::encode(Yii::t('app', 'close')) ?>"></button>
            </div>
            <div class="modal-body" id="clientGenericModalBody">
                <div class="text-center text-muted py-4"><?= Html::encode(Yii::t('app', 'loading')) ?></div>
            </div>
        </div>
    </div>
</div>

</div>
<?= $this->render('_view_scripts', ['model' => $model]) ?>
