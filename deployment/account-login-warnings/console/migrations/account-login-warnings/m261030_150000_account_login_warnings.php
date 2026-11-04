<?php
use yii\db\Migration;

class m261030_150000_account_login_warnings extends Migration
{
    public function safeUp()
    {
        $this->createTable('{{%account_login_device}}',[
            'user_id'=>$this->integer()->notNull(),'device_hash'=>$this->string(64)->notNull(),
            'login_at'=>$this->integer()->notNull(),'last_seen_at'=>$this->integer()->notNull(),
            'expires_at'=>$this->integer()->notNull(),'warning_token'=>$this->string(64),
            'PRIMARY KEY ([[user_id]], [[device_hash]])',
        ]);
        $this->createIndex('idx_account_login_expiry','{{%account_login_device}}','expires_at');
    }
    public function safeDown() { $this->dropTable('{{%account_login_device}}'); }
}
