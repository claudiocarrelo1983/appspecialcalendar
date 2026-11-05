<?php

namespace frontend\controllers;

use common\helpers\Helpers;
use common\models\GymCheckin;
use common\models\GymCheckinSearch;
use common\models\Membership;
use Yii;
use yii\filters\VerbFilter;
use yii\web\Controller;
use yii\web\NotFoundHttpException;

class GymCheckinController extends Controller
{
    public function behaviors()
    {
        return [
            'verbs' => [
                'class' => VerbFilter::class,
                'actions' => ['delete' => ['POST'], 'checkout' => ['POST']],
            ],
        ];
    }

    public function beforeAction($action)
    {
        if (!parent::beforeAction($action)) {
            return false;
        }

        // This endpoint is the QR confirmation flow for the existing attendance grant.
        $operation = $action->id === 'delete' ? 'delete' : ($action->id === 'checkout' ? 'edit' : (Yii::$app->request->isPost ? 'create' : 'view'));
        if (!\common\helpers\GymMemberQrAccess::can($operation)) {
            throw new \yii\web\ForbiddenHttpException(Yii::t('app', 'permission_denied'));
        }
        return Helpers::adminBeforeAction($this, false, true);
    }

    public function actionIndex()
    {
        $searchModel = new GymCheckinSearch();
        $dataProvider = $searchModel->search(Yii::$app->request->queryParams);
        $model = new GymCheckin([
            'company_code' => $this->companyCode(),
            'checkin_date' => date('Y-m-d H:i:s'),
        ]);

        // A QR opens a confirmation form; scanning never records attendance by GET.
        $scannedMember = null;
        $memberId = Yii::$app->request->get('member_id');
        if ($memberId !== null) {
            if (!is_scalar($memberId) || !preg_match('/^[1-9][0-9]{0,9}$/D', (string)$memberId)) {
                throw new NotFoundHttpException();
            }
            $scannedQuery = \common\models\User::find()->where(['id' => (int)$memberId, 'company_code' => $this->companyCode(), 'level' => 'client']);
            Helpers::applyCurrentUserLocationScope($scannedQuery);
            $scannedMember = $scannedQuery->one();
            if ($scannedMember === null) throw new NotFoundHttpException();
            $model->client_guid = $scannedMember->guid;
        }

        if ($model->load(Yii::$app->request->post())) {
            $model->company_code = $this->companyCode();
            $model->checkin_date = date('Y-m-d H:i:s');
            $checkinClientQuery = \common\models\User::find()->where(['guid' => $model->client_guid, 'company_code' => $this->companyCode(), 'level' => 'client']);
            Helpers::applyCurrentUserLocationScope($checkinClientQuery);
            if (!$checkinClientQuery->exists()) throw new NotFoundHttpException();
            $membership = Membership::find()
                ->where([
                    'company_code' => $this->companyCode(),
                    'client_guid' => $model->client_guid,
                    'status' => Membership::STATUS_ACTIVE,
                    'active' => 1,
                ])
                ->andWhere(['>=', 'end_date', date('Y-m-d')])
                ->orderBy(['end_date' => SORT_DESC])
                ->one();

            if ($membership === null) {
                Yii::$app->session->setFlash('danger', Yii::t('app', 'membership_expired_or_missing'));
            } else {
                $model->membership_code = $membership->code;
                if ($model->save()) {
                    Yii::$app->session->setFlash('success', Yii::t('app', 'checkin_saved_successfully'));
                    return $this->redirect(['index']);
                }
            }
        }

        return $this->render('index', compact('searchModel', 'dataProvider', 'model', 'scannedMember'));
    }

    public function actionCheckout($id)
    {
        $model = $this->findModel($id);
        $model->checkout_date = date('Y-m-d H:i:s');
        $model->status = 'checked_out';
        $model->save(false);

        return $this->redirect(['index']);
    }

    public function actionDelete($id)
    {
        $this->findModel($id)->delete();
        return $this->redirect(['index']);
    }

    protected function findModel($id)
    {
        $model = GymCheckin::findOne(['id' => $id, 'company_code' => $this->companyCode()]);

        if ($model !== null) {
            return $model;
        }

        throw new NotFoundHttpException(Yii::t('app', 'The requested page does not exist.'));
    }

    private function companyCode()
    {
        return \common\helpers\SecurityAccess::companyCode();
    }
}
