<?php

namespace frontend\controllers\api\v1;

use Yii;
use yii\filters\ContentNegotiator;
use yii\web\Controller;
use yii\web\Response;

class BaseApiController extends Controller
{
    public function behaviors()
    {
        return [
            'contentNegotiator' => [
                'class' => ContentNegotiator::class,
                'formats' => [
                    'application/json' => Response::FORMAT_JSON,
                ],
            ],
        ];
    }

    public function beforeAction($action)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        return parent::beforeAction($action);
    }

    protected function success($data = [], array $meta = null)
    {
        $response = [
            'success' => true,
            'data' => $data,
        ];

        if ($meta !== null) {
            $response['meta'] = $meta;
        }

        return $response;
    }

    protected function error($message, array $errors = [], $statusCode = 400)
    {
        Yii::$app->response->statusCode = $statusCode;

        return [
            'success' => false,
            'message' => $message,
            'errors' => $errors,
        ];
    }

    protected function requireAuthenticated()
    {
        if (Yii::$app->user->isGuest) {
            return $this->error(Yii::t('app', 'login_required'), [], 401);
        }

        return null;
    }
}
