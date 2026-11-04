<?php
namespace frontend\controllers;
use Yii;
use common\helpers\SecurityAccess;
use common\helpers\NativeWorkoutHistory;
use yii\filters\VerbFilter;
use yii\web\Controller;
use yii\web\ForbiddenHttpException;
use yii\web\UnauthorizedHttpException;
class NativeWorkoutsController extends Controller
{
    public function behaviors(){return ['verbs'=>['class'=>VerbFilter::class,'actions'=>['sync'=>['POST'],'index'=>['GET']]]];}
    private function scope(): array
    {
        Yii::$app->response->format=\yii\web\Response::FORMAT_JSON;
        Yii::$app->response->headers->set('Cache-Control','no-store, private');
        if(Yii::$app->user->isGuest)throw new UnauthorizedHttpException();
        $user=Yii::$app->user->identity;$company=SecurityAccess::companyCode();
        $host=\common\models\Company::find()->where(['company_code'=>$company,'active'=>1])->one();
        if(!$host||!(int)$user->active)throw new ForbiddenHttpException();
        if(preg_match('/^(c[0-9]+)\.specialcalendar\.com$/D',Yii::$app->request->hostName,$match)&&$host->company_code_url!==$match[1])throw new ForbiddenHttpException();
        return [$company,(int)$user->id,hash('sha256',$company.':'.$user->guid)];
    }
    public function actionSync()
    {
        [$company,$userId,$key]=$this->scope();
        $owner=Yii::$app->request->post('ownerKey');
        if(!is_string($owner)||!hash_equals($key,$owner))throw new ForbiddenHttpException();
        $json=Yii::$app->request->post('rows');
        if(!is_string($json)||strlen($json)>32768)throw new \yii\web\BadRequestHttpException();
        try{$rows=json_decode($json,true,16,JSON_THROW_ON_ERROR);}catch(\Throwable $error){throw new \yii\web\BadRequestHttpException();}
        return ['success'=>true,'ids'=>NativeWorkoutHistory::store($company,$userId,$rows)];
    }
    public function actionIndex()
    {
        [$company,$userId,$key]=$this->scope();
        return ['success'=>true,'ownerKey'=>$key,'rows'=>(new \yii\db\Query())->from('{{%native_workout_history}}')->select(['workout_id','mode','duration_seconds','finished_at'])->where(['company_code'=>$company,'user_id'=>$userId])->orderBy(['finished_at'=>SORT_DESC])->limit(200)->all()];
    }
}
