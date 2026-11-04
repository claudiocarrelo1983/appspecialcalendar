<?php
namespace common\helpers;

use Yii;
use yii\db\Query;

/** Company birthday display; no birth years are sent to the mobile app. */
class CompanyBirthdays
{
    public static function rows(string $companyCode, int $viewerId): array
    {
        if (Yii::$app->user->isGuest || $companyCode === '') return [];
        $now = new \DateTimeImmutable('now', new \DateTimeZone(Yii::$app->timeZone));
        $today = $now->format('Y-m-d');
        $access = static function (string $table, string $alias) use ($companyCode, $today): Query {
            $start = "NULLIF(NULLIF(CAST({$alias}.access_start AS CHAR), ''), '0000-00-00')";
            $end = "NULLIF(NULLIF(CAST({$alias}.access_expires AS CHAR), ''), '0000-00-00')";
            return (new Query())->select(new \yii\db\Expression('1'))->from([$alias => $table])
                ->where("{$alias}.user_id = user.id")
                ->andWhere(["{$alias}.company_code" => $companyCode, "{$alias}.status" => 'approved'])
                ->andWhere(new \yii\db\Expression("({$start} IS NULL OR {$start} <= :birthdayToday)", [':birthdayToday' => $today]))
                ->andWhere(new \yii\db\Expression("({$end} IS NULL OR {$end} >= :birthdayToday)", [':birthdayToday' => $today]));
        };
        // Same primary/parent/approved membership scope as getBirthdayDates,
        // including staff and administrators as well as client accounts.
        $people = (new Query())->select(['user.id', 'user.full_name', 'user.dob'])->from(['user' => 'user'])
            ->where(['or', ['user.company_code' => $companyCode], ['user.company_code_parent' => $companyCode],
                ['exists', $access('company_user_membership', 'membership')],
                ['exists', $access('company_access_request', 'access_request')]])
            ->andWhere(['not', ['user.dob' => null]])->all();
        return self::upcoming($people, $viewerId, $now);
    }

    public static function upcoming(array $people, int $viewerId, \DateTimeImmutable $now): array
    {
        $days = [];
        for ($offset = 0; $offset <= 7; $offset++) {
            $date = $now->modify("+{$offset} days");
            $days[$date->format('m-d')] = ['offset' => $offset, 'date' => $date->format('d/m')];
        }
        $rows = [];
        foreach ($people as $person) {
            $dob = trim((string)($person['dob'] ?? ''));
            $birthday = null;
            foreach (['Y-m-d', 'Y/m/d', 'd/m/Y', 'd-m-Y'] as $format) {
                $parsed = \DateTimeImmutable::createFromFormat('!' . $format, $dob, $now->getTimezone());
                if ($parsed && $parsed->format($format) === $dob) { $birthday = $parsed->format('m-d'); break; }
            }
            if (!isset($days[$birthday ?? ''])) continue;
            $day = $days[$birthday];
            $rows[] = ['id' => (int)$person['id'], 'name' => (string)$person['full_name'],
                'date' => $day['date'], 'today' => $day['offset'] === 0,
                'isSelf' => (int)$person['id'] === $viewerId, '_offset' => $day['offset']];
        }
        usort($rows, static fn($a, $b) => ($a['_offset'] <=> $b['_offset']) ?: strcmp($a['name'], $b['name']));
        return array_map(static function ($row) { unset($row['_offset']); return $row; }, $rows);
    }
}
