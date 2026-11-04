<?php
namespace common\widgets;

use Yii;
use yii\base\Widget;
use yii\helpers\Html;
use common\helpers\GymMenuHelper;

/** One category/title/icon heading, shared by all gym menu screens and CRUD pages. */
class GymPageHeading extends Widget
{
    public $title;
    public $description;
    public $icon='bx bx-dumbbell';
    public $canonical=false;

    public static function translateLabel($label)
    {
        return preg_replace('/[.\x{2026}\s]+$/u','',Yii::t('app',(string)$label));
    }

    public function run()
    {
        $page=GymMenuHelper::currentPage();
        // The layout supplies the heading once. Existing page widgets retain their actions.
        if($page!==null&&!$this->canonical)return '';
        $trail='';
        if($this->canonical&&$page){
            $parts=[];
            foreach($page['trail'] as $item){
                $label=Html::encode(self::translateLabel($item['label']));
                $parts[]=$item['url']?Html::a($label,[$item['url']]):Html::tag('span',$label);
            }
            $trail=Html::tag('nav',implode('<span aria-hidden="true"> · </span>',$parts),['class'=>'gym-page-heading__category','aria-label'=>Yii::t('app','breadcrumb')]);
        }
        return Html::tag('div',
            Html::tag('span',Html::tag('i','',['class'=>$this->icon,'aria-hidden'=>'true']),['class'=>'gym-page-heading__icon'])
            .Html::tag('div',$trail.Html::tag('h1',Html::encode(self::translateLabel($this->title)),['class'=>'gym-page-heading__title'])
                .(!$this->canonical&&$this->description?Html::tag('p',Html::encode(self::translateLabel($this->description)),['class'=>'gym-page-heading__description']):''),['class'=>'gym-page-heading__copy']),
            ['class'=>'gym-page-heading'.($this->canonical?' gym-canonical-page-heading':'')]
        );
    }
}
