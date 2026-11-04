<?php
namespace common\helpers;

use Yii;
use common\models\Company;

class CompanyBranding
{
    public static function mobileLogoUrl($company=null): ?string
    {
        if($company===null){
            if(!Yii::$app->user->isGuest&&Yii::$app->has('activeCompany'))$company=Yii::$app->activeCompany->getCompany();
            if($company===null){$code=Helpers::findCompanyCode();if($code)$company=Company::findOne(['company_code'=>$code,'active'=>1]);}
        }
        $mobile=is_array($company)?($company['image_logo_mobile']??null):($company&&$company->hasAttribute('image_logo_mobile')?$company->image_logo_mobile:null);
        $path=is_array($company)?($company['path']??'/images/company/'):($company->path??'/images/company/');
        $url=$mobile?Helpers::companyLogoUrl(['image_logo'=>$mobile,'path'=>$path]):null;
        $url=$url?:Helpers::companyLogoUrl($company);
        if(!$url)return null;
        $file=Yii::getAlias('@webroot').$url;
        return $url.(is_file($file)?'?v='.filemtime($file):'');
    }
}
