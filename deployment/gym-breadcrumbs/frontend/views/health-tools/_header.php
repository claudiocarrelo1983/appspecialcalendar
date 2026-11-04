<?php
use yii\helpers\Html;
use yii\helpers\Url;
\frontend\assets\HealthToolsAsset::register($this);
$this->title = Yii::t('health', $title);
?>
<header class="health-tools-header mb-3">
    <?= \common\widgets\GymPageHeading::widget(['title'=>$this->title,'description'=>$description??null,'icon'=>\common\helpers\GymMenuHelper::currentPage()['icon']??'bx bx-heart']) ?>
    <nav class="d-flex flex-wrap gap-2 mt-3" aria-label="<?= Html::encode(Yii::t('health', 'Health Tools')) ?>">
        <?php foreach (['workout-timer' => 'Workout Timer', 'gym-sessions' => 'Sessions'] as $route => $label): ?>
            <?php if (!\common\helpers\HealthToolsAccess::can($route)) { continue; } ?>
            <?= Html::a(Html::encode(Yii::t('health', $label)), ['/' . $route], ['class' => 'btn rounded-4 ' . ($this->context->id === $route ? 'btn-primary-modern' : 'btn-reset-modern')]) ?>
        <?php endforeach; ?>
    </nav>
</header>
<?= \common\widgets\Alert::widget() ?>
