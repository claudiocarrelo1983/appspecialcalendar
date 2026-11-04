<?php
use yii\db\Migration;
class m261103_110000_company_team_permissions extends Migration
{
    public function safeUp()
    {
        $this->createTable('{{%company_team_permissions}}',[
            'id'=>$this->primaryKey(),'company_code'=>$this->string(255)->notNull(),
            'user_id'=>$this->integer()->notNull(),'permissions'=>$this->text()->notNull(),
            'updated_by'=>$this->integer()->notNull(),'updated_at'=>$this->dateTime()->notNull(),
        ]);
        $this->createIndex('uq_company_team_permissions','{{%company_team_permissions}}',['company_code','user_id'],true);
    }
    public function safeDown(){ $this->dropTable('{{%company_team_permissions}}'); }
}
