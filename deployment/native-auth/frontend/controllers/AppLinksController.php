<?php
namespace frontend\controllers;

use common\helpers\GymClassAppLinks;
use Yii;
use yii\filters\VerbFilter;
use yii\web\Controller;

/** Public OS domain-verification endpoints; no login or redirect. */
class AppLinksController extends Controller
{
    public function behaviors()
    {
        return ['verbs' => ['class' => VerbFilter::class, 'actions' => ['android' => ['GET', 'HEAD'], 'apple' => ['GET', 'HEAD']]]];
    }

    public function actionAndroid()
    {
        return $this->association(GymClassAppLinks::android(Yii::$app->request->hostInfo));
    }

    public function actionApple()
    {
        return $this->association(GymClassAppLinks::apple(Yii::$app->request->hostInfo));
    }

    private function association(array $data)
    {
        Yii::$app->response->headers->set('Cache-Control', 'public, max-age=300');
        Yii::$app->response->headers->set('X-Content-Type-Options', 'nosniff');
        return $this->asJson($data);
    }
}
