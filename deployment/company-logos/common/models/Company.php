<?php

namespace common\models;
use yii\db\Query;
use common\helpers\Helpers;
use common\helpers\UploadSecurityHelper;

use Yii;

/**
 * This is the model class for table "company".
 *
 * @property int $id
 * @property string|null $company_code
 * @property string|null $category_code
 * @property string $page_code_title
 * @property string $page_code_description
 * @property string|null $full_name
 * @property string|null $description
 * @property string|null $nif
 * @property string|null $cae
 * @property string|null $email_1
 * @property string|null $email_2
 * @property string|null $contact_number_1
 * @property string|null $contact_number_2
 * @property string|null $contact_number_3
 * @property string|null $address_line_1
 * @property string|null $address_line_2
 * @property string|null $website
 * @property string|null $facebook
 * @property string|null $pinterest
 * @property string|null $instagram
 * @property string|null $twitter
 * @property string|null $tiktok
 * @property string|null $linkedin
 * @property string|null $youtube
 * @property string|null $city
 * @property string|null $postcode
 * @property string|null $location
 * @property string|null $country
 * @property string|null $postal_code
 * @property int|null $active
 * @property string|null $moloni_access_token
 * @property string|null $moloni_refresh_token
 * @property string $created_date
 */
class Company extends \yii\db\ActiveRecord
{
    
    public $bannerimage;

    public $logoimage;
    public $mobileLogoImage;

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'company';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
   
