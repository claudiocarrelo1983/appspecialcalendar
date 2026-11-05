<?php
use yii\helpers\Html;
use yii\helpers\Json;
use yii\helpers\Url;
if ($sent) { echo $this->render('_sent', ['provider'=>$provider, 'sent'=>true]); return; }
$this->title=Yii::t('app','group_notifications_inbox');
$pt=strpos(Yii::$app->language,'pt')===0;
$labels=$pt?[
 'failed'=>'Não foi possível guardar. Tente novamente.','unavailable'=>'Reserva indisponível. Abra a aula para consultar os detalhes.',
 'book'=>'Reservar aula','cancel'=>'Cancelar reserva','booked'=>'Reservada','notBooked'=>'Não reservada',
 'confirmBook'=>'Confirmar a reserva desta aula?','confirmCancel'=>'Confirmar o cancelamento? Aplicam-se os prazos do clube.',
 'complete'=>'Concluir tarefa','reopen'=>'Reabrir tarefa','completed'=>'Concluída','pending'=>'Pendente',
 'read'=>'Marcar como lida','unread'=>'Marcar como não lida','readState'=>'Lida','unreadState'=>'Não lida','unknownDate'=>'Data de criação indisponível',
]:[
 'failed'=>'Could not save. Please try again.','unavailable'=>'Booking unavailable. Open the class for details.',
 'book'=>'Book class','cancel'=>'Cancel booking','booked'=>'Booked','notBooked'=>'Not booked',
 'confirmBook'=>'Confirm booking this class?','confirmCancel'=>'Confirm cancellation? The club cancellation window applies.',
 'complete'=>'Complete task','reopen'=>'Reopen task','completed'=>'Completed','pending'=>'Pending',
 'read'=>'Mark as read','unread'=>'Mark as unread','readState'=>'Read','unreadState'=>'Unread','unknownDate'=>'Creation date unavailable',
];
$labels=array_map(static fn($text)=>Yii::t('app',$text),$labels);
$script=Yii::getAlias('@frontend/web/js/notification-inbox.js');
$this->registerJsFile('@web/js/notification-inbox.js?v='.substr(hash_file('sha256',$script),0,12),['depends'=>[\yii\web\YiiAsset::class]]);
$this->registerCss(<<<'CSS'
.notification-inbox{max-width:1400px;margin:auto}.notification-inbox .inbox-list{background:white;border:1px solid #e4eaf2;border-radius:20px;overflow:hidden}.notification-inbox .inbox-count{padding:16px 20px;border-bottom:1px solid #e4eaf2;color:#718099;font-size:13px}.notification-inbox .inbox-row{display:grid;grid-template-columns:40px minmax(0,1fr) 32px;gap:12px;padding:20px;border-bottom:1px solid #e4eaf2;align-items:start}.notification-inbox .inbox-row:last-child{border:0}.notification-inbox .inbox-icon{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:#edf8f3;color:var(--sc-primary,#198754);font-size:23px}.notification-inbox .is-task .inbox-icon{background:#fffbeb;color:#b45309}.notification-inbox .is-class-invitation .inbox-icon{background:#f5f3ff;color:#7c3aed}.notification-inbox .inbox-content{min-width:0;text-decoration:none;color:inherit}.notification-inbox .inbox-content h2{font-size:16px;line-height:1.4;font-weight:700;margin:0 0 6px}.notification-inbox .inbox-content p{font-size:13px;line-height:1.6;color:#718099;margin:0 0 8px;overflow-wrap:break-word}.notification-inbox .inbox-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:11px;color:#718099}.notification-inbox .inbox-state{border-radius:20px;background:#f1f5f9;color:#64748b;padding:4px 9px;font-weight:600}.notification-inbox .inbox-state.is-positive{background:#dcfce7;color:#15803d}.notification-inbox .is-class-invitation .inbox-state.is-negative{background:#fee2e2;color:#b91c1c}.notification-inbox .inbox-check{width:24px;height:24px;accent-color:var(--sc-primary,#198754);margin-top:4px;cursor:pointer}.notification-inbox .is-task .inbox-check{accent-color:#b45309}.notification-inbox .is-class-invitation .inbox-check{accent-color:#7c3aed}.notification-inbox .inbox-check:disabled{opacity:.55;cursor:default}.notification-inbox [data-inbox-error]{grid-column:2/-1;color:#b91c1c;font-size:12px}.notification-inbox [data-inbox-reason]{grid-column:2/-1;color:#718099;font-size:12px}.notification-inbox .inbox-empty{padding:28px;text-align:center;color:#718099}
CSS);
?>
<div class="notification-inbox container-fluid py-3" data-notification-inbox data-labels="<?= Html::encode(Json::encode($labels)) ?>">
<?= \common\widgets\GymPageHeader::widget(['title'=>$this->title,'section'=>'group_notifications_title','icon'=>'bx bx-bell','showCompany'=>false]) ?>
<div class="inbox-list"><div class="inbox-count"><?= Yii::t('app','notification_history_count',['n'=>(int)$provider->getTotalCount()]) ?></div>
<?php foreach($provider->getModels() as $row):
 $kind=$row['type'];$checked=(bool)$row['read'];$invitation=$kind==='class-invitation';
 $state=$kind==='task'?($checked?$labels['completed']:$labels['pending']):($checked?$labels['readState']:$labels['unreadState']);
 $action=$kind==='task'?Url::to(['/task-operations/set-completed']):Url::to(['/group-notifications/mark-read','id'=>$row['id']]);
 $attrs=['class'=>'inbox-row is-'.$kind.($checked?'':' is-unread'),'data-inbox-row'=>'1','data-kind'=>$kind,'data-id'=>$row['id'],'data-title'=>$row['title'],'data-action'=>$action];
 if($invitation){$attrs['data-booking-query']=Json::encode($row['bookingQuery']);$attrs['data-schedule']=$row['schedule'];}
 $icon=['task'=>'bx-task','class-invitation'=>'bx-calendar-check'][$kind]??'bx-bell';
?>
<?= Html::beginTag('article',$attrs) ?>
<span class="inbox-icon" aria-hidden="true"><i class="bx <?= Html::encode($icon) ?>"></i></span>
<a class="inbox-content" href="<?= Html::encode(Url::to($row['url'])) ?>"><h2><?= Html::encode($row['title']) ?></h2><p><?= Html::encode($row['body']) ?></p><div class="inbox-meta">
<?php if($row['created_at']): ?><time datetime="<?= date('c',$row['created_at']) ?>"><?= date('d/m/Y H:i',$row['created_at']) ?></time><?php else: ?><span><?= Html::encode($labels['unknownDate']) ?></span><?php endif ?>
<span data-inbox-state class="inbox-state<?= $checked?' is-positive':'' ?>"><?= Html::encode($invitation?'…':$state) ?></span></div></a>
<?= Html::checkbox('notification-state',$invitation?false:$checked,['class'=>'inbox-check','data-inbox-check'=>'1','data-checked'=>$checked?'1':'0','disabled'=>$invitation,'aria-label'=>($kind==='task'?($checked?$labels['reopen']:$labels['complete']):($checked?$labels['unread']:$labels['read'])).': '.$row['title']]) ?>
<span data-inbox-reason></span><span data-inbox-error role="status" aria-live="polite"></span>
</article>
<?php endforeach ?>
<?php if(!$provider->getTotalCount()): ?><div class="inbox-empty"><?= Yii::t('app','group_notifications_empty') ?></div><?php endif ?>
</div><div class="mt-3"><?= \yii\widgets\LinkPager::widget(['pagination'=>$provider->pagination]) ?></div></div>
