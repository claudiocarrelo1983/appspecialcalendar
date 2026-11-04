<?php

namespace frontend\components;

use Yii;

/** Keeps the legacy controller timeout compatible with Yii's persistent login. */
class WebUser extends \yii\web\User
{
    public $paymentAccessError;

    public function init()
    {
        parent::init();
        $this->on(self::EVENT_AFTER_LOGIN, function () {
            $this->clearLoginCsrfWarning();
        });
        $this->on(self::EVENT_BEFORE_LOGIN, function ($event) {
            $this->paymentAccessError = \common\helpers\CompanyPaymentAccess::errorFor($event->identity);
            if ($this->paymentAccessError !== null) {
                $event->isValid = false;
                Yii::$app->session->setFlash('warning', $this->paymentAccessError);
            }
        });
        $this->on(self::EVENT_BEFORE_LOGOUT, static function ($event) {
            \common\helpers\MobilePushRegistration::logoutSession($event->identity->getId());
        });
        \common\helpers\AccountLoginWarnings::attach($this);
    }

    protected function renewAuthStatus()
    {
        $preview = Yii::$app->session->get(\common\helpers\AdminViewAs::SESSION_KEY);
        if (is_array($preview)) {
            // Explicit admin previews may show inactive users without activating
            // their account or changing normal identity/password authentication.
            if (($preview['expires'] ?? 0) > time()
                && \common\helpers\AdminViewAs::validActors($preview)
                && (int)Yii::$app->session->get($this->idParam) === (int)$preview['target_id']) {
                $this->setIdentity(\common\models\User::findOne($preview['target_id']));
                Yii::$app->session->set('userSessionTimeout', (int)$preview['expires']);
            } else {
                \common\helpers\AdminViewAs::clearFrontend();
            }
            return;
        }
        parent::renewAuthStatus();

        $identity = $this->getIdentity(false);
        if ($identity === null || !$this->enableSession) {
            return;
        }

        $session = Yii::$app->session;
        $this->clearLoginCsrfWarning();
        if ((int)$session->get('userSessionTimeout', 0) < time()) {
            $remembered = $this->enableAutoLogin ? $this->getIdentityAndDurationFromCookie() : null;
            if ($remembered === null || (string)$remembered['identity']->getId() !== (string)$identity->getId()) {
                $this->logout();
                return;
            }
        }

        $session->set('userSessionTimeout', time() + (int)Yii::$app->params['sessionTimeoutSeconds']);
    }

    private function clearLoginCsrfWarning()
    {
        $session = Yii::$app->session;
        $session->removeFlash('login_csrf_warning');
        // Clear the old generic flash from sessions created before this fix.
        if (in_array($session->get('warning'), [
            'A sessão do formulário expirou. Tente iniciar sessão novamente.',
            'Your form session has expired. Please try signing in again.',
        ], true)) {
            $session->removeFlash('warning');
        }
    }
}
