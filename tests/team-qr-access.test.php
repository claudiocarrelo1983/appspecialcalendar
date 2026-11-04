<?php
require __DIR__.'/gym-team-active-company.test.php';
$db->createCommand()->update('company',['active'=>1],['company_code'=>'FTX'])->execute();
$db->createCommand()->createTable('user_roles_permissions_crud',[
 'id'=>'pk','company_code'=>'string','company'=>'string','level'=>'string','page'=>'string',
 'view'=>'integer','create'=>'integer','edit'=>'integer','delete'=>'integer',
])->execute();
Yii::$app->request->hostInfo='https://specialcalendar.com';
account(70,'FTX');
$allow=static fn($operation='view')=>common\helpers\GymMemberQrAccess::can($operation);
expect(!$allow(),'Missing Members permission must hide scanning');
$db->createCommand()->update('user_roles_permissions',['permissions'=>'t-members-list'],['company_code'=>'FTX','level'=>'team'])->execute();
expect(common\helpers\GymMemberQrAccess::canScan(),'Client-details View alone enables scanning');
expect(!$allow(),'Client-details View alone does not expose attendance');
expect(!$allow('create'),'Client-details View alone does not allow recording attendance');
$db->createCommand()->update('user_roles_permissions',['permissions'=>'t-members-list,t-members-attendance'],['company_code'=>'FTX','level'=>'team'])->execute();
expect($allow(),'Team with Members and Attendance must see scanning');
expect($allow('create'),'No CRUD override preserves existing allowed create');
$db->createCommand()->insert('user_roles_permissions_crud',['company_code'=>'FTX','company'=>'specialcalendar','level'=>'team','page'=>'t-members-attendance','view'=>1,'create'=>0,'edit'=>0,'delete'=>0])->execute();
expect($allow(),'Read-only Team can scan and inspect the confirmation page');
foreach(['create','edit','delete']as$operation)expect(!$allow($operation),'Read-only attendance must reject '.$operation);
$db->createCommand()->update('user_roles_permissions_crud',['create'=>1],['page'=>'t-members-attendance'])->execute();
expect($allow('create'),'Existing Attendance Create enables check-in');
$db->createCommand()->insert('user_roles_permissions_crud',['company_code'=>'FTX','company'=>'specialcalendar','level'=>'team','page'=>'t-members-list','view'=>0])->execute();
expect(!$allow(),'Members View denial must hide scanner');
expect(!common\helpers\GymMemberQrAccess::canScan(),'Explicit client-details View denial hides scan action');
account(71,'DEMO');expect(!$allow(),'FTX permissions must not grant Demo access');
account(72,'FTX','client');expect(!$allow(),'Client must not receive staff scanner');
account(73,'FTX','admin');expect($allow('create'),'Existing admin scanner retained');
Yii::$app->user->setIdentity(null);Yii::$app->activeCompany->reset();expect(!$allow(),'Guest scanner denied');
echo "Team QR permissions: $checks combined SQLite checks passed.\n";
