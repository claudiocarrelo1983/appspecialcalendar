<?php
namespace common\helpers;

use common\models\User;
use Yii;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

final class GymRegistrationApproval
{
    public static function assertAdmin(): void
    {
        if (Yii::$app->user->isGuest || Yii::$app->user->identity->level !== 'admin') {
            throw new ForbiddenHttpException();
        }
    }

    public static function pending(string $company)
    {
        return User::find()->where(['company_code'=>$company,'level'=>'client',
            'active'=>1,'status'=>User::STATUS_WAITING_LIST]);
    }

    public static function decide(string $company, int $id, string $decision): void
    {
        self::assertAdmin();
        if (!in_array($decision,['approve','delete'],true)) throw new \yii\web\BadRequestHttpException();
        Yii::$app->db->transaction(static function () use ($company,$id,$decision) {
            $user=self::pending($company)->andWhere(['id'=>$id])->one();
            if (!$user) throw new NotFoundHttpException();
            // Conditional update prevents a repeated/stale delete from deleting an approved account.
            $changes=$decision==='approve'?['status'=>User::STATUS_ACTIVE]
                :['status'=>User::STATUS_DELETED,'active'=>0];
            $count=User::updateAll($changes,['id'=>$id,'company_code'=>$company,'level'=>'client',
                'status'=>User::STATUS_WAITING_LIST,'active'=>1]);
            if ($count!==1) throw new \yii\web\ConflictHttpException();
        });
    }
}
