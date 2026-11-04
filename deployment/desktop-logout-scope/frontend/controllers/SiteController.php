<?php

namespace frontend\controllers;

use common\models\CompanyPlan;
use frontend\models\ResendVerificationEmailForm;
use frontend\models\VerifyEmailForm;
use frontend\models\PasswordResetRequestForm;
use frontend\models\ResetPasswordForm;
use yii\base\InvalidArgumentException;
use yii\web\BadRequestHttpException;
use Yii;

use yii\web\Controller;
use yii\filters\VerbFilter;
use yii\filters\AccessControl;
use common\models\LoginForm;
use common\helpers\Helpers;

use common\models\User;
use frontend\models\ContactForm;
use frontend\models\SignupForm;
use yii\helpers\Json;
use common\models\GeneratorJson;
use common\models\Logs;
use common\models\Subscribers;
use yii\db\Query;
use common\helpers\PermissionsHelpers;
use common\helpers\HelpersCache;
use common\helpers\StripeHelpers;
use frontend\components\AuthHandler;
use frontend\models\Auth;
use common\models\SendingLog;
use common\models\Tickets;
use Da\QrCode\QrCode;
use Da\QrCode\Writer\SvgWriter;
use yii\helpers\Url;
use yii\web\Response;
use yii\web\NotFoundHttpException;

/**
 * Site controller
 */
class SiteController extends Controller
{   


    /**
     * {@inheritdoc}
     */
    public function behaviors()
    {   
        return [
            'access' => [
                'class' => AccessControl::className(),
                'only' => ['logout', 'signup'],
                'rules' => [
                    [
                        'actions' => ['signup','language'],
                        'allow' => true,
                        'roles' => ['?'],
                    ],
                    [
                        'actions' => ['logout'],
                        'allow' => true,
                        'roles' => ['@'],
                    ],
                ],
            ],
            'verbs' => [
                'class' => VerbFilter::className(),
                'actions' => [
                    'logout' => ['post'],
                    'language' => ['post'],
                    'language-client' => ['post'],
                ],
            ],
        ];
    }

    public function beforeAction($action)
    {
        try {
            if (!parent::beforeAction($action)) {
                return false;
            }
        } catch (BadRequestHttpException $exception) {
            if ($action->id === 'signup-client' && Yii::$app->request->isPost) {
                // Reject the stale submission, then show a fresh form without replaying credentials.
                Yii::warning('Expired signup form rejected; fresh form requested.', 'signup-csrf');
                Yii::$app->request->getCsrfToken(true);
                Yii::$app->session->setFlash('signup_csrf_warning', true);
                Yii::$app->response->redirect(['site/signup-client'], 303);
                return false;
            }
            if ($this->isRecoverableLoginCsrfError($action->id)) {
                Yii::warning([
                    'action' => $action->id,
                    'url' => Yii::$app->request->absoluteUrl,
                    'userIp' => Yii::$app->request->userIP,
                    'message' => $exception->getMessage(),
                ], 'login-csrf');

                Yii::$app->request->getCsrfToken(true);
                Yii::$app->session->setFlash('login_csrf_warning', true);
                Yii::$app->response->redirect($this->recoverLoginCsrfRoute($action->id));

                return false;
            }

            throw $exception;
        }

        // Check only when the user is logged in
        if ( !Yii::$app->user->isGuest)  {
            if (Yii::$app->session['userSessionTimeout'] < time()) {          
                Yii::$app->user->logout();
                $this->refresh();
            } else {        
                Yii::$app->session->set('userSessionTimeout', time() + Yii::$app->params['sessionTimeoutSeconds']);
                return true; 
            }
        } else {
            return true;
        }
    }

    private function isRecoverableLoginCsrfError($actionId)
    {
        return Yii::$app->request->isPost
            && in_array($actionId, ['login', 'login-mobile', 'login-reseller'], true);
    }

    private function prepareLoginPage()
    {
        Yii::$app->response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        Yii::$app->response->headers->set('Pragma', 'no-cache');
        Yii::$app->response->headers->set('Expires', '0');

        // A submitted login must authenticate its credentials even if an old
        // session or remember-me cookie has restored another account.
        if (Yii::$app->request->isPost && is_array(Yii::$app->request->post('LoginForm'))
            && !Yii::$app->user->isGuest) {
            Yii::$app->user->logout();
        }

        if (!Yii::$app->request->isPost) {
            Yii::$app->request->getCsrfToken();
        }
    }

    private function recoverLoginCsrfRoute($actionId)
    {
        switch ($actionId) {
            case 'login-mobile':
                return ['site/login-mobile'];
            case 'login-reseller':
                return ['site/login-reseller'];
            default:
                return ['site/login'];
        }
    }

    private function redirectAuthenticatedLogin($template = 'login')
    {
        if (Yii::$app->user->isGuest) {
            return null;
        }

        $session = Yii::$app->session;
        $previous = $session->get('authenticatedLoginRedirect');
        $userId = (string)Yii::$app->user->id;
        // If a dashboard immediately returns this identity to login, render the
        // login form instead of sending the same session around another loop.
        if (is_array($previous) && ($previous['user_id'] ?? null) === $userId
            && time() - (int)($previous['time'] ?? 0) < 15) {
            return null;
        }

        $session->set('authenticatedLoginRedirect', ['user_id' => $userId, 'time' => time()]);
        return $this->redirect($this->postLoginRoute($template));
    }



    /**
     * {@inheritdoc}
     */
    public function actions()
    {        
        return [          
              
            'captcha' => [
                'class' => 'yii\captcha\CaptchaAction',
                'fixedVerifyCode' => YII_ENV_TEST ? 'testme' : null,
            ],           
            'auth' => [
                'class' => 'yii\authclient\AuthAction',
                'successCallback' => [$this, 'onAuthSuccess'],
            ],
        ];
    }

    public function onAuthSuccess($client)
    {      
        (new AuthHandler($client))->handle();
    }

    public function actionAuthGoogle()
    {
        if (!Yii::$app->authClientCollection->hasClient('google')) {
            $message = empty(Yii::$app->params['auth_google_client_secret'])
                ? Yii::t('app', 'google_auth_client_secret_missing')
                : Yii::t('app', 'google_auth_not_configured');
            Yii::$app->session->setFlash('error', $message);
            return $this->redirect(['site/signup-client']);
        }

        return $this->redirect(['/page/auth', 'authclient' => 'google']);
    }

    public function actionGoogleSignupClient()
    {
        if (!$this->request->isPost) {
            return $this->redirect(['site/signup-client']);
        }

        $credential = (string)Yii::$app->request->post('credential', '');
        $clientId = Yii::$app->params['auth_google_client_id'] ?? Yii::$app->params['oauth2_client_id'] ?? null;

        if (empty($clientId)) {
            Yii::$app->session->setFlash('signup_errors', [Yii::t('app', 'google_auth_not_configured')]);
            return $this->redirect(['site/signup-client']);
        }

        if ($credential === '') {
            Yii::$app->session->setFlash('signup_errors', [Yii::t('app', 'google_auth_invalid')]);
            return $this->redirect(['site/signup-client']);
        }

        try {
            $client = new \Google\Client(['client_id' => $clientId]);
            $payload = $client->verifyIdToken($credential);
        } catch (\Throwable $exception) {
            Yii::error($exception->getMessage(), 'google-signup');
            Yii::$app->session->setFlash('signup_errors', [
                Yii::t('app', 'google_auth_invalid'),
                $exception->getMessage(),
            ]);
            return $this->redirect(['site/signup-client']);
        }

        if (!$payload) {
            Yii::error('Google ID token verification returned an empty payload.', 'google-signup');
            $payload = false;
        }

        if (!$payload || empty($payload['sub']) || empty($payload['email'])) {
            Yii::$app->session->setFlash('signup_errors', [Yii::t('app', 'google_auth_invalid')]);
            return $this->redirect(['site/signup-client']);
        }

        $formData = Yii::$app->request->post('SignupForm', []);
        $googleEmail = trim((string)$payload['email']);
        $formEmail = trim((string)($formData['email'] ?? ''));

        if ($formEmail !== '' && strcasecmp($formEmail, $googleEmail) !== 0) {
            $model = new SignupForm();
            $model->addError('email', Yii::t('app', 'google_signup_email_mismatch'));
            Yii::error($model->getErrors(), 'google-signup');
            Yii::$app->session->setFlash('signup_errors', $this->modelErrorList($model));
            return $this->redirect(['site/signup-client']);
        }

        $auth = Auth::find()->where([
            'source' => 'google',
            'source_id' => (string)$payload['sub'],
        ])->one();

        if ($auth && $auth->user) {
            Yii::$app->user->login($auth->user, 3600 * 24 * 30);
            Yii::$app->session->set('userSessionTimeout', time() + Yii::$app->params['sessionTimeoutSeconds']);
            return $this->redirect($this->postLoginRoute());
        }

        $user = User::find()->where(['email' => $payload['email']])->one();

        if ($user) {
            if (!$this->applyExistingGoogleSignupData($user, $formData)) {
                Yii::error($user->getErrors(), 'google-signup');
                Yii::$app->session->setFlash('signup_errors', $this->modelErrorList($user));
                return $this->redirect(['site/signup-client']);
            }

            $auth = new Auth([
                'user_id' => $user->id,
                'source' => 'google',
                'source_id' => (string)$payload['sub'],
            ]);

            try {
                $authSaved = $auth->save();
            } catch (\Throwable $exception) {
                Yii::error($exception->getMessage(), 'google-signup');
                Yii::$app->session->setFlash('signup_errors', [$exception->getMessage()]);
                return $this->redirect(['site/signup-client']);
            }

            if (!$authSaved) {
                Yii::error($auth->getErrors(), 'google-signup');
                Yii::$app->session->setFlash('signup_errors', $this->modelErrorList($auth));
                return $this->redirect(['site/signup-client']);
            }

            Yii::$app->user->login($user, 3600 * 24 * 30);
            Yii::$app->session->set('userSessionTimeout', time() + Yii::$app->params['sessionTimeoutSeconds']);
            return $this->redirect($this->postLoginRoute());
        }

        $formName = trim((string)($formData['full_name'] ?? ''));
        $name = $formName !== '' ? $formName : trim((string)($payload['name'] ?? $googleEmail));
        $nameParts = preg_split('/\s+/', $name, 2);

        $model = new SignupForm();
        $model->scenario = 'signupClient';
        $model->attributes = $formData;
        $model->full_name = $name;
        $model->first_name = $model->first_name ?: ($formName !== '' ? ($nameParts[0] ?? $name) : ($payload['given_name'] ?? ($nameParts[0] ?? $name)));
        $model->last_name = $model->last_name ?: ($formName !== '' ? ($nameParts[1] ?? $model->first_name) : ($payload['family_name'] ?? ($nameParts[1] ?? $model->first_name)));
        $model->email = $formEmail !== '' ? $formEmail : $googleEmail;
        $model->username = $model->username ?: 'adm' . Helpers::generateRandowHumber('5');
        $model->password = $model->password ?: Yii::$app->security->generateRandomString(32);
        $model->company = $model->company ?: $name;
        $model->plan_name = array_key_exists($model->plan_name, Helpers::dropdownSignupClientPlan()) ? $model->plan_name : 'basic';
        $model->contact_country_code = $model->contact_country_code ?: '351';
        $model->contact_number = $model->contact_number ?: '967235820';
        $model->newsletter = $model->newsletter ?: 0;
        $model->title = $model->title ?: 'mr';
        $model->gender = $model->gender ?: 'men';
        $model->job_title = $model->job_title ?: 'Admin';
        $model->coin = $model->coin ?: 'euro';
        $model->voucher_parent = $model->voucher_parent ?: 'v' . Helpers::generateRandowHumber();
        $model->created_date = date('Y-m-d');
        $model->level = 'admin';
        $model->status = User::STATUS_ACTIVE;
        $model->applySignupClientDefaults();

        if (!$model->validate()) {
            Yii::error($model->getErrors(), 'google-signup');
            Yii::$app->session->setFlash('signup_errors', $this->modelErrorList($model));
            return $this->redirect(['site/signup-client']);
        }

        try {
            $user = $model->defaultSignup();
        } catch (\Throwable $exception) {
            Yii::error($exception->getMessage(), 'google-signup');
            Yii::$app->session->setFlash('signup_errors', [$exception->getMessage()]);
            return $this->redirect(['site/signup-client']);
        }

        if (!$user) {
            Yii::error($model->getErrors(), 'google-signup');
            Yii::$app->session->setFlash('signup_errors', $this->modelErrorList($model));
            return $this->redirect(['site/signup-client']);
        }

        $user->status = User::STATUS_ACTIVE;
        try {
            $userSaved = $user->save();
        } catch (\Throwable $exception) {
            Yii::error($exception->getMessage(), 'google-signup');
            Yii::$app->session->setFlash('signup_errors', [$exception->getMessage()]);
            return $this->redirect(['site/signup-client']);
        }

        if (!$userSaved) {
            Yii::error($user->getErrors(), 'google-signup');
            Yii::$app->session->setFlash('signup_errors', $this->modelErrorList($user));
            return $this->redirect(['site/signup-client']);
        }

        $auth = new Auth([
            'user_id' => $user->id,
            'source' => 'google',
            'source_id' => (string)$payload['sub'],
        ]);

        try {
            $authSaved = $auth->save();
        } catch (\Throwable $exception) {
            Yii::error($exception->getMessage(), 'google-signup');
            Yii::$app->session->setFlash('signup_errors', [$exception->getMessage()]);
            return $this->redirect(['site/signup-client']);
        }

        if (!$authSaved) {
            Yii::error($auth->getErrors(), 'google-signup');
            Yii::$app->session->setFlash('signup_errors', $this->modelErrorList($auth));
            return $this->redirect(['site/signup-client']);
        }

        LogsController::saveLog($model, 'create_user');

        Yii::$app->user->login($user, 3600 * 24 * 30);
        Yii::$app->session->set('userSessionTimeout', time() + Yii::$app->params['sessionTimeoutSeconds']);

        return $this->redirect($this->postLoginRoute());
    }

    private function applyExistingGoogleSignupData(User $user, array $formData)
    {
        $fullName = trim((string)($formData['full_name'] ?? ''));
        if ($fullName !== '') {
            $nameParts = preg_split('/\s+/', $fullName, 2);
            $user->full_name = $fullName;
            $user->first_name = $nameParts[0] ?? $fullName;
            $user->last_name = $nameParts[1] ?? $user->first_name;
        }

        foreach ([
            'company',
            'contact_country_code',
            'contact_number',
            'voucher_parent',
            'gender',
            'job_title',
            'coin',
            'adress_line_1',
            'adress_line_2',
            'city',
            'postcode',
            'location',
            'country',
        ] as $attribute) {
            if (array_key_exists($attribute, $formData) && trim((string)$formData[$attribute]) !== '') {
                $user->$attribute = $formData[$attribute];
            }
        }

        foreach (['terms_and_conditions', 'privacy', 'newsletter'] as $attribute) {
            if (array_key_exists($attribute, $formData)) {
                $user->$attribute = (int)$formData[$attribute];
            }
        }

        if (!empty($formData['username']) && $formData['username'] !== $user->username) {
            $user->username = $formData['username'];
        }

        if (!empty($formData['password'])) {
            $user->setPassword($formData['password']);
        }

        $user->country = $user->country ?: 'PT';
        $user->status = User::STATUS_ACTIVE;

        try {
            return $user->save();
        } catch (\Throwable $exception) {
            Yii::error($exception->getMessage(), 'google-signup');
            $user->addError('email', $exception->getMessage());
            return false;
        }
    }

    private function modelErrorList($model)
    {
        $errors = [];

        if (!$model || !method_exists($model, 'getErrors')) {
            return [Yii::t('app', 'error_something_went_wrong')];
        }

        foreach ($model->getErrors() as $attributeErrors) {
            foreach ($attributeErrors as $error) {
                $errors[] = $error;
            }
        }

        return $errors ?: [Yii::t('app', 'error_something_went_wrong')];
    }

    public function actionGoogleLogin()
    {
        if (!$this->request->isPost) {
            return $this->redirect(['site/login']);
        }

        $credential = (string)Yii::$app->request->post('credential', '');
        $clientId = Yii::$app->params['auth_google_client_id'] ?? Yii::$app->params['oauth2_client_id'] ?? null;

        if (empty($clientId)) {
            Yii::$app->session->setFlash('login_errors', [Yii::t('app', 'google_auth_not_configured')]);
            return $this->redirect(['site/login']);
        }

        if ($credential === '') {
            Yii::$app->session->setFlash('login_errors', [Yii::t('app', 'google_auth_invalid')]);
            return $this->redirect(['site/login']);
        }

        try {
            $client = new \Google\Client(['client_id' => $clientId]);
            $payload = $client->verifyIdToken($credential);
        } catch (\Throwable $exception) {
            $payload = false;
        }

        if (!$payload || empty($payload['sub']) || empty($payload['email'])) {
            Yii::$app->session->setFlash('login_errors', [Yii::t('app', 'google_auth_invalid')]);
            return $this->redirect(['site/login']);
        }

        $auth = Auth::find()->where([
            'source' => 'google',
            'source_id' => (string)$payload['sub'],
        ])->one();

        if ($auth && $auth->user) {
            Yii::$app->user->login($auth->user, 3600 * 24 * 30);
            Yii::$app->session->set('userSessionTimeout', time() + Yii::$app->params['sessionTimeoutSeconds']);
            return $this->redirect($this->postLoginRoute());
        }

        $user = User::find()->where(['email' => $payload['email']])->one();

        if (!$user) {
            Yii::$app->session->setFlash('login_errors', [Yii::t('app', 'google_auth_email_not_found')]);
            return $this->redirect(['site/login']);
        }

        $auth = new Auth([
            'user_id' => $user->id,
            'source' => 'google',
            'source_id' => (string)$payload['sub'],
        ]);
        $auth->save();

        Yii::$app->user->login($user, 3600 * 24 * 30);
        Yii::$app->session->set('userSessionTimeout', time() + Yii::$app->params['sessionTimeoutSeconds']);

        return $this->redirect($this->postLoginRoute());
    }
   
    /**
     * Displays homepage.
     *
     * @return mixed
     */
    public function actionQrCode()
    {
        $this->layout = false;

        return $this->render('qr-code/index', [
            'qrCodeUrl' => Url::to(['site/qr-code-image'], true),
        ]);
    }

    public function actionQrCodeImage()
    {
        Yii::$app->response->format = Response::FORMAT_RAW;
        Yii::$app->response->headers->set('Content-Type', 'image/svg+xml; charset=UTF-8');
        Yii::$app->response->headers->set('Cache-Control', 'public, max-age=86400');

        $qrCode = (new QrCode(Url::to(['site/qr-code-page'], true), null, new SvgWriter()))
            ->setSize(900)
            ->setMargin(24);

        return $qrCode->writeString();
    }

    public function actionQrCodePage()
    {
        $this->layout = false;

        return $this->render('qr-code/page');
    }

    private function applyMarmitasLanguageFromQuery()
    {
        $requestedLanguage = strtolower((string) Yii::$app->request->get('lang', ''));
        if (in_array($requestedLanguage, ['pt', 'en'], true)) {
            Yii::$app->language = $requestedLanguage;
            Yii::$app->response->cookies->add(new \yii\web\Cookie([
                'name' => 'lang',
                'value' => $requestedLanguage,
            ]));
            return;
        }

        Yii::$app->language = 'pt';
    }

    private function marmitasDefaultRecipes()
    {
        return [
            'bacalhau-grao' => [
                'id' => 'bacalhau-grao',
                'name_pt' => 'Bacalhau com grão',
                'name_en' => 'Cod with chickpeas',
                'tagline_pt' => 'Bacalhau, grão, ovo e legumes numa porção equilibrada de 500 g.',
                'tagline_en' => 'Portuguese cod, chickpeas, egg and greens in a balanced 500 g portion.',
                'allergens_pt' => 'Contém peixe e ovo.',
                'allergens_en' => 'Contains fish and egg.',
                'ingredients_pt' => ['Bacalhau', 'Grão', 'Ovo', 'Legumes verdes', 'Azeite', 'Cebola e alho'],
                'ingredients_en' => ['Cod', 'Chickpeas', 'Egg', 'Portuguese greens', 'Olive oil', 'Onion and garlic'],
                'preparation_pt' => ['Descongela no frigorífico sempre que possível.', 'Aquece até ficar bem quente por completo.', 'Mexe a meio do aquecimento para uma textura uniforme.'],
                'preparation_en' => ['Thaw in the fridge whenever possible.', 'Heat until piping hot throughout.', 'Stir halfway through heating for an even texture.'],
                'storage_pt' => 'Conservar congelado. Depois de descongelar, consumir em 24 horas e não voltar a congelar.',
                'storage_en' => 'Keep frozen. After thawing, consume within 24 hours and do not refreeze.',
            ],
            'frango-arroz' => [
                'id' => 'frango-arroz',
                'name_pt' => 'Frango guisado com arroz',
                'name_en' => 'Chicken stew with rice',
                'tagline_pt' => 'Frango caseiro, molho de tomate, arroz e legumes, pronto para congelar e aquecer.',
                'tagline_en' => 'Homemade chicken, tomato sauce, rice and vegetables, ready to freeze and heat.',
                'allergens_pt' => 'Confirmar alergénios antes de encomendar.',
                'allergens_en' => 'Confirm allergens before ordering.',
                'ingredients_pt' => ['Frango', 'Arroz', 'Molho de tomate', 'Cenoura', 'Cebola e alho', 'Azeite'],
                'ingredients_en' => ['Chicken', 'Rice', 'Tomato sauce', 'Carrot', 'Onion and garlic', 'Olive oil'],
                'preparation_pt' => ['Descongela no frigorífico ou aquece diretamente congelado.', 'Aquece até o arroz e o frango ficarem bem quentes.', 'Deixa repousar um minuto antes de servir.'],
                'preparation_en' => ['Thaw in the fridge or heat directly from frozen.', 'Heat until the rice and chicken are hot throughout.', 'Let rest for one minute before serving.'],
                'storage_pt' => 'Conservar congelado. Seguir as instruções da etiqueta para o tempo de aquecimento.',
                'storage_en' => 'Keep frozen. Follow the label instructions for heating time.',
            ],
            'sopa-legumes' => [
                'id' => 'sopa-legumes',
                'name_pt' => 'Sopa de legumes',
                'name_en' => 'Vegetable soup',
                'tagline_pt' => 'Sopa de legumes portuguesa para uma opção congelada mais leve.',
                'tagline_en' => 'Comforting Portuguese vegetable soup for a lighter frozen meal option.',
                'allergens_pt' => 'Sem alergénios declarados.',
                'allergens_en' => 'No declared allergens.',
                'ingredients_pt' => ['Legumes da época', 'Batata', 'Cenoura', 'Cebola', 'Azeite'],
                'ingredients_en' => ['Seasonal vegetables', 'Potato', 'Carrot', 'Onion', 'Olive oil'],
                'preparation_pt' => ['Aquece suavemente num tacho ou recipiente próprio para micro-ondas.', 'Mexe durante o aquecimento.', 'Serve quente.'],
                'preparation_en' => ['Heat gently in a pan or microwave-safe bowl.', 'Stir during heating.', 'Serve hot.'],
                'storage_pt' => 'Conservar congelada e consumir depois de aquecer.',
                'storage_en' => 'Keep frozen and consume after heating.',
            ],
        ];
    }

