<?php
namespace common\helpers;
use Yii;
class NativeAuthPresentation
{
    public static function messages(): array
    {
        $flashes=Yii::$app->session->getAllFlashes(false);$messages=[];
        foreach(['success','error','warning'] as $key){
            if(isset($flashes[$key])&&is_string($flashes[$key])){
                $message=trim(strip_tags($flashes[$key]));
                if($message!=='')$messages[]=mb_substr($message,0,2000);
            }
        }
        return array_values(array_unique($messages));
    }
}
