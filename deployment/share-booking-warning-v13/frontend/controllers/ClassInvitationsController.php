<?php
namespace frontend\controllers;

use common\helpers\ClassInvitations;
use common\helpers\CompanyNotificationService;
use common\helpers\SecurityAccess;
use Yii;

class ClassInvitationsController extends \yii\web\Controller
{
    private $company;
    public function behaviors()
    {
        return ['verbs'=>['class'=>\yii\filters\VerbFilter::class,'actions'=>['recipients'=>['GET'],'send'=>['POST']]]];
    }
    public function beforeAction($action)
    {
        Yii::$app->response->format=\yii\web\Response::FORMAT_JSON;
        if (!parent::beforeAction($action)) return false;
        if (Yii::$app->user->isGuest) throw new \yii\web\UnauthorizedHttpException();
        $host=Yii::$app->request->hostName;
        $this->company=ClassInvitations::companyForHost($host,
            preg_match('/^c[0-9]+\.specialcalendar\.com$/Di',$host)?null:SecurityAccess::companyCode());
        if (!ClassInvitations::canShare($this->company)) throw new \yii\web\ForbiddenHttpException();
        return true;
    }
    public function actionRecipients()
    {
        $q=Yii::$app->request->get('q','');
        if (!is_string($q)||mb_strlen($q)>100) throw new \yii\web\BadRequestHttpException();
        Yii::$app->response->headers->set('X-SC-Class-Invitations','search-v2');
        if (mb_strlen(trim($q))<2) return $this->asJson(['success'=>true,'clients'=>[]]);
        $users=ClassInvitations::searchClients($this->company,trim($q))->all();
        $clients=[];
        foreach ($users as $user) $clients[]=['id'=>(int)$user->id,'name'=>ClassInvitations::clientName($user)];
        return $this->asJson(['success'=>true,'clients'=>$clients]);
    }
    public function actionSend()
    {
        $post=Yii::$app->request->post();
        $schedule=filter_var($post['schedule_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
        $recipient=filter_var($post['recipient_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
        if (!$schedule||!$recipient) throw new \yii\web\BadRequestHttpException();
        try {
            $notice=ClassInvitations::send($this->company,$schedule,$post['date']??null,$recipient,$post['token']??null);
        } catch (\yii\web\ConflictHttpException $error) {
            if ($error->getCode()!==4202) throw $error;
            Yii::$app->response->statusCode=409;
            return $this->asJson(['success'=>false,'reason'=>'already_booked','message'=>Yii::t('app','This client is already booked for this class.')]);
        } catch (\yii\web\BadRequestHttpException $error) {
            if ($error->getCode()!==4201) throw $error;
            Yii::$app->response->statusCode=409;
            return $this->asJson(['success'=>false,'reason'=>'class_started','message'=>Yii::t('app','This class has already started. Choose an upcoming class.')]);
        }
        // A booking belongs to the selected recipient, never to the sender.
        try { CompanyNotificationService::dispatch(1,$notice->id); }
        catch (\Throwable $error) { Yii::warning('Class invitation saved; push delivery remains queued.','mobile-push'); }
        return $this->asJson(['success'=>true,'id'=>(int)$notice->id]);
    }
}
