<?php
require __DIR__.'/team-qr-access.test.php';
Yii::$app->i18n->translations['app'] = new yii\i18n\PhpMessageSource(['basePath'=>$workspace.'/frontend/messages']);
Yii::$app->request->setQueryParams(['qr_scanned'=>'1']);
$member=(object)['id'=>1619,'full_name'=>'Member <One>','username'=>'member'];
$render=static fn()=>Yii::$app->view->renderFile($workspace.'/frontend/views/clients-list/_qr-checkin-action.php',['model'=>$member]);
account(90,'FTX');
$db->createCommand()->update('user_roles_permissions_crud',['view'=>1],['page'=>'t-members-list'])->execute();
$html=$render();
expect(str_contains($html,'data-member-checkin-action'),'Attendance View/Create exposes a prominent check-in action');
expect(str_contains($html,'gym-checkin') && str_contains($html,'1619'),'Action carries the scanned member into confirmation');
expect(str_contains($html,'Member &lt;One&gt;'),'Member name is escaped');
$db->createCommand()->update('user_roles_permissions_crud',['create'=>0],['page'=>'t-members-attendance'])->execute();
$html=$render();
expect(!str_contains($html,'data-member-checkin-action'),'Read-only Team cannot see a check-in action');
expect(str_contains($html,'data-member-checkin-unavailable'),'Read-only scan explains the missing grant');
Yii::$app->request->setQueryParams([]);
expect(trim($render())==='','Ordinary read-only member viewing does not show a scan warning');
echo "QR main action: $checks combined checks passed.\n";
