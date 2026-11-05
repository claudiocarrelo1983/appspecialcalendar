<?php
use yii\helpers\Html;
\yii\web\YiiAsset::register($this);
$this->title=Yii::t('app','Registration waiting list');
$this->registerCss('.registration-waiting-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px}.registration-waiting-card{padding:20px;border:1px solid #e4eaf2;border-radius:20px;background:#fff;min-width:0}.registration-waiting-card h2{font-size:18px;font-weight:700}.registration-waiting-card p{overflow-wrap:anywhere;color:#718099}.registration-waiting-actions{display:flex;gap:10px;flex-wrap:wrap}.registration-waiting-actions button{border-radius:14px;padding:12px 20px;font-weight:600}.registration-approve{background:var(--sc-primary,#198754);color:#fff;border:0}');
?>
<div class="container-fluid py-3">
<?= \common\widgets\GymPageHeader::widget(['title'=>$this->title,'section'=>'members','icon'=>'bx bx-user-check','showCompany'=>false]) ?>
<p><?= Html::encode(Yii::t('app','New members can sign in only after an administrator approves their registration.')) ?></p>
<?= Html::a(Yii::t('app','Back to clients'),['index'],['class'=>'btn btn-light rounded-4 mb-3']) ?>
<div class="registration-waiting-grid">
<?php foreach($provider->getModels() as $member): ?>
<article class="registration-waiting-card shadow-sm">
<h2><?= Html::encode($member->full_name ?: $member->username) ?></h2>
<p><?= Html::encode($member->email) ?></p>
<span class="badge rounded-pill bg-warning-subtle text-warning mb-3"><?= Html::encode(Yii::t('app','Awaiting approval')) ?></span>
<div class="registration-waiting-actions">
<?php foreach(['approve'=>['Approve registration','Approve this registration? The member will be able to sign in.','registration-approve'],'delete'=>['Delete registration','Delete this pending registration? The member will not be able to sign in.','btn btn-outline-danger']] as $decision=>$options): ?>
<?= Html::beginForm(['registration-decision','id'=>$member->id],'post') ?>
<?= Html::hiddenInput('decision',$decision) ?>
<?= Html::submitButton(Html::encode(Yii::t('app',$options[0])),['class'=>$options[2],'data-confirm'=>Yii::t('app',$options[1])]) ?>
<?= Html::endForm() ?>
<?php endforeach ?>
</div></article>
<?php endforeach ?>
</div>
<?php if(!$provider->getTotalCount()): ?><p class="text-muted p-3"><?= Html::encode(Yii::t('app','No registrations awaiting approval.')) ?></p><?php endif ?>
<?= \yii\widgets\LinkPager::widget(['pagination'=>$provider->pagination]) ?>
</div>
