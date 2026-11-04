<?php
namespace frontend\assets;

use Yii;
use yii\helpers\Json;
use yii\web\AssetBundle;
use yii\web\View;

class GymMobileLayoutAsset extends AssetBundle
{
    public $basePath='@webroot';
    public $baseUrl='@web';
    public $css=['css/gym-shared-theme.css','css/gym-mobile-layout.css'];
    public $js=['js/gym-position.js','js/gym-mobile-layout.js'];
    public $depends=['yii\web\YiiAsset'];

    public function init()
    {
        parent::init();
        foreach(['css','js'] as $type)foreach($this->{$type} as $index=>$file){
            $path=Yii::getAlias('@frontend/web/').$file;
            if(is_file($path))$this->{$type}[$index].='?v='.substr(hash_file('sha256',$path),0,16);
        }
    }

    public static function register($view)
    {
        $bundle=parent::register($view);
        $view->registerJs('window.gymMobileLayoutLabels='.Json::htmlEncode([
            'search'=>Yii::t('app','gym_layout_search'),'filter'=>Yii::t('app','gym_layout_filter'),
        ]).';',View::POS_HEAD,'gym-mobile-layout-labels');
        return $bundle;
    }
}
