<?php
namespace frontend\controllers;

use Yii;
use common\helpers\AccountLoginWarnings;
use yii\filters\VerbFilter;

class AccountLoginWarningController extends \frontend\controllers\api\v1\BaseApiController
{
    public function behaviors()
    {
        return parent::behaviors() + ['verbs'=>['class'=>VerbFilter::class,'actions'=>['status'=>['GET'],'acknowledge'=>['POST'],'logout'=>['POST']]]];
    }
    public function beforeAction($action)
    {
        Yii::$app->response->headers->set('Cache-Control','no-store, private');
        return parent::beforeAction($action);
    }
    public function actionStatus()
    {
        if ($response = $this->requireAuthenticated()) return $response;
        if (!AccountLoginWarnings::available()) return $this->success(['enabled'=>false,'warning'=>null]);
        $token = AccountLoginWarnings::status((int)Yii::$app->user->id, AccountLoginWarnings::deviceHash());
        $portuguese = str_starts_with((string)(Yii::$app->user->identity->language_site ?? Yii::$app->language), 'pt');
        return $this->success(['enabled'=>true,'warning'=>$token ? ['token'=>$token,
            'title'=>Yii::t('app',$portuguese ? 'Sessão iniciada noutro dispositivo' : 'Account signed in on another device'),
            'message'=>Yii::t('app',$portuguese ? 'Esta conta tem sessão iniciada noutro dispositivo. Pode continuar ou terminar a sessão neste dispositivo. Se não reconhecer este acesso, altere a sua palavra-passe.' : 'This account is signed in on another device. You can continue or log out of this device. If you do not recognize this login, change your password.'),
            'continueLabel'=>$portuguese ? 'Continuar' : 'Continue',
            'logoutLabel'=>$portuguese ? 'Terminar sessão neste dispositivo' : 'Log out this device',
            'logoutError'=>$portuguese ? 'Não foi possível terminar a sessão. Tente novamente ou use o menu da conta.' : 'Could not log out. Try again or use the account menu.'] : null]);
    }
    public function actionAcknowledge()
    {
        if ($response = $this->requireAuthenticated()) return $response;
        $token = Yii::$app->request->post('token');
        if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D',$token)) return $this->error('Invalid warning.',[],422);
        if (AccountLoginWarnings::available()) AccountLoginWarnings::acknowledge((int)Yii::$app->user->id,AccountLoginWarnings::deviceHash(),$token);
        return $this->success();
    }
    public function actionLogout()
    {
        if ($response = $this->requireAuthenticated()) return $response;
        $token = Yii::$app->request->post('token');
        if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D',$token)) return $this->error('Invalid warning.',[],422);
        // A delayed warning must never log out a different account/session.
        if (!AccountLoginWarnings::available() || AccountLoginWarnings::status((int)Yii::$app->user->id,AccountLoginWarnings::deviceHash()) !== $token) {
            return $this->error('This warning is no longer active.',[],409);
        }
        if (!Yii::$app->user->logout()) return $this->error('Could not log out.',[],409);
        return $this->success();
    }
}
