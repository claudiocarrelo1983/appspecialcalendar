<?php
// Pure proposal checks. Does not connect to a database or activate overrides.
require __DIR__.'/../deployment/mobile-review-fixes/common/helpers/IndividualTeamPermissions.php';
use common\helpers\IndividualTeamPermissions as Permissions;
function verify($value,$message){if(!$value)throw new RuntimeException($message);}
$menu=['left-menu'=>[['key'=>'members','url'=>'null','submenu'=>[['key'=>'clients','url'=>'clients-list/','submenu'=>[]]]]],'permissions'=>['feature_read']];
$permissions=Permissions::normalize(['clients'=>['view'=>1],'forged_admin'=>['base'=>'forged_admin'],'feature_read'=>['base'=>'feature_read']],$menu);
verify(in_array('clients',$permissions['base'],true)&&in_array('members',$permissions['base'],true),'Parent and child scope');
verify(!in_array('forged_admin',$permissions['base'],true),'Unlisted permissions must be rejected');
verify(Permissions::routeAllowed($permissions,'clients-list/view/7',$menu['left-menu']),'Selected view should be allowed');
foreach(['create','update/7','delete/7','duplicate/7'] as $route)verify(!Permissions::routeAllowed($permissions,'clients-list/'.$route,$menu['left-menu']),'Unselected CRUD must be denied');
$none=Permissions::normalize([],$menu);verify(!Permissions::routeAllowed($none,'clients-list/index',$menu['left-menu']),'Empty override must deny list access');
echo "Individual permission proposal normalization and route checks passed; integration remains inactive.\n";
