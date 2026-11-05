<?php
namespace frontend\controllers;

use common\helpers\CompanyNotificationService as Service;
use common\helpers\SecurityAccess;
use common\models\CompanyNotification;
use common\models\CompanyNotificationForm;
use common\models\CompanyNotificationRecipient;
use Yii;
use yii\data\ActiveDataProvider;
use yii\filters\VerbFilter;
use yii\web\Controller;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

class GroupNotificationsController extends Controller
{
    public $layout='admin';
    private $company;
    public function behaviors()
    {
        return ['verbs'=>['class'=>VerbFilter::class,'actions'=>[
            'dropdown'=>['GET'],'index'=>['GET'],'sent'=>['GET'],'view'=>['GET'],'recipients'=>['GET'],
            'create'=>['GET','POST'],'mark-read'=>['POST'],'preview'=>['POST'],
        ]]];
    }
    public function beforeAction($action)
    {
        if (!parent::beforeAction($action)) return false;
        if (Yii::$app->user->isGuest) { Yii::$app->user->loginRequired(); return false; }
        \common\helpers\PermissionsHelpers::adminLaguagesSet();
        $this->company=SecurityAccess::companyCode();
        $this->layout='admin'.\common\helpers\Helpers::getUserAgent();
        if (in_array($action->id,['create','sent','recipients','preview'],true)&&!Service::canManage($this->company)) throw new ForbiddenHttpException();
        if (!in_array($action->id, ['dropdown','index'], true) && !Service::available()) throw new \yii\web\ServiceUnavailableHttpException(Yii::t('app','group_notifications_setup'));
        return true;
    }
    public function actionDropdown()
    {
        if (Yii::$app->user->identity->level === 'client') throw new ForbiddenHttpException();
        Yii::$app->response->headers->set('Cache-Control', 'no-store, private');
        return $this->renderPartial('/admin/notifications');
    }

    public function actionIndex()
    {
        return $this->render('index',[
            'provider'=>new \yii\data\ArrayDataProvider([
                'allModels'=>\common\helpers\NotificationInbox::rows($this->company,Yii::$app->user->identity),
                'pagination'=>['pageSize'=>20], 'key'=>'key',
            ]), 'sent'=>false, 'unified'=>true,
        ]);
    }
    public function actionSent()
    {
        return $this->render('index',['provider'=>new ActiveDataProvider(['query'=>CompanyNotification::find()->where(['company_code'=>$this->company])->orderBy(['id'=>SORT_DESC]),'pagination'=>['pageSize'=>20]]),'sent'=>true]);
    }
    public function actionCreate()
    {
        $form=new CompanyNotificationForm();
        $key='company-notification:'.$this->company.':'.Yii::$app->user->id;
        $token=Yii::$app->session->get($key);
        if (!$token) { $token=bin2hex(random_bytes(32)); Yii::$app->session->set($key,$token); }
        $form->submission_key=$token;
        if ($form->load(Yii::$app->request->post())&&$form->validate()) {
            $previous=CompanyNotification::findOne(['submission_key'=>$form->submission_key,'company_code'=>$this->company,'created_by'=>Yii::$app->user->id]);
            if ($previous) return $this->redirect(['view','id'=>$previous->id]);
            if (!hash_equals($token,(string)$form->submission_key)) throw new \yii\web\BadRequestHttpException();
            try {
                $notice=Service::create($form,$this->company);
                Yii::$app->session->remove($key);
                // Deliver small selections immediately; the worker drains larger groups.
                try { Service::dispatch(10,$notice->id); }
                catch (\Throwable $e) { Yii::warning('Group notification stored; push queue requires worker processing.','mobile-push'); }
                Yii::$app->session->setFlash('success',Yii::t('app','group_notifications_queued'));
                return $this->redirect(['view','id'=>$notice->id]);
            } catch (\InvalidArgumentException $e) { $form->addError('people',$e->getMessage()); }
            catch (\yii\db\IntegrityException $e) {
                $notice=CompanyNotification::findOne(['submission_key'=>$form->submission_key,'company_code'=>$this->company,'created_by'=>Yii::$app->user->id]);
                if ($notice) return $this->redirect(['view','id'=>$notice->id]);
                throw $e;
            }
        }
        $levels=Service::eligibleUsers($this->company)->select('recipient.level')->distinct()->column();
        $people=[];
        $selected=is_array($form->people)?array_values(array_filter($form->people,static function($id){return is_scalar($id)&&ctype_digit((string)$id);})):[];
        if ($selected) foreach(Service::eligibleUsers($this->company)->andWhere(['recipient.id'=>$selected])->all() as $user) $people[$user->id]=$user->full_name?:$user->username;
        return $this->render('create',compact('form','levels','people'));
    }
    public function actionRecipients($q='',$page=1)
    {
        $query=Service::eligibleUsers($this->company);
        $q=mb_substr((string)$q,0,100);
        if ($q!=='') $query->andWhere(['or',['like','recipient.full_name',$q],['like','recipient.username',$q]]);
        $rows=$query->orderBy(['recipient.full_name'=>SORT_ASC,'recipient.id'=>SORT_ASC])->offset((max(1,(int)$page)-1)*20)->limit(21)->all();
        $results=[];
        foreach(array_slice($rows,0,20) as $user) $results[]=['id'=>$user->id,'text'=>($user->full_name?:$user->username).' ('.$user->level.')'];
        return $this->asJson(['results'=>$results,'pagination'=>['more'=>count($rows)>20]]);
    }
    public function actionPreview()
    {
        $form=new CompanyNotificationForm();
        if (!$form->load(Yii::$app->request->post())||!$form->validate(['recipient_mode','levels','people'])) return $this->asJson(['count'=>0]);
        try { return $this->asJson(['count'=>count(Service::recipientIds($form,$this->company))]); }
        catch (\InvalidArgumentException $e) { return $this->asJson(['count'=>0]); }
    }
    public function actionView($id)
    {
        $notice=CompanyNotification::findOne(['id'=>$id,'company_code'=>$this->company]);
        $recipient=CompanyNotificationRecipient::findOne(['notification_id'=>$id,'company_code'=>$this->company,'user_id'=>Yii::$app->user->id]);
        $manage=Service::canManage($this->company);
        if (!$notice||(!$recipient&&!$manage)) throw new NotFoundHttpException();
        $provider=$manage?new ActiveDataProvider(['query'=>CompanyNotificationRecipient::find()->where(['notification_id'=>$id,'company_code'=>$this->company]),'pagination'=>['pageSize'=>20]]):null;
        return $this->render('view',compact('notice','recipient','provider'));
    }
    public function actionMarkRead($id)
    {
        // Existing callers omit checked and continue to mark the notice as read.
        $checked=Yii::$app->request->post('checked','1');
        if (!in_array($checked,['0','1',0,1],true)) throw new \yii\web\BadRequestHttpException();
        $recipient=CompanyNotificationRecipient::findOne(['notification_id'=>$id,'company_code'=>$this->company,'user_id'=>Yii::$app->user->id]);
        if (!$recipient) throw new NotFoundHttpException();
        $recipient->read_at=(int)$checked===1?($recipient->read_at?:time()):null;
        if (!Service::setRecipientRead($this->company,(int)Yii::$app->user->id,(int)$id,(int)$checked===1)) throw new \yii\web\ServerErrorHttpException();
        if (Yii::$app->request->isAjax) return $this->asJson(['success'=>true,'checked'=>(bool)$recipient->read_at]);
        return $this->redirect(['view','id'=>$id]);
    }
}
