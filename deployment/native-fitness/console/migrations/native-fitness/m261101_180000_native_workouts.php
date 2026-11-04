<?php
use yii\db\Migration;
class m261101_180000_native_workouts extends Migration
{
    public function safeUp()
    {
        if($this->db->schema->getTableSchema('{{%native_workout_history}}',true))return;
        $this->createTable('{{%native_workout_history}}',['id'=>$this->primaryKey(),'company_code'=>$this->string(255)->notNull(),'user_id'=>$this->integer()->notNull(),'workout_id'=>$this->string(36)->notNull(),'mode'=>$this->string(16)->notNull(),'duration_seconds'=>$this->integer()->notNull(),'finished_at'=>$this->integer()->notNull(),'created_at'=>$this->integer()->notNull()]);
        $this->createIndex('uq_native_workout_owner','{{%native_workout_history}}',['company_code','user_id','workout_id'],true);
        $this->createIndex('idx_native_workout_finished','{{%native_workout_history}}',['user_id','finished_at']);
    }
    public function safeDown(){$this->dropTable('{{%native_workout_history}}');}
}
