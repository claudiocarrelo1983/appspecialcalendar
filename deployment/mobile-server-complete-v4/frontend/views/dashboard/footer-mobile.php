<?php

    use yii\helpers\Html;
    use yii\helpers\Json;
    use common\helpers\Helpers;

    $userAgent = Helpers::getUserAgent(); 

    /*
    <div style="height: <?= (($userAgent == '-mobile') ? '120px' : '0px') ?>"></div>
    */

    $choice = Helpers::choiceActiveFooter();

    $arrCompanyPlan = Helpers::arrCompanyPlan(
        [
            'company_code' => Yii::$app->user->identity->company_code
        ]);

    $planName = $arrCompanyPlan['plan_name'] ?? 'default';
    $isCleaner = !Yii::$app->user->isGuest && Yii::$app->user->identity->level === 'cleaner';
    $gymMobileBlockedMessage = Yii::t('app', 'permission_denied');
    $gymMobileCompanyCode = Yii::$app->has('activeCompany') ? Yii::$app->activeCompany->getCompanyCode() : Yii::$app->user->identity->company_code;
    $gymMobileCompanyCode = $gymMobileCompanyCode ?: Yii::$app->user->identity->company_code;
    $gymMobileMembership = Yii::$app->has('activeCompany') ? Yii::$app->activeCompany->getMembership() : null;
    $gymMobileLevel = $gymMobileMembership->role ?? Yii::$app->user->identity->level;
    $gymMobileTeamRestricted = $gymMobileLevel === 'team';
    $gymMobileCompany = Helpers::getCurrenctCompany();
    $gymMobilePermissions = Yii::$app->user->isGuest ? [] : Helpers::getUserRolesPermissions([
        'company_code' => $gymMobileCompanyCode,
        'level' => $gymMobileLevel,
    ]);
    if ($gymMobileTeamRestricted) {
        $gymMobilePermissions = array_map('trim', $gymMobilePermissions);
    }
    $gymMobileCanAccess = static function ($permissionKey, $crud = null) use ($gymMobilePermissions, $gymMobileCompanyCode, $gymMobileLevel, $gymMobileCompany, $gymMobileTeamRestricted): bool {
        if (Yii::$app->user->isGuest || strpos((string) $permissionKey, 't-dashboard') === 0) {
            return true;
        }

        if (($gymMobileTeamRestricted || !empty($gymMobilePermissions)) && !in_array($permissionKey, $gymMobilePermissions, true)) {
            return false;
        }

        if ($crud === null) {
            if (!$gymMobileTeamRestricted) {
                return true;
            }
            $crud = 'view';
        }

        $crudRow = (new \yii\db\Query())
            ->select([$crud])
            ->from('user_roles_permissions_crud')
            ->where([
                'company_code' => $gymMobileCompanyCode,
                'company' => $gymMobileCompany,
                'level' => $gymMobileLevel,
                'page' => $permissionKey,
            ])
            ->one();

        return empty($crudRow) ? true : (bool)($crudRow[$crud] ?? false);
    };
    $gymMobileLink = static function ($content, $route, $permissionKey, array $options = [], $crud = null) use ($gymMobileCanAccess, $gymMobileBlockedMessage, $gymMobileTeamRestricted) {
        $allowed = $gymMobileCanAccess($permissionKey, $crud);
        if ($gymMobileTeamRestricted && !$allowed) {
            return '';
        }
        if (!$allowed) {
            $options['data-permission-blocked'] = '1';
            $options['data-message'] = $gymMobileBlockedMessage;
        }

        return Html::a($content, $allowed ? $route : '#', $options);
    };

    $this->registerJs('
        document.addEventListener("click", function(event) {
            const link = event.target.closest("a[data-permission-blocked=\"1\"]");
            if (!link) {
                return;
            }
            event.preventDefault();
            const message = link.getAttribute("data-message") || '.Json::htmlEncode($gymMobileBlockedMessage).';
            if (window.Swal && typeof window.Swal.fire === "function") {
                window.Swal.fire({
                    icon: "warning",
                    text: message,
                    confirmButtonText: "OK"
                });
                return;
            }
            window.alert(message);
        });
    ');

?>
<?php switch ($planName):
    case 'hotel': ?>

  <div class="d-block d-lg-none">
        <!-- Bottom Navigation -->
        <div class="mobile-bottom-nav d-flex justify-content-evenly align-items-center<?= $isCleaner ? ' d-none' : '' ?>">

            <?= Html::a(
                '<div class="nav-item '. (isset($choice) ? (($choice == 'messages') ? 'active' : '') : '') .'">
                    <div>
                        <i class="text-10 bx bx-message-rounded-dots"></i>
                    </div>
                    <div class="text-1">'.Yii::t('app', 'messages').'
                    </div>    
                </div>',
                ['/dashboard']
            ); ?> 

            <div class="nav-item">            
                <div  id="fabBtn" class="center-btn text-12">
                    <i class="bx bx-detail"></i>
                </div>
            </div>
        
            <?= Html::a(
                '<div class="nav-item '. (isset($choice) ? (($choice == 'clock') ? 'active' : '') : '') .'">
                    <div>
                        <i class="text-10 bx bx-time"></i>
                    </div>
                    <div class="text-1">'.Yii::t('app', 'clock').'
                    </div>    
                </div>',
                ['/profile']
            ); ?> 

        </div>
        <!-- Add spacing so content doesn't hide -->
    
    </div>

<?php break;
    case 'gym': ?>

    <?php  if(Yii::$app->user->identity->level == 'client'){ ?>

        <div class="d-block d-lg-none">
            <!-- Bottom Navigation -->
            <div class="mobile-bottom-nav d-flex justify-content-evenly align-items-center">

                <?= Html::a(
                    '<div class="nav-item '. (isset($choice) ? (($choice == 'gym_dashboard') ? 'active' : '') : '') .'">
                        <div>
                            <i class="text-10 bx bx-home-circle"></i>
                        </div>
                        <div class="text-1">'.Yii::t('app', 'dashboard').'
                        </div>
                    </div>',
                    ['/dashboard-gym-client']
                ); ?>

                <?= Html::a(
                    '<div class="nav-item '. (isset($choice) ? (($choice == 'gym_packages') ? 'active' : '') : '') .'">
                        <div>
                            <i class="text-10 bx bx-package"></i>
                        </div>
                        <div class="text-1">'.Yii::t('app', 'packages').'
                        </div>
                    </div>',
                    ['/personal-classes/client-index']
                ); ?>
                <?php $isClientPerformanceActive = in_array(Yii::$app->controller->id, [
                    'performance-dashboard-client', 'fitness-assessments-client', 'body-measurements-client',
                    'personal-records-client', 'progress-photos-client', 'fitness-goals-client', 'performance-reports-client',
                ], true); ?>
                <?= Html::a(
                    '<div class="nav-item ' . ($isClientPerformanceActive ? 'active' : '') . '">
                        <div>
                            <i class="text-10 bx bx-line-chart" aria-hidden="true"></i>
                        </div>
                        <div class="text-1">' . Html::encode(Yii::t('app', 'performance')) . '</div>
                    </div>',
                    ['/performance-dashboard-client'],
                    $isClientPerformanceActive ? ['aria-current' => 'page'] : []
                ); ?>


                <?= Html::a(
                    '<div class="nav-item '. (isset($choice) ? (($choice == 'settings') ? 'active' : '') : '') .'">
                        <div>
                            <i class="text-10 bx bx-user-circle"></i>
                        </div>
                        <div class="text-1">'.Yii::t('app', 'profile').'
                        </div>
                    </div>',
                    ['/profile']
                ); ?>

            </div>
        </div>

    <?php } elseif ($gymMobileTeamRestricted) { ?>

        <?= $this->render('_team-footer-mobile', ['canAccess' => $gymMobileCanAccess, 'canScan' => \common\helpers\GymMemberQrAccess::canScan()]) ?>

    <?php }else{ ?>

        <div class="d-block d-lg-none">
            <!-- Bottom Navigation -->
            <div class="mobile-bottom-nav d-flex justify-content-evenly align-items-center">

                <?= $gymMobileLink(
                    '<div class="nav-item '. (isset($choice) ? (($choice == 'gym_dashboard') ? 'active' : '') : '') .'">
                        <div>
                            <i class="text-10 bx bx-home-circle"></i>
                        </div>
                        <div class="text-1">'.Yii::t('app', 'dashboard').'
                        </div>
                    </div>',
                    ['/dashboard-gym'],
                    't-dashboard-gym'
                ); ?>

                <?= $gymMobileLink(
                    '<div class="nav-item '. (in_array($choice, ['clients', 'gym_members'], true) ? 'active' : '') .'">
                        <div>
                            <i class="text-10 bx bx-group"></i>
                        </div>
                        <div class="text-1">'.Yii::t('app', 'clients').'
                        </div>
                    </div>',
                    ['/clients-list'],
                    't-members-list',
                    in_array($choice, ['clients', 'gym_members'], true) ? ['aria-current' => 'page'] : []
                ); ?>

                <?php if (!$gymMobileTeamRestricted
                    || $gymMobileCanAccess('t-members-memberships', 'create')
                    || $gymMobileCanAccess('t-classes-gym-classes', 'create')): ?>
                <div class="nav-item gym-mobile-create">
                    <div id="fabMenu" class="fab-menu">
                        <?php if ($gymMobileCanAccess('t-members-list', 'view')): ?>
                            <?= Html::button('<i class="bx bx-qr-scan mr-2"></i> ' . Html::encode(Yii::t('app', 'gym_qr_read')), [
                                'type' => 'button', 'class' => 'fab-item border-0',
                                'data-bs-toggle' => 'modal', 'data-bs-target' => '#gymMemberQrScanner',
                            ]) ?>
                        <?php endif; ?>
                        <?= $gymMobileLink(
                            '<i class="bx bx-id-card mr-2"></i> ' . Yii::t('app', 'create_membership'),
                            ['/memberships/create'],
                            't-members-memberships',
                            ['class' => 'fab-item'],
                            'create'
                        ); ?>

                        <?= $gymMobileLink(
                            '<i class="bx bx-calendar-plus mr-2"></i> ' . Yii::t('app', 'create_class'),
                            ['/gym-classes/create'],
                            't-classes-gym-classes',
                            ['class' => 'fab-item'],
                            'create'
                        ); ?>


                    </div>

                    <div id="fabBtn" class="center-btn">+</div>
                </div>
                <?php endif; ?>

                <?= $gymMobileLink(
                    '<div class="nav-item '. (isset($choice) ? (($choice == 'gym_classes') ? 'active' : '') : '') .'">
                        <div>
                            <i class="text-10 bx bx-dumbbell"></i>
                        </div>
                        <div class="text-1">'.Yii::t('app', 'classes').'
                        </div>
                    </div>',
                    ['/gym-classes'],
                    't-classes-gym-classes'
                ); ?>

                <?= $gymMobileLink(
                    '<div class="nav-item '. (isset($choice) ? (($choice == 'gym_memberships') ? 'active' : '') : '') .'">
                        <div>
                            <i class="text-10 bx bx-id-card"></i>
                        </div>
                        <div class="text-1">'.Yii::t('app', 'memberships').'
                        </div>
                    </div>',
                    ['/memberships'],
                    't-members-memberships'
                ); ?>

            </div>
        </div>

    <?php } ?>
    <?php if (\common\helpers\GymMemberQrAccess::canScan()): ?>
        <?= $this->render('_member_qr_scanner', ['companyCode' => $gymMobileCompanyCode]) ?>
    <?php endif; ?>

<?php break;
    default: ?>

    <div class="d-block d-lg-none">
        <!-- Bottom Navigation -->
        <div class="mobile-bottom-nav d-flex justify-content-evenly align-items-center">

            <?= Html::a(
                '<div class="nav-item '. (isset($choice) ? (($choice == 'bookings') ? 'active' : '') : '') .'">
                    <div>
                        <i class="text-10 bx bx-calendar"></i>
                    </div>
                    <div class="text-1">'.Yii::t('app', 'bookings').'
                    </div>    
                </div>',
                ['/dashboard']
            ); ?> 


        <?= Html::a(
                '<div class="nav-item '. (isset($choice) ? (($choice == 'clients') ? 'active' : '') : '') .'">
                    <div>
                        <i class="text-10 bx bx-group"></i>
                    </div>
                    <div class="text-1">'.Yii::t('app', 'clients').'
                    </div>    
                </div>',
                ['/clients-list']
            ); ?> 
            <div class="nav-item">
                <div id="fabMenu" class="fab-menu">           
                    <button id="booking-appointment-button" class="fab-item slot-add" type="button" data-language = "<?= Yii::$app->language ?>"  data-bs-toggle="modal" data-bs-target="#schedule-create-modal"   data-coin="<?= strtolower(Yii::$app->user->identity->currency) ?>"  data-date="<?= date('Y-m-d') ?>" onclick="genericBookingCreateMobile(this)">
                        <?=  '<i class="bx bx bx-calendar mr-2"></i> '.Yii::t('app', Yii::t('app', 'create_sheddule_button')) ?>
                    </button>
                    
                    <?= Html::a(
                        '<i class="bx bx-user-plus mr-2"></i> ' . Yii::t('app', 'create_clients_list_button'),
                        ['/clients-list/create'],
                        [
                            'class' => 'fab-item',
                            'encode' => false
                        ]
                    ); ?>

                    
                    <?= Html::a(
                        '<i class="bx bx-block mr-2"></i> ' . Yii::t('app', 'block_daytime'),
                        ['/block-daytime/create'],
                        [
                            'class' => 'fab-item',
                            'encode' => false
                        ]
                    ); ?>
                </div>

                <div  id="fabBtn" class="center-btn">+</div>
            </div>
        
            <?= Html::a(
                '<div class="nav-item '. (isset($choice) ? (($choice == 'blocks') ? 'active' : '') : '') .'">
                    <div>
                        <i class="text-10 bx bx-block "></i>
                    </div>
                    <div class="text-1">'.Yii::t('app', 'blocks').'
                    </div>    
                </div>',
                ['/block-daytime']
            ); ?> 

            <?= Html::a(
                '<div class="nav-item '. (isset($choice) ? (($choice == 'settings') ? 'active' : '') : '') .'">
                    <div>
                        <i class="text-10 bx bx-cog"></i>
                    </div>
                    <div class="text-1">'.Yii::t('app', 'settings').'
                    </div>    
                </div>',
                ['/profile']
            ); ?> 

        </div>
        <!-- Add spacing so content doesn't hide -->
    
    </div>
    <div id="schedule-modal-create-mobile"></div>

    <div id="schedule-modal-create"></div>

    <div id="schedule-modal-view"></div>

<?php break;
endswitch; ?>


<?php


$this->registerJs("
    jQuery(function ($) {

        const eventName = 'click';
        const fabBtn = document.getElementById('fabBtn');
        const fabMenu = document.getElementById('fabMenu');

        if (fabBtn && fabMenu) {
            fabBtn.addEventListener('click', function() {
                this.classList.toggle('open');
                fabMenu.classList.toggle('show');
            });
        }


        $(document).on('click', '.booking-item', function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (typeof genericBookingViewMobile === 'function') {
                if ($(this).data('blocked')) {
                    genericBookingViewMobile(this);
                }
            }
        });

        $(document)
            .off(eventName, '.slot-add')
            .on(eventName, '.slot-add', function (e) {
                e.preventDefault();
                e.stopPropagation();

            if (typeof genericBookingCreateMobile === 'function') {
                genericBookingCreateMobile(this);
            }
        });
                                                
        $(document)         
            .on(eventName, '.day-pill-new', function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (typeof getDayValuesMobile === 'function') {
                    getDayValuesMobile(this);
                }
        });
    });
");

?>
