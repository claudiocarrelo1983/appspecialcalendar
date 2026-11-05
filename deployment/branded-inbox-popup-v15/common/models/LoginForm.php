<?php

namespace common\models;

use Yii;
use yii\base\Model;
use common\helpers\Helpers;
use yii\db\ActiveRecord;
use yii\web\IdentityInterface;

/**
 * Login form
 */
class LoginForm extends Model
{
    public const PERSISTENT_LOGIN_DURATION = 30 * 24 * 60 * 60;

    const LEVEL_ATIVE = 'admin';
    public $username;
    public $password;

    public $field;

    public $voucher;

    public $voucher_parent;

    public $rememberMe = true;

    /** @var string|null Company scope supplied by the controller, never by form input. */
    public $companyCode;

    private $_user;


    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            // username and password are both required
            [['username', 'password'], 'required'],
            ['username', 'trim'],
            ['field', 'string'],
            // rememberMe must be a boolean value
            ['rememberMe', 'boolean'],
            // password is validated by validatePassword()
            ['password', 'validatePassword'],    
        ];
    }


    public function attributeLabels()
    {
        return [
            'username' => Yii::t('app', 'login_label_username_2'),
            'password' => Yii::t('app', 'login_label_password_2'),
        ];
    }

    public function validatePassword($attribute, $params)
    {
        if (\common\helpers\LoginThrottle::blocked($this->username)) {
            $this->addError($attribute, Yii::t('app', 'security_login_retry_later'));
            return;
        }

        $user = $this->getUser();  
        $password = trim((string)$this->password);
        $passwordValid = $user && !empty($user->password_hash)
            && Yii::$app->security->validatePassword($password, $user->password_hash);
        if (!$passwordValid) \common\helpers\LoginThrottle::failed($this->username);
        if ($passwordValid && (int)$user->status===User::STATUS_WAITING_LIST) {
            $this->addError($attribute,Yii::t('app','Your registration is awaiting administrator approval. You can sign in after approval.'));
            return;
        }

        Yii::info([
            'account_hash' => hash('sha256', strtolower((string)$this->username)),
            'user_found' => !empty($user),
            'password_hash_exists' => !empty($user->password_hash),
            'password_valid' => $passwordValid,
            'status' => $user->status ?? null,
            'active' => $user->active ?? null,
            'level' => $user->level ?? null,
        ], 'login-debug');

        if(isset($user->level)){
                
            $page = Helpers::decrypt($this->field,10);  
            if ($page === 'backend' && $user->level !== 'superadmin') {
                $this->addError($attribute, Yii::t('app', 'permission_denied'));
            }
    
            if($page == 'client' && $user->level == 'admin'){                       
                $this->addError($attribute, 'You have no permission'); 
            }   

            $companyPlan = $user->level == 'client'
                ? Helpers::arrCompanyPlan(['company_code' => $user->company_code])
                : [];

            if($page == 'mainsite' && $user->level == 'client' && ($companyPlan['plan_name'] ?? '') !== 'gym'){                       
                $this->addError($attribute, 'You have no permission'); 
            }        
     
        }

        if (!$this->hasErrors()) {      

            if (!$user || !$passwordValid) {          
                $this->addError($attribute, 'Incorrect username or password.');
            }

            /*
            $companyArr = Helpers::activeValidation($user->company_code);             

            if(isset($companyArr['active']) && $companyArr['active'] == false){    
                
                $this->addError($attribute, Yii::t('app', 'no_permission_not_active')); 
            }

           
            $companyArr = Helpers::activeValidation($user->company_code);             

            if(isset($companyArr['active']) && $companyArr['active'] == false){    
                
                $this->addError($attribute, Yii::t('app', 'no_permission_not_active')); 
            }else{

                $paymentNeeded = Helpers::validationPayment($user->company_code);
                
                if($paymentNeeded){
                    $this->addError($attribute, Yii::t('app', 'payment_missing')); 
                }else{
                    $error = Helpers::accessAccountAdmin($user);
                    switch($error){
                        case '1' : 
                            $this->addError($attribute, Yii::t('app', 'no_permission')); 
                            break;
                        case '2' : 
                            $this->addError($attribute, Yii::t('app', 'no_permission_trial')); 
                            break;
                    } 
                }            
            }
          
            */
    
    
         
            if(isset($user->status)){
                if (strtolower($user->status) !== '10') {        
                    $this->addError($attribute, 'Please check the validation email.');          
                }
            }
        }
    }

    /**
     * Validates the password.
     * This method serves as the inline validation for password.
     *
     * @param string $attribute the attribute currently being validated
     * @param array $params the additional name-value pairs given in the rule
     */
    public function validatePassword2($attribute, $params)
    {
        $user = $this->getUser();
        // Registration approval is independent of email verification.
        if ($user && (int)$user->status===User::STATUS_WAITING_LIST && $user->validatePassword($this->password)) {
            $this->addError($attribute,Yii::t('app','Your registration is awaiting administrator approval. You can sign in after approval.'));
            return;
        }
  

        $page = Helpers::decrypt($this->field,10);   
        
        //if (!$this->hasErrors()) {   
     
        switch ($page) {
            case 'backend':
                    $active = Helpers::accessAccountSuperAdmin($user);
    
                    if(!$active){   
                        $this->addError($attribute, Yii::t('app', 'no_permission')); 
                    }           
                break;
            case 'frontend':      

                $companyArr = Helpers::activeValidation($user->company_code);             
    
                if(isset($companyArr['active']) && $companyArr['active'] == false){    
                   
                    $this->addError($attribute, Yii::t('app', 'no_permission_not_active')); 
                }else{

                    $paymentNeeded = Helpers::validationPayment($user->company_code);

                    if($paymentNeeded){
                        $this->addError($attribute, Yii::t('app', 'payment_missing')); 
                    }else{
                        $error = Helpers::accessAccountAdmin($user);
                        switch($error){
                            case '1' : 
                                $this->addError($attribute, Yii::t('app', 'no_permission')); 
                                break;
                            case '2' : 
                                $this->addError($attribute, Yii::t('app', 'no_permission_trial')); 
                                break;
                        } 
                    }
                    
                
                }
            
                if(isset($user->level)){   
                    if ($user->level != 'admin' && $user->level != 'reseller') {   
                        $this->addError($attribute, 'You have no permission'); 
                    }    
                }

                if(isset($user->subscription_startingdate) && $user->subscription == 'trial'){ 

                    $dateNow = time(); //current timestamp
                    $dateSubscription = strtotime($user->subscription_startingdate); 
                
                    $dateDiference = $dateNow - $dateSubscription;
                    $days =  round($dateDiference / (60 * 60 * 24));
            
                    if ($days >= 30) {   
                        $this->addError($attribute, 'You ended the 30 days trial.'); 
                    } 
                } 
             

                break;
            case 'client': 
                $error = Helpers::accessAccountClient($user);    
              
                switch($error){
                    case '1' : 
                        $this->addError($attribute, 'no_permission'); 
                        break;
                    case '2' : 
                        $this->addError($attribute, 'no_permission_trial'); 
                        break;
                }     

                break;    
        }

     
      
    
        /*
        if(!empty($user->voucher_parent)){
            $userFound = User::findOne(['voucher' => $user->voucher_parent]);

            if(empty($userFound)){
                $this->addError($attribute, 'Voucher not found.');  
            }
    
            if(isset($userFound->status)){
                if($userFound->status != '10'){                  
                    $this->addError($attribute, 'Voucher not valid please speak with who gave you.');  
                }
            }   
        }
        */       

        if(isset($user->level)){
            if($page == 'frontend' && $user->level == 'client'){                       
                $this->addError($attribute, 'You have no permission'); 
            }    

            if($page == 'client' && $user->level == 'admin'){                       
                $this->addError($attribute, 'You have no permission'); 
            }

            if($page == 'client' && $user->level == 'admin'){                       
                $this->addError($attribute, 'You have no permission'); 
            }
        }


        if(isset($user->status)){
            if (strtolower($user->status) !== '10') {        
                $this->addError($attribute, 'Please check the validation email.');          
            }
        }

      /*
        if(isset($user->status) && isset($user->level)){
            if (strtolower($user->status) !== '10') {        
                $this->addError($attribute, 'You have no permission');          
            }

            if (strtolower($user->level) !== '10') {        
                $this->addError($attribute, 'You have no permission');          
            }
        }

        //$decrypt = Helpers::decrypt($model->field, '10');
       

      
       
        if(isset($user->level)){
            if (strtolower($user->level) !== 'admin') {        
                $this->addError($attribute, 'You have no permission');          
           }
        }
      
        if(isset($user->active)){
            if ($user->active == false) {        
                $this->addError($attribute, 'You user is not active.');          
        }
        }
        */

      
          
            if (!$user || !$user->validatePassword($this->password)) {
          
                $this->addError($attribute, 'Incorrect username or password.');
            }
        //}
    }

    /**
     * Logs in a user using the provided username and password.
     *
     * @return bool whether the user is logged in successfully
     */
    public function login()
    { 
        $validated = $this->validate();
        $user = $this->getUser();

       
        Yii::info([
            'account_hash' => hash('sha256', strtolower((string)$this->username)),
            'validated' => $validated,
            'user_found' => !empty($user),
            'status' => $user->status ?? null,
            'active' => $user->active ?? null,
            'errors' => $this->errors,
        ], 'login-debug');

        if ($validated) {    
            
            $loggedIn = Yii::$app->user->login($user, self::PERSISTENT_LOGIN_DURATION);
            if (!$loggedIn && Yii::$app->user instanceof \frontend\components\WebUser
                && Yii::$app->user->paymentAccessError !== null) {
                $this->addError('password', Yii::$app->user->paymentAccessError);
                // The form already displays this error beside the password.
                Yii::$app->session->removeFlash('warning');
            }
            if ($loggedIn) {
                \common\helpers\LoginThrottle::clear($this->username);
                Logs::recordUserSessionEvent($user, 'cleaner_login');
            }


            Yii::info([
                'account_hash' => hash('sha256', strtolower((string)$this->username)),
                'login_success' => $loggedIn,
                'user_id' => $user->id ?? null,
                'status' => $user->status ?? null,
                'active' => $user->active ?? null,
            ], 'login-debug');

            return $loggedIn;
        }
        
        return false;
    }

    /**
     * Finds user by [[username]] or email.
     *
     * @return User|null
     */
    protected function getUser()
    {
    
        if ($this->_user === null) {           
            $login = trim((string)$this->username);
            $query = User::find()
                ->where(['or', ['username' => $login], ['email' => $login]]);
            if ($this->companyCode !== null) {
                $query->andWhere(['company_code' => $this->companyCode, 'active' => 1])
                    ->orderBy(['id' => SORT_DESC]);
            }
            $this->_user = $query->one();

            Yii::info([
                'login' => $login,
                'lookup_by_username' => $this->_user && $this->_user->username === $login,
                'lookup_by_email' => $this->_user && $this->_user->email === $login,
                'user_found' => !empty($this->_user),
                'user_id' => $this->_user->id ?? null,
                'status' => $this->_user->status ?? null,
                'active' => $this->_user->active ?? null,
            ], 'login-debug');
        }

        return $this->_user;
    }
}
