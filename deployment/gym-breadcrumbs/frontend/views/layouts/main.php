<?php

/** @var \yii\web\View $this */
/** @var string $content */

use common\widgets\Alert;
use frontend\assets\AppAsset;
use yii\bootstrap5\Breadcrumbs;
use yii\helpers\Html;
use yii\bootstrap5\Nav;
use yii\bootstrap5\NavBar;

AppAsset::register($this);
$gymMenuPage=\common\helpers\GymMenuHelper::currentPage();
if($gymMenuPage!==null)$this->registerCssFile('@web/css/gym-ui.css',['depends'=>AppAsset::class]);
?>
<?php $this->beginPage() ?>
<!DOCTYPE html>
<html lang="<?= Yii::$app->language ?>" class="h-100">
<head>
    <meta charset="<?= Yii::$app->charset ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <?php $this->registerCsrfMetaTags() ?>
    <title><?= Html::encode($this->title) ?></title>
    <?php $this->head() ?>
</head>
<body class="d-flex flex-column h-100">
<?php $this->beginBody() ?>

<header>
   
</header>

<main role="main" class="flex-shrink-0">
    <div class="container">     
        <?= Alert::widget() ?>
        <?php if($gymMenuPage!==null): ?><div class="gym-menu-content"><?= \common\widgets\GymPageHeading::widget(['canonical'=>true,'title'=>$this->title?:$gymMenuPage['title'],'icon'=>$gymMenuPage['icon']]) ?><?= $content ?></div><?php else: ?><?= $content ?><?php endif; ?>
    </div>
</main>

<footer class="footer mt-auto py-3 text-muted">
    <div class="container">
        <p class="float-start">&copy; <?= Html::encode(Yii::$app->name) ?> <?= date('Y') ?></p>
        <p class="float-end"><?= Yii::powered() ?></p>
    </div>
</footer>

<?php $this->endBody() ?>
</body>
</html>
<?php $this->endPage();
