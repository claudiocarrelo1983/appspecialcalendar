<?php
use common\helpers\GymMemberQrAccess;
use yii\helpers\Html;
/** @var common\models\User $model */
$canCheckin = GymMemberQrAccess::can('view') && GymMemberQrAccess::can('create');
?>
<?php if ($canCheckin): ?>
<div class="card rounded-4 shadow-sm mb-3" data-member-checkin-action>
 <div class="card-body p-3">
  <p class="fw-semibold mb-2"><?= Html::encode($model->full_name ?: $model->username) ?></p>
  <?= Html::a('<i class="bx bx-log-in-circle me-2" aria-hidden="true"></i>' . Html::encode(Yii::t('app', 'check_in')), ['/gym-checkin/index', 'member_id' => $model->id], ['class' => 'btn btn-success rounded-4 w-100 py-3 fw-bold']) ?>
  <p class="text-muted small mt-2 mb-0"><?= Html::encode(Yii::t('app', 'qr_checkin_confirm_hint')) ?></p>
 </div>
</div>
<?php elseif (Yii::$app->request->get('qr_scanned') === '1'): ?>
<div class="alert alert-info rounded-4" role="status" data-member-checkin-unavailable>
 <?= Html::encode(Yii::t('app', 'qr_checkin_permission_hint')) ?>
</div>
<?php endif; ?>
