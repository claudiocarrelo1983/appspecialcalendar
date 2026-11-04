<?php

    /* @var $this yii\web\View */
    use common\helpers\Helpers;
    use yii\helpers\Url;
    use common\models\Tickets;
    use yii\helpers\Html;
    use yii\db\Query;

    if (Yii::$app->user->isGuest) {
        return;
    }

    $companyCode = \common\helpers\SecurityAccess::companyCode();
    $company = \common\models\Company::findOne(['company_code' => $companyCode]);
    $companyName = $company ? ($company->company_name ?: $companyCode) : $companyCode;
    $isClient=Yii::$app->user->identity->level === 'client';
    $notificationCutoff=time()-15*86400;
    $notifications = $isClient ? [] : (new Query())->from('tickets')->where([
        'company_code' => $companyCode, 'level' => Yii::$app->user->identity->level,
        'type' => 'client_message', 'read' => '0',
    ])->andWhere(['>=','created_date',date('Y-m-d H:i:s',$notificationCutoff)])->all();
    $tasks = $isClient ? [] : \common\helpers\TaskAssignmentNotifications::pending($companyCode, Yii::$app->user->identity->guid);
    $tasks=array_values(array_filter($tasks,static function($task) use($notificationCutoff){
        $created=strtotime((string)($task['created_date']??''));
        return $created!==false && $created >= $notificationCutoff;
    }));
    $groupQuery=\common\helpers\CompanyNotificationService::available()?\common\helpers\CompanyNotificationService::inbox($companyCode,Yii::$app->user->id):null;
    $groupCount=$groupQuery?(int)(clone $groupQuery)->andWhere(['read_at'=>null])->count():0;
    $groupNotices=$groupQuery?$groupQuery->limit(5)->all():[];
    $tasksNotChecked = count($tasks)+$groupCount;


    $rows = count($notifications);
    $tasksRows = count($tasks);
    $isEmpty = $rows === 0 && $tasksRows === 0 && !$groupNotices;
    // Use creation time for every type, never a task's scheduled/due date.
    $notificationFeed=[];
    foreach($groupNotices as $notice)if($notice->notification)$notificationFeed[]=['type'=>'notice','created'=>(int)$notice->notification->created_at,'id'=>(int)$notice->notification_id,'value'=>$notice];
    foreach($tasks as $task)$notificationFeed[]=['type'=>'task','created'=>strtotime((string)$task['created_date'])?:0,'id'=>(int)$task['id'],'value'=>$task];
    foreach($notifications as $message)$notificationFeed[]=['type'=>'message','created'=>strtotime((string)$message['created_date'])?:0,'id'=>(int)$message['id'],'value'=>$message];
    usort($notificationFeed,static function($a,$b){return ($b['created']<=>$a['created'])?:($b['id']<=>$a['id'])?:strcmp($a['type'],$b['type']);});

