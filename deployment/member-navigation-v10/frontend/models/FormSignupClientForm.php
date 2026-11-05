<?php

namespace frontend\models;

use common\helpers\ApiEgoiHelpers;
use common\helpers\Helpers;
use common\helpers\UploadSecurityHelper;
use common\models\User;
use Yii;
use yii\base\Model;
use yii\helpers\FileHelper;
use yii\web\UploadedFile;

class FormSignupClientForm extends Model
{
    public $title;
    public $first_name;
    public $last_name;
    public $gender;
    public $dob;
    public $contact_country_code;
    public $contact_number;
    public $email;
    public $nif;
    public $username;
    public $password;
    public $terms_and_conditions;
    public $newsletter;
    public $location_code;
    public $bank_country;
    public $bank_method;
    public $iban;
    public $sort_code;
    public $account_number;
    public $bank_proof_file;
    public $bank_proof_data;
    public $bank_proof_name;
    public $proof_id_type;
    public $proof_id_file;
    public $proof_id_data;
    public $proof_id_name;
    public $proof_id_back_file;
    public $proof_id_back_data;
    public $proof_id_back_name;

    public $company_code;
    public $company_code_url;
    public $company;
    public $signup_level = 'client';
    public $client_category;

    public function beforeValidate()
    {
        if ($this->bank_proof_file === null) {
            $this->bank_proof_file = UploadedFile::getInstance($this, 'bank_proof_file');
            if ($this->bank_proof_file === null) {
                $this->bank_proof_file = UploadedFile::getInstanceByName($this->formName() . '[bank_proof_file]');
            }
        }
        if ($this->proof_id_file === null) {
            $this->proof_id_file = UploadedFile::getInstance($this, 'proof_id_file');
            if ($this->proof_id_file === null) {
                $this->proof_id_file = UploadedFile::getInstanceByName($this->formName() . '[proof_id_file]');
            }
        }
        if ($this->proof_id_back_file === null) {
            $this->proof_id_back_file = UploadedFile::getInstance($this, 'proof_id_back_file');
            if ($this->proof_id_back_file === null) {
                $this->proof_id_back_file = UploadedFile::getInstanceByName($this->formName() . '[proof_id_back_file]');
            }
        }

        $this->bank_country = strtoupper((string)$this->bank_country);
        $this->bank_method = $this->bank_method ?: $this->defaultBankMethod();
        $this->proof_id_type = $this->proof_id_type ?: 'id_card';
        $this->sort_code = $this->formatSortCode($this->sort_code);

        if ($this->signup_level === 'cleaner') {
            $this->gender = $this->gender ?: 'men';
            $this->dob = $this->dob ?: '1970-01-01';
            $this->nif = $this->nif ?: '000000000';
        }

        return parent::beforeValidate();
    }

