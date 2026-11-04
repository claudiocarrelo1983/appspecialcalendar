<?php
namespace common\helpers;
use Yii;
use yii\web\UnprocessableEntityHttpException;
class NativeWorkoutHistory
{
    public static function validateRows($rows, $now = null): array
    {
        $now=$now??time();
        if(!is_array($rows)||count($rows)>20)throw new UnprocessableEntityHttpException('Invalid workout batch');
        $result=[];
        foreach($rows as $row){
            if(!is_array($row)||!preg_match('/^[a-f0-9-]{36}$/Di',(string)($row['id']??''))
                ||!in_array($row['mode']??null,['stopwatch','countdown','interval'],true)
                ||!is_int($row['seconds']??null)||$row['seconds']<1||$row['seconds']>86400
                ||!is_numeric($row['at']??null)||!is_finite((float)$row['at'])||$row['at']<946684800000||$row['at']>($now+300)*1000)
                throw new UnprocessableEntityHttpException('Invalid workout');
            $result[]=['workout_id'=>strtolower($row['id']),'mode'=>$row['mode'],'duration_seconds'=>$row['seconds'],'finished_at'=>(int)floor($row['at']/1000)];
        }
        return $result;
    }
    public static function store($company,$userId,$rows): array
    {
        $records=self::validateRows($rows);$ids=[];
        Yii::$app->db->transaction(function()use($records,$company,$userId,&$ids){
            foreach($records as $row){
                Yii::$app->db->createCommand()->upsert('{{%native_workout_history}}',$row+['company_code'=>$company,'user_id'=>$userId,'created_at'=>time()],false)->execute();
                $ids[]=$row['workout_id'];
            }
        });return $ids;
    }
}
