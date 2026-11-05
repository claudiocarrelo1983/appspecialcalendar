<?php
use yii\helpers\Html;
use yii\helpers\Json;
use yii\helpers\Url;

\frontend\assets\GymQrScannerAsset::register($this);
$memberUrl = \common\helpers\GymClassAppLinks::memberUrl($companyCode, 1);
$parts = parse_url($memberUrl);
$appOrigin = isset($parts['scheme'], $parts['host']) ? $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '') : null;
$config = [
    'companyCode' => $companyCode,
    'origins' => array_values(array_unique(array_filter([Yii::$app->request->hostInfo, $appOrigin, 'https://specialcalendar.com', 'https://www.specialcalendar.com']))),
    'destination' => Url::to(['/clients-list/view'], true),
    'messages' => [],
    'checkinAllowed' => \common\helpers\GymMemberQrAccess::can('view'),
];
foreach (['ready', 'camera_error', 'invalid', 'not_found', 'opening', 'starting'] as $key) {
    $config['messages'][$key] = Yii::t('app', 'gym_qr_' . $key);
}
?>
<div class="modal fade" id="gymMemberQrScanner" tabindex="-1" aria-labelledby="gymMemberQrTitle" aria-hidden="true" data-config="<?= Html::encode(Json::encode($config)) ?>">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content rounded-4 shadow-sm border-0">
            <div class="modal-header border-0">
                <h2 class="modal-title fs-5 fw-bold" id="gymMemberQrTitle"><i class="bx bx-qr-scan me-2" aria-hidden="true"></i><?= Html::encode(Yii::t('app', 'gym_qr_read')) ?></h2>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?= Html::encode(Yii::t('app', 'close')) ?>"></button>
            </div>
            <div class="modal-body pt-0">
                <p class="text-muted small"><?= Html::encode(Yii::t('app', 'gym_qr_hint')) ?></p>
                <div class="gym-qr-camera rounded-4">
                    <video autoplay playsinline muted aria-label="<?= Html::encode(Yii::t('app', 'gym_qr_camera')) ?>"></video>
                    <div class="gym-qr-frame" aria-hidden="true"></div>
                </div>
                <p class="small text-muted my-3" data-qr-status role="status" aria-live="polite"><?= Html::encode($config['messages']['starting']) ?></p>
                <div class="d-flex gap-2 flex-wrap">
                    <button type="button" class="btn btn-primary rounded-4 flex-grow-1" data-qr-start><i class="bx bx-camera me-1" aria-hidden="true"></i><?= Html::encode(Yii::t('app', 'gym_qr_camera')) ?></button>
                    <label class="btn btn-light border rounded-4 flex-grow-1 mb-0">
                        <i class="bx bx-image me-1" aria-hidden="true"></i><?= Html::encode(Yii::t('app', 'gym_qr_image')) ?>
                        <input type="file" accept="image/*" class="visually-hidden" data-qr-file>
                    </label>
                </div>
            </div>
        </div>
    </div>
</div>
<?php $this->registerCss(<<<'CSS'
#gymMemberQrScanner .modal-dialog{max-width:460px}
#gymMemberQrTitle>i{color:var(--sc-primary,#0d6efd)}
#gymMemberQrScanner .gym-qr-camera{position:relative;aspect-ratio:1;max-height:42vh;overflow:hidden;background:#111827}
#gymMemberQrScanner video{width:100%;height:100%;object-fit:cover;display:block}
#gymMemberQrScanner .gym-qr-frame{position:absolute;inset:18%;border:3px solid #fff;border-radius:1rem;box-shadow:0 0 0 100vmax #0003;pointer-events:none}
#gymMemberQrScanner .btn{min-height:44px}
CSS); ?>
