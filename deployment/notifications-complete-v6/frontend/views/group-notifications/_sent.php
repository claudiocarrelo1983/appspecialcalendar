<?php
use yii\helpers\Html;
use common\helpers\CompanyNotificationService;
$unified = $unified ?? false;
$this->title=Yii::t('app',$sent?'group_notifications_sent':'group_notifications_inbox');
$this->registerCss(<<<'CSS'
.notification-history { max-width:1400px; margin:0 auto; }
.notification-history .notification-list { border:1px solid #e8edf3; border-radius:20px; background:#fff; overflow:hidden; }
.notification-history .notification-list-summary { padding:16px 22px; border-bottom:1px solid #e8edf3; color:#64748b; font-size:13px; }
.notification-history .notification-history-row { display:grid; grid-template-columns:44px minmax(0,1fr) auto 20px; align-items:center; gap:16px; padding:22px; border-bottom:1px solid #edf1f5; color:inherit; text-decoration:none; transition:background .15s; }
.notification-history .notification-history-row:last-child { border-bottom:0; }
.notification-history .notification-history-row:hover { background:#f8fafb; }
.notification-history .notification-history-row.is-unread { background:#f6faf8; box-shadow:inset 3px 0 var(--sc-primary,#198754); }
.notification-history .notification-history-row.is-unread:hover { background:#eef6f2; }
.notification-history .notification-history-row.is-read .notification-history-icon { background:#f1f5f9; color:#7c8a9d; }
.notification-history .notification-history-row.is-read .notification-history-badge { background:#f1f5f9; color:#64748b; }
.notification-history .notification-history-row:focus-visible { outline:2px solid var(--sc-primary,#198754); outline-offset:-3px; }
.notification-history .notification-history-icon { display:flex; align-items:center; justify-content:center; width:44px; height:44px; border-radius:14px; background:rgba(var(--sc-primary-rgb,25,135,84),.08); color:var(--sc-primary,#198754); font-size:23px; }
.notification-history .notification-history-content { min-width:0; }
.notification-history .notification-history-title { margin:0 0 5px; color:#14243b; font-size:15px; font-weight:700; line-height:1.5; overflow-wrap:anywhere; }
.notification-history .notification-history-body { margin:0; color:#718096; font-size:13px; line-height:1.6; overflow-wrap:anywhere; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.notification-history .notification-history-meta { display:flex; flex-direction:column; align-items:flex-end; gap:10px; }
.notification-history .notification-history-date { display:flex; align-items:center; gap:6px; color:#8290a3; font-size:12px; white-space:nowrap; }
.notification-history .notification-history-badge { display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:5px 10px; background:#eef6f2; color:#2b7356; font-size:12px; font-weight:600; line-height:1.4; }
.notification-history .notification-history-chevron { color:#94a3b8; font-size:22px; }
.notification-history .notification-history-empty { padding:40px 20px; text-align:center; color:#718096; }
.notification-history .notification-history-empty i { display:block; margin-bottom:12px; color:#94a3b8; font-size:32px; }
@media(max-width:767px) { .notification-history .notification-history-row { grid-template-columns:38px minmax(0,1fr) 18px; gap:12px; padding:18px 16px; } .notification-history .notification-history-icon { width:38px; height:38px; border-radius:12px; align-self:start; } .notification-history .notification-history-meta { grid-column:2; flex-direction:row; flex-wrap:wrap; align-items:center; gap:8px 12px; } .notification-history .notification-history-chevron { grid-column:3; grid-row:1 / 3; } .notification-history .notification-list-summary { padding:14px 16px; } }
.notification-history .notification-history-icon.is-task {background:#fffbeb;color:#b45309}
.notification-history .notification-history-icon.is-invitation {background:#f5f3ff;color:#7c3aed}
CSS);
?>
<?php ob_start(); ?>
<?php if($sent): ?><?= Html::a(Yii::t('app','group_notifications_inbox'),['index'],['class'=>'btn btn-light rounded-pill']) ?><?php endif ?>
<?php if(CompanyNotificationService::canManage(\common\helpers\SecurityAccess::companyCode())): ?>
<?php if(!$sent): ?><?= Html::a(Yii::t('app','group_notifications_sent'),['sent'],['class'=>'btn btn-light rounded-pill']) ?><?php endif ?>
<?= Html::a('<i class="bx bx-plus"></i> '.Yii::t('app','group_notifications_compose'),['create'],['class'=>'btn btn-primary rounded-pill']) ?><?php endif ?>
<?php $actions=ob_get_clean(); ?>
<div class="container-fluid py-3 notification-history">
<?= \common\widgets\GymPageHeader::widget(['title'=>$this->title,'section'=>'group_notifications_title','icon'=>'bx bx-bell','actions'=>$actions]) ?>
<div class="notification-list shadow-sm">
<div class="notification-list-summary"><?= Yii::t('app','notification_history_count',['n'=>(int)$provider->getTotalCount()]) ?></div>
<?php foreach($provider->getModels() as $row):
    if ($unified) {
        $notice=(object)$row; $read=(bool)$row['read']; $kind=$row['type']; $destination=$row['url'];
        $state=$kind==='task'?'task_ui_state_pending':($read?'notification_read_state':'group_notifications_unread');
    } else {
        $notice=$sent?$row:$row->notification; if(!$notice)continue;
        $read=$sent?false:(bool)$row->read_at; $kind=$sent?'sent':'notification'; $destination=['view','id'=>$notice->id];
        $state=$read?'notification_read_state':'group_notifications_unread';
    }
    $icon=['task'=>'bx-task','class-invitation'=>'bx-calendar-check','sent'=>'bx-send'][$kind]??'bx-bell';
?>
<a class="notification-history-row <?= $sent?'':($read?'is-read':'is-unread') ?>" href="<?= Html::encode(\yii\helpers\Url::to($destination)) ?>">
<span class="notification-history-icon <?= $kind==='task'?'is-task':($kind==='class-invitation'?'is-invitation':'') ?>" aria-hidden="true"><i class="bx <?= Html::encode($icon) ?>"></i></span>
<div class="notification-history-content"><h2 class="notification-history-title"><?= Html::encode($notice->title) ?></h2><p class="notification-history-body"><?= Html::encode(mb_substr($notice->body,0,180)) ?></p></div>
<div class="notification-history-meta">
<time class="notification-history-date" datetime="<?= date('c',$notice->created_at) ?>"><i class="bx bx-time-five" aria-hidden="true"></i><?= date('d/m/Y H:i',$notice->created_at) ?></time>
<?php if($sent): ?><span class="notification-history-badge"><i class="bx bx-group" aria-hidden="true"></i><?= Yii::t('app','notification_recipient_count',['n'=>(int)$notice->recipient_count]) ?></span><?php else: ?><span class="notification-history-badge"><i class="bx <?= $kind==='task'?'bx-task':($read?'bx-check':'bx-bell') ?>" aria-hidden="true"></i><?= Yii::t('app',$state) ?></span><?php endif ?>
</div><i class="bx bx-chevron-right notification-history-chevron" aria-hidden="true"></i>
</a><?php endforeach ?>
<?php if(!$provider->getTotalCount()): ?><div class="notification-history-empty"><i class="bx bx-bell" aria-hidden="true"></i><?= Yii::t('app','group_notifications_empty') ?></div><?php endif ?>
</div><div class="mt-3"><?= \yii\widgets\LinkPager::widget(['pagination'=>$provider->pagination]) ?></div></div>
