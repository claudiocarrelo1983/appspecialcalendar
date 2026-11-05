<?php

    use common\helpers\Helpers;
    use common\models\User;
    use yii\helpers\Html;
    use yii\helpers\Url;
    use yii\grid\ActionColumn;
    use yii\grid\GridView;
    use yii\helpers\Json;
    use yii\db\Query;

    /** @var yii\web\View $this */
    /** @var app\Models\ClientsSearch $searchModel */
    /** @var yii\data\ActiveDataProvider $dataProvider */
    /** @var array $companyAccessMap */
    /** @var bool $canManageCompanyAccess */

    $this->title =  Yii::t('app', 'clients_list');

?>


<!-- start page title -->
<div class="block-daytime-index">
    <?= Helpers::displayAminBreadcrumbs('clients','clients-list',['clients-list']) ?>

    <div class="d-flex flex-wrap">
        <?= Helpers::displayButtonCreateIndex('clients_list'); ?>
        <?php if(!Yii::$app->user->isGuest && Yii::$app->user->identity->level==='admin' && !empty($isGymPlan)): ?>
        <?= Html::a('<i class="bx bx-user-check"></i> '.Html::encode(Yii::t('app','Registration waiting list')),['waiting-list'],['class'=>'btn btn-outline-success rounded-4 ms-2']) ?>
        <?php endif ?>  
    </div>
</div>