    public function rules()
    {
        return [
            [['first_name', 'last_name', 'gender', 'email', 'username', 'password', 'terms_and_conditions', 'location_code'], 'required'],
            [['bank_method', 'proof_id_type'], 'required', 'when' => function ($model) {
                return !$model->isGymSignup();
            }],
            [['terms_and_conditions', 'newsletter'], 'boolean'],
            [['dob'], 'safe'],
            [['bank_proof_data', 'bank_proof_name', 'proof_id_data', 'proof_id_name', 'proof_id_back_data', 'proof_id_back_name'], 'string'],
            [['title', 'first_name', 'last_name', 'gender', 'contact_country_code', 'contact_number', 'email', 'nif', 'username', 'company_code', 'company_code_url', 'company', 'signup_level', 'client_category', 'location_code', 'bank_country', 'bank_method', 'iban', 'sort_code', 'account_number', 'proof_id_type'], 'string', 'max' => 255],
            ['signup_level', 'in', 'range' => ['client', 'cleaner']],
            ['bank_method', 'in', 'range' => ['iban', 'uk_bank']],
            ['proof_id_type', 'in', 'range' => ['id_card', 'passport']],
            [['first_name', 'last_name', 'username', 'email', 'iban', 'sort_code', 'account_number'], 'trim'],
            ['email', 'email'],
            ['password', 'string', 'min' => Yii::$app->params['user.passwordMinLength'] ?? 6],
            ['location_code', 'validateCompanyLocation'],
            ['bank_proof_file', 'validateBankProofFile'],
            ['proof_id_file', 'validateProofIdFile'],
            ['proof_id_back_file', 'validateProofIdBackFile'],
            [
                'bank_proof_file',
                'file',
                'skipOnEmpty' => true,
                'extensions' => ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
                'maxSize' => 1024 * 1024 * 10,
                'tooBig' => Yii::$app->language === 'pt' ? 'O ficheiro deve ter no máximo 10MB.' : 'The file must be no larger than 10MB.',
                'wrongExtension' => Yii::$app->language === 'pt' ? 'O ficheiro deve ser PDF ou imagem.' : 'The file must be a PDF or image.',
            ],
            [
                'proof_id_back_file',
                'file',
                'skipOnEmpty' => true,
                'extensions' => ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
                'maxSize' => 1024 * 1024 * 10,
                'tooBig' => Yii::$app->language === 'pt' ? 'O ficheiro deve ter no máximo 10MB.' : 'The file must be no larger than 10MB.',
                'wrongExtension' => Yii::$app->language === 'pt' ? 'O ficheiro deve ser PDF ou imagem.' : 'The file must be a PDF or image.',
            ],
            [
                'proof_id_file',
                'file',
                'skipOnEmpty' => true,
                'extensions' => ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
                'maxSize' => 1024 * 1024 * 10,
                'tooBig' => Yii::$app->language === 'pt' ? 'O ficheiro deve ter no máximo 10MB.' : 'The file must be no larger than 10MB.',
                'wrongExtension' => Yii::$app->language === 'pt' ? 'O ficheiro deve ser PDF ou imagem.' : 'The file must be a PDF or image.',
            ],
            ['iban', 'required', 'when' => function ($model) {
                return !$model->isGymSignup() && $model->bank_method === 'iban';
            }, 'whenClient' => "function () { return $('input[name=\"FormSignupClientForm[bank_method]\"]:checked').val() === 'iban'; }"],
            [['sort_code', 'account_number'], 'required', 'when' => function ($model) {
                return !$model->isGymSignup() && $model->bank_method === 'uk_bank';
            }, 'whenClient' => "function () { return $('input[name=\"FormSignupClientForm[bank_method]\"]:checked').val() === 'uk_bank'; }"],
            ['iban', 'match', 'pattern' => '/^[A-Z]{2}[0-9A-Z ]{13,32}$/i', 'skipOnEmpty' => true, 'message' => Yii::$app->language === 'pt' ? 'IBAN inválido.' : 'Invalid IBAN.'],
            ['sort_code', 'match', 'pattern' => '/^\d{2}-?\d{2}-?\d{2}$/', 'skipOnEmpty' => true, 'message' => Yii::$app->language === 'pt' ? 'Sort code inválido.' : 'Invalid sort code.'],
            ['account_number', 'match', 'pattern' => '/^\d{8}$/', 'skipOnEmpty' => true, 'message' => Yii::$app->language === 'pt' ? 'Número de conta inválido.' : 'Invalid account number.'],
            [
                'terms_and_conditions',
                'compare',
                'compareValue' => 1,
                'message' => Yii::t('app', 'accept_terms_validation'),
            ],
            [
                'username',
                'unique',
                'targetClass' => User::class,
                'message' => Yii::t('app', 'username_already_exists'),
            ],
            [
                'email',
                'validateClientEmail',
            ],
        ];
    }

    public function defaultBankMethod()
    {
        $country = strtoupper((string)$this->bank_country);

        if (in_array($country, ['GB', 'UK'], true)) {
            return 'uk_bank';
        }

        return 'iban';
    }

    public function isGymSignup()
    {
        return strtolower((string)$this->client_category) === 'gym';
    }

    private function formatSortCode($sortCode)
    {
        $digits = preg_replace('/\D/', '', (string)$sortCode);

        if (strlen($digits) !== 6) {
            return trim((string)$sortCode);
        }

        return substr($digits, 0, 2) . '-' . substr($digits, 2, 2) . '-' . substr($digits, 4, 2);
    }