    private function marmitasGeneratedRecipeIdeas()
    {
        return [
            [
                'slug' => 'favas-chourico-arroz',
                'name_pt' => 'Favas com chouriço e arroz',
                'name_en' => 'Broad beans with chorizo and rice',
                'tagline_pt' => 'Favas cozidas, chouriço, carne de porco e arroz numa marmita robusta para congelar.',
                'tagline_en' => 'Broad beans, chorizo, pork and rice in a hearty freezer-friendly meal.',
                'allergens_pt' => 'Confirmar alergénios do chouriço antes de encomendar.',
                'allergens_en' => 'Confirm chorizo allergens before ordering.',
                'ingredients_pt' => ['Favas cozidas 220 g', 'Chouriço cozinhado 80 g', 'Carne de porco cozinhada 80 g', 'Arroz cozido 80 g', 'Cebola cozinhada 25 g', 'Azeite 15 g'],
                'ingredients_en' => ['Cooked broad beans 220 g', 'Cooked chorizo 80 g', 'Cooked pork 80 g', 'Cooked rice 80 g', 'Cooked onion 25 g', 'Olive oil 15 g'],
                'preparation_pt' => ['Arrefece completamente antes de embalar.', 'Congela em dose individual de 500 g.', 'Aquece até ficar bem quente por completo.'],
                'preparation_en' => ['Cool completely before packing.', 'Freeze as an individual 500 g portion.', 'Heat until piping hot throughout.'],
            ],
            [
                'slug' => 'peru-guisado-arroz-ervilhas',
                'name_pt' => 'Peru guisado com arroz e ervilhas',
                'name_en' => 'Turkey stew with rice and peas',
                'tagline_pt' => 'Peru guisado, arroz, cenoura e ervilhas para uma refeição leve e prática.',
                'tagline_en' => 'Turkey stew, rice, carrot and peas for a practical lighter meal.',
                'allergens_pt' => 'Sem alergénios declarados. Confirmar sempre antes de encomendar.',
                'allergens_en' => 'No declared allergens. Always confirm before ordering.',
                'ingredients_pt' => ['Peru cozinhado 150 g', 'Arroz cozido 220 g', 'Cenoura cozinhada 50 g', 'Ervilhas cozidas 50 g', 'Cebola cozinhada 15 g', 'Azeite 15 g'],
                'ingredients_en' => ['Cooked turkey 150 g', 'Cooked rice 220 g', 'Cooked carrot 50 g', 'Cooked peas 50 g', 'Cooked onion 15 g', 'Olive oil 15 g'],
                'preparation_pt' => ['Guisar o peru com tomate, cebola e azeite.', 'Misturar com arroz e legumes já cozinhados.', 'Congelar em doses de 500 g.'],
                'preparation_en' => ['Stew the turkey with tomato, onion and olive oil.', 'Combine with cooked rice and vegetables.', 'Freeze in 500 g portions.'],
            ],
            [
                'slug' => 'arroz-carne-portuguesa',
                'name_pt' => 'Arroz de carne à portuguesa',
                'name_en' => 'Portuguese beef rice',
                'tagline_pt' => 'Arroz de carne com tomate, cenoura e refogado português, ideal para aquecer no micro-ondas.',
                'tagline_en' => 'Beef rice with tomato, carrot and Portuguese sofrito, ideal for reheating.',
                'allergens_pt' => 'Sem alergénios declarados.',
                'allergens_en' => 'No declared allergens.',
                'ingredients_pt' => ['Carne de vaca ou vitela cozinhada 130 g', 'Arroz cozido 240 g', 'Tomate 60 g', 'Cenoura cozinhada 40 g', 'Cebola cozinhada 15 g', 'Azeite 15 g'],
                'ingredients_en' => ['Cooked beef or veal 130 g', 'Cooked rice 240 g', 'Tomato 60 g', 'Cooked carrot 40 g', 'Cooked onion 15 g', 'Olive oil 15 g'],
                'preparation_pt' => ['Cozinhar a carne lentamente até ficar tenra.', 'Envolver com arroz e molho de tomate.', 'Arrefecer antes de congelar.'],
                'preparation_en' => ['Cook the meat slowly until tender.', 'Mix with rice and tomato sauce.', 'Cool before freezing.'],
            ],
            [
                'slug' => 'bacalhau-gomes-sa',
                'name_pt' => 'Bacalhau à Gomes de Sá',
                'name_en' => 'Cod Gomes de Sa style',
                'tagline_pt' => 'Bacalhau desfiado, batata, cebola, ovo e azeite numa versão equilibrada para marmita.',
                'tagline_en' => 'Shredded cod, potato, onion, egg and olive oil in a balanced lunchbox version.',
                'allergens_pt' => 'Contém peixe e ovo.',
                'allergens_en' => 'Contains fish and egg.',
                'ingredients_pt' => ['Bacalhau demolhado e cozinhado 140 g', 'Batata cozinhada 220 g', 'Cebola cozinhada 80 g', 'Ovo cozinhado sem casca 40 g', 'Azeite 15 g', 'Azeitonas sem caroço 20 g', 'Salsa 5 g'],
                'ingredients_en' => ['Cooked soaked cod 140 g', 'Cooked potato 220 g', 'Cooked onion 80 g', 'Cooked peeled egg 40 g', 'Olive oil 15 g', 'Pitted olives 20 g', 'Parsley 5 g'],
                'preparation_pt' => ['Lascar o bacalhau e envolver com batata e cebola.', 'Juntar ovo e azeite apenas no final.', 'Congelar em embalagem bem fechada.'],
                'preparation_en' => ['Flake the cod and mix with potato and onion.', 'Add egg and olive oil at the end.', 'Freeze in a sealed container.'],
            ],
            [
                'slug' => 'feijoada-frango-legumes',
                'name_pt' => 'Feijoada leve de frango e legumes',
                'name_en' => 'Light chicken and vegetable bean stew',
                'tagline_pt' => 'Feijão, frango e legumes num prato confortável, mais leve e próprio para congelar.',
                'tagline_en' => 'Beans, chicken and vegetables in a lighter comfort meal suitable for freezing.',
                'allergens_pt' => 'Sem alergénios declarados.',
                'allergens_en' => 'No declared allergens.',
                'ingredients_pt' => ['Feijão cozido 180 g', 'Frango cozinhado 120 g', 'Arroz cozido 120 g', 'Cenoura cozinhada 40 g', 'Couve cozinhada 25 g', 'Azeite 15 g'],
                'ingredients_en' => ['Cooked beans 180 g', 'Cooked chicken 120 g', 'Cooked rice 120 g', 'Cooked carrot 40 g', 'Cooked cabbage 25 g', 'Olive oil 15 g'],
                'preparation_pt' => ['Apurar o feijão com legumes e frango.', 'Servir com arroz numa dose de 500 g.', 'Congelar depois de arrefecer.'],
                'preparation_en' => ['Simmer beans with vegetables and chicken.', 'Serve with rice in a 500 g portion.', 'Freeze after cooling.'],
            ],
            [
                'slug' => 'jardineira-vaca',
                'name_pt' => 'Jardineira de vaca',
                'name_en' => 'Portuguese beef and vegetable stew',
                'tagline_pt' => 'Carne de vaca estufada com batata, cenoura e ervilhas, pronta para aquecer.',
                'tagline_en' => 'Beef stew with potato, carrot and peas, ready to reheat.',
                'allergens_pt' => 'Sem alergénios declarados.',
                'allergens_en' => 'No declared allergens.',
                'ingredients_pt' => ['Carne de vaca cozinhada 150 g', 'Batata cozinhada 170 g', 'Cenoura cozinhada 70 g', 'Ervilhas cozidas 45 g', 'Molho de tomate 50 g', 'Azeite 15 g'],
                'ingredients_en' => ['Cooked beef 150 g', 'Cooked potato 170 g', 'Cooked carrot 70 g', 'Cooked peas 45 g', 'Tomato sauce 50 g', 'Olive oil 15 g'],
                'preparation_pt' => ['Estufar a carne até ficar macia.', 'Juntar legumes cozinhados e molho.', 'Congelar com molho suficiente para não secar.'],
                'preparation_en' => ['Stew the beef until tender.', 'Add cooked vegetables and sauce.', 'Freeze with enough sauce to avoid drying.'],
            ],
            [
                'slug' => 'arroz-pato-desfiado',
                'name_pt' => 'Arroz de pato desfiado',
                'name_en' => 'Shredded duck rice',
                'tagline_pt' => 'Pato desfiado com arroz e legumes, numa versão de forno adaptada a marmita.',
                'tagline_en' => 'Shredded duck with rice and vegetables, a lunchbox version of the oven classic.',
                'allergens_pt' => 'Confirmar alergénios do chouriço antes de encomendar.',
                'allergens_en' => 'Confirm chorizo allergens before ordering.',
                'ingredients_pt' => ['Pato desfiado cozinhado 120 g', 'Arroz cozido 260 g', 'Cenoura cozinhada 40 g', 'Cebola cozinhada 25 g', 'Chouriço cozinhado 40 g', 'Azeite 15 g'],
                'ingredients_en' => ['Cooked shredded duck 120 g', 'Cooked rice 260 g', 'Cooked carrot 40 g', 'Cooked onion 25 g', 'Cooked chorizo 40 g', 'Olive oil 15 g'],
                'preparation_pt' => ['Desfiar o pato e envolver no arroz.', 'Adicionar chouriço em pouca quantidade para sabor.', 'Congelar sem deixar secar.'],
                'preparation_en' => ['Shred the duck and fold into the rice.', 'Add a small amount of chorizo for flavour.', 'Freeze without letting it dry out.'],
            ],
            [
                'slug' => 'lombo-porco-migas',
                'name_pt' => 'Lombo de porco com migas de couve',
                'name_en' => 'Pork loin with kale migas',
                'tagline_pt' => 'Lombo assado fatiado com migas de couve e feijão, sabor português em dose individual.',
                'tagline_en' => 'Sliced roast pork loin with kale and bean migas in an individual portion.',
                'allergens_pt' => 'Contém glúten se forem usadas migas com pão.',
                'allergens_en' => 'Contains gluten if bread migas are used.',
                'ingredients_pt' => ['Lombo de porco cozinhado 150 g', 'Migas de couve 220 g', 'Feijão cozido 70 g', 'Cebola cozinhada 25 g', 'Alho 10 g', 'Azeite 25 g'],
                'ingredients_en' => ['Cooked pork loin 150 g', 'Kale migas 220 g', 'Cooked beans 70 g', 'Cooked onion 25 g', 'Garlic 10 g', 'Olive oil 25 g'],
                'preparation_pt' => ['Fatiar o lombo depois de arrefecer.', 'Preparar migas húmidas para congelar melhor.', 'Aquecer lentamente para manter a textura.'],
                'preparation_en' => ['Slice the pork after cooling.', 'Prepare moist migas for better freezing.', 'Reheat gently to preserve texture.'],
            ],
            [
                'slug' => 'ervilhas-ovos-escalfados',
                'name_pt' => 'Ervilhas com ovos escalfados',
                'name_en' => 'Peas with poached eggs',
                'tagline_pt' => 'Ervilhas em molho de tomate com ovo e arroz, simples e económico para a semana.',
                'tagline_en' => 'Peas in tomato sauce with egg and rice, simple and economical for the week.',
                'allergens_pt' => 'Contém ovo.',
                'allergens_en' => 'Contains egg.',
                'ingredients_pt' => ['Ervilhas cozidas 180 g', 'Ovo cozinhado sem casca 80 g', 'Arroz cozido 170 g', 'Molho de tomate 45 g', 'Cebola cozinhada 15 g', 'Azeite 10 g'],
                'ingredients_en' => ['Cooked peas 180 g', 'Cooked peeled egg 80 g', 'Cooked rice 170 g', 'Tomato sauce 45 g', 'Cooked onion 15 g', 'Olive oil 10 g'],
                'preparation_pt' => ['Cozinhar as ervilhas em molho suave.', 'Juntar ovo já cozinhado para melhor conservação.', 'Congelar em dose individual.'],
                'preparation_en' => ['Cook the peas in a mild sauce.', 'Add already cooked egg for better storage.', 'Freeze as an individual portion.'],
            ],
            [
                'slug' => 'rancho-grao-massa-carne',
                'name_pt' => 'Rancho de grão com massa e carne',
                'name_en' => 'Chickpea, pasta and meat ranch stew',
                'tagline_pt' => 'Grão, massa curta, carne e legumes num prato tradicional português muito saciante.',
                'tagline_en' => 'Chickpeas, short pasta, meat and vegetables in a filling Portuguese classic.',
                'allergens_pt' => 'Contém glúten.',
                'allergens_en' => 'Contains gluten.',
                'ingredients_pt' => ['Grão cozido 150 g', 'Massa cozida 140 g', 'Carne de porco cozinhada 100 g', 'Cenoura cozinhada 45 g', 'Couve cozinhada 50 g', 'Azeite 15 g'],
                'ingredients_en' => ['Cooked chickpeas 150 g', 'Cooked pasta 140 g', 'Cooked pork 100 g', 'Cooked carrot 45 g', 'Cooked cabbage 50 g', 'Olive oil 15 g'],
                'preparation_pt' => ['Preparar o rancho com caldo reduzido.', 'Arrefecer antes de embalar para evitar condensação.', 'Congelar e aquecer até borbulhar.'],
                'preparation_en' => ['Prepare the stew with reduced stock.', 'Cool before packing to avoid condensation.', 'Freeze and reheat until bubbling.'],
            ],
        ];
    }

    private function marmitasRecipeFromPrompt($mealName)
    {
        $mealName = trim((string)$mealName);
        $slugBase = preg_replace('/[^a-z0-9\-]+/', '-', strtolower(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $mealName) ?: $mealName));
        $slugBase = trim((string)$slugBase, '-') ?: 'receita';
        $slugSuffix = preg_replace('/[^a-z0-9]+/', '', strtolower(Yii::$app->security->generateRandomString(8)));
        $slug = $slugBase . '-' . substr($slugSuffix ?: (string)time(), 0, 6);
        $components = $this->marmitasRecipeComponentsForMeal($mealName);
        $lowerMealName = mb_strtolower($mealName, 'UTF-8');
        $containsSeafood = preg_match('/lagosta|camarao|camarão|marisco|polvo|lulas|bacalhau|peixe|pescada|atum|salmao|salmão/u', $lowerMealName) === 1;
        $allergensPt = $containsSeafood ? 'Pode conter peixe, crustáceos ou moluscos. Confirmar alergénios antes de publicar e encomendar.' : 'Confirmar alergénios antes de publicar e encomendar.';
        $allergensEn = $containsSeafood ? 'May contain fish, crustaceans or molluscs. Confirm allergens before publishing and ordering.' : 'Confirm allergens before publishing and ordering.';

