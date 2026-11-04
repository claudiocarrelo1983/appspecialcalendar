from pathlib import Path
import json
r=Path(r'C:\inetpub\wwwroot\workspace');changed=[]
def edit(file,old,new):
 p=r/file;s=p.read_text(encoding='utf-8-sig');assert old in s,file;p.write_text(s.replace(old,new),encoding='utf-8');changed.append(file)
edit('common/helpers/PermissionsHelpers.php',"$permissionRow = Helpers::userRolesPermissionsArr($search);","$individual = IndividualTeamPermissions::current();\n        if ($individual !== null) return $individual['base'];\n        $permissionRow = Helpers::userRolesPermissionsArr($search);")
edit('common/helpers/PermissionsHelpers.php',"public static function permissionsController(){","public static function permissionsController(){\n        $individual = IndividualTeamPermissions::current();\n        if ($individual !== null && !IndividualTeamPermissions::routeAllowed($individual, Yii::$app->controller->route, static::getSidebarMenu()['left-menu'] ?? [])) return true;")
edit('frontend/controllers/PermissionsController.php',"$companyCode = $this->activeCompanyCode();",'''$companyCode = $this->activeCompanyCode();
        $individualClass = \\common\\helpers\\IndividualTeamPermissions::class;
        $canEditIndividuals = $individualClass::canManage($companyCode);
        $rawMember = Yii::$app->request->post('member_id', Yii::$app->request->get('member_id', '0'));
        if (!is_scalar($rawMember) || !ctype_digit((string)$rawMember)) throw new \\yii\\web\\BadRequestHttpException();
        $memberId = (int)$rawMember;
        $selectedMember = $memberId ? $individualClass::selected($companyCode, $memberId) : null;
        $individualPermissions = $selectedMember ? $individualClass::read($companyCode, $memberId) : null;
        $teamOptions = [];
        if ($canEditIndividuals) foreach ($individualClass::teamQuery($companyCode)->orderBy(['full_name'=>SORT_ASC,'id'=>SORT_ASC])->all() as $teamMember) $teamOptions[$teamMember->id] = $teamMember->full_name ?: $teamMember->username;
        if ($this->request->isPost && $memberId) {
            $payload = Yii::$app->request->post('UserRolesPermissions', []);
            $teamPermissions = is_array($payload) && is_array($payload['permissions']['team'] ?? null) ? $payload['permissions']['team'] : [];
            $individualClass::save($companyCode, $memberId, $teamPermissions, Yii::$app->request->post('use_role_defaults') === '1');
            return $this->redirect(['index','member_id'=>$memberId]);
        }''')
edit('frontend/controllers/PermissionsController.php',"'companyCode' => $companyCode,\n        ]);","'companyCode' => $companyCode,\n            'memberId'=>$memberId,'selectedMember'=>$selectedMember,'individualPermissions'=>$individualPermissions,'teamOptions'=>$teamOptions,'canEditIndividuals'=>$canEditIndividuals,\n        ]);")
edit('frontend/views/permissions/index.php',"unset($arrLevels['client']);","unset($arrLevels['client']);\n$memberId=$memberId??0;\nif($memberId)$arrLevels=['team'=>'team'];\n$individualLabels=require Yii::getAlias('@common/messages/'.(strpos(strtolower(Yii::$app->language),'pt')===0?'pt':'en').'/mobile-review.php');\n$individualT=static function($key)use($individualLabels){return $individualLabels[$key]??Yii::t('app',$key);};")
edit('frontend/views/permissions/index.php',"use (&$rolePermissionsCache, $company, $companyCode) {","use (&$rolePermissionsCache, $company, $companyCode, $individualPermissions) {\n    if($individualPermissions!==null)return in_array($permission,$individualPermissions['base'],true);")
edit('frontend/views/permissions/index.php',"use ($company, $companyCode) {","use ($company, $companyCode, $individualPermissions) {\n    if($individualPermissions!==null)return !empty($individualPermissions['crud'][$page][$crud]);")
old="<?php $form = ActiveForm::begin(['id' => 'permissions-form']); ?>"
new='''<?php if($canEditIndividuals??false): ?>
    <section class="card rounded-4 p-3 mb-3">
        <h2 class="h5"><?= Html::encode($individualT('individual_team_permissions')) ?></h2>
        <p class="text-muted"><?= Html::encode($individualT('individual_permissions_hint')) ?></p>
        <?php if(\\common\\helpers\\IndividualTeamPermissions::available()): ?>
            <?= Html::beginForm(['/permissions/index'],'get') ?>
            <?= Html::label($individualT('select_team_member'),'individual-team-member',['class'=>'form-label']) ?>
            <?= Html::dropDownList('member_id',$memberId,[0=>$individualT('role_defaults')]+$teamOptions,['id'=>'individual-team-member','class'=>'form-select mb-3']) ?>
            <?= Html::submitButton(Yii::t('app','view'),['class'=>'btn btn-primary-modern']) ?>
            <?= Html::endForm() ?>
        <?php else: ?><p role="status"><?= Html::encode($individualT('individual_permissions_setup')) ?></p><?php endif; ?>
    </section>
    <?php endif; ?>
    <?php $form = ActiveForm::begin(['id' => 'permissions-form']); ?>
    <?php if($memberId): ?>
        <?= Html::hiddenInput('member_id',$memberId) ?>
        <div class="alert alert-info"><?= Html::encode($selectedMember->full_name?:$selectedMember->username) ?></div>
        <?= Html::submitButton($individualT('role_defaults'),['class'=>'btn btn-reset-modern mb-3','name'=>'use_role_defaults','value'=>'1']) ?>
    <?php endif; ?>'''
edit('frontend/views/permissions/index.php',old,new)
p=r/'deployment/mobile-review-fixes/changed-files.json';files=json.loads(p.read_text());files+=changed+['common/helpers/IndividualTeamPermissions.php','console/migrations/m261103_110000_company_team_permissions.php'];p.write_text(json.dumps(list(dict.fromkeys(files)),indent=2));print('Integrated',len(changed),'permission edits')
