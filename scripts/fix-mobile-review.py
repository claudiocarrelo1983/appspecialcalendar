from pathlib import Path
import re,json
root=Path(r'C:\inetpub\wwwroot\workspace')
changed=[]
def edit(file,old,new):
 p=root/file;s=p.read_text(encoding='utf-8-sig');assert old in s,file+' missing anchor';p.write_text(s.replace(old,new),encoding='utf-8');changed.append(file)
def write(file,text):
 p=root/file;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf-8');changed.append(file)
# Canonical list titles come from the menu; CRUD retains its record/action title.
for layout,var in [('admin.php','gymHeading'),('main.php','gymMenuPage')]:
 edit('frontend/views/layouts/'+layout,"'title'=>$this->title?:$"+var+"['title']","'title'=>($"+var+"['action']==='index'?$"+var+"['title']:($this->title?:$"+var+"['title']))")
# Do not hide an action group just because the duplicate heading widget is empty.
edit('frontend/web/css/gym-ui.css','.gym-menu-content .backoffice-page-title > .d-flex:first-child,','.gym-menu-content .backoffice-page-title > .d-flex:first-child:not(:has(a,button)),')
edit('frontend/views/events-list/_form.php','class="form-check-input"\n','class="form-check-input"\n                                                    aria-label="\' . Html::encode($label) . \'"\n')
edit('frontend/controllers/GroupNotificationsController.php',"$this->company=SecurityAccess::companyCode();","\\common\\helpers\\PermissionsHelpers::adminLaguagesSet();\n        $this->company=SecurityAccess::companyCode();")
# FAQ is a real signed-in support page, but cannot be resolved through the gym menu.
edit('common/helpers/GymMenuHelper.php',"if($best===null)return null;","if($best===null&&$path==='faqs-admin')$best=['title'=>'faqs_admin','icon'=>'bx bx-help-circle','path'=>'faqs-admin','parents'=>[]];\n        if($best===null)return null;")
edit('frontend/controllers/FaqsAdminController.php','return Helpers::adminBeforeAction($this);',"// Authenticated help does not require an unrelated gym menu permission.\n        return Helpers::adminBeforeAction($this, false, true);")
# Mobile plan intro is already the plan name; preserve the feature list without repeating it.
edit('frontend/views/my-plan/index.php','<h2 class="h4 fw-bold"><?= Html::encode($t(\'classes_plan_name\')) ?></h2>','<h2 class="h4 fw-bold my-plan-feature-title"><?= Html::encode($t(\'classes_plan_name\')) ?></h2>')
css='''
/* Review fixes: keep embedded mobile pages within their native frame. */
@media(max-width:767.98px){
 .gym-app-layout .company-settings-nav{flex-wrap:wrap!important;overflow:visible!important;gap:6px;}
 .gym-app-layout .company-settings-nav a{flex:1 1 calc(50% - 6px);min-width:0;white-space:normal;}
 .gym-app-layout .my-plan-feature-title{display:none;}
 .gym-app-layout .payments-setup-page,.gym-app-layout .payments-setup-card,.gym-app-layout .payments-setup-guide{min-width:0;max-width:100%;}
 .gym-app-layout .payments-setup-guide-head>div,.gym-app-layout .payments-setup-step>div{min-width:0;overflow-wrap:anywhere;}
 .gym-app-layout .payments-setup-steps{grid-template-columns:minmax(0,1fr)!important;}
 .gym-app-layout .payments-setup-step{grid-template-columns:auto minmax(0,1fr)!important;min-width:0;white-space:normal;}
 .gym-app-layout .payments-setup-tabs{padding:4px;gap:4px;}
 .gym-app-layout .payments-setup-tabs .nav-link{margin:0!important;padding:10px 6px;white-space:normal;}
 .gym-app-layout .payments-setup-tabs .nav-link.active{background:var(--gym-app-brand)!important;color:white!important;}
 .gym-app-layout .payments-setup-tabs .nav-link.active :is(i,span){color:white!important;}
}
'''
p=root/'frontend/web/css/gym-mobile-layout.css';p.write_text(p.read_text(encoding='utf-8-sig')+css,encoding='utf-8');changed.append('frontend/web/css/gym-mobile-layout.css')
# Reviewed translations override stale generated strings on this payment screen.
en={
'how_to_setup_payments':'How to set up payments','payments_setup_intro':'Use these steps to connect Stripe Checkout to paid class bookings.',
'create_or_open_stripe_account':'Create or open your Stripe account','create_or_open_stripe_account_hint':'Open your company Stripe Dashboard and confirm the account is verified to receive payments and transfers.',
'copy_stripe_secret_key':'Copy the secret key','copy_stripe_secret_key_hint':'In Developers > API keys, copy the key for the correct environment and paste it in Sandbox or Production on this page.',
'configure_stripe_webhook':'Configure the webhook','configure_stripe_webhook_hint':'In Developers > Webhooks, add the endpoint below and select these events:',
'localhost_stripe_cli_hint':'On localhost, use the Stripe CLI to forward events to this local endpoint.',
'enable_and_test_payments':'Enable and test','enable_and_test_payments_hint':'Save these settings, connect your Stripe account and make a test booking before switching to Production.',
'active':'Active','inactive':'Inactive','configuration':'Configuration','management':'Management','integration_ready':'Integration ready','not_configured':'Not configured',
'stripe_checkout_enabled':'Stripe Checkout enabled','sandbox':'Sandbox','production':'Production','stripe_environment':'Stripe environment',
'platform_commission_bps':'Platform commission (bps)','stripe_test_secret_key':'Stripe sandbox secret key','stripe_live_secret_key':'Stripe production secret key',
'secret_key_leave_blank':'Leave blank to keep the saved key.','stripe_test_webhook_secret':'Sandbox webhook signing secret','stripe_live_webhook_secret':'Production webhook signing secret',
'webhook_secret_leave_blank':'Leave blank to keep the saved signing secret. It must start with whsec_.','stripe_connected_account':'Connected Stripe account',
'recipient_transfers_status':'Transfers to the club','account_requirements_due':'Outstanding requirements',
'stripe_account_not_connected_hint':'The API key is saved, but the Stripe account is not connected yet. Use the button to open Stripe onboarding.',
'connect_stripe_account':'Connect Stripe account','update_stripe_account':'Update Stripe account','webhook_url':'Webhook URL','webhook_secret_configured':'Webhook secret configured',
'webhook_secret_not_configured':'Webhook secret not configured','webhook_delivery_status':'Webhook delivery','no_webhook_delivery_yet':'No deliveries received yet',
'stripe_fees':'Stripe fees','stripe_fees_portugal_notice':'Stripe Portugal/EEA example: standard EEA cards 1.5% + €0.25. The final fee may vary by method, card and account.',
'stripe_pricing':'Stripe pricing','configure_individual_class_prices':'Configure class prices',
'individual_team_permissions':'Individual team permissions','select_team_member':'Select a team member','role_defaults':'Use role defaults',
'individual_permissions_hint':'Select a team member to edit their access without changing permissions for the rest of the team.',
'individual_permissions_setup':'Individual permissions require the server migration before they can be edited.',
}
payment=root/'frontend/views/payments-setup/index.php';paymentText=payment.read_text(encoding='utf-8-sig')
pt={key:fallback for key,fallback in re.findall(r"\$paymentT\('([^']+)', '([^']*)'",paymentText)}
pt.update({'connect_stripe_account':'Ligar conta Stripe','update_stripe_account':'Atualizar conta Stripe','integration_ready':'Integração pronta','not_configured':'Não configurado',
'webhook_secret_configured':'Webhook secret configurado','webhook_secret_not_configured':'Webhook secret não configurado',
'individual_team_permissions':'Permissões individuais da equipa','select_team_member':'Selecionar membro da equipa','role_defaults':'Usar permissões do perfil',
'individual_permissions_hint':'Selecione um membro para editar o seu acesso sem alterar as permissões do resto da equipa.',
'individual_permissions_setup':'As permissões individuais requerem a migração do servidor antes de serem editadas.'})
for lang,values in [('en',en),('pt',pt)]:
 file='common/messages/'+lang+'/mobile-review.php'
 write(file,'<?php\nreturn '+"[\n"+''.join('    '+json.dumps(k,ensure_ascii=False)+' => '+json.dumps(v,ensure_ascii=False).replace('\\/', '/')+',\n' for k,v in values.items())+'];\n')
edit('frontend/views/payments-setup/index.php',"$paymentT = static function ($key, $fallback) {\n    $text = Yii::t('app', $key);", "$paymentLabels = require Yii::getAlias('@common/messages/' . (strpos(strtolower(Yii::$app->language),'pt')===0?'pt':'en') . '/mobile-review.php');\n$paymentT = static function ($key, $fallback) use ($paymentLabels) {\n    if(isset($paymentLabels[$key]))return $paymentLabels[$key];\n    $text = Yii::t('app', $key);")
edit('frontend/views/payments-setup/index.php',"$paymentT('connect_stripe_account', $stripeConnectActionLabel)","$paymentT($stripePaymentSettings->isConnected()?'update_stripe_account':'connect_stripe_account', $stripeConnectActionLabel)")
write('deployment/mobile-review-fixes/changed-files.json',json.dumps(changed,indent=2))
print('Updated',len(changed),'workspace files')
