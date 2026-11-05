<?php

namespace common\models;

use common\helpers\Helpers;
use Yii;
use yii\base\Model;
use yii\data\ActiveDataProvider;

class GymCheckinSearch extends GymCheckin
{
    public $q;
    public $date_from;
    public $date_to;

    public function rules()
    {
        return [
            [['id'], 'integer'],
            [['q', 'company_code', 'client_guid', 'membership_code', 'status', 'checkin_date', 'date_from', 'date_to'], 'safe'],
        ];
    }

    public function scenarios()
    {
        return Model::scenarios();
    }

    public function search($params)
    {
        $companyCode = Yii::$app->user->isGuest ? null : \common\helpers\SecurityAccess::companyCode();
        $query = GymCheckin::find()
            ->alias('checkin')
            ->joinWith(['client client', 'membership membership'])
            ->where(['checkin.company_code' => $companyCode]);
        Helpers::applyCurrentUserLocationScope($query, 'client');

        $dataProvider = new ActiveDataProvider([
            'query' => $query,
            'pagination' => ['pageSize' => 25],
            'sort' => ['defaultOrder' => ['checkin_date' => SORT_DESC]],
        ]);

        $this->load($params);
        $flatParams = $params[$this->formName()] ?? $params;
        foreach (['q', 'client_guid', 'status', 'date_from', 'date_to'] as $attribute) {
            $this->$attribute = $flatParams[$attribute] ?? $this->$attribute;
        }

        if (!$this->validate()) {
            return $dataProvider;
        }

        $query->andFilterWhere([
            'checkin.status' => $this->status,
            'checkin.client_guid' => $this->client_guid,
        ]);

        if (!empty($this->date_from)) {
            $query->andWhere(['>=', 'checkin.checkin_date', date('Y-m-d 00:00:00', strtotime($this->date_from))]);
        }
        if (!empty($this->date_to)) {
            $query->andWhere(['<=', 'checkin.checkin_date', date('Y-m-d 23:59:59', strtotime($this->date_to))]);
        }

        return $dataProvider;
    }
}
