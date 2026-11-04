<?php

/* @var $this \yii\web\View */
/* @var $content string */

use common\widgets\Alert;
use frontend\assets\AppAsset;
use yii\bootstrap4\Breadcrumbs;
use yii\bootstrap4\Html;
use yii\bootstrap4\Nav;
use yii\bootstrap4\NavBar;
use frontend\assets\AdminAsset;
use frontend\assets\AdminTvdeAsset;
use common\helpers\Helpers;

$base_url = Helpers::getApplicationDomain(); 
$displayLink = 1;
$gymMenuPage = \common\helpers\GymMenuHelper::currentPage() !== null;

switch($base_url){
    case 'localhost:100':
    case 'myspecialgym.com':
        AdminAsset::register($this);
         break;
    case 'localhost:82':
    case 'localhost:86':
    case 'teamtvde.pt':
        AdminTvdeAsset::register($this);
        break;
    case 'localhost':
    case 'specialcalendar.com':
    case 'specialcalendar.pt':
        AdminAsset::register($this);

        break;
    default:
        AdminAsset::register($this);
    break;
}

$this->registerCss(<<<CSS
@media (min-width: 992.02px) {
    .main-content > .page-content {
        margin-top: 94px;
    }
}
CSS, [], 'admin-desktop-content-spacing');





?>


<?php $this->beginPage() ?>
<!DOCTYPE html>
<html lang="<?= Yii::$app->language ?>" class="h-100<?= stripos((string) Yii::$app->request->userAgent, 'Android') !== false ? ' platform-android' : (preg_match('/iPhone|iPad|iPod/i', (string) Yii::$app->request->userAgent) ? ' platform-ios' : '') ?>">
<head>
    <link rel="preconnect" href="https://cdn.form.io">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://cdn.form.io/formiojs/formio.full.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap" rel="stylesheet">
    <script defer src="https://cdn.form.io/formiojs/formio.full.min.js"></script>

    <?php $userAgent = Helpers::getUserAgent(); ?>

    <meta charset="<?= Yii::$app->charset ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover">

   
    
    <?php $this->registerCsrfMetaTags() ?>
    <title><?= Html::encode($this->title) ?></title>

    <!-- ✅ Google Analytics (GA4) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-Z6FK237DHV"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        gtag('config', 'G-Z6FK237DHV');
    </script>

    <!-- ✅ UTM Capture (First-touch safe) -->
    <script>
        function getUTM(param) {
            const params = new URLSearchParams(window.location.search);
            //console.log(params.get(param));
            return params.get(param);
        }

        const utmKeys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
        

        utmKeys.forEach(function(key) {
            const value = getUTM(key);
            if (value && !localStorage.getItem(key)) {
                localStorage.setItem(key, value);
            }
        });
    </script>
    <?php $this->head() ?>
    <?= $this->render('_company-branding') ?>
</head>

<?php $this->beginBody() ?>
<!-- <body data-plugin-page-transition> -->
<!--
<body data-sidebar="dark" class="loading-overlay-showing" data-loading-overlay data-plugin-options="{'hideDelay': 500, 'effect': 'speedingWheel'}">
<div class="loading-overlay">
    <div class="bounce-loader">
        <div class="cssload-speeding-wheel-container">
            <div class="cssload-speeding-wheel"></div>
        </div>
    </div>
</div>
-->
<?php
$disableLoadingOverlay = !empty($this->params['disableLoadingOverlay']);
$enableLoadingOverlay = !empty($this->params['enableLoadingOverlay']) || !empty($this->params['loadingOverlay']);
$showLoadingOverlay = $enableLoadingOverlay && !$disableLoadingOverlay;
?>
<body data-sidebar="dark" data-gym-menu-page="<?= $gymMenuPage ? '1' : '0' ?>"<?= $showLoadingOverlay ? ' class="loading-overlay-showing" data-loading-overlay data-plugin-options="{\'hideDelay\': 500, \'effect\': \'speedingWheel\'}"' : '' ?>>
<?php if ($showLoadingOverlay): ?>
    <div class="loading-overlay">
        <div class="bounce-loader">
            <div class="cssload-speeding-wheel-container">
                <div class="cssload-speeding-wheel"></div>
            </div>
        </div>
    </div>
<?php endif; ?>
<div class="body"> 

 <!-- <body data-layout="horizontal" data-topbar="dark"> -->

    <!-- Begin page -->
    <div id="layout-wrapper">

        <?= $this->render('/admin/headerAdmin'); ?>

        <!-- ========== Left Sidebar Start ========== -->
        <div class="vertical-menu">

            <div data-simplebar class="h-100">

                <!--- Sidemenu -->
                <div id="sidebar-menu">
                    <!-- Left Menu Start -->
                    <ul class="metismenu list-unstyled" id="side-menu">   

                    <?= $this->render('/admin/sidebar-left'); ?>

                </div>
                <!-- Sidebar -->
            </div>
        </div>
        <!-- Left Sidebar End -->
        

        <!-- ============================================================== -->
        <!-- Start right Content here -->
        <!-- ============================================================== -->

      
        <?php $pageContentClass = Yii::$app->controller->id === 'dashboard-gym' ? 'page-content min-vh-100 px-0 pt-0' : 'page-content min-vh-100 pt-0'; ?>
        <div class="main-content<?= $gymMenuPage ? ' gym-menu-page' : '' ?><?= Yii::$app->controller->id === 'dashboard-gym-client' ? ' gym-client-dashboard-page' : '' ?>">
            <div class="<?= $pageContentClass ?>">
                <div class="container-fluid px-0 mb-5">
                    <div class="card">
                        <div class="bg-grey-light">
                            <?php if ($gymMenuPage): ?>
                                <div class="gym-menu-content"><?php $gymHeading=\common\helpers\GymMenuHelper::currentPage(); echo \common\widgets\GymPageHeading::widget(['canonical'=>true,'title'=>$this->title?:$gymHeading['title'],'icon'=>$gymHeading['icon']]); ?><?= $content ?></div>
                            <?php else: ?>
                                <?= $content ?>
                            <?php endif; ?>
                            <div class="footer-space"></div>   
                            <?php echo $this->render('@frontend/views/dashboard/footer-mobile') ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- End Page-content -->

        <?= $this->render('/admin/footer'); ?>

    </div>
    <!-- END layout-wrapper -->    

<?= $this->render('/shared/_push_information') ?>
<?php $this->endBody() ?>
</body>
</html>
<?php $this->endPage();