?>
<?php
$this->registerCss(<<<'CSS'
.company-notifications-menu { width:400px; max-width:calc(100vw - 24px); border:0; border-radius:16px; box-shadow:0 12px 36px #10253226; overflow:hidden; }
.company-notifications-menu .company-notifications-list { max-height:320px; overflow-y:auto; }
.company-notifications-menu .company-notification-row { display:flex; align-items:flex-start; gap:12px; padding:16px 20px; border-top:1px solid #edf0f4; }
.company-notifications-menu .company-notification-content { flex:1; min-width:0; overflow-wrap:anywhere; text-decoration:none; }
.company-notifications-menu .company-notification-body { line-height:1.5; margin-top:4px; white-space:normal; }
.company-notifications-menu .company-notification-check { width:20px; height:20px; margin-top:3px; flex-shrink:0; cursor:pointer; }
.company-notifications-menu .company-notification-row.is-unread { background:#f2f8ff; }
.company-notifications-menu .notification-item { padding:16px 20px; white-space:normal; }
.company-notifications-menu.is-empty { width:320px; }
.company-notifications-menu .company-notifications-heading { padding:16px 20px; border-bottom:1px solid #edf0f4; }
.company-notifications-menu .company-notifications-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:20px; color:#64748b; text-align:center; }
.company-notifications-menu .company-notifications-empty-icon { display:flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:50%; background:#f1f5f9; color:#94a3b8; font-size:22px; }
.company-notifications-menu .company-notifications-empty p { margin:0; font-size:14px; line-height:1.5; }
/* Isolate the bell content from header link and Bootstrap checkbox positioning rules. */
.company-notifications-menu.company-notifications-menu .company-notifications-heading { display:flex; flex-direction:column; align-items:flex-start; gap:4px; padding:18px 20px; }
.company-notifications-menu.company-notifications-menu .company-notifications-title { margin:0; padding:0; font-size:15px; font-weight:700; line-height:1.4; color:#1e293b; background:transparent; }
.company-notifications-menu.company-notifications-menu .company-notifications-company { margin:0; padding:0; font-size:12px; line-height:1.5; color:#64748b; background:transparent; }
.company-notifications-menu.company-notifications-menu .company-notification-row { display:grid; grid-template-columns:36px minmax(0,1fr) 24px; align-items:start; gap:12px; padding:18px 20px; }
.company-notifications-menu.company-notifications-menu .company-notification-icon { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:12px; background:#e6f0fa; color:#547da3; font-size:20px; }
.company-notifications-menu.company-notifications-menu .company-notification-icon.is-task { background:#ecfdf5; color:#15803d; }
.company-notifications-menu.company-notifications-menu .company-notification-icon.is-message { background:#f3e8ff; color:#7e22ce; }
.company-notifications-menu.company-notifications-menu .company-notification-content { display:block; float:none; position:static; width:auto; padding:0; margin:0; text-align:left; line-height:1.5; background:transparent; }
.company-notifications-menu.company-notifications-menu .company-notification-title { margin:0; color:#26354b; font-size:14px; font-weight:600; line-height:1.5; }
.company-notifications-menu.company-notifications-menu .company-notification-body { color:#64748b; font-size:13px; line-height:1.5; margin-top:4px; }
.company-notifications-menu.company-notifications-menu .company-notification-meta { display:flex; flex-wrap:wrap; align-items:center; gap:5px; margin-top:9px; color:#8290a3; font-size:11px; line-height:1.5; }
.company-notifications-menu.company-notifications-menu .company-notification-check { position:static!important; float:none!important; margin:3px 0 0!important; padding:0!important; transform:none!important; width:19px; height:19px; min-width:19px; opacity:1; appearance:auto; accent-color:var(--sc-primary,#198754); }
.company-notifications-menu.company-notifications-menu .company-notification-check:disabled { cursor:default; }
.company-notifications-menu .company-notification-content:focus-visible,.company-notifications-menu .company-notification-check:focus-visible { outline:2px solid var(--sc-primary,#198754); outline-offset:3px; }
@media(max-width:575px) { .company-notifications-menu.company-notifications-menu { width:340px; } .company-notifications-menu.company-notifications-menu .company-notification-row { padding:16px; gap:10px; } }
CSS);
$errorLabel=\yii\helpers\Json::htmlEncode(Yii::t('app','notification_read_error'));
\yii\web\YiiAsset::register($this);
$this->registerJs(<<<JS
$(document).off('change.companyNotification', '.company-notification-check').on('change.companyNotification', '.company-notification-check', function () {
    var checkbox=$(this), row=checkbox.closest('.company-notification-row');
    var wanted=checkbox.prop('checked');
    checkbox.prop('disabled',true);
    var data={checked:wanted?'1':'0'};
    if (checkbox.data('task-id')) data.id=checkbox.data('task-id');
    data[yii.getCsrfParam()]=yii.getCsrfToken();
    $.ajax({url:checkbox.data('url'),type:'POST',data:data,dataType:'json'}).done(function (response) {
        if (!response || response.success !== true) { failed(); return; }
        row.toggleClass('is-unread',!wanted).find('.company-notification-state').text(checkbox.attr(wanted?'data-checked-label':'data-unchecked-label'));
        checkbox.attr('aria-label',checkbox.attr(wanted?'data-unchecked-label':'data-checked-label'));
        var badge=$('#page-header-notifications-dropdown .badge'), count=parseInt(badge.text(),10)||0;
        count=Math.max(0,count+(wanted?-1:1));
        if (count) {
            if (!badge.length) badge=$('<span class="badge bg-danger rounded-pill p-1"></span>').appendTo('#page-header-notifications-dropdown');
            badge.text(count);
        } else badge.remove();
        $('#page-header-notifications-dropdown .bx-bell').toggleClass('bx-tada',count>0);
    }).fail(failed).always(function(){checkbox.prop('disabled',false);});
    function failed() { checkbox.prop('checked',!wanted); row.find('.company-notification-state').text($errorLabel); }
});
$(document).off('click.companyNotification', '.company-notification-check').on('click.companyNotification', '.company-notification-check', function(e) { e.stopPropagation(); });
JS);
?>


<button type="button"  class="btn header-item noti-icon waves-effect" id="page-header-notifications-dropdown"
data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-haspopup="true" aria-expanded="false">
    <i class="bx bx-bell <?= ((($rows > 0) || ($tasksNotChecked > 0)) ? 'bx-tada' : '') ?>"></i>
    <?php
        if(($rows > 0) || ($tasksNotChecked > 0)){
    ?>
        <span class="badge bg-danger rounded-pill p-1"><?= $tasksRows + $rows + $groupCount ?></span>
    <?php
        }
    ?>
</button>


                            
<div class="company-notifications-menu <?= $isEmpty ? 'is-empty' : '' ?> px-0 dropdown-menu dropdown-menu-lg dropdown-menu-end p-0" aria-labelledby="page-header-notifications-dropdown">
    <div class="company-notifications-heading">
        <h6 class="company-notifications-title"><?= Yii::t('app', 'notifications') ?></h6>
        <p class="company-notifications-company"><?= Html::encode($companyName) ?></p>
    </div>
    <div class="company-notifications-list">
    <?php foreach($notificationFeed as $feedItem): ?>
    <?php if($feedItem['type']==='notice'): $groupNotice=$feedItem['value']; ?>
        <div class="company-notification-row <?= $groupNotice->read_at?'':'is-unread' ?>">
            <div class="company-notification-icon" aria-hidden="true"><i class="bx bx-bell"></i></div>
            <a class="company-notification-content" href="<?= Html::encode(Url::to(['/group-notifications/view','id'=>$groupNotice->notification_id])) ?>">
                <div class="company-notification-title"><?= Html::encode($groupNotice->notification->title) ?></div>
                <div class="company-notification-body"><?= Html::encode(mb_substr($groupNotice->notification->body,0,120)) ?></div>
                <div class="company-notification-meta"><i class="bx bx-time-five" aria-hidden="true"></i><?= date('d/m/Y H:i',$groupNotice->notification->created_at) ?> · <span class="company-notification-state" aria-live="polite"><?= Yii::t('app',$groupNotice->read_at?'notification_read_state':'group_notifications_unread') ?></span></div>
            </a>
            <?= Html::checkbox('notice-read', (bool)$groupNotice->read_at, ['class'=>'company-notification-check','aria-label'=>Yii::t('app',$groupNotice->read_at?'group_notifications_unread':'group_notifications_mark_read'),'data-checked-label'=>Yii::t('app','notification_read_state'),'data-unchecked-label'=>Yii::t('app','group_notifications_unread'),'data-url'=>Url::to(['/group-notifications/mark-read','id'=>$groupNotice->notification_id])]) ?>
        </div>
    <?php elseif($feedItem['type']==='task'): $value=$feedItem['value']; ?>
        <div class="company-notification-row is-unread">
            <div class="company-notification-icon is-task" title="<?= Html::encode(Yii::t('app','task_ui_task')) ?>"><i class="bx bx-task" aria-hidden="true"></i><span class="visually-hidden"><?= Html::encode(Yii::t('app','task_ui_task')) ?></span></div>
            <a class="company-notification-content" href="<?= Html::encode(Url::to(['/task-operations/view','id'=>$value['id']])) ?>">
                <div class="company-notification-title"><?= Html::encode($value['title']) ?></div>
                <div class="company-notification-body"><?= Html::encode(Helpers::getBegginningOfString($value['notes'],120)) ?></div>
                <div class="company-notification-meta"><i class="bx bx-time-five" aria-hidden="true"></i><?= date('d/m/Y H:i',$feedItem['created']) ?> · <span class="company-notification-state" aria-live="polite"><?= Html::encode(Yii::t('app','task_ui_state_pending')) ?></span></div>
            </a>
            <?= Html::checkbox('task-completed', false, [
                'class'=>'company-notification-check',
                'aria-label'=>Yii::t('app','task_ui_state_completed').': '.$value['title'],
                'data-task-id'=>(int)$value['id'],
                'data-url'=>Url::to(['/task-operations/set-completed']),
                'data-checked-label'=>Yii::t('app','task_ui_state_completed'),
                'data-unchecked-label'=>Yii::t('app','task_ui_state_pending'),
            ]) ?>
        </div>
    <?php else: $value=$feedItem['value']; ?>
                    <div class="company-notification-row is-unread">
                        <div class="company-notification-icon is-message" aria-hidden="true"><i class="bx bx-message-rounded"></i></div>
                        <div class="company-notification-content">
                            <div class="company-notification-title"><?= Html::encode($value['subject']) ?></div>
                            <div class="company-notification-body"><?= Html::encode(Helpers::getBegginningOfString($value['text'],120)) ?></div>
                            <div class="company-notification-meta"><i class="bx bx-time-five" aria-hidden="true"></i><?= Html::encode($value['created_date']) ?></div>
                        </div>
                    </div>

    <?php endif; endforeach; ?>

        <?php if($isEmpty){ ?>
            <div class="company-notifications-empty" role="status">
                <span class="company-notifications-empty-icon" aria-hidden="true"><i class="bx bx-bell"></i></span>
                <p><?= Yii::t('app', 'group_notifications_empty') ?></p>
            </div>
        <?php
            }
        ?>

    </div>
</div>