        return [
            'slug' => $slug,
            'name_pt' => $mealName,
            'name_en' => $mealName,
            'tagline_pt' => $mealName . ' numa versão de marmita portuguesa de 500 g, com proteína bem apurada, acompanhamento equilibrado, legumes e molho suficiente para manter a refeição suculenta depois de congelar e aquecer durante a semana.',
            'tagline_en' => $mealName . ' as a 500 g Portuguese-style freezer meal with well-seasoned protein, balanced side dish, vegetables and enough sauce to keep the meal juicy after freezing and reheating during the week.',
            'allergens_pt' => $allergensPt,
            'allergens_en' => $allergensEn,
            'ingredients_pt' => $components['pt'],
            'ingredients_en' => $components['en'],
            'preparation_pt' => ['Temperar a proteína e cozinhar lentamente até ficar tenra e suculenta.', 'Preparar o refogado com cebola, alho, azeite e molho até ficar apurado.', 'Cozer o acompanhamento e os legumes em separado para manter textura depois de congelar.', 'Juntar tudo numa dose equilibrada de 500 g, deixando molho suficiente para não secar.', 'Arrefecer completamente, fechar a embalagem, congelar e aquecer até ficar bem quente no centro.'],
            'preparation_en' => ['Season the protein and cook slowly until tender and juicy.', 'Prepare the onion, garlic, olive oil and sauce base until well reduced.', 'Cook the side dish and vegetables separately so they keep texture after freezing.', 'Combine everything into a balanced 500 g portion, leaving enough sauce to avoid dryness.', 'Cool completely, seal the container, freeze and reheat until hot in the centre.'],
        ];
    }

    private function marmitasRecipeComponentsForMeal($mealName)
    {
        $lowerMealName = mb_strtolower((string)$mealName, 'UTF-8');
        $plainMealName = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $lowerMealName) ?: $lowerMealName;

        $contains = static function ($patterns) use ($lowerMealName, $plainMealName) {
            foreach ((array)$patterns as $pattern) {
                if (strpos($lowerMealName, $pattern) !== false || strpos($plainMealName, $pattern) !== false) {
                    return true;
                }
            }

            return false;
        };

        if ($contains(['camarao', 'camarão'])) {
            $proteinPt = 'Camarão cozinhado 130 g';
            $proteinEn = 'Cooked shrimp 130 g';
            $saucePt = 'Caldo de marisco 35 g';
            $sauceEn = 'Seafood stock 35 g';
            $vegPt = 'Legumes salteados 80 g';
            $vegEn = 'Sauteed vegetables 80 g';
        } elseif ($contains(['atum'])) {
            $proteinPt = 'Atum cozinhado 140 g';
            $proteinEn = 'Cooked tuna 140 g';
            $saucePt = 'Molho de tomate 35 g';
            $sauceEn = 'Tomato sauce 35 g';
            $vegPt = 'Legumes salteados 80 g';
            $vegEn = 'Sauteed vegetables 80 g';
        } elseif ($contains(['bacalhau'])) {
            $proteinPt = 'Bacalhau demolhado cozinhado 140 g';
            $proteinEn = 'Cooked soaked cod 140 g';
            $saucePt = 'Azeite e cebola apurados 35 g';
            $sauceEn = 'Olive oil and onion sauce 35 g';
            $vegPt = 'Legumes verdes cozinhados 70 g';
            $vegEn = 'Cooked greens 70 g';
        } elseif ($contains(['pescada', 'peixe'])) {
            $proteinPt = 'Peixe cozinhado 140 g';
            $proteinEn = 'Cooked fish 140 g';
            $saucePt = 'Molho leve de tomate 35 g';
            $sauceEn = 'Light tomato sauce 35 g';
            $vegPt = 'Legumes cozinhados 80 g';
            $vegEn = 'Cooked vegetables 80 g';
        } elseif ($contains(['frango'])) {
            $proteinPt = 'Frango cozinhado 150 g';
            $proteinEn = 'Cooked chicken 150 g';
            $saucePt = 'Molho de tomate 45 g';
            $sauceEn = 'Tomato sauce 45 g';
            $vegPt = 'Cenoura e ervilhas cozinhadas 70 g';
            $vegEn = 'Cooked carrot and peas 70 g';
        } elseif ($contains(['peru'])) {
            $proteinPt = 'Peru cozinhado 150 g';
            $proteinEn = 'Cooked turkey 150 g';
            $saucePt = 'Molho de tomate 45 g';
            $sauceEn = 'Tomato sauce 45 g';
            $vegPt = 'Cenoura e ervilhas cozinhadas 70 g';
            $vegEn = 'Cooked carrot and peas 70 g';
        } elseif ($contains(['porco', 'lombo'])) {
            $proteinPt = 'Porco cozinhado 150 g';
            $proteinEn = 'Cooked pork 150 g';
            $saucePt = 'Molho do assado 45 g';
            $sauceEn = 'Roast sauce 45 g';
            $vegPt = 'Couve cozinhada 70 g';
            $vegEn = 'Cooked kale 70 g';
        } elseif ($contains(['vaca', 'vitela', 'carne'])) {
            $proteinPt = 'Carne de vaca ou vitela cozinhada 150 g';
            $proteinEn = 'Cooked beef or veal 150 g';
            $saucePt = 'Molho de tomate 45 g';
            $sauceEn = 'Tomato sauce 45 g';
            $vegPt = 'Cenoura cozinhada 70 g';
            $vegEn = 'Cooked carrot 70 g';
        } elseif ($contains(['pato'])) {
            $proteinPt = 'Pato desfiado cozinhado 130 g';
            $proteinEn = 'Cooked shredded duck 130 g';
            $saucePt = 'Caldo de pato 45 g';
            $sauceEn = 'Duck stock 45 g';
            $vegPt = 'Cenoura cozinhada 50 g';
            $vegEn = 'Cooked carrot 50 g';
        } elseif ($contains(['legumes', 'vegetais', 'vegetables'])) {
            $proteinPt = 'Legumes da época cozinhados 180 g';
            $proteinEn = 'Cooked seasonal vegetables 180 g';
            $saucePt = 'Molho de tomate 45 g';
            $sauceEn = 'Tomato sauce 45 g';
            $vegPt = 'Couve e cenoura cozinhadas 70 g';
            $vegEn = 'Cooked cabbage and carrot 70 g';
        } elseif ($contains(['feijao', 'feijão'])) {
            $proteinPt = 'Feijão cozido 180 g';
            $proteinEn = 'Cooked beans 180 g';
            $saucePt = 'Molho de tomate 45 g';
            $sauceEn = 'Tomato sauce 45 g';
            $vegPt = 'Couve e cenoura cozinhadas 70 g';
            $vegEn = 'Cooked cabbage and carrot 70 g';
        } elseif ($contains(['grao', 'grão'])) {
            $proteinPt = 'Grão cozido 180 g';
            $proteinEn = 'Cooked chickpeas 180 g';
            $saucePt = 'Molho de tomate 45 g';
            $sauceEn = 'Tomato sauce 45 g';
            $vegPt = 'Legumes cozinhados 70 g';
            $vegEn = 'Cooked vegetables 70 g';
        } else {
            $proteinPt = 'Legumes cozinhados 160 g';
            $proteinEn = 'Cooked vegetables 160 g';
            $saucePt = 'Molho caseiro 45 g';
            $sauceEn = 'Homemade sauce 45 g';
            $vegPt = 'Cenoura e couve cozinhadas 80 g';
            $vegEn = 'Cooked carrot and cabbage 80 g';
        }

        if ($contains(['feijoada'])) {
            $basePt = ['Feijão branco cozido 170 g', 'Arroz cozido 110 g'];
            $baseEn = ['Cooked white beans 170 g', 'Cooked rice 110 g'];
            $vegPt = 'Couve e cenoura cozinhadas 55 g';
            $vegEn = 'Cooked cabbage and carrot 55 g';
        } elseif ($contains(['empadao', 'empadão'])) {
            $basePt = ['Puré de batata 210 g'];
            $baseEn = ['Mashed potato 210 g'];
        } elseif ($contains(['arroz'])) {
            $basePt = ['Arroz cozido 220 g'];
            $baseEn = ['Cooked rice 220 g'];
        } elseif ($contains(['massa'])) {
            $basePt = ['Massa cozida 190 g'];
            $baseEn = ['Cooked pasta 190 g'];
        } elseif ($contains(['batata'])) {
            $basePt = ['Batata cozinhada 190 g'];
            $baseEn = ['Cooked potato 190 g'];
        } else {
            $basePt = ['Arroz cozido 180 g'];
            $baseEn = ['Cooked rice 180 g'];
        }

        return [
            'pt' => array_values(array_unique(array_merge([$proteinPt], $basePt, [$vegPt, $saucePt, 'Cebola e alho refogados 20 g', 'Azeite 10 g']))),
            'en' => array_values(array_unique(array_merge([$proteinEn], $baseEn, [$vegEn, $sauceEn, 'Sauteed onion and garlic 20 g', 'Olive oil 10 g']))),
        ];
    }

    private function marmitasRepairGenericGeneratedIngredients()
    {
        $recipes = (new Query())
            ->from('marmitas_recipes')
            ->all();
        $now = date('Y-m-d H:i:s');

        foreach ($recipes as $recipe) {
            $namePt = trim((string)($recipe['name_pt'] ?? ''));
            $nameEn = trim((string)($recipe['name_en'] ?? $namePt));
            $ingredientsPt = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string)($recipe['ingredients_pt'] ?? '')))));
            $ingredientsEn = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string)($recipe['ingredients_en'] ?? '')))));
            $firstPt = mb_strtolower((string)($ingredientsPt[0] ?? ''), 'UTF-8');
            $firstEn = mb_strtolower((string)($ingredientsEn[0] ?? ''), 'UTF-8');
            $namePtLower = mb_strtolower($namePt, 'UTF-8');
            $nameEnLower = mb_strtolower($nameEn, 'UTF-8');
            $needsRepair = strpos($firstPt, 'proteína cozinhada') !== false
                || strpos($firstPt, 'proteina cozinhada') !== false
                || strpos($firstEn, 'cooked protein') !== false
                || ($namePt !== '' && strpos($firstPt, $namePtLower) !== false && preg_match('/cozinhad/u', $firstPt))
                || ($nameEn !== '' && strpos($firstEn, $nameEnLower) !== false && strpos($firstEn, 'cooked') !== false);

            if (!$needsRepair) {
                continue;
            }

            $components = $this->marmitasRecipeComponentsForMeal($namePt !== '' ? $namePt : $nameEn);
            $nutrition = $this->marmitasNutritionDataForRecipe(['ingredients_pt' => $components['pt']]);
            $filterMeta = $this->marmitasRecipeFilterMeta([
                'name_pt' => $recipe['name_pt'] ?? '',
                'name_en' => $recipe['name_en'] ?? '',
                'tagline_pt' => $recipe['tagline_pt'] ?? '',
                'tagline_en' => $recipe['tagline_en'] ?? '',
                'allergens_pt' => $recipe['allergens_pt'] ?? '',
                'allergens_en' => $recipe['allergens_en'] ?? '',
                'ingredients_pt' => implode("\n", $components['pt']),
                'ingredients_en' => implode("\n", $components['en']),
            ], $components['pt'], $recipe['allergens_pt'] ?? '');

            Yii::$app->db->createCommand()->update('marmitas_recipes', [
                'ingredients_pt' => implode("\n", $components['pt']),
                'ingredients_en' => implode("\n", $components['en']),
                'meal_types' => implode(',', $filterMeta['meal_types']),
                'allergen_tags' => implode(',', $filterMeta['allergen_tags']),
                'nutrition_calories' => $nutrition['calories'],
                'nutrition_protein_g' => $nutrition['protein_g'],
                'nutrition_carbs_g' => $nutrition['carbs_g'],
                'nutrition_fat_g' => $nutrition['fat_g'],
                'nutrition_fiber_g' => $nutrition['fiber_g'],
                'updated_at' => $now,
            ], ['id' => $recipe['id']])->execute();
        }
    }

    private function marmitasEnrichGeneratedRecipe($recipe)
    {
        $namePt = $recipe['name_pt'] ?? Yii::t('app', 'Receita');
        $nameEn = $recipe['name_en'] ?? $namePt;
        $ingredientsPt = $recipe['ingredients_pt'] ?? [];
        $ingredientsEn = $recipe['ingredients_en'] ?? [];

        foreach (['Molho ou caldo caseiro 45 g', 'Ervas aromáticas 5 g'] as $ingredient) {
            if (count($ingredientsPt) < 8 && !in_array($ingredient, $ingredientsPt, true)) {
                $ingredientsPt[] = $ingredient;
            }
        }
        foreach (['Homemade sauce or stock 45 g', 'Fresh herbs 5 g'] as $ingredient) {
            if (count($ingredientsEn) < 8 && !in_array($ingredient, $ingredientsEn, true)) {
                $ingredientsEn[] = $ingredient;
            }
        }

        $recipe['tagline_pt'] = ($recipe['tagline_pt'] ?? $namePt) . ' Dose pensada para 500 g, com proteína, hidratos, legumes e molho em equilíbrio para manter sabor e textura depois de congelar.';
        $recipe['tagline_en'] = ($recipe['tagline_en'] ?? $nameEn) . ' Designed as a 500 g portion with balanced protein, carbs, vegetables and sauce to preserve flavour and texture after freezing.';
        $recipe['ingredients_pt'] = $ingredientsPt;
        $recipe['ingredients_en'] = $ingredientsEn;
        $recipe['preparation_pt'] = [
            'Preparar e pesar todos os ingredientes antes de iniciar a confeção.',
            'Cozinhar a proteína com refogado, azeite e molho até ficar tenra e bem temperada.',
            'Cozer o acompanhamento e os legumes em separado para controlar textura e ponto de sal.',
            'Montar a marmita em porção de 500 g, distribuindo proteína, acompanhamento, legumes e molho.',
            'Arrefecer rapidamente, fechar a embalagem, congelar e aquecer até ficar bem quente no centro.',
        ];
        $recipe['preparation_en'] = [
            'Prepare and weigh every ingredient before cooking.',
            'Cook the protein with the sofrito, olive oil and sauce until tender and well seasoned.',
            'Cook the side dish and vegetables separately to control texture and seasoning.',
            'Assemble a 500 g portion with protein, side dish, vegetables and sauce.',
            'Cool quickly, seal the container, freeze and reheat until hot in the centre.',
        ];

        return $recipe;
    }

    private function marmitasUniqueRecipeSlug($slug, &$existingSlugs)
    {
        $slug = preg_replace('/[^a-z0-9\-]+/', '-', strtolower((string)$slug));
        $slug = trim((string)$slug, '-') ?: 'receita';

        if (!isset($existingSlugs[$slug])) {
            $existingSlugs[$slug] = true;
            return $slug;
        }

        do {
            $suffix = preg_replace('/[^a-z0-9]+/', '', strtolower(Yii::$app->security->generateRandomString(8)));
            $candidate = $slug . '-' . substr($suffix ?: (string)time(), 0, 6);
        } while (isset($existingSlugs[$candidate]));

        $existingSlugs[$candidate] = true;
        return $candidate;
    }

    private function marmitasNormalizeRecipe($row, $isEnglish)
    {
        $language = $isEnglish ? 'en' : 'pt';
        $ingredients = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string)($row['ingredients_' . $language] ?? '')))));
        $allergens = $row['allergens_' . $language] ?? '';
        $preparationText = trim((string)($row['preparation_' . $language] ?? ''));
        if ($preparationText === '') {
            $fallbackLanguage = $isEnglish ? 'pt' : 'en';
            $preparationText = trim((string)($row['preparation_' . $fallbackLanguage] ?? ''));
        }
        $filterMeta = $this->marmitasRecipeFilterMeta($row, $ingredients, $allergens);
        $nutrition = $this->marmitasNutritionFromRow($row, $ingredients);
        $savedMealTypes = $this->marmitasNormalizeMealTypeTags($this->marmitasTagsFromValue($row['meal_types'] ?? ''), $filterMeta['meal_types']);
        $savedAllergenTags = $this->marmitasTagsFromValue($row['allergen_tags'] ?? '');
        $imageUrl = $this->marmitasNormalizeRecipeImageUrl($row['image_url'] ?? '');
        $imageVariants = $this->marmitasRecipeImageVariants($imageUrl);

        return [
            'id' => $row['slug'] ?? $row['id'],
            'name' => $row['name_' . $language] ?? '',
            'tagline' => $row['tagline_' . $language] ?? '',
            'allergens' => $allergens,
            'ingredients' => $ingredients,
            'preparation' => array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $preparationText)))),
            'storage' => $row['storage_' . $language] ?? '',
            'active' => (int)($row['active'] ?? 1),
            'week_group' => max(1, min(4, (int)($row['week_group'] ?? 1))),
            'sort_order' => (int)($row['sort_order'] ?? 0),
            'meal_types' => !empty($savedMealTypes) ? $savedMealTypes : $filterMeta['meal_types'],
            'allergen_tags' => !empty($savedAllergenTags) ? $savedAllergenTags : $filterMeta['allergen_tags'],
            'nutrition' => $nutrition,
            'rating_score' => max(0, min(5, (float)($row['rating_score'] ?? 4.8))),
            'rating_count' => max(0, (int)($row['rating_count'] ?? 0)),
            'is_favorite' => (int)($row['is_favorite'] ?? 0) === 1 ? 1 : 0,
            'image_url' => $imageUrl,
            'image_webp_640' => $imageVariants[640] ?? '',
            'image_webp_960' => $imageVariants[960] ?? '',
            'order_count' => 0,
        ];
    }

    private function marmitasNormalizeRecipeImageUrl($url)
    {
        $url = trim((string)$url);
        if ($url === '') {
            return '';
        }

        $path = parse_url($url, PHP_URL_PATH);
        if (is_string($path) && strpos($path, '/images/marmitas/recipes/') === 0) {
            return Url::to($path, true);
        }

        if (strpos($url, '/images/marmitas/recipes/') === 0) {
            return Url::to($url, true);
        }

        return $url;
    }

    private function marmitasRecipeImageVariants($imageUrl)
    {
        $path = parse_url((string)$imageUrl, PHP_URL_PATH);
        if (!is_string($path) || strpos($path, '/images/marmitas/recipes/') !== 0) {
            return [];
        }

        $sourcePath = Yii::getAlias('@frontend/web') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, ltrim($path, '/'));
        $info = pathinfo($sourcePath);
        if (empty($info['dirname']) || empty($info['filename'])) {
            return [];
        }

        $variants = [];
        foreach ([640, 960] as $width) {
            $variantPath = $info['dirname'] . DIRECTORY_SEPARATOR . $info['filename'] . '-' . $width . '.webp';
            if (is_file($variantPath)) {
                $variants[$width] = Url::to(dirname($path) . '/' . $info['filename'] . '-' . $width . '.webp', true);
            }
        }

        return $variants;
    }

    private function marmitasTagsFromValue($value)
    {
        return array_values(array_filter(array_map('trim', explode(',', (string)$value))));
    }

    private function marmitasNormalizeMealTypeTags(array $tags, array $detectedTags = [])
    {
        $allowed = ['vegetarian', 'cow', 'pig', 'chicken', 'turkey', 'fish'];
        $normalized = [];

        foreach ($tags as $tag) {
            if ($tag === 'vegetables') {
                $tag = 'vegetarian';
            }

            if ($tag === 'meat') {
                foreach ($detectedTags as $detectedTag) {
                    if (in_array($detectedTag, ['cow', 'pig', 'chicken', 'turkey'], true)) {
                        $normalized[] = $detectedTag;
                    }
                }
                continue;
            }

            if (in_array($tag, $allowed, true)) {
                $normalized[] = $tag;
            }
        }

        if (in_array('turkey', $detectedTags, true) && !in_array('turkey', $normalized, true)) {
            $normalized[] = 'turkey';
        }

        return array_values(array_unique($normalized));
    }

    private function marmitasRecipeFilterMeta($row, array $ingredients, $allergens)
    {
        $haystack = mb_strtolower(implode(' ', [
            $row['name_pt'] ?? '',
            $row['name_en'] ?? '',
            $row['tagline_pt'] ?? '',
            $row['tagline_en'] ?? '',
            $row['allergens_pt'] ?? '',
            $row['allergens_en'] ?? '',
            $row['ingredients_pt'] ?? '',
            $row['ingredients_en'] ?? '',
            implode(' ', $ingredients),
            $allergens,
        ]), 'UTF-8');

        $matches = function ($patterns) use ($haystack) {
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $haystack)) {
                    return true;
                }
            }

            return false;
        };

        $hasFish = $matches(['/bacalhau|peixe|pescada|atum|salm[aã]o|dourada|robalo|cod|fish|tuna|hake|seafood|marisco|camar[aã]o|polvo|lulas/u']);
        $hasCow = $matches(['/vaca|vitela|carne de vaca|beef|veal/u']);
        $hasPig = $matches(['/porco|lombo|chouri[cç]o|chorizo|pork|pig/u']);
        $hasChicken = $matches(['/frango|galinha|chicken/u']);
        $hasTurkey = $matches(['/peru|turkey/u']);
        $hasVegetarian = $matches(['/gr[aã]o|feij[aã]o|lentilha|legume|vegetar|espinafre|ab[oó]bora|curgete|chickpea|bean|lentil|vegetable|spinach|pumpkin|courgette/u']);

        $mealTypes = [];
        if ($hasVegetarian && !$hasFish && !$hasCow && !$hasPig && !$hasChicken && !$hasTurkey) {
            $mealTypes[] = 'vegetarian';
        }
        if ($hasFish) {
            $mealTypes[] = 'fish';
        }
        if ($hasCow) {
            $mealTypes[] = 'cow';
        }
        if ($hasPig) {
            $mealTypes[] = 'pig';
        }
        if ($hasChicken) {
            $mealTypes[] = 'chicken';
        }
        if ($hasTurkey) {
            $mealTypes[] = 'turkey';
        }
        if (empty($mealTypes)) {
            $mealTypes[] = 'vegetarian';
        }

        $allergenTags = [];
        if ($matches(['/peixe|bacalhau|pescada|atum|salm[aã]o|fish|cod|tuna|hake/u'])) {
            $allergenTags[] = 'fish';
        }
        if ($matches(['/amendoim|noz|nozes|am[eê]ndoa|caju|avel[aã]|nuts?|peanut|almond|cashew|hazelnut/u'])) {
            $allergenTags[] = 'nuts';
        }
        if ($matches(['/leite|lactic[ií]nios|lactose|queijo|natas|manteiga|cream|cheese|milk|butter|dairy/u'])) {
            $allergenTags[] = 'lactose';
        }
        if ($matches(['/ovo|egg/u'])) {
            $allergenTags[] = 'egg';
        }
        if ($matches(['/gl[uú]ten|massa|trigo|pasta|wheat|gluten/u'])) {
            $allergenTags[] = 'gluten';
        }
        if ($matches(['/marisco|camar[aã]o|crust[aá]ceo|molusco|seafood|shellfish|shrimp|mollusc/u'])) {
            $allergenTags[] = 'shellfish';
        }

        return [
            'meal_types' => array_values(array_unique($mealTypes)),
            'allergen_tags' => array_values(array_unique($allergenTags)),
        ];
    }

    private function marmitasNutritionFromRow($row, array $ingredients)
    {
        if (array_key_exists('nutrition_calories', $row) && $row['nutrition_calories'] === null) {
            return [
                'calories' => 0,
                'protein_g' => 0,
                'carbs_g' => 0,
                'fat_g' => 0,
                'fiber_g' => 0,
            ];
        }

        $nutrition = [
            'calories' => (int)($row['nutrition_calories'] ?? 0),
            'protein_g' => (float)($row['nutrition_protein_g'] ?? 0),
            'carbs_g' => (float)($row['nutrition_carbs_g'] ?? 0),
            'fat_g' => (float)($row['nutrition_fat_g'] ?? 0),
            'fiber_g' => (float)($row['nutrition_fiber_g'] ?? 0),
        ];

        if ($nutrition['calories'] > 0) {
            return $nutrition;
        }

        return $this->marmitasEstimateNutrition($ingredients);
    }

    private function marmitasEstimateNutrition(array $ingredients)
    {
        $totals = [
            'calories' => 0,
            'protein_g' => 0,
            'carbs_g' => 0,
            'fat_g' => 0,
            'fiber_g' => 0,
        ];

        foreach ($ingredients as $ingredient) {
            $line = mb_strtolower((string)$ingredient, 'UTF-8');
            $grams = 100;
            if (preg_match('/(\d+(?:[,.]\d+)?)\s*g\b/u', $line, $matches)) {
                $grams = (float)str_replace(',', '.', $matches[1]);
            }
            $factor = max(0, $grams) / 100;
            $profile = $this->marmitasNutritionProfileForIngredient($line);

            foreach ($totals as $key => $value) {
                $totals[$key] += $profile[$key] * $factor;
            }
        }

        return [
            'calories' => (int)round($totals['calories']),
            'protein_g' => round($totals['protein_g'], 1),
            'carbs_g' => round($totals['carbs_g'], 1),
            'fat_g' => round($totals['fat_g'], 1),
            'fiber_g' => round($totals['fiber_g'], 1),
        ];
    }

    private function marmitasNutritionProfileForIngredient($ingredient)
    {
        $profiles = [
            'azeite|oil|olive oil' => ['calories' => 884, 'protein_g' => 0, 'carbs_g' => 0, 'fat_g' => 100, 'fiber_g' => 0],
            'arroz|rice' => ['calories' => 130, 'protein_g' => 2.7, 'carbs_g' => 28, 'fat_g' => 0.3, 'fiber_g' => 0.4],
            'batata|potato' => ['calories' => 87, 'protein_g' => 1.9, 'carbs_g' => 20, 'fat_g' => 0.1, 'fiber_g' => 1.8],
            'massa|pasta' => ['calories' => 158, 'protein_g' => 5.8, 'carbs_g' => 31, 'fat_g' => 0.9, 'fiber_g' => 1.8],
            'peru|turkey' => ['calories' => 135, 'protein_g' => 29, 'carbs_g' => 0, 'fat_g' => 1.6, 'fiber_g' => 0],
            'frango|chicken' => ['calories' => 165, 'protein_g' => 31, 'carbs_g' => 0, 'fat_g' => 3.6, 'fiber_g' => 0],
            'vaca|vitela|beef|veal|carne' => ['calories' => 217, 'protein_g' => 26, 'carbs_g' => 0, 'fat_g' => 12, 'fiber_g' => 0],
            'porco|pork|lombo' => ['calories' => 242, 'protein_g' => 27, 'carbs_g' => 0, 'fat_g' => 14, 'fiber_g' => 0],
            'pato|duck' => ['calories' => 337, 'protein_g' => 19, 'carbs_g' => 0, 'fat_g' => 28, 'fiber_g' => 0],
            'bacalhau|cod|peixe|fish|pescada|atum|tuna|salmao|salmão' => ['calories' => 105, 'protein_g' => 23, 'carbs_g' => 0, 'fat_g' => 1, 'fiber_g' => 0],
            'chouriço|chorizo' => ['calories' => 455, 'protein_g' => 24, 'carbs_g' => 2, 'fat_g' => 38, 'fiber_g' => 0],
            'ovo|egg' => ['calories' => 155, 'protein_g' => 13, 'carbs_g' => 1.1, 'fat_g' => 11, 'fiber_g' => 0],
            'grao|grão|chickpea' => ['calories' => 164, 'protein_g' => 8.9, 'carbs_g' => 27, 'fat_g' => 2.6, 'fiber_g' => 7.6],
            'feijao|feijão|bean' => ['calories' => 127, 'protein_g' => 8.7, 'carbs_g' => 23, 'fat_g' => 0.5, 'fiber_g' => 6.4],
            'fava|broad bean' => ['calories' => 110, 'protein_g' => 7.6, 'carbs_g' => 19.7, 'fat_g' => 0.4, 'fiber_g' => 5.4],
            'ervilha|pea' => ['calories' => 84, 'protein_g' => 5.4, 'carbs_g' => 15, 'fat_g' => 0.4, 'fiber_g' => 5.5],
            'cenoura|carrot' => ['calories' => 35, 'protein_g' => 0.8, 'carbs_g' => 8.2, 'fat_g' => 0.2, 'fiber_g' => 3],
            'couve|cabbage|kale' => ['calories' => 32, 'protein_g' => 2, 'carbs_g' => 6, 'fat_g' => 0.2, 'fiber_g' => 2.5],
            'tomate|tomato' => ['calories' => 18, 'protein_g' => 0.9, 'carbs_g' => 3.9, 'fat_g' => 0.2, 'fiber_g' => 1.2],
            'cebola|onion|alho|garlic' => ['calories' => 40, 'protein_g' => 1.1, 'carbs_g' => 9.3, 'fat_g' => 0.1, 'fiber_g' => 1.7],
            'legume|vegetable|greens|sopa|molho|sauce|caldo|stock' => ['calories' => 35, 'protein_g' => 1.5, 'carbs_g' => 7, 'fat_g' => 0.3, 'fiber_g' => 2],
        ];

        foreach ($profiles as $pattern => $profile) {
            if (preg_match('/' . $pattern . '/u', $ingredient)) {
                return $profile;
            }
        }

        return ['calories' => 80, 'protein_g' => 2, 'carbs_g' => 12, 'fat_g' => 2, 'fiber_g' => 1.5];
    }

    private function marmitasNutritionDataForRecipe($recipe)
    {
        $ingredients = is_array($recipe['ingredients_pt'] ?? null)
            ? $recipe['ingredients_pt']
            : array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string)($recipe['ingredients_pt'] ?? '')))));

        return $this->marmitasEstimateNutrition($ingredients);
    }

    private function marmitasNutritionColumns()
    {
        return [
            'nutrition_calories' => 'INT NULL',
            'nutrition_protein_g' => 'DECIMAL(8,1) NULL',
            'nutrition_carbs_g' => 'DECIMAL(8,1) NULL',
            'nutrition_fat_g' => 'DECIMAL(8,1) NULL',
            'nutrition_fiber_g' => 'DECIMAL(8,1) NULL',
        ];
    }

    private function marmitasBackfillNutrition()
    {
        $recipes = (new Query())
            ->from('marmitas_recipes')
            ->where(['or', ['nutrition_calories' => null], ['nutrition_calories' => 0]])
            ->all();

        foreach ($recipes as $recipe) {
            $nutrition = $this->marmitasNutritionDataForRecipe($recipe);
            Yii::$app->db->createCommand()->update('marmitas_recipes', [
                'nutrition_calories' => $nutrition['calories'],
                'nutrition_protein_g' => $nutrition['protein_g'],
                'nutrition_carbs_g' => $nutrition['carbs_g'],
                'nutrition_fat_g' => $nutrition['fat_g'],
                'nutrition_fiber_g' => $nutrition['fiber_g'],
                'updated_at' => date('Y-m-d H:i:s'),
            ], ['id' => $recipe['id']])->execute();
        }
    }

    private function marmitasEnsureStorage()
    {
        Yii::$app->db->createCommand("
            CREATE TABLE IF NOT EXISTS marmitas_recipes (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                slug VARCHAR(120) NOT NULL UNIQUE,
                name_pt VARCHAR(180) NOT NULL,
                name_en VARCHAR(180) NOT NULL,
                tagline_pt TEXT NULL,
                tagline_en TEXT NULL,
                allergens_pt TEXT NULL,
                allergens_en TEXT NULL,
                ingredients_pt TEXT NULL,
                ingredients_en TEXT NULL,
                preparation_pt TEXT NULL,
                preparation_en TEXT NULL,
                storage_pt TEXT NULL,
                storage_en TEXT NULL,
                meal_types VARCHAR(120) NULL,
                allergen_tags VARCHAR(180) NULL,
                nutrition_calories INT NULL,
                nutrition_protein_g DECIMAL(8,1) NULL,
                nutrition_carbs_g DECIMAL(8,1) NULL,
                nutrition_fat_g DECIMAL(8,1) NULL,
                nutrition_fiber_g DECIMAL(8,1) NULL,
                rating_score DECIMAL(3,1) NOT NULL DEFAULT 4.8,
                rating_count INT NOT NULL DEFAULT 0,
                is_favorite TINYINT(1) NOT NULL DEFAULT 0,
                image_url VARCHAR(500) NULL,
                active TINYINT(1) NOT NULL DEFAULT 1,
                week_group TINYINT(1) NOT NULL DEFAULT 1,
                sort_order INT NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ")->execute();

        $recipeColumns = Yii::$app->db->createCommand("SHOW COLUMNS FROM marmitas_recipes")->queryAll();
        $recipeColumnNames = array_column($recipeColumns, 'Field');
        if (!in_array('week_group', $recipeColumnNames, true)) {
            Yii::$app->db->createCommand("ALTER TABLE marmitas_recipes ADD COLUMN week_group TINYINT(1) NOT NULL DEFAULT 1 AFTER active")->execute();
        }
        if (!in_array('meal_types', $recipeColumnNames, true)) {
            Yii::$app->db->createCommand("ALTER TABLE marmitas_recipes ADD COLUMN meal_types VARCHAR(120) NULL AFTER storage_en")->execute();
        }
        if (!in_array('allergen_tags', $recipeColumnNames, true)) {
            Yii::$app->db->createCommand("ALTER TABLE marmitas_recipes ADD COLUMN allergen_tags VARCHAR(180) NULL AFTER meal_types")->execute();
        }
        foreach ($this->marmitasNutritionColumns() as $column => $definition) {
            if (!in_array($column, $recipeColumnNames, true)) {
                Yii::$app->db->createCommand("ALTER TABLE marmitas_recipes ADD COLUMN {$column} {$definition} AFTER storage_en")->execute();
            }
        }
        if (!in_array('rating_score', $recipeColumnNames, true)) {
            Yii::$app->db->createCommand("ALTER TABLE marmitas_recipes ADD COLUMN rating_score DECIMAL(3,1) NOT NULL DEFAULT 4.8 AFTER nutrition_fiber_g")->execute();
        }
        if (!in_array('rating_count', $recipeColumnNames, true)) {
            Yii::$app->db->createCommand("ALTER TABLE marmitas_recipes ADD COLUMN rating_count INT NOT NULL DEFAULT 0 AFTER rating_score")->execute();
        }
        if (!in_array('is_favorite', $recipeColumnNames, true)) {
            Yii::$app->db->createCommand("ALTER TABLE marmitas_recipes ADD COLUMN is_favorite TINYINT(1) NOT NULL DEFAULT 0 AFTER rating_count")->execute();
        }
        if (!in_array('image_url', $recipeColumnNames, true)) {
            Yii::$app->db->createCommand("ALTER TABLE marmitas_recipes ADD COLUMN image_url VARCHAR(500) NULL AFTER is_favorite")->execute();
        }
        $this->marmitasBackfillNutrition();
        $this->marmitasRepairGenericGeneratedIngredients();

        Yii::$app->db->createCommand("
            CREATE TABLE IF NOT EXISTS marmitas_orders (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                order_code VARCHAR(40) NOT NULL UNIQUE,
                delivery_week VARCHAR(160) NOT NULL,
                delivery_time_window VARCHAR(40) NULL,
                customer_name VARCHAR(180) NOT NULL,
                phone VARCHAR(80) NOT NULL,
                address TEXT NOT NULL,
                notes TEXT NULL,
                items_json MEDIUMTEXT NOT NULL,
                meals_total_cents INT NOT NULL DEFAULT 0,
                delivery_fee_cents INT NOT NULL DEFAULT 0,
                packaging_fee_cents INT NOT NULL DEFAULT 0,
                payment_method VARCHAR(20) NOT NULL DEFAULT 'mbway',
                total_cents INT NOT NULL DEFAULT 0,
                status VARCHAR(40) NOT NULL DEFAULT 'pending',
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ")->execute();

        $orderColumns = Yii::$app->db->createCommand("SHOW COLUMNS FROM marmitas_orders")->queryAll();
        $orderColumnNames = array_column($orderColumns, 'Field');
        if (!in_array('packaging_fee_cents', $orderColumnNames, true)) {
            Yii::$app->db->createCommand("ALTER TABLE marmitas_orders ADD COLUMN packaging_fee_cents INT NOT NULL DEFAULT 0 AFTER delivery_fee_cents")->execute();
        }
        if (!in_array('payment_method', $orderColumnNames, true)) {
            Yii::$app->db->createCommand("ALTER TABLE marmitas_orders ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'mbway' AFTER packaging_fee_cents")->execute();
        }
        if (!in_array('delivery_time_window', $orderColumnNames, true)) {
            Yii::$app->db->createCommand("ALTER TABLE marmitas_orders ADD COLUMN delivery_time_window VARCHAR(40) NULL AFTER delivery_week")->execute();
        }

        Yii::$app->db->createCommand("
            CREATE TABLE IF NOT EXISTS marmitas_stock (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                ingredient_key VARCHAR(160) NOT NULL UNIQUE,
                ingredient_name VARCHAR(180) NOT NULL,
                quantity_g INT NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ")->execute();

        Yii::$app->db->createCommand("
            CREATE TABLE IF NOT EXISTS marmitas_stock_history (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                ingredient_key VARCHAR(160) NOT NULL,
                ingredient_name VARCHAR(180) NOT NULL,
                quantity_g INT NOT NULL DEFAULT 0,
                action_type VARCHAR(40) NOT NULL DEFAULT 'adjustment',
                note TEXT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                INDEX idx_marmitas_stock_history_key (ingredient_key),
                INDEX idx_marmitas_stock_history_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ")->execute();

        Yii::$app->db->createCommand("
            CREATE TABLE IF NOT EXISTS marmitas_settings (
                setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
                setting_value TEXT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ")->execute();

        $existingRecipes = (int) Yii::$app->db->createCommand("SELECT COUNT(*) FROM marmitas_recipes")->queryScalar();
        $hasSeededRecipes = (new Query())
            ->from('marmitas_settings')
            ->where(['setting_key' => 'marmitas_recipes_seeded'])
            ->exists();

        if ($existingRecipes > 0) {
            if (!$hasSeededRecipes) {
                Yii::$app->db->createCommand()->insert('marmitas_settings', [
                    'setting_key' => 'marmitas_recipes_seeded',
                    'setting_value' => '1',
                    'updated_at' => date('Y-m-d H:i:s'),
                ])->execute();
            }
            return;
        }

        if ($hasSeededRecipes) {
            return;
        }

        $sortOrder = 10;
        foreach ($this->marmitasDefaultRecipes() as $recipe) {
            $nutrition = $this->marmitasNutritionDataForRecipe($recipe);
            $filterMeta = $this->marmitasRecipeFilterMeta([
                'name_pt' => $recipe['name_pt'],
                'name_en' => $recipe['name_en'],
                'tagline_pt' => $recipe['tagline_pt'],
                'tagline_en' => $recipe['tagline_en'],
                'allergens_pt' => $recipe['allergens_pt'],
                'allergens_en' => $recipe['allergens_en'],
                'ingredients_pt' => implode("\n", $recipe['ingredients_pt']),
                'ingredients_en' => implode("\n", $recipe['ingredients_en']),
            ], $recipe['ingredients_pt'], $recipe['allergens_pt']);
            Yii::$app->db->createCommand()->insert('marmitas_recipes', [
                'slug' => $recipe['id'],
                'name_pt' => $recipe['name_pt'],
                'name_en' => $recipe['name_en'],
                'tagline_pt' => $recipe['tagline_pt'],
                'tagline_en' => $recipe['tagline_en'],
                'allergens_pt' => $recipe['allergens_pt'],
                'allergens_en' => $recipe['allergens_en'],
                'ingredients_pt' => implode("\n", $recipe['ingredients_pt']),
                'ingredients_en' => implode("\n", $recipe['ingredients_en']),
                'preparation_pt' => implode("\n", $recipe['preparation_pt']),
                'preparation_en' => implode("\n", $recipe['preparation_en']),
                'storage_pt' => $recipe['storage_pt'],
                'storage_en' => $recipe['storage_en'],
                'meal_types' => implode(',', $filterMeta['meal_types']),
                'allergen_tags' => implode(',', $filterMeta['allergen_tags']),
                'nutrition_calories' => $nutrition['calories'],
                'nutrition_protein_g' => $nutrition['protein_g'],
                'nutrition_carbs_g' => $nutrition['carbs_g'],
                'nutrition_fat_g' => $nutrition['fat_g'],
                'nutrition_fiber_g' => $nutrition['fiber_g'],
                'rating_score' => $recipe['rating_score'] ?? 4.8,
                'rating_count' => $recipe['rating_count'] ?? 0,
                'is_favorite' => $recipe['is_favorite'] ?? 0,
                'active' => 1,
                'week_group' => (($sortOrder / 10 - 1) % 4) + 1,
                'sort_order' => $sortOrder,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ])->execute();
            $sortOrder += 10;
        }

        Yii::$app->db->createCommand()->insert('marmitas_settings', [
            'setting_key' => 'marmitas_recipes_seeded',
            'setting_value' => '1',
            'updated_at' => date('Y-m-d H:i:s'),
        ])->execute();
    }

    private function marmitasSetting($key, $default = null)
    {
        try {
            $this->marmitasEnsureStorage();
            $value = (new Query())
                ->select('setting_value')
                ->from('marmitas_settings')
                ->where(['setting_key' => $key])
                ->scalar();

            return $value === false ? $default : $value;
        } catch (\Throwable $exception) {
            Yii::error($exception->getMessage(), 'marmitas');
            return $default;
        }
    }

    private function marmitasSaveSetting($key, $value)
    {
        $exists = (new Query())
            ->from('marmitas_settings')
            ->where(['setting_key' => $key])
            ->exists();

        $data = [
            'setting_value' => $value,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($exists) {
            Yii::$app->db->createCommand()->update('marmitas_settings', $data, ['setting_key' => $key])->execute();
            return;
        }

        $data['setting_key'] = $key;
        Yii::$app->db->createCommand()->insert('marmitas_settings', $data)->execute();
    }

    private function marmitasPublishWeeklyMenu(array $ids)
    {
        $rows = (new Query())->select(['id', 'slug'])->from('marmitas_recipes')->where(['id' => $ids])->all();
        if (!$ids || count($rows) !== count($ids)) {
            throw new \InvalidArgumentException('marmitas_weekly_menu_invalid');
        }
        $byId = array_column($rows, 'slug', 'id');
        $slugs = [];
        foreach ($ids as $id) {
            $slugs[] = (string)$byId[$id];
        }
        Yii::$app->db->createCommand()->update('marmitas_recipes', ['active' => 1, 'updated_at' => date('Y-m-d H:i:s')], ['id' => $ids])->execute();
        return $slugs;
    }

    private function marmitasStockKey($ingredientName)
    {
        $key = mb_strtolower(trim((string)$ingredientName), 'UTF-8');
        $key = strtr($key, [
            'á' => 'a', 'à' => 'a', 'ã' => 'a', 'â' => 'a', 'ä' => 'a',
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
            'ó' => 'o', 'ò' => 'o', 'õ' => 'o', 'ô' => 'o', 'ö' => 'o',
            'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u',
            'ç' => 'c',
        ]);
        $key = preg_replace('/[^a-z0-9]+/u', '-', $key);
        return trim((string)$key, '-') ?: 'ingrediente';
    }

    private function marmitasApplyStockDelta($ingredientName, $grams)
    {
        $name = trim((string)$ingredientName);
        $grams = (int)$grams;
        if ($name === '' || $grams === 0) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        Yii::$app->db->createCommand("
            INSERT INTO marmitas_stock (ingredient_key, ingredient_name, quantity_g, created_at, updated_at)
            VALUES (:ingredient_key, :ingredient_name, GREATEST(0, :quantity_g), :created_at, :updated_at)
            ON DUPLICATE KEY UPDATE
                ingredient_name = VALUES(ingredient_name),
                quantity_g = GREATEST(0, quantity_g + :quantity_delta),
                updated_at = VALUES(updated_at)
        ", [
            ':ingredient_key' => $this->marmitasStockKey($name),
            ':ingredient_name' => $name,
            ':quantity_g' => $grams,
            ':quantity_delta' => $grams,
            ':created_at' => $now,
            ':updated_at' => $now,
        ])->execute();
    }

    private function marmitasRecordStockHistory($ingredientName, $grams, $actionType = 'adjustment', $note = '')
    {
        $name = trim((string)$ingredientName);
        $grams = (int)$grams;
        if ($name === '' || $grams === 0) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        Yii::$app->db->createCommand()->insert('marmitas_stock_history', [
            'ingredient_key' => $this->marmitasStockKey($name),
            'ingredient_name' => $name,
            'quantity_g' => $grams,
            'action_type' => (string)$actionType,
            'note' => (string)$note,
            'created_at' => $now,
            'updated_at' => $now,
        ])->execute();
    }

    private function marmitasRecipes($isEnglish, $activeOnly = true)
    {
        try {
            $this->marmitasEnsureStorage();
            $query = (new Query())
                ->from('marmitas_recipes')
                ->orderBy(['sort_order' => SORT_ASC, 'id' => SORT_ASC]);

            if ($activeOnly) {
                $query->andWhere(['active' => 1]);
            }

            $recipes = [];
            foreach ($query->all() as $row) {
                $recipe = $this->marmitasNormalizeRecipe($row, $isEnglish);
                $recipes[$recipe['id']] = $recipe;
            }

            return $recipes;
        } catch (\Throwable $exception) {
            Yii::error($exception->getMessage(), 'marmitas');
        }

        $recipes = [];
        foreach ($this->marmitasDefaultRecipes() as $row) {
            $row['ingredients_pt'] = implode("\n", $row['ingredients_pt']);
            $row['ingredients_en'] = implode("\n", $row['ingredients_en']);
            $row['preparation_pt'] = implode("\n", $row['preparation_pt']);
            $row['preparation_en'] = implode("\n", $row['preparation_en']);
            $recipe = $this->marmitasNormalizeRecipe($row, $isEnglish);
            $recipes[$recipe['id']] = $recipe;
        }

        return $recipes;
    }

    private function marmitasRecipeOrderCounts()
    {
        $countsById = [];
        $countsByName = [];

        try {
            $orders = (new Query())
                ->select(['items_json'])
                ->from('marmitas_orders')
                ->andWhere(['not in', 'status', ['cancelled', 'canceled']])
                ->all();
        } catch (\Throwable $exception) {
            Yii::error($exception->getMessage(), 'marmitas');
            return ['ids' => $countsById, 'names' => $countsByName];
        }

        foreach ($orders as $order) {
            try {
                $items = Json::decode((string)($order['items_json'] ?? '[]'));
            } catch (\Throwable $exception) {
                continue;
            }

            if (!is_array($items)) {
                continue;
            }

            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }

                $quantity = max(0, (int)($item['quantity'] ?? 0));
                if ($quantity === 0) {
                    continue;
                }

                $id = trim((string)($item['id'] ?? ''));
                if ($id !== '') {
                    $countsById[$id] = ($countsById[$id] ?? 0) + $quantity;
                }

                $name = mb_strtolower(trim((string)($item['name'] ?? '')), 'UTF-8');
                if ($name !== '') {
                    $countsByName[$name] = ($countsByName[$name] ?? 0) + $quantity;
                }
            }
        }

        return ['ids' => $countsById, 'names' => $countsByName];
    }

    private function marmitasRankRecipes(array $recipes)
    {
        $orderCounts = $this->marmitasRecipeOrderCounts();

        foreach ($recipes as &$recipe) {
            $recipeId = trim((string)($recipe['id'] ?? ''));
            $recipeName = mb_strtolower(trim((string)($recipe['name'] ?? '')), 'UTF-8');
            $recipe['order_count'] = (int)($orderCounts['ids'][$recipeId] ?? $orderCounts['names'][$recipeName] ?? 0);
            $recipe['rating_score'] = max(0, min(5, (float)($recipe['rating_score'] ?? 4.8)));
            $recipe['rating_count'] = max(0, (int)($recipe['rating_count'] ?? 0));
            $recipe['is_favorite'] = (int)($recipe['is_favorite'] ?? 0) === 1 ? 1 : 0;
        }
        unset($recipe);

        usort($recipes, static function ($a, $b) {
            $orderDiff = (int)($b['order_count'] ?? 0) <=> (int)($a['order_count'] ?? 0);
            if ($orderDiff !== 0) {
                return $orderDiff;
            }

            $ratingA = (float)($a['rating_score'] ?? 0);
            $ratingB = (float)($b['rating_score'] ?? 0);
            if (abs($ratingA - $ratingB) > 0.001) {
                return $ratingA < $ratingB ? 1 : -1;
            }

            $ratingCountDiff = (int)($b['rating_count'] ?? 0) <=> (int)($a['rating_count'] ?? 0);
            if ($ratingCountDiff !== 0) {
                return $ratingCountDiff;
            }

            $sortDiff = (int)($a['sort_order'] ?? 0) <=> (int)($b['sort_order'] ?? 0);
            if ($sortDiff !== 0) {
                return $sortDiff;
            }

            return strcmp((string)($a['id'] ?? ''), (string)($b['id'] ?? ''));
        });

        return $recipes;
    }

    private function marmitasRecipeImagePrompt(array $recipe)
    {
        $backgrounds = [
            'warm rustic Portuguese kitchen table with linen cloth',
            'cream ceramic tile background with soft natural window light',
            'wooden family table with subtle traditional Portuguese details',
            'neutral studio surface with warm handmade food styling',
            'stone countertop with olive green and terracotta accents',
        ];
        $angles = [
            '45 degree three-quarter angle',
            'top-down flat lay angle',
            'low close-up angle showing texture',
            'slightly overhead restaurant menu angle',
            'side angle with shallow depth of field',
        ];
        $background = $backgrounds[array_rand($backgrounds)];
        $angle = $angles[array_rand($angles)];
        $ingredients = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string)($recipe['ingredients_en'] ?? $recipe['ingredients_pt'] ?? '')))));
        $ingredientsText = implode(', ', array_slice($ingredients, 0, 8));

        return 'Create a realistic amateur phone photo for a Portuguese frozen meal brand. Dish: '
            . (string)($recipe['name_en'] ?? $recipe['name_pt'] ?? 'homemade meal')
            . '. Ingredients visible or suggested: ' . $ingredientsText
            . '. Serve as a cooked 500 g homemade meal portion plated on a simple ceramic dinner plate, with a fork, knife, and plain napkin placed naturally beside the plate. '
            . 'Do not include any logo, brand mark, sticker label, packaging, container, or readable text anywhere in the image. '
            . 'The plated meal should look like a real homemade dish photographed by an amateur seller, not a polished studio render. '
            . 'Use ' . $background . ' and a ' . $angle . '. Natural light, warm homemade feeling, no people, no hands, no extra text beyond the logo label.';
    }

    private function marmitasGenerateRecipeImage(array $recipe)
    {
        $apiKey = trim((string)(Yii::$app->params['openai_api_key'] ?? getenv('OPENAI_API_KEY') ?: ''));
        if ($apiKey === '') {
            return ['success' => false, 'message' => Yii::t('app', 'OpenAI API key is not configured.')];
        }

        if (!function_exists('curl_init')) {
            return ['success' => false, 'message' => Yii::t('app', 'cURL is not available on this server.')];
        }

        $prompt = $this->marmitasRecipeImagePrompt($recipe);
        $imageResult = $this->marmitasCallImageService($apiKey, $prompt);
        if (!$imageResult['success']) {
            return $imageResult;
        }

        $decoded = $imageResult['decoded'];
        $base64 = (string)($decoded['data'][0]['b64_json'] ?? '');
        if ($base64 === '' && !empty($decoded['data'][0]['url'])) {
            $imageBinary = @file_get_contents((string)$decoded['data'][0]['url']);
        } else {
            $imageBinary = base64_decode($base64, true);
        }

        if ($imageBinary === false || $imageBinary === '') {
            return ['success' => false, 'message' => Yii::t('app', 'Image generation returned no image.')];
        }

        $directory = Yii::getAlias('@frontend/web/images/marmitas/recipes');
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            return ['success' => false, 'message' => Yii::t('app', 'Could not create recipe image folder.')];
        }

        $slug = preg_replace('/[^a-z0-9\-]+/', '-', strtolower((string)($recipe['slug'] ?? $recipe['id'] ?? 'recipe')));
        $slug = trim((string)$slug, '-') ?: 'recipe';
        $fileName = $slug . '-' . date('YmdHis') . '-' . strtolower(substr(Yii::$app->security->generateRandomString(6), 0, 6)) . '.png';
        $path = $directory . DIRECTORY_SEPARATOR . $fileName;

        if (file_put_contents($path, $imageBinary) === false) {
            return ['success' => false, 'message' => Yii::t('app', 'Could not save generated image.')];
        }

        $this->marmitasCreateRecipeImageVariants($path);

        $url = '/images/marmitas/recipes/' . $fileName;

        Yii::$app->db->createCommand()->update('marmitas_recipes', [
            'image_url' => $url,
            'updated_at' => date('Y-m-d H:i:s'),
        ], ['id' => (int)$recipe['id']])->execute();

        return ['success' => true, 'image_url' => Url::to($url, true)];
    }

    private function marmitasRecipeImageReferencePaths($includeLogo = true)
    {
        $paths = [Yii::getAlias('@frontend/web/images/marmitas/reference-clear-container.png')];

        if ($includeLogo) {
            $paths[] = Yii::getAlias('@frontend/web/images/marmitas/reference-dona-ofelia-logo.png');
        }

        return array_values(array_filter($paths, static function ($path) {
            return is_file($path) && is_readable($path);
        }));
    }

    private function marmitasCallImageService($apiKey, $prompt, array $referencePaths = [])
    {
        $headers = ['Authorization: Bearer ' . $apiKey];
        if (!empty($referencePaths)) {
            $boundary = '----OfeliaImageBoundary' . Yii::$app->security->generateRandomString(16);
            $body = $this->marmitasBuildImageEditMultipart([
                'model' => 'gpt-image-1',
                'prompt' => $prompt,
                'size' => '1024x1024',
                'quality' => 'medium',
                'input_fidelity' => 'high',
            ], $referencePaths, $boundary);
            $url = 'https://api.openai.com/v1/images/edits';
            $headers[] = 'Content-Type: multipart/form-data; boundary=' . $boundary;
        } else {
            $body = Json::encode([
                'model' => 'gpt-image-1',
                'prompt' => $prompt,
                'size' => '1024x1024',
                'quality' => 'medium',
            ]);
            $url = 'https://api.openai.com/v1/images/generations';
            $headers[] = 'Content-Type: application/json';
        }

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 20);
        curl_setopt($ch, CURLOPT_TIMEOUT, 120);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false || $curlError !== '') {
            Yii::error($curlError, 'marmitas-image');
            return ['success' => false, 'message' => Yii::t('app', 'Could not contact the image service.')];
        }

        try {
            $decoded = Json::decode($response);
        } catch (\Throwable $exception) {
            Yii::error($exception->getMessage(), 'marmitas-image');
            return ['success' => false, 'message' => Yii::t('app', 'Invalid image service response.')];
        }

        if ($statusCode < 200 || $statusCode >= 300) {
            $message = (string)($decoded['error']['message'] ?? Yii::t('app', 'Image generation failed.'));
            Yii::error($message, 'marmitas-image');
            return ['success' => false, 'message' => $message];
        }

        return ['success' => true, 'decoded' => $decoded];
    }

    private function marmitasBuildImageEditMultipart(array $fields, array $referencePaths, $boundary)
    {
        $lineBreak = "\r\n";
        $body = '';

        foreach ($fields as $name => $value) {
            $body .= '--' . $boundary . $lineBreak;
            $body .= 'Content-Disposition: form-data; name="' . $name . '"' . $lineBreak . $lineBreak;
            $body .= (string)$value . $lineBreak;
        }

        foreach ($referencePaths as $path) {
            $mimeType = function_exists('mime_content_type') ? mime_content_type($path) : 'image/png';
            $body .= '--' . $boundary . $lineBreak;
            $body .= 'Content-Disposition: form-data; name="image[]"; filename="' . basename($path) . '"' . $lineBreak;
            $body .= 'Content-Type: ' . ($mimeType ?: 'image/png') . $lineBreak . $lineBreak;
            $body .= file_get_contents($path) . $lineBreak;
        }

        return $body . '--' . $boundary . '--' . $lineBreak;
    }

    private function marmitasGeneratePreparationText($namePt, $taglinePt, $ingredientsPt)
    {
        $prompt = "Receita: {$namePt}\nDescrição: {$taglinePt}\nIngredientes:\n{$ingredientsPt}\n\n"
            . "Gera uma preparação em português de Portugal para uma marmita caseira congelável de 500 g. "
            . "Escreve 5 passos curtos, práticos e seguros para cozinhar, arrefecer, embalar, congelar e reaquecer. "
            . "Devolve apenas os passos, um por linha, sem numeração e sem texto extra.";

        $result = $this->marmitasCallTextService(
            'És um chef português especializado em marmitas caseiras congeláveis, segurança alimentar e instruções simples para cozinha profissional pequena.',
            $prompt
        );

        if (!$result['success']) {
            return $result;
        }

        return ['success' => true, 'text' => $this->marmitasCleanGeneratedLines($result['text'], 5)];
    }

    private function marmitasTranslateRecipeFields(array $fieldsPt)
    {
        $prompt = "Translate these Portuguese recipe form fields into clear natural English for a homemade frozen meal business. "
            . "Keep line breaks for ingredients and preparation. Return only valid JSON with keys: name_en, tagline_en, allergens_en, ingredients_en, preparation_en, storage_en.\n\n"
            . Json::encode([
                'name_pt' => $fieldsPt['name'] ?? '',
                'tagline_pt' => $fieldsPt['tagline'] ?? '',
                'allergens_pt' => $fieldsPt['allergens'] ?? '',
                'ingredients_pt' => $fieldsPt['ingredients'] ?? '',
                'preparation_pt' => $fieldsPt['preparation'] ?? '',
                'storage_pt' => $fieldsPt['storage'] ?? '',
            ]);

        $result = $this->marmitasCallTextService(
            'You translate Portuguese recipe form fields into English and return strict JSON only.',
            $prompt
        );

        if (!$result['success']) {
            return $result;
        }

        $text = trim($result['text']);
        $text = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', $text);

        try {
            $decoded = Json::decode($text);
        } catch (\Throwable $exception) {
            Yii::error($exception->getMessage(), 'marmitas-text');
            return ['success' => false, 'message' => Yii::t('app', 'Invalid text service response.')];
        }

        if (!is_array($decoded)) {
            return ['success' => false, 'message' => Yii::t('app', 'Invalid text service response.')];
        }

        return ['success' => true, 'fields' => [
            'name_en' => trim((string)($decoded['name_en'] ?? '')),
            'tagline_en' => trim((string)($decoded['tagline_en'] ?? '')),
            'allergens_en' => trim((string)($decoded['allergens_en'] ?? '')),
            'ingredients_en' => $this->marmitasCleanGeneratedLines((string)($decoded['ingredients_en'] ?? '')),
            'preparation_en' => $this->marmitasCleanGeneratedLines((string)($decoded['preparation_en'] ?? '')),
            'storage_en' => trim((string)($decoded['storage_en'] ?? '')),
        ]];
    }

    private function marmitasCallTextService($systemPrompt, $userPrompt)
    {
        $apiKey = trim((string)(Yii::$app->params['openai_api_key'] ?? getenv('OPENAI_API_KEY') ?: ''));
        if ($apiKey === '') {
            return ['success' => false, 'message' => Yii::t('app', 'OpenAI API key is not configured.')];
        }

        if (!function_exists('curl_init')) {
            return ['success' => false, 'message' => Yii::t('app', 'cURL is not available on this server.')];
        }

        $payload = [
            'model' => Yii::$app->params['openai_text_model'] ?? 'gpt-4o-mini',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userPrompt],
            ],
            'temperature' => 0.4,
        ];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 20);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_POSTFIELDS, Json::encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ]);

        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false || $curlError !== '') {
            Yii::error($curlError, 'marmitas-text');
            return ['success' => false, 'message' => Yii::t('app', 'Could not contact the text service.')];
        }

        try {
            $decoded = Json::decode($response);
        } catch (\Throwable $exception) {
            Yii::error($exception->getMessage(), 'marmitas-text');
            return ['success' => false, 'message' => Yii::t('app', 'Invalid text service response.')];
        }

        if ($statusCode < 200 || $statusCode >= 300) {
            $message = (string)($decoded['error']['message'] ?? Yii::t('app', 'Text generation failed.'));
            Yii::error($message, 'marmitas-text');
            return ['success' => false, 'message' => $message];
        }

        $text = trim((string)($decoded['choices'][0]['message']['content'] ?? ''));
        if ($text === '') {
            return ['success' => false, 'message' => Yii::t('app', 'Text generation returned no text.')];
        }

        return ['success' => true, 'text' => $text];
    }

    private function marmitasCleanGeneratedLines($text, $limit = null)
    {
        $lines = array_values(array_filter(array_map(static function ($line) {
            $line = trim((string)$line);
            $line = preg_replace('/^\s*(?:[-*•]|\d+[\).\s-]+)\s*/u', '', $line);
            return trim((string)$line);
        }, preg_split('/\r\n|\r|\n/', (string)$text))));

        if ($limit !== null) {
            $lines = array_slice($lines, 0, (int)$limit);
        }

        return implode("\n", $lines);
    }

    private function marmitasCreateRecipeImageVariants($sourcePath)
    {
        if (!function_exists('imagewebp') || !is_file($sourcePath)) {
            return;
        }

        $info = @getimagesize($sourcePath);
        if (empty($info[0]) || empty($info[1]) || empty($info[2])) {
            return;
        }

        $createImage = null;
        if ((int)$info[2] === IMAGETYPE_PNG && function_exists('imagecreatefrompng')) {
            $createImage = 'imagecreatefrompng';
        } elseif ((int)$info[2] === IMAGETYPE_JPEG && function_exists('imagecreatefromjpeg')) {
            $createImage = 'imagecreatefromjpeg';
        } elseif ((int)$info[2] === IMAGETYPE_WEBP && function_exists('imagecreatefromwebp')) {
            $createImage = 'imagecreatefromwebp';
        }

        if ($createImage === null) {
            return;
        }

        $source = @$createImage($sourcePath);
        if (!$source) {
            return;
        }

        $pathInfo = pathinfo($sourcePath);
        $sourceWidth = (int)$info[0];
        $sourceHeight = (int)$info[1];

        foreach ([640, 960] as $targetWidth) {
            $newWidth = min($targetWidth, $sourceWidth);
            $newHeight = (int)round($sourceHeight * $newWidth / $sourceWidth);
            $destinationPath = $pathInfo['dirname'] . DIRECTORY_SEPARATOR . $pathInfo['filename'] . '-' . $targetWidth . '.webp';

            $destination = imagecreatetruecolor($newWidth, $newHeight);
            if (!$destination) {
                continue;
            }

            imagealphablending($destination, true);
            imagesavealpha($destination, true);
            imagecopyresampled($destination, $source, 0, 0, 0, 0, $newWidth, $newHeight, $sourceWidth, $sourceHeight);
            imagewebp($destination, $destinationPath, 84);
            imagedestroy($destination);
        }

        imagedestroy($source);
    }

    public function actionMarmitasRecipe($id)
    {
        $baseUrl = Helpers::getBaseUrl();
        if (!in_array($baseUrl, ['localhost:92', 'marmitasdadonaofelia.com'], true)) {
            throw new NotFoundHttpException(Yii::t('app', 'Page not found.'));
        }

        $this->applyMarmitasLanguageFromQuery();
        $this->layout = 'marmitas';

        $isEnglish = strpos(strtolower((string) Yii::$app->language), 'en') === 0;
        $recipes = [];
        foreach ($this->marmitasRankRecipes(array_values($this->marmitasRecipes($isEnglish))) as $recipe) {
            $recipes[$recipe['id']] = $recipe;
        }

        if (!isset($recipes[$id])) {
            throw new NotFoundHttpException(Yii::t('app', 'Recipe not found.'));
        }

        return $this->render('home/recipe-marmitas', [
            'recipe' => $recipes[$id],
            'recipes' => $recipes,
            'isEnglish' => $isEnglish,
        ]);
    }

    public function actionMarmitasOrderSave()
    {
        $baseUrl = Helpers::getBaseUrl();
        if (!in_array($baseUrl, ['localhost:92', 'marmitasdadonaofelia.com'], true)) {
            throw new NotFoundHttpException(Yii::t('app', 'Page not found.'));
        }

        Yii::$app->response->format = Response::FORMAT_JSON;

        if (!Yii::$app->request->isPost) {
            return ['success' => false, 'message' => Yii::t('app', 'Invalid request.')];
        }

        try {
            $this->marmitasEnsureStorage();
            $items = Json::decode((string)Yii::$app->request->post('items_json', '[]'));
            if (!is_array($items)) {
                $items = [];
            }
            $orderAmounts = \common\helpers\MarmitasOrderHelper::calculateOrder($items);
            $items = $orderAmounts['items'];

            $deliveryDateValue = trim((string)Yii::$app->request->post('week', ''));
            $deliveryDate = \DateTimeImmutable::createFromFormat('!Y-m-d', $deliveryDateValue, new \DateTimeZone('Europe/Lisbon'));
            $dateErrors = \DateTimeImmutable::getLastErrors();
            $now = new \DateTimeImmutable('now', new \DateTimeZone('Europe/Lisbon'));
            $minimumDeliveryDate = $now->modify($now->format('H') >= 18 ? '+4 days' : '+3 days')->setTime(0, 0);
            if (!$deliveryDate || ($dateErrors !== false && ($dateErrors['warning_count'] > 0 || $dateErrors['error_count'] > 0)) || $deliveryDate < $minimumDeliveryDate) {
                return [
                    'success' => false,
                    'message' => Yii::t('app', 'Choose a delivery date at least 3 days before delivery, with orders sent by 18:00.'),
                ];
            }
            $deliveryTimeWindows = ['09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-18:00'];
            $deliveryTimeWindow = trim((string)Yii::$app->request->post('delivery_time_window', ''));
            if (!in_array($deliveryTimeWindow, $deliveryTimeWindows, true)) {
                return [
                    'success' => false,
                    'message' => Yii::t('app', 'Choose a delivery time window.'),
                ];
            }

            $orderCode = 'OF-' . date('Ymd-His') . '-' . strtoupper(substr(Yii::$app->security->generateRandomString(6), 0, 6));
            Yii::$app->db->createCommand()->insert('marmitas_orders', [
                'order_code' => $orderCode,
                'delivery_week' => $deliveryDate->format('Y-m-d'),
                'delivery_time_window' => $deliveryTimeWindow,
                'customer_name' => (string)Yii::$app->request->post('name', ''),
                'phone' => (string)Yii::$app->request->post('phone', ''),
                'address' => (string)Yii::$app->request->post('address', ''),
                'notes' => (string)Yii::$app->request->post('notes', ''),
                'items_json' => Json::encode($items),
                'meals_total_cents' => $orderAmounts['meals_total_cents'],
                'delivery_fee_cents' => $orderAmounts['delivery_fee_cents'],
                'packaging_fee_cents' => $orderAmounts['packaging_fee_cents'],
                'payment_method' => 'pending',
                'total_cents' => $orderAmounts['total_cents'],
                'status' => 'pending',
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ])->execute();

            return ['success' => true, 'order_code' => $orderCode];
        } catch (\InvalidArgumentException $exception) {
            Yii::$app->response->statusCode = 422;
            $messageKey = in_array($exception->getMessage(), ['marmitas_minimum_order', 'marmitas_invalid_payment_method'], true)
                ? $exception->getMessage() : 'marmitas_invalid_order_items';
            return ['success' => false, 'message' => Yii::t('app', $messageKey)];
        } catch (\Throwable $exception) {
            Yii::error($exception->getMessage(), 'marmitas');
            return ['success' => false, 'message' => Yii::t('app', 'Could not save order.')];
        }
    }

    public function actionMarmitasAdmin()
    {
        $baseUrl = Helpers::getBaseUrl();
        if (!in_array($baseUrl, ['localhost:92', 'marmitasdadonaofelia.com'], true)) {
            throw new NotFoundHttpException(Yii::t('app', 'Page not found.'));
        }

        $this->applyMarmitasLanguageFromQuery();
        $this->layout = 'marmitas';

        $session = Yii::$app->session;
        $request = Yii::$app->request;
        $adminUsers = Yii::$app->params['marmitas_admin_users'] ?? [
            (string)(Yii::$app->params['marmitas_admin_user'] ?? 'admin') => (string)(Yii::$app->params['marmitas_admin_password'] ?? 'marmitas2026'),
        ];
        $loginError = null;

        if ($request->isPost && $request->post('admin_action') === 'logout') {
            $session->remove('marmitas_admin_authenticated');
            return $this->redirect(['/site/marmitas-admin']);
        }

        if (!$session->get('marmitas_admin_authenticated')) {
            if ($request->isPost && $request->post('admin_action') === 'ajax_ingredient_totals') {
                Yii::$app->response->format = Response::FORMAT_JSON;
                Yii::$app->response->statusCode = 401;
                return ['success' => false, 'message' => Yii::t('app', 'clock_session_expired')];
            }
            if ($request->isPost && $request->post('admin_action') === 'login') {
                $username = (string)$request->post('username', '');
                $password = (string)$request->post('password', '');
                $expectedPassword = is_array($adminUsers) ? ($adminUsers[$username] ?? null) : null;
                if ($expectedPassword !== null && hash_equals((string)$expectedPassword, $password)) {
                    $session->set('marmitas_admin_authenticated', true);
                    $session->set('marmitas_admin_username', $username);
                    return $this->redirect(['/site/marmitas-admin']);
                }
                $loginError = Yii::t('app', 'Dados de acesso inválidos.');
            }

            return $this->render('home/marmitas-admin', [
                'authenticated' => false,
                'loginError' => $loginError,
            ]);
        }

        if ($request->isPost && $request->post('admin_action') === 'ajax_ingredient_totals') {
            Yii::$app->response->format = Response::FORMAT_JSON;
            try {
                $quantities = \common\helpers\MarmitasIngredientHelper::quantities(Json::decode((string)$request->post('recipe_quantities', '{}')));
                $recipes = $quantities ? (new Query())->select(['id', 'ingredients_pt', 'ingredients_en'])
                    ->from('marmitas_recipes')->where(['id' => array_keys($quantities)])->all() : [];
                if (count($recipes) !== count($quantities)) throw new \InvalidArgumentException();
                return ['success' => true, 'ingredients' => \common\helpers\MarmitasIngredientHelper::aggregate($recipes, $quantities, strpos(Yii::$app->language, 'en') === 0 ? 'en' : 'pt'),
                    'totalMeals' => array_sum($quantities), 'recipeCount' => count($recipes)];
            } catch (\Throwable $exception) {
                Yii::warning($exception, 'marmitas-ingredient-totals');
                Yii::$app->response->statusCode = $exception instanceof \InvalidArgumentException ? 422 : 500;
                return ['success' => false, 'message' => Yii::t('app', 'marmitas_ingredients_ajax_error')];
            }
        }

        $this->marmitasEnsureStorage();

        if ($request->isPost && in_array($request->post('admin_action'), ['publish_weekly_menu', 'unpublish_weekly_menu'], true)) {
            $transaction = Yii::$app->db->beginTransaction();
            try {
                $slugs = [];
                if ($request->post('admin_action') === 'publish_weekly_menu') {
                    $ids = \common\helpers\MarmitasWeeklyMenuHelper::recipeIds($request->post('weekly_recipe_ids', []));
                    $slugs = $this->marmitasPublishWeeklyMenu($ids);
                }
                $this->marmitasSaveSetting('weekly_menu', Json::encode($slugs));
                $transaction->commit();
                $session->setFlash('success', Yii::t('app', $slugs ? 'marmitas_weekly_menu_published' : 'marmitas_weekly_menu_unpublished'));
            } catch (\Throwable $exception) {
                $transaction->rollBack();
                Yii::warning($exception, 'marmitas-weekly-menu');
                $session->setFlash('error', Yii::t('app', $exception instanceof \InvalidArgumentException ? $exception->getMessage() : 'marmitas_weekly_menu_error'));
            }
            return $this->redirect(['/site/marmitas-admin', 'tab' => 'kitchen', '#' => 'weekly-menu-publisher']);
        }

        if ($request->isPost && $request->post('admin_action') === 'generate_recipes') {
            $customRecipeName = trim((string)$request->post('custom_recipe_name', ''));
            $existingSlugs = (new Query())
                ->select('slug')
                ->from('marmitas_recipes')
                ->column();
            $existingSlugs = array_fill_keys(array_map('strval', $existingSlugs), true);
            $sortOrder = (int) Yii::$app->db->createCommand('SELECT COALESCE(MAX(sort_order), 0) FROM marmitas_recipes')->queryScalar();
            $created = 0;
            $now = date('Y-m-d H:i:s');
            $recipeIdeas = $customRecipeName !== ''
                ? [$this->marmitasRecipeFromPrompt($customRecipeName)]
                : $this->marmitasGeneratedRecipeIdeas();

            foreach ($recipeIdeas as $recipe) {
                $recipe = $this->marmitasEnrichGeneratedRecipe($recipe);
                $sortOrder += 10;
                $nutrition = $this->marmitasNutritionDataForRecipe($recipe);
                $filterMeta = $this->marmitasRecipeFilterMeta([
                    'name_pt' => $recipe['name_pt'],
                    'name_en' => $recipe['name_en'],
                    'tagline_pt' => $recipe['tagline_pt'],
                    'tagline_en' => $recipe['tagline_en'],
                    'allergens_pt' => $recipe['allergens_pt'],
                    'allergens_en' => $recipe['allergens_en'],
                    'ingredients_pt' => implode("\n", $recipe['ingredients_pt']),
                    'ingredients_en' => implode("\n", $recipe['ingredients_en']),
                ], $recipe['ingredients_pt'], $recipe['allergens_pt']);
                Yii::$app->db->createCommand()->insert('marmitas_recipes', [
                    'slug' => $this->marmitasUniqueRecipeSlug($recipe['slug'], $existingSlugs),
                    'name_pt' => $recipe['name_pt'],
                    'name_en' => $recipe['name_en'],
                    'tagline_pt' => $recipe['tagline_pt'],
                    'tagline_en' => $recipe['tagline_en'],
                    'allergens_pt' => $recipe['allergens_pt'],
                    'allergens_en' => $recipe['allergens_en'],
                    'ingredients_pt' => implode("\n", $recipe['ingredients_pt']),
                    'ingredients_en' => implode("\n", $recipe['ingredients_en']),
                    'preparation_pt' => implode("\n", $recipe['preparation_pt']),
                    'preparation_en' => implode("\n", $recipe['preparation_en']),
                    'storage_pt' => 'Conservar congelado. Depois de descongelar, consumir em 24 horas e não voltar a congelar.',
                    'storage_en' => 'Keep frozen. After thawing, consume within 24 hours and do not refreeze.',
                    'meal_types' => implode(',', $filterMeta['meal_types']),
                    'allergen_tags' => implode(',', $filterMeta['allergen_tags']),
                    'nutrition_calories' => $nutrition['calories'],
                    'nutrition_protein_g' => $nutrition['protein_g'],
                    'nutrition_carbs_g' => $nutrition['carbs_g'],
                    'nutrition_fat_g' => $nutrition['fat_g'],
                    'nutrition_fiber_g' => $nutrition['fiber_g'],
                    'rating_score' => $recipe['rating_score'] ?? 4.8,
                    'rating_count' => $recipe['rating_count'] ?? 0,
                    'is_favorite' => $recipe['is_favorite'] ?? 0,
                    'active' => 0,
                    'week_group' => (($sortOrder / 10 - 1) % 4) + 1,
                    'sort_order' => $sortOrder,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->execute();
                $created++;
            }

            Yii::$app->session->setFlash('success', $customRecipeName !== ''
                ? Yii::t('app', 'Receita adicionada como não publicada.')
                : Yii::t('app', '{count} receitas geradas para marmitas portuguesas congeláveis.', ['count' => $created]));
            return $this->redirect(['/site/marmitas-admin', '#' => 'recipes']);
        }

        if ($request->isPost && $request->post('admin_action') === 'generate_recipe_image') {
            Yii::$app->response->format = Response::FORMAT_JSON;
            $recipeId = (int)$request->post('recipe_id', 0);
            $recipe = $recipeId > 0
                ? (new Query())->from('marmitas_recipes')->where(['id' => $recipeId])->one()
                : null;

            if (!$recipe) {
                return ['success' => false, 'message' => Yii::t('app', 'Recipe not found.')];
            }

            return $this->marmitasGenerateRecipeImage($recipe);
        }

        if ($request->isPost && $request->post('admin_action') === 'calculate_recipe_nutrition') {
            Yii::$app->response->format = Response::FORMAT_JSON;
            $recipeId = (int)$request->post('recipe_id', 0);
            $recipe = $recipeId > 0
                ? (new Query())->from('marmitas_recipes')->where(['id' => $recipeId])->one()
                : null;

            if (!$recipe) {
                return ['success' => false, 'message' => Yii::t('app', 'Recipe not found.')];
            }

            $nutrition = $this->marmitasNutritionDataForRecipe($recipe);
            Yii::$app->db->createCommand()->update('marmitas_recipes', [
                'nutrition_calories' => $nutrition['calories'],
                'nutrition_protein_g' => $nutrition['protein_g'],
                'nutrition_carbs_g' => $nutrition['carbs_g'],
                'nutrition_fat_g' => $nutrition['fat_g'],
                'nutrition_fiber_g' => $nutrition['fiber_g'],
                'updated_at' => date('Y-m-d H:i:s'),
            ], ['id' => $recipeId])->execute();

            return ['success' => true, 'nutrition' => $nutrition];
        }

        if ($request->isPost && $request->post('admin_action') === 'generate_recipe_preparation_text') {
            Yii::$app->response->format = Response::FORMAT_JSON;
            $recipeId = (int)$request->post('recipe_id', 0);
            $recipe = $recipeId > 0
                ? (new Query())->from('marmitas_recipes')->where(['id' => $recipeId])->one()
                : [];

            $namePt = trim((string)$request->post('name_pt', $recipe['name_pt'] ?? ''));
            $taglinePt = trim((string)$request->post('tagline_pt', $recipe['tagline_pt'] ?? ''));
            $ingredientsPt = trim((string)$request->post('ingredients_pt', $recipe['ingredients_pt'] ?? ''));

            if ($namePt === '' || $ingredientsPt === '') {
                return ['success' => false, 'message' => Yii::t('app', 'Preenche o nome e os ingredientes em PT antes de gerar a preparação.')];
            }

            $result = $this->marmitasGeneratePreparationText($namePt, $taglinePt, $ingredientsPt);
            if (!$result['success']) {
                return $result;
            }

            return ['success' => true, 'preparation_pt' => $result['text']];
        }

        if ($request->isPost && $request->post('admin_action') === 'translate_recipe_fields') {
            Yii::$app->response->format = Response::FORMAT_JSON;
            $fieldsPt = [
                'name' => trim((string)$request->post('name_pt', '')),
                'tagline' => trim((string)$request->post('tagline_pt', '')),
                'allergens' => trim((string)$request->post('allergens_pt', '')),
                'ingredients' => trim((string)$request->post('ingredients_pt', '')),
                'preparation' => trim((string)$request->post('preparation_pt', '')),
                'storage' => trim((string)$request->post('storage_pt', '')),
            ];

            if (implode('', $fieldsPt) === '') {
                return ['success' => false, 'message' => Yii::t('app', 'Preenche os campos em PT antes de traduzir.')];
            }

            $result = $this->marmitasTranslateRecipeFields($fieldsPt);
            if (!$result['success']) {
                return $result;
            }

            return ['success' => true, 'fields' => $result['fields']];
        }

        if ($request->isPost && $request->post('admin_action') === 'bulk_publish_recipes') {
            $active = (int)$request->post('active', 0) === 1 ? 1 : 0;
            Yii::$app->db->createCommand()->update('marmitas_recipes', [
                'active' => $active,
                'updated_at' => date('Y-m-d H:i:s'),
            ])->execute();

            Yii::$app->session->setFlash('success', $active === 1
                ? Yii::t('app', 'Todas as receitas foram publicadas.')
                : Yii::t('app', 'Todas as receitas foram retiradas da publicação.'));
            return $this->redirect(['/site/marmitas-admin', '#' => 'recipes']);
        }

        if ($request->isPost && $request->post('admin_action') === 'delete_recipe') {
            $recipeId = (int)$request->post('recipe_id', 0);
            if ($recipeId > 0) {
                Yii::$app->db->createCommand()->delete('marmitas_recipes', ['id' => $recipeId])->execute();
                Yii::$app->session->setFlash('success', Yii::t('app', 'Receita apagada.'));
            }

            return $this->redirect(['/site/marmitas-admin', '#' => 'recipes']);
        }

        if ($request->isPost && $request->post('admin_action') === 'delete_recipes') {
            $recipeIds = array_values(array_filter(array_map('intval', (array)$request->post('recipe_ids', []))));
            if (!empty($recipeIds)) {
                Yii::$app->db->createCommand()->delete('marmitas_recipes', ['id' => $recipeIds])->execute();
                Yii::$app->session->setFlash('success', Yii::t('app', '{count} receitas apagadas.', ['count' => count($recipeIds)]));
            }

            return $this->redirect(['/site/marmitas-admin', '#' => 'recipes']);
        }

        if ($request->isPost && $request->post('admin_action') === 'ajax_save_ingredient') {
            Yii::$app->response->format = Response::FORMAT_JSON;

            $recipeId = (int)$request->post('recipe_id', 0);
            $index = max(0, (int)$request->post('ingredient_index', 0));
            $recipe = $recipeId > 0
                ? (new Query())->from('marmitas_recipes')->where(['id' => $recipeId])->one()
                : null;

            if (!$recipe) {
                return ['success' => false, 'message' => Yii::t('app', 'Receita não encontrada.')];
            }

            $namePt = trim((string)$request->post('name_pt', ''));
            $nameEn = trim((string)$request->post('name_en', ''));
            $amount = trim((string)$request->post('amount', ''));
            $unit = strtolower(trim((string)$request->post('unit', 'g')));
            $allowedUnits = ['g', 'kg', 'ml', 'l', 'un'];
            if (!in_array($unit, $allowedUnits, true)) {
                $unit = 'g';
            }

            if ($namePt === '' || $nameEn === '') {
                return ['success' => false, 'message' => Yii::t('app', 'Preenche o ingrediente em PT e EN.')];
            }

            $amount = preg_replace('/[^0-9,.]/', '', $amount);
            $measurement = $amount !== '' ? ' ' . str_replace('.', ',', $amount) . ' ' . $unit : '';
            $linePt = $namePt . $measurement;
            $lineEn = $nameEn . $measurement;
            $replaceLine = static function ($text, $lineIndex, $lineValue) {
                $lines = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string)$text)), static function ($line) {
                    return $line !== '';
                }));
                while (count($lines) <= $lineIndex) {
                    $lines[] = '';
                }
                $lines[$lineIndex] = trim((string)$lineValue);
                return implode("\n", array_values(array_filter($lines, static function ($line) {
                    return trim((string)$line) !== '';
                })));
            };

            $ingredientsPt = $replaceLine($recipe['ingredients_pt'] ?? '', $index, $linePt);
            $ingredientsEn = $replaceLine($recipe['ingredients_en'] ?? '', $index, $lineEn);

            Yii::$app->db->createCommand()->update('marmitas_recipes', [
                'ingredients_pt' => $ingredientsPt,
                'ingredients_en' => $ingredientsEn,
                'updated_at' => date('Y-m-d H:i:s'),
            ], ['id' => $recipeId])->execute();

            return [
                'success' => true,
                'name' => $namePt,
                'amount' => $amount,
                'unit' => $unit,
                'display_quantity' => $amount !== '' ? str_replace('.', ',', $amount) . ' ' . $unit : '',
                'line_pt' => $linePt,
                'line_en' => $lineEn,
                'ingredients_pt' => $ingredientsPt,
                'ingredients_en' => $ingredientsEn,
            ];
        }

        if ($request->isPost && $request->post('admin_action') === 'ajax_delete_ingredient') {
            Yii::$app->response->format = Response::FORMAT_JSON;

            $recipeId = (int)$request->post('recipe_id', 0);
            $index = max(0, (int)$request->post('ingredient_index', 0));
            $recipe = $recipeId > 0
                ? (new Query())->from('marmitas_recipes')->where(['id' => $recipeId])->one()
                : null;

            if (!$recipe) {
                return ['success' => false, 'message' => Yii::t('app', 'Receita não encontrada.')];
            }

            $removeLine = static function ($text, $lineIndex) {
                $lines = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string)$text)), static function ($line) {
                    return $line !== '';
                }));
                if (isset($lines[$lineIndex])) {
                    array_splice($lines, $lineIndex, 1);
                }

                return implode("\n", $lines);
            };
            $ingredientsPt = $removeLine($recipe['ingredients_pt'] ?? '', $index);
            $ingredientsEn = $removeLine($recipe['ingredients_en'] ?? '', $index);

            Yii::$app->db->createCommand()->update('marmitas_recipes', [
                'ingredients_pt' => $ingredientsPt,
                'ingredients_en' => $ingredientsEn,
                'updated_at' => date('Y-m-d H:i:s'),
            ], ['id' => $recipeId])->execute();

            return [
                'success' => true,
                'ingredients_pt' => $ingredientsPt,
                'ingredients_en' => $ingredientsEn,
            ];
        }

        if ($request->isPost && $request->post('admin_action') === 'save_recipe') {
            $recipeId = (int)$request->post('recipe_id', 0);
            $existingRecipe = $recipeId > 0
                ? (new Query())->from('marmitas_recipes')->where(['id' => $recipeId])->one()
                : null;
            $nullableFloat = static function ($value) {
                $value = trim((string)$value);
                if ($value === '') {
                    return null;
                }

                return max(0, round((float)str_replace(',', '.', $value), 1));
            };
            $nullableInt = static function ($value) {
                $value = trim((string)$value);
                if ($value === '') {
                    return null;
                }

                return max(0, (int)$value);
            };
            $slug = trim((string)$request->post('slug', ($existingRecipe['slug'] ?? '')));
            $slug = preg_replace('/[^a-z0-9\-]+/', '-', strtolower($slug));
            $slug = trim($slug, '-');
            if ($slug === '') {
                $slugBase = preg_replace('/[^a-z0-9\-]+/', '-', strtolower((string)$request->post('name_pt', 'receita')));
                $slugBase = trim((string)$slugBase, '-') ?: 'receita';
                $slugSuffix = preg_replace('/[^a-z0-9]+/', '', strtolower(Yii::$app->security->generateRandomString(8)));
                $slug = $slugBase . '-' . substr($slugSuffix ?: (string)time(), 0, 6);
            }
            $sortOrderPost = $request->post('sort_order', null);
            if ($sortOrderPost === null || $sortOrderPost === '') {
                $sortOrder = $existingRecipe !== null
                    ? (int)$existingRecipe['sort_order']
                    : ((int)Yii::$app->db->createCommand('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM marmitas_recipes')->queryScalar());
            } else {
                $sortOrder = (int)$sortOrderPost;
            }
            $ratingScore = max(0, min(5, round((float)str_replace(',', '.', (string)$request->post('rating_score', $existingRecipe['rating_score'] ?? 4.8)), 1)));
            $ratingCount = max(0, (int)$request->post('rating_count', $existingRecipe['rating_count'] ?? 0));
            $isFavorite = (int)$request->post('is_favorite', 0) === 1 ? 1 : 0;

            $data = [
                'slug' => $slug,
                'name_pt' => (string)$request->post('name_pt', ''),
                'name_en' => (string)$request->post('name_en', ''),
                'tagline_pt' => (string)$request->post('tagline_pt', ''),
                'tagline_en' => (string)$request->post('tagline_en', ''),
                'allergens_pt' => (string)$request->post('allergens_pt', ''),
                'allergens_en' => (string)$request->post('allergens_en', ''),
                'ingredients_pt' => (string)$request->post('ingredients_pt', ''),
                'ingredients_en' => (string)$request->post('ingredients_en', ''),
                'preparation_pt' => (string)$request->post('preparation_pt', ''),
                'preparation_en' => (string)$request->post('preparation_en', ''),
                'storage_pt' => (string)$request->post('storage_pt', ''),
                'storage_en' => (string)$request->post('storage_en', ''),
                'meal_types' => implode(',', $this->marmitasNormalizeMealTypeTags((array)$request->post('meal_types', []))),
                'allergen_tags' => implode(',', array_values(array_intersect((array)$request->post('allergen_tags', []), ['fish', 'nuts', 'lactose', 'egg', 'gluten', 'shellfish']))),
                'nutrition_calories' => $nullableInt($request->post('nutrition_calories', '')),
                'nutrition_protein_g' => $nullableFloat($request->post('nutrition_protein_g', '')),
                'nutrition_carbs_g' => $nullableFloat($request->post('nutrition_carbs_g', '')),
                'nutrition_fat_g' => $nullableFloat($request->post('nutrition_fat_g', '')),
                'nutrition_fiber_g' => $nullableFloat($request->post('nutrition_fiber_g', '')),
                'rating_score' => $ratingScore,
                'rating_count' => $ratingCount,
                'is_favorite' => $isFavorite,
                'active' => (int)$request->post('active', 0),
                'week_group' => max(1, min(4, (int)$request->post('week_group', ($existingRecipe['week_group'] ?? 1)))),
                'sort_order' => $sortOrder,
                'updated_at' => date('Y-m-d H:i:s'),
            ];

            if ($request->post('nutrition_calories', null) === null) {
                $nutrition = $this->marmitasNutritionDataForRecipe($data);
                $data['nutrition_calories'] = $nutrition['calories'];
                $data['nutrition_protein_g'] = $nutrition['protein_g'];
                $data['nutrition_carbs_g'] = $nutrition['carbs_g'];
                $data['nutrition_fat_g'] = $nutrition['fat_g'];
                $data['nutrition_fiber_g'] = $nutrition['fiber_g'];
            }

            if ($recipeId > 0) {
                Yii::$app->db->createCommand()->update('marmitas_recipes', $data, ['id' => $recipeId])->execute();
            } else {
                $data['created_at'] = date('Y-m-d H:i:s');
                Yii::$app->db->createCommand()->insert('marmitas_recipes', $data)->execute();
            }

            Yii::$app->session->setFlash('success', Yii::t('app', 'Receita guardada.'));
            return $this->redirect(['/site/marmitas-admin', '#' => 'recipes']);
        }

        if ($request->isPost && $request->post('admin_action') === 'order_status') {
            Yii::$app->db->createCommand()->update('marmitas_orders', [
                'status' => (string)$request->post('status', 'pending'),
                'updated_at' => date('Y-m-d H:i:s'),
            ], ['id' => (int)$request->post('order_id')])->execute();

            Yii::$app->session->setFlash('success', Yii::t('app', 'Encomenda atualizada.'));
            return $this->redirect(['/site/marmitas-admin', 'tab' => 'orders']);
        }

        if ($request->isPost && $request->post('admin_action') === 'save_order') {
            $orderId = (int)$request->post('order_id', 0);
            $parseCents = static function ($value) {
                $normalized = str_replace(',', '.', trim((string)$value));
                return max(0, (int)round(((float)$normalized) * 100));
            };
            try {
                $paymentMethod = \common\helpers\MarmitasOrderHelper::validatePaymentMethod($request->post('payment_method', 'mbway'));
                $items = Json::decode((string)$request->post('items_json', '[]'));
                if (!is_array($items)) {
                    $items = [];
                }
            } catch (\Throwable $exception) {
                Yii::$app->session->setFlash('error', Yii::t('app', $exception->getMessage() === 'marmitas_invalid_payment_method' ? 'marmitas_invalid_payment_method' : 'Itens da encomenda inválidos.'));
                return $this->redirect(['/site/marmitas-admin', 'tab' => 'orders']);
            }

            if ($orderId > 0) {
                Yii::$app->db->createCommand()->update('marmitas_orders', [
                    'delivery_week' => (string)$request->post('delivery_week', ''),
                    'delivery_time_window' => (string)$request->post('delivery_time_window', ''),
                    'customer_name' => (string)$request->post('customer_name', ''),
                    'phone' => (string)$request->post('phone', ''),
                    'address' => (string)$request->post('address', ''),
                    'notes' => (string)$request->post('notes', ''),
                    'items_json' => Json::encode($items),
                    'meals_total_cents' => $parseCents($request->post('meals_total', '0')),
                    'delivery_fee_cents' => $parseCents($request->post('delivery_fee', '0')),
                    'packaging_fee_cents' => $parseCents($request->post('packaging_fee', '0')),
                    'payment_method' => $paymentMethod,
                    'total_cents' => $parseCents($request->post('total', '0')),
                    'status' => (string)$request->post('status', 'pending'),
                    'updated_at' => date('Y-m-d H:i:s'),
                ], ['id' => $orderId])->execute();

                Yii::$app->session->setFlash('success', Yii::t('app', 'Encomenda guardada.'));
            }

            return $this->redirect(['/site/marmitas-admin', 'tab' => 'orders']);
        }

        if ($request->isPost && $request->post('admin_action') === 'delete_order') {
            $orderId = (int)$request->post('order_id', 0);
            if ($orderId > 0) {
                Yii::$app->db->createCommand()->delete('marmitas_orders', ['id' => $orderId])->execute();
                Yii::$app->session->setFlash('success', Yii::t('app', 'Encomenda apagada.'));
            }

            return $this->redirect(['/site/marmitas-admin', 'tab' => 'orders']);
        }

        if ($request->isPost && $request->post('admin_action') === 'add_stock') {
            try {
                $items = Json::decode((string)$request->post('stock_items_json', '[]'));
                if (!is_array($items)) {
                    $items = [];
                }
            } catch (\Throwable $exception) {
                $items = [];
            }

            $added = 0;
            $now = date('Y-m-d H:i:s');
            foreach ($items as $item) {
                $name = trim((string)($item['name'] ?? ''));
                $grams = max(0, (int)round((float)($item['grams'] ?? 0)));
                if ($name === '' || $grams <= 0) {
                    continue;
                }
                $key = $this->marmitasStockKey($name);
                Yii::$app->db->createCommand("
                    INSERT INTO marmitas_stock (ingredient_key, ingredient_name, quantity_g, created_at, updated_at)
                    VALUES (:ingredient_key, :ingredient_name, :quantity_g, :created_at, :updated_at)
                    ON DUPLICATE KEY UPDATE
                        ingredient_name = VALUES(ingredient_name),
                        quantity_g = quantity_g + VALUES(quantity_g),
                        updated_at = VALUES(updated_at)
                ", [
                    ':ingredient_key' => $key,
                    ':ingredient_name' => $name,
                    ':quantity_g' => $grams,
                    ':created_at' => $now,
                    ':updated_at' => $now,
                ])->execute();
                $this->marmitasRecordStockHistory($name, $grams, 'shopping_list', Yii::t('app', 'Adicionado da lista de compras.'));
                $added++;
            }

            Yii::$app->session->setFlash($added > 0 ? 'success' : 'error', $added > 0
                ? Yii::t('app', '{count} ingredientes adicionados ao stock.', ['count' => $added])
                : Yii::t('app', 'Marca ingredientes na lista de compras antes de adicionar ao stock.'));
            return $this->redirect(['/site/marmitas-admin', 'tab' => 'stock', '#' => 'stock-control']);
        }

        if ($request->isPost && $request->post('admin_action') === 'bulk_save_stock') {
            $items = $request->post('stock_items', []);
            $saved = 0;
            if (is_array($items)) {
                foreach ($items as $stockId => $item) {
                    $stockId = (int)$stockId;
                    if ($stockId <= 0 || !is_array($item)) {
                        continue;
                    }
                    $name = trim((string)($item['ingredient_name'] ?? ''));
                    if ($name === '') {
                        continue;
                    }
                    $grams = max(0, (int)round((float)str_replace(',', '.', (string)($item['quantity_g'] ?? '0'))));
                    $previous = (new Query())->from('marmitas_stock')->where(['id' => $stockId])->one();
                    Yii::$app->db->createCommand()->update('marmitas_stock', [
                        'ingredient_key' => $this->marmitasStockKey($name),
                        'ingredient_name' => $name,
                        'quantity_g' => $grams,
                        'updated_at' => date('Y-m-d H:i:s'),
                    ], ['id' => $stockId])->execute();
                    $previousGrams = is_array($previous) ? (int)($previous['quantity_g'] ?? 0) : 0;
                    $previousName = is_array($previous) ? (string)($previous['ingredient_name'] ?? $name) : $name;
                    if ($this->marmitasStockKey($previousName) !== $this->marmitasStockKey($name)) {
                        $this->marmitasRecordStockHistory($previousName, -$previousGrams, 'bulk_update', Yii::t('app', 'Alteração de ingrediente no stock.'));
                        $this->marmitasRecordStockHistory($name, $grams, 'bulk_update', Yii::t('app', 'Alteração de ingrediente no stock.'));
                    } elseif ($grams !== $previousGrams) {
                        $this->marmitasRecordStockHistory($name, $grams - $previousGrams, 'bulk_update', Yii::t('app', 'Atualização em lote do stock.'));
                    }
                    $this->marmitasRecordStockHistory($name, $grams, 'stock_snapshot', Yii::t('app', 'Stock confirmado ao guardar em lote.'));
                    $saved++;
                }
            }

            Yii::$app->session->setFlash($saved > 0 ? 'success' : 'error', $saved > 0
                ? Yii::t('app', '{count} ingredientes de stock guardados.', ['count' => $saved])
                : Yii::t('app', 'Não existem ingredientes de stock para guardar.'));
            return $this->redirect(['/site/marmitas-admin', 'tab' => 'stock', '#' => 'stock-control']);
        }

        if ($request->isPost && $request->post('admin_action') === 'save_stock_item') {
            $stockId = (int)$request->post('stock_id', 0);
            $name = trim((string)$request->post('ingredient_name', ''));
            $grams = max(0, (int)round((float)str_replace(',', '.', (string)$request->post('quantity_g', '0'))));
            if ($name !== '') {
                $data = [
                    'ingredient_key' => $this->marmitasStockKey($name),
                    'ingredient_name' => $name,
                    'quantity_g' => $grams,
                    'updated_at' => date('Y-m-d H:i:s'),
                ];
                if ($stockId > 0) {
                    $previous = (new Query())->from('marmitas_stock')->where(['id' => $stockId])->one();
                    Yii::$app->db->createCommand()->update('marmitas_stock', $data, ['id' => $stockId])->execute();
                    $previousGrams = is_array($previous) ? (int)($previous['quantity_g'] ?? 0) : 0;
                    $previousName = is_array($previous) ? (string)($previous['ingredient_name'] ?? $name) : $name;
                    if ($this->marmitasStockKey($previousName) !== $this->marmitasStockKey($name)) {
                        $this->marmitasRecordStockHistory($previousName, -$previousGrams, 'manual_update', Yii::t('app', 'Ingrediente de stock atualizado.'));
                        $this->marmitasRecordStockHistory($name, $grams, 'manual_update', Yii::t('app', 'Ingrediente de stock atualizado.'));
                    } elseif ($grams !== $previousGrams) {
                        $this->marmitasRecordStockHistory($name, $grams - $previousGrams, 'manual_update', Yii::t('app', 'Ingrediente de stock atualizado.'));
                    }
                } else {
                    $data['created_at'] = date('Y-m-d H:i:s');
                    Yii::$app->db->createCommand()->insert('marmitas_stock', $data)->execute();
                    $this->marmitasRecordStockHistory($name, $grams, 'manual_add', Yii::t('app', 'Ingrediente adicionado manualmente.'));
                }
                Yii::$app->session->setFlash('success', Yii::t('app', 'Stock guardado.'));
            }
            return $this->redirect(['/site/marmitas-admin', 'tab' => 'stock']);
        }

        if ($request->isPost && $request->post('admin_action') === 'delete_stock_item') {
            $stockId = (int)$request->post('stock_id', 0);
            if ($stockId > 0) {
                $stockItem = (new Query())->from('marmitas_stock')->where(['id' => $stockId])->one();
                if (is_array($stockItem)) {
                    $this->marmitasRecordStockHistory((string)$stockItem['ingredient_name'], -(int)$stockItem['quantity_g'], 'delete_stock', Yii::t('app', 'Ingrediente removido do stock.'));
                }
                Yii::$app->db->createCommand()->delete('marmitas_stock', ['id' => $stockId])->execute();
                Yii::$app->session->setFlash('success', Yii::t('app', 'Ingrediente removido do stock.'));
            }
            return $this->redirect(['/site/marmitas-admin', 'tab' => 'stock']);
        }

        if ($request->isPost && $request->post('admin_action') === 'save_stock_history') {
            $historyId = (int)$request->post('history_id', 0);
            $name = trim((string)$request->post('ingredient_name', ''));
            $grams = (int)round((float)str_replace(',', '.', (string)$request->post('quantity_g', '0')));
            $actionType = (string)$request->post('action_type', 'adjustment');
            $note = trim((string)$request->post('note', ''));

            if ($name !== '' && $grams !== 0) {
                if ($historyId > 0) {
                    $previous = (new Query())->from('marmitas_stock_history')->where(['id' => $historyId])->one();
                    if (is_array($previous)) {
                        if ((string)($previous['action_type'] ?? '') !== 'stock_snapshot') {
                            $this->marmitasApplyStockDelta((string)$previous['ingredient_name'], -(int)$previous['quantity_g']);
                        }
                        if ($actionType !== 'stock_snapshot') {
                            $this->marmitasApplyStockDelta($name, $grams);
                        }
                        Yii::$app->db->createCommand()->update('marmitas_stock_history', [
                            'ingredient_key' => $this->marmitasStockKey($name),
                            'ingredient_name' => $name,
                            'quantity_g' => $grams,
                            'action_type' => $actionType,
                            'note' => $note,
                            'updated_at' => date('Y-m-d H:i:s'),
                        ], ['id' => $historyId])->execute();
                    }
                } else {
                    if ($actionType !== 'stock_snapshot') {
                        $this->marmitasApplyStockDelta($name, $grams);
                    }
                    $this->marmitasRecordStockHistory($name, $grams, $actionType, $note);
                }

                Yii::$app->session->setFlash('success', Yii::t('app', 'Histórico de stock guardado.'));
            }

            return $this->redirect(['/site/marmitas-admin', 'tab' => 'stock']);
        }

        if ($request->isPost && $request->post('admin_action') === 'delete_stock_history') {
            $historyId = (int)$request->post('history_id', 0);
            if ($historyId > 0) {
                $historyItem = (new Query())->from('marmitas_stock_history')->where(['id' => $historyId])->one();
                if (is_array($historyItem)) {
                    if ((string)($historyItem['action_type'] ?? '') !== 'stock_snapshot') {
                        $this->marmitasApplyStockDelta((string)$historyItem['ingredient_name'], -(int)$historyItem['quantity_g']);
                    }
                    Yii::$app->db->createCommand()->delete('marmitas_stock_history', ['id' => $historyId])->execute();
                    Yii::$app->session->setFlash('success', Yii::t('app', 'Linha de histórico removida.'));
                }
            }

            return $this->redirect(['/site/marmitas-admin', 'tab' => 'stock']);
        }

        if ($request->isPost && $request->post('admin_action') === 'save_whatsapp') {
            $whatsapp = preg_replace('/[^\d+]/', '', (string)$request->post('whatsapp_number', ''));
            if ($whatsapp !== '' && strpos($whatsapp, '+') !== 0) {
                $whatsapp = '+' . $whatsapp;
            }
            $this->marmitasSaveSetting('whatsapp_number', $whatsapp);

            Yii::$app->session->setFlash('success', Yii::t('app', 'WhatsApp guardado.'));
            return $this->redirect(['/site/marmitas-admin', 'tab' => 'orders']);
        }

        $orderQuery = (new Query())->from('marmitas_orders');
        $weekFilter = trim((string)$request->get('week', ''));
        $statusFilter = trim((string)$request->get('status', ''));

        if ($weekFilter !== '') {
            $orderQuery->andWhere(['delivery_week' => $weekFilter]);
        }
        if ($statusFilter !== '') {
            $orderQuery->andWhere(['status' => $statusFilter]);
        }

        $orders = $orderQuery
            ->orderBy(['created_at' => SORT_DESC, 'id' => SORT_DESC])
            ->limit(100)
            ->all();

        $deliveryWeeks = (new Query())
            ->select('delivery_week')
            ->distinct()
            ->from('marmitas_orders')
            ->orderBy(['delivery_week' => SORT_DESC])
            ->column();

        $recipes = (new Query())
            ->from('marmitas_recipes')
            ->orderBy(['sort_order' => SORT_DESC, 'id' => SORT_DESC])
            ->all();

        $stockItems = (new Query())
            ->from('marmitas_stock')
            ->orderBy(['ingredient_name' => SORT_ASC])
            ->all();

        $stockHistory = (new Query())
            ->from('marmitas_stock_history')
            ->orderBy(['created_at' => SORT_DESC, 'id' => SORT_DESC])
            ->limit(100)
            ->all();

        $requestedTab = (string)$request->get('tab', 'kitchen');
        $activeTab = in_array($requestedTab, ['kitchen', 'orders', 'stock'], true) ? $requestedTab : 'kitchen';

        return $this->render('home/marmitas-admin', [
            'authenticated' => true,
            'weeklyMenuPublished' => $this->marmitasSetting('weekly_menu', '[]') !== '[]',
            'orders' => $orders,
            'recipes' => $recipes,
            'stockItems' => $stockItems,
            'stockHistory' => $stockHistory,
            'deliveryWeeks' => $deliveryWeeks,
            'weekFilter' => $weekFilter,
            'statusFilter' => $statusFilter,
            'activeTab' => $activeTab,
            'whatsappNumber' => $this->marmitasSetting('whatsapp_number', Yii::$app->params['marmitas_whatsapp'] ?? '+351967235820'),
            'loginError' => null,
        ]);
    }

    public function actionIndex()
    {   

        /*
        if (!Yii::$app->user->isGuest){          
            Yii::$app->language = Yii::$app->user->identity->language_site;             
        }else{
            Yii::$app->language = Helpers::getDomainLanguage();
        }    
                PermissionsHelpers::adminLaguagesSet();  
            */
        PermissionsHelpers::adminLaguagesSet();  
    
    
        $base_url = Helpers::getApplicationDomain();  
        
        switch($base_url){
            case 'localhost:92':
            case 'marmitasdadonaofelia.com':
                $this->applyMarmitasLanguageFromQuery();
                $this->layout = 'marmitas';
                $template = 'index-marmitas';
                break;
            case 'localhost:86':    
            case 'teamtvde.pt':   
            case 'www.teamtvde.pt':  
                $this->layout = 'unit';       
                $template = 'index-tvde';     
                break;
            case 'localhost:96':  
            case 'coloringbooksbyclaudio.com':   


                /*
                    $query = new Query();
                        
                    $coloringBooksArr = $query->select('*')
                    ->from(['coloring_books'])        
                    ->orderBy([
                        'order'   => SORT_ASC, // TRUE first        
                    ])->all();  

                        foreach($coloringBooksArr as $book){

                            $original = Yii::getAlias('@frontend/web/coloringbooks/books/square/'.$book['image_url']);
                            $resized  = Yii::getAlias('@frontend/web/coloringbooks/books/thumbs/'.$book['image_url']);

                            SiteController::resizeSquare($original, $resized, 348);

                        }

                die();
                */


                $this->layout = 'colorbook';       
                $template = 'index-color-books';    

                return $this->render('home/index-color-books');
                break;
            case 'localhost:82':  
         
                $this->layout = 'tvde';       
                $template = 'index-tvde-test';     
                break;
        
            default:            
                $this->layout = 'specialcalendar'; 
                $template = 'index-specialcalendar';     
                break;
        }  

        
        if (!Yii::$app->user->isGuest){       
            if(isset(Yii::$app->user->identity->level)){
                if(Yii::$app->user->identity->level == 'client'){
                    //$page = Helpers::findCompanyPageByCompanyCode(Yii::$app->user->identity->company_code);      

                    //return $this->redirect(['/booking', 'pagecode' => $page]);    
                }   
            }        
        }

        


        $modelSubscriber = new Subscribers();  

        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {

            $modelSubscriber->created_date = date('Y-m-d H:i:s');

            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }

        $configurations = Helpers::checkSiteManteinance();

        if (Yii::$app->user->isGuest &&  $configurations == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }

        $arrCompanysFilter = HelpersCache::arrayCompanyLogosCache();    
        $marmitasRecipes = $template === 'index-marmitas'
            ? $this->marmitasRankRecipes(array_values($this->marmitasRecipes(strpos(strtolower((string) Yii::$app->language), 'en') === 0)))
            : [];
        $marmitasWeeklyMenu = $template === 'index-marmitas'
            ? \common\helpers\MarmitasWeeklyMenuHelper::resolve($this->marmitasSetting('weekly_menu', '[]'), $marmitasRecipes)
            : [];
        $marmitasWhatsapp = $template === 'index-marmitas'
            ? $this->marmitasSetting('whatsapp_number', Yii::$app->params['marmitas_whatsapp'] ?? '351967235820')
            : null;
        
            
        $model = new ContactForm();
        $model->prepareSecurityFields();
        $modelTickets = new Tickets;

        $request = Yii::$app->getRequest();

        if ($request->isPost && $model->load($request->post())) {

            $model->company_code = 'specialcalendar';
            $model->prepareSecurityFields('contact_security_token', false);

            if (!$model->validate()) {
                return $this->render('home/'.$template, 
                    [
                        'model' => $model,
                        'modelSubscriber' => $modelSubscriber,
                        'arrCompanysFilter' =>  $arrCompanysFilter,
                        'marmitasRecipes' => $marmitasRecipes,
                        'marmitasWhatsapp' => $marmitasWhatsapp,
                'marmitasWeeklyMenu' => $marmitasWeeklyMenu,
                    ]
                );
            }

            if ($model->isSpamContact()) {
                Yii::warning(
                    'Spam blocked: ' . $model->email,
                    'contact-form'
                );

                return $this->refresh();
            }

            $modelTickets->full_name = $model->name;        
            $modelTickets->email = $model->email;
            $modelTickets->contact_number = $model->contact_number;
            $modelTickets->company_code = $model->company_code;
            $modelTickets->subject = $model->subject;
            $modelTickets->text = $model->message;
            $modelTickets->created_date = date('Y-m-d H:i');

            $ticketsSchema = Yii::$app->db->schema->getTableSchema(Tickets::tableName(), true);

            if ($ticketsSchema !== null && $ticketsSchema->getColumn('ip_address') !== null) {
                $modelTickets->ip_address = Yii::$app->request->userIP;
            }

            if ($ticketsSchema !== null && $ticketsSchema->getColumn('user_agent') !== null) {
                $modelTickets->user_agent = Yii::$app->request->userAgent;
            }

        
            if($modelTickets->validate()){

                $modelSendingLog = new SendingLog();
                $modelSendingLog::saveSendingLog('email', $modelTickets, $modelSendingLog, 'contact_form', true, [], Yii::$app->language);         
                
                $modelTickets->save();

                //$model->saveTicket($model);      
                
                
                Yii::$app->session->setFlash('success', Yii::t('app', "success_contact_us_message"));            
                $model->rotateSecurityToken();

                  
            

                /*
                  SendingLog::saveSendingLogGeneric($model, $modelSendingLog, Yii::$app->language);
                if ($model->sendEmail(Yii::$app->params['adminEmail'])) {
                    Yii::$app->session->setFlash('success', 'Thank you for contacting us. We will respond to you as soon as possible.');
                } else {
                    Yii::$app->session->setFlash('error', 'There was an error sending your message.');
                }      
                */
        
                return $this->refresh();

            }
          
        }

        return $this->render('home/'.$template, 
            [
                'model' => $model,
                'modelSubscriber' => $modelSubscriber,
                'arrCompanysFilter' =>  $arrCompanysFilter,
                'marmitasRecipes' => $marmitasRecipes,
                'marmitasWhatsapp' => $marmitasWhatsapp,
                'marmitasWeeklyMenu' => $marmitasWeeklyMenu,
            ]
        );
        
    }



 /*

    public static function resizeSquare($sourcePath, $destinationPath, $size = 348)
    {
        if (!file_exists($sourcePath)) {
            return false;
        }

        $imageInfo = getimagesize($sourcePath);
        $mime = $imageInfo['mime'];

        switch ($mime) {
            case 'image/jpeg':
                $sourceImage = imagecreatefromjpeg($sourcePath);
                break;
            case 'image/png':
                $sourceImage = imagecreatefrompng($sourcePath);
                break;
            case 'image/webp':
                $sourceImage = imagecreatefromwebp($sourcePath);
                break;
            default:
                return false;
        }

        $newImage = imagecreatetruecolor($size, $size);

        // Preserve PNG transparency
        if ($mime === 'image/png') {
            imagealphablending($newImage, false);
            imagesavealpha($newImage, true);
        }

        imagecopyresampled(
            $newImage,
            $sourceImage,
            0, 0, 0, 0,
            $size, $size,
            imagesx($sourceImage),
            imagesy($sourceImage)
        );

        // Create folder if needed
        $folder = dirname($destinationPath);
        if (!file_exists($folder)) {
            mkdir($folder, 0777, true);
        }

        switch ($mime) {
            case 'image/jpeg':
                imagejpeg($newImage, $destinationPath, 90);
                break;
            case 'image/png':
                imagepng($newImage, $destinationPath);
                break;
            case 'image/webp':
                imagewebp($newImage, $destinationPath);
                break;
        }

        imagedestroy($sourceImage);
        imagedestroy($newImage);

        return true;
    }


   
    public function actionHome222()
    {

        $this->layout = 'public';      
      
        $modelGeneratorjson = new GeneratorJson(); 
        $configurations = $modelGeneratorjson->getLastFileUploaded('configurations');

        $maintenance = (isset($configurations['maintenance']) ? $configurations['maintenance'] : 0);

        if (Yii::$app->user->isGuest && $maintenance == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }

        

        return $this->render('home/index');
    }


    public function actionMobileApp()
    {
        $this->layout = 'public';

        return $this->render('mobile-app');
    }

    public function actionRecipes()
    {
        $this->layout = 'public';
     
        $modelGeneratorjson = new GeneratorJson(); 
        $configurations = $modelGeneratorjson->getLastFileUploaded('configurations');

        $maintenance = (isset($configurations['maintenance']) ? $configurations['maintenance'] : 0);

        if (Yii::$app->user->isGuest && $maintenance == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }


        $request = Yii::$app->request; 
        $pg = $request->get('pg');
        $tag = $request->get('tag');
        $username = $request->get('username');      

        $urlParams = [
            'pg' => '',
            'tag' => '',
            'username' => ''
        ];

        $numberPerPage = 7;

        $model = new GeneratorJson(); 
        $recipes = $model->getLastFileUploaded('recipes');   

        if(!empty($pg)){         
            $urlParams = array_merge($urlParams, array('pg' => $pg));
        } 

        if(!empty($tag)){
            $urlParams = array_merge($urlParams, ['tag' => $tag]);
        }

        if(!empty($username)){
            $urlParams = array_merge($urlParams, ['username' => $username]);
        }

        
        $recipesFilter = array();

        foreach($recipes as $recipe){

            if($tag != '#'){
                if(empty($tag)){
                    $recipesFilter[] = $recipe;			
                }else{

                    $explode = explode(',', $recipe['recipe_cat_code']);

                    $break = false;

                    foreach($explode as $tagValue){
                        if(trim($tagValue) == trim($tag)){   
                            $break = true;
                            break;
                        }	
                    }       
                    
                    if($break == true){
                        $recipesFilter[] = $recipe;
                    }
                }	
            }	
        }


        return $this->render('recipes/recipes',[   
            'numberPerPage' => $numberPerPage,
            'recipes' => $recipesFilter,       
            'urlParams' => $urlParams
        ]);
    }



    public function actionBlogSingle()
    {
        $this->layout = 'public';    
        $request = Yii::$app->request;
       
        $modelGeneratorjson = new GeneratorJson(); 
        $configurations = $modelGeneratorjson->getLastFileUploaded('configurations');

        $maintenance = (isset($configurations['maintenance']) ? $configurations['maintenance'] : 0);

        if (Yii::$app->user->isGuest && $maintenance == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }


        $modelComment = new Comments();
        $model = new GeneratorJson(); 
        $blogList = $model->getLastFileUploaded('blogs');  

        $blog = '';        

        foreach($blogList as $key => $values){
            if($values['url'] ==  $request->get('url') && $values['id'] ==  $request->get('id')){
                $blog = $values;
                break;
            }
        }

        if ($request->isPost && $modelComment->load($request->post())  &&  $modelComment->validate() &&  $modelComment->save()) {
            
            $columns = GeneratorJson::getTableColumns('comments');         
            GeneratorJson::updateComments('comments',  $columns);  

            $this->refresh();        
        }
       

        if(empty( $blog)){
            return Yii::$app->response->redirect(Url::to(['site/blog'], true));
        }     

        return $this->render('blogs/blog-single', [
            'blog' => $blog,
            'modelComment' => $modelComment,
            'blog_id' => $request->get('id')         
        ]);
    }

    public function actionRecipeSingle()
    {      
        $this->layout = 'public';    
        $request = Yii::$app->request; 

        $modelGeneratorjson = new GeneratorJson(); 
        $configurations = $modelGeneratorjson->getLastFileUploaded('configurations');

        $maintenance = (isset($configurations['maintenance']) ? $configurations['maintenance'] : 0);

        if (Yii::$app->user->isGuest && $maintenance == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }


        $request = Yii::$app->request; 
        $pg = $request->get('pg');
        $tag = $request->get('tag');
        $username = $request->get('username');      

        $urlParams = [
            'pg' => '',
            'tag' => '',
            'username' => ''
        ];

        if(!empty($pg)){         
            $urlParams = array_merge($urlParams, array('pg' => $pg));
        } 

        if(!empty($tag)){
            $urlParams = array_merge($urlParams, ['tag' => $tag]);
        }

        if(!empty($username)){
            $urlParams = array_merge($urlParams, ['username' => $username]);
        }

        $model = new GeneratorJson(); 
        $recipeArr = $model->getLastFileUploaded('recipes');  

        $recipe = '';       

        foreach($recipeArr as $key => $values){
            if($values['url'] ==  $request->get('url') && $values['id'] ==  $request->get('id')){
                $recipe = $values;
                break;
            }
        }

        if(empty($recipe)){
           return Yii::$app->response->redirect(Url::to(['site/blog'], true));
        }     

        return $this->render('recipes/recipe-single', [
            'recipe' => $recipe,
            'recipeArr' => $recipeArr,
            'urlParams' => $urlParams
         
        ]);
    }

    public function actionDownloadApp()
    {
        $this->layout = 'public';
        
        $modelGeneratorjson = new GeneratorJson(); 
        $configurations = $modelGeneratorjson->getLastFileUploaded('configurations');

        $maintenance = (isset($configurations['maintenance']) ? $configurations['maintenance'] : 0);

        if (Yii::$app->user->isGuest && $maintenance == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }


        return $this->render('download-app');
    }

    */


    /**
     * Logs out the current user.
     *
     * @return mixed
     */
    public function actionLogout()
    {
        $logoutRedirect = $this->postLogoutRoute();

        if (!Yii::$app->user->isGuest) {
            Logs::recordUserSessionEvent(Yii::$app->user->identity, 'cleaner_logout');
        }
        Yii::$app->user->logout();        
      
        $this->layout = 'public';

        $configurations = Helpers::checkSiteManteinance();

        if (Yii::$app->user->isGuest && $configurations == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }

        return $this->redirect($logoutRedirect);
    }

    public function actionLogoutMobile()
    {
        $logoutRedirect = $this->postLogoutRoute('/login-mobile');

        if (!Yii::$app->user->isGuest) {
            Logs::recordUserSessionEvent(Yii::$app->user->identity, 'cleaner_logout');
        }
        Yii::$app->user->logout();        
      
        $this->layout = 'public';

        $configurations = Helpers::checkSiteManteinance();

        if (Yii::$app->user->isGuest && $configurations == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }

        return $this->redirect($logoutRedirect);
    }

    private function postLogoutRoute($defaultRoute = '/login')
    {
        // The desktop website always returns to its general login. Company
        // subdomains retain their separate mobile/company authentication flow.
        if ($defaultRoute === '/login' && in_array(strtolower((string)Yii::$app->request->hostName), ['specialcalendar.com', 'www.specialcalendar.com'], true)) {
            return '/login';
        }
        // Public marketing pages return to the general login, even for gym members.
        if ($defaultRoute === '/login' && Yii::$app->request->post('logout_context') === 'public') {
            return '/login';
        }
        if (Yii::$app->user->isGuest) {
            return $defaultRoute;
        }

        $user = Yii::$app->user->identity;
        $companyCode = $user->company_code ?? '';

        if ($companyCode === '') {
            return $defaultRoute;
        }

        $companyPlan = Helpers::arrCompanyPlan(['company_code' => $companyCode]);
        $planName = strtolower((string)($companyPlan['plan_name'] ?? ''));

        if ($planName !== 'gym') {
            return $defaultRoute;
        }

        $pagecode = Helpers::findCompanyPageByCompanyCode($companyCode);
        if ($pagecode === '' && !empty($user->company_code_url)) {
            $pagecode = $user->company_code_url;
        }

        return $pagecode === ''
            ? $defaultRoute
            : ['/site/login', 'pagecode' => $pagecode];
    }


    
    /**
     * Displays about page.
     *
     * @return mixed
     */
    public function actionAbout()
    {

        if (!Yii::$app->user->isGuest){          
            Yii::$app->language = Yii::$app->user->identity->language_site;          
        }else{
            Yii::$app->language = Helpers::getDomainLanguage();
        }

        $modelSubscriber = new Subscribers();  

        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {
    
            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }

        $this->layout = 'public';      
     
        $configurations = Helpers::checkSiteManteinance();

        if (Yii::$app->user->isGuest && $configurations == true) {
            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }


        return $this->render('about/about',
            ['modelSubscriber' => $modelSubscriber]
        );
    } 
    
  /*
    public function actionCalculators()
    {


        $this->layout = 'public';
      
        $modelGeneratorjson = new GeneratorJson(); 
        $configurations = $modelGeneratorjson->getLastFileUploaded('configurations');

        $maintenance = (isset($configurations['maintenance']) ? $configurations['maintenance'] : 0);

        if (Yii::$app->user->isGuest && $maintenance == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }


        return $this->render('@frontend/views/site/calculator/index');
    }

  
    public function actionFaqs()
    {

        $modelSubscriber = new Subscribers();  

        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {
    
            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }

        $this->layout = 'public';
       
        $modelGeneratorjson = new GeneratorJson(); 
        $configurations = $modelGeneratorjson->getLastFileUploaded('configurations');

        $maintenance = (isset($configurations['maintenance']) ? $configurations['maintenance'] : 0);

        if (Yii::$app->user->isGuest && $maintenance == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance',
                ['modelSubscriber' => $modelSubscriber]
            );
        }

      
        $model = new GeneratorJson(); 
        $faqs = $model->getLastFileUploaded('faqs');

        return $this->render('texts/faqs', [
            'faqs' => $faqs
        ]);
    }
    */

    public function actionFeatures()
    {

        if (!Yii::$app->user->isGuest){          
            Yii::$app->language = Yii::$app->user->identity->language_site;          
        }else{
           Yii::$app->language = Helpers::getDomainLanguage();
        }


        $modelSubscriber = new Subscribers();  

        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {
    
            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }

        $this->layout = 'public';
       
        $configurations = Helpers::checkSiteManteinance();

        if (Yii::$app->user->isGuest && $configurations == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance',
                ['modelSubscriber' => $modelSubscriber]
            );
        }


        return $this->render('features/features');
    }
    public function actionBlog()
    {
        $this->layout = 'public';
       
        $configurations = Helpers::checkSiteManteinance();

        if (Yii::$app->user->isGuest && $configurations == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }

        $model = new GeneratorJson(); 
        $blogs = $model->getLastFileUploaded('blogs');   
         
        $request = Yii::$app->request; 
        $pg = $request->get('pg');
        $tag = $request->get('tag');
        $username = $request->get('username');      

        $urlParams = [
            'pg' => '',
            'tag' => '',
            'username' => ''
        ];

        if(!empty($pg)){         
            $urlParams = array_merge($urlParams, array('pg' => $pg));
        } 

        if(!empty($tag)){
            $urlParams = array_merge($urlParams, ['tag' => $tag]);
        }

        if(!empty($username)){
            $urlParams = array_merge($urlParams, ['username' => $username]);
        }
  

        foreach($blogs as  $blog){

            if($username != '#'){
                if(empty($username)){
                    //$blogFilter[$blog['id']] = $blog;			
                }else{                
                    if(trim($blog['username']) == trim($username)){
                        $blogFilter[$blog['id']] = $blog;
                        $blogs = $blogFilter;
                    }		
                }	
            }


      
            if($tag != '#'){       
                if(empty($tag)){
                    //$blogFilter[$blog['id']] = $blog;
                }else{

                    $explode = explode(',', $blog['tags']);                

                    foreach($explode as $tagValue){
                        if(trim($tagValue) == trim($tag)){   
                            $blogFilter[$blog['id']] = $blog;         
                            $blogs = $blogFilter;     
                            break;
                        }	
                    }       
                }	
            }	
        }


        return $this->render('blogs/blog',
        [            
            'blogs' => $blogs,
            'pg' => $pg,
            'urlParams' => $urlParams,
            'username' => $username
        ]);
    } 

    public function actionBlogCategory()
    {
        $this->layout = 'public';
        
        $configurations = Helpers::checkSiteManteinance();

        if (Yii::$app->user->isGuest && $configurations == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }


        $json = file_get_contents(Yii::$app->basePath.'\web\json\texts.json');
        $texts = Json::decode($json);
        
        $result = array(
            'code_page' => '',
            'title' => '',
            'text' => '',
            'created_date' => ''            
        );

        $code = 'privacy';

        foreach($texts as $text){
            if(isset($text['code_page'])){
                if($text['code_page'] == $code){
                    $result = $text;
                    break;
                }
            }         
        }


        return $this->render('blogs/blog-category',
        [         
            'text' => $result
        ]);
 
    }

    
  
    /**
     * Requests password reset.
     *
     * @return mixed
     */
    public function actionRequestPasswordReset()
    {             
        $pagecode = Yii::$app->request->get('pagecode');
        if (!empty($pagecode)) {
            return $this->companyPasswordReset($pagecode);
        }
        
        if (!Yii::$app->user->isGuest){          
            Yii::$app->language = Yii::$app->user->identity->language_site;          
        }else{
            Yii::$app->language = Helpers::getDomainLanguage();
        }

            Yii::$app->language = 'pt';
    

        $base_url = Helpers::getApplicationDomain();  
        
        switch($base_url){
            case 'localhost:86':    
            case 'teamtvde.pt':    
                $this->layout = 'unit-dark';       
                $template = 'requestPasswordResetTokenTvde';     
                break;

            case 'localhost':  
            case 'specialcalendar.com': 
            case 'specialcalendar.pt': 
         
                $this->layout = 'specialcalendarsimple';       
                 $template = 'requestPasswordResetToken';       
                break;
        
            default:            
                $this->layout = 'public'; 
                $template = 'requestPasswordResetToken';     
                break;
        }  

        $model = new PasswordResetRequestForm();

        if ($model->load(Yii::$app->request->post()) && $model->validate()) {

            if ($model->sendEmail()) {

                Yii::$app->session->setFlash('success', Yii::t('app','verify_email_message'));

                //return $this->goHome();
            }else{
                Yii::$app->session->setFlash('error',  Yii::t('app','verify_email_message_error'));
            }
        }

      
        return $this->render('login/'.$template, [
            'model' => $model            
        ]);
    }

    /**
     * Resets password.
     *
     * @param string $token
     * @return mixed
     * @throws BadRequestHttpException
     */
    public function actionResetPassword($token = null)
    {
        return \common\helpers\PasswordResetPage::run($this, $token, Yii::$app->request->get('pagecode'));
    }
    public function actionHowToStart()
    {  
        die('__');

    }

    public function actionError()
    {  

        $base_url = Helpers::getApplicationDomain();  
        
        switch($base_url){
            case 'localhost:86':  
            case 'teamtvde.pt':  
                $this->layout = 'unit-dark';       
                $template = 'index-tvde';     
                break;
        
            default:            
                $this->layout = 'specialcalendarsimple'; 
                $template = 'index';     
                break;
        }  

        if (!Yii::$app->user->isGuest){          
            Yii::$app->language = (empty(Yii::$app->language) ? 'pt' : strtolower(Yii::$app->user->identity->language_site));          
        }else{
            Yii::$app->language = Helpers::getDomainLanguage();
        }

        $modelSubscriber = new Subscribers();  

        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {
    
            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }

        if($template == 'index-tvde'){
            return $this->render('error-tvde', [         
                'modelSubscriber' => $modelSubscriber
            ]);
        }else{
            return $this->render('error', [         
                'modelSubscriber' => $modelSubscriber
            ]);
        }
    }

      

    /**
     * Logs in a user.
     *
     * @return mixed
     */
    public function actionClientLogin()
    {     
 
        /*
        if (!Yii::$app->user->isGuest){          
            Yii::$app->language = Yii::$app->user->identity->language_site;          
        }else{
            Yii::$app->language = Helpers::getDomainLanguage();
        }
            */

        PermissionsHelpers::adminLaguagesSet();  

        $modelSubscriber = new Subscribers();  

        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {
    
            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }


        if (!Yii::$app->user->isGuest) {
            return $this->render('home/index');
        }      

        $model = new LoginForm();
 
        $model->field = Helpers::encrypt('mainsite', '10');

        if ($model->load(Yii::$app->request->post()) && $model->login()) {

            return $this->render('home/index', [
                'modelSubscriber' => $modelSubscriber,
                'model' => $model,
            ]);
        }

      
        $model->password = '';
        $this->layout = 'public';
        
        $configurations = Helpers::checkSiteManteinance();

        $user = User::findOne(['username' => $model->username]);

        if (Yii::$app->user->isGuest && $configurations == true && $user->level !== 'admin') {

            $this->layout = 'maintenance';

            return $this->render('login/login_maintenance', [
                'model' => $model,
                'modelSubscriber' => $modelSubscriber,
            ]);
        }


     
        return $this->render('../site/login/login_client', [
            'model' => $model,
            'modelSubscriber' => $modelSubscriber,
        ]);
    }


    public function actionLogs()
    {

   
        $arr = [
            'type' => 'register-tvde'
        ];

        $arrResult = Helpers::arrLogs($arr);

        $arrValues = [];

        foreach($arrResult as $key => $values){
           $model = json_decode($values['log_response']);
            $arrValues[$key][]  = (isset($model->full_name) ? $model->full_name : '');
            $arrValues[$key][] = (isset($model->contact_number) ? $model->contact_number : '');
            $arrValues[$key][] = (isset($model->email) ? $model->email : '');

        }

        

        print"<pre>";
        print_r($arrValues);
        die();

    }
    public function actionWhyUs()
    {

        if (!Yii::$app->user->isGuest){          
            Yii::$app->language = Yii::$app->user->identity->language_site;             
        }else{
            Yii::$app->language = Helpers::getDomainLanguage();
        }
        

        $modelSubscriber = new Subscribers();  

        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {
    
            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }


        $this->layout = 'public';
       
        $modelGeneratorjson = new GeneratorJson(); 
        $configurations = $modelGeneratorjson->getLastFileUploaded('configurations');

        $maintenance = (isset($configurations['maintenance']) ? $configurations['maintenance'] : 0);

        if (Yii::$app->user->isGuest && $maintenance == true) {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }

        return $this->render('/site/texts/sitemap',
            ['modelSubscriber' => $modelSubscriber]
        );
    }

    public function actionLoginMobile()
    {    
        $this->prepareLoginPage();

         if (($loginRedirect = $this->redirectAuthenticatedLogin()) !== null) {
             return $loginRedirect;
        }

        PermissionsHelpers::adminLaguagesSet();  

        $this->layout = 'specialcalendarmobile'; 
        $template = 'login';    
      
        if($template == 'login'){
            $languagePayment = PermissionsHelpers::adminLaguagesSet();  
     
            if($languagePayment){
                return $this->redirect(['/my-plan/upgrade']); 
            }
        }
    

        $modelSubscriber = new Subscribers();     

        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {       
 
            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }
      
        if (!Yii::$app->user->isGuest && Yii::$app->user->identity->level == 'admin') {
            //return $this->render('home/index');
        }      

        $model = new LoginForm();
     
        $model->field = Helpers::encrypt('mainsite', '10');

        if ($this->request->isPost && $model->load(Yii::$app->request->post())) {       
       
            if ($model->login()) {


                // Set the user session timeout
                Yii::$app->session->set('userSessionTimeout', time() + Yii::$app->params['sessionTimeoutSeconds']);
                    
                return $this->redirect($this->postLoginRoute($template)); 

                if($template == 'login-tvde'){   
                     if (isset(Yii::$app->user->identity->level)) { 
                       if (!Yii::$app->user->isGuest) {    
                            switch (Yii::$app->user->identity->level) {
                                case 'reseller':
                                case 'schoolreseller':
                                case 'admin':
                                    return $this->redirect(['/dashboard-reseller-tvde']); 
                                    break;                          
                                default:
                                    return $this->redirect(['/dashboard-tvde']); 
                                break;
                            }                    
                        }
                     }
                
                }else{
                    switch (Yii::$app->user->identity->level) {
                        case 'reseller':
                        case 'schoolreseller':
                        //case 'admin':                                        
                            return $this->redirect(['/dashboard-reseller']);                    
                        break;                         
                        default:
                            return $this->redirect(['/dashboard']); 
                        break;
                    }    
                
                }
            }          
                
        }
        
        return $this->render('@app/views/site/login/login_mobile.php', [
            'model' => $model,
            'modelSubscriber' => $modelSubscriber,
        ]);
    }

    /**
     * Logs in a user.
     *
     * @return mixed
     */
    public function actionLogin()
    {          
        $this->prepareLoginPage();

        PermissionsHelpers::adminLaguagesSet();  

        $pagecode = Yii::$app->request->get('pagecode');
        if (!empty($pagecode)) {
            return $this->companyLogin($pagecode);
        }

        if (($loginRedirect = $this->redirectAuthenticatedLogin()) !== null) {
            return $loginRedirect;
        }

        
        $base_url = Helpers::getApplicationDomain();  
        
        switch($base_url){
            case 'localhost:86':  
            case 'teamtvde.pt':  
                $this->layout = 'unit-dark';       
                $template = 'login-tvde';     
                break;
        
            default:            
                $this->layout = 'specialcalendarsimple'; 
                $template = 'login';     
                break;
        }
                
        /*
        if($template == 'login'){
            $languagePayment = PermissionsHelpers::adminLaguagesSet();  

            print_r( $languagePayment);
            die();
     
     
            if($languagePayment){
                return $this->redirect(['/my-plan/upgrade']); 
            }
        }
        */
    

        $modelSubscriber = new Subscribers();     

        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {       
 
            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }
      
        $model = new LoginForm();
     
        $model->field = Helpers::encrypt('mainsite', '10');

        if ($this->request->isPost && $model->load(Yii::$app->request->post())) {       

            if ($model->login()) {

                // Set the user session timeout
                Yii::$app->session->set('userSessionTimeout', time() + Yii::$app->params['sessionTimeoutSeconds']);
                    
                return $this->redirect($this->postLoginRoute($template)); 
                /*

                if($template == 'login-tvde'){   
                     if (isset(Yii::$app->user->identity->level)) { 
                       if (!Yii::$app->user->isGuest) {    
                            switch (Yii::$app->user->identity->level) {
                                case 'reseller':
                                case 'schoolreseller':
                                case 'admin':
                                    return $this->redirect(['/dashboard-reseller-tvde']); 
                                    break;                          
                                default:
                                    return $this->redirect(['/dashboard-tvde']); 
                                break;
                            }                    
                        }
                     }
                
                }else{
                    switch (Yii::$app->user->identity->level) {
                        case 'reseller':
                        case 'schoolreseller':
                        case 'admin':                                        
                            return $this->redirect(['/dashboard-reseller']);                    
                        break;                         
                        default:
                                    return $this->redirect(['/dashboard']); 
                        break;
                    }    
                
                }
                */
            }          
                
        }
   
      
        $model->password = '';


        /*
        $configurations = Helpers::checkSiteManteinance();

        $user = User::findOne(['username' => $model->username]);

        if (Yii::$app->user->isGuest && $configurations == true && $user->level !== 'admin') {

            $this->layout = 'maintenance';

            return $this->render('login/login_maintenance', [
                'model' => $model,
            ]);
        }
        */
     
        return $this->render('@frontend/views/site/login/'.$template, [
            'model' => $model,
            'modelSubscriber' => $modelSubscriber,
        ]);
    }

    private function postLoginRoute($template = 'login', $dashboardOnly = false)
    {
        if (Yii::$app->user->isGuest) {
            return ['/site/login'];
        }

        $pushReturn = $dashboardOnly ? null : Yii::$app->session->remove('mobilePushReturn');
        if (is_string($pushReturn) && preg_match('/^[a-f0-9]{64}$/D', $pushReturn)) {
            return ['/mobile-notifications/open', 'code' => $pushReturn];
        }

        $user = Yii::$app->user->identity;
        $level = $user->level ?? null;

        $sharedClassRoute = $dashboardOnly ? null : Yii::$app->session->remove('gymSharedClassRoute');
        if ($level === 'client' && is_array($sharedClassRoute)) {
            return $sharedClassRoute;
        }

        if ($template === 'login-tvde') {
            return in_array($level, ['reseller', 'schoolreseller', 'admin'], true)
                ? ['/dashboard-reseller-tvde/index']
                : ['/dashboard-tvde/index'];
        }

        $companyPlan = Helpers::arrCompanyPlan(['company_code' => $user->company_code]);
        $planName = $companyPlan['plan_name'] ?? '';

        if ($planName === 'gym') {
            return $level === 'client' ? ['/dashboard-gym-client/index'] : ['/dashboard-gym/index'];
        }

        if ($planName === 'hotel') {
            return ['/dashboard-hotel/index'];
        }

        return ['/dashboard/index'];
    }

    private function companyLogin($pagecode)
    {
        // Opening a company login with an existing session goes straight to
        // that user's dashboard, including repeated visits within 15 seconds.
        if (!Yii::$app->user->isGuest) {
            return $this->redirect($this->postLoginRoute('login', true));
        }

        $company = Helpers::findCompanyCodePage($pagecode);
        if (empty($company)) {
            return $this->goHome();
        }

        $companyArr = $this->freshCompanyPageArr($company, HelpersCache::myCompanyArrCache($company));
        if (empty($companyArr)) {
            return $this->goHome();
        }

        $selectedLanguage = strtolower((string)Yii::$app->request->cookies->getValue('lang', ''));
        if (in_array($selectedLanguage, ['pt', 'en'], true)) {
            Yii::$app->language = $selectedLanguage;
        } elseif (isset($companyArr['language'])) {
            Yii::$app->language = $companyArr['language'];
        }

        $this->layout = 'specialcalendarpage';

        $model = new LoginForm();
        $model->field = Helpers::encrypt('company', '10');
        $model->companyCode = $company;

        if ($this->request->isPost && $model->load(Yii::$app->request->post())) {
            if ($model->login()) {
                $userResult = Yii::$app->user->identity;
                Yii::$app->session->set('userSessionTimeout', time() + Yii::$app->params['sessionTimeoutSeconds']);

                $companyPlan = Helpers::arrCompanyPlan(['company_code' => $company]);
                if (($companyPlan['plan_name'] ?? '') === 'gym') {
                    return $this->redirect($this->postLoginRoute('login'));
                }

                if ($userResult->level === 'team') {
                    return $this->redirect(['/' . $pagecode . '/team-booking']);
                }

                if ($userResult->level === 'client') {
                    return $this->redirect(['/' . $pagecode . '/booking']);
                }

                return $this->redirect($this->postLoginRoute('login'));
            }
        }

        return $this->render('/client/login/login_client', [
            'model' => $model,
            'company' => $pagecode,
            'pagecode' => $pagecode,
            'companyArr' => $companyArr,
            'myData' => [],
        ]);
    }

    private function companyPasswordReset($pagecode)
    {
        $company = Helpers::findCompanyCodePage($pagecode);
        if (empty($company)) {
            return $this->goHome();
        }

        $companyArr = $this->freshCompanyPageArr($company, HelpersCache::myCompanyArrCache($company));
        if (empty($companyArr)) {
            return $this->goHome();
        }

        $selectedLanguage = strtolower((string)Yii::$app->request->cookies->getValue('lang', ''));
        if (in_array($selectedLanguage, ['pt', 'en'], true)) {
            Yii::$app->language = $selectedLanguage;
        } elseif (isset($companyArr['language'])) {
            Yii::$app->language = $companyArr['language'];
        }

        $this->layout = 'specialcalendarpage';

        $model = new PasswordResetRequestForm();
        if ($model->load(Yii::$app->request->post()) && $model->validate()) {
            if ($model->sendEmail($pagecode . '/reset-password')) {
                Yii::$app->session->setFlash('success', Yii::t('app', 'resend_request_password_reset_email_success_message'));
            } else {
                Yii::$app->session->setFlash('error', Yii::t('app', 'verify_email_message_error'));
            }
        }

        return $this->render('@frontend/views/client/login/requestPasswordResetToken', [
            'model' => $model,
            'pagecode' => $pagecode,
            'companyArr' => $companyArr,
        ]);
    }

    private function freshCompanyPageArr($companyCode, array $cachedCompanyArr = [])
    {
        $companyArr = Yii::$app->db->createCommand(
            'SELECT * FROM company WHERE company_code = :company_code',
            [':company_code' => $companyCode]
        )->queryOne();

        if (empty($companyArr)) {
            return $cachedCompanyArr;
        }

        $companyArr = array_merge($cachedCompanyArr, $companyArr);
        $companyArr['image_logo_url'] = $this->companyPageAssetUrl($companyArr, 'image_logo');
        $companyArr['image_banner_url'] = $this->companyPageAssetUrl($companyArr, 'image_banner');

        return $companyArr;
    }

    private function companyPageAssetUrl(array $companyArr, $field)
    {
        $image = trim((string)($companyArr[$field] ?? ''));
        if ($image === '') {
            return '';
        }

        $path = trim(str_replace('\\', '/', (string)($companyArr['path'] ?? '')), '/');
        $image = ltrim(str_replace('\\', '/', $image), '/');
        $url = strpos($image, 'images/') === 0 ? '/' . $image : '/' . trim($path . '/' . $image, '/');

        return file_exists(Yii::getAlias('@webroot') . $url) ? $url : '';
    }



    public function actionLoginReseller()
    {          
        $this->prepareLoginPage();

        $base_url = Helpers::getApplicationDomain();  
        
        switch($base_url){
            case 'localhost:86':  
            case 'teamtvde.pt':  
                $this->layout = 'unit-dark';       
                $template = 'login-reseller-tvde';     
                break;
        
            default:            
                $this->layout = 'public'; 
                $template = 'login-reseller';     
                break;
        }
      
        if($template == 'login'){
            $languagePayment = PermissionsHelpers::resselerPermissionsAccess();  
     
     
            if($languagePayment){
                return $this->redirect(['/my-plan/upgrade']); 
            }
        }
    

        $modelSubscriber = new Subscribers();     

        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {       
 
            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }
      
        if (!Yii::$app->user->isGuest && Yii::$app->user->identity->first_name == 'admin') {
            return $this->render('home/index');
        }      

        $model = new LoginForm();
     
        $model->field = Helpers::encrypt('mainsite', '10');

        if ($this->request->isPost && $model->load(Yii::$app->request->post())) {       
       
            if ($model->login()) {


                // Set the user session timeout
                Yii::$app->session->set('userSessionTimeout', time() + Yii::$app->params['sessionTimeoutSeconds']);
                    
                        
                if($template == 'login'){
                    $paymentCheck = PermissionsHelpers::adminPaymentCheck();

                    if($paymentCheck){                  
                        return $this->redirect(['/my-plan']);   
                    }     
                }

                if($template == 'login-reseller-tvde'){                   
                    return $this->redirect(['/dashboard-reseller-tvde']); 
                }else{
                    return $this->redirect(['/dashboard-reseller']); 
                }
            }          
                
        }
   
      
        $model->password = '';


        /*
        $configurations = Helpers::checkSiteManteinance();

        $user = User::findOne(['username' => $model->username]);

        if (Yii::$app->user->isGuest && $configurations == true && $user->level !== 'admin') {

            $this->layout = 'maintenance';

            return $this->render('login/login_maintenance', [
                'model' => $model,
            ]);
        }
        */
     
        return $this->render('@frontend/views/site/login/'.$template, [
            'model' => $model,
            'modelSubscriber' => $modelSubscriber,
        ]);
    }


    /**
     * Signs user up.
     *
     * @return mixed
     */

     public function actionSignupReseller($voucher = '')
     {        


        $base_url = Helpers::getApplicationDomain();  
        
        switch($base_url){
            case 'localhost:86':  
            case 'teamtvde.pt':  
                $this->layout = 'unit-dark';       
                $template = 'signup-resseller-tvde';     
                break;
        
            default:            
                $this->layout = 'public'; 
                $template = 'signup-resseller';     
                break;
        }

            
        PermissionsHelpers::adminLaguagesSet();  

        $modelSubscriber = new Subscribers();
        $modelSendingLog = new SendingLog();  

        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {
    
            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }
    
        
       
         $model = new User(); 
         
         $maintenance = Helpers::checkSiteManteinance();
 
         $connection = new Query;
 
         $request = Yii::$app->request;
 
         $level = $connection->select([
             'level' 
             ])
         ->from('user')   
         ->where(['username' => $request->post('username')]) 
         ->one();
    
 
         if (Yii::$app->user->isGuest && $maintenance == true && $level !== 'admin') {
 
             $this->layout = 'maintenance';
 
             return $this->render('home/maintenance');
         }
 
         $submitEmail = '';
 
         $model->guid = Helpers::GUID();
       
         if ($model->load(Yii::$app->request->post())) {    
            
            $generatedCode = Helpers::generateRandowHumber(20);  
        
            $code = 'c'.Helpers::generateRandowHumber(20);        
            $model->level = 'reseller';
            $model->job_title = 'reseller';
            $model->page_code_title = 'user_title_'. $generatedCode;  
            $model->page_code_text = 'user_text_'. $generatedCode;  
            $model->guid = Helpers::GUID();
            $model->company_code = $code;
            $model->company_code_url = $code;        
            $model->contact_country_code = '00351';        
            $model->voucher_parent = Helpers::generateVoucher($model->full_name, $voucher);               
            $model->terms_and_conditions = 1;
            $model->newsletter = 1;
            $model->privacy = 1;      
            $model->status = 10;   
            $model->active = 1; 
            $model->created_date = date('Y-m-d H:i:s');      

            
            $model->setPassword($model->password);
            $model->generateAuthKey();
            $model->generateEmailVerificationToken(); 
            

            if($model->validate()){

                $model->save();
                SendingLog::saveSendingLogGeneric($model, $modelSendingLog, Yii::$app->language, 'register-tvde');   
                return $this->redirect( [
                    'site/login'
                ]);
 
           }         
         }
 
         //$this->layout = 'publicDark';
 
         return $this->render('login/'. $template, [
             'modelSignupForm' => $model,
             'submitEmail' => $submitEmail,
             'modelSubscriber' => $modelSubscriber,
         ]);
     }

    /**
     * Signs user up.
     *
     * @return mixed
     */

    public function actionSignupClient()
    {      
        Yii::$app->response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        Yii::$app->response->headers->set('Pragma', 'no-cache');
        Yii::$app->response->headers->set('Expires', '0');
        if (!Yii::$app->request->isPost) Yii::$app->request->getCsrfToken();
         
        $this->layout = 'specialcalendarsimple';
           
        PermissionsHelpers::adminLaguagesSet();  

        $modelSubscriber = new Subscribers();  
        $model = new SignupForm();
        $model->scenario = 'signupClient';
        $model->applySignupClientDefaults();
        $submitEmail = '';
       
        if ($this->request->isPost && $model->load($this->request->post()) ) {

            $model->title = 'mr';
            $model->gender = 'men';
            $model->job_title = 'Admin';
            $model->coin = 'euro';
            $model->voucher_parent =  'v'.Helpers::generateRandowHumber();
            $model->created_date = date('Y-m-d');
            $model->level = 'admin';
            $model->applySignupClientDefaults();

            if (!$model->validate() || !array_key_exists($model->plan_name, Helpers::dropdownSignupClientPlan(true))) {
                if (!$model->hasErrors('plan_name') && !array_key_exists($model->plan_name, Helpers::dropdownSignupClientPlan(true))) {
                    $model->addError('plan_name', Yii::t('app', 'signup_block_plan_required'));
                }
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            } else {

                $modelUser = $model->defaultSignup();

                if ($modelUser) {

                    //HelpersCache::deleteOldKey($model->company_code, 'team');
                    LogsController::saveLog($model,'create_user');    

                    // A previously signed-in account must not intercept the new owner's login.
                    if (!Yii::$app->user->isGuest) Yii::$app->user->logout();
                    Yii::$app->session->setFlash('signup_success', true);

                    return $this->redirect(['site/login'], 303);
                    
                }else{         
                    Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                    Yii::$app->getSession()->setFlash('show', 'show');
                } 

            }

            /*

            if ($model->defaultSignup()){    

                return $this->redirect( [
                    'site/login'
                ]);
                
                $submitEmail = 'success';
                //$this->refresh();
            } 
            
          
            else{         
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }     
            */   
        }
 

        $connection = new Query;

        $level = $connection->select(['level'])
        ->from('user')   
        ->where(['username' => Yii::$app->request->post('username')]) 
        ->one();
   
   
        if (Yii::$app->user->isGuest && Helpers::checkSiteManteinance() == true && $level !== 'admin') {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }

        /*
        $submitEmail = '';

        $model->guid = Helpers::GUID();
      
      
        if ($model->load(Yii::$app->request->post())) {     
        
            $model->voucher = 'null';

            if($model->validate()){
            
                    $model->signup();         
                
                    $submitEmail = 'success';

                    return $this->redirect( [
                        'site/login'
                    ]);

            }         
        }

        */
     
        //$this->layout = 'publicDark';

        return $this->render('login/signup', [
            'modelSignupForm' => $model,
            'submitEmail' => $submitEmail,
            'modelSubscriber' => $modelSubscriber,
        ]);
    }


    public function actionSignupClientTvde()
    {      
         
        $this->layout = 'unit-dark';
     
        PermissionsHelpers::adminLaguagesSet();  

        $modelSubscriber = new Subscribers();  
        $model = new SignupForm();
        $submitEmail = '';
        
        if ($this->request->isPost && $model->load($this->request->post()) ) {
      
            if ($model->defaultSignup()){    
           
                return $this->redirect( [
                    'site/login'
                ]);
                
                $submitEmail = 'success';
                //$this->refresh();
            } 
            
            /*
            else{         
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }     
            */   
        }
 

        $connection = new Query;

        $level = $connection->select(['level'])
        ->from('user')   
        ->where(['username' => Yii::$app->request->post('username')]) 
        ->one();
   
   
        if (Yii::$app->user->isGuest && Helpers::checkSiteManteinance() == true && $level !== 'admin') {

            $this->layout = 'maintenance';

            return $this->render('home/maintenance');
        }

        /*
        $submitEmail = '';

        $model->guid = Helpers::GUID();
      
      
        if ($model->load(Yii::$app->request->post())) {     
        
            $model->voucher = 'null';

            if($model->validate()){
            
                    $model->signup();         
                
                    $submitEmail = 'success';

                    return $this->redirect( [
                        'site/login'
                    ]);

            }         
        }

        */
     
        //$this->layout = 'publicDark';

        return $this->render('login/signup-tvde', [
            'modelSignupForm' => $model,
            'submitEmail' => $submitEmail,
            'modelSubscriber' => $modelSubscriber,
        ]);
    }

    /**
     * Verify email address
     *
     * @param string $token
     * @throws BadRequestHttpException
     * @return yii\web\Response
     */

   
    public function actionVerifyEmail($token)
    {      
     
        Yii::$app->db->createCommand("UPDATE user SET status=:status WHERE verification_token=:token")
        ->bindValue(':status', User::STATUS_ACTIVE)
        //->bindValue(':username', $user->username)
        ->bindValue(':token', $token)
        ->execute();   
        
        Yii::$app->db->createCommand("UPDATE sending_log 
        SET 
        result_message=:result_message,
        error_message=:error_message 
        WHERE client_username=(SELECT guid from user WHERE verification_token=:verification_token)")
        ->bindValue(':result_message', '0')  
        ->bindValue(':error_message', '')          
        ->bindValue(':verification_token', $token)
        ->execute();

        Yii::$app->db->createCommand("UPDATE sending_log 
        SET 
        result_message=:result_message,
        error_message=:error_message 
        WHERE layout_view=:layout_view  AND client_username=(SELECT guid from user WHERE verification_token=:verification_token)")
        ->bindValue(':result_message', '1')  
        ->bindValue(':layout_view', 'email-verify')  
        ->bindValue(':error_message', '')          
        ->bindValue(':verification_token', $token)
        ->execute();
        
   
        return $this->redirect(['site/login']);

  
        try {                
            $model = new VerifyEmailForm($token);             
        } catch (InvalidArgumentException $e) {            
            throw new BadRequestHttpException($e->getMessage());
        }
        
        if (($user = $model->verifyEmail()) ) {    
            
                //Yii::$app->session->setFlash('success', 'Your email has been confirmed!');
                return $this->render('login');
           
            /*
            if(Yii::$app->user->login($user)){
                die('__1');
                //Yii::$app->session->setFlash('success', 'Your email has been confirmed!');
                return $this->goHome();
            }    
                */
            
        }

        /*
        
        Yii::$app->session->setFlash('error', 'Sorry, we are unable to verify your account with provided token.');
        return $this->goHome();
        */

     
    }
 

    /**
     * Resend verification email
     *
     * @return mixed
     */
    public function actionResendVerificationEmail()
    {     
        PermissionsHelpers::adminLaguagesSet(); 
       
        $modelSubscriber = new Subscribers();  
        $model = new ResendVerificationEmailForm();
    
        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {    
         
            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }

        $this->layout = 'public';

      
        if ($model->load(Yii::$app->request->post()) && $model->validate()) {

          
            if ($model->sendEmail()) {
                Yii::$app->session->setFlash('success', 'Check your email for further instructions.');
                //return $this->goHome();
            }else{
                Yii::$app->session->setFlash('error', 'Sorry, we are unable to resend verification email for the provided email address.');
            }
         
        }

        return $this->render('login/resendVerificationEmail', [
            'model' => $model,
            'modelSubscriber' => $modelSubscriber,
        ]);
    }


    public function actionOrderComplete()
    {
        $this->layout = 'public';

        return $this->render('payment/order-complete');
    }


    public function actionServices()
    {

        $base_url = Helpers::getApplicationDomain();  
        
        switch($base_url){
            case 'localhost:82':  
            case 'teamtvde.pt':  
                $this->layout = 'tvde';       
                $template = 'index-tvde';     
                break;
        
            default:            
                $this->layout = 'specialcalendarservices'; 
                $template = 'index';     
                break;
        }  
                
        
        PermissionsHelpers::adminLaguagesSet();  

        //$this->layout = 'public';

        $modelSubscriber = new Subscribers();  

        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {
    
            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }


        return $this->render('@frontend/views/site/services/'.$template, [   
            'modelSubscriber' => $modelSubscriber,
        ]);

    }
    

    public function actionTaxReturn()
    {  
        $this->layout = 'bank';

         return $this->render('@frontend/views/site/taxreturn');


    }


    public function actionBankstatment($id)
    {  
        $this->layout = 'bank';

         return $this->render('@frontend/views/site/bankstatment', ['id' => $id]);


    }

    public function actionCheckout()
    {        

        PermissionsHelpers::adminLaguagesSet(); 

        $modelSubscriber = new Subscribers();  

        if ($this->request->isPost && $modelSubscriber->load($this->request->post()) ) {
    
            if($modelSubscriber->validate() && $modelSubscriber->save()){             
                $this->refresh();
            } else{             
                Yii::$app->getSession()->setFlash('display', 'display: block; padding-right: 17px;');
                Yii::$app->getSession()->setFlash('show', 'show');
            }        
        }


        $this->layout = 'checkout';

        $request = Yii::$app->request;

        $plan = $request->get('plan');
                
        $model = new GeneratorJson(); 
        $pricing = $model->getLastFileUploaded('pricing');    

        $pricingSpecs = $model->getLastFileUploaded('pricing_specs');

        $arrPriceSpecs = [];
        $price = 0;

        foreach ($pricing as $key => $value){
            if($value['key'] == 'euro'){
                $price = (isset($value[$plan]) ? $value[$plan] : 0);
            }         
        }

        foreach ($pricingSpecs as $key => $categories){
            if($categories['type'] == $plan){
                $arrPriceSpecs[] = $categories['page_code'];
            }         
        }

        switch ($plan) {
            case "basic":
                $plan = 'Basic';
            break;
            case "standard":
                $plan = 'Standard';
            break;
            case "professional":
                $plan = 'Professional';
            break;
            case "enterprise":
                $plan = 'Enterprise';
            break;
        
        }

        if (Yii::$app->user->isGuest){             

            return $this->redirect(['/login']);  
        }

        return $this->render('payment/checkout',
            [
                'plan' => $plan,    
                'price' => $price,     
                'modelSubscriber'  => $modelSubscriber,
                'arrPriceSpecs' => $arrPriceSpecs
            ]
        );
    }

    public function actionLanguage()
    {
        return \common\components\LanguagePreference::change();
    }

    public function actionLanguageClient()
    {
        return \common\components\LanguagePreference::change('language_page');
    }
    public function actionFacebook(){     
        return $this->redirect('/');
    }

    public function actionInstagram(){     
        return $this->redirect('/');
    }



         
}
