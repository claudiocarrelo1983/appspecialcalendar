<?php
namespace common\helpers;

use Yii;
use yii\db\Query;
use yii\web\Cookie;
use yii\web\User;
use yii\web\View;

final class AccountLoginWarnings
{
    public const TABLE = '{{%account_login_device}}';
    private const COOKIE = '_sc_login_device';

    public static function available(): bool
    {
        return Yii::$app->db->schema->getTableSchema(self::TABLE) !== null;
    }

    public static function attach(User $user): void
    {
        $user->on(User::EVENT_AFTER_LOGIN, static function ($event) {
            self::safely(static function () use ($event) {
                if (!self::available() || self::preview()) return;
                $id = (int)$event->identity->getId();
                if ($event->cookieBased) self::touch($id, self::deviceHash());
                else self::record($id, self::deviceHash(), max((int)$event->duration, 36000));
            });
        });
        $user->on(User::EVENT_BEFORE_LOGOUT, static function ($event) {
            self::safely(static function () use ($event) {
                if (self::available() && !self::preview()) Yii::$app->db->createCommand()->delete(self::TABLE,
                    ['user_id'=>(int)$event->identity->getId(), 'device_hash'=>self::deviceHash()])->execute();
            });
        });
        Yii::$app->view->on(View::EVENT_END_BODY, static function () {
            self::safely(static function () {
                if (Yii::$app->user->isGuest || self::preview() || !self::available()) return;
                $script = file_get_contents(__DIR__ . '/account-login-warning.js');
                Yii::$app->view->registerJs($script, View::POS_END, 'account-login-warning');
            });
        });
    }

    private static function preview(): bool
    {
        return is_array(Yii::$app->session->get(AdminViewAs::SESSION_KEY));
    }

    private static function safely(callable $run): void
    {
        try { $run(); } catch (\Throwable $error) {
            // Optional warnings must never interrupt authentication or logout.
            Yii::warning(['event'=>'account-login-warning-unavailable','error'=>get_class($error)], __METHOD__);
        }
    }

    public static function deviceHash(): string
    {
        static $value;
        if ($value !== null) return $value;
        $token = Yii::$app->request->cookies->getValue(self::COOKIE);
        if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) {
            $token = bin2hex(random_bytes(32));
            Yii::$app->response->cookies->add(new Cookie(['name'=>self::COOKIE,'value'=>$token,
                'expire'=>time()+365*86400,'path'=>'/','httpOnly'=>true,
                'secure'=>Yii::$app->request->isSecureConnection,'sameSite'=>Cookie::SAME_SITE_LAX]));
        }
        return $value = hash('sha256', $token);
    }

    public static function record(int $userId, string $device, int $duration, ?int $at = null): void
    {
        $at = $at ?? time();$db = Yii::$app->db;
        $db->transaction(static function () use ($db,$userId,$device,$duration,$at) {
            // Serialize competing sign-ins for one account. SQLite serializes
            // writes; MySQL/PostgreSQL use the existing account row lock.
            if (in_array($db->driverName, ['mysql','pgsql'], true)) {
                $db->createCommand('SELECT id FROM {{%user}} WHERE id=:id FOR UPDATE', [':id'=>$userId])->queryScalar();
            }
            $key = ['user_id'=>$userId,'device_hash'=>$device];
            $values = ['last_seen_at'=>$at,'expires_at'=>$at+max(3600,$duration),'login_at'=>$at];
            $db->createCommand()->upsert(self::TABLE, $key+$values, $values)->execute();
            $others = (new Query())->from(self::TABLE)->where(['user_id'=>$userId])
                ->andWhere(['<>','device_hash',$device])->andWhere(['>','expires_at',$at])->exists();
            if ($others) {
                $warning = bin2hex(random_bytes(32));
                $db->createCommand()->update(self::TABLE, ['warning_token'=>$warning],
                    ['and',['user_id'=>$userId],['>','expires_at',$at]])->execute();
            }
        });
    }

    public static function touch(int $userId, string $device, ?int $at = null): void
    {
        $at = $at ?? time();$key = ['user_id'=>$userId,'device_hash'=>$device];
        $values = ['last_seen_at'=>$at,'expires_at'=>$at+30*86400];
        Yii::$app->db->createCommand()->upsert(self::TABLE, $key+$values+['login_at'=>$at], $values)->execute();
    }

    public static function status(int $userId, string $device): ?string
    {
        self::touch($userId, $device);
        $token = (new Query())->select('warning_token')->from(self::TABLE)
            ->where(['user_id'=>$userId,'device_hash'=>$device])->scalar();
        return is_string($token) && preg_match('/^[a-f0-9]{64}$/D', $token) ? $token : null;
    }

    public static function acknowledge(int $userId, string $device, string $token): void
    {
        Yii::$app->db->createCommand()->update(self::TABLE, ['warning_token'=>null],
            ['user_id'=>$userId,'device_hash'=>$device,'warning_token'=>$token])->execute();
    }
}
