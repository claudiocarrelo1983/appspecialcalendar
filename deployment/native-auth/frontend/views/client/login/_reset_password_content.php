<?php
use yii\helpers\Html;
use yii\widgets\ActiveForm;
?>
<?php if ($model === null): ?>
    <div class="alert alert-warning rounded-4" role="alert"><?= Html::encode(Yii::t('app', 'password_reset_link_invalid')) ?></div>
    <?= Html::a(Yii::t('app', 'password_reset_request_new'), $requestUrl, ['class' => 'btn btn-primary w-100 rounded-4 py-2']) ?>
<?php else: ?>
    <?php $form = ActiveForm::begin(['id' => 'reset-password-form','options'=>['data-native-auth'=>'reset','data-native-auth-logo'=>\common\helpers\CompanyBranding::mobileLogoUrl() ?: '', 'data-native-auth-messages'=>\yii\helpers\Json::encode(\common\helpers\NativeAuthPresentation::messages()), 'data-native-auth-color'=>$companyArr['color'] ?? '', 'data-native-auth-company'=>$companyArr['company_name'] ?? Yii::$app->name]]); ?>
    <?= $form->field($model, 'password')->passwordInput(['class' => 'form-control form-control-lg', 'autocomplete' => 'new-password', 'autofocus' => true])->label(Yii::t('app', 'password')) ?>
    <?= Html::submitButton(Yii::t('app', 'password_reset_save'), ['class' => 'btn btn-primary w-100 rounded-4 py-2']) ?>
    <?php ActiveForm::end(); ?>
<?php endif; ?>
<div class="text-center mt-3"><?= Html::a(Yii::t('app', 'login_question'), $loginUrl) ?></div>