<div class="row g-0 clients-index">
    <?php if (!empty($fitnessSummaries)): ?>
        <div class="col-12 mb-3"><div class="card rounded-4 border-0 shadow-sm"><div class="card-body p-3 p-md-4"><div class="table-responsive clients-fitness-summary">
            <table class="table align-middle mb-0"><thead><tr>
                <?php foreach (['client','profile_main_goal','profile_last_session','profile_next_session','profile_remaining_sessions','profile_follow_up'] as $label): ?><th><?= Html::encode(Yii::t('app',$label)) ?></th><?php endforeach; ?>
            </tr></thead><tbody>
                <?php foreach ($dataProvider->getModels() as $client): if ($client->level!=='client') continue; $fitness=$fitnessSummaries[$client->guid]??[]; ?>
                    <tr><td><?= Html::a(Html::encode($client->full_name ?: $client->username),['view','id'=>$client->id],['class'=>'fw-bold']) ?></td><td><?= Html::encode($fitness['goal']->title ?? Yii::t('app','profile_not_recorded')) ?></td>
                        <td><?= !empty($fitness['last']) ? Html::encode(Yii::$app->formatter->asDatetime($fitness['last'],'php:d/m/Y H:i')) : '—' ?></td>
                        <td><?= !empty($fitness['next']) ? Html::encode(Yii::$app->formatter->asDatetime($fitness['next'],'php:d/m/Y H:i')) : '—' ?></td>
                        <td><?= isset($fitness['remaining']) ? (int)$fitness['remaining'] : '—' ?></td>
                        <td><div class="d-flex flex-wrap gap-1"><?php if (!empty($fitness['pending'])): ?><span class="badge bg-warning-subtle text-warning rounded-pill"><?= Html::encode(Yii::t('app','profile_pending_reviews',['count'=>$fitness['pending']])) ?></span><?php endif; ?><?php if (!empty($fitness['expiring'])): ?><span class="badge bg-danger-subtle text-danger rounded-pill"><?= Html::encode(Yii::t('app','profile_package_expiring')) ?></span><?php endif; ?><?php if (empty($fitness['next']) && (\common\helpers\ClientFitnessProfile::can('t-members-attendance') || \common\helpers\ClientFitnessProfile::can('t-classes-schedule'))): ?><span class="badge bg-light text-dark rounded-pill"><?= Html::encode(Yii::t('app','profile_no_next_session')) ?></span><?php endif; ?></div></td>
                    </tr>
                <?php endforeach; ?>
            </tbody></table>
        </div></div></div></div>
    <?php endif; ?>
    <?= $this->render('_search', ['model' => $searchModel, 'fitnessEnabled'=>$isGymPlan ?? false]); ?>
        <?php foreach ($dataProvider->models as $key => $model): ?>
            <?php  
				if($model->level != 'client'){
					continue;
				}

                Helpers::generateClientQrCodeIfEmpty($model);

                $qrModalId = 'clientQrModal' . $model->id;
                $hasQrCode = !empty($model->qr_code);
                $accessInfo = $companyAccessMap[$model->id] ?? null;
                $accessStatus = $accessInfo['status'] ?? 'none';
                $dependentCount = $model->hasAttribute('parent_guid')
                    ? (int)(new Query())
                        ->from('user')
                        ->where([
                            'company_code' => $model->company_code,
                            'level' => 'client',
                            'parent_guid' => $model->guid,
                        ])
                        ->count()
                    : 0;
                $parentClient = ($model->hasAttribute('parent_guid') && !empty($model->parent_guid))
                    ? (new Query())
                        ->select(['id', 'full_name', 'username'])
                        ->from('user')
                        ->where([
                            'company_code' => $model->company_code,
                            'guid' => $model->parent_guid,
                            'level' => 'client',
                        ])
                        ->one()
                    : null;
			?>
            
            
            <div class="mb-3 px-0">
                <div class="border client-card-modern p-3 p-md-4">
                    <div class="client-card-header d-flex align-items-center justify-content-between gap-2">
                        <?= Helpers::formBoxIcon('','text-5', 'icon-square icon-soft') ?>
                        <button class="client-card-toggle pr-3 accordion-button fw-medium collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse<?= $key ?>" aria-expanded="false" aria-controls="collapse<?= $key ?>">     
                            <div class="ms-3 client-card-summary">
                                <div class="client-name">
                                    <?= Html::encode($model->full_name) ?>
                                </div>
                                <div class="client-username">  
                                    <?= Html::encode('(+'.$model->contact_country_code.') '.$model->contact_number) ?> 
                                </div>
                                <div class="client-username mt-1" data-company-access-state="<?= Html::encode((string)$model->id) ?>">
                                    <?php if ($parentClient): ?>
                                        <span class="badge rounded-pill text-bg-info">
                                            <?= Html::encode(Yii::t('app', 'dependent')) ?>:
                                            <?= Html::encode($parentClient['full_name'] ?: $parentClient['username']) ?>
                                        </span>
                                    <?php elseif ($dependentCount > 0): ?>
                                        <span class="badge rounded-pill text-bg-primary">
                                            <?= Html::encode(Yii::t('app', 'responsible')) ?>:
                                            <?= Html::encode((string)$dependentCount) ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if ($accessInfo): ?>
                                        <span class="badge rounded-pill <?= Html::encode($accessInfo['class']) ?>">
                                            <?= Html::encode(Yii::t('app', 'gym_access')) ?>: <?= Html::encode($accessInfo['label']) ?>
                                        </span>
                                        <?php if (!empty($accessInfo['role'])): ?>
                                            <span class="text-muted ms-1"><?= Html::encode(Yii::t('app', $accessInfo['role'])) ?></span>
                                        <?php endif; ?>
                                    <?php else: ?>
                                        <span class="badge rounded-pill text-bg-danger">
                                            <?= Html::encode(Yii::t('app', 'gym_access')) ?>: <?= Html::encode(Yii::t('app', 'sem_estado')) ?>
                                        </span>
                                    <?php endif; ?>
                                </div>
                              
                                <div class="client-username">  
                                    <?php 
                                
                                        $result = (new \yii\db\Query())
                                            ->from('sheddule')
                                            ->where([                                   
                                                'client_username' => $model->guid,
                                                 'company_code' => $model->company_code,
                                            ])->orderBy(['date' => SORT_DESC, 'time' => SORT_DESC])
                                            ->one();

                                        if (!empty($result)) {
                                        ?>
                                            <strong><?= Yii::t('app', 'last_visit') ?></strong> : 
                                            <span class="client-username"> 
                                                <?= Helpers::howMuchTimeAgo($result['date'])  ?>
                                            </span>
                                
                                        <?php   
                                        }

                                        $fullTotal = (new \yii\db\Query())
                                            ->from('sheddule')
                                            ->where([
                                                'client_username' => $model->guid,
                                                'company_code' => $model->company_code                                        
                                            ])->count();


                                        $cancelations = (new \yii\db\Query())
                                            ->from('sheddule')
                                            ->where([
                                                'client_username' => $model->guid,
                                                'company_code' => $model->company_code,
                                                'booking_status' => 'cancelled'
                                            ])->count();

                                        $total = (new \yii\db\Query())
                                            ->from('sheddule')
                                            ->where([
                                                'client_username' => $model->guid,
                                                'company_code' => $model->company_code,
                                                 'booking_status' => 'confirmed'
                                            ])->count();

                                        $missed = (new \yii\db\Query())
                                            ->from('sheddule')
                                            ->where([
                                                'client_username' => $model->guid,
                                                'company_code' => $model->company_code,
                                                 'booking_status' => 'missed'
                                            ])->count();

                                        $coming = (new \yii\db\Query())
                                            ->from('sheddule')
                                            ->where([                                   
                                                'client_username' => $model->guid,
                                                'company_code' => $model->company_code,
                                            ])
                                            ->andWhere([
                                                '>',
                                                new \yii\db\Expression("CONCAT(date, ' ', time)"),
                                                new \yii\db\Expression('NOW()')
                                            ])
                                            ->orderBy(['date' => SORT_ASC, 'time' => SORT_ASC]) // next upcoming first
                                            ->count();


                                        $extraDeleteMessage = '';

                                        if($fullTotal > 0){
                                            $extraDeleteMessage = Yii::t('app', 'client_bookings_warning', ['count' => $fullTotal]);
                                        }     
                                    ?> 
                                    
                                    <?php if (!empty($cancelations)) { ?>, 
                                        <strong><?= Yii::t('app', 'cancellations') ?></strong> : 
                                        <span class="client-username"> 
                                            <?= $cancelations  ?>
                                        </span>
                                    <?php } ?>
                                    <?php if (!empty($cancelations)) { ?>, 
                                        <strong><?= Yii::t('app', 'missed') ?></strong> : 
                                        <span class="client-username"> 
                                            <?= $missed  ?>
                                        </span>
                                    <?php } ?>
                                    <?php if (!empty($coming)) { ?>, 
                                        <strong><?= Yii::t('app', 'coming_up') ?></strong> : 
                                            <span class="client-username"> 
                                             <?= $coming  ?>
                                        </span>
                                    <?php } ?> 
                                     <?php if (!empty($total)) { ?>, 
                                        <strong><?= Yii::t('app', 'total_visits') ?></strong> : 
                                            <span class="client-username"> 
                                             <?= $total  ?>
                                        </span>  
                                    <?php } ?>                        
                                </div>                                      
                            </div>
                        </button>                         
                        <div class="client-card-actions d-flex align-items-center justify-content-end gap-2">
                        

                            <?php if ($hasQrCode) { ?>
                                <a
                                    type="button"
                                    class="client-card-action-button d-inline-flex align-items-center justify-content-center rounded-4 shadow-sm"
                                    data-bs-toggle="modal"
                                    data-bs-target="#<?= $qrModalId ?>"
                                    title="<?= Yii::t('app', 'qr_code') ?>"
                                >
                                    <i class="fas fa-qrcode text-5"></i>
                                </a>
                            <?php } else { ?>
                                <a
                                    type="button"
                                    class="client-card-action-button d-inline-flex align-items-center justify-content-center rounded-4 shadow-sm disabled"
                                    title="<?= Yii::t('app', 'qr_code_not_available') ?>"
                                    disabled
                                >
                                    <i class="fas fa-qrcode text-5"></i>
                                </a>
                            <?php } ?>

                                <?php if ($canManageCompanyAccess): ?>
                                <?php $nextAccessStatus = $accessStatus === 'approved' ? 'revoked' : 'approved'; ?>
                                <?= Html::beginForm(['company-access/set-member-status', 'id' => $model->id], 'post', [
                                    'class' => 'client-access-ajax-form d-inline-flex',
                                    'data-client-id' => $model->id,
                                    'data-access-target-status' => $nextAccessStatus,
                                ]) ?>
                                    <?= Html::hiddenInput('company_code', $searchModel->company_code) ?>
                                    <?= Html::hiddenInput('access_status', $nextAccessStatus, ['class' => 'client-access-status-input']) ?>
                                    <?= Html::submitButton($nextAccessStatus === 'approved' ? '<i class="bx bx-check-circle"></i>' : '<i class="bx bx-block"></i>', [
                                        'class' => 'client-card-action-button client-access-toggle-button d-inline-flex align-items-center justify-content-center rounded-4 shadow-sm border-0 p-0 bg-white ' . ($nextAccessStatus === 'approved' ? 'text-success' : 'text-warning'),
                                        'title' => Yii::t('app', $nextAccessStatus === 'approved' ? ($accessStatus === 'revoked' ? 'restore_access' : 'approve_access') : 'revoke'),
                                        'aria-label' => Yii::t('app', $nextAccessStatus === 'approved' ? ($accessStatus === 'revoked' ? 'restore_access' : 'approve_access') : 'revoke'),
                                    ]) ?>
                                <?= Html::endForm() ?>
                            <?php endif; ?>

                             <?php 
                                $arrIcons = [
                                    'dripicons-preview' => 'view',
                                    'dripicons-document-edit' => 'update',
                                    //'bx bx-copy' => 'duplicate',
                                    'bx bx-trash' => 'delete'
                                ];?> 
                            
                            <?= Helpers::crudActionIcons($model,'', '', $arrIcons, $extraDeleteMessage) ?>  
                        </div>                          
                    </div>

                    
                    <div id="collapse<?= $key ?>" class="accordion-collapse collapse" aria-labelledby="headingOne" data-bs-parent="#accordion<?= $key ?>" style="">                     
                    
                        <?php $arrValues = ['contact_number','email','nif','dob']; ?>

                        <div class="index-page mt-3 pt-4 border-top">
                            <div class="row g-3">
                                <?php foreach ($arrValues as $value) { ?>
                                    <div class="col-sm-6 col-xl-3">
                                        <div class="detail-box">
                                            <span><?= Html::encode(Yii::t('app', $value)) ?></span>
                                            <strong>
                                                <?= Html::encode(!empty($model->$value) ? $model->$value : '-') ?>
                                            </strong>
                                        </div>
                                    </div>
                                <?php } ?>
                                <div class="col-sm-6 col-xl-3">
                                    <div class="detail-box">
                                        <span><?= Html::encode(Yii::t('app', 'active')) ?></span>
                                        <span class="status-badge <?= $model->active ? 'active' : 'inactive' ?>">
                                            <?= Yii::t('app','active') ?>: <?= $model->active ? Yii::t('app', 'yes') :  Yii::t('app', 'no') ?>
                                        </span>
                                    </div>
                                </div>                        
                                <?php if ($parentClient || $dependentCount > 0): ?>
                                    <div class="col-sm-6 col-xl-3">
                                        <div class="detail-box">
                                            <span><?= Html::encode(Yii::t('app', 'family_account')) ?></span>
                                            <strong>
                                                <?php if ($parentClient): ?>
                                                    <?= Html::encode(Yii::t('app', 'responsible')) ?>:
                                                    <?= Html::a(Html::encode($parentClient['full_name'] ?: $parentClient['username']), ['view', 'id' => $parentClient['id']]) ?>
                                                <?php else: ?>
                                                    <?= Html::encode(Yii::t('app', 'dependents')) ?>:
                                                    <?= Html::encode((string)$dependentCount) ?>
                                                <?php endif; ?>
                                            </strong>
                                        </div>
                                    </div>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </div>

            <?php if ($hasQrCode) { ?>
                <div class="modal fade" id="<?= $qrModalId ?>" tabindex="-1" aria-labelledby="<?= $qrModalId ?>Label" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content rounded-4 border-0 shadow-sm">
                            <div class="modal-header border-0 pb-0">
                                <div>
                                    <h5 class="modal-title fw-semibold" id="<?= $qrModalId ?>Label">
                                        <?= Yii::t('app', 'qr_code') ?>
                                    </h5>
                                    <div class="text-muted small">
                                        <?= Html::encode($model->full_name) ?>
                                    </div>
                                </div>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?= Yii::t('app', 'close') ?>"></button>
                            </div>
                            <div class="modal-body text-center pt-3">
                                <div class="bg-light rounded-4 p-4 d-inline-flex">
                                    <?= Html::img($model->qr_code, [
                                        'alt' => Yii::t('app', 'qr_code'),
                                        'class' => 'img-fluid',
                                        'style' => 'max-width: 280px; width: 100%; height: auto;',
                                    ]) ?>
                                </div>
                            </div>
                            <div class="modal-footer border-0 justify-content-center pt-0">
                                <?= Html::a(
                                    '<i class="bx bx-message-square-dots me-1"></i>' . Yii::t('app', 'send_sms_qr_code_url'),
                                    ['clients-list/save-qr-sms-log', 'id' => $model->id],
                                    [
                                        'class' => 'btn btn-outline-primary rounded-4',
                                        'data' => [
                                            'method' => 'post',
                                        ],
                                    ]
                                ) ?>
                                <?= Html::a(
                                    '<i class="bx bx-link-external me-1"></i>' . Yii::t('app', 'open_client'),
                                    ['clients-list/view', 'id' => $model->id],
                                    ['class' => 'btn btn-primary rounded-4']
                                ) ?>
                            </div>
                        </div>
                    </div>
                </div>
            <?php } ?>
            </div>
        <?php endforeach; ?>   
        
        <?php if ($dataProvider->pagination && $dataProvider->pagination->pageCount > 1): ?>
        <div class="d-flex justify-content-center mt-3">
            <?= \yii\widgets\LinkPager::widget([
                'pagination' => $dataProvider->pagination,
                'options' => ['class' => 'pagination-modern'],
            ]) ?>
        </div>
        <?php endif; ?>
            
