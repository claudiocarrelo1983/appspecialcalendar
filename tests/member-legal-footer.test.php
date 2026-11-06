<?php
require __DIR__.'/gym-team-active-company.test.php';
Yii::setAlias('@frontend',$workspace.'/frontend');
Yii::setAlias('@web','');
Yii::$app->request->enableCsrfValidation=false;
Yii::$app->request->setHostInfo('https://club.example');
Yii::$app->controller=new yii\web\Controller('privacy-policy',Yii::$app);
Yii::$app->i18n->translations['legal']=['class'=>yii\i18n\PhpMessageSource::class,'basePath'=>$workspace.'/frontend/messages','forceTranslation'=>true];
account(98,'FTX','client');$identity=Yii::$app->user->identity;
$partial=$workspace.'/frontend/views/client/login/_legal-links.php';
$partialHash=hash_file('sha256',$partial);
foreach(['pt','en']as$language)foreach([true,false]as$signedIn)foreach([true,false]as$settings){
 Yii::$app->language=$language;Yii::$app->user->setIdentity($signedIn?$identity:null);
 Yii::$app->request->setQueryParams($settings?['legal_context'=>'member-settings']:[]);
 $html=Yii::$app->view->renderFile($workspace.'/frontend/views/site/texts/company-legal.php',[
  'companyArr'=>['company_name'=>'Test club','color'=>'#198754','company_logo'=>'https://club.example/logo.png'],
  'pagecode'=>'test-club','document'=>'privacy','legalContent'=>'<p>UNCHANGED_LEGAL_CONTENT</p>',
 ]);
 $hide=$signedIn&&$settings;
 expect((strpos($html,'<nav class="public-legal-links')===false)===$hide,'Public legal footer visibility follows authenticated Settings context');
 expect((strpos($html,'<header class="company-legal-header">')===false)===$hide,'Public login header visibility follows authenticated Settings context');
 expect((strpos(rawurldecode($html),'site/login')===false)===$hide,'Guest and normal legal pages retain login destinations');
 expect(strpos($html,'UNCHANGED_LEGAL_CONTENT')!==false,'Legal document content unchanged');
}
expect(hash_file('sha256',$partial)===$partialHash,'Shared login links partial unchanged');
echo "Member legal footer: authenticated Settings and guest/public EN/PT render checks passed.\n";