    public function validateCompanyLocation($attribute)
    {
        if (empty($this->$attribute) || empty($this->company_code)) {
            return;
        }

        $exists = \common\models\CompanyLocations::find()
            ->where([
                'company_code' => $this->company_code,
                'location_code' => $this->$attribute,
                'active' => 1,
            ])
            ->exists();

        if (!$exists) {
            $this->addError($attribute, Yii::t('app', 'select_location_code'));
        }
    }

    public function validateBankProofFile($attribute)
    {
        if ($this->isGymSignup()) {
            return;
        }

        $this->validateProofFile($attribute, 'bank_proof_data', 'bank_proof_name', Yii::$app->language === 'pt' ? 'Comprovativo bancário' : 'Bank proof');
    }

    public function validateProofIdFile($attribute)
    {
        if ($this->isGymSignup()) {
            return;
        }

        $label = $this->proof_id_type === 'passport'
            ? (Yii::$app->language === 'pt' ? 'Passaporte' : 'Passport')
            : (Yii::$app->language === 'pt' ? 'Frente do documento de identificação' : 'ID card front');
        $this->validateProofFile($attribute, 'proof_id_data', 'proof_id_name', $label);
    }

    public function validateProofIdBackFile($attribute)
    {
        if ($this->isGymSignup()) {
            return;
        }

        if ($this->proof_id_type === 'passport') {
            return;
        }

        $this->validateProofFile($attribute, 'proof_id_back_data', 'proof_id_back_name', Yii::$app->language === 'pt' ? 'Verso do documento de identificação' : 'ID card back');
    }

    private function bankProofMimeTypes()
    {
        return [
            'application/pdf',
            'application/x-pdf',
            'application/acrobat',
            'applications/vnd.pdf',
            'text/pdf',
            'text/x-pdf',
            'application/octet-stream',
            'image/jpeg',
            'image/pjpeg',
            'image/png',
            'image/webp',
        ];
    }

    private function hasBankProofData()
    {
        return $this->hasProofData('bank_proof_data', 'bank_proof_name');
    }

    private function hasProofIdData()
    {
        return $this->hasProofData('proof_id_data', 'proof_id_name');
    }

    private function hasProofData($dataAttribute, $nameAttribute)
    {
        return preg_match('/^data:[^;]+;base64,/', (string)$this->$dataAttribute) === 1
            && trim((string)$this->$nameAttribute) !== '';
    }

    private function validateProofFile($attribute, $dataAttribute, $nameAttribute, $label)
    {
        if ($this->$attribute instanceof UploadedFile || $this->hasProofData($dataAttribute, $nameAttribute)) {
            return;
        }

        $error = $_FILES[$this->formName()]['error'][$attribute] ?? UPLOAD_ERR_NO_FILE;

        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            $this->addError($attribute, Yii::$app->language === 'pt' ? 'O ficheiro deve ter no máximo 10MB.' : 'The file must be no larger than 10MB.');
            return;
        }

        if ($error !== UPLOAD_ERR_NO_FILE) {
            $this->addError($attribute, Yii::$app->language === 'pt' ? 'Não foi possível carregar o ficheiro. Tente novamente com PDF ou imagem.' : 'Could not upload the file. Please try again with a PDF or image.');
            return;
        }