</div>

<?php
$accessAjaxLabels = Json::htmlEncode([
    'loading' => Yii::t('app', 'processing_request'),
    'error' => Yii::t('app', 'company_access_ajax_failed'),
    'approved' => Yii::t('app', 'approved'),
    'rejected' => Yii::t('app', 'rejected'),
    'revoked' => Yii::t('app', 'revoked'),
    'gymAccess' => Yii::t('app', 'gym_access'),
    'approveAccess' => Yii::t('app', 'approve_access'),
    'restoreAccess' => Yii::t('app', 'restore_access'),
    'revoke' => Yii::t('app', 'revoke'),
]);
$this->registerJs(<<<JS
(function () {
    const labels = {$accessAjaxLabels};

    jQuery(document).on('submit', '.client-access-ajax-form', function (event) {
        event.preventDefault();

        const form = jQuery(this);
        const button = form.find('[type="submit"]');
        const originalHtml = button.html();
        const clientId = form.data('client-id');

        button.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>');

        jQuery.ajax({
            url: form.attr('action'),
            type: 'POST',
            dataType: 'json',
            data: form.serialize()
        }).done(function (response) {
            if (!response || response.success !== true) {
                window.alert(response && response.message ? response.message : labels.error);
                button.prop('disabled', false).html(originalHtml);
                return;
            }

            const status = response.status || form.data('access-target-status') || 'revoked';
            let badgeClass = response.class || 'text-bg-secondary';
            let statusLabel = response.label || labels.revoked;
            if (status === 'approved') {
                badgeClass = response.class || 'text-bg-success';
                statusLabel = response.label || labels.approved;
            } else if (status === 'rejected') {
                badgeClass = response.class || 'text-bg-danger';
                statusLabel = response.label || labels.rejected;
            }

            jQuery('[data-company-access-state="' + clientId + '"]').html(
                '<span class="badge rounded-pill ' + badgeClass + '">' + labels.gymAccess + ': ' + statusLabel + '</span>'
            );

            const nextStatus = status === 'approved' ? 'revoked' : 'approved';
            form.data('access-target-status', nextStatus);
            form.attr('data-access-target-status', nextStatus);
            form.find('.client-access-status-input').val(nextStatus);

            button
                .toggleClass('text-success', nextStatus === 'approved')
                .toggleClass('text-warning', nextStatus === 'revoked')
                .attr('title', nextStatus === 'approved' ? (status === 'revoked' ? labels.restoreAccess : labels.approveAccess) : labels.revoke)
                .attr('aria-label', nextStatus === 'approved' ? (status === 'revoked' ? labels.restoreAccess : labels.approveAccess) : labels.revoke)
                .html(nextStatus === 'approved' ? '<i class="bx bx-check-circle"></i>' : '<i class="bx bx-block"></i>');
            button.prop('disabled', false);
        }).fail(function () {
            window.alert(labels.error);
            button.prop('disabled', false).html(originalHtml);
        });
    });
})();
JS);
?>

<style>
.clients-index .client-card-modern{margin-bottom:0}
.clients-index .client-card-header{flex-wrap:nowrap}
.clients-index .client-card-toggle{min-width:0;width:auto;flex:1 1 auto}
.clients-index .client-card-summary{min-width:0;text-align:left}
.clients-index .client-name,
.clients-index .client-username{overflow:hidden;text-overflow:ellipsis}
.clients-index .client-card-actions{flex:0 0 auto;min-width:max-content;flex-wrap:nowrap;white-space:nowrap}
.clients-index .client-card-action-button{color:inherit;height:35px;width:35px;flex:0 0 35px;text-decoration:none}
.clients-index .client-access-toggle-button{appearance:none;-webkit-appearance:none}
.clients-index .client-access-ajax-form{margin:0}
.clients-index .client-card-actions .crud-action-buttons{flex:0 0 auto;flex-wrap:nowrap}
@media (max-width: 575.98px){
    .clients-index .client-card-header{align-items:flex-start!important;flex-wrap:wrap}
    .clients-index .client-card-toggle{order:2;flex:1 1 calc(100% - 58px)}
    .clients-index .client-card-actions{order:3;margin-left:auto;max-width:100%;min-width:0}
}
</style>
