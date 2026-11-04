<?php
use yii\db\Migration;

class m261101_120000_company_mobile_logo extends Migration
{
    public function safeUp()
    {
        if(!isset($this->db->schema->getTableSchema('{{%company}}',true)->columns['image_logo_mobile']))
            $this->addColumn('{{%company}}','image_logo_mobile',$this->string(255)->null());
    }
    public function safeDown()
    {
        if(isset($this->db->schema->getTableSchema('{{%company}}',true)->columns['image_logo_mobile']))
            $this->dropColumn('{{%company}}','image_logo_mobile');
    }
}