        return [
            ['mobileLogoImage','image','extensions'=>'jpeg, jpg, gif, png, webp','maxSize'=>4194304],
            ...($this->hasAttribute('gym_client_session_enabled') ? [['gym_client_session_enabled', 'boolean']] : []),
            ...($this->hasAttribute('gym_client_pass_enabled') ? [['gym_client_pass_enabled', 'boolean']] : []),
            ...($this->hasAttribute('gym_client_week_enabled') ? [['gym_client_week_enabled', 'boolean']] : []),
            ...($this->hasAttribute('gym_client_week_goal') ? [['gym_client_week_goal', 'integer', 'min' => 1, 'max' => 7], ['gym_client_week_goal', 'required']] : []),
            ...($this->hasAttribute('gym_clock_enabled') ? [['gym_clock_enabled', 'boolean']] : []),
            ...($this->hasAttribute('push_notifications_enabled') ? [['push_notifications_enabled', 'boolean']] : []),
            ['cancelation_time', 'default', 'value' => '01:00:00'],
            ['cancelation_time', 'match', 'pattern' => '/^(?:\d+|\d{1,3}:[0-5]\d(?::[0-5]\d)?)$/D', 'message' => Yii::t('app', 'gym_cancellation_time_invalid')],
            ['gym_booking_window_enabled', 'boolean'],
            ['gym_booking_window_hours', 'integer', 'min' => 1, 'max' => 8760],
            ['gym_booking_window_hours', 'validateGymBookingWindow'],
            ['gym_booking_window_hours', 'required', 'when' => static function ($model) { return (bool)$model->gym_booking_window_enabled; }],
            [['slot_min_time','slot_max_time','booking_advance_time','cancelation_time','timespan','page_code_text','color','languages','company_code_url','email_1','contact_number_1','address_line_1','address_line_2','city','postcode','location','country'], 'required'],
            [['active','publish','manteinance','publish_logo_main_page','display_client_page','login_required'], 'integer'],
            [['created_date', 'slot_min_time', 'slot_max_time','languages', 'moloni_access_token', 'moloni_refresh_token'], 'safe'],
            [['slot_min_time','slot_max_time','booking_advance_time','cancelation_time','timespan','template','company_code', 'booking_type','image_logo', 'page_code_banner', 'image_banner', 'manteinance_pt','manteinance_en','company_code_url', 'page_code_text', 'page_code_manteinance', 'company_name', 'nif', 'cae', 'email_1', 'email_2', 'contact_number_1', 'contact_number_2', 'contact_number_3', 'address_line_1', 'address_line_2', 'website', 'facebook', 'pinterest', 'instagram', 'twitter', 'tiktok', 'linkedin', 'youtube', 'city', 'postcode', 'location', 'country', 'postcode','color'], 'string', 'max' => 255],
            ['coin', 'default', 'value' => 'eur'],
            ['coin', 'filter', 'filter' => static function ($value) { return strtolower(Helpers::normalizeCurrencyCode($value, $value)); }],
            ['coin', 'in', 'range' => ['eur', 'usd', 'gbp', 'brl']],
            ['color', 'validateBrandColor'],
            [['page_code_text'], 'unique'],       
            [['company_code','company_code_url'], 'unique'],
            [
                'bannerimage', 
                'image', 
                //'minWidth' => 1800, 
                //'maxWidth' => 2500,
                //'minHeight' => 2500, 
                //'maxHeight' => 2500, 
                'extensions' => 'jpeg, jpg, gif, png', 
                'maxSize' => 1024 * 1024 * 4
           ],
           [
                'logoimage', 
                'image',       
                //'maxHeight' => 500, 
                'extensions' => 'jpeg, jpg, gif, png, webp', 
                'maxSize' => 1024 * 1024 * 4
            ],
        ];
    }

    public function validateGymBookingWindow($attribute)
    {
        if (!$this->gym_booking_window_enabled) return;
        $parts = array_map('intval', explode(':', (string)$this->booking_advance_time));
        $seconds = count($parts) > 1 ? $parts[0] * 3600 + $parts[1] * 60 + ($parts[2] ?? 0) : $parts[0] * 60;
        if ((int)$this->$attribute * 3600 <= $seconds) {
            $this->addError($attribute, Yii::t('app', 'gym_booking_window_invalid'));
        }
    }

    public function validateBrandColor($attribute)
    {
        $normalizedColor = self::normalizeBrandColor($this->$attribute, null);

        if ($normalizedColor === null) {
            $this->addError($attribute, Yii::t('app', 'Use a valid HEX or RGB color.'));
            return;
        }

        $this->$attribute = $normalizedColor;
    }

    public static function normalizeBrandColor($color, $fallback = '#0d6efd')
    {
        $color = trim((string)$color);

        if (preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
            return strtolower($color);
        }

        if (preg_match('/^#([0-9a-fA-F]{3})$/', $color, $matches)) {
            return '#'
                . strtolower($matches[1][0] . $matches[1][0])
                . strtolower($matches[1][1] . $matches[1][1])
                . strtolower($matches[1][2] . $matches[1][2]);
        }

        if (preg_match('/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i', $color, $matches)) {
            $rgb = array_map('intval', [$matches[1], $matches[2], $matches[3]]);
            foreach ($rgb as $value) {
                if ($value < 0 || $value > 255) {
                    return $fallback;
                }
            }

            return 'rgb(' . implode(', ', $rgb) . ')';
        }

        return $fallback;
    }

    public static function brandColorRgb($color, $fallback = '13, 110, 253')
    {
        $color = self::normalizeBrandColor($color, null);

        if ($color === null) {
            return $fallback;
        }

        if (preg_match('/^#([0-9a-f]{6})$/i', $color, $matches)) {
            return hexdec(substr($matches[1], 0, 2)) . ', '
                . hexdec(substr($matches[1], 2, 2)) . ', '
                . hexdec(substr($matches[1], 4, 2));
        }

        if (preg_match('/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i', $color, $matches)) {
            return (int)$matches[1] . ', ' . (int)$matches[2] . ', ' . (int)$matches[3];
        }

        return $fallback;
    }

     /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return array_merge(Helpers::attributeModelLabels(), [
            'gym_client_session_enabled' => Yii::t('app', 'gym_client_show_session'),
            'gym_client_pass_enabled' => Yii::t('app', 'gym_client_show_pass'),
            'gym_client_week_enabled' => Yii::t('app', 'gym_client_show_week'),
            'gym_client_week_goal' => Yii::t('app', 'gym_client_week_goal'),
        ]);
    }

    public function imgUrl(){
        return UploadSecurityHelper::companyViewPublicPath($this->company_code ?: (Yii::$app->user->identity->company_code ?? 'company'), 'company');
    }
    
    public function upload()
    {      
        $model = new Model();
  
        if ($model->validate()) {   
         
            if(isset($this->bannerimage)){

                Helpers::upload(
                    UploadSecurityHelper::companyViewDirectory($this->company_code ?: (Yii::$app->user->identity->company_code ?? 'company'), 'company') . '/' . $this->bannerimage->baseName,
                    900, 
                    500, 
                    'center', 
                    70, 
                    $this->bannerimage->baseName
                );

               
                /*
                $fileName = $this->imageFile->baseName. date('YmdHis');;      

                $this->image = $this->imgUrl() .$fileName.'.'.$this->imageFile->extension;                

                $this->imageFile->saveAs('@frontend/web/images/blog/' . $fileName . '.' . $this->imageFile->extension, false);
                */
                $this->created_date = date('Y-m-d H:i:s');
                
                return true;
            }else{
                return false;
            }       

        } else {
            return false;
        }
    }

    public function updateCompany($page, $model){
    
        $connection = new Query;

        $countries = $connection->select([
            'country_code' 
            ])
        ->from('countries')    
        ->all();

        //team_title_pt

       

        foreach ($countries as $val) {
   
            $text = 'text_'. $val['country_code'];   
            $teamTitle = 'team_title_'. $val['country_code'];
            $teamText = 'team_text_'. $val['country_code'];     
            $teamManteinance = 'manteinance_'. $val['country_code'];             
            

            $connection->createCommand()->delete('translations',
            [   
                'country_code' => $val['country_code'],               
                'page_code' => $model->page_code_manteinance                       
            ])->execute();
         

            $connection->createCommand()->insert('translations', [      
                'country_code' => $val['country_code'],  
                'page' => $page,
                'page_code' => $model->page_code_manteinance,
                'text' => $model->$teamManteinance,
                'active' => 1,
            ])->execute();     

         
            $connection->createCommand()->delete('translations',
            [   
                'country_code' => $val['country_code'],               
                'page_code' => $model->page_code_text                       
            ])->execute();

            $connection->createCommand()->insert('translations', [      
                'country_code' => $val['country_code'],  
                'page' => $page,
                'page_code' => $model->page_code_text,
                'text' => $model->$text,
                'active' => 1,
            ])->execute();                            
        
        
            $connection->createCommand()->delete('translations',
            [   
                'country_code' => $val['country_code'],               
                'page_code' => $model->page_code_team_title                       
            ])->execute();

            $connection->createCommand()->insert('translations', [      
                'country_code' => $val['country_code'],  
                'page' => $page,
                'page_code' => $model->page_code_team_title,
                'text' => $model->$teamTitle,
                'active' => 1,
            ])->execute();  

        
            $connection->createCommand()->delete('translations',
            [   
                'country_code' => $val['country_code'],               
                'page_code' => $model->page_code_team_text                       
            ])->execute();

            $connection->createCommand()->insert('translations', [      
                'country_code' => $val['country_code'],  
                'page' => $page,
                'page_code' => $model->page_code_team_text,
                'text' => $model->$teamText,
                'active' => 1,
            ])->execute(); 

        }
   
    }   
}
