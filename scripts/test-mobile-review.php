<?php
// Pure checks only: no bootstrap, database or live account mutations.
$root='C:/inetpub/wwwroot/workspace';
function check($value,$message){if(!$value)throw new RuntimeException($message);}
$en=require $root.'/common/messages/en/mobile-review.php';$pt=require $root.'/common/messages/pt/mobile-review.php';
foreach(['how_to_setup_payments','payments_setup_intro','connect_stripe_account','update_stripe_account','webhook_secret_leave_blank'] as $key){check(!empty($en[$key])&&!empty($pt[$key]),'Missing translation '.$key);check($en[$key]!==$pt[$key],'Same payment translation '.$key);}
check($en['how_to_setup_payments']==='How to set up payments','English guide');
$css=file_get_contents($root.'/frontend/web/css/gym-ui.css');check(strpos($css,'.backoffice-page-title > .d-flex:first-child:not(:has(a,button))')!==false,'Header hides create actions');
$notifications=file_get_contents($root.'/frontend/controllers/GroupNotificationsController.php');check(strpos($notifications,'PermissionsHelpers::adminLaguagesSet();')!==false,'Notification locale not set');
$labels=file_get_contents($root.'/frontend/views/events-list/_form.php');check(strpos($labels,'aria-label="\' . Html::encode($label)')!==false,'Weekday labels missing');
foreach(['admin.php','main.php'] as $layout)check(strpos(file_get_contents($root.'/frontend/views/layouts/'.$layout),"['action']==='index'")!==false,'Menu titles not canonical');
echo "Mobile review source and PT/EN checks passed. No database or live account changed.\n";
