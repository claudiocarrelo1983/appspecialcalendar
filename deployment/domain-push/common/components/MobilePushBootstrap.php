<?php
namespace common\components;

class MobilePushBootstrap implements \yii\base\BootstrapInterface
{
    public function bootstrap($app)
    {
        $apps = \common\helpers\MobilePushApps::all();
        $mask = ['_POST.installationSecret', '_POST.token', '_POST.handoff', '_POST.expoPushToken', '_GET.installationSecret', '_GET.token',
            '_SERVER.HTTP_AUTHORIZATION', '_COOKIE', '_SESSION', '_SERVER.MOBILE_PUSH_APPS_JSON', '_ENV.MOBILE_PUSH_APPS_JSON',
            '_SERVER.MOBILE_PUSH_DOMAINS_JSON', '_ENV.MOBILE_PUSH_DOMAINS_JSON'];
        $credentialNames = ['EXPO_ACCESS_TOKEN'];
        foreach (array_keys(array_merge($_SERVER, $_ENV, getenv() ?: [])) as $name) {
            if (preg_match('/TOKEN|SECRET|PASSWORD|CREDENTIAL|PRIVATE_KEY/i', $name)) { $credentialNames[] = $name; }
        }
        foreach (is_array($apps) ? $apps : [] as $config) {
            if (is_array($config) && is_string($config['accessTokenEnv'] ?? null)
                && preg_match('/^[A-Z][A-Z0-9_]*$/D', $config['accessTokenEnv'])) { $credentialNames[] = $config['accessTokenEnv']; }
        }
        foreach ($credentialNames as $name) { $mask[] = '_SERVER.' . $name; $mask[] = '_ENV.' . $name; }
        foreach ($app->log->targets as $target) {
            $target->maskVars = array_values(array_unique(array_merge($target->maskVars, $mask)));
        }
    }
}