        $this->addError($attribute, $label . (Yii::$app->language === 'pt' ? ' não pode ficar em branco.' : ' cannot be blank.'));
    }

    public function validateClientEmail($attribute)
    {
        if (empty($this->$attribute)) {
            return;
        }

        $exists = User::find()
            ->where(['email' => $this->$attribute, 'level' => 'client'])
            ->exists();

        if ($exists) {
            $this->addError($attribute, Yii::t('app', 'email_already_exists'));
        }
    }

    public function attributeLabels()
    {
        return array_merge(Helpers::attributeModelLabels(), [
            'location_code' => Yii::t('app', 'location_code'),
            'bank_method' => Yii::$app->language === 'pt' ? 'Tipo de conta' : 'Account type',
            'iban' => 'IBAN',
            'sort_code' => 'Sort code',
            'account_number' => Yii::$app->language === 'pt' ? 'Número de conta' : 'Account number',
            'bank_proof_file' => Yii::$app->language === 'pt' ? 'Comprovativo bancário' : 'Bank proof',
            'proof_id_file' => Yii::$app->language === 'pt' ? 'Comprovativo de identificação' : 'Proof of ID/passport',
            'proof_id_back_file' => Yii::$app->language === 'pt' ? 'Verso do documento de identificação' : 'ID card back',
            'proof_id_type' => Yii::$app->language === 'pt' ? 'Tipo de documento' : 'Document type',
        ]);
    }

    public function signup()
    {
        if (!$this->validate()) {
            return false;
        }

        $user = new User();
        $user->guid = Helpers::GUID();
        $user->username = $this->username;
        $user->title = $this->title ?: ($this->gender === 'female' ? 'mrs' : 'mr');
        $user->gender = $this->gender;
        $user->first_name = $this->first_name;
        $user->last_name = $this->last_name;
        $user->full_name = trim($this->first_name . ' ' . $this->last_name);
        $user->email = $this->email;
        $user->nif = $this->nif;
        $user->dob = empty($this->dob) ? null : date('Y-m-d', strtotime($this->dob));
        $user->contact_country_code = $this->contact_country_code;
        $user->contact_number = $this->contact_number;
        $user->company_code = $this->company_code;
        $user->company_code_parent = $this->company_code;
        $user->company_code_url = $this->company_code_url ?: Helpers::findCompanyPageByCompanyCode($this->company_code);
        $user->company = $this->company ?: Yii::t('app', 'client');
        $user->location_code = $this->location_code;
        $user->level = $this->signup_level === 'cleaner' ? 'cleaner' : 'client';
        $user->job_title = $this->signup_level === 'cleaner' ? 'Housekeeping' : 'Client';
        $user->language_site = Yii::$app->language;
        $user->language_page = Yii::$app->language;
        $user->terms_and_conditions = $this->terms_and_conditions;
        $user->privacy = $this->terms_and_conditions;
        $user->gdpr = $this->terms_and_conditions;
        $user->newsletter = $this->newsletter ? 1 : 0;
        $user->voucher = 'null';
        $user->voucher_parent = 'v' . Helpers::generateVoucher($user->full_name);
        $user->page_code_title = 'ut_' . Helpers::generateRandowHumber(5);
        $user->page_code_text = 'ud_' . Helpers::generateRandowHumber(5);
        $this->assignBankDetails($user);
        if (!$this->assignBankProof($user)) {
            return false;
        }
        if (!$this->assignProofId($user)) {
            return false;
        }
        $user->active = 1;
        $user->status = $this->isGymSignup() ? User::STATUS_WAITING_LIST : ($this->signup_level === 'cleaner' ? User::STATUS_INACTIVE : User::STATUS_ACTIVE);
        $user->password = $this->password;
        $user->setPassword($this->password);
        $user->generateAuthKey();
        $user->generateEmailVerificationToken();

        if ($user->save()) {
            return $user;
        }

        $this->addErrors($user->errors);
        return false;
    }

    private function assignBankDetails(User $user)
    {
        if ($this->isGymSignup()) {
            return;
        }

        foreach (['iban', 'sort_code', 'account_number'] as $attribute) {
            if ($user->hasAttribute($attribute)) {
                $user->$attribute = $this->$attribute;
            }
        }
    }

    private function assignBankProof(User $user)
    {
        if ($this->isGymSignup()) {
            return true;
        }

        if (!$this->bank_proof_file instanceof UploadedFile) {
            return $this->assignProofData($user, 'bank_proof_data', 'bank_proof_name', 'bank_proof_file', 'bank_proof_path', 'signup-bank-proof', 'bank-proof');
        }

        return $this->assignUploadedProof($user, $this->bank_proof_file, 'bank_proof_file', 'bank_proof_path', 'signup-bank-proof', 'bank-proof');
    }

    private function assignProofId(User $user)
    {
        if ($this->isGymSignup()) {
            return true;
        }

        $assignedFront = $this->proof_id_file instanceof UploadedFile
            ? $this->assignUploadedProof($user, $this->proof_id_file, 'proof_id_file', 'proof_id_path', 'signup-proof-id', 'proof-id-front')
            : $this->assignProofData($user, 'proof_id_data', 'proof_id_name', 'proof_id_file', 'proof_id_path', 'signup-proof-id', 'proof-id-front');

        if (!$assignedFront) {
            return false;
        }

        if ($this->proof_id_type === 'passport') {
            return true;
        }

        return $this->proof_id_back_file instanceof UploadedFile
            ? $this->assignUploadedProof($user, $this->proof_id_back_file, 'proof_id_back_file', 'proof_id_back_path', 'signup-proof-id', 'proof-id-back')
            : $this->assignProofData($user, 'proof_id_back_data', 'proof_id_back_name', 'proof_id_back_file', 'proof_id_back_path', 'signup-proof-id', 'proof-id-back');
    }

    private function assignUploadedProof(User $user, UploadedFile $file, $errorAttribute, $pathAttribute, $folder, $prefix)
    {
        $filename = UploadSecurityHelper::saveUploadedFile(
            $file,
            UploadSecurityHelper::companyViewDirectory($this->company_code, $folder),
            ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
            [],
            1024 * 1024 * 10,
            $prefix
        );

        if ($filename === false) {
            $this->addError($errorAttribute, Yii::$app->language === 'pt' ? 'Ficheiro inválido.' : 'Invalid file.');
            return false;
        }

        if ($user->hasAttribute($pathAttribute)) {
            $user->$pathAttribute = UploadSecurityHelper::companyViewPublicPath($this->company_code, $folder, $filename);
        }

        return true;
    }

    private function assignProofData(User $user, $dataAttribute, $nameAttribute, $errorAttribute, $pathAttribute, $folder, $prefix)
    {
        if (!$this->hasProofData($dataAttribute, $nameAttribute)) {
            $this->addError($errorAttribute, Yii::$app->language === 'pt' ? 'Ficheiro não pode ficar em branco.' : 'File cannot be blank.');
            return false;
        }

        $originalName = trim((string)$this->$nameAttribute);
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        if (!in_array($extension, ['pdf', 'jpg', 'jpeg', 'png', 'webp'], true)) {
            $this->addError($errorAttribute, Yii::$app->language === 'pt' ? 'O ficheiro deve ser PDF ou imagem.' : 'The file must be a PDF or image.');
            return false;
        }

        if (!preg_match('/^data:[^;]+;base64,(.*)$/', (string)$this->$dataAttribute, $matches)) {
            $this->addError($errorAttribute, Yii::$app->language === 'pt' ? 'Ficheiro inválido.' : 'Invalid file.');
            return false;
        }

        $binary = base64_decode($matches[1], true);
        if ($binary === false || strlen($binary) === 0) {
            $this->addError($errorAttribute, Yii::$app->language === 'pt' ? 'Ficheiro inválido.' : 'Invalid file.');
            return false;
        }

        if (strlen($binary) > 1024 * 1024 * 10) {
            $this->addError($errorAttribute, Yii::$app->language === 'pt' ? 'O ficheiro deve ter no máximo 10MB.' : 'The file must be no larger than 10MB.');
            return false;
        }

        $directory = Yii::getAlias(UploadSecurityHelper::companyViewDirectory($this->company_code, $folder));
        if (!is_dir($directory) && !FileHelper::createDirectory($directory, 0775, true)) {
            $this->addError($errorAttribute, Yii::$app->language === 'pt' ? 'Não foi possível guardar o ficheiro.' : 'Could not save the file.');
            return false;
        }

        $filename = $prefix . '-' . Yii::$app->security->generateRandomString(24) . '.' . $extension;
        $path = rtrim($directory, DIRECTORY_SEPARATOR . '/') . DIRECTORY_SEPARATOR . $filename;

        if (file_put_contents($path, $binary) === false) {
            $this->addError($errorAttribute, Yii::$app->language === 'pt' ? 'Não foi possível guardar o ficheiro.' : 'Could not save the file.');
            return false;
        }

        if ($user->hasAttribute($pathAttribute)) {
            $user->$pathAttribute = UploadSecurityHelper::companyViewPublicPath($this->company_code, $folder, $filename);
        }

        return true;
    }

    public function sendConfirmationEmail(User $user, $urlPath = 'site/verify-email')
    {
        $from = Yii::$app->params['supportEmail'];
        $subject = Yii::t('app', 'verify_subject') . ' - ' . Yii::$app->name;
        $message = Yii::$app->mailer->render(
            'email-verify',
            ['user' => $user, 'url' => $urlPath],
            'email-layout'
        );

        return ApiEgoiHelpers::sendSingleEmail($from, $this->email, $subject, $message);
    }
}
